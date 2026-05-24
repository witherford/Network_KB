// WIFI security & encryption reference — WEP through WPA3, 802.1X/EAP types,
// recommended deployment combinations, all colour-coded use / deprecated / avoid.

import { esc, copyToClipboard } from '../utils.js';

// status: use (green) / dep (amber) / avoid (red)
const RECOMMENDED = [
  ['Home / SOHO',            'WPA3-Personal (SAE), AES-CCMP, PMF required', 'use',  'Falls back to WPA2/WPA3 transition only if old clients exist.'],
  ['Enterprise / corporate', 'WPA2/WPA3-Enterprise + 802.1X + EAP-TLS (RADIUS)', 'use', 'Per-user certs, no shared secret. NPS or ISE back-end.'],
  ['High security / gov',    'WPA3-Enterprise 192-bit (CNSA) + EAP-TLS', 'use', 'AES-GCMP-256, Suite-B. Strict cert validation.'],
  ['Guest / public',         'Enhanced Open (OWE) or captive portal over OWE', 'use', 'Encrypts open SSIDs without a password.'],
  ['Legacy IoT (no WPA3)',   'WPA2-Personal AES on an isolated VLAN/SSID', 'dep', 'Segregate; disable TKIP; long random PSK.'],
  ['Anything with TKIP/WEP', 'WEP or WPA-TKIP', 'avoid', 'Trivially broken. Replace the hardware if it cannot do AES.']
];

const PROTOCOLS = [
  ['WEP',             '1999', 'RC4 + CRC-32',         '40 / 104-bit',     'avoid', 'Broken — cracked in minutes. Never use.'],
  ['WPA (TKIP)',      '2003', 'RC4 + TKIP + MIC',     '128-bit',          'avoid', 'Interim WEP fix. Deprecated by Wi-Fi Alliance.'],
  ['WPA2-Personal',   '2004', 'AES-CCMP (PSK)',       '128-bit',          'use',   'Solid; vulnerable to offline PSK cracking. Use long PSK + PMF.'],
  ['WPA2-Enterprise', '2004', 'AES-CCMP + 802.1X',    '128-bit',          'use',   'Per-user auth via RADIUS/EAP. Enterprise baseline.'],
  ['WPA3-Personal',   '2018', 'AES-CCMP + SAE',       '128-bit',          'use',   'SAE (Dragonfly) blocks offline PSK cracking; forward secrecy.'],
  ['WPA3-Enterprise', '2018', 'AES-GCMP + 802.1X',    '128 / 192-bit',    'use',   'Optional 192-bit Suite-B mode for high-security networks.'],
  ['OWE (Enhanced Open)', '2018', 'AES + Diffie-Hellman', '128-bit',      'use',   'Encrypts open SSIDs, no auth — ideal for guest.']
];

// NPS = Microsoft NPS, ISE = Cisco ISE. yes/no per native support.
const EAP = [
  ['EAP-TLS',        'Client + server certs',       'use',   'yes', 'yes', 'Strongest. Mutual cert auth, no passwords. Needs PKI.'],
  ['PEAP-MSCHAPv2',  'Server cert + user/password', 'use',   'yes', 'yes', 'Common in Windows shops; password inside TLS tunnel.'],
  ['EAP-TTLS',       'Server cert + inner auth',    'use',   'no',  'yes', 'Flexible inner methods. Not native on NPS.'],
  ['EAP-FAST',       'PAC (protected credential)',  'dep',   'no',  'yes', 'Cisco; superseded by EAP-TLS/TEAP. ISE only.'],
  ['EAP-PWD',        'Shared password',             'dep',   'no',  'yes', 'Niche; resists dictionary attack. ISE only.'],
  ['LEAP',           'Cisco legacy password',       'avoid', 'no',  'no',  'Cracked (asleap). Do not deploy.']
];

const TERMS = [
  ['PSK',  'Pre-Shared Key — single passphrase for the SSID (Personal mode).'],
  ['SAE',  'Simultaneous Authentication of Equals — WPA3 handshake replacing the PSK 4-way.'],
  ['CCMP', 'Counter Mode CBC-MAC Protocol — AES-based, the WPA2 cipher.'],
  ['GCMP', 'Galois/Counter Mode Protocol — AES-based, faster, used by WPA3 192-bit.'],
  ['PMF / 802.11w', 'Protected Management Frames — mandatory in WPA3; blocks deauth attacks.'],
  ['Transition mode', 'WPA2/WPA3 mixed SSID for compatibility — weakens WPA3 guarantees.'],
  ['802.1X', 'Port-based network access control; the framework Enterprise mode uses.'],
  ['NPS / ISE', 'Microsoft Network Policy Server / Cisco Identity Services Engine — the RADIUS servers that terminate 802.1X.']
];

