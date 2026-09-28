/* ═══════════════════════════════════════════════════════════════
   INTRO — a 3-second "impact of AI" sequence.

   Phase 1 (0.00–0.85s)  scattered particles      → raw, unstructured data
   Phase 2 (0.85–1.90s)  particles snap to a mesh → inference, signal propagates
   Phase 3 (1.90–2.60s)  mesh condenses into "DW" → a decision, in production
   Phase 4 (2.60–3.00s)  wipe out, reveal the site
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DURATION = 3000;
  var root     = document.getElementById('intro');
  var canvas   = document.getElementById('intro-canvas');
  if (!root || !canvas) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen    = false;
  try { seen = sessionStorage.getItem('dw-intro') === '1'; } catch (e) {}

  var ctx      = canvas.getContext('2d');
  var lines    = root.querySelectorAll('.intro-line');
  var bar      = root.querySelector('.intro-progress i');
  var skipBtn  = root.querySelector('.intro-skip');

  var W = 0, H = 0, dpr = 1;
  var particles = [];
  var meshTargets = [];
  var glyphTargets = [];
  var started = 0;
  var rafId = 0;
  var finished = false;

  document.body.classList.add('intro-lock');

  /* ── sizing ─────────────────────────────────────────────── */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── target layouts ─────────────────────────────────────── */

  // A layered "network" — 5 columns, like an inference graph.
  function buildMesh() {
    meshTargets.length = 0;
    var cols   = 5;
    var spanX  = Math.min(W * 0.62, 760);
    var spanY  = Math.min(H * 0.42, 340);
    var x0     = W / 2 - spanX / 2;
    var y0     = H / 2 - spanY / 2;
    var counts = [6, 9, 11, 9, 6];

    for (var c = 0; c < cols; c++) {
      var n = counts[c];
      for (var i = 0; i < n; i++) {
        meshTargets.push({
          x: x0 + (spanX / (cols - 1)) * c,
          y: y0 + (spanY / (n - 1)) * i + (c % 2 ? 6 : -6),
          col: c
        });
      }
    }
  }

  // Sample the monogram "DW" off an offscreen canvas to get point targets.
  function buildGlyph() {
    glyphTargets.length = 0;
    var size = Math.min(W * 0.22, 190);
    var off  = document.createElement('canvas');
    var ow   = Math.floor(Math.min(W, 900));
    var oh   = Math.floor(size * 1.6);
    off.width = ow; off.height = oh;

    var octx = off.getContext('2d');
    octx.fillStyle = '#fff';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.font = '600 ' + size + 'px "Inter", "Segoe UI", system-ui, sans-serif';
    octx.fillText('JP', ow / 2, oh / 2);

    var data = octx.getImageData(0, 0, ow, oh).data;
    var step = 5;
    for (var y = 0; y < oh; y += step) {
      for (var x = 0; x < ow; x += step) {
        if (data[(y * ow + x) * 4 + 3] > 128) {
          glyphTargets.push({
            x: W / 2 - ow / 2 + x,
            y: H / 2 - oh / 2 + y
          });
        }
      }
    }
  }

  function buildParticles() {
    particles.length = 0;
    var n = Math.max(meshTargets.length, Math.min(glyphTargets.length, 420));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = Math.pow(Math.random(), 0.6) * Math.max(W, H) * 0.55;
      particles.push({
        x: W / 2 + Math.cos(a) * r,
        y: H / 2 + Math.sin(a) * r,
        vx: 0, vy: 0,
        seed: Math.random(),
        mesh:  meshTargets[i % meshTargets.length],
        glyph: glyphTargets.length ? glyphTargets[i % glyphTargets.length] : null
      });
    }
  }

  /* ── easing ─────────────────────────────────────────────── */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ── captions ───────────────────────────────────────────── */
  var captionShown = -1;
  function caption(phase) {
    if (captionShown === phase) return;
    captionShown = phase;
    for (var i = 0; i < lines.length; i++) {
      lines[i].classList.toggle('is-on', Number(lines[i].dataset.phase) === phase);
    }
  }

  /* ── frame ──────────────────────────────────────────────── */
  function frame(now) {
    var t = now - started;
    var p = clamp01(t / DURATION);
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';

    ctx.clearRect(0, 0, W, H);

    // Phase weights
    var wMesh  = clamp01((t - 700)  / 900);   // scatter → mesh
    var wGlyph = clamp01((t - 1850) / 700);   // mesh    → monogram
    var fade   = clamp01((t - 2600) / 400);   // dissolve

    if (t < 850)       caption(1);
    else if (t < 1900) caption(2);
    else               caption(3);

    var em = easeInOut(wMesh);
    var eg = easeInOut(wGlyph);

    // ── edges: light up the graph as inference propagates ──
    if (wMesh > 0.05 && wGlyph < 0.95) {
      var edgeAlpha = Math.min(em, 1 - eg) * 0.5;
      var wave = clamp01((t - 1000) / 800);   // signal sweeping left → right
      ctx.lineWidth = 1;
      // Only the first meshTargets.length particles map 1:1 onto mesh nodes;
      // the rest pile onto the same nodes, so restricting the edge pass to
      // that prefix keeps this O(nodes²) instead of O(particles²).
      var nodes = Math.min(meshTargets.length, particles.length);
      for (var i = 0; i < nodes; i++) {
        var a = particles[i];
        if (!a.mesh || a.mesh.col >= 4) continue;
        for (var j = 0; j < nodes; j++) {
          var b = particles[j];
          if (!b.mesh || b.mesh.col !== a.mesh.col + 1) continue;
          var d = Math.abs(a.y - b.y);
          if (d > 90) continue;

          var lit = clamp01((wave * 5 - a.mesh.col) * 1.4);
          var alpha = edgeAlpha * (1 - d / 130) * (0.18 + lit * 0.82);
          if (alpha <= 0.004) continue;

          ctx.strokeStyle = lit > 0.35
            ? 'rgba(94,234,212,' + alpha.toFixed(3) + ')'
            : 'rgba(150,165,190,' + (alpha * 0.5).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // ── particles ──
    for (var k = 0; k < particles.length; k++) {
      var q = particles[k];
      var tx = q.x, ty = q.y;

      if (q.mesh) {
        var jitter = (1 - em) * 26;
        tx = q.mesh.x + Math.sin(t * 0.002 + q.seed * 9) * jitter;
        ty = q.mesh.y + Math.cos(t * 0.0024 + q.seed * 7) * jitter;
      }
      if (q.glyph && eg > 0) {
        tx = tx + (q.glyph.x - tx) * eg;
        ty = ty + (q.glyph.y - ty) * eg;
      }

      // critically-damped-ish spring toward the target
      var stiff = 0.10 + em * 0.16;
      q.vx = (q.vx + (tx - q.x) * stiff) * 0.72;
      q.vy = (q.vy + (ty - q.y) * stiff) * 0.72;
      q.x += q.vx;
      q.y += q.vy;

      var speed = Math.min(Math.hypot(q.vx, q.vy) / 14, 1);
      var r = (1.0 + em * 0.9 + eg * 0.5) * (1 - fade * 0.6);
      var alpha = (0.30 + em * 0.45 + eg * 0.25) * (1 - fade);

      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fillStyle = eg > 0.25
        ? 'rgba(94,234,212,' + alpha.toFixed(3) + ')'
        : 'rgba(' + Math.round(190 + speed * 40) + ',' +
                    Math.round(205 + speed * 30) + ',235,' + alpha.toFixed(3) + ')';
      ctx.fill();
    }

    // ── monogram bloom ──
    if (eg > 0.4) {
      var bloom = (eg - 0.4) / 0.6 * (1 - fade);
      var g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.42);
      g.addColorStop(0, 'rgba(94,234,212,' + (0.11 * bloom).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(94,234,212,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (t >= DURATION) { finish(); return; }
    rafId = requestAnimationFrame(frame);
  }

  /* ── lifecycle ──────────────────────────────────────────── */
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);

    root.classList.add('is-out');
    document.body.classList.remove('intro-lock');
    document.body.classList.add('intro-done');
    try { sessionStorage.setItem('dw-intro', '1'); } catch (e) {}

    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);

    setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
      document.dispatchEvent(new CustomEvent('dw:intro-done'));
    }, 800);

    // Let the rest of the page start immediately, not after the wipe.
    document.dispatchEvent(new CustomEvent('dw:intro-finishing'));
  }

  function onResize() {
    resize(); buildMesh(); buildGlyph();
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
  }

  // Skip entirely for reduced-motion users and repeat visits in this session.
  if (reduced || seen) {
    root.parentNode && root.parentNode.removeChild(root);
    document.body.classList.remove('intro-lock');
    document.body.classList.add('intro-done');
    setTimeout(function () {
      document.dispatchEvent(new CustomEvent('dw:intro-finishing'));
      document.dispatchEvent(new CustomEvent('dw:intro-done'));
    }, 0);
    return;
  }

  resize();
  buildMesh();
  buildGlyph();
  buildParticles();

  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  skipBtn && skipBtn.addEventListener('click', finish);
  root.addEventListener('click', function (e) { if (e.target === root) finish(); });

  started = performance.now();
  rafId = requestAnimationFrame(frame);
})();
