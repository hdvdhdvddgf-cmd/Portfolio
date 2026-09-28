/* ═══════════════════════════════════════════════════════════════
   MAIN — wiring: scroll reveals, stat counters, nav state, card
   hover lighting, and lifecycle for the canvas visuals.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var started = false;

  /* ── year ───────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── nav: condensed once scrolled ───────────────────────── */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── reveal on scroll ───────────────────────────────────── */
  var revealables = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduced) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Stagger siblings for a bit of rhythm.
        var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = Math.min(siblings, 5) * 70 + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── stat counters ──────────────────────────────────────── */
  function countUp(el) {
    var to = parseFloat(el.dataset.count) || 0;
    var suffix = el.dataset.suffix || '';
    if (reduced) { el.textContent = to + suffix; return; }
    var dur = 1100, t0 = performance.now();
    (function step(now) {
      var p = Math.min((now - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  var counters = document.querySelectorAll('.stats b[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(countUp);
  }

  /* ── card hover lighting ────────────────────────────────── */
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  /* ── canvas visuals ─────────────────────────────────────── */
  var hero = null;
  var cardVizzes = [];

  function mountVisuals() {
    if (!window.DWProduct) return;

    var productCanvas = document.getElementById('product-canvas');
    if (productCanvas) {
      hero = new window.DWProduct.HeroProduct(productCanvas);
      hero.mount();
    }

    // Each card carries a screenshot of the console it describes.
    if (window.DWShots) {
      document.querySelectorAll('.card-visual[data-shot]').forEach(function (host) {
        var canvas = document.createElement('canvas');
        host.appendChild(canvas);
        var viz = window.DWShots.create(canvas, host.dataset.shot, 'crop');
        cardVizzes.push({ viz: viz, host: host, on: false });
      });
    }

    // Only animate card visuals that are actually on screen.
    if ('IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var rec = cardVizzes.filter(function (c) { return c.host === e.target; })[0];
          if (!rec) return;
          if (e.isIntersecting && !rec.on) { rec.viz.start(); rec.on = true; }
          else if (!e.isIntersecting && rec.on) { rec.viz.stop(); rec.on = false; }
        });
      }, { threshold: 0.05 });
      cardVizzes.forEach(function (c) { vio.observe(c.host); });
    } else {
      cardVizzes.forEach(function (c) { c.viz.start(); c.on = true; });
    }
  }

  function startVisuals() {
    if (started) return;
    started = true;
    mountVisuals();
    if (hero) hero.start();

    // The hero product only needs to render while the hero is in view.
    var stage = document.getElementById('hero-stage');
    if (hero && stage && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? hero.start() : hero.stop();
      }, { threshold: 0 }).observe(stage);
    }
  }

  document.addEventListener('dw:intro-finishing', startVisuals);
  // Safety net: never leave the page blank if the intro fails for any reason.
  // Re-broadcasting the event (rather than starting visuals directly) means the
  // cat and anything else waiting on it come up too.
  setTimeout(function () {
    if (started) return;
    document.body.classList.add('intro-done');
    document.dispatchEvent(new CustomEvent('dw:intro-finishing'));
  }, 3600);

  document.addEventListener('visibilitychange', function () {
    if (!hero) return;
    document.hidden ? hero.stop() : hero.start();
  });

  /* ── smooth in-page nav (respecting reduced motion) ─────── */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
