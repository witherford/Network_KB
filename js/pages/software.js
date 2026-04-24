// Software releases page.

import { loadData } from '../dataloader.js';
import { state, emit, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';
import { confirmModal } from '../components/modal.js';
import { openHtmlImport, renderHtmlCard } from '../components/html-import.js';

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
      ${state.editMode ? `
        <button class="btn" id="swFetch">Fetch now</button>
        <button class="btn" id="swImport" title="Upload one or more HTML files as release notes / vendor guides">Import HTML</button>
      ` : ''}
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
    root.querySelector('#swImport').addEventListener('click', () => {
      openHtmlImport({
        kind: 'software',
        topicLabel: 'Vendor group (optional — e.g. "Cisco", "Palo Alto")',
        onImport: files => {
          const draft = ensureDraft();
          for (const f of files) {
            draft.items.push({ ...f, vendor: f.topic || 'HTML docs' });
          }
          emit('pending:changed');
        }
      });
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
  const label = it.html ? (it.title || 'HTML card') : `${it.vendor || ''} ${it.product || ''}`.trim();
  const ok = await confirmModal(`Delete ${label}?`, { danger: true });
  if (!ok) return;
  draft.items.splice(idx, 1);
  emit('pending:changed');
}

function renderBody(c, items) {
  if (!items.length) {
    c.innerHTML = `<div class="page-empty">
      <p>No release data yet. Configure vendors/products in Settings and click <b>Fetch now</b>, upload an HTML file with <b>Import HTML</b>, or wait for the scheduled AI pull.</p>
    </div>`;
    return;
  }
  const indexed = items.map((it, idx) => ({ it, idx }));
  const htmlRows = indexed.filter(r => r.it.html && r.it.body);
  const tableRows = indexed.filter(r => !(r.it.html && r.it.body));

  const htmlSection = htmlRows.length ? `
    <section class="platform-section">
      <div class="platform-header"><h2 class="ptitle">Imported HTML</h2><span class="pcnt">${htmlRows.length}</span></div>
      <div class="sections-grid">
        ${htmlRows.map(({ it: r, idx }) => renderHtmlCard({
          title: r.title || `${r.vendor || ''} ${r.product || ''}`.trim() || 'Untitled',
          body: r.body,
          deleteBtn: state.editMode
            ? `<button class="btn sm danger" data-act="del-sw" data-idx="${idx}" title="Delete" style="margin-left:auto">🗑</button>`
            : ''
        })).join('')}
      </div>
    </section>` : '';

  const byVendor = {};
  for (const row of tableRows) {
    const v = row.it.vendor || 'Unknown';
    (byVendor[v] = byVendor[v] || []).push(row);
  }
  const editCol = state.editMode ? '<th style="width:60px"></th>' : '';
  const tableSections = Object.entries(byVendor).map(([vendor, rows]) => `
    <section class="platform-section">
      <div class="platform-header"><h2 class="ptitle">${esc(vendor)}</h2></div>
      <table class="tbl">
        <thead><tr>
          <th>Product</th><th>Recommended</th><th>Latest</th><th>Lifecycle</th><th>Released</th><th>Notes / Source</th>${editCol}
        </tr></thead>
        <tbody>
          ${rows.map(({ it: r, idx }) => `<tr>
            <td>
              <div>${esc(r.product || '')}</div>
              ${r.pid ? `<div style="font-size:11px;color:var(--text-3)" class="mono">${esc(r.pid)}</div>` : ''}
            </td>
            <td class="mono" style="font-weight:600">${esc(r.recommended || '')}</td>
            <td class="mono">${esc(r.latest || '')}</td>
            <td class="mono">${esc(r.lifecycle || (Array.isArray(r.eol) ? r.eol.join(', ') : (r.eol || '')))}</td>
            <td class="mono" style="font-size:11px">${esc((r.releaseDate || '').slice(0, 10))}</td>
            <td>
              ${esc(r.notes || '')}
              ${r.source ? `<span class="src-pill" title="Data source">${esc(r.source)}</span>` : ''}
            </td>
            ${state.editMode ? `<td><button class="btn sm danger" data-act="del-sw" data-idx="${idx}" title="Delete">🗑</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`).join('');

  c.innerHTML = htmlSection + tableSections;
}
