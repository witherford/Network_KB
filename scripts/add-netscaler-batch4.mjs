// NetScaler enrichment batch 4: AppFW (9) + Diagnostics (17) = 26 entries.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ENTRIES = [
  // ============== AppFW ==============
  { cmd: 'stat appfw',
    example: `> stat appfw

AppFW Counter Statistics
        Total Requests Inspected         : 1,245,392
        Requests Blocked                 : 142
        Top Block Reasons:
          SQLInjection                   : 78
          CrossSiteScripting             : 31
          StartURL                       : 18
          BufferOverflow                 : 9
          CookieConsistency              : 6
        Learning Engine
          Suggestions Pending            : 412
          Suggested Rules Generated      : 2103

What it means:
- AppFW = Application Firewall (WAF) — inspects HTTP traffic for
  OWASP-style attacks.
- "Blocked" counters break down by violation type. SQLi + XSS being
  highest is normal; sustained high BufferOverflow means an attacker
  is fuzzing endpoints.
- "Suggestions Pending" : the learning engine has spotted patterns it
  thinks could become whitelist rules. Review via "show appfw
  learningdata".` },

  { cmd: 'add appfw profile <name> -defaults advanced',
    example: `> add appfw profile appfw_pro_web -defaults advanced
Done

> show appfw profile appfw_pro_web | head -10
Name : appfw_pro_web
        Defaults                          : advanced
        StartURL Closure                  : ON
        SQL Injection Type                : SQLSPLCHARORKEYWORD
        Default CharSet                   : UTF-8
        SQL Injection Action              : log,stats
        Cross Site Scripting Action       : log,stats
        Buffer Overflow Action            : log,stats

What it means:
- "advanced" pre-loads safe-but-strict default values for every check
  (SQLi, XSS, buffer overflow, start-URL closure, cookie consistency,
  etc.).
- Default action set to "log,stats" — counts and logs violations
  WITHOUT blocking. Add "block" only after a tuning period.
- Compare with -defaults basic (very permissive, mostly off).` },

  { cmd: 'set appfw profile <name> -startURLAction block log stats',
    example: `> set appfw profile appfw_pro_web -startURLAction block log stats
Done

# StartURL closure now blocks any request whose URL is not in the
# whitelist of legitimate entry points. Browsers must arrive via
# referer-chain from a known StartURL.

What it means:
- "Start URL" check stops users from deep-linking into back-end
  endpoints, forcing them to enter via the home page or other
  whitelisted URLs.
- Action set: "block" + "log" + "stats" = drop violating request,
  emit syslog, increment counter.
- For app-like flows that legitimately deep-link (REST APIs,
  bookmarkable pages), tune via "Start URL Closure" or maintain
  an explicit whitelist.` },

  { cmd: 'set appfw profile <name> -sqlInjectionAction block log',
    example: `> set appfw profile appfw_pro_web -sqlInjectionAction block log -sqlInjectionType SQLSPLCHARANDKEYWORD
Done

# Sample blocked request:
GET /search?q=' OR 1=1-- HTTP/1.1
HTTP/1.1 403 Forbidden
%APPFW-3-SQLINJ_VIOLATION: Profile: appfw_pro_web, URL: /search,
                            Field: q, Reason: SQL keyword + special chars

What it means:
- Detects SQL injection patterns in URL/form/header fields.
- Type SQLSPLCHARANDKEYWORD : strictest — requires BOTH special chars
  (quotes, semicolons) AND SQL keywords (UNION, SELECT, DROP) before
  flagging. Lower types catch more but generate more false positives.
- Combine with "stats" to feed counters even when blocking.` },

  { cmd: 'set appfw profile <name> -crossSiteScriptingAction block log',
    example: `> set appfw profile appfw_pro_web -crossSiteScriptingAction block log
Done

# Sample blocked request:
GET /comment?text=<script>alert(1)</script> HTTP/1.1
HTTP/1.1 403 Forbidden
%APPFW-3-XSS_VIOLATION: Profile: appfw_pro_web, URL: /comment,
                       Field: text, Reason: <script> tag detected

What it means:
- Cross-Site Scripting check inspects HTML/JS injection patterns
  in user-supplied parameters.
- Whitelist legitimate HTML-bearing fields (rich-text editors)
  via "bind appfw profile -crossSiteScriptingURL exempted_url".
- Detection is signature-based + heuristic; false-positive review
  is essential during ramp-up.` },

  { cmd: 'add appfw policy <name> <rule> <profile>',
    example: `> add appfw policy appfw_pol_web 'HTTP.REQ.IS_VALID' appfw_pro_web
Done

> show appfw policy
Name : appfw_pol_web
        Rule       : HTTP.REQ.IS_VALID
        Profile    : appfw_pro_web
        Hits       : 0

What it means:
- Wires a match-rule to an AppFW profile. Rule "HTTP.REQ.IS_VALID"
  matches any well-formed HTTP request (i.e. fire on everything).
- Use stricter rules to apply different profiles to different URLs
  (e.g. one profile for the API, one for the customer portal).
- Bind to a vserver or globally to activate.` },

  { cmd: 'bind appfw global <policy> <priority>',
    example: `> bind appfw global appfw_pol_web 100
Done

> show appfw global
        Priority   Policy Name      Goto Expression
        100        appfw_pol_web    END

What it means:
- "Global" binding makes the policy evaluate on every HTTP/SSL
  vserver — all front-end traffic is inspected.
- Priority 100 (lower = first); use 100/200/300 spacing.
- Per-vserver bind ("bind lb vserver -policyName") gives finer
  control for environments where AppFW shouldn't apply to all
  apps (e.g. internal-only services).` },

  { cmd: 'show appfw learningdata <profile> startURL',
    example: `> show appfw learningdata appfw_pro_web startURL

URL                              Hits      Status
/                                12,405    Suggested for whitelist
/login                           11,201    Suggested for whitelist
/api/v1/healthcheck              4,505     Suggested for whitelist
/static/*.png                    35,012    Suggested for whitelist
/admin/internal-debug            3         Anomaly — review

What it means:
- The learning engine watches real traffic and proposes URL patterns
  that should be whitelisted for the StartURL check.
- "Suggested for whitelist" entries can be promoted via the GUI's
  "Learning data" view or via CLI.
- Anomalies (low hits + unusual paths) surface potential probing —
  worth investigating before whitelisting.` },

  { cmd: 'export appfw learningdata <profile> -exportformat CEF',
    example: `> export appfw learningdata appfw_pro_web -exportformat CEF -filename appfw-learning-2026-05-01.cef
Done

> shell ls -la /var/log/appfw/learning/
appfw-learning-2026-05-01.cef   2.3 MB

What it means:
- Exports learning suggestions in Common Event Format (CEF) for
  ingestion into Splunk / QRadar / ArcSight / other SIEMs.
- Lets security teams review proposed rules in their existing
  workflows rather than the ADC GUI.
- Other formats: XML (machine-readable), CSV (spreadsheet-friendly).` },

  // ============== Diagnostics ==============
  { cmd: 'ping <destination-ip>',
    example: `> ping 10.40.0.5
PING 10.40.0.5 (10.40.0.5): 56 data bytes
64 bytes from 10.40.0.5: icmp_seq=0 ttl=64 time=0.214 ms
64 bytes from 10.40.0.5: icmp_seq=1 ttl=64 time=0.198 ms
64 bytes from 10.40.0.5: icmp_seq=2 ttl=64 time=0.221 ms
^C
--- 10.40.0.5 ping statistics ---
3 packets transmitted, 3 packets received, 0% packet loss
round-trip min/avg/max = 0.198/0.211/0.221 ms

What it means:
- ICMP echo from the ADC. Source defaults to the appropriate SNIP
  for the destination's subnet.
- ttl=64 means IP TTL on the reply — high values indicate same-L3-hop.
- "0% packet loss" confirms reachability. Use Ctrl+C to stop.` },

  { cmd: 'ping -S <source-ip> <destination-ip>',
    example: `> ping -S 10.10.10.11 8.8.8.8
PING 8.8.8.8 (8.8.8.8) from 10.10.10.11: 56 data bytes
64 bytes from 8.8.8.8: icmp_seq=0 ttl=115 time=2.412 ms
64 bytes from 8.8.8.8: icmp_seq=1 ttl=115 time=2.398 ms

What it means:
- "-S" forces a specific source IP (must be a configured ADC IP).
- Use to confirm that a particular SNIP/MIP can reach a destination
  — very common when multi-NIC ADCs route via different uplinks
  per VLAN.
- Destination's reply must come back via a route that returns to
  the chosen source SNIP.` },

  { cmd: 'traceroute <destination-ip>',
    example: `> traceroute 8.8.8.8
traceroute to 8.8.8.8 (8.8.8.8), 30 hops max, 60 byte packets
 1  10.10.10.1 (10.10.10.1)        0.412 ms  0.398 ms
 2  edge-rtr.corp.local (10.0.0.1) 1.214 ms  1.198 ms
 3  isp-pe.global.net (203.0.113.1) 4.512 ms  4.498 ms
 4  * * *
 5  google-edge.bb.net (74.125.1.5) 12.114 ms  12.098 ms
 6  8.8.8.8 (8.8.8.8)              12.512 ms  12.498 ms

What it means:
- Walks the IP path to the destination by sending packets with
  increasing TTL — each router on the path replies with ICMP
  TIME_EXCEEDED, exposing itself.
- "* * *" = router didn't reply (often blocks ICMP for security);
  not a problem unless the trace stops dead there.
- Useful for confirming asymmetric routing or pinpointing where
  packet loss happens between two endpoints.` },

  { cmd: 'shell tail -f /var/log/ns.log',
    example: `# shell tail -f /var/log/ns.log
May  1 11:22:01 NS-ADC PPE-0 : default UI CMD_EXECUTED 21 0
        : User nsroot - Remote_ip 10.0.0.50 - Command "show lb vserver"
May  1 11:22:05 NS-ADC PPE-0 : default APPFW SQLINJ_VIOLATION 1
        Profile: appfw_pro_web URL: /search Field: q
May  1 11:22:08 NS-ADC PPE-0 : default DUAL NBRCHANGE 1
        : Neighbor 10.10.10.11 is up

What it means:
- Live tail of the main NetScaler audit / event log. Every config
  change, policy hit (with logging on), and significant subsystem
  event lands here.
- Format: "<timestamp> <hostname> <PE-id> : <facility> <event-class>
  <event-id> <args>".
- Press Ctrl+C to stop the tail.
- "shell" wrapper required because tail isn't a NetScaler CLI cmd.` },

  { cmd: 'shell tail -f /var/log/bash.log',
    example: `# shell tail -f /var/log/bash.log
2026-05-01T11:22:18+00:00 NS-ADC nsroot[1234]: pwd
2026-05-01T11:22:25+00:00 NS-ADC nsroot[1234]: cat /flash/nsconfig/ns.conf
2026-05-01T11:22:31+00:00 NS-ADC opadmin[1245]: nstrace.sh -time 60 -size 0

What it means:
- BSD-shell command audit log — records every command run from the
  "shell" prompt with user, PID, and timestamp.
- Critical for security forensics: did any user run dangerous shell
  commands during the incident window?
- The CLI command audit log is /var/log/ns.log (different file).` },

  { cmd: 'shell grep ERR /var/log/ns.log',
    example: `# shell grep ERR /var/log/ns.log | tail -10
May  1 09:14:22 NS-ADC PPE-0 : default APPFW SQLINJ_VIOLATION ERR
May  1 09:18:45 NS-ADC PPE-0 : default SSLLOG SSL_HANDSHAKE_FAILURE ERR
May  1 10:02:11 NS-ADC PPE-0 : default DUAL NBRCHANGE_FAILURE ERR

What it means:
- Filters ns.log for error-class events. Quick way to see what's
  going wrong without scrolling through info-level noise.
- Combine with "tail -200" or pipe to "less" for paginated review.
- Common follow-up: "grep <event-id>" once you spot a recurring
  error code, to see all occurrences with their context.` },

  { cmd: 'shell cat /var/log/ssl.log',
    example: `# shell cat /var/log/ssl.log | tail -5
2026-05-01T11:22:01 SSL_HANDSHAKE_SUCCESS - Client 203.0.113.45
        Protocol: TLSv1.3, Cipher: TLS_AES_256_GCM_SHA384
2026-05-01T11:22:08 SSL_HANDSHAKE_FAILURE - Client 198.51.100.10
        Reason: peer used unsupported cipher
2026-05-01T11:22:15 SSL_OCSP_FAILURE - Cert: server.crt
        Reason: OCSP responder timeout

What it means:
- SSL/TLS-specific event log. Captures handshake successes/failures,
  cipher selection, OCSP-stapling responses, cert-expiry warnings.
- Handshake-failure entries include the peer IP and a reason —
  critical for diagnosing TLS interop issues with old clients.
- Volume can be high on busy SSL VIPs; rotate aggressively.` },

  { cmd: 'shell cat /var/log/aaa.log',
    example: `# shell cat /var/log/aaa.log | tail -5
2026-05-01T11:22:01 LOGIN_FAILED user=jsmith reason="bad credentials"
        source=203.0.113.45 auth_type=LDAP
2026-05-01T11:22:18 LOGIN_SUCCESS user=jsmith
        source=203.0.113.45 auth_type=LDAP
2026-05-01T11:22:30 SESSION_TIMEOUT user=jdoe
        intranet_ip=10.99.0.50 duration=00:30:00

What it means:
- Authentication / VPN / AAA event log. Login failures, successful
  logins, session timeouts, MFA challenges all recorded.
- Forensic gold: pinpoint exactly when a compromised user logged in
  and from where.
- Set log retention long enough to support your compliance
  requirements (typically 90+ days for SOX/PCI).` },

  { cmd: 'shell df -h',
    example: `# shell df -h
Filesystem      Size    Used   Avail Capacity  Mounted on
/dev/ad0s1a     1.9G    645M   1.1G   36%      /
/dev/ad0s1e     474M    1.4M   435M    0%      /tmp
/dev/ad0s1f     14G     2.1G   11G    16%      /var
/dev/ad0s1d     474M    14K    436M    0%      /flash

What it means:
- BSD disk-usage report. Each mount is a separate partition.
- /flash : factory firmware + config (~500 MB, mostly stable).
- /var   : logs + nstrace files + tech-support bundles. Most likely
           to fill up. >80% triggers /var/log/ns.log warnings; at
           >95% the box may stop accepting new connections.
- /tmp   : transient working space; cleared on reboot.` },

  { cmd: 'show ns events',
    example: `> show ns events | tail -10

EventTime                  Module    Severity  Eventid  Message
2026-05-01 11:22:01.123    SSL       INFO      9001     Handshake success client=203.0.113.45
2026-05-01 11:22:08.512    APPFW     ERROR     5012     SQLi violation, profile=appfw_pro_web
2026-05-01 11:22:15.014    DUAL      WARN      4042     Neighbor 10.10.10.11 down

What it means:
- Structured event-ring buffer in CLI form (no need to drop to
  shell for grep-ing log files).
- Severity codes: EMERGENCY, ALERT, CRITICAL, ERROR, WARN, INFO,
  DEBUG.
- EventID is unique per event-class — useful for filtering with
  "show ns events -eventId 5012".` },

  { cmd: 'show ns connectiontable -detail full',
    example: `> show ns connectiontable -detail full | head -10

Source IP:Port           Dest IP:Port           State           Protocol  Idle
203.0.113.45:54321       10.20.0.10:443         ESTABLISHED     TCP       0:00:01
10.10.10.11:33102        192.168.1.10:80        ESTABLISHED     TCP       0:00:00
10.10.10.11:48201        192.168.1.11:80        TIME_WAIT       TCP       0:00:14

Total connections : 8,502
        ESTABLISHED  : 7,432
        TIME_WAIT    : 921
        CLOSE_WAIT   : 142
        SYN_SENT     :   7

What it means:
- Live connection table — every TCP/UDP flow currently tracked
  by the dataplane.
- "ESTABLISHED" : healthy, active. "TIME_WAIT" : closed, briefly
  remembered for late-arriving FINs. "CLOSE_WAIT" : remote closed,
  local app hasn't yet — a high count of these is a back-end app bug.
- Filter via -filter "CONNECTION.IP.EQ(...)" to narrow down.` },

  { cmd: 'nsconmsg -d current -g all',
    example: `# shell nsconmsg -d current -g all | head -10

NetScaler V21 Performance Data
Reltime: 0:0:1:0
Index Counter Group / Name             Value     Rate    Type
    1 sys_tot_pkt_rcvd                 14502301  4502    rate
    2 sys_tot_pkt_sent                 14490190  4501    rate
    3 ssl_tot_handshake_success        145020    320     rate
    4 lb_tot_servers_up                48        0       cnts

What it means:
- "nsconmsg" is the kernel performance-counter front-end.
- "-d current" : show current values (vs -d statswt0 for historical).
- "-g all" : every counter group. Add "-g <name>" to filter:
    nsconmsg -d current -g ssl_tot
    nsconmsg -d current -g http_tot
- "Rate" column : per-second rate over the sample interval (Reltime).` },

  { cmd: 'shell netstat -an | grep ESTABLISHED | wc -l',
    example: `# shell netstat -an | grep ESTABLISHED | wc -l
8502

What it means:
- BSD-stack count of ESTABLISHED TCP connections currently held by
  the management plane.
- Compare with "show ns connectiontable" which counts dataplane
  flows — these are separate counters.
- A sudden spike in management-plane connections might signal
  password-spray probes against the management interface.` },

  { cmd: 'nsconmsg -d current -s ConLb=1 -g lb_tot',
    example: `# shell nsconmsg -d current -s ConLb=1 -g lb_tot

Reltime: 0:0:1:0
Index Counter Group / Name           Value      Rate
    1 lb_tot_pri_clt_responses       1,245,402  4502
    2 lb_tot_pri_svr_responses       1,245,402  4502
    3 lb_tot_pri_responses_overall   1,245,402  4502
    4 lb_tot_avg_resp_time_ms        12         0

What it means:
- "-s ConLb=1" filters to LB feature counters only.
- "lb_tot_pri_*" : per-vserver totals. "_avg_resp_time_ms" is the
  smoothed back-end response time.
- Use to spot which LB vserver is the dominant traffic shaper.` },

  { cmd: 'shell grep -i ssl /var/log/ns.log | tail -200',
    example: `# shell grep -i ssl /var/log/ns.log | tail -200

May  1 11:22:01 NS-ADC PPE-0 : default SSLLOG SSL_HANDSHAKE_SUCCESS
May  1 11:22:08 NS-ADC PPE-0 : default SSLLOG SSL_HANDSHAKE_FAILURE
        Reason: peer chose TLSv1.0 (deprecated)
May  1 11:22:14 NS-ADC PPE-0 : default SSLLOG SSL_OCSP_FAILURE
        Cert: server.crt OCSP responder timeout 5s
May  1 11:22:31 NS-ADC PPE-0 : default SSLLOG SSL_HANDSHAKE_RENEGOTIATION
        Client 203.0.113.45 forced renegotiation

What it means:
- Filtered tail of ns.log keeping just SSL-related events.
- Useful for capturing the last few hundred TLS errors during a
  troubleshooting session.
- For longer history, look at /var/log/ssl.log directly (rotated
  separately).` },

  { cmd: 'shell nsconmsg -K /var/nslog/newnslog -d event',
    example: `# shell nsconmsg -K /var/nslog/newnslog -d event | head -10

NetScaler V21 Performance Data — Event mode
Time          Event Description
11:00:01      sys_event_appflow_collector_failed (collector_1)
11:02:14      sys_event_lb_service_unavailable (svc_web_1)
11:02:14      sys_event_lb_vserver_state_change (lb_web → DOWN)
11:02:18      sys_event_lb_service_available (svc_web_1)
11:02:18      sys_event_lb_vserver_state_change (lb_web → UP)

What it means:
- "newnslog" is a binary ring buffer of every counter and event.
- "-d event" mode prints the event log entries (state-change
  notifications, anomalies).
- Excellent for post-mortem: see exactly what flapped and when,
  with sub-second timestamps.` },

  { cmd: 'stat ns',
    example: `> stat ns

NetScaler Statistics — global
        Throughput (Mbps)        : 1840
        HTTP Requests/sec        : 4502
        HTTP Responses/sec       : 4500
        SSL Transactions/sec     : 2101
        Active Conns - Client    : 8,502
        Active Conns - Server    : 7,432
        TCP Resets sent          : 142
        Memory Usage (%)         : 28
        CPU Usage  (%)           : 12

What it means:
- High-level dataplane health snapshot. First go-to during a
  performance complaint.
- "TCP Resets sent" rising rapidly = something is killing connections
  (rate-limit, ACL, surge protection). Drill into responder/AppQoE
  policy stats next.
- CPU + memory : aggregate across all PEs. Sustained >70% needs
  investigation; >90% is critical.` }
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
