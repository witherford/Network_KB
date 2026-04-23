// First-run wizard. Collects repo/PAT/password/AI key → encrypts →
// commits data/settings.enc.json (and empty data stubs) via the Contents API.
// Returns {ok, settings, password} so edit-mode can auto-activate on finish.

import { openModal } from '../components/modal.js';
import { encryptJson, strengthScore } from '../crypto.js';
import { validatePat, putFile, getFile } from '../api/github.js';
import { esc, toast } from '../utils.js';

const STEPS = ['repo', 'pat', 'password', 'ai', 'finish'];

const AI_PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter',  defaultModel: 'openai/gpt-oss-20b:free' },
  { id: 'openai',     label: 'OpenAI',      defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic',  label: 'Anthropic',   defaultModel: 'claude-haiku-4-5' },
  { id: 'groq',       label: 'Groq',        defaultModel: 'llama-3.3-70b-versatile' }
];

const DEFAULT_PROMPTS = {
  commands: 'For vendor {{vendor}} under domains {{domains}}, return JSON array of CLI commands. Each item: {cmd, desc, type: show|config|troubleshooting, section}.',
  software: 'For vendor {{vendor}} product {{product}}, list latest / recommended / end-of-life versions. Return JSON: {latest, recommended, eol[], notes}.',
  guides:   'For topic {{topic}}, write a step-by-step troubleshooting/config guide. Return JSON: {title, steps: [{n, action, expected, commands: []}], refs: []}.',
  cves:     'For vendor {{vendor}} product {{product}}, return current CVEs from the last 90 days. JSON array: {id, cvss, severity, summary, affected, fixed, references: []}.',
  regex:    'Return a {{engine}}-compatible regex that matches: {{description}}. Return plain regex text only, no delimiters, no explanation.'
};

const DEFAULT_DOMAINS = [
  'docs.netscaler.com',
  'cisco.com/c/en/us/td/docs',
  'docs.paloaltonetworks.com',
  'learn.microsoft.com',
  'docs.aws.amazon.com',
  'kb.vmware.com',
  'ubuntu.com/server/docs',
  'wireshark.org/docs'
];

export async function openWizard() {
  return new Promise(resolve => {
    const ctx = {
      step: 0,
      data: {
        repo: detectRepo(),
        pat: '',
        password: '',
        password2: '',
        aiProvider: 'openrouter',
        aiKey: '',
        aiModel: AI_PROVIDERS[0].defaultModel
      },
      validated: { repo: false, pat: false },
      defaultBranch: 'main'
    };

    const done = (payload) => { closeFn?.(); resolve(payload); };
    let closeFn;

    openModal((el, close) => {
      closeFn = close;
      render(el, ctx, done);
    }, { wide: true, onClose: () => resolve(null) });
  });
}

function detectRepo() {
  const m = location.host.match(/^([^.]+)\.github\.io$/);
  if (!m) return '';
  const owner = m[1];
  const path = location.pathname.replace(/^\/+/, '').split('/')[0];
  return path ? `${owner}/${path}` : owner + '/';
}

