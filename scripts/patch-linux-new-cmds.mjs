#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../data/commands.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(filePath, 'utf8'));

function patch(platform, section, cmd, example) {
  const s = data.platforms[platform].sections[section];
  if (!s) { console.warn('SECTION NOT FOUND:', section); return; }
  const c = s.find(x => x.cmd === cmd);
  if (!c) { console.warn('CMD NOT FOUND in', section, ':', cmd); return; }
  if (c.example && c.example.trim()) return;
  c.example = example;
}

// ── Linux / Networking ─────────────────────────────────────────────────────────
patch('linux', 'Networking', 'ethtool -S <iface>',
`$ ethtool -S eth0
NIC statistics:
     rx_packets: 14780123
     tx_packets: 12453012
     rx_bytes: 11012345678
     tx_bytes: 9876543210
     rx_errors: 0
     tx_errors: 0
     rx_dropped: 0
# Per-NIC driver statistics — field names vary by driver (Intel, Broadcom, etc.)
# Look for non-zero rx_errors/tx_errors/rx_dropped to identify hardware-level issues.`);

patch('linux', 'Networking', 'ip link set <iface> up',
`$ ip link set eth1 up
$ ip link show eth1
3: eth1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP
# Brings the interface administratively UP.
# LOWER_UP in the flags indicates L2 link is also established (cable connected).
# Equivalent legacy command: ifconfig eth1 up`);

patch('linux', 'Networking', 'ip link set <iface> down',
`$ ip link set eth1 down
$ ip link show eth1
3: eth1: <BROADCAST,MULTICAST> mtu 1500 qdisc mq state DOWN
# Brings the interface administratively DOWN.
# The interface loses all L3 addresses and routes when brought down.`);

patch('linux', 'Networking', 'ip addr del <ip>/<mask> dev <iface>',
`$ ip addr del 192.168.1.100/24 dev eth0
$ ip addr show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 00:50:56:aa:bb:cc brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0
# Removes the specified IP address from the interface.
# Other addresses on the same interface are unaffected.`);

patch('linux', 'Networking', 'ip route del <network> via <gateway>',
`$ ip route del 10.20.0.0/16 via 10.0.0.1
$ ip route show
default via 10.0.0.1 dev eth0
10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5
# Deletes a specific static route.
# Omit "via <gateway>" to delete a directly connected (link) route.`);

patch('linux', 'Networking', 'ip -s link',
`$ ip -s link show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    RX:  bytes  packets  errors  dropped  missed   mcast
     11012345678 14780123       0        5       0       0
    TX:  bytes  packets  errors  dropped carrier collsns
      9876543210 12453012       0        0       0       0
# -s adds traffic statistics to ip link output.
# Non-zero dropped/errors indicate hardware issues or buffer exhaustion.`);

patch('linux', 'Networking', 'bridge link',
`$ bridge link
3: eth1@eth1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 master br0 state forwarding priority 32 cost 4
4: eth2@eth2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 master br0 state forwarding priority 32 cost 4
# Lists all interfaces attached to software bridges with their STP state.
# STP states: disabled, blocking, listening, learning, forwarding`);

patch('linux', 'Networking', 'bridge vlan',
`$ bridge vlan show
port              vlan-id
eth1              1 PVID Egress Untagged
eth2              10
eth2              20
br0               1 PVID Egress Untagged
# Shows VLAN filtering configuration on each bridge port.
# PVID = Port VLAN ID (native/untagged VLAN); add with: bridge vlan add vid 10 dev eth2`);

patch('linux', 'Networking', 'bridge fdb show',
`$ bridge fdb show
00:50:56:aa:bb:cc dev eth1 master br0 permanent
01:00:5e:00:00:01 dev eth1 self permanent
33:33:00:00:00:01 dev eth1 self permanent
aa:bb:cc:dd:ee:ff dev eth2 master br0
# Shows the MAC forwarding table for software bridges.
# "permanent" entries are static; learned dynamic entries time out.`);

patch('linux', 'Networking', 'tc qdisc show',
`$ tc qdisc show dev eth0
qdisc mq 0: root
qdisc fq_codel 0: parent :1 limit 10240p flows 1024 quantum 1514 target 5ms interval 100ms memory_limit 32Mb ecn
# Shows the queueing discipline (qdisc) attached to each interface.
# mq = multi-queue (hardware offload); fq_codel = Fair Queue CoDel (default modern Linux).
# High-rate drops in "backlog" indicate buffer bloat or burst traffic.`);

