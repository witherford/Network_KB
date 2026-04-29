// Commands database page — list, search, filter, favourites, recent, copy.
// Edit mode adds: checkbox selection, bulk toolbar, add/edit/delete command,
// add/delete platform + section, CSV import/export.

import { loadData } from '../dataloader.js';
import { esc, hlText, debounce, copyToClipboard, toast, download } from '../utils.js';
import { getPrefs, setPref, toggleFavourite, isFavourite, pushRecent, toggleCollapsed, isCollapsed, collapseAll, cmdKey, isFlagged, setFlag, unsetFlag, getFlag, getAllFlags, getSectionTypes, setSectionType } from '../prefs.js';
import { state, emit, on } from '../state.js';
import { openModal, confirmModal, promptModal } from '../components/modal.js';
import { validateFlagDescription, getBlockedTerms, flaggingEnabled, recordFlagAttempt, getFlagRateHistory, getFlagRateConfig, getGlobalFlagCount, incrementGlobalFlagCount } from '../components/flag-validator.js';
import { groupByTopic, shouldGroup } from '../components/topic-detect.js';
import { parseCsv, validateCsv, exportCsv, mergeAdditions } from '../components/csv.js';
// Backend AI pull disabled per v1.3.3.
// import { fetchForKind } from '../components/ai-fetch.js';

const TYPE_LABELS = { all: 'All', show: 'Show', config: 'Configuration', troubleshooting: 'Troubleshooting' };

let ui = { group: 'all', platform: 'all', type: 'all', query: '', selected: new Set(), hideWithExamples: false };
let rootEl = null;

function workingData() {
  return state.editMode && state.pending.commands ? state.pending.commands : state.data.commands;
}

function ensureDraft() {
  if (!state.pending.commands) {
    state.pending.commands = structuredClone(state.data.commands);
  }
  emit('pending:changed');
  return state.pending.commands;
}

export async function mount(root) {
  rootEl = root;
  const disk = await loadData('commands');
  state.data.commands = disk;
  // Load the deployed quarantine (data/quarantine.json) — represents the
  // admin-approved global flag list, "baked into the app". Merged into
  // the local view via mergeQuarantineFlagsIntoLocal() below.
  try {
    const q = await loadData('quarantine');
    state.data.quarantine = q;
    mergeQuarantineFlagsIntoLocal(q);
  } catch (err) {
    console.warn('[commands] quarantine load failed:', err);
  }

  root.innerHTML = shellHtml();
  renderAll();
  wireToolbar(root);
  document.getElementById('cmdListRoot').addEventListener('click', onListClick);
  document.getElementById('cmdListRoot').addEventListener('change', onListChange);
  // Pull the global flag counter in the background; updates the stats bar
  // when the value arrives. Fails silently if abacus is unreachable.
  fetchGlobalFlagCount();

  on('editmode:changed', () => { if (state.currentPage === 'commands') renderAll(); });
  window.addEventListener('nkb:reload', () => {
    if (state.currentPage === 'commands') { ui.selected.clear(); mount(root); }
  }, { once: true });
}

function shellHtml() {
  const p = getPrefs();
  return `
    <div class="stats-bar" id="cmdStats"></div>
    <div class="page-toolbar">
      <input id="cmdSearch" class="search-input" placeholder="Search commands…   (press /)">
      <span class="spacer"></span>
      <span id="cmdMatch" style="font-size:11px;color:var(--text-3);margin-right:10px"></span>
      <button class="btn" id="cmdExport" title="Export CSV">Export</button>
      <span id="cmdEditActions" style="display:${state.editMode ? 'inline-flex' : 'none'};gap:6px">
        <button class="btn" id="cmdImport" title="Import CSV / XLSX">Import</button>
        <button class="btn primary" id="cmdAddPlat" title="Add platform">+ Platform</button>
        <button class="btn primary" id="cmdAddCmd" title="Add command">+ Command</button>
      </span>
    </div>
    <div id="cmdBulkBar" class="bulk-toolbar" style="display:none"></div>
    <div class="filter-tabs" id="cmdGroupTabs"></div>
    <div class="filter-tabs" id="cmdPlatTabs"></div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <div class="filter-tabs type-row" id="cmdTypeTabs" style="flex:1"></div>
      <span style="display:flex;gap:10px;align-items:center;padding:0 8px;flex-wrap:wrap">
        <button class="btn collapse-all-btn" id="cmdExpandAll" title="Expand every section">▾ Expand all sections</button>
        <button class="btn collapse-all-btn" id="cmdCollapseAll" title="Collapse every section">▸ Collapse all sections</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2);white-space:nowrap;font-weight:500" title="Hide commands that already have a 'Show example output' toggle. Useful for finding commands that still need example outputs added.">
          <input type="checkbox" id="cmdHideExamples" ${ui.hideWithExamples ? 'checked' : ''}> Hide commands with examples
        </label>
      </span>
    </div>
    <div class="page with-cmd" id="cmdListRoot"></div>`;
}

function renderAll() {
  const editActions = document.getElementById('cmdEditActions');
  if (editActions) editActions.style.display = state.editMode ? 'inline-flex' : 'none';
  renderStatsBar();
  renderGroupTabs();
  renderPlatformTabs();
  renderTypeTabs();
  renderList();
  renderBulkBar();
}

