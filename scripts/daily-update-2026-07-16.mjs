#!/usr/bin/env node
// Daily KB update — 2026-07-16
// 1. Add 10 new commands verified against official vendor documentation
//    (genuinely absent from the existing ~6,985-command catalogue).
// 2. Enrich 10 thin one-to-four-word descriptions into full explanatory
//    sentences, spread across 10 different platforms so no single
//    platform's gap accumulates.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', 'data', 'commands.json');

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const plats = data.platforms;

let added = 0, enriched = 0;

function findIdx(plat, sec, predicate) {
  const arr = plats[plat]?.sections?.[sec];
  if (!Array.isArray(arr)) return -1;
  return arr.findIndex(predicate);
}

function addCommand(plat, sec, entry) {
  const arr = plats[plat]?.sections?.[sec];
  if (!Array.isArray(arr)) { console.warn('NO SECTION:', plat, '/', sec); return; }
  if (arr.some(c => c.cmd === entry.cmd)) { console.warn('ALREADY EXISTS:', plat, '/', entry.cmd); return; }
  arr.push({ type: 'show', flagged: false, ...entry });
  added++;
}

function enrichDesc(plat, sec, cmd, newDesc) {
  const idx = findIdx(plat, sec, c => c.cmd === cmd);
  if (idx < 0) { console.warn('NOT FOUND:', plat, '/', sec, '/', cmd); return; }
  plats[plat].sections[sec][idx].desc = newDesc;
  enriched++;
}

// ---------------------------------------------------------------------------
// 1. New commands (sourced from official Palo Alto, VMware, Aruba, AWS,
//    Cisco, and NX-OS documentation)
// ---------------------------------------------------------------------------

addCommand('paloalto', 'Network Objects', {
  cmd: 'request system fqdn refresh',
  type: 'action',
  desc: 'Forces PAN-OS to immediately re-resolve every FQDN address object against DNS and rebuild the internal IP-to-FQDN cache, instead of waiting for the next scheduled refresh interval or commit-triggered FqdnRefresh job.',
  example: '> request system fqdn refresh\nFQDN refresh job enqueued. Job ID 512.\n\n> request system fqdn show\nFQDN                     Address-Object      Resolved IPs\nweb.example.com          Web-Server           203.0.113.10, 203.0.113.11\nupdates.example.com      Update-Server        203.0.113.20',
});

addCommand('linux', 'Diagnostics', {
  cmd: 'nvme list',
  desc: 'Lists every NVMe block device attached to the host with its model, firmware revision, namespace size, and used bytes — the nvme-cli equivalent of lsblk for NVMe SSDs, useful before running smart-log or firmware-update operations.',
  example: '$ nvme list\nNode             SN                   Model                    Namespace Usage                      Format         FW Rev\n---------------- -------------------- ------------------------ --------- -------------------------- ---------------- --------\n/dev/nvme0n1     S6EPNE0R123456       Samsung SSD 980 PRO 1TB  1         512.11  GB /   1.00  TB    512   B +  0 B   5B2QGXA7',
});

addCommand('esxi', 'Storage', {
  cmd: 'esxcli vsan cluster get',
  desc: "Reports this host's vSAN cluster membership — sub-cluster UUID, local node role (Master/Backup/Agent), health state, and member count — the first command to run when a host appears absent or partitioned from the vSAN cluster.",
  example: '$ esxcli vsan cluster get\nCluster Information\n   Enabled: true\n   Current Local Time: 2026-07-16T09:12:03Z\n   Local Node UUID: 5f2a1b3c-0000-1111-2222-b8ca3a6b1a40\n   Local Node Type: NORMAL\n   Local Node State: MASTER\n   Local Node Health State: HEALTHY\n   Sub-Cluster Master UUID: 5f2a1b3c-0000-1111-2222-b8ca3a6b1a40\n   Sub-Cluster Member Count: 4',
});

