#!/usr/bin/env node
// One-shot: merge curated command additions into data/commands.json, skipping
// any (platform, section, cmd) triple that already exists. Safe to re-run.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = resolve(ROOT, 'data/commands.json');

const ADDITIONS = {
  ciscoios: {
    Interfaces: [
      ['show interfaces trunk', 'Trunk status, native/allowed VLANs per port', 'show'],
      ['show interfaces counters errors', 'CRC, runts, giants and collision counters per port', 'show'],
      ['show interfaces <int> transceiver detail', 'SFP DOM readings: Tx/Rx power, temperature, voltage', 'show'],
      ['show mac address-table interface <int>', 'MAC addresses learned on a specific interface', 'show'],
      ['show interfaces <int> counters etherchannel', 'Per-member traffic distribution in a LAG', 'show'],
      ['show etherchannel summary', 'LAG bundle state and member status (P=in-bundle)', 'show'],
      ['show lldp neighbors detail', 'LLDP info from directly-connected devices', 'show'],
      ['clear counters <int>', 'Reset interface counters before reproducing a test', 'troubleshooting'],
      ['test cable-diagnostics tdr interface <int>', 'Physical-layer TDR on copper ports', 'troubleshooting'],
      ['interface range <range>\\n description <text>\\n switchport mode access\\n switchport access vlan <id>', 'Bulk-configure a range of access ports', 'config']
    ],
    Routing: [
      ['show ip protocols', 'Summary of every routing protocol configured and its state', 'show'],
      ['show ip bgp summary', 'BGP neighbor table and session status', 'show'],
      ['show ip ospf database', 'OSPF LSDB — inspect LSAs by type and area', 'show'],
      ['show ip eigrp topology', 'EIGRP topology table incl. feasible successors', 'show'],
      ['show ip cef <prefix>', 'CEF FIB entry, outgoing interface and next-hop for a prefix', 'show'],
      ['show adjacency <int> detail', 'L2 rewrite info CEF uses to forward out a given interface', 'show'],
      ['show ip ospf interface brief', 'Per-interface OSPF state, area, cost, neighbours', 'show'],
      ['debug ip ospf adj', 'Live OSPF adjacency transitions — disable immediately after', 'troubleshooting'],
      ['show ipv6 route', 'IPv6 routing table', 'show'],
      ['ip route <net> <mask> <next-hop> [name <tag>] [track <obj>]', 'Static route with optional IP SLA track', 'config']
    ],
    Security: [
      ['show mac address-table', 'All learned MACs across the switch', 'show'],
      ['show port-security', 'Port-security summary: violations, secure MAC counts', 'show'],
      ['show dot1x all', 'Per-port 802.1x authentication state and session info', 'show'],
      ['show authentication sessions interface <int> details', 'MAB / 802.1x session details including VLAN and ACL', 'show'],
      ['show ip dhcp snooping binding', 'DHCP snooping binding table — the source of truth for DAI/IPSG', 'show'],
      ['show ip arp inspection', 'Dynamic ARP Inspection stats per VLAN', 'show'],
      ['show ip source binding', 'IP source guard bindings', 'show'],
      ['interface <int>\\n switchport port-security maximum 2\\n switchport port-security violation restrict', 'Basic port-security config', 'config'],
      ['ip dhcp snooping\\n ip dhcp snooping vlan <vlans>\\n interface <uplink>\\n ip dhcp snooping trust', 'Enable DHCP snooping with a trusted uplink', 'config'],
      ['ip arp inspection vlan <vlans>', 'Enable Dynamic ARP Inspection on selected VLANs', 'config']
    ],
    Troubleshooting: [
      ['show processes cpu sorted', 'Top CPU consumers — look for control-plane pegging', 'troubleshooting'],
      ['show processes cpu history', 'ASCII histogram of CPU over last hour/day', 'troubleshooting'],
      ['show memory statistics', 'Memory pool usage — watch for fragmentation', 'troubleshooting'],
      ['show platform hardware fed switch active qos queue stats interface <int>', 'Cat9k queue drops per interface', 'troubleshooting'],
      ['show logging | include <keyword>', 'Filter syslog buffer for a specific event', 'troubleshooting'],
      ['monitor session 1 source interface <int> both\\n monitor session 1 destination interface <int>', 'Local SPAN between two ports', 'config'],
      ['debug platform packet-capture monitor capture CAP interface <int> both', 'EPC in-box capture on newer IOS-XE', 'troubleshooting'],
      ['test crypto isakmp <peer>', 'Attempt an IKE negotiation manually for diagnosis', 'troubleshooting'],
      ['show tech-support | redirect flash:tac.txt', 'Dump complete tech-support to flash for TAC upload', 'troubleshooting'],
      ['show version | include uptime|Version|image', 'Quick uptime + software version one-liner', 'show']
    ]
  },
  aws: {
    EC2: [
      ['aws ec2 describe-instances --filters Name=instance-state-name,Values=running --query \'Reservations[].Instances[].[InstanceId,Tags[?Key==`Name`].Value|[0],PrivateIpAddress]\' --output table', 'Running instances with name tag and private IP as a table', 'show'],
      ['aws ec2 describe-network-interfaces --filters Name=addresses.private-ip-address,Values=<ip>', 'Find which ENI owns a given private IP', 'troubleshooting'],
      ['aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=<subnet>', 'Route table associated with a specific subnet', 'show'],
      ['aws ec2 describe-nat-gateways --filter Name=state,Values=available', 'All healthy NAT gateways', 'show'],
      ['aws ec2 describe-vpc-endpoints', 'Gateway and interface endpoints in this account/region', 'show'],
      ['aws ec2 start-instances --instance-ids <id>', 'Start a stopped instance', 'config'],
      ['aws ec2 stop-instances --instance-ids <id>', 'Stop (soft) an instance', 'config'],
      ['aws ec2 get-console-output --instance-id <id>', 'Last 64KB of console output — useful for boot-fail debugging', 'troubleshooting'],
      ['aws ec2 describe-instance-status --instance-ids <id> --include-all-instances', 'System / instance status checks + scheduled events', 'show'],
      ['aws ec2 modify-instance-attribute --instance-id <id> --groups <sg1> <sg2>', 'Replace the security groups attached to an instance', 'config']
    ],
    S3: [
      ['aws s3api list-buckets --query "Buckets[].Name"', 'List bucket names only', 'show'],
      ['aws s3api get-bucket-location --bucket <b>', 'Region a bucket lives in', 'show'],
      ['aws s3api get-bucket-versioning --bucket <b>', 'Versioning and MFA-delete state', 'show'],
      ['aws s3api get-bucket-policy --bucket <b> --output text --query Policy | jq .', 'Human-readable bucket policy', 'show'],
      ['aws s3 sync <src> <dst> --delete --exact-timestamps', 'Mirror with removal and timestamp-accurate comparison', 'config'],
      ['aws s3api list-object-versions --bucket <b> --prefix <p>', 'All object versions incl. delete markers', 'show'],
      ['aws s3 presign s3://<b>/<key> --expires-in 3600', 'Signed URL valid for 1 hour', 'show']
    ],
    CloudWatch: [
      ['aws logs tail /aws/lambda/<fn> --follow --format short', 'Live-tail a log group', 'troubleshooting'],
      ['aws logs filter-log-events --log-group-name <g> --filter-pattern "ERROR"', 'Grep-like search across a log group', 'troubleshooting'],
      ['aws logs describe-log-groups --query "logGroups[].logGroupName"', 'Every log group in the region', 'show'],
      ['aws cloudwatch set-alarm-state --alarm-name <n> --state-value ALARM --state-reason "test"', 'Force an alarm into ALARM for testing notification path', 'troubleshooting'],
      ['aws cloudwatch put-metric-data --namespace <ns> --metric-name <m> --value 1 --dimensions Host=<h>', 'Publish a custom metric from the CLI', 'config'],
      ['aws cloudwatch describe-alarms --state-value ALARM --query "MetricAlarms[].AlarmName"', 'Alarms currently in ALARM', 'show'],
      ['aws logs start-query --log-group-name <g> --start-time <unix> --end-time <unix> --query-string "fields @timestamp, @message | sort @timestamp desc | limit 50"', 'Insights query — retrieve queryId for get-query-results', 'troubleshooting']
    ],
    IAM: [
      ['aws iam get-user', 'Identity of the caller if this is a user', 'show'],
      ['aws sts get-caller-identity', 'Identity of the caller for user OR assumed role', 'show'],
      ['aws iam list-users --query "Users[].UserName"', 'All IAM users in the account', 'show'],
      ['aws iam list-roles --query "Roles[?contains(RoleName,\'<substr>\')].RoleName"', 'Roles matching a name substring', 'show'],
      ['aws iam simulate-principal-policy --policy-source-arn <role-arn> --action-names <svc>:<action> --resource-arns <arn>', 'Dry-run an IAM decision for a principal/action/resource', 'troubleshooting'],
      ['aws iam get-policy --policy-arn <arn>', 'Managed policy metadata (default version, attachments)', 'show'],
      ['aws iam get-policy-version --policy-arn <arn> --version-id v1 --query Policy.PolicyVersion.Document', 'Full JSON document of a managed policy version', 'show']
    ],
    VPC: [
      ['aws ec2 describe-vpcs --query "Vpcs[].[VpcId,CidrBlock,IsDefault]" --output table', 'All VPCs with CIDR and default flag', 'show'],
      ['aws ec2 describe-security-groups --group-ids <sg> --query "SecurityGroups[].IpPermissions"', 'Ingress rules of a specific SG', 'show'],
      ['aws ec2 describe-flow-logs --filter Name=resource-id,Values=<vpc-id>', 'Flow-log configuration for a VPC', 'show'],
      ['aws ec2 create-flow-logs --resource-type VPC --resource-ids <vpc-id> --traffic-type ALL --log-destination-type cloud-watch-logs --log-group-name <lg> --deliver-logs-permission-arn <role>', 'Enable VPC flow logs to CloudWatch', 'config'],
      ['aws ec2 describe-transit-gateway-route-tables', 'TGW route tables (for multi-VPC designs)', 'show']
    ]
  },
  windows: {
    Networking: [
      ['Get-NetTCPConnection -State Listen | Sort-Object LocalPort', 'Listening TCP ports (PowerShell replacement for netstat -an -p tcp)', 'show'],
      ['Get-NetTCPConnection -State Established | Group-Object RemoteAddress | Sort-Object Count -Descending | Select -First 20', 'Top remote IPs by open connections', 'show'],
      ['Get-NetIPConfiguration -Detailed', 'Combined NIC + IP + DNS + gateway view', 'show'],
      ['Get-DnsClientServerAddress -AddressFamily IPv4', 'DNS servers per interface', 'show'],
      ['Test-NetConnection -ComputerName <host> -Port <n> -InformationLevel Detailed', 'TCP probe with route, RTT and source-interface info', 'troubleshooting'],
      ['Get-NetRoute -AddressFamily IPv4 | Sort-Object ifMetric,RouteMetric', 'Routing table sorted by interface+route metric', 'show'],
      ['Clear-DnsClientCache', 'Flush resolver cache (modern alias of ipconfig /flushdns)', 'troubleshooting'],
      ['netsh int ip reset', 'Reset TCP/IP stack to defaults — requires reboot', 'troubleshooting'],
      ['pathping -n -q 10 <host>', 'Hop-by-hop loss and latency sample', 'troubleshooting'],
      ['Get-NetNeighbor -AddressFamily IPv4 -State Reachable', 'ARP cache of reachable entries', 'show']
    ],
    System: [
      ['Get-ComputerInfo', 'Consolidated OS/hardware info (newer machines)', 'show'],
      ['Get-HotFix | Sort-Object InstalledOn -Descending | Select -First 20', 'Recently installed updates', 'show'],
      ['Get-WmiObject win32_operatingsystem | Select LastBootUpTime,FreePhysicalMemory,TotalVisibleMemorySize', 'Last boot and memory overview', 'show'],
      ['(Get-CimInstance Win32_OperatingSystem).LastBootUpTime', 'Just the last-boot time', 'show'],
      ['winget upgrade --all --include-unknown --accept-source-agreements --accept-package-agreements', 'Upgrade everything installed via winget', 'config'],
      ['sfc /scannow', 'System File Checker — repair protected OS files', 'troubleshooting'],
      ['DISM /Online /Cleanup-Image /RestoreHealth', 'Repair component store; run before sfc /scannow', 'troubleshooting']
    ],
    Processes: [
      ['Get-Process | Sort-Object -Descending CPU | Select -First 15', 'Top 15 processes by CPU-time accumulated', 'show'],
      ['Get-Process | Sort-Object -Descending WS | Select -First 15 Name,Id,WS,CPU', 'Top processes by working-set memory', 'show'],
      ['Stop-Process -Id <pid> -Force', 'PowerShell-native task kill', 'troubleshooting'],
      ['Get-Service | Where-Object Status -eq Running | Sort-Object DisplayName', 'Running services alphabetised', 'show'],
      ['Get-ScheduledTask | Where-Object State -ne Disabled | Sort-Object TaskPath', 'Enabled scheduled tasks', 'show'],
      ['wevtutil qe System /c:20 /rd:true /f:text', 'Last 20 System-log events as plain text', 'troubleshooting'],
      ['Get-WinEvent -LogName Application -MaxEvents 50 | Where-Object LevelDisplayName -in Error,Critical', 'Recent errors in Application log', 'troubleshooting']
    ],
    Storage: [
      ['Get-PSDrive -PSProvider FileSystem', 'All filesystem drives with used/free', 'show'],
      ['Get-Volume | Sort-Object SizeRemaining', 'Volumes sorted by free space', 'show'],
      ['chkdsk <drive>: /scan', 'Online, non-destructive filesystem scan', 'troubleshooting'],
      ['Repair-Volume -DriveLetter <D> -Scan', 'PowerShell chkdsk equivalent, online', 'troubleshooting'],
      ['diskpart /s <script>', 'Run a prepared DiskPart script non-interactively', 'config'],
      ['Get-StoragePool', 'Storage Spaces pools and health', 'show'],
      ['Optimize-Volume -DriveLetter <D> -ReTrim -Verbose', 'SSD TRIM on a specific drive', 'config']
    ]
  },
  esxi: {
    System: [
      ['esxcli hardware platform get', 'Server vendor/model/serial', 'show'],
      ['esxcli hardware cpu list', 'CPU topology and features', 'show'],
      ['esxcli hardware memory get', 'Physical memory size', 'show'],
      ['esxcli software vib list | grep -iE "driver|firmware"', 'Drivers/firmware VIBs currently installed', 'show'],
      ['vim-cmd vmsvc/getallvms', 'Registered VMs with vmid, used by most vim-cmd operations', 'show'],
      ['esxcli system stats uptime get', 'Host uptime in seconds', 'show'],
      ['vmware -vl', 'ESXi version + build — matches KB articles', 'show']
    ],
    Networking: [
      ['esxcli network ip connection list', 'All active network connections (netstat equivalent)', 'show'],
      ['esxcli network ip neighbor list', 'ARP/ND neighbour cache', 'show'],
      ['esxcli network firewall ruleset list', 'ESXi firewall rulesets and enabled state', 'show'],
      ['esxcli network firewall ruleset allowedip list', 'Allowed source IPs per ruleset', 'show'],
      ['esxcli network firewall ruleset set --ruleset-id=<id> --enabled=true', 'Enable an ESXi firewall ruleset', 'config'],
      ['esxcli network ip dns server list', 'DNS servers configured on the host', 'show'],
      ['vmkping -I <vmk> <ip>', 'Ping from a specific vmkernel interface — crucial for vMotion/NFS', 'troubleshooting']
    ],
    Storage: [
      ['esxcli storage nmp device list', 'PSP (path selection) per device', 'show'],
      ['esxcli storage nmp path list', 'All paths with state/transport', 'show'],
      ['esxcli storage core path list', 'Same, including vendor/model', 'show'],
      ['esxcli storage vmfs extent list', 'Extents backing each VMFS datastore', 'show'],
      ['esxcli storage core device vaai status get', 'VAAI primitives supported per device', 'show'],
      ['esxcli storage core adapter rescan --all', 'Rescan every HBA for LUN changes', 'troubleshooting'],
      ['esxcli storage filesystem list', 'Mounted filesystems with used/free', 'show']
    ],
    'VM Management': [
      ['vim-cmd vmsvc/power.getstate <vmid>', 'Current power state of a VM', 'show'],
      ['vim-cmd vmsvc/power.on <vmid>', 'Power on by vmid', 'config'],
      ['vim-cmd vmsvc/power.shutdown <vmid>', 'Graceful guest shutdown (needs VMware Tools)', 'config'],
      ['vim-cmd vmsvc/power.off <vmid>', 'Hard power off', 'config'],
      ['vim-cmd vmsvc/snapshot.get <vmid>', 'Snapshot tree of a VM', 'show'],
      ['vim-cmd vmsvc/snapshot.removeall <vmid>', 'Consolidate: remove all snapshots', 'config'],
      ['vim-cmd vmsvc/reload <vmid>', 'Reload the .vmx — useful after out-of-band edits', 'troubleshooting']
    ],
    Diagnostics: [
      ['tail -f /var/log/vmkernel.log', 'Live vmkernel log (the ESXi "dmesg")', 'troubleshooting'],
      ['tail -f /var/log/hostd.log', 'Live hostd log (management-agent events)', 'troubleshooting'],
      ['tail -f /var/log/vpxa.log', 'vCenter-agent log — useful for HA/DRS actions', 'troubleshooting'],
      ['esxcli system coredump partition get', 'Active core-dump partition configured on host', 'show'],
      ['esxcli system coredump file get', 'Core-dump file configuration', 'show'],
      ['esxtop -b -n 5 -d 2 | gzip > /tmp/esxtop.csv.gz', 'Batch-mode esxtop — capture performance snapshots', 'troubleshooting'],
      ['vm-support -w /vmfs/volumes/<ds>', 'Generate a complete support bundle', 'troubleshooting']
    ]
  },
  ciscoasa: {
    System: [
      ['show running-config | include ^hostname', 'Just the hostname (handy in multi-context)', 'show'],
      ['show context detail', 'Multi-context details incl. resource usage per context', 'show'],
      ['show cluster info', 'Cluster role/state (ASA in cluster mode)', 'show'],
      ['show failover', 'Active/standby failover state', 'show'],
      ['show failover history', 'Transitions over time', 'show'],
      ['show environment', 'Temperature, fans, power supplies', 'show'],
      ['show interface detail', 'Interfaces with extended statistics + counters', 'show']
    ],
    Interfaces: [
      ['show interface ip brief', 'Brief per-interface IP/state table', 'show'],
      ['show running-config interface <name>', 'Config snippet for one interface', 'show'],
      ['show interface <name> stats', 'In/out packet and byte counters', 'show'],
      ['clear interface <name>', 'Reset per-interface counters', 'troubleshooting'],
      ['show port-channel summary', 'EtherChannel members and their state', 'show'],
      ['show vlan', 'VLAN list on subinterfaces', 'show']
    ],
    Routing: [
      ['show route summary', 'Counts per route source', 'show'],
      ['show ospf neighbor detail', 'OSPF neighbour state with timers', 'show'],
      ['show bgp summary', 'BGP sessions and prefix counts', 'show'],
      ['show asp table routing', 'Accelerated Security Path routing table (actual fast-path)', 'show'],
      ['show asp drop', 'ASP drop counters — identify why packets die in fast path', 'troubleshooting'],
      ['show route | include ^B|^O|^D', 'Only dynamic routes (BGP/OSPF/EIGRP)', 'show']
    ],
    Security: [
      ['show running-config access-list', 'All configured ACLs', 'show'],
      ['show conn all', 'All active connections through the firewall', 'show'],
      ['show conn count', 'Current connection count per context', 'show'],
      ['show xlate', 'Current NAT translations', 'show'],
      ['show object-group', 'Object-groups referenced by ACLs', 'show'],
      ['show running-config all ssl', 'Full SSL/TLS config including default ciphers', 'show']
    ],
    VPN: [
      ['show crypto ipsec sa', 'IPSec SAs and traffic counters per tunnel', 'show'],
      ['show crypto isakmp sa detail', 'IKE SAs with peer info and lifetime', 'show'],
      ['show vpn-sessiondb summary', 'Active VPN session totals by type', 'show'],
      ['show vpn-sessiondb detail anyconnect', 'Detailed AnyConnect session info', 'show'],
      ['clear crypto ipsec sa peer <ip>', 'Force re-keying to a specific peer', 'troubleshooting'],
      ['debug crypto isakmp 127', 'Verbose IKE debug — use with capture filter', 'troubleshooting']
    ],
    NAT: [
      ['show nat', 'All NAT rules and their hit counts', 'show'],
      ['show nat detail', 'NAT rules with matching counters', 'show'],
      ['show running-config nat', 'Running NAT config', 'show'],
      ['packet-tracer input <ifc> tcp <src> <sport> <dst> <dport> detailed', 'Trace a simulated packet through firewall including NAT', 'troubleshooting']
    ],
    Diagnostics: [
      ['show tech-support | redirect disk0:/tac.txt', 'Full tech-support dump to flash', 'troubleshooting'],
      ['show capture <cap>', 'Inspect a running capture', 'troubleshooting'],
      ['capture <name> interface <ifc> match ip host <a> host <b>', 'Start a targeted capture', 'troubleshooting'],
      ['capture <name> type asp-drop all', 'Capture everything the ASP is dropping', 'troubleshooting'],
      ['show resource usage', 'Per-resource usage vs. limits (contexts/connections/xlates)', 'show'],
      ['show processes cpu-usage sorted', 'Top CPU consumers on the CP', 'troubleshooting']
    ]
  },
  netscaler: {
    Diagnostics: [
      ['nstrace.sh -time 60 -size 0', 'Collect a capture for 60s with full packet size', 'troubleshooting'],
      ['nsconmsg -d current -s ConLb=1 -g lb_tot', 'Live LB counters (running total)', 'troubleshooting'],
      ['shell grep -i ssl /var/log/ns.log | tail -200', 'Recent SSL-related events in ns.log', 'troubleshooting'],
      ['shell nsconmsg -K /var/nslog/newnslog -d event', 'Decode the binary event log for correlation', 'troubleshooting'],
      ['stat ssl', 'SSL transaction counters and errors', 'show'],
      ['stat ns', 'Overall system counters including memory/CPU/connections', 'show']
    ],
    'System & Status': [
      ['show system backup', 'List on-box system backups', 'show'],
      ['show ns feature', 'Enabled features — many commands fail silently if feature is off', 'show'],
      ['show ns mode', 'Global mode flags (USNIP, L2, MBF, etc.)', 'show'],
      ['show ns runningconfig | grep -v "^#"', 'Running config without comment lines', 'show']
    ],
    'Load Balancing': [
      ['show lb vserver -summary', 'Compact view of all LB vservers and state', 'show'],
      ['show lb persistentSessions', 'Active persistence entries', 'show'],
      ['bind lb vserver <vs> <service>', 'Bind an existing service to a VIP', 'config'],
      ['show lb monitor <name>', 'Monitor details including last response and last probe time', 'show']
    ],
    'SSL Management': [
      ['show ssl profile', 'SSL profiles and the ciphers they reference', 'show'],
      ['show ssl fipsKey', 'FIPS key entries (SDX/FIPS builds)', 'show'],
      ['show ssl policy', 'SSL policies bound to vservers', 'show']
    ]
  },
  paloalto: {
    'Monitoring & Diagnostics': [
      ['show counter global filter severity drop', 'Every global drop counter — key for policy/NAT/routing drops', 'troubleshooting'],
      ['show counter interface <if>', 'Per-interface counters incl. errors and drops', 'show'],
      ['show system statistics session', 'Session-slot statistics', 'show'],
      ['show running resource-monitor', 'Data-plane CPU, session, and packet-buffer usage', 'show'],
      ['less mp-log pan_task.log', 'Recent management-plane task logs', 'troubleshooting'],
      ['less dp-log pan_packet_diag.log', 'Packet-diag log (capture status, errors)', 'troubleshooting']
    ],
    'Security Policies': [
      ['show running security-policy | match "<app>"', 'Find rules matching an application name', 'show'],
      ['test security-policy-match source <ip> destination <ip> application <app> protocol 6 destination-port <p>', 'Which security rule will match a flow', 'troubleshooting'],
      ['show system setting logging', 'Logging mode and rate', 'show'],
      ['set rulebase security rules <name> description "<text>"', 'Add a description to an existing rule', 'config']
    ],
    'VPN': [
      ['test vpn ike-sa gateway <gw>', 'Trigger phase-1 negotiation to a specific gateway', 'troubleshooting'],
      ['test vpn ipsec-sa tunnel <tun>', 'Trigger phase-2 negotiation to a specific tunnel', 'troubleshooting'],
      ['debug ike global on debug', 'Enable verbose IKE debug — view with less mp-log ikemgr.log', 'troubleshooting'],
      ['show vpn flow', 'Per-tunnel encrypted/decrypted packet counters', 'show']
    ],
    'Commit & Config': [
      ['commit force', 'Commit even when no operator has made changes (useful post-upgrade)', 'config'],
      ['request commit-lock add comment "<reason>"', 'Prevent concurrent commits (multi-admin environments)', 'config'],
      ['show config saved', 'Saved candidate config snapshots', 'show'],
      ['load config from <filename>', 'Load a saved snapshot into the candidate config', 'config']
    ]
  }
};

const raw = await readFile(DB, 'utf8');
const data = JSON.parse(raw);

let added = 0, skipped = 0;
for (const [pk, sections] of Object.entries(ADDITIONS)) {
  const plat = data.platforms[pk];
  if (!plat) { console.error(`platform ${pk} not found — skipping`); continue; }
  for (const [sec, rows] of Object.entries(sections)) {
    plat.sections[sec] ||= [];
    const existing = new Set(plat.sections[sec].map(x => x.cmd));
    for (const [cmd, desc, type] of rows) {
      if (existing.has(cmd)) { skipped++; continue; }
      plat.sections[sec].push({ cmd, desc, type, flagged: false });
      existing.add(cmd);
      added++;
    }
  }
}

data.updatedAt = new Date().toISOString();
await writeFile(DB, JSON.stringify(data, null, 2) + '\n');
console.log(`added ${added}, skipped ${skipped} (dupes)`);