function platformsInGroup(group) {
  const d = workingData();
  const p = d?.platforms || {};
  if (!group || group === 'all') return Object.keys(p);
  return Object.keys(p).filter(k => (p[k].group || 'Other') === group);
}

function renderGroupTabs() {
  const root = document.getElementById('cmdGroupTabs');
  if (!root) return;
  const d = workingData();
  const platforms = d?.platforms || {};
  // Collect group → command count.
  const groupCounts = new Map();
  let total = 0;
  for (const [k, p] of Object.entries(platforms)) {
    const n = Object.values(p.sections || {}).reduce((a, s) => a + s.length, 0);
    total += n;
    const g = p.group || 'Other';
    groupCounts.set(g, (groupCounts.get(g) || 0) + n);
  }
  // Stable order: All first, then Cisco, Palo Alto, Citrix, Microsoft, Cloud, Virtualisation, Linux/Unix, Tools, then any others alphabetically.
  const order = ['Cisco', 'Palo Alto', 'Citrix', 'Microsoft', 'Cloud', 'Virtualisation', 'Linux / Unix', 'Tools'];
  const seen = new Set(order);
  const extras = [...groupCounts.keys()].filter(g => !seen.has(g)).sort();
  const ordered = ['all', ...order.filter(g => groupCounts.has(g)), ...extras];
  root.innerHTML = ordered.map(g => {
    const label = g === 'all' ? 'All groups' : g;
    const cnt = g === 'all' ? total : (groupCounts.get(g) || 0);
    if (g !== 'all' && !cnt) return '';
    const active = ui.group === g ? ' active' : '';
    return `<button class="ftab grp${active}" data-grp="${esc(g)}">${esc(label)}<span class="cnt">${cnt}</span></button>`;
  }).join('');
  root.onclick = e => {
    const btn = e.target.closest('[data-grp]');
    if (!btn) return;
    ui.group = btn.dataset.grp;
    // Reset platform to 'all' when switching groups so we don't end up
    // on a hidden platform.
    ui.platform = 'all';
    ui.selected.clear();
    renderGroupTabs();
    renderPlatformTabs();
    renderList();
    renderBulkBar();
  };
}

function renderStatsBar() {
  const bar = document.getElementById('cmdStats');
  const d = workingData();
  const platforms = d?.platforms || {};
  const pKeys = Object.keys(platforms);
  let total = 0;
  for (const k of pKeys) for (const sec of Object.values(platforms[k].sections || {})) total += sec.length;
  // Cached global flag count (refreshed via fetchGlobalFlagCount()).
  const gf = (typeof globalFlagCountCache === 'number') ? globalFlagCountCache : null;
  bar.innerHTML =
    `<span><strong>${total}</strong> commands</span>` +
    `<span><strong>${pKeys.length}</strong> platforms</span>` +
    `<span><strong>${getPrefs().favourites.length}</strong> favourites</span>` +
    `<span><strong>${getPrefs().recent.length}</strong> recent</span>` +
    `<span title="Total flag reports raised across every visitor (synced)"><strong>${gf == null ? '—' : gf.toLocaleString()}</strong> globally flagged</span>`;
}

// Merge the deployed quarantine.json's flags into the user's local prefs so
// they show up immediately, even on a fresh device. Existing local flags
// take precedence (the user's own reasons / timestamps trump the deployed
// snapshot). Conversely, if the local cache has flags that the deployed
// file does NOT, we keep them — they may be pending admin review.
function mergeQuarantineFlagsIntoLocal(quarantine) {
  const remote = (quarantine && quarantine.flags) || {};
  for (const [key, info] of Object.entries(remote)) {
    if (!isFlagged(key)) {
      setFlag(key, info.reason || '');
      // Preserve original ts if provided.
      try {
        const p = JSON.parse(localStorage.getItem('nkb.prefs.v1') || '{}');
        if (p.flags && p.flags[key] && info.ts) p.flags[key].ts = info.ts;
        localStorage.setItem('nkb.prefs.v1', JSON.stringify(p));
      } catch {}
    }
  }
}

// Build the full flag map (local view) and stage it as a pending
// quarantine.json mutation so the next admin save pushes it.
function stageQuarantineForSave() {
  state.pending.quarantine = {
    version: 1,
    updatedAt: new Date().toISOString(),
    flags: getAllFlags()
  };
  emit('pending:changed');
}

// Global flag count is fetched async; cache + re-render when it lands.
let globalFlagCountCache = null;
async function fetchGlobalFlagCount() {
  const v = await getGlobalFlagCount();
  if (v != null && v !== globalFlagCountCache) {
    globalFlagCountCache = v;
    if (state.currentPage === 'commands') renderStatsBar();
  }
}

