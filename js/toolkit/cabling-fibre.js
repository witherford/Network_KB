// Fibre optic cabling cheat sheet — fibre grades (OS/OM) and the common
// connector types (LC, SC, ST, FC, MPO/MTP), drawn as self-contained cartoon
// SVGs. No external images; works offline; colours match the real jacket
// colour codes so they read the same in either theme.

// ---- Fibre cable cross-section: jacket + end-face showing core vs cladding ----
// coreR is scaled so single-mode (9µm) reads much thinner than multimode (50/62.5µm).
function cableSvg(jacket, coreColor, coreR) {
  return `<svg viewBox="0 0 250 92" width="100%" style="max-width:250px" role="img" aria-label="fibre cross-section">
    <rect x="8" y="31" width="150" height="30" rx="15" fill="${jacket}" stroke="rgba(0,0,0,.3)" stroke-width="1"/>
    <rect x="150" y="42" width="52" height="8" rx="4" fill="#dbe2ea"/>
    <circle cx="214" cy="46" r="26" fill="#eef2f7" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <circle cx="214" cy="46" r="18" fill="#cdd7e3"/>
    <circle cx="214" cy="46" r="${coreR}" fill="${coreColor}"/>
    <text x="214" y="88" text-anchor="middle" font-size="9.5" fill="var(--text-3)">core · cladding 125µm</text>
  </svg>`;
}

// ---- Connector cartoons (flat, recognisable silhouettes) ----
const BODY = '#c3ccd9', BODY2 = '#9aa6b6', FERRULE = '#f8fafc';

function lcSvg() { // small duplex push-latch, 1.25mm ferrule (two bodies clipped together)
  const mini = y => `
    <rect x="10" y="${y + 4}" width="14" height="22" rx="2" fill="${BODY2}"/>
    <rect x="22" y="${y}" width="30" height="30" rx="4" fill="${BODY}" stroke="rgba(0,0,0,.3)"/>
    <path d="M26 ${y} l5 -7 l4 0 l-2 7 z" fill="${BODY2}"/>
    <rect x="52" y="${y + 9}" width="12" height="12" rx="2" fill="${FERRULE}" stroke="rgba(0,0,0,.3)"/>`;
  return `<svg viewBox="0 0 150 100" width="100%" style="max-width:150px" role="img" aria-label="LC duplex connector">
    ${mini(16)}${mini(54)}
  </svg>`;
}

function scSvg() { // square push-pull, 2.5mm ferrule
  return `<svg viewBox="0 0 150 100" width="100%" style="max-width:150px" role="img" aria-label="SC connector">
    <rect x="14" y="30" width="20" height="40" rx="3" fill="${BODY2}"/>
    <rect x="32" y="22" width="52" height="56" rx="5" fill="${BODY}" stroke="rgba(0,0,0,.3)"/>
    <rect x="38" y="28" width="40" height="6" rx="2" fill="${BODY2}"/>
    <rect x="38" y="66" width="40" height="6" rx="2" fill="${BODY2}"/>
    <rect x="84" y="42" width="20" height="16" rx="2" fill="${FERRULE}" stroke="rgba(0,0,0,.3)"/>
    <rect x="104" y="46" width="10" height="8" rx="1" fill="#dbe2ea"/>
  </svg>`;
}

function stSvg() { // round bayonet twist-lock, 2.5mm ferrule
  return `<svg viewBox="0 0 150 100" width="100%" style="max-width:150px" role="img" aria-label="ST connector">
    <rect x="14" y="38" width="22" height="24" rx="3" fill="${BODY2}"/>
    <circle cx="66" cy="50" r="30" fill="${BODY}" stroke="rgba(0,0,0,.3)"/>
    <circle cx="66" cy="50" r="20" fill="${BODY2}"/>
    <rect x="62" y="14" width="8" height="12" rx="2" fill="${BODY2}"/>
    <circle cx="66" cy="50" r="8" fill="${FERRULE}" stroke="rgba(0,0,0,.3)"/>
    <rect x="96" y="44" width="16" height="12" rx="2" fill="${FERRULE}" stroke="rgba(0,0,0,.3)"/>
  </svg>`;
}

