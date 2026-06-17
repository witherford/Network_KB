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

// ── Key Generation ─────────────────────────────────────────────────────────────
patch('Key Generation', 'openssl ecparam -name secp384r1 -genkey -noout -out ec.key',
`$ openssl ecparam -name secp384r1 -genkey -noout -out ec.key
$ ls -lh ec.key
-rw------- 1 user user 306 Jan  1 12:00 ec.key
# No stdout on success — key is written directly to ec.key.
# P-384 provides ~192-bit security, preferred for government/NIST compliance.`);

patch('Key Generation', 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key',
`$ openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key
.........................+++
.......+++
$ ls -lh rsa3072.key
-rw------- 1 user user 1.7K Jan  1 12:00 rsa3072.key
# 3072-bit RSA provides ~128-bit equivalent security (NIST minimum for 2030+).`);

patch('Key Generation', 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out rsa4096.key',
`$ openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out rsa4096.key
Enter PEM pass phrase:
Verifying - Enter PEM pass phrase:
.....................................................................+++
# Key is encrypted with AES-256-CBC using the supplied passphrase.
# Strip passphrase later: openssl rsa -in rsa4096.key -out rsa4096-nopass.key`);

patch('Key Generation', 'openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-384 -out ec384.key',
`$ openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-384 -out ec384.key
$ openssl pkey -in ec384.key -text -noout | head -3
Private-Key: (384 bit)
priv:
    XX:XX:XX:XX:XX:XX:XX:XX...`);

patch('Key Generation', 'openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-521 -out ec521.key',
`$ openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-521 -out ec521.key
$ openssl pkey -in ec521.key -text -noout | head -2
Private-Key: (521 bit)
# P-521 offers ~260-bit security — highest standard NIST curve.`);

patch('Key Generation', 'openssl genpkey -algorithm X25519 -out x25519.key',
`$ openssl genpkey -algorithm X25519 -out x25519.key
$ openssl pkey -in x25519.key -text -noout
X25519 Private-Key:
priv:
    XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
    XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
# X25519 (Curve25519 ECDH) is used for key exchange in TLS 1.3.`);

patch('Key Generation', 'openssl genpkey -algorithm X448 -out x448.key',
`$ openssl genpkey -algorithm X448 -out x448.key
# X448 (Curve448 ECDH) provides ~224-bit security — stronger than X25519.
# Supported in TLS 1.3 but less widely deployed than X25519.`);

patch('Key Generation', 'openssl genpkey -algorithm ed448 -out ed448.key',
`$ openssl genpkey -algorithm ed448 -out ed448.key
$ openssl pkey -in ed448.key -text -noout | head -2
ED448 Private-Key:
# Ed448 (Edwards-curve DSA) is used for digital signatures — not key exchange.`);

patch('Key Generation', 'openssl ecparam -name prime256v1 -out ecparams.pem',
`$ openssl ecparam -name prime256v1 -out ecparams.pem
$ cat ecparams.pem
-----BEGIN EC PARAMETERS-----
BggqhkjOPQMBBw==
-----END EC PARAMETERS-----
# Saves the P-256 curve parameters to a standalone PEM file.
# Used with: openssl ecparam -in ecparams.pem -genkey -noout -out ec.key`);

patch('Key Generation', 'openssl rand -hex 16',
`$ openssl rand -hex 16
a3f8c21d9b04e765c8f2d91a4b30e587
# Generates 16 cryptographically random bytes and prints 32 hex characters.
# Useful for generating IVs, nonces, API keys, or session tokens.
# For base64 output: openssl rand -base64 32`);

// ── Key Inspection & Manipulation ─────────────────────────────────────────────
patch('Key Inspection & Manipulation', 'openssl genrsa -out <key> 2048',
`$ openssl genrsa -out server.key 2048
Generating RSA private key, 2048 bit long modulus (2 primes)
...+++++
.....+++++
e is 65537 (0x010001)
# Generates a 2048-bit RSA key using the legacy genrsa command.
# Prefer genpkey for new keys: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`);

patch('Key Inspection & Manipulation', 'openssl genpkey -algorithm RSA -out <key>',
`$ openssl genpkey -algorithm RSA -out server.key
..................................................................+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*
# Generates a default 2048-bit RSA key using the modern genpkey API.
# Specify size: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out server.key`);

patch('Key Inspection & Manipulation', 'openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out <key>',
`$ openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out ec.key
$ ls -lh ec.key
-rw------- 1 user user 227 Jan  1 12:00 ec.key
# Generates a P-256 (prime256v1) ECDSA private key.
# P-256 keys are ~4x smaller than 3072-bit RSA with equivalent security.`);

patch('Key Inspection & Manipulation', 'openssl rsa -in private.key -check',
`$ openssl rsa -in server.key -check
RSA key ok
# Verifies the mathematical consistency of an RSA private key.
# Returns "RSA key ok" for a valid key; prints errors for a corrupted key.
# For EC keys: openssl ec -in ec.key -check`);

patch('Key Inspection & Manipulation', 'openssl rsa -in private.key -pubout -out public.key',
`$ openssl rsa -in server.key -pubout -out public.key
writing RSA key
$ cat public.key
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
# Extracts the public key from an RSA private key in SubjectPublicKeyInfo (SPKI) format.`);

patch('Key Inspection & Manipulation', 'openssl pkey -in private.key -text -noout',
`$ openssl pkey -in server.key -text -noout
Private-Key: (2048 bit, 2 primes)
modulus:
    00:c1:d3:4a:...
publicExponent: 65537 (0x10001)
privateExponent:
    ...
prime1: ...
prime2: ...
# Dumps full key parameters in human-readable text.
# Works for RSA, EC, Ed25519, X25519 — a unified alternative to openssl rsa -text.`);

patch('Key Inspection & Manipulation', 'openssl pkey -in private.key -noout -text -pubout',
`$ openssl pkey -in server.key -noout -text -pubout
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
Key details:
Public-Key: (2048 bit)
# Combines -text and -pubout to show key info and extract the public key.`);

patch('Key Inspection & Manipulation', 'openssl ec -in ec.key -noout -text',
`$ openssl ec -in ec.key -noout -text
read EC key
Private-Key: (256 bit)
priv:
    a1:b2:c3:d4:e5:f6:...
pub:
    04:aa:bb:cc:dd:...
ASN1 OID: prime256v1
NIST CURVE: P-256
# Shows EC key parameters including the curve name and raw key bytes.`);

patch('Key Inspection & Manipulation', 'openssl pkey -in private.key -noout -check',
`$ openssl pkey -in server.key -noout -check
Key is valid
# Validates a private key (any type) using the modern pkey interface.
# Returns "Key is valid" for a well-formed key; error message otherwise.`);

// ── CSR & Certificate Signing ──────────────────────────────────────────────────
patch('CSR & Certificate Signing', 'openssl req -new -key private.key -out req.csr -subj /C=GB/ST=London/O=Acme/CN=example.com',
`$ openssl req -new -key server.key -out server.csr -subj "/C=GB/ST=London/O=Acme Ltd/CN=example.com"
$ openssl req -in server.csr -noout -subject
subject=C=GB, ST=London, O=Acme Ltd, CN=example.com
# Creates a CSR with all subject fields specified inline.
# Submit server.csr to your CA to receive a signed certificate.`);

patch('CSR & Certificate Signing', 'openssl x509 -req -in req.csr -CA ca.crt -CAkey ca.key -extfile san.ext -out cert.crt -days 365',
`$ openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
    -extfile san.ext -CAcreateserial -out server.crt -days 365
Signature ok
subject=C=GB, ST=London, O=Acme Ltd, CN=example.com
Getting CA Private Key
# san.ext example content:
# subjectAltName = DNS:example.com, DNS:www.example.com, IP:10.0.0.1
# -CAcreateserial auto-creates ca.srl to track the certificate serial number.`);

