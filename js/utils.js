// Small utilities shared across modules.

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function hlText(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp('(' + q + ')', 'gi'), '<span class="hl">$1</span>');
}

export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function download(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function toast(msg, kind = 'info', ms = 3000) {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, ms);
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString();
}

export function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function uid(prefix = 'id') {
  return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Expand a CIDR (or a list of mixed lines that may contain hostnames /
 * single IPs / CIDRs) into a flat array of host IPs. Hostnames and single
 * IPs pass through. CIDRs larger than `cap` are returned as a one-element
 * "# Range too large" placeholder so callers can detect and warn.
 *
 *   expandCidr(['10.0.0.0/29']) → ['10.0.0.1' .. '10.0.0.6']
 *   expandCidr(['10.0.0.0/29'], { includeNet: true }) → all 8 addresses
 */
export function expandCidr(lines, { includeNet = false, cap = 8192 } = {}) {
  const arr = Array.isArray(lines) ? lines : String(lines).split(/\r?\n/);
  const out = [];
  for (const raw of arr) {
    const line = String(raw).trim();
    if (!line) continue;
    if (!/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(line)) { out.push(line); continue; }
    const [addr, pStr] = line.split('/');
    const prefix = parseInt(pStr, 10);
    if (prefix < 0 || prefix > 32) { out.push(line); continue; }
    const hostBits = 32 - prefix;
    const size = 1 << hostBits;
    if (size > cap) { out.push('# Range too large: ' + line); continue; }
    const parts = addr.split('.').map(Number);
    const base = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    const network = (base & ((0xFFFFFFFF << hostBits) >>> 0)) >>> 0;
    for (let i = 0; i < size; i++) {
      if (!includeNet && hostBits >= 2 && (i === 0 || i === size - 1)) continue;
      const n = (network + i) >>> 0;
      out.push([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF].join('.'));
    }
  }
  return out;
}

/**
 * IPv4 → in-addr.arpa name (for reverse DNS / PTR lookups).
 *   ipToArpa('192.0.2.1') → '1.2.0.192.in-addr.arpa'
 */
export function ipToArpa(ip) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(String(ip).trim());
  if (!m) return null;
  return `${m[4]}.${m[3]}.${m[2]}.${m[1]}.in-addr.arpa`;
}
