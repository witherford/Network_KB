#!/usr/bin/env node
/**
 * Enrich commands.json:
 *  - Adds 10 new commands across various platforms
 *  - Adds examples to 10 existing commands per platform (openssl, wireshark, netscalersdx, linux)
 */
import { readFileSync, writeFileSync } from 'fs';

const PATH = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(PATH, 'utf8'));

// Helper: find a command by exact cmd string within a section array
function findAndUpdate(cmds, cmdStr, example) {
  const entry = cmds.find(c => c.cmd === cmdStr);
  if (!entry) { console.warn('  WARN: could not find cmd:', cmdStr); return false; }
  if (entry.example) { console.log('  SKIP (already has example):', cmdStr); return false; }
  entry.example = example;
  console.log('  UPDATED:', cmdStr);
  return true;
}

// Helper: push a new command into a section
function addCmd(platform, sectionName, entry) {
  const sec = data.platforms[platform].sections[sectionName];
  if (!sec) { console.warn('  WARN: section not found:', platform, sectionName); return false; }
  const exists = sec.some(c => c.cmd === entry.cmd);
  if (exists) { console.warn('  SKIP (already exists):', entry.cmd); return false; }
  sec.push(entry);
  console.log('  ADDED:', entry.cmd, 'to', platform, '/', sectionName);
  return true;
}

// ─────────────────────────────────────────────────────────────────
// 1.  10 NEW COMMANDS
// ─────────────────────────────────────────────────────────────────
console.log('\n=== Adding 10 new commands ===');

// 1a. Nexus – VLANs / VPC: show vpc brief
addCmd('nexus', 'VLANs / VPC', {
  cmd: 'show vpc brief',
  desc: 'Compact VPC status table: domain, role, peer-link state, keepalive status, and per-vPC VLAN consistency — faster read than the full show vpc output',
  type: 'show',
  flagged: false,
  example:
    'vPC domain id                     : 1\n' +
    'vPC Peer Status               : peer adjacency formed ok\n' +
    'vPC Keep-Alive Status         : peer is alive\n' +
    'vPC role                      : primary\n\n' +
    'Id    Port   Status Consistency Reason    Active vlans\n' +
    '----  ------ ------ ----------- ------    ------------\n' +
    '10    Po10   up     success     success   1,10,20,100-102\n' +
    '20    Po20   up     success     success   1,10,20'
});

// 1b. Windows – Networking: route print
addCmd('windows', 'Networking', {
  cmd: 'route print',
  desc: 'Displays the full IPv4 and IPv6 routing tables including interface list, active routes, persistent routes, and default gateway — classic cmd.exe alternative to Get-NetRoute',
  type: 'show',
  flagged: false,
  example:
    '===========================================================================\n' +
    'Interface List\n' +
    '  6...00 50 56 8f 12 ab ......vmxnet3 Ethernet Adapter\n' +
    '  1...........................Software Loopback Interface 1\n' +
    '===========================================================================\n\n' +
    'IPv4 Route Table\n' +
    '===========================================================================\n' +
    'Active Routes:\n' +
    'Network Destination        Netmask          Gateway       Interface  Metric\n' +
    '          0.0.0.0          0.0.0.0      192.168.1.1    192.168.1.10     25\n' +
    '        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331\n' +
    '      192.168.1.0    255.255.255.0         On-link     192.168.1.10    281\n' +
    '      192.168.1.10  255.255.255.255         On-link     192.168.1.10    281\n' +
    '        224.0.0.0        240.0.0.0         On-link         127.0.0.1    331\n' +
    'Default Gateway:       192.168.1.1'
});

// 1c. Cisco IOS – Show & Status: show standby brief
addCmd('ciscoios', 'Show & Status', {
  cmd: 'show standby brief',
  desc: 'Single-line-per-group HSRP status table showing interface, group number, priority, preempt flag (P), state, active router IP, standby router IP, and virtual IP',
  type: 'show',
  flagged: false,
  example:
    '                     P indicates configured to preempt.\n' +
    '                     |\n' +
    'Interface   Grp  Pri P State    Active          Standby         Virtual IP\n' +
    'Gi0/0         1  110 P Active   local           192.168.1.2     192.168.1.254\n' +
    'Gi0/1        10  100   Standby  10.0.0.1        local           10.0.0.254'
});

