// Shared OUI / MAC helpers used by the OUI list lookup and the ARP + MAC-table
// merge pages. Backed by the bundled IEEE OUI database (data/oui.json), built
// from the public-domain Wireshark `manuf` file. Lazy-loaded, SW-cached.

export const FALLBACK_OUI = {
  '000c29':'VMware, Inc.', '005056':'VMware, Inc.', '001c14':'VMware, Inc.',
  '525400':'QEMU/KVM', '080027':'Oracle (VirtualBox)', '00163e':'Xen',
  '0050c2':'Microsoft', '7c1e52':'Microsoft', 'd89ef3':'Microsoft',
  '000c30':'Cisco Systems', '0017df':'Cisco-Linksys', '00d058':'Cisco Systems',
  'b827eb':'Raspberry Pi Foundation', 'dca632':'Raspberry Pi Trading',
  '0050ba':'D-Link', 'c0c1c0':'TP-Link Technologies',
  'b8c113':'Apple, Inc.', 'a4c361':'Apple, Inc.',
  '04e548':'Hewlett Packard', '3068b6':'Hewlett Packard'
};

const PATTERNS = [
  { test: m => m === 'ffffffffffff', label: 'Broadcast' },
  { test: m => m.startsWith('01005e'), label: 'IPv4 multicast' },
  { test: m => m.startsWith('3333'),   label: 'IPv6 multicast' },
  { test: m => m.startsWith('0180c2'), label: 'IEEE 802.1 reserved (STP / LACP / LLDP / 802.1X)' },
  { test: m => m.startsWith('00005e0001'), label: 'VRRP virtual MAC (IPv4)' },
  { test: m => m.startsWith('00005e0002'), label: 'VRRP virtual MAC (IPv6)' },
  { test: m => m.startsWith('00000c07ac'), label: 'HSRPv1 virtual MAC' },
  { test: m => m.startsWith('00000c9ff'),  label: 'HSRPv2 virtual MAC' },
  { test: m => m.startsWith('0007b400'),   label: 'GLBP virtual MAC' },
  { test: m => m.startsWith('01000ccccccc'), label: 'Cisco CDP / VTP / DTP / PAgP' }
];

export const COLUMNS = [
  { key: 'ip',         label: 'IP',          arpOnly: true,  defaultOn: true },
  { key: 'iface',      label: 'Interface',   arpOnly: true,  defaultOn: true },
  { key: 'input',      label: 'Input',       arpOnly: false, defaultOn: true },
  { key: 'vendor',     label: 'Vendor',      arpOnly: false, defaultOn: true },
  { key: 'allocation', label: 'Allocation',  arpOnly: false, defaultOn: true },
  { key: 'notes',      label: 'Notes',       arpOnly: false, defaultOn: true },
  { key: 'colon',      label: 'Colon format',arpOnly: false, defaultOn: true },
  { key: 'dash',       label: 'Dash format', arpOnly: false, defaultOn: false },
  { key: 'dotted',     label: 'Cisco dotted',arpOnly: false, defaultOn: true },
  { key: 'bare',       label: 'Bare hex',    arpOnly: false, defaultOn: false },
  { key: 'ul',         label: 'U/L',         arpOnly: false, defaultOn: true },
  { key: 'ig',         label: 'I/G',         arpOnly: false, defaultOn: true }
];

let _db = null;
let _dbPromise = null;
export async function loadDb() {
  if (_db) return _db;
  if (_dbPromise) return _dbPromise;
  _dbPromise = (async () => {
    try {
      const url = new URL('data/oui.json', document.baseURI).toString();
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _db = await res.json();
      return _db;
    } catch (e) {
      console.warn('[oui] DB load failed, using inline fallback:', e);
      _db = FALLBACK_OUI;
      return _db;
    }
  })();
  return _dbPromise;
}

export function findVendor(db, bare) {
  const k36 = bare.slice(0, 9) + '/36';
  if (db[k36]) return { vendor: db[k36], allocation: 'MA-S /36' };
  const k28 = bare.slice(0, 7) + '/28';
  if (db[k28]) return { vendor: db[k28], allocation: 'MA-M /28' };
  const k24 = bare.slice(0, 6);
  if (db[k24]) return { vendor: db[k24], allocation: 'MA-L /24' };
  return null;
}

