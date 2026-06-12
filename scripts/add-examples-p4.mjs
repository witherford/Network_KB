#!/usr/bin/env node
// Patch remaining gaps in Windows, Proxmox, Aruba CX
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

// ─── WINDOWS remaining ───────────────────────
const win = data.platforms.windows.sections;

patchSection(win['Processes'], {
  'Get-Process':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n    841      48   312456     298765    423.12   4421   1  MsMpEng\n    512      28    88432      94210    210.08   2340   1  powershell\n    420      22    62144      71234     98.71   1840   1  svchost',
  'Get-Process | Sort CPU -Descending':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n   1453      87   624384     511232   1847.47   8124   1  chrome\n    841      48   312456     298765    423.12   4421   1  MsMpEng',
  'Get-Process | Sort WS -Descending':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n   1453      87   624384     511232   1847.47   8124   1  chrome\n    412      32   245678     312433    124.33   5521   1  Teams',
  'Get-Service':
    'Status   Name               DisplayName\n------   ----               -----------\nRunning  AudioSrv           Windows Audio\nRunning  BFE                Base Filtering Engine\nStopped  AppMgmt            Application Management\nRunning  BITS               Background Intelligent Transfer Service',
  'Get-Service | Where {$_.Status -eq "Running"}':
    'Status   Name               DisplayName\n------   ----               -----------\nRunning  AudioSrv           Windows Audio\nRunning  BFE                Base Filtering Engine\nRunning  BITS               Background Intelligent Transfer Service',
  'Stop-Service <name>':
    '(No output on success — service stopped)',
  'Get-Process | Sort-Object -Descending CPU | Select -First 15':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n   1453      87   624384     511232   1847.47   8124   1  chrome\n    841      48   312456     298765    423.12   4421   1  MsMpEng\n    512      28    88432      94210    210.08   2340   1  powershell',
  'Get-Process | Sort-Object -Descending WS | Select -First 15 Name,Id,WS,CPU':
    'Name       Id       WS      CPU\n----       --       --      ---\nchrome     8124  523468672  1847.47\nTeams      5521  319881216   124.33\nOutlook   10412  241172480    98.21',
  'Get-ScheduledTask | Where-Object State -ne Disabled | Sort-Object TaskPath':
    'TaskPath                          TaskName                    State\n--------                          --------                    -----\n\\                                 GoogleUpdateTaskMachineCore  Ready\n\\Microsoft\\Windows\\UpdateOrch...  Reboot                      Ready\n\\Microsoft\\Windows\\WindowsUpdate  Scheduled Start             Running',
  'wevtutil qe System /c:20 /rd:true /f:text':
    'Log Name: System\nSource: Service Control Manager\nDate: 6/12/2026 9:42:17 AM\nEvent ID: 7036\nLevel: Information\nDescription: The Windows Update service entered the running state.\n\nLog Name: System\nSource: Disk\nDate: 6/12/2026 9:40:05 AM\nEvent ID: 153\nLevel: Warning\nDescription: The IO operation at logical block address...',
  'Get-WinEvent -LogName Application -MaxEvents 50 | Where-Object LevelDisplayName -in Error,Critical':
    'TimeCreated                     Id LevelDisplayName Message\n-----------                     -- ---------------- -------\n6/12/2026 9:38:42 AM          1000 Error            Faulting application name: example.exe...\n6/12/2026 9:21:14 AM          1002 Error            The program example.exe stopped interacting with Windows...',
});

