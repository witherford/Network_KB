#!/usr/bin/env node
// One-shot script: add 10 new commands and fill missing desc/examples across 9 sections
import { readFileSync, writeFileSync } from 'fs';

const path = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(path, 'utf8'));
const P = data.platforms;

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — 10 NEW COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

// 1. Linux – Networking: networkctl list
P.linux.sections['Networking'].push({
  cmd: 'networkctl list',
  desc: 'List all network links managed by systemd-networkd with their type, operational state, and setup state',
  type: 'show',
  flagged: false,
  example: 'IDX LINK    TYPE     OPERATIONAL SETUP     \n  1 lo      loopback carrier     unmanaged \n  2 eth0    ether    routable    configured\n  3 wlan0   wlan     dormant     configuring\n\n3 links listed.'
});

// 2. Cisco ASA – NAT: clear nat counters
P.ciscoasa.sections['NAT'].push({
  cmd: 'clear nat counters',
  desc: 'Reset NAT translation hit counters to zero — useful before testing a new NAT rule to confirm it is being matched',
  type: 'config',
  flagged: false,
  example: '! Run immediately before testing, then verify with:\nshow nat detail\n! Look for non-zero "translate_hits" to confirm rule is matching'
});

// 3. AWS – VPC: describe VPC peering connections
P.aws.sections['VPC'].push({
  cmd: 'aws ec2 describe-vpc-peering-connections --filters Name=status-code,Values=active --query "VpcPeeringConnections[].[VpcPeeringConnectionId,RequesterVpcInfo.VpcId,AccepterVpcInfo.VpcId,Status.Code]" --output table',
  desc: 'List all active VPC peering connections showing the peering ID, requester VPC, accepter VPC, and current status',
  type: 'show',
  flagged: false,
  example: '-------------------------------------------------------------------\n|           DescribeVpcPeeringConnections                          |\n+-------------------+---------------+---------------+-----------+\n| pcx-0a1b2c3d4e5f | vpc-11111111  | vpc-22222222  | active    |\n| pcx-0b2c3d4e5f6a | vpc-33333333  | vpc-44444444  | active    |\n+-------------------+---------------+---------------+-----------+'
});

// 4. Nexus – Security & AAA: show tacacs-server statistics
P.nexus.sections['Security & AAA'].push({
  cmd: 'show tacacs-server statistics',
  desc: 'Display per-server TACACS+ authentication/authorisation/accounting request counts, success/fail totals, and round-trip time statistics',
  type: 'show',
  flagged: false,
  example: 'Server: 10.10.10.50\n  Authentication requests: 1248   successes: 1240   failures: 8\n  Authorization  requests:  623   successes:  623   failures: 0\n  Accounting     requests:  623   successes:  623   failures: 0\n  Average RTT: 4 ms   Max RTT: 18 ms'
});

// 5. Aruba WLC – RF / ARM / AirMatch: show ap radio-database
P.aruba_wlc.sections['RF / ARM / AirMatch'].push({
  cmd: 'show ap radio-database ap-name <name>',
  desc: 'Display the ARM radio database entry for a specific AP — includes current channel, transmit power, neighbour AP list, and interference scores used by ARM',
  type: 'show',
  flagged: false,
  example: 'AP: office-ap-01  Radio: 0 (2.4 GHz)\n  Channel: 6   Tx Power: 15 dBm   Coverage Index: 3\n  Neighbour count: 8   Co-channel APs: 2\n  Interference score: 14  Noise floor: -92 dBm\nAP: office-ap-01  Radio: 1 (5 GHz)\n  Channel: 36  Tx Power: 18 dBm   Coverage Index: 2\n  Neighbour count: 4   Co-channel APs: 0\n  Interference score: 2   Noise floor: -95 dBm'
});

// 6. Palo Alto – Packet Diagnostics: show packet-diag setting
P.paloalto.sections['Packet Diagnostics'].push({
  cmd: 'debug dataplane packet-diag show setting',
  desc: 'Display the currently configured packet-diag filter criteria and capture stage settings so you can confirm the filter is active before starting a capture',
  type: 'show',
  flagged: false,
  example: '  Packet filter:\n    src-ip    : 10.1.1.100\n    dst-ip    : 10.2.2.200\n    src-port  : any\n    dst-port  : any\n    proto     : any\n    non-ip    : no\n  Stages captured:\n    receive   : enabled  → file: /var/log/pan/rx.pcap\n    drop      : enabled  → file: /var/log/pan/drop.pcap\n    transmit  : disabled'
});

// 7. ESXi – Diagnostics: esxcli hardware platform get
P.esxi.sections['Diagnostics'].push({
  cmd: 'esxcli hardware platform get',
  desc: 'Display hardware platform details including vendor, product name, serial number, BIOS version, and UUID — useful for asset tracking and support cases',
  type: 'show',
  flagged: false,
  example: 'Platform Information\n  UUID: 00000000-1111-2222-3333-444444444444\n  Product Name: ProLiant DL380 Gen10\n  Vendor Name: HPE\n  Serial Number: CZ12345678\n  IPMI Supported: true\n  BIOS Version: U30\n  BIOS Release Date: 11/05/2023\n  BIOS Build Date: 11/05/2023'
});

