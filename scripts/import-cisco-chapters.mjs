// Import the user-supplied Cisco IOS commands from three CSV-style text
// files into data/commands.json (under the `ciscoios` platform).
//
// Files & schemas:
//   1. "other chapters.txt"                    Task, Command Syntax
//   2. "1, 2, 3, 4, 5, 6, 11, 26, and 29.txt"  Command, Description, Key Details/Context
//   3. "7, 8, 9, 10, 12, 13, 14.txt"           Command, Description, Key Details/Context
//
// Each row is classified into one of the existing ciscoios sections via
// keyword rules (OSPF / EIGRP / BGP / VLANs / Switching & STP / Security /
// QoS / Multicast / NAT / DHCP / NTP+SNMP+Logging / Diagnostics /
// Interfaces / Routing / Config Management / EEM / Show & Status).
// Type inferred from the verb (show / debug / clear → diagnostics; otherwise
// config). Deduped against existing commands.
//
// Run: node scripts/import-cisco-chapters.mjs

import fs from 'node:fs';
import path from 'node:path';

const SOURCES = [
  { path: 'C:/Users/withe/Downloads/other chapters.txt',                     schema: ['task', 'cmd'] },
  { path: 'C:/Users/withe/Downloads/1, 2, 3, 4, 5, 6, 11, 26, and 29.txt',   schema: ['cmd', 'desc', 'context'] },
  { path: 'C:/Users/withe/Downloads/7, 8, 9, 10, 12, 13, 14.txt',            schema: ['cmd', 'desc', 'context'] }
];

const DST = path.resolve('data/commands.json');
const MAN = path.resolve('data/manifest.json');

// ---------- RFC 4180 CSV parser (handles quoted multi-line cells) ---------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let cellStart = true;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"' && cellStart) { inQuotes = true; cellStart = false; i++; continue; }
    if (c === ',') { row.push(cell); cell = ''; cellStart = true; i++; continue; }
    if (c === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; cellStart = true; i++; continue;
    }
    if (c === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ''; cellStart = true; i++; continue;
    }
    cell += c; cellStart = false; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------- Section classifier (rule order matters) ---------------------
const RULES = [
  // Most-specific protocols first.
  { rx: /\bospf\b/i,                                       section: 'OSPF' },
  { rx: /\beigrp\b/i,                                      section: 'EIGRP' },
  { rx: /\bbgp\b/i,                                        section: 'BGP' },

  // L2 domain
  { rx: /\b(vlan(?!.*\bospf)|vtp|encapsulation dot1q|allowed\s+vlan|trunk\s)/i, section: 'VLANs' },
  { rx: /\bswitchport\b/i,                                                     section: 'VLANs' },
  { rx: /\b(spanning-?tree|portfast|bpduguard|bpdufilter|udld|root\s+(primary|secondary|guard))\b/i, section: 'Switching & STP' },
  { rx: /\b(channel-group|port-channel|etherchannel|lacp|pagp)\b/i,             section: 'Switching & STP' },
  { rx: /\b(standby|vrrp|glbp)\b/i,                                             section: 'Switching & STP' },

  // Forwarding-plane features
  { rx: /\bnat\b/i,                                                             section: 'NAT' },
  { rx: /\b(pim|igmp|mld|multicast|mroute|ip\s+pim)\b/i,                        section: 'Multicast' },
  { rx: /\b(policy-?map|class-?map|service-policy|priority(?!\s+\d{1,3}\b)|police|shape\s+\w|cbwfq|wred|dscp|cos\s|qos\b)\b/i, section: 'QoS' },

  // Services
  { rx: /\b(ip\s+dhcp|dhcp\s+pool|helper-address|dhcp\s+snooping)\b/i,          section: 'DHCP / Services' },
  { rx: /\bntp\b/i,                                                             section: 'NTP / SNMP / Logging' },
  { rx: /\bsnmp\b/i,                                                            section: 'NTP / SNMP / Logging' },
  { rx: /\blogging\b/i,                                                         section: 'NTP / SNMP / Logging' },

  // Security / AAA / ACL
  { rx: /\b(aaa|tacacs|radius|enable\s+secret|enable\s+password|service\s+password|crypto\s+key|line\s+vty|transport\s+input|dot1x|authentication\s+(login|periodic|port-control))\b/i, section: 'Security' },
  { rx: /\b(access-list|ip\s+access|access-group|access-class|prefix-list|distribute-list|route-map|permit\s|deny\s)\b/i, section: 'Security' },
  { rx: /\b(port-security|ip\s+arp\s+inspection|dynamic\s+arp\s+inspection|ip\s+source\s+guard|storm-control)\b/i, section: 'Security' },
  { rx: /\b(crypto\s+(ikev2|ipsec|isakmp)|tunnel\s+mode\s+ipsec|vpn|profile\s+ipsec)\b/i, section: 'Security' },
  { rx: /\b(zone-pair|zone\s+security|class-map\s+type\s+inspect|policy-map\s+type\s+inspect|inspect\s)\b/i, section: 'Security' },

  // Tracking, IP SLA, telemetry
  { rx: /\b(track\b|ip\s+sla|sla\s+monitor)\b/i,                                section: 'Diagnostics' },
  { rx: /\b(cdp|lldp)\b/i,                                                      section: 'Diagnostics' },
  { rx: /\b(monitor\s+capture|debug\s|undebug|test\s+aaa|packet-tracer)\b/i,    section: 'Diagnostics' },

  // EEM / TCL / archive triggers
  { rx: /\b(event\s+manager|tclsh|event\s+timer|event\s+syslog)\b/i,            section: 'Embedded Event Manager / Automation' },

  // Tunnels / GRE / VRF / static routing
  { rx: /\bvrf\b/i,                                                             section: 'Routing' },
  { rx: /\b(interface\s+Tunnel|tunnel\s+(source|destination|mode))\b/i,         section: 'Routing' },
  { rx: /\b(ip\s+route\b|ipv6\s+route\b|router\s+(rip|isis|odr)|cef|fib|rib|maximum-paths)\b/i, section: 'Routing' },

  // Interfaces & physical
  { rx: /\b(interface\s+\w|description\s|shutdown\b|no\s+shutdown|speed\s+\d|duplex\s|mtu\s+\d|errdisable|negotiation\s+auto|stack-power)\b/i, section: 'Interfaces' },

  // Config management
  { rx: /\b(copy\s+(running|startup)|write\s+memory|reload|archive\b|configure\s+replace|boot\s+system|wr\b|running-config|startup-config|service\s+timestamps)\b/i, section: 'Config Management' },

  // Catch-all show / verify commands → Show & Status
  { rx: /\bshow\b/i, section: 'Show & Status' }
];

