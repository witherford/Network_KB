#!/usr/bin/env node
// Batch 5b: fill remaining 4 OpenSSL examples to reach 10 total

import { readFileSync, writeFileSync } from 'fs';

const FILE = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(FILE, 'utf8'));

function addExample(platform, section, cmdText, example) {
  const entries = data.platforms[platform].sections[section];
  if (!entries) { console.warn(`WARN: section not found: ${platform}/${section}`); return; }
  const entry = entries.find(e => e.cmd === cmdText);
  if (!entry) { console.warn(`WARN: cmd not found: ${cmdText}`); return; }
  if (entry.example) { console.log(`SKIP (already has example): ${cmdText}`); return; }
  entry.example = example;
  console.log(`  SET: ${cmdText}`);
}

console.log('\n=== OPENSSL — 4 more examples ===');

addExample('openssl', 'Verification & Matching', 'openssl verify -CAfile ca.crt cert.crt',
`openssl verify -CAfile ca.crt cert.crt
cert.crt: OK

# Failure examples:
openssl verify -CAfile ca.crt expired.crt
CN = expired.example.com
error 10 at 0 depth lookup: certificate has expired
error expired.crt: verification failed

openssl verify -CAfile ca.crt wrong-ca.crt
CN = test.example.com
error 20 at 0 depth lookup: unable to get local issuer certificate
error wrong-ca.crt: verification failed

# Full chain with intermediate:
openssl verify -CAfile root-ca.crt -untrusted intermediate.crt cert.crt
cert.crt: OK`);

addExample('openssl', 'Key Inspection & Manipulation', 'openssl rsa -in <key> -check',
`openssl rsa -in private.key -check
RSA key ok

# If the key is corrupted:
openssl rsa -in corrupted.key -check
unable to load Private Key
140736123456789:error:0909006C:PEM routines:get_name:no start line:...

# Check and simultaneously display the key components (verbose):
openssl rsa -in private.key -check -text -noout | head -10
RSA key ok
Private-Key: (2048 bit, 2 primes)
modulus:
    00:b3:e4:f5:a6:b7:c8:d9:ea:fb:0c:1d:2e:3f:40:...
publicExponent: 65537 (0x10001)

# Use before deploying to confirm the key file wasn't truncated or corrupted.`);

addExample('openssl', 'Cipher & Protocol Listing', 'openssl ciphers -v "ALL:!aNULL:!eNULL"',
`openssl ciphers -v "ALL:!aNULL:!eNULL"
TLS_AES_256_GCM_SHA384         TLSv1.3  Kx=any    Au=any  Enc=AESGCM(256)          Mac=AEAD
TLS_CHACHA20_POLY1305_SHA256   TLSv1.3  Kx=any    Au=any  Enc=CHACHA20/POLY1305(256) Mac=AEAD
TLS_AES_128_GCM_SHA256         TLSv1.3  Kx=any    Au=any  Enc=AESGCM(128)          Mac=AEAD
ECDHE-ECDSA-AES256-GCM-SHA384  TLSv1.2  Kx=ECDH   Au=ECDSA Enc=AESGCM(256)        Mac=AEAD
ECDHE-RSA-AES256-GCM-SHA384    TLSv1.2  Kx=ECDH   Au=RSA  Enc=AESGCM(256)         Mac=AEAD
ECDHE-ECDSA-CHACHA20-POLY1305  TLSv1.2  Kx=ECDH   Au=ECDSA Enc=CHACHA20/POLY1305  Mac=AEAD
...
# Count total: openssl ciphers "ALL:!aNULL:!eNULL" | tr : '\n' | wc -l
# List only high-strength: openssl ciphers -v "HIGH:!aNULL:!MD5"`);

addExample('openssl', 'TLS Handshake Debugging', 'openssl s_client -connect host:443 -servername host -msg',
`openssl s_client -connect example.com:443 -servername example.com -msg
>>> TLS 1.3 Handshake [length 0125], ClientHello
    0300  01 21 03 03 ...
<<< TLS 1.3 Handshake [length 007a], ServerHello
    0300  02 76 03 03 ...
<<< TLS 1.3 ChangeCipherSpec [length 0001]
    14 03 03 00 01 01
<<< TLS 1.3 Handshake [length 00xx], EncryptedExtensions
<<< TLS 1.3 Handshake [length 03xx], Certificate
<<< TLS 1.3 Handshake [length 0xxx], CertificateVerify
<<< TLS 1.3 Handshake [length 0030], Finished
>>> TLS 1.3 ChangeCipherSpec [length 0001]
>>> TLS 1.3 Handshake [length 0030], Finished
---
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
# Each >>> = outbound (client); <<< = inbound (server).
# Use -debug for hex dumps of every byte, or -trace for parsed extensions.`);

data.updatedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log('\nDone.');
