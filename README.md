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
  primitives/  @graview/primitives  view primitives, three lenses, the workbench
  skills/      @graview/skills      the authoring moves, each ending in a check
apps/
  todo/        THE EXAMPLE — a todo list, because nobody has to be taught one
  the household example/    a household week    — a calendar
  proposal/    a tender response   — a coverage matrix, branded as "the bid-desk example"
  the coaching example/       a coaching week     — a board, a matrix and a calendar, and roles
  launcher/    the desk — a Graview app whose subject is the other three
  spike/       platform capability validation, run against a real browser
```

**The packages are what ships. The apps are examples.**

**Start with `apps/todo`.** Four kinds, ten named mutations, three rules that
name their own repairs, a lens borrowed from the household example's calendar, a declared
brand and an agent seat — small enough to read in one sitting, and the only one
that asks you to learn nothing before you can learn the framework. It found two
framework bugs while it was being written, which is what an example is for.

The other four are FIXTURES. Each was built to prove a specific claim — that a
lens written for one domain is reused unchanged by another, that a second app's
shell is eighty lines, that a permission model narrows the interface and an
agent seat from one declaration — and together they are what the browser
harnesses drive. None is a product and none is published. A real product built
on Graview lives in its own repository and depends on these packages the way
any other consumer does; `scripts/smoke-install.mjs` rehearses exactly that on
every CI run, by packing the tarballs and building a scratch app from them with
no workspace and no path mapping in sight.

Only `@graview/render` touches the browser or the GPU, and only through its
`@graview/render/gpu` entry — the main one is pure geometry, so nothing that
imports it inherits a WebGPU type dependency. Everything else runs headlessly
in CI with no browser flag.

## Run it

```sh
pnpm install
pnpm apps           # the desk → http://localhost:5199
pnpm apps:all       # the desk and all three apps on their own ports
```

The desk opens any app in place, so one server is enough. It also probes each
app's own port and says which are actually serving — a live dot where one is,
and the command to start it where one is not, because a launcher that offers
dead links is worse than one that offers none.

```sh
pnpm dev:todo       # THE EXAMPLE → http://localhost:5193
pnpm dev            # the household example  → http://localhost:5190
pnpm dev:proposal   # bid desk  → http://localhost:5191
pnpm dev:the coaching example      # the coaching example → http://localhost:5192
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
pnpm test          # 483 tests, no GPU, no browser
pnpm typecheck
pnpm check         # `graview check` against all four declarations
```

### The capture path

`?renderer=gpu` opts into compositing through WebGPU. It needs Chromium 147+
launched with `--enable-blink-features=CanvasDrawElement`.

It renders correctly — all three planes, connectors and all — and passes every
acceptance criterion. It used to bring the renderer process down on a pointer
click; that is fixed, and `pnpm capture` holds the claim. The cause was not the
click. A plain hover killed it just as reliably and a keyboard selection did
not: what is fatal is the browser's own hit-test descending into a
`layoutsubtree` canvas child. The hosts are out of hit-testing on that path now,
which costs nothing, because `updateElementGeometry` does not redirect
hit-testing in this build and `PointerRouter` was already answering.

It is still not the default. Capture falls off a cliff past ~128 live captures
a frame, and every other claim here is measured against the DOM path.

Two earlier defects here are fixed and worth knowing about, because both
failed silently: the compositor captured the canvas size once and kept using
it after the scene became responsive, so every quad was mapped to the wrong
place; and opacity was applied both to the DOM host and again in the shader,
so a view captured mid-fade baked its own transparency into the texture and
never recovered.

### The harnesses

```sh
pnpm acceptance    # walks the household example's criteria in Chrome Canary
pnpm spike         # capture, composite, pointer routing, capture budget
pnpm capture       # the capture path survives a pointer, and clicks still route
pnpm a11y          # the real accessibility tree, keyboard order, axe-core

pnpm direct        # act in place, travel deliberately — 19 criteria
pnpm shrunk        # the shrunk interface is the interface, scaled
pnpm watching      # an agent turn seen from outside the plane stack
pnpm permissions   # one policy narrows the strip and the agent seat alike
pnpm seat          # an agent seat does what it says, and says when there is nothing to do
pnpm brand         # somebody else's product, without a fork
pnpm navigation    # travelling, and getting back
pnpm moving        # panning the scene and dragging cards, both as ordinary stops
pnpm survey        # every place a person can land, photographed
pnpm audit         # and what is WRONG on each: collisions, cut text, tiny targets

