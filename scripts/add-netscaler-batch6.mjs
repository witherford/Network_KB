// NetScaler enrichment batch 6: VIP Hit Counter Troubleshooting (55).
// Final NetScaler enrichment batch — closes out Stage 2.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ENTRIES = [
  // ============== Per-feature stat counters ==============
  { cmd: 'stat lb vserver',
    example: `> stat lb vserver

LB Vserver Statistics — All
Name        Hits      Requests  Responses  Cur Cli Conn  Cur Svr Conn
lb-web      102,341   102,341   102,000    8             6
lb-api      45,012    45,012    44,902     4             4
lb-mobile   12,003    12,003    11,998     1             1

What it means:
- Aggregate per-VIP counters in one view. Use to identify which
  VIP is taking the most traffic.
- "Cur Cli/Svr Conn" : current connection counts on each leg.
- Hits = Requests — for HTTP. For TCP they may differ if multiple
  TCP segments make up one logical request.` },

  { cmd: 'stat lb vserver <vsrv-name>',
    example: `> stat lb vserver lb-web

LB Vserver Statistics for lb-web
        Hits                  : 102,341
        Requests              : 102,341
        Responses             : 102,000
        Current Cli Conn      : 8
        Total Client Conn     : 50,012
        Current Svr Conn      : 6
        Bytes In              : 18.2 MB
        Bytes Out             : 124.6 MB
        Spillover Hits        : 0
        Bound Service Stats:
          svc_web1: hits 25,420
          svc_web2: hits 25,432
          svc_web3: hits 25,510
          svc_web4: hits 25,979

What it means:
- Per-VIP counters drilling into bound service distribution.
- "Spillover Hits 0" is healthy — non-zero means VIP is overloaded
  and traffic is being deflected to backup vserver.
- Service-hit balance shows whether load is evenly spread (it
  should be roughly equal under ROUNDROBIN; deliberately uneven
  under weighted methods).` },

  { cmd: 'stat lb vserver <vsrv-name> -detail',
    example: `> stat lb vserver lb-web -detail

LB Vserver Detailed Statistics for lb-web
        Hits                  : 102,341
        Pkts Received         : 1,245,902
        Pkts Sent             : 1,290,000
        Avg Response Time     : 12 ms
        Surge Queue Depth     : 0
        Active Transactions   : 8
        Reset Counter:
          Sent to Client      : 12
          Sent to Server      : 0
        Persistence Counter:
          Cookie Insert       : 102,341
          Cookie Read         : 95,210

What it means:
- Detailed view including packet-level counters and surge queue.
- "Surge Queue Depth" : connections queued waiting for an LB slot.
  Sustained > 0 means the VIP is overloaded.
- "Reset to Client" : how often the ADC TCP-RST'd a client. High
  values indicate timeouts or surge-protection drops.` },

  { cmd: 'stat cs vserver',
    example: `> stat cs vserver

CS Vserver Statistics — All
Name              Hits        Requests   Cur Cli Conn  Cur Svr Conn
cs-edge-https     1.5M        1.5M       145           120
cs-internal-api   45,012      45,012     8             8

What it means:
- Per-CS-vserver hits. Compare to LB-vserver hits to see how the
  CS routing decisions distribute traffic to back-end LB-vservers.
- A CS vserver with low hits but a high-priority policy that should
  be matching often = the policy expression is wrong.` },

  { cmd: 'stat cs vserver <csvsrv-name>',
    example: `> stat cs vserver cs-edge-https

CS Vserver Statistics for cs-edge-https
        Hits                  : 1,520,000
        Requests              : 1,520,000
        Responses             : 1,519,500
        Current Client Conn   : 145
        Total Client Conn     : 502,000
        Bound Policy Stats (top):
          cs_pol_mobile  : 450,012
          cs_pol_api     : 120,003
          cs_pol_admin   : 405

What it means:
- Per-CS-vserver counters with policy-hit breakdown.
- Top policies by hits help confirm traffic shape — a policy with
  zero hits over a long uptime is misconfigured.
- Sum of policy hits plus default-LB hits should equal Hits.` },

  { cmd: 'stat cs policy',
    example: `> stat cs policy

CS Policy Statistics — All
Policy Name        Hits        Last Hit Time
cs_pol_mobile      450,012     2026-05-01 11:22:18
cs_pol_api         120,003     2026-05-01 11:22:17
cs_pol_admin       405         2026-05-01 09:14:22
cs_pol_geo_eu      0           never                  ← unused

What it means:
- All CS policies, sorted by hit count.
- "Last Hit Time : never" is a flag: either the policy expression
  matches nothing, or the policy is bound but its priority lets
  another policy win first.
- Use to clean up stale policies after a feature retirement.` },

  { cmd: 'stat cs policy <policy>',
    example: `> stat cs policy cs_pol_mobile

Policy Name : cs_pol_mobile
        Rule        : HTTP.REQ.HEADER("User-Agent").CONTAINS("Mobile")
        Action      : cs_act_mobile
        Hits        : 450,012
        Undef Hits  : 0
        First Hit   : 2026-04-25 09:00:00
        Last Hit    : 2026-05-01 11:22:18

What it means:
- Per-policy detail. "Undef Hits" : evaluation errors (e.g. header
  not present in a non-HTTP request).
- High Undef Hits hint at a too-broad bind point — the policy is
  evaluating on traffic where the rule grammar can't apply.` },

  { cmd: 'stat ssl vserver <vsrv-name>',
    example: `> stat ssl vserver vs_https

SSL Vserver Statistics for vs_https
        SSL Sessions            : 8,502
        Total Handshakes        : 145,021
        Handshake Success       : 144,989
        Handshake Failures      : 32
        Session Reuses          : 102,341
        SNI Connections         : 145,012
        Cert Errors:
          Verify Failures       : 12
          Expired Certs         : 0
          Untrusted Certs       : 12

What it means:
- Per-SSL-vserver counters. Failure / total handshake ratio under
  1% is normal.
- "Verify Failures: 12, Untrusted Certs: 12" : 12 clients tried
  with a cert the ADC didn't trust (probably mTLS misconfiguration).
- Session Reuses : how many resumptions skipped a full handshake —
  high ratio = good.` },

  { cmd: 'stat aaa vserver',
    example: `> stat aaa vserver

AAA Vserver Statistics — All
Name             Hits      Auth Success  Auth Failure  Active Sessions
auth_vs_main     45,012    44,890        122           45
auth_vs_partner  12,003    11,998        5             12

What it means:
- Per-AAA-vserver: total auth attempts, success/failure split,
  current active sessions.
- Failure ratio jumping over 5% = either an LDAP/RADIUS backend
  problem OR a credential-stuffing attack. Drill into ns.log for
  failure reasons.` },

  { cmd: 'stat vpn vserver',
    example: `> stat vpn vserver

VPN Vserver Statistics — All
Name             Hits      Active Sessions  Total Sessions  Failed Logins
gw-rwa-corp      45,012    45              50,012           122
gw-rwa-partner   12,003    12              12,003           5

What it means:
- NetScaler Gateway / SSL-VPN per-vserver counters.
- "Active Sessions" : currently logged-in users. Compare with the
  vpn-vserver's MaxLogin value; a sustained ratio near 100% means
  capacity is exhausted.` },

  { cmd: 'stat gslb vserver <name>',
    example: `> stat gslb vserver GSLB_VS

GSLB Vserver Statistics for GSLB_VS
        DNS Requests           : 12,053
        DNS Responses          : 12,053
        Avg Response Time      : 15 ms
        LB Method              : RTT
        Bound GSLB Services:
          GSLB_SVC_Web1 (DC_London)   : Hits 6,201
          GSLB_SVC_Web2 (DC_NewYork)  : Hits 5,852

What it means:
- DNS-level counters for the GSLB vserver. Hits = number of DNS
  queries that returned an answer.
- Service hits show where GSLB sent clients — RTT / static-proximity
  methods may produce uneven distribution by design (most clients
  closer to one DC).` },

  { cmd: 'stat cr vserver',
    example: `> stat cr vserver

Cache Redirection Vserver Statistics — All
Name        Hits      Cache Hits  Origin Hits  Bypass Hits
cr-vs-1     50,432    35,012      14,901       519

What it means:
- Per-CR-vserver counters split by destination decision:
  - Cache Hits : sent to cache server (e.g. Squid).
  - Origin Hits : sent to origin (cache miss / non-cacheable).
  - Bypass Hits : skipped CR entirely (matched a bypass policy).
- High Origin/Cache ratio = cache miss rate is bad — review
  cacheability rules or cache server health.` },

  { cmd: 'stat service',
    example: `> stat service

Service Statistics — All
Name        Hits      Cur Conn  Total Conn  Throughput
svc_web1    25,420    8         12,005      45 Mbps
svc_web2    25,432    8         12,003      44 Mbps
svc_web3    25,510    7         12,002      45 Mbps
svc_web4    25,979    9         12,401      46 Mbps

What it means:
- Per-back-end-service counters. Even distribution = healthy
  load-balancing.
- "Throughput" is per-service bandwidth; sum should approximate
  the LB-vserver's throughput.` },

  { cmd: 'stat service <svc>',
    example: `> stat service svc_web1

Service Statistics for svc_web1
        State                  : UP
        Hits                   : 25,420
        Current Conn (Cli/Svr) : 8 / 8
        Total Conn             : 12,005
        Bytes In               : 4.5 MB
        Bytes Out              : 31.2 MB
        Avg SRTT (ms)          : 12
        Last Reason for State  : Probe Successful (HTTP 200)

What it means:
- Per-service detail. "Avg SRTT" : smoothed round-trip time to the
  back-end — if it jumps suddenly the back-end has a network or
  CPU issue.
- "Last Reason for State" tells you exactly why the service is
  UP/DOWN — invaluable for health-check tuning.` },

  { cmd: 'stat servicegroup',
    example: `> stat servicegroup

Service Group Statistics — All
Name        Members  UP  Hits      Throughput
sg_web      4        4   102,341   180 Mbps
sg_api      3        2   45,012    35 Mbps   ← one member DOWN

What it means:
- Per-service-group view. "Members / UP" = total/healthy ratio.
- A discrepancy (3 members, 2 UP) is a health-check failure on one
  back-end — drill into "stat servicegroup <name>" or
  "show servicegroup <name>" to find which.` },

  { cmd: 'stat servicegroup <sg>',
    example: `> stat servicegroup sg_web

Service Group Statistics for sg_web
        Members                : 4 (UP: 4, DOWN: 0)
        Hits                   : 102,341
        Total Conn             : 50,012
        Per-member breakdown:
          192.168.1.10:443  Hits 25,420  Cur Conn 8
          192.168.1.11:443  Hits 25,432  Cur Conn 8
          192.168.1.12:443  Hits 25,510  Cur Conn 7
          192.168.1.13:443  Hits 25,979  Cur Conn 9

What it means:
- Drill-down with per-member counters. Helps confirm balanced
  distribution (or deliberately weighted skew).
- A member with disproportionately high hits + connections might
  be the only one not honouring persistence cookies — investigate.` },

  { cmd: 'stat lb monitor <mon>',
    example: `> stat lb monitor mon_health

LB Monitor Statistics for mon_health
        Type                   : HTTP
        Probes Sent            : 1,250,000
        Probes Successful      : 1,249,901
        Probes Failed          : 99
        Last Probe State       : Success (HTTP 200)
        Avg Probe Time         : 8 ms

What it means:
- Per-monitor probe counters. Failure ratio < 0.1% normal.
- Avg Probe Time : how long the back-end takes to respond to the
  health check. Sudden increase = back-end performance trouble.
- A growing "Probes Failed" count, even if services stay UP, is
  an early-warning indicator.` },

  { cmd: 'show service <svc>',
    example: `> show service svc_web1

Name             : svc_web1
        IP             : 192.168.1.10
        Port           : 443
        Protocol       : SSL
        State          : UP
        Last State Change : Wed May  1 09:00:00 2026
        Bound Vservers : lb-web, cs-edge-https
        Bound Monitors :
          tcp_default     : UP, last probe 2 sec ago
          mon_health      : UP, last probe 4 sec ago
        Current Conn   : 8 (cli) / 8 (svr)
        Cookie Stats   : insert 12,401  read 11,890

What it means:
- Per-service config + state snapshot. "Last State Change" tells
  you if the service is freshly recovered or has been stable.
- Bound monitors show ALL probes that must pass for UP state.
- "Cookie Stats" : how many persistence cookies this service has
  inserted vs how many returning clients used one.` },

  { cmd: 'show servicegroup <sg>',
    example: `> show servicegroup sg_web

Name             : sg_web
        Protocol       : SSL
        Maxconn        : 0 (unlimited)
        Bound Members  :
          192.168.1.10:443  State UP   weight 1
          192.168.1.11:443  State UP   weight 1
          192.168.1.12:443  State UP   weight 1
          192.168.1.13:443  State DISABLED  ← admin disabled
        Bound Monitors :
          tcp_default
          mon_health

What it means:
- Per-servicegroup config + member list with per-member state.
- "DISABLED" = administratively out (someone ran "disable" on it).
  "DOWN" = monitor failed.
- Use to confirm a maintenance disable happened on the right
  member before re-enabling.` },

  { cmd: 'stat rewrite policy',
    example: `> stat rewrite policy

Rewrite Policy Statistics — All
Policy Name           Hits        Undef Hits  Last Hit
pol_xff               1,245,012   0           2026-05-01 11:22:18
pol_strip_server      1,245,000   0           2026-05-01 11:22:18
pol_hsts              1,245,000   0           2026-05-01 11:22:18
pol_old_unused        0           0           never

What it means:
- All rewrite policies and their hit counts.
- Three top policies firing on every request = expected (XFF
  injection, server banner strip, HSTS header on every response).
- Zero-hit policy : either retired traffic pattern, or rule never
  matches (worth reviewing).` },

  { cmd: 'stat rewrite policy <pol>',
    example: `> stat rewrite policy pol_xff

Policy Name : pol_xff
        Rule         : HTTP.REQ.IS_VALID
        Action       : act_xff
        Hits         : 1,245,012
        Undef Hits   : 0
        First Hit    : 2026-04-15 09:00:00
        Last Hit     : 2026-05-01 11:22:18

What it means:
- Per-policy detail.
- Rule HTTP.REQ.IS_VALID matches every well-formed HTTP request
  (i.e. fires on everything). Hits ~ requests.
- Combine with "stat rewrite action" to confirm action-level
  counters match.` },

  { cmd: 'stat responder policy',
    example: `> stat responder policy

Responder Policy Statistics — All
Policy Name              Hits     Last Hit
pol_block_admin          1,250    2026-05-01 11:01:14
pol_geo_block_kr         412      2026-05-01 10:14:08
pol_throttle_login       12,403   2026-05-01 11:21:55
pol_decommissioned       0        never

What it means:
- All responder policies. Useful to spot when a block rule starts
  firing more aggressively than usual (sign of a probing campaign).
- pol_throttle_login firing 12k times = legitimate brute-force
  defence working as designed.` },

  { cmd: 'stat responder policy <pol>',
    example: `> stat responder policy pol_throttle_login

Policy Name : pol_throttle_login
        Rule         : sys.check_limit("limit_login")
        Action       : DROP
        Hits         : 12,403
        Undef Hits   : 0
        First Hit    : 2026-04-30 09:00:00
        Last Hit     : 2026-05-01 11:21:55

What it means:
- Per-policy detail. Hits = times the rate-limit was exceeded.
- DROP action silently kills the connection. Compare with RESET
  (TCP RST) or RESPONDWITH (custom error page).` },

  { cmd: 'stat appfw policy <pol>',
    example: `> stat appfw policy appfw_pol_web

Policy Name : appfw_pol_web
        Rule         : HTTP.REQ.IS_VALID
        Profile      : appfw_pro_web
        Hits         : 1,245,392
        Block Count  : 142
        Top Block Reasons:
          SQLInjection         : 78
          CrossSiteScripting   : 31
          StartURL             : 18

What it means:
- AppFW policy stats with breakdown of WHY requests were blocked.
- Hits = total inspections. Block Count = of those, how many
  triggered an action.
- Sustained high SQLi/XSS = tune profile relaxations OR you have
  legitimate attackers being properly blocked.` },

  { cmd: 'stat appqoe policy',
    example: `> stat appqoe policy

AppQoE Policy Statistics — All
Policy Name       Hits      Action       Surge Drops
pol_priority_paid  450,012  PRIORITY_HIGH  0
pol_throttle_free  1,200,000 PRIORITY_LOW  240

What it means:
- AppQoE = Application Quality of Experience: prioritises traffic
  classes during overload.
- Surge Drops on the LOW-priority class = ADC was overloaded and
  shed lower-priority traffic to protect the higher-priority class.
  Working as designed.` },

  { cmd: 'stat ns acl',
    example: `> stat ns acl

ACL Statistics — IPv4 Extended
ACL Name                Action  Hits         Drop Rate (pps)
ACL_BLOCK_TELNET        DENY    14,523       0.5
ACL_ALLOW_MGMT          ALLOW   8,902,341    300
ACL_DEFAULT_DROP        DENY    142          0.0

What it means:
- Per-ACL hit counters. DENY-action hits show what bad traffic
  was successfully blocked.
- "Drop Rate" current packets-per-second hitting the rule. A
  sudden spike on a deny rule = active attack.` },

  { cmd: 'stat ns acl6',
    example: `> stat ns acl6

ACL Statistics — IPv6 Extended
ACL Name             Action  Hits     Drop Rate (pps)
ACL6_BLOCK_RA        DENY    421      0.0
ACL6_ALLOW_LOCAL     ALLOW   45,012   2

What it means:
- IPv6 extended ACL counters — counterpart to "stat ns acl".
- IPv6 ACLs are independent of IPv4; you need a v4 + v6 ACL set
  for dual-stack environments.` },

  { cmd: 'stat ns simpleacl',
    example: `> stat ns simpleacl

Simple ACL Statistics
Source IP        Hits     TTL
10.99.0.5        45       3540s   ← will expire automatically
192.168.99.10    0        7200s

What it means:
- Simple ACLs = fast-path drop rules used for emergency mitigation.
- They auto-expire after their TTL — useful for short-term blocks
  without permanent config changes.
- Hits = how many packets each rule has dropped during its lifetime.` },

  // ============== nsconmsg variants ==============
  { cmd: 'nsconmsg -K newnslog -d current -g vserver_hits_rate',
    example: `# shell nsconmsg -K /var/nslog/newnslog -d current -g vserver_hits_rate

Reltime: 0:0:1:0
Index Counter Group / Name                  Value    Rate
    1 vserver_hits_rate (lb-web)            102341   452
    2 vserver_hits_rate (lb-api)            45012    198
    3 vserver_hits_rate (cs-edge-https)     1520000  6700

What it means:
- newnslog binary counter dump filtered to per-vserver hit RATES.
- "Rate" column is per-second. Top vservers by rate help identify
  which VIP is the dominant traffic shaper.
- Use during live troubleshooting — much lower overhead than
  running "stat lb vserver" repeatedly.` },

  { cmd: 'nsconmsg -K newnslog -d current -g requests_rate',
    example: `# shell nsconmsg -K /var/nslog/newnslog -d current -g requests_rate

Reltime: 0:0:1:0
Index Counter Group / Name              Value      Rate
    1 requests_rate (HTTP)              4,502,000  4502
    2 requests_rate (SSL)               2,101,000  2101

What it means:
- Aggregate per-protocol request rate.
- "Rate" is requests per second, smoothed.
- Sudden divergence between HTTP and SSL request rates may indicate
  a TLS-stripping bug or one feature being overloaded.` },

  { cmd: 'nsconmsg -K newnslog -d statswt0 -g vsvr_hits',
    example: `# shell nsconmsg -K /var/nslog/newnslog -d statswt0 -g vsvr_hits | tail -10

Time Sample Counter Group / Name      Value
2026-05-01 11:00:00  vsvr_hits (lb-web)  102000
2026-05-01 11:01:00  vsvr_hits (lb-web)  102341
2026-05-01 11:02:00  vsvr_hits (lb-web)  102801
2026-05-01 11:03:00  vsvr_hits (lb-web)  103401

What it means:
- "statswt0" is the historical (time-series) ring of newnslog.
  Each row is a 1-minute sample.
- Use to graph trends over the last few hours / days.
- Combine with "tail -100" or pipe to a CSV for analysis in Excel.` },

  { cmd: 'nsconmsg -K newnslog -s ConLb=2 -d oldconmsg',
    example: `# shell nsconmsg -K /var/nslog/newnslog -s ConLb=2 -d oldconmsg

Sample older counter dump (uses ConLb=2 wider columns):

Index Counter                          Value         Rate
    1 lb_tot_pri_responses_overall     1,245,402     4502
    2 lb_tot_avg_resp_time_ms          12            0
    3 lb_tot_pri_clt_responses         1,245,402     4502

What it means:
- "-s ConLb=2" widens the column display so very long counter
  values aren't truncated.
- "-d oldconmsg" : legacy historical mode (kept for backward
  compatibility scripts).` },

  { cmd: 'nsconmsg -K newnslog -d setime -s totalcount=2000 -g vserver',
    example: `# shell nsconmsg -K /var/nslog/newnslog -d setime -s totalcount=2000 -g vserver

Showing last 2000 vserver-counter samples:
2026-05-01 11:22:18 vserver_hits (lb-web) 102341
2026-05-01 11:22:18 vserver_hits (lb-api) 45012
... (1998 more rows)

What it means:
- "-d setime" prints a fixed number of recent samples (totalcount).
- "-g vserver" filters to vserver counters only.
- Useful for exporting a fixed-size dataset to a forensic file
  during an incident.` },

  { cmd: 'nsconmsg -K /var/nslog/newnslog -d past -s ConLb=2 -g vsvr_tot_hits',
    example: `# shell nsconmsg -K /var/nslog/newnslog -d past -s ConLb=2 -g vsvr_tot_hits

Past vserver total-hits across all retained samples:
2026-04-30 09:00:00  vsvr_tot_hits (lb-web)  98000
2026-04-30 11:00:00  vsvr_tot_hits (lb-web)  99401
2026-05-01 09:00:00  vsvr_tot_hits (lb-web)  100012

What it means:
- "-d past" : full historical retention from this newnslog file.
- newnslog rotates after a configurable size — older data is in
  /var/nslog/newnslog.0, .1, .2, etc.
- For longer history, point "-K" at a specific older file.` },

  // ============== Connection-table filters ==============
  { cmd: 'show ns connectiontable -filter "Vsvr == 10.0.0.10:443"',
    example: `> show ns connectiontable -filter "Vsvr == 10.0.0.10:443"

Source IP:Port            Dest IP:Port            State            Idle
203.0.113.45:54321        10.0.0.10:443           ESTABLISHED      0:00:01
198.51.100.20:62103       10.0.0.10:443           ESTABLISHED      0:00:00
198.51.100.30:42118       10.0.0.10:443           TIME_WAIT        0:00:09

Total connections to 10.0.0.10:443 : 142

What it means:
- Filters live conntable to only flows targeting the named VIP.
- Useful when one specific VIP is suspected of misbehaving — see
  exactly which clients are connected and in what state.
- "TIME_WAIT" entries are normal transient state after close.` },

  { cmd: 'show ns connectiontable -filter "VsvrName == web-vs"',
    example: `> show ns connectiontable -filter "VsvrName == web-vs"

Source IP:Port            Dest IP:Port            State            Idle
203.0.113.45:54321        10.0.0.10:443           ESTABLISHED      0:00:01
... (142 rows)

What it means:
- Same as above but filters by vserver NAME instead of IP — more
  robust if the VIP IP might change or if the vserver is on a
  range / wildcard.
- Filter expressions support && and ||:
    -filter "VsvrName == web-vs && SrcIP == 203.0.113.45"` },

  { cmd: 'show ns conntable | grep <vip>',
    example: `> show ns conntable | grep 10.0.0.10

203.0.113.45:54321  10.0.0.10:443  ESTABLISHED  TCP  0:00:01
198.51.100.20:62103 10.0.0.10:443  ESTABLISHED  TCP  0:00:00
198.51.100.30:42118 10.0.0.10:443  TIME_WAIT    TCP  0:00:09

What it means:
- Quick-and-dirty filtering of conntable via grep — useful in
  scripted contexts where the structured -filter syntax is
  unavailable or harder to compose.
- Less efficient for large tables; prefer "-filter" form for
  routine use.` },

  { cmd: 'stat ns connectiontable',
    example: `> stat ns connectiontable

Connection Table Statistics
        Current Total Conn         : 8,502
        Total Lifetime Conn        : 145,021
        State Distribution:
          ESTABLISHED              : 7,432
          TIME_WAIT                : 921
          CLOSE_WAIT               : 142
          SYN_SENT                 : 7
        Conn Memory Used           : 14.2 MB / 1.0 GB

What it means:
- Aggregate conntable stats. ESTABLISHED is the dominant state.
- "CLOSE_WAIT" rising = back-end app is closing connections but
  not the local socket — application bug.
- "Conn Memory Used" : guard against running out; busy ADCs
  may need conn-table tuning ("set ns config -maxConn").` },

  { cmd: 'shell tail -f /var/log/ns.log | grep <vip>',
    example: `# shell tail -f /var/log/ns.log | grep 10.0.0.10

May  1 11:22:01 NS-ADC PPE-0 : default LB SVC_AVAIL Service svc_web1 (10.0.0.10:443) UP
May  1 11:22:08 NS-ADC PPE-0 : default LB SVC_DOWN Service svc_web2 (10.0.0.10:443) DOWN

What it means:
- Live ns.log tail filtered to a single VIP IP — see only events
  related to that vserver.
- Combine multiple greps:
    tail -f ns.log | grep 10.0.0.10 | grep DOWN
- Press Ctrl+C to stop the tail.` },

  { cmd: 'shell tail -f /var/log/newnslog',
    example: `# shell tail -f /var/log/newnslog 2>&1 | strings | head -10

This binary file is best read via nsconmsg.

# Better:
# shell nsconmsg -K /var/log/newnslog -d current -g <pattern>

What it means:
- /var/log/newnslog is BINARY — using "tail -f" prints unreadable
  output. Use "nsconmsg" to decode it instead.
- For live tailing of decoded counters:
    shell nsconmsg -K /var/log/newnslog -d current -g vserver_hits_rate -s reltime=1
  (refreshes every 1 sec).` },

  // ============== clear / show ==============
  { cmd: 'clear ns stats',
    example: `> clear ns stats
Are you sure you want to clear all statistical counters? [Y/N] Y
Done

> stat ns | head -3
        HTTP Requests/sec     : 0    ← reset
        Throughput (Mbps)     : 0    ← reset

What it means:
- Resets ALL counters (vservers, services, monitors, AppFW, etc.)
  to zero.
- Useful as a clean baseline before reproducing an issue.
- Does NOT affect connection table or running config — only
  statistics.` },

  { cmd: 'clear lb vserver <vsrv-name>',
    example: `> clear lb vserver lb-web
Done

> stat lb vserver lb-web | head -3
        Hits      : 0     ← reset
        Requests  : 0     ← reset

What it means:
- Resets stats for a specific LB vserver only — surgical compared
  to "clear ns stats".
- Useful when diagnosing one VIP's behaviour without disturbing
  baseline counters elsewhere.` },

  { cmd: 'clear cs vserver <csvsrv-name>',
    example: `> clear cs vserver cs-edge-https
Done

> stat cs vserver cs-edge-https | head -3
        Hits      : 0     ← reset

What it means:
- Resets the per-CS-vserver hit counters and policy-hit
  breakdowns. Underlying LB-vserver counters untouched.
- Pairs naturally with "clear cs policy" if you want to reset
  per-policy hits at the same time.` },

  { cmd: 'clear ns connectiontable',
    example: `> clear ns connectiontable
Are you sure you want to clear all active connections? [Y/N] Y
Done. 8,502 connections cleared.

What it means:
- DESTRUCTIVE: closes EVERY active TCP/UDP flow on the dataplane.
- Used during emergency conditions where the conntable is
  corrupted or memory-exhausted.
- Production users will see RST on every existing connection;
  re-establish takes a few seconds.` },

  { cmd: 'show lb vserver <vsrv-name>',
    example: `> show lb vserver lb-web

Name             : lb-web
        State            : UP
        Effective State  : UP
        IP : 10.0.0.10:443 (SSL)
        Persistence      : COOKIEINSERT
        LB Method        : LEASTCONNECTION
        Bound Services   : 4 (UP: 4)

What it means:
- Per-VIP config + state.
- "Effective State" : computed from individual service health.
  UP requires at least one service UP.
- For deeper service-level detail, follow up with
  "show service <svc>" on each bound service.` },

  { cmd: 'show ns ip <vip>',
    example: `> show ns ip 10.0.0.10

IP                  Type   Mode    State      VLAN  Options
10.0.0.10           VIP    Active  Enabled    100   ARP=ENABLED, MGMTACCESS=DISABLED

What it means:
- Looks up a single IP in the ADC's IP table.
- Type VIP : front-end Virtual IP for an LB/CS/GSLB vserver.
- ARP ENABLED : ADC responds to ARP requests for this IP. Disable
  on float-VIPs in HA-active-active scenarios where another node
  owns the responder role.
- MGMTACCESS DISABLED : VIP doesn't accept management traffic.` },

  { cmd: 'show ns arp <vip>',
    example: `> show ns arp 10.0.0.1

IP            HWaddr               IF      VLAN  Type     Age
10.0.0.1      00:1a:1e:11:22:33    1/1     1     DYNAMIC  60s

What it means:
- ARP table entry for the gateway / next-hop of the named VIP.
- Useful when troubleshooting "VIP not reachable" — confirms
  L2 resolution to the upstream router is happening.
- Type DYNAMIC : auto-resolved. STATIC : manually pinned.
- Age : seconds since the entry was last refreshed.` },

  { cmd: 'show route <vip>',
    example: `> show route 10.0.0.10

Network/Mask        Gateway     Vlan  State  Source   Cost
10.0.0.0/24         (direct)    100   UP     CONNECT  0

What it means:
- Routing decision the ADC would use for the named destination.
- "(direct)" : the destination is on a directly-attached subnet
  (no gateway hop needed).
- For routes via a gateway, the column shows the next-hop IP.` },

  { cmd: 'show ns runningconfig | grep -i <vsrv-name>',
    example: `> show ns runningconfig | grep -i lb-web

add lb vserver lb-web SSL 10.0.0.10 443
set lb vserver lb-web -lbMethod LEASTCONNECTION -persistenceType COOKIEINSERT
bind lb vserver lb-web svc_web1
bind lb vserver lb-web svc_web2
bind ssl vserver lb-web -certkeyName wildcard.global.com

What it means:
- Filtered runningConfig — only lines mentioning the named vserver.
- Quick way to capture every config line involved in one VIP for
  documentation / change-control purposes.
- Use case-insensitive (-i) so partial matches across naming
  conventions still hit.` },

  { cmd: 'show ns listenpolicy',
    example: `> show ns listenpolicy

Listen Policy : default
        Policy expression  : (none — accept all by default)
        Bound vservers     : (all)

# With explicit policies:
Listen Policy : restrict_internal
        Policy expression  : CLIENT.IP.SRC.IN_SUBNET(10.0.0.0/8)
        Bound vservers     : lb-internal-api

What it means:
- Listen policies decide WHICH vserver responds to a given inbound
  connection. By default, the IP+port match wins.
- Use to enforce CIDR-based access (only internal subnets reach
  this VIP) without ACLs.
- Bound vservers ignore connections that don't match the listen
  expression.` },

  { cmd: 'show appflow',
    example: `> show appflow

AppFlow Statistics:
        Total flows exported   : 14,520,341
        Active collectors      : 1
          Collector_1 (10.1.1.50:4739): connected, last sent 2 sec ago
        Active actions         : 1
          AF_ACT_1 (Sample 100%, page tracking)
        Active policies        : 1
          AF_POL_GLOBAL (rule TRUE, hits 14,520,341)

What it means:
- AppFlow exports IPFIX records to external collectors (Splunk,
  Citrix ADM, Plixer Scrutinizer, etc.).
- "ClientSample 100" : every flow exported. Lower percentages
  reduce overhead on the ADC + collector.
- Useful for application-performance monitoring and security
  forensics with full flow + metadata fidelity.` },

  // ============== curl / NITRO API ==============
  { cmd: 'curl -k -u <user>:<pwd> https://<nsip>/nitro/v1/stat/lbvserver/<name>',
    example: `$ curl -k -u nsroot:secret https://10.10.10.10/nitro/v1/stat/lbvserver/lb-web | jq

{
  "errorcode": 0,
  "message": "Done",
  "lbvserver": [{
    "name"       : "lb-web",
    "totalrequests": "102341",
    "curclntconnections": "8",
    "totalpktssent"     : "1290000"
  }]
}

What it means:
- NITRO is the ADC's REST/JSON management API. Per-vserver stats
  via /stat/lbvserver/<name>.
- "-k" : skip TLS verification (NSIP self-signed). For production,
  add proper trust anchors.
- Output is JSON; pipe through "jq" or jq-equivalent for readable
  formatting.` },

  { cmd: 'curl -k -u <user>:<pwd> https://<nsip>/nitro/v1/stat/lbvserver',
    example: `$ curl -k -u nsroot:secret https://10.10.10.10/nitro/v1/stat/lbvserver | jq '.lbvserver[] | .name + " " + .totalrequests'

"lb-web 102341"
"lb-api 45012"
"lb-mobile 12003"
"lb-default 0"

What it means:
- Without a name suffix, returns ALL LB vservers — useful for
  bulk monitoring scripts.
- Pair with jq to extract specific fields: name + hits count
  becomes a clean per-vserver summary.
- Same shape works for other endpoints: /stat/csvserver,
  /stat/service, /stat/servicegroup.` },

  { cmd: 'curl -k -u <user>:<pwd> https://<nsip>/nitro/v1/stat/csvserver/<name>',
    example: `$ curl -k -u nsroot:secret https://10.10.10.10/nitro/v1/stat/csvserver/cs-edge-https | jq

{
  "errorcode": 0,
  "csvserver": [{
    "name"               : "cs-edge-https",
    "totalrequests"      : "1520000",
    "totalresponses"     : "1519500",
    "curclntconnections" : "145"
  }]
}

What it means:
- Same shape as the LB-vserver endpoint but for Content-Switching
  vservers.
- Use for monitoring scripts that want CS-vserver-level metrics
  rather than the underlying LB-vserver split.` },

  { cmd: 'curl -k -u <user>:<pwd> "https://<nsip>/nitro/v1/stat/lbvserver/<name>?statbindings=yes"',
    example: `$ curl -k -u nsroot:secret "https://10.10.10.10/nitro/v1/stat/lbvserver/lb-web?statbindings=yes" | jq

{
  "errorcode": 0,
  "lbvserver": [{
    "name": "lb-web",
    "totalrequests": "102341",
    "lbvserver_service_binding": [
      { "servicename": "svc_web1", "totalrequests": "25420" },
      { "servicename": "svc_web2", "totalrequests": "25432" },
      { "servicename": "svc_web3", "totalrequests": "25510" },
      { "servicename": "svc_web4", "totalrequests": "25979" }
    ]
  }]
}

What it means:
- "?statbindings=yes" includes per-bound-service stats inside the
  vserver response.
- Single API call returns the full picture: VIP-level totals plus
  the load distribution across back-end services.
- Use for dashboards that want to show hit-distribution heatmaps
  per VIP.` }
];

let updated = 0, alreadyHad = 0, notFound = 0;
for (const e of ENTRIES) {
  let found = null;
  for (const arr of Object.values(NS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (!found) { console.warn('  (not found):', e.cmd); notFound++; continue; }
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
