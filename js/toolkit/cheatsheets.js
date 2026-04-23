// Cheat sheets — each sheet is a small static JSON file under data/cheatsheets/.

import { loadCheatsheet } from '../dataloader.js';
import { esc, debounce } from '../utils.js';

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
    <div class="form-row" style="max-width:420px">
      <input type="text" id="csSearch" class="search-input" style="width:100%" placeholder="Filter rows…">
    </div>
    <div id="csBody"></div>`;

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
      <thead><tr>${active.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr>${active.cols.map(c => {
          const v = r[c] ?? '';
          const mono = (c === 'port' || c === 'number' || c === 'range' || c === 'address' || c === 'distance');
          return `<td class="${mono ? 'mono' : ''}">${esc(String(v))}</td>`;
        }).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
  }

  root.querySelector('#csNav').addEventListener('click', e => {
    const btn = e.target.closest('.ftab');
    if (btn) showSheet(btn.dataset.k);
  });
  root.querySelector('#csSearch').addEventListener('input', debounce(e => renderSheet(e.target.value), 100));
  showSheet(SHEETS[0].key);
}
