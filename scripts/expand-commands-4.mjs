// Add three Aruba platforms to commands.json:
//   - aruba_cx     — Aruba AOS-CX switches (CX 6000/6300/8000-series, etc.)
//   - aruba_ap     — Aruba Instant / standalone AP CLI
//   - aruba_wlc    — ArubaOS Mobility Controller (7000/7200/9000-series)
//
// Run: node scripts/expand-commands-4.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const P = data.platforms;

function ensurePlatform(key, meta) {
  if (!P[key]) P[key] = { ...meta, sections: {} };
  else Object.assign(P[key], meta);
  return P[key];
}

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

// ===========================================================================
// 1. Aruba AOS-CX  (modern data-centre / campus switches)
// ===========================================================================

const CX = ensurePlatform('aruba_cx', {
  label: 'Aruba AOS-CX',
  badge: 'badge-aruba',
  short: 'AOS-CX',
  group: 'Aruba'
});

addCmds(CX, 'System & Status', [
  { cmd: 'show version',              desc: 'Software image, version, build, uptime, last reload reason' },
  { cmd: 'show system',               desc: 'System name/contact/location + chassis info' },
  { cmd: 'show system resource-utilization', desc: 'CPU, memory, daemon resource counters' },
  { cmd: 'show inventory',            desc: 'Hardware inventory: chassis, modules, transceivers, serials' },
  { cmd: 'show environment temperature', desc: 'Temperature sensors per module' },
  { cmd: 'show environment fan',      desc: 'Fan tray status / RPM' },
  { cmd: 'show environment power-supply', desc: 'Power-supply status, current draw, capacity' },
  { cmd: 'show running-config',       desc: 'Active configuration' },
  { cmd: 'show running-config interface 1/1/1', desc: 'Per-interface running-config' },
  { cmd: 'show startup-config',       desc: 'Saved configuration' },
  { cmd: 'show events',               desc: 'System event log (info / warn / err)' },
  { cmd: 'show events -d ALL -s warning', desc: 'Filter event log by minimum severity' },
  { cmd: 'show clock',                desc: 'Current date/time + source (NTP / manual)' },
  { cmd: 'show users',                desc: 'Active sessions (console, SSH, REST)' },
  { cmd: 'show capacities',           desc: 'Hardware-table capacities (MAC, ARP, route, ACL)' },
  { cmd: 'show capacities-status',    desc: 'Current usage of those tables' },
  { cmd: 'show feature',              desc: 'Optional features installed/enabled' }
]);

addCmds(CX, 'Interfaces', [
  { cmd: 'show interface',            desc: 'Detailed status, duplex, speed, counters' },
  { cmd: 'show interface brief',      desc: 'Short interface status table' },
  { cmd: 'show interface 1/1/1',      desc: 'Single-interface detail' },
  { cmd: 'show interface 1/1/1 transceiver', desc: 'SFP/SFP+ DOM (Tx/Rx power, temp, vendor)' },
  { cmd: 'show interface error-counters', desc: 'Error counters per interface' },
  { cmd: 'show lldp neighbors',       desc: 'LLDP neighbour table' },
  { cmd: 'show lldp neighbors detail', desc: 'Full LLDP detail' },
  { cmd: 'show lldp interface',       desc: 'LLDP per-interface state' },
  { cmd: 'show poe-power',            desc: 'PoE budget summary' },
  { cmd: 'show poe-power interface 1/1/1', desc: 'Per-interface PoE state' },
  { cmd: 'interface 1/1/1\n description ACCESS\n vlan access 10\n no shutdown', desc: 'Access-port baseline', type: 'config' },
  { cmd: 'interface 1/1/24\n description TRUNK\n no shutdown\n no routing\n vlan trunk native 99\n vlan trunk allowed 10,20,30', desc: 'Trunk port baseline', type: 'config' },
  { cmd: 'interface 1/1/49\n no shutdown\n routing\n ip address 10.0.0.1/31\n mtu 9216', desc: 'L3 routed point-to-point uplink', type: 'config' },
  { cmd: 'interface lag 1\n no shutdown\n no routing\n vlan trunk allowed 10,20,30\n lacp mode active', desc: 'LACP LAG (port-channel)', type: 'config' },
  { cmd: 'interface 1/1/49\n lag 1', desc: 'Add a member port to LAG 1', type: 'config' },
  { cmd: 'shutdown',                  desc: 'Disable an interface', type: 'config' },
  { cmd: 'no shutdown',               desc: 'Enable an interface', type: 'config' }
]);