// 1d. Cisco IOS – Routing: show track
addCmd('ciscoios', 'Routing', {
  cmd: 'show track',
  desc: 'Lists all IP SLA tracking objects with current Up/Down state, number of state changes, and what uses the tracked object (HSRP group, static route, EEM)',
  type: 'show',
  flagged: false,
  example:
    'Track 1\n' +
    '  IP SLA 1 reachability\n' +
    '  Reachability is Up\n' +
    '    11 changes, last change 00:05:10\n' +
    '  Tracked by:\n' +
    '    HSRP GigabitEthernet0/0 1\n\n' +
    'Track 2\n' +
    '  IP SLA 2 reachability\n' +
    '  Reachability is Down\n' +
    '    3 changes, last change 00:01:45\n' +
    '  Tracked by:\n' +
    '    Static IP routing 0.0.0.0 0.0.0.0 distance 1'
});

// 1e. Cisco IOS – Routing: show ip policy
addCmd('ciscoios', 'Routing', {
  cmd: 'show ip policy',
  desc: 'Shows which route-map is applied as a policy-based routing (PBR) policy on each interface — confirms PBR is active before troubleshooting unexpected forwarding',
  type: 'show',
  flagged: false,
  example:
    'Interface      Route map\n' +
    'GigabitEthernet0/0   MARK-VOIP\n' +
    'GigabitEthernet0/1   ISP-FAILOVER'
});

// 1f. Cisco IOS – Switching & STP: debug lacp
addCmd('ciscoios', 'Switching & STP', {
  cmd: 'debug lacp',
  desc: 'Enables LACP event debug output: PDU send/receive, state-machine transitions, and bundle formation events — disable immediately after capture with "undebug all"',
  type: 'debug',
  flagged: false,
  example:
    '*Mar  1 00:01:23.456: LACP-5-BUNDLECOMPAT: Gi1/0/1 is compatible, will be bundled into Po1\n' +
    '*Mar  1 00:01:23.457: LACP-5-BUNDLE: Gi1/0/1 added to aggregation Po1\n' +
    '*Mar  1 00:01:23.789: LACP-5-BUNDLE: Gi1/0/2 added to aggregation Po1\n' +
    '*Mar  1 00:01:24.001: LACP: Gi1/0/1 Tx PDU to 0050.56ff.aabb sys 0x8000,00e0.1e11.2233 key 0x0101 port 0x8001 state 0x3d'
});

// 1g. Palo Alto – Sessions & Flows: show session distribution
addCmd('paloalto', 'Sessions & Flows', {
  cmd: 'show session distribution',
  desc: 'Displays how active sessions are distributed across dataplane CPU cores — use to identify session imbalance when a single core is near 100% while others are idle',
  type: 'show',
  flagged: false,
  example:
    'Session distribution:\n' +
    '  DP0:  Core 0: 2156  Core 1: 2089  Core 2: 2201  Core 3: 2134\n' +
    '  DP1:  Core 0: 1980  Core 1: 2050  Core 2: 1995  Core 3: 2040\n' +
    '  Total active sessions: 16645\n' +
    '  Max sessions: 131072\n' +
    '  Session utilization: 12%'
});

// 1h. Palo Alto – Monitoring & Diagnostics: show resource-monitor
addCmd('paloalto', 'Monitoring & Diagnostics', {
  cmd: 'show resource-monitor',
  desc: 'Rolling CPU, memory, and disk utilisation history for both management plane and data plane — useful for spotting trends before an alert triggers',
  type: 'show',
  flagged: false,
  example:
    'Resource monitor: (values as % utilization)\n' +
    '5-second average:\n' +
    '  dataplane:   cpu  38%   memory  61%\n' +
    '  management:  cpu  12%   memory  44%\n' +
    '1-minute average:\n' +
    '  dataplane:   cpu  35%   memory  61%\n' +
    '  management:  cpu   9%   memory  44%\n' +
    '15-minute average:\n' +
    '  dataplane:   cpu  33%   memory  60%'
});