export function parseAndLookup(db, input) {
  const bare = input.replace(/[^0-9a-f]/gi, '').toLowerCase();
  if (bare.length < 12) return { input, error: 'No MAC found' };
  const mac12 = bare.slice(0, 12);
  let notes = '';
  for (const p of PATTERNS) { if (p.test(mac12)) { notes = p.label; break; } }
  const v = findVendor(db, mac12);
  const o1 = parseInt(mac12.slice(0, 2), 16);
  const ig = (o1 & 0x01) ? 'Group (multicast)' : 'Individual (unicast)';
  const ul = (o1 & 0x02) ? 'Locally administered' : 'Universally administered';
  return {
    input, bare: mac12,
    norm: mac12.toUpperCase().match(/.{2}/g).join(':'),
    colon: mac12.match(/.{2}/g).join(':'),
    dash:  mac12.match(/.{2}/g).join('-'),
    dotted: mac12.match(/.{4}/g).join('.'),
    vendor: v?.vendor || (notes || 'Unknown'),
    allocation: v?.allocation || (notes ? '— special' : '—'),
    notes, ul, ig
  };
}

export function parseArpInput(text, db) {
  const out = [];
  const macRe = /([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}|(?:[0-9a-f]{2}[:\-]){5}[0-9a-f]{2}|[0-9a-f]{12})/i;
  const ipRe  = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(IP\s+ARP|Address|Total|Protocol|Internet\s+Address|Hardware|Age|---|===|Flags:)/i.test(trimmed)) continue;
    const macMatch = trimmed.match(macRe);
    if (!macMatch) continue;
    const ipMatch = trimmed.match(ipRe);
    if (!ipMatch) continue;
    const macRaw = macMatch[1];
    const ip = ipMatch[1];
    const tokens = trimmed.split(/\s+/);
    let iface = '';
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (/^(Vlan|Vl|GigabitEthernet|Gi|TenGig|Te|FortyGig|Fo|Hu|Ethernet|Eth|Po|port-channel|FastEthernet|Fa|Tunnel|Loopback|Lo|mgmt|management|inside|outside|dmz|TwentyFive)\d*/i.test(t)) {
        iface = t;
        break;
      }
    }
    const r = parseAndLookup(db, macRaw);
    r.ip = ip;
    r.iface = iface;
    r.input = trimmed;
    out.push(r);
  }
  return out;
}

// Parse `show mac address-table` Cisco output. Returns [{vlan, mac, type, ports}].
export function parseMacAddressTable(text) {
  const out = [];
  const macRe = /([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}|(?:[0-9a-f]{2}[:\-]){5}[0-9a-f]{2})/i;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(Mac\s+Address\s+Table|Vlan\s+Mac|---|===|\* - primary|All|Total|Multicast|Legend:)/i.test(line)) continue;
    const macM = line.match(macRe);
    if (!macM) continue;
    const tokens = line.split(/\s+/);
    let vlan = '', type = '', ports = '';
    const macIdx = tokens.findIndex(t => macRe.test(t));
    if (macIdx === -1) continue;
    if (tokens[0] && /^\*?\d+$/.test(tokens[0])) vlan = tokens[0].replace(/^\*/, '');
    else if (tokens[0] === 'All' || tokens[0] === '*') vlan = tokens[0];
    if (tokens[macIdx + 1]) type = tokens[macIdx + 1];
    if (tokens[macIdx + 2]) ports = tokens.slice(macIdx + 2).join(' ');
    out.push({ vlan, mac: macM[1], type, ports });
  }
  return out;
}