addCmds(CX, 'VLANs', [
  { cmd: 'show vlan',                 desc: 'All VLANs + member ports' },
  { cmd: 'show vlan 10',              desc: 'Single-VLAN detail' },
  { cmd: 'show vlan summary',         desc: 'VLAN counts + active range' },
  { cmd: 'vlan 10\n name DATA',       desc: 'Create a VLAN', type: 'config' },
  { cmd: 'vlan 10-20',                desc: 'Create a VLAN range', type: 'config' },
  { cmd: 'no vlan 10',                desc: 'Delete a VLAN', type: 'config', flagged: true }
]);

addCmds(CX, 'Spanning Tree', [
  { cmd: 'show spanning-tree',        desc: 'STP summary (root, mode)' },
  { cmd: 'show spanning-tree detail', desc: 'Full per-port STP details' },
  { cmd: 'show spanning-tree mst',    desc: 'MSTP per-instance state' },
  { cmd: 'show spanning-tree mst configuration', desc: 'MSTP region config (name, revision, VLAN-to-instance)' },
  { cmd: 'show spanning-tree statistics', desc: 'STP BPDU counters' },
  { cmd: 'spanning-tree mode mstp',   desc: 'Switch to MSTP', type: 'config' },
  { cmd: 'spanning-tree config-name CORP\nspanning-tree config-revision 1\nspanning-tree instance 1 vlan 10,20', desc: 'MSTP region + instance mapping', type: 'config' },
  { cmd: 'interface 1/1/1\n spanning-tree port-type admin-edge\n spanning-tree bpdu-guard', desc: 'Edge port + BPDU Guard', type: 'config' }
]);

addCmds(CX, 'L3 Routing', [
  { cmd: 'show ip route',             desc: 'IPv4 routing table (default VRF)' },
  { cmd: 'show ip route vrf <name>',  desc: 'Per-VRF routing table' },
  { cmd: 'show ip route summary',     desc: 'Route counts by protocol' },
  { cmd: 'show ip arp',               desc: 'ARP cache' },
  { cmd: 'show ipv6 route',           desc: 'IPv6 routing table' },
  { cmd: 'show ipv6 neighbors',       desc: 'IPv6 neighbour discovery cache' },
  { cmd: 'show ip ospf',              desc: 'OSPF process state' },
  { cmd: 'show ip ospf neighbor',     desc: 'OSPF adjacencies' },
  { cmd: 'show ip ospf interface',    desc: 'Per-interface OSPF state' },
  { cmd: 'show bgp ipv4 unicast summary', desc: 'BGP IPv4 peers + prefix counts' },
  { cmd: 'show bgp ipv4 unicast',     desc: 'BGP IPv4 RIB' },
  { cmd: 'show bgp ipv4 unicast neighbors', desc: 'BGP IPv4 per-peer detail' },
  { cmd: 'ip route 0.0.0.0/0 1.1.1.1 distance 1 vrf default', desc: 'Static default route', type: 'config' },
  { cmd: 'router ospf 1\n router-id 1.1.1.1\n area 0.0.0.0\n!\ninterface 1/1/49\n ip ospf 1 area 0.0.0.0', desc: 'Single-area OSPF baseline', type: 'config' },
  { cmd: 'router bgp 65001\n bgp router-id 1.1.1.1\n neighbor 1.2.3.4 remote-as 65002\n address-family ipv4 unicast\n  neighbor 1.2.3.4 activate', desc: 'eBGP peer baseline', type: 'config' }
]);

