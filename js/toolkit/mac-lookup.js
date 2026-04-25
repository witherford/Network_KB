// MAC address / OUI vendor lookup + format conversion.
// Built-in OUI table covers the most common enterprise vendors.
// Also handles format normalisation (colon, dash, Cisco dotted, no-sep).

import { copyToClipboard, toast } from '../utils.js';

// Curated common OUIs (24-bit prefix → vendor). Not exhaustive — anything not
// matched shows "Unknown". Keep additions short and lower-cased.
const OUI = {
  '000c29':'VMware','005056':'VMware','000569':'VMware','001c14':'VMware',
  '0050c2':'Microsoft','0003ff':'Microsoft','0017fa':'Microsoft','001dd8':'Microsoft','7c1e52':'Microsoft','c83a35':'Microsoft','9cebe8':'Microsoft','f01dbc':'Microsoft','d89ef3':'Microsoft',
  '525400':'QEMU/KVM','520054':'QEMU/KVM',
  '080027':'VirtualBox','0a0027':'VirtualBox',
  '001c42':'Parallels',
  '00163e':'Xen',
  '001a4a':'Qumranet/RedHat',
  '00059a':'Cisco','000142':'Cisco','000164':'Cisco','000196':'Cisco','0001c7':'Cisco','0001c9':'Cisco','000216':'Cisco','000403':'Cisco','000476':'Cisco','000477':'Cisco','000613':'Cisco','000615':'Cisco','0006d6':'Cisco','000760':'Cisco','000785':'Cisco','000821':'Cisco','000bbe':'Cisco','000bbf':'Cisco','000c30':'Cisco','000d28':'Cisco','000d65':'Cisco','000ee8':'Cisco','000f23':'Cisco','000f24':'Cisco','000f8f':'Cisco','000fb1':'Cisco','001007':'Cisco','001011':'Cisco','001054':'Cisco','00107b':'Cisco','0010f6':'Cisco','0011bb':'Cisco','0011bc':'Cisco','001215':'Cisco','001282':'Cisco','001405':'Cisco','001747':'Cisco','001748':'Cisco','0018b9':'Cisco','0018ba':'Cisco','001a6c':'Cisco','001bd4':'Cisco','001c58':'Cisco','001ef7':'Cisco','002155':'Cisco','0021a0':'Cisco','0023eb':'Cisco','002500':'Cisco','002545':'Cisco','002584':'Cisco','002586':'Cisco','0026cb':'Cisco','002a10':'Cisco','002a6a':'Cisco','002bff':'Cisco','0026ca':'Cisco','002dca':'Cisco','0030f2':'Cisco','0040ae':'Cisco','004095':'Cisco','004f49':'Cisco','005014':'Cisco','005054':'Cisco','005073':'Cisco','005080':'Cisco','0050a2':'Cisco','0050a7':'Cisco','005a13':'Cisco','008049':'Cisco','008064':'Cisco','00aa01':'Cisco','00b064':'Cisco','00d058':'Cisco','00d0bc':'Cisco','00d0bb':'Cisco','00e014':'Cisco','00e034':'Cisco','00e08f':'Cisco','00e0a3':'Cisco','00e0fe':'Cisco','00f29c':'Cisco','00f8f2':'Cisco','088e90':'Cisco','08cc68':'Cisco','0c2724':'Cisco','0c8fff':'Cisco','0cd996':'Cisco','0cf5a4':'Cisco','105f49':'Cisco','107bef':'Cisco','10b3d5':'Cisco','143dc7':'Cisco','14a8b0':'Cisco','1803733':'Cisco','181420':'Cisco','185573':'Cisco','18bfff':'Cisco','18ef63':'Cisco','1c1d67':'Cisco','1c6a7a':'Cisco','1cdf0f':'Cisco','1ce6c7':'Cisco','201a06':'Cisco','201bc9':'Cisco','203a07':'Cisco','206a8a':'Cisco','206b9e':'Cisco','24762a':'Cisco','24f5a2':'Cisco','28940f':'Cisco','28c7ce':'Cisco','28e39f':'Cisco','2c4f52':'Cisco','2c33d1':'Cisco','2c3691':'Cisco','2c3b1f':'Cisco','3037a6':'Cisco','30b64f':'Cisco','30c1b3':'Cisco','30e4db':'Cisco','30f3eb':'Cisco','341b22':'Cisco','345a40':'Cisco','34bd80':'Cisco','34db9c':'Cisco','3801974':'Cisco','3837dd':'Cisco','3842a4':'Cisco','38c85c':'Cisco','3c0e23':'Cisco','3c5b91':'Cisco','3ce5a6':'Cisco','3cce73':'Cisco','3cdf1e':'Cisco','3cfdfe':'Cisco','40b5c1':'Cisco','40e3d6':'Cisco','40f4ec':'Cisco','44e08e':'Cisco','445b59':'Cisco','4493cf':'Cisco','485d36':'Cisco','48f8b3':'Cisco','4c4e35':'Cisco','4c771e':'Cisco','4cd97c':'Cisco','5067ae':'Cisco','5087896':'Cisco','5475d0':'Cisco','5851c5':'Cisco','58f398':'Cisco','5cf3fc':'Cisco','64a0e7':'Cisco','64ae0c':'Cisco','64f69d':'Cisco','680fdaf':'Cisco','6c20bd':'Cisco','6c3d3d':'Cisco','6c50fc':'Cisco','6c8814':'Cisco','6cdd30':'Cisco','7026b9':'Cisco','70ca9b':'Cisco','70db98':'Cisco','70df2f':'Cisco','70e289':'Cisco','740719':'Cisco','744aa4':'Cisco','745e1c':'Cisco','7426ac':'Cisco','7c9509':'Cisco','7cad74':'Cisco','7cba59':'Cisco','7cf90e':'Cisco','805b8b':'Cisco','80e8f2':'Cisco','842b2b':'Cisco','847519':'Cisco','847a88':'Cisco','848941':'Cisco','881df5':'Cisco','886c1b':'Cisco','88f031':'Cisco','8c00d8':'Cisco','8ce748':'Cisco','9067fa':'Cisco','906cac':'Cisco','94d4b8':'Cisco','98fc11':'Cisco','9c4e20':'Cisco','9c574b':'Cisco','9cafca':'Cisco','a008d7':'Cisco','a418a4':'Cisco','a44c11':'Cisco','a4256d':'Cisco','a4c361':'Cisco','a8ec80':'Cisco','ac7e8a':'Cisco','aca016':'Cisco','b0aa77':'Cisco','b070bf':'Cisco','b0c853':'Cisco','b414d8':'Cisco','b426ac':'Cisco','b4e9b0':'Cisco','b80ca6':'Cisco','b838ce':'Cisco','b8be60':'Cisco','b8c6ec':'Cisco','b89a26':'Cisco','bc671c':'Cisco','c025e9':'Cisco','c067af':'Cisco','c08c60':'Cisco','c41696':'Cisco','c47d4f':'Cisco','c4f7d5':'Cisco','c80175':'Cisco','c8b373':'Cisco','c8d719':'Cisco','c8f9f9':'Cisco','cc46d6':'Cisco','cc70ed':'Cisco','d0a5a6':'Cisco','d0c282':'Cisco','d0d0fd':'Cisco','d4ad2d':'Cisco','d4e8b2':'Cisco','d8b190':'Cisco','d8b1ec':'Cisco','dc7b94':'Cisco','dceb94':'Cisco','e02f6d':'Cisco','e05fb9':'Cisco','e069ba':'Cisco','e0d173':'Cisco','e4aa5d':'Cisco','e4c722':'Cisco','e4d3f1':'Cisco','e8b748':'Cisco','e8edf3':'Cisco','ec1d8b':'Cisco','ec441e':'Cisco','ec4408':'Cisco','ec5d4c':'Cisco','f02fa7':'Cisco','f04a02':'Cisco','f04dd1':'Cisco','f07f06':'Cisco','f0786c':'Cisco','f4cfe2':'Cisco','f4ea67':'Cisco','f8c288':'Cisco','f8e4fb':'Cisco','f8e7b6':'Cisco','f8e8ee':'Cisco','fc5b39':'Cisco','fc99478':'Cisco',
  '0017c5':'Aruba','000b86':'Aruba','24de80':'Aruba','405539':'Aruba','6c0b84':'Aruba','94b40f':'Aruba','d8c7c8':'Aruba','f01fa1':'Aruba',
  '0010db':'Juniper','000585':'Juniper','000c66':'Juniper','002283':'Juniper','002405':'Juniper','002579':'Juniper','008096':'Juniper','008c10':'Juniper','30b6f8':'Juniper','3c8ab0':'Juniper','40a8f0':'Juniper','4c16fc':'Juniper','5400e3':'Juniper','680664':'Juniper','78fe3d':'Juniper','7c9bd6':'Juniper','80ac9d':'Juniper','847b40':'Juniper','9c8a45':'Juniper','b00cd1':'Juniper','d8b122':'Juniper','ec3eb4':'Juniper','ecb1d7':'Juniper','f4cc55':'Juniper',
  '00006d':'Cray','000af7':'Lantronix','000c29':'VMware',
  '00248c':'Asus','002618':'Asus','047d7b':'Asus','08606e':'Asus','1c872c':'Asus','30074d':'Samsung','d022be':'Samsung','5c0a5b':'Samsung','78f7be':'Samsung','c8a823':'Samsung',
  '001517':'Apple','001b63':'Apple','001ec2':'Apple','002241':'Apple','002500':'Apple','002608':'Apple','0026b0':'Apple','0026bb':'Apple','0050e4':'Apple','08746c':'Apple','0c30be':'Apple','0c3e9f':'Apple','0c4de9':'Apple','0c74c2':'Apple','0c771a':'Apple','100049':'Apple','10417f':'Apple','109add':'Apple','14109f':'Apple','14bd61':'Apple','181eb0':'Apple','18af8f':'Apple','18e7f4':'Apple','1cabA7':'Apple','1ce62b':'Apple','203cae':'Apple','2477033':'Apple','24a074':'Apple','28cfda':'Apple','28e02c':'Apple','28e7cf':'Apple','30636b':'Apple','3035ad':'Apple','3090ab':'Apple','30f7c5':'Apple','34159e':'Apple','3408bc':'Apple','38484c':'Apple','3895d6':'Apple','3c0754':'Apple','3c15c2':'Apple','3ce072':'Apple','40a6d9':'Apple','40b395':'Apple','40d32d':'Apple','44d884':'Apple','4860bc':'Apple','489095':'Apple','48a195':'Apple','4c8d79':'Apple','4cb199':'Apple','5006e5':'Apple','5482dd':'Apple','58404e':'Apple','58b035':'Apple','5cadcf':'Apple','5cf5da':'Apple','5cf938':'Apple','60334b':'Apple','60f445':'Apple','64200c':'Apple','64a3cb':'Apple','64b9e8':'Apple','64e682':'Apple','680927':'Apple','68ae20':'Apple','68a86d':'Apple','68d93c':'Apple','6c4008':'Apple','6c8336':'Apple','6c94f8':'Apple','7014a6':'Apple','7081eb':'Apple','7831c1':'Apple','78fd94':'Apple','7c6d62':'Apple','7cd1c3':'Apple','7cf05f':'Apple','7cfadf':'Apple','80929f':'Apple','80be05':'Apple','80ed2c':'Apple','84788b':'Apple','848e0c':'Apple','84fcfe':'Apple','88c663':'Apple','88e87f':'Apple','8866a5':'Apple','8c2937':'Apple','8c8590':'Apple','8c8ef2':'Apple','9027e4':'Apple','9060f1':'Apple','90840d':'Apple','90b21f':'Apple','94e96a':'Apple','98109e':'Apple','98b8e3':'Apple','98e0d9':'Apple','9c20f2':'Apple','9c4fda':'Apple','9c8be4':'Apple','9cf48e':'Apple','a0999b':'Apple','a4b197':'Apple','a4c361':'Apple','a4d18c':'Apple','a83c11':'Apple','a8867c':'Apple','a886dd':'Apple','a8be27':'Apple','ac1f74':'Apple','ac293a':'Apple','ac3c0b':'Apple','ac61ea':'Apple','ac7f3e':'Apple','ac87a3':'Apple','b03495':'Apple','b09fba':'Apple','b418d1':'Apple','b48b19':'Apple','b8098a':'Apple','b817c2':'Apple','b8782e':'Apple','b885ee':'Apple','b8e856':'Apple','bc3baf':'Apple','bc926b':'Apple','c0847a':'Apple','c0f2fb':'Apple','c42c03':'Apple','c869cd':'Apple','c8b5b7':'Apple','c8e0eb':'Apple','c8f6500':'Apple','cc0855':'Apple','cc25ef':'Apple','cc785f':'Apple','d023db':'Apple','d0d2b0':'Apple','d49a20':'Apple','d4dccd':'Apple','d4f46f':'Apple','d8004d':'Apple','d83062':'Apple','d8a25e':'Apple','d8d1cb':'Apple','dc2b2a':'Apple','dca904':'Apple','e0acdf':'Apple','e0c97a':'Apple','e425e7':'Apple','e498d6':'Apple','e8802e':'Apple','e88d28':'Apple','ecadb8':'Apple','f0989d':'Apple','f0b479':'Apple','f0dbf8':'Apple','f0db18':'Apple','f4f15a':'Apple','f823b2':'Apple','f8d0bd':'Apple','f8e94e':'Apple','fc253f':'Apple',
  '000d3a':'HP','002655':'HP','0023ae':'HP','0024a8':'HP','002481':'HP','002522':'HP','002655':'HP','0026f1':'HP','0030c1':'HP','009c02':'HP','08eddc':'HP','1062eb':'HP','107b44':'HP','3068b6':'HP','38eaa7':'HP','3c4a92':'HP','3ca82a':'HP','40a8f0':'HP','5065f3':'HP','94ec06':'HP','9cb654':'HP','b499ba':'HP','c4346b':'HP','c89ce4':'HP','d89d67':'HP','dc7b94':'HP','f062814':'HP','f4ce46':'HP','fc15b4':'HP',
  '00050b':'SerComm','000c43':'Realtek','002354':'Realtek','525400':'KVM/QEMU',
  '0050ba':'D-Link','000d88':'D-Link','002293':'D-Link','5cd998':'D-Link','c8d3a3':'D-Link','f0b4d2':'D-Link',
  '0017a4':'Asustek','002618':'Asustek',
  '0016ec':'Elitegroup','60a44c':'Asustek',
  '00b8c2':'TP-Link','002710':'TP-Link','002795':'TP-Link','c0c1c0':'TP-Link','c46e1f':'TP-Link','d850e6':'TP-Link','f8d111':'TP-Link',
  '0014bf':'Linksys','001839':'Linksys','0016b6':'Linksys','58231d':'Linksys','c0568d':'Linksys',
  '0017c5':'Aruba','002c25':'Brocade','0008e3':'Brocade','000c4a':'Brocade','0024c4':'Brocade','9cc4ad':'Brocade','c4b9cd':'Foundry/Brocade',
  '0017df':'Cisco-Linksys','001a70':'Cisco-Linksys','001d7e':'Cisco-Linksys','002129':'Cisco-Linksys','002369':'Cisco-Linksys',
  '0024c8':'Belkin','94103e':'Belkin','94440a':'Belkin',
  '00045a':'Linksys','000625':'Linksys','000c41':'Linksys','000f66':'Linksys','00134a':'Linksys','0014a4':'Linksys','0014bf':'Linksys',
  '00059a':'Cisco-IAS','c80aa9':'Quanta','9cb6d0':'RIVERBED',
  '001125':'IBM','001a64':'IBM','005056':'VMware','000d54':'IBM','002545':'IBM','000a3d':'IBM','b0833f':'IBM',
  '00ab02':'Catalyst (Cisco)',
  '00050d':'Itouch','00007b':'Sun','000020':'DataPoint',
  '000086':'Megahertz','000093':'Proteon','0000c6':'HP-Convex',
  '0021a4':'F5','0001d7':'F5','d4ae52':'F5',
  '74dafd':'Fortinet','004045':'Fortinet','0009f4':'Fortinet','9069a1':'Fortinet',
  '0010ee':'Allied Telesyn','08000f':'Mitel',
  '00125a':'Microsoft','d89c67':'Microsoft','7c1eb3':'Microsoft','7c0011':'Microsoft','94de8068':'Microsoft','d4f5ef':'Microsoft','c83a35':'Microsoft','dca632':'Raspberry Pi','b827eb':'Raspberry Pi','dca632':'Raspberry Pi','e45f01':'Raspberry Pi','d83adda':'Raspberry Pi',
  '7cdd90':'Shenzhen','000fb5':'Netgear','000f12':'Netgear','0014d1':'Netgear','001b2f':'Netgear','001e2a':'Netgear','001f33':'Netgear','002275':'Netgear','002927':'Netgear','30469a':'Netgear','744401':'Netgear','b03e8e':'Netgear',
  '0017f2':'Apple','000a95':'Apple','000a27':'Apple','001451':'Apple','001124':'Apple','0014a5':'Apple','001b63':'Apple','001ce6':'Apple','001d4f':'Apple','001ec2':'Apple','001ff3':'Apple','002241':'Apple','002312':'Apple','0023df':'Apple','002436':'Apple','002500':'Apple','0025bc':'Apple','0026b0':'Apple','0026bb':'Apple','002608':'Apple',
  '00904c':'Epigram','000ba9':'AAEON','0008e8':'GIGAFAST',
  // Common multicast / well-known MACs
  '0180c2':'Bridge group / STP / LACP (IEEE 802.1)','01005e':'IPv4 multicast','333300':'IPv6 multicast','00005e':'VRRP/HSRP / IANA',
};

