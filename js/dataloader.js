// Cache-bust-aware data loader. Fetches manifest.json first (no-cache), then data
// files with ?v=<updatedAt> so admin changes propagate on reload.

import { state } from './state.js';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function loadManifest() {
  if (state.data.manifest) return state.data.manifest;
  try {
    const m = await fetchJson('data/manifest.json?t=' + Date.now(), { cache: 'no-store' });
    state.data.manifest = m;
    return m;
  } catch {
    state.data.manifest = {};
    return state.data.manifest;
  }
}

export async function loadData(kind) {
  if (state.data[kind]) return state.data[kind];
  const m = await loadManifest();
  const v = m[kind] ? encodeURIComponent(m[kind]) : Date.now();
  try {
    const d = await fetchJson(`data/${kind}.json?v=${v}`);
    state.data[kind] = d;
    return d;
  } catch (err) {
    // Return an empty shell if file doesn't exist yet (fresh repo).
    if (kind === 'commands') {
      state.data.commands = { version: 2, updatedAt: null, platforms: {} };
    } else {
      state.data[kind] = { version: 1, updatedAt: null, items: [] };
    }
    return state.data[kind];
  }
}

export async function loadCheatsheet(name) {
  if (state.data.cheatsheets[name]) return state.data.cheatsheets[name];
  try {
    const v = Date.now(); // cheatsheets are small, cache-bust lightly
    const d = await fetchJson(`data/cheatsheets/${name}.json?v=${v}`);
    state.data.cheatsheets[name] = d;
    return d;
  } catch {
    state.data.cheatsheets[name] = { items: [] };
    return state.data.cheatsheets[name];
  }
}