patch('CSR & Certificate Signing', 'openssl req -new -key private.key -out req.csr -config openssl-san.cnf',
`# openssl-san.cnf:
# [req]
# distinguished_name = req_distinguished_name
# req_extensions = v3_req
# [req_distinguished_name]
# [v3_req]
# subjectAltName = @alt_names
# [alt_names]
# DNS.1 = example.com
# DNS.2 = www.example.com
$ openssl req -new -key server.key -out server.csr -config openssl-san.cnf
# Embeds SANs in the CSR — some CAs will honour them; others use their own policy.`);

patch('CSR & Certificate Signing', 'openssl req -x509 -new -nodes -key ca.key -sha256 -days 1825 -out ca.crt -subj "/C=GB/O=Acme/CN=Acme Root CA"',
`$ openssl req -x509 -new -nodes -key ca.key -sha256 -days 1825 \
    -out ca.crt -subj "/C=GB/O=Acme Ltd/CN=Acme Root CA"
$ openssl x509 -in ca.crt -noout -subject -issuer
subject=C=GB, O=Acme Ltd, CN=Acme Root CA
issuer=C=GB, O=Acme Ltd, CN=Acme Root CA
# Creates a self-signed root CA certificate valid for 5 years.
# -nodes = no passphrase on the CA key (only appropriate for lab/test CAs).`);

patch('CSR & Certificate Signing', 'openssl req -in req.csr -noout -text',
`$ openssl req -in server.csr -noout -text
Certificate Request:
    Data:
        Version: 1 (0x0)
        Subject: C=GB, ST=London, O=Acme Ltd, CN=example.com
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                Public-Key: (2048 bit)
        Requested Extensions:
            X509v3 Subject Alternative Name:
                DNS:example.com, DNS:www.example.com
# Displays the full decoded contents of a CSR before submission to a CA.`);

// ── Certificate Inspection ─────────────────────────────────────────────────────
patch('Certificate Inspection', 'openssl x509 -in cert.crt -text -noout',
`$ openssl x509 -in server.crt -text -noout
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number: 04:c1:d2:...
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: C=US, O=Let's Encrypt, CN=R3
        Validity
            Not Before: Jan  1 00:00:00 2026 GMT
            Not After : Apr  1 00:00:00 2026 GMT
        Subject: CN=example.com
        X509v3 Subject Alternative Name:
            DNS:example.com, DNS:www.example.com
        X509v3 Key Usage: Digital Signature, Key Encipherment
# Full decoded certificate dump — shows SANs, key usage, validity, issuer chain.`);

patch('Certificate Inspection', 'openssl crl2pkcs7 -nocrl -certfile chain.pem | openssl pkcs7 -print_certs -noout',
`$ openssl crl2pkcs7 -nocrl -certfile chain.pem | openssl pkcs7 -print_certs -noout
subject=CN=example.com
issuer=CN=R3, O=Let's Encrypt, C=US

subject=CN=R3, O=Let's Encrypt, C=US
issuer=CN=ISRG Root X1, O=Internet Security Research Group, C=US
# Lists all certificates in a PEM bundle with their subject and issuer.
# Useful for verifying a full certificate chain is present.`);

patch('Certificate Inspection', 'openssl x509 -in <cert> -text -noout',
`$ openssl x509 -in example.crt -text -noout
Certificate:
    Data:
        Version: 3 (0x2)
        Subject: CN=example.com
        X509v3 Subject Alternative Name:
            DNS:example.com, DNS:www.example.com
        Validity
            Not After : Apr  1 00:00:00 2026 GMT
# Generic form using a variable — substitute <cert> with the actual filename.`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -serial',
`$ openssl x509 -in server.crt -noout -serial
serial=04C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6
# Prints only the certificate serial number in hex.
# Used when checking revocation status (CRL/OCSP) by serial number.`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -issuer',
`$ openssl x509 -in server.crt -noout -issuer
issuer=C=US, O=Let's Encrypt, CN=R3
# Prints only the Issuer distinguished name.
# The issuer must match the subject of the next certificate in the chain.`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -subject',
`$ openssl x509 -in server.crt -noout -subject
subject=CN=example.com
# Prints only the Subject distinguished name.
# For multi-SAN certs the CN is often just the primary domain.`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -fingerprint -sha256',
`$ openssl x509 -in server.crt -noout -fingerprint -sha256
SHA256 Fingerprint=A1:B2:C3:D4:E5:F6:...:00
# Computes the SHA-256 fingerprint of the DER-encoded certificate.
# Compare against the fingerprint shown in a browser's certificate details
# to confirm you are looking at the same certificate.`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -pubkey',
`$ openssl x509 -in server.crt -noout -pubkey
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
# Extracts and prints the SubjectPublicKeyInfo (SPKI) from the certificate.
# Compare hash with the key file: openssl x509 -noout -pubkey -in cert.crt | openssl dgst -sha256`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -purpose',
`$ openssl x509 -in server.crt -noout -purpose
Certificate purposes:
SSL client : No
SSL client CA : No
SSL server : Yes
SSL server CA : No
Netscape SSL server : Yes
S/MIME signing : No
S/MIME encryption : No
CRL signing : No
Any Purpose : Yes
OCSP helper : No
Time Stamp signing : No
# Shows the certificate's intended purposes based on Key Usage and EKU extensions.`);

patch('Certificate Inspection', 'openssl x509 -in cert.crt -noout -ext subjectAltName',
`$ openssl x509 -in server.crt -noout -ext subjectAltName
X509v3 Subject Alternative Name:
    DNS:example.com, DNS:www.example.com, DNS:api.example.com
# Extracts and displays only the SAN extension (OpenSSL 1.1.1+).
# Older: openssl x509 -text -noout -in cert.crt | grep -A1 "Subject Alternative"`);

// ── Verification & Matching ────────────────────────────────────────────────────
patch('Verification & Matching', 'openssl verify -CAfile ca.crt cert.crt',
`$ openssl verify -CAfile ca.crt server.crt
server.crt: OK
# Verifies server.crt against the CA certificate in ca.crt.
# "OK" means the signature and chain are valid; error messages include the reason.
# For a chain: use -CAfile with the root and intermediate CAs concatenated.`);

patch('Verification & Matching', 'openssl verify -CAfile ca.crt -untrusted intermediate.crt cert.crt',
`$ openssl verify -CAfile root-ca.crt -untrusted intermediate.crt server.crt
server.crt: OK
# Verifies the full chain: server.crt signed by intermediate.crt signed by root-ca.crt.
# -untrusted provides intermediate CAs that are not directly trusted anchors.
# Multiple intermediates: -untrusted int1.crt -untrusted int2.crt`);

patch('Verification & Matching', 'openssl x509 -noout -modulus -in cert.crt | openssl md5',
`$ openssl x509 -noout -modulus -in server.crt | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
$ openssl rsa -noout -modulus -in server.key | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
# If both MD5 hashes match, the certificate and private key are a pair.
# For EC keys: openssl ec -noout -pubout -in ec.key | openssl md5`);

patch('Verification & Matching', 'openssl x509 -noout -modulus -in cert.crt | openssl sha256',
`$ openssl x509 -noout -modulus -in server.crt | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
$ openssl rsa -noout -modulus -in server.key | openssl sha256
(stdin)= 3c4f9a1b2d5e6f7890abc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789012345678
# SHA-256 variant of the key-cert pairing check — more collision-resistant than MD5.`);

patch('Verification & Matching', 'openssl pkey -pubout -in private.key | openssl md5',
`$ openssl pkey -pubout -in server.key | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
$ openssl x509 -noout -pubkey -in server.crt | openssl md5
(stdin)= a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
# Works for RSA, EC, Ed25519 — a universal key-cert pairing check.
# Preferred over the -modulus approach for non-RSA keys.`);

