// Cisco "show interfaces" parser — paste the verbose output of
// `show interfaces` and get a per-interface table of link/protocol state,
// duplex & speed, and the key error counters (input errors, CRC, output
// errors, interface resets). Flags duplex mismatches and non-zero error
// counters so problem ports jump out. Exportable as CSV.

import { esc, copyToClipboard, toast } from '../utils.js';
import { toCSV, download } from '../components/io.js';

const IF_COLS = ['Interface', 'Link', 'Protocol', 'Duplex', 'Speed',
                 'In errors', 'CRC', 'Out errors', 'Resets', 'Flags'];

const SAMPLE = `GigabitEthernet0/1 is up, line protocol is up
  Hardware is iGbE, address is 00aa.bbcc.dd01 (bia 00aa.bbcc.dd01)
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
  Full-duplex, 1000Mb/s, media type is RJ45
     112233 packets input, 99887766 bytes, 0 no buffer
     0 runts, 0 giants, 0 throttles
     5 input errors, 3 CRC, 0 frame, 0 overrun, 0 ignored
     445566 packets output, 33221100 bytes, 0 underruns
     2 output errors, 0 collisions, 1 interface resets
GigabitEthernet0/2 is up, line protocol is up
  Half-duplex, 100Mb/s, media type is RJ45
     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
     0 output errors, 0 collisions, 0 interface resets
GigabitEthernet0/3 is administratively down, line protocol is down
  Auto-duplex, Auto-speed, media type is RJ45`;

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Show interfaces parser</h2>
    <p class="hint" style="margin-bottom:10px">Paste the output of Cisco <code>show interfaces</code>. Each interface becomes a row with link/protocol state, duplex &amp; speed and the error counters. Rows with half-duplex or non-zero errors are flagged.</p>
    <div class="form-row">
      <label>show interfaces output</label>
      <textarea id="ifIn" placeholder="Paste 'show interfaces' output here…" style="min-height:160px"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="ifGo">Parse</button>
      <button class="btn" id="ifCsv">Export CSV</button>
      <button class="btn" id="ifCopy">Copy as CSV</button>
      <button class="btn ghost" id="ifSample">Load sample</button>
      <button class="btn ghost" id="ifClear">Clear</button>
      <span class="spacer" style="flex:1"></span>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="ifProblems"> Only problem ports</label>
    </div>
    <div id="ifOut"></div>`;

  const $ = sel => root.querySelector(sel);

  function rows() {
    let r = parseInterfaces($('#ifIn').value);
    if ($('#ifProblems').checked) r = r.filter(x => x.Flags);
    return r;
  }
  function render() { $('#ifOut').innerHTML = renderTable(rows()); }

  $('#ifGo').addEventListener('click', render);
  $('#ifIn').addEventListener('input', render);
  $('#ifProblems').addEventListener('change', render);
  $('#ifSample').addEventListener('click', () => { $('#ifIn').value = SAMPLE; render(); });
  $('#ifClear').addEventListener('click', () => { $('#ifIn').value = ''; render(); });
  $('#ifCsv').addEventListener('click', () => {
    const r = rows();
    if (!r.length) { toast('Nothing to export', 'error'); return; }
    download('interfaces.csv', toCSV(r, IF_COLS), 'text/csv');
  });
  $('#ifCopy').addEventListener('click', async () => {
    const r = rows();
    if (!r.length) { toast('Nothing to copy', 'error'); return; }
    const ok = await copyToClipboard(toCSV(r, IF_COLS));
    toast(ok ? 'CSV copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
  });

  render();
}

function renderTable(rows) {
  if (!rows.length) return '<div class="page-empty">No interfaces parsed yet.</div>';
  return `<table class="tbl" style="margin-top:6px">
    <thead><tr>${IF_COLS.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        ${IF_COLS.map(c => {
          const v = r[c] ?? '';
          if (c === 'Flags' && v) return `<td style="color:var(--warn,#b45309)">${esc(String(v))}</td>`;
          const mono = (c === 'Interface' || c === 'Speed' || c === 'In errors' || c === 'CRC' || c === 'Out errors' || c === 'Resets');
          return `<td class="${mono ? 'mono' : ''}">${esc(String(v))}</td>`;
        }).join('')}
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// Split the dump into per-interface blocks (each begins with
// "<name> is <state>, line protocol is <state>") and pull the fields we care
// about out of each block.
export function parseInterfaces(text) {
  const lines = String(text).split(/\r?\n/);
  const blocks = [];
  let cur = null;
  const head = /^(\S+) is (administratively down|up|down|deleted)(?:\s*\([^)]*\))?, line protocol is (\w[\w\s-]*)/;
  for (const line of lines) {
    const m = line.match(head);
    if (m) {
      cur = { name: m[1], link: m[2], proto: m[3].trim(), body: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.body.push(line);
    }
  }
  return blocks.map(toRow);
}

function toRow(b) {
  const body = b.body.join('\n');
  let duplex = '', speed = '';
  const dm = body.match(/\b(Full|Half|Auto)[- ]duplex\b/i);
  if (dm) duplex = dm[1].toLowerCase();
  const sm = body.match(/\b(Auto-speed|\d+\s?[GMK]b\/s)\b/i);
  if (sm) speed = sm[1].replace(/\s+/g, '');

  const inErr  = num(body.match(/(\d+)\s+input errors/i));
  const crc    = num(body.match(/(\d+)\s+CRC\b/i));
  const outErr = num(body.match(/(\d+)\s+output errors/i));
  const resets = num(body.match(/(\d+)\s+interface resets/i));

  const flags = [];
  if (duplex === 'half') flags.push('half-duplex');
  if (inErr  > 0) flags.push('input errors');
  if (crc    > 0) flags.push('CRC');
  if (outErr > 0) flags.push('output errors');
  if (resets > 0) flags.push('resets');
  if (/down/i.test(b.link) && !/administratively/i.test(b.link)) flags.push('link down');

  return {
    'Interface': b.name,
    'Link': b.link,
    'Protocol': b.proto,
    'Duplex': duplex,
    'Speed': speed,
    'In errors': isNaN(inErr) ? '' : String(inErr),
    'CRC': isNaN(crc) ? '' : String(crc),
    'Out errors': isNaN(outErr) ? '' : String(outErr),
    'Resets': isNaN(resets) ? '' : String(resets),
    'Flags': flags.join(', ')
  };
}

function num(m) { return m ? parseInt(m[1], 10) : NaN; }
