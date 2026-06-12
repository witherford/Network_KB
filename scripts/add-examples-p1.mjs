#!/usr/bin/env node
// Patch commands.json: add examples for Windows + ESXi platforms, plus new commands
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/commands.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

// Helper: apply example patches to a section array
function patchSection(cmds, patches) {
  for (const cmd of cmds) {
    if (patches[cmd.cmd] !== undefined && (!cmd.example || cmd.example.trim() === '')) {
      cmd.example = patches[cmd.cmd];
    }
  }
}

// Helper: add new commands to a section (avoid duplicates)
function addNewCmds(cmds, newCmds) {
  const existing = new Set(cmds.map(c => c.cmd));
  for (const nc of newCmds) {
    if (!existing.has(nc.cmd)) {
      cmds.push(nc);
    }
  }
}

// ─────────────────────────────────────────────
// WINDOWS
// ─────────────────────────────────────────────
const win = data.platforms.windows.sections;

patchSection(win['System'], {
  'systeminfo':
    'Host Name:                 DESKTOP-8K2L9P\nOS Name:                   Microsoft Windows 11 Pro\nOS Version:                10.0.26100 N/A Build 26100\nSystem Manufacturer:       Dell Inc.\nSystem Model:              OptiPlex 7090\nTotal Physical Memory:     32,768 MB\nAvailable Physical Memory: 18,432 MB\nPage File Space:           38,912 MB',
  'wmic os get caption':
    'Caption\nMicrosoft Windows 11 Pro',
  'wmic cpu get name':
    'Name\nIntel(R) Core(TM) i7-11700 @ 2.50GHz',
  'wmic memorychip get capacity':
    'Capacity\n17179869184\n17179869184',
  'wmic logicaldisk get size':
    'FreeSpace             Size\n47244640256           511068889088',
  'Get-WindowsFeature':
    'Display Name                                            Name                       Install State\n------------                                            ----                       -------------\n[ ] Active Directory Certificate Services               AD-Certificate             Available\n[X] DNS Server                                          DNS                        Installed\n[X] Web Server (IIS)                                    Web-Server                 Installed',
  'Get-ComputerInfo':
    'WindowsBuildLabEx          : 26100.1.amd64fre.ge_release.240331-1435\nWindowsCurrentVersion      : 6.3\nWindowsEditionId           : Professional\nWindowsInstallationType    : Client\nWindowsProductName         : Windows 11 Pro\nCsName                     : DESKTOP-8K2L9P\nCsTotalPhysicalMemory      : 34359738368',
  'Get-EventLog -LogName System -Newest 50':
    'Index Time          EntryType   Source                 EventID Message\n----- ----          ---------   ------                 ------- -------\n 8421 Jun 12 09:41  Information Service Control Manager   7036   The Print Spooler service entered the running state.\n 8420 Jun 12 09:40  Warning     Disk                      153    The IO operation at LBA ... failed.',
  'Get-EventLog -LogName Application -Newest 50':
    'Index Time          EntryType   Source           EventID Message\n----- ----          ---------   ------           ------- -------\n 5218 Jun 12 09:41  Information VSS              8224    The VSS service is shutting down due to idle timeout.\n 5217 Jun 12 09:38  Error       Application Error 1000   Faulting application name: example.exe',
  'Get-EventLog -LogName Security -Newest 50':
    'Index Time          EntryType   Source               EventID Message\n----- ----          ---------   ------               ------- -------\n12345 Jun 12 09:42  SuccessA... Microsoft-Windows-Security-Auditing 4624 An account was successfully logged on.',
  'Get-HotFix | Sort-Object InstalledOn -Descending | Select -First 20':
    'Source        Description      HotFixID   InstalledBy          InstalledOn\n------        -----------      --------   -----------          -----------\nDESKTOP-...   Security Update  KB5055627  NT AUTHORITY\\SYSTEM  6/11/2026 12:00:00 AM\nDESKTOP-...   Update           KB5055523  NT AUTHORITY\\SYSTEM  5/28/2026 12:00:00 AM',
  'Get-WmiObject win32_operatingsystem | Select LastBootUpTime,FreePhysicalMemory,TotalVisibleMemorySize':
    'LastBootUpTime             FreePhysicalMemory TotalVisibleMemorySize\n--------------             ------------------ ----------------------\n20260610143012.500000+060  18677420           33439892',
  '(Get-CimInstance Win32_OperatingSystem).LastBootUpTime':
    'Wednesday, 10 June 2026 14:30:12',
  'winget upgrade --all --include-unknown --accept-source-agreements --accept-package-agreements':
    'Name                                Id                        Version    Available\n----------------------------------------------------------------------\nMicrosoft Visual C++ 2015-2022...   Microsoft.VCRedist.x64.14 14.38.33135 14.40.33816\nGit                                 Git.Git                   2.44.0      2.45.2\n2 upgrades available.',
  'sfc /scannow':
    'Beginning system scan.  This process will take some time.\nBeginning verification phase of system scan.\nVerification 100% complete.\nWindows Resource Protection did not find any integrity violations.',
  'DISM /Online /Cleanup-Image /RestoreHealth':
    'Deployment Image Servicing and Management tool\nVersion: 10.0.26100.1\nImage Version: 10.0.26100.1\n[==========================100.0%==========================]\nThe restore operation completed successfully.',
});