patch('Verification & Matching', 'openssl s_client -connect host:443 -CAfile ca.crt < /dev/null 2>&1 | grep "Verify return code"',
`$ openssl s_client -connect example.com:443 -CAfile /etc/ssl/certs/ca-certificates.crt < /dev/null 2>&1 | grep "Verify return code"
    Verify return code: 0 (ok)
# 0 (ok) = chain verified successfully.
# 21 = unable to verify the first certificate (missing intermediate).
# 10 = certificate has expired.
# 19 = self-signed cert in chain.`);

patch('Verification & Matching', 'openssl x509 -checkend 86400 -noout -in cert.crt',
`$ openssl x509 -checkend 86400 -noout -in server.crt
Certificate will not expire
$ echo $?
0
# Checks if the certificate expires within the next 86400 seconds (24 hours).
# Exit code 0 = valid; exit code 1 = certificate expires within the window.
# Useful in cron jobs / monitoring: checkend $((30*86400)) to warn 30 days early.`);

patch('Verification & Matching', 'openssl s_client -connect host:443 -verify_return_error < /dev/null',
`$ openssl s_client -connect expired.badssl.com:443 -verify_return_error < /dev/null
...
verify error:num=10:certificate has expired
140436483567296:error:1416F086:SSL routines:tls_process_server_certificate:certificate verify failed
# -verify_return_error causes s_client to exit with a non-zero code on verify failure.
# Useful in scripts to test certificate validity without parsing output.`);

patch('Verification & Matching', 'openssl s_client -connect host:443 -showcerts < /dev/null 2>/dev/null | openssl x509 -noout -issuer -subject',
`$ openssl s_client -connect example.com:443 -showcerts < /dev/null 2>/dev/null | openssl x509 -noout -issuer -subject
issuer=C=US, O=Let's Encrypt, CN=R3
subject=CN=example.com
# Fetches the live certificate from a TLS endpoint and shows its issuer/subject.
# For the full chain: remove | openssl x509 ... and pipe to grep "subject\|issuer"`);

patch('Verification & Matching', 'diff <(openssl x509 -pubkey -noout -in cert.crt) <(openssl pkey -pubout -in key.pem)',
`$ diff <(openssl x509 -pubkey -noout -in server.crt) <(openssl pkey -pubout -in server.key)
(no output = files match)
# Compares public keys extracted from the certificate and the private key.
# Any output means the cert and key do NOT match — a critical misconfiguration.`);

patch('Verification & Matching', 'openssl verify -purpose sslserver -CAfile ca-bundle.crt cert.crt',
`$ openssl verify -purpose sslserver -CAfile /etc/ssl/certs/ca-certificates.crt server.crt
server.crt: OK
# -purpose sslserver verifies that the certificate is authorised for TLS server use.
# Checks Extended Key Usage (EKU) for id-kp-serverAuth (OID 1.3.6.1.5.5.7.3.1).
# Failure: "certificate rejected — invalid purpose"`);

// ── Format Conversion ──────────────────────────────────────────────────────────
patch('Format Conversion', 'openssl x509 -in cert.der -inform DER -out cert.pem -outform PEM',
`$ openssl x509 -in server.der -inform DER -out server.pem -outform PEM
$ head -1 server.pem
-----BEGIN CERTIFICATE-----
# Converts a DER-encoded (binary) certificate to PEM (Base64 + header/footer).
# PEM is the most common format for Linux/Apache/Nginx; DER is used by Java and Windows.`);

patch('Format Conversion', 'openssl x509 -in cert.pem -outform DER -out cert.der',
`$ openssl x509 -in server.pem -outform DER -out server.der
$ file server.der
server.der: data
# Converts PEM to DER binary format.
# DER files do not have the -----BEGIN/END----- headers.`);

patch('Format Conversion', 'openssl pkcs12 -in bundle.pfx -out cert.pem -nodes',
`$ openssl pkcs12 -in bundle.pfx -out bundle.pem -nodes
Enter Import Password:
MAC verified OK
$ grep "BEGIN" bundle.pem
-----BEGIN CERTIFICATE-----
-----BEGIN CERTIFICATE-----
-----BEGIN PRIVATE KEY-----
# -nodes = no passphrase on the extracted private key.
# The output PEM contains all certs in the chain plus the private key.`);

patch('Format Conversion', 'openssl pkcs12 -in bundle.pfx -nokeys -out cert.pem',
`$ openssl pkcs12 -in bundle.pfx -nokeys -out certs-only.pem
Enter Import Password:
MAC verified OK
$ grep "BEGIN" certs-only.pem
-----BEGIN CERTIFICATE-----
-----BEGIN CERTIFICATE-----
# Extracts only the certificate(s) — private key is not written to the output file.`);

patch('Format Conversion', 'openssl pkcs12 -in bundle.pfx -nocerts -out private.key -nodes',
`$ openssl pkcs12 -in bundle.pfx -nocerts -out private.key -nodes
Enter Import Password:
MAC verified OK
$ grep "BEGIN" private.key
-----BEGIN PRIVATE KEY-----
# Extracts only the private key — no certificate data in the output.`);

patch('Format Conversion', 'openssl rsa -in encrypted.key -out decrypted.key',
`$ openssl rsa -in encrypted.key -out decrypted.key
Enter pass phrase for encrypted.key:
writing RSA key
# Removes the passphrase from an encrypted RSA private key.
# Output is a plaintext PEM RSA key — secure the file with filesystem permissions.`);

patch('Format Conversion', 'openssl rsa -in private.key -des3 -out encrypted.key',
`$ openssl rsa -in server.key -des3 -out server-encrypted.key
writing RSA key
Enter PEM pass phrase:
Verifying - Enter PEM pass phrase:
$ head -2 server-encrypted.key
-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
# Adds DES3 passphrase encryption to an existing RSA private key.`);

patch('Format Conversion', 'openssl pkcs7 -in bundle.p7b -print_certs -out chain.pem',
`$ openssl pkcs7 -in bundle.p7b -inform DER -print_certs -out chain.pem
$ grep "BEGIN" chain.pem
-----BEGIN CERTIFICATE-----
-----BEGIN CERTIFICATE-----
# Converts a PKCS#7 / CMS .p7b bundle (common in Windows) to PEM format.
# If the .p7b is PEM-encoded, omit -inform DER.`);

patch('Format Conversion', 'openssl pkcs8 -topk8 -in private.key -out private-pkcs8.key -nocrypt',
`$ openssl pkcs8 -topk8 -in server.key -out server-pkcs8.key -nocrypt
$ head -1 server-pkcs8.key
-----BEGIN PRIVATE KEY-----
# Converts a traditional RSA key (PKCS#1) to PKCS#8 unencrypted format.
# PKCS#8 is required by Java KeyStore, Node.js, and many modern frameworks.
# For an encrypted output: omit -nocrypt and supply a passphrase when prompted.`);

patch('Format Conversion', 'openssl pkcs12 -export -out bundle.pfx -inkey private.key -in cert.crt -certfile chain.crt -name "my-cert"',
`$ openssl pkcs12 -export -out bundle.pfx \
    -inkey server.key -in server.crt \
    -certfile intermediate.crt -name "example.com"
Enter Export Password:
Verifying - Enter Export Password:
$ ls -lh bundle.pfx
-rw------- 1 user user 4.1K Jan  1 12:00 bundle.pfx
# Creates a PKCS#12 (.pfx/.p12) bundle with the cert, key, and chain.
# -name sets the "friendly name" visible in Windows Certificate Manager.`);

