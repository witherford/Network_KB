// Edit mode: load settings.enc.json, prompt for password, decrypt, activate
// edit UI across pages. Password + decrypted settings live in memory only.

import { state, emit } from '../state.js';
import { toast } from '../utils.js';
import { openModal } from '../components/modal.js';
import { decryptJson } from '../crypto.js';

let timer = null;

export async function toggleEditMode() {
  if (state.editMode) { lock(); return; }

  const envelope = await loadEnvelope();
  if (!envelope) {
    const { openWizard } = await import('./bootstrap-wizard.js');
    const result = await openWizard();
    if (result?.ok) {
      applyUnlock(result.settings, result.password);
    }
    return;
  }

  const password = await askPassword();
  if (password == null) return;
  if (!password) { toast('Password required', 'error'); return; }

  try {
    const settings = await decryptJson(envelope, password);
    applyUnlock(settings, password);
  } catch (err) {
    toast(err.message, 'error');
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
      el.innerHTML = `
        <h3>Unlock edit mode</h3>
        <p style="font-size:12px;color:var(--text-3);margin-bottom:8px">Enter admin password to decrypt settings.</p>
        <div class="form-row">
          <input type="password" id="amPwd" class="search-input" style="width:100%" autocomplete="current-password">
        </div>
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
