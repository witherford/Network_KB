// DSCP / ToS / IP Precedence reference + bidirectional converter.
// All values offline; references RFC 2474, RFC 4594, RFC 5865.

import { copyToClipboard, toast } from '../utils.js';

// 64-class DSCP table. Class names from RFC 2474 + 4594 where applicable.
function dscpName(d) {
  if (d === 0)  return 'CS0 (DF / Default)';
  if (d === 8)  return 'CS1 (Scavenger)';
  if (d === 10) return 'AF11';
  if (d === 12) return 'AF12';
  if (d === 14) return 'AF13';
  if (d === 16) return 'CS2 (OAM)';
  if (d === 18) return 'AF21';
  if (d === 20) return 'AF22';
  if (d === 22) return 'AF23';
  if (d === 24) return 'CS3 (Signaling / Broadcast Video)';
  if (d === 26) return 'AF31';
  if (d === 28) return 'AF32 (Multimedia Streaming)';
  if (d === 30) return 'AF33';
  if (d === 32) return 'CS4 (Realtime Interactive)';
  if (d === 34) return 'AF41 (Multimedia Conferencing)';
  if (d === 36) return 'AF42';
  if (d === 38) return 'AF43';
  if (d === 40) return 'CS5 (Broadcast Video / signalling)';
  if (d === 44) return 'VOICE-ADMIT (RFC 5865)';
  if (d === 46) return 'EF (Voice / Telephony)';
  if (d === 48) return 'CS6 (Network Control)';
  if (d === 56) return 'CS7 (Reserved)';
  return '';
}

// Recommended 802.1p (CoS) mapping per Cisco enterprise QoS guide.
function cos(d) {
  if (d === 46) return 5;     // EF
  if (d === 48) return 6;     // CS6
  if (d === 56) return 7;     // CS7
  if (d >= 32 && d < 40) return 4;
  if (d >= 24 && d < 32) return 3;
  if (d >= 16 && d < 24) return 2;
  if (d >= 8  && d < 16) return 1;
  return 0;
}

// Drop-precedence within an AFx group: low=1, medium=2, high=3 (RFC 2597).
function dropPrec(d) {
  if (d === 10 || d === 18 || d === 26 || d === 34) return 'low (1)';
  if (d === 12 || d === 20 || d === 28 || d === 36) return 'medium (2)';
  if (d === 14 || d === 22 || d === 30 || d === 38) return 'high (3)';
  return '—';
}

function ipPrec(d) {
  // Top 3 bits of DSCP correspond to old IP Precedence value.
  return d >> 3;
}