// 8. Proxmox – High Availability: ha-manager status detail
P.proxmox.sections['High Availability'].push({
  cmd: 'ha-manager status detail',
  desc: 'Show detailed HA manager state for every managed resource — includes current node placement, goal state, error count, and last state-change reason',
  type: 'show',
  flagged: false,
  example: 'quorum OK\nmaster node1 (active, max_worker: 4)\n\nService vm:100:\n  state: started\n  node: node1\n  group: (none)\n  error_count: 0\n  crm_state: started\n\nService vm:101:\n  state: started\n  node: node2\n  group: production\n  error_count: 0\n  crm_state: started'
});

// 9. Cisco IOS XE Router – MPLS / L3VPN: show ip cef vrf
P.ciscoiosxe_router.sections['MPLS / L3VPN'].push({
  cmd: 'show ip cef vrf <vrf> <prefix>',
  desc: 'Display the CEF (Cisco Express Forwarding) entry for a specific prefix inside a VRF — shows next-hop, outgoing interface, and MPLS label stack',
  type: 'show',
  flagged: false,
  example: '> show ip cef vrf TENANT-A 10.10.10.0/24\n10.10.10.0/24, epoch 0\n  local label info: global/2003\n  nexthop 10.1.1.2 GigabitEthernet0/0/1 label [101 24007]\n  nexthop 10.1.1.6 GigabitEthernet0/0/2 label [201 24007]'
});

// 10. Palo Alto – SD-WAN: test sdwan link-path
P.paloalto.sections['SD-WAN'].push({
  cmd: 'test sdwan link-path vpn-name <vpn> id <id>',
  desc: 'Trigger an on-demand SD-WAN path-monitor probe on a specific VPN link and display the latest latency, jitter, and packet-loss measurements',
  type: 'show',
  flagged: false,
  example: 'SD-WAN path monitor test for VPN: HQ-Branch01  Link ID: 1\n  Local:  198.51.100.1  Remote: 203.0.113.5\n  Latency:      12 ms\n  Jitter:        2 ms\n  Packet Loss:   0 %\n  Status: UP   Threshold: latency ≤ 100ms  jitter ≤ 30ms  loss ≤ 5%'
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — UPDATE 10 COMMANDS PER SECTION (where desc/example missing)
// ─────────────────────────────────────────────────────────────────────────────

// Helper: patch a command by its cmd string
function patch(sectionArr, cmdStr, updates) {
  const entry = sectionArr.find(c => c.cmd === cmdStr);
  if (!entry) { console.warn(`WARN: cmd not found: ${cmdStr}`); return; }
  Object.assign(entry, updates);
}

// ── Section A: OpenSSL – Key Generation (10 missing examples) ───────────────
{
  const sec = P.openssl.sections['Key Generation'];

  patch(sec, 'openssl ecparam -name secp384r1 -genkey -noout -out ec.key', {
    example: '(P-384 / secp384r1 private key written to ec.key — no console output on success)\n\nVerify with:\n  openssl pkey -in ec.key -noout -text | head -5\n  Private-Key: (384 bit)\n  ASN1 OID: secp384r1\n  NIST CURVE: P-384'
  });

  patch(sec, 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key', {
    desc: 'Generate a 3072-bit RSA private key using the modern genpkey interface — NIST recommended minimum past 2030',
    example: '...++++++++++++++++++++++++++++++++++++++++++++++\n...++++++++++++++++++++++++++++++++++++++++++++++++++\n(3072-bit RSA key written to rsa3072.key)'
  });

  patch(sec, 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out rsa4096.key', {
    desc: 'Generate a passphrase-protected 4096-bit RSA key encrypted with AES-256-CBC using the unified genpkey subcommand',
    example: 'Enter PEM pass phrase:\nVerifying - Enter PEM pass phrase:\n(Encrypted RSA-4096 key written to rsa4096enc.key)'
  });

  patch(sec, 'openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-384 -out ec384.key', {
    desc: 'Generate a P-384 EC private key via the unified genpkey interface — equivalent to ecparam -name secp384r1',
    example: '(EC P-384 private key written to ec384.key — no console output)\n\nVerify with:\n  openssl pkey -in ec384.key -text -noout | grep "NIST CURVE"\n  NIST CURVE: P-384'
  });

  patch(sec, 'openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-521 -out ec521.key', {
    desc: 'Generate a P-521 EC private key — the highest-security NIST curve, 521-bit field',
    example: '(EC P-521 private key written to ec521.key — no console output)\n\nVerify with:\n  openssl pkey -in ec521.key -text -noout | grep "NIST CURVE"\n  NIST CURVE: P-521'
  });

  patch(sec, 'openssl genpkey -algorithm X25519 -out x25519.key', {
    desc: 'Generate an X25519 key pair used for Diffie-Hellman key agreement (not signing) — Curve25519-based, used in TLS 1.3',
    example: '(X25519 private key written to x25519.key — no console output)\n\nVerify with:\n  openssl pkey -in x25519.key -text -noout\n  X25519 Private-Key:\n  priv:\n      <32-byte hex>'
  });

  patch(sec, 'openssl genpkey -algorithm X448 -out x448.key', {
    desc: 'Generate an X448 key pair for Diffie-Hellman key exchange — Curve448 (Goldilocks), 224-bit security level',
    example: '(X448 private key written to x448.key — no console output)\n\nVerify with:\n  openssl pkey -in x448.key -text -noout\n  X448 Private-Key:\n  priv:\n      <56-byte hex>'
  });

  patch(sec, 'openssl genpkey -algorithm ed448 -out ed448.key', {
    desc: 'Generate an Ed448 private key for digital signatures — Curve448-based signing, available in OpenSSL 1.1.1+',
    example: '(Ed448 private key written to ed448.key — no console output)\n\nVerify with:\n  openssl pkey -in ed448.key -text -noout\n  ED448 Private-Key:\n  priv:\n      <57-byte hex>\n  pub:\n      <57-byte hex>'
  });

  patch(sec, 'openssl ecparam -name prime256v1 -out ecparams.pem', {
    desc: 'Write P-256 (prime256v1) elliptic curve parameters to a PEM file — used as input for tools that need a separate params file',
    example: '(ecparams.pem written — no console output)\n\nContents of ecparams.pem:\n  -----BEGIN EC PARAMETERS-----\n  BggqhkjOPQMBBw==\n  -----END EC PARAMETERS-----'
  });

  patch(sec, 'openssl rand -hex 16', {
    desc: 'Generate 16 cryptographically random bytes and output as 32 lowercase hex characters — useful for AES-128 key material',
    example: '9f3a1b2c4d5e6f708192a3b4c5d6e7f8\n\n(output is 32 hex chars = 16 random bytes; run again for a different value)'
  });
}

