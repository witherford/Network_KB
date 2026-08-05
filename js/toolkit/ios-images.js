// Cisco software image naming — reference for every major train (classic IOS,
// IOS XE, IOS XR, NX-OS, AireOS, ASA/FTD, AP images) plus a decoder that takes
// a filename and explains each segment.
//
// The decoder is a chain of per-family matchers tried most-specific first;
// each returns { family, headline, rows, notes } or null. Everything is
// offline — no lookups, no network.

import { esc, copyToClipboard, debounce, toast } from '../utils.js';

// ---------------------------------------------------------------------------
// Shared dictionaries
// ---------------------------------------------------------------------------

// Classic IOS "run from / compression" field, e.g. the mz in -mz.124-24.T8
const RUN_LOCATION = {
  f: 'runs from Flash',
  m: 'runs from RAM (copied out of flash at boot)',
  r: 'runs from ROM',
  l: 'relocatable — moved to RAM by the bootloader'
};
const COMPRESSION = {
  z: 'zip compressed',
  x: 'mzip compressed',
  w: 'STAC compressed',
  c: 'compressed (older scheme)'
};

// Packaged feature sets (12.3+ naming and the modern universal images)
const FEATURE_SETS = {
  ipbase:          'IP Base — basic IP routing, no advanced services',
  ipbasek9:        'IP Base with strong crypto (3DES/AES)',
  ipvoice:         'IP Voice — IP Base plus voice/VoIP features',
  ipvoicek9:       'IP Voice with strong crypto',
  ipservices:      'IP Services — adds full routing, IPX/AppleTalk-era extras',
  ipservicesk9:    'IP Services with strong crypto',
  advsecurity:     'Advanced Security — firewall, IPS, IPsec VPN',
  advsecurityk9:   'Advanced Security with strong crypto',
  advipservices:   'Advanced IP Services — IP Services + Advanced Security',
  advipservicesk9: 'Advanced IP Services with strong crypto',
  spservices:      'SP Services — MPLS, L2/L3 VPN, service-provider features',
  spservicesk9:    'SP Services with strong crypto',
  entbase:         'Enterprise Base — multiprotocol routing, no security',
  entservices:     'Enterprise Services — Enterprise Base + IP Services',
  entservicesk9:   'Enterprise Services with strong crypto',
  adventerprise:   'Advanced Enterprise Services — everything Cisco ships in one image',
  adventerprisek9: 'Advanced Enterprise Services with strong crypto',
  lanlite:         'LAN Lite — cut-down L2 switching feature set',
  lanlitek9:       'LAN Lite with strong crypto',
  lanbase:         'LAN Base — L2 switching plus basic L3 (static/RIP)',
  lanbasek9:       'LAN Base with strong crypto',
  universal:       'Universal — every feature set in one image, unlocked by licence',
  universalk9:     'Universal image with strong crypto — features unlocked by licence',
  universalk9_npe: 'Universal, No Payload Encryption — export-restricted build with data-plane crypto removed',
  universalk9_wlc: 'Universal image for a wireless LAN controller personality (Catalyst 9800)',
  universalk9_ldpe:'Universal, Lightweight Data Payload Encryption — export-restricted build',
  universald:      'Universal image, development build',
  metroipaccess:   'Metro IP Access — metro Ethernet aggregation feature set',
  metrobase:       'Metro Base — entry metro Ethernet feature set',
  ucmk9:           'Unified Communications image with strong crypto'
};

// Single/short letter feature codes from the 11.x/12.x era
const LETTER_CODES = [
  ['i',   'IP — basic IP routing'],
  ['s',   'PLUS — extras such as NAT, IBM, and additional protocols'],
  ['j',   'Enterprise — the full multiprotocol feature set'],
  ['d',   'Desktop — IP, IPX, AppleTalk and DECnet'],
  ['b',   'AppleTalk'],
  ['n',   'IPX (Novell)'],
  ['a',   'APPN'],
  ['p',   'Service Provider'],
  ['c',   'Remote-access server subset'],
  ['g',   'ISDN subset'],
  ['q',   'Async'],
  ['f',   'FRAD — Frame Relay access device'],
  ['v',   'Voice'],
  ['y',   'Reduced IP — trimmed to fit small flash'],
  ['o',   'Firewall / IDS (usually written o3)'],
  ['k8',  'Weak crypto — 56-bit DES (export image)'],
  ['k9',  'Strong crypto — 3DES / AES'],
  ['40',  '40-bit encryption'],
  ['56',  '56-bit encryption']
];

// Classic IOS release trains
const TRAINS = {
  T:   'Technology train — new features land here first, shorter support life',
  M:   'Extended Maintenance (15.x) — long-lived, bug-fix only. The safe choice for production',
  E:   'Enterprise / Catalyst switching train',
  S:   'Service Provider train',
  SE:  'Catalyst switching train (2960/3560/3750 family)',
  SG:  'Catalyst 4500 train',
  SX:  'Catalyst 6500 / 7600 train',
  SY:  'Catalyst 6500 Supervisor 2T train',
  SR:  'Router service-provider train (7600 / ASR)',
  SB:  'Broadband aggregation train (10000 / 7200)',
  EA:  'Catalyst access switching train',
  EW:  'Catalyst 4500 early-deployment train',
  EX:  'Catalyst early-deployment train',
  EY:  'Catalyst early-deployment train',
  EZ:  'Catalyst early-deployment train',
  JA:  'Aironet access-point train',
  JB:  'Aironet access-point train',
  JD:  'Aironet access-point train',
  JX:  'Aironet access-point train',
  XB:  'Early-deployment train (short-lived)',
  YA:  'Special/limited-deployment train'
};

// IOS XE 16.x/17.x marketing train names
const XE_TRAINS = [
  [16, 1, 16, 3,  'Denali'],
  [16, 4, 16, 6,  'Everest'],
  [16, 7, 16, 9,  'Fuji'],
  [16, 10, 16, 12, 'Gibraltar'],
  [17, 1, 17, 3,  'Amsterdam'],
  [17, 4, 17, 6,  'Bengaluru'],
  [17, 7, 17, 9,  'Cupertino'],
  [17, 10, 17, 12, 'Dublin']
];
// Extended-maintenance trains — every fourth release, supported far longer.
const XE_EM = ['16.6', '16.9', '16.12', '17.3', '17.6', '17.9', '17.12', '17.15'];

// IOS XR package (composite) names
const XR_PACKAGES = {
  mini:    'Mini — base OS, routing and the essential drivers',
  full:    'Full — mini plus every optional package',
  fullk9:  'Full image including the k9 security package',
  mgbl:    'Manageability — XML/netconf agents, Craft/telemetry tooling',
  mcast:   'Multicast — PIM, MSDP, IGMP/MLD',
  mpls:    'MPLS — LDP, RSVP-TE, L2/L3 VPN',
  k9sec:   'Security — SSH, SSL, IPsec (strong crypto, export controlled)',
  optic:   'Optics — DWDM / transponder line-card support',
  li:      'Lawful Intercept',
  fpd:     'Field-Programmable Device firmware',
  doc:     'Documentation package',
  infra:   'Infrastructure package',
  bng:     'Broadband Network Gateway subscriber management',
  video:   'Video monitoring / VidMon'
};
const XR_ARCH = {
  px:   '32-bit ("px") build — classic XR on PowerPC-era route processors',
  x64:  '64-bit build — modern XR (6.x 64-bit and XR7)',
  x:    '64-bit build',
  p:    'Bundled package build'
};
const XR_FILETYPES = {
  vm:  'Bootable virtual-machine/turboboot image',
  pie: 'PIE — Package Installation Envelope, the classic XR install unit',
  iso: 'Full bootable ISO (also how a Golden ISO / GISO is shipped)',
  rpm: 'RPM — the XR7 install unit, installed with install package',
  tar: 'Bundle/archive of several install units',
  smu: 'SMU — Software Maintenance Update (a single-bug patch)'
};