export function normaliseMac(s) {
  const bare = String(s || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
  return bare.length === 12 ? bare : null;
}

// Canonicalise an interface name to a short form (GigabitEthernet1/0/1 → Gi1/0/1,
// "Gig 0/1" → Gi0/1) so CDP / LLDP / MAC-table / ARP can be matched together.
const IFACE_MAP = [
  [/^(TwentyFiveGig(abitEthernet)?|TwentyFiveGigE|Twe)/i, 'Twe'],
  [/^(TwoGigabitEthernet|TwoGigE|Tw)/i, 'Tw'],
  [/^(TenGig(abitEthernet)?|TenGigE|Ten|Te)/i, 'Te'],
  [/^(FortyGig(abitEthernet)?|FortyGigE|Forty|Fo)/i, 'Fo'],
  [/^(HundredGig(abitEthernet)?|HundredGigE|Hu)/i, 'Hu'],
  [/^(GigabitEthernet|GigEthernet|GigE|Gig|GE|Gi)/i, 'Gi'],
  [/^(FastEthernet|FastEth|Fas|Fa)/i, 'Fa'],
  [/^(Port-?channel|Po)/i, 'Po'],
  [/^(Ethernet|Eth|Et)/i, 'Et'],
  [/^(Vlan|Vl)/i, 'Vlan'],
  [/^(Loopback|Lo)/i, 'Lo'],
  [/^(Tunnel|Tu)/i, 'Tu'],
  [/^(Management|Mgmt|mgmt|Ma)/i, 'Ma'],
  [/^(Bundle-Ether|BE)/i, 'BE']
];
export function normIface(s) {
  if (!s) return '';
  const str = String(s).trim();
  const m = str.match(/^([A-Za-z\-]+)\s*([\d/.:]+)$/);
  if (!m) return str;
  const [, pfx, num] = m;
  for (const [re, short] of IFACE_MAP) { if (re.test(pfx)) return short + num; }
  return pfx + num;
}

// Parse `show cdp neighbors [detail]`. Returns
// [{localIf, neighbor, remotePort, platform, mgmtIp}].
export function parseCdp(text) {
  const out = [];
  if (!text || !text.trim()) return out;
  if (/Device ID:/i.test(text)) {
    // Detail format — split into per-neighbor blocks.
    const blocks = text.split(/(?=Device ID:)/i);
    for (const b of blocks) {
      const dev = b.match(/Device ID:\s*(\S+)/i);
      const li  = b.match(/Interface:\s*([^,\n]+)/i);
      if (!dev || !li) continue;
      out.push({
        localIf: li[1].trim(),
        neighbor: dev[1].trim(),
        remotePort: (b.match(/Port ID \(outgoing port\):\s*([^\n,]+)/i)?.[1] || '').trim(),
        platform: (b.match(/Platform:\s*([^,\n]+)/i)?.[1] || '').trim(),
        mgmtIp: (b.match(/IP(?:v4)? address:\s*([\d.]+)/i)?.[1] || '').trim()
      });
    }
    return out;
  }
  // Tabular format.
  return parseNeighborTable(text, /Local\s+Intrfce/i);
}

// Parse `show lldp neighbors [detail]`.
export function parseLldp(text) {
  const out = [];
  if (!text || !text.trim()) return out;
  if (/Local Intf:/i.test(text)) {
    const blocks = text.split(/(?=Local Intf:)/i);
    for (const b of blocks) {
      const li = b.match(/Local Intf:\s*(\S+)/i);
      if (!li) continue;
      const dev = b.match(/System Name:\s*(.+)/i);
      out.push({
        localIf: li[1].trim(),
        neighbor: (dev?.[1] || b.match(/Chassis id:\s*(\S+)/i)?.[1] || '').trim(),
        remotePort: (b.match(/Port id:\s*([^\n]+)/i)?.[1] || '').trim(),
        platform: (b.match(/System Description:\s*(.+)/i)?.[1] || '').trim().slice(0, 60),
        mgmtIp: (b.match(/(?:Management Address(?:es)?[\s\S]*?)?IP:\s*([\d.]+)/i)?.[1] || '').trim()
      });
    }
    return out;
  }
  return parseNeighborTable(text, /Local\s+Intf/i);
}

// Shared tabular parser for `show cdp/lldp neighbors`. Columns:
// Device-ID  Local-Intf  Holdtime  Capability  [Platform]  Port-ID
function parseNeighborTable(text, headerRe) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let started = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (headerRe.test(line)) { started = true; continue; }
    if (!started) continue;
    if (/^(Total|Capability codes|---)/i.test(line)) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < 3) continue;
    const dev = tokens[0];
    // Local interface: token[1], plus token[2] if the platform splits "Gig 1/0/1".
    let idx = 1, localIf = tokens[1];
    if (/^[A-Za-z]+$/.test(tokens[1]) && /^[\d/.:]/.test(tokens[2] || '')) { localIf = tokens[1] + tokens[2]; idx = 2; }
    // Port ID: trailing tokens — join an alpha prefix with a following number.
    let remotePort = tokens[tokens.length - 1];
    const penult = tokens[tokens.length - 2];
    if (/^[\d/.:]/.test(remotePort) && /^[A-Za-z]+$/.test(penult || '')) remotePort = penult + remotePort;
    out.push({ localIf, neighbor: dev, remotePort, platform: '', mgmtIp: '' });
  }
  return out;
}

export function fmtMac(bare, fmt) {
  if (!bare) return '';
  if (fmt === 'dash')   return bare.match(/.{2}/g).join('-');
  if (fmt === 'dotted') return bare.match(/.{4}/g).join('.');
  return bare.match(/.{2}/g).join(':');
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

export function downloadCsv(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