// ── Section B: OpenSSL – TLS Client Testing (10 commands, add desc+example) ─
{
  const sec = P.openssl.sections['TLS Client Testing'];

  patch(sec, 'openssl s_client -connect hostname:443', {
    desc: 'Open a raw TLS connection to a host and print the full certificate chain, negotiated cipher suite, TLS version, and session details',
    example: 'CONNECTED(00000003)\ndepth=2 C=US, O=DigiCert Inc, CN=DigiCert Global Root CA\ndepth=1 C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1\ndepth=0 CN=hostname\n---\nCipher    : TLS_AES_256_GCM_SHA384\nProtocol  : TLSv1.3\nServer Temp Key: X25519, 253 bits\nVerification: OK\n---\nSSL-Session:\n  Protocol  : TLSv1.3\n  Cipher    : TLS_AES_256_GCM_SHA384\n  Timeout   : 7200 (sec)\n---'
  });

  patch(sec, 'openssl s_client -connect hostname:443 -servername hostname', {
    desc: 'Connect with explicit SNI (Server Name Indication) in the TLS ClientHello — required for virtual-hosted HTTPS to receive the correct certificate',
    example: 'CONNECTED(00000003)\nSNI hostname: hostname\ndepth=0 CN=hostname\n---\nProtocol  : TLSv1.3\nCipher    : TLS_AES_256_GCM_SHA384\nVerification: OK'
  });

  patch(sec, 'openssl s_client -connect hostname:443 -showcerts', {
    desc: 'Display all certificates in the chain returned by the server (leaf + intermediates) — essential for verifying chain completeness',
    example: 'CONNECTED(00000003)\nCertificate chain\n 0 s:CN=hostname\n   i:C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1\n-----BEGIN CERTIFICATE-----\n<leaf cert PEM>\n-----END CERTIFICATE-----\n 1 s:C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1\n   i:C=US, O=DigiCert Inc, CN=DigiCert Global Root CA\n-----BEGIN CERTIFICATE-----\n<intermediate PEM>\n-----END CERTIFICATE-----'
  });

  patch(sec, 'openssl s_client -connect hostname:443 -CAfile ca.crt', {
    desc: 'Verify the server certificate against a specific CA bundle file; returns verify return code 0 (ok) if valid, or an error code and reason if not',
    example: 'CONNECTED(00000003)\ndepth=2 CN=Root CA\ndepth=1 CN=Intermediate CA\ndepth=0 CN=hostname\n---\nVerify return code: 0 (ok)\nProtocol  : TLSv1.3\n\n# If untrusted:\nVerify return code: 20 (unable to get local issuer certificate)'
  });

  patch(sec, 'openssl s_client -connect hostname:443 -tls1_2', {
    desc: 'Force the TLS handshake to use TLS 1.2 only — confirms whether the server still supports TLS 1.2 when TLS 1.3 is preferred',
    example: 'CONNECTED(00000003)\nProtocol  : TLSv1.2\nCipher    : ECDHE-RSA-AES256-GCM-SHA384\nVerification: OK\n\n# If TLS 1.2 is disabled on server:\n140...SSL routines:ssl_check_version_downgrade:inappropriate fallback'
  });

  patch(sec, 'openssl s_client -connect hostname:443 -tls1_3', {
    desc: 'Force TLS 1.3 negotiation — confirms TLS 1.3 support and shows which AEAD cipher suite is selected',
    example: 'CONNECTED(00000003)\nProtocol  : TLSv1.3\nCipher    : TLS_AES_256_GCM_SHA384\nServer Temp Key: X25519, 253 bits\nVerification: OK'
  });

  patch(sec, 'openssl s_client -connect hostname:443 -cipher ECDHE-RSA-AES256-GCM-SHA384', {
    desc: 'Attempt connection using a specific TLS 1.2 cipher suite — the server will reject the handshake if the cipher is not in its configured list',
    example: 'CONNECTED(00000003)\nProtocol  : TLSv1.2\nCipher    : ECDHE-RSA-AES256-GCM-SHA384\n\n# If cipher not supported by server:\n140...SSL routines:SSL3_GET_SERVER_HELLO:no shared cipher'
  });

  patch(sec, 'openssl s_client -connect hostname:443 -status', {
    desc: 'Request an OCSP staple from the server during the TLS handshake — shows the certificate revocation status inline without a separate OCSP query',
    example: 'CONNECTED(00000003)\nOCSP response:\n======================================\nOCSP Response Data:\n  OCSP Response Status: successful (0x0)\n  Response Type: Basic OCSP Response\n  Cert Status: Good\n  This Update: Jun 10 10:00:00 2026 GMT\n  Next Update: Jun 17 10:00:00 2026 GMT\n======================================\nProtocol  : TLSv1.3'
  });

  patch(sec, 'openssl s_client -connect hostname:443 2>/dev/null | openssl x509 -noout -dates', {
    desc: 'One-liner pipeline that extracts the leaf certificate and prints only its validity dates — quick cert expiry check without parsing the full s_client output',
    example: 'notBefore=Jan  1 00:00:00 2026 GMT\nnotAfter=Dec 31 23:59:59 2026 GMT\n\n# Tip: check days remaining:\nopenssl s_client -connect hostname:443 2>/dev/null | openssl x509 -noout -enddate -checkend 2592000\n# Exit 0 = valid for >30 days; Exit 1 = expires within 30 days'
  });

  patch(sec, 'openssl s_client -connect hostname:25 -starttls smtp', {
    desc: 'Connect to an SMTP server and negotiate TLS via STARTTLS — then inspect the resulting TLS session parameters and certificate',
    example: 'CONNECTED(00000003)\n220 mail.hostname.com ESMTP Postfix\nEHLO openssl.client.test\n250-mail.hostname.com\n250-STARTTLS\n220 2.0.0 Ready to start TLS\nProtocol  : TLSv1.3\nCipher    : TLS_AES_256_GCM_SHA384\nVerification: OK'
  });
}

