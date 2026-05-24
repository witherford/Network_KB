// Palo Alto (PAN-OS) traffic log filter templates.
// The same expression syntax works in the web UI (Monitor > Logs > Traffic, the
// filter bar) and in the CLI: > show log traffic query "<expression>".
// References: PAN-OS Admin Guide "Filter Logs" + Live Community filter threads.

import { esc, copyToClipboard, toast } from '../utils.js';

// Each template: label, the expression with ${token} placeholders, and a hint.
const GROUPS = [
  { title: 'Source / destination IP', items: [
    ['Source IP',                  '( addr.src in ${srcIP} )',              'Single host or CIDR, e.g. 10.0.0.5 or 10.0.0.0/24'],
    ['Destination IP',             '( addr.dst in ${dstIP} )',              'Single host or CIDR'],
    ['Either source or dest IP',   '( addr in ${srcIP} )',                  'Matches the IP in either direction'],
    ['Conversation src → dst',     '( addr.src in ${srcIP} ) and ( addr.dst in ${dstIP} )', 'Specific flow between two hosts'],
  ]},
  { title: 'Ports & protocol', items: [
    ['Source port',                '( port.src eq ${srcPort} )',            'Pre-NAT source port'],
    ['Destination port',           '( port.dst eq ${dstPort} )',            'e.g. 443, 22, 53'],
    ['Protocol = TCP',             '( proto eq 6 )',                        'IP protocol number 6'],
    ['Protocol = UDP',             '( proto eq 17 )',                       'IP protocol number 17'],
    ['Protocol = ICMP',            '( proto eq 1 )',                        'IP protocol number 1'],
    ['Application',                "( app eq ${app} )",                     'PAN-OS App-ID, e.g. ssl, web-browsing, dns'],
  ]},
  { title: 'NAT', items: [
    ['Any NAT-translated session', '( flags has nat )',                     'Sessions where NAT was applied'],
    ['NAT source address',         '( natsrc in ${srcIP} )',                'Translated (post-NAT) source IP'],
    ['NAT destination address',    '( natdst in ${dstIP} )',                'Translated (post-NAT) destination IP'],
    ['NAT source port',            '( natsport eq ${srcPort} )',            'Translated source port'],
    ['NAT destination port',       '( natdport eq ${dstPort} )',            'Translated destination port'],
  ]},
  { title: 'Zones & interfaces', items: [
    ['Source zone',                '( zone.src eq ${zone} )',               'e.g. trust, untrust, dmz'],
    ['Destination zone',           '( zone.dst eq ${zone} )',               'Egress zone'],
    ['Ingress interface',          '( interface.src eq ${iface} )',         'e.g. ethernet1/1, ae1.100'],
    ['Egress interface',           '( interface.dst eq ${iface} )',         'Outbound interface'],
  ]},
  { title: 'Action, rule & sessions', items: [
    ['Action = allow',             '( action eq allow )',                   ''],
    ['Action = deny',              '( action eq deny )',                    ''],
    ['Action = drop',              '( action eq drop )',                    ''],
    ['Not allowed (denied+dropped)', '( action neq allow )',                'Everything the firewall blocked'],
    ['Security rule name',         "( rule eq '${rule}' )",                 'Quote names with spaces'],
    ['Session end reason',         "( session_end_reason eq ${endReason} )", 'tcp-fin, tcp-rst-from-client, threat, aged-out, policy-deny…'],
    ['Bytes ≥ threshold',          '( bytes geq ${bytes} )',                'Find large transfers, e.g. 100000000'],
  ]},
  { title: 'Common combinations', items: [
    ['Denied traffic to a host',   '( addr.dst in ${dstIP} ) and ( action neq allow )', 'Why is X being blocked?'],
    ['Host on a specific port',    '( addr in ${srcIP} ) and ( port.dst eq ${dstPort} )', ''],
    ['Outbound from subnet, web',  "( addr.src in ${srcIP} ) and ( app eq ${app} )", ''],
    ['Threat-terminated sessions', "( session_end_reason eq threat )",      'Sessions killed by a security profile'],
  ]},
];

const OPS = [
  ['eq',  'Equals'],
  ['neq', 'Not equals'],
  ['leq', 'Less than or equal'],
  ['geq', 'Greater than or equal'],
  ['in',  'IP/CIDR membership (addresses)'],
  ['has', 'Flag is set (e.g. flags has nat)'],
  ['and', 'Logical AND (both must match)'],
  ['or',  'Logical OR (either matches)'],
  ['( )', 'Group expressions; always wrap each condition'],
];

const DEFAULTS = {
  srcIP: '10.0.0.0/24', dstIP: '8.8.8.8', srcPort: '1024', dstPort: '443',
  app: 'ssl', zone: 'untrust', iface: 'ethernet1/1', rule: 'Allow-Web',
  endReason: 'tcp-rst-from-server', bytes: '100000000'
};

function fill(tpl, vals) {
  return tpl.replace(/\$\{(\w+)\}/g, (_, k) => vals[k] || `<${k}>`);
}

export async function mount(root) {
  const fields = [
    ['srcIP', 'Source IP / CIDR'], ['dstIP', 'Dest IP / CIDR'],
    ['srcPort', 'Source port'], ['dstPort', 'Dest port'],
    ['app', 'App-ID'], ['zone', 'Zone'], ['iface', 'Interface'],
    ['rule', 'Rule name'], ['endReason', 'Session-end reason'], ['bytes', 'Bytes']
  ];

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Palo Alto — Traffic log filters</h2>
    <p class="hint" style="margin-bottom:10px">Edit the values below and the templates update live. Paste into <strong>Monitor &gt; Logs &gt; Traffic</strong> or CLI <code>show log traffic query "…"</code>.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px">
      ${fields.map(([k, lbl]) => `<div class="form-row" style="margin:0">
        <label>${esc(lbl)}</label>
        <input type="text" data-var="${k}" value="${esc(DEFAULTS[k])}">
      </div>`).join('')}
    </div>
    <div id="paBody"></div>
    <h3 style="font-size:13px;margin:20px 0 6px;color:var(--muted)">Operators</h3>
    <table class="tbl"><thead><tr><th>Operator</th><th>Meaning</th></tr></thead>
      <tbody>${OPS.map(o => `<tr><td class="mono">${esc(o[0])}</td><td>${esc(o[1])}</td></tr>`).join('')}</tbody></table>`;

  const body = root.querySelector('#paBody');

  function render() {
    const vals = {};
    root.querySelectorAll('input[data-var]').forEach(i => { vals[i.dataset.var] = i.value.trim(); });
    body.innerHTML = GROUPS.map(g => `
      <h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">${esc(g.title)}</h3>
      <table class="tbl">
        <thead><tr><th style="width:200px">Filter</th><th>Expression</th><th style="width:36px"></th></tr></thead>
        <tbody>${g.items.map(it => {
          const expr = fill(it[1], vals);
          return `<tr>
            <td><div style="font-weight:600">${esc(it[0])}</div>${it[2] ? `<div class="hint">${esc(it[2])}</div>` : ''}</td>
            <td class="mono"><code>${esc(expr)}</code></td>
            <td><button class="btn sm ghost" data-copy="${esc(expr)}" title="Copy filter">⧉</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`).join('');
  }

  root.querySelectorAll('input[data-var]').forEach(i => i.addEventListener('input', render));
  body.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    if (!ok) toast('Copy failed', 'error');
    setTimeout(() => { btn.textContent = orig; }, 900);
  });

  render();
}
