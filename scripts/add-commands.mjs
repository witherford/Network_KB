#!/usr/bin/env node
/**
 * Enrichment script: add examples to existing commands that lack them,
 * and inject 10 brand-new commands from official vendor documentation.
 *
 * Usage: node scripts/add-commands.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const PATH = 'data/commands.json';
const data = JSON.parse(readFileSync(PATH, 'utf8'));

let updated = 0;
let added = 0;

// ── helpers ────────────────────────────────────────────────────────────────

function patchCmd(platformKey, cmdStr, example) {
  const platform = data.platforms[platformKey];
  if (!platform) { console.warn('Platform not found: ' + platformKey); return; }
  for (const cmds of Object.values(platform.sections)) {
    for (const c of cmds) {
      if (c.cmd === cmdStr && !c.example) {
        c.example = example;
        updated++;
        return;
      }
    }
  }
  console.warn('Command not found (or already has example): [' + platformKey + '] ' + cmdStr);
}

function injectCmd(platformKey, sectionKey, cmdObj) {
  const section = data.platforms[platformKey]?.sections[sectionKey];
  if (!section) { console.warn('Section not found: ' + platformKey + ' › ' + sectionKey); return; }
  const exists = section.some(c => c.cmd === cmdObj.cmd);
  if (exists) { console.warn('Already exists: ' + cmdObj.cmd); return; }
  section.push(cmdObj);
  added++;
}

// ══════════════════════════════════════════════════════════════════════════
// 1. OPENSSL — add examples to 10 commands
// ══════════════════════════════════════════════════════════════════════════

patchCmd('openssl', 'openssl ecparam -name secp384r1 -genkey -noout -out ec.key',
`(ECC P-384 private key written to ec.key — no console output on success)
# Verify the key was created correctly:
openssl ec -in ec.key -text -noout | head -6
read EC key
Private-Key: (384 bit)
priv:
    00:a1:2b:3c:4d:5e:6f:7a:8b:9c:0d:1e:2f:3a:...
pub:
    04:b5:c6:d7:...`);

patchCmd('openssl', 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key',
`Generating RSA private key, 3072 bit long modulus
..............................................+++++
.......................................+++++
e is 65537 (0x010001)

# Verify: openssl rsa -in rsa3072.key -text -noout | head -3
RSA Private-Key: (3072 bit, 2 primes)`);

patchCmd('openssl', 'openssl genpkey -algorithm X25519 -out x25519.key',
`(X25519 private key written to x25519.key — no output on success)
# Verify:
openssl pkey -in x25519.key -text -noout
X25519 Private-Key:
priv:
    78:e3:41:2b:9c:5d:0f:a3:44:e7:82:bf:1c:60:d5:
    3a:91:46:fe:2d:c8:77:b4:0e:59:3f:1a:2b:7c:e8:
    8d:6a`);

patchCmd('openssl', 'openssl rand -hex 16',
`b9e3f42d8c1a5e7f0d234a6b89c07f51
# Each run produces a different 32-char hex string (16 random bytes).
# For a 32-byte key: openssl rand -hex 32
# For base64 output: openssl rand -base64 16`);

patchCmd('openssl', 'openssl rsa -in <key> -check',
`> openssl rsa -in private.key -check
RSA key ok
# If the key file is corrupted:
RSA key error: n does not equal p * q
# Use this before deploying a key to ensure it is mathematically consistent.`);

patchCmd('openssl', 'openssl rsa -in <key> -pubout -out <pubkey>',
`> openssl rsa -in private.key -pubout -out public.key
writing RSA key
# Output public.key in PEM format (-----BEGIN PUBLIC KEY-----)
# Verify extracted public key:
openssl rsa -pubin -in public.key -text -noout | head -4
RSA Public-Key: (2048 bit)
Modulus:
    00:c4:e5:f6:...`);

patchCmd('openssl', 'openssl x509 -in <cert> -text -noout',
`> openssl x509 -in cert.crt -text -noout
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number: 04:ab:cd:ef:01:23:45:67
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: C=GB, O=Example CA Ltd, CN=Example TLS Issuing CA
        Validity
            Not Before: Jan  1 00:00:00 2024 GMT
            Not After : Jan  1 00:00:00 2025 GMT
        Subject: CN=www.example.com, O=Example Ltd, C=GB
        X509v3 Subject Alternative Name:
            DNS:www.example.com, DNS:example.com
        X509v3 Key Usage: Digital Signature, Key Encipherment
        X509v3 Extended Key Usage: TLS Web Server Authentication`);

patchCmd('openssl', 'openssl x509 -in <cert> -dates -noout',
`> openssl x509 -in cert.crt -dates -noout
notBefore=Jan  1 00:00:00 2024 GMT
notAfter =Jan  1 00:00:00 2025 GMT
# Quick way to check if a certificate is still within its validity window.
# For a live server: openssl s_client -connect host:443 2>/dev/null </dev/null | openssl x509 -noout -dates`);

patchCmd('openssl', 'openssl s_client -connect <host:443>',
`> openssl s_client -connect example.com:443
CONNECTED(00000003)
depth=2 C=US, O=DigiCert Inc, CN=DigiCert Global Root CA
depth=1 C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1
depth=0 CN=example.com
verify return:1
---
Certificate chain
 0 s:CN=example.com
   i:C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1
---
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_128_GCM_SHA256
    Timeout   : 7200 (sec)
    Verify return code: 0 (ok)
---`);

patchCmd('openssl', 'openssl s_client -connect <host:443> -servername <sni>',
`> openssl s_client -connect 10.1.1.100:443 -servername www.example.com
# -servername sets the TLS SNI extension — required when one IP hosts
# multiple virtual sites (each with its own certificate).
CONNECTED(00000003)
depth=1 CN=Example CA
depth=0 CN=www.example.com
---
Certificate presented for: www.example.com
Protocol : TLSv1.3
Cipher   : TLS_AES_256_GCM_SHA384
Verify return code: 0 (ok)`);

// ══════════════════════════════════════════════════════════════════════════
// 2. WIRESHARK — add examples to 10 filters (one per major section)
// ══════════════════════════════════════════════════════════════════════════

patchCmd('wireshark', 'frame.len > 1500',
`# Matches any frame larger than the standard Ethernet MTU of 1500 bytes.
# Use to detect jumbo frames (MTU 9000), GRE/VXLAN overhead inflating
# frame size, or IP fragmentation above expected thresholds.
Frame 312: 1514 bytes  10.0.0.1 → 10.0.0.2  TCP [PSH,ACK]  (just over MTU)
Frame 318: 2960 bytes  10.0.0.1 → 10.0.0.2  TCP [PSH,ACK]  (jumbo)
Frame 401: 9014 bytes  10.0.0.1 → 10.0.0.2  TCP [PSH,ACK]  (9K jumbo)`);

patchCmd('wireshark', 'tcp.port == 443',
`# Matches all TCP segments where source OR destination port is 443.
# Equivalent to: tcp.srcport == 443 or tcp.dstport == 443
Frame 5:  192.168.1.5   → 93.184.216.34  TCP  54321 → 443 [SYN]
Frame 6:  93.184.216.34 → 192.168.1.5    TCP  443 → 54321 [SYN,ACK]
Frame 7:  192.168.1.5   → 93.184.216.34  TLSv1.3  ClientHello
Frame 8:  93.184.216.34 → 192.168.1.5    TLSv1.3  ServerHello, Certificate`);

patchCmd('wireshark', 'tcp.flags.syn == 1 and tcp.flags.ack == 0',
`# Captures only the first SYN of a TCP three-way handshake (not SYN-ACK).
# Use to count connection attempts, detect port scans (high rate of SYNs
# to multiple ports), or measure new-connection setup rate.
Frame 1:  10.0.0.5 → 10.0.0.1   TCP  52345 → 80  [SYN] Seq=0 Win=64240
Frame 3:  10.0.0.5 → 10.0.0.1   TCP  52346 → 443 [SYN] Seq=0 Win=64240
Frame 9:  10.0.0.5 → 10.0.0.1   TCP  52347 → 22  [SYN] Seq=0 Win=64240`);

patchCmd('wireshark', 'tcp.flags.reset == 1',
`# Shows all TCP segments with the RST flag set.
# RST on a SYN → port is closed or the host is actively rejecting connections.
# RST on an established connection → abnormal teardown (app crash, firewall).
Frame 25:  10.0.0.1 → 10.0.0.5   TCP  80 → 52345 [RST,ACK]  # port closed
Frame 88:  10.0.0.5 → 10.0.0.1   TCP  52345 → 80 [RST]       # app abort
# High RST rate → firewall block, misconfigured server, or SYN flood.`);

patchCmd('wireshark', 'tcp.analysis.retransmission',
`# Wireshark expert-analysis flag set when a segment is retransmitted
# because no ACK was received within the retransmission timeout (RTO).
# High count indicates packet loss or severe congestion on the path.
Frame 102:  10.0.0.1 → 10.0.0.5  [TCP Retransmission] 80 → 52345 Seq=1451 Len=1460
Frame 118:  10.0.0.1 → 10.0.0.5  [TCP Retransmission] 80 → 52345 Seq=1451 Len=1460
# Also see: tcp.analysis.fast_retransmission (triple-dup-ACK recovery)`);

patchCmd('wireshark', 'tls.handshake.type == 1',
`# Matches TLS ClientHello messages — the very first TLS handshake record.
# Expand TLS → Handshake Protocol in the packet details pane to inspect:
#   • SNI extension (server name the client is connecting to)
#   • Supported cipher suites offered by client
#   • Supported TLS versions (TLS 1.2, TLS 1.3)
Frame 15:  192.168.1.5 → 93.184.216.34  TLSv1.3  ClientHello  SNI=example.com
Frame 29:  192.168.1.5 → 10.0.0.1       TLSv1.3  ClientHello  SNI=intranet.corp`);

patchCmd('wireshark', 'dns.flags.response == 1',
`# Shows only DNS response messages (QR bit = 1).
# Pair with dns.flags.rcode != 0 to isolate failed lookups.
Frame 44:  8.8.8.8 → 192.168.1.5   DNS  Standard query response  A 93.184.216.34
Frame 47:  8.8.8.8 → 192.168.1.5   DNS  Standard query response  NXDOMAIN
Frame 51:  8.8.8.8 → 192.168.1.5   DNS  Standard query response  SERVFAIL
# Filter DNS errors:  dns.flags.response == 1 and dns.flags.rcode != 0`);

patchCmd('wireshark', 'arp.opcode == 1',
`# Captures only ARP Who-Has requests (opcode 1).
# Useful for detecting gratuitous ARPs, IP conflicts, or ARP scanning.
Frame 1:  Broadcast  ARP  Who has 192.168.1.1?    Tell 192.168.1.5
Frame 8:  Broadcast  ARP  Who has 192.168.1.254?  Tell 192.168.1.10
# Detect ARP scans: many ARP requests in short time from a single source.
# Pair with arp.opcode == 2 to see corresponding Is-At replies.`);

patchCmd('wireshark', 'ospf',
`# Matches all OSPF packets: Hello, DBD (Database Description),
# LSR (Link State Request), LSU (Link State Update), LSAck.
Frame 3:  10.0.0.1 → 224.0.0.5  OSPF  Hello  RID=1.1.1.1  Area=0.0.0.0
Frame 7:  10.0.0.1 → 10.0.0.2   OSPF  DB Description  MTU=1500
Frame 11: 10.0.0.1 → 10.0.0.2   OSPF  LS Update  Router LSA
# Drill down:  ospf.msg == 1  (Hello only)
#              ospf.msg == 4  (LSU only — contains actual topology data)`);

patchCmd('wireshark', 'host <ip>',
`# Capture-filter syntax (set before capture starts — not a display filter).
# Captures all packets where source OR destination matches <ip>.
# Example: host 192.168.1.100
# Use in the Capture Options → Capture filter field, or on the CLI:
tshark -i eth0 -f "host 192.168.1.100"
# Opposite (exclude a host): not host 192.168.1.100
# Both directions to/from two hosts: host 10.0.0.1 and host 10.0.0.2`);

// ══════════════════════════════════════════════════════════════════════════
// 3. LINUX — add examples to 10 commands
// ══════════════════════════════════════════════════════════════════════════

patchCmd('linux', 'pwd',
`> pwd
/home/user/project/src
# Shows the absolute path of the current working directory.
# Useful in scripts: DIR=$(pwd)`);

patchCmd('linux', 'tree -L 2',
`> tree -L 2 /var/www
/var/www
├── html
│   ├── index.html
│   ├── css
│   └── js
└── logs
    ├── access.log
    └── error.log
2 directories, 4 files`);

patchCmd('linux', 'tree -a',
`> tree -a /home/user
/home/user
├── .bashrc
├── .bash_profile
├── .ssh
│   ├── authorized_keys
│   └── known_hosts
└── projects
    └── app
# -a includes hidden dot-files and directories that tree omits by default.`);

patchCmd('linux', 'stat file',
`> stat /etc/passwd
  File: /etc/passwd
  Size: 2847          Blocks: 8          IO Block: 4096   regular file
Device: fd01h/64769d  Inode: 394         Links: 1
Access: (0644/-rw-r--r--)  Uid: (0/root)   Gid: (0/root)
Access: 2026-06-15 09:22:11.000000000 +0000
Modify: 2026-05-01 14:30:05.000000000 +0000
Change: 2026-05-01 14:30:05.000000000 +0000`);

patchCmd('linux', 'realpath file',
`> realpath ../config/app.conf
/etc/myapp/config/app.conf
# Resolves relative paths and symlinks to their absolute canonical path.
# Useful in scripts to avoid ambiguity: FILE=$(realpath "$1")`);

patchCmd('linux', 'readlink file',
`> readlink /usr/bin/python3
python3.11
> readlink -f /usr/bin/python3
/usr/bin/python3.11
# readlink without -f shows just the symlink target.
# readlink -f resolves the full canonical path (follows all symlinks).`);

patchCmd('linux', 'pushd dir',
`> pushd /etc/nginx
/etc/nginx ~
# pushd changes to /etc/nginx and saves the previous directory on a stack.
# The stack is shown after the command: leftmost = current directory.
# Use popd to return to the previous directory.`);

patchCmd('linux', 'popd',
`> popd
~
# Removes the top directory from the stack and changes back to it.
# Works as an undo for the last pushd.
# Stack before: /etc/nginx ~   →   after: ~`);

patchCmd('linux', 'dirs -v',
`> dirs -v
 0  /etc/nginx
 1  ~
 2  /var/log
# Lists the directory stack with index numbers.
# Use "pushd +2" to switch directly to index 2 (/var/log).`);

patchCmd('linux', 'rm -rf dir',
`> rm -rf old_build/
# Recursively removes the directory and all its contents without prompting.
# DANGER: irreversible — always double-check the path before running.
# Safer alternative: move to /tmp first, then delete:
mv old_build/ /tmp/old_build_$(date +%s) && rm -rf /tmp/old_build_*/`);

// ══════════════════════════════════════════════════════════════════════════
// 4. NETSCALER SDX — add examples to 10 commands
// ══════════════════════════════════════════════════════════════════════════

patchCmd('netscalersdx', 'show system backup',
`> show system backup

