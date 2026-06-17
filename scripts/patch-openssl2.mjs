#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(filePath, 'utf8'));
const openssl = data.platforms.openssl.sections;

function patch(section, cmd, example) {
  const s = openssl[section];
  if (!s) { console.warn('SECTION NOT FOUND:', section); return; }
  const c = s.find(x => x.cmd === cmd);
  if (!c) { console.warn('CMD NOT FOUND in', section, ':', cmd); return; }
  if (c.example && c.example.trim()) return;
  c.example = example;
}

// ── Key Inspection & Manipulation ─────────────────────────────────────────────
patch('Key Inspection & Manipulation', 'openssl rsa -in <key> -check',
`$ openssl rsa -in server.key -check
RSA key ok
# Verifies the mathematical consistency of an RSA private key.
# "RSA key ok" = valid; error messages indicate a corrupted or malformed key.
# For EC keys: openssl ec -in ec.key -check`);

patch('Key Inspection & Manipulation', 'openssl rsa -in <key> -pubout -out <pubkey>',
`$ openssl rsa -in server.key -pubout -out server-public.key
writing RSA key
$ head -1 server-public.key
-----BEGIN PUBLIC KEY-----
# Extracts the RSA public key from a private key in SubjectPublicKeyInfo (SPKI) format.
# For any key type: openssl pkey -in server.key -pubout -out server-public.key`);

patch('Key Inspection & Manipulation', 'openssl pkey -in <key> -pubout',
`$ openssl pkey -in server.key -pubout
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
# Prints the public key to stdout — works for RSA, EC, Ed25519, X25519.
# The universal replacement for openssl rsa -pubout and openssl ec -pubout.`);

patch('Key Inspection & Manipulation', 'openssl pkey -in <key> -text -noout',
`$ openssl pkey -in server.key -text -noout
Private-Key: (2048 bit, 2 primes)
modulus:
    00:c1:d3:4a:b5:...
publicExponent: 65537 (0x10001)
privateExponent:
    ...
prime1: ...
prime2: ...
# Dumps full key parameters as human-readable text.
# Works for RSA, EC, Ed25519 — a unified alternative to openssl rsa -text.`);

patch('Key Inspection & Manipulation', 'openssl pkcs8 -topk8 -v2 aes-256-cbc -in plain.key -out pkcs8-enc.key',
`$ openssl pkcs8 -topk8 -v2 aes-256-cbc -in server.key -out server-pkcs8-enc.key
Enter Encryption Password:
Verifying - Enter Encryption Password:
$ head -1 server-pkcs8-enc.key
-----BEGIN ENCRYPTED PRIVATE KEY-----
# Converts a traditional RSA key to PKCS#8 format encrypted with AES-256-CBC.
# PKCS#8 encrypted keys are required by Java KeyStore and many frameworks.`);

patch('Key Inspection & Manipulation', 'openssl pkcs8 -in pkcs8-enc.key -out decrypted.key',
`$ openssl pkcs8 -in server-pkcs8-enc.key -out server-plain.key
Enter Password:
$ head -1 server-plain.key
-----BEGIN PRIVATE KEY-----
# Decrypts a PKCS#8 encrypted private key to an unencrypted PKCS#8 key.
# Remove the password protection for use by services that cannot prompt.`);

// ── CSR & Certificate Signing ──────────────────────────────────────────────────
patch('CSR & Certificate Signing', 'openssl req -new -key private.key -out req.csr -subj /C=GB/ST=London/O=Org/CN=example.com',
`$ openssl req -new -key server.key -out server.csr -subj "/C=GB/ST=London/O=Acme Ltd/CN=example.com"
$ openssl req -in server.csr -noout -subject
subject=C=GB, ST=London, O=Acme Ltd, CN=example.com
# Creates a CSR with all subject fields on the command line.
# Submit server.csr to your CA; they sign it and return the certificate.`);

patch('CSR & Certificate Signing', 'openssl x509 -req -in req.csr -CA ca.crt -CAkey ca.key -extfile san.ext -out cert.crt -days 365 -sha256',
`$ openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
    -extfile san.ext -CAcreateserial -out server.crt -days 365 -sha256
Signature ok
subject=C=GB, ST=London, O=Acme Ltd, CN=example.com
Getting CA Private Key
# san.ext content example:
#   subjectAltName = DNS:example.com, DNS:www.example.com, IP:10.0.0.1
# -CAcreateserial auto-creates ca.srl to track certificate serial numbers.`);

patch('CSR & Certificate Signing', 'openssl ca -config openssl-ca.cnf -extensions v3_intermediate_ca -days 3650 -in intermediate.csr -out intermediate.crt',
`$ openssl ca -config openssl-ca.cnf -extensions v3_intermediate_ca \
    -days 3650 -notext -md sha256 -in intermediate.csr -out intermediate.crt
Using configuration from openssl-ca.cnf
Check that the request matches the signature
Signature ok
Certificate Details: ...
Sign the certificate? [y/n]: y
1 out of 1 certificate requests certified, commit? [y/n]: y
# Signs an intermediate CA CSR using a root CA and a config with CA extensions.`);

patch('CSR & Certificate Signing', 'openssl ca -config openssl-ca.cnf -extensions server_cert -days 365 -in req.csr -out server.crt',
`$ openssl ca -config openssl-ca.cnf -extensions server_cert \
    -days 365 -notext -md sha256 -in server.csr -out server.crt
Using configuration from openssl-ca.cnf
Signature ok
Certificate is to be certified until Jan  1 00:00:00 2027 GMT (365 days)
Sign the certificate? [y/n]: y
# Signs a server CSR using a CA managed via the openssl ca mini-CA infrastructure.
# Tracks issued certificates in the ca database (index.txt, serial file).`);