patchSection(win['Storage'], {
  'chkdsk <drive>:':
    'The type of the file system is NTFS.\nVolume label is Windows.\n\nStage 1: Examining basic file system structure ...\n  256 file records processed.\nFile verification completed.\nNo errors found.',
  'defrag <drive>: /A':
    'Windows Drive Optimizer\nVolume C: (NTFS)\n  Volume size        = 476 GB\n  Free space         = 54 GB\n  Percent fragmented = 0%\nNo optimization needed for C: fragmented: 0%.',
  'fsutil fsinfo drives':
    'Drives: C:\\ D:\\ Z:\\',
  'fsutil volume diskfree <drive>:':
    'Total # of free bytes        : 58,128,412,672\nTotal # of bytes              : 511,068,889,088\nTotal # of avail free bytes   : 58,128,412,672',
  'Get-SmbShare':
    'Name   ScopeName Path                    Description\n----   --------- ----                    -----------\nADMIN$ *         C:\\Windows              Remote Admin\nC$     *         C:\\                     Default share\nIPC$   *                                 Remote IPC\nData   *         D:\\SharedData           Company data',
  'Get-SmbSession':
    'SessionId  ClientComputerName  ClientUserName             NumOpens\n---------  ------------------  --------------             --------\n1          10.0.0.42           CORP\\alice.smith            4\n2          10.0.0.43           CORP\\bob.jones             1',
  'chkdsk <drive>: /scan':
    'The type of the file system is NTFS.\nStage 1: Examining basic file system structure ...\nStage 2: Examining file name linkage ...\nStage 3: Examining security descriptors ...\nWindows has scanned the file system and found no problems.\nNo further action is required.',
  'Repair-Volume -DriveLetter <D> -Scan':
    'NoErrorsFound',
  'diskpart /s <script>':
    'Microsoft DiskPart version 10.0.26100.1\n\nDiskPart successfully executed the script.',
  'Optimize-Volume -DriveLetter <D> -ReTrim -Verbose':
    'VERBOSE: Starting optimization of volume (D:) Data...\nVERBOSE: Performing retrim...\nVERBOSE: The operation completed successfully.',
});

patchSection(win['OOBE & Setup'], {
  'Shift + F10':
    '(Opens a Command Prompt during Windows Setup/OOBE — before any user account is created)',
  'start ms-cxh:localonly':
    '(Launches the local account creation flow in Windows 11 OOBE — bypasses Microsoft account requirement)',
  'OOBE\\BYPASSNRO':
    '(Registers a registry key that forces OOBE to restart without a network requirement; PC reboots to apply)',
  'ipconfig /release':
    'Windows IP Configuration\nSuccessfully released the IP address on adapter Ethernet.',
  'taskkill /F /IM oobenetworkconnectionflow.exe':
    'SUCCESS: The process "oobenetworkconnectionflow.exe" with PID 4840 has been terminated.\n(Kills the network-required page in Windows 11 OOBE)',
  'regedit':
    '(Opens Registry Editor — used during OOBE to navigate to HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE and set BypassNRO = 1)',
  'shutdown /r /t 0':
    '(Immediate reboot — no delay)',
});

// ─── PROXMOX remaining ────────────────────────
const pve = data.platforms.proxmox.sections;

