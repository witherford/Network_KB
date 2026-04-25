// Cisco ASA / FTD learning centre.
export const CURRICULUM = {
  id: 'asa-ftd',
  title: 'Cisco ASA / FTD',
  tagline: 'Stateful firewalls — interfaces, ACLs, NAT, IKEv2 + AnyConnect, packet-tracer, FTD migration.',
  estimatedMinutes: 260,
  modules: [
    {
      id: 'overview',
      icon: '🛡️',
      title: 'ASA vs FTD — What You\'re Actually Running',
      tagline: 'Two firewall OSes on the same hardware; very different operating models.',
      sections: [
        { kind: 'prose', html: `<p><b>ASA (Adaptive Security Appliance)</b> is the classic Cisco firewall OS — CLI-driven, stateful with deep VPN heritage. <b>FTD (Firepower Threat Defense)</b> is the next-gen replacement built on Snort and managed centrally by FMC (Firepower/FirePOWER Management Center) or FDM (the on-box GUI).</p><p>Same hardware (4100/9300/1000/3100 series) can run either image — but the configuration models, troubleshooting tools, and feature sets differ significantly. Most enterprises today are mid-migration: ASA in production, FTD landing in greenfield.</p>` },
        { kind: 'table', title: 'ASA vs FTD at a glance',
          headers: ['Aspect', 'ASA', 'FTD'],
          rows: [
            ['Management', 'CLI + ASDM', 'FMC (centralised), FDM (on-box), CDO'],
            ['Policy model', 'Numbered ACLs + service-policy', 'Access Control Policy with rule sections + Snort'],
            ['VPN', 'Mature, full-featured (S2S + RA)', 'Catching up, RA via AnyConnect/Secure Client'],
            ['IPS / NGFW', 'Add-on / limited', 'Native Snort 3, AMP, URL filtering, SSL decrypt'],
            ['Troubleshooting', 'packet-tracer + capture', 'system support trace + capture + FMC diagnostics'],
            ['Configuration storage', 'Running/startup config text', 'Database; "deploy" pushes from FMC']
          ]
        },
        { kind: 'callout', level: 'tip', title: 'Pick the right show command',
          body: `Most ASA show commands work on FTD via "system support diagnostic-cli" — drops you into an ASA-style EXEC mode for troubleshooting. Don't try to configure that way; FTD will overwrite on the next deploy.` }
      ]
    },
    {
      id: 'interfaces',
      icon: '🔌',
      title: 'Interfaces & Security Levels',
      tagline: 'nameif, security-level, the inside/outside contract.',
      sections: [
        { kind: 'prose', html: `<p>Every ASA interface has a <b>nameif</b> (logical name like "outside" or "dmz"), a <b>security-level</b> (0–100), and an IP. The classic rule: traffic from a higher security-level to a lower one is allowed by default; the reverse needs an ACL. FTD throws this model out — every flow is matched against the Access Control Policy regardless of security level.</p>` },
        { kind: 'cli', title: 'ASA — interface basics',
          code: `interface GigabitEthernet0/0
 nameif outside
 security-level 0
 ip address 198.51.100.2 255.255.255.0
 no shutdown

interface GigabitEthernet0/1
 nameif inside
 security-level 100
 ip address 10.1.1.1 255.255.255.0
 no shutdown

interface GigabitEthernet0/2
 nameif dmz
 security-level 50
 ip address 192.0.2.1 255.255.255.0
 no shutdown

! Verify
show interface ip brief
show running-config interface
show nameif`,
          desc: 'Lower = less trusted. 0 is outside/Internet, 100 is your most-trusted inside. DMZ traditionally lands at 50.' },
        { kind: 'cli', title: 'FTD — interfaces are configured in FMC',
          code: `! On the FTD CLI you can only inspect — not configure
> show interface ip brief
> show interface
> system support diagnostic-cli
asa# show running-config interface

! All interface config lives in FMC: Devices → Device Management → Interfaces`
        }
      ]
    },
    {
      id: 'access-control',
      icon: '📜',
      title: 'Access Control — ACLs & ACPs',
      tagline: 'ASA extended ACLs vs FTD Access Control Policy.',
      sections: [
        { kind: 'prose', html: `<p>On ASA you build named ACLs and apply them inbound on an interface with <code>access-group</code>. The order matters — first match wins. On FTD, FMC compiles the Access Control Policy (with prefilter, security-intelligence, ACP rules, intrusion policy, file policy) into a Snort ruleset; the model is rule-section-first then top-down.</p>` },
        { kind: 'cli', title: 'ASA — extended ACL with object-groups',
          code: `! Object-groups for readability
object-group network INSIDE_SUBNETS
 network-object 10.1.0.0 255.255.0.0
 network-object 10.2.0.0 255.255.0.0

object-group service WEB_SERVICES tcp
 port-object eq 80
 port-object eq 443

object network WEB_SERVERS
 subnet 192.0.2.0 255.255.255.0

! ACL — top-down, first match
access-list OUTSIDE_IN extended permit tcp any object-group WEB_SERVERS object-group WEB_SERVICES
access-list OUTSIDE_IN extended deny ip any any log

access-group OUTSIDE_IN in interface outside

! Verify hits + order
show access-list OUTSIDE_IN
show running-config access-list OUTSIDE_IN`,
          desc: 'Always end with explicit "deny ip any any log" so you can see what was blocked. The implicit deny is silent.' },
        { kind: 'cli', title: 'FTD — see the compiled Snort/lina ACL',
          code: `> show access-list                          ! lina view (post-compile)
> system support trace                       ! per-packet decision walkthrough
> system support firewall-engine-debug       ! per-flow ACP decision`,
          desc: 'system support firewall-engine-debug is the FTD equivalent of "show why was this blocked" — filter by source IP/protocol when you start it.' }
      ]
    },
    {
      id: 'nat',
      icon: '🔁',
      title: 'NAT — Auto vs Manual, Twice NAT',
      tagline: 'Object NAT (auto), twice NAT (manual), order of operations.',
      sections: [
        { kind: 'prose', html: `<p>ASA/FTD splits NAT into two flavours. <b>Object NAT</b> ("auto NAT") is one-line, defined inside a network object — the firewall picks the order. <b>Twice NAT</b> ("manual NAT") explicitly orders rules and lets you match both source and destination.</p><p>Order of operations: <i>section 1</i> manual NAT (top-down) → <i>section 2</i> auto NAT (most-specific first) → <i>section 3</i> manual NAT after-auto.</p>` },
        { kind: 'cli', title: 'ASA — common NAT patterns',
          code: `! 1. PAT inside hosts to the outside interface
object network INSIDE_NAT
 subnet 10.1.0.0 255.255.0.0
 nat (inside,outside) dynamic interface

! 2. Static one-to-one NAT for a public web server
object network WEB1_REAL
 host 10.1.1.10
object network WEB1_PUBLIC
 host 198.51.100.10
object network WEB1_REAL
 nat (inside,outside) static WEB1_PUBLIC

! 3. Twice NAT — translate only when going to a specific destination
nat (inside,outside) source static INSIDE INSIDE destination static REMOTE_NET REMOTE_NET no-proxy-arp route-lookup
! "identity NAT" — preserve original IP across a tunnel; common for VPN

! Verify
show nat
show xlate
show nat detail`,
          desc: '"no-proxy-arp" suppresses gratuitous ARPs the firewall would otherwise generate for the translated address. Almost always needed on identity NAT for VPNs.' },
        { kind: 'callout', level: 'warn', title: 'Most common NAT mistake',
          body: 'Identity NAT for VPN traffic without "route-lookup" — the firewall short-circuits the routing table and tries to send traffic out the wrong interface. Always add route-lookup on identity NAT used with site-to-site VPNs.' }
      ]
    },
    {
      id: 'routing',
      icon: '🧭',
      title: 'Routing on the Firewall',
      tagline: 'Static, OSPF, BGP, route-leak, ECMP limitations.',
      sections: [
        { kind: 'prose', html: `<p>ASA/FTD support OSPF (v2 + v3), EIGRP (ASA), and BGP. Routing is per <b>VRF</b> (called "context" on ASA, "virtual router" on FTD/FMC 6.6+). ECMP is supported but limited — historically 3-path; modern code 8-path.</p>` },
        { kind: 'cli', title: 'ASA — static + OSPF + BGP',
          code: `! Static
route outside 0.0.0.0 0.0.0.0 198.51.100.1 1 track 1
sla monitor 1
 type echo protocol ipIcmpEcho 8.8.8.8 interface outside
sla monitor schedule 1 life forever start-time now
track 1 rtr 1 reachability

! OSPF — process 1, area 0
router ospf 1
 router-id 1.1.1.1
 network 10.1.1.0 255.255.255.0 area 0
 log-adj-changes detail
 redistribute static subnets

! BGP
router bgp 65001
 bgp router-id 1.1.1.1
 address-family ipv4 unicast
  neighbor 198.51.100.1 remote-as 65000
  neighbor 198.51.100.1 activate
  network 203.0.113.0 mask 255.255.255.0`,
          desc: 'Track an SLA on the default route so the firewall fails over to a secondary path when the primary drops Internet reachability — the firewall would happily black-hole otherwise.' }
      ]
    },
    {
      id: 'vpn-s2s',
      icon: '🔗',
      title: 'Site-to-Site VPN (IKEv2)',
      tagline: 'IKEv2 proposals, crypto map vs VTI, troubleshooting.',
      sections: [
        { kind: 'prose', html: `<p>Modern S2S VPN should be <b>IKEv2</b> — IKEv1 is deprecated. Two encapsulation styles: <b>policy-based (crypto map)</b> — older, matches a crypto ACL — and <b>route-based (VTI)</b> — modern, behaves like a routed interface so OSPF/BGP can run over it.</p>` },
        { kind: 'cli', title: 'ASA — IKEv2 with VTI (route-based)',
          code: `! IKEv2 proposal + policy
crypto ikev2 policy 10
 encryption aes-gcm-256
 integrity null
 group 19 20
 prf sha256
 lifetime seconds 86400

crypto ikev2 enable outside

! IPsec proposal
crypto ipsec ikev2 ipsec-proposal AES256GCM
 protocol esp encryption aes-gcm-256
 protocol esp integrity null

! Tunnel-group + PSK
tunnel-group 198.51.100.50 type ipsec-l2l
tunnel-group 198.51.100.50 ipsec-attributes
 ikev2 remote-authentication pre-shared-key cisco123
 ikev2 local-authentication pre-shared-key cisco123

! IPsec profile + VTI
crypto ipsec profile P1
 set ikev2 ipsec-proposal AES256GCM
 set pfs group19

interface Tunnel1
 nameif vpn-to-branch
 ip address 169.254.1.1 255.255.255.252
 tunnel source interface outside
 tunnel destination 198.51.100.50
 tunnel mode ipsec ipv4
 tunnel protection ipsec profile P1

! Routing over the tunnel
route vpn-to-branch 10.50.0.0 255.255.0.0 169.254.1.2`,
          desc: 'Route-based (VTI) is far easier to operate at scale — change subnets without touching the crypto config, run routing protocols across the tunnel.' },
        { kind: 'cli', title: 'Verification & troubleshooting',
          code: `show crypto ikev2 sa detail
show crypto ipsec sa
show vpn-sessiondb l2l

debug crypto ikev2 protocol 64
debug crypto ikev2 platform 64
debug crypto ipsec 64

! On FTD
> system support diagnostic-cli
asa# debug crypto ikev2 protocol 5`,
          desc: 'IKEv2 SAs above the IPsec SA. If IKEv2 is up but no IPsec — proposal mismatch on transform. If IKEv2 never forms — proposal/policy mismatch or PSK wrong. The "show crypto ikev2 sa" output gives you the negotiation outcome.' }
      ]
    },
    {
      id: 'vpn-ra',
      icon: '🚪',
      title: 'Remote-Access VPN (Cisco Secure Client / AnyConnect)',
      tagline: 'Group-policies, tunnel-group, profiles, certificate auth.',
      sections: [
        { kind: 'prose', html: `<p>Remote access on ASA/FTD = <b>Cisco Secure Client</b> (the rebrand of AnyConnect). Three building blocks: <b>group-policy</b> (permissions, split-tunnel, DNS), <b>tunnel-group</b> (auth method, address pool, banner), and <b>connection profile</b> (what users see when they connect).</p>` },
        { kind: 'cli', title: 'ASA — RA VPN with cert + AAA',
          code: `! Address pool
ip local pool VPN_POOL 10.99.0.10-10.99.0.250 mask 255.255.255.0

! Group policy
group-policy GP-ENG internal
group-policy GP-ENG attributes
 vpn-tunnel-protocol ssl-client ikev2
 split-tunnel-policy tunnelspecified
 split-tunnel-network-list value SPLIT_TUNNEL_ACL
 dns-server value 10.10.0.10 10.10.0.11
 default-domain value corp.example.com
 split-dns value corp.example.com

! AAA — cert + RADIUS for second factor
aaa-server RADIUS-MFA protocol radius
aaa-server RADIUS-MFA (inside) host 10.10.0.50
 key cisco-shared

! Tunnel-group / connection profile
tunnel-group ENGINEERING type remote-access
tunnel-group ENGINEERING general-attributes
 address-pool VPN_POOL
 default-group-policy GP-ENG
 authentication-server-group RADIUS-MFA
tunnel-group ENGINEERING webvpn-attributes
 group-alias ENGINEERING enable
 authentication aaa certificate

! Enable Secure Client on outside
webvpn
 enable outside
 anyconnect enable
 anyconnect image disk0:/cisco-secure-client-win.pkg 1
 tunnel-group-list enable

! User-side profile (XML) referenced by group-policy
group-policy GP-ENG attributes
 webvpn
  anyconnect profiles value ENG_PROFILE.xml type user`,
          desc: 'Pair certificate authentication (proves the device) with RADIUS-driven MFA (proves the user). split-tunnel-policy tunnelspecified plus a tightly-scoped ACL is the modern hybrid-work default.' },
        { kind: 'cli', title: 'Inspect & terminate sessions',
          code: `show vpn-sessiondb anyconnect
show vpn-sessiondb anyconnect filter name jdoe
vpn-sessiondb logoff name jdoe`
        }
      ]
    },
    {
      id: 'identity',
      icon: '🪪',
      title: 'Identity Policies & User-ID',
      tagline: 'AD agent, ISE PxGrid, identity-based ACL.',
      sections: [
        { kind: 'prose', html: `<p>Both ASA and FTD can match policies on <b>user identity</b> as well as IP. Sources: AD agent (legacy), <b>ISE PxGrid</b> (modern), or 802.1x via Cisco Secure Client. Once mapped, group membership becomes a usable match condition in your policies — "deny anyone outside group X from reaching DC subnet".</p>` },
        { kind: 'cli', title: 'ASA — Cisco Context Directory Agent',
          code: `aaa-server AD-AGENT protocol radius
aaa-server AD-AGENT (inside) host 10.10.0.60
 key cisco-shared
 user-identity domain CORP
 user-identity default-domain CORP
 user-identity logout-probe netbios local-system

! Identity-based ACL
access-list OUT_IN extended permit tcp user-group CORP\\\\HR_GROUP any object-group HR_SERVERS object-group WEB_SERVICES`,
          desc: 'On FTD, user-to-IP mappings come from the FMC Identity Source (Realm) — typically ISE PxGrid in modern deployments.' }
      ]
    },
    {
      id: 'packet-tracer',
      icon: '🔬',
      title: 'packet-tracer & capture',
      tagline: 'The two tools that solve 80% of firewall problems.',
      sections: [
        { kind: 'prose', html: `<p><b>packet-tracer</b> simulates a packet through the firewall and reports every check it passes (route lookup, NAT, ACL, inspection, VPN). <b>capture</b> taps live traffic on an interface or asp-drop ring. Master both and most outage tickets become 5-minute jobs.</p>` },
        { kind: 'cli', title: 'packet-tracer — common invocations',
          code: `packet-tracer input outside tcp 198.51.100.7 12345 198.51.100.10 443

! With XML for parsing
packet-tracer input outside tcp 198.51.100.7 12345 198.51.100.10 443 xml

! VPN match — see if a flow would build the right SA
packet-tracer input inside icmp 10.1.1.5 8 0 10.50.0.5 detailed

! On FTD — same syntax inside the diagnostic CLI
> system support diagnostic-cli
asa# packet-tracer input outside tcp 198.51.100.7 12345 198.51.100.10 443`,
          desc: 'The output walks the packet through phase-by-phase. The phase that says ACTION: DROP tells you exactly which check failed.' },
        { kind: 'cli', title: 'capture — live + asp-drop',
          code: `! Live capture matched by ACL
access-list CAP extended permit ip host 10.1.1.5 host 10.50.0.5
access-list CAP extended permit ip host 10.50.0.5 host 10.1.1.5
capture CAP1 access-list CAP interface inside

show capture CAP1                        ! summary
show capture CAP1 detail                 ! per-packet
copy /pcap capture:CAP1 ftp://...        ! export pcap

! What the firewall is silently dropping
capture ASP-DROP type asp-drop all
show capture ASP-DROP

! Cleanup
no capture CAP1
no capture ASP-DROP`,
          desc: '"capture type asp-drop all" is gold — every drop is bucketed by reason (acl-drop, no-route, mp-svc-no-fragment-asp, etc.).' }
      ]
    },
    {
      id: 'ftd-fmc',
      icon: '🎛️',
      title: 'FTD via FMC — Day-2 Operations',
      tagline: 'Deploy, rollback, health, syslog/NetFlow.',
      sections: [
        { kind: 'prose', html: `<p>On FTD/FMC the workflow is policy → deploy. The FMC compiles the entire device config and pushes it; rolling back one bad rule means re-deploying the previous version of the policy. Treat FMC like infrastructure-as-code: keep change windows, record who deployed what.</p>` },
        { kind: 'cli', title: 'FTD CLI — useful commands',
          code: `> show running-config              ! lina-side config
> show version
> show high-availability config

> system support diagnostic-cli   ! ASA-style EXEC mode
> system support trace            ! per-packet ACP decision
> system support firewall-engine-debug
> system support ssl-debug

> expert                          ! drops to bash (be careful)
$ sudo lina_cli                   ! lina process console`
        },
        { kind: 'callout', level: 'warn', title: 'Don\'t edit on the FTD CLI',
          body: 'Anything you change with "configure" on the FTD CLI is overwritten on the next FMC deploy. Diagnostics yes; configuration always via FMC/CDO.' }
      ]
    },
    {
      id: 'ha-clustering',
      icon: '⚖️',
      title: 'HA & Clustering',
      tagline: 'Failover (active/standby + active/active), clustering, state sync.',
      sections: [
        { kind: 'prose', html: `<p>Two HA models: <b>Failover</b> (classic active/standby pair, optional active/active for multi-context ASA) and <b>Clustering</b> (up to 16 ASAs or FTDs as one logical firewall — used on 4100/9300). Failover synchronises connection state over a dedicated stateful link; clustering load-balances flows across the cluster via the upstream switch and CCL (cluster control link).</p>` },
        { kind: 'cli', title: 'ASA — active/standby failover',
          code: `failover lan unit primary
failover lan interface FAILOVER GigabitEthernet0/3
failover link FAILOVER GigabitEthernet0/3
failover replication http
failover interface ip FAILOVER 10.255.255.1 255.255.255.0 standby 10.255.255.2
failover key cisco-shared-secret
failover

! Verify
show failover
show failover state
show failover history`
        }
      ]
    },
    {
      id: 'troubleshooting',
      icon: '🩺',
      title: 'Troubleshooting Playbook',
      tagline: 'Logging, syslog severity, asp-drop reasons, common patterns.',
      sections: [
        { kind: 'prose', html: `<p>Order of attack:</p><ol><li><code>show conn detail</code> — does the flow exist?</li><li><code>packet-tracer</code> — what would happen now if I sent the flow?</li><li><code>capture</code> on both interfaces — is the firewall actually seeing both directions?</li><li><code>capture asp-drop all</code> — if it's seeing inbound but dropping, why?</li><li>Logging buffered + syslog at 6 — confirm the deny matches the right rule.</li></ol>` },
        { kind: 'cli', title: 'Logging defaults',
          code: `logging enable
logging buffered 7
logging buffer-size 1000000
logging timestamp
logging trap informational
logging host inside 10.10.0.50

show logging | include 106            ! ACL hit-style messages
show logging | include 305            ! NAT translation creation
show logging | include 713            ! IKE/IPsec
show logging | include 605            ! VPN auth`
        },
        { kind: 'checklist', title: 'Outage triage',
          items: [
            'show interface ip brief — interfaces up/up?',
            'show route — gateway present?',
            'packet-tracer through the firewall',
            'capture on both interfaces — is reverse traffic landing?',
            'capture asp-drop all — silent drops?',
            'show conn detail | include <ip> — flow exists?',
            'show xlate / show nat — NAT applied as expected?',
            'show crypto ikev2 sa / show vpn-sessiondb — VPN side',
            'show failover — peer healthy if HA?',
            'On FTD — has policy been deployed since last change?'
          ]
        }
      ]
    }
  ]
};
