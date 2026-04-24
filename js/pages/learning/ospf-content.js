// OSPFv2/v3 learning curriculum.

export const CURRICULUM = {
  id: 'ospf',
  title: 'OSPF',
  tagline: 'Open Shortest Path First — link-state, areas, LSAs, SPF, design and troubleshooting.',
  vendor: 'Vendor-neutral',
  estimatedMinutes: 240,
  modules: [
    {
      id: 'overview',
      title: 'Overview & Core Concepts',
      tagline: 'Link-state mechanics, the three OSPF tables, and where OSPF fits in a modern design.',
      icon: '🧭',
      sections: [
        { kind: 'prose', html: `
          <p><b>OSPF</b> is a link-state IGP defined in <b>RFC 2328</b> (OSPFv2 for IPv4) and <b>RFC 5340</b> (OSPFv3, which carries both IPv6 and — via address families — IPv4). Every router in an area builds an identical <b>link-state database (LSDB)</b> by flooding <b>Link-State Advertisements (LSAs)</b>. Each router independently runs <b>Dijkstra's SPF algorithm</b> over that database to compute a loop-free shortest-path tree rooted at itself.</p>
          <p>Three data structures matter on every OSPF router:</p>
          <ul>
            <li><b>Neighbor table</b> — per-interface list of adjacent OSPF routers and their state.</li>
            <li><b>Link-state database (LSDB)</b> — the topology, identical within an area.</li>
            <li><b>Routing table</b> — the SPF output injected into RIB.</li>
          </ul>
          <p>OSPF runs directly over IP as <b>protocol 89</b> (no TCP/UDP). All messages use multicast <b>224.0.0.5</b> (AllSPFRouters) or <b>224.0.0.6</b> (AllDRouters), except on point-to-point circuits where the DR is irrelevant.</p>` },
        { kind: 'diagram', title: 'OSPF areas & router roles', ascii:
`         Area 0 (backbone)
    +----+     +----+     +----+
    |ABR1|-----|BB-1|-----|ABR2|
    +----+     +----+     +----+
       |                     |
  +---------+           +---------+
  | Area 10 |           | Area 20 |
  |  IR  IR |           |  IR  IR |
  +---------+           +---------+

  IR  = Internal Router (all ints in one area)
  ABR = Area Border Router (touches Area 0 + non-backbone)
  ASBR= AS Boundary Router (redistributes external routes)` },
        { kind: 'callout', level: 'info', title: 'Why areas exist', body: `SPF is O(n log n) — fast for small n, but the LSDB flooding scope is the problem: every topology change re-floods LSAs to every router in the area. Areas contain flooding. Treat <b>Area 0</b> as your transit backbone, and keep each non-backbone area small (ideally &lt; 50 routers) and connected to Area 0 — directly or via a <b>virtual link</b>.` },
        { kind: 'cli', title: 'Minimal IOS-XE single-area config', code:
`router ospf 1
 router-id 10.0.0.1
 log-adjacency-changes detail
 passive-interface default
 no passive-interface GigabitEthernet0/0/0
!
interface GigabitEthernet0/0/0
 ip ospf 1 area 0
 ip ospf network point-to-point
 ip ospf hello-interval 3
 ip ospf dead-interval 12`,
          desc: 'Note: "ip ospf <process> area <id>" on the interface replaces the old "network" statements under the process — clearer and easier to review.' },
      ],
    },

    {
      id: 'adjacency',
      title: 'Adjacency & Neighbor States',
      tagline: 'The seven states, what each one proves, and why you get stuck in EXSTART/2-WAY.',
      icon: '🤝',
      sections: [
        { kind: 'prose', html: `
          <p>Two OSPF speakers progress through states as they build a full adjacency. Understanding each state lets you read <code>show ip ospf neighbor</code> output like a timeline — a neighbor stuck in one of them always points to a specific cause.</p>` },
        { kind: 'table', title: 'Neighbor state machine', headers: ['State','Meaning','Stuck here? Check…'], rows: [
          ['Down','No Hellos received','L1/L2, multicast, mismatched interface states'],
          ['Init','Heard my neighbor\'s Hello but not yet bi-directional','ACLs blocking return Hello; mismatched hello/dead'],
          ['2-Way','Hellos seen in both directions — DR/BDR election happens here','Expected on broadcast/NBMA where no DR role; mismatched network type'],
          ['ExStart','Master/slave election for DBD exchange','<b>MTU mismatch</b> (classic), duplicate router-IDs'],
          ['Exchange','Exchanging Database Description (DBD) packets','Same as ExStart; also unidirectional loss'],
          ['Loading','Requesting specific LSAs (LSR/LSU/LSAck)','LSA corruption, ACL filtering, asymmetric paths'],
          ['Full','LSDBs synchronised — normal operating state','—'],
        ]},
        { kind: 'callout', level: 'warn', title: 'MTU is the #1 cause of stuck in EXSTART', body: `During DBD exchange, OSPF sends packets of the interface MTU. If neighbor A has MTU 9000 and neighbor B has MTU 1500, B drops the jumbo DBDs and the adjacency hangs. Either fix the MTU, or configure <code>ip ospf mtu-ignore</code> on <b>both sides</b>. mtu-ignore is a workaround — fix the MTU in production.` },
        { kind: 'cli', title: 'Inspect neighbors & adjacency', code:
`show ip ospf neighbor
show ip ospf neighbor detail
show ip ospf interface GigabitEthernet0/0/0
show ip ospf neighbor <neighbor-id> detail
debug ip ospf adj          ! use sparingly on production
debug ip ospf hello` },
        { kind: 'checklist', title: 'Adjacency pre-flight', items: [
          'Same area ID on both interfaces',
          'Same hello and dead intervals',
          'Same network type (broadcast vs p2p vs NBMA)',
          'Same authentication type and key',
          'Same subnet (and same mask on broadcast networks)',
          'MTU matches (or mtu-ignore on both)',
          'Stub/NSSA flag matches',
          'Unique router IDs across the area',
        ]},
      ],
    },

    {
      id: 'areas-lsas',
      title: 'Areas & LSA Types',
      tagline: 'Types 1-11, what they carry, where they flood, and how they interact with area types.',
      icon: '🗂️',
      sections: [
        { kind: 'prose', html: `
          <p>An OSPF <b>area</b> is a flooding domain — LSAs of certain types are not allowed to leave it. The LSDB contents depend on which <b>LSA types</b> are accepted into the area, which in turn depends on the <b>area type</b> (standard, stub, totally stubby, NSSA, totally NSSA).</p>` },
        { kind: 'table', title: 'OSPFv2 LSA types', headers: ['Type','Name','Origin','Flooding scope'], rows: [
          ['1','Router LSA','Every router','Area (one per router per area)'],
          ['2','Network LSA','DR on multi-access segment','Area'],
          ['3','Summary LSA','ABR','Area (advertises prefixes <em>from</em> other areas)'],
          ['4','ASBR-Summary','ABR','Area (how to reach an ASBR in another area)'],
          ['5','AS-External','ASBR','Entire OSPF domain (except stub/NSSA)'],
          ['6','Group Membership','(Obsolete — MOSPF)','—'],
          ['7','NSSA External','ASBR in NSSA','NSSA only; ABR translates to type-5 at exit'],
          ['9','Opaque (link-local)','Any','Link-local — MPLS-TE, Grace LSA'],
          ['10','Opaque (area)','Any','Area — MPLS-TE'],
          ['11','Opaque (AS)','Any','Entire domain — rare'],
        ]},
        { kind: 'table', title: 'Area types and what\'s allowed', headers: ['Area type','Type-3','Type-4','Type-5','Type-7'], rows: [
          ['Standard (normal)','Yes','Yes','Yes','No'],
          ['Stub','Yes','No','No','No (default route from ABR)'],
          ['Totally Stubby','Default only','No','No','No'],
          ['NSSA','Yes','No','No','Yes (translated to T5 at ABR)'],
          ['Totally NSSA','Default only','No','No','Yes'],
        ]},
        { kind: 'cli', title: 'Read the LSDB', code:
`show ip ospf database
show ip ospf database router
show ip ospf database network
show ip ospf database summary
show ip ospf database external
show ip ospf database nssa-external
show ip ospf database router self-originate` },
        { kind: 'callout', level: 'tip', title: 'Read Type-1 LSAs to see your topology', body: `A Type-1 LSA lists every OSPF-enabled interface on the originating router with cost and neighbor. Dumping them from any router in an area reconstructs the area topology exactly — no diagram needed. If what you see does not match what you expect, the adjacency or the config is wrong.` },
      ],
    },

    {
      id: 'network-types',
      title: 'Network Types',
      tagline: 'Broadcast, p2p, NBMA, point-to-multipoint — why DR election matters and when to skip it.',
      icon: '🛰️',
      sections: [
        { kind: 'prose', html: `
          <p>OSPF was designed in the era of shared-media Ethernet and X.25/Frame Relay. The <b>network type</b> on an interface dictates whether OSPF elects a <b>Designated Router (DR)</b> and <b>BDR</b>, whether neighbors are discovered automatically, and the default hello/dead intervals.</p>
          <p>On modern point-to-point Ethernet links between routers, set the type to <b>point-to-point</b> — you save one LSA (no type-2), get faster convergence, and sidestep the DR election entirely.</p>` },
        { kind: 'table', title: 'Network types', headers: ['Type','DR?','Neighbor discovery','Hello/Dead','Typical use'], rows: [
          ['broadcast','Yes','Automatic via multicast','10 / 40','Shared Ethernet segments (rare today)'],
          ['point-to-point','No','Automatic','10 / 40','Router-to-router links (the norm)'],
          ['non-broadcast (NBMA)','Yes','Manual via <code>neighbor</code> command','30 / 120','Legacy Frame Relay'],
          ['point-to-multipoint','No','Automatic','30 / 120','Partially meshed hub-spoke'],
          ['point-to-multipoint non-broadcast','No','Manual','30 / 120','NBMA without DR election'],
          ['loopback','—','—','—','Advertised as /32 host route'],
        ]},
        { kind: 'cli', title: 'Set network type and tune timers', code:
`interface GigabitEthernet0/0/0
 ip ospf network point-to-point
 ip ospf hello-interval 3
 ip ospf dead-interval minimal hello-multiplier 4   ! sub-second detection
!
interface GigabitEthernet0/0/1
 ip ospf network broadcast
 ip ospf priority 10               ! higher priority → DR
 ip ospf priority 0                ! 0 → never become DR/BDR` },
        { kind: 'callout', level: 'tip', title: 'Same-subnet check only for broadcast/NBMA', body: `point-to-point neighbors can have different subnets on each end. Broadcast and NBMA require identical subnet and mask. Knowing this lets you number transit links with /30 or /31 and still run p2p OSPF.` },
      ],
    },

    {
      id: 'metrics',
      title: 'Metrics & Path Selection',
      tagline: 'Cost, reference bandwidth, SPF timers, and ECMP behaviour.',
      icon: '🧮',
      sections: [
        { kind: 'prose', html: `
          <p>OSPF cost on an interface is <code>reference-bandwidth / interface-bandwidth</code>, with a minimum of 1. The default reference bandwidth of <b>100 Mbps</b> is a relic — a Gigabit and a 100-Gigabit interface both end up with cost 1. <b>Always raise it</b>, consistently, on every router in the domain.</p>` },
        { kind: 'table', title: 'Suggested reference bandwidths', headers: ['Highest link speed in domain','auto-cost reference-bandwidth','Cost at highest speed'], rows: [
          ['10 Gbps','10000 (10 Gbps)','1'],
          ['100 Gbps','100000 (100 Gbps)','1'],
          ['400 Gbps','400000','1'],
        ]},
        { kind: 'cli', title: 'Tune metric + SPF', code:
`router ospf 1
 auto-cost reference-bandwidth 100000   ! 100 Gbps — do this on every router
 timers throttle spf 50 100 5000        ! initial 50ms, holdtime 100ms, max 5s
 timers throttle lsa 10 100 5000
 timers lsa arrival 80
 maximum-paths 8                        ! ECMP fanout
!
interface GigabitEthernet0/0/0
 ip ospf cost 100                       ! explicit override` },
        { kind: 'callout', level: 'warn', title: 'Mixed reference-bandwidths = broken path selection', body: `If router A uses ref-bw 100000 and router B uses the default 100, their cost views of the same topology are totally different. Traffic takes wildly suboptimal paths and nobody agrees what "shortest" is. Make ref-bw a domain-wide standard and audit for drift.` },
        { kind: 'prose', html: `
          <p>OSPF installs up to <b>maximum-paths</b> equal-cost next-hops for ECMP. A path is "equal" if the total cost to the destination matches — not just the outgoing interface cost. Use <code>show ip route &lt;prefix&gt;</code> and look for multiple "via" lines to confirm ECMP is active.</p>` },
      ],
    },

    {
      id: 'summarization',
      title: 'Summarization & Filtering',
      tagline: 'Inter-area summary, external summary, filter-list, and distribute-list.',
      icon: '📦',
      sections: [
        { kind: 'prose', html: `
          <p>OSPF summarization is only possible at boundaries — either at an <b>ABR</b> (inter-area, using <code>area range</code>) or at an <b>ASBR</b> (external, using <code>summary-address</code>). You cannot summarize within an area because the LSDB must be identical.</p>` },
        { kind: 'cli', title: 'ABR and ASBR summarization', code:
`! ABR: summarize Area 10 prefixes 10.10.0.0/16 out to Area 0
router ospf 1
 area 10 range 10.10.0.0 255.255.0.0
 area 10 range 10.10.99.0 255.255.255.0 not-advertise    ! blackhole a chunk
!
! ASBR: summarize redistributed routes
router ospf 1
 summary-address 172.16.0.0 255.255.0.0
 summary-address 192.168.99.0 255.255.255.0 not-advertise` },
        { kind: 'cli', title: 'Filter inter-area and external prefixes', code:
`! Filter summary LSAs inbound into an area (on ABR)
ip prefix-list FILT-IN seq 10 deny 10.10.99.0/24
ip prefix-list FILT-IN seq 20 permit 0.0.0.0/0 le 32
router ospf 1
 area 10 filter-list prefix FILT-IN in
!
! Block a local install without stopping LSA flooding
router ospf 1
 distribute-list prefix FILT-IN in` },
        { kind: 'callout', level: 'tip', title: 'filter-list vs distribute-list', body: `<code>area filter-list</code> prevents the <b>LSA</b> from entering the area — downstream routers never learn the prefix. <code>distribute-list</code> only prevents the local RIB install — the LSA still floods. For scale and security, prefer <code>filter-list</code> at the ABR.` },
      ],
    },

    {
      id: 'stub-nssa',
      title: 'Stub & NSSA Areas',
      tagline: 'Shrinking the LSDB for edge sites without losing connectivity.',
      icon: '🪴',
      sections: [
        { kind: 'prose', html: `
          <p>Edge areas rarely need to know about every external route in the domain. <b>Stub</b>, <b>totally stubby</b>, and their NSSA counterparts block external LSAs at the ABR and inject a default route pointing back at the ABR. The routing table inside the area is tiny and convergence is fast because there are far fewer LSAs to flood.</p>
          <p>Use <b>NSSA</b> when the edge area has its own ASBR (e.g. redistributes static routes from a branch firewall) — Type-7 LSAs carry the externals inside the area, and the ABR translates them to Type-5 on the way out to Area 0.</p>` },
        { kind: 'cli', title: 'Configure stub and NSSA', code:
`! Totally stubby (both sides must agree)
router ospf 1
 area 10 stub no-summary         ! on ABR
 area 10 stub                    ! on internal routers
!
! NSSA: edge area with its own ASBR
router ospf 1
 area 20 nssa
! Totally NSSA (default-only in for summary LSAs)
 area 20 nssa no-summary
! NSSA with default-information injected into the NSSA
 area 20 nssa default-information-originate` },
        { kind: 'callout', level: 'warn', title: 'Every router in a stub area must agree', body: `Stub, totally stubby, NSSA, and totally-NSSA flags must match on all routers in that area. A mismatch fails adjacency at the Hello stage — the E-bit or N-bit check fails. If a new router will not form an adjacency in a stub area, check the stub config first.` },
      ],
    },

    {
      id: 'ospfv3',
      title: 'OSPFv3 (IPv6 and address families)',
      tagline: 'What changed from v2 and how to run both IPv4 and IPv6 over one process.',
      icon: '🧬',
      sections: [
        { kind: 'prose', html: `
          <p>OSPFv3 (RFC 5340) was designed for IPv6 but was later extended with <b>address families</b> so one process can carry both IPv4 and IPv6 unicast. Key differences from v2:</p>
          <ul>
            <li>Runs per-link, not per-subnet — <b>instance ID</b> replaces subnet-match for multiple protocol instances on one link.</li>
            <li>Uses IPv6 link-local addresses to form adjacencies and as the next-hop.</li>
            <li>LSAs renumbered (Type-8 Link LSA, Type-9 Intra-Area Prefix LSA) — prefixes are separated from topology.</li>
            <li>Authentication moved out of the protocol into IPsec (legacy) or OSPFv3 Authentication Trailer (RFC 7166, preferred).</li>
          </ul>` },
        { kind: 'cli', title: 'OSPFv3 with address families', code:
`router ospfv3 1
 router-id 10.0.0.1
 address-family ipv4 unicast
  passive-interface default
 exit-address-family
 address-family ipv6 unicast
  passive-interface default
 exit-address-family
!
interface GigabitEthernet0/0/0
 ospfv3 1 ipv4 area 0
 ospfv3 1 ipv6 area 0
 ospfv3 network point-to-point` },
        { kind: 'callout', level: 'tip', title: 'Authentication — use Trailer, not IPsec', body: `The original OSPFv3 relied on IPsec for message authentication, which is painful to deploy and troubleshoot. RFC 7166 adds an <b>Authentication Trailer</b> with HMAC-SHA — same usability as OSPFv2 cryptographic auth, no IPsec needed. Prefer this on modern IOS-XE, IOS-XR, and Junos.` },
      ],
    },

    {
      id: 'auth',
      title: 'Authentication & Security',
      tagline: 'HMAC-SHA key chains, RFC 5709, and why MD5 has to go.',
      icon: '🔐',
      sections: [
        { kind: 'cli', title: 'OSPFv2 with HMAC-SHA-256 (RFC 5709)', code:
`key chain OSPF-KEYS
 key 1
  cryptographic-algorithm hmac-sha-256
  key-string 0 Sup3r-L0ng-Rotat3d-Key!
!
interface GigabitEthernet0/0/0
 ip ospf authentication key-chain OSPF-KEYS
! Or, per-area:
router ospf 1
 area 0 authentication key-chain OSPF-KEYS` },
        { kind: 'callout', level: 'warn', title: 'Deprecate MD5 and plaintext', body: `<code>ip ospf authentication message-digest</code> with an MD5 key is still widely deployed but MD5 is broken. All modern gear supports HMAC-SHA-256 via key chains — move there on the next refresh. Plaintext authentication (simple password) is not authentication at all.` },
        { kind: 'checklist', title: 'Security hardening', items: [
          'Authenticate every OSPF adjacency with HMAC-SHA',
          'passive-interface default + no passive on transit links only',
          'Block protocol 89 at the edge (external interfaces)',
          'Use unique router-IDs derived from a management loopback',
          'Rate-limit SPF (spf throttle) to survive flapping',
          'Monitor adjacency flaps via syslog + SNMP traps',
        ]},
      ],
    },

    {
      id: 'scale',
      title: 'Timers & Scaling',
      tagline: 'SPF throttling, LSA pacing, BFD, and how to converge in under a second.',
      icon: '⚡',
      sections: [
        { kind: 'prose', html: `
          <p>Default OSPF is conservative. For fast failure detection without excess flooding, layer three mechanisms: <b>BFD</b> for sub-second link failure detection, <b>exponential SPF throttling</b> to survive flap storms, and <b>LSA pacing</b> so the LSDB is not bombarded.</p>` },
        { kind: 'cli', title: 'Sub-second convergence stack', code:
`! BFD — detect link down in ~150ms
interface GigabitEthernet0/0/0
 bfd interval 50 min_rx 50 multiplier 3
 ip ospf bfd
!
! SPF and LSA throttling
router ospf 1
 timers throttle spf 50 100 5000
 timers throttle lsa 10 100 5000
 timers lsa arrival 80
 ispf                     ! incremental SPF
 prefix-suppression       ! omit transit prefixes from type-1 LSAs` },
        { kind: 'callout', level: 'tip', title: 'prefix-suppression cuts LSDB size', body: `In a pure transit network where only loopbacks need to be reachable, <code>prefix-suppression</code> on transit interfaces stops their /31 or /30 prefixes from being advertised in type-1 LSAs — LSDB shrinks dramatically in large spine/leaf fabrics.` },
      ],
    },

    {
      id: 'redistribution',
      title: 'Redistribution',
      tagline: 'Two-way redistribution, metric types, and avoiding the classic loop.',
      icon: '🔀',
      sections: [
        { kind: 'prose', html: `
          <p>Redistribution from another IGP or from BGP is where most production OSPF outages are born. OSPF marks redistributed routes as <b>E1</b> (cost = internal cost to ASBR + external metric) or <b>E2</b> (cost = only the external metric). E2 is the default and usually correct — E1 is right when you need OSPF to prefer the closest ASBR for the same external prefix.</p>` },
        { kind: 'cli', title: 'Safe redistribution pattern', code:
`! Tag OSPF-originated routes on exit and deny them on return
route-map INTO-OSPF permit 10
 set tag 100
!
route-map INTO-EIGRP deny 10
 match tag 100
route-map INTO-EIGRP permit 20
!
router ospf 1
 redistribute eigrp 10 subnets route-map INTO-OSPF
 default-metric 100
!
router eigrp 10
 redistribute ospf 1 route-map INTO-EIGRP
 default-metric 1000000 1 255 1 1500` },
        { kind: 'callout', level: 'danger', title: 'Two-way redistribution needs a tag-loop filter', body: `Without a tag on routes leaving OSPF and a deny-on-tag on the way back in, you create the classic redistribution loop: routes leak out, come back in via the other IGP with a lower metric, overwrite the real OSPF route, and traffic blackholes. The tag filter is not optional.` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'A methodical flow from Hello → SPF when OSPF is not working.',
      icon: '🧰',
      sections: [
        { kind: 'cli', title: 'Diagnostic cascade', code:
`! 1. Is the interface OSPF-enabled?
show ip ospf interface brief
show ip ospf interface Gi0/0/0

! 2. Are we seeing neighbors?
show ip ospf neighbor
show ip ospf neighbor detail

! 3. Is the LSDB what we expect?
show ip ospf database
show ip ospf database router self-originate

! 4. Did SPF run? When?
show ip ospf statistics
show ip ospf event-history      ! IOS-XR / some IOS-XE

! 5. Is the prefix in the RIB?
show ip route ospf
show ip route <prefix>

! 6. Packet-level checks
debug ip ospf hello                      ! use rate-limits!
debug ip ospf adjacency
debug ip ospf lsa-generation` },
        { kind: 'table', title: 'Common symptoms → likely causes', headers: ['Symptom','Likely cause'], rows: [
          ['Neighbor stuck in INIT','Hellos one-way: ACL, multicast issue, incorrect Hello/Dead'],
          ['Neighbor stuck in EXSTART','MTU mismatch; try <code>ip ospf mtu-ignore</code> to confirm'],
          ['Neighbors flap periodically','Dead interval too short, BFD flapping, physical errors'],
          ['Routes present in LSDB but not RIB','Better admin distance from other source; RIB full; next-hop unreachable'],
          ['Asymmetric routing','Mismatched reference-bandwidth; manual cost on only one side'],
          ['All routes disappear after a change','SPF loop caused by redistribution; check tags'],
        ]},
        { kind: 'callout', level: 'tip', title: 'Start at the bottom of the stack', body: `When OSPF is broken, resist jumping to <code>show ip ospf database</code>. Verify layer 1 and layer 2 first, then unicast reachability between neighbor IPs, then multicast (can each side ping 224.0.0.5?), then authentication, then area/network-type, then MTU. Most "OSPF bugs" are not OSPF bugs.` },
      ],
    },
  ],
};