function fcSvg() { // round threaded screw, 2.5mm ferrule
  const teeth = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6, cx = 66, cy = 50, r = 30;
    return `<rect x="${(cx + Math.cos(a) * r - 2).toFixed(1)}" y="${(cy + Math.sin(a) * r - 2).toFixed(1)}" width="4" height="4" fill="${BODY2}" transform="rotate(${i * 30} ${cx} ${cy})"/>`;
  }).join('');
  return `<svg viewBox="0 0 150 100" width="100%" style="max-width:150px" role="img" aria-label="FC connector">
    <rect x="14" y="38" width="22" height="24" rx="3" fill="${BODY2}"/>
    ${teeth}
    <circle cx="66" cy="50" r="27" fill="${BODY}" stroke="rgba(0,0,0,.3)"/>
    <circle cx="66" cy="50" r="8" fill="${FERRULE}" stroke="rgba(0,0,0,.3)"/>
    <rect x="96" y="44" width="16" height="12" rx="2" fill="${FERRULE}" stroke="rgba(0,0,0,.3)"/>
  </svg>`;
}

function mpoSvg() { // rectangular multi-fibre, push-pull, 12 fibres
  const dots = Array.from({ length: 12 }, (_, i) =>
    `<circle cx="${30 + i * 7}" cy="50" r="2.4" fill="#5b6472"/>`).join('');
  return `<svg viewBox="0 0 150 100" width="100%" style="max-width:150px" role="img" aria-label="MPO connector">
    <rect x="12" y="36" width="18" height="28" rx="3" fill="${BODY2}"/>
    <rect x="26" y="26" width="96" height="48" rx="5" fill="${BODY}" stroke="rgba(0,0,0,.3)"/>
    <rect x="118" y="46" width="8" height="8" rx="1" fill="${BODY2}"/>
    <rect x="24" y="40" width="88" height="20" rx="3" fill="#eef2f7" stroke="rgba(0,0,0,.25)"/>
    ${dots}
  </svg>`;
}

