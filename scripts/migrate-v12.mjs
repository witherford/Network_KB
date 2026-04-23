#!/usr/bin/env node
// One-shot migration: extract RAW literal from network_kb_v12.html and emit data/commands.json
// Usage: node scripts/migrate-v12.mjs

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'network_kb_v12.html');
const outPath = path.join(repoRoot, 'data', 'commands.json');

const html = fs.readFileSync(htmlPath, 'utf8');

const startMatch = html.match(/var\s+RAW\s*=\s*\{/);
if (!startMatch) throw new Error('RAW literal not found in v12 HTML');
const startIdx = startMatch.index + startMatch[0].length - 1;

let depth = 0;
let inString = false;
let strCh = '';
let escape = false;
let endIdx = -1;
for (let i = startIdx; i < html.length; i++) {
  const ch = html[i];
  if (escape) { escape = false; continue; }
  if (inString) {
    if (ch === '\\') { escape = true; continue; }
    if (ch === strCh) { inString = false; }
    continue;
  }
  if (ch === '"' || ch === "'") { inString = true; strCh = ch; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
}
if (endIdx < 0) throw new Error('Failed to locate end of RAW literal');

const rawSource = html.slice(startIdx, endIdx + 1);
const sandbox = {};
vm.createContext(sandbox);
const RAW = vm.runInContext('(' + rawSource + ')', sandbox, { timeout: 5000 });

const out = {
  version: 2,
  updatedAt: new Date().toISOString(),
  platforms: {}
};

let total = 0;
for (const [pKey, p] of Object.entries(RAW)) {
  const platform = {
    label: p.label || pKey,
    badge: p.badge || 'badge-ns',
    short: p.short || p.label || pKey,
    sections: {}
  };
  for (const [secName, cmds] of Object.entries(p.sections || {})) {
    platform.sections[secName] = cmds.map(entry => ({
      cmd: entry[0],
      desc: entry[1] || '',
      type: entry[2] || 'show',
      flagged: false
    }));
    total += cmds.length;
  }
  out.platforms[pKey] = platform;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`Migrated ${Object.keys(out.platforms).length} platforms, ${total} commands -> ${outPath}`);
