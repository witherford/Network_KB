#!/usr/bin/env node
// Batch 5 enrichment: add 10 new commands + fill 10 examples per platform
// Platforms targeted: linux, openssl, wireshark, netscalersdx

import { readFileSync, writeFileSync } from 'fs';

const FILE = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(FILE, 'utf8'));

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────
function addExample(platform, section, cmdText, example) {
  const entries = data.platforms[platform].sections[section];
  if (!entries) { console.warn(`WARN: section not found: ${platform}/${section}`); return; }
  const entry = entries.find(e => e.cmd === cmdText);
  if (!entry) { console.warn(`WARN: cmd not found in ${platform}/${section}: ${cmdText}`); return; }
  if (entry.example) { console.log(`SKIP (already has example): ${cmdText}`); return; }
  entry.example = example;
  console.log(`  SET example: ${cmdText}`);
}

function addNewCmd(platform, section, entry) {
  const entries = data.platforms[platform].sections[section];
  if (!entries) { console.warn(`WARN: section not found: ${platform}/${section}`); return; }
  if (entries.find(e => e.cmd === entry.cmd)) {
    console.log(`SKIP (already exists): ${entry.cmd}`);
    return;
  }
  entries.push({ type: 'show', flagged: false, ...entry });
  console.log(`  ADD: ${entry.cmd}`);
}

// ─────────────────────────────────────────────────
// 1. TEN NEW COMMANDS
// ─────────────────────────────────────────────────
console.log('\n=== NEW COMMANDS ===');

// Linux — Networking section
addNewCmd('linux', 'Networking', {
  cmd: 'nc -zv host port',
  desc: 'Test TCP connectivity to a specific host and port without sending data (-z scan, -v verbose)',
  type: 'show',
  example: '# nc -zv 10.0.0.1 443\nConnection to 10.0.0.1 443 port [tcp/https] succeeded!\n\n# nc -zv 10.0.0.1 8080\nnc: connect to 10.0.0.1 port 8080 (tcp) failed: Connection refused\n\n# Useful to confirm firewall allows the path without needing curl or a full client.\n# Add -w 3 to set a 3-second timeout: nc -zvw3 host port',
});

addNewCmd('linux', 'Networking', {
  cmd: 'lsof -n -i TCP',
  desc: 'List all open TCP connections with owning process (-n skips DNS resolution for speed)',
  type: 'show',
  example: 'COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnginx     1234    root    6u  IPv4  23456      0t0  TCP *:80 (LISTEN)\nnginx     1234    root    8u  IPv4  23789      0t0  TCP 10.0.0.5:80->192.168.1.10:54321 (ESTABLISHED)\nsshd      5678    root    3u  IPv4  34567      0t0  TCP *:22 (LISTEN)\npython3   9012    user    4u  IPv4  45678      0t0  TCP *:8080 (LISTEN)\n\n# Filter to a specific port: lsof -n -i TCP:443\n# Filter to established only: lsof -n -i TCP -s TCP:ESTABLISHED',
});

addNewCmd('linux', 'Networking', {
  cmd: 'iptables -t nat -L -n -v',
  desc: 'List all NAT table rules (PREROUTING, POSTROUTING, OUTPUT) with packet counters',
  type: 'show',
  example: 'Chain PREROUTING (policy ACCEPT 1234 packets, 98765 bytes)\n target   prot opt in   out   source      destination\n DNAT     tcp  --  any  any   0.0.0.0/0  0.0.0.0/0   tcp dpt:80 to:10.0.0.5:8080\n\nChain INPUT (policy ACCEPT 0 packets, 0 bytes)\n target   prot opt in   out   source      destination\n\nChain OUTPUT (policy ACCEPT 567 packets, 45678 bytes)\n target   prot opt in   out   source      destination\n\nChain POSTROUTING (policy ACCEPT 890 packets, 67890 bytes)\n target   prot opt in   out   source      destination\n MASQUERADE  all  --  any  eth0  10.0.0.0/24  0.0.0.0/0\n\n# pkts/bytes counters reset on reboot; -Z resets them without removing rules.',
});

addNewCmd('linux', 'Networking', {
  cmd: 'conntrack -L',
  desc: 'Display all entries in the kernel connection tracking table (requires conntrack-tools)',
  type: 'show',
  example: '# conntrack -L\ntcp  6 299 ESTABLISHED src=192.168.1.10 dst=10.0.0.1 sport=54321 dport=443 \\\n  src=10.0.0.1 dst=192.168.1.10 sport=443 dport=54321 [ASSURED] mark=0 use=1\ntcp  6 115 TIME_WAIT src=192.168.1.11 dst=10.0.0.1 sport=56789 dport=80 \\\n  src=10.0.0.1 dst=192.168.1.11 sport=80 dport=56789 [ASSURED] mark=0 use=1\nudp  17 28 src=192.168.1.10 dst=8.8.8.8 sport=53412 dport=53 \\\n  src=8.8.8.8 dst=192.168.1.10 sport=53 dport=53412 mark=0 use=1\nconntrack v1.4.6 (conntrack-tools): 3 flow entries have been shown.\n\n# Filter by state: conntrack -L --state ESTABLISHED\n# Watch in real time: conntrack -E',
});