// ── Linux / Diagnostics ────────────────────────────────────────────────────────
patch('linux', 'Diagnostics', 'journalctl -u <service>',
`$ journalctl -u nginx --since "1 hour ago" --no-pager
Jan 01 12:00:01 host nginx[1234]: 2026/01/01 12:00:01 [notice] 1#1: using the "epoll" event method
Jan 01 12:00:01 host nginx[1234]: 2026/01/01 12:00:01 [notice] 1#1: nginx/1.24.0
Jan 01 12:01:15 host nginx[1234]: 10.0.0.5 - - [01/Jan/2026:12:01:15 +0000] "GET / HTTP/1.1" 200 1234
# Shows journal logs for a specific systemd unit — no more grepping /var/log.
# Add -f to follow (tail) the log in real time.`);

patch('linux', 'Diagnostics', 'journalctl -k',
`$ journalctl -k --since "today" --no-pager | tail -10
Jan 01 11:58:02 host kernel: eth0: renamed from veth1a2b3c
Jan 01 11:59:15 host kernel: NET: Registered PF_INET6 protocol family
Jan 01 12:00:01 host kernel: [  0.000000] BIOS-provided physical RAM map
# -k shows kernel ring buffer messages from the journal.
# Equivalent to: dmesg | grep -i "..." but with timestamps and persistent storage.`);

patch('linux', 'Diagnostics', 'dmesg -T',
`$ dmesg -T | tail -5
[Mon Jan  1 12:00:01 2026] eth0: renamed from veth1a2b3c
[Mon Jan  1 12:01:15 2026] EXT4-fs (sda1): mounted filesystem
[Mon Jan  1 12:02:00 2026] usb 1-1: new high-speed USB device number 4
# -T converts kernel timestamps from seconds-since-boot to wall-clock time.
# Essential for correlating kernel events with application log timestamps.`);

patch('linux', 'Diagnostics', 'systemctl list-units --failed',
`$ systemctl list-units --failed
  UNIT                  LOAD   ACTIVE SUB    DESCRIPTION
● mysql.service         loaded failed failed MySQL Community Server
● cron.service          loaded failed failed Regular background program processing daemon

LOAD   = Reflects whether the unit definition was properly loaded.
ACTIVE = The high-level unit activation state.
SUB    = The low-level unit activation sub-state.
2 loaded units listed.
# Lists all systemd units in failed state — quick system health check.`);

patch('linux', 'Diagnostics', 'systemctl list-timers',
`$ systemctl list-timers
NEXT                        LEFT          LAST                         PASSED  UNIT
Mon 2026-01-01 13:00:00 UTC 30min left   Mon 2026-01-01 12:00:00 UTC  30min ago  logrotate.timer
Mon 2026-01-01 14:00:00 UTC 1h 30min left Mon 2026-01-01 11:00:00 UTC  1h 30min ago apt-daily.timer
# Lists active systemd timers with next/last activation times.
# Replacement for cron — timers persist across reboots and log via journald.`);

patch('linux', 'Diagnostics', 'ps aux',
`$ ps aux | head -6
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1 170092 10240 ?        Ss   00:00   0:04 /sbin/init
root       512  0.0  0.5 282112 40960 ?        Ss   00:00   0:01 /usr/bin/python3 /usr/bin/networkd-dispatcher
nginx     1234  0.2  1.2 144340 98304 ?        S    12:00   0:03 nginx: worker process
# a = all users, u = user-oriented format, x = processes without a TTY.
# Sort by CPU: ps aux --sort=-%cpu | head; by MEM: ps aux --sort=-%mem | head`);

patch('linux', 'Diagnostics', 'ps -eo pid,%cpu,%mem,cmd --sort=-%cpu | head',
`$ ps -eo pid,%cpu,%mem,cmd --sort=-%cpu | head -6
  PID %CPU %MEM CMD
 1234  45.2  2.1 /usr/bin/python3 heavy_script.py
  512   8.3  0.5 /usr/sbin/nginx -g daemon off;
  789   3.1  1.8 /usr/bin/node server.js
    1   0.0  0.1 /sbin/init
# Custom format: shows PID, CPU%, memory%, and full command sorted by CPU usage.
# -o e expands environment vars; add vsz,rss for memory in KB.`);

