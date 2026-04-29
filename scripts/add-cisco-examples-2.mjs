// Second batch of Cisco command examples — supplied by the user with
// representative output. Each entry is (cmd, desc, example, target
// platforms, section, type). The script:
//   - Looks for an existing matching cmd in each target platform; if found,
//     attaches the example output (and updates desc if the existing one is
//     blank).
//   - If the command isn't in any target platform yet, adds a new entry to
//     the chosen section with the supplied desc + example.
//
// Run: node scripts/add-cisco-examples-2.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const ENTRIES = [
  // ============== Catalyst 9800 WLC commands ==============
  {
    cmd: 'show ap uptime',
    desc: 'Per-AP uptime since last AP join.',
    example: `AP Name    Uptime
AP-LON-01 63 days`,
    platforms: ['wlc'], section: 'AP Management', type: 'show'
  },
  {
    cmd: 'show wireless stats ap join summary',
    desc: 'Aggregate AP-join statistics: total, successful, failed, DTLS timeouts, certificate failures.',
    example: `Total Joins     : 154
Successful      : 148
Failed          : 6
DTLS timeout    : 3
Cert failure    : 2`,
    platforms: ['wlc'], section: 'AP Management', type: 'show'
  },
  {
    cmd: 'show wireless tag site summary',
    desc: 'Site-tag inventory and per-site AP counts.',
    example: `Site Tag       AP Count
LONDON-SITE    22`,
    platforms: ['wlc'], section: 'Tags & Profiles', type: 'show'
  },
  {
    cmd: 'show wireless tag policy summary',
    desc: 'Policy-tag inventory and bound WLAN counts.',
    example: `Policy Tag     WLANs
CORP-POLICY    3`,
    platforms: ['wlc'], section: 'Tags & Profiles', type: 'show'
  },
  {
    cmd: 'show wireless profile policy summary',
    desc: 'Policy profiles with VLAN and QoS bindings.',
    example: `Profile       VLAN  QoS
Corp-Policy   100   Platinum`,
    platforms: ['wlc'], section: 'Tags & Profiles', type: 'show'
  },
  {
    cmd: 'show wlan summary',
    desc: 'List of all WLANs / SSIDs with status and security mode.',
    example: `ID  Name        Status   Security
1   Corp-WLAN  Enabled  WPA2/WPA3
2   Guest-WLAN Enabled  Open`,
    platforms: ['wlc'], section: 'WLAN Configuration', type: 'show'
  },
  {
    cmd: 'show wlan id 1',
    desc: 'Detailed WLAN configuration for the specified WLAN ID.',
    example: `SSID     : Corp
VLAN     : 100
Security : WPA2/WPA3`,
    platforms: ['wlc'], section: 'WLAN Configuration', type: 'show'
  },
  {
    cmd: 'show wireless client summary',
    desc: 'All connected wireless clients with associated AP, WLAN, and RSSI.',
    example: `Client MAC        AP Name    WLAN   RSSI
0011.2233.4455   AP-LON-01  Corp   -55`,
    platforms: ['wlc'], section: 'Client Management', type: 'show'
  },
  {
    cmd: 'show wireless client detail mac-address 0011.2233.4455',
    desc: 'Detailed client information for one MAC: IP, VLAN, AP, RSSI, SNR.',
    example: `IP Address : 10.50.100.27
VLAN       : 100
AP Name    : AP-LON-01
RSSI       : -55 dBm
SNR        : 38 dB`,
    platforms: ['wlc'], section: 'Client Management', type: 'show'
  },
  {
    cmd: 'show ap name AP-LON-01 config general',
    desc: 'Full configuration for a specific AP (model, mode, tags).',
    example: `AP Name    : AP-LON-01
AP Model   : C9130AXI-E
AP Mode    : Local
Policy Tag : CORP-POLICY
Site Tag   : LONDON-SITE`,
    platforms: ['wlc'], section: 'AP Management', type: 'show'
  },
  {
    cmd: 'show ap dot11 24ghz summary',
    desc: '2.4 GHz radio summary across all APs (channel, power, client count).',
    example: `AP Name    Channel Power Clients
AP-LON-01  6       3     12`,
    platforms: ['wlc'], section: 'RRM', type: 'show'
  },
  {
    cmd: 'show ap dot11 5ghz summary',
    desc: '5 GHz radio summary across all APs.',
    example: `AP Name    Channel Power Clients
AP-LON-01  36      4     45`,
    platforms: ['wlc'], section: 'RRM', type: 'show'
  },
  {
    cmd: 'show ap dot11 6ghz summary',
    desc: '6 GHz radio summary (Wi-Fi 6E) across all APs.',
    example: `AP Name    Channel Power Clients
AP-LON-01  5       3     6`,
    platforms: ['wlc'], section: 'RRM', type: 'show'
  },
  {
    cmd: 'show ap summary',
    desc: 'All joined APs with model, state, IP, and AP mode.',
    example: `AP Name     Model         State IP Address     Mode
AP-LON-01   C9130AXI-E    Up    10.10.10.21    Local
AP-WHS-03   C9115AXI-E    Up    10.10.20.31    Flex`,
    platforms: ['wlc'], section: 'AP Management', type: 'show'
  },
  {
    cmd: 'show wireless summary',
    desc: 'High-level totals: APs, clients, WLANs, radios.',
    example: `Number of APs:        48
Number of Clients:    612
Number of WLANs:      9
Number of Radios:     144`,
    platforms: ['wlc'], section: 'Show & Status', type: 'show'
  },

  // ============== Stack management ==============
  {
    cmd: 'show switch',
    desc: 'StackWise members, roles, MAC, and ready state.',
    example: `Switch#  Role    Mac Address        State
1        Active  5c5a.c7aa.b100     Ready
2        Member  5c5a.c7aa.b200     Ready
3        Member  5c5a.c7aa.b300     Ready`,
    platforms: ['ciscoios', 'ciscoiosxe_sw'], section: 'Show & Status', type: 'show'
  },
  {
    cmd: 'switch 3 renumber 2',
    desc: 'Renumber a stack member from 3 to 2 (takes effect after reload).',
    example: `WARNING: Renumbering will take effect after reload`,
    platforms: ['ciscoios', 'ciscoiosxe_sw'], section: 'Config Management', type: 'config', flagged: true
  },

  // ============== Transceivers (IOS / IOS-XE / NX-OS) ==============
  {
    cmd: 'show interface GigabitEthernet1/0/1 transceiver detail',
    desc: 'IOS / IOS-XE — transceiver vendor, part number, serial, DOM detail.',
    example: `Vendor Name: CISCO
Vendor PN: SFP-10G-SR
Serial No: FNS1234567A`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Interfaces', type: 'show'
  },
  {
    cmd: 'show interface ethernet1/1 transceiver details',
    desc: 'NX-OS — transceiver vendor / part / type / serial.',
    example: `type is 10Gbase-SR
name is CISCO
part number is SFP-10G-SR`,
    platforms: ['nexus'], section: 'Interfaces', type: 'show'
  },

  // ============== Show-running pipe regex ==============
  {
    cmd: 'show run | include [0-9]{1,3}',
    desc: 'Pipe regex — match digit sequences 1-3 chars long; useful for filtering numeric values like VLAN/MTU.',
    example: `vlan 1
mtu 900
interface GigabitEthernet0/2`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Show & Status', type: 'show'
  },
  {
    cmd: 'show run | include [0-9]',
    desc: 'Pipe regex — match any line containing at least one digit.',
    example: `vlan 10
ip address 192.168.1.1 255.255.255.0`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Show & Status', type: 'show'
  },

  // ============== Config management ==============
  {
    cmd: 'write memory',
    desc: 'Save running-config to startup-config (alias for "copy running-config startup-config").',
    example: `Building configuration...
[OK]`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Config Management', type: 'config'
  },
  {
    cmd: 'copy running-config startup-config',
    desc: 'Save running-config to startup-config.',
    example: `Destination filename [startup-config]?
Building configuration...
[OK]`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Config Management', type: 'config'
  },

  // ============== System / processes / logs ==============
  {
    cmd: 'show processes cpu',
    desc: 'CPU utilisation (5-second / 1-min / 5-min averages).',
    example: `CPU utilization for five seconds: 3%/0%
one minute: 4%  five minutes: 5%`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router', 'wlc'], section: 'Show & Status', type: 'show'
  },
  {
    cmd: 'show memory',
    desc: 'Memory pool totals — total, used, free.',
    example: `Processor Pool Total: 987654321 Used: 456789012 Free: 530865309`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Show & Status', type: 'show'
  },
  {
    cmd: 'show logging | include severity',
    desc: 'Filter logging buffer by severity — useful when looking for specific %xxx-N-MSG severity tags.',
    example: `%SYS-5-CONFIG_I: Configured from console
%LINK-3-UPDOWN: Interface Gi0/1, changed state to up`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'NTP / SNMP / Logging', type: 'show'
  },

  // ============== ARP / IPv6 ND ==============
  {
    cmd: 'show ipv6 neighbors',
    desc: 'IPv6 neighbour-discovery cache (analogous to ARP for IPv6).',
    example: `IPv6 Address                              Age  Link-layer Addr  Interface
2001:db8::1                                1   0011.2233.4455  Gi0/0`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Routing', type: 'show'
  },

  // ============== Routing show variants ==============
  {
    cmd: 'show ip route 10.10.0.0',
    desc: 'Per-prefix routing detail — protocol, distance/metric, next-hop.',
    example: `Routing entry for 10.10.0.0/16
  Known via "ospf 1", distance 110, metric 20
  * 192.168.1.2, via GigabitEthernet0/0`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Routing', type: 'show'
  },

  // ============== Diagnostics ==============
  {
    cmd: 'ping <IP_ADDRESS>',
    desc: 'Basic ICMP reachability test. Replace <IP_ADDRESS> with the target.',
    example: `Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 192.168.1.254, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5)`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Diagnostics', type: 'troubleshooting'
  },

  // ============== Interface details ==============
  {
    cmd: 'show ip interface GigabitEthernet0/0',
    desc: 'Detailed L3 status and configuration for a single interface.',
    example: `GigabitEthernet0/0 is up, line protocol is up
  Internet address is 192.168.1.1/24
  MTU 1500 bytes, BW 1000000 Kbit/sec
  Encapsulation ARPA`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Interfaces', type: 'show'
  },
  {
    cmd: 'show controllers GigabitEthernet0/0',
    desc: 'Physical / controller-level interface information (link state, PHY, hardware).',
    example: `Interface GigabitEthernet0/0
  Hardware is iGbE
  Link is Up - 1Gbps Full Duplex`,
    platforms: ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'], section: 'Interfaces', type: 'show'
  }
];

