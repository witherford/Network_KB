// Optics / transceiver reference — SFP form factors, the reach codes (SR, LR,
// ZX, BX, CWDM…) and a searchable table of common Cisco part numbers.
// Self-contained: the module ships its own data, the search is client-side.

import { esc, hlText, copyToClipboard, debounce, toast } from '../utils.js';

// ---------------------------------------------------------------------------
// Form factors — physical module shapes, independent of the optics inside.
// ---------------------------------------------------------------------------
const FORM_FACTORS = [
  ['GBIC',    '1 Gb',            '1', 'SC',            'Obsolete predecessor to the SFP — twice the size, hot-swappable'],
  ['SFP',     '100 Mb – 1 Gb',   '1', 'LC / RJ-45',    'The baseline "mini-GBIC". Access switches, routers, firewalls'],
  ['SFP+',    '10 Gb',           '1', 'LC / RJ-45',    'Same cage as SFP — an SFP usually works in an SFP+ port, not the reverse'],
  ['SFP28',   '25 Gb',           '1', 'LC',            'Same cage again; ToR server links. Ports are commonly 10/25 dual-rate'],
  ['SFP56',   '50 Gb',           '1', 'LC',            'PAM4 single lane — uncommon outside specific platforms'],
  ['XFP',     '10 Gb',           '1', 'LC',            'Older, larger 10 Gb module — pre-dates SFP+, still seen on WAN gear'],
  ['X2 / XENPAK', '10 Gb',       '1', 'SC',            'Legacy 10 Gb on older Catalyst chassis'],
  ['QSFP+',   '40 Gb',           '4', 'MPO-12 / LC',   '4 × 10 Gb lanes — breaks out to 4 × SFP+'],
  ['QSFP28',  '100 Gb',          '4', 'MPO-12 / LC',   '4 × 25 Gb lanes — breaks out to 4 × SFP28. The DC spine/leaf workhorse'],
  ['QSFP56',  '200 Gb',          '4', 'MPO / LC',      '4 × 50 Gb PAM4 lanes'],
  ['QSFP-DD', '400 – 800 Gb',    '8', 'MPO-12/16 / LC','Double density — 8 lanes, backwards compatible with QSFP28 modules'],
  ['OSFP',    '400 – 800 Gb',    '8', 'MPO / LC',      'Competing 8-lane format with its own thermal design — not QSFP compatible'],
  ['CFP / CFP2 / CFP4', '40 – 400 Gb', '4–16', 'LC / MPO', 'Large coherent/DWDM transport modules']
];

// ---------------------------------------------------------------------------
// Reach codes — the suffix that tells you the optics, fibre and distance.
// ---------------------------------------------------------------------------
const REACH_CODES = [
  ['SX',   '850 nm',        'Multimode',  '220 m OM1 · 550 m OM2',      '1 Gb short reach'],
  ['LX / LH', '1310 nm',    'Single-mode','10 km (550 m MMF with a mode-conditioning lead)', '1 Gb long haul'],
  ['EX',   '1310 nm',       'Single-mode','40 km',                      '1 Gb extended'],
  ['ZX',   '1550 nm',       'Single-mode','70–80 km',                   '1 Gb very long haul'],
  ['SR',   '850 nm',        'Multimode',  '300 m OM3 · 400 m OM4 (10 Gb)', '10/25/40/100 Gb short reach'],
  ['CSR',  '850 nm',        'Multimode',  '300 m OM3 · 400 m OM4',      'Cisco extended-reach SR'],
  ['LRM',  '1310 nm',       'Multimode',  '220 m',                      'Runs 10 Gb over legacy FDDI-grade MMF'],
  ['LR',   '1310 nm',       'Single-mode','10 km',                      'The default single-mode building/campus optic'],
  ['ER',   '1550 nm',       'Single-mode','40 km',                      'Extended reach'],
  ['ZR',   '1550 nm',       'Single-mode','80 km (coherent ZR/ZRP much further)', 'Longest reach without amplification'],
  ['DR',   '1310 nm',       'Single-mode','500 m',                      'Single-lambda 100/400 Gb data-centre reach'],
  ['FR',   '1310 nm',       'Single-mode','2 km',                       'Single-lambda campus reach'],
  ['BX / BiDi', '1310 & 1490 nm (or 1270/1330)', 'Single-mode (1 strand)', '10–40 km', 'One fibre, two wavelengths — always order in <strong>U + D</strong> pairs'],
  ['SR-BD','850 / 900 nm',   'Multimode (1 pair)','100 m OM3 · 150 m OM4','40 Gb BiDi over ordinary duplex LC — no MPO trunk needed'],
  ['CWDM', '1470–1610 nm, 20 nm grid', 'Single-mode', '80 km',          'Up to 18 λ on one pair through a passive mux'],
  ['DWDM', '~1530–1565 nm, 50/100 GHz grid', 'Single-mode', '80 km+',   'Dozens of λ; each part number is a fixed channel'],
  ['T',    'n/a',           'Copper Cat5e/6a', '100 m (1 Gb) · 30 m (10 Gb)', 'RJ-45 in an SFP cage — runs hot, check port support'],
  ['DAC / Twinax', 'n/a',   'Copper twinax', '1–5 m passive · 7–10 m active', 'Fixed cable with the modules moulded on — cheapest ToR link'],
  ['AOC',  '850 nm',        'Multimode (fixed)', '1–30 m',              'Fixed optical cable, no connectors to clean or lose']
];

