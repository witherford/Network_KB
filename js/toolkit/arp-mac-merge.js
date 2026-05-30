// Cisco merger — the ultimate interface-to-device mapping tool.
//   Box 1 — ARP table          (show ip arp / show arp)        → IP ↔ MAC
//   Box 2 — MAC address table  (show mac address-table)        → MAC ↔ VLAN ↔ port
//   Box 3 — CDP neighbours     (show cdp neighbors [detail])   → port ↔ neighbour
//   Box 4 — LLDP neighbours    (show lldp neighbors [detail])  → port ↔ neighbour
//   Box 5 — DNS lookups         (nslookup / dig / host / ping -a) → IP ↔ hostname
//   Box 6 — Ping results        (ping, Windows or Linux)          → IP ↔ reachability
//   Final output — merged results joining everything by MAC, interface and IP.

import { copyToClipboard, toast } from '../utils.js';
import { toCSV } from '../components/io.js';
import {
  FALLBACK_OUI, loadDb, parseArpInput, parseMacAddressTable,
  parseCdp, parseLldp, parseDns, parsePing, normIface, findVendor, normaliseMac, fmtMac, esc, downloadCsv
} from './oui-shared.js';

const ARP_EG = `Internet  10.0.0.1     -    001a.b3c4.5678  ARPA  Vlan10\nInternet  10.0.0.2    12    0050.5612.3456  ARPA  Vlan10`;
const MAC_EG = `Vlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n  10    001a.b3c4.5678    DYNAMIC     Gi1/0/5\n  10    0050.5612.3456    DYNAMIC     Gi1/0/12`;
const CDP_EG = `Device ID: Switch2.example.com\nEntry address(es):\n  IP address: 10.0.0.250\nPlatform: cisco WS-C2960X,  Capabilities: Switch IGMP\nInterface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet0/24`;
const LLDP_EG = `Local Intf: Gi1/0/12\nChassis id: aabb.ccdd.eeff\nPort id: Gi0/2\nSystem Name: AP-Floor1\nSystem Description: Cisco Aironet AP\nManagement Addresses:\n    IP: 10.0.0.30`;
const DNS_EG = `Name:    server1.example.com\nAddress:  10.0.0.2\n\n1.0.0.10.in-addr.arpa   name = gateway.example.com.`;
const PING_EG = `Reply from 10.0.0.2: bytes=32 time=1ms TTL=128\n\n--- 10.0.0.1 ping statistics ---\n4 packets transmitted, 0 received, 100% packet loss`;