// ── TLS Client Testing ─────────────────────────────────────────────────────────
patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -CAfile ca.crt',
`$ openssl s_client -connect example.com:443 -CAfile /etc/ssl/certs/ca-certificates.crt < /dev/null
CONNECTED(00000003)
depth=2 CN=ISRG Root X1
depth=1 CN=R3
depth=0 CN=example.com
verify return:1
...
SSL handshake has read 4738 bytes and written 413 bytes
---
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
    Verify return code: 0 (ok)
---`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -cipher ECDHE-RSA-AES256-GCM-SHA384',
`$ openssl s_client -connect example.com:443 -cipher ECDHE-RSA-AES256-GCM-SHA384 < /dev/null 2>&1 | grep -E "Cipher|error"
New, TLSv1.2, Cipher is ECDHE-RSA-AES256-GCM-SHA384
# Tests whether the server accepts a specific TLS 1.2 cipher suite.
# If the cipher is not supported: no peer certificate available / handshake failure.`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 2>/dev/null | openssl x509 -noout -text',
`$ openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -text
Certificate:
    Data:
        Subject: CN=example.com
        Validity
            Not Before: Jan  1 00:00:00 2026 GMT
            Not After : Apr  1 00:00:00 2026 GMT
        X509v3 Subject Alternative Name:
            DNS:example.com, DNS:www.example.com
# Fetches and fully decodes the server's leaf certificate from a live connection.`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -servername hostname',
`$ openssl s_client -connect 10.0.0.10:443 -servername example.com < /dev/null 2>&1 | grep "subject="
subject=CN=example.com
# -servername sends the TLS SNI extension — required for virtual-hosted HTTPS.
# Without SNI, the server may return the default (wrong) certificate.
# Always include -servername when testing a named virtual host.`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -tls1_2',
`$ openssl s_client -connect example.com:443 -tls1_2 < /dev/null 2>&1 | grep -E "Protocol|Cipher|error"
Protocol  : TLSv1.2
Cipher    : ECDHE-RSA-AES256-GCM-SHA384
# Forces TLS 1.2 — useful for confirming the server still accepts TLS 1.2.
# If TLS 1.2 is disabled: "no protocols available" or "handshake failure".`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -tls1_3',
`$ openssl s_client -connect example.com:443 -tls1_3 < /dev/null 2>&1 | grep -E "Protocol|Cipher"
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
# Forces TLS 1.3 only — confirms the server supports the latest protocol version.`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -starttls smtp',
`$ openssl s_client -connect mail.example.com:587 -starttls smtp < /dev/null 2>&1 | grep -E "Protocol|Verify"
Protocol  : TLSv1.3
    Verify return code: 0 (ok)
# Tests STARTTLS upgrade on SMTP port 587.
# Other protocols: -starttls ftp, -starttls pop3, -starttls imap, -starttls ldap`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -status',
`$ openssl s_client -connect example.com:443 -status < /dev/null 2>&1 | grep -A5 "OCSP response"
OCSP response:
======================================
OCSP Response Data:
    OCSP Response Status: successful (0x0)
    Cert Status: Good
    This Update: Jan  1 12:00:00 2026 GMT
# -status requests OCSP stapling from the server during the TLS handshake.
# "Cert Status: Good" confirms the certificate is not revoked.`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -alpn h2',
`$ openssl s_client -connect example.com:443 -alpn h2 < /dev/null 2>&1 | grep "ALPN"
ALPN protocol: h2
# -alpn h2 advertises HTTP/2 via the ALPN TLS extension.
# "h2" in the response confirms the server supports HTTP/2.
# For HTTP/1.1 only: -alpn http/1.1`);

patch('TLS Client Testing', 'openssl s_client -connect hostname:443 -brief',
`$ openssl s_client -connect example.com:443 -brief < /dev/null
CONNECTION ESTABLISHED
Protocol version: TLSv1.3
Ciphersuite: TLS_AES_256_GCM_SHA384
Peer certificate: CN=example.com
Hash used: SHA256
Signature type: RSA-PSS
    Verify return code: 0 (ok)
# -brief gives a compact one-screen summary — useful for quick connectivity checks.`);

// ── TLS Server Testing ─────────────────────────────────────────────────────────
patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -www',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -www
Using default temp DH parameters
ACCEPT
# Starts a test HTTPS server on port 4433.
# Test with: curl -k https://localhost:4433
# The -www flag returns an HTML page with TLS session details.`);

patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -CAfile ca.crt -Verify 1',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -CAfile ca.crt -Verify 1
Using default temp DH parameters
ACCEPT
# -Verify 1 enables mutual TLS (mTLS) — client must present a certificate.
# -CAfile specifies the CA used to verify client certificates.
# Capital -Verify = require client cert; lowercase -verify = request but don't require.`);

patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -tls1_3',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -tls1_3
Using default temp DH parameters
ACCEPT
# Restricts the test server to TLS 1.3 only.
# Useful for verifying client TLS 1.3 support in isolation.`);

patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -cipher ECDHE-RSA-AES256-GCM-SHA384',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -cipher ECDHE-RSA-AES256-GCM-SHA384
Using default temp DH parameters
ACCEPT
# Restricts the test server to a specific TLS 1.2 cipher suite.
# Connect with: openssl s_client -connect localhost:4433 -cipher ECDHE-RSA-AES256-GCM-SHA384`);

patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -no_tls1 -no_tls1_1',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -no_tls1 -no_tls1_1
Using default temp DH parameters
ACCEPT
# Disables TLS 1.0 and TLS 1.1 on the test server.
# Only TLS 1.2 and TLS 1.3 connections are accepted.
# Use to simulate a hardened server for client compatibility testing.`);

patch('TLS Server Testing', 'openssl s_server -accept 4433 -cert cert.crt -key private.key -verify_return_error',
`$ openssl s_server -accept 4433 -cert server.crt -key server.key -CAfile ca.crt -Verify 1 -verify_return_error
Using default temp DH parameters
ACCEPT
ERROR
140412345678901:error:...verify failed...
# -verify_return_error causes the server to abort if client cert verification fails.
# Without it, the server logs the error but continues the handshake.`);

// ── Cipher & Protocol Listing ──────────────────────────────────────────────────
patch('Cipher & Protocol Listing', 'openssl ciphers -v "ALL:!aNULL:!eNULL"',
`$ openssl ciphers -v "ALL:!aNULL:!eNULL" | head -5
TLS_AES_256_GCM_SHA384    TLSv1.3 Kx=any  Au=any  Enc=AESGCM(256) Mac=AEAD
TLS_CHACHA20_POLY1305_SHA256 TLSv1.3 Kx=any  Au=any  Enc=CHACHA20/POLY1305(256) Mac=AEAD
TLS_AES_128_GCM_SHA256    TLSv1.3 Kx=any  Au=any  Enc=AESGCM(128) Mac=AEAD
ECDHE-ECDSA-AES256-GCM-SHA384 TLSv1.2 Kx=ECDH Au=ECDSA Enc=AESGCM(256) Mac=AEAD
ECDHE-RSA-AES256-GCM-SHA384   TLSv1.2 Kx=ECDH Au=RSA   Enc=AESGCM(256) Mac=AEAD
# Shows all cipher suites excluding anonymous and null-encryption variants.`);

patch('Cipher & Protocol Listing', 'openssl ciphers -v "DEFAULT"',
`$ openssl ciphers -v "DEFAULT" | wc -l
77
$ openssl ciphers -v "DEFAULT" | head -3
TLS_AES_256_GCM_SHA384    TLSv1.3 Kx=any  Au=any  Enc=AESGCM(256) Mac=AEAD
TLS_CHACHA20_POLY1305_SHA256 TLSv1.3 Kx=any  Au=any  Enc=CHACHA20/POLY1305(256)
ECDHE-ECDSA-AES256-GCM-SHA384 TLSv1.2 Kx=ECDH ...
# Lists all cipher suites in the DEFAULT OpenSSL cipher list for this build.`);

patch('Cipher & Protocol Listing', 'openssl ciphers -v -tls1_2',
`$ openssl ciphers -v -tls1_2 | grep "TLSv1.2" | wc -l
49
# Lists cipher suites available for TLS 1.2 negotiation.
# Useful for confirming which TLS 1.2 ciphers your OpenSSL build supports.`);

