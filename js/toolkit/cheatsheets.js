// Cheat sheets — each sheet is a small static JSON file under data/cheatsheets/.

import { loadCheatsheet } from '../dataloader.js';
import { esc, debounce, copyToClipboard, toast } from '../utils.js';
import { toCSV } from '../components/io.js';

const SHEETS = [
  { key: 'tcp-udp-ports',     label: 'TCP / UDP ports',  cols: ['port', 'protocol', 'service', 'notes'] },
  { key: 'ip-protocols',      label: 'IP protocols',     cols: ['number', 'name', 'description'] },
  { key: 'multicast',         label: 'Multicast',        cols: ['address', 'scope', 'use', 'notes'] },
  { key: 'ipv4-special',      label: 'Special IPv4',     cols: ['range', 'rfc', 'use'] },
  { key: 'ipv6-special',      label: 'Special IPv6',     cols: ['range', 'rfc', 'use'] },
  { key: 'public-allocations',label: 'Public IP blocks', cols: ['range', 'organization', 'notes'] },
  { key: 'admin-distances',   label: 'Admin distances',  cols: ['protocol', 'distance', 'notes'] },
  { key: 'acronyms',          label: 'Acronyms',         cols: ['acronym', 'meaning', 'context'] }
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Cheat sheets</h2>
    <div class="sub-nav" id="csNav" style="margin:0 -20px 14px -20px">
      ${SHEETS.map(s => `<button class="ftab" data-k="${s.key}">${esc(s.label)}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input type="text" id="csSearch" class="search-input" style="flex:1;min-width:220px;max-width:420px" placeholder="Filter rows…">
      <button class="btn sm" id="csCopy">Copy table as CSV</button>
      <button class="btn sm" id="csExport">Export CSV</button>
    </div>
    <div id="csBody" style="margin-top:12px"></div>`;

  let active = SHEETS[0];
  async function showSheet(key) {
    active = SHEETS.find(s => s.key === key) || SHEETS[0];
    for (const b of root.querySelectorAll('#csNav .ftab')) b.classList.toggle('active', b.dataset.k === active.key);
    renderSheet('');
  }

  async function renderSheet(filter) {
    const body = root.querySelector('#csBody');
    body.innerHTML = '<div class="page-loading">Loading…</div>';
    const data = await loadCheatsheet(active.key);
    const items = Array.isArray(data.items) ? data.items : [];
    const q = filter.trim().toLowerCase();
    const rows = !q ? items : items.filter(it => Object.values(it).some(v => String(v).toLowerCase().includes(q)));
    if (!rows.length) {
      body.innerHTML = `<div class="page-empty">${items.length ? 'No rows match that filter.' : 'This cheat sheet is empty.'}</div>`;
      return;
    }
    body.innerHTML = `<table class="tbl">
      <thead><tr>${active.cols.map(c => `<th>${esc(c)}</th>`).join('')}<th style="width:40px"></th></tr></thead>
      <tbody>
        ${rows.map((r, i) => `<tr>${active.cols.map(c => {
          const v = r[c] ?? '';
          const mono = (c === 'port' || c === 'number' || c === 'range' || c === 'address' || c === 'distance');
          return `<td class="${mono ? 'mono' : ''}">${esc(String(v))}</td>`;
        }).join('')}<td><button class="btn sm ghost" data-row="${i}" title="Copy row">⧉</button></td></tr>`).join('')}
      </tbody>
    </table>`;
    body.querySelectorAll('button[data-row]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = rows[+btn.dataset.row];
        if (!r) return;
        const text = active.cols.map(c => `${c}: ${r[c] ?? ''}`).join(' | ');
        const ok = await copyToClipboard(text);
        const orig = btn.textContent;
        btn.textContent = ok ? '✓' : '✗';
        setTimeout(() => { btn.textContent = orig; }, 900);
      });
    });
    // Stash currently visible rows for the table-level Copy/Export buttons.
    _visibleRows = rows;
    _visibleCols = active.cols;
  }
  let _visibleRows = []; let _visibleCols = [];

  root.querySelector('#csNav').addEventListener('click', e => {
    const btn = e.target.closest('.ftab');
    if (btn) showSheet(btn.dataset.k);
  });
  root.querySelector('#csSearch').addEventListener('input', debounce(e => renderSheet(e.target.value), 100));
  root.querySelector('#csCopy').addEventListener('click', async () => {
    if (!_visibleRows.length) { toast('No rows', 'error'); return; }
    const csv = toCSV(_visibleRows, _visibleCols);
    const ok = await copyToClipboard(csv);
    toast(ok ? 'Table copied as CSV' : 'Copy failed', ok ? 'success' : 'error');
  });
  root.querySelector('#csExport').addEventListener('click', () => {
    if (!_visibleRows.length) { toast('No rows', 'error'); return; }
    const csv = toCSV(_visibleRows, _visibleCols);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = active.key + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  showSheet(SHEETS[0].key);
}
