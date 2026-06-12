#!/usr/bin/env node
// Patch commands.json: Proxmox + Aruba CX + OpenSSL (10 per section)
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/commands.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

function patchSection(cmds, patches) {
  for (const cmd of cmds) {
    if (patches[cmd.cmd] !== undefined && (!cmd.example || cmd.example.trim() === '')) {
      cmd.example = patches[cmd.cmd];
    }
  }
}
function addNewCmds(cmds, newCmds) {
  const existing = new Set(cmds.map(c => c.cmd));
  for (const nc of newCmds) {
    if (!existing.has(nc.cmd)) cmds.push(nc);
  }
}

// ─────────────────────────────────────────────
// PROXMOX
// ─────────────────────────────────────────────
const pve = data.platforms.proxmox.sections;

patchSection(pve['System & Status'], {
  'pveversion -v':
    'proxmox-ve: 8.2.4 (running kernel: 6.8.4-3-pve)\npve-manager: 8.2.4 (running version: 8.2.4/abcd1234)\npve-kernel-6.8: 6.8.4-3\nqemu-server: 8.2.1\npve-container: 5.0.9\nzfs-linux: 2.2.3-pve1\nceph: not installed',
  'pvesh get /version':
    '{\n  "release" : "8.2",\n  "repoid" : "abcd1234",\n  "version" : "8.2.4"\n}',
  'pvesh get /nodes':
    '[\n  {"node":"pve01","status":"online","uptime":4123800,"maxcpu":32,"maxmem":137438953472,"maxdisk":512000000000,"type":"node"},\n  {"node":"pve02","status":"online","uptime":4123650,"maxcpu":32,"maxmem":137438953472,"maxdisk":512000000000,"type":"node"},\n  {"node":"pve03","status":"online","uptime":4123500,"maxcpu":32,"maxmem":137438953472,"maxdisk":512000000000,"type":"node"}\n]',
  'pveperf':
    'FQDN:         pve01.corp.example.com\nCPU benchmark: 59.90 CPUs\nHDD size:      512 GB\nHDD benchmark: 4123 fsync/s\nDNS benchmark: 0.3 ms\nAPI benchmark: 824 queries/s',
  'systemctl status pve-cluster pveproxy pvedaemon pvestatd':
    '● pve-cluster.service - The Proxmox VE cluster filesystem\n   Active: active (running) since Mon 2026-05-25 06:12:00 UTC; 18 days ago\n● pveproxy.service - PVE API Proxy Server\n   Active: active (running) since Mon 2026-05-25 06:12:01 UTC\n● pvedaemon.service - PVE Management Daemon\n   Active: active (running) since Mon 2026-05-25 06:12:01 UTC\n● pvestatd.service - PVE Status Daemon\n   Active: active (running) since Mon 2026-05-25 06:12:01 UTC',
  'pvesh get /cluster/resources --type vm':
    '[\n  {"id":"qemu/100","name":"web01","status":"running","node":"pve01","maxcpu":4,"maxmem":4294967296,"disk":34359738368},\n  {"id":"qemu/101","name":"db01","status":"running","node":"pve01","maxcpu":8,"maxmem":8589934592},\n  {"id":"lxc/200","name":"nginx-proxy","status":"running","node":"pve02","maxcpu":2,"maxmem":1073741824}\n]',
  'pvereport':
    '# pvereport\n== Software Versions ==\nproxmox-ve: 8.2.4\npve-manager: 8.2.4\n== Cluster Status ==\n(Full diagnostic output saved to /tmp/pvereport-pve01-20260612.tgz)',
  'pveum ticket root@pam':
    '{"ticket":"PVE:root@pam:XXXXXXXX::...","CSRFPreventionToken":"XXXXXXXX:...","username":"root@pam"}',
});

patchSection(pve['Cluster (pvecm)'], {
  'pvecm nodes':
    'Membership information\n  Nodeid      Votes  Name\n0x00000001       1  pve01 (local)\n0x00000002       1  pve02\n0x00000003       1  pve03',
  'pvecm create <CLUSTERNAME>':
    'Corosync Totem process ID: 12345\nAdded 1 node(s).\nCluster \"corp-pve\" successfully created.',
  'pvecm add <FIRST-NODE-IP>':
    'Please login to \e[1;33mhttps://10.0.0.201:8006\e[0m with your login credentials and then execute:\n pmxcfs join <node-name>\nor alternatively:\n pvecm add 10.0.0.201',
  'pvecm add <FIRST-NODE-IP> --link0 <local-ip> --link1 <secondary-ip>':
    'Corosync ring 0 link: 10.0.0.203\nCorosync ring 1 link: 10.0.1.203\nJoined cluster corp-pve',
  'pvecm delnode <NODENAME>':
    'Stopping pmxcfs on pve03...\nNode pve03 removed from cluster',
  'pvecm expected <N>':
    'Setting expected votes to 2 (emergency quorum recovery)',
  'pvecm updatecerts --force':
    'updating certificate: /etc/pve/pve-root-ca.pem\nupdating certificate: /etc/pve/local/pve-ssl.pem\nDone.',
  'pvecm qdevice setup <QDEVICE-IP>':
    'Configuring Corosync QDevice for 2-node cluster...\nQDevice 10.0.0.250 added as vote-device',
});

patchSection(pve['Virtual Machines (qm)'], {
  'qm config <VMID>':
    'balloon: 0\nboot: order=scsi0;ide2;net0\ncores: 4\nide2: none,media=cdrom\nmemory: 8192\nname: web01\nnet0: virtio=AA:BB:CC:DD:EE:01,bridge=vmbr0,tag=10\nonboot: 1\nostype: l26\nscsi0: DS-FAST:vm-100-disk-0,discard=on,iothread=1,size=32G\nscsihw: virtio-scsi-single\nsmbios1: uuid=...\nsockets: 1',
  'qm config <VMID> --current':
    '(Same as qm config but shows live runtime values only, not pending changes)',
  'qm start <VMID>':
    '(No output; VM started — confirm with "qm list" or check GUI)',
  'qm shutdown <VMID>':
    '(Graceful ACPI shutdown requested; wait for VM to stop)',
  'qm shutdown <VMID> --forceStop 1 --timeout 60':
    '(Graceful shutdown attempted; if not stopped in 60s, force-power-off applied)',
  'qm stop <VMID>':
    '(Hard power-off — immediate. No data flush.)',
  'qm reboot <VMID>':
    '(ACPI reboot requested)',
  'qm reset <VMID>':
    '(Hard reset — equivalent to power-cycle button)',
  'qm suspend <VMID>':
    '(VM state written to disk; VM suspended)',
  'qm resume <VMID>':
    '(VM resumed from suspended state)',
  'qm sendkey <VMID> <KEY>':
    '(Key sent to VM console)',
  'qm migrate <VMID> <TARGET-NODE>':
    'migrating VM 100 to node pve02: 100%\nMigration finished successfully.',
  'qm migrate <VMID> <TARGET-NODE> --online --with-local-disks':
    'starting migration of VM 100 to node pve02\ncopying disk images... 100%\nmigrating VM state... done\nMigration finished successfully. Spent 87 seconds.',
  'qm clone <VMID> <NEW-VMID> --name <NAME> --full 1':
    'create full clone of drive vm-100-disk-0 (32G)\n100%\nFull clone VM 200 \"web01-clone\" created.',
  'qm template <VMID>':
    '(VM 100 converted to template; disk and config are now read-only)',
  'qm destroy <VMID> --purge --destroy-unreferenced-disks 1':
    'removing all disks of VM 100...\nVM 100 (web01) removed.',
  'qm set <VMID> --memory 8192 --cores 4 --balloon 0':
    '(VM 100 config updated — changes apply at next boot for offline settings)',
  'qm resize <VMID> <DISK> +50G':
    'TASK OK\nDisk scsi0 resized from 32G to 82G',
  'qm listsnapshot <VMID>':
    '         -> Current (you are here!)\npre-update (2026-06-01 02:00:01)\n         -> pre-upgrade-2026-05-01',
  'qm unlock <VMID>':
    '(Lock removed from VM 100)',
  'qm showcmd <VMID> --pretty':
    '/usr/bin/kvm \\\n  -id 100 \\\n  -name web01 \\\n  -smp 4,sockets=1,cores=4,maxcpus=4 \\\n  -m 8192 \\\n  -drive file=/dev/DS-FAST/vm-100-disk-0,format=raw,aio=io_uring \\\n  -netdev bridge,id=net0,br=vmbr0 \\\n  -device virtio-net-pci,netdev=net0,mac=AA:BB:CC:DD:EE:01',
});

