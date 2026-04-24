// Vendor data orchestrator. Given the watchlist and settings, pick the right
// real API for each (vendor, product) pair. Falls back to AI when there's no
// API match or when the API call fails.
//
// Used by both the browser "Fetch now" buttons and scripts/ai-pull.mjs.
// All internal calls are dynamic so callers only pay import cost for the
// APIs they actually use.

import { mapWatchlistToNvd } from './nvd.js';

// Return value: { items: [...], sources: { cisco: 12, nvd: 34, msrc: 7, ai: 0 }, errors: [...] }

export async function fetchSoftware(settings, { env = 'browser' } = {}) {
  const items = [];
  const sources = { cisco: 0, ai: 0 };
  const errors = [];
  const vendors = (settings.watchlist?.vendors || []).filter(v => v.vendor);
  const hasCisco = settings.ciscoApi?.clientId && settings.ciscoApi?.clientSecret;
  const ciscoOpts = {
    clientId: settings.ciscoApi?.clientId,
    clientSecret: settings.ciscoApi?.clientSecret,
    proxy: env === 'browser' ? settings.corsProxy : undefined
  };

  for (const v of vendors) {
    const isCisco = /cisco/i.test(v.vendor);
    const products = v.products?.length ? v.products : [];
    if (isCisco && hasCisco) {
      // Expand any preset labels (e.g. "Catalyst 9800 WLC") via the PID map.
      const pids = expandCiscoPids(products, settings);
      if (pids.length) {
        try {
          const { fetchCiscoSoftware } = await import('./cisco.js');
          const recs = await fetchCiscoSoftware(pids, ciscoOpts);
          for (const r of recs) items.push(r);
          sources.cisco += recs.length;
          continue;
        } catch (err) {
          errors.push(`Cisco software: ${err.message}`);
        }
      }
    }
    // No real API — let the AI path handle this vendor (caller merges).
  }

  return { items, sources, errors };
}