// NX-OS platform prefixes
const NXOS_PLATFORMS = {
  nxos:         'Nexus 9000 / 3000 unified image (32-bit)',
  'nxos64-cs':  'Nexus 9000 64-bit image for Cloud Scale line cards (10.2+)',
  'nxos64-msll':'Nexus 9500 64-bit image for legacy (non-Cloud-Scale) line cards',
  nxos64:       'Nexus 64-bit image',
  n9000:        'Nexus 9000 (pre-7.0(3)I2 split image)',
  n7000:        'Nexus 7000',
  n7700:        'Nexus 7700',
  n6000:        'Nexus 6000',
  n5000:        'Nexus 5000 / 5500',
  n3000:        'Nexus 3000',
  n1000v:       'Nexus 1000V virtual switch',
  m9100:        'MDS 9100 fabric switch (NX-OS/SAN-OS)',
  m9200:        'MDS 9200 fabric switch',
  m9500:        'MDS 9500 director'
};

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

// '124-24.T8' → { pretty: '12.4(24)T8', train: 'T', rebuild: '8' }
function parseClassicVersion(v) {
  const m = /^(\d{2})(\d)-(\d+[a-z]?)(?:\.([A-Za-z]+)(\d*[a-z]?))?$/.exec(v);
  if (!m) return null;
  const [, maj, min, rel, train, rebuild] = m;
  return {
    pretty: `${maj}.${min}(${rel})${train || ''}${rebuild || ''}`,
    maj, min, rel, train: train || '', rebuild: rebuild || ''
  };
}

// 17.09.04a → { pretty: '17.9.4a', train: 'Cupertino', em: true }
function parseXeVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)([a-z]?)$/.exec(v);
  if (!m) return null;
  const maj = +m[1], min = +m[2], pt = +m[3];
  let train = '';
  for (const [a1, b1, a2, b2, name] of XE_TRAINS) {
    const val = maj * 100 + min;
    if (val >= a1 * 100 + b1 && val <= a2 * 100 + b2) { train = name; break; }
  }
  return {
    pretty: `${maj}.${min}.${pt}${m[4]}`,
    branch: `${maj}.${min}`,
    train,
    rebuild: m[4],
    em: XE_EM.includes(`${maj}.${min}`)
  };
}

// NX-OS dotted filename version → the form the CLI shows.
// 7.0.3.I7.9 → 7.0(3)I7(9) · 9.3.10 → 9.3(10) · 10.2.5.M → 10.2(5)M
function parseNxosVersion(v) {
  const p = v.split('.');
  if (p.length >= 5 && /^[A-Z]+\d+$/.test(p[3])) return `${p[0]}.${p[1]}(${p[2]})${p[3]}(${p.slice(4).join('.')})`;
  if (p.length === 4 && /^[A-Z]+$/.test(p[3]))   return `${p[0]}.${p[1]}(${p[2]})${p[3]}`;
  if (p.length === 4 && /^[A-Z]+\d+$/.test(p[3]))return `${p[0]}.${p[1]}(${p[2]})${p[3]}`;
  if (p.length === 3) return `${p[0]}.${p[1]}(${p[2]})`;
  return v;
}

// ---------------------------------------------------------------------------
// Per-family decoders. Each returns null when the name isn't theirs.
// ---------------------------------------------------------------------------

function decodeAireos(n) {
  const m = /^AIR-(CT\d+|WLC\d+|CTVM)-?(LDPE)?-(K9)-(\d+)-(\d+)-(\d+)-(\d+)\.aes$/i.exec(n);
  if (!m) return null;
  const [, model, ldpe, k9, a, b, c, d] = m;
  const rows = [
    ['AIR', 'AIR', 'Cisco wireless product family'],
    [model, model, `Controller model — ${/VM/i.test(model) ? 'virtual WLC' : model.replace(/CT/i, 'Series ') + ' AireOS controller'}`]
  ];
  if (ldpe) rows.push([ldpe, ldpe, 'Lightweight Data Payload Encryption — export-restricted build with DTLS data encryption removed']);
  rows.push(
    [k9, k9, 'Strong crypto image (the normal, unrestricted build)'],
    [`${a}-${b}-${c}-${d}`, `${a}.${b}.${c}.${d}`, 'AireOS version — major.minor.maintenance.build'],
    ['.aes', '.aes', 'Encrypted AireOS controller image, uploaded to the WLC by TFTP/FTP/SFTP']
  );
  return {
    family: 'AireOS (Wireless LAN Controller)',
    headline: `AireOS ${a}.${b}.${c}.${d} for the ${model} controller`,
    rows,
    notes: [
      'A Field Upgrade Software (FUS) file uses the same naming but a much lower version (for example 1.x.y) — it updates the bootloader/field recovery images, not the OS.',
      'AireOS is end-of-development on most platforms; the successor is the Catalyst 9800 running IOS XE.'
    ]
  };
}

function decodeApImage(n) {
  const m = /^([a-z0-9]+)-(rcv)?(k9w[78])-(tar|mx|mz)\.(.+)\.(tar|bin)$/i.exec(n);
  if (!m) return null;
  const [, plat, rcv, fs, fmt, ver, ext] = m;
  const cv = parseClassicVersion(ver);
  const rows = [
    [plat, plat, `Access-point platform code (for example ap3g2 = 802.11n second generation, c1140 = Aironet 1140)`]
  ];
  if (rcv) rows.push(['rcv', 'rcv', 'Recovery image — the small image the AP boots to rejoin a controller']);
  rows.push([fs, fs, fs.toLowerCase() === 'k9w7'
    ? 'Autonomous (standalone IOS) access-point image with crypto'
    : 'Lightweight CAPWAP image with crypto — the AP registers to a controller']);
  rows.push([fmt, fmt, fmt === 'tar' ? 'Archive containing the image plus web/web-auth files' : `Run/compression field — ${RUN_LOCATION[fmt[0]] || fmt[0]}, ${COMPRESSION[fmt[1]] || 'uncompressed'}`]);
  rows.push([ver, cv ? cv.pretty : ver, cv
    ? `IOS version ${cv.pretty}${cv.train ? ` — ${TRAINS[cv.train] || 'Aironet train'}` : ''}`
    : 'IOS version']);
  rows.push([`.${ext}`, `.${ext}`, ext === 'tar' ? 'Extracted onto the AP with archive download-sw' : 'Binary image']);
  return {
    family: 'Aironet access-point image',
    headline: `${fs.toLowerCase() === 'k9w7' ? 'Autonomous' : 'Lightweight (CAPWAP)'} AP image${cv ? `, IOS ${cv.pretty}` : ''}`,
    rows,
    notes: [
      'k9w7 = autonomous, k9w8 = lightweight. Converting between modes means loading the other image — rcvk9w8 is the lightweight recovery image used when an AP cannot find a controller.',
      'Newer 802.11ac Wave 2 and Wi-Fi 6 APs run AP-COS instead and take their software from the controller, so you rarely handle these files directly.'
    ]
  };
}

