// Cisco IOS enrichment batch 5 (Stage 3): Show & Status (43 legit + 21 garbage to delete) + BGP (52).

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const IOS  = data.platforms.ciscoios;

// PDF-parse artifacts / off-topic entries that should never have been
// added (bolt = Puppet, cmd.run/network.interfaces = Salt/Ansible, plus
// raw text fragments from the original chapter-import script).
const GARBAGE = new Set([
  'respond based on general ability. Since the user query is "extract all commands from this PDF"',
  'hash',
  'Command Syntax.',
  'Command Syntax',
  'based on provided text.',
  'only if they are relevant. Otherwise',
  'WebAuth',
  'they often correspond to CLI commands in Cisco WLC (e.g.',
  'Command Syntax (or similar).',
  'respond to the best of ability.',
  'Radioactive Trace Control Screen',
  "but that's a feature.",
  'newlines for rows).',
  'bolt command run <command-name>',
  'bolt script run <script-name>',
  'bolt task run <modulename::taskfilename>',
  'bolt task show <modulename::taskfilename>',
  'bolt task run modulename::taskfilename',
  'bolt task show modulename::taskfilename',
  'cmd.run',
  'network.interfaces'
]);

const ENTRIES = [
  // ============== Show & Status (legitimate entries only) ==============
  { cmd: 'show startup-config',
    example: `R1# show startup-config | head -20

Using 24521 out of 524288 bytes
!
! Last configuration change at 09:00:00 GMT Wed May 1 2026 by admin
! NVRAM config last updated at 11:22:18 GMT Wed May 1 2026 by admin
!
version 17.9
service password-encryption
hostname R1
!
boot-start-marker
boot-end-marker
!
no aaa new-model
ip domain-name corp.local
...

What it means:
- Shows the persisted (NVRAM) config — what the router will boot
  with after a reload.
- Compare with "show running-config" (in-memory, may differ if
  changes weren't saved).
- "Using N out of M bytes" = NVRAM utilisation. Approaching the
  limit on busy boxes is rare but worth watching.` },

  { cmd: 'show environment all',
    example: `R1# show environment all

Sensor List:    Environmental Monitoring
Sensor          Location          State        Reading
PSU 1           PSU-1             Normal       OK (220V AC)
PSU 2           PSU-2             Normal       OK (220V AC)
Fan Tray 1      FAN1              Normal       OK (5200 RPM)
Inlet Temp      Slot 1            Normal       28C
Outlet Temp     Slot 1            Normal       42C
Hotspot Temp    CPU0              Normal       58C  (warning >80)

What it means:
- Hardware sensor dashboard. Any "Critical" or "Warning" state
  is a hardware alarm.
- Hotspot near 80°C threshold = airflow problem (dust, blocked
  vents, failed fan).
- Dual-PSU redundancy loss = open TAC case immediately.` },

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
- Stack / chassis overview. "*" = active switch.
- "CurSw" : currently-running software image. Mismatched versions
  in a stack cause problems — investigate via "show version" per
  switch.
- Confirm member counts match physical hardware before stack
  operations.` },

  { cmd: 'show processes cpu history',
    example: `R1# show processes cpu history

R1            12:00:00 PM Wednesday May 01 2026
   100
    90                                                  *
    80                                              *  *
    70                                            * *  *
    60                                          * *  * *
    50  *  *  *  *  *  *  *  *  *  *  *  *    * *  * *
    10
       0    5    10   15   20   25   30   35   40   45   50   55   60
                       CPU% per second (last 60 seconds)

What it means:
- ASCII-art CPU% over time. 60-sec, 1-hour, and 72-hour graphs.
- Visual spike spotting: easier than scrolling through "show
  processes cpu sorted" snapshots.
- Print this when documenting a performance incident — gives a
  visual record of when the spike started.` },

  { cmd: 'show processes memory sorted',
    example: `R1# show processes memory sorted

Total: 1073741824, Used: 245678901, Free: 828062923

PID  TTY  Allocated  Freed    Holding   Process
142  0    1245678    102341   45012345  IP Input
245  0    458901     12003    8902341   BGP Router
1    0    234561     4012     7012345   Init

What it means:
- Per-process memory usage, sorted by "Holding" (currently held).
- Sustained growth in one process = memory leak in that subsystem
  — open a TAC case.
- Compare "Holding" to "Allocated - Freed" — large gap suggests
  fragmentation rather than actual leak.` },

  { cmd: 'show memory statistics',
    example: `R1# show memory statistics

                Head     Total(b)     Used(b)     Free(b)   Lowest(b)   Largest(b)
Processor   2A4B1234   1073741824   245678901   828062923   745678901   123456789
   I/O      2A5B5678    536870912    98765432   438105480    98765432    98765432

What it means:
- Memory pool stats. Pools: Processor (control plane) + I/O
  (packet buffers).
- "Lowest" : lowest-ever free since boot — water-mark approaching
  zero = approaching exhaustion.
- "Largest" / "Free" : if Free is high but Largest is low, memory
  is fragmented.` },

  { cmd: 'show file systems',
    example: `R1# show file systems

File Systems:
*   Size(b)         Free(b)         Type  Flags  Prefixes
   1838348288      1593876480       disk  rw     bootflash:
        16384            16384      nvram rw     nvram:
   2147483648      1789632000       disk  rw     usbflash0:
   ---             ---              opaque rw    null:

What it means:
- All available file systems. "*" = current default (cd here
  with "cd <prefix>").
- Common prefixes: bootflash: (firmware + archives), nvram:
  (startup-config), usbflash0: (USB stick if inserted), tftp:
  / scp: / http: (network).
- Check Free space before downloading large IOS images.` },

  { cmd: 'show line vty 0 4',
    example: `R1# show line vty 0 4

   Tty Typ  Tx/Rx     A Modem  Roty AccO AccI   Uses   Noise  Overruns   Int
*  578 VTY            -    -      -    -    -      0       0     0/0       -
   579 VTY            -    -      -    -    5      0       0     0/0       -
   580 VTY            -    -      -    -    -      0       0     0/0       -
   581 VTY            -    -      -    -    -      0       0     0/0       -
   582 VTY            -    -      -    -    -      0       0     0/0       -

What it means:
- VTY (virtual terminal) line state. "*" = currently-used line.
- "AccI 5" : ACL 5 applied to inbound (filters who can connect).
- VTY 0-4 are the standard 5 simultaneous SSH sessions; vty 5-15
  available on most platforms (configure with "line vty 5 15").` },

  { cmd: 'show tech-support | redirect flash:tech.txt',
    example: `R1# show tech-support | redirect flash:tech.txt

# Wait several minutes ...
R1# dir flash: | include tech.txt
   24  -rw-       4256321  May  1 2026 11:22:18 +00:00  tech.txt

What it means:
- Bundles output of dozens of show commands into a single text
  file on flash — what Cisco TAC asks for first.
- "| redirect" sends output to file instead of console (avoids
  paging through 50 MB of output interactively).
- After collection, scp / ftp the file to the TAC case.` },

  { cmd: 'show stack-power',
    example: `Switch# show stack-power

Power stack name: Powerstack-1
Stack mode: Power-sharing
Stack topology: Stack-ring
Switch  Power  Power Allocation Used   Mode
                Budget Total          Available
1       1100W  1100W  142W            958W       Active
2       1100W  1100W  98W             1002W      Active
3       1100W  1100W  124W            976W       Active

What it means:
- StackPower : pools PSU capacity across stacked switches.
- "Power-sharing mode" : shared budget across stack members —
  one switch can borrow from another's PSU on PoE-heavy ports.
- "Used / Available" : real-time capacity for adding more PoE
  devices.` },

  { cmd: 'interface interface-id',
    example: `R1(config)# interface gi0/0
R1(config-if)#

R1(config)# interface vlan 10
R1(config-if)#

What it means:
- Generic interface configuration entry syntax. Common types:
  GigabitEthernet, TenGigE, Loopback, Vlan, Tunnel, Port-channel.
- Shorthand abbreviations work: "int gi0/0" = "interface
  GigabitEthernet0/0".` },

  { cmd: 'ip address ip-address subnet-mask secondary',
    example: `R1(config-if)# ip address 10.10.10.1 255.255.255.0
R1(config-if)# ip address 192.168.10.1 255.255.255.0 secondary

R1# show ip interface gi0/0 | include address
  Internet address is 10.10.10.1/24
  Secondary address: 192.168.10.1/24

What it means:
- Adds an additional IP to the interface — secondary subnet
  shares the physical port.
- Common during migrations: dual-IP the interface during
  cutover, then remove the old one.
- Routing protocols typically advertise secondary subnets just
  like primary.` },

  { cmd: 'address-family afi safi',
    example: `R1(config-router)# address-family ipv4 unicast
R1(config-router-af)# neighbor 1.2.3.4 activate
R1(config-router-af)# neighbor 1.2.3.4 prefix-list ALLOW_FROM_ISP in

What it means:
- Generic address-family syntax. AFI = Address Family Identifier
  (ipv4, ipv6, vpnv4, vpnv6, l2vpn). SAFI = Sub-AFI (unicast,
  multicast, evpn, mvpn).
- Used inside BGP, OSPF, IS-IS, MP-BGP for protocol-specific
  config.
- Examples: "address-family ipv4 unicast", "address-family vpnv4",
  "address-family l2vpn evpn".` },

  { cmd: 'login local',
    example: `R1(config)# line vty 0 4
R1(config-line)# login local
R1(config-line)# transport input ssh

R1(config)# username admin secret 9 $9$abcd...

What it means:
- Authenticates VTY logins against the local username database
  (created with "username X secret Y").
- Compare with "login authentication AUTH_LIST" which uses an
  AAA method-list (RADIUS / TACACS+).
- "login local" is the simpler, AAA-free option for small
  environments.` },

  { cmd: 'privilege {mode} level {level}',
    example: `R1(config)# privilege exec level 5 show
R1(config)# privilege exec level 5 ping
R1(config)# privilege exec level 5 traceroute
R1(config)# username operator privilege 5 secret OperatorSecret

# operator now in priv-5 can only run show / ping / traceroute.

What it means:
- Customises which commands a privilege level can run.
- Default: 0 (logout), 1 (user mode), 15 (privileged mode). Levels
  2-14 customisable.
- Use to provide read-only operator accounts without going to
  full TACACS+ command authorisation.` },

  { cmd: 'hostname {hostname name}',
    example: `Router(config)# hostname R1-CORE-01

R1-CORE-01(config)#

What it means:
- Sets the device hostname. Visible in CLI prompt, syslog,
  CDP/LLDP, SNMP sysName.
- Best practice: descriptive name that includes site +
  role + sequence.
- Avoid spaces, dots — keep it CLI-friendly.` },

  { cmd: 'ip domain-name {domain-name}',
    example: `R1(config)# ip domain-name corp.local

R1# show running-config | include domain-name
ip domain-name corp.local

What it means:
- Default DNS domain. Used by:
  - Crypto key generation (creates RSA keys named
    R1.corp.local — required for SSH).
  - DNS lookups (suffixes short hostnames).
- Required for SSH to work — won't generate RSA keys without
  a domain name.` },

  { cmd: 'exec-timeout {minutes} {seconds}',
    example: `R1(config)# line vty 0 4
R1(config-line)# exec-timeout 10 0

# After 10 minutes idle:
R1#
[connection closed by foreign host]

What it means:
- Auto-disconnect timer for idle CLI sessions.
- "10 0" = 10 minutes 0 seconds. "0 0" = never timeout (DANGEROUS,
  forgotten sessions stay open).
- Best practice: 10-15 min on production devices to clear
  abandoned sessions.` },

  { cmd: 'zone-member security zone-name',
    example: `R1(config)# zone security INSIDE
R1(config-sec-zone)# exit
R1(config)# interface gi0/0
R1(config-if)# zone-member security INSIDE

R1# show zone-pair security
Zone-pair name: INSIDE-OUTSIDE
   Source-Zone INSIDE Destination-Zone OUTSIDE

What it means:
- Zone-Based Firewall (ZBFW) interface assignment.
- An interface MUST be in a zone for ZBFW to inspect its traffic.
- Zone-pairs (with policy-maps) define what's allowed between
  named zones.` },

  { cmd: 'ipv6 unicast-routing',
    example: `R1(config)# ipv6 unicast-routing

R1# show ipv6 protocols | head -5
*** IPv6 Routing is Enabled ***

What it means:
- Globally enables IPv6 routing — required before IPv6 packets
  are forwarded between interfaces.
- Without this, the router can have IPv6 addresses but won't
  route IPv6 traffic.
- Compare with "ip routing" (the IPv4 equivalent, on by default).` },

  { cmd: 'auto-cost reference-bandwidth bandwidth-in-mbps',
    example: `R1(config-router)# auto-cost reference-bandwidth 10000

R1# show ip ospf | include Reference
 Reference bandwidth unit is 10000 mbps

What it means:
- OSPF auto-cost reference bandwidth. Default = 100 Mbps.
- Modern networks need higher: 1000 (1 Gbps), 10000 (10 Gbps),
  100000 (100 Gbps) so distinct interface speeds get distinct
  costs.
- MUST match across the entire OSPF domain — different reference
  values produce inconsistent path selection.` },

  { cmd: 'router ospfv3 [process-id]',
    example: `R1(config)# router ospfv3 1
R1(config-router)# router-id 1.1.1.1
R1(config-router)# address-family ipv6 unicast

R1# show running-config | section ospfv3
router ospfv3 1
 router-id 1.1.1.1
 !
 address-family ipv6 unicast

What it means:
- Newer unified OSPFv3 process — handles both IPv4 + IPv6 under
  a single process (vs separate "router ospf" + "ipv6 router
  ospf").
- Each address-family is configured separately within the same
  process.
- Most IOS XE platforms; not all classic IOS.` },

  { cmd: 'area area-id range prefix/prefix-length',
    example: `R-ABR(config-router)# area 1 range 10.0.0.0 255.0.0.0

R-other-area# show ip route ospf
O IA 10.0.0.0/8 [110/11] via 192.168.1.1, Gi0/0   ← single summary

What it means:
- Inter-area route summarisation at the ABR. Aggregates many
  intra-area /24s into a single Type-3 LSA.
- Reduces the size of the LSDB in other areas.
- A Null0 discard route is auto-installed locally to prevent
  black-hole loops.` },

  { cmd: 'ospfv3 network {point-to-point | broadcast}',
    example: `R1(config-if)# ospfv3 network point-to-point

R1# show ospfv3 interface gi0/0 | include Network
  Network Type POINT_TO_POINT, Cost: 1

What it means:
- Configures OSPFv3 network type on the interface.
- point-to-point : skip DR/BDR election (faster convergence on
  back-to-back router links).
- broadcast (default on Ethernet) : DR/BDR election runs.
- Both ends must agree.` },

  { cmd: 'show ospfv3 interface [brief]',
    example: `R1# show ospfv3 interface brief

Interface  PID  Area      AF   Cost  State Nbrs F/C
Gi0/0      1    0         IPv6 1     P2P   1/1
Lo0        1    0         IPv6 1     LOOP  0/0

What it means:
- OSPFv3 interface summary (brief) or detail (without "brief").
- "AF: IPv6" — confirms address family for each interface.
- "P2P" / "BDR" / "LOOP" : current OSPF interface state.
- "Nbrs F/C" : neighbours in FULL state / total — should match
  for healthy operation.` },

  { cmd: 'show ospfv3 ipv6 neighbor',
    example: `R1# show ospfv3 ipv6 neighbor

Neighbor ID Pri State          Dead Time  Interface ID Interface
2.2.2.2     1   FULL/-         00:00:34   3            Gi0/0

What it means:
- OSPFv3 IPv6 neighbour table. Adjacencies form over IPv6
  link-local addresses (FE80::/10).
- "FULL" = healthy. Should be the steady-state.
- "Pri" = OSPF priority for DR/BDR election (only relevant on
  broadcast interfaces).` },

  { cmd: 'match ip address {acl-number | acl-name}',
    example: `R1(config-route-map)# match ip address 100
# Or:
R1(config-route-map)# match ip address ALLOW_PREFIXES

What it means:
- Inside route-map, matches IPv4 source/destination based on the
  named ACL.
- For BGP, prefer "match ip address prefix-list" (more efficient).
- Multiple match-ip-address clauses form OR; combining with other
  match types AND.` },

  { cmd: 'set as-path prepend {as-number-pattern | last-as}',
    example: `R1(config-route-map)# set as-path prepend 65001 65001 65001

# Now AS_PATH advertised to peers includes the prepend:
R1# show ip bgp 10.0.0.0 | include AS Path
  AS_PATH: 65001 65001 65001 65001 65002 (4 hops, was 1)

What it means:
- Adds the local ASN to the AS_PATH N times → makes the route
  appear LESS attractive (longer AS_PATH) to upstream peers.
- Common: prepend 3x to influence BGP path selection without
  using local-pref / MED (which only work intra-AS).
- "last-as N" : prepend the last AS in the path N times (rare
  use case).` },

  { cmd: 'set local-preference 0–4294967295',
    example: `R1(config-route-map)# set local-preference 200

# Routes through this peer now have local-pref 200 (default 100):
R1# show ip bgp 10.0.0.0
... LocPrf 200 ... best path

What it means:
- Sets BGP local-preference on routes (only carried within the
  local AS).
- Higher = preferred. Default 100.
- Used to influence which iBGP exit point is preferred for a
  prefix — e.g. cheap-bandwidth peer gets local-pref 200, others 100.` },

  { cmd: 'set tag 0–4294967295',
    example: `R1(config-route-map)# set tag 100

# Routes redistributed into OSPF carry this tag:
R-other# show ip route ospf | include 10.99
O E2 10.99.0.0/24 [110/20] tag 100

What it means:
- Stamps a 32-bit "tag" onto routes when redistributing or
  matching.
- Used to prevent redistribution loops between protocols:
  "redistribute X route-map TAG_OUT" and "redistribute Y
  route-map BLOCK_TAGGED" with match-tag.
- Carried in OSPF Type-5 / EIGRP external / ISIS attributes.` },

  { cmd: 'neighbor ip-address filter-list acl-number {in|out}',
    example: `R1(config)# ip as-path access-list 10 deny _65003_
R1(config)# ip as-path access-list 10 permit .*
R1(config-router)# neighbor 10.10.10.2 filter-list 10 in

What it means:
- Filters BGP routes based on AS_PATH regex.
- "_65003_" : matches if AS 65003 appears anywhere in the path
  (transit through that AS denied).
- ".*" : permits everything else.
- More efficient than prefix-lists when the filter criterion is
  "what ASes the route traversed".` },

  { cmd: 'ip community-list ...',
    example: `R1(config)# ip community-list 10 permit 65001:100
R1(config)# ip community-list expanded EXPAND permit "65001:..*"

R1(config-route-map)# match community 10
R1(config-route-map)# set local-preference 200

What it means:
- BGP community filtering. Standard (1-99) or expanded (100-500).
- Standard : exact community values.
- Expanded : regex patterns (e.g. "65001:100..199" via regex).
- Used for tag-based routing policy: customers tag prefixes with
  communities, ISP route-map matches and applies treatment.` },

  { cmd: 'match any',
    example: `R1(config-cmap)# class-map match-any DEFAULT
R1(config-cmap)# match any

What it means:
- QoS class-map "match all packets" — useful as the catch-all
  in a policy-map.
- Inside a route-map, "match any" doesn't exist (use no match
  clause — that's an implicit "match anything").` },

  { cmd: 'match [ip] precedence precedence-value-list',
    example: `R1(config-cmap)# match ip precedence 5 6 7

What it means:
- Matches IP Precedence values (legacy 3-bit field, predecessor
  to DSCP).
- Range 0-7. Common: 5 = critical, 6 = internet, 7 = network.
- Modern networks use DSCP; precedence retained for backward
  compatibility with legacy gear.` },

  { cmd: 'match ip rtp starting-port-number port-number-range',
    example: `R1(config-cmap)# match ip rtp 16384 16383

# Matches RTP traffic in the 16384-32767 port range — typical
# voice / video bearer port range.

What it means:
- Specialised match for RTP (Real-time Transport Protocol)
  traffic with even-port-only filtering (RTCP uses odd ports).
- Useful for voice/video QoS classification when DSCP marking
  isn't trustworthy.
- Modern networks usually classify by DSCP instead.` },

  { cmd: 'match protocol protocol-name',
    example: `R1(config-cmap)# match protocol http
R1(config-cmap)# match protocol citrix

R1# show class-map | include http
   Match protocol http

What it means:
- NBAR (Network-Based Application Recognition) — application-
  layer protocol matching.
- Recognises 1000+ applications by signature (HTTP, BitTorrent,
  Skype, Citrix, etc.).
- More CPU-intensive than DSCP/port matching but more accurate
  for app-aware QoS.` },

  { cmd: 'set [ip] precedence ip-precedence-value',
    example: `R1(config-pmap-c)# set ip precedence 5

What it means:
- Marks IP Precedence (3-bit field). Range 0-7.
- Legacy QoS marking — predecessor to DSCP.
- Most modern networks use "set dscp" instead. Precedence
  retained for backward-compat with legacy gear.` },

  { cmd: 'show arp',
    example: `R1# show arp

Protocol  Address      Age  Hardware Addr     Type   Interface
Internet  10.10.10.1   -    0050.5612.3456    ARPA   Vlan10  ← own
Internet  10.10.10.50  142  001a.1e11.2233    ARPA   Vlan10
Internet  10.10.10.51  24   001a.1e44.5566    ARPA   Vlan10

What it means:
- Equivalent to "show ip arp" — IPv4 ARP table.
- Age "-" = own address (router-owned IP).
- Default ARP timeout is 14400 seconds (4 hours) — stale entries
  age out automatically.
- For IPv6, use "show ipv6 neighbors".` },

  { cmd: 'show spanning-tree vlan <id>',
    example: `Switch# show spanning-tree vlan 10

VLAN0010
  Spanning tree enabled protocol rstp
  Root ID    Priority    24586
             Address     0050.5612.3456
             Cost        0
             Port        0 (-)
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
             this bridge is the root

  Bridge ID  Priority    24586  (priority 24576 sys-id-ext 10)
             Address     0050.5612.3456

Interface          Role Sts Cost      Prio.Nbr Type
------------------ ---- --- --------- -------- --------------------------------
Gi1/0/1            Desg FWD 4         128.1    P2p Edge
Gi1/0/24           Desg FWD 4         128.24   P2p

What it means:
- Per-VLAN STP detail. Confirms root identity, local bridge ID,
  per-port roles + states.
- "this bridge is the root" : local switch is root for VLAN 10.
- "Role Desg" : designated (forwards segment traffic).` },

  { cmd: 'show cdp neighbors',
    example: `R1# show cdp neighbors

Capability Codes: R - Router, T - Trans Bridge, S - Switch, I - IGMP

Device ID         Local Intrfce  Holdtme  Capability  Platform     Port ID
Switch-Core-01    Gig 0/0/0      178       R S         WS-C9300    Gig 1/0/24
AP-Lobby-01       Gig 0/0/1      168       I           AP1242      Eth 0
R-Branch-02       Gig 0/0/2      152       R S         ISR4351     Gig 0/0/0

What it means:
- CDP (Cisco Discovery Protocol) — Cisco-proprietary L2 neighbor
  discovery.
- Shows every directly-connected Cisco device + its model + the
  remote port.
- Critical for "where am I plugged in?" / "who's on this port?"
  troubleshooting.
- Disable on edge ports facing untrusted devices: "no cdp run"
  globally or "no cdp enable" per-interface.` },

  { cmd: 'show lldp neighbors',
    example: `R1# show lldp neighbors

Capability codes: R = Router, B = Bridge, T = Telephone

Device ID            Local Intf     Hold-time  Capability     Port ID
Switch-Core-01       Gi0/0          120        B,R           GigabitEthernet1/0/24
AP-Lobby-01          Gi0/1          120        B,T           Eth0
PC-Lab-12            Gi0/3          120        B             eth0

What it means:
- LLDP (IEEE 802.1AB) — vendor-neutral neighbor discovery.
- Works across Cisco / Juniper / Arista / hosts (Linux-LLDP,
  Windows LLDP support).
- Slightly less detail than CDP but interoperates everywhere.
- Enable globally with "lldp run".` },

  { cmd: 'show processes memory',
    example: `R1# show processes memory

Total: 1073741824, Used: 245678901, Free: 828062923
Lowest: 745678901, Largest: 123456789

PID  TTY   Allocated   Freed       Holding   Process
142  0     1245678     102341      45012345   IP Input
245  0     458901      12003       8902341    BGP Router
1    0     234561      4012        7012345    Init

What it means:
- Per-process memory accounting. Same data as "sorted" but
  unsorted by default.
- "Total / Used / Free" : process memory pool aggregate.
- "Lowest" : lowest-ever Free since boot — water-mark.
- For process-by-holding view, use "show processes memory sorted".` },

  { cmd: 'show platform tcam utilization',
    example: `Switch# show platform hardware fed switch active fwd-asic resource tcam utilization

Resource              Total       Used        %Used   Avail
ACL TCAM (input)      1024        342         33%     682
ACL TCAM (output)     1024        145         14%     879
QoS TCAM              512         88          17%     424
NetFlow Sampler       64          12          18%     52
Mac TCAM              16384       2042        12%     14342

What it means:
- TCAM utilisation per resource class on Catalyst.
- ACL TCAM is most-watched on edge platforms — exhaustion drops
  ACLs to software (slow-path).
- "Avail" running low (>80% used) = simplify ACLs / QoS policies
  or scale to a larger platform.` },

  // ============== BGP ==============
  { cmd: 'no synchronization',
    example: `R1(config-router)# no synchronization

R1# show ip protocols | include sync
  IGP synchronization is disabled

What it means:
- Legacy command that disabled the requirement that BGP-learned
  routes be in the IGP RIB before being advertised.
- Default is "no synchronization" since IOS 12.2(8)T — most
  modern networks don't have IGP/iBGP path mismatches anyway.
- Kept for backward compatibility; rarely needs explicit config.` },

  { cmd: 'show ip bgp neighbors 1.2.3.4 received-routes',
    example: `R1# show ip bgp neighbors 10.10.10.2 received-routes

BGP table version is 142, local router ID is 1.1.1.1
Status codes: s suppressed, d damped, h history, * valid, > best, i internal

   Network          Next Hop      Metric LocPrf Weight Path
*> 198.51.100.0/24  10.10.10.2     0             0      65002 i
*> 203.0.113.0/24   10.10.10.2     0             0      65002 65003 i
*> 0.0.0.0/0        10.10.10.2     0             0      65002 ?

Total number of prefixes 3

What it means:
- Routes received from the named peer BEFORE inbound policy.
- Requires "neighbor X soft-reconfiguration inbound" pre-IOS 15
  (newer versions use route-refresh capability).
- Compare with "advertised-routes" (what we send to the peer).` },

  { cmd: 'show ip bgp regexp _65000_',
    example: `R1# show ip bgp regexp _65000_

BGP table version is 142, local router ID is 1.1.1.1

Status codes: s suppressed, d damped, h history, * valid, > best, i internal
Origin codes: i - IGP, e - EGP, ? - incomplete

   Network          Next Hop      Metric LocPrf Weight Path
*> 198.51.100.0/24  10.10.10.2     0             0      65002 65000 i
*> 203.0.113.0/24   10.10.10.2     0             0      65000 65003 i

Total number of prefixes 2

What it means:
- Filters BGP table by AS_PATH regex.
- "_65000_" : matches if AS 65000 appears anywhere in path
  (underscores match path separators).
- Useful queries: "_65003$" (originated by 65003), "^65002_"
  (immediate next-AS is 65002), "_65003_65004_" (transits both).` },

  { cmd: 'show ip bgp paths',
    example: `R1# show ip bgp paths

Address      Hash Refcount Metric Path
0x12345678   42   12345    0      65001 65002 65003 i
0x87654321   88   8901     0      65001 65002 i
0xABCDEF01   142  4502     0      i  ← local origin

What it means:
- AS_PATH cache. Same path used by multiple prefixes only stored
  once.
- "Refcount" : how many prefixes use this path. High refcount =
  most prefixes share that AS_PATH.
- Useful for memory analysis on large-table BGP routers.` },

  { cmd: 'clear ip bgp 1.2.3.4',
    example: `R1# clear ip bgp 10.10.10.2

%BGP-5-ADJCHANGE: neighbor 10.10.10.2 Down User reset
%BGP-5-ADJCHANGE: neighbor 10.10.10.2 Up

What it means:
- HARD reset of a BGP session — TCP closed, all state lost,
  full re-negotiation + re-exchange of routes.
- DISRUPTIVE: traffic via this peer drops while the session
  rebuilds (a few seconds for healthy peers).
- For non-disruptive policy refresh, use "soft in" or "soft out".` },

  { cmd: 'clear ip bgp 1.2.3.4 soft in',
    example: `R1# clear ip bgp 10.10.10.2 soft in

# No session reset — peer re-sends all routes via Route Refresh.

R1# show ip bgp summary | include 10.10.10.2
10.10.10.2  4   65002    14   12   142  0  0  00:08:14   142

What it means:
- Soft inbound reset — no TCP teardown. Peer re-advertises all
  routes, allowing changed inbound policy to take effect.
- Requires Route-Refresh capability (RFC 2918) — enabled by
  default on modern IOS.
- Fallback: "neighbor X soft-reconfiguration inbound" (memory-
  expensive but works without Route-Refresh).` },

  { cmd: 'clear ip bgp 1.2.3.4 soft out',
    example: `R1# clear ip bgp 10.10.10.2 soft out

# Local router re-runs outbound policy and re-advertises routes
# to the peer.

What it means:
- Soft outbound reset — applies changed outbound policy without
  resetting the session.
- Always supported (doesn't require any capability negotiation).
- Use after modifying "neighbor X route-map ... out".` },

  { cmd: 'neighbor 1.2.3.4 send-community both',
    example: `R1(config-router)# neighbor 10.10.10.2 send-community both

R1# show ip bgp neighbors 10.10.10.2 | include community
  Community attribute sent to this neighbor (both)

What it means:
- Sends BGP community attributes to the peer.
- "both" : standard + extended communities. "standard" /
  "extended" / "large" for specific types.
- Default is NOT to send communities — must enable explicitly.
- Required when policy on the receiving side keys off communities.` },

  { cmd: 'neighbor 1.2.3.4 route-map TO-ISP out',
    example: `R1(config-router)# neighbor 10.10.10.2 route-map TO-ISP out

R1# show ip bgp neighbors 10.10.10.2 | include policy
  Outgoing update prefix filter list is TO-ISP

What it means:
- Applies a route-map to outbound BGP updates to the peer.
- The route-map can permit/deny prefixes AND modify attributes
  (set local-preference, AS-path prepend, communities).
- Common pattern: "TO-ISP" prepends 3x for backup-link.` },

  { cmd: 'neighbor 1.2.3.4 filter-list 100 in',
    example: `R1(config)# ip as-path access-list 100 deny _65003$
R1(config)# ip as-path access-list 100 permit .*

R1(config-router)# neighbor 10.10.10.2 filter-list 100 in

What it means:
- Filters routes from peer based on AS-path regex.
- This example denies routes originated by AS 65003 (as-path
  ends with 65003).
- More efficient than prefix-lists when filtering by transit/
  originator AS rather than specific prefixes.` },

  { cmd: 'route-map TO-ISP permit 10\n match ip address prefix-list MY-NETS\n set as-path prepend 65001 65001 65001',
    example: `R1(config)# ip prefix-list MY-NETS permit 10.0.0.0/16

R1(config)# route-map TO-ISP permit 10
R1(config-route-map)# match ip address prefix-list MY-NETS
R1(config-route-map)# set as-path prepend 65001 65001 65001

R1(config)# router bgp 65001
R1(config-router)# neighbor 1.2.3.4 route-map TO-ISP out

# Prefixes in MY-NETS now advertised with AS_PATH "65001 65001
# 65001 65001 ..." — making them less preferred upstream.

What it means:
- Outbound policy: only advertise MY-NETS prefixes, with 3x
  prepended local AS.
- Common use: backup uplink — prepend to discourage upstream
  ISPs from using this link as primary.` },

  { cmd: 'route-map FROM-ISP permit 10\n set local-preference 200',
    example: `R1(config)# route-map FROM-ISP permit 10
R1(config-route-map)# set local-preference 200

R1(config-router)# neighbor 1.2.3.4 route-map FROM-ISP in

# Routes from 1.2.3.4 now have local-pref 200 (default 100).

R1# show ip bgp 0.0.0.0 | include LocPrf
... LocPrf 200 ... best path

What it means:
- Inbound policy : raise local-pref on routes from the preferred
  ISP.
- LocPrf 200 wins over LocPrf 100 in BGP path selection — this
  ISP becomes the primary egress.
- Common dual-ISP pattern: primary gets LocPrf 200, backup
  default 100.` },

  { cmd: 'route-map TO-CUSTOMER permit 10\n set community 65001:100 65001:200',
    example: `R1(config)# route-map TO-CUSTOMER permit 10
R1(config-route-map)# set community 65001:100 65001:200

R1(config-router)# neighbor 10.10.10.5 route-map TO-CUSTOMER out
R1(config-router)# neighbor 10.10.10.5 send-community both

# Customer's BGP now sees:
$ show ip bgp 10.0.0.0 | include Community
Community: 65001:100 65001:200

What it means:
- Tags advertised routes with BGP communities — typically used
  by ISPs to signal route classification (e.g. 65001:100 =
  customer route, 65001:200 = peer route).
- Customer's policy then matches on these communities to
  apply local treatment (set local-pref, filter, etc.).` },

  { cmd: 'aggregate-address 10.0.0.0 255.0.0.0 as-set',
    example: `R1(config-router)# aggregate-address 10.0.0.0 255.0.0.0 as-set summary-only

R1# show ip bgp | include 10.0.0.0
*> 10.0.0.0/8       0.0.0.0     0     32768   {65002,65003} ?

What it means:
- Generates a summary route 10.0.0.0/8 from contributing
  more-specific BGP routes.
- "as-set" : creates an AS_SET (the {65002,65003}) so loop-
  detection still works at AS-boundaries.
- "summary-only" : suppresses the more-specifics — only the
  summary leaves this router.` },

  { cmd: 'redistribute connected route-map CONN-INTO-BGP',
    example: `R1(config)# route-map CONN-INTO-BGP permit 10
R1(config-route-map)# match interface Loopback0

R1(config-router)# redistribute connected route-map CONN-INTO-BGP

R1# show ip bgp | include 1.1.1.1
*> 1.1.1.1/32      0.0.0.0     0     32768   ?  ← only loopback

What it means:
- Redistributes ONLY interfaces matching the route-map (here
  Loopback0).
- Cleaner than redistributing all connected (which would leak
  every transit subnet into BGP).
- Standard pattern for advertising router IDs into iBGP.` },

  { cmd: 'neighbor RR-CLIENTS peer-group\nneighbor RR-CLIENTS remote-as 65001\nneighbor RR-CLIENTS update-source Loopback0\nneighbor RR-CLIENTS route-reflector-client\nneighbor 2.2.2.2 peer-group RR-CLIENTS',
    example: `R1(config-router)# neighbor RR-CLIENTS peer-group
R1(config-router)# neighbor RR-CLIENTS remote-as 65001
R1(config-router)# neighbor RR-CLIENTS update-source Loopback0
R1(config-router)# neighbor RR-CLIENTS route-reflector-client
R1(config-router)# neighbor 2.2.2.2 peer-group RR-CLIENTS
R1(config-router)# neighbor 3.3.3.3 peer-group RR-CLIENTS
R1(config-router)# neighbor 4.4.4.4 peer-group RR-CLIENTS

What it means:
- Peer-group : configure once, apply to many neighbours. Saves
  config volume on RRs with 100s of clients.
- "route-reflector-client" : marks these peers as RR clients.
- Inbound updates from RR-clients are reflected to other clients,
  eliminating the iBGP full-mesh requirement.
- "update-source Loopback0" : peer over the loopback for
  resilience to interface flaps.` },

  { cmd: 'maximum-paths 8',
    example: `R1(config-router)# maximum-paths 8

R1# show ip bgp 10.0.0.0
... 8 available, best #1
   * 10.10.10.2 ... best
   * 10.10.10.3 ...
   * 10.10.10.4 ...
   ... (5 more)

What it means:
- ECMP for eBGP — install up to 8 equal-cost paths to the same
  prefix.
- Default 1 (only the best path installed). Range 1-32 on most
  modern platforms.
- Routes must have identical: AS_PATH length, weight, local-pref,
  origin, MED. iBGP ECMP requires "maximum-paths ibgp" too.` },

  { cmd: 'maximum-paths ibgp 8',
    example: `R1(config-router)# maximum-paths ibgp 8

R1# show ip bgp 10.0.0.0
... 4 iBGP paths available
   * 1.1.1.1 ... best
   * 2.2.2.2 ...
   * 3.3.3.3 ...
   * 4.4.4.4 ...

What it means:
- iBGP ECMP — install multiple iBGP paths to the same prefix.
- Stricter requirements than eBGP ECMP: all attributes must match
  exactly, AND IGP cost to next-hop must be equal.
- Often the limiting factor in iBGP ECMP is identical IGP cost.` },

  { cmd: 'bgp bestpath as-path multipath-relax',
    example: `R1(config-router)# bgp bestpath as-path multipath-relax

R1# show ip bgp 10.0.0.0 | include multipath
   8 paths available, best #1, multipath relax

What it means:
- Relaxes the strict "same AS_PATH" requirement for ECMP — paths
  with different but equal-LENGTH AS_PATHs become eligible.
- Common in multi-homed scenarios where two ISPs offer paths of
  equal length but different transit ASes.
- Required to actually load-balance across multiple eBGP peers
  in most enterprise dual-home designs.` },

  { cmd: 'bgp dampening',
    example: `R1(config-router)# bgp dampening 15 750 2000 60

R1# show ip bgp dampening parameters
 dampening 15 (half-life) 750 (re-use) 2000 (suppress-limit) 60 (max-suppress-time)

What it means:
- Penalises flapping prefixes — accumulates penalty on each
  withdraw/announce cycle. Suppresses if penalty > 2000.
- Half-life 15 min : penalty halves every 15 min.
- Re-use 750 : un-suppress when penalty drops below 750.
- Modern internet best-practice is to NOT use dampening for
  most ISPs (RIPE-378) — penalises legitimate route changes.` },

  { cmd: 'neighbor 1.2.3.4 fall-over bfd',
    example: `R1(config-router)# neighbor 10.10.10.2 fall-over bfd

R1(config-if)# bfd interval 50 min_rx 50 multiplier 3

# When BFD detects link loss:
%BGP-5-ADJCHANGE: neighbor 10.10.10.2 Down BFD adjacency down

What it means:
- BFD-triggered BGP failover. Without BFD, BGP relies on its
  hold-timer (180 sec default) to detect peer loss.
- BFD detects loss in < 200 ms with 50/3 timers.
- Required for sub-second BGP convergence in failure scenarios.` },

  { cmd: 'neighbor 2001:db8::1 remote-as 65002\naddress-family ipv6 unicast\n neighbor 2001:db8::1 activate',
    example: `R1(config-router)# neighbor 2001:db8::1 remote-as 65002
R1(config-router)# address-family ipv6 unicast
R1(config-router-af)# neighbor 2001:db8::1 activate

R1# show bgp ipv6 unicast summary
Neighbor        V    AS  MsgRcvd  MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
2001:DB8::1     4 65002      14       12      142    0    0 00:08:14  142

What it means:
- IPv6 BGP peer setup. ALWAYS need both:
  1. "neighbor X remote-as Y" globally.
  2. "neighbor X activate" inside ipv6 AF.
- Default behaviour pre-IOS 12.4 was implicit activation; modern
  IOS requires explicit "activate".` },

  { cmd: 'show bgp ipv6 unicast',
    example: `R1# show bgp ipv6 unicast | head -10

BGP table version is 14, local router ID is 1.1.1.1
Status codes: s suppressed, d damped, h history, * valid, > best, i internal
Origin codes: i - IGP, e - EGP, ? - incomplete

   Network          Next Hop                Metric LocPrf Weight Path
*> 2001:DB8::/32    2001:DB8::1               0             0      65002 i
*> 2001:DB8:99::/48 2001:DB8::1               0             0      65002 65003 i

What it means:
- IPv6 BGP table. Same shape as IPv4 BGP, just IPv6 prefixes.
- "*>" = valid + best.
- Use after enabling IPv6 unicast AF and confirming neighbor is
  Established.` },

  { cmd: 'address-family vpnv4',
    example: `R1(config-router)# address-family vpnv4
R1(config-router-af)# neighbor 1.1.1.1 activate
R1(config-router-af)# neighbor 1.1.1.1 send-community extended

What it means:
- VPNv4 (RFC 4364) is the BGP address-family for MPLS-L3VPN.
- Carries customer-VRF prefixes labelled with route-distinguishers
  (RD) so prefixes from different VRFs are unique.
- Required on PE routers to exchange VPNv4 routes.
- Extended communities carry route-targets (RTs) — must enable
  "send-community extended".` },

  { cmd: 'show bgp vpnv4 unicast all summary',
    example: `R1# show bgp vpnv4 unicast all summary

BGP router identifier 1.1.1.1, local AS number 65001
BGP table version is 4502
Number of VRFs                : 3
Total number of prefixes received : 12,403

Neighbor    V   AS  MsgRcvd MsgSent  TblVer  InQ OutQ Up/Down  State/PfxRcd
2.2.2.2     4 65001    14502    14492   4502   0    0 1d12h     12403

What it means:
- All VPNv4 peers + per-peer prefix counts.
- "Number of VRFs" : how many customer VRFs are active.
- "PfxRcd 12403" : VPNv4 prefixes received from this peer
  (across ALL VRFs).` },

  { cmd: 'address-family ipv4 vrf TENANT-A\n redistribute connected\n redistribute static',
    example: `R1(config-router)# address-family ipv4 vrf TENANT-A
R1(config-router-af)# redistribute connected
R1(config-router-af)# redistribute static

R1# show bgp vpnv4 unicast vrf TENANT-A | head -5
BGP table version is 142
   Network          Next Hop      Metric LocPrf Weight Path
*> 10.99.0.0/24     0.0.0.0           0  32768       ?  ← VRF connected
*> 192.168.99.0/24  10.99.0.1         0  32768       ?  ← VRF static

What it means:
- Redistribute customer VRF's connected and static routes into
  VPNv4 BGP for advertisement to remote PEs.
- Inside the VRF AF, "redistribute" affects only that VRF's RIB.
- Common L3VPN PE config — exposes the customer's local routes
  to other sites via MPLS-VPN.` },

  { cmd: 'aggregate-address network subnet-mask [summary-only] [as-set]',
    example: `R1(config-router)# aggregate-address 10.0.0.0 255.0.0.0 summary-only as-set

R1# show ip bgp | include 10.0.0.0
*> 10.0.0.0/8       0.0.0.0     0     32768   {65002,65003} ?

What it means:
- Generic aggregate-address syntax.
- "summary-only" : don't advertise the more-specifics.
- "as-set" : include AS_SET in AS_PATH for loop prevention at
  remote ASes.
- Suppresses prefix-list bloat in upstream tables.` },

  { cmd: 'router bgp as-number',
    example: `R1(config)# router bgp 65001
R1(config-router)# bgp router-id 1.1.1.1

R1# show ip bgp summary | head -5
BGP router identifier 1.1.1.1, local AS number 65001

What it means:
- Generic syntax. ASN range 1-4294967295 (32-bit since RFC 4893).
- Private 16-bit range: 64512-65535.
- Private 32-bit range: 4200000000-4294967294.
- Only ONE BGP process per router (unlike OSPF / EIGRP).` },

  { cmd: 'bgp router-id router-id',
    example: `R1(config-router)# bgp router-id 1.1.1.1

R1# show ip bgp summary | include router identifier
BGP router identifier 1.1.1.1, local AS number 65001

What it means:
- Sets the BGP router-id (32-bit identity).
- Without this, BGP picks the highest IP among loopbacks then
  highest physical interface IP.
- Always set manually — flapping interfaces shouldn't move the
  router-id.` },

  { cmd: 'no bgp default ipv4-unicast',
    example: `R1(config-router)# no bgp default ipv4-unicast

# Now adding a peer doesn't auto-activate IPv4 unicast:
R1(config-router)# neighbor 10.10.10.2 remote-as 65002
R1(config-router)# address-family ipv4 unicast
R1(config-router-af)# neighbor 10.10.10.2 activate   ! must be explicit

What it means:
- Disables the default behaviour of auto-activating IPv4 unicast
  for every new peer.
- Best practice: keep BGP "clean" — peers must be explicitly
  activated in the AFs they should participate in.
- Critical in MP-BGP environments where some peers should be
  IPv6-only or VPNv4-only.` },

  { cmd: 'neighbor ip-address remote-as as-number',
    example: `R1(config-router)# neighbor 10.10.10.2 remote-as 65002

R1# show ip bgp summary | head -7
Neighbor       V    AS    MsgRcvd  MsgSent  TblVer InQ OutQ Up/Down  State/PfxRcd
10.10.10.2     4   65002       14       12     142   0    0 00:08:14   142

What it means:
- Defines a BGP peer with its remote AS.
- Same ASN as local = iBGP (TTL 255 default, requires loopback
  source for stability).
- Different ASN = eBGP (TTL 1 default, point-to-point physical).
- Add "ebgp-multihop N" for multi-hop eBGP scenarios.` },

  { cmd: 'network network-mask subnet-mask [route-map]',
    example: `R1(config-router)# network 10.0.0.0 mask 255.255.255.0
R1(config-router)# network 192.168.0.0 mask 255.255.0.0 route-map TAG_OUT

R1# show ip bgp | head -5
   Network          Next Hop      Metric LocPrf Weight Path
*> 10.0.0.0/24      0.0.0.0           0  32768       i
*> 192.168.0.0/16   0.0.0.0           0  32768       i

What it means:
- "network" tells BGP to advertise the prefix IF it exists in
  the local RIB (via static / connected / IGP).
- Optional route-map can set communities, AS-path prepend, etc.,
  on the advertised route.
- The prefix MUST exist in the IGP/connected RIB — BGP won't
  invent it.` },

  { cmd: 'show bgp afi safi summary',
    example: `R1# show bgp ipv4 unicast summary

BGP router identifier 1.1.1.1, local AS number 65001
BGP table version is 142
RIB entries: 4502
Memory used: 1153536 bytes

Neighbor       V    AS  MsgRcvd  MsgSent  TblVer  InQ OutQ Up/Down  State/PfxRcd
10.10.10.2     4 65002    14502    14492   142    0    0 1d12h      4502

What it means:
- Per-AF summary. Use AFI/SAFI like "ipv4 unicast", "ipv6 unicast",
  "vpnv4 unicast", "ipv4 multicast".
- "PfxRcd" : prefixes received from this peer in this AF.
- "TblVer" : BGP table version — increments on each change.` },

  { cmd: 'show bgp afi safi neighbors ip-address',
    example: `R1# show bgp ipv4 unicast neighbors 10.10.10.2 | head -15

BGP neighbor is 10.10.10.2, remote AS 65002, external link
 BGP version 4, remote router ID 2.2.2.2
 BGP state = Established, up for 1d12h
 Last read 00:00:14, last write 00:00:14, hold time is 180, keepalive is 60
 Neighbor sessions:
   1 active, is not multisession capable
 Neighbor capabilities:
   Route refresh: advertised and received(new)
   Four-octets ASN Capability: advertised and received
   Address family IPv4 Unicast: advertised and received

What it means:
- Detailed peer state for one AF.
- "BGP state = Established" : healthy. Other states during
  setup: Idle, Connect, Active, OpenSent, OpenConfirm.
- Capabilities advertised + received = both ends agreed on
  protocol features.` },

  { cmd: 'show bgp afi safi network prefix/prefix-length',
    example: `R1# show bgp ipv4 unicast 10.0.0.0/24

BGP routing table entry for 10.0.0.0/24, version 142
Paths: (2 available, best #1, table default)
  Advertised to update-groups:
     1
  Refresh Epoch 1
  65002
    10.10.10.2 from 10.10.10.2 (2.2.2.2)
      Origin IGP, metric 0, localpref 100, valid, external, best

What it means:
- Detail for a specific prefix in the named AF.
- Useful during best-path investigations.
- Compare against "show bgp ipv4 unicast 10.0.0.0/24 paths"
  for AS_PATH detail.` },

  { cmd: 'show bgp afi safi neighbors ip-address advertised routes',
    example: `R1# show bgp ipv4 unicast neighbors 10.10.10.2 advertised-routes

BGP table version is 142, local router ID is 1.1.1.1

   Network          Next Hop      Metric LocPrf Weight Path
*> 10.0.0.0/24      0.0.0.0           0  32768       i
*> 10.10.0.0/16     0.0.0.0           0  32768       i

Total number of prefixes 2

What it means:
- What we are advertising to the named peer (after outbound
  policy applies).
- Useful for confirming "is the peer seeing X?" — without having
  to ask the peer.
- Compare with "received-routes" (what they sent us).` },

  { cmd: 'show tcp brief',
    example: `R1# show tcp brief

TCB         Local Address       Foreign Address     (state)
12345678    10.10.10.1.179      10.10.10.2.51223    ESTAB     ← BGP
87654321    10.10.10.1.22       10.50.50.50.42102   ESTAB     ← SSH

What it means:
- All TCP connections + listeners on the router itself.
- Port 179 = BGP. Port 22 = SSH.
- LISTEN entries on 23 / 80 / 443 = enabled services. Lock
  down with "no ip http server" / "transport input ssh".` },

  { cmd: 'show ip route bgp / show ipv6 route bgp',
    example: `R1# show ip route bgp

Codes: B - BGP, EX - external

B    198.51.100.0/24 [20/0] via 10.10.10.2, 00:08:14, Gi0/0
B    203.0.113.0/24 [20/0] via 10.10.10.2, 00:08:14, Gi0/0
B*   0.0.0.0/0 [20/0] via 10.10.10.2, 00:08:14, Gi0/0

R1# show ipv6 route bgp
B    2001:DB8::/32 [20/0]
     via 2001:DB8::1, GigabitEthernet0/0

What it means:
- Filters routing table to only BGP-learned routes.
- "[20/0]" : eBGP AD 20 / metric 0. iBGP routes show "[200/0]".
- Confirms BGP routes have actually been installed in the RIB
  (not just present in the BGP table).` },

  { cmd: 'ip as-path access-list acl-number {deny | permit} regex-query',
    example: `R1(config)# ip as-path access-list 100 permit ^65002_
R1(config)# ip as-path access-list 100 deny .*

R1(config-router)# neighbor 10.10.10.2 filter-list 100 in

What it means:
- AS-path ACL — uses regex to match BGP AS_PATH.
- Common patterns:
  - "^65002$" : exact match (only routes from AS 65002).
  - "^65002_" : path starts with 65002 (immediate next-AS).
  - "_65003$" : path ends with 65003 (originator).
  - "_65004_" : path includes 65004 anywhere.` },

  { cmd: 'match as-path',
    example: `R1(config-route-map)# match as-path 100

# Where 100 is the AS-path access-list defined earlier.

What it means:
- Inside a route-map, matches BGP AS_PATH against the named
  AS-path ACL.
- Combine with "set" actions for AS-path-conditional policy.
- Used heavily in transit ISP filtering: "permit only customer-
  originated routes" via AS-path matching.` },

  { cmd: 'match local-preference',
    example: `R1(config-route-map)# match local-preference 200

# Routes with LocPrf 200 match this clause.

What it means:
- Route-map match for BGP local-preference.
- Useful in conditional advertisement: only export routes with
  high local-pref (typical ISP upstream routes).
- Combine with set-community for tag-based routing.` },

  { cmd: 'set ip next-hop {ip-address | peer-address | self}',
    example: `R1(config-route-map)# set ip next-hop 10.99.0.1
R1(config-route-map)# set ip next-hop self
R1(config-route-map)# set ip next-hop peer-address

What it means:
- Manipulates next-hop in route advertisements.
- "self" : advertise own IP as next-hop (typical for iBGP
  hub-and-spoke or RR clients).
- "peer-address" : advertise the peer's IP as next-hop (rare).
- Specific IP : recursive next-hop manipulation (PBR contexts).` },

  { cmd: 'set metric {+value | -value | value}',
    example: `R1(config-route-map)# set metric 200      ! absolute
R1(config-route-map)# set metric +50      ! add to existing
R1(config-route-map)# set metric -10      ! subtract

What it means:
- Sets BGP MED (Multi-Exit Discriminator). Lower MED preferred
  by upstream peer.
- "+value" / "-value" : relative adjustment to incoming MED.
- Cross-AS use: tells upstream which entry-point to prefer when
  advertising the same prefix from multiple eBGP edges.` },

  { cmd: 'set origin {igp | incomplete}',
    example: `R1(config-route-map)# set origin igp

# Routes affected by this clause now have Origin code "i".

What it means:
- Sets BGP origin attribute:
  - igp (i) : prefix originated within an IGP.
  - egp (e) : EGP-originated (legacy, never used).
  - incomplete (?) : redistributed from another protocol.
- Best path selection prefers IGP > EGP > Incomplete (after
  more important attributes).` },

  { cmd: 'set weight 0–65535',
    example: `R1(config-route-map)# set weight 200

R1# show ip bgp 10.0.0.0 | include Weight
... LocPrf 100, weight 200 ... best

What it means:
- BGP Weight — Cisco-proprietary, locally-significant attribute.
- Higher weight wins. NOT advertised to peers (purely local
  influence on best-path selection).
- Used to prefer one inbound peer over another for outbound
  traffic from this router specifically.` },

  { cmd: 'set community bgp-community [additive]',
    example: `R1(config-route-map)# set community 65001:100 65001:200
R1(config-route-map)# set community 65001:300 additive

# Without "additive", the SET overwrites existing communities.
# With "additive", the new communities are appended.

What it means:
- Sets BGP community attributes on routes.
- "no-export", "no-advertise", "local-as" are well-known
  communities with predefined behaviour.
- Custom format AS:VAL (e.g. 65001:100). The AS_NUMBER:VALUE
  convention reserves space per ASN.
- "additive" preserves any existing communities.` },

  { cmd: 'neighbor ip-address route-map route-map-name {in|out}',
    example: `R1(config-router)# neighbor 10.10.10.2 route-map IN_FROM_ISP in
R1(config-router)# neighbor 10.10.10.2 route-map OUT_TO_ISP out

What it means:
- Applies a route-map to inbound or outbound BGP updates.
- "in" : filter/modify routes RECEIVED from peer.
- "out" : filter/modify routes ADVERTISED to peer.
- Same route-map can be applied to both directions if needed.` },

  { cmd: 'ip bgp-community new-format',
    example: `R1(config)# ip bgp-community new-format

R1# show ip bgp 10.0.0.0 | include Community
Community: 65001:100 65001:200

What it means:
- Display BGP communities in modern AS:VAL format (e.g.
  "65001:100") instead of the legacy 32-bit integer.
- Default in modern IOS XE; explicit on older platforms.
- No functional change — purely display formatting.` },

  { cmd: 'clear ip bgp ip-address [soft]',
    example: `R1# clear ip bgp 10.10.10.2 soft
# Soft reset (uses Route Refresh capability), no session bounce.

R1# clear ip bgp 10.10.10.2
# Hard reset, session bounces.

What it means:
- "soft" : non-disruptive policy refresh. Peer re-sends routes.
- Without "soft" : hard reset, full session re-establishment.
- For changes to inbound policy, use "clear ip bgp X soft in";
  for outbound use "soft out".` },

  { cmd: 'clear bgp afi safi {ip-address|*} soft [in | out]',
    example: `R1# clear bgp ipv4 unicast 10.10.10.2 soft in
R1# clear bgp ipv6 unicast * soft out

What it means:
- Generic soft-reset syntax for any AFI/SAFI.
- "*" affects all peers.
- "in" : refresh inbound (peer re-sends).
- "out" : refresh outbound (we re-advertise).` },

  { cmd: 'show bgp afi safi regexpregex-pattern',
    example: `R1# show bgp ipv4 unicast regexp _65002_

   Network          Next Hop      Metric LocPrf Weight Path
*> 198.51.100.0/24  10.10.10.2     0             0      65002 i
*> 203.0.113.0/24   10.10.10.2     0             0      65002 65003 i

What it means:
- Filters BGP table by AS_PATH regex.
- Useful for AS-based queries: "what came from AS 65002?",
  "which prefixes transit AS 65003?", etc.
- Same regex syntax as ip-as-path access-lists.` },

  { cmd: 'show bgp afi safi community community',
    example: `R1# show bgp ipv4 unicast community 65001:100

   Network          Next Hop      Metric LocPrf Weight Path
*> 10.0.0.0/16      0.0.0.0           0  32768       i
*> 10.10.0.0/16     0.0.0.0           0  32768       i

Total number of prefixes 2

What it means:
- Filters BGP table by community attribute.
- Multiple communities: "show bgp ipv4 unicast community 65001:100
  65001:200 exact-match" (must match BOTH for "exact-match"
  variant).
- Useful for verifying community-tagging policies.` }
];

// Apply enrichments
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

// Delete garbage entries
let deleted = 0;
for (const [secName, arr] of Object.entries(IOS.sections)) {
  IOS.sections[secName] = arr.filter(c => {
    if (GARBAGE.has(c.cmd)) { deleted++; return false; }
    return true;
  });
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
console.log('Garbage entries deleted:                ' + deleted);
if (notFoundList.length) {
  console.log('Not-found cmd starts:');
  for (const c of notFoundList) console.log('  -', c);
}