function renderPlatformTabs() {
  const root = document.getElementById('cmdPlatTabs');
  const d = workingData();
  const platforms = d?.platforms || {};
  const groupKeys = platformsInGroup(ui.group);
  // Counts cover only the platforms shown in the active group; "All" sums those.
  const counts = { all: 0, favourites: getPrefs().favourites.length, recent: getPrefs().recent.length };
  for (const k of groupKeys) {
    counts[k] = Object.values(platforms[k].sections || {}).reduce((a, s) => a + s.length, 0);
    counts.all += counts[k];
  }
  const groupLabel = ui.group === 'all' ? 'All' : ui.group;
  const flagCount = Object.keys(getAllFlags()).length;
  const tabs = [
    { key: 'all', label: 'All ' + groupLabel },
    ...groupKeys.map(k => ({ key: k, label: platforms[k].short || platforms[k].label || k })),
    { key: 'favourites', label: '★ Favourites' },
    { key: 'recent', label: 'Recent' },
    { key: 'quarantine', label: '🚩 Quarantine' }
  ];
  // Override the count for quarantine.
  counts.quarantine = flagCount;
  root.innerHTML = tabs.map(t => `
    <button class="ftab ${ui.platform === t.key ? 'active' : ''}" data-plat="${esc(t.key)}">
      ${esc(t.label)}<span class="cnt">${counts[t.key] || 0}</span>
    </button>`).join('');
  root.onclick = e => {
    const btn = e.target.closest('[data-plat]');
    if (!btn) return;
    ui.platform = btn.dataset.plat;
    ui.selected.clear();
    renderPlatformTabs();
    renderList();
    renderBulkBar();
  };
}

function renderTypeTabs() {
  const root = document.getElementById('cmdTypeTabs');
  const counts = countByType();
  const tabs = ['all', 'show', 'config', 'troubleshooting'];
  root.innerHTML = tabs.map(t => `
    <button class="ftab tt-${t} ${ui.type === t ? 'active' : ''}" data-type="${t}">
      ${TYPE_LABELS[t]}<span class="cnt">${counts[t] || 0}</span>
    </button>`).join('');
  root.onclick = e => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    ui.type = btn.dataset.type;
    renderTypeTabs();
    renderList();
  };
}

function countByType() {
  const counts = { all: 0, show: 0, config: 0, troubleshooting: 0 };
  for (const p of Object.values(workingData()?.platforms || {})) {
    for (const sec of Object.values(p.sections || {})) {
      for (const c of sec) {
        const t = c.type || 'show';
        counts.all++;
        counts[t] = (counts[t] || 0) + 1;
      }
    }
  }
  return counts;
}

function wireToolbar(root) {
  const search = root.querySelector('#cmdSearch');
  const onSearch = debounce(() => { ui.query = search.value.trim(); renderList(); }, 120);
  search.addEventListener('input', onSearch);
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { search.value = ''; ui.query = ''; renderList(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== search && !e.target.closest('input, textarea')) {
      e.preventDefault(); search.focus(); search.select();
    }
  });
  root.querySelector('#cmdExport').addEventListener('click', () => {
    const csv = exportCsv(workingData());
    download('commands.csv', csv, 'text/csv');
    toast('Exported ' + csv.split('\n').length + ' rows', 'success');
  });
  root.querySelector('#cmdImport').addEventListener('click', openImportModal);
  root.querySelector('#cmdAddPlat').addEventListener('click', openAddPlatformModal);
  root.querySelector('#cmdAddCmd').addEventListener('click', () => openCommandModal());
  // Backend AI pull (Fetch now) was removed in v1.3.3 — the previous
  // implementation was unreliable and is being redesigned.
  // Expand all / Collapse all — operates on whatever sections the
  // current filter is showing.
  root.querySelector('#cmdCollapseAll').addEventListener('click', () => bulkCollapse(true));
  root.querySelector('#cmdExpandAll').addEventListener('click', () => bulkCollapse(false));
  // "Hide commands with examples" filter — useful for spotting commands
  // that still need examples added.
  const hideExBox = root.querySelector('#cmdHideExamples');
  if (hideExBox) {
    hideExBox.addEventListener('change', () => {
      ui.hideWithExamples = hideExBox.checked;
      renderAll();
    });
  }
}

function bulkCollapse(collapsed) {
  // Gather every (platform:section) key currently in the rendered list.
  const keys = new Set();
  for (const row of filtered()) keys.add(row.pk + ':' + row.section);
  if (!keys.size) { toast('Nothing to ' + (collapsed ? 'collapse' : 'expand'), 'info'); return; }
  collapseAll([...keys], collapsed);
  renderList();
  toast((collapsed ? 'Collapsed ' : 'Expanded ') + keys.size + ' section' + (keys.size === 1 ? '' : 's'), 'success');
}

function* iterAll() {
  for (const [pk, p] of Object.entries(workingData()?.platforms || {})) {
    for (const [sec, cmds] of Object.entries(p.sections || {})) {
      for (let i = 0; i < cmds.length; i++) yield { pk, platform: p, section: sec, cmd: cmds[i], idx: i };
    }
  }
}