// 1i. Aruba CX – VRF: show vrf detail
addCmd('aruba_cx', 'VRF', {
  cmd: 'show vrf detail',
  desc: 'Extended VRF listing including route distinguisher, import/export route targets, associated interfaces, and per-VRF unicast/multicast route counts',
  type: 'show',
  flagged: false,
  example:
    'VRF: default\n' +
    '  Route Distinguisher: none\n' +
    '  Interfaces: 1/1/1, 1/1/2, loopback0\n' +
    '  Routes: 24 unicast\n\n' +
    'VRF: MGMT\n' +
    '  Route Distinguisher: none\n' +
    '  Interfaces: mgmt\n' +
    '  Routes: 2 unicast\n\n' +
    'VRF: Customer-A\n' +
    '  Route Distinguisher: 65001:100\n' +
    '  Import RT: 65001:100\n' +
    '  Export RT: 65001:100\n' +
    '  Interfaces: 1/1/3, 1/1/4\n' +
    '  Routes: 18 unicast'
});

// 1j. Palo Alto – Commit & Config: request system private-data-reset
addCmd('paloalto', 'Commit & Config', {
  cmd: 'request system private-data-reset',
  desc: 'Factory-resets all private configuration data — admin credentials, certificates, private keys, and logs — while preserving the base OS image. Required before RMA or resale. IRREVERSIBLE',
  type: 'config',
  flagged: true,
  example:
    'Warning: This operation will permanently delete all private data including\n' +
    '  configurations, administrator accounts, certificates, and logs.\n' +
    '  The device will reboot and return to factory defaults.\n' +
    '  Type "yes" to confirm: yes\n\n' +
    'Private data reset initiated. System will reboot momentarily.'
});


