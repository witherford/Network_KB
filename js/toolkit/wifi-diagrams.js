// Small schematic SVG diagrams for Wi-Fi features. Shapes use saturated colours
// that read on both light and dark card backgrounds; text labels use
// currentColor so they follow the theme.

const BLUE = '#3b82f6', GREEN = '#22c55e', AMBER = '#f59e0b', RED = '#ef4444',
      PURPLE = '#8b5cf6', CYAN = '#06b6d4';

const wrap = inner => `<svg viewBox="0 0 280 120" role="img" font-family="sans-serif">${inner}</svg>`;
const t = (x, y, s, opts = '') => `<text x="${x}" y="${y}" font-size="9" fill="currentColor" ${opts}>${s}</text>`;

export const FEATURE_DIAGRAMS = {
  ofdma: wrap(`
    ${t(8, 14, 'One channel → resource units (RUs)')}
    <rect x="8" y="24" width="264" height="34" rx="3" fill="none" stroke="currentColor" stroke-opacity=".3"/>
    <rect x="10" y="26" width="78" height="30" fill="${BLUE}" opacity=".75"/>
    <rect x="90" y="26" width="52" height="30" fill="${GREEN}" opacity=".75"/>
    <rect x="144" y="26" width="64" height="30" fill="${AMBER}" opacity=".75"/>
    <rect x="210" y="26" width="60" height="30" fill="${PURPLE}" opacity=".75"/>
    ${t(20, 45, 'client A', 'fill="#fff"')}${t(98, 45, 'B', 'fill="#fff"')}
    ${t(160, 45, 'client C', 'fill="#fff"')}${t(228, 45, 'D', 'fill="#fff"')}
    ${t(8, 78, 'Multiple clients share ONE transmission')}
    ${t(8, 92, '→ less contention, lower latency in dense cells')}`),

  mumimo: wrap(`
    <rect x="118" y="10" width="44" height="20" rx="3" fill="${BLUE}"/>
    ${t(128, 24, 'AP', 'fill="#fff"')}
    <line x1="140" y1="30" x2="40"  y2="90" stroke="${GREEN}" stroke-width="2"/>
    <line x1="140" y1="30" x2="140" y2="92" stroke="${AMBER}" stroke-width="2"/>
    <line x1="140" y1="30" x2="240" y2="90" stroke="${PURPLE}" stroke-width="2"/>
    <rect x="20"  y="92" width="40" height="18" rx="3" fill="none" stroke="currentColor"/>
    <rect x="120" y="92" width="40" height="18" rx="3" fill="none" stroke="currentColor"/>
    <rect x="220" y="92" width="40" height="18" rx="3" fill="none" stroke="currentColor"/>
    ${t(30, 104, 'STA1')}${t(130, 104, 'STA2')}${t(230, 104, 'STA3')}
    ${t(8, 50, 'Simultaneous spatial streams to many clients')}`),

  qam1024: wrap(`
    ${t(8, 14, '256-QAM (8 bits)')}${t(150, 14, '1024-QAM (10 bits)')}
    ${grid(16, 22, 6, BLUE)}
    ${grid(158, 22, 10, GREEN)}
    ${t(8, 112, 'Denser constellation = ~25% higher peak rate, needs high SNR')}`),

  qam4096: wrap(`
    ${t(8, 14, '1024-QAM')}${t(150, 14, '4096-QAM (12 bits)')}
    ${grid(16, 22, 10, GREEN)}
    ${grid(158, 22, 16, PURPLE)}
    ${t(8, 112, 'Wi-Fi 7 packs 12 bits/symbol — ~20% over 1024-QAM')}`),

  twt: wrap(`
    ${t(8, 14, 'Target Wake Time — scheduled wake slots')}
    <line x1="8" y1="60" x2="272" y2="60" stroke="currentColor" stroke-opacity=".3"/>
    ${[20, 110, 200].map(x => `<rect x="${x}" y="40" width="34" height="20" fill="${GREEN}" opacity=".8"/>`).join('')}
    ${t(24, 54, 'wake', 'fill="#fff"')}${t(114, 54, 'wake', 'fill="#fff"')}${t(204, 54, 'wake', 'fill="#fff"')}
    ${t(60, 76, 'sleep')}${t(150, 76, 'sleep')}${t(240, 76, 'sleep')}
    ${t(8, 100, 'Client radios sleep between slots → big battery savings (IoT)')}`),

  bsscolor: wrap(`
    <circle cx="80" cy="60" r="44" fill="${BLUE}" opacity=".18" stroke="${BLUE}"/>
    <circle cx="190" cy="60" r="44" fill="${AMBER}" opacity=".18" stroke="${AMBER}"/>
    <rect x="64" y="52" width="32" height="16" rx="3" fill="${BLUE}"/>${t(70, 64, 'BSS 1', 'fill="#fff"')}
    <rect x="174" y="52" width="32" height="16" rx="3" fill="${AMBER}"/>${t(180, 64, 'BSS 2', 'fill="#fff"')}
    ${t(8, 18, 'Frames tagged with a BSS "colour"')}
    ${t(8, 112, 'Overlapping cells ignore other-colour frames → reuse channel')}`),

  width320: wrap(`
    ${t(8, 12, 'Channel width (6 GHz)')}
    ${[['20', 16, BLUE], ['40', 30, BLUE], ['80', 58, GREEN], ['160', 110, AMBER], ['320', 220, PURPLE]]
      .map((b, i) => `<rect x="8" y="${22 + i * 18}" width="${b[1]}" height="13" fill="${b[2]}" opacity=".8"/>${t(8 + b[1] + 4, 32 + i * 18, b[0] + ' MHz')}`).join('')}
    ${t(8, 116, 'Wi-Fi 7 doubles Wi-Fi 6E to 320 MHz')}`),

  mlo: wrap(`
    <rect x="118" y="50" width="44" height="20" rx="3" fill="${PURPLE}"/>${t(126, 64, 'client', 'fill="#fff"')}
    <rect x="118" y="6" width="44" height="14" rx="2" fill="none" stroke="${GREEN}"/>${t(124, 16, '6 GHz')}
    <rect x="6"  y="50" width="44" height="20" rx="3" fill="none" stroke="currentColor"/>${t(16, 64, 'AP')}
    <line x1="140" y1="50" x2="140" y2="20" stroke="${GREEN}" stroke-width="2"/>
    <line x1="118" y1="60" x2="50" y2="60" stroke="${BLUE}" stroke-width="2"/>
    <line x1="140" y1="70" x2="60" y2="104" stroke="${AMBER}" stroke-width="2"/>
    ${t(150, 92, '2.4 / 5 / 6 GHz links at once')}
    ${t(8, 116, 'Multi-Link Operation aggregates bands for speed/reliability')}`),

  puncture: wrap(`
    ${t(8, 14, '160 MHz channel with interference on one sub-block')}
    <rect x="8" y="26" width="264" height="30" rx="3" fill="none" stroke="currentColor" stroke-opacity=".3"/>
    ${[0, 1, 2, 3].map(i => {
      const x = 10 + i * 65, busy = i === 2;
      return `<rect x="${x}" y="28" width="62" height="26" fill="${busy ? RED : GREEN}" opacity=".7"/>${t(x + 16, 45, busy ? 'busy' : 'used', 'fill="#fff"')}`;
    }).join('')}
    ${t(8, 78, 'Punctures the busy 20/40 MHz and still uses the rest')}
    ${t(8, 92, '→ keeps a wide channel alive despite interference')}`)
};

function grid(x, y, n, color) {
  // n×n constellation of dots in an 80×80 box.
  const box = 80, step = box / (n + 1);
  let dots = '';
  for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) {
    dots += `<circle cx="${(x + i * step).toFixed(1)}" cy="${(y + j * step).toFixed(1)}" r="${n > 10 ? 0.9 : 1.4}" fill="${color}"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="none" stroke="currentColor" stroke-opacity=".25"/>${dots}`;
}
