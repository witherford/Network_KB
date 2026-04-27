// Generic CSV / XLSX import modal used by software + CVE pages.
// Provides drag-drop + file-picker, "Download example" button, and a
// preview-and-confirm flow that hands the (possibly user-edited) rows back
// to the caller.

import { esc, toast, download } from '../utils.js';
import { parseCSV, parseXLSX, toCSV, mountFileImport, readImportFile, downloadTemplate } from './io.js';

/**
 * @param {object} cfg
 * @param {string} cfg.title - Modal title (e.g. "Import software releases").
 * @param {string[]} cfg.columns - Canonical column names for the example template.
 * @param {object[]} [cfg.sampleRows] - Sample rows for the downloaded example file.
 * @param {string} [cfg.exampleFilename] - Filename for the downloaded example.
 * @param {(rows: object[]) => object[]} [cfg.normalize] - Optional pre-merge transformer.
 * @param {(rows: object[]) => void} cfg.onConfirm - Callback once the user approves the rows.
 */
export function openImportModal(cfg) {
  const {
    title = 'Import',
    columns,
    sampleRows = [],
    exampleFilename = 'import-example.csv',
    normalize = rows => rows,
    onConfirm
  } = cfg;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card import-modal" role="dialog" aria-modal="true">
      <header class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="modal-close" aria-label="Close">×</button>
      </header>
      <div class="modal-body">
        <div style="margin-bottom:10px">
          <strong>Step 1.</strong> Download the example file, fill in your rows, then drop it back below.
          <div style="margin-top:6px">
            <button class="btn sm" data-act="dl-csv">Download example CSV</button>
            <button class="btn sm" data-act="dl-xlsx">Download example XLSX</button>
            <span class="hint" style="margin-left:8px">Columns: <code>${columns.join(', ')}</code></span>
          </div>
        </div>
        <div style="margin:14px 0">
          <strong>Step 2.</strong> Drop a file (CSV or XLSX) here.
          <div id="impZone" style="margin-top:8px"></div>
        </div>
        <div id="impPreview" style="margin-top:14px"></div>
      </div>
      <footer class="modal-foot">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="confirm" disabled>Add selected rows</button>
      </footer>
    </div>`;
  document.body.appendChild(overlay);

  let parsedRows = [];
  let parsedHeaders = [];
  const $ = sel => overlay.querySelector(sel);
  const close = () => { overlay.remove(); };

  // Mount drag-drop zone.
  const zone = $('#impZone');
  mountFileImport(zone, {
    accept: '.csv,.xlsx,.xlsm',
    onImport: async file => {
      try {
        const { headers, rows } = await readImportFile(file);
        parsedHeaders = headers;
        parsedRows = rows;
        renderPreview();
      } catch (e) {
        toast('Failed to parse file: ' + e.message, 'error');
      }
    }
  });

  function renderPreview() {
    const preview = $('#impPreview');
    if (!parsedRows.length) {
      preview.innerHTML = '<div class="page-empty">No rows parsed.</div>';
      $('button[data-act=confirm]').disabled = true;
      return;
    }
    // Detect any columns the user supplied that aren't expected — show a warning but still allow import.
    const unknown = parsedHeaders.filter(h => !columns.includes(h));
    const missing = columns.filter(c => !parsedHeaders.includes(c));
    preview.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <div><strong>${parsedRows.length}</strong> rows parsed.</div>
        <div>
          <button class="btn sm ghost" data-act="all">Select all</button>
          <button class="btn sm ghost" data-act="none">Select none</button>
        </div>
      </div>
      ${unknown.length ? `<div class="hint" style="color:#b45309;margin-bottom:6px">Extra columns ignored: <code>${unknown.join(', ')}</code></div>` : ''}
      ${missing.length ? `<div class="hint" style="color:#b45309;margin-bottom:6px">Missing canonical columns: <code>${missing.join(', ')}</code></div>` : ''}
      <div style="max-height:280px;overflow:auto;border:1px solid var(--border);border-radius:6px">
        <table class="lc-table" style="font-size:12px">
          <thead><tr>
            <th style="width:30px"><input type="checkbox" id="impAll" checked></th>
            ${columns.map(c => `<th>${esc(c)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${parsedRows.map((r, i) => `<tr>
              <td><input type="checkbox" class="imp-row" data-i="${i}" checked></td>
              ${columns.map(c => `<td>${esc(String(r[c] ?? ''))}</td>`).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    $('button[data-act=confirm]').disabled = false;

    overlay.querySelector('#impAll').addEventListener('change', e => {
      overlay.querySelectorAll('.imp-row').forEach(cb => { cb.checked = e.target.checked; });
    });
  }

  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
    const btn = e.target.closest('button[data-act], .modal-close');
    if (!btn) return;
    const act = btn.dataset.act || 'cancel';
    if (act === 'cancel' || btn.classList.contains('modal-close')) { close(); return; }
    if (act === 'dl-csv') {
      downloadTemplate(exampleFilename, columns, sampleRows);
      return;
    }
    if (act === 'dl-xlsx') {
      // Generate XLSX template using the dynamically-loaded SheetJS lib.
      generateXlsx(columns, sampleRows, exampleFilename.replace(/\.csv$/i, '.xlsx'));
      return;
    }
    if (act === 'all') { overlay.querySelectorAll('.imp-row').forEach(cb => cb.checked = true); return; }
    if (act === 'none') { overlay.querySelectorAll('.imp-row').forEach(cb => cb.checked = false); return; }
    if (act === 'confirm') {
      const checked = [...overlay.querySelectorAll('.imp-row:checked')].map(cb => parsedRows[+cb.dataset.i]);
      if (!checked.length) { toast('Select at least one row', 'error'); return; }
      try {
        const normalised = normalize(checked);
        onConfirm(normalised);
        close();
      } catch (err) {
        toast('Import failed: ' + err.message, 'error');
      }
    }
  });

  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

async function generateXlsx(columns, sampleRows, filename) {
  // Load SheetJS the same way parseXLSX does.
  let XLSX = window.XLSX;
  if (!XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = new URL('vendor/xlsx.mini.min.js', document.baseURI).toString();
      s.onload = res; s.onerror = () => rej(new Error('SheetJS load failed'));
      document.head.appendChild(s);
    });
    XLSX = window.XLSX;
  }
  const aoa = [columns, ...(sampleRows.length ? sampleRows.map(r => columns.map(c => r[c] ?? '')) : [columns.map(() => '')])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