addNewCmd('linux', 'Ref 17. Advanced Networking', {
  cmd: 'ip link add vlan10 link eth0 type vlan id 10',
  desc: 'Create an 802.1Q tagged VLAN sub-interface (VLAN 10) on top of eth0',
  type: 'config',
  example: '# Create the VLAN interface\nip link add vlan10 link eth0 type vlan id 10\n\n# Assign an IP address\nip addr add 192.168.10.1/24 dev vlan10\n\n# Bring it up\nip link set vlan10 up\n\n# Verify\nip -d link show vlan10\n3: vlan10@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP\n    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff\n    vlan protocol 802.1Q id 10 <REORDER_HDR>\n\n# Remove: ip link del vlan10',
});

addNewCmd('linux', 'Networking', {
  cmd: 'python3 -m http.server 8080',
  desc: 'Serve the current directory over HTTP on port 8080 — quick file sharing without installing a web server',
  type: 'show',
  example: '# Run in the directory you want to share\npython3 -m http.server 8080\nServing HTTP on 0.0.0.0 port 8080 (http://0.0.0.0:8080/) ...\n192.168.1.10 - - [15/Jun/2026 09:12:34] "GET / HTTP/1.1" 200 -\n192.168.1.10 - - [15/Jun/2026 09:12:35] "GET /myfile.tar.gz HTTP/1.1" 200 -\n\n# Bind to a specific interface: python3 -m http.server 8080 --bind 10.0.0.1\n# Change directory first: python3 -m http.server 8080 --directory /tmp/share\n# No authentication — only use on trusted networks.',
});

// OpenSSL — CSR & Certificate Signing
addNewCmd('openssl', 'CSR & Certificate Signing', {
  cmd: 'openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes',
  desc: 'Generate a self-signed certificate and private key in a single command (-nodes = no passphrase)',
  type: 'show',
  example: '# Generates key.pem and cert.pem in the current directory\nopenssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes \\\n  -subj "/C=GB/ST=London/O=MyOrg/CN=internal.example.com"\n\nGenerating a RSA private key\n...............................................................................................++++\n........++++\nwriting new private key to \'key.pem\'\n\n# Verify the result:\nopenssl x509 -in cert.pem -noout -subject -dates\nsubject=C = GB, ST = London, O = MyOrg, CN = internal.example.com\nnotBefore=Jun 15 09:00:00 2026 GMT\nnotAfter=Jun 15 09:00:00 2027 GMT\n\n# Add SANs (required by modern browsers): append -addext "subjectAltName=DNS:internal.example.com"',
});

// OpenSSL — Format Conversion
addNewCmd('openssl', 'Format Conversion', {
  cmd: 'openssl pkcs12 -export -out bundle.pfx -inkey private.key -in cert.crt -certfile chain.crt',
  desc: 'Bundle a private key, certificate, and CA chain into a PKCS#12 (.pfx) file for Windows/IIS import',
  type: 'show',
  example: '# Prompts for an export password to protect the PFX\nopenssl pkcs12 -export -out bundle.pfx -inkey private.key -in cert.crt -certfile chain.crt\nEnter Export Password:\nVerifying - Enter Export Password:\n\n# Verify the resulting PFX:\nopenssl pkcs12 -info -in bundle.pfx -noout\nMAC: sha256, Iteration 2048\nMAC length: 32, salt length: 20\nPKCS7 Encrypted data: ...\n    Certificate bag\n    Certificate bag  (intermediate)\n    PKCS8 Shrouded Keybag\n\n# Import on Windows: double-click bundle.pfx and follow the certificate import wizard.',
});

// Wireshark — TShark section
addNewCmd('wireshark', 'TShark', {
  cmd: 'tshark -r in.pcap -T json > out.json',
  desc: 'Decode every packet in a pcap and export the full dissection tree as JSON — useful for scripting and log ingestion',
  type: 'show',
  example: '# Produces one JSON object per packet; pipe through jq for querying:\ntshark -r in.pcap -T json | jq \'.[] | ._source.layers | {src: .ip.ip_src, dst: .ip.ip_dst, proto: .frame["frame.protocols"]}\'\n\n# Example output (truncated):\n[\n  {\n    "_index": "packets-2026-06-15",\n    "_source": {\n      "layers": {\n        "frame": { "frame.number": "1", "frame.len": "74", "frame.protocols": "eth:ethertype:ip:tcp" },\n        "ip":    { "ip.src": "10.0.0.1", "ip.dst": "10.0.0.50" },\n        "tcp":   { "tcp.srcport": "443", "tcp.dstport": "54321", "tcp.flags": "0x0012" }\n      }\n    }\n  }\n]\n\n# Filter before export: tshark -r in.pcap -Y "http" -T json > http_only.json',
});

