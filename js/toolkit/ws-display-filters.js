// Wireshark display-filter library — a searchable reference of ready-to-copy
// display-filter expressions, grouped by topic, plus the operator reference.
// Complements the form-driven filter builder (which generates a filter from
// fields); this is a copy-paste library of common/advanced expressions.

import { esc, copyToClipboard, debounce, toast } from '../utils.js';

const CATS = [
  { title: 'Addresses & basics', rows: [
    ['ip.addr == 10.0.0.5',              'Any packet to/from a host'],
    ['ip.src == 10.0.0.0/24',            'Source in a subnet'],
    ['ip.dst == 8.8.8.8',                'Destination host'],
    ['not ip.addr == 10.0.0.5',          'Exclude a host'],
    ['ipv6.addr == 2001:db8::1',         'IPv6 host'],
    ['eth.addr == aa:bb:cc:dd:ee:ff',    'MAC address (either direction)'],
    ['vlan.id == 100',                   '802.1Q VLAN tag'],
    ['frame.len > 1400',                 'Frames larger than 1400 bytes'],
    ['frame.time_delta > 1',             'Gaps > 1s from previous packet']
  ]},
  { title: 'TCP', rows: [
    ['tcp.port == 443',                  'TCP port (either direction)'],
    ['tcp.flags.syn == 1 && tcp.flags.ack == 0', 'SYN only — connection attempts'],
    ['tcp.flags.reset == 1',             'TCP resets'],
    ['tcp.analysis.retransmission',      'Retransmissions'],
    ['tcp.analysis.duplicate_ack',       'Duplicate ACKs'],
    ['tcp.analysis.zero_window',         'Zero-window (receiver buffer full)'],
    ['tcp.analysis.lost_segment',        'Previous segment not captured'],
    ['tcp.analysis.fast_retransmission', 'Fast retransmissions'],
    ['tcp.window_size < 1000',           'Small advertised window'],
    ['tcp.stream == 3',                  'Isolate one TCP conversation'],
    ['tcp.len > 0',                      'Packets carrying payload (no bare ACKs)']
  ]},
  { title: 'Expert / errors', rows: [
    ['expert.severity == error',         'All expert-info errors'],
    ['expert.severity >= warn',          'Warnings and errors'],
    ['tcp.analysis.flags',               'Any TCP analysis flag (problems)'],
    ['icmp.type == 3',                   'ICMP destination unreachable'],
    ['icmp.type == 11',                  'ICMP time exceeded (TTL / traceroute)'],
    ['ip.ttl < 5',                       'Suspiciously low TTL'],
    ['ip.flags.mf == 1 || ip.frag_offset > 0', 'IP fragments']
  ]},
  { title: 'HTTP', rows: [
    ['http',                             'All HTTP'],
    ['http.request',                     'Requests only'],
    ['http.response.code >= 400',        'Error responses (4xx/5xx)'],
    ['http.request.method == "POST"',    'POST requests'],
    ['http.host contains "example.com"', 'Requests to a host'],
    ['http.request.uri contains "login"','URI substring'],
    ['http.user_agent contains "curl"',  'Match a user agent']
  ]},
  { title: 'DNS', rows: [
    ['dns',                              'All DNS'],
    ['dns.flags.response == 0',          'Queries only'],
    ['dns.flags.rcode != 0',             'Errors (NXDOMAIN, SERVFAIL…)'],
    ['dns.qry.name contains "example"',  'Query name substring'],
    ['dns.time > 0.5',                   'Slow responses (> 500 ms)'],
    ['dns.qry.type == 28',               'AAAA queries']
  ]},
  { title: 'TLS', rows: [
    ['tls.handshake.type == 1',          'Client Hello'],
    ['tls.handshake.type == 2',          'Server Hello'],
    ['tls.handshake.extensions_server_name contains "example.com"', 'SNI host'],
    ['tls.record.version == 0x0303',     'TLS 1.2 records'],
    ['tls.alert_message',                'TLS alerts'],
    ['tls.handshake.type == 11',         'Certificate message']
  ]},
  { title: 'VoIP / SIP / RTP', rows: [
    ['sip',                              'All SIP'],
    ['sip.Method == "INVITE"',           'Call setup'],
    ['sip.Status-Code >= 400',           'SIP failures'],
    ['rtp',                              'RTP media'],
    ['rtpevent',                         'DTMF / telephony events'],
    ['rtp.marker == 1',                  'RTP marker (talk-spurt start)']
  ]},
  { title: 'Infrastructure / L2-L3', rows: [
    ['arp',                              'ARP'],
    ['arp.opcode == 1',                  'ARP requests'],
    ['arp.duplicate-address-detected',   'Duplicate IP detected'],
    ['dhcp',                             'DHCP (BOOTP)'],
    ['dhcp.option.dhcp == 3',            'DHCP request'],
    ['stp',                              'Spanning Tree'],
    ['stp.flags.tc == 1',                'STP topology change'],
    ['cdp || lldp',                      'CDP or LLDP neighbours'],
    ['ospf',                             'OSPF'],
    ['bgp',                              'BGP'],
    ['vrrp || hsrp',                     'First-hop redundancy']
  ]}
];

