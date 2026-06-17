#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(filePath, 'utf8'));
const ws = data.platforms.wireshark.sections;

// Helper: apply example to a command by exact cmd match
function patch(section, cmd, example) {
  const s = ws[section];
  if (!s) { console.warn('SECTION NOT FOUND:', section); return; }
  const c = s.find(x => x.cmd === cmd);
  if (!c) { console.warn('CMD NOT FOUND in', section, ':', cmd); return; }
  if (c.example && c.example.trim()) return; // already has one
  c.example = example;
}

// ── Capture Filters ────────────────────────────────────────────────────────────
patch('Capture Filters', 'host <ip>',
`# Replace <ip> with the target, e.g.: host 192.168.1.50
# Captures all traffic to OR from that host (source or destination).
# Apply in Wireshark: Capture → Options → Capture filter field
# tshark: tshark -i eth0 -f "host 192.168.1.50"`);

patch('Capture Filters', 'src host <ip>',
`# Captures only packets originating FROM the specified IP.
# e.g. src host 10.10.10.1  — traffic leaving a specific server.
# tshark: tshark -i eth0 -f "src host 10.10.10.1"`);

patch('Capture Filters', 'dst host <ip>',
`# Captures only packets destined TO the specified IP.
# e.g. dst host 10.10.10.5  — traffic arriving at a specific host.
# Combine: src host A and dst host B for unidirectional session capture.`);

patch('Capture Filters', 'net <subnet>',
`# Captures packets within an entire subnet.
# e.g. net 10.10.10.0/24  or  net 10.10.10.0 mask 255.255.255.0
# Useful for capturing all traffic within a VLAN or network segment.
# tshark: tshark -i eth0 -f "net 192.168.0.0/16"`);

patch('Capture Filters', 'port <port>',
`# Captures TCP or UDP packets on the specified port (source or destination).
# e.g. port 443  — captures all HTTPS traffic (both directions).
# Shorthand for: tcp port <port> or udp port <port> combined.
# tshark: tshark -i eth0 -f "port 443"`);

patch('Capture Filters', 'tcp port <port>',
`# Captures only TCP packets on the specified port.
# e.g. tcp port 443  — HTTPS only, ignoring UDP/443 (QUIC).
# More precise than port <port> when protocol specificity is needed.
# tshark: tshark -i eth0 -f "tcp port 22"`);

patch('Capture Filters', 'udp port <port>',
`# Captures only UDP packets on the specified port.
# e.g. udp port 53   — DNS queries and responses.
# e.g. udp port 5060 — SIP signalling traffic.
# tshark: tshark -i eth0 -f "udp port 161"`);

patch('Capture Filters', 'icmp',
`# Captures all ICMP packets (echo, unreachable, time exceeded, redirect…).
# Shows ping requests/replies, traceroute TTL-expired messages, MTU errors.
# Combine: icmp and host 10.0.0.1  — pings to/from a specific host.
# tshark: tshark -i eth0 -f "icmp" -c 20`);

patch('Capture Filters', 'icmp6',
`# Captures ICMPv6 packets (ping6, NDP, MLD, Router Advertisements).
# Essential for troubleshooting IPv6 neighbour discovery and RA issues.
# tshark: tshark -i eth0 -f "icmp6"  — watch ND/RA activity in real time.`);

patch('Capture Filters', 'arp',
`# Captures ARP requests and replies (EtherType 0x0806).
# Use to detect ARP storms, duplicate IPs, or ARP poisoning attempts.
# ARP request: Who has 10.0.0.1? Tell 10.0.0.5
# ARP reply:   10.0.0.1 is at 00:50:56:aa:bb:cc
# tshark: tshark -i eth0 -f "arp" -T fields -e arp.src.proto_ipv4 -e arp.dst.proto_ipv4`);

// ── Display Filters — Basic ────────────────────────────────────────────────────
patch('Display Filters — Basic', 'frame.len > 1500',
`# Matches frames larger than 1500 bytes (standard Ethernet MTU).
# Indicates jumbo frames (if switch/NIC supports them) or oversized frames.
# Frame 12:  10.0.0.5 → 10.0.0.10  TCP [PSH,ACK] Len=4096  (jumbo path)
# If DF=1 frames > 1500 are seen dropping — suspect PMTUD blackhole.`);

patch('Display Filters — Basic', 'frame.time >= "2026-04-24 09:00:00" and frame.time <= "2026-04-24 09:05:00"',
`# Narrows the display to a specific 5-minute window.
# Correlate packet captures with a known incident time window.
# Adjust timestamps to UTC or local time matching your capture clock.
# Wireshark clock format: View → Time Display Format → Date and Time of Day`);

patch('Display Filters — Basic', 'frame.number == 1234',
`# Jumps display to frame 1234 in the packet list.
# Equivalent to Ctrl+G (Go to Packet) → enter 1234.
# Useful when referencing a specific frame from a prior analysis session.`);

patch('Display Filters — Basic', 'ip.ttl < 5',
`# Matches packets with TTL nearly expired (fewer than 5 hops remaining).
# Indicates routing loops or unexpectedly long paths.
# Frame 8:  src=10.0.0.1 dst=10.0.0.2  TTL=2  ICMP Time Exceeded
# To exclude traceroute noise: ip.ttl < 5 and not icmp.type == 11`);

patch('Display Filters — Basic', 'ip.flags.df == 1 and ip.len > 1400',
`# Matches IP packets with Don't Fragment (DF) set that approach MTU size.
# Key indicator for Path MTU Discovery (PMTUD) blackhole issues.
# If DF=1 packets > 1400 bytes are being dropped, look for:
#   icmp.type == 3 and icmp.code == 4  (Fragmentation Needed replies)
# Absence of those ICMP messages confirms a PMTUD blackhole.`);

// ── Display Filters — TCP/UDP ──────────────────────────────────────────────────
patch('Display Filters — TCP/UDP', 'tcp.port == 443',
`# Matches TCP frames where source OR destination port is 443 (HTTPS).
# Shows the full bidirectional TLS session.
# Frame 1: 10.0.0.5:54321 → 10.0.0.10:443  [SYN]
# Frame 2: 10.0.0.10:443  → 10.0.0.5:54321  [SYN,ACK]
# Pair with the tls filter to inspect handshake details.`);

patch('Display Filters — TCP/UDP', 'tcp.srcport == 22',
`# Matches TCP frames where the source port is 22 (SSH server replies).
# Shows only traffic leaving an SSH server — the response direction.
# Frame 5:  10.0.0.1:22 → 10.0.0.5:60234  [PSH,ACK] Len=52
# For the full session use: tcp.port == 22`);

patch('Display Filters — TCP/UDP', 'tcp.dstport == 80',
`# Matches TCP frames destined for port 80 — client-to-server HTTP.
# Frame 1:  10.0.0.5:55123 → 10.0.0.10:80  [SYN]
# Frame 3:  10.0.0.5:55123 → 10.0.0.10:80  GET /index.html HTTP/1.1
# Pair with tcp.srcport == 80 to see server responses separately.`);

patch('Display Filters — TCP/UDP', 'tcp.flags.syn == 1 and tcp.flags.ack == 0',
`# Matches pure SYN packets — new TCP connection attempts (3-way handshake step 1).
# Frame 1:  10.0.0.5:54321 → 10.0.0.10:80  [SYN] Seq=0 Win=65535
# High rate from one IP = port scan or SYN flood.
# Pair with Statistics → Conversations to count connections per source.`);

patch('Display Filters — TCP/UDP', 'tcp.flags.syn == 1 and tcp.flags.ack == 1',
`# Matches SYN-ACK packets — server accepting a connection (step 2).
# Frame 2:  10.0.0.10:80 → 10.0.0.5:54321  [SYN,ACK] Seq=0 Ack=1
# SYN seen but no SYN-ACK = port is closed or firewalled.`);

patch('Display Filters — TCP/UDP', 'tcp.flags.reset == 1',
`# Matches all TCP RST packets — abrupt connection termination.
# RST from server = port closed or session rejected by application.
# RST from client = application aborted the connection.
# Frame 4:  10.0.0.10:80 → 10.0.0.5:54321  [RST,ACK] Seq=1 Ack=1
# High RST rate often means firewall blocking or a crashed service.`);