patchSection(pve['Virtual Machines (qm)'], {
  'qm sendkey 100 ctrl-alt-f1':
    '(Ctrl+Alt+F1 sent to VM 100; Linux guest switches to TTY1)',
  'qm sendkey 100 ret':
    '(Enter key sent to VM console)',
  'qm clone <VMID> <NEW-VMID> --name <NAME>':
    'create linked clone of drive vm-100-disk-0\nLinked clone VM 201 \"web01-dev\" created.',
  'qm set <VMID> --net0 virtio,bridge=vmbr0,tag=10':
    '(VM 100 NIC0 updated to virtio on vmbr0 with VLAN tag 10)',
  'qm set <VMID> --hostpci0 0000:01:00.0,pcie=1':
    '(PCIe device 0000:01:00.0 passed through to VM 100 as hostpci0)',
  'qm importdisk <VMID> /path/to/image.qcow2 <STORAGE>':
    'imported disk as \'DS-FAST:vm-100-disk-1\'\nRun qm set 100 --scsi1 DS-FAST:vm-100-disk-1 to attach it.',
  'qm importovf <NEW-VMID> /path/file.ovf <STORAGE>':
    'Creating VM 201\ncreate disk vm-201-disk-0\nImported OVF VM 201 successfully.',
  'qm snapshot <VMID> <NAME> --description "text" --vmstate 1':
    '(Snapshot pre-upgrade created for VM 100 with RAM state captured)',
  'qm rollback <VMID> <SNAPSHOT>':
    '(VM 100 rolled back to snapshot pre-upgrade; VM was powered off, then restored)',
  'qm delsnapshot <VMID> <SNAPSHOT>':
    '(Snapshot pre-upgrade deleted; space reclaimed on storage)',
  'qm guest exec <VMID> -- <CMD> [ARGS]':
    '{\n  "exitcode": 0,\n  "out-data": "Hello from inside the VM\\n",\n  "err-data": ""\n}',
  'qm guest cmd <VMID> ping':
    '{}',
  'qm guest cmd <VMID> network-get-interfaces':
    '[\n  {"name":"lo","ip-addresses":[{"ip-address":"127.0.0.1","prefix":8}]},\n  {"name":"eth0","ip-addresses":[{"ip-address":"10.0.10.100","prefix":24}],"hardware-address":"aa:bb:cc:dd:ee:01"}\n]',
  'qm monitor <VMID>':
    'Entering QEMU Monitor for VM 100\nWelcome to the QEMU Monitor\nType "help" for a list of commands\n(qemu)',
  'qm terminal <VMID>':
    'starting serial terminal on interface serial0 (type q to exit)',
  'qm vncproxy <VMID>':
    '200 OK\nport: 5900\nticket: abcdef1234567890',
  'qm rescan':
    '(Storages rescanned; any unreferenced disk images added to the disk database)',
  'qm cloudinit dump <VMID> user':
    '#cloud-config\nmanage_etc_hosts: true\nhostname: web01\nfqdn: web01.corp.example.com\nusers:\n  - name: admin\n    groups: sudo\n    shell: /bin/bash\n    ssh_authorized_keys:\n      - ssh-rsa AAAA...',
});

patchSection(pve['LXC Containers (pct)'], {
  'pct create <CTID> <STORAGE>:vztmpl/<TEMPLATE>.tar.zst --hostname <NAME> --memory 1024 --cores 2 --net0 name=eth0,bridge=vmbr0,ip=dhcp':
    'creating rootfs from DS-FAST:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst\nGenerating locales (this might take a while)...\nContainer 203 created.',
  'pct push <CTID> <LOCAL> <CT-PATH>':
    '(File pushed into container filesystem — no output on success)',
  'pct pull <CTID> <CT-PATH> <LOCAL>':
    '(File pulled from container to local host — no output on success)',
  'pct migrate <CTID> <TARGET-NODE> --restart 1':
    'migrating CT 200 to node pve02: 100%\nCT started on pve02.',
  'pct clone <CTID> <NEW-CTID> --hostname <NAME> --full 1':
    'create full clone of subvol-200-disk-0\nFull clone CT 299 \"nginx-proxy-clone\" created.',
  'pct snapshot <CTID> <NAME>':
    '(Snapshot pre-update created for CT 200)',
  'pct rollback <CTID> <SNAPSHOT>':
    '(CT 200 rolled back to snapshot pre-update)',
  'pct destroy <CTID> --purge 1':
    'removing disk image DS-FAST:subvol-200-disk-0...\nCT 200 (nginx-proxy) removed.',
  'pct unlock <CTID>':
    '(Lock cleared from CT 200)',
});

patchSection(pve['Storage (pvesm)'], {
  'pvesm free <STORAGE>:<VOLUME>':
    '(Volume DS-FAST:vm-999-disk-0 freed)',
});

// ─── ARUBA CX remaining ──────────────────────
const acx = data.platforms.aruba_cx.sections;

