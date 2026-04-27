// MAC address / OUI vendor lookup + format conversion.
// Backed by the bundled IEEE OUI database (data/oui.json), built from
// the public-domain Wireshark `manuf` file. Lazy-loaded on first use,
// service-worker cached thereafter.

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
      // Resolve relative to the page so it works on the GitHub Pages subpath.
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

// Look up a normalised 12-hex-char MAC against the DB.
// Tries MA-S (/36 → 9 hex), MA-M (/28 → 7 hex), MA-L (/24 → 6 hex) in order
// so the most specific allocation wins.
function findVendor(db, bare) {
  const k36 = bare.slice(0, 9) + '/36';
  if (db[k36]) return { vendor: db[k36], allocation: 'MA-S /36' };
  const k28 = bare.slice(0, 7) + '/28';
  if (db[k28]) return { vendor: db[k28], allocation: 'MA-M /28' };
  const k24 = bare.slice(0, 6);
  if (db[k24]) return { vendor: db[k24], allocation: 'MA-L /24' };
  return null;
}

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">MAC / OUI lookup</h2>
    <div class="form-row" style="grid-column:1/-1">
      <label>MAC address(es) — one per line, any format</label>
      <textarea id="mInput" placeholder="00:50:56:c0:00:01&#10;00-1c-58-ab-cd-ef&#10;0050.5612.3456&#10;001A4Aabcdef" style="min-height:100px"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="mLookup">Lookup</button>
      <button class="btn" id="mCsv">Export CSV</button>
      <button class="btn" id="mCopyAll">Copy all as CSV</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="mInfo">Loading IEEE OUI database…</span>
    </div>
    <div id="mOut"></div>`;

  const $ = sel => root.querySelector(sel);

  // Kick off the DB load — UI keeps working with fallback while it loads.
  let db = FALLBACK_OUI;
  loadDb().then(loaded => {
    db = loaded;
    $('#mInfo').textContent = `${Object.keys(db).length.toLocaleString()} OUI / IAB / MA-M / MA-S entries (Wireshark IEEE registry)`;
    if ($('#mInput').value.trim()) lookup();
  });

  function parseLines() {
    return $('#mInput').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  function lookup() {
    const lines = parseLines();
    const rows = lines.map(input => parseAndLookup(db, input));
    $('#mOut').innerHTML = renderTable(rows);
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

  $('#mCsv').addEventListener('click', () => {
    const rows = parseLines().map(line => parseAndLookup(db, line));
    if (!rows.length) { toast('No MACs to export', 'error'); return; }
    const csv = toCSV(rows.map(r => ({
      Input: r.input,
      Vendor: r.vendor || '',
      Allocation: r.allocation || '',
      Notes: r.notes || '',
      Colon: r.colon || '',
      Dash: r.dash || '',
      Cisco: r.dotted || '',
      Bare: r.bare || '',
      'U/L': r.ul || '',
      'I/G': r.ig || '',
      Error: r.error || ''
    })), ['Input','Vendor','Allocation','Notes','Colon','Dash','Cisco','Bare','U/L','I/G','Error']);
    downloadCsv('mac-lookup.csv', csv);
  });

  $('#mCopyAll').addEventListener('click', async () => {
    const rows = parseLines().map(line => parseAndLookup(db, line));
    if (!rows.length) { toast('No rows', 'error'); return; }
    const csv = toCSV(rows.map(r => ({ Input: r.input, Vendor: r.vendor || '', Colon: r.colon || '', Cisco: r.dotted || '', Notes: r.notes || '', Error: r.error || '' })), ['Input','Vendor','Colon','Cisco','Notes','Error']);
    const ok = await copyToClipboard(csv);
    toast(ok ? 'CSV copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
  });
}

function parseAndLookup(db, input) {
  const bare = input.replace(/[^0-9a-f]/gi, '').toLowerCase();
  if (bare.length !== 12) return { input, error: 'Not a 48-bit MAC' };
  // Special patterns first — they're more informative than vendor lookup.
  let notes = '';
  for (const p of PATTERNS) { if (p.test(bare)) { notes = p.label; break; } }
  const v = findVendor(db, bare);
  // Bit flags from the first octet.
  const o1 = parseInt(bare.slice(0, 2), 16);
  const ig = (o1 & 0x01) ? 'Group (multicast)' : 'Individual (unicast)';
  const ul = (o1 & 0x02) ? 'Locally administered' : 'Universally administered';
  return {
    input, bare,
    norm: bare.toUpperCase().match(/.{2}/g).join(':'),
    colon: bare.match(/.{2}/g).join(':'),
    dash:  bare.match(/.{2}/g).join('-'),
    dotted: bare.match(/.{4}/g).join('.'),
    vendor: v?.vendor || (notes || 'Unknown'),
    allocation: v?.allocation || (notes ? '— special' : '—'),
    notes,
    ul, ig
  };
}

function renderTable(rows) {
  if (!rows.length) return '<div class="page-empty">No MACs.</div>';
  return `<table class="lc-table" style="margin-top:8px"><thead><tr>
    <th>Input</th><th>Vendor</th><th>Notes</th><th>Colon format</th><th>Cisco</th><th>U/L</th><th>I/G</th><th>Copy</th>
  </tr></thead><tbody>${rows.map(r => r.error
    ? `<tr><td>${esc(r.input)}</td><td colspan="7" style="color:var(--warn,#b91c1c)">${esc(r.error)}</td></tr>`
    : `<tr>
        <td><code>${esc(r.input)}</code></td>
        <td><b>${esc(r.vendor)}</b><br><span class="hint">${esc(r.allocation || '')}</span></td>
        <td>${esc(r.notes) || '<span class="hint">—</span>'}</td>
        <td><code>${esc(r.colon)}</code></td>
        <td><code>${esc(r.dotted)}</code></td>
        <td>${esc(r.ul)}</td>
        <td>${esc(r.ig)}</td>
        <td>
          <button class="btn sm ghost" data-copy="${esc(r.colon)}" title="Copy colon format">⧉ :</button>
          <button class="btn sm ghost" data-copy="${esc(r.dotted)}" title="Copy Cisco format">⧉ .</button>
          <button class="btn sm ghost" data-copy="${esc(r.vendor)}" title="Copy vendor">⧉ V</button>
        </td>
      </tr>`).join('')}</tbody></table>`;
}

function esc(s) { return String(s ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }
function downloadCsv(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