patch('Display Filters — TCP/UDP', 'tcp.flags.fin == 1',
`# Matches FIN packets — graceful TCP connection teardown.
# Normal flow: client FIN → server FIN,ACK → client ACK
# Frame 20: 10.0.0.5:54321 → 10.0.0.10:80  [FIN,ACK] Seq=423 Ack=1890
# Absence of FIN (only RST) indicates ungraceful disconnection.`);

patch('Display Filters — TCP/UDP', 'tcp.analysis.retransmission',
`# Matches frames Wireshark has identified as TCP retransmissions.
# [TCP Retransmission] appears in the Info column for these frames.
# Frame 15: 10.0.0.5:54321 → 10.0.0.10:80  [TCP Retransmission] Seq=1001
# High retransmission rate → packet loss, congestion, or MTU mismatch.`);

patch('Display Filters — TCP/UDP', 'tcp.analysis.fast_retransmission',
`# Matches fast retransmissions — triggered by 3 duplicate ACKs.
# Indicates packet loss detected before RTO timer expires.
# Frame 18: 10.0.0.5 → 10.0.0.10  [TCP Fast Retransmission] Seq=2001
# Fast retransmission is less severe than RTO expiry but still means loss.`);

patch('Display Filters — TCP/UDP', 'tcp.analysis.duplicate_ack',
`# Matches duplicate ACK frames — receiver signalling a missing segment.
# Three duplicate ACKs trigger fast retransmission at the sender.
# Frame 16: 10.0.0.10 → 10.0.0.5  [TCP Dup ACK 14#1] Ack=2001 Win=65535
# Frame 17: 10.0.0.10 → 10.0.0.5  [TCP Dup ACK 14#2] Ack=2001 Win=65535
# Consistent dup ACKs point to segment loss between sender and receiver.`);

// ── Display Filters — HTTP/HTTPS ───────────────────────────────────────────────
patch('Display Filters — HTTP/HTTPS', 'http',
`# Matches all HTTP/1.x frames (requests and responses on any port).
# Does not show HTTPS (TLS-encrypted) — use tls for encrypted traffic.
# Frame 3:  10.0.0.5 → 10.0.0.10  GET /index.html HTTP/1.1
# Frame 4:  10.0.0.10 → 10.0.0.5  HTTP/1.1 200 OK  (text/html, 4.2 KB)`);

patch('Display Filters — HTTP/HTTPS', 'http.request',
`# Matches only HTTP request frames (GET, POST, PUT, DELETE, etc.).
# Filters out responses — shows only what the client is requesting.
# Frame 3:  GET /api/v1/users HTTP/1.1  Host: 10.0.0.10
# Frame 7:  POST /login HTTP/1.1  Host: 10.0.0.10  Content-Length: 32
# Useful for auditing all endpoints accessed during a test session.`);

patch('Display Filters — HTTP/HTTPS', 'http.response',
`# Matches only HTTP response frames from the server.
# Frame 4:  HTTP/1.1 200 OK   Content-Type: application/json
# Frame 8:  HTTP/1.1 401 Unauthorized  WWW-Authenticate: Bearer
# Pair with http.response.code to filter specific status codes.`);

patch('Display Filters — HTTP/HTTPS', 'http.request.method == "POST"',
`# Matches HTTP POST requests — form submissions, API writes, file uploads.
# Frame 7:  POST /login HTTP/1.1  Host: 10.0.0.10
#   Content-Type: application/x-www-form-urlencoded
#   Content-Length: 32   username=admin&password=secret
# Right-click → Follow → HTTP Stream to see the full request + response body.`);

patch('Display Filters — HTTP/HTTPS', 'http.request.method == "GET"',
`# Matches HTTP GET requests — page loads, API reads, resource fetches.
# Frame 3:  GET /index.html HTTP/1.1   Host: example.com
# Frame 5:  GET /api/v1/status HTTP/1.1  Authorization: Bearer eyJhbGc...`);

patch('Display Filters — HTTP/HTTPS', 'http.request.uri contains "login"',
`# Matches any HTTP request whose URI path contains the string "login".
# Frame 7:  POST /login HTTP/1.1
# Frame 12: GET /user/login?redirect=/dashboard HTTP/1.1
# Useful for tracking authentication flows during security testing.`);

patch('Display Filters — HTTP/HTTPS', 'http.host == "example.com"',
`# Matches HTTP requests targeting a specific virtual host.
# Frame 3:  GET /index.html HTTP/1.1  Host: example.com
# Useful when a server hosts multiple virtual hosts on the same IP.`);

patch('Display Filters — HTTP/HTTPS', 'http.user_agent contains "curl"',
`# Matches HTTP requests made by curl (or tools advertising curl as UA).
# Frame 3:  GET /api/data HTTP/1.1  User-Agent: curl/8.5.0
# Useful for identifying scripted or automated HTTP traffic.`);

patch('Display Filters — HTTP/HTTPS', 'http.response.code == 500',
`# Matches HTTP 500 Internal Server Error responses.
# Frame 8:  HTTP/1.1 500 Internal Server Error  Content-Length: 1234
# Follow the stream to see the error body and the matching request.
# Use during load testing to quickly find server-side failures.`);

patch('Display Filters — HTTP/HTTPS', 'http.response.code >= 400 and http.response.code < 600',
`# Matches all HTTP 4xx (client errors) and 5xx (server errors).
# Frame 8:  HTTP/1.1 401 Unauthorized
# Frame 12: HTTP/1.1 403 Forbidden
# Frame 15: HTTP/1.1 500 Internal Server Error
# Good starting filter when debugging broken API calls or auth failures.`);

// ── Display Filters — TLS/SSL ──────────────────────────────────────────────────
patch('Display Filters — TLS/SSL', 'tls',
`# Matches all TLS/SSL record layer frames (handshake, data, alerts).
# Frame 5:  10.0.0.5 → 10.0.0.10  TLSv1.3 Handshake Protocol: Client Hello
# Frame 6:  10.0.0.10 → 10.0.0.5  TLSv1.3 Handshake Protocol: Server Hello
# Application data records appear as [encrypted] after the handshake.`);

patch('Display Filters — TLS/SSL', 'tls.handshake',
`# Matches TLS handshake messages only (not application data or alerts).
# Frame 5:  TLSv1.3  Handshake Protocol: Client Hello
# Frame 6:  TLSv1.3  Handshake Protocol: Server Hello
# Frame 7:  TLSv1.3  Handshake Protocol: Certificate
# Frame 8:  TLSv1.3  Handshake Protocol: Finished`);

patch('Display Filters — TLS/SSL', 'tls.handshake.type == 1',
`# Matches TLS ClientHello messages (type 1) — client initiates TLS.
# Frame 5:  TLSv1.3 Client Hello
#   SNI: example.com
#   Supported versions: TLS 1.3, TLS 1.2
#   Cipher suites offered: 17
# Useful for inventorying TLS versions and cipher suites in use.`);

patch('Display Filters — TLS/SSL', 'tls.handshake.type == 2',
`# Matches TLS ServerHello messages (type 2) — server selects parameters.
# Frame 6:  TLSv1.3 Server Hello
#   Version: TLS 1.3
#   Cipher Suite: TLS_AES_256_GCM_SHA384
#   Session ID: (empty — TLS 1.3 uses PSK/ticket resumption)`);

patch('Display Filters — TLS/SSL', 'tls.handshake.type == 11',
`# Matches Certificate messages (type 11) — server's certificate chain.
# Frame 7:  TLSv1.3  Certificate
#   Certificate 1: CN=example.com   Issuer: CN=R3
#   Certificate 2: CN=R3            Issuer: CN=ISRG Root X1
# Expand the certificate tree to inspect expiry dates and SANs.`);

patch('Display Filters — TLS/SSL', 'tls.handshake.extensions_server_name == "example.com"',
`# Matches ClientHello frames with SNI set to "example.com".
# SNI is sent in the ClientHello extension before encryption.
# Frame 5:  Client Hello — server_name: example.com
# Useful for filtering TLS sessions to a specific virtual host.`);