patchSection(pve['LXC Containers (pct)'], {
  'pct list':
    '      VMID NAME                 STATUS     MEM(MB)    DISK(GB) PID\n       200 nginx-proxy          running    1024       8.00     12345\n       201 monitoring           running    2048       16.00    12400\n       202 dev-sandbox          stopped    1024       8.00     0',
  'pct config <CTID>':
    'arch: amd64\ncores: 2\nhostname: nginx-proxy\nmemory: 1024\nnet0: name=eth0,bridge=vmbr0,hwaddr=AA:BB:CC:DD:EE:20,ip=10.0.0.50/24,gw=10.0.0.1,tag=10\nonboot: 1\nostype: debian\nrootfs: DS-FAST:subvol-200-disk-0,size=8G\nunprivileged: 1',
  'pct start <CTID>':
    '(No output; container started)',
  'pct shutdown <CTID>':
    '(Graceful container shutdown initiated)',
  'pct stop <CTID>':
    '(Container force-stopped immediately)',
  'pct reboot <CTID>':
    '(Container rebooting)',
  'pct enter <CTID>':
    'root@nginx-proxy:~#',
  'pct exec <CTID> -- <CMD> [ARGS]':
    '(Command output returned; e.g. pct exec 200 -- systemctl status nginx)',
  'pct mount <CTID>':
    'mounting container 200 at /var/lib/lxc/200/rootfs',
  'pct unmount <CTID>':
    'unmounted /var/lib/lxc/200/rootfs',
});

patchSection(pve['Storage (pvesm)'], {
  'pvesm status':
    'Name           Type     Status  Total        Used         Avail        %\nlocal          dir      active  99G          42G          57G          42.42%\nDS-FAST        lvmthin  active  2.00T         841G         1.16T        41.07%\nDS-SLOW        nfs      active  8.00T        2.14T         5.86T        26.75%\nbackup-store   nfs      active  20.00T        3.21T        16.79T       16.05%',
  'pvesm list <STORAGE>':
    'Volid                              Format  Type   Size      VMID\nDS-FAST:vm-100-disk-0              raw     images 34359738368  100\nDS-FAST:vm-101-disk-0              raw     images 137438953472 101\nDS-FAST:base-9000-disk-0           raw     images 10737418240  9000',
  'pvesm scan iscsi <PORTAL-IP>':
    'iqn.2024-01.com.purestorage:flasharray01 tcp,10.0.40.50,3260\niqn.2024-01.com.purestorage:flasharray01 tcp,10.0.40.51,3260',
  'pvesm scan nfs <SERVER>':
    '/exports/proxmox\n/exports/iso-lib\n/exports/backups',
  'pvesm scan zfs':
    'rpool\ndata',
  'pvesm add nfs <NAME> --server <IP> --export /exports/proxmox --content backup,iso,vztmpl':
    '(Storage backup-store (nfs) added successfully)',
  'pvesm add lvmthin <NAME> --vgname pve --thinpool data --content rootdir,images':
    '(Storage DS-FAST (lvmthin) added successfully)',
  'pvesm set <NAME> --disable 1':
    '(Storage DS-SLOW disabled)',
  'pvesm remove <NAME>':
    '(Storage definition removed — data on the server is untouched)',
  'pvesm alloc <STORAGE> <VMID> <NAME> 32G':
    'DS-FAST:vm-999-disk-0',
});

patchSection(pve['Networking'], {
  'ip -br -c addr':
    'lo               UNKNOWN        127.0.0.1/8\neno1             UP             10.0.10.11/24\nvmbr0            UP             10.0.10.11/24\nvmbr1            UNKNOWN',
  'ip link show':
    '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n2: eno1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP\n3: vmbr0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP\n4: vmbr1: <BROADCAST,MULTICAST> mtu 9000 qdisc noop state DOWN',
  'ip route':
    'default via 10.0.10.1 dev vmbr0 proto kernel\n10.0.10.0/24 dev vmbr0 proto kernel scope link src 10.0.10.11\n10.0.20.0/24 dev vmbr1 proto kernel scope link src 10.0.20.11',
  'bridge link':
    '2: eno1 state UP @vmbr0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n4: eno2 state UP @vmbr1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000',
  'bridge vlan show':
    'port              vlan-id\neno1              1 PVID Egress Untagged\n                  10\n                  20\nvmbr0             1 PVID Egress Untagged',
  'cat /etc/network/interfaces':
    'auto lo\niface lo inet loopback\n\nauto eno1\niface eno1 inet manual\n\nauto vmbr0\niface vmbr0 inet static\n\taddress 10.0.10.11/24\n\tgateway 10.0.10.1\n\tbridge-ports eno1\n\tbridge-stp off\n\tbridge-fd 0',
  'ifreload -a':
    '(Network interfaces reloaded from /etc/network/interfaces without reboot)',
  'pvesh get /nodes/<NODE>/network':
    '[\n  {"iface":"vmbr0","type":"bridge","address":"10.0.10.11","netmask":"255.255.255.0","gateway":"10.0.10.1","active":1},\n  {"iface":"vmbr1","type":"bridge","address":"10.0.20.11","netmask":"255.255.255.0","active":1}\n]',
  'pvesh create /nodes/<NODE>/network --iface <NAME> --type bridge --bridge_ports eth0 --autostart 1':
    '(Bridge vmbr2 created; use ifreload -a or reboot to activate)',
  'pvesh set /nodes/<NODE>/network --reload 1':
    '(Pending network changes applied)',
});

patchSection(pve['Backup & Restore (vzdump)'], {
  'vzdump <VMID>':
    'INFO: starting new backup job: vzdump 100\nINFO: starting kvm backup for VM 100\nINFO: created snapshot \'vzdump\'\nINFO: transferring \'vm-100-disk-0\' to \'/var/lib/vz/dump/vzdump-qemu-100-2026_06_12-09_42_00.vma.zst\'\n100%\nINFO: backup successful',
  'vzdump <VMID> --mode snapshot --compress zstd --storage <BACKUP-STORE>':
    'INFO: starting new backup job: vzdump 100 --storage backup-store --mode snapshot\nINFO: created storage snapshot vzdump\nINFO: Finished Backup of VM 100 (00:02:34)\nINFO: uploading backup to storage backup-store (260.14 MiB, 112.23 MiB/s)',
  'vzdump --all --mode snapshot --compress zstd --storage <BACKUP-STORE> --mailto admin@example.com':
    'INFO: Backing up all VMs and containers\nINFO: VM 100 web01 OK (00:02:34)\nINFO: VM 101 db01 OK (00:08:12)\nINFO: CT 200 nginx-proxy OK (00:00:48)\nINFO: email report sent to admin@example.com',
  'vzdump <VMID> --stdout | ssh root@dr-host \'cat > /backups/vm-<VMID>.vma.zst\'':
    'INFO: starting VM 100 backup to stdout\nINFO: transferred 260.14 MiB in 00:02:41',
  'qmrestore <ARCHIVE>.vma.zst <NEW-VMID> --storage <STORAGE>':
    'restore vma archive: /var/lib/vz/dump/vzdump-qemu-100-2026_06_12.vma.zst\nextract config from backup archive\ncreating disk vm-999-disk-0 on DS-FAST\nVM 999 restored in 00:01:58',
  'pct restore <NEW-CTID> <ARCHIVE>.tar.zst --storage <STORAGE>':
    'extracting archive: vzdump-lxc-200-2026_06_12.tar.zst\nCT 299 restored successfully.',
  'pvesm list <BACKUP-STORE> | grep backup':
    'backup-store:backup/vzdump-qemu-100-2026_06_12-09_42_00.vma.zst  vma.zst backup 272629760  100\nbackup-store:backup/vzdump-lxc-200-2026_06_12-09_42_30.tar.zst   tar.zst backup  52428800  200',
});

patchSection(pve['High Availability'], {
  'ha-manager status':
    'quorum OK\nmaster pve01\n\nServices:\n  vm:100 (web01)   state: started   node: pve01\n  vm:101 (db01)    state: started   node: pve02\n  lxc:200 (proxy)  state: started   node: pve02',
  'ha-manager config':
    'group: ha-group-1\n  nodes pve01,pve02\n  restricted 0\n  nofailback 0\n\nvm: 100\n  state started\n  group ha-group-1\n  max_relocate 3\n  max_restart 1',
  'ha-manager add vm:<VMID> --state started --max_relocate 3 --max_restart 1':
    '(VM 100 added to HA management; will be monitored and auto-restarted on failure)',
  'ha-manager set vm:<VMID> --state stopped':
    '(HA manager told to keep VM 100 stopped; will not restart automatically)',
  'ha-manager remove vm:<VMID>':
    '(VM 100 removed from HA management)',
  'ha-manager migrate vm:<VMID> <TARGET-NODE>':
    '(HA live-migrate VM 100 to pve02 initiated)',
  'ha-manager relocate vm:<VMID> <TARGET-NODE>':
    '(HA offline-relocate VM 100 to pve02 initiated; VM will be stopped then started on target)',
});

