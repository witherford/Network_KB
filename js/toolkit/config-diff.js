// Config diff — paste two device configs (or any two text blocks) side by side
// and get a line-based unified diff. Catches configuration drift between two
// devices or between a baseline and a live config. Pure client-side LCS diff,
// no dependencies.

import { esc, copyToClipboard, toast } from '../utils.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Config diff</h2>
    <p class="hint" style="margin-bottom:10px">Paste two configs. Lines only in A are removed (<span style="color:var(--danger,#dc2626)">−</span>), lines only in B are added (<span style="color:var(--ok,#16a34a)">+</span>). Useful for baseline-vs-live or device-A-vs-device-B drift checks.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row">
        <label>A (e.g. baseline / device 1)</label>
        <textarea id="cdA" placeholder="Paste config A…" style="min-height:200px;font-family:'SF Mono',Consolas,monospace;font-size:12px"></textarea>
      </div>
      <div class="form-row">
        <label>B (e.g. live / device 2)</label>
        <textarea id="cdB" placeholder="Paste config B…" style="min-height:200px;font-family:'SF Mono',Consolas,monospace;font-size:12px"></textarea>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="cdGo">Compare</button>
      <button class="btn" id="cdCopy">Copy diff</button>
      <button class="btn ghost" id="cdClear">Clear</button>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="cdTrim" checked> Ignore leading/trailing whitespace</label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="cdChanges"> Only changed lines</label>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="cdStat"></span>
    </div>
    <pre class="script-out" id="cdOut" style="line-height:1.5"></pre>`;

  const $ = sel => root.querySelector(sel);

  function render() {
    const norm = s => $('#cdTrim').checked ? s.replace(/\s+$/, '').replace(/^\s+/, '') : s;
    const a = $('#cdA').value.split(/\r?\n/);
    const b = $('#cdB').value.split(/\r?\n/);
    const diff = lcsDiff(a, b, norm);
    let added = 0, removed = 0;
    const onlyChanges = $('#cdChanges').checked;
    const html = diff
      .filter(d => !onlyChanges || d.t !== ' ')
      .map(d => {
        if (d.t === '+') { added++; return `<span style="color:var(--ok,#16a34a)">+ ${esc(d.line)}</span>`; }
        if (d.t === '-') { removed++; return `<span style="color:var(--danger,#dc2626)">- ${esc(d.line)}</span>`; }
        return `<span style="color:var(--muted,#94a3b8)">  ${esc(d.line)}</span>`;
      });
    // Recount (filter consumed the counters above only for displayed rows).
    added = diff.filter(d => d.t === '+').length;
    removed = diff.filter(d => d.t === '-').length;
    $('#cdOut').innerHTML = html.length ? html.join('\n') : '# No differences';
    $('#cdStat').textContent = `${added} added · ${removed} removed`;
  }

  $('#cdGo').addEventListener('click', render);
  $('#cdA').addEventListener('input', render);
  $('#cdB').addEventListener('input', render);
  $('#cdTrim').addEventListener('change', render);
  $('#cdChanges').addEventListener('change', render);
  $('#cdClear').addEventListener('click', () => { $('#cdA').value = ''; $('#cdB').value = ''; render(); });
  $('#cdCopy').addEventListener('click', () => {
    const txt = $('#cdOut').textContent;
    if (!txt.trim()) return;
    copyToClipboard(txt).then(ok => toast(ok ? 'Diff copied' : 'Copy failed', ok ? 'success' : 'error'));
  });

  render();
}

// Classic LCS line diff. `norm` normalises each line for comparison only; the
// original text is preserved in the output.
export function lcsDiff(a, b, norm = s => s) {
  const na = a.map(norm), nb = b.map(norm);
  const n = na.length, m = nb.length;
  // DP table of LCS lengths.
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (na[i] === nb[j]) { out.push({ t: ' ', line: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: '-', line: a[i] }); i++; }
    else { out.push({ t: '+', line: b[j] }); j++; }
  }
  while (i < n) { out.push({ t: '-', line: a[i] }); i++; }
  while (j < m) { out.push({ t: '+', line: b[j] }); j++; }
  return out;
}
