// Routing-protocol cheat-sheet ingest:
//   - 90 OSPF (incl. OSPFv3)
//   - 100 EIGRP (Classic + Named Mode)
//   - 100 IS-IS  (NEW section)
// Each entry has cmd / desc / example. Mirrored across the three Cisco
// IOS-family platforms (ciscoios, ciscoiosxe_router, ciscoiosxe_sw),
// matching the established BGP/v1.3.9 pattern.
//
// Logic per entry per platform:
//   - find existing cmd in section (exact-match)
//   - if found: set example if missing, set desc if missing
//   - else: push new { cmd, desc, type, flagged:false, example } into section
//   - for IS-IS, the section is created the first time it's needed.
//
// Source-string cleanups already applied in the data table below
// (markdown auto-link artifacts collapsed, backtick-wrapped commands
//  unwrapped). Intra-list duplicates filtered via dupChecker (per protocol).
//
// Run: node scripts/add-routing-examples.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const PLATFORMS = ['ciscoios', 'ciscoiosxe_router', 'ciscoiosxe_sw'];
const SECTION   = { OSPF: 'OSPF', EIGRP: 'EIGRP', ISIS: 'IS-IS' };

// type heuristic — read-only operational vs config
function classify(cmd) {
  if (/^(show|debug|clear|test)\b/i.test(cmd)) return 'show';
  return 'config';
}