function filtered() {
  const q = ui.query.toLowerCase();
  const prefs = getPrefs();
  const favSet = new Set(prefs.favourites);
  const recArr = prefs.recent;
  const flags = getAllFlags();
  const flagSet = new Set(Object.keys(flags));
  const groupKeys = new Set(platformsInGroup(ui.group));
  const out = [];
  for (const row of iterAll()) {
    const key = cmdKey(row.pk, row.section, row.cmd.cmd);
    const isInQuarantine = flagSet.has(key);

    if (ui.type !== 'all' && (row.cmd.type || 'show') !== ui.type) continue;

    if (ui.platform === 'quarantine') {
      // Quarantine view: show ONLY flagged commands.
      if (!isInQuarantine) continue;
    } else {
      // All other views: hide flagged commands so they live exclusively
      // in the quarantine bucket.
      if (isInQuarantine) continue;
      if (ui.platform === 'favourites') { if (!favSet.has(key)) continue; }
      else if (ui.platform === 'recent') { if (!recArr.includes(key)) continue; }
      else if (ui.platform !== 'all') { if (row.pk !== ui.platform) continue; }
      else if (ui.group !== 'all' && !groupKeys.has(row.pk)) continue;
    }

    if (q) {
      const hay = (row.cmd.cmd + ' ' + (row.cmd.desc || '')).toLowerCase();
      if (!hay.includes(q)) continue;
    }
    // "Hide commands with examples" — filter out anything that already
    // carries a populated `example` field. Useful for review workflows.
    if (ui.hideWithExamples && typeof row.cmd.example === 'string' && row.cmd.example.trim().length > 0) continue;
    out.push(row);
  }
  if (ui.platform === 'recent') {
    const pos = new Map();
    recArr.forEach((k, i) => pos.set(k, i));
    out.sort((a, b) => (pos.get(cmdKey(a.pk, a.section, a.cmd.cmd)) ?? 999) - (pos.get(cmdKey(b.pk, b.section, b.cmd.cmd)) ?? 999));
  }
  return out;
}

function renderList() {
  const rows = filtered();
  const el = document.getElementById('cmdListRoot');
  document.getElementById('cmdMatch').textContent = rows.length + ' match' + (rows.length === 1 ? '' : 'es');

  if (!rows.length) { el.innerHTML = `<div class="no-results">No commands match this filter.</div>`; return; }

  const byPlat = new Map();
  for (const r of rows) {
    if (!byPlat.has(r.pk)) byPlat.set(r.pk, new Map());
    const sec = byPlat.get(r.pk);
    if (!sec.has(r.section)) sec.set(r.section, []);
    sec.get(r.section).push(r);
  }

  const q = ui.query;
  let html = '';
  for (const [pk, secs] of byPlat) {
    const d = workingData();
    const p = d.platforms[pk];
    const platLabel = p.label || pk;
    const badge = p.badge || 'badge-ns';
    const total = Array.from(secs.values()).reduce((a, s) => a + s.length, 0);
    html += `<section class="platform-section" data-plat="${esc(pk)}">
      <div class="platform-header">
        <span class="pill ${esc(badge)}">${esc(p.short || platLabel)}</span>
        <h2 class="ptitle">${esc(platLabel)}</h2>
        <span class="pcnt">${total} command${total === 1 ? '' : 's'}</span>
        ${state.editMode ? `<span class="plat-edit-actions">
          <button class="btn sm" data-pact="add-sec" data-pk="${esc(pk)}">+ Section</button>
          <button class="btn sm danger" data-pact="del-plat" data-pk="${esc(pk)}">Delete platform</button>
        </span>` : ''}
      </div>
      <div class="sections-grid">`;
    for (const [secName, items] of secs) {
      const collapseKey = pk + ':' + secName;
      const collapsed = isCollapsed(collapseKey);
      const types = getSectionTypes(collapseKey);
      // Filter items by per-section type toggles.
      const visible = items.filter(r => {
        const t = r.cmd.type || 'show';
        return !!types[t === 'show' || t === 'config' || t === 'troubleshooting' ? t : 'show'];
      });
      // Topic-grouping: if the section is large + diverse enough, render
      // topic sub-headers (BGP / OSPF / STP / VLAN / etc.); otherwise flat.
      const itemsHtml = renderItemsBody(visible, q);
      html += `<article class="section-card" data-sec="${esc(collapseKey)}" data-pk="${esc(pk)}" data-sname="${esc(secName)}">
        <header class="section-title">
          <span class="section-title-text">${esc(secName)}</span>
          <span class="sec-cnt">${visible.length}${visible.length !== items.length ? `<span class="sec-cnt-total" title="${items.length} total in this section">/${items.length}</span>` : ''}</span>
          <span class="sec-controls" role="group" aria-label="Section controls">
            <button class="btn sm ghost sec-ctl" data-act="sec-expand" title="Show every command in this section">▾ Expand</button>
            <button class="btn sm ghost sec-ctl" data-act="sec-collapse" title="Hide every command in this section">▸ Collapse</button>
            <span class="sec-type-filters" role="group" aria-label="Type filters">
              <button class="btn sm ghost type-chip ${types.show ? 'on' : ''} tt-show" data-act="sec-type" data-type="show" title="Toggle 'show' commands">SHOW</button>
              <button class="btn sm ghost type-chip ${types.config ? 'on' : ''} tt-config" data-act="sec-type" data-type="config" title="Toggle 'config' commands">CONFIG</button>
              <button class="btn sm ghost type-chip ${types.troubleshooting ? 'on' : ''} tt-troubleshooting" data-act="sec-type" data-type="troubleshooting" title="Toggle 'troubleshooting' commands">TRBL</button>
            </span>
            ${state.editMode ? `<button class="btn sm ghost" data-act="ren-sec" title="Rename section">✎</button>
               <button class="btn sm ghost" data-act="del-sec" title="Delete section">🗑</button>` : ''}
          </span>
        </header>
        <div class="cmd-list" ${collapsed ? 'hidden' : ''}>
          ${visible.length
            ? itemsHtml
            : '<div class="page-empty" style="padding:8px 12px;font-size:12px">No commands match the current type filter for this section.</div>'}
        </div>
      </article>`;
    }
    html += `</div></section>`;
  }
  el.innerHTML = html;
}

