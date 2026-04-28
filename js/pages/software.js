// Software releases page.

import { loadData } from '../dataloader.js';
import { state, emit, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { confirmModal } from '../components/modal.js';
import { openHtmlImport, renderHtmlCard } from '../components/html-import.js';
import { openImportModal } from '../components/import-modal.js';
import { isSwVendorCollapsed, toggleSwVendor, setSwVendorsCollapsed } from '../prefs.js';

// Backend AI pull is intentionally disabled per v1.3.3 — the previous
// implementation was unreliable. Replacement is TBD.
// import { fetchForKind } from '../components/ai-fetch.js';

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
      <button class="btn collapse-all-btn" id="swExpandAll" title="Expand every vendor section">▾ Expand all vendors</button>
      <button class="btn collapse-all-btn" id="swCollapseAll" title="Collapse every vendor section">▸ Collapse all vendors</button>
      <span class="spacer"></span>
      ${state.editMode ? `
        <button class="btn" id="swImport" title="Upload one or more HTML files as release notes / vendor guides">Import HTML</button>
        <button class="btn" id="swImportCsv" title="Bulk import rows from a CSV or XLSX file">Import CSV / XLSX</button>
      ` : ''}
      <span style="font-size:11px;color:var(--text-3);margin-left:12px">Updated: ${fmtDateTime(data?.updatedAt)}</span>
    </div>
    <div class="page" id="swPage"></div>`;

  const c = root.querySelector('#swPage');
  renderBody(c, items);

  // Vendor expand/collapse delegation.
  c.addEventListener('click', e => {
    const tog = e.target.closest('button[data-act=sw-toggle]');
    if (!tog) return;
    toggleSwVendor(tog.dataset.vendor);
    renderBody(c, items);
  });
  root.querySelector('#swExpandAll').addEventListener('click', () => {
    const v = uniqueVendors(items);
    setSwVendorsCollapsed(v, false);
    renderBody(c, items);
  });
  root.querySelector('#swCollapseAll').addEventListener('click', () => {
    const v = uniqueVendors(items);
    setSwVendorsCollapsed(v, true);
    renderBody(c, items);
  });

  if (state.editMode) {
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
    root.querySelector('#swImportCsv').addEventListener('click', () => {
      const COLUMNS = ['vendor','product','pid','recommended','latest','lifecycle','releaseDate','notes','source'];
      openImportModal({
        title: 'Import software releases',
        columns: COLUMNS,
        exampleFilename: 'software-releases-example.csv',
        sampleRows: [
          { vendor: 'Cisco', product: 'IOS XE Catalyst 9300', pid: 'C9300-48P', recommended: '17.12.04', latest: '17.15.02', lifecycle: 'Active', releaseDate: '2025-09-12', notes: 'See release notes', source: 'curated' },
          { vendor: 'Palo Alto', product: 'PAN-OS', pid: 'PA-440', recommended: '11.1.6-h2', latest: '11.2.4', lifecycle: 'Active', releaseDate: '2025-08-30', notes: '', source: 'curated' },
          { vendor: 'Microsoft', product: 'Windows Server', pid: 'Server 2025', recommended: '24H2 LTSC', latest: '24H2 LTSC', lifecycle: 'GA', releaseDate: '2025-11-04', notes: 'Mainstream support to 2030', source: 'curated' }
        ],
        normalize: rows => rows.map(r => ({
          vendor: (r.vendor || '').trim(),
          product: (r.product || '').trim(),
          pid: (r.pid || '').trim(),
          recommended: (r.recommended || '').trim(),
          latest: (r.latest || '').trim(),
          lifecycle: (r.lifecycle || '').trim(),
          releaseDate: (r.releaseDate || '').trim(),
          notes: (r.notes || '').trim(),
          source: (r.source || 'imported').trim()
        })).filter(r => r.vendor || r.product),
        onConfirm: rows => {
          const draft = ensureDraft();
          draft.items.push(...rows);
          draft.updatedAt = new Date().toISOString();
          emit('pending:changed');
          toast(`Imported ${rows.length} row${rows.length === 1 ? '' : 's'}`, 'success');
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
      <p>No release data yet. Use <b>Edit → Import CSV / XLSX</b> or <b>Import HTML</b> to add entries.</p>
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

  // Group by vendor → category. Vendor sections collapse like the CVE
  // page; inside each, sub-tables per category (Switching / Routing /
  // Wireless / Firewall / etc.).
  const byVendor = {};
  for (const row of tableRows) {
    const v = row.it.vendor || 'Unknown';
    (byVendor[v] = byVendor[v] || []).push(row);
  }
  const editCol = state.editMode ? '<th style="width:60px"></th>' : '';

  const tableSections = Object.entries(byVendor).map(([vendor, rows]) => {
    const collapsed = isSwVendorCollapsed(vendor);
    // Bucket by category, preserving first-seen order.
    const byCat = new Map();
    for (const r of rows) {
      const cat = r.it.category || 'General';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(r);
    }

    const subSections = [...byCat.entries()].map(([cat, catRows]) => `
      <div class="sw-cat-block">
        <div class="sw-cat-header">${esc(cat)} <span class="sw-cat-count">${catRows.length}</span></div>
        <table class="tbl">
          <thead><tr>
            <th>Product</th><th>Recommended</th><th>Latest</th><th>Lifecycle</th><th>Released</th><th>Notes</th><th>Source</th>${editCol}
          </tr></thead>
          <tbody>
            ${catRows.map(({ it: r, idx }) => renderRow(r, idx)).join('')}
          </tbody>
        </table>
      </div>`).join('');

    return `
    <section class="platform-section sw-vendor-section${collapsed ? ' sw-collapsed' : ''}" data-vendor="${esc(vendor)}">
      <div class="platform-header">
        <button class="btn collapse-vendor-btn" data-act="sw-toggle" data-vendor="${esc(vendor)}" title="${collapsed ? 'Expand' : 'Collapse'} ${esc(vendor)}">
          ${collapsed ? '▸ Expand' : '▾ Collapse'}
        </button>
        <h2 class="ptitle">${esc(vendor)}</h2>
        <span class="pcnt">${rows.length}</span>
      </div>
      <div class="sw-section-body" ${collapsed ? 'hidden' : ''}>
        ${subSections}
      </div>
    </section>`;
  }).join('');

  c.innerHTML = htmlSection + tableSections;
}

// Build one row. The `latest` and `recommended` versions become clickable
// links to the vendor's release-notes page when r.source is a URL. The
// Source column carries the same URL as a clickable hyperlink. Notes is
// URL-free prose.
function renderRow(r, idx) {
  const src = (typeof r.source === 'string' && /^https?:\/\//i.test(r.source))
    ? r.source : null;
  const verLink = (val) => {
    const v = String(val || '').trim();
    if (!v) return '';
    if (!src) return `<span class="mono">${esc(v)}</span>`;
    return `<a class="mono sw-ver-link" href="${esc(src)}" target="_blank" rel="noopener" title="Open vendor release notes">${esc(v)}</a>`;
  };
  // Notes — strip any URL out (URLs belong in the Source column).
  const cleanedNotes = String(r.notes || '').replace(/https?:\/\/\S+/g, '').trim();
  return `<tr>
    <td>
      <div>${esc(r.product || '')}</div>
      ${r.pid ? `<div style="font-size:11px;color:var(--text-3)" class="mono">${esc(r.pid)}</div>` : ''}
    </td>
    <td style="font-weight:600">${verLink(r.recommended)}</td>
    <td>${verLink(r.latest)}</td>
    <td class="mono">${esc(r.lifecycle || (Array.isArray(r.eol) ? r.eol.join(', ') : (r.eol || '')))}</td>
    <td class="mono" style="font-size:11px">${esc((r.releaseDate || '').slice(0, 10))}</td>
    <td>${esc(cleanedNotes)}</td>
    <td>${src
      ? `<a href="${esc(src)}" target="_blank" rel="noopener" class="sw-source-link" title="Open vendor release notes">${shortHost(src)} ↗</a>`
      : (r.source ? `<span class="src-pill">${esc(r.source)}</span>` : '')}</td>
    ${state.editMode ? `<td><button class="btn sm danger" data-act="del-sw" data-idx="${idx}" title="Delete">🗑</button></td>` : ''}
  </tr>`;
}

function shortHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function uniqueVendors(items) {
  const out = new Set();
  for (const it of items) {
    if (it && !(it.html && it.body)) out.add(it.vendor || 'Unknown');
  }
  return [...out];
}
