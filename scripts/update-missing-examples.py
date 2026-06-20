#!/usr/bin/env python3
"""Patch commands.json: fill missing examples and add 10 new commands."""

import json, copy
from pathlib import Path

DATA = Path("data/commands.json")

with open(DATA) as f:
    db = json.load(f)

# ──────────────────────────────────────────────────────────────────────────────
# Helper: apply examples to a section list by cmd-key lookup
# ──────────────────────────────────────────────────────────────────────────────
def patch(platform, section, updates: dict):
    """updates = {cmd_string: {"example": ..., "desc": ...}}  desc optional."""
    cmds = db["platforms"][platform]["sections"][section]
    for entry in cmds:
        key = entry["cmd"]
        if key in updates:
            u = updates[key]
            if "example" not in entry or not entry.get("example"):
                entry["example"] = u["example"]
            if "desc" in u and (not entry.get("desc") or entry["desc"].startswith("#")):
                entry["desc"] = u["desc"]

def add_command(platform, section, entry: dict):
    """Append a new command entry if cmd not already present."""
    cmds = db["platforms"][platform]["sections"][section]
    existing = {c["cmd"] for c in cmds}
    if entry["cmd"] not in existing:
        cmds.append(entry)


# ══════════════════════════════════════════════════════════════════════════════
# 1. WIRESHARK — Display Filters TCP/UDP (11 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — TCP/UDP", {
    "tcp.analysis.out_of_order": {
        "example": "# Matches frames Wireshark flagged as arriving out of sequence.\n# [TCP Out-Of-Order] in the Info column — receiver must re-assemble.\n# Frame 22: 10.0.0.5 → 10.0.0.10  [TCP Out-Of-Order] Seq=3001 Len=1460\n# Caused by asymmetric routing, NIC offloading, or real reorder in transit.\n# Combine with tcp.stream eq <n> to isolate a single flow."
    },
    "tcp.analysis.lost_segment": {
        "example": "# Matches frames where Wireshark infers a gap in the sequence space.\n# [TCP Previous segment not captured] appears in Info.\n# Frame 25: 10.0.0.10 → 10.0.0.5  [TCP Dup ACK 20#1] Ack=2001\n# Often caused by an asymmetric capture path (you see the ACK but not the data).\n# True loss triggers retransmission; check for tcp.analysis.retransmission nearby."
    },
    "tcp.analysis.zero_window": {
        "example": "# Matches TCP Zero Window announcements — receiver buffer completely full.\n# [TCP ZeroWindow] in the Info column. Data transfer stalls.\n# Frame 30: 10.0.0.10 → 10.0.0.5  [TCP ZeroWindow] Win=0\n# Frame 31: 10.0.0.5  → 10.0.0.10 [TCP ZeroWindowProbe]\n# Frame 32: 10.0.0.10 → 10.0.0.5  [TCP ZeroWindowProbeAck]\n# Indicates slow application consumer or memory pressure on the receiver."
    },
    "tcp.window_size < 1000": {
        "example": "# Matches frames where the advertised receive window is very small.\n# Low window = receiver is struggling to process data fast enough.\n# Frame 35: 10.0.0.10 → 10.0.0.5  Win=512  [ACK]\n# Sustained low window slows throughput below the bandwidth-delay product."
    },
    "tcp.port == 80 or tcp.port == 443": {
        "example": "# Show all HTTP and HTTPS TCP traffic in one view.\n# Frame 1: 10.0.0.5:55000 → 10.0.0.10:80   [SYN]\n# Frame 5: 10.0.0.5:55001 → 10.0.0.10:443  [SYN]\n# Right-click → Follow → TCP Stream to reconstruct each session."
    },
    "tcp.len > 0": {
        "example": "# Matches TCP segments that carry payload (filters out pure ACKs).\n# Reduces noise when you only want to see data-bearing frames.\n# Frame 10: 10.0.0.5 → 10.0.0.10  [PSH,ACK] Len=512\n# Useful for payload analysis; combine with ip.addr to scope to one host."
    },
    "udp": {
        "example": "# Matches all UDP datagrams regardless of port.\n# Frame 1:  10.0.0.5:5353 → 224.0.0.251:5353  MDNS\n# Frame 2:  10.0.0.5:68   → 255.255.255.255:67 DHCP Discover\n# Frame 3:  10.0.0.5:52000→ 8.8.8.8:53         DNS Standard query\n# Use udp.port == <n> to narrow to a specific service."
    },
    "udp.length > 512": {
        "example": "# Matches UDP datagrams whose total length exceeds 512 bytes.\n# DNS traditionally caps UDP at 512 bytes (EDNS0 raises this).\n# Frame 8:  8.8.8.8 → 10.0.0.5  DNS response Len=1452 (EDNS0)\n# Large UDP from unknown sources can indicate amplification-attack traffic."
    },
    "tcp.analysis.window_update": {
        "example": "# Matches TCP Window Update segments — receiver re-opening a previously\n# shrunk or zeroed window after freeing buffer space.\n# [TCP Window Update] in the Info column.\n# Frame 33: 10.0.0.10 → 10.0.0.5  [TCP Window Update] Win=65535\n# A Window Update after Zero Window means the receiver is ready to accept data again."
    },
    "tcp.flags == 0x002": {
        "example": "# Exact hex match for SYN-only flag byte (0x002 = SYN bit set, all others clear).\n# Equivalent to: tcp.flags.syn==1 and tcp.flags.ack==0\n# Frame 1: 10.0.0.5:54321 → 10.0.0.10:80  [SYN] Flags=0x002\n# Useful in tshark -Y filters when you want the raw hex form."
    },
    "tcp.flags == 0x014": {
        "example": "# Hex 0x014 = RST + ACK flags set simultaneously (0x010 ACK | 0x004 RST).\n# Frame 4: 10.0.0.10:80 → 10.0.0.5:54321  [RST, ACK] Flags=0x014\n# Server sending RST,ACK typically means the port is closed or the\n# session was unknown to the server (e.g., after a restart)."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 2. WIRESHARK — Display Filters HTTP/HTTPS (7 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — HTTP/HTTPS", {
    "http.response.code == 301 or http.response.code == 302": {
        "example": "# Matches HTTP 301 (Moved Permanently) and 302 (Found/Temporary) redirects.\n# Frame 6:  10.0.0.10 → 10.0.0.5  HTTP/1.1 301 Moved Permanently\n#            Location: https://example.com/\n# Useful for tracing redirect chains or detecting redirect loops."
    },
    "http.cookie contains \"sessionid\"": {
        "example": "# Matches HTTP requests that carry a Cookie header containing 'sessionid'.\n# Frame 12: 10.0.0.5 → 10.0.0.10  GET /dashboard HTTP/1.1\n#   Cookie: sessionid=abc123xyz; csrftoken=def456\n# Useful for session hijacking analysis or verifying Secure/HttpOnly flags."
    },
    "http.authorization": {
        "example": "# Matches any frame that has an HTTP Authorization header.\n# Frame 3:  10.0.0.5 → 10.0.0.10  GET /api/data HTTP/1.1\n#   Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...\n# Frame 7:  10.0.0.5 → 10.0.0.10  GET /admin HTTP/1.1\n#   Authorization: Basic dXNlcjpwYXNzd29yZA==   (base64 user:password)\n# Unencrypted Basic auth over HTTP exposes credentials in the clear."
    },
    "http.request.method == \"POST\"": {
        "example": "# Matches HTTP POST requests — form submissions, API calls, file uploads.\n# Frame 9:  10.0.0.5 → 10.0.0.10  POST /api/login HTTP/1.1\n#   Content-Type: application/json\n#   {\"username\":\"admin\",\"password\":\"secret\"}\n# Right-click → Follow HTTP Stream to see the full request + response."
    },
    "http.server contains \"Apache\"": {
        "example": "# Matches HTTP responses whose Server header contains 'Apache'.\n# Frame 10: 10.0.0.10 → 10.0.0.5  HTTP/1.1 200 OK\n#   Server: Apache/2.4.57 (Ubuntu)\n# Helps inventory web server software versions across captured traffic."
    },
    "http.content_type contains \"json\"": {
        "example": "# Matches frames with a Content-Type header that includes 'json'.\n# Frame 15: 10.0.0.10 → 10.0.0.5  HTTP/1.1 200 OK\n#   Content-Type: application/json; charset=utf-8\n# Combine with http.request.method == \"POST\" to see all JSON API payloads."
    },
    "http.request.uri contains \"/admin\"": {
        "example": "# Matches HTTP requests to URIs containing '/admin'.\n# Frame 4:  10.0.0.5 → 10.0.0.10  GET /admin/dashboard HTTP/1.1\n# Frame 8:  10.0.0.6 → 10.0.0.10  POST /admin/users HTTP/1.1\n# Useful for auditing admin access or detecting unauthorized probing."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 3. WIRESHARK — Display Filters TLS/SSL (2 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — TLS/SSL", {
    "tls.alert_message.level == 2": {
        "example": "# Matches TLS Fatal alerts (level 2) — connection will be torn down.\n# Frame 18: 10.0.0.5 → 10.0.0.10  TLSv1.3 Alert (Level: Fatal, Description: Certificate Unknown)\n# Common fatal alert descriptions:\n#   42 = bad_certificate       48 = unknown_ca\n#   70 = protocol_version      40 = handshake_failure\n# A fatal alert always precedes an RST or FIN."
    },
    "tls.handshake.ciphersuite": {
        "example": "# Matches any TLS handshake frame that contains a CipherSuite field.\n# Appears in both ClientHello (offered suites) and ServerHello (chosen suite).\n# Frame 2:  ClientHello  — cipher_suites: TLS_AES_256_GCM_SHA384, TLS_AES_128_GCM_SHA256 ...\n# Frame 3:  ServerHello  — cipher_suite:  TLS_AES_256_GCM_SHA384\n# Use tls.handshake.ciphersuite == 0x1302 to match a specific suite (e.g. TLS_AES_256_GCM_SHA384)."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 4. WIRESHARK — Display Filters DNS (3 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — DNS", {
    "dns.flags.rcode == 2": {
        "example": "# Matches DNS SERVFAIL (rcode 2) — server could not complete the query.\n# Frame 5:  8.8.8.8 → 10.0.0.5  DNS Standard query response SERVFAIL\n# Common causes: authoritative server unreachable, DNSSEC validation failure,\n# resolver misconfiguration, or upstream recursion failure.\n# Combine with dns.qry.name to see which domains are failing."
    },
    "dns.resp.len > 512": {
        "example": "# Matches DNS responses larger than 512 bytes (the classic UDP limit).\n# Modern resolvers use EDNS0 to allow up to 4096 bytes over UDP.\n# Frame 8:  8.8.8.8 → 10.0.0.5  DNS response Len=1380 A www.example.com\n# If the resolver doesn't support EDNS0 and gets a response > 512 bytes,\n# it falls back to TCP — watch for a matching tcp.port == 53 stream."
    },
    "dns.flags.truncated == 1": {
        "example": "# Matches DNS responses with the TC (Truncated) bit set.\n# Frame 9:  8.8.8.8 → 10.0.0.5  DNS response (truncated)\n# The response was too large for the negotiated UDP payload size.\n# The resolver should retry over TCP (port 53/tcp).\n# If no TCP retry follows, the answer is silently incomplete."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 5. WIRESHARK — Display Filters ARP/ICMP (5 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — ARP / ICMP", {
    "icmp.type == 3 and icmp.code == 4": {
        "example": "# Matches ICMP Destination Unreachable / Fragmentation Needed messages.\n# This is the PMTUD signal: a router can't forward the packet because\n# it exceeds the next-hop MTU and the DF bit is set.\n# Frame 15: router → 10.0.0.5  ICMP Destination Unreachable (Fragmentation Needed)\n#   Next-Hop MTU: 1452\n# The sender should reduce its MSS to fit. Absence of these messages\n# when DF+large packets are dropped = PMTUD Blackhole."
    },
    "icmpv6": {
        "example": "# Matches all ICMPv6 traffic — NDP, RA, RS, Echo, PMTUD signals, etc.\n# Frame 1:  fe80::1 → ff02::1   ICMPv6 Router Advertisement\n# Frame 2:  fe80::2 → fe80::1   ICMPv6 Neighbor Solicitation\n# Frame 3:  fe80::1 → fe80::2   ICMPv6 Neighbor Advertisement\n# Use icmpv6.type to narrow: 133=RS, 134=RA, 135=NS, 136=NA, 128=Echo Request"
    },
    "icmpv6.type == 135": {
        "example": "# Matches ICMPv6 Neighbor Solicitation (NS) — the IPv6 equivalent of ARP Request.\n# Frame 5:  fe80::aabb:ccff:fedd:eeff → ff02::1:ff00:1  ICMPv6 Neighbor Solicitation\n#   Target: 2001:db8::1\n# NS is sent to the solicited-node multicast address of the target.\n# If no Neighbor Advertisement (type 136) follows, the target is unreachable."
    },
    "arp.opcode == 2": {
        "example": "# Matches ARP Replies — maps MAC to IP in the reply direction.\n# Frame 4:  00:11:22:aa:bb:cc → 00:50:56:8f:00:01  ARP Reply\n#   10.0.0.1 is at 00:11:22:aa:bb:cc\n# Multiple different MACs replying to the same IP = ARP spoofing/gratuitous ARP.\n# Combine with arp.src.hw_mac to track which MAC is claiming an IP."
    },
    "arp.duplicate-address-detected": {
        "example": "# Matches ARP probes/announcements that Wireshark flags as duplicate-address conflicts.\n# Frame 6:  00:de:ad:be:ef:02 → ff:ff:ff:ff:ff:ff  ARP Announcement for 10.0.0.5\n# [Duplicate IP address detected for 10.0.0.5 (00:de:ad:be:ef:02) — also in use by 00:11:22:aa:bb:cc]\n# Indicates an IP conflict on the network — two hosts using the same address."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 6. WIRESHARK — Display Filters VoIP/SIP/RTP (1 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — VoIP / SIP / RTP", {
    "sdp": {
        "example": "# Matches frames containing Session Description Protocol (SDP) payloads.\n# SDP bodies travel inside SIP INVITE and 200 OK responses.\n# Frame 5:  10.0.0.5 → 10.0.0.10  SIP/SDP  INVITE sip:bob@example.com\n#   Content-Type: application/sdp\n#   v=0\n#   o=alice 2890844526 2890844526 IN IP4 10.0.0.5\n#   m=audio 49170 RTP/AVP 0\n# The 'm=' line reveals the RTP port for the media stream."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 7. WIRESHARK — Display Filters AD/Kerberos/SMB/LDAP (4 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — AD / Kerberos / SMB / LDAP", {
    "smb2.cmd == 5": {
        "example": "# Matches SMB2 CREATE requests — opening a file, pipe, or directory.\n# SMB2 command code 5 = CREATE (equivalent to SMB1 Open/NtCreate).\n# Frame 20: 10.0.0.5 → 10.0.0.10  SMB2 Create Request File: \\\\share\\file.docx\n# Combine with smb2.filename to search for a specific file name:\n#   smb2.cmd == 5 and smb2.filename contains \"password\""
    },
    "smb2.cmd == 6": {
        "example": "# Matches SMB2 CLOSE requests — releasing an open file handle.\n# Frame 25: 10.0.0.5 → 10.0.0.10  SMB2 Close Request  FileId: 0x0001...\n# Useful for tracking file lifecycle: CREATE (5) → READ/WRITE → CLOSE (6).\n# High CLOSE rate without corresponding READs may indicate directory enumeration."
    },
    "smb2.nt_status != 0": {
        "example": "# Matches SMB2 responses carrying a non-zero (error) NT_STATUS code.\n# Frame 22: 10.0.0.10 → 10.0.0.5  SMB2 Create Response  NT_Status: STATUS_ACCESS_DENIED (0xC0000022)\n# Common error codes:\n#   0xC0000022 = STATUS_ACCESS_DENIED\n#   0xC0000034 = STATUS_OBJECT_NAME_NOT_FOUND\n#   0xC000006D = STATUS_LOGON_FAILURE\n# High error rate on a DC port suggests brute-force or misconfigured permissions."
    },
    "ldap.resultCode != 0": {
        "example": "# Matches LDAP responses with a non-success result code.\n# Frame 8:  10.0.0.10 → 10.0.0.5  LDAP searchResDone  resultCode: 32 (noSuchObject)\n# Common LDAP result codes:\n#   32 = noSuchObject     49 = invalidCredentials\n#   50 = insufficientAccess  53 = unwillingToPerform\n# resultCode 49 on a Bind is a failed authentication attempt."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 8. WIRESHARK — Display Filters Routing/Switching (3 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — Routing / Switching Control Plane", {
    "vrrp": {
        "example": "# Matches all VRRP (Virtual Router Redundancy Protocol) packets.\n# VRRP advertisements are sent to 224.0.0.18, IP protocol 112.\n# Frame 1:  10.0.0.1 → 224.0.0.18  VRRPv2 Advertisement  VirtualRtrID=1  Priority=100\n# Frame 2:  10.0.0.2 → 224.0.0.18  VRRPv2 Advertisement  VirtualRtrID=1  Priority=90\n# A gap in advertisements (>3× interval) causes a state transition from Backup to Master."
    },
    "hsrp": {
        "example": "# Matches Cisco HSRP (Hot Standby Router Protocol) multicast packets.\n# HSRP v1 uses 224.0.0.2 UDP/1985; HSRPv2 uses 224.0.0.102 UDP/1985.\n# Frame 3:  10.0.0.254 → 224.0.0.2  HSRP  Hello  State=Active  Priority=110  Group=1\n# Frame 4:  10.0.0.253 → 224.0.0.2  HSRP  Hello  State=Standby Priority=100  Group=1\n# If Active stops sending Hellos, Standby holds-down then transitions to Active."
    },
    "bfd": {
        "example": "# Matches BFD (Bidirectional Forwarding Detection) control packets.\n# BFD uses UDP ports 3784 (single-hop) or 4784 (multi-hop).\n# Frame 1:  10.0.0.1 → 10.0.0.2  BFD Control  State=Up  Your Discrim=12345  Interval=300ms\n# BFD detects forwarding-plane failures much faster than routing-protocol timers.\n# A State=Down transition in both peers confirms the link or path has failed."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 9. WIRESHARK — Display Filters 802.11 Wireless (6 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — 802.11 / Wireless", {
    "wlan.fc.type == 2": {
        "example": "# Matches 802.11 Data frames (FC Type=2).\n# Type 0 = Management, Type 1 = Control, Type 2 = Data.\n# Frame 10: STA(aa:bb:cc:dd:ee:ff) → AP(00:11:22:33:44:55)  Data  Seq=1024\n# Filter data frames only to focus on actual payload traffic\n# rather than management overhead (Beacons, Probes, Auth, Assoc)."
    },
    "wlan.ssid == \"CorpWiFi\"": {
        "example": "# Matches 802.11 frames that carry the literal SSID string 'CorpWiFi'.\n# Appears in Beacon, Probe Request, and Probe Response frames.\n# Frame 1:  AP(00:11:22:33:44:55) → ff:ff:ff:ff:ff:ff  Beacon  SSID=CorpWiFi  Ch=6\n# Frame 5:  STA → ff:ff:ff:ff:ff:ff  Probe Request  SSID=CorpWiFi\n# Requires monitor-mode capture to see 802.11 management frames."
    },
    "wlan.addr == aa:bb:cc:dd:ee:ff": {
        "example": "# Matches all 802.11 frames involving a specific wireless MAC address\n# (source, destination, BSSID, or transmitter).\n# Frame 3:  aa:bb:cc:dd:ee:ff → 00:11:22:33:44:55  Data  Seq=512\n# Frame 4:  00:11:22:33:44:55 → aa:bb:cc:dd:ee:ff  Data  ACK\n# Use wlan.sa or wlan.da to restrict to source or destination respectively."
    },
    "wlan.fc.type_subtype == 0x08": {
        "example": "# Matches 802.11 Beacon frames (Type=0 Mgmt, Subtype=8, hex 0x08).\n# Frame 1:  AP(00:11:22:33:44:55) → ff:ff:ff:ff:ff:ff  Beacon  Interval=100TU  SSID=Corp\n# Beacons are sent ~10/s per AP. A gap > 300 ms suggests an AP reboot or RF issue.\n# Use Statistics → IO Graphs filtered to this to visualise beacon rate."
    },
    "wlan.fc.type_subtype == 0x0b": {
        "example": "# Matches 802.11 Authentication frames (Type=0 Mgmt, Subtype=11, hex 0x0b).\n# Frame 10: STA → AP  Authentication  Algorithm=0 (Open System)  Seq=1\n# Frame 11: AP  → STA Authentication  Algorithm=0  Seq=2  Status=0 (Success)\n# For 802.1X (WPA-Enterprise), look for EAPOL frames immediately after."
    },
    "eapol": {
        "example": "# Matches EAPOL (EAP over LAN) frames used in 802.1X/WPA handshakes.\n# Frame 12: STA → AP  EAPOL Start\n# Frame 13: AP  → STA EAP-Request  Identity\n# Frame 14: STA → AP  EAP-Response Identity: user@domain.com\n# Frame 15: AP  → STA EAP-Request  PEAP (TLS Start)\n# The 4-way WPA2 handshake also uses EAPOL Key frames after 802.1X auth."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 10. WIRESHARK — Analysis & Statistics (3 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Analysis & Statistics", {
    "Statistics → TCP Stream Graphs → Round Trip Time": {
        "example": "# Opens a per-stream RTT graph (ms vs. time) for the selected TCP stream.\n# How to use:\n#   1. Click a frame in the stream\n#   2. Statistics → TCP Stream Graphs → Round Trip Time\n# The graph plots RTT for each ACKed segment over the connection lifetime.\n# Spikes indicate congestion or route changes. A flat line near 0 means\n# capture is on the same segment as the sender (loopback RTT)."
    },
    "Statistics → DNS": {
        "example": "# Opens the DNS statistics window: query count by type, response codes, round-trip times.\n# Statistics → DNS\n# Columns: Query Type | Count | Min RTT | Max RTT | Mean RTT\n# A high count of SERVFAIL (rcode 2) or NXDOMAIN (rcode 3) relative to total\n# queries points to resolver or authoritative-server issues.\n# Sort by mean RTT to identify the slowest DNS servers."
    },
    "Statistics → HTTP → Requests": {
        "example": "# Statistics → HTTP → Requests\n# Displays a tree of HTTP request counts grouped by hostname and URI path.\n# Example output:\n#   http.host == example.com    42 requests\n#     /api/v1/users             18\n#     /api/v1/data              15\n#     /login                     9\n# Useful for identifying the most-requested endpoints or unexpected URIs\n# being accessed during a capture session."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 11. WIRESHARK — Coloring Rules & Workflow (5 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Coloring Rules & Workflow", {
    "File → Export Specified Packets → Displayed": {
        "example": "# Saves only the currently-filtered (displayed) packets to a new file.\n# File → Export Specified Packets → Displayed → Save as captured.pcapng\n# Workflow:\n#   1. Apply a display filter (e.g. ip.addr == 10.0.0.1)\n#   2. File → Export Specified Packets\n#   3. Select 'Displayed' radio button\n#   4. Choose pcapng format and save\n# The resulting file contains only matching frames — ideal for sharing\n# a focused subset without revealing unrelated traffic."
    },
    "Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename": {
        "example": "# Points Wireshark to a SSLKEYLOGFILE for live TLS decryption.\n# Edit → Preferences → Protocols → TLS\n#   → (Pre)-Master-Secret log filename: /path/to/sslkeys.log\n# Generate the key log:\n#   export SSLKEYLOGFILE=~/sslkeys.log && google-chrome &\n# Once loaded, encrypted TLS streams decode automatically.\n# The Decrypted TLS tab appears in the packet detail pane."
    },
    "Edit → Preferences → Name Resolution": {
        "example": "# Configure how Wireshark resolves addresses to friendly names.\n# Edit → Preferences → Name Resolution\n#   ✔ Resolve MAC addresses       (uses OUI database)\n#   ✔ Resolve transport names     (maps port numbers to service names)\n#   ✔ Resolve network addresses   (DNS reverse-lookup — can slow display on large captures)\n#   Hosts file: /etc/hosts or a custom file for manual IP→name mappings\n# Disable DNS resolution for large captures to avoid UI lag."
    },
    "View → Time Display Format → Seconds Since Beginning of Capture": {
        "example": "# Changes the timestamp column to elapsed seconds from the start of capture.\n# View → Time Display Format → Seconds Since Beginning of Capture\n# Useful for measuring inter-packet intervals and event timing:\n# Frame 1:  0.000000  SYN\n# Frame 2:  0.000312  SYN-ACK  (312 µs RTT)\n# Frame 3:  0.000624  ACK\n# Frame 8:  1.205000  [TCP Retransmission]  (retransmit after ~1.2 s RTO)"
    },
    "Analyze → Follow → TCP Stream": {
        "example": "# Reconstructs the full application-layer conversation for a TCP stream.\n# Right-click any frame in the stream → Follow → TCP Stream\n# Or: Analyze → Follow → TCP Stream\n# Output:\n#   GET /index.html HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n\n#   HTTP/1.1 200 OK\\r\\nContent-Length: 1270\\r\\n\\r\\n<html>...\n# Use the 'Show data as' dropdown for ASCII, hex, raw, or C arrays.\n# The auto-applied filter is: tcp.stream eq 0  (stream index)"
    },
})

print("Wireshark display filter patches applied.")

# ══════════════════════════════════════════════════════════════════════════════
# 12. WIRESHARK — Capture Filters (45 missing — BPF syntax)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Capture Filters", {
    "ether host <mac>": {
        "example": "# BPF: capture frames to or from a specific MAC address.\n# Example: ether host aa:bb:cc:dd:ee:ff\n# Captures all L2 frames where AA:BB:CC:DD:EE:FF is src OR dst.\n# Useful when tracking a device by MAC before IP is known (DHCP phase)."
    },
    "ether src <mac>": {
        "example": "# BPF: capture frames FROM a specific MAC (source only).\n# Example: ether src aa:bb:cc:dd:ee:ff\n# Only frames originating from this MAC are captured.\n# Combine with port filters: ether src aa:bb:cc:dd:ee:ff and port 443"
    },
    "ether dst <mac>": {
        "example": "# BPF: capture frames TO a specific MAC (destination only).\n# Example: ether dst aa:bb:cc:dd:ee:ff\n# Only frames destined for this MAC are captured.\n# Useful for capturing traffic sent to a router/gateway MAC."
    },
    "tcp[tcpflags] & tcp-syn != 0": {
        "example": "# BPF: captures any TCP frame with the SYN bit set (new connections).\n# Matches SYN and SYN-ACK frames.\n# To capture pure SYN only: tcp[tcpflags] & (tcp-syn|tcp-ack) == tcp-syn\n# High SYN rate from a single host indicates a port scan or SYN flood."
    },
    "tcp[tcpflags] & tcp-fin != 0": {
        "example": "# BPF: captures TCP frames with the FIN bit set (graceful close).\n# Both the initiating FIN and the FIN-ACK reply match.\n# Pair with tcp[tcpflags] & tcp-rst != 0 to capture all teardowns:\n#   tcp[tcpflags] & (tcp-fin|tcp-rst) != 0"
    },
    "tcp[tcpflags] & tcp-rst != 0": {
        "example": "# BPF: captures TCP frames with the RST bit set (abrupt close / port closed).\n# RST from server = port closed or application reject.\n# RST from client = application aborted the session.\n# High RST rate can indicate a firewall, a crashed service, or a scan."
    },
    "ip6": {
        "example": "# BPF: captures all IPv6 traffic.\n# Ethertype 0x86DD in the Ethernet header.\n# Combines with other filters: ip6 and tcp\n# Useful when filtering out IPv4 background noise on dual-stack hosts."
    },
    "ip proto 6": {
        "example": "# BPF: captures IP packets with protocol field 6 (TCP).\n# Equivalent to the 'tcp' shorthand in modern libpcap.\n# Example: ip proto 6 and dst host 10.0.0.1\n# Also: ip6 proto 6  for TCP inside IPv6 packets."
    },
    "ip proto 17": {
        "example": "# BPF: captures IP packets with protocol field 17 (UDP).\n# Equivalent to the 'udp' shorthand.\n# Example: ip proto 17 and port 53  → DNS over UDP\n# Also: ip6 proto 17  for UDP inside IPv6."
    },
    "ip proto 1": {
        "example": "# BPF: captures IP packets with protocol field 1 (ICMP).\n# Equivalent to the 'icmp' shorthand.\n# Example: ip proto 1 and src host 10.0.0.1  → ICMP from one host\n# For ICMPv6 use: ip6 proto 58"
    },
    "greater <bytes>": {
        "example": "# BPF: captures frames longer than <bytes> bytes (inclusive of all headers).\n# Example: greater 1500  → jumbo frames or fragmented IP\n# Example: greater 1400 and ip[6:2] & 0x4000 != 0  → DF-bit packets near MTU\n# Useful for detecting MTU mismatches or jumbo-frame paths."
    },
    "less <bytes>": {
        "example": "# BPF: captures frames shorter than <bytes> bytes.\n# Example: less 100  → tiny frames (ACKs, control packets, scans)\n# Tiny frames at high rate may indicate TCP ACK storms, SYN floods,\n# or network scanning tools sending minimal probe packets."
    },
    "not port <port>": {
        "example": "# BPF: excludes all traffic on a specific port (src or dst).\n# Example: not port 22  → capture everything except SSH\n# Useful for reducing noise from management traffic during troubleshooting.\n# Combine: host 10.0.0.1 and not port 22 and not port 161"
    },
    "not host <ip>": {
        "example": "# BPF: excludes all traffic to or from a specific host.\n# Example: not host 10.0.0.254  → hide default-gateway traffic\n# Useful when one host (e.g. a monitoring server) dominates the capture.\n# Combine: not host 10.0.0.254 and not broadcast"
    },
    "port 80 or port 443": {
        "example": "# BPF: captures HTTP and HTTPS traffic in a single filter.\n# Matches TCP or UDP on port 80 or 443, either direction.\n# Example: host 10.0.0.5 and (port 80 or port 443)\n# For TLS capture, combine with an SSLKEYLOGFILE for decryption in Wireshark."
    },
    "ip multicast": {
        "example": "# BPF: captures all IPv4 multicast packets (dest 224.0.0.0/4).\n# Includes routing protocols (OSPF 224.0.0.5, EIGRP 224.0.0.10),\n# PIM (224.0.0.13), VRRP (224.0.0.18), mDNS (224.0.0.251).\n# Combine: ip multicast and ip proto 103  → PIM only"
    },
    "ip broadcast": {
        "example": "# BPF: captures IPv4 broadcast packets (dst 255.255.255.255).\n# Includes DHCP Discover/Request, NetBIOS Name Service broadcasts.\n# High broadcast rate (>100 pps) may indicate a broadcast storm.\n# Note: directed broadcasts (x.x.x.255) may need a separate filter."
    },
    "vlan": {
        "example": "# BPF: captures all 802.1Q VLAN-tagged frames (Ethertype 0x8100).\n# Requires a monitor/SPAN port that delivers raw 802.1Q tags.\n# Combine: vlan and host 10.20.0.5  → VLAN-tagged traffic to/from a host.\n# vlan 20  → only frames tagged with VLAN ID 20."
    },
    "pppoes": {
        "example": "# BPF: captures PPPoE Session frames (Ethertype 0x8864).\n# Used on DSL/broadband links where PPPoE encapsulates IP.\n# Example output frame: PPPoESessionData → PPP → IP → TCP\n# Combine: pppoes and tcp port 80  → HTTP inside a PPPoE session."
    },
    "portrange 1-1024": {
        "example": "# BPF: captures traffic on any privileged (well-known) port 1–1024.\n# Matches TCP or UDP frames where src or dst port is in that range.\n# Example: portrange 1-1024 and host 10.0.0.5\n# Useful for auditing which services a host is connecting to."
    },
    "tcp port 22": {
        "example": "# BPF: captures all TCP traffic on port 22 (SSH), either direction.\n# Frames show encrypted payload — use for session counts, not content.\n# High number of SYN-only frames to port 22 = brute-force or scanner.\n# Combine: tcp port 22 and tcp[tcpflags] & tcp-syn != 0  → new SSH attempts."
    },
    "tcp port 3389": {
        "example": "# BPF: captures all TCP traffic on port 3389 (RDP), either direction.\n# Matches RDP client-to-server and server-to-client frames.\n# RDP traffic is encrypted; useful for session-timing or connection-count analysis.\n# Combine: tcp port 3389 and net 10.0.0.0/24  → RDP within subnet."
    },
    "udp port 53": {
        "example": "# BPF: captures DNS queries and responses over UDP port 53.\n# Frame 1: 10.0.0.5:52341 → 8.8.8.8:53  DNS query A www.example.com\n# Frame 2: 8.8.8.8:53 → 10.0.0.5:52341  DNS response 93.184.216.34\n# For DNS over TCP (large responses, zone transfers): tcp port 53"
    },
    "udp port 123": {
        "example": "# BPF: captures NTP traffic on UDP port 123.\n# NTP uses a client/server and symmetric peer model.\n# Frame 1: 10.0.0.5:56789 → 216.239.35.0:123  NTPv4 Client\n# Frame 2: 216.239.35.0:123 → 10.0.0.5:56789  NTPv4 Server  Stratum=1\n# Large NTP traffic from many sources to a single server may indicate NTP amplification."
    },
    "udp port 500": {
        "example": "# BPF: captures IKE (Internet Key Exchange) for IPsec, UDP port 500.\n# IKE Phase 1 (Main Mode or Aggressive Mode) runs on port 500.\n# Frame 1: 10.0.0.1:500 → 10.0.0.2:500  IKEv2 IKE_SA_INIT Request\n# Frame 2: 10.0.0.2:500 → 10.0.0.1:500  IKEv2 IKE_SA_INIT Response\n# Once NAT is detected, traffic moves to UDP 4500 (NAT-T)."
    },
    "udp port 4500": {
        "example": "# BPF: captures NAT-Traversal IPsec (IKE + ESP encapsulated in UDP 4500).\n# When one or both peers are behind NAT, IKE moves from 500 to 4500.\n# Frame 3: 10.0.0.1:4500 → 10.0.0.2:4500  IKEv2 IKE_AUTH Request\n# ESP packets are also wrapped in UDP 4500 for NAT traversal:\n# Frame 10: 10.0.0.1:4500 → 10.0.0.2:4500  ESP (encrypted payload)"
    },
    "ip proto 50": {
        "example": "# BPF: captures ESP (Encapsulating Security Payload) packets, IP protocol 50.\n# ESP carries encrypted IPsec payload — content is not visible.\n# Frame 5: 10.0.0.1 → 10.0.0.2  ESP (SPI=0x12345678)  Seq=1\n# Combine with ip host 10.0.0.1  → ESP from a specific peer.\n# If behind NAT, ESP is encapsulated in UDP 4500 (use udp port 4500 filter instead)."
    },
    "ip proto 51": {
        "example": "# BPF: captures AH (Authentication Header) packets, IP protocol 51.\n# AH provides integrity and authentication but NOT encryption.\n# Frame 6: 10.0.0.1 → 10.0.0.2  AH (SPI=0xABCDEF01)  Next-Header: TCP\n# AH is incompatible with NAT (it authenticates the IP header).\n# Rarely seen in modern deployments — ESP (proto 50) is used instead."
    },
    "ip6 proto 58": {
        "example": "# BPF: captures ICMPv6 packets (protocol 58 inside IPv6).\n# Includes NDP (NS/NA/RS/RA), Echo (ping6), and PMTUD (Packet Too Big).\n# Frame 1: fe80::1 → ff02::1   ICMPv6 Router Advertisement\n# Frame 2: fe80::2 → fe80::1   ICMPv6 Neighbor Solicitation (type 135)\n# Equivalent Wireshark display filter: icmpv6"
    },
    "ip6 multicast": {
        "example": "# BPF: captures IPv6 multicast packets (dst ff00::/8).\n# Includes all-nodes (ff02::1), all-routers (ff02::2), solicited-node (ff02::1:ff.../104).\n# Frame 1: fe80::1 → ff02::1     ICMPv6 Router Advertisement\n# Frame 2: fe80::2 → ff02::1:ff00:1  ICMPv6 Neighbor Solicitation\n# Frame 3: :: → ff02::1:2        DHCPv6 Solicit"
    },
    "ip6 dst ff02::1": {
        "example": "# BPF: captures IPv6 all-nodes multicast (link-local scope ff02::1).\n# All IPv6 interfaces join this group — equivalent to IPv4 broadcast for some purposes.\n# Frame 1: fe80::1 → ff02::1  ICMPv6 Router Advertisement (RA)\n# Frame 2: fe80::1 → ff02::1  ICMPv6 Redirect\n# RAs sent to ff02::1 provide prefix, gateway, and SLAAC configuration to all hosts."
    },
    "ip6 dst ff02::2": {
        "example": "# BPF: captures IPv6 all-routers multicast (ff02::2).\n# Only routers and DHCPv6 relay agents listen on this address.\n# Frame 1: fe80::2 → ff02::2  ICMPv6 Router Solicitation (RS)\n# RS is sent by hosts at boot to request an immediate RA from routers.\n# If no RA reply follows the RS, the host won't get SLAAC addressing."
    },
    "ip6 dst ff02::fb": {
        "example": "# BPF: captures mDNS traffic over IPv6 (ff02::fb, UDP port 5353).\n# mDNS enables zero-configuration service discovery on link-local scope.\n# Frame 1: fe80::aabb → ff02::fb  MDNS PTR _http._tcp.local\n# Frame 2: fe80::ccdd → ff02::fb  MDNS PTR answer MyDevice._http._tcp.local\n# Combine: ip6 dst ff02::fb or (udp port 5353 and ip dst 224.0.0.251)  → all mDNS"
    },
    "ip6 dst ff02::1:3": {
        "example": "# BPF: captures LLMNR (Link-Local Multicast Name Resolution) over IPv6 (ff02::1:3).\n# LLMNR is used by Windows for local name resolution when DNS fails.\n# Frame 1: fe80::1 → ff02::1:3  LLMNR Query  _WPAD.local\n# Frame 2: fe80::2 → ff02::1:3  LLMNR Query  FILESERVER.local\n# For IPv4 LLMNR: udp and dst host 224.0.0.252 and port 5355"
    },
    "tcp port 443 and host 10.0.0.1": {
        "example": "# BPF: captures HTTPS traffic specifically to or from 10.0.0.1.\n# More precise than a bare port filter — scoped to one host.\n# Frame 1: 10.0.0.5:54321 → 10.0.0.1:443  [SYN]\n# Frame 2: 10.0.0.1:443  → 10.0.0.5:54321  [SYN,ACK]\n# In Wireshark, decrypt with SSLKEYLOGFILE to see the TLS application data."
    },
    "net 10.0.0.0/24 and not port 22": {
        "example": "# BPF: captures all subnet traffic except SSH, reducing management noise.\n# Frames in the 10.0.0.0/24 subnet on any port other than 22 are captured.\n# Useful for troubleshooting application issues on a subnet\n# while ignoring background SSH session polling.\n# Extend: net 10.0.0.0/24 and not port 22 and not port 161  (also hide SNMP)"
    },
    "ether host aa:bb:cc:dd:ee:ff": {
        "example": "# BPF: all Ethernet frames involving a specific MAC address (src or dst).\n# Functionally identical to 'ether host' but with the literal MAC inline.\n# Example: ether host 00:50:56:8f:aa:bb  → all frames involving a VMware NIC\n# Useful when you know a MAC from 'arp -a' output but not the IP yet."
    },
    "vlan 20": {
        "example": "# BPF: captures Ethernet frames tagged with VLAN ID 20 (802.1Q).\n# Requires a raw SPAN/mirror port delivering tagged frames.\n# Frame 1: src → dst  [802.1Q VLAN=20] IP TCP\n# Combine with IP filters inside the VLAN:\n#   vlan 20 and host 10.20.0.5  → VLAN-20 traffic for one host"
    },
    "icmp[icmptype] == icmp-echoreply": {
        "example": "# BPF: captures ICMP Echo Reply packets (type 0) only.\n# Matches the response direction of a ping.\n# Frame 2: 10.0.0.2 → 10.0.0.1  ICMP Echo Reply  id=0x1234 seq=1 TTL=64\n# Pair with icmp[icmptype] == icmp-echo to see requests:\n#   icmp[icmptype] == icmp-echo or icmp[icmptype] == icmp-echoreply"
    },
    "tcp[tcpflags] & (tcp-syn|tcp-fin) != 0": {
        "example": "# BPF: captures any TCP frame with SYN or FIN flags set.\n# Matches connection open (SYN, SYN-ACK) and graceful close (FIN, FIN-ACK).\n# Useful for recording only the handshake and teardown lifecycle\n# without capturing the full data payload — very lightweight capture.\n# Add tcp-rst for abrupt closes: tcp[tcpflags] & (tcp-syn|tcp-fin|tcp-rst) != 0"
    },
    "port not in (22,23)": {
        "example": "# BPF (libpcap 1.9+): excludes SSH (22) and Telnet (23) from capture.\n# Reduces management-protocol noise during application troubleshooting.\n# Older libpcap equivalent: not port 22 and not port 23\n# Extend: port not in (22,23,161,162)  — also hide SNMP"
    },
    "ip proto 47": {
        "example": "# BPF: captures GRE (Generic Routing Encapsulation) packets, IP protocol 47.\n# GRE tunnels carry routed protocols or MPLS inside IP.\n# Frame 1: 10.0.0.1 → 10.0.0.2  GRE  Encapsulated: IP 192.168.1.0 → 192.168.2.0\n# Wireshark dissects the inner IP automatically.\n# Also used for PPTP (GRE with enhanced-GRE, proto 47)."
    },
    "greater 1500": {
        "example": "# BPF: captures frames with total length > 1500 bytes.\n# Standard Ethernet MTU is 1500 bytes; larger frames require jumbo support.\n# Frame 5: src → dst  [Jumbo]  Len=4096  IP TCP\n# If you see drops with DF=1 on > 1500 byte frames, suspect MTU mismatch.\n# Combine: greater 1500 and ip[6] & 0x40 != 0  → DF-bit jumbo frames"
    },
    "less 100": {
        "example": "# BPF: captures frames with total length < 100 bytes.\n# Tiny frames include pure ACKs (~54 bytes), ICMP unreachable, RSTs.\n# High tiny-frame rate from a scanner or DoS tool is a red flag.\n# Frame 3: src → dst  Len=54  TCP [ACK]  (pure acknowledgement, no data)"
    },
    "broadcast or multicast": {
        "example": "# BPF: captures all Ethernet broadcast (ff:ff:ff:ff:ff:ff) AND multicast frames.\n# Broadcast: ARP, DHCP Discover, NetBIOS.\n# Multicast: routing protocols, mDNS, SSDP, LLMNR, PIM.\n# Frame 1: → ff:ff:ff:ff:ff:ff  ARP Who has 10.0.0.1?\n# Frame 2: → 01:00:5e:00:00:05  OSPF Hello  224.0.0.5\n# High L2 broadcast rate (>500 pps) may indicate a broadcast storm."
    },
})

print("Wireshark capture filter patches applied.")

# ══════════════════════════════════════════════════════════════════════════════
# 13. WIRESHARK — TShark (20 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "TShark", {
    "tshark -z io": {
        "example": "# tshark -z io,stat,0 -r capture.pcap\n# Interval 0 = whole-capture summary of bytes/packets per I/O stream.\n# Output:\n# ===================================================\n# | IO Statistics                                   |\n# |                                                 |\n# | Interval size: 0 secs                           |\n# | Col 1: Frames and bytes                         |\n# |-----------------------+--------------------------|\n# |                |       1       |                 |\n# | Duration       | 12.345 secs   |                 |\n# | Frames         |     9843      |                 |\n# | Bytes          |  4,293,120    |                 |\n# ===================================================",
        "desc": "Whole-capture I/O statistics (frames + bytes)"
    },
    "tshark -z http": {
        "example": "# tshark -z http,tree -r capture.pcap\n# Produces a tree of HTTP request methods and response codes with counts.\n# Output (excerpt):\n# HTTP/Request/Method  GET    412  (73.2%)\n# HTTP/Request/Method  POST   112  (19.9%)\n# HTTP/Response/Status 200    398  (70.7%)\n# HTTP/Response/Status 404     63  (11.2%)\n# HTTP/Response/Status 500     22   (3.9%)\n# Useful for a quick API health check without opening the GUI.",
        "desc": "HTTP method / status-code breakdown tree"
    },
    "tshark -z dns": {
        "example": "# tshark -z dns,tree -r capture.pcap\n# Produces a DNS query-type and response-code breakdown.\n# Output (excerpt):\n# DNS   Queries\n#   A         321  (58.2%)\n#   AAAA       89  (16.1%)\n#   PTR        67  (12.1%)\n#   MX         29   (5.3%)\n# DNS   Response Codes\n#   NOERROR   420  (76.2%)\n#   NXDOMAIN   95  (17.2%)\n#   SERVFAIL   36   (6.5%)",
        "desc": "DNS query-type and response-code breakdown tree"
    },
    "tshark -z tls": {
        "example": "# tshark -z tls,tree -r capture.pcap\n# Lists TLS handshake message types and versions observed.\n# Output (excerpt):\n# TLS    Handshake Type\n#   ClientHello       52\n#   ServerHello       52\n#   Certificate       52\n#   CertificateVerify 48\n#   Finished          100\n# TLS    Version\n#   TLS 1.3            48\n#   TLS 1.2             4\n# Confirm that old TLS 1.0/1.1 sessions are absent.",
        "desc": "TLS handshake-message breakdown tree"
    },
    "tshark -o http.ssl.port:443": {
        "example": "# Forces TShark to decode port 443 as TLS-wrapped HTTP.\n# Full example: tshark -o 'http.ssl.port:443' -r capture.pcap -Y http\n# Without this, non-standard TLS ports won't be decoded as HTTP.\n# Combine with -o 'tls.keylog_file:/path/to/sslkeys.log' for decryption.",
        "desc": "Force TLS/HTTP decode on port 443"
    },
    "tshark -o tcp.relative_sequence_numbers:FALSE": {
        "example": "# Shows absolute TCP sequence numbers instead of Wireshark's default relative (0-based) view.\n# Full example:\n#   tshark -o tcp.relative_sequence_numbers:FALSE -r cap.pcap -T fields \\\n#     -e tcp.seq -e tcp.ack\n# Output:\n#   2789012345  0\n#   0           2789012346\n# Useful when correlating with logs that record raw sequence numbers.",
        "desc": "Show absolute TCP sequence numbers"
    },
    "tshark -o gui.column.format:\"...\"": {
        "example": "# Customises TShark's output columns via column-format preference.\n# Example: add a column for IP TTL and TCP stream index:\n#   tshark -o 'gui.column.format:\"No.\",\"%m\",\"Time\",\"%t\",\"Src\",\"%s\",\"Dst\",\"%d\",\"TTL\",\"%e ip.ttl\",\"Stream\",\"%e tcp.stream\"' -r cap.pcap\n# Or use -T fields -e <field> for simpler per-field extraction.",
        "desc": "Customise output columns via preference string"
    },
    "tshark -q -z io,phs -r capture.pcap": {
        "example": "# Prints the Protocol Hierarchy Statistics tree to stdout without per-packet output.\n# Output (excerpt):\n# ===================================================================\n# Protocol Hierarchy Statistics\n# Filter: <none>\n#\n# eth                                      frames:9843 bytes:4293120\n#   ip                                     frames:9210 bytes:4150080\n#     tcp                                  frames:7800 bytes:3840000\n#       http                               frames:524  bytes:312000\n#       tls                                frames:7276 bytes:3528000\n#     udp                                  frames:1410 bytes:310080\n#       dns                                frames:550  bytes:88000\n#       ntp                                frames:120  bytes:14400",
        "desc": "Protocol hierarchy statistics (quiet mode)"
    },
    "tshark -i <n> -w out.pcapng -b filesize:100000 -b files:10": {
        "example": "# Ring-buffer capture: rotates through 10 files of 100 MB each.\n# Once all 10 files are written, the oldest is overwritten.\n# tshark -i eth0 -w /tmp/capture.pcapng -b filesize:100000 -b files:10\n# Files: capture_00001_20260620.pcapng, capture_00002_... etc.\n# Stop with Ctrl-C. The most recent 10 × 100 MB = 1 GB is retained.\n# Add -b duration:300 to also rotate every 5 minutes.",
        "desc": "Ring-buffer: 10 × 100 MB rotating capture files"
    },
    "tshark -r in.pcap -Y \"tcp.analysis.retransmission\" -T fields -e ip.src -e ip.dst -e tcp.stream": {
        "example": "# Exports retransmission frames as tab-separated: src_ip, dst_ip, stream_id.\n# Output:\n#   10.0.0.5   10.0.0.10   0\n#   10.0.0.5   10.0.0.10   0\n#   10.0.0.7   10.0.0.10   3\n# Pipe to sort | uniq -c | sort -rn to find the streams with most retransmits:\n#   tshark ... | sort | uniq -c | sort -rn | head",
        "desc": "Export retransmit frames as TSV (src, dst, stream)"
    },
    "tshark -r in.pcap -qz io,stat,10": {
        "example": "# Prints IO statistics bucketed into 10-second intervals.\n# Output (excerpt):\n# ============================================================\n# | IO Statistics                                            |\n# | Interval: 10.000 secs                                   |\n# |------+---------+----------+-----------------------------|\n# | Time | Frames  | Bytes    |                             |\n# | 0    |    1240 | 543,800  |                             |\n# | 10   |     980 | 428,100  |                             |\n# | 20   |    2450 | 1,102,400| ← traffic spike at 20 s     |\n# | 30   |    1100 | 480,200  |",
        "desc": "IO stats in 10-second buckets across the capture"
    },
    "tshark -r in.pcap -qz conv,tcp": {
        "example": "# Prints top TCP conversations sorted by bytes transferred.\n# Output (excerpt):\n# ====================================================================\n# TCP Conversations\n# Filter:<No Filter>\n#                                                  |      <-      | |      ->      |\n# | Addr A             <-> Addr B             |Frames|Bytes |Frames|Bytes | Rel Start|\n# | 10.0.0.5:54321   <-> 10.0.0.10:443      |  412 | 230K |  389 | 2.1M |  0.000s  |\n# | 10.0.0.5:54322   <-> 10.0.0.10:443      |  298 | 161K |  274 | 1.8M |  0.312s  |",
        "desc": "Top TCP conversations with byte counts"
    },
    "tshark -r in.pcap -qz expert": {
        "example": "# Dumps the Wireshark Expert Info log to stdout — equivalent to the GUI\n# Analyze → Expert Information window.\n# Output (excerpt):\n# ===================================================================\n# NOTE  10.0.0.5 -> 10.0.0.10  [TCP Retransmission]         (4 times)\n# WARN  10.0.0.5 -> 10.0.0.10  [TCP ZeroWindow]             (1 time)\n# CHAT  10.0.0.5 -> 10.0.0.10  [TCP Connection Established] (52 times)\n# ERROR 10.0.0.5 -> 10.0.0.10  [Malformed Packet: TLS]      (1 time)\n# Severity: ERROR > WARN > NOTE > CHAT",
        "desc": "Dump Expert Info events to stdout"
    },
    "tshark -r in.pcap -qz http,tree": {
        "example": "# Prints HTTP statistics in tree form: method counts, status code distribution.\n# Output:\n# ======================================================================\n# HTTP/Requests           524\n#   GET                   421 (80.3%)\n#   POST                   95 (18.1%)\n#   PUT                     8  (1.5%)\n# HTTP/Responses          524\n#   2xx                   456 (87.0%)\n#   4xx                    47  (9.0%)\n#   5xx                    21  (4.0%)\n# Spot error rates quickly without opening the GUI.",
        "desc": "HTTP request/response tree statistics (quiet mode)"
    },
    "tshark -r in.pcap -qz rtp,streams": {
        "example": "# Lists RTP streams found in the capture with jitter, packet loss, and duration.\n# Output:\n# =============================================================================\n# RTP Streams\n# Src IP         SPort DPort  SSRC       Payload  Pkts  Lost  Max Delta  Max Jitter\n# 10.0.0.5       12340 12342  0xA1B2C3D4 PCMU     1800     0  20.45 ms   1.23 ms\n# 10.0.0.10      12342 12340  0xD4C3B2A1 PCMU     1798     2  22.10 ms   2.05 ms\n# Any 'Lost' > 0 will degrade voice quality.",
        "desc": "RTP stream list with jitter and loss stats"
    },
    "tshark -r in.pcap -qz dns,tree": {
        "example": "# Prints DNS statistics in tree form.\n# Output:\n# =====================================================\n# DNS/Queries\n#   A        321 (58.2%)\n#   AAAA      89 (16.1%)\n#   PTR       67 (12.1%)\n# DNS/Responses\n#   NOERROR  420 (76.2%)\n#   NXDOMAIN  95 (17.2%)\n#   SERVFAIL  36  (6.5%)\n# A SERVFAIL rate > 5% warrants investigating the upstream resolver.",
        "desc": "DNS query-type / response-code tree statistics"
    },
    "tshark -r in.pcap -Y \"dns.qry.name\" -T fields -e dns.qry.name | sort -u": {
        "example": "# Extracts and deduplicates every DNS name queried in the capture.\n# Output (excerpt):\n#   api.example.com\n#   fonts.googleapis.com\n#   login.microsoft.com\n#   ocsp.verisign.com\n#   updates.ubuntu.com\n# Pipe to grep to search for unexpected domains:\n#   ... | grep -v '.example.com'  → non-corp DNS lookups",
        "desc": "List unique DNS names queried across a capture"
    },
    "editcap -A \"2026-04-24 09:00:00\" -B \"2026-04-24 09:05:00\" in.pcap slice.pcap": {
        "example": "# Extracts a 5-minute slice from a large capture file by timestamp.\n# -A = start time (after), -B = end time (before)\n# Both timestamps are in local time matching the capture clock.\n# editcap -A \"2026-04-24 09:00:00\" -B \"2026-04-24 09:05:00\" full.pcapng incident.pcapng\n# The output file contains only frames in that window.\n# Combine with mergecap if you need to join two slices afterwards.",
        "desc": "Cut a time-bounded slice from a large capture"
    },
    "mergecap -w merged.pcapng a.pcap b.pcap": {
        "example": "# Merges two or more pcap/pcapng files into one, sorted by timestamp.\n# mergecap -w merged.pcapng site-a.pcap site-b.pcap site-c.pcap\n# Frames are interleaved in chronological order.\n# Useful when captures were taken simultaneously on multiple interfaces\n# and you want a single timeline for analysis.",
        "desc": "Merge multiple pcap files preserving chronological order"
    },
    "capinfos in.pcap": {
        "example": "# Prints a concise summary of a capture file.\n# capinfos capture.pcapng\n# Output:\n# File name:           capture.pcapng\n# File type:           Wireshark/... - pcapng\n# File encapsulation:  Ethernet\n# Packet size limit:   file hdr: 65535\n# Number of packets:   9,843\n# File size:           4,293,120 bytes\n# Data size:           4,110,048 bytes\n# Capture duration:    12.345 seconds\n# Start time:          2026-04-24 09:00:00\n# End time:            2026-04-24 09:00:12\n# Data byte rate:      332,969 bytes/s\n# Data bit rate:       2,663,752 bits/s\n# Average packet size: 417.58 bytes",
        "desc": "Quick capture file summary: duration, packets, bytes, timing"
    },
})

print("Wireshark TShark patches applied.")

# ══════════════════════════════════════════════════════════════════════════════
# 14. OPENSSL — Certificate Inspection (7 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("openssl", "Certificate Inspection", {
    "openssl x509 -in cert.crt -noout -ext keyUsage": {
        "example": "$ openssl x509 -in server.crt -noout -ext keyUsage\nX509v3 Key Usage: critical\n    Digital Signature, Key Encipherment\n# 'critical' means a CA or application MUST understand and enforce this extension.\n# Common values: digitalSignature (TLS auth), keyEncipherment (RSA key exchange),\n# keyCertSign (CA certs), cRLSign (CRL signing), dataEncipherment (rare)."
    },
    "openssl x509 -in cert.crt -noout -ext authorityInfoAccess": {
        "example": "$ openssl x509 -in server.crt -noout -ext authorityInfoAccess\nAuthority Information Access:\n    OCSP - URI:http://ocsp.example.com\n    CA Issuers - URI:http://crt.example.com/intermediate.crt\n# OCSP URI: where to check revocation status in real time.\n# CA Issuers URI: where to download the issuing CA cert (for chain building).\n# Used by TLS clients to build and validate the full certificate chain."
    },
    "openssl x509 -in cert.crt -noout -ext crlDistributionPoints": {
        "example": "$ openssl x509 -in server.crt -noout -ext crlDistributionPoints\nX509v3 CRL Distribution Points:\n    Full Name:\n      URI:http://crl.example.com/intermediate.crl\n# CRL = Certificate Revocation List. Clients download this periodically\n# to check if the cert has been revoked.\n# OCSP (see authorityInfoAccess) is the online alternative to CRL download."
    },
    "openssl x509 -in cert.crt -noout -issuer_hash": {
        "example": "$ openssl x509 -in ca.crt -noout -issuer_hash\n4a6481c9\n# Returns the hash of the issuer DN field.\n# OpenSSL trust stores use symlinks named <hash>.0, <hash>.1, etc.\n# to map issuer hashes to certificate files — used by c_rehash.\n# Run c_rehash /etc/ssl/certs/ after adding a new CA cert."
    },
    "openssl x509 -in cert.crt -noout -subject_hash": {
        "example": "$ openssl x509 -in ca.crt -noout -subject_hash\n4a6481c9\n# Returns the hash of the subject DN.\n# Used by c_rehash to create the symlink <hash>.0 → ca.crt in the trust store.\n# The issuer_hash of a leaf cert should match the subject_hash of its issuing CA.\n# Verify: openssl verify -CAfile chain.pem leaf.crt"
    },
    "openssl x509 -in cert.crt -noout -startdate -enddate": {
        "example": "$ openssl x509 -in server.crt -noout -startdate -enddate\nnotBefore=Jan  1 00:00:00 2025 GMT\nnotAfter=Jan  1 00:00:00 2026 GMT\n# Quick check for cert validity window without parsing full -text output.\n# Script-friendly: check expiry in days:\n#   openssl x509 -in cert.crt -noout -checkend 2592000 && echo 'OK' || echo 'EXPIRES < 30d'"
    },
    "openssl x509 -in cert.crt -noout -text -certopt no_pubkey,no_sigdump": {
        "example": "$ openssl x509 -in server.crt -noout -text -certopt no_pubkey,no_sigdump\nCertificate:\n    Data:\n        Version: 3 (0x2)\n        Serial Number: 04:a3:...:7f\n        Signature Algorithm: sha256WithRSAEncryption\n        Issuer: C=US, O=Example CA, CN=Example Intermediate CA\n        Validity\n            Not Before: Jan  1 00:00:00 2025 GMT\n            Not After : Jan  1 00:00:00 2026 GMT\n        Subject: CN=*.example.com\n        X509v3 extensions:\n            X509v3 Subject Alternative Name:\n                DNS:*.example.com, DNS:example.com\n            X509v3 Key Usage: critical\n                Digital Signature, Key Encipherment\n# Omits the lengthy Public Key and Signature hex blocks for cleaner output."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 15. OPENSSL — Format Conversion (8 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("openssl", "Format Conversion", {
    "openssl pkcs12 -export -out legacy.pfx -inkey private.key -in cert.crt -legacy": {
        "example": "$ openssl pkcs12 -export -out legacy.pfx -inkey private.key -in cert.crt -legacy\nEnter Export Password: ****\nVerifying - Enter Export Password: ****\n# The -legacy flag uses RC2/3DES encryption compatible with older Java keystores\n# (JKS) and Windows Server 2003/2008 that don't support AES-256 PFX.\n# Import to Java: keytool -importkeystore -srckeystore legacy.pfx -srcstoretype PKCS12"
    },
    "openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out client-only.crt": {
        "example": "$ openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out client-only.crt\nEnter Import Password: ****\n$ cat client-only.crt\n-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWg...\n-----END CERTIFICATE-----\n# -clcerts = client (leaf) certificates only\n# -nokeys  = exclude the private key\n# Useful when you need only the public cert to share with a server admin."
    },
    "openssl pkcs12 -in bundle.pfx -cacerts -nokeys -out ca-chain.crt": {
        "example": "$ openssl pkcs12 -in bundle.pfx -cacerts -nokeys -out ca-chain.crt\nEnter Import Password: ****\n$ openssl x509 -in ca-chain.crt -noout -subject\nsubject=C=US, O=Example CA, CN=Example Intermediate CA\n# -cacerts = CA certificates only (intermediate + root), NOT the leaf\n# -nokeys  = exclude private key\n# Useful for extracting the trust chain separately from the leaf cert."
    },
    "openssl pkcs7 -print_certs -in chain.p7b -out chain.pem": {
        "example": "$ openssl pkcs7 -print_certs -in chain.p7b -out chain.pem\n$ cat chain.pem\n-----BEGIN CERTIFICATE-----\nMIIDXTCCAk...  (leaf)\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIDYTCAk...   (intermediate CA)\n-----END CERTIFICATE-----\n# PKCS#7 (.p7b/.p7c) is common in Windows environments.\n# -print_certs extracts all certs in the bundle as PEM-concatenated output."
    },
    "openssl crl2pkcs7 -nocrl -certfile leaf.crt -certfile chain.pem -out bundle.p7b": {
        "example": "$ openssl crl2pkcs7 -nocrl -certfile leaf.crt -certfile chain.pem -out bundle.p7b\n$ openssl pkcs7 -in bundle.p7b -print_certs -noout\nsubject=CN=*.example.com\nissuer=CN=Example Intermediate CA\nsubject=CN=Example Intermediate CA\nissuer=CN=Example Root CA\n# -nocrl skips the CRL (we only want a cert bundle).\n# The output .p7b can be imported into IIS, Windows certificate store,\n# or Java keystores that accept PKCS#7 format."
    },
    "openssl pkey -in private.key -outform DER -out private.der": {
        "example": "$ openssl pkey -in private.key -outform DER -out private.der\n$ xxd private.der | head -2\n00000000: 3082 04a3 0201 0002 8201 0100 bc72 ...   (DER binary)\n# DER (Distinguished Encoding Rules) is the binary form of PEM.\n# Required by some Java applications and hardware security modules (HSM).\n# PEM is base64(DER) wrapped in -----BEGIN/END----- headers."
    },
    "openssl pkey -in private.der -inform DER -out private.pem": {
        "example": "$ openssl pkey -in private.der -inform DER -out private.pem\n$ head -1 private.pem\n-----BEGIN PRIVATE KEY-----\n# Converts a DER binary key back to PEM text format.\n# Most Linux/Unix tools (nginx, Apache, curl) expect PEM-encoded keys.\n# Add -aes256 to encrypt the output PEM with a passphrase:\n#   openssl pkey -in private.der -inform DER -out private.pem -aes256"
    },
    "cat leaf.crt intermediate.crt root.crt > fullchain.pem": {
        "example": "$ cat leaf.crt intermediate.crt root.crt > fullchain.pem\n$ openssl verify -CAfile root.crt fullchain.pem\nfullchain.pem: OK\n# Order matters: leaf first, then each intermediate, then root last.\n# nginx ssl_certificate expects this order.\n# Apache SSLCertificateFile (leaf) + SSLCertificateChainFile (chain) are separate.\n# Verify the chain: openssl verify -CAfile root.crt -untrusted intermediate.crt leaf.crt"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 16. OPENSSL — TLS Client Testing (19 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("openssl", "TLS Client Testing", {
    "openssl speed ecdhp256": {
        "example": "$ openssl speed ecdhp256\nDoing ECDH ops on P-256: 4500 in 3.00s = 1499.98 ECDH/s\n# Benchmarks ECDH key exchange operations per second on P-256 (prime256v1).\n# Higher is better; modern CPUs with AVX2 exceed 5000 ops/s.\n# Compare: openssl speed ecdhp384 ecdhp521 ecdhx25519\n# X25519 typically outperforms P-256 on software-only implementations."
    },
    "openssl s_time -connect <host:443>": {
        "example": "$ openssl s_time -connect example.com:443 -time 10\nNo session reuse - Doing SSLv3/TLS in  1 connection - 10.00s\n148 connections in 10s; 14.80 connections/user/sec, bytes read 28656\n148 connections in  10.00 real seconds, 19 bytes read per connection\n# Measures how many full TLS handshakes complete in the time window.\n# Add -reuse to test session-resumption performance:\n#   openssl s_time -connect example.com:443 -time 10 -reuse",
        "desc": "Benchmark TLS handshake throughput (connections/s)"
    },
    "openssl ciphers -v": {
        "example": "$ openssl ciphers -v | head -10\nTLS_AES_256_GCM_SHA384     TLSv1.3  Kx=any   Au=any   Enc=AESGCM(256)  Mac=AEAD\nTLS_CHACHA20_POLY1305_SHA256 TLSv1.3  Kx=any   Au=any   Enc=CHACHA20(256) Mac=AEAD\nTLS_AES_128_GCM_SHA256     TLSv1.3  Kx=any   Au=any   Enc=AESGCM(128)  Mac=AEAD\nECDHE-ECDSA-AES256-GCM-SHA384 TLSv1.2 Kx=ECDH  Au=ECDSA Enc=AESGCM(256) Mac=AEAD\nECDHE-RSA-AES256-GCM-SHA384   TLSv1.2 Kx=ECDH  Au=RSA   Enc=AESGCM(256) Mac=AEAD\n# Columns: cipher name | min TLS version | key exchange | auth | encryption | MAC\n# Filter: openssl ciphers -v 'HIGH:!aNULL:!MD5' to see a security policy.",
        "desc": "List all supported ciphers with full details"
    },
    "openssl s_client -connect host:443 -servername host -sess_in sess.pem": {
        "example": "# First, save a session:\n#   openssl s_client -connect example.com:443 -servername example.com \\\n#     -sess_out sess.pem </dev/null\n# Then resume:\n$ openssl s_client -connect example.com:443 -servername example.com \\\n    -sess_in sess.pem </dev/null 2>&1 | grep 'Reuse\\|Session-ID'\nReused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384\n# 'Reused' confirms the server accepted the session ticket.\n# TLS 1.3 uses PSK tickets, not session IDs.",
        "desc": "Resume a saved TLS session (verify session-resumption)"
    },
    "openssl s_client -connect host:443 -servername host -verify_return_error": {
        "example": "$ openssl s_client -connect expired.badssl.com:443 -servername expired.badssl.com \\\n    -verify_return_error </dev/null\nverify error:num=10:certificate has expired\nCONNECT:error in s_client\n# Without -verify_return_error, s_client shows verify errors but still connects.\n# With this flag, any verify failure aborts the connection with a non-zero exit code.\n# Useful in scripts: if openssl s_client ... -verify_return_error; then echo OK; fi",
        "desc": "Fail immediately on any TLS certificate verify error"
    },
    "openssl s_client -connect host:443 -servername host -CAfile chain.pem": {
        "example": "$ openssl s_client -connect internal.corp:443 -servername internal.corp \\\n    -CAfile /etc/ssl/certs/corp-root-ca.crt </dev/null 2>&1 | grep 'Verify return'\nVerify return code: 0 (ok)\n# Uses the specified CA bundle instead of the system trust store.\n# Essential for internal PKI where the CA is not publicly trusted.\n# Add -verify_return_error to fail the connection on any issue.",
        "desc": "Validate server cert against a custom CA bundle"
    },
    "openssl s_client -connect host:443 -servername host 2>/dev/null </dev/null | openssl x509 -noout -text": {
        "example": "$ openssl s_client -connect example.com:443 -servername example.com \\\n    2>/dev/null </dev/null | openssl x509 -noout -text\nCertificate:\n    Data:\n        Version: 3 (0x2)\n        Serial Number: 04:a3:...\n        Signature Algorithm: sha256WithRSAEncryption\n        Issuer: C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1\n        Validity\n            Not Before: Jan  1 00:00:00 2025 GMT\n            Not After : Jan  1 00:00:00 2026 GMT\n        Subject: CN=*.example.com\n# Pipes just the server cert to x509 for full text decode without the TLS handshake noise.",
        "desc": "Decode the full text of the server's presented certificate"
    },
    "openssl s_client -connect host:443 -servername host 2>/dev/null </dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName": {
        "example": "$ openssl s_client -connect example.com:443 -servername example.com \\\n    2>/dev/null </dev/null \\\n  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName\nsubject=CN=*.example.com\nissuer=C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1\nnotBefore=Jan  1 00:00:00 2025 GMT\nnotAfter =Jan  1 00:00:00 2026 GMT\nX509v3 Subject Alternative Name:\n    DNS:*.example.com, DNS:example.com",
        "desc": "One-liner: subject, issuer, validity dates, and SANs"
    },
    "openssl s_client -connect host:443 -servername host -groups X25519:P-256:P-384": {
        "example": "$ openssl s_client -connect example.com:443 -servername example.com \\\n    -groups X25519:P-256:P-384 </dev/null 2>&1 | grep 'Server Temp Key'\nServer Temp Key: X25519, 253 bits\n# Advertises X25519, P-256, P-384 in that preference order in the TLS ClientHello.\n# 'Server Temp Key: X25519' confirms the server selected X25519 for ECDH.\n# Use to verify that the server supports modern forward-secrecy key exchange.",
        "desc": "Offer specific ECDH groups in ClientHello (TLS 1.3)"
    },
    "openssl s_client -connect host:443 -servername host -sigalgs RSA+SHA256:ECDSA+SHA256": {
        "example": "$ openssl s_client -connect example.com:443 -servername example.com \\\n    -sigalgs 'RSA+SHA256:ECDSA+SHA256' </dev/null 2>&1 | grep 'Cipher\\|Protocol'\nProtocol  : TLSv1.3\nCipher    : TLS_AES_256_GCM_SHA384\n# Restricts the signature_algorithms extension to RSA-SHA256 and ECDSA-SHA256.\n# Useful for testing whether a server can negotiate with limited sig-alg support\n# (e.g. validating compatibility with older clients).",
        "desc": "Restrict signature algorithms in the ClientHello"
    },
    "openssl s_client -connect host:443 -servername host -tls1_3 -ciphersuites TLS_AES_128_GCM_SHA256": {
        "example": "$ openssl s_client -connect example.com:443 -servername example.com \\\n    -tls1_3 -ciphersuites TLS_AES_128_GCM_SHA256 </dev/null 2>&1 | grep Cipher\nCipher    : TLS_AES_128_GCM_SHA256\n# Forces TLS 1.3 and restricts to a single ciphersuite.\n# If the server doesn't support TLS 1.3 or that ciphersuite, the handshake fails:\n#   140...:error:...no protocols available\n# Use to test ciphersuite negotiation or validate server TLS 1.3 support.",
        "desc": "Force TLS 1.3 with a specific ciphersuite"
    },
    "openssl s_client -connect host:443 -starttls imap": {
        "example": "$ openssl s_client -connect mail.example.com:143 -starttls imap\n* OK [CAPABILITY IMAP4rev1 STARTTLS] Dovecot ready.\na001 STARTTLS\n* OK Begin TLS negotiation\n[TLS handshake proceeds]\n[Verify cert...]\nCipher    : ECDHE-RSA-AES256-GCM-SHA384\n# Connects to IMAP (143) and issues STARTTLS before negotiating TLS.\n# Useful to verify that a mail server's STARTTLS/IMAP is working correctly.",
        "desc": "STARTTLS upgrade on IMAP port 143"
    },
    "openssl s_client -connect host:443 -starttls pop3": {
        "example": "$ openssl s_client -connect mail.example.com:110 -starttls pop3\n+OK Dovecot POP3 ready.\nSTLS\n+OK Begin TLS negotiation now.\n[TLS handshake proceeds]\n# Connects to POP3 port 110 and issues the STLS command to upgrade to TLS.\n# Verifies the mail server's STARTTLS implementation for POP3 clients.",
        "desc": "STARTTLS upgrade on POP3 port 110"
    },
    "openssl s_client -connect host:443 -starttls ftp": {
        "example": "$ openssl s_client -connect ftp.example.com:21 -starttls ftp\n220 ProFTPD Server ready.\nAUTH TLS\n234 AUTH TLS successful\n[TLS handshake proceeds]\nCipher    : ECDHE-RSA-AES128-GCM-SHA256\n# Connects to FTP control port 21 and sends AUTH TLS (FTPS explicit mode).\n# Validates that the FTP server supports FTPS/TLS encryption.",
        "desc": "STARTTLS/AUTH TLS on FTP port 21 (FTPS explicit)"
    },
    "openssl s_client -connect host:443 -starttls ldap": {
        "example": "$ openssl s_client -connect dc.example.com:389 -starttls ldap\n[LDAP StartTLS Extended Operation...]\n[TLS handshake proceeds]\nCipher    : ECDHE-RSA-AES256-GCM-SHA384\nVerify return code: 0 (ok)\n# Connects to LDAP port 389 and sends a StartTLS extended operation.\n# Validates LDAP-over-TLS (not to be confused with LDAPS on port 636).\n# For LDAPS (always-TLS): openssl s_client -connect dc.example.com:636",
        "desc": "STARTTLS upgrade on LDAP port 389"
    },
    "openssl s_client -connect host:443 -starttls postgres": {
        "example": "$ openssl s_client -connect db.example.com:5432 -starttls postgres\n[PostgreSQL SSL request sent]\n[TLS handshake proceeds]\nCipher    : ECDHE-RSA-AES128-GCM-SHA256\nVerify return code: 0 (ok)\n# Sends the PostgreSQL SSL negotiation byte (0x0000008004d2162f) before TLS.\n# Validates that ssl=on is configured in postgresql.conf and pg_hba.conf\n# requires hostssl connections for the target database.",
        "desc": "TLS negotiation on PostgreSQL port 5432"
    },
    "openssl s_client -connect host:443 -starttls mysql": {
        "example": "$ openssl s_client -connect db.example.com:3306 -starttls mysql\n[MySQL Greeting packet received]\n[MySQL SSL_REQUEST sent]\n[TLS handshake proceeds]\nCipher    : ECDHE-RSA-AES128-GCM-SHA256\n# Performs the MySQL capability exchange then sends an SSL_REQUEST packet\n# before negotiating TLS — required by MySQL's STARTTLS-like protocol.\n# Validates require_secure_transport=ON in MySQL/MariaDB server configuration.",
        "desc": "TLS negotiation on MySQL/MariaDB port 3306"
    },
    "openssl s_client -connect host:5671 -servername host -tls1_3 -cert client.crt -key client.key": {
        "example": "$ openssl s_client -connect rabbitmq.example.com:5671 -servername rabbitmq.example.com \\\n    -tls1_3 -cert client.crt -key client.key </dev/null 2>&1 | grep -E 'Verify|Cipher|Protocol'\nProtocol  : TLSv1.3\nCipher    : TLS_AES_256_GCM_SHA384\nVerify return code: 0 (ok)\n# Presents a client certificate during mTLS (mutual TLS) handshake.\n# The server verifies the client cert against its CA trust store.\n# Common for service-to-service auth in AMQP (5671), Kafka (9093), etcd, etc.",
        "desc": "Present a client cert for mutual TLS (mTLS)"
    },
    "openssl s_client -connect host:443 -servername host -prexit 2>&1 | grep -E \"(Session-ID|Cipher|Protocol)\"": {
        "example": "$ openssl s_client -connect example.com:443 -servername example.com \\\n    -prexit 2>&1 </dev/null | grep -E '(Session-ID|Cipher|Protocol)'\nProtocol  : TLSv1.3\nCipher    : TLS_AES_256_GCM_SHA384\nSession-ID: D3F09A...\n# -prexit forces session info to print at exit (needed with </dev/null EOF).\n# Extracts the three most useful fields in one line for scripting or audit.",
        "desc": "Extract cipher, protocol, and session-ID in one line"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 17. OPENSSL — Symmetric Encryption & Encoding (3 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("openssl", "Symmetric Encryption & Encoding", {
    "openssl enc -aes-256-cbc -pbkdf2 -md sha256 -iter 100000 -in plain.txt -out enc.bin": {
        "example": "$ openssl enc -aes-256-cbc -pbkdf2 -md sha256 -iter 100000 \\\n    -in plain.txt -out enc.bin\nenter AES-256-CBC encryption password: ****\nVerifying - enter AES-256-CBC encryption password: ****\n# -pbkdf2: uses PBKDF2 key derivation (stronger than legacy EVP_BytesToKey)\n# -md sha256 -iter 100000: SHA-256 HMAC, 100k iterations (OWASP minimum)\n# Decrypt: openssl enc -d -aes-256-cbc -pbkdf2 -md sha256 -iter 100000 \\\n#            -in enc.bin -out plain.txt"
    },
    "openssl rand -base64 32 | tr -d \"=\" | head -c 32": {
        "example": "$ openssl rand -base64 32 | tr -d '=' | head -c 32\nZ3kQP8mRvXnYt2jCwLfHoUgsBd9AeI4N\n# Generates 32 bytes of random data, base64-encodes it, strips padding '=',\n# then trims to 32 printable characters — safe for tokens, API keys, passwords.\n# Adjust 'head -c N' for desired token length.\n# For hex: openssl rand -hex 32  (64 hex chars = 32 bytes)"
    },
    "openssl rand -engine rdrand -hex 32": {
        "example": "$ openssl rand -engine rdrand -hex 32\nengine \"rdrand\" set.\na3f819d2c4b07e5f...(64 hex chars)...\n# Forces use of Intel RDRAND hardware RNG instead of the software PRNG.\n# -engine rdrand requires the rdrand engine to be available (OpenSSL 1.1.x).\n# OpenSSL 3.x uses the FIPS provider or ossl_legacy.so engine instead.\n# Verify RDRAND support: openssl engine -t rdrand"
    },
})

print("OpenSSL patches applied.")

# ══════════════════════════════════════════════════════════════════════════════
# 18. LINUX — Ref 01. File & Directory Navigation (10 of 20 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("linux", "Ref 01. File & Directory Navigation", {
    "ls": {
        "desc": "List files in the current directory",
        "example": "$ ls\ndesktop  documents  downloads  music  pictures  videos"
    },
    "ls -l": {
        "desc": "Long format: permissions, owner, size, modification time",
        "example": "$ ls -l\ntotal 32\n-rw-r--r-- 1 alice users  1234 Jun 20 09:00 config.yaml\ndrwxr-xr-x 2 alice users  4096 Jun 19 14:22 scripts/\n-rwxr-xr-x 1 alice users  8192 Jun 18 11:05 deploy.sh"
    },
    "ls -lha": {
        "desc": "Long format, show hidden files, human-readable sizes",
        "example": "$ ls -lha\ntotal 56K\ndrwxr-xr-x  5 alice users 4.0K Jun 20 09:00 ./\ndrwxr-xr-x 42 alice users 4.0K Jun 19 08:00 ../\n-rw-------  1 alice users 3.2K Jun 15 12:00 .bash_history\n-rw-r--r--  1 alice users  220 Jun  1 00:00 .bash_logout\n-rw-r--r--  1 alice users 1.2K Jun 20 08:55 config.yaml"
    },
    "ls -t": {
        "desc": "Sort by modification time, newest first",
        "example": "$ ls -lt\ntotal 32\n-rw-r--r-- 1 alice users 1234 Jun 20 09:00 deploy.log\n-rw-r--r-- 1 alice users 8192 Jun 19 17:30 app.py\n-rw-r--r-- 1 alice users 4096 Jun 18 11:05 config.yaml"
    },
    "ls -S": {
        "desc": "Sort by file size, largest first",
        "example": "$ ls -lS\ntotal 1024\n-rw-r--r-- 1 alice users 512000 Jun 18 10:00 database.db\n-rw-r--r-- 1 alice users  98304 Jun 20 09:00 backup.tar.gz\n-rw-r--r-- 1 alice users   1234 Jun 20 08:55 config.yaml"
    },
    "ls -1": {
        "desc": "One file per line (useful for scripting)",
        "example": "$ ls -1\nconfig.yaml\ndeploy.sh\nREADME.md\nscripts/"
    },
    "ls --group-directories-first": {
        "desc": "List directories before files",
        "example": "$ ls --group-directories-first\nscripts/    logs/       backups/\napp.py      config.yaml README.md"
    },
    "ls -d */": {
        "desc": "List only directories in the current path",
        "example": "$ ls -d */\nbackups/  logs/  scripts/  tmp/"
    },
    "ls --sort=time": {
        "desc": "Sort by modification time (same as -t)",
        "example": "$ ls --sort=time\ndeploy.log  app.py  config.yaml  README.md"
    },
    "ls --sort=size": {
        "desc": "Sort by file size (same as -S)",
        "example": "$ ls --sort=size\ndatabase.db  backup.tar.gz  app.py  config.yaml"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 19. LINUX — Ref 02. File Creation, Copying, Moving, Deletion (10 of 21 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("linux", "Ref 02. File Creation, Copying, Moving, Deletion", {
    "touch file": {
        "desc": "Create an empty file or update its timestamp",
        "example": "$ touch newfile.txt\n$ ls -l newfile.txt\n-rw-r--r-- 1 alice users 0 Jun 20 09:05 newfile.txt"
    },
    "touch -t 202401011200 file": {
        "desc": "Set a specific timestamp [[YY]MM]DDhhmm[.ss]",
        "example": "$ touch -t 202401011200 report.txt\n$ ls -l report.txt\n-rw-r--r-- 1 alice users 0 Jan  1 12:00 report.txt"
    },
    "cp src dest": {
        "desc": "Copy a file to a new location or name",
        "example": "$ cp config.yaml config.yaml.bak\n$ ls config.yaml*\nconfig.yaml  config.yaml.bak"
    },
    "cp -r dir1 dir2": {
        "desc": "Recursively copy a directory and all its contents",
        "example": "$ cp -r /etc/nginx /tmp/nginx-backup\n$ ls /tmp/nginx-backup/\nnginx.conf  sites-available/  sites-enabled/  conf.d/"
    },
    "cp -u src dest": {
        "desc": "Copy only if source is newer than destination",
        "example": "$ cp -u *.log /var/backup/logs/\n# Only logs modified after the existing backup copies are transferred.\n# Useful in cron jobs: cp -u /app/logs/*.log /backup/logs/"
    },
    "cp -i src dest": {
        "desc": "Prompt before overwriting an existing file",
        "example": "$ cp -i config.yaml /etc/app/config.yaml\ncp: overwrite '/etc/app/config.yaml'? y"
    },
    "cp -a src dest": {
        "desc": "Archive mode: preserves permissions, timestamps, symlinks, and ownership",
        "example": "$ cp -a /home/alice /backup/alice\n# Equivalent to cp -dR --preserve=all\n# Preserves: owner, group, permissions, timestamps, symlinks\n# Essential for backup operations where metadata must be retained."
    },
    "cp --parents file /dest": {
        "desc": "Preserve the full source path hierarchy at the destination",
        "example": "$ cp --parents etc/nginx/nginx.conf /backup\n$ ls /backup/etc/nginx/\nnginx.conf\n# Creates /backup/etc/nginx/ automatically to mirror the source path."
    },
    "cp --no-clobber src dest": {
        "desc": "Never overwrite an existing destination file",
        "example": "$ cp --no-clobber new-config.yaml /etc/app/config.yaml\n# Silently skips the copy if /etc/app/config.yaml already exists.\n# Safer than -i for scripting — no prompts, just skips."
    },
    "mv old new": {
        "desc": "Rename a file or move it to a new path",
        "example": "$ mv deploy.sh deploy-v2.sh\n$ mv deploy-v2.sh /opt/scripts/\n# mv is atomic on the same filesystem (rename syscall), safe for log rotation."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 20. LINUX — Ref 03. Viewing & Searching File Content (10 of 23 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("linux", "Ref 03. Viewing & Searching File Content", {
    "cat file": {
        "desc": "Print full file contents to stdout",
        "example": "$ cat /etc/hostname\nweb-server-01"
    },
    "tac file": {
        "desc": "Print file contents in reverse line order",
        "example": "$ tac /var/log/auth.log | head -5\nJun 20 09:05:01 server sshd[12345]: Accepted key for alice\nJun 20 09:04:58 server sshd[12344]: Connection from 10.0.0.5 port 55122\nJun 20 09:04:55 server sshd[12343]: Received disconnect from 10.0.0.4"
    },
    "less file": {
        "desc": "Interactively scroll through a file (q to quit, /pattern to search)",
        "example": "$ less /var/log/syslog\n# Navigation:\n#   Space / f   — page forward\n#   b           — page back\n#   /pattern    — search forward\n#   n / N       — next / previous match\n#   G           — go to end\n#   q           — quit"
    },
    "less -N file": {
        "desc": "Show file with line numbers in the left margin",
        "example": "$ less -N /etc/nginx/nginx.conf\n      1 user www-data;\n      2 worker_processes auto;\n      3\n      4 events {\n      5     worker_connections 1024;\n      6 }"
    },
    "less -S file": {
        "desc": "Disable line wrapping (long lines scroll horizontally)",
        "example": "$ less -S access.log\n10.0.0.5 - - [20/Jun/2026:09:05:01] \"GET /api/v1/data HTTP/1.1\" 200 1234 \"-\" \"curl\""
    },
    "more file": {
        "desc": "Page through file contents (forward only; less is preferred)",
        "example": "$ more /etc/passwd\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n--More--(12%)"
    },
    "head -n 20 file": {
        "desc": "Print the first 20 lines of a file",
        "example": "$ head -n 20 /var/log/nginx/error.log\n2026/06/20 08:00:01 [notice] 1234#1234: signal process started\n2026/06/20 08:00:01 [notice] 1234#1234: nginx/1.24.0\n..."
    },
    "head -n -5 file": {
        "desc": "Print all but the last 5 lines",
        "example": "$ head -n -5 data.csv\n# Prints all lines except the final 5 (useful to strip trailing footers).\nid,name,value\n1,alice,100\n2,bob,200"
    },
    "tail -n 50 file": {
        "desc": "Print the last 50 lines of a file",
        "example": "$ tail -n 50 /var/log/syslog\nJun 20 09:04:55 server kernel: eth0: renamed from veth1234\nJun 20 09:05:01 server sshd[12345]: Accepted key for alice"
    },
    "tail -n +5 file": {
        "desc": "Print from line 5 onwards (skip the first 4 lines)",
        "example": "$ tail -n +5 data.csv\n# Skips the first 4 header/comment lines, prints the rest.\n5,carol,300\n6,dave,400\n..."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 21. LINUX — Ref 06. Networking Commands (10 of 29 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("linux", "Ref 06. Networking Commands", {
    "ip -br a": {
        "desc": "Brief IP address listing: interface, state, addresses",
        "example": "$ ip -br a\nlo               UNKNOWN  127.0.0.1/8 ::1/128\neth0             UP       10.0.0.5/24 fe80::250:56ff:fe8f:aabb/64\ndocker0          DOWN     172.17.0.1/16"
    },
    "ip -4 a": {
        "desc": "Show only IPv4 addresses on all interfaces",
        "example": "$ ip -4 a\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0\n       valid_lft forever preferred_lft forever"
    },
    "ip -6 a": {
        "desc": "Show only IPv6 addresses on all interfaces",
        "example": "$ ip -6 a\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    inet6 fe80::250:56ff:fe8f:aabb/64 scope link\n       valid_lft forever preferred_lft forever\n    inet6 2001:db8::5/64 scope global\n       valid_lft forever preferred_lft forever"
    },
    "ip -4 r": {
        "desc": "Show only IPv4 routing table entries",
        "example": "$ ip -4 r\ndefault via 10.0.0.1 dev eth0 proto dhcp src 10.0.0.5 metric 100\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5\n172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1"
    },
    "ip link": {
        "desc": "Show link-layer info: interface state, MAC, MTU",
        "example": "$ ip link\n1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP\n    link/ether 00:50:56:8f:aa:bb brd ff:ff:ff:ff:ff:ff"
    },
    "ip neigh flush all": {
        "desc": "Flush the entire ARP/NDP neighbour cache",
        "example": "$ sudo ip neigh flush all\n*** Round 1, deleting 5 entries ***\n*** Flush is complete after 1 round ***\n# Useful after a VLAN change or MAC move to force re-ARP immediately.\n# Verify: ip neigh show"
    },
    "ip route get 8.8.8.8": {
        "desc": "Show the exact route and source IP used to reach a specific destination",
        "example": "$ ip route get 8.8.8.8\n8.8.8.8 via 10.0.0.1 dev eth0 src 10.0.0.5 uid 1000\n    cache\n# Shows: next-hop (10.0.0.1), egress interface (eth0), source IP (10.0.0.5).\n# Instant policy-routing / VRF sanity check without sending traffic."
    },
    "ping host": {
        "desc": "Send ICMP Echo Requests to test reachability and RTT",
        "example": "$ ping -c 4 10.0.0.1\nPING 10.0.0.1 (10.0.0.1): 56 data bytes\n64 bytes from 10.0.0.1: icmp_seq=0 ttl=64 time=0.312 ms\n64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.298 ms\n--- 10.0.0.1 ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss\nround-trip min/avg/max/stddev = 0.298/0.305/0.312/0.006 ms"
    },
    "ping -s 1024 host": {
        "desc": "Send ICMP packets with a custom payload size (1024 bytes) to test MTU path",
        "example": "$ ping -s 1024 -c 3 10.0.0.1\nPING 10.0.0.1: 1024 data bytes\n1032 bytes from 10.0.0.1: icmp_seq=0 ttl=64 time=0.420 ms\n# Total frame = 1024 (payload) + 8 (ICMP) + 20 (IP) = 1052 bytes.\n# Increase to 1472 (-s 1472) to test full 1500-byte Ethernet MTU path:\n#   ping -s 1472 -M do host  → -M do sets DF bit (Linux)"
    },
    "curl url": {
        "desc": "Fetch a URL and print the response body to stdout",
        "example": "$ curl https://api.example.com/health\n{\"status\": \"ok\", \"version\": \"2.1.0\"}\n# Add -s to suppress progress meter in scripts.\n# Add -w '%{http_code}' to print the HTTP status code:\n#   curl -s -o /dev/null -w '%{http_code}' https://api.example.com/health"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 22. LINUX — Ref 09. Systemd Service Management (10 of 29 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("linux", "Ref 09. Systemd Service Management", {
    "systemctl status service": {
        "desc": "Show status, PID, runtime, and recent log lines for a service",
        "example": "$ systemctl status nginx\n● nginx.service - A high performance web server\n     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)\n     Active: active (running) since Thu 2026-06-20 08:00:01 UTC; 1h 5min ago\n    Process: 1234 ExecStart=/usr/sbin/nginx (code=exited, status=0/SUCCESS)\n   Main PID: 1235 (nginx)\n      Tasks: 5\n     Memory: 12.3M\n   Jun 20 08:00:01 host nginx[1235]: nginx: master process /usr/sbin/nginx"
    },
    "systemctl start service": {
        "desc": "Start a stopped service immediately",
        "example": "$ sudo systemctl start nginx\n$ systemctl is-active nginx\nactive"
    },
    "systemctl stop service": {
        "desc": "Stop a running service gracefully",
        "example": "$ sudo systemctl stop nginx\n$ systemctl is-active nginx\ninactive"
    },
    "systemctl restart service": {
        "desc": "Stop then start a service (interrupts connections)",
        "example": "$ sudo systemctl restart nginx\n# Briefly stops then restarts — active connections are dropped.\n# For zero-downtime config reload use: systemctl reload nginx"
    },
    "systemctl reload service": {
        "desc": "Reload service configuration without stopping it",
        "example": "$ sudo systemctl reload nginx\n# Sends SIGHUP to nginx master process — reloads config without dropping connections.\n# Not all services support reload; check: systemctl cat nginx | grep ExecReload"
    },
    "systemctl enable service": {
        "desc": "Enable a service to start automatically at boot",
        "example": "$ sudo systemctl enable nginx\nCreated symlink /etc/systemd/system/multi-user.target.wants/nginx.service\n  → /lib/systemd/system/nginx.service\n# To enable AND start immediately: systemctl enable --now nginx"
    },
    "systemctl disable service": {
        "desc": "Prevent a service from starting at boot",
        "example": "$ sudo systemctl disable nginx\nRemoved /etc/systemd/system/multi-user.target.wants/nginx.service\n# Service still runs now but won't start after reboot.\n# To stop AND disable: systemctl disable --now nginx"
    },
    "systemctl is-active service": {
        "desc": "Print 'active' or 'inactive'; exit code 0 if active",
        "example": "$ systemctl is-active nginx\nactive\n# Script-friendly: if systemctl is-active nginx; then echo running; fi\n# Exit code 0 = active, non-zero = not active"
    },
    "systemctl list-units --type=service": {
        "desc": "List all loaded service units and their states",
        "example": "$ systemctl list-units --type=service\nUNIT                     LOAD   ACTIVE SUB     DESCRIPTION\ncron.service             loaded active running Regular background program\nnginx.service            loaded active running A high performance web server\nssh.service              loaded active running OpenBSD Secure Shell server\n# Filter failed: systemctl list-units --type=service --state=failed"
    },
    "journalctl -u service -n 50 --no-pager": {
        "desc": "Show the last 50 log lines for a specific service",
        "example": "$ journalctl -u nginx -n 50 --no-pager\nJun 20 08:00:01 host nginx[1235]: 10.0.0.5 - - [20/Jun/2026] \"GET / HTTP/1.1\" 200\nJun 20 08:01:12 host nginx[1235]: 10.0.0.6 - - [20/Jun/2026] \"POST /api HTTP/1.1\" 201\n# Add -f to follow in real time: journalctl -u nginx -f\n# Since boot: journalctl -u nginx -b"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 23. LINUX — Ref 05. System Information & Monitoring (10 of 19 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("linux", "Ref 05. System Information & Monitoring", {
    "uname -r": {
        "desc": "Print the running kernel version",
        "example": "$ uname -r\n6.8.0-45-generic"
    },
    "whoami": {
        "desc": "Print the effective username of the current process",
        "example": "$ whoami\nalice\n# In a script: CURRENT_USER=$(whoami)"
    },
    "df -i": {
        "desc": "Show inode usage instead of block usage per filesystem",
        "example": "$ df -i\nFilesystem      Inodes   IUsed   IFree IUse% Mounted on\n/dev/sda1      6553600  123456 6430144    2% /\ntmpfs           512000       8  511992    1% /run\n# High inode usage (>90%) causes 'No space left on device' even when blocks are free.\n# Common cause: many small files (e.g. mail spools, Docker layers)."
    },
    "df -h": {
        "desc": "Show disk usage with human-readable sizes",
        "example": "$ df -h\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   18G   30G  38% /\ntmpfs           2.0G  1.2M  2.0G   1% /run\n/dev/sdb1       200G  120G   72G  63% /data"
    },
    "free -h": {
        "desc": "Show RAM and swap usage with human-readable sizes",
        "example": "$ free -h\n              total   used   free  shared  buff/cache  available\nMem:           15Gi   4.2Gi  6.8Gi  512Mi    4.0Gi       10Gi\nSwap:           2Gi   0Gi    2Gi\n# 'available' is a better indicator of free memory than 'free'.\n# High swap usage indicates memory pressure."
    },
    "uptime": {
        "desc": "Show how long the system has been running and load averages",
        "example": "$ uptime\n 09:05:01 up 42 days, 3:21, 2 users, load average: 0.15, 0.10, 0.08\n# Load averages: 1-min, 5-min, 15-min averages of runnable processes.\n# Load > number of CPU cores = CPU bottleneck."
    },
    "top": {
        "desc": "Interactive real-time process and resource monitor",
        "example": "$ top\ntop - 09:05:01 up 42d, 2 users, load avg: 0.15, 0.10, 0.08\nTasks: 142 total, 1 running, 141 sleeping\n%Cpu(s):  2.1 us,  0.5 sy,  0.0 ni, 97.1 id,  0.3 wa\nMiB Mem: 15360.0 total, 10240.0 free, 4096.0 used, 1024.0 buff/cache\n# Press P = sort by CPU, M = sort by memory, q = quit, k = kill PID"
    },
    "ps aux": {
        "desc": "Show all running processes with CPU%, memory%, and command",
        "example": "$ ps aux | head -5\nUSER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.1 169064 10240 ?        Ss   Jun18   0:08 /sbin/init\nnginx     1235  0.1  0.3 123456 24000 ?        S    08:00   0:02 nginx: worker\nalice     9876  0.0  0.1  21568  9000 pts/0    Ss   09:00   0:00 -bash"
    },
    "lscpu": {
        "desc": "Display CPU architecture details: cores, threads, speed, cache",
        "example": "$ lscpu\nArchitecture: x86_64\nCPU(s):       8\nThread(s) per core: 2\nCore(s) per socket: 4\nSocket(s):    1\nCPU MHz:      3600.000\nL1d cache:    256 KiB\nL2 cache:     1 MiB\nL3 cache:     12 MiB"
    },
    "lsmem": {
        "desc": "Show a summary of available memory ranges",
        "example": "$ lsmem\nRANGE                                 SIZE  STATE REMOVABLE BLOCK\n0x0000000000000000-0x000000007fffffff   2G online       yes  0-15\n0x0000000100000000-0x000000047fffffff  14G online       yes  32-143\n\nMemory block size:    128M\nTotal online memory:   16G\nTotal offline memory:   0B"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 24. LINUX — Ref 08. User & Permissions Management (10 of 29 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("linux", "Ref 08. User & Permissions Management", {
    "chmod 755 file": {
        "desc": "rwxr-xr-x: owner full, group/other read+execute",
        "example": "$ chmod 755 deploy.sh\n$ ls -l deploy.sh\n-rwxr-xr-x 1 alice users 1024 Jun 20 09:05 deploy.sh\n# 7=rwx (owner), 5=r-x (group), 5=r-x (other)\n# Standard for executable scripts and public directories."
    },
    "chmod 644 file": {
        "desc": "rw-r--r--: owner read+write, group/other read only",
        "example": "$ chmod 644 config.yaml\n$ ls -l config.yaml\n-rw-r--r-- 1 alice users 1234 Jun 20 09:05 config.yaml\n# Standard for web-served files, config files, and public data."
    },
    "chmod 600 file": {
        "desc": "rw-------: owner read+write only, no group/other access",
        "example": "$ chmod 600 ~/.ssh/id_rsa\n$ ls -l ~/.ssh/id_rsa\n-rw------- 1 alice alice 3243 Jun 20 09:05 /home/alice/.ssh/id_rsa\n# Required by SSH: key files with wider permissions are rejected."
    },
    "chmod 700 dir": {
        "desc": "rwx------: owner full access, no group/other access",
        "example": "$ chmod 700 ~/.ssh\n$ ls -ld ~/.ssh\ndrwx------ 2 alice alice 4096 Jun 20 09:05 /home/alice/.ssh/\n# Required by SSH for the .ssh directory itself."
    },
    "chmod u+x file": {
        "desc": "Add execute permission for the file owner only",
        "example": "$ chmod u+x script.sh\n$ ls -l script.sh\n-rwxr--r-- 1 alice users 512 Jun 20 09:05 script.sh\n# u=user(owner), g=group, o=other, a=all\n# chmod +x script.sh  → adds execute for all three"
    },
    "chown user file": {
        "desc": "Change the owning user of a file",
        "example": "$ sudo chown www-data /var/www/html/index.html\n$ ls -l /var/www/html/index.html\n-rw-r--r-- 1 www-data www-data 1234 Jun 20 09:05 index.html"
    },
    "chown user:group file": {
        "desc": "Change both the owning user and group simultaneously",
        "example": "$ sudo chown alice:developers project.py\n$ ls -l project.py\n-rw-r--r-- 1 alice developers 4096 Jun 20 09:05 project.py"
    },
    "chown -R user:group dir": {
        "desc": "Recursively change owner and group for a directory tree",
        "example": "$ sudo chown -R www-data:www-data /var/www/html\n# Changes ownership on all files and directories under /var/www/html.\n# Verify: ls -la /var/www/html/"
    },
    "useradd -m -s /bin/bash username": {
        "desc": "Create a new user with a home directory and bash shell",
        "example": "$ sudo useradd -m -s /bin/bash deploy\n$ ls /home/deploy\n# Home directory created from /etc/skel template.\n# Set password: sudo passwd deploy\n# Add to group: sudo usermod -aG sudo deploy"
    },
    "usermod -aG group username": {
        "desc": "Add a user to a supplementary group without removing existing groups",
        "example": "$ sudo usermod -aG sudo alice\n$ groups alice\nalice : alice sudo developers\n# -a = append (omitting -a replaces all secondary groups!)\n# Changes take effect on next login."
    },
})

print("Linux ref section patches applied.")

# ══════════════════════════════════════════════════════════════════════════════
# 25. NETSCALER SDX — System (10 of 37 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("netscalersdx", "System", {
    "show system": {
        "example": "show system\n\nSDX Model:          SDX 22060\nFirmware Version:   14.1-21.57\nSerial Number:      ABC123456789\nManagement IP:      10.0.0.100\nUptime:             42 days, 03:21:05\nTemperature:        Normal\nFan Status:         Normal\nPower Supply:       Normal"
    },
    "show system version": {
        "example": "show system version\n\nSDX Firmware:  14.1 Build 21.57\nBuild Date:    Jun 15 2026\nXen Version:   4.14.5\nDom0 Kernel:   5.10.0-29"
    },
    "show system backup": {
        "example": "show system backup\n\nName              Size     Created\nbackup-20260615   4.2 MB   Jun 15 2026 02:00:01\nbackup-20260608   4.1 MB   Jun 08 2026 02:00:01\nbackup-20260601   4.1 MB   Jun 01 2026 02:00:01"
    },
    "show system backup <name>": {
        "example": "show system backup backup-20260615\n\nName:      backup-20260615\nSize:      4.2 MB\nCreated:   Jun 15 2026 02:00:01\nType:      Full\nStatus:    Complete"
    },
    "show system user": {
        "example": "show system user\n\nUsername       Role         Last Login\nnsroot         superuser    Jun 20 2026 08:55:12\nadmin          read-write   Jun 19 2026 16:30:00\nmonitor        read-only    Jun 20 2026 09:01:00"
    },
    "show system user <username>": {
        "example": "show system user nsroot\n\nUsername:    nsroot\nRole:        superuser\nGroups:      system\nLast Login:  Jun 20 2026 08:55:12\nSource IP:   10.0.0.5"
    },
    "create system backup <name>": {
        "example": "create system backup pre-upgrade-backup\n\nCreating backup pre-upgrade-backup ...\nBackup completed successfully.\nSize: 4.3 MB"
    },
    "restore system backup <name>": {
        "example": "restore system backup backup-20260615\n\nRestoring backup backup-20260615 ...\nWarning: This will overwrite current configuration. Proceed? [y/N]: y\nRestore completed. Reboot required to apply changes."
    },
    "set system ntp -server <ip>": {
        "example": "set system ntp -server 10.0.0.253\n\nNTP server 10.0.0.253 configured.\n# Verify: show system ntp\n# SDX syncs its Dom0 clock with NTP; VPXs inherit the hypervisor clock."
    },
    "show system ntp": {
        "example": "show system ntp\n\nNTP Server:    10.0.0.253\nStatus:        Synchronized\nStratum:       3\nOffset:        +0.123 ms\nLast Sync:     Jun 20 2026 09:00:00"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 26. NETSCALER SDX — Chassis (10 of 16 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("netscalersdx", "Chassis", {
    "show chassis": {
        "example": "show chassis\n\nModel:            SDX 22060\nSerial:           ABC123456789\nSlots:            2\nPower Supplies:   2 (both OK)\nFans:             6 (all OK)\nTemperature:      38°C (Normal)"
    },
    "show chassis status": {
        "example": "show chassis status\n\nOverall Status:   OK\nPower:            OK (PSU1 Active, PSU2 Standby)\nFan:              OK (6/6 running)\nTemperature:      OK (38°C, threshold 75°C)\nVoltage:          OK"
    },
    "show chassis fans": {
        "example": "show chassis fans\n\nFan   Speed (RPM)  Status\n1     4200         OK\n2     4180         OK\n3     4210         OK\n4     4190         OK\n5     4200         OK\n6     4185         OK"
    },
    "show chassis psu": {
        "example": "show chassis psu\n\nPSU   Status   Wattage  Input Voltage\n1     Active   350W     208V AC\n2     Standby  0W       208V AC\n# Both PSUs healthy; PSU2 takes over if PSU1 fails."
    },
    "show chassis temperature": {
        "example": "show chassis temperature\n\nSensor           Temp (°C)  Status   Threshold\nInlet            28         OK       50\nCPU              42         OK       80\nMemory           38         OK       75\nNIC              35         OK       70"
    },
    "show chassis voltage": {
        "example": "show chassis voltage\n\nRail     Voltage   Status\n3.3V     3.32V     OK\n5V       5.01V     OK\n12V      12.05V    OK\n-12V     -12.03V   OK"
    },
    "show chassis inventory": {
        "example": "show chassis inventory\n\nComponent        Part Number     Serial Number    Status\nMainboard        500-00000-01    MB12345678       OK\nNIC Card (Slot1) 500-00001-03    NIC123456        OK\nNIC Card (Slot2) 500-00001-03    NIC234567        OK\nPSU1             500-00100-02    PSU123456        OK\nPSU2             500-00100-02    PSU234567        OK"
    },
    "show chassis ports": {
        "example": "show chassis ports\n\nPort  Type      Speed    Status  VPX\n1/1   10GE SFP+ 10000    UP      VPX-01, VPX-02\n1/2   10GE SFP+ 10000    UP      VPX-03\n1/3   10GE SFP+ 10000    DOWN    -\n2/1   1GE RJ45  1000     UP      Mgmt"
    },
    "show chassis network": {
        "example": "show chassis network\n\nManagement Network:\n  IP:       10.0.0.100/24\n  Gateway:  10.0.0.1\n  DNS:      10.0.0.53\nData Network:\n  Interfaces: 1/1, 1/2, 1/3, 1/4"
    },
    "show chassis logs": {
        "example": "show chassis logs\n\nTimestamp              Severity  Message\nJun 20 09:00:01 UTC   INFO      System startup complete\nJun 20 08:59:55 UTC   INFO      Fan speed normalized\nJun 19 17:30:12 UTC   WARN      CPU temperature threshold 75% reached\nJun 19 17:28:00 UTC   INFO      VPX-02 started successfully"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 27. NETSCALER SDX — VPX (10 of 20 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("netscalersdx", "VPX", {
    "show vpx": {
        "example": "show vpx\n\nName       State    CPU  Memory  NS-IP         Version\nVPX-01     Running  4    8192    10.0.0.101    NS13.1-48.47\nVPX-02     Running  4    8192    10.0.0.102    NS13.1-48.47\nVPX-03     Stopped  2    4096    10.0.0.103    NS13.1-42.30"
    },
    "show vpx <name>": {
        "example": "show vpx VPX-01\n\nName:         VPX-01\nState:        Running\nNS-IP:        10.0.0.101\nVersion:      NS13.1-48.47\nCPU:          4 cores\nMemory:       8192 MB\nDisk:         120 GB\nSSL Chips:    2\nInterfaces:   1/1, 1/2\nUptime:       41d 18h 22m"
    },
    "show vpx -detail": {
        "example": "show vpx -detail\n\nVPX-01:\n  NSIP:          10.0.0.101\n  State:         Running\n  CPU Allocated: 4 / Available: 40\n  RAM Allocated: 8192 MB / Available: 65536 MB\n  SSL Chips:     2 / Available: 8\n  Throughput:    1000 Mbps\n  Domain ID:     2"
    },
    "show vpx status": {
        "example": "show vpx status\n\nName       Power   Health  CPU%  Mem%  Throughput\nVPX-01     On      OK      12%   45%   350 Mbps\nVPX-02     On      OK      8%    38%   120 Mbps\nVPX-03     Off     N/A     -     -     -"
    },
    "show vpx resources": {
        "example": "show vpx resources\n\nTotal SDX Resources:\n  CPU Cores:    40  Used: 10  Free: 30\n  Memory (MB):  65536  Used: 16384  Free: 49152\n  Disk (GB):    2000  Used: 480  Free: 1520\n  SSL Chips:    8  Used: 4  Free: 4\n  Throughput:   40 Gbps  Used: 2 Gbps  Free: 38 Gbps"
    },
    "show vpx <name> -interfaces": {
        "example": "show vpx VPX-01 -interfaces\n\nInterface  Type       VLAN  Speed   Status\n1/1        Data       10    10000   UP\n1/2        Data       20    10000   UP\n0/1        Mgmt       1     1000    UP"
    },
    "show vpx <name> -network": {
        "example": "show vpx VPX-01 -network\n\nNS-IP:         10.0.0.101/24\nSubnet Mask:   255.255.255.0\nGateway:       10.0.0.1\nMapped IP:     10.0.0.111\nVLAN:          10"
    },
    "show vpx <name> -licenses": {
        "example": "show vpx VPX-01 -licenses\n\nFeature            Status\nLoad Balancing     Enabled\nSSL Offload        Enabled\nContent Switching  Enabled\nRewrite            Enabled\nAppFW              Disabled\nThroughput:        1000 Mbps\nExpiry:            Dec 31 2027"
    },
    "show vpx <name> -events": {
        "example": "show vpx VPX-01 -events\n\nTimestamp              Event\nJun 20 08:00:01 UTC   VPX started\nJun 19 17:00:00 UTC   Config saved\nJun 18 02:00:00 UTC   Backup created\nJun 15 09:00:00 UTC   Firmware upgraded to NS13.1-48.47"
    },
    "show vpx <name> -backplane": {
        "example": "show vpx VPX-01 -backplane\n\nBackplane Interface:  intf_bkpl_0\nState:                UP\nSpeed:                10 Gbps\nVLAN Range:           1-4094\nPackets TX:           1,234,567\nPackets RX:           2,345,678\nErrors:               0"
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 28. NETSCALER SDX — Diagnostics (10 of 22 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("netscalersdx", "Diagnostics", {
    "show diagnostics": {
        "example": "show diagnostics\n\nComponent         Status   Last Check\nChassis           OK       Jun 20 09:00:00\nFans              OK       Jun 20 09:00:00\nPower Supply      OK       Jun 20 09:00:00\nMemory            OK       Jun 20 09:00:00\nCPU               OK       Jun 20 09:00:00\nNetwork           OK       Jun 20 09:00:00"
    },
    "show diagnostics -detail": {
        "example": "show diagnostics -detail\n\nChassis:\n  Temperature: 38°C (Threshold: 75°C) — OK\n  Voltage 3.3V: 3.32V — OK\n  Fan 1: 4200 RPM — OK\n\nMemory:\n  Total: 65536 MB\n  Used: 16384 MB (25%) — OK\n  ECC Errors: 0 — OK\n\nCPU:\n  Load: 15% (40 cores) — OK"
    },
    "ping <ip> -interface <intf>": {
        "example": "ping 10.0.0.1 -interface 0/1\n\nPING 10.0.0.1 (10.0.0.1): 56 data bytes\n64 bytes from 10.0.0.1: icmp_seq=0 ttl=255 time=0.312 ms\n64 bytes from 10.0.0.1: icmp_seq=1 ttl=255 time=0.298 ms\n--- 10.0.0.1 ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss"
    },
    "traceroute <ip>": {
        "example": "traceroute 8.8.8.8\n\ntraceroute to 8.8.8.8 (8.8.8.8), 30 hops max\n 1  10.0.0.1 (10.0.0.1)  0.412 ms  0.398 ms\n 2  192.168.1.1 (192.168.1.1)  1.234 ms  1.201 ms\n 3  8.8.8.8 (8.8.8.8)  10.512 ms  10.489 ms"
    },
    "show log": {
        "example": "show log\n\nJun 20 09:05:01 [INFO]  VPX-01: Configuration saved\nJun 20 09:00:01 [INFO]  System health check passed\nJun 19 17:30:12 [WARN]  VPX-03 CPU usage exceeded 80%\nJun 19 17:00:00 [INFO]  Backup backup-20260619 completed"
    },
    "show log -level WARNING": {
        "example": "show log -level WARNING\n\nJun 20 08:55:00 [WARN]  NIC port 1/3 link down\nJun 19 17:30:12 [WARN]  VPX-03 CPU usage exceeded 80%\nJun 18 14:20:00 [ERROR] VPX-02 failed to start: insufficient memory"
    },
    "show arp": {
        "example": "show arp\n\nIP Address     MAC Address        Interface  Age\n10.0.0.1       00:50:56:8f:aa:01  0/1        10 min\n10.0.0.5       00:50:56:8f:bb:02  0/1        2 min\n10.0.0.200     00:50:56:8f:cc:03  0/1        45 min"
    },
    "show route": {
        "example": "show route\n\nDestination    Gateway        Interface  Metric\n0.0.0.0/0      10.0.0.1       0/1        1\n10.0.0.0/24    0.0.0.0        0/1        0"
    },
    "show interface": {
        "example": "show interface\n\nInterface  Status  Speed   Duplex  TX Pkts     RX Pkts     Errors\n0/1        UP      1000    Full    1,234,567   2,345,678   0\n1/1        UP      10000   Full    9,876,543   8,765,432   0\n1/2        UP      10000   Full    5,432,100   4,321,000   0\n1/3        DOWN    -       -       0           0           0"
    },
    "show process": {
        "example": "show process\n\nPID    Name              CPU%  Memory    Status\n1      init              0.0%  1.2 MB    Running\n1234   xenconsoled       0.1%  8.4 MB    Running\n5678   xenstored         0.2%  12.1 MB   Running\n9012   snmpd             0.1%  5.6 MB    Running\n# SDX Dom0 processes — not VPX processes (those are in their own domains)."
    },
})

# ══════════════════════════════════════════════════════════════════════════════
# 29. NETSCALER SDX — HA (10 of 24 missing)
# ══════════════════════════════════════════════════════════════════════════════
patch("netscalersdx", "HA", {
    "show ha": {
        "example": "show ha\n\nHA Status:         Active\nPeer IP:           10.0.0.101\nPeer State:        Standby\nSync State:        In Sync\nLast Sync:         Jun 20 09:00:01\nFailover Count:    0"
    },
    "show ha status": {
        "example": "show ha status\n\nLocal Node:\n  Role:       Primary (Active)\n  IP:         10.0.0.100\n  State:      MASTER\n\nPeer Node:\n  Role:       Secondary (Standby)\n  IP:         10.0.0.101\n  State:      SLAVE\n  Heartbeat:  OK (last received 2s ago)"
    },
    "show ha sync": {
        "example": "show ha sync\n\nSync Status:     Complete\nLast Sync Time:  Jun 20 09:00:01\nConfig Sync:     OK\nLicense Sync:    OK\nVPX Sync:        OK\nPending Changes: 0"
    },
    "force ha failover": {
        "example": "force ha failover\n\nWarning: This will make the Standby node the Active node. Proceed? [y/N]: y\nInitiating HA failover...\nLocal node transitioning to SLAVE state.\nPeer node transitioning to MASTER state.\nFailover complete. New Active: 10.0.0.101"
    },
    "show ha heartbeat": {
        "example": "show ha heartbeat\n\nInterface  Heartbeat  Last Received  Missed\n0/1        Enabled    0.5s ago       0\nHA-Link    Enabled    0.5s ago       0\n# Missed heartbeats > 3 within the dead interval trigger a failover."
    },
    "set ha -node <ip> -inc <interface>": {
        "example": "set ha -node 10.0.0.101 -inc 0/1\n# Configures the HA peer IP and the interface to monitor (INC = Interested Network Channel).\n# The SDX will failover if the monitored interface on the primary goes down.\n# Verify: show ha"
    },
    "show ha config": {
        "example": "show ha config\n\nHA Enabled:       YES\nDead Interval:    3 s\nHello Interval:   200 ms\nSynchronize:      YES\nSyncVpxConfig:    YES\nFailsafe Mode:    NO"
    },
    "sync ha": {
        "example": "sync ha\n\nForcing HA configuration synchronization...\nSyncing configuration to peer 10.0.0.101...\nSync complete."
    },
    "show ha events": {
        "example": "show ha events\n\nTimestamp              Event\nJun 20 09:00:00 UTC   HA sync complete\nJun 15 08:30:00 UTC   HA failover: Primary → Standby\nJun 15 08:29:55 UTC   Heartbeat missed (3 consecutive)\nJun 15 08:25:00 UTC   HA enabled"
    },
    "show ha failover": {
        "example": "show ha failover\n\nFailover History:\n  Jun 15 08:30:00 UTC  Reason: Heartbeat loss  Duration: 4s\n  May 10 14:15:00 UTC  Reason: Manual failover  Duration: 3s\nTotal Failovers: 2\nLast Failover: Jun 15 08:30:00 UTC"
    },
})

print("NetScaler SDX patches applied.")

# ══════════════════════════════════════════════════════════════════════════════
# 30. NEW COMMANDS (10 total — distributed across platforms)
# ══════════════════════════════════════════════════════════════════════════════

# NEW 1-2: Wireshark — Display Filters Basic (QUIC / HTTP3 + multipath TCP)
add_command("wireshark", "Display Filters — Basic", {
    "cmd": "quic",
    "desc": "All QUIC (HTTP/3 transport) packets — UDP 443 with QUIC magic bytes",
    "type": "show",
    "flagged": False,
    "example": "# Matches all QUIC datagrams.\n# QUIC runs over UDP (typically port 443) and carries HTTP/3.\n# Frame 1:  10.0.0.5:54321 → 10.0.0.10:443  QUIC Initial  DCID=...\n# Frame 2:  10.0.0.10:443  → 10.0.0.5:54321  QUIC Handshake\n# If you see no QUIC frames on port 443, the server may have disabled HTTP/3.\n# Combine: quic and ip.addr == 10.0.0.10  → QUIC to a specific server."
})

add_command("wireshark", "Display Filters — Basic", {
    "cmd": "tcp.option.mptcp",
    "desc": "Packets using Multipath TCP (MPTCP) extensions in the TCP options",
    "type": "show",
    "flagged": False,
    "example": "# Matches TCP frames that carry Multipath TCP (RFC 8684) options.\n# MPTCP allows a single connection to span multiple network paths.\n# Frame 1:  10.0.0.5:54321 → 10.0.0.10:80  [SYN]  Options: MPTCP MP_CAPABLE\n# Frame 2:  10.0.0.10:80   → 10.0.0.5:54321 [SYN,ACK] Options: MPTCP MP_CAPABLE\n# MPTCP is used by iOS for Siri and increasingly in Linux kernel 5.6+."
})

# NEW 3-4: Wireshark — Display Filters VPN/IPsec
add_command("wireshark", "Display Filters — VPN / IPsec / GRE", {
    "cmd": "wireguard",
    "desc": "WireGuard VPN packets (UDP, typically port 51820)",
    "type": "show",
    "flagged": False,
    "example": "# Matches WireGuard protocol packets (Wireshark 3.4+).\n# WireGuard uses UDP, commonly port 51820 but any port is valid.\n# Frame 1:  10.0.0.5:51820 → 10.0.0.1:51820  WireGuard Handshake Initiation\n# Frame 2:  10.0.0.1:51820 → 10.0.0.5:51820  WireGuard Handshake Response\n# Frame 3:  10.0.0.5:51820 → 10.0.0.1:51820  WireGuard Transport Data (encrypted)\n# After handshake, all data is encrypted — only handshake frames are dissected."
})

# NEW 5: OpenSSL — TLS Client Testing (OCSP stapling check)
add_command("openssl", "TLS Client Testing", {
    "cmd": "openssl s_client -connect host:443 -servername host -status 2>/dev/null </dev/null | grep -A5 'OCSP response'",
    "desc": "Check whether the server sends an OCSP stapled response in the TLS handshake",
    "type": "show",
    "flagged": False,
    "example": "$ openssl s_client -connect example.com:443 -servername example.com \\\n    -status 2>/dev/null </dev/null | grep -A5 'OCSP response'\nOCSP response:\n======================================\nOCSP Response Data:\n    OCSP Response Status: successful (0x0)\n    Response Type: Basic OCSP Response\n    This Update: Jun 20 08:00:00 2026 GMT\n    Next Update: Jun 27 08:00:00 2026 GMT\n    Cert Status: good\n# If no OCSP response is stapled: 'OCSP response: no response sent'\n# Stapling avoids the client having to query the OCSP responder directly."
})

# NEW 6: Linux — Networking (ss command — modern replacement for netstat)
add_command("linux", "Ref 06. Networking Commands", {
    "cmd": "ss -tlnp",
    "desc": "List all TCP listening sockets with process names and PIDs",
    "type": "show",
    "flagged": False,
    "example": "$ ss -tlnp\nState   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process\nLISTEN  0       128     0.0.0.0:22         0.0.0.0:*          users:((\"sshd\",pid=1234,fd=3))\nLISTEN  0       511     0.0.0.0:80         0.0.0.0:*          users:((\"nginx\",pid=5678,fd=6))\nLISTEN  0       511     0.0.0.0:443        0.0.0.0:*          users:((\"nginx\",pid=5678,fd=7))\nLISTEN  0       100     127.0.0.1:5432     0.0.0.0:*          users:((\"postgres\",pid=9012,fd=5))\n# ss replaces netstat; -t=TCP -l=listening -n=numeric -p=processes"
})

# NEW 7: Linux — Networking (nmap quick host scan)
add_command("linux", "Networking", {
    "cmd": "nmap -sn 10.0.0.0/24",
    "desc": "Ping-scan an entire subnet to discover live hosts (no port scan)",
    "type": "show",
    "flagged": False,
    "example": "$ nmap -sn 10.0.0.0/24\nStarting Nmap 7.94\nNmap scan report for 10.0.0.1\nHost is up (0.00050s latency).\nNmap scan report for 10.0.0.5\nHost is up (0.00020s latency).\nNmap scan report for 10.0.0.100\nHost is up (0.00080s latency).\n3 hosts up, 253 hosts down — scanned in 2.34 seconds.\n# -sn = ping-only, no port scan. Run as root for ARP-based detection on local subnet."
})

# NEW 8: Palo Alto — System (tech-support file generation)
add_command("paloalto", "System & Status", {
    "cmd": "request support generate-tech-support-file",
    "desc": "Generate a full tech-support bundle (logs, config, diagnostics) for TAC",
    "type": "show",
    "flagged": False,
    "example": "> request support generate-tech-support-file\n\nGenerating tech support file...\nFile /tmp/tech_support/tech-support-2026-06-20.tgz created.\nSize: 28.4 MB\n\n# Download via SCP:\n#   scp admin@10.0.0.1:/tmp/tech_support/tech-support-2026-06-20.tgz /local/path/\n# Or via GUI: Device → Tech Support → Generate\n# Required by Palo Alto TAC for case submissions."
})

# NEW 9: Cisco IOS — interface error checking
add_command("ciscoios", "Interfaces", {
    "cmd": "show interfaces counters errors",
    "desc": "Display per-interface error counters: input errors, CRC, frame, output drops",
    "type": "show",
    "flagged": False,
    "example": "Router# show interfaces counters errors\n\nPort        Align-Err  FCS-Err  Xmit-Err  Rcv-Err  UnderSize  OutDiscards\nGi0/0/0         0          0        0         0           0            0\nGi0/0/1         0         12        0        12           0            0\nGi0/0/2      1245       1245        0      1245           0            0\n\n# Non-zero FCS-Err / Align-Err on Gi0/0/2 indicates a physical layer problem:\n#   duplex mismatch, bad cable, failing NIC, or SFP issue.\n# Show full detail: show interfaces GigabitEthernet0/0/2"
})

# NEW 10: NetScaler SDX — VPX Lifecycle (snapshot)
add_command("netscalersdx", "VPX Lifecycle", {
    "cmd": "create vpx snapshot <vpx-name> -name <snapshot-name>",
    "desc": "Take a snapshot of a VPX instance before upgrades or config changes",
    "type": "config",
    "flagged": False,
    "example": "create vpx snapshot VPX-01 -name pre-upgrade-snapshot\n\nCreating snapshot of VPX-01...\nSnapshot pre-upgrade-snapshot created successfully.\nSize: 12.3 GB\n\n# List snapshots: show vpx snapshot VPX-01\n# Restore:        restore vpx snapshot VPX-01 -name pre-upgrade-snapshot\n# Snapshots capture disk, memory, and config state of the VPX."
})

print("10 new commands added.")

# ══════════════════════════════════════════════════════════════════════════════
# 31. WIRESHARK — Remaining missed entries (exact-key fix pass)
# ══════════════════════════════════════════════════════════════════════════════
patch("wireshark", "Display Filters — TCP/UDP", {
    "tcp.analysis.flags": {
        "example": "# Matches any TCP frame that Wireshark has flagged with an analysis note.\n# Includes retransmissions, out-of-order, zero-window, fast-retransmit, dup-ACK, etc.\n# Equivalent to filtering every tcp.analysis.* field simultaneously.\n# Frame 15: [TCP Retransmission]\n# Frame 22: [TCP Out-Of-Order]\n# Frame 30: [TCP ZeroWindow]\n# Use this as a broad 'health check' filter, then narrow to specific flag types."
    },
    "tcp.window_size_value == 0": {
        "example": "# Matches TCP frames where the raw window size field is zero.\n# Indicates the receiver's buffer is full — sender must pause data transfer.\n# Frame 30: 10.0.0.10 → 10.0.0.5  [TCP ZeroWindow]  Win=0\n# After the receiver drains its buffer it sends a Window Update (Win > 0).\n# Sustained zero windows point to slow application consumption or memory pressure.\n# Pair with tcp.analysis.zero_window for the Wireshark-annotated view."
    },
    "tcp.stream eq 0": {
        "example": "# Matches all frames belonging to TCP stream index 0.\n# Wireshark assigns a sequential stream index (eq 0, eq 1, eq 2 …) to each\n# unique TCP connection in the capture.\n# Right-click → Follow → TCP Stream auto-applies this filter.\n# Change the number to isolate a different connection:\n#   tcp.stream eq 5  → the 6th TCP connection in the capture"
    },
    "udp.port == 53": {
        "example": "# Matches DNS traffic on UDP port 53 (queries and responses).\n# Frame 1:  10.0.0.5:52341 → 8.8.8.8:53    DNS query A www.example.com\n# Frame 2:  8.8.8.8:53    → 10.0.0.5:52341  DNS response A 93.184.216.34\n# For DNS over TCP (large responses, AXFR zone transfers): tcp.port == 53\n# Combine: udp.port == 53 and dns.flags.rcode != 0  → failed DNS queries"
    },
    "tcp.options.mss_val < 1460": {
        "example": "# Matches TCP SYN frames advertising an MSS below the standard 1460 bytes.\n# Standard MSS = 1500 (MTU) - 20 (IP) - 20 (TCP) = 1460 bytes.\n# Lower values indicate:\n#   - PPPoE path: MSS = 1452 (1500 - 8 PPPoE overhead)\n#   - VPN tunnel: MSS reduced to fit tunnel encapsulation\n#   - Explicit MSS clamping by a firewall/NAT device\n# Frame 1:  SYN  Options: MSS=1452  → likely PPPoE or VPN client"
    },
})

patch("wireshark", "Display Filters — HTTP/HTTPS", {
    "http2": {
        "example": "# Matches all HTTP/2 frames (binary framing layer over TLS or cleartext).\n# Requires decryption if running over TLS — set SSLKEYLOGFILE first.\n# Frame 5:  10.0.0.5 → 10.0.0.10  HTTP2 SETTINGS frame\n# Frame 6:  10.0.0.10 → 10.0.0.5  HTTP2 SETTINGS ACK\n# Frame 7:  10.0.0.5 → 10.0.0.10  HTTP2 HEADERS (GET /api/v1/data)\n# HTTP/2 multiplexes multiple streams over one TCP connection."
    },
    "http2.type == 1": {
        "example": "# Matches HTTP/2 HEADERS frames (type 1) — equivalent to HTTP/1.1 request/response headers.\n# Frame 7:  10.0.0.5 → 10.0.0.10  HTTP2 HEADERS\n#   :method: GET\n#   :path: /api/v1/users\n#   :scheme: https\n#   :authority: api.example.com\n# HTTP/2 frame types: 0=DATA, 1=HEADERS, 4=SETTINGS, 6=PING, 7=GOAWAY, 8=WINDOW_UPDATE"
    },
    "quic": {
        "example": "# Matches all QUIC (Quick UDP Internet Connections) packets — HTTP/3 transport.\n# QUIC runs over UDP (typically port 443) with TLS 1.3 embedded.\n# Frame 1:  10.0.0.5:54321 → 10.0.0.10:443  QUIC Initial  DCID=0x1234...\n# Frame 2:  10.0.0.10:443  → 10.0.0.5:54321  QUIC Handshake  SCID=0xABCD...\n# Frame 3:  10.0.0.5:54321 → 10.0.0.10:443  QUIC 1-RTT (application data)\n# Requires Wireshark 3.3+ for full QUIC dissection."
    },
})

patch("wireshark", "Display Filters — ARP / ICMP", {
    "icmpv6.type == 136": {
        "example": "# Matches ICMPv6 Neighbor Advertisement (NA) — the IPv6 ARP Reply equivalent.\n# Sent in response to a Neighbor Solicitation or gratuitously after address assignment.\n# Frame 6:  fe80::1 → fe80::2   ICMPv6 Neighbor Advertisement\n#   Target: 2001:db8::1  Override=1  Solicited=1\n#   Target Link-Layer Address: 00:11:22:33:44:55\n# If no NA follows an NS, the target IPv6 address is unreachable."
    },
    "icmpv6.type == 134": {
        "example": "# Matches ICMPv6 Router Advertisement (RA) — sent by routers to advertise\n# the link prefix, gateway, MTU, and SLAAC/DHCPv6 flags.\n# Frame 1:  fe80::1 → ff02::1  ICMPv6 Router Advertisement\n#   Prefix: 2001:db8::/64  A-flag=1 (SLAAC)  L-flag=1\n#   Router Lifetime: 1800s\n#   MTU: 1500\n# Hosts use RA to auto-configure IPv6 addresses (SLAAC) and set their default gateway."
    },
})

patch("wireshark", "Display Filters — AD / Kerberos / SMB / LDAP", {
    "dcerpc": {
        "example": "# Matches DCE/RPC protocol frames used by Windows RPC services.\n# Many Windows protocols run over DCE/RPC: WMI, DCOM, SAMR, LSARPC, DRSUAPI.\n# Frame 10: 10.0.0.5 → 10.0.0.10  DCERPC Bind  Interface: DRSUAPI (AD replication)\n# Frame 11: 10.0.0.10 → 10.0.0.5  DCERPC Bind_ack\n# Frame 12: 10.0.0.5 → 10.0.0.10  DCERPC Request: DsGetNcChanges\n# High DCERPC error rate can indicate DCSync attacks or replication issues."
    },
})

patch("wireshark", "Display Filters — 802.11 / Wireless", {
    "wlan_radio.channel == 36": {
        "example": "# Matches frames captured on 802.11 radio channel 36 (5 GHz, 5180 MHz).\n# Requires a monitor-mode capture with radiotap or prism headers.\n# Frame 1:  [Channel: 36  Signal: -55 dBm]  Beacon  SSID=CorpWiFi\n# Channel 36 is a non-overlapping 5 GHz channel (UNII-1 band).\n# Common 5 GHz non-overlapping 20 MHz channels: 36, 40, 44, 48, 149, 153, 157, 161"
    },
    "radiotap.dbm_antsignal < -75": {
        "example": "# Matches frames received with a signal strength below -75 dBm (weak signal).\n# Radiotap headers carry per-frame RF metadata from the capture adapter.\n# Frame 12: [Signal: -78 dBm]  Data  STA → AP  [TCP Retransmission]\n# Signal thresholds (approximate):\n#   > -65 dBm : Excellent (streaming video OK)\n#   -65 to -75: Good (VoIP / browsing OK)\n#   < -75 dBm : Poor (packet loss, retransmissions expected)\n#   < -85 dBm : Unusable"
    },
})

patch("wireshark", "Coloring Rules & Workflow", {
    "Ctrl+Shift+L": {
        "example": "# Keyboard shortcut: reload all colour rules from disk without restarting Wireshark.\n# Use after editing Edit → Coloring Rules... and saving.\n# If frames aren't recoloring after a rule edit, Ctrl+Shift+L forces a refresh.\n# Equivalent menu: View → Reload this file (re-applies all display filters and rules)."
    },
    "Ctrl+F": {
        "example": "# Keyboard shortcut: open the Find Packet dialog (Edit → Find Packet).\n# Search options:\n#   Display Filter: enter a filter expression (e.g. ip.addr == 10.0.0.1)\n#   Hex Value:      search packet bytes (e.g. for a magic number)\n#   String:         search packet text content (e.g. 'password' in HTTP payload)\n#   Regex:          PCRE regex across packet text\n# Press Ctrl+N / Ctrl+B to jump to next / previous match after a search."
    },
})

print("Remaining Wireshark entries patched.")

# ══════════════════════════════════════════════════════════════════════════════
# FINAL: update timestamp and save
# ══════════════════════════════════════════════════════════════════════════════
from datetime import datetime, timezone
db["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

with open(DATA, "w") as f:
    json.dump(db, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"Saved to {DATA}")

# Summary of changes
total = 0
for plat, pdata in db["platforms"].items():
    for section, cmds in pdata["sections"].items():
        for cmd in cmds:
            if "example" in cmd and cmd["example"]:
                total += 1
print(f"Total commands with examples now: {total}")

