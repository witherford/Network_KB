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
    <div class="form-row">
      <label>Wireshark display filter</label>
      <pre class="script-out" id="fWs" style="margin:4px 0 4px"></pre>
      <div style="display:flex;gap:8px">
        <button class="btn sm" id="fWsCopy">Copy</button>
      </div>
    </div>
    <div class="form-row" style="margin-top:14px">
      <label>tcpdump / BPF capture filter</label>
      <pre class="script-out" id="fTcp" style="margin:4px 0 4px"></pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" id="fTcpCopy">Copy</button>
        <button class="btn sm" id="fTcpExample">Wrap with tcpdump example</button>
      </div>
    </div>`;

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
