// Populate example output for a curated set of common Cisco show commands.
// Each example is a representative trimmed output that matches what a real
// device would emit. Stored on the command object as `.example`; the
// commands page renders a "Show example output" toggle when present.
//
// Run: node scripts/add-cisco-examples.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Examples keyed by exact command string. Looked up across multiple Cisco
// platforms (`ciscoios`, `ciscoiosxe_sw`, `ciscoiosxe_router`, `nexus`,
// `ciscoasa`, `wlc`, `cisco`).
const EXAMPLES = {
  'show version': `Cisco IOS XE Software, Version 17.12.04
Cisco IOS Software [Cupertino], Catalyst L3 Switch Software (CAT9K_LITE_IOSXE), Version 17.12.04, RELEASE SOFTWARE (fc4)

ROM: IOS-XE ROMMON
BOOTLDR: System Bootstrap, Version 17.4.1r[FC2], RELEASE SOFTWARE (P)

Switch1 uptime is 12 weeks, 3 days, 14 hours, 7 minutes
System returned to ROM by PowerOn
System restarted at 09:21:42 UTC Mon Feb 5 2026
System image file is "flash:packages.conf"
Last reload reason: Power-on

cisco C9300-48P (X86) processor (revision V01) with 1392642K/6147K bytes of memory.
Processor board ID FCW2306G0F1
1 Virtual Ethernet interface
52 Gigabit Ethernet interfaces
4 Ten Gigabit Ethernet interfaces
2048K bytes of non-volatile configuration memory.
8388608K bytes of physical memory.
11161600K bytes of Bootflash at bootflash:.

Configuration register is 0x102`,

  'show ip interface brief': `Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     unassigned      YES NVRAM  administratively down down
GigabitEthernet0/1     10.0.0.1        YES NVRAM  up                    up
GigabitEthernet0/2     10.10.10.1      YES NVRAM  up                    up
Loopback0              1.1.1.1         YES NVRAM  up                    up
Vlan1                  unassigned      YES NVRAM  administratively down down
Vlan10                 192.168.10.1    YES NVRAM  up                    up`,

  'show ip route': `Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP
       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area
       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2
       E1 - OSPF external type 1, E2 - OSPF external type 2
       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2

Gateway of last resort is 10.0.0.254 to network 0.0.0.0

S*    0.0.0.0/0 [1/0] via 10.0.0.254
      10.0.0.0/8 is variably subnetted, 4 subnets, 2 masks
C        10.0.0.0/24 is directly connected, GigabitEthernet0/1
L        10.0.0.1/32 is directly connected, GigabitEthernet0/1
O        10.20.0.0/24 [110/2] via 10.0.0.2, 00:14:23, GigabitEthernet0/1
B        172.16.0.0/16 [200/0] via 1.1.1.1, 1d04h`,

  'show running-config': `Building configuration...

Current configuration : 7842 bytes
!
version 17.12
service timestamps debug datetime msec
service timestamps log datetime msec
service password-encryption
!
hostname Switch1
!
boot-start-marker
boot system flash:cat9k_lite_iosxe.17.12.04.SPA.bin
boot-end-marker
!
enable secret 9 $9$abcdef...
!
aaa new-model
aaa authentication login default group radius local
!
ip domain-name corp.example.com
ip name-server 10.10.0.10 10.10.0.11
!
interface GigabitEthernet1/0/1
 description ACCESS-PORT
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
!
... (truncated)`,

  'show interfaces': `GigabitEthernet1/0/1 is up, line protocol is up (connected)
  Hardware is Gigabit Ethernet, address is 7c.21.0d.6a.00.01 (bia 7c.21.0d.6a.00.01)
  Description: ACCESS-PORT
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
     reliability 255/255, txload 1/255, rxload 1/255
  Encapsulation ARPA, loopback not set
  Keepalive set (10 sec)
  Full-duplex, 1000Mb/s, media type is 10/100/1000BaseTX
  input flow-control is off, output flow-control is unsupported
  ARP type: ARPA, ARP Timeout 04:00:00
  Last input 00:00:00, output 00:00:00, output hang never
  Last clearing of "show interface" counters never
  Input queue: 0/2000/0/0 (size/max/drops/flushes); Total output drops: 0
  5 minute input rate 22000 bits/sec, 38 packets/sec
  5 minute output rate 18000 bits/sec, 31 packets/sec
     14829023 packets input, 8973256722 bytes, 0 no buffer
     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
     12345678 packets output, 7654321098 bytes, 0 underruns
     0 output errors, 0 collisions, 0 interface resets`,

  'show interfaces description': `Interface                      Status         Protocol Description
Gi1/0/1                        up             up       ACCESS-PORT
Gi1/0/2                        up             up       UPLINK-TO-DIST
Gi1/0/3                        admin down     down
Gi1/0/24                       up             up       TRUNK-TO-DIST2
Te1/1/1                        up             up       40G UPLINK
Po1                            up             up       MEC-TO-DIST`,

  'show interfaces status': `Port      Name               Status       Vlan       Duplex  Speed Type
Gi1/0/1   ACCESS-PORT        connected    10         a-full a-1000 10/100/1000BaseTX
Gi1/0/2   UPLINK-TO-DIST     connected    trunk      a-full a-1000 10/100/1000BaseTX
Gi1/0/3                      notconnect   1            auto   auto 10/100/1000BaseTX
Gi1/0/24  TRUNK-TO-DIST2     connected    trunk      a-full a-1000 10/100/1000BaseTX
Te1/1/1   40G UPLINK         connected    trunk      full   40G    QSFP+ 40GBASE-SR4`,

  'show vlan brief': `VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Gi1/0/3, Gi1/0/4, Gi1/0/5
10   DATA                             active    Gi1/0/1, Gi1/0/2
20   VOICE                            active    Gi1/0/1
30   GUEST                            active
99   NATIVE                           active    Gi1/0/24
1002 fddi-default                     act/unsup
1003 token-ring-default               act/unsup
1004 fddinet-default                  act/unsup
1005 trnet-default                    act/unsup`,

  'show spanning-tree': `VLAN0010
  Spanning tree enabled protocol rstp
  Root ID    Priority    32778
             Address     0c4b.f0a1.b200
             This bridge is the root
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec

  Bridge ID  Priority    32778  (priority 32768 sys-id-ext 10)
             Address     0c4b.f0a1.b200
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
             Aging Time  300 sec

Interface           Role Sts Cost      Prio.Nbr Type
------------------- ---- --- --------- -------- --------------------------------
Gi1/0/1             Desg FWD 4         128.1    P2p Edge
Gi1/0/24            Desg FWD 4         128.24   P2p`,

  'show etherchannel summary': `Flags:  D - down        P - bundled in port-channel
        I - stand-alone s - suspended
        H - Hot-standby (LACP only)
        R - Layer3      S - Layer2
        U - in use      f - failed to allocate aggregator

Number of channel-groups in use: 1
Number of aggregators:           1

Group  Port-channel  Protocol    Ports
------+-------------+-----------+-----------------------------------------------
1      Po1(SU)         LACP      Gi1/0/23(P) Gi1/0/24(P)`,

  'show mac address-table': `          Mac Address Table
-------------------------------------------

Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    0050.5612.3456    DYNAMIC     Gi1/0/3
  10    001a.b3c4.5678    DYNAMIC     Gi1/0/5
  10    7c21.0d6a.0001    STATIC      CPU
  20    aabb.cc00.1100    DYNAMIC     Po1
Total Mac Addresses for this criterion: 4`,

  'show cdp neighbors detail': `-------------------------
Device ID: Distribution1.corp.example.com
Entry address(es):
  IP address: 10.0.0.2
Platform: cisco WS-C9500-48Y4C,  Capabilities: Router Switch IGMP
Interface: GigabitEthernet1/0/24,  Port ID (outgoing port): GigabitEthernet1/0/12
Holdtime : 132 sec

Version :
Cisco IOS XE Software, Version 17.12.04

advertisement version: 2
Duplex: full
Management address(es):
  IP address: 10.0.0.2`,

  'show lldp neighbors detail': `------------------------------------------------
Local Intf: Gi1/0/24
Chassis id: 0c4b.f0d2.c000
Port id: Gi1/0/12
Port Description: UPLINK-TO-ACCESS1
System Name: Distribution1

System Description:
Cisco IOS Software [Cupertino], Catalyst L3 Switch Software (CAT9K_IOSXE), Version 17.12.04

Time remaining: 105 seconds
System Capabilities: B,R
Enabled Capabilities: B,R
Management Addresses:
    IP: 10.0.0.2`,

  'show ip ospf neighbor': `Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           1   FULL/DR         00:00:35    10.0.0.2        GigabitEthernet0/1
3.3.3.3           1   FULL/BDR        00:00:34    10.0.0.3        GigabitEthernet0/1
4.4.4.4           1   FULL/-          00:00:38    10.0.1.2        GigabitEthernet0/2`,

  'show ip ospf interface brief': `Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C
Gi0/1        1     0               10.0.0.1/24        1     DR    2/2
Gi0/2        1     0               10.0.1.1/30        1     P2P   1/1
Lo0          1     0               1.1.1.1/32         1     LOOP  0/0`,

  'show ip ospf database': `            OSPF Router with ID (1.1.1.1) (Process ID 1)

                Router Link States (Area 0)

Link ID         ADV Router      Age         Seq#       Checksum Link count
1.1.1.1         1.1.1.1         421         0x80000045 0x00A1D2 3
2.2.2.2         2.2.2.2         389         0x80000041 0x00BCAB 4
3.3.3.3         3.3.3.3         402         0x8000003F 0x00CD89 2

                Net Link States (Area 0)

Link ID         ADV Router      Age         Seq#       Checksum
10.0.0.2        2.2.2.2         389         0x80000022 0x009A12`,

  'show ip eigrp neighbors': `EIGRP-IPv4 Neighbors for AS(100)
H   Address       Interface           Hold  Uptime    SRTT    RTO     Q   Seq
                                      (sec)           (ms)            Cnt Num
1   10.0.0.2      Gi0/1               14    01:23:45  12      200     0   142
0   10.0.1.2      Gi0/2               13    02:15:08  8       200     0   89`,

  'show ip eigrp topology': `EIGRP-IPv4 Topology Table for AS(100)/ID(1.1.1.1)
Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply,
       r - reply Status, s - sia Status

P 10.10.0.0/24, 1 successors, FD is 30720
        via 10.0.0.2 (30720/28160), GigabitEthernet0/1
P 10.20.0.0/24, 2 successors, FD is 51200
        via 10.0.0.2 (51200/30720), GigabitEthernet0/1
        via 10.0.1.2 (51200/30720), GigabitEthernet0/2`,

  'show ip bgp summary': `BGP router identifier 1.1.1.1, local AS number 65001
BGP table version is 2143, main routing table version 2143
920483 network entries using 207MB of memory
1842965 path entries using 110MB of memory
135267/65420 BGP path/bestpath attribute entries using 36MB of memory

Neighbor        V    AS  MsgRcvd  MsgSent  TblVer  InQ OutQ Up/Down  State/PfxRcd
1.2.3.4         4 65002  142051   142198   2143      0    0 1d04h    920483
5.6.7.8         4 65003   89234    89456   2143      0    0 03:45:12 920481`,

  'show ip bgp': `BGP table version is 2143, local router ID is 1.1.1.1
Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,
              r RIB-failure, S Stale, m multipath, b backup-path, x best-external

   Network          Next Hop            Metric LocPrf Weight Path
*> 0.0.0.0          1.2.3.4                              0 65002 i
*> 8.8.8.0/24       1.2.3.4                  0           0 65002 15169 i
*> 10.0.0.0/8       0.0.0.0                  0         32768 i
* i 172.16.0.0/16   2.2.2.2                  0    100      0 65003 i
*>                  5.6.7.8                              0 65003 i`,

  'show ip arp': `Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  10.0.0.1                -   7c21.0d6a.0001  ARPA   GigabitEthernet0/1
Internet  10.0.0.2               12   001a.b3c4.5678  ARPA   GigabitEthernet0/1
Internet  10.0.0.10              45   0050.5612.3456  ARPA   GigabitEthernet0/1
Internet  10.0.0.254              8   0024.5612.0001  ARPA   GigabitEthernet0/1`,

  'show port-security': `Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action
                (Count)       (Count)          (Count)
---------------------------------------------------------------------------
       Gi1/0/1              1            1                  0         Restrict
       Gi1/0/5              2            2                  0          Protect
       Gi1/0/24             1            0                  0         Shutdown
---------------------------------------------------------------------------
Total Addresses in System (excluding one mac per port)     : 2
Max Addresses limit in System (excluding one mac per port) : 4096`,

  'show ntp status': `Clock is synchronized, stratum 3, reference is 10.10.10.10
nominal freq is 250.0000 Hz, actual freq is 249.9988 Hz, precision is 2**18
ntp uptime is 14823100 (1/100 of seconds), resolution is 4016
reference time is EAA1B2C3.4D5E6F7A (10:23:45.301 UTC Mon Feb 5 2026)
clock offset is 0.5234 msec, root delay is 5.91 msec
root dispersion is 14.71 msec, peer dispersion is 1.11 msec
loopfilter state is 'CTRL' (Normal Controlled Loop), drift is 0.000004752 s/s
system poll interval is 64, last update was 27 sec ago.`,

  'show clock detail': `10:23:45.301 UTC Mon Feb 5 2026
Time source is NTP
Summer time starts 02:00:00 UTC Sun Mar 29 2026
Summer time ends 03:00:00 UTC Sun Oct 25 2026`,

  'show users': `    Line       User       Host(s)              Idle       Location
*  1 vty 0     admin      idle                 00:00:00 10.50.50.50
   2 vty 1     ops-team   idle                 00:14:32 10.50.50.51`,

  'show processes cpu sorted | exclude 0.00': `CPU utilization for five seconds: 8%/1%; one minute: 11%; five minutes: 9%
 PID Runtime(ms)     Invoked      uSecs   5Sec   1Min   5Min TTY Process
  72       42183       12834       3286  3.43%  3.21%  2.98%   0 IP RIB Update
 134       18472       28911        638  1.21%  1.18%  1.05%   0 IP SNMP
 391        9183        2018       4549  0.81%  0.73%  0.65%   0 SSH Process
  91        7321       18293        400  0.65%  0.60%  0.58%   0 ARP Input`,

  'show inventory': `NAME: "Switch1 System", DESCR: "Cisco Catalyst 9300L-48T-4X-A Switch"
PID: C9300L-48T-4X-A   , VID: V01  , SN: FCW2306G0F1

NAME: "GigabitEthernet1/1/1 transceiver", DESCR: "1000BASE-T SFP"
PID: GLC-T            , VID: V02  , SN: AGM23408XYZ

NAME: "TenGigabitEthernet1/1/1 transceiver", DESCR: "10GBASE-LR SFP+"
PID: SFP-10G-LR-S     , VID: V01  , SN: FNS231400ABC`,

  'ping 8.8.8.8': `Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 8.8.8.8, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 12/14/18 ms`,

  'traceroute 8.8.8.8': `Type escape sequence to abort.
Tracing the route to 8.8.8.8

  1 10.0.0.254 1 msec 1 msec 1 msec
  2 198.51.100.1 4 msec 3 msec 4 msec
  3 203.0.113.5 12 msec 11 msec 12 msec
  4 142.250.46.193 14 msec 13 msec 14 msec
  5 8.8.8.8 14 msec 14 msec 14 msec`,

  'show ip nat translations': `Pro  Inside global       Inside local        Outside local       Outside global
icmp 198.51.100.10:512 10.0.0.5:512        8.8.8.8:512         8.8.8.8:512
tcp  198.51.100.10:33214 10.0.0.5:33214    142.250.46.193:443  142.250.46.193:443
udp  198.51.100.10:5060 10.0.0.10:5060     203.0.113.50:5060   203.0.113.50:5060`,

  'show standby brief': `                     P indicates configured to preempt.
                     |
Interface   Grp  Pri P State    Active          Standby         Virtual IP
Vl10        10   100 P Active   local           10.0.10.2       10.0.10.1
Vl20        20   100 P Active   local           10.0.20.2       10.0.20.1
Vl30        30    90    Standby 10.0.30.2       local           10.0.30.1`,

  'show vrf': `  Name                             Default RD            Protocols   Interfaces
  CUSTOMER-A                       65001:1               ipv4        Gi0/0/1
                                                                     Gi0/0/2
  CUSTOMER-B                       65001:2               ipv4        Gi0/0/3
  MGMT                             <not set>             ipv4        Gi0/0/4`,

  'show logging': `Syslog logging: enabled (0 messages dropped, 0 messages rate-limited)
                Console logging: level debugging, 28 messages logged
                Monitor logging: level debugging, 0 messages logged
                Buffer logging: level informational, 421 messages logged
                Trap logging: level informational, 142 message lines logged
                  Logging to 10.50.50.50 (transport tcp port 1514)

Log Buffer (65536 bytes):
*Feb  5 10:18:42.281: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up
*Feb  5 10:18:42.291: %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up
*Feb  5 10:23:01.412: %SYS-5-CONFIG_I: Configured from console by admin on vty0`,

  'show ip dhcp binding': `Bindings from all pools not associated with VRF:
IP address          Client-ID/              Lease expiration        Type       State
                    Hardware address/
                    User name
10.0.10.50          0100.1ab3.c456.78       Feb 06 2026 10:23 AM    Automatic  Active
10.0.10.51          0100.5056.1234.56       Feb 06 2026 11:02 AM    Automatic  Active`,

  'show ip dhcp snooping': `Switch DHCP snooping is enabled
DHCP snooping is configured on following VLANs:
10
DHCP snooping is operational on following VLANs:
10
DHCP snooping is configured on the following Interfaces:
None
Insertion of option 82 is enabled
   circuit-id default format: vlan-mod-port
   remote-id: 7c21.0d6a.0000 (MAC)
Option 82 on untrusted port is not allowed
Verification of hwaddr field is enabled
Verification of giaddr field is enabled
DHCP snooping trust/rate is configured on the following Interfaces:

Interface                    Trusted    Allow option    Rate limit (pps)
-----------------------    -------    ------------    ----------------
GigabitEthernet1/0/24      yes        yes             unlimited`,

  'show authentication sessions interface Gi1/0/1 details': `            Interface:  GigabitEthernet1/0/1
               IIF-ID:  0x14B8408000000051
          MAC Address:  001a.b3c4.5678
         IPv6 Address:  Unknown
         IPv4 Address:  10.0.10.45
            User-Name:  jdoe
              Status:  Authorized
              Domain:  DATA
      Oper host mode:  multi-auth
    Oper control dir:  both
     Session timeout:  N/A
   Common Session ID:  0A000A2D0000000300A1B5C2
     Acct Session ID:  0x000003D2
              Handle:  0xCB000003
      Current Policy:  POLICY_Gi1/0/1`,

  'show ip pim neighbor': `PIM Neighbor Table
Mode: B - Bidir Capable, DR - Designated Router, N - Default DR Priority,
      P - Proxy Capable, S - State Refresh Capable, G - GenID Capable

Neighbor          Interface                Uptime/Expires    Ver   DR
Address                                                            Prio/Mode
10.0.0.2          GigabitEthernet0/1       1d04h/00:01:38    v2    1 / DR S P G`
};

// Walk every Cisco platform and attach examples to matching commands.
const CISCO_PLATFORMS = ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router', 'nexus', 'ciscoasa', 'wlc', 'cisco'];
let added = 0, skipped = 0;
for (const pk of CISCO_PLATFORMS) {
  const plat = data.platforms?.[pk];
  if (!plat?.sections) continue;
  for (const cmds of Object.values(plat.sections)) {
    for (const c of cmds) {
      const ex = EXAMPLES[c.cmd];
      if (!ex) continue;
      if (c.example) { skipped++; continue; }    // already populated
      c.example = ex;
      added++;
    }
  }
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Examples added:   ${added}`);
console.log(`Already populated:${skipped}`);
console.log(`Distinct example outputs available: ${Object.keys(EXAMPLES).length}`);
