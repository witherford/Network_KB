// Regex builder — natural-language → regex via the free Pollinations AI
// (no login, no API key required). Result is editable and live-tested
// against any text in the test box.

import { esc, copyToClipboard, toast } from '../utils.js';
import { freeAi, setBusy, stripFences, AI_CREDIT } from '../components/ai-free.js';

const ENGINES = ['ECMAScript (JS)', 'PCRE / Perl', 'RE2 (Go)', 'Python (re)', '.NET'];

const SAMPLES = [
  'an IPv4 address with optional /prefix',
  'an RFC 5321 email address',
  'a Cisco interface name like Gi1/0/24, TenGigabitEthernet0/1, Po10',
  'a MAC address in any format (colon, dash, Cisco-dotted)',
  'a UK phone number (any common format)',
  'a CVE identifier (CVE-YYYY-NNNN…)',
  'a UUID (any version)',
  'a private RFC 1918 IPv4 address',
  'a syslog severity level word'
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Regex builder</h2>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
      <div class="form-row">
        <label>Target engine</label>
        <select id="reEngine">
          ${ENGINES.map(e => `<option>${esc(e)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Quick examples</label>
        <select id="reSample">
          <option value="">— pick a sample —</option>
          ${SAMPLES.map(s => `<option>${esc(s)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row" style="margin-top:10px">
      <label>Describe the regex you need (plain English)</label>
      <textarea id="reDesc" rows="3" placeholder="e.g. an IPv4 address with optional /prefix"></textarea>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="reGo">Generate via free AI</button>
      <button class="btn" id="reExplain">Explain my regex</button>
      <button class="btn" id="reCopy">Copy regex</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="reStatus"></span>
    </div>

    <div class="form-row">
      <label>Regex (editable)</label>
      <input type="text" id="reOut" placeholder="Generated pattern appears here" style="font-family:'SF Mono',Consolas,monospace">
    </div>
    <div class="form-row">
      <label>Optional flags</label>
      <input type="text" id="reFlags" placeholder="e.g. gi" style="font-family:'SF Mono',Consolas,monospace;max-width:120px">
    </div>

    <div class="form-row" style="margin-top:6px">
      <label>Test against (one line = one input)</label>
      <textarea id="reTest" rows="6" placeholder="Paste text to test against"></textarea>
      <div class="hint">Live-tested with the ECMAScript engine in your browser. ✓ = match, ✗ = no match. Captured groups shown after the arrow.</div>
    </div>
    <pre class="script-out" id="reResult"></pre>
    <div id="reExplanation" style="margin-top:10px"></div>
    <div class="hint" style="margin-top:10px;font-size:11px">${esc(AI_CREDIT)}</div>`;

  const $ = sel => root.querySelector(sel);

  $('#reSample').addEventListener('change', e => {
    if (e.target.value) { $('#reDesc').value = e.target.value; e.target.value = ''; }
  });

  $('#reGo').addEventListener('click', async () => {
    const engine = $('#reEngine').value;
    const desc = $('#reDesc').value.trim();
    if (!desc) { toast('Describe the match first', 'warn'); return; }
    setBusy($('#reStatus'), true, 'Calling free AI…');
    $('#reGo').disabled = true;
    try {
      const system = `You are an expert regular-expression author. The user describes a pattern in English. Output ONLY the regex pattern that solves it for the ${engine} engine. No code fences, no explanation, no quotes, no leading/trailing whitespace, no flags suffix — just the bare pattern. Prefer compact patterns and capturing only when needed.`;
      const raw = await freeAi({ prompt: desc, system });
      // Strip fences / quotes that some models wrap around.
      let pattern = stripFences(raw).trim();
      pattern = pattern.replace(/^\/(.+)\/[a-z]*$/i, '$1');         // /pattern/flags → pattern
      pattern = pattern.replace(/^["'`](.*)["'`]$/, '$1');          // surrounding quotes
      $('#reOut').value = pattern;
      testRegex();
      $('#reStatus').textContent = 'Done';
      setTimeout(() => { $('#reStatus').textContent = ''; }, 2000);
    } catch (err) {
      toast('AI failed: ' + err.message, 'error', 6000);
      $('#reStatus').textContent = 'Failed';
    } finally {
      setBusy($('#reStatus'), false);
      $('#reGo').disabled = false;
    }
  });

  $('#reExplain').addEventListener('click', async () => {
    const pattern = $('#reOut').value.trim();
    if (!pattern) { toast('No regex to explain', 'warn'); return; }
    setBusy($('#reStatus'), true, 'Asking AI for explanation…');
    $('#reExplain').disabled = true;
    try {
      const explanation = await freeAi({
        prompt: `Explain this regex token-by-token in plain English so a network engineer can read it. Be concise; one bullet per construct. Regex: ${pattern}`,
        system: 'You explain regular expressions clearly and concisely. Output Markdown bullets only.'
      });
      $('#reExplanation').innerHTML = `<div style="background:var(--card-2);border:1px solid var(--border);border-radius:6px;padding:10px;font-size:12px;line-height:1.6;white-space:pre-wrap">${esc(explanation)}</div>`;
    } catch (err) {
      toast('AI failed: ' + err.message, 'error', 6000);
    } finally {
      setBusy($('#reStatus'), false);
      $('#reExplain').disabled = false;
    }
  });

  $('#reCopy').addEventListener('click', () => {
    const v = $('#reOut').value;
    if (v) copyToClipboard(v).then(ok => toast(ok ? 'Regex copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  $('#reOut').addEventListener('input', testRegex);
  $('#reFlags').addEventListener('input', testRegex);
  $('#reTest').addEventListener('input', testRegex);

  function testRegex() {
    const pattern = $('#reOut').value;
    const flags = ($('#reFlags').value || 'g').trim();
    const text = $('#reTest').value;
    const out = $('#reResult');
    if (!pattern) { out.textContent = ''; return; }
    let re;
    try { re = new RegExp(pattern, flags); }
    catch (err) { out.textContent = '# Invalid JS regex: ' + err.message; return; }
    const lines = text.split(/\r?\n/);
    const results = lines.map(line => {
      if (!line) return '';
      // Use matchAll if global, otherwise one match.
      const matches = flags.includes('g') ? [...line.matchAll(re)].map(m => m[0]) : (() => {
        const m = line.match(re); return m ? [m[0]] : [];
      })();
      return (matches.length ? '✓ ' : '✗ ') + line + (matches.length ? '    → ' + matches.join(', ') : '');
    });
    out.textContent = results.filter(r => r !== '').join('\n');
  }
}