Name                      Date                      Type
------------------------  ------------------------  ------
daily_backup_20260614     2026-06-14 02:00:01       Full
daily_backup_20260613     2026-06-13 02:00:03       Full
manual_pre_upgrade        2026-06-10 14:22:31       Full

3 backup(s) stored  →  /var/mps/backup/

What it means:
- Full backups include SDX configuration, VPX metadata, and XenServer state.
- Review dates to confirm automated backups are running before upgrades.`);

patchCmd('netscalersdx', 'show system backup <name>',
`> show system backup daily_backup_20260614

Name:      daily_backup_20260614
Date:      2026-06-14 02:00:01
Type:      Full
Size:      423 MB
Location:  /var/mps/backup/daily_backup_20260614.tar.gz
Status:    Complete
Version:   SDX 14.1 Build 21.57`);

patchCmd('netscalersdx', 'show system user',
`> show system user

Username    Groups              Auth Type  Status
----------  ------------------  ---------  -------
nsroot      supergroup          Local      Enabled
admin       nsoperatorsgroup    Local      Enabled
svc_monitor readonly            Local      Enabled

3 user(s) configured`);

patchCmd('netscalersdx', 'show system user <username>',
`> show system user nsroot

Username:      nsroot
Groups:        supergroup
Auth Type:     Local
Password Type: SHA512
Status:        Enabled
External Auth: No
Last Login:    2026-06-14 09:15:33 from 10.10.10.20`);

patchCmd('netscalersdx', 'show system config',
`> show system config