// ── Certificate Inspection ─────────────────────────────────────────────────────
patch('Certificate Inspection', 'openssl x509 -in <cert> -issuer -noout',
`$ openssl x509 -in server.crt -issuer -noout
issuer=C=US, O=Let's Encrypt, CN=R3
# Prints only the Issuer distinguished name of the certificate.
# The issuer must match the subject of the next certificate up the chain.`);

patch('Certificate Inspection', 'openssl x509 -in <cert> -subject -noout',
`$ openssl x509 -in server.crt -subject -noout
subject=CN=example.com
# Prints only the Subject distinguished name.
# For multi-SAN certificates, the CN is often just the primary domain name.`);

patch('Certificate Inspection', 'openssl x509 -in <cert> -dates -noout',
`$ openssl x509 -in server.crt -dates -noout
notBefore=Jan  1 00:00:00 2026 GMT
notAfter=Apr  1 00:00:00 2026 GMT
# Prints the validity window (Not Before and Not After dates).
# Quick check for certificate expiry without parsing the full -text output.`);

patch('Certificate Inspection', 'openssl x509 -in <cert> -fingerprint -noout',
`$ openssl x509 -in server.crt -fingerprint -noout
SHA1 Fingerprint=A1:B2:C3:D4:E5:F6:...
# Prints the SHA-1 fingerprint of the DER-encoded certificate.
# For SHA-256: openssl x509 -in server.crt -fingerprint -sha256 -noout
# Compare against the fingerprint shown in a browser certificate viewer.`);

patch('Certificate Inspection', 'openssl verify -CAfile <ca.pem> <cert>',
`$ openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt server.crt
server.crt: OK
# Verifies the certificate chain against the CA bundle.
# "OK" = certificate is valid, not expired, and chain is trusted.
# Failure message includes the reason: e.g. "certificate has expired" (code 10).`);

patch('Certificate Inspection', 'openssl pkcs12 -in <pfx> -nodes',
`$ openssl pkcs12 -in bundle.pfx -nodes -out bundle.pem
Enter Import Password:
MAC verified OK
$ grep "BEGIN" bundle.pem
-----BEGIN CERTIFICATE-----
-----BEGIN CERTIFICATE-----
-----BEGIN PRIVATE KEY-----
# Extracts certificate(s) and private key from a PKCS#12 file to a PEM bundle.
# -nodes = no passphrase on the extracted private key.`);

patch('Certificate Inspection', 'openssl pkcs12 -export -out <pfx> -inkey <key> -in <cert>',
`$ openssl pkcs12 -export -out bundle.pfx -inkey server.key -in server.crt -certfile chain.crt
Enter Export Password:
Verifying - Enter Export Password:
$ ls -lh bundle.pfx
-rw------- 1 user user 4.1K Jan  1 12:00 bundle.pfx
# Packages a certificate, private key, and optional chain into a PKCS#12 file.
# Import into Windows: double-click bundle.pfx → Certificate Import Wizard.`);

patch('Certificate Inspection', 'openssl req -new -key <key> -out <csr>',
`$ openssl req -new -key server.key -out server.csr
You are about to be asked to enter information...
Country Name (2 letter code) [AU]: GB
State or Province Name: London
Locality Name: London
Organization Name: Acme Ltd
Organizational Unit Name:
Common Name: example.com
Email Address:
# Interactive CSR generation — prompts for each subject field.
# For non-interactive: add -subj "/C=GB/O=Acme Ltd/CN=example.com"`);

patch('Certificate Inspection', 'openssl req -newkey rsa:2048 -nodes -keyout <key> -out <csr>',
`$ openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=example.com"
Generating a RSA private key
......+++++
e is 65537 (0x010001)
# Generates a new 2048-bit RSA key AND a CSR in one step.
# -nodes = no passphrase on the generated private key.`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -ext extendedKeyUsage',
`$ openssl x509 -in server.crt -noout -ext extendedKeyUsage
X509v3 Extended Key Usage:
    TLS Web Server Authentication, TLS Web Client Authentication
# Shows the Extended Key Usage (EKU) extension — what the cert is authorised for.
# Server certs: id-kp-serverAuth (1.3.6.1.5.5.7.3.1)
# Client certs: id-kp-clientAuth (1.3.6.1.5.5.7.3.2)`);

// ── Verification & Matching ────────────────────────────────────────────────────
patch('Verification & Matching', 'openssl rsa -noout -modulus -in private.key | openssl md5',
`$ openssl rsa -noout -modulus -in server.key | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
$ openssl x509 -noout -modulus -in server.crt | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
# Matching MD5 hashes confirm the certificate and private key are a pair.
# For EC keys use: openssl ec -noout -pubout -in ec.key | openssl md5`);

patch('Verification & Matching', 'openssl req -noout -modulus -in request.csr | openssl md5',
`$ openssl req -noout -modulus -in server.csr | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
$ openssl rsa -noout -modulus -in server.key | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
# Confirms the CSR was generated from the correct private key before submission.`);

patch('Verification & Matching', 'openssl verify -CAfile ca.crt -untrusted chain.pem -verbose cert.crt',
`$ openssl verify -CAfile root-ca.crt -untrusted intermediate.crt -verbose server.crt
server.crt: /CN=example.com
error 0 at 0 depth lookup: ok
server.crt: OK
# -verbose shows each certificate in the chain being validated.
# -untrusted provides intermediate CAs that are not direct trust anchors.`);

