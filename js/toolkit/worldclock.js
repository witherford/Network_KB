// Multi-timezone clock. User adds/removes IANA zones, stored in localStorage prefs.

import { getPrefs, setPref } from '../prefs.js';
import { esc, toast } from '../utils.js';

let _timer = null;

export async function mount(root) {
  const zones = (() => {
    try { return Intl.supportedValuesOf('timeZone'); }
    catch { return []; }
  })();

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">World clock</h2>
    <div class="form-row" style="max-width:420px">
      <label>Add timezone</label>
      <div style="display:flex;gap:6px">
        <input type="text" id="tzInput" list="tzList" placeholder="e.g. Asia/Kolkata" style="flex:1;background:var(--card-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 10px;font-size:13px;font-family:inherit">
        <button class="btn primary" id="tzAdd">Add</button>
      </div>
      <datalist id="tzList">${zones.map(z => `<option value="${esc(z)}">`).join('')}</datalist>
    </div>
    <div id="clockGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:14px"></div>`;

  const renderGrid = () => {
    const p = getPrefs();
    const grid = root.querySelector('#clockGrid');
    if (!grid) { clearInterval(_timer); _timer = null; return; }
    grid.innerHTML = p.clockZones.map(z => {
      let timeStr, dateStr;
      try {
        const now = new Date();
        timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
        dateStr = new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'short', day: '2-digit', month: 'short' }).format(now);
      } catch {
        timeStr = 'invalid zone'; dateStr = '';
      }
      return `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <strong style="font-size:12px">${esc(z)}</strong>
          <button class="btn sm ghost" data-rm="${esc(z)}" title="Remove">×</button>
        </div>
        <div style="font-family:'SF Mono',Consolas,monospace;font-size:22px;font-weight:600;color:var(--code);margin-top:6px">${timeStr}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:3px">${dateStr}</div>
      </div>`;
    }).join('') || `<div class="page-empty" style="grid-column:1/-1">No zones. Add some above.</div>`;
  };

  renderGrid();
  if (_timer) clearInterval(_timer);
  _timer = setInterval(renderGrid, 1000);

  root.querySelector('#tzAdd').addEventListener('click', () => {
    const input = root.querySelector('#tzInput');
    const v = input.value.trim();
    if (!v) return;
    try { new Intl.DateTimeFormat('en', { timeZone: v }); } catch { toast('Unknown timezone', 'error'); return; }
    const p = getPrefs();
    if (p.clockZones.includes(v)) { toast('Already added', 'info'); return; }
    const next = [...p.clockZones, v];
    setPref('clockZones', next);
    input.value = '';
    renderGrid();
  });

  root.querySelector('#clockGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm]');
    if (!btn) return;
    const z = btn.dataset.rm;
    const p = getPrefs();
    setPref('clockZones', p.clockZones.filter(x => x !== z));
    renderGrid();
  });
}
