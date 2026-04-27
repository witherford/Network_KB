// JSON / YAML formatter and converter. Pure client-side.
//
// The YAML implementation is a tiny hand-rolled subset:
//   - mappings, sequences (block + flow), scalars (plain / single / double quoted),
//     null/true/false/numbers, comments (#), basic indentation handling, multiline
//     literals (| and >) — but NOT anchors/aliases or tags. A note callout flags this.

import { copyToClipboard, toast, download } from '../utils.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">JSON / YAML formatter & converter</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
      <div>
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span><strong>Input</strong></span>
          <select id="jyInLang" style="font-size:12px">
            <option value="auto" selected>Auto-detect</option>
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </select>
        </label>
        <textarea id="jyIn" rows="14" style="width:100%;font-family:'SF Mono',Consolas,monospace;font-size:12px" placeholder='{ "name": "router-1", "vlans": [10, 20, 30] }'></textarea>
        <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm" data-act="format-json">Format JSON</button>
          <button class="btn sm" data-act="format-yaml">Format YAML</button>
          <button class="btn sm" data-act="to-yaml">→ YAML</button>
          <button class="btn sm" data-act="to-json">→ JSON</button>
          <button class="btn sm" data-act="minify">Minify JSON</button>
          <button class="btn sm ghost" data-act="clear">Clear</button>
        </div>
      </div>
      <div>
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span><strong>Output</strong></span>
          <span id="jyOutLang" class="hint">—</span>
        </label>
        <textarea id="jyOut" rows="14" readonly style="width:100%;font-family:'SF Mono',Consolas,monospace;font-size:12px"></textarea>
        <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm" data-act="copy-out">Copy output</button>
          <button class="btn sm" data-act="dl-out">Download</button>
          <span class="spacer" style="flex:1"></span>
          <span id="jyStatus" class="hint"></span>
        </div>
      </div>
    </div>
    <div class="hint" style="margin-top:10px">
      The YAML parser supports mappings, sequences, scalars, comments, and <code>|</code> / <code>&gt;</code> block scalars.
      Anchors (<code>&amp;</code>) and aliases (<code>*</code>) and YAML tags (<code>!!str</code>) are NOT supported — paste-as-JSON if you hit one.
    </div>`;

  const $ = sel => root.querySelector(sel);
  const setOut = (text, lang) => { $('#jyOut').value = text; $('#jyOutLang').textContent = lang || '—'; };
  const setStatus = (msg, ok = true) => { const el = $('#jyStatus'); el.textContent = msg; el.style.color = ok ? '' : 'var(--danger)'; };

  function detect(s) {
    s = s.trim();
    if (!s) return null;
    if (s.startsWith('{') || s.startsWith('[')) return 'json';
    return 'yaml';
  }

  function parseInput() {
    const raw = $('#jyIn').value;
    let lang = $('#jyInLang').value;
    if (lang === 'auto') lang = detect(raw) || 'json';
    if (lang === 'json') {
      const obj = JSON.parse(raw);
      return { obj, lang };
    } else {
      const obj = parseYaml(raw);
      return { obj, lang };
    }
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    try {
      if (act === 'clear') { $('#jyIn').value = ''; $('#jyOut').value = ''; setStatus(''); return; }
      if (act === 'format-json') {
        const obj = JSON.parse($('#jyIn').value);
        setOut(JSON.stringify(obj, null, 2), 'JSON'); setStatus('Formatted'); return;
      }
      if (act === 'format-yaml') {
        const obj = parseYaml($('#jyIn').value);
        setOut(toYaml(obj), 'YAML'); setStatus('Formatted'); return;
      }
      if (act === 'to-yaml') {
        const { obj } = parseInput();
        setOut(toYaml(obj), 'YAML'); setStatus('Converted to YAML'); return;
      }
      if (act === 'to-json') {
        const { obj } = parseInput();
        setOut(JSON.stringify(obj, null, 2), 'JSON'); setStatus('Converted to JSON'); return;
      }
      if (act === 'minify') {
        const obj = JSON.parse($('#jyIn').value);
        setOut(JSON.stringify(obj), 'JSON (minified)'); setStatus('Minified'); return;
      }
      if (act === 'copy-out') {
        copyToClipboard($('#jyOut').value).then(ok => toast(ok ? 'Output copied' : 'Copy failed', ok ? 'success' : 'error'));
        return;
      }
      if (act === 'dl-out') {
        const lang = $('#jyOutLang').textContent.toLowerCase();
        const ext = lang.includes('yaml') ? 'yaml' : 'json';
        download('formatted.' + ext, $('#jyOut').value);
        return;
      }
    } catch (err) {
      setOut('', '—'); setStatus(err.message || String(err), false);
    }
  });
}

// ---------------- YAML parser (subset) ----------------

function parseYaml(text) {
  if (!text.trim()) return null;
  // Strip BOM and trailing whitespace; normalise newlines.
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  // Drop document markers and full-line comments.
  const rawLines = text.split('\n');
  const lines = [];
  for (const ln of rawLines) {
    if (/^\s*#/.test(ln)) continue;
    if (/^\s*---\s*$/.test(ln) || /^\s*\.\.\.\s*$/.test(ln)) continue;
    if (!ln.trim()) { lines.push(ln); continue; }
    lines.push(stripInlineComment(ln));
  }
  // Recursive descent driven by indentation.
  const ctx = { lines, i: 0 };
  const out = parseNode(ctx, 0);
  return out;
}

function stripInlineComment(line) {
  // Naive: strip ` # …` from the end if outside quotes.
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i).replace(/\s+$/, '');
    }
  }
  return line;
}

