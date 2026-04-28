// Bulk-import 2026 entries from the CISA Known Exploited Vulnerabilities
// (KEV) catalogue into data/cves.json.
//
// KEV is a public, no-auth JSON feed maintained by CISA listing CVEs that
// are confirmed actively exploited in the wild — i.e. real, validated
// vulnerabilities, not made-up entries.
//
// Source: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
// License: U.S. government work, public domain.
//
// Run:
//   1) curl -sL https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
//        -o /tmp/cisa-kev.json
//   2) node scripts/import-cisa-kev-2026.mjs /tmp/cisa-kev.json
//
// Behaviour:
//  - Filters to entries with dateAdded in 2026 (so we get fresh + relevant
//    items, regardless of CVE-id year).
//  - Severity defaulted to 'high' because KEV listing means active
//    exploitation. Bumped to 'critical' when the description suggests RCE,
//    unauth, command injection, deserialisation, or auth bypass.
//  - Skips entries whose CVE id is already in the file (dedupe by id).
//  - Bumps data/manifest.json so the SW invalidates cached cves.json.

import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || 'C:/Users/withe/AppData/Local/Temp/cisa-kev.json';
const DST = path.resolve('data/cves.json');
const MAN = path.resolve('data/manifest.json');

const kev = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const all = kev.vulnerabilities || [];
const added = all.filter(v => (v.dateAdded || '').startsWith('2026'));
console.log('KEV entries added in 2026:', added.length);

// Severity heuristics — anything that looks unauthenticated / remote code
// execution / deserialisation / auth bypass goes 'critical', the rest stay
// 'high'. KEV listing implies active exploitation, so these are the floor.
function inferSeverity(text) {
  const t = (text || '').toLowerCase();
  const critical = [
    'remote code execution', ' rce ', '(rce)', 'command injection',
    'unauthenticated', 'unauthorized access', 'authentication bypass',
    'auth bypass', 'deserialization', 'deserialisation',
    'arbitrary code execution', 'pre-auth'
  ];
  for (const k of critical) if (t.includes(k)) return 'critical';
  return 'high';
}

// Quick CVSS approximation for 'critical' / 'high' since KEV doesn't
// publish CVSS itself. Real values would require an NVD lookup per CVE.
function estimateCvss(severity) {
  return severity === 'critical' ? 9.5 : 7.8;
}

function buildSummary(v) {
  const desc = (v.shortDescription || '').replace(/\s*\n\s*/g, ' ').trim();
  const exploit = v.knownRansomwareCampaignUse && v.knownRansomwareCampaignUse !== 'Unknown'
    ? ` Known ransomware campaign use: ${v.knownRansomwareCampaignUse}.`
    : '';
  const action = (v.requiredAction || '').replace(/\s*\n\s*/g, ' ').trim();
  return [
    desc,
    exploit ? exploit.trim() : null,
    action ? `[CISA action] ${action}` : null
  ].filter(Boolean).join(' ').slice(0, 800);
}

function parseRefs(notes) {
  if (!notes) return [];
  return String(notes).split(';').map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));
}

const cves = JSON.parse(fs.readFileSync(DST, 'utf8'));
cves.items ||= [];
const beforeCount = cves.items.length;
const seen = new Set(cves.items.map(x => (x.id || '').toUpperCase()));

let added2026 = 0;
const skippedDupes = [];
for (const v of added) {
  const id = String(v.cveID || '').toUpperCase();
  if (!/^CVE-\d{4}-\d+$/.test(id)) continue;
  if (seen.has(id)) { skippedDupes.push(id); continue; }

  const sev = inferSeverity(v.shortDescription + ' ' + v.vulnerabilityName);
  const item = {
    id,
    vendor: v.vendorProject || 'Unknown',
    product: v.product || '',
    severity: sev,
    cvss: estimateCvss(sev),
    summary: buildSummary(v),
    published: v.dateAdded,
    references: parseRefs(v.notes),
    source: 'CISA Known Exploited Vulnerabilities (KEV)'
  };
  if (!item.references.length) delete item.references;
  cves.items.push(item);
  seen.add(id);
  added2026++;
}

// Sort: newest CVE id first.
cves.items.sort((a, b) => {
  const m = s => {
    const x = /(?:CVE|PAN-SA)-(\d{4})-(\d+)/i.exec(String(s.id));
    return x ? [parseInt(x[1], 10), parseInt(x[2], 10)] : [0, 0];
  };
  const [ay, an] = m(a), [by, bn] = m(b);
  if (ay !== by) return by - ay;
  return bn - an;
});

cves.updatedAt = new Date().toISOString();
fs.writeFileSync(DST, JSON.stringify(cves, null, 2));

const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.cves = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log('\nResult:');
console.log('  Imported (new):  ', added2026);
console.log('  Skipped (dupes): ', skippedDupes.length);
console.log('  Entries before:  ', beforeCount);
console.log('  Entries after:   ', cves.items.length);
