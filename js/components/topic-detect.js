// Heuristic topic detection — given a command + description string, return
// the routing-protocol / feature-area name that best fits.
//
// Used by the Commands page to subgroup large mixed sections (e.g. "Routing"
// containing both BGP and OSPF and EIGRP commands) into BGP / OSPF / EIGRP /
// STP / VLAN topic clusters with a topic header above each cluster.
//
// Rules are ORDER-SENSITIVE — first match wins. Specific protocol names
// trump generic ones (BGP before "ip route"). Anything that doesn't match
// any rule lands in 'General' — and the caller decides whether to show
// the topic header for the General bucket.

const RULES = [
  { topic: 'BGP',                test: /\bbgp\b/i },
  { topic: 'OSPF',               test: /\bospf(?:v3)?\b|ospfv2/i },
  { topic: 'EIGRP',              test: /\beigrp\b/i },
  { topic: 'IS-IS',              test: /\bisis\b/i },
  { topic: 'RIP',                test: /\brip(?:v2)?\b/i },
  { topic: 'PIM / Multicast',    test: /\b(pim|igmp|mld|mroute|multicast|msdp|mvpn)\b/i },
  { topic: 'MPLS / L3VPN',       test: /\bmpls\b|\bvpnv4\b|\bvrf\b|\blabel\b/i },
  { topic: 'Spanning Tree',      test: /\b(spanning-?tree|stp|mstp|rpvst|portfast|bpdu|root|udld)\b/i },
  { topic: 'VLAN / Trunk',       test: /\b(vlan|trunk|switchport(?!\s+access))\b/i },
  { topic: 'EtherChannel / LAG', test: /\b(etherchannel|port-?channel|lacp|pagp|lag(?:\b|\s))\b/i },
  { topic: 'VXLAN / EVPN',       test: /\bvxlan\b|\bnve\b|\bl2vpn evpn\b|\bevpn\b/i },
  { topic: 'IPsec / Crypto',     test: /\b(crypto|ipsec|ikev?2?|ike|isakmp|esp|transform-set)\b/i },
  { topic: 'NAT',                test: /\b(nat|pat)\b/i },
  { topic: 'DHCP',               test: /\bdhcp\b/i },
  { topic: 'DNS',                test: /\bdns\b/i },
  { topic: 'NTP',                test: /\bntp\b/i },
  { topic: 'SNMP',               test: /\bsnmp\b/i },
  { topic: 'Logging / Syslog',   test: /\b(logging|syslog|event manager|event log)\b/i },
  { topic: 'AAA / 802.1X',       test: /\b(aaa|tacacs|radius|802\.1x|dot1x|port-?security)\b/i },
  { topic: 'ACLs',               test: /\b(access-list|access-group|ip access|ipv6 access|access-rule|prefix-list|distribute-list|filter-list|route-map)\b/i },
  { topic: 'QoS',                test: /\b(qos|policy-map|class-map|service-policy|priority|cbwfq|policer|shaper|wred|dscp|cos)\b/i },
  { topic: 'IP SLA / NetFlow',   test: /\b(ip sla|netflow|flow exporter|flow monitor|flow record|track\b)/i },
  { topic: 'Tunnels / GRE',      test: /\b(tunnel|gre)\b/i },
  { topic: 'BFD',                test: /\bbfd\b/i },
  { topic: 'HSRP / VRRP / GLBP', test: /\b(hsrp|vrrp|glbp)\b/i },
  { topic: 'CDP / LLDP',         test: /\b(cdp|lldp)\b/i },
  { topic: 'IPv6',               test: /\bipv6\b|\bnd\b/i },
  { topic: 'Routing (general)',  test: /\b(ip route|show ip route|ip routing|cef|fib|rib)\b/i },
  { topic: 'Interfaces',         test: /\b(interface|transceiver|controller|mtu|duplex|speed|shutdown|description)\b/i },
  { topic: 'BGP EVPN',           test: /\b(l2vpn evpn|evpn)\b/i }
];

/**
 * Return the best-fitting topic for a command-row.
 *  row = { cmd: { cmd, desc }, ... } — same shape as the page's command rows.
 */
export function detectTopic(row) {
  const haystack = (row.cmd?.cmd || '') + ' ' + (row.cmd?.desc || '');
  for (const r of RULES) {
    if (r.test.test(haystack)) return r.topic;
  }
  return 'General';
}

/**
 * Group a flat list of command-rows into a Map<topic, rows[]> ordered by
 * the order the topics first appear. Stable within each topic.
 */
export function groupByTopic(rows) {
  const map = new Map();
  for (const r of rows) {
    const t = detectTopic(r);
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(r);
  }
  return map;
}

/**
 * Convenience helper: should we render topic sub-headers at all? Only when
 * the section has enough variety AND enough volume to benefit. Otherwise
 * we render flat to avoid one-item sub-groups.
 *
 * Threshold: ≥ 8 commands AND ≥ 3 distinct topics (one of which isn't
 * "General"). This keeps small sections (e.g. an already-focused "OSPF"
 * section with 25 OSPF commands) from showing a single "OSPF" header.
 */
export function shouldGroup(rows) {
  if (rows.length < 8) return false;
  const topics = new Set(rows.map(detectTopic));
  if (topics.size < 3) return false;
  // If everything resolves to 'General' there's nothing to group.
  topics.delete('General');
  return topics.size >= 2;
}
