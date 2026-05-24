// Wireless signal reference guide — RSSI / SNR quality bands and noise floor notes.
// Offline reference. Thresholds are widely-used field guidelines (Cisco/Ekahau-style).

import { esc, copyToClipboard } from '../utils.js';

const RSSI = [
  ['-30 dBm', 'Amazing',   'Max achievable; only right next to the AP. Rarely seen.'],
  ['-50 dBm', 'Excellent', 'Anything ≥ -50 is excellent. Full data rates.'],
  ['-60 dBm', 'Good',      'Reliable for VoIP, video, most apps.'],
  ['-67 dBm', 'Min for VoIP/video', 'Cisco minimum for real-time / roaming-sensitive apps.'],
  ['-70 dBm', 'OK / data', 'Min for reliable packet delivery, web/email.'],
  ['-80 dBm', 'Poor',      'Unreliable; high retries, low rates.'],
  ['-90 dBm', 'Unusable',  'At/below noise floor; no useful connectivity.']
];

const SNR = [
  ['≥ 40 dB', 'Excellent', 'Supports highest MCS / data rates.'],
  ['25–40 dB', 'Very good', 'Fast and reliable.'],
  ['15–25 dB', 'Good / low-speed', 'Min ~20 dB for data, ~25 dB for VoIP/video.'],
  ['10–15 dB', 'Marginal', 'Frequent retries; rate drops.'],
  ['< 10 dB',  'No connection', 'Signal too close to noise floor.']
];

const NOISE = [
  ['Typical noise floor (5 GHz)', '-95 to -90 dBm', 'Lower (better) than 2.4 GHz — fewer non-Wi-Fi emitters.'],
  ['Typical noise floor (2.4 GHz)', '-92 to -85 dBm', 'Microwaves, BT, ZigBee, cordless phones raise it.'],
  ['SNR formula', 'SNR (dB) = RSSI − Noise floor', 'e.g. -65 dBm signal over -90 dBm noise = 25 dB SNR.'],
  ['Co-channel interference (CCI)', 'Same channel', 'APs/clients share airtime — measured, counts as Wi-Fi.'],
  ['Adjacent-channel interference (ACI)', 'Overlapping channels', 'Worse than CCI — energy bleeds across, treated as noise.']
];

const RULES = [
  ['Every -3 dB', 'Halves received power.'],
  ['Every -10 dB', 'Drops power to 1/10 (one order of magnitude).'],
  ['Double the distance', 'Roughly -6 dB (free-space path loss).'],
  ['Roaming target', 'Design cell edges around -67 dBm with ≥ 20% overlap.'],
  ['Sticky client fix', 'Lower min data rate / disable low rates so clients roam sooner.']
];

function table(title, head, rows) {
  return `<h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">${esc(title)}</h3>
    <table class="tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}<th style="width:36px"></th></tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, j) => `<td class="${j === 0 ? 'mono' : ''}">${esc(c)}</td>`).join('')}<td><button class="btn sm ghost" data-copy="${esc(r.join(' | '))}" title="Copy row">⧉</button></td></tr>`).join('')}</tbody></table>`;
}

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Wireless signal reference</h2>
    <p class="hint" style="margin-bottom:6px">RSSI is absolute power (dBm, negative — closer to 0 is stronger). SNR is the margin above the noise floor and is what actually drives data rate.</p>
    ${table('RSSI (signal strength) quality bands', ['RSSI', 'Quality', 'Notes'], RSSI)}
    ${table('SNR (signal-to-noise ratio) bands', ['SNR', 'Quality', 'Notes'], SNR)}
    ${table('Noise floor & interference', ['Item', 'Value', 'Notes'], NOISE)}
    ${table('Field rules of thumb', ['Rule', 'Effect'], RULES)}`;

  root.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    setTimeout(() => { btn.textContent = orig; }, 900);
  });
}