// ─────────────────────────────────────────────────────────────────
// 2.  EXISTING COMMANDS — OpenSSL (10 examples)
// ─────────────────────────────────────────────────────────────────
console.log('\n=== Adding examples to OpenSSL commands ===');
const openssl = data.platforms.openssl.sections;

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:443',
  'CONNECTED(00000003)\ndepth=2 C=US, O=DigiCert Inc, CN=DigiCert Global Root CA\ndepth=1 C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1\ndepth=0 CN=example.com\n---\nCertificate chain\n 0 s:CN=example.com\n   i:C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1\n---\nSSL-Session:\n    Protocol  : TLSv1.3\n    Cipher    : TLS_AES_256_GCM_SHA384\n    Session-ID: A3F2...\n    Master-Key: (empty for TLS 1.3)\n---\nread R BLOCK\nclosed'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:443 -servername hostname',
  '# Without -servername the server may return its default (catch-all) cert.\n# With SNI, it returns the cert for the virtual host.\nCONNECTED(00000003)\n...\nSubject Name: CN=hostname.example.com\nSAN: hostname.example.com\n...\nSSL-Session:\n    Protocol  : TLSv1.3\n    Cipher    : TLS_AES_256_GCM_SHA384'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:443 -showcerts',
  'CONNECTED(00000003)\n---\nCertificate chain\n 0 s:CN=example.com\n   i:C=US, O=Let\'s Encrypt, CN=R3\n-----BEGIN CERTIFICATE-----\nMIIE...(leaf cert PEM)\n-----END CERTIFICATE-----\n 1 s:C=US, O=Let\'s Encrypt, CN=R3\n   i:C=US, O=Internet Security Research Group, CN=ISRG Root X1\n-----BEGIN CERTIFICATE-----\nMIIF...(intermediate PEM)\n-----END CERTIFICATE-----\n---\n# Paste each PEM block into a .crt to inspect or import individually.'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:443 -tls1_2',
  '# If the server supports TLS 1.2 you see:\nCONNECTED(00000003)\n...\nSSL-Session:\n    Protocol  : TLSv1.2\n    Cipher    : ECDHE-RSA-AES256-GCM-SHA384\n\n# If TLS 1.2 is disabled server-side:\nCONNECTED(00000003)\nwrite:errno=104\n# or: alert handshake failure'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:443 -tls1_3',
  '# Server accepts TLS 1.3:\nCONNECTED(00000003)\nSSL-Session:\n    Protocol  : TLSv1.3\n    Cipher    : TLS_AES_256_GCM_SHA384\n\n# Server does not support TLS 1.3 (legacy server):\nCONNECTED(00000003)\nSSL-Session:\n    Protocol  : TLSv1.2   ← negotiated down\n# Or: handshake failure if server is strict'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:25 -starttls smtp',
  '220 mail.example.com ESMTP\nEHLO openssl.client\n250-mail.example.com\n250 STARTTLS\nSTARTTLS\n220 Ready to start TLS\nCONNECTED(00000003)\n...\nSSL-Session:\n    Protocol  : TLSv1.2\n    Cipher    : ECDHE-RSA-AES256-GCM-SHA384\n# Also works with: -starttls ftp | imap | ldap | pop3 | xmpp'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:443 -status',
  'CONNECTED(00000003)\n...\nOCSP response:\n======================================\nOCSP Response Data:\n    OCSP Response Status: successful (0x0)\n    Response Type: Basic OCSP Response\n    Cert Status: Good\n    This Update: Jun 14 08:00:00 2026 GMT\n    Next Update: Jun 21 08:00:00 2026 GMT\n======================================\n# If no OCSP staple is returned: OCSP response: no response sent'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_client -connect hostname:443 -no_ssl3 -no_tls1 -no_tls1_1',
  '# If server correctly rejects old protocols:\nCONNECTED(00000003)\nSSL-Session:\n    Protocol  : TLSv1.2   (or TLSv1.3)\n\n# Verifying TLS 1.0/1.1 are truly disabled:\nopenssl s_client -connect hostname:443 -tls1_1\n  → handshake failure  ✓ good\nopenssl s_client -connect hostname:443 -tls1\n  → handshake failure  ✓ good'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl s_server -key private.key -cert cert.crt -accept 4433 -www',
  '# Server side — starts listening:\nUsing default temp DH parameters\nCiphers supported in s_server binary\n...\nSECURE Renegotiation IS supported\n\n# Client connects:  openssl s_client -connect 127.0.0.1:4433\n# Server logs:\nClient IP: 127.0.0.1\nSSL_accept:before SSL initialization\nSSL_accept:TLSv1.3 read client hello\nSSL_accept:TLSv1.3 write server hello\nSSL_accept:SSLv3/TLS write certificate\nSSL_accept:TLSv1.3 write finished\nACCEPT'
);

findAndUpdate(
  openssl['TLS Client Testing'],
  'openssl speed rsa2048',
  'Doing 2048 bits private rsa\'s for 10s: 18722 2048 bits private RSA\'s in 10.00s\nDoing 2048 bits public rsa\'s for 10s: 605743 2048 bits public RSA\'s in 10.01s\n             sign    verify    sign/s verify/s\nrsa 2048 bits 0.000534s 0.000017s   1872.2  60513.8\n# sign/s is the critical metric for TLS handshake capacity under load'
);


// ─────────────────────────────────────────────────────────────────
// 3.  EXISTING COMMANDS — Wireshark Display Filters — Basic (10)
// ─────────────────────────────────────────────────────────────────
console.log('\n=== Adding examples to Wireshark Display Filters — Basic ===');
const ws = data.platforms.wireshark.sections['Display Filters — Basic'];

findAndUpdate(ws, 'ip.addr == 10.0.0.1',
  '# Apply in the Wireshark filter bar or with tshark -Y\n' +
  '# Matches any frame where 10.0.0.1 appears as source OR destination.\n' +
  'Frame 42: 74 bytes  10.0.0.1 → 10.0.0.50  TCP 80 → 54321 [SYN,ACK]\n' +
  'Frame 43: 60 bytes  10.0.0.50 → 10.0.0.1  TCP 54321 → 80  [ACK]\n' +
  '# Use "Follow TCP Stream" on any matching frame to reconstruct the session.'
);

