// Troubleshooting & configuration guides — AI-populated.

import { loadData } from '../dataloader.js';
import { state, on } from '../state.js';
import { esc, fmtDateTime, toast } from '../utils.js';
import { fetchForKind } from '../components/ai-fetch.js';

export async function mount(root) {
  const diskData = await loadData('guides');
  const data = state.pending.guides || diskData;
  state.data.guides = diskData;
  const items = (data && data.items) || [];

  root.innerHTML = `
    <div class="page-toolbar">
      <strong style="font-size:13px">Guides</strong>
      <input id="guideSearch" class="search-input" placeholder="Search guides…">
      <span class="spacer"></span>
      ${state.editMode ? '<button class="btn" id="gdFetch">Fetch now</button>' : ''}
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
  }

  on('pending:changed', () => { if (state.currentPage === 'guides') mount(root); });
  window.addEventListener('nkb:reload', () => { if (state.currentPage === 'guides') mount(root); }, { once: true });
}

function renderGuides(c, items, filter) {
  const q = filter.trim().toLowerCase();
  const matches = items.filter(it => !q || (it.title + ' ' + (it.topic || '') + ' ' + JSON.stringify(it.steps || []) + ' ' + (it.body || '')).toLowerCase().includes(q));
  if (!matches.length) {
    c.innerHTML = `<div class="page-empty">No guides${q ? ' match that search' : ' yet'}. Configure topics in Settings and click <b>Fetch now</b>.</div>`;
    return;
  }
  const byTopic = {};
  for (const it of matches) {
    const t = it.topic || it.vendor || 'General';
    (byTopic[t] = byTopic[t] || []).push(it);
  }
  c.innerHTML = Object.entries(byTopic).map(([topic, rows]) => `
    <section class="platform-section">
      <div class="platform-header"><h2 class="ptitle">${esc(topic)}</h2><span class="pcnt">${rows.length}</span></div>
      <div class="sections-grid">
        ${rows.map(r => {
          const body = r.body || renderSteps(r.steps);
          return `<article class="section-card">
            <div class="section-title">${esc(r.title || 'Untitled')}</div>
            <div style="padding:10px 12px;font-size:12.5px;line-height:1.6;color:var(--text-2);white-space:pre-wrap">${esc(body).slice(0, 1400)}${body.length > 1400 ? '…' : ''}</div>
          </article>`;
        }).join('')}
      </div>
    </section>`).join('');
}

function renderSteps(steps) {
  if (!Array.isArray(steps)) return '';
  return steps.map((s, i) => `${s.n || i + 1}. ${s.action || ''}${s.expected ? ' → ' + s.expected : ''}`).join('\n');
}
