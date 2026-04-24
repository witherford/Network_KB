// DNS bulk-resolve script builder. Output is CSV — each target is resolved
// and printed as a row with the hostname/FQDN and the matching IP(s).

import { copyToClipboard, toast } from '../utils.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">DNS script builder</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">
      <div class="form-row">
        <label>Target OS</label>
        <select id="dOs">
          <option value="ps">Windows PowerShell</option>
          <option value="bash">Linux / macOS (bash)</option>
        </select>
      </div>
      <div class="form-row">
        <label>Record type</label>
        <select id="dType">
          <option value="A">A</option>
          <option value="AAAA">AAAA</option>
          <option value="PTR">PTR (reverse)</option>
          <option value="CNAME">CNAME</option>
          <option value="MX">MX</option>
          <option value="TXT">TXT</option>
          <option value="NS">NS</option>
        </select>
      </div>
      <div class="form-row">
        <label>Custom DNS server (optional)</label>
        <input type="text" id="dServer" placeholder="e.g. 8.8.8.8">
      </div>
      <div class="form-row" style="grid-column:1/-1">
        <label>Input (one hostname or IP per line)</label>
        <textarea id="dInput" placeholder="example.com&#10;google.com&#10;8.8.8.8"></textarea>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
      <button class="btn primary" id="dBuild">Build script</button>
      <button class="btn" id="dCopy">Copy script</button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn" id="dCsv" title="Export targets as a CSV stub (fill the IP column after running the script)">Export CSV</button>
    </div>
    <pre class="script-out" id="dOut"></pre>`;

  const targets = () => root.querySelector('#dInput').value
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const build = () => {
    const os = root.querySelector('#dOs').value;
    const type = root.querySelector('#dType').value;
    const server = root.querySelector('#dServer').value.trim();
    const items = targets();
    if (!items.length) { root.querySelector('#dOut').textContent = '# No hostnames'; return; }
    root.querySelector('#dOut').textContent = render(os, type, server, items);
  };

  root.querySelector('#dBuild').addEventListener('click', build);
  root.querySelector('#dCopy').addEventListener('click', () => {
    const out = root.querySelector('#dOut').textContent;
    if (out) copyToClipboard(out).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  root.querySelector('#dCsv').addEventListener('click', () => {
    const items = targets();
    if (!items.length) { toast('No targets to export', 'error'); return; }
    const csv = 'FQDN,IP\r\n' + items.map(t => `${csvEscape(t)},`).join('\r\n') + '\r\n';
    downloadCsv('dns-targets.csv', csv);
  });
  build();
}

function render(os, type, server, items) {
  if (os === 'ps') {
    const list = items.map(h => `"${h}"`).join(', ');
    const serverArg = server ? ` -Server ${server}` : '';
    return `# Outputs CSV: FQDN,IP\n` +
      `$targets = @(${list})\n` +
      `"FQDN,IP"\n` +
      `foreach ($t in $targets) {\n` +
      `  try {\n` +
      `    $r = Resolve-DnsName -Name $t -Type ${type}${serverArg} -ErrorAction Stop\n` +
      `    $ips = $r | Where-Object { $_.IPAddress -or $_.NameHost } |\n` +
      `      ForEach-Object { if ($_.IPAddress) { $_.IPAddress } else { $_.NameHost } }\n` +
      `    if (-not $ips) { "$t," }\n` +
      `    else { $ips | ForEach-Object { "$t,$_" } }\n` +
      `  } catch { "$t,UNRESOLVED" }\n` +
      `} | Tee-Object -FilePath dns-results.csv`;
  }
  // bash — dig preferred, host fallback. Always CSV: FQDN,IP
  const serverArg = server ? `@${server} ` : '';
  return `#!/usr/bin/env bash\n` +
    `# Outputs CSV: FQDN,IP (also written to dns-results.csv)\n` +
    `targets=(${items.map(h => `"${h}"`).join(' ')})\n` +
    `{\n` +
    `  echo "FQDN,IP"\n` +
    `  for t in "\${targets[@]}"; do\n` +
    `    if command -v dig >/dev/null; then\n` +
    `      ips=$(dig +short ${serverArg}"$t" ${type})\n` +
    `    else\n` +
    `      ips=$(host -t ${type} "$t" ${server || ''} 2>/dev/null | awk '/has address|has IPv6|domain name pointer|mail is handled/{print $NF}')\n` +
    `    fi\n` +
    `    if [ -z "$ips" ]; then\n` +
    `      echo "$t,UNRESOLVED"\n` +
    `    else\n` +
    `      while IFS= read -r ip; do echo "$t,$ip"; done <<< "$ips"\n` +
    `    fi\n` +
    `  done\n` +
    `} | tee dns-results.csv`;
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
