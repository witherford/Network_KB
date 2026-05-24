// Wireless standards cheat sheet — IEEE 802.11 generations and Wi-Fi Alliance names.
// Offline reference. Rates are theoretical PHY maxima (single-stream unless noted).

import { esc, copyToClipboard } from '../utils.js';

const STANDARDS = [
  { gen: '—',       std: '802.11-1997', band: '2.4 GHz',          width: '22 MHz',        mod: 'DSSS / FHSS', maxrate: '2 Mbps',    mimo: '1×1',  year: '1997' },
  { gen: '—',       std: '802.11b',     band: '2.4 GHz',          width: '22 MHz',        mod: 'DSSS / CCK',  maxrate: '11 Mbps',   mimo: '1×1',  year: '1999' },
  { gen: '—',       std: '802.11a',     band: '5 GHz',            width: '20 MHz',        mod: 'OFDM',        maxrate: '54 Mbps',   mimo: '1×1',  year: '1999' },
  { gen: '—',       std: '802.11g',     band: '2.4 GHz',          width: '20 MHz',        mod: 'OFDM',        maxrate: '54 Mbps',   mimo: '1×1',  year: '2003' },
  { gen: 'Wi-Fi 4', std: '802.11n',     band: '2.4 / 5 GHz',      width: '20 / 40 MHz',   mod: 'OFDM',        maxrate: '600 Mbps',  mimo: '4×4',  year: '2009' },
  { gen: 'Wi-Fi 5', std: '802.11ac',    band: '5 GHz',            width: '20–160 MHz',    mod: '256-QAM OFDM', maxrate: '6.9 Gbps', mimo: '8×8 MU-MIMO (DL)', year: '2013' },
  { gen: 'Wi-Fi 6', std: '802.11ax',    band: '2.4 / 5 GHz',      width: '20–160 MHz',    mod: '1024-QAM OFDMA', maxrate: '9.6 Gbps', mimo: '8×8 MU-MIMO (UL/DL)', year: '2019' },
  { gen: 'Wi-Fi 6E',std: '802.11ax',    band: '6 GHz (5.925–7.125)', width: '20–160 MHz', mod: '1024-QAM OFDMA', maxrate: '9.6 Gbps', mimo: '8×8 MU-MIMO', year: '2021' },
  { gen: 'Wi-Fi 7', std: '802.11be',    band: '2.4 / 5 / 6 GHz',  width: '20–320 MHz',    mod: '4096-QAM OFDMA', maxrate: '46 Gbps', mimo: '16×16 MU-MIMO, MLO', year: '2024' }
];

const FEATURES = [
  ['OFDMA',          'Wi-Fi 6+', 'Splits a channel into resource units (RUs) so multiple clients share one transmission — cuts latency in dense cells.'],
  ['MU-MIMO',        'Wi-Fi 5 (DL) / 6 (UL+DL)', 'Multiple spatial streams to different clients simultaneously.'],
  ['1024-QAM',       'Wi-Fi 6', '10 bits/symbol — ~25% higher peak rate than 256-QAM, needs high SNR.'],
  ['4096-QAM',       'Wi-Fi 7', '12 bits/symbol — ~20% higher peak rate than 1024-QAM.'],
  ['Target Wake Time', 'Wi-Fi 6', 'Schedules client wake intervals to save battery (IoT).'],
  ['BSS Coloring',   'Wi-Fi 6', 'Tags frames per-BSS so overlapping cells can reuse the channel.'],
  ['320 MHz channels', 'Wi-Fi 7', '6 GHz only — double the Wi-Fi 6E max width.'],
  ['MLO (Multi-Link Operation)', 'Wi-Fi 7', 'A single client aggregates/steers traffic across 2.4, 5 and 6 GHz links at once.'],
  ['Preamble Puncturing', 'Wi-Fi 7', 'Uses a wide channel even when part of it is busy with interference.']
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Wireless standards cheat sheet</h2>
    <p class="hint" style="margin-bottom:12px">IEEE 802.11 generations and Wi-Fi Alliance marketing names. Rates are theoretical PHY maxima.</p>
    <table class="tbl">
      <thead><tr>
        <th>Wi-Fi gen</th><th>802.11</th><th>Band(s)</th><th>Channel width</th>
        <th>Modulation</th><th>Max PHY rate</th><th>MIMO</th><th>Ratified</th><th style="width:36px"></th>
      </tr></thead>
      <tbody>
        ${STANDARDS.map((s, i) => `<tr>
          <td style="font-weight:600">${esc(s.gen)}</td>
          <td class="mono">${esc(s.std)}</td>
          <td>${esc(s.band)}</td>
          <td>${esc(s.width)}</td>
          <td>${esc(s.mod)}</td>
          <td class="mono">${esc(s.maxrate)}</td>
          <td>${esc(s.mimo)}</td>
          <td>${esc(s.year)}</td>
          <td><button class="btn sm ghost" data-row="${i}" title="Copy row">⧉</button></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:20px 0 6px;color:var(--muted)">Key features by generation</h3>
    <table class="tbl">
      <thead><tr><th>Feature</th><th>Introduced</th><th>What it does</th></tr></thead>
      <tbody>
        ${FEATURES.map(f => `<tr>
          <td style="font-weight:600">${esc(f[0])}</td>
          <td>${esc(f[1])}</td>
          <td>${esc(f[2])}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  root.querySelectorAll('button[data-row]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = STANDARDS[+btn.dataset.row];
      const text = `${s.gen} | ${s.std} | ${s.band} | ${s.width} | ${s.mod} | ${s.maxrate} | ${s.mimo} | ${s.year}`;
      const ok = await copyToClipboard(text);
      const orig = btn.textContent;
      btn.textContent = ok ? '✓' : '✗';
      setTimeout(() => { btn.textContent = orig; }, 900);
    });
  });
}