// ---------------------------------------------------------------------------
// Cisco part numbers. Row = [model, form factor, speed, type, media/λ,
// connector, max reach]. Grouped so the speed chips can filter whole blocks.
// ---------------------------------------------------------------------------
const CATS = [
  { key: 'fe', label: '100 Mb', rows: [
    ['GLC-FE-100FX',    'SFP', '100 Mb', '100BASE-FX',   'Multimode · 1310 nm',  'LC',    '2 km'],
    ['GLC-FE-100FX-RGD','SFP', '100 Mb', '100BASE-FX',   'Multimode · 1310 nm',  'LC',    '2 km · rugged/industrial'],
    ['GLC-FE-100LX',    'SFP', '100 Mb', '100BASE-LX',   'Single-mode · 1310 nm','LC',    '10 km'],
    ['GLC-FE-100EX',    'SFP', '100 Mb', '100BASE-EX',   'Single-mode · 1310 nm','LC',    '40 km'],
    ['GLC-FE-100ZX',    'SFP', '100 Mb', '100BASE-ZX',   'Single-mode · 1550 nm','LC',    '80 km'],
    ['GLC-FE-100BX-D',  'SFP', '100 Mb', '100BASE-BX10-D','Single-mode 1 strand · TX 1550 / RX 1310 nm', 'LC', '10 km · pair with -U'],
    ['GLC-FE-100BX-U',  'SFP', '100 Mb', '100BASE-BX10-U','Single-mode 1 strand · TX 1310 / RX 1550 nm', 'LC', '10 km · pair with -D']
  ]},
  { key: '1g', label: '1 Gb', rows: [
    ['GLC-T / GLC-TE',  'SFP', '1 Gb',  '1000BASE-T',    'Cat5e copper',         'RJ-45', '100 m'],
    ['SFP-GE-T',        'SFP', '1 Gb',  '1000BASE-T',    'Cat5e copper · ext temp','RJ-45','100 m'],
    ['GLC-SX-MMD',      'SFP', '1 Gb',  '1000BASE-SX',   'Multimode · 850 nm',   'LC',    '550 m OM2 · 220 m OM1'],
    ['GLC-SX-MM',       'SFP', '1 Gb',  '1000BASE-SX',   'Multimode · 850 nm',   'LC',    '550 m · no DOM (legacy)'],
    ['GLC-LH-SMD',      'SFP', '1 Gb',  '1000BASE-LX/LH','Single-mode · 1310 nm','LC',    '10 km (550 m MMF w/ MCP lead)'],
    ['GLC-LH-SM',       'SFP', '1 Gb',  '1000BASE-LX/LH','Single-mode · 1310 nm','LC',    '10 km · no DOM (legacy)'],
    ['GLC-LX-SM-RGD',   'SFP', '1 Gb',  '1000BASE-LX',   'Single-mode · 1310 nm','LC',    '10 km · rugged/industrial'],
    ['GLC-EX-SMD',      'SFP', '1 Gb',  '1000BASE-EX',   'Single-mode · 1310 nm','LC',    '40 km'],
    ['GLC-ZX-SMD',      'SFP', '1 Gb',  '1000BASE-ZX',   'Single-mode · 1550 nm','LC',    '70 km'],
    ['GLC-BX-D',        'SFP', '1 Gb',  '1000BASE-BX10-D','Single-mode 1 strand · TX 1490 / RX 1310 nm','LC','10 km · pair with -U'],
    ['GLC-BX-U',        'SFP', '1 Gb',  '1000BASE-BX10-U','Single-mode 1 strand · TX 1310 / RX 1490 nm','LC','10 km · pair with -D'],
    ['GLC-BX40-D-I',    'SFP', '1 Gb',  '1000BASE-BX40-D','Single-mode 1 strand · TX 1550 / RX 1490 nm','LC','40 km · pair with -U'],
    ['GLC-BX40-U-I',    'SFP', '1 Gb',  '1000BASE-BX40-U','Single-mode 1 strand · TX 1490 / RX 1550 nm','LC','40 km · pair with -D'],
    ['CWDM-SFP-1470 … -1610', 'SFP', '1 Gb', '1G CWDM',  'Single-mode · 1470–1610 nm (18 λ)','LC','80 km'],
    ['DWDM-SFP-xxxx',   'SFP', '1 Gb',  '1G DWDM',       'Single-mode · 100 GHz C-band grid','LC','100 km'],
    ['GLC-GE-100FX',    'SFP', '100 Mb','100BASE-FX',    'Multimode · 1310 nm',  'LC',    '2 km · for Gigabit-only ports']
  ]},
  { key: '10g', label: '10 Gb', rows: [
    ['SFP-10G-SR / -S', 'SFP+','10 Gb', '10GBASE-SR',    'Multimode · 850 nm',   'LC',    '300 m OM3 · 400 m OM4'],
    ['SFP-10G-LR / -S', 'SFP+','10 Gb', '10GBASE-LR',    'Single-mode · 1310 nm','LC',    '10 km'],
    ['SFP-10G-ER / -S', 'SFP+','10 Gb', '10GBASE-ER',    'Single-mode · 1550 nm','LC',    '40 km'],
    ['SFP-10G-ZR / -S', 'SFP+','10 Gb', '10GBASE-ZR',    'Single-mode · 1550 nm','LC',    '80 km'],
    ['SFP-10G-LRM',     'SFP+','10 Gb', '10GBASE-LRM',   'Multimode (FDDI-grade) · 1310 nm','LC','220 m'],
    ['SFP-10G-T-S',     'SFP+','10 Gb', '10GBASE-T',     'Cat6a copper',         'RJ-45', '30 m · high power draw'],
    ['SFP-10G-BXD-I',   'SFP+','10 Gb', '10G BiDi (D)',  'Single-mode 1 strand · TX 1330 / RX 1270 nm','LC','10 km · pair with BXU'],
    ['SFP-10G-BXU-I',   'SFP+','10 Gb', '10G BiDi (U)',  'Single-mode 1 strand · TX 1270 / RX 1330 nm','LC','10 km · pair with BXD'],
    ['SFP-10G-BX40D-I / BX40U-I','SFP+','10 Gb','10G BiDi 40 km','Single-mode 1 strand','LC','40 km · order as a U+D pair'],
    ['CWDM-SFP10G-1470 … -1610','SFP+','10 Gb','10G CWDM','Single-mode · 1470–1610 nm','LC','80 km'],
    ['DWDM-SFP10G-xx.xx','SFP+','10 Gb','10G DWDM',      'Single-mode · 100 GHz C-band grid','LC','80 km'],
    ['SFP-H10GB-CU1M … CU5M','SFP+','10 Gb','DAC (passive twinax)','Copper twinax','Fixed','1 / 1.5 / 2 / 2.5 / 3 / 5 m'],
    ['SFP-H10GB-ACU7M / ACU10M','SFP+','10 Gb','DAC (active twinax)','Copper twinax','Fixed','7 m / 10 m'],
    ['SFP-10G-AOC1M … AOC10M','SFP+','10 Gb','AOC',      'Multimode (fixed)',    'Fixed', '1–10 m'],
    ['FET-10G',         'SFP+','10 Gb', 'Fabric Extender Transceiver','Multimode · 850 nm','LC','100 m OM3 · FEX uplinks only'],
    ['XFP-10G-MM-SR',   'XFP', '10 Gb', '10GBASE-SR',    'Multimode · 850 nm',   'LC',    '300 m OM3 · legacy form factor'],
    ['X2-10GB-SR / X2-10GB-LR','X2','10 Gb','10GBASE-SR / LR','Multimode 850 nm / Single-mode 1310 nm','SC','300 m / 10 km · legacy']
  ]},
  { key: '25g', label: '25 Gb', rows: [
    ['SFP-25G-SR-S',    'SFP28','25 Gb','25GBASE-SR',    'Multimode · 850 nm',   'LC',    '70 m OM3 · 100 m OM4'],
    ['SFP-10/25G-CSR-S','SFP28','10/25 Gb','25GBASE-CSR','Multimode · 850 nm',   'LC',    '300 m OM4 · dual-rate'],
    ['SFP-10/25G-LR-S', 'SFP28','10/25 Gb','25GBASE-LR', 'Single-mode · 1310 nm','LC',    '10 km · dual-rate'],
    ['SFP-25G-BXD-I / BXU-I','SFP28','25 Gb','25G BiDi', 'Single-mode 1 strand · 1270/1330 nm','LC','10 km · order as a U+D pair'],
    ['SFP-H25G-CU1M … CU5M','SFP28','25 Gb','DAC (passive twinax)','Copper twinax','Fixed','1–5 m'],
    ['SFP-25G-AOC1M … AOC10M','SFP28','25 Gb','AOC',     'Multimode (fixed)',    'Fixed', '1–10 m']
  ]},
  { key: '40g', label: '40 Gb', rows: [
    ['QSFP-40G-SR4 / -S','QSFP+','40 Gb','40GBASE-SR4',  'Multimode · 850 nm · 4 lanes','MPO-12','100 m OM3 · 150 m OM4'],
    ['QSFP-40G-CSR4',   'QSFP+','40 Gb','40GBASE-CSR4',  'Multimode · 850 nm · 4 lanes','MPO-12','300 m OM3 · 400 m OM4'],
    ['QSFP-40G-SR-BD',  'QSFP+','40 Gb','40G BiDi',      'Multimode · 850/900 nm','LC (duplex)','100 m OM3 · 150 m OM4 · no MPO trunk needed'],
    ['QSFP-40G-LR4 / -S','QSFP+','40 Gb','40GBASE-LR4',  'Single-mode · CWDM 4 λ around 1310 nm','LC','10 km'],
    ['WSP-Q40GLR4L',    'QSFP+','40 Gb','40GBASE-LR4 lite','Single-mode · 1310 nm','LC',  '2 km'],
    ['QSFP-40G-ER4',    'QSFP+','40 Gb','40GBASE-ER4',   'Single-mode · 1310 nm','LC',    '40 km'],
    ['QSFP-4x10G-LR-S', 'QSFP+','4 × 10 Gb','40G → 4 × 10GBASE-LR','Single-mode · 1310 nm','MPO-12 (breakout)','10 km'],
    ['QSFP-H40G-CU1M … CU5M','QSFP+','40 Gb','DAC (passive twinax)','Copper twinax','Fixed','1–5 m'],
    ['QSFP-H40G-ACU7M / ACU10M','QSFP+','40 Gb','DAC (active twinax)','Copper twinax','Fixed','7 m / 10 m'],
    ['QSFP-H40G-AOC1M … AOC30M','QSFP+','40 Gb','AOC',   'Multimode (fixed)',    'Fixed', '1–30 m'],
    ['QSFP-4SFP10G-CU1M … CU5M','QSFP+','4 × 10 Gb','Breakout DAC','Copper twinax','4 × SFP+','1–5 m']
  ]},
  { key: '100g', label: '100 Gb', rows: [
    ['QSFP-100G-SR4-S', 'QSFP28','100 Gb','100GBASE-SR4','Multimode · 850 nm · 4 lanes','MPO-12','70 m OM3 · 100 m OM4'],
    ['QSFP-100G-SM-SR', 'QSFP28','100 Gb','100G single-mode SR','Single-mode · 1310 nm','LC','500 m'],
    ['QSFP-100G-CWDM4-S','QSFP28','100 Gb','100G CWDM4', 'Single-mode · CWDM 4 λ','LC',   '2 km'],
    ['QSFP-100G-LR4-S', 'QSFP28','100 Gb','100GBASE-LR4','Single-mode · LAN-WDM 4 λ','LC','10 km'],
    ['QSFP-100G-ER4L-S','QSFP28','100 Gb','100GBASE-ER4 lite','Single-mode · LAN-WDM 4 λ','LC','25 km (up to 40 km with FEC)'],
    ['QSFP-100G-DR-S',  'QSFP28','100 Gb','100GBASE-DR', 'Single-mode · 1310 nm single λ','LC','500 m'],
    ['QSFP-100G-FR-S',  'QSFP28','100 Gb','100GBASE-FR', 'Single-mode · 1310 nm single λ','LC','2 km'],
    ['QSFP-100G-LR-S',  'QSFP28','100 Gb','100GBASE-LR', 'Single-mode · 1310 nm single λ','LC','10 km'],
    ['QSFP-100G-CU1M … CU5M','QSFP28','100 Gb','DAC (passive twinax)','Copper twinax','Fixed','1–5 m'],
    ['QSFP-100G-AOC1M … AOC30M','QSFP28','100 Gb','AOC', 'Multimode (fixed)',    'Fixed', '1–30 m'],
    ['QSFP-4SFP25G-CU1M … CU5M','QSFP28','4 × 25 Gb','Breakout DAC','Copper twinax','4 × SFP28','1–5 m'],
    ['CFP-100G-LR4',    'CFP',  '100 Gb','100GBASE-LR4','Single-mode · LAN-WDM 4 λ','LC','10 km · legacy transport module']
  ]},
  { key: '400g', label: '200 / 400 Gb', rows: [
    ['QDD-400G-SR8-S',  'QSFP-DD','400 Gb','400GBASE-SR8','Multimode · 850 nm · 8 lanes','MPO-16','70 m OM3 · 100 m OM4'],
    ['QDD-400G-DR4-S',  'QSFP-DD','400 Gb','400GBASE-DR4','Single-mode · 1310 nm · 4 lanes','MPO-12','500 m · breaks out to 4 × 100G'],
    ['QDD-400G-FR4-S',  'QSFP-DD','400 Gb','400GBASE-FR4','Single-mode · CWDM 4 λ','LC',  '2 km'],
    ['QDD-400G-LR8-S',  'QSFP-DD','400 Gb','400GBASE-LR8','Single-mode · LAN-WDM 8 λ','LC','10 km'],
    ['QDD-400G-ZR-S',   'QSFP-DD','400 Gb','400G ZR (coherent)','Single-mode · DWDM C-band','LC','~80–120 km point-to-point'],
    ['QDD-400G-ZRP-S',  'QSFP-DD','400 Gb','400G ZR+ (coherent)','Single-mode · DWDM C-band','LC','Amplified line systems — hundreds of km'],
    ['QDD-400-CU1M … CU2M','QSFP-DD','400 Gb','DAC (passive twinax)','Copper twinax','Fixed','1–2 m'],
    ['QDD-400-AOC3M … AOC30M','QSFP-DD','400 Gb','AOC',  'Multimode (fixed)',    'Fixed', '3–30 m'],
    ['QDD-4X100G-FR-S', 'QSFP-DD','4 × 100 Gb','400G → 4 × 100GBASE-FR','Single-mode · 1310 nm','MPO-12 (breakout)','2 km']
  ]}
];

