// Cisco APIs — dual-env (browser + Node). Covers:
//   Software Suggestion v2     — recommended/latest releases per PID
//   Software Download v2        — download URLs / release metadata per PID
//   Product Information v1      — name/series lookup per PID
//   PSIRT openVuln v2           — advisories by OSType (ios, iosxe, nxos, asa, ftd)
//
// Auth: OAuth2 client_credentials against id.cisco.com. Token cached until
// ~30s before expiry. Pass {clientId, clientSecret} — both required.
//
// Browser note: Cisco's APIs do NOT send CORS headers, so direct calls from a
// page will fail. Provide a proxy prefix via `opts.proxy` (e.g. a Cloudflare
// Worker that forwards with the Authorization header intact) OR run from
// Node (scripts/ai-pull.mjs). The Node path uses global fetch (Node 18+).

const TOKEN_URL    = 'https://id.cisco.com/oauth2/default/v1/token';
const SUGGEST_BASE = 'https://apix.cisco.com/software/suggestion/v2/suggestions/software/productIds/';
const DOWNLOAD_BASE = 'https://apix.cisco.com/software/download/v2/software/products/';
const PRODUCT_BASE = 'https://apix.cisco.com/product/v1/information/product_ids/';
const PSIRT_BASE   = 'https://apix.cisco.com/security/advisories/v2/advisories/';

// Curated PID catalogue — used by the Settings UI and the ai-pull script to
// seed watchlist products without forcing users to memorise SKUs.
export const CISCO_PID_PRESETS = {
  'Catalyst 9800 WLC': [
    'C9800-40-K9', 'C9800-80-K9',
    'C9800-L-F-K9', 'C9800-L-C-K9',
    'C9800-CL-K9'
  ],
  'ISR 4000 Router': [
    'ISR4321/K9', 'ISR4331/K9', 'ISR4351/K9',
    'ISR4431/K9', 'ISR4451-X/K9', 'ISR4461/K9'
  ],
  'ASR 1000 Router': [
    'ASR1001-X', 'ASR1001-HX', 'ASR1002-HX', 'ASR1006-X'
  ],
  'Catalyst 9300 Switch': [
    'C9300-24P-A', 'C9300-24T-A', 'C9300-48P-A', 'C9300-48T-A'
  ],
  'Catalyst 9500 Switch': [
    'C9500-24Y4C-A', 'C9500-40X-A', 'C9500-48Y4C-A'
  ]
};

// OS types for PSIRT openVuln advisory feeds.
export const PSIRT_OS_TYPES = ['ios', 'iosxe', 'nxos', 'asa', 'ftd', 'fxos'];

// In-memory token cache (per-process).
const _tokenCache = new Map(); // clientId -> { token, expires }

function now() { return Date.now(); }

async function getToken({ clientId, clientSecret, proxy }) {
  if (!clientId || !clientSecret) throw new Error('Cisco clientId + clientSecret required');
  const cached = _tokenCache.get(clientId);
  if (cached && cached.expires > now() + 30_000) return cached.token;

  const url = (proxy || '') + TOKEN_URL;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Cisco OAuth ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  if (!j.access_token) throw new Error('Cisco OAuth: no access_token in response');
  const expires = now() + (j.expires_in || 3600) * 1000;
  _tokenCache.set(clientId, { token: j.access_token, expires });
  return j.access_token;
}

async function apiGet(urlBase, pathAndQuery, opts) {
  const token = await getToken(opts);
  const url = (opts.proxy || '') + urlBase + pathAndQuery;
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
  });
  if (res.status === 401) {
    // Token probably revoked early — force refresh and retry once.
    _tokenCache.delete(opts.clientId);
    const t2 = await getToken(opts);
    const r2 = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + t2, 'Accept': 'application/json' }
    });
    if (!r2.ok) throw new Error(`Cisco API ${r2.status} after retry`);
    return r2.json();
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Cisco API ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// --- Software Suggestion -------------------------------------------------

// Returns the suggested (TAC-recommended) releases for one or more PIDs.
// Normalised shape: [{ pid, productName, releases: [{ releaseFormat1, releaseFormat2,
//   isSuggested, releaseDate, fcsDate, softwareType, releaseLifeCycle,
//   majorRelease, trainName, imageDetails: [{imageDescription, imageName, imageSize}] }] }]
export async function getSuggestedReleases(pids, opts) {
  const list = Array.isArray(pids) ? pids : [pids];
  if (!list.length) return [];
  // API accepts comma-separated PIDs, max 20 per call.
  const out = [];
  for (let i = 0; i < list.length; i += 20) {
    const chunk = list.slice(i, i + 20).map(encodeURIComponent).join(',');
    const j = await apiGet(SUGGEST_BASE, chunk, opts);
    const products = j.productList || j.productIds || j.products || [];
    for (const p of products) {
      out.push({
        pid: p.product?.basePID || p.productId || p.pid || '',
        productName: p.product?.productName || p.productName || '',
        mdfId: p.product?.mdfId || '',
        releases: (p.suggestions || p.suggestedReleases || []).map(r => ({
          version:       r.releaseFormat1 || r.releaseFormat2 || r.version || '',
          altVersion:    r.releaseFormat2 || '',
          isSuggested:   r.isSuggested === 'Y' || r.isSuggested === true,
          suggestionRank: r.id || r.rank || '',
          releaseDate:   r.releaseDate || r.firstCustomerShipDate || '',
          fcsDate:       r.firstCustomerShipDate || '',
          softwareType:  r.softwareType || '',
          lifecycle:     r.releaseLifeCycle || r.lifeCycle || '',  // ED/MD/LD/GD
          majorRelease:  r.majorRelease || '',
          trainName:     r.trainName || '',
          images:        (r.imageDetails || []).map(img => ({
            name: img.imageName || '',
            description: img.imageDescription || '',
            size: img.imageSize || '',
            md5: img.imageMD5 || '',
            sha512: img.imageSHA512 || ''
          }))
        }))
      });
    }
  }
  return out;
}

