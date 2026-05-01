// Cisco IOS enrichment batch 1 (Stage 3) — small/medium sections.
//   NAT, EEM/Automation, DHCP/Services, NTP/SNMP/Logging, Multicast,
//   Management, Config Management, Troubleshooting, Diagnostics.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const IOS  = data.platforms.ciscoios;

const ENTRIES = [
  // ============== NAT ==============
  { cmd: 'show ip nat statistics',
    example: `R1# show ip nat statistics

Total active translations: 142 (5 static, 137 dynamic; 137 extended)
Outside interfaces: GigabitEthernet0/0
Inside interfaces:  GigabitEthernet0/1, GigabitEthernet0/2
Hits: 245019  Misses: 12
Expired translations: 4502
Dynamic mappings:
  -- Inside Source
  access-list 1 interface GigabitEthernet0/0 refcount 137

What it means:
- "static" : 1:1 translations (e.g. external-IP → internal-server).
- "dynamic" / "extended" : NAT entries created on the fly per
  (src-IP, src-port, proto) tuple — typical PAT/overload behaviour.
- Hits / Misses : translations that matched vs ones that didn't —
  Misses > 0 usually = traffic outside the NAT ACL.
- "refcount" on the dynamic mapping = active sessions using that
  pool entry; helps spot stuck translations.` },

  { cmd: 'clear ip nat translation *',
    example: `R1# clear ip nat translation *

R1# show ip nat translations | count any
0

What it means:
- Wipes EVERY active translation. Existing flows reset (TCP RST or
  silent timeout for UDP).
- Use during emergency cleanup or after reconfiguring the inside-
  source pool.
- Surgical alternative: "clear ip nat translation inside <local-ip>
  <global-ip>" for one entry only.` },

  { cmd: 'ip nat inside source list 1 interface Gi0/0/1 overload',
    example: `R1(config)# access-list 1 permit 10.0.0.0 0.255.255.255
R1(config)# ip nat inside source list 1 interface GigabitEthernet0/0/1 overload

R1# show ip nat translations | head
Pro Inside global         Inside local          Outside local         Outside global
tcp 198.51.100.10:54321   10.0.1.5:54321        93.184.216.34:443     93.184.216.34:443
tcp 198.51.100.10:54322   10.0.1.7:54322        93.184.216.34:443     93.184.216.34:443

What it means:
- Classic PAT: every inside host sharing the egress-interface IP
  (here Gi0/0/1's address) for outbound traffic.
- "overload" enables port-multiplexing — many internal hosts share
  one external IP.
- ACL 1 controls which sources are eligible. "inside" interfaces
  must also be marked with "ip nat inside" and the egress with
  "ip nat outside".` },

  { cmd: 'ip nat inside source static 10.0.0.10 198.51.100.10',
    example: `R1(config)# ip nat inside source static 10.0.0.10 198.51.100.10

R1# show ip nat translations
Pro Inside global   Inside local    Outside local   Outside global
--- 198.51.100.10   10.0.0.10       ---             ---

What it means:
- 1:1 static mapping: traffic destined to 198.51.100.10 from outside
  is forwarded to internal 10.0.0.10. Outbound from 10.0.0.10
  reverses to 198.51.100.10.
- Use for inbound services (web servers, mail relays) that need
  a stable public IP.
- Add "extendable" + "no-alias" for advanced VRF / multihoming
  scenarios.` },

  // ============== EEM / Automation ==============
  { cmd: 'show event manager policy registered',
    example: `R1# show event manager policy registered

No.  Type    Event Type      Trap  Time Registered           Name
1    applet  syslog          Off   Wed May  1 09:00:00 2026  LOG-LINK-DOWN
                              pattern {%LINK-3-UPDOWN}
                              action 1.0 syslog msg "Link state changed"
2    applet  timer cron      Off   Wed May  1 09:00:00 2026  AUTO-SAVE
                              cron entry: "0 4 * * *"
                              action 1.0 cli command "enable"
                              action 2.0 cli command "write memory"

What it means:
- All registered EEM applets and policies. Each applet has an event
  trigger (syslog pattern, timer cron, snmp trap, etc.) and a list
  of numbered actions executed when fired.
- "Trap Off" = applet does not also fire an SNMP trap on activation.
- Useful pre-flight check before relying on automation in production.` },

  { cmd: 'show event manager statistics',
    example: `R1# show event manager statistics

Event Manager Policy Statistics:
event server status     : Active
queue size              : 64
matched events          : 124
running policies        : 0
processed policies      : 124
queued events           : 0

Per-policy:
LOG-LINK-DOWN  matched 23  ran 23  errors 0  avg-time 12 ms
AUTO-SAVE      matched 7   ran 7   errors 0  avg-time 240 ms

What it means:
- Per-applet match / run counters with average runtime and error
  count.
- "errors > 0" warrants drilling into "show event manager history
  events" for the failure detail.
- "queued events" should normally be 0 — sustained > 0 means EEM
  can't keep up with event rate.` },

  { cmd: 'event manager applet LOG-LINK-DOWN\n event syslog pattern "%LINK-3-UPDOWN"\n action 1.0 syslog msg "Link state changed"',
    example: `R1(config)# event manager applet LOG-LINK-DOWN
R1(config-applet)# event syslog pattern "%LINK-3-UPDOWN"
R1(config-applet)# action 1.0 syslog msg "Link state changed"

# When an interface flaps:
%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down
%HA_EM-6-LOG: LOG-LINK-DOWN: Link state changed

What it means:
- Triggers when ANY syslog message matches the pattern
  "%LINK-3-UPDOWN" (the canonical interface-state-change message).
- Action 1.0 emits a follow-on syslog with the custom text — useful
  for operational dashboards keying off a specific phrase.
- Pattern is regex; escape % literally with %%. Common variations:
  "%LINK-3-UPDOWN.*GigabitEthernet0/0" to scope to one port.` },

  { cmd: 'event manager applet AUTO-SAVE\n event timer cron name daily cron-entry "0 4 * * *"\n action 1.0 cli command "enable"\n action 2.0 cli command "write memory"',
    example: `R1(config)# event manager applet AUTO-SAVE
R1(config-applet)# event timer cron name daily cron-entry "0 4 * * *"
R1(config-applet)# action 1.0 cli command "enable"
R1(config-applet)# action 2.0 cli command "write memory"

# Every day at 04:00 router-local time:
%HA_EM-6-LOG: AUTO-SAVE: action 2.0 wrote running-config to NVRAM

What it means:
- cron-entry "0 4 * * *" : minute=0 hour=4 = every day at 04:00
  router local time.
- Sequential CLI actions — applet enters enable mode, then runs
  "write memory" to persist running config to NVRAM.
- Common pattern: backup to network filesystem nightly, or
  alert-on-CPU + capture diagnostics.` },

  // ============== DHCP / Services ==============
  { cmd: 'show ip dhcp server statistics',
    example: `R1# show ip dhcp server statistics

Memory usage         8456
Address pools        2
Database agents      0
Automatic bindings   142
Manual bindings      5
Expired bindings     12
Malformed messages   0

Message              Received  Sent
DHCPDISCOVER         5430      0
DHCPREQUEST          14523     0
DHCPDECLINE          1         0
DHCPRELEASE          421       0
DHCPINFORM           120       0
DHCPOFFER            0         5430
DHCPACK              0         14523
DHCPNAK              0         3

What it means:
- Per-message counters since last "clear ip dhcp" or boot.
- DHCPNAK > 0 = clients trying to renew with a wrong IP (typically
  after a subnet renumber or VRF change).
- DHCPDECLINE > 0 = clients claim the offered IP is in use
  (duplicate IP somewhere on the subnet).
- "Malformed messages" should always be 0; spikes hint at attack
  or buggy DHCP client.` },

  { cmd: 'show ip dhcp pool',
    example: `R1# show ip dhcp pool

Pool DATA :
 Utilization mark (high/low)    : 100 / 0
 Subnet size (first/next)       : 0 / 0
 Total addresses                : 254
 Leased addresses               : 142
 Pending event                  : none
 1 subnet is currently in the pool :
 Current index        IP address range                    Leased addresses
 10.0.0.143           10.0.0.1   - 10.0.0.254              142

What it means:
- "Total addresses" : usable host addresses minus excluded ranges.
- "Leased addresses" : currently in use. Compare against total to
  watch for pool exhaustion.
- "Utilization mark high 100" : fire syslog at 100% utilisation.
  Lower (e.g. 80) for proactive warning.` },

  { cmd: 'ip dhcp pool DATA\n network 10.0.0.0 255.255.255.0\n default-router 10.0.0.1\n dns-server 8.8.8.8',
    example: `R1(config)# ip dhcp pool DATA
R1(dhcp-config)# network 10.0.0.0 255.255.255.0
R1(dhcp-config)# default-router 10.0.0.1
R1(dhcp-config)# dns-server 8.8.8.8 1.1.1.1
R1(dhcp-config)# domain-name corp.local
R1(dhcp-config)# lease 7

What it means:
- Defines a DHCP scope on the router itself (no external server).
- network : the subnet handed out (host mask = address range).
- default-router : option 3 (gateway) sent to clients.
- dns-server : option 6, can list multiple resolvers.
- "lease 7" = 7-day lease (default 1 day). Add hh and mm parameters
  for finer control: "lease 1 12 0" = 1 day 12 hours.` },

  { cmd: 'ip dhcp excluded-address 10.0.0.1 10.0.0.10',
    example: `R1(config)# ip dhcp excluded-address 10.0.0.1 10.0.0.10
R1(config)# ip dhcp excluded-address 10.0.0.250 10.0.0.254

R1# show ip dhcp pool DATA
 Total addresses             : 239    ← was 254, now 254 - 15 excluded

What it means:
- Reserves IPs for static use (gateways, printers, switches) so
  DHCP doesn't hand them out.
- Specify a single IP or a range (start end).
- Excludes apply BEFORE the pool's network statement is parsed —
  reservations stick across reboots.` },

  { cmd: 'ip helper-address 10.99.0.10',
    example: `R1(config)# interface vlan 10
R1(config-if)# ip helper-address 10.99.0.10
R1(config-if)# ip helper-address 10.99.0.11

# Client on VLAN 10 broadcasts DHCPDISCOVER:
%DHCP-6-RELAY: relayed DHCPDISCOVER from 10.10.0.5 to 10.99.0.10

What it means:
- Converts client broadcast DHCP/BOOTP into unicast packets aimed
  at the named server(s) — required when DHCP server is in a
  different subnet from the clients.
- Multiple helper-address commands send to multiple servers (most
  enterprises configure 2 for HA).
- Also relays other UDP-broadcast services (TFTP, NetBIOS, TACACS)
  unless explicitly disabled with "no ip forward-protocol udp".` },

  { cmd: 'ip dhcp pool <name>',
    example: `R1(config)# ip dhcp pool VOICE
R1(dhcp-config)# network 10.20.0.0 255.255.255.0
R1(dhcp-config)# default-router 10.20.0.1
R1(dhcp-config)# option 150 ip 10.50.50.50

What it means:
- Generic syntax for creating a pool. Pool names are local-only
  (not advertised to clients).
- Multiple pools can coexist; the router picks the matching pool
  based on the relayed/giaddr subnet.
- Common pools: DATA / VOICE / GUEST with different option-150
  TFTP servers per scope.` },

  { cmd: 'network <ip> <mask>',
    example: `R1(dhcp-config)# network 10.0.0.0 255.255.255.0

# All IPs from 10.0.0.1 to 10.0.0.254 (minus any excluded ranges)
# are now leasable.

What it means:
- Defines the subnet for this DHCP pool.
- Can also use "/24" CIDR shorthand: "network 10.0.0.0 /24".
- Use a /22 etc. for super-pools that span multiple VLANs (rare).` },

  { cmd: 'default-router <ip>',
    example: `R1(dhcp-config)# default-router 10.0.0.1

# Clients receive DHCP option 3 = 10.0.0.1, set as their default
# gateway.

What it means:
- Sets DHCP option 3 (router). Multiple gateways can be listed —
  clients use the first reachable.
- Most clients ignore secondary gateways unless configured to
  rotate; primarily a backup.` },

  { cmd: 'dns-server <ip1> <ip2>',
    example: `R1(dhcp-config)# dns-server 8.8.8.8 1.1.1.1

# Clients receive DHCP option 6 = 8.8.8.8, 1.1.1.1.

What it means:
- Sets DHCP option 6 (DNS). Up to 8 DNS servers can be listed,
  but most clients only use the first 2.
- Pair with "domain-name corp.local" to set the search suffix
  (option 15).` },

  { cmd: 'lease <days> <hours> <mins>',
    example: `R1(dhcp-config)# lease 7 0 0    ! 7 days
R1(dhcp-config)# lease infinite ! reservation-style permanent

What it means:
- Lease duration in days/hours/minutes. Default is 1 day.
- "infinite" = permanent lease (won't expire). Use cautiously —
  consumes pool addresses forever.
- Short leases (1-4 hours) for guest networks; long leases
  (1-7 days) for internal corporate.` },

  { cmd: 'ip dhcp excluded-address <start> <end>',
    example: `R1(config)# ip dhcp excluded-address 10.0.0.1 10.0.0.10
R1(config)# ip dhcp excluded-address 10.0.0.250 10.0.0.254

What it means:
- Excludes a contiguous range. Single-IP form: "ip dhcp
  excluded-address 10.0.0.5".
- Apply BEFORE creating the pool — exclusions existing first
  prevent any race where DHCP hands out a reserved IP momentarily.` },

  { cmd: 'show ip dhcp conflict',
    example: `R1# show ip dhcp conflict

IP address     Detection method   Detection time
10.0.0.5       Ping               Wed May  1 09:00:00
10.0.0.42      Gratuitous ARP     Wed May  1 09:14:22

What it means:
- IPs the DHCP server tried to lease but found in use (replied to
  ping or gratuitous ARP).
- These IPs are removed from the pool until you clear them via
  "clear ip dhcp conflict *".
- Spikes = a static device sneaked into the dynamic pool range —
  add it to "ip dhcp excluded-address".` },

  { cmd: 'clear ip dhcp binding *',
    example: `R1# clear ip dhcp binding *

R1# show ip dhcp binding
Bindings from all pools not associated with VRF:
IP address          Client-ID/Hardware address    Lease expiration
(none)

What it means:
- Wipes ALL active DHCP bindings. Clients lose their leases and
  must re-DHCP on next renewal.
- Disruptive — only run during planned maintenance.
- Surgical version: "clear ip dhcp binding <ip>" for one entry.` },

  // ============== NTP / SNMP / Logging ==============
  { cmd: 'show ntp associations',
    example: `R1# show ntp associations

  address         ref clock       st   when   poll   reach   delay   offset    disp
*~129.6.15.28     .GPS.            1     12     64    377    24.521   0.142    0.221
+~10.10.10.50     129.6.15.28      2     45    128    377     1.214  -0.014    0.012
 ~10.10.10.51     129.6.15.28      2    102    128    377     1.198   0.018    0.014

* sys.peer, # selected, + candidate, - outlyer, x falseticker, . pps.peer

What it means:
- "*" = the currently-selected sync peer (sys.peer).
- "st" = stratum. 1 = directly synced to a reference clock (atomic,
  GPS); 2-15 = downstream peers.
- "reach" = octal bit-mask of last 8 polls (377 = all 8 successful).
- "delay/offset/disp" = round-trip in ms / phase offset in ms /
  dispersion (clock uncertainty).` },

  { cmd: 'show snmp',
    example: `R1# show snmp

Chassis: FCW2245A0AB
Contact: noc@corp.local
Location: London-Rack-04
0 SNMP packets input
    0 Bad SNMP version errors
    0 Unknown community name
    0 Illegal operation for community name supplied
    0 Encoding errors
    0 Number of requested variables
    0 Number of altered variables
    0 Get-request PDUs
    0 Get-next PDUs
    0 Set-request PDUs

SNMP logging: enabled
    Logging to 10.50.50.50.162, 0/10, 0 sent, 0 dropped.

What it means:
- SNMP packet stats since boot. "0 sent" means no SNMP poller
  has hit this device — verify the manager is configured.
- "Bad community" / "Illegal operation" > 0 = unauthorised SNMP
  attempts; tighten ACL or use SNMPv3.
- "Logging to <host>:162" : trap destination + delivery success.` },

  { cmd: 'show snmp engineID',
    example: `R1# show snmp engineID

Local SNMP engineID: 80000009030000C0FFEE1234
Remote Engine ID                 IP-addr      Port
80000009030000DEADBEEF5678       10.50.50.50  162

What it means:
- The engineID uniquely identifies an SNMPv3 entity. Local engineID
  is generated from the chassis serial number on first boot.
- Remote engineIDs are required for SNMPv3 authPriv trap delivery —
  without them traps fail with "engineID not found".
- Use "snmp-server engineID remote <ip> <hex-id>" to add a new
  remote entry.` },

  { cmd: 'ntp server 10.10.10.10 prefer',
    example: `R1(config)# ntp server 10.10.10.10 prefer
R1(config)# ntp server 10.10.10.11
R1(config)# ntp server time.nist.gov

R1# show ntp associations
 address         ref clock         st   when   poll   reach
*~10.10.10.10    .GPS.              1     12     64    377   ← prefer
 ~10.10.10.11    .GPS.              1     34     64    377
 ~129.6.15.28    .GPS.              1     45    128    377

What it means:
- "prefer" : NTP leans toward this peer when multiple have similar
  quality. Doesn't override stratum-based selection; just breaks ties.
- Configure 3+ peers for fault-tolerance (NTP needs ≥4 to detect
  a falseticker mathematically).
- ASN.1 dotted-quad = IP; FQDN works too (resolved via DNS at
  config time).` },

  { cmd: 'ntp authenticate\nntp authentication-key 1 md5 <key>\nntp trusted-key 1',
    example: `R1(config)# ntp authenticate
R1(config)# ntp authentication-key 1 md5 SHARED-NTP-SECRET
R1(config)# ntp trusted-key 1
R1(config)# ntp server 10.10.10.10 key 1

R1# show ntp associations detail | include auth
synchronized authenticated

What it means:
- 3-step authentication: enable auth subsystem, define a key,
  trust it, then bind it to the peer with "key N".
- MD5 is legacy; modern IOS XE supports SHA-1 / SHA-256 too.
- Both ends must share the same key value AND key ID.
- "authenticated" in show output confirms successful keyed sync.` },

  { cmd: 'snmp-server community READONLY RO',
    example: `R1(config)# snmp-server community READONLY RO 50
R1(config)# access-list 50 permit host 10.50.50.50

# Manager can now poll:
$ snmpwalk -v 2c -c READONLY 10.10.10.10 sysUpTime
SNMPv2-MIB::sysUpTime.0 = Timeticks: (12345678) 1 day, 10:17:36.78

What it means:
- "RO" = read-only access. Pair with ACL 50 to restrict source IPs.
- Communities are sent in cleartext — use SNMPv3 for any production
  network. v2c communities still common in lab / legacy environments.
- "RW" exists but should rarely be used; if needed, restrict tightly.` },

  { cmd: 'snmp-server group V3GROUP v3 priv read V3VIEW write V3VIEW\nsnmp-server view V3VIEW iso included\nsnmp-server user admin V3GROUP v3 auth sha <auth> priv aes 128 <priv>',
    example: `R1(config)# snmp-server view V3VIEW iso included
R1(config)# snmp-server group V3GROUP v3 priv read V3VIEW write V3VIEW
R1(config)# snmp-server user admin V3GROUP v3 auth sha AuthSecret2026 priv aes 128 PrivSecret2026

# Manager can now poll with auth + privacy:
$ snmpwalk -v 3 -l authPriv -u admin -a SHA -A AuthSecret2026 \\
       -x AES -X PrivSecret2026 10.10.10.10 sysUpTime

What it means:
- Full SNMPv3 stack: view (what OIDs are visible) → group (access
  rights) → user (credentials).
- "v3 priv" = authPriv (auth + encryption). Other levels: noAuthNoPriv,
  authNoPriv.
- SHA + AES-128 = modern minimum; older boxes may default to MD5+DES.
  Use SHA-256 + AES-256 where the IOS version supports it.` },

  { cmd: 'logging host 10.50.50.50 transport tcp port 1514',
    example: `R1(config)# logging host 10.50.50.50 transport tcp port 1514
R1(config)# logging trap informational
R1(config)# logging origin-id hostname

R1# show logging | include host
   Logging to 10.50.50.50 on TCP port 1514, transport: tcp,
   facility: local7, severity: informational

What it means:
- TCP transport (not the default UDP/514) gives reliable delivery
  to syslog-NG / Splunk. Loss-less but adds back-pressure if the
  collector is down.
- "trap informational" : send severity 6 and below (info, notice,
  warning, error, critical, alert, emergency).
- "origin-id hostname" : prefix every message with the router
  hostname — vital when multiple devices ship to one collector.` },

  { cmd: 'logging buffered 65536 informational',
    example: `R1(config)# logging buffered 65536 informational

R1# show logging | include Buffer
Buffer logging: level informational, 65536 bytes
                 0 messages logged, xml disabled, filtering disabled

What it means:
- Stores up to 65536 bytes of log messages in a ring buffer in
  RAM. Read with "show logging".
- Severity threshold "informational" = info(6) + notice(5) +
  warning(4) + ... + emergency(0).
- Buffer survives until reload — useful for post-mortem when no
  external syslog is available.` },

  { cmd: 'ntp server ip-address [prefer] [source interface-id]',
    example: `R1(config)# ntp server 10.10.10.10 prefer source loopback0

R1# show ntp associations | include 10.10.10.10
*~10.10.10.10    .GPS.    1   12   64   377  24.521  0.142  0.221

What it means:
- "source loopback0" forces NTP packets to use loopback as the
  source IP — symmetric reachability and cleaner ACLs on the
  upstream peer.
- "prefer" tilts the selection algorithm toward this peer.
- Both flags optional; minimum form is "ntp server <ip>".` },

  { cmd: 'ntp master stratum-number',
    example: `R1(config)# ntp master 5

R1# show ntp status
Clock is unsynchronized, stratum 16  ← (was)
... after 5 minutes ...
Clock is synchronized, stratum 5     ← internal master clock

What it means:
- Makes the router its own NTP master at the named stratum (here
  5). Useful in lab / isolated networks with no external time source.
- Stratum 1 is reserved for atomic-clock-backed sources; do NOT use
  "ntp master 1" in production — confuses upstream peers.
- Combine with "ntp server <internet-ntp>" so the local master falls
  back to internet sync when reachable.` },

  { cmd: 'ntp peer ip-address',
    example: `R1(config)# ntp peer 10.10.10.11

R1# show ntp associations | include 10.10.10.11
+~10.10.10.11    LOCL    8    23   64   377  1.214  -0.014  0.012

What it means:
- Symmetric peering between two NTP nodes — each sees the other
  as a possible time source.
- Use between two router redundant pair members so they remain
  time-aligned even if external sources fail.
- Asymmetric "ntp server" is more common; use "peer" only when
  both sides should learn from each other.` },

  { cmd: 'tracking',
    example: `R1(config)# track 1 ip route 10.99.0.0 255.255.255.0 reachability
R1(config-track)# delay down 10 up 5

R1# show track 1
Track 1
  IP route 10.99.0.0 255.255.255.0 reachability
  Reachability is Up
  3 changes, last change 02:14:21

What it means:
- "track" objects monitor the state of an interface, route, IP SLA,
  or list — used by HSRP, route preference, EEM and others.
- "delay down 10 up 5" : flap-suppression. Wait 10 sec before
  reporting Down; 5 sec before reporting Up.
- Pair with "standby track" or "ip route ... track" for failover
  triggers based on object state.` },

  { cmd: 'ntp master',
    example: `R1(config)# ntp master   ! defaults to stratum 8

R1# show ntp status | include stratum
Clock is synchronized, stratum 8

What it means:
- Stratum-8 internal master clock — the highest stratum that's
  generally usable. Other peers will accept this router as a
  fallback time source.
- Same as "ntp master 8" with the stratum value omitted.` },

  { cmd: 'ntp server <ip>',
    example: `R1(config)# ntp server 10.10.10.10

R1# show ntp associations | include 10.10.10.10
 ~10.10.10.10    .GPS.    1    12   64   377  24.521  0.142  0.221

What it means:
- Minimum syntax for adding an NTP source. Defaults: poll-interval
  64 sec, no auth, source IP per egress route.
- Sync state visible via "show ntp status" (synced / unsynced) once
  reach reaches non-zero (initial probes succeed).` },

  { cmd: 'ntp server <ip> prefer',
    example: `R1(config)# ntp server 10.10.10.10 prefer
R1(config)# ntp server 10.10.10.11

R1# show ntp associations
*~10.10.10.10    .GPS.    1   ...   ← preferred when quality is similar
 ~10.10.10.11    .GPS.    1   ...

What it means:
- "prefer" is a tie-breaker in the NTP selection algorithm — only
  applied when multiple peers have roughly equivalent quality.
- Doesn't force selection; if the preferred peer becomes unstable,
  selection falls back to another candidate.` },

  { cmd: 'ntp authenticate',
    example: `R1(config)# ntp authenticate

R1# show running-config | include ntp authenticate
ntp authenticate

What it means:
- Enables the authentication subsystem. Required before any
  "ntp authentication-key" / "ntp trusted-key" can take effect.
- Once enabled, peers WITHOUT a key bound are still accepted UNLESS
  you also use "no ntp server <ip>" + re-add with "key N".` },

  { cmd: 'ntp authentication-key <id> md5 <key>',
    example: `R1(config)# ntp authentication-key 1 md5 SharedNtpSecret2026

What it means:
- Defines key #1 with MD5 digest. ID is referenced when binding to
  peers ("ntp server X.X.X.X key 1").
- Multiple keys can coexist (different IDs) for graceful rotation.
- Modern alternative: "ntp authentication-key 1 sha1 <key>" or
  "sha2-256" on supported platforms.` },

  { cmd: 'ntp trusted-key <id>',
    example: `R1(config)# ntp trusted-key 1

What it means:
- Marks key 1 as trusted for INBOUND auth — packets signed with
  this key will be accepted from peers.
- Required step in the auth chain: define key → trust it → bind
  to peer.
- Can list multiple trusted keys, e.g. during a rotation overlap
  period.` },

  { cmd: 'ntp source <interface>',
    example: `R1(config)# ntp source loopback0

R1# debug ntp packets
NTP: src 10.99.0.10 (loopback0) → dst 10.10.10.10 (NTP server)
NTP: rcv from 10.10.10.10 to 10.99.0.10 (loopback0)

What it means:
- Forces the source IP on outbound NTP packets to the named
  interface (typically the loopback).
- Cleaner upstream ACL — peers ACL just one /32 instead of every
  potential egress IP.
- Without this, source defaults to whichever interface routing
  picks for the destination.` },

  { cmd: 'clock timezone GMT 0',
    example: `R1(config)# clock timezone GMT 0
R1(config)# clock summer-time BST recurring last Sun Mar 1:00 last Sun Oct 2:00

R1# show clock
*11:22:18.123 GMT Wed May 1 2026

What it means:
- Sets the displayed timezone offset from UTC. Internal time is
  always UTC; display only is affected.
- "summer-time recurring" : automatic DST. Format: <abbr> recurring
  <start-week> <start-dow> <start-month> <start-time> <end-...>.
- Without this, timestamps display as UTC ("UTC").` },

  { cmd: 'clock set <hh:mm:ss> <day> <month> <year>',
    example: `R1# clock set 11:22:00 1 May 2026

R1# show clock
11:22:01.123 GMT Wed May 1 2026

What it means:
- Manually sets system time (privileged exec, NOT config mode).
- Useful as a fallback when NTP isn't available — gets the clock
  approximately correct so syslog timestamps make sense.
- NTP overrides this once sync is established.` },

  // ============== Multicast ==============
  { cmd: 'show ip mroute',
    example: `R1# show ip mroute

IP Multicast Routing Table
Flags: D - Dense, S - Sparse, B - Bidir Group, s - SSM Group,
       C - Connected, L - Local, P - Pruned, R - RP-bit set,
       F - Register flag, T - SPT-bit set, J - Join SPT

(*, 239.1.1.1), 00:14:23/00:02:50, RP 10.0.0.1, flags: SC
  Incoming interface: GigabitEthernet0/0, RPF nbr 10.10.10.1
  Outgoing interface list:
    GigabitEthernet0/1, Forward/Sparse, 00:14:23/00:02:50

(10.99.0.5, 239.1.1.1), 00:00:14/00:02:46, flags: T
  Incoming interface: GigabitEthernet0/0, RPF nbr 10.10.10.1
  Outgoing interface list:
    GigabitEthernet0/1, Forward/Sparse, 00:00:14/00:02:46

What it means:
- (*, G) entries : shared tree rooted at the RP.
- (S, G) entries : source-specific shortest-path tree (SPT).
- "Incoming interface" : RPF interface — must point upstream
  toward the source/RP, otherwise packets are dropped.
- "Outgoing interface list" (OIL) : where the multicast is being
  replicated to.
- T flag = SPT switchover happened (came off the shared tree).` },

  { cmd: 'show ip mroute summary',
    example: `R1# show ip mroute summary

IP Multicast Routing Table
Total: 2 (*,G), 5 (S,G)
        2 entries with hardware-switched data
        5 entries with software-switched data
Total bandwidth: 142 Mbps
Average pps: 4502

What it means:
- High-level multicast summary — total mroute entries, bandwidth,
  packet rate.
- "hardware-switched" entries are forwarded by ASIC (line-rate);
  "software-switched" go through the CPU (limited rate).
- Spike in software-switched count often means TCAM exhaustion
  or unsupported (S, G) features.` },

  { cmd: 'show ip pim interface',
    example: `R1# show ip pim interface

Interface          Address       Mode       Nbr Count   Hello Intvl
GigabitEthernet0/0 10.10.10.1    Sparse     2           30
GigabitEthernet0/1 10.20.0.1     Sparse     0           30
Loopback0          1.1.1.1       Sparse     0           30

What it means:
- All PIM-enabled interfaces with their PIM mode and neighbour
  counts.
- "Mode Sparse" : PIM-SM (most common). Other modes: Dense, SSM,
  Bidir.
- "Nbr Count 0" on a transit interface = no PIM neighbour formed —
  check pim configuration on the peer.
- "Hello Intvl 30" : PIM hellos every 30 sec (default). Lower for
  faster failure detection; higher to reduce control-plane load.` },

  { cmd: 'show ip pim rp',
    example: `R1# show ip pim rp

Group: 239.1.1.1, RP: 10.0.0.1, v2, uptime 02:14:21, expires 00:02:42
Group: 239.1.2.0/24, RP: 10.0.0.2, via Auto-RP, v2

What it means:
- Per-group → RP mapping. v2 = PIM version (current standard).
- Three discovery mechanisms:
  - Static : "ip pim rp-address <ip>" on every router.
  - Auto-RP : Cisco-proprietary multicast announcements.
  - BSR : standards-based (RFC 5059).
- "expires" : countdown to next refresh; non-static methods
  re-learn periodically.` },

  { cmd: 'show ip igmp groups',
    example: `R1# show ip igmp groups

IGMP Connected Group Membership
Group Address    Interface          Uptime    Expires    Last Reporter
239.1.1.1        GigabitEthernet0/1 02:14:23  00:02:32   10.20.0.50
224.0.0.13       GigabitEthernet0/0 1d12h     00:02:14   10.10.10.50
224.0.0.5        GigabitEthernet0/0 1d12h     never      10.10.10.1 (local)

What it means:
- Per-segment list of multicast groups with active receivers.
- "Last Reporter" : the most recent host to send an IGMP report
  for this group on this interface.
- 224.0.0.x are link-local (OSPF, RIP, etc.) — never forwarded
  off-segment.
- "Expires never" = group is locally generated (router itself).` },

  { cmd: 'show ip igmp snooping',
    example: `R1# show ip igmp snooping

Global IGMP Snooping configuration:
-------------------------------------------
IGMP snooping              : Enabled
IGMPv3 snooping            : Enabled
Report suppression         : Enabled
TCN solicit query          : Disabled
TCN flood query count      : 2
Robustness variable        : 2

Vlan 10:
--------
IGMP snooping              : Enabled
Multicast querier          : Enabled
Querier address            : 10.10.0.1
IGMP groups learned        : 12

What it means:
- IGMP snooping prunes multicast on L2 ports — only ports with
  active receivers get the traffic, instead of broadcast-flooding.
- "Multicast querier" : a switch acts as the elected IGMP querier
  on a VLAN that has no router.
- "Report suppression" : sends only one IGMP report per group per
  segment, reducing IGMP traffic on busy LANs.` },

  { cmd: 'ip multicast-routing distributed',
    example: `R1(config)# ip multicast-routing distributed

R1# show ip mroute | head -3
IP Multicast Routing Table
Flags: D - Dense, S - Sparse, B - Bidir Group, s - SSM Group, ...

What it means:
- Globally enables IP multicast routing. Required before any PIM
  or IGMP config takes effect.
- "distributed" enables hardware acceleration on platforms that
  support it (most modern Cisco gear).
- After enabling, configure each interface with "ip pim sparse-mode"
  (or other mode).` },

  { cmd: 'ip pim sparse-mode',
    example: `R1(config)# interface gigabitethernet 0/0
R1(config-if)# ip pim sparse-mode

R1# show ip pim interface gigabitethernet0/0
GigabitEthernet0/0  Address: 10.10.10.1  Mode: Sparse
                    DR: 10.10.10.50  Hello: 30 sec  Holdtime: 105 sec

What it means:
- Enables PIM-SM (Sparse Mode) on the interface — most common
  multicast deployment.
- Requires an RP for (*,G) state until SPT switchover happens.
- "DR" = Designated Router on the segment (handles forwarding
  decisions for source-side traffic).` },

  { cmd: 'ip pim rp-address 10.0.0.1',
    example: `R1(config)# ip pim rp-address 10.0.0.1

R1# show ip pim rp | include 10.0.0.1
Group: 224.0.0.0/4 → RP: 10.0.0.1 (static)

What it means:
- Statically configures the RP for ALL multicast groups (224/4).
- Simplest RP discovery mechanism — works in small networks where
  every router can be configured manually.
- For larger networks, use Auto-RP or BSR for automatic discovery.
- Add "override" to override Auto-RP / BSR with the static config.` },

  { cmd: 'ip pim sparse-mode | ip pim dense-mode | ip pim bidirectional-mode | ip pim ssm',
    example: `# Sparse Mode (most common):
R1(config-if)# ip pim sparse-mode

# Dense Mode (legacy, flood-and-prune):
R1(config-if)# ip pim dense-mode

# Bidirectional (one tree per group, no SPT):
R1(config-if)# ip pim bidir-enable
R1(config)# ip pim rp-address 10.0.0.1 bidir

# Source-Specific Multicast (SSM, no RP needed):
R1(config)# ip pim ssm range 232.0.0.0/8

What it means:
- Sparse-mode : pull model — only forwards to receivers that joined.
- Dense-mode : push model — flood then prune. Deprecated, scales poorly.
- Bidir : single tree per group with no SPT. Good for many-to-many
  apps (financial trading).
- SSM : channel-based (S, G) only. No RP needed; client must
  specify both source and group (IGMPv3 / SSM-aware app).` },

  { cmd: 'ip igmp version {2 | 3}',
    example: `R1(config)# interface gigabitethernet 0/1
R1(config-if)# ip igmp version 3

R1# show ip igmp interface gigabitethernet 0/1 | include version
  IGMP version is 3

What it means:
- v2 (default on most Cisco) : group-based — receiver joins a group.
- v3 : channel-based — receiver joins (S, G) pairs (required for SSM).
- All hosts on a segment must speak the same version; the lowest
  version wins (a single v2 host forces the segment to v2).` },

  { cmd: 'ip mroute multicast-address interface-id',
    example: `R1(config)# ip mroute 239.1.1.1 interface gigabitethernet 0/0

R1# show ip mroute 239.1.1.1 | include incoming
  Incoming interface: GigabitEthernet0/0  ← static override

What it means:
- Static mroute — overrides the unicast RIB for the named multicast
  group.
- Used to fix RPF (Reverse Path Forwarding) check failures when
  unicast and multicast topologies diverge (asymmetric routing,
  MPLS-VPN scenarios).
- Without one, RPF uses the unicast RIB, which is usually fine.` },

  { cmd: 'ip rpf-check interface-id',
    example: `R1(config)# interface gigabitethernet 0/0
R1(config-if)# ip multicast rpf-check ingress

R1# debug ip mpacket
*Apr 1 12:00:01: IP-MPACKET: rcvd Gi0/0 src=10.99.0.5 dst=239.1.1.1 - RPF check passed

What it means:
- RPF check : verifies that incoming multicast came from the
  expected upstream interface. Mismatched packets are dropped.
- Drops show in "show ip mroute count" → "RPF failures".
- Common cause of RPF failures: asymmetric routing or static
  mroute / unicast routing inconsistency.` },

  { cmd: 'ip pim rp-address rp-address [group-list]',
    example: `R1(config)# access-list 10 permit 239.1.1.0 0.0.0.255
R1(config)# ip pim rp-address 10.0.0.1 10

# Now RP 10.0.0.1 only handles groups in 239.1.1.0/24:
R1# show ip pim rp | head -3
Group: 239.1.1.5  RP: 10.0.0.1 (group-list 10)

What it means:
- "group-list" restricts the RP to specific multicast group ranges.
- Allows different RPs to serve different sets of groups — useful
  for tenant isolation or load distribution.
- Without group-list, the RP serves ALL groups (224/4).` },

  { cmd: 'ip pim bsr-candidate router-id',
    example: `R1(config)# ip pim bsr-candidate Loopback0 30

R1# show ip pim bsr-router
PIMv2 Bootstrap Router (BSR)
   This system is the Bootstrap Router (BSR)
   BSR address: 1.1.1.1 (?)
   Uptime: 02:14:23, BSR Priority: 30, Hash mask length: 0

What it means:
- Configures this router as a BSR (Bootstrap Router) candidate.
- BSR collects RP-set advertisements from candidate-RPs and
  floods the consolidated RP→Group mapping to all PIM routers.
- "30" = priority (higher wins among candidates). Hash mask length
  controls RP load distribution.
- Standards-based (RFC 5059); preferred over Cisco's Auto-RP.` },

  { cmd: 'ip pim candidate-rp group-list rp-address',
    example: `R1(config)# access-list 20 permit 239.1.0.0 0.0.255.255
R1(config)# ip pim rp-candidate Loopback0 group-list 20 priority 10

R1# show ip pim rp | include candidate
1.1.1.1 (this router) is a candidate RP for groups 239.1.0.0/16, priority 10

What it means:
- Advertises this router as a candidate RP via BSR.
- BSR collects candidate-RP advertisements and decides which
  candidate handles which group range.
- Lower priority wins (range 0-255). Same-priority candidates
  use a hash to split groups.` },

  { cmd: 'show ip mroute multicast-address',
    example: `R1# show ip mroute 239.1.1.1

(*, 239.1.1.1), 00:14:23/00:02:50, RP 10.0.0.1, flags: SC
  Incoming interface: GigabitEthernet0/0, RPF nbr 10.10.10.1
  Outgoing interface list:
    GigabitEthernet0/1, Forward/Sparse, 00:14:23/00:02:50

(10.99.0.5, 239.1.1.1), 00:00:14/00:02:46, flags: T
  Incoming interface: GigabitEthernet0/0, RPF nbr 10.10.10.1
  Outgoing interface list:
    GigabitEthernet0/1, Forward/Sparse, 00:00:14/00:02:46

What it means:
- Filtered mroute view — only the (*, G) and (S, G) entries for
  one specific group.
- Use during incident response: "is traffic for 239.1.1.1 actually
  flowing through this router?"
- T flag in (S, G) = SPT switchover; receiver is now on the
  shortest path tree (no longer via the RP).` },

  // ============== Management ==============
  { cmd: 'show running-config | section <keyword>',
    example: `R1# show running-config | section interface GigabitEthernet0/1
interface GigabitEthernet0/1
 description WAN-uplink
 ip address 198.51.100.5 255.255.255.252
 ip ospf network point-to-point
 ip ospf cost 100
 no shutdown

What it means:
- "section" filters running-config to lines matching the keyword
  PLUS their indented sub-lines (the entire config block).
- More useful than "include" when looking at structured config
  (interfaces, BGP neighbors, route-maps).
- Standard pipe filter; works after any "show" command.` },

  { cmd: 'show running-config interface <int>',
    example: `R1# show running-config interface gi0/1

interface GigabitEthernet0/1
 description WAN-uplink
 ip address 198.51.100.5 255.255.255.252
 ip ospf network point-to-point
 ip ospf cost 100
 no shutdown

What it means:
- Direct shortcut to one interface's config block — equivalent to
  "show running-config | section gi0/1" but cleaner output.
- Works for any interface type (subif, port-channel, vlan, etc.).` },

  { cmd: 'show archive',
    example: `R1# show archive

The maximum archive configurations allowed is 14.
The next archive file will be named flash:archive-15
Archive #  Name
   1       flash:archive-1
   2       flash:archive-2
   ...
  14       flash:archive-14   (Most recent)

What it means:
- Lists currently stored config archives. The "archive" feature
  saves running-config to a file every time you "write memory" or
  on a timer.
- Use to roll back a bad config: "configure replace flash:archive-13".
- "maximum 14" = ring buffer; oldest archive is overwritten when
  the 15th is created.` },

  { cmd: 'archive config',
    example: `R1# archive config

Archiving configuration ...
Archive saved as flash:archive-15

What it means:
- Manually triggers an archive save. Bypasses the timer (if any)
  and the "write-memory" trigger.
- Useful before a risky change — guarantees a known-good rollback
  point.` },

  { cmd: 'configure replace flash:<file> force',
    example: `R1# configure replace flash:archive-13 force

The new running config has been replaced with flash:archive-13.
Run "show running-config" to verify.

What it means:
- Atomically replaces the entire running-config with the contents
  of an archive file.
- "force" skips the confirmation prompt — useful in automation but
  dangerous interactively.
- Compare with "copy flash:archive-13 running-config" which MERGES
  rather than replaces.
- The atomic replace is the safer rollback mechanism.` },

  { cmd: 'show ssh',
    example: `R1# show ssh

Connection Version Mode Encryption       Hmac          State                 Username
0          2.0     IN   aes256-ctr        hmac-sha2-256 Session started       admin
0          2.0     OUT  aes256-ctr        hmac-sha2-256 Session started       admin

%No SSHv1 server connections running.

What it means:
- Active SSH sessions with cipher / HMAC negotiation results.
- Per-direction (IN / OUT) entries — both must show the same
  session.
- "No SSHv1" = legacy protocol disabled (good — SSHv1 is broken).
- Confirm strong ciphers (aes256-ctr, chacha20-poly1305) and
  modern HMACs (sha2-256, sha2-512).` },

  // ============== Config Management ==============
  { cmd: 'copy running-config tftp://10.50.50.50/<host>.cfg',
    example: `R1# copy running-config tftp://10.50.50.50/R1-router.cfg

Address or name of remote host [10.50.50.50]?
Destination filename [R1-router.cfg]?
!!!! [OK - 24521 bytes]

24521 bytes copied in 1.234 secs (19872 bytes/sec)

What it means:
- Backs up running-config to a TFTP server. UDP/69 traffic, no
  authentication — TFTP server should be on a trusted segment.
- Filename embedded in URL keeps the upload deterministic.
- Compare with "scp" form (encrypted, authenticated):
    copy running-config scp://user@10.50.50.50/R1-router.cfg` },

  { cmd: 'archive\n path flash:archive-\n maximum 14\n write-memory\n time-period 1440',
    example: `R1(config)# archive
R1(config-archive)# path flash:archive-
R1(config-archive)# maximum 14
R1(config-archive)# write-memory
R1(config-archive)# time-period 1440

R1# show archive
The maximum archive configurations allowed is 14.
Archive #  Name
   1       flash:archive-1
   ...

What it means:
- Enables config archiving with a ring of 14 files.
- "path flash:archive-" : files named archive-1 ... archive-14 in
  flash.
- "write-memory" : also archive every time someone runs
  "write memory" (capture explicit save events).
- "time-period 1440" : take a snapshot every 1440 minutes (24h).
- Combine with "configure replace flash:archive-N force" for
  rollbacks.` },

  { cmd: 'configure replace flash:archive-1',
    example: `R1# configure replace flash:archive-1

This will apply all necessary additions and deletions to replace
the current running configuration with the contents of the
specified configuration file. Proceed? [y/n] y

Total number of passes: 1
Rollback Done

R1# show running-config | head -3
! ROLLBACK
! Last configuration change at 09:00:00 GMT Wed May 1 2026

What it means:
- Atomically rolls running-config back to a saved archive.
- Without "force", prompts for confirmation.
- Computes a diff and applies the minimum changes needed —
  efficient on large configs.` },

  { cmd: 'reload in 5',
    example: `R1# reload in 5

Reload scheduled for 11:27:18 GMT Wed May 1 2026 (in 5 minutes) by admin
Reload reason: scheduled maintenance

R1# show reload
Reload scheduled in 4 minutes and 48 seconds by admin

What it means:
- Schedules a reload N minutes in the future. Common safety net
  for remote changes — if a config breaks management access, the
  device reboots back to startup-config.
- Cancel before the timer fires with "reload cancel".
- After successful changes, run "reload cancel" + "write memory".` },

  { cmd: 'reload cancel',
    example: `R1# reload cancel

%STORE-5-RELOAD_CANCELLED: Reload cancelled

R1# show reload
No reload is scheduled.

What it means:
- Cancels a previously-scheduled reload.
- Always runs after successful change verification when using
  "reload in N" as a safety net.
- Privileged exec command (not config mode).` },

  { cmd: 'write erase',
    example: `R1# write erase

Erasing the nvram filesystem will remove all configuration files!
Continue? [confirm]
[OK]
Erase of nvram: complete

R1# reload
Proceed with reload? [confirm]

What it means:
- Wipes startup-config from NVRAM. Running-config is unaffected.
- Pair with "reload" for a factory-default boot.
- DESTRUCTIVE — only run when intentionally rebuilding the device.` },

  { cmd: 'reload',
    example: `R1# reload

Save the running config? [yes/no]: yes
Building configuration...
[OK]
Proceed with reload? [confirm]

%SYS-5-RELOAD: Reload requested by admin. Reload Reason: Reload Command.

What it means:
- Reboots the router. Prompts to save running-config first.
- After "yes" + confirm, the box reloads and reads startup-config
  on boot.
- Disruptive — connections drop until reload completes (typically
  3-10 minutes for IOS XE).` },

  { cmd: 'reload in <minutes>',
    example: `R1# reload in 30

Reload scheduled for 12:00:00 GMT Wed May 1 2026 (in 30 minutes) by admin

What it means:
- Same as "reload in 5" but with custom minutes value.
- Common values: 5 (quick safety net), 30 (allow time for testing),
  60 (overnight maintenance window).
- Beyond 60 min, prefer "reload at HH:MM" for absolute time.` },

  { cmd: 'copy running-config tftp:',
    example: `R1# copy running-config tftp:

Address or name of remote host []? 10.50.50.50
Destination filename [r1-confg]? R1-2026-05-01.cfg
!!!! [OK - 24521 bytes]

24521 bytes copied in 1.234 secs

What it means:
- Interactive form — prompts for TFTP server IP and filename.
- More common in scripted environments to use the URL form
  (specifies destination inline).` },

  { cmd: 'copy tftp: running-config',
    example: `R1# copy tftp: running-config

Address or name of remote host []? 10.50.50.50
Source filename []? R1-restore.cfg
Destination filename [running-config]?
!!!! [OK - 24521 bytes]

%System running config is being modified...

What it means:
- MERGES the named TFTP file into running-config (does NOT replace).
- Useful for adding chunks of config (e.g. a new VLAN block or
  ACL).
- For full replacement, use "configure replace" (atomic).` },

  { cmd: 'archive log config',
    example: `R1(config)# archive
R1(config-archive)# log config
R1(config-archive-log-cfg)# logging enable
R1(config-archive-log-cfg)# logging size 200
R1(config-archive-log-cfg)# notify syslog

R1# show archive log config all
idx  sess           user@line       Logged command
1    1   admin@vty0  | hostname R1
2    1   admin@vty0  | interface gi0/0
3    1   admin@vty0  | ip address 10.10.10.1 255.255.255.0

What it means:
- Records every config-mode command in a per-session log.
- "size 200" : keep last 200 entries.
- "notify syslog" : also fire a syslog message for each command —
  useful for SIEM ingestion.
- Forensic audit trail of who changed what when.` },

  { cmd: 'show archive log config all',
    example: `R1# show archive log config all

idx  sess  user@line     Logged command
1    1    admin@vty0    | enable
2    1    admin@vty0    | configure terminal
3    1    admin@vty0    | interface gi0/1
4    1    admin@vty0    | ip address 10.20.0.1 255.255.255.0
5    1    admin@vty0    | no shutdown
6    1    admin@vty0    | end
7    1    admin@vty0    | write memory

What it means:
- Full chronological log of all config-mode commands across all
  user sessions.
- "sess" groups commands within a single config session — can
  reconstruct exactly what one operator did from start to finish.
- Combine with "show clock" + admin notebook for change-management
  audit.` },

  // ============== Troubleshooting ==============
  { cmd: 'show processes cpu sorted',
    example: `R1# show processes cpu sorted

CPU utilization for five seconds: 23%/8%; one minute: 14%; five minutes: 12%
 PID Runtime(ms)   Invoked     uSecs  5Sec  1Min  5Min TTY Process
 142     12345     45012        274   12%   8%    7%   0   IP Input
 245      4521     12003        376    5%   3%    3%   0   BGP Router
   1      1234      4012        307    3%   1%    1%   0   Init

What it means:
- Top-line: total CPU "X%/Y%" — X = total, Y = interrupt CPU. Y near
  X means the CPU is spending most cycles in fast-path forwarding,
  not control-plane work.
- "5Sec" = process CPU over last 5 seconds.
- Sustained per-process CPU > 50% on a single process = a problem
  with that subsystem.` },

  { cmd: 'show processes cpu history',
    example: `R1# show processes cpu history

R1            12:00:00 PM Wednesday May 01 2026
   100
    90
    80                                              *
    70                                            * * *
    60                                          * * * * *
    50  *  *  *  *  *  *  *  *  *  *  *  *    * * * * * *
    10
       0    5    10   15   20   25   30   35   40   45   50   55   60
                       CPU% per second (last 60 seconds)

What it means:
- ASCII art of CPU% over time — 60-sec, 1-hour, and 72-hour windows.
- Visual spike spotting: CPU jumped 50→90% during the recent attack.
- Useful for capacity-planning conversations with management — print
  this to PDF for change reviews.` },

  { cmd: 'show memory statistics',
    example: `R1# show memory statistics

                Head     Total(b)     Used(b)     Free(b)   Lowest(b)   Largest(b)
Processor   2A4B1234   1073741824   245678901   828062923   745678901   123456789
   I/O      2A5B5678    536870912    98765432   438105480    98765432    98765432

What it means:
- Memory pool stats. "Free" = currently available. "Lowest" =
  lowest-ever free since boot (water-mark).
- "Largest" = biggest contiguous free block. If "Free" is high but
  "Largest" is low, memory is fragmented.
- Sustained low Lowest watermark = approaching exhaustion; investigate
  with "show processes memory sorted".` },

  { cmd: 'show platform hardware fed switch active qos queue stats interface <int>',
    example: `Switch# show platform hardware fed switch active qos queue stats interface gi1/0/1

Interface: gi1/0/1
DBL: Disabled  Trust DSCP: True
Queue Buffers Bandwidth Threshold Drops    Enqueue
  0      30%      30%       80%   12       45,012
  1      20%      20%       80%   0        12,003
  2      30%      30%       80%   0        45,021
  3      20%      20%       80%   0        2,103

What it means:
- Per-interface egress queue stats on Catalyst hardware.
- "Drops" : packets that overran the queue threshold and got
  tail-dropped. Should be 0 for priority queues.
- "Enqueue" : total packets that entered each queue.
- Use to verify QoS marking is hitting the right hardware queue.` },

  { cmd: 'show logging | include <keyword>',
    example: `R1# show logging | include LINK

%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down
%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up
%LINK-5-CHANGED: Interface GigabitEthernet0/2, changed state to administratively down

What it means:
- Filters log buffer to lines containing the keyword.
- Common patterns:
    | include LINK         — interface state changes
    | include OSPF|BGP     — routing protocol events
    | include %.*-3-       — severity 3 (errors) only
- Pipe is case-sensitive; use "|i" alias for case-insensitive
  in some IOS XE versions.` },

  { cmd: 'monitor session 1 source interface <int> both\n monitor session 1 destination interface <int>',
    example: `R1(config)# monitor session 1 source interface gi1/0/1 both
R1(config)# monitor session 1 destination interface gi1/0/24

R1# show monitor session 1
Session 1
---------
Type                : Local Session
Source Ports        :
    Both           : Gi1/0/1
Destination Ports   : Gi1/0/24
    Encapsulation  : Native
          Ingress  : Disabled

What it means:
- SPAN (Switched Port Analyzer) — copies traffic from source ports
  to a destination port for packet-capture analysis.
- "both" : capture ingress + egress. Other options: rx, tx.
- Destination port must be unused; receives traffic only (no
  return traffic possible).
- Plug a packet-capture tool (Wireshark / tcpdump) into the
  destination port.` },

  { cmd: 'debug platform packet-capture monitor capture CAP interface <int> both',
    example: `R1# monitor capture CAP interface gi1/0/1 both match any buffer size 10
R1# monitor capture CAP start
R1# monitor capture CAP stop
R1# show monitor capture CAP buffer

Buffer Size: 10 MB, Capture: Stopped
Packets captured: 4,502
Packets dropped: 0

# Detailed packet view:
R1# show monitor capture CAP buffer detailed | head -20

What it means:
- "monitor capture" is the modern Embedded Packet Capture (EPC).
  Captures packets to a memory buffer or file without external
  packet-capture appliance.
- "match any" : capture everything. Use ACL filtering for targeted
  captures: "match access-list 100".
- Export to .pcap with "monitor capture CAP export flash:cap.pcap".` },

  { cmd: 'test crypto isakmp <peer>',
    example: `R1# test crypto isakmp 198.51.100.50

Test crypto isakmp:
   ISAKMP SA negotiation initiated to peer 198.51.100.50
   ISAKMP SA established. Encryption: AES-256, Hash: SHA-256

What it means:
- Triggers an immediate ISAKMP/IKE Phase 1 negotiation with a peer
  WITHOUT waiting for interesting traffic to fire it.
- Useful for VPN troubleshooting — confirms ISAKMP can complete
  before debugging Phase 2 / IPsec SA.
- Failure messages point at config mismatches: pre-shared key,
  proposals, NAT-T issues.` },

  { cmd: 'show tech-support | redirect flash:tac.txt',
    example: `R1# show tech-support | redirect flash:tac.txt

# Wait several minutes ...
R1# dir flash: | include tac
   24  -rw-       4256321  May  1 2026 11:22:18 +00:00  tac.txt

What it means:
- Bundles the output of dozens of show commands into a single text
  file on flash — Cisco TAC asks for this on every case.
- "| redirect" sends output to file instead of console (avoids
  paging through 50 MB of output interactively).
- After collection, scp / ftp the file to the TAC case.` },

  { cmd: 'show version | include uptime|Version|image',
    example: `R1# show version | include uptime|Version|image

Cisco IOS XE Software, Version 17.09.04a
R1 uptime is 14 weeks, 3 days, 12 hours, 22 minutes
System image file is "bootflash:packages.conf"

What it means:
- Quick health/version view — most common first command in a TAC
  case.
- Uptime > 365 days might indicate a missed maintenance window.
- "System image file" : confirms which IOS XE package is currently
  running (vs what's installed but not active).` },

  { cmd: 'show environment all',
    example: `R1# show environment all

Sensor List:    Environmental Monitoring
Sensor          Location          State        Reading
Power Supply 1  PWR-PS1           Normal       OK (220V AC)
Power Supply 2  PWR-PS2           Normal       OK (220V AC)
Fan Tray        FAN1              Normal       OK (5200 RPM)
Inlet Temp      Slot 1            Normal       28C
Outlet Temp     Slot 1            Normal       42C
Hotspot Temp    CPU0              Normal       58C  (warning >80)

What it means:
- Hardware sensor dashboard — power, fans, temperatures.
- Any "Critical" or "Warning" state is a hardware alarm — open a
  TAC case immediately on dual-PSU redundancy loss.
- "Hotspot" sensors near 80°C threshold = airflow issue (dust,
  blocked vents, failed fan).` },

  { cmd: 'show platform',
    example: `R1# show platform

Chassis type: C9300-48UXM-A
Switch  Ports  Card Type                Serial No.   MAC Address
*1      48     C9300-48UXM              FCW2245A0AB  001a.1e11.2233
 2      48     C9300-48UXM              FCW2245A0AC  001a.1e11.2244
 3      48     C9300-48UXM              FCW2245A0AD  001a.1e11.2255

Switch  Slot  CFG  ID  Hw  Sw                  CurSw         Action
*1      0     1    8   2.0  17.09.04a           Active        Active
 2      0     1    8   2.0  17.09.04a           Standby       Standby
 3      0     1    8   2.0  17.09.04a           Member        Member

What it means:
- Chassis / stack overview. "*" = active switch in a stack.
- "CurSw" : currently-running software image. Mismatched versions
  in a stack cause problems — investigate via "show version" per
  switch.
- Confirm member counts match physical hardware before stack
  operations.` },

  { cmd: 'show ip traffic',
    example: `R1# show ip traffic

IP statistics:
  Rcvd:  14502301 total, 14490190 local destination
         0 format errors, 0 checksum errors, 12 bad hop count
         0 unknown protocol, 0 not a gateway
         0 security failures, 0 bad options, 0 with options
  Frags: 0 reassembled, 0 timeouts, 0 couldn't reassemble
         0 fragmented, 0 fragments, 0 couldn't fragment
  Bcast: 4502 received, 0 sent
  Mcast: 12003 received, 14523 sent
  Sent:  14490190 generated, 12100 forwarded
  Drop:  0 encapsulation failed, 0 unresolved, 0 no adjacency
         0 no route, 142 unicast RPF, 0 forced drop

What it means:
- Top-level IP-stack stats. "Rcvd local destination" = packets
  destined to this router itself (control-plane).
- "checksum errors" or "bad hop count" > 0 = data-corruption or
  TTL-expired packets — investigate further.
- "unicast RPF" drops : packets failed RPF check. High counts hint
  at asymmetric routing or RPF-mode misconfig.` },

  { cmd: 'show tcp brief',
    example: `R1# show tcp brief

TCB         Local Address       Foreign Address     (state)
12345678    10.10.10.1.179      10.10.10.50.51223   ESTAB     ← BGP
87654321    10.10.10.1.22       10.50.50.50.42102   ESTAB     ← SSH from mgmt
ABCDEF12    10.10.10.1.23       0.0.0.0.0           LISTEN    ← telnet (oh dear)

What it means:
- All TCP connections + listeners on the router itself (control
  plane only — does not show forwarded flows).
- BGP sessions on port 179, SSH on 22, telnet on 23 — confirm
  expected sessions are established.
- LISTEN entries on 23 / 80 / 443 = enabled services. Lock down
  unused with "no ip http server" / "transport input ssh".` },

  { cmd: 'show ip sockets',
    example: `R1# show ip sockets

Proto    Remote               Port  Local                 Port  In Out  Stat TTY OutputIF
17(UDP)  --listen--           --    --any--               123   0  0    1   0   any
6(TCP)   10.10.10.50          51223 10.10.10.1            179   0  0    11  0   --
6(TCP)   10.50.50.50          42102 10.10.10.1            22    0  0    11  0   --

What it means:
- IP-layer socket state — covers UDP listeners as well as TCP.
- Proto 17 = UDP, 6 = TCP.
- Useful when troubleshooting NTP / SNMP / TFTP — confirms the
  router is actually listening on the expected UDP port.` },

  { cmd: 'show logging summary',
    example: `R1# show logging summary

+-------+------------+-----------+-----------+---------+
|       | EMERGENCY  | ALERT     | CRITICAL  | ERROR   |
+-------+------------+-----------+-----------+---------+
| TOTAL |     0      |    0      |    0      |  142    |
| LAST  |   never    |  never    |  never    | 02:14:21|
+-------+------------+-----------+-----------+---------+

+-------+------------+-----------+-----------+---------+
|       | WARNING    | NOTICE    | INFO      | DEBUG   |
+-------+------------+-----------+-----------+---------+
| TOTAL |   421      |   1245    |  4502     |   0     |
| LAST  | 00:14:21   | 00:00:14  | 00:00:01  |  never  |
+-------+------------+-----------+-----------+---------+

What it means:
- Severity-bucketed log counters. Quick triage tool — any non-zero
  EMERGENCY / ALERT / CRITICAL deserves immediate investigation.
- "LAST" : how long ago the most recent message of that severity
  arrived. "never" = no message of that severity since boot.` },

  { cmd: 'ping vrf <name> <dst> size <b> df-bit',
    example: `R1# ping vrf CUSTOMER-A 10.99.0.5 size 1500 df-bit count 5

Type escape sequence to abort.
Sending 5, 1500-byte ICMP Echos to 10.99.0.5, timeout is 2 seconds:
Packet sent with the DF bit set
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms

What it means:
- VRF-scoped ping — sources from CUSTOMER-A's RIB / table, not
  the global one.
- "size 1500" + "df-bit" : forces a 1500-byte unfragmented packet
  to test path MTU. If any hop's MTU < 1500, ping fails with
  "fragmentation needed" returned.
- Standard MTU-sweep technique for diagnosing path MTU problems.` },

  { cmd: 'traceroute mpls ipv4 <prefix>',
    example: `R1# traceroute mpls ipv4 10.99.0.0/24

Tracing MPLS Label Switched Path to 10.99.0.0/24, timeout is 2 seconds
  0  10.10.10.1 MRU 1500 [Labels: 22000 Exp: 0]
  1  10.10.10.50 MRU 1500 [Labels: 22001 Exp: 0]  4 ms
  2  10.10.20.50 MRU 1500 [Labels: 22002 Exp: 0]  8 ms
  3  10.20.0.50  MRU 1500 [Labels: implicit-null Exp: 0]  12 ms

What it means:
- LSP traceroute — shows the MPLS label stack at each hop. Useful
  for verifying MPLS-VPN underlay paths.
- "implicit-null" at the last hop = penultimate-hop popping (PHP);
  the previous router popped the label.
- "MRU" = Maximum Receive Unit — the LSP's effective MTU.` },

  // ============== Diagnostics ==============
  { cmd: 'ping 8.8.8.8 source loopback0',
    example: `R1# ping 8.8.8.8 source loopback0

Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 8.8.8.8, timeout is 2 seconds:
Packet sent with a source address of 1.1.1.1
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 12/15/24 ms

What it means:
- Forces source IP = loopback0 instead of the egress interface IP.
- Useful when:
  - testing return-path routing (does upstream reach the loopback?)
  - the destination ACL only permits the loopback /32
- "Packet sent with a source address of 1.1.1.1" line confirms
  the source IP that will appear on the wire.` },

  { cmd: 'ping 8.8.8.8 size 1500 df-bit count 5',
    example: `R1# ping 8.8.8.8 size 1500 df-bit count 5

Type escape sequence to abort.
Sending 5, 1500-byte ICMP Echos to 8.8.8.8, timeout is 2 seconds:
Packet sent with the DF bit set
.....
Success rate is 0 percent (0/5)

# Retry with smaller MTU:
R1# ping 8.8.8.8 size 1400 df-bit count 5
Sending 5, 1400-byte ICMP Echos to 8.8.8.8, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5)

What it means:
- Path MTU discovery technique. df-bit (Don't Fragment) prevents
  intermediate routers from fragmenting the packet.
- 1500 fails / 1400 succeeds = path MTU is between 1400 and 1499.
  Typical cause: MPLS / GRE / VPN tunnel overhead.
- Some intermediate routers drop ICMP Frag Needed messages — this
  is the most common reason for hidden MTU bugs.` },

  { cmd: 'traceroute 8.8.8.8 source loopback0',
    example: `R1# traceroute 8.8.8.8 source loopback0

Type escape sequence to abort.
Tracing the route to 8.8.8.8 (source: 1.1.1.1)
  1 10.10.10.1   1 ms 1 ms 1 ms
  2 198.51.100.1 4 ms 4 ms 4 ms
  3 *  *  *
  4 google-edge.bb.net (74.125.1.5) 12 ms 12 ms 12 ms
  5 8.8.8.8 (8.8.8.8) 13 ms 13 ms 13 ms

What it means:
- Like ping, "source loopback0" forces the source IP in TTL-probing
  packets.
- "* * *" rows : router didn't reply (often blocks ICMP TTL-Exceeded).
  Not a problem unless the trace stops there entirely.
- Use for confirming asymmetric routing or pinpointing where loss
  starts.` },

  { cmd: 'show ip arp <ip>',
    example: `R1# show ip arp 10.10.10.50

Protocol  Address      Age  Hardware Addr     Type   Interface
Internet  10.10.10.50  142  001a.1e11.2233    ARPA   GigabitEthernet0/0

What it means:
- Single-IP ARP lookup. Confirms L2-resolution to the named host.
- Age (sec) = time since last refresh. Default ARP timeout is 4 hours.
- Type ARPA = standard Ethernet ARP. Other types: Cisco HDLC, X.25,
  Frame Relay (legacy).
- Missing entry = silent failure to resolve. Try ping to refresh.` },

  { cmd: 'monitor capture CAP interface Gi1/0/1 both match any buffer size 10 limit pps 1000',
    example: `R1# monitor capture CAP interface gi1/0/1 both match any buffer size 10 limit pps 1000
R1# monitor capture CAP start
R1# show monitor capture CAP

Status Information for Capture CAP
  Target Type:
    Interface: gi1/0/1, Direction: BOTH
    Status: Active
    Filter Details: Capture all packets
    Buffer Details: 10 MB, capture using policy buffer
    Limits:
      pps: 1000

What it means:
- EPC (Embedded Packet Capture) on gi1/0/1.
- "match any" : capture all packets. Use ACL form for filtering:
  "match access-list 100".
- "limit pps 1000" : stops capture at 1000 packets per second to
  avoid saturating the buffer.
- 10 MB ring buffer; oldest packets overwritten when full.` },

  { cmd: 'monitor capture CAP start',
    example: `R1# monitor capture CAP start

Started capture point: CAP

R1# show monitor capture CAP buffer brief
Buffer state: Capturing
Packets captured: 142
Buffer size: 10 MB

What it means:
- Activates a previously-defined capture point.
- "buffer state: Capturing" confirms the capture is live.
- Run "stop" command before viewing the buffer or exporting.` },

  { cmd: 'monitor capture CAP stop',
    example: `R1# monitor capture CAP stop

Stopped capture point: CAP

R1# show monitor capture CAP buffer brief
Buffer state: Stopped
Packets captured: 4,502
Bytes captured: 6,402,341

What it means:
- Stops capture; the buffer is now safe to read or export.
- Buffer contents persist until "monitor capture CAP clear" or
  re-start.
- Always stop before "show monitor capture CAP buffer detailed"
  to avoid impacting the running capture.` },

  { cmd: 'monitor capture CAP export flash:cap.pcap',
    example: `R1# monitor capture CAP export flash:cap.pcap

Exporting capture to flash:cap.pcap (4,502 packets) ...
Done. 6.4 MB written.

R1# dir flash: | include cap.pcap
   24  -rw-      6402341  May  1 2026 11:22:18 +00:00  cap.pcap

What it means:
- Writes the captured packets out as a standard pcap file.
- scp / tftp the file off the router to read in Wireshark.
- Same format as tcpdump output — fully cross-tool compatible.` },

  { cmd: 'show platform hardware fed switch active fwd-asic resource tcam utilization',
    example: `Switch# show platform hardware fed switch active fwd-asic resource tcam utilization

Resource              Total       Used        %Used   Avail
ACL TCAM (input)      1024        342         33%     682
ACL TCAM (output)     1024        145         14%     879
QoS TCAM              512         88          17%     424
NetFlow Sampler       64          12          18%     52
Mac TCAM              16384       2042        12%     14342

What it means:
- Hardware TCAM utilisation per resource class.
- "Avail" running low (>80% used) = configure simpler ACLs / QoS
  policies, or scale to a larger platform.
- ACL TCAM is the most-watched resource on Catalyst — exhaustion
  causes ACLs to fall back to software (slow path).` },

  { cmd: 'debug ip ospf adj',
    example: `R1# debug ip ospf adj

OSPF adjacency events debugging is on

R1#
%OSPF: 2 Way Communication to 2.2.2.2 on Gi0/0, state 2WAY
%OSPF: Send DBD to 2.2.2.2 seq 0x800 opt 0x52
%OSPF: Rcv DBD from 2.2.2.2 seq 0x800 opt 0x52
%OSPF: NBR Negotiation Done. We are the SLAVE
%OSPF: Synchronized with 2.2.2.2, state FULL

R1# undebug all

What it means:
- Real-time logging of OSPF adjacency state machine transitions.
- See the FSM walk: 2WAY → EXSTART → EXCHANGE → LOADING → FULL.
- "We are the SLAVE" = master/slave for DBD sequencing — higher
  router-id wins MASTER. No operational impact post-FULL.
- ALWAYS run "undebug all" after debugging — debug commands
  consume CPU.` },

  { cmd: 'undebug all',
    example: `R1# undebug all

All possible debugging has been turned off

R1# show debug

(no output)

What it means:
- Turns off ALL active debug commands at once.
- Defensive practice: every debug session should end with this
  command. Otherwise a forgotten debug at scale can crash the
  CPU.
- Per-feature off: "no debug ip ospf adj".` },

  { cmd: 'track object-number interface interface-id line-protocol',
    example: `R1(config)# track 10 interface GigabitEthernet0/1 line-protocol

R1# show track 10
Track 10
  Interface GigabitEthernet0/1 line-protocol
  Line protocol is Up
  1 change, last change 02:14:21

What it means:
- Object 10 follows the line-protocol of Gi0/1. Up = data-link
  protocol up; Down = interface admin down OR line protocol down.
- Used by HSRP, route preference, IP SLA — when the tracked object
  goes down, the consumer takes its action (lower HSRP priority,
  remove static route, etc.).` },

  { cmd: 'track object-number ip route route/prefix-length reachability',
    example: `R1(config)# track 20 ip route 10.99.0.0 255.255.255.0 reachability

R1# show track 20
Track 20
  IP route 10.99.0.0 255.255.255.0 reachability
  Reachability is Up
  1 change, last change 02:14:21

R1(config)# ip route 0.0.0.0 0.0.0.0 198.51.100.1 track 20

What it means:
- Object 20 watches whether 10.99.0.0/24 is reachable in the
  routing table.
- Combined with "ip route ... track 20" : the static default route
  is installed only when the tracked object is reachable.
- Common pattern: install default via ISP-A only when ISP-A's
  loopback (or some upstream prefix) is reachable.` },

  { cmd: 'ping <ip>',
    example: `R1# ping 10.10.10.50

Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 10.10.10.50, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms

What it means:
- Default ping: 5 packets, 100 bytes, 2-second timeout.
- "!" = success, "." = timeout, "U" = unreachable, "M" = MTU exceeded.
- Min/avg/max latency in ms — sudden jumps in max indicate jitter
  or queue-depth issues somewhere in the path.` },

  { cmd: 'ping <ip> source <interface>',
    example: `R1# ping 10.99.0.5 source loopback0

Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 10.99.0.5, timeout is 2 seconds:
Packet sent with a source address of 1.1.1.1
!!!!!
Success rate is 100 percent (5/5)

What it means:
- Same as basic ping but uses the named interface's IP as the
  source.
- Use to confirm specific source-IP reachability (e.g. tunnel
  endpoint loopback can ping the peer via the underlay).` },

  { cmd: 'traceroute <ip>',
    example: `R1# traceroute 8.8.8.8

Tracing the route to 8.8.8.8

  1 10.10.10.1                       1 ms 1 ms 1 ms
  2 edge-rtr.corp.local (10.0.0.1)   1 ms 1 ms 1 ms
  3 isp-pe.global.net (203.0.113.1)  4 ms 4 ms 4 ms
  4 *  *  *
  5 google-edge.bb.net (74.125.1.5)  12 ms 12 ms 12 ms
  6 8.8.8.8                          13 ms 13 ms 13 ms

What it means:
- TTL-probing trace. Three RTTs per hop = three probes.
- "* * *" : router didn't reply. Common when a firewall blocks
  ICMP TTL-Exceeded — usually not a problem unless trace stops
  entirely there.
- Use for confirming path through transit providers and detecting
  asymmetric routing.` },

  { cmd: 'terminal monitor',
    example: `R1# terminal monitor

# Now log messages and "debug" output appear on this VTY session:
R1#
%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up

R1# terminal no monitor   ! to stop

What it means:
- Enables real-time syslog output to your current SSH/console
  session. Required to see debug output on a VTY (telnet/SSH)
  session — console gets it by default.
- ALWAYS run "terminal no monitor" before disconnecting to avoid
  flooding the next session that connects.` },

  { cmd: 'show ip dhcp snooping binding',
    example: `Switch# show ip dhcp snooping binding

MacAddress          IpAddress     Lease(sec)  Type           VLAN  Interface
00:1a:1e:11:22:33   10.10.0.50    86400       dhcp-snooping  10    Gi1/0/1
00:1a:1e:44:55:66   10.10.0.51    72000       dhcp-snooping  10    Gi1/0/2

Total number of bindings: 2

What it means:
- DHCP-snooping binding table — IP-MAC-port-VLAN tuples learned
  via DHCP exchanges on trusted ports.
- Used by Dynamic ARP Inspection (DAI) and IP Source Guard for
  L2 attack prevention.
- Manual entries possible: "ip dhcp snooping binding ... interface".
- Permanent: "ip dhcp snooping database flash:dhcp-bindings.txt"
  ensures persistence across reboots.` },

  { cmd: 'clear arp-cache',
    example: `R1# clear arp-cache

R1# show ip arp | count any
0  ← all dynamic entries cleared
# (After traffic resumes, table re-populates)

What it means:
- Flushes the entire dynamic ARP table.
- Static entries are preserved.
- Briefly disruptive — first packet to each destination triggers
  fresh ARP request. Use after a topology change (gateway move) or
  to recover from poisoned ARP.` },

  { cmd: 'clear mac address-table dynamic',
    example: `Switch# clear mac address-table dynamic

Switch# show mac address-table count
Total Mac Addresses for this criterion: 0   ← cleared

What it means:
- Wipes dynamic MAC entries from the L2 forwarding table.
- Static / sticky entries preserved.
- Use after significant topology change (port swap, switch
  failover) to clear stale L2 paths.
- The table re-populates automatically as traffic flows.` },

  { cmd: 'show interface <name> counters errors',
    example: `Switch# show interface gi1/0/1 counters errors

Port      Align-Err  FCS-Err  Xmit-Err  Rcv-Err  UnderSize  OutDiscards
Gi1/0/1   0          12       0         12       0          0

Port      Single-Col  Multi-Col  Late-Col  Excess-Col  Carri-Sen  Runts  Giants
Gi1/0/1   0           0          0         0           0          0      0

What it means:
- Per-port error counters.
- FCS-Err / Align-Err > 0 = physical-layer errors. Replace cable,
  swap port, or check duplex mismatch.
- Late-Col / Excess-Col > 0 = duplex mismatch (one side full, one
  half) or CSMA/CD problems on a hub-connected segment.
- Runts / Giants : packets shorter/longer than expected — usually
  cabling/transceiver issues.` },

  { cmd: 'test cable-diagnostics tdr interface <name>',
    example: `Switch# test cable-diagnostics tdr interface gi1/0/1

TDR test started on interface Gi1/0/1
A TDR test can take a few seconds to run. Wait...
TDR test complete.
Pair Status   Length(meters)
A    Pair OK  10
B    Pair OK  10
C    Pair OK  10
D    Pair OK  10

What it means:
- Time-Domain Reflectometry — sends a pulse down each twisted pair
  and measures reflections.
- "Pair OK" + length = healthy cable. Other statuses:
  - Open : break in the cable at the reported length.
  - Short : two pairs shorted together.
  - Impedance Mismatch : connector or transceiver issue.
- Useful for diagnosing physical-layer problems before swapping
  out hardware.` }
];

let updated = 0, alreadyHad = 0, notFound = 0;
for (const e of ENTRIES) {
  let found = null;
  for (const arr of Object.values(IOS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (!found) { console.warn('  (not found):', JSON.stringify(e.cmd).slice(0,80)); notFound++; continue; }
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
