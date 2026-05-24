// ARP + MAC address table merge.
//   Box 1 — paste a Cisco / IOS-XE / Nexus / ASA ARP table (show ip arp).
//   Box 2 — paste the switch's MAC address table (show mac address-table).
//   Box 3 — merged results joined on MAC: IP · MAC · Vendor · VLAN · Port · Type.

import { copyToClipboard, toast } from '../utils.js';
import { toCSV } from '../components/io.js';
import {
  FALLBACK_OUI, loadDb, parseArpInput, parseMacAddressTable,
  findVendor, normaliseMac, fmtMac, esc, downloadCsv
} from './oui-shared.js';

export async function mount(root) {
  let db = FALLBACK_OUI;

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">ARP + MAC table merge</h2>
    <p class="hint" style="margin-bottom:12px">Paste an <strong>ARP table</strong> in box 1 and a <strong>MAC address table</strong> in box 2. The results join on MAC address to map <code>IP → MAC → Vendor → VLAN → switchport</code>.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="form-row" style="margin:0">
        <label>Box 1 — ARP table (<code>show ip arp</code> / <code>show arp</code>)</label>
        <textarea id="arpIn" rows="10" placeholder="Internet  10.0.0.1     -    001a.b3c4.5678  ARPA  Vlan10&#10;Internet  10.0.0.2    12    0050.5612.3456  ARPA  Vlan10" style="font-family:'SF Mono',Consolas,monospace;font-size:12px"></textarea>
      </div>
      <div class="form-row" style="margin:0">
        <label>Box 2 — MAC address table (<code>show mac address-table</code>)</label>
        <textarea id="macIn" rows="10" placeholder="Vlan    Mac Address       Type        Ports&#10;----    -----------       --------    -----&#10;  10    001a.b3c4.5678    DYNAMIC     Gi1/0/5&#10;  10    0050.5612.3456    DYNAMIC     Gi1/0/12" style="font-family:'SF Mono',Consolas,monospace;font-size:12px"></textarea>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin:14px 0;flex-wrap:wrap;align-items:center">
      <span style="font-size:12px;font-weight:600">MAC format:</span>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="colon" checked> Colon</label>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="dash"> Dash</label>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="dotted"> Cisco dotted</label>
      <span class="spacer" style="flex:1"></span>
      <button class="btn primary" id="mgGo">Merge</button>
      <button class="btn" id="mgCsv">Export CSV</button>
      <button class="btn" id="mgCopy">Copy as CSV</button>
      <span class="hint" id="mInfo">Loading IEEE OUI database…</span>
    </div>

    <div class="form-row" style="margin:0">
      <label>Box 3 — Merged results</label>
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
    const fmt = root.querySelector('input[name="mgFmt"]:checked')?.value || 'colon';

    const macTableMap = new Map();
    for (const e of macTable) {
      const k = normaliseMac(e.mac);
      if (k) macTableMap.set(k, e);
    }

    const merged = new Map();
    for (const r of arpRows) {
      const k = r.bare;
      if (!k) continue;
      merged.set(k, {
        mac: fmtMac(k, fmt), bare: k,
        ip: r.ip || '', vendor: r.vendor || '',
        vlan: '', interface: r.iface || '', type: ''
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
      if (e.ports) row.interface = e.ports;   // mac-address-table switchport wins
      if (e.type) row.type = e.type;
    }

    mergedRows = [...merged.values()].sort((a, b) => {
      const va = +a.vlan || 0, vb = +b.vlan || 0;
      if (va !== vb) return va - vb;
      return a.bare.localeCompare(b.bare);
    });
    paintMerge();
  }

  function paintMerge() {
    if (!mergedRows.length) {
      $('#mgOut').innerHTML = '<div class="page-empty" style="padding:12px;font-size:12px">Paste an ARP table and/or a MAC address table above, then click <strong>Merge</strong>.</div>';
      return;
    }
    $('#mgOut').innerHTML = `
      <table class="lc-table" style="margin-top:6px">
        <thead><tr>
          <th>VLAN</th><th>IP</th><th>MAC</th><th>Vendor</th><th>Interface / Port</th><th>Type</th><th style="width:80px">Copy</th>
        </tr></thead>
        <tbody>
          ${mergedRows.map(r => `<tr>
            <td>${esc(r.vlan)}</td>
            <td><code>${esc(r.ip)}</code></td>
            <td><code>${esc(r.mac)}</code></td>
            <td>${esc(r.vendor)}</td>
            <td>${esc(r.interface)}</td>
            <td>${esc(r.type)}</td>
            <td>
              <button class="btn sm ghost" data-copy="${esc(r.mac)}" title="Copy MAC">⧉ M</button>
              ${r.ip ? `<button class="btn sm ghost" data-copy="${esc(r.ip)}" title="Copy IP">⧉ IP</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="hint" style="margin-top:6px">${mergedRows.length} merged rows · joined on MAC</div>`;
    $('#mgOut').querySelectorAll('button[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await copyToClipboard(btn.dataset.copy);
        const t = btn.textContent; btn.textContent = ok ? '✓' : '✗';
        setTimeout(() => { btn.textContent = t; }, 900);
      });
    });
  }

  function exportRows() {
    return mergedRows.map(r => ({ VLAN: r.vlan, IP: r.ip, MAC: r.mac, Vendor: r.vendor, Interface: r.interface, Type: r.type }));
  }

  $('#mgGo').addEventListener('click', runMerge);
  $('#arpIn').addEventListener('input', runMerge);
  $('#macIn').addEventListener('input', runMerge);
  root.querySelectorAll('input[name="mgFmt"]').forEach(r => r.addEventListener('change', () => {
    const fmt = root.querySelector('input[name="mgFmt"]:checked').value;
    mergedRows = mergedRows.map(r => ({ ...r, mac: fmtMac(r.bare, fmt) }));
    paintMerge();
  }));
  $('#mgCsv').addEventListener('click', () => {
    if (!mergedRows.length) { toast('Nothing to export', 'error'); return; }
    downloadCsv('arp-mac-merge.csv', toCSV(exportRows(), ['VLAN','IP','MAC','Vendor','Interface','Type']));
  });
  $('#mgCopy').addEventListener('click', async () => {
    if (!mergedRows.length) { toast('Nothing to copy', 'error'); return; }
    const ok = await copyToClipboard(toCSV(exportRows(), ['VLAN','IP','MAC','Vendor','Interface','Type']));
    toast(ok ? 'CSV copied' : 'Copy failed', ok ? 'success' : 'error');
  });

  paintMerge();
}
