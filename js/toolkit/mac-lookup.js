// Cisco info scripts — three tools in one tab:
//   1. OUI / ARP lookup     (existing functionality + show-command generator)
//   2. MAC-table merger     (combine OUI/ARP rows with `show mac address-table` output)
//   3. TCL script generator (free-AI-driven Cisco IOS TCL generator)
//
// Backed by the bundled IEEE OUI database (data/oui.json), built from the
// public-domain Wireshark `manuf` file. Lazy-loaded on first lookup,
// service-worker cached thereafter.

import { copyToClipboard, toast } from '../utils.js';
import { toCSV } from '../components/io.js';
import { freeAi, setBusy, stripFences, AI_CREDIT } from '../components/ai-free.js';

// ===== OUI database (shared) =====================================

const FALLBACK_OUI = {
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

let _db = null;
let _dbPromise = null;
async function loadDb() {
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
      console.warn('[cisco-info] OUI DB load failed, using inline fallback:', e);
      _db = FALLBACK_OUI;
      return _db;
    }
  })();
  return _dbPromise;
}

function findVendor(db, bare) {
  const k36 = bare.slice(0, 9) + '/36';
  if (db[k36]) return { vendor: db[k36], allocation: 'MA-S /36' };
  const k28 = bare.slice(0, 7) + '/28';
  if (db[k28]) return { vendor: db[k28], allocation: 'MA-M /28' };
  const k24 = bare.slice(0, 6);
  if (db[k24]) return { vendor: db[k24], allocation: 'MA-L /24' };
  return null;
}

