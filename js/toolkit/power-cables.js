// Power cabling cheat sheet — IEC 60320 appliance couplers (the "C numbers"),
// IEC 60309 "Commando" industrial connectors and the PDU input/output hardware
// they land on. All artwork is self-contained inline SVG (no external images,
// works offline) and is drawn face-on so the silhouettes are recognisable in
// either theme.

// ---------------------------------------------------------------------------
// IEC 60320 faces — drawn looking INTO the equipment inlet (the even, male
// half). The cable-mounted connector (odd, female) is the mirror of the same
// outline, so one drawing serves the pair.
// ---------------------------------------------------------------------------
const SHELL = 'rgba(150,170,200,.16)';
const EDGE  = 'var(--border-2)';
const PIN   = '#e5b53a';
const PINE  = '#4ea15c'; // earth contact

function pinRow(cx, cy, w, h, labels) {
  const gap = w + 14;
  return labels.map((lb, i) => {
    const x = cx + (i - (labels.length - 1) / 2) * gap - w / 2;
    const fill = lb === 'E' ? PINE : PIN;
    return `<rect x="${x.toFixed(1)}" y="${cy - h / 2}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
      <text x="${(x + w / 2).toFixed(1)}" y="${cy + h / 2 + 13}" text-anchor="middle" font-size="10.5" font-family="monospace" fill="var(--text-2)">${lb}</text>`;
  }).join('');
}

// C13/C14 outline — rectangle with both top corners chamfered (wider at the
// bottom), which is what stops it going in upside down.
function c13Path(notch) {
  const base = 'M22 96 L22 40 L38 24 L98 24 L114 40 L114 96';
  // C15/C16 add a groove/ridge in the centre of the bottom edge — the feature
  // that lets a C15 into a C14 inlet but keeps a C13 out of a C16.
  return notch
    ? `${base} L80 96 L80 88 L56 88 L56 96 Z`
    : `${base} Z`;
}

function c13Svg(notch, title) {
  return `<svg viewBox="0 0 136 124" width="100%" style="max-width:136px" role="img" aria-label="${title} face">
    <path d="${c13Path(notch)}" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.6" stroke-linejoin="round"/>
    ${pinRow(68, 54, 7, 20, ['L', 'E', 'N'])}
  </svg>`;
}

function c19Svg(title) {
  return `<svg viewBox="0 0 160 124" width="100%" style="max-width:160px" role="img" aria-label="${title} face">
    <path d="M14 92 L14 42 L26 30 L134 30 L146 42 L146 92 Z" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.6" stroke-linejoin="round"/>
    ${[['L', 34], ['E', 80], ['N', 126]].map(([lb, x]) =>
      `<rect x="${x - 15}" y="50" width="30" height="9" rx="1.5" fill="${lb === 'E' ? PINE : PIN}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
       <text x="${x}" y="78" text-anchor="middle" font-size="10.5" font-family="monospace" fill="var(--text-2)">${lb}</text>`).join('')}
  </svg>`;
}

// C5/C6 "cloverleaf" — one large lobe with two ears (the Mickey Mouse head).
function c5Svg() {
  return `<svg viewBox="0 0 136 124" width="100%" style="max-width:136px" role="img" aria-label="C5 C6 cloverleaf face">
    <g fill="${SHELL}" stroke="${EDGE}" stroke-width="1.6">
      <circle cx="46" cy="44" r="21"/><circle cx="90" cy="44" r="21"/><circle cx="68" cy="76" r="24"/>
    </g>
    <circle cx="46" cy="44" r="5.5" fill="${PIN}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
    <circle cx="90" cy="44" r="5.5" fill="${PIN}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
    <circle cx="68" cy="76" r="5.5" fill="${PINE}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
  </svg>`;
}

