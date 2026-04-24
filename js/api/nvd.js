// NVD REST API v2 client. Works in both browser and Node — NVD serves CORS
// headers so the browser can call it directly.
//
// Without an API key NVD rate-limits aggressively (5 req / 30s). Pass
// {apiKey} in opts to raise the limit (50 req / 30s). The module self-paces
// to stay under the public limit when no key is provided.

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

// Products we care about, mapped to NVD CPE vendor:product.
// keyed by a stable internal label used as the watchlist product.
export const NVD_PRODUCT_MAP = {
  'Cisco IOS':        { cpe: 'cpe:2.3:o:cisco:ios:*',                    vendor: 'Cisco',     product: 'IOS' },
  'Cisco IOS XE':     { cpe: 'cpe:2.3:o:cisco:ios_xe:*',                 vendor: 'Cisco',     product: 'IOS XE' },
  'Cisco NX-OS':      { cpe: 'cpe:2.3:o:cisco:nx-os:*',                  vendor: 'Cisco',     product: 'NX-OS' },
  'Cisco ASA':        { cpe: 'cpe:2.3:o:cisco:adaptive_security_appliance_software:*', vendor: 'Cisco', product: 'ASA' },
  'Cisco FTD':        { cpe: 'cpe:2.3:o:cisco:firepower_threat_defense:*', vendor: 'Cisco',   product: 'FTD' },
  'Citrix NetScaler': { cpe: 'cpe:2.3:a:citrix:netscaler_application_delivery_controller:*', vendor: 'Citrix', product: 'NetScaler ADC' },
  'Citrix ADC':       { cpe: 'cpe:2.3:a:citrix:application_delivery_controller:*', vendor: 'Citrix', product: 'ADC' },
  'Palo Alto PAN-OS': { cpe: 'cpe:2.3:o:paloaltonetworks:pan-os:*',      vendor: 'Palo Alto', product: 'PAN-OS' },
  'Microsoft Windows': { cpe: 'cpe:2.3:o:microsoft:windows:*',           vendor: 'Microsoft', product: 'Windows' },
  'Microsoft Windows Server': { cpe: 'cpe:2.3:o:microsoft:windows_server:*', vendor: 'Microsoft', product: 'Windows Server' }
};

// Pick entries that match one of these vendor strings. Case-insensitive.
export function mapWatchlistToNvd(vendor, product) {
  const v = (vendor || '').toLowerCase();
  const p = (product || '').toLowerCase();
  // Exact label match first (fastest, most precise).
  for (const [label, info] of Object.entries(NVD_PRODUCT_MAP)) {
    if (label.toLowerCase() === `${v} ${p}`.trim()) return info;
    if (label.toLowerCase() === p) return info;
  }
  // Fuzzy: match on vendor + substring product.
  for (const [label, info] of Object.entries(NVD_PRODUCT_MAP)) {
    const lv = info.vendor.toLowerCase();
    const lp = info.product.toLowerCase();
    if (lv === v && (p.includes(lp) || lp.includes(p))) return info;
  }
  return null;
}

