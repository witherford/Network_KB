// One-shot script to massively expand commands.json:
//   1. Add a `group` tag to every platform (Cisco / Citrix / Palo Alto / etc.)
//   2. Rename Palo Alto Firewall → Palo Alto PAN-OS
//   3. Merge `ciscoiosxe_wlc` into `wlc` (dedupe commands), drop the duplicate
//   4. Bulk-add commands to Cisco IOS, Palo Alto PAN-OS (incl. Panorama),
//      and create a brand-new Cisco Nexus platform
//
// Run: node scripts/expand-commands-3.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const P = data.platforms;

// Helper: ensure section exists; append commands; dedupe by .cmd string.
function addCmds(plat, sectionName, cmds) {
  plat.sections ||= {};
  plat.sections[sectionName] ||= [];
  const existing = new Set(plat.sections[sectionName].map(c => c.cmd));
  for (const c of cmds) {
    if (existing.has(c.cmd)) continue;
    existing.add(c.cmd);
    plat.sections[sectionName].push({
      cmd: c.cmd, desc: c.desc, type: c.type || 'show', flagged: c.flagged || false
    });
  }
}

// --- 1. Group tags --------------------------------------------------------

const GROUPS = {
  netscaler:        'Citrix',
  netscalersdx:     'Citrix',
  paloalto:         'Palo Alto',
  cisco:            'Cisco',
  ciscoios:         'Cisco',
  ciscoasa:         'Cisco',
  ciscoiosxe_sw:    'Cisco',
  wlc:              'Cisco',
  ciscoiosxe_wlc:   'Cisco',
  nexus:            'Cisco',
  openssl:          'Linux / Unix',
  linux:            'Linux / Unix',
  esxi:             'Virtualisation',
  proxmox:          'Virtualisation',
  windows:          'Microsoft',
  aws:              'Cloud',
  wireshark:        'Tools'
};
for (const [k, p] of Object.entries(P)) {
  p.group = GROUPS[k] || 'Other';
}

// --- 2. Rename Palo Alto Firewall → Palo Alto PAN-OS ----------------------

if (P.paloalto) {
  P.paloalto.label = 'Palo Alto PAN-OS';
  P.paloalto.short = 'PAN-OS';
}

// --- 3. Merge ciscoiosxe_wlc → wlc ---------------------------------------

if (P.wlc && P.ciscoiosxe_wlc) {
  P.wlc.label = 'Cisco Catalyst 9800 WLC (IOS-XE)';
  P.wlc.short = 'C9800 WLC';
  // Merge sections — sections with the same name combine; commands deduped.
  for (const [sec, cmds] of Object.entries(P.ciscoiosxe_wlc.sections || {})) {
    addCmds(P.wlc, sec, cmds);
  }
  delete P.ciscoiosxe_wlc;
}

// --- 4a. Cisco IOS — major expansion --------------------------------------

const CISCO_IOS = P.ciscoios || (P.ciscoios = { label: 'Cisco IOS', badge: 'badge-sw', short: 'Cisco IOS', group: 'Cisco', sections: {} });

addCmds(CISCO_IOS, 'Show & Status', [
  { cmd: 'show version',                desc: 'Software version, image, uptime, last reload, register' },
  { cmd: 'show running-config',         desc: 'Active in-memory configuration' },
  { cmd: 'show startup-config',         desc: 'Saved configuration loaded at boot' },
  { cmd: 'show inventory',              desc: 'Hardware inventory: chassis, modules, transceivers, serials' },
  { cmd: 'show environment all',        desc: 'Power supplies, fans, temperature' },
  { cmd: 'show platform',               desc: 'Modules / supervisors / line cards detail' },
  { cmd: 'show processes cpu sorted | exclude 0.00',  desc: 'CPU usage by process, ignore idle' },
  { cmd: 'show processes cpu history',  desc: '5-second / 1-minute / 60-minute CPU history' },
  { cmd: 'show processes memory sorted', desc: 'Memory usage per process, descending' },
  { cmd: 'show memory statistics',      desc: 'Detailed memory pool statistics' },
  { cmd: 'show file systems',           desc: 'Available file systems and free space' },
  { cmd: 'show clock detail',           desc: 'Current time + source (manual / NTP / hardware)' },
  { cmd: 'show users',                  desc: 'Active console / VTY sessions' },
  { cmd: 'show line vty 0 4',           desc: 'VTY line configuration and state' },
  { cmd: 'show tech-support | redirect flash:tech.txt', desc: 'Full diagnostic dump for TAC, redirected to flash' },
  { cmd: 'show stack-power',            desc: 'StackPower budget and member detail' }
]);

