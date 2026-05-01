// NetScaler enrichment batch 2:
//   - GSLB (9 entries)
//   - High Availability (9 entries)
//   - Rate Limiting (5 entries)
// Adds rich example outputs with per-field "What it means" annotations.

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ENTRIES = [
  // ============== GSLB ==============
  { cmd: 'add gslb site <name> <ip>',
    example: `> add gslb site DC_London 10.50.1.5 -siteType LOCAL -metricExchange ENABLED -nwMetricExchange ENABLED
Done

> show gslb site
Site Name : DC_London
        Site Type           : LOCAL
        Site IP             : 10.50.1.5
        Public IP           : 10.50.1.5
        Metric Exchange     : ENABLED
        Status              : ACTIVE

What it means:
- "siteType LOCAL" means the GSLB instance physically lives at this
  ADC. "REMOTE" sites describe peer ADCs in other datacentres.
- The site IP is the SNIP through which Metric Exchange Protocol
  (MEP) talks to peer GSLB sites — opens TCP/3011.
- metricExchange/nwMetricExchange : enables sharing of LB stats and
  network RTT data between sites for intelligent decisions.` },

  { cmd: 'add gslb vserver <name> <protocol>',
    example: `> add gslb vserver GSLB_VS SSL -dnsRecordType A -lbMethod LEASTCONNECTION
Done

> show gslb vserver
Name : GSLB_VS
        State              : UP
        Effective State    : UP
        Type               : SSL
        DNS Record Type    : A
        LB Method          : LEASTCONNECTION
        Persistence        : NONE
        Bound Services     : 0

What it means:
- The GSLB vserver is a logical container — it holds the FQDN, the
  load-balancing method, and the list of GSLB services (one per DC).
- dnsRecordType : A for IPv4, AAAA for IPv6, MX for mail, etc.
- lbMethod      : ROUNDROBIN, LEASTCONNECTION, RTT, STATICPROXIMITY,
                  DYNAMICCONNECTION, etc. Drives which back-end site
                  gets returned to a DNS query.
- "Bound Services 0" — vserver is not yet wired up; bind GSLB
  services next.` },

  { cmd: 'add gslb service <name> <server-ip> <protocol> <port> -siteName <site>',
    example: `> add gslb service GSLB_SVC_Web1 10.10.10.50 SSL 443 -siteName DC_London -publicIP 203.0.113.10 -publicPort 443 -monitorBound HTTP-ECV
Done

> show gslb service
Name             : GSLB_SVC_Web1
        IP Address       : 10.10.10.50:443 (SSL)
        Public IP:Port   : 203.0.113.10:443
        Site Name        : DC_London
        State            : UP
        Last Reason      : Probe Successful

What it means:
- The "service IP" is the back-end LB VIP at the local DC.
- "publicIP/publicPort" is what GSLB returns to DNS clients — the
  externally-routable VIP. Often equals the service IP if no NAT is
  in the way.
- Monitor binding (HTTP-ECV here) decides whether the service is
  considered UP for GSLB-decision purposes.` },

  { cmd: 'bind gslb vserver <name> -serviceName <service>',
    example: `> bind gslb vserver GSLB_VS -serviceName GSLB_SVC_Web1
Done
> bind gslb vserver GSLB_VS -serviceName GSLB_SVC_Web2
Done

> show gslb vserver GSLB_VS
        Bound Services     : 2
            GSLB_SVC_Web1 (DC_London)  : UP
            GSLB_SVC_Web2 (DC_NewYork) : UP

What it means:
- Multiple GSLB services bind to a single GSLB vserver — each
  represents a copy of the application running in a different DC.
- The vserver's lbMethod chooses BETWEEN them on each DNS query
  (e.g. RTT picks the closest to the resolver).` },

  { cmd: 'set gslb vserver <name> -lbMethod ROUNDROBIN',
    example: `> set gslb vserver GSLB_VS -lbMethod ROUNDROBIN
Done

> show gslb vserver GSLB_VS | grep Method
        LB Method          : ROUNDROBIN

What it means:
- ROUNDROBIN cycles GSLB services in order on each DNS request.
- Simple, predictable, no telemetry needed.
- DOES NOT account for server load, DC capacity, or RTT — fine for
  active-active sites of equal weight, weak choice for DR scenarios.` },

  { cmd: 'set gslb vserver <name> -lbMethod RTT',
    example: `> set gslb vserver GSLB_VS -lbMethod RTT
Done

# DNS query from London resolver:
$ dig www.global.com
;; ANSWER SECTION:
www.global.com.   60   IN   A   203.0.113.10   ← DC_London VIP

# DNS query from NY resolver:
$ dig www.global.com
;; ANSWER SECTION:
www.global.com.   60   IN   A   198.51.100.10   ← DC_NewYork VIP

What it means:
- RTT mode measures Round Trip Time from the LDNS (resolver) to
  each candidate site, then returns the closest.
- Requires the ADCs to actively probe LDNSes (LDNS Probe Order).
- Best general-purpose method for global active-active deployments.
- First few queries from a new LDNS may use a fallback method while
  RTT data is being gathered.` },

  { cmd: 'show gslb runningconfig',
    example: `> show gslb runningconfig

add gslb site DC_London 10.50.1.5 -siteType LOCAL
add gslb site DC_NewYork 10.60.1.5 -siteType REMOTE
add gslb service GSLB_SVC_Web1 10.10.10.50 SSL 443 -siteName DC_London
add gslb service GSLB_SVC_Web2 10.10.20.50 SSL 443 -siteName DC_NewYork
add gslb vserver GSLB_VS SSL -dnsRecordType A -lbMethod RTT
bind gslb vserver GSLB_VS -serviceName GSLB_SVC_Web1
bind gslb vserver GSLB_VS -serviceName GSLB_SVC_Web2
add gslb domain GSLB_VS www.global.com

What it means:
- Filtered runningConfig containing ONLY GSLB-related statements.
- Useful for diffing GSLB config between two ADCs in the same domain
  before running "sync gslb config".
- Does not include underlying LB/SSL/networking that the GSLB
  services depend on.` },

  { cmd: 'sync gslb config -preview',
    example: `> sync gslb config -preview

Sync preview - changes that would be pushed to remote sites:

  add gslb service GSLB_SVC_Web3 10.10.30.50 SSL 443 -siteName DC_Tokyo
  bind gslb vserver GSLB_VS -serviceName GSLB_SVC_Web3
  set gslb parameter -ldnsProbOrder TCP PING DNS

What it means:
- Dry-run of "sync gslb config" — shows the diff that would be
  applied to other GSLB sites, without making any changes.
- Always run preview FIRST in production before the real sync.
- Sync is bidirectional: changes from remote sites would also be
  pulled in by the next sync from those sites.` },

  { cmd: 'sync gslb config',
    example: `> sync gslb config
Are you sure you want to overwrite the GSLB config on remote sites? [Y/N] Y
Sending config to DC_NewYork (10.60.1.5)... Done
Sending config to DC_Tokyo   (10.70.1.5)... Done
GSLB sync completed: 2 sites updated, 0 errors

What it means:
- Pushes the local GSLB-feature config to every remote GSLB site
  defined in this site's "show gslb site" list.
- Site-to-site sync uses TCP/3010 (sync protocol).
- DESTRUCTIVE on remote sites — they get overwritten with this
  site's view. Use -preview first, and only run from your designated
  "master" site.` },

  // ============== High Availability ==============
  { cmd: 'show ha node <node-id>',
    example: `> show ha node 1

1)      Node ID:        1
        IP:             10.10.10.11
        Node State:     UP
        Master State:   Secondary
        SSL Card Status: UP
        Sync State:     ENABLED  (SUCCESS)
        Hello Interval: 200 msec
        Dead Interval:  3 sec
        Last Transition Time: Wed May  1 09:22:10 2026

What it means:
- Node State UP : the peer is reachable on the HA heartbeat.
- Master State : Primary or Secondary. The one currently servicing
  VIPs is Primary.
- Sync State SUCCESS : config sync between nodes is current. ENABLED
  + FAILED would be a serious problem worth investigating immediately.
- Hello/Dead intervals : the heartbeat tuning. Defaults work fine on
  L2-adjacent pairs.` },

  { cmd: 'add ha node <id> <ip>',
    example: `> add ha node 1 10.10.10.11
Done

> show ha node
1)      Node ID: 0  IP: 10.10.10.10  State: UP  Master State: Primary
2)      Node ID: 1  IP: 10.10.10.11  State: UP  Master State: Secondary

What it means:
- Adds a peer node to this ADC's HA cluster. Run on BOTH nodes — each
  must add the other.
- Initial sync starts immediately. Watch "show ha node" for sync
  state to settle.
- Pre-requisites: rpcNode passwords must match between the two
  nodes (see "set ns rpcNode") or sync will fail with auth errors.` },

  { cmd: 'set ha node -haStatus ENABLED',
    example: `> set ha node -haStatus ENABLED
Done

> show ha node | include haStatus
        HA Status: ENABLED

What it means:
- Default state. Node participates in HA election and can become
  Primary if the peer goes down.
- Compare with STAYSECONDARY (never become primary, even if peer
  is down) and STAYPRIMARY (always primary).` },

  { cmd: 'set ha node -haStatus STAYSECONDARY',
    example: `> set ha node -haStatus STAYSECONDARY
Done

# This node will NEVER take over, even if the peer is DOWN.
> show ha node 0 | grep "Master State"
        Master State:   Secondary

What it means:
- Node refuses to ever become Primary, even if its peer disappears.
- Used during planned maintenance on the secondary so a network
  blip doesn't cause it to take over halfway through an upgrade.
- IMPORTANT: returns to ENABLED automatically only on reboot;
  remember to revert with "set ha node -haStatus ENABLED" afterwards.` },

  { cmd: 'sync ha files all',
    example: `> sync ha files all
Sending files to peer 10.10.10.11...
  /nsconfig/ssl/server.crt        ... ok
  /nsconfig/ssl/server.key        ... ok
  /nsconfig/ssl/intermediate.pem  ... ok
  /var/download/license/Plat.lic  ... ok
Sync completed. 47 files transferred, 0 errors.

What it means:
- Forces an immediate sync of NON-config files (SSL certs/keys, DH
  params, license files, custom bot signatures, custom AppFW data,
  etc.) from this node to the peer.
- Configuration sync runs continuously when "Sync State: ENABLED"
  but file sync only runs on this command (or after a failover).
- "all" includes every syncable file. Specific subsets: "ssl",
  "imports", "misc".` },

  { cmd: 'show ha sync',
    example: `> show ha sync

HA Synchronization Status:
        State                     : ENABLED
        Last sync attempt         : Wed May  1 11:22:18 2026
        Last sync result          : SUCCESS
        Failover engine sync count: 1845
        Last failover at          : Mon Apr 28 14:20:33 2026

What it means:
- Confirms config sync is actively running between the HA pair and
  reporting healthy.
- "Last sync result: SUCCESS" should be steady-state. FAILED almost
  always means rpcNode password mismatch or network reachability
  between NSIPs.
- Failover engine sync count : how many config diffs have been
  pushed to the peer over the lifetime of the HA pair.` },

  { cmd: 'add clusternode <id> -ip <ip> -backplane <interface>',
    example: `> add clusternode 1 -ip 10.10.10.11 -backplane 1/1
Cluster instance does not exist. Please add cluster instance first.

# Configure cluster on the CLIP first:
> add cluster instance 1 -clusterIP 10.10.10.50
> enable cluster instance 1
> add clusternode 1 -ip 10.10.10.11 -backplane 1/1
Done

What it means:
- Cluster mode is the n-node alternative to 2-node HA.
- "backplane 1/1" : the dedicated interface used for cluster control
  traffic and steering. MUST be on a separate physical link to avoid
  splits.
- Each node ID is unique within the cluster. CLIP is the cluster
  management IP — used for config and management of the whole cluster
  as one entity.` },

  { cmd: 'join cluster -clip <cluster-ip> -password <pass>',
    example: `> join cluster -clip 10.10.10.50 -password ClusterSecret2026
Successfully joined cluster instance 1
Node id: 2
Restoring cluster configuration on this node...
Done. Reboot recommended.

What it means:
- Run on a NEW node to enrol it into an existing cluster. The CLIP
  is the cluster-wide management IP; the password is the shared
  cluster instance password.
- After joining, the node receives the full cluster config from
  the master via the backplane.
- Reboot is recommended (not strictly required) so dataplane
  state is fully aligned with the rest of the cluster.` },

  { cmd: 'show cluster',
    example: `> show cluster

Cluster Information:
        Cluster ID                : 1
        CLIP                      : 10.10.10.50
        Cluster Health            : OK
        Quorum Type               : MAJORITY
        Backplane Steering        : MAC-Based

Cluster Nodes:
        ID   IP            State    Health    Master  Op-State
        0    10.10.10.10   ACTIVE   OK        Yes     Active
        1    10.10.10.11   ACTIVE   OK        No      Active
        2    10.10.10.12   ACTIVE   OK        No      Active

What it means:
- Cluster Health OK : all members reachable on the backplane and
  config-synced.
- Quorum Type MAJORITY : default — needs (N/2 + 1) nodes alive to
  remain operational.
- Master flag : the cluster master coordinates config and steering;
  losing it triggers a re-election among remaining nodes.
- Op-State Active : node is forwarding traffic. INACTIVE = drained
  (still in cluster but not handling traffic).` },

  // ============== Rate Limiting ==============
  { cmd: 'add stream identifier <name> HTTP.REQ.URL -type REQUEST -interval 1 -sampleCount 1',
    example: `> add stream identifier ID_PerURL HTTP.REQ.URL -type REQUEST -interval 1 -sampleCount 1
Done

> show stream identifier
Name : ID_PerURL
        Selector Rule       : HTTP.REQ.URL
        Type                : REQUEST
        Sample Time         : 1 sec
        Sample Count        : 1
        Sort By             : ResponseTime

What it means:
- Stream identifiers count events grouped by the selector key (here
  HTTP.REQ.URL — i.e. one bucket per unique URL).
- type REQUEST : count by inbound request. Other types: RESPONSE,
  RESPONSEONLY (count only when application replied), MIRROR.
- interval 1 / sampleCount 1 : 1 second sliding window with 1 sample.
  Smaller windows react faster but use more memory.
- Used as input to action policies (responder, AppQoE) to throttle
  on per-URL request rate.` },

  { cmd: 'set stream identifier <name> -selectorName <selector> -interval <secs>',
    example: `> add stream selector Sel_ClientIP HTTP.REQ.CLIENT.IP
> set stream identifier ID_PerURL -selectorName Sel_ClientIP -interval 60
Done

> show stream identifier ID_PerURL
        Selector Name : Sel_ClientIP
        Sample Time   : 60 sec

What it means:
- Switches the stream identifier from a bare expression to a named
  "stream selector" (allows multi-key selectors that are reusable
  across multiple identifiers).
- 60-second window smooths out short bursts but reacts more slowly
  to sustained attacks. Common values: 1s for DoS detection, 60s
  for client-fairness throttling.` },

  { cmd: 'add ns limitIdentifier <name> -threshold <n> -timeSlice 1000 -mode REQUEST_RATE',
    example: `> add ns limitIdentifier limit_login -threshold 5 -timeSlice 1000 -mode REQUEST_RATE -limitType BURSTY -selectorName Sel_ClientIP
Done

> show ns limitIdentifier limit_login
Name : limit_login
        Mode               : REQUEST_RATE
        Threshold          : 5
        Time Slice         : 1000 ms
        Limit Type         : BURSTY
        Selector           : Sel_ClientIP
        Current matches    : 12

What it means:
- Threshold + Time Slice define a token bucket: 5 requests per
  1000 ms (= 1 second) per selector key.
- mode REQUEST_RATE : counts requests. Alternative: CONNECTION (TCP
  connections per second).
- limitType BURSTY : allows short bursts above threshold then refills.
  SMOOTH would enforce strict rate over the window.
- Pair with a responder policy that calls sys.check_limit("limit_login")
  to take action (DROP, RESET, RESPONDWITH).` },

  { cmd: 'add responder policy <name> sys.check_limit("<limitID>") DROP',
    example: `> add responder policy pol_throttle_login 'sys.check_limit("limit_login")' DROP
Done

> bind responder global pol_throttle_login 100 END -type REQ_OVERRIDE
Done

# At runtime, sixth+ login attempt within 1s from same client IP is dropped:
> show ns limitIdentifier limit_login
        Threshold exceeded count   : 142
        Action                     : DROP

What it means:
- Wires the rate-limit identifier to a responder policy.
- sys.check_limit() returns TRUE when the request would push the
  bucket over threshold — at which point the policy fires.
- DROP silently discards the packet (TCP connection times out).
  Alternatives: RESET (TCP RST), RESPONDWITH (custom error page).
- bind ... type REQ_OVERRIDE : evaluated BEFORE the matched LB
  decision so legitimate requests aren't impacted.` },

  { cmd: 'show stream identifier <name>',
    example: `> show stream identifier ID_PerURL

Name             : ID_PerURL
        Selector Rule         : HTTP.REQ.URL
        Type                  : REQUEST
        Sample Time           : 1 sec
        Sample Count          : 1

Top entries:
        Key                                    Hits      Rate (req/s)
        /api/login                             4502      75
        /api/search                            12039     201
        /static/logo.png                       8901      148

What it means:
- Top-N table of selector-key buckets currently being tracked.
- "Rate" is the smoothed rate over the configured window — what
  responder/AppQoE policies see in sys.check_limit().
- Useful for tuning thresholds: see real traffic distribution
  before setting "threshold N" in a limitIdentifier.` }
];

// ---------------------- Apply ----------------------
let updated = 0, alreadyHad = 0, notFound = 0;

for (const e of ENTRIES) {
  let found = null;
  for (const arr of Object.values(NS.sections)) {
    for (const c of arr) {
      if (c.cmd === e.cmd) { found = c; break; }
    }
    if (found) break;
  }
  if (!found) {
    console.warn('  (not found):', e.cmd);
    notFound++;
    continue;
  }
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
