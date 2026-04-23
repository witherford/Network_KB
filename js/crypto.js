// Password-based encryption for settings.enc.json.
// PBKDF2-SHA256 (600k iter) → AES-GCM-256. All primitives from window.crypto.subtle.

const ITER = 600_000;

function b64enc(ab) {
  const bytes = ab instanceof Uint8Array ? ab : new Uint8Array(ab);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64dec(s) {
  const bin = atob(String(s).replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, saltBytes, iter = ITER) {
  const keyMat = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: iter, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
  return {
    v: 1,
    kdf: { algo: 'PBKDF2-SHA256', iter: ITER, salt: b64enc(salt) },
    enc: { algo: 'AES-GCM', iv: b64enc(iv), ct: b64enc(ct) }
  };
}

export async function decryptJson(envelope, password) {
  if (!envelope || envelope.v !== 1 || !envelope.kdf || !envelope.enc) {
    throw new Error('Invalid settings envelope');
  }
  const salt = b64dec(envelope.kdf.salt);
  const iv = b64dec(envelope.enc.iv);
  const ct = b64dec(envelope.enc.ct);
  const key = await deriveKey(password, salt, envelope.kdf.iter || ITER);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    throw new Error('Wrong password or corrupt settings');
  }
  return JSON.parse(new TextDecoder().decode(pt));
}

export function strengthScore(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