addCmds(CX, 'VRF', [
  { cmd: 'show vrf',                  desc: 'List configured VRFs' },
  { cmd: 'show vrf <name>',           desc: 'Per-VRF configuration + interfaces' },
  { cmd: 'vrf <name>',                desc: 'Create / enter a VRF', type: 'config' },
  { cmd: 'interface 1/1/1\n vrf attach <name>', desc: 'Place interface in VRF', type: 'config' }
]);

addCmds(CX, 'VSX / VSF', [
  { cmd: 'show vsx status',           desc: 'VSX peer status, ISL state, role' },
  { cmd: 'show vsx config-consistency', desc: 'Consistency check between VSX peers' },
  { cmd: 'show vsx active-forwarding', desc: 'Active-forwarding decision per VSX MAC' },
  { cmd: 'show vsx brief',            desc: 'Brief VSX summary' },
  { cmd: 'show vsf',                  desc: 'Stack member status (VSF on CX 62/63xx)' },
  { cmd: 'show vsf detail',           desc: 'Detailed stack diagnostics' },
  { cmd: 'show vsf topology',         desc: 'VSF stacking topology + ports' },
  { cmd: 'vsx\n inter-switch-link lag 256\n role primary\n keepalive peer 10.99.99.2 source 10.99.99.1', desc: 'VSX baseline on the primary peer', type: 'config' }
]);

addCmds(CX, 'ACLs', [
  { cmd: 'show access-list',          desc: 'All ACLs' },
  { cmd: 'show access-list ip <name>', desc: 'Single ACL detail' },
  { cmd: 'show access-list hitcounts ip <name>', desc: 'Per-rule hit counts' },
  { cmd: 'access-list ip ALLOW_WEB\n 10 permit tcp any any eq 443\n 20 permit tcp any any eq 80\n 30 deny any any any log', desc: 'Named ACL with logged deny', type: 'config' },
  { cmd: 'interface 1/1/1\n apply access-list ip ALLOW_WEB in', desc: 'Apply ACL inbound', type: 'config' }
]);

addCmds(CX, 'Security & AAA', [
  { cmd: 'show user-list',            desc: 'Configured local users + roles' },
  { cmd: 'show users',                desc: 'Active sessions' },
  { cmd: 'show aaa authentication',   desc: 'AAA authentication source order' },
  { cmd: 'show aaa server-groups',    desc: 'TACACS+/RADIUS server groups' },
  { cmd: 'show port-access clients',  desc: '802.1X / MAC-auth client sessions' },
  { cmd: 'show port-access role',     desc: 'Configured downloadable user roles' },
  { cmd: 'tacacs-server host 10.10.10.50 key plaintext <key>', desc: 'TACACS+ server', type: 'config' },
  { cmd: 'aaa group server tacacs+ TAC\n server 10.10.10.50', desc: 'Server group', type: 'config' },
  { cmd: 'aaa authentication login default group TAC local', desc: 'Login auth: TACACS first, local fallback', type: 'config' },
  { cmd: 'user admin password plaintext <pwd> role administrators', desc: 'Local admin user', type: 'config' }
]);

addCmds(CX, 'QoS', [
  { cmd: 'show qos schedule-profile', desc: 'Schedule profile (egress queue scheduling)' },
  { cmd: 'show qos queue-profile',    desc: 'Queue profile' },
  { cmd: 'show class',                desc: 'Defined classes' },
  { cmd: 'show policy',               desc: 'Defined policies' },
  { cmd: 'show policy hitcounts',     desc: 'Policy hit counts' },
  { cmd: 'qos trust dscp',            desc: 'Globally trust DSCP', type: 'config' },
  { cmd: 'class ip VOICE\n 10 match dscp 46\n!\npolicy MARK\n class VOICE\n  action mark dscp 46', desc: 'Class + policy baseline', type: 'config' }
]);