// ── Section C: OpenSSL – Hashing & HMAC (10 commands, add desc+example) ─────
{
  const sec = P.openssl.sections['Hashing & HMAC'];

  patch(sec, 'openssl dgst -sha256 <file>', {
    desc: 'Compute the SHA-256 digest of a file and print the hex hash — equivalent to sha256sum',
    example: 'SHA2-256(<file>)= e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n\n# Empty file produces the above constant (zero-length message digest)'
  });

  patch(sec, 'openssl dgst -sha1 <file>', {
    desc: 'Compute the SHA-1 hash of a file — legacy; avoid for new security designs due to collision vulnerability (SHAttered attack)',
    example: 'SHA1(<file>)= da39a3ee5e6b4b0d3255bfef95601890afd80709\n\n# That is the SHA-1 of an empty file; real files produce a 40-char hex string'
  });

  patch(sec, 'openssl dgst -md5 <file>', {
    desc: 'Compute the MD5 hash of a file — cryptographically broken; safe only for non-security checksums such as detecting accidental corruption',
    example: 'MD5(<file>)= d41d8cd98f00b204e9800998ecf8427e\n\n# That is the MD5 of an empty file; collisions can be engineered so never use for security'
  });

  patch(sec, 'openssl dgst -sha512 <file>', {
    desc: 'Compute the SHA-512 digest of a file; 512-bit output — suitable for high-security hashing where SHA-256 output length is insufficient',
    example: 'SHA2-512(<file>)= cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce\n47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e\n\n(128 hex chars = 64 bytes)'
  });

  patch(sec, 'openssl dgst -r -sha256 <file>', {
    desc: 'Print the SHA-256 hash in BSD reverse format (hash followed by filename) — compatible with sha256sum -c check files',
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 *<file>\n\n# Save output and later verify:\nopenssl dgst -r -sha256 <file> > checksums.txt\nopenssl dgst -r -sha256 -check checksums.txt'
  });

  patch(sec, 'openssl dgst -sha256 file.txt', {
    desc: 'Hash the literal file file.txt with SHA-256 — identical to the generic form but with a concrete filename',
    example: 'SHA2-256(file.txt)= 2c624232cdd221771294dfbb310acbc8b93f0a9a38bb34f1f4b7b5c1ad7fe19b'
  });

  patch(sec, 'openssl dgst -sha512 file.txt', {
    desc: 'Hash file.txt with SHA-512 — produces a 128-character hex digest; useful when SHA-256 is insufficient for a compliance requirement',
    example: 'SHA2-512(file.txt)= a2bc23d78abc...  (128 hex chars)\n\n# Compare programmatically:\nopenssl dgst -sha512 -binary file.txt | xxd -p'
  });

  patch(sec, 'openssl dgst -md5 file.txt', {
    desc: 'Compute MD5 hash of file.txt — note MD5 is not collision-resistant; use SHA-256 or above for any security purpose',
    example: 'MD5(file.txt)= 5d41402abc4b2a76b9719d911017c592'
  });

  patch(sec, 'openssl dgst -sha256 -c file.txt', {
    desc: 'Compute SHA-256 hash and output each byte separated by colons — useful for visual byte-by-byte comparison or certificate fingerprint display',
    example: 'SHA2-256(file.txt)= 2c:62:42:32:cd:d2:21:77:12:94:df:bb:31:0a:cb:c8:b9:3f:0a:9a:38:bb:34:f1:f4:b7:b5:c1:ad:7f:e1:9b'
  });

  patch(sec, 'openssl dgst -sha3-256 file.txt', {
    desc: 'Compute SHA3-256 hash using the Keccak sponge construction — NIST FIPS 202 standard, distinct from SHA-2; available in OpenSSL 1.1.1+',
    example: 'SHA3-256(file.txt)= a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a\n\n# Verify OpenSSL supports SHA3:\nopenssl list -digest-algorithms | grep sha3'
  });
}

