// EIGRP learning curriculum.

export const CURRICULUM = {
  id: 'eigrp',
  title: 'EIGRP',
  tagline: 'Cisco advanced distance-vector IGP — DUAL, feasible successors, wide metrics.',
  vendor: 'Cisco',
  estimatedMinutes: 180,
  modules: [
    {
      id: 'overview',
      title: 'Overview & DUAL',
      tagline: 'Why EIGRP is not a link-state, and how the Diffusing Update Algorithm keeps paths loop-free.',
      icon: '🧭',
      sections: [
        { kind: 'prose', html: `
          <p><b>EIGRP</b> is Cisco's <b>advanced distance-vector</b> IGP, opened to the IETF as an informational RFC (7868) but still predominantly Cisco-deployed. Unlike OSPF, routers do not share a full topology database — each router keeps a <b>topology table</b> of its own choices and its neighbors' advertisements, and picks the best with the <b>Diffusing Update Algorithm (DUAL)</b>.</p>
          <p>Three concepts make DUAL loop-free without the complexity of SPF:</p>
          <ul>
            <li><b>Successor</b> — the next-hop for the best path (lowest Feasible Distance).</li>
            <li><b>Feasible Successor (FS)</b> — a backup path whose <b>Reported Distance</b> is less than the current <b>Feasible Distance</b>. FS is guaranteed loop-free without any computation — install it instantly on failure.</li>
            <li><b>Active state</b> — when no FS exists for a failed route, EIGRP "goes active" and queries neighbors for an alternative. Otherwise it stays passive and fails over silently.</li>
          </ul>` },
        { kind: 'diagram', title: 'Successor vs Feasible Successor', ascii:
`            A
         /     \\
      10/       \\30
       /         \\
      B --- 5 --- C
     / 20        \\ 40
    X             X
    destination

  Best from A: via B (cost 10+20=30) — SUCCESSOR, FD=30
  Backup:      via C (cost 30+40=70). C's reported distance RD=40.
                RD(40) < FD(30)? NO → C is NOT a feasible successor.
  DUAL must "go active" and query if B fails.

  If C's RD had been 20, C would qualify as FS and failover is instant.`},
        { kind: 'callout', level: 'info', title: 'The feasibility condition is strict — by design', body: `The FC rule (RD &lt; FD) is conservative: there are backup paths that are actually loop-free but fail the check. The trade-off is <em>zero</em> computation on failover, which is why EIGRP converges so fast in practice — when it has an FS.` },
      ],
    },

    {
      id: 'neighbors',
      title: 'Neighbor Discovery & Hello',
      tagline: 'How adjacencies form and what breaks them.',
      icon: '🤝',
      sections: [
        { kind: 'prose', html: `
          <p>EIGRP uses <b>multicast 224.0.0.10</b> (IPv6: <code>FF02::A</code>) for Hello and multicast updates; it retransmits unacknowledged updates as unicast. Default Hello is 5 seconds, Hold is 15. On slow WAN links (NBMA &lt; T1), Hello jumps to 60 and Hold to 180.</p>
          <p>Adjacencies require all of:</p>
          <ul>
            <li>Same AS number (classic) or same named-mode instance name</li>
            <li>Same K-values (metric weights)</li>
            <li>Authentication match (if configured)</li>
            <li>Subnet match on the peering interface</li>
            <li>No mismatched stub configuration</li>
          </ul>` },
        { kind: 'cli', title: 'Named-mode basic configuration', code:
`router eigrp CORE
 address-family ipv4 unicast autonomous-system 10
  network 10.0.0.0 0.255.255.255
  af-interface GigabitEthernet0/0/0
   hello-interval 2
   hold-time 6
   authentication mode hmac-sha-256 Sup3r-Long-K3y
  exit-af-interface
  af-interface default
   passive-interface
  exit-af-interface
  topology base
   maximum-paths 8
  exit-af-topology
 exit-address-family` },
        { kind: 'callout', level: 'tip', title: 'Use named mode — not classic', body: `Named-mode EIGRP (introduced in 15.x) is the modern configuration. It supports HMAC-SHA authentication, wide metrics, per-AF configuration, and the same process for IPv4 + IPv6. Classic mode is legacy and missing features. All new deployments should be named mode.` },
      ],
    },

    {
      id: 'metric',
      title: 'Metric & Wide Metrics',
      tagline: 'Composite metric, K-values, and the 64-bit wide metric for modern speeds.',
      icon: '🧮',
      sections: [
        { kind: 'prose', html: `
          <p>Classic EIGRP metric is a 32-bit composite of: bandwidth, delay, load, reliability, MTU. By default only <b>bandwidth and delay</b> contribute (K1=K3=1, others=0). The formula is:</p>
          <p><code>metric = (10^7 / min-bw-along-path) + sum-of-delays</code>, then ×256 for scaling.</p>
          <p>The 32-bit cap breaks on high-speed links: a 10 Gbps interface hits the ceiling. <b>Wide metrics</b> (named-mode default) use 64-bit arithmetic with a larger scale factor — correctly differentiates 10G, 40G, 100G, 400G.</p>` },
        { kind: 'cli', title: 'Inspect and tune metric', code:
`show ip eigrp topology 10.10.0.0/16
show ip eigrp interfaces detail

! Explicit delay to make a link less preferred (higher delay = higher metric)
interface GigabitEthernet0/0/0
 delay 50                    ! in tens of microseconds

! Bandwidth (for metric only; does not change actual rate)
interface Tunnel100
 bandwidth 100000

! Stick to defaults for K-values — mismatches break adjacency silently.` },
        { kind: 'callout', level: 'warn', title: 'Do not change K-values', body: `K-values must match between neighbors or the adjacency will not form. Changing them domain-wide is a disruptive operation, and the defaults (K1=K3=1) are correct for 99% of designs. Resist the urge to set K5 for "reliability-based routing" — it introduces churn and non-deterministic paths.` },
      ],
    },

    {
      id: 'stub',
      title: 'Stub Routing',
      tagline: 'Keep queries out of branch sites with EIGRP stub.',
      icon: '🪴',
      sections: [
        { kind: 'prose', html: `
          <p>Query scope is EIGRP's biggest scaling concern. When a route goes active at the hub, queries propagate outward to every non-stub neighbor. A branch with one uplink does not need to be queried — it has no alternative path. Mark it <b>stub</b>, and queries stop at the hub-facing side of the adjacency.</p>` },
        { kind: 'cli', title: 'Stub options', code:
`router eigrp CORE
 address-family ipv4 unicast autonomous-system 10
  eigrp stub connected summary       ! branch default
  ! Full list: connected, static, summary, redistributed, receive-only
 exit-address-family` },
        { kind: 'callout', level: 'tip', title: 'Stub does not drop routes — it stops queries', body: `A stub router still sends and receives routes normally. The difference is that its neighbors mark the adjacency as stub and never send <b>queries</b> to it, which caps how far an active route can propagate. Always configure stub on hub-and-spoke designs — it is the single biggest EIGRP scaling win.` },
      ],
    },

    {
      id: 'summarization',
      title: 'Summarization',
      tagline: 'Interface-level summary-address, manual aggregation, and auto-summary (don\'t).',
      icon: '📦',
      sections: [
        { kind: 'cli', title: 'Interface summary', code:
`router eigrp CORE
 address-family ipv4 unicast autonomous-system 10
  af-interface GigabitEthernet0/0/0
   summary-address 10.10.0.0/16
   summary-address 10.10.99.0/24 leak-map LEAKED
  exit-af-interface
 exit-address-family
!
route-map LEAKED permit 10
 match ip address prefix-list LEAKED-SPECIFICS` },
        { kind: 'callout', level: 'warn', title: 'Turn off auto-summary; it\'s classful-era behaviour', body: `Classic EIGRP used to auto-summarize at major classful boundaries. This breaks discontiguous subnets. Named-mode defaults auto-summary off; if you ever see it enabled on classic, fix it: <code>no auto-summary</code>.` },
      ],
    },

    {
      id: 'variance',
      title: 'Unequal-Cost Load Balancing',
      tagline: 'Variance — EIGRP\'s unique ability to ECMP over non-equal paths.',
      icon: '⚖️',
      sections: [
        { kind: 'prose', html: `
          <p>Standard ECMP requires equal-cost paths. EIGRP can load-balance across <b>unequal-cost</b> paths using <b>variance</b>, provided all candidate paths are feasible successors (to preserve loop-freedom).</p>
          <p><code>variance N</code> means: install any FS whose metric is within N× the successor. So variance 2 installs both a metric-100 successor and a metric-190 FS. Traffic is hashed in inverse proportion to cost.</p>` },
        { kind: 'cli', title: 'Variance configuration', code:
`router eigrp CORE
 address-family ipv4 unicast autonomous-system 10
  topology base
   variance 2
   maximum-paths 4
  exit-af-topology
 exit-address-family` },
        { kind: 'callout', level: 'danger', title: 'A non-FS is never used — even with variance', body: `Variance <b>cannot</b> load balance over a non-feasible-successor path because that path might be a loop. Many engineers are surprised when variance 10 still only uses one path — it means the other candidate fails the FC. Use <code>show ip eigrp topology all</code> and check each candidate's RD vs. the current FD.` },
      ],
    },

    {
      id: 'auth',
      title: 'Authentication',
      tagline: 'HMAC-SHA via key chains.',
      icon: '🔐',
      sections: [
        { kind: 'cli', title: 'HMAC-SHA on named mode', code:
`key chain EIGRP-KEYS
 key 1
  cryptographic-algorithm hmac-sha-256
  key-string 0 R3al-Str0ng-P@ss
  accept-lifetime 00:00:00 Jan 1 2026 infinite
  send-lifetime 00:00:00 Jan 1 2026 infinite
!
router eigrp CORE
 address-family ipv4 unicast autonomous-system 10
  af-interface GigabitEthernet0/0/0
   authentication key-chain EIGRP-KEYS
   authentication mode hmac-sha-256 7 Fallb@ck-Key
  exit-af-interface
 exit-address-family` },
        { kind: 'callout', level: 'warn', title: 'Classic mode only supports MD5', body: `If you are stuck on classic-mode EIGRP and cannot migrate to named mode, the only authentication option is MD5 — inadequate for modern threat models. Migrating to named-mode is the only path to HMAC-SHA; the migration is <em>mostly</em> smooth but test on a lab pair first.` },
      ],
    },

    {
      id: 'scaling',
      title: 'Scaling & Query Scope',
      tagline: 'Stub, summarization, and timers — the three levers.',
      icon: '⚡',
      sections: [
        { kind: 'prose', html: `
          <p>EIGRP scales well to hundreds of routers if you keep the <b>query scope</b> bounded. Three mechanisms bound it: summary-addresses (a query stops at a summary boundary because the summarized prefix is covered), stub routers (queries never sent), and timers (active-time and SIA handling).</p>` },
        { kind: 'cli', title: 'Timers and SIA', code:
`router eigrp CORE
 address-family ipv4 unicast autonomous-system 10
  timers active-time 3                ! default 180s; lower = faster SIA decision
  timers graceful-restart purge-time 30
  af-interface default
   hello-interval 2
   hold-time 6
  exit-af-interface
 exit-address-family
!
! Monitor
show ip eigrp topology
show ip eigrp neighbors detail
show ip eigrp events` },
        { kind: 'callout', level: 'tip', title: 'SIA (Stuck-in-Active) is almost always a query-scope issue', body: `If neighbors report routes going SIA, the query propagation is crossing too many hops before reaching a router with an FS or a summary boundary. Add summary-addresses at the distribution layer, mark branches as stub, or both. Tuning active-time downward only changes when you detect SIA — it does not fix the design flaw.` },
      ],
    },

    {
      id: 'redistribution',
      title: 'Redistribution',
      tagline: 'Into and out of EIGRP without the classic loops.',
      icon: '🔀',
      sections: [
        { kind: 'cli', title: 'With tag filter', code:
`route-map INTO-EIGRP permit 10
 set tag 100
!
route-map INTO-OSPF deny 10
 match tag 100
route-map INTO-OSPF permit 20
 set metric-type type-1
!
router eigrp CORE
 address-family ipv4 unicast autonomous-system 10
  topology base
   redistribute ospf 1 metric 100000 10 255 1 1500 route-map INTO-EIGRP
  exit-af-topology
 exit-address-family
!
router ospf 1
 redistribute eigrp 10 subnets route-map INTO-OSPF` },
        { kind: 'callout', level: 'tip', title: 'Seed metric is mandatory for non-connected/static', body: `When redistributing from another IGP or BGP, EIGRP needs a seed metric. Use the <code>metric bw delay reliability load mtu</code> form or set <code>default-metric</code> under the address-family. A missing seed metric silently drops the routes.` },
      ],
    },

    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      tagline: 'Adjacency, SIA, missing routes, and the usual suspects.',
      icon: '🧰',
      sections: [
        { kind: 'cli', title: 'Diagnostic commands', code:
`show ip eigrp neighbors
show ip eigrp neighbors detail
show ip eigrp interfaces detail
show ip eigrp topology all-links          ! see all candidate paths, not just FS
show ip eigrp topology <prefix>           ! what does DUAL think?
show ip eigrp events
show ip eigrp traffic
debug eigrp packets hello                 ! rate-limit!
debug eigrp neighbors` },
        { kind: 'table', title: 'Symptom → cause', headers: ['Symptom','Likely cause'], rows: [
          ['Neighbors will not form','Mismatched K-values / AS number / subnet / auth'],
          ['Adjacency flaps silently','hold-time too low vs hello-interval; CPU pressure'],
          ['Routes going active (SIA)','Query scope too large — add summaries, stub routers'],
          ['Traffic not load-balancing','Second path is not a feasible successor; variance will not help'],
          ['After redistribution, routing loops','No tag filter — apply route-map with tag deny'],
          ['IPv6 routes missing','IPv6 AF not enabled (named mode requires separate activation)'],
        ]},
      ],
    },
  ],
};
