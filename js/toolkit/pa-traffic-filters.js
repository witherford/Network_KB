// Palo Alto (PAN-OS) log filter templates — one tab per log type with its own
// inputs and filter library. The same expression syntax works in the web UI
// (Monitor → Logs → <type>, top filter bar) and in the CLI
// (> show log <type> query "<expression>"). References: PAN-OS Admin Guide
// "Filter Logs" + Live Community filter threads.

import { esc, copyToClipboard, toast } from '../utils.js';

// Default values used when a template references ${var} and the user has
// left the input blank.
const DEFAULTS = {
  srcIP: '10.0.0.0/24', dstIP: '8.8.8.8', srcPort: '1024', dstPort: '443',
  app: 'ssl', zone: 'untrust', iface: 'ethernet1/1', rule: 'Allow-Web',
  endReason: 'tcp-rst-from-server', bytes: '100000000',
  severity: 'critical', subtype: 'vulnerability', threatId: '40004',
  threatName: 'SQL Injection', action: 'reset-both',
  cve: 'CVE-2024-12345', direction: 'client-to-server',
  dstUrl: 'example.com', category: 'command-and-control',
  filename: 'sample.exe', verdict: 'malicious',
  srcuser: 'ACME\\jbloggs', reportId: '1234567890', sha256: 'a1b2c3d4e5f6...',
  authpolicy: 'Default-Auth', eventid: 'auth-success', vsys: 'vsys1',
  module: 'general', desc: 'failed',
  admin: 'admin', client: 'web', cmd: 'edit',
  path: 'rulebase.security.rules', result: 'succeeded',
  sni: 'www.example.com', tlsVersion: 'tls1.3',
  errorType: 'unsupported-cipher', decrypted: 'yes',
  event: 'gateway-auth-succ', tunnelType: 'ssl-tunnel',
  ip: '10.0.2.55', matchname: 'Windows10'
};

// Enumerable field values rendered as <select> dropdowns. A field becomes a
// dropdown when its `fields` entry carries one of these lists as a 3rd element;
// fields with open-ended values (IPs, ports, names, hashes) stay free-text.
const OPT = {
  severity:      ['critical', 'high', 'medium', 'low', 'informational'],
  endReason:     ['threat', 'policy-deny', 'tcp-rst-from-client', 'tcp-rst-from-server',
                  'tcp-fin', 'tcp-reuse', 'decrypt-cert-validation', 'decrypt-unsupport-param',
                  'decrypt-error', 'decoder', 'aged-out', 'resources-unavailable', 'unknown', 'n/a'],
  threatSubtype: ['vulnerability', 'virus', 'spyware', 'wildfire-virus', 'url', 'file',
                  'data', 'flood', 'scan', 'packet'],
  threatAction:  ['alert', 'allow', 'drop', 'reset-client', 'reset-server', 'reset-both',
                  'block-ip', 'block-url', 'sinkhole'],
  direction:     ['client-to-server', 'server-to-client'],
  urlCategory:   ['abused-drugs', 'adult', 'alcohol-and-tobacco', 'auctions',
                  'business-and-economy', 'command-and-control', 'computer-and-internet-info',
                  'content-delivery-networks', 'copyright-infringement', 'cryptocurrency',
                  'dating', 'dynamic-dns', 'educational-institutions', 'entertainment-and-arts',
                  'extremism', 'financial-services', 'gambling', 'games', 'government',
                  'grayware', 'hacking', 'health-and-medicine', 'high-risk',
                  'home-and-garden', 'hunting-and-fishing', 'insufficient-content',
                  'internet-communications-and-telephony', 'internet-portals', 'job-search',
                  'legal', 'low-risk', 'malware', 'medium-risk', 'military', 'motor-vehicles',
                  'music', 'newly-registered-domain', 'news', 'not-resolved', 'nudity',
                  'online-storage-and-backup', 'parked', 'peer-to-peer', 'personal-sites-and-blogs',
                  'philosophy-and-political-advocacy', 'phishing', 'private-ip-addresses',
                  'proxy-avoidance-and-anonymizers', 'questionable', 'real-estate',
                  'real-time-detection', 'recreation-and-hobbies', 'reference-and-research',
                  'religion', 'search-engines', 'sex-education', 'shareware-and-freeware',
                  'shopping', 'social-networking', 'society', 'sports', 'stock-advice-and-tools',
                  'streaming-media', 'swimsuits-and-intimate-apparel', 'training-and-tools',
                  'translation', 'travel', 'unknown', 'weapons', 'web-advertisements',
                  'web-based-email', 'web-hosting'],
  urlAction:     ['alert', 'allow', 'block', 'block-url', 'continue', 'override'],
  verdict:       ['malicious', 'benign', 'grayware', 'phishing'],
  authEvent:     ['auth-success', 'auth-failure'],
  sysSubtype:    ['general', 'ha', 'vpn', 'userid', 'routing', 'nat', 'auth', 'dhcp',
                  'dnsproxy', 'dos', 'globalprotect', 'ntpd', 'port', 'pppoe', 'ras',
                  'sslvpn', 'url-filtering'],
  client:        ['web', 'cli', 'panorama', 'xmlapi'],
  cmd:           ['add', 'edit', 'delete', 'move', 'set', 'rename', 'clone', 'commit', 'override'],
  result:        ['succeeded', 'failed'],
  tlsVersion:    ['tls1.0', 'tls1.1', 'tls1.2', 'tls1.3', 'unknown'],
  decrypted:     ['yes', 'no'],
  gpEvent:       ['portal-auth-succ', 'portal-auth-fail', 'gateway-auth-succ',
                  'gateway-auth-fail', 'tunnel-connect-succ', 'tunnel-disc'],
  gpTunnelType:  ['ssl-tunnel', 'ipsec'],
  tunnelType:    ['ipsec', 'gre', 'gtp', 'vxlan'],
  useridEvent:   ['add', 'delete', 'timeout']
};