const OPERATORS = [
  ['== / eq',    'Equal'],
  ['!= / ne',    'Not equal'],
  ['> >= < <=',  'Greater / less than'],
  ['&& / and',   'Logical AND'],
  ['|| / or',    'Logical OR'],
  ['! / not',    'Negation'],
  ['contains',   'Field contains a byte sequence / string'],
  ['matches / ~','Field matches a PCRE regex'],
  ['in {…}',     'Set membership, e.g. tcp.port in {80 443 8080}'],
  ['[n:m]',      'Slice bytes, e.g. eth.src[0:3] == 00:1a:b3 (OUI)']
];

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Wireshark display-filter library</h2>
    <p class="hint" style="margin-bottom:10px">Ready-to-paste display-filter expressions for the top filter bar. Need a filter built from specific IPs/ports? Use <strong>Capture &amp; display filters</strong>. Looking for port numbers? See <strong>Cheat sheets</strong>.</p>
    <input type="text" id="dfSearch" class="search-input" style="max-width:420px;margin-bottom:12px" placeholder="Search filters (e.g. retransmission, tls, 404)…">
    <div id="dfBody"></div>
    <h3 style="font-size:13px;margin:20px 0 6px;color:var(--muted)">Operators</h3>
    <table class="tbl"><thead><tr><th style="width:140px">Operator</th><th>Meaning</th></tr></thead>
      <tbody>${OPERATORS.map(o => `<tr><td class="mono">${esc(o[0])}</td><td>${esc(o[1])}</td></tr>`).join('')}</tbody></table>`;

  const body = root.querySelector('#dfBody');

  function render(q) {
    const query = (q || '').trim().toLowerCase();
    const cats = CATS.map(c => ({
      title: c.title,
      rows: query ? c.rows.filter(r => r[0].toLowerCase().includes(query) || r[1].toLowerCase().includes(query)) : c.rows
    })).filter(c => c.rows.length);
    if (!cats.length) { body.innerHTML = '<div class="page-empty">No filters match that search.</div>'; return; }
    body.innerHTML = cats.map(c => `
      <h3 style="font-size:13px;margin:16px 0 6px;color:var(--muted)">${esc(c.title)}</h3>
      <table class="tbl">
        <thead><tr><th style="width:46%">Display filter</th><th>Description</th><th style="width:36px"></th></tr></thead>
        <tbody>${c.rows.map(r => `<tr>
          <td class="mono"><code>${esc(r[0])}</code></td>
          <td>${esc(r[1])}</td>
          <td><button class="btn sm ghost" data-copy="${esc(r[0])}" title="Copy filter">⧉</button></td>
        </tr>`).join('')}</tbody>
      </table>`).join('');
  }

  root.querySelector('#dfSearch').addEventListener('input', debounce(e => render(e.target.value), 100));
  body.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    if (!ok) toast('Copy failed', 'error');
    setTimeout(() => { btn.textContent = orig; }, 900);
  });

  render('');
}