const COLUMNS = [
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

// ===== Shared parsing =============================================

function parseAndLookup(db, input) {
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

function parseArpInput(text, db) {
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
function parseMacAddressTable(text) {
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
    // Typical IOS layout:  10  001a.b3c4.5678  DYNAMIC  Gi1/0/5
    // First token is usually VLAN id (number) or '*' / 'All' for static.
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

// Normalise a MAC string (any common format) to bare 12-hex lowercase.
function normaliseMac(s) {
  const bare = String(s || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
  return bare.length === 12 ? bare : null;
}
function fmtMac(bare, fmt) {
  if (!bare) return '';
  if (fmt === 'dash')   return bare.match(/.{2}/g).join('-');
  if (fmt === 'dotted') return bare.match(/.{4}/g).join('.');
  return bare.match(/.{2}/g).join(':'); // colon
}

// ===== Main mount =================================================

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Cisco info scripts</h2>
    <div class="cis-tabs" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button class="ftab active" data-cis="oui">OUI / ARP lookup</button>
      <button class="ftab" data-cis="merge">MAC table merger</button>
      <button class="ftab" data-cis="tcl">TCL script generator</button>
    </div>
    <div id="cisBody"></div>`;

  const body = root.querySelector('#cisBody');
  const tabsEl = root.querySelector('.cis-tabs');
  // Kick off the DB load shared across all sub-tabs.
  let db = FALLBACK_OUI;
  loadDb().then(loaded => { db = loaded; updateInfoLine(); });

  let currentTab = 'oui';
  function setTab(t) {
    currentTab = t;
    tabsEl.querySelectorAll('.ftab').forEach(b => b.classList.toggle('active', b.dataset.cis === t));
    if (t === 'oui')   renderOui();
    if (t === 'merge') renderMerge();
    if (t === 'tcl')   renderTcl();
  }
  tabsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-cis]');
    if (b) setTab(b.dataset.cis);
  });

  // ---------- Sub-tab 1: OUI / ARP lookup ----------
  function renderOui() {
    body.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;font-weight:600">
        <input type="checkbox" id="mArp">
        Input contains a Cisco / IOS-XE / Nexus / ASA ARP table output
      </label>
      <div class="hint" id="mArpHint" style="margin-bottom:8px;display:none">
        Paste the full <code>show ip arp</code> / <code>show arp</code> output below — the parser pulls IP and MAC from each line, resolves vendors, and adds an <strong>IP</strong> column to the results table and CSV export.
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label id="mInputLabel">MAC address(es) — one per line, any format</label>
        <textarea id="mInput" placeholder="00:50:56:c0:00:01&#10;00-1c-58-ab-cd-ef&#10;0050.5612.3456&#10;001A4Aabcdef" style="min-height:100px"></textarea>
      </div>
      <details style="margin-top:8px">
        <summary style="cursor:pointer;font-size:12px;font-weight:600">Visible columns (toggle to drop from table + CSV)</summary>
        <div id="mColumns" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;padding:8px;border:1px solid var(--border);border-radius:6px"></div>
      </details>
      <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center">
        <button class="btn primary" id="mLookup">Lookup</button>
        <button class="btn" id="mCsv">Export CSV</button>
        <button class="btn" id="mCopyAll">Copy all as CSV</button>
        <span class="spacer" style="flex:1"></span>
        <span class="hint" id="mInfo">Loading IEEE OUI database…</span>
      </div>
      <div id="mOut"></div>

      <section id="mCmds" style="margin-top:18px;padding:12px;border:1px solid var(--border);border-radius:8px;display:none">
        <header style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
          <strong style="font-size:13px">Cisco show-commands for these MACs</strong>
          <span class="hint" style="font-size:11px">Paste these into a Cisco device to find which port each MAC sits on.</span>
        </header>
        <pre class="script-out" id="mCmdsPre" style="margin:0 0 8px"></pre>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm primary" id="mCmdsCopy">Copy all commands</button>
          <button class="btn sm" id="mCmdsCsv">Export commands as CSV</button>
          <span class="spacer" style="flex:1"></span>
          <span class="hint" id="mCmdsCount" style="font-size:11px"></span>
        </div>
      </section>`;

    const $ = sel => body.querySelector(sel);
    const colsEl = $('#mColumns');
    colsEl.innerHTML = COLUMNS.map(c => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px${c.arpOnly ? ';opacity:0.55' : ''}" data-col="${c.key}">
        <input type="checkbox" data-col="${c.key}" ${c.defaultOn ? 'checked' : ''}>
        ${c.label}${c.arpOnly ? ' <span class="hint">(ARP-only)</span>' : ''}
      </label>
    `).join('');

    if (db !== FALLBACK_OUI) updateInfoLine();
    function arpMode() { return $('#mArp').checked; }
    function visibleColumns() {
      const arp = arpMode();
      return COLUMNS.filter(c => {
        if (c.arpOnly && !arp) return false;
        const cb = colsEl.querySelector(`input[data-col="${c.key}"]`);
        return cb ? cb.checked : c.defaultOn;
      });
    }
    function refreshArpVisuals() {
      const arp = arpMode();
      $('#mArpHint').style.display = arp ? '' : 'none';
      $('#mInputLabel').textContent = arp
        ? 'ARP table output — paste the full output below'
        : 'MAC address(es) — one per line, any format';
      $('#mInput').placeholder = arp
        ? 'Internet  10.0.0.1                -   001a.b3c4.5678  ARPA   Vlan10\nInternet  10.0.0.2               12   0050.5612.3456  ARPA   GigabitEthernet0/1'
        : '00:50:56:c0:00:01\n00-1c-58-ab-cd-ef\n0050.5612.3456\n001A4Aabcdef';
      colsEl.querySelectorAll('label[data-col]').forEach(lb => {
        const c = COLUMNS.find(x => x.key === lb.dataset.col);
        if (c?.arpOnly) lb.style.opacity = arp ? '' : '0.55';
      });
    }
    function getRows() {
      if (arpMode()) return parseArpInput($('#mInput').value, db);
      return $('#mInput').value
        .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        .map(line => parseAndLookup(db, line));
    }
    function lookup() {
      const rows = getRows();
      const cols = visibleColumns();
      $('#mOut').innerHTML = renderTable(rows, cols, arpMode());
      $('#mOut').querySelectorAll('button[data-copy]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await copyToClipboard(btn.dataset.copy);
          const t = btn.textContent;
          btn.textContent = ok ? '✓' : '✗';
          setTimeout(() => { btn.textContent = t; }, 900);
        });
      });
      // Build the show-commands section for found MACs.
      const valid = rows.filter(r => !r.error && r.dotted);
      if (!valid.length) { $('#mCmds').style.display = 'none'; return; }
      const cmds = [];
      for (const r of valid) cmds.push(`show mac address-table address ${r.dotted}`);
      if (arpMode()) {
        cmds.push('!');
        cmds.push('! ARP-side lookups (IP → ARP entry):');
        for (const r of valid) if (r.ip) cmds.push(`show ip arp ${r.ip}`);
      }
      $('#mCmds').style.display = '';
      $('#mCmdsPre').textContent = cmds.join('\n');
      $('#mCmdsCount').textContent = `${valid.length} MAC${valid.length === 1 ? '' : 's'}` + (arpMode() ? ` · +${valid.filter(x => x.ip).length} ARP commands` : '');
    }

    $('#mLookup').addEventListener('click', lookup);
    $('#mInput').addEventListener('input', lookup);
    $('#mArp').addEventListener('change', () => { refreshArpVisuals(); lookup(); });
    colsEl.addEventListener('change', lookup);

    $('#mCsv').addEventListener('click', () => {
      const rows = getRows();
      if (!rows.length) { toast('Nothing to export', 'error'); return; }
      const cols = visibleColumns();
      const csv = toCSV(rows.map(r => Object.fromEntries(cols.map(c => [c.label, r[c.key] ?? '']))), cols.map(c => c.label));
      downloadCsv(arpMode() ? 'arp-oui-lookup.csv' : 'mac-lookup.csv', csv);
    });
    $('#mCopyAll').addEventListener('click', async () => {
      const rows = getRows();
      if (!rows.length) { toast('No rows', 'error'); return; }
      const cols = visibleColumns();
      const csv = toCSV(rows.map(r => Object.fromEntries(cols.map(c => [c.label, r[c.key] ?? '']))), cols.map(c => c.label));
      const ok = await copyToClipboard(csv);
      toast(ok ? 'CSV copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
    });
    $('#mCmdsCopy').addEventListener('click', () => {
      const text = $('#mCmdsPre').textContent;
      if (!text) { toast('No commands', 'error'); return; }
      copyToClipboard(text).then(ok => toast(ok ? 'Commands copied' : 'Copy failed', ok ? 'success' : 'error'));
    });
    $('#mCmdsCsv').addEventListener('click', () => {
      const text = $('#mCmdsPre').textContent;
      if (!text) { toast('No commands', 'error'); return; }
      // Each non-comment line is a separate command; produce two-column CSV with index + command.
      const lines = text.split('\n').filter(l => l && !l.startsWith('!'));
      const csv = toCSV(lines.map((c, i) => ({ '#': i + 1, command: c })), ['#', 'command']);
      downloadCsv('cisco-show-commands.csv', csv);
    });

    refreshArpVisuals();
  }

  // ---------- Sub-tab 2: MAC table merger ----------
  function renderMerge() {
    body.innerHTML = `
      <p class="hint" style="margin-bottom:10px">
        Paste your <strong>OUI / ARP lookup output</strong> on the left and your <strong>show mac address-table</strong> output on the right. The merger joins on MAC and produces unified rows: <code>IP · MAC · Vendor · VLAN · Interface · Type</code>.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-row">
          <label>OUI / ARP results (paste the table or our CSV export)</label>
          <textarea id="mgLeft" rows="10" placeholder="10.0.0.1   Vlan10   Cisco Systems   001a.b3c4.5678&#10;10.0.0.2   Vlan10   VMware          0050.5612.3456" style="font-family:'SF Mono',Consolas,monospace;font-size:12px"></textarea>
        </div>
        <div class="form-row">
          <label><code>show mac address-table</code> output</label>
          <textarea id="mgRight" rows="10" placeholder="Vlan    Mac Address       Type        Ports&#10;----    -----------       --------    -----&#10;  10    001a.b3c4.5678    DYNAMIC     Gi1/0/5&#10;  10    0050.5612.3456    DYNAMIC     Gi1/0/12" style="font-family:'SF Mono',Consolas,monospace;font-size:12px"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin:14px 0;flex-wrap:wrap;align-items:center">
        <span style="font-size:12px;font-weight:600">MAC format:</span>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="colon" checked> Colon (00:1a:b3:c4:56:78)</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="dash"> Dash (00-1a-b3-c4-56-78)</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="mgFmt" value="dotted"> Cisco dotted (001a.b3c4.5678)</label>
        <span class="spacer" style="flex:1"></span>
        <button class="btn primary" id="mgGo">Merge</button>
        <button class="btn" id="mgCsv">Export CSV</button>
        <button class="btn" id="mgCopy">Copy as CSV</button>
      </div>
      <div id="mgOut"></div>`;

    const $ = sel => body.querySelector(sel);
    let lastRows = [];

    function merge() {
      const left = $('#mgLeft').value;
      const right = $('#mgRight').value;
      const fmt = body.querySelector('input[name="mgFmt"]:checked')?.value || 'colon';

      // Build map keyed by bare MAC from each input.
      const macTable = parseMacAddressTable(right);  // [{vlan, mac, type, ports}]
      const macTableMap = new Map();
      for (const e of macTable) {
        const k = normaliseMac(e.mac);
        if (k) macTableMap.set(k, e);
      }

      // Left side: try to parse as ARP first; if zero results, parse as plain MAC list / CSV.
      let leftRows = parseArpInput(left, db);
      if (!leftRows.length) {
        leftRows = left.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
          const r = parseAndLookup(db, line);
          // Try to grab any IP in the line so CSV-style left input still finds IPs.
          const ipM = line.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
          if (ipM && !r.ip) r.ip = ipM[1];
          return r;
        }).filter(r => !r.error);
      }

      // Build the merged set keyed by MAC. Include rows that exist in either side.
      const merged = new Map();
      for (const r of leftRows) {
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
          // MAC seen only in mac-address-table; try to enrich vendor from DB.
          const v = findVendor(db, k);
          row = { mac: fmtMac(k, fmt), bare: k, ip: '', vendor: v?.vendor || 'Unknown', vlan: '', interface: '', type: '' };
          merged.set(k, row);
        }
        if (e.vlan) row.vlan = e.vlan;
        // Prefer mac-address-table interface (it's the actual switchport).
        if (e.ports) row.interface = e.ports;
        if (e.type) row.type = e.type;
      }

      lastRows = [...merged.values()].sort((a, b) => {
        const va = +a.vlan || 0, vb = +b.vlan || 0;
        if (va !== vb) return va - vb;
        return a.bare.localeCompare(b.bare);
      });
      renderMergeTable();
    }

    function renderMergeTable() {
      if (!lastRows.length) { $('#mgOut').innerHTML = '<div class="page-empty">Paste data and click Merge.</div>'; return; }
      $('#mgOut').innerHTML = `
        <table class="lc-table" style="margin-top:6px">
          <thead><tr>
            <th>VLAN</th><th>IP</th><th>MAC</th><th>Vendor</th><th>Interface / Port</th><th>Type</th><th style="width:80px">Copy</th>
          </tr></thead>
          <tbody>
            ${lastRows.map(r => `<tr>
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
        <div class="hint" style="margin-top:6px">${lastRows.length} merged rows · joined on MAC</div>`;
      $('#mgOut').querySelectorAll('button[data-copy]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await copyToClipboard(btn.dataset.copy);
          const t = btn.textContent; btn.textContent = ok ? '✓' : '✗';
          setTimeout(() => { btn.textContent = t; }, 900);
        });
      });
    }

    $('#mgGo').addEventListener('click', merge);
    $('#mgLeft').addEventListener('input', merge);
    $('#mgRight').addEventListener('input', merge);
    body.querySelectorAll('input[name="mgFmt"]').forEach(r => r.addEventListener('change', () => {
      // Re-format MACs in already-merged rows.
      const fmt = body.querySelector('input[name="mgFmt"]:checked').value;
      lastRows = lastRows.map(r => ({ ...r, mac: fmtMac(r.bare, fmt) }));
      renderMergeTable();
    }));
    $('#mgCsv').addEventListener('click', () => {
      if (!lastRows.length) { toast('Nothing to export', 'error'); return; }
      const csv = toCSV(lastRows.map(r => ({ VLAN: r.vlan, IP: r.ip, MAC: r.mac, Vendor: r.vendor, Interface: r.interface, Type: r.type })), ['VLAN','IP','MAC','Vendor','Interface','Type']);
      downloadCsv('mac-merge.csv', csv);
    });
    $('#mgCopy').addEventListener('click', async () => {
      if (!lastRows.length) { toast('Nothing to copy', 'error'); return; }
      const csv = toCSV(lastRows.map(r => ({ VLAN: r.vlan, IP: r.ip, MAC: r.mac, Vendor: r.vendor, Interface: r.interface, Type: r.type })), ['VLAN','IP','MAC','Vendor','Interface','Type']);
      const ok = await copyToClipboard(csv);
      toast(ok ? 'CSV copied' : 'Copy failed', ok ? 'success' : 'error');
    });
  }

  // ---------- Sub-tab 3: TCL script generator ----------
  function renderTcl() {
    body.innerHTML = `
      <p class="hint" style="margin-bottom:10px">
        Describe what you want a Cisco IOS TCL script to do — in plain English. The free AI generates a working script using Cisco's <code>cli</code> and <code>tclsh</code> integration. Always review and test in a lab before running in production.
      </p>
      <div class="form-row">
        <label>What should the script do?</label>
        <textarea id="tclDesc" rows="4" placeholder="e.g. Loop through every interface, run 'show interfaces transceiver detail', flag any whose Tx power is below -7 dBm, and email the result via SMTP."></textarea>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
        <span style="font-size:12px">Quick examples:</span>
        <button class="btn sm ghost" data-ex="ex1">Reload schedule</button>
        <button class="btn sm ghost" data-ex="ex2">Save running-config to TFTP</button>
        <button class="btn sm ghost" data-ex="ex3">Loop ping a list of IPs</button>
        <button class="btn sm ghost" data-ex="ex4">Audit interfaces in down state</button>
        <button class="btn sm ghost" data-ex="ex5">Bulk-add VLANs from a list</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
        <button class="btn primary" id="tclGo">Generate via free AI</button>
        <button class="btn" id="tclCopy">Copy script</button>
        <button class="btn ghost" id="tclDl">Download .tcl</button>
        <span class="spacer" style="flex:1"></span>
        <span class="hint" id="tclStatus"></span>
      </div>
      <pre class="script-out" id="tclOut" style="min-height:160px;max-height:520px;overflow:auto"></pre>
      <div id="tclNotes" style="margin-top:10px"></div>
      <div class="hint" style="margin-top:10px;font-size:11px">${esc(AI_CREDIT)}</div>`;

    const $ = sel => body.querySelector(sel);
    const SAMPLES = {
      ex1: 'Schedule a controlled reload at 02:00 local time, but only if no users are connected via VTY/SSH and the running-config has been saved to startup-config.',
      ex2: 'Copy the running-config to a TFTP server at 10.50.50.50 with a filename of <hostname>-<YYYYMMDD-HHMM>.cfg.',
      ex3: 'Take a list of IPs from a TCL list, ping each one 5 times, and print a summary table of which were reachable.',
      ex4: 'Walk every interface, print one line per interface that is administratively up but line-protocol down, including the description and last input/output counters.',
      ex5: 'Take a TCL list of VLAN IDs and names, create each VLAN if it does not exist, name it, and add it to a trunk on Gi1/0/24.'
    };
    body.querySelectorAll('button[data-ex]').forEach(b => b.addEventListener('click', () => { $('#tclDesc').value = SAMPLES[b.dataset.ex] || ''; }));

    $('#tclGo').addEventListener('click', async () => {
      const desc = $('#tclDesc').value.trim();
      if (!desc) { toast('Describe what the script should do', 'warn'); return; }
      $('#tclGo').disabled = true;
      setBusy($('#tclStatus'), true, 'Generating TCL…');
      try {
        const system = `You write Cisco IOS / IOS-XE TCL scripts that run inside the device's tclsh. Rules:
1. Output ONLY the TCL script. No prose, no Markdown, no code fences.
2. Begin with a brief comment header (# author/purpose/usage line).
3. Use the Cisco "cli" and "exec" interfaces correctly: e.g. "set rc [exec \\"show running-config\\"]".
4. Wrap risky commands (config changes, reloads) in checks where the user said to.
5. If the requested action requires features beyond plain TCL (SMTP, complex parsing) and there's no built-in, use the closest approximation Cisco IOS TCL supports and add a comment explaining the limitation.
6. Quote interface names and VLAN IDs correctly.
7. Use TCL variables for any value that should be configurable; declare them at the top.
8. End with a clear "puts" line indicating success.`;
        const raw = await freeAi({ prompt: desc, system });
        const script = stripFences(raw);
        $('#tclOut').textContent = script;
        $('#tclStatus').textContent = 'Done';
        $('#tclNotes').innerHTML = `
          <div class="hint" style="background:rgba(245,158,11,0.1);border-left:3px solid #f59e0b;padding:8px 10px;border-radius:4px;font-size:11px;line-height:1.5">
            <strong>Before running:</strong> Save the script as a <code>.tcl</code> file, copy it to flash, then run <code>tclsh flash:script.tcl</code> from privileged exec. Always test in a lab first — AI-generated TCL may use commands that don't exist in your IOS version.
          </div>`;
        setTimeout(() => { $('#tclStatus').textContent = ''; }, 2000);
      } catch (err) {
        toast('AI failed: ' + err.message, 'error', 6000);
        $('#tclStatus').textContent = 'Failed';
      } finally {
        setBusy($('#tclStatus'), false);
        $('#tclGo').disabled = false;
      }
    });
    $('#tclCopy').addEventListener('click', () => {
      const txt = $('#tclOut').textContent;
      if (!txt) { toast('Generate a script first', 'warn'); return; }
      copyToClipboard(txt).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
    });
    $('#tclDl').addEventListener('click', () => {
      const txt = $('#tclOut').textContent;
      if (!txt) { toast('Generate a script first', 'warn'); return; }
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'cisco-script.tcl';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function updateInfoLine() {
    const el = body.querySelector('#mInfo');
    if (el) el.textContent = `${Object.keys(db).length.toLocaleString()} OUI / IAB / MA-M / MA-S entries (Wireshark IEEE registry)`;
  }

  setTab('oui');
}

// ===== Render helpers =============================================

function renderTable(rows, cols, arpMode) {
  if (!rows.length) return '<div class="page-empty">' + (arpMode ? 'Paste an ARP table to begin.' : 'No MACs.') + '</div>';
  return `<table class="lc-table" style="margin-top:8px">
    <thead><tr>
      ${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}
      <th>Copy</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => r.error
        ? `<tr><td colspan="${cols.length + 1}" style="color:var(--warn,#b91c1c)"><code>${esc(r.input)}</code> — ${esc(r.error)}</td></tr>`
        : `<tr>
            ${cols.map(c => {
              const v = r[c.key];
              if (c.key === 'vendor') return `<td><b>${esc(v)}</b></td>`;
              if (c.key === 'colon' || c.key === 'dash' || c.key === 'dotted' || c.key === 'bare' || c.key === 'ip') return `<td><code>${esc(v ?? '')}</code></td>`;
              return `<td>${esc(v ?? '')}</td>`;
            }).join('')}
            <td>
              <button class="btn sm ghost" data-copy="${esc(r.colon || '')}" title="Copy colon format">⧉ :</button>
              <button class="btn sm ghost" data-copy="${esc(r.dotted || '')}" title="Copy Cisco format">⧉ .</button>
              ${arpMode && r.ip ? `<button class="btn sm ghost" data-copy="${esc(r.ip)}" title="Copy IP">⧉ IP</button>` : ''}
              <button class="btn sm ghost" data-copy="${esc(r.vendor || '')}" title="Copy vendor">⧉ V</button>
            </td>
          </tr>`).join('')}
    </tbody>
  </table>`;
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function downloadCsv(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
