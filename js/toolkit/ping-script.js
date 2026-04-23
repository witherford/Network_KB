// Ping script builder. User picks OS + options; app produces a script ready to paste.

import { esc, copyToClipboard, toast } from '../utils.js';

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
    <div style="display:flex;gap:8px;margin:12px 0">
      <button class="btn primary" id="pBuild">Build script</button>
      <button class="btn" id="pCopy">Copy</button>
    </div>
    <pre class="script-out" id="pOut"></pre>`;

  const build = () => {
    const os = root.querySelector('#pOs').value;
    const count = Math.max(1, parseInt(root.querySelector('#pCount').value, 10) || 4);
    const includeNet = root.querySelector('#pIncludeNet').checked;
    const parallel = root.querySelector('#pParallel').checked;
    const rawLines = root.querySelector('#pInput').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const hosts = expandHosts(rawLines, includeNet);
    if (!hosts.length) { root.querySelector('#pOut').textContent = '# No hosts to ping'; return; }
    root.querySelector('#pOut').textContent = renderScript(os, hosts, count, parallel);
  };

  root.querySelector('#pBuild').addEventListener('click', build);
  root.querySelector('#pCopy').addEventListener('click', () => {
    const out = root.querySelector('#pOut').textContent;
    if (!out) return;
    copyToClipboard(out).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
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
      ? `# PowerShell 7+ parallel ping\n` +
        `$hosts = @(${list})\n` +
        `$hosts | ForEach-Object -Parallel {\n` +
        `  $r = Test-Connection -ComputerName $_ -Count ${count} -Quiet\n` +
        `  [pscustomobject]@{Host=$_;Reachable=$r}\n` +
        `} -ThrottleLimit 20 | Format-Table`
      : `$hosts = @(${list})\n` +
        `foreach ($h in $hosts) {\n` +
        `  $r = Test-Connection -ComputerName $h -Count ${count} -Quiet\n` +
        `  Write-Host ("{0,-30} {1}" -f $h, $(if ($r) { "UP" } else { "DOWN" }))\n` +
        `}`;
  }
  if (os === 'cmd') {
    return hosts.map(h => `ping -n ${count} ${h}`).join(' && ');
  }
  // bash
  if (parallel) {
    return `#!/usr/bin/env bash\n` +
      `hosts=(${hosts.map(h => `"${h}"`).join(' ')})\n` +
      `for h in "\${hosts[@]}"; do\n` +
      `  ( ping -c ${count} -W 1 "$h" >/dev/null 2>&1 && echo "$h UP" || echo "$h DOWN" ) &\n` +
      `done\n` +
      `wait`;
  }
  return `#!/usr/bin/env bash\n` +
    `hosts=(${hosts.map(h => `"${h}"`).join(' ')})\n` +
    `for h in "\${hosts[@]}"; do\n` +
    `  if ping -c ${count} -W 1 "$h" >/dev/null 2>&1; then echo "$h UP"; else echo "$h DOWN"; fi\n` +
    `done`;
}
