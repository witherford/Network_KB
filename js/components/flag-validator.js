// Validation for command-flag reports.
// Rules:
//  1. Description must be at least two sentences (≥2 segments separated
//     by . / ! / ?, each with ≥3 words).
//  2. Total length ≥30 characters of trimmed text.
//  3. Must not match any blocked term (case-insensitive substring + whole
//     phrase). Blocked-term list: built-in defaults plus admin-added terms
//     from settings (mirrored to localStorage for non-admin readers).

const BLOCKED_KEY  = 'nkb.flag.blocked';
const RATE_CFG_KEY = 'nkb.flag.rate.cfg';
const RATE_HIST_KEY = 'nkb.flag.rate.history';

const DEFAULT_RATE = Object.freeze({ enabled: true, maxPerHour: 10 });

// Built-in blocked phrases: the generic "not working / wont work / bad" list
// the user explicitly called out, plus a handful of common low-effort variants.
const DEFAULT_BLOCKED = [
  'not working', 'wont work', "won't work", 'doesn’t work',
  'doesnt work', "doesn't work", 'does not work',
  'no work', 'not work', 'never works', 'never worked',
  'bad command', 'bad cmd', 'broken', 'broke', 'broken command',
  'fails', 'failed', 'fail', 'failure',
  'no good', 'not good', 'rubbish', 'crap', 'useless',
  'wrong', 'incorrect', 'invalid', 'error', 'errors',
  'doesn’t function', 'doesnt function', 'does not function',
  'nope', 'nah', 'na'
];

/**
 * Returns the merged blocked-terms list:
 *   built-in defaults + any admin-added terms from localStorage.
 * Admin-side, the Settings page mirrors `s.flagBlockedTerms` to localStorage
 * whenever it changes so non-admin readers see the latest list immediately.
 */
export function getBlockedTerms() {
  let extra = [];
  try {
    const raw = localStorage.getItem(BLOCKED_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) extra = j;
    }
  } catch {}
  // Merge + dedupe + lowercase + trim.
  const set = new Set([...DEFAULT_BLOCKED, ...extra]
    .map(s => String(s).trim().toLowerCase())
    .filter(Boolean));
  return [...set];
}

/**
 * Persist admin-controlled extra blocked terms.
 * Pass an array of strings (one per line in the textarea).
 */
export function saveBlockedTerms(extras) {
  const arr = Array.isArray(extras) ? extras : [];
  const cleaned = arr.map(s => String(s).trim()).filter(Boolean);
  try { localStorage.setItem(BLOCKED_KEY, JSON.stringify(cleaned)); } catch {}
  return cleaned;
}

/**
 * Validate a flag-report description.
 *  Returns { ok: true } if accepted,
 *  or     { ok: false, reason: '<message>' } if rejected.
 */
export function validateFlagDescription(text) {
  const t = String(text || '').trim();
  if (t.length < 30) {
    return { ok: false, reason: 'Too short — please explain in at least two sentences (minimum 30 characters).' };
  }

  // Split on sentence terminators followed by whitespace OR end-of-string.
  // Allow `.`, `!`, `?` and consecutive ones (e.g. `??`, `!!`).
  // Treat the final terminator as optional — if the user ends mid-sentence
  // we still parse what they wrote.
  const segments = t.split(/[.!?]+(?:\s|$)/).map(s => s.trim()).filter(Boolean);
  if (segments.length < 2) {
    return { ok: false, reason: 'Please write at least two sentences. End each one with . ! or ? so the validator can detect the break.' };
  }
  for (const seg of segments) {
    const words = seg.split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      return { ok: false, reason: `Each sentence must contain at least three words. The sentence "${seg.slice(0, 60)}…" is too short.` };
    }
  }

  // Blocked-term check. Two passes:
  //   (a) Whole-phrase reject: the entire trimmed text equals a blocked term.
  //   (b) Predominantly-blocked reject: text length is within blocked-term
  //       length + 20 chars and contains the blocked phrase.
  const lower = t.toLowerCase();
  const blocked = getBlockedTerms();
  for (const term of blocked) {
    if (!term) continue;
    if (lower === term) {
      return { ok: false, reason: `"${term}" is too vague — please describe specifically what failed (the error message, the command output, the firmware version, what you expected vs what happened).` };
    }
    // If the blocked term takes up most of the description, also reject.
    if (lower.includes(term) && lower.length < term.length + 25) {
      return { ok: false, reason: `Your description mostly just says "${term}" — please describe specifically what failed (the error, the expected vs actual behaviour, the firmware version).` };
    }
  }

  return { ok: true };
}

export const DEFAULT_BLOCKED_TERMS = DEFAULT_BLOCKED;

