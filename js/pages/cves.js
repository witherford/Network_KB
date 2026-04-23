// CVE page — AI-populated per configured vendor/product.

import { loadData } from '../dataloader.js';
import { state, emit, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';
import { confirmModal } from '../components/modal.js';
import { openHtmlImport, renderHtmlCard } from '../components/html-import.js';

const SEV_COLOR = { critical: '#991b1b', high: '#b45309', medium: '#0369a1', low: '#6b7280' };

function workingData() {
  return state.editMode && state.pending.cves ? state.pending.cves : state.data.cves;
}
function ensureDraft() {
  if (!state.pending.cves) {
    state.pending.cves = structuredClone(state.data.cves || { version: 1, items: [] });
    state.pending.cves.items ||= [];
  }
  return state.pending.cves;
}

export async function mount(root) {
  const diskData = await loadData('cves');
  state.data.cves = diskData;
  const data = workingData() || diskData;
  const items = (data && data.items) || [];

  root.innerHTML = `
    <div class="page-toolbar">
      <strong style="font-size:13px">CVEs</strong>
      <input id="cveSearch" class="search-input" placeholder="Search CVE ID, vendor, product…">
      <span class="spacer"></span>
      ${state.editMode ? `
        <button class="btn" id="cvFetch">Fetch now</button>
        <button class="btn" id="cvImport" title="Upload one or more HTML advisories / vendor bulletins">Import HTML</button>
      ` : ''}
      <span style="font-size:11px;color:var(--text-3);margin-left:12px">Updated: ${fmtDateTime(data?.updatedAt)}</span>
    </div>
    <div class="page" id="cvePage"></div>`;

  const c = root.querySelector('#cvePage');
  const render = (filter = '') => renderCves(c, items, filter);
  root.querySelector('#cveSearch').addEventListener('input', e => render(e.target.value));
  render();

  if (state.editMode) {
    root.querySelector('#cvFetch').addEventListener('click', async e => {
      e.target.disabled = true; e.target.textContent = 'Fetching…';
      try { await fetchForKind('cves', { promptKey: 'cves' }); }
      catch (err) { toast(err.message, 'error'); }
      finally { mount(root); }
    });
    root.querySelector('#cvImport').addEventListener('click', () => {
      openHtmlImport({
        kind: 'cves',
        topicLabel: 'Vendor group (optional — e.g. "Cisco", "VMware")',
        onImport: files => {
          const draft = ensureDraft();
          for (const f of files) {
            draft.items.push({ ...f, vendor: f.topic || 'HTML advisory' });
          }
          emit('pending:changed');
        }
      });
    });
    c.addEventListener('click', onRowClick);
  }

  on('pending:changed', () => { if (state.currentPage === 'cves') mount(root); });
  on('editmode:changed', () => { if (state.currentPage === 'cves') mount(root); });
  window.addEventListener('nkb:reload', () => { if (state.currentPage === 'cves') mount(root); }, { once: true });
}

async function onRowClick(e) {
  const btn = e.target.closest('button[data-act=del-cve]');
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const draft = ensureDraft();
  const it = draft.items[idx];
  if (!it) return;
  const label = it.html ? (it.title || 'HTML advisory') : (it.id || 'CVE');
  const ok = await confirmModal(`Delete ${label}?`, { danger: true });
  if (!ok) return;
  draft.items.splice(idx, 1);
  emit('pending:changed');
}

function renderCves(c, items, filter) {
  const q = filter.trim().toLowerCase();
  const indexed = items.map((it, idx) => ({ it, idx }));
  const matches = indexed.filter(({ it }) => !q || ((it.id || '') + ' ' + (it.vendor || '') + ' ' + (it.product || '') + ' ' + (it.summary || '') + ' ' + (it.title || '') + ' ' + (it.body || '')).toLowerCase().includes(q));
  if (!matches.length) {
    c.innerHTML = `<div class="page-empty">No CVEs${q ? ' match' : ' yet'}. Configure watchlist vendors in Settings, click <b>Fetch now</b>, or upload an HTML advisory with <b>Import HTML</b>.</div>`;
    return;
  }
  const htmlRows = matches.filter(r => r.it.html && r.it.body);
  const tableRows = matches.filter(r => !(r.it.html && r.it.body));

  const htmlSection = htmlRows.length ? `
    <section class="platform-section">
      <div class="platform-header"><h2 class="ptitle">Imported HTML</h2><span class="pcnt">${htmlRows.length}</span></div>
      <div class="sections-grid">
        ${htmlRows.map(({ it: r, idx }) => renderHtmlCard({
          title: r.title || r.id || 'Untitled advisory',
          body: r.body,
          deleteBtn: state.editMode
            ? `<button class="btn sm danger" data-act="del-cve" data-idx="${idx}" title="Delete" style="margin-left:auto">🗑</button>`
            : ''
        })).join('')}
      </div>
    </section>` : '';

  const editHeader = state.editMode ? '<th style="width:60px"></th>' : '';
  const table = tableRows.length ? `<table class="tbl">
    <thead><tr><th>CVE</th><th>Vendor</th><th>Product</th><th>Severity</th><th>CVSS</th><th>Summary</th>${editHeader}</tr></thead>
    <tbody>
      ${tableRows.map(({ it: r, idx }) => {
        const sev = (r.severity || '').toLowerCase();
        const col = SEV_COLOR[sev] || 'inherit';
        return `<tr>
          <td class="mono"><a href="https://nvd.nist.gov/vuln/detail/${esc(r.id || '')}" target="_blank" rel="noopener">${esc(r.id || '')}</a></td>
          <td>${esc(r.vendor || '')}</td>
          <td>${esc(r.product || '')}</td>
          <td style="color:${col};font-weight:600;text-transform:capitalize">${esc(r.severity || '')}</td>
          <td class="mono">${esc(String(r.cvss ?? ''))}</td>
          <td>${esc(r.summary || '')}</td>
          ${state.editMode ? `<td><button class="btn sm danger" data-act="del-cve" data-idx="${idx}" title="Delete">🗑</button></td>` : ''}
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : '';

  c.innerHTML = htmlSection + table;
}