patch('Display Filters — TLS/SSL', 'tls.record.version == 0x0301',
`# Matches TLS 1.0 record-layer frames (version 0x0301).
# TLS 1.0 is deprecated (RFC 8996) — should not appear in modern traffic.
# Frame 5:  TLSv1.0 Record Layer  — legacy client detected.
# Pair with ip.src to identify which clients are still using TLS 1.0.`);

patch('Display Filters — TLS/SSL', 'tls.record.version == 0x0303',
`# Matches TLS 1.2 record-layer frames (version 0x0303).
# TLS 1.2 is still widely used but being phased out in favour of 1.3.
# Note: TLS 1.3 also uses 0x0303 in the record layer for backward compatibility.
# Frame 5:  TLSv1.2 Record Layer: Handshake Protocol: Client Hello`);

patch('Display Filters — TLS/SSL', 'tls.record.version == 0x0304',
`# Matches TLS 1.3 record-layer frames (version 0x0304).
# TLS 1.3 provides forward secrecy and a shorter 1-RTT handshake.
# Frame 5:  TLSv1.3 Record Layer: Handshake Protocol: Client Hello
#   Supported Versions extension: TLS 1.3 (0x0304), TLS 1.2 (0x0303)`);

patch('Display Filters — TLS/SSL', 'tls.alert_message',
`# Matches TLS Alert messages — handshake failures or protocol errors.
# Frame 9:  TLSv1.3 Alert  Level: Fatal  Description: Certificate Unknown (46)
# Frame 10: TLSv1.3 Alert  Level: Fatal  Description: Handshake Failure (40)
# Alert level 2 = Fatal (connection terminated); level 1 = Warning.`);

// ── Display Filters — DNS ──────────────────────────────────────────────────────
patch('Display Filters — DNS', 'dns',
`# Matches all DNS traffic (queries and responses, UDP/TCP port 53).
# Frame 1:  10.0.0.5 → 8.8.8.8   DNS  Standard query  A  example.com
# Frame 2:  8.8.8.8 → 10.0.0.5   DNS  Standard query response  A  93.184.216.34
# Use Statistics → DNS for a breakdown of query types and RCODE distribution.`);

patch('Display Filters — DNS', 'dns.flags.response == 0',
`# Matches DNS query frames only (QR flag = 0).
# Frame 1:  10.0.0.5 → 8.8.8.8  DNS Query  A  example.com
# Useful for counting outbound queries or spotting unusual lookups.
# Pair with dns.qry.name to find lookups for specific domains.`);

patch('Display Filters — DNS', 'dns.flags.response == 1',
`# Matches DNS response frames only (QR flag = 1).
# Frame 2:  8.8.8.8 → 10.0.0.5  DNS Response  A  93.184.216.34  TTL 3600
# Pair with dns.flags.rcode != 0 to find failed responses only.`);

patch('Display Filters — DNS', 'dns.qry.name contains "example.com"',
`# Matches DNS queries where the QNAME contains "example.com".
# Catches all subdomains: api.example.com, mail.example.com, etc.
# Frame 1:  Query: api.example.com   Type: A
# Frame 3:  Query: mail.example.com  Type: MX`);

patch('Display Filters — DNS', 'dns.qry.type == 1',
`# Matches DNS A record queries (type 1 — IPv4 address lookups).
# Frame 1:  DNS Query  A  example.com
# A records are the most common query type — hostname to IPv4 mapping.
# See also: dns.qry.type == 28 for AAAA (IPv6) lookups.`);

patch('Display Filters — DNS', 'dns.qry.type == 28',
`# Matches DNS AAAA record queries (type 28 — IPv6 address lookups).
# Frame 1:  DNS Query  AAAA  example.com
# Modern resolvers query both A and AAAA simultaneously (Happy Eyeballs).
# Absence of AAAA queries may indicate IPv6 is disabled on the client.`);

patch('Display Filters — DNS', 'dns.qry.type == 15',
`# Matches DNS MX record queries (type 15 — mail exchanger lookups).
# Frame 1:  DNS Query  MX  example.com
# Frame 2:  DNS Response  MX 10  mail.example.com
# High MX query rate from one host can indicate email address enumeration.`);

patch('Display Filters — DNS', 'dns.qry.type == 33',
`# Matches DNS SRV record queries (type 33 — service locator).
# Used by SIP, XMPP, Kerberos, and LDAP for service discovery.
# Frame 1:  DNS Query  SRV  _sip._tcp.example.com
# Frame 2:  DNS Response  SRV  10 20 5060 sipserver.example.com`);

patch('Display Filters — DNS', 'dns.flags.rcode != 0',
`# Matches DNS responses with a non-zero return code (error responses).
# RCODE values: 1=FormErr, 2=ServFail, 3=NXDomain, 5=Refused
# Frame 2:  DNS Response  NXDOMAIN  nonexistent.example.com
# Frame 4:  DNS Response  SERVFAIL  broken.example.com
# High NXDOMAIN rate may indicate DGA malware or misconfigured hosts.`);

patch('Display Filters — DNS', 'dns.flags.rcode == 3',
`# Matches DNS NXDOMAIN responses (domain does not exist).
# Frame 2:  DNS Response  No such name  A  typo.examle.com
# Sudden spike in NXDOMAIN responses can indicate Domain Generation Algorithm
# (DGA) malware generating random domain names for C2 beaconing.`);

// ── Display Filters — DHCP ─────────────────────────────────────────────────────
patch('Display Filters — DHCP', 'dhcp',
`# Matches all DHCP frames (Discover, Offer, Request, ACK, NAK) on UDP 67/68.
# Frame 1:  0.0.0.0 → 255.255.255.255  DHCP Discover  Xid=0x3c4b2a1e
# Frame 2:  10.0.0.1 → 10.0.0.50       DHCP Offer     IP: 10.0.0.50
# Frame 3:  0.0.0.0 → 255.255.255.255  DHCP Request   requesting 10.0.0.50
# Frame 4:  10.0.0.1 → 10.0.0.50       DHCP ACK       lease: 86400s`);

patch('Display Filters — DHCP', 'dhcp.option.dhcp == 1',
`# Matches DHCP Discover packets (option 53 value = 1).
# Sent by client at boot as a broadcast to locate DHCP servers.
# Frame 1:  0.0.0.0 → 255.255.255.255  DHCP Discover  chaddr: aa:bb:cc:dd:ee:ff
# Multiple Discovers without an Offer = no DHCP server reachable on this VLAN.`);

patch('Display Filters — DHCP', 'dhcp.option.dhcp == 2',
`# Matches DHCP Offer packets (option 53 value = 2).
# Server response to Discover — offering an IP address to the client.
# Frame 2:  10.0.0.1 → 255.255.255.255  DHCP Offer  IP: 10.0.0.100  lease: 86400
# Multiple Offers from different source IPs = rogue DHCP server on network.`);

patch('Display Filters — DHCP', 'dhcp.option.dhcp == 3',
`# Matches DHCP Request packets (option 53 value = 3).
# Client broadcasts acceptance of a specific server's Offer.
# Frame 3:  0.0.0.0 → 255.255.255.255  DHCP Request  requesting 10.0.0.100
# Also sent unicast during lease renewal (50% of lease time).`);

patch('Display Filters — DHCP', 'dhcp.option.dhcp == 5',
`# Matches DHCP ACK packets (option 53 value = 5) — lease confirmed.
# Frame 4:  10.0.0.1 → 10.0.0.100  DHCP ACK  lease: 86400s  router: 10.0.0.1
# Client configures the IP, mask, gateway, and DNS options from the ACK.`);

patch('Display Filters — DHCP', 'dhcp.option.dhcp == 6',
`# Matches DHCP NAK packets (option 53 value = 6) — lease rejected.
# Server rejects a Request (e.g. client moved to a different subnet).
# Frame 4:  10.0.0.1 → 255.255.255.255  DHCP NAK
# Client must restart the DORA process from Discover.`);

patch('Display Filters — DHCP', 'dhcp.option.dhcp == 7',
`# Matches DHCP Release packets (option 53 value = 7).
# Client gracefully releases its lease when disconnecting.
# Frame 10: 10.0.0.100 → 10.0.0.1  DHCP Release  releasing 10.0.0.100`);