patch('linux', 'Diagnostics', 'lsof',
`$ lsof | head -5
COMMAND  PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
systemd    1   root  cwd    DIR    8,1     4096    2 /
systemd    1   root  rtd    DIR    8,1     4096    2 /
nginx   1234   root    4u  IPv4  32456      0t0  TCP *:80 (LISTEN)
# Lists all open files (sockets, pipes, devices, regular files) system-wide.
# Very verbose — always pipe with grep, e.g.: lsof -p 1234 | grep REG`);

patch('linux', 'Diagnostics', 'lsof -i',
`$ lsof -i | head -10
COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
sshd    5678 root    3u  IPv4  23456      0t0  TCP *:22 (LISTEN)
nginx   1234 root    4u  IPv4  32456      0t0  TCP *:80 (LISTEN)
nginx   1234 root    5u  IPv4  32457      0t0  TCP *:443 (LISTEN)
python  7890 user    6u  IPv4  45678      0t0  TCP 10.0.0.5:52345->8.8.8.8:443 (ESTABLISHED)
# -i lists only network sockets.
# Filter: lsof -i :443  — processes listening or connected on port 443.`);

patch('linux', 'Diagnostics', 'lsof -i :<port>',
`$ lsof -i :80
COMMAND  PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
nginx   1234   root    4u  IPv4  32456      0t0  TCP *:80 (LISTEN)
nginx   1235   www-data 4u  IPv4  32456      0t0  TCP *:80 (LISTEN)
# Lists all processes with a socket bound to or connected from port 80.
# Equivalent (faster): ss -tlnp | grep :80`);

// ── 10 NEW COMMANDS ─────────────────────────────────────────────────────────────
// 1. Palo Alto / Routing — FIB lookup
data.platforms.paloalto.sections['Routing'].push({
  cmd: 'show routing fib lookup ip <ip>',
  desc: 'Performs a Forwarding Information Base (FIB) lookup for a specific destination IP — shows the actual next-hop the dataplane would use',
  type: 'show',
  flagged: false,
  example: `> show routing fib lookup ip 8.8.8.8

FIB lookup results for ip 8.8.8.8

Dest: 8.8.8.8
Longest matching route:
  0.0.0.0/0 via 10.0.0.1 egress eth1/1 (default-route)
  VR: default

# Confirms the exact forwarding path for a destination IP at the dataplane level.
# Useful for validating routing after a change or debugging traffic drops.
# Distinguish from: show routing route (control plane RIB) — this shows the FIB.`
});

// 2. Palo Alto / Monitoring & Diagnostics — LLDP neighbours
data.platforms.paloalto.sections['Monitoring & Diagnostics'].push({
  cmd: 'show lldp neighbors all',
  desc: 'Displays LLDP neighbour table — adjacent devices, their port IDs, system names, and capabilities discovered via LLDP',
  type: 'show',
  flagged: false,
  example: `> show lldp neighbors all

Interface    Chassis ID          Port ID         System Name         Capabilities  TTL
ethernet1/1  00:50:56:aa:bb:cc   GigabitEthernet0/1  core-sw01.example.com  B, R        120
ethernet1/2  00:1a:2b:3c:4d:5e   Gi1/0/24        dist-sw02.example.com  B           120

Capabilities: B=Bridge, R=Router, T=Telephone, W=WLAN-AP

# Enable LLDP: Device → Setup → Session → LLDP → enable per-interface.
# Requires LLDP enabled on both this PA and the connected neighbour.`
});

// 3. Cisco IOS / Interfaces — show interface counters
data.platforms.ciscoios.sections['Interfaces'].push({
  cmd: 'show interface <iface> counters',
  desc: 'Displays detailed hardware counter statistics for an interface: unicast, multicast, broadcast, error, and discard counts in both directions',
  type: 'show',
  flagged: false,
  example: `router# show interface GigabitEthernet0/0 counters

Port         InOctets  InUcastPkts  InMcastPkts  InBcastPkts
Gi0/0      1234567890     14780123       123456         4321

Port        OutOctets OutUcastPkts OutMcastPkts OutBcastPkts
Gi0/0       987654321     12453012        98765         1234

Port        InErrors  OutErrors   InDiscards OutDiscards
Gi0/0              0          0            5           0

# Non-zero InDiscards typically indicates input queue drops (interface overloaded).
# Non-zero Errors indicates physical-layer problems (cable, duplex mismatch, etc.).
# Reset counters: clear counters GigabitEthernet0/0`
});

