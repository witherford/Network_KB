#!/usr/bin/env node
// Second-round curated additions for Wireshark, Cisco IOS, Cisco IOS XE Switch,
// Cisco IOS XE WLC, and Palo Alto. Dedupes against existing (cmd) per section.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = resolve(ROOT, 'data/commands.json');

const ADDITIONS = {
  wireshark: {
    'Display Filters — Basic': [
      ['ip.addr == 10.0.0.1', 'Match packets to or from a single host', 'show'],
      ['ip.src == 10.0.0.1', 'Packets sourced from a given IP', 'show'],
      ['ip.dst == 10.0.0.1', 'Packets destined to a given IP', 'show'],
      ['ip.addr == 10.0.0.0/24', 'CIDR — whole subnet, source or destination', 'show'],
      ['not (ip.addr == 10.0.0.1)', 'Exclude anything involving a specific host', 'show'],
      ['ip.addr == 10.0.0.1 and ip.addr == 10.0.0.2', 'Conversation between two specific hosts', 'show'],
      ['ipv6.addr == 2001:db8::1', 'Match an IPv6 host', 'show'],
      ['eth.addr == aa:bb:cc:dd:ee:ff', 'Match by MAC (source or destination)', 'show'],
      ['eth.dst == ff:ff:ff:ff:ff:ff', 'All Ethernet broadcasts', 'show'],
      ['vlan.id == 20', 'Frames tagged with a specific VLAN', 'show'],
      ['frame.len > 1500', 'Jumbo frames or fragmented IP above 1500', 'show'],
      ['frame.time >= "2026-04-24 09:00:00" and frame.time <= "2026-04-24 09:05:00"', 'Time-bounded slice of the capture', 'show'],
      ['frame.number == 1234', 'Jump to a specific frame by number', 'show'],
      ['ip.ttl < 5', 'Packets near TTL exhaustion — loops, traceroute replies', 'show'],
      ['ip.flags.df == 1 and ip.len > 1400', 'DF-bit packets near MTU — classic PMTUD hunt', 'show']
    ],
    'Display Filters — TCP/UDP': [
      ['tcp.port == 443', 'TCP traffic on port 443 (either direction)', 'show'],
      ['tcp.srcport == 22', 'TCP sourced from port 22', 'show'],
      ['tcp.dstport == 80', 'TCP destined to port 80', 'show'],
      ['tcp.flags.syn == 1 and tcp.flags.ack == 0', 'SYN-only — new connection attempts', 'show'],
      ['tcp.flags.syn == 1 and tcp.flags.ack == 1', 'SYN/ACK — server is responding', 'show'],
      ['tcp.flags.reset == 1', 'All RST packets — connections aborted', 'show'],
      ['tcp.flags.fin == 1', 'FIN packets — graceful close', 'show'],
      ['tcp.analysis.retransmission', 'TCP retransmits (marked by Wireshark heuristics)', 'show'],
      ['tcp.analysis.fast_retransmission', 'Fast retransmits — 3 dup ACKs', 'show'],
      ['tcp.analysis.duplicate_ack', 'Duplicate ACKs — loss indicator', 'show'],
      ['tcp.analysis.out_of_order', 'Packets arriving out of order', 'show'],
      ['tcp.analysis.lost_segment', 'Segments never seen — capture gaps or real loss', 'show'],
      ['tcp.analysis.zero_window', 'Receiver window closed — receiver-side back-pressure', 'show'],
      ['tcp.analysis.window_update', 'Window-size updates', 'show'],
      ['tcp.analysis.flags', 'All Wireshark TCP analysis tags in one filter', 'show'],
      ['tcp.window_size_value == 0', 'Advertised window is zero', 'show'],
      ['tcp.len > 0', 'TCP segments that actually carry payload', 'show'],
      ['tcp.stream eq 0', 'First TCP stream — right-click → Follow Stream to set this', 'show'],
      ['udp.port == 53', 'DNS queries/responses', 'show'],
      ['udp.length > 512', 'Large UDP datagrams — e.g. DNS EDNS0 responses', 'show'],
      ['tcp.options.mss_val < 1460', 'Non-default MSS — PPPoE/VPN/GRE path markers', 'show']
    ],
    'Display Filters — HTTP/HTTPS': [
      ['http', 'All HTTP traffic', 'show'],
      ['http.request', 'Only HTTP request lines', 'show'],
      ['http.response', 'Only HTTP responses', 'show'],
      ['http.request.method == "POST"', 'POST requests', 'show'],
      ['http.request.method == "GET"', 'GET requests', 'show'],
      ['http.request.uri contains "login"', 'URIs containing "login"', 'show'],
      ['http.host == "example.com"', 'Requests for a specific Host header', 'show'],
      ['http.user_agent contains "curl"', 'User-Agent substring match', 'show'],
      ['http.response.code == 500', 'HTTP 500 Internal Server Error', 'show'],
      ['http.response.code >= 400 and http.response.code < 600', 'All HTTP error responses', 'show'],
      ['http.response.code == 301 or http.response.code == 302', 'HTTP redirects', 'show'],
      ['http.cookie contains "sessionid"', 'Cookie header with a session cookie', 'show'],
      ['http.authorization', 'Basic/Bearer Authorization headers in requests', 'show'],
      ['http.content_type contains "json"', 'JSON API traffic', 'show'],
      ['http2', 'HTTP/2 frames', 'show'],
      ['http2.type == 1', 'HTTP/2 HEADERS frames only', 'show'],
      ['quic', 'QUIC (HTTP/3 transport) traffic', 'show']
    ],
    'Display Filters — DNS': [
      ['dns', 'All DNS traffic', 'show'],
      ['dns.flags.response == 0', 'DNS queries only (no responses)', 'show'],
      ['dns.flags.response == 1', 'DNS responses only', 'show'],
      ['dns.qry.name contains "example.com"', 'Queries for a specific name', 'show'],
      ['dns.qry.type == 1', 'Type A lookups', 'show'],
      ['dns.qry.type == 28', 'Type AAAA (IPv6) lookups', 'show'],
      ['dns.qry.type == 15', 'MX-record lookups', 'show'],
      ['dns.qry.type == 33', 'SRV-record lookups (AD/SIP discovery)', 'show'],
      ['dns.flags.rcode != 0', 'DNS responses with an error (NXDOMAIN, SERVFAIL…)', 'show'],
      ['dns.flags.rcode == 3', 'NXDOMAIN responses only', 'show'],
      ['dns.flags.rcode == 2', 'SERVFAIL responses only', 'show'],
      ['dns.resp.len > 512', 'DNS responses that cross the 512-byte UDP boundary', 'show'],
      ['dns.flags.truncated == 1', 'Truncated responses — client will retry over TCP', 'show']
    ],
    'Display Filters — TLS/SSL': [
      ['tls', 'All TLS records', 'show'],
      ['tls.handshake', 'TLS handshake records only', 'show'],
      ['tls.handshake.type == 1', 'ClientHello — inspect SNI, cipher list, versions', 'show'],
      ['tls.handshake.type == 2', 'ServerHello — chosen cipher and version', 'show'],
      ['tls.handshake.type == 11', 'Certificate message — the server\'s cert chain', 'show'],
      ['tls.handshake.extensions_server_name == "example.com"', 'Match by SNI host', 'show'],
      ['tls.record.version == 0x0301', 'TLS 1.0', 'show'],
      ['tls.record.version == 0x0303', 'TLS 1.2', 'show'],
      ['tls.record.version == 0x0304', 'TLS 1.3', 'show'],
      ['tls.alert_message', 'TLS alert records — version/cert/other handshake failures', 'show'],
      ['tls.alert_message.level == 2', 'Fatal TLS alerts', 'show'],
      ['tls.handshake.ciphersuite', 'Any handshake that negotiates a cipher', 'show']
    ],
    'Display Filters — DHCP': [
      ['dhcp', 'All DHCP (IPv4) traffic', 'show'],
      ['dhcp.option.dhcp == 1', 'DHCPDISCOVER', 'show'],
      ['dhcp.option.dhcp == 2', 'DHCPOFFER', 'show'],
      ['dhcp.option.dhcp == 3', 'DHCPREQUEST', 'show'],
      ['dhcp.option.dhcp == 5', 'DHCPACK', 'show'],
      ['dhcp.option.dhcp == 6', 'DHCPNAK — server refused client', 'show'],
      ['dhcp.option.dhcp == 7', 'DHCPRELEASE', 'show'],
      ['dhcp.hw.mac_addr == aa:bb:cc:dd:ee:ff', 'Everything from a specific client MAC', 'show'],
      ['dhcpv6', 'All DHCPv6 traffic', 'show'],
      ['bootp.option.value', 'DHCP option payloads — use for option 82 checks', 'show']
    ],
    'Display Filters — ARP / ICMP': [
      ['arp', 'All ARP frames', 'show'],
      ['arp.opcode == 1', 'ARP requests only', 'show'],
      ['arp.opcode == 2', 'ARP replies only', 'show'],
      ['arp.duplicate-address-detected', 'Gratuitous-ARP duplicate-address alerts', 'show'],
      ['arp.src.proto_ipv4 == 10.0.0.1', 'ARP sourced from a specific IP', 'show'],
      ['icmp', 'All ICMP traffic', 'show'],
      ['icmp.type == 0', 'ICMP echo reply', 'show'],
      ['icmp.type == 8', 'ICMP echo request', 'show'],
      ['icmp.type == 3', 'ICMP destination unreachable (with code = sub-reason)', 'show'],
      ['icmp.type == 3 and icmp.code == 4', 'Fragmentation needed + DF-set → PMTUD signal', 'show'],
      ['icmp.type == 11', 'ICMP time exceeded — traceroute replies', 'show'],
      ['icmpv6', 'All ICMPv6 traffic (NDP, RA, RS, PMTUD)', 'show'],
      ['icmpv6.type == 135', 'Neighbor Solicitation (IPv6 ARP equivalent)', 'show'],
      ['icmpv6.type == 136', 'Neighbor Advertisement', 'show'],
      ['icmpv6.type == 134', 'Router Advertisement', 'show']
    ],
    'Display Filters — VoIP / SIP / RTP': [
      ['sip', 'All SIP signalling', 'show'],
      ['sip.Method == "INVITE"', 'Only SIP INVITEs — new calls', 'show'],
      ['sip.Method == "BYE"', 'SIP call-termination messages', 'show'],
      ['sip.Status-Code >= 400', 'SIP failure responses (4xx/5xx/6xx)', 'show'],
      ['sip.Call-ID == "<id>"', 'Every SIP message in a specific call', 'show'],
      ['rtp', 'All RTP streams', 'show'],
      ['rtp.p_type == 0', 'G.711 µ-law payload', 'show'],
      ['rtp.p_type == 8', 'G.711 a-law payload', 'show'],
      ['rtp.marker == 1', 'Marker-bit RTP packets (talk-spurt start, DTMF events)', 'show'],
      ['rtcp', 'All RTCP control traffic (stats, NACKs)', 'show'],
      ['sdp', 'Session Description Protocol bodies inside SIP', 'show']
    ],
    'Display Filters — AD / Kerberos / SMB / LDAP': [
      ['kerberos', 'All Kerberos traffic', 'show'],
      ['kerberos.msg_type == 10', 'AS-REQ — initial ticket request', 'show'],
      ['kerberos.msg_type == 12', 'TGS-REQ — service ticket request', 'show'],
      ['kerberos.error_code', 'Kerberos errors (PREAUTH_FAILED, CLOCKSKEW…)', 'show'],
      ['kerberos.error_code == 24', 'PREAUTH_FAILED — bad password', 'show'],
      ['kerberos.error_code == 37', 'KRB_AP_ERR_SKEW — clock skew', 'show'],
      ['ldap', 'LDAP traffic (unencrypted)', 'show'],
      ['ldap.messageType == 3', 'LDAP search requests', 'show'],
      ['smb', 'SMBv1 traffic', 'show'],
      ['smb2', 'SMBv2/v3 traffic', 'show'],
      ['smb2.cmd == 5', 'SMB2 CREATE (file/folder open)', 'show'],
      ['smb2.cmd == 6', 'SMB2 CLOSE', 'show'],
      ['smb2.nt_status != 0', 'SMB2 responses with an NT_STATUS error', 'show'],
      ['dcerpc', 'DCE/RPC payloads — RPC-over-SMB, MS-RPC', 'show']
    ],
    'Display Filters — Routing / Switching Control Plane': [
      ['ospf', 'All OSPF packets (Hello, LSA, DBD)', 'show'],
      ['ospf.msg == 1', 'OSPF Hello packets', 'show'],
      ['eigrp', 'EIGRP traffic', 'show'],
      ['bgp', 'All BGP messages', 'show'],
      ['bgp.type == 1', 'BGP OPEN', 'show'],
      ['bgp.type == 2', 'BGP UPDATE', 'show'],
      ['bgp.type == 3', 'BGP NOTIFICATION (session tear-down reason)', 'show'],
      ['stp', 'All Spanning-Tree BPDUs', 'show'],
      ['lldp', 'LLDP neighbor-discovery frames', 'show'],
      ['cdp', 'Cisco Discovery Protocol frames', 'show'],
      ['vrrp', 'VRRP advertisements', 'show'],
      ['hsrp', 'Cisco HSRP advertisements', 'show'],
      ['bfd', 'BFD session packets', 'show']
    ],
    'Display Filters — 802.11 / Wireless': [
      ['wlan', 'Any 802.11 frame', 'show'],
      ['wlan.fc.type == 0', 'Management frames (beacons, probe, auth, assoc)', 'show'],
      ['wlan.fc.type_subtype == 0x08', 'Beacon frames', 'show'],
      ['wlan.fc.type_subtype == 0x04', 'Probe requests', 'show'],
      ['wlan.fc.type_subtype == 0x05', 'Probe responses', 'show'],
      ['wlan.fc.type_subtype == 0x0b', '802.11 Authentication', 'show'],
      ['wlan.fc.type_subtype == 0x00', 'Association request', 'show'],
      ['wlan.fc.type_subtype == 0x0c', 'Deauthentication — track client drops', 'show'],
      ['wlan.fc.type_subtype == 0x0a', 'Disassociation', 'show'],
      ['wlan.fc.type == 1', 'Control frames (RTS/CTS/ACK/block-ACK)', 'show'],
      ['wlan.fc.type == 2', 'Data frames', 'show'],
      ['wlan.ssid == "CorpWiFi"', 'Frames referencing a specific SSID', 'show'],
      ['wlan.addr == aa:bb:cc:dd:ee:ff', 'Everything involving a specific wireless MAC', 'show'],
      ['eapol', '802.1X EAPOL (including 4-way handshake)', 'show'],
      ['wlan_radio.channel == 36', 'Frames captured on a specific channel', 'show'],
      ['radiotap.dbm_antsignal < -75', 'Frames received below -75 dBm — weak-signal hunting', 'show']
    ],
    'Display Filters — VPN / IPsec / GRE': [
      ['isakmp', 'IKE (UDP/500, UDP/4500) negotiation messages', 'show'],
      ['esp', 'Encrypted ESP payloads', 'show'],
      ['ah', 'IPsec AH packets', 'show'],
      ['gre', 'GRE-tunnelled traffic', 'show'],
      ['ip.proto == 47', 'GRE by IP protocol number', 'show'],
      ['ip.proto == 50', 'ESP by IP protocol number', 'show'],
      ['ip.proto == 51', 'AH by IP protocol number', 'show'],
      ['l2tp', 'L2TP control/data', 'show'],
      ['pppoes', 'PPPoE session traffic', 'show'],
      ['wireguard', 'WireGuard control + data packets', 'show']
    ],
    'Display Filters — Operators & Syntax': [
      ['tcp.port in {80 443 8080}', 'Set-membership (Wireshark 3.2+)', 'show'],
      ['!(arp or stp or cdp or lldp)', 'Hide everyday L2 control-plane chatter', 'show'],
      ['ip.addr == 10.0.0.0/8 and not tcp.port == 22', 'Boolean composition — subnet minus a port', 'show'],
      ['frame matches "User-Agent: curl"', 'Regex content search across the whole frame', 'show'],
      ['http.user_agent ~ "Mozilla"', 'Shorthand regex match (~)', 'show'],
      ['tcp.payload contains 50:4f:53:54', 'Hex-string search ("POST") in TCP payload', 'show'],
      ['frame.protocols contains "gtp"', 'Filter by protocol name in the dissector chain', 'show']
    ],
    'Capture Filters (BPF)': [
      ['tcp port 443 and host 10.0.0.1', 'TLS traffic to/from a specific host', 'show'],
      ['net 10.0.0.0/24 and not port 22', 'Subnet traffic minus SSH noise', 'show'],
      ['ether host aa:bb:cc:dd:ee:ff', 'All frames involving a specific MAC', 'show'],
      ['vlan 20', 'Only frames in VLAN 20', 'show'],
      ['icmp[icmptype] == icmp-echoreply', 'ICMP echo replies', 'show'],
      ['tcp[tcpflags] & (tcp-syn|tcp-fin) != 0', 'Any SYN or FIN in the TCP flags', 'show'],
      ['port not in (22,23)', 'Exclude SSH/Telnet on capture', 'show'],
      ['ip proto 47', 'GRE by IP protocol number', 'show'],
      ['greater 1500', 'Frames larger than 1500 bytes', 'show'],
      ['less 100', 'Tiny frames (< 100 bytes)', 'show'],
      ['broadcast or multicast', 'L2 broadcast + multicast traffic', 'show']
    ],
    'Analysis & Statistics': [
      ['Statistics → Conversations', 'Top talkers by pair (IPv4/v6, TCP, UDP tabs)', 'show'],
      ['Statistics → Endpoints', 'Per-host byte/packet totals', 'show'],
      ['Statistics → Protocol Hierarchy', 'Share of bytes per protocol in the capture', 'show'],
      ['Statistics → IO Graph', 'Plot traffic rate over time; overlay filters', 'show'],
      ['Statistics → TCP Stream Graphs → Time-Sequence (Stevens)', 'Visualise TCP throughput/retransmits', 'show'],
      ['Statistics → TCP Stream Graphs → Round Trip Time', 'Per-flow RTT plot', 'show'],
      ['Statistics → Expert Information', 'Aggregated notes/warnings/errors across the capture', 'show'],
      ['Statistics → Flow Graph', 'Sequence diagram between hosts / by stream', 'show'],
      ['Statistics → DNS', 'DNS query/response breakdown', 'show'],
      ['Statistics → HTTP → Requests', 'Request-count histogram by host/URI', 'show'],
      ['Telephony → VoIP Calls', 'RTP/SIP call list with replay and graph options', 'show'],
      ['Analyze → Display Filter Macros…', 'Define reusable named display-filter snippets', 'config']
    ],
    'Coloring Rules & Workflow': [
      ['View → Coloring Rules…', 'Per-filter colors to spot anomalies at a glance', 'config'],
      ['View → Time Display Format → Seconds Since Previous Displayed Packet', 'Inter-arrival time for gap hunting', 'config'],
      ['Right-click → Follow → TCP Stream', 'Filter to a single TCP conversation', 'show'],
      ['Right-click → Follow → TLS Stream', 'Reassemble + decrypt (with SSLKEYLOGFILE)', 'show'],
      ['File → Export Objects → HTTP', 'Extract every HTTP object to disk', 'show'],
      ['File → Export Specified Packets → Displayed', 'Save only the frames that match the current filter', 'config'],
      ['Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename', 'Point to SSLKEYLOGFILE for decryption', 'config'],
      ['Edit → Preferences → Name Resolution', 'Enable network/transport/manual name resolution', 'config'],
      ['Ctrl+Shift+L', 'Jump to the display-filter bar', 'show'],
      ['Ctrl+F', 'Find packet by string / hex / regex in payload', 'show']
    ],
    TShark: [
      ['tshark -D', 'List all capture interfaces with numeric index', 'show'],
      ['tshark -i <n> -w out.pcapng -b filesize:100000 -b files:10', 'Ring-buffer capture: 10 × 100MB files', 'config'],
      ['tshark -r in.pcap -Y "tcp.analysis.retransmission" -T fields -e ip.src -e ip.dst -e tcp.stream', 'Export retransmits as TSV', 'troubleshooting'],
      ['tshark -r in.pcap -qz io,stat,10', 'Bucketed IO stats every 10s for the whole capture', 'show'],
      ['tshark -r in.pcap -qz conv,tcp', 'Top TCP conversations', 'show'],
      ['tshark -r in.pcap -qz expert', 'Dump the Expert Info panel to stdout', 'show'],
      ['tshark -r in.pcap -qz http,tree', 'HTTP request/response tree stats', 'show'],
      ['tshark -r in.pcap -qz rtp,streams', 'RTP stream list with jitter/loss', 'show'],
      ['tshark -r in.pcap -qz dns,tree', 'DNS query-type / response-code breakdown', 'show'],
      ['tshark -r in.pcap -Y "dns.qry.name" -T fields -e dns.qry.name | sort -u', 'Unique DNS names queried', 'show'],
      ['editcap -A "2026-04-24 09:00:00" -B "2026-04-24 09:05:00" in.pcap slice.pcap', 'Cut a time window from a large capture', 'config'],
      ['mergecap -w merged.pcapng a.pcap b.pcap', 'Merge multiple captures preserving timestamps', 'config'],
      ['capinfos in.pcap', 'Quick summary: duration, packets, bytes, drops', 'show']
    ]
  },

  ciscoios: {
    Interfaces: [
      ['show interfaces status', 'One-line status per port incl. speed/duplex/VLAN', 'show'],
      ['show interfaces description', 'All interfaces with their description text', 'show'],
      ['show interfaces counters', 'Bytes/packets in/out per interface', 'show'],
      ['show power inline', 'PoE budget, per-port draw, operational state', 'show'],
      ['show interfaces <int> controller', 'SFP/Phy details (useful for SFP-DOM issues)', 'show'],
      ['show vlan brief', 'VLANs and their access-port membership', 'show'],
      ['show spanning-tree', 'STP state per VLAN — root/designated/blocking', 'show'],
      ['show spanning-tree inconsistentports', 'Ports currently in an inconsistent STP state', 'troubleshooting'],
      ['show cdp neighbors detail', 'CDP neighbors with platform, address, capabilities', 'show']
    ],
    Routing: [
      ['show ip route summary', 'Route-count summary by protocol', 'show'],
      ['show ip bgp neighbors <ip> advertised-routes', 'Prefixes being advertised to a specific BGP peer', 'show'],
      ['show ip bgp <prefix>', 'Best-path and all paths for a specific BGP prefix', 'show'],
      ['show ip ospf neighbor', 'OSPF adjacency list', 'show'],
      ['show vrf', 'List configured VRFs and their interfaces', 'show'],
      ['show ip route vrf <name>', 'Routing table for a specific VRF', 'show'],
      ['show ip mroute', 'IP multicast routing table', 'show']
    ],
    Security: [
      ['show access-lists', 'Every ACL with hit counts', 'show'],
      ['show ip access-lists <name>', 'Single named/numbered ACL with per-line hits', 'show'],
      ['show crypto isakmp sa', 'IKE phase-1 SAs', 'show'],
      ['show crypto ipsec sa', 'IPsec phase-2 SAs with counters and encaps', 'show'],
      ['show login failures', 'Recent authentication failures', 'troubleshooting']
    ],
    Troubleshooting: [
      ['show environment all', 'Voltages, temperatures, fan/PSU state', 'show'],
      ['show inventory', 'Serial numbers + PIDs for TAC cases', 'show'],
      ['show platform', 'Platform-specific state (FP, linecards, supervisor)', 'show'],
      ['show ip traffic', 'IP layer counters incl. drops per reason', 'troubleshooting'],
      ['show tcp brief', 'Active TCP sessions on the device (SSH/BGP/telnet)', 'show'],
      ['show ip sockets', 'UDP/TCP listening sockets in the control plane', 'show'],
      ['show processes cpu sorted | exclude 0.00', 'Only processes with non-zero CPU usage', 'troubleshooting'],
      ['show logging summary', 'Counts per facility/severity in the log buffer', 'troubleshooting'],
      ['ping vrf <name> <dst> size <b> df-bit', 'Per-VRF ping with DF-bit for PMTUD check', 'troubleshooting'],
      ['traceroute mpls ipv4 <prefix>', 'MPLS LSP traceroute', 'troubleshooting']
    ],
    Management: [
      ['show running-config | section <keyword>', 'Show config starting from a section header', 'show'],
      ['show running-config interface <int>', 'Running config scoped to a single interface', 'show'],
      ['show archive', 'Rollback-archive contents if configured', 'show'],
      ['copy running-config startup-config', 'Persist running to startup (write mem)', 'config'],
      ['archive config', 'Take a named snapshot for rollback', 'config'],
      ['configure replace flash:<file> force', 'Roll back to a previous archived config', 'config'],
      ['show clock detail', 'Clock, timezone, and time-source', 'show'],
      ['show ntp associations', 'NTP peers and stratum', 'show'],
      ['show users', 'Active VTY/console sessions', 'show'],
      ['show ssh', 'Active SSH sessions and versions', 'show']
    ]
  },

  ciscoiosxe_sw: {
    Interfaces: [
      ['show interfaces status err-disabled', 'Ports currently err-disabled with reason', 'troubleshooting'],
      ['show errdisable recovery', 'Err-disable recovery timers and enabled causes', 'show'],
      ['errdisable recovery cause <cause>', 'Enable auto-recovery for a specific err-disable cause', 'config'],
      ['errdisable recovery interval 300', 'Set auto-recovery interval (seconds)', 'config'],
      ['show idprom interface <int>', 'SFP serial + part number (vendor/lot)', 'show'],
      ['show platform software fed switch active punt cpuq rates', 'Control-plane punt rates per queue', 'troubleshooting']
    ],
    VLAN: [
      ['show vtp status', 'VTP version, domain, mode, revision number', 'show'],
      ['show vlan id <id>', 'Detail for a specific VLAN incl. port members', 'show'],
      ['show interfaces trunk | include <vlan>', 'Which trunks pass a specific VLAN', 'show']
    ],
    STP: [
      ['show spanning-tree root', 'Who is root for each VLAN and via which port', 'show'],
      ['show spanning-tree bridge', 'Local bridge ID per VLAN (priority + MAC)', 'show'],
      ['spanning-tree guard root', 'Enforce root-guard on a port facing downstream devices', 'config'],
      ['spanning-tree bpduguard enable', 'Drop/err-disable on any BPDU received (edge ports)', 'config']
    ],
    EtherChannel: [
      ['show etherchannel load-balance', 'Configured LAG hashing method', 'show'],
      ['test etherchannel load-balance interface port-channel<n> ip <src> <dst>', 'Predict outgoing member for a given 5-tuple', 'troubleshooting'],
      ['show lacp neighbor', 'LACP neighbor state per member', 'show']
    ],
    PortSecurity: [
      ['show port-security address', 'MAC addresses pinned per port by port-security', 'show'],
      ['show port-security interface <int>', 'Per-interface port-security state + violation count', 'show'],
      ['clear port-security sticky', 'Clear sticky-learnt MACs', 'troubleshooting']
    ],
    QoS: [
      ['show platform hardware fed switch active qos queue config interface <int>', 'Queue config applied in hardware to a port', 'show'],
      ['show platform hardware fed switch active qos queue stats interface <int> clear', 'Read then clear hardware queue stats', 'troubleshooting'],
      ['show policy-map interface <int>', 'Software policy-map counters on an interface', 'show']
    ],
    Routing: [
      ['show ip cef exact-route <src> <dst>', 'Exact CEF path selection for a given flow', 'show'],
      ['show ip cef summary', 'CEF FIB size and memory footprint', 'show'],
      ['show ip arp <ip>', 'ARP entry for a single IP incl. age and MAC', 'show']
    ],
    BGP: [
      ['show bgp ipv4 unicast summary', 'AFI/SAFI-scoped BGP neighbor summary', 'show'],
      ['show bgp ipv4 unicast <prefix>', 'Best/alt paths and attributes for a prefix', 'show'],
      ['clear bgp ipv4 unicast <neighbor> soft', 'Soft-reset a BGP neighbor without bouncing session', 'troubleshooting']
    ],
    OSPF: [
      ['show ip ospf database router self-originate', 'This router\'s own LSA — verify what you\'re advertising', 'show'],
      ['show ip ospf interface <int>', 'OSPF state/timers/metric on one interface', 'show']
    ],
    Multicast: [
      ['show ip igmp groups', 'IGMP joined groups per interface', 'show'],
      ['show ip mroute active', 'Only multicast flows with live traffic', 'show'],
      ['show ip pim neighbor', 'PIM adjacencies', 'show']
    ],
    Security: [
      ['show platform software fed switch active access-list interface <int> output', 'Hardware-ACL programming for egress on a port', 'show'],
      ['show device-tracking database', 'IP-to-MAC binding database (used for IPv6 FHS / DAI)', 'show'],
      ['show device-tracking policies', 'Configured device-tracking policies and bindings', 'show']
    ],
    NetFlow: [
      ['show flow exporter', 'Configured Flexible-NetFlow exporters and their stats', 'show'],
      ['show flow monitor <name> cache', 'Flow-cache contents for a monitor', 'show'],
      ['show flow monitor <name> statistics', 'Drop/flows/packet counters for the monitor', 'show']
    ],
    Troubleshooting: [
      ['show tech-support | redirect bootflash:tac.txt', 'Capture tech-support for TAC', 'troubleshooting'],
      ['show platform software process slot switch active r0 monitor', 'Top-style view of processes on RP', 'troubleshooting'],
      ['show platform software status control-processor brief', 'Control-plane CPU, memory, load averages', 'show'],
      ['show monitor capture', 'EPC capture sessions configured', 'show'],
      ['monitor capture CAP interface <int> both match any buffer size 10 limit pps 1000', 'Set up in-box packet capture', 'troubleshooting'],
      ['monitor capture CAP start', 'Start a configured capture', 'troubleshooting'],
      ['monitor capture CAP stop', 'Stop it', 'troubleshooting'],
      ['monitor capture CAP export flash:cap.pcap', 'Write captured packets to flash', 'troubleshooting']
    ]
  },

  ciscoiosxe_wlc: {
    System: [
      ['show wireless summary', 'One-page summary: APs joined, clients, tags, controller role', 'show'],
      ['show boot', 'Boot variable and pending software image', 'show'],
      ['show redundancy states', 'HA Active/Standby state and role', 'show'],
      ['show chassis', 'SSO/HA chassis summary', 'show']
    ],
    'AP Management': [
      ['show ap summary', 'All joined APs with IP, model, MAC, uptime', 'show'],
      ['show ap join stats summary', 'Join-phase counters per AP', 'troubleshooting'],
      ['show ap join stats detailed <ap>', 'Detailed join statistics for one AP', 'troubleshooting'],
      ['show ap cdp neighbors', 'What each AP sees on its switchport via CDP', 'show'],
      ['show ap config general <ap>', 'AP general config: tags, primary/secondary/tertiary WLC', 'show'],
      ['show ap image', 'Image pre-download status per AP', 'show'],
      ['ap name <ap> reset', 'Reload a single AP', 'troubleshooting']
    ],
    WLANs: [
      ['show wlan summary', 'All WLANs/SSIDs and their IDs', 'show'],
      ['show wlan id <id>', 'Detail for one WLAN incl. security + policy', 'show'],
      ['show wireless profile policy summary', 'Policy-profile names and state', 'show'],
      ['show wireless profile policy detailed <name>', 'Policy profile: VLAN, AAA, QoS, session timeout', 'show'],
      ['show wireless tag policy summary', 'Policy-tag list (WLAN ↔ profile bindings)', 'show'],
      ['show wireless tag site summary', 'Site tags and AP mapping', 'show'],
      ['show wireless tag rf summary', 'RF tags (radio profiles bound by band)', 'show']
    ],
    Clients: [
      ['show wireless client summary', 'All associated clients and their state', 'show'],
      ['show wireless client mac-address <mac> detail', 'Full detail: AP, VLAN, policy, encryption, IP', 'show'],
      ['show wireless client mac-address <mac> mobility', 'Roaming/mobility history for one client', 'show'],
      ['show wireless client mac-address <mac> stats', 'RSSI / SNR / Rx/Tx counters', 'show'],
      ['clear wireless client mac-address <mac>', 'Disconnect a single client', 'troubleshooting']
    ],
    RF: [
      ['show ap rf-profile summary', 'RF-profile list + linked RF tag', 'show'],
      ['show ap rf-profile detailed <name>', 'RF profile parameters (channels, power, DCA)', 'show'],
      ['show ap dot11 5ghz summary', '5GHz radio state per AP', 'show'],
      ['show ap dot11 24ghz summary', '2.4GHz radio state per AP', 'show'],
      ['show ap dot11 dual-band summary', '6GHz (Wi-Fi 6E) radio state', 'show'],
      ['show ap auto-rf dot11 5ghz', 'DCA / TPC / coverage-hole data for 5GHz', 'show']
    ],
    Mobility: [
      ['show wireless mobility summary', 'Mobility group peers and tunnel state', 'show'],
      ['show wireless mobility peer ip <ip>', 'Detail of a specific mobility peer (CAPWAP state, MTU)', 'show'],
      ['show wireless mobility statistics', 'Per-event mobility counters', 'show']
    ],
    Security: [
      ['show wireless security rogue ap summary', 'Detected rogue APs', 'show'],
      ['show wireless security rogue client summary', 'Rogue/ad-hoc clients seen on-air', 'show'],
      ['show wireless wps summary', 'Wireless IPS configuration summary', 'show'],
      ['show wireless security psk summary', 'PSK profile summary', 'show']
    ],
    AAA: [
      ['show aaa servers', 'RADIUS/TACACS server state + per-server counters', 'show'],
      ['show running-config | section radius server', 'All RADIUS server stanzas', 'show'],
      ['test aaa group <group> <user> <pass> legacy', 'Test AAA auth end-to-end against configured servers', 'troubleshooting']
    ],
    FlexConnect: [
      ['show wireless profile flex summary', 'Flex profiles configured', 'show'],
      ['show ap config general <ap> | include mode|Flex', 'Verify AP is in FlexConnect mode', 'show'],
      ['show wireless client mac <mac> detail | include switching', 'Per-client local/central switching state', 'show']
    ],
    Troubleshooting: [
      ['show tech-support wireless', 'Wireless-only tech-support bundle for TAC', 'troubleshooting'],
      ['show wireless stats client detail', 'Aggregate client connection stats (joins, excl., deauth)', 'show'],
      ['debug wireless mac <mac>', 'Enable client-centric RA trace', 'troubleshooting'],
      ['show logging profile wireless internal to-file bootflash:wlc-log.txt', 'Collect internal wireless logs to flash', 'troubleshooting'],
      ['set trace wncd-filter add mac <mac>', 'Filter always-on traces for a specific client', 'troubleshooting'],
      ['show wireless trace-on-failure summary', 'Last-join-failure traces collected automatically', 'troubleshooting']
    ]
  },

  paloalto: {
    'System & Status': [
      ['show system info', 'Model, serial, uptime, version, HA role, licenses', 'show'],
      ['show system resources', 'Top-like snapshot of CPU/mem/processes', 'show'],
      ['show jobs all', 'Every admin job (commit, content update) with status', 'show'],
      ['show jobs id <id>', 'Detail for one job including warnings', 'show'],
      ['show system disk-space', 'Per-partition disk usage', 'show']
    ],
    Interfaces: [
      ['show interface all', 'One-line summary per interface with state and counters', 'show'],
      ['show interface <name>', 'Full detail: zone, VR, MAC, IPv4/v6, LACP', 'show'],
      ['show interface logical', 'Logical/sub-interface summary', 'show'],
      ['show interface ethernet1/1 transceiver', 'SFP info + DOM readings', 'show']
    ],
    Routing: [
      ['show routing route', 'Complete routing table (all VRs)', 'show'],
      ['show routing fib virtual-router <vr>', 'Hardware FIB for a virtual router', 'show'],
      ['show routing protocol bgp peer', 'BGP peer list and state', 'show'],
      ['show routing protocol bgp rib-out peer <peer>', 'Prefixes advertised to a BGP peer', 'show'],
      ['show routing protocol ospf neighbor', 'OSPF adjacencies', 'show']
    ],
    'Security Policies': [
      ['test security-policy-match from <src-zone> to <dst-zone> source <ip> destination <ip> protocol 6 destination-port <p> application <app>', 'Most accurate rule match tester — fill in as much as you know', 'troubleshooting'],
      ['show running rule-use rule-base security type unused vsys vsys1', 'Every rule that hasn\'t matched since last reboot', 'show'],
      ['show running rule-hit-count vsys vsys1 rule-base security', 'Rule-hit counters for policy cleanup', 'show'],
      ['show rule-hit-count vsys vsys1 rule-base security rules "<name>"', 'Hit count for a single rule', 'show']
    ],
    NAT: [
      ['show running nat-policy', 'Currently loaded NAT rules', 'show'],
      ['test nat-policy-match from <src-zone> to <dst-zone> source <ip> destination <ip> protocol 6 destination-port <p>', 'Which NAT rule will apply to this flow', 'troubleshooting'],
      ['show session all filter nat-rule "<name>"', 'Sessions matching a specific NAT rule', 'show']
    ],
    VPN: [
      ['show vpn ike-sa', 'IKE phase-1 SAs', 'show'],
      ['show vpn ipsec-sa', 'IPsec phase-2 SAs', 'show'],
      ['show vpn ipsec-sa tunnel <name>', 'Single tunnel detail incl. encrypt/decrypt bytes', 'show'],
      ['show vpn tunnel', 'Tunnel state summary (up/down, peer, local/remote proxy-IDs)', 'show'],
      ['clear vpn ike-sa gateway <gw>', 'Force IKE re-negotiation to a gateway', 'troubleshooting'],
      ['clear vpn ipsec-sa tunnel <t>', 'Force phase-2 re-key on a tunnel', 'troubleshooting']
    ],
    'High Availability': [
      ['show high-availability state', 'HA mode, local/peer state, last transition', 'show'],
      ['show high-availability link-monitoring', 'Per-link HA monitoring state', 'show'],
      ['show high-availability path-monitoring', 'Path-monitor probe state', 'show'],
      ['show high-availability flap-statistics', 'HA flap history', 'show'],
      ['request high-availability state suspend', 'Administratively suspend this peer', 'config'],
      ['request high-availability state functional', 'Bring this peer back into service', 'config']
    ],
    'Sessions & Flows': [
      ['show session all filter source <ip> destination <ip>', 'Active sessions between two hosts', 'show'],
      ['show session all filter application <app>', 'Sessions matched to a specific application', 'show'],
      ['show session id <n>', 'Detail for a specific session ID (NAT, policy, app, state)', 'show'],
      ['show session info', 'Global session-table statistics', 'show'],
      ['show session meter', 'Per-vsys session-rate counters', 'show'],
      ['clear session all filter source <ip>', 'Clear all sessions for a given source IP', 'troubleshooting'],
      ['clear session id <n>', 'Clear a single session by ID', 'troubleshooting']
    ],
    'Packet Diagnostics': [
      ['debug dataplane packet-diag set filter match source <ip> destination <ip>', 'Install a packet-diag filter', 'troubleshooting'],
      ['debug dataplane packet-diag set filter on', 'Enable the configured filter', 'troubleshooting'],
      ['debug dataplane packet-diag set capture stage receive file rx.pcap', 'Capture at the "receive" stage', 'troubleshooting'],
      ['debug dataplane packet-diag set capture stage drop file drop.pcap', 'Capture only dropped packets', 'troubleshooting'],
      ['debug dataplane packet-diag set capture on', 'Turn capture on', 'troubleshooting'],
      ['debug dataplane packet-diag set capture off', 'Turn capture off', 'troubleshooting'],
      ['view-pcap filter-pcap rx.pcap', 'Inspect captured pcap from CLI', 'troubleshooting'],
      ['scp export filter-pcap from rx.pcap to <user>@<host>:/tmp/', 'Pull captured pcap off the firewall', 'troubleshooting']
    ],
    'Monitoring & Diagnostics': [
      ['show counter global filter delta yes packet-filter yes', 'Only global counters that changed AND match packet-diag filter', 'troubleshooting'],
      ['show counter global filter severity drop delta yes', 'Deltas on drop-class counters since last command', 'troubleshooting'],
      ['show system logdb-quota', 'Per-log quota usage', 'show'],
      ['show log traffic direction equal backward count 50', 'Last 50 traffic-log entries', 'show'],
      ['show log threat direction equal backward count 50', 'Last 50 threat-log entries', 'show']
    ],
    'User-ID': [
      ['show user user-ids all', 'Every known username → IP mapping', 'show'],
      ['show user ip-user-mapping all', 'Global IP-to-user mapping table', 'show'],
      ['show user ip-user-mapping ip <ip>', 'Who is this IP mapped to right now', 'show'],
      ['show user group list', 'Known AD groups from User-ID', 'show'],
      ['show user group name "<grp>"', 'Members of a specific AD group', 'show'],
      ['clear user-cache all', 'Clear all IP-user mappings (reset User-ID cache)', 'troubleshooting']
    ],
    'Commit & Config': [
      ['configure', 'Enter candidate-config mode', 'config'],
      ['show config diff', 'Diff between candidate and running config', 'show'],
      ['commit description "<msg>"', 'Commit with audit-log description', 'config'],
      ['commit partial admin <user>', 'Commit only changes owned by a specific admin', 'config'],
      ['show commit-locks', 'Who currently holds a commit lock', 'show'],
      ['request commit-lock remove admin <user>', 'Remove a stale commit lock', 'config']
    ]
  }
};

const raw = await readFile(DB, 'utf8');
const data = JSON.parse(raw);

let added = 0, skipped = 0, missingSec = 0;
for (const [pk, sections] of Object.entries(ADDITIONS)) {
  const plat = data.platforms[pk];
  if (!plat) { console.error(`platform ${pk} not found — skipping`); continue; }
  for (const [sec, rows] of Object.entries(sections)) {
    if (!plat.sections[sec]) { plat.sections[sec] = []; missingSec++; }
    const existing = new Set(plat.sections[sec].map(x => x.cmd));
    for (const [cmd, desc, type] of rows) {
      if (existing.has(cmd)) { skipped++; continue; }
      plat.sections[sec].push({ cmd, desc, type, flagged: false });
      existing.add(cmd);
      added++;
    }
  }
}

data.updatedAt = new Date().toISOString();
await writeFile(DB, JSON.stringify(data, null, 2) + '\n');
console.log(`added ${added}, skipped ${skipped} (dupes), new sections: ${missingSec}`);