patch('Display Filters — DHCP', 'dhcp.hw.mac_addr == aa:bb:cc:dd:ee:ff',
`# Matches DHCP packets from a specific client MAC address.
# Replace aa:bb:cc:dd:ee:ff with the client's hardware address.
# Frame 1:  DHCP Discover  chaddr: aa:bb:cc:dd:ee:ff
# Frame 3:  DHCP Request   chaddr: aa:bb:cc:dd:ee:ff
# Useful for isolating a single client's DORA conversation.`);

patch('Display Filters — DHCP', 'dhcpv6',
`# Matches DHCPv6 frames (Solicit, Advertise, Request, Reply) on UDP 546/547.
# Frame 1:  fe80::1 → ff02::1:2  DHCPv6 Solicit   DUID: xx:xx:xx:xx
# Frame 2:  fe80::1 → fe80::2    DHCPv6 Advertise  IA_NA: 2001:db8::100
# Used for stateful IPv6 address assignment (vs SLAAC which uses RA only).`);

patch('Display Filters — DHCP', 'bootp.option.value',
`# In older Wireshark builds (<3.0) DHCP frames are decoded under the bootp dissector.
# bootp.option.value matches any DHCP option value field.
# Upgrade to Wireshark 3.0+ where DHCP has its own dedicated dissector
# and dhcp.option.dhcp and related fields are available.`);

// ── Display Filters — ARP / ICMP ──────────────────────────────────────────────
patch('Display Filters — ARP / ICMP', 'arp',
`# Matches all ARP frames (Requests and Replies).
# Frame 1:  ARP  Who has 10.0.0.1? Tell 10.0.0.5
# Frame 2:  ARP  10.0.0.1 is at 00:50:56:aa:bb:cc
# High ARP rate on a VLAN can indicate an ARP storm or active scanning tool.`);

patch('Display Filters — ARP / ICMP', 'arp.opcode == 1',
`# Matches ARP Request frames (opcode 1 = "Who has?").
# Frame 1:  ARP Request  Who has 10.0.0.1? Tell 10.0.0.5
# Rapid ARP requests targeting many different IPs = network discovery / scan.`);

patch('Display Filters — ARP / ICMP', 'arp.opcode == 2',
`# Matches ARP Reply frames (opcode 2 = "Is at").
# Frame 2:  ARP Reply  10.0.0.1 is at 00:50:56:aa:bb:cc
# Unsolicited ARP replies (Gratuitous ARP) are used when a device changes IP
# or a cluster IP fails over — normal in HA environments.`);

patch('Display Filters — ARP / ICMP', 'arp.duplicate-address-detected',
`# Wireshark expert flag — set when the same IP is claimed by two MAC addresses.
# Frame 3:  [ARP] Duplicate IP address detected for 10.0.0.1
#   First seen from: 00:50:56:aa:bb:cc
#   Now seen from:   00:11:22:33:44:55
# Indicates duplicate IP configuration or ARP poisoning (MITM attack).`);

patch('Display Filters — ARP / ICMP', 'arp.src.proto_ipv4 == 10.0.0.1',
`# Matches ARP frames where the sender protocol address is 10.0.0.1.
# Captures all ARP requests and replies originating from that IP.
# Useful for confirming a host's ARP behaviour or detecting IP spoofing.`);

patch('Display Filters — ARP / ICMP', 'icmp',
`# Matches all ICMP frames (echo, unreachable, time exceeded, redirect…).
# Frame 1:  ICMP Echo (ping) request  id=0x0001 seq=1  ttl=64
# Frame 2:  ICMP Echo (ping) reply    id=0x0001 seq=1  ttl=64
# Common types: 0=Echo Reply, 3=Unreachable, 8=Echo Request, 11=TTL Exceeded`);

patch('Display Filters — ARP / ICMP', 'icmp.type == 0',
`# Matches ICMP Echo Reply messages (type 0) — ping responses.
# Frame 2:  ICMP Echo reply  id=0x0001 seq=1  ttl=64
# If Echo Requests (type 8) are seen but no type 0: host is down or firewalled.`);

patch('Display Filters — ARP / ICMP', 'icmp.type == 8',
`# Matches ICMP Echo Request messages (type 8) — ping probes.
# Frame 1:  ICMP Echo request  id=0x0001 seq=1  ttl=64
# Many Echo Requests to different hosts in rapid succession = ping sweep.`);

patch('Display Filters — ARP / ICMP', 'icmp.type == 3',
`# Matches ICMP Destination Unreachable messages (type 3).
# Sub-codes: 0=Net, 1=Host, 2=Protocol, 3=Port, 4=Fragmentation Needed
# Frame 3:  ICMP Destination unreachable  (Port unreachable)
# Code 4 (Fragmentation Needed) = PMTUD signal — look for DF-bit packets.`);

patch('Display Filters — ARP / ICMP', 'icmp.type == 11',
`# Matches ICMP Time Exceeded messages (type 11) — TTL expired in transit.
# Each hop in a traceroute sends a Time Exceeded reply back to the source.
# Frame 5:  ICMP Time-to-live exceeded (Time to live exceeded in transit)
#   Source: 10.10.1.1  (intermediate router hop)
# Code 0 = TTL exceeded; Code 1 = Fragment reassembly time exceeded.`);

// ── Display Filters — VoIP / SIP / RTP ────────────────────────────────────────
patch('Display Filters — VoIP / SIP / RTP', 'sip',
`# Matches all SIP signalling frames (UDP/TCP 5060, TLS 5061).
# Frame 1:  10.0.0.5 → 10.0.0.20  INVITE sip:bob@example.com SIP/2.0
# Frame 2:  10.0.0.20 → 10.0.0.5  SIP/2.0 100 Trying
# Frame 3:  10.0.0.20 → 10.0.0.5  SIP/2.0 200 OK
# Use Telephony → VoIP Calls for a graphical call flow diagram.`);

patch('Display Filters — VoIP / SIP / RTP', 'sip.Method == "INVITE"',
`# Matches SIP INVITE messages — initiating a voice/video call.
# Frame 1:  INVITE sip:bob@example.com SIP/2.0
#   Call-ID: 1234@10.0.0.5  From: Alice  To: Bob
#   Content-Type: application/sdp   (SDP offer inside the body)
# Each INVITE starts a new call leg; re-INVITE renegotiates media parameters.`);

patch('Display Filters — VoIP / SIP / RTP', 'sip.Method == "BYE"',
`# Matches SIP BYE messages — terminating an active call.
# Frame 40: BYE sip:bob@example.com SIP/2.0  Call-ID: 1234@10.0.0.5
# If BYE is absent at call end — the call was dropped rather than hung up.
# Look for SIP 4xx/5xx errors that may have caused an unexpected teardown.`);

patch('Display Filters — VoIP / SIP / RTP', 'sip.Status-Code >= 400',
`# Matches SIP error responses (4xx client, 5xx server, 6xx global failure).
# Frame 5:  SIP/2.0 404 Not Found       (called party doesn't exist)
# Frame 8:  SIP/2.0 403 Forbidden       (authentication failure)
# Frame 12: SIP/2.0 503 Service Unavailable  (server overload / registrar down)`);

patch('Display Filters — VoIP / SIP / RTP', 'sip.Call-ID == "<id>"',
`# Matches all SIP messages belonging to a specific call leg.
# Replace <id> with the actual Call-ID value from the SIP headers.
# Frame 1:  INVITE  Call-ID: abc123@10.0.0.5
# Frame 5:  200 OK  Call-ID: abc123@10.0.0.5
# Frame 40: BYE     Call-ID: abc123@10.0.0.5
# Shows the complete signalling dialogue for one call from start to finish.`);

patch('Display Filters — VoIP / SIP / RTP', 'rtp',
`# Matches RTP media stream frames (voice/video payload packets).
# Frame 10: 10.0.0.5 → 10.0.0.20  RTP  PT=PCMU (0)  Seq=1  TS=160
# RTP uses dynamic UDP ports negotiated in the SDP body of the INVITE.
# Use Telephony → RTP → Show All Streams for jitter and packet loss stats.`);

patch('Display Filters — VoIP / SIP / RTP', 'rtp.p_type == 0',
`# Matches RTP frames carrying G.711 μ-law (PCMU) codec — payload type 0.
# Standard PSTN-quality voice codec, 64 kbps, common in enterprise VoIP.
# Frame 10: RTP  PCMU  Seq=1  SSRC=0x12345678  Timestamp=160
# Use Telephony → RTP → Play Streams to listen to the captured audio.`);

