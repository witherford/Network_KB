// Enrich the paloalto platform in data/commands.json:
//   1. Fill in `example` for every command currently missing one.
//   2. Add new useful commands to existing sections (avoiding exact-cmd duplicates).
//   3. Add new categories: Authentication & Admin, WildFire, DNS Security,
//      Policy-Based Forwarding, SD-WAN, Quality of Service, Threat Prevention.
//
// Example outputs follow real PAN-OS CLI format. References: PAN-OS CLI Quick
// Start Guide, Palo Alto Live Community forums, PAN-OS Administrator's Guide.

import { readFileSync, writeFileSync } from 'node:fs';

const path = 'data/commands.json';
const j = JSON.parse(readFileSync(path, 'utf8'));
const pa = j.platforms.paloalto;
const S = pa.sections;

// ===== Example outputs for every command currently missing one ============
// Keyed by exact cmd string.

const EX = {
  // ---- System & Status ----
  'show system log':
`Time                 Severity  Subtype     Description
2026/05/24 08:12:03  info      general     User admin logged in from 10.0.0.5 via Web
2026/05/24 08:14:55  info      general     panorama-connect: connected to 10.0.0.20
2026/05/24 09:01:11  high      ha          HA1 link state changed to up`,
  'request system software check':
`Version       Filename                          Released-on             Downloaded  Currently Installed  Latest
11.1.4        PanOS_vm-11.1.4                   2026/02/12 10:11:01     yes         yes                  no
11.1.5        PanOS_vm-11.1.5                   2026/04/02 14:32:08     no          no                   yes`,
  'request system software download version <version>':
`Software download job enqueued with jobid 142. Run 'show jobs id 142' to monitor progress.`,
  'request system software install version <version>':
`Executing this command will install a new version of software. It will not take effect until system is restarted.
Do you want to continue? (y or n)
Software install job enqueued with jobid 143.`,
  'request system restart':
`Executing this command will disconnect the current session.
Do you want to continue? (y or n) y
Broadcast message from root@PA-3220 (Sat May 24 09:30:00 2026):
The system is going down for reboot NOW!`,
  'request system shutdown':
`Executing this command will shutdown the system.
Do you want to continue? (y or n) y
Shutdown scheduled. System will power off in 60 seconds.`,
  'show clock':
`Sat May 24 09:32:18 UTC 2026`,
  'show ntp':
`NTP state:
  NTP synched to server: 10.0.0.20 (Primary)
NTP server status:
  NTP server: 10.0.0.20  Status: Available  Reachable: yes  Authentication-type: none
  NTP server: 10.0.0.21  Status: Available  Reachable: yes  Authentication-type: none`,
  'show config running':
`<config version="11.1.0" urldb="paloaltonetworks">
  <devices>
    <entry name="localhost.localdomain">
      <network> ... </network>
      <vsys> ... </vsys>
      ...
    </entry>
  </devices>
</config>`,
  'show config candidate':
`<config version="11.1.0" urldb="paloaltonetworks">
  ... candidate (uncommitted) configuration XML ...
</config>`,
  'show config diff':
`Difference between candidate and running configurations:
+ rulebase.security.rules.entry[@name='Allow-Web']
-   action: drop
+   action: allow
+   profile-setting.profiles.virus: default`,
  'debug system maintenance-mode':
`WARNING: maintenance-mode reboots the firewall into the maintenance partition.
Use only at TAC direction. Continue? (y or n)`,

  // ---- Interfaces ----
  'show interface all':
`Network interface info:
name                state    mac                       speed   duplex  id    mode
ethernet1/1         up       00:1b:17:00:01:01         1000    full    16    layer3
ethernet1/2         up       00:1b:17:00:01:02         1000    full    17    layer3
ethernet1/3         down     00:1b:17:00:01:03         unknown unknown 18    not-configured
ae1                 up       00:1b:17:00:00:01         2000    full    100   aggregate-group`,
  'show interface <interface-name>':
`Name: ethernet1/1, ID: 16
Link status:
  Runtime link speed/duplex/state: 1000/full/up
  Configured link speed/duplex/state: auto/auto/auto
MAC address:
  Port MAC address 00:1b:17:00:01:01
Operation mode: layer3
Virtual System: vsys1
Zone: untrust  Virtual-Router: default
IP addresses:
  10.0.1.1/24`,
  'set interface <interface-name> unit <unit> family inet address <ip>':
`# (configure) set network interface ethernet ethernet1/1.10 layer3 ip 10.0.10.1/24
[edit]`,
  'set interface <interface-name> mtu <mtu-value>':
`# (configure) set network interface ethernet ethernet1/1 layer3 mtu 9000
[edit]`,
  'set interface <interface-name> management-profile <profile-name>':
`# (configure) set network interface ethernet ethernet1/1 layer3 interface-management-profile Allow-Ping
[edit]`,
  'set interface <interface-name> comment <description>':
`# (configure) set network interface ethernet ethernet1/1 comment "Uplink to core SW1 Te1/1/1"
[edit]`,
  'debug interface <interface-name> clear counters':
`Counters cleared for ethernet1/1.`,
  'show interface hardware':
`name             status    speed    duplex   type     mac
ethernet1/1      up        1000     full     copper   00:1b:17:00:01:01
ethernet1/2      up        10000    full     SFP+ SR  00:1b:17:00:01:02
ethernet1/3      down      auto     auto     copper   00:1b:17:00:01:03`,
  'show interface <name>':
`Name: ethernet1/2, ID: 17
Operation mode: layer3, Zone: trust, Virtual Router: default
IP: 10.0.2.1/24
Counters:
  ipackets: 18234556  ibytes: 4523125678
  opackets: 18012988  obytes: 4408765432
  ierrors:  0         oerrors: 0
  idrops:   12        odrops:  0`,
  'show interface logical':
`name                state    ip                  zone        vsys
ethernet1/1         up       10.0.1.1/24         untrust     vsys1
ethernet1/1.10      up       10.0.10.1/24        users       vsys1
ethernet1/2         up       10.0.2.1/24         trust       vsys1
tunnel.1            up       n/a                 vpn         vsys1`,
  'show interface ethernet1/1 transceiver':
`Slot: 1  Port: 1
Vendor name:    FINISAR CORP.
Part number:    FTLF8519P2BNL
Serial number:  PHF1234567
Connector:      LC
Transceiver:    1000BASE-SX
Wavelength:     850 nm
Tx Power:       -3.2 dBm
Rx Power:       -5.1 dBm
Temperature:    42.1 C`,

  // ---- Zones ----
  'set zone <zone-name> network layer3 <interface-name>':
`# (configure) set zone trust network layer3 ethernet1/2
[edit]`,
  'set zone <zone-name> network layer2 <interface-name>':
`# (configure) set zone trust-l2 network layer2 ethernet1/3
[edit]`,
  'set zone <zone-name> enable-user-identification yes':
`# (configure) set zone trust enable-user-identification yes
[edit]`,
  'set zone <zone-name> log-setting <log-profile>':
`# (configure) set zone untrust log-setting SOC-Log-Forwarding
[edit]`,
  'show zone all':
`Zone Name      Type      Mode      Interface Count   User-ID
trust          layer3    normal    3                 yes
untrust        layer3    normal    1                 no
dmz            layer3    normal    2                 no
vpn            layer3    normal    1                 no`,
  'set zone <zone-name> network tap <interface-name>':
`# (configure) set zone tap-zone network tap ethernet1/8
[edit]`,

  // ---- Routing ----
  'show routing route':
`VIRTUAL ROUTER: default (id 1)
  ==========
flags: A:active, ?:loose, C:connect, H:host, S:static, ~:internal, R:rip, O:ospf
       B:bgp, Oi:ospf intra-area, Oo:ospf inter-area, O1:ospf ext-type-1, O2:ext-type-2
destination          nexthop              metric flags  age   interface
0.0.0.0/0            10.0.1.254           10     A S    1d    ethernet1/1
10.0.1.0/24          10.0.1.1             0      A C    1d    ethernet1/1
10.0.2.0/24          10.0.2.1             0      A C    1d    ethernet1/2
10.10.0.0/16         10.0.2.254           20     A O    8h    ethernet1/2`,
  'show routing summary':
`VR name                default
RIB entries            42
FIB entries            40
Connected              4
Static                 6
RIP                    0
OSPF                   28
BGP                    4`,
  'show routing fib':
`Virtual Router: default
total routes shown: 40
flags: u - up, h - host, g - gateway, e - ecmp, *:preferred path
id    destination          nexthop           flags interface           mtu
1     0.0.0.0/0            10.0.1.254        ugh*  ethernet1/1         1500
2     10.0.1.0/24          0.0.0.0           uc    ethernet1/1         1500`,
  'test routing fib-lookup virtual-router <vr-name> ip <ip-address>':
`runtime route lookup
--------------------
virtual-router: default
destination:    8.8.8.8
result:
  interface: ethernet1/1
  next-hop:  10.0.1.254
  source:    static
  metric:    10`,
  'set virtual-router <vr-name> routing-table ip static-route <name> destination <ip/mask>':
`# (configure) set network virtual-router default routing-table ip static-route Default destination 0.0.0.0/0
[edit]`,
  'set virtual-router <vr-name> routing-table ip static-route <name> nexthop ip-address <ip>':
`# (configure) set network virtual-router default routing-table ip static-route Default nexthop ip-address 10.0.1.254
[edit]`,
  'set virtual-router <vr-name> protocol ospf enable yes':
`# (configure) set network virtual-router default protocol ospf enable yes
[edit]`,
  'set virtual-router <vr-name> protocol bgp enable yes':
`# (configure) set network virtual-router default protocol bgp enable yes
[edit]`,
  'set virtual-router <vr-name> protocol bgp local-as <asn>':
`# (configure) set network virtual-router default protocol bgp local-as 65001
[edit]`,
  'show routing protocol ospf neighbor':
`Virtual Router: default
Neighbor Address  Local Address    Area-ID         Pri  State        Lifetime  Hello-Interval  Dead-Interval
10.0.2.254        10.0.2.1         0.0.0.0         1    Full         00:00:32  10              40
10.0.3.254        10.0.3.1         0.0.0.1         1    Full         00:00:31  10              40`,
  'show routing protocol bgp summary':
`Virtual Router: default
Peer Group/Peer   AS       Local-IP        Peer-IP         State          Up/Down   Pfxs Rcvd/Sent
ISP1/Edge1        65100    10.0.1.1        10.0.1.254      Established    1d 02:11  142  / 4
ISP2/Edge2        65101    10.0.4.1        10.0.4.254      Established    16:42:08  138  / 4`,
  'show routing fib virtual-router <vr>':
`Virtual Router: default
total routes: 40
flags: u - up, h - host, g - gateway, e - ecmp, *:preferred path
0.0.0.0/0            10.0.1.254        ugh*  ethernet1/1         1500
10.0.1.0/24          0.0.0.0           uc    ethernet1/1         1500
10.10.0.0/16         10.0.2.254        ugh*  ethernet1/2         1500`,
  'show routing protocol bgp peer':
`Peer: Edge1
  Peer router id  : 10.0.1.254
  Peer AS         : 65100
  State           : Established  Status duration: 1d 02:11
  Local address   : 10.0.1.1 (ethernet1/1)
  Hold time       : 90 sec
  Keep-alive      : 30 sec
  Messages In/Out : 4823 / 4810`,
  'show routing protocol bgp rib-out peer <peer>':
`Peer: Edge1
Prefix              Next-hop        Local-Pref  MED   Origin    AS-Path
0.0.0.0/0           10.0.1.1        100         0     IGP       i
10.0.0.0/16         10.0.1.1        100         0     IGP       i`,

  // ---- Security Policies ----
  'show running security-policy':
`Rules:                  4
"Allow-DNS"  {
        from any;
        source any;
        to any;
        destination any;
        application dns;
        service application-default;
        action allow;
}
"Allow-Web" {
        from trust;
        source any;
        to untrust;
        destination any;
        application [ web-browsing ssl ];
        service application-default;
        action allow;
}
"Default-Deny" { from any; to any; action deny; }`,
  'test security-policy-match from <zone> to <zone> source <ip> destination <ip> application <app>':
`"Allow-Web" {
        from trust;
        source any;
        to untrust;
        destination any;
        application [ web-browsing ssl ];
        action allow;
}`,
  'set rulebase security rules <rule-name> from <source-zone>':
`# (configure) set rulebase security rules Allow-Web from trust
[edit]`,
  'set rulebase security rules <rule-name> to <destination-zone>':
`# (configure) set rulebase security rules Allow-Web to untrust
[edit]`,
  'set rulebase security rules <rule-name> source <source-address>':
`# (configure) set rulebase security rules Allow-Web source Workstations
[edit]`,
  'set rulebase security rules <rule-name> destination <destination-address>':
`# (configure) set rulebase security rules Allow-Web destination any
[edit]`,
  'set rulebase security rules <rule-name> application <application-name>':
`# (configure) set rulebase security rules Allow-Web application [ web-browsing ssl ]
[edit]`,
  'set rulebase security rules <rule-name> action allow/deny/drop':
`# (configure) set rulebase security rules Allow-Web action allow
[edit]`,
  'set rulebase security rules <rule-name> log-start yes':
`# (configure) set rulebase security rules Allow-Web log-start yes
[edit]`,
  'set rulebase security rules <rule-name> log-end yes':
`# (configure) set rulebase security rules Allow-Web log-end yes
[edit]`,
  'set rulebase security rules <rule-name> disabled yes/no':
`# (configure) set rulebase security rules Old-Rule disabled yes
[edit]`,
  'set rulebase security rules <rule-name> profile-setting profiles virus <av-profile>':
`# (configure) set rulebase security rules Allow-Web profile-setting profiles virus default
[edit]`,
  'set rulebase security rules <rule-name> profile-setting profiles vulnerability <vp-profile>':
`# (configure) set rulebase security rules Allow-Web profile-setting profiles vulnerability strict
[edit]`,
  'set rulebase security rules <rule-name> profile-setting profiles url-filtering <url-profile>':
`# (configure) set rulebase security rules Allow-Web profile-setting profiles url-filtering default
[edit]`,
  'set rulebase security rules <rule-name> tag [ <tag1> <tag2> ]':
`# (configure) set rulebase security rules Allow-Web tag [ Production WebTraffic ]
[edit]`,
  'show running security-policy | match "<app>"':
`"Allow-Web"  application [ web-browsing ssl ]  action allow
"DNS-Sinkhole"  application dns  action allow`,
  'test security-policy-match source <ip> destination <ip> application <app> protocol 6 destination-port <p>':
`"Allow-Web" {
        from trust;
        to untrust;
        application [ web-browsing ssl ];
        service application-default;
        action allow;
}`,
  'show system setting logging':
`Logging settings:
  Disk space (logdb)       : 60%
  Log forwarding enabled   : yes
  Buffered log forwarding  : yes
  Threat log auto-clear    : no`,
  'set rulebase security rules <name> description "<text>"':
`# (configure) set rulebase security rules Allow-Web description "Permit user web browsing to internet"
[edit]`,
  'test security-policy-match from <src-zone> to <dst-zone> source <ip> destination <ip> protocol 6 destination-port <p> application <app>':
`"Allow-Web" {
        from trust;
        source any;
        to untrust;
        destination any;
        application [ web-browsing ssl ];
        service application-default;
        action allow;
}`,
  'show running rule-use rule-base security type unused vsys vsys1':
`Vsys: vsys1
Rule-base: security
Unused rules:
  "Old-Test-Rule"
  "Temp-Allow-Vendor"`,
  'show running rule-hit-count vsys vsys1 rule-base security':
`Rule                            Hits
Allow-DNS                       28341
Allow-Web                       912045
Block-RFC1918-out                  12
Default-Deny                      438`,
  'show rule-hit-count vsys vsys1 rule-base security rules "<name>"':
`Rule: Allow-Web
First hit timestamp : 2026/05/01 08:00:11
Last  hit timestamp : 2026/05/24 09:32:55
Hit count           : 912045`,

  // ---- NAT ----
  'show running nat-policy':
`Rules:                  2
"Outbound-NAT" {
        from trust;
        to untrust;
        source any;
        destination any;
        service any;
        translate-to "src: dynamic-ip-and-port (ethernet1/1)";
}
"Inbound-Web" {
        from untrust;
        to dmz;
        source any;
        destination 203.0.113.10;
        service service-http;
        translate-to "dst: 10.0.10.10";
}`,
  'test nat-policy-match source <ip> destination <ip> from <zone> to <zone>':
`"Outbound-NAT" {
        source-translation: dynamic-ip-and-port
        interface: ethernet1/1
}`,
  'set rulebase nat rules <rule-name> source-translation dynamic-ip-and-port interface-address interface <interface>':
`# (configure) set rulebase nat rules Outbound-NAT source-translation dynamic-ip-and-port interface-address interface ethernet1/1
[edit]`,
  'set rulebase nat rules <rule-name> source-translation static-ip bi-directional yes translated-address <ip>':
`# (configure) set rulebase nat rules Server-Static-NAT source-translation static-ip bi-directional yes translated-address 203.0.113.20
[edit]`,
  'set rulebase nat rules <rule-name> destination-translation translated-address <ip>':
`# (configure) set rulebase nat rules Inbound-Web destination-translation translated-address 10.0.10.10
[edit]`,
  'set rulebase nat rules <rule-name> destination-translation translated-port <port>':
`# (configure) set rulebase nat rules Inbound-Web destination-translation translated-port 8080
[edit]`,
  'test nat-policy-match from <src-zone> to <dst-zone> source <ip> destination <ip> protocol 6 destination-port <p>':
`"Inbound-Web" {
        destination-translation:
                translated-address: 10.0.10.10
                translated-port: 8080
}`,
  'show session all filter nat-rule "<name>"':
`Session count: 14
ID    Application   State   Src                Dst                NAT-Rule
1024  web-browsing  ACTIVE  10.0.2.55:51234    203.0.113.10:443   Outbound-NAT
1025  ssl           ACTIVE  10.0.2.55:51235    93.184.216.34:443  Outbound-NAT`,

  // ---- Network Objects ----
  'set address <name> ip-netmask <ip>/<mask>':
`# (configure) set address Workstations ip-netmask 10.0.2.0/24
[edit]`,
  'set address <name> ip-range <start-ip> <end-ip>':
`# (configure) set address DHCP-Pool ip-range 10.0.2.100 10.0.2.200
[edit]`,
  'set address <name> fqdn <hostname>':
`# (configure) set address Web-Server fqdn web.example.com
[edit]`,
  'show address all':
`Address          Type           Value
Workstations     ip-netmask     10.0.2.0/24
DHCP-Pool        ip-range       10.0.2.100-10.0.2.200
Web-Server       fqdn           web.example.com
RFC1918-10       ip-netmask     10.0.0.0/8`,
  'set address-group <name> static [ <addr1> <addr2> ]':
`# (configure) set address-group Internal-Networks static [ Workstations DHCP-Pool RFC1918-10 ]
[edit]`,
  'show address-group all':
`Address-group        Type      Members
Internal-Networks    static    Workstations, DHCP-Pool, RFC1918-10
Cloud-Services       dynamic   match 'tag.cloud'`,
  'set service <name> protocol tcp port <port-number>':
`# (configure) set service service-https protocol tcp port 443
[edit]`,
  'set service <name> protocol udp port <port-number>':
`# (configure) set service service-dns protocol udp port 53
[edit]`,
  'set service-group <name> static [ <svc1> <svc2> ]':
`# (configure) set service-group Web-Services static [ service-http service-https ]
[edit]`,
  'delete address <name>':
`# (configure) delete address Old-Server
[edit]`,
  'set tag <name> color <color>':
`# (configure) set tag Production color color1
[edit]`,

  // ---- VPN ----
  'show vpn ipsec-sa':
`Tunnel name           Gateway      Local addr           Remote addr          Direction  Lifetime  Bytes
AWS-VPN:tunnel.1      AWS-GW       10.0.1.1             52.10.20.30          out        3540      1.2 GB
AWS-VPN:tunnel.1      AWS-GW       10.0.1.1             52.10.20.30          in         3540      8.4 GB`,
  'show vpn ipsec-sa tunnel <tunnel-name>':
`Tunnel: AWS-VPN
  Local IP             : 10.0.1.1
  Peer IP              : 52.10.20.30
  Inside Interface     : tunnel.1
  Tunnel Interface     : tunnel.1
  Encryption           : aes-256-cbc
  Authentication       : sha256
  Bytes  in / out      : 8.4 GB / 1.2 GB
  Packets in / out     : 12,231,442 / 11,889,234
  Lifetime             : 3540 sec remaining`,
  'show vpn ike-sa':
`Gateway          Peer-IP         Local-IP    Version  State      Lifetime
AWS-GW           52.10.20.30     10.0.1.1    IKEv2    UP         27340 sec
Azure-GW         13.94.55.66     10.0.1.1    IKEv2    UP         18722 sec`,
  'show vpn flow':
`Tunnel name      Local IP    Peer IP        Encap   Decap   Status   Type
tunnel.1         10.0.1.1    52.10.20.30    OK      OK      active   ipsec
tunnel.2         10.0.1.1    13.94.55.66    OK      OK      active   ipsec`,
  'test vpn ipsec-sa tunnel <tunnel-name>':
`Initiate IKE SA: Total 1 gateways found. 1 gateways initiated.`,
  'set network ike gateway <name> authentication pre-shared-key key <key>':
`# (configure) set network ike gateway AWS-GW authentication pre-shared-key key <PSK-redacted>
[edit]`,
  'set network ike gateway <name> peer-address ip <peer-ip>':
`# (configure) set network ike gateway AWS-GW peer-address ip 52.10.20.30
[edit]`,
  'set network ike gateway <name> protocol ikev2':
`# (configure) set network ike gateway AWS-GW protocol ikev2 ike-crypto-profile default
[edit]`,
  'set network tunnel ipsec <name> auto-key ike-gateway <gateway-name>':
`# (configure) set network tunnel ipsec AWS-VPN auto-key ike-gateway AWS-GW
[edit]`,
  'show global-protect-gateway current-user':
`User             Computer       Source IP        Tunnel IP        Login Time            Client-OS
jbloggs          NB-1234        198.51.100.20    10.50.0.12       2026/05/24 08:11:02   Win 11
asmith           IPHONE-99      203.0.113.4      10.50.0.13       2026/05/24 09:02:18   iOS 17`,
  'show global-protect-gateway statistics':
`Active GlobalProtect users      : 142
Tunnels (active / configured)   : 142 / 500
Bytes  in / out                 : 188.4 GB / 42.1 GB
Logins (success / failed)        : 1503 / 12`,
  'test vpn ike-sa gateway <gw>':
`Phase-1 SAs:
  Gateway: AWS-GW
  Cookies: i: a1b2c3d4e5f60001  r: f0e1d2c3b4a50001
  State: established`,
  'test vpn ipsec-sa tunnel <tun>':
`Initiate IPSec SA: tunnel.1 attempt sent. Use 'show vpn ipsec-sa tunnel tunnel.1' to verify.`,
  'debug ike global on debug':
`debug:ike:debug mode enabled.
Use 'less mp-log ikemgr.log' to view IKE negotiation messages.`,
  'show vpn ipsec-sa tunnel <name>':
`Tunnel: AWS-VPN
Local SPI            : 0xabcd1234   Remote SPI: 0x4321dcba
Encryption           : aes-256-gcm
Lifetime             : 3540 sec
Status               : active`,
  'show vpn tunnel':
`Name             Type      Status     Local IP     Remote IP
AWS-VPN          ipsec     up         10.0.1.1     52.10.20.30
Azure-VPN        ipsec     up         10.0.1.1     13.94.55.66
HQ-Branch        ipsec     down       10.0.1.1     203.0.113.55`,
  'clear vpn ike-sa gateway <gw>':
`Cleared IKE SA for gateway AWS-GW.`,
  'clear vpn ipsec-sa tunnel <t>':
`Cleared IPSec SA for tunnel tunnel.1.`,

  // ---- High Availability ----
  'show high-availability state':
`Enabled: yes
Local Information:
  Mode             : Active-Passive
  State            : active
  Priority         : 100
  Preemptive       : yes
  Device serial    : 0123456789
  Mgmt IP          : 10.0.0.1
Peer Information:
  State            : passive
  Mgmt IP          : 10.0.0.2
  Priority         : 110`,
  'show high-availability all':
`Enabled         : yes
Mode            : Active-Passive
Group ID        : 7
Local state     : active   (priority 100)
Peer  state     : passive  (priority 110)
HA1   primary   : up   ethernet1/8
HA1   backup    : up   mgt
HA2               up   ethernet1/9
HA2 keep-alive  : enabled`,
  'show high-availability path-monitoring':
`Path monitor: enabled
Failure condition: any
Group: Internet
  Destination       Result
  10.0.1.254        UP
  10.0.4.254        UP
Group: DC
  Destination       Result
  10.10.10.1        UP`,
  'set high-availability mode active-passive':
`# (configure) set deviceconfig high-availability group 7 mode active-passive
[edit]`,
  'set high-availability mode active-active':
`# (configure) set deviceconfig high-availability group 7 mode active-active device-id 0
[edit]`,
  'set high-availability group <group-id> peer-ip <ip>':
`# (configure) set deviceconfig high-availability group 7 peer-ip 10.0.0.2
[edit]`,
  'set high-availability election-option priority primary':
`# (configure) set deviceconfig high-availability group 7 election-option device-priority 90
[edit]`,
  'request high-availability state suspend':
`Suspended HA. This device will not take over if peer fails until resumed.`,
  'request high-availability state functional':
`HA state set to functional. Device will participate in HA election.`,
  'request high-availability sync-to-remote running-config':
`Sync to remote initiated. Job ID: 215. Use 'show jobs id 215' to monitor.`,
  'show high-availability control-link statistics':
`Interface: ethernet1/8 (HA1 primary)
  Tx packets: 18234556    Rx packets: 18234112
  Tx bytes  : 1.4 GB      Rx bytes  : 1.4 GB
  Errors    : 0           Drops     : 0`,
  'show high-availability link-monitoring':
`Link monitor: enabled
Failure condition: any
Interface     State
ethernet1/1   UP
ethernet1/2   UP
ethernet1/3   DOWN  <-- triggers failover`,
  'show high-availability flap-statistics':
`Total flaps    : 0
Last flap time : never
HA1            : 0
HA2            : 0
Path-monitor   : 0
Link-monitor   : 0`,
  'show high-availability state-synchronization':
`Sessions      : 412 / 412 synchronized
Routes        : 40  / 40  synchronized
IPSec SAs     : 2   / 2   synchronized
Last sync     : 12 sec ago
Status        : healthy`,

  // ---- App-ID & Content-ID ----
  'show application <name>':
`Application: web-browsing
Category   : general-internet
Subcategory: internet-utility
Risk       : 4
Ports      : tcp/80,8080
Tags       : web-app
Description: This application is used to browse the World Wide Web.`,
  'show application status':
`Application database version: 8754-8543 (2026/05/23)
Last update                 : 2026/05/23 18:00:01
Auto-update                  : enabled`,
  'request content-id update':
`Content update job enqueued with jobid 218.`,
  'show content-id status':
`Content version        : 8754-8543
Antivirus version      : 4685-5210
WildFire version       : 821231-1
Status                 : Up to date`,
  'show wildfire status':
`WildFire cloud       : wildfire.paloaltonetworks.com
Connection           : connected
Sample queue         : 0
Verdict queue        : 0
Verdicts received    : 1542`,
  'request wildfire submit file <path>':
`File queued for WildFire submission: /sample.exe  (sha256: a1b2c3...)`,
  'show threat-detection summary':
`Total threats blocked: 8421 (last 24 hr)
  Critical : 12
  High     : 142
  Medium   : 822
  Low      : 7445`,
  'show url-filtering statistics':
`Cache hits           : 1,824,231
Cache misses         : 12,442
Cloud lookups        : 12,442
Categorisation rate  : 99.3%`,

  // ---- Certificate Management ----
  'show certificate <name>':
`Certificate: SSL-Decrypt-CA
Subject     : CN=SSL-Decrypt-CA, O=Acme Corp
Issuer      : CN=Root-CA, O=Acme Corp
Not before  : 2025/01/01 00:00:00
Not after   : 2030/01/01 00:00:00
Status      : valid`,
  'request certificate generate signed-by <ca-name> certificate-name <name> name <cn> signed-by <ca>':
`Generated certificate Web-Server signed by Root-CA. Use 'show certificate Web-Server' to view.`,
  'request certificate import format <pem|pkcs12> certificate-name <name> file <path>':
`Imported certificate Web-Server from file web-server.p12. Use 'show certificate Web-Server' to view.`,
  'set certificate-profile <name> CA <cert-name>':
`# (configure) set shared certificate-profile GP-Profile CA Root-CA
[edit]`,
  'show certificate-cache':
`Total cached SSL forward-proxy certificates: 1842
Oldest entry: 2026/05/01 14:22:01
Cache utilisation: 38%`,
  'request certificate revoke certificate <name>':
`Revoked certificate Web-Server. CRL will be updated on next publish.`,

  // ---- Monitoring & Diagnostics ----
  'show session all':
`ID       Application    Vsys  Source                Destination          Proto  State   Ingress  Egress
1024     web-browsing   vsys1 10.0.2.55:51234       203.0.113.10:80      TCP    ACTIVE  eth1/2   eth1/1
1025     ssl            vsys1 10.0.2.55:51235       93.184.216.34:443    TCP    ACTIVE  eth1/2   eth1/1
1026     dns            vsys1 10.0.2.55:60112       8.8.8.8:53           UDP    ACTIVE  eth1/2   eth1/1`,
  'clear session all':
`All sessions have been cleared. Active session count: 0`,
  'show log traffic':
`Time                 Src              Dst              App           Action  Bytes  Rule
2026/05/24 09:32:01  10.0.2.55        203.0.113.10     web-browsing  allow   8421   Allow-Web
2026/05/24 09:32:02  10.0.2.55        93.184.216.34    ssl           allow   12K    Allow-Web
2026/05/24 09:32:03  10.0.2.99        198.51.100.5     unknown-tcp   deny    0      Default-Deny`,
  'show log url':
`Time                 Src         URL                          Category         Action
2026/05/24 09:32:01  10.0.2.55   www.paloalto.com/products    business         allow
2026/05/24 09:32:14  10.0.2.55   malicious.example.com        command-control  block`,
  'ping source <source-ip> host <destination-ip>':
`PING 8.8.8.8 (8.8.8.8) from 10.0.1.1 56(84) bytes of data.
64 bytes from 8.8.8.8: icmp_seq=1 ttl=120 time=4.21 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=120 time=4.05 ms
--- 8.8.8.8 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss`,
  'traceroute source <source-ip> host <destination-ip>':
`traceroute to 8.8.8.8 (8.8.8.8), 30 hops max, 60 byte packets
 1  10.0.1.254 (10.0.1.254)  1.123 ms
 2  198.51.100.1 (198.51.100.1)  4.211 ms
 3  *  *  *
 4  8.8.8.8 (8.8.8.8)  6.812 ms`,
  'debug dataplane packet-diag set filter match source <ip> destination <ip>':
`Packet filter: src=10.0.2.55 dst=8.8.8.8 added. Run 'debug dataplane packet-diag set filter on' to activate.`,
  'debug dataplane packet-diag start':
`Packet diagnostic started. Capture stages active.`,
  'debug dataplane packet-diag stop':
`Packet diagnostic stopped. PCAPs are in /var/tmp/.`,
  'debug dataplane packet-diag clear':
`Packet filters and counters cleared.`,
  'show arp all':
`maximum of entries supported :    32000
default timeout: 1800 seconds
total ARP entries in table:   12
interface     ip                mac               port              status     ttl
ethernet1/1   10.0.1.254        00:1b:21:aa:bb:01 ethernet1/1       valid      1742
ethernet1/2   10.0.2.55         00:50:56:a0:01:23 ethernet1/2       valid      1801`,
  'show mac all':
`Interface         MAC                VLAN     Type
ethernet1/3       00:50:56:a0:01:01  100      dynamic
ethernet1/3       00:50:56:a0:01:02  100      dynamic
ethernet1/4       00:1b:21:aa:bb:02  200      static`,
  'show counter global filter severity drop':
`Global counters:
flow_policy_deny          1842   drop   Session deny by security policy
flow_no_route             182    drop   No route to destination
flow_no_session           24     drop   No matching session for non-SYN`,
  'show counter interface <if>':
`Interface  : ethernet1/1
Tx packets : 18,234,556    Tx bytes : 4,523,125,678
Rx packets : 18,012,988    Rx bytes : 4,408,765,432
Tx errors  : 0             Rx errors : 12
Tx drops   : 0             Rx drops  : 0`,
  'show system statistics session':
`Average session size                  : 412 bytes
Sessions per second                   : 1,832
TCP / UDP / Other                     : 80% / 18% / 2%
Active sessions                       : 18,233 / 250,000 capacity (7%)`,
  'show running resource-monitor':
`Resource monitoring:
CPU load (mp / dp)              : 22% / 18%
Session table utilisation       : 7%
Forwarding table utilisation    : 0.2%
ARP table utilisation           : 0.04%`,
  'less mp-log pan_task.log':
`2026-05-24 09:32:01 INFO  task: Commit job 142 started by admin
2026-05-24 09:32:08 INFO  task: Commit job 142 completed in 7.42 sec`,
  'less dp-log pan_packet_diag.log':
`2026-05-24 09:30:11 packet-diag: filter1 enabled  src=10.0.2.55 dst=8.8.8.8
2026-05-24 09:30:11 packet-diag: capture stage receive -> rx.pcap`,
  'show counter global filter delta yes packet-filter yes':
`Counters captured since last query (delta), matching packet-filter:
flow_pkt_received                182
flow_pkt_processed               180
flow_pkt_dropped                   2  (flow_policy_deny)`,
  'show counter global filter severity drop delta yes':
`Counters captured since last query (delta), severity=drop:
flow_policy_deny                  18
flow_no_route                      2
flow_invalid_pkt                   1`,
  'show system logdb-quota':
`Quotas (percentage / GB):
Traffic     35% / 80GB
Threat      10% / 24GB
URL          8% / 18GB
WildFire     5% / 12GB
Total used : 58% (152GB / 262GB)`,
  'show log traffic direction equal backward count 50':
`(Most recent 50 traffic logs, newest first — truncated for brevity)
2026/05/24 09:33:11  10.0.2.55 -> 8.8.8.8       dns     allow Allow-DNS
2026/05/24 09:33:10  10.0.2.55 -> 203.0.113.10  web     allow Allow-Web
...`,
  'show log threat direction equal backward count 50':
`(Most recent 50 threat logs, newest first — truncated for brevity)
2026/05/24 09:31:48  vuln  high   10.0.2.99  98.137.11.163  spyware/cnc-65532 reset-both
2026/05/24 09:31:12  url   medium 10.0.2.55  malicious.example.com command-control block`,

  // ---- Commit & Config ----
  'commit':
`Commit job enqueued with jobid 142. Use 'show jobs id 142' to monitor progress.
...
Job 142 finished — Commit succeeded in 7.4 sec.`,
  'validate full':
`Validate job enqueued with jobid 143.
...
Job 143 finished — Validate succeeded.  No errors.`,
  'diff config running candidate':
`+ rulebase.security.rules.entry[@name='Allow-Web']
+   action: allow
- rulebase.security.rules.entry[@name='Old-Test']`,
  'revert config':
`Candidate configuration has been reverted to the running configuration.`,
  'save config to <filename>':
`Configuration saved to running-config_2026-05-24.xml`,
  'load config from <filename>':
`Configuration loaded from saved-2026-05-23.xml. Run 'commit' to activate.`,
  'commit partial admin <username>':
`Partial commit job enqueued (admin=jbloggs only). Job ID 145.`,
  'load config partial from <filename> from-xpath <xpath> to-xpath <xpath>':
`Partial config loaded from saved-2026-05-23.xml.  Run 'commit' to activate.`,
  'show config saved':
`Saved configurations:
  running-config_2026-05-20.xml
  running-config_2026-05-22.xml
  pre-upgrade.xml`,
  'commit force':
`Forcing commit with errors ignored. Job ID 146.`,
  'request commit-lock add comment "<reason>"':
`Commit lock added by admin. Reason: "Change window 09:00-10:00".`,
  'configure':
`Entering configuration mode
[edit]
admin@PA-3220#`,
  'commit description "<msg>"':
`Commit job enqueued (description: "Add Allow-Web for new subnet"). Job ID 147.`,
  'commit partial admin <user>':
`Partial commit job enqueued (admin=asmith only). Job ID 148.`,
  'show commit-locks':
`Type    Locked-by   Time                  Comment
commit  admin       2026/05/24 09:00:00   "Change window 09:00-10:00"`,
  'request commit-lock remove admin <user>':
`Commit lock for admin removed.`,

  // ---- User-ID ----
  'show user ip-user-mapping all':
`IP              Vsys   From                User                       IdleTimeout(s)  MaxTimeout(s)
10.0.2.55       vsys1  AD                  ACME\\jbloggs                  1582            10800
10.0.2.99       vsys1  Captive-Portal      ACME\\contractor1              298             10800
10.0.2.100      vsys1  GP                  ACME\\asmith                   3204            10800`,
  'test user-id ip-user-mapping ip <ip-address>':
`IP: 10.0.2.55
User                     : ACME\\jbloggs
Source                   : AD (Active Directory)
Mapped                   : 2026/05/24 08:11:12
Idle timeout remaining   : 1582 sec`,
  'show user user-id-agent statistics':
`Agent: AD-Agent-01 (10.0.0.50)
  Status               : connected
  IP-User mappings     : 2,128
  Groups in cache      : 184
  Last update          : 32 sec ago
  Bytes RX / TX        : 14.2 MB / 1.8 MB`,
  'set user-id agent <name> host <ip> port <port>':
`# (configure) set user-id-agent AD-Agent-01 host 10.0.0.50 port 5007
[edit]`,
  'debug user-id reset':
`User-ID daemon reset. All cached mappings dropped. Mappings will repopulate from agents.`,
  'show user group name <group-dn>':
`Group: cn=Domain Users,cn=Users,dc=acme,dc=local
Member count: 1842
Members:
  ACME\\jbloggs
  ACME\\asmith
  ...`,
  'request user-id logout user <username> vsys <vsys>':
`User ACME\\jbloggs logged out from vsys1. IP-User mapping removed.`,
  'show user user-ids all':
`Vsys    User                Group memberships  Mappings
vsys1   ACME\\jbloggs        12                 1 (10.0.2.55)
vsys1   ACME\\asmith         12                 1 (10.0.2.100)`,
  'show user ip-user-mapping ip <ip>':
`IP             : 10.0.2.55
User           : ACME\\jbloggs
Source         : AD
Idle timeout   : 1582 sec remaining`,
  'show user group list':
`Vsys: vsys1
  cn=Domain Users,cn=Users,dc=acme,dc=local
  cn=Domain Admins,cn=Users,dc=acme,dc=local
  cn=VPN-Users,cn=Users,dc=acme,dc=local`,
  'show user group name "<grp>"':
`Group: cn=VPN-Users,cn=Users,dc=acme,dc=local
Member count: 412
Members:
  ACME\\jbloggs
  ACME\\asmith
  ACME\\contractor1`,
  'clear user-cache all':
`All User-ID cache entries cleared. Mappings will be re-learned from agents.`,

  // ---- Panorama ----
  'show panorama-status':
`Panorama Server 1 : 10.0.0.20  Connected: yes  HA state: active-primary
Panorama Server 2 : 10.0.0.21  Connected: yes  HA state: passive
Connection type    : SSL
Push state         : in-sync`,
  'request panorama-push to device <serial>':
`Push job enqueued. Job ID: 412. Target serial: 0123456789.`,
  'show templates':
`Name              Description                              Members
HQ-Network        HQ interface/zone/VR template            PA-3220-1, PA-3220-2
Branch-Network    Branch firewall template                 PA-220-NYC, PA-220-LON`,
  'show device-group':
`Name           Parent      Devices  Pre-rules  Post-rules
Shared         shared      —         2          1
HQ-DGs         Shared      2         18         3
Branches       Shared      14        6          2`,
  'request license fetch':
`License fetch job enqueued. Job ID 423. Use 'show jobs id 423' to monitor.`,
  'show devicegroups':
`Name           Devices    Templates     Pre-rules
HQ-DGs         2          HQ-Network    18
Branches       14         Branch-Net    6`,
  'show devicegroups name <dg>':
`Device-Group: HQ-DGs
  Parent          : Shared
  Devices         : PA-3220-1 (0123456789), PA-3220-2 (0123456790)
  Pre-rules       : 18
  Post-rules      : 3
  Address objects : 432
  Service objects : 38`,
  'show template-stack':
`Name            Templates                      Members
HQ-Stack        HQ-Network, Shared-Net         PA-3220-1, PA-3220-2
Branch-Stack    Branch-Net, Shared-Net         PA-220-NYC, PA-220-LON`,
  'show devices all':
`Serial          Hostname        Connected   Model     SW-Version  Last-commit
0123456789      PA-3220-1       yes         PA-3220   11.1.4      2026/05/24 09:00:00
0123456790      PA-3220-2       yes         PA-3220   11.1.4      2026/05/24 09:00:00
9876543210      PA-220-NYC      no          PA-220    10.2.9      2026/05/22 14:01:11`,
  'show devices connected':
`Serial          Hostname        Model     Connected since
0123456789      PA-3220-1       PA-3220   2026/05/01 08:00:00
0123456790      PA-3220-2       PA-3220   2026/05/01 08:00:00
9876543211      PA-220-LON      PA-220    2026/05/24 06:11:18`,
  'show devices disconnected':
`Serial          Hostname        Model     Last seen
9876543210      PA-220-NYC      PA-220    2026/05/24 04:12:08`,
  'show devices summary':
`Connected         : 13 / 14
HA pairs in-sync  : 5  / 5
Out-of-sync       : 0
Disconnected      : 1`,
  'show log-collector all':
`Name            Serial         IP             Connected   Free disk
LC-HQ-1         0987654321     10.0.0.30      yes         88%
LC-HQ-2         0987654322     10.0.0.31      yes         87%`,
  'show log-collector connected':
`LC-HQ-1   10.0.0.30   connected   2026/05/01 08:00:00
LC-HQ-2   10.0.0.31   connected   2026/05/01 08:00:00`,
  'show log-collector-group':
`Name            Members             Status
HQ-LC-Group     LC-HQ-1, LC-HQ-2    healthy`,
  'show log-collector preference-list':
`Devices                      Preference list
PA-3220-1, PA-3220-2         LC-HQ-1 (primary), LC-HQ-2 (secondary)
Branches                     LC-HQ-1 (primary), LC-HQ-2 (secondary)`,
  'commit-all shared-policy':
`Commit-all (shared-policy) job enqueued. Job ID 430. Pushing to all device-groups.`,
  'commit-all shared-policy device-group <dg>':
`Commit-all (shared-policy) job enqueued for device-group HQ-DGs. Job ID 431.`,
  'commit-all template <tpl>':
`Commit-all (template HQ-Network) job enqueued. Job ID 432.`,
  'commit-all template-stack <ts>':
`Commit-all (template-stack HQ-Stack) job enqueued. Job ID 433.`,
  'request commit-status':
`In-progress jobs:
  Job 430  commit-all shared-policy  20% complete  ETA 02:11
Last completed:
  Job 429  commit  finished 2026/05/24 09:00:08 (7.4 sec)`,
  'show jobs id <n>':
`Job ID    : 430
Type      : Commit-All-Shared-Policy
Status    : FIN
Progress  : 100%
Elapsed   : 2m 12s
Targets   : 16 devices (16 success, 0 failed)`,
  'request batch software upgrade install file <pkg> devices ALL':
`Batch software install job enqueued for 16 devices. Job ID 440. PAN-OS file: PanOS-11.1.5.`,
  'request system software download version <ver>':
`Software download job enqueued. Job ID 441. Version: 11.1.5.`,
  'request system software install version <ver>':
`Software install job enqueued. Job ID 442. Version: 11.1.5. Device will need reboot.`,

  // ---- Sessions & Flows ----
  'show session all filter source <ip> destination <ip>':
`Session count: 2
ID    Application   State   Src                Dst                Proto  Ingress/Egress
1024  web-browsing  ACTIVE  10.0.2.55:51234    203.0.113.10:80    TCP    eth1/2 / eth1/1
1025  ssl           ACTIVE  10.0.2.55:51235    93.184.216.34:443  TCP    eth1/2 / eth1/1`,
  'show session all filter application <app>':
`Session count: 412
ID    Source                Destination         State    Proto  Rule
1024  10.0.2.55:51234       203.0.113.10:443    ACTIVE   TCP    Allow-Web
1025  10.0.2.99:51900       198.51.100.20:443   ACTIVE   TCP    Allow-Web
... (truncated)`,
  'show session info':
`Number of sessions supported   : 250,000
Number of active sessions      : 18,233
Sessions per second (max)      : 5,200
Session table utilisation      : 7%
TCP / UDP / ICMP / Other       : 80% / 18% / 1% / 1%`,
  'clear session all filter source <ip>':
`Cleared 12 sessions with source 10.0.2.55.`,
  'clear session id <n>':
`Session 1024 cleared.`,

  // ---- Packet Diagnostics ----
  'debug dataplane packet-diag set filter on':
`Packet filter is on. All active filters will match.`,
  'debug dataplane packet-diag set capture stage receive file rx.pcap':
`Capture stage 'receive' configured to write to /var/tmp/rx.pcap.`,
  'debug dataplane packet-diag set capture stage drop file drop.pcap':
`Capture stage 'drop' configured to write to /var/tmp/drop.pcap.`,
  'debug dataplane packet-diag set capture on':
`Packet capture is on. PCAPs are being written to /var/tmp/.`,
  'debug dataplane packet-diag set capture off':
`Packet capture is off. Use 'view-pcap filter-pcap <file>' or scp out.`,
  'view-pcap filter-pcap rx.pcap':
`Reading from /var/tmp/rx.pcap, 412 packets:
1  09:30:11.123  10.0.2.55 -> 8.8.8.8  ICMP echo request id=1024 seq=1
2  09:30:11.128  8.8.8.8 -> 10.0.2.55  ICMP echo reply   id=1024 seq=1`,
  'scp export filter-pcap from rx.pcap to <user>@<host>:/tmp/':
`scp: copying /var/tmp/rx.pcap to admin@10.0.0.50:/tmp/rx.pcap ... done (412 KB).`,

  // ---- GlobalProtect ----
  'show global-protect-portal current-portal':
`Portal name: GP-Portal
Hostname   : vpn.acme.com
Authentication-profile : SAML-Azure
Agent users (last 24h) : 1,842`,
  'show global-protect-gateway current-gateway':
`Gateway     : GP-Gateway
Tunnel IPs  : 10.50.0.0/16
Connected users : 142
Tunnel mode : split-tunnel
Encryption  : aes-256-gcm`,
  'show global-protect-gateway flow tunnel-id <n>':
`Tunnel: 12
  User              : ACME\\jbloggs
  Source IP         : 198.51.100.20
  Tunnel IP         : 10.50.0.12
  Bytes  in / out   : 18.2 MB / 4.8 MB
  Encryption        : aes-256-gcm`,
  'request global-protect-gateway client-logout user <user>':
`User ACME\\jbloggs logged out from GlobalProtect gateway. Tunnel terminated.`,

  // ---- SSL Decryption ----
  'show system setting ssl-decrypt setting':
`SSL Decryption enabled         : yes
Forward proxy CA               : SSL-Decrypt-CA
Sessions decrypted (current)   : 412
Total decrypted (last 24h)     : 14,832,002`,
  'show system setting ssl-decrypt certificate':
`Forward Trust CA      : SSL-Decrypt-CA  (valid until 2030/01/01)
Forward Untrust CA    : SSL-Untrust-CA  (valid until 2027/06/01)
Active sessions       : 412`,
  'show system setting ssl-decrypt session-cache':
`Cached cert entries : 1,842
Hits / Misses       : 14,801,232 / 12,442
Cache utilisation   : 38%`,
  'debug dataplane show ssl-decrypt session-summary':
`Active SSL decrypt sessions: 412
  by-version: TLS1.3: 280  TLS1.2: 130  TLS1.0: 2
  by-cipher : ECDHE-RSA-AES256-GCM 350  ECDHE-ECDSA-AES128-GCM 60  other 2`,
  'debug dataplane show ssl-decrypt ssl-stats':
`Handshake successes  : 14,830,221
Handshake failures   : 1,781
Unsupported ciphers  : 412
Cert errors          : 248`,

  // ---- URL & Threat Updates ----
  'request content upgrade check':
`Application & threat content
  Installed: 8754-8543 (2026/05/23)
  Latest   : 8755-8555 (2026/05/24)  available`,
  'request content upgrade download latest':
`Content download job enqueued. Job ID 460. Version: 8755-8555.`,
  'request content upgrade install version latest':
`Content install job enqueued. Job ID 461. Version: 8755-8555.`,
  'request anti-virus upgrade install version latest':
`Antivirus install job enqueued. Job ID 462. Version: 4685-5211.`,
  'request wildfire upgrade install version latest':
`WildFire signature install job enqueued. Job ID 463. Version: 821232-1.`,
  'request url-filtering download status':
`URL filtering download status:
  Vendor    : pan-db
  Status    : up-to-date  (last update 2026/05/24 06:00:01)
  Db size   : 1.2 GB`
};