// ── Section D: Linux – Ref 01. File & Directory Navigation (10 updates) ─────
{
  const sec = P.linux.sections['Ref 01. File & Directory Navigation'];

  const updates = [
    ['ls',                           'List files and directories in the current directory',                                             'bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var'],
    ['ls -l',                        'Long format listing — shows permissions, owner, group, size, and modification time',               'total 64\ndrwxr-xr-x  2 root root 4096 Jun  1 10:00 bin\ndrwxr-xr-x 20 root root 4096 Jun  1 10:00 etc\n-rw-r--r--  1 root root 1234 Jun  1 10:00 file.txt'],
    ['ls -lha',                      'Long format with hidden files and human-readable sizes (K, M, G)',                                  'total 96K\ndrwxr-xr-x  2 user user 4.0K Jun  1 10:00 .\ndrwxr-xr-x 20 root root 4.0K Jun  1 10:00 ..\n-rw-r--r--  1 user user 3.5K Jun  1 10:00 .bashrc\n-rw-r--r--  1 user user 1.2K Jun  1 10:00 file.txt'],
    ['ls -t',                        'Sort directory listing by modification time, newest first',                                         'newfile.sh  config.conf  archive.tar.gz  old_backup.bak'],
    ['ls -S',                        'Sort directory listing by file size, largest first',                                               'large_backup.tar.gz  database.db  config.conf  readme.txt'],
    ['ls -1',                        'List one entry per line — useful for piping to other commands or scripts',                          'bin\nboot\netc\nhome\nlib\nusr\nvar'],
    ['ls --group-directories-first', 'Show directories before files within the alphabetical listing',                                    'config/\ndata/\nlogs/\nscripts/\napp.conf\napp.log\nREADME.md'],
    ['ls -d */',                     'List only directories in the current path (trailing slash confirms each entry is a directory)',      'bin/  boot/  dev/  etc/  home/  lib/  lib64/  opt/  proc/  root/  sys/  tmp/  usr/  var/'],
    ['ls --sort=time',               'Sort by modification time; equivalent to ls -t',                                                   'latest.log  yesterday.log  archive-2026-06-01.log'],
    ['ls --sort=size',               'Sort by file size descending; equivalent to ls -S',                                               'bigdump.sql  backup.tar.gz  config.json  notes.txt'],
  ];

  for (const [cmd, desc, example] of updates) {
    patch(sec, cmd, { desc, example });
  }
}

// ── Section E: Linux – Ref 06. Networking Commands (10 updates) ─────────────
{
  const sec = P.linux.sections['Ref 06. Networking Commands'];

  const updates = [
    ['ip -br a',           'Show all interfaces with their IP addresses in a compact one-line-per-interface format',                          'lo               UNKNOWN        127.0.0.1/8 ::1/128\neth0             UP             192.168.1.10/24 fe80::1/64\ndocker0          DOWN'],
    ['ip -4 a',            'Show only IPv4 addresses assigned to all network interfaces',                                                     '1: lo:\n    inet 127.0.0.1/8 scope host lo\n2: eth0:\n    inet 192.168.1.10/24 brd 192.168.1.255 scope global eth0'],
    ['ip -6 a',            'Show only IPv6 addresses assigned to all interfaces',                                                             '1: lo:\n    inet6 ::1/128 scope host\n2: eth0:\n    inet6 fe80::1a2b:3c4d:5e6f:7a8b/64 scope link'],
    ['ip -4 r',            'Display the IPv4 routing table with destination networks, gateways, and egress interfaces',                       'default via 192.168.1.1 dev eth0 proto dhcp metric 100\n10.0.0.0/8 via 10.1.1.1 dev eth1 proto static\n192.168.1.0/24 dev eth0 proto kernel scope link'],
    ['ip link',            'Show Layer-2 link state for all interfaces — flags, MTU, MAC address, and operational state',                     '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN\n    link/loopback 00:00:00:00:00:00\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff'],
    ['ip neigh flush all', 'Flush (clear) all ARP / NDP neighbour table entries, forcing fresh resolution on the next transmission',          '(no output on success; neighbour cache cleared)'],
    ['ip route get 8.8.8.8','Show the exact kernel route used to reach a specific IP, including the source address and egress interface',     '8.8.8.8 via 192.168.1.1 dev eth0 src 192.168.1.10 uid 1000\n    cache'],
    ['ping host',          'Send ICMP echo requests to a host to test basic IP connectivity and measure round-trip time',                     'PING example.com (93.184.216.34) 56(84) bytes of data.\n64 bytes from 93.184.216.34: icmp_seq=1 ttl=55 time=12.3 ms\n64 bytes from 93.184.216.34: icmp_seq=2 ttl=55 time=11.9 ms\n\n--- example.com ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss'],
    ['ping -s 1024 host',  'Send ICMP packets with a 1024-byte payload to test path MTU and fragmentation behaviour',                         'PING host (10.0.0.1) 1024(1052) bytes of data.\n1032 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.456 ms\n\n# If fragmentation occurs, reduce -s until ping succeeds to find path MTU'],
    ['curl url',           'Fetch a URL with an HTTP GET request and print the response body to stdout',                                     '<!DOCTYPE html>\n<html>\n<head><title>Example Domain</title></head>\n<body>\n<h1>Example Domain</h1>\n<p>This domain is for use in illustrative examples.</p>\n</body>\n</html>'],
  ];

  for (const [cmd, desc, example] of updates) {
    patch(sec, cmd, { desc, example });
  }
}