addCmds(CISCO_IOS, 'Interfaces', [
  { cmd: 'show interfaces',             desc: 'Detailed status, packet/error counters, duplex, speed' },
  { cmd: 'show interfaces description', desc: 'Brief: interface, status, protocol, description' },
  { cmd: 'show ip interface brief | exclude unassigned', desc: 'L3 interfaces with addresses' },
  { cmd: 'show interfaces status',      desc: 'Up/down, VLAN, duplex, speed, type' },
  { cmd: 'show interfaces counters errors', desc: 'Error counters per interface' },
  { cmd: 'show interfaces transceiver detail', desc: 'SFP/SFP+ DOM (Tx/Rx power, temp, voltage)' },
  { cmd: 'show interfaces switchport',  desc: 'Trunk/access mode, native VLAN, allowed list' },
  { cmd: 'show interfaces trunk',       desc: 'Active trunk ports and allowed VLANs' },
  { cmd: 'show controllers Te0/0/0 phy detail', desc: 'PHY-level link diagnostics on a 10GE port' },
  { cmd: 'interface range Gi1/0/1-24',  desc: 'Configure a contiguous range of interfaces', type: 'config' },
  { cmd: 'interface Gi1/0/1\n description UPLINK\n switchport mode access\n switchport access vlan 10\n no shutdown', desc: 'Access port template', type: 'config' },
  { cmd: 'interface Gi1/0/24\n description TRUNK\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30\n switchport trunk native vlan 99', desc: 'Trunk port template', type: 'config' },
  { cmd: 'interface Po1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30', desc: 'Port-channel logical interface', type: 'config' },
  { cmd: 'interface Gi1/0/1\n channel-group 1 mode active\n channel-protocol lacp', desc: 'Add interface to a LACP port-channel', type: 'config' },
  { cmd: 'shutdown',                    desc: 'Disable an interface administratively', type: 'config' },
  { cmd: 'no shutdown',                 desc: 'Re-enable an interface', type: 'config' },
  { cmd: 'speed 1000',                  desc: 'Force 1G speed', type: 'config' },
  { cmd: 'duplex full',                 desc: 'Force full duplex', type: 'config' },
  { cmd: 'mtu 9216',                    desc: 'Set jumbo MTU on an L3 interface', type: 'config' },
  { cmd: 'errdisable recovery cause all', desc: 'Auto-recover all err-disabled causes', type: 'config' },
  { cmd: 'errdisable recovery interval 60', desc: 'Recovery interval in seconds', type: 'config' },
  { cmd: 'show errdisable recovery',    desc: 'Which causes are auto-recovering and the timer' }
]);

addCmds(CISCO_IOS, 'VLANs', [
  { cmd: 'show vlan brief',              desc: 'VLAN ID/name and member ports' },
  { cmd: 'show vlan id 10',              desc: 'Single-VLAN detail incl. member ports + status' },
  { cmd: 'show vtp status',              desc: 'VTP mode, version, domain, revision, last modifier' },
  { cmd: 'show vtp counters',            desc: 'VTP advertisement / pruning counters' },
  { cmd: 'vlan 10\n name DATA',          desc: 'Create a VLAN', type: 'config' },
  { cmd: 'vtp mode transparent',         desc: 'Disable participation in VTP (recommended modern default)', type: 'config' },
  { cmd: 'vtp domain CORP\n vtp mode server', desc: 'Configure VTP server', type: 'config' },
  { cmd: 'switchport access vlan 10',    desc: 'Assign access port to VLAN', type: 'config' },
  { cmd: 'switchport voice vlan 200',    desc: 'Add voice VLAN on the same access port', type: 'config' }
]);

addCmds(CISCO_IOS, 'Routing', [
  { cmd: 'show ip route',                desc: 'Full IPv4 routing table' },
  { cmd: 'show ip route summary',        desc: 'Routing-table size summary by protocol' },
  { cmd: 'show ip route vrf <name>',     desc: 'Routing table for a specific VRF' },
  { cmd: 'show ip route 8.8.8.8',        desc: 'Best route lookup for a single destination' },
  { cmd: 'show ip protocols',            desc: 'Active routing processes + redistribution' },
  { cmd: 'show ip ospf',                 desc: 'OSPF process state, router-id, areas' },
  { cmd: 'show ip ospf neighbor',        desc: 'OSPF adjacencies, state, dead-timer' },
  { cmd: 'show ip ospf database',        desc: 'OSPF LSDB' },
  { cmd: 'show ip ospf interface brief', desc: 'OSPF on each interface, neighbour count, state' },
  { cmd: 'show ip eigrp neighbors',      desc: 'EIGRP adjacencies' },
  { cmd: 'show ip eigrp topology',       desc: 'EIGRP topology table (successors + feasible successors)' },
  { cmd: 'show ip bgp summary',          desc: 'BGP peers, state, prefix counts, uptime' },
  { cmd: 'show ip bgp neighbors',        desc: 'BGP per-peer detail' },
  { cmd: 'show ip bgp',                  desc: 'BGP RIB' },
  { cmd: 'show ip bgp <prefix>',         desc: 'Per-prefix BGP path detail' },
  { cmd: 'show ip cef',                  desc: 'CEF FIB' },
  { cmd: 'show ip cef <prefix> internal', desc: 'CEF entry internals (rewrite, adjacency)' },
  { cmd: 'ip route 0.0.0.0 0.0.0.0 1.1.1.1 name DEFAULT_TO_ISP', desc: 'Static default route', type: 'config' },
  { cmd: 'ip route 192.168.99.0 255.255.255.0 10.10.10.1 100', desc: 'Static route with admin distance 100 (floating)', type: 'config' },
  { cmd: 'router ospf 1\n router-id 1.1.1.1\n network 10.0.0.0 0.255.255.255 area 0', desc: 'Single-area OSPF process', type: 'config' },
  { cmd: 'router bgp 65001\n bgp router-id 1.1.1.1\n neighbor 1.2.3.4 remote-as 65002\n address-family ipv4 unicast\n  neighbor 1.2.3.4 activate', desc: 'eBGP peer baseline', type: 'config' }
]);