findAndUpdate(ws, 'ip.src == 10.0.0.1',
  '# Shows only frames originating from 10.0.0.1 — one direction only.\n' +
  'Frame 42:  10.0.0.1 → 10.0.0.50  TCP [SYN]\n' +
  'Frame 44:  10.0.0.1 → 10.0.0.50  HTTP GET /index.html\n' +
  '# Pair with ip.dst == 10.0.0.1 to see the reply stream separately.'
);

findAndUpdate(ws, 'ip.dst == 10.0.0.1',
  '# Shows only frames arriving at 10.0.0.1.\n' +
  'Frame 43:  10.0.0.50 → 10.0.0.1  TCP [SYN,ACK]\n' +
  'Frame 47:  10.0.0.50 → 10.0.0.1  HTTP 200 OK (text/html)\n' +
  '# Useful for counting inbound traffic volume or spotting unexpected senders.'
);

findAndUpdate(ws, 'ip.addr == 10.0.0.0/24',
  '# Matches any packet where source OR destination falls in the /24 subnet.\n' +
  '# Wireshark expands the CIDR internally; works with /8, /16, /24, /32.\n' +
  'Frame 5:  10.0.0.1  → 10.0.0.50   ARP  Who has 10.0.0.50?\n' +
  'Frame 6:  10.0.0.50 → 10.0.0.1    ARP  10.0.0.50 is at 00:0c:29:aa:bb:cc\n' +
  'Frame 7:  10.0.0.1  → 10.0.0.50   TCP [SYN]'
);

findAndUpdate(ws, 'not (ip.addr == 10.0.0.1)',
  '# Hides all traffic involving 10.0.0.1 — useful when that host is noisy\n' +
  '# and you want to focus on other conversation.\n' +
  '# Equivalent: !(ip.addr == 10.0.0.1)\n' +
  'Frame 55:  10.0.0.2 → 8.8.8.8  DNS Standard query A example.com\n' +
  'Frame 56:  8.8.8.8  → 10.0.0.2 DNS Standard query response A 93.184.216.34\n' +
  '# All 10.0.0.1 frames are suppressed from view; the capture is unchanged.'
);

findAndUpdate(ws, 'ip.addr == 10.0.0.1 and ip.addr == 10.0.0.2',
  '# Both addresses must appear in each frame — effectively a conversation filter.\n' +
  '# Identical to using the "Follow Stream" right-click on a matching packet.\n' +
  'Frame 10: 10.0.0.1 → 10.0.0.2  TCP [SYN]\n' +
  'Frame 11: 10.0.0.2 → 10.0.0.1  TCP [SYN,ACK]\n' +
  'Frame 12: 10.0.0.1 → 10.0.0.2  TCP [ACK]\n' +
  '# Only these two hosts are shown; any third-party traffic is hidden.'
);

findAndUpdate(ws, 'ipv6.addr == 2001:db8::1',
  '# IPv6 equivalent of ip.addr — matches source or destination.\n' +
  '# Use ipv6.src and ipv6.dst for directional filtering.\n' +
  'Frame 20: 2001:db8::1 → 2001:db8::2  ICMPv6 Echo Request\n' +
  'Frame 21: 2001:db8::2 → 2001:db8::1  ICMPv6 Echo Reply\n' +
  '# Combine with tcp.port or udp.port to narrow by service.'
);

findAndUpdate(ws, 'eth.addr == aa:bb:cc:dd:ee:ff',
  '# Matches frames where the MAC appears in either src or dst Ethernet header.\n' +
  '# Useful when the MAC is known but IP has changed (DHCP, failover).\n' +
  'Frame 3: aa:bb:cc:dd:ee:ff → ff:ff:ff:ff:ff:ff  ARP Who has 192.168.1.1?\n' +
  'Frame 4: 00:50:56:8f:00:01 → aa:bb:cc:dd:ee:ff  ARP 192.168.1.1 is at 00:50:56:8f:00:01\n' +
  '# Use eth.src or eth.dst to restrict to one direction.'
);