patch('Display Filters — VoIP / SIP / RTP', 'rtp.p_type == 8',
`# Matches RTP frames carrying G.711 a-law (PCMA) codec — payload type 8.
# Used predominantly in European and international telephony networks.
# Frame 10: RTP  PCMA  Seq=1  SSRC=0xABCDEF01  Timestamp=160`);

patch('Display Filters — VoIP / SIP / RTP', 'rtp.marker == 1',
`# Matches RTP frames with the Marker bit set.
# In voice codecs: marks the first packet after a silence period ends.
# In video codecs: typically marks the last RTP packet of a video frame.
# Frame 35: RTP  PT=PCMU  Marker=1  — start of a new voice talkspurt.`);

patch('Display Filters — VoIP / SIP / RTP', 'rtcp',
`# Matches RTCP control packets — quality reports for RTP media streams.
# RTCP carries statistics: packet loss, jitter, and round-trip delay.
# Frame 20: RTCP Sender Report  SSRC=0x12345678
#   Packet count: 500  Octet count: 80000  NTP TS: 2026-01-01 12:00:00 UTC
# Expand Receiver Report Blocks to see per-stream jitter and loss percentage.`);

// ── Display Filters — AD / Kerberos / SMB / LDAP ─────────────────────────────
patch('Display Filters — AD / Kerberos / SMB / LDAP', 'kerberos',
`# Matches all Kerberos protocol frames (typically UDP/TCP port 88).
# Frame 1:  10.0.0.5 → 10.0.0.1  KRB5  AS-REQ  (user@DOMAIN.COM)
# Frame 2:  10.0.0.1 → 10.0.0.5  KRB5  AS-REP  (TGT issued)
# Frame 3:  10.0.0.5 → 10.0.0.1  KRB5  TGS-REQ (requesting service ticket)
# Use Wireshark → Statistics → Credentials to extract Kerberos usernames.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'kerberos.msg_type == 10',
`# Matches Kerberos AS-REQ messages (type 10) — login authentication requests.
# Client sends AS-REQ to the KDC to obtain a Ticket Granting Ticket (TGT).
# Frame 1:  KRB5 AS-REQ  cname: alice@DOMAIN.COM  sname: krbtgt/DOMAIN.COM
# High AS-REQ rate without AS-REP responses may indicate Kerberoasting attack.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'kerberos.msg_type == 12',
`# Matches Kerberos TGS-REQ messages (type 12) — service ticket requests.
# Client presents its TGT to the KDC to request a ticket for a service.
# Frame 3:  KRB5 TGS-REQ  sname: host/fileserver.domain.com  realm: DOMAIN.COM
# Multiple TGS-REQ for different services in short succession = normal operation.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'kerberos.error_code',
`# Matches any Kerberos error response (KRB-ERROR frames).
# Frames contain a numeric error code and descriptive text.
# Frame 5:  KRB5 KRB-ERROR  error-code: eRR-CLIENT-REVOKED (18)
# All non-zero error codes indicate authentication or authorisation failures.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'kerberos.error_code == 24',
`# Matches Kerberos error 24: KDC_ERR_PREAUTH_FAILED — wrong password.
# The pre-authentication data supplied was invalid (incorrect credentials).
# Frame 5:  KRB5 KRB-ERROR  eRR-PREAUTH-FAILED  (alice@DOMAIN.COM)
# Multiple KDC_ERR_PREAUTH_FAILED from one IP = brute-force or password spray.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'kerberos.error_code == 37',
`# Matches Kerberos error 37: KRB_AP_ERR_SKEW — clock skew too large.
# Kerberos requires all clocks to be within 5 minutes of each other.
# Frame 5:  KRB5 KRB-ERROR  eRR-SKEW  — time difference > 300 seconds
# Fix: ensure all domain members sync to the PDC emulator via NTP.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'ldap',
`# Matches LDAP frames on TCP 389 (cleartext) or TCP 636 (LDAPS).
# Frame 1:  10.0.0.5 → 10.0.0.1  LDAP  bindRequest  (simple auth)
# Frame 2:  10.0.0.1 → 10.0.0.5  LDAP  bindResponse  result: success
# Simple binds on port 389 expose credentials in BASE64 — visible as cleartext.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'ldap.messageType == 3',
`# Matches LDAP searchRequest messages (messageType 3).
# Frame 3:  LDAP searchRequest  base: DC=domain,DC=com
#   filter: (sAMAccountName=alice)  scope: wholeSubtree
# Excessive LDAP searches from one host = Active Directory enumeration.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'smb',
`# Matches SMBv1 frames (TCP 445 or 139).
# Frame 1:  SMB  Negotiate Protocol Request
# Frame 2:  SMB  Negotiate Protocol Response
# SMBv1 is deprecated and exploitable (EternalBlue/MS17-010).
# Use smb2 filter for modern Windows file sharing.`);

patch('Display Filters — AD / Kerberos / SMB / LDAP', 'smb2',
`# Matches SMBv2/3 frames (TCP 445) — modern Windows file sharing.
# Frame 1:  SMB2  Negotiate Protocol Request   Dialects: [3.1.1, 3.0.2, 2.1]
# Frame 2:  SMB2  Negotiate Protocol Response  Dialect: 3.1.1
# Frame 3:  SMB2  Session Setup Request        (Kerberos authentication)
# SMB 3.x supports encryption and multichannel — preferred over SMBv1/v2.`);

// ── Display Filters — Routing / Switching Control Plane ───────────────────────
patch('Display Filters — Routing / Switching Control Plane', 'ospf',
`# Matches all OSPF frames (IP protocol 89).
# Frame 1:  10.0.0.1 → 224.0.0.5  OSPF  Hello Packet  (area 0.0.0.0)
# Frame 5:  10.0.0.1 → 10.0.0.2   OSPF  DB Description (exstart state)
# Use to troubleshoot neighbour formation, LSA flooding, or area mismatches.`);

patch('Display Filters — Routing / Switching Control Plane', 'ospf.msg == 1',
`# Matches OSPF Hello packets (message type 1).
# Hellos establish and maintain adjacencies between OSPF neighbours.
# Frame 1:  OSPF Hello  Router-ID: 1.1.1.1  Area: 0.0.0.0  Neighbours: [2.2.2.2]
# Missing Hellos within the Dead Interval causes the neighbour to go Down.
# Common mismatch causes: Hello/Dead interval, area ID, MTU, authentication.`);

patch('Display Filters — Routing / Switching Control Plane', 'eigrp',
`# Matches EIGRP frames (IP protocol 88, multicast 224.0.0.10).
# Frame 1:  10.0.0.1 → 224.0.0.10  EIGRP Hello  (AS 100)
# Frame 3:  10.0.0.1 → 10.0.0.2    EIGRP Update (routes advertised)
# EIGRP is Cisco proprietary — only seen in Cisco IOS/IOS-XE environments.`);

patch('Display Filters — Routing / Switching Control Plane', 'bgp',
`# Matches BGP frames (TCP port 179).
# Frame 1:  10.0.0.1 → 10.0.0.2  BGP OPEN  (AS 65001, hold time 90s)
# Frame 2:  10.0.0.2 → 10.0.0.1  BGP OPEN  (AS 65002, hold time 90s)
# Frame 3:  10.0.0.1 → 10.0.0.2  BGP KEEPALIVE
# Session resets appear as BGP NOTIFICATION messages (filter: bgp.type == 3).`);

patch('Display Filters — Routing / Switching Control Plane', 'bgp.type == 1',
`# Matches BGP OPEN messages (type 1) — session establishment.
# Frame 1:  BGP OPEN  My AS: 65001  Hold Time: 90  BGP ID: 10.0.0.1
#   Capabilities: 4-byte AS, route-refresh, multiprotocol (IPv4 unicast)`);

patch('Display Filters — Routing / Switching Control Plane', 'bgp.type == 2',
`# Matches BGP UPDATE messages (type 2) — route advertisements and withdrawals.
# Frame 5:  BGP UPDATE  Withdrawn: 192.168.0.0/24  NLRI: 10.10.0.0/16
# Each UPDATE can carry multiple prefixes added or withdrawn simultaneously.`);

