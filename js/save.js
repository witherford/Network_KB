// Commit engine. Flushes pending state to the repo via a single atomic commit
// through the Git Data API.

import { state, clearPending, emit, hasPendingChanges } from './state.js';
import { commitBatch } from './api/github.js';
import { encryptJson } from './crypto.js';
import { toast } from './utils.js';

const DATA_PATHS = {
  commands:   'data/commands.json',
  quarantine: 'data/quarantine.json'
};

export function describePending() {
  const p = state.pending;
  const bits = [];
  for (const k of ['commands', 'quarantine']) {
    if (p[k]) bits.push(k);
  }
  const cs = Object.keys(p.cheatsheets || {});
  if (cs.length) bits.push(`cheatsheets(${cs.length})`);
  if (p.settings) bits.push('settings');
  return bits.join(', ');
}

export async function saveAll(message, { quiet = false } = {}) {
  if (!state.editMode || !state.settings) {
    throw new Error('Not in edit mode');
  }
  if (!hasPendingChanges() && !state.pending.settings) {
    toast('Nothing to save', 'info');
    return;
  }

  // If admin edited credentials in Settings, use the NEW PAT/repo for this
  // commit. Otherwise a PAT rotation makes Save fail with 401 on the old token.
  const creds = state.pending.settings || state.settings;
  const { githubPat, githubRepo, branch } = creds;
  const changes = [];
  const nowIso = new Date().toISOString();
  const manifest = { ...(state.data.manifest || {}) };

  for (const [key, path] of Object.entries(DATA_PATHS)) {
    if (state.pending[key]) {
      const obj = { ...state.pending[key], version: state.pending[key].version || 1, updatedAt: nowIso };
      changes.push({ path, content: JSON.stringify(obj, null, 2) + '\n' });
      manifest[key] = nowIso;
    }
  }

  if (state.pending.cheatsheets) {
    for (const [name, items] of Object.entries(state.pending.cheatsheets)) {
      changes.push({
        path: `data/cheatsheets/${name}.json`,
        content: JSON.stringify({ version: 1, items }, null, 2) + '\n'
      });
    }
    manifest.cheatsheets = nowIso;
  }

  if (state.pending.settings) {
    const newSettings = state.pending.settings;
    if (!state._adminPassword) throw new Error('Admin password missing (re-unlock)');
    const env = await encryptJson(newSettings, state._adminPassword);
    changes.push({
      path: 'data/settings.enc.json',
      content: JSON.stringify(env, null, 2) + '\n'
    });
  }

  if (changes.length === 0) { toast('Nothing to save', 'info'); return; }

  changes.push({ path: 'data/manifest.json', content: JSON.stringify(manifest, null, 2) + '\n' });

  const msg = message || buildDefaultMessage();
  const result = await commitBatch({
    pat: githubPat,
    repo: githubRepo,
    branch: branch || 'main',
    message: msg,
    changes
  });

  if (state.pending.settings) {
    state.settings = state.pending.settings;
  }
  // Seed in-memory data cache with what we just committed. Without this, the
  // next re-mount falls back to loadData() which returns the stale pre-save
  // cache (and in preview, the local file hasn't changed to match the commit).
  for (const key of Object.keys(DATA_PATHS)) {
    if (state.pending[key]) state.data[key] = state.pending[key];
  }
  if (state.pending.cheatsheets) {
    for (const [name, items] of Object.entries(state.pending.cheatsheets)) {
      state.data.cheatsheets[name] = { version: 1, items };
    }
  }
  state.data.manifest = manifest;
  clearPending();
  emit('saved', { commitSha: result.commitSha, message: msg });
  if (!quiet) toast('Saved — commit ' + result.commitSha.slice(0, 7), 'success', 4000);
  return result;
}

function buildDefaultMessage() {
  const parts = describePending();
  return parts ? `admin: update ${parts}` : 'admin: update data';
}
