// Cisco software version decoder — paste an IOS, IOS XE, NX-OS or ASA version
// string and get a component-by-component breakdown: major/minor release,
// maintenance/rebuild numbers, the IOS "train" letter and what it means, the
// IOS XE codename, and a plain-English lifecycle hint.

import { esc, copyToClipboard, toast } from '../utils.js';

// IOS Classic "train" letters. The train tells you the engineering intent of
// the release family (new features vs. long-term stability vs. platform).
const TRAINS = {
  '':   ['Mainline', 'Bug fixes only — no new features. The most stable classic train; longest support.'],
  'T':  ['Technology (T)', 'Adds new features and hardware support on top of the mainline. Shorter support window than mainline.'],
  'M':  ['Extended Maintenance (M)', 'Consolidated long-lived release (15.x). Recommended for production where you want stability + a long support life.'],
  'E':  ['Enterprise (E)', 'Enterprise switching/routing platforms (e.g. Catalyst).'],
  'S':  ['Service Provider (S)', 'High-end / service-provider routing (GSR, 7600, ASR).'],
  'SE': ['Catalyst fixed-config (SE)', 'Fixed-configuration Catalyst switches (e.g. 3560/3750).'],
  'SG': ['Catalyst 4500 (SG)', 'Catalyst 4500/4900 platform train.'],
  'SX': ['Catalyst 6500/7600 (SX)', 'Catalyst 6500 / 7600 platform train.'],
  'SY': ['Catalyst 6500 Sup2T (SY)', 'Catalyst 6500 Sup720/Sup2T platform train.'],
  'SR': ['7600 (SR)', 'Cisco 7600 platform train.'],
  'SB': ['10000/7200 (SB)', 'Cisco 10000 / 7200 / 7301 platform train.'],
  'SED':['Catalyst (SED)', 'Catalyst platform rebuild train.'],
  'XA': ['Special (XA)', 'Short-lived special/early-deployment train.'],
  'XB': ['Special (XB)', 'Short-lived special/early-deployment train.'],
  'XW': ['Special (XW)', 'Short-lived special/early-deployment train.'],
  'B':  ['Broadband (B)', 'Broadband aggregation feature train.'],
  'JA': ['Aironet (JA)', 'Aironet wireless platform train.'],
  'JX': ['Aironet (JX)', 'Aironet wireless platform train.'],
  'YA': ['Limited deployment (YA)', 'Limited / early-deployment train.']
};

// IOS XE 16.x / 17.x marketing codenames, keyed by "major.minor".
const XE_CODENAMES = {
  '16.1': 'Denali', '16.2': 'Denali', '16.3': 'Denali',
  '16.4': 'Everest', '16.5': 'Everest', '16.6': 'Everest',
  '16.7': 'Fuji', '16.8': 'Fuji', '16.9': 'Fuji',
  '16.10': 'Gibraltar', '16.11': 'Gibraltar', '16.12': 'Gibraltar',
  '17.1': 'Amsterdam', '17.2': 'Amsterdam', '17.3': 'Amsterdam',
  '17.4': 'Bengaluru', '17.5': 'Bengaluru', '17.6': 'Bengaluru',
  '17.7': 'Cupertino', '17.8': 'Cupertino', '17.9': 'Cupertino',
  '17.10': 'Dublin', '17.11': 'Dublin', '17.12': 'Dublin'
};

// IOS XE 17.x Extended Maintenance minors (the long-support, "gold star"
// releases Cisco recommends standardising on).
const XE_EM_MINORS = new Set(['16.6', '16.9', '16.12', '17.3', '17.6', '17.9', '17.12', '17.15']);