addCmds(CX, 'Logging & Telemetry', [
  { cmd: 'show events',               desc: 'Event log' },
  { cmd: 'show audit-trail',          desc: 'CLI audit trail (who ran what)' },
  { cmd: 'show ntp status',           desc: 'NTP sync state' },
  { cmd: 'show ntp associations',     desc: 'NTP peers + offset' },
  { cmd: 'show snmp',                 desc: 'SNMP server config' },
  { cmd: 'show snmp community',       desc: 'SNMP communities' },
  { cmd: 'logging 10.50.50.50 severity warning', desc: 'Send syslog to a remote host', type: 'config' },
  { cmd: 'ntp server 10.10.10.10\nntp enable', desc: 'NTP client baseline', type: 'config' }
]);

addCmds(CX, 'Diagnostics', [
  { cmd: 'ping 1.1.1.1',              desc: 'IPv4 ping' },
  { cmd: 'ping 1.1.1.1 source-interface loopback0', desc: 'Sourced ping' },
  { cmd: 'traceroute 1.1.1.1',        desc: 'Traceroute' },
  { cmd: 'show mac-address-table',    desc: 'MAC address table' },
  { cmd: 'show mac-address-table address 0050.5612.3456', desc: 'Find one MAC' },
  { cmd: 'show ip dhcp-snooping',     desc: 'DHCP snooping global state' },
  { cmd: 'show ip dhcp-snooping binding', desc: 'DHCP snooping bindings DB' },
  { cmd: 'diag-dump',                 desc: 'Capture diagnostic dump (TAC use)', type: 'troubleshooting' },
  { cmd: 'show tech',                 desc: 'Full diagnostic bundle for TAC', type: 'troubleshooting' },
  { cmd: 'show tech | redirect tftp://10.50.50.50/tech.txt', desc: 'Stream show tech to TFTP', type: 'troubleshooting' },
  { cmd: 'mirror session 1\n source interface 1/1/1 both\n destination interface 1/1/47\n no shutdown', desc: 'Port mirror (SPAN)', type: 'config' }
]);

addCmds(CX, 'Config Management', [
  { cmd: 'copy running-config startup-config', desc: 'Save running to startup', type: 'config' },
  { cmd: 'write memory',              desc: 'Alias for copy running-config startup-config', type: 'config' },
  { cmd: 'checkpoint create CHK1',    desc: 'Create a named config checkpoint', type: 'config' },
  { cmd: 'show checkpoint list',      desc: 'List checkpoints' },
  { cmd: 'show checkpoint diff CHK1 startup-config', desc: 'Diff checkpoint vs startup', type: 'config' },
  { cmd: 'checkpoint rollback CHK1',  desc: 'Roll back to a checkpoint', type: 'config', flagged: true },
  { cmd: 'copy running-config tftp://10.50.50.50/<host>.cfg', desc: 'Backup config to TFTP', type: 'config' },
  { cmd: 'boot system primary',       desc: 'Boot from primary firmware on next reload', type: 'config' },
  { cmd: 'boot set-default secondary', desc: 'Set secondary partition as default', type: 'config' },
  { cmd: 'reboot',                    desc: 'Reboot the switch', type: 'config', flagged: true }
]);

addCmds(CX, 'REST API & Automation', [
  { cmd: 'show api session',          desc: 'Active REST API sessions' },
  { cmd: 'show ssh server',           desc: 'SSH server config + active sessions' },
  { cmd: 'https-server rest access-mode read-write', desc: 'Enable REST read-write access', type: 'config' },
  { cmd: 'https-server vrf mgmt',     desc: 'Bind REST to mgmt VRF', type: 'config' },
  { cmd: 'show telemetry',            desc: 'gNMI streaming telemetry state' }
]);

// ===========================================================================
// 2. ArubaOS Mobility Controller (ArubaOS 8.x)
// ===========================================================================

