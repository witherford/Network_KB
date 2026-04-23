// Settings page. Reveals a form editor when edit mode is unlocked. All
// mutations flow through state.pending.settings; the edit-banner handles Save.

import { state, emit } from '../state.js';
import { esc, toast, uid } from '../utils.js';
import { confirmModal } from '../components/modal.js';
import { loadPool, status as keyStatus } from '../api/keyring.js';
import { chat } from '../api/ai.js';

const AI_PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'openai',     label: 'OpenAI' },
  { id: 'anthropic',  label: 'Anthropic' },
  { id: 'groq',       label: 'Groq' }
];

export async function mount(root) {
  if (!state.editMode) {
    root.innerHTML = `
      <div class="page-toolbar"><strong style="font-size:13px">Settings</strong><span class="spacer"></span></div>
      <div class="page-empty">
        <p style="margin-bottom:10px">Settings are password-protected.</p>
        <p style="font-size:12px;color:var(--text-3)">Click <strong>Edit</strong> in the header and enter the admin password to unlock.</p>
      </div>`;
    return;
  }

  // Working copy comes from state.pending.settings if we've already edited;
  // otherwise we clone the currently-loaded settings.
  if (!state.pending.settings) {
    state.pending.settings = structuredClone(state.settings);
  }
  const s = state.pending.settings;
  loadPool(s.aiProviders);

  root.innerHTML = `
    <div class="page-toolbar">
      <strong style="font-size:13px">Settings</strong>
      <span class="spacer"></span>
      <span style="font-size:11px;color:var(--text-3)">Use the floating banner to Save or Discard.</span>
    </div>
    <div class="settings-wrap">
      ${renderSection('Repository', renderRepo(s))}
      ${renderSection('AI providers (keyring)', renderProviders(s))}
      ${renderSection('AI prompts', renderPrompts(s))}
      ${renderSection('Source domains', renderDomains(s))}
      ${renderSection('Watchlist', renderWatchlist(s))}
      ${renderSection('Scheduled pull (cron)', renderCron(s))}
      ${renderSection('Session', renderSession(s))}
    </div>`;

  wireRepo(root, s);
  wireProviders(root, s);
  wirePrompts(root, s);
  wireDomains(root, s);
  wireWatchlist(root, s);
  wireCron(root, s);
  wireSession(root, s);
}

function renderSection(title, body) {
  return `<section class="settings-section">
    <h3>${esc(title)}</h3>
    <div class="settings-body">${body}</div>
  </section>`;
}

/* ---------- Repo ---------- */
function renderRepo(s) {
  return `
    <div class="form-row"><label>Repo (owner/name)</label><input id="setRepo" class="search-input" style="width:100%" value="${esc(s.githubRepo || '')}"></div>
    <div class="form-row" style="margin-top:8px"><label>Default branch</label><input id="setBranch" class="search-input" style="width:100%" value="${esc(s.branch || 'main')}"></div>
    <div class="form-row" style="margin-top:8px"><label>GitHub PAT</label><input id="setPat" type="password" class="search-input" style="width:100%" value="${esc(s.githubPat || '')}"></div>
    <p style="font-size:11px;color:var(--text-3);margin-top:6px">Changes to these values take effect on the next Save.</p>`;
}
function wireRepo(root, s) {
  root.querySelector('#setRepo').addEventListener('input', e => { s.githubRepo = e.target.value.trim(); markDirty(); });
  root.querySelector('#setBranch').addEventListener('input', e => { s.branch = e.target.value.trim(); markDirty(); });
  root.querySelector('#setPat').addEventListener('input', e => { s.githubPat = e.target.value.trim(); markDirty(); });
}

