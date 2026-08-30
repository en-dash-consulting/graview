# Graview

A framework for building applications where a typed context graph **is** the
interface rather than the backing store.

Node kinds declare their own fields, edges, views, mutations and invariants in
a single declaration. The framework derives spatial layout, legal actions,
agent tool schemas and accessibility labels from it.

```
packages/
  core/        @graview/core        schema, graph, invariants, op log, adapters, CLI
  layout/      @graview/layout      positions and planes — headless, pure
  tools/       @graview/tools       derived affordances, one agent tool surface
  render/      @graview/render      capture, composite at depth, pointer routing
  react/       @graview/react       the only UI binding, deliberately thin
  primitives/  @graview/primitives  view primitives, lenses, and the workbench
apps/
  the household example/    the first acceptance test — a scheduling domain, on a calendar
  proposal/    the second — a bid desk, on a coverage matrix
  spike/       platform capability validation, run against a real browser
```

Only `@graview/render` touches the browser or the GPU. Everything else runs
headlessly in CI with no browser flag.

## Run it

```sh
pnpm install
pnpm dev            # the household example  → http://localhost:5190
pnpm dev:proposal   # bid desk  → http://localhost:5191
```

That is the whole setup. No flags, no Canary, no GPU: the scene renders
through the DOM path, which reproduces the plane geometry exactly because the
plane model is affine by design. What it cannot do is per-plane blur in a
shader.

It opens in whichever scheme your system asks for, remembers what you pick,
and `?theme=light` / `?theme=dark` forces one. The two are not inversions:
dark is a lit control surface where depth loses luminance, light is daylight
and paper where depth loses contrast and gains haze. Inverting one to get the
other gives grey-on-grey mush, because glow does not exist in daylight.

```sh
pnpm test          # 305 tests, no GPU, no browser
pnpm typecheck
pnpm check         # `graview check` against the household example's declarations
```

### The capture path

`?renderer=gpu` opts into compositing through WebGPU. It needs Chromium 147+
launched with `--enable-blink-features=CanvasDrawElement`.

It renders correctly — all three planes, connectors and all — and passes
every acceptance criterion. It is not the default for one reason: **a pointer
click on it brings the renderer process down.** Clicking is the primary way
anyone uses this, so the path that survives it wins.

Two earlier defects here are fixed and worth knowing about, because both
failed silently: the compositor captured the canvas size once and kept using
it after the scene became responsive, so every quad was mapped to the wrong
place; and opacity was applied both to the DOM host and again in the shader,
so a view captured mid-fade baked its own transparency into the texture and
never recovered.

### The harnesses

```sh
pnpm acceptance    # walks the six acceptance criteria in Chrome Canary
pnpm spike         # capture, composite, pointer routing, capture budget
pnpm a11y          # the real accessibility tree, keyboard order, axe-core
```

## Two apps, on purpose

**the household example** is a household week: people, time, capacity. Its primary view is
a calendar and it proved the timeline lens.

**proposal** is a bid desk answering an invitation to tender, and it was built
second precisely because a second scheduling app would prove nothing. It has
almost no time in it. The question it answers is not *when* but **did we
answer what was asked, can we staff it, can we afford it, and did we remember
to say so** — which is coverage, a bipartite mapping rather than an interval.
So its primary view is a matrix, and the two failures it exists to catch are
readable without a word:

- **an empty row** — a requirement nobody answered
- **an empty column** — work nobody asked for

Both are absences of a *relationship*, which is what prose review is worst at:
reading a document will never reveal the paragraph that was never written.

It also has a second projection. The written response is assembled from the
graph, and every section carries the requirement references it answers because
the `covers` edges say so — nobody types them and nobody keeps them current.

Building it changed the framework in four places, which is what a second app
is for:

| What the second app forced | Where |
|---|---|
| A workbench: inspector, standing, activity, undo, trail, Escape — none of it ever knew what a week was | `@graview/primitives/workbench`; the household example's shell went from 1059 lines to 282 |
| Invariant repairs offer candidate NODES, not a text box asking for an id | `packages/tools/src/providers/invariant.ts` |
| `graview check` understands a lens that binds kinds and edges, not only fields | `packages/core/src/cli/check.ts` |
| An action needing several answers asks for them in turn | `AnswerArgs` |

Two framework bugs surfaced too: jacking in rendered *underneath* the scene
(the household example had it as well, on every double-click), and a coverage cell that
duplicated a target already reachable put seventy-two extra tab stops between
a keyboard user and the rest of the page.

## The four ideas

