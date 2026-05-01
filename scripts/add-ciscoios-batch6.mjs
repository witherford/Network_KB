// Cisco IOS enrichment batch 6 (Stage 3 final): cleanup duplicates + enrich uniques.
//
//   - DELETE concrete-form duplicates that the bracketed templates
//     already cover with rich examples (e.g. "router ospf 1" is a
//     concrete form of "router ospf [id]" which is already enriched).
//   - ENRICH genuinely unique remaining entries (mostly IPv6 OSPF /
//     EIGRP show commands and small-section gaps).
//   - For cross-section duplicates (e.g. "show interfaces trunk"
//     appears in both Interfaces and VLANs), copy the existing rich
//     example from the canonical entry.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const IOS  = data.platforms.ciscoios;

// === Concrete-form duplicates to DELETE ===
const DELETE = new Set([
  // OSPF concrete-form duplicates of bracket templates
  'router ospf 1',
  'router-id 1.1.1.1',
  'network 10.0.0.0 0.255.255.255 area 0',
  'no passive-interface GigabitEthernet0/0',
  'auto-cost reference-bandwidth 100000',
  'log-adjacency-changes detail',
  'show ip ospf database router self-originate',
  'ip ospf 1 area 0',
  'ip ospf cost 10',
  'ip ospf priority 0',
  'ip ospf hello-interval 3',
  'ip ospf dead-interval minimal hello-multiplier 4',
  'ip ospf authentication message-digest\nip ospf message-digest-key 1 md5 cisco-key',
  'area 1 stub',
  'area 1 stub no-summary',
  'area 1 nssa',
  'area 1 nssa default-information-originate',
  'area 1 range 10.1.0.0 255.255.0.0',
  'summary-address 192.168.0.0 255.255.0.0',
  'area 0 virtual-link 2.2.2.2',
  'area 0 authentication message-digest',
  'redistribute connected subnets metric 100 metric-type 2',
  'redistribute static subnets route-map STATIC-INTO-OSPF',
  'distribute-list prefix DENY-DEFAULT in',
  'default-information originate always metric 1 metric-type 2',
  'timers throttle spf 5 200 5000',
  'timers throttle lsa 0 5000 5000',
  'ipv6 router ospf 1',
  'ipv6 ospf 1 area 0',
  'redistribute ospf <process-id> / redistribute connected',
  'passive-interface interface-id',
  'router ospf process-id',
  'network ip-address wildcard-mask area area-id',
  'default-information originate [always] [metric metric-value] [metric-type type-value]',
  'ip ospf cost 1–65535',
  'ip ospf priority 0–255',
  'ip ospf network broadcast | point-to-point',
  'show ip ospf interface [brief]',
  'show ip ospf neighbor [detail]',
  // EIGRP concrete-form duplicates
  'router eigrp 100',
  'eigrp router-id 1.1.1.1',
  'network 10.0.0.0',
  'network 10.1.1.0 0.0.0.255',
  'passive-interface default\nno passive-interface GigabitEthernet0/0',
  'ip hello-interval eigrp 100 2',
  'ip hold-time eigrp 100 6',
  'ip bandwidth-percent eigrp 100 75',
  'ip authentication mode eigrp 100 md5\nip authentication key-chain eigrp 100 EIGRP-KC',
  'variance 2',
  'maximum-paths 6',
  'eigrp stub connected summary',
  'eigrp stub receive-only',
  'ip summary-address eigrp 100 10.10.0.0 255.255.0.0',
  'redistribute connected metric 1000000 1 255 1 1500',
  'redistribute static metric 1000000 1 255 1 1500',
  'distribute-list prefix BLOCK-RFC1918 in',
  'offset-list 10 in 100 GigabitEthernet0/1',
  'timers active-time disabled',
  'router eigrp NAMED\n address-family ipv4 unicast autonomous-system 100',
  'router eigrp NAMED\n address-family ipv4 unicast autonomous-system 100\n  af-interface default\n   passive-interface\n  exit-af-interface\n  topology base\n   maximum-paths 8\n  exit-af-topology',
  'router eigrp as-number',
  'network network [mask]',
  'ip eigrp router-id router-id',
  'ip eigrp hello-interval seconds',
  'ip eigrp hold-time seconds',
  'ip eigrp timers holdtime hello',
  'ip eigrp summary-address network mask [interface-id] next-hop-ip',
  'ip eigrp variance value'
]);

