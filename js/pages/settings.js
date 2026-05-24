// Settings page. Reveals a form editor when edit mode is unlocked. All
// mutations flow through state.pending.settings; the edit-banner handles Save.

import { state, emit } from '../state.js';
import { esc, toast, uid } from '../utils.js';
import { confirmModal } from '../components/modal.js';
import { loadPool, status as keyStatus } from '../api/keyring.js';
import { chat } from '../api/ai.js';
import { getBruteForceConfig, saveBruteForceConfig, clearBruteForceFailures } from '../auth/edit-mode.js';
import { saveBlockedTerms, getBlockedTerms, DEFAULT_BLOCKED_TERMS, getFlagRateConfig, saveFlagRateConfig, getFlagRateHistory, clearFlagRateHistory } from '../components/flag-validator.js';

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
      <div class="settings-wrap">
        <section class="settings-section">
          <h3>Admin access</h3>
          <p style="font-size:12px;color:var(--text-3);line-height:1.5">
            All Settings options are password-protected. Click <strong>Edit</strong> in the header and enter the admin password to unlock.
            Update checks are now handled in the header — click <strong>⟳ Check for updates</strong> next to the version number.
          </p>
        </section>
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
      ${renderSection('Edit-mode security (brute-force defence)', renderBruteForce(s))}
      ${renderSection('Command flagging — rate-limit & master toggle', renderFlagRate(s))}
      ${renderSection('Flag-report — blocked phrases', renderFlagBlocked(s))}
      ${renderSection('Repository', renderRepo(s))}
      ${renderSection('AI providers (keyring)', renderProviders(s))}
      ${renderSection('Session', renderSession(s))}
    </div>`;

  wireBruteForce(root, s);
  wireFlagRate(root, s);
  wireFlagBlocked(root, s);
  wireRepo(root, s);
  wireProviders(root, s);
  wireSession(root, s);
}

/* ---------- Edit-mode security (brute-force defence) ---------- */
function renderBruteForce(s) {
  // Source of truth: settings (saved + encrypted). Fall back to the
  // localStorage cache so the slider has a sensible starting position
  // even on a brand-new envelope.
  s.bruteForce ||= getBruteForceConfig();
  const bf = s.bruteForce;
  return `
    <p style="font-size:12px;color:var(--text-2);line-height:1.5;margin-bottom:10px">
      If someone enters the wrong admin password too many times in a short window, edit mode is locked out for a configurable cool-off period. The thresholds are mirrored to your browser's local storage so they're enforced even before settings are decrypted.
    </p>

    <div class="form-row" style="margin-top:8px">
      <label>Maximum failed attempts before lockout: <strong id="bfMaxV">${bf.maxAttempts}</strong></label>
      <input type="range" id="bfMax" min="3" max="15" step="1" value="${bf.maxAttempts}" style="width:100%">
      <div class="hint">Range 3–15. Default 5.</div>
    </div>

    <div class="form-row" style="margin-top:14px">
      <label>Sliding window for counting failures: <strong id="bfWinV">${bf.windowMinutes}</strong> min</label>
      <input type="range" id="bfWin" min="1" max="60" step="1" value="${bf.windowMinutes}" style="width:100%">
      <div class="hint">Range 1–60 minutes. Default 10 — failures older than this drop off and don't count.</div>
    </div>

    <div class="form-row" style="margin-top:14px">
      <label>Lockout duration once tripped: <strong id="bfLockV">${bf.lockoutMinutes}</strong> min</label>
      <input type="range" id="bfLock" min="5" max="240" step="5" value="${bf.lockoutMinutes}" style="width:100%">
      <div class="hint">Range 5–240 minutes. Default 30 — must satisfy the user's "over 30 minutes" requirement.</div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap">
      <button class="btn" id="bfReset" type="button" title="Clear any active lockout + failure counters">Reset failures / clear active lockout</button>
      <span class="hint" id="bfStatus"></span>
    </div>`;
}

function wireBruteForce(root, s) {
  s.bruteForce ||= getBruteForceConfig();
  const max  = root.querySelector('#bfMax');
  const win  = root.querySelector('#bfWin');
  const lock = root.querySelector('#bfLock');
  const maxV = root.querySelector('#bfMaxV');
  const winV = root.querySelector('#bfWinV');
  const lockV= root.querySelector('#bfLockV');
  const reset= root.querySelector('#bfReset');
  const status = root.querySelector('#bfStatus');

  function syncOut() {
    s.bruteForce.maxAttempts    = +max.value;
    s.bruteForce.windowMinutes  = +win.value;
    s.bruteForce.lockoutMinutes = +lock.value;
    maxV.textContent = max.value;
    winV.textContent = win.value;
    lockV.textContent = lock.value;
    // Mirror to localStorage right away so the next failed-unlock attempt
    // already enforces the new thresholds without waiting for Save.
    saveBruteForceConfig(s.bruteForce);
    markDirty();
  }
  max.addEventListener('input', syncOut);
  win.addEventListener('input', syncOut);
  lock.addEventListener('input', syncOut);

  reset.addEventListener('click', () => {
    clearBruteForceFailures();
    status.textContent = 'Cleared — no active lockout, attempt counter reset.';
    status.style.color = 'var(--success)';
    setTimeout(() => { status.textContent = ''; status.style.color = ''; }, 4000);
  });
}

/* ---------- Flag rate-limit + master toggle ---------- */
function renderFlagRate(s) {
  s.flagRate ||= getFlagRateConfig();
  const cfg = s.flagRate;
  const used = getFlagRateHistory().length;
  return `
    <p style="font-size:12px;color:var(--text-2);line-height:1.5;margin-bottom:10px">
      The 🚩 Flag button on each command can be misused. The rate limit caps how many flags a single browser can submit per hour, and the master toggle lets you turn the feature off completely (useful during incidents or rollouts where you don't want to be flooded with reports).
    </p>

    <div class="form-row" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <label class="switch-row" style="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600">
        <span style="position:relative;display:inline-block;width:44px;height:22px">
          <input type="checkbox" id="frEnabled" ${cfg.enabled ? 'checked' : ''} style="opacity:0;width:0;height:0">
          <span class="switch-slider" id="frSwitch" style="position:absolute;cursor:pointer;inset:0;background:${cfg.enabled ? '#22c55e' : '#475569'};border-radius:22px;transition:background .15s">
            <span style="position:absolute;left:${cfg.enabled ? '24' : '2'}px;top:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></span>
          </span>
        </span>
        <span id="frEnabledLabel">Command flagging is <strong>${cfg.enabled ? 'enabled' : 'disabled'}</strong></span>
      </label>
    </div>

    <div class="form-row" style="margin-top:14px" id="frRateRow">
      <label>Maximum flags per hour per browser: <strong id="frMaxV">${cfg.maxPerHour}</strong></label>
      <input type="range" id="frMax" min="1" max="50" step="1" value="${cfg.maxPerHour}" style="width:100%">
      <div class="hint">Range 1–50. Default 10. Counting is per-browser localStorage on a rolling 60-minute window.</div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap">
      <span class="hint" style="font-size:11px"><strong id="frUsed">${used}</strong> flag${used === 1 ? '' : 's'} used in the current hour window.</span>
      <button class="btn sm" id="frClear" type="button">Reset hourly counter</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="frStatus" style="font-size:11px"></span>
    </div>`;
}

function wireFlagRate(root, s) {
  s.flagRate ||= getFlagRateConfig();
  const enabled = root.querySelector('#frEnabled');
  const switchEl = root.querySelector('#frSwitch');
  const enabledLabel = root.querySelector('#frEnabledLabel');
  const max = root.querySelector('#frMax');
  const maxV = root.querySelector('#frMaxV');
  const rateRow = root.querySelector('#frRateRow');
  const used = root.querySelector('#frUsed');
  const reset = root.querySelector('#frClear');
  const status = root.querySelector('#frStatus');

  function syncSwitchUi() {
    switchEl.style.background = enabled.checked ? '#22c55e' : '#475569';
    switchEl.querySelector('span').style.left = (enabled.checked ? 24 : 2) + 'px';
    enabledLabel.innerHTML = `Command flagging is <strong>${enabled.checked ? 'enabled' : 'disabled'}</strong>`;
    rateRow.style.opacity = enabled.checked ? '1' : '0.45';
    rateRow.style.pointerEvents = enabled.checked ? '' : 'none';
  }

  function persist() {
    s.flagRate = {
      enabled: enabled.checked,
      maxPerHour: +max.value
    };
    saveFlagRateConfig(s.flagRate);
    markDirty();
  }

  // Make the visual slider clickable too (since the checkbox itself is hidden).
  switchEl.addEventListener('click', () => { enabled.checked = !enabled.checked; syncSwitchUi(); persist(); });

  enabled.addEventListener('change', () => { syncSwitchUi(); persist(); });
  max.addEventListener('input', () => {
    maxV.textContent = max.value;
    persist();
  });

  reset.addEventListener('click', () => {
    clearFlagRateHistory();
    used.textContent = '0';
    status.textContent = 'Hourly counter cleared.';
    status.style.color = 'var(--success)';
    setTimeout(() => { status.textContent = ''; status.style.color = ''; }, 4000);
  });

  syncSwitchUi();
}

/* ---------- Flag-report blocked phrases ---------- */
function renderFlagBlocked(s) {
  // Always read the current persisted extras (admin-added) to seed the
  // textarea — falls back to whatever's in settings if mirror is empty.
  if (!Array.isArray(s.flagBlockedTerms)) s.flagBlockedTerms = [];
  const extra = s.flagBlockedTerms;
  const defaults = DEFAULT_BLOCKED_TERMS;
  return `
    <p style="font-size:12px;color:var(--text-2);line-height:1.5;margin-bottom:10px">
      When a user clicks <strong>🚩 Flag</strong> on a command, their description is rejected if it matches one of these "low-effort" phrases. The phrases below are <strong>added on top of</strong> the built-in defaults — you can't remove the defaults, but you can extend the list with whatever else you want filtered.
    </p>
    <div class="form-row">
      <label>Additional blocked phrases — one per line (case-insensitive)</label>
      <textarea id="fbExtra" rows="6" class="search-input" style="width:100%;font-family:'SF Mono',Consolas,monospace;font-size:12px;resize:vertical" placeholder="garbage&#10;junk&#10;not great">${esc(extra.join('\n'))}</textarea>
      <div class="hint" style="margin-top:6px;font-size:11px">
        Saved to localStorage immediately so the flag dialog picks them up without needing to push settings to GitHub.
      </div>
    </div>
    <details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:12px;color:var(--text-2)">Built-in defaults (${defaults.length} phrases — always active, not editable)</summary>
      <pre style="font-size:11px;color:var(--text-3);background:var(--surface-2,#1e293b);padding:8px;border-radius:4px;margin-top:6px;line-height:1.6;white-space:pre-wrap">${esc(defaults.join('\n'))}</pre>
    </details>
    <div style="margin-top:10px">
      <span class="hint" id="fbStatus" style="font-size:11px"></span>
    </div>`;
}

function wireFlagBlocked(root, s) {
  const ta = root.querySelector('#fbExtra');
  const status = root.querySelector('#fbStatus');
  if (!ta) return;
  ta.addEventListener('input', () => {
    const arr = ta.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    s.flagBlockedTerms = arr;
    saveBlockedTerms(arr);
    markDirty();
    status.textContent = `${arr.length} additional phrase${arr.length === 1 ? '' : 's'} blocked. Live for the next flag attempt.`;
    status.style.color = 'var(--text-3)';
    clearTimeout(status._t);
    status._t = setTimeout(() => { status.textContent = ''; }, 3000);
  });
  // Mirror once on render so the localStorage cache is always current.
  saveBlockedTerms(s.flagBlockedTerms || []);
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
    s.aiProviders.push({ id: 'prov-' + uid().slice(-4), provider: 'openrouter', model: 'openai/gpt-oss-20b:free', key: '', enabled: true });
    markDirty();
    rerender();
  });
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
