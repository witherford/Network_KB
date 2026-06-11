/**
 * Adds examples to existing commands that are missing them,
 * and inserts 10 brand-new commands across various platforms.
 *
 * Run: node scripts/update-commands.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'data/commands.json';
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const P = data.platforms;

/* ─────────────────────────────────────────────────────────────────
   Helper: set example on a command by exact cmd match
───────────────────────────────────────────────────────────────── */
function setExample(platform, section, cmdStr, example) {
  const sec = P[platform]?.sections?.[section];
  if (!sec) { console.warn(`MISSING section [${platform}] "${section}"`); return; }
  const entry = sec.find(c => c.cmd === cmdStr);
  if (!entry) { console.warn(`MISSING cmd [${platform}/${section}] "${cmdStr}"`); return; }
  if (entry.example) return; // already has one — skip
  entry.example = example;
  console.log(`  SET [${platform}] ${cmdStr.slice(0, 60)}`);
}

/* ─────────────────────────────────────────────────────────────────
   Helper: push a new command into a section
───────────────────────────────────────────────────────────────── */
function addCommand(platform, section, entry) {
  const sec = P[platform]?.sections?.[section];
  if (!sec) { console.warn(`MISSING section [${platform}] "${section}"`); return; }
  if (sec.some(c => c.cmd === entry.cmd)) {
    console.warn(`  SKIP DUPLICATE [${platform}] ${entry.cmd}`);
    return;
  }
  sec.push(entry);
  console.log(`  ADD [${platform}] ${entry.cmd.slice(0, 60)}`);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — Fill missing examples (10 per platform)
═══════════════════════════════════════════════════════════════ */

console.log('\n=== LINUX ===');
setExample('linux', 'Networking', 'ip r',
  `default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.100 metric 100
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100
10.0.0.0/8 via 10.0.0.1 dev eth1`);

setExample('linux', 'Networking', 'ip neigh',
  `192.168.1.1   dev eth0 lladdr 00:1a:2b:3c:4d:5e REACHABLE
192.168.1.50  dev eth0 lladdr aa:bb:cc:dd:ee:01 STALE
192.168.1.101 dev eth0 lladdr aa:bb:cc:dd:ee:02 DELAY`);

setExample('linux', 'Networking', 'ss -s',
  `Total: 312
TCP:   48 (estab 22, closed 8, orphaned 0, timewait 6)

Transport Total     IP        IPv6
RAW       0         0         0
UDP       10        8         2
TCP       40        36        4
INET      50        44        6
FRAG      0         0         0`);

setExample('linux', 'Networking', 'ethtool <iface>',
  `# ethtool eth0
Settings for eth0:
  Supported ports: [ TP MII ]
  Speed: 1000Mb/s
  Duplex: Full
  Auto-negotiation: on
  Port: Twisted Pair
  Link detected: yes`);

setExample('linux', 'Networking', 'ip link show',
  `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000
    link/ether aa:bb:cc:dd:ee:01 brd ff:ff:ff:ff:ff:ff
3: eth1: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN mode DEFAULT group default qlen 1000
    link/ether aa:bb:cc:dd:ee:02 brd ff:ff:ff:ff:ff:ff`);

setExample('linux', 'Networking', 'nmcli device status',
  `DEVICE  TYPE      STATE      CONNECTION
eth0    ethernet  connected  Wired connection 1
eth1    ethernet  disconnected --
lo      loopback  unmanaged  --`);

setExample('linux', 'Networking', 'nmcli connection show',
  `NAME                UUID                                  TYPE      DEVICE
Wired connection 1  a1b2c3d4-e5f6-7890-abcd-ef0123456789  ethernet  eth0
VPN-office          b2c3d4e5-f6a7-8901-bcde-f01234567890  vpn       --`);

setExample('linux', 'Networking', 'ip -s link',
  `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default
    RX: bytes  packets  errors  dropped missed  mcast
    1234567890  987654   0       0       0       12345
    TX: bytes  packets  errors  dropped carrier collsns
    987654321   876543   0       0       0       0`);

setExample('linux', 'Networking', 'iptables -L -n -v',
  `Chain INPUT (policy DROP 0 packets, 0 bytes)
 pkts bytes target     prot opt in     out     source               destination
12345  8MB  ACCEPT     all  --  lo     *       0.0.0.0/0            0.0.0.0/0
 5678  2MB  ACCEPT     tcp  --  *      *       0.0.0.0/0            0.0.0.0/0  state RELATED,ESTABLISHED
  100  5KB  ACCEPT     tcp  --  *      *       0.0.0.0/0            0.0.0.0/0  tcp dpt:22
    0    0  REJECT     all  --  *      *       0.0.0.0/0            0.0.0.0/0  reject-with icmp-host-prohibited

Chain FORWARD (policy DROP 0 packets, 0 bytes)
Chain OUTPUT (policy ACCEPT 23456 packets, 15MB bytes)`);

setExample('linux', 'Networking', 'ss -tan',
  `State     Recv-Q Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN         0    128          0.0.0.0:22         0.0.0.0:*
LISTEN         0    128          0.0.0.0:80         0.0.0.0:*
ESTAB          0      0    192.168.1.100:22    10.0.0.5:54321
TIME-WAIT      0      0    192.168.1.100:80    1.2.3.4:51234
CLOSE-WAIT    32      0    192.168.1.100:443   5.6.7.8:52000`);

/* ─── WIRESHARK ─── */
console.log('\n=== WIRESHARK ===');
setExample('wireshark', 'Display Filters — Basic', 'ip.addr == 10.0.0.1',
  `Matches packets where source OR destination IP is 10.0.0.1.

Frame 1:  IP 10.0.0.1 → 8.8.8.8       DNS  Query A example.com
Frame 2:  IP 8.8.8.8  → 10.0.0.1      DNS  Response A 93.184.216.34
Frame 3:  IP 10.0.0.1 → 93.184.216.34 TCP  443 [SYN]`);

setExample('wireshark', 'Display Filters — Basic', 'ip.src == 10.0.0.1',
  `Matches packets where source IP is exactly 10.0.0.1 (outbound traffic only).

Frame 1:  IP 10.0.0.1 → 8.8.8.8       DNS  Query A example.com
Frame 3:  IP 10.0.0.1 → 93.184.216.34 TCP  443 [SYN]`);

setExample('wireshark', 'Display Filters — Basic', 'ip.dst == 10.0.0.1',
  `Matches packets where destination IP is 10.0.0.1 (inbound traffic only).

Frame 2:  IP 8.8.8.8  → 10.0.0.1  DNS  Response A 93.184.216.34
Frame 4:  IP 93.184.216.34 → 10.0.0.1  TCP  [SYN, ACK]`);

setExample('wireshark', 'Display Filters — Basic', 'ip.addr == 10.0.0.0/24',
  `CIDR subnet filter — matches any host in the 10.0.0.0/24 subnet (both src and dst).

Frame 1:  IP 10.0.0.1   → 10.0.0.254   ARP  Who has 10.0.0.254?
Frame 2:  IP 10.0.0.100 → 8.8.8.8      DNS  Query A example.com
Frame 3:  IP 10.0.0.254 → 10.0.0.1     ARP  10.0.0.254 is at aa:bb:cc:dd:ee:ff`);

setExample('wireshark', 'Display Filters — Basic', 'not (ip.addr == 10.0.0.1)',
  `Excludes all traffic to/from 10.0.0.1 — useful to remove noisy hosts from analysis.
Equivalent to: !(ip.addr == 10.0.0.1)

Before: 5,234 frames
After:  4,891 frames (343 frames involving 10.0.0.1 hidden)`);

setExample('wireshark', 'Display Filters — Basic', 'eth.addr == aa:bb:cc:dd:ee:ff',
  `Matches frames where source OR destination MAC is aa:bb:cc:dd:ee:ff.
Useful for tracking a specific device regardless of IP address (DHCP, APIPA, etc.)

Frame 1:  aa:bb:cc:dd:ee:ff → ff:ff:ff:ff:ff:ff  ARP  Who has 192.168.1.1?
Frame 2:  00:11:22:33:44:55 → aa:bb:cc:dd:ee:ff  ARP  192.168.1.1 is at 00:11:22:33:44:55`);

setExample('wireshark', 'Display Filters — Basic', 'eth.dst == ff:ff:ff:ff:ff:ff',
  `Matches all Ethernet broadcast frames (dst MAC ff:ff:ff:ff:ff:ff).
Common protocols using broadcasts: ARP, DHCP Discover/Request, NetBIOS.

Frame 1:  10.0.0.1  → 255.255.255.255  DHCP  Discover
Frame 2:  10.0.0.10 → 255.255.255.255  ARP   Who has 10.0.0.1?
Frame 3:  10.0.0.20 → 255.255.255.255  NBNS  Registration NB WORKSTATION<00>`);

setExample('wireshark', 'Display Filters — Basic', 'vlan.id == 20',
  `Matches 802.1Q tagged frames for VLAN 20.
Note: requires capturing on a trunk port or SPAN with 802.1Q preservation.

Frame 1:  [VLAN: 20] IP 10.20.0.1 → 10.20.0.2  TCP  443 [SYN]
Frame 2:  [VLAN: 20] IP 10.20.0.2 → 10.20.0.1  TCP  443 [SYN, ACK]`);

setExample('wireshark', 'Display Filters — Basic', 'frame.len > 1500',
  `Matches jumbo frames and oversized packets (larger than standard Ethernet MTU of 1500 bytes).
Common on storage networks (iSCSI, NFS) or links with jumbo frames enabled (MTU 9000).

Frame 12:  frame.len=8192   IP 10.0.0.5 → 10.0.0.10  TCP 3260 iSCSI data
Frame 15:  frame.len=9000   IP 10.0.0.5 → 10.0.0.10  TCP 3260 iSCSI data`);

setExample('wireshark', 'Display Filters — Basic', 'ip.addr == 10.0.0.1 and ip.addr == 10.0.0.2',
  `Matches packets that involve BOTH hosts — i.e. the conversation between 10.0.0.1 and 10.0.0.2.
Equivalent to right-clicking a packet → Follow → TCP/UDP Stream for a single session.

Frame 1:  IP 10.0.0.1 → 10.0.0.2  TCP  [SYN]
Frame 2:  IP 10.0.0.2 → 10.0.0.1  TCP  [SYN, ACK]
Frame 3:  IP 10.0.0.1 → 10.0.0.2  TCP  [ACK]`);

/* ─── OPENSSL ─── */
console.log('\n=== OPENSSL ===');
setExample('openssl', 'Key Generation', 'openssl genrsa -out private.key 2048',
  `Generating RSA private key, 2048 bit long modulus (2 primes)
..........+++++
......+++++
e is 65537 (0x010001)

# Verify the key:
openssl rsa -in private.key -check
RSA key ok`);

setExample('openssl', 'Key Generation', 'openssl genrsa -aes256 -out private.key 4096',
  `Enter PEM pass phrase: ****
Verifying - Enter PEM pass phrase: ****
Generating RSA private key, 4096 bit long modulus (2 primes)
.....+++++
e is 65537 (0x010001)

# Key is encrypted — required on every use (signing, TLS server):
openssl rsa -in private.key -noout -text | head -3
Private-Key: (4096 bit, 2 primes)`);

setExample('openssl', 'Key Generation', 'openssl ecparam -name prime256v1 -genkey -noout -out ec.key',
  `# Generate EC private key (NIST P-256):
# (no output on success)

# Verify:
openssl ec -in ec.key -noout -text 2>&1 | head -4
read EC key
Private-Key: (256 bit)
priv:
    3c:45:7a:b1:...`);

setExample('openssl', 'CSR & Certificate Signing', 'openssl req -new -key private.key -out request.csr',
  `You are about to be asked to enter information that will be incorporated
into your certificate request.
-----
Country Name (2 letter code) [AU]: GB
State or Province Name (full name) [Some-State]: London
Locality Name (eg, city) []: City of London
Organization Name (eg, company) [Internet Widgits Pty Ltd]: Example Corp Ltd
Organizational Unit Name (eg, section) []: IT Security
Common Name (e.g. server FQDN or YOUR name) []: www.example.com
Email Address []: admin@example.com

# Verify the CSR:
openssl req -in request.csr -text -noout | grep -E "Subject:|DNS:"`);

setExample('openssl', 'Certificate Inspection', 'openssl x509 -in cert.crt -text -noout',
  `Certificate:
  Data:
    Version: 3 (0x2)
    Serial Number: 04:00:00:00:00:01:15:4b:5a:c3:94
    Signature Algorithm: sha256WithRSAEncryption
    Issuer: C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1
    Validity:
      Not Before: Jan  1 00:00:00 2025 GMT
      Not After : Jan  1 23:59:59 2026 GMT
    Subject: C=US, ST=California, O=Example Corp, CN=www.example.com
    Public Key Algorithm: rsaEncryption (2048 bit)
    X509v3 Subject Alternative Names:
      DNS:www.example.com, DNS:example.com`);

setExample('openssl', 'Certificate Inspection', 'openssl x509 -in cert.crt -noout -subject',
  `subject=C=US, ST=California, L=Los Angeles, O=Example Corp, CN=www.example.com`);

setExample('openssl', 'TLS Client Testing', 'openssl s_client -connect hostname:443',
  `CONNECTED(00000003)
depth=2 C=US, O=DigiCert Inc, CN=DigiCert Global Root CA
depth=1 C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1
depth=0 C=US, O=Example Corp, CN=www.example.com
verify return:1
---
Certificate chain
 0 s:CN=www.example.com
   i:CN=DigiCert TLS RSA SHA256 2020 CA1
---
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
---
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Verify return code: 0 (ok)`);

setExample('openssl', 'Verification & Matching', 'openssl verify -CAfile ca.crt cert.crt',
  `cert.crt: OK

# If chain is incomplete, use -untrusted for the intermediate:
openssl verify -CAfile root-ca.crt -untrusted intermediate.crt cert.crt
cert.crt: OK

# Common failure:
error 2 at 1 depth lookup: unable to get issuer certificate
# Fix: supply the full chain including intermediate CA`);

setExample('openssl', 'Hashing & HMAC', 'openssl dgst -sha256 <file>',
  `# Hash a file:
openssl dgst -sha256 firmware-v1.2.3.bin
SHA2-256(firmware-v1.2.3.bin)= e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Compare to published hash:
echo "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  firmware-v1.2.3.bin" | sha256sum -c
firmware-v1.2.3.bin: OK`);

setExample('openssl', 'Symmetric Encryption & Encoding', 'openssl base64 -in file.bin -out file.b64',
  `# Encode binary file to Base64:
openssl base64 -in secret.bin -out secret.b64
cat secret.b64
dGhpcyBpcyBhIHRlc3QgZmlsZSBmb3IgYmFzZTY0IGVuY29kaW5n

# Decode back to binary:
openssl base64 -d -in secret.b64 -out secret.bin`);

/* ─── ARUBA WLC ─── */
console.log('\n=== ARUBA WLC ===');
setExample('aruba_wlc', 'System & Status', 'show version',
  `Aruba Operating System Software.
ArubaOS (MODEL: 7240XM), Version 8.10.0.8
Copyright (c) 2002-2023, Aruba, a Hewlett Packard Enterprise company

Build time:    2023-09-12 10:22:15 PDT
Boot from:     System partition with newer image
Uptime:        47 days 3 hours 12 minutes 45 seconds
Management IP: 10.100.0.1
Serial Number: CV0012345
License:       PEFNG, RFP, PEFV, AP`);

setExample('aruba_wlc', 'AP Management', 'show ap database',
  `Name               Group  AP Type  IP Address     Status  Flags  Uptime
---------          -----  -------  ----------     ------  -----  ------
AP-Floor1-01       Corp   505      10.100.10.11   Up      --     5d 2h
AP-Floor1-02       Corp   505      10.100.10.12   Up      --     5d 1h
AP-Floor2-01       Corp   535      10.100.10.21   Up      --     5d 2h
AP-ROOF-01         Out    ANT      10.100.10.50   Down    --     --

Total APs: 4 | Up: 3 | Down: 1`);

setExample('aruba_wlc', 'Clients & Users', 'show user-table',
  `IP               MAC               Name          Role      AP           VLAN  Protocol
10.100.20.101    aa:bb:cc:dd:ee:01  jdoe@corp    employee  AP-Floor1-01  20   802.11ac-5GHz
10.100.20.102    aa:bb:cc:dd:ee:02  jsmith@corp  employee  AP-Floor2-01  20   802.11ax-5GHz
10.100.30.201    aa:bb:cc:ff:ee:01  --           guest     AP-Floor1-01  30   802.11n-2.4GHz

Num Users: 3`);

setExample('aruba_wlc', 'AP Management', 'show ap active',
  `Name             Clients  Band    Channel  Power  BSSID              SSID
-----------      -------  ----    -------  -----  -----------------  ----
AP-Floor1-01     12       5GHz    100+     18dBm  aa:bb:cc:11:22:33  Corp-WiFi
AP-Floor1-01     3        2.4GHz  6        15dBm  aa:bb:cc:11:22:34  Corp-WiFi
AP-Floor2-01     8        5GHz    36+      20dBm  aa:bb:cc:44:55:66  Corp-WiFi

Total APs: 2 (active)`);

setExample('aruba_wlc', 'Authentication / RADIUS', 'show aaa server',
  `Name               IP             Port  Type    Timeout  Retries  Hits   Fails
-----------        --             ----  ----    -------  -------  ----   -----
RADIUS-Primary     10.100.1.10    1812  RADIUS  5        3        4521   0
RADIUS-Secondary   10.100.1.11    1812  RADIUS  5        3        12     0
TACACS-Primary     10.100.1.20    49    TACACS+ 5        3        233    1`);

setExample('aruba_wlc', 'Logging & Diagnostics', 'show log all 50',
  `Jun 11 10:01:23  authmgr[1234]: <132043> <WARN>  User aa:bb:cc:dd:ee:ff@Corp-WiFi failed 802.1X: bad credentials
Jun 11 10:02:11  stm[5678]:     <130018> <INFO>  Station aa:bb:cc:11:22:33 associated to AP-Floor1-01 (5GHz)
Jun 11 10:03:45  sapd[9012]:    <125004> <WARN>  AP AP-Floor1-02 radio 0 channel changed 36→40 (ARM)
Jun 11 10:04:01  profmgr[3456]: <124001> <INFO>  Policy 'employee' applied to user jdoe@corp`);

setExample('aruba_wlc', 'RF / ARM / AirMatch', 'show ap arm rf-summary',
  `Name            Radio  Band    Channel  EIRP    Noise  Util%  Coverage  Interferers
-----------     -----  ----    -------  ----    -----  -----  --------  -----------
AP-Floor1-01    0      5GHz    100+     18dBm   -98    12%    93%       0
AP-Floor1-01    1      2.4GHz  6        15dBm   -91    34%    88%       2
AP-Floor2-01    0      5GHz    36+      20dBm   -96    8%     95%       0`);

setExample('aruba_wlc', 'Config Management', 'write memory',
  `Saving Configuration...
Configuration Saved.`);

setExample('aruba_wlc', 'System & Status', 'show running-config',
  `version 8.10
hostname AOS-Controller
ip default-gateway 10.100.0.254
interface mgmt
  ip address 10.100.0.1
  ip default-gateway 10.100.0.254
wlan ssid-profile Corp-WiFi
  essid "Corp-WiFi"
  opmode wpa3-aes-ccm-128
...
# (output truncated — pipe to file: show running-config > flash:running.cfg)`);

setExample('aruba_wlc', 'Firewall (PEF) & Roles', 'show acl',
  `ACL Name              Type     ACEs  Hits
-----------           ----     ----  ----
corp-employee-acl     session  12    1,234,567
guest-acl             session  4     89,012
denied-sources        session  2     156

Total ACLs: 3`);

/* ─── ARUBA AP ─── */
console.log('\n=== ARUBA AP ===');
setExample('aruba_ap', 'System & Status', 'show version',
  `Aruba Instant 8.11.2.2_87345
AP hostname: AP-Office-01
Model: AP-515
Serial Number: SG0012345
IP Address: 10.100.10.11
Uptime: 12 days, 4 hours, 22 minutes, 31 seconds
CPU Utilization: 18%
Memory Free: 423 MB / 512 MB`);

setExample('aruba_ap', 'System & Status', 'show summary',
  `System summary
--------------
Hostname: AP-Office-01  |  Model: AP-515  |  AOS Version: 8.11.2.2
IP: 10.100.10.11/24  |  Gateway: 10.100.10.1  |  Uptime: 12d 4h 22m
CPU: 18%  |  Memory: 17% used

Active SSIDs: 3 (Corp-WiFi, Corp-IoT, Corp-Guest)
Connected Clients: 24 (5GHz: 18, 2.4GHz: 6)`);

setExample('aruba_ap', 'Clients', 'show clients',
  `Client MAC         IP Address      SSID         Band    Ch   Assoc Time  RSSI   Rate
aabb.ccdd.ee01   10.100.20.101  Corp-WiFi    5GHz    100+  01h:22m     -62dBm  433Mbps
aabb.ccdd.ee02   10.100.20.102  Corp-WiFi    5GHz    36+   00h:15m     -71dBm  300Mbps
aabb.ccdd.ee03   10.100.20.103  Corp-Guest   2.4GHz  6     02h:01m     -68dBm  72Mbps
Total: 3 client(s)`);

setExample('aruba_ap', 'Network', 'show ip interface brief',
  `Interface    IP Address/Mask      Status  Protocol
bond0        10.100.10.11/24      up      up
wlan0_0      (Virtual AP 5GHz)    up      up
wlan0_1      (Virtual AP 2.4GHz)  up      up
lo           127.0.0.1/8          up      up`);

setExample('aruba_ap', 'Wireless / SSID', 'show network',
  `Name          ESSID         Band    Security   Clients  VLAN
-----------   -----         ----    --------   -------  ----
Corp-WiFi     Corp-WiFi     5GHz    WPA3-SAE   18       20
Corp-WiFi     Corp-WiFi     2.4GHz  WPA3-SAE   6        20
Corp-Guest    Corp-Guest    5GHz    WPA2-PSK   2        30
Corp-IoT      Corp-IoT      2.4GHz  WPA2-PSK   4        40`);

setExample('aruba_ap', 'Diagnostics', 'show log',
  `Jun 11 10:01:23 kernel: eth0: link is up at 1 Gbps
Jun 11 10:02:11 hostapd: wlan0: STA aa:bb:cc:dd:ee:01 IEEE 802.11: associated
Jun 11 10:02:12 hostapd: wlan0: STA aa:bb:cc:dd:ee:01 WPA: pairwise key handshake completed
Jun 11 10:03:45 hostapd: wlan0: STA aa:bb:cc:dd:ee:02 IEEE 802.11: disassociated
Jun 11 10:04:01 dhcpd: DHCPACK on 10.100.20.104 to aa:bb:cc:dd:ee:04`);

setExample('aruba_ap', 'Wireless / SSID', 'show ap radio-summary',
  `Radio  Band    Channel  EIRP    Noise   Clients  Util%
-----  ----    -------  ----    -----   -------  -----
0      5GHz    100+     20dBm   -98dBm  18       12%
1      2.4GHz  6        17dBm   -91dBm  6        28%`);

setExample('aruba_ap', 'Cluster (Instant)', 'show cluster',
  `Cluster Information:
  Cluster State: Active
  Conductor IP: 10.100.10.11 (this AP — acting as Virtual Controller)
  Member APs: 8
  Cluster SSID: Corp-WiFi
  Virtual Controller IP: 10.100.10.200`);

setExample('aruba_ap', 'Provisioning & Updates', 'show image version',
  `Primary image:   Aruba Instant 8.11.2.2 (active)
Secondary image: Aruba Instant 8.10.0.8
Boot from:       Primary
Auto-upgrade:    enabled (checks conductor daily at 02:00)`);

setExample('aruba_ap', 'Wireless / SSID', 'show ssid',
  `ESSID          Band    Clients  Type            BSSID
-----          ----    -------  ----            -----
Corp-WiFi      5GHz    18       infrastructure  aa:bb:cc:11:22:33
Corp-WiFi      2.4GHz  6        infrastructure  aa:bb:cc:11:22:34
Corp-Guest     5GHz    2        infrastructure  aa:bb:cc:11:22:35
Corp-IoT       2.4GHz  4        infrastructure  aa:bb:cc:11:22:36`);

/* ─── PROXMOX ─── */
console.log('\n=== PROXMOX ===');
setExample('proxmox', 'System & Status', 'pveversion -v',
  `proxmox-ve: 8.2-1 (running kernel: 6.8.4-2-pve)
pve-manager: 8.2.2 (running version: 8.2.2/d62fd3c2)
pve-kernel-6.8: 6.8.4-2
corosync: 3.1.7-pve3
libpve-access-control: 8.1.4
pve-cluster: 8.0.9
pve-container: 5.0.12
qemu-server: 8.2.2`);

setExample('proxmox', 'Cluster (pvecm)', 'pvecm nodes',
  `Membership information
-----------------------
Nodeid  Votes  Quorum_votes  Name
     1      1             1  pve01.lab.local (this node)
     2      1             0  pve02.lab.local
     3      1             0  pve03.lab.local
Total votes cast: 3`);

setExample('proxmox', 'Virtual Machines (qm)', 'qm config <VMID>',
  `# qm config 101
boot: order=scsi0;net0
cores: 4
cpu: x86-64-v2-AES
memory: 8192
name: web-server-01
net0: virtio=AA:BB:CC:DD:EE:01,bridge=vmbr0,firewall=1
ostype: l26
scsi0: ceph-pool:vm-101-disk-0,size=64G
scsihw: virtio-scsi-pci
sockets: 1`);

setExample('proxmox', 'Virtual Machines (qm)', 'qm start <VMID>',
  `# qm start 101
# (no output = success)

# Verify:
qm status 101
status: running`);

setExample('proxmox', 'LXC Containers (pct)', 'pct list',
  `VMID  Status   Name
200   running  web-proxy
201   running  monitoring
202   stopped  backup-agent`);

setExample('proxmox', 'Storage (pvesm)', 'pvesm status',
  `Name        Type     Status  Total        Used         Avail        %
local       dir      active  99.41G       8.56G        90.85G       8.61%
local-lvm   lvmthin  active  363.95G      19.59G       344.36G      5.38%
ceph-pool   rbd      active  10.00T       1.23T        8.77T        12.30%
backups     dir      active  1.82T        453.21G      1.38T        24.30%`);

setExample('proxmox', 'Backup & Restore (vzdump)', 'vzdump <VMID>',
  `# vzdump 101 --mode snapshot --compress zstd --storage backups
INFO: starting new backup job: vzdump 101
INFO: Starting Backup of VM 101 (qemu)
INFO: status = running
INFO: create snapshot: vzdump-snap-101
INFO: compressing backup
INFO: transferred 8.2 GB in 183 seconds (45 MB/s)
INFO: Finished Backup of VM 101 at 2026-06-11 02:03:03
INFO: Backup job finished successfully.`);

setExample('proxmox', 'High Availability', 'ha-manager status',
  `quorum OK

Resources:
  vm:101  (start)  master: pve01  state: started
  vm:102  (start)  master: pve02  state: started
  vm:103  (start)  master: pve01  state: fence`);

setExample('proxmox', 'ZFS', 'zpool list',
  `NAME    SIZE   ALLOC   FREE   CKPOINT  EXPANDSZ  FRAG   CAP   DEDUP  HEALTH  ALTROOT
rpool  1.81T   412G  1.41T        -         -       1%    22%   1.00x  ONLINE  -`);

setExample('proxmox', 'Logs & Diagnostics', 'journalctl -u pve-cluster -f',
  `Jun 11 10:00:01 pve01 pmxcfs[1234]: [status] notice: quorum gained
Jun 11 10:00:02 pve01 pmxcfs[1234]: [dcdb] notice: cfs_lock(pl): succeeded
Jun 11 10:00:05 pve01 pmxcfs[1234]: [status] notice: 3 nodes online
Jun 11 10:01:22 pve01 pmxcfs[1234]: [dfs] notice: nodelist changed`);

/* ─── ARUBA CX ─── */
console.log('\n=== ARUBA CX ===');
setExample('aruba_cx', 'System & Status', 'show system',
  `ArubaOS-CX (MODEL: 6300M), Version FL.10.11.1000
ROM: Bootstrap 01.04.0009
Serial ID: SG0012345
Base MAC Address: aa:bb:cc:dd:ee:00
Chassis: JL658A 6300M 24G PoE 4SFP56 Switch
Uptime: 47 days, 3 hours, 12 minutes
Fan status: Normal  |  Temperature: 42°C`);

setExample('aruba_cx', 'Interfaces', 'show interface 1/1/1',
  `Interface 1/1/1 is up
 Admin state is up
 Link state is up (20 seconds)
 MAC Address: aa:bb:cc:dd:ee:01
 Description: Uplink to Core SW
 Speed: 1000 Mb/s (forced), Duplex: Full, MTU: 9198
 VLAN mode: Access VLAN 10
 Input:  128,456 packets, 84,521,456 bytes, 0 errors, 0 dropped
 Output: 98,234 packets, 64,321,123 bytes, 0 errors, 0 dropped`);

setExample('aruba_cx', 'VLANs', 'show vlan summary',
  `Number of existing VLANs: 5

VLAN  Name         Status
----  ----         ------
1     DEFAULT_VLAN up
10    Management   up
20    Data         up
30    VoIP         up
100   Storage      up`);

setExample('aruba_cx', 'Spanning Tree', 'show spanning-tree',
  `Spanning tree status: Enabled
Root ID:
  Priority: 4096  |  Address: aa:bb:cc:00:00:01  |  This bridge is the root
  Hello Time: 2s  |  Max Age: 20s  |  Forward Delay: 15s

Port       Role  State       Cost  TC cnt  Prio
---------  ----  -----       ----  ------  ----
1/1/1      Desg  Forwarding  4     0       128
1/1/2      Desg  Forwarding  4     0       128
1/1/24     Root  Forwarding  4     0       128`);

setExample('aruba_cx', 'L3 Routing', 'show ip route summary',
  `Route Summary — default-vrf
--------------------------
Total routes: 28
  Connected:  5
  Static:     2
  OSPF:       18
  BGP:        3`);

setExample('aruba_cx', 'VSX / VSF', 'show vsx status',
  `VSX Operational State
----------------------
Role               : Primary
Config Sync State  : Peer and local in sync
ISL State          : Up
Keepalive State    : Alive
Peer Mgmt-MAC      : aa:bb:cc:dd:ee:ff
ISL Statistics:
  TX pkts: 1,234,567  TX bytes: 987,654,321
  RX pkts: 1,234,432  RX bytes: 987,432,109`);

setExample('aruba_cx', 'Logging & Telemetry', 'show events',
  `----------------------------------------------------------------------
Jun 11 10:00:01 | NTWK   | 1/1/1 is now operationally up at 1000Mbps full-duplex
Jun 11 10:00:02 | PORT   | Interface 1/1/1: Link state up
Jun 11 09:59:50 | NTWK   | 1/1/24 is now operationally down
Jun 11 09:59:48 | PORT   | Interface 1/1/24: Link state down (physical)`);

setExample('aruba_cx', 'Config Management', 'copy running-config startup-config',
  `Configuration copied successfully.`);

setExample('aruba_cx', 'ACLs', 'show access-list',
  `Name               Type  Seq  Action  Proto  Source       Destination   Port
-----------------  ----  ---  ------  -----  ------       -----------   ----
Block-Telnet       ipv4  10   Deny    TCP    any          any           23
Allow-HTTPS        ipv4  20   Permit  TCP    10.0.0.0/8   any           443
Allow-DNS          ipv4  30   Permit  UDP    10.0.0.0/8   8.8.8.8/32    53`);

setExample('aruba_cx', 'Logging & Telemetry', 'show ntp status',
  `NTP is enabled
Synchronization status: synchronized
Stratum: 3  |  Reference: 10.100.0.2 (upstream NTP server)
Poll interval: 64 seconds
Last successful sync: Jun 11 09:58:12`);

/* ─── AWS ─── */
console.log('\n=== AWS ===');
setExample('aws', 'EC2', 'aws ec2 describe-volumes',
  `{
  "Volumes": [{
    "VolumeId": "vol-0a1b2c3d4e5f67890",
    "Size": 100,
    "VolumeType": "gp3",
    "State": "in-use",
    "Iops": 3000,
    "Throughput": 125,
    "Encrypted": true,
    "AvailabilityZone": "eu-west-1a",
    "Attachments": [{"InstanceId": "i-0a1b2c3d4e5f67890", "Device": "/dev/xvda", "State": "attached"}]
  }]
}`);

setExample('aws', 'EC2', 'aws ec2 describe-security-groups',
  `{
  "SecurityGroups": [{
    "GroupId": "sg-0a1b2c3d4e5f67890",
    "GroupName": "web-servers",
    "Description": "Allow HTTP/HTTPS inbound",
    "VpcId": "vpc-0a1b2c3d4e5f67890",
    "IpPermissions": [
      {"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]},
      {"IpProtocol": "tcp", "FromPort": 80,  "ToPort": 80,  "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}
    ]
  }]
}`);

setExample('aws', 'EC2', 'aws ec2 describe-vpcs',
  `{
  "Vpcs": [{
    "VpcId": "vpc-0a1b2c3d4e5f67890",
    "CidrBlock": "10.0.0.0/16",
    "State": "available",
    "IsDefault": false,
    "Tags": [{"Key": "Name", "Value": "production-vpc"}]
  }]
}`);

setExample('aws', 'CloudWatch', 'aws cloudwatch describe-alarms',
  `{
  "MetricAlarms": [{
    "AlarmName": "HighCPU-WebServer",
    "AlarmDescription": "CPU > 80% for 5 minutes",
    "StateValue": "OK",
    "MetricName": "CPUUtilization",
    "Namespace": "AWS/EC2",
    "Statistic": "Average",
    "Period": 300,
    "Threshold": 80.0,
    "ComparisonOperator": "GreaterThanThreshold",
    "TreatMissingData": "notBreaching"
  }]
}`);

setExample('aws', 'S3', 'aws s3 ls s3://<bucket>',
  `# aws s3 ls s3://my-company-backups
2026-06-01 02:14:33   1456789123  backup-2026-06-01.tar.gz
2026-06-08 02:11:22   1478234512  backup-2026-06-08.tar.gz
2026-06-10 02:09:45         4096  logs/
2026-06-11 02:10:11   1489234123  backup-2026-06-11.tar.gz

# Recursive listing with sizes:
aws s3 ls s3://my-company-backups --recursive --human-readable --summarize`);

setExample('aws', 'IAM', 'aws iam get-user',
  `{
  "User": {
    "Path": "/",
    "UserName": "jdoe",
    "UserId": "AIDAIOSFODNN7EXAMPLE",
    "Arn": "arn:aws:iam::123456789012:user/jdoe",
    "CreateDate": "2023-01-15T10:00:00+00:00",
    "PasswordLastUsed": "2026-06-10T14:23:00+00:00"
  }
}`);

setExample('aws', 'VPC', 'aws ec2 describe-flow-logs --filter Name=resource-id,Values=<vpc-id>',
  `{
  "FlowLogs": [{
    "FlowLogId": "fl-0a1b2c3d4e5f67890",
    "FlowLogStatus": "ACTIVE",
    "ResourceId": "vpc-0a1b2c3d4e5f67890",
    "TrafficType": "ALL",
    "LogDestinationType": "cloud-watch-logs",
    "LogGroupName": "/aws/vpc/flowlogs",
    "DeliverLogsStatus": "SUCCESS"
  }]
}`);

setExample('aws', 'CloudWatch', 'aws cloudwatch get-metric-statistics',
  `# Get average CPU for an EC2 instance over the last hour:
aws cloudwatch get-metric-statistics \\
  --namespace AWS/EC2 \\
  --metric-name CPUUtilization \\
  --dimensions Name=InstanceId,Value=i-0a1b2c3d4e5f67890 \\
  --start-time 2026-06-11T09:00:00Z --end-time 2026-06-11T10:00:00Z \\
  --period 300 --statistics Average

Output: {"Datapoints": [{"Timestamp": "2026-06-11T09:00:00Z", "Average": 4.3, "Unit": "Percent"}]}`);

setExample('aws', 'S3', 'aws s3 sync <src> <dst>',
  `# Sync local directory to S3 (uploads only new/changed files):
aws s3 sync ./dist s3://my-company-website/
upload: dist/index.html to s3://my-company-website/index.html
upload: dist/app.js to s3://my-company-website/app.js

# Sync with delete (remove objects from S3 not present in source):
aws s3 sync ./dist s3://my-company-website/ --delete`);

setExample('aws', 'IAM', 'aws iam list-users --query "Users[].UserName"',
  `[
  "admin",
  "ci-deploy",
  "jdoe",
  "jsmith",
  "monitoring-svc"
]`);

/* ─── WINDOWS ─── */
console.log('\n=== WINDOWS ===');
setExample('windows', 'System', 'systeminfo',
  `Host Name:                 DESKTOP-ABC123
OS Name:                   Microsoft Windows 11 Pro
OS Version:                10.0.26100 N/A Build 26100
System Type:               x64-based PC
Processor(s):              Intel(R) Core(TM) i7-1365U @ 1.80GHz
Total Physical Memory:     16,384 MB
Available Physical Memory: 6,432 MB
Windows Directory:         C:\\Windows
Domain:                    CORP.LOCAL
Logon Server:              \\\\DC01`);

setExample('windows', 'Networking', 'ipconfig /flushdns',
  `Windows IP Configuration

Successfully flushed the DNS Resolver Cache.`);

setExample('windows', 'Networking', 'netstat -s',
  `IPv4 Statistics
  Packets Received        = 1,234,567
  Received Packets Discarded = 0
  Received Packets Delivered = 1,234,567
  Output Requests         = 987,654
TCP Statistics for IPv4
  Active Opens            = 4,321
  Passive Opens           = 1,234
  Connection Failures     = 3
  Connections Reset       = 89
  Segments Received       = 2,345,678
  Segments Sent Out       = 2,123,456`);

setExample('windows', 'Processes', 'taskkill /PID <pid> /F',
  `# Kill by PID:
taskkill /PID 4321 /F
SUCCESS: The process with PID 4321 has been terminated.

# Kill by name:
taskkill /IM notepad.exe /F
SUCCESS: The process "notepad.exe" with PID 5678 has been terminated.`);

setExample('windows', 'Processes', 'Get-Process',
  `Handles  NPM(K)  PM(K)    WS(K)    CPU(s)    Id  SI ProcessName
-------  ------  -----    -----    ------    --  -- -----------
   1234     128  98432   102144   312.45  1234   1  chrome
    567      32  12456    18234    12.23  5678   1  explorer
    234      16   4096     8192     2.45  9012   0  svchost`);

setExample('windows', 'Storage', 'Get-Volume',
  `DriveLetter  FriendlyName  FileSystemType  DriveType  HealthStatus  SizeRemaining       Size
-----------  ------------  --------------  ---------  ------------  -------------       ----
C                          NTFS            Fixed      Healthy            87.4 GB   476.84 GB
D            Data          NTFS            Fixed      Healthy           234.6 GB   931.51 GB
E            USB-Backup    FAT32           Removable  Healthy            12.3 GB    14.91 GB`);

setExample('windows', 'Storage', 'Get-PhysicalDisk',
  `Number FriendlyName               SerialNumber     MediaType HealthStatus Size
------ ------------               ------------     --------- ------------ ----
     0 Samsung SSD 990 Pro 512GB  S6XPNX0T123456  SSD       Healthy      476.94 GB
     1 Seagate Barracuda 2TB      WCT0A123456789  HDD       Healthy        1.82 TB`);

setExample('windows', 'System', 'wmic os get caption',
  `Caption
Microsoft Windows 11 Pro`);

setExample('windows', 'Networking', 'ipconfig /registerdns',
  `Windows IP Configuration

Registration of the DNS resource records for all adapters of this computer has been initiated. Any errors will be reported in the Event Viewer in 15 minutes.`);

setExample('windows', 'Storage', 'Get-Disk',
  `Number Friendly Name                     SerialNumber    HealthStatus OperationalStatus Total Size Partition Style
------ -------------                     ------------    ------------ ----------------- ---------- ---------------
     0 Samsung SSD 990 Pro 512GB         S6XPNX0T123456 Healthy      Online            476.94 GB  GPT
     1 Seagate Barracuda 2TB             WCT0A123456789  Healthy      Online              1.82 TB  GPT`);

/* ─── ESXI ─── */
console.log('\n=== ESXI ===');
setExample('esxi', 'System', 'esxcli system hostname get',
  `   Domain Name: corp.local
   Fully Qualified Domain Name: esxi01.corp.local
   Host Name: esxi01`);

setExample('esxi', 'Networking', 'esxcli network nic get -n <nic>',
  `# esxcli network nic get -n vmnic0
   Advertised Auto Negotiation: true
   Auto Negotiation: true
   Cable Type: Twisted Pair
   Driver Info:
      Bus Info: 0000:01:00.0
      Driver: igb
      Firmware Version: 1.67
      Version: 5.4.0.0
   Link Detected: true
   Link Status: Up
   Name: vmnic0
   Speed: 1000`);

setExample('esxi', 'Storage', 'esxcli storage filesystem list',
  `Mount Point                                        Volume Name  UUID                                  Mounted  Type    Size         Free
-------------------------------------------------  -----------  ------------------------------------  -------  ------  --------     --------
/vmfs/volumes/6482f123-ab123456-cdef-aabbccddeeff  datastore1   6482f123-ab123456-cdef-aabbccddeeff  true     VMFS-6  2.18 TB      987.65 GB
/vmfs/volumes/6482f124-cd234567-ef01-aabbccddeeff  SSD-store    6482f124-cd234567-ef01-aabbccddeeff  true     VMFS-6  930.39 GB    654.32 GB`);

setExample('esxi', 'VM Management', 'esxcli vm process list',
  `web-server-01
   World ID: 123456
   Process ID: 0
   VMX Cartel ID: 123455
   Display Name: web-server-01
   Config File: /vmfs/volumes/datastore1/web-server-01/web-server-01.vmx

db-server-01
   World ID: 234567
   Display Name: db-server-01
   Config File: /vmfs/volumes/datastore1/db-server-01/db-server-01.vmx`);

setExample('esxi', 'Diagnostics', 'esxcli system stats uptime get',
  `4082345
# Value is in seconds. Convert: 4082345 ÷ 86400 = ~47.2 days
# Quick calculation: esxcli system stats uptime get | awk '{printf "%dd %dh %dm\n",$1/86400,$1%86400/3600,$1%3600/60}'`);

setExample('esxi', 'Networking', 'esxcli network ip interface ipv4 get',
  `Name  IPv4 Address    IPv4 Netmask     IPv4 Broadcast  Address Type  Gateway       DHCP DNS
----  ----------------  ---------------  ---------------  ------------  ----------    --------
vmk0  10.100.0.10       255.255.255.0    10.100.0.255     STATIC        10.100.0.254  false
vmk1  10.100.100.10     255.255.255.0    10.100.100.255   STATIC        0.0.0.0       false`);

setExample('esxi', 'Storage', 'esxcli storage core device list',
  `naa.600508b1001c4dab1890c94a5d39bc12
   Display Name: HP LOGICAL VOLUME (naa.600508b1001c4dab1890c94a5d39bc12)
   Size: 2097152 MB
   Device Type: Direct-Access
   Multipath Plugin: NMP
   Vendor: HP  |  Model: LOGICAL VOLUME  |  Revision: 4.68
   Status: on`);

setExample('esxi', 'System', 'esxcli system maintenanceMode get',
  `Disabled

# To enable maintenance mode before patching:
esxcli system maintenanceMode set --enable true
# To disable after patching:
esxcli system maintenanceMode set --enable false`);

setExample('esxi', 'Networking', 'esxcli network ip interface ipv6 get',
  `Name  IPv6 Address                Type       Status
----  ----                        --------   ------
vmk0  fe80::aabb:ccff:fedd:ee01   LINKLOCAL  preferred
vmk0  2001:db8:100::10            STATIC     preferred`);

setExample('esxi', 'Storage', 'esxcli storage core device stats get -d <device>',
  `# esxcli storage core device stats get -d naa.600508b1001c4dab1890c94a5d39bc12
   Device: naa.600508b1001c4dab1890c94a5d39bc12
   Completions: 12,345,678
   Read Completions: 8,234,567  |  Read Megabytes: 456,789
   Write Completions: 4,111,111 |  Write Megabytes: 234,567
   Resets: 0  |  Aborts: 0  |  Errors: 0`);

/* ─── NETSCALERSDX ─── */
console.log('\n=== NETSCALERSDX ===');
setExample('netscalersdx', 'System', 'show system',
  `System Information:
  SDX Version:   14.1-38.53
  Management IP: 10.100.0.100
  Platform:      SDX 22100
  Serial Number: HX1234567890
  Total Memory:  128 GB  |  Free Memory: 89 GB
  CPU Cores:     24
  System Uptime: 123 days 4 hours 12 minutes`);

setExample('netscalersdx', 'System', 'show system version',
  `SDX Version: 14.1-38.53
Build Date: Nov 15 2023  |  Build Time: 14:22:11
Kernel: 4.14.131-centos-pvops
Xen Hypervisor: 4.14.2`);

setExample('netscalersdx', 'Chassis', 'show chassis',
  `Chassis Information:
  Chassis Type:        SDX 22100
  Chassis Serial:      HX1234567890
  Total Slots:         4
  Power Redundancy:    1+1 (both PSUs OK)
  Cooling Status:      OK
  Chassis Temperature: 38°C
  Management Card:     Slot 1 (Active)`);

setExample('netscalersdx', 'VPX', 'show vpx',
  `Name           VPX ID  State    CPU   Memory   Throughput  Mgmt IP
-----------    ------  -----    ---   ------   ----------  -------
NS-VPX-01      1       Running  4     8192 MB  1000 Mbps   10.100.1.10
NS-VPX-02      2       Running  4     8192 MB  1000 Mbps   10.100.1.11
NS-VPX-03      3       Stopped  0     --       --          10.100.1.12

Total VPX instances: 3`);

setExample('netscalersdx', 'VM Management', 'show vm',
  `Name             ID   Type        State    CPU   Memory
-----------      ---  ------      -----    ---   ------
NS-VPX-01        1    NetScaler   running  4     8192 MB
NS-VPX-02        2    NetScaler   running  4     8192 MB
NS-VPX-03        3    NetScaler   stopped  --    --
XenServer-Mgmt   0    DOM0        running  4     16384 MB`);

setExample('netscalersdx', 'XenServer', 'show xenserver version',
  `XenServer Version: 8.2.3
Build: 203498c
Xen Version: 4.14.2
Kernel: 4.14.131-centos-pvops
License: XenServer Enterprise`);

setExample('netscalersdx', 'HA', 'show ha',
  `HA Configuration:
  HA Status:      ENABLED
  HA State:       Primary
  Partner Node:   10.100.0.101
  Partner State:  Secondary
  HA Heartbeat:   Active (last received: 2s ago)
  Failover Count: 2
  Last Failover:  2026-03-15 03:22:11`);

setExample('netscalersdx', 'Storage', 'show storage disks',
  `Disk  Type  Size    Status      RAID Level  Array
----  ----  ----    ------      ----------  -----
0     SSD   960 GB  Online      RAID-1      Array-0
1     SSD   960 GB  Online      RAID-1      Array-0
2     HDD   8 TB    Online      RAID-5      Array-1
3     HDD   8 TB    Online      RAID-5      Array-1
4     HDD   8 TB    Online      RAID-5      Array-1
5     HDD   --      Hot-Spare   --          --`);

setExample('netscalersdx', 'Diagnostics', 'show logs',
  `Jun 11 10:00:01 sdx01 sshd[1234]: Accepted publickey for admin from 10.0.0.5
Jun 11 10:01:22 sdx01 vpx-manager: VPX NS-VPX-01 health check OK (CPU:18% Mem:45%)
Jun 11 10:02:34 sdx01 vpx-manager: VPX NS-VPX-02 health check OK (CPU:12% Mem:43%)
Jun 11 10:03:11 sdx01 xen: xl create: VM NS-VPX-03 failed to start: insufficient resources`);

setExample('netscalersdx', 'Open vSwitch', 'ovs-vsctl show',
  `f47a3c89-1234-5678-abcd-ef0123456789
    Bridge "xenbr0"
        Port "xenbr0"
            Interface "xenbr0"
                type: internal
        Port "eth0"
            Interface "eth0"
        Port "vif1.0"
            Interface "vif1.0"
    Bridge "xenbr1"
        Port "xenbr1"
            Interface "xenbr1"
                type: internal
        Port "eth1"
            Interface "eth1"`);

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — 10 brand-new commands
═══════════════════════════════════════════════════════════════ */

console.log('\n=== NEW COMMANDS ===');

// 1. Cisco IOS — NAT verbose
addCommand('ciscoios', 'NAT', {
  cmd: 'show ip nat translations verbose',
  desc: 'Detailed NAT translation table showing hit counts, timeout values, and mapping type for each active translation',
  type: 'show',
  flagged: false,
  example: `Pro  Inside global         Inside local          Outside local         Outside global
tcp  203.0.113.1:1024      10.0.0.101:1024       8.8.8.8:53            8.8.8.8:53
     create 00:00:52, use 00:00:01, timeout 00:01:00
     Map-Id(In): 1, entry-id: 0x97, use_count: 1
udp  203.0.113.1:2048      10.0.0.102:2048       8.8.4.4:53            8.8.4.4:53
     create 00:00:05, use 00:00:05, timeout 00:05:00

Tip: compare output of "show ip nat translations" (summary) vs verbose — verbose shows
age and hit-count which helps identify stale or unused translations.`
});

// 2. Cisco IOS — IP SLA statistics
addCommand('ciscoios', 'Troubleshooting', {
  cmd: 'show ip sla statistics',
  desc: 'Display IP SLA probe results including RTT, jitter, packet loss, and success/failure counts for availability monitoring',
  type: 'show',
  flagged: false,
  example: `IPSLAs Latest Operation Statistics
IPSLA operation id: 1
        Latest RTT: 4 milliseconds
Latest operation start time: 10:01:22 UTC Jun 11 2026
Latest operation return code: OK
Number of successes: 1440
Number of failures: 2
Operation time to live: Forever

IPSLA operation id: 2  (jitter probe to VoIP gateway)
        Latest RTT: 8 milliseconds
        SD Jitter: 2ms  DS Jitter: 3ms
        Packet Loss (SD/DS): 0/0
Latest operation return code: OK`
});

// 3. Cisco IOS — Object tracking
addCommand('ciscoios', 'Management', {
  cmd: 'show track',
  desc: 'Display object tracking status — used with IP SLA, HSRP, and static route conditional installation',
  type: 'show',
  flagged: false,
  example: `Track 1
  IP SLA 1 reachability
  Reachability is Up
    1 change, last change 3d12h
  Latest operation return code: OK
  Latest RTT (millisecs) 4

Track 2
  IP SLA 2 reachability
  Reachability is Down
    3 changes, last change 00:02:34
  Latest operation return code: Timeout`
});

// 4. Nexus — System resources
addCommand('nexus', 'System & Status', {
  cmd: 'show system resources',
  desc: 'Real-time CPU load, memory utilization, and top process list for the Nexus switch supervisor',
  type: 'show',
  flagged: false,
  example: `Load average:   1 minute: 0.24   5 minutes: 0.31   15 minutes: 0.28

Processes   : 489 total, 1 running
CPU states  : 4.82% user,  1.44% kernel,  93.73% idle
Memory usage: 14366044K total, 8903408K used, 5462636K free
Kernel vmalloc: 0K

PID    %CPU    %MEM    COMMAND
4321   1.23    2.10    bgp
1234   0.82    1.55    ospf
5678   0.21    0.98    mrib`
});

// 5. Linux — conntrack
addCommand('linux', 'Networking', {
  cmd: 'conntrack -L',
  desc: 'List all active entries in the kernel connection tracking table — shows NAT translations, states, and timeouts for stateful firewall rules',
  type: 'show',
  flagged: false,
  example: `# Requires: apt install conntrack  /  yum install conntrack-tools
# Must run as root

tcp      6  86398 ESTABLISHED src=10.0.0.100 dst=8.8.8.8 sport=54321 dport=443 src=8.8.8.8 dst=203.0.113.1 sport=443 dport=54321 [ASSURED]
tcp      6  52    TIME_WAIT   src=10.0.0.101 dst=1.1.1.1 sport=55000 dport=53  src=1.1.1.1 dst=203.0.113.1 sport=53  dport=55000 [UNREPLIED]
udp      17 29    src=10.0.0.100 dst=8.8.8.8 sport=62543 dport=53   src=8.8.8.8 dst=203.0.113.1 sport=53  dport=62543 [ASSURED]
conntrack v1.4.7 (conntrack-tools): 1234 flow entries have been shown.

# Count entries: conntrack -C
# Delete: conntrack -D -s 10.0.0.100`
});

// 6. Linux — lsns (list namespaces)
addCommand('linux', 'Networking', {
  cmd: 'lsns -t net',
  desc: 'List all active Linux network namespaces — useful for inspecting container and VM network isolation (Docker, Podman, LXC, veth pairs)',
  type: 'show',
  flagged: false,
  example: `# List only network namespaces:
lsns -t net

        NS TYPE NPROCS   PID USER    COMMAND
4026531992 net     234     1 root    /sbin/init
4026532189 net       3  1234 root    /pause   (Kubernetes pod sandbox)
4026532256 net       8  5678 1000    nginx: master process nginx

# Enter a namespace (e.g. Docker container):
nsenter -t 5678 -n ip addr
# Shows the container's interface — not the host's`
});

// 7. NetScaler SDX — show interface
addCommand('netscalersdx', 'Networking Internals', {
  cmd: 'show interface',
  desc: 'Display all physical network interfaces on the SDX appliance with link state, speed, and traffic statistics',
  type: 'show',
  flagged: false,
  example: `Interface    Status  Speed    Duplex  MTU    RX Pkts      TX Pkts      Errors
---------    ------  -----    ------  ---    --------     --------     ------
eth0         UP      10Gbps   Full    9000   1,234,567    987,654      0
eth1         UP      10Gbps   Full    9000   876,543      654,321      0
eth2         DOWN    --       --      1500   0            0            0
eth3         UP      1Gbps    Full    1500   12,345       9,876        0
bond0        UP      20Gbps   Full    9000   2,111,110    1,641,975    0  (LACP: eth0+eth1)`
});

// 8. AWS — ELB
addCommand('aws', 'VPC', {
  cmd: 'aws elbv2 describe-load-balancers',
  desc: 'List all Application Load Balancers and Network Load Balancers showing DNS name, state, VPC, and availability zones',
  type: 'show',
  flagged: false,
  example: `{
  "LoadBalancers": [{
    "LoadBalancerArn": "arn:aws:elasticloadbalancing:eu-west-1:123456789012:loadbalancer/app/prod-alb/abc123",
    "DNSName": "prod-alb-1234567890.eu-west-1.elb.amazonaws.com",
    "LoadBalancerName": "prod-alb",
    "Type": "application",
    "Scheme": "internet-facing",
    "State": {"Code": "active"},
    "VpcId": "vpc-0a1b2c3d4e5f67890",
    "AvailabilityZones": [
      {"ZoneName": "eu-west-1a", "SubnetId": "subnet-0a1b2c3d4e5f67890"},
      {"ZoneName": "eu-west-1b", "SubnetId": "subnet-1a2b3c4d5e6f78901"}
    ]
  }]
}`
});

// 9. AWS — RDS
addCommand('aws', 'EC2', {
  cmd: 'aws rds describe-db-instances',
  desc: 'List RDS database instances with endpoint, engine version, instance class, allocated storage, and availability status',
  type: 'show',
  flagged: false,
  example: `{
  "DBInstances": [{
    "DBInstanceIdentifier": "prod-mysql",
    "DBInstanceClass": "db.r6g.large",
    "Engine": "mysql",
    "EngineVersion": "8.0.36",
    "DBInstanceStatus": "available",
    "Endpoint": {
      "Address": "prod-mysql.abc123xyz.eu-west-1.rds.amazonaws.com",
      "Port": 3306
    },
    "AllocatedStorage": 500,
    "StorageType": "gp3",
    "MultiAZ": true,
    "BackupRetentionPeriod": 7,
    "StorageEncrypted": true
  }]
}`
});

// 10. Aruba CX — CDP
addCommand('aruba_cx', 'Diagnostics', {
  cmd: 'show cdp neighbors detail',
  desc: 'Show detailed Cisco Discovery Protocol neighbour information including platform, IOS version, capabilities, and interface',
  type: 'show',
  flagged: false,
  example: `-------------------------
Device ID: CORE-SW-01.corp.local
Entry address(es):
  IP address: 10.100.0.1
Platform: Cisco IOS Software, Catalyst 9300
Interface: 1/1/24, Port ID (outgoing port): GigabitEthernet1/0/24
Holdtime: 148 sec
Version: Cisco IOS XE Software, Version 17.09.04a
Capabilities: Switch IGMP
Duplex: full  |  MTU: 1500

Device ID: AP-Floor1-01
Entry address(es):
  IP address: 10.100.10.11
Platform: Aruba AP-515
Interface: 1/1/5, Port ID (outgoing port): eth0
Capabilities: Host`
});

/* ─────────────────────────────────────────────────────────────
   SAVE
───────────────────────────────────────────────────────────── */
data.updatedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log('\n✓ Saved to', FILE);
