// One-shot import of the user-supplied Palo Alto CVE CSV into data/cves.json.
//
// CSV is from Palo Alto's security advisories portal export and contains
// fields that span multiple lines inside quoted cells. The header has a
// known typo (missing opening quote on `Privileges Required"`) — we tolerate
// that during parsing.
//
// Run: node scripts/import-palo-cves.mjs
//   (defaults to reading from C:/Users/withe/Downloads/Palo alto.csv)

import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || 'C:/Users/withe/Downloads/Palo alto.csv';
const DST = path.resolve('data/cves.json');
const MANIFEST = path.resolve('data/manifest.json');

// ---------- Robust RFC 4180 CSV parser ----------------------------------
// Handles:
//   - Quoted fields with embedded commas
//   - Quoted fields with embedded newlines (cells span multiple text lines)
//   - "" inside quotes = literal "
//   - CRLF or LF row endings
//   - Final row without a trailing newline
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let cellStart = true; // tracks whether we're at the very first char of a cell
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    // Unquoted state.
    if (c === '"' && cellStart) { inQuotes = true; cellStart = false; i++; continue; }
    if (c === ',') { row.push(cell); cell = ''; cellStart = true; i++; continue; }
    if (c === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; cellStart = true; i++; continue;
    }
    if (c === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ''; cellStart = true; i++; continue;
    }
    cell += c; cellStart = false; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------- Severity normalisation -------------------------------------
function normaliseSeverity(s) {
  const v = String(s || '').trim().toLowerCase();
  if (v.includes('critical')) return 'critical';
  if (v.includes('high'))     return 'high';
  if (v.includes('medium') || v.includes('moderate')) return 'medium';
  if (v.includes('low'))      return 'low';
  if (v.includes('none') || v === '') return 'low';
  return v;
}

// Build a usable summary string from the rich source columns.
function buildSummary(row) {
  const title    = row.title || '';
  const product  = row.product || '';
  const versions = row.applicableVersions || '';
  const affected = row.affected || '';
  const fixed    = row.unaffected || '';
  const problem  = row.problem || '';
  const solution = row.solution || '';
  const workaround = row.workaround || '';

  const parts = [];
  if (title) parts.push(title.replace(/\s*\n\s*/g, ' '));
  if (problem) {
    const p = problem.replace(/\s*\n\s*/g, ' ').trim();
    if (p && !title.includes(p.slice(0, 60))) parts.push(p);
  }
  // Concise fix line
  const fix = [];
  if (fixed) fix.push('Fixed: ' + fixed.replace(/\s*\n\s*/g, ' / ').trim());
  if (affected && !fixed) fix.push('Affected: ' + affected.replace(/\s*\n\s*/g, ' / ').trim());
  if (workaround && !/^no known workarounds/i.test(workaround.trim())) {
    fix.push('Workaround: ' + workaround.replace(/\s*\n\s*/g, ' ').trim().slice(0, 200));
  }
  if (fix.length) parts.push(fix.join(' · '));

  // Trim to a reasonable length so the table stays readable.
  let text = parts.join(' — ');
  if (text.length > 800) text = text.slice(0, 797).trim() + '…';
  return text;
}

// ---------- Read + parse ------------------------------------------------
console.log('Reading', SRC);
const csvText = fs.readFileSync(SRC, 'utf8');
const rows = parseCSV(csvText);
console.log('Raw rows (incl. header):', rows.length);

// Headers come from row 0. Normalise column names for lookup.
const headers = rows[0].map(h => h.replace(/^"+|"+$/g, '').trim());
console.log('Headers:', headers);