// 8-bit ToS byte = DSCP << 2 | ECN(2 bits)
function tosByte(d, ecn) { return (d << 2) | (ecn & 0x03); }

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">DSCP / ToS reference & converter</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <div class="form-row">
        <label>Decimal DSCP</label>
        <input type="number" id="dDec" min="0" max="63" value="46">
      </div>
      <div class="form-row">
        <label>Hex DSCP</label>
        <input type="text" id="dHex" placeholder="e.g. 0x2E">
      </div>
      <div class="form-row">
        <label>Binary DSCP (6 bits)</label>
        <input type="text" id="dBin" placeholder="e.g. 101110">
      </div>
      <div class="form-row">
        <label>Class name (e.g. EF, AF41, CS5)</label>
        <input type="text" id="dName" placeholder="EF">
      </div>
      <div class="form-row">
        <label>ECN bits</label>
        <select id="dEcn">
          <option value="00" selected>00 — Not-ECT</option>
          <option value="10">10 — ECT(0)</option>
          <option value="01">01 — ECT(1)</option>
          <option value="11">11 — CE (congestion experienced)</option>
        </select>
      </div>
    </div>
    <div id="dOut" style="margin-top:14px"></div>
    <h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">All 64 DSCP classes</h3>
    <div id="dTable"></div>`;

  const $ = s => root.querySelector(s);
  let lock = false;

  function syncFrom(source) {
    if (lock) return;
    lock = true;
    let d = parseInt($('#dDec').value, 10);
    if (source === 'hex') {
      const v = $('#dHex').value.trim().replace(/^0x/i, '');
      d = parseInt(v, 16);
    } else if (source === 'bin') {
      const v = $('#dBin').value.trim().replace(/[^01]/g, '');
      d = parseInt(v, 2);
    } else if (source === 'name') {
      const v = $('#dName').value.trim().toUpperCase();
      d = nameToDscp(v);
    }
    if (!Number.isFinite(d) || d < 0 || d > 63) {
      $('#dOut').innerHTML = `<div class="page-empty" style="color:var(--danger)">Invalid DSCP value (must be 0–63).</div>`;
      lock = false; return;
    }
    if (source !== 'dec')  $('#dDec').value = d;
    if (source !== 'hex')  $('#dHex').value = '0x' + d.toString(16).padStart(2, '0').toUpperCase();
    if (source !== 'bin')  $('#dBin').value = d.toString(2).padStart(6, '0');
    if (source !== 'name') $('#dName').value = dscpName(d) || '—';
    $('#dOut').innerHTML = renderDetail(d, $('#dEcn').value);
    lock = false;
  }

  $('#dDec').addEventListener('input', () => syncFrom('dec'));
  $('#dHex').addEventListener('input', () => syncFrom('hex'));
  $('#dBin').addEventListener('input', () => syncFrom('bin'));
  $('#dName').addEventListener('input', () => syncFrom('name'));
  $('#dEcn').addEventListener('change', () => syncFrom('ecn'));

  // Big reference table.
  $('#dTable').innerHTML = renderTable();
  $('#dTable').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-d]');
    if (!tr) return;
    $('#dDec').value = tr.dataset.d;
    syncFrom('dec');
  });
  // Copy buttons inside the detail panel are wired by renderDetail.
  $('#dOut').addEventListener('click', e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    copyToClipboard(btn.dataset.copy).then(ok => toast(ok ? 'Copied ' + btn.dataset.copy : 'Copy failed', ok ? 'success' : 'error'));
  });

  syncFrom('dec');
}

function nameToDscp(n) {
  const map = {
    DF: 0, CS0: 0, CS1: 8, CS2: 16, CS3: 24, CS4: 32, CS5: 40, CS6: 48, CS7: 56,
    AF11: 10, AF12: 12, AF13: 14,
    AF21: 18, AF22: 20, AF23: 22,
    AF31: 26, AF32: 28, AF33: 30,
    AF41: 34, AF42: 36, AF43: 38,
    EF: 46,
    'VOICE-ADMIT': 44, VA: 44
  };
  return map[n] ?? NaN;
}

function renderDetail(d, ecnBits) {
  const ecn = parseInt(ecnBits, 2);
  const tos = tosByte(d, ecn);
  const name = dscpName(d) || '—';
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;font-size:13px">
      <div><div class="hint">Class</div><div style="font-weight:600">${esc(name)}</div></div>
      <div><div class="hint">Decimal DSCP</div><div><code>${d}</code> <button class="btn sm ghost" data-copy="${d}">⧉</button></div></div>
      <div><div class="hint">Hex DSCP</div><div><code>0x${d.toString(16).padStart(2,'0').toUpperCase()}</code></div></div>
      <div><div class="hint">Binary DSCP</div><div><code>${d.toString(2).padStart(6,'0')}</code></div></div>
      <div><div class="hint">IP Precedence (legacy)</div><div><code>${ipPrec(d)}</code></div></div>
      <div><div class="hint">Recommended 802.1p / CoS</div><div><code>${cos(d)}</code></div></div>
      <div><div class="hint">Drop precedence</div><div>${dropPrec(d)}</div></div>
      <div><div class="hint">Full ToS byte (incl. ECN)</div><div><code>0x${tos.toString(16).padStart(2,'0').toUpperCase()}</code> = <code>${tos.toString(2).padStart(8,'0')}</code></div></div>
      <div><div class="hint">Cisco MQC marking</div><div><code>set dscp ${d}</code></div></div>
      <div><div class="hint">Linux iptables</div><div><code>-j DSCP --set-dscp ${d}</code></div></div>
    </div>
  </div>`;
}

function renderTable() {
  const rows = [];
  for (let d = 0; d < 64; d++) {
    rows.push({
      d, hex: '0x' + d.toString(16).padStart(2,'0').toUpperCase(),
      bin: d.toString(2).padStart(6,'0'),
      name: dscpName(d) || '',
      cos: cos(d),
      precedence: ipPrec(d)
    });
  }
  return `<table class="lc-table" style="margin-top:6px;font-size:12px">
    <thead><tr><th>Dec</th><th>Hex</th><th>Binary</th><th>Class name</th><th>IP Prec</th><th>CoS</th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr data-d="${r.d}" style="cursor:pointer">
        <td><code>${r.d}</code></td>
        <td><code>${r.hex}</code></td>
        <td><code>${r.bin}</code></td>
        <td>${esc(r.name)}</td>
        <td>${r.precedence}</td>
        <td>${r.cos}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}
function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
