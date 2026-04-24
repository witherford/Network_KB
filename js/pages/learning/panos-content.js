// Curriculum for the Palo Alto PAN-OS learning centre.
// Each module renders as a page with a left rail of lessons.

export const CURRICULUM = {
  id: 'panos',
  title: 'Palo Alto PAN-OS',
  tagline: 'From the single-pass engine to full enterprise NGFW — architecture, policy, decryption, VPN, HA, Panorama, troubleshooting.',
  vendor: 'Palo Alto',
  platform: 'PAN-OS',
  badge: 'panos',
  estimatedMinutes: 260,
  modules: [
    {
      id: 'overview',
      title: 'Overview & Architecture',
      icon: '🔥',
      tagline: 'How PAN-OS differs from stateful firewalls — App-ID, User-ID, Content-ID, single-pass parallel processing.',
      sections: [
        { kind: 'prose', html: `
          <p><b>PAN-OS</b> is Palo Alto Networks' next-generation firewall OS. It runs on dedicated hardware (<b>PA-series</b>), virtualised appliances (<b>VM-series</b>), cloud-native containers (<b>CN-series</b>), and as SASE tenants (<b>Prisma Access</b>, built on PAN-OS under the hood).</p>
          <p>The defining idea is the <b>Single-Pass Parallel Processing (SP3)</b> architecture: a packet is classified <i>once</i> — by application, user, and content — and then all enabled security functions (App-ID, User-ID, Content-ID, URL filtering, threat prevention, WildFire, decryption) run in parallel against that single classification. Contrast this with bolt-on UTM products that re-inspect the same packet multiple times.</p>
          <p>Everything revolves around three classification engines — together they are called the <b>"3-IDs"</b>:</p>
          <ul>
            <li><b>App-ID</b> — what application is this flow? (not just port 443)</li>
            <li><b>User-ID</b> — which user is sending it? (not just IP)</li>
            <li><b>Content-ID</b> — what's inside? (threats, URLs, files, sensitive data)</li>
          </ul>
        `},
        { kind: 'diagram', title: 'SP3 at a glance', ascii: `
                 ┌─────────────────────────────────────────────┐
                 │                  Packet                     │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                  ┌──────────── Single Pass (classify once) ────────────┐
                  │                                                      │
                  │    App-ID  ──────────┐                               │
                  │    User-ID ──────────┼───▶  Security Policy Match    │
                  │    Content-ID ───────┘                               │
                  │                                                      │
                  └───────────────────────┬──────────────────────────────┘
                                          ▼
                  ┌─────────────── Parallel Processing ──────────────────┐
                  │  AV  · Anti-Spyware · Vuln · URL · WF · File · Data  │
                  └──────────────────────────────────────────────────────┘
` },
        { kind: 'prose', html: `
          <h4>Management plane vs data plane</h4>
          <p>PAN-OS firewalls use two independent planes. The <b>management plane</b> runs the Web UI, CLI, logging, config commit, dynamic updates — on its own CPU and RAM. The <b>data plane</b> runs the forwarding ASICs/CPUs that touch traffic. You can saturate one without affecting the other (a good thing — a heavy log-export job does not drop packets).</p>
        `},
        { kind: 'callout', level: 'info', title: 'Commit model — nothing is live until you commit', body: 'Every change is made to the <b>candidate</b> configuration and only applied to the <b>running</b> config after a successful <b>commit</b>. On Panorama you additionally push to devices. This is the #1 gotcha for engineers coming from Cisco — your typing changes nothing until commit completes.' },
        { kind: 'table', title: 'Hardware/software families you will meet in the wild', headers: ['Family','Form factor','Typical use'], rows: [
          ['PA-220 / PA-400 series','Branch appliance','Small sites, lab, home office'],
          ['PA-800 / PA-1400','Mid-range','Medium branches, internet edge'],
          ['PA-3400 / PA-5400 / PA-7000','Chassis','Campus, data centre, service provider'],
          ['VM-Series (VM-50 to VM-700)','Virtual','Private cloud, AWS/Azure/GCP'],
          ['CN-Series','Container','K8s east-west, CNF'],
          ['Panorama M-series / virtual','Management','Central policy + log collection']
        ]},
        { kind: 'table', title: 'Ports to allow end-to-end', headers: ['Purpose','Protocol','Port'], rows: [
          ['Management GUI (HTTPS)','TCP','443'],
          ['Management SSH','TCP','22'],
          ['Panorama ↔ firewall (mgmt)','TCP','3978'],
          ['Panorama log collector ingestion','TCP','3978 / 28443'],
          ['HA1 control (clear / encrypted)','TCP','28769 / 28260'],
          ['HA2 data path','Eth-type 0x7261 / IP 99','—'],
          ['Syslog out','UDP/TCP/TLS','514 / 6514'],
          ['GlobalProtect portal/gateway','TCP','443 + UDP 4501 (IPSec)'],
          ['Dynamic updates (updates.paloaltonetworks.com)','TCP','443','']
        ]}
      ]
    },

    {
      id: 'bootstrap',
      title: 'Initial Setup (Day-0)',
      icon: '⚡',
      tagline: 'From factory-fresh to a licensed, updatable, reachable firewall.',
      sections: [
        { kind: 'prose', html: `
          <p>A new PAN-OS firewall boots into factory defaults with management on <code>192.168.1.1/24</code>. Default credentials are <code>admin / admin</code> (you will be forced to change this on first login from 10.2 onward).</p>
          <p>Your first-day goals, in order: <b>reach the management interface → change the default password → apply an initial config → register & license → install latest content → set NTP → enable logging</b>. Only after that do you start building zones and policy.</p>
        `},
        { kind: 'cli', title: 'Minimum-viable bootstrap (console)', code: `# Connect console (9600 8N1). Default login: admin/admin (forced change).
configure
# Hostname, DNS, NTP — the basics.
set deviceconfig system hostname fw01
set deviceconfig system dns-setting servers primary 1.1.1.1 secondary 9.9.9.9
set deviceconfig system ntp-servers primary-ntp-server ntp-server-address pool.ntp.org
set deviceconfig system timezone Europe/London

# Management interface — change IP, gateway, permitted sources.
set deviceconfig system ip-address 10.10.10.2 netmask 255.255.255.0 default-gateway 10.10.10.1
set deviceconfig system permitted-ip 10.10.10.0/24
set deviceconfig system service disable-telnet yes disable-http yes
set deviceconfig system service disable-icmp no

# Admin account — create named admin, remove the default.
set mgt-config users netops permissions role-based superuser yes
set mgt-config users netops password        # prompts for password

# Commit.
commit description "Day-0 bootstrap"
exit`},
        { kind: 'callout', level: 'warn', title: 'Keep an out-of-band path when you change mgmt IP', body: 'Commit is immediate. If your SSH session is over the management interface and you change its IP/subnet, you will lose the session. Bootstrap from the console, or add <b>commit scheduled-for</b> / a second session before you touch the active path.' },
        { kind: 'prose', html: `
          <h4>License & content updates</h4>
          <p>A PAN-OS box without licenses is a stateful firewall. The value comes from <b>Threat Prevention</b>, <b>URL Filtering</b>, <b>WildFire</b>, <b>DNS Security</b>, <b>GlobalProtect</b>, and <b>SD-WAN</b> subscriptions. You activate them with the CSP auth-code, then schedule dynamic updates so content stays fresh.</p>
        `},
        { kind: 'cli', title: 'Licensing and first content pull', code: `# From the CLI:
request license fetch auth-code <AUTHCODE>    # register + pull licenses
request license info                           # verify
request system software check                  # pick a target PAN-OS

# Dynamic content (always do apps+threats together).
request content upgrade check
request content upgrade download latest
request content upgrade install version latest

# Anti-virus package (hourly).
request anti-virus upgrade check
request anti-virus upgrade download latest
request anti-virus upgrade install version latest

# WildFire (every 5 min / real-time).
request wildfire upgrade check
request wildfire upgrade download latest
request wildfire upgrade install version latest`},
        { kind: 'checklist', title: 'Day-0 completion checklist', items: [
          'Changed default admin password and created a named superuser',
          'Management IP/netmask/gateway set, permitted-ip list locked down',
          'DNS + NTP configured and clock ≤ 1s drift',
          'Auth-code applied, all paid subscriptions activated',
          'Content package installed and dynamic-update schedule set',
          'PAN-OS version on a supported train (see <a href=\'#/software\'>Software Releases</a>)',
          'Backup of running-config exported off-box',
          'Panorama association (if applicable) complete and in sync'
        ]}
      ]
    },

    {
      id: 'interfaces-zones',
      title: 'Interfaces, Zones & Virtual Routers',
      icon: '🔌',
      tagline: 'Physical, subinterface, aggregate, L3/L2/Vwire/Tap — and the zone/VR model that ties them together.',
      sections: [
        { kind: 'prose', html: `
          <p>PAN-OS decouples the <i>physical</i> port from the <i>logical</i> role. An interface has a <b>type</b> that determines what can live on it:</p>
          <ul>
            <li><b>Layer 3</b> — routed, has an IP, belongs to a virtual router. 95% of deployments.</li>
            <li><b>Layer 2</b> — bridged within a VLAN object. Rare.</li>
            <li><b>Virtual Wire</b> — transparent bump-in-the-wire between two ports. No IP, preserves existing routing.</li>
            <li><b>Tap</b> — passive sniffing from a SPAN port. Used for App-ID discovery or POCs.</li>
            <li><b>Aggregate (AE)</b> — LACP bundle of multiple physical ports. Only then assign type to the AE.</li>
            <li><b>HA</b> — dedicated HA1/HA2/HA3 interfaces (not usable for traffic).</li>
          </ul>
          <p>Every traffic-bearing interface must belong to a <b>zone</b>. Zones are arbitrary security containers — name them by role, not by topology: <code>trust</code>, <code>untrust</code>, <code>dmz</code>, <code>guest</code>, <code>mgmt</code>, <code>oob</code>, <code>vpn-users</code>. Security policy is written zone-to-zone.</p>
        `},
        { kind: 'diagram', title: 'Interface → zone → VR — the three-layer model', ascii: `
       ethernet1/1 (L3) ───────┐
                               ├──▶  zone "untrust"  ──┐
       ethernet1/2 (L3) ───────┘                       │
                                                       ├──▶  Virtual Router "default"
       ethernet1/3.10 (L3 sub) ──▶ zone "dmz"      ────┤
                                                       │
       ae1 (L3, LACP of 1/4-1/5) ──▶ zone "trust"  ────┘
                                                       │
                                              ┌─── static, OSPF, BGP
                                              └─── PBF, redistribution
` },
        { kind: 'cli', title: 'L3 interface with subinterface + zone + VR (CLI set-format)', code: `configure
# Parent L3 physical.
set network interface ethernet ethernet1/3 layer3 ip 10.20.0.1/24
set network interface ethernet ethernet1/3 layer3 interface-management-profile allow-ping

# Subinterface on VLAN 10.
set network interface ethernet ethernet1/3 layer3 units ethernet1/3.10 ip 10.20.10.1/24
set network interface ethernet ethernet1/3 layer3 units ethernet1/3.10 tag 10

# Zones.
set zone trust network layer3 ethernet1/3
set zone dmz   network layer3 ethernet1/3.10

# Virtual router.
set network virtual-router default interface [ ethernet1/3 ethernet1/3.10 ]
set network virtual-router default routing-table ip static-route default-to-internet \\
    destination 0.0.0.0/0 nexthop ip-address 10.20.0.254

commit description "L3 + zones + VR"`},
        { kind: 'callout', level: 'tip', title: 'Management Profiles — allow what you need, nothing else', body: 'An interface-management-profile controls which mgmt services are reachable <i>on that interface</i> (ping, SSH, HTTPS, SNMP, response-pages). Do <b>not</b> enable SSH/HTTPS on untrust without a strong reason — use the dedicated <b>management</b> interface or a trusted bastion.' },
        { kind: 'table', title: 'When to use each interface type', headers: ['Type','Good for','Watch-out'], rows: [
          ['Layer 3','Default for new deployments, NAT, routing, VPN','Needs an IP and a VR'],
          ['Layer 2 / VLAN','Inserting a firewall inside an existing bridged domain','Rare; needs VLAN object + zones'],
          ['Virtual Wire','Evaluation drop-in, out-of-band inline, legacy routing','No NAT, no route changes'],
          ['Tap','SPAN-based discovery / App-ID visibility POC','Visibility only — cannot block'],
          ['Aggregate (AE)','Redundant/high-throughput uplinks','All members must match speed + duplex; LACP partner needed'],
          ['Decrypt Mirror','Forward decrypted copies to a DLP/NDR','Licensed feature; careful with DC controls']
        ]}
      ]
    },

    {
      id: 'security-policy',
      title: 'Security Policy',
      icon: '🛡️',
      tagline: 'The rulebase is the heart of PAN-OS — zone-based, app-based, and evaluated top-down.',
      sections: [
        { kind: 'prose', html: `
          <p>PAN-OS evaluates security policy <b>top-down, first-match</b>. A rule needs <b>seven</b> match fields — miss any and the rule does not match:</p>
          <ol>
            <li><b>Source zone</b></li>
            <li><b>Source address / user / device</b></li>
            <li><b>Destination zone</b></li>
            <li><b>Destination address / device</b></li>
            <li><b>Application</b> (App-ID)</li>
            <li><b>Service</b> (port/protocol) — set to <code>application-default</code> unless you <i>must</i> deviate</li>
            <li><b>URL category</b> (optional)</li>
          </ol>
          <p>Below the user-defined rules live two implicit rules: <b>intrazone-default: allow</b> (traffic inside the same zone) and <b>interzone-default: deny</b>. If nothing matches, a cross-zone flow is dropped.</p>
        `},
        { kind: 'callout', level: 'warn', title: 'App-ID shift is real', body: 'App-ID can only classify once enough bytes are seen. Early in a flow the app is <code>incomplete</code> or <code>not-applicable</code>; once identified, PAN-OS re-evaluates the rulebase. A rule can match on <code>ssl</code> initially and then shift to <code>office365</code> — design with this in mind or traffic can get dropped by a rule further down.' },
        { kind: 'cli', title: 'A good starter rulebase', code: `configure
# Block obvious junk early (optional — keeps logs clean).
set rulebase security rules "00-block-quic" from trust to untrust source any destination any \\
    application quic service any action deny log-setting default

# App-default outbound for approved apps.
set rulebase security rules "10-trust-to-internet" \\
    from trust to untrust source any destination any \\
    application [ web-browsing ssl dns ntp ssh icmp ] \\
    service application-default action allow \\
    profile-setting group "AV+AS+VP+URL+WildFire" \\
    log-setting default log-end yes

# DMZ web servers — inbound.
set rulebase security rules "20-internet-to-dmz-web" \\
    from untrust to dmz source any destination 203.0.113.10 \\
    application [ web-browsing ssl ] service application-default action allow \\
    profile-setting group "Inbound-Strict" log-setting default log-end yes

# Deny-all catch-all with logging (the implicit deny does not log — this does).
set rulebase security rules "99-deny-any-log" \\
    from any to any source any destination any \\
    application any service any action deny log-setting default log-end yes

commit description "Baseline rulebase"`},
        { kind: 'prose', html: `
          <h4>Rule hygiene</h4>
          <p>PAN-OS ships a <b>Policy Optimizer</b> (Objects &gt; Security Policy) that flags:</p>
          <ul>
            <li><b>No App Specified</b> — port-based rules you should migrate to App-ID.</li>
            <li><b>Unused Apps</b> — apps listed in a rule that never hit during the hit-count window.</li>
            <li><b>Unused Rules</b> — rules with zero hits since the last reset.</li>
            <li><b>Shadowed Rules</b> — rules made unreachable by an earlier rule.</li>
          </ul>
          <p>Review it monthly. The rulebase only gets cleaner through attrition, not additions.</p>
        `},
        { kind: 'checklist', title: 'Rulebase best-practice checklist', items: [
          'Rules are named consistently (number-prefix + role + direction)',
          'Every production rule has a <code>Description</code>, an <code>Owner</code> tag, and a <code>Log at session end</code>',
          'No rule uses <code>service any</code> with <code>application any</code> (the "allow-all" anti-pattern)',
          'Service is <code>application-default</code> unless deviation is documented',
          'Every <i>allow</i> rule references a security profile group',
          'An explicit <b>deny-any-any</b> with logging sits at the bottom',
          'Policy Optimizer review is scheduled (monthly minimum)',
          'Rule hit counts are <i>not</i> reset without a recorded reason'
        ]}
      ]
    },

    {
      id: 'nat',
      title: 'NAT Policy',
      icon: '🔁',
      tagline: 'Source NAT, destination NAT, U-turn NAT — and the security policy that must match the pre-NAT fields.',
      sections: [
        { kind: 'prose', html: `
          <p>NAT in PAN-OS is a <b>separate rulebase</b> from security policy — it evaluates <i>before</i> security policy but uses the <b>pre-NAT</b> zone/address to match security rules. That means:</p>
          <ul>
            <li><b>Destination NAT:</b> security policy destination = <i>original</i> public IP, destination zone = <i>post-NAT</i> zone.</li>
            <li><b>Source NAT:</b> security policy matches source as usual; NAT happens after the decision.</li>
          </ul>
          <p>Get this backwards and you get "traffic hits the NAT rule but is dropped by policy" — one of the most common PAN-OS debugging scenarios.</p>
        `},
        { kind: 'diagram', title: 'The inbound DNAT case', ascii: `
  Client 198.51.100.7 ──▶  203.0.113.10:443
                           (public, on untrust zone)

      ┌──── NAT rule (evaluated first) ────┐
      │ from: untrust   to: untrust        │
      │ orig-dst: 203.0.113.10             │
      │ dst-translation: 10.0.0.10         │
      └────────────────────────────────────┘

      ┌──── Security rule (uses PRE-NAT dst IP, POST-NAT dst zone) ────┐
      │ from: untrust   to: dmz                                        │
      │ src: any        dst: 203.0.113.10                              │
      │ app: web-browsing ssl   svc: application-default               │
      │ action: allow + profile group "Inbound-Strict"                 │
      └────────────────────────────────────────────────────────────────┘
` },
        { kind: 'cli', title: 'Typical SNAT + DNAT rules', code: `configure
# Outbound source NAT — dynamic IP and port (hide-NAT).
set rulebase nat rules "sn-trust-to-untrust" \\
    from trust to untrust source any destination any service any \\
    source-translation dynamic-ip-and-port interface-address \\
        interface ethernet1/1

# Inbound destination NAT to a DMZ web server.
set rulebase nat rules "dn-pub-to-web" \\
    from untrust to untrust source any destination 203.0.113.10 service service-https \\
    destination-translation translated-address 10.0.0.10 translated-port 443

# U-turn / hairpin — internal users hit the public IP.
set rulebase nat rules "uturn-trust-to-web" \\
    from trust to untrust source any destination 203.0.113.10 service service-https \\
    source-translation dynamic-ip-and-port interface-address interface ethernet1/2 \\
    destination-translation translated-address 10.0.0.10 translated-port 443

commit description "NAT policy"`},
        { kind: 'callout', level: 'tip', title: 'Test with test nat-policy-match', body: 'Before committing, run <code>test nat-policy-match</code> at the CLI with pre-NAT fields — it tells you which rule would match and what the translation will be. For security, use <code>test security-policy-match</code> with the <b>pre-NAT</b> destination IP but <b>post-NAT</b> destination zone.' },
        { kind: 'table', title: 'Source NAT methods at a glance', headers: ['Method','When to use','Pool required'], rows: [
          ['Dynamic IP and Port (DIPP)','Outbound overload / hide-NAT','No — interface IP reused'],
          ['Dynamic IP','Many-to-many from an IP pool (no port translation)','Yes'],
          ['Static IP','1:1 bidirectional (outbound NAT pair to a DNAT)','No — single mapping'],
          ['None','Explicit "do not NAT" exemption above broader rules','—']
        ]}
      ]
    },

    {
      id: 'app-id',
      title: 'App-ID Deep Dive',
      icon: '🧬',
      tagline: 'Classify what the traffic really is — not what port it uses.',
      sections: [
        { kind: 'prose', html: `
          <p><b>App-ID</b> is Palo Alto's application classification engine. It combines four techniques and picks the most specific one that fits: <b>signatures</b> (first n bytes), <b>protocol decoders</b> (understand SSL, SSH, SIP, etc.), <b>heuristics</b> (p2p, evasive), and <b>application-specific decoders</b> (drill inside a known app, e.g. <code>facebook-chat</code> inside <code>facebook-base</code>).</p>
          <p>App-ID runs <i>continuously</i> — a flow that starts as <code>ssl</code> can become <code>google-drive</code> once the TLS SNI/alpn or early plaintext makes the app clear. PAN-OS re-evaluates the security rulebase whenever App-ID shifts.</p>
        `},
        { kind: 'diagram', title: 'App-ID state transitions in a single flow', ascii: `
    [ new flow ]
         │
         ▼
  ┌──────────────┐    first packet(s)   ┌──────────────┐    bytes = signature/decoder
  │ not-applicable│ ───────────────────▶│  incomplete  │ ─────────────────────────────┐
  └──────────────┘                       └──────────────┘                              │
                                                                                       ▼
                                                                        ┌────────────────────────────┐
                                                                        │   concrete app             │
                                                                        │   (e.g. web-browsing →     │
                                                                        │    office365-base →        │
                                                                        │    ms-teams)               │
                                                                        └────────────────────────────┘
` },
        { kind: 'prose', html: `
          <h4>Dependencies and implicit apps</h4>
          <p>Many apps depend on others. Allowing <code>ms-teams</code> means PAN-OS must let <code>ssl</code>, <code>web-browsing</code>, <code>stun</code>, and <code>ms-teams-audio-video</code> survive long enough to be recognised. The UI shows these in a dependency tree; the CLI shows them with <code>show predefined application &lt;name&gt;</code>.</p>
          <h4>Custom App-ID</h4>
          <p>For homegrown or obscure apps you write a <b>custom application</b> with a signature (string, hex) and a context (http-header, ssl-cn, etc.). Combine with a <b>custom signature</b> to force a specific label, and use an <b>application override</b> rule only if you need to stop App-ID processing entirely (rare — it blinds Content-ID).</p>
        `},
        { kind: 'cli', title: 'Investigating an App-ID miss', code: `# Classic workflow for a misbehaving flow.
> show session all filter source 10.0.1.50 destination 203.0.113.10

> show session id 12345            # find the app, state, bytes
> show counter global filter delta yes | match aged
> show running application-signature registered  # signatures present?

# Force a live capture in the dataplane (careful in prod).
> debug dataplane packet-diag set filter match source 10.0.1.50
> debug dataplane packet-diag set filter on
> debug dataplane packet-diag set capture on
> debug dataplane packet-diag set capture stage receive file rx.pcap
> debug dataplane packet-diag show setting
> debug dataplane packet-diag clear all`},
        { kind: 'callout', level: 'warn', title: 'Do not use application-override casually', body: 'An app-override rule forces a flow to a named app and <b>stops App-ID + Content-ID processing for that flow</b> — no threat, URL, or WildFire inspection. Every override is a visibility hole. Use it only for well-understood custom apps on trusted segments.' }
      ]
    },

    {
      id: 'user-id',
      title: 'User-ID',
      icon: '👤',
      tagline: 'Put names on the IPs — policy by identity, not by address.',
      sections: [
        { kind: 'prose', html: `
          <p><b>User-ID</b> maps an IP to a user, so security rules, logs and reports refer to <code>DOMAIN\\alice</code> instead of <code>10.1.2.34</code>. Multiple mapping methods can feed the same firewall in parallel — PAN-OS keeps a <b>user-to-IP table</b> on the dataplane and a <b>group mapping</b> table refreshed from LDAP/AD.</p>
        `},
        { kind: 'table', title: 'User-ID mapping sources', headers: ['Source','How it works','Best for'], rows: [
          ['PAN-OS integrated agent','PAN-OS directly polls AD security event logs','Simple AD-only environments'],
          ['Windows User-ID agent','Separate service on a Windows host, relays AD events','Large forests, multi-DC'],
          ['GlobalProtect','Mapping on tunnel establishment','Remote users, mobile'],
          ['Captive Portal','Browser redirect for unknown IPs','Kiosks, BYOD, guest-to-corp transition'],
          ['Terminal Services (TS) agent','Per-session source-port ranges','Citrix, RDS, shared Windows hosts'],
          ['XFF headers','Read X-Forwarded-For from proxies','Inside a forward proxy chain'],
          ['Syslog parser / API','Parse third-party logs, push via XML API','DHCP, 802.1X, custom apps']
        ]},
        { kind: 'cli', title: 'Enabling User-ID on a zone and verifying', code: `configure
# Tag the zone as user-ID source.
set zone trust enable-user-identification yes

# LDAP server profile (AD).
set shared server-profile ldap ldap-corp ldap-type active-directory \\
    server dc01 address 10.0.0.10 port 636 \\
    ssl yes base "DC=corp,DC=local" bind-dn "CN=panos-svc,OU=Service Accounts,DC=corp,DC=local" bind-password <pw>

# User-ID agent settings (PAN-OS integrated).
set user-id-agent dc01 host 10.0.0.10 port 5007 collectorname dc01
commit

> show user ip-user-mapping all | count
> show user group list
> show user group name "CN=VPN-Users,OU=Groups,DC=corp,DC=local"
> show user user-id-agent state all
> debug user-id dump-hash`},
        { kind: 'callout', level: 'tip', title: 'Group mapping is cached, not real-time', body: 'PAN-OS refreshes AD group membership on a schedule (default 60 min). Adding a user to a group does not immediately grant access through group-based rules. <code>debug user-id refresh group-mapping all</code> forces a refresh; tune the interval in LDAP server profile if the business needs quicker cuts.' },
        { kind: 'prose', html: `
          <h4>Group-based security policy</h4>
          <p>Once User-ID is working, build security rules with <code>source-user</code> set to an AD group (<code>corp\\VPN-Users</code>). PAN-OS matches against live group membership at the time of flow setup — you do not need to touch the rulebase when membership changes.</p>
        `}
      ]
    },

    {
      id: 'content-id',
      title: 'Content-ID & Threat Prevention',
      icon: '🧪',
      tagline: 'AV, anti-spyware, vulnerability, URL filtering, WildFire, DNS Security, file blocking, data filtering.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Content-ID</b> is the umbrella for payload inspection. It runs in the same single pass as App-ID and User-ID. The moving parts:</p>
          <ul>
            <li><b>Antivirus</b> — signature-based, updated hourly.</li>
            <li><b>Anti-Spyware</b> — C2 detection, DNS sinkholes, drive-bys.</li>
            <li><b>Vulnerability Protection</b> — IPS; CVE signatures (critical/high/medium).</li>
            <li><b>URL Filtering</b> — PAN-DB categories + custom lists.</li>
            <li><b>File Blocking</b> — control by filetype/direction/app (block .hta inbound, warn on .exe).</li>
            <li><b>Data Filtering</b> — simple DLP (credit-card patterns, custom strings).</li>
            <li><b>WildFire</b> — cloud sandbox; verdicts in 5 min, used by AV updates.</li>
            <li><b>DNS Security</b> — realtime malicious-domain scoring.</li>
          </ul>
          <p>You do not apply these directly to a rule — you bundle them in a <b>Security Profile Group</b> and attach the group to every <i>allow</i> rule. This keeps the rulebase readable.</p>
        `},
        { kind: 'cli', title: 'Build a baseline profile group', code: `configure
# Anti-virus: reset-both on everything that is not http/smtp decrypted.
set shared profiles virus "Strict-AV" decoder [ smtp imap pop3 ftp http2 http smb ] action reset-both
# Anti-spyware: block critical, alert low, sinkhole dns.
set shared profiles spyware "Strict-AS" rules critical action reset-both severity critical
set shared profiles spyware "Strict-AS" botnet-domains action sinkhole sinkhole-ipv4 72.5.65.111
# Vulnerability: block critical/high, reset on medium.
set shared profiles vulnerability "Strict-VP" rules r1 action reset-both severity [ critical high ]
# URL Filtering: block known-bad categories.
set shared profiles url-filtering "Strict-URL" block [ command-and-control malware phishing unknown ]
# File blocking: block executables inbound, alert outbound.
set shared profiles file-blocking "Strict-FB" rules block-exe action block file-type [ exe dll bat ] direction download
# WildFire analysis profile.
set shared profiles wildfire-analysis "WF-Inbound" rules all direction both application any file-type any analysis public-cloud

# Group them for easy attachment.
set shared profile-group "Strict" virus "Strict-AV" spyware "Strict-AS" vulnerability "Strict-VP" \\
    url-filtering "Strict-URL" file-blocking "Strict-FB" wildfire-analysis "WF-Inbound"
commit`},
        { kind: 'callout', level: 'tip', title: 'Use the vendor-supplied "Strict" profiles to start', body: 'PAN-OS ships <code>strict</code>, <code>default</code> and <code>alert-only</code> predefined profiles. Start by cloning <code>strict</code>, then relax only the specific signatures that cause false positives — much faster than building from scratch.' },
        { kind: 'prose', html: `
          <h4>DNS Security (licensed feature)</h4>
          <p>PAN-OS DNS Security replaces the older static DNS Signatures with a cloud-scored, dynamic list of malicious domains (DGA, tunneling, adware, grayware, C2). Configure it in the anti-spyware profile under <b>DNS Policies</b>. Pair with <b>DNS sinkhole</b> so clients that attempt to resolve malicious domains hit your sinkhole IP instead of the real one — that identifies the infected endpoint via subsequent flow logs.</p>
        `}
      ]
    },

    {
      id: 'decryption',
      title: 'SSL/TLS Decryption',
      icon: '🔐',
      tagline: 'You can only inspect what you can see — forward proxy, inbound inspection, profiles, certs.',
      sections: [
        { kind: 'prose', html: `
          <p>~95% of internet traffic is TLS. Without decryption, App-ID is limited to SNI/ALPN hints, Content-ID cannot inspect payloads, and WildFire cannot see malicious files. PAN-OS supports three decryption modes:</p>
          <ul>
            <li><b>SSL Forward Proxy</b> — outbound: firewall terminates TLS to the server using a trusted forward-trust cert, re-encrypts to the client using a re-signed cert from your CA.</li>
            <li><b>SSL Inbound Inspection</b> — inbound to your own server: firewall has the server's private key and observes without interception.</li>
            <li><b>SSH Proxy</b> — mitm SSH sessions for SCP/SFTP inspection (rarely deployed).</li>
          </ul>
          <p>The trust model matters: for forward proxy you issue a <b>forward-trust</b> cert (signed by your enterprise CA, installed on endpoints) and a <b>forward-untrust</b> cert (a self-signed fallback so users see a clear error on genuinely untrusted sites instead of a silent MITM).</p>
        `},
        { kind: 'diagram', title: 'SSL forward proxy — what the firewall really does', ascii: `
  Client ──TLS──▶ Firewall ──TLS──▶ Server

  ┌───── client side ─────┐      ┌───── server side ─────┐
  │ Server cert presented │      │ Firewall validates    │
  │ is issued by your CA  │      │ the real server cert  │
  │  (forward-trust or    │      │ and re-signs with     │
  │   forward-untrust)    │      │ forward-trust for the │
  │                       │      │ client.               │
  └───────────────────────┘      └───────────────────────┘
` },
        { kind: 'cli', title: 'A minimal forward proxy setup', code: `configure
# Decryption profile — sensible defaults.
set shared profiles decryption "Outbound-Decrypt" \\
    ssl-forward-proxy block-expired-certificate yes block-untrusted-issuer yes \\
    block-timeout-cert yes block-unknown-cert yes strip-alpn no

# Certificates — forward-trust + forward-untrust on your device.
# (generate/import on Device > Certificates — CLI shown for completeness)
set shared certificate forward-trust common-name "internal-forward-trust" not-valid-after 2035/01/01
set shared certificate forward-untrust common-name "internal-forward-untrust" not-valid-after 2035/01/01

# Decryption rule — decrypt everything outbound except sensitive categories.
set rulebase decryption rules "10-outbound-decrypt" from trust to untrust source any destination any \\
    service any category any type ssl-forward-proxy action decrypt profile "Outbound-Decrypt"

set rulebase decryption rules "20-no-decrypt-finance" from trust to untrust source any destination any \\
    category [ financial-services health-and-medicine government ] action no-decrypt

commit description "Forward proxy baseline"`},
        { kind: 'callout', level: 'warn', title: 'TLS 1.3 + ECH complicates things', body: 'Encrypted Client Hello (ECH) hides SNI. Until PAN-OS supports TLS 1.3 ECH cleanly, flows with ECH cannot be classified beyond <code>tls</code> / <code>ssl</code>. Pin browsers/clients to TLS 1.3 without ECH where policy requires deep inspection, and exclude known-working cloud SaaS from decryption rather than blocking blindly.' },
        { kind: 'checklist', title: 'Pre-deployment checklist', items: [
          'Enterprise CA exists and is trusted by all managed devices',
          '<b>Forward-trust</b> and <b>forward-untrust</b> certs imported on the firewall',
          'Decryption exclusions list reviewed (banking, healthcare, PII, certain OS updaters)',
          'Per-zone decryption profile tuned (min TLS version, block expired/untrusted)',
          'User communication sent (expect TLS error pages for genuinely untrusted sites)',
          'Rollback plan documented (a decryption no-decrypt rule at the top bypasses everything)',
          'Logs monitored for decryption failures for the first 48 hours'
        ]}
      ]
    },

    {
      id: 'globalprotect',
      title: 'GlobalProtect VPN',
      icon: '🛰️',
      tagline: 'Portal + gateway + agent — the remote-access stack.',
      sections: [
        { kind: 'prose', html: `
          <p>GlobalProtect (GP) is PAN-OS's remote-access and network-enforcement VPN. Three components co-operate:</p>
          <ul>
            <li><b>Portal</b> — HTTPS page the agent first contacts. Returns a list of gateways + client config + certificates.</li>
            <li><b>Gateway</b> — the actual IPSec/SSL tunnel terminator. One or many per portal.</li>
            <li><b>Agent</b> — client software (Windows, macOS, Linux, iOS, Android, ChromeOS). Also "clientless" browser portal for lightweight web-only access.</li>
          </ul>
          <p>User-ID, HIP checks, and always-on settings all ride GP. Licenses gate some features: basic GP is free, but HIP, clientless, and IPv6 need the GlobalProtect subscription.</p>
        `},
        { kind: 'diagram', title: 'GP flow from client to inside corp', ascii: `
  Laptop agent
      │  1) TCP 443 to Portal:     fetch config + cert
      ▼
  ┌────────────────┐
  │    Portal      │
  │ (firewall :443)│
  └────────┬───────┘
           │  2) Agent picks best Gateway by priority
           ▼
   ┌────────────────┐      3) IKE+ESP (UDP 4501/500) or SSL-fallback
   │    Gateway     │◀────────────────────────────────────────── Agent
   │ (same firewall │
   │  or different) │      4) Routes/DNS/search/split-tunnel pushed
   └────────┬───────┘
            │
            ▼  5) User-ID mapping learned; inside-corp traffic per security policy
    Corp internal
