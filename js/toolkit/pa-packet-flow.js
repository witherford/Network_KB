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

// Helpers: rounded box and text label. `sub` may be a string or an array of
// strings (one line each) to support multi-line labels inside boxes without
// SVG text overflowing the rounded rectangle.
function box(x, y, w, h, fill, title, sub) {
  const subLines = sub == null ? [] : (Array.isArray(sub) ? sub : [sub]);
  const cx = x + w / 2;
  const titleY = y + (subLines.length ? 18 : Math.round(h / 2) + 4);
  const subStart = titleY + 14;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"
          fill="${fill}" fill-opacity="0.18" stroke="${fill}" stroke-width="1.5"/>
    <text x="${cx}" y="${titleY}" text-anchor="middle"
          fill="currentColor" font-size="12" font-weight="700">${title}</text>
    ${subLines.map((s, i) => `<text x="${cx}" y="${subStart + i * 13}" text-anchor="middle"
          fill="currentColor" fill-opacity="0.75" font-size="10.5">${s}</text>`).join('')}`;
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
  // Layout grid (vertical flow). Width 960, dynamic height.
  // Boxes are 64 px tall and use multi-line sub-labels so text never overflows.
  const W = 960;
  const stages = [];

  // ── Row 1 — Ingress & parsing ─────────────────────────────────────────
  stages.push(`
    <g>
      ${box(40, 20, 220, 64, C.ingress, 'Ingress',         ['NIC → packet buffer', 'Layer-2 parse'])}
      ${box(290, 20, 240, 64, C.ingress, 'Packet Parsing', ['tunnel decap (IPSec / GRE)', 'IP / TCP / UDP'])}
      ${box(560, 20, 220, 64, C.ingress, 'IP Sanity',      ['fragment · TTL · checksum', 'anti-spoof'])}
      ${arrow(260, 52, 290, 52)}
      ${arrow(530, 52, 560, 52)}
    </g>`);

  // ── Row 2 — Flow lookup decision ──────────────────────────────────────
  stages.push(`
    <g>
      ${diamond(670, 160, 220, 88, C.decision, 'Flow Lookup', 'session already exists?')}
      ${arrow(670, 84, 670, 116)}
    </g>`);

  // ── Row 3 — Slow path stack (left) vs Fast path (right) ───────────────
  // Slow path stack: boxes 360 wide, starting at x=40. Fast path box: 200 wide
  // at x=740 with multi-line sub so the text fits comfortably.
  stages.push(`
    <g>
      <!-- branch labels — diagonals pointing into the next box of each path -->
      ${arrow(560, 160, 220, 220, 'No → slow path')}
      ${arrow(780, 160, 820, 220, 'Yes → fast path')}

      <!-- Slow path stack -->
      ${box(40, 220, 360, 50, C.slow, 'Zone & Routing lookup', 'ingress zone · FIB / VR · egress zone')}
      ${box(40, 280, 360, 50, C.slow, 'DoS Protection',        'zone DoS profile · classified / aggregate')}
      ${box(40, 340, 360, 50, C.slow, 'NAT Policy Evaluation', 'destination NAT first · source NAT after policy')}
      ${box(40, 400, 360, 50, C.slow, 'Security Pre-Policy',   'allow / deny / drop · zone-to-zone match')}
      ${box(40, 460, 360, 50, C.slow, 'Session Install',       'allocate session · set timers · install in FW')}
      ${arrow(220, 270, 220, 280)}
      ${arrow(220, 330, 220, 340)}
      ${arrow(220, 390, 220, 400)}
      ${arrow(220, 450, 220, 460)}

      <!-- Fast path box (right) — wider, multi-line sub so nothing overflows -->
      ${box(720, 220, 200, 290, C.fast, 'Fast Path',
        ['existing session', 'skip policy lookup', 'App-ID re-check', 'Content-ID inspection', 'if profile attached'])}

      <!-- Connect slow + fast back into App-ID -->
      ${arrow(220, 510, 220, 550)}
      ${arrow(820, 510, 820, 550)}
    </g>`);

  // ── Row 4 — App-ID ────────────────────────────────────────────────────
  stages.push(`
    <g>
      ${box(120, 550, 720, 64, C.appid, 'App-ID',
        ['protocol decoder · known apps · unknown-tcp / unknown-udp · application override'])}
      <text x="480" y="634" text-anchor="middle" fill="currentColor" fill-opacity="0.65" font-size="10.5">
        first few packets establish the application; later packets short-circuit on cached App-ID
      </text>
      ${arrow(480, 644, 480, 672)}
    </g>`);

  // ── Row 5 — Content-ID stack ──────────────────────────────────────────
  stages.push(`
    <g>
      ${box(40, 680, 880, 64, C.content, 'Content-ID — single-pass parallel inspection',
        ['AV · Anti-Spyware · Vulnerability · URL filtering · File Blocking · Data Filtering · WildFire · DNS Security'])}
      ${arrow(480, 744, 480, 772)}
    </g>`);

  // ── Row 6 — Egress ────────────────────────────────────────────────────
  stages.push(`
    <g>
      ${box(40, 780, 210, 64, C.egress, 'QoS Marking',        ['class · DSCP · 802.1p'])}
      ${box(280, 780, 210, 64, C.egress, 'Source NAT apply',  ['translate addresses / ports'])}
      ${box(520, 780, 210, 64, C.egress, 'Encrypt / Tunnel',  ['IPSec encap · GRE · SSL'])}
      ${box(760, 780, 160, 64, C.egress, 'Fragment / TX',     ['MTU · ARP · NIC'])}
      ${arrow(250, 812, 280, 812)}
      ${arrow(490, 812, 520, 812)}
      ${arrow(730, 812, 760, 812)}
    </g>`);

  const HEIGHT = 870;
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
    <style>
      .paf-body { font-size: 12.5px; line-height: 1.6; }
      .paf-body > p { margin: 10px 0; }
      .paf-body > ul, .paf-body > ol { margin: 8px 0 12px 22px; padding: 0; }
      .paf-body > ul li, .paf-body > ol li { margin: 3px 0; }
      .paf-body h5 { font-size: 12.5px; margin: 14px 0 6px; color: var(--text); }
      .paf-body h5:first-child { margin-top: 4px; }
      .paf-body .paf-divider { height: 1px; background: var(--border); margin: 14px 0; opacity: 0.6; }
      .paf-body table.tbl { margin: 8px 0 12px; }
      .paf-section + .paf-section { margin-top: 10px; }
      .paf-subsection .paf-body > p:first-child { margin-top: 4px; }
      .paf-toc a { text-decoration: none; color: var(--accent); }
      .paf-toc a:hover { text-decoration: underline; }
    </style>
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

    <h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">Detailed walkthrough</h3>
    <div class="paf-toc" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:12px">
      <strong>Contents</strong>
      <ol style="margin:6px 0 0 18px;line-height:1.7">
        <li><a href="#paf-s1">Overview</a></li>
        <li><a href="#paf-s2">Ingress Stage</a>
          <ol style="margin-left:18px">
            <li><a href="#paf-s2-1">Packet Parsing</a></li>
            <li><a href="#paf-s2-2">Tunnel Decapsulation</a></li>
            <li><a href="#paf-s2-3">IP Defragmentation</a></li>
          </ol>
        </li>
        <li><a href="#paf-s3">Firewall Session Lookup</a>
          <ol style="margin-left:18px">
            <li><a href="#paf-s3-1">Zone Protection Checks</a></li>
            <li><a href="#paf-s3-2">TCP State Check</a></li>
            <li><a href="#paf-s3-3">Forwarding Setup</a></li>
            <li><a href="#paf-s3-4">NAT Policy Lookup</a></li>
            <li><a href="#paf-s3-5">User-ID</a></li>
            <li><a href="#paf-s3-6">DoS Protection Policy Lookup</a></li>
            <li><a href="#paf-s3-7">Security Policy Lookup</a></li>
            <li><a href="#paf-s3-8">Session Allocation</a></li>
          </ol>
        </li>
        <li><a href="#paf-s4">Firewall Session Fast Path</a>
          <ol style="margin-left:18px">
            <li><a href="#paf-s4-1">Security Processing</a></li>
            <li><a href="#paf-s4-2">Captive Portal</a></li>
          </ol>
        </li>
        <li><a href="#paf-s5">Application Identification (App-ID)</a></li>
        <li><a href="#paf-s6">Content Inspection</a></li>
        <li><a href="#paf-s7">Forwarding / Egress</a></li>
        <li><a href="#paf-s8">Summary</a></li>
      </ol>
    </div>

    ${section('paf-s1', 'Section 1 — Overview', `
      <p>This document describes the packet handling sequence inside of PAN-OS devices. The <strong>ingress</strong> and <strong>forwarding/egress</strong> stages handle network functions and make packet-forwarding decisions on a per-packet basis. The remaining stages are session-based security modules highlighted by <strong>App-ID</strong> and <strong>Content-ID</strong>. This decoupling offers stateful security functions at the application layer, and the resiliency of per-packet forwarding and flexibility of deployment topologies.</p>
    `, true)}

    ${section('paf-s2', 'Section 2 — Ingress Stage', `
      <p>The ingress stage receives packets from the network interface, parses those packets, and then determines whether a given packet is subject to further inspection. If the packet is subject to further inspection, the firewall continues with a session lookup and the packet enters the security processing stage. Otherwise, the firewall forwards the packet to the egress stage. Section 3 summarises cases when the firewall forwards packets without inspection, depending on the packet type and the operational mode of the interface.</p>
      ${note('During packet processing, the firewall may discard a packet because of a protocol violation. In certain cases, due to firewall attack-prevention features, it discards packets without configurable options. Section 2.1 enumerates such cases.')}
      <p class="hint" style="font-size:11.5px">The diagram above shows each stage of the firewall: Ingress, FW Session Setup / Slow path, FW Fast path, Application Identification, Forwarding / Egress.</p>

      ${subsection('paf-s2-1', '2.1 Packet Parsing', `
        <p>Packet parsing starts with the Ethernet (Layer-2) header of the packet received from the wire. The ingress port, 802.1q tag, and destination MAC address are used as keys to look up the ingress logical interface. If the interface is not found, the packet is discarded. The hardware interface counter <code>receive error</code> and global counter <code>flow_rcv_dot1q_tag_err</code> are incremented.</p>

        <h5>Layer-3 header parsing</h5>
        <p>After Layer-2, the IP header is parsed. The firewall will discard the packet under the following conditions:</p>
        <p><strong>IPv4</strong></p>
        <ul>
          <li>Mismatch of Ethernet type and IP version</li>
          <li>Truncated IP header</li>
          <li>IP protocol number 0</li>
          <li>TTL zero</li>
          <li>Land attack</li>
          <li>Ping of death</li>
          <li>Martian IP address</li>
          <li>IP checksum errors</li>
        </ul>
        <p><strong>IPv6</strong></p>
        <ul>
          <li>Mismatch of Ethernet type and IP version</li>
          <li>Truncated IPv6 header</li>
          <li>Truncated IP packet (IP payload buffer length less than IP payload field)</li>
          <li>JumboGram extension (RFC 2675)</li>
          <li>Truncated extension header</li>
        </ul>

        <div class="paf-divider"></div>

        <h5>Layer-4 header parsing</h5>
        <p>If applicable, the Layer-4 (TCP/UDP) header is parsed. The firewall will discard the packet under the following conditions:</p>
        <p><strong>TCP</strong></p>
        <ul>
          <li>TCP header is truncated</li>
          <li>Data-offset field is less than 5</li>
          <li>Checksum error</li>
          <li>Port is zero</li>
          <li>Invalid combination of TCP flags</li>
        </ul>
        <p><strong>UDP</strong></p>
        <ul>
          <li>UDP header truncated</li>
          <li>UDP payload truncated (not an IP fragment and UDP buffer length less than UDP length field)</li>
          <li>Checksum error</li>
        </ul>
      `)}

      ${subsection('paf-s2-2', '2.2 Tunnel Decapsulation', `
        <p>The firewall performs decapsulation / decryption at the parsing stage. After parsing the packet, if the firewall determines that it matches a tunnel (IPSec, SSL-VPN with SSL transport), it performs the following sequence:</p>
        <ul>
          <li>The firewall decapsulates the packet first and discards it if errors exist.</li>
          <li>The tunnel interface associated with the tunnel is assigned to the packet as its new ingress interface, and the packet is fed back through the parsing process, starting with the packet header defined by the tunnel type. Currently the supported tunnel types are IP-layer tunneling, so packet parsing (for a tunneled packet) starts with the IP header.</li>
        </ul>
      `)}

      ${subsection('paf-s2-3', '2.3 IP Defragmentation', `
        <p>The firewall parses IP fragments, reassembles using the defragmentation process, and then feeds the packet back to the parser starting with the IP header. At this stage, a fragment may be discarded due to <em>tear-drop</em> attack (overlapping fragments), fragmentation errors, or if the firewall hits system limits on buffered fragments (max packet threshold).</p>
      `)}
    `)}

    ${section('paf-s3', 'Section 3 — Firewall Session Lookup', `
      <p>A packet is subject to firewall processing depending on the packet type and the interface mode. The following table summarises the behaviour:</p>
      <div style="overflow-x:auto">
      <table class="tbl">
        <thead><tr>
          <th>Packet Type</th><th>Layer-3</th><th>Layer-2</th><th>Virtual-Wire</th><th>Tap</th>
        </tr></thead>
        <tbody>
          <tr><td><strong>IPv4 unicast</strong></td><td>inspect &amp; forward</td><td>inspect &amp; forward</td><td>inspect &amp; forward</td><td>inspect &amp; drop</td></tr>
          <tr><td><strong>IPv4 multicast</strong> (224.0.0.1 – 239.255.255.255)</td><td>inspect &amp; forward</td><td>forward only (flood)</td><td>forward, inspect only if multicast firewalling on</td><td>inspect &amp; drop</td></tr>
          <tr><td><strong>IP broadcast</strong> (255.255.255.255)</td><td>drop</td><td>forward only (flood)</td><td>forward, inspect only if multicast firewalling on</td><td>drop</td></tr>
          <tr><td><strong>IP local broadcast</strong></td><td>drop</td><td>forward only (flood)</td><td>forward, inspect only if multicast firewalling on</td><td>drop</td></tr>
          <tr><td><strong>IPv6</strong></td><td>inspect &amp; forward if enabled</td><td>forward, inspect only if IPv6 firewalling on (default)</td><td>forward, inspect only if IPv6 firewalling on (default)</td><td>drop, inspect only if IPv6 firewalling on (default)</td></tr>
          <tr><td><strong>Non-IP</strong></td><td>process if applicable, not forward</td><td>forward only</td><td>forward only</td><td>drop</td></tr>
        </tbody>
      </table>
      </div>

      <p>If the packet is subject to firewall inspection, the firewall performs a flow lookup. A firewall session consists of two unidirectional flows, each uniquely identified. PAN-OS identifies the flow using a <strong>6-tuple key</strong>:</p>
      <ul>
        <li><strong>Source and destination addresses</strong> — IP addresses from the IP packet.</li>
        <li><strong>Source and destination ports</strong> — port numbers from TCP/UDP. For non-TCP/UDP, different fields are used (ICMP identifier &amp; sequence; IPSec terminating on device uses the SPI; unknown uses a reserved constant to skip the Layer-4 match).</li>
        <li><strong>Protocol</strong> — the IP protocol number from the IP header.</li>
        <li><strong>Security zone</strong> — derived from the ingress interface where the packet arrived.</li>
      </ul>
      <p>The firewall stores active flows in the flow lookup table. When a packet is eligible for firewall inspection, the firewall extracts the 6-tuple flow key and performs a flow lookup to match the packet with an existing flow. Each flow has a <strong>client</strong> and <strong>server</strong> component; the client is the sender of the first packet of the session from the firewall's perspective, the server is the receiver.</p>
      ${note('The distinction of client and server is from the firewall’s point of view and may or may not be the same from the end hosts’ point of view. There will be a client-to-server (C2S) and server-to-client (S2C) flow.')}

      <h4 style="font-size:12.5px;margin:14px 0 6px;color:var(--muted)">Firewall Session Setup</h4>
      <p>The firewall performs the following steps to set up a firewall session.</p>

      ${subsection('paf-s3-1', '3.1 Zone Protection Checks', `
        <p>After the packet arrives on a firewall interface, the ingress interface information is used to determine the ingress zone. If any zone-protection profiles exist for that zone, the packet is subject to evaluation based on the profile configuration.</p>
      `)}

      ${subsection('paf-s3-2', '3.2 TCP State Check', `
        <p>If the first packet in a session is a TCP packet and it does not have the SYN bit set, the firewall discards it (default). If SYN-flood settings are configured in the zone-protection profile and the action is set to <strong>SYN Cookies</strong>, then TCP SYN cookie is triggered when the number of SYN matches the activate threshold:</p>
        <ul>
          <li>The seed to encode the cookie is generated via a random-number generator each time the data plane boots up.</li>
          <li>If an ACK packet received from the client does not match cookie encoding, it is treated as a non-SYN packet.</li>
          <li>A session that passes SYN cookie processing is subject to TCP sequence-number translation because the firewall acted as a proxy for the TCP 3-way handshake.</li>
        </ul>
        <p>If the SYN-flood protection action is set to <strong>Random Early Drop (RED)</strong> instead — the default — then the firewall simply drops any SYN messages received after hitting the threshold. SYN Cookies is preferred when you want to permit more legitimate traffic while distinguishing SYN-flood packets and dropping those instead. RED drops SYN packets randomly and can impact legitimate traffic equally.</p>
        ${note('You can configure the firewall to allow the first TCP packet even if it does not have SYN bit set. Altering the default behaviour poses a security risk by opening the firewall to malicious packets not part of a valid TCP connection sequence. Although not recommended, it might be required for asymmetric flows. You should configure the firewall to reject TCP non-SYN when SYN cookies are enabled.')}
      `)}

      ${subsection('paf-s3-3', '3.3 Forwarding Setup', `
        <p>This stage determines the packet-forwarding path. Packet forwarding depends on interface configuration:</p>
        <div style="overflow-x:auto">
        <table class="tbl">
          <thead><tr><th>Interface Mode</th><th>Forwarding action</th></tr></thead>
          <tbody>
            <tr><td><strong>Tap</strong></td><td>Egress interface/zone is the same as the ingress interface/zone from a policy perspective. The firewall discards the packet.</td></tr>
            <tr><td><strong>Virtual Wire</strong></td><td>Egress interface is the peer interface configured in the virtual wire.</td></tr>
            <tr><td><strong>Layer-2</strong></td><td>Egress interface for the destination MAC is retrieved from the MAC table. If the information is not present, the frame is flooded to all interfaces in the associated VLAN broadcast domain, except the ingress interface.</td></tr>
            <tr><td><strong>Layer-3</strong></td><td>The firewall uses the forwarding table to determine the next hop, or discards the packet if there is no match.</td></tr>
          </tbody>
        </table>
        </div>
      `)}

      ${subsection('paf-s3-4', '3.4 NAT Policy Lookup', `
        <p>Applicable only in Layer-3 or Virtual Wire mode. At this stage, ingress and egress zone information is available. The firewall evaluates NAT rules for the original packet.</p>
        <ul>
          <li><strong>Destination NAT</strong> — the firewall performs a second route lookup for the translated address to determine the egress interface/zone.</li>
          <li><strong>Source NAT</strong> — the firewall evaluates the NAT rule for source-IP allocation. If the allocation check fails, the firewall discards the packet.</li>
        </ul>
      `)}

      ${subsection('paf-s3-5', '3.5 User-ID', `
        <p>The firewall uses the IP address of the packet to query the User-IP mapping table (maintained per vsys). The corresponding user information is fetched. The firewall next uses this user information to query the user-group mapping table and fetches the group mapping associated with this user (returns all groups the user belongs to).</p>
        <p>There is a chance that user information is not available at this point. In that case, if captive-portal policy is set up, the firewall will attempt to find out the user information via captive-portal authentication (discussed in Section 4).</p>
      `)}

      ${subsection('paf-s3-6', '3.6 DoS Protection Policy Lookup', `
        <p>Next, the firewall checks the DoS (Denial of Service) protection policy for traffic thresholds based on the DoS protection profile. If the DoS protection policy action is set to <strong>Protect</strong>, the firewall checks the specified thresholds and — if there is a match (DoS attack detected) — discards the packet.</p>
        <p>If the policy action is either <strong>allow</strong> or <strong>deny</strong>, the action takes precedence regardless of threshold limits set in the DoS profile.</p>
      `)}

      ${subsection('paf-s3-7', '3.7 Security Policy Lookup', `
        <p>At this stage, the ingress and egress zone information is available. The firewall uses application <code>ANY</code> to perform the lookup and check for a rule match. If a rule matches and the action is <strong>deny</strong>, the firewall drops the packet. The firewall denies the traffic if there is no security rule match. The firewall permits intra-zone traffic by default. You can modify this default behaviour for intra-zone and inter-zone traffic from the security policies rulebase.</p>
        ${note('The firewall applies security rules to the contents of the original packet, even if there are NAT rules configured.')}
      `)}

      ${subsection('paf-s3-8', '3.8 Session Allocation', `
        <p>The firewall allocates a new session entry from the free pool after all of the above steps complete successfully. Session-allocation failure may occur at this point due to resource constraints:</p>
        <ul>
          <li>vsys session maximum reached, or</li>
          <li>The firewall has allocated all available sessions.</li>
        </ul>
        <p>After the session allocation is successful:</p>
        <ul>
          <li>The firewall fills session content with flow keys extracted from the packet and the forwarding / policy results.</li>
          <li>Session state changes from <code>INIT</code> (pre-allocation) to <code>OPENING</code> (post-allocation).</li>
          <li>If the application has not been identified, the session timeout values are set to the default value of the transport protocol. You can configure these global timeout values from the firewall's device settings. Application-specific timeout values override the global settings once an application is identified.</li>
        </ul>
        <p>After setup, session installation takes place:</p>
        <ul>
          <li>The firewall queries the flow lookup table to see if a match exists for the flow keys matching the session. If a match is found (session with same tuple already exists), this session instance is discarded as session already exists, else:</li>
          <li>Session is added to the flow lookup table for both C2S and S2C flows and the firewall changes the session's state from <code>OPENING</code> to <code>ACTIVE</code>.</li>
        </ul>
        <p>The firewall then sends the packet into the Session Fast Path phase for security processing.</p>
      `)}
    `)}

    ${section('paf-s4', 'Section 4 — Firewall Session Fast Path', `
      <p>A packet that matches an existing session will enter the fast path. This stage starts with Layer-2 to Layer-4 firewall processing:</p>
      <ul>
        <li>If the session is in <strong>discard</strong> state, the firewall drops the packet. A session can be marked discard due to a policy action change to deny or threat detection.</li>
        <li>If the session is <strong>active</strong>, refresh the session timeout.</li>
        <li>If the packet is a TCP FIN/RST, the session's TCP half-closed timer is started if this is the first FIN packet (half-closed session) or the TCP Time-Wait timer is started if this is the second FIN packet or a RST. The session is closed as soon as either timer expires.</li>
        <li>If NAT is applicable, translate the L3/L4 header as needed.</li>
        <li>If an application uses TCP as the transport, the firewall processes it by the TCP reassembly module before sending the data stream into the security-processing module. The TCP reassembly module performs window checks, buffers out-of-order data while skipping TCP retransmissions, and drops packets if reassembly fails or buffers fill up.</li>
      </ul>

      ${subsection('paf-s4-1', '4.1 Security Processing', `
        <p>A packet matching an existing session is subject to further processing (application identification and/or content inspection) if the packet has TCP/UDP data (payload), or is a non-TCP/UDP packet.</p>
        <p>If the firewall does not detect the session application, it performs an App-ID lookup. If the App-ID lookup is non-conclusive, the content-inspection module runs known protocol decoder checks and heuristics to help identify the application.</p>
        <p>If the firewall detects the application, the session is subject to content inspection if any of the following apply:</p>
        <ul>
          <li>An <strong>Application Layer Gateway (ALG)</strong> is involved.</li>
          <li>The application is a <strong>tunneled application</strong>.</li>
          <li>The matching security rule has a <strong>security profile</strong> associated.</li>
        </ul>
        <p>The Application Identification (App-ID) and Content Inspection stages are discussed in detail in Sections 5 and 6.</p>
      `)}

      ${subsection('paf-s4-2', '4.2 Captive Portal', `
        <p>If user information was not available for the source IP address extracted from the packet, and the packet is destined to TCP/80, the firewall performs a captive-portal rule lookup to see if the packet is subject to captive-portal authentication. If captive portal is applicable, the packet is redirected to the captive-portal daemon.</p>
        ${note('Since captive portal is applicable to HTTP traffic and also supports a URL-category based policy lookup, this can only kick in after the TCP handshake completes and the HTTP host headers are available in the session exchange.')}
      `)}
    `)}

    ${section('paf-s5', 'Section 5 — Application Identification (App-ID)', `
      <p>The firewall first performs an <strong>application-override</strong> policy lookup to see if there is a rule match. If there is, the application is known and content inspection is skipped for this session.</p>
      <p>If there is no application-override rule, then application signatures are used to identify the application. The firewall uses protocol decoding in the content inspection stage to determine if an application changes from one to another.</p>
      <p>After the firewall identifies the session application, access control, content inspection, traffic management and logging will be set up as configured:</p>
      <ul>
        <li><strong>Security policy lookup</strong> — the identified application as well as IP / port / protocol / zone / user / URL category in the session is used as a key to find a rule match.</li>
        <li>If the security policy has logging enabled at session start, the firewall generates a traffic log each time the App-ID changes throughout the life of the session.</li>
        <li>If the security policy action is <strong>allow</strong> and it has an associated profile and/or the application is subject to content inspection, then it passes all content through Content-ID.</li>
        <li>If the action is allow, the firewall performs a <strong>QoS</strong> policy lookup and assigns a QoS class based on the matching policy.</li>
        <li>If the action is allow and the application is SSL or SSH, perform a <strong>decryption</strong> policy lookup and set up proxy contexts if there is a matching decryption rule.</li>
      </ul>
    `)}

    ${section('paf-s6', 'Section 6 — Content Inspection', `
      <p>The firewall performs <strong>content inspection</strong>, if applicable, where protocol decoders decode the flow and the firewall parses and identifies known tunneling applications (those that routinely carry other applications like <code>web-browsing</code>).</p>
      <p>If the identified application changes due to this, the firewall consults the security policies once again to determine if the session should be permitted to continue.</p>
      <p>If the application does not change, the firewall inspects the content as per all the security profiles attached to the original matching rule. If a threat is detected, the corresponding security-profile action is taken.</p>
      <p>The firewall forwards the packet to the forwarding stage if one of the following holds true:</p>
      <ul>
        <li>Inspection results in a <em>detection</em> and the security-profile action is set to allow, or</li>
        <li>Content inspection returns no detection.</li>
      </ul>
      <p>The firewall then re-encrypts the packet before entering the forwarding stage, if applicable (SSL forward-proxy decryption and SSH decryption).</p>
    `)}

    ${section('paf-s7', 'Section 7 — Forwarding / Egress', `
      <p>The firewall identifies a forwarding domain for the packet, based on the forwarding setup (discussed earlier).</p>
      <p>The firewall performs <strong>QoS shaping</strong> as applicable in the egress process. Based on the MTU of the egress interface and the fragment-bit settings on the packet, the firewall carries out fragmentation if needed.</p>
      <p>If the egress interface is a tunnel interface, then IPSec / SSL-VPN tunnel encryption is performed and packet forwarding is re-evaluated.</p>
      <p>Finally the packet is transmitted out of the physical egress interface.</p>
    `)}

    ${section('paf-s8', 'Section 8 — Summary', `
      <p>Palo Alto Networks next-generation firewalls use a unique <strong>Single Pass Parallel Processing (SP3) Architecture</strong> — which enables high-throughput, low-latency network security, all while incorporating unprecedented features and technology. Palo Alto Networks solves the performance problems that plague today's security infrastructure with the SP3 architecture, which combines two complementary components: <strong>Single Pass software</strong> and <strong>Parallel Processing hardware</strong>. The result is an excellent mix of raw throughput, transaction processing, and network security that today's high-performance networks require.</p>
    `)}

    <p class="hint" style="margin-top:18px;font-size:11.5px">
      Reference: Palo Alto Networks Live Community —
      <a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">Day in the Life of a Packet (PAN-OS)</a>.
      Original diagram (hosted by Palo Alto):
      <a href="${IMAGE_URL}" target="_blank" rel="noopener noreferrer">image 12862 (high-res)</a>.
    </p>`;
}

// ── Small render helpers for the collapsible sections ─────────────────────
function section(id, title, bodyHtml, openByDefault = false) {
  return `
    <details id="${id}" class="paf-section" ${openByDefault ? 'open' : ''}
             style="margin:10px 0;border:1px solid var(--border);border-radius:8px;background:var(--card);padding:10px 14px">
      <summary style="cursor:pointer;font-weight:700;font-size:13px;padding:4px 0;color:var(--text)">${title}</summary>
      <div class="paf-body">
        ${bodyHtml}
      </div>
    </details>`;
}
function subsection(id, title, bodyHtml) {
  return `
    <details id="${id}" class="paf-subsection"
             style="margin:10px 0;padding:8px 12px;border-left:3px solid var(--accent);background:var(--card-2);border-radius:0 6px 6px 0">
      <summary style="cursor:pointer;font-weight:600;font-size:12.5px;padding:2px 0">${title}</summary>
      <div class="paf-body">${bodyHtml}</div>
    </details>`;
}
function note(text) {
  return `<div style="background:var(--warn-bg);border-left:3px solid var(--warn);padding:8px 10px;border-radius:4px;font-size:11.5px;margin:12px 0;line-height:1.5">
    <strong>Note:</strong> ${text}
  </div>`;
}