patch('Verification & Matching', 'openssl verify -CApath /etc/ssl/certs cert.crt',
`$ openssl verify -CApath /etc/ssl/certs server.crt
server.crt: OK
# Uses the system CA certificate directory (hashed) instead of a single file.
# -CApath requires certificates named by their subject hash (c_rehash /etc/ssl/certs).`);

patch('Verification & Matching', 'openssl verify -partial_chain -CAfile intermediate.crt cert.crt',
`$ openssl verify -partial_chain -CAfile intermediate.crt server.crt
server.crt: OK
# -partial_chain allows verification to succeed against an intermediate CA
# without requiring the full chain back to a root CA.
# Useful when you only have the intermediate and want to verify leaf cert.`);

patch('Verification & Matching', 'openssl verify -show_chain -CAfile ca.crt cert.crt',
`$ openssl verify -show_chain -CAfile ca.crt server.crt
server.crt: OK
Chain:
depth=0: CN=example.com (untrusted)
depth=1: C=US, O=Let's Encrypt, CN=R3 (untrusted)
depth=2: C=US, O=Internet Security Research Group, O=ISRG Root X1 (trusted)
# -show_chain displays the full certificate chain used during verification.
# "trusted" marks the root CA from the -CAfile; others are "untrusted" intermediates.`);

patch('Verification & Matching', 'openssl pkey -in private.key -pubout | openssl sha256',
`$ openssl pkey -in server.key -pubout | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
$ openssl x509 -in server.crt -pubkey -noout | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
# SHA-256 hash comparison of public keys — confirms cert and key are paired.
# Works for RSA, EC, Ed25519 — a universal key-cert matching method.`);

patch('Verification & Matching', 'openssl x509 -in cert.crt -pubkey -noout | openssl sha256',
`$ openssl x509 -in server.crt -pubkey -noout | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
$ openssl pkey -in server.key -pubout | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
# Extracts public key from cert and hashes it — compare with the key file hash.`);

patch('Verification & Matching', 'openssl req -in req.csr -pubkey -noout | openssl sha256',
`$ openssl req -in server.csr -pubkey -noout | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
$ openssl pkey -in server.key -pubout | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
# Three-way check: if CSR, key, and cert all produce the same hash, they match.`);

patch('Verification & Matching', 'openssl x509 -in cert.crt -noout -fingerprint -sha1',
`$ openssl x509 -in server.crt -noout -fingerprint -sha1
SHA1 Fingerprint=A1:B2:C3:D4:E5:F6:07:08:09:0A:0B:0C:0D:0E:0F:10:11:12:13:14
# SHA-1 fingerprint — matches what browsers display in the certificate details.
# For SHA-256: openssl x509 -in server.crt -noout -fingerprint -sha256`);

// ── TLS Client Testing ─────────────────────────────────────────────────────────
patch('TLS Client Testing', 'openssl s_client -connect hostname:443 2>/dev/null | openssl x509 -noout -dates',
`$ openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -dates
notBefore=Jan  1 00:00:00 2026 GMT
notAfter=Apr  1 00:00:00 2026 GMT
# Fetches the live leaf certificate and prints its validity dates.
# Quick expiry check for any HTTPS endpoint without importing the certificate.`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443>',
`$ openssl s_client -connect example.com:443 < /dev/null
CONNECTED(00000003)
depth=2 C=US, O=Internet Security Research Group, CN=ISRG Root X1
depth=1 C=US, O=Let's Encrypt, CN=R3
depth=0 CN=example.com
verify return:1
---
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Server public key is 2048 bit
    Verify return code: 0 (ok)
---`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443> -servername <sni>',
`$ openssl s_client -connect 10.0.0.10:443 -servername example.com < /dev/null 2>&1 | grep "subject="
subject=CN=example.com
# -servername sends the TLS SNI extension — essential for virtual-hosted HTTPS.
# Without SNI the server may return the default (wrong) certificate.`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443> -tls1_2',
`$ openssl s_client -connect example.com:443 -tls1_2 < /dev/null 2>&1 | grep -E "Protocol|Cipher"
Protocol  : TLSv1.2
Cipher    : ECDHE-RSA-AES256-GCM-SHA384
# Forces TLS 1.2 — confirms the server still supports TLS 1.2 alongside 1.3.
# "no protocols available" = server has disabled TLS 1.2.`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443> -tls1_3',
`$ openssl s_client -connect example.com:443 -tls1_3 < /dev/null 2>&1 | grep -E "Protocol|Cipher"
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
# Forces TLS 1.3 only — confirms the server supports the latest protocol version.`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443> -showcerts',
`$ openssl s_client -connect example.com:443 -showcerts < /dev/null 2>&1 | grep "BEGIN"
-----BEGIN CERTIFICATE-----     (leaf: CN=example.com)
-----BEGIN CERTIFICATE-----     (intermediate: CN=R3)
# -showcerts dumps all certificates in the chain, not just the leaf.
# Pipe to a file to save the chain: openssl s_client ... -showcerts < /dev/null > chain.pem`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443> -status',
`$ openssl s_client -connect example.com:443 -status < /dev/null 2>&1 | grep -A6 "OCSP response"
OCSP response:
======================================
OCSP Response Data:
    OCSP Response Status: successful (0x0)
    Cert Status: Good
    This Update: Jan  1 12:00:00 2026 GMT
# -status requests OCSP stapling from the server.  "Cert Status: Good" = not revoked.`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443> -cipher <cipher>',
`$ openssl s_client -connect example.com:443 -cipher ECDHE-RSA-AES128-GCM-SHA256 < /dev/null 2>&1 | grep "Cipher"
New, TLSv1.2, Cipher is ECDHE-RSA-AES128-GCM-SHA256
# Tests whether the server accepts a specific TLS 1.2 cipher suite.
# If rejected: "no peer certificate available" or "no ciphers available".`);