const SAMPLES = ['15.1(4)M12a', '12.4(15)T7', '17.9.4a', '16.12.07', '03.16.05.S', '9.3(5)', '9.16(3)19'];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Cisco software version decoder</h2>
    <p class="hint" style="margin-bottom:10px">Paste a Cisco software version (IOS, IOS XE, NX-OS or ASA). Get a breakdown of each component — release, maintenance/rebuild, the IOS <em>train</em> letter, IOS XE codename, and a lifecycle hint.</p>
    <div class="form-row">
      <label>Version string</label>
      <input type="text" id="cvIn" placeholder="e.g. 15.1(4)M12a  ·  17.9.4a  ·  9.3(5)" value="15.1(4)M12a" style="font-family:'SF Mono',Consolas,monospace">
    </div>
    <div class="form-row">
      <label>Quick examples</label>
      <select id="cvSample">
        <option value="">— pick a sample —</option>
        ${SAMPLES.map(s => `<option>${esc(s)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap">
      <button class="btn primary" id="cvGo">Decode</button>
      <button class="btn" id="cvCopy">Copy breakdown</button>
    </div>
    <div id="cvOut"></div>`;

  const $ = sel => root.querySelector(sel);

  function render() {
    const res = decodeVersion($('#cvIn').value);
    $('#cvOut').innerHTML = renderResult(res);
  }

  $('#cvGo').addEventListener('click', render);
  $('#cvIn').addEventListener('input', render);
  $('#cvSample').addEventListener('change', e => {
    if (e.target.value) { $('#cvIn').value = e.target.value; e.target.value = ''; render(); }
  });
  $('#cvCopy').addEventListener('click', () => {
    const res = decodeVersion($('#cvIn').value);
    if (!res.parts.length) { toast('Nothing to copy', 'error'); return; }
    const text = `${res.family}: ${res.input}\n` + res.parts.map(p => `  ${p.label}: ${p.value} — ${p.meaning}`).join('\n') +
      (res.lifecycle ? `\n\nLifecycle: ${res.lifecycle}` : '');
    copyToClipboard(text).then(ok => toast(ok ? 'Breakdown copied' : 'Copy failed', ok ? 'success' : 'error'));
  });

  render();
}

function renderResult(res) {
  if (res.error) return `<div class="page-empty" style="color:var(--danger,#dc2626)">${esc(res.error)}</div>`;
  if (!res.parts.length) return '<div class="page-empty">Enter a version to decode.</div>';
  const lifeColour = res.lifecycleKind === 'good' ? 'var(--ok,#16a34a)'
    : res.lifecycleKind === 'warn' ? 'var(--warn,#b45309)' : 'var(--muted,#94a3b8)';
  return `
    <div style="background:var(--card-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-weight:600">${esc(res.family)}</div>
      <div class="mono" style="font-size:13px;margin-top:2px">${esc(res.input)}</div>
    </div>
    <table class="tbl">
      <thead><tr><th>Component</th><th>Value</th><th>Meaning</th></tr></thead>
      <tbody>
        ${res.parts.map(p => `<tr>
          <td>${esc(p.label)}</td>
          <td class="mono">${esc(p.value)}</td>
          <td>${esc(p.meaning)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${res.lifecycle ? `<div style="margin-top:12px;padding:10px;border:1px solid var(--border);border-left:3px solid ${lifeColour};border-radius:6px;font-size:12.5px"><strong>Lifecycle:</strong> ${esc(res.lifecycle)}</div>` : ''}`;
}

// Detect the software family and break the string into labelled components.
export function decodeVersion(raw) {
  const input = String(raw).trim();
  if (!input) return { parts: [] };

  // IOS XE old-style: 3.x.y[Train] or 03.16.05.S
  let m = input.match(/^0?3\.(\d+)\.(\d+)\.?([A-Za-z]+)?$/);
  if (m) {
    const [, minor, patch, train] = m;
    const parts = [
      { label: 'Family / major', value: '3', meaning: 'IOS XE 3.x (first-generation IOS XE — ASR 1000, Catalyst 3850/3650, ISR 4000).' },
      { label: 'Minor release', value: minor, meaning: 'Feature release number within the 3.x line.' },
      { label: 'Maintenance/rebuild', value: patch, meaning: 'Maintenance rebuild — bug-fix level within this release.' }
    ];
    if (train) parts.push({ label: 'Train', value: train.toUpperCase(),
      meaning: train.toUpperCase().startsWith('S') ? 'S = Service-provider / ASR routing train.' : train.toUpperCase().startsWith('E') ? 'E = Enterprise / Catalyst switching train.' : 'Platform-specific train letter.' });
    return { family: 'Cisco IOS XE (3.x, first generation)', input, parts,
      lifecycle: 'IOS XE 3.x is end-of-life on most platforms — migrate to IOS XE 16.x/17.x.', lifecycleKind: 'warn' };
  }

  // IOS XE new-style: 16.x.y / 17.x.y with optional rebuild letter (17.9.4a)
  m = input.match(/^(16|17)\.(\d+)\.(\d+)([a-z])?$/);
  if (m) {
    const [, major, minor, patch, sub] = m;
    const mm = `${major}.${parseInt(minor, 10)}`;
    const codename = XE_CODENAMES[mm];
    const isEM = XE_EM_MINORS.has(mm);
    const parts = [
      { label: 'Family / major', value: major, meaning: `IOS XE ${major}.x (current-generation, unified IOS XE).` },
      { label: 'Minor release', value: minor, meaning: codename ? `Feature release. Codename "${codename}".` : 'Feature release number.' },
      { label: 'Maintenance', value: patch, meaning: 'Maintenance rebuild — cumulative bug fixes within this release.' }
    ];
    if (sub) parts.push({ label: 'Rebuild', value: sub, meaning: `Interim rebuild "${sub}" — a re-spin of the maintenance release for specific fixes.` });
    parts.push({ label: 'Release type', value: isEM ? 'Extended Maintenance' : 'Standard Maintenance',
      meaning: isEM ? 'Long-support "gold" release — Cisco recommends standardising on these.' : 'Shorter support window than the Extended Maintenance releases (e.g. x.3 / x.6 / x.9 / x.12).' });
    return { family: 'Cisco IOS XE (16.x / 17.x)', input, parts,
      lifecycle: isEM ? 'Extended Maintenance release — recommended for production, longest support life.'
        : 'Standard Maintenance release — fine for features, but an Extended Maintenance release (17.3/17.6/17.9/17.12/17.15) is preferred for long-term stability.',
      lifecycleKind: isEM ? 'good' : 'warn' };
  }

  // IOS Classic: 12.4(15)T7, 15.1(4)M12a, 11.x...
  m = input.match(/^(\d+)\.(\d+)\((\d+)([a-z]*)\)([A-Z]+)?(\d*)([a-z]*)$/);
  if (m && ['11', '12', '15'].includes(m[1])) {
    const [, major, minor, maint, maintSub, train, rebuild, rebuildSub] = m;
    const t = (train || '').toUpperCase();
    const trainInfo = TRAINS[t] || ['Platform train (' + t + ')', 'Platform-specific train letter.'];
    const parts = [
      { label: 'Major.minor release', value: `${major}.${minor}`, meaning: `IOS Classic ${major}.${minor} release.` },
      { label: 'Maintenance release', value: maint + (maintSub || ''), meaning: 'Maintenance/throttle number — the build within the release' + (maintSub ? `; "${maintSub}" is an interim respin.` : '.') },
      { label: 'Train', value: t || '(mainline)', meaning: `${trainInfo[0]} — ${trainInfo[1]}` }
    ];
    if (rebuild) parts.push({ label: 'Rebuild', value: rebuild + (rebuildSub || ''), meaning: 'Rebuild number — cumulative bug fixes on this train' + (rebuildSub ? `; "${rebuildSub}" is an interim respin.` : '.') });
    else if (rebuildSub) parts.push({ label: 'Rebuild', value: rebuildSub, meaning: 'Interim rebuild respin.' });
    return { family: 'Cisco IOS (Classic)', input, parts,
      lifecycle: 'IOS Classic (12.x/15.x) is legacy — most trains are past end-of-engineering. New deployments should use IOS XE 17.x.',
      lifecycleKind: 'warn' };
  }

  // ASA: 9.16(3)19 — the trailing interim build digits after the closing paren
  // are the tell-tale (NX-OS never has them). Checked before NX-OS to claim the
  // interim-build form; the bare 9.3(5) form falls through to NX-OS below.
  m = input.match(/^(\d+)\.(\d+)\((\d+)\)(\d+)$/);
  if (m && ['7', '8', '9'].includes(m[1])) {
    const [, major, minor, maint, interim] = m;
    const parts = [
      { label: 'Major.minor', value: `${major}.${minor}`, meaning: `Cisco ASA/FTD software ${major}.${minor} release.` },
      { label: 'Maintenance', value: maint, meaning: 'Maintenance release within the train.' },
      { label: 'Interim build', value: interim, meaning: 'Interim/patch build number — cumulative fixes on the maintenance release.' }
    ];
    return { family: 'Cisco ASA', input, parts,
      lifecycle: 'Check the ASA release notes — older 9.x trains reach end-of-support; 9.18/9.20+ are current at time of writing.', lifecycleKind: 'info' };
  }

  // NX-OS: 9.3(5), 10.2(3)F  (letter after paren = maintenance designator)
  m = input.match(/^(\d+)\.(\d+)\((\d+)([a-z]*)\)([A-Z]+)?$/);
  if (m && ['4', '5', '6', '7', '8', '9', '10', '11'].includes(m[1])) {
    const [, major, minor, maint, maintSub, desig] = m;
    const parts = [
      { label: 'Major.minor', value: `${major}.${minor}`, meaning: `Cisco NX-OS ${major}.${minor} release (Nexus).` },
      { label: 'Maintenance', value: maint + (maintSub || ''), meaning: 'Maintenance release' + (maintSub ? `; "${maintSub}" is an interim respin.` : '.') }
    ];
    if (desig) parts.push({ label: 'Designator', value: desig, meaning: `Release designator "${desig}" (e.g. F = feature release).` });
    return { family: 'Cisco NX-OS', input, parts,
      lifecycle: 'NX-OS release support varies by Nexus platform — verify against the platform release matrix.', lifecycleKind: 'info' };
  }

  return { error: `Unrecognised version format: "${input}". Expected IOS (15.1(4)M12a), IOS XE (17.9.4a), NX-OS (9.3(5)) or ASA (9.16(3)19).`, parts: [] };
}
