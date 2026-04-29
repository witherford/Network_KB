// Fourth batch: C9800 WLAN-operations show stats + Palo Alto run-book
// example outputs. The user's source had heavy AI-generation noise
// (the same `show session id` output repeated 100+ times) — the entries
// below are the de-duped canonical examples for each unique command.
//
// Strategy:
//   - WLC: attach examples to the existing placeholder entries
//     (show wlan stats <id>, show wlan name <name>, etc.) since those
//     are the canonical commands.
//   - Palo Alto: same pattern — attach to existing placeholder entries
//     in their respective sections (System & Status, Sessions & Flows,
//     Logging & Reports, Panorama, Monitoring & Diagnostics).
//
// Run: node scripts/add-cisco-examples-4.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Each entry: { platform, cmd (existing placeholder), example, [section if new], [type if new], [desc if missing] }
// When platform has the cmd already, we just attach the example. When the
// cmd doesn't exist we create it under the listed section.

const ENTRIES = [
  // ====================== WLC — WLAN ops & stats ======================
  {
    platform: 'wlc', cmd: 'show wlan name <name>',
    example: `WLAN ID            : 1
SSID               : Corp
Status             : Enabled
Security           : WPA2/WPA3
Policy Profile     : Corp-Policy`
  },
  {
    platform: 'wlc', cmd: 'show wlan security <id>',
    example: `Security Policy
---------------
Authentication    : WPA2/WPA3
Key Management    : 802.1X
PMF               : Optional
AAA Policy        : Corp-RADIUS`
  },
  {
    platform: 'wlc', cmd: 'show wlan timers <id>',
    example: `Session Timeout        : 86400 seconds
Idle Timeout           : 300 seconds
Exclusion Timeout      : 60 seconds`
  },
  {
    platform: 'wlc', cmd: 'show wlan policy <id>',
    example: `Policy Profile Name : Corp-Policy
VLAN                : 100
QoS Policy          : Platinum
Central Switching   : Enabled`
  },
  {
    platform: 'wlc', cmd: 'show wlan flex <id>',
    example: `FlexConnect Local Switching : Disabled
FlexConnect Local Auth      : Disabled`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats <id>',
    example: `Total Clients         : 412
Total Auth Success    : 398
Total Auth Failures   : 14
Total Roams           : 126`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats client <id>',
    example: `Clients Associated    : 412
Clients Roamed        : 126
Clients Disassociated : 9`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats traffic <id>',
    example: `Tx Packets : 12,345,678
Rx Packets : 11,982,441
Tx Bytes   : 9.8 GB
Rx Bytes   : 9.1 GB`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats security <id>',
    example: `Auth Success    : 398
Auth Failures   : 14
Policy Denies   : 3`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats auth <id>',
    example: `802.1X Success  : 398
802.1X Failures : 14`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats eap <id>',
    example: `EAP Success  : 398
EAP Failures : 6
EAP Timeouts : 2`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats pmkid <id>',
    example: `PMKID Cache Hits   : 221
PMKID Cache Misses : 17`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats keymgmt <id>',
    example: `Key Install Success  : 398
Key Install Failures : 2`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats dot11 24ghz <id>',
    example: `Clients              : 58
Tx Retries           : 4.2%
Channel Utilization  : 31%`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats dot11 5ghz <id>',
    example: `Clients              : 312
Tx Retries           : 2.1%
Channel Utilization  : 44%`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats dot11 6ghz <id>',
    example: `Clients              : 42
Tx Retries           : 1.3%
Channel Utilization  : 18%`
  },
  {
    platform: 'wlc', cmd: 'show wlan mobility <id>',
    example: `Mobility Anchor     : Local
Fast Secure Roaming : Enabled (802.11r)`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats roam <id>',
    example: `Intra-Controller Roams : 94
Inter-Controller Roams : 32
Roam Failures          : 3`
  },
  {
    platform: 'wlc', cmd: 'show wlan stats assoc <id>',
    example: `Associations    : 512
Reassociations  : 126
Disassociations : 9`
  },
  {
    platform: 'wlc', cmd: 'show wlan wips <id>',
    example: `WIPS Mode       : Monitor
Rogue Detection : Enabled
Containment     : Disabled`
  },
  {
    platform: 'wlc', cmd: 'show wlan avc <id>',
    example: `AVC Status        : Enabled
NBAR Protocol Pack: Enabled
Top Application   : Microsoft Teams`
  },
  // System-level WLC environment / chassis (existing under wlc/System)
  {
    platform: 'wlc', cmd: 'show environment all',
    example: `Fan 1 Speed         : High
PSU 1 State         : On
Component Temperature: CPU - 45°C, GPU - 60°C`
  },

  // ====================== Palo Alto PAN-OS ======================

  // System & Status
  {
    platform: 'paloalto', cmd: 'show system info',
    example: `Model            : 6400-8P1S
Serial Number    : ABCDEF1234567890
Software Version : 1.2.3.4-patch5
Uptime           : 1d 0h 1m 2s (1 day, 0 hours, 1 minute, 2 seconds)`
  },
  {
    platform: 'paloalto', cmd: 'show system resources',
    example: `CPU Usage     : 98%
Memory Usage  : 95% (5 GB out of 5.1 GB available)
Process Load  : 4%`
  },
  {
    platform: 'paloalto', cmd: 'show system disk-space',
    example: `Partition : 0
Used      : 37GB (37,648 MB) out of 42GB total
Free      : 5GB (5,124 MB)

Partition : 1
Used      : 19GB (19,056 MB) out of 22GB total
Free      : 3GB (3,072 MB)

Partition : 2
Used      : 14GB (14,112 MB) out of 18GB total
Free      : 4GB (4,096 MB)`
  },
  {
    platform: 'paloalto', cmd: 'show chassis-ready',
    example: `All cards are operationally ready.`
  },
  {
    platform: 'paloalto', cmd: 'show environment all',
    example: `Fan 1 Speed         : High
PSU 1 State         : On
Component Temperature: CPU - 45°C, GPU - 60°C`
  },
  {
    platform: 'paloalto', cmd: 'show jobs all',
    example: `Job ID  Type     Status   Time Elapsed  Duration  Message
1       Commit   FIN      2m 3s         0.8 sec   System reloaded with new software, but no changes yet.
2       Push     FIN      45s           45 sec    OK
3       Content  FIN      12s           12 sec    Content upgrade installed.`
  },
  {
    platform: 'paloalto', cmd: 'show jobs id <id>',
    example: `Job ID    : 1
Type      : Commit
Status    : FIN
Elapsed   : 2m 3s
Duration  : 0.8 sec
Message   : System reloaded with new software, but no changes yet.

Commit Warning: System has been rebooted and reloaded with new software.`
  },
  {
    platform: 'paloalto', cmd: 'show jobs id <n>',
    example: `Job ID    : 1
Type      : Commit
Status    : FIN
Elapsed   : 2m 3s
Duration  : 0.8 sec
Message   : System reloaded with new software, but no changes yet.

Commit Warning: System has been rebooted and reloaded with new software.`
  },

  // Sessions & Flows
  {
    platform: 'paloalto', cmd: 'show session id <n>',
    example: `Session ID    : 234
Source IP     : 192.168.1.1
Destination IP: 10.0.0.1
Protocol      : TCP
Application   : HTTP
Flow Count    : 50
State         : Established
Policy        : Allow (Custom)`
  },
  {
    platform: 'paloalto', cmd: 'show session meter',
    example: `Meter ID : 432
Counter:
 - Total Packets : 6789
 - Bytes In      : 12345
 - Bytes Out     : 54321`
  },

  // Monitoring & Diagnostics
  {
    platform: 'paloalto', cmd: 'show session id <session-id>',
    example: `Session ID    : 234
Source IP     : 192.168.1.1
Destination IP: 10.0.0.1
Protocol      : TCP
Application   : HTTP
Flow Count    : 50
State         : Established
Policy        : Allow (Custom)`
  },
  {
    platform: 'paloalto', cmd: 'show log threat',
    example: `[2026-04-29 14:05:06 UTC] 192.168.1.1 > 192.168.2.1 (34 bytes)
   src=192.168.1.1, dst=192.168.2.1
   protocol=tcp
[2026-04-29 14:05:08 UTC] 192.168.2.1 > 192.168.1.1 (34 bytes)
   src=192.168.2.1, dst=192.168.1.1
   protocol=tcp`
  },
  {
    platform: 'paloalto', cmd: 'show counter global',
    example: `Counter Group / Name             Value
flow_action_close                17234
flow_dos_red_drop                421
flow_fwd_l3_noroute              17
flow_policy_deny                 89
session_aged_out                 7234`
  },

  // Logging & Reports
  {
    platform: 'paloalto', cmd: 'show log traffic last-n 50',
    example: `Date/Time              | Source IP   | Dest IP     | Proto | Application | Flow Count | State        | Policy
2026-04-29 14:05:06    | 192.168.1.1 | 10.0.0.1    | TCP   | HTTP        | 1          | Established  | Allow (Default)
2026-04-29 14:05:09    | 192.168.1.4 | 10.0.0.1    | TCP   | HTTPS       | 1          | Established  | Allow (Default)`
  },
  {
    platform: 'paloalto', cmd: 'show log threat last-n 50',
    example: `Date/Time              | Source IP   | Dest IP     | Severity | Action  | Threat
2026-04-29 14:01:11    | 203.0.113.5 | 198.51.100.10 | high   | reset-both | spyware-c2
2026-04-29 14:02:32    | 203.0.113.6 | 198.51.100.10 | medium | block      | brute-force-ssh`
  },
  {
    platform: 'paloalto', cmd: 'show log system last-n 50',
    example: `Date/Time              | Severity | Object             | Description
2026-04-29 14:05:06    | info     | user-activity      | User 'admin1' logged in successfully.
2026-04-29 14:08:22    | warning  | system             | Configuration committed by admin1.`
  },
  {
    platform: 'paloalto', cmd: 'show log config last-n 50',
    example: `Date/Time              | Admin   | Action  | Path
2026-04-29 14:08:21    | admin1  | set     | rulebase/security/rules/Allow-Web
2026-04-29 14:08:24    | admin1  | delete  | rulebase/security/rules/Old-FTP`
  },
  {
    platform: 'paloalto', cmd: 'show counter global filter delta yes',
    example: `Counter Group / Name             Delta   Value
flow_action_close                +42     17276
flow_policy_deny                 +3      92
session_aged_out                 +18     7252`
  },
  {
    platform: 'paloalto', cmd: 'show counter global filter packet-filter yes',
    example: `Counter Group / Name             Value
flow_action_close                17234   (matched packet-filter)
flow_dos_red_drop                421     (matched packet-filter)`
  },

  // Panorama
  {
    platform: 'paloalto', cmd: 'show config pushed-template',
    example: `Template Name : Corp-Template
Description   : Default Security Policy
Template ID   : 123456
Version       : latest
Status        : Active`
  },
  {
    platform: 'paloalto', cmd: 'show config pushed-shared-policy',
    example: `Shared Policy ID : 987654
Description      : This is a shared policy template.
Version          : latest
Status           : Active

Current Pushed Configuration:
- Shared Rule Group : Shared-Rules
- Rule Count        : 100
- Flow Count        : 2345`
  }
];

