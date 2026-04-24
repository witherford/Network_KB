#!/usr/bin/env node
// Reorganise OpenSSL sections (merge the duplicate Certificates/Keys/SSL-TLS/
// Hashing/Encoding "short" sections into the richer ones) and add a large
// curated batch of additional commands. Idempotent — dedupes by exact cmd
// string within each target section.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = resolve(ROOT, 'data/commands.json');

// Rename existing sections -> final layout (preserve items).
const RENAMES = {
  'Key Generation': 'Key Generation',
  'Keys': 'Key Inspection & Manipulation', // existing "Keys" is mostly inspect
  'CSR & Certificates': 'CSR & Certificate Signing',
  'Certificates': 'Certificate Inspection', // existing short "Certificates" goes here
  'Certificate Inspection': 'Certificate Inspection',
  'Format Conversion': 'Format Conversion',
  'Verification & Matching': 'Verification & Matching',
  'TLS Testing': 'TLS Client Testing',
  'SSL/TLS': 'TLS Client Testing',
  'OCSP & CRL': 'OCSP & CRL',
  'Hashing': 'Hashing & HMAC',
  'Encoding': 'Symmetric Encryption & Encoding',
  'Encryption & Hashing': 'Symmetric Encryption & Encoding' // will split signatures out below
};

// Items from "Encryption & Hashing" that are actually digital signatures or
// dgst should move into their correct section.
const RESECTION = {
  // substring -> target section
  'dgst -sha256 -sign': 'Digital Signatures',
  'dgst -sha256 -verify': 'Digital Signatures',
  'dgst -sha256 ': 'Hashing & HMAC',
  'dgst -sha512 ': 'Hashing & HMAC',
  'dgst -md5 ': 'Hashing & HMAC',
};

