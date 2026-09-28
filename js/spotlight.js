/* ═══════════════════════════════════════════════════════════════
   SPOTLIGHT — the glass ball that rolls over the hero.

   The AI product console behind the hero is invisible except inside a
   100px-radius lens at the cursor. The lens is not a flat window: it is
   rendered as a solid glass sphere.

     · magnification    the content is magnified ~1.9× at the centre and
                        compressed toward the rim, drawn as a stack of
                        concentric discs so the falloff looks refracted
                        rather than uniformly scaled
     · rolling          travelling distance accumulates into a roll angle
                        (θ += d / r, exactly like a ball on a surface) and
                        the refracted content rotates with it
     · weight           the ball squashes along its direction of travel,
                        lags slightly behind the pointer, and drags a
                        contact shadow — so it reads as a physical object
     · light            a fixed specular highlight and rim, which stay put
                        while the interior rotates underneath them. That
                        contrast is what sells "ball" over "spinning image".

   Pointer devices only; disabled under prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var stage = document.getElementById('hero-stage');
  var src   = document.getElementById('product-canvas');
  var lens  = document.getElementById('lens-canvas');
  if (!stage || !src || !lens) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePtr = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !finePtr) { lens.style.display = 'none'; return; }

  var R      = 100;    // reveal radius, in CSS px
  var PAD    = 26;     // room around the ball for glow + shadow
  var MAG    = 1.70;   // magnification at the centre of the ball
  var EDGE_K = 0.55;   // how much the rim compresses relative to the centre
  var RINGS  = 8;      // concentric discs used to fake the refraction curve (was 16)

  var g = lens.getContext('2d');
  var tmp = document.createElement('canvas');
  var tg = tmp.getContext('2d');

  var target = { x: 0, y: 0 };
  var pos    = { x: 0, y: 0 };
  var prev   = { x: 0, y: 0 };
  var vel    = { x: 0, y: 0 };
  var roll   = 0;       // accumulated rotation of the sphere, radians
  var on     = 0;       // current opacity
  var want   = 0;
  var seeded = false;
  var raf    = 0;
  var dpr    = 1;
  var dirty  = false;   // only redraw when something has changed

  function setVar(name, value) { stage.style.setProperty(name, value); }

  /* ── sizing ─────────────────────────────────────────────── */
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var d = (R + PAD) * 2;
    lens.width  = Math.round(d * dpr);
    lens.height = Math.round(d * dpr);
    lens.style.width  = d + 'px';
    lens.style.height = d + 'px';

    // The source patch we need: the least-magnified ring samples 2R/mag_min
    // px, and rotation means we need the diagonal of that square.
    var span = Math.ceil((2 * R / magAt(1)) * 1.45) + 8;
    tmp.width  = Math.round(span * dpr);
    tmp.height = Math.round(span * dpr);
    tmp._span = span;
  }

  /* ── input ──────────────────────────────────────────────── */
  function onMove(e) {
    var r = stage.getBoundingClientRect();
    target.x = e.clientX - r.left;
    target.y = e.clientY - r.top;
    if (!seeded) {
      pos.x = prev.x = target.x;
      pos.y = prev.y = target.y;
      seeded = true;
    }
    want = 1;
    dirty = true;
    stage.classList.add('is-touched');
  }

  function onLeave() { want = 0; dirty = true; }

  /* ── magnification profile ──────────────────────────────── */
  // u ∈ [0,1] is the normalised radius. Nearly flat across the middle of
  // the ball, then falling off hard at the rim — that quartic keeps the
  // console readable where it matters while still compressing the edge
  // the way a real glass sphere does.
  function magAt(u) { return MAG * (1 - EDGE_K * Math.pow(u, 4)); }

  /* ── the ball ───────────────────────────────────────────── */
  function drawBall() {
    var cx = R + PAD, cy = R + PAD;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, (R + PAD) * 2, (R + PAD) * 2);

    if (on < 0.01) return;
    g.globalAlpha = on;

    var speed = Math.hypot(vel.x, vel.y);
    var dirX = speed > 0.01 ? vel.x / speed : 1;
    var dirY = speed > 0.01 ? vel.y / speed : 0;

    /* contact shadow, dragged behind the direction of travel */
    g.save();
    g.globalAlpha = on * 0.5;
    var sgrad = g.createRadialGradient(cx - dirX * 6, cy - dirY * 6 + 8, 2,
                                       cx - dirX * 6, cy - dirY * 6 + 8, R * 1.12);
    sgrad.addColorStop(0, 'rgba(0,0,0,.55)');
    sgrad.addColorStop(0.6, 'rgba(0,0,0,.22)');
    sgrad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sgrad;
    g.beginPath(); g.arc(cx - dirX * 6, cy - dirY * 6 + 8, R * 1.12, 0, Math.PI * 2); g.fill();
    g.restore();

    /* 1 — copy the source patch we are going to refract, once */
    var span = tmp._span;
    tg.setTransform(dpr, 0, 0, dpr, 0, 0);
    tg.clearRect(0, 0, span, span);
    tg.fillStyle = '#06070a';
    tg.fillRect(0, 0, span, span);
    // the source canvas is the full stage; sample the square centred on the lens
    var sw = src.width, shh = src.height;
    var stageW = stage.clientWidth || 1, stageH = stage.clientHeight || 1;
    var sxRatio = sw / stageW, syRatio = shh / stageH;
    tg.drawImage(
      src,
      (pos.x - span / 2) * sxRatio, (pos.y - span / 2) * syRatio,
      span * sxRatio, span * syRatio,
      0, 0, span, span
    );

    /* 2 — stack of concentric discs, outermost first so inner (more
           magnified) rings paint over them. Each disc rotates with the
           roll, which is what makes the interior look like it is
           tumbling rather than sliding. */
    g.save();
    g.translate(cx, cy);
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();

    // glass lifts the contrast of what it magnifies, and the console under
    // here is very dark — without this the ball reads as a smudge
    if ('filter' in g) g.filter = 'brightness(1.75) saturate(1.35) contrast(1.06)';

    // Each band is clipped to its own annulus so a given pixel of the
    // console is sampled exactly once — draw whole discs instead and
    // features near the rim show up twice at two different scales.
    for (var i = 0; i < RINGS; i++) {
      var rOut = R * (1 - i / RINGS);
      var rIn  = i === RINGS - 1 ? 0 : R * (1 - (i + 1) / RINGS);
      var m = magAt((rOut + rIn) / (2 * R));

      g.save();
      g.beginPath();
      g.arc(0, 0, rOut, 0, Math.PI * 2);
      if (rIn > 0) g.arc(0, 0, rIn, 0, Math.PI * 2, true);
      g.clip();
      g.rotate(roll);
      g.scale(m, m);
      g.drawImage(tmp, -span / 2, -span / 2, span, span);
      g.restore();
    }

    if ('filter' in g) g.filter = 'none';

    /* 3 — glass. Everything from here on is fixed to the light, not to
           the ball, so the rotation underneath reads as rotation. */

    // interior shading: bright toward the light, dense at the rim
    var shade = g.createRadialGradient(-R * 0.30, -R * 0.34, R * 0.08, 0, 0, R);
    shade.addColorStop(0, 'rgba(255,255,255,.10)');
    shade.addColorStop(0.46, 'rgba(255,255,255,.01)');
    shade.addColorStop(0.84, 'rgba(0,0,0,.10)');
    shade.addColorStop(1, 'rgba(0,0,0,.44)');
    g.fillStyle = shade;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();

    // teal refraction at the rim
    var rim = g.createRadialGradient(0, 0, R * 0.80, 0, 0, R);
    rim.addColorStop(0, 'rgba(94,234,212,0)');
    rim.addColorStop(1, 'rgba(94,234,212,.30)');
    g.fillStyle = rim;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();

    // specular highlight
    g.save();
    g.globalCompositeOperation = 'lighter';
    var spec = g.createRadialGradient(-R * 0.36, -R * 0.40, 1, -R * 0.36, -R * 0.40, R * 0.42);
    spec.addColorStop(0, 'rgba(255,255,255,.30)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = spec;
    g.beginPath(); g.arc(-R * 0.36, -R * 0.40, R * 0.42, 0, Math.PI * 2); g.fill();

    // small hard catch-light
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.ellipse(-R * 0.40, -R * 0.46, R * 0.10, R * 0.062, -0.5, 0, Math.PI * 2); g.fill();
    g.restore();

    // bounced light along the lower rim
    var bounce = g.createRadialGradient(R * 0.30, R * 0.42, 1, R * 0.30, R * 0.42, R * 0.62);
    bounce.addColorStop(0, 'rgba(94,234,212,.12)');
    bounce.addColorStop(1, 'rgba(94,234,212,0)');
    g.fillStyle = bounce;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();

    g.restore();

    /* 4 — rim stroke sits outside the clip so it stays crisp */
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = 'rgba(94,234,212,.55)';
    g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, 0, R - 0.7, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.14)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(0, 0, R - 3, 0, Math.PI * 2); g.stroke();

    // a seam that spins with the ball — an honest read-out of the roll
    g.save();
    g.rotate(roll);
    g.strokeStyle = 'rgba(94,234,212,.16)';
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, 0, R * 0.94, R * 0.30, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(0, 0, R * 0.30, R * 0.94, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    g.restore();

    g.globalAlpha = 1;
  }

  /* ── loop ───────────────────────────────────────────────── */
  var lastTick = 0;
  function tick(now) {
    // Only animate while there is something to do: pointer moving or
    // the ball still fading / coasting toward its resting position.
    var moving = Math.abs(target.x - pos.x) > 0.2 || Math.abs(target.y - pos.y) > 0.2;
    var fading = Math.abs(want - on) > 0.005;
    var coasting = Math.hypot(vel.x, vel.y) > 0.1;

    if (!dirty && !moving && !fading && !coasting) {
      raf = requestAnimationFrame(tick);
      return;
    }
    dirty = false;

    // Cap to ~30 fps when coasting; full rate only while the pointer is moving.
    var elapsed = now - lastTick;
    if (!moving && elapsed < 30) {
      raf = requestAnimationFrame(tick);
      return;
    }
    lastTick = now;

    prev.x = pos.x; prev.y = pos.y;

    // Trailing easing: the ball has mass, so it arrives a beat late.
    pos.x += (target.x - pos.x) * 0.16;
    pos.y += (target.y - pos.y) * 0.16;
    on    += (want - on) * 0.12;

    vel.x = pos.x - prev.x;
    vel.y = pos.y - prev.y;
    var speed = Math.hypot(vel.x, vel.y);

    // θ = d / r — a ball rolling without slipping. Horizontal travel
    // dominates; vertical travel contributes a little so diagonal drags
    // still spin it.
    roll += (vel.x + vel.y * 0.35) / R;

    // When it stops, let it settle to the nearest whole turn instead of
    // freezing at an arbitrary angle.
    if (speed < 0.25) {
      var turns = Math.PI * 2;
      var nearest = Math.round(roll / turns) * turns;
      roll += (nearest - roll) * 0.05;
    }

    // squash along the direction of travel
    var sq = Math.min(speed * 0.006, 0.10);
    var ang = speed > 0.01 ? Math.atan2(vel.y, vel.x) : 0;

    lens.style.transform =
      'translate3d(' + (pos.x - (R + PAD)).toFixed(1) + 'px,' +
                       (pos.y - (R + PAD)).toFixed(1) + 'px,0)' +
      ' rotate(' + ang.toFixed(3) + 'rad)' +
      ' scale(' + (1 + sq).toFixed(3) + ',' + (1 - sq).toFixed(3) + ')' +
      ' rotate(' + (-ang).toFixed(3) + 'rad)';

    setVar('--lens-x', pos.x.toFixed(1) + 'px');
    setVar('--lens-y', pos.y.toFixed(1) + 'px');
    setVar('--lens-on', on.toFixed(3));
    setVar('--lens-roll', roll.toFixed(3) + 'rad');

    drawBall();

    raf = requestAnimationFrame(tick);
  }

  stage.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerenter', onMove, { passive: true });
  stage.addEventListener('pointerleave', onLeave, { passive: true });

  // Track the pointer just outside the stage too, so the ball is already
  // in the right place the moment it crosses the border.
  window.addEventListener('pointermove', function (e) {
    if (!seeded) return;
    var r = stage.getBoundingClientRect();
    var inside = e.clientX >= r.left && e.clientX <= r.right &&
                 e.clientY >= r.top  && e.clientY <= r.bottom;
    if (!inside) {
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
    }
  }, { passive: true });

  window.addEventListener('resize', size);

  // Pause when the hero scrolls away.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis && !raf) raf = requestAnimationFrame(tick);
      if (!vis && raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0 }).observe(stage);
  }

  size();
  setVar('--lens-on', '0');
  raf = requestAnimationFrame(tick);
})();
