// Ping script builder. User picks OS + options; app produces a script ready
// to paste. Output is CSV — each host gets one row with its IP and whether
// it responded (UP/DOWN).

import { copyToClipboard, toast } from '../utils.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Ping script builder</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">
      <div class="form-row">
        <label>Target OS</label>
        <select id="pOs">
          <option value="ps">Windows PowerShell</option>
          <option value="cmd">Windows cmd</option>
          <option value="bash">Linux / macOS (bash)</option>
        </select>
      </div>
      <div class="form-row">
        <label>Script output</label>
        <select id="pSink">
          <option value="csv">CSV file (ping-results.csv)</option>
          <option value="terminal">Terminal only</option>
        </select>
      </div>
      <div class="form-row">
        <label>Count per host</label>
        <input type="number" id="pCount" value="4" min="1" max="9999">
      </div>
      <div class="form-row">
        <label>Input (one host/IP/CIDR per line)</label>
        <textarea id="pInput" placeholder="10.0.0.1&#10;10.0.0.0/29&#10;example.com"></textarea>
      </div>
      <div class="form-row">
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pIncludeNet"> Include network/broadcast for CIDRs</label>
        <label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="pParallel"> Run in parallel where supported</label>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
      <button class="btn primary" id="pBuild">Build script</button>
      <button class="btn" id="pCopy">Copy script</button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn" id="pCsv" title="Export expanded host list as a CSV stub (fill the Status column after running the script)">Export CSV</button>
    </div>
    <pre class="script-out" id="pOut"></pre>
    <section class="paste-export" style="margin-top:18px;border-top:1px dashed var(--border);padding-top:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px">
        <strong style="font-size:13px">Paste ping output → export as CSV</strong>
        <span class="hint" style="font-size:11px">Windows cmd / PowerShell / Linux ping output</span>
      </div>
      <div class="hint" style="font-size:11px;margin-bottom:6px">Columns: <code>Host, IP, Status, Sent, Received, Lost, Loss %, Min (ms), Avg (ms), Max (ms)</code></div>
      <div class="hint" style="font-size:11px;margin-bottom:6px">Paste raw <code>ping</code> output for one or many hosts. Also accepts the builder's own <code>IP,Status</code> CSV.</div>
      <textarea id="pPasteTa" rows="6" style="width:100%;font-family:'SF Mono',Consolas,monospace;font-size:12px" placeholder="Paste ping output here…"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn primary" id="pPasteExport">Export CSV</button>
        <button class="btn" id="pPasteCopy">Copy as CSV</button>
        <button class="btn ghost" id="pPasteClear">Clear</button>
        <span class="spacer" style="flex:1"></span>
        <span class="hint" id="pPasteStatus" style="font-size:11px;align-self:center"></span>
      </div>
    </section>`;

  const resolveHosts = () => {
    const includeNet = root.querySelector('#pIncludeNet').checked;
    const rawLines = root.querySelector('#pInput').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return expandHosts(rawLines, includeNet);
  };

  const build = () => {
    const os = root.querySelector('#pOs').value;
    const count = Math.max(1, parseInt(root.querySelector('#pCount').value, 10) || 4);
    const parallel = root.querySelector('#pParallel').checked;
    const sink = root.querySelector('#pSink').value;
    const hosts = resolveHosts();
    if (!hosts.length) { root.querySelector('#pOut').textContent = '# No hosts to ping'; return; }
    root.querySelector('#pOut').textContent = renderScript(os, hosts, count, parallel, sink);
  };

  root.querySelector('#pBuild').addEventListener('click', build);
  root.querySelector('#pOs').addEventListener('change', build);
  root.querySelector('#pSink').addEventListener('change', build);
  root.querySelector('#pCount').addEventListener('input', build);
  root.querySelector('#pInput').addEventListener('input', build);
  root.querySelector('#pIncludeNet').addEventListener('change', build);
  root.querySelector('#pParallel').addEventListener('change', build);
  root.querySelector('#pCopy').addEventListener('click', () => {
    const out = root.querySelector('#pOut').textContent;
    if (!out) return;
    copyToClipboard(out).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  root.querySelector('#pCsv').addEventListener('click', () => {
    const hosts = resolveHosts();
    if (!hosts.length) { toast('No hosts to export', 'error'); return; }
    const csv = 'IP,Status\r\n' + hosts.map(h => `${csvEscape(h)},`).join('\r\n') + '\r\n';
    downloadCsv('ping-targets.csv', csv);
  });

  // ---- Paste ping output → export as CSV ----
  const pingCsv = () => {
    const rows = parsePingOutput(root.querySelector('#pPasteTa').value);
    if (!rows.length) return null;
    const head = PING_COLS.map(c => c[1]).join(',');
    const body = rows.map(r => PING_COLS.map(c => csvEscape(r[c[0]])).join(',')).join('\r\n');
    return head + '\r\n' + body + '\r\n';
  };
  const setPasteStatus = t => { root.querySelector('#pPasteStatus').textContent = t; };
  root.querySelector('#pPasteExport').addEventListener('click', () => {
    const csv = pingCsv();
    if (!csv) { toast('No ping results found in pasted text', 'error'); return; }
    downloadCsv('ping-results.csv', csv);
    setPasteStatus('Exported ping-results.csv');
  });
  root.querySelector('#pPasteCopy').addEventListener('click', () => {
    const csv = pingCsv();
    if (!csv) { toast('No ping results found in pasted text', 'error'); return; }
    copyToClipboard(csv).then(ok => {
      setPasteStatus(ok ? 'Copied to clipboard' : 'Copy failed');
      toast(ok ? 'CSV copied' : 'Copy failed', ok ? 'success' : 'error');
    });
  });
  root.querySelector('#pPasteClear').addEventListener('click', () => {
    root.querySelector('#pPasteTa').value = '';
    setPasteStatus('');
  });

  build();
}

// Columns for the paste-output → CSV exporter: [recordKey, headerLabel].
const PING_COLS = [
  ['host', 'Host'], ['ip', 'IP'], ['status', 'Status'],
  ['sent', 'Sent'], ['received', 'Received'], ['lost', 'Lost'], ['loss', 'Loss %'],
  ['min', 'Min (ms)'], ['avg', 'Avg (ms)'], ['max', 'Max (ms)']
];

// Parse raw ping output (Windows cmd/PowerShell + Linux/macOS) into row objects.
// Also accepts the builder's own "IP,Status" CSV. Returns rows in first-seen order.
function parsePingOutput(text) {
  if (!text || !text.trim()) return [];
  const isIp4 = s => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(s);
  const order = [];
  const byKey = new Map();
  let cur = null;

  const rec = (host, ip) => {
    if (host && !ip && isIp4(host)) { ip = host; host = ''; }   // IP-only target
    if (host && ip && host === ip) host = '';
    const key = (ip || host || '').toLowerCase();
    if (!key) return cur;
    let r = byKey.get(key);
    if (!r) {
      r = { host: host || '', ip: ip || '', status: '', sent: '', received: '',
            lost: '', loss: '', min: '', avg: '', max: '', _replies: 0, _stats: false };
      byKey.set(key, r);
      order.push(r);
    } else {
      if (host && !r.host) r.host = host;
      if (ip && !r.ip) r.ip = ip;
    }
    return r;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m;

    // Builder's own CSV passthrough.
    if (/^ip\s*,\s*status$/i.test(line)) continue;
    if ((m = line.match(/^([0-9a-fA-F.:]+)\s*,\s*(UP|DOWN)\s*$/i))) {
      cur = rec('', m[1]); if (cur) { cur.status = m[2].toUpperCase(); cur._stats = true; }
      continue;
    }

    // Target headers begin a new per-host block.
    if ((m = line.match(/^Pinging\s+(\S+?)(?:\s+\[([0-9a-fA-F.:]+)\])?\s+with\b/i))) { cur = rec(m[1], m[2]); continue; }
    if ((m = line.match(/^PING\s+(\S+?)\s+\(([0-9a-fA-F.:]+)\)/i)))                  { cur = rec(m[1], m[2]); continue; }

    // Statistics-block headers stay on the active target (output is sequential);
    // only create a record if none is active (e.g. a stats-only paste).
    if ((m = line.match(/^Ping statistics for\s+(\S+?):?\s*$/i))) { if (!cur) cur = rec('', m[1].replace(/:$/, '')); continue; }
    if ((m = line.match(/^---\s*(\S+?)\s+ping statistics/i)))     { if (!cur) cur = rec(m[1], ''); continue; }

    // Successful echo replies count toward the active target (switching only on a
    // new IP when no header preceded them).
    if ((m = line.match(/^Reply from\s+([\d.]+):.*\bbytes=/i))) {
      if (!cur || (cur.ip && cur.ip !== m[1])) cur = rec('', m[1]);
      cur._replies++; continue;
    }
    if ((m = line.match(/^\d+\s+bytes from\s+([0-9a-fA-F.:]+?)[:,]/i))) {
      if (!cur || (cur.ip && cur.ip !== m[1])) cur = rec('', m[1]);
      cur._replies++; continue;
    }

    // Windows packet counts.
    if (cur && (m = line.match(/Sent\s*=\s*(\d+).*Received\s*=\s*(\d+).*Lost\s*=\s*(\d+)\s*\((\d+)%/i))) {
      cur.sent = m[1]; cur.received = m[2]; cur.lost = m[3]; cur.loss = m[4];
      cur.status = +m[2] > 0 ? 'UP' : 'DOWN'; cur._stats = true; continue;
    }
    // Linux / macOS packet counts.
    if (cur && (m = line.match(/(\d+)\s+packets transmitted,\s*(\d+)\s+(?:packets\s+)?received.*?([\d.]+)%\s+packet loss/i))) {
      cur.sent = m[1]; cur.received = m[2]; cur.lost = String(+m[1] - +m[2]); cur.loss = m[3];
      cur.status = +m[2] > 0 ? 'UP' : 'DOWN'; cur._stats = true; continue;
    }
    // Windows RTT.
    if (cur && (m = line.match(/Minimum\s*=\s*(\d+)ms.*Maximum\s*=\s*(\d+)ms.*Average\s*=\s*(\d+)ms/i))) {
      cur.min = m[1]; cur.max = m[2]; cur.avg = m[3]; continue;
    }
    // Linux / macOS RTT (min/avg/max[/mdev|/stddev]).
    if (cur && (m = line.match(/min\/avg\/max\S*\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/i))) {
      cur.min = m[1]; cur.avg = m[2]; cur.max = m[3]; continue;
    }
  }

  // Where no statistics block was seen, derive status from reply count.
  for (const r of order) {
    if (!r._stats) r.status = r._replies > 0 ? 'UP' : 'DOWN';
    delete r._replies; delete r._stats;
  }
  return order;
}

function expandHosts(lines, includeNet) {
  const out = [];
  for (const line of lines) {
    if (!line.includes('/') || !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(line)) {
      out.push(line);
      continue;
    }
    const [addr, pStr] = line.split('/');
    const prefix = parseInt(pStr, 10);
    if (prefix < 0 || prefix > 32) { out.push(line); continue; }
    const hostBits = 32 - prefix;
    const size = 1 << hostBits;
    if (size > 8192) { out.push('# Range too large: ' + line); continue; }
    const parts = addr.split('.').map(Number);
    const base = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    const network = base & (0xffffffff << hostBits >>> 0);
    for (let i = 0; i < size; i++) {
      if (!includeNet && hostBits >= 2 && (i === 0 || i === size - 1)) continue;
      const n = (network + i) >>> 0;
      out.push([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.'));
    }
  }
  return out;
}

function renderScript(os, hosts, count, parallel, sink) {
  // Output sink: CSV mode writes the IP,Status rows to ping-results.csv;
  // terminal mode emits them to stdout only (no file write).
  const csv = sink === 'csv';
  if (os === 'ps') {
    const list = hosts.map(h => `"${h}"`).join(', ');
    if (parallel) {
      return [
        csv ? `# PowerShell 7+ parallel ping — outputs CSV: IP,Status (written to ping-results.csv)`
            : `# PowerShell 7+ parallel ping — outputs IP,Status to the terminal`,
        `$hosts = @(${list})`,
        `$results = $hosts | ForEach-Object -Parallel {`,
        `  $r = Test-Connection -ComputerName $_ -Count ${count} -Quiet`,
        `  [pscustomobject]@{IP=$_;Status=if($r){"UP"}else{"DOWN"}}`,
        `} -ThrottleLimit 20`,
        csv ? `$results | Export-Csv -Path ping-results.csv -NoTypeInformation` : null,
        `"IP,Status"`,
        `$results | ForEach-Object { "$($_.IP),$($_.Status)" }`
      ].filter(s => s !== null).join('\n');
    }
    return [
      csv ? `# Outputs CSV: IP,Status (also written to ping-results.csv)`
          : `# Outputs IP,Status to the terminal`,
      `$hosts = @(${list})`,
      `"IP,Status"`,
      `$rows = foreach ($h in $hosts) {`,
      `  $r = Test-Connection -ComputerName $h -Count ${count} -Quiet`,
      `  $s = if ($r) { "UP" } else { "DOWN" }`,
      `  "$h,$s"`,
      `}`,
      `$rows`,
      csv ? `$rows | Set-Content -Path ping-results.csv` : null
    ].filter(s => s !== null).join('\n');
  }
  if (os === 'cmd') {
    if (csv) {
      // cmd has no real scripting niceties — emit a .bat that writes CSV.
      return `@echo off\r\n` +
        `REM Outputs CSV: IP,Status — saved as ping-results.csv\r\n` +
        `> ping-results.csv echo IP,Status\r\n` +
        hosts.map(h =>
          `ping -n ${count} ${h} >nul && (>> ping-results.csv echo ${h},UP) || (>> ping-results.csv echo ${h},DOWN)`
        ).join('\r\n') + `\r\n` +
        `type ping-results.csv`;
    }
    return `@echo off\r\n` +
      `REM Outputs IP,Status to the terminal\r\n` +
      `echo IP,Status\r\n` +
      hosts.map(h =>
        `ping -n ${count} ${h} >nul && (echo ${h},UP) || (echo ${h},DOWN)`
      ).join('\r\n');
  }
  // bash
  if (parallel) {
    return `#!/usr/bin/env bash\n` +
      (csv ? `# Outputs CSV: IP,Status (written to ping-results.csv)\n`
           : `# Outputs IP,Status to the terminal\n`) +
      `hosts=(${hosts.map(h => `"${h}"`).join(' ')})\n` +
      `probe() { if ping -c ${count} -W 1 "$1" >/dev/null 2>&1; then echo "$1,UP"; else echo "$1,DOWN"; fi; }\n` +
      `export -f probe\n` +
      `{ echo "IP,Status"; printf '%s\\n' "\${hosts[@]}" | xargs -I{} -P 20 bash -c 'probe "$@"' _ {}; }` +
      (csv ? ` | tee ping-results.csv` : ``);
  }
  return `#!/usr/bin/env bash\n` +
    (csv ? `# Outputs CSV: IP,Status (written to ping-results.csv)\n`
         : `# Outputs IP,Status to the terminal\n`) +
    `hosts=(${hosts.map(h => `"${h}"`).join(' ')})\n` +
    `{\n` +
    `  echo "IP,Status"\n` +
    `  for h in "\${hosts[@]}"; do\n` +
    `    if ping -c ${count} -W 1 "$h" >/dev/null 2>&1; then echo "$h,UP"; else echo "$h,DOWN"; fi\n` +
    `  done\n` +
    `}` + (csv ? ` | tee ping-results.csv` : ``);
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
