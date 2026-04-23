// Troubleshooting & configuration guides — AI-populated or HTML-imported.

import { loadData } from '../dataloader.js';
import { state, emit, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';
import { confirmModal } from '../components/modal.js';
import { openHtmlImport, renderHtmlCard } from '../components/html-import.js';

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
    root.querySelector('#gdImport').addEventListener('click', () => {
      openHtmlImport({
        kind: 'guides',
        topicLabel: 'Topic (optional — groups these files together)',
        onImport: files => {
          const draft = ensureDraft();
          draft.items.push(...files);
          emit('pending:changed');
        }
      });
    });
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
  const deleteBtn = state.editMode
    ? `<button class="btn sm danger" data-act="del-gd" data-idx="${idx}" title="Delete guide" style="margin-left:auto">🗑</button>`
    : '';
  if (r.html && r.body) {
    return renderHtmlCard({ title: r.title, body: r.body, deleteBtn });
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