const colIdx = {};
for (let i = 0; i < headers.length; i++) {
  const k = headers[i].toLowerCase();
  if (k.includes('id')) colIdx.id ||= i;
  else if (k === 'severity') colIdx.severity = i;
  else if (k === 'title') colIdx.title = i;
  else if (k === 'product') colIdx.product = i;
  else if (k.includes('applicable')) colIdx.applicableVersions = i;
  else if (k === 'affected') colIdx.affected = i;
  else if (k.includes('unaff')) colIdx.unaffected = i;
  else if (k.startsWith('date published')) colIdx.published = i;
  else if (k === 'cvss base score' || k.includes('cvss base score')) colIdx.cvss = i;
  else if (k === 'problem') colIdx.problem = i;
  else if (k === 'solution') colIdx.solution = i;
  else if (k === 'workaround') colIdx.workaround = i;
  else if (k === 'url') colIdx.url = i;
}
// Manual override for the special "ID" column (always col 0 in this export).
colIdx.id = 0;

console.log('Column map:', colIdx);

// ---------- Transform rows ----------------------------------------------
const importedById = new Map();
let skipped = 0;
for (let r = 1; r < rows.length; r++) {
  const cells = rows[r];
  if (!cells || cells.length < 2) { skipped++; continue; }
  const id = (cells[colIdx.id] || '').trim();
  if (!/^(CVE|PAN-SA)-/i.test(id)) { skipped++; continue; }
  const cvssRaw = parseFloat((cells[colIdx.cvss] || '').trim());
  const obj = {
    id,
    vendor: 'Palo Alto',
    product: ((cells[colIdx.product] || '').replace(/\s*\n\s*/g, ', ').trim()) || 'Palo Alto Networks',
    severity: normaliseSeverity(cells[colIdx.severity]),
    cvss: Number.isFinite(cvssRaw) ? cvssRaw : null,
    summary: buildSummary({
      title: cells[colIdx.title],
      product: cells[colIdx.product],
      applicableVersions: cells[colIdx.applicableVersions],
      affected: cells[colIdx.affected],
      unaffected: cells[colIdx.unaffected],
      problem: cells[colIdx.problem],
      solution: cells[colIdx.solution],
      workaround: cells[colIdx.workaround]
    }),
    published: (cells[colIdx.published] || '').trim() || undefined,
    references: cells[colIdx.url] ? [cells[colIdx.url].trim()] : undefined,
    source: 'Palo Alto Security Advisories CSV'
  };
  // Drop nulls / undefined to keep the JSON tidy.
  if (obj.cvss == null) delete obj.cvss;
  if (!obj.published) delete obj.published;
  if (!obj.references || !obj.references.length) delete obj.references;
  importedById.set(id, obj);
}

console.log('Parsed entries:', importedById.size, '· skipped:', skipped);

// ---------- Merge into existing cves.json -------------------------------
const existing = JSON.parse(fs.readFileSync(DST, 'utf8'));
existing.items ||= [];
const before = existing.items.length;
const seen = new Set(existing.items.map(x => x.id));

let added = 0, updated = 0;
for (const [id, obj] of importedById) {
  if (seen.has(id)) {
    // Update in place — preserve any hand-curated fields that the existing
    // entry has but our import doesn't (e.g. a richer manual summary).
    const idx = existing.items.findIndex(x => x.id === id);
    const old = existing.items[idx];
    existing.items[idx] = { ...obj, ...old, source: obj.source };
    updated++;
  } else {
    existing.items.push(obj);
    seen.add(id);
    added++;
  }
}

// Sort: newest CVE id first (CVE-YYYY-NNNN; PAN-SA-YYYY-NNNN)
existing.items.sort((a, b) => {
  // Pull year + sequence from id where we can; otherwise compare strings.
  const m = s => {
    const x = /(?:CVE|PAN-SA)-(\d{4})-(\d+)/i.exec(String(s.id));
    return x ? [parseInt(x[1], 10), parseInt(x[2], 10)] : [0, 0];
  };
  const [ay, an] = m(a), [by, bn] = m(b);
  if (ay !== by) return by - ay;
  return bn - an;
});

existing.updatedAt = new Date().toISOString();
fs.writeFileSync(DST, JSON.stringify(existing, null, 2));

// Bump manifest so the SW invalidates cves.json
const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
m.cves = new Date().toISOString();
fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));

console.log('\nResult:');
console.log('  Entries before:', before);
console.log('  Added:        ', added);
console.log('  Updated:      ', updated);
console.log('  Entries after:', existing.items.length);