patchSection(win['Networking'], {
  'ipconfig /flushdns':
    'Windows IP Configuration\nSuccessfully flushed the DNS Resolver Cache.',
  'ipconfig /registerdns':
    'Windows IP Configuration\nRegistration of the DNS resource records for all adapters of this computer has been initiated. Any errors will be reported in the Event Viewer in 15 minutes.',
  'netstat -s':
    'IPv4 Statistics\n  Packets Received                   = 3847521\n  Received Header Errors             = 0\n  Discarded Received Packets         = 12\n  Datagrams Successfully Sent        = 3621047\nTCP Statistics for IPv4\n  Active Opens                       = 18431\n  Passive Opens                      = 892\n  Failed Connection Attempts         = 14',
  'netsh interface ipv4 show interfaces':
    'Idx     Met         MTU          State                Name\n---  ----------  ----------  ------------  ---------------------------\n  1          75  4294967295  connected     Loopback Pseudo-Interface 1\n  4          25        1500  connected     Ethernet\n 11          35        1500  disconnected  Wi-Fi',
  'netsh interface ipv6 show interfaces':
    'Idx     Met         MTU          State                Name\n---  ----------  ----------  ------------  ---------------------------\n  1           75  4294967295  connected     Loopback Pseudo-Interface 1\n  4           25        1500  connected     Ethernet',
  'netsh advfirewall firewall show rule name=all':
    'Rule Name:                            File and Printer Sharing (Echo Request)\nEnabled:                              Yes\nDirection:                            In\nProfiles:                             Domain,Private\nGrouping:                             @FirewallAPI.dll,-28502\nLocalIP:                              Any\nRemoteIP:                             Any\nProtocol:                             ICMPv4\nEdge traversal:                       No\nAction:                               Allow',
  'Get-NetAdapter':
    'Name                      InterfaceDescription                    ifIndex Status\n----                      --------------------                    ------- ------\nEthernet                  Intel(R) Ethernet Connection I219-LM    4       Up\nWi-Fi                     Intel(R) Wi-Fi 6E AX210 160MHz          11      Disconnected',
  'Get-NetIPAddress':
    'IPAddress         : 10.0.0.42\nInterfaceIndex    : 4\nInterfaceAlias    : Ethernet\nAddressFamily     : IPv4\nType              : Unicast\nPrefixLength      : 24\nAddressState      : Preferred',
  'Get-NetRoute':
    'ifIndex DestinationPrefix          NextHop       RouteMetric ifMetric PolicyStore\n------- -----------------          -------       ----------- -------- -----------\n      4 0.0.0.0/0                  10.0.0.1      0           25       ActiveStore\n      4 10.0.0.0/24                0.0.0.0       256         25       ActiveStore\n      1 127.0.0.0/8                0.0.0.0       256         75       ActiveStore',
  'Get-DnsClientCache':
    'Entry                  RecordName             RecordType  Status    Section TimeTo Data  Data\n-----                  ----------             ----------  ------    ------- ------ ----  ----\nwindowsupdate.com      windowsupdate.com      A           Success   Answer  300    1     13.107.4.50',
  'Test-NetConnection -Port <port> -ComputerName <host>':
    'ComputerName     : example.com\nRemoteAddress    : 93.184.216.34\nRemotePort       : 443\nInterfaceAlias   : Ethernet\nSourceAddress    : 10.0.0.42\nTcpTestSucceeded : True',
  'Resolve-DnsName <host>':
    'Name                                           Type   TTL   Section    IPAddress\n----                                           ----   ---   -------    ---------\nexample.com                                    A      300   Answer     93.184.216.34',
  'Get-NetTCPConnection':
    'LocalAddress  LocalPort RemoteAddress  RemotePort State        OwningProcess\n12.0.0.1      49152     0.0.0.0        0          Listen       4\n10.0.0.42     50123     52.97.156.130  443        Established  8124',
  'Get-NetTCPConnection -State Listen | Sort-Object LocalPort':
    'LocalAddress  LocalPort RemoteAddress RemotePort State  OwningProcess\n0.0.0.0       135       0.0.0.0       0          Listen 1112\n0.0.0.0       445       0.0.0.0       0          Listen 4\n0.0.0.0       3389      0.0.0.0       0          Listen 1084\n0.0.0.0       5985      0.0.0.0       0          Listen 4',
  'Get-NetTCPConnection -State Established | Group-Object RemoteAddress | Sort-Object Count -Descending | Select -First 20':
    'Count Name                      Group\n----- ----                      -----\n    7 52.97.156.130             {TCP [::]:49234->[::]:443, ...}\n    4 140.82.121.4              {TCP 10.0.0.42:50342->..., ...}\n    3 20.190.190.65             {TCP 10.0.0.42:50410->..., ...}',
  'Get-NetIPConfiguration -Detailed':
    'InterfaceAlias       : Ethernet\nInterfaceIndex       : 4\nInterfaceDescription : Intel(R) Ethernet Connection I219-LM\nNetAdapter           : {Up, Ethernet}\nIPv4Address          : 10.0.0.42\nIPv4DefaultGateway   : 10.0.0.1\nDNSServer            : 10.0.0.1, 1.1.1.1',
  'Get-DnsClientServerAddress -AddressFamily IPv4':
    'InterfaceAlias               Interface Address ServerAddresses\n--------------               --------- ------- ---------------\nEthernet                     4         IPv4    {10.0.0.1, 1.1.1.1}\nLoopback Pseudo-Interface 1  1         IPv4    {}',
  'Test-NetConnection -ComputerName <host> -Port <n> -InformationLevel Detailed':
    'SourceAddress         : 10.0.0.42\nDestinationAddress    : 93.184.216.34\nDestinationPort       : 443\nTcpTestSucceeded      : True\nPingSucceeded         : True\nPingReplyDetails.RoundtripTime : 11 ms',
  'Get-NetRoute -AddressFamily IPv4 | Sort-Object ifMetric,RouteMetric':
    'ifIndex DestinationPrefix   NextHop     RouteMetric ifMetric\n      4 0.0.0.0/0           10.0.0.1    0           25\n      4 10.0.0.0/24         0.0.0.0     256         25\n      1 127.0.0.0/8         0.0.0.0     256         75',
  'Clear-DnsClientCache':
    '(No output on success)',
  'netsh int ip reset':
    'Resetting Interface, OK!\nResetting , failed.\nAccess is denied.\n\nReboot required to complete this action.',
  'pathping -n -q 10 <host>':
    'Tracing route to 93.184.216.34 over a maximum of 30 hops\n  0  10.0.0.42\n  1  10.0.0.1\n  2  1.2.3.4\n\nComputing statistics for 50 seconds...\nHop  RTT    Lost/Sent  Lost/Sent  Address\n  0                              10.0.0.42\n  1    1ms    0/10=0%    0/10=0%  10.0.0.1\n  2   11ms    0/10=0%    0/10=0%  1.2.3.4',
  'Get-NetNeighbor -AddressFamily IPv4 -State Reachable':
    'ifIndex IPAddress       LinkLayerAddress   State     PolicyStore\n------- ---------       ----------------   -----     -----------\n      4 10.0.0.1        00-11-22-33-44-55  Reachable ActiveStore\n      4 10.0.0.10       00-AA-BB-CC-DD-EE  Reachable ActiveStore',
});