patchSection(pve['ZFS'], {
  'zpool list':
    'NAME   SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT\nrpool  894G   421G   473G        -         -        12%    47%  1.00x    ONLINE  -',
  'zfs list':
    'NAME                       USED  AVAIL     REFER  MOUNTPOINT\nrpool                      421G   452G       96K  /rpool\nrpool/ROOT                  42G   452G       96K  legacy\nrpool/ROOT/pve-1            42G   452G       42G  /\nrpool/data                 378G   452G       96K  /rpool/data\nrpool/data/vm-100-disk-0    32G   452G       32G  -',
  'zfs list -t snapshot':
    'NAME                                        USED  AVAIL     REFER  MOUNTPOINT\nrpool/data/vm-100-disk-0@vzdump              840M      -       32G  -\nrpool/data/vm-100-disk-0@pre-update          1.2G      -       32G  -',
  'zfs snapshot <POOL>/<DS>@<NAME>':
    '(Snapshot rpool/data/vm-100-disk-0@pre-update created instantly; consumes no initial space)',
  'zfs send -R <POOL>/<DS>@<SNAP> | ssh dr-host \'zfs recv -F dr-pool/<DS>\'':
    'sending from rpool/data/vm-100-disk-0\nreceiving at dr-host:dr-pool/vm-100-disk-0\n(32.0 GB transferred in 00:04:22)',
  'zpool scrub <POOL>':
    '(Scrub started; monitor with zpool status until "scrub repaired 0B")',
  'zpool replace <POOL> <OLD-DEV> <NEW-DEV>':
    '(Resilver started; monitor with zpool status — may take hours on large pools)',
  'zpool set autoexpand=on <POOL>':
    '(autoexpand enabled; rpool will grow automatically when drives are replaced with larger ones)',
  'zpool import -f <POOL>':
    '(Pool rpool force-imported — ensure old host is offline first to prevent dual-import corruption)',
});

patchSection(pve['Users & Auth (pveum)'], {
  'pveum user list':
    '┌─────────────────────┬───────────┬───────────────────────┐\n│ userid              │ comment   │ groups                │\n├─────────────────────┼───────────┼───────────────────────┤\n│ admin@pve           │ Admin     │ admins                │\n│ ops@pve             │ Ops team  │ admins,operators      │\n│ root@pam            │ root      │                       │\n└─────────────────────┴───────────┴───────────────────────┘',
  'pveum user add ops@pve --groups admins --comment "Ops team"':
    '(User ops@pve created in realm pve; set password with pveum passwd)',
  'pveum passwd <USER>@<REALM>':
    'Enter new password:\nConfirm new password:\nPassword updated.',
  'pveum group add admins -comment "Admin group"':
    '(Group admins created)',
  'pveum role list':
    '┌──────────────────┐\n│ roleid           │\n├──────────────────┤\n│ Administrator    │\n│ PVEAdmin         │\n│ PVEAuditor       │\n│ PVEDatastoreUser │\n│ PVEVMUser        │\n└──────────────────┘',
  'pveum acl modify / -group admins -role Administrator':
    '(ACL set: group admins → Administrator at path /)',
  'pveum realm list':
    '┌────────┬─────────┐\n│ realm  │ type    │\n├────────┼─────────┤\n│ pam    │ pam     │\n│ pve    │ pve     │\n│ ldap   │ ldap    │\n└────────┴─────────┘',
  'pveum tfa list <USER>@<REALM>':
    '┌────────┬──────────┬─────────────────────────┐\n│ type   │ id       │ description             │\n├────────┼──────────┼─────────────────────────┤\n│ totp   │ totp-001 │ Google Authenticator     │\n└────────┴──────────┴─────────────────────────┘',
});

patchSection(pve['API & Automation (pvesh)'], {
  'pvesh get /version':
    '{"release":"8.2","repoid":"abcd1234","version":"8.2.4"}',
  'pvesh get /cluster/status':
    '[\n  {"id":"cluster","name":"corp-pve","nodes":3,"quorate":1,"type":"cluster","version":5},\n  {"id":"node/pve01","local":1,"name":"pve01","nodeid":1,"online":1,"type":"node"},\n  {"id":"node/pve02","local":0,"name":"pve02","nodeid":2,"online":1,"type":"node"}\n]',
  'pvesh get /nodes/<NODE>/qemu':
    '[\n  {"vmid":100,"name":"web01","status":"running","maxcpu":4,"maxmem":4294967296,"pid":18432},\n  {"vmid":101,"name":"db01","status":"running","maxcpu":8,"maxmem":8589934592,"pid":18441}\n]',
  'pvesh get /nodes/<NODE>/qemu/<VMID>/status/current':
    '{\n  "name": "web01",\n  "status": "running",\n  "uptime": 4123800,\n  "cpu": 0.03,\n  "cpus": 4,\n  "mem": 2147483648,\n  "maxmem": 4294967296,\n  "disk": 0,\n  "diskread": 1073741824,\n  "diskwrite": 536870912,\n  "netin": 2147483648,\n  "netout": 1073741824,\n  "pid": 18432,\n  "qmpstatus": "running"\n}',
  'pvesh create /nodes/<NODE>/qemu/<VMID>/status/start':
    '{"data":"UPID:pve01:0000482C:0012AB34:5F3C1234:qmstart:100:root@pam:"}',
  'pvesh set /nodes/<NODE>/qemu/<VMID>/config --memory 8192 --cores 4':
    '(No output; VM config updated — next-start values for offline settings)',
  'pvesh create /access/ticket --username root@pam --password \'...\'':
    '{"ticket":"PVE:root@pam:XXXXXXXX::...","CSRFPreventionToken":"XXXXXXXX:..."}',
  'pvesh get /cluster/resources --output-format json | jq \'.[] | select(.type=="vm")\'':
    '{"id":"qemu/100","name":"web01","status":"running","node":"pve01","type":"vm","maxcpu":4,"maxmem":4294967296}\n{"id":"qemu/101","name":"db01","status":"running","node":"pve01","type":"vm","maxcpu":8,"maxmem":8589934592}',
});

patchSection(pve['Firewall (pve-firewall)'], {
  'pve-firewall status':
    'Cluster Firewall: enabled\nNode Firewall   : enabled\nRuleset version : 12\nnftables backend: active',
  'pve-firewall start':
    '(Firewall service started; nftables rules loaded)',
  'pve-firewall stop':
    '(Firewall service stopped; all nftables rules removed — WARNING: host is exposed)',
  'pve-firewall compile':
    '(Ruleset compiled and printed to stdout — dry-run, no changes applied)',
  'pve-firewall localnet':
    'Local Network: 10.0.10.0/24 (vmbr0)\nCorosync interfaces: 10.0.10.11, 10.0.10.12',
  'iptables -L -nv':
    'Chain INPUT (policy ACCEPT 0 packets, 0 bytes)\n pkts bytes target     prot opt in     out     source               destination\n 1241  112K ACCEPT     all  --  *      *       0.0.0.0/0            0.0.0.0/0            /* PVE-FIREWALL */',
  'nft list ruleset':
    'table inet proxmox-firewall {\n  chain forward {\n    type filter hook forward priority filter; policy drop;\n    ct state established,related accept\n    ip saddr 10.0.10.0/24 accept\n  }\n}',
});

