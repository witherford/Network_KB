// Commands database page — list, search, filter, favourites, recent, copy.
// Edit mode adds: checkbox selection, bulk toolbar, add/edit/delete command,
// add/delete platform + section, CSV import/export.

import { loadData } from '../dataloader.js';
import { esc, hlText, debounce, copyToClipboard, toast, download } from '../utils.js';
import { getPrefs, setPref, toggleFavourite, isFavourite, pushRecent, toggleCollapsed, isCollapsed, cmdKey } from '../prefs.js';
import { state, emit, on } from '../state.js';
import { openModal, confirmModal, promptModal } from '../components/modal.js';
import { parseCsv, validateCsv, exportCsv, mergeAdditions } from '../components/csv.js';
import { fetchForKind } from '../components/ai-fetch.js';

const TYPE_LABELS = { all: 'All', show: 'Show', config: 'Configuration', troubleshooting: 'Troubleshooting' };

let ui = { platform: 'all', type: 'all', query: '', selected: new Set() };
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

  root.innerHTML = shellHtml();
  renderAll();
  wireToolbar(root);
  document.getElementById('cmdListRoot').addEventListener('click', onListClick);
  document.getElementById('cmdListRoot').addEventListener('change', onListChange);

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
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2)">
        <input type="checkbox" id="cmdDescTog" ${p.descVisible ? 'checked' : ''}> Descriptions
      </label>
      <span class="spacer"></span>
      <span id="cmdMatch" style="font-size:11px;color:var(--text-3);margin-right:10px"></span>
      <button class="btn" id="cmdExport" title="Export CSV">Export</button>
      <span id="cmdEditActions" style="display:${state.editMode ? 'inline-flex' : 'none'};gap:6px">
        <button class="btn" id="cmdFetch" title="Fetch commands from AI for watchlist vendors">Fetch now</button>
        <button class="btn" id="cmdImport" title="Import CSV">Import</button>
        <button class="btn primary" id="cmdAddPlat" title="Add platform">+ Platform</button>
        <button class="btn primary" id="cmdAddCmd" title="Add command">+ Command</button>
      </span>
    </div>
    <div id="cmdBulkBar" class="bulk-toolbar" style="display:none"></div>
    <div class="filter-tabs" id="cmdPlatTabs"></div>
    <div class="filter-tabs type-row" id="cmdTypeTabs"></div>
    <div class="page ${p.descVisible ? 'with-desc' : ''}" id="cmdListRoot"></div>`;
}

function renderAll() {
  const editActions = document.getElementById('cmdEditActions');
  if (editActions) editActions.style.display = state.editMode ? 'inline-flex' : 'none';
  renderStatsBar();
  renderPlatformTabs();
  renderTypeTabs();
  renderList();
  renderBulkBar();
}

function renderStatsBar() {
  const bar = document.getElementById('cmdStats');
  const d = workingData();
  const platforms = d?.platforms || {};
  const pKeys = Object.keys(platforms);
  let total = 0;
  for (const k of pKeys) for (const sec of Object.values(platforms[k].sections || {})) total += sec.length;
  bar.innerHTML =
    `<span><strong>${total}</strong> commands</span>` +
    `<span><strong>${pKeys.length}</strong> platforms</span>` +
    `<span><strong>${getPrefs().favourites.length}</strong> favourites</span>` +
    `<span><strong>${getPrefs().recent.length}</strong> recent</span>`;
}

function renderPlatformTabs() {
  const root = document.getElementById('cmdPlatTabs');
  const d = workingData();
  const platforms = d?.platforms || {};
  const pKeys = Object.keys(platforms);
  const counts = { all: 0, favourites: getPrefs().favourites.length, recent: getPrefs().recent.length };
  for (const k of pKeys) {
    counts[k] = Object.values(platforms[k].sections || {}).reduce((a, s) => a + s.length, 0);
    counts.all += counts[k];
  }
  const tabs = [
    { key: 'all', label: 'All' },
    ...pKeys.map(k => ({ key: k, label: platforms[k].short || platforms[k].label || k })),
    { key: 'favourites', label: '★ Favourites' },
    { key: 'recent', label: 'Recent' }
  ];
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
  const desc = root.querySelector('#cmdDescTog');
  const onSearch = debounce(() => { ui.query = search.value.trim(); renderList(); }, 120);
  search.addEventListener('input', onSearch);
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { search.value = ''; ui.query = ''; renderList(); }
  });
  desc.addEventListener('change', () => {
    setPref('descVisible', desc.checked);
    document.getElementById('cmdListRoot').classList.toggle('with-desc', desc.checked);
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
  root.querySelector('#cmdFetch').addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = 'Fetching…';
    try { await fetchForKind('commands', { promptKey: 'commands' }); }
    catch (err) { toast(err.message, 'error'); }
    finally { e.target.disabled = false; e.target.textContent = 'Fetch now'; renderAll(); }
  });
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
  const out = [];
  for (const row of iterAll()) {
    if (ui.type !== 'all' && (row.cmd.type || 'show') !== ui.type) continue;
    if (ui.platform === 'favourites') { if (!favSet.has(cmdKey(row.pk, row.section, row.cmd.cmd))) continue; }
    else if (ui.platform === 'recent') { if (!recArr.includes(cmdKey(row.pk, row.section, row.cmd.cmd))) continue; }
    else if (ui.platform !== 'all' && row.pk !== ui.platform) continue;
    if (q) {
      const hay = (row.cmd.cmd + ' ' + (row.cmd.desc || '')).toLowerCase();
      if (!hay.includes(q)) continue;
    }
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
      html += `<article class="section-card" data-sec="${esc(collapseKey)}" data-pk="${esc(pk)}" data-sname="${esc(secName)}">
        <header class="section-title">
          <span>${esc(secName)}</span>
          <span class="sec-actions">
            <span class="sec-cnt">${items.length}</span>
            <button class="btn sm ghost" data-act="copy-all" title="Copy all">Copy all</button>
            ${state.editMode ? `<button class="btn sm ghost" data-act="ren-sec" title="Rename section">✎</button>
               <button class="btn sm ghost" data-act="del-sec" title="Delete section">🗑</button>` : ''}
            <button class="btn sm ghost" data-act="toggle" title="Collapse">${collapsed ? '▸' : '▾'}</button>
          </span>
        </header>
        <div class="cmd-list" ${collapsed ? 'hidden' : ''}>
          ${items.map(r => cmdItemHtml(r, q)).join('')}
        </div>
      </article>`;
    }
    html += `</div></section>`;
  }
  el.innerHTML = html;
}

function cmdItemHtml(row, query) {
  const key = cmdKey(row.pk, row.section, row.cmd.cmd);
  const fav = isFavourite(key);
  const t = row.cmd.type || 'show';
  const sel = ui.selected.has(key);
  return `<div class="cmd-item${fav ? ' favourite' : ''}${row.cmd.flagged ? ' flagged' : ''}${sel ? ' selected' : ''}" data-key="${esc(key)}" data-cmd="${esc(row.cmd.cmd)}" data-pk="${esc(row.pk)}" data-section="${esc(row.section)}" data-idx="${row.idx}">
    <div class="cmd-row">
      ${state.editMode ? `<input type="checkbox" class="cmd-sel" ${sel ? 'checked' : ''} title="Select">` : ''}
      <div class="cmd-body">
        <div class="cmd-code">${hlText(row.cmd.cmd, query)}<span class="type-badge tb-${t}">${t.toUpperCase()}</span></div>
        <div class="cmd-desc">${hlText(row.cmd.desc || '', query)}</div>
      </div>
      <div class="cmd-actions">
        ${state.editMode ? '<button class="btn sm ghost" data-act="edit" title="Edit">✎</button>' : ''}
        <button class="btn sm ghost" data-act="fav" title="${fav ? 'Unfavourite' : 'Favourite'}">${fav ? '★' : '☆'}</button>
        <button class="cpy-btn" data-act="copy" title="Copy command">Copy</button>
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
  if (act === 'copy-all' && card) {
    const cmds = [...card.querySelectorAll('.cmd-item')].map(el => el.dataset.cmd);
    copyToClipboard(cmds.join('\n')).then(ok => toast(ok ? `Copied ${cmds.length} commands` : 'Copy failed', ok ? 'success' : 'error'));
    return;
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
  }
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
