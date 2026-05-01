// NetScaler enrichment batch 3:
//   - Networking (8)
//   - Rewrite & Responder (8)
//   - AAA & Authentication (7)
//   - Content Switching (7)
// 30 entries total.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ENTRIES = [
  // ============== Networking ==============
  { cmd: 'add ns ip <ip> <mask> -type <SNIP|VIP|MIP|NSIP>',
    example: `> add ns ip 10.10.10.11 255.255.255.0 -type SNIP -mgmtAccess DISABLED -snmp DISABLED
Done

> show ns ip
        IP                  Type       Mode    State
        10.10.10.10         NSIP       Active  Enabled
        10.10.10.11         SNIP       Active  Enabled    ← just added

What it means:
- NSIP : management IP for the ADC itself (one per box).
- SNIP : Subnet IP — used by the ADC as its source when talking to
         back-end servers in that subnet.
- VIP  : Virtual IP — front-end IP serviced by an LB/CS/GSLB vserver.
- MIP  : Mapped IP — legacy, mostly replaced by SNIPs.
- mgmtAccess DISABLED stops the SNIP from accepting management
  traffic (SSH, GUI, NITRO API). Best practice on data SNIPs.` },

  { cmd: 'add route <network> <mask> <gateway>',
    example: `> add route 0.0.0.0 0.0.0.0 10.10.10.1
Done
> add route 192.168.0.0 255.255.0.0 10.10.10.254
Done

> show route
        Network/Mask                  Gateway       Vlan  State
        0.0.0.0/0                     10.10.10.1    1     UP   (default)
        192.168.0.0/16                10.10.10.254  1     UP

What it means:
- Static route — used when no dynamic protocol (BGP/OSPF) is
  injecting prefixes.
- Default route uses 0.0.0.0/0 + a gateway IP that lives on a
  configured SNIP subnet.
- Routes are SNIP-bound; deleting the SNIP that the gateway is on
  removes the route automatically.` },

  { cmd: 'clear arp',
    example: `> clear arp
Are you sure you want to clear all ARP entries? [Y/N] Y
Done

> show arp
        IP            HWaddress         IF      VLAN  Type
        10.10.10.1    00:1a:1e:11:22:33 1/1     1     DYNAMIC  ← re-resolved

What it means:
- Flushes the entire ARP cache. Each subsequent first-packet to a
  destination triggers a fresh ARP request.
- Briefly disruptive — first packet may be lost if the L3 next-hop
  hasn't been re-resolved yet.
- Use to recover from poisoned ARP entries or after a swing-over to
  a new gateway MAC.` },

  { cmd: 'send arp -all',
    example: `> send arp -all
Done

# This forces gratuitous ARPs from every VIP/SNIP — useful after a
# physical move that left upstream switches with stale CAM entries.

What it means:
- Sends a gratuitous ARP for every VIP/SNIP on the appliance.
- Tells upstream switches "this MAC owns these IPs now" — refreshes
  their MAC tables instantly.
- Auto-fired on HA failover; manual use is for cable-swap scenarios.` },

  { cmd: 'add vlan <id>',
    example: `> add vlan 100 -aliasName web_servers
Done
> bind vlan 100 -ifnum 1/1 -tagged
> bind vlan 100 -ipAddress 10.20.0.1 255.255.255.0
Done

> show vlan
VLAN ID: 100
        Alias Name        : web_servers
        Tagged Interfaces : 1/1
        Bound IPs         : 10.20.0.1/24

What it means:
- Defines an L2 broadcast domain. Bind interfaces tagged or untagged
  to determine 802.1q behaviour on the wire.
- Bind IPs to the VLAN to make the ADC L3-routeable on that segment.
- VLAN 1 is the default (untagged) and exists implicitly.` },

  { cmd: 'bind vlan <id> -ifnum <interface>',
    example: `> bind vlan 100 -ifnum 1/1 -tagged
Done

> show vlan 100 | include Interfaces
        Tagged Interfaces : 1/1
        Untagged Interfaces : (none)

What it means:
- Adds an interface to the named VLAN. "-tagged" makes the link an
  802.1q trunk for this VLAN; without it, the interface treats this
  VLAN as untagged (native).
- An interface can be untagged in only ONE VLAN but tagged in many.
- Mismatched tagging at the upstream switch = silent traffic loss
  on that VLAN.` },

  { cmd: 'add channel <name> -ifnum <num1> <num2>',
    example: `> add channel LA/1 -ifnum 1/1 1/2 -tagAll ON
> set channel LA/1 -lacpMode ACTIVE -speed 10000
Done

> show channel
LA/1 (802.3ad LACP) State: UP
        Members      : 1/1 (UP), 1/2 (UP)
        Speed        : 10000 Mbps (aggregated)
        LACP Mode    : ACTIVE
        Hash Method  : SRC_DST_IP

What it means:
- Combines multiple physical interfaces into a single logical link
  for bandwidth + redundancy.
- LACP ACTIVE both ends → fast negotiation. PASSIVE-PASSIVE will not
  bring the channel up.
- Hash method controls per-flow distribution. SRC_DST_IP is a safe
  default; SRC_DST_PORT can be used for HTTP-heavy workloads.` },

  { cmd: 'set ns config -usip ON',
    example: `> set ns config -usip ON
Done

> show ns config | include USIP
        USIP                : ON

What it means:
- USIP = Use Source IP. With USIP ON, the ADC uses the original
  client IP when talking to back-end servers (instead of a SNIP).
- Required when back-end logging or security relies on the real
  client IP and X-Forwarded-For isn't an option.
- Side effect: back-end servers MUST route their reply traffic
  back through the ADC (typically via static route or default
  gateway pointing at the SNIP). Otherwise return packets bypass
  the ADC and the connection breaks.` },

  // ============== Rewrite & Responder ==============
  { cmd: 'add rewrite action <name> insert_http_header X-Forwarded-For CLIENT.IP.SRC',
    example: `> add rewrite action act_xff insert_http_header X-Forwarded-For CLIENT.IP.SRC
Done

# Outbound HTTP request now contains:
GET /api/login HTTP/1.1
Host: api.global.com
X-Forwarded-For: 203.0.113.45    ← original client IP

What it means:
- Inserts an HTTP header containing a PI-expression value. Here the
  XFF header carries the original client IP that the back-end
  server-side application can log instead of the SNIP.
- CLIENT.IP.SRC always evaluates to the L3 source IP of the request,
  pre-NAT.
- Pair with a rewrite policy + REQ_OVERRIDE bind to make it actually
  fire on traffic.` },

  { cmd: 'add rewrite policy <name> <rule> <action>',
    example: `> add rewrite policy pol_xff true act_xff
Done

> show rewrite policy pol_xff
Name : pol_xff
        Rule       : true
        Action     : act_xff
        Hits       : 0
        Undef Hits : 0

What it means:
- Wires a match rule to a rewrite action. "true" means "fire on
  every request" — usually you'd use a more specific PI expression
  like HTTP.REQ.IS_VALID.
- "Undef Hits" counts rule-evaluation errors; should stay at 0
  in a well-formed policy.
- Bind to a vserver or global with "bind rewrite global" for the
  policy to actually evaluate.` },

  { cmd: 'bind rewrite global <policy> <priority>',
    example: `> bind rewrite global pol_xff 100 NEXT -type REQ_OVERRIDE
Done

> show rewrite global -type REQ_OVERRIDE
        Priority   Policy Name      Goto Expression
        100        pol_xff          NEXT

What it means:
- "global" binding fires on every vserver of every relevant feature.
- Priority 100: lower number = evaluated FIRST. Use 100/200/300
  spacing so future policies can be inserted without renumbering.
- "NEXT" goto: continue evaluating subsequent policies in this bank.
  Use "END" to stop after this policy fires.
- type REQ_OVERRIDE : evaluated before the LB/CS-policy decision —
  important so the inserted header reaches the back-end-decision
  path correctly.` },

  { cmd: 'add responder action <name> respondwith 403',
    example: `> add responder action act_drop respondwith '"HTTP/1.1 403 Forbidden\\r\\n\\r\\n"'
Done

> show responder action act_drop
Name : act_drop
        Type    : RESPONDWITH
        Target  : "HTTP/1.1 403 Forbidden\\r\\n\\r\\n"
        Hits    : 0

What it means:
- Crafts a synthetic response that the ADC sends back to the client
  WITHOUT forwarding the request to a back-end.
- Common for blocking known bad URLs, geo-blocking, rate-limiting
  responses.
- Note the literal "\\r\\n\\r\\n" sequence — required to terminate
  the HTTP headers properly.` },

  { cmd: "add responder policy <name> HTTP.REQ.URL.CONTAINS('/admin') DROP",
    example: `> add responder policy pol_block_admin 'HTTP.REQ.URL.CONTAINS("/admin")' DROP
Done

> bind responder global pol_block_admin 100 END
Done

# Trying to reach /admin:
$ curl -v http://www.global.com/admin
* Connection #0 to host www.global.com left intact
* Empty reply from server   ← TCP RST due to DROP action

What it means:
- DROP action silently kills the TCP connection — neither the
  back-end nor the client see a clean response.
- Compare with NOOP (just log/count), RESET (TCP RST), or
  RESPONDWITH (custom error page).
- Use HTTP.REQ.URL.CONTAINS_ANY("patset") for multiple URL prefixes
  in a single rule (much faster than chained CONTAINS()).` },

  { cmd: 'bind responder global <policy> <priority>',
    example: `> bind responder global pol_block_admin 100 END
Done

> show responder global
        Priority   Policy Name        Goto Expression
        100        pol_block_admin    END

What it means:
- Activates the responder policy globally. "END" stops further
  policies in this bank if this one fires — usually correct for
  blocking actions.
- Without "type" specified, the bind is to the default override
  bank (REQ_OVERRIDE for HTTP).
- Priority numbering: leave gaps (100, 200, 300) so inserting new
  policies doesn't require renumbering.` },

  { cmd: 'add rewrite action <name> replace HTTP.RES.HEADER("Server") "\\"\\""',
    example: `> add rewrite action act_strip_server replace 'HTTP.RES.HEADER("Server")' '""'
Done
> add rewrite policy pol_strip_server true act_strip_server
> bind rewrite global pol_strip_server 200 NEXT -type RES_OVERRIDE
Done

# Original back-end response: Server: Apache/2.4.41 (Ubuntu)
# After rewrite:                Server: (empty)

What it means:
- Removes the server-banner header from outbound responses to avoid
  fingerprinting attacks.
- Replacing with empty string ("") keeps the header present but
  empty. To remove the header entirely, use a "delete_http_header"
  action instead.
- type RES_OVERRIDE : evaluated on the response leg (server →
  client), before the response leaves the ADC.` },

  { cmd: 'add rewrite action <name> insert_http_header HSTS \'"max-age=31536000; includeSubDomains"\'',
    example: `> add rewrite action act_hsts insert_http_header Strict-Transport-Security '"max-age=31536000; includeSubDomains; preload"'
Done
> add rewrite policy pol_hsts 'HTTP.REQ.IS_VALID && CLIENT.SSL.IS_SSL' act_hsts
> bind rewrite global pol_hsts 300 NEXT -type RES_OVERRIDE
Done

# Server response now contains:
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

What it means:
- Adds the HSTS header so browsers refuse to downgrade to HTTP for
  one year (31,536,000 seconds).
- "includeSubDomains" extends the lock to subdomains.
- "preload" qualifies the domain for the HSTS preload list (browser-
  shipped lists of HSTS-required domains).
- Only fires on SSL connections (CLIENT.SSL.IS_SSL) — sending HSTS
  over HTTP is meaningless and triggers browser warnings.` },

  // ============== AAA & Authentication ==============
  { cmd: 'show authentication vserver',
    example: `> show authentication vserver
1)   Name  : auth_vs_main
       State : UP
       Effective State : UP
       Protocol : SSL
       Port  : 443
       IP   : 10.30.0.50
       Authentication : ON
       Authentication Profile : default

What it means:
- Authentication vservers handle login flows (form / SAML / OAuth).
- Used by AAA-TM for SSO, ICA Proxy, and forms-auth-protected
  applications.
- "Authentication Profile" carries the bound LDAP/RADIUS/SAML actions
  and policies — the actual authentication backends.` },

  { cmd: 'add system user <username> <password>',
    example: `> add system user opadmin Welcome2026!
Done

> bind system user opadmin operator -priority 100
Done

> show system user
Name              External Auth     Groups               CommandPolicy
nsroot            NO                superuser            superuser
opadmin           NO                operator             operator

What it means:
- Creates a local management user. Default access: NONE — must bind
  to a CmdPolicy (operator/sysadmin/superuser) for the user to do
  anything.
- "External Auth NO" : password is local. Set to YES + bind to
  ldap/tacacs policy to authenticate against an external directory
  while keeping the local user object for audit.
- nsroot is the built-in superuser; never delete it.` },

  { cmd: 'add authentication ldapAction <name> -serverIP <ip> -ldapBase <dn>',
    example: `> add authentication ldapAction LDAP_Corp -serverIP 10.40.0.5 -serverPort 636 -ldapBase "dc=corp,dc=local" -ldapBindDn "cn=svc-adc,ou=service,dc=corp,dc=local" -ldapBindDnPassword secret -secType SSL -ldapLoginName sAMAccountName
Done

> show authentication ldapAction LDAP_Corp
Name : LDAP_Corp
        Server IP   : 10.40.0.5
        Server Port : 636
        Base DN     : dc=corp,dc=local
        Login Name  : sAMAccountName
        Sec Type    : SSL
        Bind DN     : cn=svc-adc,ou=service,dc=corp,dc=local

What it means:
- Defines an LDAP/AD connection profile for authentication.
- secType SSL : LDAPS on TCP/636. Use TLS for STARTTLS upgrade on
  TCP/389. "PLAIN" sends passwords cleartext — never use.
- ldapLoginName sAMAccountName : tells the ADC to use the user's
  Windows logon name. UPN form: "userPrincipalName".
- The bindDn account is the service principal used for searches —
  needs read access to the user OUs.` },

  { cmd: 'add authentication samlAction <name> -samlIdPCertName <cert> -samlRedirectUrl <url>',
    example: `> add authentication samlAction SAML_AzureAD -samlIdPCertName azure-token-signing.crt -samlRedirectUrl https://login.microsoftonline.com/<tenant-id>/saml2 -samlIssuerName https://nkb.global.com/saml/metadata -samlSigningCertName saml-signing.crt
Done

> show authentication samlAction SAML_AzureAD
Name             : SAML_AzureAD
        IDP Cert Name      : azure-token-signing.crt
        Redirect URL       : https://login.microsoftonline.com/.../saml2
        Issuer Name (SP)   : https://nkb.global.com/saml/metadata
        SP Signing Cert    : saml-signing.crt

What it means:
- Configures the ADC as a SAML Service Provider (SP) federated
  with an external IdP (Azure AD / Okta / ADFS / etc.).
- IDP Cert is used to verify the signature on inbound SAML
  assertions from the IdP.
- Redirect URL is where the user's browser is sent for SSO.
- Issuer Name is your SP entityID — must match what the IdP has
  configured for this app.` },

  { cmd: 'kill aaa session -username <user>',
    example: `> kill aaa session -username jsmith
Are you sure you want to terminate session(s) for user jsmith? [Y/N] Y
Done. 2 sessions terminated.

What it means:
- Forcibly logs out all active sessions for the named user.
- Common during incident response — kicks a compromised user off
  the gateway immediately.
- "kill aaa session -all" terminates EVERYONE; usually only used
  during emergency maintenance.` },

  { cmd: 'show aaa session',
    example: `> show aaa session
Total active sessions: 45
1)   User Name : jsmith
       IntranetIP    : 10.99.0.50
       Login Time    : Wed May  1 09:00:12 2026
       Idle Time     : 0:00:14
       Authentication: LDAP

What it means:
- Active SSL-VPN / AAA-TM sessions, with which back-end IP each
  client is currently mapped to (intranetIP).
- Idle Time : seconds since last user activity. Sessions are reaped
  per "show vpn parameter -idleTimeout".
- Authentication column shows which auth source proved the user.` },

  { cmd: 'set system user <username> -externalAuth ENABLED',
    example: `> set system user opadmin -externalAuth ENABLED
Done

> show system user opadmin
Name             : opadmin
        External Auth      : YES         ← was NO
        Auth Type          : LDAP (via policy LDAP_Pol_Mgmt)

What it means:
- Switches the user from local-password to external-directory auth.
- LOCAL password is retained but ignored as long as ExternalAuth is
  YES — useful as a break-glass fallback.
- Requires an authentication policy bound to "system global" pointing
  at the LDAP/RADIUS/TACACS action that should authenticate the user.` },

  // ============== Content Switching ==============
  { cmd: 'show cs vserver',
    example: `> show cs vserver
1)  Name      : cs-edge-https
       Type      : SSL
       State     : UP
       VIP       : 203.0.113.10:443
       Precedence: RULE
       Default LB: lb-default-fallback
       Bound Pols: 5

What it means:
- CS vserver = front-end VIP that splits traffic to multiple
  underlying LB vservers based on policies.
- Precedence RULE : evaluate CS policies in priority order.
  Alternative URL : evaluate URL-based policies first.
- Default LB : fallback target when no CS policy matches.` },

  { cmd: 'add cs vserver <name> <protocol> <VIP> <port>',
    example: `> add cs vserver cs-edge-https SSL 203.0.113.10 443 -cltTimeout 180
Done
> bind ssl vserver cs-edge-https -certkeyName wildcard-global-com
Done

> show cs vserver cs-edge-https
        IP : 203.0.113.10:443 (SSL)
        State : UP

What it means:
- Creates the CS-vserver shell. Bind a default LB-vserver via
  "set cs vserver -lbVserver", and bind CS policies separately.
- For SSL, also bind a cert/key pair via "bind ssl vserver".
- cltTimeout 180 : kill idle client connections after 3 min.` },

  { cmd: 'add cs policy <name> -rule <expression>',
    example: `> add cs policy cs_pol_mobile -rule 'HTTP.REQ.HEADER("User-Agent").CONTAINS("Mobile")' -action cs_act_mobile
Done

> show cs policy cs_pol_mobile
Name : cs_pol_mobile
        Rule       : HTTP.REQ.HEADER("User-Agent").CONTAINS("Mobile")
        Action     : cs_act_mobile
        Hits       : 0

What it means:
- CS policy expressions use the full PI grammar — anything available
  to rewrite/responder is fair game (URL, host, header, source IP,
  geo, time of day).
- "action" must be a previously defined CS action (which carries the
  target LB-vserver).
- Bind to a CS vserver to activate.` },

  { cmd: 'add cs action <name> -targetLBVserver <lb-vserver>',
    example: `> add cs action cs_act_mobile -targetLBVserver lb-mobile-app
Done

> show cs action cs_act_mobile
Name             : cs_act_mobile
        TargetLBVserver  : lb-mobile-app
        Hits             : 0

What it means:
- A CS action is a tiny wrapper that names a target LB-vserver. Its
  only job: tell a CS policy "send the matched traffic here".
- Same target LB-vserver can be referenced by many CS actions.
- Built-in convenience: 'set cs vserver -lbVserver X' creates and
  binds a default action automatically.` },

  { cmd: 'bind cs vserver <cs-vserver> -policyName <policy> -targetLBVserver <lb-vserver> -priority <num>',
    example: `> bind cs vserver cs-edge-https -policyName cs_pol_mobile -targetLBVserver lb-mobile-app -priority 100 -gotoPriorityExpression END
Done

> show cs vserver cs-edge-https | include Bound
        Bound Policies:
          100 cs_pol_mobile    END  → lb-mobile-app

What it means:
- Wires CS policy → CS vserver, with priority and goto behaviour.
- Lower priority number = evaluated FIRST. Use 100, 200, 300 spacing
  for future inserts.
- gotoPriorityExpression END : stop on first match. NEXT continues
  through the policy chain.` },

  { cmd: 'stat cs vserver <name>',
    example: `> stat cs vserver cs-edge-https

CS Vserver Statistics for cs-edge-https
        Hits                   : 102,345
        Requests               : 102,345
        Responses              : 102,000
        Current Client Conn    : 8
        Total Client Conn      : 50,234
        Current Server Conn    : 6
        Bytes In               : 18.2 MB
        Bytes Out              : 124.6 MB
        Policy Hits Top 3:
                cs_pol_mobile  : 45,012
                cs_pol_api     : 12,003
                cs_pol_admin   : 405

What it means:
- Per-CS-vserver counters since boot or last "clear ns stats".
- Policy Hits Top 3 : helps confirm traffic is hitting the policies
  you expected. A policy with 0 hits over a long uptime usually
  means its rule is wrong or its priority is below a NEXT-only
  policy that always matches.` },

  { cmd: 'set cs vserver <name> -redirectURL <url>',
    example: `> set cs vserver cs-edge-https -redirectURL https://maintenance.global.com/
Done

# Browser hitting the VIP now sees:
HTTP/1.1 302 Found
Location: https://maintenance.global.com/

What it means:
- Sets a fallback URL the CS vserver redirects to when the chosen
  back-end LB-vserver is DOWN (no FS healthy services).
- Useful for graceful maintenance pages instead of "Connection
  refused" errors.
- Returns HTTP/1.1 302 — change with -redirectURLType for 301
  permanent redirects.` }
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
