// WIFI security & encryption reference — WEP through WPA3 and 802.1X/EAP types.
// Offline reference per IEEE 802.11 / Wi-Fi Alliance.

import { esc, copyToClipboard } from '../utils.js';

const PROTOCOLS = [
  ['WEP',          '1999', 'RC4 + CRC-32', '40 / 104-bit', 'Broken — trivially cracked. Never use.'],
  ['WPA (TKIP)',   '2003', 'RC4 + TKIP + MIC', '128-bit', 'Interim WEP fix. Deprecated, avoid.'],
  ['WPA2-Personal', '2004', 'AES-CCMP', '128-bit', 'PSK. Solid but vulnerable to offline PSK cracking + KRACK (patched).'],
  ['WPA2-Enterprise', '2004', 'AES-CCMP + 802.1X', '128-bit', 'Per-user auth via RADIUS/EAP. Enterprise standard.'],
  ['WPA3-Personal', '2018', 'AES-CCMP + SAE', '128-bit', 'SAE (Dragonfly) kills offline PSK cracking; forward secrecy.'],
  ['WPA3-Enterprise', '2018', 'AES-GCMP + 802.1X', '192-bit (optional)', 'Optional 192-bit Suite-B mode for high-security.'],
  ['OWE',          '2018', 'AES + Diffie-Hellman', '128-bit', 'Enhanced Open — encrypts open SSIDs, no auth (guest/captive).']
];

const EAP = [
  ['EAP-TLS',     'Client + server certs', 'Strongest. Mutual cert auth, no passwords. Needs PKI.'],
  ['PEAP-MSCHAPv2', 'Server cert + user/pass', 'Common in Windows shops; password inside TLS tunnel.'],
  ['EAP-TTLS',    'Server cert + inner auth', 'Like PEAP, flexible inner methods (PAP/MSCHAP).'],
  ['EAP-FAST',    'PAC (protected credential)', 'Cisco; tunnel via PAC instead of cert.'],
  ['EAP-PWD',     'Shared password', 'Password-based, resists dictionary attack.']
];

const TERMS = [
  ['PSK',  'Pre-Shared Key — single passphrase for the SSID (Personal mode).'],
  ['SAE',  'Simultaneous Authentication of Equals — WPA3 handshake replacing PSK 4-way.'],
  ['CCMP', 'Counter Mode CBC-MAC Protocol — AES-based, the WPA2 cipher.'],
  ['GCMP', 'Galois/Counter Mode Protocol — AES-based, faster, used by WPA3 192-bit.'],
  ['PMF / 802.11w', 'Protected Management Frames — mandatory in WPA3, blocks deauth attacks.'],
  ['Transition mode', 'WPA2/WPA3 mixed SSID for client compatibility — weakens WPA3 guarantees.'],
  ['802.1X', 'Port-based network access control; the framework Enterprise mode uses.']
];

function table(title, head, rows) {
  return `<h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">${esc(title)}</h3>
    <table class="tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}<th style="width:36px"></th></tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, j) => `<td class="${j === 0 ? 'mono' : ''}">${esc(c)}</td>`).join('')}<td><button class="btn sm ghost" data-copy="${esc(r.join(' | '))}" title="Copy row">⧉</button></td></tr>`).join('')}</tbody></table>`;
}

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">WIFI security & encryption</h2>
    <p class="hint" style="margin-bottom:6px">Use WPA3 where supported, WPA2-AES otherwise. Never use WEP or TKIP. Enterprise mode (802.1X) gives per-user credentials and revocation.</p>
    ${table('Security protocols', ['Protocol', 'Year', 'Cipher / method', 'Key size', 'Notes'], PROTOCOLS)}
    ${table('802.1X / EAP types (Enterprise)', ['EAP type', 'Credentials', 'Notes'], EAP)}
    ${table('Key terms', ['Term', 'Meaning'], TERMS)}`;

  root.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    setTimeout(() => { btn.textContent = orig; }, 900);
  });
}