addCommand('aruba_ap', 'System & Status', {
  cmd: 'show ap system-profile',
  desc: "Displays the system profile bound to this AP — NTP servers, timezone, LED/console behavior, and management-user settings — the configuration counterpart to 'show version' for confirming which baseline settings an AP inherited.",
  example: '(instant-AP) # show ap system-profile\nName                          : default\nNTP Server                    : 10.0.0.1\nTimezone                      : UTC 0:0\nLED Display                   : Enabled\nConsole access                : Enabled\nPreprovisioning                : Disabled\nRoot password Enable/Disable  : Disabled',
});

addCommand('aws', 'S3', {
  cmd: 'aws s3api head-object --bucket <bucket> --key <key>',
  desc: "Fetches an S3 object's metadata (content length, ETag, storage class, server-side encryption, last-modified) without downloading its body — the API-level equivalent of a HEAD request, useful in scripts that need to check existence or size before a GET.",
  example: '$ aws s3api head-object --bucket my-app-backups --key db/2026-07-15.sql.gz\n{\n    "LastModified": "2026-07-15T06:00:12+00:00",\n    "ContentLength": 483920112,\n    "ETag": "\\"9f86d081884c7d659a2feaa0c55ad015\\"",\n    "ContentType": "application/gzip",\n    "ServerSideEncryption": "aws:kms",\n    "StorageClass": "STANDARD_IA"\n}',
});

addCommand('wlc', 'Troubleshooting', {
  cmd: 'show ap multicast mom',
  type: 'troubleshooting',
  desc: "Confirms whether each AP is receiving the controller's CAPWAP multicast-to-multicast (MoM) group traffic used to distribute multicast frames to APs — if MoM isn't arriving, multicast-enabled clients on that AP won't get IPTV/mDNS-style streams even though unicast traffic works fine.",
  example: 'WLC-01# show ap multicast mom\nAP Name         VLAN   MoM Group      MoM Status     Last Packet\nAP-LON-01       100    239.0.10.1     Receiving      2s ago\nAP-LON-02       100    239.0.10.1     Receiving      4s ago\nAP-LON-03       100    239.0.10.1     Not Receiving  --\n\n# Scope to one AP: show ap name AP-LON-03 multicast mom',
});

addCommand('ciscoiosxe_sw', 'Hardware', {
  cmd: 'show controllers ethernet-controller <interface>',
  desc: "Dumps PHY/MAC-level hardware counters for a single interface — runts, giants, CRC errors, collisions, and symbol errors sourced directly from the ASIC — a level below 'show interface' for chasing a physical-layer problem a simple error counter doesn't explain.",
  example: 'sw# show controllers ethernet-controller GigabitEthernet1/0/1\n\nTransmit GigabitEthernet1/0/1              Receive\n  0 Runts                                    0 Giants\n  0 Broadcasts                               0 CRC\n  0 Collisions                               0 Symbol\n\n  Rx Statistics:\n     bytes                       48213402\n     unicast frames                 302188\n     multicast frames                 1204\n     broadcast frames                  318',
});

addCommand('nexus', 'Diagnostics', {
  cmd: 'show fex <fex-id> detail',
  desc: 'Drills into a single Nexus 2000 Fabric Extender — model, serial number, fabric-port pinning, power state, and per-uplink status — the per-FEX detail view behind the summary table printed by plain \'show fex\'.',
  example: 'switch# show fex 100 detail\nFEX: 100 Description: FEX0100   state: Online\n  FEX version: 9.3(5) [Switch version: 9.3(5)]\n  Extender Model: N2K-C2232PP-10GE,  Extender Serial: JAF1732AGTB\n  Part No: 73-14335-05\n  pinning-mode: static    Max-links: 1\n  Fabric port for control traffic: Eth1/1\n  Fabric interface state:\n    Po100 - Interface Eth1/1     State: Active',
});

addCommand('ciscoasa', 'Diagnostics', {
  cmd: 'show asp table classify domain permit',
  type: 'troubleshooting',
  desc: "Dumps the accelerated security path's compiled classify rules for the permit domain — the actual hardware-accelerated ACL lookup entries the ASA uses per-packet — letting you confirm a rule you expect to match a flow is really installed and not shadowed by a broader one above it.",
  example: 'ciscoasa# show asp table classify domain permit\nInput Table\nin  id=0x14a8f3d0, priority=13, domain=permit, deny=false\n        hits=192843, user_data=0x14a75e40, cs_id=0x0, l3_type=0x8\n        src ip/id=10.0.0.0, mask=255.255.255.0, port=0, tag=any\n        dst ip/id=0.0.0.0, mask=0.0.0.0, port=0, tag=any, dscp=0x0\n        input_ifc=inside, output_ifc=any',
});

