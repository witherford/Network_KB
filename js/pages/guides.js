// Troubleshooting & configuration guides — AI-populated or HTML-imported.

import { loadData } from '../dataloader.js';
import { state, emit, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';
import { confirmModal, openModal } from '../components/modal.js';

function workingData() {
  return state.editMode && state.pending.guides ? state.pending.guides : state.data.guides;
}
function ensureDraft() {
  if (!state.pending.guides) {
    state.pending.guides = structuredClone(state.data.guides || { version: 1, items: [] });
    state.pending.guides.items ||= [];
  }
  return state.pending.guides;
}

export async function mount(root) {
  const diskData = await loadData('guides');
  state.data.guides = diskData;
  const data = workingData() || diskData;
  const items = (data && data.items) || [];

  root.innerHTML = `
    <div class="page-toolbar">
      <strong style="font-size:13px">Guides</strong>
      <input id="guideSearch" class="search-input" placeholder="Search guides…">
      <span class="spacer"></span>
      ${state.editMode ? `
        <button class="btn" id="gdFetch">Fetch now</button>
        <button class="btn" id="gdImport" title="Upload one or more HTML files as guides">Import HTML</button>
      ` : ''}
      <span style="font-size:11px;color:var(--text-3);margin-left:12px">Updated: ${fmtDateTime(data?.updatedAt)}</span>
    </div>
    <div class="page" id="guidesPage"></div>`;

  const c = root.querySelector('#guidesPage');
  const render = (filter = '') => renderGuides(c, items, filter);
  root.querySelector('#guideSearch').addEventListener('input', e => render(e.target.value));
  render();

  if (state.editMode) {
    root.querySelector('#gdFetch').addEventListener('click', async e => {
      e.target.disabled = true; e.target.textContent = 'Fetching…';
      try { await fetchForKind('guides', { promptKey: 'guides' }); }
      catch (err) { toast(err.message, 'error'); }
      finally { mount(root); }
    });
    root.querySelector('#gdImport').addEventListener('click', openImportModal);
    c.addEventListener('click', onCardClick);
  }

  on('pending:changed', () => { if (state.currentPage === 'guides') mount(root); });
  on('editmode:changed', () => { if (state.currentPage === 'guides') mount(root); });
  window.addEventListener('nkb:reload', () => { if (state.currentPage === 'guides') mount(root); }, { once: true });
}

async function onCardClick(e) {
  const btn = e.target.closest('button[data-act=del-gd]');
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const draft = ensureDraft();
  const it = draft.items[idx];
  if (!it) return;
  const ok = await confirmModal(`Delete guide "${it.title || 'Untitled'}"?`, { danger: true });
  if (!ok) return;
  draft.items.splice(idx, 1);
  emit('pending:changed');
}

function renderGuides(c, items, filter) {
  const q = filter.trim().toLowerCase();
  const indexed = items.map((it, idx) => ({ it, idx }));
  const matches = indexed.filter(({ it }) => !q || (it.title + ' ' + (it.topic || '') + ' ' + JSON.stringify(it.steps || []) + ' ' + (it.body || '')).toLowerCase().includes(q));
  if (!matches.length) {
    c.innerHTML = `<div class="page-empty">No guides${q ? ' match that search' : ' yet'}. Configure topics in Settings and click <b>Fetch now</b>, or upload an HTML file with <b>Import HTML</b>.</div>`;
    return;
  }
  const byTopic = {};
  for (const row of matches) {
    const t = row.it.topic || row.it.vendor || 'General';
    (byTopic[t] = byTopic[t] || []).push(row);
  }
  c.innerHTML = Object.entries(byTopic).map(([topic, rows]) => `
    <section class="platform-section">
      <div class="platform-header"><h2 class="ptitle">${esc(topic)}</h2><span class="pcnt">${rows.length}</span></div>
      <div class="sections-grid">
        ${rows.map(({ it: r, idx }) => renderCard(r, idx)).join('')}
      </div>
    </section>`).join('');
}

function renderCard(r, idx) {
  // HTML-imported guides render raw (admin-written, admin-only write access).
  // AI-fetched / structured guides go through esc() with step formatting.
  const deleteBtn = state.editMode
    ? `<button class="btn sm danger" data-act="del-gd" data-idx="${idx}" title="Delete guide" style="margin-left:auto">🗑</button>`
    : '';
  if (r.html && r.body) {
    return `<article class="section-card">
      <div class="section-title" style="display:flex;align-items:center;gap:8px">
        <span>${esc(r.title || 'Untitled')}</span>${deleteBtn}
      </div>
      <div class="guide-html" style="padding:10px 12px;font-size:12.5px;line-height:1.55;color:var(--text-2)">${sanitizeHtml(r.body)}</div>
    </article>`;
  }
  const body = r.body || renderSteps(r.steps);
  return `<article class="section-card">
    <div class="section-title" style="display:flex;align-items:center;gap:8px">
      <span>${esc(r.title || 'Untitled')}</span>${deleteBtn}
    </div>
    <div style="padding:10px 12px;font-size:12.5px;line-height:1.6;color:var(--text-2);white-space:pre-wrap">${esc(body).slice(0, 4000)}${body.length > 4000 ? '…' : ''}</div>
  </article>`;
}

function renderSteps(steps) {
  if (!Array.isArray(steps)) return '';
  return steps.map((s, i) => `${s.n || i + 1}. ${s.action || ''}${s.expected ? ' → ' + s.expected : ''}`).join('\n');
}

// Strip <script>, <iframe>, and inline event handlers — this is admin-only
// content in their own repo, but keep defensive so a malformed upload can't
// hijack the page.
function sanitizeHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '');
}