patchSection(win['Processes'], {
  'Get-Process | Sort-Object CPU -Descending | Select -First 20':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n   1453      87   624384     511232   1847.47   8124   1  chrome\n    823      45   312456     298765    423.12   4421   1  MsMpEng\n    512      28    88432      94210    210.08   2340   1  powershell',
  'Get-Process | Sort-Object WorkingSet -Descending | Select -First 20':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n   1453      87   624384     511232   1847.47   8124   1  chrome\n    412      32   245678     312433    124.33   5521   1  Teams\n    344      24   198321     244512     98.21   3340   1  Outlook',
  'Stop-Process -Name <name> -Force':
    '(No output on success — process terminated)',
  'Stop-Process -Id <pid> -Force':
    '(No output on success — process with specified PID terminated)',
  'tasklist':
    'Image Name                     PID Session Name        Session#    Mem Usage\n========================= ======== ================ =========== ============\nSystem Idle Process              0 Services                   0         8 K\nSystem                           4 Services                   0     2,100 K\nsmss.exe                       484 Services                   0     1,240 K\ncsrss.exe                      676 Console                    1    10,476 K\nchrome.exe                    8124 Console                    1   511,232 K',
  'tasklist /fi "imagename eq chrome.exe"':
    'Image Name                     PID Session Name        Session#    Mem Usage\n========================= ======== ================ =========== ============\nchrome.exe                    8124 Console                    1   511,232 K\nchrome.exe                    8256 Console                    1    98,432 K',
  'taskkill /IM <name> /F':
    'SUCCESS: The process "notepad.exe" with PID 9421 has been terminated.',
  'taskkill /PID <pid> /F':
    'SUCCESS: The process with PID 9421 has been terminated.',
  'Get-Process | Where-Object {$_.CPU -gt 100}':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n   1453      87   624384     511232   1847.47   8124   1  chrome\n    823      45   312456     298765    423.12   4421   1  MsMpEng',
  'Get-Process | Where-Object {$_.WorkingSet -gt 500MB}':
    'Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName\n-------  ------    -----      -----     ------     --  -- -----------\n   1453      87   624384     511232   1847.47   8124   1  chrome',
  'Get-WmiObject Win32_Process | Select Name,ProcessId,ParentProcessId,CommandLine | Sort-Object Name':
    'Name            ProcessId ParentProcessId CommandLine\n----            --------- --------------- -----------\nchrome.exe          8124            1512  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"\nMsMpEng.exe         4421             848  "C:\\ProgramData\\Microsoft\\Windows Defender\\platform\\...',
  'Get-Service | Where-Object Status -eq Running | Sort-Object DisplayName':
    'Status   Name               DisplayName\n------   ----               -----------\nRunning  AppIDSvc           Application Identity\nRunning  AudioSrv           Windows Audio\nRunning  BFE                Base Filtering Engine\nRunning  BrokerInfrastructure Background Tasks Infrastructure Service',
  'Get-Service | Where-Object Status -eq Stopped | Sort-Object DisplayName':
    'Status   Name               DisplayName\n------   ----               -----------\nStopped  AppMgmt            Application Management\nStopped  CscService         Offline Files\nStopped  Fax                Fax',
  'Start-Service <name>':
    '(No output on success — service started)',
  'Stop-Service <name> -Force':
    '(No output on success — service stopped)',
  'Restart-Service <name>':
    '(No output on success — service restarted)',
  'Set-Service <name> -StartupType Disabled':
    '(No output on success — startup type updated)',
  'sc query type= all':
    'SERVICE_NAME: AJRouter\nDISPLAY_NAME: AllJoyn Router Service\n        TYPE               : 20  WIN32_SHARE_PROCESS\n        STATE              : 1  STOPPED\n        WIN32_EXIT_CODE    : 1077\n        CHECKPOINT         : 0x0\n        WAIT_HINT          : 0x0',
});