// Render the BODY of a section (everything inside .cmd-list). When the
// section has enough variety + volume, group items by inferred topic
// (BGP / OSPF / STP / VLAN / etc.) with a small topic header above each
// cluster. Otherwise render the items flat.
function renderItemsBody(items, query) {
  if (!items.length) return '';
  if (!shouldGroup(items)) return items.map(r => cmdItemHtml(r, query)).join('');
  const grouped = groupByTopic(items);
  const out = [];
  // Sort topics by descending count so the biggest cluster is at the top.
  const ordered = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [topic, rows] of ordered) {
    out.push(`<div class="topic-group" data-topic="${esc(topic)}">
      <div class="topic-header">
        <span class="topic-name">${esc(topic)}</span>
        <span class="topic-cnt">${rows.length}</span>
      </div>
      <div class="topic-items">
        ${rows.map(r => cmdItemHtml(r, query)).join('')}
      </div>
    </div>`);
  }
  return out.join('');
}

function cmdItemHtml(row, query) {
  const key = cmdKey(row.pk, row.section, row.cmd.cmd);
  const fav = isFavourite(key);
  const flagged = isFlagged(key);
  const flagInfo = flagged ? getFlag(key) : null;
  const t = row.cmd.type || 'show';
  const sel = ui.selected.has(key);
  const hasExample = typeof row.cmd.example === 'string' && row.cmd.example.trim().length > 0;
  return `<div class="cmd-item${fav ? ' favourite' : ''}${row.cmd.flagged ? ' flagged' : ''}${flagged ? ' user-flagged' : ''}${sel ? ' selected' : ''}" data-key="${esc(key)}" data-cmd="${esc(row.cmd.cmd)}" data-pk="${esc(row.pk)}" data-section="${esc(row.section)}" data-idx="${row.idx}">
    <div class="cmd-row">
      ${state.editMode ? `<input type="checkbox" class="cmd-sel" ${sel ? 'checked' : ''} title="Select">` : ''}
      <div class="cmd-body">
        <div class="cmd-line cmd-desc-line"><span class="cmd-lbl">Description:</span> <span class="cmd-desc-text">${hlText(row.cmd.desc || '(no description)', query)}</span></div>
        <div class="cmd-line cmd-cmd-line"><span class="cmd-lbl">Command:</span> <code class="cmd-cmd-text">${hlText(row.cmd.cmd, query)}</code></div>
        ${hasExample ? `<button class="cmd-example-toggle" data-act="example" type="button" title="View an example of this command's output">▸ Show example output</button><pre class="cmd-example" hidden>${esc(row.cmd.example)}</pre>` : ''}
        ${flagged ? `<div class="cmd-flag-reason" title="Flagged ${new Date(flagInfo.ts).toLocaleString()}"><span class="cmd-flag-pill">🚩 Flagged</span> ${esc(flagInfo.reason)}</div>` : ''}
      </div>
      <div class="cmd-actions">
        ${state.editMode ? '<button class="btn sm ghost" data-act="edit" title="Edit">✎</button>' : ''}
        <button class="btn sm ghost" data-act="fav" title="${fav ? 'Unfavourite' : 'Favourite'}">${fav ? '★' : '☆'}</button>
        ${flagged
          ? '<button class="btn sm ghost" data-act="unflag" title="Restore from quarantine — admin or reporter only">↺</button>'
          : (flaggingEnabled()
              ? '<button class="btn sm ghost cmd-flag-btn" data-act="flag" title="Flag this command as not working">🚩</button>'
              : '')}
        <button class="cpy-btn" data-act="copy" title="Copy command">Copy</button>
        <span class="type-badge tb-${t}" title="Command category">${t.toUpperCase()}</span>
      </div>
    </div>
  </div>`;
}

function onListChange(e) {
  if (!e.target.classList.contains('cmd-sel')) return;
  const item = e.target.closest('.cmd-item');
  const key = item.dataset.key;
  if (e.target.checked) ui.selected.add(key); else ui.selected.delete(key);
  item.classList.toggle('selected', e.target.checked);
  renderBulkBar();
}

