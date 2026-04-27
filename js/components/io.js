// Shared CSV / XLSX / paste-export / copy-button / file-import utilities.
// One file used across toolkit tools and software/CVE pages so we don't
// duplicate the parsing, exporting, drag-drop, or copy-button code.

import { copyToClipboard, toast, download, slugify } from '../utils.js';

// ---------- CSV ----------

/**
 * RFC 4180–compliant CSV parser. Handles quoted fields with embedded
 * commas, escaped quotes (""), and CRLF / LF.
 * Returns { headers, rows } where rows is array of objects keyed by header.
 */
export function parseCSV(text) {
  if (!text) return { headers: [], rows: [] };
  // Strip BOM if present.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const records = [];
  let cur = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); records.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip — \n handles record end */ }
      else field += c;
    }
  }
  // Flush last field/record.
  if (field !== '' || cur.length) { cur.push(field); records.push(cur); }
  // Drop trailing empty record (file ending with newline).
  while (records.length && records[records.length - 1].every(c => c === '')) records.pop();
  if (!records.length) return { headers: [], rows: [] };
  const headers = records[0].map(h => h.trim());
  const rows = records.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}

/**
 * array-of-objects → CSV string. `columns` is optional explicit header
 * order; if omitted, uses union of keys in order of first appearance.
 */
export function toCSV(rows, columns = null) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const cols = columns || Array.from(rows.reduce((s, r) => {
    Object.keys(r).forEach(k => s.add(k));
    return s;
  }, new Set()));
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(esc).join(',')];
  for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

// ---------- XLSX ----------

let _xlsxPromise = null;
async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // Resolve relative to the page so it works on the GitHub Pages subpath.
    s.src = new URL('vendor/xlsx.mini.min.js', document.baseURI).toString();
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
  return _xlsxPromise;
}

/**
 * Read an .xlsx file (ArrayBuffer) and return the first sheet
 * as { headers, rows } — same shape as parseCSV.
 */
