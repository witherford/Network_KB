// DNS bulk-resolve script builder. Output is CSV with columns:
//   FQDN, Type, Value, Extra
// Extra holds priority for MX/SRV, TTL for others.
//
// Modes:
//   - Hostnames / IPs : one per line.
//   - CIDR sweep      : expands ranges, emits PTR (reverse-DNS) lookups
//                       for every host IP. Auto-switches Type to PTR.
//
// Includes a "paste output → export CSV" pane so the user can run the
// generated script externally and turn its terminal output into a CSV.

import { copyToClipboard, toast } from '../utils.js';
import { expandCidr, ipToArpa } from '../utils.js';
import { pasteAndExport, mountCopyButton } from '../components/io.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">DNS script builder</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">
      <div class="form-row">
        <label>Mode</label>
        <select id="dMode">
          <option value="hosts">Hostnames / single IPs</option>
          <option value="cidr">CIDR reverse-DNS sweep (forces PTR)</option>
        </select>
      </div>
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
        <label id="dInputLabel">Input (one hostname or IP per line)</label>
        <textarea id="dInput" placeholder="example.com&#10;google.com&#10;8.8.8.8"></textarea>
        <div class="hint" id="dStats"></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="dBuild">Build script</button>
      <button class="btn" id="dCopy">Copy script</button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn" id="dCsv" title="Export targets as a CSV stub matching the script's output columns">Export targets as CSV stub</button>
    </div>
    <pre class="script-out" id="dOut"></pre>
    <div id="dPaste"></div>`;

  // Mount the paste-output → export-CSV pane.
  pasteAndExport({
    root: root.querySelector('#dPaste'),
    title: 'Paste terminal output → export as CSV',
    filename: 'dns-results.csv',
    columns: ['FQDN', 'Type', 'Value', 'Extra'],
    hint: `After running the script externally, copy its console output and paste it below. The exporter auto-detects CSV / tab / multi-space output formats.`
  });

  const $ = sel => root.querySelector(sel);

  const targets = () => {
    const mode = $('#dMode').value;
    const raw = $('#dInput').value;
    if (mode === 'cidr') {
      // expandCidr returns hostnames/IPs/CIDR-expansion as a flat list.
      // For the CIDR mode, hostnames pass through too (rare but harmless).
      return expandCidr(raw, { includeNet: false }).filter(x => !x.startsWith('#'));
    }
    return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  };

  function refreshLabel() {
    const mode = $('#dMode').value;
    if (mode === 'cidr') {
      $('#dInputLabel').textContent = 'Input (one CIDR per line — e.g. 10.0.0.0/24, 192.168.1.0/29)';
      $('#dInput').placeholder = '10.0.0.0/24\n192.168.1.0/29\n203.0.113.0/28';
      // PTR is the meaningful query for a CIDR sweep.
      $('#dType').value = 'PTR';
      $('#dType').disabled = true;
    } else {
      $('#dInputLabel').textContent = 'Input (one hostname or IP per line)';
      $('#dInput').placeholder = 'example.com\ngoogle.com\n8.8.8.8';
      $('#dType').disabled = false;
    }
  }

  const build = () => {
    refreshLabel();
    const os = $('#dOs').value;
    const type = $('#dType').value;
    const server = $('#dServer').value.trim();
    const items = targets();
    const stats = $('#dStats');
    stats.textContent = items.length ? `${items.length} target${items.length === 1 ? '' : 's'}` : '';
    if (!items.length) { $('#dOut').textContent = '# No targets'; return; }
    $('#dOut').textContent = render(os, type, server, items, $('#dMode').value);
  };

  $('#dMode').addEventListener('change', build);
  $('#dOs').addEventListener('change', build);
  $('#dType').addEventListener('change', build);
  $('#dServer').addEventListener('input', build);
  $('#dInput').addEventListener('input', build);
  $('#dBuild').addEventListener('click', build);
  $('#dCopy').addEventListener('click', () => {
    const out = $('#dOut').textContent;
    if (out) copyToClipboard(out).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  $('#dCsv').addEventListener('click', () => {
    const items = targets();
    const type = $('#dType').value;
    if (!items.length) { toast('No targets to export', 'error'); return; }
    const csv = 'FQDN,Type,Value,Extra\r\n' +
      items.map(t => `${csvEscape(t)},${type},,`).join('\r\n') + '\r\n';
    download('dns-targets.csv', csv);
  });

  refreshLabel();
  build();
}

function render(os, type, server, items, mode) {
  if (os === 'ps') return renderPS(type, server, items, mode);
  return renderBash(type, server, items, mode);
}

// PowerShell — full type-aware extraction.
function renderPS(type, server, items, mode) {
  const list = items.map(h => `"${h.replace(/"/g, '`"')}"`).join(', ');
  const serverArg = server ? ` -Server ${server}` : '';
  return [
    '# DNS bulk resolve — outputs CSV: FQDN,Type,Value,Extra',
    '# Also written to dns-results.csv',
    mode === 'cidr' ? '# Mode: CIDR reverse-DNS sweep (PTR queries)' : null,
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
  ].filter(Boolean).join('\n');
}

// bash — type-aware parsing of dig +short.
function renderBash(type, server, items, mode) {
  const serverArg = server ? `@${server} ` : '';
  const list = items.map(h => `"${h.replace(/"/g, '\\"')}"`).join(' ');
  return [
    '#!/usr/bin/env bash',
    '# DNS bulk resolve — outputs CSV: FQDN,Type,Value,Extra',
    '# Also written to dns-results.csv',
    mode === 'cidr' ? '# Mode: CIDR reverse-DNS sweep (PTR queries)' : null,
    `targets=(${list})`,
    `TYPE='${type}'`,
    'csv_escape() { local v=$1; if [[ $v == *,* || $v == *\\"* || $v == *$\'\\n\'* ]]; then v=${v//\\"/\\"\\"}; printf \'"%s"\' "$v"; else printf \'%s\' "$v"; fi; }',
    'resolve_one() {',
    '  local t=$1',
    // For PTR we transform the input from an IP to a -x query.
    '  local query="$t"',
    '  if [ "$TYPE" = "PTR" ] && [[ "$t" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then',
    `    local raw; raw=$(dig +short ${serverArg}-x "$t" 2>/dev/null)`,
    '    if [ -z "$raw" ]; then echo "$t,PTR,UNRESOLVED,"; return; fi',
    '    while IFS= read -r line; do',
    '      [ -z "$line" ] && continue',
    '      val=${line%.}',
    '      printf \'%s,PTR,%s,\\n\' "$t" "$(csv_escape "$val")"',
    '    done <<< "$raw"',
    '    return',
    '  fi',
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
  ].filter(Boolean).join('\n');
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