// 4. Cisco IOS / Switching & STP — show spanning-tree detail
data.platforms.ciscoios.sections['Switching & STP'].push({
  cmd: 'show spanning-tree detail',
  desc: 'Displays detailed STP/RSTP information per VLAN: root bridge, port roles, timers, topology change counts, and transition history',
  type: 'show',
  flagged: false,
  example: `switch# show spanning-tree detail

 VLAN0010 is executing the rstp compatible Spanning Tree protocol
  Bridge Identifier has priority 32778, sysid 10, address 0050.56aa.bbcc
  Configured hello time 2, max age 20, forward delay 15, transmit hold-count 6
  Current root has priority 4106, address 0050.56cc.ddee
  Root port is 1 (GigabitEthernet1/0/1), cost of root path is 4
  Topology change flag not set, detected flag not set
  Number of topology changes 3, last change occurred 0:05:34 ago
          from GigabitEthernet1/0/24
  Port 1 (GigabitEthernet1/0/1) of VLAN0010 is Root Forwarding
    Port path cost 4, Port priority 128, Port Identifier 128.1.
    Designated root has priority 4106, address 0050.56cc.ddee
    Designated bridge has priority 4106, address 0050.56cc.ddee

# Topology changes are the main indicator of STP instability.
# Investigate ports with frequent transitions — check for flapping links.`
});

// 5. Linux / Networking — ss -tlnp
data.platforms.linux.sections['Networking'].push({
  cmd: 'ss -tlnp',
  desc: 'Lists all TCP listening sockets with port numbers and the process name/PID — modern replacement for netstat -tlnp',
  type: 'show',
  flagged: false,
  example: `$ ss -tlnp
State    Recv-Q Send-Q Local Address:Port  Peer Address:Port  Process
LISTEN   0      128    0.0.0.0:22          0.0.0.0:*          users:(("sshd",pid=1234,fd=3))
LISTEN   0      511    0.0.0.0:80          0.0.0.0:*          users:(("nginx",pid=5678,fd=6))
LISTEN   0      511    0.0.0.0:443         0.0.0.0:*          users:(("nginx",pid=5678,fd=7))
LISTEN   0      128    127.0.0.1:3306      0.0.0.0:*          users:(("mysqld",pid=9012,fd=21))
# -t = TCP, -l = listening only, -n = numeric ports, -p = show process.
# To include IPv6: ss -tlnp6 or just ss -tlnp (usually shows both).`
});

// 6. Linux / Networking — ip vrf exec
data.platforms.linux.sections['Networking'].push({
  cmd: 'ip vrf exec <vrf> <cmd>',
  desc: 'Executes a command in the context of a named VRF (Virtual Routing and Forwarding instance) — routes are looked up in the VRF\'s separate routing table',
  type: 'config',
  flagged: false,
  example: `$ ip vrf exec mgmt ping -c4 8.8.8.8
PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
64 bytes from 8.8.8.8: icmp_seq=1 ttl=55 time=12.3 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=55 time=11.9 ms

$ ip vrf exec mgmt ip route show
default via 10.100.0.1 dev eth1
10.100.0.0/24 dev eth1 proto kernel scope link src 10.100.0.5

# Create a VRF: ip link add mgmt type vrf table 100 && ip link set mgmt up
# Assign interface: ip link set eth1 master mgmt
# VRFs are used for management plane isolation and L3VPN implementations.`
});

