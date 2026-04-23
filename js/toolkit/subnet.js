// Subnet calculator: analyse a CIDR or split a supernet into /N children.
// BigInt-based so it handles IPv4 and IPv6. Exports CSV.

import { esc, download, copyToClipboard, toast } from '../utils.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Subnet calculator</h2>
    <div class="form-row">
      <label>CIDR</label>
      <input type="text" id="snCidr" placeholder="e.g. 192.168.0.0/24 or 2001:db8::/48" value="192.168.0.0/24">
      <div class="hint">Enter any IPv4 or IPv6 CIDR.</div>
    </div>
    <div class="form-row">
      <label>Split into /N subnets (optional)</label>
      <input type="number" id="snSplit" placeholder="e.g. 30 for /30" min="1" max="128">
      <div class="hint">Leave blank to just analyse the one CIDR.</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn primary" id="snGo">Calculate</button>
      <button class="btn" id="snCsv">Export CSV</button>
      <button class="btn" id="snCopy">Copy table</button>
    </div>
    <div id="snSummary" style="margin-bottom:14px"></div>
    <div id="snTable"></div>`;

  root.querySelector('#snGo').addEventListener('click', run);
  root.querySelector('#snCsv').addEventListener('click', () => exportCsv(run()));
  root.querySelector('#snCopy').addEventListener('click', () => copyTable(run()));
  root.querySelector('#snCidr').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  run();
}

function parseCidr(cidr) {
  const [addr, prefixStr] = String(cidr).trim().split('/');
  const prefix = parseInt(prefixStr, 10);
  if (!addr || isNaN(prefix)) throw new Error('Invalid CIDR');
  const v6 = addr.includes(':');
  const totalBits = v6 ? 128 : 32;
  if (prefix < 0 || prefix > totalBits) throw new Error('Prefix out of range');
  const ip = v6 ? ipv6ToBigInt(addr) : ipv4ToBigInt(addr);
  return { ip, prefix, totalBits, v6 };
}

function ipv4ToBigInt(s) {
  const parts = s.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) throw new Error('Invalid IPv4');
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}
function bigIntToIpv4(n) {
  return [(n >> 24n) & 0xffn, (n >> 16n) & 0xffn, (n >> 8n) & 0xffn, n & 0xffn].join('.');
}
function ipv6ToBigInt(s) {
  // expand :: and parse
  let [head, tail] = s.split('::');
  const hp = head ? head.split(':') : [];
  const tp = tail ? tail.split(':') : [];
  const missing = 8 - hp.length - tp.length;
  if (missing < 0) throw new Error('Invalid IPv6');
  const full = [...hp, ...Array(missing).fill('0'), ...tp];
  if (full.length !== 8) throw new Error('Invalid IPv6');
  let n = 0n;
  for (const h of full) {
    const v = parseInt(h || '0', 16);
    if (isNaN(v) || v < 0 || v > 0xffff) throw new Error('Invalid IPv6 hextet');
    n = (n << 16n) | BigInt(v);
  }
  return n;
}
function bigIntToIpv6(n) {
  const parts = [];
  for (let i = 7n; i >= 0n; i--) parts.push(((n >> (i * 16n)) & 0xffffn).toString(16));
  // shortest-run-of-zeros compression
  const full = parts.join(':');
  return full.replace(/(^|:)(0(:0)*)(:|$)/, (m, a, _b, _c, d) => {
    // prefer longest
    return a + ':' + d;
  }).replace(/:{3,}/, '::');
}
function toIp(n, v6) { return v6 ? bigIntToIpv6(n) : bigIntToIpv4(n); }

function analyse(cidrStr) {
  const { ip, prefix, totalBits, v6 } = parseCidr(cidrStr);
  const hostBits = BigInt(totalBits - prefix);
  const size = 1n << hostBits;
  const mask = ((1n << BigInt(prefix)) - 1n) << hostBits;
  const network = ip & mask;
  const broadcast = network + size - 1n;
  const usable = v6
    ? { first: network, last: broadcast, count: size }
    : (hostBits >= 2n
        ? { first: network + 1n, last: broadcast - 1n, count: size - 2n }
        : { first: network, last: broadcast, count: size });
  return { v6, prefix, totalBits, network, broadcast, size, usable };
}

function run() {
  const cidr = document.getElementById('snCidr').value.trim();
  const splitN = parseInt(document.getElementById('snSplit').value, 10);
  const summaryEl = document.getElementById('snSummary');
  const tableEl = document.getElementById('snTable');

  let base;
  try { base = analyse(cidr); }
  catch (err) {
    summaryEl.innerHTML = `<div class="page-empty" style="color:var(--danger)">Error: ${esc(err.message)}</div>`;
    tableEl.innerHTML = '';
    return null;
  }

  summaryEl.innerHTML = renderSummary(base, cidr);

  if (!splitN || isNaN(splitN)) {
    tableEl.innerHTML = '';
    return { rows: [summaryRow(cidr, base)], v6: base.v6 };
  }
  if (splitN <= base.prefix || splitN > base.totalBits) {
    tableEl.innerHTML = `<div class="page-empty" style="color:var(--danger)">Split prefix must be larger than /${base.prefix} and &le; /${base.totalBits}</div>`;
    return null;
  }
  const childBits = BigInt(base.totalBits - splitN);
  const childSize = 1n << childBits;
  const count = base.size / childSize;
  if (count > 10000n) {
    tableEl.innerHTML = `<div class="page-empty" style="color:var(--warn)">That split produces ${count.toString()} subnets — too many to render. Try a smaller split.</div>`;
    return null;
  }

  const rows = [];
  for (let i = 0n; i < count; i++) {
    const netAddr = base.network + i * childSize;
    const child = analyse(toIp(netAddr, base.v6) + '/' + splitN);
    rows.push(summaryRow(toIp(netAddr, base.v6) + '/' + splitN, child));
  }

  tableEl.innerHTML = `
    <table class="tbl">
      <thead><tr>
        <th>Subnet</th><th>Network</th><th>Broadcast / last</th>
        <th>First usable</th><th>Last usable</th><th>Hosts</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td class="mono">${esc(r.subnet)}</td>
          <td class="mono">${esc(r.network)}</td>
          <td class="mono">${esc(r.broadcast)}</td>
          <td class="mono">${esc(r.firstUsable)}</td>
          <td class="mono">${esc(r.lastUsable)}</td>
          <td>${esc(r.hosts)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  return { rows, v6: base.v6 };
}