` },
        { kind: 'cli', title: 'Portal + gateway bootstrap', code: `configure
# Cert the portal/gateway serves (usually public CA or internal PKI).
# Imported on Device > Certificates.
# SSL/TLS service profile referenced below.
set shared ssl-tls-service-profile "gp-tls" certificate "gp-public-cert" protocol-settings min-version tls1-2 max-version tls1-3

# Portal.
set network global-protect global-protect-portal "gp-portal" portal-config local-address 203.0.113.10 \\
    ssl-tls-service-profile "gp-tls" authentication-profile "gp-auth"
set network global-protect global-protect-portal "gp-portal" client-config agent-config config "default" \\
    gateways external list "gw-london" gw-london fqdn gw-london.example.com priority 1

# Gateway (most installs: same firewall as portal).
set network global-protect global-protect-gateway "gw-london" local-address 203.0.113.10 \\
    ssl-tls-service-profile "gp-tls" authentication-profile "gp-auth"
set network global-protect global-protect-gateway "gw-london" remote-user-tunnel-configs "default" \\
    source-user any ip-pool 10.200.0.0/16 split-tunnel-access-route 10.0.0.0/8

commit`},
        { kind: 'callout', level: 'tip', title: 'Use HIP checks to enforce posture', body: 'Host Information Profile (HIP) lets you gate access on client state: disk encryption, AV running, patch level, domain membership. Start with <i>HIP match = alert</i> to build your profile, then move to <i>deny</i> for non-compliant posture — avoids locking out users during rollout.' },
        { kind: 'cli', title: 'Common GP debugging commands', code: `> show global-protect-gateway current-user
