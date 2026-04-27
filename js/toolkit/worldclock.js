// World clock + timezone comparison + timezone converter.
// Three modes: Live / Compare / Convert.

import { getPrefs, setPref } from '../prefs.js';
import { esc, toast } from '../utils.js';
import { TZ_ABBR, TZ_BY_ABBR, fmtOffset, offsetForZone } from './tz-data.js';

let _timer = null;

function dedupeZones(zones) {
  const seen = new Set();
  const out = [];
  for (const z of zones) {
    if (!z) continue;
    if (seen.has(z)) continue;
    seen.add(z);
    out.push(z);
  }
  return out;
}

function migrateLegacyPrefs() {
  // Older versions stored just IANA names like "Asia/Kolkata" in p.clockZones.
  // Newer code keeps the same shape — no migration needed, just dedupe.
  const p = getPrefs();
  const cleaned = dedupeZones(p.clockZones || []);
  if (cleaned.length !== (p.clockZones || []).length) setPref('clockZones', cleaned);
}

// Build a dropdown list. We expose every abbreviation entry plus the
// full list of IANA zones; unioned and labelled.
function buildAddCandidates() {
  // Map IANA → first-found abbreviation entry (so if a user types a city we
  // can still look up the abbreviation).
  const byIana = new Map();
  for (const z of TZ_ABBR) {
    if (!byIana.has(z.iana)) byIana.set(z.iana, z);
  }
  // Full IANA list (Intl.supportedValuesOf provides ~600).
  let all = [];
  try { all = Intl.supportedValuesOf('timeZone'); } catch { all = []; }
  return { abbrs: TZ_ABBR.slice(), iana: all, byIana };
}

function findAbbrForIana(iana, byIana) {
  return byIana.get(iana) || null;
}

function fmtTimeFor(date, iana) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: iana, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
  } catch { return '—'; }
}
function fmtDateFor(date, iana) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: iana, weekday: 'short', day: '2-digit', month: 'short' }).format(date);
  } catch { return ''; }
}
function fmtFullFor(date, iana) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: iana, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  } catch { return '—'; }
}