const WLC = ensurePlatform('aruba_wlc', {
  label: 'Aruba Mobility Controller (ArubaOS)',
  badge: 'badge-aruba',
  short: 'Aruba MC',
  group: 'Aruba'
});

addCmds(WLC, 'System & Status', [
  { cmd: 'show version',              desc: 'ArubaOS version, model, uptime, build' },
  { cmd: 'show inventory',            desc: 'Hardware inventory + serials' },
  { cmd: 'show running-config',       desc: 'Active configuration' },
  { cmd: 'show switches',             desc: 'Mobility Master + Mobility Controllers in cluster' },
  { cmd: 'show switchinfo',           desc: 'Local switch identity, role, MAC' },
  { cmd: 'show clock',                desc: 'Current date/time + source' },
  { cmd: 'show country',              desc: 'Configured regulatory country' },
  { cmd: 'show license',              desc: 'Installed licences (AP, PEFNG, MM, etc.)' },
  { cmd: 'show license-usage ap',     desc: 'AP licence consumption' },
  { cmd: 'show license-usage user',   desc: 'User licence consumption' },
  { cmd: 'show cpuload',              desc: 'CPU utilisation' },
  { cmd: 'show memory',               desc: 'Memory usage' },
  { cmd: 'show storage',              desc: 'Filesystem usage' },
  { cmd: 'show keys all',             desc: 'Cryptographic keys installed' },
  { cmd: 'show airwave',              desc: 'AirWave / Central management state' }
]);

addCmds(WLC, 'AP Management', [
  { cmd: 'show ap database',          desc: 'All known APs + status, group, IP, model' },
  { cmd: 'show ap database long',     desc: 'AP DB with extra columns (version, location)' },
  { cmd: 'show ap active',            desc: 'Currently up APs' },
  { cmd: 'show ap details ap-name <name>', desc: 'Per-AP detailed info' },
  { cmd: 'show ap radio-summary',     desc: 'Per-radio summary across all APs' },
  { cmd: 'show ap radio-summary ap-name <name>', desc: 'Single-AP radio summary' },
  { cmd: 'show ap radio-database',    desc: 'Radio/channel per AP' },
  { cmd: 'show ap config ap-name <name>', desc: 'Effective config applied to an AP' },
  { cmd: 'show ap arm-history ap-name <name>', desc: 'ARM channel/power change history' },
  { cmd: 'show ap snr-info ap-name <name> radio 0', desc: 'Per-radio SNR data' },
  { cmd: 'show ap monitor active-laser-beams ap-name <name>', desc: 'Spectrum / interference detail' },
  { cmd: 'show ap remote debug magic-number ap-name <name>', desc: 'Get debug magic for the AP CLI' },
  { cmd: 'show ap profile-usage ap-name <name>', desc: 'Profiles applied to this AP' },
  { cmd: 'show ap group',             desc: 'AP groups' },
  { cmd: 'show ap-group <name>',      desc: 'Per-group config' },
  { cmd: 'show ap lms-distribution',  desc: 'AP-to-LMS controller assignments' }
]);

addCmds(WLC, 'WLAN & SSID', [
  { cmd: 'show wlan ssid-profile',    desc: 'List SSID profiles' },
  { cmd: 'show wlan ssid-profile <name>', desc: 'SSID profile detail' },
  { cmd: 'show wlan virtual-ap',      desc: 'Virtual-AP profiles (SSID + AAA + radio binding)' },
  { cmd: 'show wlan virtual-ap <name>', desc: 'Single virtual-AP profile' },
  { cmd: 'show aaa profile',          desc: 'AAA profiles (auth + accounting binding)' },
  { cmd: 'show aaa profile <name>',   desc: 'Single AAA profile' },
  { cmd: 'show ap-group <name>',      desc: 'AP-group + bound virtual-APs' }
]);

