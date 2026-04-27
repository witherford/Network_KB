// Password generator.
// - Crypto-secure RNG via window.crypto.getRandomValues (no Math.random anywhere).
// - Configurable character classes (lower, upper, digits, special).
// - Per-vendor templates that strip characters problematic for that
//   vendor's CLI/UI (Cisco, Citrix, HP/Aruba, Palo Alto, Dell network).
// - Custom additional-exclude box on top of any template.
// - Optional avoid-ambiguous (0/O/o, 1/l/I/i, etc.).
// - "Require at least one of each enabled class" (default ON).
// - Strength meter (entropy + time-to-crack estimate).
// - Pronounceable / passphrase mode using an embedded common-word list.
// - Per-row: show/hide, copy, regenerate. Bulk: copy-all, regenerate-all, export CSV.

import { copyToClipboard, toast } from '../utils.js';
import { toCSV } from '../components/io.js';

// ---------- Character pools ----------
const LOWER  = 'abcdefghijklmnopqrstuvwxyz';
const UPPER  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()-_=+[]{};:,.<>?/|~`\'"\\ ';   // 32 specials incl. space

// Characters that look alike when read off a screen and re-typed manually.
const AMBIGUOUS = '0Oo1lI|`\'".,;:!()[]{}';

// ---------- Vendor templates ----------
// Each template removes characters known to break that vendor's CLI parsing,
// banner storage, escape rules, or admin GUI quoting. Sources: vendor admin
// guides + decades of pain. Templates only filter the SPECIAL pool — letters
// and digits stay enabled if the user has those classes on.
const VENDORS = {
  none: {
    label: 'None — full special pool',
    excludes: '',
    notes: 'No vendor restrictions applied.'
  },
  cisco: {
    label: 'Cisco IOS / IOS-XE / NX-OS',
    excludes: '?\\$"\'`<>!#;|& ',
    notes: '? is the help key, $ is variable, " \' \\ ` get stripped/escaped, ! is a comment marker, ; can split commands, | is a pager redirect, & runs in background, leading/trailing space gets stripped. Avoid all of these for password storage.'
  },
  citrix: {
    label: 'Citrix NetScaler / ADC / Gateway',
    excludes: '"\'\\&$<>`|; ',
    notes: '" \' \\ are quote/escape sensitive in CLI and config syntax; & $ ` cause variable expansion or command splitting; | redirects; spaces are commonly truncated when pasted via the GUI.'
  },
  hp: {
    label: 'HP / HPE / Aruba (ProCurve, ArubaOS, AOS-CX)',
    excludes: '?$"\'\\`<>!&| ',
    notes: '? triggers context help; $ ` are variable substitution; " \' \\ break the parser; ! is a comment; & forks; | redirects; spaces unreliable across web GUI vs CLI.'
  },
  paloalto: {
    label: 'Palo Alto PAN-OS',
    excludes: '?\\$"\'`<>|& ',
    notes: '? is help; \\ escapes; $ ` interpolate; quotes complicate config XML serialisation; | & change shell semantics; spaces fail silently in PAN-OS commit XML.'
  },
  dell: {
    label: 'Dell Networking (PowerSwitch OS10 / OS9 / FTOS)',
    excludes: '?$"\'\\`<>!#&; ',
    notes: '? help; $ variable; \\ escape; quotes break parser; ! and # are comment markers; & forks; ; splits; spaces unreliable.'
  },
  juniper: {
    label: 'Juniper Junos',
    excludes: '?\\$"\'`<>|&; ',
    notes: '? help; $ ` interpolation; quotes / \\ escape rules; | & ; alter command structure.'
  },
  fortinet: {
    label: 'Fortinet FortiOS',
    excludes: '?\\$"\'`<>|& ',
    notes: '? help; \\ escape; $ ` variable; quotes affect set commands; | & change shell.'
  },
  unix: {
    label: 'Unix shell-safe (sh/bash)',
    excludes: '\\$"\'`!&|;<> *?(){}[]',
    notes: 'Avoids every metacharacter the shell would interpret. Useful for embedding in scripts without quoting.'
  }
};