export async function mount(root) {
  migrateLegacyPrefs();
  const { abbrs, iana, byIana } = buildAddCandidates();

  // Full datalist combines abbreviation entries (with descriptive labels)
  // and bare IANA names. Choosing an abbreviation enters its IANA value.
  const datalistOpts = [
    ...abbrs.map(a => `<option value="${esc(a.iana)}" label="${esc(a.abbr + ' · ' + a.name)}">${esc(a.abbr)} · ${esc(a.name)}</option>`),
    ...iana.filter(z => !abbrs.some(a => a.iana === z)).map(z => `<option value="${esc(z)}">${esc(z)}</option>`)
  ].join('');

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">World clock</h2>
    <div class="wc-mode-tabs" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button class="ftab active" data-mode="live">Live clocks</button>
      <button class="ftab" data-mode="compare">Compare a moment</button>
      <button class="ftab" data-mode="convert">Convert time</button>
      <button class="ftab" data-mode="browse">Browse abbreviations</button>
    </div>
    <div class="form-row" style="max-width:560px">
      <label>Add timezone — type abbreviation (e.g. <code>IST</code>) or IANA name</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <input type="text" id="tzInput" list="tzList" placeholder="IST · India Standard Time, or Asia/Kolkata" style="flex:1;min-width:220px;background:var(--card-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 10px;font-size:13px;font-family:inherit">
        <button class="btn primary" id="tzAdd">Add</button>
      </div>
      <datalist id="tzList">${datalistOpts}</datalist>
    </div>
    <div id="wcBody" style="margin-top:14px"></div>`;

  const body = root.querySelector('#wcBody');
  let mode = 'live';

  function setMode(m) {
    mode = m;
    for (const b of root.querySelectorAll('.wc-mode-tabs .ftab')) b.classList.toggle('active', b.dataset.mode === m);
    render();
  }
  root.querySelector('.wc-mode-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });

  // Add via abbreviation OR IANA. If user types a known abbreviation that
  // isn't in datalist as a value, we try to resolve it.
  root.querySelector('#tzAdd').addEventListener('click', () => {
    const input = root.querySelector('#tzInput');
    let v = input.value.trim();
    if (!v) return;
    // If the user typed an abbreviation directly, look it up.
    const upper = v.toUpperCase();
    if (TZ_BY_ABBR.has(upper) && !iana.includes(v)) {
      const matches = TZ_BY_ABBR.get(upper);
      if (matches.length === 1) v = matches[0].iana;
      else { toast('Ambiguous abbreviation — pick a specific entry from the list.', 'warn'); return; }
    }
    try { new Intl.DateTimeFormat('en', { timeZone: v }); }
    catch { toast('Unknown timezone: ' + v, 'error'); return; }
    const p = getPrefs();
    if ((p.clockZones || []).includes(v)) { toast('Already added', 'info'); return; }
    setPref('clockZones', [...(p.clockZones || []), v]);
    input.value = '';
    render();
  });

  function render() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (mode === 'live') renderLive();
    else if (mode === 'compare') renderCompare();
    else if (mode === 'convert') renderConvert();
    else if (mode === 'browse') renderBrowse();
  }

  // -------- Mode 1: Live --------
  function renderLive() {
    const draw = () => {
      if (!root.isConnected) { clearInterval(_timer); return; }
      const p = getPrefs();
      const now = new Date();
      const zones = p.clockZones || [];
      body.innerHTML = `<div id="wcGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">
        ${zones.map(z => {
          const a = findAbbrForIana(z, byIana);
          const offMin = offsetForZone(now, z);
          return `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
              <div style="font-size:13px;font-weight:600">
                ${a ? esc(a.abbr) : esc(z.split('/').pop().replace(/_/g,' '))}
                <span class="hint" style="font-weight:400;font-size:11px">${esc(fmtOffset(offMin))}</span>
              </div>
              <button class="btn sm ghost" data-rm="${esc(z)}" title="Remove">×</button>
            </div>
            <div style="font-family:'SF Mono',Consolas,monospace;font-size:24px;font-weight:600;color:var(--code);margin:6px 0 2px">${fmtTimeFor(now, z)}</div>
            <div style="font-size:11px;color:var(--text-3)">${fmtDateFor(now, z)}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:4px">${a ? esc(a.name) : esc(z)}</div>
            ${a ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${esc(a.regions)}</div>` : ''}
          </div>`;
        }).join('') || `<div class="page-empty" style="grid-column:1/-1">No zones. Add some above.</div>`}
      </div>`;
      body.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => removeZone(b.dataset.rm)));
    };
    draw();
    _timer = setInterval(draw, 1000);
  }

  // -------- Mode 2: Compare a single moment --------
  function renderCompare() {
    const p = getPrefs();
    const zones = p.clockZones || [];
    const def = new Date();
    const isoLocal = isoForLocalInput(def);
    body.innerHTML = `
      <div class="form-row" style="max-width:520px">
        <label>Reference moment (local time):</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="datetime-local" id="cmpAt" value="${isoLocal}" step="60">
          <button class="btn sm ghost" id="cmpNow">Now</button>
        </div>
      </div>
      <div id="cmpOut" style="margin-top:14px"></div>`;
    const draw = () => {
      const v = body.querySelector('#cmpAt').value;
      const d = v ? new Date(v) : new Date();
      body.querySelector('#cmpOut').innerHTML = renderMomentTable(d, zones, byIana);
    };
    body.querySelector('#cmpAt').addEventListener('input', draw);
    body.querySelector('#cmpNow').addEventListener('click', () => {
      body.querySelector('#cmpAt').value = isoForLocalInput(new Date());
      draw();
    });
    draw();
  }

  // -------- Mode 3: Convert time between zones --------
  function renderConvert() {
    const p = getPrefs();
    const zones = (p.clockZones || []);
    const fallbackSrc = zones[0] || 'UTC';
    const isoLocal = isoForLocalInput(new Date());
    body.innerHTML = `
      <div class="form-row" style="max-width:560px">
        <label>Source zone</label>
        <input type="text" id="cvSrc" list="tzList" value="${esc(fallbackSrc)}" style="background:var(--card-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 10px;font-size:13px;font-family:inherit;width:100%">
      </div>
      <div class="form-row" style="max-width:560px">
        <label>Time in source zone (the wall-clock time, not your local time):</label>
        <input type="datetime-local" id="cvAt" value="${isoLocal}" step="60">
      </div>
      <div class="form-row">
        <label>Target zones</label>
        <div class="hint">All zones in your saved list will be shown.</div>
      </div>
      <div id="cvOut" style="margin-top:14px"></div>`;

    const draw = () => {
      const src = body.querySelector('#cvSrc').value.trim();
      const at = body.querySelector('#cvAt').value;
      try { new Intl.DateTimeFormat('en', { timeZone: src }); } catch { body.querySelector('#cvOut').textContent = 'Unknown source zone.'; return; }
      // Treat the entered datetime-local as wall-clock in `src`. We compute
      // the UTC instant by reversing the source's offset at that moment.
      const wall = at ? new Date(at) : new Date();
      const wallAsUtc = new Date(Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate(), wall.getHours(), wall.getMinutes(), wall.getSeconds()));
      const offMin = offsetForZone(wallAsUtc, src);
      const utcInstant = new Date(wallAsUtc.getTime() - offMin * 60000);
      body.querySelector('#cvOut').innerHTML = renderMomentTable(utcInstant, zones.length ? zones : [src], byIana, src);
    };
    body.querySelector('#cvSrc').addEventListener('input', draw);
    body.querySelector('#cvAt').addEventListener('input', draw);
    draw();
  }

  // -------- Mode 4: Browse abbreviations --------
  function renderBrowse() {
    body.innerHTML = `
      <div class="form-row" style="max-width:480px">
        <label>Filter (abbreviation or country)</label>
        <input type="search" id="brQ" placeholder="e.g. IST or Australia">
      </div>
      <div id="brOut"></div>`;
    const draw = () => {
      const q = (body.querySelector('#brQ').value || '').trim().toLowerCase();
      const filtered = q
        ? TZ_ABBR.filter(t => t.abbr.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.regions.toLowerCase().includes(q) || t.iana.toLowerCase().includes(q))
        : TZ_ABBR;
      body.querySelector('#brOut').innerHTML = `
        <table class="lc-table" style="margin-top:8px;table-layout:fixed">
          <thead><tr>
            <th style="width:90px">Abbr</th>
            <th style="width:200px">Name</th>
            <th style="width:90px">UTC</th>
            <th style="width:170px">IANA</th>
            <th>Regions / Countries</th>
            <th style="width:60px"></th>
          </tr></thead>
          <tbody>
            ${filtered.map(t => `<tr>
              <td><code>${esc(t.abbr)}</code>${t.dstAbbr ? `<br><span class="hint">DST: ${esc(t.dstAbbr)}</span>` : ''}${t.ambiguousWith ? `<br><span class="hint" style="color:#b45309">⚠ ${esc(t.ambiguousWith)}</span>` : ''}</td>
              <td>${esc(t.name)}</td>
              <td><code>${esc(fmtOffset(t.offsetMinutes))}</code></td>
              <td><code>${esc(t.iana)}</code></td>
              <td>${esc(t.regions)}</td>
              <td><button class="btn sm" data-add="${esc(t.iana)}">Add</button></td>
            </tr>`).join('') || '<tr><td colspan="6" class="page-empty">No matches.</td></tr>'}
          </tbody>
        </table>`;
      body.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
        const v = b.dataset.add;
        const p = getPrefs();
        if ((p.clockZones || []).includes(v)) { toast('Already added', 'info'); return; }
        setPref('clockZones', [...(p.clockZones || []), v]);
        toast('Added ' + v, 'success');
      }));
    };
    body.querySelector('#brQ').addEventListener('input', draw);
    draw();
  }

  function removeZone(z) {
    const p = getPrefs();
    setPref('clockZones', (p.clockZones || []).filter(x => x !== z));
    render();
  }

  render();
}