function render(el, ctx, done) {
  const step = STEPS[ctx.step];
  el.innerHTML = `
    <h3 style="margin-bottom:4px">First-time setup</h3>
    <div style="font-size:12px;color:var(--text-3);margin-bottom:14px">
      Step ${ctx.step + 1} of ${STEPS.length} — ${stepTitle(step)}
    </div>
    <div class="wiz-steps" style="display:flex;gap:4px;margin-bottom:16px">
      ${STEPS.map((_, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i <= ctx.step ? 'var(--accent)' : 'var(--border)'}"></div>`).join('')}
    </div>
    <div id="wizBody">${renderStep(step, ctx)}</div>
    <div class="modal-footer">
      <button class="btn" data-act="cancel">Cancel</button>
      ${ctx.step > 0 ? '<button class="btn" data-act="back">Back</button>' : ''}
      <button class="btn primary" data-act="next" id="wizNext">${ctx.step === STEPS.length - 1 ? 'Finish' : 'Next'}</button>
    </div>`;

  wireStep(el, step, ctx);

  el.querySelector('[data-act=cancel]').addEventListener('click', () => done(null));
  el.querySelector('[data-act=back]')?.addEventListener('click', () => { ctx.step--; render(el, ctx, done); });
  el.querySelector('[data-act=next]').addEventListener('click', async () => {
    const ok = await advance(el, ctx, done);
    if (ok) {
      if (ctx.step < STEPS.length - 1) { ctx.step++; render(el, ctx, done); }
    }
  });
}

function stepTitle(s) {
  return { repo: 'Target GitHub repo', pat: 'GitHub access token', password: 'Admin password', ai: 'First AI provider', finish: 'Commit settings' }[s] || s;
}

function renderStep(step, ctx) {
  if (step === 'repo') {
    return `
      <div class="form-row">
        <label>Repository (owner/name)</label>
        <input id="wRepo" class="search-input" style="width:100%" placeholder="owner/repo" value="${esc(ctx.data.repo)}">
      </div>
      <p style="font-size:11px;color:var(--text-3);line-height:1.5;margin-top:8px">
        The app will commit settings and data updates back to this repo. It's been auto-detected from the URL when possible.
      </p>`;
  }
  if (step === 'pat') {
    return `
      <div class="form-row">
        <label>Fine-grained personal access token</label>
        <input id="wPat" type="password" class="search-input" style="width:100%" placeholder="github_pat_..." value="${esc(ctx.data.pat)}">
      </div>
      <p style="font-size:11px;color:var(--text-3);line-height:1.5;margin-top:8px">
        Required scope: <b>Contents: read/write</b> on <code>${esc(ctx.data.repo)}</code>. Generate one at
        Settings → Developer settings → Fine-grained tokens. The PAT is encrypted inside settings.enc.json.
      </p>
      <div id="wPatMsg" style="font-size:12px;margin-top:8px;min-height:18px"></div>`;
  }
  if (step === 'password') {
    return `
      <div class="form-row">
        <label>Admin password</label>
        <input id="wPw1" type="password" class="search-input" style="width:100%" autocomplete="new-password">
      </div>
      <div class="form-row" style="margin-top:8px">
        <label>Confirm password</label>
        <input id="wPw2" type="password" class="search-input" style="width:100%" autocomplete="new-password">
      </div>
      <div id="wPwStrength" style="display:flex;gap:4px;margin-top:8px;height:4px"></div>
      <p style="font-size:11px;color:var(--text-3);line-height:1.5;margin-top:8px">
        This password encrypts your PAT and AI keys with AES-GCM (PBKDF2-SHA256, 600k iterations).
        <b>There is no recovery.</b> If you forget it, delete <code>data/settings.enc.json</code> in the repo and re-run this wizard.
      </p>`;
  }
  if (step === 'ai') {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-row">
          <label>Provider</label>
          <select id="wAiProv">
            ${AI_PROVIDERS.map(p => `<option value="${p.id}" ${p.id === ctx.data.aiProvider ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Model</label>
          <input id="wAiModel" class="search-input" value="${esc(ctx.data.aiModel)}">
        </div>
      </div>
      <div class="form-row" style="margin-top:8px">
        <label>API key</label>
        <input id="wAiKey" type="password" class="search-input" style="width:100%" placeholder="sk-..." value="${esc(ctx.data.aiKey)}">
      </div>
      <p style="font-size:11px;color:var(--text-3);line-height:1.5;margin-top:8px">
        You can add more providers later in Settings. Keys are encrypted along with the PAT.
      </p>`;
  }
  if (step === 'finish') {
    return `
      <p style="font-size:13px;line-height:1.6">Ready to commit:</p>
      <ul style="font-size:12px;color:var(--text-2);line-height:1.8;margin:8px 0 8px 18px">
        <li><code>data/settings.enc.json</code> — encrypted settings</li>
        <li><code>data/software.json</code>, <code>data/guides.json</code>, <code>data/cves.json</code> — empty stubs if missing</li>
      </ul>
      <p style="font-size:11px;color:var(--text-3);line-height:1.5">
        Commit message: <code>bootstrap: initial settings</code>
      </p>
      <div id="wFinMsg" style="font-size:12px;margin-top:10px;min-height:18px"></div>`;
  }
  return '';
}

function wireStep(el, step, ctx) {
  if (step === 'repo') {
    el.querySelector('#wRepo').addEventListener('input', e => { ctx.data.repo = e.target.value.trim(); });
  }
  if (step === 'pat') {
    el.querySelector('#wPat').addEventListener('input', e => { ctx.data.pat = e.target.value.trim(); });
  }
  if (step === 'password') {
    const p1 = el.querySelector('#wPw1');
    const p2 = el.querySelector('#wPw2');
    const meter = el.querySelector('#wPwStrength');
    p1.value = ctx.data.password;
    p2.value = ctx.data.password2;
    const drawMeter = () => {
      const s = strengthScore(p1.value);
      const colors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];
      meter.innerHTML = Array.from({ length: 5 }, (_, i) =>
        `<div style="flex:1;border-radius:2px;background:${i < s ? colors[Math.max(0, s - 1)] : 'var(--border)'}"></div>`
      ).join('');
    };
    drawMeter();
    p1.addEventListener('input', () => { ctx.data.password = p1.value; drawMeter(); });
    p2.addEventListener('input', () => { ctx.data.password2 = p2.value; });
  }
  if (step === 'ai') {
    const prov = el.querySelector('#wAiProv');
    const model = el.querySelector('#wAiModel');
    prov.addEventListener('change', e => {
      ctx.data.aiProvider = e.target.value;
      const def = AI_PROVIDERS.find(p => p.id === e.target.value);
      if (def) { ctx.data.aiModel = def.defaultModel; model.value = def.defaultModel; }
    });
    model.addEventListener('input', e => { ctx.data.aiModel = e.target.value.trim(); });
    el.querySelector('#wAiKey').addEventListener('input', e => { ctx.data.aiKey = e.target.value.trim(); });
  }
}

async function advance(el, ctx, done) {
  const step = STEPS[ctx.step];
  const next = el.querySelector('#wizNext');
  const setBusy = (b, label) => { next.disabled = b; if (label) next.textContent = label; };

  if (step === 'repo') {
    if (!/^[^/\s]+\/[^/\s]+$/.test(ctx.data.repo)) {
      toast('Enter repo as owner/name', 'error'); return false;
    }
    return true;
  }

  if (step === 'pat') {
    if (!ctx.data.pat) { toast('Paste your PAT', 'error'); return false; }
    const msg = el.querySelector('#wPatMsg');
    msg.textContent = 'Validating…';
    msg.style.color = 'var(--text-3)';
    setBusy(true, 'Checking…');
    try {
      const info = await validatePat({ pat: ctx.data.pat, repo: ctx.data.repo });
      ctx.defaultBranch = info.defaultBranch || 'main';
      msg.textContent = `✓ Access confirmed (branch: ${info.defaultBranch}).`;
      msg.style.color = 'var(--success)';
      setBusy(false, 'Next');
      return true;
    } catch (err) {
      msg.textContent = '✗ ' + err.message;
      msg.style.color = 'var(--danger)';
      setBusy(false, 'Next');
      return false;
    }
  }

  if (step === 'password') {
    if (ctx.data.password.length < 8) { toast('Password must be at least 8 characters', 'error'); return false; }
    if (ctx.data.password !== ctx.data.password2) { toast('Passwords do not match', 'error'); return false; }
    if (strengthScore(ctx.data.password) < 3) { toast('Password is weak — add uppercase, digits, or symbols', 'error'); return false; }
    return true;
  }

  if (step === 'ai') {
    if (!ctx.data.aiKey) { toast('Paste an AI API key', 'error'); return false; }
    if (!ctx.data.aiModel) { toast('Specify a model', 'error'); return false; }
    return true;
  }

  if (step === 'finish') {
    return await commit(el, ctx, done);
  }

  return true;
}

async function commit(el, ctx, done) {
  const msg = el.querySelector('#wFinMsg');
  const next = el.querySelector('#wizNext');
  next.disabled = true;
  next.textContent = 'Committing…';
  msg.style.color = 'var(--text-3)';

  const settings = {
    githubPat: ctx.data.pat,
    githubRepo: ctx.data.repo,
    branch: ctx.defaultBranch,
    aiProviders: [{
      id: ctx.data.aiProvider + '-1',
      provider: ctx.data.aiProvider,
      key: ctx.data.aiKey,
      model: ctx.data.aiModel,
      enabled: true
    }],
    prompts: { ...DEFAULT_PROMPTS },
    domains: DEFAULT_DOMAINS,
    watchlist: { vendors: [] },
    cron: { schedule: '0 3 * * *', enabled: true },
    editSessionMinutes: 30
  };

  try {
    msg.textContent = 'Encrypting settings…';
    const envelope = await encryptJson(settings, ctx.data.password);

    msg.textContent = 'Fetching existing settings.enc.json sha (if any)…';
    const existing = await getFile({ pat: ctx.data.pat, repo: ctx.data.repo, path: 'data/settings.enc.json' });

    msg.textContent = 'Committing settings.enc.json…';
    await putFile({
      pat: ctx.data.pat,
      repo: ctx.data.repo,
      path: 'data/settings.enc.json',
      content: JSON.stringify(envelope, null, 2) + '\n',
      message: 'bootstrap: initial encrypted settings',
      sha: existing?.sha,
      branch: ctx.defaultBranch
    });

    for (const [path, body] of Object.entries(emptyStubs())) {
      const cur = await getFile({ pat: ctx.data.pat, repo: ctx.data.repo, path });
      if (cur) continue;
      await putFile({
        pat: ctx.data.pat, repo: ctx.data.repo, path,
        content: body, message: 'bootstrap: seed ' + path,
        branch: ctx.defaultBranch
      });
    }

    msg.textContent = '✓ Done.';
    msg.style.color = 'var(--success)';
    toast('Bootstrap complete — edit mode unlocked', 'success', 4000);
    done({ ok: true, settings, password: ctx.data.password });
    return true;
  } catch (err) {
    msg.textContent = '✗ ' + err.message;
    msg.style.color = 'var(--danger)';
    next.disabled = false;
    next.textContent = 'Retry';
    return false;
  }
}

function emptyStubs() {
  const now = new Date().toISOString();
  const seed = (extra) => JSON.stringify({ version: 1, updatedAt: now, items: [], ...extra }, null, 2) + '\n';
  return {
    'data/software.json': seed(),
    'data/guides.json': seed(),
    'data/cves.json': seed()
  };
}