> show global-protect-gateway statistics
> show global-protect-portal current-satellite
> debug global-protect-gateway enable mp-log-level debug
> less mp-log gp-service.log
> less dp-log globalprotect.log
> show user ip-user-mapping type GP
> test vpn ike-sa
> test vpn ipsec-sa`}
      ]
    },

    {
      id: 'ipsec',
      title: 'IPsec Site-to-Site VPN',
      icon: '🛤️',
      tagline: 'Route-based IPsec done right — IKE gateway, crypto profiles, tunnel interface, monitor.',
      sections: [
        { kind: 'prose', html: `
          <p>PAN-OS is a <b>route-based</b> IPsec implementation. You bind a <b>tunnel interface</b> to a <b>virtual router</b> and a <b>zone</b>, set up the IKE gateway and crypto profiles, then tell routing to use the tunnel (static or dynamic). Unlike policy-based IPsec you do not configure traffic selectors beyond optional proxy-IDs for interop.</p>
        `},
        { kind: 'diagram', title: 'Route-based IPsec layers', ascii: `
  ┌───── tunnel.1 (L3, in zone "vpn", VR "default") ─────┐
  │                                                       │
  │                 IPsec SA (ESP)                        │
  │                        │                              │
  │                 IKE SA (IKEv2 UDP 500/4500)           │
  │                        │                              │
  │  untrust ────── peer IP ────── remote untrust         │
  └───────────────────────────────────────────────────────┘
     ▲                                                    ▲
     │ routing: "dest 10.99.0.0/16 via tunnel.1"          │