patchSection(pve['Updates & Maintenance'], {
  'apt update':
    'Hit:1 http://ftp.debian.org/debian bookworm InRelease\nGet:2 https://enterprise.proxmox.com/debian/pve bookworm InRelease [8,154 B]\nGet:3 http://security.debian.org/debian-security bookworm-security InRelease [48.0 kB]\nReading package lists... Done',
  'apt list --upgradable':
    'Listing... Done\nproxmox-ve/bookworm 8.2.6 amd64 [upgradable from: 8.2.4]\npve-manager/bookworm 8.2.6 amd64 [upgradable from: 8.2.4]\nqemu-server/bookworm 8.2.3 amd64 [upgradable from: 8.2.1]',
  'apt dist-upgrade -y':
    'Reading package lists... Done\nThe following packages will be upgraded:\n  proxmox-ve pve-manager qemu-server\n3 upgraded, 0 newly installed, 0 to remove\nDo you want to continue? [Y/n] ...\nSetting up proxmox-ve (8.2.6) ...',
  'pveupgrade':
    'current version: pve-manager/8.2.4\nnewest version:  pve-manager/8.2.6\nPlease reboot after upgrade.',
  'pveam update':
    'download metadata from \'https://download.proxmox.com/images/system/\'\ndownloading new image list... OK',
  'pveam available --section system | grep debian-12':
    'system          debian-12-standard_12.7-1_amd64.tar.zst',
  'pveam download <STORAGE> <TEMPLATE>':
    'downloading https://download.proxmox.com/images/system/debian-12-standard_12.7-1_amd64.tar.zst to DS-FAST:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst\n100%\ndownload successful',
  'pvesubscription get':
    '{\n  "status" : "Active",\n  "level" : "c",\n  "message" : "Your subscription status is valid\.",\n  "key" : "pve4e-XXXXXXXXXXXXXXXX",\n  "nextduedate" : "2027-06-01"\n}',
});

patchSection(pve['Logs & Diagnostics'], {
  'journalctl -u pve-cluster -f':
    'Jun 12 09:42:00 pve01 pmxcfs[1234]: [status] notice: pve02: online\nJun 12 09:42:10 pve01 pmxcfs[1234]: [dcdb] notice: data update from pve02',
  'journalctl -u pveproxy -u pvedaemon -u pvestatd --since today':
    'Jun 12 06:00:01 pve01 pvedaemon[1234]: <root@pam> starting task UPID:pve01:vzdump:100\nJun 12 09:18:22 pve01 pveproxy[1234]: 10.0.0.50 - root@pam [GET /api2/json/version HTTP/1.1] 200',
  'journalctl -u corosync -f':
    'Jun 12 09:42:00 pve01 corosync[1234]: [KNET ] link: pve02:0 is up\nJun 12 09:42:00 pve01 corosync[1234]: [VOTEQ] quorum achieved\nJun 12 09:42:01 pve01 corosync[1234]: [QUORM] This node is within the primary component',
  'journalctl _COMM=qemu-system-x86_64 --since \'-1h\'':
    'Jun 12 09:00:00 pve01 qemu-system-x86_64[18432]: kvm_set_irq: kvm ioctl KVM_IRQ_LINE failed\nJun 12 09:30:00 pve01 qemu-system-x86_64[18441]: pci_add_option_rom: failed to find romfile "efi-virtio.rom"',
  'tail -f /var/log/pveproxy/access.log':
    '10.0.0.50 - root@pam [12/Jun/2026:09:42:17 +0000] "GET /api2/json/nodes/pve01/qemu HTTP/1.1" 200 8421\n10.0.0.50 - root@pam [12/Jun/2026:09:42:18 +0000] "GET /api2/json/cluster/resources HTTP/1.1" 200 24842',
  'tail -f /var/log/pve/tasks/active':
    'UPID:pve01:000418AC:001BC234:68489819:vzdump:100:root@pam:\nUPID:pve01:000418AD:001BC235:68489820:qmsnapshot:101:root@pam:',
  'ls /var/log/pve/tasks/index':
    '-rw-r--r-- 1 root www-data 184321 Jun 12 09:42 /var/log/pve/tasks/index\n(Each line in index: UPID + status. cat <UPID-path> for full log of that task)',
  'dmesg -T | tail -100':
    '[Thu Jun 12 09:42:17 2026] SCSI device sda: 1953525168 512-byte logical blocks\n[Thu Jun 12 09:42:00 2026] EXT4-fs (vda): mounted filesystem\n[Thu Jun 12 09:40:12 2026] kvm_intel: VMX enabled on CPU 0',
  'pvereport > /tmp/pvereport.txt':
    '(Full diagnostic bundle written to /tmp/pvereport.txt — attach to Proxmox support ticket)',
});

// Add 1 new Proxmox command
addNewCmds(pve['System & Status'], [
  {
    cmd: 'pveceph status',
    desc: 'Ceph cluster health summary — OSDs up/in, placement groups, I/O stats (requires Ceph installed)',
    type: 'show',
    flagged: false,
    example: 'HEALTH_OK\ncluster:\n  id:     a1b2c3d4-e5f6-7890-abcd-ef1234567890\n  health: HEALTH_OK\nservices:\n  mon: 3 daemons, quorum pve01,pve02,pve03\n  mgr: pve01(active), standbys: pve02\n  osd: 12 osds: 12 up (since 47d), 12 in (since 47d)\ndata:\n  pools:   4 pools, 256 pgs\n  objects: 124.21k objects, 482 GiB\n  usage:   1.45 TiB used, 10.55 TiB / 12 TiB avail\n  pgs:     256 active+clean',
  },
]);

// ─────────────────────────────────────────────
// ARUBA CX — 10 per section (skip already-populated)
// ─────────────────────────────────────────────
const acx = data.platforms.aruba_cx.sections;

patchSection(acx['System & Status'], {
  'show system':
    'System Information\n  Platform       : ArubaOS-CX 8325\n  ROM Version    : GL.10.10.1004\n  BIOS            : GL.10.10.1004\n  Build Version  : GL.10.13.0060\n  Build Date      : 2026-01-14 13:42:00 UTC\n  Active Image   : primary\n  System uptime  : 47 days, 12:30:15',
  'show system resource-utilization':
    'CPU:     18% (1-min avg)\nMemory:  Total: 16.00 GB  Used: 4.82 GB  Free: 11.18 GB\nStorage: Total: 120 GB    Used: 14 GB   Free: 106 GB',
  'show inventory':
    'System Description: Aruba 8325-48Y8C\nSerial Number     : SG12345678\nHardware Revision : H01\nMAC Address       : aa:bb:cc:dd:ee:00\nPower Supplies    : PSU0 (OK), PSU1 (OK)\nFans              : FAN0 (OK), FAN1 (OK)',
  'show environment temperature':
    'Sensor    Reading   Min     Max     Status\nCPU       43°C      5°C     85°C    Normal\nSwitch    38°C      5°C     75°C    Normal\nAmbient   28°C      5°C     65°C    Normal',
  'show environment fan':
    'Fan   Speed     Status\nFAN0  4800 RPM  Normal\nFAN1  4750 RPM  Normal',
  'show environment power-supply':
    'PSU   Status  Input     Output\nPSU0  OK      AC 240V   12V/25A\nPSU1  OK      AC 240V   12V/22A',
  'show running-config':
    '!Version ArubaOS-CX GL.10.13.0060\nhostname aruba-cx-01\nip dns server-address 10.0.0.53\nntp server 10.0.0.51\nsnmp-server host 10.0.0.60 version 2c public\nvlan 1,10,20,30\n!',
  'show running-config interface 1/1/1':
    'interface 1/1/1\n    description Access-PC1\n    no shutdown\n    no routing\n    vlan access 10',
  'show startup-config':
    '!Version ArubaOS-CX GL.10.13.0060\n(Same as running-config if write memory was executed after last change)',
  'show events':
    'Jun 12 09:42:15  Interface 1/1/12 changed state to down\nJun 12 09:41:22  OSPF neighbor 10.0.0.2 changed to Full\nJun 12 09:30:00  LLDP neighbor on 1/1/49 updated',
});

patchSection(acx['Interfaces'], {
  'show interface':
    'Interface 1/1/1 is up, line protocol is up (connected)\n Description: Access-PC1\n Hardware: Ethernet, MAC Address: aa:bb:cc:00:01:01\n MTU 1500\n Full-duplex, 1000Mb/s\n Input : 14823441 packets, 18432441122 bytes, 0 errors\n Output: 12441832 packets, 14234112441 bytes, 0 errors',
  'show interface 1/1/1':
    'Interface 1/1/1 is up, line protocol is up (connected)\n Description: Access-PC1\n Hardware: Ethernet, MAC: aa:bb:cc:00:01:01\n Full-duplex, 1000Mb/s\n Input:  14823441 pkts, 18432441122 bytes, 0 errors\n Output: 12441832 pkts, 14234112441 bytes, 0 errors',
  'show interface 1/1/1 transceiver':
    'Interface 1/1/1 transceiver status:\n Vendor        : FINISAR CORP.\n Part Number   : FTLX8574D3BCL\n Type          : SFP+\n Wavelength    : 850 nm\n Tx Power      : -2.42 dBm\n Rx Power      : -2.15 dBm\n Temperature   : 32.5°C\n Status        : OK',
  'show interface error-counters':
    'Interface   In-CRC  In-Align  In-Err  Out-Err  In-Drop  Out-Drop\n1/1/1            0         0       0        0        0         0\n1/1/2            0         0       0        0        2         0\n1/1/49           0         0       0        0        0         0',
  'show lldp neighbors detail':
    'Interface 1/1/49, via: LLDP, RID: 1, Time: 0 day, 0 hour, 8 min, 41 sec\n  Chassis id: aa:bb:cc:dd:ee:ff\n  Port id: GigabitEthernet1/0/1\n  Port description: Uplink to aruba-cx-01 1/1/49\n  System name: core-sw-01\n  System description: Cisco Catalyst 9300-48P\n  Capabilities: Bridge, Router',
  'show lldp interface':
    'Interface  Tx       Rx       Tx-Pkts  Rx-Pkts  Tx-Discards  Rx-Discards\n1/1/1      enabled  enabled  1424     1418     0            0\n1/1/49     enabled  enabled  8421     8419     0            0',
  'show poe-power':
    'PoE Power Status:\n  Total Power (W)   : 1440\n  Used Power (W)    : 842\n  Available (W)     : 598\n  PoE-enabled ports : 48',
  'show poe-power interface 1/1/1':
    'Interface 1/1/1 PoE Status:\n  Admin     : enabled\n  Status    : Delivering\n  Priority  : Low\n  Power (W) : 12.8\n  Class     : 3',
  'shutdown':
    '(Interface administratively shut down)',
  'no shutdown':
    '(Interface brought up)',
});