function summaryRow(subnet, a) {
  return {
    subnet,
    network: toIp(a.network, a.v6),
    broadcast: toIp(a.broadcast, a.v6),
    firstUsable: toIp(a.usable.first, a.v6),
    lastUsable: toIp(a.usable.last, a.v6),
    hosts: a.usable.count.toString()
  };
}

function renderSummary(a, cidr) {
  return `<div style="background:var(--card-2);border:1px solid var(--border);border-radius:8px;padding:12px">
    <div style="font-weight:600;margin-bottom:8px">${esc(cidr)} — ${a.v6 ? 'IPv6' : 'IPv4'}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;font-size:12.5px">
      <div><span style="color:var(--text-3)">Network:</span> <span class="mono">${esc(toIp(a.network, a.v6))}</span></div>
      <div><span style="color:var(--text-3)">${a.v6 ? 'Last address' : 'Broadcast'}:</span> <span class="mono">${esc(toIp(a.broadcast, a.v6))}</span></div>
      <div><span style="color:var(--text-3)">First usable:</span> <span class="mono">${esc(toIp(a.usable.first, a.v6))}</span></div>
      <div><span style="color:var(--text-3)">Last usable:</span> <span class="mono">${esc(toIp(a.usable.last, a.v6))}</span></div>
      <div><span style="color:var(--text-3)">Total addresses:</span> ${esc(a.size.toString())}</div>
      <div><span style="color:var(--text-3)">Usable hosts:</span> ${esc(a.usable.count.toString())}</div>
    </div>
  </div>`;
}

function rowsToCsv(rows) {
  const header = ['subnet', 'network', 'broadcast', 'first_usable', 'last_usable', 'hosts'];
  const esc = s => /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  const body = rows.map(r => [r.subnet, r.network, r.broadcast, r.firstUsable, r.lastUsable, r.hosts].map(esc).join(',')).join('\n');
  return header.join(',') + '\n' + body + '\n';
}

function exportCsv(result) {
  if (!result || !result.rows.length) return;
  download('subnets-' + new Date().toISOString().slice(0, 10) + '.csv', rowsToCsv(result.rows), 'text/csv');
}

function copyTable(result) {
  if (!result || !result.rows.length) return;
  copyToClipboard(rowsToCsv(result.rows)).then(ok => toast(ok ? 'Copied CSV to clipboard' : 'Copy failed', ok ? 'success' : 'error'));
}
