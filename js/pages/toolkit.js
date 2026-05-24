// Toolkit container — grouped sub-router over calculators, cheat sheets,
// password/hash tools, scripts & builders, WIFI tools and Palo Alto helpers.

const SUBS = {
  // Calculators
  subnet:       { label: 'Subnet calc',        group: 'Calculators',          load: () => import('../toolkit/subnet.js') },
  vlsm:         { label: 'VLSM optimiser',      group: 'Calculators',          load: () => import('../toolkit/vlsm.js') },
  throughput:   { label: 'Throughput / MTU',    group: 'Calculators',          load: () => import('../toolkit/throughput.js') },
  calculator:   { label: 'Calculator',          group: 'Calculators',          load: () => import('../toolkit/calculator.js') },

  // Cheat sheets & references
  cheatsheets:  { label: 'Cheat sheets',        group: 'Cheat sheets',         load: () => import('../toolkit/cheatsheets.js') },
  dscp:         { label: 'DSCP / ToS',          group: 'Cheat sheets',         load: () => import('../toolkit/dscp.js') },

  // Password & Hash tools
  password:     { label: 'Password gen',        group: 'Password & Hash tools', load: () => import('../toolkit/password.js') },
  encoding:     { label: 'Encoding & hash',     group: 'Password & Hash tools', load: () => import('../toolkit/encoding.js') },

  // Scripts & builders
  ping:         { label: 'Ping script',         group: 'Scripts & builders',   load: () => import('../toolkit/ping-script.js') },
  dns:          { label: 'DNS script',          group: 'Scripts & builders',   load: () => import('../toolkit/dns-script.js') },
  oui:          { label: 'OUI lookup',          group: 'Scripts & builders',   load: () => import('../toolkit/oui-list.js') },
  arpmac:       { label: 'ARP + MAC merge',     group: 'Scripts & builders',   load: () => import('../toolkit/arp-mac-merge.js') },
  tcl:          { label: 'TCL generator',       group: 'Scripts & builders',   load: () => import('../toolkit/tcl-generator.js') },
  filter:       { label: 'Capture filters',     group: 'Scripts & builders',   load: () => import('../toolkit/filter-builder.js') },
  jsonyaml:     { label: 'JSON / YAML',         group: 'Scripts & builders',   load: () => import('../toolkit/json-yaml.js') },
  regex:        { label: 'Regex builder',       group: 'Scripts & builders',   load: () => import('../toolkit/regex-builder.js') },

  // WIFI tools
  wifistd:      { label: 'Wireless standards',  group: 'WIFI tools',           load: () => import('../toolkit/wifi-standards.js') },
  wifichan:     { label: 'Channels & frequencies', group: 'WIFI tools',        load: () => import('../toolkit/wifi-channels.js') },
  wifisignal:   { label: 'Signal reference',    group: 'WIFI tools',           load: () => import('../toolkit/wifi-signal.js') },
  wifisec:      { label: 'Security & encryption', group: 'WIFI tools',         load: () => import('../toolkit/wifi-security.js') },

  // Palo Alto
  patraffic:    { label: 'Traffic filters',     group: 'Palo Alto',            load: () => import('../toolkit/pa-traffic-filters.js') },

  // Misc
  worldclock:   { label: 'World clock',         group: 'Other',                load: () => import('../toolkit/worldclock.js') }
};

// Preserve insertion order of groups for the nav.
const GROUPS = [];
for (const v of Object.values(SUBS)) if (!GROUPS.includes(v.group)) GROUPS.push(v.group);

function subFromHash() {
  const m = (location.hash || '').match(/^#\/toolkit\/(\w+)/);
  return m && SUBS[m[1]] ? m[1] : 'subnet';
}

export async function mount(root) {
  const nav = GROUPS.map(g => `
    <div class="tk-group">
      <div class="tk-group-label">${g}</div>
      <div class="tk-group-tabs">
        ${Object.entries(SUBS).filter(([, v]) => v.group === g)
          .map(([k, v]) => `<button class="ftab" data-sub="${k}">${v.label}</button>`).join('')}
      </div>
    </div>`).join('');

  root.innerHTML = `
    <nav class="sub-nav grouped" id="tkNav">${nav}</nav>
    <div id="tkBody" class="page"></div>`;

  const body = root.querySelector('#tkBody');
  async function showSub(key) {
    for (const b of root.querySelectorAll('#tkNav .ftab')) {
      b.classList.toggle('active', b.dataset.sub === key);
    }
    body.innerHTML = '<div class="page-loading">Loading…</div>';
    try {
      const mod = await SUBS[key].load();
      await mod.mount(body);
    } catch (err) {
      body.innerHTML = `<div class="page-empty">Failed to load: ${err.message}</div>`;
    }
  }

  root.querySelector('#tkNav').addEventListener('click', e => {
    const btn = e.target.closest('.ftab');
    if (!btn) return;
    location.hash = '#/toolkit/' + btn.dataset.sub;
  });

  const onHash = () => {
    if (!root.isConnected) { window.removeEventListener('hashchange', onHash); return; }
    if (!/^#\/toolkit/.test(location.hash || '#/toolkit/subnet')) return;
    showSub(subFromHash());
  };
  window.addEventListener('hashchange', onHash);

  showSub(subFromHash());
}
