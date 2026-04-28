// Site visit counter (third-party, free, no-login).
// Backend: https://abacus.jasoncameron.dev — GET /hit/<ns>/<key> atomically
// increments and returns { value, total }; /get/<ns>/<key> reads without
// incrementing. CORS friendly, no API key.
//
// Granularity: one increment per browser session (sessionStorage-gated). PWA
// auto-update reloads, tab switches and refreshes within the same session
// re-render the pill but DO NOT bump the count. Close the browser and come
// back = +1.
//
// Note: abacus has no reset endpoint for anonymous users — to "reset" you'd
// switch the namespace/key string in NS / KEY below.

const NS  = 'nkb-witherford';
const KEY = 'visits';
const SS_FLAG = 'nkb.visit.bumped';
const ENDPOINT = 'https://abacus.jasoncameron.dev';

export async function mountVisitsCounter() {
  const el = document.getElementById('visitsPill');
  if (!el) return;
  let count = null;
  try {
    const bumped = sessionStorage.getItem(SS_FLAG) === '1';
    const url = bumped
      ? `${ENDPOINT}/get/${NS}/${KEY}`
      : `${ENDPOINT}/hit/${NS}/${KEY}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    // abacus returns either { value: N } or { value: N, total: N } depending
    // on the endpoint — both fields hold the same integer. Prefer .value.
    count = (typeof j.value === 'number') ? j.value : (typeof j.total === 'number' ? j.total : null);
    if (!bumped) {
      try { sessionStorage.setItem(SS_FLAG, '1'); } catch {}
    }
  } catch (err) {
    // Provider unavailable, network blocked, or AdBlock: silently fail —
    // we don't want a counter outage to mask the actual app.
    console.warn('[visits] counter unavailable:', err);
    return;
  }
  if (count == null) return;
  el.hidden = false;
  el.textContent = `Visits: ${count.toLocaleString()}`;
}
