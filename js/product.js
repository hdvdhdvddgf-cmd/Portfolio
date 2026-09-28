/* ═══════════════════════════════════════════════════════════════
   PRODUCT CANVAS
   Draws the "impressive AI product" that lives behind the hero and is
   only visible through the rolling glass lens — a conceptual inference-
   platform console: model router graph, throughput, latency, evals,
   and a live token stream.

   spotlight.js samples this canvas and refracts it; the work-card and
   showcase screenshots are drawn separately in shots.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = {
    bg:      '#080a0f',
    panel:   '#0d1017',
    panel2:  '#11151d',
    line:    'rgba(255,255,255,.08)',
    line2:   'rgba(255,255,255,.16)',
    dim:     'rgba(255,255,255,.30)',
    mid:     'rgba(255,255,255,.55)',
    bright:  'rgba(255,255,255,.88)',
    acc:     '#5eead4',
    accSoft: 'rgba(94,234,212,.20)',
    violet:  '#a78bfa',
    amber:   '#fbbf24',
    rose:    '#fb7185',
    sky:     '#60a5fa'
  };

  var MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
  var SANS = '"Inter", "Segoe UI", system-ui, sans-serif';

  /* ── primitives ─────────────────────────────────────────── */

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function panel(g, x, y, w, h, fill) {
    rr(g, x, y, w, h, 8);
    g.fillStyle = fill || C.panel;
    g.fill();
    g.strokeStyle = C.line;
    g.lineWidth = 1;
    g.stroke();
  }

  function text(g, str, x, y, size, color, font, align) {
    g.font = (font === MONO ? '' : '500 ') + size + 'px ' + (font || SANS);
    g.fillStyle = color;
    g.textAlign = align || 'left';
    g.textBaseline = 'middle';
    g.fillText(str, x, y);
    g.textAlign = 'left';
  }

  function dot(g, x, y, r, color) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
  }

  /* ── deterministic pseudo-noise (stable across frames) ──── */
  function noise(i, s) {
    var v = Math.sin(i * 12.9898 + (s || 0) * 78.233) * 43758.5453;
    return v - Math.floor(v);
  }

  /* ═══════════════════════════════════════════════════════
     HERO PRODUCT
     ═══════════════════════════════════════════════════════ */

  function HeroProduct(canvas) {
    var g = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var raf = 0, last = 0, t = 0;
    var running = false;

    // Scrolling series
    var series = [], series2 = [];
    for (var i = 0; i < 120; i++) {
      series.push(0.45 + noise(i, 1) * 0.35);
      series2.push(0.22 + noise(i, 2) * 0.20);
    }

    var LOG = [
      ['POST', '/v1/route', 'gpt-class-lg', '318ms', C.acc],
      ['POST', '/v1/route', 'claude-class', '204ms', C.violet],
      ['GET ', '/v1/eval/run', 'suite:rag-42', '1.2s', C.amber],
      ['POST', '/v1/embed', 'batch:512', '96ms', C.sky],
      ['POST', '/v1/route', 'small-fast', '71ms', C.acc],
      ['WARN', 'guardrail', 'injection.blocked', '—', C.rose],
      ['POST', '/v1/retrieve', 'top_k=8', '43ms', C.sky],
      ['POST', '/v1/route', 'gpt-class-lg', '287ms', C.acc]
    ];

    var MODELS = [
      ['frontier-lg',  0.86, C.acc],
      ['frontier-mid', 0.62, C.violet],
      ['fast-small',   0.94, C.sky],
      ['embed-v3',     0.71, C.amber],
      ['rerank-x',     0.48, C.rose]
    ];

    function resize() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(0);
    }

    /* ── layout regions ── */
    function layout() {
      var pad = Math.max(14, W * 0.016);
      var chrome = 34;
      var railW = Math.min(168, W * 0.16);
      var rightW = Math.min(230, W * 0.21);
      var top = chrome + pad;
      var bodyH = H - top - pad;

      var midX = pad + railW + pad;
      var midW = W - midX - rightW - pad * 2;

      return {
        pad: pad, chrome: chrome, railW: railW, rightW: rightW,
        top: top, bodyH: bodyH, midX: midX, midW: midW,
        rightX: W - rightW - pad
      };
    }

    /* ── sections ── */

    function drawChrome(L) {
      g.fillStyle = C.panel2;
      g.fillRect(0, 0, W, L.chrome);
      g.strokeStyle = C.line;
      g.beginPath(); g.moveTo(0, L.chrome + .5); g.lineTo(W, L.chrome + .5); g.stroke();

      dot(g, 18, L.chrome / 2, 4, '#ff5f57');
      dot(g, 33, L.chrome / 2, 4, '#febc2e');
      dot(g, 48, L.chrome / 2, 4, '#28c840');

      text(g, '◆  atlas', 72, L.chrome / 2, 11, C.bright, SANS);
      text(g, 'inference-platform', 128, L.chrome / 2 + 1, 10, C.dim, MONO);

      // env pill
      var pw = 132;
      rr(g, W - pw - 16, L.chrome / 2 - 9, pw, 18, 9);
      g.fillStyle = 'rgba(94,234,212,.08)'; g.fill();
      g.strokeStyle = 'rgba(94,234,212,.28)'; g.stroke();
      dot(g, W - pw - 4, L.chrome / 2, 3, C.acc);
      text(g, 'production · us-east-1', W - pw + 6, L.chrome / 2 + 1, 9, C.acc, MONO);
    }

    function drawRail(L) {
      var x = L.pad, y = L.top, w = L.railW, h = L.bodyH;
      panel(g, x, y, w, h);

      var items = ['Overview', 'Router', 'Retrieval', 'Evaluations', 'Guardrails', 'Traces', 'Cost', 'Settings'];
      var iy = y + 20;
      for (var i = 0; i < items.length; i++) {
        var active = i === 1;
        if (active) {
          rr(g, x + 8, iy - 11, w - 16, 24, 6);
          g.fillStyle = 'rgba(94,234,212,.10)'; g.fill();
          g.fillStyle = C.acc;
          g.fillRect(x + 8, iy - 11, 2, 24);
        }
        dot(g, x + 20, iy, 2.6, active ? C.acc : 'rgba(255,255,255,.28)');
        text(g, items[i], x + 30, iy + 1, 10, active ? C.bright : C.dim, SANS);
        iy += 30;
      }

      // mini status block at the bottom of the rail
      var sy = y + h - 74;
      g.strokeStyle = C.line;
      g.beginPath(); g.moveTo(x + 10, sy - 12); g.lineTo(x + w - 10, sy - 12); g.stroke();
      text(g, 'FLEET HEALTH', x + 14, sy, 8, C.dim, MONO);
      for (var b = 0; b < 18; b++) {
        var hv = 6 + noise(b, 5) * 16;
        var ok = noise(b, 6) > 0.12;
        g.fillStyle = ok ? 'rgba(94,234,212,.55)' : 'rgba(251,113,133,.7)';
        g.fillRect(x + 14 + b * ((w - 28) / 18), sy + 26 - hv, 3, hv);
      }
      text(g, '99.98% · 30d', x + 14, sy + 44, 9, C.mid, MONO);
    }

    function drawHeader(L) {
      var x = L.midX, y = L.top;
      text(g, 'Multi-Model Router', x, y + 10, 17, C.bright, SANS);
      text(g, 'Policy: cost × latency × quality — live traffic', x, y + 30, 10, C.dim, SANS);

      // segmented control
      var segs = ['1h', '24h', '7d', '30d'], sw = 34, sx = x + L.midW - segs.length * sw;
      rr(g, sx - 4, y + 4, segs.length * sw + 8, 22, 6);
      g.fillStyle = C.panel2; g.fill(); g.strokeStyle = C.line; g.stroke();
      for (var i = 0; i < segs.length; i++) {
        if (i === 1) { rr(g, sx + i * sw, y + 7, sw, 16, 4); g.fillStyle = 'rgba(255,255,255,.09)'; g.fill(); }
        text(g, segs[i], sx + i * sw + sw / 2, y + 16, 9, i === 1 ? C.bright : C.dim, MONO, 'center');
      }
    }

    function drawKpis(L) {
      var x = L.midX, y = L.top + 46, w = L.midW, h = 62;
      var kpis = [
        ['REQUESTS / MIN', '128.4k', '+12.4%', C.acc],
        ['p95 LATENCY',    '412ms',  '-18.2%', C.sky],
        ['COST / 1K REQ',  '$0.86',  '-31.0%', C.amber],
        ['EVAL PASS RATE', '97.3%',  '+1.9%',  C.violet]
      ];
      var gap = 10, cw = (w - gap * 3) / 4;
      for (var i = 0; i < 4; i++) {
        var cx = x + i * (cw + gap);
        panel(g, cx, y, cw, h);
        text(g, kpis[i][0], cx + 12, y + 16, 8, C.dim, MONO);
        text(g, kpis[i][1], cx + 12, y + 36, 18, C.bright, SANS);
        text(g, kpis[i][2], cx + 12, y + 52, 9, kpis[i][3], MONO);

        // sparkline (only where the tile is wide enough to hold one)
        if (cw > 100) {
          g.beginPath();
          for (var s = 0; s < 16; s++) {
            var sx2 = cx + cw - 66 + s * 4;
            var sy2 = y + 44 - noise(s, i + 9) * 20;
            s ? g.lineTo(sx2, sy2) : g.moveTo(sx2, sy2);
          }
          g.strokeStyle = kpis[i][3]; g.globalAlpha = .55; g.lineWidth = 1.2; g.stroke(); g.globalAlpha = 1;
        }
      }
      return y + h + 12;
    }

    // The routing graph — requests fan into a policy node, then out to models.
    function drawRouter(L, y, h) {
      var x = L.midX, w = L.midW * 0.56;
      panel(g, x, y, w, h);
      text(g, 'ROUTING GRAPH', x + 12, y + 16, 8, C.dim, MONO);
      text(g, 'live', x + w - 12, y + 16, 8, C.acc, MONO, 'right');

      var cy = y + h / 2 + 8;
      var inX = x + 34, polX = x + w * 0.44, outX = x + w - 40;

      // ingress nodes
      var ins = [cy - 34, cy, cy + 34];
      for (var i = 0; i < ins.length; i++) {
        dot(g, inX, ins[i], 4, 'rgba(255,255,255,.45)');
        g.strokeStyle = C.line2; g.lineWidth = 1;
        g.beginPath(); g.moveTo(inX + 6, ins[i]); g.lineTo(polX - 16, cy); g.stroke();
      }
      text(g, 'ingress', inX, cy + 62, 8, C.dim, MONO, 'center');

      // policy node
      rr(g, polX - 16, cy - 16, 32, 32, 9);
      g.fillStyle = 'rgba(94,234,212,.12)'; g.fill();
      g.strokeStyle = 'rgba(94,234,212,.55)'; g.stroke();
      dot(g, polX, cy, 3.5, C.acc);
      // rotating halo
      g.save();
      g.translate(polX, cy); g.rotate(t * 0.0006);
      g.strokeStyle = 'rgba(94,234,212,.30)';
      g.setLineDash([3, 5]);
      g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.restore();
      text(g, 'policy', polX, cy + 62, 8, C.acc, MONO, 'center');

      // model targets
      var outs = [cy - 44, cy - 15, cy + 15, cy + 44];
      var oc = [C.acc, C.violet, C.sky, C.amber];
      for (var o = 0; o < outs.length; o++) {
        g.strokeStyle = 'rgba(255,255,255,.10)';
        g.beginPath();
        g.moveTo(polX + 18, cy);
        g.bezierCurveTo(polX + 60, cy, outX - 50, outs[o], outX - 12, outs[o]);
        g.stroke();

        rr(g, outX - 8, outs[o] - 7, 16, 14, 4);
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
        g.strokeStyle = oc[o]; g.globalAlpha = .6; g.stroke(); g.globalAlpha = 1;
        dot(g, outX, outs[o], 2, oc[o]);
      }
      text(g, 'models', outX, cy + 62, 8, C.dim, MONO, 'center');

      // animated packets travelling ingress → policy → model
      for (var p = 0; p < 7; p++) {
        var ph = ((t * 0.00035) + p / 7) % 1;
        var lane = p % outs.length;
        var px, py;
        if (ph < 0.45) {
          var k = ph / 0.45;
          var from = ins[p % ins.length];
          px = inX + (polX - 16 - inX) * k;
          py = from + (cy - from) * k;
        } else {
          var k2 = (ph - 0.45) / 0.55;
          px = polX + 18 + (outX - polX - 18) * k2;
          var ease = k2 * k2 * (3 - 2 * k2);
          py = cy + (outs[lane] - cy) * ease;
        }
        var col = ph < 0.45 ? 'rgba(255,255,255,.9)' : oc[lane];
        dot(g, px, py, 2.2, col);
        g.globalAlpha = .25; dot(g, px, py, 5.5, col); g.globalAlpha = 1;
      }
    }

    function drawThroughput(L, y, h) {
      var x = L.midX + L.midW * 0.56 + 10;
      var w = L.midW - L.midW * 0.56 - 10;
      panel(g, x, y, w, h);
      text(g, 'THROUGHPUT / LATENCY', x + 12, y + 16, 8, C.dim, MONO);

      var cx = x + 12, cy = y + 28, cw = w - 24, ch = h - 46;

      // grid
      g.strokeStyle = 'rgba(255,255,255,.05)';
      for (var i = 1; i < 4; i++) {
        g.beginPath(); g.moveTo(cx, cy + (ch / 4) * i); g.lineTo(cx + cw, cy + (ch / 4) * i); g.stroke();
      }

      // Continuous scroll: step through the ring buffer, sub-pixel offset from
      // the fractional part so the line glides instead of stepping.
      var n = series.length;
      var shift = t * 0.010;
      var base = Math.floor(shift);
      var off = shift - base;
      var stepX = cw / (n - 1);
      var val = function (i) { return series[(i + base) % n]; };
      var val2 = function (i) { return series2[(i + base) % n]; };

      // area
      g.beginPath();
      g.moveTo(cx, cy + ch);
      for (var s = 0; s < n; s++) {
        var px = cx + (s - off) * stepX;
        var py = cy + ch - val(s) * ch;
        g.lineTo(px, py);
      }
      g.lineTo(cx + cw, cy + ch);
      g.closePath();
      var grad = g.createLinearGradient(0, cy, 0, cy + ch);
      grad.addColorStop(0, 'rgba(94,234,212,.28)');
      grad.addColorStop(1, 'rgba(94,234,212,0)');
      g.save(); g.clip(); g.fillStyle = grad; g.fillRect(cx, cy, cw, ch);

      // stroke
      g.beginPath();
      for (var s2 = 0; s2 < n; s2++) {
        var qx = cx + (s2 - off) * stepX;
        var qy = cy + ch - val(s2) * ch;
        s2 ? g.lineTo(qx, qy) : g.moveTo(qx, qy);
      }
      g.strokeStyle = C.acc; g.lineWidth = 1.4; g.stroke();

      // secondary (latency)
      g.beginPath();
      for (var s3 = 0; s3 < n; s3++) {
        var rx = cx + (s3 - off) * stepX;
        var ry = cy + ch - val2(s3) * ch;
        s3 ? g.lineTo(rx, ry) : g.moveTo(rx, ry);
      }
      g.strokeStyle = 'rgba(96,165,250,.75)'; g.lineWidth = 1; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]);
      g.restore();

      // legend
      dot(g, cx + 4, y + h - 12, 3, C.acc);
      text(g, 'req/s', cx + 12, y + h - 11, 8, C.dim, MONO);
      dot(g, cx + 52, y + h - 12, 3, C.sky);
      text(g, 'p95', cx + 60, y + h - 11, 8, C.dim, MONO);
    }

    function drawEvalAndLogs(L, y, h) {
      var x = L.midX, w = L.midW;
      panel(g, x, y, w, h);
      text(g, 'LIVE TRACE STREAM', x + 12, y + 16, 8, C.dim, MONO);
      text(g, 'tail -f', x + w - 12, y + 16, 8, C.dim, MONO, 'right');

      var rowH = 17, top = y + 28;
      var rows = Math.max(1, Math.floor((h - 36) / rowH));
      var scroll = Math.floor(t * 0.0016);

      for (var i = 0; i < rows; i++) {
        var e = LOG[((i + scroll) % LOG.length + LOG.length) % LOG.length];
        var ry = top + i * rowH + rowH / 2;
        if (i % 2 === 0) { g.fillStyle = 'rgba(255,255,255,.018)'; g.fillRect(x + 6, top + i * rowH, w - 12, rowH); }
        text(g, e[0], x + 14, ry, 9, e[0] === 'WARN' ? C.rose : C.dim, MONO);
        text(g, e[1], x + 52, ry, 9, C.mid, MONO);
        text(g, e[2], x + 148, ry, 9, e[4], MONO);
        text(g, e[3], x + w - 16, ry, 9, C.dim, MONO, 'right');
      }

      // fade the last row out, like a scrolling console
      var fade = g.createLinearGradient(0, y + h - 22, 0, y + h);
      fade.addColorStop(0, 'rgba(13,16,23,0)');
      fade.addColorStop(1, C.panel);
      g.fillStyle = fade;
      g.fillRect(x + 1, y + h - 22, w - 2, 21);
    }

    function drawRight(L) {
      var x = L.rightX, y = L.top, w = L.rightW, h = L.bodyH;
      panel(g, x, y, w, h);

      text(g, 'MODEL FLEET', x + 12, y + 16, 8, C.dim, MONO);
      var my = y + 36;
      for (var i = 0; i < MODELS.length; i++) {
        var m = MODELS[i];
        var share = m[1] * (0.9 + Math.sin(t * 0.0009 + i) * 0.1);
        text(g, m[0], x + 12, my, 10, C.mid, MONO);
        text(g, Math.round(share * 100) + '%', x + w - 12, my, 9, C.dim, MONO, 'right');
        rr(g, x + 12, my + 9, w - 24, 4, 2); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
        rr(g, x + 12, my + 9, (w - 24) * share, 4, 2); g.fillStyle = m[2]; g.globalAlpha = .8; g.fill(); g.globalAlpha = 1;
        my += 30;
      }

      // eval radar-ish score block
      var by = my + 12;
      g.strokeStyle = C.line;
      g.beginPath(); g.moveTo(x + 12, by - 10); g.lineTo(x + w - 12, by - 10); g.stroke();
      text(g, 'EVAL SUITE', x + 12, by + 6, 8, C.dim, MONO);

      var scores = [['groundedness', .94], ['faithfulness', .91], ['toxicity', .99], ['latency SLO', .87], ['cost SLO', .93]];
      var sy = by + 26;
      for (var s = 0; s < scores.length; s++) {
        text(g, scores[s][0], x + 12, sy, 9, C.dim, MONO);
        var segs = 12, filled = Math.round(scores[s][1] * segs);
        for (var k = 0; k < segs; k++) {
          g.fillStyle = k < filled ? 'rgba(94,234,212,.75)' : 'rgba(255,255,255,.08)';
          g.fillRect(x + w - 12 - (segs - k) * 5, sy - 3, 3, 6);
        }
        sy += 20;
      }

      // guardrail badge
      var gy = y + h - 62;
      rr(g, x + 12, gy, w - 24, 46, 7);
      g.fillStyle = 'rgba(251,113,133,.07)'; g.fill();
      g.strokeStyle = 'rgba(251,113,133,.25)'; g.stroke();
      dot(g, x + 24, gy + 16, 3, C.rose);
      text(g, 'GUARDRAILS', x + 34, gy + 16, 8, C.rose, MONO);
      text(g, '1,284 prompts blocked · 24h', x + 16, gy + 33, 9, C.mid, MONO);
    }

    function draw(dt) {
      t += dt;
      if (!W || !H) return;

      g.fillStyle = C.bg;
      g.fillRect(0, 0, W, H);

      // faint workspace grid so empty areas still read as a real UI
      g.strokeStyle = 'rgba(255,255,255,.022)';
      g.lineWidth = 1;
      g.beginPath();
      for (var gx = 0; gx < W; gx += 40) { g.moveTo(gx + .5, 0); g.lineTo(gx + .5, H); }
      for (var gy2 = 0; gy2 < H; gy2 += 40) { g.moveTo(0, gy2 + .5); g.lineTo(W, gy2 + .5); }
      g.stroke();

      var L = layout();
      drawChrome(L);
      drawRail(L);
      drawHeader(L);

      var y = drawKpis(L);
      var remaining = L.top + L.bodyH - y;

      // Give the log panel room only if there is genuinely space for it;
      // on short viewports the router/chart row takes the whole remainder.
      var logsH = remaining > 240 ? Math.max(80, remaining * 0.40) : 0;
      var routerH = remaining - (logsH ? logsH + 10 : 0);

      if (routerH > 60) {
        drawRouter(L, y, routerH);
        drawThroughput(L, y, routerH);
      }
      if (logsH >= 80) drawEvalAndLogs(L, y + routerH + 10, logsH);
      drawRight(L);
    }

    function loop(now) {
      if (!running) return;
      // Throttle to ~20 fps — the console is decorative; it does not need
      // to run at the display refresh rate and doing so burns the main thread.
      var dt = Math.min(Math.max(now - last, 0), 64);
      if (dt < 48) {           // ~20 fps gate (1000/20 = 50ms, allow 48)
        raf = requestAnimationFrame(loop);
        return;
      }
      last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    }

    return {
      mount: function () {
        resize();
        window.addEventListener('resize', resize);
        if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
      },
      start: function () {
        if (running) return;
        running = true; last = performance.now();
        raf = requestAnimationFrame(loop);
      },
      stop: function () { running = false; cancelAnimationFrame(raf); }
    };
  }

  window.DWProduct = { HeroProduct: HeroProduct };
})();