patchSection(acx['VLANs'], {
  'show vlan 10':
    'VLAN  Name              Status    Reason          Ports\n----  ----------------  --------  ---------------  ----\n  10  DATA              up        OK               1/1/1-12',
  'show vlan summary':
    'Number of existing VLANs: 5\nVLAN IDs: 1,10,20,30,99',
  'vlan 10\n name DATA':
    '(VLAN 10 created with name DATA)',
  'vlan 10-20':
    '(VLANs 10 through 20 created)',
  'no vlan 10':
    '(VLAN 10 deleted)',
});

patchSection(acx['Spanning Tree'], {
  'show spanning-tree':
    'MST0\n  Root ID  Priority    4096\n           Address     aa:bb:cc:dd:ee:00 (this switch is root)\n  Bridge ID Priority    4096\n            Address     aa:bb:cc:dd:ee:00\n            Hello time 2  Max Age 20  Forward Delay 15\nPort     Role      State      Cost    Prio   Type\n1/1/49   DesigFwd  Forwarding 20000   128    P2P\n1/1/1    DesigFwd  Forwarding 20000   128    Edge',
  'show spanning-tree detail':
    'MST0 is executing the MSTP compatible Rapid Spanning Tree Protocol\n  Bridge Identifier has priority 4096, address aa:bb:cc:dd:ee:00\n  Configured hello time 2, max age 20, forward delay 15\n  We are the root of the spanning tree\n  Topology change flag not set\nPort 1/1/49 (Ethernet, index 49)\n  Port path cost 20000, Port priority 128, Port Identifier 128.49\n  Designated port is 1/1/49, designated bridge has priority 4096',
  'show spanning-tree mst':
    'MST instance  VLAN range  Priority  Root Switch  Cost\n0             1,10,20,30  4096      (This switch) 0\n1             10,20       4096      (This switch) 0',
  'show spanning-tree mst configuration':
    'Name     : CORP\nRevision : 1\nInstance  VLAN range\n0         remaining VLANs\n1         10,20\n2         30',
  'show spanning-tree statistics':
    'Port    Role   State       Cost  Rx-BPDU  Tx-BPDU  Rx-TCN  Tx-TCN\n1/1/49  Desg   Forwarding  20000    8421     8419      14       3\n1/1/1   Desg   Forwarding  20000     841      841       2        1',
  'spanning-tree mode mstp':
    '(MSTP mode enabled globally)',
  'spanning-tree config-name CORP\nspanning-tree config-revision 1\nspanning-tree instance 1 vlan 10,20':
    '(MST region configured: name CORP, revision 1, instance 1 with VLANs 10,20)',
  'interface 1/1/1\n spanning-tree port-type admin-edge\n spanning-tree bpdu-guard':
    '(Interface 1/1/1 set as edge port with BPDU-guard enabled — will err-disable on BPDU receipt)',
});

patchSection(acx['L3 Routing'], {
  'show ip route vrf <name>':
    'Displaying ipv4 routes selected for forwarding in VRF MGMT\nDestination       Gateway       Interface  AD/M   Distance  NextHopAddr\n0.0.0.0/0         10.99.99.1    1/1/1      8/0    0         -\n10.99.99.0/24     connected     1/1/1      0/0    0         -',
  'show ip route summary':
    'Route Summary for VRF default\nProto     Total  FIB\nconnected  12     12\nstatic      1      1\nospf       48     48\nbgp         0      0\ntotal      61     61',
  'show ip arp':
    'IPv4 Address      MAC Address        Port          VLAN  Age\n10.0.0.1          aa:bb:cc:00:00:01  1/1/49        -      2min\n10.0.10.100       00:50:56:ab:cd:01  1/1/1         10     1min',
  'show ipv6 route':
    'Displaying ipv6 routes selected for forwarding\nDestination           Gateway     Interface  Flags  Age\n::/0                  via fe80::1  1/1/49     S      02:41:12\nfe80::/64             direct       1/1/49     C      47:12:30',
  'show ipv6 neighbors':
    'IPv6 Address                          MAC               Port\nfe80::1                               aa:bb:cc:00:00:01  1/1/49\n2001:db8:10::1                        00:50:56:ab:cd:01  1/1/1',
  'show ip ospf':
    'OSPF Process 1 (Router-ID: 1.1.1.1)\n  OSPF is enabled and active\n  Routing process: UP\n  Area count: 1 (1 Normal, 0 Stub, 0 NSSA)\n  Number of interfaces in this process: 3\n  Total number of neighbors: 2\n  Redistributing: connected',
  'show ip ospf neighbor':
    'Neighbor ID   State    Dead Time  Address       Interface\n2.2.2.2       Full/DR  00:00:32   10.0.0.2      1/1/49\n3.3.3.3       Full/BDR 00:00:28   10.0.1.2      1/1/50',
  'show ip ospf interface':
    'Interface 1/1/49 is up, line protocol is up\n  OSPF process 1, Area 0.0.0.0\n  Cost: 10  Priority: 1  Hello Interval: 10  Dead Interval: 40\n  Designated Router: 10.0.0.2\n  Backup Designated Router: 10.0.0.1\n  Neighbor count: 1',
  'show bgp ipv4 unicast summary':
    'BGP summary for VRF default, address family IPv4 Unicast\nBGP router identifier 1.1.1.1, local AS number 65001\nNeighbor     V    AS MsgRcvd MsgSent Up/Down  State/PfxRcd\n1.2.3.4      4 65002    1242    1241 47d12h   48',
  'show bgp ipv4 unicast':
    'BGP table version is 49\nStatus codes: s suppressed, d damped, h history, * valid, > best\nOrigin codes: i - IGP, e - EGP, ? - incomplete\n   Network          Next Hop        Metric LocPrf Weight Path\n*> 0.0.0.0/0        1.2.3.4              0    100      0 65002 i\n*> 10.0.0.0/8       1.2.3.4              0    100      0 65002 i',
});

patchSection(acx['VRF'], {
  'show vrf':
    'VRF Configuration:\nName          State  L3 Ports  Description\ndefault       up     14\nMGMT          up      1        Out-of-band management',
  'show vrf <name>':
    'VRF \"MGMT\"\n  State         : up\n  L3 Ports      : 1 (mgmt)\n  DNS Server    : 10.99.0.53\n  Default Route : 10.99.99.1',
  'vrf <name>':
    '(VRF MGMT created)',
  'interface 1/1/1\n vrf attach <name>':
    '(Interface 1/1/1 attached to VRF MGMT — note: removes any existing L3 config on interface)',
});

patchSection(acx['VSX / VSF'], {
  'show vsx status':
    'VSX Status\n  Role            : Primary\n  Config Sync     : Complete\n  ISL State       : Up\n  Keepalive State : Alive\n  Peer            : vsx-secondary (10.99.99.2)\n  Last Sync       : Jun 12 09:42:10',
  'show vsx config-consistency':
    'Configuration Consistency Check\n  Result: Consistent\n  Last Check: Jun 12 09:42:10\n  Differences: None',
  'show vsx active-forwarding':
    'Active Forwarding VLANs:\n  VLAN 10: Primary\n  VLAN 20: Primary\n  VLAN 30: Secondary',
  'show vsx brief':
    'VSX Brief\n  Role: Primary  Peer: vsx-secondary\n  ISL: Up (lag 256)  Keepalive: Alive\n  Config Sync: Complete',
  'show vsf':
    'VSF Status: Not configured\n(VSF is the stacking feature; VSX is the active-active chassis)',
  'show vsf detail':
    'VSF is not configured on this system.',
  'show vsf topology':
    'VSF topology: not applicable — VSF not configured',
  'vsx\n inter-switch-link lag 256\n role primary\n keepalive peer 10.99.99.2 source 10.99.99.1':
    '(VSX configured: ISL on LAG 256, this switch is primary, keepalive to 10.99.99.2)',
});

