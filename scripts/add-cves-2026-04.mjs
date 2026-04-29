// Manual CVE batch — Apr 2026.
//   - 6 Palo Alto / Cortex (PAN-OS, GlobalProtect, DNS Security, Cortex XSOAR)
//   - 18 Cisco (IOS / IOS XE / ASA / Catalyst / WLC)
// Two of the user-supplied PAN-OS entries had only `https://nist.gov`
// rather than a NIST detail URL — the missing CVE IDs were resolved
// via vendor PSIRT advisories:
//   - Cortex XSOAR Microsoft Teams sig-verify (2026-04-08) → CVE-2026-0234
//   - PAN-OS Adv DNS Security DoS (2026-02-11)            → CVE-2026-0229
//   - PAN-OS GlobalProtect command injection RCE (2024-04-11) → CVE-2024-3400
//
// Logic:
//   - For brand-new IDs: append a full record.
//   - For IDs already in items[]: update product / severity / cvss / summary
//     / published to the user-supplied values (their submission is
//     authoritative) and append the NVD URL to references if not already
//     present. Vendor and existing source field are preserved.
//
// Run: node scripts/add-cves-2026-04.mjs

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/cves.json');
const MAN  = path.resolve('data/manifest.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const SUBMISSIONS = [
  // ============== Palo Alto / Cortex ==============
  { id: 'CVE-2026-0227', vendor: 'Palo Alto', product: 'PAN-OS (GlobalProtect)',
    severity: 'high', cvss: 8.7, published: '2026-01-14',
    summary: 'A vulnerability in PAN-OS software enables an unauthenticated attacker to cause a denial of service (DoS) to the firewall GlobalProtect Gateway.' },
  { id: 'CVE-2026-0234', vendor: 'Palo Alto', product: 'Cortex XSOAR',
    severity: 'high', cvss: 7.2, published: '2026-04-08',
    summary: 'Improper verification of cryptographic signatures in the Microsoft Teams integration for Cortex XSOAR and XSIAM.' },
  { id: 'CVE-2026-0229', vendor: 'Palo Alto', product: 'PAN-OS (DNS Security)',
    severity: 'medium', cvss: 6.6, published: '2026-02-11',
    summary: 'A denial of service vulnerability in the Advanced DNS Security feature allows a remote attacker to crash the firewall.' },
  { id: 'CVE-2025-0108', vendor: 'Palo Alto', product: 'PAN-OS',
    severity: 'critical', cvss: 7.8, published: '2025-02-12',
    summary: 'An authentication bypass in the management web interface enables an unauthenticated attacker to gain administrator privileges.' },
  { id: 'CVE-2025-0111', vendor: 'Palo Alto', product: 'PAN-OS',
    severity: 'high', cvss: 7.1, published: '2025-02-20',
    summary: 'An authenticated attacker with network access to the management interface can gain read access to sensitive local files.' },
  { id: 'CVE-2024-3400', vendor: 'Palo Alto', product: 'PAN-OS (GlobalProtect)',
    severity: 'critical', cvss: 10.0, published: '2024-04-11',
    summary: 'Command injection vulnerability in GlobalProtect allows unauthenticated root-level code execution.' },

  // ============== Cisco ==============
  { id: 'CVE-2026-20084', vendor: 'Cisco', product: 'Catalyst 9000 Series Switches',
    severity: 'high', cvss: 8.6, published: '2026-03-25',
    summary: 'DHCP Snooping vulnerability allows unauthenticated attackers to cause a Denial of Service.' },
  { id: 'CVE-2026-20086', vendor: 'Cisco', product: 'Catalyst CW9800 WLC',
    severity: 'high', cvss: 8.6, published: '2026-03-25',
    summary: 'CAPWAP processing flaw allows unauthenticated remote attackers to cause a device reload.' },
  { id: 'CVE-2026-20012', vendor: 'Cisco', product: 'Cisco IOS / IOS XE / ASA',
    severity: 'high', cvss: 8.6, published: '2026-03-25',
    summary: 'IKEv2 fragmentation vulnerability allows unauthenticated attackers to cause a system reload.' },
  { id: 'CVE-2026-20125', vendor: 'Cisco', product: 'Cisco IOS / IOS XE Software',
    severity: 'high', cvss: 7.7, published: '2026-03-25',
    summary: 'HTTP Server vulnerability in Release 3E allows authenticated remote attackers to cause DoS.' },
  { id: 'CVE-2026-20004', vendor: 'Cisco', product: 'Cisco IOS XE Software',
    severity: 'high', cvss: 7.4, published: '2026-03-25',
    summary: 'TLS memory exhaustion flaw allows attackers to cause a DoS by depleting system memory.' },
  { id: 'CVE-2026-20110', vendor: 'Cisco', product: 'Cisco IOS XE Software',
    severity: 'medium', cvss: 6.5, published: '2026-03-25',
    summary: 'General software flaw in IOS XE allowing unauthenticated remote DoS via specific traffic.' },
  { id: 'CVE-2025-20188', vendor: 'Cisco', product: 'Cisco Catalyst WLC',
    severity: 'critical', cvss: 10.0, published: '2025-11-12',
    summary: 'Hard-coded credentials allow unauthenticated remote attackers to access the file system.' },
  { id: 'CVE-2025-20352', vendor: 'Cisco', product: 'Cisco IOS / IOS XE',
    severity: 'high', cvss: 7.7, published: '2025-10-22',
    summary: 'SNMP subsystem stack-based buffer overflow allowing DoS or potential root RCE.' },
  { id: 'CVE-2025-20334', vendor: 'Cisco', product: 'Cisco IOS XE Software',
    severity: 'high', cvss: 8.8, published: '2025-09-24',
    summary: 'HTTP API command injection vulnerability allows authenticated admin users to execute root code.' },
  { id: 'CVE-2025-20315', vendor: 'Cisco', product: 'Cisco IOS XE Software',
    severity: 'high', cvss: 8.6, published: '2025-09-24',
    summary: 'Network-Based Application Recognition (NBAR) vulnerability allows unauthenticated remote DoS.' },
  { id: 'CVE-2025-20160', vendor: 'Cisco', product: 'Cisco IOS / IOS XE',
    severity: 'high', cvss: 8.1, published: '2025-09-24',
    summary: 'TACACS+ Authentication bypass flaw allows unauthenticated remote access to affected devices.' },
  { id: 'CVE-2025-20327', vendor: 'Cisco', product: 'Industrial Ethernet Switches',
    severity: 'high', cvss: 7.7, published: '2025-09-24',
    summary: 'Device Manager vulnerability allows unauthenticated attackers to cause a DoS reload.' },
  { id: 'CVE-2025-20312', vendor: 'Cisco', product: 'Cisco IOS XE Software',
    severity: 'high', cvss: 7.7, published: '2025-09-24',
    summary: 'SNMP processing flaw in IOS XE allows authenticated remote attackers to trigger a reload.' },
  { id: 'CVE-2025-20311', vendor: 'Cisco', product: 'Catalyst 9000 Series',
    severity: 'high', cvss: 7.4, published: '2025-09-24',
    summary: 'Specific handling of Ethernet frames allows adjacent attackers to block egress ports (DoS).' },
  { id: 'CVE-2024-20419', vendor: 'Cisco', product: 'Cisco IOS XE Software',
    severity: 'critical', cvss: 10.0, published: '2024-07-17',
    summary: 'Smart Licensing Utility static password bypass allows unauthenticated admin access.' },
  { id: 'CVE-2024-20353', vendor: 'Cisco', product: 'Cisco IOS / IOS XE',
    severity: 'high', cvss: 8.6, published: '2024-03-27',
    summary: 'Cisco Discovery Protocol (CDP) vulnerability allows adjacent attackers to cause a reload.' },
  { id: 'CVE-2024-20359', vendor: 'Cisco', product: 'Catalyst 9000 Series',
    severity: 'high', cvss: 8.6, published: '2024-03-27',
    summary: 'Ingress traffic processing logic flaw allows unauthenticated remote attackers to cause a DoS.' },
  { id: 'CVE-2024-20259', vendor: 'Cisco', product: 'Cisco IOS XE Software',
    severity: 'high', cvss: 8.6, published: '2024-03-27',
    summary: 'IPv6 packet processing flaw in WLC software allows remote DoS via malformed packets.' }
];