// ── Section F: Linux – Ref 09. Systemd Service Management (10 updates) ──────
{
  const sec = P.linux.sections['Ref 09. Systemd Service Management'];

  const updates = [
    ['systemctl status service',          'Show the current status of a systemd unit — running state, active/failed, recent journal lines, PID, and cgroup',          '● nginx.service - A high performance web server\n   Loaded: loaded (/lib/systemd/system/nginx.service; enabled)\n   Active: active (running) since Mon 2026-06-13 10:00:00 UTC; 2h ago\n Main PID: 1234 (nginx)\n   CGroup: /system.slice/nginx.service\n           ├─1234 nginx: master\n           └─1235 nginx: worker\nJun 13 10:00:00 host nginx[1234]: Listening on 0.0.0.0:80'],
    ['systemctl start service',           'Start a systemd unit immediately without enabling it for automatic start at boot',                                          '(no output on success; service starts in the background)\n\n# Verify:\nsystemctl is-active nginx\nactive'],
    ['systemctl stop service',            'Stop a running systemd unit gracefully — sends SIGTERM, then SIGKILL if the service does not exit within the timeout',       '(no output on success)\n\n# Verify:\nsystemctl is-active nginx\ninactive'],
    ['systemctl restart service',         'Stop then immediately start a unit — briefly interrupts service; use reload instead if the service supports it',             '(no output on success; service restarts)\n\n# Confirm it came back up:\nsystemctl is-active nginx\nactive'],
    ['systemctl reload service',          'Send a reload signal (SIGHUP or equivalent) to apply configuration changes without stopping the process',                    '(no output on success; config reloaded without downtime)\n\n# Not all services support reload; check:\ncat /lib/systemd/system/nginx.service | grep ExecReload'],
    ['systemctl reload-or-restart service','Reload configuration if supported; fall back to a full restart if not — the safest one-liner for config changes',           '(no output on success)'],
    ['systemctl enable service',          'Create the symlinks that cause a unit to be automatically started at boot via the appropriate target',                       'Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service\n→ /lib/systemd/system/nginx.service.'],
    ['systemctl disable service',         'Remove the boot-start symlinks so the unit will no longer start automatically; the service remains installed',               'Removed /etc/systemd/system/multi-user.target.wants/nginx.service.'],
    ['systemctl mask service',            'Symlink the unit to /dev/null, preventing it from being started manually or automatically — stronger than disable',           'Created symlink /etc/systemd/system/nginx.service → /dev/null.\n\n# To undo:\nsystemctl unmask nginx'],
    ['systemctl unmask service',          'Reverse a mask — removes the /dev/null symlink so the unit can be started and enabled again',                               'Removed /etc/systemd/system/nginx.service.'],
  ];

  for (const [cmd, desc, example] of updates) {
    patch(sec, cmd, { desc, example });
  }
}

// ── Section G: Wireshark – Capture Filters (10 updates — add example) ───────
{
  const sec = P.wireshark.sections['Capture Filters'];

  const updates = [
    ['host <ip>',                    'host 192.168.1.10\n→ Captures all packets to or from 192.168.1.10 regardless of protocol (TCP, UDP, ICMP, ARP, etc.)'],
    ['src host <ip>',                'src host 10.0.0.5\n→ Only packets whose source IP is 10.0.0.5 are captured'],
    ['dst host <ip>',                'dst host 10.0.0.1\n→ Only packets destined for 10.0.0.1 are captured'],
    ['net <subnet>',                 'net 192.168.1.0/24\n→ Captures all traffic where source or destination falls within 192.168.1.0/24\n\n# Also valid with mask notation:\nnet 10.0.0.0 mask 255.0.0.0'],
    ['port <port>',                  'port 443\n→ Captures all TCP or UDP traffic on port 443 (HTTPS); matches both src and dst port\n\n# Combine with host:\nhost 10.0.0.1 and port 443'],
    ['tcp port <port>',              'tcp port 80\n→ Captures only TCP port 80 (HTTP) — excludes UDP traffic on port 80\n\n# Capture a range:\ntcp portrange 8080-8090'],
    ['udp port <port>',              'udp port 53\n→ Captures only UDP DNS queries and responses on port 53; excludes TCP DNS (zone transfers)'],
    ['icmp',                         'icmp\n→ Captures all ICMPv4 echo requests, replies, unreachables, and time-exceeded messages\n\n# Combine with host:\nicmp and host 192.168.1.1'],
    ['icmp6',                        'icmp6\n→ Captures ICMPv6 traffic including Neighbor Discovery (ND), Router Solicitation, and IPv6 pings\n\n# Filter to pings only:\nicmp6[icmp6type] == 128'],
    ['arp',                          'arp\n→ Captures all ARP broadcast and unicast frames — useful for detecting ARP storms, spoofing, or IP conflicts'],
  ];

  for (const [cmd, example] of updates) {
    patch(sec, cmd, { example });
  }
}

