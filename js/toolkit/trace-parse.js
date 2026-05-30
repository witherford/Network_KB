// Traceroute parser — paste raw `tracert` (Windows) or `traceroute`
// (Linux / macOS) output and get a tidy per-hop table with RTTs, exportable
// as CSV. Sibling of the ping paste→CSV converter in ping-script.js, but for
// the path-discovery workflow rather than reachability.

import { esc, copyToClipboard, toast } from '../utils.js';
import { toCSV, download } from '../components/io.js';

const TRACE_COLS = ['Hop', 'Host', 'IP', 'RTT 1 (ms)', 'RTT 2 (ms)', 'RTT 3 (ms)', 'Status'];

const SAMPLE = `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets
 1  router.lan (192.168.1.1)  1.204 ms  1.118 ms  1.052 ms
 2  10.0.0.1 (10.0.0.1)  8.512 ms  8.221 ms  9.004 ms
 3  * * *
 4  core1.isp.net (203.0.113.9)  12.0 ms  11.5 ms  12.2 ms`;

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Traceroute parser</h2>
    <p class="hint" style="margin-bottom:10px">Paste raw <code>tracert</code> (Windows) or <code>traceroute</code> (Linux / macOS) output. Each hop becomes a row with its resolved host, IP and per-probe round-trip times.</p>
    <div class="form-row">
      <label>Traceroute output</label>
      <textarea id="trIn" placeholder="Paste tracert / traceroute output here…" style="min-height:150px"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="trGo">Parse</button>
      <button class="btn" id="trCsv">Export CSV</button>
      <button class="btn" id="trCopy">Copy as CSV</button>
      <button class="btn ghost" id="trSample">Load sample</button>
      <button class="btn ghost" id="trClear">Clear</button>
    </div>
    <div id="trOut"></div>`;

  const $ = sel => root.querySelector(sel);

  function rows() { return parseTraceroute($('#trIn').value); }

  function render() {
    const r = rows();
    $('#trOut').innerHTML = renderTable(r);
  }

  $('#trGo').addEventListener('click', render);
  $('#trIn').addEventListener('input', render);
  $('#trSample').addEventListener('click', () => { $('#trIn').value = SAMPLE; render(); });
  $('#trClear').addEventListener('click', () => { $('#trIn').value = ''; render(); });
  $('#trCsv').addEventListener('click', () => {
    const r = rows();
    if (!r.length) { toast('Nothing to export', 'error'); return; }
    download('traceroute.csv', toCSV(r, TRACE_COLS), 'text/csv');
  });
  $('#trCopy').addEventListener('click', async () => {
    const r = rows();
    if (!r.length) { toast('Nothing to copy', 'error'); return; }
    const ok = await copyToClipboard(toCSV(r, TRACE_COLS));
    toast(ok ? 'CSV copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
  });

  render();
}

function renderTable(rows) {
  if (!rows.length) return '<div class="page-empty">No hops parsed yet.</div>';
  return `<table class="tbl" style="margin-top:6px">
    <thead><tr>${TRACE_COLS.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        ${TRACE_COLS.map(c => {
          const v = r[c] ?? '';
          const mono = (c === 'IP' || c === 'Hop' || c.startsWith('RTT'));
          return `<td class="${mono ? 'mono' : ''}">${esc(String(v))}</td>`;
        }).join('')}
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// Parse both Windows tracert and *nix traceroute. Returns array keyed by
// TRACE_COLS. Handles timeout hops (`* * *` / "Request timed out") and the
// `host [ip]` (Windows) / `host (ip)` (*nix) host-IP forms.
export function parseTraceroute(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    const m = line.match(/^\s*(\d{1,3})\s+(.*)$/);
    if (!m) continue;                          // skip headers / blank lines
    const hop = m[1];
    const rest = m[2].trim();

    // Round-trip times: "<1 ms", "9 ms", "1.204 ms".
    const rtts = [];
    for (const t of rest.matchAll(/(<?\s*\d+(?:\.\d+)?)\s*ms/gi)) {
      rtts.push(t[1].replace(/\s+/g, ''));
    }

    // Timeout-only hop.
    if (!rtts.length && /(\*|request timed out)/i.test(rest)) {
      out.push(row(hop, '', '', [], 'timeout'));
      continue;
    }

    // Host + IP. Windows: "name [1.2.3.4]"; *nix: "name (1.2.3.4)"; or bare IP.
    let host = '', ip = '';
    const bracket = rest.match(/([^\s\[\]()]+)\s*[\[(](\d{1,3}(?:\.\d{1,3}){3})[\])]/);
    if (bracket) { host = bracket[1]; ip = bracket[2]; }
    else {
      const bareIp = rest.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
      if (bareIp) ip = bareIp[1];
      const bareHost = rest.match(/\b([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\b/i);
      if (bareHost && bareHost[1] !== ip) host = bareHost[1];
    }
    if (host && host === ip) host = '';
    out.push(row(hop, host, ip, rtts, rtts.length ? 'ok' : 'timeout'));
  }
  return out;
}

function row(hop, host, ip, rtts, status) {
  return {
    'Hop': hop,
    'Host': host,
    'IP': ip,
    'RTT 1 (ms)': rtts[0] ?? '',
    'RTT 2 (ms)': rtts[1] ?? '',
    'RTT 3 (ms)': rtts[2] ?? '',
    'Status': status
  };
}
