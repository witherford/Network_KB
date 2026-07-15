// Ethernet copper cabling cheat sheet — RJ45 (T568A / T568B) pinouts and
// straight-through vs crossover wiring, drawn as self-contained cartoon SVGs
// (no external images, works offline, colours are intentional so they render
// the same in light and dark theme).

const WIRE = { O: '#f97316', G: '#16a34a', B: '#2563eb', Br: '#8b5a2b' };

// pin = { n, c: base colour, s: striped (white/colour), name }
const T568B = [
  { n: 1, c: WIRE.O,  s: true,  name: 'White/Orange' },
  { n: 2, c: WIRE.O,  s: false, name: 'Orange' },
  { n: 3, c: WIRE.G,  s: true,  name: 'White/Green' },
  { n: 4, c: WIRE.B,  s: false, name: 'Blue' },
  { n: 5, c: WIRE.B,  s: true,  name: 'White/Blue' },
  { n: 6, c: WIRE.G,  s: false, name: 'Green' },
  { n: 7, c: WIRE.Br, s: true,  name: 'White/Brown' },
  { n: 8, c: WIRE.Br, s: false, name: 'Brown' }
];
const T568A = [
  { n: 1, c: WIRE.G,  s: true,  name: 'White/Green' },
  { n: 2, c: WIRE.G,  s: false, name: 'Green' },
  { n: 3, c: WIRE.O,  s: true,  name: 'White/Orange' },
  { n: 4, c: WIRE.B,  s: false, name: 'Blue' },
  { n: 5, c: WIRE.B,  s: true,  name: 'White/Blue' },
  { n: 6, c: WIRE.O,  s: false, name: 'Orange' },
  { n: 7, c: WIRE.Br, s: true,  name: 'White/Brown' },
  { n: 8, c: WIRE.Br, s: false, name: 'Brown' }
];

// A colour swatch: solid = full colour; striped = white with 3 colour bars.
function swatch(x, y, w, h, pin) {
  if (!pin.s) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${pin.c}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>`;
  }
  const bars = [0.22, 0.5, 0.78].map(f =>
    `<rect x="${(x + w * f - 1.6).toFixed(1)}" y="${y + 1.5}" width="3.2" height="${h - 3}" fill="${pin.c}"/>`).join('');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="#f5f5f5" stroke="rgba(0,0,0,.45)" stroke-width="1"/>${bars}`;
}