const ENTRIES = [
  // ============================== OSPF (90 supplied → 87 unique) ==============================
  { proto: 'OSPF', cmd: 'router ospf [id]',
    desc: 'Initial setup command that enables the OSPF routing process locally using a specific Process ID.',
    example: `R1(config)# router ospf 1
R1(config-router)#

What it means:
- "1" is the local OSPF Process ID — used only on this router; it does
  NOT need to match the Process ID on neighbouring routers (unlike the
  EIGRP AS number).
- Multiple OSPF processes can run side-by-side on the same router (e.g.
  one per VRF). Each owns its own LSDB.` },

  { proto: 'OSPF', cmd: 'network [net] [wild] area [id]',
    desc: 'Activates OSPF on specific interfaces based on their IP address and assigns them to a specific OSPF Area.',
    example: `R1(config-router)# network 10.0.0.0 0.255.255.255 area 0

What it means:
- 10.0.0.0       : the network range to match
- 0.255.255.255  : OSPF wildcard mask (inverse of subnet mask). Any
                   interface whose primary IP falls inside 10.0.0.0/8
                   will be enabled for OSPF.
- area 0         : the OSPF area the matched interfaces are placed in.
                   Area 0 is the mandatory backbone.` },

  { proto: 'OSPF', cmd: 'show ip ospf neighbor',
    desc: 'Verifies adjacency status to ensure routers are communicating; critical for checking if neighbors are in the FULL state.',
    example: `R1# show ip ospf neighbor

Neighbor ID   Pri  State          Dead Time  Address       Interface
192.168.1.1   1    FULL/BDR       00:00:34   192.168.1.1   Gi0/0/0

What it means:
- Neighbor ID : peer's OSPF router-id (NOT necessarily its IP).
- Pri         : peer's interface priority. Used for DR/BDR election
                on broadcast/NBMA segments. 0 = never DR.
- State       : FULL means LSDBs are fully synchronised — this is the
                steady-state for working OSPF. BDR = peer holds the
                Backup Designated Router role on this segment.
                Common transient states: INIT, EXSTART, EXCHANGE,
                LOADING, FULL.
- Dead Time   : countdown to declaring adjacency dead; resets each
                time a Hello arrives (default 40s on broadcast).
- Address     : peer's IP on this segment.
- Interface   : the local interface the adjacency lives on.` },

  { proto: 'OSPF', cmd: 'show ip ospf interface',
    desc: 'Displays interface-specific OSPF parameters like Hello/Dead timers, cost, and the current Network Type.',
    example: `R1# show ip ospf interface Gi0/0
GigabitEthernet0/0 is up, line protocol is up
  Internet Address 192.168.1.1/24, Area 0, Attached via Network Statement
  Process ID 1, Router ID 1.1.1.1, Network Type BROADCAST, Cost: 1
  State BDR, Priority 1, Designated Router (ID) 2.2.2.2
  Hello 10, Dead 40, Wait 40, Retransmit 5

What it means:
- Network Type    : BROADCAST = DR/BDR election occurs. Other types:
                    POINT-TO-POINT, NBMA, P2MP.
- Cost: 1         : OSPF metric for this interface (lower is better).
- State BDR       : this router is the Backup Designated Router here.
- Hello 10/Dead 40: the Hello interval and the Dead timer (must match
                    exactly between neighbours or no adjacency forms).
- Retransmit 5    : retry interval for unacknowledged LSAs.` },

  { proto: 'OSPF', cmd: 'show ip route ospf',
    desc: 'Filters the routing table to show only OSPF-learned paths, allowing you to verify if remote subnets are reachable.',
    example: `R1# show ip route ospf
Codes: O - OSPF, IA - inter area, N1/N2 - NSSA external, E1/E2 - external

O    172.16.1.0/24 [110/2] via 10.1.1.2, 00:05:12, Gi0/0
O IA 10.20.0.0/16 [110/11] via 10.1.1.2, 00:05:12, Gi0/0
O E2 0.0.0.0/0    [110/1]  via 10.1.1.2, 00:05:12, Gi0/0

What it means:
- O      : intra-area OSPF route (within the same area).
- O IA   : inter-area route (learned via an ABR from another area).
- O E1/E2: external route imported via redistribution. E2 (default)
           keeps the originating cost; E1 adds the path cost too.
- [110/2]: AD 110 / metric 2. AD ranks against other protocols
           (lower wins); metric ranks against other OSPF paths.` },

  { proto: 'OSPF', cmd: 'router-id [a.b.c.d]',
    desc: 'Assigns a unique identity to the router; manual configuration prevents the ID from changing if interfaces flap.',
    example: `R1(config-router)# router-id 1.1.1.1

What it means:
- The router-id is the 32-bit OSPF identity in dotted-quad form. It is
  NOT an IP address — it just has the same syntax.
- Without an explicit router-id, OSPF picks the highest IP among
  loopbacks, then the highest IP among physical interfaces. If the
  source interface flaps or is removed, the ID changes and adjacencies
  reset — so manual configuration is best practice.` },

  { proto: 'OSPF', cmd: 'passive-interface [int]',
    desc: 'Secures LAN segments by advertising the subnet while preventing the router from sending or receiving Hello packets on that port.',
    example: `R1(config-router)# passive-interface FastEthernet0/0

What it means:
- The interface's subnet is still advertised in OSPF as a connected
  link, but no Hellos are sent or accepted on it.
- Use on user-facing LAN segments where no real OSPF neighbour should
  ever appear — prevents a rogue router from injecting routes.` },

  { proto: 'OSPF', cmd: 'show ip ospf database',
    desc: 'Examines the Link-State Database (LSDB) to troubleshoot topology synchronization and verify LSA types.',
    example: `R1# show ip ospf database

            OSPF Router with ID (1.1.1.1) (Process ID 1)

                Router Link States (Area 0)
Link ID         ADV Router      Age   Seq#        Checksum  Link count
1.1.1.1         1.1.1.1         412   0x80000003  0x00A1B2  3
2.2.2.2         2.2.2.2         410   0x80000004  0x00C3D4  2

                Net Link States (Area 0)
Link ID         ADV Router      Age   Seq#        Checksum
192.168.1.2     2.2.2.2         410   0x80000001  0x00E5F6

What it means:
- Router Link States  : Type-1 LSAs (one per router per area).
- Net Link States     : Type-2 LSAs (one per multi-access segment,
                        originated by the DR).
- Link ID / ADV Router: identify who is described and who originated.
- Seq#                : LSA version. Increments when topology changes.
- Age                 : seconds since origination. Maxage is 3600.` },

  { proto: 'OSPF', cmd: 'default-information originate',
    desc: 'Generates a default route into OSPF, typically used on an edge router to give the entire network internet access.',
    example: `R1(config-router)# default-information originate

R1# show ip ospf database external 0.0.0.0
                Type-5 AS External Link States
  LS age: 23
  LS Type: AS External Link
  Link State ID: 0.0.0.0 (External Network Number)
  Advertising Router: 1.1.1.1
  Network Mask: /0
  Metric Type: 2 (Larger than any link state path)
  Metric: 1

What it means:
- Generates a Type-5 External LSA for 0.0.0.0/0 originating from this
  router. Every other OSPF router will install a default route via R1.
- By default this only fires if R1 itself has a default route. Add
  "always" to force it regardless: "default-information originate always".` },

  { proto: 'OSPF', cmd: 'ip ospf cost [value]',
    desc: 'Manually manipulates the path metric on an interface to force OSPF to prefer one physical path over another.',
    example: `R1(config-if)# ip ospf cost 100

R1# show ip ospf interface Gi0/0 | include Cost
  Process ID 1, Router ID 1.1.1.1, Network Type BROADCAST, Cost: 100

What it means:
- Overrides the auto-calculated cost (reference-bw / interface-bw).
- Use to influence path selection without re-tuning bandwidth on every
  link, e.g. to push traffic away from a metered MPLS circuit.` },

  { proto: 'OSPF', cmd: 'auto-cost ref-bandwidth',
    desc: 'Updates the cost calculation formula to ensure OSPF correctly distinguishes between high-speed links like 1Gbps and 10Gbps.',
    example: `R1(config-router)# auto-cost reference-bandwidth 1000

R1# show ip ospf | include Reference
 Reference bandwidth unit is 1000 mbps

What it means:
- Default reference is 100 Mbps — every link 100 Mbps and faster ends
  up with cost 1, defeating path selection on modern networks.
- Setting it to 1000 (1 Gbps) makes 1G = cost 1, 10G = cost 0 (clamped
  to 1), 100M = cost 10. Use 100000 (100 Gbps) on backbones with
  100 G+ links. MUST be set identically on every OSPF router.` },

  { proto: 'OSPF', cmd: 'ip ospf priority [0-255]',
    desc: 'Controls the DR/BDR election; a priority of 255 ensures a router becomes the DR, while 0 prevents it from ever leading.',
    example: `R1(config-if)# ip ospf priority 255

R1# show ip ospf interface Gi0/0 | include Priority
  State DR, Priority 255, Designated Router (ID) 1.1.1.1, Interface...

What it means:
- 255 = highest possible priority, almost guarantees DR election.
- 0 = router refuses to ever become DR or BDR (DROTHER role).
- Election only happens once at adjacency-up time; raising priority
  later does NOT preempt the existing DR. Reset adjacencies to retry.` },

  { proto: 'OSPF', cmd: 'area [id] range [net] [mask]',
    desc: 'Performs Inter-Area summarization at the ABR to reduce the size of routing tables in other areas.',
    example: `R1(config-router)# area 1 range 10.0.0.0 255.0.0.0

# Other-area routers see one summary instead of dozens of /24s:
R2# show ip route ospf
O IA 10.0.0.0/8 [110/11] via 192.168.1.1, Gi0/0

What it means:
- Configured on the ABR. All Type-3 LSAs for prefixes inside 10.0.0.0/8
  in area 1 are aggregated into a single Type-3 advertised into other
  areas with metric = highest component (or "cost" override).
- A Null0 discard route is auto-installed locally to prevent loops.` },

  { proto: 'OSPF', cmd: 'ip ospf authentication-key',
    desc: 'Enables simple password protection on an interface to prevent unauthorized routers from joining the OSPF domain.',
    example: `R1(config-if)# ip ospf authentication-key MyPass
R1(config-if)# ip ospf authentication

R1# show ip ospf interface Gi0/0 | include authentication
  Simple password authentication enabled

What it means:
- Cleartext password — visible in show running-config and on the wire
  unless service password-encryption is enabled. Weak; prefer MD5 or
  HMAC-SHA. Useful for lab and quick demos only.` },

  { proto: 'OSPF', cmd: 'ip ospf message-digest-key',
    desc: 'Provides MD5 cryptographic security for OSPF packets, ensuring neighbor relationships are authenticated and secure.',
    example: `R1(config-if)# ip ospf message-digest-key 1 md5 Cisco
R1(config-if)# ip ospf authentication message-digest

R1# show ip ospf interface Gi0/0 | include authentication
  Cryptographic authentication enabled, key id 1

What it means:
- key id 1 : numeric key identifier; allows graceful key rotation
             by having multiple keys configured in parallel.
- md5 Cisco: the shared secret. The OSPF packet carries an MD5 digest
             of the packet + secret — the secret never goes on the wire.
- All neighbours on the segment must have at least one matching key id
  + secret pair, otherwise adjacency stays in INIT state.` },
  { proto: 'OSPF', cmd: 'debug ip ospf adj',
    desc: 'Troubleshoots neighbor issues by providing real-time logs of the adjacency process (Down -> Init -> Exstart -> Full).',
    example: `R1# debug ip ospf adj
OSPF adjacency events debugging is on

OSPF: 2 Way Communication to 2.2.2.2 on Gi0/0, state 2WAY
OSPF: Send DBD to 2.2.2.2 on Gi0/0 seq 0x800 opt 0x52 flag 0x7
OSPF: Rcv DBD from 2.2.2.2 on Gi0/0 seq 0x800 opt 0x52
OSPF: NBR Negotiation Done. We are the SLAVE
OSPF: Synchronized with 2.2.2.2 on Gi0/0, state FULL

What it means:
- Walks the adjacency state machine: 2WAY → EXSTART → EXCHANGE
  → LOADING → FULL.
- "DBD" = Database Description packets used to enumerate the LSDB
  contents during EXCHANGE.
- "We are the SLAVE" = master/slave role for DBD sequencing — higher
  router-id wins MASTER. Has no impact post-FULL.` },

  { proto: 'OSPF', cmd: 'debug ip ospf hello',
    desc: 'Diagnoses mismatched parameters by showing the contents of Hello packets, such as mismatched timers or Area IDs.',
    example: `R1# debug ip ospf hello
OSPF: Rcv hello from 2.2.2.2 area 0 from Gi0/0 192.168.1.2
OSPF: Mismatched hello parameters from 192.168.1.2
OSPF: Dead R 40 C 60, Hello R 10 C 15 Mask R 255.255.255.0 C 255.255.255.0

What it means:
- "R" = Received value (what the neighbour sent).
- "C" = Configured value (what we expect locally).
- Hello/Dead intervals AND subnet mask AND Area ID AND auth must all
  match exactly — this output points straight at the misconfig field.` },

  { proto: 'OSPF', cmd: 'ip ospf hello-interval',
    desc: 'Adjusts how often Hellos are sent; decreasing this value results in faster failure detection but higher CPU usage.',
    example: `R1(config-if)# ip ospf hello-interval 5

R1# show ip ospf interface Gi0/0 | include Hello
  Timer intervals configured, Hello 5, Dead 20, Wait 20, Retransmit 5

What it means:
- Lowering Hello from 10s default to 5s halves the time to notice a
  dead neighbour but doubles the Hello PPS on the link.
- Dead-interval auto-tracks at 4× hello unless explicitly set. BFD is
  usually a better tool for sub-second failure detection.` },

  { proto: 'OSPF', cmd: 'ip ospf dead-interval',
    desc: 'Sets the neighbor timeout period; usually set to 4x the Hello interval to determine when a neighbor is down.',
    example: `R1(config-if)# ip ospf dead-interval 20

R1# show ip ospf interface Gi0/0 | include Dead
  Timer intervals configured, Hello 5, Dead 20, Wait 20, Retransmit 5

What it means:
- If 20 seconds pass without a Hello, the neighbour is declared down,
  the adjacency drops, and SPF re-runs.
- Best practice: dead = 4 × hello. Both ends MUST agree.
- Variant "ip ospf dead-interval minimal hello-multiplier <n>" pushes
  Hellos sub-second for hyper-fast convergence.` },

  { proto: 'OSPF', cmd: 'clear ip ospf process',
    desc: 'Hard-resets the OSPF engine, which is necessary to apply changes to the Router ID or clear stuck adjacencies.',
    example: `R1# clear ip ospf process
Reset ALL OSPF processes? [no]: yes

%OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Gi0/0 from FULL to DOWN
%OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Gi0/0 from LOADING to FULL

What it means:
- All adjacencies bounce, the LSDB is rebuilt, and SPF re-runs.
- Required after changing the router-id (auto or manual) — OSPF will
  not promote a new ID until the process restarts.
- Disruptive on production. Schedule during a maintenance window.` },

  { proto: 'OSPF', cmd: 'area [id] stub',
    desc: 'Optimizes area resources by blocking external (Type 5) LSAs and replacing them with a default route.',
    example: `R1(config-router)# area 1 stub

R1# show ip ospf
 Area 1
   Number of interfaces in this area is 1
   It is a stub area

R-internal# show ip route ospf
O*IA 0.0.0.0/0 [110/1] via 10.1.1.1, Gi0/0   ← injected default

What it means:
- All routers in area 1 must agree it is "stub" — mismatch breaks
  adjacency.
- Type-5 (external) LSAs are blocked from entering. Internal area-1
  routers reach external destinations via the auto-injected default.
- Inter-area Type-3 LSAs still flood in (use "no-summary" to block
  those too — Totally Stubby).` },

  { proto: 'OSPF', cmd: 'area [id] stub no-summary',
    desc: 'Maximizes resource savings (Totally Stubby) by blocking both external and inter-area routes, leaving only a default route.',
    example: `R-ABR(config-router)# area 1 stub no-summary

R-internal# show ip route ospf
O*IA 0.0.0.0/0 [110/1] via 10.1.1.1, Gi0/0

What it means:
- "no-summary" applies only on the ABR. Internal stub routers don't
  need it — they just need "area 1 stub".
- Both Type-3 (inter-area) and Type-5 (external) are blocked. Internal
  routers see only their own area's intra-area routes plus a default.
- Cisco-proprietary mode (Totally Stubby). Best for spoke sites with
  one exit ABR.` },

  { proto: 'OSPF', cmd: 'ip ospf network point-to-point',
    desc: 'Optimizes Ethernet links between two routers by removing the need for DR/BDR election and speeding up convergence.',
    example: `R1(config-if)# ip ospf network point-to-point

R1# show ip ospf interface Gi0/0 | include Network Type
  Network Type POINT_TO_POINT, Cost: 1

What it means:
- Eliminates DR/BDR election overhead on a back-to-back Ethernet link.
- Faster Hello/Dead defaults than NBMA (10/40 vs 30/120).
- Both sides MUST be set the same — broadcast + p2p will not adjacency.
- Good practice on any OSPF-over-Ethernet link with exactly two routers.` },

  { proto: 'OSPF', cmd: 'show ip ospf border-routers',
    desc: 'Identifies topology exit points by listing all known Area Border Routers (ABR) and Autonomous System Boundary Routers (ASBR).',
    example: `R1# show ip ospf border-routers

OSPF Process 1 internal Routing Table

Codes: i - Intra-area route, I - Inter-area route

i 2.2.2.2 [10] via 10.1.1.2, Gi0/0, ABR, Area 0, SPF 5
i 3.3.3.3 [20] via 10.1.1.2, Gi0/0, ASBR, Area 0, SPF 5

What it means:
- Lists every ABR (Area Border Router) and ASBR (Autonomous System
  Boundary Router) the local OSPF process knows about.
- Cost in [brackets] is the IGP cost to reach that border router.
- Used as the underlay to compute Type-3/Type-5 next-hop selection.` },

  { proto: 'OSPF', cmd: 'summary-address [net] [mask]',
    desc: 'Summarizes external routes at the ASBR, preventing thousands of external subnets from flooding the OSPF database.',
    example: `R-ASBR(config-router)# summary-address 172.16.0.0 255.255.0.0

# Receivers see one Type-5 instead of many:
R# show ip route ospf | include 172.16
O E2 172.16.0.0/16 [110/20] via 10.1.1.2, 00:01:14, Gi0/0

What it means:
- Applied at the ASBR (router doing redistribution). Aggregates many
  more-specific external Type-5 LSAs into a single summary Type-5.
- Compare with "area X range" which summarises Type-3 (inter-area)
  LSAs at an ABR.` },

  { proto: 'OSPF', cmd: 'show ip ospf statistics',
    desc: 'Monitors SPF algorithm performance to see how often the router is recalculating the map due to network instability.',
    example: `R1# show ip ospf statistics

  Area 0: SPF algorithm executed 12 times
  Summary OSPF SPF statistic
  SPF calculation time
  Delta T   Intra D-Intra Summ D-Summ Ext   D-Ext  Total Reason
  00:01:34   4ms     0ms   1ms    0ms   2ms    0ms    7ms  R, N

What it means:
- Each row is one SPF run, broken down by stage (Intra, Summary, Ext).
- "Reason" tells why SPF ran:
    R = Router-LSA changed
    N = Network-LSA changed
    SN = Summary-Net (Type-3) changed
    X = External (Type-5) changed
- A high SPF count over a short window points at flapping links.` },

  { proto: 'OSPF', cmd: 'ip ospf mtu-ignore',
    desc: 'Workaround for MTU mismatches; allows neighbors to form an adjacency even if their Maximum Transmission Units do not match.',
    example: `R1(config-if)# ip ospf mtu-ignore

R1# show ip ospf interface Gi0/0 | include MTU
  MTU mismatch detection: disabled

What it means:
- During DBD exchange OSPF advertises its interface MTU. If neighbour's
  is different, the adjacency hangs in EXSTART/EXCHANGE.
- mtu-ignore tells OSPF to skip the check. Use as a tactical fix —
  the proper resolution is to make MTU consistent end-to-end.` },

  { proto: 'OSPF', cmd: 'show ip ospf virtual-links',
    desc: 'Troubleshoots logical tunnels that connect a non-backbone area to Area 0 when no physical connection exists.',
    example: `R1# show ip ospf virtual-links
Virtual Link OSPF_VL0 to router 2.2.2.2 is up
  Run as demand circuit
  Transit area 1, via interface Gi0/0
  Topology-MTID Cost   Disabled  Shutdown  Topology Name
        0          1     no       no        Base
  Hello 10, Dead 40, Wait 40, Retransmit 5

What it means:
- A virtual link makes a discontiguous area 0 act as if it were
  contiguous — the transit area (here area 1) carries Type-3 LSAs
  for area 0.
- "is up" means the underlying transit-area path is reachable AND
  the OSPF adjacency over the VL is FULL.
- Considered a band-aid; redesign with a contiguous backbone if
  possible.` },

  { proto: 'OSPF', cmd: 'redistribute [proto]',
    desc: 'Integrates different protocols by importing routes from EIGRP, BGP, or Static sources into the OSPF domain.',
    example: `R1(config-router)# redistribute eigrp 100 metric 100 subnets

R1# show ip ospf | include Redistributing
  Redistributing External Routes from,
    eigrp 100 with metric 100, includes subnets in redistribution

What it means:
- "subnets" is required on classic IOS — without it only classful nets
  redistribute (a common pitfall).
- "metric 100" sets the seed cost on the resulting Type-5 LSAs.
- The local router automatically becomes an ASBR. Filter aggressively
  with route-maps to avoid loops when redistributing both ways.` },

  { proto: 'OSPF', cmd: 'timers throttle spf',
    desc: 'Improves network stability by setting delays between SPF runs, preventing CPU exhaustion during flapping events.',
    example: `R1(config-router)# timers throttle spf 5 100 5000

R1# show ip ospf | include throttle
 Initial SPF schedule delay 5 msecs
 Minimum hold time between two consecutive SPFs 100 msecs
 Maximum wait time between two consecutive SPFs 5000 msecs

What it means:
- spf-start (5 ms)  : delay before the first SPF runs after a change.
- spf-hold  (100 ms): minimum spacing between back-to-back SPFs.
- spf-max   (5000 ms): exponential cap during a storm.
- The hold value doubles each time SPF re-runs inside the window,
  capping at spf-max — protects CPU during flap storms.` },
  { proto: 'OSPF', cmd: 'ipv6 router ospf [id]',
    desc: 'Enables OSPFv3 for IPv6 routing, creating a separate process for the IPv6 address family.',
    example: `R1(config)# ipv6 router ospf 1
R1(config-rtr)# router-id 1.1.1.1   ! mandatory for OSPFv3

What it means:
- Process 1 is the local OSPFv3 instance — independent of any IPv4
  OSPF process running on the same router.
- OSPFv3 has no auto router-id from IPv4 loopbacks; it MUST be set
  manually if no IPv4 addresses exist on the box.` },

  { proto: 'OSPF', cmd: 'ipv6 ospf [id] area [id]',
    desc: 'Activates OSPFv3 on an interface directly; OSPFv3 uses interface-level config instead of the network command.',
    example: `R1(config-if)# ipv6 ospf 1 area 0

R1# show ipv6 ospf interface Gi0/0 | include Process|Area
  GigabitEthernet0/0 is up, line protocol is up
    Link Local Address FE80::1, Interface ID 3
    Area 0, Process ID 1

What it means:
- OSPFv3 abandons the global "network" statement; you opt-in
  per-interface.
- OSPFv3 forms adjacencies over the link-local FE80::/10 address
  even if no global IPv6 prefix is configured.` },

  { proto: 'OSPF', cmd: 'area [id] nssa',
    desc: 'Creates a Not-So-Stubby Area to allow an ASBR to exist in a stub area while still blocking external LSAs from Area 0.',
    example: `R1(config-router)# area 1 nssa

R1# show ip ospf | include nssa
 Area 1 is a NSSA area

R# show ip route ospf | include N2
O N2 192.0.2.0/24 [110/20] via 10.1.1.2, Gi0/0

What it means:
- NSSA can host its own ASBR (so it can redistribute external routes
  locally) while still blocking Type-5 LSAs from area 0.
- Local externals are advertised as Type-7 inside the NSSA, then
  translated to Type-5 by an ABR before leaving.
- N1/N2 codes mark the route as NSSA-external on receivers.` },

  { proto: 'OSPF', cmd: 'area [id] nssa no-summary',
    desc: 'Configures a Totally NSSA, blocking both external and inter-area routes except for a single default route.',
    example: `R-ABR(config-router)# area 1 nssa no-summary

R-internal# show ip route ospf
O*N2 0.0.0.0/0 [110/1] via 10.1.1.1, 00:01:30, Gi0/0

What it means:
- Combines NSSA (no Type-5) with no-summary (no Type-3) — internals
  see only intra-area + the auto-injected Type-7 default.
- Configured on the ABR only. The internal NSSA routers still just
  use plain "area 1 nssa".` },

  { proto: 'OSPF', cmd: 'area [id] virtual-link [rid]',
    desc: 'Creates a logical tunnel to Area 0 through a transit area to fix discontiguous-backbone issues.',
    example: `R-ABR1(config-router)# area 1 virtual-link 3.3.3.3
R-ABR2(config-router)# area 1 virtual-link 1.1.1.1

R-ABR1# show ip ospf virtual-links
Virtual Link OSPF_VL0 to router 3.3.3.3 is up
  Transit area 1, via interface Gi0/1
  Adjacency State FULL (Virtual-Link)

What it means:
- The virtual link runs over area 1 to glue area 0 back together.
- Both endpoint routers must be ABRs and reference each other's
  router-id.
- "Adjacency State FULL (Virtual-Link)" confirms the logical
  adjacency is up — Type-3 LSAs for area 0 will now flow.` },

  { proto: 'OSPF', cmd: 'ip ospf network broadcast',
    desc: 'Forces a broadcast network type on non-broadcast media (like Frame Relay) to enable DR/BDR election.',
    example: `R1(config-if)# ip ospf network broadcast

R1# show ip ospf interface Se0/0 | include Network Type
  Network Type BROADCAST, Cost: 64

What it means:
- Default for Frame Relay / NBMA media is NON_BROADCAST, which needs
  manual neighbour statements.
- Forcing BROADCAST lets OSPF use multicast Hellos and elect a
  DR/BDR — works only when full-mesh PVCs exist between all spokes.` },

  { proto: 'OSPF', cmd: 'show ip ospf interface brief',
    desc: 'Summarizes OSPF interface status in a single-line view, perfect for a fast health check across many ports.',
    example: `R1# show ip ospf interface brief

Interface  PID  Area  IP Address/Mask    Cost  State Nbrs F/C
Gi0/0      1    0     192.168.1.1/24     1     DR    1/1
Gi0/1      1    0     10.1.1.1/30        1     P2P   1/1
Lo0        1    0     1.1.1.1/32         1     LOOP  0/0

What it means:
- PID         : OSPF process ID.
- State       : DR / BDR / DROTHER / P2P / LOOP / WAIT.
- Nbrs F/C    : neighbours in FULL state / total neighbours
                configured. F=C means everything is happy.` },

  { proto: 'OSPF', cmd: 'ip ospf flood-reduction',
    desc: 'Optimizes LSA flooding on stable links by suppressing periodic LSA refreshes (every 30 mins) to save bandwidth.',
    example: `R1(config-if)# ip ospf flood-reduction

R1# show ip ospf interface Gi0/0 | include Flood
  Flood reduction is enabled

What it means:
- Normally LSAs are re-flooded every 1800 s ("LS Refresh") even when
  unchanged. Flood-reduction marks them as DoNotAge so refreshes are
  suppressed.
- Topology-change LSAs still flow as usual. Saves bandwidth on
  stable WAN circuits.` },

  { proto: 'OSPF', cmd: 'ip ospf database-filter all out',
    desc: 'Filters all outgoing LSAs on an interface; used in Hub-and-Spoke designs to prevent spoke routers from seeing the full DB.',
    example: `R-Hub(config-if)# ip ospf database-filter all out

R-Hub# show ip ospf interface Gi0/0 | include filter
 Database filter: All outgoing LSAs filtered

What it means:
- The router stops sending LSAs out this interface entirely. The
  neighbour will still pull updates via DBD/LSR if the adjacency
  forms, but no flood-driven advertisements arrive.
- Common in DMVPN hub-and-spoke designs to keep spokes blind to the
  rest of the OSPF domain.` },

  { proto: 'OSPF', cmd: 'max-metric router-lsa',
    desc: 'Temporarily sets cost to maximum (65535) during a reboot/maintenance to prevent the router from being used as a transit path.',
    example: `R1(config-router)# max-metric router-lsa on-startup 300

R1# show ip ospf | include max
 Originating router-LSA with maximum metric on-startup, time remaining 287

What it means:
- All transit links advertise cost 0xFFFF (65535) — neighbours treat
  this router as a stub and route around it.
- Stub-network entries (loopbacks, /32s) keep their real cost so
  destinations on this router stay reachable.
- "on-startup 300" applies for 5 min after boot, giving BGP/IGP time
  to converge before pulling traffic.` },

  { proto: 'OSPF', cmd: 'bfd all-interfaces',
    desc: 'Enables Bidirectional Forwarding Detection, allowing OSPF to detect link failures in milliseconds rather than seconds.',
    example: `R1(config-router)# bfd all-interfaces
R1(config-if)# bfd interval 50 min_rx 50 multiplier 3

R1# show bfd neighbors
NeighAddr     LD/RD    RH/RS    State    Int
192.168.1.2   1/1      Up       Up       Gi0/0

What it means:
- BFD probes at 50 ms intervals; 3 missed = link declared down.
- OSPF gets the down event from BFD instead of waiting for the dead
  timer (40 s default) — sub-second convergence.
- Both ends must support and enable BFD or the session never comes Up.` },

  { proto: 'OSPF', cmd: 'ip ospf bfd',
    desc: 'Enables BFD on a specific interface for granular control over fast-failure detection on critical links only.',
    example: `R1(config-if)# ip ospf bfd

R1# show ip ospf interface Gi0/0 | include BFD
  BFD enabled

What it means:
- Per-interface override of "bfd all-interfaces" — useful when you
  want sub-second convergence on a few critical links but not on
  every OSPF-enabled port (LAN segments etc.).` },

  { proto: 'OSPF', cmd: 'show ip ospf fast-reroute',
    desc: 'Verifies Loop-Free Alternates (LFA), which OSPF pre-calculates to provide sub-second backup paths.',
    example: `R1# show ip ospf fast-reroute

OSPF Process 1:
  Prefix     Primary       LFA Backup       Disjoint?
  10.0.0.0/8 10.1.1.2/Gi0/0  10.2.2.2/Gi0/1   Yes
  172.16/16  10.1.1.2/Gi0/0  10.3.3.2/Gi0/2   Yes

What it means:
- OSPF pre-installs an alternate next-hop in CEF for each protected
  prefix. On primary failure CEF flips traffic in microseconds.
- "Disjoint?: Yes" means the LFA path is genuinely independent of the
  primary — actual loop-free protection.` },

  { proto: 'OSPF', cmd: 'ip ospf lfa-candidate',
    desc: 'Enables IP Fast Reroute, instructing the router to find a backup path that does not loop back to itself.',
    example: `R1(config-if)# ip ospf lfa-candidate

R1# show ip ospf | include LFA
   Loopfree alternate enabled

What it means:
- Marks this interface as a valid candidate for use as a backup path
  when computing LFAs for other prefixes.
- Pair with "fast-reroute per-prefix enable prefix-priority high"
  under the OSPF process to switch protection on.` },

  { proto: 'OSPF', cmd: 'area [id] authentication message-digest',
    desc: 'Enables MD5 authentication for an entire area at once, rather than configuring every single interface.',
    example: `R1(config-router)# area 0 authentication message-digest

R1# show ip ospf | include authentication
   Area BACKBONE(0) authentication: Message Digest

What it means:
- Every interface in area 0 inherits MD5 auth — no need to repeat
  "ip ospf authentication message-digest" on each link.
- The interface still needs the actual key:
    ip ospf message-digest-key 1 md5 <secret>` },

  { proto: 'OSPF', cmd: 'neighbor [ip] priority [val]',
    desc: 'Manually defines a neighbor in Non-Broadcast Multi-Access (NBMA) networks where multicasts do not work.',
    example: `R-Hub(config-router)# neighbor 10.1.1.2 priority 1
R-Hub(config-router)# neighbor 10.1.1.3 priority 0

R-Hub# show ip ospf neighbor
Neighbor ID  Pri State    Dead Time  Address    Interface
2.2.2.2      1   FULL/-   00:01:34   10.1.1.2   Se0/0
3.3.3.3      0   FULL/-   00:01:32   10.1.1.3   Se0/0

What it means:
- On NBMA media (Frame Relay, classic ATM) Hellos use unicast — the
  hub must know its spokes by IP.
- priority 0 forbids the spoke from ever becoming DR (good practice;
  hub is always DR on NBMA).` },

  { proto: 'OSPF', cmd: 'show ip ospf rib',
    desc: 'Displays the OSPF Route Information Base, showing the candidate paths before they are injected into the global routing table.',
    example: `R1# show ip ospf rib

OSPF Router with ID (1.1.1.1) (Process ID 1)
        Base Topology (MTID 0)

OSPF local RIB
Codes: * - Best, > - Installed in global RIB

*>  10.2.2.0/24, Intra, cost 2, area 0
       SPF Instance 5, age 00:02:14
       Flags: RIB
       via 192.168.1.2, GigabitEthernet0/0

What it means:
- Internal OSPF table — what SPF computed before any AD/metric battle
  with other protocols.
- "*>" means this is OSPF's best path AND it won the global RIB
  install battle. "*" alone = best in OSPF but lost to another proto.` },

  { proto: 'OSPF', cmd: 'ip ospf transmit-delay [sec]',
    desc: 'Estimates the time to send an LSA, adding this delay to the LSA age to maintain clock synchronization across slow links.',
    example: `R1(config-if)# ip ospf transmit-delay 5

R1# show ip ospf interface Gi0/0 | include Transmit
  Transmit Delay is 5 sec, State BDR, Priority 1

What it means:
- Each hop along the flood path adds this value to the LSA's "age"
  field so receivers compute consistent ages on slow / high-jitter
  links (think satellite, low-bw serial).
- 1 second is the safe default for 99% of topologies.` },

  { proto: 'OSPF', cmd: 'ip ospf retransmit-interval [sec]',
    desc: 'Sets how long to wait for an LSA acknowledgement before sending the update again; used on high-latency links.',
    example: `R1(config-if)# ip ospf retransmit-interval 5

R1# show ip ospf interface Gi0/0 | include Retransmit
  Hello 10, Dead 40, Wait 40, Retransmit 5

What it means:
- If a flooded LSA is not acknowledged within 5 s, the local router
  resends it to that neighbour.
- Bump up on high-latency satellite/long-haul links to avoid
  spurious retransmissions; lower it on LAN to converge faster.` },

  { proto: 'OSPF', cmd: 'log-adj-changes [detail]',
    desc: 'Triggers a syslog message every time a neighbor goes Up or Down; the detail flag shows the reason (e.g., timer expired).',
    example: `R1(config-router)# log-adjacency-changes detail

%OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Gi0/0 from FULL
   to DOWN, Neighbor Down: Dead timer expired

What it means:
- Without "detail" you only see FULL→2WAY/DOWN; with detail you also
  see EXSTART, EXCHANGE, LOADING transitions and the trigger reason.
- Essential for post-hoc adjacency-flap forensics without leaving
  debug ip ospf adj running.` },

  { proto: 'OSPF', cmd: 'show ip ospf sham-links',
    desc: 'Verifies OSPF Sham-links used in MPLS VPNs to make a provider network look like an internal OSPF link.',
    example: `R-PE# show ip ospf sham-links
Sham Link OSPF_SL0 to address 2.2.2.2 is up
   Area 0 source address 1.1.1.1
   Cost of using 1, State POINT_TO_POINT
   Adjacency State FULL

What it means:
- A sham-link is an intra-area OSPF tunnel between two PEs over the
  MPLS-VPN backbone — makes the customer routes look like genuine
  intra-area paths so they win against the inter-area MPLS path.
- Built using BGP-learned /32s as the tunnel endpoints. Used for
  OSPF-as-PE-CE deployments.` },

  { proto: 'OSPF', cmd: 'area [id] filter-list prefix [name] in',
    desc: 'Filters specific Type-3 LSAs at the ABR to prevent certain subnets from entering an area.',
    example: `R-ABR(config)# ip prefix-list NO-CORP seq 10 deny 10.99.0.0/16
R-ABR(config)# ip prefix-list NO-CORP seq 20 permit 0.0.0.0/0 le 32
R-ABR(config-router)# area 1 filter-list prefix NO-CORP in

R-ABR# show ip ospf | include Filter
   Area 1, Type-3 LSA filter is NO-CORP in

What it means:
- Filters which Type-3 (inter-area) LSAs are allowed INTO area 1
  (use "out" for the opposite direction).
- Common use: hide management subnets from a customer area without
  changing the LSA flooding domain anywhere else.` },

  { proto: 'OSPF', cmd: 'nsf',
    desc: 'Enables Non-Stop Forwarding, allowing a router with dual supervisors to continue forwarding traffic during a failover.',
    example: `R1(config-router)# nsf

R1# show ip ospf | include Non-Stop
 Non-Stop Forwarding enabled, last NSF restart 00:00:00 ago (took 12 secs)

What it means:
- During a route-processor (RP) switchover, the data plane keeps
  forwarding on the existing FIB while the new RP rebuilds OSPF
  state with help from neighbours running graceful-restart.
- Cisco-specific (Cisco NSF) and IETF-standard (graceful-restart)
  variants exist — both ends must agree which to use.` },

  { proto: 'OSPF', cmd: 'show ip ospf nsf',
    desc: 'Displays the status of NSF, verifying if neighbors are NSF-aware and will help maintain the adjacency during a crash.',
    example: `R1# show ip ospf nsf

  Non-Stop Forwarding enabled
  IETF NSF helper support enabled
  Cisco NSF helper support enabled
  OSPF Process 1
  Last NSF restart 00:00:00 ago (took 0 secs)
  Neighbor 2.2.2.2: NSF-aware
  Neighbor 3.3.3.3: not NSF-aware

What it means:
- "NSF-aware" peers will hold the adjacency in helper-mode during
  this router's RP failover instead of dropping it.
- A "not NSF-aware" neighbour is a single point of failure for
  graceful restart — the adjacency will reset during a failover.` },

  { proto: 'OSPF', cmd: 'timers throttle lsa [start] [hold] [max]',
    desc: 'Controls the rate of LSA generation, preventing the router from flooding the network during a flapping event.',
    example: `R1(config-router)# timers throttle lsa 0 5000 5000

R1# show ip ospf | include LSA throttle
 Initial LSA throttle delay 0 msecs
 Minimum hold time for LSA throttle 5000 msecs
 Maximum wait time for LSA throttle 5000 msecs

What it means:
- start (0)   : delay before originating the first LSA after a change.
- hold (5000) : minimum interval between successive LSA originations
                for the same LSA. Doubles each occurrence within window.
- max  (5000) : ceiling on the hold value during a storm.
- Protects the network during link flapping while keeping the first
  change instant.` },

  { proto: 'OSPF', cmd: 'timers lsa-arrival [msec]',
    desc: 'Sets the minimum interval between receiving the same LSA; used to protect the CPU from LSA storms.',
    example: `R1(config-router)# timers lsa-arrival 1000

R1# show ip ospf | include arrival
 Minimum LSA arrival 1000 msecs

What it means:
- LSAs of the same type+ID arriving sooner than 1000 ms after the
  previous one are silently dropped — back-pressure against a
  misbehaving / flapping neighbour.
- Should be smaller than the originator's hold-time, otherwise valid
  rapid changes are missed. Pair with "timers throttle lsa".` },

  { proto: 'OSPF', cmd: 'show ip ospf max-metric',
    desc: 'Checks if the router is in Stub Router mode, which is helpful for verifying maintenance windows.',
    example: `R1# show ip ospf max-metric

OSPF Router with ID (1.1.1.1) (Process ID 1)
   Originating router-LSA with maximum metric
   Time remaining: 00:04:45
   Condition: on startup, State: active

What it means:
- Confirms "max-metric router-lsa" is currently advertising 0xFFFF
  on transit links — traffic is being routed around this box.
- "Time remaining" counts down the on-startup or on-shutdown timer.` },

  { proto: 'OSPF', cmd: 'distribute-list [id] in',
    desc: 'Filters routes from being put into the Routing Table, though the LSA remains in the OSPF database.',
    example: `R1(config)# access-list 10 deny  10.99.0.0 0.0.255.255
R1(config)# access-list 10 permit any
R1(config-router)# distribute-list 10 in

R1# show ip route ospf | include 10.99
(nothing — filtered out of RIB)
R1# show ip ospf database | include 10.99
... LSA still present ...

What it means:
- "in" = filters which OSPF-learned routes get installed in the local
  RIB. The LSDB is unaffected — neighbours still see the prefix.
- Use to suppress installation of specific prefixes locally without
  causing inconsistent topology calculations elsewhere.` },

  { proto: 'OSPF', cmd: 'ip ospf resync-timeout [sec]',
    desc: 'Sets the timeout for an OSPF neighbor resync, typically used during Graceful Restart events.',
    example: `R1(config-router)# ip ospf resync-timeout 40

R1# show ip ospf | include resync
 Graceful restart helper resync timeout 40 secs

What it means:
- Maximum time the helper neighbour will hold an adjacency in
  graceful-restart "RESTARTING" state while waiting for the LSDB
  resync to finish.
- If the restarting peer doesn't finish within 40 s, the helper
  declares the GR failed and tears the adjacency down.` },

  { proto: 'OSPF', cmd: 'area [id] default-cost [value]',
    desc: 'Sets the cost for default routes sent into Stub or NSSA areas to influence path selection.',
    example: `R-ABR(config-router)# area 1 default-cost 10

R-internal# show ip route ospf | include 0.0.0.0
O*IA 0.0.0.0/0 [110/11] via 10.1.1.1, Gi0/0  ← cost 10 + 1 link cost

What it means:
- Sets the metric of the default route the ABR injects into a stub
  or NSSA area.
- When two ABRs both inject the default, internal routers pick the
  one with the lowest total cost — this knob lets you steer them.` },

  { proto: 'OSPF', cmd: 'ip ospf name-lookup',
    desc: 'Resolves Router IDs to DNS names in show commands, making it easier to identify physical devices.',
    example: `R1(config)# ip ospf name-lookup
R1(config)# ip name-server 10.1.1.10

R1# show ip ospf neighbor
Neighbor ID         Pri State     Dead Time  Address     Interface
core-edge-01.lab    1   FULL/BDR  00:00:34   10.1.1.2    Gi0/0
        (was 2.2.2.2)

What it means:
- Adds reverse-DNS lookups for router-ids in OSPF show output.
- Cosmetic-only — the LSDB still indexes by router-id. Requires DNS
  reachability and PTR records for the loopback IPs.` },

  { proto: 'OSPF', cmd: 'prefix-suppression',
    desc: 'Hides transit interface IPs from the routing table to reduce LSA flooding and routing table size.',
    example: `R1(config-router)# prefix-suppression

R1# show ip ospf | include suppression
 Prefix suppression is enabled

What it means:
- Transit-link prefixes (point-to-point /30s and /31s between routers)
  are no longer advertised in Type-1 LSAs. Only loopbacks remain.
- Reduces LSA size and routing-table bloat in large IGP domains.
  Loopback /32s are NOT suppressed (they're still reachable for
  iBGP / MPLS / LDP).` },

  { proto: 'OSPF', cmd: 'area [id] nssa translate type7 always',
    desc: 'Forces Type-7 to Type-5 LSA translation at the NSSA ABR, even if it is not the primary translator.',
    example: `R-ABR(config-router)# area 1 nssa translate type7 always

R-ABR# show ip ospf | include Translator
   Area 1 NSSA: Translator state: Always Enabled

What it means:
- Normally only one ABR per NSSA acts as the Type-7→Type-5 translator
  (elected by highest router-id).
- "always" forces this router to translate regardless of the election,
  which is useful for redundancy or to override a misbehaving peer.
- Be careful: with multiple "always" translators you can produce
  duplicate Type-5 LSAs.` },

  { proto: 'OSPF', cmd: 'show ip ospf mpls ldp interface',
    desc: 'Checks OSPF/LDP synchronization status to ensure MPLS labels are ready before OSPF starts routing.',
    example: `R1# show ip ospf mpls ldp interface

GigabitEthernet0/0
  Process ID 1, Area 0
  LDP is configured through LDP autoconfig
  LDP-IGP Synchronization : Yes
  Holddown timer is disabled
  Interface is up

What it means:
- "LDP-IGP Synchronization : Yes" means OSPF will hold this link at
  max-metric until LDP signals labels are programmed.
- Prevents black-holing during MPLS LSP convergence after a link
  flap — IGP would otherwise route over a link with no labels yet.` },

  { proto: 'OSPF', cmd: 'mpls ldp autoconfig',
    desc: 'Automatically enables MPLS LDP on all OSPF-enabled interfaces, simplifying MPLS deployment.',
    example: `R1(config-router)# mpls ldp autoconfig

R1# show mpls ldp discovery
 Local LDP Identifier: 1.1.1.1:0
   Discovery Sources:
   Interfaces:
     GigabitEthernet0/0 (ldp): xmit/recv
       LDP Id: 2.2.2.2:0; Src IP addr: 192.168.1.2

What it means:
- LDP starts on every OSPF-enabled interface automatically (no need
  for "mpls ip" on each one).
- "xmit/recv" confirms the LDP discovery hello is bidirectional.
- Pair with "mpls ldp sync" so LDP/IGP convergence stays consistent.` },

  { proto: 'OSPF', cmd: 'ospfv3 authentication key-chain [name]',
    desc: 'Applies sophisticated key rotation for OSPFv3 (IPv6), allowing passwords to change without downtime.',
    example: `R1(config-if)# ospfv3 authentication key-chain OSPF6-KEYS

R1# show ipv6 ospf interface Gi0/0 | include Authentication
  Authentication: Key chain 'OSPF6-KEYS', SHA-256

What it means:
- Replaces classic IPsec auth on OSPFv3 with key-chain-based
  authentication (HMAC-SHA-256/384/512).
- The key-chain supports time-based rollover so multiple keys are
  valid during a transition window — graceful key rotation.` },

  { proto: 'OSPF', cmd: 'show ipv6 ospf database router',
    desc: 'Drills into Type-1 LSAs for IPv6, showing the detailed link-state information for a specific IPv6 router.',
    example: `R1# show ipv6 ospf database router

  OSPFv3 Router with ID (1.1.1.1) (Process ID 1)
                Router Link States (Area 0)
  LS age: 412
  Options: V6, E, R, MC
  LS Type: Router Links
  Link State ID: 0
  Advertising Router: 1.1.1.1
  Number of Links: 2
  Link connected to: another Router (point-to-point)
     Link Metric: 1
     Local Interface ID: 3
     Neighbor Interface ID: 5
     Neighbor Router ID: 2.2.2.2

What it means:
- OSPFv3's Type-1 LSA carries Interface IDs (not subnets) — IPv6
  prefixes live in separate Type-9/Type-10 link-LSAs.
- Each "Link" entry describes one adjacency the originator has.` },

  { proto: 'OSPF', cmd: 'ip ospf adjacency stale-limit [sec]',
    desc: 'Sets the timer for stale adjacencies during a Graceful Restart before the neighbor is purged.',
    example: `R1(config-router)# ip ospf adjacency stale-limit 360

R1# show ip ospf | include stale
   Stale-limit timer is 360 seconds

What it means:
- During Graceful Restart, "stale" adjacencies (LSDB resync not yet
  complete) are kept alive for up to 360 s.
- After the limit, the helper declares GR failed and tears the
  adjacency down — useful as a safety net against partial GR hangs.` },

  { proto: 'OSPF', cmd: 'area [id] virtual-link [rid] hello-interval [sec]',
    desc: 'Customizes timers for virtual links to maintain stability across high-latency transit areas.',
    example: `R-ABR(config-router)# area 1 virtual-link 3.3.3.3 hello-interval 10 dead-interval 40

R-ABR# show ip ospf virtual-links | include Hello
  Hello 10, Dead 40, Wait 40, Retransmit 5

What it means:
- VLs default to 30/120 hello/dead — too slow for many topologies.
- Tune them to match the IGP convergence target. Both VL endpoints
  must have identical timers.` },

  { proto: 'OSPF', cmd: 'max-lsa [number]',
    desc: 'Limits the total number of LSAs a process will accept, protecting the router from memory exhaustion.',
    example: `R1(config-router)# max-lsa 10000

R1# show ip ospf | include Maximum
 Maximum number of non self-generated LSA allowed 10000

%OSPF-4-NON_SELF_LSA_THRESHOLD: Threshold 75% reached
%OSPF-3-NON_SELF_LSA_LIMIT_REACHED: Maximum LSA limit reached

What it means:
- Hard ceiling on third-party LSAs the process will hold. Beyond the
  limit OSPF goes into "ignore" state and drops adjacencies for 5 min.
- Defends against rogue routers flooding the LSDB. Threshold warnings
  arrive at 75% (default) before the limit is hit.` },

  { proto: 'OSPF', cmd: 'ospfv3 flood-reduction',
    desc: 'Optimizes LSA flooding for IPv6, similar to the IPv4 version, to reduce control plane traffic.',
    example: `R1(config-if)# ospfv3 flood-reduction

R1# show ipv6 ospf interface Gi0/0 | include Flood
  Flood reduction is enabled

What it means:
- IPv6 equivalent of "ip ospf flood-reduction": LSAs are tagged
  DoNotAge so the 30-min refresh interval is suppressed on stable
  links.
- Topology-change LSAs still flow normally.` },

  { proto: 'OSPF', cmd: 'show ip ospf topology-info',
    desc: 'Displays Multi-Topology Routing (MTR) info, showing how OSPF handles separate routing tables.',
    example: `R1# show ip ospf topology-info

OSPF Process 1
  Topology Name: Base
  Topology ID: 0
  Routing Table: Base RIB

  Topology Name: VOICE
  Topology ID: 32
  Routing Table: VOICE RIB

What it means:
- MTR (Multi-Topology Routing) lets OSPF maintain multiple parallel
  topologies — useful for separating voice/video from data while
  using the same OSPF process.
- Topology ID 0 is the default Base topology.` },

  { proto: 'OSPF', cmd: 'compatible rfc1583',
    desc: 'Ensures compatibility with older OSPF RFCs; often used to resolve path selection issues with legacy gear.',
    example: `R1(config-router)# compatible rfc1583

R1# show ip ospf | include RFC
 Supports area transit capability
 Compatible with RFC 1583

What it means:
- RFC 1583 (1994) had different rules for picking between two paths
  to an inter-area destination than RFC 2328.
- Mixing 1583 and 2328 in the same OSPF domain can produce loops —
  set this consistently across all routers (default differs by IOS).` },

  { proto: 'OSPF', cmd: 'show ip ospf fast-reroute ti-lfa',
    desc: 'Verifies Topology-Independent LFA, the most advanced form of fast-reroute for sub-50ms failover.',
    example: `R1# show ip ospf fast-reroute ti-lfa

OSPF Process 1, Area 0
  TI-LFA: Enabled
  Protected prefixes: 142
  Computed paths    : 138 (97% coverage)
  10.2.2.0/24  Protector: 10.1.1.2  Backup: SR-Path 16012-16022

What it means:
- TI-LFA leverages Segment Routing labels to compute a 100%-coverage
  backup path (classic LFA only protects ~80% of prefixes).
- "Backup: SR-Path 16012-16022" is the explicit label stack pushed
  on the failed-over packet to steer it around the broken link.` },

  { proto: 'OSPF', cmd: 'area [id] nssa default-information-originate',
    desc: 'Generates a default route into an NSSA, as NSSAs do not automatically receive one like Stub areas do.',
    example: `R-ABR(config-router)# area 1 nssa default-information-originate metric 10

R-internal# show ip route ospf | include 0.0.0.0
O*N2 0.0.0.0/0 [110/10] via 10.1.1.1, 00:01:30, Gi0/0

What it means:
- NSSAs do NOT auto-inject a default the way regular stubs do; you
  must explicitly turn it on at the ABR.
- Type-7 default propagates inside the NSSA, then the ABR translates
  it to Type-5 (or stops it if you also added "no-summary").` },

  { proto: 'OSPF', cmd: 'ip ospf lls',
    desc: 'Enables Link-Local Signaling, which allows OSPF to exchange extra data during the Hello process.',
    example: `R1(config-router)# capability lls

R1# show ip ospf neighbor detail | include LLS
   LLS Options is 0x1 (LR)

What it means:
- LLS (Link-Local Signaling) is a TLV-based extension to OSPF Hellos
  that conveys capabilities like graceful-restart support and OOB
  resync without polluting the LSDB.
- "LR" flag = peer supports OSPF graceful-restart (RFC 5613).` },

  { proto: 'OSPF', cmd: 'show ip ospf request-list [rid]',
    desc: 'Displays LSAs a router is currently asking for from a neighbor during the loading process.',
    example: `R1# show ip ospf request-list 2.2.2.2 Gi0/0

OSPF Router with ID (1.1.1.1) (Process ID 1)
Neighbor 2.2.2.2, interface GigabitEthernet0/0 address 192.168.1.2
Type  LS ID         ADV RTR        Seq NO     Age    Checksum
1     3.3.3.3       3.3.3.3        0x80000004 12     0x4321
1     4.4.4.4       4.4.4.4        0x80000003 14     0x9876

What it means:
- During EXCHANGE/LOADING, the router builds a list of LSAs it needs
  from each neighbour and sends LSR (Link State Request) packets.
- A non-empty list during steady-state suggests an LSR/LSU loop —
  often a checksum or sequence-number bug. Bounce the adjacency.` },

  { proto: 'OSPF', cmd: 'show ip ospf retransmission-list [rid]',
    desc: 'Shows LSAs that have not been acknowledged by a neighbor and are waiting to be resent.',
    example: `R1# show ip ospf retransmission-list 2.2.2.2 Gi0/0

OSPF Router with ID (1.1.1.1) (Process ID 1)
Neighbor 2.2.2.2, interface GigabitEthernet0/0
Link state retransmission due in 432 msec, Queue length 0

What it means:
- LSAs we sent to neighbour 2.2.2.2 but for which we have not yet
  received an LSAck.
- Queue length consistently > 0 indicates packet loss or an MTU
  problem on the path between the two routers.` },

  { proto: 'OSPF', cmd: 'ospfv3 area [id] range [prefix] advertise',
    desc: 'Configures IPv6 route summarization at the ABR level to optimize the IPv6 routing table.',
    example: `R-ABR(config-router)# address-family ipv6 unicast
R-ABR(config-router-af)# area 1 range 2001:DB8::/32 advertise

R# show ipv6 route ospf | include 2001:DB8
OI 2001:DB8::/32 [110/2] via FE80::1, Gi0/0

What it means:
- "advertise" = aggregate Type-3 LSAs for /32 into a single summary
  pushed to other areas. Use "not-advertise" to suppress entirely.
- ABR auto-installs a Null0 discard route locally to prevent
  black-hole loops.` },

  { proto: 'OSPF', cmd: 'ip ospf message-digest-key [id] md5 [key]',
    desc: 'Configures the specific MD5 key used for neighbor authentication on a per-interface basis.',
    example: `R1(config-if)# ip ospf message-digest-key 1 md5 SECRET2026
R1(config-if)# ip ospf message-digest-key 2 md5 NEXT-SECRET   ! during rotation

R1# show ip ospf interface Gi0/0 | section authentication
  Cryptographic authentication enabled
    Youngest key id is 2

What it means:
- key id   : numeric identifier; lets you rotate keys gracefully by
             configuring both old + new on each side simultaneously.
- "Youngest key id is 2" means the router is using key 2 to send and
  will accept either key 1 or 2 inbound.` },

  { proto: 'OSPF', cmd: 'timers pacing lsa-group [sec]',
    desc: 'Groups LSA refreshes together to reduce the number of individual packets sent to neighbors.',
    example: `R1(config-router)# timers pacing lsa-group 240

R1# show ip ospf | include LSA group
 LSA group pacing timer 240 secs

What it means:
- LSAs that need refreshing within a 240 s window are batched into
  one flood event — fewer LSU packets and Acks on the wire.
- 240 s is the modern default; older IOS used 30 s. Tune higher on
  very large LSDBs to reduce flood overhead.` },

  { proto: 'OSPF', cmd: 'show ip ospf neighbor detail',
    desc: 'Provides granular info on neighbors, including their DR/BDR status and specific OSPF capabilities.',
    example: `R1# show ip ospf neighbor detail

 Neighbor 2.2.2.2, interface address 192.168.1.2
    In the area 0 via interface GigabitEthernet0/0
    Neighbor priority is 1, State is FULL, 6 state changes
    DR is 192.168.1.2 BDR is 192.168.1.1
    Options is 0x52 in Hello (E-bit, L-bit, DC-bit)
    LLS Options is 0x1 (LR)
    Dead timer due in 00:00:36

What it means:
- Options bits expose what the peer supports: E=external, MC=multicast,
  N=NSSA, DN=DC-bit, O=opaque-LSAs, etc.
- "6 state changes" hints at adjacency stability — high counters on
  long uptimes mean a flapping link.` },

  { proto: 'OSPF', cmd: 'auto-cost reference-bandwidth 10000',
    desc: 'Sets the reference for 10Gbps links, ensuring that 10G interfaces have a lower cost than 1G interfaces.',
    example: `R1(config-router)# auto-cost reference-bandwidth 10000

R1# show ip ospf | include Reference
 Reference bandwidth unit is 10000 mbps

# Resulting costs:
#  10G  -> 1
#   1G  -> 10
# 100M  -> 100

What it means:
- Same purpose as "auto-cost ref-bandwidth" but explicitly set to
  10 Gbps so 10G links don't tie with 1G at cost 1.
- MUST match on every OSPF router in the domain.` },

  { proto: 'OSPF', cmd: 'ip ospf network point-to-multipoint',
    desc: 'Handles Hub-and-Spoke networks where spoke routers cannot see each other directly.',
    example: `R-Hub(config-if)# ip ospf network point-to-multipoint

R-Hub# show ip ospf interface Tu0 | include Network Type
  Network Type POINT_TO_MULTIPOINT, Cost: 64

What it means:
- No DR/BDR election. The hub treats each spoke as a separate /32
  point-to-point neighbour.
- LSAs are flooded to every neighbour individually — works on
  partial-mesh topologies (DMVPN spokes that can't reach each other).
- Costs higher than P2P (64 vs 1) by default, reflecting the lower
  reliability of partial-mesh underlays.` },

  { proto: 'OSPF', cmd: 'area [id] nssa no-redistribution',
    desc: 'Prevents redistributed routes from being sent into a specific NSSA while allowing them elsewhere.',
    example: `R-ASBR-ABR(config-router)# area 1 nssa no-redistribution

R-ASBR-ABR# show ip ospf | include nssa
   Area 1 is NSSA, no-redistribution

What it means:
- This router is BOTH an ABR for area 1 AND an ASBR redistributing
  external routes. Without the flag, those externals leak into
  area 1 as Type-7s, against the NSSA's purpose.
- "no-redistribution" tells the router: keep external redistribution
  for the rest of the domain, but DO NOT inject those externals into
  area 1.` },

  { proto: 'OSPF', cmd: 'show ip ospf events',
    desc: 'Displays a log of OSPF state machine events, useful for finding why an adjacency flap occurred.',
    example: `R1# show ip ospf events

OSPF Router with ID (1.1.1.1) (Process ID 1)

1  Apr 29 15:23:44.000: Generic: ospfv2_router_lsa_updated
2  Apr 29 15:23:44.000: Generic: ospfv2_schedule_spf
3  Apr 29 15:23:44.005: Generic: ospfv2_running_spf_intra
4  Apr 29 15:23:44.012: Generic: ospfv2_running_spf_summary
5  Apr 29 15:24:08.231: Generic: ospfv2_neighbor_event_2WAY
6  Apr 29 15:24:08.231: Generic: ospfv2_neighbor_event_EXSTART

What it means:
- Ring buffer of recent OSPF state-machine events with sub-ms
  timestamps.
- Cheaper than running "debug ip ospf adj" for post-mortem analysis
  of a flap that has already happened.` },

  { proto: 'OSPF', cmd: 'ipv6 router ospf [id] area [id] range [prefix] not-advertise',
    desc: 'Suppresses specific IPv6 ranges from being advertised into other areas (IPv6 Route Filtering).',
    example: `R-ABR(config)# ipv6 router ospf 1
R-ABR(config-rtr)# area 1 range 2001:DB8:1::/48 not-advertise

R# show ipv6 route ospf | include 2001:DB8:1
(nothing — suppressed)

What it means:
- "not-advertise" = the ABR consumes the more-specific Type-3 LSAs
  for the range but does NOT generate a summary for other areas.
- Effectively a black-hole on the ABR for any traffic sent to
  unallocated portions of the suppressed range.` },

  // ============================== EIGRP (100 supplied → 97 unique) ==============================
  { proto: 'EIGRP', cmd: 'router eigrp [as-number]',
    desc: 'Enables the EIGRP process for a specific Autonomous System (AS). Neighbors must match this number to form an adjacency.',
    example: `R1(config)# router eigrp 100
R1(config-router)#

What it means:
- "100" is the EIGRP AS number. Unlike OSPF's process ID, this MUST
  match between every router that wants to peer — different AS = no
  adjacency, full stop.
- Classic Mode syntax (vs Named Mode "router eigrp <name>"). Most
  modern deployments are Named Mode now.` },

  { proto: 'EIGRP', cmd: 'network [net] [wildcard]',
    desc: 'Activates EIGRP on interfaces matching the subnet. The wildcard mask allows for granular control over which ports participate.',
    example: `R1(config-router)# network 192.168.1.0 0.0.0.255

R1# show ip eigrp interfaces
EIGRP-IPv4 Interfaces for AS(100)
                  Xmit Queue   PeerQ        Mean
Interface  Peers  Un/Reliable  Un/Reliable  SRTT
Gi0/0      1      0/0          0/0          1

What it means:
- 192.168.1.0   : network to match
- 0.0.0.255     : EIGRP wildcard mask (inverse of subnet mask). Any
                  interface with a primary IP inside 192.168.1.0/24
                  becomes EIGRP-active.
- Without the wildcard you'd get classful matching — every interface
  in the entire 192.168.0.0/16 classful net would activate.` },

  { proto: 'EIGRP', cmd: 'eigrp router-id [a.b.c.d]',
    desc: 'Sets a unique identifier for the router; helps in identifying the source of external routes and preventing loops.',
    example: `R1(config-router)# eigrp router-id 1.1.1.1

R1# show ip eigrp topology | include Router ID
EIGRP-IPv4 Topology Table for AS(100)/ID(1.1.1.1)

What it means:
- 32-bit identifier in dotted-quad form. Distinct from the AS number.
- Critical when EIGRP redistributes from another protocol — the
  router-id is encoded into external routes to detect routing loops.
- If two routers share the same router-id, externals from one will
  be silently dropped by the other. Always set manually.` },

  { proto: 'EIGRP', cmd: 'no auto-summary',
    desc: 'Disables classful summarization, ensuring subnets are advertised with their actual masks (essential for modern VLSM networks).',
    example: `R1(config-router)# no auto-summary

R# show ip route eigrp
D 10.1.1.0/24 [90/2816] via 192.168.1.2, Gi0/0   ← actual /24
D 10.2.2.0/24 [90/3072] via 192.168.1.2, Gi0/0   ← actual /24

What it means:
- With auto-summary ON (legacy default), 10.1.1.0/24 and 10.2.2.0/24
  would BOTH be advertised as 10.0.0.0/8 the moment the route crossed
  a classful boundary, breaking VLSM.
- "no auto-summary" tells EIGRP to honour the original prefix length.
- Default is now OFF on modern IOS, but always include the line for
  config clarity and to be safe on older platforms.` },

  { proto: 'EIGRP', cmd: 'passive-interface [int]',
    desc: 'Prevents EIGRP Hellos from being sent out an interface while still including that interface\'s subnet in routing updates.',
    example: `R1(config-router)# passive-interface GigabitEthernet0/1

R1# show ip eigrp interfaces
                  Xmit Queue   PeerQ        Mean
Interface  Peers  Un/Reliable  Un/Reliable  SRTT
Gi0/0      1      0/0          0/0          1
                              ! Gi0/1 not listed → passive

What it means:
- Hellos are NOT sent out Gi0/1 → no neighbour can ever form on that
  port, even if a real EIGRP speaker is connected.
- The Gi0/1 subnet is still advertised to neighbours formed on other
  interfaces — the network statement still applies.
- Use on user-LAN ports facing untrusted segments.` },

  { proto: 'EIGRP', cmd: 'maximum-paths [1-32]',
    desc: 'Enables Equal Cost Multi-Path (ECMP), allowing the router to install multiple paths to the same destination in the routing table.',
    example: `R1(config-router)# maximum-paths 4

R1# show ip route eigrp | include 10.1.1.0
D    10.1.1.0/24 [90/2816] via 192.168.1.2, Gi0/0
                 [90/2816] via 192.168.2.2, Gi0/1
                 [90/2816] via 192.168.3.2, Gi0/2

What it means:
- Default is 4. Bumping to higher values lets you load-share over more
  parallel paths to the same destination.
- Only paths with the same FD (Feasible Distance) qualify for ECMP.
- For unequal-cost balancing, combine with "variance".` },

  { proto: 'EIGRP', cmd: 'variance [multiplier]',
    desc: 'Enables Unequal Cost Load Balancing, allowing EIGRP to use backup paths with a higher metric than the successor.',
    example: `R1(config-router)# variance 2

R1# show ip route eigrp | include 10.1.1.0
D    10.1.1.0/24 [90/2816] via 192.168.1.2, Gi0/0     ← successor
                 [90/4500] via 192.168.2.2, Gi0/1     ← within variance

What it means:
- Variance N installs any path whose metric ≤ N × successor's metric,
  provided it is still loop-free (Feasibility Condition met).
- variance 2 with successor FD 2816 → accepts paths up to FD 5632.
- Traffic is load-shared in inverse proportion to metric (more weight
  to the lower-metric path).` },

  { proto: 'EIGRP', cmd: 'metric weights 0 [k1 k2 k3 k4 k5]',
    desc: 'Modifies the K-values used to calculate the EIGRP metric (default is Bandwidth and Delay). Neighbors must match these.',
    example: `R1(config-router)# metric weights 0 1 0 1 0 0

R1# show ip protocols | include K
  EIGRP metric weight K1=1, K2=0, K3=1, K4=0, K5=0

What it means:
- Default metric = K1*BW + K3*Delay (K1=K3=1, others=0). Output above
  shows the defaults — never change without strong justification.
- K-values MUST match between every router in the AS, otherwise no
  adjacency forms. Mismatches show up as
  %DUAL-5-NBRCHANGE: K-value mismatch.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp neighbors',
    desc: 'Verifies neighbor adjacencies, showing the Hold Time, Uptime, and Queue count for each peer.',
    example: `R1# show ip eigrp neighbors

EIGRP-IPv4 Neighbors for AS(100)
H  Address    Interface  Hold Uptime    SRTT  RTO  Q   Seq Num
                                  (sec)         (ms)      Cnt
0  10.1.1.2   Gi0/0      12   00:04:15  4     100  0   12

What it means:
- H        : neighbour handle (slot number).
- Hold     : seconds left before adjacency is declared dead. Resets
             on each Hello arrival.
- Uptime   : how long the adjacency has been UP.
- SRTT     : Smoothed Round-Trip Time to the peer (used to size RTO).
- Q Cnt    : queued unacknowledged packets. Should be 0; >0 hints at
             packet loss or peer overload.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp topology',
    desc: 'Displays the Topology Table, listing Successors and Feasible Successors (backup routes).',
    example: `R1# show ip eigrp topology

EIGRP-IPv4 Topology Table for AS(100)/ID(1.1.1.1)
Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply

P 10.2.2.0/24, 1 successors, FD is 2816, serno 12
        via 10.1.1.2 (2816/2570), GigabitEthernet0/0
        via 10.1.1.3 (3500/2570), GigabitEthernet0/1   ← FS

What it means:
- P (Passive) = stable; the route is in steady state.
- FD (Feasible Distance) : best metric this router computed.
- (2816/2570)            : (FD via this neighbour / Reported Distance
                             that neighbour advertised).
- A path qualifies as a Feasible Successor when its RD < this router's
  current FD — guarantees loop-free backup.` },

  { proto: 'EIGRP', cmd: 'ip hello-interval eigrp [as] [sec]',
    desc: 'Adjusts how often Hellos are sent; useful for tuning convergence on very fast or very slow links.',
    example: `R1(config-if)# ip hello-interval eigrp 100 5

R1# show ip eigrp interfaces detail Gi0/0 | include Hello
  Hello-interval is 5, Hold-time is 15

What it means:
- Default Hello = 5 s (LAN/HSRP-fast media) or 60 s (NBMA ≤T1).
- Lower Hello = faster failure detection but more PPS overhead.
- Hold-time defaults to 3× hello and is NOT auto-adjusted — set
  ip hold-time eigrp explicitly when you change Hello.` },

  { proto: 'EIGRP', cmd: 'ip hold-time eigrp [as] [sec]',
    desc: 'Sets the expiration timer for a neighbor; if no Hello is received within this time, the neighbor is dropped.',
    example: `R1(config-if)# ip hold-time eigrp 100 15

R1# show ip eigrp interfaces detail Gi0/0 | include Hold
  Hello-interval is 5, Hold-time is 15

What it means:
- 15 s without a Hello → adjacency declared down → topology rerun.
- Best practice: hold = 3 × hello. Hold-time is advertised TO the
  neighbour (each side can use a different value if they want — the
  receiver honours what the sender announced).` },

  { proto: 'EIGRP', cmd: 'ip summary-address eigrp [as] [net] [mask]',
    desc: 'Performs manual summarization at the interface level, reducing the number of routes sent to a specific neighbor.',
    example: `R1(config-if)# ip summary-address eigrp 100 10.0.0.0 255.0.0.0

R1# show ip route eigrp | include Null0
D    10.0.0.0/8 is a summary, 00:00:14, Null0   ← discard route

R-neighbour# show ip route eigrp
D    10.0.0.0/8 [90/2816] via 192.168.1.1, Gi0/0   ← single summary

What it means:
- Sends a single 10.0.0.0/8 to the neighbour instead of every /24
  inside it.
- A Null0 discard route is auto-installed on R1 — any traffic to a
  10.x prefix that doesn't have a more-specific route is dropped
  rather than looping.
- Per-interface granularity — different neighbours can see different
  summary boundaries.` },

  { proto: 'EIGRP', cmd: 'ip bandwidth-percent eigrp [as] [%]',
    desc: 'Limits EIGRP bandwidth usage on an interface to prevent routing traffic from overwhelming data traffic on slow links.',
    example: `R1(config-if)# bandwidth 1544
R1(config-if)# ip bandwidth-percent eigrp 100 20

R1# show ip eigrp interfaces detail Se0/0 | include bandwidth
  Bandwidth percent is 20

What it means:
- EIGRP defaults to using up to 50% of the configured "bandwidth"
  for control-plane traffic.
- "20" caps EIGRP at 20% of 1544 kbps ≈ 308 kbps for hellos / updates
  / queries, leaving more for user data on a sub-rate WAN link.` },

  { proto: 'EIGRP', cmd: 'authentication mode eigrp [as] md5',
    desc: 'Enables MD5 authentication for EIGRP packets to prevent unauthorized routers from peering.',
    example: `R1(config-if)# ip authentication mode eigrp 100 md5
R1(config-if)# ip authentication key-chain eigrp 100 EIGRP-KC

R1# show ip eigrp interfaces detail Gi0/0 | include Authentication
 Authentication mode is md5,  key-chain is "EIGRP-KC"

What it means:
- Activates MD5 HMAC for all EIGRP packets on this interface.
- Requires a key-chain (separate object) to actually carry the key.
- Mismatched configs show as %DUAL-5-NBRCHANGE: Auth failure.` },

  { proto: 'EIGRP', cmd: 'authentication key-chain eigrp [as] [name]',
    desc: 'Links a key-chain to EIGRP, allowing for password rotation and secure communication.',
    example: `R1(config)# key chain EIGRP-KC
R1(config-keychain)# key 1
R1(config-keychain-key)# key-string SECRET2026
R1(config-keychain-key)# accept-lifetime 00:00:00 Jan 1 2026 00:00:00 Jan 1 2027
R1(config-keychain-key)# send-lifetime   00:00:00 Jan 1 2026 23:59:59 Dec 31 2026
R1(config-if)# ip authentication key-chain eigrp 100 EIGRP-KC

What it means:
- Key-chain provides multiple keys with overlapping validity windows
  for hitless rotation.
- accept-lifetime  : when key is valid for INBOUND auth.
- send-lifetime    : when key is used for OUTBOUND auth.
- Stagger windows so old + new keys are valid simultaneously during
  the rotation.` },

  { proto: 'EIGRP', cmd: 'redistribute [protocol] [as]',
    desc: 'Imports routes from other protocols (like OSPF or BGP) into the EIGRP domain.',
    example: `R1(config-router)# redistribute ospf 1 metric 1000 100 255 1 1500

R# show ip route eigrp | include EX
D EX 10.10.10.0/24 [170/2816] via 192.168.1.1, Gi0/0   ← AD 170 = external

What it means:
- "ospf 1" : the source protocol process to import.
- metric values (BW K1, Delay K3, Reliability, Load, MTU) : seed metric
  for the resulting EIGRP advertisements. Without these the routes are
  silently dropped (no default seed for OSPF→EIGRP).
- AD 170 (external) instead of 90 (internal) — EIGRP de-prefers its
  own externals to break redistribution loops.` },

  { proto: 'EIGRP', cmd: 'default-metric [bw] [delay] [rel] [load] [mtu]',
    desc: 'Sets default seed metrics for redistributed routes so EIGRP knows how to calculate their cost.',
    example: `R1(config-router)# default-metric 10000 100 255 1 1500

R1# show ip protocols | include default-metric
  Default redistribution metric is 10000 100 255 1 1500

What it means:
- 10000 : bandwidth in kbps (Kbit/s).
- 100   : delay in tens of microseconds (so 100 = 1 ms).
- 255   : reliability (out of 255; 255 = perfect).
- 1     : load (out of 255; 1 = idle).
- 1500  : MTU in bytes.
- These are used for any "redistribute X" without an explicit metric.` },

  { proto: 'EIGRP', cmd: 'eigrp stub [receive-only|connected|static]',
    desc: 'Configures the router as an EIGRP stub — only advertises the chosen route types and disables transit; reduces query scope dramatically.',
    example: `R1(config-router)# eigrp stub connected static

R# show ip eigrp neighbors detail | include Stub
  Stub Peer Advertising (CONNECTED, STATIC) Routes

What it means:
- A stub router is advertised to peers as "I don't transit traffic"
  — neighbours never send Queries to it during DUAL active state.
- "connected static" = advertise only directly-connected and static
  routes (omit redistributed/EIGRP-learned).
- Critical at scale: stubbing the access-layer dramatically reduces
  query scope and the chances of SIA (Stuck In Active).` },

  { proto: 'EIGRP', cmd: 'clear ip eigrp neighbors',
    desc: 'Hard-resets EIGRP adjacencies, forcing the router to rebuild its neighbor table and topology map.',
    example: `R1# clear ip eigrp neighbors

%DUAL-5-NBRCHANGE: EIGRP-IPv4 100: Neighbor 10.1.1.2 (Gi0/0) is down: manually cleared
%DUAL-5-NBRCHANGE: EIGRP-IPv4 100: Neighbor 10.1.1.2 (Gi0/0) is up: new adjacency

What it means:
- All EIGRP neighbours bounce; topology and routes are rebuilt.
- Disruptive — use only when you've made a config change that needs
  a clean adjacency (e.g. authentication, K-values).
- "clear ip eigrp neighbors 10.1.1.2" resets just one peer.` },

  { proto: 'EIGRP', cmd: 'show ip route eigrp',
    desc: 'Filters the routing table to show only EIGRP-learned routes (marked with D).',
    example: `R1# show ip route eigrp

Codes: D - EIGRP, EX - EIGRP external

D    172.16.1.0/24 [90/3072] via 10.1.1.1, 00:05:12, Gi0/0
D EX 192.0.2.0/24  [170/2816] via 10.1.1.1, 00:05:12, Gi0/0

What it means:
- D    = internal EIGRP (AD 90).
- D EX = external (redistributed in from another protocol; AD 170).
- [90/3072] = AD/metric. Lower wins against other protocols (AD)
  AND against other EIGRP paths (metric).` },

  { proto: 'EIGRP', cmd: 'show ip eigrp interfaces',
    desc: 'Displays EIGRP-active interfaces, showing the number of peers and the mean SRTT (Smooth Round Trip Time).',
    example: `R1# show ip eigrp interfaces

EIGRP-IPv4 Interfaces for AS(100)
                Xmit Queue  PeerQ       Mean   Pacing Time   Multicast
Interface Peers Un/Reliable Un/Reliable SRTT   Un/Reliable   Flow Timer
Gi0/0     1     0/0         0/0         12     0/2           50

What it means:
- Peers       : neighbour count on this interface.
- Xmit Queue  : packets queued for unicast/multicast transmission.
- Mean SRTT   : smoothed RTT to neighbours (ms).
- Multicast Flow Timer : pacing timer for multicast updates (ms).
- Un/Reliable column shows the queue split between unreliable
  (hello) and reliable (update/ack) packets.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp topology all-links',
    desc: 'Shows every known path to a destination, including those that do not meet the Feasibility Condition.',
    example: `R1# show ip eigrp topology all-links

P 192.168.5.0/24, 1 successors, FD is 2816, serno 12
        via 10.1.1.2 (2816/2570), Gi0/0    ← Successor (in RIB)
        via 10.1.1.3 (3500/3000), Gi0/1    ← FS (loop-free backup)
        via 10.1.1.4 (4500/3500), Gi0/2    ← non-FS (RD ≥ FD: not used)

What it means:
- "all-links" reveals paths that didn't pass the Feasibility Condition
  (RD must be < current FD).
- Useful when troubleshooting "missing backup": the path may exist but
  fail the FC and be hidden from normal show output.` },

  { proto: 'EIGRP', cmd: 'debug eigrp packets',
    desc: 'Displays real-time packet flow (Update, Query, Reply, Hello, ACK) to diagnose communication issues.',
    example: `R1# debug eigrp packets
EIGRP Packets debugging is on

EIGRP: Received HELLO on Gi0/0 nbr 10.1.1.2, AS 100
       AS 100, Flags 0x0, Seq 0/0 idbQ 0/0 iidbQ un/rely 0/0
EIGRP: Sent ACK on Gi0/0 nbr 10.1.1.2

What it means:
- Logs every packet by type (HELLO/UPDATE/QUERY/REPLY/ACK).
- Watch for QUERY/REPLY storms during topology change — repeated
  QUERYs to the same neighbour mean DUAL is in active mode (SIA risk).
- Filter to one peer with "debug eigrp packets terse" or use a
  conditional debug.` },

  { proto: 'EIGRP', cmd: 'debug ip eigrp',
    desc: 'Broad debug command for monitoring general EIGRP activity and route processing.',
    example: `R1# debug ip eigrp
IP-EIGRP Route Events debugging is on

IP-EIGRP(Default-IP-Routing-Table:100): 10.2.2.0/24 - do advertise out Gi0/0
IP-EIGRP(Default-IP-Routing-Table:100): Processing incoming UPDATE packet
IP-EIGRP(Default-IP-Routing-Table:100): Int 10.2.2.0/24 M 2816 - 1 1 1 SM 2570 - 1 1 1

What it means:
- Logs every route event — install, withdraw, change.
- "M 2816 - 1 1 1" is the metric breakdown (composite + components).
- "SM" = Successor Metric (best path).
- High volume on busy routers — combine with conditional debug.` },

  { proto: 'EIGRP', cmd: 'debug eigrp fsm',
    desc: 'Logs DUAL Finite State Machine events, crucial for finding why a route is stuck in Active (SIA).',
    example: `R1# debug eigrp fsm
EIGRP FSM Events/Actions debugging is on

DUAL: rcvupdate: 10.5.5.0/24 via 10.1.1.2 metric 3072 - 1 1 1 1500
DUAL: Find FS for dest 10.5.5.0/24. FD is 2816, RD is 2570
DUAL: 10.1.1.2 metric 3072/2816   not found Dmin is 2816
DUAL: Going active, dest 10.5.5.0/24

What it means:
- Walks the DUAL state machine — vital for SIA debugging.
- "Going active" = no Feasible Successor was found, so EIGRP must
  send Queries and wait for Replies before recomputing.
- If subsequent log lines show repeated Queries with no Replies for
  the SIA-timer (default 180s), the adjacency drops with SIA.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp traffic',
    desc: 'Displays statistics on packets sent/received, helping identify if the router is being flooded with updates.',
    example: `R1# show ip eigrp traffic

EIGRP-IPv4 Traffic Statistics for AS(100)
  Hellos sent/received: 521/518
  Updates sent/received: 12/14
  Queries sent/received: 0/0
  Replies sent/received: 0/0
  Acks sent/received: 14/12
  SIA-Queries sent/received: 0/0
  SIA-Replies sent/received: 0/0

What it means:
- A growing Queries/Replies count signals topology churn. SIA-Queries
  > 0 is a serious warning — DUAL is hitting the SIA-timer.
- Hellos sent ≈ Hellos received ratio close to 1:1 means link health
  is fine; a big imbalance hints at unidirectional packet loss.` },

  { proto: 'EIGRP', cmd: 'ip split-horizon eigrp [as]',
    desc: 'Prevents routing loops by not advertising a route back out the interface it was learned from (enabled by default).',
    example: `R1(config-if)# no ip split-horizon eigrp 100

R1# show ip eigrp interfaces detail Gi0/0 | include split
  Split-horizon is disabled

What it means:
- ON by default — a sane loop-prevention rule on point-to-point links.
- MUST be DISABLED on hub-and-spoke NBMA topologies (DMVPN Phase 1)
  where the hub needs to re-advertise spoke A's route to spoke B,
  and they share the same multipoint interface.
- If spokes can't reach each other, this is the first knob to check.` },

  { proto: 'EIGRP', cmd: 'timers active-time [min]',
    desc: 'Adjusts the SIA timer; determines how long the router waits for a Reply to a Query before dropping the neighbor.',
    example: `R1(config-router)# timers active-time 3

R1# show ip protocols | include active
  EIGRP NSF-aware route hold timer is 240
  Active timer = 3 minutes

What it means:
- After the timer expires with no Reply, the route is declared SIA
  (Stuck-In-Active) and the offending adjacency is reset.
- 3 min is the default. Lower it (or use "disabled" with caution) on
  small networks; raise it on huge query domains where a Reply might
  legitimately take longer to come back.` },

  { proto: 'EIGRP', cmd: 'distribute-list [acl] in [int]',
    desc: 'Filters incoming routes at the interface level, preventing certain subnets from entering the topology table.',
    example: `R1(config)# access-list 10 deny  10.99.0.0 0.0.255.255
R1(config)# access-list 10 permit any
R1(config-router)# distribute-list 10 in GigabitEthernet0/0

R1# show ip eigrp topology | include 10.99
(nothing — filtered)

What it means:
- Filters topology-table entries received from the named interface.
- Different from OSPF: EIGRP filters BEFORE topology install, so
  filtered routes never appear in show ip eigrp topology either.
- "permit any" at the end is required (implicit deny otherwise).` },

  { proto: 'EIGRP', cmd: 'distribute-list [acl] out [int]',
    desc: 'Filters outgoing routes, controlling which subnets are advertised to neighbors.',
    example: `R1(config)# access-list 1 deny  10.99.0.0 0.0.255.255
R1(config)# access-list 1 permit any
R1(config-router)# distribute-list 1 out GigabitEthernet0/1

R-neighbour# show ip eigrp topology | include 10.99
(nothing — never advertised)

What it means:
- Filters which prefixes leave this router on the named interface.
- EIGRP packets carrying the filtered routes are simply not sent —
  cheaper than learning then dropping at the receiver.` },

  { proto: 'EIGRP', cmd: 'offset-list [acl] in/out [val]',
    desc: 'Manually increases the metric of specific routes to influence path selection without changing interface bandwidth.',
    example: `R1(config)# access-list 5 permit 10.5.5.0 0.0.0.255
R1(config-router)# offset-list 5 out 1000 GigabitEthernet0/0

R-neighbour# show ip route eigrp | include 10.5.5
D    10.5.5.0/24 [90/3816] via 192.168.1.1, Gi0/0   ← +1000 added

What it means:
- Adds a fixed offset to the metric of routes matching the ACL.
- Use to make this path appear less attractive than another available
  path WITHOUT changing interface bandwidth (which would have side
  effects on QoS, IP SLA, etc.).` },

  { proto: 'EIGRP', cmd: 'ip next-hop-self eigrp [as]',
    desc: 'Forces the router to advertise itself as the next hop; commonly used in Hub-and-Spoke topologies.',
    example: `R-Hub(config-if)# ip next-hop-self eigrp 100

R-spoke# show ip route eigrp
D 10.2.2.0/24 [90/3072] via 10.1.1.1, Gi0/0   ← hub IP, not spoke A

What it means:
- ON by default. EIGRP advertises the path's actual next-hop normally,
  which on a multipoint hub-and-spoke means the hub tells spoke B that
  spoke A is the next hop for spoke A's network.
- Spoke B has no L2 reachability to spoke A on DMVPN Phase 1, so the
  hub MUST keep next-hop-self ON.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp events',
    desc: 'Displays a log of recent EIGRP events, such as route changes or neighbor drops, without using high-CPU debugs.',
    example: `R1# show ip eigrp events

  Event information for AS 100:

1   12:01:05.123 Route 10.1.1.0/24, FD 2816, NHID 1.1.1.1: Reachable
2   12:01:05.123 Route 10.1.1.0/24: Update sent
3   12:00:45.872 Neighbor 10.1.1.2 (Gi0/0): adjacency UP
4   12:00:30.012 Going active for 10.5.5.0/24, FD 2816

What it means:
- Lightweight ring buffer of recent topology / DUAL events with
  sub-second timestamps.
- Far cheaper than running debug eigrp fsm in production.
- Use to confirm post-incident WHY a route went active or a neighbour
  flapped.` },

  { proto: 'EIGRP', cmd: 'eigrp log-neighbor-changes',
    desc: 'Enables syslog messages for neighbor status changes (default in newer IOS).',
    example: `R1(config-router)# eigrp log-neighbor-changes

%DUAL-5-NBRCHANGE: EIGRP-IPv4 100: Neighbor 10.1.1.2 (Gi0/0) is up: new adjacency
%DUAL-5-NBRCHANGE: EIGRP-IPv4 100: Neighbor 10.1.1.2 (Gi0/0) is down: holding time expired

What it means:
- Severity 5 syslog message every time an adjacency comes UP or goes
  DOWN, with the trigger reason embedded in the text.
- Enabled by default on modern IOS but always include the line so
  the configuration is explicit.` },
  { proto: 'EIGRP', cmd: 'router eigrp [name]',
    desc: 'Enables EIGRP Named Mode, the modern way to configure EIGRP for both IPv4 and IPv6 in one place.',
    example: `R1(config)# router eigrp MY_NETWORK
R1(config-router)# address-family ipv4 unicast autonomous-system 100
R1(config-router-af)#

What it means:
- "MY_NETWORK" is a friendly local name for the EIGRP virtual instance.
- AS number moves to the address-family — single config block now
  hosts both IPv4 and IPv6 unicast (and VRFs).
- Replaces the legacy "router eigrp <as>" + "ipv6 router eigrp" pair.` },

  { proto: 'EIGRP', cmd: 'address-family ipv4 unicast autonomous-system [as]',
    desc: 'Enables IPv4 routing within a Named Mode configuration.',
    example: `R1(config-router)# address-family ipv4 unicast autonomous-system 100
R1(config-router-af)#

What it means:
- Activates the IPv4 unicast routing context. AS 100 is the value
  carried on the wire; remote peers must match it.
- "topology base" and "af-interface" sub-modes live inside this AF.` },

  { proto: 'EIGRP', cmd: 'address-family ipv6 unicast autonomous-system [as]',
    desc: 'Enables IPv6 routing within a Named Mode configuration, replacing the old ipv6 router eigrp.',
    example: `R1(config-router)# address-family ipv6 unicast autonomous-system 100
R1(config-router-af)#

What it means:
- Same as the IPv4 AF but for IPv6 unicast routes.
- Allows IPv4 and IPv6 EIGRP to share router-id, key-chains, and AS
  number under a single "router eigrp" parent.` },

  { proto: 'EIGRP', cmd: 'af-interface [int|default]',
    desc: 'Enters interface-specific config within Named Mode (where bandwidth, hellos, and auth are set).',
    example: `R1(config-router-af)# af-interface GigabitEthernet0/0
R1(config-router-af-interface)# hello-interval 5
R1(config-router-af-interface)# authentication mode hmac-sha-256 SECRET

What it means:
- Replaces the classic "ip *-eigrp* <as>" interface commands. ALL
  per-interface EIGRP knobs (timers, auth, summary) live here.
- "af-interface default" applies settings to every EIGRP-enabled
  interface unless overridden by a specific af-interface block.` },

  { proto: 'EIGRP', cmd: 'topology base',
    desc: 'Enters topology-specific config within Named Mode for variance, redistributing, and filtering.',
    example: `R1(config-router-af)# topology base
R1(config-router-af-topology)# variance 2
R1(config-router-af-topology)# redistribute static metric 10000 100 255 1 1500

What it means:
- "Base" is the default topology (analogous to global RIB). Multi-
  Topology Routing (MTR) can host additional topology contexts.
- Variance, redistribution, distribute-list, and offset-list all live
  inside topology mode in Named Mode.` },

  { proto: 'EIGRP', cmd: 'metric version 64bit',
    desc: 'Enables Wide Metrics in Named Mode, allowing for high-speed interfaces (100Gbps+) without metric saturation.',
    example: `R1(config-router-af)# metric version 64bit

R1# show ip protocols | include metric
  EIGRP-IPv4 Protocol for AS(100)
    Metric: Maximum hops 100
    Metric: Composite: 64bit

R# show ip route eigrp | include 10.5.5
D 10.5.5.0/24 [90/13107200] via 192.168.1.1, Gi0/0   ← 64-bit metric

What it means:
- Default 32-bit metrics saturate around 256 Mbps × delay (anything
  above ~256 Mbps gets the same metric).
- 64-bit Wide Metrics keep linear granularity from 1 Gbps up through
  100 Gbps and beyond.
- All routers in the AS should agree; mixed mode works but reduces
  to the lowest version on the path.` },

  { proto: 'EIGRP', cmd: 'bfd all-interfaces',
    desc: 'Links EIGRP to BFD for sub-second failure detection, bypassing the standard Hello/Hold timers.',
    example: `R1(config-router-af)# bfd all-interfaces

R1# show ip eigrp interfaces detail Gi0/0 | include BFD
  BFD enabled, BFD session is Up

What it means:
- BFD probes detect link loss in milliseconds; EIGRP receives the
  down event from BFD and reconverges immediately.
- Replaces the slow path of waiting for the 15-second Hold timer.
- BFD must also be configured on the interface (interval/min_rx/
  multiplier).` },

  { proto: 'EIGRP', cmd: 'fast-reroute per-prefix',
    desc: 'Enables LFA (Loop-Free Alternate) calculation to provide immediate backup paths during a failure.',
    example: `R1(config-router-af-topology)# fast-reroute per-prefix all

R1# show ip eigrp topology frr
P 10.5.5.0/24, 1 successors, FD is 2816, frr-prot
        via 10.1.1.2 (2816/2570), Gi0/0  ← primary
   FRR LFA: via 10.2.2.2 (3500/2570), Gi0/1  ← backup ready

What it means:
- EIGRP pre-computes a Feasible Successor and pre-programs it as the
  CEF backup next-hop for each protected prefix.
- On primary-link failure, CEF flips traffic in microseconds without
  waiting for DUAL to converge.` },

  { proto: 'EIGRP', cmd: 'fast-reroute load-sharing',
    desc: 'Optimizes backup paths to ensure that traffic is balanced effectively during a failover event.',
    example: `R1(config-router-af-topology)# fast-reroute load-sharing balance

R1# show ip eigrp topology frr | include load
  FRR load-sharing: balance

What it means:
- During the brief LFA failover, multiple LFA paths share the load
  proportionally instead of all traffic flooding the single best LFA.
- Reduces transient congestion when a primary link drops.` },

  { proto: 'EIGRP', cmd: 'summary-metric [net/mask] [bw] [delay] [rel] [load] [mtu]',
    desc: 'Specifies the metric for a summary route in Named Mode, overriding the default lowest-component metric.',
    example: `R1(config-router-af-topology)# summary-metric 10.0.0.0/8 10000 10 255 1 1500

R-neighbour# show ip route eigrp | include 10.0.0.0
D 10.0.0.0/8 [90/2570] via 192.168.1.1, Gi0/0   ← uses configured metric

What it means:
- Default summary metric is the lowest component metric across the
  contributing prefixes — often hides real cost.
- Setting it explicitly lets you advertise the summary with a
  representative or strategically-chosen metric.` },

  { proto: 'EIGRP', cmd: 'neighbor [ip] [interface]',
    desc: 'Configures a static neighbor, disabling multicast EIGRP on that interface.',
    example: `R1(config-router-af)# neighbor 10.1.1.2 GigabitEthernet0/0

R1# show ip eigrp neighbors detail
H  Address    Interface  Hold Uptime    SRTT  RTO  Q  Seq Num
0  10.1.1.2   Gi0/0      12   00:04:15  4     100  0  12
   Static neighbor (Restart time 00:00:00)

What it means:
- Forces unicast Hellos to 10.1.1.2 — switches off the default
  multicast (224.0.0.10).
- Use on NBMA topologies where multicast doesn't traverse the cloud,
  or to restrict who can become a neighbour by IP.` },

  { proto: 'EIGRP', cmd: 'show eigrp address-family ipv4 neighbors',
    desc: 'Verifies IPv4 neighbors in Named Mode; standard show ip eigrp commands also work but this is the correct syntax.',
    example: `R1# show eigrp address-family ipv4 neighbors

EIGRP-IPv4 VR(MY_NETWORK) Address-Family Neighbors for AS(100)
H  Address    Interface  Hold Uptime    SRTT  RTO  Q   Seq Num
0  10.2.2.2   Gi0/1      12   00:08:12  4     100  0   12

What it means:
- Same data as "show ip eigrp neighbors" but in Named Mode-aware
  form (shows the VR — Virtual Router — name).
- Required when the same router runs multiple Named Mode VR
  instances simultaneously.` },

  { proto: 'EIGRP', cmd: 'show eigrp address-family ipv4 topology',
    desc: 'Displays the Named Mode topology table, including the new 64-bit Wide metrics.',
    example: `R1# show eigrp address-family ipv4 topology

EIGRP-IPv4 VR(MY_NETWORK) Topology Table for AS(100)/ID(1.1.1.1)

P 10.5.5.0/24, 1 successors, FD is 13107200, serno 12
        via 10.1.1.2 (13107200/12860160), Gi0/0

What it means:
- Same fields as classic topology output but the FD/RD numbers are
  64-bit Wide Metrics (much larger numerical range).
- Used to confirm Wide Metrics is on and computing values that won't
  saturate on 100 G+ interfaces.` },

  { proto: 'EIGRP', cmd: 'graceful-restart',
    desc: 'Enables NSF (Non-Stop Forwarding), allowing the router to keep forwarding traffic during a supervisor failover.',
    example: `R1(config-router-af)# graceful-restart

R1# show ip eigrp neighbors detail | include restart
   Restart time: 240
   GR support: Yes (helper-only)

What it means:
- Tells neighbours: "if I crash and restart, hold the adjacency
  for up to 240 s while my new RP rebuilds state — don't reset!"
- Both ends should support GR. Pair with a chassis that has dual
  RPs ("redundancy" mode SSO).` },

  { proto: 'EIGRP', cmd: 'shutdown',
    desc: 'Disables a specific address-family or interface within EIGRP without deleting the configuration.',
    example: `R1(config-router-af-interface)# shutdown

R1# show ip eigrp interfaces
EIGRP-IPv4 VR(MY_NETWORK) Address-Family Interfaces for AS(100)
                Xmit Queue  PeerQ       Mean   Pacing Time   Multicast
Interface Peers Un/Reliable Un/Reliable SRTT   Un/Reliable   Flow Timer
                              ! shut interface absent

What it means:
- Administratively disables the AF or interface — config is preserved
  for later "no shutdown".
- Use to gracefully de-peer for maintenance without losing the
  configuration.` },

  { proto: 'EIGRP', cmd: 'address-family ipv4 vrf [name]',
    desc: 'Configures EIGRP within a VRF, enabling network virtualisation and overlapping IP space.',
    example: `R1(config-router)# address-family ipv4 vrf CUSTOMER-A autonomous-system 100
R1(config-router-af)# network 10.0.0.0 0.255.255.255

R1# show eigrp address-family ipv4 vrf CUSTOMER-A neighbors
H  Address    Interface  Hold Uptime    SRTT  RTO  Q  Seq Num
0  10.1.1.2   Gi0/0.10   12   00:04:15  4     100  0  12

What it means:
- Each VRF gets its own EIGRP topology + RIB, isolated from other
  VRFs on the same router.
- Required for MPLS L3VPN PE routers running EIGRP-as-PE-CE.
- AS number can repeat across VRFs because they are isolated.` },

  { proto: 'EIGRP', cmd: 'metric rib-scale [1-128]',
    desc: 'Scales EIGRP metrics to fit into the 32-bit RIB when using 64-bit Wide Metrics.',
    example: `R1(config-router-af)# metric rib-scale 128

R1# show ip route 10.5.5.0
Routing entry for 10.5.5.0/24
  Known via "eigrp 100", distance 90, metric 102400 (scaled by 128)
  Tag 0, type internal

What it means:
- The IOS Global RIB stores metrics as 32-bit; raw 64-bit Wide values
  would overflow.
- rib-scale divides the wide metric before installation. Default 128
  preserves enough resolution for typical comparisons.` },

  { proto: 'EIGRP', cmd: 'neighbor [ip] [interface] remote [max-hops]',
    desc: 'Configures EIGRP Over-the-Top (OTP), allowing EIGRP neighbors to form over a L3 cloud without direct L2.',
    example: `R1(config-router-af)# neighbor 1.1.1.1 GigabitEthernet0/0 remote 10

R1# show ip eigrp neighbors detail | include OTP
  Remote Static neighbor (max-hops 10) — OTP

What it means:
- "remote 10" allows the EIGRP adjacency to form across up to 10 IP
  hops (not directly attached). The TTL on Hellos is set accordingly.
- Used in EIGRP Over-the-Top (OTP) — runs an EIGRP overlay over a
  generic IP cloud (DMVPN, MPLS, internet) without GRE/IPsec.` },

  { proto: 'EIGRP', cmd: 'eigrp stub leak-map [name]',
    desc: 'Allows specific routes to be advertised from a stub router that would otherwise be suppressed.',
    example: `R1(config)# route-map ALLOW-LIST permit 10
R1(config-route-map)# match ip address 5
R1(config-router-af)# eigrp stub connected leak-map ALLOW-LIST

R-neighbour# show ip route eigrp | include 192.0.2
D 192.0.2.0/24 [90/2816] via 10.1.1.1, Gi0/0   ← leaked

What it means:
- Stub normally only advertises connected/static; leak-map permits
  named non-default routes through anyway.
- Useful when an access-layer stub router has a unique transit-only
  route the rest of the network needs to reach.` },

  { proto: 'EIGRP', cmd: 'af-interface default',
    desc: 'Applies commands to all EIGRP interfaces simultaneously within Named Mode.',
    example: `R1(config-router-af)# af-interface default
R1(config-router-af-interface)# authentication mode hmac-sha-256 SHARED-KEY
R1(config-router-af-interface)# hello-interval 5

What it means:
- Settings applied here become the default for every EIGRP-enabled
  interface in this AF.
- Specific "af-interface <name>" blocks override the default for that
  interface only — fall-through inheritance.` },

  { proto: 'EIGRP', cmd: 'summary-metric [prefix] distance [1-255]',
    desc: 'Modifies the Admin Distance of a specific summary route to control route preference.',
    example: `R1(config-router-af-topology)# summary-metric 10.0.0.0/8 distance 120

R1# show ip route 10.0.0.0
Routing entry for 10.0.0.0/8 — known via "eigrp 100", distance 120

What it means:
- Default AD for EIGRP summary is 5 (intentionally low so it always
  wins on the originator). Bumping it to 120 makes the summary lose
  to other protocols (OSPF, BGP) for the same prefix.
- Use to expose externally-learned summaries while keeping the
  EIGRP-internal more-specifics local.` },

  { proto: 'EIGRP', cmd: 'timers nsf route-hold [sec]',
    desc: 'Sets how long to keep routes from a restarting neighbor during Non-Stop Forwarding.',
    example: `R1(config-router-af)# timers nsf route-hold 240

R1# show ip protocols | include NSF
  EIGRP NSF-aware route hold timer is 240
  EIGRP NSF helper mode is enabled

What it means:
- During an NSF restart of the peer, this router keeps using the
  routes the peer advertised for up to 240 s.
- If the peer doesn't fully re-establish in time, those routes are
  removed and traffic is reconverged elsewhere.` },

  { proto: 'EIGRP', cmd: 'timers nsf signal [sec]',
    desc: 'Adjusts the wait time for a restarting neighbor to signal it has finished its initial update.',
    example: `R1(config-router-af)# timers nsf signal 20

R1# show ip protocols | include NSF
  EIGRP NSF signal timer is 20

What it means:
- After the restarting peer comes back, this router waits 20 s for
  the END-OF-TABLE signal before declaring NSF a failure.
- Lower for fast tear-down on hangs; raise for very large tables.` },

  { proto: 'EIGRP', cmd: 'ip authentication mode eigrp [as] hmac-sha-256 [pass]',
    desc: 'Enables high-strength SHA-256 authentication (Classic Mode syntax) for maximum security.',
    example: `R1(config-if)# ip authentication mode eigrp 1 hmac-sha-256 SECRETKEY2026

R1# show ip eigrp interfaces detail Gi0/0 | include Authentication
  Authentication mode is HMAC-SHA-256

What it means:
- HMAC-SHA-256 is far stronger than legacy MD5 and supported on modern
  IOS XE.
- Inline password syntax (Classic Mode) — no key-chain object needed,
  but you give up rotation flexibility.` },

  { proto: 'EIGRP', cmd: 'authentication mode hmac-sha-256 [pass]',
    desc: 'Enables SHA-256 in Named Mode; significantly more secure than legacy MD5.',
    example: `R1(config-router-af-interface)# authentication mode hmac-sha-256 STRONG-SECRET

R1# show eigrp address-family ipv4 interfaces detail Gi0/0 | include auth
  Authentication mode is HMAC-SHA-256

What it means:
- Named Mode equivalent of the Classic Mode hmac-sha-256 command.
- Place under "af-interface <X>" or "af-interface default" so all
  matching interfaces inherit it.` },

  { proto: 'EIGRP', cmd: 'default-information allowed in',
    desc: 'Permits the router to accept a default route from neighbors (used when filtering is strict).',
    example: `R1(config-router-af-topology)# default-information allowed in

R1# show ip route eigrp | include 0.0.0.0
D*   0.0.0.0/0 [90/2816] via 10.1.1.1, Gi0/0   ← accepted

What it means:
- Without this, default-information filtering may strip incoming
  default routes — the router silently ignores any 0.0.0.0/0 EIGRP
  advertises.
- Allow inbound on edge routers that need a default from upstream.` },

  { proto: 'EIGRP', cmd: 'default-information allowed out',
    desc: 'Allows the router to advertise a default route to neighbors.',
    example: `R1(config-router-af-topology)# default-information allowed out

R-spoke# show ip route eigrp | include 0.0.0.0
D*   0.0.0.0/0 [90/2816] via 10.1.1.1, Gi0/0   ← seen

What it means:
- Permits this router to send 0.0.0.0/0 as an EIGRP route to peers.
- Pair with "ip default-network" or "ip route 0.0.0.0 0.0.0.0 …" so
  there is actually a default to advertise.` },

  { proto: 'EIGRP', cmd: 'distance eigrp [internal] [external]',
    desc: 'Modifies default AD (90/170) for all EIGRP routes to influence selection against OSPF/BGP.',
    example: `R1(config-router-af-topology)# distance eigrp 80 160

R1# show ip protocols | include Distance
  Distance: internal 80 external 160

What it means:
- Internal EIGRP routes now have AD 80 (was 90); external EIGRP
  routes have AD 160 (was 170).
- Lowers AD below OSPF (110) so EIGRP is preferred when both protos
  are present in the same RIB. Use carefully — easy way to create
  redistribution loops.` },

  { proto: 'EIGRP', cmd: 'ip summary-address eigrp [as] 0.0.0.0 0.0.0.0',
    desc: 'Advertises a manual default route from a specific interface to a neighbor.',
    example: `R1(config-if)# ip summary-address eigrp 100 0.0.0.0 0.0.0.0

R-spoke# show ip route eigrp | include 0.0.0.0
D*   0.0.0.0/0 [5/2816] via 10.1.1.1, Gi0/0
                ↑ AD 5 — summary

What it means:
- Generates a default route as a "summary" out this interface only.
- AD is the special "summary AD" of 5 — wins almost everything,
  pinning the spoke to this specific hub link as the default path.` },

  { proto: 'EIGRP', cmd: 'show eigrp address-family ipv4 vrf [name] neighbors',
    desc: 'Verifies neighbors within a specific VRF; essential for MPLS/VPN troubleshooting.',
    example: `R1# show eigrp address-family ipv4 vrf CUSTOMER-A neighbors

EIGRP-IPv4 VR(MY_NETWORK) Address-Family Neighbors for AS(100)
   VRF(CUSTOMER-A)
H  Address    Interface     Hold  Uptime    SRTT  RTO  Q   Seq Num
0  10.1.1.2   Gi0/0.10      12    00:04:15  4     100  0   12

What it means:
- Filters neighbours to only those within the named VRF — essential
  on PE routers running multiple customer VRFs.
- "VRF(CUSTOMER-A)" header confirms the lookup scope.` },

  { proto: 'EIGRP', cmd: 'show eigrp address-family ipv4 topology summary',
    desc: 'Provides a count of routes in the topology table (Active, Passive, etc.) to check stability.',
    example: `R1# show eigrp address-family ipv4 topology summary

EIGRP-IPv4 VR(MY_NETWORK) Topology Table Summary
  Routes:
     Total:     450
     Passive:   450
     Active:    0
     Stub:      0
     Pending:   0

What it means:
- Quick health check — Active count >0 means at least one route is
  in DUAL active state and waiting for replies.
- Active >0 for >30s on a stable network is a flag for SIA risk.` },

  { proto: 'EIGRP', cmd: 'eigrp log-neighbor-warnings [sec]',
    desc: 'Logs warnings for Hello packet issues at specified intervals.',
    example: `R1(config-router-af)# eigrp log-neighbor-warnings 60

%DUAL-4-WARNING: EIGRP-IPv4 100: Neighbor 10.1.1.2: K-value mismatch (every 60s)

What it means:
- Repeating warnings (k-value mismatch, auth fail, AS mismatch) get
  rate-limited to one log line per neighbour per 60 s.
- Keeps the syslog usable when a misconfigured peer is constantly
  attempting to come up.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp topology [prefix]',
    desc: 'Shows detailed DUAL stats for a single route, including all available sources and RD/FD.',
    example: `R1# show ip eigrp topology 10.5.5.0/24

EIGRP-IPv4 Topology Entry for AS(100)/ID(1.1.1.1) for 10.5.5.0/24
  State is Passive, Query origin flag is 1, 1 Successor(s), FD is 3072
  Routing Descriptor Blocks:
  10.1.1.2 (GigabitEthernet0/0), from 10.1.1.2, Send flag is 0x0
      Composite metric is (3072/512), route is Internal
      Vector metric:
        Minimum bandwidth is 1000000 Kbit
        Total delay is 20 microseconds

What it means:
- Drills into one prefix's DUAL state. RD 512 from neighbour, FD 3072
  computed locally.
- "State Passive" = stable. "Query origin flag" tells you which
  neighbour originated the active state when the route was last
  recomputed.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp topology active',
    desc: 'Shows routes currently in Active state, meaning the router is waiting for queries to return.',
    example: `R1# show ip eigrp topology active

EIGRP-IPv4 Topology Table for AS(100)/ID(1.1.1.1)

A 10.5.5.0/24, 0 successors, FD is Inaccessible
   1 replies, active 00:01:02, query-origin: Local origin
        via 10.1.1.2 (Infinity/Infinity), Gi0/0, serno 22

What it means:
- A = Active state — DUAL has sent Queries and is waiting for Replies
  (or for the SIA timer to expire).
- "active 00:01:02" is concerning — past 3 min the route will go SIA
  and the offending neighbour will be reset.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp topology zero-successors',
    desc: 'Finds routes that have no path to the destination but remain in the topology table.',
    example: `R1# show ip eigrp topology zero-successors

EIGRP-IPv4 Topology Table for AS(100)/ID(1.1.1.1)

P 10.5.5.0/24, 0 successors, FD is Inaccessible
        via 10.1.1.2 (Infinity/Infinity), Gi0/0

What it means:
- Routes with FD = Inaccessible — destination is unreachable but
  EIGRP remembers it for SIA-protection / poison-reverse purposes.
- A growing zero-successor list points at chronic upstream churn.` },

  { proto: 'EIGRP', cmd: 'debug eigrp address-family ipv4 neighbor',
    desc: 'Logs specific neighbor state machine transitions in Named Mode.',
    example: `R1# debug eigrp address-family ipv4 neighbor 10.1.1.2

EIGRP-IPv4 VR(MY_NETWORK) AS(100): Nbr 10.1.1.2 retransmit queue empty
EIGRP-IPv4 VR(MY_NETWORK) AS(100): Nbr 10.1.1.2 going DOWN: holding time expired
EIGRP-IPv4 VR(MY_NETWORK) AS(100): Nbr 10.1.1.2 going UP

What it means:
- Filtered to a single neighbour — much less noise than a global
  "debug eigrp packets".
- Shows state-machine transitions with the trigger reason.` },

  { proto: 'EIGRP', cmd: 'debug eigrp transmit',
    desc: 'Shows exactly what the router is sending to its neighbors to find missing advertisements.',
    example: `R1# debug eigrp transmit

EIGRP: Send UPDATE on Gi0/1 nbr 10.2.2.2, AS 100 - prefix 10.5.5.0/24 metric 3072
EIGRP: Send QUERY on Gi0/1 nbr 10.2.2.2, AS 100 - prefix 10.6.6.0/24 metric Infinity

What it means:
- Logs every outbound packet by content. Use to confirm whether a
  prefix really is being advertised to a peer.
- Combine with "debug eigrp transmit detail" for full TLV decoding
  (CPU-heavy).` },

  { proto: 'EIGRP', cmd: 'debug eigrp route',
    desc: 'Logs how EIGRP is installing/removing routes from the Global RIB.',
    example: `R1# debug eigrp route

EIGRP-IPv4 100: Route 192.168.1.0/24 install: best path via 10.1.1.2
EIGRP-IPv4 100: Route 192.168.1.0/24 redist: External, type 90, metric 3072

What it means:
- Logs the install/remove/update path between the EIGRP topology
  table and the global RIB.
- Use when a route is in the EIGRP topology as Passive but mysteriously
  not in the routing table — log will show why install was rejected.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp timers',
    desc: 'Displays the internal hello/hold timers and how much time remains for each neighbor.',
    example: `R1# show ip eigrp timers

EIGRP-IPv4 Timers for AS(100)
  Hello timer: every 5 sec
  Hold timer:  every 15 sec, expires for nbr 10.1.1.2 in 12 sec
  Active timer: 3 min

What it means:
- Snapshot of all process and per-neighbour timers.
- Use when debugging adjacency flaps to see exactly how much hold
  budget is left right now.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp accounting',
    desc: 'Displays the number of routes learned from each neighbor; helps identify heavy peers.',
    example: `R1# show ip eigrp accounting

EIGRP-IPv4 Accounting for AS(100)
Neighbor       Routes Sent   Updates Sent   Updates Received
10.1.1.1       45            12             3
10.2.2.1       7             4              50   ← heavy upstream peer

What it means:
- Per-neighbour accounting of routes and update counters.
- Quickly spot which peer is providing the bulk of your routes —
  helps capacity-plan summarisation efforts.` },

  { proto: 'EIGRP', cmd: 'ip vrf forwarding [name]',
    desc: 'Prerequisite command on an interface before EIGRP can form a VRF-lite adjacency.',
    example: `R1(config-if)# ip vrf forwarding RED
R1(config-if)# ip address 10.1.1.1 255.255.255.0

R1# show ip route vrf RED
Routing Table: RED
D    10.5.5.0/24 [90/2816] via 10.1.1.2, Gi0/0.10

What it means:
- Binds the interface to VRF "RED" — the EIGRP adjacency formed on
  this interface will be in the VRF's RIB, not the global RIB.
- Must come before "ip address" or the IP gets removed and re-added.` },

  { proto: 'EIGRP', cmd: 'test eigrp address-family ipv4 [as] router-id [id]',
    desc: 'Simulation command to test how a router-id change would affect the process.',
    example: `R1# test eigrp address-family ipv4 100 router-id 9.9.9.9

EIGRP test: Router-ID 9.9.9.9 is unique within the AS
            Conflict with existing router-id 1.1.1.1: NO

What it means:
- Dry-run a router-id change without actually applying it.
- Confirms uniqueness across the AS before committing the change —
  saves you from triggering an external-route purge by accident.` },

  { proto: 'EIGRP', cmd: 'show eigrp tech-support',
    desc: 'Dumps massive amounts of data for Cisco TAC engineers; used for deep crash analysis.',
    example: `R1# show eigrp tech-support

------------------ show eigrp address-family ipv4 timers ------------------
... (extensive multi-page output) ...
------------------ show eigrp address-family ipv4 topology  ----------------
... (etc) ...

What it means:
- Combined dump of every EIGRP show command — packet counters, FSM
  state, internal queues.
- Pipe to a file ("term len 0" first) and attach to the TAC case
  when reporting EIGRP bugs.` },

  { proto: 'EIGRP', cmd: 'debug eigrp stub',
    desc: 'Monitors stub router behavior, showing if queries are being correctly suppressed.',
    example: `R1# debug eigrp stub

EIGRP-IPv4 100: Stub neighbor 10.1.1.2 — query for 10.5.5.0/24 SUPPRESSED
EIGRP-IPv4 100: Stub neighbor 10.1.1.2 — query for 10.6.6.0/24 SUPPRESSED

What it means:
- Confirms this router is correctly NOT sending Queries toward stub
  neighbours (which is the whole point of stubbing — eliminates
  Queries from reaching the access layer and thus prevents SIA).` },

  { proto: 'EIGRP', cmd: 'ip bandwidth-percent eigrp [as] [1-999999]',
    desc: 'Allows EIGRP to consume more than 100% of perceived bandwidth (common on sub-rate circuits).',
    example: `R1(config-if)# bandwidth 56
R1(config-if)# ip bandwidth-percent eigrp 100 200

R1# show ip eigrp interfaces detail Se0/0 | include bandwidth
  Bandwidth percent is 200 (over-subscription allowed)

What it means:
- On a sub-rate WAN circuit (configured "bandwidth 56" while real
  capacity is 1.5 Mbps), EIGRP would self-throttle below the actual
  link speed.
- Setting >100% lets EIGRP use the real bandwidth, not the kbps value.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp topology frr',
    desc: 'Verifies Fast Reroute (LFA) backup paths that are pre-programmed for instant failover.',
    example: `R1# show ip eigrp topology frr

P 10.5.5.0/24, 1 successors, FD 2816, frr-prot
   Successor: via 10.1.1.2 Gi0/0
   FRR LFA  : via 10.2.2.2 Gi0/1   ← pre-installed backup
   Repair Path Type: Per-prefix LFA

What it means:
- Confirms an LFA backup is pre-programmed for the prefix.
- "Repair Path Type" can be Per-prefix, Per-link, or TI-LFA depending
  on the FRR configuration. Per-prefix gives finest granularity.` },

  { proto: 'EIGRP', cmd: 'show eigrp address-family ipv4 vrf [name] traffic',
    desc: 'VRF-specific packet counters to ensure hello/update packets are not being dropped by an ACL.',
    example: `R1# show eigrp address-family ipv4 vrf CUSTOMER-A traffic

EIGRP-IPv4 VR(MY_NETWORK) AS(100) Traffic Statistics  VRF(CUSTOMER-A)
  Hellos sent/received: 312/312
  Updates sent/received: 10/10
  Queries sent/received: 0/0

What it means:
- Per-VRF packet counters. If sent ≫ received, an ACL or firewall
  on the path is probably dropping inbound EIGRP packets.
- 0 Queries on a stable network is the expected steady state.` },

  { proto: 'EIGRP', cmd: 'max-reserve-bandwidth [%]',
    desc: 'Adjusts the global pool of bandwidth EIGRP can use for control plane traffic.',
    example: `R1(config-if)# max-reserved-bandwidth 75

R1# show interface Gi0/0 | include reserved
  Reserved bandwidth: 75 percent

What it means:
- Maximum proportion of interface bandwidth reservable for QoS class
  queues.
- Default is 75%. Bump up only when you genuinely need most of the
  link for prioritised classes (VoIP, video).` },

  { proto: 'EIGRP', cmd: 'neighbor [ip] [interface] next-hop-self',
    desc: 'Forces the router to set its own IP as the next hop in a hub-and-spoke DMVPN.',
    example: `R-Hub(config-router-af-interface)# no next-hop-self

R-spoke# show ip route eigrp | include 10.5.5
D 10.5.5.0/24 [90/3072] via 10.6.6.6, Gi0/0   ← original spoke A IP

What it means:
- DEFAULT is next-hop-self ON. Turning it OFF tells the hub to keep
  the original next-hop (spoke A) when re-advertising spoke A's
  routes to spoke B.
- DMVPN Phase 2/3: spokes can NHRP-resolve each other and build
  direct tunnels — turn OFF so spoke B takes the optimal path
  directly to spoke A.` },

  { proto: 'EIGRP', cmd: 'neighbor [ip] [interface] split-horizon disable',
    desc: 'Disables Split Horizon per neighbor (Named Mode); vital for DMVPN Phase 2.',
    example: `R-Hub(config-router-af-interface)# no split-horizon

R-Hub# show ip eigrp interfaces detail Tu0 | include Split
  Split-horizon is disabled

What it means:
- Hub MUST disable split-horizon on multipoint Tu0 so it can
  re-advertise spoke A's routes back out the same interface to
  spoke B.
- Without this, spokes can never see each other's routes regardless
  of NHRP / next-hop-self settings.` },

  { proto: 'EIGRP', cmd: 'redistribute static metric [bw] [delay] [rel] [load] [mtu]',
    desc: 'Redistributes static routes with a specific seed metric.',
    example: `R1(config-router-af-topology)# redistribute static metric 1000 1 255 1 1500

R-neighbour# show ip route eigrp | include EX
D EX 192.0.2.0/24 [170/2816] via 192.168.1.1, Gi0/0

What it means:
- Imports static routes into EIGRP with the specified seed metric.
- Without an explicit metric (and no default-metric), static routes
  are silently dropped — common gotcha.
- Result is an external EIGRP route (AD 170, "EX" code).` },

  { proto: 'EIGRP', cmd: 'redistribute connected',
    desc: 'Quickly injects local subnets into the EIGRP domain.',
    example: `R1(config-router-af-topology)# redistribute connected

R-neighbour# show ip route eigrp | include EX
D EX 192.168.10.0/24 [170/2816] via 192.168.1.1, Gi0/0

What it means:
- Pushes every directly-connected subnet (not already covered by a
  network statement) into EIGRP as an external route.
- Quick and dirty alternative to listing every loopback / interface
  subnet under "network" statements.
- Filter aggressively with route-maps to avoid leaking management
  IPs.` },

  { proto: 'EIGRP', cmd: 'summary-address [prefix] [leak-map]',
    desc: 'Named Mode version of summarization with granular route leaking control.',
    example: `R1(config-router-af-topology)# summary-address 172.16.0.0/16 leak-map ALLOW-MGMT

R-neighbour# show ip route eigrp
D    172.16.0.0/16 [90/2816] via 192.168.1.1, Gi0/0     ← summary
D    172.16.99.0/24 [90/3072] via 192.168.1.1, Gi0/0   ← leaked specific

What it means:
- Sends a single 172.16.0.0/16 plus the explicitly leaked specifics.
- Use when you want summary efficiency on most prefixes but keep one
  or two more-specifics for backup-path or monitoring purposes.` },

  { proto: 'EIGRP', cmd: 'prefix-priority [limit] [acl]',
    desc: 'Gives certain prefixes priority during SPF/DUAL calculation for faster convergence on critical routes.',
    example: `R1(config)# access-list 50 permit host 10.10.10.10
R1(config-router-af)# prefix-priority high 50

R1# show ip eigrp prefix-priority
   High-priority prefixes: 1
   List 50: 10.10.10.10/32

What it means:
- DUAL processes high-priority prefixes first during a topology
  change — Voice, Video, control-plane routes converge before
  bulk data.
- Use when sub-second voice/video convergence matters and you can
  rank a small subset of prefixes as "critical".` },

  { proto: 'EIGRP', cmd: 'active-process-limit [1-100]',
    desc: 'Limits the number of concurrent DUAL active processes to protect router CPU.',
    example: `R1(config-router-af)# active-process-limit 10

R1# show ip protocols | include active
   EIGRP active-process-limit is 10

What it means:
- During mass topology change, DUAL would normally try to recompute
  every affected prefix simultaneously and spike CPU.
- Capping concurrency at 10 forces the recompute to serialise —
  smoother CPU, slightly slower convergence on the long-tail.` },

  { proto: 'EIGRP', cmd: 'timers throttle packets [msec]',
    desc: 'Adds a delay between EIGRP packets to prevent overwhelming a neighbor\'s CPU.',
    example: `R1(config-router-af)# timers throttle packets 50

R1# show ip eigrp interfaces detail Gi0/0 | include Pacing
  Pacing time : 50ms (Un/Reliable)

What it means:
- Inserts 50 ms gaps between successive EIGRP packets on the wire.
- Useful when peering with low-end CPE devices that drop packets
  arriving back-to-back.` },

  { proto: 'EIGRP', cmd: 'show ip eigrp topology summary vrf [name]',
    desc: 'Checks VRF health by looking at the total number of entries in that specific table.',
    example: `R1# show ip eigrp topology summary vrf CUSTOMER-A

EIGRP-IPv4 Topology Table Summary for VRF CUSTOMER-A
   Total prefixes: 124
   Active prefixes: 0
   Stuck-in-Active: 0

What it means:
- Per-VRF roll-up. 0 Active and 0 SIA on a quiet domain is what you
  want.
- "Total prefixes" tracks growth — sudden jumps can flag
  redistribution loops.` },

  { proto: 'EIGRP', cmd: 'ip authentication key-chain eigrp [as] [name]',
    desc: 'Interface command to apply a rotation of keys for security compliance.',
    example: `R1(config-if)# ip authentication key-chain eigrp 100 EIGRP-KEYS

R1# show ip eigrp interfaces detail Gi0/0 | include key-chain
  Authentication key-chain is "EIGRP-KEYS"

What it means:
- Binds the named key-chain object to EIGRP on this interface.
- The key-chain object itself is created with "key chain X / key 1 /
  key-string …" plus accept- / send-lifetime windows for graceful
  rotation.` },

  { proto: 'EIGRP', cmd: 'metric maximum-hop [1-255]',
    desc: 'Extends EIGRP\'s reach beyond the default 100 hops (useful for massive global networks).',
    example: `R1(config-router-af)# metric maximum-hops 200

R1# show ip protocols | include hops
  Maximum hops: 200

What it means:
- EIGRP records hop count in its metric. Routes beyond the maximum
  are declared unreachable (Infinity).
- Default is 100 — fine for most networks. Bump up for very large
  layered topologies (some MPLS underlays).` },

  { proto: 'EIGRP', cmd: 'distance [1-255] [source-ip] [wildcard] [acl]',
    desc: 'Changes AD for specific neighbors only; used to prefer one site over another.',
    example: `R1(config-router-af-topology)# distance 85 10.1.1.1 0.0.0.0

R1# show ip route 10.5.5.0
Routing entry for 10.5.5.0/24
  Known via "eigrp 100", distance 85, metric 2816   ← AD lowered

What it means:
- Routes received from neighbour 10.1.1.1 (specifically — wildcard
  0.0.0.0) get AD 85 instead of the default 90.
- Lets you prefer one upstream site over another without changing
  metric or prefix lists.` },

  { proto: 'EIGRP', cmd: 'eigrp router-id [rid]',
    desc: 'Named Mode command for setting the ID inside the Address-Family.',
    example: `R1(config-router-af)# eigrp router-id 2.2.2.2

R1# show eigrp address-family ipv4 topology | include ID
EIGRP-IPv4 VR(MY_NETWORK) Topology Table for AS(100)/ID(2.2.2.2)

What it means:
- Sets the router-id inside the Named Mode AF (different scope from
  Classic Mode "eigrp router-id" under "router eigrp").
- The router-id stamps external routes — must be unique per VR/AF.` },

  { proto: 'EIGRP', cmd: 'passive-interface default',
    desc: 'Hardens the router by disabling EIGRP on all ports, requiring manual no passive on intended ports.',
    example: `R1(config-router)# passive-interface default
R1(config-router)# no passive-interface GigabitEthernet0/0

R1# show ip protocols | include passive
   Passive Interface(s):
     GigabitEthernet0/1
     GigabitEthernet0/2
     ...
   Active interfaces: GigabitEthernet0/0

What it means:
- Inverts the default — every interface is passive UNLESS explicitly
  un-passived.
- Prevents accidental adjacencies on unintended interfaces (rogue
  router on a spare port, etc.). Best-practice on access-layer routers.` },

  // ============================== IS-IS (100 supplied → 99 unique) ==============================
  { proto: 'ISIS', cmd: 'router isis [tag]',
    desc: 'Enables IS-IS process. The tag is a local name for the routing instance.',
    example: `R1(config)# router isis CORE
R1(config-router)#

What it means:
- "CORE" is a local instance name (not advertised) — same role as
  OSPF's process-id. Multiple IS-IS instances can run side-by-side.
- Without a tag, IOS uses the default "null" tag.
- The next required line under the process is "net <NSAP>".` },

  { proto: 'ISIS', cmd: 'net [network-entity-title]',
    desc: 'Sets the NET address (NSAP). Defines Area ID, System ID, and NSEL.',
    example: `R1(config-router)# net 49.0001.1111.1111.1111.00

R1# show clns | include NET
   NET: 49.0001.1111.1111.1111.00

What it means:
- 49        : AFI (Authority and Format Identifier) — 49 = private.
- 0001      : Area ID. Routers with the SAME area run L1 adjacencies.
- 1111.1111.1111 : 6-byte System ID (must be unique per router).
                   By convention: encode IPv4 loopback 1.1.1.1 as
                   0010.0100.0100 in BCD.
- 00        : NSEL (NSAP Selector) — must be 0x00 for an IS-IS router.` },

  { proto: 'ISIS', cmd: 'ip router isis [tag]',
    desc: 'Activates IS-IS on an interface. Required for each interface to route IP.',
    example: `R1(config-if)# ip router isis CORE

R1# show isis interface Gi0/0
GigabitEthernet0/0 is up, line protocol is up
  Routing Protocol: IS-IS (CORE)
    Circuit Type: level-1-2
    Interface number 0x1, local circuit ID 0x1
    Level-2 Metric: 10, Priority: 64

What it means:
- IS-IS is opt-in per-interface (no "network" statement like OSPF).
- The tag here MUST match the "router isis CORE" instance you want
  this interface to belong to.
- Without this command, IS-IS will form CLNS adjacencies but not
  carry any IP routes over them.` },

  { proto: 'ISIS', cmd: 'is-type [level-1|level-2-only]',
    desc: 'Sets the router role. Default is L1/L2. Use level-2-only for backbone routers.',
    example: `R1(config-router)# is-type level-2-only

R1# show isis | include type
   IS-Type: Level-2-only

What it means:
- level-1       : within-area only (like an OSPF stub).
- level-2-only  : backbone-only (like OSPF area 0).
- (default L1/L2): router belongs to both — talks L1 to in-area
                   neighbours and L2 to backbone neighbours.
- L1/L2 routers consume CPU/memory holding both LSDBs; restrict
  to level-2-only on pure transit / backbone routers.` },

  { proto: 'ISIS', cmd: 'isis circuit-type [level-1|level-2]',
    desc: 'Sets interface adjacency level. Prevents unnecessary hellos on specific links.',
    example: `R1(config-if)# isis circuit-type level-2

R1# show clns interface Gi0/0 | include Circuit
  Circuit Type: level-2

What it means:
- Per-interface override of the global is-type.
- Useful when an L1/L2 router has some links that connect only to
  the backbone — restricting that interface to L2 stops it sending
  needless L1 hellos.` },

  { proto: 'ISIS', cmd: 'show isis neighbors',
    desc: 'Verifies adjacencies. Displays neighbor System ID, State, and Circuit Type.',
    example: `R1# show isis neighbors

System Id      Type Interface  IP Address       State Holdtime  Circuit Id
2222.2222.2222 L1   Gi0/0      192.168.1.2      UP    25        R2.01
3333.3333.3333 L2   Gi0/1      10.1.1.2         UP    27        R3.02

What it means:
- System Id   : 6-byte ID of the peer (or hostname if name-lookup is on).
- Type        : adjacency level (L1, L2, or L1L2).
- State       : UP / INIT / DOWN.
- Holdtime    : seconds before the adjacency is declared dead.
- Circuit Id  : DIS pseudonode identifier on broadcast links.` },

  { proto: 'ISIS', cmd: 'isis metric [1-16777215]',
    desc: 'Sets interface cost. IS-IS defaults to 10 for all interfaces.',
    example: `R1(config-if)# isis metric 50

R1# show isis interface Gi0/0 | include Metric
  Level-1 Metric: 50, Priority: 64
  Level-2 Metric: 50, Priority: 64

What it means:
- Default metric is 10 — same on every interface regardless of
  bandwidth (unlike OSPF auto-cost).
- Without "metric-style wide" the maximum is 63 (narrow). With wide
  metrics the range is 1-16777215.
- Use "isis metric 50 level-2" to set per-level metrics.` },

  { proto: 'ISIS', cmd: 'isis priority [0-127]',
    desc: 'Influences DIS election. Higher priority wins (Designated Intermediate System).',
    example: `R1(config-if)# isis priority 100 level-2

R1# show clns interface Gi0/0 | include DIS
  DR ID: R1.01, Priority: 100 (highest)

What it means:
- Range 0-127, default 64. Higher wins (opposite of OSPF tie-breaker
  on equal priority — IS-IS uses highest MAC, not lowest).
- DIS handles pseudonode LSP generation on broadcast LANs. Unlike
  OSPF DR, IS-IS supports preemption — a higher-priority router
  takes over immediately.
- Priority 0 still allows DIS election (use is-type adjustments to
  prevent it instead).` },

  { proto: 'ISIS', cmd: 'metric-style wide',
    desc: 'Enables 24-bit metrics. Required for Traffic Engineering and large networks.',
    example: `R1(config-router)# metric-style wide

R1# show isis | include metric
   Metric Style: WIDE (TLV 22 / 135)

What it means:
- Narrow metric (default) is 6 bits (max 63 per link, max path 1023)
  and uses TLV 2/128 — too coarse for modern networks.
- Wide is 24 bits per link, max path 4,261,412,864. Required by
  MPLS-TE (TLV 22 carries TE attributes) and IPv6 (TLV 135).
- Set on EVERY router in the area or use "metric-style transition"
  for a phased migration.` },

  { proto: 'ISIS', cmd: 'log-adjacency-changes',
    desc: 'Generates syslog messages when neighbors go up or down.',
    example: `R1(config-router)# log-adjacency-changes

%CLNS-5-ADJCHANGE: ISIS: Adjacency to 2222.2222.2222 (Gi0/0) Up, new adjacency
%CLNS-5-ADJCHANGE: ISIS: Adjacency to 2222.2222.2222 (Gi0/0) Down, hold time expired

What it means:
- Severity 5 syslog when adjacencies transition. Always enable on
  production for post-hoc flap analysis.
- Add "all" to also log L1↔L2 type changes.` },

  { proto: 'ISIS', cmd: 'passive-interface [int]',
    desc: 'Advertises subnet without forming adjacencies. Used for loopbacks/LANs.',
    example: `R1(config-router)# passive-interface Loopback0

R1# show clns interface Loopback0 | include passive
   IS-IS routing is enabled, but only as a passive interface

What it means:
- The Loopback0 prefix is still advertised in IS-IS (so other routers
  can reach 1.1.1.1/32 for iBGP, MPLS, etc.) but no Hellos are sent.
- ALWAYS make loopbacks passive — there's no peer there to Hello to.
- Use "passive-interface default" for the inverse (passive on every
  interface; explicitly un-passive transit links).` },

  { proto: 'ISIS', cmd: 'isis hello-interval [sec]',
    desc: 'Adjusts hello frequency. Controls how fast neighbors are discovered.',
    example: `R1(config-if)# isis hello-interval 3

R1# show clns interface Gi0/0 | include Hello
  Hello (sec): 3, Multiplier: 3, Hold Time: 9

What it means:
- Default: 10 s. Lower for faster failure detection.
- Hold time = hello-interval × hello-multiplier (here 3 × 3 = 9 s).
- Combine with BFD if you need sub-second convergence — IS-IS hello
  bursts can drop on congested links.` },

  { proto: 'ISIS', cmd: 'isis hello-multiplier [val]',
    desc: 'Sets hold time (Hello Interval x Multiplier). Determines failure detection speed.',
    example: `R1(config-if)# isis hello-multiplier 3

R1# show clns interface Gi0/0 | include Hold
  Hello (sec): 10, Multiplier: 3, Hold Time: 30

What it means:
- Hold time = hello-interval × multiplier.
- Default multiplier is 3, so default hold = 30 s for L1/L2 (and the
  DIS uses hello/3 for its own hellos).
- Increase to 5+ on flaky links to ride out brief packet loss without
  declaring the adjacency dead.` },

  { proto: 'ISIS', cmd: 'show isis hostname',
    desc: 'Maps System IDs to hostnames. Makes troubleshooting significantly easier.',
    example: `R1# show isis hostname

Level  System ID         Hostname
L1     1111.1111.1111    R1 (local)
L1     2222.2222.2222    R2-Edge
L2     3333.3333.3333    R3-Core
*      4444.4444.4444    Unknown   ← hostname-lookup not on neighbour

What it means:
- The hostname TLV (137) is exchanged between IS-IS speakers so show
  output shows R2-Edge instead of 2222.2222.2222.
- Enable "hostname dynamic" globally so this router's hostname is
  also propagated.
- "Unknown" means the originating router has not enabled the feature.` },

  { proto: 'ISIS', cmd: 'show isis database',
    desc: 'Displays the LSDB. Shows all Link State Packets (LSPs) in the area.',
    example: `R1# show isis database

IS-IS Level-1 Link State Database:
LSPID                LSP Seq Num  LSP Checksum  LSP Holdtime  ATT/P/OL
R1.00-00         *  0x00000003   0x4321        1198          0/0/0
R2.00-00            0x00000004   0x9876        1180          1/0/0
R2.01-00            0x00000001   0x1234        1180          0/0/0   ← pseudonode

What it means:
- LSPID R2.00-00 = LSP from R2's own node. R2.01-00 = pseudonode LSP
  for the broadcast LAN where R2 is DIS (.01 = circuit-id).
- Seq Num : monotonically increasing version. New > old wins.
- Holdtime: seconds until the LSP is purged (default 1200, refreshed
  every 900).
- ATT/P/OL: Attached / Partition / Overload bits.
- "*" marks LSPs originated by this router.` },

  { proto: 'ISIS', cmd: 'isis password [pass]',
    desc: 'Enables cleartext authentication for interface adjacencies.',
    example: `R1(config-if)# isis password CISCO level-2

R1# show clns interface Gi0/0 | include password
  Level-2 password: CISCO (cleartext)

What it means:
- Cleartext password — exchanged in IIH (IS-IS Hello) packets.
- Mismatched passwords cause the adjacency to stay in INIT state
  forever — but no syslog warning by default.
- Weak; prefer "isis authentication mode md5 + key-chain" for any
  non-lab use.` },

  { proto: 'ISIS', cmd: 'area-password [pass]',
    desc: 'Authenticates Level 1 LSPs within a specific area.',
    example: `R1(config-router)# area-password SECRET

R1# show isis | include password
   Area authentication: SECRET (cleartext)

What it means:
- Authenticates Level-1 LSPs and SNPs (CSNP/PSNP) area-wide.
- Distinct from interface "isis password" (which protects IIHs only).
- Mismatch silently drops L1 LSPs from the offending neighbour —
  routes stop flowing while adjacency stays UP.` },

  { proto: 'ISIS', cmd: 'domain-password [pass]',
    desc: 'Authenticates Level 2 LSPs across the entire backbone.',
    example: `R1(config-router)# domain-password KEY

R1# show isis | include domain
   Domain authentication: KEY (cleartext)

What it means:
- Same role as area-password but for L2 (backbone) LSPs.
- Set identically on every L2-capable router across the IS-IS
  domain, otherwise backbone routes silently disappear.` },

  { proto: 'ISIS', cmd: 'show clns interface',
    desc: 'Displays Layer 2 IS-IS details for an interface (SNPA, timers).',
    example: `R1# show clns interface Gi0/0

GigabitEthernet0/0 is up, line protocol is up
  Checksums enabled, MTU 1497, Encapsulation SAP
  CLNS fast switching enabled
  Routing Protocol: IS-IS (CORE)
    Circuit Type: level-1-2
    Level-1 Designated IS: R1.01
    Next IS-IS LAN Level-1 Hello in 4 seconds
    Number of active level-1 adjacencies: 1
    SNPA: 000c.abcd.1234

What it means:
- SNPA (Subnetwork Point of Attachment) = the L2 MAC address used by
  IS-IS for the interface.
- "Designated IS: R1.01" = local router is DIS on this LAN.
- "Next Hello in 4 seconds" = countdown to the next outbound IIH.` },

  { proto: 'ISIS', cmd: 'isis network point-to-point',
    desc: 'Optimizes Ethernet links between two routers, skipping DIS election.',
    example: `R1(config-if)# isis network point-to-point

R1# show clns interface Gi0/0 | include network
  Interface configuration: Point-to-point

What it means:
- Default for Ethernet is broadcast, which elects a DIS and uses
  pseudonode LSPs.
- p2p eliminates the DIS, halves the LSDB size for that link, and
  removes 30s of pseudonode-LSP timers from convergence.
- Both ends MUST agree — broadcast + p2p mismatch = no adjacency.` },

  { proto: 'ISIS', cmd: 'summary-address [prefix] [mask]',
    desc: 'Summarizes routes at the L1/L2 border to reduce database size.',
    example: `R1-L1L2(config-router)# summary-address 10.0.0.0 255.0.0.0 level-2

R-backbone# show ip route isis | include 10.0.0.0
i L2 10.0.0.0/8 [115/20] via 192.168.1.1, Gi0/0   ← single summary

What it means:
- Aggregates many L1 prefixes (10.x.x.x/24) into one L2 advertisement.
- A Null0 discard route is auto-installed locally to prevent loops
  for unallocated portions of the summary range.
- Default AD for IS-IS is 115; summary uses the same AD.` },

  { proto: 'ISIS', cmd: 'redistribute [protocol]',
    desc: 'Imports external routes into the IS-IS database.',
    example: `R1(config-router)# redistribute static ip metric 10 level-2

R-neighbour# show ip route isis | include i.L2
i L2 192.0.2.0/24 [115/30] via 192.168.1.1, Gi0/0   ← redistributed static

What it means:
- "ip" suffix is required (different from OSPF/EIGRP) — IS-IS uses
  it to distinguish IPv4 from IPv6 / CLNS imports.
- Without level-2 the routes go into L1 by default. Most deployments
  redistribute into L2 only.
- Add "metric 10" so the import has a sane seed cost (default = 0
  in narrow, undefined in wide).` },

  { proto: 'ISIS', cmd: 'default-information originate',
    desc: 'Injects a default route (0.0.0.0/0) into the IS-IS domain.',
    example: `R1(config-router)# default-information originate

R-other# show ip route isis | include 0.0.0.0
i L2 0.0.0.0/0 [115/10] via 192.168.1.1, Gi0/0

What it means:
- Generates 0.0.0.0/0 into IS-IS as an L2 external route.
- Differs from OSPF: by default IS-IS will NOT condition the
  advertisement on a local default already existing — add
  "route-map" for that.` },

  { proto: 'ISIS', cmd: 'show isis statistics',
    desc: 'Shows packet counters for hellos, LSPs, and CSNPs.',
    example: `R1# show isis statistics

  IS-IS: Level-1 Hellos sent: 1240, received: 1238
  IS-IS: Level-2 Hellos sent: 620,  received: 620
  IS-IS: Level-1 LSPs originated: 4,  received: 8
  IS-IS: CSNPs sent: 240,  received: 240
  IS-IS: PSNPs sent: 12,   received: 14
  IS-IS: SPF runs (Level-1): 5,  (Level-2): 3
  IS-IS: Errors: corrupted LSPs: 0, auth fail: 0

What it means:
- Hello counters far apart (sent ≫ received) → unidirectional loss.
- High SPF count over short window → topology churn.
- Auth failures > 0 → password mismatch with a peer trying to come up.` },

  { proto: 'ISIS', cmd: 'clear isis *',
    desc: 'Restarts the IS-IS process and clears all adjacencies.',
    example: `R1# clear isis *

%CLNS-5-ADJCHANGE: ISIS: Adjacency to 2222.2222.2222 (Gi0/0) Down, manually cleared
%CLNS-5-ADJCHANGE: ISIS: Adjacency to 2222.2222.2222 (Gi0/0) Up, new adjacency

What it means:
- Bounces all IS-IS adjacencies and rebuilds the LSDB from scratch.
- Required to apply changes that don't auto-take effect (e.g. NET
  change, area-id change).
- Disruptive — prefer "clear isis adjacency <sysid>" for a single peer.` },

  { proto: 'ISIS', cmd: 'mpls traffic-eng router-id [int]',
    desc: 'Enables TE. Uses IS-IS to advertise link constraints (bandwidth/affinity).',
    example: `R1(config)# mpls traffic-eng tunnels
R1(config-router)# mpls traffic-eng router-id Loopback0
R1(config-router)# mpls traffic-eng level-2

R1# show isis database verbose | include TE
  Router ID: 1.1.1.1
  TE Sub-TLV: Maximum Bandwidth: 1G
              Reservable Bandwidth: 800M
              Affinity: 0x000A

What it means:
- IS-IS becomes the IGP for MPLS-TE — every interface's TE state
  (max-BW, reservable-BW, affinity, SRLG) is flooded as wide-metric
  TLV-22 sub-TLVs.
- TE router-id MUST be a stable loopback IP (referenced by RSVP-TE
  for tunnel head/tail identification).` },

  { proto: 'ISIS', cmd: 'mpls traffic-eng area [id]',
    desc: 'Links IS-IS levels to MPLS TE for constraint-based path calculation.',
    example: `R1(config-router)# mpls traffic-eng level-2

R1# show isis | include traffic-eng
   MPLS Traffic-Eng: Level-2 enabled

What it means:
- Tells IS-IS to flood TE info into the L2 LSDB only (typical —
  TE topology lives at the backbone level).
- Use "level-1" instead for intra-area-only TE deployments.` },

  { proto: 'ISIS', cmd: 'isis lsp-gen-interval [msec]',
    desc: 'Throttles LSP generation to prevent CPU spikes during link flaps.',
    example: `R1(config-router)# lsp-gen-interval 5 50 5000

R1# show isis | include lsp-gen
  LSP generation interval: initial 5ms, hold 50ms, max 5000ms

What it means:
- initial (5 ms): delay before originating the first LSP after a
                   topology change.
- hold (50 ms)  : minimum interval between back-to-back LSPs.
- max (5000 ms) : exponential cap during a flap storm.
- Lower numbers → faster reactions, higher CPU. Defaults are
  conservative.` },

  { proto: 'ISIS', cmd: 'isis lsp-refresh-interval [sec]',
    desc: 'Sets how often LSPs are refreshed (default is 900 seconds).',
    example: `R1(config-router)# lsp-refresh-interval 1200

R1# show isis | include refresh
  LSP refresh interval: 1200 sec

What it means:
- LSPs that haven't changed are still re-flooded every refresh
  interval to keep them fresh.
- MUST be < max-lsp-lifetime, otherwise LSPs age out before refresh.
  Rule of thumb: refresh = lifetime × 0.75 (default 900 vs 1200).` },

  { proto: 'ISIS', cmd: 'isis max-lsp-lifetime [sec]',
    desc: 'Sets the maximum age of an LSP before it is purged from the database.',
    example: `R1(config-router)# max-lsp-lifetime 1500

R1# show isis | include lifetime
  Maximum LSP lifetime: 1500 sec

What it means:
- Lifetime starts at the configured value; receivers decrement until
  it hits 0 and the LSP is purged.
- Stretching it (e.g. 1500 vs default 1200) reduces refresh churn on
  very stable, very large LSDBs.
- Must satisfy: max-lsp-lifetime > lsp-refresh-interval.` },

  { proto: 'ISIS', cmd: 'ignore-lsp-errors',
    desc: 'Prevents the router from dropping adjacencies due to corrupted LSPs.',
    example: `R1(config-router)# ignore-lsp-errors

R1# show isis | include ignore
  Ignore LSP errors: enabled

What it means:
- Default RFC behaviour is to purge an LSP whose checksum fails and
  reset the adjacency.
- "ignore" keeps the adjacency UP and silently drops the bad LSP —
  resilient against transient bit errors but masks real problems.` },

  { proto: 'ISIS', cmd: 'set-overload-bit',
    desc: 'Signals Overload to neighbors. Traffic will not transit through this router.',
    example: `R1(config-router)# set-overload-bit

R1# show isis database | include OL
R1.00-00         *  0x00000004   0x4321        1198          0/0/1   ← OL=1

What it means:
- The router originates its LSP with the OL (Overload) bit set.
- Other routers will not use this router as a TRANSIT path while
  the bit is set; locally-attached prefixes still reach.
- Useful before reload to drain transit traffic gracefully.` },

  { proto: 'ISIS', cmd: 'set-overload-bit on-startup [sec]',
    desc: 'Sets Overload bit temporarily during boot to allow BGP to converge first.',
    example: `R1(config-router)# set-overload-bit on-startup 300

R1# show isis | include overload
  Set overload bit on-startup: 300 sec, time remaining 287

What it means:
- During the first 300 s after boot, advertise the OL bit. Lets BGP
  finish learning the full table before IGP starts attracting transit.
- Variant "wait-for-bgp" clears the bit only when all eBGP sessions
  are established + RIB-converged — even better for sites where 300 s
  may not be enough.` },

  { proto: 'ISIS', cmd: 'isis retransmit-interval [sec]',
    desc: 'Sets wait time before resending an LSP if no acknowledgement is received.',
    example: `R1(config-if)# isis retransmit-interval 5

R1# show clns interface Gi0/0 | include retransmit
  LSP retransmit interval: 5 sec

What it means:
- If the local router sends a unicast LSP and gets no PSNP ack
  within 5 s, it retransmits.
- Bump on high-latency satellite links to avoid spurious retransmits.` },

  { proto: 'ISIS', cmd: 'isis lsp-interval [msec]',
    desc: 'Paces LSP transmission to avoid overwhelming slow neighbors.',
    example: `R1(config-if)# isis lsp-interval 100

R1# show clns interface Gi0/0 | include lsp-interval
  LSP pacing interval: 100 ms

What it means:
- Minimum 100 ms gap between successive outbound LSPs on this
  interface — protects slow CPE that drops back-to-back LSPs.
- Default 33 ms.` },

  { proto: 'ISIS', cmd: 'isis csnp-interval [sec]',
    desc: 'Sets the interval for CSNPs (Complete Sequence Number Packets) on LANs.',
    example: `R1(config-if)# isis csnp-interval 10

R1# show clns interface Gi0/0 | include csnp
  CSNP interval: 10 sec

What it means:
- Only the DIS sends CSNPs on broadcast media. Default 10 s.
- CSNPs list every LSP in the LSDB so newcomers can detect missing
  ones and pull them with a PSNP request.
- Lengthen on stable LANs to reduce overhead.` },

  { proto: 'ISIS', cmd: 'show isis database detail',
    desc: 'Shows full TLV (Type-Length-Value) data inside the LSDB.',
    example: `R1# show isis database detail R2.00-00

R2.00-00  *  Seq 0x4 Checksum 0x9876  Holdtime 1180

  Area Address: 49.0001
  NLPID:        0xCC 0x8E
  Hostname:     R2-Edge
  IS Neighbor: R1.01           Metric: 10
  IS Neighbor: 3333.3333.3333  Metric: 20
  IP Address:  10.1.1.2
  Metric: 10  IP-Internal 10.1.1.0/24
  Metric: 0   IP-External 0.0.0.0/0   ← redistributed default

What it means:
- Decodes every TLV in R2's LSP — adjacencies, IP prefixes, hostname,
  TE info, etc.
- Use to confirm exactly what a peer is advertising when a route
  doesn't show up in your RIB.` },

  { proto: 'ISIS', cmd: 'isis mesh-group [id]',
    desc: 'Reduces LSP flooding in full-mesh topologies by pruning redundant paths.',
    example: `R1(config-if)# isis mesh-group 1

R1# show clns interface Gi0/0 | include mesh
  Mesh group: 1 (blocked)

What it means:
- All interfaces with the same mesh-group ID are part of the same
  flooding group. Within the group, LSPs received on one interface
  are NOT re-flooded out the others.
- Avoids LSP storms in full-mesh DCI topologies.
- "isis mesh-group blocked" stops flooding entirely on that interface.` },

  { proto: 'ISIS', cmd: 'bfd all-interfaces',
    desc: 'Enables BFD for sub-second adjacency failure detection.',
    example: `R1(config-router)# bfd all-interfaces
R1(config-if)# bfd interval 50 min_rx 50 multiplier 3

R1# show bfd neighbors
NeighAddr      LD/RD     RH/RS  State    Int
192.168.1.2    1/1       Up     Up       Gi0/0

What it means:
- BFD probes at 50 ms, 3 missed = down → IS-IS reconverges in
  ~150 ms instead of waiting for the 30 s holdtime.
- Both ends must support and configure BFD.` },

  { proto: 'ISIS', cmd: 'fast-reroute per-prefix',
    desc: 'Enables Loop-Free Alternate (LFA) for instant backup path activation.',
    example: `R1(config-router)# fast-reroute per-prefix level-2 all

R1# show isis fast-reroute
LFA enabled for level-2
Prefix      Primary       LFA Backup       Disjoint?
10.5.5.0/24 10.1.1.2/Gi0/0 10.2.2.2/Gi0/1   Yes

What it means:
- Pre-computes a loop-free alternate next-hop for every L2 prefix.
- On primary failure CEF flips to the backup in microseconds.
- "Disjoint" = the LFA path is genuinely independent of the primary.` },

  { proto: 'ISIS', cmd: 'fast-reroute ti-lfa',
    desc: 'Enables Topology-Independent LFA, providing 100% coverage in any topology.',
    example: `R1(config-router)# fast-reroute ti-lfa level-2

R1# show isis fast-reroute ti-lfa
TI-LFA: Level-2 enabled, 100% coverage
Prefix       Repair Path
10.5.5.0/24  SR Stack: 16005-16012  via Gi0/1

What it means:
- TI-LFA uses Segment Routing label stacks to compute a guaranteed
  loop-free backup path through the topology — even when classic
  LFA can't find one.
- Requires Segment Routing enabled on IS-IS (segment-routing mpls).` },

  { proto: 'ISIS', cmd: 'advertise-passive-only',
    desc: 'Security feature. Only advertises passive interfaces, ignoring active transit links.',
    example: `R1(config-router)# advertise-passive-only

R1# show isis | include passive-only
  Advertise passive only: enabled

What it means:
- Only passive-interface prefixes (typically loopbacks) are flooded
  in IS-IS LSPs.
- Transit-link prefixes are suppressed from the LSDB → smaller LSPs,
  faster SPF, and a stealthier underlay (transit IPs aren't routable
  from the customer side).` },

  { proto: 'ISIS', cmd: 'isis hello padding disable',
    desc: 'Stops padding hello packets. Saves bandwidth on MTU-stable links.',
    example: `R1(config-if)# no isis hello padding

R1# show clns interface Gi0/0 | include padding
  Hello padding: disabled

What it means:
- By default IS-IS Hellos are padded to MTU size as an MTU-mismatch
  smoke-test. Once you trust your MTU, disable padding to save BW.
- Padding mismatches between ends cause one-way Hello drops which
  show as INIT-state adjacencies that never come up.` },

  { proto: 'ISIS', cmd: 'distribute-list [acl] in',
    desc: 'Filters routes from being installed in the RIB (does not filter the LSDB).',
    example: `R1(config)# access-list 10 deny  10.99.0.0 0.0.255.255
R1(config)# access-list 10 permit any
R1(config-router)# distribute-list 10 in

R1# show ip route isis | include 10.99
(nothing — filtered from RIB)
R1# show isis database verbose | include 10.99
... LSA still in LSDB ...

What it means:
- Differs from OSPF distribute-list — IS-IS still keeps the prefix in
  the LSDB and floods it onward, just doesn't install it in THIS
  router's IP RIB.
- For full topology filtering, use route-map / prefix-list under
  redistribute on the originator instead.` },

  { proto: 'ISIS', cmd: 'isis authentication mode md5',
    desc: 'Enables MD5 HMAC for secure interface authentication.',
    example: `R1(config-if)# isis authentication mode md5
R1(config-if)# isis authentication key-chain ISIS-KC

R1# show clns interface Gi0/0 | include auth
  Authentication mode: HMAC-MD5, key-chain "ISIS-KC"

What it means:
- HMAC-MD5 protects all IS-IS PDU types on this interface.
- Replaces "isis password" with cryptographic protection.
- Key-chain allows graceful key rotation via overlapping lifetimes.` },

  { proto: 'ISIS', cmd: 'area-password [pass] mode md5',
    desc: 'Enables MD5 authentication for all L1 LSPs in the area.',
    example: `R1(config-router)# area-password PW2026 mode md5

R1# show isis | include Area auth
   Area authentication: HMAC-MD5

What it means:
- L1 LSPs and SNPs (CSNP/PSNP) are authenticated with HMAC-MD5
  using the shared password.
- Replaces cleartext "area-password". Mismatched keys silently drop
  L1 LSPs from the offender — adjacency stays up but routes vanish.` },

  { proto: 'ISIS', cmd: 'lsp-mtu [bytes]',
    desc: 'Adjusts maximum LSP size. Must be consistent across the entire area.',
    example: `R1(config-router)# lsp-mtu 1400

R1# show isis | include LSP MTU
  LSP MTU: 1400

What it means:
- Default 1492 (Ethernet w/ SAP). Lower if the underlying transport
  has a smaller MTU (PPPoE, GRE tunnels).
- MUST match across the entire area — mismatches cause LSPs to be
  silently dropped by transit routers, causing partial topology.` },

  { proto: 'ISIS', cmd: 'show isis spf-log',
    desc: 'Displays history of SPF calculations and what triggered them.',
    example: `R1# show isis spf-log

  Level    Log     SPFs        Last triggered     Trigger      Nodes
  Level-2  1       2026-04-30  14:23:01.123       LSP-RECV     5
  Level-2  2       2026-04-30  14:23:01.456       PERIODIC     5
  Level-2  3       2026-04-30  14:30:12.789       LSP-NEW      6

What it means:
- Each row is one SPF run with timestamp, trigger reason, and the
  node count in the SPT after the calculation.
- Trigger codes:
    LSP-NEW    : a new LSP arrived
    LSP-RECV   : a known LSP was updated
    PERIODIC   : housekeeping refresh
- Bursts of SPF runs in a short window indicate flapping links.` },

  { proto: 'ISIS', cmd: 'timers throttle spf [start] [hold] [max]',
    desc: 'Dampens SPF runs during network instability to save CPU.',
    example: `R1(config-router)# spf-interval 50 5000 5000

R1# show isis | include SPF
  SPF wait: initial 50ms, second-wait 5000ms, max-wait 5000ms

What it means:
- start  (50 ms)  : delay before the first SPF after a topology change.
- hold   (5000 ms): wait between back-to-back SPF runs.
- max    (5000 ms): cap during a flap storm.
- Mirrors OSPF "timers throttle spf". 50/5000/5000 is a sensible
  modern default — fast initial reaction, big back-off afterwards.` },

  { proto: 'ISIS', cmd: 'isis metric-style transition',
    desc: 'Allows coexistence of narrow and wide metrics during a migration.',
    example: `R1(config-router)# metric-style transition

R1# show isis | include metric
   Metric Style: TRANSITION (both narrow + wide TLVs)

What it means:
- Sends BOTH old (TLV 2/128) and new (TLV 22/135) versions of the
  metric in every LSP.
- Lets you migrate from narrow → wide gradually without breaking
  legacy IS-IS speakers.
- Switch back to plain "wide" once every router has been upgraded.` },
  { proto: 'ISIS', cmd: 'address-family ipv6',
    desc: 'Enables IPv6 routing context within the IS-IS process.',
    example: `R1(config-router)# address-family ipv6
R1(config-router-af)#

What it means:
- Enters the IPv6 sub-mode under "router isis". IPv6-specific
  redistribute, summary-address, and multi-topology commands live here.
- IS-IS is the rare IGP that handles IPv4 and IPv6 with one process —
  no separate "router isis6" needed.` },

  { proto: 'ISIS', cmd: 'ipv6 router isis [tag]',
    desc: 'Enables IPv6 on a specific interface; the IPv6 equivalent of ip router isis.',
    example: `R1(config-if)# ipv6 router isis CORE

R1# show isis ipv6 interface Gi0/0
GigabitEthernet0/0 is up, line protocol is up
   IS-IS IPv6: enabled
   Routing instance: CORE
   Topology: ipv6 unicast
   Adjacencies: 1 Level-2

What it means:
- Same role as "ip router isis" but for IPv6 prefixes.
- Single-topology mode (default): IPv4 and IPv6 share the same SPF
  result. With multi-topology, IPv6 gets its own SPF.` },

  { proto: 'ISIS', cmd: 'multi-topology',
    desc: 'Separates IPv4 and IPv6 topologies, allowing different paths for each.',
    example: `R1(config-router-af)# multi-topology

R1# show isis topology | include Multi
   Multi-Topology: ipv4 unicast, ipv6 unicast (independent)

What it means:
- Single-topology requires IPv4 and IPv6 enabled on the SAME set of
  interfaces — fine in green-field deployments, painful in mixed
  brown-field rollouts.
- Multi-topology calculates a separate SPT for IPv6 — IPv4 and IPv6
  can take different paths, and adjacencies don't have to be
  symmetrical between the two.` },

  { proto: 'ISIS', cmd: 'show ipv6 isis database',
    desc: 'Shows IPv6-specific LSPs, including IPv6 reachability TLVs.',
    example: `R1# show ipv6 isis database

IS-IS Level-2 Link State Database:
LSPID                LSP Seq Num  LSP Checksum  LSP Holdtime  ATT/P/OL
R1.00-00         *  0x00000004   0x4321        1198          0/0/0
R2.00-00            0x00000005   0x9876        1180          0/0/0
   IPv6 Reachability: 2001:DB8::/32   Metric: 10

What it means:
- Same LSDB shape as IPv4, but only LSPs containing IPv6 reachability
  TLV (236, MT-IPv6: TLV 237) are displayed.
- "IPv6 Reachability" entries map to IPv6 routes the originator
  is advertising.` },

  { proto: 'ISIS', cmd: 'show ipv6 isis neighbors',
    desc: 'Verifies IPv6 adjacencies and link-local address peering.',
    example: `R1# show ipv6 isis neighbors

System Id      Type Interface  IPv6 Address    State Holdtime
2222.2222.2222 L2   Gi0/0      FE80::2222      UP    25
3333.3333.3333 L2   Gi0/1      FE80::3333      UP    27

What it means:
- IS-IS adjacencies form over the link-local IPv6 address (FE80::/10),
  exactly the same as OSPFv3.
- No global IPv6 prefix is required to bring an adjacency up.
- Use this output to confirm IPv6 has both adjacencies and IS-IS
  control plane working.` },

  { proto: 'ISIS', cmd: 'redistribute ipv6 [protocol]',
    desc: 'Imports IPv6 routes from other protocols into IS-IS.',
    example: `R1(config-router-af)# redistribute static metric 30

R-neighbour# show ipv6 route isis | include 2001:DB8:99
i L2 2001:DB8:99::/48 [115/30] via FE80::1, Gi0/0   ← redistributed static

What it means:
- Run inside the "address-family ipv6" sub-mode (no "ipv6" keyword
  needed there).
- Default level is L2 unless you append "level-1".
- Set a sane seed metric or use "default-metric".` },

  { proto: 'ISIS', cmd: 'summary-address [ipv6-prefix]',
    desc: 'Summarizes IPv6 routes at the L1/L2 boundary.',
    example: `R1(config-router-af)# summary-address 2001:DB8:A::/48 level-2

R-backbone# show ipv6 route isis | include 2001:DB8:A
i L2 2001:DB8:A::/48 [115/20] via FE80::1, Gi0/0

What it means:
- IPv6 equivalent of the IPv4 summary-address. Aggregates more-specific
  /64s into a single /48 advertised at L2.
- Auto-installs a Null0 discard on the originating router.` },

  { proto: 'ISIS', cmd: 'show isis topology',
    desc: 'Displays the shortest path tree (SPT) calculated by the router.',
    example: `R1# show isis topology

IS-IS paths to level-2 routers
System Id      Metric    Next-Hop      Interface  SNPA
R2-Edge        10        R2-Edge       Gi0/0      000c.abcd.0002
R3-Core        20        R2-Edge       Gi0/0      000c.abcd.0002
R4-Spoke       30        R2-Edge       Gi0/0      000c.abcd.0002

What it means:
- The Shortest Path Tree (SPT) computed by SPF — every reachable
  IS-IS router with the path metric, the immediate next-hop neighbour,
  and the egress interface.
- "R3-Core via R2-Edge" means traffic to R3 transits R2.` },

  { proto: 'ISIS', cmd: 'isis ipv6 metric [val]',
    desc: 'Sets a different cost for IPv6 than IPv4 (requires multi-topology).',
    example: `R1(config-if)# isis ipv6 metric 100 level-2

R1# show isis ipv6 interface Gi0/0 | include Metric
  Level-2 Metric: 100  (IPv6)
  Level-2 Metric: 10   (IPv4)

What it means:
- With multi-topology enabled, IPv4 and IPv6 can have different costs
  on the same interface — useful when IPv6 traffic should prefer a
  different path than IPv4.
- Without multi-topology, this knob is silently ignored (one shared
  metric).` },

  { proto: 'ISIS', cmd: 'adjacency-check',
    desc: 'Ensures neighbor is reachable via IP before forming IS-IS adjacency (enabled by default).',
    example: `R1(config-router)# adjacency-check

R1# show isis | include adjacency-check
   Adjacency check: Enabled

What it means:
- Default behaviour: IS-IS verifies that IPv4 (or IPv6) reachability
  exists between the local interface and the peer's interface BEFORE
  declaring the adjacency UP.
- Disabling it ("no adjacency-check") allows CLNS-only adjacencies —
  required for some MPLS-TE label-switched-only links where IP isn't
  configured.` },

  { proto: 'ISIS', cmd: 'isis display-name',
    desc: 'Shows hostnames instead of System IDs in the database output.',
    example: `R1(config-router)# isis display hostname

R1# show isis database
LSPID                LSP Seq Num  LSP Checksum
R1                *  0x00000003   0x4321
R2-Edge              0x00000004   0x9876
R3-Core              0x00000005   0x1234

What it means:
- Replaces the raw 6-byte System ID with the hostname (TLV 137) in
  every show output. Massively easier to read.
- Requires "hostname dynamic" on the originating router or static
  "isis hostname" mappings.` },

  { proto: 'ISIS', cmd: 'show clns neighbors',
    desc: 'Displays Layer 2 neighbor table, showing SNPA (MAC addresses).',
    example: `R1# show clns neighbors

System Id      Interface  SNPA           State Holdtime  Type Protocol
R2-Edge        Gi0/0      000c.abcd.0002 Up    25        L2   IS-IS
R3-Core        Gi0/1      000c.abcd.0003 Up    27        L1L2 IS-IS

What it means:
- L2 view of IS-IS adjacencies — includes the peer's MAC address (SNPA
  on Ethernet).
- Use to confirm CLNS-layer connectivity (for example when IPv4 is
  removed but the IS-IS adjacency must still hold).` },

  { proto: 'ISIS', cmd: 'max-area-addresses [1-25]',
    desc: 'Configures the number of Area IDs a router can belong to (default is 3).',
    example: `R1(config-router)# max-area-addresses 5

R1# show isis | include area-addr
  Maximum area addresses: 5

What it means:
- A router can be in multiple areas at once via additional "net"
  statements. Default cap is 3.
- Useful during area renumbering — temporarily belong to both old
  and new area, migrate hosts, then drop the old NET.
- All routers in the same area must agree on the value.` },

  { proto: 'ISIS', cmd: 'isis nsf [cisco|ietf]',
    desc: 'Enables Non-Stop Forwarding, keeping traffic flowing during a crash.',
    example: `R1(config-router)# nsf cisco

R1# show isis nsf
   Non-stop forwarding: Enabled (Cisco mode)
   Last NSF restart: 00:00:00 ago (took 12 secs)

What it means:
- Cisco mode  : Cisco-proprietary NSF, signalled via T2 TLV.
- IETF mode   : RFC 5306 graceful-restart, signalled via Restart TLV.
- During RP failover, neighbour holds the adjacency in helper mode
  while the new RP rebuilds state. Pick the mode supported by your
  peers — both ends must agree.` },

  { proto: 'ISIS', cmd: 'show isis nsf',
    desc: 'Checks NSF status and if neighbors are NSF-aware.',
    example: `R1# show isis nsf

   Non-stop forwarding: Enabled
   Last NSF restart: 00:00:00 ago (took 0 secs)
   Neighbors:
     2.2.2.2 — NSF helper mode
     3.3.3.3 — NSF capable
     4.4.4.4 — NOT NSF-aware

What it means:
- "NSF-aware" / "helper mode" peers will not drop the adjacency
  during this router's RP failover.
- "NOT NSF-aware" is a single point of failure — that adjacency
  resets during a failover, defeating NSF for that path.` },

  { proto: 'ISIS', cmd: 'isis authenticate key-chain [name]',
    desc: 'Uses a key-chain for password rotation (MD5/SHA-1) on an interface.',
    example: `R1(config)# key chain ISIS-KC
R1(config-keychain)# key 1
R1(config-keychain-key)# key-string SECRET2026
R1(config-keychain-key)# accept-lifetime 00:00:00 Jan 1 2026 00:00:00 Jan 1 2027
R1(config-if)# isis authentication key-chain ISIS-KC

R1# show clns interface Gi0/0 | include key-chain
   Authentication key-chain: ISIS-KC

What it means:
- Key-chain object stores multiple keys with overlapping
  accept-lifetime / send-lifetime windows — supports hitless key
  rotation.
- Required input for "isis authentication mode md5/hmac-sha-1".` },

  { proto: 'ISIS', cmd: 'address-family ipv4 unicast',
    desc: 'Enters the IPv4 sub-mode for specific redistribution or summary rules.',
    example: `R1(config-router)# address-family ipv4 unicast
R1(config-router-af)# redistribute static metric 20 level-2

What it means:
- Newer multi-AF "router isis" syntax (analogous to BGP's address-
  family sub-modes). IPv4-specific knobs go here.
- Equivalent settings can also be made directly under "router isis"
  for backward compatibility.` },

  { proto: 'ISIS', cmd: 'distance [1-255]',
    desc: 'Changes the Administrative Distance for IS-IS (default is 115).',
    example: `R1(config-router)# distance 120

R1# show ip protocols | include Distance
  Distance: (default is 120)

What it means:
- Default IS-IS AD is 115 (lower than OSPF 110, higher than EIGRP-int
  90). Bumping to 120 makes IS-IS lose to RIP — usually undesirable
  but useful in migration scenarios where you want to prefer the new
  protocol.` },

  { proto: 'ISIS', cmd: 'isis adjacency-filter [acl]',
    desc: 'Restricts which routers can form adjacencies based on their System ID.',
    example: `R1(config)# clns filter-set ALLOW-PEERS deny  4444.4444.4444
R1(config)# clns filter-set ALLOW-PEERS permit default
R1(config-if)# isis adjacency-filter ALLOW-PEERS

R1# show clns interface Gi0/0 | include filter
   Adjacency filter: ALLOW-PEERS

What it means:
- Hellos from filtered System IDs are silently dropped — adjacency
  never comes up.
- Belt-and-braces alongside auth: even if the rogue router has the
  right key, its System ID gets blocked.` },

  { proto: 'ISIS', cmd: 'show isis lsp-log',
    desc: 'Logs recent LSP arrivals, helping track topology churn.',
    example: `R1# show isis lsp-log

  Level    LSP Seq      Source            When        Reason
  Level-2  0x00000004   2222.2222.2222    00:01:23    Updated
  Level-2  0x00000003   3333.3333.3333    00:02:45    New
  Level-2  0x00000005   2222.2222.2222    00:01:21    Updated

What it means:
- Ring buffer of incoming LSPs (and corresponding SPF triggers) with
  timestamps and origin.
- Repeated "Updated" entries from the same source over a short
  window indicates that router is flapping — investigate its links.` },

  { proto: 'ISIS', cmd: 'isis protocol [ipv4|ipv6]',
    desc: 'Explicitly defines which protocols the IS-IS process should support.',
    example: `R1(config-if)# isis ipv6 disable    ! IPv4 only on this link
   or
R1(config-if)# no ip router isis      ! IPv6 only on this link

R1# show isis ipv6 interface Gi0/0
GigabitEthernet0/0 is up
   IS-IS IPv6: disabled

What it means:
- Per-interface control over which AFs use this interface for IS-IS
  routing — useful when IPv4 and IPv6 take different paths in a
  multi-topology design.
- Default: both AFs are enabled if both are present globally.` },

  { proto: 'ISIS', cmd: 'set-overload-bit on-startup wait-for-bgp',
    desc: 'Keeps Overload bit on until BGP is fully established.',
    example: `R1(config-router)# set-overload-bit on-startup wait-for-bgp

R1# show isis | include overload
  Set overload bit on-startup: wait-for-bgp
  Time remaining: pending BGP convergence

What it means:
- The OL bit stays set until ALL eBGP sessions are established AND
  RIB-converged (signalled via "rib-converged" or RIB-stable timer).
- More robust than a fixed timer — works even when BGP takes longer
  than expected to converge after a reload.` },

  { proto: 'ISIS', cmd: 'isis circuit-id [val]',
    desc: 'Manually sets the local circuit ID, useful for identifying links in the LSDB.',
    example: `R1(config-if)# isis circuit-id 01

R1# show isis database | include R1
R1.00-00      *  Seq 0x4 ...   ← node LSP
R1.01-00      *  Seq 0x1 ...   ← pseudonode LSP, circuit-id 01

What it means:
- The circuit-id is appended after the System ID for pseudonode LSPs
  on broadcast LANs. Default is auto-assigned (0x01, 0x02, …).
- Manual assignment makes it deterministic — easier to spot a
  specific LAN's pseudonode LSP in the LSDB.` },

  { proto: 'ISIS', cmd: 'show isis rib',
    desc: 'Displays the internal IS-IS route table before it is sent to the global RIB.',
    example: `R1# show isis rib

  Codes: > - Best path, * - Installed in global RIB

   IPv4 Local RIB
   Prefix          Metric  Type   Next-Hop     Interface
*> 10.5.5.0/24     20      L2     192.168.1.2  Gi0/0
*> 10.6.6.0/24     30      L2     192.168.1.2  Gi0/0
   10.7.7.0/24     40      L2     192.168.1.3  Gi0/1   ← lost AD battle

What it means:
- IS-IS-internal table. ">" = best within IS-IS. "*" = installed in
  global RIB.
- A row with > but no * means the path is best in IS-IS but lost the
  AD battle to another protocol (OSPF AD 110 < IS-IS AD 115).` },

  { proto: 'ISIS', cmd: 'isis remote-lfa',
    desc: 'Enables Remote LFA, providing backup paths in ring-based topologies.',
    example: `R1(config-router)# fast-reroute remote-lfa level-2 mpls-ldp

R1# show isis fast-reroute remote-lfa
Prefix       Repair Path
10.5.5.0/24  via R-PQ-Node 5.5.5.5 (LDP label 22000)

What it means:
- Classic LFA can't protect ring topologies because every backup
  path loops back through the failed link.
- Remote LFA picks a "PQ node" deeper in the network and tunnels the
  protected packet there via an MPLS LDP-signalled targeted-LSP,
  effectively skipping the broken link.` },

  { proto: 'ISIS', cmd: 'debug isis adj-packets',
    desc: 'Shows Hello packet exchange to troubleshoot neighbor stuck in INIT state.',
    example: `R1# debug isis adj-packets
ISIS Adjacency Packet debugging is on

ISIS-Adj: Sending L1 IIH on Gi0/0, length 1497
ISIS-Adj: Rec L1 IIH from 000c.abcd.0002 (R2-Edge), length 1497
ISIS-Adj: Adjacency to R2-Edge changed from INIT to UP

What it means:
- Logs every IIH (IS-IS Hello) sent and received.
- Use to diagnose stuck-INIT adjacencies — usually MTU mismatch,
  area mismatch, or auth failure shows up as one-way Hellos.` },

  { proto: 'ISIS', cmd: 'debug isis update-packets',
    desc: 'Logs LSP, CSNP, and PSNP exchanges to find database sync issues.',
    example: `R1# debug isis update-packets
ISIS Update Packet debugging is on

ISIS-Upd: Rec L2 LSP 2222.2222.2222.00-00, seq 0x4 from R2-Edge
ISIS-Upd: Sending L2 PSNP on Gi0/0, requesting LSP 3333.3333.3333.00-00
ISIS-Upd: Rec L2 CSNP on Gi0/0 from R2-Edge

What it means:
- Logs LSP, CSNP, and PSNP packets — the core LSDB-sync mechanics.
- Use to debug database mismatches: an LSP that R1 thinks is missing
  vs what R2 advertises in CSNPs.` },

  { proto: 'ISIS', cmd: 'debug isis spf',
    desc: 'Real-time SPF computation logs. Warning: very CPU intensive.',
    example: `R1# debug isis spf
ISIS SPF debugging is on

ISIS-Spf: Running L2 partial SPF (1 nodes affected)
ISIS-Spf:   Adjacency 2222.2222.2222 metric 10
ISIS-Spf:   Adjacency 3333.3333.3333 metric 20
ISIS-Spf: SPF complete in 4 ms, 5 nodes evaluated, 12 paths installed

What it means:
- Logs every SPF run — full or partial.
- Very CPU-heavy on a busy router; turn off as soon as you have what
  you need ("undebug all").
- Prefer "show isis spf-log" for post-mortem analysis.` },

  { proto: 'ISIS', cmd: 'show isis database verbose',
    desc: 'Shows full details including TLV sub-types, used for debugging MPLS-TE.',
    example: `R1# show isis database verbose R2-Edge.00-00

R2-Edge.00-00         0x00000004   0x9876        1180          0/0/0
  Area Address: 49.0001
  NLPID:       0xCC 0x8E
  Hostname:    R2-Edge
  IS Neighbor: R3-Core, Metric: 10
   Sub-TLV: Local IPv4 Address: 192.168.1.2
   Sub-TLV: Maximum Bandwidth: 1G
   Sub-TLV: Maximum Reservable BW: 800M
   Sub-TLV: Unreserved BW (TE-class 0): 800M

What it means:
- Decodes every TLV including Sub-TLVs — essential for debugging
  MPLS-TE because the TE link attributes live inside Sub-TLV blocks.
- Compare Reservable vs Unreserved bandwidth to see how much TE
  capacity is currently free.` },

  { proto: 'ISIS', cmd: 'isis 3-way-handshake',
    desc: 'Enables RFC 3373 3-way handshake for P2P links (enabled by default on newer IOS).',
    example: `R1(config-if)# isis three-way-handshake

R1# show clns interface Gi0/0 | include 3-way
  3-way handshake: Enabled (per RFC 3373)

What it means:
- Classic IS-IS used a 2-way handshake on P2P links — vulnerable to
  asymmetric link-loss "half-up" adjacencies.
- 3-way handshake (RFC 3373) makes each side acknowledge the other's
  state in IIHs — symmetric up/down detection.
- ON by default in modern IOS XE.` },

  { proto: 'ISIS', cmd: 'isis interface-type [broadcast|point-to-point]',
    desc: 'Changes the network type of an interface.',
    example: `R1(config-if)# isis network point-to-point

R1# show clns interface Gi0/0 | include type
  Network type: Point-to-point

What it means:
- broadcast (default on Ethernet): elects DIS, generates pseudonode
  LSPs.
- point-to-point: skips DIS election, smaller LSDB, faster
  convergence — preferred on back-to-back router links.
- Both ends MUST agree.` },

  { proto: 'ISIS', cmd: 'show clns',
    desc: 'Displays global CLNS settings and the router\'s NET address.',
    example: `R1# show clns

  Global CLNS information:
    1 IS-IS level-1-2 Routers (CORE)
      Configured NET: 49.0001.1111.1111.1111.00
      Routing for area: 49.0001
      System ID: 1111.1111.1111
      Hostname: R1

What it means:
- Quick summary of CLNS / IS-IS identity. Confirms NET, area,
  System ID and hostname before drilling into per-protocol detail.` },

  { proto: 'ISIS', cmd: 'propagate [level-1|level-2]',
    desc: 'Leaks L2 routes into L1 (Route Leaking). Allows L1 routers to see the backbone.',
    example: `R1-L1L2(config-router)# redistribute isis ip level-2 into level-1 route-map LEAK
R1(config)# route-map LEAK permit 10
R1(config-route-map)# match ip address prefix-list IMPORTANT

R-internal-L1# show ip route isis | include i.ia
i ia 192.0.2.0/24 [115/30] via 192.168.1.1, Gi0/0

What it means:
- L1 routers normally only see other L1 routers' prefixes plus a
  default to the nearest L1L2 (attached bit).
- Route-leaking pushes specific L2 prefixes down into L1 so internal
  routers can pick the optimal exit ABR for those prefixes.
- "i ia" code = inter-area IS-IS route.` },

  { proto: 'ISIS', cmd: 'show isis database [lspid]',
    desc: 'Examines one specific LSP to see its contents and age.',
    example: `R1# show isis database R3-Core.00-00

R3-Core.00-00         0x00000005   0x1234        1180          0/0/0
  Area Address: 49.0001
  NLPID: 0xCC 0x8E
  Hostname: R3-Core
  IS Neighbor: R2-Edge, Metric: 10
  IS Neighbor: R4-Spoke, Metric: 10
  IP Address: 3.3.3.3
  Metric: 10  IP-Internal 192.168.30.0/24

What it means:
- Single-LSP view for a specific node — much narrower than
  "show isis database" which lists every LSP.
- Use to confirm exactly what a peer is advertising about itself.` },

  { proto: 'ISIS', cmd: 'isis overload-bit suppress',
    desc: 'Prevents the router from setting the overload bit even if memory is low (Dangerous).',
    example: `R1(config-router)# isis overload-bit suppress interlevel external

R1# show isis | include overload
  Overload-bit suppression: interlevel and external routes

What it means:
- Even when overload-on-startup or low-memory triggers OL, leak
  inter-level and external routes anyway.
- Dangerous on low-memory boxes — memory exhaustion was the reason
  the bit got set in the first place. Use only when you understand
  the consequences.` },

  { proto: 'ISIS', cmd: 'passive-interface default',
    desc: 'Global passive mode. You must then use no passive on transit links.',
    example: `R1(config-router)# passive-interface default
R1(config-router)# no passive-interface GigabitEthernet0/0

R1# show clns interface | include passive
  Loopback0       : passive (advertised, no IIH)
  GigabitEthernet0/0 : active
  GigabitEthernet0/1 : passive (advertised, no IIH)

What it means:
- Inverts the default — every interface is passive UNLESS explicitly
  un-passived. Best-practice on access-layer routers to prevent
  rogue adjacencies.` },

  { proto: 'ISIS', cmd: 'isis lsp-password [pass]',
    desc: 'Authenticates all LSPs generated by this router.',
    example: `R1(config-router)# authentication mode md5 level-2
R1(config-router)# authentication key-chain ISIS-KC level-2

R1# show isis | include LSP authentication
  L2 LSP authentication: HMAC-MD5 (key-chain ISIS-KC)

What it means:
- Domain/area passwords protect L2/L1 LSPs respectively. The key-chain
  variant supports hitless rotation.
- Mismatched LSP auth silently drops LSPs from the offender — routes
  vanish but adjacency stays UP. Always log adjacency-changes AND
  monitor "show isis statistics" for auth failures.` },

  { proto: 'ISIS', cmd: 'show isis database private',
    desc: 'Hidden command that shows internal database pointers for deep troubleshooting.',
    example: `R1# show isis database private

   Internal LSDB structures (debug-level):
   LSP R1.00-00  Pointer: 0x8A4BC00  In-flooding-list: yes
                 Refresh-pending: no  Acks-pending: 0

What it means:
- Hidden Cisco command (not in "show ?" but accepted).
- Shows internal pointers and queue state. Used by Cisco TAC for
  deep memory-corruption / state-machine bugs.
- Don't rely on this output remaining stable across IOS versions.` },

  { proto: 'ISIS', cmd: 'isis ignore-lsp-errors',
    desc: 'Keeps adjacencies up even if the neighbor sends a malformed LSP.',
    example: `R1(config-router)# ignore-lsp-errors

R1# show isis | include ignore
  Ignore LSP errors: enabled

What it means:
- Default: a corrupt LSP triggers a purge AND an adjacency reset.
- "ignore" keeps the adjacency UP and silently drops the bad LSP —
  resilient against bit errors but masks real bugs in the peer.
- Counter "Errors: corrupted LSPs" still increments in show stats.` },

  { proto: 'ISIS', cmd: 'ipv6 router isis [tag] area-tag [id]',
    desc: 'Segments IPv6 interfaces into different area contexts.',
    example: `R1(config-if)# ipv6 router isis CORE-V6

R1# show isis ipv6 interface Gi0/0
GigabitEthernet0/0
   Routing instance: CORE-V6
   Topology: ipv6 unicast

What it means:
- Lets a single router run multiple IS-IS instances tagged with
  different names for IPv4 vs IPv6 — useful when you want completely
  independent IPv4 and IPv6 IS-IS topologies.
- Most deployments share a single instance for both AFs (cleaner
  config); this is the exotic-deployment knob.` },

  { proto: 'ISIS', cmd: 'show isis interface detail',
    desc: 'Detailed interface state, including DIS status and next hello time.',
    example: `R1# show isis interface Gi0/0 detail

GigabitEthernet0/0 is up, line protocol is up
  Routing Protocol: IS-IS (CORE)
  Circuit Type: level-1-2
  Local circuit ID: 0x1
  Extended Local Circuit ID: 0x00000003
  Level-2 Designated IS: R1.01    ← we are DIS
  Next IS-IS LAN Level-2 Hello in 2 seconds
  Number of active level-2 adjacencies: 1
  LSPs sent on this interface: 14
  Hello PDUs sent: 1240, dropped: 0

What it means:
- Most detailed per-interface view. "Designated IS" confirms DIS
  state. "Next Hello in 2s" confirms outbound timing.
- "Hello PDUs dropped > 0" usually means QoS or congestion is
  hurting IS-IS — investigate.` },

  { proto: 'ISIS', cmd: 'isis priority 0',
    desc: 'Ensures a router NEVER becomes the DIS on a segment.',
    example: `R1(config-if)# isis priority 0 level-2

R1# show clns interface Gi0/0 | include Priority
  Level-2 Priority: 0 (will not become DIS)

What it means:
- Priority 0 strongly discourages DIS election but does NOT prevent
  it absolutely (IS-IS supports preemption — a higher-priority
  router takes over immediately).
- For "never DIS" guarantees, also use is-type / circuit-type to
  restrict the level on this interface.` },

  { proto: 'ISIS', cmd: 'show clns traffic',
    desc: 'Packet statistics for the CLNS engine, including dropped packets.',
    example: `R1# show clns traffic

  IS-IS: Time since last clear: never
  IS-IS: Hellos sent: 1860, received: 1858, dropped: 0
  IS-IS: LSPs sent: 14,    received: 32,   dropped: 0
  IS-IS: CSNPs sent: 240,  received: 240
  IS-IS: PSNPs sent: 12,   received: 14
  IS-IS: Auth fail: 0,  area-id mismatch: 0,  bad checksum: 0

What it means:
- L2 packet counters for the CLNS engine.
- "Auth fail / area-id mismatch / bad checksum" being 0 confirms
  no rogue routers are attempting to peer.
- Dropped > 0 with no obvious cause hints at QoS or buffer issues.` },

  { proto: 'ISIS', cmd: 'isis hello-multiplier 10',
    desc: 'Increases the hold time for unstable links to prevent flapping.',
    example: `R1(config-if)# isis hello-multiplier 10

R1# show clns interface Gi0/0 | include Hello
  Hello (sec): 10, Multiplier: 10, Hold Time: 100

What it means:
- Hold time = hello × multiplier = 10 × 10 = 100 seconds.
- Use on flaky satellite/long-haul links — rides out brief packet-
  loss bursts without declaring the adjacency dead.
- Trade-off: slower failure detection on real outages.` },

  { proto: 'ISIS', cmd: 'clear isis adjacency [system-id]',
    desc: 'Resets only one specific neighbor instead of the whole process.',
    example: `R1# clear isis adj 1111.1111.1111

%CLNS-5-ADJCHANGE: ISIS: Adjacency to R1-Other (Gi0/0) Down, manually cleared
%CLNS-5-ADJCHANGE: ISIS: Adjacency to R1-Other (Gi0/0) Up, new adjacency

What it means:
- Targeted reset — only the named neighbour bounces. Other
  adjacencies and the LSDB itself are untouched.
- Useful after auth/key changes that affect just one peer.` },

  { proto: 'ISIS', cmd: 'show isis database l1-only',
    desc: 'Filters LSDB view to only show Level 1 internal area info.',
    example: `R1# show isis database level-1

IS-IS Level-1 Link State Database:
LSPID                LSP Seq Num  LSP Checksum  LSP Holdtime
R1.00-00         *  0x00000003   0x4321        1198
R2-Edge.00-00       0x00000004   0x9876        1180

What it means:
- Restricts output to L1 LSPs only (in-area). Useful on L1L2 routers
  where the global "show isis database" is overwhelming.
- "show isis database level-2" shows only the backbone half.` },

  { proto: 'ISIS', cmd: 'isis lsp-mtu 1492',
    desc: 'Optimizes LSPs for PPPoE or tunnel interfaces with smaller MTUs.',
    example: `R1(config-router)# lsp-mtu 1492

R1# show isis | include LSP MTU
  LSP MTU: 1492

What it means:
- Drops LSP MTU from 1497 (Ethernet w/ SAP) down to 1492 to fit
  PPPoE or GRE-encapsulated paths without fragmenting.
- MUST match across the entire area, otherwise transit routers
  silently drop oversize LSPs and cause partial topology.` },

  { proto: 'ISIS', cmd: 'isis name-lookup',
    desc: 'Enables DNS-style lookups for System IDs in debugs/logs.',
    example: `R1(config-router)# hostname dynamic

R1# show isis hostname
Level  System ID         Hostname
L2     1111.1111.1111    R1 (local)
L2     2222.2222.2222    R2-Edge
L2     3333.3333.3333    R3-Core

What it means:
- "hostname dynamic" makes IS-IS originate a TLV 137 (Dynamic
  Hostname) so peers can map System IDs ↔ hostnames.
- Combined with "isis display hostname" everywhere, makes show
  output massively more readable.` },

  { proto: 'ISIS', cmd: 'isis rib-group [name]',
    desc: 'Shares IS-IS routes with other routing tables or address families.',
    example: `R1(config)# rib-group MY_TABLE
R1(config-rib-group)# import-rib ipv4 unicast topology base
R1(config-router)# rib-group MY_TABLE

R1# show ip route rib-group MY_TABLE
... (IS-IS routes also installed in this group's RIB) ...

What it means:
- RIB groups let you push IS-IS routes into multiple RIBs at once
  — useful for export to another VRF or for having a parallel
  copy in a custom RIB consumed by an SDN controller.
- Largely an XR/IOS-XE feature; older platforms may not support it.` }
];