// ── Section H: Wireshark – TShark (10 updates — add example) ────────────────
{
  const sec = P.wireshark.sections['TShark'];

  const tsharkUpdates = [
    ['tshark -D',
      'tshark -D\n1. eth0\n2. wlan0\n3. lo (Loopback)\n4. any (Pseudo-device, captures on all interfaces)\n5. nflog\n6. nfqueue\n7. usbmon1'],

    ['tshark -i <iface>',
      'tshark -i eth0\nCapturing on \'eth0\'\n  1 0.000000 192.168.1.10 → 8.8.8.8   DNS 80 Standard query 0x1234 A example.com\n  2 0.012345  8.8.8.8 → 192.168.1.10 DNS 96 Standard query response 0x1234 A 93.184.216.34\n  3 0.013210 192.168.1.10 → 10.0.0.1  TLSv1.3 134 Client Hello\n^C\n3 packets captured'],

    ['tshark -i <iface> -f "<filter>"',
      'tshark -i eth0 -f "tcp port 443"\nCapturing on \'eth0\'\n  1 0.000000 192.168.1.10 → 10.0.0.1  TLSv1.3 134 Client Hello\n  2 0.001234  10.0.0.1 → 192.168.1.10 TLSv1.3 897 Server Hello, Certificate, Server Hello Done\n  3 0.003456 192.168.1.10 → 10.0.0.1  TLSv1.3  66 Change Cipher Spec, Finished\n^C\n3 packets captured'],

    ['tshark -Y "<display-filter>"',
      'tshark -i eth0 -Y "http.request.method == GET"\n  1 0.000000 192.168.1.10 → 93.184.216.34 HTTP 365 GET / HTTP/1.1\n  2 1.234560 192.168.1.10 → 93.184.216.34 HTTP 402 GET /favicon.ico HTTP/1.1\n\n# Read from file with display filter:\ntshark -r capture.pcap -Y "dns.flags.response == 1 and dns.flags.rcode > 0"'],

    ['tshark -w <file.pcap>',
      'tshark -i eth0 -w capture.pcap\nCapturing on \'eth0\'\n^C\n4823 packets captured\n\n# With rotation (100 MB files, keep last 5):\ntshark -i eth0 -w capture.pcap -b filesize:102400 -b files:5'],

    ['tshark -r <file.pcap>',
      'tshark -r capture.pcap\n  1 0.000000 10.0.0.1 → 10.0.0.2  TCP 74 12345 → 80 [SYN] Seq=0 Win=65535 Len=0\n  2 0.000234 10.0.0.2 → 10.0.0.1  TCP 74    80 → 12345 [SYN, ACK] Seq=0 Ack=1\n  3 0.000468 10.0.0.1 → 10.0.0.2  TCP 66 12345 → 80 [ACK] Seq=1 Ack=1\n  4 0.001000 10.0.0.1 → 10.0.0.2  HTTP 365 GET / HTTP/1.1'],

    ['tshark -z io',
      'tshark -r capture.pcap -qz io,stat,10\n===================================================================\n| IO Statistics                                                   |\n| Interval size: 10 secs                                         |\n|-----------------------------------------------------------------|\n| Duration type:   secs                                          |\n|          Start  Stop  Frames   Bytes                           |\n| Interval 0      10    1234     567890                          |\n| Interval 10     20    2345     1234567                         |\n==================================================================='],

    ['tshark -z conv,tcp -r capture.pcap',
      'tshark -r capture.pcap -qz conv,tcp\n================================================================================\nTCP Conversations\nFilter:<No Filter>\n                                                 |       <-      | |       ->      | |     Total     |    Relative    |   Duration   |\n                                                 | Frames  Bytes | | Frames  Bytes | | Frames  Bytes |      Start     |              |\n192.168.1.10:12345    <-> 93.184.216.34:443       34    34567      31   678901     65   713468    0.000000000          2.3453\n10.0.0.1:54321        <-> 10.0.0.2:80             12     8901      18   456789     30   465690    0.523100000          0.9871'],

    ['tshark -z endpoints,tcp -r capture.pcap',
      'tshark -r capture.pcap -qz endpoints,tcp\n================================================================================\nTCP Endpoints\nFilter:<No Filter>\n                  |  Address  | Packets | Bytes  | Tx Packets | Tx Bytes | Rx Packets | Rx Bytes |\n  192.168.1.10        65      713468       34       34567        31      678901\n  93.184.216.34       65      713468       31      678901        34       34567\n================================================================================'],

    ['tshark -z expert',
      'tshark -r capture.pcap -qz expert\nExpert Infos\n  Severity   Group         Summary\n  Warning    Sequence      TCP segment not captured [Reassembly error, protocol: TCP]\n  Warning    Sequence      Previous segment(s) not captured [Reassembly error]\n  Chat       Sequence      Connection establish request (SYN): server port 443\n  Chat       Sequence      Connection establish acknowledge (SYN+ACK): server port 443'],
  ];

  for (const [cmd, example] of tsharkUpdates) {
    // Fix the 'stat' placeholder descriptions while we're here
    const entry = sec.find(c => c.cmd === cmd);
    if (!entry) { console.warn(`WARN tshark: ${cmd}`); continue; }
    if (entry.desc === 'stat') {
      if (cmd === 'tshark -z io')       entry.desc = 'Display IO statistics — use with -qz io,stat,<interval> to bucket throughput by time window';
      if (cmd === 'tshark -z http')     entry.desc = 'Display HTTP request/response tree statistics from a capture file — requires -r <file.pcap>';
      if (cmd === 'tshark -z dns')      entry.desc = 'Display DNS query-type and response-code statistics from a capture file — requires -r <file.pcap>';
      if (cmd === 'tshark -z tls')      entry.desc = 'Display TLS handshake statistics from a capture file — requires -r <file.pcap>';
    }
    entry.example = example;
  }
}

