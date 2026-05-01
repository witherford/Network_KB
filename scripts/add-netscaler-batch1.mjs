// NetScaler enrichment batch 1:
//   - System & Status (3 entries)
//   - Configuration Management (9 entries)
// Adds rich example outputs with per-field "What it means" annotations
// to commands that previously had only desc.
//
// Run: node scripts/add-netscaler-batch1.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ENTRIES = [
  // ============== System & Status ==============
  { cmd: 'show interface <slot/port>',
    example: `> show interface 0/1

   Interface 0/1 (Gig Ethernet 10/100/1000 MBits) #2
        flags=0x4084c020 <ENABLED, UP, AUTONEG_ON, HEARTBEAT, 802.1q>
        Link state: UP, MTU: 9000, downtime 17:44:21, autoneg result: success
        Actual: media FIBER, speed 1000, duplex FULL, fctl OFF, throughput 1000
        Hangs: Never
        LLDP Mode: NONE                  Clear Stats: 1m1s
        TX Pkts: 12,453,012  Rx Pkts: 14,780,123
        TX Bytes: 9.8 GB     Rx Bytes: 11.2 GB
        Errors: 0            Drops: 0
        VLAN: 1, Trunking: ON

What it means:
- ENABLED, UP : interface is administratively up and L2 link is good.
- MTU 9000   : jumbo frames enabled.
- speed 1000, duplex FULL, fctl OFF : 1 Gbps full-duplex, flow-control off.
- TX/Rx Pkts/Bytes : lifetime counters since last "clear interface".
- Errors / Drops 0 : healthy. Non-zero values point to physical-layer
  problems (CRC errors, runts) or buffer exhaustion respectively.
- VLAN 1, Trunking ON : interface is a trunk; native VLAN is 1.` },

  { cmd: 'show ns stats -detail',
    example: `> show ns stats -detail

NetScaler Performance Statistics
  CPU usage (%)                            : 12
  Memory usage (%)                         : 28
  System throughput (Mbps)                 : 1840
  HTTP requests/sec                        : 4502
  Total HTTP requests                      : 14,502,341
  Total connections                        : 1,245,902
  Active client connections                : 8,502
  Active server connections                : 7,431
  SSL transactions/sec                     : 2,101
  SSL handshakes (cur/total)               : 320 / 145,021

What it means:
- CPU/Memory usage : aggregate across all packet engines. Sustained
  >70% is the warning line on most platforms.
- Throughput Mbps : current dataplane bandwidth, both directions.
- HTTP req/sec : application-layer request rate. Compare to the
  licensed L7 ceiling on the appliance.
- Active client/server connections : open TCP flows in each direction.
  A big imbalance hints at half-open or stuck-CLOSE_WAIT problems.
- SSL transactions/sec, handshakes : load on SSL hardware. Sustained
  high numbers may indicate a need for session-reuse tuning.` },

  { cmd: 'show ns runningconfig | grep -v "^#"',
    example: `> show ns runningconfig | grep -v "^#"

set ns config -IPAddress 10.10.10.10 -netmask 255.255.255.0
set ns hostname NS-ADC-PROD-01
add ns ip 10.10.10.11 255.255.255.0 -type SNIP
add lb vserver lb-web HTTP 10.20.0.10 80
add service svc-web1 192.168.1.10 HTTP 80
bind lb vserver lb-web svc-web1
enable ns feature LB SSL CS GSLB

What it means:
- "grep -v '^#'" strips out the auto-generated comment lines (which
  document OS version, build number, and section dividers). The
  filtered output is just the imperative config statements.
- Useful for diffing two ADCs or feeding a backup into "batch -f".
- The order of the output matches the order operations would be
  replayed if the file were used to rebuild config.` },

  // ============== Configuration Management ==============
  { cmd: 'clear config full',
    example: `> clear config full
Are you sure you want to clear the configuration completely? [Y/N] Y
Done

What it means:
- Wipes EVERY config statement back to factory state — VIPs, SSL
  certs, custom users, monitors, services, ACLs, NSIP itself: all
  removed.
- After this, the ADC behaves as a freshly-shipped appliance and
  must be re-IPed via the console.
- DANGEROUS — only ever issued during a planned full-rebuild. Always
  back up first with "create system backup".` },

  { cmd: 'clear config basic',
    example: `> clear config basic
Done

> show ns ip
        IP                  Type       Mode    State
        10.10.10.10         NSIP       Active  Enabled    ← preserved
        10.10.10.11         SNIP       Active  Enabled    ← preserved

What it means:
- Removes feature configuration (LB / SSL / CS / GSLB / monitors etc.)
  but PRESERVES network reachability (NSIP, SNIP, default route, VLANs).
- Lets you wipe service-layer config without losing remote access.
- Typical use: handing the appliance to a new tenant/customer.` },

  { cmd: 'batch -f /nsconfig/<filename>',
    example: `> batch -f /nsconfig/migration.conf

Executing batch file /nsconfig/migration.conf...
Done. 142 commands executed, 0 errors.

What it means:
- Reads a text file of CLI commands and replays them in sequence.
- Errors in one line do NOT abort the batch by default — review the
  error count carefully.
- Common workflow: build new config in a text editor or generate
  via script, scp to /nsconfig/, then "batch -f" to apply.
- Compare with "save ns config" which only persists the current
  in-memory state.` },

  { cmd: 'export ns config -scope full -fileName <file>',
    example: `> export ns config -scope full -fileName backup-2026-05-01.conf
Done

> shell ls /var/nsconfig/backup/
backup-2026-05-01.conf

What it means:
- Writes the running config to a flat .conf file under
  /var/nsconfig/backup/.
- "scope full" includes every feature; "scope partial" can be used
  to export only specific feature blocks.
- Output is plain text and editable; can be imported back via
  "import ns config" or replayed via "batch -f" on another ADC.` },

  { cmd: 'import ns config -scope full -fileName <file>',
    example: `> import ns config -scope full -fileName backup-2026-05-01.conf

Are you sure you want to apply imported configuration? [Y/N] Y
Done. 142 commands applied.

What it means:
- Reads a .conf file from /var/nsconfig/backup/ and applies it to
  the running config.
- Conflicting objects (same name) are OVERWRITTEN — make sure the
  source is what you expect.
- Pair with "export ns config" on the source ADC for a clone-style
  migration. Always "save ns config" afterwards to persist.` },

  { cmd: 'shell cat /nsconfig/ns.conf',
    example: `# shell cat /nsconfig/ns.conf
#NS13.1 Build 42.47.nc, Date: Apr 30 2026, 18:12:34
#
# Last modified by 'save config', Wed May 1 09:22:18 2026
#
set ns config -IPAddress 10.10.10.10 -netmask 255.255.255.0
set ns hostname NS-ADC-PROD-01
add ns ip 10.10.10.11 255.255.255.0 -type SNIP
...

What it means:
- ns.conf is the persisted running config. "save ns config" writes
  to this file; the system reads it on boot.
- The header comments record build, last save, and modifying user.
- Run from "shell" prompt — does NOT require leaving the ADC CLI:
    > shell cat /nsconfig/ns.conf
- Compare with "show ns runningConfig" which reads from in-memory
  state (may differ if config has been changed without saving).` },

  { cmd: 'create system backup <filename>',
    example: `> create system backup nightly-2026-05-01 -level full
Done

> show system backup
        Name                       Type     Date                Size
        nightly-2026-05-01.tgz     full     2026-05-01 03:00    18.4 MB

What it means:
- "level full" bundles ns.conf + SSL keys/certs + licence files +
  feature data files into a single .tgz under /var/ns_sys_backup/.
- "level basic" excludes SSL keys (smaller, but useless for DR).
- Restore via "restore system backup <filename>".
- Best practice: schedule via cron to run nightly and ship the .tgz
  off-box (scp to backup server).` },

  { cmd: 'restore system backup <filename>',
    example: `> restore system backup nightly-2026-05-01.tgz
Are you sure you want to restore? Existing config will be replaced. [Y/N] Y
Restoring config and SSL artifacts ...
Done. Reboot required to complete restoration.

> reboot

What it means:
- Replaces the running config + SSL keys + licences with the
  backup's contents.
- A reboot is REQUIRED for the restored kernel-level state (licences,
  feature toggles) to fully take effect.
- DR workflow: ship a fresh ADC, set NSIP via console, scp the .tgz
  into /var/ns_sys_backup/, run restore, reboot.` },

  { cmd: 'show techsupport',
    example: `> show techsupport
Generating tech support bundle. This may take several minutes...
collecting:
  /nsconfig/ns.conf                      [ok]
  /var/log/ns.log                        [ok]
  /var/log/newnslog                      [ok]
  /var/nslog/snmpd.log                   [ok]
  show ns connectiontable -detail full   [ok]
  show ns stats -detail                  [ok]
  ...
Done. Bundle: /var/tmp/support/collector_NS-ADC_31May2026_09_15.tar.gz

What it means:
- Runs a curated set of show commands AND collects log files into a
  single tarball under /var/tmp/support/.
- Citrix TAC asks for this output as the FIRST diagnostic on any
  case — bundle includes ns.log, newnslog binary stats, conntable,
  ARP/route tables, license info.
- Bundle size ranges from ~10 MB (idle box) to ~500 MB (busy box
  with verbose logging). scp the file to the TAC case.` }
];

// ---------------------- Apply ----------------------
let updated = 0, alreadyHadExample = 0, notFound = 0;

for (const e of ENTRIES) {
  let found = null;
  for (const arr of Object.values(NS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (!found) {
    console.warn('  (not found):', e.cmd);
    notFound++;
    continue;
  }
  if (found.example && found.example.trim()) {
    alreadyHadExample++;
    continue;
  }
  found.example = e.example;
  updated++;
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Total entries processed:                ${ENTRIES.length}`);
console.log(`Existing commands updated with example: ${updated}`);
console.log(`Existing commands already had example:  ${alreadyHadExample}`);
console.log(`Not found:                              ${notFound}`);