function onListClick(e) {
  const plBtn = e.target.closest('button[data-pact]');
  if (plBtn) return onPlatformAction(plBtn);

  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const card = btn.closest('.section-card');
  const item = btn.closest('.cmd-item');

  if (act === 'toggle' && card) { toggleCollapsed(card.dataset.sec); renderList(); return; }
  // Per-section "Expand all" — uncollapse this section.
  if (act === 'sec-expand' && card) {
    if (isCollapsed(card.dataset.sec)) toggleCollapsed(card.dataset.sec);
    renderList(); return;
  }
  // Per-section "Collapse all" — collapse this section.
  if (act === 'sec-collapse' && card) {
    if (!isCollapsed(card.dataset.sec)) toggleCollapsed(card.dataset.sec);
    renderList(); return;
  }
  // Per-section "Show commands" toggle removed in v1.3.5 — commands are
  // now always visible. Old prefs entries are harmless and ignored.
  // Per-section type filter chip — toggle one type on/off in this section.
  if (act === 'sec-type' && card) {
    const sectionKey = card.dataset.sec;
    const t = btn.dataset.type;
    const cur = getSectionTypes(sectionKey);
    setSectionType(sectionKey, t, !cur[t]);
    renderList(); return;
  }
  if (act === 'ren-sec' && card) return renameSection(card.dataset.pk, card.dataset.sname);
  if (act === 'del-sec' && card) return deleteSection(card.dataset.pk, card.dataset.sname);
  if (!item) return;

  if (act === 'copy') {
    const cmd = item.dataset.cmd;
    copyToClipboard(cmd).then(ok => {
      if (!ok) return toast('Copy failed', 'error');
      btn.classList.add('copied'); btn.textContent = 'Copied';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1200);
      pushRecent(item.dataset.key);
      renderStatsBar();
    });
    return;
  }
  if (act === 'fav') {
    const list = toggleFavourite(item.dataset.key);
    item.classList.toggle('favourite', list.includes(item.dataset.key));
    btn.textContent = list.includes(item.dataset.key) ? '★' : '☆';
    renderStatsBar(); renderPlatformTabs();
    return;
  }
  if (act === 'edit') {
    openCommandModal({ pk: item.dataset.pk, section: item.dataset.section, idx: Number(item.dataset.idx) });
    return;
  }
  if (act === 'flag') return openFlagModal(item.dataset.key, item.dataset.cmd);
  if (act === 'unflag') return openUnflagConfirm(item.dataset.key, item.dataset.cmd);
  // Per-item "Show example output" toggle. Local-only (not persisted).
  if (act === 'example') {
    const pre = item.querySelector('.cmd-example');
    if (!pre) return;
    const showing = !pre.hidden;
    pre.hidden = showing;
    btn.textContent = showing ? '▸ Show example output' : '▾ Hide example output';
    btn.classList.toggle('open', !showing);
    return;
  }
}

function openFlagModal(key, cmd) {
  // Hard-stop checks — flagging disabled by admin, or rate limit hit
  // before we even render the modal.
  const cfg = getFlagRateConfig();
  if (!cfg.enabled) {
    toast('Command flagging is currently disabled by the app admin.', 'warn', 6000);
    return;
  }
  const used = getFlagRateHistory().length;
  const remaining = Math.max(0, cfg.maxPerHour - used);
  if (remaining === 0) {
    const oldest = Math.min(...getFlagRateHistory());
    const resetMin = Math.ceil(((oldest + 3_600_000) - Date.now()) / 60_000);
    toast(`Flag-rate limit reached: ${cfg.maxPerHour}/hour. Try again in ${resetMin} minute${resetMin === 1 ? '' : 's'}.`, 'warn', 8000);
    return;
  }

  openModal((el, close) => {
    el.innerHTML = `
      <h3>Flag this command</h3>
      <p style="font-size:12px;color:var(--text-3);line-height:1.5;margin-bottom:8px">
        You're flagging <code>${esc(cmd)}</code>. Once flagged it moves to the <strong>🚩 Quarantine</strong> tab and disappears from normal browse views — its platform / group / section assignment is preserved.
      </p>
      <div class="form-row">
        <label>Why isn't this working?</label>
        <textarea id="flagDesc" rows="5" class="search-input" style="width:100%;font-family:inherit;resize:vertical" placeholder="Flag reports must be at least two sentences long. Describe what failed (error message, expected vs actual, firmware/version), and why you believe the command is broken rather than user error."></textarea>
        <div class="hint" id="flagDescHint" style="margin-top:6px;font-size:11px;line-height:1.5">
          Flag reports must be at least two sentences long. Generic descriptions ("not working", "bad command", etc.) are rejected — be specific.
        </div>
        <div class="hint" style="margin-top:4px;font-size:11px;color:var(--text-3)">
          Rate limit: ${cfg.maxPerHour}/hour. <strong>${remaining} flag${remaining === 1 ? '' : 's'} remaining</strong> in your current hour window.
        </div>
      </div>
      <div id="flagError" style="display:none;margin-top:8px;color:var(--danger,#dc2626);font-size:12px;line-height:1.5"></div>
      <div class="modal-footer">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="ok">Send to quarantine</button>
      </div>`;
    const ta = el.querySelector('#flagDesc');
    const errEl = el.querySelector('#flagError');
    setTimeout(() => ta.focus(), 0);

    const submit = () => {
      const text = ta.value;
      const result = validateFlagDescription(text);
      if (!result.ok) {
        errEl.style.display = '';
        errEl.textContent = result.reason;
        return;
      }
      // Description passed → now consume a rate-limit slot.
      const rate = recordFlagAttempt();
      if (!rate.allowed) {
        errEl.style.display = '';
        errEl.textContent = rate.reason;
        return;
      }
      setFlag(key, text.trim());
      stageQuarantineForSave();
      close();
      toast(`Command moved to quarantine. ${rate.remaining} flag${rate.remaining === 1 ? '' : 's'} left this hour.`, 'success', 4500);
      renderStatsBar();
      renderPlatformTabs();
      renderList();
      // Bump the global counter (cross-visitor) — fire-and-forget.
      incrementGlobalFlagCount().then(v => {
        if (v != null) {
          globalFlagCountCache = v;
          if (state.currentPage === 'commands') renderStatsBar();
        }
      });
    };

    el.querySelector('[data-act=ok]').addEventListener('click', submit);
    el.querySelector('[data-act=cancel]').addEventListener('click', close);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
      if (e.key === 'Escape') close();
    });
  });
}

async function openUnflagConfirm(key, cmd) {
  const ok = await confirmModal(`Restore "${cmd}" from quarantine? It will be visible in normal browse views again.`);
  if (!ok) return;
  unsetFlag(key);
  stageQuarantineForSave();
  toast('Command restored', 'success');
  renderStatsBar();
  renderPlatformTabs();
  renderList();
}

