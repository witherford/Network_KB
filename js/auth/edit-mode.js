// Edit mode: load settings.enc.json, prompt for password, decrypt, activate
// edit UI across pages. Password + decrypted settings live in memory only.
//
// Brute-force defence:
//   N failed unlock attempts within W minutes → lockout for L minutes.
//   Defaults: N=5, W=10, L=30. Configurable via the Settings page (slider)
//   when edit mode is unlocked. The thresholds are mirrored to localStorage
//   so subsequent locked-out attempts can enforce them without first
//   decrypting settings.

import { state, emit } from '../state.js';
import { toast } from '../utils.js';
import { openModal } from '../components/modal.js';
import { decryptJson } from '../crypto.js';

let timer = null;

// ---------- Brute-force config + state (localStorage) ----------

const BF_CFG_KEY  = 'nkb.bf.cfg';
const BF_FAIL_KEY = 'nkb.bf.fails';
const BF_LOCK_KEY = 'nkb.bf.lockoutUntil';

const DEFAULT_BF = Object.freeze({ maxAttempts: 5, windowMinutes: 10, lockoutMinutes: 30 });

export function getBruteForceConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(BF_CFG_KEY));
    if (raw && typeof raw === 'object') {
      return {
        maxAttempts:    clamp(+raw.maxAttempts || DEFAULT_BF.maxAttempts, 3, 15),
        windowMinutes:  clamp(+raw.windowMinutes || DEFAULT_BF.windowMinutes, 1, 60),
        lockoutMinutes: clamp(+raw.lockoutMinutes || DEFAULT_BF.lockoutMinutes, 5, 240)
      };
    }
  } catch {}
  return { ...DEFAULT_BF };
}

export function saveBruteForceConfig(cfg) {
  const safe = {
    maxAttempts:    clamp(+cfg.maxAttempts || DEFAULT_BF.maxAttempts, 3, 15),
    windowMinutes:  clamp(+cfg.windowMinutes || DEFAULT_BF.windowMinutes, 1, 60),
    lockoutMinutes: clamp(+cfg.lockoutMinutes || DEFAULT_BF.lockoutMinutes, 5, 240)
  };
  try { localStorage.setItem(BF_CFG_KEY, JSON.stringify(safe)); } catch {}
  return safe;
}

export function getLockState() {
  const v = parseInt(localStorage.getItem(BF_LOCK_KEY) || '0', 10);
  if (v && v > Date.now()) return { locked: true, until: v };
  if (v) localStorage.removeItem(BF_LOCK_KEY);
  return { locked: false };
}

export function clearBruteForceFailures() {
  localStorage.removeItem(BF_FAIL_KEY);
  localStorage.removeItem(BF_LOCK_KEY);
}

function recordFailure() {
  const cfg = getBruteForceConfig();
  const now = Date.now();
  let fails = [];
  try { fails = JSON.parse(localStorage.getItem(BF_FAIL_KEY) || '[]'); } catch {}
  fails.push(now);
  const cutoff = now - cfg.windowMinutes * 60 * 1000;
  fails = fails.filter(t => t > cutoff);
  if (fails.length >= cfg.maxAttempts) {
    const until = now + cfg.lockoutMinutes * 60 * 1000;
    localStorage.setItem(BF_LOCK_KEY, String(until));
    localStorage.removeItem(BF_FAIL_KEY);
    return { locked: true, until, lockoutMinutes: cfg.lockoutMinutes };
  }
  localStorage.setItem(BF_FAIL_KEY, JSON.stringify(fails));
  return { locked: false, attemptsLeft: cfg.maxAttempts - fails.length };
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function fmtMinutes(ms) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return m + ' minute' + (m === 1 ? '' : 's');
  const h = Math.floor(m / 60); const r = m % 60;
  return h + 'h' + (r ? ' ' + r + 'm' : '');
}

// ---------- Edit-mode toggle ----------

