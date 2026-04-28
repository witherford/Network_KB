// Add NetScaler vserver/VIP hit-counter troubleshooting commands.
// New section: "VIP Hit Counter Troubleshooting" on the existing
// `netscaler` platform.
//
// Run: node scripts/expand-commands-5.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS = data.platforms.netscaler;
if (!NS) throw new Error('netscaler platform missing');

NS.sections['VIP Hit Counter Troubleshooting'] ||= [];
const existing = new Set(NS.sections['VIP Hit Counter Troubleshooting'].map(c => c.cmd));

const cmds = [
  // ---- Live per-vserver counters ----
  { cmd: 'stat lb vserver',
    desc: 'Summary statistics for every load-balancing vserver: hits, requests/sec, established connections, response-time. First place to look when a VIP "isn\'t getting traffic".', type: 'show' },
  { cmd: 'stat lb vserver <vsrv-name>',
    desc: 'Full counter set for one LB vserver — Hits, HitsRate, RequestsRate, ResponsesRate, EstablishedConn, BytesReceivedRate, AvgTTFB.', type: 'show' },
  { cmd: 'stat lb vserver <vsrv-name> -detail',
    desc: 'Verbose form: also shows per-service-binding hits, surge-queue depth, spillover counters.', type: 'show' },
  { cmd: 'stat lb vserver -summary',
    desc: 'One-line-per-vserver summary across the whole appliance (matches the GUI Dashboard view).', type: 'show' },
  { cmd: 'stat cs vserver',
    desc: 'Content-switching vserver counters — Hits per CS vserver. The "front door" for many deployments; check this before the LB vservers.', type: 'show' },
  { cmd: 'stat cs vserver <csvsrv-name>',
    desc: 'Single CS vserver detail incl. policy-hit breakdown.', type: 'show' },
  { cmd: 'stat cs policy',
    desc: 'Per-CS-policy hit counts. Use this to confirm which policy is steering traffic to which target LB vserver.', type: 'show' },
  { cmd: 'stat cs policy <policy>',
    desc: 'Single CS policy hits + bind-point counters.', type: 'show' },
  { cmd: 'stat ssl vserver <vsrv-name>',
    desc: 'SSL-offload vserver counters — TLS handshakes, alerts, session-reuse rate. Useful when client TLS issues show as "no hits on the LB".', type: 'show' },
  { cmd: 'stat aaa vserver',          desc: 'AAA vservers — auth attempts, success/fail counts.', type: 'show' },
  { cmd: 'stat vpn vserver',          desc: 'Gateway / VPN vserver counters — connected users, ICA proxy state, hits.', type: 'show' },
  { cmd: 'stat gslb vserver',         desc: 'GSLB vserver counters — DNS query hits per site/vserver. If a site is starved, check here first.', type: 'show' },
  { cmd: 'stat gslb vserver <name>',  desc: 'Single GSLB vserver detail (per-IP hits, MEP status).', type: 'show' },
  { cmd: 'stat cr vserver',           desc: 'Cache-redirection vserver counters.', type: 'show' },

  // ---- Service / service-group / monitor side ----
  { cmd: 'stat service',              desc: 'All backend services — hits, current connections, max-clients headroom.', type: 'show' },
  { cmd: 'stat service <svc>',        desc: 'Per-service detail. Cross-check vserver hits against backend hits to spot policy-stuck or surge-queue issues.', type: 'show' },
  { cmd: 'stat servicegroup',         desc: 'Service-group level counters; aggregates members.', type: 'show' },
  { cmd: 'stat servicegroup <sg>',    desc: 'Per-service-group counters incl. each member\'s hits.', type: 'show' },
  { cmd: 'stat lb monitor <mon>',     desc: 'Monitor probe stats — probes sent, failures. Failing monitors → service marked DOWN → vserver shows zero hits.', type: 'show' },
  { cmd: 'show service <svc>',        desc: 'Service config + UP/DOWN state + last state-change. The "why is this DOWN" command.', type: 'show' },
  { cmd: 'show servicegroup <sg>',    desc: 'Service-group config + per-member state.', type: 'show' },

  // ---- Policy hit counters (rewrite/responder/AppFW/AppQOE) ----
  { cmd: 'stat rewrite policy',       desc: 'Rewrite-policy hit counts. Confirms whether a rewrite is firing on the affected vserver.', type: 'show' },
  { cmd: 'stat rewrite policy <pol>', desc: 'Single rewrite policy detail.', type: 'show' },
  { cmd: 'stat responder policy',     desc: 'Responder-policy hits — useful when expected traffic is being silently responded-to or dropped.', type: 'show' },
  { cmd: 'stat responder policy <pol>', desc: 'Single responder policy detail.', type: 'show' },
  { cmd: 'stat appfw policy <pol>',   desc: 'AppFW-policy hit counts + violations.', type: 'show' },
  { cmd: 'stat appqoe policy',        desc: 'App-QoE policy hits (priority queueing, surge protection).', type: 'show' },
  { cmd: 'stat ns acl',               desc: 'Global ACL hit counters.', type: 'show' },
  { cmd: 'stat ns acl6',              desc: 'Global IPv6 ACL hit counters.', type: 'show' },
  { cmd: 'stat ns simpleacl',         desc: 'Simple-ACL counters (line-rate ACLs).', type: 'show' },

  // ---- Real-time counter watching ----
  { cmd: 'nsconmsg -K newnslog -d current -g vserver_hits_rate',
    desc: 'Live real-time view of every vserver\'s hits-per-second from the NetScaler kernel counter ring. Run from BSD shell (after "shell" command).', type: 'troubleshooting' },
  { cmd: 'nsconmsg -K newnslog -d current -g requests_rate',
    desc: 'Live request-rate view across all vservers.', type: 'troubleshooting' },
  { cmd: 'nsconmsg -K newnslog -d statswt0 -g vsvr_hits',
    desc: 'Continuously watch vserver_hits counters (refreshes every 7 sec, the default newnslog interval).', type: 'troubleshooting' },
  { cmd: 'nsconmsg -K newnslog -s ConLb=2 -d oldconmsg',
    desc: 'Aggregate vserver hits from the historical newnslog ring buffer — no live capture needed.', type: 'troubleshooting' },
  { cmd: 'nsconmsg -K newnslog -d setime -s totalcount=2000 -g vserver',
    desc: 'Show timestamped vserver counters with explicit sample count — use to correlate hit drops with timestamps in /var/log/ns.log.', type: 'troubleshooting' },
  { cmd: 'nsconmsg -K /var/nslog/newnslog -d past -s ConLb=2 -g vsvr_tot_hits',
    desc: 'Replay total vserver hits from a saved newnslog file (post-incident analysis).', type: 'troubleshooting' },

  // ---- Per-vserver session / connection table ----
  { cmd: 'show ns connectiontable -filter "Vsvr == 10.0.0.10:443"',
    desc: 'List every connection landing on a specific VIP — proves traffic is reaching the appliance even when "stat lb vserver" hits look low.', type: 'troubleshooting' },
  { cmd: 'show ns connectiontable -filter "VsvrName == web-vs"',
    desc: 'Same as above but filtered by vserver name.', type: 'troubleshooting' },
  { cmd: 'show ns conntable | grep <vip>',
    desc: 'Quick BSD-shell variant when you only need a count of in-flight connections for a VIP.', type: 'troubleshooting' },
  { cmd: 'stat ns connectiontable',   desc: 'Aggregate connection-table counters: total flows, surge-queue, half-open.', type: 'show' },

  // ---- Packet capture / flow tracing scoped to one VIP ----
  { cmd: 'start nstrace -size 0 -filter "VSVRIP == 10.0.0.10 && VSVRPORT == 443" -mode TXB',
    desc: 'Capture only traffic destined to a single VIP (VSVRIP filter is the cleanest way to isolate one vserver). -size 0 = full packets, -mode TXB = decrypt with private key when available.', type: 'troubleshooting' },
  { cmd: 'stop nstrace',              desc: 'Stop the running capture; produces a .cap in /var/nstrace/.', type: 'troubleshooting' },
  { cmd: 'show nstrace',              desc: 'Status of any running nstrace capture.', type: 'show' },
  { cmd: 'shell tail -f /var/log/ns.log | grep <vip>',
    desc: 'Watch ns.log for syslog events tied to a specific VIP (state changes, monitor flaps).', type: 'troubleshooting' },
  { cmd: 'shell tail -f /var/log/newnslog',
    desc: 'Tail the binary newnslog ring (output is binary; pipe through nsconmsg to render).', type: 'troubleshooting' },

  // ---- Counter reset (used carefully) ----
  { cmd: 'clear ns stats',
    desc: 'Reset ALL appliance counters (vserver hits, services, policies, SSL, etc.). Use to baseline before/after a change.', type: 'troubleshooting', flagged: true },
  { cmd: 'clear lb vserver <vsrv-name>',
    desc: 'Clear stats for a single LB vserver only.', type: 'troubleshooting' },
  { cmd: 'clear cs vserver <csvsrv-name>',
    desc: 'Clear stats for a single CS vserver only.', type: 'troubleshooting' },
  { cmd: 'clear ns connectiontable',
    desc: 'Drop all entries from the in-memory connection table — disruptive; resolves stuck flows.', type: 'troubleshooting', flagged: true },

  // ---- Common "why aren\'t hits incrementing" probes ----
  { cmd: 'show lb vserver <vsrv-name>',
    desc: 'Vserver state (UP / DOWN / OUT OF SERVICE) + bound services and current effective state. A DOWN vserver records zero hits.', type: 'show' },
  { cmd: 'show ns ip <vip>',
    desc: 'Confirm the VIP is configured and ARP-eligible. A typo or missing -arp ENABLED stops all hits cold.', type: 'show' },
  { cmd: 'show ns arp <vip>',
    desc: 'Confirm the VIP has an ARP entry — if upstream switch hasn\'t learned it, traffic never arrives.', type: 'show' },
  { cmd: 'show route <vip>',
    desc: 'Confirm reverse path back to the client; missing static route = SYN/ACKs blackhole and hits stay low.', type: 'show' },
  { cmd: 'show ns runningconfig | grep -i <vsrv-name>',
    desc: 'Pull the full config block for the vserver — bindings, policies, persistence, listen policy. Quick sanity check.', type: 'show' },
  { cmd: 'show ns listenpolicy',
    desc: 'List listen-policies. A misfiring listen-policy on a wildcard vserver siphons hits away from the expected one.', type: 'show' },
  { cmd: 'show appflow',
    desc: 'AppFlow / IPFIX export config. If counters look right but reporting/MAS shows zero, the export side may be broken.', type: 'show' },

  // ---- Per-vserver counter polling via NITRO (for dashboards) ----
  { cmd: 'curl -k -u <user>:<pwd> https://<nsip>/nitro/v1/stat/lbvserver/<name>',
    desc: 'NITRO REST stat endpoint — JSON response with all counters, suitable for Prometheus/Grafana exporters.', type: 'show' },
  { cmd: 'curl -k -u <user>:<pwd> https://<nsip>/nitro/v1/stat/lbvserver',
    desc: 'NITRO bulk stat for every LB vserver in one call.', type: 'show' },
  { cmd: 'curl -k -u <user>:<pwd> https://<nsip>/nitro/v1/stat/csvserver/<name>',
    desc: 'NITRO stat endpoint for a CS vserver.', type: 'show' },
  { cmd: 'curl -k -u <user>:<pwd> "https://<nsip>/nitro/v1/stat/lbvserver/<name>?statbindings=yes"',
    desc: 'NITRO call returning per-bound-service hit counters alongside the vserver totals.', type: 'show' }
];

let added = 0;
for (const c of cmds) {
  if (existing.has(c.cmd)) continue;
  existing.add(c.cmd);
  NS.sections['VIP Hit Counter Troubleshooting'].push({
    cmd: c.cmd, desc: c.desc, type: c.type || 'show', flagged: c.flagged || false
  });
  added++;
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

const MAN = path.resolve('data/manifest.json');
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log('Added', added, 'commands to NetScaler VIP Hit Counter Troubleshooting');
console.log('Section now has', NS.sections['VIP Hit Counter Troubleshooting'].length, 'commands');
