// Cisco IOS enrichment batch 2 (Stage 3): Interfaces (50) + Switching & STP (49) = 99 entries.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const IOS  = data.platforms.ciscoios;

const ENTRIES = [
  // ============== Interfaces ==============
  { cmd: 'show interfaces trunk',
    example: `Switch# show interfaces trunk

Port      Mode             Encapsulation  Status        Native vlan
Gi1/0/24  on               802.1q         trunking      99
Po1       on               802.1q         trunking      99

Port      Vlans allowed on trunk
Gi1/0/24  10,20,30,99
Po1       1-4094

Port      Vlans allowed and active in management domain
Gi1/0/24  10,20,30,99

Port      Vlans in spanning tree forwarding state and not pruned
Gi1/0/24  10,20,30

What it means:
- "Mode on" = manually-configured trunk (no DTP). "Encapsulation
  802.1q" = standard tagging.
- "Native vlan 99" = untagged frames on the trunk land in VLAN 99.
- "Vlans allowed" = configured permission. "active" = exists in
  VLAN database. "forwarding" = passing traffic right now.
- Mismatched native VLANs cause an immediate %SPANTREE-2-PVSTSIM
  warning at the upstream switch.` },

  { cmd: 'show interfaces switchport',
    example: `Switch# show interfaces switchport

Name: Gi1/0/24
Switchport: Enabled
Administrative Mode: trunk
Operational Mode: trunk
Administrative Trunking Encapsulation: dot1q
Negotiation of Trunking: Off
Access Mode VLAN: 1 (default)
Trunking Native Mode VLAN: 99 (PRUNE-LIST)
Administrative Native VLAN tagging: enabled
Voice VLAN: none
Trunking VLANs Enabled: 10,20,30,99
Pruning VLANs Enabled: 2-1001
Capture Mode: Disabled

What it means:
- One block per L2-capable port. Combines admin (configured) and
  operational (actual) state.
- "Negotiation of Trunking: Off" = DTP disabled — required by
  most enterprise security baselines.
- "Pruning VLANs" = VLANs eligible for VTP pruning to reduce
  unnecessary broadcast traffic.` },

  { cmd: 'show interfaces counters errors',
    example: `Switch# show interfaces counters errors

Port      Align-Err  FCS-Err  Xmit-Err  Rcv-Err  UnderSize  OutDiscards
Gi1/0/1   0          12       0         12       0          0
Gi1/0/2   0          0        0         0        0          0
Gi1/0/24  0          0        0         0        0          0

Port      Single-Col  Multi-Col  Late-Col  Excess-Col  Carri-Sen  Runts  Giants
Gi1/0/1   0           0          0         0           0          0      0
Gi1/0/2   0           0          0         0           0          0      0

What it means:
- All-port error summary. Quick triage tool for physical-layer
  problems.
- FCS-Err / Align-Err > 0 = bit errors on the wire. Replace cable
  / clean fibre / verify SFP seating.
- Late-Col / Excess-Col > 0 = duplex mismatch.
- Multi-Col / Single-Col on full-duplex ports = should always be 0;
  non-zero means the port is in half-duplex.` },

  { cmd: 'show interfaces transceiver detail',
    example: `Switch# show interfaces transceiver detail

Transceiver monitoring is enabled for all interfaces.

If device is externally calibrated, only calibrated values are printed.
++ : high alarm, +  : high warning, -  : low warning, -- : low alarm.
NA or N/A: not applicable, Tx: transmit, Rx: receive.
mA: milliamperes, dBm: decibels (milliwatts).

                                       Optical   Optical
              Temperature  Voltage  Tx Power  Rx Power
Port          (Celsius)    (Volts)  (dBm)    (dBm)
---------     -----------  -------  -------- ----------
Gi1/0/24      32.4         3.31     -3.5     -7.2
Te1/0/1       45.2         3.30     -2.1     -8.4 -

What it means:
- Per-port transceiver telemetry. "-" / "+" indicate threshold
  crossings.
- Rx Power "-" warning means signal is weak — fibre dirty, bend
  too tight, distance too long, or far-end transmitter weak.
- Temperature > 70°C = airflow problem; check fans and ambient.
- Tx Power should be near the SFP datasheet value (~-3 dBm typical
  for 1000BASE-LX, ~-2 dBm for 10GBASE-LR).` },

  { cmd: 'show interfaces vlan',
    example: `R1# show interfaces vlan 10

Vlan10 is up, line protocol is up
  Hardware is Ethernet SVI, address is 0c0c.dead.beef
  Internet address is 10.10.0.1/24
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
     reliability 255/255, txload 1/255, rxload 1/255
  Encapsulation ARPA, loopback not set
  ARP type: ARPA, ARP Timeout 04:00:00
  Last input 00:00:01, output 00:00:00, output hang never
  Last clearing of "show interface" counters never
  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0

What it means:
- SVI (Switched Virtual Interface) — the L3 logical interface for
  a VLAN. State follows whether at least one access port in the
  VLAN is up + the VLAN exists in the database.
- "BW 1000000 Kbit/sec" = 1 Gbps default for SVIs (hardcoded;
  doesn't reflect real port speed).
- "Output drops 0" — increases here = QoS or buffer exhaustion
  on the SVI.` },

  { cmd: 'show interfaces summary',
    example: `Switch# show interfaces summary

 *: interface is up
 IHQ: pkts in input hold queue     IQD: pkts dropped from input queue
 OHQ: pkts in output hold queue    OQD: pkts dropped from output queue
 RXBS: rx rate (bits/sec)          RXPS: rx rate (pkts/sec)
 TXBS: tx rate (bits/sec)          TXPS: tx rate (pkts/sec)
 TRTL: throttle count

  Interface             IHQ   IQD  OHQ   OQD  RXBS RXPS TXBS TXPS TRTL
* GigabitEthernet0/0    0     0    0     0    9000 12   45000 35    0
* GigabitEthernet0/1    0     0    0     0    180000 200 24000 30   0
  GigabitEthernet0/2    0     0    0     0    0      0   0     0    0

What it means:
- Per-interface byte/packet rates and queue stats in one table.
- Quick spot of bandwidth hogs and dropped queues.
- IQD/OQD > 0 = queue exhaustion. Look at QoS policy or upgrade
  link speed.
- "*" = interface is up; no "*" = down/admin-down.` },

  { cmd: 'show interfaces accounting',
    example: `Switch# show interfaces accounting Gi0/0

GigabitEthernet0/0
  Protocol           Pkts In   Chars In   Pkts Out   Chars Out
  Other              50        21000      40         18000
  IP                 12,453,012  9.8 GB   12,490,000  10.1 GB
  ARP                4,502     360,160    4,500       360,000
  STP                14,503    1.16 MB    0           0

What it means:
- Per-protocol packet/byte counters since last "clear counters".
- Useful for protocol-distribution analysis.
- "Other" usually = ICMP, IGMP, internal control traffic.
- Disable globally if not needed: "no ip accounting-list" — small
  CPU saving on busy boxes.` },

  { cmd: 'show interfaces <int> transceiver detail',
    example: `Switch# show interfaces gi1/0/24 transceiver detail

GigabitEthernet1/0/24:
  Transceiver type: 1000BASE-LX
  Vendor:           CISCO-FINISAR
  Vendor part num:  FTLF1318P3BTL-CS
  Vendor serial:    FNS192410AC
  Wavelength:       1310 nm

  Temperature   Voltage   Tx Power   Rx Power
  (Celsius)    (Volts)   (dBm)     (dBm)
  32.4         3.31      -3.5       -7.2

  Thresholds:
  Temperature  Vcc      Tx Power  Rx Power
  -10/+85      3.0/3.6  -9.5/-3.0 -23/-3.0

What it means:
- Per-port transceiver data — DDM (Digital Diagnostic Monitoring).
- Compare current values against the threshold ranges. "-3.5 dBm Tx"
  is at the low warning of -9.5/-3.0.
- "Vendor part num" + "serial" : useful for warranty / RMA cases.
- 1310 nm wavelength = single-mode fibre (LX/LH SFP).` },

  { cmd: 'show mac address-table interface <int>',
    example: `Switch# show mac address-table interface gi1/0/1

          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 10     001a.1e11.2233    DYNAMIC     Gi1/0/1
 10     001a.1e44.5566    DYNAMIC     Gi1/0/1
 20     001a.1e77.8899    DYNAMIC     Gi1/0/1

Total Mac Addresses for this criterion: 3

What it means:
- All MAC addresses learned on the named port.
- Multiple MACs per port = port is a trunk OR a downstream
  switch / IP phone with PC behind it.
- DYNAMIC = learned from observed frames. STATIC = manually
  configured / sticky. SECURE = learned via port-security.
- Empty list on an active port = bad cabling or upstream device
  isn't transmitting.` },

  { cmd: 'show interfaces <int> counters etherchannel',
    example: `Switch# show interfaces gi1/0/1 counters etherchannel

Port        InOctets         InUcastPkts   InMcastPkts   InBcastPkts
Gi1/0/1     12,045,302       142,012       4,502         12

Port        OutOctets        OutUcastPkts  OutMcastPkts  OutBcastPkts
Gi1/0/1     31,890,142       890,012       12,003        45

What it means:
- Counters specific to the port's role within an EtherChannel
  bundle.
- "InMcastPkts" / "InBcastPkts" should be similar across all
  members of the bundle (same broadcast traffic seen on all ports)
  — large differences indicate hash imbalance.
- Use to verify the channel is actually load-balancing instead of
  hashing all flows to one port.` },

  { cmd: 'clear counters <int>',
    example: `Switch# clear counters gi1/0/1

Clear "show interface" counters on this interface [confirm]

Switch# show interfaces gi1/0/1 | include packets
     0 packets input, 0 bytes, 0 no buffer
     0 packets output, 0 bytes, 0 underruns

What it means:
- Resets all packet / byte / error counters on the named interface
  to zero.
- Useful before reproducing an issue — establishes a clean baseline.
- "clear counters" with no interface clears ALL interfaces.
- Does NOT affect counter accumulation in NetFlow / SNMP MIBs;
  only the locally-displayed counters.` },

  { cmd: 'test cable-diagnostics tdr interface <int>',
    example: `Switch# test cable-diagnostics tdr interface gi1/0/1

TDR test started on interface Gi1/0/1
A TDR test can take a few seconds to run on an interface
Use 'show cable-diagnostics tdr' to read the TDR results.

Switch# show cable-diagnostics tdr interface gi1/0/1
TDR test last run on: May  1 11:22:18.123
Interface Speed   Local pair  Pair length  Remote pair  Pair status
Gi1/0/1   1000Mb  1-2         32 m  +/- 4  3-6          Normal
                  3-6         32 m  +/- 4  1-2          Normal
                  4-5         32 m  +/- 4  7-8          Normal
                  7-8         32 m  +/- 4  4-5          Normal

What it means:
- TDR (Time-Domain Reflectometry) sends a pulse down each twisted
  pair and times the reflection.
- "Normal" + length consistent across pairs = healthy cable.
- "Open" : break in cable at the reported length.
- "Short" : two pairs shorted together.
- "Impedance Mismatch" : connector/cable defect.` },

  { cmd: 'interface range <range>\n description <text>\n switchport mode access\n switchport access vlan <id>',
    example: `Switch(config)# interface range gi1/0/1 - 24
Switch(config-if-range)# description User-Access-Ports
Switch(config-if-range)# switchport mode access
Switch(config-if-range)# switchport access vlan 10
Switch(config-if-range)# spanning-tree portfast
Switch(config-if-range)# spanning-tree bpduguard enable
Switch(config-if-range)# no shutdown

What it means:
- "interface range" applies the same config to multiple ports at
  once — saves typing on switch deployments.
- Range format: "gi1/0/1 - 24" = ports 1 through 24 on switch 1
  module 0.
- "switchport mode access" forces the port to be untagged
  (single-VLAN); without this, the port might auto-negotiate to
  a trunk via DTP (security risk).
- Combine portfast + bpduguard on access ports — fast STP up plus
  protection if a switch is plugged in.` },

  { cmd: 'show interfaces counters',
    example: `Switch# show interfaces counters

Port      InOctets         InUcastPkts   InMcastPkts  InBcastPkts
Gi1/0/1   12,045,302       142,012       4,502        12
Gi1/0/24  890,123,456      8,901,234     142,003      4

Port      OutOctets        OutUcastPkts  OutMcastPkts OutBcastPkts
Gi1/0/1   31,890,142       890,012       12,003       45
Gi1/0/24  1,245,678,901    12,400,123    412,012      120

What it means:
- All-port traffic counters. RX vs TX byte/packet split per port.
- High broadcast / multicast on a user-access port = possible
  L2 loop or misconfigured client.
- Compare aggregate uplink throughput to capacity — sustained
  >70% utilisation is a planning trigger.` },

  { cmd: 'show power inline',
    example: `Switch# show power inline

Available:740.0(w)  Used:142.0(w)  Remaining:598.0(w)

Interface Admin  Oper       Power   Device              Class Max
                            (Watts)
--------- ------ ---------- ------- ------------------- ----- ----
Gi1/0/1   auto   on         15.4    IP-Phone-7945       3     30.0
Gi1/0/2   auto   on         7.0     AP-CB1042I          1     15.4
Gi1/0/3   auto   off        0.0     n/a                 n/a   30.0

What it means:
- PoE power budget. "Available" = total PSU PoE capacity.
- "Class" 0-4 follows IEEE 802.3af/at convention:
  - Class 1: 4W, Class 2: 7W, Class 3: 15.4W, Class 4: 30W (PoE+),
  - "Class 6/7/8" : UPOE (60W/90W/100W) on supporting platforms.
- "Used / Remaining" : monitor before adding new PDs to avoid
  PoE budget exhaustion.` },

  { cmd: 'show interfaces <int> controller',
    example: `Switch# show interfaces gi1/0/1 controller

Interface gi1/0/1, Hardware: BCM5616 ASIC, address: 001a.1e11.2233
Description: User-Access
MTU: 1500, BW: 1000Mbps, Speed: 1000Mbps, Duplex: Full
Driver: ucs-ether
RX queues: 2, TX queues: 4
Statistics:
  RX: 12,045,302 packets, 12,402,045,123 bytes
  RX dropped: 0
  TX: 8,901,234 packets, 5,123,400,000 bytes
  TX dropped: 0
  Misses: 0

What it means:
- Low-level controller-specific data. Useful for hardware-vendor
  troubleshooting or matching driver versions.
- "Misses" = times the ASIC couldn't queue a packet (buffer
  exhaustion). > 0 = capacity issue.
- "Driver: ucs-ether" identifies the IOS driver name for support
  case correlation.` },

  { cmd: 'show spanning-tree inconsistentports',
    example: `Switch# show spanning-tree inconsistentports

Name                 Interface              Inconsistency
-------------------- ---------------------- ------------------
VLAN0010             GigabitEthernet1/0/24  Type Inconsistent
VLAN0010             GigabitEthernet1/0/24  PVID Inconsistent

Number of inconsistent ports (segments) in the system : 2

What it means:
- Lists ports STP put into BLOCKING due to a detected inconsistency.
- "Type Inconsistent" : trunk on one end, access on the other
  (configuration mismatch).
- "PVID Inconsistent" : different native VLANs on the two ends
  of the trunk.
- These are *guard* mechanisms: STP refuses to forward to prevent
  a loop. Fix the config mismatch and the port recovers.` },

  { cmd: 'show ip interface brief | exclude unassigned',
    example: `R1# show ip interface brief | exclude unassigned

Interface              IP-Address      OK?  Method  Status                Protocol
GigabitEthernet0/0     10.10.10.1      YES  manual  up                    up
GigabitEthernet0/1     198.51.100.5    YES  manual  up                    up
Loopback0              1.1.1.1         YES  manual  up                    up

What it means:
- Hides interfaces with no IP assigned (which would otherwise
  flood the output on a busy switch).
- "Method manual" : statically configured via "ip address".
  Other methods: DHCP, NVRAM (unrolled from startup), TFTP.
- Most-used quick-status command for L3 interfaces.` },

  { cmd: 'show controllers Te0/0/0 phy detail',
    example: `Router# show controllers Te0/0/0 phy detail

TenGigabitEthernet0/0/0 - 10G PHY: Marvell 88X2042
PHY status:
  Mode: 10GBASE-LR
  Operating temperature: 42 C
  Link status: up
  Auto-negotiation: completed
  Power level: -2.4 dBm Tx, -5.7 dBm Rx
  CRC errors: 12
  Symbol errors: 0
  Frame loss seconds: 0

What it means:
- Per-PHY detail for 10G/40G/100G interfaces. Shows transceiver
  status from the silicon's point of view.
- "CRC errors" / "Symbol errors" climbing > 0 = physical-layer
  issues (cable, transceiver, fibre dirty).
- Power levels should match SFP datasheet ranges; "low Rx" warns
  of weak signal.` },

  { cmd: 'interface range Gi1/0/1-24',
    example: `Switch(config)# interface range Gi1/0/1 - 24

Switch(config-if-range)# description User-Access-Ports
Switch(config-if-range)# switchport mode access
Switch(config-if-range)# switchport access vlan 10

What it means:
- Selects a range of interfaces for bulk configuration.
- Range syntax: "Gi1/0/1 - 24" (with spaces around the hyphen) for
  contiguous ports, or comma-separated lists: "Gi1/0/1, Gi1/0/3, Gi1/0/5".
- All commands within (config-if-range) apply to every interface
  in the selection.` },

  { cmd: 'interface Gi1/0/1\n description UPLINK\n switchport mode access\n switchport access vlan 10\n no shutdown',
    example: `Switch(config)# interface Gi1/0/1
Switch(config-if)# description UPLINK
Switch(config-if)# switchport mode access
Switch(config-if)# switchport access vlan 10
Switch(config-if)# no shutdown

Switch# show running-config interface Gi1/0/1
interface GigabitEthernet1/0/1
 description UPLINK
 switchport access vlan 10
 switchport mode access
 no shutdown
end

What it means:
- Standard access-port template for a user device on VLAN 10.
- "no shutdown" : last step — interface comes online once L1/L2 is
  ready.
- Add "spanning-tree portfast" + "spanning-tree bpduguard enable"
  for production access ports (skip STP delay + protect from
  rogue switches).` },

  { cmd: 'interface Gi1/0/24\n description TRUNK\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30\n switchport trunk native vlan 99',
    example: `Switch(config)# interface Gi1/0/24
Switch(config-if)# description TRUNK
Switch(config-if)# switchport mode trunk
Switch(config-if)# switchport trunk allowed vlan 10,20,30
Switch(config-if)# switchport trunk native vlan 99
Switch(config-if)# switchport nonegotiate

Switch# show interfaces Gi1/0/24 trunk | head -3
Port      Mode  Encapsulation  Status        Native vlan
Gi1/0/24  on    802.1q         trunking      99

What it means:
- Standard trunk template — three data VLANs + a "dummy" native
  VLAN (99) so untagged frames don't accidentally land in a real
  user VLAN.
- "switchport nonegotiate" disables DTP — required by most
  enterprise security baselines.
- Always set "trunk allowed vlan" explicitly; default is 1-4094
  which makes it harder to track which ports carry which VLAN.` },

  { cmd: 'interface Po1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30',
    example: `Switch(config)# interface Port-channel1
Switch(config-if)# switchport mode trunk
Switch(config-if)# switchport trunk allowed vlan 10,20,30

Switch# show interfaces Po1 trunk
Port      Mode  Encapsulation  Status     Native vlan
Po1       on    802.1q         trunking   1
Po1       Vlans allowed on trunk: 10,20,30

What it means:
- L2 EtherChannel (Port-channel) interface — same trunk semantics
  as a physical interface.
- Configure trunk parameters on the Port-channel, NOT individual
  members; member ports inherit.
- Members must agree on key settings (speed, duplex, trunk mode)
  or the bundle won't form.` },

  { cmd: 'interface Gi1/0/1\n channel-group 1 mode active\n channel-protocol lacp',
    example: `Switch(config)# interface Gi1/0/1
Switch(config-if)# channel-group 1 mode active
Switch(config-if)# channel-protocol lacp

Switch(config)# interface Gi1/0/2
Switch(config-if)# channel-group 1 mode active

Switch# show etherchannel 1 summary | include 1\\s
1      Po1(SU)         LACP      Gi1/0/1(P)  Gi1/0/2(P)

What it means:
- Adds physical interfaces to channel-group 1, becoming Po1.
- "mode active" : actively send LACPDU. Pair with "active" or
  "passive" on the other end. "active+active" = fastest, safest.
- "(SU)" status = Layer-2 + In-Use. "(P)" per-member = bundled
  successfully.` },

  { cmd: 'shutdown',
    example: `R1(config)# interface gi0/1
R1(config-if)# shutdown

%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to administratively down
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down

R1# show interfaces gi0/1 | include line protocol
GigabitEthernet0/1 is administratively down, line protocol is down

What it means:
- Administratively disables the interface. Power on the port stays
  but no traffic flows.
- Reverse with "no shutdown".
- Default state on most platforms is shutdown — must explicitly
  "no shutdown" newly-configured interfaces.` },

  { cmd: 'no shutdown',
    example: `R1(config)# interface gi0/1
R1(config-if)# no shutdown

%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up

R1# show interfaces gi0/1 | include line protocol
GigabitEthernet0/1 is up, line protocol is up

What it means:
- Brings the interface administratively up. L1/L2 negotiation runs;
  "line protocol up" confirms the data link is operational.
- "no shutdown" with no L1 = "interface is up, line protocol is
  down" (admin up, but cable/transceiver problem).` },

  { cmd: 'speed 1000',
    example: `R1(config-if)# speed 1000

R1# show interfaces gi0/1 | include speed
  Auto Speed (1000 Mbps), 1000BaseTX, link type is auto, media type is RJ45

What it means:
- Forces 1 Gbps. Other values: 10, 100, 1000, 10000, auto.
- Use "auto" unless you have a specific reason — modern equipment
  negotiates correctly.
- Hardcoding speed disables auto-negotiation on some platforms;
  if you hardcode, hardcode duplex too.` },

  { cmd: 'duplex full',
    example: `R1(config-if)# duplex full

R1# show interfaces gi0/1 | include duplex
  Full-duplex, 1000Mb/s, link type is force-up, media type is RJ45

What it means:
- Forces full-duplex (simultaneous TX + RX). The default and only
  reasonable choice for switch-to-switch / switch-to-router links.
- "half-duplex" exists for legacy hub connections — extremely
  rare in modern networks.
- Mismatched duplex = late collisions on the half-duplex side and
  silent packet loss.` },

  { cmd: 'mtu 9216',
    example: `R1(config-if)# mtu 9216

R1# show interfaces gi0/0 | include MTU
  MTU 9216 bytes, BW 1000000 Kbit/sec, DLY 10 usec,

What it means:
- Sets jumbo-frame MTU (max payload). 9216 = 9000 byte payload +
  jumbo Ethernet header overhead.
- All devices on the L2 segment MUST support the same MTU,
  otherwise larger frames are silently dropped.
- Common values: 1500 (standard), 9000 (jumbo), 9216 (max jumbo).
- Per-protocol MTU may differ: "ip mtu 9000" sets just the IP
  payload limit on the same interface.` },

  { cmd: 'errdisable recovery cause all',
    example: `Switch(config)# errdisable recovery cause all

Switch# show errdisable recovery
ErrDisable Reason            Timer Status
-----------------            --------------
udld                         Enabled
bpduguard                    Enabled
loopback                     Enabled
psecure-violation            Enabled
... (all causes)             Enabled

What it means:
- Enables auto-recovery from any err-disable condition. Without
  this, a triggered port stays errdisabled until manual
  "shut/no shut".
- Default recovery interval = 300 seconds.
- For specific causes only: "errdisable recovery cause bpduguard".
- Best practice: enable recovery for the common causes (BPDU
  guard, security violations, UDLD), but NOT for all (some causes
  represent persistent hardware faults).` },

  { cmd: 'errdisable recovery interval 60',
    example: `Switch(config)# errdisable recovery interval 60

Switch# show errdisable recovery | include Timer
Timer interval: 60 seconds

What it means:
- Sets how long a port stays errdisabled before auto-recovery
  attempts. Default 300 sec; 60 = aggressive 1-min recovery.
- Lower = faster recovery from transient issues (e.g. switch
  briefly plugged into wrong port).
- Higher = give operator time to diagnose before port returns
  on its own.` },

  { cmd: 'show errdisable recovery',
    example: `Switch# show errdisable recovery

ErrDisable Reason            Timer Status
-----------------            --------------
udld                         Enabled
bpduguard                    Enabled
loopback                     Disabled
psecure-violation            Enabled

Timer interval: 300 seconds

Interfaces that will be enabled at the next timeout:
Interface     Errdisable reason     Time left(sec)
---------     ----------------      --------------
Gi1/0/1       bpduguard             142

What it means:
- Top: which causes trigger automatic recovery and which require
  manual intervention.
- Bottom: ports CURRENTLY errdisabled and seconds until they
  re-enable.
- "Disabled" causes (loopback above) leave the port errdisabled
  permanently — operator must manually intervene.` },

  { cmd: 'ipv6 address ipv6-address/prefix-length',
    example: `R1(config)# interface gi0/0
R1(config-if)# ipv6 address 2001:db8:1::1/64
R1(config-if)# ipv6 enable

R1# show ipv6 interface brief gi0/0
GigabitEthernet0/0     [up/up]
    FE80::1
    2001:DB8:1::1

What it means:
- Adds a global-scope IPv6 address. "/64" is the de-facto standard
  IPv6 LAN prefix length.
- "ipv6 enable" enables IPv6 processing AND auto-configures a
  link-local (FE80::*) address — required for any IPv6
  functionality.
- Multiple IPv6 addresses per interface are normal: link-local +
  one or more global-scope addresses.` },

  { cmd: 'errdisable recovery interval time-seconds',
    example: `Switch(config)# errdisable recovery interval 120

Switch# show errdisable recovery | include interval
Timer interval: 120 seconds

What it means:
- Generic syntax for setting recovery interval. Range: 30-86400
  seconds (30 sec to 24 hours).
- Same setting as "errdisable recovery interval 60" above; 120 sec
  is a common compromise between fast recovery and operator
  reaction time.` },

  { cmd: 'interface <type> <number>',
    example: `R1(config)# interface GigabitEthernet 0/0
R1(config-if)#

R1(config)# interface vlan 10
R1(config-if)#

R1(config)# interface loopback 0
R1(config-if)#

What it means:
- Generic syntax for entering an interface configuration mode.
- Common types: GigabitEthernet, TenGigE, Loopback, Vlan, Tunnel,
  Port-channel, Serial.
- Shorthand abbreviations work: "int gi0/0" = "interface
  GigabitEthernet0/0".` },

  { cmd: 'interface range <type> <start> - <end>',
    example: `Switch(config)# interface range GigabitEthernet 1/0/1 - 24

Switch(config-if-range)# description User-Access
Switch(config-if-range)# switchport mode access

What it means:
- Generic syntax for selecting a contiguous range of interfaces.
- Saves significant config volume on switch deployments —
  configure 24 ports in one block.
- Spaces around the hyphen ARE required: "1/0/1 - 24" not "1/0/1-24".
- Mix and match multiple ranges: "interface range gi1/0/1 - 12,
  gi1/0/24" combines both.` },

  { cmd: 'description <text>',
    example: `R1(config)# interface gi0/0
R1(config-if)# description WAN-uplink-to-ISP-A_circuit_12345

R1# show interfaces gi0/0 | include Description
  Description: WAN-uplink-to-ISP-A_circuit_12345

What it means:
- Free-form description (max 240 chars). Visible in show output
  and SNMP "ifAlias".
- Best practice: include circuit ID, peer device name, link role —
  saves time during incident response.
- Avoid spaces if you'll grep it later; underscores or hyphens
  are easier to filter.` },

  { cmd: 'switchport mode access',
    example: `Switch(config-if)# switchport mode access

Switch# show interfaces gi1/0/1 switchport | include Mode
Administrative Mode: static access
Operational Mode: static access

What it means:
- Forces a single-VLAN access port. Untagged frames only.
- Disables DTP negotiation — port won't accidentally become a
  trunk because someone connected a switch.
- Always set this explicitly on user-facing ports; relying on
  default ("dynamic auto") is a security weakness.` },

  { cmd: 'switchport access vlan <id>',
    example: `Switch(config-if)# switchport access vlan 10

Switch# show interfaces gi1/0/1 switchport | include Access
Access Mode VLAN: 10 (DATA)

What it means:
- Assigns the access port to VLAN 10. All untagged ingress is
  classified as VLAN 10; VLAN 10 frames are sent untagged.
- VLAN must already exist in the VLAN database (or "vlan 10
  name DATA" gets auto-created on most modern IOS).
- Pair with "voice vlan N" to make this a "data + voice" port for
  IP phones.` },

  { cmd: 'switchport mode trunk',
    example: `Switch(config-if)# switchport mode trunk

Switch# show interfaces gi1/0/24 switchport | include Mode
Administrative Mode: trunk
Operational Mode: trunk

What it means:
- Forces 802.1q trunk mode. Frames carry VLAN tags except for the
  native VLAN.
- Disables DTP — required by most enterprise security baselines.
- Pair with "switchport trunk allowed vlan" to restrict the trunk
  to specific VLANs.` },

  { cmd: 'switchport trunk allowed vlan <vlan-list>',
    example: `Switch(config-if)# switchport trunk allowed vlan 10,20,30

Switch# show interfaces gi1/0/24 trunk | include 10,20,30
Gi1/0/24  Vlans allowed on trunk: 10,20,30

# Add to existing list (don't overwrite):
Switch(config-if)# switchport trunk allowed vlan add 40

# Remove specific:
Switch(config-if)# switchport trunk allowed vlan remove 20

What it means:
- Restricts which VLANs traverse the trunk. Default: 1-4094 (all).
- Use "add" / "remove" to modify without re-typing the full list.
- Best practice: explicit list per trunk — easier to track which
  VLANs each link carries during incident response.` },

  { cmd: 'switchport trunk native vlan <id>',
    example: `Switch(config-if)# switchport trunk native vlan 99

Switch# show interfaces gi1/0/24 trunk | head -3
Port      Mode  Encapsulation  Status     Native vlan
Gi1/0/24  on    802.1q         trunking   99

What it means:
- The native VLAN carries untagged traffic on a trunk. Both ends
  must agree.
- Best practice: use a dummy unused VLAN (here 99) for native —
  prevents untagged management/control traffic from accidentally
  flooding into a user data VLAN.
- Enable "vlan dot1q tag native" globally to force tagging of
  native VLAN traffic for additional security.` },

  { cmd: 'switchport nonegotiate',
    example: `Switch(config-if)# switchport nonegotiate

Switch# show interfaces gi1/0/24 switchport | include Negotiation
Negotiation of Trunking: Off

What it means:
- Disables DTP (Dynamic Trunking Protocol). Port will NOT
  advertise itself or react to negotiation messages.
- Required step in security hardening — prevents an attacker
  plugging into an access port and forming a rogue trunk.
- Run on every access port AND on every manually-configured
  trunk.` },

  { cmd: 'speed <10|100|1000|auto>',
    example: `R1(config-if)# speed auto                ! recommended
R1(config-if)# speed 1000                ! force 1 Gbps
R1(config-if)# speed 100 100             ! preferred 100, fallback 100

What it means:
- Forces a specific link speed. "auto" lets the PHY negotiate.
- 99% of deployments should use "auto" — modern equipment
  negotiates correctly.
- Hardcode only when peer doesn't support auto-negotiation
  (extremely rare on modern gear).
- If you hardcode speed, also hardcode duplex.` },

  { cmd: 'duplex <full|half|auto>',
    example: `R1(config-if)# duplex auto              ! recommended
R1(config-if)# duplex full               ! force full-duplex

What it means:
- Default is "auto". "full" = simultaneous TX/RX (modern); "half"
  = legacy hub-style.
- Mismatched duplex = late collisions, silent packet loss.
- Hardcode only if peer doesn't auto-negotiate.` },

  { cmd: 'spanning-tree portfast',
    example: `Switch(config-if)# spanning-tree portfast

%Warning: portfast should only be enabled on ports connected to a single
host. Connecting hubs, concentrators, switches, bridges, etc... to this
interface when portfast is enabled, can cause temporary bridging loops.

What it means:
- Skips the listening + learning STP states. Port goes straight
  from BLOCKING to FORWARDING when link comes up.
- Saves ~30 sec on user-port boot — important for DHCP / PXE.
- ONLY use on edge ports facing PCs / phones / printers — NEVER
  on switch-to-switch links.
- Pair with "spanning-tree bpduguard enable" to err-disable the
  port if a switch is accidentally plugged in.` },

  { cmd: 'spanning-tree bpduguard enable',
    example: `Switch(config-if)# spanning-tree bpduguard enable

# If a switch is plugged into this port:
%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port Gi1/0/1 with BPDU Guard enabled.
                              Disabling port.
%PM-4-ERR_DISABLE: bpduguard error detected on Gi1/0/1, putting Gi1/0/1
                   in err-disable state

What it means:
- If ANY BPDU arrives on this port, immediately err-disable it.
- Stops a rogue switch from joining STP via this port (risk: it
  could become root and reroute traffic).
- Recover via "shut/no shut" or auto-recovery if configured.
- Always pair with "spanning-tree portfast" on access ports.` },

  { cmd: 'storm-control broadcast level <percent>',
    example: `Switch(config-if)# storm-control broadcast level 10
Switch(config-if)# storm-control multicast level 30
Switch(config-if)# storm-control action shutdown

# When broadcast traffic exceeds 10% of interface bandwidth:
%STORM_CONTROL-3-FILTERED: A Broadcast storm detected on Gi1/0/1.
                            A packet filter action has been applied.

What it means:
- Rate-limits broadcast / multicast / unknown-unicast traffic to
  the named percentage of link capacity.
- Action options: filter (default — drop excess), shutdown
  (errdisable port), trap (snmp notify only).
- Critical on edge switch ports — a BUM storm on one port can
  consume the entire fabric without storm-control.` },

  { cmd: 'mtu <bytes>',
    example: `R1(config-if)# mtu 9000

R1# show interfaces gi0/0 | include MTU
  MTU 9000 bytes, BW 1000000 Kbit/sec

What it means:
- Sets MTU at the L2 layer. 1500 = standard, 9000 = jumbo, 9216 =
  max jumbo on most platforms.
- All devices on the same L2 segment must agree on MTU. Mismatch
  = silent drops of larger frames.
- For IP-only MTU control, use "ip mtu N" — affects only the IP
  payload limit and doesn't cascade to other L2 protocols.` },

  { cmd: 'carrier-delay msec 0',
    example: `R1(config-if)# carrier-delay msec 0

R1# show interfaces gi0/1 | include Carrier
  Carrier delay is 0 msec

What it means:
- Time the router waits after a link-down event before declaring
  the line protocol down. Default = 2 sec.
- "msec 0" = react immediately — important on routing-protocol
  links where 2 sec of perceived UP after a real failure adds
  to convergence time.
- Pair with BFD for sub-second failure detection on critical
  L3 links.` },

  // ============== Switching & STP ==============
  { cmd: 'show spanning-tree summary',
    example: `Switch# show spanning-tree summary

Switch is in rapid-pvst mode
Root bridge for: VLAN0001, VLAN0010, VLAN0020
Extended system ID                      is enabled
Portfast Default                        is disabled
PortFast BPDU Guard Default             is disabled
Portfast BPDU Filter Default            is disabled
Loopguard Default                       is disabled
EtherChannel misconfig guard            is enabled
UplinkFast                              is disabled
BackboneFast                            is disabled
Configured Pathcost method used is short

Name        Blocking Listening Learning Forwarding STP Active
VLAN0001    0        0         0         8          8
VLAN0010    0        0         0         12         12
VLAN0020    1        0         0         11         12
----------  -------- --------- --------- ---------- ----------
3 vlans     1        0         0         31         32

What it means:
- One-line-per-VLAN STP state summary.
- "Forwarding" = passing traffic. "Blocking" = STP put it into
  blocking to prevent loops.
- "Root bridge for: VLAN0001..." = this switch is root for those
  VLANs.
- mode "rapid-pvst" : RSTP per VLAN (Cisco default on Catalyst).` },

  { cmd: 'show spanning-tree blockedports',
    example: `Switch# show spanning-tree blockedports

Name                 Blocked Interfaces List
-------------------- ------------------------------------
VLAN0020             Gi1/0/24
VLAN0030             Gi1/0/24

Number of blocked ports (segments) in the system: 2

What it means:
- Quickly lists ports STP is blocking — helps spot redundancy
  paths and confirm STP topology is what you expect.
- A port appearing in multiple VLANs (Gi1/0/24 above) is a trunk
  blocking for some VLANs but possibly forwarding for others
  (PVST / RPVST per-VLAN root).` },

  { cmd: 'show spanning-tree mst',
    example: `Switch# show spanning-tree mst

##### MST0    vlans mapped:   1-9,11-19,21-4094
Bridge        address 0050.5612.3456  priority      32768 (32768 sysid 0)
Root          this switch for the CIST

Interface       Role Sts Cost      Prio.Nbr Type
--------------- ---- --- --------- -------- --------------------------------
Gi1/0/1         Desg FWD 200000    128.1    P2p
Gi1/0/24        Desg FWD 20000     128.24   P2p

##### MST1    vlans mapped:   10
Bridge        address 0050.5612.3456  priority      24586 (24576 sysid 10)
Root          this switch for MST1

What it means:
- MSTP (Multiple Spanning Tree) reduces STP overhead by mapping
  multiple VLANs to a single instance.
- "MST0" : default instance — every VLAN not mapped elsewhere.
- "vlans mapped: 10" on MST1 : only VLAN 10 in this instance.
- "Role Desg" / "Sts FWD" : designated, forwarding (healthy).` },

  { cmd: 'show etherchannel load-balance',
    example: `Switch# show etherchannel load-balance

EtherChannel Load-Balancing Configuration:
        src-dst-ip

EtherChannel Load-Balancing Addresses Used Per-Protocol:
Non-IP: Source XOR Destination MAC address
  IPv4: Source XOR Destination IP address
  IPv6: Source XOR Destination IP address

What it means:
- Hash algorithm used to distribute flows across bundle members.
- "src-dst-ip" : symmetric hashing of source + destination IPs.
  Ensures bidirectional traffic of one flow stays on the same
  member port.
- Other options: src-mac, dst-mac, src-dst-mac, src-port,
  dst-port, src-dst-port (L4 hashing).
- Use src-dst-ip for routed traffic, src-dst-mac for L2-only
  switching.` },

  { cmd: 'show mac address-table address 0050.5612.3456',
    example: `Switch# show mac address-table address 0050.5612.3456

          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 10     0050.5612.3456    DYNAMIC     Gi1/0/1

What it means:
- Locates a specific MAC in the L2 forwarding table — critical
  for "where is this device plugged in?" investigations.
- Use after "arp -a" on Windows or "ip neigh" on Linux to track
  a complaining user's MAC back to a switch port.
- DYNAMIC = learned from traffic. Consider sticky / static for
  known devices that should never move.` },

  { cmd: 'show mac address-table dynamic vlan 10',
    example: `Switch# show mac address-table dynamic vlan 10

          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 10     0050.5612.3456    DYNAMIC     Gi1/0/1
 10     0050.5612.3457    DYNAMIC     Gi1/0/2
 10     001a.1e11.2233    DYNAMIC     Gi1/0/24

Total Mac Addresses for this criterion: 3

What it means:
- All dynamically-learned MACs in VLAN 10 — a per-VLAN census.
- Useful for capacity planning (how many devices in each VLAN)
  and investigating broadcast/multicast bursts.
- Compare with "show mac address-table count" for aggregate
  numbers per VLAN.` },

  { cmd: 'show mac address-table count',
    example: `Switch# show mac address-table count

Mac Entries for Vlan : 1
---------------------------
Dynamic Address Count    : 4
Static Address Count     : 0
Total Mac Addresses      : 4

Mac Entries for Vlan : 10
---------------------------
Dynamic Address Count    : 142
Static Address Count     : 2
Total Mac Addresses      : 144

Total Mac Address Space Available: 16384

What it means:
- Per-VLAN MAC count + global capacity.
- "Total Mac Address Space Available" : remaining capacity. On
  Catalyst 3850/9300 typical limit is 32k.
- A single VLAN consuming most of the table = potential L2 loop
  or excessive broadcast domain.` },

  { cmd: 'spanning-tree mode rapid-pvst',
    example: `Switch(config)# spanning-tree mode rapid-pvst

Switch# show spanning-tree summary | include mode
Switch is in rapid-pvst mode

What it means:
- Rapid PVST+ (RPVST+) : Cisco's per-VLAN RSTP. Default on most
  Catalyst since the early 2000s.
- Fast convergence (< 1 sec on properly-configured port roles)
  vs classic STP's 30-50 sec.
- Other options: pvst (legacy classic STP per VLAN), mst (Multiple
  STP for large environments).` },

  { cmd: 'spanning-tree portfast bpduguard default',
    example: `Switch(config)# spanning-tree portfast bpduguard default

# Now any port with portfast also has bpduguard:
Switch(config)# interface gi1/0/1
Switch(config-if)# spanning-tree portfast
%Warning: BPDU guard is automatically enabled on this port

What it means:
- Globally enables BPDU guard on ALL portfast-enabled ports.
- One-shot config: don't have to remember "spanning-tree
  bpduguard enable" on every access port — portfast implies it.
- Best-practice safety net for access-layer switches.` },

  { cmd: 'spanning-tree extend system-id',
    example: `Switch(config)# spanning-tree extend system-id

Switch# show spanning-tree vlan 10 | include Bridge
Bridge ID  Priority  24586 (priority 24576 sys-id-ext 10)
           Address   0050.5612.3456

What it means:
- Embeds the VLAN-ID into the STP bridge-priority field, leaving
  only the high 4 bits (multiples of 4096) settable as priority.
- Required when running PVST+ on networks with > 16 VLANs.
- Default ON in IOS 12.1+ — usually nothing to do.` },

  { cmd: 'spanning-tree vlan 1 root primary',
    example: `Switch(config)# spanning-tree vlan 1 root primary

Switch# show spanning-tree vlan 1 | head -8
VLAN0001
  Spanning tree enabled protocol rstp
  Root ID    Priority    24577
             Address     0050.5612.3456    ← this switch
             This bridge is the root

Bridge ID    Priority    24577 (priority 24576 sys-id-ext 1)
             Address     0050.5612.3456

What it means:
- Macro that lowers this switch's bridge priority to make it the
  STP root for VLAN 1.
- Sets priority to 24576 (default 32768) — low enough to win
  election against neighbours.
- For redundancy, configure another switch with "root secondary"
  (priority 28672).` },

  { cmd: 'udld aggressive',
    example: `Switch(config)# udld aggressive

# When UDLD detects a unidirectional link:
%UDLD-3-AGGRESSIVE_MODE: Port gi1/0/1 in aggressive mode does not have
                          UDLD echoes from neighbor.
%PM-4-ERR_DISABLE: udld error detected on Gi1/0/1, putting Gi1/0/1 in
                   err-disable state

What it means:
- Globally enables UDLD aggressive mode on all UDLD-capable ports.
- Aggressive mode also triggers err-disable when probing fails
  for 7 consecutive UDLD echoes (8 sec total).
- Critical on fibre links — unidirectional link is otherwise
  invisible to STP and causes silent traffic loss.
- "udld enable" (non-aggressive) only logs a syslog.` },

  { cmd: 'standby instance-id ip vip-address',
    example: `Switch(config)# interface vlan 10
Switch(config-if)# standby 1 ip 10.10.0.1
Switch(config-if)# standby 1 priority 110
Switch(config-if)# standby 1 preempt

Switch# show standby vlan 10 | include State|Priority|Virtual
  State is Active
  Priority 110 (configured 110)
  Virtual IP address is 10.10.0.1

What it means:
- HSRP (Hot Standby Router Protocol) — first-hop redundancy.
- 10.10.0.1 = the virtual IP clients use as their default gateway.
- "priority 110" + "preempt" : higher-priority router wins and
  preempts when it returns from a failure.
- One router in the pair is Active (forwards traffic), the other
  Standby (ready to take over).` },

  { cmd: 'standby instance-id preempt',
    example: `Switch(config-if)# standby 1 preempt
Switch(config-if)# standby 1 preempt delay minimum 60

What it means:
- "preempt" = higher-priority router takes over Active role when
  it comes back online (after a reboot, etc.).
- "delay minimum 60" : wait 60 sec after coming up before
  preempting — gives routing protocols time to converge so
  traffic doesn't black-hole.
- Without preempt, the surviving Standby keeps Active role even
  after the original Primary recovers.` },

  { cmd: 'standby instance-id mac-address mac-address',
    example: `Switch(config-if)# standby 1 mac-address 0000.0c07.ac01

Switch# show standby vlan 10 | include MAC
  MAC address is 0000.0c07.ac01 (configured)

What it means:
- Manually overrides the HSRP virtual MAC. Default is
  0000.0c07.acXX where XX = group-id.
- Useful when migrating from another vendor's first-hop redundancy
  protocol (VRRP, GLBP) where the virtual MAC needs to stay
  consistent so existing client ARP cache doesn't need to relearn.` },

  { cmd: 'standby instance-id ipv ip-address',
    example: `Switch(config-if)# standby 1 ipv6 autoconfig

Switch# show standby vlan 10 | include IPv6
  IPv6 link-local address is FE80::5:73FF:FEA0:1

What it means:
- HSRPv6 — the IPv6 equivalent of HSRP. "autoconfig" creates
  a link-local address based on the HSRPv6 MAC.
- Used as the default IPv6 gateway by clients via Router
  Advertisement (RA) discovery.
- Standby router takes over RA generation on failover, so
  clients don't lose connectivity.` },

  { cmd: 'standby instance-id ipv vip-address',
    example: `Switch(config-if)# standby 1 ipv6 2001:DB8:10::1/64
Switch(config-if)# standby 1 ipv6 fe80::1 link-local

Switch# show standby vlan 10 | include IPv6
  IPv6 group 1 with virtual addresses:
    2001:DB8:10::1
    FE80::1

What it means:
- Sets explicit IPv6 virtual addresses for HSRPv6.
- Both global-scope and link-local addresses can be specified.
- Clients use the link-local for first-hop routing; global for
  applications that target the gateway IP directly.` },

  { cmd: 'show spanning-tree root',
    example: `Switch# show spanning-tree root

                                        Root  Hello Max Fwd
Vlan                  Root ID            Cost  Time  Age Dly  Root Port
---------------- -------------------- --------- ----- --- --- ------------
VLAN0001         24577 0050.5612.3456         0  2     20  15 (this switch)
VLAN0010         24586 0050.5612.7777        20  2     20  15 Gi1/0/24
VLAN0020         24596 0050.5612.7777        20  2     20  15 Gi1/0/24

What it means:
- Per-VLAN root bridge identity and the local port that leads
  toward it (Root Port).
- "Root Cost" : path cost to the root. Higher = farther from
  root in the topology.
- "(this switch)" = local switch IS the root for that VLAN.
- Sanity check: root for management VLANs should be your core
  switches, not a random access switch.` },

  { cmd: 'spanning-tree pathcost method long',
    example: `Switch(config)# spanning-tree pathcost method long

Switch# show spanning-tree summary | include Pathcost
Configured Pathcost method used is long

What it means:
- "long" = 32-bit path costs, enabling fine-grained values up to
  10 Gbps and beyond. Required for any modern network.
- "short" = 16-bit (legacy). Saturates at 1 Gbps — every faster
  link gets cost 1, defeating path selection.
- Set globally; all switches in the STP region must agree.` },

  { cmd: 'spanning-tree guard root',
    example: `Switch(config)# interface gi1/0/24
Switch(config-if)# spanning-tree guard root

# If a "better" BPDU (would make peer the root) arrives:
%SPANTREE-2-ROOTGUARD_BLOCK: Root guard blocking port Gi1/0/24 on VLAN0010.

What it means:
- Prevents the connected switch from becoming the STP root.
- Use on ports facing other administrative domains (e.g. partner
  / customer switch) where you don't want their topology changes
  to alter your root.
- If a "superior" BPDU arrives, port goes into "root-inconsistent"
  blocking state — recovers automatically when the offending
  BPDU stops.` },

  { cmd: 'spanning-tree portfast default / spanning-tree portfast',
    example: `# Globally make all access ports portfast:
Switch(config)# spanning-tree portfast default

# Per-port override:
Switch(config-if)# spanning-tree portfast trunk    ! exceptional
Switch(config-if)# spanning-tree portfast disable  ! disable on this port

What it means:
- "default" globally enables portfast on every NON-trunk port.
- Overrides per-port: "spanning-tree portfast disable" if you
  want to turn it off for a specific access port (rare).
- "spanning-tree portfast trunk" : forces portfast on a trunk —
  dangerous, only use when trunk faces a server/host that won't
  generate BPDUs.` },

  { cmd: 'spanning-tree portfast bpduguard default / spanning-tree bpduguard {enable | disable}',
    example: `# Global:
Switch(config)# spanning-tree portfast bpduguard default

# Per-port override:
Switch(config-if)# spanning-tree bpduguard enable     ! force on
Switch(config-if)# spanning-tree bpduguard disable    ! force off

What it means:
- Global default + per-port override pattern.
- "spanning-tree portfast bpduguard default" : enable BPDU guard
  on every portfast port automatically.
- Per-port "enable" can force BPDU guard on a non-portfast port
  (e.g. a trunk).` },

  { cmd: 'spanning-tree bpdufilter enable / spanning-tree portfast bpdufilter default',
    example: `Switch(config-if)# spanning-tree bpdufilter enable

Switch# show spanning-tree interface gi1/0/1 | include filter
  BPDU filter is enabled

What it means:
- "bpdufilter" : do NOT send BPDUs on this port (and ignore
  received BPDUs).
- DANGEROUS — disables STP on the port. Used only on ports
  facing third parties where exchanging STP info is undesirable.
- Most environments use "bpduguard" instead, which leaves STP
  on but err-disables on rogue BPDU.` },

  { cmd: 'errdisable recovery cause bpduguard',
    example: `Switch(config)# errdisable recovery cause bpduguard
Switch(config)# errdisable recovery interval 300

Switch# show errdisable recovery
ErrDisable Reason            Timer Status
-----------------            --------------
bpduguard                    Enabled

What it means:
- Auto-recovers ports err-disabled by BPDU guard after 300 sec.
- Lets accidentally err-disabled ports come back without
  operator intervention.
- Combine with monitoring: a port that keeps cycling between
  errdisable and recovery is signalling a real problem (rogue
  switch / persistent BPDU).` },

  { cmd: 'spanning-tree loopguard default / spanning-tree guard loop',
    example: `Switch(config)# spanning-tree loopguard default

# Per-port:
Switch(config-if)# spanning-tree guard loop

# When BPDUs stop arriving on a non-designated port:
%SPANTREE-2-LOOPGUARD_BLOCK: Loop guard blocking port Gi1/0/24 on VLAN0010.

What it means:
- Detects unidirectional link failures (BPDUs stopped flowing in
  one direction). Puts the port into loop-inconsistent state.
- Critical on point-to-point links between switches — without
  loopguard, an asymmetric failure can cause STP to think a
  blocked port should now forward (loop!).
- Recovers automatically when BPDUs resume.` },

  { cmd: 'udld enable [aggressive] / udld port [aggressive]',
    example: `# Global default (only for fibre ports):
Switch(config)# udld enable

# Per-port (fibre or copper):
Switch(config-if)# udld port aggressive

Switch# show udld interface Gi1/0/24
Interface Gi1/0/24
  Port enable administrative configuration setting: Enabled / Aggressive

What it means:
- UDLD detects unidirectional links by exchanging keep-alive
  echoes between switch ports.
- "aggressive" mode err-disables the port after 7 consecutive
  failed echoes (~8 sec).
- Non-aggressive only logs a warning. Aggressive is preferred
  for fibre links.` },

  { cmd: 'show udld neighbors',
    example: `Switch# show udld neighbors

Port      Device Name      Device ID       Port-id           OperState
Gi1/0/24  switch2.corp     0050.5612.7777  Gi1/0/24          Bidirectional
Gi1/0/23  switch3.corp     0050.5612.8888  Gi1/0/23          Bidirectional

What it means:
- All ports running UDLD with their detected neighbour.
- "Bidirectional" : healthy. Both ends see each other's UDLD
  echoes.
- "Unidirectional" : only one direction is working. UDLD will
  err-disable in aggressive mode; in passive mode just logs.
- Empty line for a port = no UDLD neighbour detected.` },

  { cmd: 'show udld interface-id',
    example: `Switch# show udld Gi1/0/24

Interface Gi1/0/24
  Port enable administrative configuration setting: Enabled / Aggressive
  Port enable operational state: Enabled / Aggressive
  Current bidirectional state: Bidirectional
  Message interval: 15 sec
  Time out interval: 5 sec
  Entry 1
   Expiration time: 36 sec
   Device ID: 1
   Current neighbor state: Bidirectional
   Device name: switch2.corp
   Port ID: Gi1/0/24

What it means:
- Per-port UDLD state + neighbour detail.
- "Bidirectional" = healthy. Use to verify before sending traffic
  across a newly-installed fibre link.
- "Message interval 15s" = how often UDLD echoes are sent.
  Aggressive timeout = 5s × 3 retries.` },

  { cmd: 'spanning-tree mst configuration revision version',
    example: `Switch(config)# spanning-tree mst configuration
Switch(config-mst)# name CORP_REGION
Switch(config-mst)# revision 1
Switch(config-mst)# instance 1 vlan 10,20
Switch(config-mst)# instance 2 vlan 30,40

Switch# show spanning-tree mst configuration
Name      [CORP_REGION]
Revision  1
Instance  Vlans mapped
--------  ---------------------------------------------------------------
0         1-9,11-19,21-29,31-39,41-4094
1         10,20
2         30,40

What it means:
- Defines the MST configuration: name + revision + VLAN-to-instance
  mapping.
- ALL switches in the same MST region MUST have identical name +
  revision + VLAN mapping.
- Bumping "revision" without changing mapping silently breaks the
  region — every region member must be updated together.` },

  { cmd: 'show spanning-tree mst interface interface-id',
    example: `Switch# show spanning-tree mst interface gi1/0/24

Gi1/0/24 of MST0 is designated forwarding
Edge port: no                              (default)
Link type: point-to-point                  (auto)
Boundary: internal                         Bpdu guard enabled
Bpdus sent 4502, received 0

Instance Role  Sts  Cost      Prio.Nbr Vlans mapped
-------- ---- ---  --------- -------- -------------------
0        Desg FWD  20000     128.24   1-9,11-19,21-4094
1        Desg FWD  20000     128.24   10,20

What it means:
- Per-interface MST state across all instances.
- Same port can be Designated Forwarding for one instance and
  Backup or Alternate for another — load-balancing via MSTP.
- "Boundary: internal" = port stays inside the MST region.
  "Boundary: boundary" = port faces a different region or
  classic STP.` },

  { cmd: 'spanning-tree mst instance-number cost cost / spanning-tree mst instance-number port-priority priority',
    example: `Switch(config-if)# spanning-tree mst 1 cost 100
Switch(config-if)# spanning-tree mst 1 port-priority 64

Switch# show spanning-tree mst 1 interface gi1/0/24 | include cost
1        Desg FWD 100       64.24   10,20

What it means:
- Per-instance, per-port path cost and priority.
- Lower cost = preferred path. Lower port-priority = preferred
  port among equal-cost paths.
- Use to load-balance traffic across MST instances — VLAN 10's
  path cost 100 here means it'd prefer this port; another
  instance might have a different preference.` },

  { cmd: 'channel-group etherchannel-id mode {on | active | passive | auto | desirable} [non-silent]',
    example: `# LACP active (recommended):
Switch(config-if)# channel-group 1 mode active

# PAgP (Cisco-proprietary):
Switch(config-if)# channel-group 1 mode desirable

# Static (no negotiation):
Switch(config-if)# channel-group 1 mode on

# Mode summary:
#   active+active   = LACP (most-used, fastest negotiation)
#   passive+active  = LACP (works, slower)
#   passive+passive = NO BUNDLE (neither side starts)
#   desirable+desirable = PAgP
#   on+on           = static EtherChannel (no negotiation)
#   on+active       = NO BUNDLE (mismatch)

What it means:
- LACP modes: "active" (sends LACPDUs) vs "passive" (only replies).
- PAgP modes: "desirable" (active) vs "auto" (passive).
- "on" = manual / no protocol — both sides must be "on".
- "non-silent" : require seeing PAgP messages from the peer
  before bundling. Use on EtherChannel between two strictly-PAgP
  peers.` },

  { cmd: 'interface port-channel port-channel-id',
    example: `Switch(config)# interface port-channel 1
Switch(config-if)# switchport mode trunk
Switch(config-if)# switchport trunk allowed vlan 10,20,30
Switch(config-if)# spanning-tree guard root

Switch# show etherchannel 1 summary | head -3
Group  Port-channel  Protocol    Ports
1      Po1(SU)       LACP        Gi1/0/1(P) Gi1/0/2(P)

What it means:
- Configure trunk parameters, ACLs, descriptions on the
  Port-channel — they cascade to all member ports.
- Member ports must agree on speed, duplex, trunk mode for the
  bundle to form.
- Po1's status (SU = Layer2 + In-Use) reflects the bundle as a
  whole.` },

  { cmd: 'lacp rate fast / lacp rate slow',
    example: `Switch(config-if)# lacp rate fast

Switch# show lacp interface gi1/0/1 | include LACPDUs
LACPDUs send rate: 1 second

What it means:
- "fast" : LACPDUs every 1 second (and timeout 3 sec).
- "slow" (default) : LACPDUs every 30 seconds (timeout 90 sec).
- Use "fast" on critical core links for sub-second failure detection.
- BOTH peers must agree on rate; mismatch = bundle bounces.` },

  { cmd: 'port-channel min-linksmin-links',
    example: `Switch(config-if)# port-channel min-links 2

# When fewer than 2 LACP members are bundled, Po1 goes down:
%LINK-3-UPDOWN: Port-channel1, changed state to down

What it means:
- Sets the minimum number of bundled LACP members required for
  the Port-channel to come up.
- Default 1 — Po up with any single member working.
- Set to half-or-more of total members to ensure the bundle has
  at least the bandwidth you signed up for.` },

  { cmd: 'lacp max-bundlemax-links',
    example: `Switch(config-if)# lacp max-bundle 4

# 5 LACP members configured but only 4 in the active bundle:
Switch# show etherchannel 1 detail | include Hot|Active|Standby
   ports in Po1: 4 active, 1 standby

What it means:
- Caps the number of active LACP members in the bundle.
- Excess members are kept on standby — automatic failover when
  an active member fails.
- Useful for hardware that supports more LACP members than the
  upstream Po-channel platform allows.` },

  { cmd: 'lacp system-prioritypriority / lacp port-prioritypriority',
    example: `Switch(config)# lacp system-priority 1000

Switch(config-if)# lacp port-priority 32768

Switch# show lacp sys-id
1000, 0050.5612.3456

Switch# show lacp interface gi1/0/1 | include Priority
Local port priority: 32768

What it means:
- "system-priority" : tie-breaker between the two ends. The
  lower-priority side decides which ports become bundled.
- "port-priority" : among multiple member ports of the bundle,
  lower priority is preferred (used when "max-bundle" or
  "min-links" forces a choice).
- Defaults: system 32768, port 32768 — change if you need
  deterministic bundling order.` },

  { cmd: 'show interface port-channel port-channel-id',
    example: `Switch# show interface port-channel 1

Port-channel1 is up, line protocol is up
  Hardware is EtherChannel, address is 0050.5612.3456
  Description: TRUNK-TO-CORE
  MTU 1500 bytes, BW 2000000 Kbit/sec, DLY 10 usec
     reliability 255/255, txload 1/255, rxload 1/255
  Encapsulation ARPA, loopback not set
  No. of active members in this channel: 2

What it means:
- Aggregated stats for the bundle. "BW 2000000" = sum of member
  speeds (2 × 1 Gbps).
- "active members" = ports currently forwarding traffic.
- Counters are summed across all members (per-member counters
  via "show interface gi1/0/1").` },

  { cmd: 'show lacp neighbor [detail] / show pagp neighbor',
    example: `Switch# show lacp neighbor

                  LACP port             Admin     Oper     Port      Port
Port    Flags     Priority OperKey  Key Priority  Key      State     ID
Gi1/0/1 SA        32768    0x1      0x1   32768    0x18    0x3F      Gi1/0/1
Gi1/0/2 SA        32768    0x1      0x1   32768    0x18    0x3F      Gi1/0/2

Flags: S - Device is requesting Slow LACPDUs   F - Device is requesting Fast LACPDUs
       A - Device is in Active mode            P - Device is in Passive mode

What it means:
- Per-member view of the LACP neighbour.
- Flags "SA" = Slow rate + Active mode.
- All members of the same bundle should have the same Admin Key
  / Oper Key — mismatch = bundle won't form.` },

  { cmd: 'show lacp sys-id / show pagp sys-id',
    example: `Switch# show lacp sys-id
32768, 0050.5612.3456

# Equivalent for PAgP:
Switch# show pagp 1 internal | include MAC|sys
PAgP system identifier: 0050.5612.3456

What it means:
- The LACP "system id" = system-priority + chassis MAC.
- Identifies the LACP-speaker uniquely on the bundle.
- Chassis MAC stays the same across reboots; if it changes (RMA),
  the LACP partner sees a new system id and bundle bounces.` },

  { cmd: 'show lacp counters / show pagp counters',
    example: `Switch# show lacp counters

           LACPDUs           Marker    Marker Response  LACPDUs
Port      Sent       Recv     Sent      Recv      Sent      Recv      Pkts Err
Gi1/0/1   45,012     45,010   0         0         0         0         0
Gi1/0/2   45,012     45,012   0         0         0         0         0

What it means:
- Per-member LACP packet counters.
- "Pkts Err > 0" = malformed LACPDU — hardware or peer bug.
- Sent/Recv mismatch on one port but not the other = unidirectional
  link issue. Investigate UDLD / cable.` },

  { cmd: 'port-channel load-balancehash',
    example: `Switch(config)# port-channel load-balance src-dst-ip

Switch# show etherchannel load-balance
EtherChannel Load-Balancing Configuration: src-dst-ip

What it means:
- Hash function used to distribute flows across bundle members.
- src-dst-ip : symmetric (both directions of one flow take same
  port). Best general-purpose default.
- src-dst-mac : L2-only switching environments.
- src-dst-port : adds L4 ports to the hash for finer granularity.
- Picking the wrong hash = uneven distribution; one member at
  100%, others idle.` },

  { cmd: 'interface port-channel <id>',
    example: `Switch(config)# interface port-channel 1
Switch(config-if)#

What it means:
- Enters Port-channel logical interface configuration mode.
- All trunk / IP / ACL config goes here, NOT on member ports.
- The Po interface is auto-created when the first member is
  bound via "channel-group <id> mode <X>".` },

  { cmd: 'channel-group <id> mode active',
    example: `Switch(config)# interface gi1/0/1
Switch(config-if)# channel-group 1 mode active

Switch# show etherchannel 1 summary | head -5
Group  Port-channel  Protocol    Ports
1      Po1(SU)       LACP        Gi1/0/1(P)

What it means:
- Adds the interface to LACP-bundled Po1.
- "active" = actively send LACPDUs. Pair with "active" or
  "passive" on the other end. "active+active" forms the bundle
  fastest and is most-used.` },

  { cmd: 'channel-group <id> mode on',
    example: `Switch(config)# interface range gi1/0/1 - 2
Switch(config-if-range)# channel-group 1 mode on

# Both sides must be "on" — no negotiation:
Switch# show etherchannel 1 summary
Group  Port-channel  Protocol    Ports
1      Po1(SU)       -           Gi1/0/1(P) Gi1/0/2(P)

What it means:
- Static EtherChannel — no LACP / PAgP. Both ends must agree to
  bundle without protocol assistance.
- DANGEROUS: a misconfiguration on one side creates a loop without
  the protocol catching it.
- Use only when protocol negotiation is impossible (some legacy
  VPC / vMotion fabrics).` },

  { cmd: 'channel-group <id> mode desirable',
    example: `Switch(config)# interface range gi1/0/1 - 2
Switch(config-if-range)# channel-group 1 mode desirable

Switch# show etherchannel 1 summary
Group  Port-channel  Protocol    Ports
1      Po1(SU)       PAgP        Gi1/0/1(P) Gi1/0/2(P)

What it means:
- PAgP (Port Aggregation Protocol) — Cisco proprietary.
- "desirable" = actively negotiates. Pair with "desirable" or
  "auto" on the other side.
- Most modern designs use LACP (industry standard); PAgP is
  Cisco-only.` },

  { cmd: 'show etherchannel <id> summary',
    example: `Switch# show etherchannel 1 summary

Flags:  D - down        P - bundled in port-channel
        I - stand-alone  s - suspended
        H - Hot-standby  R - Layer3   S - Layer2

Number of channel-groups in use: 1
Number of aggregators:           1

Group  Port-channel  Protocol    Ports
------+-------------+-----------+----------------------------------------
1      Po1(SU)       LACP        Gi1/0/1(P) Gi1/0/2(P)

What it means:
- "(SU)" : Layer-2 + In-Use = bundle is up and forwarding.
- "(P)" per-member : bundled (working).
- "(I)" or "(s)" per-member : stand-alone or suspended — port
  isn't actually bundled (LACP key mismatch, etc.).` },

  { cmd: 'lacp port-priority <value>',
    example: `Switch(config-if)# lacp port-priority 32768

Switch# show lacp interface gi1/0/1 | include Priority
Local port priority: 32768

What it means:
- Per-port LACP priority for tie-breaking when more members are
  configured than allowed by max-bundle.
- Lower priority = preferred (more likely to be active).
- Default 32768. Use lower values (e.g. 100) to designate
  "preferred" members vs "standby" members.` },

  { cmd: 'lacp system-priority <value>',
    example: `Switch(config)# lacp system-priority 100

Switch# show lacp sys-id
100, 0050.5612.3456

What it means:
- LACP system-priority across the device. Combines with chassis
  MAC to form the system ID.
- Lower priority = "winner" of the LACP partner role decisions.
- Default 32768. Adjust only when one side explicitly should
  control bundle decisions (rarely needed).` }
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
  if (!found) {
    notFound++;
    notFoundList.push(e.cmd.slice(0, 60));
    continue;
  }
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