patch('Cipher & Protocol Listing', 'openssl ciphers -v "HIGH:!aNULL:!MD5"',
`$ openssl ciphers -v "HIGH:!aNULL:!MD5" | grep "Enc=" | sort -u | head -5
AESGCM(128) AESGCM(256) CAMELLIA(256) CHACHA20/POLY1305(256)
# HIGH = cipher suites with key lengths > 128 bits.
# !aNULL = exclude anonymous key exchange (no server authentication).
# !MD5 = exclude suites using MD5 as MAC (deprecated).`);

patch('Cipher & Protocol Listing', 'openssl ciphers -v "ECDHE+AESGCM:ECDHE+CHACHA20"',
`$ openssl ciphers -v "ECDHE+AESGCM:ECDHE+CHACHA20" 2>/dev/null
ECDHE-RSA-AES256-GCM-SHA384  TLSv1.2 Kx=ECDH Au=RSA   Enc=AESGCM(256) Mac=AEAD
ECDHE-ECDSA-AES256-GCM-SHA384 TLSv1.2 Kx=ECDH Au=ECDSA Enc=AESGCM(256) Mac=AEAD
ECDHE-RSA-AES128-GCM-SHA256  TLSv1.2 Kx=ECDH Au=RSA   Enc=AESGCM(128) Mac=AEAD
ECDHE-RSA-CHACHA20-POLY1305  TLSv1.2 Kx=ECDH Au=RSA   Enc=CHACHA20/POLY1305 Mac=AEAD
# A modern-only cipher string: ECDHE key exchange + AEAD encryption.`);

patch('Cipher & Protocol Listing', 'openssl list -cipher-algorithms',
`$ openssl list -cipher-algorithms | head -10
AES-128-CBC
AES-128-CFB
AES-128-CTR
AES-128-GCM
AES-128-OFB
AES-192-CBC
AES-256-CBC
AES-256-GCM
CAMELLIA-128-CBC
ChaCha20-Poly1305
# Lists all symmetric cipher algorithms available in this OpenSSL build.
# Use with: openssl enc -cipher-name -in plain.txt -out cipher.bin`);

patch('Cipher & Protocol Listing', 'openssl list -digest-algorithms',
`$ openssl list -digest-algorithms | head -10
MD5
SHA1
SHA224
SHA256
SHA384
SHA512
SHA3-256
SHA3-512
BLAKE2b512
BLAKE2s256
# Lists all message digest algorithms available in this OpenSSL build.
# Use with: openssl dgst -algorithm file`);

patch('Cipher & Protocol Listing', 'openssl list -public-key-algorithms',
`$ openssl list -public-key-algorithms | grep "Name:"
Name: OpenSSL RSA method
Name: OpenSSL DSA method
Name: OpenSSL DH method
Name: OpenSSL EC algorithm
Name: OpenSSL X25519 algorithm
Name: OpenSSL X448 algorithm
Name: OpenSSL ED25519 algorithm
Name: OpenSSL ED448 algorithm
# Lists all public-key algorithms supported by the current OpenSSL build.`);

patch('Cipher & Protocol Listing', 'openssl version -a',
`$ openssl version -a
OpenSSL 3.0.11 19 Sep 2023 (Library: OpenSSL 3.0.11 19 Sep 2023)
built on: Mon Sep 18 17:39:55 2023 UTC
platform: linux-x86_64
options:  bn(64,64)
compiler: gcc ...
OPENSSLDIR: "/usr/lib/ssl"
ENGINESDIR: "/usr/lib/x86_64-linux-gnu/engines-3"
MODULESDIR: "/usr/lib/x86_64-linux-gnu/ossl-modules"
Seeding source: os-specific
CPUINFO: OPENSSL_ia32cap=...
# -a shows all version information including build options and directories.`);

patch('Cipher & Protocol Listing', 'openssl list -tls-cipher-algorithms',
`$ openssl list -tls-cipher-algorithms | head -5
TLS_AES_256_GCM_SHA384
TLS_CHACHA20_POLY1305_SHA256
TLS_AES_128_GCM_SHA256
TLS_AES_128_CCM_SHA256
TLS_AES_128_CCM_8_SHA256
# Lists TLS 1.3 cipher suites specifically (OpenSSL 3.x).
# TLS 1.3 ciphers are not configurable via the legacy cipher string API.`);

patch('Cipher & Protocol Listing', 'openssl list -disabled',
`$ openssl list -disabled
No disabled algorithms.
# Or on a FIPS-restricted build:
# RC4
# MD5
# DES
# 3DES
# Lists algorithms that have been explicitly disabled in this OpenSSL build.
# Relevant when auditing FIPS compliance or hardened package builds.`);

// ── TLS Handshake Debugging ────────────────────────────────────────────────────
patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -msg',
`$ openssl s_client -connect example.com:443 -servername example.com -msg < /dev/null 2>&1 | head -20
>>> TLS 1.3, Handshake [length 0122], ClientHello
    01 00 01 1e 03 03 ...
<<< TLS 1.3, Handshake [length 0082], ServerHello
    02 00 00 7e 03 03 ...
# -msg prints raw TLS record contents (hex + type annotation).
# Shows ClientHello, ServerHello, Certificate, and Finished messages.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -debug',
`$ openssl s_client -connect example.com:443 -servername example.com -debug < /dev/null 2>&1 | head -30
write to 0x... [0x...] (316 bytes => 316 (0x13C))
0000 - 16 03 01 01 37 01 00 01  33 03 03 ...
# -debug prints all SSL/TLS read/write buffers in hex.
# More verbose than -msg — shows network-level byte streams.
# Useful when diagnosing protocol-level handshake failures.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -trace',
`$ openssl s_client -connect example.com:443 -servername example.com -trace < /dev/null 2>&1 | head -20
Sent Record
  Header:
    Version = TLS 1.0 (0x301)
    Content Type = Handshake (22)
    Length = 317
  ClientHello, Length=313
    client_version=0x303 (TLS 1.2)
    random (len=32): ...
# -trace gives the most detailed view: structured field-by-field handshake decode.
# Requires OpenSSL built with enable-ssl-trace (default in most distro packages).`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -reconnect',
`$ openssl s_client -connect example.com:443 -servername example.com -reconnect < /dev/null 2>&1 | grep "Reused\|New"
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
# Makes 5 connections and reports if session resumption (PSK/ticket) is working.
# "Reused" = session ticket or PSK resumption succeeded — reduces handshake RTT.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -sess_out /tmp/session.pem',
`$ openssl s_client -connect example.com:443 -sess_out /tmp/session.pem < /dev/null 2>&1 | grep "New\|Session"
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
$ cat /tmp/session.pem
-----BEGIN SSL SESSION PARAMETERS-----
...
# Saves the TLS session ticket/PSK to a file for manual session resumption testing.
# Resume later: openssl s_client -connect example.com:443 -sess_in /tmp/session.pem`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -sess_in /tmp/session.pem',
`$ openssl s_client -connect example.com:443 -sess_in /tmp/session.pem < /dev/null 2>&1 | grep "Reused\|New"
Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
# Resumes a previously saved TLS session — confirms session ticket resumption works.
# Pair with -sess_out to save; then use -sess_in to resume on the next connection.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -no_tls1_3',
`$ openssl s_client -connect example.com:443 -servername example.com -no_tls1_3 < /dev/null 2>&1 | grep "Protocol\|Cipher"
Protocol  : TLSv1.2
Cipher    : ECDHE-RSA-AES256-GCM-SHA384
# -no_tls1_3 forces fallback to TLS 1.2 negotiation.
# Useful for confirming a server still supports TLS 1.2 alongside 1.3.`);

patch('TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -nextprotoneg ""',
`$ openssl s_client -connect example.com:443 -servername example.com -nextprotoneg "" < /dev/null 2>&1 | grep "NPN\|ALPN"
Protocols advertised by server: h2, http/1.1
# Lists protocols advertised by the server via the NPN/ALPN TLS extensions.
# If -nextprotoneg is not supported, use -alpn h2 to negotiate HTTP/2 directly.`);

