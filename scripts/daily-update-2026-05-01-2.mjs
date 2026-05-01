#!/usr/bin/env node
// Daily KB update — 2026-05-01 (afternoon batch)
// 1. Fix 5 entries with corrupted/missing descriptions (CSV-comma split bugs).
// 2. Add example output to ~30 high-traffic commands across 8 platforms.
// 3. Add 3 new commands.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', 'data', 'commands.json');

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const plats = data.platforms;

let fixedDesc = 0, addedExamples = 0, addedNew = 0, deletedRows = 0;

function findIdx(plat, sec, predicate) {
  const arr = plats[plat]?.sections?.[sec];
  if (!Array.isArray(arr)) return -1;
  return arr.findIndex(predicate);
}

function setExample(plat, sec, cmd, example) {
  const idx = findIdx(plat, sec, c => c.cmd === cmd);
  if (idx < 0) { console.warn('NOT FOUND:', plat, '/', sec, '/', cmd); return false; }
  const entry = plats[plat].sections[sec][idx];
  if (entry.example && String(entry.example).trim().length > 2) {
    console.warn('SKIP (has example):', plat, '/', cmd);
    return false;
  }
  entry.example = example;
  addedExamples++;
  return true;
}

// ---------------------------------------------------------------------------
// 1. Fix corrupted/missing descriptions
// ---------------------------------------------------------------------------

// 1a. linux / "1. FILE & DIRECTORY NAVIGATION" / cmd is a separator dashes line
{
  const sec = '1. FILE & DIRECTORY NAVIGATION';
  const arr = plats.linux?.sections?.[sec];
  if (Array.isArray(arr)) {
    const before = arr.length;
    plats.linux.sections[sec] = arr.filter(
      c => !/^-{10,}$/.test(String(c.cmd || '').trim())
    );
    const removed = before - plats.linux.sections[sec].length;
    deletedRows += removed;
    if (plats.linux.sections[sec].length === 0) delete plats.linux.sections[sec];
  }
}

// 1b. linux / Diagnostics: ps -eo pid (CSV-split corruption — desc=cmd, type=%cpu)
{
  const sec = 'Diagnostics';
  const idx = findIdx('linux', sec, c => c.cmd === 'ps -eo pid' && c.desc === 'cmd');
  if (idx >= 0) {
    const e = plats.linux.sections[sec][idx];
    e.cmd = 'ps -eo pid,%cpu,%mem,cmd --sort=-%cpu | head';
    e.desc = 'List processes sorted by CPU usage with PID, CPU%, memory%, and full command';
    e.type = 'show';
    fixedDesc++;
  }
}