patchSection(win['Storage'], {
  'Get-PSDrive -PSProvider FileSystem':
    'Name           Used (GB)     Free (GB) Provider      Root\n----           ---------     --------- --------      ----\nC                 421.87        54.13 FileSystem    C:\\\nD                 200.00       600.00 FileSystem    D:\\\nZ                  12.50       487.50 FileSystem    \\\\server\\share',
  'Get-Volume':
    'DriveLetter  FileSystemLabel  FileSystem  DriveType  HealthStatus  SizeRemaining  Size\n-----------  ---------------  ----------  ---------  ------------  -------------  ----\nC            Windows          NTFS        Fixed      Healthy         54.13 GB     476 GB\nD            Data             NTFS        Fixed      Healthy        600.00 GB     800 GB',
  'Get-Partition':
    'DiskNumber  PartitionNumber  DriveLetter  Offset        Size         Type\n----------  ---------------  -----------  ------        ----         ----\n0           1                             524288        128 MB       Reserved\n0           2                C            135266304     476 GB       Basic\n0           3                             512307126272  780 MB       Recovery',
  'Get-Disk':
    'Number  FriendlyName             PartitionStyle  OperationalStatus  TotalSize\n------  ------------             --------------  -----------------  ---------\n0       Samsung SSD 870 EVO 1TB  MBR             Online             931.51 GB\n1       WD Blue 2TB              GPT             Online             1.82 TB',
  'Get-Volume | Sort-Object SizeRemaining':
    'DriveLetter  FileSystemLabel  FileSystem  HealthStatus  SizeRemaining       Size\n-----------  ---------------  ----------  ------------  -------------       ----\nC            Windows          NTFS        Healthy            4.82 GB       476 GB\nD            Data             NTFS        Healthy           54.20 GB       200 GB',
  'Optimize-Volume -DriveLetter C -Defrag -Verbose':
    'VERBOSE: Starting defragmentation on volume (C:) Windows...\nVERBOSE: The operation completed successfully.\nPost Defragmentation Report:\n  Volume Size                 = 476 GB\n  Cluster Size                = 4 KB\n  Used Space                  = 422 GB\n  Fragmented Space            = 0%',
  'diskpart':
    'Microsoft DiskPart version 10.0.26100.1\nCopyright (C) Microsoft Corporation.\nOn computer: DESKTOP-8K2L9P\nDISKPART>',
  'chkdsk C: /f /r':
    'The type of the file system is NTFS.\nChkdsk cannot run because the volume is in use by another process.\nWould you like to schedule this volume to be checked the next time the system restarts? (Y/N) Y\nThis volume will be checked the next time the system restarts.',
  'fsutil volume diskfree C:':
    'Total # of free bytes        : 58,128,412,672\nTotal # of bytes              : 511,068,889,088\nTotal # of avail free bytes   : 58,128,412,672',
  'Get-PhysicalDisk':
    'FriendlyName             SerialNumber              MediaType   CanPool OperationalStatus HealthStatus  Usage Size\n------------             ------------              ---------   ------- ----------------- ------------  ----- ----\nSamsung SSD 870 EVO 1TB  S59XNX0T804012Z           SSD         False   OK                Healthy       Auto  931.51 GB\nWD Blue 2TB              WD-WX42A93KUVJX           HDD         False   OK                Healthy       Auto    1.82 TB',
  'Get-StoragePool':
    'FriendlyName OperationalStatus  HealthStatus  IsPrimordial IsReadOnly LogicalSectorSize\n------------ -----------------  ------------  ------------ ---------- -----------------\nPrimordial   OK                 Healthy       True         False      512',
  'New-Partition -DiskNumber <n> -UseMaximumSize -AssignDriveLetter':
    'DiskNumber  PartitionNumber  DriveLetter  Offset        Size          Type\n----------  ---------------  -----------  ------        ----          ----\n1           2                E            135266304     1.82 TB       Basic',
  'Format-Volume -DriveLetter D -FileSystem NTFS -NewFileSystemLabel Data -Confirm:$false':
    'DriveLetter  FileSystemLabel  FileSystem  DriveType  HealthStatus  SizeRemaining  Size\n-----------  ---------------  ----------  ---------  ------------  -------------  ----\nD            Data             NTFS        Fixed      Healthy           1.82 TB   1.82 TB',
  'Set-Volume -DriveLetter C -NewFileSystemLabel "System"':
    '(No output on success — volume label updated)',
  'Remove-Partition -DiskNumber <n> -PartitionNumber <n> -Confirm:$false':
    '(No output on success — partition removed. This is irreversible.)',
  'Get-VirtualDisk':
    'FriendlyName OperationalStatus  HealthStatus  IsManualAttach  Size FootprintOnPool StorageLayout\n------------ -----------------  ------------  --------------  ---- --------------- -------------\nDataVol      OK                 Healthy       False         2 TB            2 TB  Simple',
  'Initialize-Disk -Number <n> -PartitionStyle GPT':
    '(No output on success — disk initialised with GPT)',
});

patchSection(win['OOBE & Setup'], {
  'sysprep /oobe /generalize /shutdown':
    'A tool for preparing an installation of Windows for duplication, auditing, and customer delivery.\n\nSysprep is working...',
  'slmgr /dlv':
    'Name: Windows(R) Operating System, VOLUME_KMSCLIENT channel\nDescription: Windows Operating System - Windows(R) 11 Pro\nActivation ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\nApplication ID: 55c92734-d682-4d71-983e-d6ec3f16059f\nLicence Status: Licensed',
  'slmgr /ato':
    'Activating Windows(R) Operating System, VOLUME_KMSCLIENT channel...\nProduct activated successfully.',
  'Get-AppxPackage | Select Name,Version | Sort-Object Name':
    'Name                                  Version\n----                                  -------\nMicrosoft.BingWeather                 4.53.62231.0\nMicrosoft.MicrosoftEdge               44.18362.449.0\nMicrosoft.Windows.Photos              2021.21090.10008.0',
  'Remove-AppxPackage -Package <full-package-name>':
    '(No output on success — appx package removed)',
  'Get-WindowsCapability -Online | Where-Object State -eq "NotPresent"':
    'Name      : Browser.InternetExplorer~~~~0.0.11.0\nState     : NotPresent\n\nName      : Language.Basic~~~en-US~0.0.1.0\nState     : NotPresent',
  'Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0':
    'Path          :\nOnline        : True\nRestartNeeded : False',
});