// === Genuine new commands to ENRICH ===
const ENRICH = [
  // IPv6 OSPF
  { cmd: 'show ipv6 ospf',
    example: `R1# show ipv6 ospf

Routing Process "ospfv3 1" with ID 1.1.1.1
 Event-log enabled, Maximum number of events: 1000, Mode: cyclic
 Router is not originating router-LSAs with maximum metric

 SPF schedule delay 5000 msecs, Hold time between two SPFs 10000 msecs
 Number of areas in this router is 1. 1 normal 0 stub 0 nssa
 Reference bandwidth unit is 100 mbps

 Area BACKBONE(0)
        Number of interfaces in this area is 2

What it means:
- Process-level OSPFv3 state: router-id, SPF timers, area count.
- "Reference bandwidth unit is 100 mbps" : default — same caveat
  as IPv4 OSPF (modify with "auto-cost reference-bandwidth").
- "Area BACKBONE(0)" : confirms area-0 is configured.` },

  { cmd: 'show ipv6 ospf neighbor',
    example: `R1# show ipv6 ospf neighbor

            OSPFv3 Router with ID (1.1.1.1) (Process ID 1)

Neighbor ID     Pri State          Dead Time  Interface ID Interface
2.2.2.2           1 FULL/-         00:00:34   3            GigabitEthernet0/0/0

What it means:
- IPv6 OSPF (OSPFv3) neighbours. State FULL = healthy steady-state.
- Adjacencies form over IPv6 link-local addresses (FE80::/10).
- "Pri" : OSPF priority for DR/BDR election (only relevant on
  broadcast network types).
- "Interface ID 3" : 32-bit interface identifier (OSPFv3 uses
  these instead of IP addresses to identify interfaces in LSAs).` },

  { cmd: 'show ipv6 ospf interface',
    example: `R1# show ipv6 ospf interface

GigabitEthernet0/0/0 is up, line protocol is up
  Link Local Address FE80::1, Interface ID 3
  Internet Address 2001:DB8::1/64
  Area 0, Process ID 1, Instance ID 0, Router ID 1.1.1.1
  Network Type POINT_TO_POINT, Cost: 1
  Transmit Delay is 1 sec, State POINT_TO_POINT
  Timer intervals configured, Hello 10, Dead 40, Wait 40, Retransmit 5
  Hello due in 00:00:01

What it means:
- Per-interface OSPFv3 state.
- "Link Local Address FE80::1" : adjacency is formed on the
  link-local IPv6 address.
- "Instance ID 0" : OSPFv3 supports multiple instances on the
  same link (rare, used in some MANET / mobile scenarios).
- Hello/Dead intervals : same defaults as IPv4 OSPF (10/40 on
  point-to-point, 30/120 on NBMA).` },

  { cmd: 'show ipv6 ospf database',
    example: `R1# show ipv6 ospf database

            OSPFv3 Router with ID (1.1.1.1) (Process ID 1)

                Router Link States (Area 0)

ADV Router       Age   Seq#       Fragment ID  Link Count
1.1.1.1          412   0x80000003          0   2
2.2.2.2          410   0x80000004          0   2

                Inter Area Prefix Link States (Area 0)

ADV Router       Age   Seq#       Prefix
1.1.1.1          120   0x80000001 2001:DB8:99::/64

What it means:
- IPv6 OSPF (OSPFv3) LSDB. Same shape as IPv4 OSPF, with IPv6
  specific LSA types (Type-8 = link, Type-9 = intra-area-prefix).
- "Inter Area Prefix" replaces "Summary Net" from OSPFv2.
- Use to verify IPv6-specific topology before drilling into
  individual LSAs.` },

  { cmd: 'ipv6 ospf cost 10',
    example: `R1(config-if)# ipv6 ospf cost 10

R1# show ipv6 ospf interface gi0/0 | include Cost
  Network Type POINT_TO_POINT, Cost: 10

What it means:
- Per-interface OSPFv3 cost override. Lower = preferred.
- Default cost based on auto-cost reference bandwidth / interface
  speed.
- Use to influence path selection without touching interface
  bandwidth (which would have side effects).` },

  { cmd: 'ipv6 ospf network point-to-point',
    example: `R1(config-if)# ipv6 ospf network point-to-point

R1# show ipv6 ospf interface gi0/0 | include Network
  Network Type POINT_TO_POINT, Cost: 1

What it means:
- Forces point-to-point network type. Skips DR/BDR election
  (faster convergence on back-to-back router links).
- Both ends must agree. Default on Ethernet is broadcast.
- Common on routed inter-router fibre links.` },

  // IPv6 EIGRP
  { cmd: 'ipv6 router eigrp 100',
    example: `R1(config)# ipv6 router eigrp 100
R1(config-rtr)# eigrp router-id 1.1.1.1
R1(config-rtr)# no shutdown

R1# show ipv6 protocols | include eigrp
*** IPv6 Routing is Enabled ***
"eigrp 100" is enabled

What it means:
- Classic-mode IPv6 EIGRP process. Modern best practice is to use
  Named Mode ("router eigrp NAMED" + "address-family ipv6
  unicast").
- Process must be "no shutdown" — IPv6 EIGRP boots in shutdown
  state.
- Enable per-interface with "ipv6 eigrp 100".` },

  { cmd: 'ipv6 eigrp 100',
    example: `R1(config-if)# ipv6 eigrp 100

R1# show ipv6 eigrp interfaces
EIGRP-IPv6 Interfaces for AS(100)
                Xmit Queue   PeerQ        Mean
Interface  Peers  Un/Reliable  Un/Reliable  SRTT
Gi0/0      1      0/0          0/0          1

What it means:
- Activates Classic-mode IPv6 EIGRP on the interface.
- Establishes adjacencies over IPv6 link-local (FE80::/10) — no
  global IPv6 prefix needed.
- For Named Mode, use "af-interface" inside the
  "address-family ipv6 unicast" instead.` },

  { cmd: 'show ipv6 eigrp neighbors',
    example: `R1# show ipv6 eigrp neighbors

EIGRP-IPv6 Neighbors for AS(100)
H  Address        Interface  Hold Uptime    SRTT  RTO  Q   Seq Num
                                  (sec)         (ms)      Cnt
0  Link-local     Gi0/0      12   00:04:15  4     100  0   12
   address: FE80::2

What it means:
- Active IPv6 EIGRP neighbours.
- Neighbours identified by IPv6 link-local addresses.
- Same column meaning as IPv4 EIGRP: Hold = sec until adjacency
  declared dead. SRTT = smoothed RTT.` },

  { cmd: 'show ipv6 eigrp topology',
    example: `R1# show ipv6 eigrp topology

EIGRP-IPv6 Topology Table for AS(100)/ID(1.1.1.1)

P 2001:DB8:99::/48, 1 successors, FD is 2816
        via FE80::2 (2816/2570), GigabitEthernet0/0

What it means:
- IPv6 EIGRP topology table. Same meaning as IPv4 (P = passive,
  FD = feasible distance).
- Next-hop FE80::2 = peer's link-local address.
- Pre-RIB view; "show ipv6 route eigrp" shows what's actually
  installed.` },

  { cmd: 'show ipv6 eigrp interfaces',
    example: `R1# show ipv6 eigrp interfaces

EIGRP-IPv6 Interfaces for AS(100)
                Xmit Queue   PeerQ        Mean   Pacing Time   Multicast
Interface  Peers  Un/Reliable  Un/Reliable  SRTT   Un/Reliable   Flow Timer
Gi0/0      1      0/0          0/0          1      0/2           50

What it means:
- Per-interface EIGRP-IPv6 stats.
- "Peers" : active EIGRP-IPv6 neighbours on this interface.
- Same column meanings as "show ip eigrp interfaces" (IPv4).` },

  // ============== Other small sections — copy from canonical entry ==============
  // Management
  { cmd: 'show ssh',
    example: `R1# show ssh

Connection Version Mode Encryption       Hmac          State                 Username
0          2.0     IN   aes256-ctr        hmac-sha2-256 Session started       admin
0          2.0     OUT  aes256-ctr        hmac-sha2-256 Session started       admin

%No SSHv1 server connections running.

What it means:
- Active SSH sessions with cipher / HMAC negotiation results.
- Per-direction (IN / OUT) entries — both must show the same
  session.
- "No SSHv1" = legacy protocol disabled (good — SSHv1 is broken).
- Confirm strong ciphers (aes256-ctr, chacha20-poly1305) and
  modern HMACs (sha2-256, sha2-512).` },

  // Show & Status (these are dups of Diagnostics/Troubleshooting entries — copy the rich example)
  { cmd: 'show environment all',
    example: `R1# show environment all

Sensor List:    Environmental Monitoring
Sensor          Location          State        Reading
Power Supply 1  PWR-PS1           Normal       OK (220V AC)
Power Supply 2  PWR-PS2           Normal       OK (220V AC)
Fan Tray        FAN1              Normal       OK (5200 RPM)
Inlet Temp      Slot 1            Normal       28C
Outlet Temp     Slot 1            Normal       42C
Hotspot Temp    CPU0              Normal       58C  (warning >80)

What it means:
- Hardware sensor dashboard — power, fans, temperatures.
- Any "Critical" or "Warning" state is a hardware alarm — open a
  TAC case immediately on dual-PSU redundancy loss.
- "Hotspot" sensors near 80°C threshold = airflow issue (dust,
  blocked vents, failed fan).` },

  { cmd: 'show platform',
    example: `R1# show platform

Chassis type: C9300-48UXM-A
Switch  Ports  Card Type                Serial No.   MAC Address
*1      48     C9300-48UXM              FCW2245A0AB  001a.1e11.2233
 2      48     C9300-48UXM              FCW2245A0AC  001a.1e11.2244

Switch  Slot  CFG  ID  Hw  Sw                  CurSw         Action
*1      0     1    8   2.0  17.09.04a           Active        Active
 2      0     1    8   2.0  17.09.04a           Standby       Standby

What it means:
- Chassis / stack overview. "*" = active switch in a stack.
- "CurSw" : currently-running software image. Mismatched versions
  in a stack cause problems — investigate via "show version" per
  switch.` },

  { cmd: 'show processes cpu history',
    example: `R1# show processes cpu history

R1            12:00:00 PM Wednesday May 01 2026
   100
    90
    80                                              *
    70                                            * * *
    60                                          * * * * *
    50  *  *  *  *  *  *  *  *  *  *  *  *    * * * * * *
    10
       0    5    10   15   20   25   30   35   40   45   50   55   60
                       CPU% per second (last 60 seconds)

What it means:
- ASCII art of CPU% over time — 60-sec, 1-hour, and 72-hour windows.
- Visual spike spotting: CPU jumped 50→90% during the recent attack.
- Useful for capacity-planning conversations with management.` },

  { cmd: 'show memory statistics',
    example: `R1# show memory statistics

                Head     Total(b)     Used(b)     Free(b)   Lowest(b)   Largest(b)
Processor   2A4B1234   1073741824   245678901   828062923   745678901   123456789
   I/O      2A5B5678    536870912    98765432   438105480    98765432    98765432

What it means:
- Memory pool stats. "Free" = currently available. "Lowest" =
  lowest-ever free since boot (water-mark).
- "Largest" = biggest contiguous free block. If "Free" is high but
  "Largest" is low, memory is fragmented.` },

  { cmd: 'interface interface-id',
    example: `R1(config)# interface gi0/0
R1(config-if)#

R1(config)# interface vlan 10
R1(config-if)#

What it means:
- Generic interface configuration entry syntax.
- Common types: GigabitEthernet, TenGigE, Loopback, Vlan, Tunnel,
  Port-channel.
- Shorthand abbreviations work: "int gi0/0".` },

  // VLANs (cross-section dupes — copy the rich example from Interfaces section)
  { cmd: 'switchport mode access',
    example: `Switch(config-if)# switchport mode access

Switch# show interfaces gi1/0/1 switchport | include Mode
Administrative Mode: static access

What it means:
- Forces a single-VLAN access port. Untagged frames only.
- Disables DTP negotiation — port won't accidentally become a
  trunk because someone connected a switch.
- Always set this explicitly on user-facing ports.` },

  { cmd: 'switchport mode trunk',
    example: `Switch(config-if)# switchport mode trunk

Switch# show interfaces gi1/0/24 switchport | include Mode
Administrative Mode: trunk
Operational Mode: trunk

What it means:
- Forces 802.1q trunk mode. Frames carry VLAN tags except for the
  native VLAN.
- Disables DTP — required by most enterprise security baselines.
- Pair with "switchport trunk allowed vlan" to restrict the trunk.` },

  { cmd: 'show interfaces trunk',
    example: `Switch# show interfaces trunk

Port      Mode             Encapsulation  Status        Native vlan
Gi1/0/24  on               802.1q         trunking      99
Po1       on               802.1q         trunking      99

Port      Vlans allowed on trunk
Gi1/0/24  10,20,30,99

Port      Vlans allowed and active in management domain
Gi1/0/24  10,20,30,99

Port      Vlans in spanning tree forwarding state and not pruned
Gi1/0/24  10,20,30

What it means:
- Per-port trunk configuration view. Mode/encapsulation/native
  VLAN/allowed list.
- Mismatched native VLANs cause an immediate %SPANTREE-2-PVSTSIM
  warning.` },

  { cmd: 'switchport nonegotiate',
    example: `Switch(config-if)# switchport nonegotiate

Switch# show interfaces gi1/0/24 switchport | include Negotiation
Negotiation of Trunking: Off

What it means:
- Disables DTP (Dynamic Trunking Protocol).
- Required step in security hardening — prevents rogue switches
  from forming trunks via DTP negotiation.
- Apply on every access port AND every manually-configured trunk.` },

  { cmd: 'no shutdown',
    example: `R1(config-if)# no shutdown

%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up

What it means:
- Brings the interface administratively up.
- L1/L2 negotiation runs. "line protocol up" confirms data link
  is operational.
- Required step on newly-configured interfaces (default is shut).` },

  { cmd: 'shutdown',
    example: `R1(config-if)# shutdown

%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to administratively down

R1# show interfaces gi0/1 | include line protocol
GigabitEthernet0/1 is administratively down, line protocol is down

What it means:
- Administratively disables the interface.
- Reverse with "no shutdown".
- Useful for bringing down an SVI or isolating a port during
  incident response.` },

  // Switching & STP
  { cmd: 'spanning-tree guard root',
    example: `Switch(config)# interface gi1/0/24
Switch(config-if)# spanning-tree guard root

# If a "better" BPDU arrives:
%SPANTREE-2-ROOTGUARD_BLOCK: Root guard blocking port Gi1/0/24 on VLAN0010.

What it means:
- Prevents the connected switch from becoming the STP root.
- Use on ports facing other administrative domains.
- If a "superior" BPDU arrives, port goes into "root-inconsistent"
  blocking state — recovers automatically when the offending
  BPDU stops.` },

  // Multicast
  { cmd: 'show ip mroute',
    example: `R1# show ip mroute

IP Multicast Routing Table
Flags: D - Dense, S - Sparse, B - Bidir Group, s - SSM Group,
       C - Connected, L - Local, P - Pruned, R - RP-bit set,
       F - Register flag, T - SPT-bit set, J - Join SPT

(*, 239.1.1.1), 00:14:23/00:02:50, RP 10.0.0.1, flags: SC
  Incoming interface: GigabitEthernet0/0, RPF nbr 10.10.10.1
  Outgoing interface list:
    GigabitEthernet0/1, Forward/Sparse, 00:14:23/00:02:50

What it means:
- (*, G) = shared tree. (S, G) = source-specific.
- "RPF nbr" : the RPF interface — must point upstream toward
  source/RP.
- "Outgoing interface list" : where multicast is replicated.` },

  { cmd: 'ip pim sparse-mode',
    example: `R1(config)# interface gigabitethernet 0/0
R1(config-if)# ip pim sparse-mode

R1# show ip pim interface gigabitethernet0/0
GigabitEthernet0/0  Address: 10.10.10.1  Mode: Sparse
                    DR: 10.10.10.50  Hello: 30 sec  Holdtime: 105 sec

What it means:
- Enables PIM Sparse Mode on the interface — most common
  multicast deployment.
- Requires an RP for (*, G) state until SPT switchover happens.
- "DR" = Designated Router on the segment.` },

  // NTP / SNMP / Logging
  { cmd: 'show ntp associations',
    example: `R1# show ntp associations

  address         ref clock       st   when   poll   reach   delay   offset    disp
*~129.6.15.28     .GPS.            1     12     64    377    24.521   0.142    0.221
+~10.10.10.50     129.6.15.28      2     45    128    377     1.214  -0.014    0.012
 ~10.10.10.51     129.6.15.28      2    102    128    377     1.198   0.018    0.014

* sys.peer, # selected, + candidate, - outlyer, x falseticker, . pps.peer

What it means:
- "*" = the currently-selected sync peer (sys.peer).
- "st" = stratum. 1 = directly synced to a reference clock.
- "reach" = octal bit-mask of last 8 polls (377 = all 8 successful).
- "delay/offset/disp" = round-trip in ms / phase offset / dispersion.` },

  // Diagnostics
  { cmd: 'debug ip ospf adj',
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
- "DBD" = Database Description packets.
- ALWAYS run "undebug all" after — debug commands consume CPU.` },

  { cmd: 'show ip dhcp snooping binding',
    example: `Switch# show ip dhcp snooping binding

MacAddress          IpAddress     Lease(sec)  Type           VLAN  Interface
00:1a:1e:11:22:33   10.10.0.50    86400       dhcp-snooping  10    Gi1/0/1
00:1a:1e:44:55:66   10.10.0.51    72000       dhcp-snooping  10    Gi1/0/2

Total number of bindings: 2

What it means:
- DHCP-snooping binding table — IP-MAC-port-VLAN tuples learned
  via DHCP exchanges on trusted ports.
- Used by Dynamic ARP Inspection (DAI) and IP Source Guard for
  L2 attack prevention.` },

  // Config Management
  { cmd: 'show archive',
    example: `R1# show archive

The maximum archive configurations allowed is 14.
The next archive file will be named flash:archive-15
Archive #  Name
   1       flash:archive-1
   2       flash:archive-2
  14       flash:archive-14   (Most recent)

What it means:
- Lists currently stored config archives.
- Use to roll back a bad config: "configure replace flash:archive-13".
- "maximum 14" = ring buffer; oldest archive is overwritten when
  the 15th is created.` },

  // BGP final
  { cmd: 'show tcp brief',
    example: `R1# show tcp brief

TCB         Local Address       Foreign Address     (state)
12345678    10.10.10.1.179      10.10.10.2.51223    ESTAB     ← BGP
87654321    10.10.10.1.22       10.50.50.50.42102   ESTAB     ← SSH

What it means:
- All TCP connections + listeners on the router itself.
- Port 179 = BGP. Port 22 = SSH.
- LISTEN entries on 23 / 80 / 443 = enabled services. Lock down
  with "no ip http server" / "transport input ssh".` }
];

// === Apply ===
let updated = 0, alreadyHad = 0, notFound = 0;
for (const e of ENRICH) {
  let found = null;
  for (const arr of Object.values(IOS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (!found) { notFound++; continue; }
  if (found.example && found.example.trim()) { alreadyHad++; continue; }
  found.example = e.example;
  updated++;
}

let deleted = 0;
for (const [secName, arr] of Object.entries(IOS.sections)) {
  IOS.sections[secName] = arr.filter(c => {
    if (DELETE.has(c.cmd)) { deleted++; return false; }
    return true;
  });
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log('Total enrich entries: ' + ENRICH.length);
console.log('Enriched (new):       ' + updated);
console.log('Already had example:  ' + alreadyHad);
console.log('Not found:            ' + notFound);
console.log('Deleted (duplicates): ' + deleted);