**The graph is the interface.** One `defineNode()` is the source of truth. AI
tool schemas, drag legality, aggregate contents and a11y labels all derive from
it, and every derived value stays inspectable and overridable. Click anything
the interface draws — an event in a calendar, a chip in a list — and you travel
to that node: its neighbours rise onto the plane behind it, each captioned with
the description its edge was declared with ("who does the run", "a nap that
must not be interrupted"). Nobody writes that copy, and a new edge kind shows
up there the moment it is declared.

**Actions are derived, not authored.** Given a selection, providers contribute
candidates: which mutations are legal across it, which invariants it breaks and
what would repair them, what is structurally true about it. Selecting three
runs where two share a day surfaces "align the third" — because the schema
already said which mutation writes that field, and nobody wrote a rule about
days. An LLM is one optional provider, not the mechanism.

**Space is navigable, not decorative.** Discrete z-planes with the camera
locked to one axis. Layout is a pure function of (focus, relation, graph)
overlaid with user pins, so the same graph gives the same picture, every stop
is a URL, and any two states interpolate.

**Whether it holds is always on screen.** The invariant engine runs on every
change and the bar states the result — "All agreements hold", or "2 problems"
that opens what broke and what would fix it. Implicated nodes are marked
wherever they are drawn, including inside a receded group, so a problem never
has to be hunted for. Opening one selects what it names, and the repairs
arrive through the ordinary inspector because repairs already outrank every
other provider there.

**An agent you can watch — and take back.** Its edits produce the same diffs yours do, so no
bespoke observability is needed for the *result* — but a diff says what
changed and never what was considered. The tool runtime emits every call as
it happens, reads included, so a turn reads as "looked at the whole graph,
looked at the Tuesday run, moved it to parent1" and every node named in it is
one click away. Any turn can be dropped from the activity rail, keeping
everything since: undoing out of order is legal exactly when no later live op
read something it wrote, so when it is not, the check names what is in the
way and offers to bring it along.

**History is a fold, not a stack.** The graph is a fold over an append-only
operation log. Every op carries author, batch, intent, its inverse, and the
nodes it READ — which makes "drop the agent's turn, keep my edits" a checkable
dependency condition rather than a stack pop.

## What is verified, and how

Nothing below is a claim about intent; each is a test or a measurement.

| Claim | Where it is checked |
|---|---|
| Invariants match the household example's own engine exactly | `the household example/tests/integration/invariant-parity.test.ts` — 90 violations across 9 provocations, against a fixture generated by running the household example's real code |
| An edge to an undeclared kind fails `tsc` | `createSchema`'s `ValidateEdgeTargets` |
| Selective undo names the blocking op | `packages/core/tests/unit/op-log.test.ts` |
| A suggestion appears nobody wrote a rule for | `packages/tools/tests/unit/affordances.test.ts` |
| Agent and human edits produce identical diffs | `the household example/tests/integration/acceptance.test.tsx` |
| A new node kind renders with zero view code | `packages/primitives/tests/unit/primitives.test.tsx` |
| A focused node surfaces its whole neighbourhood, captioned | `packages/layout/tests/unit/layout.test.ts`, `the household example/tests/integration/acceptance.test.tsx` |
| An unanswered argument says what sort of answer it wants | `packages/core/tests/unit/mutations.test.ts` |
| A broken agreement is visible without hunting, and marked in place | `the household example/tests/integration/acceptance.test.tsx` |
| A second, non-scheduling domain fits the same declarations | `the bid-desk example/tests/integration/acceptance.test.tsx` — ten kinds, nine edge kinds, six rules, zero framework changes to the schema layer |
| The coverage lens works in a domain neither app is about | `packages/primitives/tests/unit/coverage.test.tsx` — controls against risks |
| A repair nobody wrote appears from ranking, and matches another rule's finding independently | `the bid-desk example/tests/integration/acceptance.test.tsx` |
| The bid's matrix reaches assistive technology in both schemes | `the bid-desk example/scripts/run-a11y.mjs` — 484 AX nodes, keyboard reaches all three planes, zero axe violations |
| Capture + composite works at three depths | `docs/spike-three-planes.png`, Chrome Canary 154 |
| Clicks land on drawn pixels at every depth | `apps/spike/scripts/run-spike.mjs` |
| The whole port meets its six criteria | `the household example/scripts/run-acceptance.mjs` |
| Content at depth reaches assistive technology | `the household example/scripts/run-a11y.mjs` — 185 AX nodes, keyboard reaches all three planes, zero axe violations |

## The platform, honestly

Read [`docs/platform-findings.md`](docs/platform-findings.md) before trusting
anything about HTML-in-Canvas. The short version, measured in Chrome Canary
154:

- Capture and composite **work**. The API's real call shape is not what the
  WICG README describes, and every call sits behind one module.
- `updateElementGeometry` is accepted and **does not redirect hit-testing**.
  `PointerRouter` supplies that meanwhile, verified at three plane depths.
  Accessibility needs no fallback — views stay real, focusable DOM.
- Capture costs ~0.016 ms/node up to ~128 live captures a frame, then falls
  off a cliff. The fidelity split is load-bearing, not an optimisation.
- Inline SVG captures fine. Nested canvas and cross-origin frames capture
  **silently blank**, which is worse than throwing.

## Status

Private. The public API is designed as though it will be published — clean
seams, honest boundaries — but it breaks freely while nobody depends on it.

**Outstanding:**

- A click crashes the renderer process on the GPU path (see above). The DOM
  path is unaffected, so this is a compositing defect rather than a design
  one.
- A screen-reader pass with real assistive technology. The accessibility tree
  is populated, every view is exposed by name, the keyboard reaches all three
  planes and axe-core reports nothing — but a populated tree is not proof that
  VoiceOver reads it well.