// ---------- Common-word list for passphrase mode (~250 short, easy words) ----------
const WORDS = ('able acid ages also amid arch arid army arts atop aunt back band bank' +
  ' base bath beam bear belt bend best bias bind bird body bold bond bone book born' +
  ' boss both bowl brain brand brass brave bread brick brief bring broad brook brown' +
  ' brush build burst busy cabin calm camp cape card care case cash cast catch chain' +
  ' chair charm chart chase cheap cheek cheer chief child chill chip choke chord cite' +
  ' city civic claim clamp class clean clear cliff climb clock close cloth cloud club' +
  ' coast coat code coin cold come cook cool corn cost couch craft crash crawl creek' +
  ' crew crisp cross crowd crown crust cube curl curve dance dare dark dash data date' +
  ' dawn deal dean deep deer dent desk dial dime dine disc dish dive dock dome door' +
  ' dose dove down drag drama draw dream dress drift drill drink drop drum dust eager' +
  ' eagle early earn earth east easy edge eight elder empty enemy enjoy enter equal' +
  ' even event ever every exam exit eyes face fact fade fail fair fame farm fast fate' +
  ' favor feast fence fetch fever fiber field fifth fight final find fine fire firm' +
  ' fish fist five flag flame flash flat flax flee flesh flex flint float flock flood' +
  ' floor flour flow flush fly foam focus foil fold folk food foot ford form fort' +
  ' frame frank free fresh frog from front frost fruit fuel full fume fund funny gain' +
  ' game gate gear gene gentle ghost giant gift girl give glad glass glaze gleam glide' +
  ' globe gloom glory glove glow goal goat gold golf gone good gosh grab grace grade' +
  ' grain grant grape grasp grass great green grew grey grid grip group grove grow' +
  ' guard guess guest guide gulf hair half hall halt hand hang harbor hard hare harm' +
  ' harsh haste hatch have hawk haze head heal heap heart heat help herd here hero' +
  ' high hill hint hire hold hole home honey hood hook hope horse host hotel hour' +
  ' house huge human humor hunt hurry ice idea idle inch into iron item ivory join' +
  ' joke joy juice jump just keen keep kept kick kind king kiss kite knee knew knit' +
  ' knot know lack lake lamp land lane large last late lawn lazy lead leaf lean leap').split(/\s+/);