// C7/C8 "figure of 8" — two lobes, two contacts, no earth.
function c7Svg() {
  return `<svg viewBox="0 0 136 124" width="100%" style="max-width:136px" role="img" aria-label="C7 C8 figure of eight face">
    <g fill="${SHELL}" stroke="${EDGE}" stroke-width="1.6">
      <circle cx="48" cy="60" r="24"/><circle cx="88" cy="60" r="24"/>
    </g>
    <circle cx="48" cy="60" r="6" fill="${PIN}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
    <circle cx="88" cy="60" r="6" fill="${PIN}" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// "Which end goes where" — PDU outlet → cord → equipment inlet.
// ---------------------------------------------------------------------------
function chainSvg() {
  const Y = 44, H = 44, MID = Y + H / 2; // body band
  const rows = [MID - 12, MID - 2, MID + 8];
  const box = (x, label, sub) => `
    <rect x="${x}" y="${Y - 8}" width="118" height="${H + 16}" rx="8" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.4"/>
    <text x="${x + 59}" y="${MID - 2}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text)">${label}</text>
    <text x="${x + 59}" y="${MID + 15}" text-anchor="middle" font-size="10.5" fill="var(--text-3)">${sub}</text>`;
  // female = three recessed slots on the facing edge; male = three pins sticking out
  const slots = x => rows.map(y => `<rect x="${x}" y="${y}" width="13" height="5" rx="1" fill="rgba(0,0,0,.5)"/>`).join('');
  const pins  = x => rows.map(y => `<rect x="${x}" y="${y}" width="15" height="5" rx="1" fill="${PIN}" stroke="rgba(0,0,0,.35)" stroke-width=".7"/>`).join('');
  const endLabel = (x, name, sex) => `
    <text x="${x}" y="${Y + H + 26}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--text-2)" font-family="monospace">${name}</text>
    <text x="${x}" y="${Y + H + 40}" text-anchor="middle" font-size="10" fill="var(--text-3)">${sex}</text>`;
  return `<svg viewBox="0 0 640 132" width="100%" style="max-width:640px" role="img" aria-label="PDU to server power path">
    ${box(4, 'PDU', 'C13 outlet')}${slots(109)}
    ${box(518, 'Server / switch', 'C14 inlet')}${pins(503)}
    <!-- the cord: male C14 plug at the PDU end, female C13 connector at the kit end -->
    <rect x="186" y="${MID - 6}" width="266" height="12" rx="6" fill="#5b6472"/>
    <rect x="138" y="${Y}" width="50" height="${H}" rx="5" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.5"/>${pins(123)}
    <rect x="452" y="${Y}" width="50" height="${H}" rx="5" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.5"/>${slots(488)}
    ${endLabel(163, 'C14', 'male — pins')}
    ${endLabel(477, 'C13', 'female — sockets')}
    <text x="320" y="20" text-anchor="middle" font-size="11.5" fill="var(--text-3)">one “C14 to C13” cord — power flows left to right</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// IEC 60309 "Commando" — schematic socket face. The earth contact's clock
// position is the voltage key: a 400 V plug physically cannot enter a 230 V
// socket because the earth sits at a different angle.
// ---------------------------------------------------------------------------
function commandoSvg(colour, earthClock, contacts, title) {
  const cx = 70, cy = 70, R = 56, ring = 36;
  const ang = h => (h * 30 - 90) * Math.PI / 180; // 12 o'clock = up
  const eA = ang(earthClock);
  const ex = cx + ring * Math.cos(eA), ey = cy + ring * Math.sin(eA);
  // Remaining contacts sit evenly around the circle: with the earth they make
  // (n+1) equally spaced positions — a triangle for 3-pin, a pentagon for
  // 5-pin. Schematic; real spacing/diameters vary with the current rating.
  const step = 360 / (contacts.length + 1);
  const others = contacts.map((lb, i) => {
    const a = eA + (i + 1) * step * Math.PI / 180;
    const x = cx + ring * Math.cos(a), y = cy + ring * Math.sin(a);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9.5" fill="rgba(255,255,255,.9)" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
      <text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" font-size="9" font-family="monospace" fill="#1b2027">${lb}</text>`;
  }).join('');
  return `<svg viewBox="0 0 140 168" width="100%" style="max-width:140px" role="img" aria-label="${title}">
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="${colour}" stroke="rgba(0,0,0,.45)" stroke-width="1.6"/>
    <circle cx="${cx}" cy="${cy}" r="${R - 8}" fill="rgba(0,0,0,.16)"/>
    ${others}
    <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="11" fill="${PINE}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
    <text x="${ex.toFixed(1)}" y="${(ey + 4).toFixed(1)}" text-anchor="middle" font-size="10" font-family="monospace" fill="#fff">E</text>
    <!-- keyway rib on the rim, aligned with the earth contact: this is what
         stops a plug from another voltage band entering the socket -->
    <path d="M${(cx + (R - 2) * Math.cos(eA)).toFixed(1)} ${(cy + (R - 2) * Math.sin(eA)).toFixed(1)} L${(cx + (R - 9) * Math.cos(eA)).toFixed(1)} ${(cy + (R - 9) * Math.sin(eA)).toFixed(1)}" stroke="rgba(255,255,255,.9)" stroke-width="5" stroke-linecap="round"/>
    <text x="${cx}" y="150" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--text)">${title}</text>
    <text x="${cx}" y="163" text-anchor="middle" font-size="10" fill="var(--text-3)">earth at ${earthClock} o'clock</text>
  </svg>`;
}

function fig(svg, caption) {
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
    ${svg}<div class="hint" style="font-size:11px;margin-top:6px;line-height:1.5">${caption}</div></div>`;
}

export async function mount(root) {
  const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px';
  const card = 'background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;overflow-x:auto';

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:6px">Power cables — IEC couplers, Commando &amp; PDU hardware</h2>
    <p class="hint" style="font-size:12px;margin-bottom:16px">The “C numbers” are <strong>IEC 60320</strong> appliance couplers — the leads between a PDU and your kit. The round industrial plugs feeding the rack are <strong>IEC 60309</strong> (BS EN 60309 / CEE 17), universally called <em>Commando</em> after the MK trade name.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">The one rule that decodes every C number</h3>
    <div style="${card};margin-bottom:12px">
      <ul style="font-size:12.5px;margin:0;padding-left:18px;line-height:1.8">
        <li><strong>Odd number = connector</strong> — lives on the <em>end of a cable</em>, has recessed <strong>sockets (female)</strong>. C13, C15, C19…</li>
        <li><strong>Even number = inlet</strong> — mounted on the <em>equipment</em>, has exposed <strong>pins (male)</strong>. C14, C16, C20…</li>
        <li><strong>They mate in consecutive pairs</strong> — C13 ↔ C14, C15 ↔ C16, C19 ↔ C20. Odd always pushes onto the next even up.</li>
        <li>Live metal is never exposed on a powered part: the source end is always the female half.</li>
      </ul>
    </div>

    <div style="${grid}">
      ${fig(c13Svg(false, 'C13 C14'), '<strong>C13 / C14</strong><br>10 A · chamfered top corners · 3 pins in a row, earth centre')}
      ${fig(c13Svg(true, 'C15 C16'), '<strong>C15 / C16</strong><br>10 A · 120 °C · groove in the bottom edge keys it apart from C13')}
      ${fig(c19Svg('C19 C20'), '<strong>C19 / C20</strong><br>16 A · wide body · three horizontal blades')}
      ${fig(c5Svg(), '<strong>C5 / C6</strong><br>2.5 A · “cloverleaf” / “Mickey Mouse” · earthed laptop bricks')}
      ${fig(c7Svg(), '<strong>C7 / C8</strong><br>2.5 A · “figure of 8” · unearthed, class II only')}
    </div>
    <p class="hint" style="font-size:11px;margin:0 0 18px">Faces are drawn looking <em>into the equipment inlet</em> (the male half). The centre contact of an earthed coupler is always <strong>earth</strong> and is longer than the others — first to make, last to break.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">C-number reference</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:8px">
      <thead><tr><th>Pair</th><th>Nickname</th><th>Rating</th><th>Max temp</th><th>Pins</th><th>Where you'll meet it</th></tr></thead>
      <tbody>
        <tr><td><code>C1 / C2</code></td><td>Shaver</td><td>0.2 A · 250 V</td><td>70 °C</td><td>2</td><td>Shavers, clocks — never in a rack</td></tr>
        <tr><td><code>C5 / C6</code></td><td>Cloverleaf / Mickey Mouse</td><td>2.5 A · 250 V</td><td>70 °C</td><td>3 (earthed)</td><td>Laptop PSU bricks, projectors, PoE injectors, small AP power supplies</td></tr>
        <tr><td><code>C7 / C8</code></td><td>Figure of 8 / shotgun</td><td>2.5 A · 250 V</td><td>70 °C</td><td>2</td><td>Class II kit — media players, small unmanaged switches, consoles</td></tr>
        <tr><td><code>C13 / C14</code></td><td>“Kettle lead” (wrongly)</td><td>10 A · 250 V (15 A UL)</td><td>70 °C</td><td>3</td><td><strong>The workhorse.</strong> Servers, switches, routers, firewalls, UPS outputs, PDU outlets</td></tr>
        <tr><td><code>C15 / C16</code></td><td>Hot condition / notched</td><td>10 A · 250 V</td><td>120 °C</td><td>3</td><td>Actual kettles, and hot-running kit — many Cisco/HPE/Aruba PoE switches ship with C15 leads</td></tr>
        <tr><td><code>C15A / C16A</code></td><td>Extra-hot variant</td><td>10 A · 250 V</td><td>155 °C</td><td>3</td><td>Rare — high-temperature appliances</td></tr>
        <tr><td><code>C17 / C18</code></td><td>Unearthed C13</td><td>10 A · 250 V</td><td>70 °C</td><td>2</td><td>Class II gear — some TVs, consoles, desktop switches</td></tr>
        <tr><td><code>C19 / C20</code></td><td>Big brother</td><td>16 A · 250 V (20 A UL)</td><td>70 °C</td><td>3</td><td>Blade/chassis systems, core switches, big UPS, high-draw PDU outlets</td></tr>
        <tr><td><code>C21 / C22</code></td><td>Hot C19</td><td>16 A · 250 V</td><td>155 °C</td><td>3</td><td>High-temperature industrial equipment</td></tr>
        <tr><td><code>C23 / C24</code></td><td>Unearthed C19</td><td>16 A · 250 V</td><td>70 °C</td><td>2</td><td>Uncommon — class II high-draw appliances</td></tr>
      </tbody>
    </table>
    <p class="hint" style="font-size:11px;margin:0 0 18px">Ratings shown are the IEC figures used in the UK/EU. North American (UL/CSA) listings rate the same couplers higher — C13/C14 at 15 A and C19/C20 at 20 A — so a “15 A C13 lead” is a US part, not a different connector.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">Male / female — which end goes where</h3>
    <div style="${card};margin-bottom:6px">${chainSvg()}</div>
    <ul class="hint" style="font-size:12px;margin:0 0 18px;padding-left:18px;line-height:1.75">
      <li><strong>PDU outlets are C13/C19 shaped</strong> — female, because they are a source. The cord end that fills them is the male <strong>C14/C20</strong> plug.</li>
      <li><strong>Equipment inlets are C14/C20</strong> — male pins on the chassis. The cord end that pushes onto them is the female <strong>C13/C19</strong>.</li>
      <li>So a rack jumper is <strong>C14 → C13</strong> (or C20 → C19). Vendors list them both ways round (“C13 to C14” and “C14 to C13” are the same lead) — order by <em>what it plugs into at each end</em>, not by the word order.</li>
      <li>A <strong>C14 → C13</strong> lead is sometimes called an “extension” or “jumper”; a <strong>C20 → C13</strong> lead steps a 16 A outlet down to a 10 A device; a <strong>C14 → C19</strong> lead does not exist in any sane form — never feed a 16 A device from a 10 A outlet.</li>
      <li><strong>Wall socket → device</strong> leads (BS 1363 → C13, Schuko → C13, NEMA 5-15P → C13) are the “power lead in the box”. In a rack you usually bin these and use short C14 jumpers instead.</li>
    </ul>

    <h3 style="font-size:13px;margin:6px 0 8px">Keying, locking &amp; the gotchas</h3>
    <ul class="hint" style="font-size:12px;margin:0 0 18px;padding-left:18px;line-height:1.75">
      <li><strong>C15 fits a C14 inlet — C13 does not fit a C16 inlet.</strong> The C16 has a ridge in the bottom edge that only the C15's groove clears. If a lead “nearly” goes in and stops, you have a C13 on a C16 inlet: fetch a C15 lead, don't force it.</li>
      <li>Because a C15 is a higher-temperature part, using one where a C13 is specified is harmless. The reverse fails on hot equipment — the sheath can soften.</li>
      <li><strong>Locking leads</strong> (IEC Lock / V-Lock, P-Lock, vendor “SecureLock”) latch a C13/C19 onto an <em>ordinary</em> C14/C20 inlet — no special inlet needed, release with the lever. Cheap insurance against a lead being nudged out during rack work.</li>
      <li><strong>Colour-code the feeds</strong> — one colour for the A feed, another for B (red/blue and grey/black are the usual pairs) so a dual-corded box is obviously on two supplies at a glance.</li>
      <li><strong>Cable size</strong>: 10 A C13 leads are 3-core 1.0 mm² (18 AWG); 16 A C19 leads are 1.5 mm² (14 AWG). Thin 0.75 mm² “monitor leads” are 6 A parts — don't hang a server off one.</li>
      <li><strong>UK fusing</strong>: a moulded BS 1363 plug on an IEC lead should carry a <strong>5 A or 10 A</strong> fuse, not 13 A, unless the equipment says otherwise.</li>
      <li>C13 = <strong>2.3 kW</strong> max (10 A × 230 V); C19 = <strong>3.68 kW</strong> (16 A × 230 V). That is the ceiling for a single cord regardless of what the PDU can deliver.</li>
    </ul>

    <h3 style="font-size:13px;margin:6px 0 8px">IEC 60309 “Commando” — colours &amp; keying</h3>
    <p class="hint" style="font-size:12px;margin:0 0 10px">The housing colour tells you the voltage band, and the <strong>clock position of the earth contact</strong> physically keys it — you cannot plug a 400 V three-phase plug into a 230 V socket, by design. Ratings step 16 A → 32 A → 63 A → 125 A, and each rating is a physically different shell size, so a 16 A plug will not enter a 32 A socket either.</p>
    <div style="${grid}">
      ${fig(commandoSvg('#f5c400', 4, ['L1', 'L2'], 'Yellow 110 V'), '110 V site supply (55-0-55 centre-tapped) · 16/32 A · 3-pin')}
      ${fig(commandoSvg('#1f6fd0', 6, ['L', 'N'], 'Blue 230 V'), 'Single phase 230 V · 16/32/63 A · 2P+E · the common rack feed')}
      ${fig(commandoSvg('#d5342b', 6, ['L1', 'L2', 'L3', 'N'], 'Red 400 V'), 'Three phase 400 V · 16/32/63/125 A · 3P+N+E (5-pin)')}
    </div>
    <table class="lc-table" style="font-size:12px;margin-bottom:8px">
      <thead><tr><th>Colour</th><th>Voltage band</th><th>Earth clock</th><th>Typical use</th></tr></thead>
      <tbody>
        <tr><td><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#7c4dbd;margin-right:6px;vertical-align:-1px"></span>Violet</td><td>20–25 V</td><td>10 h</td><td>Extra-low-voltage tooling</td></tr>
        <tr><td><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#e8ecf1;border:1px solid rgba(0,0,0,.3);margin-right:6px;vertical-align:-1px"></span>White</td><td>40–50 V</td><td>12 h</td><td>Low-voltage specials</td></tr>
        <tr><td><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#f5c400;margin-right:6px;vertical-align:-1px"></span>Yellow</td><td>100–130 V</td><td>4 h</td><td>110 V site / construction transformers, US-spec kit</td></tr>
        <tr><td><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#1f6fd0;margin-right:6px;vertical-align:-1px"></span>Blue</td><td>200–250 V</td><td>6 h</td><td><strong>Single-phase rack &amp; PDU feeds</strong>, comms rooms, events</td></tr>
        <tr><td><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#d5342b;margin-right:6px;vertical-align:-1px"></span>Red</td><td>380–480 V</td><td>6 h</td><td><strong>Three-phase</strong> rack feeds, big UPS, chillers</td></tr>
        <tr><td><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#2b2f36;margin-right:6px;vertical-align:-1px"></span>Black</td><td>500–690 V</td><td>7 h</td><td>Heavy plant</td></tr>
        <tr><td><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#16a34a;margin-right:6px;vertical-align:-1px"></span>Green</td><td>Any, &gt;60 Hz</td><td>varies</td><td>400 Hz aviation / special-frequency supplies</td></tr>
      </tbody>
    </table>
    <p class="hint" style="font-size:11px;margin:0 0 12px">Clock positions are for the usual 50/60 Hz pole counts; the standard defines a different position for some pole/voltage combinations, so read the moulding rather than assuming. Pin counts: <strong>3-pin</strong> = 2P+E (line, neutral, earth), <strong>4-pin</strong> = 3P+E (three phases, no neutral), <strong>5-pin</strong> = 3P+N+E. Ingress protection is normally <strong>IP44</strong> (splashproof, indoor/rack) or <strong>IP67</strong> (watertight, outdoor/events).</p>

    <h3 style="font-size:13px;margin:6px 0 8px">What each feed is actually worth</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:8px">
      <thead><tr><th>Feed</th><th>Pins</th><th>Nameplate</th><th>Usable @ 80 %</th><th>Rough rack fit</th></tr></thead>
      <tbody>
        <tr><td>Blue 16 A · 230 V 1-phase</td><td>3</td><td>3.68 kW</td><td>2.94 kW</td><td>Comms cabinet, small rack</td></tr>
        <tr><td>Blue 32 A · 230 V 1-phase</td><td>3</td><td>7.36 kW</td><td>5.89 kW</td><td>Typical single-phase DC rack</td></tr>
        <tr><td>Blue 63 A · 230 V 1-phase</td><td>3</td><td>14.5 kW</td><td>11.6 kW</td><td>Dense single-phase rack</td></tr>
        <tr><td>Red 16 A · 400 V 3-phase</td><td>5</td><td>11.1 kW</td><td>8.9 kW</td><td>Mid-density rack</td></tr>
        <tr><td>Red 32 A · 400 V 3-phase</td><td>5</td><td>22.2 kW</td><td>17.7 kW</td><td>Standard high-density rack</td></tr>
        <tr><td>Red 63 A · 400 V 3-phase</td><td>5</td><td>43.6 kW</td><td>34.9 kW</td><td>Compute / GPU rack</td></tr>
        <tr><td>Red 125 A · 400 V 3-phase</td><td>5</td><td>86.6 kW</td><td>69.3 kW</td><td>Busbar / row-level distribution</td></tr>
      </tbody>
    </table>
    <p class="hint" style="font-size:11px;margin:0 0 18px">Single phase kW = A × 230 ÷ 1000. Three phase kW = A × 400 × 1.732 ÷ 1000. The 80 % figure is the continuous-load derate — size the rack to that, not to the nameplate, and remember a dual-fed rack must survive on <em>one</em> feed, so each side carries the whole load during maintenance.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">PDU hardware — inputs</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:18px">
      <thead><tr><th>Input</th><th>Rating</th><th>Found on</th></tr></thead>
      <tbody>
        <tr><td><code>C14</code> inlet</td><td>10 A</td><td>Small 1U strips and rack shelves — fed by a C13 lead from a bigger PDU or wall socket</td></tr>
        <tr><td><code>C20</code> inlet</td><td>16 A</td><td>1U/0U strips fed from a C19 outlet upstream or from a UPS</td></tr>
        <tr><td>Blue Commando 16 A (2P+E)</td><td>3.68 kW</td><td>Comms cabinets, small server rooms, event racks</td></tr>
        <tr><td>Blue Commando 32 A (2P+E)</td><td>7.36 kW</td><td>Standard single-phase data-centre rack PDU</td></tr>
        <tr><td>Red Commando 16/32 A (3P+N+E)</td><td>11.1 / 22.2 kW</td><td>Three-phase 0U PDUs, outlets banked per phase</td></tr>
        <tr><td>BS 1363 13 A plug</td><td>3.0 kW</td><td>Office/under-desk strips — fine for a switch, not for a rack</td></tr>
        <tr><td>Hardwired tails / gland</td><td>Any</td><td>Fixed installations and busbar tap-offs — no plug, terminated into an isolator</td></tr>
        <tr><td>NEMA L5-30P / L6-30P / L21-30P</td><td>US 30 A</td><td>North American racks (locking twist connectors — the US answer to Commando)</td></tr>
        <tr><td>Dual inlet (ATS PDU)</td><td>As above ×2</td><td>Automatic transfer switch — two feeds in, one bank out, for single-corded kit</td></tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">PDU hardware — outputs</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:8px">
      <thead><tr><th>Outlet</th><th>Max load</th><th>Feeds</th></tr></thead>
      <tbody>
        <tr><td><code>C13</code></td><td>10 A · 2.3 kW</td><td>The default. Switches, routers, firewalls, 1U/2U servers</td></tr>
        <tr><td><code>C19</code></td><td>16 A · 3.68 kW</td><td>Chassis switches, blade enclosures, storage shelves, big PSUs</td></tr>
        <tr><td><code>C21</code></td><td>16 A · 155 °C</td><td>Rare high-temperature outlet variant</td></tr>
        <tr><td>C13/C19 combination</td><td>16 A</td><td>Hybrid outlet accepting either plug — flexible builds, one outlet count</td></tr>
        <tr><td>Locking outlets (IEC Lock, P-Lock, vendor equivalents)</td><td>as base type</td><td>Retains the cord mechanically — worth specifying on anything you can't afford to unplug</td></tr>
        <tr><td>BS 1363 13 A / Schuko CEE 7/3</td><td>13 / 16 A</td><td>Mixed-use cabinets, KVM trays, test benches</td></tr>
        <tr><td>NEMA 5-15R / 5-20R / L6-20R</td><td>15–20 A</td><td>North American racks</td></tr>
      </tbody>
    </table>
    <ul class="hint" style="font-size:12px;margin:0 0 18px;padding-left:18px;line-height:1.75">
      <li><strong>Form factor</strong> — <em>0U vertical</em> strips run the height of the rack in the rear channel (most outlets, no U consumed); <em>1U/2U horizontal</em> mounts in the rack face, used where depth is tight.</li>
      <li><strong>Intelligence tiers</strong> — <em>basic</em> (dumb outlets) → <em>metered</em> (inlet current on a display) → <em>monitored</em> (SNMP/HTTP, per-outlet metering) → <em>switched</em> (remote power-cycle per outlet) → <em>ATS</em> (dual input, auto failover).</li>
      <li><strong>Outlet banks</strong> are usually protected by their own 10 A or 16 A breaker, and on three-phase PDUs each bank sits on a different phase — spread dual-PSU kit across banks to keep the phases balanced.</li>
      <li><strong>A/B feeds</strong> — dual-PSU equipment takes one cord from the A PDU and one from B, each on a separate upstream supply. Single-corded kit belongs behind an ATS PDU, never split across feeds with a Y-lead.</li>
      <li><strong>Never daisy-chain</strong> PDUs or strips, and don't convert a C13 outlet to a UK socket with an adapter — both defeat the breaker coordination the rack design relies on.</li>
    </ul>

    <p class="hint" style="font-size:11px;margin-top:4px">Standards for further reading: IEC 60320 (appliance couplers), IEC 60309-2 / BS EN 60309-2 (industrial plugs &amp; sockets), BS 1363 (UK 13 A plug), BS 7671 for the installation itself.</p>`;
}