findAndUpdate(ws, 'eth.dst == ff:ff:ff:ff:ff:ff',
  '# Captures all Ethernet-level broadcasts — ARP requests, some DHCP, NetBIOS.\n' +
  'Frame 1:  00:11:22:aa:bb:cc → ff:ff:ff:ff:ff:ff  ARP Who has 10.0.0.1?\n' +
  'Frame 2:  00:de:ad:be:ef:01 → ff:ff:ff:ff:ff:ff  DHCP Discover\n' +
  'Frame 3:  00:50:79:66:68:09 → ff:ff:ff:ff:ff:ff  NetBIOS Name Service\n' +
  '# High broadcast rate (>100/s on a VLAN) suggests a broadcast storm or misconfiguration.'
);

findAndUpdate(ws, 'vlan.id == 20',
  '# Matches 802.1Q-tagged frames with VLAN ID 20.\n' +
  '# Note: Wireshark must see the raw tagged frames (e.g. from a SPAN/mirror port);\n' +
  '# access-port captures have the tag stripped by the switch.\n' +
  'Frame 5:  10.20.0.1 → 10.20.0.50  TCP [SYN]  (VLAN 20)\n' +
  'Frame 6:  10.20.0.50 → 10.20.0.1  TCP [SYN,ACK] (VLAN 20)\n' +
  '# Combine: vlan.id == 20 and tcp.port == 443 to narrow to HTTPS on VLAN 20.'
);


// ─────────────────────────────────────────────────────────────────
// 4.  EXISTING COMMANDS — NetScalerSDX System (10)
// ─────────────────────────────────────────────────────────────────
console.log('\n=== Adding examples to NetScalerSDX System commands ===');
const sdxSys = data.platforms.netscalersdx.sections['System'];

findAndUpdate(sdxSys, 'show system',
  '> show system\n\n' +
  'Hostname: sdx-dc-01\n' +
  'IP:       10.10.10.100  Netmask: 255.255.255.0\n' +
  'Gateway:  10.10.10.1\n' +
  'Version:  SDX 14.1 Build 21.57\n' +
  'Platform: SDX 22000\n' +
  'Uptime:   45 days, 3 hours, 22 minutes\n' +
  'CPUs: 2  Memory: 65536 MB  Disk: 1200 GB\n\n' +
  'What it means:\n' +
  '- Hostname / IP confirm you are on the right appliance.\n' +
  '- Version and Platform are needed for compatibility checks and SR filing.\n' +
  '- Uptime resets after every reboot — a recent value may indicate an unplanned restart.'
);

findAndUpdate(sdxSys, 'show system version',
  '> show system version\n\nSDX 14.1: Build 21.57.nc, Date: Mar  5 2026, 14:22:30'
);

findAndUpdate(sdxSys, 'show system uptime',
  '> show system uptime\n\nSystem uptime: 45 days, 3 hours, 22 minutes, 10 seconds'
);

findAndUpdate(sdxSys, 'show system health',
  '> show system health\n\n' +
  'Overall Health: Good\n' +
  'CPU:           12%  (threshold 80%)\n' +
  'Memory:        43%  (threshold 90%)\n' +
  'Disk /flash:   28%  (threshold 85%)\n' +
  'Fan status:    All OK\n' +
  'PSU status:    All OK\n' +
  'Temperature:   Inlet 26°C  CPU 48°C  — All within limits'
);

findAndUpdate(sdxSys, 'show system date',
  '> show system date\n\nSat Jun 14 10:30:45 UTC 2026'
);

findAndUpdate(sdxSys, 'show system hostname',
  '> show system hostname\n\nHostname: sdx-datacenter-01'
);

findAndUpdate(sdxSys, 'show system ntp',
  '> show system ntp\n\n' +
  'NTP Sync Status : Synchronized\n' +
  'Reference Server: 10.10.10.1\n' +
  'Stratum         : 3\n' +
  'Offset          : 0.002 ms\n' +
  'Last Sync       : Jun 14 10:28:01 UTC 2026'
);

