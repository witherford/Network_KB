// VLSM optimiser. Given a supernet and a list of host counts, produce
// optimally-sized child subnets ordered largest-first to minimise waste.

import { copyToClipboard, toast } from '../utils.js';
import { toCSV } from '../components/io.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">VLSM optimiser</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      <div class="form-row">
        <label>Supernet (CIDR)</label>
        <input type="text" id="vSuper" value="10.0.0.0/16" placeholder="e.g. 10.0.0.0/16">
      </div>
      <div class="form-row">
        <label>Order children by</label>
        <select id="vOrder">
          <option value="hosts-desc" selected>Largest hosts first (most efficient)</option>
          <option value="hosts-asc">Smallest hosts first</option>
          <option value="input">Input order (may waste space)</option>
        </select>
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>Required host counts (comma-separated, with optional names)</label>
        <textarea id="vNeeds" rows="3" placeholder="WAREHOUSE: 200, OFFICE: 50, DMZ: 25, MGMT: 10, P2P: 2"></textarea>
        <div class="hint">Names are optional — plain numbers work too. Each entry rounds up to the smallest /N that fits hosts + 2 (network + broadcast).</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="vGo">Calculate</button>
      <button class="btn" id="vCsv">Export CSV</button>
      <button class="btn" id="vCopy">Copy table as CSV</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="vSummary"></span>
    </div>
    <div id="vOut"></div>`;

  const $ = s => root.querySelector(s);

  let lastRows = [];

  function calc() {
    const sup = $('#vSuper').value.trim();
    const needs = parseNeeds($('#vNeeds').value);
    let parsed;
    try { parsed = parseCidr(sup); }
    catch (e) { $('#vOut').innerHTML = `<div class="page-empty" style="color:var(--danger)">Bad supernet: ${e.message}</div>`; lastRows = []; return; }
    if (parsed.v6) { $('#vOut').innerHTML = '<div class="page-empty">IPv6 supernet not supported in VLSM optimiser yet.</div>'; lastRows = []; return; }
    if (!needs.length) { $('#vOut').innerHTML = '<div class="page-empty">Add some host counts.</div>'; lastRows = []; return; }

    // Sort according to user choice.
    const ord = $('#vOrder').value;
    const sorted = needs.slice();
    if (ord === 'hosts-desc') sorted.sort((a, b) => b.hosts - a.hosts);
    else if (ord === 'hosts-asc') sorted.sort((a, b) => a.hosts - b.hosts);

    const supBase = ipToInt(parsed.addr);
    const supEnd  = supBase + (1 << (32 - parsed.prefix)) - 1;
    let cursor = supBase;
    const rows = [];
    let totalAddrs = 0;
    for (const n of sorted) {
      // Smallest /N that holds n hosts (need n + 2 addresses)
      const need = n.hosts + 2;
      let bits = 1;
      while ((1 << bits) < need && bits < 32) bits++;
      const childPrefix = 32 - bits;
      const blockSize = 1 << bits;
      // Align cursor up to blockSize boundary.
      const aligned = (Math.floor((cursor + blockSize - 1) / blockSize)) * blockSize;
      if (aligned + blockSize - 1 > supEnd) {
        rows.push({ name: n.name, hosts: n.hosts, error: 'Out of space in supernet' });
        continue;
      }
      const network = aligned;
      const broadcast = aligned + blockSize - 1;
      cursor = broadcast + 1;
      totalAddrs += blockSize;
      rows.push({
        name: n.name || '—',
        requested: n.hosts,
        prefix: '/' + childPrefix,
        mask: prefixToMask(childPrefix),
        wildcard: prefixToWildcard(childPrefix),
        network: intToIp(network),
        firstHost: blockSize > 2 ? intToIp(network + 1) : '—',
        lastHost: blockSize > 2 ? intToIp(broadcast - 1) : '—',
        broadcast: intToIp(broadcast),
        usable: Math.max(0, blockSize - 2),
        size: blockSize
      });
    }
    lastRows = rows;
    $('#vSummary').textContent = `${rows.length} subnet${rows.length===1?'':'s'} · ${totalAddrs.toLocaleString()} addresses · ${(supEnd - supBase + 1).toLocaleString()} available`;
    $('#vOut').innerHTML = renderTable(rows);
  }

  $('#vGo').addEventListener('click', calc);
  $('#vSuper').addEventListener('input', calc);
  $('#vNeeds').addEventListener('input', calc);
  $('#vOrder').addEventListener('change', calc);
  $('#vCsv').addEventListener('click', () => {
    if (!lastRows.length) { toast('Nothing to export', 'error'); return; }
    const csv = toCSV(lastRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vlsm.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#vCopy').addEventListener('click', async () => {
    if (!lastRows.length) { toast('Nothing to copy', 'error'); return; }
    const ok = await copyToClipboard(toCSV(lastRows));
    toast(ok ? 'Copied as CSV' : 'Copy failed', ok ? 'success' : 'error');
  });

  calc();
}

function parseNeeds(text) {
  return String(text || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(item => {
    const m = /^(?:(.+?)\s*[:=]\s*)?(\d+)\s*(?:hosts?)?$/i.exec(item);
    if (!m) return null;
    return { name: (m[1] || '').trim(), hosts: parseInt(m[2], 10) };
  }).filter(Boolean);
}

function parseCidr(c) {
  const [addr, p] = String(c).split('/');
  const prefix = parseInt(p, 10);
  const v6 = addr.includes(':');
  if (!v6) {
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4 || parts.some(x => isNaN(x) || x < 0 || x > 255)) throw new Error('bad IPv4');
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) throw new Error('bad prefix');
  }
  return { addr, prefix, v6 };
}

function ipToInt(ip) { const p = ip.split('.').map(Number); return ((p[0]<<24)|(p[1]<<16)|(p[2]<<8)|p[3]) >>> 0; }
function intToIp(n)  { return [(n>>>24)&0xFF,(n>>>16)&0xFF,(n>>>8)&0xFF, n&0xFF].join('.'); }
function prefixToMask(p) {
  const m = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
  return intToIp(m);
}
function prefixToWildcard(p) {
  const m = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
  return intToIp((~m) >>> 0);
}

function renderTable(rows) {
  return `<table class="lc-table" style="margin-top:8px">
    <thead><tr>
      <th>Name</th><th>Requested hosts</th><th>Prefix</th><th>Network</th><th>Range</th><th>Broadcast</th><th>Usable</th><th>Mask</th><th>Wildcard</th><th>Size</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => r.error
        ? `<tr><td>${esc(r.name)}</td><td>${r.hosts}</td><td colspan="8" style="color:var(--warn,#b91c1c)">${esc(r.error)}</td></tr>`
        : `<tr>
            <td>${esc(r.name)}</td>
            <td>${r.requested}</td>
            <td><code>${r.prefix}</code></td>
            <td><code>${r.network}</code></td>
            <td>${r.firstHost} – ${r.lastHost}</td>
            <td>${r.broadcast}</td>
            <td>${r.usable.toLocaleString()}</td>
            <td><code>${r.mask}</code></td>
            <td><code>${r.wildcard}</code></td>
            <td>${r.size}</td>
          </tr>`).join('')}
    </tbody>
  </table>`;
}
function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
