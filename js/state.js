// Central app state + tiny pub/sub bus.
// Pages import { state, on, emit } and react via events.

export const state = {
  currentPage: null,
  editMode: false,
  settings: null,       // decrypted settings object (in-memory, only when unlocked)
  githubRepo: null,     // "owner/repo" detected or configured

  // Loaded data (lazy-populated per page)
  data: {
    commands: null,
    software: null,
    guides: null,
    cves: null,
    manifest: null,
    cheatsheets: {}
  },

  // Pending edits, keyed by data file — flushed on Save
  pending: {
    commands: null,
    software: null,
    guides: null,
    cves: null,
    cheatsheets: {}
  },

  // UI-only state for the commands page
  ui: {
    activePlatformTab: 'all',
    activeTypeTab: 'all',
    searchQuery: '',
    selected: new Set()
  }
};

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const h of set) {
    try { h(payload); } catch (err) { console.error('listener error', event, err); }
  }
}

export function hasPendingChanges() {
  const p = state.pending;
  if (p.commands || p.software || p.guides || p.cves) return true;
  if (p.cheatsheets && Object.keys(p.cheatsheets).length) return true;
  return false;
}

export function clearPending() {
  state.pending = { commands: null, software: null, guides: null, cves: null, cheatsheets: {} };
  emit('pending:cleared');
}