patch('TLS Client Testing', 'openssl s_client -connect <host:443> -curves <curve>',
`$ openssl s_client -connect example.com:443 -curves X25519 < /dev/null 2>&1 | grep "Cipher\|Curve"
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Server Temp Key: X25519, 253 bits
# -curves restricts the ECDH curves offered in the ClientHello.
# Common values: X25519, P-256, P-384, X448`);

patch('TLS Client Testing', 'openssl s_client -connect host:443 -servername host -alpn h2,http/1.1',
`$ openssl s_client -connect example.com:443 -servername example.com -alpn "h2,http/1.1" < /dev/null 2>&1 | grep "ALPN"
ALPN protocol: h2
# Negotiates HTTP/2 via the ALPN TLS extension.
# "h2" in the response confirms the server supports HTTP/2 (RFC 7540).
# "http/1.1" = server only supports HTTP/1.1.`);

patch('TLS Client Testing', 'openssl s_client -connect host:443 -servername host -reconnect',
`$ openssl s_client -connect example.com:443 -servername example.com -reconnect < /dev/null 2>&1 | grep "Reused\|New"
New,    TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
# Makes 5 connections; "Reused" confirms TLS session resumption (PSK/ticket) works.
# Session resumption reduces handshake RTT and server CPU load.`);

patch('TLS Client Testing', 'openssl s_client -connect host:443 -servername host -sess_out sess.pem',
`$ openssl s_client -connect example.com:443 -servername example.com -sess_out /tmp/session.pem < /dev/null
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
$ head -1 /tmp/session.pem
-----BEGIN SSL SESSION PARAMETERS-----
# Saves the TLS session ticket for manual resumption testing.
# Resume: openssl s_client -connect example.com:443 -sess_in /tmp/session.pem`);

// ── TLS Server Testing ─────────────────────────────────────────────────────────
patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -CAfile ca.crt -verify 1',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -CAfile ca.crt -verify 1
Using default temp DH parameters
ACCEPT
# -verify 1 requests a client certificate (but does not require it).
# Use -Verify 1 (capital V) to make client authentication mandatory.`);

patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -alpn h2,http/1.1',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -alpn "h2,http/1.1"
Using default temp DH parameters
ACCEPT
# Advertises HTTP/2 and HTTP/1.1 via ALPN extension.
# Test: openssl s_client -connect localhost:4433 -alpn h2,http/1.1`);

patch('TLS Server Testing', 'openssl s_time -connect host:443 -new -time 30',
`$ openssl s_time -connect example.com:443 -new -time 30
Collecting connection statistics for 30 seconds
142 connections in 30.00s; 4.73 connections/user sec, bytes read 524288
142 connections in 30s; 4.73 connections/user sec
# Tests TLS handshake throughput using new sessions only.
# Useful for benchmarking server TLS performance or testing rate limits.`);

patch('TLS Server Testing', 'openssl s_time -connect host:443 -reuse -time 30',
`$ openssl s_time -connect example.com:443 -reuse -time 30
Collecting connection statistics for 30 seconds
2048 connections in 30.00s; 68.27 connections/user sec
# Tests session resumption throughput — resumed connections should be much faster.
# Compare with -new to measure the session resumption speedup ratio.`);

// ── Cipher & Protocol Listing ──────────────────────────────────────────────────
patch('Cipher & Protocol Listing', 'openssl ciphers -v -s -tls1_3',
`$ openssl ciphers -v -s -tls1_3 2>/dev/null
TLS_AES_256_GCM_SHA384    TLSv1.3 Kx=any  Au=any  Enc=AESGCM(256) Mac=AEAD
TLS_CHACHA20_POLY1305_SHA256 TLSv1.3 Kx=any  Au=any  Enc=CHACHA20/POLY1305 Mac=AEAD
TLS_AES_128_GCM_SHA256    TLSv1.3 Kx=any  Au=any  Enc=AESGCM(128) Mac=AEAD
# -s = only show ciphers supported by the current SSL library build.
# TLS 1.3 cipher suites cannot be configured; all three are always enabled.`);

patch('Cipher & Protocol Listing', 'openssl ciphers -stdname -v',
`$ openssl ciphers -stdname -v "DEFAULT" | head -5
TLS_AES_256_GCM_SHA384                 TLS_AES_256_GCM_SHA384          TLSv1.3 Kx=any  Au=any  Enc=AESGCM(256)
TLS_CHACHA20_POLY1305_SHA256           TLS_CHACHA20_POLY1305_SHA256    TLSv1.3 ...
ECDHE-ECDSA-AES256-GCM-SHA384         TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 TLSv1.2 ...
# -stdname shows both the OpenSSL name and the official IANA/RFC cipher name.
# Useful for cross-referencing cipher names between OpenSSL and IANA registries.`);