// Add 2 new Windows commands
addNewCmds(win['System'], [
  {
    cmd: 'Get-MpComputerStatus',
    desc: 'Windows Defender / Microsoft Defender AV status, engine and signature versions',
    type: 'show',
    flagged: false,
    example: 'AMServiceEnabled         : True\nAntispywareEnabled       : True\nAntispywareSignatureLastUpdated : 6/12/2026 6:05:52 AM\nAntispywareSignatureVersion     : 1.413.472.0\nAntivirusEnabled         : True\nAntivirusSignatureLastUpdated   : 6/12/2026 6:05:52 AM\nRealTimeProtectionEnabled: True\nNISEnabled               : True',
  },
]);
addNewCmds(win['Networking'], [
  {
    cmd: 'Get-NetAdapterStatistics | Sort-Object ReceivedBytes -Descending',
    desc: 'Per-adapter transmit/receive byte and packet counters — useful for finding the active interface',
    type: 'show',
    flagged: false,
    example: 'Name       ReceivedUnicastPackets  ReceivedBytes  SentBytes\n----       ----------------------  -------------  ---------\nEthernet            4821034       5832145920  1231453120\nWi-Fi                     0                0           0',
  },
]);

// ─────────────────────────────────────────────
// ESXi
// ─────────────────────────────────────────────
const esxi = data.platforms.esxi.sections;

patchSection(esxi['System'], {
  'esxcli system hostname get':
    '   Domain Name: corp.example.com\n   Fully Qualified Domain Name: esxi01.corp.example.com\n   Host Name: esxi01',
  'esxcli system maintenanceMode get':
    'Enabled: false',
  'esxcli system maintenanceMode set --enable true':
    '(No output; host enters maintenance mode — DRS drains VMs if vCenter-managed)',
  'esxcli system maintenanceMode set --enable false':
    '(No output; maintenance mode cleared)',
  'esxcli system shutdown reboot -r "<reason>"':
    '(Host initiates reboot sequence — ensure all VMs are migrated first)',
  'esxcli system shutdown poweroff -r "<reason>"':
    '(Host initiates power-off sequence)',
  'esxcli system syslog config get':
    '   Default Rotation Size: 1024\n   Default Rotations: 8\n   Default Timeout: 180\n   Log Output: /scratch/log\n   Remote Host: udp://syslog.corp.example.com:514\n   Strict X509 Compliance: false',
  'esxcli system syslog reload':
    '(No output; syslog daemon picks up new configuration)',
  'esxcli system time get':
    '2026-06-12T09:42:17Z',
  'esxcli hardware platform get':
    '   Enclosure Serial Number: CZ2140ABCD\n   IPMI Supported: true\n   OEM String: Dell Inc.\n   Product Name: PowerEdge R740\n   Serial Number: 8ABCD12\n   System BIOS Version: 2.21.0\n   UUID: 4c4c4544-0041-4210-8042-c3c04f443312\n   Vendor Name: Dell Inc.',
  'esxcli hardware cpu list':
    '   CPU:0\n      Address: 0\n      Bus Speed (MHz): 100\n      Core ID: 0\n      CPU ID: 0\n      Family: 6\n      Model: 85\n      Package ID: 0\n      Thread ID: 0\n   CPU:1\n      Core ID: 0\n      CPU ID: 1\n      Thread ID: 1',
  'esxcli hardware memory get':
    '   Physical Memory: 137438953472\n   Reliable Memory: 0\n   NUMA Node Count: 2',
  'esxcli software vib list | grep -iE "driver|firmware"':
    'Name                          Version                           Vendor  Acceptance Level  Install Date\nnmlx5-core                    4.21.71.101-1OEM.800.0.0.20613240  MEL     VMwareCertified   2026-03-10\nnmlx5-rdma                    4.21.71.101-1OEM.800.0.0.20613240  MEL     VMwareCertified   2026-03-10\nntg3                          4.1.459.0-4OEM.800.0.0.20613240    BCM     VMwareCertified   2026-03-10',
  'esxcli system stats uptime get':
    '3627842',
  'vmware -vl':
    'VMware ESXi 8.0.3 build-24859861\nVMware ESXi 8.0.3 Update 3\nVMware ESXi 8.0.3 GA',
});