` },
        { kind: 'cli', title: 'A minimal IKEv2 site-to-site VPN', code: `configure
# IKE (phase 1) profile.
set network ike crypto-profiles ike-crypto-profiles "ike-p1-strong" \\
    encryption aes-256-gcm hash sha256 dh-group group20 lifetime hours 24

# IPsec (phase 2) profile.
set network ike crypto-profiles ipsec-crypto-profiles "ipsec-p2-strong" esp \\
    encryption aes-256-gcm authentication sha256 dh-group group20 lifetime hours 1

# IKE gateway (the peer).
set network ike gateway "to-remote-site" protocol version ikev2 \\
    local-address interface ethernet1/1 local-ip ip 203.0.113.1/30 \\
    peer-address ip 198.51.100.1 \\
    authentication pre-shared-key key <strong-psk> \\
    protocol ikev2 ike-crypto-profile "ike-p1-strong"

# Tunnel interface — zone + VR binding.
set network interface tunnel units tunnel.1 ip 10.255.255.1/30
set zone vpn network layer3 tunnel.1
set network virtual-router default interface tunnel.1

# IPsec tunnel — glue it all together.
set network tunnel ipsec "vpn-to-remote" auto-key ike-gateway "to-remote-site" \\
    ipsec-crypto-profile "ipsec-p2-strong"