Hostname:       sdx-dc-01
IP Address:     10.10.10.100
Netmask:        255.255.255.0
Gateway:        10.10.10.1
DNS Primary:    8.8.8.8
DNS Secondary:  8.8.4.4
NTP Servers:    pool.ntp.org
Timezone:       UTC
SSH:            Enabled (port 22)
HTTPS:          Enabled (port 443)
SNMP:           Enabled (community: public)`);

patchCmd('netscalersdx', 'show system storage',
`> show system storage

Mount Point     Total     Used      Free      Use%
--------------  --------  --------  --------  ----
/               50.0 GB   15.2 GB   34.8 GB    30%
/var            200.0 GB  45.6 GB   154.4 GB   23%
/flash          4.0 GB    1.8 GB    2.2 GB     45%

What it means:
- /var/mps holds VPX images and backups — monitor closely.
- /flash approaching capacity causes SDX upgrade failures.`);

patchCmd('netscalersdx', 'show system alarms',
`> show system alarms

Alarm ID  Severity  Category  Message                          Raised
--------  --------  --------  -------------------------------  -------------------
1042      CRITICAL  CPU       CPU usage exceeded 90%           2026-06-14 08:22:11
1043      MAJOR     Memory    Free memory below 20% threshold  2026-06-14 08:22:15