patchSection(esxi['Networking'], {
  'esxcli network nic get -n <nic>':
    '   Advertised Auto Negotiation: true\n   Advertised Link Modes: Auto, 10baseT/Half, 10baseT/Full, 100baseT/Half, 100baseT/Full, 1000baseT/Full, 2500baseT/Full, 5000baseT/Full, 10000baseT/Full, 25000baseSR/Full\n   Auto Negotiation: true\n   Cable Type: Twisted Pair\n   Current Message Level: 7\n   Driver Info:\n         Bus Info: 0000:01:00.0\n         Driver: nmlx5\n         Firmware Version: 22.38.1002\n         Version: 4.21.71.101\n   Link Speed: 25000 Mbps\n   Link Status: Up\n   MAC Address: 00:50:56:aa:bb:c0\n   MTU: 1500\n   Name: vmnic0',
  'esxcli network ip interface ipv4 get':
    '   Name  IPv4 Address  IPv4 Netmask     IPv4 Broadcast   Address Type  Gateway       DHCP DNS\n   ----  ------------  ---------------  ---------------  ------------  -------       --------\n   vmk0  10.0.10.11    255.255.255.0    10.0.10.255      STATIC        10.0.10.1     false\n   vmk1  10.0.20.11    255.255.255.0    10.0.20.255      STATIC        0.0.0.0       false\n   vmk2  10.0.30.11    255.255.255.0    10.0.30.255      STATIC        0.0.0.0       false',
  'esxcli network ip interface ipv6 get':
    '   Name  IPv6 Address/Prefix Length        Type   Status\n   ----  --------------------------        ----   ------\n   vmk0  fe80::250:56ff:fe6f:1a2b/64       LINKLOCAL   PREFERRED',
  'esxcli network ip route ipv4 list':
    '   Network      Netmask         Gateway     Interface  Source\n   -----------  --------------  ----------  ---------  ------\n   0.0.0.0      0.0.0.0         10.0.10.1   vmk0       MANUAL\n   10.0.10.0    255.255.255.0   0.0.0.0     vmk0       STATIC\n   10.0.20.0    255.255.255.0   0.0.0.0     vmk1       STATIC\n   10.0.30.0    255.255.255.0   0.0.0.0     vmk2       STATIC',
  'esxcli network ip route ipv6 list':
    '   Network                  Prefix Length  Gateway                  Interface\n   -------                  -------------  -------                  ---------\n   fe80::                   64             ::                       vmk0',
  'esxcli network vswitch standard list':
    '   vSwitch0\n      Uplinks: vmnic2, vmnic3\n      Portgroups: Management Network, VM Network\n      MTU: 1500\n      Beacon Probing: false\n      Link Discovery Protocol: CDP (advertise)\n   vSwitch1\n      Uplinks: vmnic0, vmnic1\n      Portgroups: vMotion, iSCSI-A, iSCSI-B\n      MTU: 9000',
  'esxcli network vswitch standard portgroup list':
    '   Name                   Virtual Switch  Active Clients  VLAN ID\n   ---------------------  --------------  --------------  -------\n   Management Network     vSwitch0                     1        0\n   VM Network             vSwitch0                    14        0\n   vMotion                vSwitch1                     1       20\n   iSCSI-A                vSwitch1                     1       30\n   iSCSI-B                vSwitch1                     1       31',
  'esxcli network firewall get':
    '   Default Action: DROP\n   Enabled: true\n   Loaded: true',
  'esxcli network ip connection list':
    '   Proto  Recv Q  Send Q  Local Address          Foreign Address        State         World ID  CC Algo  World Name\n   tcp         0       0  127.0.0.1:443          0.0.0.0:0              LISTEN              1  NewReno  hostd\n   tcp         0       0  0.0.0.0:22             0.0.0.0:0              LISTEN              1  NewReno  sshd\n   tcp         0     196  10.0.10.11:443         10.0.10.5:54821        ESTABLISHED         1  NewReno  hostd',
  'esxcli network ip neighbor list':
    '   Neighbor       MAC Address         Vmknic  Expiry  State  Type\n   10.0.10.1      00:1a:2b:3c:4d:5e   vmk0    1128s   0      Arp\n   10.0.10.5      00:50:56:12:34:56   vmk0     874s   0      Arp',
  'esxcli network firewall ruleset list':
    '   Name                   Enabled\n   --------------------   -------\n   CIMHttpServer          false\n   CIMHttpsServer         false\n   DHCPv6                 true\n   DVFilter               false\n   DNS                    true\n   NFC                    true\n   SSHClient              false\n   SSHServer              true\n   syslog                 true\n   vMotion                true',
  'esxcli network firewall ruleset allowedip list':
    '   Ruleset    Allowed IP Addresses\n   -------    --------------------\n   SSHServer  0.0.0.0/0\n   vMotion    10.0.20.0/24',
  'esxcli network firewall ruleset set --ruleset-id=<id> --enabled=true':
    '(No output on success; ruleset enabled)',
  'esxcli network ip dns server list':
    '   Hostname: esxi01.corp.example.com\n   DNS Server: 10.0.0.53\n   DNS Server: 10.0.0.54',
  'vmkping -I <vmk> <ip>':
    'PING 10.0.30.20 (10.0.30.20): 56 data bytes\n64 bytes from 10.0.30.20: icmp_seq=0 ttl=64 time=0.285 ms\n64 bytes from 10.0.30.20: icmp_seq=1 ttl=64 time=0.271 ms\n--- 10.0.30.20 ping statistics ---\n2 packets transmitted, 2 packets received, 0% packet loss\nround-trip min/avg/max = 0.271/0.278/0.285 ms',
});

