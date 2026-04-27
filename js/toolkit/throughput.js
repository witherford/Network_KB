// Throughput / file-transfer / MTU calculator.
// Three sub-tools in one tab:
//   1. Bandwidth converter (bps ↔ Bps ↔ KB/s ↔ MB/s ↔ GB/s) + protocol overhead
//   2. File transfer time estimator
//   3. MTU / MSS / payload calculator with overhead presets

import { copyToClipboard, toast } from '../utils.js';
import { mountCopyButton } from '../components/io.js';

const OVERHEADS = {
  'eth-untagged':   { name: 'Ethernet (no VLAN)',                   sub: 38,  notes: '14 hdr + 4 FCS + 12 IFG + 8 preamble = 38 B per frame' },
  'eth-vlan':       { name: 'Ethernet 802.1Q',                      sub: 42,  notes: 'Adds 4 B VLAN tag' },
  'eth-qinq':       { name: 'Ethernet Q-in-Q',                      sub: 46,  notes: 'Two stacked VLAN tags' },
  'mpls':           { name: 'MPLS (1 label) over Ethernet',         sub: 42,  notes: '+4 B per label' },
  'gre':            { name: 'GRE over IPv4',                        sub: 24,  notes: '20 B IP + 4 B GRE' },
  'ipsec-esp-aes':  { name: 'IPsec ESP/AES (tunnel mode)',          sub: 73,  notes: '20 IP + 8 ESP hdr + 16 IV + 16 ICV + ~12 pad/trailer' },
  'vxlan':          { name: 'VXLAN over IPv4',                      sub: 50,  notes: '14 outer ETH + 20 IP + 8 UDP + 8 VXLAN' },
  'gretap':         { name: 'GRETAP / L2GRE',                       sub: 38,  notes: '20 IP + 4 GRE + 14 inner ETH' },
};

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Throughput, transfer time, MTU</h2>

    <h3 style="font-size:13px;margin:12px 0 6px;color:var(--muted)">1. Bandwidth converter</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      <div class="form-row">
        <label>Value</label>
        <input type="number" id="bwVal" value="1" step="any" min="0">
      </div>
      <div class="form-row">
        <label>Unit</label>
        <select id="bwUnit">
          <option value="bps">bit/s (bps)</option>
          <option value="kbps" selected>kilobit/s (kbps)</option>
          <option value="Mbps">megabit/s (Mbps)</option>
          <option value="Gbps">gigabit/s (Gbps)</option>
          <option value="Bps">byte/s (B/s)</option>
          <option value="KBps">kilobyte/s (KB/s)</option>
          <option value="MBps">megabyte/s (MB/s)</option>
          <option value="GBps">gigabyte/s (GB/s)</option>
        </select>
      </div>
      <div class="form-row">
        <label>Base</label>
        <select id="bwBase">
          <option value="1000" selected>SI (1 k = 1000) — networking</option>
          <option value="1024">Binary (1 k = 1024) — storage</option>
        </select>
      </div>
    </div>
    <pre class="script-out" id="bwOut" style="margin-top:8px"></pre>
    <div style="margin-top:6px"><button class="btn sm ghost" data-copy="bwOut">Copy result</button></div>

    <h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">2. File transfer time</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      <div class="form-row">
        <label>File size</label>
        <input type="number" id="ftSize" value="10" step="any" min="0">
      </div>
      <div class="form-row">
        <label>Size unit</label>
        <select id="ftSizeU">
          <option value="MB">MB</option>
          <option value="GB" selected>GB</option>
          <option value="TB">TB</option>
          <option value="MiB">MiB</option>
          <option value="GiB">GiB</option>
          <option value="TiB">TiB</option>
        </select>
      </div>
      <div class="form-row">
        <label>Link rate</label>
        <input type="number" id="ftRate" value="100" step="any" min="0">
      </div>
      <div class="form-row">
        <label>Rate unit</label>
        <select id="ftRateU">
          <option value="Mbps" selected>Mbps</option>
          <option value="Gbps">Gbps</option>
          <option value="MBps">MB/s</option>
          <option value="GBps">GB/s</option>
        </select>
      </div>
      <div class="form-row">
        <label>Real-world efficiency</label>
        <select id="ftEff">
          <option value="1">100% (line rate)</option>
          <option value="0.95" selected>95% (typical TCP healthy network)</option>
          <option value="0.85">85% (typical Internet, single TCP)</option>
          <option value="0.7">70% (lossy / high RTT)</option>
          <option value="0.5">50% (very poor)</option>
        </select>
      </div>
    </div>
    <pre class="script-out" id="ftOut" style="margin-top:8px"></pre>
    <div style="margin-top:6px"><button class="btn sm ghost" data-copy="ftOut">Copy result</button></div>

    <h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">3. MTU / MSS / overhead</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      <div class="form-row">
        <label>Path MTU (bytes)</label>
        <input type="number" id="mtu" value="1500" min="68" max="65535">
      </div>
      <div class="form-row">
        <label>L3 header</label>
        <select id="mtuL3">
          <option value="20" selected>IPv4 (20)</option>
          <option value="40">IPv6 (40)</option>
        </select>
      </div>
      <div class="form-row">
        <label>L4 header</label>
        <select id="mtuL4">
          <option value="20" selected>TCP (20)</option>
          <option value="8">UDP (8)</option>
        </select>
      </div>
      <div class="form-row">
        <label>Tunnel overhead</label>
        <select id="mtuTun">
          <option value="0" selected>None</option>
          <option value="24">GRE (24)</option>
          <option value="50">VXLAN (50)</option>
          <option value="73">IPsec ESP/AES tunnel (~73)</option>
          <option value="36">PPPoE + L2TP (36)</option>
          <option value="custom">Custom…</option>
        </select>
      </div>
      <div class="form-row" id="mtuCustomRow" style="display:none">
        <label>Custom tunnel bytes</label>
        <input type="number" id="mtuCustom" value="0" min="0" max="200">
      </div>
    </div>
    <pre class="script-out" id="mtuOut" style="margin-top:8px"></pre>
    <div style="margin-top:6px"><button class="btn sm ghost" data-copy="mtuOut">Copy result</button></div>`;

  const $ = sel => root.querySelector(sel);

  function bwCalc() {
    const v = parseFloat($('#bwVal').value) || 0;
    const u = $('#bwUnit').value;
    const k = parseInt($('#bwBase').value, 10);
    const bps = toBps(v, u, k);
    const lines = [];
    const fmt = n => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—';
    lines.push(`Input: ${v} ${u} (base ${k})`);
    lines.push('');
    lines.push(`bps     = ${fmt(bps)}`);
    lines.push(`kbps    = ${fmt(bps / k)}`);
    lines.push(`Mbps    = ${fmt(bps / (k**2))}`);
    lines.push(`Gbps    = ${fmt(bps / (k**3))}`);
    lines.push(`B/s     = ${fmt(bps / 8)}`);
    lines.push(`KB/s    = ${fmt(bps / 8 / k)}`);
    lines.push(`MB/s    = ${fmt(bps / 8 / (k**2))}`);
    lines.push(`GB/s    = ${fmt(bps / 8 / (k**3))}`);
    $('#bwOut').textContent = lines.join('\n');
  }

  function ftCalc() {
    const sz   = parseFloat($('#ftSize').value) || 0;
    const szU  = $('#ftSizeU').value;
    const rate = parseFloat($('#ftRate').value) || 0;
    const rU   = $('#ftRateU').value;
    const eff  = parseFloat($('#ftEff').value) || 1;
    if (!rate) { $('#ftOut').textContent = '# Enter a non-zero link rate'; return; }
    const bytes = sizeToBytes(sz, szU);
    const Bps = toBps(rate, rU, /Mbps|Gbps|kbps|bps/.test(rU) ? 1000 : 1000) / 8;
    const seconds = bytes / (Bps * eff);
    const lines = [];
    lines.push(`File: ${sz} ${szU} = ${bytes.toLocaleString()} bytes`);
    lines.push(`Rate: ${rate} ${rU} (effective ${(eff*100).toFixed(0)}%)`);
    lines.push('');
    lines.push(`Time: ${formatDuration(seconds)}`);
    lines.push(`     = ${seconds.toLocaleString(undefined,{maximumFractionDigits:2})} seconds`);
    $('#ftOut').textContent = lines.join('\n');
  }

  function mtuCalc() {
    const mtu = parseInt($('#mtu').value, 10) || 1500;
    const l3  = parseInt($('#mtuL3').value, 10);
    const l4  = parseInt($('#mtuL4').value, 10);
    const tunSel = $('#mtuTun').value;
    const tun = tunSel === 'custom' ? (parseInt($('#mtuCustom').value, 10) || 0) : parseInt(tunSel, 10);
    $('#mtuCustomRow').style.display = tunSel === 'custom' ? '' : 'none';
    const mss = mtu - l3 - l4 - tun;
    const lines = [];
    lines.push(`MTU              ${mtu} B`);
    lines.push(`Tunnel overhead -${tun} B`);
    lines.push(`L3 header       -${l3} B (${l3===20?'IPv4':'IPv6'})`);
    lines.push(`L4 header       -${l4} B (${l4===20?'TCP':'UDP'})`);
    lines.push(`MSS / payload   = ${mss} B`);
    if (mss < 0) lines.push('');
    if (mss < 0) lines.push('!! Negative payload — overhead exceeds MTU');
    if (mss < 1280 && l3 === 40) lines.push('!! IPv6 minimum MTU is 1280 — payload below this breaks IPv6');
    if (mss < 536 && l3 === 20) lines.push('!! Below TCP default MSS floor of 536 — likely fragmented or broken');
    // Frame overhead reference table
    lines.push('');
    lines.push('-- Total frame size with common L1/L2 overheads (assuming MTU=' + mtu + ' B IP) --');
    for (const [k,v] of Object.entries(OVERHEADS)) {
      lines.push(`${v.name.padEnd(36)} ${(mtu + v.sub).toString().padStart(5)} B   (+${v.sub})  ${v.notes}`);
    }
    $('#mtuOut').textContent = lines.join('\n');
  }

  for (const inp of root.querySelectorAll('input,select')) {
    inp.addEventListener('input', () => { bwCalc(); ftCalc(); mtuCalc(); });
    inp.addEventListener('change', () => { bwCalc(); ftCalc(); mtuCalc(); });
  }

  // Copy-result buttons.
  root.addEventListener('click', e => {
    const b = e.target.closest('button[data-copy]');
    if (!b) return;
    const target = root.querySelector('#' + b.dataset.copy);
    if (!target) return;
    copyToClipboard(target.textContent).then(ok => {
      const orig = b.textContent;
      b.textContent = ok ? 'Copied ✓' : 'Failed';
      setTimeout(() => { b.textContent = orig; }, 1000);
    });
  });

  bwCalc(); ftCalc(); mtuCalc();
}

function toBps(v, u, k) {
  switch (u) {
    case 'bps':  return v;
    case 'kbps': return v * k;
    case 'Mbps': return v * (k**2);
    case 'Gbps': return v * (k**3);
    case 'Bps':  return v * 8;
    case 'KBps': return v * 8 * k;
    case 'MBps': return v * 8 * (k**2);
    case 'GBps': return v * 8 * (k**3);
  }
  return v;
}

function sizeToBytes(v, u) {
  switch (u) {
    case 'MB':  return v * 1e6;
    case 'GB':  return v * 1e9;
    case 'TB':  return v * 1e12;
    case 'MiB': return v * 2**20;
    case 'GiB': return v * 2**30;
    case 'TiB': return v * 2**40;
  }
  return v;
}

function formatDuration(s) {
  if (!Number.isFinite(s)) return '—';
  if (s < 1) return (s*1000).toFixed(1) + ' ms';
  if (s < 60) return s.toFixed(1) + ' s';
  if (s < 3600) {
    const m = Math.floor(s/60); const ss = Math.floor(s%60);
    return `${m} min ${ss} s`;
  }
  if (s < 86400) {
    const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60);
    return `${h} h ${m} min`;
  }
  const d = Math.floor(s/86400); const h = Math.floor((s%86400)/3600);
  return `${d} d ${h} h`;
}