// ── OCSP & CRL ─────────────────────────────────────────────────────────────────
patch('OCSP & CRL', 'openssl ocsp -issuer ca.crt -cert cert.crt -url http://ocsp.ca.com -resp_text',
`$ openssl ocsp -issuer intermediate.crt -cert server.crt -url http://r3.o.lencr.org -resp_text 2>/dev/null | grep -E "Cert Status|This Update"
Cert Status: good
This Update: Jan  1 12:00:00 2026 GMT
# Queries the OCSP responder URL to check if the certificate is revoked.
# Get the OCSP URL from: openssl x509 -in cert.crt -noout -ocsp_uri`);

patch('OCSP & CRL', 'openssl crl -in crl.der -inform DER -noout -text',
`$ openssl crl -in crl.der -inform DER -noout -text
Certificate Revocation List (CRL):
        Version 2 (0x1)
    Signature Algorithm: sha256WithRSAEncryption
        Issuer: CN=Example CA
        Last Update: Jan  1 12:00:00 2026 GMT
        Next Update: Jan 15 12:00:00 2026 GMT
    Revoked Certificates:
        Serial Number: 04C1D2E3F4
            Revocation Date: Dec 15 10:00:00 2025 GMT
# Decodes a DER-encoded CRL and lists revoked certificate serial numbers.`);

patch('OCSP & CRL', 'openssl crl -in crl.pem -noout -text',
`$ openssl crl -in crl.pem -noout -text
Certificate Revocation List (CRL):
    Issuer: C=US, O=Let's Encrypt, CN=R3
    Last Update: Jan  1 12:00:00 2026 GMT
    Next Update: Jan  8 12:00:00 2026 GMT
    X509v3 CRL Number: 123456
    Revoked Certificates:
        Serial Number: 04...  Revocation Date: Dec 20 09:00:00 2025 GMT
# Decodes a PEM-encoded CRL — same output, no -inform flag needed.`);

patch('OCSP & CRL', 'openssl x509 -in cert.crt -noout -ocsp_uri',
`$ openssl x509 -in server.crt -noout -ocsp_uri
http://r3.o.lencr.org
# Extracts the OCSP responder URL from the Authority Information Access extension.
# Use this URL with openssl ocsp to query revocation status in real time.`);

patch('OCSP & CRL', 'openssl x509 -in cert.crt -noout -crl_distribution_points',
`$ openssl x509 -in server.crt -noout -crl_distribution_points
X509v3 CRL Distribution Points:
    Full Name:
      URI:http://crl3.digicert.com/DigiCertTLSRSASHA2562020CA1-4.crl
# Extracts the CRL distribution point URL from the certificate.
# Download the CRL: curl -O http://crl3.digicert.com/DigiCertTLS...crl`);

patch('OCSP & CRL', 'openssl ocsp -issuer ca.crt -cert cert.crt -url http://ocsp.ca.com -noverify',
`$ openssl ocsp -issuer ca.crt -cert server.crt -url http://ocsp.example.com -noverify 2>/dev/null
server.crt: good
    This Update: Jan  1 12:00:00 2026 GMT
    Next Update: Jan  8 12:00:00 2026 GMT
# -noverify skips verification of the OCSP response signature.
# Useful for testing when you don't have the OCSP signing certificate.`);

patch('OCSP & CRL', 'openssl crl -in crl.pem -noout -nextupdate',
`$ openssl crl -in crl.pem -noout -nextupdate
nextUpdate=Jan 15 12:00:00 2026 GMT
# Prints only the CRL's Next Update date — when the CRL expires.
# If Now > Next Update, the CRL is stale and a fresh copy must be downloaded.`);

patch('OCSP & CRL', 'openssl verify -crl_check -CAfile ca.crt -crl_file crl.pem cert.crt',
`$ openssl verify -crl_check -CAfile ca.crt -CRLfile crl.pem server.crt
server.crt: OK
# Verifies the certificate AND checks it against the local CRL.
# "OK" = certificate is valid and not listed in the CRL.
# Error: "certificate revoked" if the serial appears in the CRL.`);

patch('OCSP & CRL', 'openssl ocsp -issuer ca.crt -cert cert.crt -url http://ocsp.ca.com -text 2>/dev/null | grep "Cert Status"',
`$ openssl ocsp -issuer intermediate.crt -cert server.crt \
    -url http://r3.o.lencr.org -text 2>/dev/null | grep "Cert Status"
    Cert Status: good
# Compact one-liner: queries OCSP and prints only the revocation status.
# Status values: good | revoked | unknown`);

patch('OCSP & CRL', 'openssl crl -in crl.der -inform DER -out crl.pem',
`$ openssl crl -in crl.der -inform DER -out crl.pem
$ head -1 crl.pem
-----BEGIN X509 CRL-----
# Converts a DER-encoded CRL (binary, .crl extension) to PEM format.
# PEM format is required by openssl verify -CRLfile.`);

// ── Hashing & HMAC ─────────────────────────────────────────────────────────────
patch('Hashing & HMAC', 'openssl dgst -sha256 <file>',
`$ openssl dgst -sha256 /etc/hosts
SHA256(/etc/hosts)= 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
# Computes the SHA-256 digest of a file and prints in "name(file)= hash" format.
# Compare: sha256sum /etc/hosts — produces the same hash value.`);

patch('Hashing & HMAC', 'openssl dgst -sha1 <file>',
`$ openssl dgst -sha1 firmware.bin
SHA1(firmware.bin)= da39a3ee5e6b4b0d3255bfef95601890afd80709
# SHA-1 is cryptographically broken — use only for non-security checksums.
# Many firmware vendors still publish SHA-1 hashes for file integrity checks.`);

patch('Hashing & HMAC', 'openssl dgst -md5 <file>',
`$ openssl dgst -md5 archive.tar.gz
MD5(archive.tar.gz)= d41d8cd98f00b204e9800998ecf8427e
# MD5 is cryptographically broken — do NOT use for security purposes.
# Acceptable only for non-security integrity checks (download verification).`);

patch('Hashing & HMAC', 'openssl dgst -sha512 <file>',
`$ openssl dgst -sha512 backup.tar.gz
SHA512(backup.tar.gz)= cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
# SHA-512 provides 256-bit collision resistance — suitable for high-security contexts.`);

patch('Hashing & HMAC', 'openssl dgst -sha256 -hmac <key> <file>',
`$ openssl dgst -sha256 -hmac "mysecretkey" message.txt
HMAC-SHA256(message.txt)= 3ecb...d7a2
# Computes an HMAC-SHA256 using the supplied key string.
# HMAC provides both integrity and authentication (requires knowledge of the key).
# Use -mac HMAC -macopt key:hexkey for a hex-encoded key.`);

patch('Hashing & HMAC', 'openssl dgst -sha256 file.txt',
`$ openssl dgst -sha256 report.pdf
SHA256(report.pdf)= 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
# Equivalent to sha256sum report.pdf — both use the same SHA-256 implementation.`);

patch('Hashing & HMAC', 'openssl dgst -sha512 file.txt',
`$ openssl dgst -sha512 report.pdf
SHA512(report.pdf)= cf83e1357eefb8bdf1542850d66d8007...
# Equivalent to sha512sum report.pdf.`);

patch('Hashing & HMAC', 'openssl dgst -md5 file.txt',
`$ openssl dgst -md5 legacy-archive.tar.gz
MD5(legacy-archive.tar.gz)= d41d8cd98f00b204e9800998ecf8427e
# Only use MD5 for compatibility with legacy systems — not for security.`);

patch('Hashing & HMAC', 'openssl dgst -sha256 -c file.txt',
`$ openssl dgst -sha256 -c report.pdf
SHA256(report.pdf)= 2c:f2:4d:ba:5f:b0:a3:0e:...
# -c prints the hash with colon-separated bytes — useful for visual comparison.`);