findAndUpdate(sdxSys, 'show system hardware fans',
  '> show system hardware fans\n\n' +
  'Fan  Status  Speed (RPM)\n' +
  '---  ------  -----------\n' +
  '1    OK      2480\n' +
  '2    OK      2510\n' +
  '3    OK      2490\n' +
  '4    OK      2505\n\n' +
  'Note: Fan failure triggers a critical alarm and will be shown as FAILED.'
);

findAndUpdate(sdxSys, 'show system hardware temperature',
  '> show system hardware temperature\n\n' +
  'Sensor          Temp (°C)  Threshold (°C)  Status\n' +
  '-------------   ---------  ---------------  ------\n' +
  'Inlet           27         45               OK\n' +
  'Outlet          41         60               OK\n' +
  'CPU Package 0   52         85               OK\n' +
  'CPU Package 1   49         85               OK\n\n' +
  'Note: A CRITICAL alarm fires when any sensor exceeds its threshold.'
);

findAndUpdate(sdxSys, 'show system processes',
  '> show system processes\n\n' +
  'PID   Name           CPU%  MEM(MB)  State\n' +
  '----  -------------  ----  -------  -------\n' +
  '1234  mgmtsvr         2.1    128.4  Running\n' +
  '1235  snmpd           0.0     32.1  Running\n' +
  '1236  syslogd         0.0     18.6  Running\n' +
  '1237  vpx_mgr         3.4    512.0  Running\n' +
  '1238  xenapi          4.2    256.8  Running'
);


// ─────────────────────────────────────────────────────────────────
// 5.  EXISTING COMMANDS — Linux Networking (10)
// ─────────────────────────────────────────────────────────────────
console.log('\n=== Adding examples to Linux Networking commands ===');
const linuxNet = data.platforms.linux.sections['Networking'];

findAndUpdate(linuxNet, 'ip r',
  '$ ip r\n\n' +
  'default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.100 metric 100\n' +
  '10.0.0.0/8 via 192.168.1.1 dev eth0 proto static metric 100\n' +
  '172.16.0.0/12 via 192.168.1.1 dev eth0 proto static metric 100\n' +
  '192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100\n\n' +
  'Key fields:\n' +
  '  via   = next-hop gateway\n' +
  '  dev   = egress interface\n' +
  '  proto = route source (kernel=connected, dhcp, static)\n' +
  '  src   = preferred source IP for packets leaving this route'
);

findAndUpdate(linuxNet, 'ip -6 r',
  '$ ip -6 r\n\n' +
  '::1 dev lo proto kernel metric 256 pref medium\n' +
  '2001:db8::/64 dev eth0 proto kernel metric 256 expires 86099sec pref medium\n' +
  'fe80::/64 dev eth0 proto kernel metric 256 pref medium\n' +
  'default via fe80::1 dev eth0 proto ra metric 100 pref medium\n\n' +
  'proto ra = learned via Router Advertisement (SLAAC/RA)\n' +
  'expires  = SLAAC prefix lifetime countdown'
);

findAndUpdate(linuxNet, 'ip neigh',
  '$ ip neigh\n\n' +
  '192.168.1.1   dev eth0 lladdr 00:50:56:8f:ab:cd REACHABLE\n' +
  '192.168.1.50  dev eth0 lladdr 00:0c:29:aa:bb:cc STALE\n' +
  '192.168.1.200 dev eth0                           FAILED\n\n' +
  'States:\n' +
  '  REACHABLE — confirmed reachable within the last neighbour timeout\n' +
  '  STALE     — cache entry exists but not recently confirmed\n' +
  '  FAILED    — ARP resolution failed; host may be down or unreachable'
);

findAndUpdate(linuxNet, 'ss -s',
  '$ ss -s\n\n' +
  'Total: 158 (kernel 164)\n' +
  'TCP:   14 (estab 4, closed 6, orphaned 0, timewait 2)\n' +
  'Transport Total     IP        IPv6\n' +
  '*         164       -         -\n' +
  'RAW       0         0         0\n' +
  'UDP       8         5         3\n' +
  'TCP       8         6         2\n' +
  'INET      16        11        5\n' +
  'FRAG      0         0         0'
);

