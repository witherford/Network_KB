// Wireshark display filter & tcpdump capture filter builder.
// Pick fields from a guided form, get both filter dialects.

import { copyToClipboard, toast } from '../utils.js';

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:12px">Wireshark / tcpdump filter builder</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
      <div class="form-row">
        <label>Source IP / CIDR</label>
        <input type="text" id="fSrc" placeholder="e.g. 10.0.0.5 or 10.0.0.0/24">
      </div>
      <div class="form-row">
        <label>Destination IP / CIDR</label>
        <input type="text" id="fDst" placeholder="e.g. 8.8.8.8">
      </div>
      <div class="form-row">
        <label>Either-direction host</label>
        <input type="text" id="fHost" placeholder="e.g. 192.168.1.1">
      </div>
      <div class="form-row">
        <label>Protocol</label>
        <select id="fProto">
          <option value="">— any —</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
          <option value="icmp">ICMPv4</option>
          <option value="icmp6">ICMPv6</option>
          <option value="arp">ARP</option>
          <option value="dns">DNS</option>
          <option value="http">HTTP</option>
          <option value="tls">TLS / SSL</option>
          <option value="dhcp">DHCP</option>
          <option value="ntp">NTP</option>
          <option value="snmp">SNMP</option>
          <option value="bgp">BGP</option>
          <option value="ospf">OSPF</option>
          <option value="eigrp">EIGRP</option>
          <option value="vrrp">VRRP</option>
          <option value="hsrp">HSRP</option>
          <option value="lldp">LLDP</option>
          <option value="cdp">CDP</option>
          <option value="stp">STP</option>
          <option value="ipsec">IPsec (ESP)</option>
        </select>
      </div>
      <div class="form-row">
        <label>Source port</label>
        <input type="number" id="fSport" placeholder="e.g. 443" min="0" max="65535">
      </div>
      <div class="form-row">
        <label>Destination port</label>
        <input type="number" id="fDport" placeholder="e.g. 80" min="0" max="65535">
      </div>
      <div class="form-row">
        <label>Either-direction port</label>
        <input type="number" id="fPort" placeholder="e.g. 22" min="0" max="65535">
      </div>
      <div class="form-row">
        <label>VLAN tag</label>
        <input type="number" id="fVlan" placeholder="e.g. 100" min="1" max="4094">
      </div>
      <div class="form-row">
        <label>MAC address</label>
        <input type="text" id="fMac" placeholder="aa:bb:cc:dd:ee:ff">
      </div>
      <div class="form-row">
        <label>TCP flags</label>
        <select id="fFlags">
          <option value="">— any —</option>
          <option value="syn">SYN only (connection attempts)</option>
          <option value="syn-ack">SYN-ACK (server response)</option>
          <option value="rst">RST</option>
          <option value="fin">FIN</option>
          <option value="psh-ack">PSH-ACK (data)</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
      <button class="btn" id="fClear">Clear</button>
      <span class="spacer" style="flex:1"></span>
    </div>

    <section class="filter-section" style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:10px">
      <header style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <strong style="font-size:14px">1. Wireshark display filter</strong>
        <span class="hint" style="font-size:11px">Applied AFTER capture — filters what you see in the packet list. Wireshark only.</span>
      </header>
      ${displayFilterDiagram()}
      <pre class="script-out" id="fWs" style="margin:8px 0 4px"></pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm primary" id="fWsCopy">Copy display filter</button>
      </div>
      <div class="hint" style="font-size:11px;margin-top:8px">
        Where to paste: <strong>top-of-window filter bar</strong> (above the packet list). The bar turns green for valid filters, red for syntax errors. Press Enter to apply.
      </div>
    </section>

    <section class="filter-section" style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:10px">
      <header style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <strong style="font-size:14px">2. Wireshark capture filter / tcpdump (BPF)</strong>
        <span class="hint" style="font-size:11px">Applied DURING capture — discarded packets never reach Wireshark or disk. Same syntax as tcpdump.</span>
      </header>
      ${captureFilterDiagram()}
      <pre class="script-out" id="fTcp" style="margin:8px 0 4px"></pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm primary" id="fTcpCopy">Copy capture filter</button>
        <button class="btn sm" id="fTcpExample">Copy as full tcpdump command</button>
      </div>
      <div class="hint" style="font-size:11px;margin-top:8px">
        Where to paste in Wireshark: <strong>Capture → Options…</strong> (or Ctrl+K) → tick the interface(s) → field <strong>"Capture filter for selected interfaces"</strong> at the bottom of the dialog. Click Start.<br>
        Or use directly with <code>tcpdump</code> / <code>tshark</code> on the command line.
      </div>
    </section>`;

  const $ = sel => root.querySelector(sel);
  const v = id => $('#'+id).value.trim();

  function build() {
    const ws = []; const tcp = [];
    const src = v('fSrc'), dst = v('fDst'), host = v('fHost');
    const proto = v('fProto'), sport = v('fSport'), dport = v('fDport'), port = v('fPort');
    const vlan = v('fVlan'), mac = v('fMac'), flags = v('fFlags');

    // IP/CIDR — Wireshark uses ip.src ==, tcpdump uses src host or src net
    if (src) { ws.push(cidrWs('src', src)); tcp.push(cidrBpf('src', src)); }
    if (dst) { ws.push(cidrWs('dst', dst)); tcp.push(cidrBpf('dst', dst)); }
    if (host) { ws.push(cidrWs('any', host)); tcp.push(cidrBpf('any', host)); }

    // Protocol
    if (proto) {
      const wsP = WS_PROTO[proto] || proto;
      const tcpP = TCP_PROTO[proto];
      if (wsP) ws.push(wsP);
      if (tcpP) tcp.push(tcpP);
    }

    // Ports
    if (sport) { ws.push(`${portWsProto(proto)}.srcport == ${sport}`); tcp.push(`src port ${sport}`); }
    if (dport) { ws.push(`${portWsProto(proto)}.dstport == ${dport}`); tcp.push(`dst port ${dport}`); }
    if (port)  { ws.push(`${portWsProto(proto)}.port == ${port}`); tcp.push(`port ${port}`); }

    // VLAN
    if (vlan) { ws.push(`vlan.id == ${vlan}`); tcp.push(`vlan ${vlan}`); }

    // MAC
    if (mac) {
      const m = mac.replace(/[^0-9a-f]/gi,'').toLowerCase();
      if (m.length === 12) {
        const ws_mac = m.match(/.{2}/g).join(':');
        ws.push(`eth.addr == ${ws_mac}`);
        tcp.push(`ether host ${ws_mac}`);
      }
    }

    // TCP flags
    if (flags) {
      const F = TCP_FLAGS[flags];
      if (F) { ws.push(F.ws); tcp.push(F.tcp); }
    }

    $('#fWs').textContent  = ws.length ? ws.join(' and ') : '# Empty filter — pick fields above';
    $('#fTcp').textContent = tcp.length ? tcp.join(' and ') : '# Empty filter — pick fields above';
  }

  // Wire up live updates
  for (const inp of root.querySelectorAll('input,select')) {
    inp.addEventListener('input', build);
    inp.addEventListener('change', build);
  }

  $('#fClear').addEventListener('click', () => {
    root.querySelectorAll('input').forEach(i => i.value = '');
    root.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    build();
  });

  $('#fWsCopy').addEventListener('click', () => {
    copyToClipboard($('#fWs').textContent).then(ok => toast(ok ? 'Wireshark filter copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  $('#fTcpCopy').addEventListener('click', () => {
    copyToClipboard($('#fTcp').textContent).then(ok => toast(ok ? 'BPF filter copied' : 'Copy failed', ok ? 'success' : 'error'));
  });
  $('#fTcpExample').addEventListener('click', () => {
    const expr = $('#fTcp').textContent;
    if (!expr || expr.startsWith('#')) { toast('Build a filter first', 'error'); return; }
    const example = `tcpdump -i any -nn -s 0 -w capture.pcap '${expr}'`;
    copyToClipboard(example).then(ok => toast(ok ? 'Full tcpdump example copied' : 'Copy failed', ok ? 'success' : 'error'));
  });

  build();
}

const WS_PROTO = {
  tcp:'tcp', udp:'udp', icmp:'icmp', icmp6:'icmpv6', arp:'arp', dns:'dns',
  http:'http', tls:'tls', dhcp:'(udp.port == 67 or udp.port == 68)',
  ntp:'ntp', snmp:'snmp', bgp:'bgp', ospf:'ospf', eigrp:'eigrp',
  vrrp:'vrrp', hsrp:'hsrp', lldp:'lldp', cdp:'cdp', stp:'stp',
  ipsec:'esp'
};
const TCP_PROTO = {
  tcp:'tcp', udp:'udp', icmp:'icmp', icmp6:'icmp6', arp:'arp',
  dns:'port 53', http:'port 80', tls:'port 443',
  dhcp:'(port 67 or port 68)', ntp:'port 123', snmp:'port 161 or port 162',
  bgp:'port 179', ospf:'proto 89', eigrp:'proto 88',
  vrrp:'proto 112', hsrp:'(udp port 1985 or udp port 2029)',
  lldp:'ether proto 0x88cc', cdp:'(ether host 01:00:0c:cc:cc:cc and not vlan)',
  stp:'ether host 01:80:c2:00:00:00', ipsec:'proto 50'
};

const TCP_FLAGS = {
  'syn':       { ws: 'tcp.flags.syn == 1 and tcp.flags.ack == 0', tcp: 'tcp[tcpflags] & tcp-syn != 0 and tcp[tcpflags] & tcp-ack == 0' },
  'syn-ack':   { ws: 'tcp.flags.syn == 1 and tcp.flags.ack == 1', tcp: 'tcp[tcpflags] & (tcp-syn|tcp-ack) == (tcp-syn|tcp-ack)' },
  'rst':       { ws: 'tcp.flags.reset == 1', tcp: 'tcp[tcpflags] & tcp-rst != 0' },
  'fin':       { ws: 'tcp.flags.fin == 1',   tcp: 'tcp[tcpflags] & tcp-fin != 0' },
  'psh-ack':   { ws: 'tcp.flags.push == 1 and tcp.flags.ack == 1', tcp: 'tcp[tcpflags] & (tcp-push|tcp-ack) == (tcp-push|tcp-ack)' }
};

function portWsProto(p) { return p === 'udp' ? 'udp' : 'tcp'; }

function cidrWs(dir, val) {
  if (val.includes('/')) {
    if (dir === 'src') return `ip.src == ${val}`;
    if (dir === 'dst') return `ip.dst == ${val}`;
    return `ip.addr == ${val}`;
  }
  if (dir === 'src') return `ip.src == ${val}`;
  if (dir === 'dst') return `ip.dst == ${val}`;
  return `ip.addr == ${val}`;
}

function cidrBpf(dir, val) {
  const isCidr = val.includes('/');
  const word = isCidr ? 'net' : 'host';
  if (dir === 'src') return `src ${word} ${val}`;
  if (dir === 'dst') return `dst ${word} ${val}`;
  return `${word} ${val}`;
}

// ---------- SVG mockups: where each filter type goes in Wireshark ----------
//
// Stylised, dark-mode friendly representations using CSS variables so the
// diagrams match the rest of the app's theme. The orange call-out arrow
// points at the field where the filter is entered.

function displayFilterDiagram() {
  return `
  <figure style="margin:0;text-align:center">
    <svg viewBox="0 0 760 230" role="img" aria-label="Wireshark display filter location" style="width:100%;max-width:760px;height:auto;border:1px solid var(--border);border-radius:8px;background:var(--card-2)">
      <defs>
        <linearGradient id="ws-bar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#3a4150"/>
          <stop offset="1" stop-color="#252b36"/>
        </linearGradient>
        <marker id="ws-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316"/>
        </marker>
      </defs>
      <!-- title bar -->
      <rect x="6" y="6" width="748" height="22" fill="url(#ws-bar)"/>
      <text x="14" y="22" fill="#e2e8f0" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11">🦈 Wireshark · Capturing from eth0</text>
      <!-- menu -->
      <rect x="6" y="28" width="748" height="20" fill="#2c333f"/>
      <g fill="#cbd5e1" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11">
        <text x="14" y="42">File</text><text x="44" y="42">Edit</text><text x="76" y="42">View</text><text x="112" y="42">Go</text>
        <text x="138" y="42">Capture</text><text x="184" y="42">Analyze</text><text x="232" y="42">Statistics</text>
        <text x="288" y="42">Telephony</text><text x="346" y="42">Wireless</text><text x="396" y="42">Tools</text>
        <text x="430" y="42">Help</text>
      </g>
      <!-- icon toolbar -->
      <rect x="6" y="48" width="748" height="22" fill="#1f2530"/>
      <g fill="#94a3b8">
        <circle cx="22" cy="59" r="6" fill="#22c55e"/>
        <rect x="34" y="53" width="12" height="12" rx="2"/>
        <rect x="50" y="53" width="12" height="12" rx="2"/>
        <rect x="66" y="53" width="12" height="12" rx="2"/>
        <rect x="86" y="53" width="12" height="12" rx="2"/>
      </g>
      <!-- DISPLAY-FILTER BAR (highlighted) -->
      <rect x="6" y="74" width="748" height="34" fill="#0f172a" stroke="#f97316" stroke-width="2"/>
      <text x="14" y="94" fill="#94a3b8" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="10">Apply a display filter…</text>
      <rect x="120" y="80" width="580" height="22" rx="3" fill="#1e293b" stroke="#22c55e" stroke-width="1.5"/>
      <text x="128" y="95" fill="#a5f3fc" font-family="SF Mono,Consolas,monospace" font-size="11">ip.addr == 10.0.0.5 and tcp.dstport == 443</text>
      <rect x="708" y="80" width="40" height="22" rx="3" fill="#334155"/>
      <text x="722" y="95" fill="#cbd5e1" font-size="10">Apply</text>
      <!-- packet list mock -->
      <rect x="6" y="112" width="748" height="112" fill="#1f2530"/>
      <g fill="#94a3b8" font-family="SF Mono,Consolas,monospace" font-size="10">
        <text x="14" y="128">No.    Time      Source         Destination     Protocol  Info</text>
        <text x="14" y="146">1     0.000000  10.0.0.1        10.0.0.5         TCP        443 → 51992 [SYN]</text>
        <text x="14" y="162">2     0.000123  10.0.0.5        10.0.0.1         TCP        51992 → 443 [SYN, ACK]</text>
        <text x="14" y="178">3     0.000457  10.0.0.1        10.0.0.5         TCP        443 → 51992 [ACK]</text>
        <text x="14" y="194">4     0.001120  10.0.0.5        10.0.0.1         TLSv1.3    Client Hello</text>
      </g>
      <!-- callout arrow + label -->
      <path d="M 670 132 L 600 100" stroke="#f97316" stroke-width="2" fill="none" marker-end="url(#ws-arrow)"/>
      <rect x="540" y="118" width="200" height="36" rx="4" fill="#0c4a6e" stroke="#f97316" stroke-width="1"/>
      <text x="640" y="134" fill="#fef3c7" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="700">Display filter goes here</text>
      <text x="640" y="148" fill="#cbd5e1" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="10">(top toolbar · Ctrl+/)</text>
    </svg>
  </figure>`;
}

function captureFilterDiagram() {
  return `
  <figure style="margin:0;text-align:center">
    <svg viewBox="0 0 760 290" role="img" aria-label="Wireshark capture filter location" style="width:100%;max-width:760px;height:auto;border:1px solid var(--border);border-radius:8px;background:var(--card-2)">
      <defs>
        <linearGradient id="cap-bar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#3a4150"/>
          <stop offset="1" stop-color="#252b36"/>
        </linearGradient>
        <marker id="cap-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316"/>
        </marker>
      </defs>
      <!-- dialog title -->
      <rect x="6" y="6" width="748" height="22" fill="url(#cap-bar)"/>
      <text x="14" y="22" fill="#e2e8f0" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11">Wireshark · Capture Options</text>
      <text x="734" y="22" fill="#cbd5e1" font-size="14" text-anchor="end">×</text>
      <!-- tab bar -->
      <rect x="6" y="28" width="748" height="22" fill="#2c333f"/>
      <rect x="14" y="32" width="60" height="16" rx="2" fill="#0f172a"/>
      <text x="44" y="44" fill="#a5f3fc" font-size="10" text-anchor="middle">Input</text>
      <text x="86" y="44" fill="#94a3b8" font-size="10">Output</text>
      <text x="130" y="44" fill="#94a3b8" font-size="10">Options</text>
      <!-- interface table header -->
      <rect x="6" y="50" width="748" height="22" fill="#1f2530"/>
      <g fill="#94a3b8" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="10">
        <text x="14" y="64">Interface</text>
        <text x="180" y="64">Traffic</text>
        <text x="280" y="64">Link-layer</text>
        <text x="400" y="64">Promiscuous</text>
        <text x="500" y="64">Snaplen</text>
        <text x="580" y="64">Buffer (MB)</text>
      </g>
      <!-- interface rows -->
      <rect x="6" y="72" width="748" height="22" fill="#0f172a"/>
      <text x="14" y="86" fill="#22c55e" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="10">☑ eth0</text>
      <g fill="#94a3b8" font-size="10">
        <rect x="180" y="78" width="80" height="10" fill="#1e293b"/>
        <rect x="180" y="78" width="60" height="10" fill="#22c55e" opacity="0.6"/>
        <text x="280" y="86">Ethernet</text>
        <text x="400" y="86">enabled</text>
        <text x="500" y="86">default</text>
        <text x="580" y="86">2</text>
      </g>
      <rect x="6" y="94" width="748" height="22" fill="#1f2530"/>
      <text x="14" y="108" fill="#94a3b8" font-size="10">☐ wlan0</text>
      <g fill="#94a3b8" font-size="10">
        <rect x="180" y="100" width="80" height="10" fill="#1e293b"/>
        <rect x="180" y="100" width="20" height="10" fill="#22c55e" opacity="0.6"/>
        <text x="280" y="108">Ethernet</text>
        <text x="400" y="108">enabled</text>
        <text x="500" y="108">default</text>
        <text x="580" y="108">2</text>
      </g>
      <rect x="6" y="116" width="748" height="22" fill="#0f172a"/>
      <text x="14" y="130" fill="#94a3b8" font-size="10">☐ lo</text>
      <!-- divider -->
      <line x1="6" y1="138" x2="754" y2="138" stroke="#475569" stroke-width="1"/>
      <!-- CAPTURE FILTER LABEL + FIELD (highlighted) -->
      <text x="14" y="158" fill="#cbd5e1" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11">Capture filter for selected interfaces:</text>
      <rect x="14" y="164" width="600" height="26" rx="3" fill="#1e293b" stroke="#f97316" stroke-width="2"/>
      <text x="22" y="181" fill="#a5f3fc" font-family="SF Mono,Consolas,monospace" font-size="11">tcp port 443 and host 10.0.0.5</text>
      <rect x="620" y="164" width="76" height="26" rx="3" fill="#334155"/>
      <text x="658" y="181" fill="#cbd5e1" font-size="10" text-anchor="middle">Compile BPFs</text>
      <!-- callout -->
      <path d="M 700 178 L 760 220" stroke="#f97316" stroke-width="2" fill="none" stroke-opacity="0"/>
      <rect x="380" y="200" width="370" height="36" rx="4" fill="#0c4a6e" stroke="#f97316" stroke-width="1"/>
      <text x="565" y="216" fill="#fef3c7" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="700">Capture filter goes here</text>
      <text x="565" y="230" fill="#cbd5e1" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="10">Capture → Options… (Ctrl+K) · "Capture filter for selected interfaces"</text>
      <path d="M 312 180 L 380 215" stroke="#f97316" stroke-width="2" fill="none" marker-start="url(#cap-arrow)"/>
      <!-- bottom buttons -->
      <line x1="6" y1="252" x2="754" y2="252" stroke="#475569" stroke-width="1"/>
      <rect x="556" y="260" width="80" height="22" rx="3" fill="#334155"/>
      <text x="596" y="275" fill="#cbd5e1" font-size="10" text-anchor="middle">Cancel</text>
      <rect x="644" y="260" width="100" height="22" rx="3" fill="#0ea5e9"/>
      <text x="694" y="275" fill="#fff" font-size="11" text-anchor="middle" font-weight="600">Start Capture</text>
    </svg>
  </figure>`;
}
