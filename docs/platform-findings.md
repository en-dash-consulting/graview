# Platform capability findings

**Measured, not assumed.** Every claim below came from running code in
Chrome Canary **154.0.8032.0** with `--enable-blink-features=CanvasDrawElement`
and `--enable-unsafe-webgpu`, on macOS 14.8.2 / Apple silicon. Reproduce with:

```sh
node apps/spike/scripts/run-spike.mjs          # composite, routing, budget
node apps/spike/scripts/run-restrictions.mjs   # the exclusion list, one case per page
```

Raw output is committed as `platform-findings.json` and
`platform-restrictions.json`; the composited scene is `spike-three-planes.png`.

---

## The headline

The capture pipeline works. Ordinary DOM lives under a `<canvas layoutsubtree>`,
is captured into WebGPU textures, and composites as quads at plane depth with
per-plane scale, blur, contrast falloff and shadow. That is
`spike-three-planes.png`, and it is the whole visual premise of the project
standing up.

**One thing does not work yet, and it is the important one:**
`updateElementGeometry` is accepted and has no effect on hit-testing. See
[Geometry sync](#geometry-sync-accepted-but-not-honored).

---

## The API, as it actually is

The WICG README's spelling and the implementation's call shape do not match.
What Chromium 154 exposes:

| Surface | Shape |
|---|---|
| `GPUQueue.drawElementImageToTexture` | `(source, destination)` — **two dictionaries**: `{ source: Element \| ElementImage }` and `{ destination: { texture } }` |
| `GPUQueue.copyElementImageToTexture` | present, same argument shape |
| `HTMLCanvasElement.layoutSubtree` | property as well as attribute |
| `HTMLCanvasElement.captureElementImage(el)` | returns an opaque `ElementImage` (`width`, `height`, `close()`) — **only inside a `paint` event** |
| `HTMLCanvasElement.updateElementGeometry(source, { canvasTransform })` | accepts an `Element` or an `ElementImage` |
| `HTMLCanvasElement.clearElementGeometry(source)` | present |
| `HTMLCanvasElement.getElementTransform(source)` | present but **unusable** — throws "Overload resolution failed" for every argument tried, inside and outside `paint` |
| `HTMLCanvasElement.requestPaint()` / `paint` event | present; `paint` is the capture-safe moment |

All of it is behind one module — `packages/render/src/platform/html-in-canvas.ts`
— so when the spec settles, exactly one file changes.

### Two preconditions the error messages do not make obvious

1. **The canvas must own a configured WebGPU context.** Without
   `canvas.getContext("webgpu")` + `configure()`, capture fails with
   *"containing canvas does not have a rendering context"*. `surface(gpu, canvas)`
   from vgpu does this.
2. **Only immediate children of the canvas may be captured.** Passing a deeper
   descendant fails with *"Only immediate children of the `<canvas>` element can
   be passed to drawElementImageToTexture()"*. Their own descendants capture
   fine — the restriction is on the element you hand over, not on its subtree.
   **This is a constraint on `<Scene>`:** every view is a direct child of the
   canvas element, and view nesting happens inside a view, never between views.

---

## Geometry sync: accepted, but not honored

`updateElementGeometry(el, { canvasTransform })` is accepted for both affine and
perspective matrices and **does not move the hit region**. Measured with real
synthesized clicks, not `elementFromPoint` alone:

- click at the element's **drawn** position → the canvas receives it
- click at the element's **layout** position → the element still receives it

So the criterion *"clicks land on the drawn pixels, not the source element's
layout position"* **fails on the current implementation**, through no fault of
the design.

### What follows from that

**Accessibility is fine.** Views under a `layoutsubtree` canvas stay real,
focusable DOM: 3 of 3 panel buttons took focus, in order. The a11y half of the
bet holds today. (A screen-reader pass with real assistive technology is still
outstanding — a populated accessibility tree is not proof that VoiceOver reads
it.)

**Hit-testing into a captured subtree is FATAL, and that was the real defect.**
For months this was recorded as "a click crashes the renderer process on the
capture path". Bisected against Chromium 154 (`scripts/verify-capture.mjs`):

| Case | Result |
|---|---|
| Load the scene, no interaction | survives |
| Click the ground beside a captured view | survives |
| Select a node from the keyboard (Tab, Enter) | survives |
| **Hover** a captured view, no click at all | **renderer process dies** |
| Click a captured view | renderer process dies |

So it is not the click, not the capture, and not the DOM mutation a selection
causes — a hover is enough, and the same selection made from the keyboard is
not. What is fatal is the browser's own hit-test descending into a
`layoutsubtree` canvas child.

The fix costs nothing: the hosts carry `pointer-events: none` on the capture
path. A DOM hit-test on a captured view was already the wrong answer, because
`updateElementGeometry` does not redirect hit-testing in this build — it
reported where the element was laid out rather than where it was drawn, which
is the whole reason `PointerRouter` exists. Removing it from hit-testing stops
the platform racing the router into a crash. Keyboard reach and the
accessibility tree are untouched; `pointer-events` says nothing about focus.

**Pointers need a fallback, and now have one.** `PointerRouter`
(`packages/render/src/interaction/pointer-router.ts`) inverts each plane's
affine transform, finds which drawn quad is under the cursor, and replays the
event on the real element. Verified: clicking each of three panels at its
**drawn** button position activates that panel's button — 3 of 3, at three
different plane depths.

One subtlety it has to handle, which is itself a finding: **under
`layoutsubtree`, every immediate child is laid out at the canvas origin.** All
views stack on top of each other in layout space, so `elementFromPoint` always
returns whichever is topmost. The router walks `elementsFromPoint` and takes the
first hit contained by the view it actually wants.

The renderer keeps calling `updateElementGeometry` anyway: it costs nothing and
it is what makes the scene correct the day it starts working. Set
`platformHandlesHitTesting: true` to stand the router down then.

---

## The perspective question — answered for layout

`canvasTransform` **accepts a perspective matrix without error**. It also
accepts an affine one. Because geometry sync has no observable effect on
hit-testing in this build, "accepted" cannot be upgraded to "honored": there is
nothing to observe.

**The answer @graview/layout should act on: stay affine.**

- Depth is per-plane uniform scale, blur, contrast falloff and shadow — all
  affine. `PLANE_STYLES` emits nothing else.
- `isAffine()` is exported so layout can assert it about anything it emits.
- The plane model was designed to survive the affine-only answer, so this costs
  nothing. Revisit only when a design actually needs per-element foreshortening,
  and only after re-running this probe.

---

## Capture budget

Per-frame cost of capturing N 160×100 elements, median of 10 frames, one
`drawElementImageToTexture` per element inside a single `paint`:

| Nodes | Capture ms | Per node | Share of a 16.7 ms frame |
|------:|-----------:|---------:|-------------------------:|
| 1 | 0.10 | 0.100 | 0.6% |
| 8 | 0.30 | 0.038 | 1.8% |
| 32 | 0.70 | 0.022 | 4.2% |
| 64 | 1.00 | 0.016 | 6.0% |
| 96 | 1.40 | 0.015 | 8.4% |
| 128 | 2.00 | 0.016 | 12% |
| 160 | **33.25** | 0.208 | **199%** |
| 192 | 41.05 | 0.214 | 246% |

**There is a cliff, not a slope.** Cost is linear at ~0.016 ms/node up to ~128
live captures per frame, then jumps by more than an order of magnitude between
128 and 160 — and at 256 the GPU process crashes outright. The knee moved a
little between runs (one run stayed linear through 128, another degraded at
128), so treat **~128 live captures per frame as the ceiling and ~96 as the
working budget**, not as a precise threshold.

That is comfortably above what the design needs, *because of the fidelity
split*: only plane 0 captures live. `Compositor.shouldCapture` implements

- `full` — captured every frame (being edited)
- `summary` — captured only when its DOM changed
- `glyph` — captured once, then never again

A scene with 20 live views and 300 cached ones sits at 20 captures a frame, not
320. **Without the fidelity split, the design would hit the cliff at around 130
visible nodes.** That is the number that justifies the axis.

---

## The exclusion list, verified

Each case captured in its own page, then read back from the GPU to check
whether anything actually appeared — "no error thrown" is not "content drawn".

| Case | Result |
|---|---|
| plain div | captured with content (96 colors, 100% opaque) |
| styled text, transparent background | captured with content (116 colors, 9% opaque) — antialiased glyphs |
| **inline SVG** | **captured with content (14 colors, 46% opaque)** |
| `<img>` from a data URI | captured; a single flat color, which is what that image is |
| **nested `<canvas>`** | **captured but fully transparent — nothing drawn, and no error** |
| **cross-origin `<iframe>`** | **2 colors, 6% opaque — the frame's chrome only, content excluded** |

**Inline SVG is capturable.** The feared constraint — "iconography must be font
or raster" — does not apply. Icons, connectors and rules can be SVG.

**Nested canvas fails silently.** It does not throw; it draws nothing. A view
containing a canvas will render as a hole with no error to catch. Views that
embed a canvas must jack in, or draw through the scene renderer instead — and
the framework should detect a nested canvas at registration rather than let it
disappear.

**Cross-origin content is excluded, also silently.** Any view embedding a
third-party frame needs a placeholder at capture fidelity.

---

## Paint timing

The `paint` event fires and is the moment capture is legal. A DOM change made
*inside* `paint` was visible within the same frame in this build, so the
expected one-frame lag was **not** reproduced. That weakens, but does not
remove, the argument for shader-driven drag feedback: the compositor already
drives motion on the GPU, and reconciling to the DOM after a gesture settles
remains the right shape regardless.

---

## What this means for the plan

| Question | Answer | Consequence |
|---|---|---|
| Does capture + composite work? | **Yes** | The spatial premise stands. |
| Perspective or affine? | Accepts both; honors neither observably | **Layout stays affine.** No cost — the plane model already assumed it. |
| Do clicks follow the drawn pixels? | **Not from the platform** | `PointerRouter` supplies it, verified at three depths. Revisit each Chromium release. |
| Is the capture path safe to point at? | **Only outside hit-testing** | A hover into a captured subtree kills the renderer. Hosts carry `pointer-events: none`; `scripts/verify-capture.mjs` holds it. |
| Does accessibility follow? | **Yes, for focus** | Real DOM, real focus order. Screen-reader pass still outstanding. |
| What is the capture ceiling? | ~128 live/frame, cliff then crash | Fidelity split is load-bearing, not an optimization. |
| Can SVG be captured? | **Yes** | No constraint on iconography. |
| Nested canvas? | Silent blank | Detect at registration; jack in instead. |
| Cross-origin? | Silent exclusion | Placeholder required. |