patchSection(acx['ACLs'], {
  'show access-list':
    'Access List Summary\nName            Type   Entries  Refs\nALLOW_WEB       ip     3        2\nDENY_RFC1918    ip     12       0\nINTERNAL_ONLY   ip     4        5',
  'show access-list ip <name>':
    'Access List ALLOW_WEB (IPv4):\n  10 permit tcp any any eq 443\n  20 permit tcp any any eq 80\n  30 deny any any any log',
  'show access-list hitcounts ip <name>':
    'Access List ALLOW_WEB hit counts:\n  10 permit tcp any any eq 443    : 1,824,441 matches\n  20 permit tcp any any eq 80     :   124,221 matches\n  30 deny any any any log          :        82 matches',
  'access-list ip ALLOW_WEB\n 10 permit tcp any any eq 443\n 20 permit tcp any any eq 80\n 30 deny any any any log':
    '(ACL ALLOW_WEB created with 3 entries)',
  'interface 1/1/1\n apply access-list ip ALLOW_WEB in':
    '(ACL ALLOW_WEB applied inbound on interface 1/1/1)',
});

patchSection(acx['Security & AAA'], {
  'show user-list':
    'User      Groups              Role        Auth\nadmin     administrators      read-write   local\nmonitor   operators           read-only    local',
  'show users':
    'Username   Line         Login Time     Location\nadmin      vty0         09:42:15       10.0.0.50 (SSH)',
  'show aaa authentication':
    'AAA Authentication\n  login: group TACACS local\n  enable: enable\n  TACACS server group TACACS: 10.10.10.50 (primary), 10.10.10.51 (backup)',
  'show aaa server-groups':
    'TACACS server group \"TACACS\":\n  Server: 10.10.10.50  Status: UP  Failures: 0\n  Server: 10.10.10.51  Status: UP  Failures: 0',
  'show port-access clients':
    'Port    MAC               VLAN  Role       Auth-Method  Status\n1/1/1   00:50:56:ab:cd:01  10    employee   802.1X       Authenticated\n1/1/2   aa:bb:cc:dd:ee:01  20    printer    MAC          Authenticated',
  'show port-access role':
    'Role          VLAN  Clients  Auth-Method\nemployee      10    124      802.1X\nprinter       20     14      MAC\ndeny-access    1      2       802.1X',
  'tacacs-server host 10.10.10.50 key plaintext <key>':
    '(TACACS+ server 10.10.10.50 configured)',
  'aaa group server tacacs+ TAC\n server 10.10.10.50':
    '(TACACS+ server group TAC created with server 10.10.10.50)',
  'aaa authentication login default group TAC local':
    '(Login auth order: TACACS group TAC, then local fallback)',
  'user admin password plaintext <pwd> role administrators':
    '(Admin user password and role updated)',
});

patchSection(acx['QoS'], {
  'show qos schedule-profile':
    'Schedule Profile \"strict-profile\"\n  Queue 0: strict\n  Queue 1: strict\n  Queue 2: WRR weight 40\n  Queue 3: WRR weight 60',
  'show qos queue-profile':
    'Queue Profile \"default-profile\"\n  Queue 0: dscp 0-7   (Best Effort)\n  Queue 1: dscp 8-15  (CS1)\n  Queue 4: dscp 32-39 (CS4)\n  Queue 6: dscp 46,47 (EF/Voice)',
  'show class':
    'Class map VOICE (IPv4)\n  Match: dscp 46',
  'show policy':
    'Policy MARK\n  Class VOICE\n    Action: mark dscp 46',
  'show policy hitcounts':
    'Policy MARK (applied on 1/1/1 ingress)\n  Class VOICE: 284,441 packets matched',
  'qos trust dscp':
    '(Globally trust DSCP markings from connected devices)',
  'class ip VOICE\n 10 match dscp 46\n!\npolicy MARK\n class VOICE\n  action mark dscp 46':
    '(Class VOICE matching EF DSCP 46; policy MARK applies it)',
});

patchSection(acx['Logging & Telemetry'], {
  'show audit-trail':
    'Jun 12 09:42:01 admin 10.0.0.50 SSH: interface 1/1/12 shutdown\nJun 12 09:38:44 admin 10.0.0.50 SSH: write memory\nJun 12 09:30:12 admin Console: vlan 30 name SERVERS',
  'show ntp status':
    'NTP Status:\n  Synchronised: yes\n  Reference: 10.0.0.51 (stratum 2)\n  Offset:     0.421 ms\n  Jitter:     0.142 ms',
  'show ntp associations':
    'Remote         Refid      S T  When Poll Reach  Delay  Offset  Jitter\n*10.0.0.51      .GPS.      1 u   42   64  377   0.421   0.182   0.142\n 10.0.0.52      10.0.0.51  2 u   38   64  377   0.512  -0.043   0.182',
  'show snmp':
    'SNMP Status: enabled\nContact  : noc@corp.example.com\nLocation : DC1-Row3-Rack5\nAgentPort: 161\nTrap port: 162\nVersion  : SNMPv2c, SNMPv3',
  'show snmp community':
    'Community string \"public\"   Access: read-only\nCommunity string \"private\"  Access: read-write (restricted to 10.0.0.0/24)',
  'logging 10.50.50.50 severity warning':
    '(Syslog to 10.50.50.50, warning-and-above)',
  'ntp server 10.10.10.10\nntp enable':
    '(NTP server configured and NTP synchronisation enabled)',
});

patchSection(acx['Diagnostics'], {
  'ping 1.1.1.1':
    'PING 1.1.1.1 (1.1.1.1): 56 data bytes\n64 bytes from 1.1.1.1: icmp_seq=0 ttl=56 time=4.837 ms\n64 bytes from 1.1.1.1: icmp_seq=1 ttl=56 time=4.621 ms\n--- 1.1.1.1 ping statistics ---\n5 packets transmitted, 5 packets received, 0% packet loss\nround-trip min/avg/max = 4.621/4.792/4.837 ms',
  'ping 1.1.1.1 source-interface loopback0':
    'PING 1.1.1.1 from 192.0.2.1: 56 data bytes\n64 bytes from 1.1.1.1: icmp_seq=0 ttl=56 time=5.012 ms',
  'traceroute 1.1.1.1':
    'traceroute to 1.1.1.1, 30 hops max, 60 byte packets\n 1  10.0.0.1  1.121 ms\n 2  192.168.1.1  2.441 ms\n 3  1.1.1.1  5.021 ms',
  'show mac-address-table':
    'MAC address     VLAN  Type     Port         Age\naa:bb:cc:dd:ee:01   10  dynamic  1/1/1        240\naa:bb:cc:dd:ee:02   10  dynamic  1/1/2        120\naa:bb:cc:dd:ee:ff    1  static   1/1/49       -',
  'show mac-address-table address 0050.5612.3456':
    'MAC address     VLAN  Type     Port         Age\n00:50:56:12:34:56   10  dynamic  1/1/8        180',
  'show ip dhcp-snooping':
    'DHCP Snooping: enabled\n  VLAN list: 10,20,30\n  Verify MAC: enabled\n  Rate limit: 100 pps per port',
  'show ip dhcp-snooping binding':
    'MAC Address         IP Address    Lease  Type     VLAN  Port\n00:50:56:ab:cd:01  10.0.10.100   86400  dynamic  10    1/1/1\n00:50:56:ab:cd:02  10.0.10.101   86400  dynamic  10    1/1/2',
  'diag-dump':
    '(Diagnostic dump collected to /var/log/aruba/diag-dump-20260612.tar.gz)',
  'show tech':
    '### show version ###\nArubaOS-CX GL.10.13.0060 ...\n### show interface ###\n...\n(Full diagnostic; capture output to file for support)',
  'show tech | redirect tftp://10.50.50.50/tech.txt':
    '(Tech-support output saved to TFTP server 10.50.50.50 as tech.txt)',
});

