// Add Cisco OSPF / EIGRP / BGP commands to three Cisco platforms:
//   ciscoios       — Cisco IOS
//   ciscoiosxe_sw  — Cisco IOS-XE Switch
//   nexus          — Cisco Nexus NX-OS  (NX-OS-specific syntax)
//
// Sourced from Cisco's official IOS / IOS XE / NX-OS configuration guides
// (cisco.com/c/en/us/td/docs/...). IPv6 variants (OSPFv3, EIGRP for IPv6,
// MP-BGP IPv6 unicast) included.
//
// Run: node scripts/expand-commands-6.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const P = data.platforms;

function addCmds(plat, sectionName, cmds) {
  plat.sections ||= {};
  plat.sections[sectionName] ||= [];
  const existing = new Set(plat.sections[sectionName].map(c => c.cmd));
  let added = 0;
  for (const c of cmds) {
    if (existing.has(c.cmd)) continue;
    existing.add(c.cmd);
    plat.sections[sectionName].push({
      cmd: c.cmd, desc: c.desc, type: c.type || 'show', flagged: c.flagged || false
    });
    added++;
  }
  return added;
}

// ===========================================================================
// IOS / IOS-XE OSPF (largely shared — IOS-XE Switch syntax matches)
// ===========================================================================

const OSPF_IOS = [
  // Basics
  { cmd: 'router ospf 1',              desc: 'Enter OSPF process 1 (process ID is locally significant).', type: 'config' },
  { cmd: 'router-id 1.1.1.1',          desc: 'Manually pin OSPF router-id (avoids re-elections when interfaces flap).', type: 'config' },
  { cmd: 'network 10.0.0.0 0.255.255.255 area 0', desc: 'Match any interface with an IP in 10.0.0.0/8 into area 0.', type: 'config' },
  { cmd: 'passive-interface default',  desc: 'Make every interface passive by default; opt-in actives below.', type: 'config' },
  { cmd: 'no passive-interface GigabitEthernet0/0', desc: 'Bring one interface back to active OSPF advertising.', type: 'config' },
  { cmd: 'auto-cost reference-bandwidth 100000', desc: 'Set the cost-100 reference to 100 Gbps so 10G/40G/100G interfaces get distinct costs.', type: 'config' },
  { cmd: 'log-adjacency-changes detail', desc: 'Log every state transition for OSPF adjacencies.', type: 'config' },
  { cmd: 'show ip ospf',                desc: 'Process-level summary: router-id, area count, SPF stats.' },
  { cmd: 'show ip ospf neighbor',       desc: 'Adjacency table: neighbour ID, state, dead-time, address, interface.' },
  { cmd: 'show ip ospf neighbor detail', desc: 'Per-neighbour detail incl. options, DR/BDR election, last-event reasons.' },
  { cmd: 'show ip ospf interface',      desc: 'OSPF state per interface: cost, priority, timers, neighbour count.' },
  { cmd: 'show ip ospf interface brief', desc: 'Compact per-interface OSPF state.' },
  { cmd: 'show ip ospf database',       desc: 'Full Link-State Database (router/network/summary/external LSAs).' },
  { cmd: 'show ip ospf database router self-originate', desc: 'Just the router-LSAs this device originated.' },
  { cmd: 'show ip ospf border-routers', desc: 'ABRs and ASBRs reachable from this router.' },
  { cmd: 'show ip ospf statistics',     desc: 'SPF runs, last/min/max SPF time, last reason for SPF.' },
  { cmd: 'show ip route ospf',          desc: 'OSPF-installed routes only.' },
  { cmd: 'clear ip ospf process',       desc: 'Restart OSPF; tears down adjacencies and rebuilds. Use cautiously in production.', type: 'troubleshooting', flagged: true },

  // Per-interface
  { cmd: 'ip ospf 1 area 0',            desc: 'Place the interface directly in OSPF area 0 (alternative to the network statement).', type: 'config' },
  { cmd: 'ip ospf cost 10',             desc: 'Override the auto-derived cost on this interface.', type: 'config' },
  { cmd: 'ip ospf priority 0',          desc: 'Make this interface ineligible for DR/BDR election.', type: 'config' },
  { cmd: 'ip ospf hello-interval 3',    desc: 'Sub-second hello (default 10 s on broadcast, 30 s NBMA).', type: 'config' },
  { cmd: 'ip ospf dead-interval minimal hello-multiplier 4', desc: 'Sub-second BFD-style dead-interval (4 hellos in 1 s).', type: 'config' },
  { cmd: 'ip ospf network point-to-point', desc: 'Skip DR/BDR election on broadcast media — faster adjacency.', type: 'config' },
  { cmd: 'ip ospf network broadcast',   desc: 'Force broadcast network type (default on Ethernet).', type: 'config' },
  { cmd: 'ip ospf bfd',                 desc: 'Bind OSPF to BFD on this interface for sub-second failure detection.', type: 'config' },
  { cmd: 'ip ospf authentication message-digest\nip ospf message-digest-key 1 md5 cisco-key', desc: 'Per-interface MD5 authentication.', type: 'config' },

  // Areas / advanced
  { cmd: 'area 1 stub',                 desc: 'Make area 1 a stub: blocks Type-5 LSAs, replaces with default route.', type: 'config' },
  { cmd: 'area 1 stub no-summary',      desc: 'Totally stubby area: blocks Type-3, 4, 5 — only default route enters.', type: 'config' },
  { cmd: 'area 1 nssa',                 desc: 'Not-So-Stubby Area: stub-like but allows local Type-7→5 redistribution.', type: 'config' },
  { cmd: 'area 1 nssa default-information-originate', desc: 'Inject default route into the NSSA from this ABR.', type: 'config' },
  { cmd: 'area 1 range 10.1.0.0 255.255.0.0', desc: 'Summarise inter-area routes leaving the ABR (Type-3).', type: 'config' },
  { cmd: 'summary-address 192.168.0.0 255.255.0.0', desc: 'Summarise external (Type-5) routes leaving the ASBR.', type: 'config' },
  { cmd: 'area 0 virtual-link 2.2.2.2', desc: 'Stitch a discontinuous area to area 0 via another router.', type: 'config' },
  { cmd: 'area 0 authentication message-digest', desc: 'Enable area-wide MD5 authentication (interfaces still need keys).', type: 'config' },
  { cmd: 'redistribute connected subnets metric 100 metric-type 2', desc: 'Redistribute connected with explicit metric / E2 type.', type: 'config' },
  { cmd: 'redistribute static subnets route-map STATIC-INTO-OSPF', desc: 'Filtered static-route redistribution.', type: 'config' },
  { cmd: 'distribute-list prefix DENY-DEFAULT in', desc: 'Filter incoming OSPF prefixes (only affects this router\'s RIB).', type: 'config' },
  { cmd: 'default-information originate always metric 1 metric-type 2', desc: 'Inject a default route into OSPF unconditionally.', type: 'config' },
  { cmd: 'timers throttle spf 5 200 5000', desc: 'SPF throttling: 5 ms initial, 200 ms hold, 5 s max — accelerates convergence.', type: 'config' },
  { cmd: 'timers throttle lsa 0 5000 5000', desc: 'LSA generation throttling.', type: 'config' },

  // OSPFv3 (IPv6)
  { cmd: 'ipv6 router ospf 1',          desc: 'Enable OSPFv3 process (IPv6).', type: 'config' },
  { cmd: 'ipv6 ospf 1 area 0',          desc: 'Per-interface OSPFv3 binding (no network statement in v3).', type: 'config' },
  { cmd: 'show ipv6 ospf',              desc: 'OSPFv3 process state.' },
  { cmd: 'show ipv6 ospf neighbor',     desc: 'OSPFv3 adjacencies.' },
  { cmd: 'show ipv6 ospf interface',    desc: 'OSPFv3 per-interface state.' },
  { cmd: 'show ipv6 ospf database',     desc: 'OSPFv3 LSDB.' },
  { cmd: 'ipv6 ospf cost 10',           desc: 'Per-interface cost on OSPFv3.', type: 'config' },
  { cmd: 'ipv6 ospf network point-to-point', desc: 'OSPFv3 network type.', type: 'config' }
];