addNewCmd('wireshark', 'TShark', {
  cmd: 'tshark -r in.pcap -Y "http.request" -T fields -e frame.number -e ip.src -e http.request.method -e http.request.uri',
  desc: 'Extract HTTP request summary (frame, source IP, method, URI) as tab-separated fields — fast log extraction',
  type: 'show',
  example: '# Output is tab-separated; redirect to a file for further processing:\ntshark -r in.pcap -Y "http.request" \\\n  -T fields \\\n  -e frame.number \\\n  -e ip.src \\\n  -e http.request.method \\\n  -e http.request.uri \\\n  -E header=y -E separator=,\n\nframe.number,ip.src,http.request.method,http.request.uri\n42,192.168.1.10,GET,/index.html\n43,192.168.1.10,GET,/assets/logo.png\n67,192.168.1.11,POST,/api/login\n89,192.168.1.10,GET,/favicon.ico\n\n# Swap http.request.uri for http.response.code to extract response codes instead.',
});

// ─────────────────────────────────────────────────
// 2. LINUX — add examples to 10 existing commands
// ─────────────────────────────────────────────────
console.log('\n=== LINUX examples ===');

addExample('linux', 'Networking', 'ethtool -S <iface>',
`# ethtool -S eth0
NIC statistics:
     rx_packets: 4589234
     tx_packets: 1234567
     rx_bytes: 3456789012
     tx_bytes: 987654321
     rx_errors: 0
     tx_errors: 0
     rx_dropped: 12
     rx_missed_errors: 0
     tx_aborted_errors: 0
     tx_carrier_errors: 0

# Non-zero rx_dropped / rx_missed_errors can indicate NIC buffer overruns;
# consider increasing ring buffers: ethtool -G eth0 rx 4096`);

addExample('linux', 'Networking', 'ip -s link',
`# ip -s link
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    RX:  bytes  packets errors dropped  missed   mcast
    123456    1234      0      0       0       0
    TX:  bytes  packets errors dropped carrier collsns
    123456    1234      0      0       0       0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP
    RX:  bytes  packets errors dropped  missed   mcast
    1234567890 8901234      0      0       0    1234
    TX:  bytes  packets errors dropped carrier collsns
    9876543210 7654321      0      0       0       0

# Persistent dropped/errors indicate hardware or cabling issues.`);

addExample('linux', 'Networking', 'ip -s neigh',
`# ip -s neigh
192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff ref 1 used 0/0/4 probes 0 REACHABLE
192.168.1.10 dev eth0 lladdr 11:22:33:44:55:66 ref 1 used 12/12/20 probes 0 STALE
192.168.1.20 dev eth0  FAILED
fe80::1 dev eth0 lladdr aa:bb:cc:dd:ee:ff router ref 1 REACHABLE

# STALE = not used recently, will be re-validated on next send.
# FAILED = ARP requests sent but no reply received.`);

addExample('linux', 'Networking', 'bridge fdb show',
`# bridge fdb show
33:33:00:00:00:01 dev eth0 self permanent
01:00:5e:00:00:01 dev eth0 self permanent
aa:bb:cc:dd:ee:ff dev veth0 master docker0
8a:7b:12:34:56:78 dev veth1 master docker0
ff:ff:ff:ff:ff:ff dev eth0 self permanent

# Each line: MAC → port (dev) → bridge (master).
# "permanent" entries are static; others age out (default 300 s).`);

addExample('linux', 'Networking', 'bridge vlan',
`# bridge vlan
port              vlan-id
eth0              1 PVID Egress Untagged
eth1              1 PVID Egress Untagged
                  10
                  20
eth2              10 PVID Egress Untagged
                  20

# PVID = port VLAN ID — the default VLAN for untagged ingress frames.
# "Egress Untagged" = strip the tag before forwarding out this port.`);

addExample('linux', 'Diagnostics', 'journalctl -u <service>',
`# journalctl -u ssh --since "1 hour ago"
Jun 15 09:12:01 hostname sshd[1234]: Server listening on 0.0.0.0 port 22.
Jun 15 09:15:23 hostname sshd[1235]: Accepted publickey for alice from 192.168.1.10 port 54321 ssh2
Jun 15 09:15:23 hostname sshd[1235]: pam_unix(sshd:session): session opened for user alice by (uid=0)
Jun 15 09:45:11 hostname sshd[1236]: Failed password for root from 203.0.113.1 port 60123 ssh2
Jun 15 09:45:11 hostname sshd[1236]: Connection closed by 203.0.113.1 port 60123 [preauth]

# -f to follow live logs; -n 50 to show last 50 lines.
# Use --since "2026-06-15 09:00" --until "2026-06-15 10:00" for a time slice.`);

addExample('linux', 'Diagnostics', 'journalctl -k',
`# journalctl -k --since "today"
Jun 15 08:00:01 hostname kernel: Linux version 6.1.0-21 (gcc version 12.2.0) #1 SMP
Jun 15 08:00:02 hostname kernel: Command line: BOOT_IMAGE=/vmlinuz-6.1.0-21 root=/dev/sda1
Jun 15 08:00:05 hostname kernel: ACPI: IRQ0 used by override.
Jun 15 09:45:11 hostname kernel: eth0: Link is Up - 1Gbps/Full - flow control rx/tx
Jun 15 09:50:33 hostname kernel: oom-kill:constraint=CONSTRAINT_NONE,nodemask=(null),task=python3
Jun 15 09:50:33 hostname kernel: Out of memory: Killed process 12345 (python3) score 821

# Equivalent to dmesg but with proper timestamps and persistent across reboots.`);