patchSection(acx['Config Management'], {
  'copy running-config startup-config':
    '(Configuration saved to startup-config)',
  'write memory':
    'Copying configuration: [Success]',
  'checkpoint create CHK1':
    'Checkpoint CHK1 created successfully.',
  'show checkpoint list':
    'Checkpoints:\n  CHK1  Jun 12 09:40:00\n  CHK0  Jun 11 14:22:10 (startup-config)',
  'show checkpoint diff CHK1 startup-config':
    '--- CHK1\n+++ startup-config\n-interface 1/1/12\n-  description \"test port\"\n+interface 1/1/12\n+  description \"DECOMMISSIONED\"',
  'checkpoint rollback CHK1':
    'Rolling back to checkpoint CHK1... done.\nNote: write memory to persist.',
  'copy running-config tftp://10.50.50.50/<host>.cfg':
    'Copying configuration to tftp://10.50.50.50/aruba-cx-01.cfg\n(Transfer complete)',
  'boot system primary':
    'Primary partition selected for next boot.',
  'boot set-default secondary':
    'Secondary partition set as default boot partition.',
  'reboot':
    'Are you sure you want to reboot the system? (y/n): y\nRebooting...',
});

patchSection(acx['REST API & Automation'], {
  'show api session':
    'Active REST API sessions:\n  admin  10.0.0.50  REST  Since: 09:38:00  Expiry: 09:53:00',
  'show ssh server':
    'SSH server status: enabled\n  Version    : 2 (only)\n  Max sessions: 4\n  Authentication timeout: 120 seconds',
  'https-server rest access-mode read-write':
    '(REST API set to read-write mode)',
  'https-server vrf mgmt':
    '(HTTPS REST API bound to VRF MGMT interface only)',
  'show telemetry':
    'Telemetry: enabled\n  Collectors:\n    10.0.0.70:50051  gRPC  State: Connected',
});

// Add 1 new Aruba CX command
addNewCmds(acx['Diagnostics'], [
  {
    cmd: 'show mac-address-table vlan <id>',
    desc: 'MAC address table filtered to a specific VLAN — useful for identifying hosts in a VLAN',
    type: 'show',
    flagged: false,
    example: 'MAC address table for VLAN 10:\nMAC Address         Type     Port         Age\n00:50:56:ab:cd:01   dynamic  1/1/1        240\n00:50:56:ab:cd:02   dynamic  1/1/2        120\n00:50:56:ab:cd:03   dynamic  1/1/3        80\naa:bb:cc:dd:ee:f0   static   1/1/49       -',
  },
]);

// ─────────────────────────────────────────────
// OPENSSL — 10 per section
// ─────────────────────────────────────────────
const ossl = data.platforms.openssl.sections;

patchSection(ossl['Key Generation'], {
  'openssl genrsa -out private.key 2048':
    'Generating RSA private key, 2048 bit long modulus (2 primes)\n.......+++++\n...+++++\ne is 65537 (0x010001)',
  'openssl genrsa -aes256 -out private.key 4096':
    'Generating RSA private key, 4096 bit long modulus (2 primes)\n...+++++\nEnter pass phrase for private.key:\nVerifying - Enter pass phrase for private.key:',
  'openssl ecparam -name prime256v1 -genkey -noout -out ec.key':
    '(Elliptic curve P-256 private key written to ec.key — no output on success)',
  'openssl genpkey -algorithm ed25519 -out ed25519.key':
    '(Ed25519 private key written to ed25519.key)',
  'openssl dhparam -out dhparam.pem 4096':
    'Generating DH parameters, 4096 bit long safe prime, generator 2\nThis is going to take a long time\n.................................+..........',
  'openssl rand -hex 32':
    'a4f3c2e1b8d7f6e5a3c2b1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0',
  'openssl rand -base64 48':
    'mK8xPqR3sT7uV2wX1yZ0aB5cD9eF4gH6iJ8kL2mN0pQ7rS3tU1v',
  'openssl pkey -in private.key -pubout -out public.key':
    '(Public key extracted from private.key and written to public.key)',
  'openssl ecparam -list_curves':
    'secp112r1 : SECG/WTLS curve over a 112 bit prime field\n...\nprime256v1: X9.62/SECG curve over a 256 bit prime field\nsecp384r1 : NIST/SECG curve over a 384 bit prime field\nsecp521r1 : NIST/SECG curve over a 521 bit prime field\n...(40+ curves listed)',
  'openssl rand -out random.bin 256':
    '(256 bytes of cryptographically random data written to random.bin)',
});

patchSection(ossl['Key Inspection & Manipulation'], {
  'openssl rsa -in private.key -check':
    'RSA key ok',
  'openssl rsa -in private.key -text -noout':
    'Private-Key: (2048 bit, 2 primes)\nmodulus:\n    00:d4:8a:f2:b1:...\npublicExponent: 65537 (0x10001)\nprivateExponent:\n    4e:...\nprime1:\n    00:...\nprime2:\n    00:...',
  'openssl rsa -in private.key -noout -modulus':
    'Modulus=D48AF2B1...E3F24A8C',
  'openssl ec -in ec.key -text -noout':
    'Private-Key: (256 bit)\npriv:\n    87:a4:f3:...\npub:\n    04:b8:...\nASN1 OID: prime256v1\nNIST CURVE: P-256',
  'openssl pkey -in private.key -pubout':
    '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
  'openssl pkcs8 -topk8 -nocrypt -in traditional.key -out pkcs8.key':
    '(PKCS#8 unencrypted key written to pkcs8.key)',
  'openssl pkey -in private.key -traditional -out rsa.key':
    '(Traditional RSA key format written to rsa.key)',
  'openssl rsa -in enc.key -out dec.key':
    'Enter pass phrase for enc.key:\nwriting RSA key',
  'openssl rsa -in dec.key -aes256 -out enc.key':
    'writing RSA key\nEnter PEM pass phrase:\nVerifying - Enter PEM pass phrase:',
  'openssl rsa -in private.key -passin pass:<password> -out unenc.key':
    'writing RSA key\n(Unencrypted key written to unenc.key)',
});

patchSection(ossl['CSR & Certificate Signing'], {
  'openssl req -new -key private.key -out request.csr':
    'You are about to be asked to enter information that will be incorporated into your certificate request.\nCountry Name (2 letter code) [AU]: GB\nState or Province Name [Some-State]: London\nOrganization Name [Internet Widgits Pty Ltd]: Acme Corp\nCommon Name []: example.com\n(CSR written to request.csr)',
  'openssl req -new -newkey rsa:2048 -nodes -keyout private.key -out request.csr':
    'Generating a RSA private key\n.........+++++\nwriting to private.key\n(CSR written to request.csr)',
  'openssl req -x509 -new -nodes -key private.key -sha256 -days 3650 -out ca.crt':
    '(Self-signed CA certificate valid for 10 years written to ca.crt)',
  'openssl x509 -req -in request.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out signed.crt -days 365 -sha256':
    'Signature ok\nsubject=C = GB, ST = London, O = Acme Corp, CN = example.com\nGetting CA Private Key\n(Signed certificate written to signed.crt)',
  'openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout self.key -out self.crt':
    'Generating a RSA private key\n..........+++++\nwriting to self.key\n(Self-signed certificate written to self.crt)',
  'openssl req -new -key private.key -out req.csr -addext "subjectAltName = DNS:example.com,DNS:*.example.com"':
    '(CSR with SAN written to req.csr — verify with openssl req -in req.csr -text -noout)',
  'openssl req -verify -in req.csr -noout':
    'verify OK',
  'openssl req -in req.csr -text -noout -verify':
    'verify OK\nCertificate Request:\n    Data:\n        Version: 1 (0x0)\n        Subject: C=GB, ST=London, O=Acme Corp, CN=example.com\n    Requested Extensions:\n            X509v3 Subject Alternative Name:\n                DNS:example.com, DNS:*.example.com',
  'openssl ca -config openssl-ca.cnf -revoke server.crt':
    'Using configuration from openssl-ca.cnf\nRevoking Certificate 01.\nData Base Updated',
  'openssl ca -config openssl-ca.cnf -gencrl -out ca.crl':
    'Using configuration from openssl-ca.cnf\n(CRL written to ca.crl)',
});