// ===========================================================================
// IOS / IOS-XE EIGRP (classic + named-mode)
// ===========================================================================

const EIGRP_IOS = [
  // Classic mode basics
  { cmd: 'router eigrp 100',             desc: 'Enter classic EIGRP process for AS 100.', type: 'config' },
  { cmd: 'eigrp router-id 1.1.1.1',      desc: 'Manually set EIGRP router-id (32-bit, not necessarily an interface IP).', type: 'config' },
  { cmd: 'network 10.0.0.0',             desc: 'Match interfaces in 10.0.0.0/8 (uses classful boundary unless wildcard given).', type: 'config' },
  { cmd: 'network 10.1.1.0 0.0.0.255',   desc: 'Match a specific subnet with wildcard mask.', type: 'config' },
  { cmd: 'no auto-summary',              desc: 'Disable classful auto-summarisation (mandatory on modern designs).', type: 'config' },
  { cmd: 'passive-interface default\nno passive-interface GigabitEthernet0/0', desc: 'Default-passive with explicit opt-in for the uplink.', type: 'config' },
  { cmd: 'show ip eigrp neighbors',      desc: 'EIGRP adjacency table: hold, uptime, retransmits.' },
  { cmd: 'show ip eigrp neighbors detail', desc: 'Per-neighbour detail incl. version + capabilities.' },
  { cmd: 'show ip eigrp topology',       desc: 'Topology table — successors + feasible successors per prefix.' },
  { cmd: 'show ip eigrp topology all-links', desc: 'All learned paths, incl. non-feasible ones.' },
  { cmd: 'show ip eigrp interfaces',     desc: 'EIGRP per-interface counters: peers, queue, mean SRTT.' },
  { cmd: 'show ip eigrp interfaces detail', desc: 'Detailed per-interface EIGRP stats incl. timers.' },
  { cmd: 'show ip eigrp traffic',        desc: 'EIGRP packet counters: hellos, updates, queries, replies.' },
  { cmd: 'show ip route eigrp',          desc: 'EIGRP-installed routes only.' },
  { cmd: 'clear ip eigrp neighbors',     desc: 'Tear down all EIGRP adjacencies (forces re-sync).', type: 'troubleshooting', flagged: true },

  // Per-interface
  { cmd: 'ip hello-interval eigrp 100 2', desc: 'Set hello to 2 s on this interface.', type: 'config' },
  { cmd: 'ip hold-time eigrp 100 6',     desc: 'Set hold-time to 6 s — must be 3× hello.', type: 'config' },
  { cmd: 'ip bandwidth-percent eigrp 100 75', desc: 'Cap EIGRP traffic to 75% of interface bandwidth.', type: 'config' },
  { cmd: 'ip authentication mode eigrp 100 md5\nip authentication key-chain eigrp 100 EIGRP-KC', desc: 'Per-interface MD5 authentication via a key-chain.', type: 'config' },

  // Advanced
  { cmd: 'variance 2',                   desc: 'Allow unequal-cost load-balancing up to 2× the best metric.', type: 'config' },
  { cmd: 'maximum-paths 6',              desc: 'Allow up to 6 ECMP installs (default 4).', type: 'config' },
  { cmd: 'eigrp stub connected summary', desc: 'Mark this router as a stub — only advertises connected + summaries; reduces query scope.', type: 'config' },
  { cmd: 'eigrp stub receive-only',      desc: 'Strictest stub: this router receives EIGRP but advertises nothing.', type: 'config' },
  { cmd: 'ip summary-address eigrp 100 10.10.0.0 255.255.0.0', desc: 'Per-interface summary advertisement.', type: 'config' },
  { cmd: 'redistribute connected metric 1000000 1 255 1 1500', desc: 'Redistribute connected with K-values metric (BW/delay/rel/load/MTU).', type: 'config' },
  { cmd: 'redistribute static metric 1000000 1 255 1 1500', desc: 'Redistribute static.', type: 'config' },
  { cmd: 'distribute-list prefix BLOCK-RFC1918 in', desc: 'Filter incoming EIGRP advertisements.', type: 'config' },
  { cmd: 'offset-list 10 in 100 GigabitEthernet0/1', desc: 'Add 100 to the metric of routes received on Gi0/1 matching ACL 10.', type: 'config' },
  { cmd: 'timers active-time disabled',  desc: 'Disable EIGRP SIA (Stuck-In-Active) timer for very-large-scale or testing.', type: 'config', flagged: true },

  // Named-mode
  { cmd: 'router eigrp NAMED\n address-family ipv4 unicast autonomous-system 100', desc: 'Modern named-mode EIGRP — required for IPv6 / multi-AF.', type: 'config' },
  { cmd: 'router eigrp NAMED\n address-family ipv4 unicast autonomous-system 100\n  af-interface default\n   passive-interface\n  exit-af-interface\n  topology base\n   maximum-paths 8\n  exit-af-topology', desc: 'Named-mode skeleton with default-passive + 8-way ECMP.', type: 'config' },

  // EIGRP for IPv6 (classic)
  { cmd: 'ipv6 router eigrp 100',        desc: 'Classic-mode EIGRP for IPv6 process.', type: 'config' },
  { cmd: 'no shutdown',                  desc: 'EIGRPv6 starts shutdown — must explicitly bring it up.', type: 'config' },
  { cmd: 'eigrp router-id 1.1.1.1',      desc: 'Router-id required (32-bit, no IPv6 default available).', type: 'config' },
  { cmd: 'ipv6 eigrp 100',               desc: 'Per-interface enable for EIGRPv6.', type: 'config' },
  { cmd: 'show ipv6 eigrp neighbors',    desc: 'EIGRPv6 adjacencies.' },
  { cmd: 'show ipv6 eigrp topology',     desc: 'EIGRPv6 topology table.' },
  { cmd: 'show ipv6 eigrp interfaces',   desc: 'EIGRPv6 per-interface state.' }
];

