// NetScaler nstrace filter syntax reference — adds detailed entries
// covering every CONNECTION.* qualifier supported by the filter engine,
// common-use-case templates, plus rich example outputs for show nstrace,
// stop nstrace, and the existing nstrace placeholders.
//
// Run: node scripts/add-nstrace-examples.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ENTRIES = [
  // ============== Top-level nstrace commands (attach to existing) ==============
  { cmd: 'start nstrace -size 0 -filter "VSVRIP == 10.0.0.10 && VSVRPORT == 443" -mode TXB',
    section: 'VIP Hit Counter Troubleshooting',
    desc: 'Start a packet capture filtered to a specific VIP/port using the legacy "VSVRIP/VSVRPORT" classic-mode filter (use modern CONNECTION.* syntax for new captures).',
    example: `> start nstrace -size 0 -filter "VSVRIP == 10.0.0.10 && VSVRPORT == 443" -mode TXB
nstrace started successfully

What it means:
- -size 0 : full packet capture (no truncation). Default 164 bytes.
- -filter : only matching connections are written to the trace file.
- -mode TXB : capture transmitted-buffered packets in addition to RX.
- Files land in /var/nstrace/ as ns_<id>_NN.cap, rotated every 1h
  by default (see -nf and -time flags).` },
  { cmd: 'stop nstrace',
    section: 'VIP Hit Counter Troubleshooting',
    desc: 'Stop an in-progress nstrace capture and flush the trace files to /var/nstrace/.',
    example: `> stop nstrace

nstrace: stopped, captured 128394 packets, 0 dropped
Trace file: /var/nstrace/ns_00001.cap

What it means:
- Stops the running capture and seals the .cap files so they can be
  copied off-box (scp /var/nstrace/*.cap user@host:/path/).
- "0 dropped" means no kernel buffer overruns — capture is complete.` },
  { cmd: 'show nstrace',
    section: 'VIP Hit Counter Troubleshooting',
    desc: 'Display the status of the running (or last) nstrace — packets captured, packets dropped, current file, and capture parameters.',
    example: `> show nstrace
        State: Running
        Packets captured: 128394
        Packets dropped: 0
        Current file: /var/nstrace/ns_00001.cap
        Filter: CONNECTION.DSTIP.EQ(10.248.1.15)
        Mode: NEW_RX TXB
        Size: 0 (full packet)
        File rotation: 24 files × 3600 sec

What it means:
- Use to monitor an ongoing capture without stopping it.
- "Packets dropped > 0" means the capture buffer is overrunning —
  shrink -size, narrow the -filter, or capture for less time.
- Same command also displays the configured filter so you can confirm
  exactly what is being matched.` },

  // ============== Existing Diagnostics placeholders — attach examples ==============
  { cmd: 'nstrace -size 0 -tcpdump YES -nodes 0',
    section: 'Diagnostics',
    example: `> nstrace -size 0 -tcpdump YES -nodes 0

nstrace: Started full capture, output in tcpdump format
File: /var/nstrace/ns0.pcap

What it means:
- -size 0    : full packet capture (no truncation).
- -tcpdump YES : write in pcap format (open with Wireshark / tcpdump).
- -nodes 0   : on a cluster, capture only the local node (0).
- Equivalent to "start nstrace -filetype PCAP" on modern firmware.` },
  { cmd: 'nstrace -stop',
    section: 'Diagnostics',
    example: `> nstrace -stop

nstrace: stopped
Captured: 524288 packets
Dropped : 0

What it means:
- Legacy form (without "start") still works on older firmware.
- Modern equivalent is just "stop nstrace".` },
  { cmd: 'nstrace.sh -time 60 -size 0',
    section: 'Diagnostics',
    example: `# shell nstrace.sh -time 60 -size 0
nstrace.sh: starting capture for 60 seconds, full packet
Capture complete. Output: /var/nstrace/ns0.cap

What it means:
- BSD-shell helper script that wraps "start nstrace" and auto-stops
  after the specified time.
- Run from "shell" prompt, NOT from the NetScaler CLI:
    > shell
    # nstrace.sh -time 60 -size 0` },

  // ============== Base filter command (canonical entry) ==============
  { cmd: 'start nstrace -filter <expression>',
    section: 'Diagnostics', type: 'config',
    desc: 'Start a NetScaler packet trace with a CONNECTION.* filter expression. Every connection that matches the expression is written to /var/nstrace/. Filter expressions support &&, || and grouping with parentheses; the whole filter must be enclosed in double quotes.',
    example: `> start nstrace -filter "CONNECTION.DSTIP.EQ(10.248.1.15)"
nstrace: started, output in /var/nstrace/ns_00001.cap

# Expression grammar:
#   CONNECTION.<qualifier>.<method>(<value>)
#   joined by  &&  (AND)  or  ||  (OR)
#   parens for grouping

# Method shortlist by qualifier type:
#   IP/IPv6/INTF/SERVICE_TYPE  : EQ, NE
#   ports / VLAN / CONNID /
#     PPEID / TRAFFIC_DOMAIN_ID: EQ, NE, GT, GE, LT, LE, BETWEEN
#   SVCNAME / LB_VSERVER.NAME /
#     CS_VSERVER.NAME          : EQ, NE, CONTAINS, STARTSWITH, ENDSWITH

What it means:
- The expression is evaluated per-connection. Hits → packets are
  written to the rolling trace files.
- Quote string values: SVCNAME.EQ("svc1") not SVCNAME.EQ(svc1).
- Combine with -size 0 for full packets and -link ENABLED to also
  capture the linked server-side flow when matching the client side
  (or vice-versa).` },

  // ============== Per-qualifier reference entries ==============
  { cmd: 'start nstrace -filter "CONNECTION.SRCIP.EQ(<ipv4>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by client (source) IPv4 address. Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.SRCIP.EQ(10.1.1.1)"
nstrace: started, filter matches client IP 10.1.1.1

What it means:
- SRCIP is the original client IP. On the back-end leg this becomes
  a SNIP (because the ADC source-NATs by default), so use SVCNAME or
  LB_VSERVER.NAME to follow the back-end side.
- Use NE to exclude a noisy client: CONNECTION.SRCIP.NE(127.0.0.1)` },
  { cmd: 'start nstrace -filter "CONNECTION.DSTIP.EQ(<ipv4>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by destination IPv4 address. Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.DSTIP.EQ(10.248.1.15)"
nstrace: started, filter matches destination IP 10.248.1.15

What it means:
- DSTIP is the destination as seen by the ADC packet-engine — for
  client → ADC traffic this is a VIP; for ADC → server traffic it is
  the back-end real-server IP.
- Combine with .NE to exclude management subnets, e.g.
    CONNECTION.DSTIP.NE(192.168.0.0/16)  ← (subnet not allowed; use IP only)` },
  { cmd: 'start nstrace -filter "CONNECTION.IP.EQ(<ipv4>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic where IPv4 address (source OR destination) equals the value. Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.IP.EQ(10.1.1.1)"
nstrace: started, filter matches either side = 10.1.1.1

What it means:
- Equivalent to "(SRCIP.EQ X || DSTIP.EQ X)" but shorter.
- Useful when you don't yet know whether the host you're chasing is
  client or server in the conversation.
- The classic "exclude loopback then match host" idiom:
   "CONNECTION.IP.NE(127.0.0.1) && CONNECTION.IP.EQ(10.102.44.111)"` },
  { cmd: 'start nstrace -filter "CONNECTION.SRCIPv6.EQ(<ipv6>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by client (source) IPv6 address. Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.SRCIPv6.EQ(2001:db8:0:0:1::1)"
nstrace: started, filter matches IPv6 source 2001:db8::1::1

What it means:
- IPv6 form of SRCIP. Address is parsed as a single hex literal —
  do NOT enclose in brackets.
- Methods limited to EQ / NE — no subnet matching.` },
  { cmd: 'start nstrace -filter "CONNECTION.DSTIPv6.EQ(<ipv6>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by destination IPv6 address. Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.DSTIPv6.EQ(2001:db8::10)"
nstrace: started, filter matches IPv6 destination 2001:db8::10

What it means:
- IPv6 form of DSTIP. Same usage rules as DSTIP — typical use is to
  catch traffic destined to a v6 VIP or backend server.` },
  { cmd: 'start nstrace -filter "CONNECTION.IPv6.EQ(<ipv6>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic where IPv6 address (source OR destination) equals the value. Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.IPv6.EQ(2001:db8::10)"
nstrace: started, filter matches either side = 2001:db8::10

What it means:
- Combined SRCIPv6 || DSTIPv6 in a single qualifier.` },
  { cmd: 'start nstrace -filter "CONNECTION.SRCPORT.EQ(<port>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by client (source) TCP/UDP port. Methods: EQ, NE, GT, GE, LT, LE, BETWEEN.',
    example: `> start nstrace -filter "CONNECTION.SRCPORT.EQ(443)"
nstrace: started, filter matches source port 443

# BETWEEN form:
> start nstrace -filter "CONNECTION.SRCPORT.BETWEEN(49152,65535)"
nstrace: started, filter matches ephemeral source ports

What it means:
- Use BETWEEN to capture an ephemeral port range — handy when chasing
  client-initiated reconnect storms.
- Most operational filtering uses DSTPORT (server port); SRCPORT is
  rarely useful unless investigating outbound flows.` },
  { cmd: 'start nstrace -filter "CONNECTION.DSTPORT.EQ(<port>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by destination TCP/UDP port. Methods: EQ, NE, GT, GE, LT, LE, BETWEEN.',
    example: `> start nstrace -filter "CONNECTION.DSTPORT.EQ(443)"
nstrace: started, filter matches destination port 443

# OR-pattern for HTTP + HTTPS:
> start nstrace -filter "CONNECTION.DSTPORT.EQ(80) || CONNECTION.DSTPORT.EQ(443)"
nstrace: started, filter matches HTTP or HTTPS

What it means:
- Most useful per-port filter — catches all traffic terminating on
  the named service port (VIP listener or backend server port).
- Combine with -link ENABLED to also capture the corresponding
  back-end leg of each matched flow.` },
  { cmd: 'start nstrace -filter "CONNECTION.PORT.EQ(<port>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic where TCP/UDP port (source OR destination) equals the value. Methods: EQ, NE, GT, GE, LT, LE, BETWEEN.',
    example: `> start nstrace -filter "CONNECTION.PORT.EQ(443)"
nstrace: started, filter matches either side port = 443

What it means:
- Equivalent to (SRCPORT.EQ X || DSTPORT.EQ X). Convenient when you
  want any conversation involving the named port, regardless of
  direction.` },
  { cmd: 'start nstrace -filter "CONNECTION.VLANID.EQ(<id>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic on a specific VLAN ID. Methods: EQ, NE, GT, GE, LT, LE, BETWEEN.',
    example: `> start nstrace -filter "CONNECTION.VLANID.EQ(20)"
nstrace: started, filter matches VLAN 20

What it means:
- Useful on multi-tenant ADCs to isolate one customer's flows by
  their dedicated VLAN.
- VLAN 0 is the native (untagged) VLAN.` },
  { cmd: 'start nstrace -filter "CONNECTION.CONNID.EQ(<id>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by internal PCB (Protocol Control Block) ID. Methods: EQ, NE, GT, GE, LT, LE, BETWEEN.',
    example: `> start nstrace -filter "CONNECTION.CONNID.EQ(123456)"
nstrace: started, filter matches PCB 123456

What it means:
- The PCB ID uniquely identifies a single TCP connection on the
  ADC. Pull it from "show ns connectiontable" and feed into the
  filter to capture exactly one conversation end-to-end.` },
  { cmd: 'start nstrace -filter "CONNECTION.PPEID.EQ(<id>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic handled by a specific Packet Processing Engine (PE) core. Methods: EQ, NE, GT, GE, LT, LE, BETWEEN.',
    example: `> start nstrace -filter "CONNECTION.PPEID.EQ(0)"
nstrace: started, filter matches PE-0 only

What it means:
- Multi-PE ADCs distribute connections across cores. Use PPEID to
  capture only flows handled by one specific PE — useful when one
  PE shows abnormal CPU or drops in "stat ns -detail".
- Get PE count from "show ns -detail" or "shell ps aux | grep ppe".` },
  { cmd: 'start nstrace -filter "CONNECTION.SVCNAME.EQ(<name>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by NetScaler service name. Methods: EQ, NE, CONTAINS, STARTSWITH, ENDSWITH.',
    example: `> start nstrace -filter "CONNECTION.SVCNAME.EQ(\\"svc-web1\\")"
nstrace: started, filter matches service "svc-web1"

# CONTAINS (fuzzy) form:
> start nstrace -filter "CONNECTION.SVCNAME.CONTAINS(\\"web\\")"
nstrace: started, filter matches any service whose name contains "web"

What it means:
- SVCNAME refers to the NAME of a configured "service" object, not
  a free-form text. Find names with "show service".
- String values must be in escaped double-quotes inside the outer
  filter quotes: "CONNECTION.SVCNAME.EQ(\\"svc1\\")".
- Pair with -link ENABLED to also capture the corresponding client
  (VIP-side) leg of every matched server-side flow.` },
  { cmd: 'start nstrace -filter "CONNECTION.LB_VSERVER.NAME.EQ(<name>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic that hits a specific LB virtual server. Methods: EQ, NE, CONTAINS, STARTSWITH, ENDSWITH.',
    example: `> start nstrace -filter "CONNECTION.LB_VSERVER.NAME.EQ(\\"lb-web-prod\\")"
nstrace: started, filter matches LB vserver "lb-web-prod"

# Capture both sides of each matched flow:
> start nstrace -size 0 -filter "CONNECTION.LB_VSERVER.NAME.EQ(\\"lb-web-prod\\")" -link ENABLED

What it means:
- Filters on the LB vserver name (the front-end VIP container, not
  the back-end services). Find names with "show lb vserver".
- The most common front-end-troubleshooting filter — catches every
  client connection landing on the named VIP.
- "-link ENABLED" follows each client leg to its corresponding
  server leg through the load-balancing decision.` },
  { cmd: 'start nstrace -filter "CONNECTION.CS_VSERVER.NAME.EQ(<name>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic that hits a specific Content Switching virtual server. Methods: EQ, NE, CONTAINS, STARTSWITH, ENDSWITH.',
    example: `> start nstrace -filter "CONNECTION.CS_VSERVER.NAME.EQ(\\"cs-edge-https\\")"
nstrace: started, filter matches CS vserver "cs-edge-https"

What it means:
- For Content-Switching deployments where a CS vserver fronts
  multiple LB vservers. Use CS_VSERVER.NAME to capture before the
  CS-policy decision; use LB_VSERVER.NAME to capture after.` },
  { cmd: 'start nstrace -filter "CONNECTION.INTF.EQ(<x/y>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic on a specific physical / logical interface. Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.INTF.EQ(\\"1/1\\")"
nstrace: started, filter matches interface 1/1

What it means:
- Interface ID syntax is "slot/port" (e.g. 1/1, 0/1, LA/1 for LACP).
- Useful when you need to confirm whether traffic is even arriving
  on a specific NIC — combine with "stat interface" packet counters.` },
  { cmd: 'start nstrace -filter "CONNECTION.SERVICE_TYPE.EQ(<type>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic by service type (HTTP, SSL, TCP, UDP, FTP, etc.). Methods: EQ, NE.',
    example: `> start nstrace -filter "CONNECTION.SERVICE_TYPE.EQ(SSL)"
nstrace: started, filter matches SSL services

# Valid service-type literals:
#  SVC_HTTP | FTP | TCP | UDP | SSL | SSL_BRIDGE | SSL_TCP | NNTP
#  RPCSVR | RPCSVRS | RPCCLNT | SVC_DNS | ADNS | SNMP | RTSP
#  DHCPRA | ANY | MONITOR | MONITOR_UDP | MONITOR_PING | SIP_UDP
#  SVC_MYSQL | SVC_MSSQL | FIX | SSL_FIX | PKTSTEER | SVC_AAA
#  SERVICE_UNKNOWN

What it means:
- Service type is the protocol assigned to each LB/CS vserver and
  service. Filter to a type to catch all conversations of that
  protocol regardless of port (e.g. SSL spans 443, 8443, 9443…).` },
  { cmd: 'start nstrace -filter "CONNECTION.TRAFFIC_DOMAIN_ID.EQ(<id>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Match traffic in a specific Traffic Domain. Methods: EQ, NE, GT, GE, LT, LE, BETWEEN.',
    example: `> start nstrace -filter "CONNECTION.TRAFFIC_DOMAIN_ID.EQ(10)"
nstrace: started, filter matches traffic domain 10

What it means:
- Traffic Domains provide L3 segmentation on a single ADC (overlapping
  IP address spaces between domains).
- TD 0 is the default. Use this filter on multi-tenant ADCs that
  separate tenants by Traffic Domain rather than by VLAN.` },

  // ============== Common-use-case filter templates ==============
  { cmd: 'start nstrace -size 0 -filter "CONNECTION.IP.NE(127.0.0.1) && CONNECTION.IP.EQ(<ipv4>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Capture full-size packets to/from a host while excluding loopback (which would otherwise fill the trace with health-monitor noise).',
    example: `> start nstrace -size 0 -filter "CONNECTION.IP.NE(127.0.0.1) && CONNECTION.IP.EQ(10.102.44.111)"
nstrace: started, full capture for host 10.102.44.111 (loopback excluded)

What it means:
- The 127.0.0.0/8 noise comes from internal monitor probes and
  in-kernel housekeeping — almost always uninteresting and very
  high-volume.
- This idiom keeps the .cap file small and focused on real client
  ↔ server traffic for one host.` },
  { cmd: 'start nstrace -size 0 -filter "CONNECTION.DSTPORT.EQ(443) || CONNECTION.DSTPORT.EQ(80)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Capture all HTTP and HTTPS traffic terminating on the ADC.',
    example: `> start nstrace -size 0 -filter "CONNECTION.DSTPORT.EQ(443) || CONNECTION.DSTPORT.EQ(80)"
nstrace: started, capturing HTTP + HTTPS traffic, full size

What it means:
- Common starting point when "the website is slow" — captures every
  connection landing on standard web ports.
- Pair with -link ENABLED to also pull in the back-end leg of every
  matched front-end flow.` },
  { cmd: 'start nstrace -size 0 -filter "CONNECTION.SVCNAME.EQ(<name>)" -link ENABLED',
    section: 'Diagnostics', type: 'config',
    desc: 'Capture full back-end traffic for a service AND its corresponding client-side traffic on the same trace.',
    example: `> start nstrace -size 0 -filter "CONNECTION.SVCNAME.EQ(\\"svc-web1\\")" -link ENABLED
nstrace: started, capturing svc-web1 with linked client side

What it means:
- -link ENABLED tells nstrace: "for every matched server-side flow,
  also include the client-side flow that produced it" (and vice
  versa).