/* ---------- Providers ---------- */
function renderProviders(s) {
  const rows = (s.aiProviders || []).map(p => renderProviderRow(p)).join('');
  return `
    <div id="provRows">${rows || '<p style="font-size:12px;color:var(--text-3)">No providers yet.</p>'}</div>
    <button class="btn" id="provAdd" style="margin-top:8px">Add provider</button>
    <div id="provStatus" style="margin-top:8px;font-size:11px;color:var(--text-3)"></div>`;
}
function renderProviderRow(p) {
  return `
    <div class="prov-row" data-id="${esc(p.id)}" style="display:grid;grid-template-columns:1fr 1fr 1.3fr 2fr auto auto auto;gap:6px;margin-bottom:6px">
      <input class="search-input" data-f="id" value="${esc(p.id)}" placeholder="id">
      <select data-f="provider">${AI_PROVIDERS.map(x => `<option value="${x.id}" ${x.id === p.provider ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
      <input class="search-input" data-f="model" value="${esc(p.model || '')}" placeholder="model">
      <input class="search-input" data-f="key" type="password" value="${esc(p.key || '')}" placeholder="API key">
      <label style="display:flex;align-items:center;gap:4px;font-size:11px"><input type="checkbox" data-f="enabled" ${p.enabled !== false ? 'checked' : ''}>on</label>
      <button class="btn" data-f="test" title="Test with a 1-token ping">Test</button>
      <button class="btn danger" data-f="del" title="Remove">✕</button>
    </div>`;
}
function wireProviders(root, s) {
  const rowsEl = root.querySelector('#provRows');
  const statusEl = root.querySelector('#provStatus');
  const rerender = () => { rowsEl.innerHTML = (s.aiProviders || []).map(renderProviderRow).join(''); attach(); };
  const attach = () => {
    rowsEl.querySelectorAll('.prov-row').forEach(row => {
      const id = row.dataset.id;
      const p = s.aiProviders.find(x => x.id === id);
      row.querySelectorAll('[data-f]').forEach(ctrl => {
        const f = ctrl.dataset.f;
        if (f === 'del') {
          ctrl.addEventListener('click', async () => {
            const ok = await confirmModal(`Remove provider "${id}"?`, { danger: true });
            if (!ok) return;
            s.aiProviders = s.aiProviders.filter(x => x.id !== id);
            markDirty();
            rerender();
          });
        } else if (f === 'test') {
          ctrl.addEventListener('click', async () => {
            statusEl.textContent = `Testing ${p.id}…`;
            statusEl.style.color = 'var(--text-3)';
            try {
              loadPool([p]);
              const r = await chat({ messages: [{ role: 'user', content: 'Reply with OK.' }], maxTokens: 8 });
              statusEl.textContent = `✓ ${p.id}: ${r.text.slice(0, 40)}`;
              statusEl.style.color = 'var(--success)';
            } catch (err) {
              statusEl.textContent = `✗ ${p.id}: ${err.message}`;
              statusEl.style.color = 'var(--danger)';
            } finally {
              loadPool(s.aiProviders);
            }
          });
        } else if (f === 'enabled') {
          ctrl.addEventListener('change', e => { p.enabled = e.target.checked; markDirty(); });
        } else {
          ctrl.addEventListener('input', e => { p[f] = e.target.value.trim(); markDirty(); });
        }
      });
    });
  };
  attach();
  root.querySelector('#provAdd').addEventListener('click', () => {
    s.aiProviders ||= [];
    s.aiProviders.push({ id: 'prov-' + uid().slice(-4), provider: 'openrouter', model: 'openai/gpt-4o-mini', key: '', enabled: true });
    markDirty();
    rerender();
  });
}

/* ---------- Prompts ---------- */
function renderPrompts(s) {
  const prompts = s.prompts || {};
  return Object.entries(prompts).map(([k, v]) => `
    <div class="form-row" style="margin-bottom:8px">
      <label>${esc(k)}</label>
      <textarea id="pr_${esc(k)}" rows="3" class="search-input" style="width:100%;font-family:inherit;resize:vertical">${esc(v)}</textarea>
    </div>`).join('');
}
function wirePrompts(root, s) {
  const prompts = s.prompts || {};
  for (const k of Object.keys(prompts)) {
    const el = root.querySelector('#pr_' + k);
    if (!el) continue;
    el.addEventListener('input', e => { s.prompts[k] = e.target.value; markDirty(); });
  }
}

/* ---------- Domains ---------- */
function renderDomains(s) {
  return `
    <textarea id="setDomains" rows="6" class="search-input" style="width:100%;font-family:inherit;resize:vertical" placeholder="one domain per line">${esc((s.domains || []).join('\n'))}</textarea>
    <p style="font-size:11px;color:var(--text-3);margin-top:4px">Domains the AI prompt instructs to source from. One per line.</p>`;
}
function wireDomains(root, s) {
  root.querySelector('#setDomains').addEventListener('input', e => {
    s.domains = e.target.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    markDirty();
  });
}

/* ---------- Watchlist ---------- */
function renderWatchlist(s) {
  const list = (s.watchlist && s.watchlist.vendors) || [];
  return `
    <div id="wlRows">${list.map(renderWlRow).join('') || '<p style="font-size:12px;color:var(--text-3)">No vendors yet.</p>'}</div>
    <button class="btn" id="wlAdd" style="margin-top:8px">Add vendor</button>`;
}
function renderWlRow(v, i) {
  return `
    <div class="wl-row" data-i="${i}" style="display:grid;grid-template-columns:1fr 2fr auto;gap:6px;margin-bottom:6px">
      <input class="search-input" data-f="vendor" value="${esc(v.vendor || '')}" placeholder="Vendor">
      <input class="search-input" data-f="products" value="${esc((v.products || []).join(', '))}" placeholder="Products (comma-separated)">
      <button class="btn danger" data-f="del">✕</button>
    </div>`;
}
function wireWatchlist(root, s) {
  s.watchlist ||= { vendors: [] };
  const rowsEl = root.querySelector('#wlRows');
  const rerender = () => { rowsEl.innerHTML = s.watchlist.vendors.map((v, i) => renderWlRow(v, i)).join(''); attach(); };
  const attach = () => {
    rowsEl.querySelectorAll('.wl-row').forEach(row => {
      const i = Number(row.dataset.i);
      row.querySelector('[data-f=vendor]').addEventListener('input', e => { s.watchlist.vendors[i].vendor = e.target.value.trim(); markDirty(); });
      row.querySelector('[data-f=products]').addEventListener('input', e => { s.watchlist.vendors[i].products = e.target.value.split(',').map(x => x.trim()).filter(Boolean); markDirty(); });
      row.querySelector('[data-f=del]').addEventListener('click', () => { s.watchlist.vendors.splice(i, 1); markDirty(); rerender(); });
    });
  };
  attach();
  root.querySelector('#wlAdd').addEventListener('click', () => {
    s.watchlist.vendors.push({ vendor: '', products: [] });
    markDirty(); rerender();
  });
}

/* ---------- Cron ---------- */
function renderCron(s) {
  const c = s.cron || { schedule: '0 3 * * *', enabled: true };
  return `
    <div class="form-row"><label>Cron schedule</label><input id="setCron" class="search-input" style="width:100%" value="${esc(c.schedule)}" placeholder="0 3 * * *"></div>
    <label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:12px">
      <input type="checkbox" id="setCronOn" ${c.enabled ? 'checked' : ''}> Enabled
    </label>
    <p style="font-size:11px;color:var(--text-3);margin-top:4px">
      Committing settings also rewrites <code>.github/workflows/ai-pull.yml</code> to match this schedule.
    </p>`;
}
function wireCron(root, s) {
  s.cron ||= { schedule: '0 3 * * *', enabled: true };
  root.querySelector('#setCron').addEventListener('input', e => { s.cron.schedule = e.target.value.trim(); markDirty(); });
  root.querySelector('#setCronOn').addEventListener('change', e => { s.cron.enabled = e.target.checked; markDirty(); });
}

/* ---------- Session ---------- */
function renderSession(s) {
  return `
    <div class="form-row"><label>Edit session timeout (minutes)</label>
      <input id="setSess" type="number" class="search-input" style="width:100px" min="1" max="480" value="${s.editSessionMinutes || 30}">
    </div>`;
}
function wireSession(root, s) {
  root.querySelector('#setSess').addEventListener('input', e => {
    const n = Math.max(1, Math.min(480, parseInt(e.target.value) || 30));
    s.editSessionMinutes = n;
    markDirty();
  });
}

function markDirty() { emit('pending:changed'); }