patch('Cipher & Protocol Listing', 'openssl ciphers -V',
`$ openssl ciphers -V "DEFAULT" | head -5
          0x13,0x02 - TLS_AES_256_GCM_SHA384      TLSv1.3 Kx=any  Au=any  Enc=AESGCM(256) Mac=AEAD
          0x13,0x03 - TLS_CHACHA20_POLY1305_SHA256 TLSv1.3 ...
          0xC0,0x2C - ECDHE-ECDSA-AES256-GCM-SHA384 TLSv1.2 ...
# -V (uppercase) shows the hex cipher ID codes alongside cipher names.
# Useful for matching cipher IDs seen in Wireshark TLS handshake captures.`);

patch('Cipher & Protocol Listing', 'openssl ecparam -list_curves | head',
`$ openssl ecparam -list_curves | head -10
  secp112r1 : SECG/WTLS curve over a 112 bit prime field
  secp112r2 : SECG curve over a 112 bit prime field
  secp128r1 : SECG curve over a 128 bit prime field
  prime192v1: NIST/X9.62/SECG curve over a 192 bit prime field
  secp224k1 : SECG curve over a 224 bit prime field
  prime256v1: X9.62/SECG curve over a 256 bit prime field  (= P-256)
  secp384r1 : NIST/SECG curve over a 384 bit prime field   (= P-384)
  secp521r1 : NIST/SECG curve over a 521 bit prime field   (= P-521)
# Lists all elliptic curves available for ECDSA key generation and ECDH.`);

patch('Cipher & Protocol Listing', 'openssl list -providers',
`$ openssl list -providers
Providers:
  default
    name: OpenSSL Default Provider
    version: 3.0.11
    status: active
# Lists loaded OpenSSL 3.x providers.
# Add -verbose for build/directory information about each provider.`);

// ── TLS Handshake Debugging ────────────────────────────────────────────────────
patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -state',
`$ openssl s_client -connect example.com:443 -servername example.com -state < /dev/null 2>&1 | grep "SSL_connect"
SSL_connect:before SSL initialization
SSL_connect:SSLv3/TLS write client hello
SSL_connect:SSLv3/TLS read server hello
SSL_connect:TLSv1.3 read encrypted extensions
SSL_connect:SSLv3/TLS read server certificate
SSL_connect:SSLv3/TLS read server done
SSL_connect:SSLv3/TLS write finished
SSL_connect:SSLv3/TLS read finished
# -state prints each state transition during the TLS handshake.
# Useful for identifying exactly where a handshake fails.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -status',
`$ openssl s_client -connect example.com:443 -servername example.com -status < /dev/null 2>&1 | grep -A5 "OCSP"
OCSP response:
    OCSP Response Status: successful (0x0)
    Cert Status: Good
    This Update: Jan  1 12:00:00 2026 GMT
# -status requests OCSP stapling; the server sends the stapled OCSP response.
# If "No OCSP response received" — the server does not support OCSP stapling.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -tlsextdebug',
`$ openssl s_client -connect example.com:443 -servername example.com -tlsextdebug < /dev/null 2>&1 | grep "TLS server extension"
TLS server extension "renegotiation info" (id=65281), len=1
TLS server extension "server name" (id=0), len=0
TLS server extension "EC point formats" (id=11), len=4
TLS server extension "session ticket" (id=35), len=0
TLS server extension "supported versions" (id=43), len=2
TLS server extension "key share" (id=51), len=36
# -tlsextdebug shows all TLS extensions in the ServerHello.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -keylogfile ssl-keys.log',
`$ SSLKEYLOGFILE=/tmp/ssl-keys.log openssl s_client -connect example.com:443 -servername example.com < /dev/null
$ head -2 /tmp/ssl-keys.log
CLIENT_HANDSHAKE_TRAFFIC_SECRET 1234abcd... 5678ef01...
SERVER_HANDSHAKE_TRAFFIC_SECRET 1234abcd... 9abc0123...
# Writes TLS 1.3 session keys in NSS key log format.
# Import into Wireshark: Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log`);

patch('TLS Handshake Debugging', 'openssl errstr <hex-code>',
`$ openssl errstr 0x0A000086
error:0A000086:SSL routines::certificate verify failed
$ openssl errstr 0x0A000418
error:0A000418:SSL routines::tlsv1 alert unknown ca
# Translates an OpenSSL hex error code to a human-readable error string.
# Find error codes in output like: 140234...error:0A000086:SSL routines...`);

// ── OCSP & CRL ─────────────────────────────────────────────────────────────────
patch('OCSP & CRL', 'openssl ocsp -index index.txt -CA ca.crt -rsigner ca.crt -rkey ca.key -port 8080',
`$ openssl ocsp -index index.txt -CA ca.crt -rsigner ca.crt -rkey ca.key -port 8080
Waiting for OCSP client connections...
# Starts a simple OCSP responder using the CA's index.txt revocation database.
# index.txt is the OpenSSL CA database (managed by openssl ca command).
# Test: openssl ocsp -issuer ca.crt -cert server.crt -url http://localhost:8080`);

patch('OCSP & CRL', 'openssl ocsp -issuer ca.crt -cert cert.crt -text -url http://ocsp.ca.com -noverify',
`$ openssl ocsp -issuer intermediate.crt -cert server.crt -text -url http://r3.o.lencr.org -noverify 2>/dev/null | grep -E "Cert Status|This Update"
Cert Status: good
This Update: Jan  1 12:00:00 2026 GMT
# -text shows the full decoded OCSP response.
# -noverify skips OCSP response signature verification (useful for testing).`);