const STATUS_LABEL = { use: 'Use', dep: 'Deprecated', avoid: 'Avoid' };

function badge(status) { return `<span class="tk-badge ${status}">${STATUS_LABEL[status]}</span>`; }
function yesno(v) { return v === 'yes' ? '<span class="tk-badge yes">Compatible</span>' : '<span class="tk-badge no">Not native</span>'; }

function copyBtn(text) { return `<button class="btn sm ghost" data-copy="${esc(text)}" title="Copy row">⧉</button>`; }

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">WIFI security & encryption</h2>
    <p class="hint" style="margin-bottom:6px">Use WPA3 where supported, WPA2-AES otherwise. Never use WEP or TKIP. Enterprise mode (802.1X) gives per-user credentials and revocation.</p>
    <div class="tk-legend">
      <span class="k"><span class="sw use"></span> Use</span>
      <span class="k"><span class="sw dep"></span> Deprecated</span>
      <span class="k"><span class="sw avoid"></span> Avoid</span>
    </div>

    <h3 style="font-size:13px;margin:14px 0 6px;color:var(--muted)">Recommended combinations</h3>
    <table class="tbl">
      <thead><tr><th>Scenario</th><th>Recommended setup</th><th>Verdict</th><th>Notes</th><th style="width:36px"></th></tr></thead>
      <tbody>
        ${RECOMMENDED.map(r => `<tr class="tk-row-${r[2]}">
          <td style="font-weight:600">${esc(r[0])}</td>
          <td>${esc(r[1])}</td>
          <td>${badge(r[2])}</td>
          <td class="hint" style="font-size:11.5px">${esc(r[3])}</td>
          <td>${copyBtn(`${r[0]}: ${r[1]}`)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:20px 0 6px;color:var(--muted)">Security protocols</h3>
    <table class="tbl">
      <thead><tr><th>Protocol</th><th>Year</th><th>Cipher / method</th><th>Key size</th><th>Status</th><th>Notes</th><th style="width:36px"></th></tr></thead>
      <tbody>
        ${PROTOCOLS.map(r => `<tr class="tk-row-${r[4]}">
          <td style="font-weight:600">${esc(r[0])}</td>
          <td>${esc(r[1])}</td>
          <td>${esc(r[2])}</td>
          <td class="mono">${esc(r[3])}</td>
          <td>${badge(r[4])}</td>
          <td class="hint" style="font-size:11.5px">${esc(r[5])}</td>
          <td>${copyBtn(`${r[0]} | ${r[2]} | ${r[3]} | ${STATUS_LABEL[r[4]]}`)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:20px 0 6px;color:var(--muted)">802.1X / EAP types (Enterprise)</h3>
    <table class="tbl">
      <thead><tr><th>EAP type</th><th>Credentials</th><th>Status</th><th>MS NPS</th><th>Cisco ISE</th><th>Notes</th><th style="width:36px"></th></tr></thead>
      <tbody>
        ${EAP.map(r => `<tr class="tk-row-${r[2]}">
          <td style="font-weight:600">${esc(r[0])}</td>
          <td>${esc(r[1])}</td>
          <td>${badge(r[2])}</td>
          <td>${yesno(r[3])}</td>
          <td>${yesno(r[4])}</td>
          <td class="hint" style="font-size:11.5px">${esc(r[5])}</td>
          <td>${copyBtn(`${r[0]} | ${STATUS_LABEL[r[2]]} | NPS:${r[3]} | ISE:${r[4]}`)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:20px 0 6px;color:var(--muted)">Key terms</h3>
    <table class="tbl">
      <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
      <tbody>${TERMS.map(t => `<tr><td class="mono" style="font-weight:600">${esc(t[0])}</td><td>${esc(t[1])}</td></tr>`).join('')}</tbody>
    </table>`;

  root.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    setTimeout(() => { btn.textContent = orig; }, 900);
  });
}