// ===========================================================================
// IOS / IOS-XE BGP (classic + MP-BGP IPv6 / VRF basics)
// ===========================================================================

const BGP_IOS = [
  // Basics
  { cmd: 'router bgp 65001',             desc: 'Enter BGP process for local AS 65001.', type: 'config' },
  { cmd: 'bgp router-id 1.1.1.1',        desc: 'Manually pin BGP router-id.', type: 'config' },
  { cmd: 'bgp log-neighbor-changes',     desc: 'Log every BGP state change to syslog.', type: 'config' },
  { cmd: 'no synchronization',           desc: 'Disable IGP-sync requirement (default off in modern IOS).', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 remote-as 65002', desc: 'Define an eBGP peer.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 description ISP-A primary', desc: 'Free-text peer description.', type: 'config' },
  { cmd: 'network 10.0.0.0 mask 255.255.255.0', desc: 'Originate a prefix into BGP (must be present in RIB).', type: 'config' },
  { cmd: 'show ip bgp summary',          desc: 'Per-peer summary: state, prefixes received, uptime.' },
  { cmd: 'show ip bgp neighbors 1.2.3.4', desc: 'Per-peer detail: capabilities, timers, counters.' },
  { cmd: 'show ip bgp neighbors 1.2.3.4 advertised-routes', desc: 'Routes we are sending TO this peer.' },
  { cmd: 'show ip bgp neighbors 1.2.3.4 received-routes', desc: 'Routes we received from this peer (requires soft-reconfig inbound).' },
  { cmd: 'show ip bgp neighbors 1.2.3.4 routes', desc: 'Routes accepted from this peer (post-policy).' },
  { cmd: 'show ip bgp',                  desc: 'Full BGP table.' },
  { cmd: 'show ip bgp 8.8.8.0/24',       desc: 'Per-prefix path detail (best-path selection reasoning).' },
  { cmd: 'show ip bgp regexp _65000_',   desc: 'Filter table by AS-path regex (anything that traverses AS 65000).' },
  { cmd: 'show ip bgp paths',            desc: 'AS-path attribute database stats.' },
  { cmd: 'clear ip bgp 1.2.3.4',         desc: 'Hard reset of one peer (tears down TCP). Use sparingly.', type: 'troubleshooting', flagged: true },
  { cmd: 'clear ip bgp * soft',          desc: 'Soft refresh on every peer (apply policy without flap).', type: 'troubleshooting' },
  { cmd: 'clear ip bgp 1.2.3.4 soft in', desc: 'Soft inbound refresh (re-applies inbound policy from cache).', type: 'troubleshooting' },
  { cmd: 'clear ip bgp 1.2.3.4 soft out', desc: 'Re-send our outbound advertisements with current policy.', type: 'troubleshooting' },

  // Standard advanced — peering
  { cmd: 'neighbor 1.2.3.4 update-source Loopback0', desc: 'Source BGP TCP from a loopback (essential for iBGP).', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 ebgp-multihop 5', desc: 'Allow eBGP peer up to 5 hops away (loopback peering).', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 next-hop-self', desc: 'Rewrite next-hop to self when advertising eBGP routes to iBGP peers.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 password CISCO123', desc: 'TCP MD5 authentication for the peering session.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 ttl-security hops 1', desc: 'GTSM — drops packets with TTL < 255-hops; eBGP hardening.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 send-community both', desc: 'Send both standard and extended communities to the peer.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 remove-private-as', desc: 'Strip private AS numbers from outbound updates.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 maximum-prefix 500000 90 restart 30', desc: 'Cap inbound at 500k prefixes; warn at 90%; restart 30 min after exceeding.', type: 'config' },

  // Standard advanced — policy
  { cmd: 'neighbor 1.2.3.4 route-map FROM-ISP in', desc: 'Apply inbound route-map.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 route-map TO-ISP out', desc: 'Apply outbound route-map.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 prefix-list PEER-IN in', desc: 'Inbound prefix-list filter.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 filter-list 100 in', desc: 'Inbound AS-path filter using AS-path access-list 100.', type: 'config' },
  { cmd: 'ip prefix-list PEER-IN seq 10 permit 0.0.0.0/0 le 24', desc: 'Prefix-list entry: any /0–/24 inbound.', type: 'config' },
  { cmd: 'ip as-path access-list 100 permit ^65002_', desc: 'AS-path ACL: only routes whose AS-path begins with 65002.', type: 'config' },
  { cmd: 'route-map TO-ISP permit 10\n match ip address prefix-list MY-NETS\n set as-path prepend 65001 65001 65001', desc: 'Outbound prepend example for traffic-engineering.', type: 'config' },
  { cmd: 'route-map FROM-ISP permit 10\n set local-preference 200', desc: 'Inbound LP bump to prefer this peer.', type: 'config' },
  { cmd: 'route-map TO-CUSTOMER permit 10\n set community 65001:100 65001:200', desc: 'Tag advertised routes with communities.', type: 'config' },
  { cmd: 'aggregate-address 10.0.0.0 255.0.0.0 summary-only', desc: 'Originate the summary into BGP, suppress more-specifics outbound.', type: 'config' },
  { cmd: 'aggregate-address 10.0.0.0 255.0.0.0 as-set', desc: 'Aggregate carrying the AS-SET attribute (loop-prevention safe).', type: 'config' },
  { cmd: 'redistribute connected route-map CONN-INTO-BGP', desc: 'Filtered redistribution from connected.', type: 'config' },

  // Route-reflector / scaling / fast convergence
  { cmd: 'neighbor 1.2.3.4 route-reflector-client', desc: 'Mark the iBGP peer as an RR client (this router is the RR).', type: 'config' },
  { cmd: 'bgp cluster-id 1.1.1.1',       desc: 'Cluster-id for redundant RRs (must match across RRs of one cluster).', type: 'config' },
  { cmd: 'neighbor RR-CLIENTS peer-group\nneighbor RR-CLIENTS remote-as 65001\nneighbor RR-CLIENTS update-source Loopback0\nneighbor RR-CLIENTS route-reflector-client\nneighbor 2.2.2.2 peer-group RR-CLIENTS', desc: 'Peer-group reduces config and update-generation overhead for many similar peers.', type: 'config' },
  { cmd: 'maximum-paths 8',              desc: 'Enable 8-way eBGP ECMP.', type: 'config' },
  { cmd: 'maximum-paths ibgp 8',         desc: 'Enable 8-way iBGP ECMP.', type: 'config' },
  { cmd: 'bgp bestpath as-path multipath-relax', desc: 'Allow multipath even when AS-paths differ but length matches (multi-homing).', type: 'config' },
  { cmd: 'bgp graceful-restart',         desc: 'Enable Graceful Restart capability negotiation.', type: 'config' },
  { cmd: 'bgp dampening',                desc: 'Enable route-flap dampening (mostly avoided in modern Internet operations).', type: 'config' },
  { cmd: 'neighbor 1.2.3.4 fall-over bfd', desc: 'Bind BFD for sub-second BGP failure detection.', type: 'config' },

  // MP-BGP / IPv6 / VRF
  { cmd: 'address-family ipv6 unicast', desc: 'Enter IPv6 unicast address-family.', type: 'config' },
  { cmd: 'neighbor 2001:db8::1 remote-as 65002\naddress-family ipv6 unicast\n neighbor 2001:db8::1 activate', desc: 'IPv6 BGP peering — activate is mandatory in MP-BGP.', type: 'config' },
  { cmd: 'show bgp ipv6 unicast summary', desc: 'IPv6 BGP summary.' },
  { cmd: 'show bgp ipv6 unicast',        desc: 'IPv6 BGP table.' },
  { cmd: 'address-family vpnv4',         desc: 'VPNv4 (MPLS-VPN) address-family.', type: 'config' },
  { cmd: 'show bgp vpnv4 unicast all summary', desc: 'All VPNv4 peers across all VRFs.' },
  { cmd: 'address-family ipv4 vrf TENANT-A\n redistribute connected\n redistribute static', desc: 'Per-VRF BGP address-family for L3VPN.', type: 'config' }
];

// ===========================================================================
// Nexus NX-OS — overlapping but with feature/AF-explicit syntax
// ===========================================================================

const OSPF_NXOS = [
  { cmd: 'feature ospf',                 desc: 'Enable the OSPFv2 feature on Nexus (required before "router ospf").', type: 'config' },
  { cmd: 'router ospf UNDERLAY',         desc: 'Nexus uses tagged process names (string), not numeric process IDs.', type: 'config' },
  { cmd: 'router-id 1.1.1.1',            desc: 'Pin router-id under the process.', type: 'config' },
  { cmd: 'log-adjacency-changes detail', desc: 'Verbose adjacency-change syslog.', type: 'config' },
  { cmd: 'bfd',                          desc: 'Enable BFD for OSPF process-wide.', type: 'config' },
  { cmd: 'auto-cost reference-bandwidth 400 Gbps', desc: 'Modern reference-bandwidth for 400G/800G fabrics.', type: 'config' },
  { cmd: 'show ip ospf',                 desc: 'OSPFv2 process summary.' },
  { cmd: 'show ip ospf neighbors',       desc: 'Adjacency table.' },
  { cmd: 'show ip ospf interface brief', desc: 'Compact per-interface state.' },
  { cmd: 'show ip ospf database',        desc: 'OSPF LSDB.' },
  { cmd: 'show ip ospf border-routers',  desc: 'ABRs / ASBRs.' },
  { cmd: 'show ip ospf statistics',      desc: 'SPF execution stats.' },

  // Per-interface (Nexus has NO "network ... area" — interface binding instead)
  { cmd: 'interface Ethernet1/49\n no switchport\n ip address 10.0.0.1/31\n ip router ospf UNDERLAY area 0.0.0.0\n ip ospf network point-to-point\n ip ospf bfd', desc: 'Per-interface OSPF binding — Nexus does NOT use the IOS "network … area" command.', type: 'config' },
  { cmd: 'interface loopback0\n ip address 1.1.1.1/32\n ip router ospf UNDERLAY area 0.0.0.0', desc: 'Loopback into OSPF area 0.', type: 'config' },

  // Areas
  { cmd: 'area 1 stub no-summary',       desc: 'Totally-stubby area.', type: 'config' },
  { cmd: 'area 1 nssa default-information-originate', desc: 'NSSA with default-route injection.', type: 'config' },
  { cmd: 'area 1 range 10.1.0.0/16',     desc: 'Inter-area summary.', type: 'config' },
  { cmd: 'summary-address 192.168.0.0/16', desc: 'External summary at the ASBR.', type: 'config' },
  { cmd: 'area 0 authentication message-digest', desc: 'Area-wide MD5 auth.', type: 'config' },
  { cmd: 'redistribute direct route-map ALLOW', desc: 'Redistribute connected (Nexus calls connected "direct").', type: 'config' },
  { cmd: 'timers throttle spf 50 200 5000', desc: 'SPF throttling.', type: 'config' },

  // OSPFv3
  { cmd: 'feature ospfv3',               desc: 'Enable OSPFv3 (IPv6) feature.', type: 'config' },
  { cmd: 'router ospfv3 V6',             desc: 'OSPFv3 process.', type: 'config' },
  { cmd: 'interface Ethernet1/49\n ipv6 address 2001:db8::1/64\n ipv6 router ospfv3 V6 area 0.0.0.0', desc: 'Per-interface OSPFv3 binding.', type: 'config' },
  { cmd: 'show ipv6 ospfv3',             desc: 'OSPFv3 process.' },
  { cmd: 'show ipv6 ospfv3 neighbor',    desc: 'OSPFv3 adjacencies.' }
];

const EIGRP_NXOS = [
  { cmd: 'feature eigrp',                desc: 'Enable EIGRP feature on Nexus (required before "router eigrp").', type: 'config' },
  { cmd: 'router eigrp 100',             desc: 'Enter EIGRP process for AS 100.', type: 'config' },
  { cmd: 'router-id 1.1.1.1',            desc: 'Set EIGRP router-id.', type: 'config' },
  { cmd: 'autonomous-system 100',        desc: 'Explicit AS under named-process style on Nexus.', type: 'config' },
  { cmd: 'no shutdown',                  desc: 'Bring the EIGRP instance up (Nexus EIGRP is shutdown by default).', type: 'config' },
  { cmd: 'show ip eigrp',                desc: 'Per-process summary.' },
  { cmd: 'show ip eigrp neighbors',      desc: 'EIGRP adjacencies.' },
  { cmd: 'show ip eigrp topology',       desc: 'Topology table.' },
  { cmd: 'show ip eigrp interfaces',     desc: 'Per-interface EIGRP state.' },
  { cmd: 'show ip eigrp traffic',        desc: 'Per-process EIGRP packet counters.' },

  // Per-interface
  { cmd: 'interface Ethernet1/1\n no switchport\n ip address 10.1.1.1/24\n ip router eigrp 100', desc: 'Per-interface EIGRP enable on Nexus.', type: 'config' },
  { cmd: 'ip eigrp 100 hello-interval 2', desc: 'Sub-second hello.', type: 'config' },
  { cmd: 'ip eigrp 100 hold-time 6',      desc: 'Hold timer (must be 3× hello).', type: 'config' },
  { cmd: 'ip authentication mode eigrp 100 md5\nip authentication key-chain eigrp 100 EIGRP-KC', desc: 'MD5 authentication via key-chain.', type: 'config' },

  // Advanced
  { cmd: 'variance 2',                   desc: 'Unequal-cost load-balance up to 2× best metric.', type: 'config' },
  { cmd: 'maximum-paths 8',              desc: 'ECMP cap.', type: 'config' },
  { cmd: 'eigrp stub connected summary', desc: 'Stub router (reduces query scope).', type: 'config' },
  { cmd: 'redistribute direct route-map ALLOW', desc: 'Redistribute connected (Nexus "direct").', type: 'config' },
  { cmd: 'redistribute static route-map ALLOW', desc: 'Redistribute static.', type: 'config' },

  // EIGRP for IPv6
  { cmd: 'address-family ipv6 unicast',  desc: 'IPv6 AF inside EIGRP — Nexus uses MTR/AF style.', type: 'config' },
  { cmd: 'interface Ethernet1/1\n ipv6 address 2001:db8::1/64\n ipv6 router eigrp 100', desc: 'Per-interface EIGRPv6 enable.', type: 'config' },
  { cmd: 'show ipv6 eigrp neighbors',    desc: 'EIGRPv6 adjacencies.' },
  { cmd: 'show ipv6 eigrp topology',     desc: 'EIGRPv6 topology.' }
];

const BGP_NXOS = [
  { cmd: 'feature bgp',                  desc: 'Enable BGP feature on Nexus (required before "router bgp").', type: 'config' },
  { cmd: 'router bgp 65001',             desc: 'Enter BGP process for local AS.', type: 'config' },
  { cmd: 'router-id 1.1.1.1',            desc: 'Pin BGP router-id under the process.', type: 'config' },
  { cmd: 'log-neighbor-changes',         desc: 'Log BGP state-change events.', type: 'config' },
  { cmd: 'address-family ipv4 unicast',  desc: 'Enter the IPv4 unicast AF — required to advertise networks under it.', type: 'config' },
  { cmd: 'network 10.0.0.0/24',          desc: 'Originate a prefix into BGP (Nexus uses prefix/length form).', type: 'config' },

  // Peers
  { cmd: 'neighbor 1.2.3.4\n remote-as 65002\n update-source loopback0\n address-family ipv4 unicast\n  send-community both', desc: 'Peer block — AF activation/policy lives inside the peer block on Nexus.', type: 'config' },
  { cmd: 'neighbor 1.2.3.4\n remote-as 65001\n update-source loopback0\n address-family ipv4 unicast\n  next-hop-self\n  route-reflector-client', desc: 'iBGP peer + route-reflector role.', type: 'config' },
  { cmd: 'template peer SPINE\n remote-as external\n bfd\n update-source Ethernet1/49\n address-family ipv4 unicast\n  send-community both\n  allowas-in 1', desc: 'Peer template (Nexus equivalent of IOS peer-groups; cleaner config for many similar peers).', type: 'config' },
  { cmd: 'neighbor 10.0.0.0\n inherit peer SPINE', desc: 'Inherit a peer template.', type: 'config' },

  // Verification
  { cmd: 'show bgp ipv4 unicast summary', desc: 'IPv4 BGP peer summary.' },
  { cmd: 'show bgp ipv4 unicast',        desc: 'IPv4 BGP RIB.' },
  { cmd: 'show bgp ipv4 unicast neighbors 1.2.3.4', desc: 'Per-peer detail.' },
  { cmd: 'show bgp ipv4 unicast 8.8.8.0/24', desc: 'Per-prefix path detail.' },
  { cmd: 'show bgp all summary',         desc: 'All AFs / VRFs summary.' },
  { cmd: 'clear bgp ipv4 unicast 1.2.3.4 soft in', desc: 'Soft-refresh inbound.', type: 'troubleshooting' },
  { cmd: 'clear bgp ipv4 unicast * soft', desc: 'Soft-refresh all peers.', type: 'troubleshooting' },

  // Policy
  { cmd: 'ip prefix-list PEER-IN seq 10 permit 0.0.0.0/0 le 24', desc: 'Prefix-list (Nexus syntax matches IOS).', type: 'config' },
  { cmd: 'ip as-path access-list 100 permit "^65002_"', desc: 'AS-path filter (Nexus uses quoted regex).', type: 'config' },
  { cmd: 'route-map TO-ISP permit 10\n match ip address prefix-list MY-NETS\n set as-path prepend 65001 65001', desc: 'Outbound prepend route-map.', type: 'config' },
  { cmd: 'maximum-paths 8',              desc: 'eBGP ECMP cap (under address-family).', type: 'config' },
  { cmd: 'maximum-paths ibgp 8',         desc: 'iBGP ECMP cap.', type: 'config' },
  { cmd: 'bestpath as-path multipath-relax', desc: 'Multipath even when AS-paths differ but length matches.', type: 'config' },

  // VPN / EVPN / IPv6
  { cmd: 'address-family ipv6 unicast',  desc: 'IPv6 unicast AF.', type: 'config' },
  { cmd: 'address-family l2vpn evpn',    desc: 'BGP EVPN AF (needed for VXLAN-EVPN fabric).', type: 'config' },
  { cmd: 'address-family vpnv4 unicast', desc: 'VPNv4 (MPLS L3VPN) AF.', type: 'config' },
  { cmd: 'show bgp ipv6 unicast summary', desc: 'IPv6 BGP summary.' },
  { cmd: 'show bgp l2vpn evpn summary',  desc: 'EVPN BGP peer summary.' },
  { cmd: 'show bgp l2vpn evpn',          desc: 'EVPN BGP table (VTEP MAC/IP advertisements).' },
  { cmd: 'show bgp l2vpn evpn route-type 2', desc: 'Type-2 (MAC/IP) routes only.' },

  // Fast convergence
  { cmd: 'neighbor 1.2.3.4\n bfd',       desc: 'Bind BFD to a BGP peer.', type: 'config' },
  { cmd: 'graceful-restart',             desc: 'Enable BGP graceful-restart.', type: 'config' },
  { cmd: 'timers bestpath-defer 100 maximum 300', desc: 'Defer best-path computation under churn (NX-OS 9.x+).', type: 'config' }
];

// ===========================================================================
// IOS-XE Router baseline (ASR1k / CSR1000v / Catalyst 8000) — separate
// platform from the Switch flavour. Routing-protocol syntax matches IOS
// classic, so we reuse OSPF_IOS / EIGRP_IOS / BGP_IOS for the protocol
// sections and add a baseline of router-side commands (System / Interfaces /
// Diagnostics + a sprinkling of router-specific topics: NAT, IPsec, MPLS,
// QoS, NetFlow, IP SLA, Embedded Event Manager).
// ===========================================================================

const ROUTER_SYS = [
  { cmd: 'show version',                 desc: 'Software image, uptime, last reload, hardware (route processor + line cards).' },
  { cmd: 'show platform',                desc: 'IOS-XE platform/SDM info; on ASR1k shows ESP/SIP/RP modules.' },
  { cmd: 'show platform software status control-processor brief', desc: 'Per-CPU load + memory on the route processor and ESP.' },
  { cmd: 'show platform hardware qfp active datapath utilization summary', desc: 'QuantumFlowProcessor (forwarding engine) utilisation — the ASR/CSR equivalent of "show processes cpu" for the dataplane.' },
  { cmd: 'show inventory',               desc: 'Chassis + module inventory with serials.' },
  { cmd: 'show environment',             desc: 'PSUs, fans, temperature.' },
  { cmd: 'show running-config',          desc: 'Active config.' },
  { cmd: 'show startup-config',          desc: 'Saved config.' },
  { cmd: 'show file systems',            desc: 'Available file systems + free space (bootflash/harddisk/usb).' },
  { cmd: 'show clock detail',            desc: 'Current time + source.' },
  { cmd: 'show users',                   desc: 'Active console + VTY sessions.' },
  { cmd: 'show license summary',         desc: 'Smart Licensing summary (DNA / IOS-XE Universal).' },
  { cmd: 'show install summary',         desc: 'Installed sub-packages + version (IOS-XE patch state).' },
  { cmd: 'show tech-support | redirect bootflash:tech.txt', desc: 'Full diagnostic dump for TAC, redirected to bootflash.', type: 'troubleshooting' }
];

const ROUTER_INTF = [
  { cmd: 'show interfaces',              desc: 'Detailed status, packet/error counters.' },
  { cmd: 'show ip interface brief | exclude unassigned', desc: 'Layer-3 interfaces and their addresses.' },
  { cmd: 'show interfaces description',  desc: 'Brief: interface, status, protocol, description.' },
  { cmd: 'show interfaces transceiver detail', desc: 'SFP DOM (Tx/Rx power, temperature).' },
  { cmd: 'show controllers GigabitEthernet0/0/0', desc: 'PHY-level diagnostics (CRC, framing errors).' },
  { cmd: 'interface GigabitEthernet0/0/0\n description WAN\n ip address 198.51.100.2 255.255.255.252\n no shutdown', desc: 'Routed interface baseline.', type: 'config' },
  { cmd: 'interface Loopback0\n ip address 1.1.1.1 255.255.255.255', desc: 'Loopback for routing protocol IDs / source.', type: 'config' },
  { cmd: 'interface Tunnel0\n ip address 10.255.255.1 255.255.255.252\n tunnel source GigabitEthernet0/0/0\n tunnel destination 198.51.100.10\n tunnel mode ipsec ipv4', desc: 'Route-based IPsec VTI tunnel (modern site-to-site VPN).', type: 'config' },
  { cmd: 'interface Tunnel0\n tunnel mode gre ip', desc: 'GRE tunnel mode (over IPv4).', type: 'config' }
];

const ROUTER_NAT = [
  { cmd: 'show ip nat translations',     desc: 'Active NAT translations.' },
  { cmd: 'show ip nat statistics',       desc: 'Hits, misses, dropped translations.' },
  { cmd: 'clear ip nat translation *',   desc: 'Drop all NAT entries — testing only.', type: 'troubleshooting', flagged: true },
  { cmd: 'ip nat inside source list 1 interface GigabitEthernet0/0/0 overload', desc: 'PAT overload to outside interface.', type: 'config' },
  { cmd: 'ip nat inside source static 10.0.0.10 198.51.100.10', desc: '1:1 static NAT.', type: 'config' },
  { cmd: 'ip nat outside source static 198.51.100.20 10.0.0.20', desc: 'Static NAT for outside-to-inside traffic.', type: 'config' }
];

const ROUTER_IPSEC = [
  { cmd: 'show crypto ikev2 sa',         desc: 'IKEv2 Security Associations (current peer state).' },
  { cmd: 'show crypto ikev2 sa detail',  desc: 'Verbose IKEv2 detail with proposals + lifetimes.' },
  { cmd: 'show crypto ipsec sa',         desc: 'IPsec SAs — packets enc/dec, bytes, lifetimes.' },
  { cmd: 'show crypto session',          desc: 'High-level peer session summary.' },
  { cmd: 'show crypto session detail',   desc: 'Per-session detail with all SAs and policies.' },
  { cmd: 'show crypto ipsec stats',      desc: 'Aggregate IPsec packet stats.' },
  { cmd: 'debug crypto ikev2 protocol 64', desc: 'IKEv2 packet-level debug — careful in production.', type: 'troubleshooting', flagged: true },
  { cmd: 'crypto ikev2 proposal AES-GCM\n encryption aes-gcm-256\n integrity null\n group 19 20\n prf sha256', desc: 'Modern IKEv2 proposal: AES-GCM with PRF/SHA-256.', type: 'config' },
  { cmd: 'crypto ikev2 policy POLICY1\n proposal AES-GCM', desc: 'IKEv2 policy bound to a proposal.', type: 'config' },
  { cmd: 'crypto ikev2 keyring KR1\n peer SITE-A\n  address 198.51.100.10\n  pre-shared-key local <psk>\n  pre-shared-key remote <psk>', desc: 'IKEv2 keyring with PSK.', type: 'config' },
  { cmd: 'crypto ikev2 profile PROF1\n match identity remote address 198.51.100.10 255.255.255.255\n authentication local pre-share\n authentication remote pre-share\n keyring local KR1', desc: 'IKEv2 profile (binds keyring + identity).', type: 'config' },
  { cmd: 'crypto ipsec transform-set TS1 esp-gcm 256\n mode tunnel', desc: 'IPsec transform-set with AES-GCM.', type: 'config' },
  { cmd: 'crypto ipsec profile PROF1\n set transform-set TS1\n set ikev2-profile PROF1', desc: 'IPsec profile attached to a VTI.', type: 'config' }
];

const ROUTER_MPLS = [
  { cmd: 'show mpls ldp neighbor',       desc: 'LDP peers + their assigned label-space.' },
  { cmd: 'show mpls ldp bindings',       desc: 'Label bindings (local + remote).' },
  { cmd: 'show mpls forwarding-table',   desc: 'LFIB — incoming label, outgoing label, next hop, prefix.' },
  { cmd: 'show mpls interfaces',         desc: 'MPLS-enabled interfaces + their forwarding state.' },
  { cmd: 'show ip route vrf TENANT-A',   desc: 'Per-VRF routing table (L3VPN customer-facing).' },
  { cmd: 'show bgp vpnv4 unicast all summary', desc: 'All VPNv4 peers across every VRF.' },
  { cmd: 'show bgp vpnv4 unicast all',   desc: 'Full VPNv4 RIB.' },
  { cmd: 'show bgp vpnv4 unicast vrf TENANT-A', desc: 'Per-VRF VPNv4 routes.' },
  { cmd: 'mpls ip',                      desc: 'Enable MPLS IP forwarding globally / per interface.', type: 'config' },
  { cmd: 'interface GigabitEthernet0/0/0\n mpls ip\n mpls label protocol ldp', desc: 'Enable LDP on a core interface.', type: 'config' },
  { cmd: 'vrf definition TENANT-A\n rd 65001:1\n address-family ipv4\n  route-target export 65001:1\n  route-target import 65001:1', desc: 'L3VPN VRF baseline.', type: 'config' },
  { cmd: 'interface GigabitEthernet0/0/1\n vrf forwarding TENANT-A\n ip address 10.1.1.1 255.255.255.0', desc: 'Place an interface in a VRF.', type: 'config' }
];

const ROUTER_QOS = [
  { cmd: 'show policy-map interface GigabitEthernet0/0/0', desc: 'Per-interface policy stats: matched / queued / dropped.' },
  { cmd: 'show policy-map interface GigabitEthernet0/0/0 output class VOICE', desc: 'Per-class policy detail.' },
  { cmd: 'show class-map',               desc: 'Configured class-maps.' },
  { cmd: 'show policy-map',              desc: 'Configured policy-maps.' },
  { cmd: 'class-map match-any VOICE\n match dscp ef\n match cos 5', desc: 'Match voice traffic by DSCP EF or CoS 5.', type: 'config' },
  { cmd: 'policy-map WAN-OUT\n class VOICE\n  priority percent 30\n class VIDEO\n  bandwidth percent 20\n class class-default\n  fair-queue', desc: 'Hierarchical egress policy — strict priority for voice, CBWFQ otherwise.', type: 'config' },
  { cmd: 'interface GigabitEthernet0/0/0\n service-policy output WAN-OUT', desc: 'Bind the policy outbound on the WAN interface.', type: 'config' }
];

const ROUTER_NETFLOW_SLA = [
  { cmd: 'show flow exporter',           desc: 'Configured Flexible NetFlow exporters + statistics.' },
  { cmd: 'show flow monitor',            desc: 'Active flow monitors and their cache.' },
  { cmd: 'show flow monitor MON cache',  desc: 'Per-monitor cache snapshot (flow records).' },
  { cmd: 'show ip sla statistics',       desc: 'IP SLA probe results.' },
  { cmd: 'show ip sla configuration',    desc: 'Configured SLA probes.' },
  { cmd: 'flow exporter EXP1\n destination 10.50.50.50\n transport udp 2055\n template data timeout 60\n!\nflow record REC1\n match ipv4 source address\n match ipv4 destination address\n match transport source-port\n match transport destination-port\n collect counter bytes\n collect counter packets', desc: 'Flexible NetFlow exporter + record skeleton.', type: 'config' },
  { cmd: 'flow monitor MON1\n exporter EXP1\n record REC1\n cache timeout active 60', desc: 'Flow monitor binding.', type: 'config' },
  { cmd: 'interface GigabitEthernet0/0/0\n ip flow monitor MON1 input\n ip flow monitor MON1 output', desc: 'Apply NetFlow on an interface.', type: 'config' },
  { cmd: 'ip sla 10\n icmp-echo 8.8.8.8 source-interface GigabitEthernet0/0/0\n threshold 200\n timeout 500\n frequency 5\n!\nip sla schedule 10 life forever start-time now', desc: 'Continuous ICMP probe to 8.8.8.8 with 200 ms threshold.', type: 'config' },
  { cmd: 'track 1 ip sla 10 reachability', desc: 'Track object that flips based on SLA result — bind to static routes / EEM.', type: 'config' }
];

const ROUTER_DIAG = [
  { cmd: 'ping 8.8.8.8 source loopback0', desc: 'Sourced ping.' },
  { cmd: 'ping 8.8.8.8 size 1500 df-bit count 5', desc: 'Path-MTU smoke test.' },
  { cmd: 'traceroute 8.8.8.8 source loopback0', desc: 'Sourced traceroute.' },
  { cmd: 'show ip arp',                  desc: 'ARP cache.' },
  { cmd: 'show ip cef',                  desc: 'CEF FIB.' },
  { cmd: 'show ip cef 8.8.8.8 internal', desc: 'CEF entry internals (rewrite + adjacency).' },
  { cmd: 'show ip route',                desc: 'IPv4 routing table.' },
  { cmd: 'show ipv6 route',              desc: 'IPv6 routing table.' },
  { cmd: 'show ipv6 neighbors',          desc: 'IPv6 neighbour-discovery cache.' },
  { cmd: 'monitor capture CAP interface GigabitEthernet0/0/0 both match any buffer size 10 limit pps 1000', desc: 'Embedded packet capture (EPC) on an interface.', type: 'troubleshooting' },
  { cmd: 'monitor capture CAP start',    desc: 'Start the capture.', type: 'troubleshooting' },
  { cmd: 'monitor capture CAP stop',     desc: 'Stop the capture.', type: 'troubleshooting' },
  { cmd: 'monitor capture CAP export bootflash:cap.pcap', desc: 'Export EPC capture to bootflash.', type: 'troubleshooting' },
  { cmd: 'show platform hardware qfp active feature mfr datapath drops', desc: 'Per-feature QFP datapath drop counters (ASR/CSR-only).', type: 'troubleshooting' }
];

const ROUTER_CFGMGMT = [
  { cmd: 'copy running-config startup-config', desc: 'Save running to startup.', type: 'config' },
  { cmd: 'write memory',                 desc: 'Alias for copy run start.', type: 'config' },
  { cmd: 'copy running-config bootflash:cfg-' + new Date().toISOString().slice(0,10) + '.cfg', desc: 'Local backup with date suffix.', type: 'config' },
  { cmd: 'archive\n path bootflash:archive-\n maximum 14\n write-memory\n time-period 1440', desc: 'Auto-archive every 24 h, retain 14.', type: 'config' },
  { cmd: 'configure replace bootflash:archive-1', desc: 'Atomic config rollback to a saved archive.', type: 'config', flagged: true },
  { cmd: 'reload in 5',                  desc: 'Schedule a reload in 5 minutes.', type: 'config', flagged: true },
  { cmd: 'reload cancel',                desc: 'Cancel a scheduled reload.', type: 'config' },
  { cmd: 'install add file bootflash:isr4400-universalk9.17.12.04.SPA.bin activate commit', desc: 'IOS-XE one-shot install / activate / commit.', type: 'config', flagged: true }
];

// ===========================================================================
// Apply
// ===========================================================================

function ensure(key, name) {
  if (!P[key]) {
    if (key === 'ciscoiosxe_router') {
      P[key] = {
        label: 'Cisco IOS-XE Router',
        badge: 'badge-sw',
        short: 'IOS-XE Router',
        group: 'Cisco',
        sections: {}
      };
      return P[key];
    }
    throw new Error('platform missing: ' + key);
  }
  return P[key];
}

const stats = {};
function add(platKey, sec, list) {
  const plat = ensure(platKey);
  const before = (plat.sections[sec] || []).length;
  const added = addCmds(plat, sec, list);
  stats[platKey] ||= {};
  stats[platKey][sec] = { before, added, total: (plat.sections[sec] || []).length };
}

// IOS
add('ciscoios',      'OSPF',  OSPF_IOS);
add('ciscoios',      'EIGRP', EIGRP_IOS);
add('ciscoios',      'BGP',   BGP_IOS);

// IOS-XE Switch — same syntax for these protocols
add('ciscoiosxe_sw', 'OSPF',  OSPF_IOS);
add('ciscoiosxe_sw', 'EIGRP', EIGRP_IOS);
add('ciscoiosxe_sw', 'BGP',   BGP_IOS);

// Nexus — distinct syntax
add('nexus',         'OSPF',  OSPF_NXOS);
add('nexus',         'EIGRP', EIGRP_NXOS);
add('nexus',         'BGP',   BGP_NXOS);

// IOS-XE Router — new platform; reuse IOS-flavour OSPF/EIGRP/BGP (same syntax)
// plus a baseline of router-side topics (NAT, IPsec, MPLS, QoS, NetFlow, etc.)
add('ciscoiosxe_router', 'System & Status',          ROUTER_SYS);
add('ciscoiosxe_router', 'Interfaces',               ROUTER_INTF);
add('ciscoiosxe_router', 'OSPF',                     OSPF_IOS);
add('ciscoiosxe_router', 'EIGRP',                    EIGRP_IOS);
add('ciscoiosxe_router', 'BGP',                      BGP_IOS);
add('ciscoiosxe_router', 'NAT',                      ROUTER_NAT);
add('ciscoiosxe_router', 'IPsec / Crypto',           ROUTER_IPSEC);
add('ciscoiosxe_router', 'MPLS / L3VPN',             ROUTER_MPLS);
add('ciscoiosxe_router', 'QoS',                      ROUTER_QOS);
add('ciscoiosxe_router', 'NetFlow / IP SLA',         ROUTER_NETFLOW_SLA);
add('ciscoiosxe_router', 'Diagnostics',              ROUTER_DIAG);
add('ciscoiosxe_router', 'Config Management',        ROUTER_CFGMGMT);

// Save
data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const MAN = path.resolve('data/manifest.json');
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log('\nAdditions:');
for (const [pk, sec] of Object.entries(stats)) {
  console.log(' ', pk);
  for (const [s, info] of Object.entries(sec)) {
    console.log(`    ${s.padEnd(8)} +${info.added} (was ${info.before}, now ${info.total})`);
  }
}

let total = 0;
for (const p of Object.values(P)) for (const s of Object.values(p.sections || {})) total += s.length;
console.log('\nTotal commands now:', total);