set network tunnel ipsec "vpn-to-remote" tunnel-interface tunnel.1

# Route remote subnet down the tunnel.
set network virtual-router default routing-table ip static-route "to-remote-10.99" \\
    destination 10.99.0.0/16 interface tunnel.1 nexthop discard

# Tunnel monitor — bring tunnel down on path loss.
set network tunnel ipsec "vpn-to-remote" tunnel-monitor destination-ip 10.99.0.1 \\
    tunnel-monitor-profile default
commit`},
        { kind: 'callout', level: 'warn', title: 'Proxy-IDs only when the peer demands them', body: 'Route-based IPsec does not need proxy-IDs. But many vendor-B peers (Cisco ASA in policy-based mode, older Fortigate, Sophos) insist on them. If the tunnel negotiates IKE but never establishes IPsec SAs, add proxy-IDs matching both sides exactly and retry — mismatched proxy-IDs is the #1 site-to-site failure.' },
        { kind: 'cli', title: 'Troubleshooting', code: `> test vpn ike-sa gateway "to-remote-site"
> test vpn ipsec-sa tunnel "vpn-to-remote"
> show vpn ike-sa gateway "to-remote-site"
> show vpn ipsec-sa tunnel "vpn-to-remote"
> less mp-log ikemgr.log
> less mp-log ipsecmgr.log
> show vpn flow tunnel-id <id>
> show vpn tunnel name "vpn-to-remote"`}
      ]
    },

    {
      id: 'ha',
      title: 'High Availability',
      icon: '🧬',
      tagline: 'Active/Passive, Active/Active, HA1/HA2/HA3 — and the failure scenarios you must test.',
      sections: [
        { kind: 'prose', html: `
          <p>PAN-OS HA pairs two identical firewalls (same model, same PAN-OS version, same licenses). Two modes:</p>
          <ul>
            <li><b>Active/Passive</b> — one firewall owns all traffic; the other is hot-standby. Simplest, most common. Failover &lt; 1s.</li>
            <li><b>Active/Active</b> — both firewalls forward traffic simultaneously. Needs Active/Active-specific session ownership logic. Used when flows must survive a single-box failure without session drop <i>and</i> you have asymmetric routing constraints.</li>
          </ul>
          <p>Three HA links connect the pair:</p>
          <ul>
            <li><b>HA1</b> — control plane (config sync, heartbeats). TCP 28260 encrypted or TCP 28769 clear.</li>
            <li><b>HA2</b> — data plane (session sync). Ethertype 0x7261 or IP protocol 99.</li>
            <li><b>HA3</b> — Active/Active only; packet-forwarding between peers.</li>
          </ul>
        `},
        { kind: 'diagram', title: 'A/P HA with redundant HA1', ascii: `
   ┌──────────┐       HA1 (ctrl, primary)        ┌──────────┐
   │   FW-A   │──────── 169.254.1.1 ─────────────│   FW-B   │
   │ (active) │                                   │(passive) │
   │          │──────── HA1 backup ───────────────│          │
   │          │                                   │          │
   │          │═════════ HA2 (session sync) ═════│          │
   └──────────┘                                   └──────────┘
        │                                               │
   untrust───── shared data VLAN ────── trust
