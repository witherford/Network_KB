// BGP-4 learning curriculum.

export const CURRICULUM = {
  id: 'bgp',
  title: 'BGP',
  tagline: 'Border Gateway Protocol — the internet routing protocol, path selection, policy, MP-BGP.',
  vendor: 'Vendor-neutral',
  estimatedMinutes: 300,
  modules: [
    {
      id: 'overview',
      title: 'Overview & Core Concepts',
      tagline: 'AS numbering, path vector, EBGP vs IBGP, and the three BGP tables.',
      icon: '🌐',
      sections: [
        { kind: 'prose', html: `
          <p><b>BGP-4</b> (RFC 4271) is the inter-domain routing protocol of the internet and the policy engine of most large enterprise and service-provider networks. It is a <b>path-vector</b> protocol: advertisements carry the full <code>AS_PATH</code> list, so loop avoidance is based on rejecting any route whose AS_PATH already contains the receiving AS.</p>
          <p>BGP runs over <b>TCP/179</b>, which gives it reliable delivery, windowing, and authentication for free. Unlike IGPs it does not flood — it builds explicit peering relationships and advertises only the best path for each prefix to each neighbor, subject to policy.</p>`},
        { kind: 'table', title: 'BGP sessions', headers: ['Type','Between','TTL','Next-hop behaviour','Typical use'], rows: [
          ['EBGP','Different ASes','1 (directly connected, unless ebgp-multihop)','Rewritten to self on advertise','Peering with ISPs, partners, transit'],
          ['IBGP','Same AS','TTL 255','<b>Not</b> changed by default','Carrying external routes across the AS'],
        ]},
        { kind: 'diagram', title: 'ASes and BGP sessions', ascii:
`      AS 64500                              AS 64600
   +------------+        EBGP           +------------+
   |   R1 ----- PE ==================== PE ----- R1  |
   |            PE (iBGP full mesh)     PE           |
   |   R2 ----- PE                       PE ----- R2 |
   +------------+                       +------------+
                         ^
                         | transit
                         v
                      AS 174 (Cogent)` },
        { kind: 'callout', level: 'info', title: 'Three tables, not one', body: `BGP maintains: <b>Adj-RIB-In</b> (everything received from a neighbor, before policy), <b>Loc-RIB</b> (best paths after policy — what the router uses), and <b>Adj-RIB-Out</b> (what is advertised to each neighbor, after outbound policy). On Cisco, <code>show ip bgp neighbor X.X.X.X received-routes</code> needs <code>soft-reconfiguration inbound</code> enabled.`},
        { kind: 'cli', title: 'Minimal IOS-XE EBGP session', code:
`router bgp 64500
 bgp router-id 10.0.0.1
 bgp log-neighbor-changes
 no bgp default ipv4-unicast
 neighbor 203.0.113.2 remote-as 64600
 neighbor 203.0.113.2 description PEERING-ISP-A
 neighbor 203.0.113.2 password 0 Str0ng-Key
 neighbor 203.0.113.2 ttl-security hops 1
 !
 address-family ipv4 unicast
  neighbor 203.0.113.2 activate
  neighbor 203.0.113.2 prefix-list IN-FROM-ISP-A in
  neighbor 203.0.113.2 prefix-list OUT-TO-ISP-A out
  neighbor 203.0.113.2 maximum-prefix 1000000 80 restart 30
 exit-address-family` },
      ],
    },

    {
      id: 'neighbor-states',
      title: 'Neighbor States & Session Setup',
      tagline: 'Idle → Connect → Active → OpenSent → OpenConfirm → Established.',
      icon: '🔗',
      sections: [
        { kind: 'table', title: 'FSM states — what each proves, what breaks it', headers: ['State','Proves','If stuck here…'], rows: [
          ['Idle','Nothing — local disable or admin shut','"no neighbor X shutdown", check route to peer'],
          ['Connect','Waiting for TCP to complete','No TCP/179 reachability; ACL blocking, routing issue'],
          ['Active','Trying to open outbound TCP','Same as Connect + asymmetric routing, NAT in the path'],
          ['OpenSent','Sent our OPEN','Capability mismatch, AS number mismatch'],
          ['OpenConfirm','Their OPEN accepted, awaiting KEEPALIVE','Rare — MD5 password mismatch, hold-timer 0'],
          ['Established','Session up, exchanging UPDATEs','Normal'],
        ]},
        { kind: 'cli', title: 'Probe the session', code:
`show bgp all summary
show bgp all neighbors 203.0.113.2
show tcp brief | include 179

! If the session will not come up:
ping 203.0.113.2 source Loopback0
traceroute 203.0.113.2
telnet 203.0.113.2 179          ! open TCP?
debug ip bgp 203.0.113.2 events
debug ip bgp 203.0.113.2 in update` },
        { kind: 'callout', level: 'warn', title: 'Active is not a good state', body: `Despite the name, <b>Active</b> means "actively trying but not connected". Established is the only green state. Sessions that ping-pong between Active and Connect usually point at a TCP issue — a firewall, MD5 password mismatch, or eBGP-multihop missing when peering across a transit hop.` },
      ],
    },

    {
      id: 'path-attributes',
      title: 'Path Attributes',
      tagline: 'AS_PATH, NEXT_HOP, LOCAL_PREF, MED, ORIGIN, COMMUNITY, and their scope.',
      icon: '🏷️',
      sections: [
        { kind: 'table', title: 'Common BGP path attributes', headers: ['Attribute','Category','Scope','Default'], rows: [
          ['AS_PATH','Well-known mandatory','Global — carried everywhere','Prepended by each EBGP speaker'],
          ['NEXT_HOP','Well-known mandatory','Global; unchanged by IBGP by default','Set to peer address on EBGP'],
          ['ORIGIN','Well-known mandatory','Global','IGP (<code>i</code>) / EGP (<code>e</code>) / incomplete (<code>?</code>)'],
          ['LOCAL_PREF','Well-known discretionary','IBGP only — not sent to EBGP','100 if not set'],
          ['MED','Optional non-transitive','Sent to EBGP; not propagated further','0 / missing'],
          ['COMMUNITY','Optional transitive','Carried end-to-end if configured','None — set by policy'],
          ['LARGE COMMUNITY','Optional transitive','End-to-end','None — 32:32:32 format (RFC 8092)'],
          ['AGGREGATOR','Optional transitive','Records who aggregated','—'],
          ['CLUSTER_LIST','Optional non-transitive','RR loop prevention','—'],
          ['ORIGINATOR_ID','Optional non-transitive','RR loop prevention','—'],
        ]},
        { kind: 'callout', level: 'tip', title: 'LOCAL_PREF beats AS_PATH — remember the order', body: `In best-path, LOCAL_PREF wins before AS_PATH is even considered. This is why LOCAL_PREF is the tool to pick <b>which exit</b> your AS uses — set it inbound on the preferred ingress router and all IBGP speakers will agree. Prepending AS_PATH is for influencing how <em>other ASes</em> pick their ingress into you.` },
      ],
    },

    {
      id: 'best-path',
      title: 'Best-Path Selection',
      tagline: 'The 13-step algorithm in the order routers actually evaluate it.',
      icon: '🎯',
      sections: [
        { kind: 'table', title: 'Best-path algorithm (Cisco order)', headers: ['#','Tiebreaker','Picks the path with'], rows: [
          ['1','Weight (Cisco-only)','Highest weight'],
          ['2','LOCAL_PREF','Highest LOCAL_PREF'],
          ['3','Locally originated','Network/redistribute/aggregate beats learned'],
          ['4','AIGP','Lowest AIGP metric (RFC 7311) if present'],
          ['5','AS_PATH length','Shortest AS_PATH'],
          ['6','ORIGIN','IGP &lt; EGP &lt; Incomplete'],
          ['7','MED','Lowest MED — only compared with same neighbor AS by default'],
          ['8','EBGP over IBGP','Prefer external'],
          ['9','IGP metric to NEXT_HOP','Lowest — the "hot-potato" step'],
          ['10','Equal-cost multipath','Multiple best paths if enabled'],
          ['11','Oldest EBGP path','Reduce flaps'],
          ['12','Lowest router-ID','Tie-break'],
          ['13','Lowest neighbor address','Final tie-break'],
        ]},
        { kind: 'cli', title: 'Read and verify', code:
`show bgp ipv4 unicast 203.0.113.0/24
! Look for the ">" marker — that is the best path.

show ip bgp 203.0.113.0/24 bestpath-reason
! On XR / newer XE, shows which step picked the winner.

! Enable multipath (same AS_PATH length + equal cost)
router bgp 64500
 address-family ipv4 unicast
  maximum-paths 8
  maximum-paths ibgp 8
  bgp bestpath as-path multipath-relax     ! allow equal-length different ASes` },
        { kind: 'callout', level: 'warn', title: 'MED comparison is AS-scoped by default', body: `MED is only compared between paths from the <b>same neighbor AS</b>. Two routes with MED 50 and MED 100 from different ASes do not compete on MED — they skip step 7 entirely. Use <code>bgp always-compare-med</code> to change this globally, but do so carefully across an entire AS.` },
      ],
    },

    {
      id: 'ibgp-scaling',
      title: 'IBGP Scaling: Reflectors & Confederations',
      tagline: 'Breaking the full-mesh without breaking loop prevention.',
      icon: '🪞',
      sections: [
        { kind: 'prose', html: `
          <p>IBGP has a loop-prevention rule: <b>routes learned from an IBGP peer are not re-advertised to other IBGP peers.</b> Without that rule, IBGP would loop endlessly. With it, every IBGP speaker must peer with every other — a full mesh of N*(N-1)/2 sessions that does not scale.</p>
          <p>Two solutions:</p>
          <ul>
            <li><b>Route Reflectors</b> (RFC 4456) — a designated "reflector" is allowed to re-advertise IBGP routes to its "clients". Loop prevention via <code>ORIGINATOR_ID</code> and <code>CLUSTER_LIST</code>.</li>
            <li><b>Confederations</b> (RFC 5065) — chop the AS into sub-ASes that speak EBGP among themselves but appear as one AS externally. Rare in enterprise; used by some large ISPs.</li>
          </ul>` },
        { kind: 'cli', title: 'Route Reflector configuration', code:
`! On the reflector
router bgp 64500
 bgp cluster-id 1.1.1.1
 address-family ipv4 unicast
  neighbor 10.0.0.10 route-reflector-client
  neighbor 10.0.0.11 route-reflector-client
  neighbor 10.0.0.12 route-reflector-client
!
! On each client — nothing special; it is a normal IBGP peer.` },
        { kind: 'callout', level: 'tip', title: 'Two RRs, different cluster-IDs, overlapping client sets', body: `For redundancy, deploy two RRs per cluster and point every client at both. Use the same cluster-ID on both RRs in the cluster so CLUSTER_LIST loop prevention still works. Redundant clusters with different IDs let RRs peer across clusters without filtering their own reflected routes.` },
      ],
    },

    {
      id: 'communities',
      title: 'Communities & Policy',
      tagline: 'Tagging routes for uniform policy across the AS.',
      icon: '🏷️',
      sections: [
        { kind: 'prose', html: `
          <p>A <b>community</b> is a 32-bit tag on a route. Most providers publish community schemes so customers can signal "prepend once toward AS X", "do not advertise to peer AS Y", or "blackhole this prefix". Communities travel with the route across EBGP (when <code>send-community</code> is enabled), making them ideal for end-to-end policy without per-prefix route-maps.</p>
          <p><b>Large Communities</b> (RFC 8092) — 12 bytes split 32:32:32 — remove the 16-bit limit on the ASN field. Use these for new designs, especially if your AS is 4-byte.</p>` },
        { kind: 'cli', title: 'Tag and match on communities', code:
`ip community-list standard CUST-PREPEND-ONCE permit 64500:110
ip community-list standard CUST-BLACKHOLE permit 64500:666
!
route-map FROM-CUSTOMER permit 10
 match community CUST-PREPEND-ONCE
 set as-path prepend 64500
!
route-map FROM-CUSTOMER permit 20
 match community CUST-BLACKHOLE
 set ip next-hop 192.0.2.1      ! a pre-configured blackhole next-hop
!
router bgp 64500
 neighbor 203.0.113.2 send-community extended
 address-family ipv4 unicast
  neighbor 203.0.113.2 route-map FROM-CUSTOMER in` },
        { kind: 'callout', level: 'tip', title: 'BLACKHOLE community (RFC 7999) — 65535:666', body: `The well-known BLACKHOLE community tells the receiving AS to discard traffic to the tagged prefix. Used to mitigate DDoS. Most tier-1s accept it today — check your peering agreement and use a more specific prefix length than the provider's normal acceptance policy (usually /24 or /32 for IPv4).` },
      ],
    },

    {
      id: 'filtering',
      title: 'Prefix Filtering & Route Maps',
      tagline: 'Prefix-lists, AS-path filters, and the "peering hygiene" baseline.',
      icon: '🧹',
      sections: [
        { kind: 'cli', title: 'Bogon and max-length filters', code:
`ip prefix-list BOGONS-V4 seq 5  deny 0.0.0.0/8 le 32
ip prefix-list BOGONS-V4 seq 10 deny 10.0.0.0/8 le 32
ip prefix-list BOGONS-V4 seq 15 deny 127.0.0.0/8 le 32
ip prefix-list BOGONS-V4 seq 20 deny 169.254.0.0/16 le 32
ip prefix-list BOGONS-V4 seq 25 deny 172.16.0.0/12 le 32
ip prefix-list BOGONS-V4 seq 30 deny 192.0.0.0/24 le 32
ip prefix-list BOGONS-V4 seq 35 deny 192.0.2.0/24 le 32
ip prefix-list BOGONS-V4 seq 40 deny 192.168.0.0/16 le 32
ip prefix-list BOGONS-V4 seq 45 deny 198.18.0.0/15 le 32
ip prefix-list BOGONS-V4 seq 50 deny 198.51.100.0/24 le 32
ip prefix-list BOGONS-V4 seq 55 deny 203.0.113.0/24 le 32
ip prefix-list BOGONS-V4 seq 60 deny 224.0.0.0/3 le 32
ip prefix-list BOGONS-V4 seq 65 deny 0.0.0.0/0 ge 25     ! reject more-specific than /24
ip prefix-list BOGONS-V4 seq 999 permit 0.0.0.0/0 le 24` },
        { kind: 'cli', title: 'AS-path filters', code:
`! Accept only directly-originated routes from a customer (no transit)
ip as-path access-list 10 permit ^64600$
!
! Drop routes with our own AS in the AS_PATH (poison)
ip as-path access-list 20 deny _64500_
ip as-path access-list 20 permit .*
!
router bgp 64500
 address-family ipv4 unicast
  neighbor 203.0.113.2 filter-list 10 in
  neighbor 203.0.113.2 filter-list 20 in` },
        { kind: 'callout', level: 'warn', title: 'Do not rely on filter-list alone', body: `Tier-1s apply <b>three layers</b> to customer/peer sessions: prefix-list (explicit accept by prefix), AS-path filter (accept by AS origin), and max-prefix limits. Enterprises peering with ISPs should apply at minimum: bogons deny, default-route deny (unless specifically wanted), and max-prefix with a 20% headroom over current.` },
      ],
    },

    {
      id: 'security',
      title: 'BGP Security — RPKI, TTL, Max-Prefix',
      tagline: 'Origin validation with RPKI ROAs and the rest of the hardening stack.',
      icon: '🛡️',
      sections: [
        { kind: 'prose', html: `
          <p><b>RPKI</b> (RFC 6480/6810) lets resource holders cryptographically sign which ASes may originate their prefixes. Routers fetch ROAs from an <b>RPKI validator</b> (Routinator, rpki-client, FORT) over RTR and mark incoming routes as <code>valid</code>, <code>invalid</code>, or <code>notfound</code>. Invalid routes should be dropped.</p>
          <p>RPKI does <b>not</b> prevent all hijacks — it only validates the origin, not the full AS_PATH. For path validation, BGPsec (RFC 8205) and ASPA (drafts) are emerging but deployment is thin.</p>` },
        { kind: 'cli', title: 'RPKI on IOS-XE / XR', code:
`! IOS-XE
router bgp 64500
 bgp rpki server tcp 203.0.113.50 port 3323 refresh 600
 address-family ipv4 unicast
  bgp bestpath prefix-validate allow-invalid        ! or deny
!
! Verify
show bgp ipv4 unicast rpki table
show bgp ipv4 unicast 8.8.8.0/24        ! check validation state` },
        { kind: 'checklist', title: 'EBGP peering hardening baseline', items: [
          'MD5 or TCP-AO authentication on every EBGP session',
          'TTL security (ttl-security hops N) or eBGP-multihop only when required',
          'Max-prefix limit with warning threshold + auto-restart',
          'Prefix-list in and out on every customer/peer session',
          'AS-path filter on customer sessions (accept only their ASes)',
          'RPKI ROV enabled; drop invalids',
          'Bogon / martian prefix filter',
          'Drop default route unless explicitly requested',
        ]},
      ],
    },

    {
      id: 'multihoming',
      title: 'Multihoming & Traffic Engineering',
      tagline: 'Influencing outbound with LOCAL_PREF and inbound with MED/prepending/communities.',
      icon: '↔️',
      sections: [
        { kind: 'prose', html: `
          <p>The asymmetry of BGP policy means the tools for <b>outbound</b> and <b>inbound</b> traffic engineering are different:</p>
          <ul>
            <li><b>Outbound</b> — you control: use LOCAL_PREF (inbound policy on the ingress router raises LOCAL_PREF for preferred exit), weight (Cisco, more local), or selective prefix-list to influence which exit your AS uses.</li>
            <li><b>Inbound</b> — you can only hint: MED (only compared within same neighbor AS), AS_PATH prepending (coarse), NO_EXPORT / NO_ADVERTISE communities, provider-specific communities, more-specific announcements.</li>
          </ul>` },
        { kind: 'cli', title: 'Common TE recipes', code:
`! Prefer ISP-A for outbound
route-map FROM-ISPA permit 10
 set local-preference 200
!
router bgp 64500
 address-family ipv4 unicast
  neighbor 203.0.113.2 route-map FROM-ISPA in          ! higher LP = preferred exit
!
! Deprefer our prefix on ISP-B for inbound (prepend)
route-map OUT-ISPB permit 10
 set as-path prepend 64500 64500 64500
!
router bgp 64500
 address-family ipv4 unicast
  neighbor 198.51.100.2 route-map OUT-ISPB out` },
        { kind: 'callout', level: 'tip', title: 'Prepending has diminishing returns', body: `One prepend helps. Three prepends help a lot. Five prepends almost never help more than three — many ASes discard paths longer than 50, and tier-1 transit providers often prepend your route further before handing it off. If you need fine control for inbound, communities from your provider are stronger levers than prepending.` },
      ],
    },

    {
      id: 'mp-bgp',
      title: 'MP-BGP — VPNv4, VPNv6, EVPN',
      tagline: 'Carrying non-IPv4 NLRI over BGP sessions.',
      icon: '🧩',
      sections: [
        { kind: 'prose', html: `
          <p><b>Multiprotocol BGP</b> (RFC 4760) extends BGP to carry address families beyond IPv4 unicast. The same TCP session carries IPv4 unicast, IPv6 unicast, IPv4 VPN (VPNv4), IPv4 multicast, L2VPN EVPN, link-state (BGP-LS), and more — negotiated via Capability exchange in the OPEN message.</p>
          <p>In MPLS L3VPN, PE routers exchange <b>VPNv4</b> routes over MP-BGP: the NLRI is <code>RD:prefix</code>, labelled by a per-route <b>VPN label</b>. Route-targets (RTs) expressed as extended communities control import/export into VRFs.</p>` },
        { kind: 'cli', title: 'VPNv4 PE-PE session', code:
`router bgp 64500
 neighbor 10.0.0.2 remote-as 64500
 neighbor 10.0.0.2 update-source Loopback0
 !
 address-family vpnv4 unicast
  neighbor 10.0.0.2 activate
  neighbor 10.0.0.2 send-community extended
 exit-address-family
 !
 address-family ipv4 vrf CUST-A
  redistribute connected
  redistribute static
 exit-address-family
!
vrf definition CUST-A
 rd 64500:100
 address-family ipv4
  route-target export 64500:100
  route-target import 64500:100
 exit-address-family` },
        { kind: 'callout', level: 'tip', title: 'EVPN is MP-BGP for Ethernet', body: `L2VPN EVPN (RFC 7432) uses MP-BGP to distribute MAC/IP bindings and VTEP reachability. It replaces the flood-and-learn model of VPLS with a BGP control plane, and it is the standard fabric protocol for modern VXLAN data centres. Same session setup as VPNv4 — just activate <code>l2vpn evpn</code> instead.` },
      ],
    },

    {
      id: 'fast-convergence',
      title: 'Fast Convergence & Resiliency',
      tagline: 'BFD, NHT, graceful restart, and BGP PIC.',
      icon: '⚡',
      sections: [
        { kind: 'prose', html: `
          <p>BGP's default convergence is slow — hold-time 180s, no fast link-failure detection. Modern deployments layer: <b>BFD</b> for sub-second peer-down, <b>Next-Hop Tracking (NHT)</b> for immediate recompute on IGP change, <b>Graceful Restart</b> (GR) / Non-Stop Forwarding to survive control-plane failures, and <b>BGP PIC</b> (Prefix Independent Convergence) for O(1) failover on primary path loss regardless of how many prefixes.</p>` },
        { kind: 'cli', title: 'Convergence tuning', code:
`interface GigabitEthernet0/0/0
 bfd interval 50 min_rx 50 multiplier 3
!
router bgp 64500
 neighbor 203.0.113.2 fall-over bfd
 neighbor 203.0.113.2 timers 3 9             ! keepalive 3, hold 9
 bgp graceful-restart
 address-family ipv4 unicast
  bgp additional-paths send receive          ! enable add-paths for BGP PIC
  bgp additional-paths select best 2
  neighbor 10.0.0.2 additional-paths send
  neighbor 10.0.0.2 advertise additional-paths best 2` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'Why is my route not picked? Why is it not advertised? Why is the session flapping?',
      icon: '🧰',
      sections: [
        { kind: 'cli', title: 'Diagnostic commands', code:
`! Is the session up?
show bgp all summary
show bgp ipv4 unicast neighbors 203.0.113.2 | include state

! What is the neighbor sending?
show bgp ipv4 unicast neighbors 203.0.113.2 received-routes
show bgp ipv4 unicast neighbors 203.0.113.2 routes
show bgp ipv4 unicast neighbors 203.0.113.2 advertised-routes

! Why is this path the best?
show bgp ipv4 unicast 203.0.113.0/24

! Is the next-hop reachable (IBGP)?
show ip cef 10.0.0.2
show ip route 10.0.0.2

! Policy check
show route-map OUT-TO-ISP-A
show ip prefix-list OUT-TO-ISP-A` },
        { kind: 'table', title: 'Symptom → likely cause', headers: ['Symptom','Likely cause'], rows: [
          ['Neighbor stuck in Active','TCP blocked / routing issue / MD5 password mismatch'],
          ['Session up but no routes','Outbound policy dropping everything; AF not activated; no redistribute/network'],
          ['Route in BGP table but not RIB','Next-hop not reachable; better source (lower AD); backdoor to IGP'],
          ['Route in RIB but not forwarded','CEF not installed (check show ip cef); MPLS label missing for VPN routes'],
          ['Session flaps every few minutes','Hold-timer expiring (path MTU, CPU), max-prefix tripping, physical layer'],
          ['IBGP route not advertised to IBGP peer','Split-horizon rule — need RR or full mesh'],
          ['Inbound route loops in RR','CLUSTER_LIST or ORIGINATOR_ID mismatch; check reflector design'],
        ]},
        { kind: 'callout', level: 'tip', title: 'When in doubt, start with "show bgp X bestpath-reason"', body: `On modern IOS-XE and XR, this one command tells you exactly which step of best-path picked the winner. It turns "why is BGP taking the weird path" into a one-line answer. On older platforms, read the list of candidates with <code>show bgp ipv4 unicast &lt;prefix&gt;</code> and walk the 13-step algorithm manually.` },
      ],
    },
  ],
};