2 active alarm(s)`);

patchCmd('netscalersdx', 'show system alarms -detail',
`> show system alarms -detail

Alarm ID:   1042
Severity:   CRITICAL
Category:   CPU
Message:    CPU usage exceeded 90% threshold
Raised:     2026-06-14 08:22:11
Cleared:    Not Cleared
Details:    CPU-0: 94%  CPU-1: 91%  Average: 92.5%
Threshold:  90%

Alarm ID:   1043
Severity:   MAJOR
Category:   Memory
Message:    Free memory below 20% threshold
Raised:     2026-06-14 08:22:15
Cleared:    Not Cleared
Details:    Total: 65536 MB  Used: 56320 MB  Free: 9216 MB (14%)
Threshold:  20% free`);

patchCmd('netscalersdx', 'show system processes -detail',
`> show system processes -detail

PID    Process               CPU%  MEM%  State    Uptime
-----  --------------------  ----  ----  -------  ----------
1      init                  0.0   0.1   sleep    45d 3h 11m
342    sdxd                  1.2   3.4   running  45d 3h 11m
891    httpd                 0.5   1.1   running  45d 2h 55m
1203   vssd                  0.3   0.8   running  45d 3h 10m
2451   postgres              2.1   8.2   running  45d 3h 11m
3104   snmpd                 0.1   0.3   running  45d 3h 09m`);

patchCmd('netscalersdx', 'show system hardware',
`> show system hardware