const TABS = [
  // ───── Traffic ─────────────────────────────────────────────────────────
  {
    key: 'traffic',
    label: 'Traffic',
    intro: 'Monitor → Logs → <strong>Traffic</strong>. CLI: <code>show log traffic query "…"</code>.',
    fields: [
      ['srcIP', 'Src IP / CIDR'], ['dstIP', 'Dst IP / CIDR'],
      ['srcPort', 'Src port'], ['dstPort', 'Dst port'],
      ['app', 'App-ID'], ['zone', 'Zone'], ['iface', 'Interface'],
      ['rule', 'Rule name'], ['endReason', 'End reason', OPT.endReason], ['bytes', 'Bytes']
    ],
    groups: [
      { title: 'Source / destination IP', items: [
        ['Source IP',                  '( addr.src in ${srcIP} )',  'Single host or CIDR'],
        ['Destination IP',             '( addr.dst in ${dstIP} )',  'Single host or CIDR'],
        ['Either source or dest IP',   '( addr in ${srcIP} )',      'Matches the IP in either direction'],
        ['Conversation src → dst',     '( addr.src in ${srcIP} ) and ( addr.dst in ${dstIP} )', 'Specific flow between two hosts']
      ]},
      { title: 'Ports & protocol', items: [
        ['Source port',                '( port.src eq ${srcPort} )', 'Pre-NAT source port'],
        ['Destination port',           '( port.dst eq ${dstPort} )', 'e.g. 443, 22, 53'],
        ['Protocol = TCP',             '( proto eq 6 )',             'IP protocol number 6'],
        ['Protocol = UDP',             '( proto eq 17 )',            'IP protocol number 17'],
        ['Protocol = ICMP',            '( proto eq 1 )',             'IP protocol number 1'],
        ['Application',                '( app eq ${app} )',          'PAN-OS App-ID']
      ]},
      { title: 'NAT', items: [
        ['Any NAT-translated session', '( flags has nat )',          'Sessions where NAT was applied'],
        ['NAT source address',         '( natsrc in ${srcIP} )',     'Translated (post-NAT) source IP'],
        ['NAT destination address',    '( natdst in ${dstIP} )',     'Translated (post-NAT) destination IP'],
        ['NAT source port',            '( natsport eq ${srcPort} )', 'Translated source port'],
        ['NAT destination port',       '( natdport eq ${dstPort} )', 'Translated destination port']
      ]},
      { title: 'Zones & interfaces', items: [
        ['Source zone',                '( zone.src eq ${zone} )',          'e.g. trust, untrust, dmz'],
        ['Destination zone',           '( zone.dst eq ${zone} )',          'Egress zone'],
        ['Ingress interface',          '( interface.src eq ${iface} )',    'e.g. ethernet1/1'],
        ['Egress interface',           '( interface.dst eq ${iface} )',    'Outbound interface']
      ]},
      { title: 'Action, rule & sessions', items: [
        ['Action = allow',             '( action eq allow )', ''],
        ['Action = deny',              '( action eq deny )',  ''],
        ['Action = drop',              '( action eq drop )',  ''],
        ['Not allowed',                '( action neq allow )', 'Everything the firewall blocked'],
        ['Security rule name',         "( rule eq '${rule}' )", 'Quote names with spaces'],
        ['Session end reason',         '( session_end_reason eq ${endReason} )', 'tcp-fin / tcp-rst-* / threat / aged-out / policy-deny'],
        ['Bytes ≥ threshold',          '( bytes geq ${bytes} )', 'Find large transfers']
      ]},
      { title: 'Common combinations', items: [
        ['Denied traffic to a host',   '( addr.dst in ${dstIP} ) and ( action neq allow )', 'Why is X being blocked?'],
        ['Host on a specific port',    '( addr in ${srcIP} ) and ( port.dst eq ${dstPort} )', ''],
        ['Threat-terminated sessions', '( session_end_reason eq threat )', 'Sessions killed by a security profile']
      ]}
    ]
  },

  // ───── Threat ──────────────────────────────────────────────────────────
  {
    key: 'threat',
    label: 'Threat',
    intro: 'Monitor → Logs → <strong>Threat</strong>. CLI: <code>show log threat query "…"</code>.',
    fields: [
      ['severity','Severity', OPT.severity], ['subtype','Subtype', OPT.threatSubtype],
      ['threatId','Threat ID'], ['threatName','Threat name'],
      ['cve','CVE'], ['action','Action', OPT.threatAction], ['direction','Direction', OPT.direction],
      ['srcIP','Src IP'], ['dstIP','Dst IP'], ['srcuser','Src user']
    ],
    groups: [
      { title: 'Subtype & severity', items: [
        ['Subtype = vulnerability',    '( subtype eq vulnerability )', 'IPS engine hits'],
        ['Subtype = virus',            '( subtype eq virus )',         'Antivirus engine hits'],
        ['Subtype = spyware',          '( subtype eq spyware )',       'Anti-spyware hits (C2 etc.)'],
        ['Subtype = wildfire-virus',   '( subtype eq wildfire-virus )', 'WildFire-detected malware'],
        ['Subtype = url',              '( subtype eq url )',           'URL filtering hits'],
        ['Subtype = file',             '( subtype eq file )',          'File blocking'],
        ['Subtype = data',             '( subtype eq data )',          'Data filtering'],
        ['Severity (custom)',          '( severity eq ${severity} )',  'critical / high / medium / low / informational']
      ]},
      { title: 'Threat ID / signature', items: [
        ['Threat ID',                  '( threatid eq ${threatId} )', 'Numeric Threat Vault ID'],
        ['Threat name contains',       "( name-of-threatid contains '${threatName}' )", 'Substring match on the signature name'],
        ['CVE reference',              "( cve contains '${cve}' )", 'Filter for a specific CVE']
      ]},
      { title: 'Action & direction', items: [
        ['Action',                     '( action eq ${action} )', 'reset-both / reset-server / reset-client / alert / drop / block-url / sinkhole'],
        ['Allowed threats (alert only)', '( action eq alert )',   'Detection only (no block)'],
        ['Blocked threats',            '( action neq alert ) and ( action neq allow )', 'Anything actively blocked'],
        ['Direction',                  '( direction eq ${direction} )', 'client-to-server or server-to-client']
      ]},
      { title: 'Source / destination / user', items: [
        ['Source IP',                  '( addr.src in ${srcIP} )',    'Single host or CIDR'],
        ['Destination IP',             '( addr.dst in ${dstIP} )',    ''],
        ['Source user',                "( srcuser eq '${srcuser}' )", 'AD-mapped user that triggered the threat']
      ]},
      { title: 'Common combinations', items: [
        ['Critical vulnerabilities only',
          '( subtype eq vulnerability ) and ( severity eq critical )', ''],
        ['Spyware hits to a host',
          '( subtype eq spyware ) and ( addr.dst in ${dstIP} )', 'C2 callbacks to <dstIP>'],
        ['High+ threats from a user',
          "( srcuser eq '${srcuser}' ) and ( severity geq high )", '']
      ]}
    ]
  },

  // ───── URL filtering ───────────────────────────────────────────────────
  {
    key: 'url',
    label: 'URL',
    intro: 'Monitor → Logs → <strong>URL Filtering</strong> (or Threat with subtype eq url).',
    fields: [
      ['srcIP','Src IP'], ['dstUrl','URL / host substring'],
      ['category','PAN-DB category', OPT.urlCategory], ['action','Action', OPT.urlAction], ['srcuser','Src user']
    ],
    groups: [
      { title: 'Category & action', items: [
        ['Category',                   '( category eq ${category} )',  'e.g. malware, command-and-control, phishing, social-networking'],
        ['Malicious categories',
          '( category eq malware ) or ( category eq command-and-control ) or ( category eq phishing )',
          'Trio of high-risk PAN-DB categories'],
        ['Action',                     '( action eq ${action} )',      'allow / block-url / continue / override / alert'],
        ['Blocked URL hits',           '( action eq block-url )',      'Every page blocked by URL filtering']
      ]},
      { title: 'URL / host / user', items: [
        ['URL substring',              "( url contains '${dstUrl}' )", 'Match anywhere in the URL'],
        ['Source IP',                  '( addr.src in ${srcIP} )',     ''],
        ['Source user',                "( srcuser eq '${srcuser}' )",  '']
      ]},
      { title: 'Common combinations', items: [
        ['User browsing to category',
          "( srcuser eq '${srcuser}' ) and ( category eq ${category} )", ''],
        ['Blocked URLs by host',
          '( action eq block-url ) and ( addr.src in ${srcIP} )', '']
      ]}
    ]
  },

  // ───── WildFire submissions ────────────────────────────────────────────
  {
    key: 'wildfire',
    label: 'WildFire',
    intro: 'Monitor → Logs → <strong>WildFire Submissions</strong>.',
    fields: [
      ['filename','Filename'], ['verdict','Verdict', OPT.verdict],
      ['sha256','SHA-256'], ['reportId','Report ID'], ['srcuser','Src user']
    ],
    groups: [
      { title: 'Verdict', items: [
        ['Verdict',                    '( verdict eq ${verdict} )', 'malicious / benign / grayware / phishing'],
        ['Malicious only',             '( verdict eq malicious )',  ''],
        ['Phishing only',              '( verdict eq phishing )',   '']
      ]},
      { title: 'File identity', items: [
        ['Filename',                   "( filename contains '${filename}' )", 'Substring match'],
        ['SHA-256 hash',               "( filedigest eq '${sha256}' )", 'Exact file hash'],
        ['Report ID',                  '( report_id eq ${reportId} )',  'Open the analysis report']
      ]},
      { title: 'Source user', items: [
        ['Source user',                "( srcuser eq '${srcuser}' )", '']
      ]},
      { title: 'Common combinations', items: [
        ['Malicious files received by a user',
          "( verdict eq malicious ) and ( srcuser eq '${srcuser}' )", ''],
        ['All malicious + phishing',
          '( verdict eq malicious ) or ( verdict eq phishing )', '']
      ]}
    ]
  },

  // ───── Authentication ─────────────────────────────────────────────────
  {
    key: 'auth',
    label: 'Authentication',
    intro: 'Monitor → Logs → <strong>Authentication</strong>.',
    tplOver: { eventid: '( event eq $ )' },
    fields: [
      ['srcuser','Src user'], ['authpolicy','Auth policy'],
      ['eventid','Event', OPT.authEvent], ['vsys','vsys'], ['srcIP','Src IP']
    ],
    groups: [
      { title: 'Event', items: [
        ['Auth success',               '( event eq auth-success )', ''],
        ['Auth failure',               '( event eq auth-failure )', ''],
        ['Event (custom)',             '( event eq ${eventid} )',   '']
      ]},
      { title: 'User / policy / context', items: [
        ['Source user',                "( srcuser eq '${srcuser}' )", ''],
        ['Auth policy',                "( authpolicy eq '${authpolicy}' )", ''],
        ['vsys',                       '( vsys eq ${vsys} )',          ''],
        ['Source IP',                  '( addr.src in ${srcIP} )',     '']
      ]},
      { title: 'Common combinations', items: [
        ['Failures for a user',
          "( srcuser eq '${srcuser}' ) and ( event eq auth-failure )", 'Brute-force / lockout hunting'],
        ['All failures (CLI)',
          'show log authentication query "( event eq auth-failure )" direction equal backward', 'CLI variant']
      ]}
    ]
  },

  // ───── System ─────────────────────────────────────────────────────────
  {
    key: 'system',
    label: 'System',
    intro: 'Monitor → Logs → <strong>System</strong>. CLI: <code>show log system query "…"</code>.',
    fields: [
      ['severity','Severity', OPT.severity], ['subtype','Subtype', OPT.sysSubtype],
      ['module','Module'], ['eventid','Event ID'], ['desc','Description contains']
    ],
    groups: [
      { title: 'Severity', items: [
        ['Severity = critical',        '( severity eq critical )', ''],
        ['Severity ≥ high',            '( severity geq high )',    'critical + high'],
        ['Severity (custom)',          '( severity eq ${severity} )', '']
      ]},
      { title: 'Subtype', items: [
        ['Subtype = general',          '( subtype eq general )', ''],
        ['Subtype = ha',               '( subtype eq ha )',      'HA failovers, link monitor'],
        ['Subtype = vpn',              '( subtype eq vpn )',     'IPSec / GP events'],
        ['Subtype = userid',           '( subtype eq userid )',  ''],
        ['Subtype = routing',          '( subtype eq routing )', ''],
        ['Subtype = nat',              '( subtype eq nat )',     'NAT pool exhaustion'],
        ['Subtype = auth',             '( subtype eq auth )',    'Admin login etc.'],
        ['Subtype (custom)',           '( subtype eq ${subtype} )', '']
      ]},
      { title: 'Event / module / text', items: [
        ['Event ID',                   '( eventid eq ${eventid} )', ''],
        ['Module',                     '( module eq ${module} )',   ''],
        ['Description contains',       "( description contains '${desc}' )", 'Free-text substring']
      ]},
      { title: 'Common combinations', items: [
        ['HA failovers',
          '( subtype eq ha ) and ( severity geq medium )', ''],
        ['All critical events',
          '( severity eq critical )', '']
      ]}
    ]
  },

  // ───── Config ─────────────────────────────────────────────────────────
  {
    key: 'config',
    label: 'Config',
    intro: 'Monitor → Logs → <strong>Configuration</strong>. CLI: <code>show log config query "…"</code>.',
    fields: [
      ['admin','Admin'], ['client','Client', OPT.client], ['cmd','Command', OPT.cmd],
      ['path','XPath / object'], ['result','Result', OPT.result]
    ],
    groups: [
      { title: 'Admin & client', items: [
        ['Admin',                      "( admin eq '${admin}' )", ''],
        ['Web UI changes',             '( client eq web )', ''],
        ['CLI changes',                '( client eq cli )', ''],
        ['From Panorama',              '( client eq panorama )', '']
      ]},
      { title: 'Operation & target', items: [
        ['Command type',               '( cmd eq ${cmd} )', 'add / edit / delete / move / set / commit'],
        ['Path / object',              "( path contains '${path}' )", 'XPath fragment, e.g. rulebase.security.rules'],
        ['Result',                     '( result eq ${result} )', 'succeeded / failed']
      ]},
      { title: 'Common combinations', items: [
        ['All failed commits',
          '( cmd eq commit ) and ( result eq failed )', ''],
        ['Security policy edits',
          "( path contains 'rulebase.security.rules' )", 'Who touched what rule'],
        ['Changes by an admin since a time',
          "( admin eq '${admin}' ) and ( receive_time geq '2026/05/24 00:00:00' )", 'Edit the timestamp']
      ]}
    ]
  },

  // ───── Decryption ─────────────────────────────────────────────────────
  {
    key: 'decrypt',
    label: 'Decryption',
    intro: 'Monitor → Logs → <strong>Decryption</strong> (PAN-OS 10.2+).',
    fields: [
      ['srcIP','Src IP'], ['dstIP','Dst IP'], ['sni','SNI / hostname'],
      ['tlsVersion','TLS version', OPT.tlsVersion], ['errorType','Error'], ['decrypted','Decrypted', OPT.decrypted]
    ],
    groups: [
      { title: 'Decryption outcome', items: [
        ['Decrypted = yes',            '( decrypted eq yes )', ''],
        ['Decrypted = no',             '( decrypted eq no )',  ''],
        ['Any decryption error',       "( error neq '' )",     'Sessions that errored']
      ]},
      { title: 'TLS / cipher', items: [
        ['TLS version',                '( tls-version eq ${tlsVersion} )', 'tls1.0 / tls1.1 / tls1.2 / tls1.3'],
        ['SNI host',                   "( sni eq '${sni}' )", ''],
        ['Error type contains',        "( error contains '${errorType}' )", '']
      ]},
      { title: 'Source / destination', items: [
        ['Source IP',                  '( addr.src in ${srcIP} )', ''],
        ['Destination IP',             '( addr.dst in ${dstIP} )', '']
      ]},
      { title: 'Common combinations', items: [
        ['Untrusted-cert failures',
          "( decrypted eq no ) and ( error contains 'cert' )", ''],
        ['Legacy TLS sessions',
          '( tls-version eq tls1.0 ) or ( tls-version eq tls1.1 )', '']
      ]}
    ]
  },

  // ───── GlobalProtect ──────────────────────────────────────────────────
  {
    key: 'gp',
    label: 'GlobalProtect',
    intro: 'Monitor → Logs → <strong>GlobalProtect</strong>.',
    fields: [
      ['srcuser','Src user'], ['event','Event', OPT.gpEvent],
      ['srcIP','Src IP / public IP'], ['tunnelType','Tunnel type', OPT.gpTunnelType]
    ],
    groups: [
      { title: 'Events', items: [
        ['Portal auth success',        '( event-id eq portal-auth-succ )', ''],
        ['Portal auth failure',        '( event-id eq portal-auth-fail )', ''],
        ['Gateway auth success',       '( event-id eq gateway-auth-succ )', ''],
        ['Gateway auth failure',       '( event-id eq gateway-auth-fail )', ''],
        ['Tunnel connect',             '( event-id eq tunnel-connect-succ )', ''],
        ['Tunnel disconnect',          '( event-id eq tunnel-disc )', ''],
        ['Event (custom)',             '( event-id eq ${event} )', '']
      ]},
      { title: 'User / source / tunnel', items: [
        ['Source user',                "( srcuser eq '${srcuser}' )", ''],
        ['Public source IP',           '( addr.src in ${srcIP} )', "User's public IP"],
        ['Tunnel type',                '( tunnel-type eq ${tunnelType} )', 'ssl-tunnel or ipsec']
      ]},
      { title: 'Common combinations', items: [
        ['All failures for a user',
          "( srcuser eq '${srcuser}' ) and ( event-id contains 'fail' )", ''],
        ['Tunnel disconnects',
          '( event-id eq tunnel-disc )', 'Pair with a time filter']
      ]}
    ]
  },

  // ───── Tunnel inspection ──────────────────────────────────────────────
  {
    key: 'tunnel',
    label: 'Tunnel',
    intro: 'Monitor → Logs → <strong>Tunnel Inspection</strong> (GTP / IPSec / GRE inner content).',
    fields: [
      ['tunnelType','Tunnel type', OPT.tunnelType], ['srcIP','Src IP'], ['dstIP','Dst IP']
    ],
    groups: [
      { title: 'Tunnel type', items: [
        ['IPSec',                      '( tunnel-type eq ipsec )', ''],
        ['GRE',                        '( tunnel-type eq gre )',   ''],
        ['GTP',                        '( tunnel-type eq gtp )',   ''],
        ['Tunnel type (custom)',       '( tunnel-type eq ${tunnelType} )', '']
      ]},
      { title: 'Endpoints', items: [
        ['Outer source IP',            '( addr.src in ${srcIP} )', 'Outer tunnel header'],
        ['Outer destination IP',       '( addr.dst in ${dstIP} )', '']
      ]}
    ]
  },

  // ───── User-ID / HIP ──────────────────────────────────────────────────
  {
    key: 'userid',
    label: 'User-ID / HIP',
    intro: 'Monitor → Logs → <strong>User-ID</strong> and <strong>HIP Match</strong>.',
    tplOver: { event: '( event eq $ )' },
    fields: [
      ['srcuser','Src user'], ['ip','IP'], ['event','Event', OPT.useridEvent], ['matchname','HIP profile']
    ],
    groups: [
      { title: 'User-ID mapping events', items: [
        ['Mapping added',              '( event eq add )', ''],
        ['Mapping removed',            '( event eq delete )', ''],
        ['Mapping timeout',            '( event eq timeout )', ''],
        ['IP',                         '( ip eq ${ip} )', ''],
        ['User',                       "( srcuser eq '${srcuser}' )", '']
      ]},
      { title: 'HIP match', items: [
        ['HIP profile / object name',  "( matchname eq '${matchname}' )", 'Name of the matched HIP object/profile'],
        ['User',                       "( srcuser eq '${srcuser}' )", '']
      ]}
    ]
  }
];