patch('OCSP & CRL', 'openssl ocsp -issuer ca.crt -cert cert.crt -url http://ocsp.ca.com -header Host=ocsp.ca.com',
`$ openssl ocsp -issuer intermediate.crt -cert server.crt \
    -url http://10.0.0.1 -header Host=ocsp.example.com 2>/dev/null | grep "Cert Status"
Cert Status: good
# -header Host= sends an HTTP Host header — required when querying by IP address
# or when the OCSP responder uses virtual hosting.`);

patch('OCSP & CRL', 'openssl ocsp -issuer ca.crt -cert cert.crt -respin response.der -text',
`$ openssl ocsp -issuer intermediate.crt -cert server.crt -respin ocsp-response.der -text 2>/dev/null | grep -E "Cert Status|This Update|Next Update"
Cert Status: good
This Update: Jan  1 12:00:00 2026 GMT
Next Update: Jan  8 12:00:00 2026 GMT
# -respin reads a pre-fetched OCSP response binary rather than querying the network.
# Useful for verifying a stapled OCSP response offline.`);

patch('OCSP & CRL', 'openssl crl -in crl.pem -noout -issuer -lastupdate -nextupdate',
`$ openssl crl -in crl.pem -noout -issuer -lastupdate -nextupdate
issuer=C=US, O=Let's Encrypt, CN=R3
lastUpdate=Jan  1 12:00:00 2026 GMT
nextUpdate=Jan  8 12:00:00 2026 GMT
# Quick CRL metadata check — shows who signed it and when it expires.
# Download fresh CRL: curl -O $(openssl x509 -in cert.crt -noout -ext crlDistributionPoints | grep URI | awk '{print $2}')`);

patch('OCSP & CRL', 'openssl crl -in crl.pem -noout -CAfile ca.crt',
`$ openssl crl -in crl.pem -noout -CAfile ca.crt
verify OK
# Verifies the CRL's digital signature against the CA certificate.
# "verify OK" = the CRL was signed by the expected CA.
# Error: "signature failure" = CRL may be forged or from a different CA.`);

patch('OCSP & CRL', 'openssl crl -in crl.pem -noout -text | grep -A1 "Serial Number"',
`$ openssl crl -in crl.pem -noout -text | grep -A1 "Serial Number"
        Serial Number: 04C1D2E3F4A5B6C7
            Revocation Date: Dec 15 10:00:00 2025 GMT
        Serial Number: 04D5E6F7A8B9C0D1
            Revocation Date: Dec 20 09:00:00 2025 GMT
# Lists all revoked certificate serial numbers and their revocation dates.
# Compare against your cert's serial: openssl x509 -in cert.crt -noout -serial`);

// ── Hashing & HMAC ─────────────────────────────────────────────────────────────
patch('Hashing & HMAC', 'openssl dgst -r -sha256 <file>',
`$ openssl dgst -r -sha256 /etc/hostname
9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 */etc/hostname
# -r prints the hash in sha256sum-compatible format (hash then filename).
# Useful for piping into sha256sum --check style scripts.`);

patch('Hashing & HMAC', 'openssl dgst -sha3-512 file.txt',
`$ openssl dgst -sha3-512 document.txt
SHA3-512(document.txt)= a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26
# SHA3-512 uses the Keccak sponge construction — separate design from SHA-2.
# Available in OpenSSL 1.1.1+ and OpenSSL 3.x.`);

patch('Hashing & HMAC', 'openssl dgst -blake2s256 file.txt',
`$ openssl dgst -blake2s256 document.txt
BLAKE2s256(document.txt)= 9aec6806794561107e594b1f6a8a6b0c92a0cba9acf5e5e93cca06f781813b0
# BLAKE2s is designed for 32-bit platforms; BLAKE2b for 64-bit.
# Often faster than SHA-256 in software; used in WireGuard and many modern protocols.`);

patch('Hashing & HMAC', 'openssl dgst -sha256 -hmac "secret" file.txt',
`$ openssl dgst -sha256 -hmac "mysecretkey" message.txt
HMAC-SHA256(message.txt)= 3ecb5de3e83bcb8c9f4a0ac4e24a69a5b5f6c9d0e1f2a3b4c5d6e7f80910a1b2
# Computes HMAC-SHA256 using the string "mysecretkey" as the key.
# HMAC provides integrity + authentication (requires knowledge of the shared key).
# For a hex key: openssl dgst -sha256 -mac HMAC -macopt hexkey:0011223344 file.txt`);

patch('Hashing & HMAC', 'openssl mac -macopt hexkey:00112233 -macopt digest:SHA256 HMAC < file.txt',
`$ echo -n "message" | openssl mac -macopt hexkey:0011223344556677 -macopt digest:SHA256 HMAC
3D8A7B2F9C1E4D6A5B0F8E2C7A3D1B9E4F6C0A8D5E2B7F9C1A4D3B6E8F0A2C5
# OpenSSL 3.x mac subcommand — uses EVP MAC API with a hex-encoded key.
# Supports: HMAC, CMAC, GMAC, POLY1305, SIPHASH.`);

patch('Hashing & HMAC', 'openssl dgst -sha256 -binary file.txt | openssl base64',
`$ openssl dgst -sha256 -binary /etc/hostname | openssl base64
n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=
# Produces the SHA-256 digest as Base64 — useful for HTTP "Digest" headers
# and for comparing with base64-encoded hashes from APIs or configuration files.`);

// ── Symmetric Encryption & Encoding ───────────────────────────────────────────
patch('Symmetric Encryption & Encoding', 'openssl enc -d -aes-256-cbc -pbkdf2 -in file.enc -out file.txt',
`$ openssl enc -d -aes-256-cbc -pbkdf2 -in encrypted.enc -out decrypted.txt
enter aes-256-cbc decryption password:
$ cat decrypted.txt
This is the original plaintext.
# -d flag decrypts; must match the same cipher, -pbkdf2, and password used to encrypt.
# OpenSSL 3.x: -iter <N> can specify the PBKDF2 iteration count explicitly.`);