addCommand('ciscoiosxe_router', 'IPsec / Crypto', {
  cmd: 'show crypto isakmp sa',
  desc: "Lists IKEv1 (ISAKMP) Phase 1 security associations — peer address, connection state (QM_IDLE = fully negotiated and idle), and role — the legacy counterpart to 'show crypto ikev2 sa' for tunnels still running the older key-exchange protocol.",
  example: 'router# show crypto isakmp sa\n\nIPv4 Crypto ISAKMP SA\ndst             src             state          conn-id status\n198.51.100.10   203.0.113.5     QM_IDLE           1001    ACTIVE\n\nIPv6 Crypto ISAKMP SA\n',
});

// ---------------------------------------------------------------------------
// 2. Enrich 10 thin descriptions into full explanatory sentences
// ---------------------------------------------------------------------------

enrichDesc('wlc', 'System', 'show platform',
  "Displays the WLC's chassis type and each supervisor slot's hardware model and redundancy role (Active / Standby Hot) — the fastest way to confirm hardware identity and HA state right after gaining console access.");

enrichDesc('esxi', 'System', 'esxcli hardware cpu list',
  'Lists every logical CPU with its physical package, core, and thread IDs plus family/model numbers and bus speed — use the Package ID and Core ID columns to work out physical socket/core counts versus Hyper-Threading siblings.');

enrichDesc('aruba_cx', 'Interfaces', 'show interface brief',
  'One line per port summarizing admin/link status, port mode (access/trunk/routed), native VLAN, negotiated speed, and a down-reason column — the fastest way to spot disabled or down ports across the whole switch.');

enrichDesc('aruba_ap', 'Clients', 'show user-table',
  'Lists every client currently associated to this AP with its assigned role, IP/MAC address, session age, home AP, and the flag legend (regular/AP-user/wireless/VPN) — the AP-side equivalent of a WLC client table, useful for confirming role-based policy assignment.');

enrichDesc('ciscoiosxe_sw', 'Boot', 'show platform integrity status',
  "Summarizes the platform's Trusted Platform Module chain of trust in one line per stage — Secure Boot, image signature verification, and TPM presence/health — ending in an Overall verdict of TRUSTED or COMPROMISED for supply-chain integrity checks.");

enrichDesc('nexus', 'System & Status', 'show feature',
  "Lists every licensable NX-OS feature (bgp, ospf, hsrp, vpc, etc.) and whether it's enabled or disabled per instance/VDC — a feature must show 'enabled' here before its configuration commands become available in config mode.");

enrichDesc('paloalto', 'Network Objects', 'show address all',
  "Lists every configured address object with its type (ip-netmask, ip-range, or fqdn) and resolved value — the object-level counterpart to 'show address-group all', useful for auditing which hosts/subnets are defined before they're referenced in a security rule.");

enrichDesc('netscalersdx', 'System', 'show system health',
  "Rolls up CPU, memory, disk, fan, PSU, and temperature readings against their alert thresholds into a single Overall Health verdict — the fastest SDX triage check to run before drilling into individual 'show system' counters.");

enrichDesc('netscaler', 'Networking', 'show ns pbr6',
  "Lists configured IPv6 policy-based routes with their match action, next-hop, and hit counter — the IPv6 counterpart to 'show ns pbr', used to force IPv6 traffic matching a rule down a specific next-hop instead of the routing table.");

enrichDesc('ciscoasa', 'Diagnostics', 'show logging',
  'Shows which logging destinations are enabled and at what severity — console, monitor, buffer, and remote syslog server — followed immediately by the contents of the internal log buffer itself.');

// ---------------------------------------------------------------------------

console.log(`Added ${added} new commands, enriched ${enriched} thin descriptions.`);
writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
