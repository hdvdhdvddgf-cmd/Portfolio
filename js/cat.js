/* ═══════════════════════════════════════════════════════════════
   CAT — a small companion that stalks the cursor and pounces on it.

   State machine:
     sit     → cursor idle for a while; the cat sits, tail flicking, blinking
     chase   → trots toward the cursor, legs cycling, body leaning
     crouch  → close enough: flattens, wiggles its hindquarters, tail lashing
     pounce  → launches in an arc at the cursor
     recover → lands, squashes, shakes it off, then goes back to chasing

   Pointer devices only. Disabled under prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var canvas = document.getElementById('cat-layer');
  if (!canvas) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePtr = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !finePtr) { canvas.style.display = 'none'; return; }

  var g = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1;

  /* ── cursor tracking ────────────────────────────────────── */
  var mouse    = { x: -999, y: -999 };
  var mouseOld = { x: -999, y: -999 };
  var mouseSpeed = 0;
  var lastMoveAt = 0;
  var haveMouse = false;

  /* ── cat state ──────────────────────────────────────────── */
  var cat = {
    x: -80, y: -80,
    vx: 0, vy: 0,
    face: 1,          // 1 → right, -1 → left
    hop: 0,           // vertical arc offset (px above the ground line)
    vhop: 0,
    crouch: 0,        // 0 → standing, 1 → flat
    stretch: 1,       // >1 stretched along travel, <1 squashed
    legPhase: 0,
    tailPhase: 0,
    blink: 0,
    nextBlink: 1200,
    state: 'chase',
    stateT: 0,
    cooldown: 0,
    wiggle: 0,
    ear: 0
  };

  var sparks = [];
  var raf = 0, last = 0, running = false;

  var SIZE = 0.78;               // global scale — small, still visibly round
  var POUNCE_RANGE = 150;        // start crouching inside this radius
  var TOO_CLOSE = 26;
  var CROUCH_MS = 380;           // wind-up before launching

  /* ── sizing ─────────────────────────────────────────────── */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── input ──────────────────────────────────────────────── */
  /* ── the cat belongs to the first screen only ───────────── */
  var hero = document.getElementById('hero');
  var inHero = true;         // is the hero still on screen?
  var awake = false;         // has the intro handed over?

  // The hero's box in viewport coordinates, which is where the cat may roam.
  function bounds() {
    if (!hero) return { top: 0, bottom: H };
    var r = hero.getBoundingClientRect();
    return { top: Math.max(0, r.top), bottom: Math.min(H, r.bottom) };
  }

  // How much of the hero is still on screen. The draw loop gates on this
  // every frame, so the cat's confinement to the first screen never depends
  // on an observer callback arriving in time.
  function onFirstScreen() {
    var b = bounds();
    return b.bottom - b.top > 40;
  }

  function sync() {
    if (awake && inHero) start(); else stop();
    setShown(haveMouse && inHero && onFirstScreen());
  }

  var shown = false;
  function setShown(next) {
    if (next === shown) return;
    shown = next;
    document.body.classList.toggle('cat-on', next);
  }

  window.addEventListener('pointermove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    lastMoveAt = performance.now();
    if (!haveMouse) {
      haveMouse = true;
      // Enter from the nearest edge, like it just wandered in.
      var b = bounds();
      cat.x = mouse.x < W / 2 ? -40 : W + 40;
      cat.y = clamp(mouse.y + 70, b.top + 20, b.bottom - 12);
      mouseOld.x = mouse.x; mouseOld.y = mouse.y;
      sync();
    }
  }, { passive: true });

  document.addEventListener('pointerleave', function () { lastMoveAt = 0; });

  /* ── helpers ────────────────────────────────────────────── */
  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function burst(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 0.8 + Math.random() * 2.6;
      sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.6,
        life: 1,
        r: 1 + Math.random() * 1.8,
        color: color || 'rgba(255,196,92,'
      });
    }
  }

  /* ── behaviour ──────────────────────────────────────────── */
  function update(dt) {
    var now = performance.now();
    var dts = dt / 16.6667;             // normalised to ~60fps steps

    // cursor speed
    var mdx = mouse.x - mouseOld.x, mdy = mouse.y - mouseOld.y;
    mouseSpeed = lerp(mouseSpeed, Math.hypot(mdx, mdy), 0.25);
    mouseOld.x = mouse.x; mouseOld.y = mouse.y;

    var idleFor = now - lastMoveAt;
    var dx = mouse.x - cat.x;
    var dy = mouse.y - cat.y;
    var dist = Math.hypot(dx, dy);

    cat.stateT += dt;
    cat.cooldown = Math.max(0, cat.cooldown - dt);

    /* ── state transitions ── */
    if (cat.state === 'chase') {
      // Normally it waits for the cursor to slow down before winding up, but a
      // cat that has been chasing for a while goes for it regardless — otherwise
      // a user who never pauses would never see a pounce.
      var patient = cat.stateT > 2400;
      if (idleFor > 2200 && dist < 220) setState('sit');
      else if (dist < POUNCE_RANGE && dist > TOO_CLOSE && cat.cooldown === 0 &&
               (mouseSpeed < 26 || patient)) setState('crouch');

    } else if (cat.state === 'sit') {
      if (idleFor < 160 || dist > 240) setState('chase');

    } else if (cat.state === 'crouch') {
      if (dist > POUNCE_RANGE * 2.2) { setState('chase'); cat.cooldown = 300; }
      else if (cat.stateT > CROUCH_MS) setState('pounce');

    } else if (cat.state === 'pounce') {
      if (cat.stateT > 560 || (cat.hop <= 0 && cat.stateT > 180)) setState('recover');

    } else if (cat.state === 'recover') {
      if (cat.stateT > 420) { setState('chase'); cat.cooldown = 800; }
    }

    /* ── per-state motion ── */
    var speed, targetCrouch = 0, targetStretch = 1;

    switch (cat.state) {

      case 'sit':
        cat.vx *= Math.pow(0.80, dts);
        cat.vy *= Math.pow(0.80, dts);
        targetCrouch = 0.55;
        cat.tailPhase += dt * 0.0022;
        break;

      case 'chase':
        // Aim just short of the cursor so it stalks rather than sits on it.
        var aimD = Math.max(dist - 26, 0);
        var ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
        speed = clamp(aimD * 0.055, 0, 7.2) + Math.min(mouseSpeed * 0.14, 3);
        cat.vx = lerp(cat.vx, ux * speed, 0.12 * dts);
        cat.vy = lerp(cat.vy, uy * speed * 0.9, 0.12 * dts);
        cat.legPhase += Math.hypot(cat.vx, cat.vy) * 0.11 * dts;
        cat.tailPhase += dt * 0.004;
        targetCrouch = clamp(Math.hypot(cat.vx, cat.vy) / 22, 0, 0.25);
        targetStretch = 1 + Math.min(Math.hypot(cat.vx, cat.vy) * 0.012, 0.14);
        break;

      case 'crouch':
        cat.vx *= Math.pow(0.86, dts);
        cat.vy *= Math.pow(0.86, dts);
        targetCrouch = 0.92;
        // hindquarter wiggle builds as it prepares
        cat.wiggle = Math.sin(cat.stateT * 0.034) * Math.min(cat.stateT / CROUCH_MS, 1);
        cat.tailPhase += dt * 0.010;       // tail lashing
        break;

      case 'pounce':
        if (cat.stateT < 30) {
          var pd = Math.max(dist, 1);
          var power = clamp(dist / 12, 3.5, 13);
          cat.vx = (dx / pd) * power;
          cat.vy = (dy / pd) * power * 0.85;
          cat.vhop = 3.4 + Math.min(dist * 0.03, 3.2);
          cat.face = cat.vx >= 0 ? 1 : -1;
        }
        cat.vx *= Math.pow(0.965, dts);
        cat.vy *= Math.pow(0.965, dts);
        targetCrouch = 0.05;
        targetStretch = 1.30;
        cat.tailPhase += dt * 0.006;
        break;

      case 'recover':
        cat.vx *= Math.pow(0.72, dts);
        cat.vy *= Math.pow(0.72, dts);
        targetCrouch = cat.stateT < 150 ? 0.85 : 0.25;
        targetStretch = cat.stateT < 150 ? 0.80 : 1;
        cat.tailPhase += dt * 0.005;
        break;
    }

    // hop arc (gravity) — tuned so a full pounce is airborne ~400ms, which is
    // shorter than the pounce state itself, so the landing always registers.
    if (cat.hop > 0 || cat.vhop > 0) {
      cat.vhop -= 0.52 * dts;
      cat.hop += cat.vhop * dts;
      if (cat.hop <= 0) {
        cat.hop = 0; cat.vhop = 0;
        if (cat.state === 'pounce' || cat.state === 'recover') impact();
      }
    }

    cat.x += cat.vx * dts;
    cat.y += cat.vy * dts;

    // Keep the cat inside the hero — it is a first-screen character, so it
    // stops at the fold rather than following the cursor down the page.
    var b = bounds();
    cat.x = clamp(cat.x, 14, W - 14);
    cat.y = clamp(cat.y, b.top + 20, Math.max(b.top + 20, b.bottom - 12));

    if (Math.abs(cat.vx) > 0.35) cat.face = cat.vx > 0 ? 1 : -1;

    cat.crouch  = lerp(cat.crouch, targetCrouch, 0.16 * dts);
    cat.stretch = lerp(cat.stretch, targetStretch, 0.20 * dts);
    if (cat.state !== 'crouch') cat.wiggle = lerp(cat.wiggle, 0, 0.2 * dts);

    // ears twitch toward the target when stalking
    cat.ear = lerp(cat.ear, cat.state === 'crouch' ? 1 : 0, 0.12 * dts);

    // blinking
    cat.nextBlink -= dt;
    if (cat.nextBlink <= 0) { cat.blink = 1; cat.nextBlink = 1800 + Math.random() * 3400; }
    if (cat.blink > 0) cat.blink = Math.max(0, cat.blink - dt / 110);

    // sparks
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.x += s.vx * dts; s.y += s.vy * dts;
      s.vy += 0.11 * dts;
      s.vx *= 0.97;
      s.life -= 0.028 * dts;
      if (s.life <= 0) sparks.splice(i, 1);
    }
  }

  function setState(next) {
    cat.state = next;
    cat.stateT = 0;
  }

  function impact() {
    var hit = Math.hypot(mouse.x - cat.x, mouse.y - cat.y) < 52;
    burst(cat.x, cat.y, hit ? 14 : 7, hit ? 'rgba(255,196,92,' : 'rgba(255,232,190,');
  }

  /* ── drawing ────────────────────────────────────────────── */

  /* A bright ginger tabby, drawn round. The palette is deliberately hot
     against the near-black page so the cat reads instantly at 20px tall. */
  var FUR      = '#F97D26';   // saturated ginger, the shaded side
  var FUR_LT   = '#FFB03A';   // sunlit ginger
  var FUR_HI   = '#FFD36B';   // top-of-the-back highlight
  var FUR_EDGE = 'rgba(255,214,140,.75)';
  var STRIPE   = 'rgba(214,102,20,.55)';
  var BELLY    = '#FFF4DC';
  var EYE      = '#37F5C4';
  var NOSE     = '#FF8BA7';

  function drawCat() {
    var s = SIZE;
    var cr = cat.crouch;

    g.save();
    g.translate(cat.x, cat.y - cat.hop);

    // ground shadow (stays on the ground line, shrinks as the cat rises)
    g.save();
    g.translate(0, cat.hop);
    var sh = clamp(1 - cat.hop / 70, 0.25, 1);
    g.globalAlpha = 0.40 * sh;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(0, 2, 19 * s * sh, 4.4 * s * sh, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // warm halo — this is what makes it read as "bright" on a dark page
    var glow = g.createRadialGradient(0, -13 * s, 2, 0, -13 * s, 34 * s);
    glow.addColorStop(0, 'rgba(255,176,58,.20)');
    glow.addColorStop(1, 'rgba(255,176,58,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(0, -13 * s, 34 * s, 0, Math.PI * 2); g.fill();

    g.scale(cat.face * s, s);

    // lean into the direction of travel (we are already in flipped space,
    // so a single negative rotation reads correctly both ways)
    var lean = clamp(Math.hypot(cat.vx, cat.vy) * 0.016, 0, 0.2) * (cat.state === 'pounce' ? 1.6 : 1);
    g.rotate(-lean);

    // squash & stretch
    g.scale(cat.stretch, 1 / cat.stretch);

    var bodyY = -13 + cr * 5.5;        // torso centre height
    var legLen = 8 - cr * 5.6;         // short legs under a heavy body

    drawTail(bodyY, cr);
    drawLegs(bodyY, legLen, cr, true);   // far legs
    drawBody(bodyY, cr);
    drawLegs(bodyY, legLen, cr, false);  // near legs
    drawHead(bodyY, cr);

    g.restore();
  }

  function drawTail(bodyY, cr) {
    var lash = cat.state === 'crouch' ? 1 : 0.42;
    var a = Math.sin(cat.tailPhase) * (0.6 + lash * 0.9);
    var b = Math.sin(cat.tailPhase - 0.9) * (0.7 + lash);
    var up = cat.state === 'pounce' ? -7 : 0;

    var tipX = -29 + b * 3.4, tipY = bodyY - 19 + a * 5.5 + up;

    // a fat tail: drawn twice, thick base then tapered
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-14, bodyY + 2);
    g.bezierCurveTo(-24, bodyY - 2 + a * 5 + up, -31, bodyY - 11 + b * 8 + up, tipX, tipY);
    g.strokeStyle = FUR;
    g.lineWidth = 6.4;
    g.stroke();
    g.strokeStyle = FUR_LT;
    g.lineWidth = 4.0;
    g.stroke();

    // ringed tabby tail
    g.strokeStyle = STRIPE;
    g.lineWidth = 4.2;
    for (var r = 0; r < 3; r++) {
      var k = 0.28 + r * 0.22;
      g.beginPath();
      g.arc(-14 + (tipX + 14) * k, bodyY + 2 + (tipY - bodyY - 2) * k, 0.5, 0, Math.PI * 2);
      g.stroke();
    }

    // cream tip
    g.beginPath();
    g.arc(tipX, tipY, 2.4, 0, Math.PI * 2);
    g.fillStyle = BELLY;
    g.globalAlpha = .95; g.fill(); g.globalAlpha = 1;
  }

  function drawLegs(bodyY, legLen, cr, far) {
    var swing = cat.state === 'chase' ? 1 : 0.15;
    var p = cat.legPhase;
    var extend = cat.state === 'pounce' ? 4.5 : 0;

    g.globalAlpha = far ? 0.62 : 1;
    g.strokeStyle = far ? FUR : FUR_LT;
    g.lineWidth = 4.6;                 // stubby, well-padded legs
    g.lineCap = 'round';

    var offs = far ? 0.9 : 0;

    // hind legs
    leg(-8.5, bodyY + 5, legLen, Math.sin(p + offs) * 3.0 * swing - extend * 0.8);
    // front legs
    leg(8.5, bodyY + 4, legLen, Math.sin(p + Math.PI + offs) * 3.0 * swing + extend);

    g.globalAlpha = 1;
  }

  function leg(hx, hy, len, swing) {
    var kneeX = hx + swing * 0.5;
    var kneeY = hy + len * 0.55;
    var footX = hx + swing;
    var footY = hy + len;
    g.beginPath();
    g.moveTo(hx, hy);
    g.quadraticCurveTo(kneeX - 1.2, kneeY, footX, footY);
    g.stroke();
    // paw
    var a = g.globalAlpha;
    g.beginPath();
    g.ellipse(footX, footY, 2.5, 1.9, 0, 0, Math.PI * 2);
    g.fillStyle = BELLY;
    g.globalAlpha = a * 0.95;
    g.fill();
    g.globalAlpha = a;
  }

  function drawBody(bodyY, cr) {
    var wig = cat.wiggle * 1.6;

    g.save();
    g.translate(wig * 0.4, 0);

    // torso — round and heavy, wider at the haunches
    var rx = 16.4, ry = 11.0 - cr * 2.2;
    g.beginPath();
    g.ellipse(-1.5, bodyY, rx, ry, -0.05, 0, Math.PI * 2);
    var grad = g.createLinearGradient(0, bodyY - ry - 2, 0, bodyY + ry + 2);
    grad.addColorStop(0, FUR_HI);
    grad.addColorStop(0.42, FUR_LT);
    grad.addColorStop(1, FUR);
    g.fillStyle = grad;
    g.fill();

    // a sagging belly line under the torso — unmistakably plump
    g.beginPath();
    g.ellipse(-2.5, bodyY + ry * 0.52, rx * 0.78, ry * 0.62, 0.04, 0, Math.PI * 2);
    g.fillStyle = FUR;
    g.globalAlpha = .55; g.fill(); g.globalAlpha = 1;

    g.strokeStyle = FUR_EDGE;
    g.lineWidth = 1.1;
    g.beginPath();
    g.ellipse(-1.5, bodyY, rx, ry, -0.05, 0, Math.PI * 2);
    g.stroke();

    // tabby stripes across the back, clipped to the torso
    g.save();
    g.beginPath();
    g.ellipse(-1.5, bodyY, rx, ry, -0.05, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = STRIPE;
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var sx = -9 + i * 6.2;
      g.beginPath();
      g.moveTo(sx, bodyY - ry);
      g.quadraticCurveTo(sx + 2.4, bodyY - ry * 0.25, sx + 0.6, bodyY + ry * 0.15);
      g.stroke();
    }
    g.restore();

    // cream chest / belly patch
    g.beginPath();
    g.ellipse(6.0, bodyY + 4.2, 8.2, 5.0, -0.08, 0, Math.PI * 2);
    g.fillStyle = BELLY;
    g.globalAlpha = .92; g.fill(); g.globalAlpha = 1;

    g.restore();
  }

  function drawHead(bodyY, cr) {
    // Head reaches forward and low when stalking, up when sitting.
    var hx = 15.0 + cr * 2.2;
    var hy = bodyY - 6.0 + cr * 6.4;

    // there is barely a neck on a cat this round
    g.beginPath();
    g.moveTo(7, bodyY - 2);
    g.lineTo(hx - 3, hy + 3);
    g.strokeStyle = FUR_LT; g.lineWidth = 9; g.lineCap = 'round';
    g.stroke();

    // ears (perk toward the target while stalking)
    var perk = -cat.ear * 1.4;
    drawEar(hx - 5.2, hy - 6.6, -0.44 + perk);
    drawEar(hx + 2.2, hy - 7.4, 0.12 + perk);

    // skull — big and round
    g.beginPath();
    g.ellipse(hx, hy, 8.8, 8.0, 0, 0, Math.PI * 2);
    var grad = g.createRadialGradient(hx - 2.6, hy - 3.6, 1, hx, hy, 10.5);
    grad.addColorStop(0, FUR_HI);
    grad.addColorStop(0.55, FUR_LT);
    grad.addColorStop(1, FUR);
    g.fillStyle = grad; g.fill();
    g.strokeStyle = FUR_EDGE; g.lineWidth = 1.1; g.stroke();

    // forehead tabby M
    g.strokeStyle = STRIPE; g.lineWidth = 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx - 2.4, hy - 6.6); g.lineTo(hx - 1.4, hy - 4.4); g.stroke();
    g.beginPath(); g.moveTo(hx + 0.4, hy - 7.0); g.lineTo(hx + 0.6, hy - 4.6); g.stroke();

    // chubby cheeks
    g.beginPath();
    g.ellipse(hx + 1.0, hy + 3.6, 6.6, 4.4, 0, 0, Math.PI * 2);
    g.fillStyle = FUR_LT; g.globalAlpha = .8; g.fill(); g.globalAlpha = 1;

    // muzzle
    g.beginPath();
    g.ellipse(hx + 5.0, hy + 3.0, 4.4, 3.3, 0, 0, Math.PI * 2);
    g.fillStyle = BELLY; g.globalAlpha = .96; g.fill(); g.globalAlpha = 1;

    // nose
    g.beginPath();
    g.moveTo(hx + 8.6, hy + 1.4);
    g.lineTo(hx + 6.8, hy + 0.4);
    g.lineTo(hx + 6.8, hy + 2.5);
    g.closePath();
    g.fillStyle = NOSE; g.fill();

    // eyes — big, bright, forward
    var open = 1 - cat.blink;
    var narrowed = cat.state === 'crouch' ? 0.55 : 1;   // predator squint
    var eh = 3.3 * open * narrowed;
    if (eh > 0.25) {
      g.fillStyle = EYE;
      g.beginPath(); g.ellipse(hx + 2.6, hy - 0.8, 2.6, eh, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(hx - 3.4, hy - 1.1, 2.1, eh * 0.9, 0, 0, Math.PI * 2); g.fill();
      // slit pupils
      g.fillStyle = 'rgba(6,12,14,.85)';
      g.fillRect(hx + 2.2, hy - 0.8 - eh * 0.8, 0.9, eh * 1.6);
      g.fillRect(hx - 3.7, hy - 1.1 - eh * 0.7, 0.8, eh * 1.4);
      // catch-light
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.arc(hx + 3.5, hy - 2.0, 0.8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(hx - 2.6, hy - 2.2, 0.6, 0, Math.PI * 2); g.fill();
    } else {
      g.strokeStyle = 'rgba(55,245,196,.8)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(hx + 0.6, hy - 0.8); g.lineTo(hx + 4.6, hy - 0.8); g.stroke();
      g.beginPath(); g.moveTo(hx - 5.2, hy - 1.1); g.lineTo(hx - 1.6, hy - 1.1); g.stroke();
    }

    // whiskers
    g.strokeStyle = 'rgba(255,244,220,.55)';
    g.lineWidth = 0.8;
    for (var i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(hx + 6.4, hy + 2.6);
      g.quadraticCurveTo(hx + 12, hy + 2.6 + i * 2.4, hx + 17, hy + 1.0 + i * 4.0);
      g.stroke();
    }
  }

  function drawEar(x, y, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(-3.8, 2.0);
    g.lineTo(0, -6.4);
    g.lineTo(3.8, 2.0);
    g.closePath();
    g.fillStyle = FUR_LT; g.fill();
    g.strokeStyle = FUR_EDGE; g.lineWidth = 1.0; g.stroke();
    // inner ear
    g.beginPath();
    g.moveTo(-1.8, 1.2);
    g.lineTo(0, -3.4);
    g.lineTo(1.8, 1.2);
    g.closePath();
    g.fillStyle = 'rgba(255,139,167,.7)'; g.fill();
    g.restore();
  }

  function drawSparks() {
    for (var i = 0; i < sparks.length; i++) {
      var s = sparks[i];
      g.beginPath();
      g.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
      g.fillStyle = s.color + (s.life * 0.9).toFixed(2) + ')';
      g.fill();
    }
  }

  // A faint "target lock" ring while the cat is winding up.
  function drawFocus() {
    if (cat.state !== 'crouch') return;
    var k = Math.min(cat.stateT / CROUCH_MS, 1);
    var r = 28 - k * 13;
    g.save();
    g.translate(mouse.x, mouse.y);
    g.rotate(cat.stateT * 0.004);
    g.strokeStyle = 'rgba(255,176,58,' + (0.14 + k * 0.34).toFixed(2) + ')';
    g.lineWidth = 1;
    g.setLineDash([4, 6]);
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.restore();
  }

  /* ── loop ───────────────────────────────────────────────── */
  function loop(now) {
    if (!running) return;
    var dt = Math.min(Math.max(now - last, 0), 48);
    last = now;

    var here = onFirstScreen();
    setShown(haveMouse && here);

    g.clearRect(0, 0, W, H);
    if (haveMouse && here) {
      update(dt);
      drawFocus();
      drawCat();
      drawSparks();
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : sync();
  });
  document.addEventListener('dw:intro-finishing', function () {
    awake = true;
    sync();
  });

  // Scroll past the hero and the cat leaves with it. This only parks the rAF
  // loop — the loop's own per-frame check is what actually hides the cat, so
  // a late or missing observer callback can't strand it on screen.
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inHero = entries[0].isIntersecting;
      if (!inHero) { setShown(false); g.clearRect(0, 0, W, H); }
      sync();
    }, { threshold: 0 }).observe(hero);
  }

  window.DWCat = { start: start, stop: stop, state: function () { return cat.state; } };
})();