addCmds(WLC, 'Clients & Users', [
  { cmd: 'show user',                 desc: 'Connected users (brief)' },
  { cmd: 'show user-table',           desc: 'Connected users with roles + APs' },
  { cmd: 'show user-table verbose',   desc: 'Verbose user-table with timers + classifications' },
  { cmd: 'show user mac <mac>',       desc: 'Single client by MAC' },
  { cmd: 'show user ip <ip>',         desc: 'Single client by IP' },
  { cmd: 'show user role <role>',     desc: 'Users assigned to a particular role' },
  { cmd: 'show user-table essid <ssid>', desc: 'Users on a specific SSID' },
  { cmd: 'show roaming',              desc: 'Roaming events history' },
  { cmd: 'show client-roaming-history mac <mac>', desc: 'Per-client roaming history' },
  { cmd: 'aaa user delete mac <mac>', desc: 'Force-disconnect a client by MAC', type: 'config' }
]);

addCmds(WLC, 'RF / ARM / AirMatch', [
  { cmd: 'show ap arm rf-summary',    desc: 'ARM RF summary across all radios' },
  { cmd: 'show ap arm scan-times',    desc: 'Per-AP scan timing' },
  { cmd: 'show ap arm history',       desc: 'Cluster-wide ARM history' },
  { cmd: 'show ap arm client-match-history', desc: 'ClientMatch steering history' },
  { cmd: 'show ap arm client-match-summary', desc: 'ClientMatch summary' },
  { cmd: 'show ap arm channel-balance', desc: 'Channel balance / co-channel summary' },
  { cmd: 'show ap channel ap-name <name>', desc: 'Per-AP current channel + power' },
  { cmd: 'show airmatch report ap-name <name>', desc: 'AirMatch optimisation report for an AP' },
  { cmd: 'show airmatch event radar', desc: 'AirMatch radar (DFS) event log' }
]);

addCmds(WLC, 'Authentication / RADIUS', [
  { cmd: 'show aaa',                  desc: 'AAA global config' },
  { cmd: 'show aaa server',           desc: 'AAA servers (RADIUS / TACACS / LDAP)' },
  { cmd: 'show aaa rad-server-debug', desc: 'RADIUS server debug counters' },
  { cmd: 'show aaa authentication-server radius', desc: 'RADIUS server detail + reachability' },
  { cmd: 'show aaa state user mac <mac>', desc: 'AAA state for a user' },
  { cmd: 'show aaa profile <name>',   desc: 'Per-profile AAA bindings' },
  { cmd: 'aaa authentication-server radius <name>\n host 10.10.10.50\n key <key>', desc: 'Define a RADIUS server', type: 'config' }
]);

addCmds(WLC, 'Cluster (8.x AOS)', [
  { cmd: 'show lc-cluster group-membership', desc: 'L2 connected MC cluster members' },
  { cmd: 'show lc-cluster heartbeat', desc: 'Heartbeat counters between cluster members' },
  { cmd: 'show lc-cluster ap',        desc: 'AP-to-MC cluster mapping' },
  { cmd: 'show lc-cluster vlan-probe-status', desc: 'VLAN probe status (L2-connectivity test)' },
  { cmd: 'show ap lms ap-name <name>', desc: 'AP active-LMS / standby-LMS' }
]);

addCmds(WLC, 'Mesh', [
  { cmd: 'show ap mesh active',       desc: 'Active mesh APs' },
  { cmd: 'show ap mesh topology',     desc: 'Mesh tree topology' },
  { cmd: 'show ap mesh link ap-name <name>', desc: 'Per-AP mesh link metrics' },
  { cmd: 'show ap mesh neighbors ap-name <name>', desc: 'Per-AP mesh neighbours' }
]);

addCmds(WLC, 'Firewall (PEF) & Roles', [
  { cmd: 'show acl',                  desc: 'Configured ACLs' },
  { cmd: 'show acl ace <id>',         desc: 'ACE detail' },
  { cmd: 'show user-table verbose role <role>', desc: 'Users currently in a role' },
  { cmd: 'show rights <role>',        desc: 'Rights / firewall policies for a role' },
  { cmd: 'show datapath session',     desc: 'Active dataplane firewall sessions' },
  { cmd: 'show datapath session table | include <ip>', desc: 'Filter sessions for one IP' },
  { cmd: 'show datapath session counters', desc: 'Datapath session-table counters' }
]);