addCmds(CISCO_IOS, 'Switching & STP', [
  { cmd: 'show spanning-tree',           desc: 'STP topology per VLAN: root, port states, costs' },
  { cmd: 'show spanning-tree summary',   desc: 'Per-VLAN STP root + protect/loopguard counters' },
  { cmd: 'show spanning-tree blockedports', desc: 'STP-blocked ports across all VLANs' },
  { cmd: 'show spanning-tree mst',       desc: 'MST instances + member VLANs' },
  { cmd: 'show etherchannel summary',    desc: 'Port-channels: status, members, protocol' },
  { cmd: 'show etherchannel load-balance', desc: 'Active EtherChannel hash algorithm' },
  { cmd: 'show mac address-table',       desc: 'Full MAC table' },
  { cmd: 'show mac address-table address 0050.5612.3456', desc: 'Find which port a MAC is on' },
  { cmd: 'show mac address-table dynamic vlan 10', desc: 'MAC table for one VLAN, dynamic only' },
  { cmd: 'show mac address-table count',  desc: 'Total / dynamic / static MAC counts' },
  { cmd: 'spanning-tree mode rapid-pvst', desc: 'Use RPVST+ (modern default)', type: 'config' },
  { cmd: 'spanning-tree portfast bpduguard default', desc: 'Globally enable PortFast BPDU Guard on access ports', type: 'config' },
  { cmd: 'spanning-tree extend system-id', desc: 'Use 12-bit MAC reduction (default on modern IOS)', type: 'config' },
  { cmd: 'spanning-tree vlan 1 root primary', desc: 'Become STP root for VLAN 1', type: 'config' },
  { cmd: 'udld aggressive',              desc: 'Enable UDLD aggressive mode globally', type: 'config' }
]);

addCmds(CISCO_IOS, 'Security', [
  { cmd: 'show access-lists',            desc: 'All ACLs with hit counts' },
  { cmd: 'show ip access-lists EXAMPLE', desc: 'Single named ACL detail' },
  { cmd: 'show port-security',           desc: 'Port-security counts globally' },
  { cmd: 'show port-security interface Gi1/0/1', desc: 'Per-interface port-security state and learned MACs' },
  { cmd: 'show ip dhcp snooping',        desc: 'DHCP snooping global state' },
  { cmd: 'show ip dhcp snooping binding', desc: 'DHCP snooping bindings DB' },
  { cmd: 'show authentication sessions interface Gi1/0/1 details', desc: '802.1X / MAB session detail per port' },
  { cmd: 'show aaa servers',             desc: 'TACACS+/RADIUS server reachability + counters' },
  { cmd: 'show login',                   desc: 'Login enhancements / quiet-mode state' },
  { cmd: 'aaa new-model',                desc: 'Enable AAA framework', type: 'config' },
  { cmd: 'aaa authentication login default group radius local', desc: 'Login auth: RADIUS first, fall back to local', type: 'config' },
  { cmd: 'aaa authorization commands 15 default group tacacs+ none', desc: 'Per-command authz at priv 15', type: 'config' },
  { cmd: 'aaa accounting commands 15 default start-stop group tacacs+', desc: 'Command accounting', type: 'config' },
  { cmd: 'username admin privilege 15 secret <pwd>', desc: 'Local fallback admin', type: 'config' },
  { cmd: 'enable secret <pwd>',          desc: 'Set the enable password (irreversible hash)', type: 'config' },
  { cmd: 'service password-encryption',  desc: 'Type-7 encrypt all plaintext passwords (legacy obfuscation)', type: 'config' },
  { cmd: 'ip ssh version 2\nip ssh time-out 60\nip ssh authentication-retries 3', desc: 'Harden SSH server', type: 'config' }
]);

addCmds(CISCO_IOS, 'QoS', [
  { cmd: 'show policy-map interface Gi1/0/1', desc: 'Per-interface QoS policy counters' },
  { cmd: 'show class-map',               desc: 'Configured class-maps' },
  { cmd: 'show policy-map',              desc: 'Configured policy-maps' },
  { cmd: 'show mls qos',                 desc: 'Global MLS QoS state and per-port trust' },
  { cmd: 'show mls qos interface Gi1/0/1', desc: 'Per-interface QoS trust + DSCP/CoS maps' },
  { cmd: 'mls qos',                      desc: 'Globally enable MLS QoS', type: 'config' },
  { cmd: 'class-map match-any VOICE\n match dscp ef\n match cos 5', desc: 'Match voice traffic by DSCP EF or CoS 5', type: 'config' },
  { cmd: 'policy-map MARK\n class VOICE\n  set dscp ef\n class class-default\n  set dscp default', desc: 'Re-mark policy', type: 'config' }
]);

addCmds(CISCO_IOS, 'Multicast', [
  { cmd: 'show ip mroute',               desc: 'Multicast routing table (full)' },
  { cmd: 'show ip mroute summary',       desc: 'Multicast routing summary' },
  { cmd: 'show ip pim neighbor',         desc: 'PIM neighbours and uptime' },
  { cmd: 'show ip pim interface',        desc: 'PIM-enabled interfaces, mode, DR' },
  { cmd: 'show ip pim rp',               desc: 'PIM rendezvous-point assignments' },
  { cmd: 'show ip igmp groups',          desc: 'IGMP joined groups per interface' },
  { cmd: 'show ip igmp snooping',        desc: 'L2 IGMP snooping state' },
  { cmd: 'ip multicast-routing distributed', desc: 'Enable multicast routing globally', type: 'config' },
  { cmd: 'ip pim sparse-mode',           desc: 'Enable PIM sparse-mode on an interface', type: 'config' },
  { cmd: 'ip pim rp-address 10.0.0.1',   desc: 'Static PIM RP', type: 'config' }
]);

