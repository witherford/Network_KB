// Software releases page.

import { loadData } from '../dataloader.js';
import { state, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';

export async function mount(root) {
  const diskData = await loadData('software');
  const data = state.pending.software || diskData;
  state.data.software = diskData;

  const items = (data && data.items) || [];

  root.innerHTML = `
    <div class="page-toolbar">
      <strong style="font-size:13px">Software releases</strong>
      <span class="spacer"></span>
      ${state.editMode ? '<button class="btn" id="swFetch">Fetch now</button>' : ''}
      <span style="font-size:11px;color:var(--text-3);margin-left:12px">Updated: ${fmtDateTime(data?.updatedAt)}</span>
    </div>
    <div class="page" id="swPage"></div>`;

  renderBody(root.querySelector('#swPage'), items);

  if (state.editMode) {
    root.querySelector('#swFetch').addEventListener('click', async e => {
      e.target.disabled = true; e.target.textContent = 'Fetching…';
      try { await fetchForKind('software', { promptKey: 'software' }); }
      catch (err) { toast(err.message, 'error'); }
      finally { mount(root); }
    });
  }

  on('pending:changed', () => {
    if (state.currentPage === 'software') mount(root);
  });
  on('editmode:changed', () => {
    if (state.currentPage === 'software') mount(root);
  });
  window.addEventListener('nkb:reload', () => { if (state.currentPage === 'software') mount(root); }, { once: true });
}

function renderBody(c, items) {
  if (!items.length) {
    c.innerHTML = `<div class="page-empty">
      <p>No release data yet. Configure vendors/products in Settings and click <b>Fetch now</b> or wait for the scheduled AI pull.</p>
    </div>`;
    return;
  }
  const byVendor = {};
  for (const it of items) {
    const v = it.vendor || 'Unknown';
    (byVendor[v] = byVendor[v] || []).push(it);
  }
  c.innerHTML = Object.entries(byVendor).map(([vendor, rows]) => `
    <section class="platform-section">
      <div class="platform-header"><h2 class="ptitle">${esc(vendor)}</h2></div>
      <table class="tbl">
        <thead><tr>
          <th>Product</th><th>Latest</th><th>Recommended</th><th>EOL</th><th>Notes</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${esc(r.product || '')}</td>
            <td class="mono">${esc(r.latest || '')}</td>
            <td class="mono">${esc(r.recommended || '')}</td>
            <td class="mono">${esc(Array.isArray(r.eol) ? r.eol.join(', ') : (r.eol || ''))}</td>
            <td>${esc(r.notes || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`).join('');
}