patch('Symmetric Encryption & Encoding', 'openssl base64 -in <file> -out <out>',
`$ openssl base64 -in binary.dat -out binary.b64
$ cat binary.b64
SGVsbG8gV29ybGQh
# Encodes a binary file to Base64 text with 64-character line wrapping.
# One-liner without line breaks: openssl base64 -in file | tr -d '\n'`);

patch('Symmetric Encryption & Encoding', 'openssl base64 -d -in <file> -out <out>',
`$ openssl base64 -d -in binary.b64 -out binary.dat
$ file binary.dat
binary.dat: data
# Decodes Base64 text back to binary.
# Equivalent to: base64 -d binary.b64 > binary.dat`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-cbc -salt -in <file> -out <enc>',
`$ openssl enc -aes-256-cbc -salt -pbkdf2 -in plaintext.txt -out encrypted.enc
enter aes-256-cbc encryption password:
Verifying - enter aes-256-cbc encryption password:
# -salt adds a random 8-byte salt prefix to the ciphertext (important for PBKDF2).
# Always include -pbkdf2 to use PBKDF2 key derivation (OpenSSL 1.1.1+).`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-cbc -d -in <enc> -out <file>',
`$ openssl enc -aes-256-cbc -d -pbkdf2 -in encrypted.enc -out decrypted.txt
enter aes-256-cbc decryption password:
# Decrypts an AES-256-CBC encrypted file.  Must use the same parameters as encryption.
# If encrypted without -pbkdf2, omit -pbkdf2 on decryption (though deprecated).`);

patch('Symmetric Encryption & Encoding', 'openssl rand -hex 32',
`$ openssl rand -hex 32
a3f8c21d9b04e765c8f2d91a4b30e5879c2a1d3b8f0e4c7d6a5b2e1f9c0d8a7b
# Generates 32 cryptographically random bytes printed as 64 hex characters.
# Useful for AES-256 keys, HMAC secrets, or unique identifiers.`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-gcm -pbkdf2 -in plain.txt -out enc.bin',
`$ openssl enc -aes-256-gcm -pbkdf2 -in plaintext.txt -out encrypted.bin
enter aes-256-gcm encryption password:
Verifying - enter aes-256-gcm encryption password:
# AES-256-GCM provides authenticated encryption — integrity built in.
# Decrypt: openssl enc -d -aes-256-gcm -pbkdf2 -in encrypted.bin -out decrypted.txt`);

patch('Symmetric Encryption & Encoding', 'openssl enc -d -aes-256-gcm -pbkdf2 -in enc.bin -out plain.txt',
`$ openssl enc -d -aes-256-gcm -pbkdf2 -in encrypted.bin -out decrypted.txt
enter aes-256-gcm decryption password:
# Decrypts an AES-256-GCM encrypted file (authenticated decryption).
# Tampered ciphertext will fail with an authentication error.`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-ctr -pbkdf2 -in plain.txt -out enc.bin',
`$ openssl enc -aes-256-ctr -pbkdf2 -in plaintext.txt -out encrypted.bin
enter aes-256-ctr encryption password:
# AES-CTR mode: stream cipher mode — no padding, efficient for large files.
# CTR mode does not include authentication — pair with an HMAC for integrity.`);

patch('Symmetric Encryption & Encoding', 'openssl enc -chacha20 -pbkdf2 -in plain.txt -out enc.bin',
`$ openssl enc -chacha20 -pbkdf2 -in plaintext.txt -out encrypted.bin
enter chacha20 encryption password:
# ChaCha20 stream cipher — fast on CPUs without AES-NI hardware acceleration.
# For authenticated encryption, use chacha20-poly1305 instead (AEAD).`);

// ── Digital Signatures ─────────────────────────────────────────────────────────
patch('Digital Signatures', 'openssl pkeyutl -sign -inkey private.key -in hash.bin -out sig.bin -pkeyopt digest:sha256',
`$ openssl dgst -sha256 -binary document.txt > hash.bin
$ openssl pkeyutl -sign -inkey server.key -in hash.bin -out sig.bin -pkeyopt digest:sha256
$ ls -lh sig.bin
-rw-r--r-- 1 user user 256 Jan  1 12:00 sig.bin
# Signs a pre-computed hash using RSA PKCS#1 v1.5 with SHA-256.
# pkeyutl works with RSA, EC (ECDSA), and Ed25519 keys.`);

patch('Digital Signatures', 'openssl pkeyutl -sign -inkey rsa.key -in hash.bin -out sig.bin -pkeyopt rsa_padding_mode:pss -pkeyopt rsa_pss_saltlen:digest',
`$ openssl pkeyutl -sign -inkey server.key -in hash.bin -out sig.bin \
    -pkeyopt rsa_padding_mode:pss -pkeyopt rsa_pss_saltlen:digest
$ ls -lh sig.bin
-rw-r--r-- 1 user user 256 Jan  1 12:00 sig.bin
# RSA-PSS signature — probabilistic padding, required by TLS 1.3 and X.509 v3.
# -pkeyopt rsa_pss_saltlen:digest = salt length equals the hash output length.`);