function onPlatformAction(btn) {
  const pk = btn.dataset.pk;
  if (btn.dataset.pact === 'add-sec') return addSection(pk);
  if (btn.dataset.pact === 'del-plat') return deletePlatform(pk);
}

/* ---------- Mutations ---------- */
async function addSection(pk) {
  const name = await promptModal('New section name');
  if (!name) return;
  const d = ensureDraft();
  d.platforms[pk].sections[name] ||= [];
  renderList();
}
async function renameSection(pk, old) {
  const name = await promptModal('Rename section', { initial: old });
  if (!name || name === old) return;
  const d = ensureDraft();
  const sec = d.platforms[pk].sections;
  sec[name] = sec[old]; delete sec[old];
  renderList();
}
async function deleteSection(pk, name) {
  const ok = await confirmModal(`Delete section "${name}" and all its commands?`, { danger: true });
  if (!ok) return;
  const d = ensureDraft();
  delete d.platforms[pk].sections[name];
  renderAll();
}
async function deletePlatform(pk) {
  const ok = await confirmModal(`Delete platform "${pk}" and every command in it?`, { danger: true });
  if (!ok) return;
  const d = ensureDraft();
  delete d.platforms[pk];
  renderAll();
}

function openAddPlatformModal() {
  openModal((el, close) => {
    el.innerHTML = `
      <h3>Add platform</h3>
      <div class="form-row"><label>Key</label><input id="apK" class="search-input" placeholder="e.g. cisco_nexus"></div>
      <div class="form-row" style="margin-top:8px"><label>Display label</label><input id="apL" class="search-input" placeholder="Cisco Nexus"></div>
      <div class="form-row" style="margin-top:8px"><label>Short tag</label><input id="apS" class="search-input" placeholder="NX"></div>
      <div class="modal-footer">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="ok">Add</button>
      </div>`;
    el.querySelector('[data-act=cancel]').addEventListener('click', close);
    el.querySelector('[data-act=ok]').addEventListener('click', () => {
      const key = el.querySelector('#apK').value.trim();
      const label = el.querySelector('#apL').value.trim();
      const short = el.querySelector('#apS').value.trim();
      if (!key || !label) return toast('Key and label required', 'error');
      const d = ensureDraft();
      if (d.platforms[key]) return toast('Key already exists', 'error');
      d.platforms[key] = { label, badge: 'badge-sw', short: short || key.slice(0, 3).toUpperCase(), sections: {} };
      close(); renderAll();
    });
  });
}