addExample('linux', 'Diagnostics', 'dmesg -T',
`# dmesg -T | tail -20
[Mon Jun 15 08:00:01 2026] Linux version 6.1.0 (gcc) #1 SMP PREEMPT
[Mon Jun 15 08:00:15 2026] eth0: renamed from veth123abc
[Mon Jun 15 09:45:11 2026] eth0: Link is Up - 1Gbps/Full - flow control rx/tx
[Mon Jun 15 09:46:00 2026] eth0: NIC Link is Down
[Mon Jun 15 09:46:15 2026] eth0: Link is Up - 1Gbps/Full - flow control rx/tx
[Mon Jun 15 10:12:03 2026] EXT4-fs error (device sda1): ext4_validate_block_bitmap ...

# -T converts monotonic timestamps to human-readable wall clock time.
# Filter for network events: dmesg -T | grep -i "eth\|link\|nic"`);

addExample('linux', 'Diagnostics', 'systemctl list-units --failed',
`# systemctl list-units --failed
  UNIT                  LOAD   ACTIVE SUB    DESCRIPTION
● nginx.service          loaded failed failed A high performance web server
● networking.service     loaded failed failed Raise network interfaces

LOAD   = Reflects whether the unit definition was properly loaded.
ACTIVE = The high-level unit activation state.
SUB    = The low-level unit activation state.
2 loaded units listed.

# Investigate a failed unit: journalctl -u nginx.service --since "30 min ago"
# Reset the failed state: systemctl reset-failed nginx.service`);

addExample('linux', 'Diagnostics', 'systemctl list-timers',
`# systemctl list-timers
NEXT                        LEFT          LAST                        PASSED  UNIT                    ACTIVATES
Mon 2026-06-15 10:00:00 UTC 14min left   Mon 2026-06-15 09:00:00 UTC 46min   apt-daily.timer         apt-daily.service
Mon 2026-06-15 12:00:00 UTC 2h 14min     Mon 2026-06-14 12:00:00 UTC 21h     logrotate.timer         logrotate.service
Tue 2026-06-16 00:00:00 UTC 13h 14min    Mon 2026-06-15 00:00:00 UTC 9h      apt-daily-upgrade.timer apt-daily-upgrade.service

3 timers listed.

# Shows all active timers with their next/last run times.
# Useful for understanding what cron-equivalent tasks are scheduled.`);

// ─────────────────────────────────────────────────
// 3. OPENSSL — add examples to 10 existing commands
// ─────────────────────────────────────────────────
console.log('\n=== OPENSSL examples ===');

addExample('openssl', 'Key Generation', 'openssl ecparam -name secp384r1 -genkey -noout -out ec.key',
`# Generates the key silently — no stdout on success.
openssl ecparam -name secp384r1 -genkey -noout -out ec.key

# Verify the key was created:
openssl pkey -in ec.key -text -noout
Private-Key: (384 bit)
priv:
    27:ab:cd:ef:01:23:45:67:89:ab:cd:ef:...
pub:
    04:1a:2b:3c:4d:5e:6f:70:81:92:a3:b4:...
ASN1 OID: secp384r1
NIST CURVE: P-384

# secp384r1 (P-384) offers 192-bit security — suitable for TLS 1.3 key exchange.`);

addExample('openssl', 'Key Generation', 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key',
`openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key
..................................+++
.............+++

# Verify:
openssl pkey -in rsa3072.key -text -noout | head -5
Private-Key: (3072 bit, 2 primes)
modulus:
    00:c3:7a:b2:...

# 3072-bit RSA provides ~128-bit security — the NIST recommended minimum through 2030.`);

addExample('openssl', 'Key Generation', 'openssl dhparam -out dhparam.pem 4096',
`# WARNING: Generation takes several minutes — run once and cache the file.
openssl dhparam -out dhparam.pem 4096
Generating DH parameters, 4096 bit long safe prime
.........+..............................................................
(many dots — this is normal and may take 5-15 minutes)
..........................................................++*++*

# Verify:
openssl dhparam -in dhparam.pem -check -text | head -4
DH Parameters: (4096 bit)
    prime:
        00:de:ad:be:ef:...
DH parameters appear to be ok.

# nginx example: add "ssl_dhparam /etc/ssl/dhparam.pem;" to ssl server block.`);

addExample('openssl', 'Key Generation', 'openssl rand -hex 32',
`openssl rand -hex 32
a3f8e2d1c4b5069782f1e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4

# The output is a 256-bit (32-byte) cryptographically random hex string.
# Common uses:
#   API keys:    openssl rand -hex 32
#   JWT secret:  openssl rand -base64 48
#   UUID-style:  openssl rand -hex 16 | sed 's/\\(........\\)\\(....\\)\\(....\\)\\(....\\)\\(............\\)/\\1-\\2-\\3-\\4-\\5/'`);

