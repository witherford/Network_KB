// DNS bulk-resolve script builder. Output is CSV — each target is resolved
// and printed as one row per record, with columns appropriate to the type:
//   FQDN, Type, Value, Extra
// Extra holds priority for MX/SRV, TTL fall-back, or remains blank for A/AAAA.

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
          <option value="SOA">SOA</option>
          <option value="SRV">SRV</option>
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
      <button class="btn" id="dCsv" title="Export targets as a CSV stub matching the script's output columns">Export CSV</button>
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
  root.querySelector('#dOs').addEventListener('change', build);
  root.querySelector('#dType').addEventListener('change', build);
  root.querySelector('#dServer').addEventListener('input', build);
  root.querySelector('#dInput').addEventListener('input', build);
  root.querySelector('#dCopy').addEventListener('click', () => {
    const out = root.querySelector('#dOut').textContent;
    if (out) copyToClipboard(out).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  root.querySelector('#dCsv').addEventListener('click', () => {
    const items = targets();
    const type = root.querySelector('#dType').value;
    if (!items.length) { toast('No targets to export', 'error'); return; }
    const csv = 'FQDN,Type,Value,Extra\r\n' +
      items.map(t => `${csvEscape(t)},${type},,`).join('\r\n') + '\r\n';
    downloadCsv('dns-targets.csv', csv);
  });
  build();
}

function render(os, type, server, items) {
  if (os === 'ps') return renderPS(type, server, items);
  return renderBash(type, server, items);
}

// PowerShell — handles every record type by mapping each Resolve-DnsName
// answer object to the right fields.
function renderPS(type, server, items) {
  const list = items.map(h => `"${h.replace(/"/g, '`"')}"`).join(', ');
  const serverArg = server ? ` -Server ${server}` : '';
  return [
    '# DNS bulk resolve — outputs CSV: FQDN,Type,Value,Extra',
    '# Also written to dns-results.csv',
    `$targets = @(${list})`,
    `$type    = '${type}'`,
    '"FQDN,Type,Value,Extra" | Tee-Object -FilePath dns-results.csv',
    'foreach ($t in $targets) {',
    '  try {',
    `    $records = Resolve-DnsName -Name $t -Type $type${serverArg} -ErrorAction Stop |`,
    '      Where-Object { $_.Type -eq $type -or $_.QueryType -eq $type }',
    '    if (-not $records) {',
    '      $records = Resolve-DnsName -Name $t -Type $type' + serverArg + ' -ErrorAction Stop',
    '    }',
    '    if (-not $records) { "$t,$type,," | Tee-Object -FilePath dns-results.csv -Append; continue }',
    '    foreach ($r in $records) {',
    '      switch -Wildcard ($r.Type) {',
    "        'A'     { $val = $r.IPAddress;     $extra = $r.TTL }",
    "        'AAAA'  { $val = $r.IPAddress;     $extra = $r.TTL }",
    "        'PTR'   { $val = $r.NameHost;      $extra = $r.TTL }",
    "        'CNAME' { $val = $r.NameHost;      $extra = $r.TTL }",
    "        'NS'    { $val = $r.NameHost;      $extra = $r.TTL }",
    "        'MX'    { $val = $r.NameExchange;  $extra = \"pri=$($r.Preference)\" }",
    "        'TXT'   { $val = ($r.Strings -join ' '); $extra = $r.TTL }",
    "        'SOA'   { $val = $r.PrimaryServer; $extra = \"admin=$($r.NameAdministrator) serial=$($r.SerialNumber)\" }",
    "        'SRV'   { $val = \"$($r.NameTarget):$($r.Port)\"; $extra = \"pri=$($r.Priority) wt=$($r.Weight)\" }",
    "        default { $val = $r.NameHost; if (-not $val) { $val = $r.IPAddress }; $extra = $r.TTL }",
    '      }',
    '      $valEsc = if ($val -match \'[",\\r\\n]\') { \'"\' + ($val -replace \'"\',\'""\') + \'"\' } else { $val }',
    '      $exEsc  = if ("$extra" -match \'[",\\r\\n]\') { \'"\' + ("$extra" -replace \'"\',\'""\') + \'"\' } else { "$extra" }',
    '      "$t,$($r.Type),$valEsc,$exEsc" | Tee-Object -FilePath dns-results.csv -Append',
    '    }',
    '  } catch {',
    '    "$t,$type,UNRESOLVED,$($_.Exception.Message -replace \',\',\';\')" | Tee-Object -FilePath dns-results.csv -Append',
    '  }',
    '}'
  ].join('\n');
}

// bash — uses dig +short with field-aware parsing per record type so the
// CSV columns line up. Falls back to host(1) if dig is missing.
function renderBash(type, server, items) {
  const serverArg = server ? `@${server} ` : '';
  const list = items.map(h => `"${h.replace(/"/g, '\\"')}"`).join(' ');
  return [
    '#!/usr/bin/env bash',
    '# DNS bulk resolve — outputs CSV: FQDN,Type,Value,Extra',
    '# Also written to dns-results.csv',
    `targets=(${list})`,
    `TYPE='${type}'`,
    'csv_escape() { local v=$1; if [[ $v == *,* || $v == *\\"* || $v == *$\'\\n\'* ]]; then v=${v//\\"/\\"\\"}; printf \'"%s"\' "$v"; else printf \'%s\' "$v"; fi; }',
    'resolve_one() {',
    '  local t=$1',
    '  if ! command -v dig >/dev/null; then',
    `    host -t "$TYPE" "$t" ${server || ''} 2>/dev/null | awk -v t="$t" -v ty="$TYPE" '/has address|has IPv6 address|domain name pointer|is an alias for|name server|mail is handled by|text/ { v=$NF; print t","ty","v"," }'`,
    '    return',
    '  fi',
    `  local raw; raw=$(dig +short ${serverArg}"$t" "$TYPE" 2>/dev/null)`,
    '  if [ -z "$raw" ]; then echo "$t,$TYPE,UNRESOLVED,"; return; fi',
    '  while IFS= read -r line; do',
    '    [ -z "$line" ] && continue',
    '    case "$TYPE" in',
    '      MX)  pri=${line%% *}; val=${line#* }; val=${val%.}',
    '           printf \'%s,%s,%s,pri=%s\\n\' "$t" "$TYPE" "$(csv_escape "$val")" "$pri" ;;',
    '      SRV) read -r pri wt port tgt <<< "$line"; tgt=${tgt%.}',
    '           printf \'%s,%s,%s,pri=%s wt=%s\\n\' "$t" "$TYPE" "$(csv_escape "$tgt:$port")" "$pri" "$wt" ;;',
    '      TXT) val=${line#\\"}; val=${val%\\"}',
    '           printf \'%s,%s,%s,\\n\' "$t" "$TYPE" "$(csv_escape "$val")" ;;',
    '      SOA) read -r ns admin serial rest <<< "$line"; ns=${ns%.}; admin=${admin%.}',
    '           printf \'%s,%s,%s,admin=%s serial=%s\\n\' "$t" "$TYPE" "$(csv_escape "$ns")" "$admin" "$serial" ;;',
    '      CNAME|NS|PTR) val=${line%.}',
    '           printf \'%s,%s,%s,\\n\' "$t" "$TYPE" "$(csv_escape "$val")" ;;',
    '      *) printf \'%s,%s,%s,\\n\' "$t" "$TYPE" "$(csv_escape "$line")" ;;',
    '    esac',
    '  done <<< "$raw"',
    '}',
    '{',
    '  echo "FQDN,Type,Value,Extra"',
    '  for t in "${targets[@]}"; do resolve_one "$t"; done',
    '} | tee dns-results.csv'
  ].join('\n');
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
