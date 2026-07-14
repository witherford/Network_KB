/* ============================================================
   Witherrss — UI enhancements (plain script, no build step)
   1. Injects the two-line "Witherrss" wordmark into the header.
   2. Types a cycling preview into the Commands search placeholder
      ("Search 6,642 commands across 19 platforms" -> "Commands added daily"),
      cancelled the moment the user focuses the field.
   3. Types an example into the Subnet calc (#snCidr) and Regex builder
      (#reDesc) fields; cancelled when the user clicks/focuses in.
   Load with:  <script src="js/witherrss-enhance.js" defer></script>
   ============================================================ */
(function () {
  'use strict';

  var SEARCH_PHRASES = [
    'Search 6,642 commands across 19 platforms',
    'Commands added daily'
  ];
  var seen = new WeakSet();

  /* ---- Two-line wordmark ---- */
  function ensureWordmark() {
    var brand = document.querySelector('.app-header .brand');
    if (!brand) return;
    if (!brand.querySelector('.wordmark')) {
      var w = document.createElement('div');
      w.className = 'wordmark';
      w.textContent = 'Witherrss';
      brand.insertBefore(w, brand.firstChild);
    }
    var h1 = brand.querySelector('h1');
    if (h1 && h1.textContent.trim() !== 'Network knowledge base') {
      h1.textContent = 'Network knowledge base';
    }
  }

  /* ---- Cycling typed placeholder (Commands search) ---- */
  function cyclePlaceholder(el) {
    var pi = 0, ci = 0, deleting = false, cancelled = false, timer = null;
    var rest = 'Search commands\u2026';
    function stop() {
      cancelled = true;
      clearTimeout(timer);
      el.setAttribute('placeholder', rest);
    }
    el.addEventListener('focus', stop, { once: true });
    el.addEventListener('mousedown', stop, { once: true });
    function tick() {
      if (cancelled || !el.isConnected) return;
      var full = SEARCH_PHRASES[pi];
      if (!deleting) {
        ci++;
        el.setAttribute('placeholder', full.slice(0, ci));
        if (ci >= full.length) { timer = setTimeout(function () { deleting = true; tick(); }, 1700); return; }
      } else {
        ci--;
        el.setAttribute('placeholder', full.slice(0, ci));
        if (ci <= 0) { deleting = false; pi = (pi + 1) % SEARCH_PHRASES.length; timer = setTimeout(tick, 360); return; }
      }
      timer = setTimeout(tick, deleting ? 34 : 62);
    }
    timer = setTimeout(tick, 650);
  }

  /* ---- Typed example into a value field, cancel on focus ---- */
  function typeValue(el, text, opts) {
    opts = opts || {};
    var i = 0, cancelled = false, timer = null;
    function stop() { cancelled = true; clearTimeout(timer); }
    el.addEventListener('focus', stop, { once: true });
    el.addEventListener('mousedown', stop, { once: true });
    el.value = '';
    function tick() {
      if (cancelled || !el.isConnected) return;
      i++;
      el.value = text.slice(0, i);
      if (i < text.length) {
        timer = setTimeout(tick, opts.speed || 60);
      } else if (opts.onDone) {
        opts.onDone();
      }
    }
    timer = setTimeout(tick, opts.delay || 800);
  }

  /* ---- Scan the live DOM (pages render dynamically) ---- */
  function scan() {
    try {
      ensureWordmark();

      // Only the Commands page search (#cmdSearch) gets the typed preview.
      // The .search-input class is reused by learning/toolkit/settings/auth
      // fields, so target the id to avoid animating every search box.
      var search = document.getElementById('cmdSearch');
      if (search && !seen.has(search) && !search.value) { seen.add(search); cyclePlaceholder(search); }

      var sn = document.getElementById('snCidr');
      if (sn && !seen.has(sn)) {
        seen.add(sn);
        typeValue(sn, '192.168.20.0/23', {
          delay: 700, speed: 75,
          onDone: function () {
            // Recompute the subnet summary from the typed example.
            sn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          }
        });
      }

      var re = document.getElementById('reDesc');
      if (re && !seen.has(re)) { seen.add(re); typeValue(re, 'an IPv4 address with optional /prefix', { delay: 900, speed: 46 }); }
    } catch (e) { /* never break the app */ }
  }

  /* ---- Default new visitors to dark (toggle still flips to light) ---- */
  function ensureDefaultDark() {
    try {
      var raw = localStorage.getItem('nkb.prefs.v1');
      var p = raw ? JSON.parse(raw) : {};
      if (!p.theme) {
        p.theme = 'dark';
        localStorage.setItem('nkb.prefs.v1', JSON.stringify(p));
        document.body.classList.add('theme-dark');
      }
    } catch (e) { /* ignore */ }
  }

  function boot() {
    ensureDefaultDark();
    scan();
    var root = document.getElementById('pageRoot') || document.body;
    new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