const OPS = [
  ['eq',  'Equals'],
  ['neq', 'Not equals'],
  ['leq / geq', 'Less / greater than or equal'],
  ['in',  'IP / CIDR membership'],
  ['contains', 'Substring match'],
  ['has', 'Flag is set, e.g. flags has nat'],
  ['and / or / not', 'Logical operators'],
  ['( )', 'Group expressions; always wrap each condition']
];

// PAN-OS condition template for each field key, used by the dynamic filter
// builder. `$` is replaced with the row's value. Example values come from
// DEFAULTS. A tab may override a key via its `tplOver` (e.g. the auth log's
// "event" field uses `event` rather than `eventid`).
const TPL = {
  srcIP: '( addr.src in $ )', dstIP: '( addr.dst in $ )',
  srcPort: '( port.src eq $ )', dstPort: '( port.dst eq $ )',
  app: '( app eq $ )', zone: '( zone.src eq $ )', iface: '( interface.src eq $ )',
  rule: "( rule eq '$' )", endReason: '( session_end_reason eq $ )', bytes: '( bytes geq $ )',
  severity: '( severity eq $ )', subtype: '( subtype eq $ )',
  threatId: '( threatid eq $ )', threatName: "( name-of-threatid contains '$' )",
  cve: "( cve contains '$' )", action: '( action eq $ )', direction: '( direction eq $ )',
  srcuser: "( srcuser eq '$' )", dstUrl: "( url contains '$' )", category: '( category eq $ )',
  filename: "( filename contains '$' )", verdict: '( verdict eq $ )',
  sha256: "( filedigest eq '$' )", reportId: '( report_id eq $ )',
  authpolicy: "( authpolicy eq '$' )", eventid: '( eventid eq $ )', vsys: '( vsys eq $ )',
  module: '( module eq $ )', desc: "( description contains '$' )",
  admin: "( admin eq '$' )", client: '( client eq $ )', cmd: '( cmd eq $ )',
  path: "( path contains '$' )", result: '( result eq $ )',
  sni: "( sni eq '$' )", tlsVersion: '( tls-version eq $ )', errorType: "( error contains '$' )",
  decrypted: '( decrypted eq $ )', event: '( event-id eq $ )', tunnelType: '( tunnel-type eq $ )',
  ip: '( ip eq $ )', matchname: "( matchname eq '$' )"
};