// New commands not yet in the platform — created during this run.
const NEW_ENTRIES = [
  {
    platform: 'paloalto', section: 'Sessions & Flows', type: 'show',
    cmd: 'show session flow tunnel-id <n>',
    desc: 'Detail for a specific dataplane flow within a tunnel — includes per-flow counters and TTL.',
    example: `Flow ID         : 54321
Session ID      : 23456
Source IP       : 192.168.1.1
Destination IP  : 10.0.0.1
Protocol        : UDP
Application     : DNS
Bytes In        : 7890
Bytes Out       : 2345
TTL             : 80`
  },
  {
    platform: 'paloalto', section: 'Panorama', type: 'show',
    cmd: 'show config pushed-policy',
    desc: 'View the last security policy pushed from Panorama to a managed firewall (run on the firewall side).',
    example: `Policy ID   : 789012
Description : This is a default security policy.
Version     : latest
Status      : Active

Current Pushed Configuration:
- Policy Group : [Default]
- Rule Count   : 50
- Flow Count   : 4321`
  },
  {
    platform: 'paloalto', section: 'System & Status', type: 'config',
    cmd: 'request jobs id <n>',
    desc: 'Inspect detailed status of a long-running job (commit / push / software-install). Shows progress %, target vsys, last status.',
    example: `Job ID       : 789
Status       : Running
Type         : Policy Push
Progress     : 60%
Target Vsys  : vsys1`
  }
];

// ---------- Apply ----------------------------------------------------
let updated = 0, addedNew = 0;

for (const e of ENTRIES) {
  const plat = data.platforms[e.platform];
  if (!plat) continue;
  let found = null;
  for (const cmds of Object.values(plat.sections || {})) {
    for (const c of cmds) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (found) {
    if (!found.example) { found.example = e.example; updated++; }
  } else {
    console.warn('  (not found, skipped):', e.platform, e.cmd);
  }
}

for (const e of NEW_ENTRIES) {
  const plat = data.platforms[e.platform];
  if (!plat) continue;
  // Already present?
  let exists = false;
  for (const cmds of Object.values(plat.sections || {})) {
    for (const c of cmds) {
      if (c.cmd === e.cmd) { exists = true; break; }
    }
    if (exists) break;
  }
  if (exists) continue;
  plat.sections[e.section] ||= [];
  plat.sections[e.section].push({
    cmd: e.cmd, desc: e.desc, type: e.type || 'show',
    flagged: false, example: e.example
  });
  addedNew++;
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Existing commands updated with example: ${updated}`);
console.log(`New commands added (with example):     ${addedNew}`);
