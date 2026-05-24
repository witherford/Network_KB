// Wireless standards cheat sheet — IEEE 802.11 generations and Wi-Fi Alliance
// names. Rows are colour-coded by whether the standard is in current use or
// legacy/retired. Feature cards carry schematic diagrams.

import { esc, copyToClipboard } from '../utils.js';
import { FEATURE_DIAGRAMS } from './wifi-diagrams.js';

// status: 'use' = deployed today, 'avoid' = legacy / not used in new networks.
const STANDARDS = [
  { gen: '—',       std: '802.11-1997', band: '2.4 GHz',          width: '22 MHz',        mod: 'DSSS / FHSS', maxrate: '2 Mbps',    mimo: '1×1',  year: '1997', status: 'avoid' },
  { gen: '—',       std: '802.11b',     band: '2.4 GHz',          width: '22 MHz',        mod: 'DSSS / CCK',  maxrate: '11 Mbps',   mimo: '1×1',  year: '1999', status: 'avoid' },
  { gen: '—',       std: '802.11a',     band: '5 GHz',            width: '20 MHz',        mod: 'OFDM',        maxrate: '54 Mbps',   mimo: '1×1',  year: '1999', status: 'avoid' },
  { gen: '—',       std: '802.11g',     band: '2.4 GHz',          width: '20 MHz',        mod: 'OFDM',        maxrate: '54 Mbps',   mimo: '1×1',  year: '2003', status: 'avoid' },
  { gen: 'Wi-Fi 4', std: '802.11n',     band: '2.4 / 5 GHz',      width: '20 / 40 MHz',   mod: 'OFDM',        maxrate: '600 Mbps',  mimo: '4×4',  year: '2009', status: 'dep' },
  { gen: 'Wi-Fi 5', std: '802.11ac',    band: '5 GHz',            width: '20–160 MHz',    mod: '256-QAM OFDM', maxrate: '6.9 Gbps', mimo: '8×8 MU-MIMO (DL)', year: '2013', status: 'use' },
  { gen: 'Wi-Fi 6', std: '802.11ax',    band: '2.4 / 5 GHz',      width: '20–160 MHz',    mod: '1024-QAM OFDMA', maxrate: '9.6 Gbps', mimo: '8×8 MU-MIMO (UL/DL)', year: '2019', status: 'use' },
  { gen: 'Wi-Fi 6E',std: '802.11ax',    band: '6 GHz (5.925–7.125)', width: '20–160 MHz', mod: '1024-QAM OFDMA', maxrate: '9.6 Gbps', mimo: '8×8 MU-MIMO', year: '2021', status: 'use' },
  { gen: 'Wi-Fi 7', std: '802.11be',    band: '2.4 / 5 / 6 GHz',  width: '20–320 MHz',    mod: '4096-QAM OFDMA', maxrate: '46 Gbps', mimo: '16×16 MU-MIMO, MLO', year: '2024', status: 'use' }
];

const STATUS_LABEL = { use: 'In use today', dep: 'Legacy — phasing out', avoid: 'Retired — not used' };
const STATUS_BADGE = { use: 'use', dep: 'dep', avoid: 'avoid' };

