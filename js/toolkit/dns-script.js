// DNS bulk-resolve script builder.

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
    <div style="display:flex;gap:8px;margin:12px 0">
      <button class="btn primary" id="dBuild">Build script</button>
      <button class="btn" id="dCopy">Copy</button>
    </div>
    <pre class="script-out" id="dOut"></pre>`;

  const build = () => {
    const os = root.querySelector('#dOs').value;
    const type = root.querySelector('#dType').value;
    const server = root.querySelector('#dServer').value.trim();
    const items = root.querySelector('#dInput').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!items.length) { root.querySelector('#dOut').textContent = '# No hostnames'; return; }
    root.querySelector('#dOut').textContent = render(os, type, server, items);
  };

  root.querySelector('#dBuild').addEventListener('click', build);
  root.querySelector('#dCopy').addEventListener('click', () => {
    const out = root.querySelector('#dOut').textContent;
    if (out) copyToClipboard(out).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  build();
}

function render(os, type, server, items) {
  if (os === 'ps') {
    const list = items.map(h => `"${h}"`).join(', ');
    const serverArg = server ? ` -Server ${server}` : '';
    return `$targets = @(${list})\n` +
      `foreach ($t in $targets) {\n` +
      `  try {\n` +
      `    Resolve-DnsName -Name $t -Type ${type}${serverArg} -ErrorAction Stop |\n` +
      `      Select-Object Name, Type, IPAddress, NameHost, Strings |\n` +
      `      Format-Table -AutoSize\n` +
      `  } catch { Write-Host ("{0}: not resolvable" -f $t) -ForegroundColor Yellow }\n` +
      `}`;
  }
  // bash using dig if available, fall back to host
  const serverArg = server ? `@${server} ` : '';
  return `#!/usr/bin/env bash\n` +
    `targets=(${items.map(h => `"${h}"`).join(' ')})\n` +
    `for t in "\${targets[@]}"; do\n` +
    `  printf '%-40s ' "$t"\n` +
    `  if command -v dig >/dev/null; then\n` +
    `    dig +short ${serverArg}"$t" ${type} | paste -sd, -\n` +
    `  else\n` +
    `    host -t ${type} "$t" ${server || ''} | awk 'NR==1{print; exit}'\n` +
    `  fi\n` +
    `done`;
}