export async function fetchCves(settings, { env = 'browser' } = {}) {
  const items = [];
  const sources = { nvd: 0, cisco: 0, msrc: 0, paloalto: 0, citrix: 0, ai: 0 };
  const errors = [];
  const vendors = (settings.watchlist?.vendors || []).filter(v => v.vendor);

  const nvdKey = settings.nvdApi?.apiKey;
  const hasCisco = settings.ciscoApi?.clientId && settings.ciscoApi?.clientSecret;
  const ciscoOpts = {
    clientId: settings.ciscoApi?.clientId,
    clientSecret: settings.ciscoApi?.clientSecret,
    proxy: env === 'browser' ? settings.corsProxy : undefined
  };
  const nodeProxy = env === 'browser' ? settings.corsProxy : undefined;

  // Track which (vendor,product) pairs were handled by a real API so we can
  // tell the AI path to skip them.
  const handled = new Set();

  // 1) NVD for anything that maps (works in browser, CORS-OK).
  try {
    const { fetchNvdForProduct } = await import('./nvd.js');
    for (const v of vendors) {
      const prods = v.products?.length ? v.products : [''];
      for (const p of prods) {
        const info = mapWatchlistToNvd(v.vendor, p);
        if (!info) continue;
        try {
          const cves = await fetchNvdForProduct(v.vendor, p, { apiKey: nvdKey, daysBack: 90 });
          for (const c of cves) items.push(c);
          sources.nvd += cves.length;
          handled.add(`${v.vendor}|${p}`);
        } catch (err) {
          errors.push(`NVD ${v.vendor}/${p}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    errors.push(`NVD load: ${err.message}`);
  }

  // 2) Cisco PSIRT — if credentials configured, pull advisories per OSType
  // and also map back to the watchlist products for attribution.
  if (hasCisco && vendors.some(v => /cisco/i.test(v.vendor))) {
    try {
      const { fetchCiscoCves } = await import('./cisco.js');
      const osTypes = pickCiscoOsTypes(vendors);
      const adv = await fetchCiscoCves({ osTypes, opts: ciscoOpts });
      for (const c of adv) items.push(c);
      sources.cisco += adv.length;
    } catch (err) {
      errors.push(`Cisco PSIRT: ${err.message}`);
    }
  }

  // 3) MSRC — Windows. Only if env is Node or a proxy is configured.
  const wantsMs = vendors.some(v => /microsoft|windows/i.test(v.vendor));
  if (wantsMs && (env === 'node' || nodeProxy)) {
    try {
      const { fetchRecentMsrcCves } = await import('./msrc.js');
      const recent = await fetchRecentMsrcCves({ months: 2, proxy: nodeProxy });
      for (const c of recent) items.push(c);
      sources.msrc += recent.length;
    } catch (err) {
      errors.push(`MSRC: ${err.message}`);
    }
  }

  // 4) Palo Alto + Citrix — same proxy constraint.
  const wantsPa = vendors.some(v => /palo\s*alto/i.test(v.vendor));
  if (wantsPa && (env === 'node' || nodeProxy)) {
    try {
      const { fetchPaloAlto } = await import('./vendor-advisories.js');
      const pa = await fetchPaloAlto({ proxy: nodeProxy });
      for (const c of pa) items.push(c);
      sources.paloalto += pa.length;
    } catch (err) {
      errors.push(`Palo Alto: ${err.message}`);
    }
  }
  const wantsCitrix = vendors.some(v => /citrix|netscaler/i.test(v.vendor));
  if (wantsCitrix && (env === 'node' || nodeProxy)) {
    try {
      const { fetchCitrix } = await import('./vendor-advisories.js');
      const cx = await fetchCitrix({ proxy: nodeProxy });
      for (const c of cx) items.push(c);
      sources.citrix += cx.length;
    } catch (err) {
      errors.push(`Citrix: ${err.message}`);
    }
  }

  // Dedupe by CVE id (first-seen wins, but merge references).
  const deduped = dedupeCves(items);
  return { items: deduped, sources, errors, handled };
}

function dedupeCves(items) {
  const byId = new Map();
  for (const it of items) {
    const key = it.id || JSON.stringify([it.vendor, it.product, it.summary?.slice(0, 40)]);
    const prev = byId.get(key);
    if (!prev) { byId.set(key, it); continue; }
    // Merge: prefer the record with a real CVSS score; union references.
    const merged = { ...prev, ...it };
    if (!merged.cvss && prev.cvss) merged.cvss = prev.cvss;
    if (!merged.severity && prev.severity) merged.severity = prev.severity;
    merged.references = [...new Set([...(prev.references || []), ...(it.references || [])])];
    // Keep a bread-crumb of every source that reported this CVE.
    const prevSources = Array.isArray(prev.sources) ? prev.sources
      : prev.source ? [prev.source] : [];
    const thisSrc = it.source ? [it.source] : [];
    merged.sources = [...new Set([...prevSources, ...thisSrc])];
    delete merged.source;
    byId.set(key, merged);
  }
  return [...byId.values()];
}

function pickCiscoOsTypes(vendors) {
  const set = new Set();
  for (const v of vendors) {
    if (!/cisco/i.test(v.vendor)) continue;
    for (const p of v.products || []) {
      const low = p.toLowerCase();
      if (/nx[-\s]?os/.test(low))   set.add('nxos');
      if (/ios[-\s]?xe|9800|catalyst/.test(low)) set.add('iosxe');
      if (/\bios\b/.test(low) && !/ios[-\s]?xe/.test(low)) set.add('ios');
      if (/asa/.test(low)) set.add('asa');
      if (/ftd|firepower/.test(low)) set.add('ftd');
    }
    // Vendor-only entry → default to the big two.
    if (!(v.products || []).length) { set.add('ios'); set.add('iosxe'); }
  }
  return [...set];
}

// Expand friendly labels ("Catalyst 9800 WLC") into the actual PIDs Cisco
// expects. Also allows users to pass raw PIDs directly.
function expandCiscoPids(products, settings) {
  const custom = settings.ciscoApi?.pidPresets || {};
  const out = new Set();
  const presetsLazy = () => import('./cisco.js').then(m => m.CISCO_PID_PRESETS);
  // Inline-sync version — we already know the shape.
  const INLINE_FALLBACK = {
    'catalyst 9800 wlc': ['C9800-40-K9','C9800-80-K9','C9800-L-F-K9','C9800-L-C-K9','C9800-CL-K9'],
    'isr 4000 router':   ['ISR4321/K9','ISR4331/K9','ISR4351/K9','ISR4431/K9','ISR4451-X/K9','ISR4461/K9'],
    'asr 1000 router':   ['ASR1001-X','ASR1001-HX','ASR1002-HX','ASR1006-X'],
    'catalyst 9300 switch': ['C9300-24P-A','C9300-24T-A','C9300-48P-A','C9300-48T-A'],
    'catalyst 9500 switch': ['C9500-24Y4C-A','C9500-40X-A','C9500-48Y4C-A']
  };
  for (const p of products) {
    const low = (p || '').trim().toLowerCase();
    if (!low) continue;
    // Raw PID heuristic: contains digits and a slash or a hyphen.
    if (/[A-Z0-9]+[-/][A-Z0-9]/i.test(p) && !low.includes(' ')) { out.add(p); continue; }
    // User-defined preset overrides the built-in one.
    const pids = custom[p] || custom[low] || INLINE_FALLBACK[low];
    if (pids) for (const pid of pids) out.add(pid);
  }
  return [...out];
}