addExample('openssl', 'Certificate Inspection', 'openssl x509 -in cert.crt -text -noout',
`openssl x509 -in cert.crt -text -noout
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number: 04:a3:b2:c1:d0:e9:f8:a7:b6:c5:d4:e3:f2:a1:b0
    Signature Algorithm: sha256WithRSAEncryption
        Issuer: C=GB, O=Example CA, CN=Example Intermediate CA
        Validity
            Not Before: Jun 15 00:00:00 2025 GMT
            Not After : Jun 15 23:59:59 2026 GMT
        Subject: C=GB, O=Example Ltd, CN=www.example.com
        Subject Public Key Info: Public Key Algorithm: rsaEncryption (2048 bit)
        X509v3 extensions:
            X509v3 Subject Alternative Name:
                DNS:www.example.com, DNS:example.com
            X509v3 Key Usage: Digital Signature, Key Encipherment
            X509v3 Extended Key Usage: TLS Web Server Authentication
            X509v3 Basic Constraints: CA:FALSE`);

addExample('openssl', 'Certificate Inspection', 'openssl x509 -in cert.crt -noout -dates',
`openssl x509 -in cert.crt -noout -dates
notBefore=Jun 15 00:00:00 2025 GMT
notAfter=Jun 15 23:59:59 2026 GMT

# Check if expired: openssl x509 -in cert.crt -noout -checkend 0
#   exits 0 = still valid, exits 1 = already expired

# Check if expiring within 30 days (2592000 seconds):
openssl x509 -in cert.crt -noout -checkend 2592000
Certificate will not expire
# (exit code 1 + "Certificate will expire" if within the window)`);

addExample('openssl', 'Hashing & HMAC', 'openssl dgst -sha256 <file>',
`openssl dgst -sha256 /path/to/firmware.bin
SHA2-256(/path/to/firmware.bin)= e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Compare against a published checksum:
echo "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  firmware.bin" | sha256sum -c
firmware.bin: OK

# HMAC with a secret key:
openssl dgst -sha256 -hmac "mysecretkey" file.txt
HMAC-SHA2-256(file.txt)= 4c1f6b2a9d3e8f7a5b0c2d1e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2`);

addExample('openssl', 'TLS Client Testing', 'openssl s_client -connect hostname:443 -showcerts',
`openssl s_client -connect hostname:443 -showcerts 2>/dev/null
CONNECTED(00000003)
depth=2 C = US, O = DigiCert Inc, CN = DigiCert Global Root CA
verify return:1
depth=1 C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1
verify return:1
depth=0 CN = hostname
verify return:1
---
Certificate chain
 0 s:CN = hostname
   i:C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1
-----BEGIN CERTIFICATE-----
MIIGzDCCBLSgAwIBAgIQCkMs...
-----END CERTIFICATE-----
 1 s:C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1
   i:C = US, O = DigiCert Inc, CN = DigiCert Global Root CA
-----BEGIN CERTIFICATE-----
MIIEvjCCA6agAwIBA...
-----END CERTIFICATE-----

# Save the chain: openssl s_client -connect hostname:443 -showcerts 2>/dev/null | \
#   awk '/BEGIN CERT/,/END CERT/' > chain.pem`);

addExample('openssl', 'Digital Signatures', 'openssl dgst -sha256 -sign private.key -out sig.bin file.txt',
`# Sign a file
openssl dgst -sha256 -sign private.key -out sig.bin file.txt
# (no output on success — sig.bin is created)

# Verify the signature (requires the corresponding public key)
openssl dgst -sha256 -verify public.key -signature sig.bin file.txt
Verified OK

# If tampered:
openssl dgst -sha256 -verify public.key -signature sig.bin modified_file.txt
Verification Failure

# Extract public key from private key first if needed:
openssl rsa -in private.key -pubout -out public.key`);

addExample('openssl', 'Performance & Benchmarks', 'openssl speed -evp aes-256-gcm',
`openssl speed -evp aes-256-gcm
Doing AES-256-GCM for 3s on 16 size blocks: 92345678 AES-256-GCM's in 3.00s
Doing AES-256-GCM for 3s on 64 size blocks: 28901234 AES-256-GCM's in 3.00s
Doing AES-256-GCM for 3s on 256 size blocks: 8345678 AES-256-GCM's in 3.00s
Doing AES-256-GCM for 3s on 1024 size blocks: 2234567 AES-256-GCM's in 3.00s
Doing AES-256-GCM for 3s on 8192 size blocks: 289012 AES-256-GCM's in 3.00s

type              16 bytes   64 bytes  256 bytes 1024 bytes 8192 bytes
aes-256-gcm    492,777.5k  615,738.6k  711,509.3k  763,076.6k  788,635.6k

# Values well above 500 MB/s indicate AES-NI hardware acceleration is active.
# Check: openssl speed -evp aes-256-gcm vs openssl speed aes-256-cbc
#        GCM >> CBC confirms AES-NI is used for authenticated encryption.`);