addCmds(CISCO_IOS, 'NAT', [
  { cmd: 'show ip nat translations',     desc: 'Active NAT translations' },
  { cmd: 'show ip nat statistics',       desc: 'NAT counters: hits, misses, translations' },
  { cmd: 'clear ip nat translation *',   desc: 'Clear all NAT entries (testing)', type: 'troubleshooting', flagged: true },
  { cmd: 'ip nat inside source list 1 interface Gi0/0/1 overload', desc: 'PAT overload to outside interface', type: 'config' },
  { cmd: 'ip nat inside source static 10.0.0.10 198.51.100.10', desc: '1:1 static NAT', type: 'config' }
]);

addCmds(CISCO_IOS, 'DHCP / Services', [
  { cmd: 'show ip dhcp binding',         desc: 'DHCP server leases' },
  { cmd: 'show ip dhcp server statistics', desc: 'DHCP server packet counters' },
  { cmd: 'show ip dhcp pool',            desc: 'Configured DHCP pools' },
  { cmd: 'ip dhcp pool DATA\n network 10.0.0.0 255.255.255.0\n default-router 10.0.0.1\n dns-server 8.8.8.8', desc: 'Basic IOS DHCP pool', type: 'config' },
  { cmd: 'ip dhcp excluded-address 10.0.0.1 10.0.0.10', desc: 'Reserve range from being handed out', type: 'config' },
  { cmd: 'ip helper-address 10.99.0.10', desc: 'Forward broadcast DHCP to a server on another subnet', type: 'config' }
]);

addCmds(CISCO_IOS, 'NTP / SNMP / Logging', [
  { cmd: 'show ntp status',              desc: 'NTP sync state, stratum, reference' },
  { cmd: 'show ntp associations',        desc: 'NTP peers / servers + offset' },
  { cmd: 'show snmp',                    desc: 'SNMP agent counters and uptime' },
  { cmd: 'show snmp engineID',           desc: 'SNMPv3 engine ID' },
  { cmd: 'show logging',                 desc: 'Logging buffer + destinations' },
  { cmd: 'ntp server 10.10.10.10 prefer', desc: 'Primary NTP server', type: 'config' },
  { cmd: 'ntp authenticate\nntp authentication-key 1 md5 <key>\nntp trusted-key 1', desc: 'Authenticated NTP', type: 'config' },
  { cmd: 'snmp-server community READONLY RO', desc: 'SNMPv2c read-only community (avoid in modern networks)', type: 'config' },
  { cmd: 'snmp-server group V3GROUP v3 priv read V3VIEW write V3VIEW\nsnmp-server view V3VIEW iso included\nsnmp-server user admin V3GROUP v3 auth sha <auth> priv aes 128 <priv>', desc: 'SNMPv3 read-write user', type: 'config' },
  { cmd: 'logging host 10.50.50.50 transport tcp port 1514', desc: 'Send syslog to remote collector over TCP', type: 'config' },
  { cmd: 'logging buffered 65536 informational', desc: '64K log buffer at informational severity', type: 'config' }
]);

addCmds(CISCO_IOS, 'Embedded Event Manager / Automation', [
  { cmd: 'show event manager policy registered', desc: 'List EEM applets and TCL policies' },
  { cmd: 'show event manager statistics', desc: 'EEM counters' },
  { cmd: 'event manager applet LOG-LINK-DOWN\n event syslog pattern "%LINK-3-UPDOWN"\n action 1.0 syslog msg "Link state changed"', desc: 'EEM applet that fires on syslog match', type: 'config' },
  { cmd: 'event manager applet AUTO-SAVE\n event timer cron name daily cron-entry "0 4 * * *"\n action 1.0 cli command "enable"\n action 2.0 cli command "write memory"', desc: 'Daily auto-save at 04:00', type: 'config' }
]);

addCmds(CISCO_IOS, 'Diagnostics', [
  { cmd: 'ping 8.8.8.8 source loopback0', desc: 'Sourced ping' },
  { cmd: 'ping 8.8.8.8 size 1500 df-bit count 5', desc: 'Path-MTU test' },
  { cmd: 'traceroute 8.8.8.8 source loopback0', desc: 'Sourced traceroute' },
  { cmd: 'show ip arp',                  desc: 'ARP cache' },
  { cmd: 'show ip arp <ip>',             desc: 'ARP entry for one IP' },
  { cmd: 'show cdp neighbors detail',    desc: 'CDP neighbours with full info (IP, software, capabilities)' },
  { cmd: 'show lldp neighbors detail',   desc: 'LLDP neighbours with full info' },
  { cmd: 'monitor capture CAP interface Gi1/0/1 both match any buffer size 10 limit pps 1000', desc: 'EPC capture on an interface', type: 'troubleshooting' },
  { cmd: 'monitor capture CAP start',    desc: 'Start the capture', type: 'troubleshooting' },
  { cmd: 'monitor capture CAP stop',     desc: 'Stop the capture', type: 'troubleshooting' },
  { cmd: 'monitor capture CAP export flash:cap.pcap', desc: 'Export capture to flash', type: 'troubleshooting' },
  { cmd: 'show platform hardware fed switch active fwd-asic resource tcam utilization', desc: 'TCAM utilisation on Cat 9k IOS-XE', type: 'troubleshooting' },
  { cmd: 'debug ip ospf adj',            desc: 'OSPF adjacency events (use sparingly)', type: 'troubleshooting', flagged: true },
  { cmd: 'undebug all',                  desc: 'Disable all debugs', type: 'troubleshooting' }
]);