// Apply EX to all sections in paloalto.
let filled = 0;
for (const arr of Object.values(S)) {
  for (const c of arr) {
    if (!c.example && EX[c.cmd]) { c.example = EX[c.cmd]; filled++; }
  }
}
console.log(`Filled examples: ${filled}`);

// ===== New commands appended to existing sections =========================
// Avoid exact-cmd duplicates: skip if cmd already exists in that section.
function appendUnique(section, items) {
  const exist = new Set(S[section].map(c => c.cmd));
  let added = 0;
  for (const it of items) {
    if (!exist.has(it.cmd)) { S[section].push(it); exist.add(it.cmd); added++; }
  }
  return added;
}

const additions = {
  'System & Status': [
    { cmd: 'show system state', desc: 'Dump full runtime state (large XML) — TAC-style deep inspection',
      type: 'troubleshooting', flagged: true,
      example: `system: { hostname: PA-3220, model: PA-3220, sn: 0123456789, uptime: 12d 4h 2m, family: 3000 }
session: { active: 18233, capacity: 250000 }
... (very large; usually piped to "| match <key>")` },
    { cmd: 'show system info | match "uptime|software-version|serial"', desc: 'Quick triage one-liner — what device, what code, how long up',
      type: 'show', flagged: false,
      example: `serial:        0123456789
software-version: 11.1.4
uptime:        12 days, 4 hours, 2 minutes` },
    { cmd: 'show system files', desc: 'Lists files in /opt/tmp and other working directories (cores, pcaps)',
      type: 'show', flagged: false,
      example: `Filename                    Size      Date
/var/tmp/rx.pcap            412 KB    2026/05/24 09:30:11
/var/tmp/drop.pcap          1.2 MB    2026/05/24 09:30:11
/opt/panlogs/cores/         (empty)` },
    { cmd: 'show system services', desc: 'Lists daemons (mgmtsrvr, varrcvr, etc.) with PID and state',
      type: 'show', flagged: false,
      example: `Service           PID    Status
mgmtsrvr          1842   running
useridd           2104   running
logrcvr           2210   running
varrcvr           2218   running` },
    { cmd: 'show system temperature', desc: 'Per-component temperatures with thresholds and alarm state',
      type: 'show', flagged: false,
      example: `Component          Temp (C)   Min  Max  Alarm
CPU                42.1       0    85   no
Switch ASIC        38.7       0    80   no
PSU 1              28.4       0    65   no` },
    { cmd: 'show system environmentals', desc: 'Power, fan, and temperature health summary',
      type: 'show', flagged: false,
      example: `Power supplies : 2/2 OK
Fans           : 4/4 OK   Avg speed: 4200 RPM
Temperatures   : within thresholds` }
  ],
  'Interfaces': [
    { cmd: 'show interface aggregate-group', desc: 'LACP / aggregate group status and members',
      type: 'show', flagged: false,
      example: `ae1: state up  members: ethernet1/3 (up), ethernet1/4 (up)
  bundle speed: 2000 Mbps  hash: src-dst-ip-port
  LACP partner system-id: 00:23:04:00:00:01` },
    { cmd: 'show lacp', desc: 'Per-port LACP state (Actor / Partner system-id, port-priority, key)',
      type: 'show', flagged: false,
      example: `Group: ae1
  Member        Actor State    Partner State    Sys-ID
  ethernet1/3   ACTIVE/SYNC    ACTIVE/SYNC      00:23:04:00:00:01
  ethernet1/4   ACTIVE/SYNC    ACTIVE/SYNC      00:23:04:00:00:01` },
    { cmd: 'show interface vlan all', desc: 'L3 VLAN sub-interfaces summary',
      type: 'show', flagged: false,
      example: `VLAN  Interface           IP                Zone
10    ethernet1/1.10      10.0.10.1/24      users
20    ethernet1/1.20      10.0.20.1/24      voice` },
    { cmd: 'show interface tunnel all', desc: 'Tunnel interface status and VPN binding',
      type: 'show', flagged: false,
      example: `Name        State  IPSec tunnel       Local IP    Remote IP
tunnel.1    up     AWS-VPN            10.0.1.1    52.10.20.30
tunnel.2    up     Azure-VPN          10.0.1.1    13.94.55.66
tunnel.3    down   HQ-Branch          10.0.1.1    203.0.113.55` }
  ],
  'Routing': [
    { cmd: 'show routing protocol ospf interface', desc: 'OSPF-enabled interfaces with area, cost and hello/dead timers',
      type: 'show', flagged: false,
      example: `Interface       Area       Cost  Hello  Dead   Neighbors
ethernet1/2     0.0.0.0    10    10     40     1
ethernet1/3     0.0.0.1    10    10     40     1` },
    { cmd: 'show routing protocol ospf summary', desc: 'OSPF process summary: router-id, areas, LSA counts',
      type: 'show', flagged: false,
      example: `Router-ID         : 10.0.1.1
Areas             : 2
LSAs (Type-1/2/5) : 32 / 12 / 8
Neighbors         : 2 Full / 0 Init` },
    { cmd: 'show routing protocol bgp local-rib', desc: 'BGP Loc-RIB — best paths selected by the router',
      type: 'show', flagged: false,
      example: `Prefix              Next-hop      LocPref  MED   Origin   AS-Path
0.0.0.0/0           10.0.1.254    100      0     IGP      65100 i
10.10.0.0/16        10.0.2.254    100      0     IGP      i` },
    { cmd: 'show routing protocol bgp rib-in peer <peer>', desc: 'Routes received from a BGP peer (Adj-RIB-In)',
      type: 'show', flagged: false,
      example: `Peer: Edge1
Prefix              Next-hop      LocPref  MED   Status
0.0.0.0/0           10.0.1.254    100      0     best
198.51.100.0/24     10.0.1.254    100      0     ` },
    { cmd: 'clear routing protocol bgp peer <peer> soft in', desc: 'Soft-clear inbound (re-send route refresh) without dropping the peer',
      type: 'troubleshooting', flagged: false,
      example: `BGP soft inbound refresh sent to peer Edge1.` },
    { cmd: 'clear routing protocol bgp peer <peer>', desc: 'Hard-reset a BGP peer (drops + re-establishes)',
      type: 'troubleshooting', flagged: true,
      example: `BGP peer Edge1 hard-reset. Session will re-establish in a few seconds.` }
  ],
  'Security Policies': [
    { cmd: 'show running rule-use rule-base security type used vsys vsys1', desc: 'Rules with at least one hit since data was last cleared',
      type: 'show', flagged: false,
      example: `Vsys: vsys1
Rule-base: security
Used rules: Allow-DNS, Allow-Web, Default-Deny` },
    { cmd: 'request rule-hit-count reset rulebase security', desc: 'Reset all rule-hit counters for the security rulebase',
      type: 'troubleshooting', flagged: true,
      example: `Rule-hit-count reset for security rulebase. All counters set to 0.` }
  ],
  'NAT': [
    { cmd: 'show running nat-policy | match "<rule>"', desc: 'Search for a NAT rule by name without dumping the whole policy',
      type: 'show', flagged: false,
      example: `"Inbound-Web" {
        translate-to "dst: 10.0.10.10 port 8080";
}` },
    { cmd: 'show counter global filter category nat', desc: 'Global counters for NAT (pool exhaustion, port allocation failures)',
      type: 'show', flagged: false,
      example: `nat_pool_used               842
nat_pool_exhausted            0
nat_port_allocation_failed    0` }
  ],
  'VPN': [
    { cmd: 'show vpn gateway', desc: 'IKE gateways with peer-address, version, status',
      type: 'show', flagged: false,
      example: `Name        Peer-IP         Version   State    Last error
AWS-GW      52.10.20.30     IKEv2     up       —
Azure-GW    13.94.55.66     IKEv2     up       —
HQ-Branch   203.0.113.55    IKEv2     down     IKE phase-1 timeout` },
    { cmd: 'less mp-log ikemgr.log', desc: 'IKE negotiation log — phase-1/2 messages, proposals, failures',
      type: 'troubleshooting', flagged: false,
      example: `2026-05-24 09:30:01 ikemgr: IKE_SA_INIT request sent to 52.10.20.30
2026-05-24 09:30:01 ikemgr: IKE_AUTH success
2026-05-24 09:30:02 ikemgr: CHILD_SA established  spi=0xabcd1234` }
  ],
  'High Availability': [
    { cmd: 'request high-availability state passive', desc: 'Manually move this device into the passive state',
      type: 'troubleshooting', flagged: true,
      example: `HA state set to passive. Device will not forward traffic until peer fails or you set it to active.` },
    { cmd: 'show high-availability transitions', desc: 'History of HA state transitions and reasons',
      type: 'show', flagged: false,
      example: `Time                 From       To         Reason
2026/05/24 04:12:08  passive    active     peer link-monitor failure (ethernet1/3)
2026/05/24 04:18:12  active     passive    peer recovered` }
  ],
  'Monitoring & Diagnostics': [
    { cmd: 'show running tunnel flow all', desc: 'All active tunnel flows (IPSec, GRE, GP) with packet/byte counts',
      type: 'show', flagged: false,
      example: `Name           Type     State    Pkts in/out         Bytes in/out
tunnel.1       ipsec    up       12,231,442/11,889K  8.4 GB/1.2 GB
tunnel.2       ipsec    up       8,221,310/8,118K    5.1 GB/0.9 GB` },
    { cmd: 'debug dataplane internal pcap reset', desc: 'Reset internal PCAP buffers when debug captures get wedged',
      type: 'troubleshooting', flagged: true,
      example: `Dataplane internal PCAP buffers cleared.` },
    { cmd: 'show running global-ippool', desc: 'GP / VPN IP pool usage (allocated vs total)',
      type: 'show', flagged: false,
      example: `Pool: GP-Pool   Range: 10.50.0.0/16
Allocated: 142   Available: 65,394   Utilisation: 0.2%` }
  ]
};

