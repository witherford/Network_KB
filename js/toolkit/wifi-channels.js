// WIFI channels & frequencies reference — 2.4 / 5 / 6 GHz channel plans,
// colour-coded by usability (recommended / caution / avoid / new band).

import { esc, copyToClipboard } from '../utils.js';

// status: use (recommended) / dep (caution) / avoid / info (new band)
const CH_24 = [
  ['1',  '2412', 'Non-overlapping (with 6, 11)', 'use'],
  ['2',  '2417', 'Overlaps 1',  'avoid'],
  ['3',  '2422', 'Overlaps 1',  'avoid'],
  ['4',  '2427', 'Overlaps 1, 6', 'avoid'],
  ['5',  '2432', 'Overlaps 6',  'avoid'],
  ['6',  '2437', 'Non-overlapping (with 1, 11)', 'use'],
  ['7',  '2442', 'Overlaps 6',  'avoid'],
  ['8',  '2447', 'Overlaps 6, 11', 'avoid'],
  ['9',  '2452', 'Overlaps 11', 'avoid'],
  ['10', '2457', 'Overlaps 11', 'avoid'],
  ['11', '2462', 'Non-overlapping (with 1, 6)', 'use'],
  ['12', '2467', 'EU/JP only',  'dep'],
  ['13', '2472', 'EU/JP only',  'dep'],
  ['14', '2484', 'Japan, 802.11b only', 'dep']
];

const CH_5 = [
  ['UNII-1',  '36, 40, 44, 48',                              '5180–5240', 'No DFS — indoor/outdoor', 'use'],
  ['UNII-2A', '52, 56, 60, 64',                              '5260–5320', 'DFS required (radar)', 'dep'],
  ['UNII-2C', '100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144', '5500–5720', 'DFS required (radar)', 'dep'],
  ['UNII-3',  '149, 153, 157, 161, 165',                     '5745–5825', 'No DFS — higher power', 'use']
];

const CH_6 = [
  ['UNII-5', '1–93 (e.g. 1, 5, 9 … )',  '5925–6425', 'Wi-Fi 6E/7. LPI indoor + standard power (AFC)', 'info'],
  ['UNII-6', '97–113',                  '6425–6525', 'Wi-Fi 6E/7', 'info'],
  ['UNII-7', '117–185',                 '6525–6875', 'Wi-Fi 6E/7', 'info'],
  ['UNII-8', '189–233',                 '6875–7125', 'Wi-Fi 6E/7', 'info']
];

const WIDTHS = [
  ['20 MHz',  '2.4 / 5 / 6 GHz', 'Most robust; only sane width on 2.4 GHz', 'use'],
  ['40 MHz',  '5 / 6 GHz',       'Bonds 2 channels; avoid on 2.4 GHz', 'dep'],
  ['80 MHz',  '5 / 6 GHz',       'Wi-Fi 5+; good 5 GHz default in low density', 'use'],
  ['160 MHz', '5 / 6 GHz',       'Wi-Fi 5/6; limited non-DFS room on 5 GHz', 'dep'],
  ['320 MHz', '6 GHz only',      'Wi-Fi 7 (802.11be)', 'info']
];

const STATUS_LABEL = { use: 'Recommended', dep: 'Caution', avoid: 'Avoid', info: 'New band' };
function badge(s) { return `<span class="tk-badge ${s}">${STATUS_LABEL[s]}</span>`; }

function table(title, head, rows) {
  return `<h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">${esc(title)}</h3>
    <table class="tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}<th>Status</th><th style="width:36px"></th></tr></thead>
    <tbody>${rows.map(r => {
      const status = r[r.length - 1];
      const cells = r.slice(0, -1);
      return `<tr class="tk-row-${status}">${cells.map((c, j) => `<td class="${j === 0 ? 'mono' : ''}">${esc(c)}</td>`).join('')}<td>${badge(status)}</td><td><button class="btn sm ghost" data-copy="${esc(cells.join(' | '))}" title="Copy row">⧉</button></td></tr>`;
    }).join('')}</tbody></table>`;
}

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">WIFI channels & frequencies</h2>
    <p class="hint" style="margin-bottom:6px">Centre frequencies in MHz. Channel availability and power limits vary by regulatory domain (FCC / ETSI / etc.).</p>
    <div class="tk-legend">
      <span class="k"><span class="sw use"></span> Recommended</span>
      <span class="k"><span class="sw dep"></span> Caution (DFS / regional / overlap-prone width)</span>
      <span class="k"><span class="sw avoid"></span> Avoid (overlapping)</span>
      <span class="k"><span class="sw info"></span> New band (6 GHz)</span>
    </div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;margin:8px 0">
      <strong>Rule of thumb:</strong> on 2.4 GHz use only <code>1 / 6 / 11</code> at 20 MHz. DFS channels (UNII-2) may briefly go silent if radar is detected.
    </div>
    ${table('2.4 GHz channels', ['Ch', 'Centre (MHz)', 'Overlap notes'], CH_24)}
    ${table('5 GHz channels (UNII bands)', ['UNII band', 'Channels', 'Range (MHz)', 'Notes'], CH_5)}
    ${table('6 GHz channels (Wi-Fi 6E / 7)', ['UNII band', 'Channels', 'Range (MHz)', 'Notes'], CH_6)}
    ${table('Channel widths', ['Width', 'Bands', 'Guidance'], WIDTHS)}`;

  root.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    setTimeout(() => { btn.textContent = orig; }, 900);
  });
}
