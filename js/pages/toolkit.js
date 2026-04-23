// Toolkit container — sub-router over subnet/ping/dns/regex/calculator/cheatsheets/worldclock.

const SUBS = {
  subnet:       { label: 'Subnet calc',  load: () => import('../toolkit/subnet.js') },
  ping:         { label: 'Ping script',  load: () => import('../toolkit/ping-script.js') },
  dns:          { label: 'DNS script',   load: () => import('../toolkit/dns-script.js') },
  regex:        { label: 'Regex builder',load: () => import('../toolkit/regex-builder.js') },
  calculator:   { label: 'Calculator',   load: () => import('../toolkit/calculator.js') },
  cheatsheets:  { label: 'Cheat sheets', load: () => import('../toolkit/cheatsheets.js') },
  worldclock:   { label: 'World clock',  load: () => import('../toolkit/worldclock.js') }
};

function subFromHash() {
  const m = (location.hash || '').match(/^#\/toolkit\/(\w+)/);
  return m && SUBS[m[1]] ? m[1] : 'subnet';
}

export async function mount(root) {
  root.innerHTML = `
    <nav class="sub-nav" id="tkNav">
      ${Object.entries(SUBS).map(([k, v]) => `<button class="ftab" data-sub="${k}">${v.label}</button>`).join('')}
    </nav>
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

  // Respond to both clicks (via hashchange fired by the assignment above)
  // and external navigation like someone deep-linking #/toolkit/cheatsheets.
  const onHash = () => {
    if (!root.isConnected) { window.removeEventListener('hashchange', onHash); return; }
    if (!/^#\/toolkit/.test(location.hash || '#/toolkit/subnet')) return;
    showSub(subFromHash());
  };
  window.addEventListener('hashchange', onHash);

  showSub(subFromHash());
}