pnpm pack:inspect  # what would actually go in each tarball
pnpm smoke         # install the tarballs into a scratch project and build
pnpm skills        # install the authoring skills for Claude Code and Codex
```

Each writes its verdict to `docs/`, as criteria rather than as a pass count:
when one fails it names the claim that stopped being true.

## Three apps, on purpose

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

**the coaching example** is a coaching week, and it had to justify itself hardest — a the coaching example
planner is *also* scheduling if you build it lazily. What earns its place is
the chain it turns on:

```
formation → position → skill ← drill ← session
```

The team you intend to put out decides which skills matter; the skills that
matter decide what training is for. That chain spans **three different
pictures** — a board, a matrix, a week — and the rule that walks it end to
end ("we are not training something the formation needs") is not expressible
in any one of them. Two of its three lenses were written for the other apps
and are reused unchanged.

Its new picture is the **board**: things arranged where the *domain* says they
go, and the first lens whose geometry the framework does not own. A left back
is at the left back's place because the position node says so, so moving one
is an ordinary mutation rather than a change to the layout engine. An empty
slot is a hole in the team; on a seating plan it is the empty chair.

The **desk** is a fourth app whose subject is the other three. It reads their
`defineApp` declarations — the same objects `graview check` consumes — so the
index cannot drift, and the coverage lens pointed at it answers a question
about the *framework* rather than about a domain.

It is a Graview app in full, which matters because the alternative was
cheating: it declares itself (so `graview check` checks it), it has mutations
(so **which app is in front of you is a `showing` edge**, not React state — it
lands in the op log with an author, and undo closes it), and it has rules it
can fail. Two fire today:

> No app uses **A persistence adapter** — it is being maintained for nobody
> Only **the coaching example** uses **Board lens** — one user does not prove a lens

The second is the argument this whole exercise has been making out loud, now
enforced rather than asserted, about the lens written most recently. The rule
accepts an argument — record why and it stops firing — but it insists there
is one.

Whether a dev server is up is *not* in the graph, deliberately: the graph
holds what you decided and the log holds why, and "port 5192 answered" every
four seconds is an observation about the world rather than a choice anyone
made.

Building the second app changed the framework in four places, and the third
in three more, which is what more than one app is for:

| What the second app forced | Where |
|---|---|
| A workbench: inspector, standing, activity, undo, trail, Escape — none of it ever knew what a week was | `@graview/primitives/workbench`; the household example's shell went from 1059 lines to 282 |
| Invariant repairs offer candidate NODES, not a text box asking for an id | `packages/tools/src/providers/invariant.ts` |
| `graview check` understands a lens that binds kinds and edges, not only fields | `packages/core/src/cli/check.ts` |
| An action needing several answers asks for them in turn | `AnswerArgs` |
| A lens role may bind a FIELD of the kind another role named, and the check verifies it exists there | `packages/core/src/cli/check.ts` |
| Coverage can let the GRAPH decide which rows are required, not only a field | `requiredVia` |
| The timeline's minimum window is the app's call — a household wants eight hours, two training sessions want two | `minWindow` |

Framework bugs surfaced too, each invisible until an app needed the thing:
jacking in rendered *underneath* the scene (the household example had it as well, on every
double-click); a coverage cell duplicated a target already reachable, putting
seventy-two extra tab stops between a keyboard user and the rest of the page;
the timeline's window could be centred onto half a minute and hand the app's
own formatter `14:7.5`; and a board read its occupants out of the aggregate,
which never contains them, so every slot reported itself empty.

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
| A third domain uses three lenses, two written for other apps | `the coaching example/tests/integration/acceptance.test.tsx` |
| A rule can walk a chain no single view holds | `the coaching example/tests/integration/acceptance.test.tsx` — formation → skill → drill → session |
| The board lens works in a domain nothing here is about | `packages/primitives/tests/unit/board.test.tsx` — a seating plan |
| An arrangement reaches assistive technology, where position is the first thing discarded | `the coaching example/scripts/run-a11y.mjs` |
| The framework's own tooling passes the test it sets everyone else | `apps/launcher/tests/integration/acceptance.test.ts` — the desk declares itself, records its navigation in the log, and can fail its own rules |
| Nothing the scene places is unreachable, at any viewport | `packages/layout/tests/unit/layout.test.ts` |
| Capture + composite works at three depths | `docs/spike-three-planes.png`, Chrome Canary 154 |
| Clicks land on drawn pixels at every depth | `apps/spike/scripts/run-spike.mjs` |
| The whole port meets its six criteria | `the household example/scripts/run-acceptance.mjs` |
| Content at depth reaches assistive technology | `the household example/scripts/run-a11y.mjs` — 185 AX nodes, keyboard reaches all three planes, zero axe violations |
| The shrunk interface is the interface, scaled | `scripts/verify-shrunk.mjs` — 8 criteria across five places in both schemes |
| A click selects in place; travel is deliberate | `scripts/verify-direct-manipulation.mjs` — 19 criteria in a live browser |
| An agent turn is watchable from outside the stack, and quiet costs nothing | `scripts/verify-watching.mjs` — 10 criteria, animation frames counted on a settled graph |
| One policy narrows the interface and the agent seat alike | `scripts/verify-permissions.mjs` — 9 criteria across the the coaching example's three seats |
| A brand reaches the pixels without forking a package | `scripts/verify-brand.mjs`, and `checkContrast` measures every text pair against WCAG AA |
| An inbound change is an ordinary op, undoable, authored by the system | `packages/core/tests/integration/sync.test.ts` |
| An echo of our own write is recognised and not re-applied | `packages/core/tests/integration/sync.test.ts` — the loop that breaks naive two-way sync |
| A conflict is surfaced as a violation with a repair, not resolved silently | `packages/core/tests/integration/sync.test.ts` |
| Offline degrades to local-only and reconciles on reconnect | `packages/core/tests/integration/sync.test.ts` |
| Travelling changes the address, and back and forward both work | `scripts/verify-navigation.mjs` — 12 criteria, driven through the controls rather than the keyboard |
| A stranger can install the tarballs and build a real app | `scripts/smoke-install.mjs` — packs, installs into a scratch project with no workspace or path mapping, typechecks and runs |
| A tarball contains what it should and nothing else | `scripts/inspect-pack.mjs` — no `src`, no tests, no tsbuildinfo, and every `exports` path present |
| The scene can be panned and its cards dragged, and both survive a reload | `scripts/verify-moving.mjs` — 10 criteria, including that a drag is not a click |
| An agent seat states what it would do, and goes quiet when there is nothing to do | `scripts/verify-seat.mjs` — 17 criteria across all four seats |
| The capture path survives a pointer, and a click still reaches the node that was drawn | `scripts/verify-capture.mjs` — hover, click routing and keyboard reach, in Chrome Canary |
| Every skill ends in a check, and names only findings the checker can produce | `packages/skills/tests/unit/skills.test.ts` — cross-checked against `check.ts` itself |
| No card is drawn on top of another, no caption is cut, no control is under a fingertip | `scripts/audit-ui.mjs` — 20 screens across four apps, measuring what a photograph makes you squint at |

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

## Shipping it

The six packages are the deliverable: an SDK someone builds a product on, in
their own repository. Everything needed for that exists and runs on every push
— `pnpm changeset` for versioning, `pnpm pack:inspect` for what goes in the
tarball, `pnpm smoke` for whether a stranger can install and build from it —
with one deliberate gap.

**Publishing is deliberately absent.** Every package is `private: true` and
carries no licence, because publishing without one leaves whoever installs it
with no permission to use it. `.github/workflows/release.yml` collects
changesets into a version pull request today and says exactly what turning
publishing on requires. That is a decision waiting to be made rather than work
waiting to be done.

## Status

Private. The public API is designed as though it will be published — clean
seams, honest boundaries — but it breaks freely while nobody depends on it.

**Outstanding:**

- **Google Calendar has never run against Google.** The sync layer is covered
  by tests against a scripted remote — echo suppression, conflict detection,
  offline reconciliation, and the exact request and response shapes — and
  the household example declares its mapping. What no test covers is Google itself: a token
  that expires mid-run, a sync token rejected after a week, a timezone
  normalised on save and handed back as somebody else's change.
  `the household example/scripts/sync-google.mjs` is runnable and read-only by default;
  until somebody runs it, "works end to end" is a claim rather than a fact.

- A screen-reader pass with real assistive technology. The accessibility tree
  is populated, every view is exposed by name, the keyboard reaches all three
  planes and axe-core reports nothing — but a populated tree is not proof that
  VoiceOver reads it well.