patch('Display Filters — Routing / Switching Control Plane', 'bgp.type == 3',
`# Matches BGP NOTIFICATION messages (type 3) — error conditions.
# Frame 8:  BGP NOTIFICATION  Error: Hold Timer Expired (code 4)
# Frame 9:  BGP NOTIFICATION  Error: UPDATE Message Error, bad NEXT_HOP (code 3/8)
# A NOTIFICATION immediately terminates the BGP session.`);

patch('Display Filters — Routing / Switching Control Plane', 'stp',
`# Matches STP/RSTP/MSTP Bridge PDUs (BPDUs) — multicast to 01:80:c2:00:00:00.
# Frame 1:  STP  Configuration BPDU  Root: 4096:00:50:56:aa:bb:cc  Cost: 0
# TCN (Topology Change Notification) BPDUs indicate a topology change event.
# High BPDU rate or flapping port IDs can cause MAC table instability.`);

patch('Display Filters — Routing / Switching Control Plane', 'lldp',
`# Matches LLDP frames (EtherType 0x88cc, multicast to 01:80:c2:00:00:0e).
# Frame 1:  00:50:56:aa:bb:cc → 01:80:c2:00:00:0e  LLDP
#   Chassis ID: 00:50:56:aa:bb:cc  Port ID: GigabitEthernet0/1
#   System Name: switch01.example.com  TTL: 120s
# Useful for discovering adjacent device identity and port mappings.`);

patch('Display Filters — Routing / Switching Control Plane', 'cdp',
`# Matches CDP frames (Cisco proprietary SNAP 0x2000, to 01:00:0c:cc:cc:cc).
# Frame 1:  00:50:56:aa:bb:cc → 01:00:0c:cc:cc:cc  CDP
#   Device ID: router01.example.com  Port: GigabitEthernet0/0
#   Platform: Cisco ISR4451  Version: Cisco IOS XE 17.9.4a
# CDP is Cisco-only — use lldp filter for multi-vendor environments.`);

// ── Display Filters — 802.11 / Wireless ───────────────────────────────────────
patch('Display Filters — 802.11 / Wireless', 'wlan',
`# Matches all 802.11 (Wi-Fi) frames — requires monitor mode capture.
# Frame 1:  aa:bb:cc:11:22:33 → ff:ff:ff:ff:ff:ff  802.11 Beacon  SSID: CorpWiFi
# Enable monitor mode on Linux: sudo iw dev wlan0 set type monitor
# On macOS: Wireless Diagnostics → Window → Sniffer`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type == 0',
`# Matches 802.11 Management frames (frame type field = 0).
# Includes: Beacon, Probe Request/Response, Auth, Assoc, Deauth, Disassoc.
# Frame 1:  Beacon         SSID: CorpWiFi  Channel: 6
# Frame 5:  Probe Request  SSID: * (wildcard broadcast probe from client)
# Frame 8:  Auth Request   to AP 00:11:22:33:44:55`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type_subtype == 0x08',
`# Matches 802.11 Beacon frames (subtype 8) — APs advertise ~10 per second.
# Frame 1:  Beacon  SSID: CorpWiFi  BSSID: 00:11:22:33:44:55  Channel: 6
#   RSN: WPA2-CCMP  Supported rates: 6,9,12,18,24,36,48,54 Mbps
# Multiple BSSIDs sharing the same SSID = same ESS (roaming network).`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type_subtype == 0x04',
`# Matches 802.11 Probe Request frames (subtype 4).
# Clients send probe requests to find specific SSIDs or discover all APs.
# Frame 5:  Probe Request  SA: aa:bb:cc:dd:ee:ff  SSID: * (wildcard)
# The client's Preferred Network List (PNL) is exposed by directed probes.`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type_subtype == 0x05',
`# Matches 802.11 Probe Response frames (subtype 5).
# APs reply to directed probe requests with their capabilities.
# Frame 7:  Probe Response  BSSID: 00:11:22:33:44:55  SSID: CorpWiFi
#   Capabilities: ESS, Privacy  RSN: WPA2-CCMP  Channel: 6`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type_subtype == 0x0b',
`# Matches 802.11 Authentication frames (subtype 11).
# Frame 8:  Authentication  Open System  Seq: 1  Status: Successful
# Frame 9:  Authentication  Open System  Seq: 2  Status: Successful
# WPA2/3: Authentication is Open System; the 4-way EAPOL handshake follows.`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type_subtype == 0x00',
`# Matches 802.11 Association Request frames (subtype 0).
# Client requests to join an AP after successful authentication.
# Frame 10: Association Request  SSID: CorpWiFi  Capabilities: ESS
#   Supported rates: 1,2,5.5,11,6,9,12,18,24,36,48,54 Mbps
#   RSN: WPA2 (CCMP pairwise and group cipher)`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type_subtype == 0x0c',
`# Matches 802.11 Deauthentication frames (subtype 12).
# Frame 15: Deauthentication  BSSID: 00:11:22:33:44:55  Reason: 2
# Reason 2 = Previous authentication no longer valid.
# Flood of deauth frames targeting a client = deauthentication (DoS) attack.
# WPA3 / 802.11w Protected Management Frames (PMF) can mitigate deauth attacks.`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type_subtype == 0x0a',
`# Matches 802.11 Disassociation frames (subtype 10).
# Frame 20: Disassociation  Reason: 8 (STA leaving the BSS)
# Disassoc preserves authentication state; Deauth (0x0c) removes both.`);

patch('Display Filters — 802.11 / Wireless', 'wlan.fc.type == 1',
`# Matches 802.11 Control frames (frame type 1).
# Includes: RTS, CTS, ACK, PS-Poll, Block ACK Request/Response.
# Frame 2:  Acknowledgement    RA: aa:bb:cc:dd:ee:ff
# Frame 3:  Clear-To-Send      RA: aa:bb:cc:dd:ee:ff  Duration: 160μs
# Control frames coordinate medium access and are not normally analysed.`);

// ── Display Filters — VPN / IPsec / GRE ───────────────────────────────────────
patch('Display Filters — VPN / IPsec / GRE', 'isakmp',
`# Matches ISAKMP / IKEv1 / IKEv2 frames (UDP port 500; NAT-T on UDP 4500).
# Frame 1:  10.0.0.5 → 10.0.0.10  ISAKMP  IKEv2 IKE_SA_INIT Request
# Frame 2:  10.0.0.10 → 10.0.0.5  ISAKMP  IKEv2 IKE_SA_INIT Response
# IKEv2: SA_INIT (2 msgs) + IKE_AUTH (2 msgs) = full tunnel setup in 4 messages.`);

patch('Display Filters — VPN / IPsec / GRE', 'esp',
`# Matches ESP (Encapsulating Security Payload) frames — IPsec encrypted data.
# ESP payload is encrypted; Wireshark shows SPI and sequence number only.
# Frame 5:  10.0.0.5 → 10.0.0.10  ESP  SPI=0x12345678  Seq=42
# To decrypt: Edit → Preferences → Protocols → ESP → provide session keys.`);

patch('Display Filters — VPN / IPsec / GRE', 'ah',
`# Matches AH (Authentication Header) frames — IPsec integrity without encryption.
# AH provides data integrity and origin authentication but no confidentiality.
# Frame 5:  10.0.0.5 → 10.0.0.10  AH  SPI=0xABCDEF01  Seq=10
# AH is rarely deployed; ESP with NULL encryption covers the same use case.`);

patch('Display Filters — VPN / IPsec / GRE', 'gre',
`# Matches GRE (Generic Routing Encapsulation) frames (IP protocol 47).
# Frame 1:  10.0.0.5 → 10.0.0.10  GRE  Protocol: IPv4 (0x0800)
# GRE is used for DMVPN, mGRE, or GRE-over-IPsec configurations.
# Inner payload (IPv4/IPv6/MPLS) is visible if not additionally encrypted.`);

patch('Display Filters — VPN / IPsec / GRE', 'ip.proto == 47',
`# Matches frames with IP protocol number 47 (GRE).
# Equivalent to the gre display filter; useful in compound expressions:
#   ip.src == 10.0.0.5 and ip.proto == 47
# Can detect unexpected GRE tunnels from unauthorised hosts.`);