// key matches FEATURE_DIAGRAMS; color drives the card's left border.
const FEATURES = [
  { key: 'ofdma',    name: 'OFDMA',                  gen: 'Wi-Fi 6+', color: '#3b82f6', desc: 'Splits a channel into resource units (RUs) so multiple clients share one transmission — cuts latency in dense cells.' },
  { key: 'mumimo',   name: 'MU-MIMO',                gen: 'Wi-Fi 5 (DL) / 6 (UL+DL)', color: '#22c55e', desc: 'Sends multiple spatial streams to different clients simultaneously.' },
  { key: 'qam1024',  name: '1024-QAM',               gen: 'Wi-Fi 6', color: '#22c55e', desc: '10 bits/symbol — ~25% higher peak rate than 256-QAM, needs high SNR.' },
  { key: 'qam4096',  name: '4096-QAM',               gen: 'Wi-Fi 7', color: '#8b5cf6', desc: '12 bits/symbol — ~20% higher peak rate than 1024-QAM.' },
  { key: 'twt',      name: 'Target Wake Time',       gen: 'Wi-Fi 6', color: '#22c55e', desc: 'Schedules client wake intervals to save battery (IoT).' },
  { key: 'bsscolor', name: 'BSS Coloring',           gen: 'Wi-Fi 6', color: '#f59e0b', desc: 'Tags frames per-BSS so overlapping cells can reuse the channel.' },
  { key: 'width320', name: '320 MHz channels',       gen: 'Wi-Fi 7', color: '#8b5cf6', desc: '6 GHz only — double the Wi-Fi 6E max width.' },
  { key: 'mlo',      name: 'MLO (Multi-Link Operation)', gen: 'Wi-Fi 7', color: '#8b5cf6', desc: 'A single client aggregates/steers traffic across 2.4, 5 and 6 GHz links at once.' },
  { key: 'puncture', name: 'Preamble Puncturing',    gen: 'Wi-Fi 7', color: '#ef4444', desc: 'Uses a wide channel even when part of it is busy with interference.' }
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Wireless standards cheat sheet</h2>
    <p class="hint" style="margin-bottom:6px">IEEE 802.11 generations and Wi-Fi Alliance marketing names. Rates are theoretical PHY maxima.</p>
    <div class="tk-legend">
      <span class="k"><span class="sw use"></span> In use today</span>
      <span class="k"><span class="sw dep"></span> Legacy — phasing out (802.11n)</span>
      <span class="k"><span class="sw avoid"></span> Retired — not used in new networks</span>
    </div>
    <table class="tbl">
      <thead><tr>
        <th>Wi-Fi gen</th><th>802.11</th><th>Band(s)</th><th>Channel width</th>
        <th>Modulation</th><th>Max PHY rate</th><th>MIMO</th><th>Ratified</th><th>Status</th><th style="width:36px"></th>
      </tr></thead>
      <tbody>
        ${STANDARDS.map((s, i) => `<tr class="tk-row-${s.status}">
          <td style="font-weight:600">${esc(s.gen)}</td>
          <td class="mono">${esc(s.std)}</td>
          <td>${esc(s.band)}</td>
          <td>${esc(s.width)}</td>
          <td>${esc(s.mod)}</td>
          <td class="mono">${esc(s.maxrate)}</td>
          <td>${esc(s.mimo)}</td>
          <td>${esc(s.year)}</td>
          <td><span class="tk-badge ${STATUS_BADGE[s.status]}">${esc(STATUS_LABEL[s.status])}</span></td>
          <td><button class="btn sm ghost" data-row="${i}" title="Copy row">⧉</button></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:22px 0 4px;color:var(--muted)">Key features — what they do</h3>
    <p class="hint" style="margin-bottom:4px">Each card is colour-matched to its diagram to aid recall.</p>
    <div class="wifi-feat-grid">
      ${FEATURES.map(f => `<div class="wifi-feat" style="border-left-color:${f.color}">
        <h4>${esc(f.name)} <span class="tk-badge info">${esc(f.gen)}</span></h4>
        <div>${FEATURE_DIAGRAMS[f.key] || ''}</div>
        <div class="desc">${esc(f.desc)}</div>
      </div>`).join('')}
    </div>`;

  root.querySelectorAll('button[data-row]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = STANDARDS[+btn.dataset.row];
      const text = `${s.gen} | ${s.std} | ${s.band} | ${s.width} | ${s.mod} | ${s.maxrate} | ${s.mimo} | ${s.year} | ${STATUS_LABEL[s.status]}`;
      const ok = await copyToClipboard(text);
      const orig = btn.textContent;
      btn.textContent = ok ? '✓' : '✗';
      setTimeout(() => { btn.textContent = orig; }, 900);
    });
  });
}