// --- Software Download (metadata only — download requires entitlement) ---

export async function getSoftwareForProduct(pid, opts) {
  return apiGet(DOWNLOAD_BASE, encodeURIComponent(pid), opts);
}

// --- Product Information -------------------------------------------------

export async function getProductInfo(pids, opts) {
  const list = Array.isArray(pids) ? pids : [pids];
  if (!list.length) return [];
  const chunk = list.slice(0, 50).map(encodeURIComponent).join(',');
  const j = await apiGet(PRODUCT_BASE, chunk, opts);
  return j.productList || j.products || [];
}

// --- PSIRT openVuln ------------------------------------------------------

// Fetches all advisories for an OSType (ios, iosxe, nxos, asa, ftd, fxos).
// Optionally filter by version. Returns normalised CVE-shaped records ready
// to merge into data/cves.json.
export async function getAdvisoriesByOSType(osType, { version, opts } = {}) {
  if (!PSIRT_OS_TYPES.includes(osType)) throw new Error('Invalid OSType: ' + osType);
  const qs = version ? `?version=${encodeURIComponent(version)}` : '';
  const j = await apiGet(PSIRT_BASE, `OSType/${osType}${qs}`, opts);
  return normalisePsirt(j.advisories || j);
}

export async function getAdvisoriesLatest(n = 25, opts) {
  const j = await apiGet(PSIRT_BASE, `latest/${Math.max(1, Math.min(100, n))}`, opts);
  return normalisePsirt(j.advisories || j);
}

export async function getAdvisoriesBySeverity(severity, opts) {
  const sev = String(severity).toLowerCase();
  if (!['critical', 'high', 'medium', 'low', 'informational'].includes(sev)) {
    throw new Error('Invalid severity: ' + severity);
  }
  const j = await apiGet(PSIRT_BASE, `severity/${sev}`, opts);
  return normalisePsirt(j.advisories || j);
}

function normalisePsirt(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const a of arr) {
    const cves = Array.isArray(a.cves) ? a.cves : (a.cve ? [a.cve] : []);
    // A single advisory may cover multiple CVEs — emit one record per CVE so
    // the CVE table keys cleanly on id, but keep the advisory URL/title.
    for (const id of (cves.length ? cves : ['ADV-' + (a.advisoryId || a.id || '')])) {
      out.push({
        id,
        advisoryId: a.advisoryId || a.id || '',
        advisoryTitle: a.advisoryTitle || a.title || '',
        severity: (a.sir || a.severity || '').toLowerCase(),
        cvss: Number(a.cvssBaseScore || a.cvss || 0) || '',
        summary: a.summary || a.description || '',
        published: a.firstPublished || a.publicationDate || '',
        updated: a.lastUpdated || a.lastPublished || '',
        references: [
          a.publicationUrl || '',
          ...((a.ipsSignatures || []).map(s => s.url).filter(Boolean))
        ].filter(Boolean),
        productNames: a.productNames || [],
        vendor: 'Cisco'
      });
    }
  }
  return out;
}

// Convenience: given a set of PIDs, produce software.json-shaped records.
export async function fetchCiscoSoftware(pids, opts) {
  const suggestions = await getSuggestedReleases(pids, opts);
  return suggestions.map(s => {
    const suggested = s.releases.find(r => r.isSuggested) || s.releases[0] || {};
    const latest = s.releases[0] || {};
    return {
      vendor: 'Cisco',
      product: s.productName || s.pid,
      pid: s.pid,
      latest: latest.version || '',
      recommended: suggested.version || '',
      lifecycle: suggested.lifecycle || '',
      releaseDate: suggested.releaseDate || '',
      trainName: suggested.trainName || '',
      // Carry up to 5 releases for richer UI rendering.
      releases: s.releases.slice(0, 5).map(r => ({
        version: r.version,
        suggested: r.isSuggested,
        lifecycle: r.lifecycle,
        releaseDate: r.releaseDate
      })),
      notes: suggested.isSuggested
        ? `TAC-suggested${suggested.lifecycle ? ' (' + suggested.lifecycle + ')' : ''}`
        : 'Latest release (no TAC suggestion)',
      source: 'cisco-software-suggestion'
    };
  });
}

// Convenience: CVEs for a set of OSTypes, merged.
export async function fetchCiscoCves({ osTypes = ['ios', 'iosxe'], opts }) {
  const out = [];
  for (const osType of osTypes) {
    try {
      const adv = await getAdvisoriesByOSType(osType, { opts });
      for (const a of adv) out.push({ ...a, product: osType.toUpperCase() });
    } catch (err) {
      console.warn(`[cisco] advisories ${osType}:`, err.message);
    }
  }
  return out;
}