patch('Display Filters — VPN / IPsec / GRE', 'ip.proto == 50',
`# Matches frames with IP protocol 50 (ESP — IPsec data traffic).
# Frame 5:  10.0.0.5 → 10.0.0.10  Protocol: ESP  (encrypted)
# No ESP seen after IKE negotiation = Phase 2 / CHILD_SA failure.
# Check: mismatched transform sets, ACLs blocking protocol 50.`);

patch('Display Filters — VPN / IPsec / GRE', 'ip.proto == 51',
`# Matches frames with IP protocol 51 (AH — Authentication Header).
# Frame 5:  10.0.0.5 → 10.0.0.10  Protocol: AH
# If AH is seen, traffic is integrity-protected but NOT encrypted.
# Rarely used in practice — ESP with authentication covers the same need.`);

patch('Display Filters — VPN / IPsec / GRE', 'l2tp',
`# Matches L2TP (Layer 2 Tunneling Protocol) control frames (UDP 1701).
# Frame 1:  10.0.0.5 → 10.0.0.10  L2TP  Start-Control-Connection-Request
# L2TP/IPsec VPNs combine L2TP tunnel with IPsec encryption.
# Control messages: SCCRQ, SCCRP, SCCCN, ICRQ, ICRP, ICCN, CDN, StopCCN.`);

patch('Display Filters — VPN / IPsec / GRE', 'pppoes',
`# Matches PPPoE Session frames (EtherType 0x8864) — DSL broadband.
# Frame 1:  aa:bb:cc:dd:ee:ff → 00:11:22:33:44:55  PPPoE Session  PPP LCP
# PPPoE Discovery phase uses EtherType 0x8863 — filter with: pppoed
# Frame 5:  PPPoE Session  PPP IPv4  10.0.0.5 → 8.8.8.8  DNS Query`);

patch('Display Filters — VPN / IPsec / GRE', 'wireguard',
`# Matches WireGuard VPN frames (UDP, default port 51820).
# Frame 1:  10.0.0.5:51820 → 10.0.0.10:51820  WireGuard  Handshake Initiation
# Frame 2:  10.0.0.10:51820 → 10.0.0.5:51820  WireGuard  Handshake Response
# After handshake: Transport Data frames carry encrypted packets (opaque payload).`);

// ── Display Filters — Operators & Syntax ──────────────────────────────────────
patch('Display Filters — Operators & Syntax', 'tcp.port in {80 443 8080}',
`# Uses the "in" set operator — matches TCP port 80, 443, or 8080.
# Equivalent to: tcp.port == 80 or tcp.port == 443 or tcp.port == 8080
# More readable for multi-value sets; works for most numeric fields.
# ip.addr in {10.0.0.1 10.0.0.2 10.0.0.3} — filter multiple hosts at once.`);

patch('Display Filters — Operators & Syntax', '!(arp or stp or cdp or lldp)',
`# Excludes noisy background layer-2 traffic to clean up the display.
# Hides ARP broadcasts, STP BPDUs, CDP and LLDP neighbour announcements.
# Useful as a first filter when opening a capture — remove protocol noise first.
# Equivalent: not arp and not stp and not cdp and not lldp`);

patch('Display Filters — Operators & Syntax', 'ip.addr == 10.0.0.0/8 and not tcp.port == 22',
`# Matches all traffic within the 10.0.0.0/8 RFC 1918 range, excluding SSH.
# CIDR notation is natively supported in Wireshark display filters.
# Useful for isolating intranet traffic while hiding management SSH sessions.`);

patch('Display Filters — Operators & Syntax', 'frame matches "User-Agent: curl"',
`# Uses the "matches" operator (Perl-compatible regex) to search raw frame bytes.
# Matches any frame whose payload contains the literal string "User-Agent: curl".
# More powerful than "contains" — supports full PCRE regex patterns.
# frame matches "(?i)password=" — case-insensitive search for credential fields.`);

patch('Display Filters — Operators & Syntax', 'http.user_agent ~ "Mozilla"',
`# The ~ operator is shorthand for "matches" (regex match against field content).
# Matches HTTP frames where User-Agent contains "Mozilla" as a regex pattern.
# Case-sensitive by default; use ~ "(?i)mozilla" for case-insensitive matching.`);

patch('Display Filters — Operators & Syntax', 'tcp.payload contains 50:4f:53:54',
`# Matches TCP frames whose payload contains the hex bytes 50:4f:53:54 ("POST").
# Useful for finding POST requests in TCP streams without HTTP dissection.
# Bytes can be expressed as ASCII strings: tcp.payload contains "POST"
# Handy for finding cleartext data in non-standard port traffic.`);

patch('Display Filters — Operators & Syntax', 'frame.protocols contains "gtp"',
`# Matches frames where the dissected protocol stack includes "gtp".
# frame.protocols is a colon-separated string of all detected protocols.
# Example stack: "eth:ethertype:ip:udp:gtp:ip:tcp:http"
# Useful for filtering mobile/carrier traffic without knowing GTP port numbers.`);

// ── TShark ──────────────────────────────────────────────────────────────────────
patch('TShark', 'tshark -D',
`$ tshark -D
1. eth0  (Ethernet)
2. lo    (Loopback)
3. any   (Pseudo-device that captures on all interfaces)
4. wlan0 (Wi-Fi)
# Lists all available capture interfaces with their index numbers.
# Use the index or name with -i: tshark -i eth0 or tshark -i 1`);

patch('TShark', 'tshark -i <iface>',
`$ tshark -i eth0
Capturing on 'eth0'
    1  0.000000  10.0.0.5 → 10.0.0.10  TCP 60 54321 → 80 [SYN] Seq=0
    2  0.001234  10.0.0.10 → 10.0.0.5  TCP 60 80 → 54321 [SYN,ACK] Seq=0
    3  0.001456  10.0.0.5 → 10.0.0.10  TCP 52 54321 → 80 [ACK] Seq=1
# Ctrl-C to stop. Replace eth0 with your interface name (tshark -D to list).`);

patch('TShark', 'tshark -i <iface> -f "<filter>"',
`$ tshark -i eth0 -f "tcp port 443"
Capturing on 'eth0'
    1  0.000000  10.0.0.5 → 10.0.0.10  TCP 60 54321 → 443 [SYN]
    2  0.001234  10.0.0.10 → 10.0.0.5  TCP 60 443 → 54321 [SYN,ACK]
# -f applies a BPF capture filter (same syntax as tcpdump).
# Only matching traffic is captured — reduces file size significantly.`);

patch('TShark', 'tshark -Y "<display-filter>"',
`$ tshark -r capture.pcap -Y "http.response.code == 500"
   42  5.123456  10.0.0.5 → 10.0.0.10  HTTP/1.1 500 Internal Server Error
   87  9.456789  10.0.0.5 → 10.0.0.10  HTTP/1.1 500 Internal Server Error
# -Y applies a Wireshark display filter to a live capture or pcap file.
# Combine with -T fields -e field1 -e field2 for custom column output.`);

patch('TShark', 'tshark -w <file.pcap>',
`$ tshark -i eth0 -w /tmp/capture.pcap
Capturing on 'eth0'
^C 1234 packets captured.
# Writes the capture to a pcap file for later analysis.
# Open with: wireshark /tmp/capture.pcap
# Combine: tshark -i eth0 -f "port 443" -w /tmp/tls.pcap -a duration:60`);

patch('TShark', 'tshark -r <file.pcap>',
`$ tshark -r /tmp/capture.pcap
    1  0.000000  10.0.0.5 → 10.0.0.10  TCP 60 54321 → 80 [SYN]
    2  0.001234  10.0.0.10 → 10.0.0.5  TCP 60 80 → 54321 [SYN,ACK]
# Reads and displays packets from an existing pcap/pcapng file.
# Apply a display filter: tshark -r file.pcap -Y "dns.flags.rcode != 0"`);

patch('TShark', 'tshark -z conv,tcp -r capture.pcap',
`$ tshark -z conv,tcp -r capture.pcap
TCP Conversations
Filter:<No Filter>
                                               |       <-      | |       ->      | |     Total     |
                                               | Frames  Bytes | | Frames  Bytes | | Frames  Bytes |
10.0.0.5:54321  <-> 10.0.0.10:443    42  62452       38  185432      80  247884
# Shows per-conversation frame and byte counts for TCP flows.
# Replace tcp with udp, ip, eth for other protocol layers.`);