addCmds(CISCO_IOS, 'Config Management', [
  { cmd: 'copy running-config startup-config', desc: 'Save running to startup', type: 'config' },
  { cmd: 'write memory',                 desc: 'Alias for copy run start', type: 'config' },
  { cmd: 'copy running-config tftp://10.50.50.50/<host>.cfg', desc: 'Backup config to TFTP', type: 'config' },
  { cmd: 'archive\n path flash:archive-\n maximum 14\n write-memory\n time-period 1440', desc: 'Auto-archive config every 24h, keep 14', type: 'config' },
  { cmd: 'show archive',                 desc: 'Archived configurations available' },
  { cmd: 'configure replace flash:archive-1', desc: 'Atomic rollback to a saved config', type: 'config', flagged: true },
  { cmd: 'reload in 5',                  desc: 'Schedule a reload in 5 minutes', type: 'config', flagged: true },
  { cmd: 'reload cancel',                desc: 'Cancel a scheduled reload', type: 'config' }
]);

// --- 4b. Palo Alto PAN-OS — major expansion incl. richer Panorama ---------

const PA = P.paloalto;

addCmds(PA, 'System & Status', [
  { cmd: 'show jobs all',                      desc: 'All running and recent jobs (commits, downloads, etc.)' },
  { cmd: 'show jobs id <n>',                   desc: 'Detail for a specific job ID (incl. commit warnings)' },
  { cmd: 'show clock',                         desc: 'System date/time' },
  { cmd: 'show ntp',                           desc: 'NTP servers and sync state' },
  { cmd: 'show config running',                desc: 'Active running config (XML)' },
  { cmd: 'show config candidate',              desc: 'Pending config — will be applied on commit' },
  { cmd: 'show config diff',                   desc: 'Diff between candidate and running' },
  { cmd: 'show system disk-space',             desc: 'Filesystem free space' },
  { cmd: 'show system resources',              desc: 'Top-style live CPU/memory display' },
  { cmd: 'debug system maintenance-mode',      desc: 'Enter maintenance mode (TAC use)', type: 'troubleshooting', flagged: true }
]);

addCmds(PA, 'High Availability', [
  { cmd: 'show high-availability state',       desc: 'Local HA mode + peer state' },
  { cmd: 'show high-availability state-synchronization', desc: 'HA1/HA2 sync counters and last sync time' },
  { cmd: 'show high-availability link-monitoring', desc: 'Link-monitoring group state' },
  { cmd: 'show high-availability path-monitoring', desc: 'Path-monitoring group state' },
  { cmd: 'request high-availability state suspend', desc: 'Manually suspend this HA peer (failover testing)', type: 'config', flagged: true },
  { cmd: 'request high-availability state functional', desc: 'Re-enable HA after suspension', type: 'config' }
]);

addCmds(PA, 'GlobalProtect', [
  { cmd: 'show global-protect-portal current-portal', desc: 'Active GlobalProtect Portal config' },
  { cmd: 'show global-protect-gateway current-gateway', desc: 'Active GlobalProtect Gateway config' },
  { cmd: 'show global-protect-gateway current-user', desc: 'Connected GP users list' },
  { cmd: 'show global-protect-gateway statistics', desc: 'GP gateway statistics' },
  { cmd: 'show global-protect-gateway flow tunnel-id <n>', desc: 'GP tunnel detail' },
  { cmd: 'request global-protect-gateway client-logout user <user>', desc: 'Force-logout a single GP user', type: 'config' }
]);

addCmds(PA, 'SSL Decryption', [
  { cmd: 'show system setting ssl-decrypt setting', desc: 'Decryption global config' },
  { cmd: 'show system setting ssl-decrypt certificate', desc: 'Decryption forward-trust / forward-untrust certs' },
  { cmd: 'show system setting ssl-decrypt session-cache', desc: 'Decryption session cache stats' },
  { cmd: 'debug dataplane show ssl-decrypt session-summary', desc: 'Per-session decryption state', type: 'troubleshooting' },
  { cmd: 'debug dataplane show ssl-decrypt ssl-stats', desc: 'Decryption error counters', type: 'troubleshooting' }
]);

addCmds(PA, 'URL & Threat Updates', [
  { cmd: 'request content upgrade check',      desc: 'Check for new content (App-ID / Threat) updates' },
  { cmd: 'request content upgrade download latest', desc: 'Download latest content', type: 'config' },
  { cmd: 'request content upgrade install version latest', desc: 'Install latest content', type: 'config' },
  { cmd: 'request anti-virus upgrade install version latest', desc: 'Install latest AV signatures', type: 'config' },
  { cmd: 'request wildfire upgrade install version latest', desc: 'Install latest WildFire signatures', type: 'config' },
  { cmd: 'request url-filtering download status',  desc: 'PAN-DB seed download status' }
]);

addCmds(PA, 'Logging & Reports', [
  { cmd: 'show log traffic last-n 50',          desc: 'Last 50 traffic-log entries' },
  { cmd: 'show log threat last-n 50',           desc: 'Last 50 threat-log entries' },
  { cmd: 'show log system last-n 50',           desc: 'System log tail' },
  { cmd: 'show log config last-n 50',           desc: 'Config-change log tail' },
  { cmd: 'show counter global filter delta yes', desc: 'Live global counter deltas (firewall internals)' },
  { cmd: 'show counter global filter packet-filter yes', desc: 'Counters limited to active packet-filter' }
]);

