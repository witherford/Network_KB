// Citrix NetScaler (now NetScaler ADC) learning curriculum.

export const CURRICULUM = {
  id: 'netscaler',
  title: 'NetScaler ADC',
  tagline: 'Citrix/NetScaler ADC — load balancing, SSL, content switching, GSLB, HA.',
  vendor: 'NetScaler / Citrix',
  estimatedMinutes: 240,
  modules: [
    {
      id: 'overview',
      title: 'Overview & Architecture',
      tagline: 'VPX, SDX, MPX, CPX — platforms, packet engines, and the core objects.',
      icon: '⚖️',
      sections: [
        { kind: 'prose', html: `
          <p><b>NetScaler ADC</b> (formerly Citrix ADC, originally NetScaler) is a full-proxy application delivery controller: load balancing, SSL offload, content switching, web application firewall, GSLB, and the ICA/HDX proxy for Citrix virtual apps & desktops. It is best understood as a <b>policy-driven reverse proxy</b> — every feature ultimately expresses itself as one or more policies attached to a virtual server (vServer).</p>
          <p>Platform variants:</p>
          <ul>
            <li><b>MPX</b> — dedicated hardware appliance.</li>
            <li><b>SDX</b> — hardware hypervisor that hosts multiple isolated VPX instances (per-tenant).</li>
            <li><b>VPX</b> — virtual appliance (VMware, Hyper-V, KVM, AWS, Azure, GCP).</li>
            <li><b>CPX</b> — containerised, for Kubernetes ingress.</li>
            <li><b>BLX</b> — bare-metal Linux install.</li>
          </ul>` },
        { kind: 'diagram', title: 'NetScaler traffic flow', ascii:
`   Client ---> [ VIP on ADC ] --pol-> [ vServer ] --pol-> [ Service/Svcgroup ]
                                                                 |
                                                                 v
                                                           Backend servers

   Policies (traffic, SSL, rewrite, responder, WAF) bind at each stage.
   Persistence, load-balancing method, and monitors live on the vServer/service.` },
        { kind: 'table', title: 'Key objects', headers: ['Object','Purpose'], rows: [
          ['NSIP','The ADC\'s management IP'],
          ['SNIP','Subnet IP — source IP used by ADC to reach backends'],
          ['VIP','Virtual IP — client-facing IP for a service'],
          ['MIP','Mapped IP — legacy; superseded by SNIP in most designs'],
          ['Service','One backend endpoint (IP:port, monitor)'],
          ['Service Group','Collection of services — typical for horizontal pools'],
          ['vServer (LB/CS/GSLB)','Virtual server that clients connect to'],
          ['Monitor','Health check (TCP, HTTP, ECV, PING-L3, etc.)'],
          ['Persistence','Session stickiness (cookieinsert, SSLSESSION, sourceip)'],
        ]},
      ],
    },

    {
      id: 'networking',
      title: 'Networking Foundations',
      tagline: 'NSIP, SNIP, VIPs, MAC-based forwarding, and why you rarely want USIP.',
      icon: '🌐',
      sections: [
        { kind: 'prose', html: `
          <p>NetScaler handles three categories of IP, and setting them up correctly is half the battle on a fresh deployment:</p>
          <ul>
            <li><b>NSIP</b> — management interface. Usually on a dedicated mgmt VLAN; one per HA node.</li>
            <li><b>SNIP</b> — "subnet IP". ADC uses this as source IP when talking to backends. Needs one SNIP per backend subnet, or one SNIP + routing. Ping-enabled SNIPs are great for reachability checks.</li>
            <li><b>VIP</b> — service-facing address. One per vServer (or shared across vServers on different ports).</li>
          </ul>
          <p>Default behaviour is <b>MAC-Based Forwarding (MBF)</b> — the ADC returns replies to whichever MAC the request came from, ignoring the routing table. This breaks when the return path requires a specific gateway. Disable MBF globally if you use L3 routing for returns; leave it on for asymmetric topologies.</p>` },
        { kind: 'cli', title: 'Initial network bring-up (NetScaler CLI)', code:
`# Management
set ns config -IPAddress 10.10.1.10 -netmask 255.255.255.0
# SNIPs per subnet (or single with routes)
add ns ip 10.20.0.10 255.255.255.0 -type SNIP -mgmtAccess DISABLED
add ns ip 10.30.0.10 255.255.255.0 -type SNIP
# Routing
add route 0.0.0.0 0.0.0.0 10.10.1.1
add route 10.40.0.0 255.255.0.0 10.20.0.1
# VLANs / interfaces
add vlan 110
bind vlan 110 -ifnum 1/1 -tagged
bind vlan 110 -IPAddress 10.20.0.10 255.255.255.0
# Features
enable ns feature LB SSL CS REWRITE RESPONDER AAA
save config` },
        { kind: 'callout', level: 'warn', title: 'USIP (Use Source IP) is almost always wrong', body: `USIP makes the ADC preserve the client IP when connecting to backends. Sounds nice, but then the backend\'s return traffic has to go back through the ADC — which means the backend\'s default gateway must be the ADC\'s SNIP. This causes asymmetric-routing grief and breaks direct server return. Prefer <b>X-Forwarded-For</b> header insertion (<code>set ns config -clientIPHdrName X-Forwarded-For</code>) and leave USIP off.` },
      ],
    },

    {
      id: 'load-balancing',
      title: 'Load Balancing — Methods & Monitors',
      tagline: 'Round-robin, least-connection, URL hash, and the monitor that decides up/down.',
      icon: '🔀',
      sections: [
        { kind: 'table', title: 'LB methods', headers: ['Method','Picks the backend with','Best for'], rows: [
          ['ROUNDROBIN','Next in sequence','Uniform stateless backends'],
          ['LEASTCONNECTION','Fewest active connections','Long-lived TCP (databases, ICA)'],
          ['LEASTRESPONSETIME','Lowest recent response time','HTTP with variable response times'],
          ['LEASTBANDWIDTH','Lowest current bps','Streaming, heavy asset downloads'],
          ['LEASTPACKETS','Lowest current pps','Voice/video'],
          ['URLHASH / DOMAINHASH','Hash of URL or domain','Cache tier with consistent targets'],
          ['CUSTOMLOAD','Policy-expression derived','Reading backend load from HTTP header'],
        ]},
        { kind: 'cli', title: 'LB vServer + service group + monitor', code:
`add lb monitor MON-HTTP-ROOT HTTP -respCode 200-399 -httpRequest "GET /healthz" -secure NO -LRTM DISABLED -retries 3 -downTime 30
add serviceGroup SG-WEB HTTP -autoScale DISABLED -cip ENABLED X-Forwarded-For
bind serviceGroup SG-WEB 10.40.0.11 80
bind serviceGroup SG-WEB 10.40.0.12 80
bind serviceGroup SG-WEB -monitorName MON-HTTP-ROOT
add lb vserver LBV-WEB HTTP 10.10.100.20 80 -lbmethod LEASTCONNECTION -persistenceType COOKIEINSERT -timeout 15
bind lb vserver LBV-WEB SG-WEB` },
        { kind: 'callout', level: 'tip', title: 'ECV monitors beat plain HTTP 200 checks', body: `An HTTP monitor returning 200 tells you the web server is alive; it does not tell you the backend DB is reachable. <b>Extended Content Verification (ECV)</b> monitors match a regex against the body — add a <code>/healthz</code> that exercises a DB lookup and expect "OK". Same for SSL endpoints: use HTTPS-ECV to avoid the ADC marking backends up after an expired cert breaks the app.` },
      ],
    },

    {
      id: 'ssl',
      title: 'SSL Offload & Termination',
      tagline: 'Certs, cipher groups, SNI, OCSP, and modernising legacy config.',
      icon: '🔒',
      sections: [
        { kind: 'prose', html: `
          <p>SSL offload is one of NetScaler's signature capabilities — clients terminate TLS on the ADC, backends speak plain HTTP (offload) or the ADC re-encrypts to backends (bridged SSL). The ADC handles cipher selection, certificate presentation, and session resumption centrally.</p>` },
        { kind: 'cli', title: 'TLS 1.2+/1.3 cipher group + SSL vServer', code:
`# Create a modern cipher group
add ssl cipher CG-MODERN
bind ssl cipher CG-MODERN -cipherName TLS1.3-AES256-GCM-SHA384
bind ssl cipher CG-MODERN -cipherName TLS1.3-AES128-GCM-SHA256
bind ssl cipher CG-MODERN -cipherName TLS1.3-CHACHA20-POLY1305-SHA256
bind ssl cipher CG-MODERN -cipherName TLS1.2-ECDHE-RSA-AES256-GCM-SHA384
bind ssl cipher CG-MODERN -cipherName TLS1.2-ECDHE-RSA-AES128-GCM-SHA256

# Install cert and bind to SSL vServer
add ssl certKey CERT-APP -cert "/nsconfig/ssl/app.crt" -key "/nsconfig/ssl/app.key"
add lb vserver LBV-APP SSL 10.10.100.30 443
bind lb vserver LBV-APP SG-WEB
bind ssl vserver LBV-APP -certkeyName CERT-APP
set ssl vserver LBV-APP -tls1 DISABLED -tls11 DISABLED -tls12 ENABLED -tls13 ENABLED -sslRedirect ENABLED
unbind ssl vserver LBV-APP -cipherName DEFAULT
bind ssl vserver LBV-APP -cipherName CG-MODERN
bind ssl vserver LBV-APP -eccCurveName ALL` },
        { kind: 'callout', level: 'warn', title: 'SNI is required for modern multi-tenant TLS', body: `If one VIP hosts multiple HTTPS sites, enable SNI (<code>set ssl vserver VSRV -SNIEnable ENABLED</code>) and bind per-host certificates with <code>bind ssl vserver ... -sniCert</code>. Without SNI, the ADC serves only the default cert — modern browsers will throw a name-mismatch on any other host.` },
        { kind: 'checklist', title: 'SSL hardening baseline', items: [
          'TLS 1.2 + TLS 1.3 only; disable 1.0/1.1',
          'Cipher group with GCM/CHACHA20 only — no CBC, no RC4, no 3DES',
          'HSTS set via rewrite/responder policy (max-age ≥ 31536000)',
          'OCSP stapling enabled on SSL cert (ocspCheck ENABLED)',
          'ECC curve list restricted to P-256/P-384/X25519',
          'Session tickets off (stateless tickets leak session keys after 48h rotation)',
          'SSL Profile pattern used (-sslProfile) instead of per-vserver flags',
        ]},
      ],
    },

    {
      id: 'content-switching',
      title: 'Content Switching',
      tagline: 'One VIP, many backends — routing by URL, host, or policy expression.',
      icon: '🎛️',
      sections: [
        { kind: 'prose', html: `
          <p><b>Content Switching (CS)</b> lets one VIP front several LB vServers, picking which based on a policy evaluated against the request. Classic use: one public HTTPS VIP that routes <code>/api/*</code> to one backend pool, <code>/static/*</code> to another, everything else to a default. The CS vServer terminates the connection (SSL, if any) and then proxies to the chosen LB vServer.</p>` },
        { kind: 'cli', title: 'CS vServer with path-based rules', code:
`add cs vserver CSV-APP SSL 10.10.100.40 443 -cltTimeout 180
bind ssl vserver CSV-APP -certkeyName CERT-APP
set ssl vserver CSV-APP -tls13 ENABLED -sslProfile SSL-PROF-MODERN

# Target LB vServers (non-addressable = just targets for CS)
add lb vserver LBV-API HTTP 0.0.0.0 0 -lbmethod LEASTCONNECTION
add lb vserver LBV-STATIC HTTP 0.0.0.0 0 -lbmethod ROUNDROBIN
add lb vserver LBV-APP-DEFAULT HTTP 0.0.0.0 0

# Policies (default expression syntax)
add cs action CSA-API -targetLBVserver LBV-API
add cs action CSA-STATIC -targetLBVserver LBV-STATIC
add cs policy CSP-API -rule "HTTP.REQ.URL.STARTSWITH(\\"/api/\\")" -action CSA-API
add cs policy CSP-STATIC -rule "HTTP.REQ.URL.STARTSWITH(\\"/static/\\") || HTTP.REQ.URL.ENDSWITH(\\".css\\")" -action CSA-STATIC

bind cs vserver CSV-APP -policyName CSP-API -priority 100
bind cs vserver CSV-APP -policyName CSP-STATIC -priority 200
bind cs vserver CSV-APP -lbvserver LBV-APP-DEFAULT` },
        { kind: 'callout', level: 'tip', title: 'Default Expressions (AppExpert / PIXL) vs Classic', body: `Older NetScaler config used "classic policies" (<code>REQ.HTTP.URL CONTAINS /api/</code>). Default Expressions (DEX, also called AppExpert/PIXL) are the modern syntax (<code>HTTP.REQ.URL.CONTAINS("/api/")</code>) — richer, faster, and actively developed. All new policies should use DEX. Migrate classic → DEX when you touch a config.` },
      ],
    },

    {
      id: 'policies-rewrite-responder',
      title: 'Policies — Rewrite, Responder, AppQoE',
      tagline: 'Header injection, redirects, response shaping.',
      icon: '✍️',
      sections: [
        { kind: 'prose', html: `
          <p>Three policy types act on traffic without a backend round-trip:</p>
          <ul>
            <li><b>Rewrite</b> — modify request or response (insert/delete/replace headers, rewrite body, strip cookies).</li>
            <li><b>Responder</b> — reply from the ADC itself (redirect, serve HTML error, rate-limit block).</li>
            <li><b>AppQoE</b> — apply priority queues / request shaping.</li>
          </ul>` },
        { kind: 'cli', title: 'HSTS via rewrite, redirect via responder', code:
`# HSTS on every response
add rewrite action RW-HSTS insert_http_header Strict-Transport-Security "\\"max-age=31536000; includeSubDomains; preload\\""
add rewrite policy RWP-HSTS "TRUE" RW-HSTS
bind lb vserver LBV-APP -policyName RWP-HSTS -priority 100 -gotoPriorityExpression END -type RESPONSE

# Force HTTP -> HTTPS
add responder action RA-HTTPS redirect "\\"https://\\" + HTTP.REQ.HOSTNAME + HTTP.REQ.URL" -responseStatusCode 301
add responder policy RP-HTTPS "HTTP.REQ.IS_VALID" RA-HTTPS
add lb vserver LBV-HTTP-REDIR HTTP 10.10.100.30 80
bind lb vserver LBV-HTTP-REDIR -policyName RP-HTTPS -priority 100 -gotoPriorityExpression END -type REQUEST` },
        { kind: 'callout', level: 'tip', title: 'Rewrite runs twice — REQUEST and RESPONSE', body: `Rewrite policies are direction-scoped. A policy bound with <code>-type REQUEST</code> sees the client→backend traffic; <code>-type RESPONSE</code> sees backend→client. Use RESPONSE for HSTS, CSP, X-Content-Type-Options. Use REQUEST for X-Forwarded-For, client-hint headers, or stripping cookies on upstream.` },
      ],
    },

    {
      id: 'gslb',
      title: 'Global Server Load Balancing',
      tagline: 'DNS-based traffic steering across sites and regions.',
      icon: '🌍',
      sections: [
        { kind: 'prose', html: `
          <p><b>GSLB</b> on NetScaler is an authoritative DNS responder that returns different IPs to the same FQDN based on site health, proximity (static proximity from a GeoIP DB), or persistence. GSLB sites peer via Metric Exchange Protocol (MEP) on TCP/3011 to share health info.</p>` },
        { kind: 'cli', title: 'Two-site active/active GSLB', code:
`# On each site ADC
add gslb site SITE-UK LOCAL -siteIPAddress 10.10.1.10
add gslb site SITE-US REMOTE -siteIPAddress 192.0.2.10

add gslb service SVC-UK 10.10.100.30 HTTPS 443 -siteName SITE-UK
add gslb service SVC-US 192.0.2.30 HTTPS 443 -siteName SITE-US

add gslb vserver GSLB-APP HTTPS -lbMethod LEASTCONNECTION -dnsRecordType A -persistenceType NONE
bind gslb vserver GSLB-APP -serviceName SVC-UK
bind gslb vserver GSLB-APP -serviceName SVC-US
bind gslb vserver GSLB-APP -domainName app.example.com -TTL 60

# Delegate app.example.com NS records to both sites' NSIPs in public DNS.` },
        { kind: 'callout', level: 'warn', title: 'DNS TTL is your failover budget', body: `Clients cache GSLB responses for the TTL you set. A TTL of 300 s means up to five minutes of traffic still heading to a dead site after a failure. For active/active with fast failover, TTL 30–60 is typical. Too low (≤ 10) and recursive resolvers start ignoring or caching anyway; your DNS infrastructure takes a pounding.` },
      ],
    },

    {
      id: 'ha',
      title: 'High Availability — Active/Passive Pair',
      tagline: 'HA sync, VMAC, state propagation, and split-brain prevention.',
      icon: '♻️',
      sections: [
        { kind: 'prose', html: `
          <p>Two ADCs form an HA pair sharing VIPs and SNIPs. The active node handles traffic; the passive node syncs configuration and session state (with Connection Mirroring for zero-drop failover on critical vServers). Heartbeats go over all physical interfaces; a dedicated sync channel (typically a private VLAN) carries config and session state.</p>` },
        { kind: 'cli', title: 'HA bring-up', code:
`# Primary
add ha node 1 10.10.1.11 -inc DISABLED     # partner NSIP
set ha node -hasync ENABLED -failsafe OFF
set ha node -helloInterval 200 -deadInterval 3
save config
# Secondary (repeat on partner)
add ha node 1 10.10.1.10

# Verify
show ha node
show ha sync

# Force a failover for testing
force ha failover` },
        { kind: 'callout', level: 'tip', title: 'Independent Network Config (INC) only when sites have separate L2', body: `INC mode lets each HA node have different VLANs/IPs — useful for stretched HA across sites with routed interconnect. Do not enable INC in a single-DC deployment: it disables VIP/SNIP sync and you lose the point of HA. Leave INC off unless you have a specific L2 separation.` },
      ],
    },

    {
      id: 'citrix-icaproxy',
      title: 'Citrix Virtual Apps / ICA Proxy',
      tagline: 'NetScaler Gateway, STA, load balancing StoreFront, and HDX optimisation.',
      icon: '🖥️',
      sections: [
        { kind: 'prose', html: `
          <p>NetScaler's most common enterprise role is fronting Citrix Virtual Apps and Desktops via <b>NetScaler Gateway</b> (formerly Access Gateway). Flow: user authenticates at the Gateway → StoreFront resolves resources → Gateway requests a <b>Secure Ticket Authority (STA)</b> ticket from the Delivery Controller → ICA/HDX session is proxied from client to VDA through the Gateway over TLS.</p>
          <p>Three LB vServers are typical:</p>
          <ul>
            <li>LB for StoreFront web (HTTPS 443, monitor: HTTP-ECV on /Citrix/StoreWeb)</li>
            <li>LB for DDCs (XML service, TCP 80 or 443, monitor: Citrix-XD-DDC)</li>
            <li>LB for STA (same target as DDCs usually, dedicated monitor CITRIX-STA-SERVICE)</li>
          </ul>` },
        { kind: 'cli', title: 'NetScaler Gateway (SSL VPN-less ICA proxy)', code:
`# Gateway vServer
add vpn vserver VPN-CITRIX SSL 10.10.100.50 443 -icaOnly ON -authentication ON

# Session profile: ICA only, StoreFront URL
add vpn sessionAction SPA-CITRIX-ICAOnly -transparentInterception OFF -defaultAuthorizationAction ALLOW -clientSecurity "NONE" -icaProxy ON -wihome "https://storefront.example.com/Citrix/StoreWeb" -ntDomain EXAMPLE -storefronturl "https://storefront.example.com"
add vpn sessionPolicy SPP-CITRIX "REQ.HTTP.HEADER User-Agent NOTCONTAINS CitrixReceiver" SPA-CITRIX-ICAOnly
bind vpn vserver VPN-CITRIX -policy SPP-CITRIX -priority 100

# Bind cert, STA, LDAP authentication
bind vpn vserver VPN-CITRIX -portaltheme RfWebUI
bind vpn vserver VPN-CITRIX -staServer "https://ddc1.example.com"
bind vpn vserver VPN-CITRIX -staServer "https://ddc2.example.com"
bind ssl vserver VPN-CITRIX -certkeyName CERT-CITRIX` },
        { kind: 'callout', level: 'tip', title: 'STA monitor must match the Gateway config exactly', body: `NetScaler Gateway caches STA URLs from its own config and passes the chosen STA ID to the VDA. If the monitor marks a DDC's STA healthy but the DDC URL does not match the one bound to the Gateway, ICA launches fail silently with "Cannot connect to session". Always bind STAs to the Gateway with the <b>exact FQDN</b> used in the Delivery Controller's Gateway config.` },
      ],
    },

    {
      id: 'waf',
      title: 'Web Application Firewall (Citrix WAF)',
      tagline: 'Signature + positive security model against OWASP Top 10.',
      icon: '🛡️',
      sections: [
        { kind: 'prose', html: `
          <p>NetScaler's WAF module (Application Firewall / AppFW) can run in two modes:</p>
          <ul>
            <li><b>Signature-based</b> (negative) — uses a Citrix-maintained signature file to block known attacks. Quick to deploy, low false positives for common exploits.</li>
            <li><b>Positive security</b> — learns the normal URLs, parameters, and content types, then blocks everything else. Stronger protection, high tuning cost. Used for regulated apps.</li>
          </ul>` },
        { kind: 'cli', title: 'Minimal AppFW in block mode', code:
`import appfw signatures "https://example.com/wafsigs.xml" -name AppFwDefault-sigs
add appfw profile PROF-APP -startURLAction NONE -denyURLAction BLOCK,LOG,STATS -crossSiteScriptingAction BLOCK,LOG,STATS -SQLInjectionAction BLOCK,LOG,STATS -bufferOverflowAction BLOCK,LOG
bind appfw profile PROF-APP -signatures AppFwDefault-sigs
add appfw policy POL-APP "HTTP.REQ.URL.CONTAINS(\\"/\\")" PROF-APP
bind lb vserver LBV-APP -policyName POL-APP -priority 100 -type REQUEST` },
        { kind: 'callout', level: 'warn', title: 'Always start in learn mode, never straight to BLOCK', body: `A fresh AppFW profile in BLOCK mode will block legitimate traffic as often as attacks. Start in <b>LEARN</b> + LOG for one to two weeks, review the learning database, approve the learned rules, then switch to BLOCK. Apps with AJAX or JSON payloads especially benefit from this — the automatic learner picks up the expected structures.` },
      ],
    },

    {
      id: 'aaa-auth',
      title: 'AAA for Apps',
      tagline: 'LDAP, RADIUS, SAML, OAuth — authentication at the ADC.',
      icon: '🪪',
      sections: [
        { kind: 'prose', html: `
          <p>NetScaler can authenticate clients before they ever reach the backend. For Citrix Gateway this is required; for LB vServers it is optional but useful when the backend cannot implement SSO. Supported factors: LDAP, RADIUS, TACACS+, SAML 2.0 (IdP and SP), OAuth 2.0 / OIDC (both modes), native CERT, Kerberos constrained delegation.</p>` },
        { kind: 'cli', title: 'LDAP + MFA chain', code:
`add authentication ldapAction LDAP-CORP -serverIP 10.50.0.10 -serverPort 636 -secType SSL -ldapBase "DC=example,DC=com" -ldapBindDn "CN=svc-ns,OU=service,DC=example,DC=com" -ldapBindDnPassword <pw> -ldapLoginName sAMAccountName
add authentication policy POL-LDAP -rule TRUE -action LDAP-CORP

add authentication radiusAction MFA-OTP -serverIP 10.50.0.20 -serverPort 1812 -radKey <secret>
add authentication policy POL-MFA -rule TRUE -action MFA-OTP

add authentication loginSchema LS-DUAL -authenticationSchema "/nsconfig/loginschema/LoginSchema/DualFactor.xml"
add authentication policylabel LABEL-PRIMARY -loginSchema LSCHEMA_INT
bind authentication policylabel LABEL-PRIMARY -policyName POL-LDAP -priority 100 -nextFactor LABEL-MFA

add authentication policylabel LABEL-MFA
bind authentication policylabel LABEL-MFA -policyName POL-MFA -priority 100` },
      ],
    },

    {
      id: 'monitoring',
      title: 'Monitoring & Logging',
      tagline: 'ADM, syslog, AppFlow, and the counters that matter.',
      icon: '📊',
      sections: [
        { kind: 'prose', html: `
          <p>NetScaler ADM (formerly MAS) is the companion orchestration tool — a separate VM that collects AppFlow telemetry, config backups, and SSL cert inventory across a fleet of ADCs. For a single-pair deployment you can get by without ADM; at &gt; 2 pairs it pays for itself within a quarter.</p>
          <p>For metrics: AppFlow (IPFIX/CFLOW) ships per-request data to ADM or a collector like ntopng. For logs: syslog to a central server with separate facilities for system and audit.</p>` },
        { kind: 'cli', title: 'Syslog + AppFlow', code:
`add audit syslogAction SYSLOG-CORP 10.50.0.50 -logLevel ALL -dateFormat YYYYMMDD -transport UDP
add audit syslogPolicy POL-SYSLOG TRUE SYSLOG-CORP
bind system global POL-SYSLOG -priority 100

add appflow collector ADM 10.50.0.60 -Port 4739 -netprofile NETPROFILE-MGMT
add appflow action ACT-ADM -collectors ADM
add appflow policy POL-ADM TRUE ACT-ADM
bind lb vserver LBV-APP -policyName POL-ADM -priority 100 -type REQUEST` },
        { kind: 'cli', title: 'Quick health commands', code:
`show ha node
stat system
stat lb vserver LBV-APP
show lb vserver LBV-APP -summary
stat ssl
show ssl profile SSL-PROF-MODERN
show sslcertkey CERT-APP -summary        # expiry dates
stat service SVC-WEB-01                  # per-backend stats
nsconmsg -d current -g mem_cur_AS_tot_used -g cpu_use -g mem_cur_tot_used` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'nstrace, nsconmsg, and the sequence that solves most tickets.',
      icon: '🧰',
      sections: [
        { kind: 'cli', title: 'Diagnostic cascade', code:
`# 1. Is the vServer up and backends healthy?
stat lb vserver LBV-APP
stat service SVC-WEB-01

# 2. Is the monitor returning what we think?
show lb monitor MON-HTTP-ROOT
stat lb monitor MON-HTTP-ROOT

# 3. Reachability from SNIP to backend?
ping -S 10.20.0.10 10.40.0.11
curl --interface 10.20.0.10 -v http://10.40.0.11/healthz

# 4. SSL handshake detail
openssl s_client -connect app.example.com:443 -servername app.example.com -tls1_3
show ssl vserver LBV-APP

# 5. Packet capture (circular, size-bounded)
start nstrace -size 0 -time 60 -filter "CONNECTION.DSTIP.EQ(10.10.100.30)" -tcpdump ENABLED
# downloads under /var/nstrace/; open in Wireshark

# 6. Realtime counters
nsconmsg -K newnslog -s ConLb=2 -d oldconmsg` },
        { kind: 'table', title: 'Symptom → cause', headers: ['Symptom','Likely cause'], rows: [
          ['Service shows DOWN randomly','Monitor too strict, or backend returns non-200 under load'],
          ['All services UP but no traffic','LB vServer DOWN / unbound; VIP not in same ARP scope'],
          ['SSL handshake fails','Cipher mismatch, missing intermediate cert, SNI not enabled'],
          ['Intermittent 504 Gateway Timeout','Backend slow; adjust srvTimeout on service'],
          ['Session drops after N seconds','Persistence timeout shorter than app session; bump persistence'],
          ['Config diverges between HA nodes','HA sync disabled; check "show ha sync"; reforce with "force ha sync"'],
          ['ICA launch fails "Cannot connect to session"','STA binding mismatch between Gateway and DDC Gateway config'],
        ]},
        { kind: 'callout', level: 'tip', title: 'nstrace is the universal answer', body: `When logs, counters, and monitors are inconclusive, take an <code>nstrace</code> filtered on the client or VIP IP for 30-60 seconds during a reproduction. Open in Wireshark with the NetScaler dissector — you see client-side and backend-side packets in one capture. Almost every tricky NetScaler ticket is solved at the packet level.` },
      ],
    },
  ],
};