patch('TShark', 'tshark -z endpoints,tcp -r capture.pcap',
`$ tshark -z endpoints,tcp -r capture.pcap
TCP Endpoints
Filter:<No Filter>
                         |  Packets  | |  Bytes   | | Tx Packets | | Tx Bytes | | Rx Packets | | Rx Bytes |
10.0.0.5                      80       247884           42       62452           38       185432
10.0.0.10                     80       247884           38       185432           42        62452
# Per-endpoint traffic stats — useful for identifying top talkers.`);

patch('TShark', 'tshark -z expert',
`$ tshark -z expert -r capture.pcap
=== Expert Information ===
Errors:   0
Warnings: 5
Notes:    12  (TCP retransmissions, duplicate ACKs)
Chats:    120

Severity  Group     Protocol  Count  Summary
Warning   Sequence  TCP       5      Retransmission
Note      Sequence  TCP       12     Duplicate ACK
# Prints the expert information summary — a quick health check of a capture.`);

patch('TShark', 'tshark -o tls.keylog_file:<file>',
`$ tshark -o tls.keylog_file:/tmp/sslkeys.log -r capture.pcap -Y "http"
   15  1.234567  10.0.0.5 → 10.0.0.10  GET /api/data HTTP/1.1
   16  1.235789  10.0.0.10 → 10.0.0.5  HTTP/1.1 200 OK
# Loads a TLS key log file (NSS format, as exported by browsers/curl with
# SSLKEYLOGFILE=/tmp/sslkeys.log) to decrypt TLS sessions in the capture.`);

// ── Analysis & Statistics ──────────────────────────────────────────────────────
patch('Analysis & Statistics', 'Statistics → Conversations',
`# Menu: Statistics → Conversations
# Shows traffic totals per IP pair (or TCP/UDP 5-tuple).
# Columns: Address A, Address B, Packets (→/←), Bytes (→/←), Duration
# Sort by "Bytes" to find top talkers; click a row → Apply as Filter
# to isolate that conversation in the main packet list.`);

patch('Analysis & Statistics', 'Statistics → Endpoints',
`# Menu: Statistics → Endpoints
# Shows per-host (or per-port) packet and byte counts.
# Tabs: Ethernet, IPv4, IPv6, TCP, UDP
# Useful for finding the heaviest traffic source in a capture.
# Enable GeoIP: Edit → Preferences → Name Resolution → MaxMind database path.`);

patch('Analysis & Statistics', 'Statistics → Protocol Hierarchy',
`# Menu: Statistics → Protocol Hierarchy
# Tree view showing what percentage of packets each protocol represents.
# Example:
#   Frame    100%  (1234 packets)
#   ├─ Ethernet  100%
#   │  ├─ IPv4  95%
#   │  │  ├─ TCP  80%
#   │  │  │  └─ TLS  70%
#   │  │  └─ UDP  15%
#   │  │     └─ DNS  12%
# Good for quickly understanding a capture's traffic composition.`);

patch('Analysis & Statistics', 'Statistics → IO Graph',
`# Menu: Statistics → IO Graph
# Plots packets/bytes per second over the capture timeline.
# Add multiple filters as separate graph lines (e.g. tcp.analysis.retransmission
# vs tcp.flags.syn) to correlate events with time.
# Export: Save the graph image or the underlying CSV data.`);

patch('Analysis & Statistics', 'Statistics → TCP Stream Graphs → Time-Sequence (Stevens)',
`# Menu: Statistics → TCP Stream Graphs → Time-Sequence (Stevens)
# Plots sequence numbers over time for a single TCP stream.
# Follow a TCP stream first (right-click → Follow → TCP Stream), then open.
# A sawtooth pattern indicates retransmissions; flat lines indicate stalls.
# Useful for diagnosing throughput problems and buffer bloat.`);

patch('Analysis & Statistics', 'Statistics → Expert Information',
`# Menu: Statistics → Expert Information  (Ctrl+Shift+I)
# Categorises Wireshark's automatic diagnostic notes by severity:
#   Errors   — serious protocol violations (malformed frames, checksum errors)
#   Warnings — TCP retransmissions, duplicate ACKs, out-of-order segments
#   Notes    — expected protocol transitions (RST, FIN)
#   Chats    — normal protocol chatter (SYN, connection set-up)
# Start here for a rapid triage of any unfamiliar capture.`);

patch('Analysis & Statistics', 'Statistics → Flow Graph',
`# Menu: Statistics → Flow Graph
# Draws a vertical ladder diagram of packet flow between endpoints.
# Similar to the output of a protocol analyser or Wireshark's VoIP call flow.
# Useful for visualising the sequence of events in a handshake or login flow.`);

patch('Analysis & Statistics', 'Telephony → VoIP Calls',
`# Menu: Telephony → VoIP Calls
# Lists all detected VoIP calls in the capture (SIP, H.323, MGCP, SKINNY).
# Columns: Start Time, Stop Time, Initial Speaker, From, To, Protocol, Duration, State
# Select a call → Flow Sequence to see the SIP ladder diagram.
# Select a call → Play Streams to listen to decoded RTP audio.`);

patch('Analysis & Statistics', 'Analyze → Display Filter Macros…',
`# Menu: Analyze → Display Filter Macros
# Lets you define reusable display filter shortcuts.
# Example — define macro "mysrv" as "ip.addr == 10.0.0.10":
#   Name: mysrv   Text: ip.addr == 10.0.0.10
# Use in filter bar: \${mysrv} and tcp.port == 443
# Macros persist across sessions and can be exported/imported.`);

// ── Coloring Rules & Workflow ──────────────────────────────────────────────────
patch('Coloring Rules & Workflow', 'View → Coloring Rules…',
`# Menu: View → Coloring Rules  (Shift+Ctrl+C on Windows/Linux)
# Lists all active coloring rules with their filter and colour.
# Default rules highlight: TCP errors (red), ICMP (cyan), DNS (light blue),
# HTTP (green), broadcast (grey), and STP (dark blue).
# Drag rules to reorder priority; first matching rule wins.
# Export/import rules: share a standard colour scheme across analysts.`);

patch('Coloring Rules & Workflow', 'View → Time Display Format → Seconds Since Previous Displayed Packet',
`# Menu: View → Time Display Format → Seconds Since Previous Displayed Packet
# Changes the Time column to show inter-packet delay in seconds.
# Useful for spotting sudden pauses:
#   0.000000  [SYN]
#   0.001234  [SYN,ACK]
#   3.000456  [ACK]  ← 3-second gap = server processing delay or client stall
# Switch back to absolute time: View → Time Display Format → Date and Time of Day`);

patch('Coloring Rules & Workflow', 'Right-click → Follow → TCP Stream',
`# Right-click any TCP frame → Follow → TCP Stream  (Ctrl+Alt+Shift+T)
# Reconstructs the entire TCP session as readable text.
# Client-to-server data shown in red; server-to-client in blue.
# Switch display mode: Raw, ASCII, Hex Dump, UTF-8, C Arrays, YAML.
# Click "Save as…" to export the stream content to a file.`);

patch('Coloring Rules & Workflow', 'Right-click → Follow → TLS Stream',
`# Right-click any TLS frame → Follow → TLS Stream
# Decrypts and reconstructs the TLS session if a key log file is loaded.
# Load keys: Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log
# or: set SSLKEYLOGFILE=/tmp/keys.log before running the browser/application.
# Without keys, the stream shows raw encrypted bytes only.`);

patch('Coloring Rules & Workflow', 'File → Export Objects → HTTP',
`# Menu: File → Export Objects → HTTP
# Lists all HTTP objects (files, images, JSON blobs) transferred in the capture.
# Columns: Packet, Hostname, Content Type, Size, Filename
# Select one or more objects → Save / Save All to extract them to disk.
# Useful in security analysis for extracting payloads from HTTP traffic.`);

// ── Write output ────────────────────────────────────────────────────────────────
data.updatedAt = new Date().toISOString();
writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('Wireshark patch applied successfully.');
