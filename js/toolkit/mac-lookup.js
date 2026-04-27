// MAC address / OUI vendor lookup + format conversion.
// Backed by the bundled IEEE OUI database (data/oui.json), built from
// the public-domain Wireshark `manuf` file. Lazy-loaded on first use,
// service-worker cached thereafter.
//
// ARP-table mode: tick the checkbox and paste a Cisco/Nexus/IOS-XE/ASA
// `show ip arp` (or similar) output. The parser pulls IP+MAC pairs from
// each line, resolves vendors, and shows the IP alongside the result.
// CSV export then includes the IP column.

import { copyToClipboard, toast } from '../utils.js';
import { mountCopyButton, toCSV } from '../components/io.js';

// Inline fallback used until the full DB finishes loading. Top vendors only.
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

// Special-pattern detection for non-OUI MACs.
const PATTERNS = [
  { test: m => m === 'ffffffffffff', label: 'Broadcast' },
  { test: m => m.startsWith('01005e'), label: 'IPv4 multicast' },
  { test: m => m.startsWith('3333'),   label: 'IPv6 multicast' },
  { test: m => m.startsWith('0180c2'), label: 'IEEE 802.1 reserved (STP / LACP / LLDP / 802.1X)' },
  { test: m => m.startsWith('00005e0001'), label: 'VRRP virtual MAC (IPv4)' },
  { test: m => m.startsWith('00005e0002'), label: 'VRRP virtual MAC (IPv6)' },
  { test: m => m.startsWith('00000c07ac'), label: 'HSRPv1 virtual MAC' },
  { test: m => m.startsWith('00000c9ff'), label: 'HSRPv2 virtual MAC' },
  { test: m => m.startsWith('0007b400'), label: 'GLBP virtual MAC' },
  { test: m => m.startsWith('01000ccccccc'), label: 'Cisco CDP / VTP / DTP / PAgP' }
];

// Cache the parsed DB at module scope so subsequent lookups are instant.
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
      console.warn('[mac-lookup] OUI DB load failed, using inline fallback:', e);
      _db = FALLBACK_OUI;
      return _db;
    }
  })();
  return _dbPromise;
}

// Look up a normalised 12-hex-char MAC against the DB (MA-S /36 → MA-M /28 → MA-L /24).
function findVendor(db, bare) {
  const k36 = bare.slice(0, 9) + '/36';
  if (db[k36]) return { vendor: db[k36], allocation: 'MA-S /36' };
  const k28 = bare.slice(0, 7) + '/28';
  if (db[k28]) return { vendor: db[k28], allocation: 'MA-M /28' };
  const k24 = bare.slice(0, 6);
  if (db[k24]) return { vendor: db[k24], allocation: 'MA-L /24' };
  return null;
}

// Column registry. `key` is the row property; `label` is the heading; `arpOnly`
// hides the column when ARP mode is off.
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

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">MAC / OUI lookup</h2>

    <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;font-weight:600">
      <input type="checkbox" id="mArp">
      Input contains a Cisco / IOS-XE / Nexus / ASA ARP table output
    </label>
    <div class="hint" id="mArpHint" style="margin-bottom:8px;display:none">
      Paste the full <code>show ip arp</code> / <code>show arp</code> / <code>show ip arp vrf …</code> output below — the parser will pull <code>IP</code> and <code>MAC</code> from each line, resolve vendors, and add an <strong>IP</strong> column to the results table and CSV export.
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
    <div id="mOut"></div>`;

  const $ = sel => root.querySelector(sel);

  // Build the column-toggle checkboxes.
  const colsEl = $('#mColumns');
  colsEl.innerHTML = COLUMNS.map(c => `
    <label style="display:flex;align-items:center;gap:6px;font-size:12px${c.arpOnly ? ';opacity:0.55' : ''}" data-col="${c.key}">
      <input type="checkbox" data-col="${c.key}" ${c.defaultOn ? 'checked' : ''}>
      ${c.label}${c.arpOnly ? ' <span class="hint">(ARP-only)</span>' : ''}
    </label>
  `).join('');

  // Kick off the DB load — UI keeps working with fallback while it loads.
  let db = FALLBACK_OUI;
  loadDb().then(loaded => {
    db = loaded;
    $('#mInfo').textContent = `${Object.keys(db).length.toLocaleString()} OUI / IAB / MA-M / MA-S entries (Wireshark IEEE registry)`;
    if ($('#mInput').value.trim()) lookup();
  });

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
      ? 'Internet  10.0.0.1                -   001a.b3c4.5678  ARPA   Vlan10\nInternet  10.0.0.2               12   0050.5612.3456  ARPA   GigabitEthernet0/1\nInternet  10.0.0.3               45   b827.eb11.2233  ARPA   Vlan10'
      : '00:50:56:c0:00:01\n00-1c-58-ab-cd-ef\n0050.5612.3456\n001A4Aabcdef';
    // Show / un-grey ARP-only column toggles.
    colsEl.querySelectorAll('label[data-col]').forEach(lb => {
      const key = lb.dataset.col;
      const c = COLUMNS.find(x => x.key === key);
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
    // Wire per-row copy buttons.
    $('#mOut').querySelectorAll('button[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await copyToClipboard(btn.dataset.copy);
        const t = btn.textContent;
        btn.textContent = ok ? '✓' : '✗';
        setTimeout(() => { btn.textContent = t; }, 900);
      });
    });
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

  refreshArpVisuals();
}

// ---------- ARP-table parsing ----------
//
// Cisco IOS / IOS-XE `show ip arp`:
//   Internet  10.0.0.1                -   001a.b3c4.5678  ARPA   Vlan10
//   Internet  10.0.0.2               12   0050.5612.3456  ARPA   GigabitEthernet0/1
//
// Cisco Nexus `show ip arp`:
//   IP ARP Table for context default
//   Total number of entries: 2
//   Address         Age       MAC Address     Interface       Flags
//   10.0.0.1        00:00:00  001a.b3c4.5678  Vlan10
//
// Cisco ASA `show arp`:
//   inside    10.0.0.1   001a.b3c4.5678   1234
//
// Linux / generic `arp -a`:
//   ? (10.0.0.1) at 00:1a:b3:c4:56:78 [ether] on eth0
//
// We're permissive: any line with at least an IPv4 and a MAC is accepted.
function parseArpInput(text, db) {
  const out = [];
  const macRe = /([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}|(?:[0-9a-f]{2}[:\-]){5}[0-9a-f]{2}|[0-9a-f]{12})/i;
  const ipRe  = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip obvious headers / banners.
    if (/^(IP\s+ARP|Address|Total|Protocol|Internet\s+Address|Hardware|Age|---|===|Flags:)/i.test(trimmed)) continue;
    const macMatch = trimmed.match(macRe);
    if (!macMatch) continue;
    const ipMatch = trimmed.match(ipRe);
    if (!ipMatch) continue;
    const macRaw = macMatch[1];
    const ip = ipMatch[1];
    // Best-effort interface — last whitespace-separated token if it looks like an interface name.
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
    r.input = trimmed;   // preserve the original line so user can audit
    out.push(r);
  }
  return out;
}

function parseAndLookup(db, input) {
  const bare = input.replace(/[^0-9a-f]/gi, '').toLowerCase();
  if (bare.length < 12) return { input, error: 'No MAC found' };
  // If more than 12, take the first MAC-like sequence.
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