- Without -link, you only see one half of every conversation, which
  makes diagnosis nearly impossible for back-end-only filters.
- This is THE canonical filter for diagnosing slow back-end services.` },
  { cmd: 'start nstrace -size 0 -filter "CONNECTION.LB_VSERVER.NAME.EQ(<name>)" -link ENABLED',
    section: 'Diagnostics', type: 'config',
    desc: 'Capture all client-side traffic to an LB virtual server plus the corresponding back-end (server-side) traffic.',
    example: `> start nstrace -size 0 -filter "CONNECTION.LB_VSERVER.NAME.EQ(\\"lb-web-prod\\")" -link ENABLED
nstrace: started, capturing both legs of every flow on lb-web-prod

What it means:
- Use this when troubleshooting a single VIP end-to-end.
- The capture includes the SSL handshake, HTTP traffic, and the
  selected back-end server's responses.
- Combine with "-capsslkeys ENABLED" to also export SSL session
  keys so Wireshark can decrypt the flows.` },
  { cmd: 'start nstrace -size 0 -filter "(CONNECTION.SRCIP.EQ(<ipv4>) && CONNECTION.SRCPORT.EQ(<port>)) || CONNECTION.DSTPORT.EQ(<port>)"',
    section: 'Diagnostics', type: 'config',
    desc: 'Combine multiple expressions with parentheses to capture either an exact client tuple OR any traffic to a destination port.',
    example: `> start nstrace -size 0 -filter "(CONNECTION.SRCIP.EQ(10.1.1.1) && CONNECTION.SRCPORT.EQ(80)) || CONNECTION.DSTPORT.EQ(443)"