function openCommandModal({ pk, section, idx } = {}) {
  const d = workingData();
  const existing = (pk != null && section != null && idx != null)
    ? { ...d.platforms[pk].sections[section][idx] } : null;
  openModal((el, close) => {
    const platOpts = Object.entries(d.platforms || {}).map(([k, p]) =>
      `<option value="${esc(k)}" ${k === pk ? 'selected' : ''}>${esc(p.label || k)}</option>`).join('');
    el.innerHTML = `
      <h3>${existing ? 'Edit command' : 'Add command'}</h3>
      <div class="form-row"><label>Platform</label><select id="cmP">${platOpts}</select></div>
      <div class="form-row" style="margin-top:8px"><label>Section</label><input id="cmS" class="search-input" value="${esc(section || '')}" placeholder="System & Status"></div>
      <div class="form-row" style="margin-top:8px"><label>Command</label><input id="cmC" class="search-input" value="${esc(existing?.cmd || '')}"></div>
      <div class="form-row" style="margin-top:8px"><label>Description</label><textarea id="cmD" class="search-input" rows="3" style="width:100%">${esc(existing?.desc || '')}</textarea></div>
      <div class="form-row" style="margin-top:8px"><label>Type</label>
        <select id="cmT">
          ${['show', 'config', 'troubleshooting'].map(t => `<option value="${t}" ${(existing?.type || 'show') === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="modal-footer">
        ${existing ? '<button class="btn danger" data-act="del">Delete</button>' : ''}
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="ok">${existing ? 'Save' : 'Add'}</button>
      </div>`;
    const read = () => ({
      pk: el.querySelector('#cmP').value,
      section: el.querySelector('#cmS').value.trim(),
      cmd: el.querySelector('#cmC').value.trim(),
      desc: el.querySelector('#cmD').value,
      type: el.querySelector('#cmT').value
    });
    el.querySelector('[data-act=cancel]').addEventListener('click', close);
    el.querySelector('[data-act=ok]').addEventListener('click', () => {
      const v = read();
      if (!v.pk || !v.section || !v.cmd) return toast('Platform, section and command required', 'error');
      const draft = ensureDraft();
      const movedElsewhere = existing && (v.pk !== pk || v.section !== section);
      const newEntry = { cmd: v.cmd, desc: v.desc, type: v.type, flagged: existing?.flagged || false };
      if (existing && !movedElsewhere) {
        draft.platforms[pk].sections[section][idx] = newEntry;
      } else {
        if (existing) {
          draft.platforms[pk].sections[section].splice(idx, 1);
          if (!draft.platforms[pk].sections[section].length) delete draft.platforms[pk].sections[section];
        }
        draft.platforms[v.pk].sections[v.section] ||= [];
        draft.platforms[v.pk].sections[v.section].push(newEntry);
      }
      close(); renderAll();
    });
    el.querySelector('[data-act=del]')?.addEventListener('click', async () => {
      const ok = await confirmModal('Delete this command?', { danger: true });
      if (!ok) return;
      const draft = ensureDraft();
      draft.platforms[pk].sections[section].splice(idx, 1);
      if (!draft.platforms[pk].sections[section].length) delete draft.platforms[pk].sections[section];
      close(); renderAll();
    });
  });
}

/* ---------- Bulk ---------- */
function renderBulkBar() {
  const bar = document.getElementById('cmdBulkBar');
  if (!bar) return;
  if (!state.editMode || ui.selected.size === 0) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.display = '';
  bar.innerHTML = `
    <span><strong>${ui.selected.size}</strong> selected</span>
    <span class="spacer"></span>
    <button class="btn" data-bact="clear">Clear</button>
    <button class="btn" data-bact="flag">Toggle flag</button>
    <button class="btn" data-bact="type">Change type</button>
    <button class="btn danger" data-bact="delete">Delete</button>`;
  bar.onclick = e => {
    const b = e.target.closest('[data-bact]'); if (!b) return;
    const a = b.dataset.bact;
    if (a === 'clear') { ui.selected.clear(); renderList(); renderBulkBar(); return; }
    if (a === 'delete') return bulkDelete();
    if (a === 'flag') return bulkFlag();
    if (a === 'type') return bulkType();
  };
}

async function bulkDelete() {
  const ok = await confirmModal(`Delete ${ui.selected.size} selected command${ui.selected.size === 1 ? '' : 's'}?`, { danger: true });
  if (!ok) return;
  const draft = ensureDraft();
  for (const key of ui.selected) removeByKey(draft, key);
  ui.selected.clear();
  renderAll();
}
function bulkFlag() {
  const draft = ensureDraft();
  for (const key of ui.selected) {
    const hit = findByKey(draft, key);
    if (hit) hit.item.flagged = !hit.item.flagged;
  }
  renderList(); renderBulkBar();
}
async function bulkType() {
  const type = await promptModal('New type (show / config / troubleshooting)');
  if (!type) return;
  if (!['show', 'config', 'troubleshooting'].includes(type)) return toast('Invalid type', 'error');
  const draft = ensureDraft();
  for (const key of ui.selected) {
    const hit = findByKey(draft, key);
    if (hit) hit.item.type = type;
  }
  renderList(); renderBulkBar();
}

function findByKey(d, key) {
  const [pk, section, cmd] = key.split('|');
  const list = d.platforms[pk]?.sections[section];
  if (!list) return null;
  const i = list.findIndex(x => x.cmd === cmd);
  if (i < 0) return null;
  return { list, i, item: list[i] };
}
function removeByKey(d, key) {
  const hit = findByKey(d, key); if (!hit) return;
  hit.list.splice(hit.i, 1);
  const [pk, section] = key.split('|');
  if (!hit.list.length) delete d.platforms[pk].sections[section];
}

/* ---------- CSV import ---------- */
function openImportModal() {
  openModal((el, close) => {
    el.innerHTML = `
      <h3>Import CSV</h3>
      <p style="font-size:12px;color:var(--text-3);line-height:1.5">
        Header: <code>platform_key,platform_label,section,command,description,type</code>
      </p>
      <input type="file" id="csvFile" accept=".csv,text/csv" style="margin-top:8px">
      <textarea id="csvText" rows="8" class="search-input" style="width:100%;font-family:monospace;margin-top:8px" placeholder="…or paste CSV here"></textarea>
      <div id="csvPreview" style="margin-top:10px;font-size:12px;max-height:220px;overflow:auto"></div>
      <div class="modal-footer">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="apply" disabled>Preview first</button>
      </div>`;
    const fileInput = el.querySelector('#csvFile');
    const textArea = el.querySelector('#csvText');
    const preview = el.querySelector('#csvPreview');
    const applyBtn = el.querySelector('[data-act=apply]');
    let report = null;

    const doPreview = (text) => {
      const d = workingData();
      report = validateCsv(text, d);
      preview.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:6px">
          <span style="color:var(--success)">+${report.add.length} new</span>
          <span style="color:var(--warn)">${report.dupes.length} dup</span>
          <span style="color:var(--danger)">${report.errors.length} errors</span>
        </div>
        ${report.errors.slice(0, 10).map(e => `<div style="color:var(--danger)">line ${e.line}: ${esc(e.msg)}</div>`).join('')}
        ${report.errors.length > 10 ? `<div style="color:var(--text-3)">…+${report.errors.length - 10} more errors</div>` : ''}`;
      applyBtn.disabled = !report.add.length;
      applyBtn.textContent = report.add.length ? `Apply +${report.add.length}` : 'Nothing to add';
    };
    textArea.addEventListener('input', () => doPreview(textArea.value));
    fileInput.addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      const text = await f.text();
      textArea.value = text; doPreview(text);
    });
    el.querySelector('[data-act=cancel]').addEventListener('click', close);
    applyBtn.addEventListener('click', () => {
      if (!report?.add.length) return;
      state.pending.commands = mergeAdditions(workingData(), report.add);
      emit('pending:changed');
      close(); renderAll();
      toast(`Imported ${report.add.length} commands — review and Save`, 'success');
    });
  }, { wide: true });
}
