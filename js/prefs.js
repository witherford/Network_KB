// Per-viewer preferences stored in localStorage. Never committed.

const KEY = 'nkb.prefs.v1';
const DEFAULTS = {
  theme: 'light',             // 'light' | 'dark'
  fontSize: 14,               // px
  accent: '#2563eb',
  // Legacy pref: now repurposed — when true, command text is shown alongside
  // its description. Default flipped to false (descriptions only) per v1.3.0.
  cmdVisible: false,
  // Kept for backward compatibility with old localStorage records that may
  // still hold this; nothing reads it any more.
  descVisible: true,
  favourites: [],             // array of "platform|section|cmd"
  recent: [],                 // array of "platform|section|cmd"
  collapsed: [],              // array of "platform:section"
  cveCollapsed: [],           // array of CVE vendor names that are collapsed
  sectionCommands: {},        // section-key → bool override (undefined = inherit page-level cmdVisible)
  sectionTypes: {},           // section-key → { show, config, troubleshooting } (default: all true)
  flags: {},                  // map of "platform|section|cmd" → { reason, ts }
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

/* ---------- Per-section "Show commands" toggle ----------
 * tri-state: undefined = inherit page-level, true = force show, false = force hide.
 */
export function getSectionCommands(sectionKey) {
  const p = load();
  return (p.sectionCommands && Object.prototype.hasOwnProperty.call(p.sectionCommands, sectionKey))
    ? p.sectionCommands[sectionKey]
    : undefined;
}
export function setSectionCommands(sectionKey, val) {
  const p = load();
  p.sectionCommands ||= {};
  if (val === undefined || val === null) delete p.sectionCommands[sectionKey];
  else p.sectionCommands[sectionKey] = !!val;
  persist();
}

/* ---------- Per-section type filters ---------- */
const DEFAULT_TYPES = { show: true, config: true, troubleshooting: true };
export function getSectionTypes(sectionKey) {
  const p = load();
  return p.sectionTypes && p.sectionTypes[sectionKey]
    ? { ...DEFAULT_TYPES, ...p.sectionTypes[sectionKey] }
    : { ...DEFAULT_TYPES };
}
export function setSectionType(sectionKey, type, val) {
  const p = load();
  p.sectionTypes ||= {};
  p.sectionTypes[sectionKey] ||= { ...DEFAULT_TYPES };
  p.sectionTypes[sectionKey][type] = !!val;
  persist();
}

/* ---------- CVE vendor-section collapse ---------- */
export function isCveVendorCollapsed(vendor) {
  return load().cveCollapsed.includes(vendor);
}
export function toggleCveVendorCollapsed(vendor) {
  const p = load();
  p.cveCollapsed ||= [];
  const i = p.cveCollapsed.indexOf(vendor);
  if (i >= 0) p.cveCollapsed.splice(i, 1);
  else p.cveCollapsed.push(vendor);
  persist();
}
export function setCveVendorsCollapsed(vendors, collapsed) {
  const p = load();
  if (collapsed) {
    const set = new Set([...(p.cveCollapsed || []), ...vendors]);
    p.cveCollapsed = [...set];
  } else {
    const drop = new Set(vendors);
    p.cveCollapsed = (p.cveCollapsed || []).filter(v => !drop.has(v));
  }
  persist();
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

/* ---------- Flag / Quarantine ---------- */

export function setFlag(key, reason) {
  const p = load();
  p.flags ||= {};
  p.flags[key] = { reason: String(reason || ''), ts: Date.now() };
  persist();
  return p.flags[key];
}

export function unsetFlag(key) {
  const p = load();
  if (!p.flags) return;
  delete p.flags[key];
  persist();
}

export function isFlagged(key) {
  const p = load();
  return !!(p.flags && p.flags[key]);
}

export function getFlag(key) {
  const p = load();
  return p.flags ? p.flags[key] : undefined;
}

export function getAllFlags() {
  const p = load();
  return p.flags || {};
}
