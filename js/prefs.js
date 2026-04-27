// Per-viewer preferences stored in localStorage. Never committed.

const KEY = 'nkb.prefs.v1';
const DEFAULTS = {
  theme: 'light',             // 'light' | 'dark'
  fontSize: 14,               // px
  accent: '#2563eb',
  descVisible: false,
  favourites: [],             // array of "platform|section|cmd"
  recent: [],                 // array of "platform|section|cmd"
  collapsed: [],              // array of "platform:section"
  clockZones: [
    'UTC',
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo'
  ]
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
}

export function getPrefs() { return load(); }

export function setPref(key, value) {
  const p = load();
  p[key] = value;
  persist();
  apply(p);
  return p;
}

export function apply(p = load()) {
  document.body.classList.toggle('theme-dark', p.theme === 'dark');
  document.documentElement.style.setProperty('--font-size', p.fontSize + 'px');
  document.documentElement.style.setProperty('--accent', p.accent);
}

export function toggleFavourite(key) {
  const p = load();
  const i = p.favourites.indexOf(key);
  if (i >= 0) p.favourites.splice(i, 1);
  else p.favourites.push(key);
  persist();
  return p.favourites;
}

export function isFavourite(key) {
  return load().favourites.includes(key);
}

export function pushRecent(key) {
  const p = load();
  const i = p.recent.indexOf(key);
  if (i >= 0) p.recent.splice(i, 1);
  p.recent.unshift(key);
  if (p.recent.length > 20) p.recent.length = 20;
  persist();
}

export function toggleCollapsed(key) {
  const p = load();
  const i = p.collapsed.indexOf(key);
  if (i >= 0) p.collapsed.splice(i, 1);
  else p.collapsed.push(key);
  persist();
}

export function isCollapsed(key) {
  return load().collapsed.includes(key);
}

/**
 * Bulk set collapse state for many section keys at once.
 *  collapseAll(['plat:Sec1', 'plat:Sec2', ...], true)  // collapse all
 *  collapseAll(['plat:Sec1', 'plat:Sec2', ...], false) // expand all
 */
export function collapseAll(keys, collapsed) {
  const p = load();
  if (collapsed) {
    const set = new Set([...p.collapsed, ...keys]);
    p.collapsed = [...set];
  } else {
    const drop = new Set(keys);
    p.collapsed = p.collapsed.filter(k => !drop.has(k));
  }
  persist();
}

export function cmdKey(platformKey, section, cmd) {
  return platformKey + '|' + section + '|' + cmd;
}
