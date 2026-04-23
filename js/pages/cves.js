// CVE page — AI-populated per configured vendor/product.

import { loadData } from '../dataloader.js';
import { state, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';

const SEV_COLOR = { critical: '#991b1b', high: '#b45309', medium: '#0369a1', low: '#6b7280' };

export async function mount(root) {
  const diskData = await loadData('cves');
  const data = state.pending.cves || diskData;
  state.data.cves = diskData;
  const items = (data && data.items) || [];

  root.innerHTML = `
    <div class="page-toolbar">
      <strong style="font-size:13px">CVEs</strong>
      <input id="cveSearch" class="search-input" placeholder="Search CVE ID, vendor, product…">
      <span class="spacer"></span>
      ${state.editMode ? '<button class="btn" id="cvFetch">Fetch now</button>' : ''}
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
  }

  on('pending:changed', () => { if (state.currentPage === 'cves') mount(root); });
  window.addEventListener('nkb:reload', () => { if (state.currentPage === 'cves') mount(root); }, { once: true });
}

function renderCves(c, items, filter) {
  const q = filter.trim().toLowerCase();
  const matches = items.filter(it => !q || (it.id + ' ' + (it.vendor || '') + ' ' + (it.product || '') + ' ' + (it.summary || '')).toLowerCase().includes(q));
  if (!matches.length) {
    c.innerHTML = `<div class="page-empty">No CVEs${q ? ' match' : ' yet'}. Configure watchlist vendors in Settings.</div>`;
    return;
  }
  c.innerHTML = `<table class="tbl">
    <thead><tr><th>CVE</th><th>Vendor</th><th>Product</th><th>Severity</th><th>CVSS</th><th>Summary</th></tr></thead>
    <tbody>
      ${matches.map(r => {
        const sev = (r.severity || '').toLowerCase();
        const col = SEV_COLOR[sev] || 'inherit';
        return `<tr>
          <td class="mono"><a href="https://nvd.nist.gov/vuln/detail/${esc(r.id)}" target="_blank" rel="noopener">${esc(r.id)}</a></td>
          <td>${esc(r.vendor || '')}</td>
          <td>${esc(r.product || '')}</td>
          <td style="color:${col};font-weight:600;text-transform:capitalize">${esc(r.severity || '')}</td>
          <td class="mono">${esc(String(r.cvss ?? ''))}</td>
          <td>${esc(r.summary || '')}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}
