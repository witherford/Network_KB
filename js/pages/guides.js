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
  {
    id: 'netscaler',
    title: 'Citrix NetScaler',
    subtitle: 'ADC fundamentals — load balancing, SSL, content switching, rewrite/responder, GSLB, HA, ICA Proxy, WAF, AAA.',
    vendor: 'NetScaler / Citrix',
    badgeClass: 'badge-ns',
    icon: '⚖️',
    modules: 13,
    minutes: 240,
    tags: ['ADC', 'Load Balancer', 'SSL', 'GSLB', 'ICA Proxy'],
    loader: () => import('./learning/netscaler.js'),
    status: 'available'
  },
  {
    id: 'ospf',
    title: 'OSPF',
    subtitle: 'Link-state fundamentals — adjacencies, LSAs, areas, network types, summarisation, stubs, OSPFv3, troubleshooting.',
    vendor: 'Routing',
    badgeClass: 'badge-ospf',
    icon: '🗺️',
    modules: 12,
    minutes: 240,
    tags: ['Routing', 'IGP', 'Link-state', 'LSA', 'OSPFv3'],
    loader: () => import('./learning/ospf.js'),
    status: 'available'
  },
  {
    id: 'bgp',
    title: 'BGP',
    subtitle: 'Path-vector routing — neighbor states, attributes, best-path, iBGP scaling, communities, filtering, MP-BGP, fast convergence.',
    vendor: 'Routing',
    badgeClass: 'badge-bgp',
    icon: '🌐',
    modules: 12,
    minutes: 300,
    tags: ['Routing', 'EGP', 'Path-vector', 'Communities', 'MP-BGP'],
    loader: () => import('./learning/bgp.js'),
    status: 'available'
  },
  {
    id: 'eigrp',
    title: 'EIGRP',
    subtitle: 'Cisco advanced distance-vector — DUAL, neighbors, composite metric, stubs, summarisation, variance, troubleshooting.',
    vendor: 'Cisco',
    badgeClass: 'badge-eigrp',
    icon: '🧭',
    modules: 10,
    minutes: 180,
    tags: ['Routing', 'IGP', 'DUAL', 'Cisco'],
    loader: () => import('./learning/eigrp.js'),
    status: 'available'
  },
  {
    id: 'mpls',
    title: 'MPLS',
    subtitle: 'Label switching — LDP, L3VPN, L2VPN, TE, Segment Routing, QoS, Inter-AS, troubleshooting.',
    vendor: 'Service Provider',
    badgeClass: 'badge-mpls',
    icon: '🏷️',
    modules: 10,
    minutes: 270,
    tags: ['MPLS', 'L3VPN', 'Segment Routing', 'TE'],
    loader: () => import('./learning/mpls.js'),
    status: 'available'
  },
  {
    id: 'wifi',
    title: 'Wi-Fi',
    subtitle: '802.11 fundamentals — PHY, association, roaming, RF design, channels/power, WMM QoS, multicast, guest, Wi-Fi 6E/7.',
    vendor: 'Wireless',
    badgeClass: 'badge-wifi',
    icon: '📶',
    modules: 11,
    minutes: 300,
    tags: ['Wireless', '802.11', 'RF', 'Wi-Fi 6E', 'Wi-Fi 7'],
    loader: () => import('./learning/wifi.js'),
    status: 'available'
  },
  {
    id: 'qos',
    title: 'QoS',
    subtitle: 'Classification, marking, queuing, shaping/policing, congestion avoidance, AutoQoS, campus vs WAN vs SD-WAN.',
    vendor: 'Networking',
    badgeClass: 'badge-qos',
    icon: '🎚️',
    modules: 10,
    minutes: 220,
    tags: ['QoS', 'DSCP', 'Queuing', 'Shaping', 'SD-WAN'],
    loader: () => import('./learning/qos.js'),
    status: 'available'
  },
  {
    id: 'multicast',
    title: 'IP Multicast',
    subtitle: 'IGMP/MLD, PIM dense/sparse, SSM/Bidir, RP discovery, MSDP, mVPN, L2 snooping, troubleshooting.',
    vendor: 'Networking',
    badgeClass: 'badge-mcast',
    icon: '📡',
    modules: 10,
    minutes: 220,
    tags: ['Multicast', 'PIM', 'IGMP', 'MSDP', 'mVPN'],
    loader: () => import('./learning/multicast.js'),
    status: 'available'
  },
  {
    id: 'storage',
    title: 'Storage',
    subtitle: 'Block, file, object — SAN/NAS/S3, RAID, multipathing, FC fabrics, NVMe-oF, snapshots, replication, cloud.',
    vendor: 'Storage',
    badgeClass: 'badge-storage',
    icon: '💾',
    modules: 12,
    minutes: 260,
    tags: ['Storage', 'SAN', 'NAS', 'S3', 'NVMe-oF', 'RAID'],
    loader: () => import('./learning/storage.js'),
    status: 'available'
  },
  {
    id: 'panos',
    title: 'Palo Alto PAN-OS',
    subtitle: 'Single-pass engine — App-ID, User-ID, Content-ID, decryption, GlobalProtect, HA, Panorama.',
    vendor: 'Palo Alto',
    badgeClass: 'badge-pa',
    icon: '🔥',
    modules: 16,
    minutes: 260,
    tags: ['Firewall', 'NGFW', 'App-ID', 'GlobalProtect', 'Panorama'],
    loader: () => import('./learning/panos.js'),
    status: 'available'
  },
  {
    id: 'azure',
    title: 'Microsoft Azure Networking',
    subtitle: 'VNet, NSG/ASG, Azure Firewall, Virtual WAN, Private Link, ExpressRoute, Network Watcher.',
    vendor: 'Microsoft',
    badgeClass: 'badge-azure',
    icon: '☁️',
    modules: 15,
    minutes: 270,
    tags: ['Cloud', 'Azure', 'VNet', 'Virtual WAN', 'Private Link'],
    loader: () => import('./learning/azure.js'),
    status: 'available'
  },
  {
    id: 'aws',
    title: 'AWS Networking',
    subtitle: 'VPC, SG/NACL, Transit Gateway, ELB, Direct Connect, Route 53, PrivateLink, CloudFront.',
    vendor: 'AWS',
    badgeClass: 'badge-aws',
    icon: '🟧',
    modules: 15,
    minutes: 280,
    tags: ['Cloud', 'AWS', 'VPC', 'Transit Gateway', 'PrivateLink'],
    loader: () => import('./learning/aws.js'),
    status: 'available'
  },
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