const ADDITIONS = {
  'Key Generation': [
    ['openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key', 'Generate 3072-bit RSA key via genpkey (modern API)', 'config'],
    ['openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out rsa4096.key', 'Generate password-protected 4096-bit RSA key', 'config'],
    ['openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-384 -out ec384.key', 'P-384 EC key via genpkey', 'config'],
    ['openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-521 -out ec521.key', 'P-521 EC key via genpkey', 'config'],
    ['openssl genpkey -algorithm X25519 -out x25519.key', 'X25519 key for modern ECDH', 'config'],
    ['openssl genpkey -algorithm X448 -out x448.key', 'X448 key (higher security level than X25519)', 'config'],
    ['openssl genpkey -algorithm ed448 -out ed448.key', 'Ed448 signing key', 'config'],
    ['openssl ecparam -list_curves', 'List every named EC curve supported by the build', 'show'],
    ['openssl ecparam -name prime256v1 -out ecparams.pem', 'Save EC parameters to a file', 'config'],
    ['openssl rand -out random.bin 256', 'Write 256 random bytes to a binary file', 'config'],
    ['openssl rand -hex 16', 'Print 16 random bytes hex (32 chars) — token / IV material', 'show']
  ],

  'Key Inspection & Manipulation': [
    ['openssl rsa -in private.key -text -noout', 'Print full RSA key structure (n, e, d, p, q, primes, CRT coeffs)', 'show'],
    ['openssl rsa -in private.key -noout -modulus', 'Public modulus of an RSA key — use to cross-check against cert/CSR', 'show'],
    ['openssl ec -in ec.key -text -noout', 'Print EC key parameters and curve', 'show'],
    ['openssl pkey -in private.key -pubout', 'Print the public key for any key type (RSA / EC / Ed25519)', 'show'],
    ['openssl rsa -in enc.key -out dec.key', 'Remove passphrase from an RSA private key (will prompt for current pass)', 'config'],
    ['openssl rsa -in dec.key -aes256 -out enc.key', 'Add a passphrase to a plaintext RSA key (AES-256)', 'config'],
    ['openssl pkcs8 -topk8 -nocrypt -in traditional.key -out pkcs8.key', 'Convert legacy PEM to unencrypted PKCS#8', 'config'],
    ['openssl pkcs8 -topk8 -v2 aes-256-cbc -in plain.key -out pkcs8-enc.key', 'Convert + encrypt to PKCS#8 with AES-256-CBC', 'config'],
    ['openssl pkcs8 -in pkcs8-enc.key -out decrypted.key', 'Decrypt a PKCS#8 key back to PEM', 'config'],
    ['openssl pkey -in private.key -traditional -out rsa.key', 'Convert PKCS#8 → legacy PKCS#1 "BEGIN RSA PRIVATE KEY" format', 'config'],
    ['openssl rsa -in private.key -passin pass:<password> -out unenc.key', 'Scripted remove-passphrase (no TTY prompt)', 'config']
  ],

  'CSR & Certificate Signing': [
    ['openssl req -new -key private.key -out req.csr -addext "subjectAltName = DNS:example.com,DNS:*.example.com"', 'Generate CSR with SAN on the command line (no config file)', 'config'],
    ['openssl req -verify -in req.csr -noout', 'Verify CSR self-signature is valid', 'show'],
    ['openssl req -in req.csr -text -noout -verify', 'CSR content + self-signature verification in one command', 'show'],
    ['openssl ca -config openssl-ca.cnf -extensions v3_intermediate_ca -days 3650 -in intermediate.csr -out intermediate.crt', 'Sign an intermediate CA cert with your root', 'config'],
    ['openssl ca -config openssl-ca.cnf -extensions server_cert -days 365 -in req.csr -out server.crt', 'Sign a server cert with full CA workflow (index.txt + serial)', 'config'],
    ['openssl ca -config openssl-ca.cnf -revoke server.crt', 'Revoke a previously-signed cert', 'config'],
    ['openssl ca -config openssl-ca.cnf -gencrl -out ca.crl', 'Generate a fresh CRL from the CA database', 'config']
  ],

  'Certificate Inspection': [
    ['openssl x509 -in cert.crt -noout -purpose', 'Purposes a cert is valid for (server, client, code-sign…)', 'show'],
    ['openssl x509 -in cert.crt -noout -ext extendedKeyUsage', 'Just the EKU extension values', 'show'],
    ['openssl x509 -in cert.crt -noout -ext keyUsage', 'Just the keyUsage extension', 'show'],
    ['openssl x509 -in cert.crt -noout -ext authorityInfoAccess', 'AIA extension — OCSP URL and CA issuer URL', 'show'],
    ['openssl x509 -in cert.crt -noout -ext crlDistributionPoints', 'CRL Distribution Points', 'show'],
    ['openssl x509 -in cert.crt -noout -issuer_hash', 'Hash of the issuer name (used by OpenSSL CAfile symlinks)', 'show'],
    ['openssl x509 -in cert.crt -noout -subject_hash', 'Hash of the subject name (c_rehash symlink target)', 'show'],
    ['openssl x509 -in cert.crt -noout -checkend 604800', 'Exit non-zero if cert expires within 7 days (scriptable)', 'troubleshooting'],
    ['openssl x509 -in cert.crt -noout -startdate -enddate', 'NotBefore + NotAfter in one command', 'show'],
    ['openssl x509 -in cert.crt -noout -text -certopt no_pubkey,no_sigdump', 'Full cert minus noisy pubkey + signature hex', 'show']
  ],

  'Format Conversion': [
    ['openssl pkcs12 -export -out bundle.pfx -inkey private.key -in cert.crt -certfile chain.crt -name "my-cert"', 'Build PFX with a friendly-name alias', 'config'],
    ['openssl pkcs12 -export -out legacy.pfx -inkey private.key -in cert.crt -legacy', 'PFX encrypted with legacy RC2/3DES algorithms (for old Java/Windows)', 'config'],
    ['openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out client-only.crt', 'Extract only the client-cert leaf from a PFX', 'config'],
    ['openssl pkcs12 -in bundle.pfx -cacerts -nokeys -out ca-chain.crt', 'Extract only the CA chain (no leaf, no key)', 'config'],
    ['openssl pkcs7 -print_certs -in chain.p7b -out chain.pem', 'PKCS#7 bundle → PEM chain', 'config'],
    ['openssl crl2pkcs7 -nocrl -certfile leaf.crt -certfile chain.pem -out bundle.p7b', 'Build a PKCS#7 cert bundle for Windows/Java import', 'config'],
    ['openssl pkey -in private.key -outform DER -out private.der', 'Convert a private key to DER', 'config'],
    ['openssl pkey -in private.der -inform DER -out private.pem', 'Convert a DER key to PEM', 'config'],
    ['cat leaf.crt intermediate.crt root.crt > fullchain.pem', 'Build a concatenated PEM chain (leaf → root)', 'config']
  ],

  'Verification & Matching': [
    ['openssl verify -CAfile ca.crt -untrusted chain.pem -verbose cert.crt', 'Verify leaf against root, using intermediates, with verbose output', 'troubleshooting'],
    ['openssl verify -CApath /etc/ssl/certs cert.crt', 'Verify against the system-trust directory (c_rehash style)', 'troubleshooting'],
    ['openssl verify -partial_chain -CAfile intermediate.crt cert.crt', 'Let OpenSSL stop at an intermediate rather than chaining to a root', 'troubleshooting'],
    ['openssl verify -show_chain -CAfile ca.crt cert.crt', 'Print the full chain as OpenSSL built it', 'show'],
    ['openssl pkey -in private.key -pubout | openssl sha256', 'Hash of the public key — compare against cert and CSR', 'show'],
    ['openssl x509 -in cert.crt -pubkey -noout | openssl sha256', 'Hash of the cert\'s public key — pin / match against key/CSR', 'show'],
    ['openssl req -in req.csr -pubkey -noout | openssl sha256', 'Hash of the CSR\'s public key — compare against private key', 'show'],
    ['openssl x509 -in cert.crt -noout -fingerprint -sha1', 'SHA-1 fingerprint (for UI comparison)', 'show']
  ],

  'TLS Client Testing': [
    ['openssl s_client -connect host:443 -servername host -alpn h2,http/1.1', 'Negotiate ALPN — check whether HTTP/2 is offered', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -reconnect', 'Force session resumption to test session-ticket / ID reuse', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -sess_out sess.pem', 'Save the TLS session to disk', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -sess_in sess.pem', 'Resume using a previously-saved session', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -verify_return_error', 'Fail the connection on any verify error (don\'t mask in output)', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -CAfile chain.pem', 'Validate using a custom trust bundle', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host 2>/dev/null </dev/null | openssl x509 -noout -text', 'Full text of whatever cert the server presents', 'show'],
    ['openssl s_client -connect host:443 -servername host 2>/dev/null </dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName', 'Common one-liner: subject/issuer/dates/SAN of the presented cert', 'show'],
    ['openssl s_client -connect host:443 -servername host -groups X25519:P-256:P-384', 'Offer a specific list of ECDH groups (TLS 1.3)', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -sigalgs RSA+SHA256:ECDSA+SHA256', 'Offer a specific list of signature algorithms', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -tls1_3 -ciphersuites TLS_AES_128_GCM_SHA256', 'Force a specific TLS 1.3 ciphersuite', 'troubleshooting'],
    ['openssl s_client -connect host:443 -starttls imap', 'STARTTLS on IMAP (143)', 'troubleshooting'],
    ['openssl s_client -connect host:443 -starttls pop3', 'STARTTLS on POP3 (110)', 'troubleshooting'],
    ['openssl s_client -connect host:443 -starttls ftp', 'STARTTLS on FTP', 'troubleshooting'],
    ['openssl s_client -connect host:443 -starttls ldap', 'STARTTLS on LDAP (389 → 636 TLS-upgrade)', 'troubleshooting'],
    ['openssl s_client -connect host:443 -starttls postgres', 'STARTTLS on PostgreSQL', 'troubleshooting'],
    ['openssl s_client -connect host:443 -starttls mysql', 'STARTTLS on MySQL/MariaDB', 'troubleshooting'],
    ['openssl s_client -connect host:5671 -servername host -tls1_3 -cert client.crt -key client.key', 'Present a client cert during a TLS handshake (mTLS)', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -prexit 2>&1 | grep -E "(Session-ID|Cipher|Protocol)"', 'Extract just cipher/protocol/session-ID fields', 'show']
  ],

  'TLS Server Testing': [
    ['openssl s_server -accept 4433 -cert cert.crt -key private.key -www', 'Tiny TLS test server that serves a status page on /', 'config'],
    ['openssl s_server -accept 4433 -cert cert.crt -key private.key -CAfile ca.crt -verify 1', 'Require client cert (mTLS) on the test server', 'config'],
    ['openssl s_server -accept 4433 -cert cert.crt -key private.key -tls1_3', 'Force TLS 1.3 only on the test server', 'config'],
    ['openssl s_server -accept 4433 -cert cert.crt -key private.key -alpn h2,http/1.1', 'Advertise ALPN for testing client HTTP/2 negotiation', 'config'],
    ['openssl s_time -connect host:443 -new -time 30', 'Benchmark: count fresh TLS handshakes in 30 seconds', 'troubleshooting'],
    ['openssl s_time -connect host:443 -reuse -time 30', 'Benchmark: resumed handshakes in 30 seconds', 'troubleshooting']
  ],

  'Cipher & Protocol Listing': [
    ['openssl ciphers -v "ALL:!aNULL:!eNULL"', 'All ciphers this OpenSSL build supports with no anon/null ciphers', 'show'],
    ['openssl ciphers -v "DEFAULT"', 'Default cipher list (post-TLS-1.3: includes AEAD suites)', 'show'],
    ['openssl ciphers -v -tls1_2', 'Only TLS 1.2 cipher names', 'show'],
    ['openssl ciphers -v -s -tls1_3', 'Only TLS 1.3 ciphersuites ("-s" = supported by current settings)', 'show'],
    ['openssl ciphers -stdname -v', 'Include IANA/RFC cipher names next to OpenSSL names', 'show'],
    ['openssl ciphers -V', 'Cipher list with hex IDs — useful when correlating with packet captures', 'show'],
    ['openssl ecparam -list_curves | head', 'First page of supported EC curves', 'show'],
    ['openssl list -providers', 'Loaded providers (default / legacy / fips) — OpenSSL 3+', 'show'],
    ['openssl list -public-key-algorithms', 'All public-key algorithms this build supports', 'show'],
    ['openssl list -digest-algorithms', 'All supported hash algorithms', 'show'],
    ['openssl list -cipher-algorithms', 'All supported symmetric algorithms', 'show'],
    ['openssl version -a', 'Full build info: version, compile flags, platform, openssldir', 'show']
  ],

  'TLS Handshake Debugging': [
    ['openssl s_client -connect host:443 -servername host -msg', 'Print each TLS protocol message direction + type as it flies by', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -debug', 'Hex-dump every wire byte — very noisy but shows true framing', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -trace', 'Full structured TLS message trace (extensions, certs, key_shares)', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -state', 'Print the TLS state machine transitions', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -status', 'Ask the server for an OCSP stapled response', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -tlsextdebug', 'Print every TLS extension the server sends back', 'troubleshooting'],
    ['openssl s_client -connect host:443 -servername host -keylogfile ssl-keys.log', 'Write a Wireshark-readable pre-master-secret file for decryption', 'troubleshooting'],
    ['openssl errstr <hex-code>', 'Translate an OpenSSL error code (e.g. 0A000086) to a human string', 'troubleshooting']
  ],

  'OCSP & CRL': [
    ['openssl ocsp -issuer ca.crt -cert cert.crt -text -url http://ocsp.ca.com -noverify', 'OCSP query without verifying the OCSP responder\'s cert (debug only)', 'troubleshooting'],
    ['openssl ocsp -issuer ca.crt -cert cert.crt -url http://ocsp.ca.com -header Host=ocsp.ca.com', 'OCSP with explicit Host header (some responders need it)', 'troubleshooting'],
    ['openssl ocsp -issuer ca.crt -cert cert.crt -respin response.der -text', 'Parse a pre-saved OCSP response', 'show'],
    ['openssl crl -in crl.pem -noout -issuer -lastupdate -nextupdate', 'Quick CRL info (who issued, lastUpdate, nextUpdate)', 'show'],
    ['openssl crl -in crl.pem -noout -CAfile ca.crt', 'Verify the CRL\'s signature', 'troubleshooting'],
    ['openssl crl -in crl.pem -noout -text | grep -A1 "Serial Number"', 'List revoked serial numbers in a CRL', 'show']
  ],

  'Hashing & HMAC': [
    ['openssl dgst -sha256 -c file.txt', 'SHA-256 with colon-separated hex output', 'show'],
    ['openssl dgst -sha3-256 file.txt', 'SHA3-256 hash of a file', 'show'],
    ['openssl dgst -sha3-512 file.txt', 'SHA3-512 hash of a file', 'show'],
    ['openssl dgst -blake2s256 file.txt', 'BLAKE2s hash of a file', 'show'],
    ['openssl dgst -sha256 -hmac "secret" file.txt', 'HMAC-SHA256 with a string key', 'show'],
    ['openssl mac -macopt hexkey:00112233 -macopt digest:SHA256 HMAC < file.txt', 'HMAC via the newer "mac" command (OpenSSL 3+)', 'show'],
    ['openssl dgst -sha256 -binary file.txt | openssl base64', 'Binary SHA-256 re-encoded as base64 (e.g. for SRI integrity attributes)', 'show']
  ],

  'Symmetric Encryption & Encoding': [
    ['openssl enc -aes-256-gcm -pbkdf2 -in plain.txt -out enc.bin', 'AES-256-GCM with PBKDF2 (authenticated encryption)', 'config'],
    ['openssl enc -d -aes-256-gcm -pbkdf2 -in enc.bin -out plain.txt', 'Decrypt AES-256-GCM', 'config'],
    ['openssl enc -aes-256-ctr -pbkdf2 -in plain.txt -out enc.bin', 'AES-256-CTR (streaming mode, no padding)', 'config'],
    ['openssl enc -chacha20 -pbkdf2 -in plain.txt -out enc.bin', 'ChaCha20 stream cipher', 'config'],
    ['openssl enc -aes-256-cbc -pbkdf2 -md sha256 -iter 100000 -in plain.txt -out enc.bin', 'Explicit KDF parameters — portable between boxes', 'config'],
    ['openssl rand -base64 32 | tr -d "=" | head -c 32', 'Generate a 32-char URL-safe random token', 'show'],
    ['openssl rand -engine rdrand -hex 32', 'Force hardware RNG (Intel RDRAND) — OpenSSL 1.1.x', 'show']
  ],

  'Digital Signatures': [
    ['openssl dgst -sha256 -sign private.key -out sig.bin file.txt', 'Sign a file with an RSA/EC private key (SHA-256)', 'config'],
    ['openssl dgst -sha256 -verify public.key -signature sig.bin file.txt', 'Verify the signature against the public key', 'troubleshooting'],
    ['openssl pkeyutl -sign -inkey private.key -in hash.bin -out sig.bin -pkeyopt digest:sha256', 'Low-level sign (Ed25519, raw digests, PSS)', 'config'],
    ['openssl pkeyutl -verify -pubin -inkey public.key -in hash.bin -sigfile sig.bin', 'Low-level verify', 'troubleshooting'],
    ['openssl pkeyutl -sign -inkey rsa.key -in hash.bin -out sig.bin -pkeyopt rsa_padding_mode:pss -pkeyopt rsa_pss_saltlen:digest', 'RSA-PSS signature (required for TLS 1.3 with RSA)', 'config'],
    ['openssl cms -sign -in file.txt -signer cert.crt -inkey private.key -out signed.p7s -outform DER', 'CMS / PKCS#7 detached signature (S/MIME-style)', 'config'],
    ['openssl cms -verify -in signed.p7s -inform DER -content file.txt -CAfile ca.crt', 'Verify CMS signature', 'troubleshooting']
  ],

  'Performance & Benchmarks': [
    ['openssl speed', 'Benchmark every algorithm (takes minutes)', 'troubleshooting'],
    ['openssl speed -evp aes-256-gcm', 'Benchmark AES-256-GCM via EVP (uses AES-NI if available)', 'troubleshooting'],
    ['openssl speed -evp sha256', 'Benchmark SHA-256 via EVP', 'troubleshooting'],
    ['openssl speed rsa4096', 'Benchmark RSA-4096 sign/verify', 'troubleshooting'],
    ['openssl speed ecdsap384 ecdhp384', 'Benchmark P-384 sign + ECDH op rates', 'troubleshooting'],
    ['openssl speed -async_jobs 8 rsa2048', 'Benchmark with 8 async jobs (multi-engine / QAT / KTLS)', 'troubleshooting'],
    ['openssl speed -multi 4 -evp aes-256-gcm', 'Multi-process benchmark across 4 cores', 'troubleshooting']
  ],

  'Providers & FIPS (OpenSSL 3+)': [
    ['openssl list -providers -verbose', 'Providers loaded with their version and parameters', 'show'],
    ['openssl list -cipher-algorithms -provider legacy', 'Cipher algorithms exposed by a specific provider', 'show'],
    ['OPENSSL_CONF=/etc/ssl/fipsmodule.cnf openssl list -providers', 'Run a command under an alternate openssl.cnf (e.g. FIPS config)', 'config'],
    ['openssl fipsinstall -out fipsmodule.cnf -module /usr/lib64/ossl-modules/fips.so', 'Generate FIPS-module install config', 'config'],
    ['openssl fipsinstall -in fipsmodule.cnf -verify', 'Verify an existing FIPS-module install', 'troubleshooting'],
    ['openssl list -kdf-algorithms', 'Available KDFs (HKDF, PBKDF2, SCRYPT, X9.63…)', 'show'],
    ['openssl kdf -keylen 32 -kdfopt digest:SHA256 -kdfopt key:password -kdfopt salt:salt -kdfopt iter:100000 PBKDF2', 'Run PBKDF2 from the command line (OpenSSL 3+)', 'config']
  ]
};

const raw = await readFile(DB, 'utf8');
const data = JSON.parse(raw);
const p = data.platforms.openssl;
if (!p) throw new Error('openssl platform not found');

// --- Step 1: Rename / merge existing sections into final layout -----------
const finalSections = {};
for (const [oldName, items] of Object.entries(p.sections)) {
  const target = RENAMES[oldName] || oldName;
  finalSections[target] ||= [];
  const seen = new Set(finalSections[target].map(x => x.cmd));
  for (const it of items) {
    if (seen.has(it.cmd)) continue;
    finalSections[target].push(it);
    seen.add(it.cmd);
  }
}

// --- Step 2: Re-section dgst -sign / -verify away from hashing ------------
for (const [secName, items] of Object.entries(finalSections)) {
  const keep = [];
  for (const it of items) {
    let moved = false;
    for (const [needle, targetSec] of Object.entries(RESECTION)) {
      if (it.cmd.includes(needle) && targetSec !== secName) {
        finalSections[targetSec] ||= [];
        if (!finalSections[targetSec].some(x => x.cmd === it.cmd)) {
          finalSections[targetSec].push(it);
        }
        moved = true;
        break;
      }
    }
    if (!moved) keep.push(it);
  }
  finalSections[secName] = keep;
}

// --- Step 3: Add curated new entries with dedupe --------------------------
let added = 0, skipped = 0;
for (const [sec, rows] of Object.entries(ADDITIONS)) {
  finalSections[sec] ||= [];
  const existing = new Set(finalSections[sec].map(x => x.cmd));
  for (const [cmd, desc, type] of rows) {
    if (existing.has(cmd)) { skipped++; continue; }
    finalSections[sec].push({ cmd, desc, type, flagged: false });
    existing.add(cmd);
    added++;
  }
}

// --- Step 4: Reorder sections for sensible left-to-right browsing ---------
const ORDER = [
  'Key Generation',
  'Key Inspection & Manipulation',
  'CSR & Certificate Signing',
  'Certificate Inspection',
  'Verification & Matching',
  'Format Conversion',
  'TLS Client Testing',
  'TLS Server Testing',
  'Cipher & Protocol Listing',
  'TLS Handshake Debugging',
  'OCSP & CRL',
  'Hashing & HMAC',
  'Symmetric Encryption & Encoding',
  'Digital Signatures',
  'Performance & Benchmarks',
  'Providers & FIPS (OpenSSL 3+)'
];
const ordered = {};
for (const name of ORDER) if (finalSections[name]) ordered[name] = finalSections[name];
for (const [name, items] of Object.entries(finalSections)) if (!ordered[name]) ordered[name] = items;

p.sections = ordered;
data.updatedAt = new Date().toISOString();
await writeFile(DB, JSON.stringify(data, null, 2) + '\n');

console.log(`added ${added}, skipped ${skipped} (dupes)`);
console.log('--- OpenSSL sections (final) ---');
for (const [name, items] of Object.entries(p.sections)) {
  console.log('  [' + name + '] ' + items.length);
}