// 7. Linux / Networking — ip link add vxlan
data.platforms.linux.sections['Networking'].push({
  cmd: 'ip link add vxlan0 type vxlan id <vni> dstport 4789 remote <remote-ip>',
  desc: 'Creates a VXLAN overlay tunnel interface with a specified VNI (VXLAN Network Identifier) and remote VTEP endpoint',
  type: 'config',
  flagged: false,
  example: `$ ip link add vxlan0 type vxlan id 100 dstport 4789 remote 10.0.0.20 local 10.0.0.10 dev eth0
$ ip link set vxlan0 up
$ ip addr add 192.168.100.1/24 dev vxlan0
$ ip link show vxlan0
10: vxlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UNKNOWN
    link/ether 5e:aa:bb:cc:dd:ee brd ff:ff:ff:ff:ff:ff

# id 100 = VNI (VXLAN Network Identifier), unique per overlay network segment.
# MTU is 1450 = 1500 Ethernet - 50 bytes VXLAN/UDP/IP encapsulation overhead.
# VXLAN uses UDP port 4789 (IANA assigned); remote is the far VTEP address.
# Remove: ip link del vxlan0`
});

// 8. Linux / Networking — GRE tunnel
data.platforms.linux.sections['Networking'].push({
  cmd: 'ip tunnel add gre0 mode gre local <local-ip> remote <remote-ip> ttl 255',
  desc: 'Creates a GRE (Generic Routing Encapsulation) point-to-point tunnel interface for tunnelling any L3 traffic between two endpoints',
  type: 'config',
  flagged: false,
  example: `$ ip tunnel add gre1 mode gre local 10.0.0.10 remote 10.0.0.20 ttl 255
$ ip link set gre1 up
$ ip addr add 172.16.0.1/30 dev gre1
$ ip route add 192.168.100.0/24 dev gre1
$ ip tunnel show gre1
gre1: ip/ip  remote 10.0.0.20  local 10.0.0.10  ttl 255

# GRE encapsulates IP-in-IP; protocol number 47 (visible in Wireshark: gre filter).
# No encryption — combine with IPsec for secure tunnelling.
# ip6tnl: use mode ip6ip6 for IPv6-in-IPv6 tunnels.
# Remove: ip tunnel del gre1`
});

// 9. Cisco IOS / Routing › OSPF — debug ip ospf events
data.platforms.ciscoios.sections['Routing › OSPF'].push({
  cmd: 'debug ip ospf events',
  desc: 'Enables real-time OSPF event debugging — shows neighbour state transitions, SPF calculations, and hello/dead timer events in console output',
  type: 'config',
  flagged: true,
  example: `router# debug ip ospf events
OSPF events debugging is on

*Jan  1 12:00:01.123: OSPF-1 EVENT: Rcv hello from 2.2.2.2 on GigabitEthernet0/0
*Jan  1 12:00:01.125: OSPF-1 NEIGHBOR 2.2.2.2 on Gi0/0: State FULL -> DOWN (Dead timer expired)
*Jan  1 12:00:01.130: OSPF-1 EVENT: DR election on Gi0/0: 1.1.1.1 is DR, 2.2.2.2 is BDR
*Jan  1 12:00:03.500: OSPF-1 EVENT: Schedule SPF in area 0.0.0.0 due to topology change

! WARNING: Can generate high CPU/console output on busy OSPF networks.
! Disable immediately after capture: no debug ip ospf events
! Safer alternative: show ip ospf neighbor — for passive monitoring only.`
});

// 10. Cisco IOS / Routing › BGP — show bgp all summary
data.platforms.ciscoios.sections['Routing › BGP'].push({
  cmd: 'show bgp all summary',
  desc: 'Displays BGP peer summary for all address families (IPv4 unicast, IPv6 unicast, VPNv4, etc.) — prefixes received, peer state, and uptime',
  type: 'show',
  flagged: false,
  example: `router# show bgp all summary

For address family: IPv4 Unicast
BGP router identifier 10.0.0.1, local AS number 65001
BGP table version is 42, main routing table version 42
3 network entries using 744 bytes of memory
Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
10.0.0.2        4 65002    1423    1189       42    0    0 18:42:03        3
10.0.0.3        4 65003     512     489       42    0    0 08:15:22        12

For address family: IPv6 Unicast
Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
2001:db8::2     4 65002     234     212       12    0    0 08:15:22        2

# "Idle" or "Active" in State/PfxRcd indicates the session is not established.
# Compare with: show ip bgp summary (IPv4 only)`
});

// ── Write output ────────────────────────────────────────────────────────────────
data.updatedAt = new Date().toISOString();
writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('Linux + new commands patch applied successfully.');