nstrace: started, complex OR/AND filter

What it means:
- Group sub-expressions in parens; combine groups with || or &&.
- Demonstrates: "(client side specific) OR (any HTTPS)".
- Operator precedence: && binds tighter than || — always parenthesise
  for clarity.` },
  { cmd: 'start nstrace -size 0 -nf 24 -time 3600 -filter <expression>',
    section: 'Diagnostics', type: 'config',
    desc: 'Long-running capture with file rotation — 24 files × 3600 sec each = 24 hours of rolling capture history.',
    example: `> start nstrace -size 0 -nf 24 -time 3600 -filter "CONNECTION.IP.EQ(10.1.1.1)"
nstrace: started, rotating 24 files of 3600s each

What it means:
- -nf 24    : keep at most 24 trace files in the rotation.
- -time 3600: each file covers 3600 sec (1 hour) of capture.
- Total = 24 hr rolling window. New file replaces the oldest.
- Use when chasing an intermittent issue that happens "sometime
  overnight" — leave running, retrieve files after the event.` },
  { cmd: 'start nstrace -perNIC ENABLED -filter <expression>',
    section: 'Diagnostics', type: 'config',
    desc: 'Capture into separate trace files per interface — easier to analyse asymmetric / per-NIC issues. Only valid with default cap format.',
    example: `> start nstrace -perNIC ENABLED -filter "CONNECTION.DSTPORT.EQ(443)"
nstrace: started, per-interface trace files

# Resulting files (one per active NIC):
# /var/nstrace/ns_00001_0_1.cap   ← interface 0/1
# /var/nstrace/ns_00001_1_1.cap   ← interface 1/1
# /var/nstrace/ns_00001_LA_1.cap  ← LACP channel LA/1

What it means:
- Default behaviour interleaves all packets into one file regardless
  of incoming interface — annoying when investigating per-NIC drops.
- -perNIC ENABLED produces one file per interface so each .cap can
  be opened separately in Wireshark.` },
  { cmd: 'start nstrace -size 0 -filter <expression> -link ENABLED -skipLocalSSH ENABLED -capsslkeys ENABLED -capdroppkt ENABLED',
    section: 'Diagnostics', type: 'config',
    desc: 'Recommended "kitchen-sink" capture template: full size, link client and server legs, exclude SSH session noise, export SSL keys for Wireshark decryption, and include dropped packets.',
    example: `> start nstrace -size 0 \\
        -filter "CONNECTION.LB_VSERVER.NAME.EQ(\\"lb-web-prod\\")" \\
        -link ENABLED \\
        -skipLocalSSH ENABLED \\
        -capsslkeys ENABLED \\
        -capdroppkt ENABLED
nstrace: started, full diagnostic capture for lb-web-prod

What it means:
- -size 0           : full packet capture (no truncation).
- -link ENABLED     : also capture the linked back-end / front-end leg.
- -skipLocalSSH ENABLED : exclude your management SSH from the trace
                          (otherwise you capture yourself!).
- -capsslkeys ENABLED   : export the SSL master keys to ns_sslkey.log
                          so Wireshark can decrypt TLS in the trace.
- -capdroppkt ENABLED   : also write packets that the ADC dropped —
                          critical for "which ACL/policy is blocking
                          this traffic?" investigations.
- Combine with -nf / -time for long-running captures.` }
];

// ---------------------- Apply ----------------------
let updated = 0, addedNew = 0, alreadyHadExample = 0;

for (const e of ENTRIES) {
  let found = null, foundSection = null;
  for (const [sec, arr] of Object.entries(NS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; foundSection = sec; break; }
    }
    if (found) break;
  }
  if (found) {
    if (!found.example) {
      found.example = e.example;
      updated++;
    } else {
      alreadyHadExample++;
    }
    if (!found.desc && e.desc) found.desc = e.desc;
  } else {
    NS.sections[e.section] ||= [];
    NS.sections[e.section].push({
      cmd: e.cmd,
      desc: e.desc || '',
      type: e.type || 'config',
      flagged: false,
      example: e.example
    });
    addedNew++;
  }
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Total entries processed:                ${ENTRIES.length}`);
console.log(`Existing commands updated with example: ${updated}`);
console.log(`Existing commands already had example:  ${alreadyHadExample}`);
console.log(`New commands added:                     ${addedNew}`);
