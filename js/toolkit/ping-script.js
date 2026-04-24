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
    <pre class="script-out" id="pOut"></pre>`;

  const resolveHosts = () => {
    const includeNet = root.querySelector('#pIncludeNet').checked;
    const rawLines = root.querySelector('#pInput').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return expandHosts(rawLines, includeNet);
  };

  const build = () => {
    const os = root.querySelector('#pOs').value;
    const count = Math.max(1, parseInt(root.querySelector('#pCount').value, 10) || 4);
    const parallel = root.querySelector('#pParallel').checked;
    const hosts = resolveHosts();
    if (!hosts.length) { root.querySelector('#pOut').textContent = '# No hosts to ping'; return; }
    root.querySelector('#pOut').textContent = renderScript(os, hosts, count, parallel);
  };

  root.querySelector('#pBuild').addEventListener('click', build);
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
  build();
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

function renderScript(os, hosts, count, parallel) {
  if (os === 'ps') {
    const list = hosts.map(h => `"${h}"`).join(', ');
    return parallel
      ? `# PowerShell 7+ parallel ping — outputs CSV: IP,Status\n` +
        `$hosts = @(${list})\n` +
        `$results = $hosts | ForEach-Object -Parallel {\n` +
        `  $r = Test-Connection -ComputerName $_ -Count ${count} -Quiet\n` +
        `  [pscustomobject]@{IP=$_;Status=if($r){"UP"}else{"DOWN"}}\n` +
        `} -ThrottleLimit 20\n` +
        `$results | Export-Csv -Path ping-results.csv -NoTypeInformation\n` +
        `$results | ForEach-Object { "$($_.IP),$($_.Status)" }`
      : `# Outputs CSV: IP,Status (also written to ping-results.csv)\n` +
        `$hosts = @(${list})\n` +
        `"IP,Status"\n` +
        `$rows = foreach ($h in $hosts) {\n` +
        `  $r = Test-Connection -ComputerName $h -Count ${count} -Quiet\n` +
        `  $s = if ($r) { "UP" } else { "DOWN" }\n` +
        `  "$h,$s"\n` +
        `}\n` +
        `$rows\n` +
        `$rows | Set-Content -Path ping-results.csv`;
  }
  if (os === 'cmd') {
    // cmd has no real scripting niceties — emit a .bat that writes CSV.
    return `@echo off\r\n` +
      `REM Outputs CSV: IP,Status — saved as ping-results.csv\r\n` +
      `> ping-results.csv echo IP,Status\r\n` +
      hosts.map(h =>
        `ping -n ${count} ${h} >nul && (>> ping-results.csv echo ${h},UP) || (>> ping-results.csv echo ${h},DOWN)`
      ).join('\r\n') + `\r\n` +
      `type ping-results.csv`;
  }
  // bash — always CSV: IP,Status
  if (parallel) {
    return `#!/usr/bin/env bash\n` +
      `# Outputs CSV: IP,Status (written to ping-results.csv)\n` +
      `hosts=(${hosts.map(h => `"${h}"`).join(' ')})\n` +
      `probe() { if ping -c ${count} -W 1 "$1" >/dev/null 2>&1; then echo "$1,UP"; else echo "$1,DOWN"; fi; }\n` +
      `export -f probe\n` +
      `{ echo "IP,Status"; printf '%s\\n' "\${hosts[@]}" | xargs -I{} -P 20 bash -c 'probe "$@"' _ {}; } | tee ping-results.csv`;
  }
  return `#!/usr/bin/env bash\n` +
    `# Outputs CSV: IP,Status (written to ping-results.csv)\n` +
    `hosts=(${hosts.map(h => `"${h}"`).join(' ')})\n` +
    `{\n` +
    `  echo "IP,Status"\n` +
    `  for h in "\${hosts[@]}"; do\n` +
    `    if ping -c ${count} -W 1 "$h" >/dev/null 2>&1; then echo "$h,UP"; else echo "$h,DOWN"; fi\n` +
    `  done\n` +
    `} | tee ping-results.csv`;
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
