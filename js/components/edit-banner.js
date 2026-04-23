// Floating banner that appears whenever edit mode is on, showing a summary of
// pending changes plus Save / Discard / Lock buttons. Mounted once from app.js.

import { state, on, hasPendingChanges, clearPending } from '../state.js';
import { saveAll, describePending } from '../save.js';
import { toast } from '../utils.js';
import { confirmModal, promptModal } from './modal.js';

let el = null;

export function mountBanner() {
  if (el) return el;
  el = document.createElement('div');
  el.className = 'edit-banner';
  el.style.display = 'none';
  document.body.appendChild(el);

  on('editmode:changed', render);
  on('pending:changed', render);
  on('pending:cleared', render);
  on('saved', render);
  render();
  return el;
}

function render() {
  if (!el) return;
  if (!state.editMode) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const pending = hasPendingChanges() || !!state.pending.settings;
  const summary = describePending() || 'no pending changes';
  el.style.display = '';
  el.innerHTML = `
    <div class="eb-label">
      <span class="eb-dot" style="background:${pending ? 'var(--warn)' : 'var(--success)'}"></span>
      Edit mode — <span style="color:var(--text-3)">${summary}</span>
    </div>
    <div class="eb-actions">
      <button class="btn" data-act="discard" ${pending ? '' : 'disabled'}>Discard</button>
      <button class="btn primary" data-act="save" ${pending ? '' : 'disabled'}>Save</button>
      <button class="btn" data-act="lock">Lock</button>
    </div>`;
  el.querySelector('[data-act=save]').addEventListener('click', onSave);
  el.querySelector('[data-act=discard]').addEventListener('click', onDiscard);
  el.querySelector('[data-act=lock]').addEventListener('click', onLock);
}

async function onSave() {
  const message = await promptModal('Commit message (optional)', {
    placeholder: 'admin: describe your changes',
    initial: ''
  });
  if (message === null) return;
  try {
    await saveAll(message || undefined);
    window.dispatchEvent(new CustomEvent('nkb:reload'));
  } catch (err) {
    toast(err.message, 'error', 6000);
  }
}

async function onDiscard() {
  const ok = await confirmModal(
    'Discard all pending changes? This cannot be undone.',
    { danger: true, okLabel: 'Discard' }
  );
  if (!ok) return;
  clearPending();
  state.pending.settings = null;
  window.dispatchEvent(new CustomEvent('nkb:reload'));
  toast('Pending changes discarded', 'info');
}

async function onLock() {
  const { lock } = await import('../auth/edit-mode.js');
  if (hasPendingChanges() || state.pending.settings) {
    const ok = await confirmModal(
      'You have unsaved changes. Locking will discard them.',
      { danger: true, okLabel: 'Discard and lock' }
    );
    if (!ok) return;
    clearPending();
    state.pending.settings = null;
  }
  lock();
}