// Condition template for a key on a given tab (honouring per-tab overrides).
function tplFor(tab, key) {
  return (tab.tplOver && tab.tplOver[key]) || TPL[key] || `( ${key} eq $ )`;
}
// Enumerable option list for a key on a tab (3rd element of its field entry).
function optsFor(tab, key) {
  const f = tab.fields.find(x => x[0] === key);
  return f && f[2];
}
// Default seed value for a key on a tab. For enumerable fields, fall back to
// the first option when the generic DEFAULT isn't one of the allowed values.
function defaultValue(tab, key) {
  const opts = optsFor(tab, key);
  const d = DEFAULTS[key] || '';
  return opts && !opts.includes(d) ? opts[0] : d;
}

function fill(tpl, vals) {
  return tpl.replace(/\$\{(\w+)\}/g, (_, k) => vals[k] || `<${k}>`);
}

export async function mount(root) {
  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Palo Alto — Log filters</h2>
    <p class="hint" style="margin-bottom:10px">Pick a log type, edit the values, copy the filter. All expressions use PAN-OS filter syntax — paste into the corresponding <em>Monitor → Logs</em> tab, or run from the CLI with <code>show log &lt;type&gt; query "…"</code>.</p>
    <nav class="sub-nav" id="lfNav" style="margin:0 -20px 14px -20px">
      ${TABS.map(t => `<button class="ftab" data-tab="${t.key}">${esc(t.label)}</button>`).join('')}
    </nav>
    <div id="lfBody"></div>
    <h3 style="font-size:13px;margin:20px 0 6px;color:var(--muted)">Operators</h3>
    <table class="tbl"><thead><tr><th style="width:140px">Operator</th><th>Meaning</th></tr></thead>
      <tbody>${OPS.map(o => `<tr><td class="mono">${esc(o[0])}</td><td>${esc(o[1])}</td></tr>`).join('')}</tbody></table>`;

  const body = root.querySelector('#lfBody');
  const nav = root.querySelector('#lfNav');
  let activeTab = TABS[0];

  // Per-tab builder state: rows (each {type, value}) plus the within-group
  // operator. Seeded lazily from each tab's fields so the default boxes mirror
  // the original fixed field set (src IP / dst IP / ports / App-ID / …).
  const tabState = {};
  function stateFor(tab) {
    if (!tabState[tab.key]) {
      tabState[tab.key] = {
        rows: tab.fields.map(f => ({ type: f[0], value: defaultValue(tab, f[0]) })),
        op: 'or'
      };
    }
    return tabState[tab.key];
  }

  function renderTab() {
    for (const b of nav.querySelectorAll('.ftab')) b.classList.toggle('active', b.dataset.tab === activeTab.key);
    body.innerHTML = `
      <div style="font-size:12px;margin-bottom:10px">${activeTab.intro}</div>
      <div id="lfCustom"></div>
      <h3 style="font-size:13px;margin:22px 0 4px;color:var(--muted)">Ready-made filters &amp; examples</h3>
      <p class="hint" style="margin:0 0 4px;font-size:11px">Curated expressions for this log type — their values track the builder above.</p>
      <div id="lfGroups"></div>`;
    renderCustom();
    renderGroups();
  }

  // Combine the active tab's rows into one PAN-OS expression: rows of the same
  // field type are joined with the chosen operator (OR/AND) and wrapped, then
  // the distinct field groups are AND-ed together.
  function buildExpr() {
    const { rows, op } = stateFor(activeTab);
    const groups = {}; const order = [];
    for (const r of rows) {
      const v = (r.value || '').trim();
      if (!v) continue;
      const expr = tplFor(activeTab, r.type).replace('$', v);
      if (!groups[r.type]) { groups[r.type] = []; order.push(r.type); }
      groups[r.type].push(expr);
    }
    const parts = order.map(t => groups[t].length === 1
      ? groups[t][0]
      : '( ' + groups[t].join(' ' + op + ' ') + ' )');
    return parts.join(' and ');
  }

  function updateExpr() {
    const out = body.querySelector('#cfOut');
    if (out) out.textContent = buildExpr() || '# Add a field value to build a filter';
    renderGroups(); // library values track the builder
  }

  function renderCustom() {
    const host = body.querySelector('#lfCustom');
    if (!host) return;
    const st = stateFor(activeTab);
    host.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
          <strong style="font-size:14px">Filter builder</strong>
          <span class="hint" style="font-size:11px">Pick a field, set a value, add more with “+”. Same field twice → joined by the operator; different fields → AND-ed.</span>
        </div>
        <div id="cfRows">
          ${st.rows.map((r, i) => rowHtml(r, i, st.rows.length)).join('')}
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">
          <button class="btn sm" id="cfAdd">+ Add field</button>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:0">Combine repeated fields with
            <select id="cfOp" style="width:auto">
              <option value="or"${st.op === 'or' ? ' selected' : ''}>OR</option>
              <option value="and"${st.op === 'and' ? ' selected' : ''}>AND</option>
            </select>
          </label>
        </div>
        <pre class="script-out" id="cfOut" style="margin-top:12px"></pre>
        <div style="margin-top:6px"><button class="btn sm primary" id="cfCopy">Copy filter</button></div>
      </div>`;
    updateExpr();
  }

  function rowHtml(r, i, total) {
    const opts = optsFor(activeTab, r.type);
    const valCtl = opts
      ? `<select data-cf-val="${i}" style="flex:1;min-width:160px">${opts.map(o => `<option${o === r.value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input type="text" data-cf-val="${i}" value="${esc(r.value)}" placeholder="${esc(DEFAULTS[r.type] || '')}" style="flex:1;min-width:160px">`;
    return `<div class="form-row" style="flex-direction:row;align-items:center;gap:8px;margin:0 0 6px;flex-wrap:wrap">
      <select data-cf-type="${i}" style="width:auto;min-width:170px" title="Field">
        ${activeTab.fields.map(f => `<option value="${f[0]}"${f[0] === r.type ? ' selected' : ''}>${esc(f[1])}</option>`).join('')}
      </select>
      ${valCtl}
      <button class="btn sm ghost" data-cf-del="${i}" title="Remove field"${total <= 1 ? ' disabled' : ''}>✕</button>
    </div>`;
  }

  function renderGroups() {
    const st = stateFor(activeTab);
    const vals = { ...DEFAULTS };
    const used = {};
    for (const r of st.rows) {
      const v = (r.value || '').trim();
      if (v && !used[r.type]) { vals[r.type] = v; used[r.type] = 1; }
    }
    const out = body.querySelector('#lfGroups');
    if (!out) return;
    out.innerHTML = activeTab.groups.map(g => `
      <h3 style="font-size:13px;margin:18px 0 6px;color:var(--muted)">${esc(g.title)}</h3>
      <table class="tbl">
        <thead><tr><th style="width:240px">Filter</th><th>Expression</th><th style="width:36px"></th></tr></thead>
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

  // Delegated click handler: builder add / remove / copy + library copy buttons.
  body.addEventListener('click', async e => {
    const st = stateFor(activeTab);
    if (e.target.closest('#cfAdd')) {
      const key = activeTab.fields[0][0];
      st.rows.push({ type: key, value: defaultValue(activeTab, key) });
      renderCustom();
      return;
    }
    const del = e.target.closest('[data-cf-del]');
    if (del) {
      const i = +del.dataset.cfDel;
      if (st.rows.length > 1) { st.rows.splice(i, 1); renderCustom(); }
      return;
    }
    const cfCopy = e.target.closest('#cfCopy');
    if (cfCopy) {
      const expr = buildExpr();
      if (!expr) { toast('Add a field value first', 'warn'); return; }
      const ok = await copyToClipboard(expr);
      const orig = cfCopy.textContent;
      cfCopy.textContent = ok ? 'Copied ✓' : 'Failed';
      if (!ok) toast('Copy failed', 'error');
      setTimeout(() => { cfCopy.textContent = orig; }, 900);
      return;
    }
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    const orig = btn.textContent;
    btn.textContent = ok ? '✓' : '✗';
    if (!ok) toast('Copy failed', 'error');
    setTimeout(() => { btn.textContent = orig; }, 900);
  });

  // Live value typing (text inputs) — recompute without re-rendering (keeps focus).
  body.addEventListener('input', e => {
    const inp = e.target.closest('input[data-cf-val]');
    if (!inp) return;
    const r = stateFor(activeTab).rows[+inp.dataset.cfVal];
    if (r) { r.value = inp.value; updateExpr(); }
  });

  // Dropdown changes: value <select>, field-type <select>, or the operator.
  body.addEventListener('change', e => {
    const st = stateFor(activeTab);
    const valSel = e.target.closest('select[data-cf-val]');
    if (valSel) {
      const r = st.rows[+valSel.dataset.cfVal];
      if (r) { r.value = valSel.value; updateExpr(); }
      return;
    }
    const typeSel = e.target.closest('[data-cf-type]');
    if (typeSel) {
      const r = st.rows[+typeSel.dataset.cfType];
      if (!r) return;
      const newType = typeSel.value;
      // Swap in the new field's example unless the user typed a custom value.
      if ((r.value || '').trim() === '' || r.value === defaultValue(activeTab, r.type)) r.value = defaultValue(activeTab, newType);
      r.type = newType;
      renderCustom();
      return;
    }
    const op = e.target.closest('#cfOp');
    if (op) { st.op = op.value; updateExpr(); }
  });

  nav.addEventListener('click', e => {
    const b = e.target.closest('.ftab');
    if (!b) return;
    activeTab = TABS.find(t => t.key === b.dataset.tab) || TABS[0];
    renderTab();
  });

  renderTab();
}
