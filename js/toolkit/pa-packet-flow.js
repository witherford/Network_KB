// PAN-OS packet flow / "Day in the Life of a Packet" reference page.
//
// Renders an inline-SVG schematic that mirrors the official Palo Alto
// Networks packet-flow diagram from the Live Community article
// "Day in the Life of a Packet" (PAN-OS packet-flow sequence). The SVG is
// re-drawn locally — we don't hot-link the PA-hosted image — and a credited
// link back to the source is shown beneath. The flow stages and ordering are
// taken from the official PAN-OS packet-flow documentation.

import { esc } from '../utils.js';

const SOURCE_URL = 'https://live.paloaltonetworks.com/t5/community-blogs/day-in-the-life-of-a-packet-pan-os/ba-p/270726';
const IMAGE_URL  = 'https://live.paloaltonetworks.com//t5/image/serverpage/image-id/12862i950F549C7D4E6309';

// Colour palette (chosen to read on both light and dark themes — the SVG
// background is var(--card-2) and text labels use currentColor where possible).
const C = {
  ingress: '#0ea5e9',   // cyan-ish — physical / parse
  decision:'#f59e0b',   // amber — decision diamonds
  slow:    '#8b5cf6',   // purple — slow-path setup
  fast:    '#22c55e',   // green — fast-path
  appid:   '#3b82f6',   // blue — App-ID
  content: '#ef4444',   // red — Content-ID / threat
  egress:  '#06b6d4',   // teal — egress transform/forward
  border:  'rgba(148,163,184,.6)'
};

// One reusable arrow marker.
const DEFS = `
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="currentColor"/>
    </marker>
  </defs>`;