let added = 0;
for (const [sec, items] of Object.entries(additions)) {
  if (!S[sec]) continue;
  added += appendUnique(sec, items);
}
console.log(`Appended commands: ${added}`);

// ===== New sections ========================================================

const NEW_SECTIONS = {
  'Authentication & Admin': [
    { cmd: 'show admins', desc: 'List currently logged-in administrators with role and IP',
      type: 'show', flagged: false,
      example: `Admin       Role         From IP        Session     Idle
admin       superuser    10.0.0.5       CLI/SSH     0:12:33
asmith      device-admin 10.0.0.6       Web         0:01:11` },
    { cmd: 'show admins all', desc: 'Configured admin users — name, role, authentication profile',
      type: 'show', flagged: false,
      example: `Name        Role            Auth-profile          Last login
admin       superuser       local                 2026/05/24 08:00:00
asmith      device-admin    SAML-Azure            2026/05/24 09:02:11
jbloggs     audit           TACACS-Cisco          2026/05/22 14:00:01` },
    { cmd: 'set mgt-config users <user> authentication-profile <profile>', desc: 'Bind an admin user to an external auth profile (RADIUS / TACACS+ / SAML / Kerberos)',
      type: 'config', flagged: false,
      example: `# (configure) set mgt-config users asmith authentication-profile SAML-Azure
[edit]` },
    { cmd: 'set authentication-profile <name> method radius server-profile <srv>', desc: 'Create an authentication profile using a RADIUS server-profile',
      type: 'config', flagged: false,
      example: `# (configure) set shared authentication-profile RADIUS-Auth method radius server-profile NPS-1
[edit]` },
    { cmd: 'set shared server-profile radius <name> server <s> host <ip> port 1812 secret <psk>', desc: 'Define a RADIUS server-profile (host, port, shared secret)',
      type: 'config', flagged: false,
      example: `# (configure) set shared server-profile radius NPS-1 server NPS-Primary host 10.0.0.50 port 1812 secret <redacted>
[edit]` },
    { cmd: 'set shared server-profile tacplus <name> server <s> host <ip> secret <psk>', desc: 'Define a TACACS+ server-profile',
      type: 'config', flagged: false,
      example: `# (configure) set shared server-profile tacplus ACS-1 server ACS-Primary host 10.0.0.60 secret <redacted>
[edit]` },
    { cmd: 'test authentication authentication-profile <profile> username <u> password', desc: 'Test an auth profile end-to-end without logging in',
      type: 'troubleshooting', flagged: false,
      example: `Enter password : ********
Target vsys is not specified, user "asmith" is assumed to be configured with a shared auth profile.
Do allow list check before sending out authentication request...
name "asmith" is in the allow list.
Authentication succeeded for user "asmith".` },
    { cmd: 'less mp-log authd.log', desc: 'Auth daemon log — useful for diagnosing RADIUS/TACACS/SAML failures',
      type: 'troubleshooting', flagged: false,
      example: `2026-05-24 09:32:01 authd: RADIUS auth request username=asmith server=10.0.0.50
2026-05-24 09:32:01 authd: RADIUS Accept (role=device-admin)
2026-05-24 09:32:08 authd: SAML response received from idp=login.microsoftonline.com` },
    { cmd: 'show authentication allow-list', desc: 'Effective allow-list applied by current auth profiles',
      type: 'show', flagged: false,
      example: `Profile           Allow-list
SAML-Azure        ACME-Admins, ACME-NetEng
RADIUS-Auth       all
TACACS-Cisco      ACME-NetEng` },
    { cmd: 'set deviceconfig system permitted-ip <ip>', desc: 'Lock the management plane down to a list of allowed source IPs/CIDRs',
      type: 'config', flagged: true,
      example: `# (configure) set deviceconfig system permitted-ip 10.0.0.0/24
[edit]` }
  ],
  'WildFire': [
    { cmd: 'show wildfire status', desc: 'WildFire cloud connection state, queue depths and verdict counters',
      type: 'show', flagged: false,
      example: `WildFire cloud      : wildfire.paloaltonetworks.com
Region              : us-west
Connection          : connected
Sample queue depth  : 0
Verdicts received   : 14,832 (malicious 12, suspicious 4, benign 14,816)` },
    { cmd: 'show wildfire statistics', desc: 'Submission counters by file type with malicious/benign breakdown',
      type: 'show', flagged: false,
      example: `Type     Submitted   Malicious   Benign   Pending
PE         5,142          8       5,130        4
PDF        2,201          1       2,200        0
APK          412          3         409        0
DOC          908          0         908        0` },
    { cmd: 'show wildfire local', desc: 'Status of an on-prem WF-500 / WildFire appliance (if used)',
      type: 'show', flagged: false,
      example: `Local WildFire           : enabled (10.0.0.40)
Health                   : up
Cloud forwarding         : enabled
Queue                    : 0` },
    { cmd: 'request wildfire registration', desc: 'Re-register with the WildFire cloud (after model change / RMA)',
      type: 'troubleshooting', flagged: false,
      example: `WildFire registration job enqueued. Job ID 510.` },
    { cmd: 'show running wildfire-policy', desc: 'WildFire analysis profiles bound to security rules',
      type: 'show', flagged: false,
      example: `Profile: WF-Strict
  PE / PDF / Office  -> forward to public cloud
  APK                -> forward to public cloud
  ZIP / RAR          -> forward to public cloud` },
    { cmd: 'show wildfire signature pull', desc: 'WildFire signature pull cadence and last successful pull',
      type: 'show', flagged: false,
      example: `Last pull : 2026/05/24 09:30:02
Interval  : 1 minute
Status    : up-to-date (signature 821232-1)` }
  ],
  'DNS Security': [
    { cmd: 'show dns-proxy statistics', desc: 'DNS proxy hit/miss/cache statistics',
      type: 'show', flagged: false,
      example: `Queries received : 1,820,442
Cache hits       : 1,514,201
Cache misses     :   306,241
Upstream         : 8.8.8.8, 1.1.1.1
NXDOMAIN         :   18,402` },
    { cmd: 'show dns-proxy cache all', desc: 'Cached DNS entries (FQDN, TTL, RR type)',
      type: 'show', flagged: false,
      example: `FQDN                       Type   TTL    Answer
www.example.com            A      284    93.184.216.34
google.com                 A      198    142.250.74.46
malicious.example.com      A      sink   sinkholed` },
    { cmd: 'show dns-security statistics', desc: 'DNS Security cloud lookup volume and verdict breakdown',
      type: 'show', flagged: false,
      example: `Cloud lookups       : 142,802
Verdicts:
  benign            : 140,118
  command-and-ctrl  :   1,442
  malware           :     842
  phishing          :     400` },
    { cmd: 'show dns-proxy sinkhole', desc: 'Configured sinkhole IPs (IPv4/IPv6) used to redirect malicious DNS',
      type: 'show', flagged: false,
      example: `Sinkhole IPv4 : 72.5.65.111  (Palo Alto default)
Sinkhole IPv6 : 2600:5200::1
Use rule(s)  : Anti-Spyware-Strict` },
    { cmd: 'request dns-security update', desc: 'Force a refresh of DNS Security category lists',
      type: 'troubleshooting', flagged: false,
      example: `DNS Security category refresh job enqueued. Job ID 520.` }
  ],
  'Policy-Based Forwarding': [
    { cmd: 'show pbf rule all', desc: 'Show all configured PBF rules with action and forwarding next-hop',
      type: 'show', flagged: false,
      example: `Name             From       Source         App      Action       Egress    Next-hop
Branch-PBF       trust      10.0.2.0/24    any      forward      tunnel.2  Azure-GW
Mgmt-PBF         trust      10.0.5.0/24    ssh      forward      eth1/9    10.0.5.254` },
    { cmd: 'show pbf rule <name>', desc: 'Detail for one PBF rule (monitor, symmetric-return, schedule)',
      type: 'show', flagged: false,
      example: `Rule: Branch-PBF
  From zone        : trust
  Source           : 10.0.2.0/24
  Forward to       : tunnel.2 next-hop Azure-GW
  Symmetric return : enabled
  Path monitor     : Azure-Monitor (UP)
  Schedule         : 24x7` },
    { cmd: 'show counter global filter category pbf', desc: 'PBF-related global counters (rule hits, monitor failures)',
      type: 'show', flagged: false,
      example: `pbf_rule_match              18421
pbf_path_monitor_failed        12
pbf_symmetric_return_used    8412` },
    { cmd: 'test pbf-policy-match from <zone> source <ip> destination <ip>', desc: 'Find which PBF rule a candidate flow would match',
      type: 'troubleshooting', flagged: false,
      example: `Match: "Branch-PBF" -> forward via tunnel.2 (Azure-GW)` }
  ],
  'SD-WAN': [
    { cmd: 'show sdwan path-monitor', desc: 'Per-link health: latency, jitter, packet loss vs SLA thresholds',
      type: 'show', flagged: false,
      example: `Link        Latency  Jitter  Loss   Status   SLA
ISP1-MPLS    8 ms     1 ms    0.0%   Healthy  Voice, Video
ISP2-Cable  22 ms     4 ms    0.2%   Healthy  General
ISP3-LTE    62 ms    18 ms    1.4%   Degraded backup-only` },
    { cmd: 'show sdwan link-policy', desc: 'SD-WAN path-quality policy and the link each app currently rides',
      type: 'show', flagged: false,
      example: `Policy: Voice-First
  ms-teams      -> ISP1-MPLS  (latency target 80 ms)
  saas-general  -> ISP2-Cable
  default       -> ISP1-MPLS, ISP2-Cable (load-share)` },
    { cmd: 'show sdwan event', desc: 'SD-WAN link state-change and SLA breach event log',
      type: 'show', flagged: false,
      example: `2026/05/24 08:12:03  ISP3-LTE  brownout-start  loss=4.2%
2026/05/24 08:14:01  ISP3-LTE  brownout-end    loss=0.4%
2026/05/24 09:32:55  ISP2-Cable jitter-spike   jitter=22ms` },
    { cmd: 'show sdwan session distribution policy <p>', desc: 'How sessions are currently distributed across links by an SD-WAN policy',
      type: 'show', flagged: false,
      example: `Policy: Voice-First
  ISP1-MPLS  : 412 sessions (62%)
  ISP2-Cable : 248 sessions (37%)
  ISP3-LTE   :   8 sessions (1%) (backup)` },
    { cmd: 'show sdwan link-statistics', desc: 'Per-link byte / packet / drop counters',
      type: 'show', flagged: false,
      example: `Link        Pkts in/out         Bytes in/out         Drops
ISP1-MPLS   12,231,442/11,889K  8.4 GB/1.2 GB        0
ISP2-Cable  8,221,310/8,118K    5.1 GB/0.9 GB        12` }
  ],
  'Quality of Service': [
    { cmd: 'show qos statistics', desc: 'QoS class/queue counters per interface',
      type: 'show', flagged: false,
      example: `Interface: ethernet1/1
Class    Forwarded   Dropped   Bandwidth used
1 (RT)   1,842,211       0     12 Mbps
2        18,224,887     412    142 Mbps
3         3,221,408      18     22 Mbps` },
    { cmd: 'show qos interface <if>', desc: 'QoS profile attached to an interface with policer/shaper config',
      type: 'show', flagged: false,
      example: `Interface : ethernet1/1
Egress QoS profile : Internet-Egress  (1 Gbps total)
  Class 1 (Realtime) : guaranteed 50M, max 100M
  Class 2 (Business) : guaranteed 200M, max 800M
  Class 3 (Bulk)     : guaranteed 50M, max 1000M (best-effort)` },
    { cmd: 'show qos policy', desc: 'QoS classification policy — what app/source/zone maps to which class',
      type: 'show', flagged: false,
      example: `Rule              From    To       App                     Class
RT-Voice          trust   untrust  ms-teams, sip            1
Business-Web      trust   untrust  web-browsing, ssl        2
Bulk-Backup       trust   untrust  bittorrent, scp          3` },
    { cmd: 'show qos throttling', desc: 'Any active QoS throttling (policer/shaper drops in last interval)',
      type: 'show', flagged: false,
      example: `Interface     Class    Drops (1m)    Cause
ethernet1/1   2          412         exceed-policed
ethernet1/1   3           18         shaper-queue-full` }
  ],
  'Threat Prevention': [
    { cmd: 'show threat content', desc: 'Currently installed Threat Prevention (App/Threat) content version',
      type: 'show', flagged: false,
      example: `Content version          : 8754-8543
Released                 : 2026/05/23 18:00:01
Last upgrade             : 2026/05/24 06:00:01
Auto-update enabled      : yes` },
    { cmd: 'show threat id <threat-id>', desc: 'Look up a Threat Vault entry by ID (vulnerability, spyware, virus)',
      type: 'show', flagged: false,
      example: `Threat ID       : 65532
Name            : Generic.Backdoor.RCE-2026.001
Type            : vulnerability
Severity        : critical
CVE             : CVE-2026-12345
Default action  : reset-both` },
    { cmd: 'show running anti-virus', desc: 'Currently active Antivirus profile bindings and default actions',
      type: 'show', flagged: false,
      example: `Profile : default
  HTTP / FTP / SMB / SMTP / POP3 / IMAP : alert (default), block on critical
Profile : strict
  HTTP / FTP / SMB / SMTP / POP3 / IMAP : block` },
    { cmd: 'show running anti-spyware', desc: 'Currently active Anti-Spyware profile bindings',
      type: 'show', flagged: false,
      example: `Profile : strict
  DNS sinkhole       : enabled  (sinkhole 72.5.65.111)
  Reset-both         : critical, high
  Default action     : alert` },
    { cmd: 'show running vulnerability', desc: 'Currently active Vulnerability Protection profile bindings',
      type: 'show', flagged: false,
      example: `Profile : strict
  Severity critical/high  : reset-both
  Severity medium          : reset-server
  Severity low             : alert` },
    { cmd: 'show counter global filter category threat', desc: 'Global counters for threat engine (resets, blocks, sigs hit)',
      type: 'show', flagged: false,
      example: `threat_engine_sig_match      18421
threat_engine_reset_both       422
threat_engine_alert          15822
threat_engine_block_url        832` },
    { cmd: 'less mp-log threat.log', desc: 'Threat-engine debug log (sig load, profile binding errors)',
      type: 'troubleshooting', flagged: false,
      example: `2026-05-24 06:00:01 threat: loaded content 8754-8543 (sigs: 142,802)
2026-05-24 06:00:02 threat: bound strict profile to rule Allow-Web` }
  ]
};

let newSecs = 0, newCmds = 0;
for (const [name, items] of Object.entries(NEW_SECTIONS)) {
  if (S[name]) continue; // don't clobber
  S[name] = items;
  newSecs++;
  newCmds += items.length;
}
console.log(`New sections: ${newSecs}, new commands in those sections: ${newCmds}`);

// Stamp updatedAt and write.
j.updatedAt = new Date().toISOString();
writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
console.log('Written ' + path);