patchSection(esxi['Storage'], {
  'esxcli storage filesystem list':
    '   Mount Point                                        Volume Name  UUID                                 Type    Size          Free\n   -------------------------------------------------  -----------  ------------------------------------  ------  ----------    ----------\n   /vmfs/volumes/6421abc1-12345678-abcd-001122334455  DS-FAST      6421abc1-12345678-abcd-001122334455   VMFS-6  4294967296000 1073741824000\n   /vmfs/volumes/6421abc2-87654321-dcba-998877665544  DS-SLOW      6421abc2-87654321-dcba-998877665544   VMFS-6  8589934592000 3221225472000',
  'esxcli storage core device list':
    '   naa.6001405abc123456789abcdef012345\n      Display Name: PURE FlashArray (naa.6001405abc123456789abcdef012345)\n      Size: 4194304 MB\n      Device Type: Direct-Access\n      Multipath Plugin: NMP\n      Devfs Path: /vmfs/devices/disks/naa.6001405abc123456789abcdef012345\n      Vendor: PURE     Model: FlashArray    Revis: 7.12',
  'esxcli storage core device stats get -d <device>':
    '   Device: naa.6001405abc123456789abcdef012345\n   Queue Stats:\n      Latency Stats:\n         Read Max Latency: 485\n         Write Max Latency: 892\n         Read Average Latency: 98\n         Write Average Latency: 143',
  'esxcli storage core path list':
    '   Runtime Name: vmhba1:C0:T0:L0\n   Device: naa.6001405abc123456789abcdef012345\n   Device Display Name: PURE FlashArray ...\n   Path State: Active (I/O)\n   Transport: iscsi\n   Adapter: vmhba1\n   Channel: 0\n   Target: 0\n   LUN: 0\n   State: Active',
  'esxcli storage core path stats get -p <path>':
    '   I/Os Issued: 45821347\n   I/Os Aborted: 0\n   I/Os Reissued: 12\n   I/Os In Flight: 2\n   Total Bytes Transferred: 987654321\n   Path: vmhba1:C0:T0:L0',
  'esxcli storage nfs list':
    '   Host          Share                  Volume Name  Accessible  Mounted  Read-Only\n   10.0.40.100   /exports/iso-lib        ISO-LIB      true        true     false\n   10.0.40.100   /exports/backups        BACKUPS      true        true     false',
  'esxcli storage nfs add -H <host> -s <share> -v <name>':
    '(No output on success; new NFS datastore mounted)',
  'esxcli storage nfs remove -v <name>':
    '(No output on success; NFS datastore removed)',
  'esxcli storage vmfs extent list':
    '   Volume Name  VMFS UUID                             Extent Number  Device Name                                    Partition\n   DS-FAST      6421abc1-12345678-abcd-001122334455  0              naa.6001405abc123456789abcdef012345:3',
  'esxcli storage vmfs snapshot list':
    '   VMFS UUID                             Volume Name  Can Be Resolved\n   6421abc1-12345678-abcd-001122334455  DS-FAST-SNAP true',
  'esxcli storage nmp device list':
    '   naa.6001405abc123456789abcdef012345\n      Device Display Name: PURE FlashArray ...\n      Storage Array Type: VMW_SATP_ALUA\n      Storage Array Type Device Config: {implicit_support=on;explicit_support=off;...}\n      Path Selection Policy: VMW_PSP_RR\n      Path Selection Policy Device Config: {policy=rr;iops=1000;bytes=0;useANO=0;}',
  'esxcli storage nmp path list':
    '   Runtime Name: vmhba1:C0:T0:L0\n      Device: naa.6001405abc123456789abcdef012345\n      Path State: Active (I/O)\n      Path Selection Policy Path Config: {current: yes; weight: 0}\n      Adapter: iSCSI  Target: iqn.2024-01.com.purestorage:flasharray01\n      LUN: 0',
  'esxcli storage core device vaai status get':
    '   Device: naa.6001405abc123456789abcdef012345\n   ATS Status: supported\n   Clone Status: supported\n   Delete Status: supported\n   Thin Provisioning Status: notSupported',
  'esxcli storage core adapter rescan --all':
    '(No output; all HBAs rescanned for new LUNs/paths)',
});

patchSection(esxi['VM Management'], {
  'esxcli vm process list':
    '   web01\n      World ID: 18432\n      Process ID: 0\n      VMX Cartel ID: 18432\n      UUID: 56 4d ab 12 34 56 78 9a-bc de f0 12 34 56 78 9a\n      Display Name: web01\n      Config File: /vmfs/volumes/DS-FAST/web01/web01.vmx\n   db01\n      World ID: 18441\n      Display Name: db01',
  'esxcli vm process kill --type=soft --world-id=<id>':
    '(Sends ACPI shutdown to guest — guest OS begins clean shutdown)',
  'esxcli vm process kill --type=hard --world-id=<id>':
    '(Sends hard reset to VM — immediate, no guest OS notification)',
  'esxcli vm process kill --type=force --world-id=<id>':
    '(Force-terminates the vmx process — last resort; risk of disk corruption)',
  'esxcli hardware cpu global get':
    '   CPU Hyperthreading: true\n   CPU Packages: 2\n   CPU Cores: 32\n   CPU Threads: 64\n   CPU Hyperthreading Active: true',
  'esxcli hardware memory get':
    '   Physical Memory: 137438953472\n   Reliable Memory: 0\n   NUMA Node Count: 2',
  'esxcli hardware pci list':
    '   0000:01:00.0\n      Address: 0000:01:00.0\n      Segment: 0x0000\n      Bus: 0x01\n      Slot: 0x00\n      Function: 0x0\n      VMkernel Name: vmnic0\n      Vendor Name: Mellanox Technologies\n      Device Name: MT28800 Family [ConnectX-5 Ex]\n      SubVendor Name: Mellanox Technologies\n      Device Class Name: Ethernet controller\n      Hardware Id: 0x101d15b3\n      Sub ID: 0x000015b3\n      Dynamic Driver: true',
  'esxcli hardware clock get':
    '   Day: 12\n   Hour: 9\n   Minute: 42\n   Month: 6\n   Second: 17\n   Year: 2026',
  'esxcli hardware clock set -d <day> -H <hour>':
    '(Hardware RTC updated; software clock may differ if NTP is running)',
  'esxcli hardware ipmi sel get':
    '   Record ID  Record Type  Timestamp  Sensor Type  Sensor Name       Event Dir  Event Data 1  Event Data 2  Event Data 3  Event Desc\n   0x0001     0x02         1749...    System Event System ACPI Power S0 Assertion  0x00  0x00  0x00  Working\n   0x0002     0x02         1748...    Fan          Fan 1             Assertion  0x01  0x00  0x00  Lower Critical',
  'vim-cmd vmsvc/power.getstate <vmid>':
    'Retrieved runtime info\nPowered on',
  'vim-cmd vmsvc/power.on <vmid>':
    'Powering on VM:\n',
  'vim-cmd vmsvc/power.shutdown <vmid>':
    'Initiating guest OS shutdown\n',
  'vim-cmd vmsvc/power.off <vmid>':
    'Powering off VM:\n',
  'vim-cmd vmsvc/snapshot.get <vmid>':
    '--Snapshot List--\n   |-ROOT\n   |-Snapshot Name        : Pre-Update-20260601\n    |-Snapshot Id         : 1\n    |-Snapshot Desciption :\n    |-Snapshot Created On : 6/1/2026 02:00:01\n    |-Snapshot State      : powered on',
  'vim-cmd vmsvc/snapshot.removeall <vmid>':
    '(Removes all snapshot delta disks and re-commits to base; may take several minutes)',
  'vim-cmd vmsvc/reload <vmid>':
    '(VM config reloaded from disk — no restart of guest OS)',
});

