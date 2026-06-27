/**
 * One-shot enrichment script: adds 10 new commands and improves thin examples.
 * Run: node scripts/update-commands.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/commands.json');

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

// ─── HELPER ──────────────────────────────────────────────────────────────────
function addCmd(platform, section, cmd) {
  const sec = data.platforms[platform]?.sections?.[section];
  if (!sec) { console.warn('Section not found:', platform, section); return; }
  const exists = sec.some(c => c.cmd === cmd.cmd);
  if (exists) { console.warn('Already exists:', cmd.cmd); return; }
  sec.push(cmd);
  console.log('Added:', platform, '/', section, '/', cmd.cmd);
}

function updateCmd(platform, section, cmdStr, patch) {
  const sec = data.platforms[platform]?.sections?.[section];
  if (!sec) { console.warn('Section not found:', platform, section); return; }
  const entry = sec.find(c => c.cmd === cmdStr);
  if (!entry) { console.warn('Not found:', cmdStr); return; }
  Object.assign(entry, patch);
  console.log('Updated:', platform, '/', section, '/', cmdStr);
}

// ─── 10 NEW COMMANDS ─────────────────────────────────────────────────────────

// 1. Cisco ASA — Security: show threat-detection statistics
addCmd('ciscoasa', 'Security', {
  cmd: 'show threat-detection statistics',
  desc: 'Display per-protocol attack rate counters collected by the Basic Threat Detection engine, including burst and average rates for SYN, ACK, UDP, ICMP, scanning, and incomplete-session events.',
  type: 'show',
  flagged: false,
  example: `firewall# show threat-detection statistics

Average(eps)  Current(eps)  Trigger  Total events
  Scanning Threat:
        100          230        5     1580340
  Incomplete sessions:
          5           12        0      234100
  SYN Attack:
        220          455       12     3201450
  ACK Attack:
         45           89        2      654300
  UDP Burst Attack:
         12           22        0      102400
  ICMP Attack:
          3            7        0       34210

What it means:
- Average(eps): attacks per second averaged over the rate interval
- Current(eps): real-time rate for the last burst window
- Trigger: number of times the rate exceeded the configured threshold
- SYN Attack count above 200 eps warrants investigation of the upstream flow`
});

// 2. Cisco ASA — Security: show shun
addCmd('ciscoasa', 'Security', {
  cmd: 'show shun',
  desc: 'List all IP addresses currently shunned (dynamically blocked) by the ASA, typically triggered by IPS/IDS events or manual shun commands. Shows source IP, destination IP, port, and protocol of the blocked flow.',
  type: 'show',
  flagged: false,
  example: `firewall# show shun

Shun 192.168.1.100 0.0.0.0 0 0
Shun 10.0.0.55 172.16.0.1 80 6

Shun 192.168.1.100 0.0.0.0 0 0
  - src=192.168.1.100 blocked for all destinations and ports (blanket shun)

Shun 10.0.0.55 172.16.0.1 80 6
  - src=10.0.0.55 blocked to dst=172.16.0.1 on TCP port 80 (proto 6)

To remove a shun: no shun <src-ip>
To shun an IP:    shun <src-ip> [<dst-ip> <src-port> <dst-port> [<proto>]]`
});

// 3. Nexus — VLANs / VPC: show spanning-tree
addCmd('nexus', 'VLANs / VPC', {
  cmd: 'show spanning-tree',
  desc: 'Display the Spanning Tree topology for all VLANs, including the bridge role (Root/Designated), port states, port costs, and the root bridge MAC address for each VLAN instance.',
  type: 'show',
  flagged: false,
  example: `N9K# show spanning-tree

VLAN0001
  Spanning tree enabled protocol rstp
  Root ID    Priority    4097
             Address     0023.eb9e.4680
             Cost        4
             Port        Po1 (Port-channel1)
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec

  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)
             Address     001e.1432.5f00
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
             Aging Time  300 sec

Interface           Role Sts Cost      Prio.Nbr Type
------------------- ---- --- --------- -------- --------------------------------
Po1                 Root FWD 4         128.4097 P2p
Eth1/3              Desg FWD 4         128.3    P2p
Eth1/4              Desg FWD 4         128.4    P2p

What it means:
- Role Root  : this port is the root port (path to root bridge)
- Role Desg  : designated port (forwarding for the segment)
- Sts FWD    : forwarding — carrying traffic
- Sts BLK    : blocking — preventing loop`
});

// 4. Nexus — VLANs / VPC: show spanning-tree detail
addCmd('nexus', 'VLANs / VPC', {
  cmd: 'show spanning-tree detail',
  desc: 'Detailed per-VLAN STP output including topology change counters, port cost, hello/forward-delay timers, and BPDUs sent/received — useful for diagnosing TCN storms or slow convergence.',
  type: 'show',
  flagged: false,
  example: `N9K# show spanning-tree detail

VLAN0010 is executing the rstp compatible Spanning Tree protocol
  Bridge Identifier has priority 32768, sysid 10, address 001e.1432.5f00
  Configured hello time 2, max age 20, forward delay 15
  Current root has priority 4106, address 0023.eb9e.4680
  Root port is Po1 (Port-channel1), cost of root path is 4
  Topology change flag not set, detected flag not set
  Number of topology changes 12, last change occurred 4d02h ago
    from Ethernet1/5
  Times:  hold 1, topology change 35, notification 2
          hello 2, max age 20, forward delay 15
  Timers: hello 0, topology change 0, notification 0

Port 4097 (Port-channel1) of VLAN0010 is Root Forwarding
   Port path cost 4, Port priority 128, Port Identifier 128.4097
   Designated root has priority 4106, address 0023.eb9e.4680
   BPDUs: sent 43210, received 287654

What it means:
- topology changes 12 in 4d02h — low churn, healthy
- last change from Eth1/5 — investigate that port if changes spike`
});

// 5. AWS — CloudFormation: aws cloudformation list-stacks
addCmd('aws', 'CloudFormation', {
  cmd: 'aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE',
  desc: 'List all CloudFormation stacks matching the specified status filters. Useful for inventorying live stacks. Supports filters: CREATE_COMPLETE, UPDATE_COMPLETE, DELETE_FAILED, ROLLBACK_COMPLETE, and others.',
  type: 'show',
  flagged: false,
  example: `$ aws cloudformation list-stacks \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
    --query 'StackSummaries[*].[StackName,StackStatus,CreationTime]' \
    --output table

---------------------------------------------------
|                   ListStacks                    |
+---------------------+------------------+--------+
| prod-vpc-stack      | CREATE_COMPLETE  | 2025-01-10T09:22:14Z |
| prod-rds-stack      | UPDATE_COMPLETE  | 2025-03-14T15:33:01Z |
| staging-eks-cluster | CREATE_COMPLETE  | 2025-05-02T11:05:44Z |
+---------------------+------------------+--------+

Note: Deleted stacks are retained in the list for 90 days.
Filter by DELETE_FAILED to find stacks that failed to clean up.`
});

// 6. Windows — Networking: Test-Connection
addCmd('windows', 'Networking', {
  cmd: 'Test-Connection <host> -Count 4',
  desc: 'PowerShell equivalent of ping — sends ICMP echo requests to a host and reports RTT, TTL, and packet loss. Use -Quiet for a boolean pass/fail result. Supports -ComputerName for remote invocation.',
  type: 'show',
  flagged: false,
  example: `PS C:\\> Test-Connection 8.8.8.8 -Count 4

   Source        Destination     IPV4Address      IPV6Address  Bytes    Time(ms)
   ------        -----------     -----------      -----------  -----    --------
   WORKSTATION1  8.8.8.8         8.8.8.8                       32       14
   WORKSTATION1  8.8.8.8         8.8.8.8                       32       13
   WORKSTATION1  8.8.8.8         8.8.8.8                       32       14
   WORKSTATION1  8.8.8.8         8.8.8.8                       32       14

# Boolean check (returns True/False):
PS C:\\> Test-Connection 8.8.8.8 -Count 1 -Quiet
True

# Test a specific port (TCP):
PS C:\\> Test-NetConnection -ComputerName 8.8.8.8 -Port 443`
});

// 7. Windows — Networking: arp -a
addCmd('windows', 'Networking', {
  cmd: 'arp -a',
  desc: 'Display the ARP (Address Resolution Protocol) cache table for all interfaces, showing IP-to-MAC address mappings and their type (dynamic = learned, static = manually configured). Add an IP address to filter to one host.',
  type: 'show',
  flagged: false,
  example: `C:\\> arp -a

Interface: 192.168.1.100 --- 0x5
  Internet Address      Physical Address      Type
  192.168.1.1           00-11-22-33-44-55     dynamic
  192.168.1.200         aa-bb-cc-dd-ee-ff     dynamic
  192.168.1.255         ff-ff-ff-ff-ff-ff     static
  224.0.0.22            01-00-5e-00-00-16     static
  255.255.255.255       ff-ff-ff-ff-ff-ff     static

# Clear the ARP cache:
  arp -d *
# Add a static entry:
  arp -s 192.168.1.50 00-AA-BB-CC-DD-EE`
});

// 8. ESXi — Networking: net-stats
addCmd('esxi', 'Networking', {
  cmd: 'net-stats -A',
  desc: 'Display real-time network packet statistics for all virtual NICs and uplinks on the ESXi host. Shows packets/s, bytes/s, drops, and errors per port — useful for identifying saturated or erroring NICs without needing vCenter.',
  type: 'show',
  flagged: false,
  example: `[root@esxi:~] net-stats -A

     Port    Pkts/s  MBps   Drops  Errors  Name
     ----    ------  ----   -----  ------  ----
     67108866  45120  350.2      0       0  vmnic0
     67108867  44988  349.7      0       0  vmnic1
     83886080     12    0.1      0       0  Management Network
     83886081  22400  174.3      0       0  vMotion
     83886082  88640  345.2     14       0  VM Network

What it means:
- Port 67108866/67: physical uplinks (vmnic0/1) — balanced traffic, no drops
- vMotion at 174 MBps — active migration in progress
- VM Network has 14 drops — possible uplink saturation or misconfigured MTU
- Run 'net-stats -l' to list ports with friendly names`
});

// 9. Linux — Networking: tcpdump on any interface
addCmd('linux', 'Networking', {
  cmd: "tcpdump -i any -nn -s0 'port 80 or port 443' -w /tmp/cap.pcap",
  desc: '# capture HTTP/HTTPS traffic on ALL interfaces to a file for offline analysis. -nn disables name resolution (faster). -s0 captures full packets. Press Ctrl+C to stop, then open the .pcap in Wireshark.',
  type: 'show',
  flagged: false,
  example: `$ sudo tcpdump -i any -nn -s0 'port 80 or port 443' -w /tmp/cap.pcap
tcpdump: listening on any, link-type LINUX_SLL (Linux cooked v1), snapshot length 262144 bytes
^C
3412 packets captured
3412 packets received by filter
0 packets dropped by kernel

# Analyse the capture in Wireshark:
  wireshark /tmp/cap.pcap &

# Quick text summary instead of writing a file:
  sudo tcpdump -i eth0 -nn 'port 443' -c 20

# Filter by host and port:
  sudo tcpdump -i eth0 -nn 'host 10.0.0.5 and port 443'`
});

// 10. Aruba CX — Diagnostics: show copp statistics
addCmd('aruba_cx', 'Diagnostics', {
  cmd: 'show copp statistics',
  desc: 'Display Control Plane Policing (CoPP) statistics: packets passed and dropped per traffic class (ARP, BGP, OSPF, ICMP, SSH, etc.). High drop counters on a class indicate control-plane rate limiting is active and may affect adjacency stability.',
  type: 'show',
  flagged: false,
  example: `aruba-cx# show copp statistics

Traffic Class               Passed Pkts   Dropped Pkts   Passed Bytes  Dropped Bytes
-----------                 -----------   ------------   ------------  -------------
ARP                           123456789              0    9,876,543,210             0
BGP                             3456789              0      345,678,900             0
OSPF                              45678              0        4,567,800             0
ICMP                           1234567             45      123,456,700         4,500
SSH/Telnet                       23456              0        2,345,600             0
LACP                             12345              0        1,234,500             0
STP                               4567              0          456,700             0
UNCLASSIFIED                    234567           1234       23,456,700       123,400

What it means:
- ICMP has 45 dropped packets — switch is rate-limiting ICMP toward CPU (normal)
- UNCLASSIFIED drops indicate unrecognised traffic hitting the CPU — investigate
- BGP/OSPF drops=0 is healthy; non-zero may cause neighbour flaps
- Run 'clear copp statistics' to reset counters after baselining`
});

// ─── UPDATE THIN COMMANDS ────────────────────────────────────────────────────
// NetScaler — System & Status

updateCmd('netscaler', 'System & Status', 'show ns mode -summary', {
  example: `> show ns mode -summary
Enabled modes: L3, EDGE, FR, USNIP
Disabled modes: DRADV, RISE_APBR, RISE_RHI

# Verify with full output to see all modes and descriptions:
> show ns mode
Enabled modes:
  L3             L3 routing enabled
  EDGE           Edge/perimeter deployment
  USNIP          Use SNIP for server-side connections
  FR             Fast Ramp enabled
  MBF            (disabled)`
});

updateCmd('netscaler', 'System & Status', 'show cache policy -summary', {
  example: `> show cache policy -summary
Policy Name          Hits    Misses
--------------------  ------  ------
cache_images          14308     314
cache_static           8892     102
bypass_api                0       0

Total Policies: 3  Total Hits: 23200  Total Misses: 416`
});

updateCmd('netscaler', 'System & Status', 'show compression vserver -summary', {
  example: `> show compression vserver -summary
VS Name              State   Hits    Bytes Saved
--------------------  -------  ------  -----------
vs_web_443           UP       12903   1.42 GB
vs_app_80            UP        3210   245 MB
vs_api_8443          DOWN         0   0 B

Active VSes: 2  Inactive: 1  Total Hits: 16113`
});

updateCmd('netscaler', 'System & Status', 'show dns record -summary', {
  example: `> show dns record -summary
Type  Name                       Data              TTL
----  -------------------------  ----------------  ----
A     www.example.com            10.10.10.100      300
A     api.example.com            10.10.10.101      300
CNAME cdn.example.com           d1abc.example.com  60
MX    example.com               mail.example.com   3600

Total Records: 4  (A: 2  CNAME: 1  MX: 1)`
});

updateCmd('netscaler', 'System & Status', 'show dns policy -summary', {
  example: `> show dns policy -summary
Policy Name         Expression              Action     Hits
-----------------   ---------------------   --------   -----
dns_internal        CLIENT.IP.SRC.IN_SUBNET(10.0.0.0/8)  dns_view_internal  118
dns_external        TRUE                    dns_view_ext    2

Total Policies: 2  Total Hits: 120`
});

updateCmd('netscaler', 'System & Status', 'show ns version -summary', {
  example: `> show ns version -summary
13.1.42.47.nc

# Full detail:
> show ns version
  NetScaler NS13.1: Build 42.47.nc, Date: Jan 12 2024, 10:22:15
  Kernel: Linux 4.19.247 #14 SMP`
});

updateCmd('netscaler', 'System & Status', 'set snmp community public -read ALL', {
  example: `> set snmp community public -read ALL
Done.

# Verify the new community:
> show snmp community
Community:  public  , Permissions: READ
Bound to SNMP manager: ALL (any IP allowed)

Note: Using "public" in production is a security risk — use a strong
community string and restrict source IPs with:
  add snmp manager 10.10.10.0 -netmask 255.255.255.0`
});

updateCmd('netscaler', 'System & Status', 'set ns mode L3 EDGE MBF', {
  example: `> set ns mode L3 EDGE MBF
Done.

# Confirm the change:
> show ns mode
Enabled modes:
  L3     Layer-3 routing (non-transparent mode)
  EDGE   Edge deployment (public-facing ADC)
  MBF    MAC-Based Forwarding (asymmetric routing support)

Caution: Changing modes on a live appliance may disrupt active sessions.
         Save the config and coordinate a maintenance window.`
});

updateCmd('netscaler', 'System & Status', 'set ntp server 129.6.15.28 -minpoll 6', {
  example: `> set ntp server 129.6.15.28 -minpoll 6
Done.

# Confirm:
> show ntp server -summary
Total NTP: 1  Synced: YES

> show ntp server
NTP Server: 129.6.15.28  Min Poll: 64s (2^6)  Max Poll: 1024s (2^10)
State: synchronized  Stratum: 1  Offset: +0.423ms  Jitter: 0.512ms`
});

updateCmd('netscaler', 'System & Status', 'set audit syslogAction Srv_1 -logLevel CRITICAL', {
  example: `> set audit syslogAction Srv_1 -logLevel CRITICAL
Done.

# Verify:
> show audit syslogAction Srv_1
Name:       Srv_1
ServerIP:   10.50.50.50
Port:       514
LogLevel:   CRITICAL
Transport:  UDP
Format:     Default

Only CRITICAL events (and above) will now be forwarded. Available levels:
  EMERGENCY > ALERT > CRITICAL > ERROR > WARNING > NOTICE > INFO > DEBUG`
});

// NetScaler — Configuration Management
updateCmd('netscaler', 'Configuration Management', 'save config', {
  example: `> save config
Done.

Configuration saved to /nsconfig/ns.conf.

# Verify by comparing running and saved config:
> show ns config
# (output shows saved timestamp)

Tip: Always run 'save config' after any set/add/bind/unbind/rm command —
NetScaler does NOT auto-save. Unsaved changes are lost on reboot.`
});

updateCmd('netscaler', 'Configuration Management', 'set ns hostname', {
  example: `> set ns hostname NS-ADC-PROD-01
Done.

# Confirm the change:
> show ns hostname
Hostname: NS-ADC-PROD-01

Note: The new hostname appears in the CLI prompt after the next login.
A save config + reboot may be required for SNMP sysName to update.`
});

updateCmd('netscaler', 'Configuration Management', 'save ns config', {
  example: `> save ns config
Done.

This is an alias for 'save config'. The running configuration is written to
/nsconfig/ns.conf and will be loaded on the next reboot.

# Check when the file was last saved:
  shell ls -la /nsconfig/ns.conf
  -rw-r--r-- 1 root root 18432 Jun 27 14:35 /nsconfig/ns.conf`
});

updateCmd('netscaler', 'Configuration Management', 'reboot -warm', {
  example: `> reboot -warm
This operation will reboot the device, do you want to continue? (Y/N)? Y
Done.

A warm reboot reloads the NetScaler software without a full hardware
re-initialisation:
  - Faster than a cold reboot (~60s vs ~120s typical)
  - Does NOT interrupt the hardware packet engines during the early boot phase
  - Use after kernel-level config changes, SSL cert replacements, or upgrades
    that specify a warm reboot

Monitor recovery with 'show system' or ping the NSIP from another host.`
});

// NetScaler — Load Balancing
updateCmd('netscaler', 'Load Balancing', 'show lb group -summary', {
  example: `> show lb group -summary
Group Name        State   Members  Active
----------------  -------  -------  ------
LB_GRP_Web        ENABLED      4       4
LB_GRP_API        ENABLED      2       1
LB_GRP_DB         DISABLED     3       0

Total Groups: 3  Active: 2  Disabled: 1`
});

updateCmd('netscaler', 'Load Balancing', 'set lb vserver LB_VS_1 -state DISABLED', {
  example: `> set lb vserver LB_VS_1 -state DISABLED
Done.

# Confirm:
> show lb vserver LB_VS_1
Name:  LB_VS_1  State: OUT OF SERVICE  IP: 10.10.10.200  Port: 443
Effective State: DOWN  (administratively disabled)

Existing connections continue to be served until they close (graceful drain).
New connections are refused with a RST or an HTTP 503, depending on your
responder policy. Re-enable with:
  set lb vserver LB_VS_1 -state ENABLED`
});

updateCmd('netscaler', 'Load Balancing', 'set service SVC_1 -maxClient 500', {
  example: `> set service SVC_1 -maxClient 500
Done.

# Confirm:
> show service SVC_1
Name: SVC_1  IP: 10.10.10.10  Port: 80
State: UP  Current Connections: 312  Max Connections: 500
When the limit is reached new connections are queued (or dropped if
-maxClientRsnCode is set). Monitor connection headroom with:
  show service SVC_1 | grep -i "current\|max"`
});

updateCmd('netscaler', 'Load Balancing', 'set lb monitor MON_1 -interval 10 -resptimeout 5', {
  example: `> set lb monitor MON_1 -interval 10 -resptimeout 5
Done.

# Confirm new timing:
> show lb monitor MON_1
Name: MON_1  Type: HTTP
Interval: 10s  Response Timeout: 5s  Down Time: 30s
Failed Probes: 0  Successful Probes: 1204
State: UP

A tighter interval catches failures faster but increases probe traffic.
Ratio rule: resptimeout < interval (5 < 10 here — correct).`
});

updateCmd('netscaler', 'Load Balancing', 'bind lb vserver LB_VS_1 SVC_2', {
  example: `> bind lb vserver LB_VS_1 SVC_2
Done.

# Verify the binding:
> show lb vserver LB_VS_1
1)  SVC_1  (10.10.10.10:80)  State: UP  Weight: 1
2)  SVC_2  (10.10.10.11:80)  State: UP  Weight: 1

SVC_2 is now included in the load-balancing pool. New connections will be
distributed across both services according to the configured LB method
(e.g., ROUNDROBIN, LEASTCONNECTION).`
});

updateCmd('netscaler', 'Load Balancing', 'disable lb vserver LB_VS_1', {
  example: `> disable lb vserver LB_VS_1
Done.

# Confirm:
> show lb vserver LB_VS_1 | grep -i state
State: OUT OF SERVICE

Equivalent to 'set lb vserver LB_VS_1 -state DISABLED'.
Existing sessions drain gracefully; new connections receive a TCP RST or HTTP
503 depending on responder policy. Use during planned maintenance.`
});

updateCmd('netscaler', 'Load Balancing', 'enable lb vserver LB_VS_1', {
  example: `> enable lb vserver LB_VS_1
Done.

# Confirm:
> show lb vserver LB_VS_1 | grep -i state
State: UP  Effective State: UP

The vserver is accepting new connections again. Monitor for an initial traffic
spike as queued or reconnecting clients hit the service.`
});

// NetScaler — High Availability
updateCmd('netscaler', 'High Availability', 'force ha failover', {
  example: `> force ha failover
This operation will result in the peer node taking over as primary, do you want to continue? (Y/N)? Y
Done.

# On the now-Primary node:
> show ha node
Node  IP           State    Sync State   Master State
----  -----------  -------  -----------  ------------
  0   10.10.10.10  PRIMARY  ENABLED      Primary
  1   10.10.10.11  SECONDARY ENABLED     Secondary

# On the former Primary (now Secondary):
> show ha node
  0   10.10.10.10  SECONDARY ENABLED     Secondary

Allow 5-10 seconds for the new Primary to fully take over before
resuming configuration changes.`
});

updateCmd('netscaler', 'High Availability', 'sync ha files', {
  example: `> sync ha files
Done.

Files synchronised from Primary to Secondary include:
  /nsconfig/ssl/      (certificates and keys)
  /nsconfig/          (custom scripts, monitors)
  /var/netscaler/ssl/ (dynamic certificates)

Run after updating SSL certificates or custom files on the Primary.
Config sync (running-config) happens automatically — this command only
covers filesystem-level files.

# Verify sync status:
> show ha node
Sync State: ENABLED  In Sync: YES`
});

updateCmd('netscaler', 'High Availability', 'set ns rpcNode 10.10.10.20 -password NewPass123', {
  example: `> set ns rpcNode 10.10.10.20 -password NewPass123
Done.

The RPC password secures inter-node communication for HA configuration sync.
Both nodes must use the same password. After changing:
  1. Run the same command on the peer node pointing back to this node's IP.
  2. Verify sync resumes: show ha node

Security note: choose a strong, unique password — RPC traffic is internal
but the password is stored in the running config.`
});

updateCmd('netscaler', 'High Availability', 'set ha node -hasync DISABLED', {
  example: `> set ha node -hasync DISABLED
Done.

# Confirm:
> show ha node 0
Sync State:  DISABLED  (manual sync only)

With HA sync disabled, configuration changes on the Primary are NOT
automatically replicated to the Secondary. Use for troubleshooting only.
Re-enable immediately after: set ha node -hasync ENABLED`
});

// NetScaler — Networking
updateCmd('netscaler', 'Networking', 'show router id', {
  example: `> show router id
Router ID: 10.10.10.10

The Router ID is the NSIP by default. It is used as the BGP/OSPF router
identifier. Change with:
  set ns routerId <ip>
A save + restart of dynamic routing is required for the change to take effect.`
});

updateCmd('netscaler', 'Networking', 'show ns simpleacl -hits', {
  example: `> show ns simpleacl -hits
Rule  Src IP       Src Mask        Action  Hits
----  -----------  --------------  ------  --------
1     10.0.0.5     255.255.255.255 DENY    45
2     10.0.0.10    255.255.255.255 DENY     0
3     192.168.0.0  255.255.0.0     ALLOW   89234

Rules with 0 hits may be stale — review before removing.
High DENY hits signal active scanning or an incorrectly blocked source.`
});

updateCmd('netscaler', 'Networking', 'show ns ip6 -summary', {
  example: `> show ns ip6 -summary
IPv6 Address                   Type     State
-----------------------------  -------  ------
2001:db8::1/64                 NSIP     ENABLED
2001:db8::100/64               VIP      ENABLED

Total IPv6 IPs: 2  Active: 2

# Full detail including ND state:
> show ns ip6 2001:db8::1`
});

// NetScaler — SSL Management
updateCmd('netscaler', 'SSL Management', 'show ssl vserver -summary', {
  example: `> show ssl vserver -summary
VS Name              Protocol  Cert CN           Expiry (days)
-------------------  --------  ----------------  -------------
vs_web_443           TLSv1.3   *.example.com     120
vs_api_8443          TLSv1.2   api.example.com    14
vs_legacy_443        SSLv3     legacy.example.com EXPIRED

Total: 3  Active: 2  Cert Expiry < 30 days: 1  Expired: 1

Action required: vs_api_8443 cert expires in 14 days; vs_legacy_443 is EXPIRED.`
});

updateCmd('netscaler', 'SSL Management', 'show ssl cipher -summary', {
  example: `> show ssl cipher -summary
Cipher Group        Ciphers  Protocol  Strength
------------------  -------  --------  --------
SECURE_CIPHER_GROUP     18   TLS1.2+   HIGH
FIPS_CIPHER_GROUP        8   TLS1.2+   HIGH
LEGACY_CIPHER_GROUP     34   SSL3+     MEDIUM/LOW

Total Cipher Suites available: 34
Recommended: bind only SECURE or FIPS groups to production vservers.`
});

updateCmd('netscaler', 'SSL Management', 'show ssl profile -summary', {
  example: `> show ssl profile -summary
Profile Name         Type      Protocol  DH   SNI
-------------------  --------  --------  ---  ---
ns_default_ssl_profile Frontend TLS1.2+  OFF  ON
strict_frontend       Frontend  TLS1.3   ON   ON
backend_server        Backend   TLS1.2+  OFF  OFF

Frontend Profiles: 2  Backend Profiles: 1

Note: Always use a Frontend profile on client-facing vservers and a
separate Backend profile for server-side SSL to enforce different
cipher and protocol requirements.`
});

updateCmd('netscaler', 'SSL Management', 'rm ssl certKey Cert_Old', {
  example: `> rm ssl certKey Cert_Old
Done.

The certificate-key pair 'Cert_Old' has been removed from the ADC store.

Common error: "Certificate is bound to SSL vserver" — unbind first:
  unbind ssl vserver <vsname> -certkeyName Cert_Old

Then retry the rm command. Save config after removal:
  save config`
});

// NetScaler — AAA & Authentication
updateCmd('netscaler', 'AAA & Authentication', 'show aaa session -summary', {
  example: `> show aaa session -summary
Active Sessions:  45
Max Sessions:    500
Sessions Waiting: 0
Timed Out (last hour): 3

Avg Session Duration: 4m 22s
Auth Method: LDAP (38), LOCAL (7)

Capacity headroom: 91%.  If active sessions approach max, increase with:
  set aaa parameter -maxAAAUsers 1000`
});

updateCmd('netscaler', 'AAA & Authentication', 'show authentication radiusPolicy -hits', {
  example: `> show authentication radiusPolicy -hits
Policy Name         Expression              Hits
-----------------   ---------------------   ------
RAD_POL_1           TRUE                    129
RAD_POL_VPN         REQ.HTTP.HEADER Origin CONTAINS vpn  44
RAD_POL_ADMIN       CLIENT.IP.SRC.IN_SUBNET(10.99.0.0/24)  12

Total Policy Hits: 185`
});

updateCmd('netscaler', 'AAA & Authentication', 'show system group -summary', {
  example: `> show system group -summary
Group Name          Privilege      Members  CommandPolicies
-----------------   ------------   -------  ---------------
supergroup          superuser           2   (all commands)
read_only           read-only           5   show-only
noc_operators       operator            8   limited-write

Total Groups: 3  Total Members: 15`
});

// NetScaler — GSLB
updateCmd('netscaler', 'GSLB', 'show gslb vserver -summary', {
  example: `> show gslb vserver -summary
GSLB VS Name          State   Services  Active  LB Method
--------------------  -------  --------  ------  ----------
gslb_vs_web           UP          4         4    ROUNDROBIN
gslb_vs_api           UP          2         2    STATICPROXIMITY
gslb_vs_legacy        DOWN        1         0    ROUNDROBIN

Total GSLB Vservers: 3  UP: 2  DOWN: 1`
});

updateCmd('netscaler', 'GSLB', 'show gslb site -summary', {
  example: `> show gslb site -summary
Site Name      IP            State   RTT     Metric
-----------    -----------   -----   -----   ------
site_us_east   10.1.1.1      UP       2ms    100
site_eu_west   10.2.2.1      UP      45ms     98

Total Sites: 2  Active: 2  RTT collected via MEP or IP-Address-Based.`
});

updateCmd('netscaler', 'GSLB', 'show gslb service -summary', {
  example: `> show gslb service -summary
Service Name          Site           IP           State   Hits
--------------------  -----------    -----------  ------  ------
gslb_svc_us1          site_us_east   10.1.1.10    UP      28432
gslb_svc_us2          site_us_east   10.1.1.11    UP      27918
gslb_svc_eu1          site_eu_west   10.2.2.10    UP      14210
gslb_svc_eu2          site_eu_west   10.2.2.11    DOWN        0

Total GSLB Services: 4  UP: 3  DOWN: 1`
});

// NetScaler — AppFW
updateCmd('netscaler', 'AppFW', 'set appfw profile Pro_1 -sqlInjectionAction block', {
  example: `> set appfw profile Pro_1 -sqlInjectionAction block
Done.

# Confirm:
> show appfw profile Pro_1 | grep sql
SQL Injection Action: BLOCK

The AppFW will now block (drop with optional log) any request matching SQL
injection patterns. Available actions:
  none    — allow silently
  log     — allow but log the violation
  block   — drop the request (default recommendation)
  learn   — learn the pattern and add to allow-list (training mode)
  stats   — increment the violation counter only

Run 'show appfw profile Pro_1' to review all configured protections.`
});

// NetScaler — Content Switching
updateCmd('netscaler', 'Content Switching', 'show cs policy -summary', {
  example: `> show cs policy -summary
Policy Name         Expression                      Action       Hits
-----------------   --------------------------------  ----------  -------
cs_api              HTTP.REQ.URL.STARTSWITH("/api")   cs_api_vs   452100
cs_static           HTTP.REQ.URL.CONTAINS(".css")     cs_static   234500
cs_default          TRUE                              cs_web_vs   815200

Total CS Policies: 3  Total Hits: 1.5M`
});

// NetScaler — Rewrite & Responder
updateCmd('netscaler', 'Rewrite & Responder', 'show appflow policy -hits', {
  example: `> show appflow policy -hits
Policy Name         Expression              Hits
-----------------   ---------------------   ----------
AF_POL_Global       TRUE                    105932
AF_POL_VPN          REQ.HTTP.HEADER Host CONTAINS "vpn"   8234

Total AppFlow Policy Hits: 114166

AppFlow policies control which traffic is exported to analytics collectors
(Citrix Analytics, Splunk, etc.). High hit counts are expected for
catch-all (TRUE) policies bound globally.`
});

// ─── WLC thin commands ────────────────────────────────────────────────────────
updateCmd('wlc', 'AP CLI — Wired Uplink', 'show wired', {
  example: `AP-OFFICE-01# show wired

Interface: GigabitEthernet0
  IP Address: 10.10.10.45  Mask: 255.255.255.0
  Link: UP  Speed: 1000 Mbps  Duplex: Full
  TX Bytes: 5,432,100  RX Bytes: 8,234,500
  TX Errors: 0  RX Errors: 0
  VLAN Mode: Trunk  Native VLAN: 10

What it means:
- Link UP at 1G full-duplex — healthy uplink
- TX/RX errors = 0 — no physical layer issues
- Trunk mode — AP is in FlexConnect local switching or local authentication`
});

updateCmd('wlc', 'AP CLI — Diagnostics', 'show logging', {
  example: `AP-OFFICE-01# show logging

*Jun 27 14:22:01.456: %CAPWAP-5-DTLSREQSEND: DTLS connection request sent peer_ip: 10.10.0.10 peer_port: 5246
*Jun 27 14:22:01.789: %CAPWAP-5-DTLSREQSUCC: DTLS connection created successfully peer_ip: 10.10.0.10
*Jun 27 14:22:03.120: %CAPWAP-5-JOINEDCONTROLLER: AP has joined controller 10.10.0.10
*Jun 27 14:25:10.333: %DOT11-6-ASSOC: Station a4:c3:f0:11:22:33 Associated to SSID CORP-WIFI on radio 0

What it means:
- DTLS connection created — secure CAPWAP tunnel to WLC is established
- JOINEDCONTROLLER — AP successfully registered to the controller
- ASSOC event — a client device connected to the SSID`
});

updateCmd('wlc', 'AP CLI — Diagnostics', 'ping <controller-ip>', {
  example: `AP-OFFICE-01# ping 10.10.0.10
PING 10.10.0.10 (10.10.0.10): 56 data bytes
64 bytes from 10.10.0.10: seq=0 ttl=255 time=0.512 ms
64 bytes from 10.10.0.10: seq=1 ttl=255 time=0.488 ms
64 bytes from 10.10.0.10: seq=2 ttl=255 time=0.501 ms

--- 10.10.0.10 ping statistics ---
3 packets transmitted, 3 packets received, 0% packet loss
round-trip min/avg/max = 0.488/0.500/0.512 ms

What it means:
- 0% loss with <1ms RTT — normal for a same-site CAPWAP controller
- Loss or high RTT from the AP CLI (not client) indicates a wired uplink or
  routing issue affecting the CAPWAP control channel`
});

// ─── Linux thin commands ──────────────────────────────────────────────────────
updateCmd('linux', 'htop  # enhanced process viewer', 'pgrep name', {
  example: `$ pgrep nginx
1234
1235
1236

# Get PID + process name:
$ pgrep -a nginx
1234 nginx: master process /usr/sbin/nginx -g daemon on; master_process on;
1235 nginx: worker process
1236 nginx: worker process

# Kill by name (send SIGTERM):
$ pkill nginx`
});

updateCmd('linux', 'Networking', 'systemctl restart network', {
  example: `$ sudo systemctl restart network
$
# (No output means success — check status if there's a delay)

$ sudo systemctl status network
● network.service - LSB: Bring up/down networking
   Loaded: loaded (/etc/rc.d/init.d/network; generated)
   Active: active (running) since Fri 2026-06-27 14:30:01 UTC; 3s ago

Note: On modern Debian/Ubuntu systems, use:
  sudo systemctl restart networking    (Debian)
  sudo systemctl restart NetworkManager  (desktop systems)

On RHEL/CentOS 8+, 'network' is replaced by NetworkManager.`
});

updateCmd('linux', 'Ref 01. File & Directory Navigation', 'cd /path', {
  example: `$ cd /var/log
$ pwd
/var/log

$ ls
auth.log  syslog  kern.log  dpkg.log

# Common shortcut destinations:
$ cd ~        # go to home directory
$ cd -        # go to previous directory
$ cd ..       # go up one level`
});

updateCmd('linux', 'Ref 05. System Information & Monitoring', 'uname -r', {
  example: `$ uname -r
6.8.0-45-generic

# More detail:
$ uname -a
Linux hostname 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Fri Sep 13 12:28:36 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux

Fields: kernel-name  nodename  kernel-release  kernel-version  machine  processor  hardware-platform  OS`
});

// ─── Windows thin commands ────────────────────────────────────────────────────
updateCmd('windows', 'Networking', 'Clear-DnsClientCache', {
  example: `PS C:\\> Clear-DnsClientCache
(No output — success is silent)

PS C:\\> Get-DnsClientCache
(Empty — cache has been cleared)

# Verify a fresh lookup resolves correctly after the flush:
PS C:\\> Resolve-DnsName example.com

Name                Type   TTL  Section    IPAddress
----                ----   ---  -------    ---------
example.com         A      120  Answer     93.184.216.34`
});

updateCmd('windows', 'OOBE & Setup', 'shutdown /r /t 0', {
  example: `C:\\> shutdown /r /t 0
(Immediate reboot — no delay, no warning to logged-in users)

# Common variations:
  shutdown /s /t 0       — shutdown (power off) immediately
  shutdown /r /t 60      — reboot in 60 seconds with a warning
  shutdown /a            — abort a pending shutdown
  shutdown /r /t 0 /f    — force close apps and reboot immediately
  Restart-Computer       — PowerShell equivalent`
});

// ─── OpenSSL thin command ─────────────────────────────────────────────────────
updateCmd('openssl', 'Key Inspection & Manipulation', 'openssl rsa -in private.key -noout -modulus', {
  example: `$ openssl rsa -in private.key -noout -modulus
Modulus=D48AF2B1C3E4F5A6789B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F24A8C

# Common use: verify that the private key matches a certificate
$ openssl x509 -noout -modulus -in server.crt | md5sum
$ openssl rsa  -noout -modulus -in private.key | md5sum
# If both MD5 hashes are identical, the key and certificate are a matching pair.

# Also verify a CSR matches:
$ openssl req  -noout -modulus -in server.csr | md5sum`
});

// ─── ESXi thin command ────────────────────────────────────────────────────────
updateCmd('esxi', 'VM Management', 'vim-cmd vmsvc/power.shutdown <vmid>', {
  example: `[root@esxi:~] vim-cmd vmsvc/power.shutdown 8
Initiating guest OS shutdown for vmid 8.

# Get the VM ID first:
[root@esxi:~] vim-cmd vmsvc/getallvms
Vmid  Name                  File                    Guest OS       Version
8     ubuntu-web-01         [DS1] ubuntu-web-01.vmx  ubuntu64Guest  vmx-19
12    windows-dc-01         [DS1] windows-dc-01.vmx  windows9_64    vmx-19

# This command requires VMware Tools to be running inside the VM.
# If Tools are unresponsive, use a hard power-off:
  vim-cmd vmsvc/power.off 8

# Check power state:
  vim-cmd vmsvc/power.getstate 8`
});

// ─── Proxmox thin commands ────────────────────────────────────────────────────
updateCmd('proxmox', 'Virtual Machines (qm)', 'qm sendkey <VMID> <KEY>', {
  example: `# Send Ctrl+Alt+Del to VM 100 (triggers Windows restart dialog or Linux logout):
$ qm sendkey 100 ctrl-alt-delete
(Key sent to VM console — check Proxmox VNC console to confirm)

# Send Enter key:
$ qm sendkey 100 ret

# Common keys: esc, tab, space, ctrl-c, ctrl-d, alt-f2
# Use the Proxmox web console or 'qm terminal 100' to see the result.`
});

updateCmd('proxmox', 'Virtual Machines (qm)', 'qm unlock <VMID>', {
  example: `$ qm unlock 100
(Lock removed from VM 100 — no output on success)

# A VM lock is set during backup, snapshot, or migration to prevent
# concurrent conflicting operations. If the operation crashed, the lock
# may remain and prevent starting/modifying the VM.

# Check if a VM is locked:
$ qm config 100 | grep lock
lock: backup

# Unlock and then start:
$ qm unlock 100 && qm start 100`
});

updateCmd('proxmox', 'LXC Containers (pct)', 'pct enter <CTID>', {
  example: `$ pct enter 200
root@nginx-proxy:~#

# You are now in a shell inside container 200.
# Type 'exit' or press Ctrl+D to return to the Proxmox host shell.

# Equivalent using lxc-attach (lower level):
$ lxc-attach -n 200

# Run a single command without entering the container:
$ pct exec 200 -- systemctl status nginx`
});

updateCmd('proxmox', 'Storage (pvesm)', 'pvesm set <NAME> --disable 1', {
  example: `$ pvesm set DS-SLOW --disable 1
(Storage DS-SLOW disabled — no output on success)

# Confirm:
$ pvesm status
Name       Type   Status     Total         Used    Available   %
local      dir    active     100G          20G     80G          20%
DS-SLOW    nfs    disabled      -            -          -        -
DS-FAST    zfspool active    1000G        200G    800G          20%

# Re-enable:
$ pvesm set DS-SLOW --disable 0`
});

updateCmd('proxmox', 'Storage (pvesm)', 'pvesm alloc <STORAGE> <VMID> <NAME> 32G', {
  example: `$ pvesm alloc DS-FAST 999 vm-999-disk-0 32G
DS-FAST:vm-999-disk-0

# A new 32 GB volume named 'vm-999-disk-0' has been allocated on DS-FAST.
# The output is the full Proxmox volume ID (storage:volume-name).

# Attach the volume to a VM:
$ qm set 999 --scsi1 DS-FAST:vm-999-disk-0

# List allocated volumes for a storage:
$ pvesm list DS-FAST`
});

// ─── UPDATE TIMESTAMP ─────────────────────────────────────────────────────────
data.updatedAt = new Date().toISOString();

// ─── WRITE ────────────────────────────────────────────────────────────────────
writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
console.log('\nDone. commands.json updated.');
