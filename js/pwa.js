// PWA glue:
//   - Registers the service worker with proper update handling.
//   - Shows the in-header "⤓ Install" button when the browser exposes
//     beforeinstallprompt (Chrome/Edge/Brave on desktop + Android).
//   - Shows an "update available" banner when a new SW is waiting.
//   - On iOS Safari (where there's no install prompt event), shows a
//     one-time hint with the manual "Add to Home Screen" instruction.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(reg => {
        // If there's already an updated SW waiting (page reopened mid-update).
        if (reg.waiting) showUpdateBanner(reg);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(reg);
            }
          });
        });
      })
      .catch(err => console.warn('[pwa] SW registration failed:', err));

    // Reload once the new SW takes over (after the user clicks Reload).
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

// Capture the install prompt + show the install button.
let deferredPrompt = null;
const installBtn = document.getElementById('pwaInstallBtn');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      installBtn.hidden = true;
    }
  });
}

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installBtn) installBtn.hidden = true;
  try {
    localStorage.setItem('nkb.pwa.installed', '1');
  } catch {}
});

// If launched in standalone mode (already installed) — don't show install hints.
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                  || window.matchMedia('(display-mode: window-controls-overlay)').matches
                  || window.navigator.standalone === true;
if (isStandalone) {
  document.documentElement.classList.add('pwa-standalone');
}

// One-time iOS install hint (Safari has no beforeinstallprompt).
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
if (isIOS && isSafari && !isStandalone) {
  try {
    if (!localStorage.getItem('nkb.pwa.iosHinted')) {
      setTimeout(() => {
        showIosHint();
        localStorage.setItem('nkb.pwa.iosHinted', '1');
      }, 4000);
    }
  } catch {}
}

function showUpdateBanner(reg) {
  const banner = document.getElementById('pwaUpdateBanner');
  const reloadBtn = document.getElementById('pwaUpdateReload');
  const dismissBtn = document.getElementById('pwaUpdateDismiss');
  if (!banner) return;
  banner.hidden = false;
  reloadBtn?.addEventListener('click', () => {
    if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    // controllerchange handler reloads the page.
  }, { once: true });
  dismissBtn?.addEventListener('click', () => { banner.hidden = true; }, { once: true });
}

function showIosHint() {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast info pwa-ios-hint';
  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:4px">Install this app</div>
    <div style="font-size:12px;line-height:1.4">
      Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.
    </div>
    <button class="btn sm ghost" style="margin-top:6px">Got it</button>`;
  el.querySelector('button').addEventListener('click', () => el.remove());
  root.appendChild(el);
  setTimeout(() => el.remove(), 12000);
}