export async function toggleEditMode() {
  if (state.editMode) { lock(); return; }

  // Lockout enforcement happens BEFORE we even fetch settings.
  const ls = getLockState();
  if (ls.locked) {
    toast(`Edit mode locked out — try again in ${fmtMinutes(ls.until - Date.now())}`, 'error', 6000);
    return;
  }

  const envelope = await loadEnvelope();
  if (!envelope) {
    const { openWizard } = await import('./bootstrap-wizard.js');
    const result = await openWizard();
    if (result?.ok) {
      applyUnlock(result.settings, result.password);
      clearBruteForceFailures();
    }
    return;
  }

  const password = await askPassword();
  if (password == null) return;
  if (!password) { toast('Password required', 'error'); return; }

  try {
    const settings = await decryptJson(envelope, password);
    applyUnlock(settings, password);
    clearBruteForceFailures();
    if (settings && settings.bruteForce) saveBruteForceConfig(settings.bruteForce);
  } catch (err) {
    const r = recordFailure();
    if (r.locked) {
      toast(`Wrong password. Locked out for ${r.lockoutMinutes} minutes.`, 'error', 8000);
    } else {
      toast(`${err.message}. ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left before lockout.`, 'error', 6000);
    }
  }
}

export function lock() {
  state.settings = null;
  state._adminPassword = null;
  state.editMode = false;
  if (timer) { clearTimeout(timer); timer = null; }
  emit('editmode:changed', false);
  toast('Edit mode locked', 'info');
}

function applyUnlock(settings, password) {
  state.settings = settings;
  state._adminPassword = password;
  state.githubRepo = settings.githubRepo || state.githubRepo;
  state.editMode = true;
  armTimer();
  emit('editmode:changed', true);
  toast('Edit mode unlocked', 'success');
}

function armTimer() {
  if (timer) clearTimeout(timer);
  const mins = state.settings?.editSessionMinutes ?? 30;
  timer = setTimeout(() => {
    lock();
    toast('Session expired', 'warn');
  }, mins * 60 * 1000);
}

async function loadEnvelope() {
  try {
    const res = await fetch('data/settings.enc.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || j.uninitialized || !j.v) return null;
    return j;
  } catch {
    return null;
  }
}

function askPassword() {
  return new Promise(resolve => {
    openModal((el, close) => {
      const cfg = getBruteForceConfig();
      let fails = [];
      try { fails = JSON.parse(localStorage.getItem(BF_FAIL_KEY) || '[]'); } catch {}
      // Recompute attempts-left from the same window the next failure will use.
      const cutoff = Date.now() - cfg.windowMinutes * 60 * 1000;
      const recent = fails.filter(t => t > cutoff).length;
      const attemptsLeft = Math.max(0, cfg.maxAttempts - recent);
      el.innerHTML = `
        <h3>Unlock edit mode</h3>
        <p style="font-size:12px;color:var(--text-3);margin-bottom:8px">Enter admin password to decrypt settings.</p>
        <div class="form-row">
          <input type="password" id="amPwd" class="search-input" style="width:100%" autocomplete="current-password">
        </div>
        <p style="font-size:11px;color:var(--text-3);margin-top:6px">
          Brute-force defence: ${cfg.maxAttempts} attempts in ${cfg.windowMinutes} min → lockout ${cfg.lockoutMinutes} min.
          ${recent > 0 ? `<strong style="color:var(--warn,#b45309)">${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.</strong>` : ''}
        </p>
        <div class="modal-footer">
          <button class="btn" data-act="cancel">Cancel</button>
          <button class="btn primary" data-act="ok">Unlock</button>
        </div>`;
      const f = el.querySelector('#amPwd');
      setTimeout(() => f.focus(), 0);
      const ok = () => { const v = f.value; close(); resolve(v); };
      el.querySelector('[data-act=ok]').addEventListener('click', ok);
      el.querySelector('[data-act=cancel]').addEventListener('click', () => { close(); resolve(null); });
      f.addEventListener('keydown', e => {
        if (e.key === 'Enter') ok();
        if (e.key === 'Escape') { close(); resolve(null); }
      });
    });
  });
}