export async function parseXLSX(arrayBuffer) {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  // Return as array-of-arrays so we can extract headers explicitly
  // (otherwise SheetJS infers types — we want strings throughout).
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false, defval: '' });
  if (!aoa.length) return { headers: [], rows: [] };
  const headers = aoa[0].map(h => String(h).trim());
  const rows = aoa.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = String(r[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}

// ---------- Paste-and-export pane ----------

/**
 * Mount a "paste your terminal output below, then export to CSV" pane
 * inside `root`. Returns the textarea element so callers can preset content.
 *
 * Auto-detects the delimiter:
 *   - if any line contains a comma in a "header,header,header" pattern → CSV passthrough
 *   - if tab-separated → TSV → CSV
 *   - else → split on 2+ spaces
 *
 * `columns` is an optional list of expected headers for guidance only —
 * the export honours whatever is actually in the textarea.
 */
export function pasteAndExport({ root, title = 'Paste output', filename = 'output.csv', columns = null, hint = '' }) {
  const id = 'pe-' + Math.random().toString(36).slice(2, 8);
  const taId = id + '-ta';
  const wrap = document.createElement('section');
  wrap.className = 'paste-export';
  wrap.style.cssText = 'margin-top:18px;border-top:1px dashed var(--border);padding-top:14px';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px">
      <strong style="font-size:13px">${title}</strong>
      <span class="hint" style="font-size:11px">Copy and paste the terminal output into the below then click export</span>
    </div>
    ${columns ? `<div class="hint" style="font-size:11px;margin-bottom:6px">Expected columns: <code>${columns.join(', ')}</code></div>` : ''}
    ${hint ? `<div class="hint" style="font-size:11px;margin-bottom:6px">${hint}</div>` : ''}
    <textarea id="${taId}" rows="6" style="width:100%;font-family:'SF Mono',Consolas,monospace;font-size:12px" placeholder="Paste here…"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button class="btn primary" data-act="export">Export CSV</button>
      <button class="btn" data-act="copy">Copy as CSV</button>
      <button class="btn ghost" data-act="clear">Clear</button>
      <span class="spacer" style="flex:1"></span>
      <span class="hint" id="${id}-status" style="font-size:11px;align-self:center"></span>
    </div>`;
  root.appendChild(wrap);
  const ta = wrap.querySelector('#' + taId);
  const status = wrap.querySelector('#' + id + '-status');

  const detectAndConvert = raw => {
    const lines = raw.replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).filter(Boolean);
    if (!lines.length) return '';
    // CSV passthrough — first line has commas and looks well-formed.
    if (lines[0].includes(',') && !lines[0].includes('\t')) return raw.endsWith('\n') ? raw : raw + '\n';
    // TSV → CSV.
    if (lines[0].includes('\t')) {
      return lines.map(l => l.split('\t').map(csvEscape).join(',')).join('\r\n') + '\r\n';
    }
    // Fall back: split on 2+ spaces.
    return lines.map(l => l.split(/ {2,}/).map(csvEscape).join(',')).join('\r\n') + '\r\n';
  };

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'clear') { ta.value = ''; status.textContent = ''; return; }
    const raw = ta.value;
    if (!raw.trim()) { toast('Paste some output first', 'error'); return; }
    const csv = detectAndConvert(raw);
    if (act === 'export') {
      download(filename, csv, 'text/csv');
      status.textContent = 'Exported ' + filename;
    } else if (act === 'copy') {
      copyToClipboard(csv).then(ok => {
        status.textContent = ok ? 'Copied to clipboard' : 'Copy failed';
        toast(ok ? 'CSV copied' : 'Copy failed', ok ? 'success' : 'error');
      });
    }
  });

  return ta;
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------- Copy button ----------

/**
 * Mount a small "Copy" button next to (or inside) `host`. The text to copy
 * comes from `getText` (a function or static string).
 *
 *   mountCopyButton(host, { getText: () => preEl.textContent, label: 'Copy' })
 */
export function mountCopyButton(host, { getText, label = 'Copy', className = 'btn sm ghost', insertBefore = null } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', async () => {
    const text = typeof getText === 'function' ? getText() : String(getText);
    if (!text) { toast('Nothing to copy', 'error'); return; }
    const ok = await copyToClipboard(text);
    const orig = btn.textContent;
    btn.textContent = ok ? 'Copied ✓' : 'Failed';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
  });
  if (insertBefore && insertBefore.parentNode) insertBefore.parentNode.insertBefore(btn, insertBefore);
  else host.appendChild(btn);
  return btn;
}

// ---------- File import (drag-drop + picker) ----------

/**
 * Mount a drag-drop / file-picker import zone. Calls `onImport(file)` with
 * the chosen File. Handles CSV and XLSX automatically — caller provides
 * `onImport` which can call parseCSV/parseXLSX based on the file's name.
 */
export function mountFileImport(root, { accept = '.csv,.xlsx', onImport }) {
  const id = 'fi-' + Math.random().toString(36).slice(2, 8);
  const zone = document.createElement('div');
  zone.className = 'file-import-zone';
  zone.innerHTML = `
    <div class="file-import-inner">
      <div style="font-size:14px;font-weight:600">Drop a CSV or XLSX file here</div>
      <div class="hint" style="margin-top:4px">…or click to choose a file</div>
      <input type="file" id="${id}" accept="${accept}" hidden>
    </div>`;
  root.appendChild(zone);
  const input = zone.querySelector('#' + id);
  const trigger = () => input.click();
  zone.addEventListener('click', trigger);
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) onImport(f);
  });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) onImport(f);
    input.value = '';
  });
  return zone;
}

/**
 * Convenience: read a File (CSV or XLSX) and return { headers, rows }.
 */
export async function readImportFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const buf = await file.arrayBuffer();
    return parseXLSX(buf);
  }
  // Default: CSV / TSV.
  const text = await file.text();
  return parseCSV(text);
}

/**
 * Generate and download a CSV template.
 */
export function downloadTemplate(filename, columns, sampleRows = []) {
  const csv = toCSV(sampleRows.length ? sampleRows : [Object.fromEntries(columns.map(c => [c, '']))], columns);
  download(filename, csv, 'text/csv');
}