patchSection(esxi['Diagnostics'], {
  'esxcli system syslog mark':
    '(Inserts a timestamp marker line into the syslog for event correlation)',
  'esxcli system stats installtime get':
    '2025-09-14T10:32:00Z',
  'esxcli system stats uptime get':
    '3627842',
  'esxcli system stats load get':
    '   1-minute load average: 0.56\n   5-minute load average: 0.71\n   15-minute load average: 0.62',
  'esxcli network diag ping -I <vmk> -H <host>':
    '   Sequence Payload Size  Tx   Rx Errors\n   -------- ------------  --   -- ------\n          0           56   1   1      0\n          1           56   1   1      0\n   Results: Duplicates: 0, % Loss: 0\n   Round trip min/avg/max = 0/0/1 ms',
  'esxcli network diag traceroute -H <host>':
    'traceroute to 10.0.10.1, 30 hops max, 56 byte packets\n1  10.0.10.1 (10.0.10.1)  0.421 ms  0.389 ms  0.401 ms',
  'esxcli network diag netstack list':
    '   Key             Enabled  In Use\n   defaultTcpipStack  true     true\n   vmotion            true     true\n   vSAN               false    false\n   defaultTcpipStack6 true     true',
  'esxcli network diag netstack get -N <stack>':
    '   Name: defaultTcpipStack\n   Description: Default TCP/IP network stack\n   DNS Suffix: corp.example.com\n   Hostname: esxi01\n   Maximum Number Of Connections: 1024\n   Default Gateway: 10.0.10.1\n   Ipv6 Enabled: true\n   Swap Gateway: false',
  'esxcli software vib list':
    'Name                                    Version                            Vendor  Acceptance Level  Install Date\nesx-base                                8.0.3-24859861                    VMware  VMwareCertified   2026-03-10\nesx-ui                                  2.6.0-24099555                    VMware  VMwareCertified   2026-03-10\nnmlx5-core                              4.21.71.101-1OEM...               MEL     VMwareCertified   2026-03-10',
  'esxcli software sources vib list -d <url>':
    'Name                                    Version                            Vendor  Acceptance Level\nesx-base                                8.0.3-24985984                    VMware  VMwareCertified\nesx-ui                                  2.7.0-25003123                    VMware  VMwareCertified',
  'tail -f /var/log/vmkernel.log':
    '2026-06-12T09:42:01.812Z cpu12:2098576)Fil3: 4633: Failed to open volume \'DS-SLOW\': Busy\n2026-06-12T09:42:12.003Z cpu4:2098123)ScsiDeviceIO: 2728: Cmd(0x459...): ...',
  'tail -f /var/log/hostd.log':
    '2026-06-12T09:42:00.123Z info hostd[2098577] [Originator@6876 sub=Default] AdapterServer: Client closed connection\n2026-06-12T09:42:10.456Z info hostd[2098577] [Originator@6876 sub=Vimsvc.TaskManager] Task Created',
  'tail -f /var/log/vpxa.log':
    '2026-06-12T09:42:00.321Z info vpxa[2106789] [Originator@6876 sub=Default] Received HA heartbeat from vCenter\n2026-06-12T09:42:15.654Z info vpxa[2106789] [Originator@6876 sub=ha-eventmgr] DRS: migration recommendation accepted',
  'esxcli system coredump partition get':
    '   Active: true\n   Configured: true\n   Dump Partition: mpx.vmhba0:C0:T0:L0:11',
  'esxcli system coredump file get':
    '   Configured: false\n   Active: false\n   Path:',
  'esxtop -b -n 5 -d 2 | gzip > /tmp/esxtop.csv.gz':
    '(Captures 5 iterations at 2-second intervals into compressed CSV for offline analysis)',
  'vm-support -w /vmfs/volumes/<ds>':
    'Running command: vm-support\nGenerating ESXi support bundle...\nBundle file: /vmfs/volumes/DS-FAST/esx-esxi01-2026-06-12--09.42.tgz',
});

// Add 2 new ESXi commands
addNewCmds(esxi['Networking'], [
  {
    cmd: 'esxcli network vswitch dvs vmware list',
    desc: 'List Distributed Virtual Switches (DVS) and their uplinks configured on this host',
    type: 'show',
    flagged: false,
    example: '   VDS ID                                    VDS Name          Config Version  Num Ports  Used Ports  Configured Ports  MTU   Uplinks\n   50 31 ab cd ef 01 23 45-67 89 ab cd ef 01 23 45  DSwitch           15              1024       24          512               9000  vmnic0, vmnic1',
  },
]);
addNewCmds(esxi['System'], [
  {
    cmd: 'esxcfg-nics -l',
    desc: 'Legacy command: list physical NICs with speed, duplex, driver and PCI slot — still useful on older ESXi versions',
    type: 'show',
    flagged: false,
    example: 'Name    PCI          Driver      Link Speed      Duplex MAC Address       MTU    Description\nvmnic0  0000:01:00.0 nmlx5       Up   25000Mbps  Full   00:50:56:aa:bb:c0 1500   Mellanox ConnectX-4 Lx\nvmnic1  0000:01:00.1 nmlx5       Up   25000Mbps  Full   00:50:56:aa:bb:c1 1500   Mellanox ConnectX-4 Lx',
  },
]);

// ─────────────────────────────────────────────
// Write result
// ─────────────────────────────────────────────
writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('Part 1 done: Windows + ESXi patched');
