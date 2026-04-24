// Microsoft Security Response Center — CVRF v2.0 API.
// https://api.msrc.microsoft.com/cvrf/v2.0/updates           -> list updates
// https://api.msrc.microsoft.com/cvrf/v2.0/cvrf/{id}         -> one update
//
// MSRC does not require an API key for the public CVRF endpoints. CORS is
// not served, so this is Node-only in practice (or browser-via-proxy).

const MSRC_BASE = 'https://api.msrc.microsoft.com/cvrf/v2.0';

// List of available CVRF documents — newest first (yyyy-MMM style IDs).
export async function listUpdates({ proxy } = {}) {
  const url = (proxy || '') + MSRC_BASE + '/updates';
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`MSRC updates ${res.status}`);
  const j = await res.json();
  return (j.value || []).map(u => ({
    id: u.ID,               // e.g. "2026-Apr"
    title: u.DocumentTitle,
    releaseDate: u.InitialReleaseDate,
    currentReleaseDate: u.CurrentReleaseDate,
    cvrfUrl: u.CvrfUrl,
    alias: u.Alias
  }));
}

// Fetch one CVRF bulletin by ID (e.g. "2026-Apr") and normalise its
// vulnerabilities into CVE-shaped records.
export async function getCvrf(id, { proxy } = {}) {
  const url = (proxy || '') + `${MSRC_BASE}/cvrf/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`MSRC cvrf ${id}: ${res.status}`);
  const j = await res.json();
  return normaliseCvrf(j);
}

function normaliseCvrf(doc) {
  const out = [];
  const products = productLookup(doc);
  for (const v of doc.Vulnerability || []) {
    const cve = v.CVE || '';
    const title = v.Title?.Value || '';
    const summary =
      (v.Notes?.Note || []).find(n => n.Type === 2 || n.Title === 'Description')?.Value ||
      title;
    const cvssSet = (v.CVSSScoreSets?.ScoreSet || [])[0] || {};
    const score = Number(cvssSet.BaseScore || 0) || '';
    const severity = cvssThreatSeverity(v, score);
    const productIds = (v.ProductStatuses?.[0]?.ProductID || []);
    const productNames = productIds.map(pid => products[pid]).filter(Boolean);
    const refs = (v.References?.Reference || []).map(r => r.URL).filter(Boolean);
    // Dedupe products by primary family (Windows 10/11/Server).
    const families = dedupeFamilies(productNames);
    for (const fam of families.length ? families : ['Microsoft']) {
      out.push({
        id: cve,
        severity,
        cvss: score,
        summary,
        title,
        vendor: 'Microsoft',
        product: fam,
        references: refs,
        source: 'msrc'
      });
    }
  }
  return out;
}

function productLookup(doc) {
  const out = {};
  const branches = doc.ProductTree?.Branch || [];
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.FullProductName) {
        for (const p of (Array.isArray(n.FullProductName) ? n.FullProductName : [n.FullProductName])) {
          if (p.ProductID) out[p.ProductID] = p.Value;
        }
      }
      if (n.Branch) walk(n.Branch);
    }
  };
  walk(branches);
  return out;
}

function cvssThreatSeverity(v, score) {
  // MSRC publishes severity under Threats[] with Type=3.
  const t = (v.Threats || []).find(x => x.Type === 3);
  if (t?.Description?.Value) return t.Description.Value.toLowerCase();
  // Fall back to CVSS banding.
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0)  return 'low';
  return '';
}

function dedupeFamilies(names) {
  const set = new Set();
  for (const n of names) {
    if (/Windows Server/i.test(n)) set.add('Windows Server');
    else if (/Windows 11/i.test(n)) set.add('Windows 11');
    else if (/Windows 10/i.test(n)) set.add('Windows 10');
    else if (/Office/i.test(n))     set.add('Microsoft Office');
    else if (/SQL Server/i.test(n)) set.add('SQL Server');
    else if (/Exchange/i.test(n))   set.add('Exchange Server');
    else set.add(n.split(/\s+for\s+/i)[0] || n);
  }
  return [...set];
}

// Convenience: latest CVEs from the most recent N monthly bulletins.
export async function fetchRecentMsrcCves({ months = 2, proxy } = {}) {
  const updates = await listUpdates({ proxy });
  const slice = updates.slice(0, Math.max(1, months));
  const all = [];
  for (const u of slice) {
    try {
      const items = await getCvrf(u.id, { proxy });
      for (const c of items) all.push({ ...c, published: u.releaseDate });
    } catch (err) {
      console.warn('[msrc]', u.id, err.message);
    }
  }
  return all;
}
