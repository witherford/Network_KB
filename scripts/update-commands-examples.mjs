#!/usr/bin/env node
/**
 * Adds examples to 10 commands per platform section (openssl, wireshark, linux, netscalersdx)
 * and inserts 10 brand-new commands with descriptions + examples.
 *
 * Run once:  node scripts/update-commands-examples.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '../data/commands.json');

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

// ─── Helper ──────────────────────────────────────────────────────────────────
function patchCmd(platform, cmdStr, example) {
  const pv = data.platforms[platform];
  if (!pv) throw new Error(`Unknown platform: ${platform}`);
  for (const sec of Object.values(pv.sections)) {
    const entry = sec.find(c => c.cmd === cmdStr);
    if (entry) {
      if (entry.example && entry.example.trim()) {
        console.warn(`  SKIP (already has example): ${cmdStr}`);
        return false;
      }
      entry.example = example;
      console.log(`  PATCHED: [${platform}] ${cmdStr}`);
      return true;
    }
  }
  throw new Error(`Command not found in ${platform}: ${cmdStr}`);
}

function addCmd(platform, sectionName, entry) {
  const pv = data.platforms[platform];
  if (!pv) throw new Error(`Unknown platform: ${platform}`);
  if (!pv.sections[sectionName]) throw new Error(`Section not found: ${sectionName} in ${platform}`);
  const existing = pv.sections[sectionName].find(c => c.cmd === entry.cmd);
  if (existing) {
    console.warn(`  SKIP (already exists): ${entry.cmd}`);
    return false;
  }
  pv.sections[sectionName].push(entry);
  console.log(`  ADDED: [${platform}/${sectionName}] ${entry.cmd}`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — OpenSSL: 10 commands missing examples
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── OpenSSL patches ──');

patchCmd('openssl', 'openssl x509 -in cert.crt -noout -ext keyUsage',
`$ openssl x509 -in server.crt -noout -ext keyUsage

X509v3 Key Usage: critical
    Digital Signature, Key Encipherment

# "critical" means a client MUST honour this field.
# Digital Signature  → can sign data (TLS auth, code signing)
# Key Encipherment   → can wrap a symmetric key (classic RSA TLS key exchange)
# Missing keyUsage or incorrect bits cause TLS handshake failures on strict clients.`);

patchCmd('openssl', 'openssl x509 -in cert.crt -noout -ext authorityInfoAccess',
`$ openssl x509 -in server.crt -noout -ext authorityInfoAccess

Authority Information Access:
    OCSP - URI:http://ocsp.r3.lencr.org
    CA Issuers - URI:http://r3.i.lencr.org/

# Two sub-fields:
#  OCSP        → URL to check real-time revocation status (RFC 6960).
#                Used by clients that support OCSP stapling / live checks.
#  CA Issuers  → URL to fetch the issuing CA certificate when it is not
#                bundled in the TLS handshake — helps rebuild the chain.`);

patchCmd('openssl', 'openssl x509 -in cert.crt -noout -ext crlDistributionPoints',
`$ openssl x509 -in server.crt -noout -ext crlDistributionPoints

X509v3 CRL Distribution Points:
    Full Name:
      URI:http://crl.r3.lencr.org/r3.crl

# The CRL (Certificate Revocation List) endpoint.
# Clients download this file to check whether the cert has been revoked.
# CRLs can be large; OCSP (see authorityInfoAccess) is the lighter alternative.`);

patchCmd('openssl', 'openssl x509 -in cert.crt -noout -issuer_hash',
`$ openssl x509 -in server.crt -noout -issuer_hash
244b5494

# The 8-character hex hash of the issuer Distinguished Name.
# OpenSSL's c_rehash tool creates symlinks named <hash>.0, <hash>.1 … in a
# CApath directory so that SSL_CTX_load_verify_locations() can locate the
# correct issuing CA by name hash alone — without loading every file.
# Two certs issued by the same CA will share the same issuer_hash.`);

patchCmd('openssl', 'openssl x509 -in cert.crt -noout -subject_hash',
`$ openssl x509 -in ca.crt -noout -subject_hash
244b5494

# The 8-character hex hash of the Subject DN.
# c_rehash uses this to name the symlink: 244b5494.0 → ca.crt
# When a cert's issuer_hash matches a CA's subject_hash, OpenSSL
# can automatically locate and verify the chain without a full bundle file.
# Tip: subject_hash of a CA == issuer_hash of the certs it signed.`);

patchCmd('openssl', 'openssl x509 -in cert.crt -noout -startdate -enddate',
`$ openssl x509 -in server.crt -noout -startdate -enddate
notBefore=Jun  1 00:00:00 2025 GMT
notAfter =Aug 30 23:59:59 2025 GMT

# Quick validity window check — no need to parse the full -text output.
# Pipe through 'date -d' to get human-relative time:
#   openssl x509 -in cert.crt -noout -enddate | cut -d= -f2 | xargs -I{} date -d '{}'
# Automate expiry monitoring in scripts by comparing against \$(date +%s).`);

patchCmd('openssl', 'openssl x509 -in cert.crt -noout -text -certopt no_pubkey,no_sigdump',
`$ openssl x509 -in server.crt -noout -text -certopt no_pubkey,no_sigdump
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            04:b3:9a:2c:f9:82:d1:aa:73:4e:00:00:00:28:31:cc
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: C=US, O=Let's Encrypt, CN=R3
        Validity
            Not Before: Jun  1 00:00:00 2025 GMT
            Not After : Aug 30 23:59:59 2025 GMT
        Subject: CN=example.com
        X509v3 Extensions:
            X509v3 Subject Alternative Name:
                DNS:example.com, DNS:www.example.com
            X509v3 Key Usage: critical
                Digital Signature
            X509v3 Extended Key Usage:
                TLS Web Server Authentication, TLS Web Client Authentication

# -certopt no_pubkey,no_sigdump strips the hundreds of hex lines for the
# public key modulus and the signature — leaving the fields you actually read.`);

patchCmd('openssl', 'openssl pkcs12 -export -out legacy.pfx -inkey private.key -in cert.crt -legacy',
`$ openssl pkcs12 -export -out legacy.pfx -inkey private.key -in cert.crt -legacy
Enter Export Password: ••••••••
Verifying - Enter Export Password: ••••••••

# Creates a PFX bundle encrypted with RC2-40/3DES (legacy PKCS#12 algorithms).
# Required when importing into:
#   - Java keystores with older PKCS12 default algorithms (JDK < 11)
#   - Windows Server 2003 / IIS 6
#   - Some Cisco, F5, and older Citrix appliances
# Without -legacy, OpenSSL 3.x defaults to AES-256/SHA-256 which those
# older platforms cannot decrypt.`);

patchCmd('openssl', 'openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out client-only.crt',
`$ openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out client-only.crt
Enter Import Password: ••••••••
MAC verified OK

$ cat client-only.crt
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
...
-----END CERTIFICATE-----

# -clcerts  → include only the end-entity (leaf) certificate
# -nokeys   → omit the private key (safe to share)
# The output is PEM-encoded and can be sent to a CA or loaded into a browser.`);

patchCmd('openssl', 'openssl pkcs12 -in bundle.pfx -cacerts -nokeys -out ca-chain.crt',
`$ openssl pkcs12 -in bundle.pfx -cacerts -nokeys -out ca-chain.crt
Enter Import Password: ••••••••
MAC verified OK

$ openssl crl2pkcs7 -nocrl -certfile ca-chain.crt | openssl pkcs7 -print_certs -noout
subject=C=US, O=Let's Encrypt, CN=R3
issuer=C=US, O=Internet Security Research Group, CN=ISRG Root X1

# -cacerts  → include only the CA / intermediate certificates (not the leaf)
# -nokeys   → strip the private key
# Useful to extract the chain bundle separately so you can verify it:
#   openssl verify -CAfile ca-chain.crt leaf.crt`);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Wireshark: 10 display filters missing examples
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── Wireshark patches ──');

patchCmd('wireshark', 'tcp.analysis.out_of_order',
`# Apply in display-filter bar: tcp.analysis.out_of_order
Frame 241: 1514 bytes  10.1.0.5 → 10.1.0.1  TCP [TCP Out-Of-Order] seq=8001 ack=1
Frame 245: 1514 bytes  10.1.0.5 → 10.1.0.1  TCP [TCP Out-Of-Order] seq=6487 ack=1

# Wireshark tags a segment "Out-Of-Order" when its sequence number is LOWER
# than the highest already-seen seq on that stream (not a retransmit, but
# arrived after a later segment).
# Common causes:
#   - Asymmetric routing (two paths, different latencies)
#   - Load-balanced flows reaching the capture point in non-seq order
# Occasional OOO is normal.  Sustained OOO points to a path problem.`);

patchCmd('wireshark', 'tcp.analysis.lost_segment',
`# Apply in display-filter bar: tcp.analysis.lost_segment
Frame 108: 66 bytes  10.2.0.1 → 10.2.0.8  TCP [TCP Previous segment not captured]
Frame 112: 66 bytes  10.2.0.8 → 10.2.0.1  TCP [TCP Dup ACK 104#1]

# "Previous segment not captured" means Wireshark detected a gap in sequence
# numbers — the segment before this one was never seen at this capture point.
# Two interpretations:
#   1. The segment was genuinely lost (retransmit will follow)
#   2. The capture was started mid-stream or a packet was dropped by the NIC
# Look for a retransmit (tcp.analysis.retransmission) within 1 RTO (~200ms)
# to distinguish real loss from capture gaps.`);

patchCmd('wireshark', 'tcp.analysis.zero_window',
`# Apply in display-filter bar: tcp.analysis.zero_window
Frame 320: 66 bytes  10.0.0.8 → 10.0.0.1  TCP [TCP ZeroWindow] seq=1 ack=1 Win=0
Frame 321: 66 bytes  10.0.0.1 → 10.0.0.8  TCP [TCP Window Full] seq=1 ack=1
Frame 340: 66 bytes  10.0.0.8 → 10.0.0.1  TCP [TCP ZeroWindowProbe] seq=1 ack=1 Win=0

# ZeroWindow: the RECEIVER has advertised Win=0 — its receive buffer is full.
# The sender must pause until a Window Update arrives.
# Common causes: slow application, GC pause, disk I/O bottleneck on the receiver.
# Check the time between ZeroWindow and the next Window Update to quantify
# the back-pressure delay.  Use tcp.analysis.zero_window_probe to find probes.`);

patchCmd('wireshark', 'tcp.analysis.window_update',
`# Apply in display-filter bar: tcp.analysis.window_update
Frame 341: 66 bytes  10.0.0.8 → 10.0.0.1  TCP [TCP Window Update] seq=1 ack=1 Win=65535

# A pure ACK carrying a LARGER window size than the previous ACK from the
# same direction — the receiver is reopening its buffer.
# Use alongside tcp.analysis.zero_window to measure the stall duration:
#   Time(Window Update) - Time(Zero Window) = receiver stall
# If window updates are frequent, the receiver is oscillating — investigate
# application processing speed or socket buffer sizing (net.core.rmem_max).`);

patchCmd('wireshark', 'tcp.analysis.flags',
`# Apply in display-filter bar: tcp.analysis.flags
# This matches ANY frame carrying a Wireshark TCP analysis annotation, including:
#   [TCP Retransmission]
#   [TCP Fast Retransmission]
#   [TCP Out-Of-Order]
#   [TCP Dup ACK]
#   [TCP ZeroWindow]
#   [TCP Window Full]
#   [TCP Previous segment not captured]
#   [TCP Keep-Alive]
#   [TCP ACKed unseen segment]

Frame 91:  [TCP Dup ACK 88#1]
Frame 94:  [TCP Retransmission]
Frame 108: [TCP ZeroWindow]
Frame 140: [TCP Fast Retransmission]

# Use as a quick triage filter to surface all anomalies in one view.
# Then refine with the specific sub-filters (e.g. tcp.analysis.retransmission)
# to focus on one failure mode at a time.`);

patchCmd('wireshark', 'tcp.window_size_value == 0',
`# Apply in display-filter bar: tcp.window_size_value == 0
Frame 320: 10.0.0.8 → 10.0.0.1  TCP Win=0  [TCP ZeroWindow]
Frame 341: 10.0.0.8 → 10.0.0.1  TCP Win=0  [TCP ZeroWindowProbe]

# Unlike tcp.analysis.zero_window (which is a Wireshark heuristic),
# tcp.window_size_value == 0 checks the RAW advertised window field.
# They usually match, but tcp.window_size_value is more precise when
# Wireshark's sequence tracking is confused by asymmetric capture.
# Note: tcp.window_size (no _value) is the SCALED window; if Window Scaling
# is in use, a raw value of 0 == 0 scaled.`);

patchCmd('wireshark', 'tcp.len > 0',
`# Apply in display-filter bar: tcp.len > 0
# Hides pure ACKs, SYNs, FINs, window probes — shows only data-carrying segments.
Frame 12: 1514 bytes  10.0.0.1 → 10.0.0.5  TCP len=1460 [PSH,ACK]
Frame 15: 1514 bytes  10.0.0.1 → 10.0.0.5  TCP len=1460 [PSH,ACK]
Frame 18:  245 bytes  10.0.0.1 → 10.0.0.5  TCP len=179  [PSH,ACK]

# Useful for:
#   - Measuring actual data throughput (Statistics → IO Graphs while this filter active)
#   - Isolating payloads when debugging application-layer issues
#   - Counting transferred bytes:  tshark -Y 'tcp.len>0' -T fields -e tcp.len | paste -sd+ | bc`);

patchCmd('wireshark', 'tcp.stream eq 0',
`# Apply in display-filter bar: tcp.stream eq 0
# Shows all packets belonging to TCP stream #0 (the first stream in the capture).
# Each unique 4-tuple (src_ip, src_port, dst_ip, dst_port) gets a stream index.

Frame 1:  SYN         10.0.0.5:54321 → 10.0.0.1:80
Frame 2:  SYN,ACK     10.0.0.1:80    → 10.0.0.5:54321
Frame 3:  ACK         10.0.0.5:54321 → 10.0.0.1:80
Frame 4:  HTTP GET /  10.0.0.5:54321 → 10.0.0.1:80
Frame 5:  HTTP 200    10.0.0.1:80    → 10.0.0.5:54321

# Tip: Right-click any TCP packet → Follow → TCP Stream.
# Wireshark sets this filter automatically with the correct stream number.
# Increment to step through streams: tcp.stream eq 1, tcp.stream eq 2 …`);

patchCmd('wireshark', 'udp.port == 53',
`# Apply in display-filter bar: udp.port == 53
# Matches all DNS traffic (both queries and responses) on standard UDP/53.
Frame 5:   10.0.0.5 → 10.0.0.1  DNS Standard query A www.example.com
Frame 6:   10.0.0.1 → 10.0.0.5  DNS Standard query response A 93.184.216.34

# Combine with dns.flags.response == 0 for queries only,
# or dns.flags.response == 1 for responses only.
# Use dns.qry.name contains "evil" to hunt for suspicious domains.
# For DNS-over-TCP (large responses, zone transfers): tcp.port == 53`);

patchCmd('wireshark', 'udp.length > 512',
`# Apply in display-filter bar: udp.length > 512
# Matches UDP datagrams whose length field exceeds 512 bytes.
Frame 88:  10.0.0.1 → 10.0.0.5  UDP len=1420  DNS (EDNS0 ANY response)
Frame 92:  10.0.0.5 → 10.0.0.1  UDP len=980   SSDP

# DNS traditionally limited responses to 512 bytes (RFC 1035).  Large UDP
# DNS responses (>512) use EDNS0 (RFC 6891) — the client signals support
# via an OPT record.  Fragmented large DNS UDP is an amplification risk.
# Beyond DNS: large UDP may indicate NFS, QUIC, gaming traffic, or SSDP/mDNS.
# Verify MTU and PMTUD settings if oversized UDP causes consistent drops.`);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Linux Networking: 10 commands missing examples
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── Linux Networking patches ──');

patchCmd('linux', 'ip -s neigh',
`$ ip -s neigh
10.0.0.1 dev eth0 lladdr 00:1a:2b:3c:4d:5e used 12/5/3 probes 0 REACHABLE
10.0.0.254 dev eth0 lladdr aa:bb:cc:dd:ee:ff used 120/60/10 probes 1 STALE
fe80::1 dev eth0 lladdr 00:1a:2b:3c:4d:5e used 5/2/1 probes 0 REACHABLE

# -s adds usage statistics: used <last-used-sec>/<last-confirmed-sec>/<last-updated-sec>
# REACHABLE → ARP recently confirmed; STALE → entry aged out, will probe on next send
# FAILED   → probe unanswered; NOARP → static/loopback; PERMANENT → manually set`);

patchCmd('linux', 'tc class show',
`$ tc class show dev eth0
class htb 1:1 root rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b
class htb 1:10 parent 1:1 prio 1 rate 500Mbit ceil 1Gbit burst 1563b cburst 1563b
class htb 1:20 parent 1:1 prio 2 rate 200Mbit ceil 1Gbit burst 1563b cburst 1563b

# Shows HTB (Hierarchical Token Bucket) classes for traffic shaping.
# rate  = guaranteed bandwidth  |  ceil = maximum burst bandwidth
# prio  = scheduling priority within the parent class
# Use 'tc -s class show dev eth0' to include byte/packet counters.`);

patchCmd('linux', 'tc filter show',
`$ tc filter show dev eth0
filter parent 1: protocol ip pref 10 u32 chain 0
filter parent 1: protocol ip pref 10 u32 chain 0 fh 800: ht divisor 1
filter parent 1: protocol ip pref 10 u32 chain 0 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1:10
  match c0a80a00/ffffff00 at 16    # dst 192.168.10.0/24 → class 1:10 (VoIP)

# Shows tc classifiers that steer packets to specific qdisc classes.
# u32 filters match on bit fields in the packet header (here: dst subnet).
# flowid 1:10 directs matched packets to HTB class 1:10.`);

patchCmd('linux', 'iptables -L -n -v',
`$ iptables -L -n -v
Chain INPUT (policy DROP 42 packets, 3192 bytes)
 pkts bytes target     prot opt in     out     source          destination
 1428  112K ACCEPT     all  --  lo     *       0.0.0.0/0       0.0.0.0/0
  892 71680 ACCEPT     tcp  --  eth0   *       0.0.0.0/0       0.0.0.0/0   tcp dpt:22
  340 27200 ACCEPT     tcp  --  eth0   *       0.0.0.0/0       0.0.0.0/0   tcp dpt:443
  126 10080 DROP       tcp  --  *      *       10.5.0.0/24     0.0.0.0/0

Chain FORWARD (policy DROP 0 packets, 0 bytes)
Chain OUTPUT (policy ACCEPT 4201 packets, 312K bytes)

# -n suppresses DNS lookups (faster); -v adds packet/byte counters and interface
# pkts/bytes counters reset on reboot; use 'iptables -Z' to zero them manually.`);

patchCmd('linux', 'ip6tables -L -n -v',
`$ ip6tables -L -n -v
Chain INPUT (policy DROP 0 packets, 0 bytes)
 pkts bytes target  prot opt in   out  source     destination
    5   400 ACCEPT  all      lo   *    ::/0       ::/0
   12  1024 ACCEPT  tcp      eth0 *    ::/0       ::/0   tcp dpt:443
    8   640 ACCEPT  ipv6-icmp eth0 *   ::/0       ::/0

Chain FORWARD (policy DROP)
Chain OUTPUT (policy ACCEPT 234 packets, 18432 bytes)

# Same flags as iptables but for IPv6.  Note 'ipv6-icmp' is the protocol
# name for ICMPv6 (NDP, Router Advertisements, etc.) — allow it or IPv6 breaks.`);

patchCmd('linux', 'nft list ruleset',
`$ nft list ruleset
table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;
        iif lo accept
        ct state established,related accept
        tcp dport 22 accept
        tcp dport { 80, 443 } accept
        ip protocol icmp accept
        counter drop
    }
    chain forward {
        type filter hook forward priority 0; policy drop;
    }
    chain output {
        type filter hook output priority 0; policy accept;
    }
}

# nftables replaces iptables/ip6tables/arptables/ebtables in one unified tool.
# 'inet' tables match both IPv4 and IPv6.  Use 'nft -j list ruleset' for JSON.`);

patchCmd('linux', 'nmcli device status',
`$ nmcli device status
DEVICE   TYPE      STATE         CONNECTION
eth0     ethernet  connected     office-wired
wlan0    wifi      connected     CorpWiFi-5GHz
docker0  bridge    unmanaged     --
lo       loopback  unmanaged     --

# STATE values: connected / disconnected / unmanaged / unavailable / connecting
# CONNECTION column shows the active profile name; '--' means no profile active.
# Use 'nmcli device show <iface>' for full IP/DNS/gateway detail.`);

patchCmd('linux', 'nmcli connection show',
`$ nmcli connection show
NAME               UUID                                  TYPE      DEVICE
office-wired       a1b2c3d4-1111-2222-3333-444455556666  ethernet  eth0
CorpWiFi-5GHz      b2c3d4e5-aaaa-bbbb-cccc-ddddeeeeffff  wifi      wlan0
VPN-HQ             c3d4e5f6-0000-1111-2222-333344445555  vpn       --

# Lists all saved NetworkManager connection profiles.
# DEVICE column shows which interface is currently using the profile.
# '--' in DEVICE means the profile exists but is not currently active.
# Use 'nmcli con show <name>' for full key-value details of a profile.`);

patchCmd('linux', 'nmcli connection up <name>',
`$ nmcli connection up office-wired
Connection successfully activated (D-Bus active path: /org/freedesktop/NetworkManager/ActiveConnection/3)

$ nmcli device status
DEVICE  TYPE      STATE      CONNECTION
eth0    ethernet  connected  office-wired

# Activates a saved connection profile on its associated device.
# Useful after a 'nmcli con down' or to switch a Wi-Fi interface between profiles.
# For VPNs: nmcli con up VPN-HQ  (requires pre-configured credentials in the profile).`);

patchCmd('linux', 'dhclient <iface>',
`$ dhclient eth0
$ ip a show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.1.105/24 brd 192.168.1.255 scope global dynamic eth0
       valid_lft 86350sec preferred_lft 86350sec

# Requests a new DHCP lease on eth0.  Use when the interface was configured
# statically but you want to switch to DHCP, or after 'dhclient -r'.
# -v flag shows DISCOVER/OFFER/REQUEST/ACK dialogue verbosely.
# For systemd-based distros, prefer 'networkctl renew eth0' or nmcli.`);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — NetScaler SDX System: 10 commands missing examples
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── NetScaler SDX patches ──');

patchCmd('netscalersdx', 'show system backup',
`> show system backup

Backup Name              Date                   Size      Type
------------------------ ---------------------- --------- -------
backup-2026-06-17.tgz    06/17/2026 02:00:01    142 MB    Full
backup-2026-06-10.tgz    06/10/2026 02:00:03    140 MB    Full
backup-2026-06-03.tgz    06/03/2026 02:00:02    138 MB    Full

# Lists all system-level backups stored on the SDX.
# Each backup includes the SDX management configuration, VPX provisioning
# data, and the ns.conf for each hosted VPX instance.
# Tip: restore with 'restore system backup <name>'.`);

patchCmd('netscalersdx', 'show system backup <name>',
`> show system backup backup-2026-06-17.tgz

Name:        backup-2026-06-17.tgz
Date:        06/17/2026 02:00:01
Size:        142 MB
Type:        Full
Description: Scheduled nightly backup
Location:    /var/nsinstall/backup/backup-2026-06-17.tgz

# Detailed metadata for a specific backup archive.
# Verify the Date and Size before restoring to ensure it is a recent
# and complete backup — partial backups may appear in the list if
# a backup job was interrupted.`);

patchCmd('netscalersdx', 'show system user',
`> show system user

Username   Type          Last Login               Status
---------- ------------- ------------------------ --------
nsroot     Administrator 06/19/2026 08:41:12      Enabled
admin-soc  Operator      06/18/2026 14:22:05      Enabled
readonly1  ReadOnly      06/15/2026 10:00:33      Enabled

# Lists all local SDX management user accounts.
# Type: Administrator (full access) / Operator / ReadOnly
# Use to audit who has access before a maintenance window.`);

patchCmd('netscalersdx', 'show system user <username>',
`> show system user admin-soc

Username:     admin-soc
Type:         Operator
Email:        soc-team@example.com
Last Login:   06/18/2026 14:22:05
Login IP:     10.10.10.45
Status:       Enabled
Session Timeout: 30 minutes

# Detailed view of a specific user.  Login IP shows the last source address
# which is useful for auditing unexpected remote access.
# Change password: set system user <name> -password <new> -confirmPassword <new>`);

patchCmd('netscalersdx', 'show system config',
`> show system config

Hostname:             sdx-dc-01
System IP Address:    10.10.10.100
Netmask:              255.255.255.0
Default Gateway:      10.10.10.1
DNS Primary:          8.8.8.8
DNS Secondary:        8.8.4.4
NTP Server:           pool.ntp.org
Timezone:             GMT+0:00
SNMP Manager:         10.10.1.50
Syslog Server:        10.10.1.60:514
LACP:                 Enabled
Management VLAN:      10

# Full SDX chassis management configuration.  Useful as a baseline snapshot
# before changes and for comparing against a known-good config backup.`);

patchCmd('netscalersdx', 'show system storage',
`> show system storage

Volume     Total    Used     Free     Use%   Mount
---------- -------- -------- -------- ------ ----------
/          50 GB    18 GB    32 GB    36%    /
/var       200 GB   87 GB    113 GB   43%    /var
/flash     8 GB     1.2 GB   6.8 GB   15%    /flash
/var/nsinstall 150 GB 60 GB  90 GB    40%    /var/nsinstall

# /var/nsinstall holds VPX images, backups, and upgrade packages — monitor
# this volume; it fills when many VPX images or old backups accumulate.
# Clean old backups with 'rm system backup <name>' when disk > 70%.`);

patchCmd('netscalersdx', 'show system alarms',
`> show system alarms

Alarm ID  Severity  Message                                       Date
--------- --------- --------------------------------------------- --------------------
1042      Critical  VPX-03 CPU > 90% for 5 minutes                06/19/2026 07:14:33
1041      Major     Interface 10/2 Link Down                       06/19/2026 06:50:01
1038      Minor     Disk utilization > 75%                         06/17/2026 11:22:10

# Lists all active alarms on the SDX chassis.
# Severity: Critical / Major / Minor / Warning
# Critical alarms should be investigated immediately; they often indicate
# a VPX crash, link failure, or hardware fault.`);

patchCmd('netscalersdx', 'show system alarms -detail',
`> show system alarms -detail

=== Alarm ID: 1042 ===
Severity:    Critical
Category:    VPX Resource
Description: VPX-03 CPU utilization has exceeded 90% for more than 5 minutes.
             Current CPU: 93%  |  Threshold: 90%
First Seen:  06/19/2026 07:14:33
Last Updated:06/19/2026 07:45:01
Duration:    30 minutes
Recommendation: Log into VPX-03 and run 'show system' to identify the
                consuming process.  Consider increasing vCPU allocation
                under VPX → Edit → Resources if load is sustained.

=== Alarm ID: 1041 ===
Severity:    Major
Category:    Network
Description: Interface 10/2 physical link is down.
             ...`);

patchCmd('netscalersdx', 'show system processes -detail',
`> show system processes -detail

PID   Name                  CPU%   MEM%   State    Since
----- --------------------- ------ ------ -------- --------------------
1     init                  0.0    0.1    Sleeping  06/01/2026 00:00:01
312   sdxd                  1.4    3.2    Running   06/01/2026 00:01:45
415   vpxd                  0.8    2.1    Running   06/01/2026 00:01:50
521   xenconsoled           0.0    0.4    Sleeping  06/01/2026 00:01:55
1024  sshd                  0.0    0.2    Sleeping  06/01/2026 00:02:00
4421  ns (VPX-01)           4.2    8.7    Running   06/01/2026 00:05:12
4890  ns (VPX-02)           2.1    7.9    Running   06/01/2026 00:05:18

# sdxd is the SDX management daemon; vpxd manages VPX lifecycle.
# High CPU on an ns (VPX) process indicates traffic load on that VPX instance.
# Compare against 'show vpx' to map PID to VPX instance name.`);

patchCmd('netscalersdx', 'show system services',
`> show system services

Service Name          Status    PID    Restarts  Since
--------------------- --------- ------ --------- --------------------
sdxd                  Running   312    0         06/01/2026 00:01:45
vpxd                  Running   415    0         06/01/2026 00:01:50
sshd                  Running   1024   0         06/01/2026 00:02:00
httpd (management UI) Running   2048   0         06/01/2026 00:02:05
ntpd                  Running   2200   0         06/01/2026 00:02:10
syslogd               Running   2350   0         06/01/2026 00:02:15

# All SDX management services and their operational status.
# Restarts counter > 0 may indicate a crashing service; investigate logs
# in /var/log/ for the affected service if restarts are non-zero.`);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — 10 NEW COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── New commands ──');

// 1. Linux Diagnostics: journalctl follow for a service
addCmd('linux', 'Diagnostics', {
  cmd: 'journalctl -u <service> -f --since "1 hour ago"',
  desc: '# follow live log output for a service, showing only the last hour',
  type: 'show',
  flagged: false,
  example: `$ journalctl -u nginx -f --since "1 hour ago"
Jun 19 09:10:01 web01 nginx[1245]: 10.0.0.5 - - [19/Jun/2026:09:10:01] "GET /api/health HTTP/1.1" 200 12
Jun 19 09:10:14 web01 nginx[1245]: 10.0.0.5 - - [19/Jun/2026:09:10:14] "POST /api/login HTTP/1.1" 401 38
Jun 19 09:10:22 web01 nginx[1245]: 2026/06/19 09:10:22 [warn] 1245#1245: *42 upstream response timeout
Jun 19 09:10:22 web01 nginx[1245]: 10.0.0.5 - - [19/Jun/2026:09:10:22] "GET /api/data HTTP/1.1" 502 162
^C

# -u <service>            → filter to one systemd unit
# -f                      → follow (like tail -f)
# --since "1 hour ago"    → start output 1 hour back, then follow forward
# Ctrl-C to stop following.  Omit --since to follow from the current tail only.`
});

// 2. OpenSSL: verify cert against CA chain
addCmd('openssl', 'Certificate Inspection', {
  cmd: 'openssl verify -CAfile ca-chain.crt cert.crt',
  desc: 'Verify a certificate against a local CA chain file',
  type: 'show',
  flagged: false,
  example: `$ openssl verify -CAfile ca-chain.crt server.crt
server.crt: OK

# If the chain is incomplete or the cert is revoked / expired:
$ openssl verify -CAfile ca-chain.crt expired.crt
error 10 at 0 depth lookup: certificate has expired

# Depth 0 = the leaf cert; depth 1 = intermediate CA; depth 2 = root CA.
# Use -partial_chain to allow verification against an intermediate CA
# without requiring the root in the CAfile.
# Combine with -crl_check -CRLfile crl.pem to verify against a local CRL.`
});

// 3. Wireshark Analysis: frame time delta filter
addCmd('wireshark', 'Analysis & Statistics', {
  cmd: 'frame.time_delta > 1',
  desc: 'Frames with more than 1 second gap since the previous frame — useful to find idle periods or application pauses',
  type: 'show',
  flagged: false,
  example: `# Apply in display-filter bar: frame.time_delta > 1
Frame 201: time_delta=2.341s  10.0.0.5 → 10.0.0.1  TCP [ACK]  # 2.3s gap — likely a server think-time
Frame 348: time_delta=1.005s  10.0.0.1 → 10.0.0.5  HTTP 200 OK

# frame.time_delta is the elapsed time from the PREVIOUS frame in the capture.
# Use it to find:
#   - Long server think-times (gap between client request and server response)
#   - Application-level pauses (GC, DB query, lock wait)
#   - Idle keepalive gaps
# Combine: frame.time_delta > 0.5 && tcp.stream eq 5  (pauses in a specific flow)`
});

// 4. Linux Networking: tcpdump capture to file
addCmd('linux', 'Networking', {
  cmd: 'tcpdump -i eth0 -nn -w /tmp/cap.pcap -c 1000',
  desc: '# capture 1000 packets on eth0 to a pcap file (no DNS/port name resolution)',
  type: 'show',
  flagged: false,
  example: `$ tcpdump -i eth0 -nn -w /tmp/cap.pcap -c 1000
tcpdump: listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
1000 packets captured
1000 packets received by filter
0 packets dropped by kernel

# Open the resulting file in Wireshark or replay with tcpdump:
#   tcpdump -r /tmp/cap.pcap -nn
# Add a BPF capture filter to narrow scope:
#   tcpdump -i eth0 -nn -w /tmp/cap.pcap 'host 10.0.0.5 and port 443'
# -nn  → no DNS/service name resolution (faster, avoids DNS noise in capture)
# -c   → stop after N packets; omit to capture until Ctrl-C`
});

// 5. Linux Diagnostics: nmap service scan
addCmd('linux', 'Diagnostics', {
  cmd: 'nmap -sV --open -p 22,80,443 <host>',
  desc: '# probe specific ports on a host and identify running services + versions',
  type: 'show',
  flagged: false,
  example: `$ nmap -sV --open -p 22,80,443 10.0.0.5
Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for 10.0.0.5
Host is up (0.0023s latency).

PORT    STATE SERVICE VERSION
22/tcp  open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.4 (Ubuntu Linux; protocol 2.0)
80/tcp  open  http    nginx 1.24.0
443/tcp open  ssl/https nginx 1.24.0

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.43 seconds

# -sV      → probe open ports to determine service/version
# --open   → show only open ports (suppress filtered/closed)
# -p       → comma-separated port list  (use -p- for all 65535 ports)`
});

// 6. OpenSSL: TLS 1.3 connection with OCSP status
addCmd('openssl', 'TLS Client Testing', {
  cmd: 'openssl s_client -connect host:443 -tls1_3 -status',
  desc: 'Connect using TLS 1.3 only and request OCSP staple from the server',
  type: 'show',
  flagged: false,
  example: `$ openssl s_client -connect example.com:443 -tls1_3 -status -servername example.com
CONNECTED(00000003)
OCSP response:
======================================
OCSP Response Status: successful (0x0)
Response Type: Basic OCSP Response
Cert Status: Good
This Update: Jun 19 00:00:00 2026 GMT
Next Update: Jun 26 00:00:00 2026 GMT
======================================
depth=2 C=US, O=ISRG, CN=ISRG Root X1
depth=1 C=US, O=Let's Encrypt, CN=R3
depth=0 CN=example.com
...
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: A3B2...

# -tls1_3  → forces TLS 1.3 only; server falls back to alert if not supported
# -status  → sends a Certificate Status Request extension; server returns OCSP staple
# A "Cert Status: Good" OCSP staple proves the cert is not revoked, eliminating
# a separate OCSP round-trip for the client.`
});

// 7. NetScaler SDX Advanced Debug: show system debug
addCmd('netscalersdx', 'Advanced Debug', {
  cmd: 'show system debug',
  desc: 'Displays current SDX debug flags and diagnostic settings',
  type: 'show',
  flagged: false,
  example: `> show system debug

Debug Mode:           Disabled
Log Level:            Info
Core Dump:            Disabled
Packet Trace:         Disabled
Debug Log Path:       /var/log/sdxd.log
Max Log Size:         50 MB
Log Rotation:         10 files

# Default output confirms debug mode is off (normal production state).
# Enable debug mode only during active troubleshooting with Citrix/NetApp TAC:
#   set system debug -debugMode ENABLED -logLevel DEBUG
# Disable after TAC session to avoid performance impact and log flooding.
# Core dumps, if enabled, are written to /var/nscore/ and can be large.`
});

// 8. Wireshark Capture Filters: compound filter
addCmd('wireshark', 'Capture Filters', {
  cmd: 'tcp port 443 and not host 10.0.0.1',
  desc: 'Capture TLS traffic on port 443 but exclude a specific host — useful to remove monitoring/scanner noise',
  type: 'show',
  flagged: false,
  example: `# Start capture in Wireshark: Capture → Options → enter filter in Capture filter box
# Or via tshark:
#   tshark -i eth0 -f 'tcp port 443 and not host 10.0.0.1' -w /tmp/tls.pcap

# BPF syntax notes:
#   and / or / not   → boolean operators
#   host <ip>        → matches src OR dst
#   src host <ip>    → source only
#   dst host <ip>    → destination only
#   port <n>         → src OR dst port
#   tcp / udp        → protocol qualifier

# Common extensions of this pattern:
#   'tcp port 443 and (host 10.0.0.5 or host 10.0.0.6)' → two specific hosts
#   'tcp port 443 and net 192.168.0.0/16'                → entire subnet
#   'tcp port 443 and not net 10.0.0.0/8'                → exclude RFC 1918`
});

// 9. Linux Diagnostics: iperf3 client bandwidth test
addCmd('linux', 'Diagnostics', {
  cmd: 'iperf3 -c <host> -t 10 -P 4',
  desc: '# run a 10-second bandwidth test to an iperf3 server using 4 parallel streams',
  type: 'show',
  flagged: false,
  example: `# Server side (run first):
$ iperf3 -s
-----------------------------------------------------------
Server listening on 5201

# Client side:
$ iperf3 -c 10.0.0.10 -t 10 -P 4
Connecting to host 10.0.0.10, port 5201
[ ID] Interval         Transfer     Bitrate         Retr
[  4] 0.00-10.00 sec  1.12 GBytes   962 Mbits/sec    0  sender
[  6] 0.00-10.00 sec  1.09 GBytes   935 Mbits/sec    0  sender
[  8] 0.00-10.00 sec  1.10 GBytes   945 Mbits/sec    0  sender
[ 10] 0.00-10.00 sec  1.11 GBytes   953 Mbits/sec    0  sender
[SUM] 0.00-10.00 sec  4.42 GBytes  3795 Mbits/sec    0  sender

# -c <host>  → target iperf3 server
# -t 10      → test duration in seconds
# -P 4       → number of parallel TCP streams (simulates multi-threaded apps)
# Retr = TCP retransmit count; non-zero indicates congestion or packet loss`
});

// 10. Linux Networking: ip route show table all
addCmd('linux', 'Networking', {
  cmd: 'ip route show table all',
  desc: '# display routes from all routing tables (main, local, policy routes)',
  type: 'show',
  flagged: false,
  example: `$ ip route show table all
default via 10.0.0.1 dev eth0 proto dhcp metric 100
10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5

# Policy routing tables (visible only with 'table all'):
broadcast 10.0.0.0 dev eth0 table local proto kernel scope link src 10.0.0.5
local 10.0.0.5 dev eth0 table local proto kernel scope host src 10.0.0.5
broadcast 10.0.0.255 dev eth0 table local proto kernel scope link src 10.0.0.5

# Tables:
#   main  (table 254) → normal routes (default)
#   local (table 255) → kernel-managed local/broadcast routes
#   <N>               → custom policy-routing tables (see /etc/iproute2/rt_tables)
# Use with 'ip rule show' to see policy-routing rules that direct traffic
# to specific tables based on source IP, fwmark, or incoming interface.`
});

// ═══════════════════════════════════════════════════════════════════════════════
// Write out
// ═══════════════════════════════════════════════════════════════════════════════
data.updatedAt = new Date().toISOString();
writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
console.log('\nDone — wrote', DATA_PATH);