function openImportModal() {
  openModal((el, close) => {
    el.innerHTML = `
      <h3>Import HTML guides</h3>
      <p style="font-size:12px;color:var(--text-3);line-height:1.5;margin-bottom:8px">
        Select one or more <code>.html</code> files. Each becomes a guide card — filename (or
        the document's &lt;title&gt;) becomes the title, and the &lt;body&gt; is rendered as
        rich HTML (code blocks, images, lists are all preserved). Scripts and event handlers
        are stripped.
      </p>
      <div class="form-row" style="margin-top:6px">
        <label>Topic (optional — groups these files together)</label>
        <input id="ghTopic" class="search-input" placeholder="e.g. Cisco IOS">
      </div>
      <div class="form-row" style="margin-top:8px">
        <label>Files</label>
        <input type="file" id="ghFile" accept=".html,.htm,text/html" multiple>
      </div>
      <div id="ghPreview" style="margin-top:10px;font-size:12px;color:var(--text-3)"></div>
      <div class="modal-footer">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="apply" disabled>Import</button>
      </div>`;
    let staged = [];
    const preview = el.querySelector('#ghPreview');
    const applyBtn = el.querySelector('[data-act=apply]');

    el.querySelector('#ghFile').addEventListener('change', async e => {
      staged = [];
      for (const f of e.target.files) {
        const text = await f.text();
        staged.push({ name: f.name, size: f.size, text });
      }
      preview.innerHTML = staged.map(f => `<div>• ${esc(f.name)} <span style="color:var(--text-3)">(${f.size} bytes)</span></div>`).join('');
      applyBtn.disabled = !staged.length;
      applyBtn.textContent = staged.length ? `Import ${staged.length} file${staged.length === 1 ? '' : 's'}` : 'Import';
    });
    el.querySelector('[data-act=cancel]').addEventListener('click', close);
    applyBtn.addEventListener('click', () => {
      if (!staged.length) return;
      const topic = el.querySelector('#ghTopic').value.trim();
      const draft = ensureDraft();
      for (const f of staged) {
        const title = extractTitle(f.text) || f.name.replace(/\.(html?|htm)$/i, '');
        const body = extractBody(f.text);
        draft.items.push({
          title,
          topic: topic || undefined,
          html: true,
          body,
          source: 'html-import',
          addedAt: new Date().toISOString()
        });
      }
      emit('pending:changed');
      toast(`Imported ${staged.length} guide${staged.length === 1 ? '' : 's'} — review and Save`, 'success');
      close();
    });
  }, { wide: true });
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/\s+/g, ' ').trim();
}
function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m ? m[1] : html).trim();
}
