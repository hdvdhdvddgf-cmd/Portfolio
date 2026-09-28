/* ═══════════════════════════════════════════════════════════════
   SYSTEMS DECK — the thing "See the systems" opens.

   A full-screen viewer for the production systems: the live product
   screenshot on the left, what it is / what it does / what it moved on
   the right, and a rail to step between them. Keyboard: ← → to move,
   Esc to close. Focus is trapped while it is open.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (!window.DWShots) return;

  var SYSTEMS = window.DWShots.SYSTEMS;
  var root = null, shot = null, canvas = null, idx = 0, open = false;
  var lastFocus = null;
  var els = {};

  /* ── build once, lazily ─────────────────────────────────── */
  function build() {
    if (root) return;

    root = document.createElement('div');
    root.className = 'deck';
    root.id = 'systems-deck';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Production systems showcase');
    root.hidden = true;

    root.innerHTML =
      '<div class="deck-scrim" data-close></div>' +
      '<div class="deck-panel" role="document">' +
        '<header class="deck-head">' +
          '<div class="deck-head-l">' +
            '<span class="deck-eyebrow">Key Systems</span>' +
            '<h2 class="deck-title" id="deck-title"></h2>' +
          '</div>' +
          '<div class="deck-head-r">' +
            '<span class="deck-count" id="deck-count"></span>' +
            '<button class="deck-close" type="button" data-close aria-label="Close (Esc)">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            '</button>' +
          '</div>' +
        '</header>' +

        '<div class="deck-body">' +
          '<figure class="deck-shot">' +
            '<div class="deck-shot-frame"><canvas id="deck-canvas"></canvas></div>' +
            '<figcaption class="deck-cap" id="deck-cap"></figcaption>' +
          '</figure>' +

          '<div class="deck-info">' +
            '<p class="deck-blurb" id="deck-blurb"></p>' +
            '<ul class="deck-points" id="deck-points" role="list"></ul>' +
            '<div class="deck-stats" id="deck-stats"></div>' +
            '<div class="deck-stack" id="deck-stack"></div>' +
          '</div>' +
        '</div>' +

        '<nav class="deck-rail" id="deck-rail" aria-label="Systems list"></nav>' +

        '<button class="deck-arrow deck-prev" type="button" aria-label="Previous system">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
        '<button class="deck-arrow deck-next" type="button" aria-label="Next system">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '</div>';

    document.body.appendChild(root);

    canvas     = root.querySelector('#deck-canvas');
    els.title  = root.querySelector('#deck-title');
    els.count  = root.querySelector('#deck-count');
    els.cap    = root.querySelector('#deck-cap');
    els.blurb  = root.querySelector('#deck-blurb');
    els.points = root.querySelector('#deck-points');
    els.stats  = root.querySelector('#deck-stats');
    els.stack  = root.querySelector('#deck-stack');
    els.rail   = root.querySelector('#deck-rail');

    // rail buttons
    SYSTEMS.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'deck-tab';
      b.style.setProperty('--tab-accent', s.accent);
      b.innerHTML = '<span class="deck-tab-n">' + String(i + 1).padStart(2, '0') + '</span>' +
                    '<span class="deck-tab-t">' + s.app + '</span>' +
                    '<span class="deck-tab-k">' + s.kicker + '</span>';
      b.addEventListener('click', function () { go(i); });
      els.rail.appendChild(b);
    });

    root.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    root.querySelector('.deck-prev').addEventListener('click', function () { go(idx - 1); });
    root.querySelector('.deck-next').addEventListener('click', function () { go(idx + 1); });

    document.addEventListener('keydown', onKey);
  }

  /* ── render one system ──────────────────────────────────── */
  function paint() {
    var s = SYSTEMS[idx];

    root.style.setProperty('--deck-accent', s.accent);
    els.title.textContent = s.title;
    els.count.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(SYSTEMS.length).padStart(2, '0');
    els.cap.innerHTML = '<b>' + s.app + '</b> · ' + s.sub + ' — Production console (live render)';
    els.blurb.textContent = s.blurb;

    els.points.innerHTML = '';
    s.bullets.forEach(function (b) {
      var li = document.createElement('li');
      li.textContent = b;
      els.points.appendChild(li);
    });

    els.stats.innerHTML = '';
    s.stats.forEach(function (st) {
      var d = document.createElement('div');
      d.className = 'deck-stat';
      d.innerHTML = '<b>' + st[0] + '</b><span>' + st[1] + '</span>';
      els.stats.appendChild(d);
    });

    els.stack.innerHTML = '';
    s.stack.forEach(function (tech) {
      var sp = document.createElement('span');
      sp.textContent = tech;
      els.stack.appendChild(sp);
    });

    Array.prototype.forEach.call(els.rail.children, function (b, i) {
      b.classList.toggle('is-on', i === idx);
      b.setAttribute('aria-current', i === idx ? 'true' : 'false');
    });

    if (shot) shot.stop();
    // a fresh canvas each time keeps the renderers independent
    var fresh = document.createElement('canvas');
    fresh.id = 'deck-canvas';
    canvas.parentNode.replaceChild(fresh, canvas);
    canvas = fresh;
    shot = window.DWShots.create(canvas, s.key, 'full');
    if (open) shot.start();
  }

  function go(next) {
    idx = (next + SYSTEMS.length) % SYSTEMS.length;
    paint();
  }

  /* ── open / close ───────────────────────────────────────── */
  function openDeck(key) {
    build();
    var i = 0;
    if (key) {
      SYSTEMS.forEach(function (s, n) { if (s.key === key) i = n; });
    }
    idx = i;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add('deck-open');
    // next frame so the transition runs
    requestAnimationFrame(function () {
      root.classList.add('is-on');
      open = true;
      paint();
      if (shot) { shot.resize(); shot.start(); }
      // The panel is mid-transition on the first frame, so its box is not
      // final yet — re-measure once it has settled.
      setTimeout(function () { if (shot && open) shot.resize(); }, 380);
      var first = root.querySelector('.deck-close');
      if (first) first.focus();
    });
  }

  function close() {
    if (!root || root.hidden) return;
    open = false;
    root.classList.remove('is-on');
    document.body.classList.remove('deck-open');
    if (shot) shot.stop();
    setTimeout(function () { root.hidden = true; }, 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'Tab') {
      // simple focus trap
      var f = root.querySelectorAll('button');
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  }

  /* ── triggers ───────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-deck]') : null;
    if (!trigger) return;
    e.preventDefault();
    openDeck(trigger.getAttribute('data-deck') || null);
  });

  window.DWDeck = { open: openDeck, close: close };
})();
