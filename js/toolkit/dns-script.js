// DNS bulk-resolve script builder. Output is CSV with columns:
//   FQDN, Type, Value, Extra
// Extra holds the TTL.
//
// Modes (the mode implies the query type — there is no record-type field):
//   - Hostnames   : one hostname per line → forward A lookups.
//   - IP addresses: single IPs or CIDR ranges, one per line → reverse PTR
//                   lookups. CIDR ranges are expanded to host IPs.
//
// Target OS: Windows PowerShell (Resolve-DnsName), Linux/macOS bash (dig),
// or Windows command-prompt nslookup (paste-into-cmd helper).
//
// Includes a "paste output → export CSV" pane so the user can run the
// generated script externally and turn its terminal output into a CSV.

import { copyToClipboard, toast } from '../utils.js';
import { expandCidr, ipToArpa } from '../utils.js';
import { pasteAndExport, mountCopyButton } from '../components/io.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">DNS script builder</h2>
    <div class="form-row">
      <label>Mode</label>
      <select id="dMode">
        <option value="hosts">Hostnames</option>
        <option value="ips">IP addresses</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:12px">
      <div class="form-row">
        <label>Script output</label>
        <select id="dSink">
          <option value="csv">CSV file (dns-results.csv)</option>
          <option value="terminal">Terminal only</option>
        </select>
      </div>
      <div class="form-row">
        <label>Target OS</label>
        <select id="dOs">
          <option value="ps">Windows PowerShell</option>
          <option value="bash">Linux / macOS (bash)</option>
          <option value="nslookup">Windows command prompt nslookup</option>
        </select>
      </div>
      <div class="form-row">
        <label>Custom DNS server (optional)</label>
        <input type="text" id="dServer" placeholder="e.g. 8.8.8.8">
      </div>
    </div>
    <div class="form-row" style="margin-top:12px">
      <label id="dInputLabel">Input — one hostname per line (forward A lookup)</label>
      <textarea id="dInput" placeholder="example.com&#10;google.com"></textarea>
      <div class="hint" id="dStats"></div>
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
    columns: ['DNS name', 'record type', 'IP address', 'TTL'],
    header: ['DNS name', 'record type', 'IP address', 'TTL'],
    sourceHeaders: ['FQDN,Type,Value,Extra'],
    hint: `After running the script externally, copy its console output and paste it below. The exporter auto-detects CSV / tab / multi-space output and writes a header row: DNS name, record type, IP address, TTL.`
  });

  const $ = sel => root.querySelector(sel);

  // Query type is implied by the mode: hostnames → forward A, IPs → reverse PTR.
  const typeForMode = mode => (mode === 'ips' ? 'PTR' : 'A');

  const targets = () => {
    const mode = $('#dMode').value;
    const raw = $('#dInput').value;
    if (mode === 'ips') {
      // expandCidr expands CIDR ranges and passes single IPs through unchanged.
      return expandCidr(raw, { includeNet: false }).filter(x => !x.startsWith('#'));
    }
    return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  };

  function refreshLabel() {
    const mode = $('#dMode').value;
    if (mode === 'ips') {
      $('#dInputLabel').textContent = 'Input — IP addresses or CIDR ranges, one per line (reverse PTR lookup)';
      $('#dInput').placeholder = '10.0.0.5\n192.168.1.0/29\n8.8.8.8';
    } else {
      $('#dInputLabel').textContent = 'Input — one hostname per line (forward A lookup)';
      $('#dInput').placeholder = 'example.com\ngoogle.com';
    }
  }

  const build = () => {
    refreshLabel();
    const mode = $('#dMode').value;
    const os = $('#dOs').value;
    const type = typeForMode(mode);
    const server = $('#dServer').value.trim();
    const sink = $('#dSink').value;
    const items = targets();
    const stats = $('#dStats');
    stats.textContent = items.length ? `${items.length} target${items.length === 1 ? '' : 's'}` : '';
    if (!items.length) { $('#dOut').textContent = '# No targets'; return; }
    $('#dOut').textContent = render(os, type, server, items, mode, sink);
  };

  $('#dMode').addEventListener('change', build);
  $('#dSink').addEventListener('change', build);
  $('#dOs').addEventListener('change', build);
  $('#dServer').addEventListener('input', build);
  $('#dInput').addEventListener('input', build);
  $('#dBuild').addEventListener('click', build);
  $('#dCopy').addEventListener('click', () => {
    const out = $('#dOut').textContent;
    if (out) copyToClipboard(out).then(ok => toast(ok ? 'Script copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  $('#dCsv').addEventListener('click', () => {
    const items = targets();
    const type = typeForMode($('#dMode').value);
    if (!items.length) { toast('No targets to export', 'error'); return; }
    const csv = 'FQDN,Type,Value,Extra\r\n' +
      items.map(t => `${csvEscape(t)},${type},,`).join('\r\n') + '\r\n';
    download('dns-targets.csv', csv);
  });

  refreshLabel();
  build();
}

function render(os, type, server, items, mode, sink) {
  if (os === 'nslookup') return renderNslookup(type, server, items, mode);
  if (os === 'ps') return renderPS(type, server, items, mode, sink);
  return renderBash(type, server, items, mode, sink);
}

// Mode-aware comment for the script header.
const modeComment = mode => mode === 'ips'
  ? '# Mode: reverse-DNS PTR lookups (IPs / CIDR ranges)'
  : '# Mode: forward A lookups (hostnames)';

// PowerShell — Resolve-DnsName, extracting the A address or PTR host.
function renderPS(type, server, items, mode, sink) {
  const list = items.map(h => `"${h.replace(/"/g, '`"')}"`).join(', ');
  const serverArg = server ? ` -Server ${server}` : '';
  // Output sink: CSV mode tees each line to dns-results.csv; terminal mode
  // just emits the string (PowerShell prints it to the console).
  const csv = sink === 'csv';
  const emit = s => csv ? `${s} | Tee-Object -FilePath dns-results.csv` : s;
  const emitApp = s => csv ? `${s} | Tee-Object -FilePath dns-results.csv -Append` : s;
  return [
    '# DNS bulk resolve — outputs CSV: FQDN,Type,Value,Extra',
    csv ? '# Also written to dns-results.csv' : '# Terminal output only',
    modeComment(mode),
    `$targets = @(${list})`,
    `$type    = '${type}'`,
    emit('"FQDN,Type,Value,Extra"'),
    'foreach ($t in $targets) {',
    '  try {',
    `    $records = Resolve-DnsName -Name $t -Type $type${serverArg} -ErrorAction Stop |`,
    '      Where-Object { $_.Type -eq $type -or $_.QueryType -eq $type }',
    '    if (-not $records) {',
    '      $records = Resolve-DnsName -Name $t -Type $type' + serverArg + ' -ErrorAction Stop',
    '    }',
    `    if (-not $records) { ${emitApp('"$t,$type,,"')}; continue }`,
    '    foreach ($r in $records) {',
    '      switch -Wildcard ($r.Type) {',
    "        'A'     { $val = $r.IPAddress; $extra = $r.TTL }",
    "        'PTR'   { $val = $r.NameHost;  $extra = $r.TTL }",
    "        default { $val = $r.NameHost; if (-not $val) { $val = $r.IPAddress }; $extra = $r.TTL }",
    '      }',
    '      $valEsc = if ($val -match \'[",\\r\\n]\') { \'"\' + ($val -replace \'"\',\'""\') + \'"\' } else { $val }',
    '      $exEsc  = if ("$extra" -match \'[",\\r\\n]\') { \'"\' + ("$extra" -replace \'"\',\'""\') + \'"\' } else { "$extra" }',
    '      ' + emitApp('"$t,$($r.Type),$valEsc,$exEsc"'),
    '    }',
    '  } catch {',
    '    ' + emitApp('"$t,$type,UNRESOLVED,$($_.Exception.Message -replace \',\',\';\')"'),
    '  }',
    '}'
  ].filter(Boolean).join('\n');
}

// bash — dig +short (forward A) or dig -x (reverse PTR).
function renderBash(type, server, items, mode, sink) {
  const serverArg = server ? `@${server} ` : '';
  const list = items.map(h => `"${h.replace(/"/g, '\\"')}"`).join(' ');
  const csv = sink === 'csv';
  return [
    '#!/usr/bin/env bash',
    '# DNS bulk resolve — outputs CSV: FQDN,Type,Value,Extra',
    csv ? '# Also written to dns-results.csv' : '# Terminal output only',
    modeComment(mode),
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
    '      PTR) val=${line%.}',
    '           printf \'%s,%s,%s,\\n\' "$t" "$TYPE" "$(csv_escape "$val")" ;;',
    '      *) printf \'%s,%s,%s,\\n\' "$t" "$TYPE" "$(csv_escape "$line")" ;;',
    '    esac',
    '  done <<< "$raw"',
    '}',
    '{',
    '  echo "FQDN,Type,Value,Extra"',
    '  for t in "${targets[@]}"; do resolve_one "$t"; done',
    csv ? '} | tee dns-results.csv' : '}'
  ].filter(Boolean).join('\n');
}

// Windows command-prompt nslookup — one line per target, paste straight into
// cmd.exe. A bare IP makes nslookup do a reverse (PTR) lookup; a hostname does
// a forward lookup, so no per-type flag is needed. CIDR ranges are already
// expanded to host IPs by targets(). A custom DNS server is the 2nd argument.
function renderNslookup(type, server, items, mode) {
  const srv = server ? ' ' + server : '';
  const head = mode === 'ips'
    ? ':: DNS reverse lookups (PTR) — paste into a Windows command prompt'
    : ':: DNS forward lookups (A) — paste into a Windows command prompt';
  return [head, ...items.map(t => `nslookup ${t}${srv}`)].join('\r\n');
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
