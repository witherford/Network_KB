// Learning Hub — grid of topic cards. Each card opens a fully interactive
// learning centre for that topic (e.g. Cisco IOS XE WLC).

import { state, on } from '../state.js';
import { esc } from '../utils.js';

// Registry of available learning centres. Adding a new one is a two-step
// process: drop a module under js/pages/learning/ that exports mount(root,{onBack}),
// then add its entry here.
const TOPICS = [
  {
    id: 'wlc-ios-xe',
    title: 'Cisco IOS XE WLC',
    subtitle: 'Catalyst 9800 — architecture, configuration, AAA, RF, HA, troubleshooting.',
    vendor: 'Cisco',
    badgeClass: 'badge-wlc',
    icon: '📡',
    modules: 16,
    minutes: 240,
    tags: ['Wireless', 'Catalyst 9800', 'IOS XE', '802.11', 'WPA3'],
    loader: () => import('./learning/wlc-ios-xe.js'),
    status: 'available'
  },
  // Placeholders — show as "coming soon" until a module is added.
  { id: 'nexus-vxlan',   title: 'Cisco Nexus VXLAN-EVPN', subtitle: 'Fabric underlay, overlay, multi-site.',            vendor: 'Cisco',    badgeClass: 'badge-sw', icon: '🕸️', status: 'soon', tags: ['Data Centre', 'VXLAN', 'EVPN'] },
  { id: 'netscaler',     title: 'Citrix NetScaler',       subtitle: 'Load balancing, SSL, content switching, HA.',     vendor: 'Citrix',   badgeClass: 'badge-ns', icon: '⚖️', status: 'soon', tags: ['ADC', 'Load Balancer'] },
  { id: 'panos',         title: 'Palo Alto PAN-OS',       subtitle: 'Policy, NAT, zones, GlobalProtect.',              vendor: 'Palo Alto', badgeClass: 'badge-pa', icon: '🔥', status: 'soon', tags: ['Firewall', 'NGFW'] },
  { id: 'asa-ftd',       title: 'Cisco ASA / FTD',        subtitle: 'VPN, ACLs, packet-tracer deep-dive.',             vendor: 'Cisco',    badgeClass: 'badge-asa', icon: '🛡️', status: 'soon', tags: ['Firewall', 'VPN'] },
  { id: 'ise',           title: 'Cisco ISE',              subtitle: '802.1X, profiling, BYOD, posture.',               vendor: 'Cisco',    badgeClass: 'badge-sw', icon: '🧾', status: 'soon', tags: ['AAA', 'Security'] }
];

let _activeTopic = null;

export async function mount(root) {
  // If a topic was already being viewed this session, restore it.
  const hash = (location.hash || '').replace(/^#\/?/, '').split('/');
  if (hash[0] === 'guides' && hash[1]) {
    const t = TOPICS.find(x => x.id === hash[1]);
    if (t && t.status === 'available') return openTopic(root, t);
  }
  renderHub(root);

  on('editmode:changed', () => { if (state.currentPage === 'guides') renderHub(root); });
  window.addEventListener('nkb:reload', () => { if (state.currentPage === 'guides') renderHub(root); }, { once: true });
}

function renderHub(root) {
  _activeTopic = null;
  // Keep the nav hash clean when returning to the hub.
  if (location.hash !== '#/guides') location.hash = '#/guides';

  const available = TOPICS.filter(t => t.status === 'available');
  const soon      = TOPICS.filter(t => t.status !== 'available');

  root.innerHTML = `
    <div class="learning-hub">
      <header class="hub-hero">
        <div class="hub-hero-text">
          <div class="hub-eyebrow">Learning Hub</div>
          <h1>Interactive learning centres for network engineering</h1>
          <p>Pick a topic to open a full learning centre — guided modules, copy-ready CLI, diagrams, troubleshooting trees, and progress tracking that sticks between visits.</p>
          <div class="hub-stats">
            <span class="hub-stat"><b>${available.length}</b> centre${available.length === 1 ? '' : 's'} live</span>
            <span class="hub-stat"><b>${soon.length}</b> on the way</span>
          </div>
        </div>
        <div class="hub-hero-art" aria-hidden="true">
          <div class="hub-orb hub-orb-1"></div>
          <div class="hub-orb hub-orb-2"></div>
          <div class="hub-orb hub-orb-3"></div>
        </div>
      </header>

      <section class="hub-section">
        <div class="hub-sec-head"><h2>Available now</h2><span class="hub-sec-cnt">${available.length}</span></div>
        <div class="hub-grid">
          ${available.map(renderCard).join('') || '<div class="page-empty">No learning centres available yet.</div>'}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sec-head"><h2>Coming soon</h2><span class="hub-sec-cnt">${soon.length}</span></div>
        <div class="hub-grid">
          ${soon.map(renderCard).join('')}
        </div>
      </section>
    </div>`;

  root.addEventListener('click', e => {
    const card = e.target.closest('.hub-card');
    if (!card) return;
    const id = card.dataset.id;
    const t = TOPICS.find(x => x.id === id);
    if (!t || t.status !== 'available') return;
    openTopic(root, t);
  });
}

function renderCard(t) {
  const disabled = t.status !== 'available';
  return `
    <article class="hub-card ${disabled ? 'disabled' : ''}" data-id="${t.id}" tabindex="${disabled ? -1 : 0}" role="button" aria-disabled="${disabled}">
      <div class="hub-card-top">
        <div class="hub-card-icon ${esc(t.badgeClass || '')}">${t.icon || '📘'}</div>
        <div class="hub-card-vendor">${esc(t.vendor || '')}</div>
      </div>
      <h3 class="hub-card-title">${esc(t.title)}</h3>
      <p class="hub-card-sub">${esc(t.subtitle || '')}</p>
      <div class="hub-card-meta">
        ${t.modules ? `<span>📚 ${t.modules} modules</span>` : ''}
        ${t.minutes ? `<span>⏱ ~${t.minutes} min</span>` : ''}
      </div>
      <div class="hub-card-tags">
        ${(t.tags || []).map(tg => `<span class="hub-tag">${esc(tg)}</span>`).join('')}
      </div>
      <div class="hub-card-cta">
        ${disabled
          ? '<span class="hub-soon">Coming soon</span>'
          : '<span class="hub-open">Open learning centre →</span>'}
      </div>
    </article>`;
}

async function openTopic(root, topic) {
  _activeTopic = topic.id;
  if (location.hash !== '#/guides/' + topic.id) {
    // Use replace so back button returns to whatever was before Guides, not a hub state.
    history.replaceState(null, '', '#/guides/' + topic.id);
  }
  root.innerHTML = '<div class="page-loading">Loading learning centre…</div>';
  try {
    const mod = await topic.loader();
    await mod.mount(root, {
      onBack: () => renderHub(root)
    });
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page-empty">Failed to load learning centre: ${esc(err.message)}</div>`;
  }
}
