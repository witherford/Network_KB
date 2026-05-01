// Cisco IOS enrichment batch 4 (Stage 3): Routing (40) + Security (57) = 97 entries.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const IOS  = data.platforms.ciscoios;

const ENTRIES = [
  // ============== Routing ==============
  { cmd: 'show ip route <prefix>',
    example: `R1# show ip route 10.20.0.0

Routing entry for 10.20.0.0/24
  Known via "ospf 1", distance 110, metric 2, type intra area
  Last update from 192.168.1.2 on GigabitEthernet0/0, 02:14:21 ago
  Routing Descriptor Blocks:
  * 192.168.1.2, from 2.2.2.2, 02:14:21 ago, via GigabitEthernet0/0
      Route metric is 2, traffic share count is 1

What it means:
- Detail for one specific prefix in the RIB.
- "Known via X, distance N" : the protocol that won the AD battle.
- "Routing Descriptor Blocks" : actual next-hops being used. "*"
  marks the active path; multiple = ECMP.
- "from 2.2.2.2" : the originator's router-id (for OSPF/BGP).` },

  { cmd: 'show ip ospf interface',
    example: `R1# show ip ospf interface

GigabitEthernet0/0 is up, line protocol is up
  Internet Address 192.168.1.1/24, Area 0, Attached via Network Statement
  Process ID 1, Router ID 1.1.1.1, Network Type BROADCAST, Cost: 1
  Topology-MTID  Cost  Disabled  Shutdown  Topology Name
        0           1     no        no        Base
  Transmit Delay is 1 sec, State BDR, Priority 1
  Designated Router (ID) 2.2.2.2, Interface address 192.168.1.2
  Backup Designated Router (ID) 1.1.1.1, Interface address 192.168.1.1
  Timer intervals configured, Hello 10, Dead 40, Wait 40, Retransmit 5

What it means:
- Per-interface OSPF state. Network Type drives whether DR/BDR
  election runs.
- "State BDR" : this router is the Backup Designated Router on
  this segment.
- Hello/Dead intervals : must match exactly between neighbours.
- "Cost: 1" : OSPF metric for this interface (lower is better).` },

  { cmd: 'show ip bgp neighbors',
    example: `R1# show ip bgp neighbors

BGP neighbor is 10.10.10.2, remote AS 65002, external link
 BGP version 4, remote router ID 2.2.2.2
 BGP state = Established, up for 02:14:21
 Last read 00:00:14, last write 00:00:14, hold time is 180, keepalive is 60
 Neighbor sessions:
   1 active, is not multisession capable
 Neighbor capabilities:
   Route refresh: advertised and received(new)
   Four-octets ASN Capability: advertised and received
   Address family IPv4 Unicast: advertised and received

What it means:
- Detailed peer state. "Established" + uptime > 0 = healthy.
- "hold time 180, keepalive 60" : peer sends keepalives every
  60s; if no traffic for 180s the session drops.
- "Route refresh advertised and received" : both ends support
  RFC 2918 refresh — soft reconfiguration without dropping
  the session.` },

  { cmd: 'show ip protocols',
    example: `R1# show ip protocols

Routing Protocol is "ospf 1"
  Outgoing update filter list for all interfaces is not set
  Incoming update filter list for all interfaces is not set
  Router ID 1.1.1.1
  Number of areas: 1 normal, 0 stub, 0 nssa
  Maximum path: 4
  Routing for Networks:
    10.0.0.0 0.255.255.255 area 0
  Passive Interface(s):
    Loopback0
  Routing Information Sources:
    Gateway     Distance  Last Update
    2.2.2.2          110  02:14:21
  Distance: (default is 110)

Routing Protocol is "bgp 65001"
  ...

What it means:
- Summary of every active routing protocol with config + state.
- "Maximum path: 4" : ECMP capacity for this protocol.
- "Routing for Networks" : which networks the protocol advertises.
- "Routing Information Sources" : neighbours actively contributing
  routes — empty list = no peers.` },

  { cmd: 'show ip cef <prefix>',
    example: `R1# show ip cef 8.8.8.8

8.8.8.8/32, version 142
  nexthop 198.51.100.1 GigabitEthernet0/0

What it means:
- CEF (Cisco Express Forwarding) entry for the prefix — the
  hardware-fast-path lookup result.
- "version 142" : CEF table revision (incremented on changes).
- "nexthop X" : where packets to this destination are sent.
- Different from "show ip route" which shows the RIB; CEF is
  the FIB (forwarding table actually used by hardware).` },

  { cmd: 'show adjacency <int> detail',
    example: `R1# show adjacency gi0/0 detail

Protocol  Interface           Address
IP        GigabitEthernet0/0  198.51.100.1(7)
                              0 packets, 0 bytes
                              epoch 0
                              sourced in sev-epoch 0
                              Encap length 14
                              001A1E11223300C0FFEE12340800

What it means:
- Per-interface CEF adjacency table — pre-computed L2 rewrite
  info ready for fast-path forwarding.
- "Encap length 14" : Ethernet header (6 dst + 6 src + 2 EtherType).
- "001A1E11223300C0FFEE12340800" : full L2 header bytes ready
  to prepend to outbound packets.
- Empty / incomplete adjacency = ARP not resolved → packets
  punted to CPU.` },

  { cmd: 'show ipv6 route',
    example: `R1# show ipv6 route

IPv6 Routing Table - default - 8 entries
Codes: C - Connected, L - Local, S - Static, R - RIP, B - BGP
       O - OSPF Intra, OI - OSPF Inter, OE1 - OSPF ext 1, OE2 - OSPF ext 2

C   2001:DB8::/64 [0/0]
     via GigabitEthernet0/0, directly connected
L   2001:DB8::1/128 [0/0]
     via GigabitEthernet0/0, receive
O   2001:DB8:10::/64 [110/2]
     via FE80::2, GigabitEthernet0/0
B   2001:DB8:200::/40 [20/0]
     via FE80::3, GigabitEthernet0/0

What it means:
- IPv6 RIB. Codes match the IPv4 equivalents (O = OSPF, B = BGP,
  S = static, C = connected).
- "via FE80::2" : IPv6 next-hops are typically link-local
  (peer's link-local address) — no need for global routing
  to reach the peer.
- "[110/2]" : AD/metric pair, same semantics as IPv4.` },

  { cmd: 'ip route <net> <mask> <next-hop> [name <tag>] [track <obj>]',
    example: `R1(config)# ip route 192.168.99.0 255.255.255.0 10.10.10.1 name BACKUP_ROUTE track 10

R1# show ip route 192.168.99.0 | include name|track
   route name: BACKUP_ROUTE
   route is tracked: track-10

What it means:
- "name TAG" : free-form documentation; visible in show output.
- "track N" : conditional install — route only programmed when
  track-object N reports Up.
- Use track-objects + tracked routes to implement IP SLA-based
  failover (e.g. install ISP-A default only when ISP-A's
  loopback is reachable).` },

  { cmd: 'show ip route summary',
    example: `R1# show ip route summary

IP routing table name is default (0x0)
IP routing table maximum-paths is 4

Route Source    Networks    Subnets    Replicates    Memory(b)
connected       0           5          0             1280
static          1           4          0             1024
ospf 1          0           42         0             10752
bgp 65001       8           4502       0             1153536
internal        12          0          0             3072
Total           21          4553       0             1169664

What it means:
- Per-protocol prefix counts in the routing table.
- "Networks" = classful summary entries; "Subnets" = subnets
  (most entries on modern networks).
- "Memory(b)" = bytes consumed per protocol — useful for
  capacity planning on large BGP routers.
- "Total Memory" approaching platform RIB limit = action time.` },

  { cmd: 'show ip bgp neighbors <ip> advertised-routes',
    example: `R1# show ip bgp neighbors 10.10.10.2 advertised-routes

BGP table version is 142, local router ID is 1.1.1.1
Status codes: s suppressed, d damped, h history, * valid, > best, i internal
Origin codes: i - IGP, e - EGP, ? - incomplete

   Network          Next Hop      Metric LocPrf Weight Path
*> 10.0.0.0/8       0.0.0.0           0  32768       i
*> 10.10.0.0/24     0.0.0.0           0  32768       i
*> 192.168.0.0/16   0.0.0.0           0  32768       i

Total number of prefixes 3

What it means:
- Routes the local router is currently advertising TO this peer.
- Useful for "is the peer seeing X?" troubleshooting — confirms
  what's leaving this side.
- "*>" : valid + best. "i" Origin = learned via IGP/connected.
- Compare with "received-routes" (what the peer sent to us).` },

  { cmd: 'show ip bgp <prefix>',
    example: `R1# show ip bgp 198.51.100.0/24

BGP routing table entry for 198.51.100.0/24, version 142
Paths: (2 available, best #1, table default)
  Advertised to update-groups:
     1
  Refresh Epoch 1
  65002 65003
    10.10.10.2 from 10.10.10.2 (2.2.2.2)
      Origin IGP, metric 0, localpref 100, valid, external, best
      rx pathid: 0, tx pathid: 0x0
  65004 65003
    10.10.20.2 from 10.10.20.2 (3.3.3.3)
      Origin IGP, metric 0, localpref 100, valid, external

What it means:
- All BGP paths for one prefix with full attribute breakdown.
- "best" : the one BGP picked (won the path-selection algorithm).
- "AS_PATH" : the AS hops (here 65002 65003 vs 65004 65003).
- Use during best-path investigations: why was THIS path chosen
  over the other?` },

  { cmd: 'show ip route vrf <name>',
    example: `R1# show ip route vrf CUSTOMER-A

Routing Table: CUSTOMER-A
Codes: C - Connected, S - Static, B - BGP, O - OSPF, R - RIP

C    10.99.0.0/24 is directly connected, GigabitEthernet0/0.10
B    10.99.10.0/24 [200/0] via 1.1.1.1, 02:14:21
S    0.0.0.0/0 [1/0] via 10.99.0.1

What it means:
- Per-VRF routing table. "show ip route" alone shows global only.
- "Routing Table: CUSTOMER-A" header confirms the VRF context.
- "[200/0]" : AD 200 typical for iBGP-over-MPLS-VPN routes.
- Useful in MPLS-VPN PE routers managing multiple customer VRFs.` },

  { cmd: 'show ip route 8.8.8.8',
    example: `R1# show ip route 8.8.8.8

Routing entry for 0.0.0.0/0, supernet
  Known via "static", distance 1, metric 0, candidate default path
  Routing Descriptor Blocks:
  * 198.51.100.1
      Route metric is 0, traffic share count is 1

What it means:
- Resolves a single destination to its longest-prefix-match route.
- "0.0.0.0/0, supernet" : matched the default route.
- Common debugging step — confirms which route the router would
  actually use to reach a destination.
- For ECMP scenarios, multiple Routing Descriptor Blocks shown.` },

  { cmd: 'show ip ospf',
    example: `R1# show ip ospf

Routing Process "ospf 1" with ID 1.1.1.1
Start time: 00:00:14.142, Time elapsed: 1d 12:14:21
Supports only single TOS(TOS0) routes
Supports opaque LSA
Supports Link-local Signaling (LLS)
Supports area transit capability
Event-log enabled, Maximum number of events: 1000, Mode: cyclic
It is an autonomous system boundary router
Redistributing External Routes from,
   bgp 65001 with metric 100, includes subnets in redistribution
Number of areas in this router: 1 normal, 0 stub, 0 nssa
Number of areas transit capable: 0

What it means:
- Process-level OSPF state. "ASBR" status, redistribution config,
  area counts, opaque-LSA support.
- "It is an autonomous system boundary router" = this router
  imports routes from another protocol via redistribute.
- "Redistributing External Routes" : confirms what's being
  redistributed and the seed metric.` },

  { cmd: 'show ip cef',
    example: `R1# show ip cef

Prefix              Next Hop             Interface
0.0.0.0/0           198.51.100.1         GigabitEthernet0/0
0.0.0.0/8           drop
10.10.10.0/24       attached             GigabitEthernet0/0
10.10.10.0/32       receive              GigabitEthernet0/0
10.10.10.1/32       receive              GigabitEthernet0/0
10.10.10.255/32     receive              GigabitEthernet0/0
198.51.100.0/24     attached             GigabitEthernet0/0
...

What it means:
- The full CEF table (FIB) — what hardware actually uses to
  forward packets.
- "attached" : direct subnet (resolved via ARP per-host).
- "receive" : packets to this address are punted to the CPU
  (router's own IP, broadcast, multicast).
- "drop" : black-hole entries (e.g. 0.0.0.0/8 is anti-bogon).` },

  { cmd: 'show ip cef <prefix> internal',
    example: `R1# show ip cef 8.8.8.8 internal

8.8.8.8/32, epoch 0, flags [att, sc]
  recursive via 198.51.100.1
    nexthop 198.51.100.1 GigabitEthernet0/0
  output chain:
    IP adj out of GigabitEthernet0/0, addr 198.51.100.1
    encap chain: 0xCAFE0000

What it means:
- Internal CEF detail — recursive lookups, output-chain rewrite
  info.
- "recursive via 198.51.100.1" : route is via a recursive
  next-hop (typical for static routes pointing at a non-attached
  IP).
- Used by Cisco TAC to debug FIB-corruption bugs.` },

  { cmd: 'ip route 0.0.0.0 0.0.0.0 1.1.1.1 name DEFAULT_TO_ISP',
    example: `R1(config)# ip route 0.0.0.0 0.0.0.0 1.1.1.1 name DEFAULT_TO_ISP

R1# show ip route static | include 0.0.0.0
S*   0.0.0.0/0 [1/0] via 1.1.1.1
   route name: DEFAULT_TO_ISP

What it means:
- Default route with descriptive name. "name TAG" provides
  documentation in show output.
- AD 1 : higher trust than dynamic protocols. Use AD 200+ for
  "floating" backup defaults that should only kick in when
  primary is gone.` },

  { cmd: 'ip route 192.168.99.0 255.255.255.0 10.10.10.1 100',
    example: `R1(config)# ip route 192.168.99.0 255.255.255.0 10.10.10.1 100

R1# show ip route 192.168.99.0
Routing entry for 192.168.99.0/24
  Known via "static", distance 100, metric 0
   * 10.10.10.1
       Route metric is 0, traffic share count is 1

What it means:
- "100" trailing the next-hop sets administrative distance to 100.
- AD 100 puts this static behind OSPF (110) and EIGRP-internal
  (90), letting dynamic protocols win — "floating static" backup.
- Useful for fail-over: dynamic route fails → static AD 100
  becomes the active path.` },

  { cmd: 'router ospf 1\n router-id 1.1.1.1\n network 10.0.0.0 0.255.255.255 area 0',
    example: `R1(config)# router ospf 1
R1(config-router)# router-id 1.1.1.1
R1(config-router)# network 10.0.0.0 0.255.255.255 area 0
R1(config-router)# passive-interface Loopback0

R1# show ip ospf neighbor
Neighbor ID  Pri State           Dead Time  Address      Interface
2.2.2.2      1   FULL/BDR        00:00:34   192.168.1.2  Gi0/0/0

What it means:
- Standard 3-line OSPF startup.
- Process ID "1" is local-only.
- Router-ID 1.1.1.1 : 32-bit identity. Manual config recommended
  so it doesn't change when interfaces flap.
- "network 10.0.0.0 0.255.255.255" : matches all interfaces with
  IPs in 10/8.` },

  { cmd: 'router bgp 65001\n bgp router-id 1.1.1.1\n neighbor 1.2.3.4 remote-as 65002\n address-family ipv4 unicast\n  neighbor 1.2.3.4 activate',
    example: `R1(config)# router bgp 65001
R1(config-router)# bgp router-id 1.1.1.1
R1(config-router)# neighbor 1.2.3.4 remote-as 65002
R1(config-router)# address-family ipv4 unicast
R1(config-router-af)# neighbor 1.2.3.4 activate

R1# show ip bgp summary | include 1.2.3.4
1.2.3.4   4    65002      14      12       142    0    0  00:08:14    142

What it means:
- Standard BGP peer setup. ASN 65001 is in the private 16-bit
  range (64512-65535).
- IPv4 AF "activate" : explicitly enable IPv4 unicast for this
  peer. Without it, peer comes up but no IPv4 routes flow.
- Default behaviour pre-IOS 12.4 was implicit activation; modern
  IOS requires explicit.` },

  { cmd: 'ip address ip-address subnet-mask',
    example: `R1(config)# interface gi0/0
R1(config-if)# ip address 10.10.10.1 255.255.255.0

R1# show ip interface brief gi0/0
GigabitEthernet0/0   10.10.10.1   YES manual  up  up

What it means:
- Generic syntax. Replace existing IP with "no ip address" first.
- Add a secondary IP: "ip address 192.168.10.1 255.255.255.0
  secondary".
- For point-to-point links, /30 and /31 are common (saves
  addresses).` },

  { cmd: 'ip route network subnet-mask next-hop-interface-id',
    example: `R1(config)# ip route 192.168.99.0 255.255.255.0 GigabitEthernet0/0

R1# show ip route static | include 192.168.99.0
S    192.168.99.0/24 is directly connected, GigabitEthernet0/0

What it means:
- Static route via outgoing interface (no next-hop IP).
- Useful on point-to-point links where there's no need to
  resolve a next-hop IP via ARP.
- DANGER on multi-access (Ethernet) links: causes the router to
  ARP for EVERY destination via this route, exhausting ARP cache.` },

  { cmd: 'ip route network subnet-mask next-hop-ip',
    example: `R1(config)# ip route 192.168.99.0 255.255.255.0 10.10.10.1

R1# show ip route static | include 192.168.99
S    192.168.99.0/24 [1/0] via 10.10.10.1

What it means:
- Standard static route with next-hop IP.
- "[1/0]" : AD 1 (preferred over most dynamic protocols), metric 0.
- The next-hop must be reachable via another route. If the
  next-hop becomes unreachable, the static route is removed
  from the RIB.` },

  { cmd: 'ip route network subnet-mask interface-id next-hop-ip',
    example: `R1(config)# ip route 192.168.99.0 255.255.255.0 GigabitEthernet0/0 10.10.10.1

R1# show ip route static | include 192.168.99
S    192.168.99.0/24 [1/0] via 10.10.10.1, GigabitEthernet0/0

What it means:
- Combines outgoing interface + next-hop IP. Fully-resolved
  static — pre-evaluated, no recursive lookup needed.
- Best of both worlds: explicit next-hop IP (proper ARP only for
  one host) + explicit interface (deterministic egress).
- Useful when the path between this router and the next-hop must
  use a specific link (multi-NIC routers).` },

  { cmd: 'ipv6 route network/prefix-length {next-hop-interface-id | [next-hop-interface-id] next-ip-address}',
    example: `R1(config)# ipv6 route 2001:DB8:99::/48 GigabitEthernet0/0 FE80::1
R1(config)# ipv6 route ::/0 2001:DB8:1::1

R1# show ipv6 route static
S   2001:DB8:99::/48 [1/0]
     via FE80::1, GigabitEthernet0/0
S   ::/0 [1/0]
     via 2001:DB8:1::1

What it means:
- IPv6 static route. Next-hop can be link-local (requires
  outgoing interface) or global-scope (interface optional).
- Default route uses ::/0.
- Best practice: use link-local next-hops so the route survives
  global-prefix changes on the upstream link.` },

  { cmd: 'vrf definition vrf-name',
    example: `R1(config)# vrf definition CUSTOMER-A
R1(config-vrf)# rd 65001:1
R1(config-vrf)# route-target both 65001:1
R1(config-vrf)# address-family ipv4
R1(config-vrf-af)#

What it means:
- VRF (Virtual Routing and Forwarding) — isolated routing
  context. Each VRF has its own RIB / FIB / ARP tables.
- RD (Route Distinguisher) : prepended to prefixes to keep them
  unique in the global VPNv4 BGP table.
- RT (Route Target) : controls which VRFs share which prefixes
  via VPNv4 import/export.` },

  { cmd: 'address-family {ipv4 | ipv6}',
    example: `R1(config)# vrf definition CUSTOMER-A
R1(config-vrf)# address-family ipv4
R1(config-vrf-af)# route-target both 65001:1

R1(config-vrf)# address-family ipv6
R1(config-vrf-af)# route-target both 65001:1

What it means:
- Sub-mode under "vrf definition" or BGP / OSPF for protocol-
  specific configuration.
- Same VRF can carry both IPv4 and IPv6 — separate AFs.
- Each AF has its own RT / route-map / redistribute settings.` },

  { cmd: 'interface interface-id',
    example: `R1(config)# interface gigabitethernet 0/0
R1(config-if)# vrf forwarding CUSTOMER-A
R1(config-if)# ip address 10.99.0.1 255.255.255.0
R1(config-if)# no shutdown

What it means:
- Generic interface entry syntax. Common types: GigabitEthernet,
  TenGigE, Loopback, Vlan, Tunnel, Port-channel.
- Shorthand abbreviations work: "int gi0/0".
- Order of commands matters: VRF binding usually FIRST (clears
  any existing IP), then IP address.` },

  { cmd: 'vrf forwarding vrf-name',
    example: `R1(config-if)# vrf forwarding CUSTOMER-A
% Interface GigabitEthernet0/0 IPv4 disabled and address(es) removed due to enabling VRF CUSTOMER-A

R1(config-if)# ip address 10.99.0.1 255.255.255.0

What it means:
- Binds the interface to the named VRF. Existing IP config is
  WIPED (you must re-add it after binding).
- Order: bind VRF first, then "ip address".
- Compare with old "ip vrf forwarding" — same effect, deprecated
  syntax.` },

  { cmd: 'ip routing',
    example: `Switch(config)# ip routing

Switch# show ip protocols | head -3
*** IP Routing is NSF aware ***

What it means:
- Globally enables IP routing. Required on multilayer switches
  before SVI / routed-port traffic is forwarded between VLANs.
- Enabled by default on IOS routers.
- Without this, a multilayer switch acts as an L2-only switch.
- Disable with "no ip routing" — turns box back into a pure L2
  switch.` },

  { cmd: 'ip route <network> <mask> <nexthop>',
    example: `R1(config)# ip route 192.168.100.0 255.255.255.0 10.10.10.1

R1# show ip route static | include 192.168.100
S    192.168.100.0/24 [1/0] via 10.10.10.1

What it means:
- Most common static-route syntax. Network + mask + next-hop IP.
- "[1/0]" : AD 1 (high trust), metric 0.
- Use AD adjustment (e.g. "ip route X Y Z 100") for floating
  backup statics.` },

  { cmd: 'ip route 0.0.0.0 0.0.0.0 <gateway>',
    example: `R1(config)# ip route 0.0.0.0 0.0.0.0 198.51.100.1

R1# show ip route 0.0.0.0
Routing entry for 0.0.0.0/0, supernet
  Known via "static", distance 1, metric 0, candidate default path
   * 198.51.100.1

What it means:
- The default route. "0.0.0.0/0" matches everything not in the
  RIB.
- "candidate default path" : if this route is in RIB, it's the
  default.
- Typical edge-router config — point at the ISP's gateway.` },

  { cmd: 'no ip route <network> <mask> <nexthop>',
    example: `R1(config)# no ip route 192.168.100.0 255.255.255.0 10.10.10.1

R1# show ip route static | include 192.168.100
% No matches for "192.168.100"

What it means:
- Removes a specific static route. Must include exact
  network/mask/next-hop trio.
- "no ip route 192.168.100.0 255.255.255.0" (without next-hop)
  removes ALL routes for that prefix.` },

  { cmd: 'router ospf <process-id>',
    example: `R1(config)# router ospf 1
R1(config-router)#

R1# show ip protocols | include ospf
Routing Protocol is "ospf 1"

What it means:
- Enters OSPF process configuration. Process-id is locally-
  significant (doesn't need to match neighbours' IDs).
- Multiple OSPF processes can run on one router (each has its
  own LSDB) — useful for separating customer VRFs or different
  routing domains.` },

  { cmd: 'network <ip> <wildcard> area <area-id>',
    example: `R1(config-router)# network 10.0.0.0 0.255.255.255 area 0

R1# show ip ospf interface brief
Interface  PID  Area  IP Address/Mask  Cost  State Nbrs F/C
Gi0/0      1    0     10.10.10.1/24    1     BDR   1/1
Gi0/1      1    0     10.20.0.1/24     1     P2P   1/1

What it means:
- Wildcard mask (inverse of subnet mask) selects which interface
  IPs to include in OSPF.
- 0.255.255.255 = match the first octet only (10.x.x.x).
- "area 0" = backbone area (mandatory in OSPF).
- More specific networks: "network 10.10.10.1 0.0.0.0 area 0"
  matches just one IP.` },

  { cmd: 'passive-interface <interface>',
    example: `R1(config-router)# passive-interface GigabitEthernet0/2

R1# show ip ospf interface gi0/2 | include passive
  Suppress hello for 0 Neighbor(s)

What it means:
- Stops sending Hellos / advertising on the interface.
- Subnet of the interface is STILL advertised in OSPF — useful
  on user-facing LAN segments.
- Pair with "passive-interface default" + selective "no passive"
  to invert the default (most secure).` },

  { cmd: 'router bgp <asn>',
    example: `R1(config)# router bgp 65001
R1(config-router)#

What it means:
- Enters BGP process configuration. Only one BGP process per
  router (unlike OSPF which supports multiple).
- ASN 1-64511 = public range. 64512-65535 = private. 4-byte ASNs
  available since RFC 4893.` },

  { cmd: 'neighbor <ip> remote-as <asn>',
    example: `R1(config-router)# neighbor 10.10.10.2 remote-as 65002

R1# show ip bgp summary | include 10.10.10.2
10.10.10.2  4   65002      14      12       142   0    0  00:08:14    142

What it means:
- Defines a BGP peer. "remote-as" same as local ASN = iBGP;
  different = eBGP.
- iBGP requires full-mesh OR route-reflectors / confederations.
- eBGP TTL=1 by default (single-hop). Use "ebgp-multihop N" for
  multi-hop scenarios.` },

  { cmd: 'ip helper-address <server-ip>',
    example: `R1(config-if)# ip helper-address 10.99.0.10
R1(config-if)# ip helper-address 10.99.0.11

# Client broadcast DHCPDISCOVER →
%DHCP-6-RELAY: relayed DHCPDISCOVER from 10.10.0.5 to 10.99.0.10

What it means:
- Converts UDP broadcast (DHCP/BOOTP/TFTP/etc.) to unicast aimed
  at the named server.
- Multiple helpers = HA. Most production deployments configure
  2+ for redundancy.
- Also catches other UDP-broadcast services (NetBIOS, TACACS) —
  selectively disable with "no ip forward-protocol udp".` },

  { cmd: 'ip multicast-routing',
    example: `R1(config)# ip multicast-routing
R1(config)# ip multicast-routing distributed   ! hardware-accelerated

R1# show ip mroute | head -3
IP Multicast Routing Table
Flags: D - Dense, S - Sparse, B - Bidir Group, ...

What it means:
- Globally enables IPv4 multicast routing. Required before
  per-interface PIM commands take effect.
- "distributed" : hardware acceleration (most modern Cisco
  platforms — improves multicast forwarding rate).
- After enabling, also configure "ip pim sparse-mode" on each
  interface that should participate.` },

  // ============== Security ==============
  { cmd: 'show access-lists',
    example: `R1# show access-lists

Standard IP access list 10
    10 permit 10.10.10.0 wildcard bits 0.0.0.255 (45 matches)
    20 deny any (12 matches)

Extended IP access list BLOCK_ADMIN
    10 deny tcp any host 10.10.10.50 eq 23 (8 matches) log
    20 permit ip any any (102341 matches)

What it means:
- All IP/IPv6/MAC access lists with per-line match counts.
- Standard ACLs : source IP only. Extended ACLs : full 5-tuple.
- "matches" : how many packets each rule processed since last
  clear. Useful for tuning — rules with 0 matches over a long
  period may be removable.` },

  { cmd: 'show ip access-lists',
    example: `R1# show ip access-lists

Standard IP access list 10
    10 permit 10.10.10.0 wildcard bits 0.0.0.255 (45 matches)
    20 deny any (12 matches)

Extended IP access list ALLOW_WEB
    10 permit tcp any any eq 80 (102341 matches)
    20 permit tcp any any eq 443 (245019 matches)
    30 deny ip any any (12 matches) log

What it means:
- IPv4 ACLs only (no IPv6 or MAC).
- Numeric ranges: 1-99 / 1300-1999 = standard; 100-199 / 2000-2699
  = extended; 700-799 = MAC.
- Named ACLs (modern best practice) — descriptive names instead
  of opaque numbers.` },

  { cmd: 'show ipv6 access-lists',
    example: `R1# show ipv6 access-lists

IPv6 access list ALLOW_HTTPS
    permit tcp any any eq 443 (45012 matches)
    permit tcp any any eq 80 (12003 matches)
    deny ipv6 any any log (3 matches)

What it means:
- IPv6 ACLs are always named (no numeric range).
- Apply with "ipv6 traffic-filter NAME in/out" on the interface
  — different command from IPv4's "ip access-group".
- Default-deny at the end is implicit; explicit "deny + log"
  helps with auditing.` },

  { cmd: 'show control-plane host open-ports',
    example: `R1# show control-plane host open-ports

Active internet connections (servers and established)
Prot       Local Address      Foreign Address       Service             State
tcp        *:179               *:0                   BGP                 LISTEN
tcp        *:22                *:0                   SSH-Server          LISTEN
tcp        *:80                *:0                   HTTP CORE           LISTEN
tcp        10.10.10.1:179      10.10.10.2:51223      BGP                 ESTABLIS
udp        *:161               *:0                   SNMP                LISTEN
udp        *:514               *:0                   syslog              LISTEN

What it means:
- All listening ports + active connections to the control plane.
- Critical for security review: any service running here is
  exposed to traffic destined to the router itself.
- Common cleanup: "no ip http server" / "no ip http secure-server"
  if web management isn't used; "transport input ssh" to block
  telnet (port 23).` },

  { cmd: 'show login failures',
    example: `R1# show login failures

Information about login failure's with the device
-----------------------------------------------------------------
Username       Source IPAddr  lPort Count   TimeStamp
admin          203.0.113.45   12345    14   May  1 11:22:18 2026 GMT
operator       198.51.100.20  54321     2   May  1 09:14:22 2026 GMT

What it means:
- Audit trail of failed login attempts. "Count" = consecutive
  failures from one (user, source-IP) pair.
- A high count from one IP = brute-force attempt.
- Pair with "login block-for" to auto-quarantine after threshold.` },

  { cmd: 'show login on-success',
    example: `R1# show login on-success

User: admin
Source IP: 10.50.50.50
Login Time: 11:22:18 GMT Wed May 1 2026

User: operator
Source IP: 10.50.50.51
Login Time: 09:14:22 GMT Wed May 1 2026

What it means:
- Successful login audit log. Critical for change-management:
  who logged in when, from where.
- Pair "login on-success" + "login on-failure" globally to
  ensure both are logged.
- Forward to syslog server for long-term retention.` },

  { cmd: 'show crypto isakmp sa',
    example: `R1# show crypto isakmp sa

IPv4 Crypto ISAKMP SA
dst             src             state          conn-id status
198.51.100.50   10.10.10.1      QM_IDLE          1001 ACTIVE

What it means:
- IKE Phase 1 SAs. State QM_IDLE = healthy (Phase 1 done, ready
  for Phase 2 negotiations).
- Other states during negotiation: MM_NO_STATE, MM_SA_SETUP,
  MM_KEY_EXCH, MM_KEY_AUTH, AG_INIT_EXCH, AG_AUTH.
- conn-id : tracking ID; useful for "debug crypto isakmp" output.` },

  { cmd: 'show crypto ipsec sa',
    example: `R1# show crypto ipsec sa | head -20

interface: GigabitEthernet0/0
    Crypto map tag: VPN_MAP, local addr 10.10.10.1

   protected vrf: (none)
   local  ident (addr/mask/prot/port): (10.10.0.0/255.255.0.0/0/0)
   remote ident (addr/mask/prot/port): (10.20.0.0/255.255.0.0/0/0)
   current_peer 198.51.100.50 port 500
     PERMIT, flags={origin_is_acl,}
    #pkts encaps: 142,012, #pkts encrypt: 142,012, #pkts digest: 142,012
    #pkts decaps: 142,003, #pkts decrypt: 142,003, #pkts verify: 142,003

What it means:
- IPsec Phase 2 SAs with packet counters.
- "encaps / encrypt / digest" : outbound (encryption + auth).
- "decaps / decrypt / verify" : inbound.
- Mismatch between encrypt and decrypt counters = unidirectional
  problem (firewall blocking, MTU).` },

  { cmd: 'show crypto pki certificates',
    example: `R1# show crypto pki certificates

Certificate
  Status: Available
  Certificate Serial Number (hex): 0123456789ABCDEF
  Certificate Usage: General Purpose
  Issuer:
    cn=corp-CA
    o=Corp
    c=GB
  Subject:
    Name: R1.corp.local
    cn=R1.corp.local
  Validity Date:
    start date: 09:00:00 GMT Apr 1 2026
    end   date: 09:00:00 GMT Apr 1 2027
  Associated Trustpoints: corp-CA-trustpoint

What it means:
- All installed PKI certificates on the router. Used for IKEv2
  + RSA-sig auth, mGRE+IPsec, REST API authentication.
- "Status: Available" = usable. "Pending" = enrollment in flight.
- Renew certs BEFORE expiry — expired cert = VPN tunnels drop.` },

  { cmd: 'show dot1x all',
    example: `Switch# show dot1x all

Sysauthcontrol                 Enabled
Dot1x Protocol Version             3

Dot1x Info for GigabitEthernet1/0/1
-----------------------------------
PAE                       = AUTHENTICATOR
QuietPeriod               = 60
ServerTimeout             = 0
SuppTimeout               = 30
ReAuthMax                 = 2
MaxReq                    = 2
TxPeriod                  = 30

What it means:
- 802.1X authentication state per port. PAE = Port Access Entity.
- AUTHENTICATOR = switch acting as 802.1X gatekeeper for the
  connected supplicant (laptop/phone).
- Timers: TxPeriod (resend), QuietPeriod (after fail), SuppTimeout
  (wait for client).` },

  { cmd: 'show authentication sessions interface <int> details',
    example: `Switch# show authentication sessions interface gi1/0/1 details

Interface:  GigabitEthernet1/0/1
MAC Address: 0050.5612.3456
IPv4 Address: 10.10.10.50
IPv6 Address: Unknown
User-Name: corp\\\\jsmith
Status: Authorized
Domain: DATA
Oper host mode: multi-auth
Oper control dir: both
Session timeout: N/A
Common Session ID: 0A0A0A0A00000142
Acct Session ID: 0x00000142
Handle: 0xCD000142
Current Policy: POLICY_Gi1/0/1

What it means:
- Per-port detailed 802.1X / MAB / WebAuth session info.
- "Status: Authorized" = host passed authentication; ports forward
  traffic.
- Session ID : handle for RADIUS accounting and dynamic policy
  push (CoA).
- Use during user complaints: did 802.1X complete? What VLAN
  was assigned via dynamic VLAN?` },

  { cmd: 'show ip arp inspection',
    example: `Switch# show ip arp inspection

Source Mac Validation     : Disabled
Destination Mac Validation: Disabled
IP Address Validation     : Enabled

 Vlan     Configuration    Operation   ACL Match          Static ACL
 ----     -------------    ---------   ---------          ----------
   10     Enabled           Active      ARP_VALIDATE       No

 Vlan     ACL Logging      DHCP Logging  Probe Logging
 ----     -----------      ------------  -------------
   10     Deny             Deny          Off

 Vlan      Forwarded        Dropped     DHCP Drops      ACL Drops
 ----      ---------        -------     ----------      ---------
   10      245019           12          12              0

What it means:
- DAI (Dynamic ARP Inspection) state — validates ARP packets
  against the DHCP-snooping binding database.
- "Dropped > 0" = invalid ARP packets blocked (typical attacker:
  ARP spoofing).
- Critical L2 security feature; pair with DHCP snooping to
  prevent man-in-the-middle attacks at the access layer.` },

  { cmd: 'show ip source binding',
    example: `Switch# show ip source binding

MacAddress          IpAddress     Lease(sec)  Type            VLAN  Interface
00:1A:1E:11:22:33   10.10.0.50    86400       dhcp-snooping   10    Gi1/0/1
00:1A:1E:44:55:66   10.10.0.51    72000       static          10    Gi1/0/2

What it means:
- IP Source Guard binding table — IP-MAC-port-VLAN tuples
  enforced for ingress filtering.
- "dhcp-snooping" : auto-learned from DHCP exchanges on trusted
  ports.
- "static" : manually configured for known servers.
- Combined with IPSG, prevents IP spoofing at the access layer.` },

  { cmd: 'interface <int>\\n switchport port-security maximum 2\\n switchport port-security violation restrict',
    example: `Switch(config)# interface gi1/0/1
Switch(config-if)# switchport mode access
Switch(config-if)# switchport port-security
Switch(config-if)# switchport port-security maximum 2
Switch(config-if)# switchport port-security violation restrict

Switch# show port-security interface gi1/0/1
Port Security              : Enabled
Port Status                : Secure-up
Violation Mode             : Restrict
Maximum MAC Addresses      : 2
Total MAC Addresses        : 2
Sticky MAC Addresses       : 0
Last Source Address:Vlan   : 0050.5612.3456:10
Security Violation Count   : 0

What it means:
- Limits MAC addresses per port. "maximum 2" = phone + PC behind
  the phone (typical IP-phone setup).
- Violation modes: protect (drop, no log), restrict (drop + log),
  shutdown (errdisable port).
- "restrict" is the common compromise — alert without disrupting
  legitimate users.` },

  { cmd: 'ip dhcp snooping\\n ip dhcp snooping vlan <vlans>\\n interface <uplink>\\n ip dhcp snooping trust',
    example: `Switch(config)# ip dhcp snooping
Switch(config)# ip dhcp snooping vlan 10,20,30
Switch(config)# interface gi1/0/24
Switch(config-if)# ip dhcp snooping trust

# Untrusted ports (default) only allow DHCP responses TO be received,
# not transmitted (blocks rogue DHCP servers).

Switch# show ip dhcp snooping | head -10
Switch DHCP snooping is enabled
DHCP snooping is configured on following VLANs: 10,20,30
DHCP snooping trust on the following interfaces:
   GigabitEthernet1/0/24

What it means:
- DHCP snooping prevents rogue DHCP servers (Layer-2 attack
  prevention).
- "trust" : interface where the legitimate DHCP server lives —
  allows DHCPOFFER/DHCPACK responses through.
- Untrusted (default) : only allows DHCPDISCOVER/REQUEST from
  clients; blocks responses originating from this port.` },

  { cmd: 'ip arp inspection vlan <vlans>',
    example: `Switch(config)# ip arp inspection vlan 10,20,30

Switch# show ip arp inspection vlan 10
Source Mac Validation     : Disabled
Destination Mac Validation: Disabled
IP Address Validation     : Enabled

 Vlan     Configuration    Operation
 ----     -------------    ---------
   10     Enabled           Active

What it means:
- Activates Dynamic ARP Inspection on the named VLANs.
- Requires DHCP snooping bindings (or static ARP-ACLs) to know
  what's legitimate.
- Trust the port where the gateway lives ("ip arp inspection
  trust" interface command).` },

  { cmd: 'show ip access-lists <name>',
    example: `R1# show ip access-lists ALLOW_WEB

Extended IP access list ALLOW_WEB
    10 permit tcp any any eq 80 (102341 matches)
    20 permit tcp any any eq 443 (245019 matches)
    30 deny ip any any log (12 matches)

What it means:
- Single-ACL view with per-line match counts.
- Use to verify a specific ACL after applying or modifying it.
- Match counters reset on "clear ip access-list counters NAME".` },

  { cmd: 'show ip access-lists EXAMPLE',
    example: `R1# show ip access-lists EXAMPLE

Extended IP access list EXAMPLE
    10 permit tcp 10.10.0.0 0.0.255.255 any eq 22 (4502 matches)
    20 permit tcp 10.10.0.0 0.0.255.255 any eq 80 (45012 matches)
    30 deny ip any any log

What it means:
- Same as "show ip access-lists <name>" — example ACL named
  EXAMPLE.
- "0.0.255.255" wildcard mask matches 10.10.0.0/16.
- ACEs evaluated top-to-bottom; first match wins. Implicit
  "deny ip any any" at the end (without log).` },

  { cmd: 'show port-security interface Gi1/0/1',
    example: `Switch# show port-security interface gi1/0/1

Port Security              : Enabled
Port Status                : Secure-up
Violation Mode             : Restrict
Aging Time                 : 0 mins
Aging Type                 : Absolute
SecureStatic Address Aging : Disabled
Maximum MAC Addresses      : 2
Total MAC Addresses        : 2
Configured MAC Addresses   : 0
Sticky MAC Addresses       : 2
Last Source Address:Vlan   : 0050.5612.3456:10
Security Violation Count   : 0

What it means:
- Port-security state for one port.
- "Sticky MAC Addresses 2" : MACs learned dynamically and saved
  to running-config — survive reboot if "write memory" is run.
- Violation Count > 0 = security incident triggered (typically
  someone unplugging device + plugging in a different one).` },

  { cmd: 'show aaa servers',
    example: `R1# show aaa servers

RADIUS: id 1, priority 1, host 10.40.0.5, auth-port 1812, acct-port 1813
     State: current UP, duration 1d12h, previous duration 0s
     Dead: total time 0s, count 0
     Quarantined: No
     Authen: request 4502, timeouts 0, failover 0
     Author: request 0, timeouts 0
     Account: request 4500, timeouts 0
     Server_State_Statistics:
        UP: 4502
        DEAD: 0

TACACS+: id 2, priority 1, host 10.40.0.6, port 49
     State: current UP, duration 1d12h
     Authen: request 142, timeouts 0
     Author: request 245, timeouts 0
     Account: request 142, timeouts 0

What it means:
- AAA server state and counters.
- "current UP" = reachable. "DEAD" = marked unreachable
  (responds with "previous duration").
- Timeouts/failover non-zero = pursuing dead server too long;
  tune "radius-server timeout" / "deadtime".
- Auth/Author/Account split shows which AAA functions are in
  use.` },

  { cmd: 'show login',
    example: `R1# show login

A login delay of 1 seconds is applied.
   Quiet-Mode access list has not been configured.

Router enabled to watch for login Attacks.
   If more than 4 login failures occur in 60 seconds or less,
   logins will be disabled for 120 seconds.

   Router presently in Watch-Mode, will remain in Watch-Mode for 0 seconds.
   Present login failure count 0.

What it means:
- "login block-for" anti-brute-force config status.
- "Watch-Mode" = monitoring; "Quiet-Mode" = logins blocked
  (returns to Watch-Mode after the configured timeout).
- "Quiet-Mode access list" : exempt list — admin IPs that bypass
  the lockout.` },

  { cmd: 'aaa new-model',
    example: `R1(config)# aaa new-model

Switch# show running-config | include aaa
aaa new-model

What it means:
- Required FIRST step to enable any AAA configuration.
- Without "aaa new-model", legacy "username" / "enable secret" /
  "line login" still work — but the modern "aaa authentication"
  framework does not.
- Cannot be cleanly disabled — once turned on, plan to use AAA
  going forward.` },

  { cmd: 'aaa authentication login default group radius local',
    example: `R1(config)# aaa authentication login default group radius local

# Login flow:
# 1. Try RADIUS first.
# 2. Fall back to local (router's username database) if RADIUS fails.

R1# show running-config | include authentication login
aaa authentication login default group radius local

What it means:
- Multi-method auth list. "default" applies to ALL login lines
  unless overridden.
- "group radius" : try every RADIUS server in the group in order.
- "local" fallback : critical safety net — if RADIUS is dead, you
  can still log in via local account.
- ALWAYS configure local fallback on production.` },

  { cmd: 'aaa authorization commands 15 default group tacacs+ none',
    example: `R1(config)# aaa authorization commands 15 default group tacacs+ none

# When operator runs a privileged command:
R1# configure terminal
%TACACS+: AUTHOR_REQ for cmd "configure terminal" by user 'admin' from 10.50.50.50
R1#

What it means:
- Authorises individual commands at privilege level 15 against
  TACACS+.
- "none" fallback : if TACACS+ is unreachable, ALLOW the command
  (to prevent lockout). Use carefully — security/availability
  trade-off.
- TACACS+ servers can return per-command authz decisions
  (e.g. operator can run "show" but not "configure").` },

  { cmd: 'aaa accounting commands 15 default start-stop group tacacs+',
    example: `R1(config)# aaa accounting commands 15 default start-stop group tacacs+

# Each priv-15 command logged:
%AAA-6-CMDACCT: User=admin Cmd="show running-config" Status=stop

What it means:
- "start-stop" : log both command start and completion.
- Priv-15 : log every privileged-mode command — full audit trail.
- Required by SOX / PCI-DSS for change accountability.
- TACACS+ accounting records sent to server in real-time.` },

  { cmd: 'username admin privilege 15 secret <pwd>',
    example: `R1(config)# username admin privilege 15 secret CorpAdmin2026!

R1# show running-config | include username
username admin privilege 15 secret 9 $9$abcd...   ! type-9 hash

What it means:
- Local user with full privilege (level 15).
- "secret" stores HASHED password (one-way). Modern IOS uses
  type-9 (scrypt) — strong against brute-force.
- "password" (vs "secret") stores plaintext — DANGEROUS, never use.
- "service password-encryption" applies type-7 (weak) encryption
  to other passwords — primarily obscurity, not security.` },

  { cmd: 'enable secret <pwd>',
    example: `R1(config)# enable secret CorpEnable2026!

R1# show running-config | include enable
enable secret 9 $9$abcd...

What it means:
- The privileged-mode (enable) password. Hashed with type-9
  (scrypt) by default on modern IOS.
- Required to escalate from user-mode to privileged-mode unless
  AAA bypass is configured.
- "enable password" (vs "secret") stores plaintext — DEPRECATED.` },

  { cmd: 'service password-encryption',
    example: `R1(config)# service password-encryption

R1# show running-config | include username
username operator password 7 094F471A1A0A    ! type-7 hash

What it means:
- Encrypts ALL plaintext passwords in running-config using type-7
  (Vigenère cipher) — TRIVIAL to reverse online.
- Provides obscurity, not security. Real protection comes from
  type-9 (scrypt) hashes via "secret" command.
- Best practice: use "secret" for everything; "service password-
  encryption" is a defence-in-depth nicety only.` },

  { cmd: 'ip ssh version 2\nip ssh time-out 60\nip ssh authentication-retries 3',
    example: `R1(config)# ip ssh version 2
R1(config)# ip ssh time-out 60
R1(config)# ip ssh authentication-retries 3
R1(config)# crypto key generate rsa modulus 2048

R1# show ip ssh
SSH Enabled - version 2.0
Authentication timeout: 60 secs; Authentication retries: 3
Minimum expected Diffie Hellman key size : 1024 bits

What it means:
- SSH v2 ONLY (v1 has known vulnerabilities — never enable).
- 60-sec timeout for the auth phase. 3 retries before disconnect.
- Requires RSA keys ≥ 1024 bits (2048+ recommended for modern
  threat model).
- Generate RSA keys ONCE per device — they survive reload.` },

  { cmd: 'crypto ipsec transform-set',
    example: `R1(config)# crypto ipsec transform-set MODERN_TS esp-aes 256 esp-sha256-hmac
R1(config)# crypto ipsec transform-set FIPS_TS esp-aes 256 esp-sha384-hmac
R1(config)# mode tunnel

R1# show crypto ipsec transform-set MODERN_TS
Transform set MODERN_TS: { esp-256-aes esp-sha256-hmac  }
   will negotiate = { Tunnel,  },

What it means:
- IPsec Phase 2 transform-set : encryption + HMAC algorithms.
- AES-256 + SHA-256 = modern; AES-128 + SHA-1 = legacy/avoid;
  AES-256 + SHA-384 = FIPS 140-2.
- "mode tunnel" (default) : full encapsulation. "transport" :
  preserve original IP header (only IP payload protected).` },

  { cmd: 'ip access-group {access-list-number | name} {in|out}',
    example: `R1(config)# interface gi0/0
R1(config-if)# ip access-group 100 in
R1(config-if)# ip access-group ALLOW_WEB out

R1# show ip interface gi0/0 | include access list
  Inbound  access list is 100
  Outgoing access list is ALLOW_WEB

What it means:
- Applies an ACL to traffic on the interface.
- "in" : ingress (incoming to the router from this interface).
- "out" : egress (going out via this interface).
- Best-practice: filter as close to the source as possible (use
  "in" on customer-facing interfaces).` },

  { cmd: 'access-class {access-list-number|name} {in|out}',
    example: `R1(config)# access-list 5 permit 10.50.50.0 0.0.0.255
R1(config)# line vty 0 4
R1(config-line)# access-class 5 in
R1(config-line)# transport input ssh

# Now only 10.50.50.0/24 can SSH to the router.

What it means:
- Restricts which source IPs can connect to the VTY (telnet/SSH)
  lines.
- "in" : applies to incoming connection requests. Always use this
  on management lines.
- Best practice: management subnet ACL on every router/switch.` },

  { cmd: 'username {username} algorithm-type {md5 | sha256 | scrypt} secret {password}',
    example: `R1(config)# username admin algorithm-type scrypt secret CorpAdmin2026!

R1# show running-config | include username admin
username admin secret 9 $9$abcd...   ! type-9 (scrypt)

What it means:
- Explicitly chooses the password hash algorithm.
- scrypt (type-9) : MODERN, slow + memory-hard, recommended.
- sha256 (type-8) : decent, faster than scrypt.
- md5 (type-5) : legacy. Available on older IOS without type-8/9.
- Without "algorithm-type", IOS uses type-5 by default on older
  versions — modern releases default to type-9.` },

  { cmd: 'transport input ssh',
    example: `R1(config)# line vty 0 4
R1(config-line)# transport input ssh

R1# show running-config | section vty
line vty 0 4
 transport input ssh

What it means:
- Restricts incoming connections to SSH only — no telnet, rlogin
  or others.
- Hardening best practice: telnet sends credentials in cleartext.
- "transport input none" : blocks all incoming connections (use
  on AUX line).` },

  { cmd: 'crypto key generate rsa',
    example: `R1(config)# crypto key generate rsa modulus 2048

The name for the keys will be: R1.corp.local
% The key modulus size is 2048 bits
% Generating 2048 bit RSA keys, keys will be non-exportable...
[OK] (elapsed time was 12 seconds)

R1# show crypto key mypubkey rsa
Key name: R1.corp.local
Key type: RSA KEYS
Storage Device: not specified
Usage: General Purpose Key
Key is not exportable.
Key Data: 30820122 300D0609 ...

What it means:
- Generates RSA key pair. Required before SSH works.
- "modulus 2048" : key size. 2048 = current minimum; 4096 for
  high-security environments.
- "non-exportable" (default) : private key cannot be extracted —
  best practice for security-critical RSA keys.` },

  { cmd: 'aaa authorization console',
    example: `R1(config)# aaa authorization console

R1# show running-config | include aaa authorization
aaa authorization console
aaa authorization commands 15 default group tacacs+ local

What it means:
- By default, AAA authorisation commands DON'T apply to console
  logins — convenient escape hatch but a security gap.
- "aaa authorization console" applies authz to the console too,
  ensuring uniform enforcement.
- Best paired with a strong physical-security policy on the
  console port itself.` },

  { cmd: 'if-authenticated',
    example: `R1(config)# aaa authorization commands 15 default if-authenticated

# Any authenticated user can run any command (no per-cmd authz).

What it means:
- Method that succeeds if the user is authenticated. NO per-command
  authz check.
- Simpler than TACACS+ command authorisation but loses granular
  control.
- Use as fallback when TACACS+ is unreachable (better than
  none-method which permits everything regardless).` },

  { cmd: 'aaa authorization config-commands',
    example: `R1(config)# aaa authorization config-commands

# Now even (config) mode commands go through authz:
R1(config)# interface gi0/0
%TACACS+: AUTHOR_REQ for cmd "interface gi0/0" by user 'admin'

What it means:
- By default, configuration-mode commands are NOT subject to
  command authorisation (only privileged exec commands are).
- Enabling this captures every config change in the audit trail.
- Critical for compliance environments — auditors expect every
  config change to be authorised.` },

  { cmd: 'ip prefix-list ...',
    example: `R1(config)# ip prefix-list MY_PREFIXES seq 10 permit 10.0.0.0/16
R1(config)# ip prefix-list MY_PREFIXES seq 20 permit 192.168.0.0/16 ge 24
R1(config)# ip prefix-list MY_PREFIXES seq 30 deny 0.0.0.0/0 le 32

R1# show ip prefix-list MY_PREFIXES
ip prefix-list MY_PREFIXES: 3 entries
   seq 10 permit 10.0.0.0/16
   seq 20 permit 192.168.0.0/16 ge 24
   seq 30 deny 0.0.0.0/0 le 32

What it means:
- Prefix-lists are more efficient and clearer than ACLs for
  route filtering (BGP, OSPF redistribution).
- "ge 24" : also match more-specific prefixes >= /24.
- "le 32" : match prefixes up to /32.
- Implicit deny at the end like ACLs.` },

  { cmd: 'route-map route-map-name [permit | deny] [sequence-number]',
    example: `R1(config)# route-map FILTER_OUT permit 10
R1(config-route-map)# match ip address prefix-list MY_PREFIXES
R1(config-route-map)# set local-preference 200

R1(config)# route-map FILTER_OUT deny 20
R1(config-route-map)# match ip address prefix-list BAD_PREFIXES

R1(config)# route-map FILTER_OUT permit 30
! catch-all: permit anything not denied above

What it means:
- Conditional logic for routing decisions. Each statement has
  match (filter) + set (action) clauses.
- "permit 10" : if match succeeds, apply set actions and
  permit. If match fails, fall through to next sequence.
- Default is "deny" at the end — explicit "permit 30" with no
  match makes it a catch-all permit.` },

  { cmd: 'match ip address prefix-list prefix-list-name',
    example: `R1(config-route-map)# match ip address prefix-list MY_PREFIXES

R1# show route-map FILTER_OUT | include Match
  Match clauses:
    ip address prefix-list MY_PREFIXES

What it means:
- Inside a route-map, matches IPv4 prefixes against a named
  prefix-list.
- Multiple match clauses on the same statement form an AND;
  multiple match clauses with the same keyword form an OR.
- For BGP, "match ip address prefix-list" is preferred over
  "match ip address ACL" — more efficient.` },

  { cmd: 'neighbor ip-address distribute-list {acl-number | acl-name} {in|out}',
    example: `R1(config-router)# neighbor 10.10.10.2 distribute-list 100 in

R1# show ip bgp neighbor 10.10.10.2 | include policy
  Inbound updates filtered by access-list 100

What it means:
- Filters BGP routes received from a peer.
- "in" : applies to incoming Updates (filter what we accept).
- "out" : applies to outgoing Updates (filter what we send).
- Compare with "neighbor ... prefix-list" (preferred — more
  efficient with prefix-list syntax).` },

  { cmd: 'neighbor ip-address prefix-list prefix-list-name {in | out}',
    example: `R1(config)# ip prefix-list ACCEPT_FROM_ISP seq 10 permit 0.0.0.0/0

R1(config-router)# neighbor 1.2.3.4 prefix-list ACCEPT_FROM_ISP in

R1# show ip bgp neighbor 1.2.3.4 | include filter
  Inbound prefix list: ACCEPT_FROM_ISP

What it means:
- Filters BGP routes via a prefix-list (preferred over ACL).
- Use to limit accepted routes (e.g. only accept default route
  from ISP, not full Internet table).
- Critical safety: Limit AS-path acceptance + max-prefix limit
  to defend against accidental BGP leaks.` },

  { cmd: 'match access-group',
    example: `R1(config-cmap)# match access-group 100

# Or named ACL:
R1(config-cmap)# match access-group name ALLOW_WEB

R1# show class-map | include access-group
   Match access-group 100

What it means:
- Inside a QoS class-map, matches against an ACL.
- The ACL describes the traffic to classify (typical 5-tuple
  match).
- More flexible than match-direct-attribute (DSCP/CoS) because
  ACLs can match on src/dst IP, port, protocol.` },

  { cmd: 'switchport port-security',
    example: `Switch(config-if)# switchport mode access
Switch(config-if)# switchport port-security

Switch# show port-security interface gi1/0/1 | include Port Security
Port Security              : Enabled

What it means:
- Enables port-security on the access port. Default behaviour:
  - max 1 MAC, learned dynamically.
  - violation mode "shutdown" (errdisable on second MAC).
- Tighten / loosen with "maximum" + "violation" + "mac-address"
  sub-commands.` },

  { cmd: 'switchport port-security maximum <count>',
    example: `Switch(config-if)# switchport port-security maximum 2

Switch# show port-security interface gi1/0/1 | include Maximum
Maximum MAC Addresses      : 2

What it means:
- Allows up to 2 MACs on the port. Common for IP-phone setups
  (phone + PC behind the phone).
- Higher counts (e.g. 254) are common on hypervisor-facing ports
  where many VMs share one physical port.
- Keep the number tight to detect accidental hub plug-ins.` },

  { cmd: 'switchport port-security violation <protect|restrict|shutdown>',
    example: `Switch(config-if)# switchport port-security violation restrict

# When violation occurs:
%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred,
        caused by MAC address 0050.bad0.bad0 on port Gi1/0/1.

What it means:
- protect  : silent drop. No log, no err-disable.
- restrict : drop + syslog + counter. Port stays UP.
- shutdown : err-disable port (default).
- Most environments use "restrict" — alerts without disrupting.` },

  { cmd: 'switchport port-security mac-address sticky',
    example: `Switch(config-if)# switchport port-security mac-address sticky

# After a device connects, its MAC is auto-learned + saved:
Switch# show running-config interface gi1/0/1 | include sticky
 switchport port-security mac-address sticky 0050.5612.3456

What it means:
- "sticky" : dynamically learn MACs but persist them in
  running-config.
- Combine with "write memory" to persist to NVRAM — locks the
  port to the originally-connected device.
- Auto-locks ports for asset tracking compliance.` },

  { cmd: 'ip dhcp snooping',
    example: `Switch(config)# ip dhcp snooping

Switch# show ip dhcp snooping | head -3
Switch DHCP snooping is enabled

What it means:
- Globally enables DHCP snooping. Ports default to UNTRUSTED —
  rogue DHCP servers are blocked.
- Mark legitimate DHCP-server-facing ports with "ip dhcp
  snooping trust" interface command.
- Pair with "no ip dhcp snooping information option" if your
  DHCP server doesn't understand option-82 (Cisco-injected).` },

  { cmd: 'ip dhcp snooping vlan <id>',
    example: `Switch(config)# ip dhcp snooping vlan 10,20,30

Switch# show ip dhcp snooping | include VLAN
DHCP snooping is configured on following VLANs: 10,20,30

What it means:
- Specifies which VLANs participate in DHCP snooping.
- Without this, snooping is enabled globally but applies to no
  VLANs.
- DHCP packets in non-snooped VLANs flow normally (no protection).` },

  { cmd: 'ip dhcp snooping trust',
    example: `Switch(config)# interface gi1/0/24
Switch(config-if)# ip dhcp snooping trust

Switch# show ip dhcp snooping | include trust
trusted: GigabitEthernet1/0/24

What it means:
- Marks the interface as trusted for DHCP snooping.
- Trusted ports allow DHCPOFFER/DHCPACK (server-side messages)
  through.
- Untrusted (default) only allows DHCPDISCOVER/REQUEST (client
  messages).
- ALWAYS trust uplinks toward your legitimate DHCP server.` },

  { cmd: 'ip arp inspection vlan <id>',
    example: `Switch(config)# ip arp inspection vlan 10

Switch# show ip arp inspection vlan 10 | head -3
 Vlan     Configuration    Operation
 ----     -------------    ---------
   10     Enabled           Active

What it means:
- Enables Dynamic ARP Inspection on the named VLAN.
- DAI uses the DHCP-snooping binding table to validate ARP
  packets — drops mismatched IP-MAC pairs.
- Critical L2 security feature; pair with DHCP snooping for
  layered access-layer protection.` },

  { cmd: 'ip arp inspection trust',
    example: `Switch(config)# interface gi1/0/24
Switch(config-if)# ip arp inspection trust

Switch# show ip arp inspection interfaces | include 1/0/24
 Gi1/0/24                Trusted          None         N/A

What it means:
- Marks the interface as trusted for DAI. Trusted ports skip
  binding-table validation.
- Trust uplinks (toward gateway / core) — those carry many
  legitimate ARP entries from a single port.
- Untrusted (default) on user-facing ports : every ARP packet
  validated against DHCP-snooping bindings.` },

  { cmd: 'ip access-list extended <name>',
    example: `R1(config)# ip access-list extended ALLOW_WEB
R1(config-ext-nacl)# permit tcp any any eq 80
R1(config-ext-nacl)# permit tcp any any eq 443
R1(config-ext-nacl)# deny ip any any log

R1# show ip access-lists ALLOW_WEB
Extended IP access list ALLOW_WEB
    10 permit tcp any any eq 80
    20 permit tcp any any eq 443
    30 deny ip any any log

What it means:
- Modern named ACL syntax — auto-numbers entries 10, 20, 30 for
  easy mid-list inserts.
- "deny ip any any log" : explicit deny + log for security
  auditing.
- Apply with "ip access-group ALLOW_WEB in/out" on an interface.` },

  { cmd: 'ip access-group <acl-name> in',
    example: `R1(config-if)# ip access-group ALLOW_WEB in

R1# show ip interface gi0/0 | include access list
  Inbound  access list is ALLOW_WEB

What it means:
- Applies the named ACL to ingress traffic on this interface.
- Filter close to the source : use "in" on customer-facing
  interfaces to drop bad traffic before it consumes resources.
- Same ACL can be applied to multiple interfaces.` },

  { cmd: 'ip access-group <acl-name> out',
    example: `R1(config-if)# ip access-group ALLOW_HTTPS out

R1# show ip interface gi0/0 | include access list
  Outgoing access list is ALLOW_HTTPS

What it means:
- Applies the ACL to egress traffic.
- "out" filters traffic LEAVING the interface — useful for
  preventing leaks of internal traffic onto public links.
- Egress ACLs don't filter the router's own self-originated
  traffic by default ("ip access-group X out" affects only
  transit).` },

  { cmd: 'shutdown vlan <id>',
    example: `Switch(config)# shutdown vlan 99

Switch# show vlan id 99 | include Status
99   QUARANTINE  act/lshut

What it means:
- Administratively shuts the VLAN — all access ports in it
  stop forwarding.
- Useful for emergency containment (e.g. infected VLAN).
- Reverse with "no shutdown vlan 99".
- "act/lshut" status = active in DB but locally shut down.` },

  { cmd: 'login block-for <secs> attempts <n> within <secs>',
    example: `R1(config)# login block-for 120 attempts 4 within 60

# After 4 failed logins in 60 seconds, all logins blocked for 120 sec.

R1# show login | include Watch
Router presently in Watch-Mode, will remain in Watch-Mode for 0 seconds.

What it means:
- Brute-force defence : block all login attempts for 120 sec
  after 4 failures within 60 sec.
- "block-for" applies network-wide (not per-source-IP) —
  legitimate users can't log in during quiet-mode either.
- Configure "quiet-mode access-class" to exempt admin IPs from
  the lockout.` }
];

let updated = 0, alreadyHad = 0, notFound = 0;
const notFoundList = [];
for (const e of ENTRIES) {
  let found = null;
  for (const arr of Object.values(IOS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (!found) { notFound++; notFoundList.push(e.cmd.slice(0,60)); continue; }
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
if (notFoundList.length) {
  console.log('Not-found cmd starts:');
  for (const c of notFoundList) console.log('  -', c);
}