const SUFFIXES = [
  ['-S',   'Cost-optimised "S" variant. Commercial temperature range only, and on some platforms it is limited to Ethernet (no OTN/FCoE). Functionally identical for normal switching.'],
  ['-D',   'Includes DOM/DDM digital optical monitoring (e.g. GLC-SX-MMD). Nearly everything modern has it, so the letter is dropping out of newer part numbers.'],
  ['-I',   'Industrial temperature range, −40 °C to +85 °C.'],
  ['-RGD', 'Ruggedised / extended temperature, for IE-series industrial switches.'],
  ['-X / -E','Extended temperature range (vendor-specific usage).'],
  ['=',    'Ordering suffix meaning "spare" — a module bought on its own rather than bundled with a chassis. GLC-LH-SMD= is the same optic as GLC-LH-SMD.'],
  ['-U / -D (BiDi)', 'Upstream / downstream half of a BiDi pair. The wavelengths are swapped, so both ends of a single-strand link must be opposite letters.']
];

// ---------------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------------
const SHELL = 'rgba(150,170,200,.16)';
const EDGE = 'var(--border-2)';

// Relative size / lane count of the three cages you actually meet.
function formFactorSvg() {
  const BASE = 96;            // modules sit on a common baseline
  const LANE = 4, LGAP = 4;   // one gold bar per electrical lane
  const mod = (x, w, h, label, lanes, port) => {
    const y = BASE - h;
    const groupH = lanes * LANE + (lanes - 1) * LGAP;
    const y0 = y + (h - groupH) / 2;
    return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.5"/>
    <rect x="${x + w - 13}" y="${y + 4}" width="9" height="${h - 8}" rx="2" fill="rgba(120,140,170,.35)"/>
    ${Array.from({ length: lanes }, (_, i) =>
      `<rect x="${x + 8}" y="${y0 + i * (LANE + LGAP)}" width="${w - 27}" height="${LANE}" rx="1" fill="#e5b53a" opacity=".85"/>`).join('')}
    <text x="${x + w / 2}" y="${BASE + 20}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--text)">${label}</text>
    <text x="${x + w / 2}" y="${BASE + 34}" text-anchor="middle" font-size="10.5" fill="var(--text-3)">${port}</text>`;
  };
  return `<svg viewBox="0 0 520 140" width="100%" style="max-width:520px" role="img" aria-label="SFP, QSFP and QSFP-DD relative size and lane count">
    ${mod(14, 130, 34, 'SFP / SFP+ / SFP28', 1, '1 lane · 1 / 10 / 25 Gb')}
    ${mod(190, 140, 52, 'QSFP+ / QSFP28', 4, '4 lanes · 40 / 100 Gb')}
    ${mod(370, 140, 68, 'QSFP-DD', 8, '8 lanes · 400 Gb')}
  </svg>`;
}

// Duplex pair vs BiDi single strand vs parallel MPO ribbon.
function fibrePathSvg() {
  const col = (x, title, sub) => `
    <text x="${x}" y="16" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--text)">${title}</text>
    <text x="${x}" y="30" text-anchor="middle" font-size="10" fill="var(--text-3)">${sub}</text>`;
  const ends = x => `
    <rect x="${x - 62}" y="46" width="20" height="46" rx="3" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.2"/>
    <rect x="${x + 42}" y="46" width="20" height="46" rx="3" fill="${SHELL}" stroke="${EDGE}" stroke-width="1.2"/>`;
  const strand = (x, y, colour, dash) => `<path d="M${x - 42} ${y} L${x + 42} ${y}" stroke="${colour}" stroke-width="3" ${dash ? 'stroke-dasharray="8 5"' : ''} fill="none"/>`;
  return `<svg viewBox="0 0 690 118" width="100%" style="max-width:690px" role="img" aria-label="duplex, BiDi and parallel fibre paths">
    ${col(112, 'Duplex pair', 'SR / LR / SX / LX — 2 strands')}
    ${ends(112)}${strand(112, 60, '#3b82f6')}${strand(112, 78, '#f97316')}
    <text x="112" y="108" text-anchor="middle" font-size="9.5" fill="var(--text-3)">TX on one fibre, RX on the other</text>

    ${col(345, 'BiDi single strand', 'BX / 10G BiDi — 1 strand')}
    ${ends(345)}${strand(345, 69, '#a855f7')}
    <text x="345" y="108" text-anchor="middle" font-size="9.5" fill="var(--text-3)">Two wavelengths, one fibre — U + D pair</text>

    ${col(578, 'Parallel ribbon', 'SR4 / DR4 — MPO trunk')}
    ${ends(578)}
    ${[52, 60, 68, 76, 84].map(y => strand(578, y, '#22c55e')).join('')}
    <text x="578" y="108" text-anchor="middle" font-size="9.5" fill="var(--text-3)">4 or 8 lanes over an MPO-12/16 trunk</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
export async function mount(root) {
  const card = 'background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;overflow-x:auto';

  root.innerHTML = `
    <h2 style="font-size:15px;margin-bottom:4px">SFP &amp; optics reference</h2>
    <p class="hint" style="font-size:12px;margin-bottom:14px">Transceiver form factors, what each reach code means, and a searchable table of common Cisco part numbers. For the fibre itself (OS/OM grades, LC/SC/MPO connectors) see <strong>Fibre &amp; connectors</strong>.</p>

    <h3 style="font-size:13px;margin:6px 0 8px">Look up a part number</h3>
    <div class="sub-nav" id="sfpChips" style="margin:0 -20px 12px -20px">
      <button class="ftab active" data-cat="all">All</button>
      ${CATS.map(c => `<button class="ftab" data-cat="${c.key}">${esc(c.label)}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input type="text" id="sfpSearch" class="search-input" style="flex:1;min-width:240px;max-width:420px"
        placeholder="Search model, speed, reach… (e.g. GLC-LH, 10G SR, 40 km, BiDi)">
      <span class="hint" id="sfpCount" style="font-size:11.5px"></span>
    </div>
    <div id="sfpBody"></div>

    <h3 style="font-size:13px;margin:22px 0 8px">Form factors</h3>
    <div style="${card};margin-bottom:10px">${formFactorSvg()}</div>
    <table class="lc-table" style="font-size:12px;margin-bottom:18px">
      <thead><tr><th>Form factor</th><th>Speed</th><th>Lanes</th><th>Connector</th><th>Notes</th></tr></thead>
      <tbody>${FORM_FACTORS.map(r => `<tr>
        <td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td>
      </tr>`).join('')}</tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">How the fibre is used</h3>
    <div style="${card};margin-bottom:18px">${fibrePathSvg()}</div>

    <h3 style="font-size:13px;margin:6px 0 8px">Reach codes</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:18px">
      <thead><tr><th>Code</th><th>Wavelength</th><th>Fibre</th><th>Typical reach</th><th>Meaning</th></tr></thead>
      <tbody>${REACH_CODES.map(r => `<tr>
        <td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${r[4]}</td>
      </tr>`).join('')}</tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">Part-number suffixes</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:18px">
      <thead><tr><th style="width:130px">Suffix</th><th>What it means</th></tr></thead>
      <tbody>${SUFFIXES.map(r => `<tr><td><code>${esc(r[0])}</code></td><td>${esc(r[1])}</td></tr>`).join('')}</tbody>
    </table>

    <h3 style="font-size:13px;margin:6px 0 8px">Checking optics on the box</h3>
    <table class="lc-table" style="font-size:12px;margin-bottom:12px">
      <thead><tr><th style="width:44%">Command</th><th>What it gives you</th></tr></thead>
      <tbody>
        <tr><td><code>show interfaces transceiver</code></td><td>DOM readings — TX/RX power in dBm, temperature, bias current, voltage</td></tr>
        <tr><td><code>show interfaces transceiver detail</code></td><td>The same plus the high/low warning and alarm thresholds</td></tr>
        <tr><td><code>show interface Gi1/0/1 transceiver properties</code></td><td>Speed/duplex capability the module reports to the port</td></tr>
        <tr><td><code>show inventory</code></td><td>Part number, serial and vendor of every installed module</td></tr>
        <tr><td><code>show idprom interface Te1/1/1</code></td><td>Raw EEPROM — vendor name, part, wavelength, Cisco coding</td></tr>
        <tr><td><code>service unsupported-transceiver</code></td><td>Global config — allows uncoded third-party optics (voids support on the link)</td></tr>
        <tr><td><code>no errdisable detect cause gbic-invalid</code></td><td>Stops the port err-disabling on an unrecognised module</td></tr>
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:12px 0 8px">Field notes</h3>
    <ul class="hint" style="font-size:12px;margin:0;padding-left:18px;line-height:1.75">
      <li><strong>Both ends must match</strong> — same standard, same wavelength. An SR will not talk to an LR, and a mismatched pair often gives link-up-but-errors rather than a clean down.</li>
      <li><strong>Watch the receive window.</strong> A long-reach optic (ZX, ER) over a short patch will overload the receiver — insert an attenuator, typically 5–15 dB, or the link errors and the module ages fast.</li>
      <li><strong>Read DOM before you swap anything.</strong> RX power near the low alarm points at fibre/connector loss; TX power falling off points at the module. Roughly: 10GBASE-SR sits around −1 to −7 dBm RX, 10GBASE-LR around −1 to −14 dBm.</li>
      <li><strong>BiDi and CWDM/DWDM parts come in matched sets.</strong> BiDi needs a U at one end and a D at the other; CWDM/DWDM needs the same channel wavelength each end and a mux that carries it.</li>
      <li><strong>MPO polarity bites.</strong> SR4/DR4 trunks need the right method (A/B/C) and often a key-up/key-down flip — if a parallel link never comes up, suspect polarity before the optics.</li>
      <li><strong>Breakout is a port-mode decision.</strong> A 40G port split to 4 × 10G (or 100G to 4 × 25G) usually needs explicit configuration and consumes a port group — check the platform's breakout rules first.</li>
      <li><strong>Copper SFPs run hot and draw more power</strong>, especially 10GBASE-T. Some platforms limit how many you can populate, and they add ~2 µs of latency versus fibre.</li>
      <li><strong>Clean before you blame.</strong> Most "faulty optic" cases are a dirty end-face. Inspect and clean both the connector and the bulkhead, and keep dust caps in until the moment you mate.</li>
      <li><strong>Third-party optics work</strong> and are a fraction of the price, but Cisco TAC may ask you to swap in a coded module before troubleshooting a link. Keep a coded spare for that conversation.</li>
    </ul>`;

  const body = root.querySelector('#sfpBody');
  const count = root.querySelector('#sfpCount');
  const chips = root.querySelector('#sfpChips');
  let cat = 'all';
  let query = '';

  const HEAD = ['Model', 'Form factor', 'Speed', 'Type', 'Media / wavelength', 'Connector', 'Max reach'];

  function render() {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    // Every term must appear somewhere in the row, so "10g lr" narrows properly.
    const match = r => terms.every(t => r.join(' ').toLowerCase().includes(t));
    const cats = CATS
      .filter(c => cat === 'all' || c.key === cat)
      .map(c => ({ label: c.label, rows: terms.length ? c.rows.filter(match) : c.rows }))
      .filter(c => c.rows.length);

    const total = cats.reduce((n, c) => n + c.rows.length, 0);
    count.textContent = total === 1 ? '1 module' : `${total} modules`;

    if (!total) {
      body.innerHTML = '<div class="page-empty">No transceiver matches that search. Try a partial model (<code>GLC</code>), a speed (<code>25G</code>) or a reach (<code>40 km</code>).</div>';
      return;
    }
    body.innerHTML = cats.map(c => `
      <h4 style="font-size:12px;margin:14px 0 6px;color:var(--muted)">${esc(c.label)}</h4>
      <table class="lc-table" style="font-size:12px">
        <thead><tr>${HEAD.map(h => `<th>${h}</th>`).join('')}<th style="width:34px"></th></tr></thead>
        <tbody>${c.rows.map(r => `<tr>
          <td style="white-space:nowrap"><code>${hlText(r[0], q)}</code></td>
          ${r.slice(1).map((cell, i) =>
            // form factor, speed and connector are short — keep them on one line
            `<td${[0, 1, 4].includes(i) ? ' style="white-space:nowrap"' : ''}>${hlText(cell, q)}</td>`).join('')}
          <td><button class="btn sm ghost" data-copy="${esc(r[0])}" title="Copy model">⧉</button></td>
        </tr>`).join('')}</tbody>
      </table>`).join('');
  }

  root.querySelector('#sfpSearch').addEventListener('input', debounce(e => { query = e.target.value; render(); }, 100));
  chips.addEventListener('click', e => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    cat = btn.dataset.cat;
    for (const b of chips.querySelectorAll('.ftab')) b.classList.toggle('active', b === btn);
    render();
  });
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