function decodeAsa(n) {
  const asdm = /^asdm-(\d{3,5})\.bin$/i.exec(n);
  if (asdm) {
    const d = asdm[1];
    const pretty = d.length >= 4 ? `${d[0]}.${d.slice(1, 3)}(${d.slice(3)})` : `${d[0]}.${d[1]}(${d.slice(2)})`;
    return {
      family: 'ASDM (ASA device manager)',
      headline: `ASDM ${pretty}`,
      rows: [
        ['asdm', 'asdm', 'Adaptive Security Device Manager — the ASA’s Java GUI'],
        [d, pretty, 'Version — first digit major, then minor, then the maintenance build'],
        ['.bin', '.bin', 'Uploaded to ASA flash and pointed at with the asdm image command']
      ],
      notes: ['ASDM and ASA versions move independently — check the compatibility matrix before upgrading only one.']
    };
  }
  const m = /^asa([\d-]+?)-(smp-)?(lfbff-)?(k8|k9)\.(bin|SPA|spa)$/i.exec(n);
  if (!m) return null;
  const [, raw, smp, lfbff, k, ext] = m;
  let pretty;
  if (raw.includes('-')) {
    const p = raw.split('-');
    pretty = `${p[0]}.${p[1]}(${p[2] || 0})${p.slice(3).join('.')}`;
  } else {
    pretty = `${raw[0]}.${raw[1]}(${raw.slice(2)})`;
  }
  const rows = [
    ['asa', 'asa', 'Adaptive Security Appliance system software'],
    [raw, pretty, 'Version — dashes replace the dots and brackets the CLI shows']
  ];
  if (smp) rows.push(['smp', 'smp', 'Symmetric multiprocessing build — for multi-core ASA platforms']);
  if (lfbff) rows.push(['lfbff', 'lfbff', 'Linux Firmware Binary File Format — the packaging used by the 5500-X generation']);
  rows.push([k, k, k.toLowerCase() === 'k9'
    ? 'Strong crypto (3DES/AES) — the normal build'
    : 'Export build limited to DES']);
  rows.push([`.${ext}`, `.${ext}`, /spa/i.test(ext) ? 'Digitally signed production image' : 'Binary image']);
  return {
    family: 'Cisco ASA',
    headline: `ASA ${pretty}`,
    rows,
    notes: ['ASA and FTD are different operating systems on the same hardware — an asa*.bin will not install on a device running FTD.']
  };
}

function decodeFtdFxos(n) {
  const rows = [];
  let family, headline, ver = '';

  let m = /^fxos(?:-(k9))?\.([\d.]+)\.(SPA|spa)$/i.exec(n);
  if (m) {
    ver = m[2];
    family = 'FXOS (Firepower eXtensible OS)';
    headline = `FXOS ${ver}`;
    rows.push(['fxos', 'fxos', 'The chassis supervisor OS on Firepower 4100/9300 — hosts the ASA or FTD logical device']);
    if (m[1]) rows.push([m[1], m[1], 'Strong crypto build']);
  }
  if (!family && (m = /^cisco-(ftd|asa)-?([a-z0-9]+)?\.([\d.]+)\.(SPA|spa)$/i.exec(n))) {
    const isFtd = m[1].toLowerCase() === 'ftd';
    ver = m[3];
    family = isFtd ? 'FTD (Firepower Threat Defense)' : 'ASA on Firepower hardware';
    headline = `${isFtd ? 'FTD' : 'ASA'} ${ver} install/reimage package`;
    rows.push([`cisco-${m[1]}`, `cisco-${m[1]}`, isFtd
      ? 'Firepower Threat Defense — the unified NGFW image'
      : 'ASA software packaged for Firepower appliance hardware']);
    if (m[2]) rows.push([m[2], m[2], 'Platform target — fp2k = Firepower 2100, fp1k = 1100, fp3k = 3100, no token = virtual/generic']);
  }
  if (!family && (m = /^Cisco_(FTD|FMC|FTD_SSP\w*)[-_]?\w*Upgrade-([\d.]+)-(\d+)\.sh\.REL\.tar$/i.exec(n))) {
    ver = m[2];
    family = 'FTD / FMC upgrade package';
    headline = `${m[1].replace(/_/g, ' ')} upgrade to ${ver}`;
    rows.push([`Cisco_${m[1]}`, `Cisco_${m[1]}`, 'Upgrade (not reimage) package — pushed from FMC or applied locally, configuration is preserved']);
    rows.push([m[3], m[3], 'Build number']);
    rows.push(['.sh.REL.tar', '.sh.REL.tar', 'Signed release tarball wrapping the upgrade script']);
  }
  if (!family) return null;

  rows.push([ver, ver, 'Version — major.minor.maintenance(.build)']);
  if (/\.SPA$/i.test(n)) rows.push(['.SPA', '.SPA', 'Digitally Signed, Production build, signed with the Cisco production key']);
  return { family, headline, rows, notes: [
    'Reimage packages replace the whole OS and wipe configuration; upgrade packages preserve it. The filename is the only obvious difference — check before you push it.',
    'On 4100/9300 the FXOS version and the logical-device (ASA or FTD) version are upgraded separately and each has its own compatibility matrix.'
  ] };
}

function decodeNxos(n) {
  const m = /^(nxos64-cs|nxos64-msll|nxos64|nxos|n\d{4}v?|m9\d{3})[.-](.+)\.bin$/i.exec(n);
  if (!m) return null;
  const plat = m[1].toLowerCase();
  let rest = m[2];
  const rows = [[m[1], m[1], NXOS_PLATFORMS[plat] || 'Nexus / MDS platform family']];

  // Optional sup / feature / role tokens before the version
  let role = '';
  const tokens = [];
  while (true) {
    const t = /^([a-z0-9]+)[.-](.*)$/i.exec(rest);
    if (!t || /^\d/.test(t[1])) break;
    tokens.push(t[1]);
    rest = t[2];
  }
  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (tl === 'kickstart') {
      role = 'kickstart';
      rows.push([t, t, 'Kickstart image — the Linux kernel and bootloader half of a split NX-OS install']);
    } else if (/^s\d/.test(tl)) {
      rows.push([t, t, `Supervisor generation — ${tl.toUpperCase()} (an image built for that sup module)`]);
    } else if (tl === 'dk9') {
      rows.push([t, t, 'Strong crypto (3DES) system image']);
    } else if (tl === 'uk9') {
      rows.push([t, t, 'Universal image with strong crypto']);
    } else if (tl === 'mz') {
      rows.push([t, t, 'Runs from RAM, zip compressed (classic IOS-style format field)']);
    } else if (tl.includes('k9')) {
      rows.push([t, t, 'Strong crypto build']);
    } else {
      rows.push([t, t, 'Platform / feature qualifier']);
    }
  }
  const pretty = parseNxosVersion(rest);
  rows.push([rest, pretty, `NX-OS version — the CLI reports this as ${pretty}`]);
  rows.push(['.bin', '.bin', 'NX-OS image, copied to bootflash: and selected with boot nxos']);
  if (!role) rows.push(['(no kickstart)', 'system image', 'Nothing marks this as a kickstart, so it is a combined system image — Nexus 9000/3000 have shipped a single file since 7.0(3)I2']);
  return {
    family: 'NX-OS (Nexus / MDS)',
    headline: `NX-OS ${pretty} — ${NXOS_PLATFORMS[plat] || 'Nexus platform'}${role ? ` (${role} half)` : ''}`,
    rows,
    notes: [
      'Nexus 7000/5000 and MDS need a matched kickstart + system pair; loading mismatched halves leaves the switch in the loader.',
      'The letter block in a version such as 7.0(3)I7(9) is the platform train — I = Nexus 9000/3000, N = Nexus 5000/6000, D = Nexus 7000 M-series.',
      'Run the compact image (or copy … compact) on switches with small bootflash — it is the same software, repacked.'
    ]
  };
}