// PANORAMA — substantial expansion of the existing thin section.
addCmds(PA, 'Panorama', [
  { cmd: 'show devicegroups',                  desc: 'List all device groups + their members' },
  { cmd: 'show devicegroups name <dg>',        desc: 'Detail for one device group' },
  { cmd: 'show templates',                     desc: 'All template configurations' },
  { cmd: 'show template-stack',                desc: 'Template stacks + template order' },
  { cmd: 'show devices all',                   desc: 'All managed firewalls — connection state, version, last commit' },
  { cmd: 'show devices connected',             desc: 'Currently-connected managed devices' },
  { cmd: 'show devices disconnected',          desc: 'Disconnected managed devices' },
  { cmd: 'show devices summary',               desc: 'Device counts by HA + sync state' },
  { cmd: 'show log-collector all',             desc: 'Log-Collector pool — disk, log rate, status' },
  { cmd: 'show log-collector connected',       desc: 'Online Log Collectors' },
  { cmd: 'show log-collector-group',           desc: 'Log-Collector groups + members' },
  { cmd: 'show log-collector preference-list', desc: 'Log-forwarding preference list per device' },
  { cmd: 'commit',                             desc: 'Commit pending Panorama config', type: 'config' },
  { cmd: 'commit-all shared-policy',           desc: 'Push policy to all device groups + their devices', type: 'config' },
  { cmd: 'commit-all shared-policy device-group <dg>', desc: 'Push policy to a single device group', type: 'config' },
  { cmd: 'commit-all template <tpl>',          desc: 'Push template config to its devices', type: 'config' },
  { cmd: 'commit-all template-stack <ts>',     desc: 'Push a template stack', type: 'config' },
  { cmd: 'request commit-status',              desc: 'Status of latest commit-all jobs' },
  { cmd: 'show jobs id <n>',                   desc: 'Per-job commit details + warnings' },
  { cmd: 'request batch software upgrade install file <pkg> devices ALL', desc: 'Push and install a PAN-OS image across managed devices', type: 'config', flagged: true },
  { cmd: 'request system software check',      desc: 'Check for available PAN-OS upgrades' },
  { cmd: 'request system software download version <ver>', desc: 'Download a PAN-OS version to Panorama', type: 'config' },
  { cmd: 'request system software install version <ver>', desc: 'Install on Panorama itself', type: 'config', flagged: true },
  { cmd: 'show panorama-status',               desc: 'Connection state of this firewall to Panorama (run on FW)' },
  { cmd: 'show config pushed-shared-policy',   desc: 'Last shared-policy push received from Panorama (run on FW)' },
  { cmd: 'show config pushed-template',        desc: 'Last template push received from Panorama (run on FW)' }
]);

// --- 5. New Cisco Nexus platform ------------------------------------------

P.nexus = {
  label: 'Cisco Nexus NX-OS',
  badge: 'badge-sw',
  short: 'Nexus',
  group: 'Cisco',
  sections: {}
};
const NEXUS = P.nexus;

addCmds(NEXUS, 'System & Status', [
  { cmd: 'show version',                desc: 'Software version, hardware, uptime' },
  { cmd: 'show inventory',              desc: 'Hardware inventory: chassis, modules, transceivers, serials' },
  { cmd: 'show module',                 desc: 'Line cards / supervisors / fabric modules with status' },
  { cmd: 'show environment',            desc: 'Power, fans, temperature' },
  { cmd: 'show environment power',      desc: 'PSU detail and budget' },
  { cmd: 'show running-config',         desc: 'Active configuration' },
  { cmd: 'show startup-config',         desc: 'Saved configuration' },
  { cmd: 'show feature',                desc: 'NX-OS features installed/enabled' },
  { cmd: 'show feature-set',            desc: 'Optional feature-sets (FCoE, FabricPath, MPLS)' },
  { cmd: 'show license host-id',        desc: 'License host ID required for activation' },
  { cmd: 'show license usage',          desc: 'Smart Licence current usage' },
  { cmd: 'show install all status',     desc: 'Install / upgrade history and status' },
  { cmd: 'show system internal flash',  desc: 'Bootflash usage' },
  { cmd: 'show clock detail',           desc: 'Current time + NTP source' },
  { cmd: 'show users',                  desc: 'Active sessions' }
]);

addCmds(NEXUS, 'Interfaces', [
  { cmd: 'show interface',              desc: 'Detailed interface status + counters' },
  { cmd: 'show interface brief',        desc: 'Short status table' },
  { cmd: 'show interface description',  desc: 'Per-interface description column' },
  { cmd: 'show interface status',       desc: 'Up/down, VLAN, duplex, speed, type' },
  { cmd: 'show interface counters errors', desc: 'Per-interface error counters' },
  { cmd: 'show interface transceiver details', desc: 'SFP DOM' },
  { cmd: 'show interface trunk',        desc: 'Active trunks + allowed VLANs' },
  { cmd: 'show running-config interface Ethernet1/1', desc: 'Per-interface running-config' },
  { cmd: 'interface Ethernet1/1\n description ACCESS\n switchport\n switchport mode access\n switchport access vlan 10\n no shutdown', desc: 'Access-port baseline', type: 'config' },
  { cmd: 'interface Ethernet1/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30\n switchport trunk native vlan 99', desc: 'Trunk-port baseline', type: 'config' },
  { cmd: 'interface port-channel1\n switchport\n switchport mode trunk', desc: 'Logical port-channel', type: 'config' },
  { cmd: 'interface Ethernet1/1\n channel-group 1 mode active', desc: 'Add interface to LACP port-channel', type: 'config' },
  { cmd: 'interface Ethernet1/49\n no switchport\n mtu 9216\n ip address 10.0.0.1/31\n no shutdown', desc: 'L3 routed point-to-point uplink', type: 'config' }
]);

