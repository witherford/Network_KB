// OUI lookup — paste a list of MAC addresses (any format), get vendor + format
// conversions. For the ARP-table / mac-address-table workflow, see the
// "ARP + MAC table merge" page.

import { copyToClipboard, toast } from '../utils.js';
import { toCSV } from '../components/io.js';
import {
  FALLBACK_OUI, COLUMNS, loadDb, parseAndLookup, esc, downloadCsv
} from './oui-shared.js';

const LIST_COLUMNS = COLUMNS.filter(c => !c.arpOnly);

export async function mount(root) {
  let db = FALLBACK_OUI;

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">OUI lookup — MAC list</h2>
    <p class="hint" style="margin-bottom:10px">Paste one or more MAC addresses (any format — colon, dash, Cisco dotted or bare hex). Resolves the IEEE vendor (OUI) and shows every common format.</p>
    <div class="form-row">
      <label id="mInputLabel">MAC address(es) — one per line, any format</label>
      <textarea id="mInput" placeholder="00:50:56:c0:00:01&#10;00-1c-58-ab-cd-ef&#10;0050.5612.3456&#10;001A4Aabcdef" style="min-height:120px"></textarea>
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
  const colsEl = $('#mColumns');
  colsEl.innerHTML = LIST_COLUMNS.map(c => `
    <label style="display:flex;align-items:center;gap:6px;font-size:12px" data-col="${c.key}">
      <input type="checkbox" data-col="${c.key}" ${c.defaultOn ? 'checked' : ''}>
      ${c.label}
    </label>`).join('');

  function updateInfoLine() {
    const el = $('#mInfo');
    if (el) el.textContent = `${Object.keys(db).length.toLocaleString()} OUI / IAB / MA-M / MA-S entries (Wireshark IEEE registry)`;
  }
  loadDb().then(loaded => { db = loaded; updateInfoLine(); });

  function visibleColumns() {
    return LIST_COLUMNS.filter(c => {
      const cb = colsEl.querySelector(`input[data-col="${c.key}"]`);
      return cb ? cb.checked : c.defaultOn;
    });
  }
  function getRows() {
    return $('#mInput').value
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      .map(line => parseAndLookup(db, line));
  }
  function lookup() {
    const rows = getRows();
    const cols = visibleColumns();
    $('#mOut').innerHTML = renderTable(rows, cols);
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
  colsEl.addEventListener('change', lookup);
  $('#mCsv').addEventListener('click', () => {
    const rows = getRows();
    if (!rows.length) { toast('Nothing to export', 'error'); return; }
    const cols = visibleColumns();
    const csv = toCSV(rows.map(r => Object.fromEntries(cols.map(c => [c.label, r[c.key] ?? '']))), cols.map(c => c.label));
    downloadCsv('mac-lookup.csv', csv);
  });
  $('#mCopyAll').addEventListener('click', async () => {
    const rows = getRows();
    if (!rows.length) { toast('No rows', 'error'); return; }
    const cols = visibleColumns();
    const csv = toCSV(rows.map(r => Object.fromEntries(cols.map(c => [c.label, r[c.key] ?? '']))), cols.map(c => c.label));
    const ok = await copyToClipboard(csv);
    toast(ok ? 'CSV copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
  });
}

function renderTable(rows, cols) {
  if (!rows.length) return '<div class="page-empty">No MACs.</div>';
  return `<table class="lc-table" style="margin-top:8px">
    <thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}<th>Copy</th></tr></thead>
    <tbody>
      ${rows.map(r => r.error
        ? `<tr><td colspan="${cols.length + 1}" style="color:var(--warn,#b91c1c)"><code>${esc(r.input)}</code> — ${esc(r.error)}</td></tr>`
        : `<tr>
            ${cols.map(c => {
              const v = r[c.key];
              if (c.key === 'vendor') return `<td><b>${esc(v)}</b></td>`;
              if (c.key === 'colon' || c.key === 'dash' || c.key === 'dotted' || c.key === 'bare') return `<td><code>${esc(v ?? '')}</code></td>`;
              return `<td>${esc(v ?? '')}</td>`;
            }).join('')}
            <td>
              <button class="btn sm ghost" data-copy="${esc(r.colon || '')}" title="Copy colon format">⧉ :</button>
              <button class="btn sm ghost" data-copy="${esc(r.dotted || '')}" title="Copy Cisco format">⧉ .</button>
              <button class="btn sm ghost" data-copy="${esc(r.vendor || '')}" title="Copy vendor">⧉ V</button>
            </td>
          </tr>`).join('')}
    </tbody>
  </table>`;
}