// ── Section I: NetScaler SDX – System (10 updates — add desc+example) ───────
{
  const sec = P.netscalersdx.sections['System'];

  const updates = [
    ['show system', {
      desc: 'Display overall SDX system information including hostname, software version, management IP, and cluster role',
      example: 'Hostname:      sdx-01.corp.local\nSoftware Ver:  14.1-21.57\nManagement IP: 10.10.10.5\nState:         Primary\nUptime:        12 days, 4 hours, 32 minutes'
    }],
    ['show system version', {
      desc: 'Show the SDX Management Service (SVM) version and build number installed on the appliance',
      example: 'Management Service Version : 14.1 Build 21.57\nBuild Date:                : Jan 15 2026 09:44:12\nPackage Version:           : 14.1-21.57_nc_64.tgz'
    }],
    ['show system backup', {
      desc: 'List all available system backup archives stored on the SDX management service',
      example: 'Name                              Size       Created\n--------------------------------  ---------  ----------------------\nnsfullconf_sdx-01_20260601.tgz   248.3 MB   Tue Jun  1 02:00:01 2026\nnsfullconf_sdx-01_20260531.tgz   247.9 MB   Mon May 31 02:00:01 2026'
    }],
    ['show system backup <name>', {
      desc: 'Show details of a specific backup archive including creation date, size, and the entities it contains',
      example: 'Name:        nsfullconf_sdx-01_20260601.tgz\nCreated:     Tue Jun  1 02:00:01 2026\nSize:        248.3 MB\nType:        Full\nEntities:    VPX Configs, SSL Certs, Networking, HA Pair'
    }],
    ['show system user', {
      desc: 'List all configured SDX administrative user accounts and their permission groups',
      example: 'Username      Group          Status    Last Login\n-----------  -------------  --------  ----------------------\nnsroot        superuser      enabled   2026-06-13 09:12:45\nadmin         read-write     enabled   2026-06-12 15:44:03\nauditor       read-only      enabled   2026-06-10 08:30:11'
    }],
    ['show system user <username>', {
      desc: 'Show detailed properties of a specific SDX admin account including group membership and last login time',
      example: 'Username:       admin\nGroup:          read-write\nStatus:         enabled\nEmail:          admin@corp.local\nTimeout:        900 seconds\nLast Login:     2026-06-12 15:44:03 from 10.10.10.100'
    }],
    ['show system config', {
      desc: 'Display the current SDX system-level configuration such as NTP servers, DNS settings, SNMP, and syslog targets',
      example: 'Hostname:        sdx-01.corp.local\nDNS Primary:     10.10.10.53\nDNS Secondary:   10.10.10.54\nNTP Server:      pool.ntp.org\nSyslog Server:   10.10.10.200 (UDP 514)\nSNMP Trap Dest:  10.10.10.201'
    }],
    ['show system storage', {
      desc: 'Show disk usage for the SDX flash partition and other storage volumes used by management files, logs, and VPX images',
      example: 'Mount Point       Total    Used     Free     Use%\n/flash            40 GB   12.3 GB  27.7 GB   31%\n/var              60 GB   18.6 GB  41.4 GB   31%\n/var/mps/upload   40 GB    5.2 GB  34.8 GB   13%'
    }],
    ['show system uptime', {
      desc: 'Display how long the SDX Management Service has been running since last reboot',
      example: 'System Uptime:     12 days, 4 hours, 32 minutes, 18 seconds\nLast Reboot:       Sat May 31 18:00:05 2026\nReboot Reason:     Software upgrade to 14.1-21.57'
    }],
    ['show system alarms', {
      desc: 'List all active system alarms and alerts on the SDX, such as high CPU, disk usage, or VPX health issues',
      example: 'Severity   Type                Message                          Raised\n--------   -----------------   ------------------------------   ----------------------\nWarning    Disk Usage          /var usage exceeds 80% threshold  2026-06-13 08:15:22\nInfo       VPX State Change    VPX-02 transitioned to DOWN       2026-06-12 22:30:11\n\n(2 alarms active)'
    }],
  ];

  for (const [cmd, fields] of updates) {
    patch(sec, cmd, fields);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE
// ─────────────────────────────────────────────────────────────────────────────
data.updatedAt = new Date().toISOString();
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('commands.json updated successfully.');
