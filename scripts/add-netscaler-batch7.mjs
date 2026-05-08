// NetScaler enrichment batch 7:
//  - show vpn icaConnection (summary + detailed)
//  - disable/enable ns ip
//  - set ns ip ... -arp ENABLED/DISABLED
// Skips duplicates (e.g. disable/enable lb vserver already present).

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const NS   = data.platforms.netscaler;

const ADDITIONS = [
  {
    section: 'AAA & Authentication',
    cmd: 'show vpn icaConnection -summary',
    desc: 'Tabular summary of active ICA Proxy sessions through NetScaler Gateway: user, transport, domain, client IP/port and back-end XenApp/XenDesktop IP/port.',
    type: 'show',
    flagged: false,
    example:
`> show vpn icaConnection -summary

---------------------------------------------------------------------------------------------------------------------------
      User       TransType Domain             ClientIP          ClientPort XenAppXenDesktopIP     XenAppXenDesktopPort
---------------------------------------------------------------------------------------------------------------------------
1     <username>     TCP       <domain>             10.46.255.88      57014      10.112.1.126           2598
2     <username>     TCP       <domain>             10.46.255.88      59777      10.112.1.41            2598
3     <username>     TCP       <domain>             10.46.255.88      51175      10.112.1.128           2598
4     <username>     TCP       <domain>             10.46.255.88      62944      10.112.1.47            2598

What it means:
- One row per live ICA/HDX session being proxied by NetScaler Gateway.
- TransType TCP : classic ICA over TCP (port 1494) or Common Gateway Protocol (2598 = Session Reliability).
- ClientIP / ClientPort : the source seen by the ADC (typically the user's NAT or VPN-assigned address).
- XenApp/XenDesktop IP/Port : the back-end VDA the session is brokered to.
- Use the summary view to quickly count active sessions per VDA or per client subnet during capacity / incident triage.`
  },

  {
    section: 'AAA & Authentication',
    cmd: 'show vpn icaConnection',
    desc: 'Detailed view of active ICA Proxy sessions through NetScaler Gateway, including per-cluster-node breakdown when run on a clustered ADC.',
    type: 'show',
    flagged: false,
    example:
`> show vpn icaConnection      (clustered ADC)

Node Id: 1
Node Id: 2
1)      User name: <username>       Domain name: <domain>
        Client IP(Client Port): 10.46.255.88(57014)
        XenApp/XenDesktop IP(XenApp/XenDesktop Port): 10.112.1.126(2598)

What it means:
- Verbose form of the icaConnection table — each session printed as a multi-line block instead of the tabular -summary view.
- On a cluster, output is grouped by Node Id so you can see which cluster node is owning each session (useful when troubleshooting steered/striped traffic).
- Pair with "show vpn icaConnection -summary" for fast counts and "stat vpn vserver" for aggregate gateway stats.`
  },

  {
    section: 'Networking',
    cmd: 'disable ns ip <ip address>',
    desc: 'Administratively disable a configured NetScaler IP (NSIP/SNIP/VIP/MIP) without removing it from configuration. Equivalent to "set ns ip <ip> -state DISABLED".',
    type: 'config',
    flagged: false,
    example:
`> disable ns ip 10.10.10.11
Done

> show ns ip 10.10.10.11
IP                  Type   Mode    State       VLAN
10.10.10.11         SNIP   Active  Disabled    1

What it means:
- Marks the IP as administratively down: the ADC stops responding on it (no ARP, no L4 traffic), but the configuration is preserved.
- Useful for staged migrations or temporarily pulling a SNIP/VIP without "rm ns ip" + re-adding.
- Disabling an NSIP is supported but will sever management on that interface — verify you have an alternate management path first.`
  },

  {
    section: 'Networking',
    cmd: 'enable ns ip <ip address>',
    desc: 'Re-enables a previously disabled NetScaler IP. Equivalent to "set ns ip <ip> -state ENABLED".',
    type: 'config',
    flagged: false,
    example:
`> enable ns ip 10.10.10.11
Done

> show ns ip 10.10.10.11
IP                  Type   Mode    State      VLAN
10.10.10.11         SNIP   Active  Enabled    1

What it means:
- Brings a disabled IP back into service. ARP responses resume and bound vservers / SNIP-sourced flows can use it again.
- Pair with "save ns config" to persist the change across reboots.
- If the IP fails to come up, check VLAN/interface state ("show vlan", "show interface") — the IP is bound to an L2 segment that must also be UP.`
  },

  {
    section: 'Networking',
    cmd: 'set ns ip <ip address> -arp ENABLED',
    desc: 'Enables ARP responses for the specified NetScaler IP so the ADC replies to ARP requests for it on its bound VLAN.',
    type: 'config',
    flagged: false,
    example:
`> set ns ip 10.0.0.10 -arp ENABLED
Done

> show ns ip 10.0.0.10
IP            Type   Mode    State    VLAN  Options
10.0.0.10     VIP    Active  Enabled  100   ARP=ENABLED, ICMP=ENABLED

What it means:
- ARP must be ENABLED for the ADC to be reachable at this IP from the local L2 segment — without it, upstream routers/switches will never resolve the MAC.
- This is the default for new IPs; you'd only re-enable it after a deliberate disable (HA-AA designs, Direct Server Return, or anycast topologies).
- For floating VIPs in active/active clusters, ARP is owned by the striped/spotted node — flipping ARP back on without coordinating with cluster ownership can cause duplicate-IP alarms.`
  },

  {
    section: 'Networking',
    cmd: 'set ns ip <ip address> -arp DISABLED',
    desc: 'Suppresses ARP responses for the specified NetScaler IP. The IP remains configured but the ADC will not answer ARP requests for it.',
    type: 'config',
    flagged: false,
    example:
`> set ns ip 10.0.0.10 -arp DISABLED
Done

> show ns ip 10.0.0.10
IP            Type   Mode    State    VLAN  Options
10.0.0.10     VIP    Active  Enabled  100   ARP=DISABLED

What it means:
- Stops the ADC answering ARP for this IP — used when another device (HA peer, upstream router, anycast neighbour) must own L2 reachability for the address.
- Common scenarios: Direct Server Return (loopback VIP on backend that mustn't ARP), striped cluster IPs owned by a single node, or quiescing a VIP without changing routing.
- Disabling ARP on the only path to a SNIP/NSIP will black-hole traffic — verify the alternate ARP responder is live before applying.`
  },
];

let added = 0, skipped = 0;
for (const e of ADDITIONS) {
  // Skip if any existing cmd matches exactly (case-insensitive) anywhere in NS sections
  let dup = false;
  for (const arr of Object.values(NS.sections)) {
    if (arr.some(c => c.cmd && c.cmd.toLowerCase() === e.cmd.toLowerCase())) { dup = true; break; }
  }
  if (dup) { console.log('  (duplicate, skipped):', e.cmd); skipped++; continue; }
  if (!NS.sections[e.section]) { console.warn('  (section not found):', e.section); continue; }
  const { section, ...entry } = e;
  NS.sections[section].push(entry);
  added++;
  console.log('  added [' + section + ']:', e.cmd);
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log('\nAdded:   ' + added);
console.log('Skipped: ' + skipped);