// Common locally-administered + well-known patterns
const PATTERNS = [
  { test: m => m.startsWith('00005e0001'), label: 'VRRP virtual MAC (IPv4)' },
  { test: m => m.startsWith('00005e0002'), label: 'VRRP virtual MAC (IPv6)' },
  { test: m => m.startsWith('0000c0') || m.startsWith('00000c'), label: 'HSRP virtual MAC' },
  { test: m => m.startsWith('0007b4'), label: 'HSRP IPv6 virtual MAC' },
  { test: m => m === 'ffffffffffff', label: 'Broadcast' },
  { test: m => m.startsWith('01005e'), label: 'IPv4 multicast' },
  { test: m => m.startsWith('3333'),    label: 'IPv6 multicast' },
  { test: m => m.startsWith('0180c2'),  label: 'IEEE 802.1 reserved (STP/LACP/LLDP)' },
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">MAC / OUI lookup</h2>
    <div class="form-row" style="grid-column:1/-1">
      <label>MAC address(es) — one per line, any format</label>
      <textarea id="mInput" placeholder="00:50:56:c0:00:01&#10;00-1c-58-ab-cd-ef&#10;0050.5612.3456&#10;001A4Aabcdef"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="mLookup">Lookup</button>
      <button class="btn" id="mCsv">Export CSV</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="mInfo">Built-in OUI list — ${Object.keys(OUI).length}+ vendors. Universal/local + multicast/broadcast detected too.</span>
    </div>
    <div id="mOut"></div>`;

  const lookup = () => {
    const lines = root.querySelector('#mInput').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const rows = lines.map(parseAndLookup);
    root.querySelector('#mOut').innerHTML = renderTable(rows);
  };

  root.querySelector('#mLookup').addEventListener('click', lookup);
  root.querySelector('#mInput').addEventListener('input', lookup);
  root.querySelector('#mCsv').addEventListener('click', () => {
    const lines = root.querySelector('#mInput').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if (!lines.length) { toast('No MACs to export', 'error'); return; }
    const rows = lines.map(parseAndLookup);
    const header = 'Input,Normalised,Colon,Dash,Cisco-dot,Bare,Vendor,Type,U/L,I/G\r\n';
    const csv = header + rows.map(r => [r.input, r.norm||'', r.colon||'', r.dash||'', r.dotted||'', r.bare||'', r.vendor||'', r.notes||'', r.ul||'', r.ig||''].map(csvEsc).join(',')).join('\r\n') + '\r\n';
    downloadCsv('mac-lookup.csv', csv);
  });
}

function parseAndLookup(input) {
  const bare = input.replace(/[^0-9a-f]/gi, '').toLowerCase();
  if (bare.length !== 12) {
    return { input, error: 'Not a 48-bit MAC' };
  }
  const oui = bare.slice(0,6);
  let vendor = OUI[oui] || null;
  let notes = '';
  for (const p of PATTERNS) { if (p.test(bare)) { notes = p.label; break; } }
  if (!vendor && notes) vendor = notes;
  // Bit flags from first octet
  const o1 = parseInt(bare.slice(0,2),16);
  const ig = (o1 & 0x01) ? 'Group (multicast)' : 'Individual (unicast)';
  const ul = (o1 & 0x02) ? 'Locally administered' : 'Universally administered (vendor-assigned)';
  return {
    input,
    bare,
    norm: bare.toUpperCase().replace(/(.{2})/g, '$1:').slice(0,17),
    colon: bare.replace(/(.{2})/g, '$1:').slice(0,17),
    dash:  bare.replace(/(.{2})/g, '$1-').slice(0,17),
    dotted: bare.match(/.{4}/g).join('.'),
    vendor: vendor || 'Unknown',
    notes,
    ul, ig, oui
  };
}

function renderTable(rows) {
  if (!rows.length) return '<div class="page-empty">No MACs.</div>';
  return `<table class="lc-table" style="margin-top:8px"><thead><tr>
    <th>Input</th><th>Vendor / Type</th><th>Normalised</th><th>Cisco</th><th>U/L</th><th>I/G</th></tr></thead>
    <tbody>${rows.map(r => r.error
      ? `<tr><td>${esc(r.input)}</td><td colspan="5" style="color:var(--warn,#b91c1c)">${esc(r.error)}</td></tr>`
      : `<tr><td><code>${esc(r.input)}</code></td><td><b>${esc(r.vendor)}</b>${r.notes && r.notes !== r.vendor ? ' <span class="hint">' + esc(r.notes) + '</span>' : ''}</td><td><code>${esc(r.colon)}</code></td><td><code>${esc(r.dotted)}</code></td><td>${esc(r.ul)}</td><td>${esc(r.ig)}</td></tr>`).join('')}
    </tbody></table>`;
}

function esc(s) { return String(s ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }
function csvEsc(v) { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function downloadCsv(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
