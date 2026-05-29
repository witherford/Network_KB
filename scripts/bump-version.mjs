// Bump the app version atomically across data/version.json, js/version.js and
// the service-worker cache key in sw.js.
//
// Usage:
//   node scripts/bump-version.mjs           → bump patch (1.3.30 → 1.3.31)
//   node scripts/bump-version.mjs minor     → 1.3.30 → 1.4.0
//   node scripts/bump-version.mjs major     → 1.3.30 → 2.0.0
//   node scripts/bump-version.mjs 1.4.0     → set explicit version

import { readFileSync, writeFileSync } from 'node:fs';

const arg = process.argv[2] || 'patch';
const verJson = JSON.parse(readFileSync('data/version.json', 'utf8'));
const cur = verJson.version;
const [maj, min, pat] = cur.split('.').map(Number);

let next;
if (/^\d+\.\d+\.\d+$/.test(arg))      next = arg;
else if (arg === 'major')             next = `${maj + 1}.0.0`;
else if (arg === 'minor')             next = `${maj}.${min + 1}.0`;
else                                  next = `${maj}.${min}.${pat + 1}`;

const today = new Date().toISOString().slice(0, 10);

// data/version.json
verJson.version = next;
verJson.build = today;
writeFileSync('data/version.json', JSON.stringify(verJson, null, 2) + '\n');

// js/version.js
let vjs = readFileSync('js/version.js', 'utf8');
vjs = vjs
  .replace(/APP_VERSION\s*=\s*'[^']+'/, `APP_VERSION = '${next}'`)
  .replace(/APP_BUILD\s*=\s*'[^']+'/,   `APP_BUILD   = '${today}'`);
writeFileSync('js/version.js', vjs);

// sw.js — bump the cache key counter parsed from the current value.
let swjs = readFileSync('sw.js', 'utf8');
const m = swjs.match(/CACHE_VERSION\s*=\s*'nkb-v(\d+)-/);
const nextCache = m ? Number(m[1]) + 1 : 1;
swjs = swjs.replace(/CACHE_VERSION\s*=\s*'[^']+'/, `CACHE_VERSION = 'nkb-v${nextCache}-${today}'`);
writeFileSync('sw.js', swjs);

console.log(`Bumped: ${cur} → ${next}   sw cache v${nextCache}   build ${today}`);