// ─────────────────────────────────────────────────
// 4. WIRESHARK — add examples to 10 existing commands
// ─────────────────────────────────────────────────
console.log('\n=== WIRESHARK examples ===');

addExample('wireshark', 'Display Filters — TCP/UDP', 'tcp.port == 443',
`# Apply in the Wireshark filter bar or pass to tshark -Y
# Matches any TCP frame where either srcport OR dstport is 443.
Frame 1:  192.168.1.10:54321 → 10.0.0.1:443   TCP [SYN]
Frame 2:  10.0.0.1:443       → 192.168.1.10:54321  TCP [SYN,ACK]
Frame 3:  192.168.1.10:54321 → 10.0.0.1:443   TCP [ACK]
Frame 4:  192.168.1.10:54321 → 10.0.0.1:443   TLSv1.3 Client Hello
Frame 5:  10.0.0.1:443       → 192.168.1.10:54321  TLSv1.3 Server Hello

# To see both directions of one session: tcp.stream == <n>
# Right-click any frame → Follow → TLS Stream to decrypt (with SSLKEYLOGFILE).`);

addExample('wireshark', 'Display Filters — TCP/UDP', 'tcp.flags.syn == 1 and tcp.flags.ack == 0',
`# Isolates only the initial SYN (new connection attempts, not SYN-ACKs).
# Useful for: spotting port scans, counting new connections, detecting half-open floods.
Frame 1:  192.168.1.10:56789 → 10.0.0.1:80    TCP [SYN] Seq=0
Frame 9:  192.168.1.10:56790 → 10.0.0.1:443   TCP [SYN] Seq=0
Frame 17: 192.168.1.10:56791 → 10.0.0.1:8080  TCP [SYN] Seq=0

# A single source hitting many ports in rapid succession = port scan.
# Combine with: ip.src == 203.0.113.0/24 to scope to a subnet.
# Inverse (SYN-ACKs only): tcp.flags.syn == 1 and tcp.flags.ack == 1`);

addExample('wireshark', 'Display Filters — HTTP/HTTPS', 'http',
`# Shows all decoded HTTP/1.x frames (requires traffic on port 80 or a port
# configured under Analyze → Decode As → HTTP).
Frame 42: GET /index.html HTTP/1.1
Frame 43: HTTP/1.1 200 OK  (text/html, 2345 bytes)
Frame 68: POST /api/login HTTP/1.1
Frame 69: HTTP/1.1 401 Unauthorized

# Note: https traffic is TLS-encrypted; use the tls.* filter family for that.
# To also catch HTTP on non-standard ports: tcp.port == 8080 and http`);

addExample('wireshark', 'Display Filters — DNS', 'dns.qry.name contains "example.com"',
`# Matches any DNS query or response whose question name contains "example.com".
Frame 12: Standard query A www.example.com
Frame 13: Standard query response A www.example.com → 93.184.216.34
Frame 45: Standard query A api.example.com
Frame 46: Standard query response A api.example.com → 10.0.0.5

# Exact match (use == instead of contains):
#   dns.qry.name == "www.example.com"
# Show only NXDOMAIN (name not found):
#   dns.flags.response == 1 and dns.flags.rcode == 3`);

addExample('wireshark', 'Display Filters — ARP / ICMP', 'arp.opcode == 1',
`# Shows only ARP request frames — the "who has X?" half of ARP exchange.
Frame 3:  Who has 192.168.1.1?  Tell 192.168.1.10   ARP Request
Frame 7:  Who has 192.168.1.20? Tell 192.168.1.10   ARP Request
Frame 11: Who has 192.168.1.1?  Tell 192.168.1.11   ARP Request

# Complement (replies only): arp.opcode == 2
# Detect ARP storms (DoS or misconfiguration):
#   arp.opcode == 1 && !_ws.col.info contains "Retransmission"
# Gratuitous ARP (IP conflict probe): arp.duplicate-address-detected`);

addExample('wireshark', 'Display Filters — TLS/SSL', 'tls.handshake.type == 1',
`# Shows only TLS ClientHello messages — one per new TLS session.
# Useful for: extracting SNI, auditing cipher suites, measuring TLS version distribution.
Frame 4:   192.168.1.10 → 10.0.0.1   TLSv1.3 Client Hello SNI=example.com
Frame 18:  192.168.1.11 → 10.0.0.1   TLSv1.3 Client Hello SNI=api.example.com
Frame 55:  192.168.1.12 → 10.0.0.1   TLSv1.2 Client Hello SNI=legacy.example.com

# Extract all SNIs with tshark:
#   tshark -r in.pcap -Y "tls.handshake.type==1" \\
#     -T fields -e tls.handshake.extensions_server_name | sort -u
# ServerHello (type 2): shows negotiated cipher and TLS version.`);