function renderMomentTable(date, zones, byIana, sourceZone = null) {
  if (!zones || !zones.length) {
    return '<div class="page-empty">No zones to show. Add some above.</div>';
  }
  return `<table class="lc-table" style="margin-top:6px">
    <thead><tr><th>Zone</th><th>Abbr</th><th>UTC offset</th><th>Wall clock at this moment</th></tr></thead>
    <tbody>
      ${zones.map(z => {
        const a = byIana.get(z) || null;
        const off = offsetForZone(date, z);
        const isSrc = sourceZone === z;
        return `<tr${isSrc ? ' style="background:rgba(14,165,233,0.10)"' : ''}>
          <td><code>${z}</code>${a ? `<br><span class="hint">${a.regions}</span>` : ''}</td>
          <td>${a ? `<code>${a.abbr}</code><br><span class="hint">${a.name}</span>` : '<span class="hint">—</span>'}</td>
          <td><code>${fmtOffset(off)}</code></td>
          <td><strong>${fmtFullFor(date, z)}</strong></td>
        </tr>`;
      }).join('')}
    </tbody></table>
    <div class="hint" style="margin-top:6px">Same instant in UTC: <code>${date.toISOString()}</code></div>`;
}

// Format a Date for an <input type="datetime-local"> value. The browser
// expects local-wall-clock with no tz suffix.
function isoForLocalInput(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