function decodeXr(n) {
  if (!/^(asr9k|ncs\d*|crs|xrv9k|xrvr|8000|xr|iosxr|cisco-iosxr)[-.]/i.test(n)) return null;
  if (!/\.(pie|iso|rpm|tar|vm)\b/i.test(n)) return null;

  // Pull the version, SMU id and file type out first — splitting on every dot
  // would tear "6.5.3" into three tokens. The type marker can be the extension
  // (…-7.3.2.iso) or sit mid-name (asr9k-mgbl-px.pie-6.5.3).
  let work = n, ext = '';
  const tailM = /\.(pie|iso|rpm|tar)$/i.exec(work);
  if (tailM) {
    ext = tailM[1];
    work = work.slice(0, tailM.index);
  } else {
    const midM = /\.(pie|vm|iso|rpm|tar)\b/i.exec(work);
    if (midM) {
      ext = midM[1];
      work = work.slice(0, midM.index) + '-' + work.slice(midM.index + midM[0].length);
    }
  }

  const verM = /(\d+\.\d+\.\d+[a-z]?\d*)/.exec(work);
  const version = verM ? verM[1] : '';
  if (verM) work = work.slice(0, verM.index) + '-' + work.slice(verM.index + verM[1].length);
  const smuM = /(CSC[a-z]{2}\d+)/i.exec(work);
  const smu = smuM ? smuM[1] : '';
  if (smuM) work = work.replace(smuM[1], '-');

  const rows = [];
  for (const t of work.split(/[-.]+/).filter(Boolean)) {
    const tl = t.toLowerCase();
    if (XR_PACKAGES[tl]) { rows.push([t, t, XR_PACKAGES[tl]]); continue; }
    if (XR_ARCH[tl]) { rows.push([t, t, XR_ARCH[tl]]); continue; }
    if (XR_FILETYPES[tl]) continue; // handled by the extension row
    if (!rows.length) {
      rows.push([t, t, `Platform — ${/^asr9k/i.test(t) ? 'ASR 9000' : /^ncs/i.test(t) ? 'Network Convergence System' : /^xrv9k/i.test(t) ? 'XRv 9000 virtual router' : /^crs/i.test(t) ? 'Carrier Routing System' : /^8000/.test(t) ? 'Cisco 8000 (XR7)' : 'IOS XR platform'}`]);
      continue;
    }
    rows.push([t, t, 'Package / qualifier']);
  }
  if (version) rows.push([version, version, `IOS XR version — major.minor.maintenance${/^7/.test(version) ? ' (7.x = XR7 on 64-bit platforms)' : ''}`]);
  if (smu) rows.push([smu, smu, 'Bug ID the SMU fixes — a Software Maintenance Update patches one defect without a full upgrade']);
  if (ext) rows.push([`.${ext}`, `.${ext}`, XR_FILETYPES[ext.toLowerCase()] || 'IOS XR install unit']);
  return {
    family: 'IOS XR',
    headline: `IOS XR ${version || ''}${smu ? ' SMU' : ''}`.trim(),
    rows,
    notes: [
      'Classic 32-bit XR installs composite PIEs with install add / install activate; 64-bit XR and XR7 install RPMs and full ISOs the same way but with a flat package list.',
      'A Golden ISO (GISO) is a base ISO rebuilt with SMUs and optional packages baked in — the filename still ends .iso, so track what went into it.'
    ]
  };
}

// IOS XE 3.x — carries both an XE version and the IOS version it maps to.
function decodeXeLegacy(n) {
  const m = /^([A-Za-z0-9_-]+?)[.-]([a-z0-9_]*?)\.?(?:SPA\.)?(0\d\.\d\d\.\d\d)\.([A-Z])\.(\d{3}-\d+\.[A-Z0-9]+)(-ext)?\.(bin|pkg)$/.exec(n);
  if (!m) return null;
  const [, plat, pkg, xeVer, train, iosVer, ext, filetype] = m;
  const cv = parseClassicVersion(iosVer);
  const xePretty = xeVer.replace(/^0/, '').replace(/\.0(\d)/g, '.$1');
  const rows = [[plat, plat, 'Platform / route-processor the image is built for']];
  if (pkg) rows.push([pkg, pkg, FEATURE_SETS[pkg] || 'Feature set / package']);
  rows.push(
    [xeVer, xePretty, 'IOS XE version (the 3.x numbering used before XE 16)'],
    [train, train, TRAINS[train] || 'Release train'],
    [iosVer, cv ? cv.pretty : iosVer, `The classic IOS version running inside this XE release${cv ? ` — ${cv.pretty}` : ''}`]
  );
  if (ext) rows.push(['-ext', '-ext', 'Extended/consolidated package variant']);
  rows.push([`.${filetype}`, `.${filetype}`, filetype === 'pkg' ? 'Sub-package (part of a split install)' : 'Consolidated bootable package']);
  return {
    family: 'IOS XE 3.x',
    headline: `IOS XE ${xePretty}${train} (IOS ${cv ? cv.pretty : iosVer})`,
    rows,
    notes: ['XE 3.x quoted two versions: the XE release and the IOS release inside it. XE 16 dropped the dual numbering and re-based on 16.x.']
  };
}

function decodeXe(n) {
  const m = /^(.+?)\.(\d{2}\.\d{2}\.\d{2}[a-z]?)\.(SPA|SSA)\.(bin|pkg|conf|iso)$/i.exec(n);
  if (!m) return null;
  const [, prefix, rawVer, sign, filetype] = m;
  const ver = parseXeVersion(rawVer.replace(/\.0(\d)/g, '.$1'));

  // Split the prefix into platform + package on the last dash, when the tail
  // looks like a feature set (cat9k_iosxe has no package token at all).
  let plat = prefix, pkg = '';
  const dash = prefix.lastIndexOf('-');
  if (dash > 0) {
    const tail = prefix.slice(dash + 1);
    if (FEATURE_SETS[tail.toLowerCase()] || /k9|universal|ipbase|lanbase|noli/i.test(tail)) {
      plat = prefix.slice(0, dash);
      pkg = tail;
    }
  }
  const rows = [[plat, plat, `Platform — ${plat.replace(/_/g, ' ')}${/iosxe/i.test(plat) ? ' (the _iosxe suffix marks the unified IOS XE image)' : ''}`]];
  if (pkg) {
    const base = pkg.toLowerCase();
    rows.push([pkg, pkg, FEATURE_SETS[base] || (base.includes('npe')
      ? 'Universal image, No Payload Encryption — data-plane crypto removed for export-restricted destinations'
      : 'Feature set / package')]);
  }
  rows.push([rawVer, ver ? ver.pretty : rawVer, ver
    ? `IOS XE ${ver.pretty}${ver.train ? ` — ${ver.train} train` : ''}${ver.em ? ' · Extended Maintenance release' : ''}${ver.rebuild ? ` · "${ver.rebuild}" marks a rebuild of ${ver.branch}.${rawVer.split('.')[2].replace(/^0/, '').replace(/[a-z]$/, '')}` : ''}`
    : 'IOS XE version']);
  rows.push([sign, sign, sign === 'SPA'
    ? 'Signed · Production · signed with the Cisco production key (SSA = special/engineering build)'
    : 'Signed special/engineering build — not for production']);
  rows.push([`.${filetype}`, `.${filetype}`, filetype === 'pkg'
    ? 'Sub-package from a split (consolidated) install'
    : filetype === 'conf' ? 'Package provisioning file listing the sub-packages'
    : 'Bootable consolidated image']);
  return {
    family: 'IOS XE',
    headline: `IOS XE ${ver ? ver.pretty : rawVer}${ver && ver.train ? ` (${ver.train})` : ''}${ver && ver.em ? ' — Extended Maintenance' : ''}`,
    rows,
    notes: [
      'Extended Maintenance releases (16.6, 16.9, 16.12, 17.3, 17.6, 17.9, 17.12, 17.15) get bug fixes for far longer than the trains between them — they are the ones to standardise on.',
      'INSTALL mode expands the .bin into packages and boots from packages.conf; BUNDLE mode boots the .bin directly. Check show version | include Mode before planning an upgrade.'
    ]
  };
}