addCmds(NEXUS, 'VLANs / VPC', [
  { cmd: 'show vlan',                   desc: 'VLANs + member ports' },
  { cmd: 'show vlan brief',             desc: 'Short VLAN table' },
  { cmd: 'show vpc',                    desc: 'vPC peer-link, peer-keepalive, vPCs, role' },
  { cmd: 'show vpc consistency-parameters global', desc: 'vPC global consistency check' },
  { cmd: 'show vpc consistency-parameters interface port-channel 10', desc: 'Per-vPC consistency check' },
  { cmd: 'show vpc role',               desc: 'vPC role (primary / secondary)' },
  { cmd: 'show port-channel summary',   desc: 'Port-channels: protocol, status, members' },
  { cmd: 'show fex',                    desc: 'Connected FEXs and link state (legacy)' },
  { cmd: 'feature vpc',                 desc: 'Enable vPC feature', type: 'config' },
  { cmd: 'feature lacp',                desc: 'Enable LACP feature', type: 'config' },
  { cmd: 'vpc domain 1\n peer-switch\n peer-keepalive destination 10.99.99.2 source 10.99.99.1\n peer-gateway\n delay restore 150\n auto-recovery', desc: 'vPC domain baseline', type: 'config' }
]);

addCmds(NEXUS, 'Routing', [
  { cmd: 'show ip route',               desc: 'IPv4 routing table' },
  { cmd: 'show ip route vrf <name>',    desc: 'Per-VRF routing table' },
  { cmd: 'show ip route summary',       desc: 'Route count summary by protocol' },
  { cmd: 'show ip ospf neighbors',      desc: 'OSPF adjacencies' },
  { cmd: 'show ip ospf interface brief', desc: 'OSPF on each interface' },
  { cmd: 'show ip ospf database',       desc: 'OSPF LSDB' },
  { cmd: 'show ip bgp summary',         desc: 'BGP peers, state, prefix counts' },
  { cmd: 'show ip bgp',                 desc: 'BGP RIB' },
  { cmd: 'show ip bgp neighbors <ip>',  desc: 'Per-peer detail' },
  { cmd: 'show ip pim neighbor',        desc: 'PIM neighbours' },
  { cmd: 'show ip pim interface',       desc: 'PIM-enabled interfaces' },
  { cmd: 'feature ospf',                desc: 'Enable OSPF feature', type: 'config' },
  { cmd: 'feature bgp',                 desc: 'Enable BGP feature', type: 'config' },
  { cmd: 'feature pim',                 desc: 'Enable PIM feature', type: 'config' },
  { cmd: 'router ospf UNDERLAY\n router-id 1.1.1.1\n log-adjacency-changes detail\n bfd', desc: 'OSPF process baseline', type: 'config' },
  { cmd: 'router bgp 65001\n router-id 1.1.1.1\n log-neighbor-changes\n address-family ipv4 unicast\n neighbor 1.2.3.4\n  remote-as 65002\n  address-family ipv4 unicast\n   send-community both', desc: 'eBGP peer baseline', type: 'config' },
  { cmd: 'vrf context TENANT_A\n description Tenant A\n rd auto\n address-family ipv4 unicast\n  route-target both auto', desc: 'New VRF', type: 'config' }
]);

addCmds(NEXUS, 'VXLAN / EVPN', [
  { cmd: 'show nve interface nve1 detail', desc: 'NVE interface state + source loopback' },
  { cmd: 'show nve peers',              desc: 'VTEP peers + uptime' },
  { cmd: 'show nve vni',                desc: 'Per-VNI state + ingress-replication peers' },
  { cmd: 'show nve vni interface',      desc: 'NVE per-VNI binding' },
  { cmd: 'show bgp l2vpn evpn summary', desc: 'BGP EVPN sessions' },
  { cmd: 'show bgp l2vpn evpn',         desc: 'BGP EVPN routes (all)' },
  { cmd: 'show bgp l2vpn evpn route-type 2', desc: 'Type-2 MAC/IP advertisements' },
  { cmd: 'show bgp l2vpn evpn route-type 5', desc: 'Type-5 IP-prefix advertisements' },
  { cmd: 'show l2route evpn mac all',   desc: 'Local EVPN MAC table' },
  { cmd: 'show l2route evpn mac-ip all', desc: 'Local EVPN MAC + IP bindings' },
  { cmd: 'show ip arp suppression-cache detail', desc: 'ARP-suppression cache state' },
  { cmd: 'feature nv overlay',          desc: 'Enable VXLAN overlay feature', type: 'config' },
  { cmd: 'feature vn-segment-vlan-based', desc: 'Enable VLAN→VNI mapping', type: 'config' },
  { cmd: 'fabric forwarding anycast-gateway-mac 0001.0001.0001', desc: 'Set fabric anycast gateway MAC', type: 'config' },
  { cmd: 'interface nve1\n no shutdown\n host-reachability protocol bgp\n source-interface loopback0\n member vni 10100\n  suppress-arp\n  ingress-replication protocol bgp\n member vni 50001 associate-vrf', desc: 'NVE interface baseline', type: 'config' }
]);

