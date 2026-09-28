# Senior AI Engineer · Portfolio

A single-page portfolio built from the resume. No build step, no dependencies,
no external network requests — open `index.html` and it runs.

```
portfolio/
├── index.html
├── css/styles.css
└── js/
    ├── intro.js       3s opening sequence
    ├── product.js     hero "AI product" console canvas
    ├── shots.js       product screenshots of the five systems
    ├── systems.js     the full-screen systems deck
    ├── spotlight.js   100px rolling glass lens
    ├── cat.js         cursor-chasing cat
    └── main.js        scroll reveals, counters, lifecycle
```

## Running it

Double-click `index.html`, or serve it:

```bash
npx serve portfolio      # or: python -m http.server
```

## The pieces

**1 — Three-second intro (`js/intro.js`)**
A canvas particle sequence in four phases: scattered points (unstructured data)
→ they snap into a five-layer network with a signal propagating left-to-right
(inference) → the network condenses into the "DW" monogram (a decision) → wipe.
Exactly 3000ms, then the content appears.

- `Esc` / `Enter` / `Space` / the Skip button ends it early.
- Skipped automatically on repeat visits in the same session (`sessionStorage`)
  and under `prefers-reduced-motion`.
- `main.js` holds a 3.6s safety timer, so the page can never stay blank if the
  intro fails.

**2 — Cursor-chasing cat (`js/cat.js`)**
A small hand-drawn canvas cat — a plump bright-ginger tabby with a cream belly,
ringed tail, forehead stripes and a warm halo so it reads against the near-black
page even at this size — running a five-state machine:
`chase → crouch → pounce → recover → chase`, plus `sit` when the cursor idles.
It trots with a leg cycle, flattens and wiggles its hindquarters while winding
up (a targeting ring tightens on the cursor), launches in a gravity arc with
squash-and-stretch, and throws off sparks on landing. It blinks, its tail
lashes harder when stalking, and its ears perk toward the target.

It pounces roughly every 2.5–3s of active cursor movement. Normally it waits
for you to slow down, but after 2.4s of chasing it commits anyway — otherwise
someone who never pauses would never see a pounce.

It belongs to the first screen only: it is clamped to the hero's box, so it
stops at the fold rather than following the cursor down the page, and it fades
out entirely once the hero scrolls away. The draw loop re-checks the hero's
rect every frame and gates on that, so the confinement never depends on an
`IntersectionObserver` callback arriving in time — the observer only parks the
loop to save frames.

Pointer devices only; disabled entirely under `prefers-reduced-motion`.

**3 — Rolling glass lens (`js/spotlight.js` + `js/product.js`)**
`product.js` renders an animated AI inference-platform console — model routing
graph with packets flowing through a policy node, throughput/latency charts,
KPI tiles, a live trace stream, model fleet shares, eval scores, guardrail
counters. It is hidden except within **180px of the cursor**, where everything
layered over it goes transparent and the console comes through: at 1:1 in the
ring, magnified inside the ball.

Both masks are radial gradients keyed to `--reveal-r`, which is
`calc(180px * var(--lens-on))` so the hole closes as the pointer leaves instead
of being stranded at the last cursor position. `--reveal-r` is declared on
`.hero-stage`, not `:root` — a custom property substitutes its `var()`s on the
element that declares it, and `--lens-on` is written to the stage by JS. The
title sits inside `.hero-veil`, an untransformed stage-sized box, because a mask
on `.hero-title` itself would be offset by the title's own `translateY`.

Inside that window, the **100px ball** is not a flat lens. `spotlight.js` samples the
console canvas and repaints it magnified into `#lens-canvas`:

- **Refraction** — the patch is drawn as 16 concentric annuli, magnification
  falling off as a quartic from 1.7x at the centre to compression at the rim.
  Annuli rather than whole discs, so no feature is sampled twice.
- **Rolling** — travelled distance accumulates into a roll angle (`θ += d / r`,
  a ball rolling without slipping) and the refracted interior rotates with it,
  settling to the nearest whole turn when the cursor stops. The dashed outer
  halo counter-rotates, so the two rotations make the roll unmistakable.
- **Weight** — the ball lags the pointer, squashes along its direction of
  travel, and drags a contact shadow.
- **Light** — the specular highlight, rim and chromatic fringe stay fixed to the
  light source while the interior turns underneath. That contrast is what sells
  "ball" rather than "spinning image".

"AI Engineer" sits above it all with a slow specular sheen sweeping across the
letterforms and a faint offset teal ghost.

**4 — The systems deck (`js/shots.js` + `js/systems.js`)**
Every card in *Selected systems* carries a picture of the console it describes,
drawn on canvas at a fixed 1240x780 logical resolution: Atlas (router), Corpus
(retrieval), Assay (eval harness), Sentinel (guardrails), Throttle (performance).

The same renderer serves two sizes, so the card preview and the full-screen view
can never drift apart: `mode: 'crop'` for the cards (scaled to a legible detail,
edges faded), `mode: 'full'` for the deck (whole window, canvas sized to the
screenshot's own aspect ratio).

"See the systems" and each card's **View console** button open the deck:
screenshot left, what it is / what it does / what it moved right, a rail across
the bottom. Arrow keys move between systems, `Esc` closes, focus is trapped
while it is open.

**5 — Background**
Deep-ink (`#08090c`) canvas with a 72px dot-grid masked to a soft falloff, a
slow-drifting aurora wash in teal/violet/blue, a vignette, and a fine SVG noise
overlay. One accent colour throughout.

## Content

Everything factual — roles, dates, locations, bullets, skills, education — is
taken directly from the resume. The five "Selected systems" cards are the
resume's achievement bullets reorganised into capability write-ups; no client
names, project names, or metrics were invented. The only figures used are the
ones the resume states (8 years, 1M+ users, the named stacks and vector stores).

The consoles rendered in the hero, the work cards and the deck are **stylised
illustrations of the kind of platform described in the resume** — visuals, not
captures of real production data, and the system names (Atlas, Corpus, Assay,
Sentinel, Throttle) are illustrative. Worth knowing if a client asks about the
numbers on them.

## Before publishing

1. **GitHub and LinkedIn URLs** — `index.html` has placeholders marked with a
   `TODO` comment near the bottom (`#contact`). The nav and footer inherit them.
2. **Availability pill** — the header says "Available for senior AI roles".
   Change or remove it in the `.nav-cta` block if that stops being true.
3. **Open Graph image** — add an `og:image` meta tag if you want a link preview
   card when the URL is shared.
4. **A note on the resume itself**: both pages of the source PDF carry a
   footer reading "John Howard", and the header lists GitHub/LinkedIn as plain
   text rather than links. That looks like leftover template content — worth
   fixing before the resume goes to anyone alongside this site.

## Browser support

Chrome, Edge, Safari and Firefox (current). Degrades cleanly:

- No `backdrop-filter` → the lens loses its chromatic fringe, everything else works.
- No canvas `filter` → the refracted console is dimmer; the ball still rolls.
- Touch / no-hover → the product renders at 50% opacity with no lens, cat disabled.
  The deck and the card screenshots work everywhere.
- `prefers-reduced-motion` → no intro, no cat, no parallax; static, fully readable page.

Canvas work is DPR-aware (capped at 2x) and pauses off-screen via
`IntersectionObserver`, plus on `visibilitychange`.
