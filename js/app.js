// Bootstrap: apply prefs, wire header controls, mount initial page, listen for nav.

import { state, emit, on, hasPendingChanges } from './state.js';
import { getPrefs, setPref, apply as applyPrefs } from './prefs.js';
import { openModal } from './components/modal.js';
import { mountBanner } from './components/edit-banner.js';
import { toast } from './utils.js';

const PAGES = {
  commands: () => import('./pages/commands.js'),
  software: () => import('./pages/software.js'),
  guides: () => import('./pages/guides.js'),
  cves: () => import('./pages/cves.js'),
  toolkit: () => import('./pages/toolkit.js'),
  settings: () => import('./pages/settings.js')
};

const DEFAULT_PAGE = 'commands';

function pageFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [p] = raw.split('/');
  return PAGES[p] ? p : DEFAULT_PAGE;
}

async function mountPage(name) {
  if (state.currentPage === name) return;
  if (hasPendingChanges()) {
    const ok = await confirmLeave();
    if (!ok) {
      // revert nav tab highlight
      updateNav(state.currentPage);
      location.hash = '#/' + state.currentPage;
      return;
    }
  }
  state.currentPage = name;
  updateNav(name);
  const root = document.getElementById('pageRoot');
  root.innerHTML = '<div class="page-loading">Loading…</div>';
  try {
    const mod = await PAGES[name]();
    await mod.mount(root);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page-empty">Failed to load page: ${err.message}</div>`;
  }
}

function updateNav(page) {
  for (const tab of document.querySelectorAll('.nav-tab')) {
    const on = tab.dataset.page === page;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
  }
}

function confirmLeave() {
  return new Promise(resolve => {
    openModal((el, close) => {
      el.innerHTML = `
        <h3>Unsaved changes</h3>
        <p style="font-size:13px;color:var(--text-2);line-height:1.5">You have pending edits that haven't been saved to the repo. Leaving this page will discard them.</p>
        <div class="modal-footer">
          <button class="btn" data-act="stay">Stay</button>
          <button class="btn danger" data-act="leave">Discard and leave</button>
        </div>`;
      el.querySelector('[data-act=stay]').addEventListener('click', () => { close(); resolve(false); });
      el.querySelector('[data-act=leave]').addEventListener('click', () => { close(); resolve(true); });
    });
  });
}

function wireNav() {
  document.getElementById('mainNav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-tab');
    if (!btn) return;
    const page = btn.dataset.page;
    location.hash = '#/' + page;
  });
  window.addEventListener('hashchange', () => mountPage(pageFromHash()));
}

function wireThemeBtn() {
  const btn = document.getElementById('themeBtn');
  btn.addEventListener('click', () => {
    const p = getPrefs();
    setPref('theme', p.theme === 'dark' ? 'light' : 'dark');
  });
}

function wirePrefsBtn() {
  document.getElementById('prefsBtn').addEventListener('click', openPrefs);
}

function openPrefs() {
  openModal((el, close) => {
    const p = getPrefs();
    el.innerHTML = `
      <h3>Display preferences</h3>
      <div class="prefs-panel">
        <div class="prefs-row">
          <label>Theme</label>
          <select id="prefTheme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div class="prefs-row">
          <label>Font size</label>
          <input type="number" id="prefFont" min="11" max="20" step="1" style="width:70px">
          <span style="font-size:11px;color:var(--text-3)">px</span>
        </div>
        <div class="prefs-row">
          <label>Accent colour</label>
          <div class="swatch-row" id="prefSwatches">
            ${['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d'].map(c => `<div class="swatch" data-c="${c}" style="background:${c}"></div>`).join('')}
          </div>
        </div>
        <p style="font-size:11px;color:var(--text-3);line-height:1.5">These preferences are stored only in your browser.</p>
      </div>
      <div class="modal-footer">
        <button class="btn primary" data-act="close">Done</button>
      </div>`;
    el.querySelector('#prefTheme').value = p.theme;
    el.querySelector('#prefFont').value = p.fontSize;
    const swatches = el.querySelectorAll('.swatch');
    swatches.forEach(s => {
      if (s.dataset.c === p.accent) s.classList.add('selected');
      s.addEventListener('click', () => {
        swatches.forEach(x => x.classList.remove('selected'));
        s.classList.add('selected');
        setPref('accent', s.dataset.c);
      });
    });
    el.querySelector('#prefTheme').addEventListener('change', e => setPref('theme', e.target.value));
    el.querySelector('#prefFont').addEventListener('change', e => {
      const n = Math.max(11, Math.min(20, parseInt(e.target.value) || 14));
      setPref('fontSize', n);
      e.target.value = n;
    });
    el.querySelector('[data-act=close]').addEventListener('click', close);
  });
}

async function wireEditBtn() {
  const btn = document.getElementById('editModeBtn');
  btn.addEventListener('click', async () => {
    const { toggleEditMode } = await import('./auth/edit-mode.js');
    await toggleEditMode();
  });
  on('editmode:changed', on => {
    btn.classList.toggle('edit-on', on);
    btn.textContent = on ? 'Lock' : 'Edit';
  });
}

function boot() {
  applyPrefs();
  wireNav();
  wireThemeBtn();
  wirePrefsBtn();
  wireEditBtn();
  mountBanner();
  mountPage(pageFromHash());

  window.addEventListener('beforeunload', e => {
    if (hasPendingChanges()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