function indentOf(line) { return line.match(/^[ \t]*/)[0].length; }
function isBlank(line) { return /^\s*$/.test(line); }

function parseNode(ctx, baseIndent) {
  // Skip blank lines.
  while (ctx.i < ctx.lines.length && isBlank(ctx.lines[ctx.i])) ctx.i++;
  if (ctx.i >= ctx.lines.length) return null;
  const line = ctx.lines[ctx.i];
  const ind = indentOf(line);
  const trimmed = line.slice(ind);

  // Sequence?
  if (trimmed.startsWith('- ')) return parseSeq(ctx, ind);
  // Flow types start with { [ or " ' or a scalar.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    ctx.i++;
    return parseFlow(trimmed);
  }
  // Mapping?
  if (/^[^:#]+:(\s|$)/.test(trimmed)) return parseMap(ctx, ind);
  // Otherwise scalar
  ctx.i++;
  return parseScalar(trimmed);
}

function parseMap(ctx, baseIndent) {
  const obj = {};
  while (ctx.i < ctx.lines.length) {
    const line = ctx.lines[ctx.i];
    if (isBlank(line)) { ctx.i++; continue; }
    const ind = indentOf(line);
    if (ind < baseIndent) break;
    if (ind > baseIndent) {
      // Unexpected deeper indent at start of new key — treat as part of previous value.
      ctx.i++; continue;
    }
    const m = /^([^:#]+?):(?:\s+(.*))?$/.exec(line.slice(ind));
    if (!m) break;
    const key = unquote(m[1].trim());
    const after = (m[2] ?? '').trim();
    ctx.i++;
    if (after === '' || after === undefined) {
      // Look at next non-blank line to decide nested type.
      let look = ctx.i;
      while (look < ctx.lines.length && isBlank(ctx.lines[look])) look++;
      if (look >= ctx.lines.length) { obj[key] = null; continue; }
      const nl = ctx.lines[look];
      const nind = indentOf(nl);
      if (nind > baseIndent) {
        obj[key] = parseNode(ctx, nind);
      } else {
        obj[key] = null;
      }
    } else if (after === '|' || after === '|-' || after === '>' || after === '>-') {
      obj[key] = parseBlockScalar(ctx, baseIndent + 1, after);
    } else if (after.startsWith('{') || after.startsWith('[')) {
      obj[key] = parseFlow(after);
    } else {
      obj[key] = parseScalar(after);
    }
  }
  return obj;
}

function parseSeq(ctx, baseIndent) {
  const arr = [];
  while (ctx.i < ctx.lines.length) {
    const line = ctx.lines[ctx.i];
    if (isBlank(line)) { ctx.i++; continue; }
    const ind = indentOf(line);
    if (ind < baseIndent) break;
    if (ind > baseIndent) { ctx.i++; continue; }
    const trimmed = line.slice(ind);
    if (!trimmed.startsWith('- ') && trimmed !== '-') break;
    const after = trimmed.slice(2);
    ctx.i++;
    if (after === '') {
      // Block child below.
      let look = ctx.i;
      while (look < ctx.lines.length && isBlank(ctx.lines[look])) look++;
      if (look < ctx.lines.length && indentOf(ctx.lines[look]) > baseIndent) {
        arr.push(parseNode(ctx, indentOf(ctx.lines[look])));
      } else arr.push(null);
    } else if (/^[^:#]+:(\s|$)/.test(after) && !after.startsWith('{')) {
      // Inline mapping start: "- key: value" — read as a one-element block map.
      // Reconstruct a virtual map starting at baseIndent+2.
      const innerIndent = baseIndent + 2;
      ctx.lines.splice(ctx.i, 0, ' '.repeat(innerIndent) + after);
      arr.push(parseMap(ctx, innerIndent));
    } else if (after.startsWith('{') || after.startsWith('[')) {
      arr.push(parseFlow(after));
    } else {
      arr.push(parseScalar(after));
    }
  }
  return arr;
}

function parseBlockScalar(ctx, baseIndent, header) {
  const fold = header.startsWith('>');
  const strip = header.endsWith('-');
  const lines = [];
  while (ctx.i < ctx.lines.length) {
    const line = ctx.lines[ctx.i];
    if (line === '') { lines.push(''); ctx.i++; continue; }
    const ind = indentOf(line);
    if (ind < baseIndent && line.trim() !== '') break;
    lines.push(line.slice(baseIndent));
    ctx.i++;
  }
  let text;
  if (fold) {
    text = lines.reduce((acc, l, i) => {
      if (i === 0) return l;
      if (l === '' || /^\s/.test(l)) return acc + '\n' + l;
      return acc + ' ' + l;
    }, '');
  } else {
    text = lines.join('\n');
  }
  return strip ? text.replace(/\n+$/, '') : text + '\n';
}

function parseFlow(s) {
  // For flow-style we cheat: convert YAML-flow to JSON enough to JSON.parse.
  // Handles {a: 1, b: [2, 3]}, ['x','y']. Keys may be unquoted identifiers.
  const json = s
    // Quote unquoted keys.
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)\s*:/g, '$1"$2":')
    // Single-quoted scalars → double-quoted.
    .replace(/'([^']*)'/g, (_, x) => JSON.stringify(x));
  try { return JSON.parse(json); }
  catch (e) { throw new Error('Failed to parse flow value: ' + s); }
}

function parseScalar(s) {
  s = s.trim();
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
  if (s === 'true' || s === 'True' || s === 'TRUE')   return true;
  if (s === 'false' || s === 'False' || s === 'FALSE') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+(e[+-]?\d+)?$/i.test(s)) return parseFloat(s);
  return unquote(s);
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    if (s[0] === '"') {
      return inner.replace(/\\(.)/g, (_, c) => ({ n:'\n', t:'\t', r:'\r', '\\':'\\', '"':'"' })[c] ?? c);
    }
    return inner.replace(/''/g, "'");
  }
  return s;
}