function decodeClassicIos(n) {
  const m = /^([a-z0-9_]+)-([a-z0-9_]+)-([a-z]{1,3})\.(.+?)(?:\.bin)?$/i.exec(n);
  if (!m) return null;
  const [, plat, fs, fmt, ver] = m;
  const cv = parseClassicVersion(ver);
  if (!cv) return null;

  const fsl = fs.toLowerCase();
  let fsMeaning = FEATURE_SETS[fsl];
  if (!fsMeaning) {
    // Old-style letter codes: decode what we recognise, longest code first.
    const found = [];
    let s = fsl;
    while (s.length) {
      const hit = LETTER_CODES.find(([c]) => s.startsWith(c) && c.length === 2) ||
                  LETTER_CODES.find(([c]) => s.startsWith(c));
      if (hit) { found.push(`${hit[0]} = ${hit[1]}`); s = s.slice(hit[0].length); }
      else s = s.slice(1);
    }
    fsMeaning = found.length ? found.join(' · ') : 'Feature set';
  }

  const runs = RUN_LOCATION[fmt[0].toLowerCase()] || 'run location';
  const comp = fmt[1] ? (COMPRESSION[fmt[1].toLowerCase()] || 'compression') : 'not compressed';

  const rows = [
    [plat, plat, `Hardware platform — for example c2800nm = 2800 with network module support, c3560 = Catalyst 3560`],
    [fs, fs, fsMeaning],
    [fmt, fmt, `Run/format field — ${runs}, ${comp}`],
    [ver, cv.pretty, `IOS version ${cv.pretty} — release ${cv.rel} of ${cv.maj}.${cv.min}`]
  ];
  if (cv.train) rows.push([cv.train, cv.train, TRAINS[cv.train] || 'Release train']);
  if (cv.rebuild) rows.push([cv.rebuild, cv.rebuild, `Rebuild ${cv.rebuild} — a bug-fix respin of ${cv.maj}.${cv.min}(${cv.rel})${cv.train}`]);
  rows.push(['.bin', '.bin', 'Executable IOS image']);
  return {
    family: 'Classic IOS (12.x / 15.x)',
    headline: `IOS ${cv.pretty} for ${plat}`,
    rows,
    notes: [
      'k9 in the feature set means strong crypto (3DES/AES) and needs an export-compliant account to download.',
      cv.train === 'M' ? 'M is an Extended Maintenance release — the long-support choice for production.'
        : cv.train === 'T' ? 'T is the technology train: new features first, but a shorter support life than the M releases.'
        : 'The letters after the release number are the train — they tell you which platform family and support policy the image follows.'
    ]
  };
}

function decodeFallback(n) {
  const rows = [];
  const push = (t, why) => { if (n.toLowerCase().includes(t.toLowerCase())) rows.push([t, t, why]); };
  push('k9', 'Strong crypto build (3DES/AES) — export controlled');
  push('k8', 'Weak crypto build limited to DES');
  push('npe', 'No Payload Encryption — data-plane crypto removed for export-restricted destinations');
  push('universal', 'Universal image — all feature sets present, unlocked by licence');
  push('SPA', 'Digitally Signed, Production build');
  push('SSA', 'Signed special/engineering build — not for production');
  push('kickstart', 'Kickstart half of a split NX-OS install');
  push('smp', 'Symmetric multiprocessing build');
  const ver = /(\d+[._-]\d+[._-]\d+[a-z]?)/.exec(n);
  if (ver) rows.push([ver[1], ver[1], 'Looks like the version field']);
  const ext = /\.([a-z][a-z0-9]*)$/i.exec(n);
  if (ext) rows.push([`.${ext[1]}`, `.${ext[1]}`, 'File type']);
  return {
    family: 'Not recognised',
    headline: 'That name did not match a known Cisco image pattern',
    rows,
    notes: [
      'Check for a typo, or that the whole filename was pasted including the extension.',
      'The tables below cover the naming rules for every family this decoder knows about — the segments are usually readable by eye once you know the pattern.'
    ],
    unknown: true
  };
}

const DECODERS = [decodeAireos, decodeApImage, decodeAsa, decodeFtdFxos, decodeNxos, decodeXr, decodeXeLegacy, decodeXe, decodeClassicIos];

export function decodeImageName(raw) {
  const n = String(raw || '').trim().replace(/^.*[\/\\]/, '').replace(/^(flash|bootflash|disk\d|harddisk):\/?/i, '');
  if (!n) return null;
  for (const fn of DECODERS) {
    try {
      const r = fn(n);
      if (r) return { ...r, input: n };
    } catch { /* a bad match must never break the page */ }
  }
  return { ...decodeFallback(n), input: n };
}

// ---------------------------------------------------------------------------
// Filename anatomy diagram — the name in mono type with a labelled bar under
// each segment. textLength pins each segment's width so the labels line up.
// ---------------------------------------------------------------------------
const SEG_COLOURS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899'];