function fig(svg, title, sub) {
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
    ${svg}
    <div style="font-weight:600;font-size:12.5px;margin-top:6px">${title}</div>
    <div class="hint" style="font-size:11px;margin-top:2px">${sub}</div>
  </div>`;
}

export async function mount(root) {
  const cell = 'background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center';
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:6px">Fibre cabling — types &amp; connectors</h2>
    <p class="hint" style="font-size:12px;margin-bottom:16px">Fibre grades carry a standard jacket colour and a core/cladding size; connectors differ by ferrule size and how they latch. Cartoons below are to scale in spirit — note the single-mode core is far thinner than multimode.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">Single-mode vs multimode</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:10px">
      <div style="${cell}">${cableSvg('#eab308', '#b45309', 3)}<div style="font-weight:600;font-size:12.5px;margin-top:4px">Single-mode (OS1/OS2)</div><div class="hint" style="font-size:11px">9µm core · yellow jacket · lasers · km reach</div></div>
      <div style="${cell}">${cableSvg('#f97316', '#7c2d12', 12)}<div style="font-weight:600;font-size:12.5px;margin-top:4px">Multimode (OM1/OM2)</div><div class="hint" style="font-size:11px">62.5/50µm core · orange jacket · LED/VCSEL</div></div>
      <div style="${cell}">${cableSvg('#22d3ee', '#155e75', 10)}<div style="font-weight:600;font-size:12.5px;margin-top:4px">Multimode (OM3/OM4)</div><div class="hint" style="font-size:11px">50µm laser-optimised · aqua jacket</div></div>
      <div style="${cell}">${cableSvg('#a3e635', '#3f6212', 10)}<div style="font-weight:600;font-size:12.5px;margin-top:4px">Multimode (OM5)</div><div class="hint" style="font-size:11px">50µm SWDM · lime-green jacket</div></div>
    </div>

    <table class="lc-table" style="font-size:12px;margin-bottom:20px">
      <thead><tr><th>Grade</th><th>Type</th><th>Core</th><th>Jacket</th><th>10G reach</th><th>Typical use</th></tr></thead>
      <tbody>
        <tr><td>OS1</td><td>Single-mode</td><td>9µm</td><td>Yellow</td><td>10 km</td><td>Indoor / campus backbone</td></tr>
        <tr><td>OS2</td><td>Single-mode</td><td>9µm</td><td>Yellow</td><td>10-40 km+</td><td>Outdoor / long-haul / WAN</td></tr>
        <tr><td>OM1</td><td>Multimode</td><td>62.5µm</td><td>Orange</td><td>33 m</td><td>Legacy building runs</td></tr>
        <tr><td>OM2</td><td>Multimode</td><td>50µm</td><td>Orange</td><td>82 m</td><td>Legacy 1G/10G</td></tr>
        <tr><td>OM3</td><td>Multimode</td><td>50µm</td><td>Aqua</td><td>300 m</td><td>Data centre 10/40/100G</td></tr>
        <tr><td>OM4</td><td>Multimode</td><td>50µm</td><td>Aqua</td><td>400 m</td><td>Data centre, longer reach</td></tr>
        <tr><td>OM5</td><td>Multimode</td><td>50µm</td><td>Lime</td><td>400 m+</td><td>SWDM / wideband DC</td></tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">Connectors</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin-bottom:10px">
      ${fig(lcSvg(), 'LC', 'Small form-factor · 1.25mm ferrule · push-latch · duplex · SFP/SFP+ &amp; DC')}
      ${fig(scSvg(), 'SC', 'Square · 2.5mm ferrule · push-pull “stick &amp; click” · patch panels')}
      ${fig(stSvg(), 'ST', 'Round bayonet · 2.5mm ferrule · twist-lock “stick &amp; twist” · legacy MMF')}
      ${fig(fcSvg(), 'FC', 'Round threaded screw · 2.5mm ferrule · vibration-proof · test/telco')}
      ${fig(mpoSvg(), 'MPO / MTP', 'Rectangular multi-fibre · 12/24 fibres · push-pull · 40/100G trunks')}
    </div>

    <table class="lc-table" style="font-size:12px;margin-bottom:18px">
      <thead><tr><th>Connector</th><th>Ferrule</th><th>Latch</th><th>Fibres</th><th>Where you'll see it</th></tr></thead>
      <tbody>
        <tr><td>LC</td><td>1.25 mm</td><td>Push (RJ-style clip)</td><td>1-2</td><td>SFP/SFP+/QSFP breakouts, modern DC</td></tr>
        <tr><td>SC</td><td>2.5 mm</td><td>Push-pull</td><td>1-2</td><td>Patch panels, GPON/FTTx, older switches</td></tr>
        <tr><td>ST</td><td>2.5 mm</td><td>Bayonet twist</td><td>1</td><td>Legacy multimode LANs</td></tr>
        <tr><td>FC</td><td>2.5 mm</td><td>Threaded screw</td><td>1</td><td>Test gear, telco, high-vibration</td></tr>
        <tr><td>MPO/MTP</td><td>Multi-fibre</td><td>Push-pull</td><td>8/12/24</td><td>40/100/400G trunks, spine-leaf</td></tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">Polish &amp; handling</h3>
    <ul class="hint" style="font-size:12px;margin:0;padding-left:18px;line-height:1.7">
      <li><strong>UPC (blue)</strong> — ultra-physical-contact, flat polish. General data use.</li>
      <li><strong>APC (green)</strong> — 8° angled polish, lowest back-reflection. FTTx / RF-over-glass / high-return-loss links. <em>Never mate APC to UPC.</em></li>
      <li>Duplex patch leads cross <strong>TX↔RX</strong> between the two ends (A-B polarity). Keep dust caps on and clean end-faces before every mate.</li>
      <li>Respect the <strong>minimum bend radius</strong> (~10× cable diameter) — tight bends cause macro-bend loss.</li>
    </ul>`;
}