patchSection(acx['System & Status'], {
  'show events -d ALL -s warning':
    'Jun 12 09:42:15  WARNING  Interface 1/1/12 changed state to down\nJun 12 09:30:12  WARNING  PSU1 input voltage low\nJun 12 08:14:22  WARNING  NTP sync lost — retrying',
  'show clock':
    'Current time: Thu Jun 12 09:42:17 UTC 2026\nTimezone: UTC+0\nNTP: synchronized (10.0.0.51)',
  'show users':
    'Username   Line         Login Time     Location\nadmin      vty0         09:42:15       10.0.0.50 (SSH)',
  'show capacities':
    'Resource               Current  Maximum\nRoutes (IPv4)          61       131072\nMAC addresses          843      131072\nVLANs                  5        4096\nACL entries            42       4096',
  'show capacities-status':
    'Resource               Usage%  Status\nRoutes (IPv4)          0%      OK\nMAC addresses          1%      OK\nVLANs                  0%      OK\nACL entries            1%      OK',
  'show feature':
    'Feature            Status\n-----------------  --------\nstp                enabled\nospf               enabled\nbgp                disabled\nvsx                enabled\nqos                enabled\nlldp               enabled',
});

const ifPatches = {
  'interface 1/1/1\n description ACCESS\n vlan access 10\n no shutdown':
    '(Interface 1/1/1 configured as access port on VLAN 10 with description)',
  'interface 1/1/24\n description TRUNK\n no shutdown\n no routing\n vlan trunk native 99\n vlan trunk allowed 10,20,30':
    '(Interface 1/1/24 configured as trunk: native VLAN 99, allowed VLANs 10,20,30)',
  'interface 1/1/49\n no shutdown\n routing\n ip address 10.0.0.1/31\n mtu 9216':
    '(Interface 1/1/49 configured as L3 /31 link with jumbo frames enabled)',
  'interface lag 1\n no shutdown\n no routing\n vlan trunk allowed 10,20,30\n lacp mode active':
    '(LAG 1 configured as LACP active trunk with VLANs 10,20,30)',
  'interface 1/1/49\n lag 1':
    '(Interface 1/1/49 added to LAG 1)',
};
patchSection(acx['Interfaces'], ifPatches);

patchSection(acx['L3 Routing'], {
  'show bgp ipv4 unicast neighbors':
    'BGP neighbor 1.2.3.4 (AS 65002)\n  State: Established\n  Uptime: 47d 12:30:15\n  Prefixes received: 48\n  Prefixes sent: 5\n  BFD: enabled\n  Hold timer: 90\n  BGP version 4',
  'ip route 0.0.0.0/0 1.1.1.1 distance 1 vrf default':
    '(Static default route via 1.1.1.1 with AD 1 added to VRF default)',
  'router ospf 1\n router-id 1.1.1.1\n area 0.0.0.0\n!\ninterface 1/1/49\n ip ospf 1 area 0.0.0.0':
    '(OSPF process 1 with router-ID 1.1.1.1 configured; interface 1/1/49 added to area 0)',
  'router bgp 65001\n bgp router-id 1.1.1.1\n neighbor 1.2.3.4 remote-as 65002\n address-family ipv4 unicast\n  neighbor 1.2.3.4 activate':
    '(BGP AS 65001 configured; eBGP session to AS 65002 neighbor 1.2.3.4 activated for IPv4)',
});

patchSection(acx['Logging & Telemetry'], {
  'show events':
    'Jun 12 09:42:15  INFO     Interface 1/1/1: link-state up\nJun 12 09:41:22  INFO     OSPF neighbor 10.0.0.2: state changed to Full\nJun 12 09:30:00  INFO     System: config saved by admin from 10.0.0.50',
});

patchSection(acx['Diagnostics'], {
  'mirror session 1\n source interface 1/1/1 both\n destination interface 1/1/47\n no shutdown':
    '(SPAN session 1 created: mirroring interface 1/1/1 bidirectional to 1/1/47)',
});

// ─── Write result ──────────────────────────────
writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('Part 4 done: remaining Windows, Proxmox, Aruba CX gaps filled');