// Cartoon RJ45 plug with 8 gold contacts + a colour strip for the given standard.
function plugSvg(pins, title) {
  const sw = 22, gap = 4, n = pins.length;
  const stripW = n * sw + (n - 1) * gap;
  const ox = 46, oy = 40;
  const contacts = pins.map((p, i) => {
    const x = ox + i * (sw + gap);
    return `${swatch(x, oy, sw, 30, p)}
      <rect x="${x + 5}" y="${oy + 30}" width="${sw - 10}" height="14" fill="#e5b53a" stroke="rgba(0,0,0,.4)" stroke-width=".8"/>
      <text x="${x + sw / 2}" y="${oy + 58}" text-anchor="middle" font-size="12" fill="var(--text-2)" font-family="monospace">${p.n}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${stripW + 92} 128" width="100%" style="max-width:${stripW + 92}px" role="img" aria-label="${title} RJ45 pinout">
    <!-- housing -->
    <rect x="30" y="18" width="${stripW + 32}" height="66" rx="7" fill="rgba(150,170,200,.14)" stroke="var(--border-2)" stroke-width="1.4"/>
    <!-- latch tab -->
    <rect x="${30 + (stripW + 32) / 2 - 14}" y="10" width="28" height="12" rx="3" fill="rgba(150,170,200,.22)" stroke="var(--border-2)" stroke-width="1.2"/>
    <!-- cable stub -->
    <rect x="6" y="34" width="28" height="34" rx="6" fill="#5b6472"/>
    ${contacts}
    <text x="30" y="120" font-size="12.5" fill="var(--text)" font-weight="600">${title}</text>
  </svg>`;
}

// Wiring diagram: two vertical pin columns joined by coloured wires.
// map[i] = index in the right column that left pin i connects to.
function wiringSvg(leftPins, rightPins, map, leftLabel, rightLabel) {
  const top = 34, gap = 26, swW = 24, swH = 18;
  const leftX = 96, rightX = 356, colH = top + (leftPins.length - 1) * gap + swH;
  const rowY = i => top + i * gap;

  const wires = leftPins.map((p, i) => {
    const j = map[i];
    const y1 = rowY(i) + swH / 2, y2 = rowY(j) + swH / 2;
    const x1 = leftX + swW, x2 = rightX;
    const mx = (x1 + x2) / 2;
    const dash = p.s ? ' stroke-dasharray="7 4"' : '';
    // white casing under striped wires so the dashes read as white/colour
    const casing = p.s ? `<path d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="#f5f5f5" stroke-width="4.5"/>` : '';
    return `${casing}<path d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="${p.c}" stroke-width="3"${dash}/>`;
  }).join('');

  const col = (pins, x, side) => pins.map((p, i) => {
    const y = rowY(i);
    const num = `<text x="${side === 'L' ? x - 8 : x + swW + 8}" y="${y + swH - 4}" text-anchor="${side === 'L' ? 'end' : 'start'}" font-size="11" fill="var(--text-2)" font-family="monospace">${p.n}</text>`;
    return swatch(x, y, swW, swH, p) + num;
  }).join('');

  return `<svg viewBox="0 0 452 ${colH + 34}" width="100%" style="max-width:452px" role="img" aria-label="${leftLabel} to ${rightLabel} wiring">
    ${wires}
    ${col(leftPins, leftX, 'L')}
    ${col(rightPins, rightX, 'R')}
    <text x="${leftX + swW / 2}" y="20" text-anchor="middle" font-size="12" fill="var(--text)" font-weight="600">${leftLabel}</text>
    <text x="${rightX + swW / 2}" y="20" text-anchor="middle" font-size="12" fill="var(--text)" font-weight="600">${rightLabel}</text>
    <text x="226" y="${colH + 26}" text-anchor="middle" font-size="11.5" fill="var(--text-3)">Pairs on pins 1-2 / 3-6 are the two used at 10/100 Mbps · all four pairs at 1 Gbps+</text>
  </svg>`;
}

const IDENTITY = [0, 1, 2, 3, 4, 5, 6, 7];
const CROSSOVER = [2, 5, 0, 3, 4, 1, 6, 7]; // 1↔3, 2↔6 (TX/RX pair swap)

function pinoutTable(pins, title) {
  return `<table class="lc-table" style="font-size:12px">
    <thead><tr><th>Pin</th><th>Colour</th><th>Pair / signal (10/100)</th></tr></thead>
    <tbody>${pins.map(p => {
      const sig = p.n === 1 ? 'TX+' : p.n === 2 ? 'TX−' : p.n === 3 ? 'RX+' : p.n === 6 ? 'RX−' : '— (unused at 10/100)';
      return `<tr><td><code>${p.n}</code></td><td>${esc(p.name)}</td><td>${sig}</td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

export async function mount(root) {
  const card = 'background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;overflow-x:auto';
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:6px">Ethernet wiring — CAT5e / CAT6 (RJ45)</h2>
    <p class="hint" style="font-size:12px;margin-bottom:14px">The 8-pin RJ45 (8P8C) pinout for the two TIA-568 standards, and how they combine into straight-through and crossover cables. Colours below are the official conductor colours.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">Pinouts — T568A &amp; T568B</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
      <div style="${card}">${plugSvg(T568B, 'T568B (most common)')}${pinoutTable(T568B)}</div>
      <div style="${card}">${plugSvg(T568A, 'T568A')}${pinoutTable(T568A)}</div>
    </div>
    <p class="hint" style="font-size:11.5px;margin:8px 0 18px">The two standards only swap the orange and green pairs. Pick one and be consistent — <strong>T568B</strong> is the most common in the field.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">Straight-through cable</h3>
    <div style="${card};margin-bottom:6px">${wiringSvg(T568B, T568B, IDENTITY, 'T568B', 'T568B')}</div>
    <p class="hint" style="font-size:11.5px;margin:0 0 18px">Both ends wired to the <em>same</em> standard (B–B shown; A–A works too). Every pin goes straight across. Use for <strong>unlike devices</strong>: PC ↔ switch, switch ↔ router, AP ↔ switch.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">Crossover cable</h3>
    <div style="${card};margin-bottom:6px">${wiringSvg(T568B, T568A, CROSSOVER, 'T568B', 'T568A')}</div>
    <p class="hint" style="font-size:11.5px;margin:0 0 18px">One end T568B, the other T568A — the orange and green pairs cross so TX meets RX. Use for <strong>like devices</strong>: switch ↔ switch, PC ↔ PC, router ↔ router. Modern gear with <strong>Auto-MDI/MDIX</strong> auto-corrects, so a straight-through usually works regardless.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">When to use which</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:18px">
      <thead><tr><th>Connection</th><th>Cable</th></tr></thead>
      <tbody>
        <tr><td>PC / server ↔ switch or hub</td><td>Straight-through</td></tr>
        <tr><td>Router ↔ switch</td><td>Straight-through</td></tr>
        <tr><td>Switch ↔ switch (no Auto-MDIX)</td><td>Crossover</td></tr>
        <tr><td>PC ↔ PC direct</td><td>Crossover</td></tr>
        <tr><td>Router ↔ router direct</td><td>Crossover</td></tr>
        <tr><td>Anything with Auto-MDI/MDIX (Gigabit+)</td><td>Either — port adapts</td></tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">Category reference</h3>
    <table class="lc-table" style="font-size:12px">
      <thead><tr><th>Category</th><th>Max speed</th><th>Bandwidth</th><th>Max length</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>Cat5e</td><td>1 Gbps</td><td>100 MHz</td><td>100 m</td><td>Baseline for Gigabit</td></tr>
        <tr><td>Cat6</td><td>1 Gbps (10 Gbps ≤ 55 m)</td><td>250 MHz</td><td>100 m</td><td>Tighter crosstalk spec</td></tr>
        <tr><td>Cat6a</td><td>10 Gbps</td><td>500 MHz</td><td>100 m</td><td>Shielded; 10G to full length</td></tr>
        <tr><td>Cat7 / Cat8</td><td>10-40 Gbps</td><td>600 MHz-2 GHz</td><td>100 m / 30 m</td><td>Data-centre / shielded</td></tr>
      </tbody>
    </table>
    <p class="hint" style="font-size:11px;margin-top:10px">PoE runs over the same 4 pairs (all 8 conductors on 802.3bt / Type 3-4). Keep the twist right up to the connector — untwisting more than ~13 mm hurts high-speed and PoE performance.</p>`;
}

function esc(s) { return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
