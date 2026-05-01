// Merge `cisco` (Cisco IOS Switch) into `ciscoios` (Cisco IOS).
//
// Mapping of cisco sections → ciscoios sections:
//   Show & Status          → Show & Status
//   VLAN Configuration     → VLANs
//   Interface Configuration→ Interfaces
//   Routing                → Routing
//   EtherChannel           → Switching & STP
//   Security               → Security
//   QoS                    → QoS
//   DHCP Server            → DHCP / Services
//   NTP                    → NTP / SNMP / Logging
//   Config Management      → Config Management
//   Diagnostics            → Diagnostics
//
// Per-command logic:
//   - If a cmd with the same exact string already exists in the target
//     section: keep whichever has more detail. "More detail" = has an
//     example AND/OR has a longer desc.
//   - Otherwise: append to the target section.
//
// After merge, the `cisco` platform is removed entirely from data.
//
// Run: node scripts/merge-cisco-platforms.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const SECTION_MAP = {
  'Show & Status'         : 'Show & Status',
  'VLAN Configuration'    : 'VLANs',
  'Interface Configuration': 'Interfaces',
  'Routing'               : 'Routing',
  'EtherChannel'          : 'Switching & STP',
  'Security'              : 'Security',
  'QoS'                   : 'QoS',
  'DHCP Server'           : 'DHCP / Services',
  'NTP'                   : 'NTP / SNMP / Logging',
  'Config Management'     : 'Config Management',
  'Diagnostics'           : 'Diagnostics'
};

function detailScore(c) {
  let s = 0;
  if (c.example && c.example.trim()) s += 100;
  if (c.desc && c.desc.trim()) s += Math.min(c.desc.trim().length, 200);
  return s;
}

const cisco = data.platforms.cisco;
const ciscoios = data.platforms.ciscoios;
if (!cisco) { console.log('cisco platform not present, nothing to merge'); process.exit(0); }
if (!ciscoios) { console.error('ciscoios platform missing — abort'); process.exit(1); }

let moved = 0, deduped = 0, kept_existing = 0, replaced_existing = 0;
const unmappedSections = [];

for (const [srcSec, arr] of Object.entries(cisco.sections || {})) {
  const tgtSec = SECTION_MAP[srcSec];
  if (!tgtSec) {
    unmappedSections.push(srcSec);
    continue;
  }
  ciscoios.sections[tgtSec] ||= [];
  const tgtArr = ciscoios.sections[tgtSec];

  for (const srcCmd of arr) {
    const idx = tgtArr.findIndex(t => t.cmd === srcCmd.cmd);
    if (idx === -1) {
      tgtArr.push(srcCmd);
      moved++;
    } else {
      const existing = tgtArr[idx];
      const sNew = detailScore(srcCmd);
      const sOld = detailScore(existing);
      if (sNew > sOld) {
        tgtArr[idx] = srcCmd;
        replaced_existing++;
        deduped++;
      } else {
        kept_existing++;
        deduped++;
      }
    }
  }
}

if (unmappedSections.length) {
  console.warn('UNMAPPED cisco sections (no merge target — left in place):');
  for (const s of unmappedSections) console.warn('  -', s);
}

// Remove the cisco platform now that everything is merged.
delete data.platforms.cisco;

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Moved (no conflict):           ${moved}`);
console.log(`Deduped (cisco cmd already in ciscoios): ${deduped}`);
console.log(`  - replaced existing (cisco had more detail):  ${replaced_existing}`);
console.log(`  - kept existing  (ciscoios had more detail):  ${kept_existing}`);
console.log(`Cisco platform removed.`);
