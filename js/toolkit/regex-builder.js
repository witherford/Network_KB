// Regex builder — takes a natural-language description and a target engine,
// asks the configured AI provider to produce a regex. Until AI wiring lands,
// the UI works and includes a live-test box for the JS engine.

import { esc, copyToClipboard, toast } from '../utils.js';
import { state } from '../state.js';

const ENGINES = ['ECMAScript (JS)', 'PCRE / Perl', 'RE2 (Go)', 'Python (re)', '.NET'];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Regex builder</h2>
    <div class="form-row">
      <label>Engine</label>
      <select id="reEngine">
        ${ENGINES.map(e => `<option>${esc(e)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <label>Describe what the regex should match (plain English)</label>
      <textarea id="reDesc" placeholder="e.g. an IPv4 address with optional /prefix"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn primary" id="reGo">Generate via AI</button>
      <button class="btn" id="reCopy">Copy</button>
    </div>
    <div class="form-row">
      <label>Generated regex</label>
      <input type="text" id="reOut" readonly>
    </div>
    <div class="form-row">
      <label>Test against (one line = one input)</label>
      <textarea id="reTest" placeholder="Paste text to test against"></textarea>
      <div class="hint">Live-tested with the ECMAScript engine in your browser.</div>
    </div>
    <pre class="script-out" id="reResult"></pre>`;

  const run = async () => {
    const engine = root.querySelector('#reEngine').value;
    const desc = root.querySelector('#reDesc').value.trim();
    if (!desc) { toast('Describe the match first', 'warn'); return; }

    // When AI dispatch wiring exists, call it. Until then, surface a clear message.
    try {
      const { generateRegex } = await import('../api/ai.js').catch(() => ({}));
      if (typeof generateRegex === 'function' && state.settings) {
        const regex = await generateRegex({ engine, description: desc });
        root.querySelector('#reOut').value = regex;
        testRegex();
        return;
      }
    } catch (_) { /* fall through */ }

    toast('AI not configured yet — unlock edit mode and configure providers in Settings', 'warn', 5000);
  };

  const testRegex = () => {
    const pattern = root.querySelector('#reOut').value;
    const text = root.querySelector('#reTest').value;
    const out = root.querySelector('#reResult');
    if (!pattern) { out.textContent = ''; return; }
    let re;
    try { re = new RegExp(pattern, 'g'); }
    catch (err) { out.textContent = '# Invalid JS regex: ' + err.message; return; }
    const lines = text.split(/\r?\n/);
    const results = lines.map(line => {
      const m = line.match(re);
      return (m ? '✓ ' : '✗ ') + line + (m ? '    → ' + m.join(', ') : '');
    });
    out.textContent = results.join('\n');
  };

  root.querySelector('#reGo').addEventListener('click', run);
  root.querySelector('#reCopy').addEventListener('click', () => {
    const v = root.querySelector('#reOut').value;
    if (v) copyToClipboard(v).then(ok => toast(ok ? 'Regex copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  root.querySelector('#reOut').addEventListener('input', testRegex);
  root.querySelector('#reTest').addEventListener('input', testRegex);
}