addExample('wireshark', 'Display Filters — Routing / Switching Control Plane', 'ospf.msg == 1',
`# Matches OSPF Hello packets — the liveness probes sent every HelloInterval (default 10 s).
Frame 5:   10.0.0.1 → 224.0.0.5  OSPF Hello  Router ID 1.1.1.1
Frame 15:  10.0.0.2 → 224.0.0.5  OSPF Hello  Router ID 2.2.2.2
Frame 25:  10.0.0.1 → 224.0.0.5  OSPF Hello  Router ID 1.1.1.1

# Missing hellos on a link = adjacency failure (check timer mismatch or MTU issue).
# Other OSPF message types:
#   ospf.msg == 2  DB Description (DBD)
#   ospf.msg == 3  Link State Request (LSR)
#   ospf.msg == 4  Link State Update (LSU)
#   ospf.msg == 5  Link State Acknowledgement (LSAck)`);

addExample('wireshark', 'Capture Filters', 'host <ip>',
`# Capture filter syntax (BPF) — entered in the "Capture Options" dialog
# or passed to tshark with -f. Applied in the kernel before frames reach Wireshark.

# Capture all traffic to/from 10.0.0.1:
tshark -i eth0 -f "host 10.0.0.1" -w host.pcap

# Combine conditions:
#   host 10.0.0.1 and port 443    — HTTPS traffic only
#   host 10.0.0.1 and not port 22 — everything except SSH
#   src host 10.0.0.1             — outbound from this host only

# BPF is evaluated in kernel — much more efficient than display filters for long captures.`);

addExample('wireshark', 'Analysis & Statistics', 'Statistics → Conversations',
`# Menu: Statistics → Conversations  (shortcut: none; filter bar shortcut: Ctrl+Alt+C)
# Shows talker pairs grouped by protocol tab: Ethernet / IPv4 / IPv6 / TCP / UDP

# TCP Conversations example output:
Address A           Port A  Address B           Port B  Packets Bytes   Duration
192.168.1.10        54321   10.0.0.1            443     2341    3.2 MB  45.123 s
192.168.1.11        56789   10.0.0.1            80       456    128 KB   2.456 s
192.168.1.10        60123   8.8.8.8             53        12    1.1 KB   0.234 s

# Click any row → Apply as Filter → "Selected" to drill down into that conversation.
# "Follow Stream" button opens the stream reassembly view directly.`);

addExample('wireshark', 'TShark', 'tshark -r in.pcap -qz io,stat,10',
`# -q suppresses per-packet output; -z io,stat,10 prints throughput every 10 seconds.
tshark -r in.pcap -qz io,stat,10

===================================================================
| IO Statistics                                                   |
|                                                                 |
| Duration: 60.123456 secs                                        |
| Interval: 10 secs                                               |
|                                                                 |
| Col 1: Frames and bytes                                         |
|-------|------|---------|------|---------|------|---------|-------|
|       |Col 1 |         |Col 1|         |Col 1|         |Col 1 |
|Interval|Frames|  Bytes |Frames|  Bytes|Frames|  Bytes |Frames|
|  0<>10 |  1234|  987654|  ...|     ...|  ...|     ...|  ...|
| 10<>20 |   987|  765432|  ...|     ...|  ...|     ...|  ...|

# Reveals traffic bursts and quiet periods — useful for capacity planning.`);

// ─────────────────────────────────────────────────
// 5. NETSCALERSDX — add examples to 10 existing commands
// ─────────────────────────────────────────────────
console.log('\n=== NETSCALERSDX examples ===');

addExample('netscalersdx', 'Chassis', 'show chassis',
`> show chassis

Chassis Model:  SDX 22000
Serial Number:  AB1234567890
Slots:          4
Populated Slots: 3 (slots 1, 2, 4)
Chassis Status: Operational
Management IP:  10.10.10.100
Management MAC: aa:bb:cc:dd:ee:ff
Firmware:       SDX 14.1 Build 21.57

What it means:
- Populated Slots shows physical cards installed; gaps indicate empty or failed slots.
- Chassis Status "Operational" confirms management plane is healthy.
- Use "show chassis status" for real-time fan/PSU/temperature detail.`);

addExample('netscalersdx', 'Chassis', 'show chassis fans',
`> show chassis fans

Fan  Location       Status  Speed (RPM)  Threshold
---  -------------  ------  -----------  ---------
1    Front-Left     OK      2480         <500 FAIL
2    Front-Right    OK      2510         <500 FAIL
3    Rear-Left      OK      2490         <500 FAIL
4    Rear-Right     OK      2505         <500 FAIL

All fans operating within normal parameters.

What it means:
- Any fan showing FAILED will generate a critical alarm and may trigger thermal throttling.
- If RPM drops below threshold with status "DEGRADED", plan a maintenance window.`);

addExample('netscalersdx', 'Backplane', 'show backplane',
`> show backplane

Backplane Status:  Active
Backplane Speed:   10 Gbps
Backplane Type:    PCIe
Number of Links:   4
Active Links:      4
Failed Links:      0

What it means:
- The backplane interconnects the management card to VPX/physical NICs.
- Failed Links > 0 indicates a hardware fault; raise a Citrix support case.`);