findAndUpdate(linuxNet, 'ss -tan',
  '$ ss -tan\n\n' +
  'State   Recv-Q  Send-Q  Local Address:Port   Peer Address:Port  Process\n' +
  'LISTEN  0       128     0.0.0.0:22           0.0.0.0:*\n' +
  'LISTEN  0       128     0.0.0.0:443          0.0.0.0:*\n' +
  'ESTAB   0       0       192.168.1.10:22      192.168.1.50:54321\n' +
  'ESTAB   0       0       192.168.1.10:443     203.0.113.5:49201\n' +
  'TIME-WAIT 0     0       192.168.1.10:443     203.0.113.6:49198\n\n' +
  'Flags: -t TCP  -a all  -n no DNS resolution'
);

findAndUpdate(linuxNet, 'ethtool <iface>',
  '$ ethtool eth0\n\n' +
  'Settings for eth0:\n' +
  '        Supported ports: [ TP ]\n' +
  '        Supported link modes:   1000baseT/Full\n' +
  '                                10000baseT/Full\n' +
  '        Speed: 1000Mb/s\n' +
  '        Duplex: Full\n' +
  '        Auto-negotiation: on\n' +
  '        Port: Twisted Pair\n' +
  '        Link detected: yes\n\n' +
  'If "Link detected: no" the cable or SFP is the first thing to swap.'
);

findAndUpdate(linuxNet, 'ip link show',
  '$ ip link show\n\n' +
  '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT\n' +
  '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n' +
  '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP mode DEFAULT qlen 1000\n' +
  '    link/ether 00:50:56:8f:12:ab brd ff:ff:ff:ff:ff:ff\n' +
  '3: eth1: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN mode DEFAULT qlen 1000\n' +
  '    link/ether 00:50:56:8f:12:ac brd ff:ff:ff:ff:ff:ff\n\n' +
  'state UP = L2 link is up;  state DOWN = cable/SFP issue or admin-down'
);

findAndUpdate(linuxNet, 'ip addr add <ip>/<mask> dev <iface>',
  '# Add a secondary IP to eth0:\n' +
  '$ sudo ip addr add 192.168.1.200/24 dev eth0\n\n' +
  '# Confirm:\n' +
  '$ ip addr show eth0\n' +
  '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ...\n' +
  '    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0\n' +
  '    inet 192.168.1.200/24 scope global secondary eth0\n\n' +
  '# NOTE: This change is not persistent across reboots. To persist it,\n' +
  '# add the address to /etc/network/interfaces or a systemd-networkd unit.'
);

findAndUpdate(linuxNet, 'ip route add <network> via <gateway>',
  '# Add a static route for 10.0.0.0/8 via 192.168.1.1:\n' +
  '$ sudo ip route add 10.0.0.0/8 via 192.168.1.1 dev eth0\n\n' +
  '# Verify:\n' +
  '$ ip route show\n' +
  '10.0.0.0/8 via 192.168.1.1 dev eth0\n' +
  'default via 192.168.1.1 dev eth0 proto dhcp ...\n\n' +
  '# Not persistent — add to /etc/network/interfaces (Debian) or\n' +
  '# /etc/sysconfig/network-scripts/route-eth0 (RHEL) to survive reboots.'
);

findAndUpdate(linuxNet, 'ss -uan',
  '$ ss -uan\n\n' +
  'State    Recv-Q  Send-Q  Local Address:Port   Peer Address:Port\n' +
  'UNCONN   0       0       127.0.0.53%lo:53     0.0.0.0:*\n' +
  'UNCONN   0       0       127.0.0.1:323         0.0.0.0:*\n' +
  'UNCONN   0       0       0.0.0.0:68            0.0.0.0:*\n' +
  'UNCONN   0       0       0.0.0.0:5353          0.0.0.0:*\n\n' +
  'Port 53 = systemd-resolved  Port 323 = chronyd  Port 68 = DHCP client\n' +
  'Port 5353 = mDNS'
);


// ─────────────────────────────────────────────────────────────────
// 6.  Write the updated file
// ─────────────────────────────────────────────────────────────────
data.updatedAt = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('\n✓ commands.json updated');
