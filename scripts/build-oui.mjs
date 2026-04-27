// Fetch the Wireshark `manuf` file (public-domain IEEE OUI registry mirror)
// and convert it to a flat JSON map: { "<hex prefix>": "<vendor>" }.
// Handles MA-L (/24), MA-M (/28), and MA-S (/36) allocations.
//
// Output: data/oui.json
// Usage:  node scripts/build-oui.mjs

import fs from 'node:fs';
import path from 'node:path';

const URL = 'https://www.wireshark.org/download/automated/data/manuf';
const OUT = path.resolve('data/oui.json');

console.log('Fetching', URL);
const res = await fetch(URL, { redirect: 'follow' });
if (!res.ok) throw new Error('manuf fetch failed: ' + res.status);
const text = await res.text();
console.log('manuf size:', (text.length / 1024).toFixed(1), 'KB');

// Format (tab-separated):
//   AA:BB:CC               ShortName     Long Vendor Name
//   AA:BB:CC:D0:00:00/28   ShortName     Long Vendor Name
//   AA:BB:CC:DD:E0:00:00/36 ShortName    Long Vendor Name
// Comments start with '#'. Lines with too few columns are skipped.
const out = {};
let entries = 0;
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trimEnd();
  if (!line || line.startsWith('#')) continue;
  // Manuf is tab-separated, but some entries use multiple tabs/spaces.
  const cols = line.split(/\t+/);
  if (cols.length < 2) continue;
  const prefix = cols[0].trim();
  const longName = (cols[2] || cols[1] || '').trim();
  if (!prefix || !longName) continue;
  // Normalise: drop colons, lowercase. Keep the netmask suffix in the value
  // so /28 and /36 entries are distinguishable when matched.
  let key, mask;
  const slashIdx = prefix.indexOf('/');
  if (slashIdx >= 0) {
    mask = parseInt(prefix.slice(slashIdx + 1), 10);
    key = prefix.slice(0, slashIdx).replace(/[:\-.]/g, '').toLowerCase();
  } else {
    mask = 24; // MA-L default
    key = prefix.replace(/[:\-.]/g, '').toLowerCase();
  }
  if (!/^[0-9a-f]+$/.test(key)) continue;
  // Truncate to mask: hex chars = mask/4
  const expectedLen = mask / 4;
  if (Number.isFinite(expectedLen) && key.length >= expectedLen) {
    key = key.slice(0, expectedLen);
  }
  // For MA-M (/28) and MA-S (/36) entries, store with a netmask hint so the
  // lookup function knows to match a longer prefix first.
  const finalKey = mask === 24 ? key : `${key}/${mask}`;
  out[finalKey] = longName;
  entries++;
}

console.log('Parsed', entries, 'OUI entries');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('Wrote', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB)');