` },
        { kind: 'cli', title: 'Minimal A/P HA config', code: `configure
# HA mode and group.
set deviceconfig high-availability enabled yes group group-id 1 mode active-passive
set deviceconfig high-availability group peer-ip 10.250.250.2
set deviceconfig high-availability group passive-link-state shutdown

# HA1 link (dedicated port HA1).
set deviceconfig high-availability interface ha1 ip-address 10.250.250.1 netmask 255.255.255.0
set deviceconfig high-availability interface ha1 port ha1-a
set deviceconfig high-availability interface ha1-backup ip-address 10.250.251.1 netmask 255.255.255.0 port ethernet1/8

# HA2 link (session sync).
set deviceconfig high-availability interface ha2 port ha2-a

# Link monitoring — failover if untrust/trust interface dies.
set deviceconfig high-availability group monitoring link-monitoring failure-condition any
set deviceconfig high-availability group monitoring link-monitoring link-group "edge" \\
    failure-condition any interface [ ethernet1/1 ethernet1/2 ae1 ]

# Path monitoring — failover if upstream gateway is unreachable.
set deviceconfig high-availability group monitoring path-monitoring path-group virtual-router \\
    default ping-path "upstream" destination-ip 203.0.113.1 failure-condition all

commit`},
        { kind: 'callout', level: 'warn', title: 'Preemption is off by default — and usually should stay off', body: 'If you enable preemption the "primary" firewall forcefully reclaims active role when it comes back up. That causes unnecessary failovers after a maintenance reboot. Leave <code>preemptive no</code> unless you have a specific reason (shared policy on one device only, for example).' },
        { kind: 'checklist', title: 'HA validation checklist', items: [
          'Both firewalls on identical PAN-OS + identical content version',
          '<code>show high-availability state</code> shows <b>peer Active / local Passive</b>',
          'HA1 and HA1-backup both up',
          'HA2 session sync enabled and count matches <code>show session info</code>',
          'Link monitor on every production edge interface',
          'Path monitor on upstream gateway with failure-condition set',
          '<b>Failover tested</b> by <code>request high-availability state suspend</code> and restored with resume',
          'Pre-upgrade: review <i>HA upgrade flow</i> and confirm no config commits in flight']
        }
      ]
    },

    {
      id: 'panorama',
      title: 'Panorama Central Management',
      icon: '🖥️',
      tagline: 'Device groups, templates, template stacks, logging — manage 2 to 2000 firewalls from one pane.',
      sections: [
        { kind: 'prose', html: `
          <p><b>Panorama</b> is the management platform: policy authoring, template-driven network config, log collection, reporting, rollbacks. It is available as an M-series appliance (M-200, M-600, M-700) or a virtual appliance in AWS/Azure/GCP/VMware. Same PAN-OS codebase, different mode.</p>
          <p>Panorama uses two hierarchies:</p>
          <ul>
            <li><b>Device Groups</b> — hold <b>policy</b> and <b>objects</b>. Nested (e.g. <code>Global → EMEA → London</code>). Policy is pre-rules (top), device-local rules (middle), post-rules (bottom) — pre/post come from Panorama; local comes from the firewall.</li>
            <li><b>Templates</b> and <b>Template Stacks</b> — hold <b>network</b> and <b>device</b> config (interfaces, zones, routing, auth, syslog, HA). Stacks combine multiple templates in a precedence order.</li>
          </ul>
        `},
        { kind: 'diagram', title: 'Panorama hierarchy', ascii: `
  ┌──────────── Global device group ────────────┐
  │                                              │
  │   pre-rules:    universal allow DNS/NTP      │
  │   post-rules:   explicit deny-any-log        │
  │                                              │
  │   ┌──── EMEA DG (child) ────┐                │
  │   │  pre-rules: regional    │                │
  │   │   ┌── London (leaf) ──┐ │                │
  │   │   │ pre-rules: local  │ │                │
  │   │   └───────────────────┘ │                │
  │   └─────────────────────────┘                │
  └──────────────────────────────────────────────┘

  ┌──────── Template stack "UK-Edge" ────────┐
  │   - Template "UK-base"    (higher prec)  │
  │   - Template "Global-ntp" (lower prec)   │
  └──────────────────────────────────────────┘