Model:          SDX 22000-40G
Serial Number:  SDX1234ABCD5678
Platform:       SDX 22000
Chassis:        2-slot
CPU:            Intel Xeon E5-2697 @ 2.60 GHz  (24 cores / 48 threads)
Memory:         65536 MB (64 GB)
Disk:           2 × 1.2 TB SAS (RAID-1)
NIC Ports:      40 × 10GE SFP+
SSL Chips:      2 × Nitrox III
SDX Version:    14.1 Build 21.57
BIOS Version:   2.5.1`);

// ══════════════════════════════════════════════════════════════════════════
// 5. NEW COMMANDS (10 total)
// ══════════════════════════════════════════════════════════════════════════

// --- Palo Alto: SSL Decryption (2 new) ------------------------------------
injectCmd('paloalto', 'SSL Decryption', {
  cmd: 'show running decryption-policy',
  desc: 'Display the currently active SSL/TLS decryption rules from the running policy',
  type: 'show',
  flagged: false,
  example: `> show running decryption-policy

Rule 1: "Decrypt-Outbound-SSL"
  From: Trust         To: Untrust
  Source: any         Destination: any
  Service: ssl        Category: any
  Action: decrypt     Type: ssl-forward-proxy
  Certificate Profile: corp-forward-trust
  Profile: default-decryption

Rule 2: "No-Decrypt-Finance"
  From: Trust         To: Untrust
  Source: any         Destination: finance-category
  Action: no-decrypt
  Description: Exempt banking sites from decryption

What it means:
- Rules are evaluated top-down; first match wins.
- "no-decrypt" rules must be above broader decrypt rules for exemptions to apply.`
});

injectCmd('paloalto', 'SSL Decryption', {
  cmd: 'test decryption-policy-match from <src-zone> to <dst-zone> source <src-ip> destination <dst-ip> destination-port <port>',
  desc: 'Test which SSL/TLS decryption rule applies to a specific traffic flow',
  type: 'show',
  flagged: false,
  example: `> test decryption-policy-match from Trust to Untrust source 10.0.1.50 destination 1.2.3.4 destination-port 443