export async function searchCves({
  cpe,                  // e.g. 'cpe:2.3:o:cisco:ios_xe:*'
  publishedSince,       // Date or ISO string
  publishedUntil,
  severity,             // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  keyword,
  resultsPerPage = 100,
  maxPages = 3,
  apiKey
} = {}) {
  const params = new URLSearchParams();
  if (cpe)       params.set('virtualMatchString', cpe);
  if (severity)  params.set('cvssV3Severity', severity.toUpperCase());
  if (keyword)   params.set('keywordSearch', keyword);
  // NVD requires pubStartDate + pubEndDate together; they also must span
  // ≤120 days. If only one is supplied we fill the other and clamp the range.
  if (publishedSince || publishedUntil) {
    const end = publishedUntil ? new Date(publishedUntil) : new Date();
    const start = publishedSince ? new Date(publishedSince) : new Date(end.getTime() - 120 * 86400_000);
    const clampedStart = new Date(Math.max(start.getTime(), end.getTime() - 120 * 86400_000));
    params.set('pubStartDate', toNvdDate(clampedStart));
    params.set('pubEndDate',   toNvdDate(end));
  }
  params.set('resultsPerPage', String(resultsPerPage));

  const headers = { 'Accept': 'application/json' };
  if (apiKey) headers['apiKey'] = apiKey;

  const out = [];
  let startIndex = 0;
  for (let page = 0; page < maxPages; page++) {
    params.set('startIndex', String(startIndex));
    const url = `${NVD_BASE}?${params.toString()}`;
    const res = await fetch(url, { headers });
    if (res.status === 403 || res.status === 429) {
      // Rate-limited — pause and retry once.
      await sleep(apiKey ? 6_000 : 30_000);
      const r2 = await fetch(url, { headers });
      if (!r2.ok) throw new Error(`NVD ${r2.status} (rate-limited)`);
      const j2 = await r2.json();
      for (const v of j2.vulnerabilities || []) out.push(normaliseNvdCve(v));
      startIndex += j2.resultsPerPage || resultsPerPage;
      if (out.length >= (j2.totalResults || 0)) break;
      continue;
    }
    if (!res.ok) throw new Error(`NVD ${res.status}`);
    const j = await res.json();
    for (const v of j.vulnerabilities || []) out.push(normaliseNvdCve(v));
    startIndex += j.resultsPerPage || resultsPerPage;
    if (out.length >= (j.totalResults || 0)) break;
    // Self-pace. Public: ~6s between requests. With key: ~0.7s.
    await sleep(apiKey ? 800 : 6_500);
  }
  return out;
}

function toNvdDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  // NVD wants ISO-8601 with milliseconds but no zone suffix — e.g. 2026-01-01T00:00:00.000
  return dt.toISOString().replace('Z', '');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normaliseNvdCve(v) {
  const c = v.cve || v;
  const id = c.id || c.CVE_data_meta?.ID || '';
  const descEn = (c.descriptions || []).find(d => d.lang === 'en') || {};
  const metrics = c.metrics || {};
  const cvss = pickCvss(metrics);
  const refs = (c.references || []).map(r => r.url).filter(Boolean);
  // Guess vendor/product from the first vulnerable configuration match.
  const cfg = (c.configurations || [])[0];
  const match = cfg?.nodes?.[0]?.cpeMatch?.[0]?.criteria || '';
  const [, , , cVendor, cProduct] = match.split(':');
  return {
    id,
    severity: (cvss.severity || '').toLowerCase(),
    cvss: cvss.score || '',
    summary: descEn.value || '',
    published: c.published || '',
    lastModified: c.lastModified || '',
    vendor: titleCase(cVendor || ''),
    product: titleCase((cProduct || '').replace(/_/g, ' ')),
    references: refs,
    source: 'nvd'
  };
}

function pickCvss(metrics) {
  const m =
    metrics.cvssMetricV31?.[0]?.cvssData ||
    metrics.cvssMetricV30?.[0]?.cvssData ||
    metrics.cvssMetricV2?.[0]?.cvssData;
  if (!m) return {};
  return {
    score: m.baseScore,
    severity: m.baseSeverity || metrics.cvssMetricV2?.[0]?.baseSeverity || ''
  };
}

function titleCase(s) {
  return String(s || '').split(/[\s_]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ').trim();
}

// Convenience wrapper: "recent CVEs for this watchlist entry" — used by the
// orchestrator when a vendor/product matches an NVD_PRODUCT_MAP entry.
export async function fetchNvdForProduct(vendor, product, { daysBack = 90, apiKey } = {}) {
  const info = mapWatchlistToNvd(vendor, product);
  if (!info) return [];
  const since = new Date(Date.now() - daysBack * 86400_000);
  const cves = await searchCves({
    cpe: info.cpe,
    publishedSince: since,
    apiKey
  });
  // Override vendor/product with the canonical label — NVD's auto-derived
  // names can be noisy (e.g. "Adaptive_security_appliance_software").
  return cves.map(c => ({ ...c, vendor: info.vendor, product: info.product }));
}