patch('Hashing & HMAC', 'openssl dgst -sha3-256 file.txt',
`$ openssl dgst -sha3-256 sensitive.dat
SHA3-256(sensitive.dat)= a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434
# SHA3-256 uses the Keccak sponge construction — distinct from SHA-2.
# Available in OpenSSL 1.1.1+ and OpenSSL 3.x.`);

// ── Symmetric Encryption & Encoding ───────────────────────────────────────────
patch('Symmetric Encryption & Encoding', 'openssl base64 -in file.bin -out file.b64',
`$ openssl base64 -in binary.dat -out binary.b64
$ cat binary.b64
SGVsbG8gV29ybGQh
# Encodes a binary file to Base64 text with 64-character line wrapping.
# One-liner: openssl base64 -in file | tr -d '\n'  (no line breaks)`);

patch('Symmetric Encryption & Encoding', 'openssl base64 -d -in file.b64 -out file.bin',
`$ openssl base64 -d -in binary.b64 -out binary.dat
$ file binary.dat
binary.dat: data
# Decodes Base64 text back to binary.
# Equivalent to: base64 -d file.b64 > file.bin`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-cbc -salt -pbkdf2 -in file.txt -out file.enc',
`$ openssl enc -aes-256-cbc -salt -pbkdf2 -in plaintext.txt -out encrypted.enc
enter aes-256-cbc encryption password:
Verifying - enter aes-256-cbc encryption password:
$ ls -lh encrypted.enc
-rw-r--r-- 1 user user 48 Jan  1 12:00 encrypted.enc
# -salt adds random salt; -pbkdf2 uses PBKDF2 for key derivation (OpenSSL 1.1.1+).
# Decrypt: openssl enc -aes-256-cbc -d -pbkdf2 -in encrypted.enc -out decrypted.txt`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-cbc -d -pbkdf2 -in file.enc -out file.txt',
`$ openssl enc -aes-256-cbc -d -pbkdf2 -in encrypted.enc -out decrypted.txt
enter aes-256-cbc decryption password:
$ cat decrypted.txt
This is the original plaintext.
# -d flag decrypts; must use the same cipher, -pbkdf2, and password as encryption.`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-cbc -salt -pbkdf2 -in file.txt -out file.enc -k <passphrase>',
`$ openssl enc -aes-256-cbc -salt -pbkdf2 -in plaintext.txt -out encrypted.enc -k "P@ssw0rd123"
# -k supplies the passphrase directly on the command line.
# Avoid -k on shared systems (passphrase visible in process list).
# Prefer the interactive prompt (omit -k) or use -pass env:PASSVAR.`);

patch('Symmetric Encryption & Encoding', 'openssl enc -list',
`$ openssl enc -list 2>/dev/null | head -10
Supported ciphers:
-aes-128-cbc
-aes-128-cfb
-aes-128-ctr
-aes-128-gcm
-aes-256-cbc
-aes-256-gcm
-camellia-256-cbc
-chacha20
-chacha20-poly1305
# Lists all symmetric ciphers available for use with openssl enc.`);

patch('Symmetric Encryption & Encoding', 'openssl rand -base64 32',
`$ openssl rand -base64 32
V3xK9mLqRtYnPzAsBwCdEfGhIjKlMnOpQr==
# Generates 32 cryptographically random bytes and prints as Base64 (44 chars).
# Useful for generating API secrets, JWT signing keys, or symmetric keys.`);

patch('Symmetric Encryption & Encoding', 'openssl enc -aes-256-gcm -K <hexkey> -iv <hexiv> -in file.txt -out file.enc',
`$ openssl enc -aes-256-gcm \
    -K $(openssl rand -hex 32) \
    -iv $(openssl rand -hex 12) \
    -in plaintext.txt -out encrypted.enc
# AES-256-GCM provides authenticated encryption (AEAD) — no separate MAC needed.
# -K requires a 64-char hex key (32 bytes); -iv requires 24-char hex (12 bytes for GCM).`);

patch('Symmetric Encryption & Encoding', 'openssl enc -chacha20-poly1305 -K <hexkey> -iv <hexiv> -in file.txt -out file.enc',
`$ openssl enc -chacha20-poly1305 \
    -K $(openssl rand -hex 32) \
    -iv $(openssl rand -hex 12) \
    -in plaintext.txt -out encrypted.enc
# ChaCha20-Poly1305 is faster than AES-GCM on CPUs without AES-NI hardware.
# Preferred for mobile devices and embedded systems.`);

patch('Symmetric Encryption & Encoding', 'echo -n "text" | openssl base64',
`$ echo -n "Hello, World!" | openssl base64
SGVsbG8sIFdvcmxkIQ==
# -n prevents echo from adding a trailing newline (which would change the hash).
# Pipe any text directly into openssl base64 for quick encoding.`);

// ── Digital Signatures ─────────────────────────────────────────────────────────
patch('Digital Signatures', 'openssl dgst -sha256 -sign private.key -out sig.bin file.txt',
`$ openssl dgst -sha256 -sign server.key -out signature.bin document.txt
$ ls -lh signature.bin
-rw-r--r-- 1 user user 256 Jan  1 12:00 signature.bin
# Creates a detached RSA PKCS#1 v1.5 signature over the SHA-256 hash of file.txt.
# Verify: openssl dgst -sha256 -verify public.key -signature signature.bin document.txt`);

patch('Digital Signatures', 'openssl dgst -sha256 -verify public.key -signature sig.bin file.txt',
`$ openssl dgst -sha256 -verify public.key -signature signature.bin document.txt
Verified OK
# "Verified OK" = the signature is valid for this file and public key.
# "Verification Failure" = file was tampered with or wrong key was used.`);

patch('Digital Signatures', 'openssl pkeyutl -sign -inkey private.key -in hash.bin -out sig.bin -pkeyopt rsa_padding_mode:pss',
`$ openssl pkeyutl -sign -inkey server.key -in hash.bin -out sig.bin -pkeyopt rsa_padding_mode:pss -pkeyopt rsa_pss_saltlen:-1
$ ls -lh sig.bin
-rw-r--r-- 1 user user 256 Jan  1 12:00 sig.bin
# RSA-PSS signature (probabilistic padding) — more secure than PKCS#1 v1.5.
# Required by TLS 1.3 and modern certificate policies.`);

patch('Digital Signatures', 'openssl pkeyutl -verify -pubin -inkey public.key -in hash.bin -sigfile sig.bin',
`$ openssl pkeyutl -verify -pubin -inkey public.key -in hash.bin -sigfile sig.bin
Signature Verified Successfully
# Verifies a signature created with openssl pkeyutl -sign.
# -pubin = input is a public key file (SubjectPublicKeyInfo format).`);

patch('Digital Signatures', 'openssl dgst -sha256 -sign private.key -out sig.der -keyform PEM file.txt',
`$ openssl dgst -sha256 -sign ec.key -out sig.der -keyform PEM document.txt
$ xxd sig.der | head -2
00000000: 3045 0221 00a1 b2c3 d4e5 f601 ...
# For ECDSA keys, the signature is a DER-encoded sequence of (r, s) integers.
# ECDSA signatures vary in size (70–72 bytes for P-256) due to DER encoding.`);

patch('Digital Signatures', 'openssl cms -sign -in file.txt -signer cert.crt -inkey private.key -out signed.cms -outform PEM',
`$ openssl cms -sign -in document.txt -signer server.crt -inkey server.key \
    -out signed.cms -outform PEM -nodetach
$ head -1 signed.cms
-----BEGIN CMS-----
# Creates a CMS/PKCS#7 signed message that embeds the content and signature.
# Verify: openssl cms -verify -in signed.cms -CAfile ca.crt -out verified.txt`);

patch('Digital Signatures', 'openssl cms -verify -in signed.cms -CAfile ca.crt -out verified.txt',
`$ openssl cms -verify -in signed.cms -CAfile ca.crt -out verified.txt
Verification successful
$ cat verified.txt
This is the original document content.
# Verifies a CMS/PKCS#7 signed message and extracts the original content.
# "Verification successful" = signer certificate is trusted and signature is valid.`);

