// Restructure routing sections across Cisco IOS / IOS-XE / Nexus.
//
// Steps per platform (ciscoios, ciscoiosxe_router, ciscoiosxe_sw, nexus):
//   1. Classify each command in the "Routing" section. If it is
//      OSPF / EIGRP / BGP / IS-IS specific, MOVE it to the matching
//      subsection (creating that section if it doesn't exist yet).
//      Generic L3/RIB/CEF/static-route commands stay in Routing.
//   2. RENAME OSPF / EIGRP / BGP / IS-IS sections to
//      "Routing › OSPF" / "Routing › EIGRP" / "Routing › BGP" /
//      "Routing › IS-IS" so the UI renders them visually grouped
//      under Routing.
//   3. REORDER the sections object so the renamed subsections appear
//      immediately after Routing.
//
// Run: node scripts/restructure-routing.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const PLATFORMS = ['ciscoios', 'ciscoiosxe_router', 'ciscoiosxe_sw', 'nexus'];

// Classifier — order matters: more-specific (IS-IS) before more-generic.
function classify(cmd) {
  const c = cmd || '';
  if (/\b(isis|is-is)\b/i.test(c)) return 'IS-IS';
  if (/\bospf(v[23])?\b/i.test(c)) return 'OSPF';
  if (/\bbgp\b/i.test(c))         return 'BGP';
  if (/\beigrp\b/i.test(c))       return 'EIGRP';
  return null;
}

const RENAME = {
  OSPF:    'Routing › OSPF',
  EIGRP:   'Routing › EIGRP',
  BGP:     'Routing › BGP',
  'IS-IS': 'Routing › IS-IS'
};

const stats = {};

for (const pk of PLATFORMS) {
  const plat = data.platforms[pk];
  if (!plat) { stats[pk] = { error: 'platform missing' }; continue; }
  const sect = plat.sections;
  if (!sect) { stats[pk] = { error: 'no sections' }; continue; }

  stats[pk] = { moved: { OSPF: 0, EIGRP: 0, BGP: 0, 'IS-IS': 0 }, renamed: 0, reordered: false };

  // ---------- Step 1: move from Routing → subsections ----------
  const routing = sect['Routing'];
  if (Array.isArray(routing)) {
    const stayingInRouting = [];
    for (const c of routing) {
      const proto = classify(c.cmd);
      if (proto) {
        sect[proto] ||= [];
        // Skip if already present (idempotency)
        if (!sect[proto].some(x => x.cmd === c.cmd)) {
          sect[proto].push(c);
          stats[pk].moved[proto]++;
        }
      } else {
        stayingInRouting.push(c);
      }
    }
    sect['Routing'] = stayingInRouting;
  }

  // ---------- Step 2: rename OSPF/EIGRP/BGP/IS-IS → Routing › X ----------
  for (const [oldName, newName] of Object.entries(RENAME)) {
    if (sect[oldName]) {
      // Merge into existing target (in case of re-run / unusual data)
      sect[newName] = (sect[newName] || []).concat(sect[oldName]);
      delete sect[oldName];
      stats[pk].renamed++;
    }
  }

  // ---------- Step 3: reorder so subsections appear right after Routing ----------
  const order = Object.keys(sect);
  const routingIdx = order.indexOf('Routing');
  if (routingIdx >= 0) {
    const subOrder = ['Routing › OSPF', 'Routing › EIGRP', 'Routing › BGP', 'Routing › IS-IS']
                       .filter(s => sect[s] !== undefined);
    // Remove subsection names from wherever they are in the order
    const filtered = order.filter(n => !subOrder.includes(n));
    const newRoutingIdx = filtered.indexOf('Routing');
    const reorderedKeys = [
      ...filtered.slice(0, newRoutingIdx + 1),
      ...subOrder,
      ...filtered.slice(newRoutingIdx + 1)
    ];

    // Rebuild the sections object in the new key order
    const rebuilt = {};
    for (const k of reorderedKeys) rebuilt[k] = sect[k];
    plat.sections = rebuilt;
    stats[pk].reordered = true;
  }
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(JSON.stringify(stats, null, 2));

// Final per-platform section dump for verification
console.log('\n=== Final section ordering per platform ===');
for (const pk of PLATFORMS) {
  console.log('\n' + pk + ':');
  for (const [sec, arr] of Object.entries(data.platforms[pk]?.sections || {})) {
    console.log('  ' + sec.padEnd(40) + arr.length);
  }
}