Rule matched: "Decrypt-Outbound-SSL"
  Action:              decrypt
  Type:                ssl-forward-proxy
  Certificate Profile: corp-forward-trust
  Decryption Profile:  default-decryption

# Use this before committing a new decryption policy to confirm that
# traffic is hitting the intended rule (especially exemption rules).`
});

// --- Palo Alto: Routing (2 new) -------------------------------------------
injectCmd('paloalto', 'Routing', {
  cmd: 'show routing protocol ospf database',
  desc: 'Display the OSPF link-state database listing all LSA types, ages, and advertising routers',
  type: 'show',
  flagged: false,
  example: `> show routing protocol ospf database

OSPF database, Area 0.0.0.0
  Type      LS ID         Adv Router    Seq #      Age    Checksum
  router    1.1.1.1       1.1.1.1       0x80000004  412    0x003c4a
  router    2.2.2.2       2.2.2.2       0x80000003  396    0x0027a1
  router    3.3.3.3       3.3.3.3       0x80000005  228    0x005f12
  network   10.0.12.2     2.2.2.2       0x80000002  396    0x00a4b3
  summary   192.168.10.0  2.2.2.2       0x80000001  396    0x00d182

What it means:
- Type "router"  = Router LSA (each router's own links)
- Type "network" = Network LSA (DR-generated for broadcast segments)
- Type "summary" = Summary LSA (ABR inter-area routes)
- Age increments each second; LSAs are refreshed at 1800 s and expire at 3600 s.`
});

injectCmd('paloalto', 'Routing', {
  cmd: 'show routing protocol bgp peer-detail peer <peer-ip>',
  desc: 'Show detailed BGP peer information: negotiated capabilities, hold timer, and session state',
  type: 'show',
  flagged: false,
  example: `> show routing protocol bgp peer-detail peer 203.0.113.1

Peer:                 203.0.113.1
Remote AS:            65002
Status:               Established
Uptime:               3d 14h 22m
BGP Version:          4
Hold Timer:           90 s (negotiated)
Keepalive Interval:   30 s
Local Router-ID:      198.51.100.1
Remote Router-ID:     203.0.113.1

Negotiated Capabilities:
  Route Refresh:        yes
  4-byte AS:            yes
  Graceful Restart:     yes  (restart time 120 s)
  Add-Path (Receive):   no
  Add-Path (Send):      no

Prefixes:
  Received:  4200
  Accepted:  4200
  Sent:      12`
});

// --- AWS: EC2 snapshots (2 new) -------------------------------------------
injectCmd('aws', 'EC2', {
  cmd: 'aws ec2 create-snapshot --volume-id <vol-id> --description "<description>"',
  desc: 'Create a point-in-time EBS snapshot of a volume for backup or AMI creation',
  type: 'show',
  flagged: false,
  example: `> aws ec2 create-snapshot --volume-id vol-0a1b2c3d4e5f67890 --description "Pre-upgrade backup 2026-06-16"
{
    "SnapshotId": "snap-0a1b2c3d4e5f67890",
    "VolumeId":   "vol-0a1b2c3d4e5f67890",
    "State":      "pending",
    "StartTime":  "2026-06-16T10:00:00.000Z",
    "Progress":   "0%",
    "Description":"Pre-upgrade backup 2026-06-16"
}
# Poll until complete:
aws ec2 describe-snapshots --snapshot-ids snap-0a1b2c3d4e5f67890 --query "Snapshots[0].State"`
});

injectCmd('aws', 'EC2', {
  cmd: 'aws ec2 describe-snapshots --owner-ids self --query "Snapshots[].[SnapshotId,VolumeId,State,Progress,StartTime]" --output table',
  desc: 'List all EBS snapshots owned by the current account with their status and creation time',
  type: 'show',
  flagged: false,
  example: `> aws ec2 describe-snapshots --owner-ids self --query "Snapshots[].[SnapshotId,VolumeId,State,Progress,StartTime]" --output table
---------------------------------------------------------------------------
| DescribeSnapshots                                                       |
+-----------------------+----------------------+----------+------+--------+
| snap-0a1b2c3d4e5f678  | vol-0a1b2c3d4e5f678 | completed| 100% | 2026-06-16T10:05:12Z |
| snap-0b2c3d4e5f67891  | vol-0b2c3d4e5f67891 | completed| 100% | 2026-06-15T02:00:05Z |
| snap-0c3d4e5f6789012  | vol-0c3d4e5f6789012 | pending  | 23%  | 2026-06-16T10:00:00Z |
+-----------------------+----------------------+----------+------+--------+`
});