/* ---------- Flag rate-limiting + master toggle ---------- */

export function getFlagRateConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(RATE_CFG_KEY));
    if (raw && typeof raw === 'object') {
      return {
        enabled:    raw.enabled !== false,
        maxPerHour: clamp(+raw.maxPerHour || DEFAULT_RATE.maxPerHour, 1, 50)
      };
    }
  } catch {}
  return { ...DEFAULT_RATE };
}

export function saveFlagRateConfig(cfg) {
  const safe = {
    enabled:    cfg.enabled !== false,
    maxPerHour: clamp(+cfg.maxPerHour || DEFAULT_RATE.maxPerHour, 1, 50)
  };
  try { localStorage.setItem(RATE_CFG_KEY, JSON.stringify(safe)); } catch {}
  return safe;
}

export function flaggingEnabled() {
  return getFlagRateConfig().enabled;
}

/**
 * Record an attempt to flag a command. Returns:
 *   { allowed: true,  remaining: N, resetInMs: t }
 *   { allowed: false, reason: '<text>', resetInMs: t }
 *
 * The caller is expected to invoke this AFTER the description has been
 * validated, but BEFORE writing the flag — so that a rejected description
 * doesn't burn a slot.
 */
export function recordFlagAttempt() {
  const cfg = getFlagRateConfig();
  if (!cfg.enabled) {
    return { allowed: false, reason: 'Command flagging is currently disabled by an admin.', remaining: 0, resetInMs: 0 };
  }
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000; // rolling 1-hour window
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(RATE_HIST_KEY) || '[]'); } catch {}
  hist = hist.filter(t => t > cutoff);
  if (hist.length >= cfg.maxPerHour) {
    const oldest = hist[0];
    const resetInMs = (oldest + 60 * 60 * 1000) - now;
    return {
      allowed: false,
      reason: `Flag-rate limit reached: ${cfg.maxPerHour} per hour. Try again in ${Math.ceil(resetInMs / 60000)} minute${Math.ceil(resetInMs / 60000) === 1 ? '' : 's'}.`,
      remaining: 0,
      resetInMs
    };
  }
  hist.push(now);
  try { localStorage.setItem(RATE_HIST_KEY, JSON.stringify(hist)); } catch {}
  return { allowed: true, remaining: cfg.maxPerHour - hist.length, resetInMs: 60 * 60 * 1000 };
}

export function getFlagRateHistory() {
  try {
    const hist = JSON.parse(localStorage.getItem(RATE_HIST_KEY) || '[]');
    const cutoff = Date.now() - 60 * 60 * 1000;
    return hist.filter(t => t > cutoff);
  } catch {
    return [];
  }
}

export function clearFlagRateHistory() {
  try { localStorage.removeItem(RATE_HIST_KEY); } catch {}
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/* ---------- Global flag count (cross-visitor) ----------
 *
 * Backed by abacus.jasoncameron.dev (the same free counter service used for
 * site visits). Two endpoints:
 *   GET https://abacus.jasoncameron.dev/hit/<ns>/<key>     → +1, returns {value}
 *   GET https://abacus.jasoncameron.dev/get/<ns>/<key>     → returns {value}
 *
 * The COUNT is global (visible to every visitor). The actual list of which
 * commands are flagged remains per-browser (localStorage) — abacus stores
 * only numeric counters, not arbitrary JSON, so we can't sync the full list
 * without a different backend. The user explicitly asked for the COUNT to be
 * global, which this satisfies.
 */

const ABACUS = 'https://abacus.jasoncameron.dev';
const FLAG_NS = 'nkb-witherford';
const FLAG_KEY = 'flags';

// Read the current global count without incrementing.
// If the key doesn't exist yet (404 — nobody has flagged anything), treat
// it as zero rather than null so the stats bar shows "0 globally flagged"
// instead of "— globally flagged".
export async function getGlobalFlagCount() {
  try {
    const res = await fetch(`${ABACUS}/get/${FLAG_NS}/${FLAG_KEY}`, { cache: 'no-store' });
    if (res.status === 404) return 0;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (typeof j.value === 'number') return j.value;
    if (typeof j.total === 'number') return j.total;
  } catch (e) {
    console.warn('[flag-counter] get failed:', e);
  }
  return null;
}

// Atomic +1.
export async function incrementGlobalFlagCount() {
  try {
    const res = await fetch(`${ABACUS}/hit/${FLAG_NS}/${FLAG_KEY}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (typeof j.value === 'number') return j.value;
    if (typeof j.total === 'number') return j.total;
  } catch (e) {
    console.warn('[flag-counter] increment failed:', e);
  }
  return null;
}
