// NetScaler enrichment batch 5: SSL Management (16) + Load Balancing (20).

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ENTRIES = [
  // ============== SSL Management ==============
  { cmd: 'show ssl vserver <name>',
    example: `> show ssl vserver vs_https

Name : vs_https
        Type           : SSL
        State          : UP
        IP : 203.0.113.10:443
        SSL Profile    : ns_default_ssl_profile_frontend
        Certs bound    : 1 (wildcard.global.com)
        Cipher Groups  : DEFAULT
        Protocols      : TLSv1.2 ENABLED, TLSv1.3 ENABLED
        SSLv3/TLSv1/TLSv1.1 : DISABLED

What it means:
- Per-VIP SSL config snapshot. Confirms enabled protocols, bound
  cert/key pairs, applied SSL profile.
- Modern best practice: TLS 1.2 + TLS 1.3 only; SSLv3/TLS1.0/1.1
  disabled (deprecated).
- "Certs bound" should be at least 1 (the server cert) and may
  include intermediate CA certs as additional binds.` },

  { cmd: 'show ssl certkey',
    example: `> show ssl certkey

1)  Name              : wildcard.global.com
       Cert Path        : /nsconfig/ssl/wildcard.global.com.crt
       Key Path         : /nsconfig/ssl/wildcard.global.com.key
       Days to Expiry   : 412
       Issuer           : DigiCert SHA2 Secure Server CA
       Status           : Valid

2)  Name              : api.global.com
       Days to Expiry   : 32           ← warning, renew soon
       Issuer           : Let's Encrypt R3
       Status           : Valid

What it means:
- Inventory of every SSL certkey pair on the appliance.
- Days to Expiry < 30 should trigger urgent renewal.
- Let's Encrypt certs typically have 90-day validity — automate
  renewal via certbot or ACME tooling.` },

  { cmd: 'show ssl certkey <name>',
    example: `> show ssl certkey wildcard.global.com

Name             : wildcard.global.com
        Cert Path        : /nsconfig/ssl/wildcard.global.com.crt
        Key Path         : /nsconfig/ssl/wildcard.global.com.key
        Subject Common Name : *.global.com
        Subject Alternative Names : *.global.com, global.com
        Issuer           : DigiCert SHA2 Secure Server CA
        Valid From       : 2025-04-01 00:00:00 GMT
        Valid To         : 2027-05-01 23:59:59 GMT
        Days to Expiry   : 412
        Serial Number    : 0xABCDEF1234
        Signature Algo   : sha256RSA
        Public Key       : RSA, 2048 bits
        Bound Vservers   : vs_https, cs-edge-https

What it means:
- Detailed view of one cert. Confirms SAN entries (critical — the
  cert is only valid for the listed names).
- "Bound Vservers" tells you which VIPs are using this cert —
  important before deleting / replacing it.
- Signature Algo : sha256RSA is current standard. SHA-1 is deprecated
  and rejected by modern browsers.` },

  { cmd: 'add ssl certkey <name> -cert <certfile> -key <keyfile>',
    example: `> add ssl certkey wildcard.global.com -cert /nsconfig/ssl/wildcard.crt -key /nsconfig/ssl/wildcard.key -password
Enter password for the key: ********
Done

> show ssl certkey wildcard.global.com | grep Status
        Status           : Valid

What it means:
- Imports a cert + private key into the SSL keystore.
- Files must already be in /nsconfig/ssl/. Upload via SCP, GUI,
  or the NITRO API.
- If the key is password-protected, "-password" prompts; for unattended
  imports add "-passcrypt <encrypted_password>".
- After import, bind to a vserver with "bind ssl vserver -certkeyName".` },

  { cmd: 'update ssl certkey <name> -cert <certfile> -key <keyfile>',
    example: `> update ssl certkey wildcard.global.com -cert /nsconfig/ssl/new-wildcard.crt -key /nsconfig/ssl/new-wildcard.key
Done

# Bound vservers automatically pick up the new cert without rebind.

What it means:
- Replaces the cert/key files for an existing keypair WITHOUT
  unbinding from vservers — zero-downtime renewal.
- Common workflow: upload renewed cert files alongside the old ones,
  then "update ssl certkey" with the new file paths.
- Active SSL sessions continue with the OLD cert until they
  renegotiate; new sessions immediately use the NEW cert.` },

  { cmd: 'bind ssl vserver <vserver-name> -certkeyName <certkey-name>',
    example: `> bind ssl vserver vs_https -certkeyName wildcard.global.com
Done

> bind ssl vserver vs_https -certkeyName intermediate-ca -CA
Done

> show ssl vserver vs_https | grep Cert
        Bound Certs:
          wildcard.global.com  (Server)
          intermediate-ca      (CA Intermediate)

What it means:
- Binds a cert/key pair to an SSL VIP — the VIP serves this cert in
  its TLS handshakes.
- Bind intermediate CAs with the "-CA" flag so they're sent to clients
  during the handshake, completing the cert chain.
- A vserver can have ONE server cert bound (default) plus multiple
  CA / SNI alternates.` },

  { cmd: 'bind ssl vserver <vserver-name> -cipherName <cipher-group>',
    example: `> bind ssl vserver vs_https -cipherName MODERN-TLS13
Done

> show ssl vserver vs_https | grep Cipher
        Cipher Groups:
          MODERN-TLS13   (priority 1)
          DEFAULT        (priority 2 — fallback)

What it means:
- Replaces or augments the cipher group on a vserver.
- Cipher groups are ordered lists of cipher suites; the first match
  during the handshake wins.
- Build modern groups via "add ssl cipher MODERN-TLS13" then add
  individual cipher names; or use built-in groups like "DEFAULT",
  "PFS", "EECDH".` },

  { cmd: 'set ssl vserver <name> -ssl3 DISABLED -tls1 DISABLED -tls11 DISABLED -tls12 ENABLED -tls13 ENABLED',
    example: `> set ssl vserver vs_https -ssl3 DISABLED -tls1 DISABLED -tls11 DISABLED -tls12 ENABLED -tls13 ENABLED
Done

> show ssl vserver vs_https | grep -E "SSLv3|TLSv1"
        SSLv3            : DISABLED
        TLSv1            : DISABLED
        TLSv1.1          : DISABLED
        TLSv1.2          : ENABLED
        TLSv1.3          : ENABLED

What it means:
- Modern best practice: ONLY TLS 1.2 + TLS 1.3 enabled.
- SSLv3 (POODLE), TLS1.0/1.1 (BEAST, weak ciphers) disabled per
  PCI-DSS 4.0 and most enterprise security policies.
- Verify post-change with "openssl s_client -connect VIP:443 -tls1_1"
  — should fail handshake.` },

  { cmd: 'set ssl profile <name> -tls13 ENABLED',
    example: `> set ssl profile secure_prof -tls13 ENABLED -tls13SessionTicketsPerAuthContext 1 -ssl3 DISABLED -tls1 DISABLED -tls11 DISABLED
Done

> show ssl profile secure_prof | grep -i tls
        TLSv1.3                       : ENABLED
        TLSv1.2                       : ENABLED
        TLSv1.1 / TLSv1 / SSLv3       : DISABLED
        TLS 1.3 session tickets       : 1 per auth context

What it means:
- Profiles centralise SSL settings — applied to many vservers via
  a single "set ssl vserver -sslProfile <name>".
- Easier than configuring each vserver individually; ensures
  consistency across many VIPs.
- TLS 1.3 session tickets enable session resumption with forward
  secrecy — speeds up reconnects.` },

  { cmd: 'show ssl cipher <group-name>',
    example: `> show ssl cipher DEFAULT

DEFAULT (built-in)
        TLS_AES_256_GCM_SHA384       (TLSv1.3)  Strength: HIGH
        TLS_CHACHA20_POLY1305_SHA256 (TLSv1.3)  Strength: HIGH
        TLS_AES_128_GCM_SHA256       (TLSv1.3)  Strength: HIGH
        ECDHE-RSA-AES256-GCM-SHA384  (TLSv1.2)  Strength: HIGH
        ECDHE-RSA-AES128-GCM-SHA256  (TLSv1.2)  Strength: HIGH
        ...

What it means:
- Lists every cipher suite in the named group, with TLS version
  and security strength.
- ECDHE-* ciphers provide forward secrecy (per-session keys).
- AES-GCM and ChaCha20-Poly1305 are AEAD ciphers (authenticated
  encryption) — modern preference.
- Avoid: anything with "EXPORT", "DES", "RC4", "MD5", "NULL".` },

  { cmd: 'create ssl rsakey <keyfile> <bits>',
    example: `> create ssl rsakey /nsconfig/ssl/new-server.key 2048 -exponent F4 -keyForm PEM
Done

# Then create a CSR using the new key:
> create ssl certreq /nsconfig/ssl/new-server.csr -keyFile /nsconfig/ssl/new-server.key \\
       -countryName GB -stateName London -organizationName "Global Ltd" \\
       -commonName "*.global.com"
Done

What it means:
- Generates a fresh RSA private key on the appliance.
- 2048 bits is the minimum modern; 3072 or 4096 for higher-security
  applications. EC keys (create ssl eckey) are smaller and faster
  but less universally supported.
- exponent F4 = 65537 (standard). PEM is text-encoded; DER is binary.
- Keep generated keys in /nsconfig/ssl/ with file permissions 0600.` },

  { cmd: 'rm ssl certkey <name>',
    example: `> rm ssl certkey old-wildcard.global.com
Are you sure you want to delete this certkey object? [Y/N] Y
Cannot delete: certkey is bound to vserver(s):
  vs_https, cs-edge-https

# Unbind first:
> unbind ssl vserver vs_https -certkeyName old-wildcard.global.com
> unbind ssl vserver cs-edge-https -certkeyName old-wildcard.global.com
> rm ssl certkey old-wildcard.global.com
Done

What it means:
- Cert/key cannot be deleted while bound to any vserver — typical
  precaution to prevent accidentally orphaning a VIP.
- Workflow: bind the new cert first, unbind the old, then delete.
- The underlying .crt/.key files in /nsconfig/ssl/ are NOT removed —
  delete them manually if no longer needed.` },

  { cmd: 'stat ssl vserver <name>',
    example: `> stat ssl vserver vs_https

SSL Vserver Statistics for vs_https
        SSL Sessions               : 8,502
        Total Handshakes           : 145,021
        Successful Handshakes      : 144,989
        Failed Handshakes          : 32
        SSL Renegotiations         : 4
        SSL Session Reuses         : 102,341
        SNI Connections            : 145,012
        OCSP Stapling Stats:
          Stapled responses        : 142,901
          Cache hits               : 142,800

What it means:
- Per-vserver SSL counters.
- Failed/Total handshake ratio under 1% is normal; spikes indicate
  a compatibility problem with a major client population.
- Session reuses : how many resumptions skipped a full handshake.
  High ratio = good (faster reconnects, lower CPU).
- SNI : Server Name Indication — modern clients send the hostname
  in cleartext during ClientHello. Required for multi-cert vservers.` },

  { cmd: 'add ssl profile <name> -sslProfileType BackEnd',
    example: `> add ssl profile backend_strict -sslProfileType BackEnd -tls12 ENABLED -tls13 ENABLED -ssl3 DISABLED -tls1 DISABLED -tls11 DISABLED -serverAuth ENABLED
Done

> bind service ssl_backend_svc -sslProfile backend_strict
Done

What it means:
- "BackEnd" profile applies when the ADC initiates SSL TO back-end
  servers (for re-encryption / SSL bridging deployments).
- "FrontEnd" (default) applies to client-facing connections.
- serverAuth ENABLED : the ADC validates the back-end server's cert
  against a CA trust store — essential for proper end-to-end SSL.` },

  { cmd: 'bind ssl profile <name> -cipherName <group>',
    example: `> bind ssl profile secure_prof -cipherName MODERN-TLS13 -cipherPriority 1
Done

> show ssl profile secure_prof | grep -A 5 Cipher
        Cipher Groups:
          MODERN-TLS13   (priority 1)

What it means:
- Binds a cipher group to a profile — the profile then applies that
  cipher group to every vserver using the profile.
- Lower priority = evaluated FIRST in the cipher selection.
- Centralises cipher policy: one bind here propagates to every
  vserver bound to the profile.` },

  { cmd: 'show ssl fipsKey',
    example: `> show ssl fipsKey

FIPS Key Storage:
        FIPS Card Status   : Not Present (Standard appliance)

# On a FIPS-edition MPX:
        FIPS Card Status   : ACTIVE
        Stored Keys        :
          fips_server_key (RSA 2048)
          fips_signing_key (EC P-256)

What it means:
- FIPS-edition appliances have a tamper-resistant HSM that stores
  private keys in hardware — keys never leave the card.
- Standard MPX/VPX appliances store keys in software and report
  "Not Present".
- Compliance use case: FIPS 140-2 Level 3 deployments (govt, finance).` },

  // ============== Load Balancing ==============
  { cmd: 'show lb vserver <name>',
    example: `> show lb vserver lb-web

Name             : lb-web
        State            : UP
        Effective State  : UP
        IP : 10.20.0.10:443 (SSL)
        Persistence      : COOKIEINSERT (Timeout: 2 min)
        LB Method        : LEASTCONNECTION
        Bound Services   : 4
            svc_web1 (192.168.1.10:443)  : UP
            svc_web2 (192.168.1.11:443)  : UP
            svc_web3 (192.168.1.12:443)  : UP
            svc_web4 (192.168.1.13:443)  : DOWN  ← unhealthy

What it means:
- "Effective State UP" means at least one service is UP and traffic
  is being served.
- LBMethod LEASTCONNECTION : sends new requests to the service with
  the fewest active connections.
- Persistence COOKIEINSERT : ADC injects a cookie so the same client
  keeps hitting the same back-end on subsequent requests.
- One service DOWN doesn't take the VIP down (still 3 UP) — but
  fix it before more services fail.` },

  { cmd: 'add lb vserver <name> <protocol> <VIP> <port>',
    example: `> add lb vserver lb-api SSL 10.20.0.20 443 -lbMethod LEASTCONNECTION -persistenceType SOURCEIP -timeout 30
Done

> bind ssl vserver lb-api -certkeyName api-cert
Done

> show lb vserver lb-api | head -5
Name             : lb-api
        State            : DOWN  ← no services bound yet

What it means:
- Creates the front-end VIP. State DOWN until at least one healthy
  service is bound.
- Persistence SOURCEIP / COOKIEINSERT / SSLSESSION are the most
  common; pick SOURCEIP if cookies aren't reliable (mobile NATs).
- Bind SSL cert for HTTPS VIPs immediately after creation, otherwise
  the handshake fails.` },

  { cmd: 'set lb vserver <name> -lbMethod <method>',
    example: `> set lb vserver lb-web -lbMethod LEASTRESPONSETIME
Done

> show lb vserver lb-web | grep Method
        LB Method        : LEASTRESPONSETIME

# Common methods:
#   ROUNDROBIN          : simple, predictable
#   LEASTCONNECTION     : fewest active connections
#   LEASTRESPONSETIME   : fastest response
#   LEASTBANDWIDTH      : lowest BW used
#   URLHASH / DOMAINHASH: deterministic by URL/domain
#   TOKEN               : custom token-based

What it means:
- Choice of LB method drives how new requests are distributed.
- LEASTCONNECTION suits long-lived connections (websockets, SSH).
- LEASTRESPONSETIME suits short-lived HTTP requests where back-ends
  may have varying capacity.
- ROUNDROBIN suits homogeneous back-ends with predictable workload.` },

  { cmd: 'set lb vserver <name> -persistenceType <type>',
    example: `> set lb vserver lb-web -persistenceType SOURCEIP -timeout 30
Done

> show lb vserver lb-web | grep -E "Persistence|Timeout"
        Persistence      : SOURCEIP
        Timeout          : 30 min

# Persistence types:
#   SOURCEIP        : same client IP → same back-end
#   COOKIEINSERT    : ADC injects identifying cookie
#   SSLSESSION      : same SSL session ID
#   RULE            : custom PI-expression-based
#   URLPASSIVE      : uses URL parameter
#   CUSTOMSERVERID  : back-end sends server ID header

What it means:
- Keeps a client mapped to the same back-end during a session.
- Required for stateful apps (shopping carts, session affinity).
- Timeout is in MINUTES — match it to your application's session
  expiry.
- SOURCEIP fails behind large NAT / proxy populations; prefer
  COOKIEINSERT for most modern HTTP apps.` },

  { cmd: 'enable lb vserver <name>',
    example: `> enable lb vserver lb-web
Done

> show lb vserver lb-web | grep State
        State            : UP

What it means:
- Brings an administratively-disabled vserver back online.
- Pair with "save ns config" to persist the change.
- Compare with "enable service" — enabling the vserver does NOT
  re-enable any individually-disabled services bound to it.` },

  { cmd: 'disable lb vserver <name>',
    example: `> disable lb vserver lb-web
Done

> show lb vserver lb-web | grep State
        State            : OUT OF SERVICE

# Existing connections continue; new connection attempts get TCP RST
# (or no response, depending on the network design).

What it means:
- Administratively disables a VIP. Existing connections drain
  naturally; new SYNs are rejected.
- "OUT OF SERVICE" state is distinct from "DOWN" (no healthy
  services). Use during planned maintenance to bleed traffic
  before changes.` },

  { cmd: 'stat lb vserver <name>',
    example: `> stat lb vserver lb-web

LB Vserver Statistics for lb-web
        Hits                       : 1,245,392
        Requests                   : 1,245,392
        Responses                  : 1,245,392
        Current Client Conn        : 8
        Total Client Conn          : 502,341
        Current Server Conn        : 6
        Bytes In                   : 18.2 MB
        Bytes Out                  : 124.6 MB
        Persistence Hits           : 102,341
        Spillover Hits             : 0

What it means:
- Per-VIP performance counters. "Hits" is the dominant top-line
  metric.
- "Spillover Hits" : connections rejected because vserver hit
  its configured threshold (set via -soMethod / -soThreshold).
  Should normally be 0 — non-zero means capacity tuning needed.` },

  { cmd: 'show service <name>',
    example: `> show service svc_web1

Name             : svc_web1
        IP : 192.168.1.10
        Port             : 443
        Protocol         : SSL
        State            : UP
        Last State Change: Wed May  1 09:00:00 2026
        Monitors         : tcp_default (UP), https-ecv (UP)
        Bound Vservers   : lb-web, cs-edge-https
        Current Conn     : 142

What it means:
- Detail of one back-end service. State UP requires every bound
  monitor to pass.
- "Last State Change" : useful when investigating recent flap
  events.
- "Bound Vservers" : every VIP that uses this service in its
  load-balancing pool.` },

  { cmd: 'add service <name> <server-ip> <protocol> <port>',
    example: `> add service svc_web1 192.168.1.10 SSL 443 -gslb NONE -maxClient 5000 -maxReq 0 -cip ENABLED -cipHeader X-Forwarded-For -cltTimeout 180 -svrTimeout 360
Done

> show service svc_web1 | grep State
        State            : UP

What it means:
- maxClient 5000 : cap concurrent connections per service to protect
  the back-end app.
- maxReq 0 : no per-connection request limit.
- cip ENABLED + cipHeader X-Forwarded-For : insert the original
  client IP in the named header on every request — back-end app
  can log the real source.
- cltTimeout / svrTimeout : idle timeouts for the client and server
  legs respectively.` },

  { cmd: 'enable service <name>',
    example: `> enable service svc_web1
Done

> show service svc_web1 | grep State
        State            : UP   (was DISABLED)

What it means:
- Brings a service back online after maintenance. State transitions
  through CHECKING (re-running monitors) before reaching UP.
- Pair with the LB-vserver-level enable/disable for full control.` },

  { cmd: 'disable service <name> -graceful YES -delay <seconds>',
    example: `> disable service svc_web1 -graceful YES -delay 60
Done

# Existing connections drain over 60 seconds. After that, residual
# connections are forcibly closed.

> show service svc_web1 | grep State
        State            : OUT OF SERVICE (graceful, 42 sec remaining)

What it means:
- "graceful YES" : new connections rejected, existing flows allowed
  to complete naturally.
- "-delay 60" : maximum drain time. After 60 sec, surviving connections
  are force-closed.
- Best practice for rolling-restart deployments — drain the back-end
  one service at a time without dropping in-flight requests.` },

  { cmd: 'bind lb vserver <vserver-name> <service-name>',
    example: `> bind lb vserver lb-web svc_web1
Done
> bind lb vserver lb-web svc_web2 -weight 2
Done

> show lb vserver lb-web | grep -A 5 "Bound Services"
        Bound Services :
          svc_web1 (weight 1) : UP
          svc_web2 (weight 2) : UP   ← gets 2x more traffic with weighted methods

What it means:
- Adds a service to the LB pool of a vserver.
- Optional "-weight N" : skews load distribution under weighted
  algorithms (LEASTCONNECTION-WEIGHT, ROUNDROBIN-WEIGHT etc.).
- A vserver can have many services bound; LB method decides which
  one each new request goes to.` },

  { cmd: 'add servicegroup <name> <protocol>',
    example: `> add servicegroup sg_web SSL -monitorThreshold 0 -maxClient 0 -cltTimeout 180
Done

> bind servicegroup sg_web 192.168.1.10 443
> bind servicegroup sg_web 192.168.1.11 443
> bind servicegroup sg_web 192.168.1.12 443
Done

What it means:
- Service groups are the modern alternative to per-server "service"
  objects — one definition holds many member IPs.
- Easier to manage: add/remove servers via "bind servicegroup".
- monitor + LB-method config lives on the group; each member gets
  evaluated separately for health but shares the same configuration
  template.` },

  { cmd: 'bind servicegroup <name> <server-ip> <port>',
    example: `> bind servicegroup sg_web 192.168.1.13 443
Done

> show servicegroup sg_web | grep -A 10 Members
        Members:
          192.168.1.10:443  UP
          192.168.1.11:443  UP
          192.168.1.12:443  UP
          192.168.1.13:443  UP   ← just added, monitors passing

What it means:
- Adds a server (IP:port) as a member of the named service group.
- Inherits LB method, monitor bindings, timeouts from the group.
- Health-check state is per-member; one failing server doesn't
  affect the others.` },

  { cmd: 'set lb monitor <monitor-name> -type HTTP -httpRequest "GET /health"',
    example: `> add lb monitor mon_health HTTP -httpRequest "GET /health" -respCode 200 -interval 5 -resptimeout 3 -retries 3
Done

> bind service svc_web1 -monitorName mon_health
Done

> show service svc_web1 | grep mon_health
          mon_health (HTTP /health) : UP, last probe 2 sec ago

What it means:
- Active health check: ADC sends GET /health every 5 sec, expects
  HTTP 200 within 3 sec.
- 3 consecutive failures before marking service DOWN.
- The /health endpoint should be lightweight (no DB query, no auth)
  — it runs every 5 sec on every member.
- Common patterns: /health, /healthz, /ping, /actuator/health.` },

  { cmd: 'add lb monitor <name> TCP',
    example: `> add lb monitor mon_tcp443 TCP -destPort 443 -interval 5 -resptimeout 2 -retries 3
Done

> show lb monitor mon_tcp443
Name : mon_tcp443
        Type        : TCP
        Dest Port   : 443
        Interval    : 5 sec
        Timeout     : 2 sec
        Retries     : 3

What it means:
- Pure L4 health check — opens a TCP connection, immediately closes.
- Lightweight (no app-layer payload). Suitable when no /health
  endpoint exists or for stateful protocols (SSH, SMTP).
- Doesn't detect application bugs (a hung Tomcat with a listening
  socket would still show TCP UP). Pair with an L7 monitor for
  full coverage.` },

  { cmd: 'show lb monitor <name>',
    example: `> show lb monitor mon_health

Name             : mon_health
        Type        : HTTP
        HTTP Request: GET /health
        Resp Code   : 200
        Interval    : 5 sec
        Timeout     : 3 sec
        Retries     : 3
        Bound Services   : svc_web1 (UP), svc_web2 (UP), svc_web3 (UP)
        Current State    : healthy on all bound services

What it means:
- Detail of one monitor. Confirms request, expected response code,
  timing parameters.
- "Bound Services" : every service this monitor is attached to.
- One monitor can be bound to many services; one service can have
  many monitors (all must pass for the service to be UP).` },

  { cmd: 'set lb vserver <name> -backupVServer <backup-name>',
    example: `> set lb vserver lb-web -backupVServer lb-web-DR
Done

> show lb vserver lb-web | grep Backup
        Backup VServer   : lb-web-DR

# When all services on lb-web go DOWN, the ADC seamlessly fails
# traffic over to lb-web-DR's services.

What it means:
- Cascading failover: if every service on lb-web is unhealthy,
  traffic redirects to lb-web-DR's services.
- Backup vserver can have its own backup (chain), or the chain can
  loop back to the original primary once it recovers.
- Useful for active/standby DR within the same ADC.` },

  { cmd: 'set lb vserver <name> -soMethod CONNECTION -soThreshold <num>',
    example: `> set lb vserver lb-web -soMethod CONNECTION -soThreshold 8000 -soPersistence ENABLED -soPersistenceTimeout 2
Done

# Once 8001 concurrent connections are reached, new connections
# spill over to the backup vserver.

> show lb vserver lb-web | grep -i spillover
        Spillover Method     : CONNECTION
        Threshold            : 8000

What it means:
- Spillover protects the primary vserver from overload by deflecting
  excess traffic to a backup (configured via -backupVServer).
- soMethod CONNECTION : threshold counts active connections.
  Alternatives: BANDWIDTH, DYNAMICCONNECTION, HEALTH.
- Persistence ENABLED : already-connected clients keep going to the
  primary even after threshold is crossed (no flapping).` },

  { cmd: 'bind lb vserver <vs> <service>',
    example: `> bind lb vserver lb-web svc_web5
Done

> show lb vserver lb-web | grep "Bound Services"
        Bound Services : 5    ← was 4

What it means:
- Equivalent to "bind lb vserver <vserver-name> <service-name>";
  the shorter syntax is what the GUI's add-flow generates.
- Adds the service to the LB pool. Health-state evaluation begins
  immediately — the service may briefly show CHECKING before
  reaching its real state.` }
];

let updated = 0, alreadyHad = 0, notFound = 0;
for (const e of ENTRIES) {
  let found = null;
  for (const arr of Object.values(NS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (!found) { console.warn('  (not found):', e.cmd); notFound++; continue; }
  if (found.example && found.example.trim()) { alreadyHad++; continue; }
  found.example = e.example;
  updated++;
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log('Total entries processed:                ' + ENTRIES.length);
console.log('Existing commands updated with example: ' + updated);
console.log('Existing commands already had example:  ' + alreadyHad);
console.log('Not found:                              ' + notFound);