patch('Digital Signatures', 'openssl cms -sign -in file.txt -signer cert.crt -inkey private.key -out signed.p7s -outform DER',
`$ openssl cms -sign -in document.txt -signer server.crt -inkey server.key \
    -out signed.p7s -outform DER
$ ls -lh signed.p7s
-rw-r--r-- 1 user user 3.4K Jan  1 12:00 signed.p7s
# Creates a detached CMS/S/MIME signature in DER format.
# Verify: openssl cms -verify -in signed.p7s -inform DER -content document.txt -CAfile ca.crt`);

patch('Digital Signatures', 'openssl cms -verify -in signed.p7s -inform DER -content file.txt -CAfile ca.crt',
`$ openssl cms -verify -in signed.p7s -inform DER -content document.txt -CAfile ca.crt
Verification successful
# "Verification successful" = signature is valid and signer cert is trusted.
# The -content flag provides the original data for detached signatures.`);

// ── Performance & Benchmarks ───────────────────────────────────────────────────
patch('Performance & Benchmarks', 'openssl speed rsa4096',
`$ openssl speed rsa4096 2>/dev/null | tail -3
Doing 4096 bit private rsa's for 10s: 312 4096 bit private RSA's in 10.00s
Doing 4096 bit public rsa's for 10s: 18432 4096 bit public RSA's in 10.00s
                  sign    verify    sign/s verify/s
rsa 4096 bits  0.032051s 0.000543s     31.2   1843.2
# 4096-bit RSA is roughly 8x slower than 2048-bit for signing operations.
# sign/s = server-side TLS handshake rate; verify/s = client side (much cheaper).`);

patch('Performance & Benchmarks', 'openssl speed ecdsap384 ecdhp384',
`$ openssl speed ecdsap384 ecdhp384 2>/dev/null | grep -E "sign|ecdh"
                        sign    verify    sign/s verify/s
 384 bit ecdsa (P-384) 0.0000842s 0.0001741s  11876.0  5742.5
                              op      op/s
 384 bit ecdh (P-384)  0.0000892s  11211.2
# P-384 provides ~192-bit security — required for Suite B / CNSS Policy 15.
# P-384 is ~2x slower than P-256 for both signing and key agreement.`);

patch('Performance & Benchmarks', 'openssl speed -async_jobs 8 rsa2048',
`$ openssl speed -async_jobs 8 rsa2048 2>/dev/null | tail -3
Doing 2048 bit private rsa's for 10s (8 async jobs): 3072 2048 bit private RSA's in 10.00s
                  sign    verify    sign/s verify/s
rsa 2048 bits  0.003255s 0.000091s    307.2  13107.2
# -async_jobs enables asynchronous mode for engines that support it (e.g. QAT).
# On standard CPUs without async hardware, throughput may be similar to synchronous.`);

patch('Performance & Benchmarks', 'openssl speed -multi 4 -evp aes-256-gcm',
`$ openssl speed -multi 4 -evp aes-256-gcm 2>/dev/null | tail -3
type             16 bytes     64 bytes    256 bytes   1024 bytes   8192 bytes  16384 bytes
aes-256-gcm    298240.00k  1048576.00k  3166208.00k  8601600.00k 12353536.00k 12845056.00k
# -multi 4 runs 4 parallel benchmark threads — shows aggregate throughput.
# Replace 4 with $(nproc) to benchmark using all available CPU cores.`);

// ── Providers & FIPS (OpenSSL 3+) ─────────────────────────────────────────────
patch('Providers & FIPS (OpenSSL 3+)', 'openssl fipsinstall -out fipsmodule.cnf -module /usr/lib64/ossl-modules/fips.so',
`$ openssl fipsinstall -out /etc/ssl/fipsmodule.cnf -module /usr/lib64/ossl-modules/fips.so
INSTALL PASSED
# Validates and installs the FIPS provider module.
# Generates fipsmodule.cnf with the HMAC integrity check value for the FIPS .so.
# Must be re-run after OS/package updates that replace the FIPS module binary.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl fipsinstall -in fipsmodule.cnf -verify',
`$ openssl fipsinstall -in /etc/ssl/fipsmodule.cnf -verify
VERIFY PASSED
# Verifies that the FIPS module's HMAC matches the value in fipsmodule.cnf.
# "VERIFY PASSED" = the FIPS .so has not been tampered with since installation.
# Run after any system update that might have touched the FIPS library.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl list -kdf-algorithms',
`$ openssl list -kdf-algorithms | head -8
HKDF
PBKDF2
SCRYPT
SSHKDF
TLS1-PRF
SSKDF
X942KDF-ASN1
ARGON2D
# Lists available Key Derivation Function (KDF) algorithms.
# PBKDF2 and HKDF are most common; ARGON2D requires the legacy or argon2 provider.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl kdf -keylen 32 -kdfopt digest:SHA256 -kdfopt key:password -kdfopt salt:salt -kdfopt iter:100000 PBKDF2',
`$ openssl kdf -keylen 32 -kdfopt digest:SHA256 -kdfopt key:password \
    -kdfopt salt:saltsalt -kdfopt iter:100000 PBKDF2 | xxd | head -2
00000000: 3c4f 9a1b 2d5e 6f78 90ab c1d2 e3f4 a5b6  <O..-^ox........
00000010: c7d8 e9f0 a1b2 c3d4 e5f6 0102 0304 0506  ................
# Derives a 32-byte key using PBKDF2-SHA256 with 100,000 iterations.
# OpenSSL 3.x kdf subcommand replaces manual EVP_KDF API usage for testing.`);

// Write output
data.updatedAt = new Date().toISOString();
writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('OpenSSL patch 2 applied successfully.');
