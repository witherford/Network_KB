// Populate data/software.json with current `latest` / `recommended`
// versions for the major vendors covered by this knowledge base.
//
// Schema (v1.3.3+):
//   { vendor, category, product, pid, recommended, latest, lifecycle,
//     releaseDate, notes, source }
//
// `category` groups products WITHIN a vendor on the page (e.g. Cisco →
// Switching / Routing / Wireless / Data Center / Firewall).
// `source` carries the OFFICIAL VENDOR URL — rendered as a clickable
// link on every row, and the version values link back to it too.
// `notes` is now URL-free (URLs live in `source`); reads as plain prose.

import fs from 'node:fs';
import path from 'node:path';

const DST = path.resolve('data/software.json');
const MAN = path.resolve('data/manifest.json');

const ENTRIES = [
  // ---------- Cisco ----------
  {
    vendor: 'Cisco', category: 'Switching', product: 'IOS-XE — Catalyst 9300/9500',
    pid: 'C9300-48P / C9500-40X',
    recommended: '17.12.04',
    latest:      '17.18.01',
    lifecycle:   'Active — 17.12 LTS, 17.18 STD',
    releaseDate: '2026-03-15',
    notes: 'TAC-recommended train for stability is 17.12.x; latest features in 17.18.x. Use Smart Licensing v2.',
    source: 'https://www.cisco.com/c/en/us/support/switches/catalyst-9300-series-switches/products-release-notes-list.html'
  },
  {
    vendor: 'Cisco', category: 'Wireless', product: 'IOS-XE — Catalyst 9800 WLC',
    pid: 'C9800-CL / C9800-40 / C9800-80',
    recommended: '17.12.04',
    latest:      '17.18.01',
    lifecycle:   'Active — 17.12 LTS, 17.18 STD',
    releaseDate: '2026-03-15',
    notes: 'AireOS-style features parity in 17.12.x+. WLC train aligned with Catalyst 9k switching.',
    source: 'https://www.cisco.com/c/en/us/support/wireless/catalyst-9800-series-wireless-controllers/products-release-notes-list.html'
  },
  {
    vendor: 'Cisco', category: 'Routing', product: 'IOS-XE — Catalyst 8000 / ASR / CSR',
    pid: 'C8500 / ASR1006-X / C8000V',
    recommended: '17.12.04',
    latest:      '17.18.01',
    lifecycle:   'Active',
    releaseDate: '2026-03-15',
    notes: 'Same IOS-XE train as the switching family. SD-WAN cEdge images on the Cisco SD-WAN release schedule.',
    source: 'https://www.cisco.com/c/en/us/support/routers/catalyst-8000v-edge-software/products-release-notes-list.html'
  },
  {
    vendor: 'Cisco', category: 'Data Center', product: 'NX-OS — Nexus 9000',
    pid: 'N9K-C9336C-FX2 / N9K-C93180YC-FX3',
    recommended: '10.3(6)M',
    latest:      '10.5(2)F',
    lifecycle:   'Active — 10.3M LTS; 10.5F latest features',
    releaseDate: '2026-02-10',
    notes: 'Use 10.3(x)M trains for VXLAN-EVPN production fabrics; 10.5(x)F for Cloud Scale features.',
    source: 'https://www.cisco.com/c/en/us/support/switches/nexus-9000-series-switches/products-release-notes-list.html'
  },
  {
    vendor: 'Cisco', category: 'Firewall', product: 'ASA / FTD — Firepower / Secure Firewall',
    pid: 'FPR-3110 / FPR-1140',
    recommended: 'ASA 9.20.3 / FTD 7.4.2',
    latest:      'ASA 9.22.1 / FTD 7.7.0',
    lifecycle:   'Active — 7.4 long-term, 7.7 latest',
    releaseDate: '2026-02-25',
    notes: 'For ASA-classic deployments stay on 9.20.x; FTD users on 7.4.x are TAC-recommended.',
    source: 'https://www.cisco.com/c/en/us/support/security/firepower-ngfw/products-release-notes-list.html'
  },

  // ---------- Palo Alto ----------
  {
    vendor: 'Palo Alto', category: 'Firewall', product: 'PAN-OS',
    pid: 'PA-440 / PA-3220 / PA-5450 / PA-7080',
    recommended: '11.1.6-h2',
    latest:      '12.0.1',
    lifecycle:   '11.1 = preferred; 11.2 = current; 12.0 = newest GA',
    releaseDate: '2026-04-08',
    notes: 'Preferred-release guidance is published as a separate live community article.',
    source: 'https://docs.paloaltonetworks.com/pan-os/12-0/pan-os-release-notes'
  },
  {
    vendor: 'Palo Alto', category: 'Management', product: 'Panorama',
    pid: 'M-200 / M-700',
    recommended: '11.1.6-h2',
    latest:      '12.0.1',
    lifecycle:   'Track 1:1 with PAN-OS firewall trains',
    releaseDate: '2026-04-08',
    notes: 'Panorama version must be ≥ managed firewall version. Match firewall preferred train.',
    source: 'https://docs.paloaltonetworks.com/panorama/12-0/panorama-release-notes'
  },
  {
    vendor: 'Palo Alto', category: 'Endpoint / VPN', product: 'GlobalProtect App',
    pid: 'GP App for Windows / macOS / iOS / Android',
    recommended: '6.2.5',
    latest:      '6.3.2',
    lifecycle:   'Active',
    releaseDate: '2026-03-22',
    notes: 'GP 6.2 is the long-term-support branch. macOS 14+ requires 6.2.0+.',
    source: 'https://docs.paloaltonetworks.com/globalprotect/6-3/globalprotect-app-release-notes'
  },

  // ---------- Citrix / NetScaler ----------
  {
    vendor: 'NetScaler / Citrix', category: 'ADC / Load balancer', product: 'NetScaler ADC / Gateway',
    pid: 'MPX-15000 / VPX-3000 / SDX-15000',
    recommended: '14.1-43.50',
    latest:      '14.1-50.13',
    lifecycle:   '14.1 active; 13.1 in extended support',
    releaseDate: '2026-03-04',
    notes: 'CVE-2023-4966 (Citrix Bleed) requires ≥ 14.1-8.50 / 13.1-49.15. Always patch promptly.',
    source: 'https://docs.netscaler.com/en-us/citrix-adc/current-release/release-notes.html'
  },

  // ---------- Fortinet ----------
  {
    vendor: 'Fortinet', category: 'Firewall', product: 'FortiOS — FortiGate',
    pid: 'FortiGate-60F / 100F / 200F / 600F / 1800F',
    recommended: '7.4.7',
    latest:      '7.6.3',
    lifecycle:   '7.4 mature; 7.6 current; 7.2 EoE Dec 2026',
    releaseDate: '2026-03-30',
    notes: '7.4.x recommended for stability. SSL-VPN deprecated 7.4.7+, migrate to ZTNA / IPsec.',
    source: 'https://docs.fortinet.com/document/fortigate/7.6.3/fortios-release-notes/'
  },
  {
    vendor: 'Fortinet', category: 'Management', product: 'FortiAnalyzer / FortiManager',
    pid: 'FAZ-200G / FMG-1000F',
    recommended: '7.4.6',
    latest:      '7.6.2',
    lifecycle:   'Same train alignment as FortiOS',
    releaseDate: '2026-03-12',
    notes: 'FortiManager-FortiGate version compat: managed devices ≤ Manager.',
    source: 'https://docs.fortinet.com/document/fortimanager/7.6.2/release-notes/'
  },

  // ---------- Aruba (HPE) ----------
  {
    vendor: 'Aruba (HPE)', category: 'Switching', product: 'AOS-CX',
    pid: 'CX 6300M-48G / CX 8325-48Y8C / CX 10000',
    recommended: '10.13.1050',
    latest:      '10.15.0010',
    lifecycle:   '10.13 LTS branch; 10.15 STD',
    releaseDate: '2026-03-18',
    notes: '10.13.x for production fabrics; 10.15.x adds Auto-Fabric / Aruba Central enhancements.',
    source: 'https://www.arubanetworks.com/techdocs/AOS-CX/Consolidated_RNs/HTML-10100/Content/release-notes.htm'
  },
  {
    vendor: 'Aruba (HPE)', category: 'Wireless', product: 'ArubaOS — Mobility Controller',
    pid: '7210 / 7280 / 9004 / 9012 / 9240',
    recommended: '8.11.2.3',
    latest:      '8.13.0.0',
    lifecycle:   '8.11 LTS; 8.13 STD',
    releaseDate: '2026-02-28',
    notes: 'AirMatch + ClientMatch features track 8.11+. Wi-Fi 6E radios require 8.11+.',
    source: 'https://www.arubanetworks.com/techdocs/ArubaOS_8x/'
  },
  {
    vendor: 'Aruba (HPE)', category: 'Wireless', product: 'Aruba Instant / AP firmware',
    pid: 'AP-505 / AP-535 / AP-655 / AP-635',
    recommended: '8.11.2.3',
    latest:      '10.7.0.0',
    lifecycle:   '8.11 LTS for AOS-managed; 10.x for Instant On / Central',
    releaseDate: '2026-03-04',
    notes: 'Wi-Fi 7 (AP-735, AP-745) requires Instant 10.5+ or AOS-CX-MM 10.13+.',
    source: 'https://asp.arubanetworks.com/downloads'
  },

  // ---------- VMware / Broadcom ----------
  {
    vendor: 'VMware (Broadcom)', category: 'Hypervisor', product: 'vSphere ESXi',
    pid: 'ESXi 8.0',
    recommended: '8.0 U3e',
    latest:      '8.0 U3f',
    lifecycle:   '8.0 active; 7.0 in extended support to Oct 2027',
    releaseDate: '2026-03-25',
    notes: 'ESXi 8.0 U3 is the long-term branch; pVRA / DRS Lens features require ≥ U3.',
    source: 'https://docs.vmware.com/en/VMware-vSphere/8.0/rn/vsphere-esxi-release-notes/index.html'
  },
  {
    vendor: 'VMware (Broadcom)', category: 'Management', product: 'vCenter Server',
    pid: 'VCSA 8.0',
    recommended: '8.0 U3e',
    latest:      '8.0 U3f',
    lifecycle:   'Active — track ESXi train',
    releaseDate: '2026-03-25',
    notes: 'vCenter ≥ ESXi version. Lifecycle Manager rolls hosts via cluster image.',
    source: 'https://docs.vmware.com/en/VMware-vSphere/8.0/rn/vsphere-vcenter-server-80-release-notes/index.html'
  },

  // ---------- Microsoft ----------
  {
    vendor: 'Microsoft', category: 'Server OS', product: 'Windows Server',
    pid: 'Server 2025 / 2022 LTSC',
    recommended: '2025 (24H2 LTSC)',
    latest:      '2025 (24H2 LTSC)',
    lifecycle:   'Mainstream support to Oct 2029; extended to Oct 2034',
    releaseDate: '2024-11-01',
    notes: 'Server 2025 is the current LTSC. 2022 still supported, 2019 mainstream ended Jan 2024.',
    source: 'https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2025'
  },
  {
    vendor: 'Microsoft', category: 'Client OS', product: 'Windows 11',
    pid: 'Windows 11 Enterprise IoT LTSC 2024',
    recommended: '24H2',
    latest:      '25H2',
    lifecycle:   '25H2 GA — annual cadence; LTSC 2024 supported to 2034',
    releaseDate: '2026-10-15',
    notes: '25H2 builds on 24H2 (enablement package). LTSC IoT 2024 = 24H2 long-term.',
    source: 'https://learn.microsoft.com/en-us/lifecycle/products/windows-11-home-and-pro'
  },

  // ---------- Proxmox ----------
  {
    vendor: 'Proxmox', category: 'Hypervisor', product: 'Proxmox VE',
    pid: 'PVE 8.x',
    recommended: '8.4',
    latest:      '8.5',
    lifecycle:   '8.x active; based on Debian 12 Bookworm',
    releaseDate: '2026-03-20',
    notes: 'Kernel 6.8.x default; QEMU 9.0.x; Ceph Reef 18.2 / Squid 19.2.',
    source: 'https://pve.proxmox.com/wiki/Roadmap'
  },

  // ---------- F5 ----------
  {
    vendor: 'F5', category: 'ADC / Load balancer', product: 'BIG-IP / TMOS',
    pid: 'i5800 / i7820-DF / VE',
    recommended: '17.1.2.1',
    latest:      '17.5.0',
    lifecycle:   '17.1 LTS until Mar 2027; 17.5 latest',
    releaseDate: '2026-02-12',
    notes: 'TMOS 16.x in extended support. ASM/AWAF requires 17.1+ for OWASP 2025 sigs.',
    source: 'https://my.f5.com/manage/s/article/K1133'
  },

  // ---------- Juniper ----------
  {
    vendor: 'Juniper', category: 'Routing / Switching', product: 'Junos OS',
    pid: 'EX4400 / QFX5130 / MX204 / SRX4600',
    recommended: '23.4R2-S2',
    latest:      '24.4R1',
    lifecycle:   '23.4 LTS; 24.4 STD',
    releaseDate: '2026-03-06',
    notes: 'Use 23.4R2.x for stability. EVPN-VXLAN feature deltas in 24.x.',
    source: 'https://supportportal.juniper.net/s/article/Junos-OS-Currently-Supported-Releases'
  },

  // ---------- MikroTik ----------
  {
    vendor: 'MikroTik', category: 'Routing / Switching', product: 'RouterOS',
    pid: 'CCR2004 / CRS328 / CHR',
    recommended: '7.16.2',
    latest:      '7.18.1',
    lifecycle:   '7.x stable; 6.x long-term legacy',
    releaseDate: '2026-04-02',
    notes: 'Stable channel. Long-term branch (7.16.x) for production. Container feature stable in 7.16+.',
    source: 'https://mikrotik.com/download/changelogs'
  }
];

const out = {
  version: 1,
  updatedAt: new Date().toISOString(),
  items: ENTRIES
};
fs.writeFileSync(DST, JSON.stringify(out, null, 2));

const manifest = JSON.parse(fs.readFileSync(MAN, 'utf8'));
manifest.software = new Date().toISOString();
fs.writeFileSync(MAN, JSON.stringify(manifest, null, 2));

console.log('Software entries written:', ENTRIES.length);
console.log('Vendors:', new Set(ENTRIES.map(e => e.vendor)).size);
console.log('Categories per vendor:');
const m = {};
for (const e of ENTRIES) {
  m[e.vendor] ||= new Set();
  m[e.vendor].add(e.category);
}
for (const [v, set] of Object.entries(m)) console.log(' ', v, '→', [...set].join(', '));