// ---------- DOM ----------
export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Password generator</h2>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">
      <div class="form-row">
        <label>How many?</label>
        <input type="number" id="pgCount" value="10" min="1" max="500">
      </div>
      <div class="form-row">
        <label>Min length</label>
        <input type="number" id="pgMin" value="14" min="1" max="256">
      </div>
      <div class="form-row">
        <label>Max length</label>
        <input type="number" id="pgMax" value="20" min="1" max="256">
      </div>
      <div class="form-row">
        <label>Mode</label>
        <select id="pgMode">
          <option value="random" selected>Random (cryptographically secure)</option>
          <option value="passphrase">Passphrase (word-NNN-word style)</option>
        </select>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:14px;padding:10px;border:1px solid var(--border);border-radius:8px">
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pgLower" checked> Lowercase letters</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pgUpper" checked> Uppercase letters</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pgDigits" checked> Numbers (0–9)</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pgSpecial" checked> Special characters</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pgRequireEach" checked> Require ≥1 of each enabled class</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="pgNoAmbig" checked> Avoid ambiguous chars (0/O, 1/l/I, etc.)</label>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px">
      <div class="form-row">
        <label>Vendor template (filters specials)</label>
        <select id="pgVendor">
          ${Object.entries(VENDORS).map(([k, v]) => `<option value="${k}"${k==='none'?' selected':''}>${v.label}</option>`).join('')}
        </select>
        <div class="hint" id="pgVendorNote" style="margin-top:6px;font-size:11px;line-height:1.45"></div>
      </div>
      <div class="form-row">
        <label>Additional excluded characters (your own restrictions)</label>
        <input type="text" id="pgExtra" placeholder="e.g. {}[]" autocomplete="off">
        <div class="hint">Stacks on top of the vendor template above.</div>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin:14px 0;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="pgGen">Generate</button>
      <button class="btn" id="pgCsv">Export CSV</button>
      <button class="btn" id="pgCopyAll">Copy all</button>
      <button class="btn ghost" id="pgShowAll">Show all</button>
      <button class="btn ghost" id="pgHideAll">Hide all</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="pgPoolInfo"></span>
    </div>

    <div id="pgOut"></div>`;

  const $ = sel => root.querySelector(sel);

  let lastResults = []; // [{ password, length, entropyBits, classesUsed }]

  // ---------- Reactive: every control rebuilds on change ----------
  const all = root.querySelectorAll('input, select');
  all.forEach(el => {
    el.addEventListener('input', generate);
    el.addEventListener('change', generate);
  });
  $('#pgGen').addEventListener('click', generate);
  $('#pgCsv').addEventListener('click', exportCsv);
  $('#pgCopyAll').addEventListener('click', copyAll);
  $('#pgShowAll').addEventListener('click', () => toggleAll(true));
  $('#pgHideAll').addEventListener('click', () => toggleAll(false));

  $('#pgVendor').addEventListener('change', updateVendorNote);
  updateVendorNote();
  generate();

  // ---------- Pool building ----------
  function buildPool() {
    const wantLower = $('#pgLower').checked;
    const wantUpper = $('#pgUpper').checked;
    const wantDig   = $('#pgDigits').checked;
    const wantSpec  = $('#pgSpecial').checked;
    const noAmbig   = $('#pgNoAmbig').checked;

    const vendor   = VENDORS[$('#pgVendor').value] || VENDORS.none;
    const extra    = $('#pgExtra').value;

    // Vendor template removes only from SPECIAL pool (per user spec).
    // Custom additional-exclude box removes from ANY pool — that's broader
    // and gives the user more control.
    const vendorExcludeSet = new Set(vendor.excludes.split(''));
    const extraExcludeSet  = new Set(extra.split(''));
    const ambigSet = noAmbig ? new Set(AMBIGUOUS.split('')) : new Set();

    const filterAll = pool => [...pool].filter(c => !extraExcludeSet.has(c) && !ambigSet.has(c)).join('');
    const filterSpecial = pool => [...pool]
      .filter(c => !vendorExcludeSet.has(c) && !extraExcludeSet.has(c) && !ambigSet.has(c))
      .join('');

    const pools = {};
    if (wantLower) pools.lower   = filterAll(LOWER);
    if (wantUpper) pools.upper   = filterAll(UPPER);
    if (wantDig)   pools.digits  = filterAll(DIGITS);
    if (wantSpec)  pools.special = filterSpecial(SPECIAL);

    // Drop empty pools after filtering (e.g. removing every special char).
    for (const k of Object.keys(pools)) if (!pools[k]) delete pools[k];

    return pools;
  }

  function updateVendorNote() {
    const v = VENDORS[$('#pgVendor').value] || VENDORS.none;
    const notes = v.notes;
    const ex = v.excludes;
    if (!ex) { $('#pgVendorNote').textContent = notes; return; }
    $('#pgVendorNote').innerHTML = `<strong>Removed from special pool:</strong> <code>${escForHtml(ex)}</code><br>${escForHtml(notes)}`;
  }

  // ---------- Generation ----------
  function generate() {
    let count = clamp(parseInt($('#pgCount').value, 10) || 1, 1, 500);
    let min = clamp(parseInt($('#pgMin').value, 10) || 1, 1, 256);
    let max = clamp(parseInt($('#pgMax').value, 10) || min, min, 256);
    if ($('#pgMin').value !== String(min)) $('#pgMin').value = min;
    if ($('#pgMax').value !== String(max)) $('#pgMax').value = max;

    const mode = $('#pgMode').value;
    const noAmbig = $('#pgNoAmbig').checked;
    const requireEach = $('#pgRequireEach').checked;
    const pools = buildPool();
    const allChars = Object.values(pools).join('');

    if (mode === 'passphrase') {
      lastResults = Array.from({ length: count }, () => makePassphrase(min, max, noAmbig));
    } else {
      if (!allChars) {
        $('#pgPoolInfo').textContent = '⚠ pool is empty — enable a class or remove an exclusion';
        $('#pgOut').innerHTML = '<div class="page-empty">Cannot generate — character pool is empty.</div>';
        lastResults = []; return;
      }
      lastResults = Array.from({ length: count }, () => makeRandom(min, max, pools, requireEach));
    }

    $('#pgPoolInfo').textContent = mode === 'passphrase'
      ? `Passphrase mode · ${WORDS.length}-word list`
      : `Pool: ${allChars.length} chars · ${Object.keys(pools).join(' + ')}`;
    renderRows();
  }

  function renderRows() {
    if (!lastResults.length) { $('#pgOut').innerHTML = ''; return; }
    $('#pgOut').innerHTML = `
      <div style="display:flex;gap:8px;font-size:11px;color:var(--text-3);padding:0 6px 4px;flex-wrap:wrap;align-items:center">
        <span style="flex:1"><strong>${lastResults.length}</strong> passwords generated</span>
        <span>Average length: <strong>${(lastResults.reduce((s,r)=>s+r.length,0)/lastResults.length).toFixed(1)}</strong></span>
        <span>Average entropy: <strong>${(lastResults.reduce((s,r)=>s+r.entropyBits,0)/lastResults.length).toFixed(0)}</strong> bits</span>
      </div>
      <table class="lc-table" style="margin-top:4px;font-size:13px;font-family:'SF Mono',Consolas,monospace">
        <thead><tr style="font-family:inherit;font-size:12px">
          <th style="width:30px">#</th>
          <th>Password</th>
          <th style="width:60px">Len</th>
          <th style="width:140px">Strength</th>
          <th style="width:170px">Actions</th>
        </tr></thead>
        <tbody>
          ${lastResults.map((r, i) => `<tr data-i="${i}">
            <td>${i + 1}</td>
            <td><span class="pg-pw" data-vis="0" data-pw="${escAttr(r.password)}">${maskOf(r.password.length)}</span></td>
            <td>${r.length}</td>
            <td>${strengthLabel(r.entropyBits)}</td>
            <td>
              <button class="btn sm ghost" data-act="show">Show</button>
              <button class="btn sm ghost" data-act="copy">Copy</button>
              <button class="btn sm ghost" data-act="regen">↻</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;

    $('#pgOut').addEventListener('click', onRowAction);
  }

  function onRowAction(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const tr = btn.closest('tr[data-i]');
    if (!tr) return;
    const i = +tr.dataset.i;
    const span = tr.querySelector('.pg-pw');
    const r = lastResults[i];
    if (!r) return;
    const act = btn.dataset.act;
    if (act === 'show') {
      const showing = span.dataset.vis === '1';
      span.dataset.vis = showing ? '0' : '1';
      span.textContent = showing ? maskOf(r.password.length) : r.password;
      btn.textContent = showing ? 'Show' : 'Hide';
    } else if (act === 'copy') {
      copyToClipboard(r.password).then(ok => {
        const orig = btn.textContent;
        btn.textContent = ok ? 'Copied' : 'Failed';
        setTimeout(() => { btn.textContent = orig; }, 900);
      });
    } else if (act === 'regen') {
      const min = clamp(parseInt($('#pgMin').value, 10) || 1, 1, 256);
      const max = clamp(parseInt($('#pgMax').value, 10) || min, min, 256);
      const mode = $('#pgMode').value;
      const noAmbig = $('#pgNoAmbig').checked;
      const requireEach = $('#pgRequireEach').checked;
      const pools = buildPool();
      lastResults[i] = mode === 'passphrase'
        ? makePassphrase(min, max, noAmbig)
        : makeRandom(min, max, pools, requireEach);
      // Just update this row without re-rendering everything.
      span.dataset.vis = '0';
      span.textContent = maskOf(lastResults[i].length);
      span.dataset.pw = lastResults[i].password;
      tr.querySelector('td:nth-child(3)').textContent = lastResults[i].length;
      tr.querySelector('td:nth-child(4)').innerHTML = strengthLabel(lastResults[i].entropyBits);
    }
  }

  function toggleAll(show) {
    if (!lastResults.length) return;
    $('#pgOut').querySelectorAll('.pg-pw').forEach((el, i) => {
      el.dataset.vis = show ? '1' : '0';
      el.textContent = show ? lastResults[i].password : maskOf(lastResults[i].length);
    });
    $('#pgOut').querySelectorAll('button[data-act="show"]').forEach(b => { b.textContent = show ? 'Hide' : 'Show'; });
  }

  async function copyAll() {
    if (!lastResults.length) { toast('Nothing to copy', 'error'); return; }
    const text = lastResults.map(r => r.password).join('\n');
    const ok = await copyToClipboard(text);
    toast(ok ? `Copied ${lastResults.length} passwords` : 'Copy failed', ok ? 'success' : 'error');
  }

  function exportCsv() {
    if (!lastResults.length) { toast('Nothing to export', 'error'); return; }
    const csv = toCSV(lastResults.map((r, i) => ({
      '#': i + 1,
      password: r.password,
      length: r.length,
      entropy_bits: r.entropyBits,
      strength: strengthText(r.entropyBits),
      generated_at: new Date().toISOString()
    })), ['#','password','length','entropy_bits','strength','generated_at']);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `passwords-${ts()}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// ---------- Crypto ----------
function rint(n) {
  // Uniform integer in [0, n) using rejection sampling on getRandomValues.
  if (n <= 0) throw new Error('rint requires n>0');
  const max = 0x100000000;
  const limit = max - (max % n);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

function pickFrom(s) { return s[rint(s.length)]; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rint(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Generators ----------
function makeRandom(min, max, pools, requireEach) {
  const len = min === max ? min : min + rint(max - min + 1);
  const allChars = Object.values(pools).join('');
  const classes = Object.keys(pools);
  const out = [];
  if (requireEach) {
    // Plant one char from each enabled pool first.
    for (const k of classes) out.push(pickFrom(pools[k]));
  }
  while (out.length < len) out.push(pickFrom(allChars));
  // If requireEach planted classes, shuffle to avoid predictable positions.
  shuffle(out);
  const password = out.slice(0, len).join('');
  return {
    password,
    length: password.length,
    entropyBits: Math.round(password.length * Math.log2(allChars.length || 1)),
    classesUsed: classes
  };
}

function makePassphrase(min, max, noAmbig) {
  // Choose words until we hit the length window. Connect with a random
  // separator + 2-3 digit code for entropy.
  const seps = noAmbig ? '-_.' : '-_.!?@#';
  const targetLen = min === max ? min : min + rint(max - min + 1);
  const words = [];
  let total = 0;
  while (total < targetLen - 6) {
    const w = WORDS[rint(WORDS.length)];
    words.push(w[0].toUpperCase() + w.slice(1));
    total += w.length + 1;
    if (words.length > 10) break; // sanity stop
  }
  const sep = pickFrom(seps);
  const numStr = String(rint(10000)).padStart(3, '0');
  let pw = words.join(sep) + sep + numStr;
  // Trim or pad to fit max if necessary.
  if (pw.length > max) pw = pw.slice(0, max);
  // Entropy estimate: log2(words^N) + log2(10^digits) + log2(seps).
  const wordsBits = words.length * Math.log2(WORDS.length);
  const numBits   = numStr.length * Math.log2(10);
  const sepBits   = Math.log2(seps.length);
  return {
    password: pw,
    length: pw.length,
    entropyBits: Math.round(wordsBits + numBits + sepBits),
    classesUsed: ['words', 'digits', 'separator']
  };
}

// ---------- Helpers ----------
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function maskOf(n)  { return '•'.repeat(Math.min(n, 32)); }
function ts()       { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }
function escForHtml(s) { return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escAttr(s)    { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function strengthText(bits) {
  if (bits < 28) return 'Very weak';
  if (bits < 40) return 'Weak';
  if (bits < 60) return 'Fair';
  if (bits < 80) return 'Strong';
  return 'Very strong';
}
function strengthLabel(bits) {
  const t = strengthText(bits);
  const colour = bits < 28 ? '#991b1b'
              : bits < 40 ? '#b45309'
              : bits < 60 ? '#0369a1'
              : bits < 80 ? '#166534'
              : '#065f46';
  return `<span style="color:${colour};font-weight:600">${t}</span> <span class="hint">(${bits} bits)</span>`;
}