function classifySection(cmd, desc) {
  const hay = (cmd || '') + ' ' + (desc || '');
  for (const r of RULES) {
    if (r.rx.test(hay)) return r.section;
  }
  return 'Show & Status';
}

function classifyType(cmd) {
  const c = (cmd || '').trim().toLowerCase();
  if (/^show\b/.test(c)) return 'show';
  if (/^(debug|undebug|ping|traceroute|test\s|clear\s|monitor\s+capture)/.test(c)) return 'troubleshooting';
  return 'config';
}

// File 1 ("other chapters.txt") has analysis prose interleaved with the
// actual command rows. Filter out anything that doesn't look like a real
// Cisco IOS syntax line.
const PROSE_INDICATORS = [
  'note:', 'looking closely', 'self-correction', 'ptg42932880', 'citation',
  'row ', 'text says', 'based on text', 'i will', 'likely page', 'the text',
  'actually,', ' -> ', 'analysis:', 'input:', 'context:', 'observation:',
  'chapter ', 'page ', 'figure ', 'table 15', 'table 16'
];
function looksLikeRealCommand(cmd) {
  if (!cmd || cmd.length < 2) return false;
  if (cmd.length > 220) return false;            // real Cisco syntax is concise
  const lower = cmd.toLowerCase();
  for (const p of PROSE_INDICATORS) if (lower.includes(p)) return false;
  // Must start with a Cisco-ish verb / keyword. (Best-effort heuristic — we
  // accept common starters and any line that begins with a single token of
  // letters / hyphens, which catches the bulk of legitimate IOS commands.)
  if (!/^[a-z!#@?\-\d]/.test(lower)) return false;
  // Reject lines with too many sentence terminators (real commands rarely have any).
  const dotCount = (cmd.match(/[.?]/g) || []).length;
  if (dotCount > 3) return false;
  // Reject lines that look like prose ("This command does X.")
  if (/^(this|the|when|use this|configure a|configure the|defines|sets|specifies|enables|disables|allows|prevents)\s/i.test(cmd)) return false;
  return true;
}

// ---------- Read + parse all three sources ------------------------------
const allEntries = [];
for (const src of SOURCES) {
  const text = fs.readFileSync(src.path, 'utf8');
  const rows = parseCSV(text);
  if (!rows.length) continue;
  // Skip header row (file 1's headers are "Task,Command Syntax";
  // files 2/3 are "Command,Description,Key Details/Context").
  const headers = rows[0].map(h => h.replace(/^"+|"+$/g,'').trim().toLowerCase());
  const isHeader = headers.some(h => /^(task|command|description)$/i.test(h) || h.includes('command syntax'));
  const dataRows = isHeader ? rows.slice(1) : rows;
  for (const row of dataRows) {
    if (!row || !row.length || (row.length === 1 && !row[0].trim())) continue;
    let cmd = '', desc = '';
    if (src.schema[0] === 'task') {
      const task = (row[0] || '').trim();
      cmd = (row[1] || '').trim();
      desc = task;
    } else {
      cmd = (row[0] || '').trim();
      const d1 = (row[1] || '').trim();
      const d2 = (row[2] || '').trim();
      desc = d2 ? `${d1} — ${d2}` : d1;
    }
    if (!cmd) continue;
    if (!looksLikeRealCommand(cmd)) continue;
    allEntries.push({ cmd, desc, type: classifyType(cmd), section: classifySection(cmd, desc) });
  }
  console.log(`Parsed ${dataRows.length} rows from ${path.basename(src.path)}`);
}
console.log('Total parsed entries (after prose filter):', allEntries.length);

// ---------- Merge into ciscoios platform --------------------------------
const data = JSON.parse(fs.readFileSync(DST, 'utf8'));
const ios = data.platforms.ciscoios;
if (!ios) throw new Error('ciscoios platform missing');
ios.sections ||= {};

const stats = {};
let added = 0, skipped = 0;
for (const e of allEntries) {
  ios.sections[e.section] ||= [];
  // Dedupe by command string within the section.
  const exists = ios.sections[e.section].some(c => c.cmd === e.cmd);
  if (exists) { skipped++; continue; }
  ios.sections[e.section].push({ cmd: e.cmd, desc: e.desc, type: e.type, flagged: false });
  stats[e.section] = (stats[e.section] || 0) + 1;
  added++;
}

data.updatedAt = new Date().toISOString();
fs.writeFileSync(DST, JSON.stringify(data, null, 2));

const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.commands = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log('\nResult:');
console.log('  Added:  ', added);
console.log('  Skipped:', skipped, '(duplicate cmd in same section)');
console.log('\nPer-section additions:');
for (const [s, n] of Object.entries(stats).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${s.padEnd(40)} +${n}`);
}
