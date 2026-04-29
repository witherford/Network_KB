// Populate example output + richer descriptions for the 45 BGP commands
// supplied by the user. Targets the BGP sections of three Cisco platforms:
//   ciscoios · ciscoiosxe_sw · ciscoiosxe_router
//
// Strategy:
//   - For each entry, try a list of `matches` (existing cmd strings) in
//     order. Attach example + (optionally) overwrite description on the
//     first match found in each platform's BGP section.
//   - When NO match is found in a platform AND the entry is marked
//     `addIfMissing: true`, add a new BGP-section entry using `cmd`.
//   - Idempotent on re-run.
//
// Run: node scripts/add-bgp-examples.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/commands.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const TARGETS = ['ciscoios', 'ciscoiosxe_sw', 'ciscoiosxe_router'];

// Each entry — `matches` is searched in order against existing BGP cmds.
// `cmd` / `desc` / `type` are used when adding a new entry.
const ENTRIES = [
  // 1
  { cmd: 'router bgp <AS-Number>',
    matches: ['router bgp 65001', 'router bgp as-number'],
    desc: 'Enter BGP configuration mode for the specified Autonomous System.',
    example: '(config)# router bgp 65001\n(config-router)#',
    type: 'config'
  },
  // 2
  { cmd: 'neighbor <IP> remote-as <AS-Number>',
    matches: ['neighbor 1.2.3.4 remote-as 65002', 'neighbor ip-address remote-as as-number'],
    desc: 'Define a BGP neighbor and its AS. Same AS as local = iBGP; different AS = eBGP.',
    example: '(config-router)# neighbor 10.0.0.2 remote-as 65002',
    type: 'config'
  },
  // 3
  { cmd: 'network <network-address> mask <subnet-mask>',
    matches: ['network 10.0.0.0 mask 255.255.255.0', 'network network-mask subnet-mask [route-map]'],
    desc: 'Tell BGP to advertise a specific network. The route must already exist in the RIB to be advertised.',
    example: '(config-router)# network 192.168.10.0 mask 255.255.255.0',
    type: 'config'
  },
  // 4
  { cmd: 'neighbor <IP> next-hop-self',
    matches: ['neighbor 1.2.3.4 next-hop-self'],
    desc: '(iBGP) Force the router to list its own IP as the next-hop when advertising routes to internal peers.',
    example: '(config-router)# neighbor 10.1.1.1 next-hop-self',
    type: 'config'
  },
  // 5
  { cmd: 'aggregate-address <address> <mask> summary-only',
    matches: ['aggregate-address 10.0.0.0 255.0.0.0 summary-only', 'aggregate-address network subnet-mask [summary-only] [as-set]'],
    desc: 'Create a summary route and suppress the specific component routes from being advertised.',
    example: '(config-router)# aggregate-address 172.16.0.0 255.255.0.0 summary-only',
    type: 'config'
  },
  // 6 — show ip bgp summary already has an example, but the user-supplied one is more compact; keep existing.
  // 7 — show ip bgp already has an example. Skip.
  // 8
  { cmd: 'show ip bgp neighbors <IP> advertised-routes',
    matches: ['show ip bgp neighbors 1.2.3.4 advertised-routes', 'show bgp afi safi neighbors ip-address advertised routes'],
    desc: 'Show exactly what routes you are sending to a specific peer.',
    example: '   Network          Next Hop            Metric LocPrf Weight Path\n*> 10.50.1.0/24     0.0.0.0                  0         32768 i'
  },
  // 9
  { cmd: 'show ip bgp neighbors <IP> routes',
    matches: ['show ip bgp neighbors 1.2.3.4 routes'],
    desc: 'Show routes received from a neighbor that passed inbound filters and made it into the BGP table.',
    example: 'Total number of prefixes 2'
  },
  // 10
  { cmd: 'show ip bgp <network>',
    matches: ['show ip bgp 8.8.8.0/24', 'show bgp afi safi network prefix/prefix-length'],
    desc: 'Show detailed BGP attributes (Local Pref, MED, communities, AS-path) for a specific prefix.',
    example: `BGP routing table entry for 10.1.1.0/24, version 5
Paths: (1 available, best #1)
  65002
    10.0.0.2 from 10.0.0.2 (192.168.1.1)
      Origin IGP, metric 0, localpref 100, valid, external, best`
  },
  // 11
  { cmd: 'neighbor <IP> update-source <interface>',
    matches: ['neighbor 1.2.3.4 update-source Loopback0'],
    desc: 'Source the BGP TCP session from a loopback (or any nominated interface) instead of the physical egress IP. Essential for resilient iBGP / multi-link eBGP.',
    example: '(config-router)# neighbor 1.1.1.1 update-source Loopback0',
    type: 'config'
  },
  // 12
  { cmd: 'neighbor <IP> ebgp-multihop <count>',
    matches: ['neighbor 1.2.3.4 ebgp-multihop 5'],
    desc: 'Allow eBGP sessions between routers that are not directly connected (more than one hop apart).',
    example: '(config-router)# neighbor 10.20.20.1 ebgp-multihop 2',
    type: 'config'
  },
  // 13
  { cmd: 'neighbor <IP> route-map <NAME> in|out',
    matches: ['neighbor 1.2.3.4 route-map FROM-ISP in', 'neighbor 1.2.3.4 route-map TO-ISP out', 'neighbor ip-address route-map route-map-name {in|out}'],
    desc: 'Apply a route-map to filter or modify attributes of routes coming in (in) or going out (out).',
    example: '(config-router)# neighbor 10.0.0.2 route-map SET-PREF in',
    type: 'config'
  },
  // 14
  { cmd: 'neighbor <IP> prefix-list <NAME> in|out',
    matches: ['neighbor 1.2.3.4 prefix-list PEER-IN in'],
    desc: 'Filter routes based on IP prefix and length using a named prefix-list.',
    example: '(config-router)# neighbor 10.0.0.2 prefix-list ONLY-MY-NETS out',
    type: 'config'
  },
  // 15
  { cmd: 'clear ip bgp * soft',
    matches: ['clear ip bgp * soft', 'clear bgp afi safi {ip-address|*} soft [in | out]'],
    desc: 'Refresh the BGP table and re-apply policy on every peer WITHOUT dropping the underlying TCP session.',
    example: '# clear ip bgp * soft',
    type: 'troubleshooting'
  },
  // 16
  { cmd: 'address-family ipv6',
    matches: ['address-family ipv6 unicast'],
    desc: 'Enter the IPv6 address-family sub-mode to configure BGP for IPv6 prefixes.',
    example: '(config-router)# address-family ipv6',
    type: 'config'
  },
  // 17
  { cmd: 'neighbor <IP> activate',
    matches: ['neighbor ip-address activate'],
    desc: 'Used inside an address-family to enable the exchange of routes from THAT family with the named neighbour. Mandatory in MP-BGP — peers are NOT activated by default outside ipv4-unicast.',
    example: '(config-router-af)# neighbor 2001:db8::1 activate',
    type: 'config'
  },
  // 18
  { cmd: 'show bgp ipv6 unicast summary',
    matches: ['show bgp ipv6 unicast summary'],
    desc: 'IPv6 equivalent of "show ip bgp summary" — peer state, prefix counts, uptime per IPv6 BGP peer.',
    example: 'BGP router identifier 1.1.1.1, local AS number 65001\n... (output similar to IPv4)'
  },
  // 19
  { cmd: 'bgp router-id <IP>',
    matches: ['bgp router-id 1.1.1.1', 'bgp router-id router-id'],
    desc: 'Manually pin the BGP router-id (defaults to the highest loopback or interface IP). Pin it for stability.',
    example: '(config-router)# bgp router-id 1.1.1.1',
    type: 'config'
  },
  // 20
  { cmd: 'neighbor <IP> description <text>',
    matches: ['neighbor 1.2.3.4 description ISP-A primary'],
    desc: 'Add a free-text label to a neighbour for easier identification in show output and logs.',
    example: '(config-router)# neighbor 10.0.0.2 description LINK-TO-ISP-A',
    type: 'config'
  },
  // 21 — NEW
  { cmd: 'neighbor <IP> shutdown',
    desc: 'Administratively disable a neighbour without deleting any of its config (peering, policies, password, etc. all survive).',
    example: '(config-router)# neighbor 10.0.0.2 shutdown',
    type: 'config', addIfMissing: true
  },
  // 22
  { cmd: 'bgp log-neighbor-changes',
    matches: ['bgp log-neighbor-changes'],
    desc: 'Log every BGP neighbour state change to syslog (Up / Down / reset).',
    example: '(config-router)# bgp log-neighbor-changes',
    type: 'config'
  },
  // 23
  { cmd: 'show ip bgp community <value>',
    matches: ['show ip bgp community'],
    desc: 'Display all routes that carry a specific BGP community tag.',
    example: '*> 10.0.0.0/8       192.168.1.1              0    100      0 65100 i',
    addIfMissing: true
  },
  // 24 — NEW
  { cmd: 'show ip bgp dampening dampened-paths',
    desc: 'Show routes currently being suppressed by route-flap dampening.',
    example: '   Network          From            Reuse          Path\nq  172.16.5.0       10.0.0.2        00:15:20       65002 i',
    addIfMissing: true
  },
  // 25 — NEW
  { cmd: 'show ip bgp rib-failure',
    desc: 'Show prefixes BGP learned but could NOT install in the main RIB (usually because a better-distance protocol — OSPF, EIGRP, static — already owns the prefix).',
    example: 'Network            Next Hop                      RIB-failure   RIB-NH Matches\n10.5.5.0/24        10.0.0.2             Higher admin distance           n/a',
    addIfMissing: true
  },
  // 26 — NEW (route-map context)
  { cmd: 'set local-preference <value>',
    desc: 'Inside a route-map: set the LOCAL_PREF on matched routes. Higher = more preferred. Local-pref stays inside your AS — used to influence OUTBOUND traffic decisions among iBGP peers.',
    example: '(config-route-map)# set local-preference 200',
    type: 'config', addIfMissing: true
  },
  // 27 — NEW (route-map context)
  { cmd: 'set as-path prepend <AS> <AS> <AS>',
    desc: 'Inside a route-map: prepend extra AS numbers to the AS_PATH so the route looks longer / less attractive to neighbours. Used to influence INBOUND traffic engineering.',
    example: '(config-route-map)# set as-path prepend 65001 65001 65001',
    type: 'config', addIfMissing: true
  },
  // 28 — NEW
  { cmd: 'set metric <value>',
    desc: 'Inside a route-map: set the MED (Multi-Exit Discriminator). Tells an EXTERNAL neighbour which entry point into your AS to prefer. Lower = more preferred.',
    example: '(config-route-map)# set metric 50',
    type: 'config', addIfMissing: true
  },
  // 29 — NEW
  { cmd: 'set community <number> | no-export | no-advertise',
    desc: 'Inside a route-map: tag the route with one or more communities. Special well-known values: no-export (do not send outside the AS), no-advertise (do not send to any peer), local-AS (do not send outside the local sub-AS).',
    example: '(config-route-map)# set community no-export',
    type: 'config', addIfMissing: true
  },
  // 30
  { cmd: 'neighbor <IP> remove-private-as',
    matches: ['neighbor 1.2.3.4 remove-private-as'],
    desc: 'Strip private AS numbers (64512–65534, 4200000000–4294967294) from the AS_PATH before sending updates to a public peer.',
    example: '(config-router)# neighbor 8.8.8.8 remove-private-as',
    type: 'config'
  },
  // 31
  { cmd: 'neighbor <IP> route-reflector-client',
    matches: ['neighbor 1.2.3.4 route-reflector-client'],
    desc: 'Mark the iBGP peer as a route-reflector client (this router is the RR). Removes the iBGP full-mesh requirement.',
    example: '(config-router)# neighbor 10.1.1.1 route-reflector-client',
    type: 'config'
  },
  // 32
  { cmd: 'bgp cluster-id <ID>',
    matches: ['bgp cluster-id 1.1.1.1'],
    desc: 'Set the cluster-id when running redundant route-reflectors. RRs sharing a cluster-id detect and break loops between themselves.',
    example: '(config-router)# bgp cluster-id 1.1.1.1',
    type: 'config'
  },
  // 33 — NEW
  { cmd: 'bgp confederation identifier <AS>',
    desc: 'Define the public-facing AS number for a group of internal sub-ASs (BGP confederation).',
    example: '(config-router)# bgp confederation identifier 65000',
    type: 'config', addIfMissing: true
  },
  // 34 — NEW
  { cmd: 'bgp confederation peers <AS-List>',
    desc: 'Tell the router which other sub-ASs belong to the same confederation as the local sub-AS.',
    example: '(config-router)# bgp confederation peers 65001 65002',
    type: 'config', addIfMissing: true
  },
  // 35
  { cmd: 'neighbor <IP> password <string>',
    matches: ['neighbor 1.2.3.4 password CISCO123'],
    desc: 'Enable MD5 authentication for the BGP TCP session. Both peers must agree on the same password.',
    example: '(config-router)# neighbor 10.0.0.1 password MySecurePass!',
    type: 'config'
  },
  // 36
  { cmd: 'neighbor <IP> maximum-prefix <number> <threshold>',
    matches: ['neighbor 1.2.3.4 maximum-prefix 500000 90 restart 30'],
    desc: 'Limit the number of prefixes a neighbour can send. If exceeded, the session is shut down to protect the router\'s memory and route-table size. Threshold % triggers a warning before the cap.',
    example: '(config-router)# neighbor 10.0.0.2 maximum-prefix 10000 80',
    type: 'config'
  },
  // 37
  { cmd: 'bgp graceful-restart',
    matches: ['bgp graceful-restart'],
    desc: 'Allow BGP to keep forwarding traffic during a control-plane restart provided the data plane is still active. Both peers must support GR.',
    example: '(config-router)# bgp graceful-restart',
    type: 'config'
  },
  // 38
  { cmd: 'neighbor <IP> ttl-security hops <count>',
    matches: ['neighbor 1.2.3.4 ttl-security hops 1'],
    desc: 'GTSM (Generalized TTL Security Mechanism). Drop incoming BGP packets whose TTL is less than 255-hops, protecting against off-path spoofing attacks.',
    example: '(config-router)# neighbor 10.0.0.1 ttl-security hops 1',
    type: 'config'
  },
  // 39
  { cmd: 'show ip bgp neighbors <IP>',
    matches: ['show ip bgp neighbors 1.2.3.4', 'show bgp afi safi neighbors ip-address'],
    desc: 'Per-peer detail dump — capabilities, timers, error counters, prefix counts, transport (TCP) state.',
    example: `BGP neighbor is 10.0.0.2,  remote AS 65002, external link
  BGP version 4, remote router ID 192.168.5.5
  BGP state = Established, up for 05:22:11
  ...`
  },
  // 40 — NEW
  { cmd: 'show ip bgp labels',
    desc: 'Display MPLS labels associated with BGP-learned prefixes (used in MPLS-VPN / 6PE / 6vPE deployments).',
    example: '   Network          Next Hop      In label/Out label\n*> 10.1.1.0/24     192.168.1.1      18/nolabel',
    addIfMissing: true
  },
  // 41 — NEW (note: the actual command is "show ip bgp quote-regexp" but quote-as is in user's source)
  { cmd: 'show ip bgp quote-as <AS-Number>',
    desc: 'List all routes whose AS_PATH contains a specific AS number anywhere in the path.',
    example: '*> 172.16.0.0       10.0.0.2                 0             0 65002 64999 i',
    addIfMissing: true
  },
  // 42 — NEW
  { cmd: 'show ip bgp community-list <number>',
    desc: 'Filter the BGP table down to routes matching a predefined community-list.',
    example: '(Standard BGP table output filtered by community-list)',
    addIfMissing: true
  },
  // 43
  { cmd: 'ip prefix-list <NAME> seq <#> permit <IP>/<Mask> ge <#> le <#>',
    matches: ['ip prefix-list PEER-IN seq 10 permit 0.0.0.0/0 le 24'],
    desc: 'Granular prefix-list entry. ge (greater-or-equal) and le (less-or-equal) match a RANGE of prefix lengths — e.g. "permit any /24 from 10.0.0.0/8".',
    example: '(config)# ip prefix-list FILTER-EX seq 10 permit 10.0.0.0/8 ge 24 le 24',
    type: 'config'
  },
  // 44
  { cmd: 'ip as-path access-list <number> permit <regex>',
    matches: ['ip as-path access-list 100 permit ^65002_', 'ip as-path access-list acl-number {deny | permit} regex-query'],
    desc: 'Match AS_PATH attributes using regular expressions. Common: ^$ (locally-originated routes only), _65002$ (originated by AS 65002), ^65002_ (received directly from AS 65002).',
    example: '(config)# ip as-path access-list 1 permit ^65002_',
    type: 'config'
  },
  // 45 — NEW
  { cmd: 'neighbor <IP> soft-reconfiguration inbound',
    desc: 'Force the router to keep an UNFILTERED copy of every update received from a neighbour. Lets you run "show ip bgp neighbors X received-routes" and see what the peer is sending you BEFORE inbound policy. Memory-heavy on big tables.',
    example: '(config-router)# neighbor 10.0.0.2 soft-reconfiguration inbound',
    type: 'config', addIfMissing: true
  }
];

// ---------- Apply ----------------------------------------------------
let updated = 0, addedNew = 0, alreadyHad = 0;
for (const e of ENTRIES) {
  for (const pk of TARGETS) {
    const plat = data.platforms[pk];
    if (!plat) continue;
    const bgp = plat.sections?.['BGP'];
    if (!bgp) continue;

    let target = null;
    for (const m of (e.matches || [])) {
      target = bgp.find(c => c.cmd === m);
      if (target) break;
    }

    if (target) {
      if (target.example) { alreadyHad++; }
      else { target.example = e.example; updated++; }
      // Patch description if it's blank.
      if ((!target.desc || target.desc.trim() === '') && e.desc) target.desc = e.desc;
      continue;
    }

    if (e.addIfMissing) {
      // Already added in a previous run? Check by exact cmd match.
      const exists = bgp.some(c => c.cmd === e.cmd);
      if (exists) continue;
      bgp.push({ cmd: e.cmd, desc: e.desc, type: e.type || 'show', flagged: false, example: e.example });
      addedNew++;
    }
  }
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Existing commands updated with example:  ${updated}`);
console.log(`Already had example (left untouched):    ${alreadyHad}`);
console.log(`New commands added (with example):       ${addedNew}`);