// ── Performance & Benchmarks ───────────────────────────────────────────────────
patch('Performance & Benchmarks', 'openssl speed',
`$ openssl speed 2>/dev/null | tail -10
Doing md5 for 3s on 16 size blocks: 13824000 md5s in 3.00s
Doing sha256 for 3s on 16 size blocks: 10234000 sha256s in 3.00s
Doing aes-256-cbc for 3s on 16 size blocks: 19284000 aes-256-cbcs in 3.00s
type             16 bytes     64 bytes    256 bytes   1024 bytes   8192 bytes
md5             73760.00k   226432.00k   554240.00k   827392.00k   985088.00k
sha256          54581.33k   171264.00k   406357.33k   613376.00k   711680.00k
aes-256 cbc    102848.00k   303616.00k   631296.00k   815104.00k   880640.00k
# Runs OpenSSL's built-in benchmark across all available algorithms.`);

patch('Performance & Benchmarks', 'openssl speed -evp aes-256-gcm',
`$ openssl speed -evp aes-256-gcm 2>/dev/null | tail -3
Doing aes-256-gcm for 3s on 16 size blocks: 7421560 aes-256-gcms in 3.00s
type             16 bytes     64 bytes    256 bytes   1024 bytes   8192 bytes  16384 bytes
aes-256-gcm     39581.65k   129493.33k   404821.33k  1111040.00k  1638400.00k  1720320.00k
# -evp benchmarks using the high-level EVP API (uses AES-NI hardware if available).
# Compare hardware-accelerated vs software: run with and without OPENSSL_ia32cap=~0x200000200000000.`);

patch('Performance & Benchmarks', 'openssl speed -evp sha256',
`$ openssl speed -evp sha256 2>/dev/null | tail -3
Doing sha256 for 3s on 16 size blocks: 18230000 sha256s in 3.00s
type             16 bytes     64 bytes    256 bytes   1024 bytes   8192 bytes
sha256          97226.67k   282026.67k   637269.33k  1045504.00k  1228800.00k
# Benchmarks SHA-256 via EVP API.  On modern CPUs with SHA-NI, throughput is
# significantly higher than on older CPUs without the instruction set extension.`);

patch('Performance & Benchmarks', 'openssl speed rsa2048',
`$ openssl speed rsa2048 2>/dev/null | tail -3
Doing 2048 bit private rsa's for 10s: 3254 2048 bit private RSA's in 10.00s
Doing 2048 bit public rsa's for 10s: 110840 2048 bit public RSA's in 10.00s
                  sign    verify    sign/s verify/s
rsa 2048 bits  0.003073s 0.000090s    325.4  11084.0
# sign/s = RSA private key operations per second (server TLS handshake rate limit).
# verify/s = RSA public key operations per second (client-side, much cheaper).`);

patch('Performance & Benchmarks', 'openssl speed ecdh',
`$ openssl speed ecdh 2>/dev/null | grep -E "P-256|P-384|X25519"
                      op      op/s
 256 bit ecdh (P-256)  0.0000241s  41495.3
 384 bit ecdh (P-384)  0.0000558s  17921.0
 253 bit ecdh (X25519) 0.0000168s  59523.8
# Benchmarks ECDH key agreement — the dominant cost in TLS 1.3 handshakes.
# X25519 is typically fastest; P-384 is required for NSA Suite B compliance.`);

patch('Performance & Benchmarks', 'openssl speed ecdsa',
`$ openssl speed ecdsa 2>/dev/null | grep "P-256"
                        sign    verify    sign/s verify/s
 256 bit ecdsa (P-256) 0.0000274s 0.0000782s  36496.4  12789.7
# sign/s = ECDSA signing operations per second.
# P-256 ECDSA is the most common algorithm in TLS 1.3 certificates.`);

patch('Performance & Benchmarks', 'openssl speed -multi $(nproc)',
`$ openssl speed -multi $(nproc) -evp aes-256-gcm 2>/dev/null | tail -3
type             16 bytes     64 bytes    256 bytes   1024 bytes   8192 bytes  16384 bytes
aes-256-gcm    299264.00k  1051306.67k  3188224.00k  8806400.00k 12697600.00k 12877824.00k
# -multi N runs N parallel benchmark threads — shows aggregate throughput
# across all CPU cores. $(nproc) automatically uses all available cores.`);

// ── Providers & FIPS (OpenSSL 3+) ─────────────────────────────────────────────
patch('Providers & FIPS (OpenSSL 3+)', 'openssl list -providers -verbose',
`$ openssl list -providers -verbose
Providers:
  default
    name: OpenSSL Default Provider
    version: 3.0.11
    status: active
  legacy
    name: OpenSSL Legacy Provider
    version: 3.0.11
    status: active (if loaded)
# Lists loaded OpenSSL 3.x providers and their status.
# Providers replace legacy engine support in OpenSSL 3.x.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl list -cipher-algorithms -provider legacy',
`$ openssl list -cipher-algorithms -provider legacy | grep -E "^DES|^RC4|^BF"
BF-CBC
DES-CBC
DES-EDE3-CBC
RC4
# The legacy provider enables deprecated algorithms (DES, RC4, Blowfish, MD2).
# Load at runtime: openssl enc -provider legacy -des-cbc -in file.txt ...
# Do NOT use these for security purposes — enabled only for compatibility.`);

patch('Providers & FIPS (OpenSSL 3+)', 'OPENSSL_CONF=/etc/ssl/fipsmodule.cnf openssl list -providers',
`$ OPENSSL_CONF=/etc/ssl/fipsmodule.cnf openssl list -providers
Providers:
  fips
    name: OpenSSL FIPS Provider
    version: 3.0.9
    status: active
  base
    name: OpenSSL Base Provider
    version: 3.0.9
    status: active
# Loads the FIPS provider via a custom openssl.cnf pointing to fipsmodule.cnf.
# When active, only FIPS 140-3 approved algorithms are available.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl fipsinstall -out /etc/ssl/fipsmodule.cnf -module /usr/lib/ossl-modules/fips.so',
`$ openssl fipsinstall -out /etc/ssl/fipsmodule.cnf -module /usr/lib/ossl-modules/fips.so
INSTALL PASSED
# Validates and installs the FIPS provider module.
# Generates fipsmodule.cnf with the HMAC integrity check value for the FIPS .so.
# Must be re-run after system updates that change the FIPS module binary.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl list -providers -provider fips',
`$ openssl list -providers -provider fips
Providers:
  fips
    name: OpenSSL FIPS Provider
    version: 3.0.9
    status: active
# Explicitly loads the FIPS provider and confirms it is active.
# Combine: -provider fips -provider base for a FIPS-only configuration.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl speed -provider fips -evp aes-256-gcm',
`$ openssl speed -provider fips -provider base -evp aes-256-gcm 2>/dev/null | tail -3
type             16 bytes     64 bytes    256 bytes   1024 bytes   8192 bytes
aes-256-gcm     39581.65k   129493.33k   404821.33k  1111040.00k  1638400.00k
# Benchmarks AES-256-GCM using only FIPS-approved algorithm paths.
# -provider base is required alongside -provider fips for utility functions.`);

patch('Providers & FIPS (OpenSSL 3+)', 'openssl list -public-key-algorithms -provider fips',
`$ openssl list -public-key-algorithms -provider fips | grep "Name:"
Name: OpenSSL RSA method
Name: OpenSSL EC algorithm
Name: OpenSSL X25519 algorithm
Name: OpenSSL X448 algorithm
Name: OpenSSL ED25519 algorithm
Name: OpenSSL ED448 algorithm
# Lists public-key algorithms available when operating in FIPS mode.
# Note: DSA is excluded from the FIPS provider (deprecated in FIPS 186-5).`);

// Write output
data.updatedAt = new Date().toISOString();
writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('OpenSSL patch applied successfully.');