addExample('netscalersdx', 'SSL Chips', 'show sslchip',
`> show sslchip

Chip  Slot  Status     Allocated  Available  Crypto Ops/s
----  ----  ---------  ---------  ---------  -----------
1     1     Active     2          6          45000
2     1     Active     1          7          38000
3     2     Active     0          8          0
4     2     Standby    0          8          0

Total SSL Chips: 4
Active:          3
Standby:         1

What it means:
- "Allocated" shows chips bound to VPX instances.
- Chips in Standby state take over if an Active chip fails.
- High Crypto Ops/s combined with low Available indicates SSL offload saturation.`);

addExample('netscalersdx', 'CPU', 'show cpu',
`> show cpu

CPU  Core  Usage %  System %  User %   Idle %
---  ----  -------  --------  ------   ------
0    0     12.5     3.2       9.3      87.5
0    1     8.3      2.1       6.2      91.7
0    2     5.0      1.5       3.5      95.0
0    3     15.8     4.1       11.7     84.2
All  Avg   10.4     2.7       7.7      89.6

What it means:
- SDX management CPU — separate from per-VPX data-plane CPUs.
- Sustained Usage > 80% on any core warrants investigation (show system processes).`);

addExample('netscalersdx', 'Diagnostics', 'show logs',
`> show logs
[Jun 15 09:10:01] INFO  [mgmtsvr] System startup complete. Version SDX 14.1 Build 21.57
[Jun 15 09:12:34] INFO  [vpx_mgr] VPX vpx-01 started successfully
[Jun 15 09:14:22] WARN  [netmon]  Interface 1/4 link down detected
[Jun 15 09:14:35] INFO  [netmon]  Interface 1/4 link restored
[Jun 15 10:05:00] ERROR [sslchip] SSL chip 2 reset — recovered automatically

What it means:
- WARN/ERROR entries are the primary focus for incident investigation.
- Use "show logs xen" to see Xen hypervisor events separately.
- Use "show logs -detail" for millisecond timestamps and process IDs.`);

addExample('netscalersdx', 'Diagnostics', 'show events',
`> show events

Time                  Severity  Source      Message
--------------------  --------  ----------  -----------------------------------------------
2026-06-15 10:05:00   CRITICAL  SSL         SSL chip 2 reset — auto-recovered
2026-06-15 09:14:22   MAJOR     Network     Interface 1/4 link down
2026-06-15 09:14:35   CLEAR     Network     Interface 1/4 link restored
2026-06-15 08:00:15   MINOR     VPX         VPX vpx-02 CPU usage exceeded 75%
2026-06-14 22:00:00   INFO      System      Scheduled backup completed successfully

What it means:
- CRITICAL / MAJOR events need immediate attention.
- CLEAR events confirm a previous alarm resolved — confirm with monitoring.`);

addExample('netscalersdx', 'VM Management', 'show vm',
`> show vm

Name       State    CPUs  Memory(MB)  Disk(GB)  IP Address    Version
---------  -------  ----  ----------  --------  ------------  --------------------
vpx-01     Running  4     8192        100       10.10.10.11   NSVPX 14.1 Build 21
vpx-02     Running  2     4096        100       10.10.10.12   NSVPX 14.1 Build 21
vpx-dev    Halted   2     2048        100       10.10.10.13   NSVPX 13.1 Build 49

Total VMs: 3   Running: 2   Halted: 1

What it means:
- Halted VMs are shut down but retain their configuration and disk.
- Use "show vm <name>" for network bindings, CPU pinning, and SSL chip allocation.`);

addExample('netscalersdx', 'VM Management', 'show vm cpu',
`> show vm cpu

VM Name    vCPU  Host CPU  Usage %  State
---------  ----  --------  -------  -------
vpx-01     0     2         8.2      Running
vpx-01     1     3         12.5     Running
vpx-01     2     4         6.1      Running
vpx-01     3     5         9.8      Running
vpx-02     0     6         3.4      Running
vpx-02     1     7         5.7      Running

What it means:
- "Host CPU" shows physical core pinning — helps identify NUMA affinity issues.
- Imbalanced per-vCPU usage may indicate VPX queue depth or interrupt skew.`);

addExample('netscalersdx', 'VPX', 'show vpx',
`> show vpx

Name       Status   vCPUs  Memory(MB)  SSL Chips  IP           Build
---------  -------  -----  ----------  ---------  -----------  --------------------
vpx-01     Up       4      8192        2          10.10.10.11  NSVPX 14.1 Build 21
vpx-02     Up       2      4096        1          10.10.10.12  NSVPX 14.1 Build 21
vpx-dev    Down     2      2048        0          10.10.10.13  NSVPX 13.1 Build 49

What it means:
- "SSL Chips" shows dedicated hardware crypto acceleration allocated to each VPX.
- "Down" status means the VPX OS is not running — use "start vm <name>" to bring it up.
- Compare Build across VPXs to identify inconsistent firmware versions.`);

// ─────────────────────────────────────────────────
// WRITE OUT
// ─────────────────────────────────────────────────
data.updatedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log('\nDone — commands.json written.');
// This file was appended — intentionally empty (logic moved to batch5b)