// ---------------------- Apply ----------------------
const stats = {};
for (const p of PLATFORMS) stats[p] = { updated: 0, alreadyHadExample: 0, addedNew: 0, sectionCreated: 0 };

const seen = new Set();
let totalEntries = 0;

for (const e of ENTRIES) {
  const key = e.proto + '||' + e.cmd;
  if (seen.has(key)) continue;
  seen.add(key);
  totalEntries++;

  const sectionName = SECTION[e.proto];
  if (!sectionName) { console.warn('  unknown proto:', e.proto); continue; }
  const t = classify(e.cmd);

  for (const p of PLATFORMS) {
    const plat = data.platforms[p];
    if (!plat) continue;
    plat.sections ||= {};
    if (!plat.sections[sectionName]) {
      plat.sections[sectionName] = [];
      stats[p].sectionCreated++;
    }
    const sec = plat.sections[sectionName];

    const existing = sec.find(c => c.cmd === e.cmd);
    if (existing) {
      if (!existing.example) {
        existing.example = e.example;
        stats[p].updated++;
      } else {
        stats[p].alreadyHadExample++;
      }
      if (!existing.desc && e.desc) existing.desc = e.desc;
    } else {
      sec.push({
        cmd: e.cmd,
        desc: e.desc || '',
        type: t,
        flagged: false,
        example: e.example
      });
      stats[p].addedNew++;
    }
  }
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`\nUnique entries (post-dedup): ${totalEntries}`);
for (const p of PLATFORMS) {
  console.log(`\n${p}:`);
  console.log(`  Existing updated with example: ${stats[p].updated}`);
  console.log(`  Existing already had example:  ${stats[p].alreadyHadExample}`);
  console.log(`  New commands added:            ${stats[p].addedNew}`);
  console.log(`  New sections created:          ${stats[p].sectionCreated}`);
}