// ---------------- YAML emitter ----------------

function toYaml(v, indent = 0) {
  if (v === null || v === undefined) return indent === 0 ? 'null\n' : 'null';
  const pad = '  '.repeat(indent);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]\n';
    return v.map(item => {
      if (item !== null && typeof item === 'object') {
        const inner = toYaml(item, indent + 1);
        // Move first key onto the dash line.
        const firstNL = inner.indexOf('\n');
        if (firstNL >= 0) {
          return pad + '- ' + inner.slice('  '.repeat(indent + 1).length, firstNL) + '\n' + inner.slice(firstNL + 1);
        }
        return pad + '- ' + inner.trim();
      }
      return pad + '- ' + scalarToYaml(item);
    }).join('\n') + (indent === 0 ? '\n' : '');
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) return '{}\n';
    return keys.map(k => {
      const val = v[k];
      const safeKey = /^[A-Za-z_][\w\-]*$/.test(k) ? k : JSON.stringify(k);
      if (val !== null && typeof val === 'object' && (Array.isArray(val) ? val.length : Object.keys(val).length)) {
        return pad + safeKey + ':\n' + toYaml(val, indent + 1).replace(/\n$/, '');
      }
      return pad + safeKey + ': ' + scalarToYaml(val);
    }).join('\n') + (indent === 0 ? '\n' : '');
  }
  return scalarToYaml(v);
}

function scalarToYaml(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  // Quote if contains characters that would confuse the parser.
  if (/^\s|\s$|[:#&*!?{}\[\],"'`>|%@]/.test(s) || /^(?:true|false|null|~)$/i.test(s) || /^-?\d+(\.\d+)?$/.test(s) === false && /^-?\d+(\.\d+)?$/.test(s)) {
    return JSON.stringify(s);
  }
  if (s === '') return '""';
  // Multi-line string → block literal.
  if (s.includes('\n')) {
    const lines = s.split('\n');
    return '|\n' + lines.map(l => '  ' + l).join('\n');
  }
  return s;
}