addCmds(WLC, 'Logging & Diagnostics', [
  { cmd: 'show log all 50',           desc: 'Last 50 log entries (all categories)' },
  { cmd: 'show log security 50',      desc: 'Security log tail' },
  { cmd: 'show log user-debug 50',    desc: 'User-debug tail' },
  { cmd: 'show log system 50',        desc: 'System log tail' },
  { cmd: 'show log errorlog 50',      desc: 'Error log tail' },
  { cmd: 'logging arm-user',          desc: 'Enable per-user ARM logs', type: 'config' },
  { cmd: 'logging level debugging user mac <mac>', desc: 'Debug-level logs for one MAC', type: 'troubleshooting' },
  { cmd: 'show ap remote debug client-trace ap-name <name>', desc: 'Per-client debug trace from the AP', type: 'troubleshooting' },
  { cmd: 'show tech-support',         desc: 'Full diagnostic bundle for TAC', type: 'troubleshooting' },
  { cmd: 'show tech-support | include error', desc: 'Filter tech-support to error lines', type: 'troubleshooting' }
]);

addCmds(WLC, 'Config Management', [
  { cmd: 'write memory',              desc: 'Save running-config to flash', type: 'config' },
  { cmd: 'copy running-config flash:bkp.cfg', desc: 'Save running-config to a named file', type: 'config' },
  { cmd: 'copy flash:bkp.cfg tftp 10.50.50.50 bkp.cfg', desc: 'Push backup config to TFTP', type: 'config' },
  { cmd: 'show image version',        desc: 'Installed image partitions + which is active' },
  { cmd: 'copy ftp 10.50.50.50 admin <pwd> arubaos.ari system: partition 1', desc: 'Stage ArubaOS image into partition 1', type: 'config' },
  { cmd: 'reload',                    desc: 'Reboot the controller', type: 'config', flagged: true },
  { cmd: 'reload at 02:00',           desc: 'Schedule a reload', type: 'config', flagged: true }
]);

// ===========================================================================
// 3. Aruba AP / Instant CLI
// ===========================================================================

const AP = ensurePlatform('aruba_ap', {
  label: 'Aruba AP / Instant',
  badge: 'badge-aruba',
  short: 'Aruba AP',
  group: 'Aruba'
});

addCmds(AP, 'System & Status', [
  { cmd: 'show version',              desc: 'AP image version + uptime' },
  { cmd: 'show summary',              desc: 'Cluster summary (Instant)' },
  { cmd: 'show running-config',       desc: 'Active configuration' },
  { cmd: 'show ap-env',               desc: 'AP environment variables (provisioning state)' },
  { cmd: 'show clock',                desc: 'Current date/time' },
  { cmd: 'show country',              desc: 'Regulatory country setting' },
  { cmd: 'show inventory',            desc: 'Hardware inventory + serial' },
  { cmd: 'show memory',               desc: 'Memory usage' },
  { cmd: 'show stats',                desc: 'AP-level traffic stats' },
  { cmd: 'show tech-support',         desc: 'Full diagnostic bundle', type: 'troubleshooting' }
]);

addCmds(AP, 'Network', [
  { cmd: 'show ip interface brief',   desc: 'IP addresses on AP interfaces' },
  { cmd: 'show vlan',                 desc: 'VLANs known to the AP' },
  { cmd: 'show port status',          desc: 'AP wired-port status (E0/E1/...)' },
  { cmd: 'show interface brief',      desc: 'Interface brief' },
  { cmd: 'ping 1.1.1.1',              desc: 'Ping' },
  { cmd: 'traceroute 1.1.1.1',        desc: 'Traceroute' }
]);