// ---------- Apply ----------------------------------------------------
let updated = 0, addedNew = 0;
for (const e of ENTRIES) {
  let didMatch = false;
  for (const pk of e.platforms) {
    const plat = data.platforms?.[pk];
    if (!plat?.sections) continue;
    // 1. If the command already exists anywhere in this platform, attach
    //    the example to it (and patch a missing desc).
    let foundInThisPlat = false;
    for (const cmds of Object.values(plat.sections)) {
      for (const c of cmds) {
        if (c.cmd === e.cmd) {
          foundInThisPlat = true;
          didMatch = true;
          if (!c.example) { c.example = e.example; updated++; }
          if (!c.desc || c.desc.trim() === '') c.desc = e.desc;
        }
      }
    }
    if (foundInThisPlat) continue;
    // 2. Otherwise, add a new entry under e.section.
    plat.sections[e.section] ||= [];
    plat.sections[e.section].push({
      cmd: e.cmd,
      desc: e.desc,
      type: e.type || 'show',
      flagged: e.flagged || false,
      example: e.example
    });
    addedNew++;
    didMatch = true;
  }
  if (!didMatch) console.warn('  (skipped — no matching platform):', e.cmd);
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`\nResult:`);
console.log(`  Existing commands updated with example: ${updated}`);
console.log(`  New commands added (with example):     ${addedNew}`);
console.log(`  Distinct example outputs in this batch: ${ENTRIES.length}`);