` },
        { kind: 'callout', level: 'tip', title: 'Commit scope hygiene', body: 'When you push from Panorama, limit the <b>commit scope</b> to the device groups/templates you actually changed. Full pushes on a large Panorama take minutes and inflate the risk blast radius of an accidental change. Use the "preview changes" link before every push — it shows the XML diff per device.' },
        { kind: 'prose', html: `
          <h4>Log Collectors</h4>
          <p>A Panorama in <b>mixed-mode</b> can also collect logs from firewalls directly. For more than ~100 firewalls or sustained &gt; 10k log/s, deploy dedicated <b>Log Collectors</b> (M-series in log-collector mode, or virtual) — they form a Log Collector Group that Panorama queries for historical reports. Firewalls forward to the group; Panorama does the heavy lifting on UI queries.</p>
        `},
        { kind: 'cli', title: 'Panorama essentials from the CLI', code: `# On Panorama
> show panorama status
> show devicegroups
> show templates
> show log traffic device-group equal "London" query "(severity eq critical)"
> request batch policy device-group "London" pre-rulebase
> commit-all shared-policy device-group "London" include-template yes validate-only yes`}
      ]
    },

    {
      id: 'logging-monitoring',
      title: 'Logging, Monitoring & ACC',
      icon: '📊',
      tagline: 'Log types, forwarding, ACC dashboard, custom reports, session browser.',
      sections: [
        { kind: 'prose', html: `
          <p>PAN-OS generates eleven log types. The most important for day-to-day work:</p>
          <ul>
            <li><b>Traffic</b> — one entry per session (start/end depending on rule).</li>
            <li><b>Threat</b> — AV, spyware, vuln, URL, DNS, WF matches.</li>
            <li><b>URL Filtering</b> — category hits if URL log-at-session-end is on.</li>
            <li><b>WildFire Submissions</b> — sample verdicts (benign/grayware/malware).</li>
            <li><b>GlobalProtect</b> — portal/gateway events, HIP match.</li>
            <li><b>System</b> — HA events, dynamic updates, admin auth, hardware.</li>
            <li><b>Config</b> — who committed what, with diff.</li>
            <li><b>Authentication</b> — captive portal, admin auth to the firewall.</li>
          </ul>
        `},
        { kind: 'callout', level: 'tip', title: 'Log at session end, not at session start', body: 'Logging at session start generates two entries per flow and saturates log forwarding in busy environments. Use <b>log at session end</b> on allow rules, <b>both</b> on deny rules you are investigating, and drop start logging entirely on the deny-any catch-all.' },
        { kind: 'cli', title: 'Log forwarding profile to syslog + Panorama', code: `configure