addCmds(NEXUS, 'Security & AAA', [
  { cmd: 'show access-lists',           desc: 'All ACLs' },
  { cmd: 'show ip access-lists EXAMPLE', desc: 'Single ACL detail with hit counts' },
  { cmd: 'show aaa authentication',     desc: 'AAA authentication methods configured' },
  { cmd: 'show aaa server-groups',      desc: 'TACACS+/RADIUS server groups' },
  { cmd: 'show role',                   desc: 'NX-OS RBAC roles' },
  { cmd: 'show user-account',           desc: 'Configured user accounts + roles' },
  { cmd: 'feature tacacs+',             desc: 'Enable TACACS+ feature', type: 'config' },
  { cmd: 'tacacs-server host 10.10.10.50 key <shared-key>\naaa group server tacacs+ TAC\n server 10.10.10.50\n use-vrf management', desc: 'TACACS+ server group', type: 'config' },
  { cmd: 'aaa authentication login default group TAC local', desc: 'Login auth via TACACS+ then local fallback', type: 'config' }
]);

addCmds(NEXUS, 'Logging / Monitoring', [
  { cmd: 'show logging logfile',        desc: 'Persistent local log file contents' },
  { cmd: 'show logging last 100',       desc: 'Last 100 log lines from buffer' },
  { cmd: 'show logging server',         desc: 'Configured syslog destinations' },
  { cmd: 'show snmp community',         desc: 'SNMP communities' },
  { cmd: 'show snmp host',              desc: 'SNMP trap receivers' },
  { cmd: 'logging server 10.50.50.50 6 use-vrf management', desc: 'Send syslog at severity 6 over mgmt VRF', type: 'config' },
  { cmd: 'snmp-server host 10.50.50.50 traps version 3 priv <user>', desc: 'SNMPv3 trap host', type: 'config' },
  { cmd: 'feature telemetry\ntelemetry\n destination-group DG1\n  ip address 10.50.50.50 port 57500 protocol gRPC encoding GPB\n sensor-group SG1\n  data-source DME\n  path "Cisco-NX-OS-device-yang:sys/intf"\n subscription 1\n  dst-grp DG1\n  snsr-grp SG1 sample-interval 30000', desc: 'Streaming telemetry baseline', type: 'config' }
]);

addCmds(NEXUS, 'Diagnostics', [
  { cmd: 'ping 1.1.1.1 vrf management',  desc: 'Ping via management VRF' },
  { cmd: 'ping 1.1.1.1 source 10.0.0.1', desc: 'Sourced ping' },
  { cmd: 'traceroute 1.1.1.1 vrf management', desc: 'Traceroute via management VRF' },
  { cmd: 'show ip arp',                  desc: 'ARP cache' },
  { cmd: 'show mac address-table',       desc: 'MAC address table' },
  { cmd: 'show mac address-table address 0050.5612.3456', desc: 'Find a single MAC' },
  { cmd: 'show cdp neighbors detail',    desc: 'CDP neighbours' },
  { cmd: 'show lldp neighbors detail',   desc: 'LLDP neighbours' },
  { cmd: 'show bfd neighbors',           desc: 'BFD sessions' },
  { cmd: 'show forwarding adjacency',    desc: 'Hardware adjacency table' },
  { cmd: 'ethanalyzer local interface inband decode-internal', desc: 'On-box packet capture (use sparingly)', type: 'troubleshooting' },
  { cmd: 'show tech-support detail | redirect bootflash:tech.txt', desc: 'Full diagnostic dump for TAC', type: 'troubleshooting' },
  { cmd: 'show system internal sysmgr service all', desc: 'NX-OS service-manager state', type: 'troubleshooting' }
]);

addCmds(NEXUS, 'Config Management', [
  { cmd: 'copy running-config startup-config', desc: 'Save running to startup', type: 'config' },
  { cmd: 'copy running-config bootflash:running.cfg', desc: 'Save running to bootflash file', type: 'config' },
  { cmd: 'copy running-config tftp://10.50.50.50/<host>.cfg vrf management', desc: 'Backup config via TFTP over mgmt VRF', type: 'config' },
  { cmd: 'show running-config diff',     desc: 'Diff between saved + current candidate (NX-OS commit-mode)' },
  { cmd: 'configure dual-stage\n!! enter changes\nshow configuration\ncommit',  desc: 'Two-stage commit (preview → apply)', type: 'config' },
  { cmd: 'rollback running-config last 1', desc: 'Roll back to the previous commit', type: 'config', flagged: true },
  { cmd: 'reload',                       desc: 'Reboot the device', type: 'config', flagged: true }
]);

// --- Save -----------------------------------------------------------------

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

// Also bump the manifest timestamp so the SW invalidates commands.json.
const MAN = path.resolve('data/manifest.json');
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

// Quick stats.
let totalCmds = 0, perPlat = {};
for (const [k, p] of Object.entries(P)) {
  let n = 0;
  for (const sec of Object.values(p.sections || {})) n += sec.length;
  perPlat[k] = n;
  totalCmds += n;
}
console.log('Total commands:', totalCmds);
console.log('Platforms:', Object.keys(P).length);
console.log('Per platform:', perPlat);
console.log('Done.');
