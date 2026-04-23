// Rotating AI-key pool. Round-robins across enabled providers and places a
// failing key into exponential cooldown on 429/5xx/auth errors.

let pool = [];
let cursor = 0;
const cooldown = new Map(); // id → timestamp when it becomes available again
const failures = new Map(); // id → consecutive failure count

const BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 30 * 60_000;

export function loadPool(providers) {
  pool = (providers || []).filter(p => p.enabled !== false && p.key);
  cursor = 0;
  cooldown.clear();
  failures.clear();
}

export function size() { return pool.length; }

export function getNext() {
  if (!pool.length) return null;
  const now = Date.now();
  for (let i = 0; i < pool.length; i++) {
    const idx = (cursor + i) % pool.length;
    const p = pool[idx];
    const until = cooldown.get(p.id) || 0;
    if (until <= now) {
      cursor = (idx + 1) % pool.length;
      return p;
    }
  }
  return null;
}

export function markFailed(id) {
  const f = (failures.get(id) || 0) + 1;
  failures.set(id, f);
  const delay = Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * Math.pow(2, f - 1));
  cooldown.set(id, Date.now() + delay);
}

export function markSuccess(id) {
  failures.delete(id);
  cooldown.delete(id);
}

export function status() {
  const now = Date.now();
  return pool.map(p => ({
    id: p.id,
    provider: p.provider,
    model: p.model,
    cooldownRemaining: Math.max(0, (cooldown.get(p.id) || 0) - now),
    failures: failures.get(p.id) || 0
  }));
}