let added = 0, updated = 0;

for (const sub of SUBMISSIONS) {
  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${sub.id}`;
  const existing = data.items.find(x => x.id === sub.id);
  if (existing) {
    // Update user-authoritative fields. Preserve vendor (existing one is
    // already correct for these records) and any existing `source` tag.
    existing.product   = sub.product;
    existing.severity  = sub.severity;
    existing.cvss      = sub.cvss;
    existing.summary   = sub.summary;
    existing.published = sub.published;
    if (!Array.isArray(existing.references)) existing.references = [];
    if (!existing.references.includes(nvdUrl)) existing.references.push(nvdUrl);
    updated++;
  } else {
    data.items.push({
      id:         sub.id,
      vendor:     sub.vendor,
      product:    sub.product,
      severity:   sub.severity,
      cvss:       sub.cvss,
      summary:    sub.summary,
      published:  sub.published,
      references: [nvdUrl],
      source:     'Vendor security advisory'
    });
    added++;
  }
}

// Sort items so the newest-published bubbles to the top of the page.
data.items.sort((a, b) => (b.published || '').localeCompare(a.published || ''));

data.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

const m = JSON.parse(fs.readFileSync(MAN, 'utf8'));
m.cves = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(m, null, 2));

console.log(`Added (new):       ${added}`);
console.log(`Updated (existing): ${updated}`);
console.log(`Total CVEs in DB:  ${data.items.length}`);
