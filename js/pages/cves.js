// CVE page — AI-populated per configured vendor/product.

import { loadData } from '../dataloader.js';
import { state, emit, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';
import { confirmModal } from '../components/modal.js';
import { openHtmlImport, renderHtmlCard } from '../components/html-import.js';
import { openImportModal } from '../components/import-modal.js';
import { isCveVendorCollapsed, toggleCveVendorCollapsed, setCveVendorsCollapsed } from '../prefs.js';

const SEV_COLOR = { critical: '#991b1b', high: '#b45309', medium: '#0369a1', low: '#6b7280' };
const SEV_RANK  = { critical: 0, high: 1, medium: 2, low: 3, informational: 4, '': 5 };
const RECENT_DAYS = 7;

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
      <strong style="font-size:13px">CVE's and bugs</strong>
      <input id="cveSearch" class="search-input" placeholder="Search CVE ID, vendor, product…">
      <button class="btn sm ghost" id="cveExpandAll" title="Expand every vendor section">▾ Expand all</button>
      <button class="btn sm ghost" id="cveCollapseAll" title="Collapse every vendor section">▸ Collapse all</button>
      <span class="spacer"></span>
      ${state.editMode ? `
        <button class="btn" id="cvFetch">Fetch now</button>
        <button class="btn" id="cvImport" title="Upload one or more HTML advisories / vendor bulletins">Import HTML</button>
        <button class="btn" id="cvImportCsv" title="Bulk import CVE rows from a CSV or XLSX file">Import CSV / XLSX</button>
      ` : ''}
      <span style="font-size:11px;color:var(--text-3);margin-left:12px">Updated: ${fmtDateTime(data?.updatedAt)}</span>
    </div>
    <div class="page" id="cvePage"></div>`;

  const c = root.querySelector('#cvePage');
  const render = (filter = '') => renderCves(c, items, filter);
  root.querySelector('#cveSearch').addEventListener('input', e => render(e.target.value));
  // Vendor-section collapse toggle (delegated).
  c.addEventListener('click', e => {
    const tog = e.target.closest('button[data-act=cve-toggle]');
    if (!tog) return;
    toggleCveVendorCollapsed(tog.dataset.vendor);
    render(root.querySelector('#cveSearch').value);
  });
  root.querySelector('#cveExpandAll').addEventListener('click', () => {
    const allVendors = uniqueVendors(items);
    setCveVendorsCollapsed(allVendors, false);
    render(root.querySelector('#cveSearch').value);
  });
  root.querySelector('#cveCollapseAll').addEventListener('click', () => {
    const allVendors = uniqueVendors(items);
    setCveVendorsCollapsed(allVendors, true);
    render(root.querySelector('#cveSearch').value);
  });
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
    root.querySelector('#cvImportCsv').addEventListener('click', () => {
      const COLUMNS = ['id','vendor','product','severity','cvss','summary','published','references','source'];
      openImportModal({
        title: 'Import CVEs',
        columns: COLUMNS,
        exampleFilename: 'cves-example.csv',
        sampleRows: [
          { id: 'CVE-2024-3400', vendor: 'Palo Alto', product: 'PAN-OS (GlobalProtect)', severity: 'critical', cvss: 10.0, summary: 'Command injection — pre-auth RCE as root', published: '2024-04-12', references: 'https://security.paloaltonetworks.com/CVE-2024-3400', source: 'curated' },
          { id: 'CVE-2024-20399', vendor: 'Cisco', product: 'NX-OS', severity: 'medium', cvss: 6.0, summary: 'CLI command injection in some Nexus switches', published: '2024-07-01', references: 'https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-nxos-cmd-injection-xD9OhyOP', source: 'curated' },
          { id: 'CVE-2024-21887', vendor: 'Ivanti', product: 'Connect Secure', severity: 'critical', cvss: 9.1, summary: 'Command injection in admin endpoints', published: '2024-01-10', references: 'https://forums.ivanti.com/s/article/CVE-2024-21887|https://www.cisa.gov/news-events/cybersecurity-advisories', source: 'curated' }
        ],
        normalize: rows => rows.map(r => {
          const out = {
            id: (r.id || '').trim().toUpperCase(),
            vendor: (r.vendor || '').trim(),
            product: (r.product || '').trim(),
            severity: (r.severity || '').trim().toLowerCase() || 'informational',
            cvss: r.cvss === '' || r.cvss == null ? null : Number(r.cvss),
            summary: (r.summary || '').trim(),
            published: (r.published || '').trim(),
            source: (r.source || 'imported').trim()
          };
          // Normalise references — pipe- or semicolon- or comma-separated.
          const refs = String(r.references || '')
            .split(/[|;]+/)
            .map(s => s.trim())
            .filter(Boolean);
          if (refs.length) out.references = refs;
          if (!Number.isFinite(out.cvss)) delete out.cvss;
          return out;
        }).filter(r => r.id),
        onConfirm: rows => {
          const draft = ensureDraft();
          // De-dupe by CVE ID.
          const existing = new Set((draft.items || []).map(it => (it.id || '').toUpperCase()));
          const fresh = rows.filter(r => !existing.has(r.id));
          const dupes = rows.length - fresh.length;
          draft.items.push(...fresh);
          draft.updatedAt = new Date().toISOString();
          emit('pending:changed');
          toast(`Imported ${fresh.length}${dupes ? ` (${dupes} duplicates skipped)` : ''}`, 'success');
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

  // Group table rows by vendor, then sort each group by severity rank then
  // CVSS desc. Vendor groups themselves come out sorted by "worst CVE first"
  // so the most urgent section is always at the top.
  const byVendor = {};
  for (const row of tableRows) {
    const v = row.it.vendor || 'Unknown';
    (byVendor[v] = byVendor[v] || []).push(row);
  }
  for (const v of Object.keys(byVendor)) byVendor[v].sort(sortBySeverity);
  const vendorOrder = Object.keys(byVendor).sort((a, b) => {
    const aw = worstIn(byVendor[a]);
    const bw = worstIn(byVendor[b]);
    if (aw !== bw) return aw - bw;
    return a.localeCompare(b);
  });

  const editHeader = state.editMode ? '<th style="width:60px"></th>' : '';
  const recentCutoff = Date.now() - RECENT_DAYS * 86400_000;
  const recentCount = tableRows.filter(({ it }) => isRecent(it, recentCutoff)).length;
  const banner = recentCount ? `
    <div class="cve-recent-banner">
      <span class="cve-recent-dot"></span>
      <span>${recentCount} CVE${recentCount === 1 ? '' : 's'} discovered in the last ${RECENT_DAYS} days</span>
    </div>` : '';

  const tableSections = vendorOrder.map(vendor => {
    const rows = byVendor[vendor];
    const critical = rows.filter(r => (r.it.severity || '').toLowerCase() === 'critical').length;
    const high     = rows.filter(r => (r.it.severity || '').toLowerCase() === 'high').length;
    const collapsed = isCveVendorCollapsed(vendor);
    return `
    <section class="platform-section cve-vendor-section${collapsed ? ' cve-collapsed' : ''}" data-vendor="${esc(vendor)}">
      <div class="platform-header">
        <h2 class="ptitle">${esc(vendor)}</h2>
        <span class="pcnt">${rows.length}</span>
        ${critical ? `<span class="sev-chip sev-chip-critical">${critical} critical</span>` : ''}
        ${high ? `<span class="sev-chip sev-chip-high">${high} high</span>` : ''}
        <span style="margin-left:auto">
          <button class="btn sm ghost" data-act="cve-toggle" data-vendor="${esc(vendor)}" title="${collapsed ? 'Expand' : 'Collapse'} ${esc(vendor)} section">${collapsed ? '▸' : '▾'}</button>
        </span>
      </div>
      <div class="cve-section-body" ${collapsed ? 'hidden' : ''}>
      <table class="tbl">
        <thead><tr><th>CVE</th><th>Product</th><th>Severity</th><th>CVSS</th><th>Published</th><th>Summary</th>${editHeader}</tr></thead>
        <tbody>
          ${rows.map(({ it: r, idx }) => {
            const sev = (r.severity || '').toLowerCase();
            const col = SEV_COLOR[sev] || 'inherit';
            const vendorLink = vendorAdvisoryLink(r);
            const sourceList = Array.isArray(r.sources) ? r.sources : (r.source ? [r.source] : []);
            const recent = isRecent(r, recentCutoff);
            const pubDate = (r.published || '').slice(0, 10);
            return `<tr class="${recent ? 'cve-recent' : ''}">
              <td class="mono">
                ${recent ? '<span class="cve-new-badge" title="Discovered in the last 7 days">NEW</span> ' : ''}
                <a href="https://nvd.nist.gov/vuln/detail/${esc(r.id || '')}" target="_blank" rel="noopener">${esc(r.id || '')}</a>
                ${vendorLink ? ` · <a href="${esc(vendorLink.href)}" target="_blank" rel="noopener" title="${esc(vendorLink.title)}">↗</a>` : ''}
              </td>
              <td>${esc(r.product || '')}</td>
              <td style="color:${col};font-weight:600;text-transform:capitalize">${esc(r.severity || '')}</td>
              <td class="mono">${esc(String(r.cvss ?? ''))}</td>
              <td class="mono" style="font-size:11px">${esc(pubDate)}${recent ? ` <span style="color:var(--danger)">(${daysAgo(r.published)}d ago)</span>` : ''}</td>
              <td>
                ${esc(r.summary || '')}
                ${sourceList.length ? `<div style="margin-top:3px">${sourceList.map(s => `<span class="src-pill">${esc(s)}</span>`).join('')}</div>` : ''}
              </td>
              ${state.editMode ? `<td><button class="btn sm danger" data-act="del-cve" data-idx="${idx}" title="Delete">🗑</button></td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    </section>`;
  }).join('');

  c.innerHTML = htmlSection + banner + tableSections;
}

function uniqueVendors(items) {
  const out = new Set();
  for (const it of items) {
    if (it && !(it.html && it.body)) out.add(it.vendor || 'Unknown');
  }
  return [...out];
}

function sortBySeverity(a, b) {
  const ra = SEV_RANK[(a.it.severity || '').toLowerCase()] ?? 5;
  const rb = SEV_RANK[(b.it.severity || '').toLowerCase()] ?? 5;
  if (ra !== rb) return ra - rb;
  const ca = Number(a.it.cvss) || 0;
  const cb = Number(b.it.cvss) || 0;
  if (ca !== cb) return cb - ca;
  // Tie-break: newer first
  return new Date(b.it.published || 0) - new Date(a.it.published || 0);
}

function worstIn(rows) {
  let worst = 99;
  for (const { it } of rows) {
    const r = SEV_RANK[(it.severity || '').toLowerCase()] ?? 5;
    if (r < worst) worst = r;
  }
  return worst;
}

function isRecent(it, cutoff) {
  if (!it.published) return false;
  const t = Date.parse(it.published);
  return !isNaN(t) && t >= cutoff;
}

function daysAgo(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return '?';
  return Math.max(0, Math.floor((Date.now() - t) / 86400_000));
}

// Prefer the vendor-supplied advisory URL when one is present; otherwise
// synthesise the best known public link for that vendor/product.
function vendorAdvisoryLink(r) {
  const refs = Array.isArray(r.references) ? r.references.filter(Boolean) : [];
  const v = (r.vendor || '').toLowerCase();
  const pick = refs.find(u => {
    if (v.includes('cisco')) return /cisco\.com\/security\//i.test(u);
    if (v.includes('microsoft')) return /msrc\.microsoft\.com|microsoft\.com\/.*security/i.test(u);
    if (v.includes('palo')) return /paloaltonetworks\.com/i.test(u);
    if (v.includes('citrix')) return /citrix\.com/i.test(u);
    return false;
  }) || refs[0];
  if (!pick) return null;
  return { href: pick, title: `${r.vendor || ''} advisory` };
}