// Helpers: rounded box and text label.
function box(x, y, w, h, fill, title, sub) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"
          fill="${fill}" fill-opacity="0.18" stroke="${fill}" stroke-width="1.5"/>
    <text x="${x + w / 2}" y="${y + 17}" text-anchor="middle"
          fill="currentColor" font-size="12" font-weight="700">${title}</text>
    ${sub ? `<text x="${x + w / 2}" y="${y + 34}" text-anchor="middle"
              fill="currentColor" fill-opacity="0.75" font-size="10.5">${sub}</text>` : ''}`;
}
function diamond(cx, cy, w, h, fill, label, sub) {
  const pts = `${cx},${cy - h/2} ${cx + w/2},${cy} ${cx},${cy + h/2} ${cx - w/2},${cy}`;
  return `
    <polygon points="${pts}" fill="${fill}" fill-opacity="0.18" stroke="${fill}" stroke-width="1.5"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="currentColor" font-size="11.5" font-weight="700">${label}</text>
    ${sub ? `<text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="currentColor" fill-opacity="0.75" font-size="10">${sub}</text>` : ''}`;
}
function arrow(x1, y1, x2, y2, label) {
  // text-anchor middle, slightly offset above/right of the line midpoint
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 4;
  return `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
          stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5" marker-end="url(#arr)"/>
    ${label ? `<text x="${mx}" y="${my}" text-anchor="middle"
              fill="currentColor" fill-opacity="0.85" font-size="10" font-weight="600">${label}</text>` : ''}`;
}

function diagramSvg() {
  // Layout grid (vertical flow). Width 920, dynamic height.
  // We lay out each stage as a row. X-positions are precomputed.
  const W = 920;
  const stages = [];

  // ── Row 1 — Ingress & parsing ──────────────────────────────────────────
  stages.push(`
    <g>
      ${box(40, 20, 200, 56, C.ingress, 'Ingress',           'NIC → packet buffer · L2 parse')}
      ${box(280, 20, 200, 56, C.ingress, 'Packet Parsing',   'tunnel decap (IPSec / GRE) · IP / TCP / UDP')}
      ${box(520, 20, 200, 56, C.ingress, 'IP Sanity',        'fragment / TTL / checksum / spoof')}
      ${arrow(240, 48, 280, 48)}
      ${arrow(480, 48, 520, 48)}
    </g>`);

  // ── Row 2 — Flow lookup decision ───────────────────────────────────────
  stages.push(`
    <g>
      ${diamond(620, 150, 200, 80, C.decision, 'Flow Lookup',  'session already exists?')}
      ${arrow(620, 76, 620, 110)}
    </g>`);

  // ── Row 3 — Fast path (right) vs Slow path setup (left) ────────────────
  // Slow path column on the left, fast path callout on the right.
  stages.push(`
    <g>
      <!-- branch labels -->
      ${arrow(540, 150, 420, 150, 'No → slow path')}
      ${arrow(720, 150, 840, 150, 'Yes → fast path')}

      <!-- Slow path stack -->
      ${box(40, 200, 380, 44, C.slow, 'Zone & Routing lookup', 'ingress zone · FIB / virtual-router · egress zone')}
      ${box(40, 254, 380, 44, C.slow, 'DoS Protection',        'zone DoS profile · classified / aggregate')}
      ${box(40, 308, 380, 44, C.slow, 'NAT Policy Evaluation', 'destination NAT first · source NAT after policy')}
      ${box(40, 362, 380, 44, C.slow, 'Security Pre-Policy',   'allow / deny / drop  ·  zone-to-zone match')}
      ${box(40, 416, 380, 44, C.slow, 'Session Install',       'allocate session · set timers · install in FW')}
      ${arrow(230, 244, 230, 254)}
      ${arrow(230, 298, 230, 308)}
      ${arrow(230, 352, 230, 362)}
      ${arrow(230, 406, 230, 416)}

      <!-- Fast path box (right) -->
      ${box(740, 200, 160, 260, C.fast, 'Fast Path',
        'existing session · skip policy lookup · App-ID re-check · Content-ID inspection if enabled')}

      <!-- Connect slow + fast back into App-ID -->
      ${arrow(230, 460, 230, 500)}
      ${arrow(820, 460, 820, 500)}
    </g>`);

  // ── Row 4 — App-ID ─────────────────────────────────────────────────────
  stages.push(`
    <g>
      ${box(120, 500, 700, 64, C.appid, 'App-ID',
        'protocol decoder · known apps · unknown-tcp/unknown-udp · application override')}
      <text x="470" y="586" text-anchor="middle" fill="currentColor" fill-opacity="0.65" font-size="10.5">
        first few packets establish the application; later packets short-circuit on cached App-ID
      </text>
      ${arrow(470, 600, 470, 624)}
    </g>`);

  // ── Row 5 — Content-ID stack ───────────────────────────────────────────
  stages.push(`
    <g>
      ${box(40, 630, 880, 44, C.content, 'Content-ID — single-pass parallel inspection',
        'AV · Anti-Spyware · Vulnerability · URL filtering · File Blocking · Data Filtering · WildFire · DNS Security')}
      ${arrow(470, 674, 470, 698)}
    </g>`);

  // ── Row 6 — Egress ─────────────────────────────────────────────────────
  stages.push(`
    <g>
      ${box(40, 700, 200, 56, C.egress, 'QoS Marking',       'class / DSCP / 802.1p')}
      ${box(280, 700, 200, 56, C.egress, 'Source NAT apply', 'translate addresses / ports')}
      ${box(520, 700, 200, 56, C.egress, 'Encryption / Tunnel', 'IPSec encap · GRE · SSL')}
      ${box(760, 700, 140, 56, C.egress, 'Fragment / TX',    'MTU · ARP · NIC')}
      ${arrow(240, 728, 280, 728)}
      ${arrow(480, 728, 520, 728)}
      ${arrow(720, 728, 760, 728)}
    </g>`);

  const HEIGHT = 780;
  return `
    <svg viewBox="0 0 ${W} ${HEIGHT}" role="img"
         aria-label="PAN-OS packet flow diagram"
         style="width:100%;height:auto;display:block;background:var(--card-2);border:1px solid var(--border);border-radius:10px"
         font-family="-apple-system,Segoe UI,Roboto,sans-serif">
      ${DEFS}
      ${stages.join('\n')}
    </svg>`;
}

export async function mount(root) {
  const legendItem = (color, label) =>
    `<span class="k"><span class="sw" style="background:${color}"></span> ${esc(label)}</span>`;

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">PAN-OS packet flow</h2>
    <p class="hint" style="margin-bottom:8px">
      How a packet traverses a Palo Alto firewall. The first packet of a new flow walks the
      <strong>slow path</strong> (zone, route, NAT, security policy, session install);
      subsequent packets ride the <strong>fast path</strong>. App-ID then Content-ID inspect
      payload in a single parallel pass before the egress stages apply NAT, encryption and
      QoS marking. Adapted from the Palo Alto Networks "Day in the Life of a Packet" article.
    </p>

    <div class="tk-legend" style="margin:6px 0 10px">
      ${legendItem(C.ingress,  'Ingress / parsing')}
      ${legendItem(C.decision, 'Decision')}
      ${legendItem(C.slow,     'Slow path setup')}
      ${legendItem(C.fast,     'Fast path')}
      ${legendItem(C.appid,    'App-ID')}
      ${legendItem(C.content,  'Content-ID')}
      ${legendItem(C.egress,   'Egress transform / forward')}
    </div>

    ${diagramSvg()}

    <h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">Stage notes</h3>
    <table class="tbl">
      <thead><tr><th style="width:200px">Stage</th><th>What happens</th></tr></thead>
      <tbody>
        <tr><td style="font-weight:600">Ingress &amp; parsing</td>
            <td>Packet is pulled off the NIC, L2 headers parsed, tunnel decapsulation
                (IPSec, GRE), then IP / TCP / UDP sanity (TTL, checksum, anti-spoof).</td></tr>
        <tr><td style="font-weight:600">Flow lookup</td>
            <td>Hash on the 6-tuple to find an existing session. <em>Hit</em> → fast path.
                <em>Miss</em> → slow path session setup.</td></tr>
        <tr><td style="font-weight:600">Slow path</td>
            <td>Zone &amp; FIB lookup → DoS profile → NAT policy → security pre-policy match
                (allow / deny / drop) → session installed and added to the flow table.</td></tr>
        <tr><td style="font-weight:600">Fast path</td>
            <td>Existing session: skip policy lookup, re-confirm App-ID and re-run any
                inspection profiles that were attached to the matching rule.</td></tr>
        <tr><td style="font-weight:600">App-ID</td>
            <td>Protocol decoders identify the application during the first few packets;
                result is cached on the session so later packets short-circuit.</td></tr>
        <tr><td style="font-weight:600">Content-ID</td>
            <td>Single-pass parallel inspection: Antivirus, Anti-Spyware, Vulnerability,
                URL Filtering, File &amp; Data filtering, WildFire and DNS Security.</td></tr>
        <tr><td style="font-weight:600">Egress</td>
            <td>QoS marking, source-NAT applied, IPSec / GRE encryption / encapsulation,
                fragmentation against egress MTU, ARP and finally transmit.</td></tr>
      </tbody>
    </table>

    <p class="hint" style="margin-top:14px;font-size:11.5px">
      Reference: Palo Alto Networks Live Community —
      <a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">Day in the Life of a Packet (PAN-OS)</a>.
      Original diagram (hosted by Palo Alto):
      <a href="${IMAGE_URL}" target="_blank" rel="noopener noreferrer">image 12862</a>.
    </p>`;
}