// 1c-e. wireshark / TShark: -z conv,tcp / -z endpoints,tcp / -q -z io,phs
{
  const sec = 'TShark';
  const fixes = [
    {
      match: c => c.cmd === 'tshark -z conv' && c.desc === 'tcp',
      cmd: 'tshark -z conv,tcp -r capture.pcap',
      desc: 'Display TCP conversation statistics from a capture (talkers, bytes, duration)',
      type: 'show',
    },
    {
      match: c => c.cmd === 'tshark -z endpoints' && c.desc === 'tcp',
      cmd: 'tshark -z endpoints,tcp -r capture.pcap',
      desc: 'Display TCP endpoint statistics from a capture (per-host packets/bytes)',
      type: 'show',
    },
    {
      match: c => c.cmd === 'tshark -q -z io' && c.desc === 'phs',
      cmd: 'tshark -q -z io,phs -r capture.pcap',
      desc: 'Display protocol hierarchy statistics (frame counts/bytes per protocol layer)',
      type: 'show',
    },
  ];
  for (const f of fixes) {
    const idx = findIdx('wireshark', sec, f.match);
    if (idx >= 0) {
      const e = plats.wireshark.sections[sec][idx];
      e.cmd = f.cmd;
      e.desc = f.desc;
      e.type = f.type;
      fixedDesc++;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Examples for high-traffic commands
// ---------------------------------------------------------------------------

// linux
setExample('linux', 'System', 'df -h',
`Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   18G   30G  38% /
tmpfs           7.9G  6.8M  7.9G   1% /run
/dev/sdb1       500G  213G  262G  45% /data
tmpfs           7.9G     0  7.9G   0% /dev/shm`);

setExample('linux', 'dmidecode  # hardware info', 'free -m',
`               total        used        free      shared  buff/cache   available
Mem:           15998        4521        2114         312        9362       10817
Swap:           2047           0        2047`);

setExample('linux', 'System', 'uptime',
` 19:42:11 up 47 days,  3:18,  2 users,  load average: 0.42, 0.51, 0.48`);

setExample('linux', 'Networking', 'ip a',
`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP
    link/ether 52:54:00:8a:1f:c2 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.42/24 brd 10.0.0.255 scope global dynamic eth0
       valid_lft 84032sec preferred_lft 84032sec
    inet6 fe80::5054:ff:fe8a:1fc2/64 scope link`);

setExample('linux', 'Networking', 'ss -tulpn',
`Netid State   Recv-Q Send-Q  Local Address:Port  Peer Address:Port  Process
udp   UNCONN  0      0       127.0.0.53%lo:53         0.0.0.0:*      users:(("systemd-resolve",pid=812,fd=14))
tcp   LISTEN  0      128            0.0.0.0:22         0.0.0.0:*      users:(("sshd",pid=1024,fd=3))
tcp   LISTEN  0      511            0.0.0.0:80         0.0.0.0:*      users:(("nginx",pid=1340,fd=6))
tcp   LISTEN  0      4096          127.0.0.1:5432      0.0.0.0:*      users:(("postgres",pid=1481,fd=7))`);

setExample('linux', 'Diagnostics', 'netstat -tulpn',
`Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address    Foreign Address  State    PID/Program name
tcp        0      0 0.0.0.0:22       0.0.0.0:*        LISTEN   1024/sshd
tcp        0      0 0.0.0.0:80       0.0.0.0:*        LISTEN   1340/nginx
tcp        0      0 127.0.0.1:5432   0.0.0.0:*        LISTEN   1481/postgres
udp        0      0 127.0.0.53:53    0.0.0.0:*                 812/systemd-resolve`);

setExample('linux', 'ping host  # test connectivity', 'ping -c 4 host',
`PING host (10.0.0.1) 56(84) bytes of data.
64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.412 ms
64 bytes from 10.0.0.1: icmp_seq=2 ttl=64 time=0.387 ms
64 bytes from 10.0.0.1: icmp_seq=3 ttl=64 time=0.401 ms
64 bytes from 10.0.0.1: icmp_seq=4 ttl=64 time=0.395 ms

--- host ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3045ms
rtt min/avg/max/mdev = 0.387/0.398/0.412/0.011 ms`);

setExample('linux', 'host example.com  # DNS lookup', 'dig +short example.com',
`93.184.216.34`);

setExample('linux', 'curl http://example.com  # fetch URL', 'curl -I http://example.com',
`HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
Date: Fri, 01 May 2026 19:43:02 GMT
Server: nginx
Last-Modified: Thu, 17 Oct 2024 02:00:00 GMT
ETag: "84cf-625bda3b1a23a"
Content-Length: 33999
Connection: keep-alive`);

setExample('linux', 'Diagnostics', 'journalctl -xe',
`-- Journal begins at Tue 2026-04-01 09:12:01 BST. --
May 01 19:42:01 web01 sshd[2891]: Failed password for invalid user admin from 198.51.100.4
May 01 19:42:03 web01 sshd[2891]: Connection closed by invalid user admin 198.51.100.4 [preauth]
May 01 19:43:11 web01 systemd[1]: nginx.service: Main process exited, code=exited, status=1/FAILURE
May 01 19:43:11 web01 systemd[1]: nginx.service: Failed with result 'exit-code'.
-- The result is failed. The job identifier is 4218 and the job result is failed.`);

setExample('linux', 'Diagnostics', 'journalctl -b',
`-- Journal begins at Tue 2026-04-01 09:12:01 BST, ends at Fri 2026-05-01 19:42:11 BST. --
Mar 15 08:00:14 web01 kernel: Linux version 6.8.0-31-generic (buildd@lcy02-amd64-013)
Mar 15 08:00:14 web01 kernel: Command line: BOOT_IMAGE=/vmlinuz-6.8.0-31-generic root=UUID=...
Mar 15 08:00:14 web01 kernel: KERNEL supported cpus: Intel/AMD/...
Mar 15 08:00:15 web01 systemd[1]: Starting Network Time Synchronization...
Mar 15 08:00:15 web01 systemd[1]: Started Journal Service.`);

setExample('linux', 'Diagnostics', 'systemctl status <service>',
`● nginx.service - A high performance web server
     Loaded: loaded (/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: active (running) since Fri 2026-05-01 14:21:09 BST; 5h 22min ago
   Main PID: 1340 (nginx)
      Tasks: 5 (limit: 18839)
     Memory: 12.4M
        CPU: 1.482s
     CGroup: /system.slice/nginx.service
             ├─1340 "nginx: master process /usr/sbin/nginx -g daemon on; master_process on;"
             └─1341 "nginx: worker process"`);

// windows
setExample('windows', 'Networking', 'ipconfig /all',
`Windows IP Configuration
   Host Name . . . . . . . . . . . . : DESKTOP-8K2L9P
   Primary Dns Suffix  . . . . . . . : corp.example.com
   Node Type . . . . . . . . . . . . : Hybrid
Ethernet adapter Ethernet:
   Connection-specific DNS Suffix  . : corp.example.com
   Description . . . . . . . . . . . : Intel(R) Ethernet Connection I219-LM
   Physical Address. . . . . . . . . : 00-1A-2B-3C-4D-5E
   DHCP Enabled. . . . . . . . . . . : Yes
   IPv4 Address. . . . . . . . . . . : 10.0.0.42(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Lease Obtained. . . . . . . . . . : Friday, 1 May 2026 09:21:14
   Lease Expires . . . . . . . . . . : Saturday, 2 May 2026 09:21:14
   Default Gateway . . . . . . . . . : 10.0.0.1
   DHCP Server . . . . . . . . . . . : 10.0.0.1
   DNS Servers . . . . . . . . . . . : 10.0.0.1, 1.1.1.1`);

setExample('windows', 'Networking', 'netstat -ano',
`Active Connections
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1112
  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4
  TCP    10.0.0.42:50342        140.82.121.4:443       ESTABLISHED     8124
  TCP    10.0.0.42:50410        20.190.190.65:443      ESTABLISHED     7244
  TCP    [::]:135               [::]:0                 LISTENING       1112
  UDP    0.0.0.0:5353           *:*                                    3204`);

setExample('windows', 'Processes', 'tasklist',
`Image Name                     PID Session Name        Session#    Mem Usage
========================= ======== ================ =========== ============
System Idle Process              0 Services                   0          8 K
System                           4 Services                   0      4,832 K
svchost.exe                   1112 Services                   0     12,908 K
explorer.exe                  4982 Console                    1     78,540 K
chrome.exe                    8124 Console                    1    284,712 K
powershell.exe                7244 Console                    1     62,118 K`);

// nexus
setExample('nexus', 'Interfaces', 'show interface brief',
`--------------------------------------------------------------------------------
Ethernet      VLAN    Type Mode   Status  Reason                   Speed     Port
Interface                                                                    Ch #
--------------------------------------------------------------------------------
Eth1/1        1       eth  trunk  up      none                       10G(D) 10
Eth1/2        1       eth  trunk  up      none                       10G(D) 10
Eth1/3        100     eth  access up      none                       1000(D) --
Eth1/4        --      eth  routed down    Link not connected         auto(D) --
Eth1/47       --      eth  routed up      none                       10G(D)  --
Eth1/48       --      eth  routed up      none                       10G(D)  --`);

setExample('nexus', 'VLANs / VPC', 'show vpc',
`Legend:
                (*) - local vPC is down, forwarding via vPC peer-link
vPC domain id                     : 100
Peer status                       : peer adjacency formed ok
vPC keep-alive status             : peer is alive
Configuration consistency status  : success
Per-vlan consistency status       : success
Type-2 consistency status         : success
vPC role                          : primary
Number of vPCs configured         : 24
Peer Gateway                      : Enabled
Dual-active excluded VLANs        : -
Graceful Consistency Check        : Enabled
Auto-recovery status              : Enabled, timer is off (timeout = 240s)`);

setExample('nexus', 'System & Status', 'show feature',
`Feature Name          Instance  State
--------------------  --------  --------
bash-shell            1         enabled
bgp                   1         enabled
eigrp                 1         disabled
hsrp                  1         enabled
interface-vlan        1         enabled
lacp                  1         enabled
lldp                  1         enabled
nxapi                 1         enabled
ospf                  1         enabled
pim                   1         disabled
tacacs                1         enabled
vpc                   1         enabled`);

setExample('nexus', 'VLANs / VPC', 'show fex',
`  FEX         FEX           FEX                       FEX
Number    Description      State            Model            Serial
------------------------------------------------------------------------
101        FEX0101         Online   N2K-C2248TP-1GE     SAL1234ABCD
102        FEX0102         Online   N2K-C2248TP-1GE     SAL1234EFGH`);

// aruba_cx
setExample('aruba_cx', 'System & Status', 'show version',
`ArubaOS-CX
(c) Copyright 2017-2025 Hewlett Packard Enterprise Development LP

Version      : FL.10.13.1010
Build Date   : 2025-09-04 18:42:37 UTC
Build ID     : ArubaOS-CX:FL.10.13.1010:f6b4a2e:202509041842
Active Image : primary
Service OS Version : FL.01.13.0001
BIOS Version       : FL.01.0007`);

setExample('aruba_cx', 'Interfaces', 'show interface brief',
`Port    Native VLAN  Mode    Type    Enabled Status        Reason          Speed     Description
--------------------------------------------------------------------------------------
1/1/1   1            access  --      yes     up                            1000      uplink-to-core
1/1/2   100          access  --      yes     up                            1000      ap-1
1/1/3   100          access  --      yes     down          waiting for     auto      ap-2
1/1/4   --           routed  --      yes     up                            10000     l3-uplink
1/1/47  --           trunk   1G-T    yes     up                            1000
1/1/48  --           trunk   1G-T    no      down          Administrativel auto`);

setExample('aruba_cx', 'Interfaces', 'show lldp neighbors',
`LOCAL-PORT  CHASSIS-ID         PORT-ID            PORT-DESCR  TTL  SYS-NAME
---------------------------------------------------------------------------
1/1/1       00:1a:1e:11:22:33  GigabitEthernet0/1 uplink      120  core-sw01
1/1/2       a8:bd:27:44:55:66  1                  AP1-eth0    120  AP-floor1-01
1/1/3       a8:bd:27:77:88:99  1                  AP2-eth0    120  AP-floor1-02
1/1/47      00:50:56:aa:bb:cc  vmnic0             ESXi mgmt   120  esxi01.lab`);

setExample('aruba_cx', 'VLANs', 'show vlan',
`--------------------------------------------------------------------------------
VLAN  Name                          Status     Reason         Type     Interfaces
--------------------------------------------------------------------------------
1     DEFAULT_VLAN_1                up         ok             default  1/1/1, 1/1/47
10    Management                    up         ok             static   1/1/4, vlan10
20    Servers                       up         ok             static   1/1/5-1/1/8
100   AP-mgmt                       up         ok             static   1/1/2, 1/1/3
200   Guest                         up         ok             static   1/1/2, 1/1/3`);

setExample('aruba_cx', 'L3 Routing', 'show ip route',
`Displaying ipv4 routes selected for forwarding

Origin Codes: C - connected, S - static, L - local interface, R - RIP,
              O - OSPF, IA - OSPF inter area, E1 - OSPF external type 1,
              B - BGP

VRF: default
Prefix             Nexthop          Interface     VRF (egress)  Origin/Type   Distance/Metric  Age
--------------------------------------------------------------------------------------------------
0.0.0.0/0          10.0.0.1         vlan10        -             S/static      1/0              -
10.0.0.0/24        -                vlan10        -             C/connected   0/0              -
10.0.10.0/24       10.0.0.2         vlan10        -             O/ospf-intra  110/2            00:14:32
10.0.20.0/24       -                vlan20        -             C/connected   0/0              -
10.0.30.0/24       10.0.0.2         vlan10        -             O/ospf-intra  110/2            00:14:32`);

// esxi
setExample('esxi', 'Networking', 'esxcli network nic list',
`Name    PCI Device     Driver  Admin Status  Link Status  Speed  Duplex  MAC Address         MTU   Description
------  -------------  ------  ------------  -----------  -----  ------  ------------------  ----  ----------------------------------
vmnic0  0000:01:00.0   nmlx5   Up            Up           25000  Full    00:50:56:aa:bb:c0   1500  Mellanox ConnectX-4 Lx 25GbE
vmnic1  0000:01:00.1   nmlx5   Up            Up           25000  Full    00:50:56:aa:bb:c1   1500  Mellanox ConnectX-4 Lx 25GbE
vmnic2  0000:18:00.0   ntg3    Up            Down              0  Half   00:50:56:aa:bb:c2   1500  Broadcom NetXtreme BCM5719 1GbE
vmnic3  0000:18:00.1   ntg3    Up            Down              0  Half   00:50:56:aa:bb:c3   1500  Broadcom NetXtreme BCM5719 1GbE`);

setExample('esxi', 'Networking', 'esxcli network ip interface list',
`vmk0
   Name: vmk0
   MAC Address: 00:50:56:6f:1a:2b
   Enabled: true
   Portset: vSwitch0
   Portgroup: Management Network
   Netstack Instance: defaultTcpipStack
   MTU: 1500
   TSO MSS: 65535
   Port ID: 67108876
vmk1
   Name: vmk1
   MAC Address: 00:50:56:6f:1a:2c
   Enabled: true
   Portset: DSwitch
   Portgroup: vMotion-PG
   Netstack Instance: vmotion
   MTU: 9000`);

setExample('esxi', 'System', 'vim-cmd vmsvc/getallvms',
`Vmid   Name                  File                                Guest OS         Version   Annotation
1      web01                 [DS-FAST] web01/web01.vmx           ubuntu64Guest    vmx-21
2      db01                  [DS-FAST] db01/db01.vmx             ubuntu64Guest    vmx-21
3      win-dc01              [DS-SLOW] win-dc01/win-dc01.vmx     windows2019srv   vmx-21
4      backup-proxy          [DS-FAST] backup/bkp.vmx            other3xLinux64   vmx-19`);

setExample('esxi', 'System', 'esxcli system version get',
`   Product: VMware ESXi
   Version: 8.0.3
   Build: Releasebuild-24859861
   Update: 3
   Patch: 8`);

// aws
setExample('aws', 'S3', 'aws s3 ls',
`2025-11-03 14:21:09 cf-templates-corp-eu-west-2
2026-01-17 09:08:42 acme-data-lake
2026-02-24 11:47:33 acme-logs-archive
2026-04-08 16:52:15 acme-static-assets`);

setExample('aws', 'IAM', 'aws sts get-caller-identity',
`{
    "UserId": "AROAEXAMPLE12345:matthew.witherford",
    "Account": "123456789012",
    "Arn": "arn:aws:sts::123456789012:assumed-role/PowerUser/matthew.witherford"
}`);

setExample('aws', 'EC2', 'aws ec2 describe-instances',
`{
    "Reservations": [
        {
            "Instances": [
                {
                    "InstanceId": "i-0a1b2c3d4e5f67890",
                    "InstanceType": "t3.medium",
                    "State": { "Name": "running" },
                    "PrivateIpAddress": "10.0.1.42",
                    "PublicIpAddress": "54.247.12.34",
                    "Tags": [{ "Key": "Name", "Value": "web01" }]
                }
            ]
        }
    ]
}`);

// proxmox
setExample('proxmox', 'System & Status', 'pveversion',
`pve-manager/8.2.4/abcd1234efgh5678 (running kernel: 6.8.4-3-pve)`);

setExample('proxmox', 'Virtual Machines (qm)', 'qm list',
`      VMID NAME                 STATUS     MEM(MB)    BOOTDISK(GB) PID
       100 web01                running    4096       32.00        18432
       101 db01                 running    8192       128.00       18441
       102 backup-proxy         stopped    2048       16.00        0
       110 win-dc01             running    8192       80.00        18712
       120 ansible-runner       paused     2048       16.00        18821`);

setExample('proxmox', 'Cluster (pvecm)', 'pvecm status',
`Cluster information
-------------------
Name:             pve-cluster-01
Config Version:   5
Transport:        knet
Secure auth:      on

Quorum information
------------------
Date:             Fri May  1 19:50:14 2026
Quorum provider:  corosync_votequorum
Nodes:            3
Node ID:          0x00000001
Ring ID:          1.4f
Quorate:          Yes

Votequorum information
----------------------
Expected votes:   3
Highest expected: 3
Total votes:      3
Quorum:           2
Flags:            Quorate

Membership information
----------------------
    Nodeid      Votes Name
0x00000001          1 pve01 (local)
0x00000002          1 pve02
0x00000003          1 pve03`);

setExample('proxmox', 'ZFS', 'zpool status',
`  pool: rpool
 state: ONLINE
  scan: scrub repaired 0B in 00:14:32 with 0 errors on Sun Apr 27 03:14:32 2026
config:
        NAME                                 STATE     READ WRITE CKSUM
        rpool                                ONLINE       0     0     0
          mirror-0                           ONLINE       0     0     0
            nvme-Samsung_PM9A3_960GB-part3   ONLINE       0     0     0
            nvme-Samsung_PM9A3_960GB-part3   ONLINE       0     0     0
errors: No known data errors`);

// ---------------------------------------------------------------------------
// 3. New commands (up to 3)
// ---------------------------------------------------------------------------

function addNew(plat, sec, entry) {
  const arr = plats[plat]?.sections?.[sec];
  if (!Array.isArray(arr)) { console.warn('SECTION NOT FOUND:', plat, '/', sec); return; }
  // skip if cmd already present
  if (arr.some(c => c.cmd === entry.cmd)) { console.warn('SKIP (already present):', plat, '/', entry.cmd); return; }
  arr.push(entry);
  addedNew++;
}

// 1. linux / Networking — mtr report mode (best-of-both ping+traceroute)
addNew('linux', 'Networking', {
  cmd: 'mtr -rwc 100 <host>',
  desc: 'MTR in report mode: send 100 cycles, print one combined ping+traceroute table (loss%, avg/best/wrst per hop). Great for capturing intermittent path issues.',
  type: 'show',
  flagged: false,
  example: `Start: 2026-05-01T19:55:14+0100
HOST: web01                       Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 10.0.0.1                   0.0%   100    0.4    0.5   0.3   1.1   0.1
  2.|-- 10.0.255.1                 0.0%   100    1.2    1.4   1.0   3.5   0.4
  3.|-- 100.64.0.41                2.0%   100   12.4   12.7  11.8  18.4   1.2
  4.|-- 195.66.224.105             0.0%   100   13.1   13.2  12.7  15.0   0.5
  5.|-- 1.1.1.1                    0.0%   100   13.8   13.9  13.4  16.2   0.4`
});

// 2. windows / Networking — modern PowerShell replacement for netstat
addNew('windows', 'Networking', {
  cmd: 'Get-NetTCPConnection -State Established | Sort-Object OwningProcess | Format-Table LocalAddress,LocalPort,RemoteAddress,RemotePort,OwningProcess,@{n="Process";e={(Get-Process -Id $_.OwningProcess -EA 0).Name}}',
  desc: 'PowerShell replacement for "netstat -ano | findstr ESTABLISHED" — established TCP connections joined to process name.',
  type: 'show',
  flagged: false,
  example: `LocalAddress  LocalPort RemoteAddress    RemotePort OwningProcess Process
------------  --------- -------------    ---------- ------------- -------
10.0.0.42         50342 140.82.121.4            443          8124 chrome
10.0.0.42         50410 20.190.190.65           443          7244 powershell
10.0.0.42         50488 52.97.156.130           443          8124 chrome
10.0.0.42         50612 13.107.42.14            443         10412 OUTLOOK`
});

// 3. paloalto / Monitoring & Diagnostics — minute-resolution resource history
addNew('paloalto', 'Monitoring & Diagnostics', {
  cmd: 'show running resource-monitor minute last 60',
  desc: 'Last 60 one-minute samples of CPU per data plane core, packet buffer, session table, and throughput — best first stop when triaging "firewall feels slow".',
  type: 'show',
  flagged: false,
  example: `Resource monitoring sampling data (per minute):

CPU load (%) during last 60 minutes
core   0   1   2   3   4   5   6   7
avg   34  41  39  37  42  38  35  36
max   71  82  78  74  85  76  69  72

Resource utilization (%) during last 60 minutes
                       avg  max
session table          18   19
packet buffer           4    7
packet descriptor       3    5
packet descriptor (on-chip)  2  4

Throughput (Mbps) during last 60 minutes
avg: 1842  max: 3104`
});

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------
data.updatedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log('---');
console.log('fixed descriptions  :', fixedDesc);
console.log('removed bad rows    :', deletedRows);
console.log('added examples      :', addedExamples);
console.log('added new commands  :', addedNew);
