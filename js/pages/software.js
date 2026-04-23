// Software releases page.

import { loadData } from '../dataloader.js';
import { state, emit, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';
import { confirmModal } from '../components/modal.js';

function workingData() {
  return state.editMode && state.pending.software ? state.pending.software : state.data.software;
}
function ensureDraft() {
  if (!state.pending.software) {
    state.pending.software = structuredClone(state.data.software || { version: 1, items: [] });
    state.pending.software.items ||= [];
  }
  return state.pending.software;
}

export async function mount(root) {
  const diskData = await loadData('software');
  state.data.software = diskData;
  const data = workingData() || diskData;
  const items = (data && data.items) || [];

  root.innerHTML = `
    <div class="page-toolbar">
      <strong style="font-size:13px">Software releases</strong>
      <span class="spacer"></span>
      ${state.editMode ? '<button class="btn" id="swFetch">Fetch now</button>' : ''}
      <span style="font-size:11px;color:var(--text-3);margin-left:12px">Updated: ${fmtDateTime(data?.updatedAt)}</span>
    </div>
    <div class="page" id="swPage"></div>`;

  const c = root.querySelector('#swPage');
  renderBody(c, items);

  if (state.editMode) {
    root.querySelector('#swFetch').addEventListener('click', async e => {
      e.target.disabled = true; e.target.textContent = 'Fetching…';
      try { await fetchForKind('software', { promptKey: 'software' }); }
      catch (err) { toast(err.message, 'error'); }
      finally { mount(root); }
    });
    c.addEventListener('click', onRowClick);
  }

  on('pending:changed', () => { if (state.currentPage === 'software') mount(root); });
  on('editmode:changed', () => { if (state.currentPage === 'software') mount(root); });
  window.addEventListener('nkb:reload', () => { if (state.currentPage === 'software') mount(root); }, { once: true });
}

async function onRowClick(e) {
  const btn = e.target.closest('button[data-act=del-sw]');
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const draft = ensureDraft();
  const it = draft.items[idx];
  if (!it) return;
  const ok = await confirmModal(`Delete ${it.vendor || ''} ${it.product || ''}?`, { danger: true });
  if (!ok) return;
  draft.items.splice(idx, 1);
  emit('pending:changed');
}

function renderBody(c, items) {
  if (!items.length) {
    c.innerHTML = `<div class="page-empty">
      <p>No release data yet. Configure vendors/products in Settings and click <b>Fetch now</b> or wait for the scheduled AI pull.</p>
    </div>`;
    return;
  }
  // Index by original position so delete keeps working after grouping.
  const indexed = items.map((it, idx) => ({ it, idx }));
  const byVendor = {};
  for (const row of indexed) {
    const v = row.it.vendor || 'Unknown';
    (byVendor[v] = byVendor[v] || []).push(row);
  }
  const editCol = state.editMode ? '<th style="width:60px"></th>' : '';
  c.innerHTML = Object.entries(byVendor).map(([vendor, rows]) => `
    <section class="platform-section">
      <div class="platform-header"><h2 class="ptitle">${esc(vendor)}</h2></div>
      <table class="tbl">
        <thead><tr>
          <th>Product</th><th>Latest</th><th>Recommended</th><th>EOL</th><th>Notes</th>${editCol}
        </tr></thead>
        <tbody>
          ${rows.map(({ it: r, idx }) => `<tr>
            <td>${esc(r.product || '')}</td>
            <td class="mono">${esc(r.latest || '')}</td>
            <td class="mono">${esc(r.recommended || '')}</td>
            <td class="mono">${esc(Array.isArray(r.eol) ? r.eol.join(', ') : (r.eol || ''))}</td>
            <td>${esc(r.notes || '')}</td>
            ${state.editMode ? `<td><button class="btn sm danger" data-act="del-sw" data-idx="${idx}" title="Delete">🗑</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`).join('');
}