export async function mount(root) {
  let db = FALLBACK_OUI;

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Cisco merger — interface ↔ device mapping</h2>
    <p class="hint" style="margin-bottom:12px">Paste any combination of the outputs below. The merger joins them into one map: <code>DNS name → IP → MAC → Vendor → VLAN → switchport → connected device</code>. ARP and MAC-table rows join on MAC; CDP and LLDP neighbours attach by switchport; DNS lookups marry a hostname to its IP; ping results flag reachability — so every endpoint and every neighbouring switch/AP/phone lands on the right interface.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="form-row" style="margin:0">
        <label>Box 1 — ARP table (<code>show ip arp</code>)</label>
        <textarea id="arpIn" rows="7" placeholder="${esc(ARP_EG)}" style="font-family:'SF Mono',Consolas,monospace;font-size:12px">${esc(ARP_EG)}</textarea>
      </div>
      <div class="form-row" style="margin:0">
        <label>Box 2 — MAC address table (<code>show mac address-table</code>)</label>
        <textarea id="macIn" rows="7" placeholder="${esc(MAC_EG)}" style="font-family:'SF Mono',Consolas,monospace;font-size:12px">${esc(MAC_EG)}</textarea>
      </div>
      <div class="form-row" style="margin:0">
        <label>Box 3 — CDP neighbours (<code>show cdp neighbors detail</code>)</label>
        <textarea id="cdpIn" rows="7" placeholder="${esc(CDP_EG)}" style="font-family:'SF Mono',Consolas,monospace;font-size:12px">${esc(CDP_EG)}</textarea>
      </div>
      <div class="form-row" style="margin:0">
        <label>Box 4 — LLDP neighbours (<code>show lldp neighbors detail</code>)</label>
        <textarea id="lldpIn" rows="7" placeholder="${esc(LLDP_EG)}" style="font-family:'SF Mono',Consolas,monospace;font-size:12px">${esc(LLDP_EG)}</textarea>
      </div>
      <div class="form-row" style="margin:0;grid-column:1 / -1">
        <label>Box 5 — DNS lookups (<code>nslookup</code> / <code>dig</code> / <code>host</code> / <code>ping -a</code>, Windows or Linux)</label>
        <textarea id="dnsIn" rows="6" placeholder="${esc(DNS_EG)}" style="font-family:'SF Mono',Consolas,monospace;font-size:12px">${esc(DNS_EG)}</textarea>
      </div>
      <div class="form-row" style="margin:0;grid-column:1 / -1">
        <label>Box 6 — Ping results (<code>ping</code>, Windows or Linux)</label>
        <textarea id="pingIn" rows="6" placeholder="${esc(PING_EG)}" style="font-family:'SF Mono',Consolas,monospace;font-size:12px">${esc(PING_EG)}</textarea>
      </div>
    </div>

    <div style="display:flex;gap:14px;margin:14px 0 6px;flex-wrap:wrap;align-items:center">
      <span style="font-size:12px;font-weight:600">MAC format:</span>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="colon" checked> Colon</label>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="dash"> Dash</label>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="dotted"> Cisco dotted</label>
      <span class="spacer" style="flex:1"></span>
      <button class="btn primary" id="mgGo">Merge</button>
      <button class="btn" id="mgCsv">Export CSV</button>
      <button class="btn" id="mgCopy">Copy as CSV</button>
    </div>

    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:8px;font-size:12px;margin-bottom:14px">
      <span style="font-weight:600">Filters:</span>
      <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="fHideVlan"> Hide VLAN/SVI interfaces</label>
      <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="fHidePo"> Hide port-channel interfaces</label>
      <span style="width:1px;height:16px;background:var(--border)"></span>
      <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="fKnown"> Known vendors only</label>
      <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="fUnknown"> Unknown vendors only</label>
      <span style="width:1px;height:16px;background:var(--border)"></span>
      <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="fResolved"> Resolved DNS names only</label>
      <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="fUnresolved"> Unresolved DNS names only</label>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="mInfo">Loading IEEE OUI database…</span>
    </div>

    <div class="form-row" style="margin:0">
      <label>Final output, merged results table</label>
      <div id="mgOut"></div>
    </div>`;

  const $ = sel => root.querySelector(sel);

  function updateInfoLine() {
    const el = $('#mInfo');
    if (el) el.textContent = `${Object.keys(db).length.toLocaleString()} OUI entries`;
  }
  loadDb().then(loaded => { db = loaded; updateInfoLine(); runMerge(); });

  let mergedRows = [];

  function runMerge() {
    const arpRows = parseArpInput($('#arpIn').value, db);
    const macTable = parseMacAddressTable($('#macIn').value);
    const cdp = parseCdp($('#cdpIn').value);
    const lldp = parseLldp($('#lldpIn').value);
    const dnsMap = parseDns($('#dnsIn').value);
    const pingMap = parsePing($('#pingIn').value);
    const fmt = root.querySelector('input[name="mgFmt"]:checked')?.value || 'colon';

    // Resolve an IP to its (comma-separated) DNS name(s).
    const dnsFor = ip => (ip && dnsMap.get(ip) || []).join(', ');
    // Reachability for an IP: 'Yes' / 'No' / '' when no ping data exists.
    const pingFor = ip => (ip && pingMap.has(ip)) ? (pingMap.get(ip) ? 'Yes' : 'No') : '';

    // Neighbours keyed by canonical local interface.
    const nbr = new Map();
    function addNbr(list, via) {
      for (const n of list) {
        const key = normIface(n.localIf);
        if (!key) continue;
        let o = nbr.get(key);
        if (!o) { o = { iface: key, cdpDev: '', lldpDev: '', remotePort: '', platform: '', mgmtIp: '', via: new Set() }; nbr.set(key, o); }
        if (via === 'CDP') o.cdpDev = n.neighbor || o.cdpDev;
        else o.lldpDev = n.neighbor || o.lldpDev;
        o.remotePort = o.remotePort || n.remotePort || '';
        o.platform = o.platform || n.platform || '';
        o.mgmtIp = o.mgmtIp || n.mgmtIp || '';
        o.via.add(via);
      }
    }
    addNbr(cdp, 'CDP');
    addNbr(lldp, 'LLDP');

    function nbrFields(ifaceRaw) {
      const o = nbr.get(normIface(ifaceRaw));
      if (!o) return { neighbor: '', via: '', remotePort: '', platform: '', mgmtIp: '' };
      return {
        neighbor: o.cdpDev || o.lldpDev || '',
        via: [...o.via].join('+'),
        remotePort: o.remotePort, platform: o.platform, mgmtIp: o.mgmtIp
      };
    }

    // MAC-keyed rows from ARP + MAC table.
    const macTableMap = new Map();
    for (const e of macTable) { const k = normaliseMac(e.mac); if (k) macTableMap.set(k, e); }

    const merged = new Map();
    for (const r of arpRows) {
      if (!r.bare) continue;
      merged.set(r.bare, {
        mac: fmtMac(r.bare, fmt), bare: r.bare,
        ip: r.ip || '', vendor: r.vendor || '', vlan: '', interface: r.iface || '', type: ''
      });
    }
    for (const [k, e] of macTableMap.entries()) {
      let row = merged.get(k);
      if (!row) {
        const v = findVendor(db, k);
        row = { mac: fmtMac(k, fmt), bare: k, ip: '', vendor: v?.vendor || 'Unknown', vlan: '', interface: '', type: '' };
        merged.set(k, row);
      }
      if (e.vlan) row.vlan = e.vlan;
      if (e.ports) row.interface = e.ports;   // switchport wins over ARP SVI
      if (e.type) row.type = e.type;
    }

    // Attach neighbour info to each MAC row by its local port.
    const seenIfaces = new Set();
    for (const row of merged.values()) {
      Object.assign(row, nbrFields(row.interface));
      const ni = normIface(row.interface);
      if (ni) seenIfaces.add(ni);
    }

    // Add neighbour-only rows for interfaces with no learned MAC (routed links,
    // uplinks to other switches/APs) so the device map is complete.
    for (const [iface, o] of nbr.entries()) {
      if (seenIfaces.has(iface)) continue;
      merged.set('nbr:' + iface, {
        mac: '', bare: '', ip: o.mgmtIp || '', vendor: '', vlan: '', interface: iface, type: 'neighbor',
        neighbor: o.cdpDev || o.lldpDev || '', via: [...o.via].join('+'),
        remotePort: o.remotePort, platform: o.platform, mgmtIp: o.mgmtIp
      });
    }

    // Marry DNS hostname(s) and ping reachability to every row by its IP.
    for (const row of merged.values()) { row.dns = dnsFor(row.ip); row.ping = pingFor(row.ip); }

    mergedRows = [...merged.values()].sort((a, b) => {
      const va = +a.vlan || 0, vb = +b.vlan || 0;
      if (va !== vb) return va - vb;
      return (a.interface || '').localeCompare(b.interface || '') || a.bare.localeCompare(b.bare);
    });
    paintMerge();
  }

  function filteredRows() {
    const hideVlan = $('#fHideVlan').checked;
    const hidePo = $('#fHidePo').checked;
    const known = $('#fKnown').checked;
    const unknown = $('#fUnknown').checked;
    const resolved = $('#fResolved').checked;
    const unresolved = $('#fUnresolved').checked;
    return mergedRows.filter(r => {
      const ni = normIface(r.interface);
      if (hideVlan && /^Vlan/i.test(ni)) return false;
      if (hidePo && /^Po/i.test(ni)) return false;
      // Vendor filters only apply to rows that actually have a MAC/vendor.
      if (r.bare) {
        const isUnknown = !r.vendor || r.vendor === 'Unknown';
        if (known && !unknown && isUnknown) return false;
        if (unknown && !known && !isUnknown) return false;
      }
      // DNS filters only apply to rows that actually have an IP to resolve.
      if (r.ip) {
        const hasDns = !!r.dns;
        if (resolved && !unresolved && !hasDns) return false;
        if (unresolved && !resolved && hasDns) return false;
      }
      return true;
    });
  }

  function paintMerge() {
    const rows = filteredRows();
    if (!rows.length) {
      $('#mgOut').innerHTML = `<div class="page-empty" style="padding:12px;font-size:12px">${mergedRows.length ? 'No rows match the current filters.' : 'Paste output into the boxes above, then click <strong>Merge</strong>.'}</div>`;
      return;
    }
    $('#mgOut').innerHTML = `
      <div style="overflow-x:auto">
      <table class="lc-table" style="margin-top:6px">
        <thead><tr>
          <th>VLAN</th><th>DNS name</th><th>IP</th><th>MAC</th><th>Vendor</th><th>Local port</th><th>Type</th><th>Responds to ping</th>
          <th>Neighbour</th><th>Via</th><th>Remote port</th><th>Platform / OS</th><th>Mgmt IP</th><th style="width:80px">Copy</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${esc(r.vlan)}</td>
            <td>${esc(r.dns || '')}</td>
            <td><code>${esc(r.ip)}</code></td>
            <td><code>${esc(r.mac)}</code></td>
            <td>${esc(r.vendor)}</td>
            <td><code>${esc(r.interface)}</code></td>
            <td>${esc(r.type)}</td>
            <td>${r.ping ? `<span class="tk-badge ${r.ping === 'Yes' ? 'yes' : 'no'}">${esc(r.ping)}</span>` : ''}</td>
            <td>${esc(r.neighbor || '')}</td>
            <td>${r.via ? `<span class="tk-badge info">${esc(r.via)}</span>` : ''}</td>
            <td><code>${esc(r.remotePort || '')}</code></td>
            <td>${esc(r.platform || '')}</td>
            <td><code>${esc(r.mgmtIp || '')}</code></td>
            <td>
              ${r.mac ? `<button class="btn sm ghost" data-copy="${esc(r.mac)}" title="Copy MAC">⧉ M</button>` : ''}
              ${r.ip ? `<button class="btn sm ghost" data-copy="${esc(r.ip)}" title="Copy IP">⧉ IP</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
      <div class="hint" style="margin-top:6px">${rows.length} of ${mergedRows.length} rows shown</div>`;
    $('#mgOut').querySelectorAll('button[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await copyToClipboard(btn.dataset.copy);
        const t = btn.textContent; btn.textContent = ok ? '✓' : '✗';
        setTimeout(() => { btn.textContent = t; }, 900);
      });
    });
  }

  const COLS = ['VLAN','DNS name','IP','MAC','Vendor','Local port','Type','Responds to ping','Neighbour','Via','Remote port','Platform','Mgmt IP'];
  function exportRows() {
    return filteredRows().map(r => ({
      VLAN: r.vlan, 'DNS name': r.dns || '', IP: r.ip, MAC: r.mac, Vendor: r.vendor, 'Local port': r.interface, Type: r.type,
      'Responds to ping': r.ping || '',
      Neighbour: r.neighbor || '', Via: r.via || '', 'Remote port': r.remotePort || '', Platform: r.platform || '', 'Mgmt IP': r.mgmtIp || ''
    }));
  }

  $('#mgGo').addEventListener('click', runMerge);
  ['#arpIn', '#macIn', '#cdpIn', '#lldpIn', '#dnsIn', '#pingIn'].forEach(s => $(s).addEventListener('input', runMerge));
  ['#fHideVlan', '#fHidePo', '#fKnown', '#fUnknown', '#fResolved', '#fUnresolved'].forEach(s => $(s).addEventListener('change', paintMerge));
  root.querySelectorAll('input[name="mgFmt"]').forEach(r => r.addEventListener('change', () => {
    const fmt = root.querySelector('input[name="mgFmt"]:checked').value;
    mergedRows = mergedRows.map(r => ({ ...r, mac: r.bare ? fmtMac(r.bare, fmt) : '' }));
    paintMerge();
  }));
  $('#mgCsv').addEventListener('click', () => {
    const rows = exportRows();
    if (!rows.length) { toast('Nothing to export', 'error'); return; }
    downloadCsv('cisco-merge.csv', toCSV(rows, COLS));
  });
  $('#mgCopy').addEventListener('click', async () => {
    const rows = exportRows();
    if (!rows.length) { toast('Nothing to copy', 'error'); return; }
    const ok = await copyToClipboard(toCSV(rows, COLS));
    toast(ok ? 'CSV copied' : 'Copy failed', ok ? 'success' : 'error');
  });

  runMerge();
}