// --- Cisco IOS: MPLS (3 new) ----------------------------------------------
injectCmd('ciscoios', 'Routing', {
  cmd: 'show mpls forwarding-table',
  desc: 'Display the MPLS Label Forwarding Information Base (LFIB): local labels, operations, and next-hops',
  type: 'show',
  flagged: false,
  example: `Router# show mpls forwarding-table
Local  Outgoing    Prefix              Bytes Label  Outgoing   Next Hop
Label  Label or    or Tunnel Id        Switched      interface
       Tab/Tunnel
16     Pop Label   10.0.1.0/24         1024          Gi0/1      10.0.0.2
17     18          10.0.2.0/24         512           Gi0/1      10.0.0.2
18     No Label    192.168.10.0/24[V]  0             aggregate/vrf1
19     Aggregate   10.0.3.0/24         256           -          -

What it means:
- "Pop Label" = PHP (Penultimate Hop Popping); label removed before forwarding.
- "No Label"  = destination is directly connected in a VRF.
- "Aggregate" = locally originated label, no outgoing interface.`
});

injectCmd('ciscoios', 'Routing', {
  cmd: 'show mpls interfaces',
  desc: 'Show all interfaces enabled for MPLS label switching with their protocol and LDP status',
  type: 'show',
  flagged: false,
  example: `Router# show mpls interfaces
Interface              IP            Tunnel   BGP Static Operational
GigabitEthernet0/0     Yes (ldp)     No       No  No     Yes
GigabitEthernet0/1     Yes (ldp)     No       No  No     Yes
Loopback0              No            No       No  No     No

What it means:
- "Yes (ldp)"   = LDP is enabled and distributing labels on this interface.
- "Operational" = MPLS is actively processing labelled packets.
- Loopback is typically excluded from MPLS forwarding but used as router-ID.`
});

injectCmd('ciscoios', 'Routing', {
  cmd: 'show mpls ldp bindings',
  desc: 'Display all LDP label bindings: the local label assigned to each prefix and remote labels received from LDP peers',
  type: 'show',
  flagged: false,
  example: `Router# show mpls ldp bindings
  lib entry: 10.0.1.0/24, rev 6
        local binding:  label: 16
        remote binding: lsr: 10.0.0.2:0, label: 18
        remote binding: lsr: 10.0.0.3:0, label: 21
  lib entry: 10.0.2.0/24, rev 8
        local binding:  label: 17
        remote binding: lsr: 10.0.0.2:0, label: 19

What it means:
- "local binding"  = label this router advertises to its LDP peers.
- "remote binding" = labels received from each peer for the same prefix.
- The LFIB selects the best remote label for the chosen next-hop.`
});

// --- Aruba CX: new OSPF neighbor detail command (1 new) ------------------
injectCmd('aruba_cx', 'L3 Routing', {
  cmd: 'show ip ospf neighbor detail',
  desc: 'Display detailed OSPF neighbor information including state, dead timer, and DR/BDR roles',
  type: 'show',
  flagged: false,
  example: `switch# show ip ospf neighbor detail

Neighbor 2.2.2.2 on interface 1/1/49
  In the area 0.0.0.0 via interface 1/1/49
  Neighbor priority is 1, state is Full, 6 state changes
  DR is 10.0.12.2 (2.2.2.2), BDR is 10.0.12.1 (1.1.1.1)
  Options is E (external routing)
  Dead timer due in 00:00:35
  Neighbor is up for 3d 14h 22m
  Database summary list: 0
  Link state request list: 0
  Link state retransmission list: 0

What it means:
- "Full" = adjacency is complete; LSDBs are synchronised.
- Dead timer < 10 s while state is Full indicates a flapping link.
- DR/BDR roles show which router controls the broadcast segment.`
});

// ── write output ──────────────────────────────────────────────────────────

data.updatedAt = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n');
console.log(`Done. Updated examples: ${updated}  New commands added: ${added}`);