addCmds(AP, 'Wireless / SSID', [
  { cmd: 'show network',              desc: 'SSIDs configured (Instant)' },
  { cmd: 'show ssid',                 desc: 'SSID list' },
  { cmd: 'show ap radio-summary',     desc: 'Radio summary on this AP' },
  { cmd: 'show ap channel',           desc: 'Current channel + power per radio' },
  { cmd: 'show ap arm-history',       desc: 'ARM channel/power change history' },
  { cmd: 'show ap monitor scan-info', desc: 'Most recent scan results' }
]);

addCmds(AP, 'Clients', [
  { cmd: 'show clients',              desc: 'Connected clients (Instant)' },
  { cmd: 'show client mac <mac>',     desc: 'Single-client detail' },
  { cmd: 'show user-table',           desc: 'Detailed user table' },
  { cmd: 'show client roaming-history', desc: 'Roaming history' },
  { cmd: 'aaa user delete mac <mac>', desc: 'Force-disconnect a client', type: 'config' }
]);

addCmds(AP, 'Cluster (Instant)', [
  { cmd: 'show cluster',              desc: 'Cluster members + roles (conductor / member)' },
  { cmd: 'show cluster-info',         desc: 'Cluster details' },
  { cmd: 'show conductor',            desc: 'Conductor (formerly master) AP info' },
  { cmd: 'show summary support',      desc: 'Support summary including cluster' }
]);

addCmds(AP, 'Mesh', [
  { cmd: 'show ap mesh-link',         desc: 'This AP\'s mesh link state' },
  { cmd: 'show ap mesh-topology',     desc: 'Mesh tree from this AP' },
  { cmd: 'show ap mesh-counters',     desc: 'Mesh-link counters' }
]);

addCmds(AP, 'Diagnostics', [
  { cmd: 'show log',                  desc: 'AP log tail' },
  { cmd: 'show log debug',            desc: 'Debug log tail' },
  { cmd: 'show ap debug counters',    desc: 'Per-AP packet counters' },
  { cmd: 'show ap debug radio-stats 0', desc: 'Radio 0 detailed stats', type: 'troubleshooting' },
  { cmd: 'show ap debug radio-stats 1', desc: 'Radio 1 detailed stats', type: 'troubleshooting' },
  { cmd: 'show ap debug client-table', desc: 'Per-AP client-table debug', type: 'troubleshooting' },
  { cmd: 'show airmatch report',      desc: 'AirMatch optimisation report' },
  { cmd: 'show ap airmatch debug',    desc: 'AirMatch debug', type: 'troubleshooting' },
  { cmd: 'pcap start <interface> <bpf>', desc: 'On-AP packet capture (sparingly)', type: 'troubleshooting' },
  { cmd: 'show pcap status',          desc: 'Active captures' }
]);

addCmds(AP, 'Provisioning & Updates', [
  { cmd: 'show ap-env',               desc: 'AP-side variables incl. master IP, AP group' },
  { cmd: 'show image version',        desc: 'Installed images + active partition' },
  { cmd: 'ap-config-cluster master <ip>', desc: 'Provision the AP to a master controller / VC', type: 'config' },
  { cmd: 'apboot',                    desc: 'Reboot the AP', type: 'config', flagged: true },
  { cmd: 'reload',                    desc: 'Reload the AP', type: 'config', flagged: true }
]);

// ===========================================================================
// Save + bump manifest timestamp
// ===========================================================================

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

const MAN = path.resolve('data/manifest.json');
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

let total = 0, perPlat = {};
for (const [k, p] of Object.entries(P)) {
  let n = 0; for (const sec of Object.values(p.sections || {})) n += sec.length;
  perPlat[k] = n; total += n;
}
console.log('Total commands:', total);
console.log('Platforms:', Object.keys(P).length);
console.log('Aruba additions:');
console.log('  aruba_cx :', perPlat.aruba_cx);
console.log('  aruba_wlc:', perPlat.aruba_wlc);
console.log('  aruba_ap :', perPlat.aruba_ap);
console.log('Done.');