patchSection(ossl['Certificate Inspection'], {
  'openssl x509 -in cert.crt -noout -subject':
    'subject=C = GB, ST = London, O = Acme Corp, CN = example.com',
  'openssl x509 -in cert.crt -noout -issuer':
    'issuer=C = GB, O = Acme CA, CN = Acme Root CA',
  'openssl x509 -in cert.crt -noout -dates':
    'notBefore=Jan  1 00:00:00 2026 GMT\nnotAfter=Jan  1 00:00:00 2027 GMT',
  'openssl x509 -in cert.crt -noout -fingerprint -sha256':
    'SHA256 Fingerprint=A4:F3:C2:E1:B8:D7:F6:E5:A3:C2:B1:D0:E9:F8:A7:B6:C5:D4:E3:F2:A1:B0:C9:D8:E7:F6:A5:B4:C3:D2:E1:F0',
  'openssl x509 -in cert.crt -noout -serial':
    'serial=1A2B3C4D5E6F7A8B',
  'openssl x509 -in cert.crt -noout -ext subjectAltName':
    'X509v3 Subject Alternative Name:\n    DNS:example.com, DNS:*.example.com, IP Address:93.184.216.34',
  'openssl req -in request.csr -text -noout':
    'Certificate Request:\n    Data:\n        Version: 1 (0x0)\n        Subject: C=GB, O=Acme Corp, CN=example.com\n    Signature Algorithm: sha256WithRSAEncryption',
  'openssl rsa -in private.key -check':
    'RSA key ok',
  'openssl pkcs12 -info -in bundle.pfx':
    'Enter Import Password:\nMAC: sha1, Iteration 2048\n...\nCertificate bag\n  subject=CN=example.com\n  issuer=CN=Acme CA\nKey bag',
  'openssl x509 -in cert.crt -noout -checkend 604800':
    'Certificate will not expire\n(Exit code 0 = valid for 7 days; 1 = expires within 7 days)',
});

patchSection(ossl['Verification & Matching'], {
  'openssl verify -CAfile <ca.pem> <cert>':
    'cert.crt: OK',
  'openssl rsa -in private.key -modulus -noout | md5sum':
    '4a2f8b3c1d7e9f0a (must match openssl x509 -modulus output to confirm key/cert pair)',
  'openssl x509 -in cert.crt -modulus -noout | md5sum':
    '4a2f8b3c1d7e9f0a',
  'openssl s_client -connect example.com:443 -verify_return_error 2>&1 | grep "Verify return code"':
    'Verify return code: 0 (ok)',
  'openssl verify -CAfile ca.pem -CRLfile ca.crl -crl_check cert.crt':
    'cert.crt: OK',
  'openssl dhparam -check -in dhparam.pem':
    'DH parameters appear to be ok.\n(No output on failure — exit code non-zero)',
  'openssl verify -purpose sslserver -CAfile ca.pem cert.crt':
    'cert.crt: OK',
  'openssl pkey -in private.key -pubout | md5sum':
    'd3c2b1a0f9e8d7c6 (compare to CSR/cert public key hash to confirm matching pair)',
  'openssl x509 -in cert.crt -pubkey -noout | md5sum':
    'd3c2b1a0f9e8d7c6',
  'openssl crl -in ca.crl -noout -text | grep -A2 "Revoked"':
    'Revoked Certificates:\n    Serial Number: 1A2B3C4D5E6F7A8B\n        Revocation Date: Jun 10 10:00:00 2026 GMT',
});

patchSection(ossl['Format Conversion'], {
  'openssl pkcs12 -export -out bundle.pfx -inkey private.key -in cert.crt -certfile ca.crt':
    'Enter Export Password:\nVerifying - Enter Export Password:\n(PFX bundle written to bundle.pfx)',
  'openssl pkcs12 -in bundle.pfx -nodes -out bundle.pem':
    'Enter Import Password:\n(PEM bundle with key + certs written to bundle.pem)',
  'openssl pkcs12 -in bundle.pfx -nokeys -out certs.pem':
    'Enter Import Password:\n(Certificates only — no private key — written to certs.pem)',
  'openssl pkcs12 -in bundle.pfx -nocerts -nodes -out private.key':
    'Enter Import Password:\n(Unencrypted private key written to private.key)',
  'openssl x509 -inform DER -in cert.der -out cert.pem':
    '(DER-encoded certificate converted to PEM and written to cert.pem)',
  'openssl x509 -outform DER -in cert.pem -out cert.der':
    '(PEM certificate converted to DER binary format)',
  'openssl crl -inform DER -in crl.der -out crl.pem':
    '(DER CRL converted to PEM)',
  'openssl rsa -in private.der -inform DER -out private.pem':
    '(DER RSA key converted to PEM)',
  'openssl crl2pkcs7 -nocrl -certfile chain.pem -out chain.p7b':
    '(PEM chain converted to PKCS#7 format for Windows/Java import)',
  'openssl pkcs7 -in chain.p7b -print_certs -out chain.pem':
    '(PKCS#7 converted back to PEM chain)',
});

patchSection(ossl['TLS Client Testing'], {
  'openssl s_client -connect example.com:443':
    'CONNECTED(00000003)\ndepth=2 C = US, O = DigiCert Inc, CN = DigiCert Global Root CA\ndepth=1 C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1\ndepth=0 CN = example.com\nVerify return code: 0 (ok)\n---\nCertificate chain\n 0 s:CN = example.com\n   i:CN = DigiCert TLS RSA SHA256 2020 CA1\nSSL-Session:\n    Protocol  : TLSv1.3\n    Cipher    : TLS_AES_256_GCM_SHA384',
  'openssl s_client -connect example.com:443 -servername example.com':
    'CONNECTED(00000003)\n...(same as above but with SNI extension)\nVerify return code: 0 (ok)',
  'openssl s_client -connect example.com:443 -showcerts':
    'CONNECTED(00000003)\n---\nCertificate chain\n 0 s:CN = example.com\n-----BEGIN CERTIFICATE-----\nMIIF...\n-----END CERTIFICATE-----\n 1 s:CN = DigiCert TLS RSA SHA256 2020 CA1\n-----BEGIN CERTIFICATE-----\nMIIE...',
  'openssl s_client -connect example.com:443 -tls1_3':
    'CONNECTED(00000003)\nProtocol: TLSv1.3\nCipher: TLS_AES_256_GCM_SHA384\nVerify return code: 0 (ok)',
  'openssl s_client -connect example.com:443 -tls1_2':
    'CONNECTED(00000003)\nProtocol: TLSv1.2\nCipher: ECDHE-RSA-AES256-GCM-SHA384\nVerify return code: 0 (ok)',
  'openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -dates':
    'notBefore=Jan  1 00:00:00 2026 GMT\nnotAfter=Jan  1 00:00:00 2027 GMT',
  'echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -subject -issuer':
    'subject=CN = example.com\nissuer=CN = DigiCert TLS RSA SHA256 2020 CA1',
  'openssl s_client -connect example.com:443 -starttls smtp':
    'CONNECTED(00000003)\n(SMTP STARTTLS negotiation; same handshake output follows)',
  'openssl s_client -connect example.com:443 -starttls ftp':
    'CONNECTED(00000003)\n(FTP AUTH TLS negotiation)',
  'openssl s_client -connect example.com:443 -CAfile /etc/ssl/certs/ca-certificates.crt':
    'CONNECTED(00000003)\nVerify return code: 0 (ok)',
});

patchSection(ossl['Hashing & HMAC'], {
  'openssl dgst -sha256 file.bin':
    'SHA256(file.bin)= e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'openssl dgst -sha512 file.bin':
    'SHA512(file.bin)= cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  'openssl dgst -sha256 -hmac <key> file.bin':
    'HMAC-SHA256(file.bin)= a4f3c2e1b8d7f6e5a3c2b1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0',
  'openssl dgst -sha256 -sign private.key -out sig.bin file.txt':
    '(SHA-256 signature written to sig.bin)',
  'openssl dgst -sha256 -verify public.key -signature sig.bin file.txt':
    'Verified OK',
  'echo -n "hello" | openssl dgst -sha256':
    'SHA256(stdin)= 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  'openssl md5 file.bin':
    'MD5(file.bin)= d41d8cd98f00b204e9800998ecf8427e',
  'openssl sha1 file.bin':
    'SHA1(file.bin)= da39a3ee5e6b4b0d3255bfef95601890afd80709',
  'openssl dgst -sha256 -mac hmac -macopt hexkey:<key> file.bin':
    'HMAC-SHA256(file.bin)= a4f3c2e1b8d7f6e5a3c2b1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0',
  'openssl speed sha256':
    'Doing sha256 for 3s on 16 size blocks: 9842344 sha256\'s in 3.00s\ntype             16 bytes    64 bytes   256 bytes  1024 bytes  8192 bytes\nsha256           52.4 MB/s   175.3 MB/s  403.1 MB/s  592.4 MB/s  678.1 MB/s',
});

// ─────────────────────────────────────────────
// Write result
// ─────────────────────────────────────────────
writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('Part 3 done: Proxmox + Aruba CX + OpenSSL patched');
