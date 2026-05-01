// Cisco IOS enrichment batch 3 (Stage 3): VLANs (56) + QoS (30) = 86 entries.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const IOS  = data.platforms.ciscoios;

const ENTRIES = [
  // ============== VLANs ==============
  { cmd: 'show vlan id 10',
    example: `Switch# show vlan id 10

VLAN Name    Status   Ports
---- ------- -------- ----------------------------------
10   DATA    active   Gi1/0/1, Gi1/0/2, Gi1/0/3, Gi1/0/4

VLAN Type  SAID       MTU   Parent  RingNo  BridgeNo  Stp   BrdgMode  Trans1  Trans2
---- ----- ---------- ----- ------- ------ --------- ----- --------- ------- -------
10   enet  100010     1500  -       -      -          -     -         0       0

What it means:
- Per-VLAN summary: name, state, member ports, MTU, type.
- "active" = VLAN exists in DB and is forwarding. "suspended"
  / "act/unsup" indicate VLAN exists but isn't usable.
- Ports listed are ACCESS ports in this VLAN (trunks not shown
  here — see "show interfaces trunk").` },

  { cmd: 'show vtp status',
    example: `Switch# show vtp status

VTP Version capable             : 1 to 3
VTP version running              : 3
VTP Domain Name                  : CORP
VTP Pruning Mode                 : Disabled
VTP Traps Generation             : Disabled
Device ID                        : 0050.5612.3456
Configuration last modified by 10.10.10.1 at 5-1-26 11:22:18

Feature VLAN:
--------------
VTP Operating Mode                : Server
Maximum VLANs supported locally   : 1005
Number of existing VLANs          : 12
Configuration Revision            : 142
Primary ID                        : 0050.5612.3456
Primary Description               : core1.corp

What it means:
- VTP propagates VLAN database between switches.
- Mode Server : can create/delete VLANs and propagates.
  Client : receives only. Transparent : standalone.
- Configuration Revision : higher = newer. A switch with higher
  revision overrides older ones — DANGEROUS when adding a switch
  with stale config.
- Always set "vtp mode transparent" on a fresh switch BEFORE
  connecting it to the existing VTP domain.` },

  { cmd: 'show vtp counters',
    example: `Switch# show vtp counters

VTP statistics:
Summary advertisements received    : 1245
Subset advertisements received     : 12
Request advertisements received    : 0
Summary advertisements transmitted : 0
Subset advertisements transmitted  : 0
Number of config revision errors   : 0
Number of config digest errors     : 0
Number of V1 summary errors        : 0

What it means:
- Counters since boot or last clear.
- "Config digest errors > 0" : VTP password mismatch with
  neighbour — common after a domain join with wrong password.
- "Config revision errors" : received an advertisement with a
  lower revision than current — usually benign but worth checking.` },

  { cmd: 'vlan 10\n name DATA',
    example: `Switch(config)# vlan 10
Switch(config-vlan)# name DATA
Switch(config-vlan)# state active

Switch# show vlan id 10
VLAN Name    Status   Ports
---- ------- -------- ----------------------------------
10   DATA    active

What it means:
- Creates VLAN 10 with name "DATA" in the local VLAN database.
- VLAN range 1-4094; 1002-1005 reserved (legacy ATM/FDDI).
- VLANs 1-1005 propagated by VTP; 1006-4094 stay local.
- "state active" is default. Use "state suspend" for VLANs not
  yet ready for traffic.` },

  { cmd: 'vtp mode transparent',
    example: `Switch(config)# vtp mode transparent

Setting device to VTP Transparent mode for VLANS.

Switch# show vtp status | include Mode
VTP Operating Mode                : Transparent

What it means:
- Disables VTP database participation. Switch creates / deletes
  local VLANs but doesn't propagate or accept changes from peers.
- Best practice on most modern networks — limits blast radius
  of accidental VTP-database wipes.
- VTP advertisements still RELAYED through the switch (transit
  function preserved).` },

  { cmd: 'vtp domain CORP\n vtp mode server',
    example: `Switch(config)# vtp domain CORP
Switch(config)# vtp mode server
Switch(config)# vtp password sharedSecret2026

Setting VTP password to: sharedSecret2026

Switch# show vtp status | include Domain|Mode|Pass
VTP Domain Name                  : CORP
VTP Operating Mode                : Server
VTP Password                       : sharedSecret2026

What it means:
- Joins the VTP domain "CORP" in Server mode.
- Server can create/delete/modify VLANs; changes propagate to
  Clients in the same domain.
- Password protects against accidentally joining a foreign
  domain — both sides must agree.
- BEFORE running this on a new switch, ALWAYS verify its VTP
  config revision is 0, otherwise it could overwrite the
  domain's existing VLAN database.` },

  { cmd: 'switchport access vlan 10',
    example: `Switch(config)# interface gi1/0/1
Switch(config-if)# switchport mode access
Switch(config-if)# switchport access vlan 10

Switch# show interfaces gi1/0/1 switchport | include Access
Access Mode VLAN: 10 (DATA)

What it means:
- Assigns access port to VLAN 10. Untagged traffic only.
- VLAN must exist in the database. On modern IOS the VLAN gets
  auto-created if missing.
- Pair with "switchport voice vlan N" for IP-phone deployments
  (PC plus phone share one cable).` },

  { cmd: 'switchport voice vlan 200',
    example: `Switch(config-if)# switchport access vlan 10
Switch(config-if)# switchport voice vlan 200

Switch# show interfaces gi1/0/1 switchport | include voice
Voice VLAN: 200 (VOICE)

What it means:
- Sets the voice VLAN on a multi-VLAN access port. Phone discovers
  via CDP/LLDP and tags voice frames with VLAN 200; data from PC
  stays untagged in VLAN 10.
- Trust DSCP/CoS at the switch with "mls qos trust device cisco-phone"
  to preserve QoS markings from the phone.
- Without "voice vlan", phone falls back to dot1p/0 untagged.` },

  { cmd: 'vlan vlan-id',
    example: `Switch(config)# vlan 100
Switch(config-vlan)# name MGMT

What it means:
- Generic syntax for entering VLAN configuration mode.
- VLAN range 1-4094. VLANs 1006-4094 require VTP v3 to propagate.
- Use "no vlan 100" to delete (also removes from any access
  ports — those revert to VLAN 1).` },

  { cmd: 'name vlan-name',
    example: `Switch(config-vlan)# name CORP-DATA

Switch# show vlan id 10 | include DATA
10   CORP-DATA  active

What it means:
- Free-form text up to 32 chars (no spaces). Documentation
  only — no functional impact.
- Best practice: meaningful names like SALES-DATA, BLDG-A-VOICE,
  MGMT-OOB.` },

  { cmd: 'switchport mode access',
    example: `Switch(config-if)# switchport mode access

Switch# show interfaces gi1/0/1 switchport | include Mode
Administrative Mode: static access

What it means:
- Forces single-VLAN access port mode. Untagged frames only.
- Disables DTP — port won't accidentally negotiate to trunk.
- Always set this explicitly on user-facing ports.` },

  { cmd: 'switchport access vlan {vlan-id | name vlan-name}',
    example: `Switch(config-if)# switchport access vlan 10        ! by ID
Switch(config-if)# switchport access vlan name DATA  ! by name (3.x+)

What it means:
- "name DATA" form (IOS XE 3.x+) lets you reference a VLAN by
  its symbolic name — handy for templated config.
- Both forms produce the same running-config: assignment by ID.
- Auto-created VLANs land in the DB at "state active".` },

  { cmd: 'switchport mode trunk',
    example: `Switch(config-if)# switchport mode trunk

Switch# show interfaces gi1/0/24 switchport | include Mode
Administrative Mode: trunk
Operational Mode: trunk

What it means:
- Forces 802.1q trunk mode. Tagged frames except the native VLAN.
- Pair with "switchport trunk allowed vlan" to restrict carried
  VLANs explicitly.
- Disables DTP if also "switchport nonegotiate" is set.` },

  { cmd: 'switchport trunk native vlan vlan-id',
    example: `Switch(config-if)# switchport trunk native vlan 99

Switch# show interfaces gi1/0/24 trunk | head -3
Port      Mode  Encapsulation  Status     Native vlan
Gi1/0/24  on    802.1q         trunking   99

What it means:
- Native VLAN carries untagged traffic on the trunk. Both ends
  must agree.
- Use a dummy VLAN (e.g. 99) so untagged management/control
  traffic doesn't accidentally land in a real user VLAN.
- "vlan dot1q tag native" globally tags even native VLAN frames
  for additional security.` },

  { cmd: 'switchport trunk allowed vlan {vlan-ids | all | none | add | remove | except}',
    example: `Switch(config-if)# switchport trunk allowed vlan 10,20,30
Switch(config-if)# switchport trunk allowed vlan add 40
Switch(config-if)# switchport trunk allowed vlan remove 20
Switch(config-if)# switchport trunk allowed vlan except 100,200
Switch(config-if)# switchport trunk allowed vlan all     ! 1-4094 (default)
Switch(config-if)# switchport trunk allowed vlan none

What it means:
- Restricts VLAN traffic on the trunk.
- "add" / "remove" : modify without re-typing the full list.
- "except" : everything except the listed VLANs.
- "all" : 1-4094 (the default).
- "none" : nothing — useful as a safe default before adding
  specific VLANs.` },

  { cmd: 'show interfaces trunk',
    example: `Switch# show interfaces trunk

Port      Mode             Encapsulation  Status        Native vlan
Gi1/0/24  on               802.1q         trunking      99
Po1       on               802.1q         trunking      1

Port      Vlans allowed on trunk
Gi1/0/24  10,20,30,99
Po1       1-4094

Port      Vlans allowed and active in management domain
Gi1/0/24  10,20,30,99
Po1       1,10,20,30,99

Port      Vlans in spanning tree forwarding state and not pruned
Gi1/0/24  10,20,30
Po1       1,10,20

What it means:
- All trunk ports + their per-trunk VLAN configuration.
- "active" : VLAN exists in the DB.
- "forwarding" : VLAN passing traffic on this trunk (after STP
  decisions). STP-blocked VLANs absent here.` },

  { cmd: 'show mac address-table [address | dynamic | vlan]',
    example: `Switch# show mac address-table

Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 10     001a.1e11.2233    DYNAMIC     Gi1/0/1
 20     001a.1e44.5566    STATIC      CPU
 99     001a.1e77.8899    DYNAMIC     Gi1/0/24

# Filtered:
Switch# show mac address-table address 0050.5612.3456
Switch# show mac address-table dynamic vlan 10
Switch# show mac address-table count

What it means:
- L2 forwarding table — MAC ↔ port mappings.
- DYNAMIC : learned from ingress frames. STATIC : manually
  configured or "CPU" entries (router's own MAC for SVIs).
- Filter by address / VLAN / type for targeted lookups.` },

  { cmd: 'mac address-table static mac-address vlan vlan-id {drop | interface}',
    example: `Switch(config)# mac address-table static 0050.5612.3456 vlan 10 interface gi1/0/1

Switch# show mac address-table address 0050.5612.3456
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 10     0050.5612.3456    STATIC      Gi1/0/1

# Drop variant:
Switch(config)# mac address-table static 0050.bad0.bad0 vlan 10 drop

What it means:
- STATIC entry pins a MAC to a port (or "drop" — black-hole).
- Use "interface" form for permanent server / printer pinning.
- "drop" is an instant block — useful for quarantining a known
  malicious MAC during incident response.` },

  { cmd: 'clear mac address-table dynamic [{address | interface | vlan}]',
    example: `Switch# clear mac address-table dynamic               ! all
Switch# clear mac address-table dynamic interface gi1/0/1
Switch# clear mac address-table dynamic vlan 10
Switch# clear mac address-table dynamic address 0050.5612.3456

What it means:
- Wipes dynamic entries. Static / sticky preserved.
- Useful after a topology change (gateway move, port swap) to
  drop stale L2 paths.
- Per-port / per-VLAN forms minimise disruption to unaffected
  traffic.` },

  { cmd: 'show interfaces interface-id switchport',
    example: `Switch# show interfaces gi1/0/1 switchport

Name: Gi1/0/1
Switchport: Enabled
Administrative Mode: static access
Operational Mode: static access
Negotiation of Trunking: Off
Access Mode VLAN: 10 (DATA)
Voice VLAN: 200 (VOICE)
Trunking VLANs Enabled: ALL
Pruning VLANs Enabled: 2-1001
Capture Mode: Disabled
Protected: false

What it means:
- Per-port L2 configuration snapshot — admin (configured) and
  operational (actual) modes.
- "Negotiation of Trunking: Off" = DTP disabled (best practice).
- "Voice VLAN: 200" = phone tagged frames go here; PC frames
  stay untagged in VLAN 10.` },

  { cmd: 'interface vlan vlan-id',
    example: `Switch(config)# interface vlan 10
Switch(config-if)# ip address 10.10.0.1 255.255.255.0
Switch(config-if)# no shutdown

Switch# show ip interface brief vlan 10
Vlan10    10.10.0.1   YES manual  up   up

What it means:
- Creates/enters a Switched Virtual Interface (SVI) — L3 logical
  interface for the VLAN.
- VLAN must exist in DB and have at least one access port up
  for the SVI line-protocol to come up.
- Used as the default gateway for hosts in the VLAN.` },

  { cmd: 'no switchport',
    example: `R1(config)# interface gi0/1
R1(config-if)# no switchport
R1(config-if)# ip address 10.10.10.1 255.255.255.252

What it means:
- Converts an L2 (switchport) interface to L3 (routed) mode on
  multilayer switches.
- After this, the port acts like a router interface — needs IP
  address, no VLAN membership.
- Reverse with "switchport". Some platforms require shut/no shut
  to apply the change cleanly.` },

  { cmd: 'show ip interface [brief | interface-id | vlan]',
    example: `Switch# show ip interface brief
Interface          IP-Address    OK?  Method  Status      Protocol
GigabitEthernet0/0 10.10.10.1    YES  manual  up           up
Vlan10             10.10.0.1     YES  manual  up           up
Vlan99             unassigned    YES  unset   down         down

Switch# show ip interface vlan 10 | head -10
Vlan10 is up, line protocol is up
  Internet address is 10.10.0.1/24
  Broadcast address is 255.255.255.255
  Address determined by setup command
  MTU is 1500 bytes
  Helper address is not set
  Directed broadcast forwarding is disabled
  Outgoing access list is not set
  Inbound  access list is not set

What it means:
- "brief" : one-line summary per interface. Most-used for quick
  state check.
- "vlan 10" : detailed L3 config for SVI 10 (helpers, ACLs, ARP
  timers, NAT-inside flag).` },

  { cmd: 'show ipv6 interface [brief | interface-id | vlan]',
    example: `Switch# show ipv6 interface brief
GigabitEthernet0/0     [up/up]
    FE80::1
    2001:DB8:1::1
Vlan10                 [up/up]
    FE80::5
    2001:DB8:10::1

Switch# show ipv6 interface vlan 10 | head -10
Vlan10 is up, line protocol is up
  IPv6 is enabled, link-local address is FE80::5
  No Virtual link-local address(es)
  Description: User-VLAN
  Global unicast address(es):
    2001:DB8:10::1, subnet is 2001:DB8:10::/64

What it means:
- IPv6 equivalent of "show ip interface".
- Every active IPv6 interface has a link-local (FE80::*) address;
  global addresses optional.
- "[up/up]" = admin up + line protocol up.` },

  { cmd: 'show ip arp [mac-address | ip-address | vlan | interface]',
    example: `Switch# show ip arp
Protocol  Address      Age  Hardware Addr     Type   Interface
Internet  10.10.0.1    -    0050.5612.3456    ARPA   Vlan10  ← own SVI
Internet  10.10.0.50   142  001a.1e11.2233    ARPA   Vlan10
Internet  10.10.0.51   24   001a.1e44.5566    ARPA   Vlan10

# Filtered:
Switch# show ip arp 10.10.0.50
Switch# show ip arp 0050.5612.3456
Switch# show ip arp interface vlan 10

What it means:
- ARP table — IP ↔ MAC ↔ interface mappings.
- Age (sec) since last refresh. Default ARP timeout is 14400
  (4 hours). "Age -" = own (router-owned) IP.
- Combine with "show mac address-table" to chase a complaining
  user back to a switch port: ARP gives the MAC, MAC table gives
  the port.` },

  { cmd: 'show sdm prefer {vlan | advanced}',
    example: `Switch# show sdm prefer

Showing SDM Template Info:
This is the Advanced template:
  number of VLANs:                                4096
  Unicast MAC addresses:                          32K
  Active Directory Numerical Indexes (ARP):       16K
  Layer 2 Adjacency Numerical Indexes:            16K
  IPv4 unicast routes:                            16K
  IPv4 multicast routes:                          1K
  Length of MAC adjacency:                        16K
  Layer 3 Multicast:                              1K
  IPv6 unicast routes:                            8K
  ...

What it means:
- SDM (Switch Database Management) template defines TCAM /
  resource allocation.
- "vlan" : optimised for L2 deployments, more MAC addresses.
- "advanced" : balanced L2 + L3 + multicast.
- Change requires reload: "sdm prefer advanced" then "reload".` },

  { cmd: 'show vlan [{brief | id vlan-id | name vlan-name | summary}]',
    example: `Switch# show vlan brief
VLAN Name      Status   Ports
---- --------- -------- ------------------------
1    default   active   Gi1/0/3, Gi1/0/4
10   DATA      active   Gi1/0/1, Gi1/0/2
99   NATIVE    active

Switch# show vlan summary
Number of existing VLANs           : 4
Number of existing VTP VLANs       : 4
Number of existing extended VLANs  : 0

What it means:
- "brief" : compact list. "id N" : single VLAN detail.
  "name X" : look up by name. "summary" : counts only.
- "Status active" = forwarding. "act/unsup" = exists but
  unsupported on this platform (e.g. extended VLAN on legacy
  hardware).` },

  { cmd: 'spanning-tree vlan vlan-id max-age',
    example: `Switch(config)# spanning-tree vlan 10 max-age 30

Switch# show spanning-tree vlan 10 | include Max
  Max age 30 sec

What it means:
- Maximum age (sec) BPDUs are stored before being aged out.
  Default 20.
- Increasing helps in large STP domains where BPDU propagation
  takes longer.
- Range: 6-40. ALL switches in the same STP domain should agree.` },

  { cmd: 'spanning-tree vlan vlan-id hello-time hello-time',
    example: `Switch(config)# spanning-tree vlan 10 hello-time 1

Switch# show spanning-tree vlan 10 | include Hello
  Hello time 1 sec

What it means:
- Frequency of BPDU transmission. Default 2 sec.
- Range: 1-10. Lower = faster failure detection but more BPDU
  traffic.
- Mainly affects STP root election + topology change propagation
  speed.` },

  { cmd: 'spanning-tree vlan vlan-id forward-time forward-time',
    example: `Switch(config)# spanning-tree vlan 10 forward-time 10

Switch# show spanning-tree vlan 10 | include Forward
  Forward Delay 10 sec

What it means:
- Time spent in Listening + Learning STP states (15 + 15 =
  30 sec default total transition time).
- Range 4-30. Lower = faster port-up but more risk of transient
  loops.
- Largely irrelevant in RSTP / RPVST+ — those skip
  Listening/Learning entirely on edge ports.` },

  { cmd: 'show spanning-tree [vlan vlan-id]',
    example: `Switch# show spanning-tree vlan 10

VLAN0010
  Spanning tree enabled protocol rstp
  Root ID    Priority    24586
             Address     0050.5612.3456
             Cost        0
             Port        0 (-)
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec

  Bridge ID  Priority    24586  (priority 24576 sys-id-ext 10)
             Address     0050.5612.3456 (this switch is the root)
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
             Aging Time  300 sec

Interface          Role Sts Cost      Prio.Nbr Type
------------------ ---- --- --------- -------- --------------------------------
Gi1/0/1            Desg FWD 4         128.1    P2p Edge
Gi1/0/24           Desg FWD 4         128.24   P2p

What it means:
- Per-VLAN STP detail — root info, bridge info, per-port roles.
- Roles: Root (best path to root), Desg (forwards segment traffic),
  Altn (alternate, blocked), Backup (backup, blocked), Edge (host
  port, portfast).
- "this switch is the root" indicates this device is root for the
  VLAN.` },

  { cmd: 'show spanning-tree [vlan vlan-id] detail',
    example: `Switch# show spanning-tree vlan 10 detail | head -25

VLAN0010 is executing the rstp compatible Spanning Tree protocol
  Bridge Identifier has priority 24586, sysid 10, address 0050.5612.3456
  Configured hello time 2, max age 20, forward delay 15
  ...
  Number of topology changes 14 last change occurred 02:14:21 ago
        from GigabitEthernet1/0/24
  Times:  hold 1, topology change 35, notification 2
          hello 2, max age 20, forward delay 15

Port 1 (GigabitEthernet1/0/1) of VLAN0010 is forwarding
  Port path cost 4, Port priority 128, Port Identifier 128.1.
  Designated root has priority 24586, address 0050.5612.3456
  ...

What it means:
- Verbose per-port + per-VLAN STP state with topology change
  counters and timestamps.
- "Number of topology changes 14" : how many TCNs have flooded.
  Frequent TCs indicate flapping link.
- "from GigabitEthernet1/0/24" : the port that triggered the
  most recent TC — first stop for "what flapped?" diagnosis.` },

  { cmd: 'spanning-tree vlan vlan-id priority priority',
    example: `Switch(config)# spanning-tree vlan 10 priority 0    ! definitely root
Switch(config)# spanning-tree vlan 10 priority 24576 ! manual root
Switch(config)# spanning-tree vlan 10 priority 32768 ! default

Switch# show spanning-tree vlan 10 | include Bridge
  Bridge ID  Priority    24586  (priority 24576 sys-id-ext 10)

What it means:
- Lower priority wins root election.
- Must be a multiple of 4096 (priority field has only 4 high
  bits available; sys-id-ext fills the rest).
- 0 = highest possible (forces root). 32768 = default.
- Macros "spanning-tree vlan N root primary" / "secondary" set
  appropriate values automatically.` },

  { cmd: 'spanning-tree [vlan vlan-id] costcost',
    example: `Switch(config-if)# spanning-tree vlan 10 cost 100

Switch# show spanning-tree vlan 10 interface gi1/0/24 | include cost
   Port path cost 100

What it means:
- Per-port path cost override. Lower = preferred path.
- Default depends on speed: 1 Gbps = 4 (long mode) or 19 (short
  mode); 10 Gbps = 2 / 2; 100 Mbps = 19 / 100.
- Used to force STP to prefer one trunk over another in a
  redundant topology.` },

  { cmd: 'spanning-tree [vlan vlan-id] port-priority priority',
    example: `Switch(config-if)# spanning-tree vlan 10 port-priority 64

Switch# show spanning-tree vlan 10 interface gi1/0/24 | include priority
   Port priority 64

What it means:
- Port-priority is a tie-breaker between equal-cost paths.
- Lower priority wins. Default 128.
- Useful when two same-speed parallel trunks need a
  deterministic active/standby selection.` },

  { cmd: 'spanning-tree portfast trunk',
    example: `Switch(config-if)# spanning-tree portfast trunk

%Warning: portfast should only be enabled on ports connected to a single
host. ...

What it means:
- Forces portfast on a trunk port — DANGEROUS unless the trunk
  faces a server (VMware ESX, Hyper-V) that's effectively a
  multi-VLAN host with no STP-aware downstream switches.
- For switch-to-switch trunks, NEVER use this — exposes the
  network to STP loops during convergence.
- Best paired with "spanning-tree bpdufilter enable" on the
  same trunk.` },

  { cmd: 'spanning-tree mode mst',
    example: `Switch(config)# spanning-tree mode mst

Switch# show spanning-tree summary | include mode
Switch is in mst mode

What it means:
- Switch to MSTP (IEEE 802.1s/Q).
- Multiple VLANs can share one STP instance — vastly fewer BPDUs
  on networks with hundreds of VLANs.
- Define MST regions via "spanning-tree mst configuration" with
  matching name + revision + VLAN-instance mapping on every
  switch in the region.` },

  { cmd: 'spanning-tree mst configuration / instance instance-number vlan vlan-id',
    example: `Switch(config)# spanning-tree mst configuration
Switch(config-mst)# name CORP_REGION
Switch(config-mst)# revision 1
Switch(config-mst)# instance 1 vlan 10,20
Switch(config-mst)# instance 2 vlan 30,40,50

Switch# show spanning-tree mst configuration
Name      [CORP_REGION]
Revision  1
Instance  Vlans mapped
--------  -------------------------------------
0         1-9,11-19,21-29,31-39,41-49,51-4094
1         10,20
2         30,40,50

What it means:
- Maps VLANs into MST instances. ALL switches in the region must
  agree on name + revision + mapping.
- VLANs not explicitly mapped go to instance 0 (CIST).
- Bumping revision must be coordinated — out-of-sync revisions
  silently break the region.` },

  { cmd: 'show spanning-tree mst [instance-number]',
    example: `Switch# show spanning-tree mst 1

##### MST1    vlans mapped:   10,20
Bridge        address 0050.5612.3456  priority      24586 (24576 sysid 10)
Root          this switch for MST1

Interface       Role  Sts Cost      Prio.Nbr Type
--------------- ----- --- --------- -------- --------------------------------
Gi1/0/1         Desg  FWD 200000    128.1    P2p Edge
Gi1/0/24        Desg  FWD 20000     128.24   P2p

What it means:
- Per-MST-instance STP state. Each instance has its own root,
  bridge ID, port roles.
- "this switch for MST1" = local switch is root for instance 1
  (and thus for VLANs 10 + 20).
- Useful for verifying MSTP load-balancing — different instances
  may use different physical paths.` },

  { cmd: 'vtp version {1 | 2 | 3}',
    example: `Switch(config)# vtp version 3

Switch# show vtp status | include version
VTP version running              : 3

What it means:
- v1 / v2 : legacy. v2 supports Token Ring (defunct) and propagates
  unrecognized advertisements (forward-compatible).
- v3 : adds password authentication, MST-database propagation,
  primary-server concept, extended VLAN range (1006-4094)
  propagation.
- Match version across all switches in the domain.` },

  { cmd: 'vtp domain domain-name',
    example: `Switch(config)# vtp domain CORP

Setting VTP domain name to CORP

Switch# show vtp status | include Domain
VTP Domain Name                  : CORP

What it means:
- Logical domain that VTP advertisements scope to. Switches in
  different domains don't exchange databases.
- Set BEFORE "vtp mode server" to avoid the new switch absorbing
  a remote domain's config.
- Empty domain ("NULL") exists by default; first VTP advert
  received auto-sets the domain name.` },

  { cmd: 'vtp mode {server | client | transparent | off}',
    example: `Switch(config)# vtp mode server      ! manage VLANs
Switch(config)# vtp mode client      ! receive only
Switch(config)# vtp mode transparent ! standalone, just relay
Switch(config)# vtp mode off         ! disabled (don't relay either)

What it means:
- Server : full participant — can create/delete/modify VLANs;
  propagates changes.
- Client : receive-only. Can't create VLANs locally.
- Transparent : standalone. Local VLAN DB only; relays VTP
  advertisements through.
- Off : disabled, doesn't even relay.` },

  { cmd: 'vtp primary',
    example: `Switch# vtp primary vlan
This system is becoming primary server for feature vlan
No conflicting VTP3 devices found.
Do you want to continue? [confirm]
Switch has been set as primary server for feature vlan.

What it means:
- VTPv3 only — designates this switch as the PRIMARY server for
  a feature (vlan / mst / unknown).
- Only the primary can modify the database; secondaries can have
  the database but only the primary updates it.
- Eliminates the classic VTPv1/v2 risk of a stale-revision
  switch wiping the entire VLAN database.` },

  { cmd: 'switchport mode dynamic desirable / switchport mode dynamic auto',
    example: `Switch(config-if)# switchport mode dynamic desirable  ! actively negotiate
Switch(config-if)# switchport mode dynamic auto       ! passively negotiate

What it means:
- DTP (Dynamic Trunking Protocol) modes:
  - dynamic desirable : actively offers to trunk.
  - dynamic auto      : trunks if peer offers.
  - auto+auto         = no trunk forms (neither offers).
- DANGEROUS: leaves ports vulnerable to rogue trunk negotiation.
  Production should use explicit "switchport mode access" or
  "trunk" + "switchport nonegotiate".` },

  { cmd: 'switchport nonegotiate',
    example: `Switch(config-if)# switchport mode trunk
Switch(config-if)# switchport nonegotiate

Switch# show interfaces gi1/0/24 switchport | include Negotiation
Negotiation of Trunking: Off

What it means:
- Disables DTP. Port doesn't advertise itself or react to
  negotiation packets.
- Required step in security hardening — prevents rogue switches
  from forming trunks via DTP.
- Apply on every access port AND every manually-configured trunk.` },

  { cmd: 'show interface [interface-id] trunk',
    example: `Switch# show interface gi1/0/24 trunk

Port      Mode  Encapsulation  Status        Native vlan
Gi1/0/24  on    802.1q         trunking      99

Port      Vlans allowed on trunk
Gi1/0/24  10,20,30,99

What it means:
- Per-interface trunk detail (or ALL trunks if no interface).
- Confirms trunk negotiation result, native VLAN, and which VLANs
  are allowed/active/forwarding.
- "Status trunking" = healthy. "not-trunking" = port came up
  in access mode (likely DTP failure or wrong mode).` },

  { cmd: 'switchport mode access/trunk/routed',
    example: `Switch(config-if)# switchport mode access  ! L2 access port
Switch(config-if)# switchport mode trunk   ! L2 trunk port
R1(config-if)# no switchport               ! L3 routed port

What it means:
- Three primary L2 modes:
  - access : single VLAN, untagged.
  - trunk  : multiple VLANs, 802.1q-tagged (except native).
  - routed : "no switchport" — L3 IP interface.
- Rule of thumb: explicitly set the mode rather than relying on
  "dynamic auto" defaults.` },

  { cmd: 'ip igmp snooping vlan vlan-id',
    example: `Switch(config)# ip igmp snooping vlan 10

Switch# show ip igmp snooping vlan 10
Global IGMP Snooping configuration:
-----------------------------------
IGMP snooping              : Enabled
Vlan 10:
--------
IGMP snooping              : Enabled
IGMPv2 immediate leave     : Disabled
Multicast router learning  : pim-dvmrp

What it means:
- Enables IGMP snooping on a specific VLAN (default is enabled
  globally + per-VLAN).
- "no ip igmp snooping vlan N" : disables for one VLAN.
- Without snooping, multicast floods to every port in the VLAN
  (defeats much of the point of multicast).` },

  { cmd: 'vlan <id>',
    example: `Switch(config)# vlan 100

Switch(config-vlan)# name MGMT
Switch(config-vlan)# state active

What it means:
- Generic syntax. VLAN-ID range 1-4094. 1002-1005 reserved
  (legacy ATM/FDDI).
- Drops you into VLAN config sub-mode for name / state / etc.
- Auto-created in transparent / off VTP modes; in server mode,
  also propagates to VTP clients.` },

  { cmd: 'name <vlan-name>',
    example: `Switch(config-vlan)# name SALES_DATA

Switch# show vlan id 10 | include SALES
10   SALES_DATA  active

What it means:
- 32-char VLAN name. No spaces. Alphanumeric + underscore /
  hyphen common.
- Documentation only — no functional impact. But useful for
  per-port reference: "switchport access vlan name SALES_DATA"
  on IOS XE 3.x+.` },

  { cmd: 'no vlan <id>',
    example: `Switch(config)# no vlan 100

VLAN 100 deleted.

# Access ports that were in VLAN 100 fall back to VLAN 1.

What it means:
- Deletes the VLAN from the database.
- Access ports in the deleted VLAN remain "in" it (so to speak)
  until you re-assign — they stop forwarding traffic until
  reassigned to another VLAN.
- Don't delete production VLANs without verifying which ports
  are members first ("show vlan id N" before deletion).` },

  { cmd: 'interface vlan <id>',
    example: `Switch(config)# interface vlan 10
Switch(config-if)# ip address 10.10.0.1 255.255.255.0
Switch(config-if)# no shutdown

Switch# show ip interface brief vlan 10
Vlan10    10.10.0.1   YES manual  up   up

What it means:
- Generic SVI creation syntax. VLAN must exist in DB and have
  ≥1 access port up for SVI line-protocol to come up.
- Also works for routed VLAN (multilayer switch acting as L3
  gateway for the VLAN).` },

  { cmd: 'ip address <ip> <mask>',
    example: `Switch(config-if)# ip address 10.10.0.1 255.255.255.0

# Or with secondary:
Switch(config-if)# ip address 192.168.10.1 255.255.255.0 secondary

Switch# show ip interface vlan 10 | include address
  Internet address is 10.10.0.1/24

What it means:
- Assigns IP + mask to the interface.
- "secondary" : add an additional IP. Useful for migration
  scenarios where two subnets share one VLAN temporarily.
- Replace existing IP with "no ip address" first, then "ip
  address NEW.NEW.NEW.NEW MASK".` },

  { cmd: 'no shutdown',
    example: `R1(config-if)# no shutdown

%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up

What it means:
- Brings the interface administratively up. L1/L2 negotiation
  runs. "line protocol up" confirms the data link is operational.
- Required step on newly-configured interfaces (default is shut
  on most platforms).` },

  { cmd: 'shutdown',
    example: `R1(config-if)# shutdown

%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to administratively down
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down

What it means:
- Administratively disables the interface. Reverse with
  "no shutdown".
- Useful for bringing down an SVI (delete its IP traffic) or
  isolating a port during incident response.` },

  { cmd: 'show vlan id <id>',
    example: `Switch# show vlan id 10

VLAN Name    Status   Ports
---- ------- -------- ---------------------------------
10   DATA    active   Gi1/0/1, Gi1/0/2, Gi1/0/3

What it means:
- Per-VLAN summary — name, status, member access ports.
- Same info as "show vlan brief" but filtered to one VLAN.
- Trunks aren't listed here — see "show interfaces trunk" for
  which trunks carry this VLAN.` },

  // ============== QoS ==============
  { cmd: 'show policy-map interface Gi1/0/1',
    example: `R1# show policy-map interface gi1/0/1

GigabitEthernet1/0/1
  Service-policy output: MARK_TRAFFIC

    Class-map: VOICE (match-any)
      45,012 packets
      Match: dscp ef (46)
      QoS Set
        dscp ef
          Marker statistics: Disabled

    Class-map: class-default (match-any)
      102,341 packets
      Match: any

What it means:
- Per-interface policy-map stats — how many packets matched each
  class.
- "Service-policy output" = applied on egress. "input" = ingress.
- Match counters help confirm classification is working — if a
  class has 0 packets, the match criterion is likely wrong.` },

  { cmd: 'show class-map',
    example: `R1# show class-map

 Class Map match-any VOICE (id 1)
   Match  dscp ef (46)
   Match  cos  5

 Class Map match-any DATA (id 2)
   Match  any

 Class Map match-all CRITICAL_DATA (id 3)
   Match access-group 100
   Match  dscp af31

What it means:
- All defined class-maps.
- "match-any" : OR logic — one match satisfies.
- "match-all" : AND logic — all matches must succeed.
- Each class-map can have multiple match criteria; combine for
  granular traffic identification.` },

  { cmd: 'show policy-map',
    example: `R1# show policy-map

  Policy Map MARK_TRAFFIC
    Class VOICE
     set dscp ef
    Class DATA
     bandwidth percent 30
    Class class-default
     fair-queue

  Policy Map LIMIT_GUEST
    Class class-default
     police cir 10000000

What it means:
- All defined policy-maps with their class actions.
- Actions include set (mark), police (rate-limit), bandwidth
  (CBWFQ), priority (LLQ).
- Each policy-map applies via "service-policy {input|output}"
  on an interface or VLAN.` },

  { cmd: 'show mls qos',
    example: `Switch# show mls qos

QoS is enabled
QoS ip packet dscp rewrite is enabled

What it means:
- Catalyst MLS QoS feature toggle. Required before QoS commands
  take effect on most Catalyst platforms.
- "dscp rewrite is enabled" : switch can modify DSCP markings
  on transit packets (vs trust-and-pass-through).
- Modern IOS XE doesn't use the "mls qos" framework — uses
  MQC (Modular QoS CLI) class-maps + policy-maps directly.` },

  { cmd: 'show mls qos interface Gi1/0/1',
    example: `Switch# show mls qos interface gi1/0/1

GigabitEthernet1/0/1
trust state: trust dscp
trust mode: trust dscp
trust enabled flag: ena
COS override: dis
default COS: 0
DSCP Mutation Map: Default DSCP Mutation Map
Trust device: cisco-phone

What it means:
- Per-port QoS trust state.
- "trust dscp" : preserve DSCP markings from incoming packets.
- "trust device cisco-phone" : trust QoS only when a Cisco IP
  phone is detected via CDP/LLDP (defends against hosts faking
  high-priority markings).` },

  { cmd: 'mls qos',
    example: `Switch(config)# mls qos

Switch# show mls qos | head -2
QoS is enabled

What it means:
- Globally enables MLS QoS on Catalyst (legacy platforms).
- Required before any "mls qos" interface commands take effect.
- IOS XE uses MQC instead — this command may not exist on newer
  IOS XE versions.` },

  { cmd: 'class-map match-any VOICE\n match dscp ef\n match cos 5',
    example: `R1(config)# class-map match-any VOICE
R1(config-cmap)# match dscp ef
R1(config-cmap)# match cos 5

R1# show class-map VOICE
 Class Map match-any VOICE (id 1)
   Match  dscp ef (46)
   Match  cos  5

What it means:
- Defines a class for voice traffic. "match-any" = OR — packet
  matches if it has DSCP EF (46) OR L2 CoS 5.
- Voice typically gets DSCP EF + CoS 5 from IP phones; matching
  both catches both directions.
- Reference this class in a policy-map's "class VOICE" block.` },

  { cmd: 'policy-map MARK\n class VOICE\n  set dscp ef\n class class-default\n  set dscp default',
    example: `R1(config)# policy-map MARK
R1(config-pmap)# class VOICE
R1(config-pmap-c)# set dscp ef
R1(config-pmap-c)# exit
R1(config-pmap)# class class-default
R1(config-pmap-c)# set dscp default

R1# show policy-map MARK
  Policy Map MARK
    Class VOICE
     set dscp ef (46)
    Class class-default
     set dscp default (0)

What it means:
- Re-marks voice traffic to DSCP EF and everything else to
  DSCP default (0).
- Apply with "service-policy input MARK" on the interface where
  traffic enters the network (typically a user-access port).
- Re-marking at the edge ensures consistent QoS treatment in
  the core.` },

  { cmd: 'service-policy type inspect policy-name',
    example: `R1(config-zone-pair)# service-policy type inspect ZP_INSIDE_OUTSIDE

R1# show policy-map type inspect zone-pair
policy exists on zone-pair
  Service-policy inspect: ZP_INSIDE_OUTSIDE
    Class-map: TRUSTED_TRAFFIC (match-any)
      pass

What it means:
- Applies a Zone-Based Firewall (ZBFW) policy to a zone-pair.
- Different from QoS service-policy — this controls which traffic
  is permitted between zones.
- ZBFW is the modern Cisco IOS firewall replacement for the
  legacy CBAC (ip inspect) feature.` },

  { cmd: 'control plane service-policy {input|output} policy-name',
    example: `R1(config)# control-plane
R1(config-cp)# service-policy input COPP

R1# show policy-map control-plane
Control Plane

  Service-policy input: COPP
    Class-map: SSH (match-any)
      45,012 packets, 6,402,341 bytes
      30 second offered rate 4000 bps, drop rate 0 bps
      Match: access-group 110

What it means:
- CoPP (Control Plane Policing) — protects the route-processor
  CPU from being overwhelmed by control-plane traffic (BGP, OSPF,
  SNMP, SSH, ICMP).
- Each class gets a rate limit; exceeding traffic is dropped.
- "drop rate" > 0 in steady state = legitimate traffic being
  dropped — re-tune the policy.` },

  { cmd: 'class-map [match-any | match-all] class-map-name',
    example: `R1(config)# class-map match-any VOICE_AND_VIDEO
R1(config-cmap)# match dscp ef
R1(config-cmap)# match dscp af41

R1(config)# class-map match-all CRITICAL_BUSINESS
R1(config-cmap)# match access-group 100
R1(config-cmap)# match dscp af31

What it means:
- match-any : OR — packet matches if any criterion matches.
- match-all : AND — packet must match ALL criteria.
- Combine class-maps for hierarchical classification.` },

  { cmd: 'policy-map policy-map-name',
    example: `R1(config)# policy-map QOS_OUT

R1(config-pmap)# class VOICE
R1(config-pmap-c)# priority percent 30
R1(config-pmap-c)# class DATA
R1(config-pmap-c)# bandwidth percent 50

What it means:
- Defines a QoS policy. Inside, list class-maps and per-class
  actions.
- Apply via "service-policy {input|output} POLICY_NAME" on an
  interface.` },

  { cmd: 'service-policy {input | output} policy-map-name',
    example: `R1(config-if)# service-policy input MARK_INGRESS
R1(config-if)# service-policy output QOS_EGRESS

R1# show policy-map interface gi0/0
GigabitEthernet0/0
  Service-policy input: MARK_INGRESS
  Service-policy output: QOS_EGRESS

What it means:
- input : applied on ingress (used for marking + classification).
- output : applied on egress (used for queueing + shaping).
- One input + one output per interface (or sub-interface).` },

  { cmd: 'match cos cos-value-list',
    example: `R1(config-cmap)# match cos 5 6 7

What it means:
- Matches L2 CoS values (priority bits in 802.1q headers).
- Range 0-7. Common: 5 = voice, 6 = control, 7 = network-control.
- Only relevant for L2 frames (trunks); access ports without
  802.1q tags don't carry CoS.` },

  { cmd: 'match [ip] dscp dscp-value-list',
    example: `R1(config-cmap)# match dscp ef
R1(config-cmap)# match dscp af31 af32 af33  ! AF3x family
R1(config-cmap)# match dscp 46              ! numeric

What it means:
- Matches DSCP (Differentiated Services Code Point) values.
- Common DSCP names: ef (46) voice, af41 (34) interactive video,
  af31-33 (26-30) call-signaling, default (0) best-effort.
- Multiple values OR each other within a single match line.` },

  { cmd: 'set qos-group qos-group-id',
    example: `R1(config-pmap-c)# set qos-group 5

What it means:
- Internal-only marking — qos-group is NOT carried in packet
  headers. Used as a hand-off between input and output policies
  in a hierarchical service-policy.
- Convenient for separating classification (input) from
  queueing (output) without using DSCP/CoS markers that could
  affect downstream devices.` },

  { cmd: 'set cos cos-value',
    example: `R1(config-pmap-c)# set cos 5

What it means:
- Re-marks the L2 CoS field. Range 0-7.
- Only takes effect on 802.1q-tagged egress (trunks).
- Common pairing: input policy "set dscp ef + set cos 5" so both
  L2 and L3 markings are consistent.` },

  { cmd: 'set [ip] dscp ip-dscp-value',
    example: `R1(config-pmap-c)# set dscp ef        ! voice
R1(config-pmap-c)# set dscp af41      ! interactive video
R1(config-pmap-c)# set dscp default   ! best-effort (0)

What it means:
- Re-marks DSCP on egress (or input if used on ingress).
- Standard markings (RFC 4594):
  ef    : voice (46)
  af4x  : interactive video
  af3x  : call-signaling
  af2x  : transactional data
  af1x  : bulk data
  cs0/default : best-effort.` },

  { cmd: 'police [cir]cir-in-bps[bc]committed-burst-size-in-bytes [be]excess-burst-size-in-bytes[conform-action action] [exceed-actionaction] [violate-actionaction]',
    example: `R1(config-pmap-c)# police cir 10000000 bc 12500 be 25000 \\
        conform-action transmit \\
        exceed-action set-dscp-transmit af11 \\
        violate-action drop

R1# show policy-map interface gi0/0 | include police
      police: cir 10000000 bps, bc 12500 bytes, be 25000 bytes
      conformed 102,341 packets
      exceeded 4,502 packets
      violated 142 packets, drop

What it means:
- Two-rate three-color policer (RFC 2698).
- conform : packets within CIR — usually transmit unchanged.
- exceed  : packets between CIR and PIR — usually re-mark down.
- violate : packets above PIR — usually drop.
- Use to implement bandwidth contracts (e.g. "max 10 Mbps").` },

  { cmd: 'mls qos trust dscp',
    example: `Switch(config-if)# mls qos trust dscp

Switch# show mls qos interface gi1/0/1 | include trust
trust state: trust dscp

What it means:
- Trust the DSCP markings on incoming packets (don't re-mark to
  default).
- Use on uplink ports between trusted devices that already mark
  correctly.
- On user-access ports, do NOT trust by default — users could
  mark their own traffic as voice/EF and steal priority.` },

  { cmd: 'mls qos trust cos',
    example: `Switch(config-if)# mls qos trust cos

What it means:
- Trust the L2 CoS markings on incoming 802.1q frames.
- Cisco IP phones mark voice as CoS 5 — pair with
  "mls qos trust device cisco-phone" so trust only kicks in
  when a phone is detected (anti-spoofing).` },

  { cmd: 'mls qos map cos-dscp <values>',
    example: `Switch(config)# mls qos map cos-dscp 0 8 16 24 32 40 46 56

Switch# show mls qos map cos-dscp
   Cos-dscp map:
        cos:   0  1  2  3  4  5  6  7
       -----------------------------------
        dscp:  0  8 16 24 32 40 46 56

What it means:
- Maps L2 CoS to DSCP. Eight values, one per CoS class.
- Default Cisco map: 0 8 16 24 32 40 48 56.
- The example above adjusts CoS 6 → DSCP 46 (EF) — for
  environments where the phone marks CoS 6 instead of 5.` },

  { cmd: 'policy-map <name>',
    example: `R1(config)# policy-map QOS_OUTPUT
R1(config-pmap)# class VOICE
R1(config-pmap-c)# priority percent 30
R1(config-pmap-c)# class CRITICAL
R1(config-pmap-c)# bandwidth percent 30
R1(config-pmap-c)# class class-default
R1(config-pmap-c)# fair-queue

What it means:
- Defines a QoS policy. Inside, reference class-maps and apply
  per-class actions.
- Three-class hierarchy: priority (LLQ for voice), bandwidth
  (CBWFQ guarantee), fair-queue (everything else).` },

  { cmd: 'class <class-map-name>',
    example: `R1(config-pmap)# class VOICE
R1(config-pmap-c)#

What it means:
- References a previously-defined class-map within a policy-map.
- Subsequent commands (set / bandwidth / police) apply to traffic
  matching this class.
- Always end the policy with "class class-default" — catches
  everything else.` },

  { cmd: 'set dscp <value>',
    example: `R1(config-pmap-c)# set dscp ef

What it means:
- Re-marks DSCP for traffic matching the parent class.
- Common values: ef (46) voice, af41 (34) interactive video,
  af31 (26) call-signaling, default (0) best-effort.
- Pair with "set cos N" if traffic also crosses 802.1q trunks.` },

  { cmd: 'bandwidth percent <value>',
    example: `R1(config-pmap-c)# bandwidth percent 30

What it means:
- Reserves a percentage of link bandwidth for this class
  (CBWFQ).
- Sum of all bandwidth percents in a policy must not exceed
  max-reserved-bandwidth (default 75% of interface BW).
- Class only gets the reserved BW if other classes have nothing
  to send — otherwise it's a guarantee, not a cap.` },

  { cmd: 'priority percent <value>',
    example: `R1(config-pmap-c)# priority percent 30

What it means:
- LLQ (Low Latency Queue) — sub-class of CBWFQ that gets
  strict-priority dequeueing.
- Use ONLY for voice and other latency-sensitive traffic.
- Excess traffic above the percent is policed-and-dropped to
  protect other classes from starvation.` },

  { cmd: 'service-policy input <policy-name>',
    example: `R1(config-if)# service-policy input MARK

R1# show policy-map interface gi0/0 | include input
  Service-policy input: MARK

What it means:
- Applies the named policy to ingress traffic.
- Common ingress actions: classify + mark (set dscp / cos / qos-group).
- Re-marking at the network edge (closest to the source) ensures
  consistent QoS treatment downstream.` },

  { cmd: 'service-policy output <policy-name>',
    example: `R1(config-if)# service-policy output QOS_EGRESS

R1# show policy-map interface gi0/0 | include output
  Service-policy output: QOS_EGRESS

What it means:
- Applies the named policy to egress traffic.
- Common egress actions: queueing (priority / bandwidth),
  shaping, dropping (random-detect).
- ONLY queueing-related actions belong on egress; classification
  + marking belong on ingress.` },

  { cmd: 'show policy-map interface <interface>',
    example: `R1# show policy-map interface gi0/0

GigabitEthernet0/0
  Service-policy output: QOS_EGRESS

    Class-map: VOICE (match-any)
      45,012 packets
      Match: dscp ef (46)
      Queueing
        queue limit 64 packets
        (queue depth/total drops/no-buffer drops) 0/0/0
        (pkts output/bytes output) 45,012/4,200,000
      Priority: percent 30, kbps 300000

    Class-map: class-default (match-any)
      102,341 packets
      Match: any

What it means:
- Per-interface policy execution. Hit counters per class,
  queue-depth stats, drops.
- "no-buffer drops" > 0 = queue exhaustion. Increase queue limit
  or re-tune percentages.
- "queue depth" : current depth — momentary spike is fine; sustained
  high values mean the class can't drain fast enough.` }
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