# Server profile for SIEM.
set shared log-settings syslog "siem-splunk" server splunk-ha transport TCP port 514 format BSD \\
    server splunk-ha server splunk-a.corp.local
# Log forwarding profile — attach to rules.
set shared log-settings profiles "LF-Strict" match-list "all-traffic" log-type traffic \\
    send-syslog "siem-splunk" send-panorama yes
set shared log-settings profiles "LF-Strict" match-list "threats" log-type threat \\
    send-syslog "siem-splunk" send-panorama yes

# Attach to a rule (sample).
set rulebase security rules "10-trust-to-internet" log-setting "LF-Strict"
commit`},
        { kind: 'prose', html: `
          <h4>Application Command Centre (ACC)</h4>
          <p>ACC is the live dashboard: top applications, top users, top threats, top URL categories — sliced by time range (last 15 min up to 30 days) and filterable by zone/device group. Build <b>custom ACC widgets</b> for VIP dashboards; export PDFs for weekly ops reviews. Data comes from logs, so ACC accuracy depends on your log-forwarding config.</p>
        `}
      ]
    },

    {
      id: 'upgrades',
      title: 'PAN-OS Upgrades & Maintenance',
      icon: '⬆️',
      tagline: 'Release trains, content compatibility, HA upgrade flow, rollback strategy.',
      sections: [
        { kind: 'prose', html: `
          <p>PAN-OS releases follow a train model: <b>feature release</b> (e.g. 11.1), followed by <b>maintenance releases</b> (11.1.1, 11.1.2…). Every major release has a <b>Preferred</b> and a <b>Base</b> version — Palo Alto publishes the recommended maintenance level on Live Community. Always jump to the currently-Preferred minor on a given train, not the most-recent beta.</p>
          <p>Content packs (Applications and Threats) have their own versioning and their own compatibility window. Never push a content pack older than <b>two versions behind</b> on a PAN-OS running a given major. Check the compatibility matrix before upgrading either.</p>
        `},
        { kind: 'diagram', title: 'Standard HA upgrade flow (A/P)', ascii: `
  step 1:  both on 11.0.3
  step 2:  disable preempt + suspend sync on active
  step 3:  upgrade PASSIVE  11.0.3 → 11.1.2
  step 4:  wait for passive to rejoin HA (state: non-functional → passive)
  step 5:  failover — suspend ACTIVE, passive becomes active
  step 6:  upgrade former ACTIVE  11.0.3 → 11.1.2
  step 7:  when both on 11.1.2 and HA sync is green → re-enable preempt (if used)
  step 8:  smoke test: auth, policy match, decryption, VPN
` },
        { kind: 'checklist', title: 'Pre-upgrade gate checklist', items: [
          'Current PAN-OS + target PAN-OS supported on your hardware (check release notes)',
          'Panorama PAN-OS ≥ managed firewall PAN-OS (Panorama must never be older)',
          'Content pack on both firewalls is the Preferred version for the TARGET PAN-OS',
          'No uncommitted candidate config',
          'Running config exported and stored off-box',
          'HA health: <code>show high-availability state</code> returns <b>active / passive</b> with no issues',
          'Maintenance window announced; rollback path documented',
          'Upgrade to one model at a time in large estates — do not mass-push via Panorama'
        ]},
        { kind: 'callout', level: 'warn', title: 'Downgrades are not always possible', body: 'Once a PAN-OS upgrade runs its migration scripts, rolling <i>back</i> often requires a factory reset + config import (which itself may fail if the config file references features the older version does not know about). Treat upgrades as one-way. Test on a lab/virtual pair first.' }
      ]
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting Toolkit',
      icon: '🩺',
      tagline: 'The CLI commands you reach for under pressure — sessions, policy match, packet-diag, counters.',
      sections: [
        { kind: 'prose', html: `
          <p>When a flow fails, PAN-OS has a short list of tools that answer &gt; 90% of questions. Memorise them:</p>
          <ul>
            <li><code>show session all filter</code> — is the flow present? Which rule? Which app?</li>
            <li><code>test security-policy-match</code> / <code>test nat-policy-match</code> — would it match? Which rule? (no traffic needed)</li>
            <li><code>show counter global filter delta yes</code> — what is being dropped and why?</li>
            <li><code>debug dataplane packet-diag</code> — live capture at each stage (receive, firewall, transmit, drop).</li>
            <li><code>less mp-log</code> / <code>less dp-log</code> — raw daemon logs for specific features.</li>
          </ul>
        `},
        { kind: 'cli', title: 'The triage sequence', code: `# 1. Is the session there?
> show session all filter source 10.0.1.50 destination 203.0.113.10 application any
> show session id <id>

# 2. What rule would match (no traffic needed)?
> test security-policy-match source 10.0.1.50 destination 203.0.113.10 \\
    application ssl protocol 6 destination-port 443 source-user "corp\\\\alice" \\
    from trust to untrust

# 3. What NAT would apply?
> test nat-policy-match source 10.0.1.50 destination 203.0.113.10 \\
    protocol 6 destination-port 443 from trust to untrust

# 4. What counters are moving (and why)?
> show counter global filter delta yes severity drop
> show counter global filter delta yes aspect session

# 5. Live packet capture (careful — targeted filter!).
> debug dataplane packet-diag set filter index 1 match source 10.0.1.50 destination 203.0.113.10
> debug dataplane packet-diag set filter on
> debug dataplane packet-diag set capture stage receive  file rx.pcap
> debug dataplane packet-diag set capture stage transmit file tx.pcap
> debug dataplane packet-diag set capture stage drop     file drop.pcap
> debug dataplane packet-diag set capture on

# ... reproduce the issue ...

> debug dataplane packet-diag set capture off
> debug dataplane packet-diag set filter off
> debug dataplane packet-diag clear all
> view-pcap filter "host 10.0.1.50" mine-only yes pcap-type filter`},
        { kind: 'table', title: 'Common counters and what they mean', headers: ['Counter','Where you see it','What to check'], rows: [
          ['flow_policy_deny','show counter global','Security policy denies — match by rule'],
          ['flow_fwd_l3_ttl_zero','show counter global','Routing loop / broken path'],
          ['flow_tcp_non_syn','show counter global','Asymmetric TCP; check routing/HA symmetry'],
          ['flow_host_limit','show counter global','dataplane session-limit for a single IP'],
          ['session aged out','show session all','App-ID could not finish; check decryption'],
          ['appid_total_re-scan','show counter global','Heavy App-ID shifts — review rules'],
          ['ssl_policy_no_decrypt','show counter global','Decrypt profile excluded the flow']
        ]},
        { kind: 'callout', level: 'tip', title: 'Always clear packet-diag', body: 'Leaving <code>debug dataplane packet-diag</code> enabled in production quietly burns dataplane CPU and fills PCAP files until the disk is full. Clear it with <code>debug dataplane packet-diag clear all</code> when you finish. Put a reminder on your triage template.' }
      ]
    }
  ]
};