function anatomySvg(segs, caption) {
  const CW = 8.6, LCW = 5.9, X0 = 12, TEXT_Y = 32, BAR_Y = 42, ROW_H = 20;
  let x = X0;
  const laid = segs.map(s => {
    const w = s.t.length * CW;
    const o = { ...s, x, w, cx: x + w / 2 };
    x += w;
    return o;
  });
  const W = x + 12;

  // Pack labels into as few rows as will hold them without overlapping: each
  // label starts under its own segment and drops a row if that space is taken.
  const rowEnd = [];
  let ci = 0;
  for (const s of laid) {
    if (!s.label) continue;
    s.colour = SEG_COLOURS[ci++ % SEG_COLOURS.length];
    const lw = s.label.length * LCW + 8;
    s.lx = Math.max(4, Math.min(s.x, W - lw - 6));
    let row = 0;
    while (rowEnd[row] != null && rowEnd[row] > s.lx) row++;
    rowEnd[row] = s.lx + lw;
    s.row = row;
  }
  const H = BAR_Y + 20 + Math.max(1, rowEnd.length) * ROW_H;

  const body = laid.map(s => {
    const mono = `<text x="${s.x.toFixed(1)}" y="${TEXT_Y}" textLength="${s.w.toFixed(1)}" lengthAdjust="spacingAndGlyphs"
        font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="15"
        fill="${s.colour || 'var(--text-3)'}" xml:space="preserve">${esc(s.t)}</text>`;
    if (!s.label) return mono;
    const ly = BAR_Y + 20 + s.row * ROW_H;
    // Jog across above the text line, then drop — routing at the text's own
    // height would strike through labels that sit left of their segment.
    const jog = ly - 13;
    return `${mono}
      <rect x="${(s.x + 1).toFixed(1)}" y="${BAR_Y}" width="${Math.max(2, s.w - 2).toFixed(1)}" height="3" rx="1.5" fill="${s.colour}"/>
      <path d="M${s.cx.toFixed(1)} ${BAR_Y + 3} L${s.cx.toFixed(1)} ${jog.toFixed(1)} L${(s.lx + 2).toFixed(1)} ${jog.toFixed(1)} L${(s.lx + 2).toFixed(1)} ${(ly - 9).toFixed(1)}"
            stroke="${s.colour}" stroke-width="1" fill="none" opacity=".5"/>
      <text x="${s.lx.toFixed(1)}" y="${ly}" font-size="10.5" fill="${s.colour}">${esc(s.label)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="100%" style="max-width:${W.toFixed(0)}px" role="img" aria-label="${esc(caption)}">
    <text x="12" y="14" font-size="11" fill="var(--text-3)">${esc(caption)}</text>
    ${body}
  </svg>`;
}

const ANATOMY = {
  ios: [
    { t: 'c2800nm', label: 'platform' },
    { t: '-' , label: '' },
    { t: 'advipservicesk9', label: 'feature set + crypto' },
    { t: '-', label: '' },
    { t: 'mz', label: 'runs from RAM, zipped' },
    { t: '.', label: '' },
    { t: '124-24', label: '12.4(24)' },
    { t: '.', label: '' },
    { t: 'T8', label: 'train + rebuild' },
    { t: '.bin', label: 'image' }
  ],
  xe: [
    { t: 'cat9k_iosxe', label: 'platform' },
    { t: '.', label: '' },
    { t: '17.09.04a', label: '17.9.4a — Cupertino, EM' },
    { t: '.', label: '' },
    { t: 'SPA', label: 'signed, production' },
    { t: '.bin', label: 'bootable image' }
  ],
  xr: [
    { t: 'asr9k', label: 'platform' },
    { t: '-', label: '' },
    { t: 'mini', label: 'package' },
    { t: '-', label: '' },
    { t: 'px', label: '32-bit build' },
    { t: '.vm', label: 'bootable image' },
    { t: '-', label: '' },
    { t: '6.5.3', label: 'version' }
  ],
  nxos: [
    { t: 'nxos64-cs', label: '64-bit Cloud Scale' },
    { t: '.', label: '' },
    { t: '10.2.5', label: '10.2(5)' },
    { t: '.', label: '' },
    { t: 'M', label: 'maintenance train' },
    { t: '.bin', label: 'image' }
  ],
  aireos: [
    { t: 'AIR', label: 'wireless' },
    { t: '-', label: '' },
    { t: 'CT5500', label: 'controller model' },
    { t: '-', label: '' },
    { t: 'K9', label: 'strong crypto' },
    { t: '-', label: '' },
    { t: '8-5-171-0', label: 'version 8.5.171.0' },
    { t: '.aes', label: 'encrypted WLC image' }
  ]
};

const EXAMPLES = [
  'c2800nm-advipservicesk9-mz.124-24.T8.bin',
  'c3560-ipbasek9-mz.122-55.SE12.bin',
  'cat9k_iosxe.17.09.04a.SPA.bin',
  'isr4300-universalk9.17.06.05.SPA.bin',
  'asr1001x-universalk9_npe.17.03.05.SPA.bin',
  'C9800-CL-universalk9.17.09.04a.SPA.bin',
  'asr9k-mini-px.vm-6.5.3',
  'ncs5500-mini-x-7.3.2.iso',
  'nxos64-cs.10.2.5.M.bin',
  'n9000-dk9.7.0.3.I7.9.bin',
  'n7000-s2-kickstart.8.4.6.bin',
  'AIR-CT5500-K9-8-5-171-0.aes',
  'c1140-k9w7-tar.153-3.JD.tar',
  'asa9-16-4-55-smp-k8.bin',
  'fxos-k9.2.12.0.498.SPA'
];

// ---------------------------------------------------------------------------
export async function mount(root) {
  const card = 'background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;overflow-x:auto';

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">Cisco image names — decoder &amp; reference</h2>
    <p class="hint" style="font-size:12px;margin-bottom:14px">Every Cisco train encodes the platform, feature set, crypto strength and version into the filename. Paste one below to have it broken apart, or read the naming rules for each OS underneath.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">Decode an image name</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <input type="text" id="imgInput" class="search-input" style="flex:1;min-width:280px;max-width:560px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
        placeholder="e.g. c2800nm-advipservicesk9-mz.124-24.T8.bin">
      <button class="btn sm" id="imgClear" type="button">Clear</button>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px" id="imgExamples">
      <span class="hint" style="font-size:11px;align-self:center;margin-right:2px">Try:</span>
      ${EXAMPLES.map(x => `<button class="btn sm ghost" data-eg="${esc(x)}" style="font-family:ui-monospace,monospace;font-size:10.5px">${esc(x)}</button>`).join('')}
    </div>
    <div id="imgOut" style="margin-bottom:22px"></div>

    <h3 style="font-size:13px;margin:6px 0 8px">Classic IOS (12.x / 15.x)</h3>
    <div style="${card};margin-bottom:8px">${anatomySvg(ANATOMY.ios, 'c2800nm-advipservicesk9-mz.124-24.T8.bin')}</div>
    <p class="hint" style="font-size:11.5px;margin:0 0 10px">Read it as <code>platform-featureset-runformat.version.bin</code>. The version <code>124-24.T8</code> is written <code>12.4(24)T8</code> everywhere else — the first three digits are the major/minor release, the number after the dash is the maintenance release, and the trailing letters are the train plus its rebuild number.</p>
    <table class="lc-table" style="font-size:12px;margin-bottom:10px">
      <thead><tr><th style="width:120px">Field</th><th>What it tells you</th></tr></thead>
      <tbody>
        <tr><td><code>platform</code></td><td>Hardware family — <code>c1841</code>, <code>c2800nm</code> (network-module capable), <code>c3560</code>, <code>s72033</code> (Sup720 on a 6500)</td></tr>
        <tr><td><code>feature set</code></td><td>Which features are compiled in. Modern packaging uses words (<code>ipbase</code>, <code>advipservicesk9</code>); pre-12.3 images use letter codes (<code>i</code>, <code>is</code>, <code>jk9s</code>)</td></tr>
        <tr><td><code>run / format</code></td><td>Two or three letters: where the image executes, then how it is compressed — <code>mz</code> is by far the most common</td></tr>
        <tr><td><code>version</code></td><td><code>124-24</code> → 12.4(24). A letter suffix on the maintenance number (<code>46a</code>) is an interim rebuild</td></tr>
        <tr><td><code>train</code></td><td><code>T</code>, <code>M</code>, <code>SE</code>, <code>SX</code>… — the release family, which decides both the platform support and how long it is patched</td></tr>
      </tbody>
    </table>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:18px">
      <div>
        <div style="font-size:12px;font-weight:600;margin-bottom:5px">Run / compression letters</div>
        <table class="lc-table" style="font-size:12px">
          <thead><tr><th style="width:56px">Letter</th><th>Meaning</th></tr></thead>
          <tbody>
            ${Object.entries(RUN_LOCATION).map(([k, v]) => `<tr><td><code>${k}</code></td><td>1st position — ${esc(v)}</td></tr>`).join('')}
            ${Object.entries(COMPRESSION).map(([k, v]) => `<tr><td><code>${k}</code></td><td>2nd position — ${esc(v)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;margin-bottom:5px">Old-style feature letters</div>
        <table class="lc-table" style="font-size:12px">
          <thead><tr><th style="width:56px">Code</th><th>Meaning</th></tr></thead>
          <tbody>${LETTER_CODES.map(([k, v]) => `<tr><td><code>${k}</code></td><td>${esc(v)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <div style="font-size:12px;font-weight:600;margin-bottom:5px">Packaged feature sets (12.3 and later)</div>
    <table class="lc-table" style="font-size:12px;margin-bottom:10px">
      <thead><tr><th style="width:180px">Feature set</th><th>Contains</th></tr></thead>
      <tbody>${['ipbase', 'ipvoice', 'advsecurity', 'ipservices', 'advipservices', 'entbase', 'entservices', 'adventerprise', 'spservices', 'lanlite', 'lanbase', 'universal', 'universalk9', 'universalk9_npe']
        .map(k => `<tr><td><code>${k}</code></td><td>${esc(FEATURE_SETS[k])}</td></tr>`).join('')}</tbody>
    </table>
    <div style="font-size:12px;font-weight:600;margin:14px 0 5px">Release trains</div>
    <table class="lc-table" style="font-size:12px;margin-bottom:18px">
      <thead><tr><th style="width:72px">Train</th><th>Meaning</th></tr></thead>
      <tbody>${Object.entries(TRAINS).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${esc(v)}</td></tr>`).join('')}</tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">IOS XE</h3>
    <div style="${card};margin-bottom:8px">${anatomySvg(ANATOMY.xe, 'cat9k_iosxe.17.09.04a.SPA.bin')}</div>
    <p class="hint" style="font-size:11.5px;margin:0 0 10px">XE 16 and later drop the feature-set-in-the-filename idea: one universal image per platform, features unlocked by licence. The version is padded to two digits per field, so <code>17.09.04a</code> is release <strong>17.9.4a</strong>. <code>SPA</code> is the signing marker — <strong>S</strong>igned, <strong>P</strong>roduction, signed with Cisco's production key (<code>SSA</code> is a special/engineering build).</p>
    <table class="lc-table" style="font-size:12px;margin-bottom:10px">
      <thead><tr><th style="width:210px">Example</th><th>Platform</th></tr></thead>
      <tbody>
        <tr><td><code>cat9k_iosxe.17.09.04a.SPA.bin</code></td><td>Catalyst 9300/9400/9500/9600</td></tr>
        <tr><td><code>cat9k_lite_iosxe.17.06.05.SPA.bin</code></td><td>Catalyst 9200 (the "lite" build)</td></tr>
        <tr><td><code>cat3k_caa-universalk9.16.12.10.SPA.bin</code></td><td>Catalyst 3650 / 3850</td></tr>
        <tr><td><code>isr4300-universalk9.17.06.05.SPA.bin</code></td><td>ISR 4300 series</td></tr>
        <tr><td><code>asr1001x-universalk9_npe.17.03.05.SPA.bin</code></td><td>ASR 1001-X, No Payload Encryption build</td></tr>
        <tr><td><code>c8000be-universalk9.17.09.03a.SPA.bin</code></td><td>Catalyst 8000V / 8300 edge</td></tr>
        <tr><td><code>C9800-CL-universalk9.17.09.04a.SPA.bin</code></td><td>Catalyst 9800-CL wireless controller</td></tr>
        <tr><td><code>cat4500e-universalk9.SPA.03.11.03.E.152-7.E3.bin</code></td><td>Catalyst 4500-E on XE 3.x — note the dual version</td></tr>
      </tbody>
    </table>
    <table class="lc-table" style="font-size:12px;margin-bottom:10px">
      <thead><tr><th style="width:120px">Train</th><th>Releases</th><th>Note</th></tr></thead>
      <tbody>
        ${XE_TRAINS.map(([a1, b1, a2, b2, name]) => `<tr><td><strong>${name}</strong></td><td>${a1}.${b1} – ${a2}.${b2}</td><td>${XE_EM.includes(`${a2}.${b2}`) ? `<strong>${a2}.${b2}</strong> is the Extended Maintenance release of this train` : ''}</td></tr>`).join('')}
        <tr><td colspan="3" class="hint" style="font-size:11px">Later 17.x trains continue the same alphabetical city naming. Extended Maintenance releases — 16.6, 16.9, 16.12, 17.3, 17.6, 17.9, 17.12, 17.15 — are patched for far longer than the trains between them and are what most estates standardise on.</td></tr>
      </tbody>
    </table>
    <ul class="hint" style="font-size:12px;margin:0 0 18px;padding-left:18px;line-height:1.7">
      <li><code>_npe</code> — No Payload Encryption: a legal build for export-restricted destinations with the data-plane crypto removed. It cannot terminate VPNs; do not download it by accident.</li>
      <li><code>_wlc</code> — wireless-controller personality on a Catalyst 9800.</li>
      <li><code>.pkg</code> and <code>packages.conf</code> — the expanded sub-packages of an INSTALL-mode boot. <code>show version | include Mode</code> tells you whether the box is in INSTALL or BUNDLE mode.</li>
      <li>A trailing letter on the release (<code>17.09.04<strong>a</strong></code>) is a rebuild of that maintenance release, not a new feature drop.</li>
    </ul>

    <h3 style="font-size:13px;margin:6px 0 8px">IOS XR</h3>
    <div style="${card};margin-bottom:8px">${anatomySvg(ANATOMY.xr, 'asr9k-mini-px.vm-6.5.3')}</div>
    <p class="hint" style="font-size:11.5px;margin:0 0 10px">XR is modular: the base OS plus optional packages you install separately. The architecture token separates the classic 32-bit builds (<code>px</code>) from 64-bit XR and XR7 (<code>x64</code>, <code>x</code>).</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:10px">
      <div>
        <div style="font-size:12px;font-weight:600;margin-bottom:5px">Packages</div>
        <table class="lc-table" style="font-size:12px">
          <thead><tr><th style="width:78px">Token</th><th>Contents</th></tr></thead>
          <tbody>${Object.entries(XR_PACKAGES).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${esc(v)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;margin-bottom:5px">File types</div>
        <table class="lc-table" style="font-size:12px">
          <thead><tr><th style="width:78px">Extension</th><th>Meaning</th></tr></thead>
          <tbody>${Object.entries(XR_FILETYPES).map(([k, v]) => `<tr><td><code>.${k}</code></td><td>${esc(v)}</td></tr>`).join('')}</tbody>
        </table>
        <div style="font-size:12px;font-weight:600;margin:12px 0 5px">Architecture</div>
        <table class="lc-table" style="font-size:12px">
          <thead><tr><th style="width:78px">Token</th><th>Meaning</th></tr></thead>
          <tbody>${Object.entries(XR_ARCH).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${esc(v)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <ul class="hint" style="font-size:12px;margin:0 0 18px;padding-left:18px;line-height:1.7">
      <li>A filename containing a <code>CSCxx#####</code> bug ID is a <strong>SMU</strong> — a patch for that one defect, installed on top of a base release.</li>
      <li>A <strong>Golden ISO (GISO)</strong> is a base ISO rebuilt with SMUs and optional packages baked in. It still ends <code>.iso</code>, so keep a record of what went into yours.</li>
      <li>XR7 (7.x on the Cisco 8000 and newer NCS) installs RPMs rather than PIEs — <code>install package add</code> / <code>install apply</code>.</li>
    </ul>

    <h3 style="font-size:13px;margin:6px 0 8px">NX-OS (Nexus &amp; MDS)</h3>
    <div style="${card};margin-bottom:8px">${anatomySvg(ANATOMY.nxos, 'nxos64-cs.10.2.5.M.bin')}</div>
    <p class="hint" style="font-size:11.5px;margin:0 0 10px">The filename flattens the version the CLI shows: <code>7.0.3.I7.9</code> in a filename is <strong>7.0(3)I7(9)</strong> on the box, and <code>9.3.10</code> is <strong>9.3(10)</strong>. The letter block is the platform train — <code>I</code> for Nexus 9000/3000, <code>N</code> for 5000/6000, <code>D</code> for 7000 M-series.</p>
    <table class="lc-table" style="font-size:12px;margin-bottom:10px">
      <thead><tr><th style="width:230px">Prefix</th><th>Platform</th></tr></thead>
      <tbody>${Object.entries(NXOS_PLATFORMS).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${esc(v)}</td></tr>`).join('')}</tbody>
    </table>
    <ul class="hint" style="font-size:12px;margin:0 0 18px;padding-left:18px;line-height:1.7">
      <li><strong>kickstart + system</strong> — Nexus 7000/5000 and MDS need a matched pair: the kickstart image is the kernel and bootloader, the system image is NX-OS itself. Nexus 9000/3000 have shipped a single combined file since 7.0(3)I2.</li>
      <li><code>dk9</code> / <code>uk9</code> — crypto-capable builds (<code>d</code> = DES/3DES, <code>u</code> = universal). <code>s2</code>, <code>s5ek9</code> and similar tokens name the supervisor generation the image is built for.</li>
      <li><code>nxos64-cs</code> vs <code>nxos64-msll</code> — from 10.2, Cloud Scale line cards and the older modular-switch line cards take different 64-bit images. Loading the wrong one simply will not boot.</li>
      <li>A <strong>compact</strong> image is the same software repacked to fit small bootflash — either download the compact file or use <code>copy … bootflash: compact</code>.</li>
    </ul>

    <h3 style="font-size:13px;margin:6px 0 8px">AireOS (wireless LAN controllers)</h3>
    <div style="${card};margin-bottom:8px">${anatomySvg(ANATOMY.aireos, 'AIR-CT5500-K9-8-5-171-0.aes')}</div>
    <table class="lc-table" style="font-size:12px;margin-bottom:10px">
      <thead><tr><th style="width:230px">Example</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><code>AIR-CT5500-K9-8-5-171-0.aes</code></td><td>AireOS 8.5.171.0 for a 5500-series controller</td></tr>
        <tr><td><code>AIR-CT2500-K9-8-10-190-0.aes</code></td><td>AireOS 8.10.190.0 for a 2504</td></tr>
        <tr><td><code>AIR-CTVM-K9-8-10-185-0.aes</code></td><td>Virtual controller (vWLC) image</td></tr>
        <tr><td><code>AIR-CT5500-LDPE-K9-8-10-190-0.aes</code></td><td>Lightweight Data Payload Encryption build — the export-restricted variant</td></tr>
        <tr><td><code>AIR-CT5500-K9-1-9-0.aes</code></td><td>Field Upgrade Software (FUS) — bootloader and field recovery images, not the OS</td></tr>
      </tbody>
    </table>
    <ul class="hint" style="font-size:12px;margin:0 0 18px;padding-left:18px;line-height:1.7">
      <li>The four dash-separated numbers are simply the version with dots replaced: <code>8-10-190-0</code> is <strong>8.10.190.0</strong>.</li>
      <li>Access-point images that ride with the controller follow the IOS pattern — <code>c1140-k9w7-tar.153-3.JD.tar</code>. <strong>k9w7 is autonomous</strong>, <strong>k9w8 is lightweight (CAPWAP)</strong>, and <code>rcvk9w8</code> is the lightweight recovery image.</li>
      <li>AireOS is superseded by the Catalyst 9800 running IOS XE, which uses the XE naming above.</li>
    </ul>

    <h3 style="font-size:13px;margin:6px 0 8px">Other Cisco families</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:10px">
      <thead><tr><th style="width:150px">Family</th><th>Example</th><th>How to read it</th></tr></thead>
      <tbody>
        <tr><td><strong>ASA</strong></td><td><code>asa9-16-4-55-smp-k8.bin</code></td><td>Version 9.16(4)55. <code>smp</code> = multi-core build, <code>lfbff</code> = 5500-X packaging, <code>k8</code>/<code>k9</code> = crypto strength</td></tr>
        <tr><td><strong>ASDM</strong></td><td><code>asdm-7201.bin</code></td><td>ASDM 7.20(1) — the GUI, versioned separately from the ASA itself</td></tr>
        <tr><td><strong>FTD</strong></td><td><code>cisco-ftd-fp2k.7.2.8.SPA</code></td><td>Reimage package for a Firepower 2100 — replaces the OS and wipes config</td></tr>
        <tr><td><strong>FTD upgrade</strong></td><td><code>Cisco_FTD_Upgrade-7.2.5-208.sh.REL.tar</code></td><td>Upgrade package — keeps configuration, pushed from FMC</td></tr>
        <tr><td><strong>FXOS</strong></td><td><code>fxos-k9.2.12.0.498.SPA</code></td><td>Chassis supervisor OS on 4100/9300 — upgraded separately from the logical device</td></tr>
        <tr><td><strong>UCS</strong></td><td><code>ucs-k9-bundle-infra.4.2.3d.A.bin</code></td><td>Infrastructure bundle (A) — separate B (blade) and C (rack) bundles exist</td></tr>
        <tr><td><strong>SD-WAN</strong></td><td><code>viptela-20.9.4-x86_64.tar.gz</code></td><td>Controller software (vManage/vSmart/vBond). Edge routers in controller mode use the normal XE <code>.bin</code></td></tr>
        <tr><td><strong>Meraki</strong></td><td>—</td><td>No image files at all — firmware is scheduled from the dashboard</td></tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:12px 0 8px">Things worth knowing before you download</h3>
    <ul class="hint" style="font-size:12px;margin:0;padding-left:18px;line-height:1.75">
      <li><strong>k9 needs an export-compliant login.</strong> If the download button is missing, that is the reason — not a broken account.</li>
      <li><strong>NPE / LDPE images are not a cost option.</strong> They exist for export-restricted destinations and cannot terminate VPNs or encrypt payload. Loading one by mistake breaks every crypto feature on the box.</li>
      <li><strong>Verify the hash before you boot it.</strong> <code>verify /md5 flash:image.bin</code> on IOS, <code>show file … md5sum</code> on NX-OS — compare against the value on the download page.</li>
      <li><strong>Match feature set to licence.</strong> Universal images boot regardless, but features stay locked until the licence is present; on older platforms an <code>ipbase</code> image simply has no code for the missing features.</li>
      <li><strong>Check flash and RAM first.</strong> <code>show version</code> and <code>dir flash:</code> — a bigger feature set often needs more of both, and a half-copied image is the classic way to brick a remote site.</li>
    </ul>`;

  const out = root.querySelector('#imgOut');
  const input = root.querySelector('#imgInput');

  function renderResult(raw) {
    if (!raw.trim()) {
      out.innerHTML = `<div class="hint" style="font-size:12px;padding:10px 0">Paste a filename above — or pick one of the examples — to see it broken down.</div>`;
      return;
    }
    const r = decodeImageName(raw);
    if (!r) return;
    out.innerHTML = `
      <div style="${card}">
        <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:${r.unknown ? 'var(--text-3)' : 'var(--accent, #3b82f6)'};font-weight:700">${esc(r.family)}</span>
          <code style="font-size:12px">${esc(r.input)}</code>
        </div>
        <div style="font-size:13.5px;font-weight:600;margin-bottom:10px">${esc(r.headline)}</div>
        ${r.rows.length ? `<table class="lc-table" style="font-size:12px">
          <thead><tr><th style="width:170px">Segment</th><th style="width:150px">Reads as</th><th>What it means</th></tr></thead>
          <tbody>${r.rows.map(([seg, val, why]) => `<tr>
            <td><code>${esc(seg)}</code></td>
            <td>${val === seg ? '<span class="hint">—</span>' : `<strong>${esc(val)}</strong>`}</td>
            <td>${esc(why)}</td>
          </tr>`).join('')}</tbody>
        </table>` : ''}
        ${r.notes && r.notes.length ? `<ul class="hint" style="font-size:11.5px;margin:10px 0 0;padding-left:18px;line-height:1.65">
          ${r.notes.map(t => `<li>${esc(t)}</li>`).join('')}
        </ul>` : ''}
      </div>`;
  }

  input.addEventListener('input', debounce(e => renderResult(e.target.value), 120));
  root.querySelector('#imgClear').addEventListener('click', () => { input.value = ''; renderResult(''); input.focus(); });
  root.querySelector('#imgExamples').addEventListener('click', e => {
    const btn = e.target.closest('button[data-eg]');
    if (!btn) return;
    input.value = btn.dataset.eg;
    renderResult(input.value);
  });
  out.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const ok = await copyToClipboard(btn.dataset.copy);
    if (!ok) toast('Copy failed', 'error');
  });

  renderResult('');
}
