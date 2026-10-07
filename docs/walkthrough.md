# The walkthrough: a new app, end to end, until nothing is weird

This is the plan for finding every bug and every piece of weirdness that
stands between `graview create` and a seamless app. It is written for an
agent that has not seen this repository before. Read it top to bottom, then
work the stages in order. Each stage says what to do, what must be true when
it is done, and where to put what you find.

## Kick-off prompt

Paste this to start a session:

> Read `docs/walkthrough.md` in this repository and follow it. Create a new
> app beside the framework in a domain of its own, seeded at real size.
> Start every stage by running the journeys on it (`pnpm verify journeys`
> with the app named) and read `docs/journeys.json`: the jobs a person
> cannot finish, and the ones that cost far more than they should, are
> what the walk is for. Work those first, in order of impact. The watch
> judges the mechanical rules on every screen every harness reaches and
> keeps them in the ledger (`docs/watch/ledger.json`) — do not log by hand
> what it already holds; if you see one it missed, extend the watch, not
> the log. For every finding you do log: its impact on a job, its class,
> the fix in the framework package it belongs to (never only in the app),
> and the shared check that now holds it. Iterate with `pnpm verify
> --quick` and `--failed`; the full chain is the reviewer's. Report the
> real outcome of every check, including failures.

## How a walk is run now

A walk is an agent launched from the kick-off prompt, and a reviewing
session that runs the full chain, rebuilds the site and pushes. The walker
has no memory of the last walk's excuses; the reviewer keeps the criteria
honest.

### What a walk is for

Six walks logged 152 findings and the count did not fall, because the walk
spent its attention on what a machine can judge — the keyboard left on
`<body>`, a field key in a tooltip, seven pixels of overflow — and every
new domain found new instances of the same dozen classes. Those are the
watch's now: it judges every state every harness reaches, and the ledger
keeps each problem once, across harnesses and runs, as new, still open or
fixed. A walk that re-finds them by hand is spinning.

What no harness can say is whether a person can do the app's jobs, and at
what cost. The journeys (`scripts/verify-journeys.mjs`, `docs/journeys.json`)
derive the core jobs from the declaration — make one, find one, change one,
relate two, take it back, see what is wrong and repair it, be refused
before the press — and drive each in both faces, at a desk and on a phone,
by keyboard and by pointer, counting presses and noting where it dead-ends.
Their friction list, ranked by impact, is where a walk starts. The walk's
own eyes are for what neither can see: a job that completes and is still
confusing, a picture that misleads, a word that is wrong for the domain.

### The loop

- **Inner loop, the walker's: minutes, not half an hour.** `pnpm verify
  <name>` runs one harness; `--failed` reruns what failed last time;
  `--quick` asks the sweeping harnesses (site, gauntlet) for fewer widths,
  schemes and seats. A fix is checked by the harness that covers it, then
  `--failed`, never by the whole chain.
- **Outer loop, the reviewer's: once per walk.** `pnpm verify` runs every
  harness — three side by side on shared dev servers, then the ones that
  time something alone — and ends by saying what is new, still open and
  fixed. The nightly runs it in full and a red night holds the release.
- **One checkout per port range.** A harness borrows a dev server only if
  it serves this checkout (`lib/serve.mjs` asks it by absolute path). A
  second checkout — a worktree, a walk app's own framework copy — runs its
  servers outside 5190–5399.
- The walker commits each finding with its check ("walkthrough: <stage> ·
  <finding>") and does not push. When a walk adds a new class or a blocked
  job, the walk task is closed by acknowledgment and the next walk task
  carries the done criterion (see Done).

## The stance

- **Pre-user.** Nobody depends on the current shapes. When a better shape is
  found, change it outright. No compatibility shims, no second path.
- **Fix at the core.** A workaround in the app under test is a bug report
  against the framework, not a fix. The scaffold, the packages and the
  skills are what every future app gets; the app is only where you notice.
- **Every finding becomes a criterion.** The framework has harnesses that
  walk claims in a real browser (`pnpm smoke:create`, `pnpm progression`,
  `pnpm site`, `pnpm survey`, `pnpm audit-ui`, `node scripts/verify-*.mjs`).
  A fix without a criterion that would have failed before it is half a fix.
- **A criterion belongs to the class, not the component.** Six walks fixed
  152 findings each with a criterion local to the one surface it was seen
  on, and the same kinds came back on the next surface: the keyboard left
  on `<body>` by the strip, then the editor, then a design, then the door,
  then the chat, then the ladder, then the record page. A criterion that
  holds one component is the instance's; the class's is the check every
  state of every harness passes through. Fix that one first.
- **Report faithfully.** "Passes" means you ran it and read the output.

## Setup

```sh
# in the framework checkout - each walk gets its own ../walkN; earlier walks stay put
pnpm install && pnpm build && pnpm test
pnpm graview create ../walk5 --link . --name "Walk" --kind item --plural items
cd ../walk5 && pnpm verify && pnpm dev           # http://localhost:5170
```

Under webdriver the store starts fresh unless the address says
`?remember=1`, and `?fresh=1` EMPTIES a remembered store — so seed inside
the Playwright context you assert in, put `?remember=1` on every goto, and
take any "empty app" state last or in a context of its own.

The skills are installed into `../walk/.claude/skills`. Use them: the point
of the walk is to find where following the skills produces something wrong.
A second subject already exists at `../roster` (two kinds, an edge, a rule,
a titled lens) if you want a head start on stages B to D.

Keep a browser open on both faces the whole time: the scene at `/` and the
pages at `/pages`. Both schemes (`?theme=dark`, `?theme=light`). One narrow
window (390 wide) and one wide (1280). Reduced motion on at least once.

## The findings log

`docs/walkthrough-findings.md`, one entry per finding, newest last:

```
### W-014 · The inspector's menu opens off the bottom of a short scene
- stage: A · face: scene · width: 1280 · scheme: dark
- impact: costs a job — "relate two" from the strip: the menu covers its own last item, 2 extra presses
- class: layout-collision-or-overflow (also: breaks-at-width-zoom-or-engine)
- expected: the pointer menu is clamped to the scene's box
- actual: it opens at the pointer and runs under the shelf
- where it belongs: packages/primitives/src/workbench (the menu's placement)
- harness that should have caught it: scripts/audit-ui.mjs — no criterion
- status: fixed in <commit> · criterion added: audit-ui "menusStayInTheBox"
```

`impact` is a field, and it decides the order:

- **blocks a job** — a journey cannot be finished this way (name the job,
  face, width and input). First, always.
- **costs a job** — it can be finished, at a cost a person notices: presses
  far above the cheapest way, a detour, a wrong word on the way (give the
  numbers from `docs/journeys.json`). Next.
- **cosmetic** — nothing a person is trying to do is harder. Logged only
  when it is a NEW class; a cosmetic instance of a known class is the
  watch's or the gauntlet's to hold, and is fixed with its class, in one
  batch, through the shared check — never one by one, never ahead of a
  job that is blocked.

"Everything gets fixed in the order found" was the old rule, and it is how
a walk spent the same afternoon on a seven-pixel overflow as on a form that
could not be submitted from the keyboard.

`class` is one of the classes listed at the top of the findings log, each
with a one-line definition and the shared check that owns it. Exactly one
is primary — the one whose check should have caught this — and others may
follow as `(also: …)`; most findings on new data carry
`data-shape-not-in-fixtures` as an also.

What the class decides:

- **A known class is a miss of the shared check.** The finding says the
  watch (the in-page judge every harness runs on every state it reaches,
  in `scripts/lib`) or the gauntlet (`apps/gauntlet`, the example built to
  be awkward) has a hole. Fix the hole first — a rule the watch did not
  judge, a state no harness reached, a shape the gauntlet's data did not
  have — so that the check fails on this finding AND on its cousins on
  every other surface. Then fix the instance; the check going green is its
  criterion. A criterion local to one component is not enough for a known
  class: that is how `keyboard-lands-nowhere` came back thirteen times.
  Where the class's check says "none yet", building it is part of the fix,
  and the finding says so in its status.
- **A new class is what the walk is for.** If no class fits, write one —
  a slug that is a sentence, one line saying what it is — add it to the
  list with its count, and give it a shared check before the walk goes on.
  A new class whose only criterion is the instance's has not been fixed.
- `harness that should have caught it` names the shared check that missed,
  then any component test, in that order.

## The bug classes this session already met

The class list at the top of `docs/walkthrough-findings.md` is the one a
finding is filed under; what follows is the older, longer account of the
same shapes, kept for its cousins. Read these before you start: they are
the shapes to expect, and each is now a criterion somewhere. If you see a
cousin, it belongs to the same class — file it there and ask why that
class's shared check let it through.

- **A target that is not what is drawn.** A view host is the layout's box;
  only the drawn content may be a hit target (theme rule). Cousins: a
  pick target inside a pick target (axe `nested-interactive`), a control
  under 24px, a hit stroke stealing a chip's click.
- **State carried to where it means nothing.** Pins and pan belonged to the
  stop they were made at. Cousins: a selection surviving a face change, a
  district expansion surviving descent, a relation raised at altitude.
- **A focus id nothing resolves.** A kind card's own id was made the focus
  by double-click. Cousins: any id in the URL that lays out an empty scene.
- **Words read from the wrong end.** An edge has two readings; the caption
  over a neighbor must be the focus's reading. Cousins: a heading that
  names the edge kind, a plural where a singular is meant, a title that is
  an identifier.
- **An act that cannot act.** A one-press button that refused on press
  because its inputs were optional. Cousins: a form that refuses on submit
  for a reason the page could have known (permission), a repair with an
  unfilled argument offered as one press.
- **A lens that says something untrue.** A slot with two occupants showed
  one and benched the other. Cousins: a grid over two kinds handed one, a
  count that excludes the horizon without saying so.
- **Chrome over content.** The inspector fixed to the window, a ring under
  the rails, a caption on top of a card. Cousins: anything at 390px.
- **A landmark said twice.** Two `main`s once a page is embedded; two
  regions with one name. Cousins: anything axe reports under landmarks.
- **Prose that rots.** Counts and words written by hand. Cousins: a caption
  that quotes a state the seed no longer produces.

The fourth walk and the days after it added these:

- **An act applied as nobody.** The routed face's forms and repairs called
  `store.apply` with no author, so under a policy every permitted act was
  refused on press while the derivation beside it had offered it. Cousins:
  any surface that applies without threading the seat's principal — a lens,
  a design's own form, a chat proposal.
- **A rule about "drawn inside a host" that does not say which host.** A
  line was silenced because its far end was drawn inside the near end's
  host — which is right when the FOCUS restates the relation and wrong when
  a band card merely lists its members as chips. Cousins: any rule keyed on
  "is drawn somewhere" without asking by whom and at what plane.
- **A crowd squeezed instead of wrapped.** Twelve neighbors in one row got
  slots 57 pixels wide under chips 150 wide; the lines between them, clipped
  under every chip, were confetti. Cousins: any band, row or grid that
  divides its width by the count with no floor; any line drawn across a
  grid instead of through its gutters.
- **A relation restated.** A view that draws both ends of an edge has
  drawn the relation; a line from it to the same node's chip says nothing.
  Cousins: a line anchored on a panel for a member the panel does not draw.
- **Focus that lands on the body.** After an in-place rename, after a
  popover closed, after a design's form submitted, the keyboard was on
  `<body>` or on a control nobody pressed. Cousins: any pane that goes away
  while the keyboard is in it.
- **One key doing two things.** Escape closed the popover AND dropped the
  selection. Cousins: a click that selects and travels; a submit that saves
  and navigates.
- **The log says the button, not the act.** The strip logged its label
  while the pages logged the act's `describe`, so one repair had two
  histories. Cousins: any surface that names an act by its registered name.
- **The seat's own turn under a policy.** The chat proposed an act the seat
  may not take; the rail and the pages called the other seat's work "you".
  Cousins: any surface that assumes the keyboard is the only author.
- **A generic type that needs a cast to follow the skill.** A lens typed
  `ViewComponent<S>` would not register on one kind without `as`, and the
  framework's own apps carried fourteen casts. Cousins: any skill whose
  example only typechecks with a cast the skill does not show.
- **A write-back that invents or disarms.** The studio wrote `to` where the
  checkout said `dependsOn`, and wrote every checkout rule as
  `evaluate() { return []; }` under a comment claiming the opposite.
  Cousins: any generator that writes a body it never saw, or a stub that
  quietly holds.
- **Example data that contradicts its words.** The "Today" list held tasks
  on two days; the calendar showed times with no names. Cousins: a seed that
  no rule fires on; a demo whose example never exercises the capability the
  chapter is about.

## The stages

Work them in order. Each stage's criteria must all be true, in both faces,
both schemes and both widths, before the next.

### A · The blank app

Do: open the scaffolded app. From altitude, descend, rise. Select the empty
district. Add the first item through the strip, then through the pages
form. Rename it in place. Undo. Use Back and Forward. Press Escape from
every state.

True when:
- Altitude shows one district with 0; it offers "Add an item …" and nothing
  else; the ask has a text field, Apply is disabled until there is text.
- The record appears in the district, the shelf, the pages list and the
  pages home sentence, with no reload.
- Every stop is a URL: Back returns to the previous picture with its
  selection; Forward is offered only when there is somewhere to go.
- Escape backs out one level at a time in the documented order and never
  drops a selection while rising.
- The inspector, menu and strip stay inside the scene's box at 390px.
- axe reports nothing on either face; the accessibility tree names every
  card; keyboard alone can do everything above.

### B · A second kind and an edge

Do: follow `graview-node-kind`. Declare a second kind and an edge from the
first to it with `description` and `inverse`. Declare the act that connects
and the act that severs. Seed two of each. Connect through the strip,
through the line's own menu, and through the pages record.

True when:
- `graview check` is clean; declaring the edge without `inverse` warns
  `edge-without-inverse` with the far end's caption in the message.
- The scene draws the line; the caption over the neighbor is the focus's
  reading; the connections panel on each end uses that end's words; the
  pages record captions both directions correctly.
- The connecting act offers only candidates not already connected; the
  severing act offers only what is attached, and is not offered at all on a
  record with nothing attached.
- Selecting the line offers the severing act; severing from either end
  removes exactly that line.
- The district at altitude opens on double-click; a double-click on a chip
  inside it travels to the record; the district closes on a second
  double-click.
- Raise the second kind on a focus that has no edge of it (a rule, or the
  first kind's group): the band never squeezes a slot under a chip's width
  and wraps past it; a line between two chips of the band runs through the
  gutters, whole; a line from the focus to a member the focus already draws
  is not drawn; the card's connections and the picture agree.
- Open the declaration in the studio (`createStudio(app)` in a test): the
  round trip passes `graview check` with no new warnings, and
  `studio.files()` keeps the checkout's argument names, keeps a
  hand-written body by name rather than replacing it, and says loudly where
  a body must be supplied.

### C · A rule and its repair

Do: follow `graview-invariant`. Declare a rule that fails on the seed, with
a repair that names an act and leaves one argument to be asked for.

True when:
- Standing changes from the clean sentence to "1 problem"; the problems
  page lists it with the same words; the flagged record is marked in the
  scene, in its district, and on its pages record.
- The repair is one press when it needs nothing, an ask when it needs one
  thing, and never a refusal on press.
- Repairing from the scene, from the pages and from the agent's seat each
  leave one op in the log with the right author; undo takes it back and the
  problem returns.

### D · Lenses

Do: follow `graview-lens`. Register a starter lens (coverage or board) with
a title. Then write a lens of your own over the same kinds.

True when:
- The title is a place: a pill in the bar and on an embed's strip, pressed
  while there; pressing it from a record returns to the lens.
- Every mark the lens draws is a pick target; selection lights it and dims
  the rest, and the DOM says so (`data-graview-emphasis`).
- From altitude a group with a lens keeps its scaled card and its district
  stays shut; a group without one opens as its district.
- The lens reads the whole graph, never only the group's members.
- The board holds several occupants per slot; the coverage grid has all its
  rows and columns; neither throws on an empty graph.

### E · The pages, customized

Do: follow `graview-pages`. Replace one record page. Then replace every
surface with a design of the app's own.

True when:
- A custom page still re-renders on every op, offers acts by
  `store.permits`, and uses `PageMain` so an embedded copy has one main.
- The full design passes axe at 390 and 1280 in both schemes; every link
  and button is at least 24px; the design's own colors hold AA on both
  grounds.
- The derived face is nowhere in it (`aria-label="Kinds"` absent) and every
  route renders.

### F · Who may do what

Do: follow `graview-permissions` and `graview-agent-seat`. Declare two roles;
put a seat for each on the embed.

True when:
- With the narrower seat at the keyboard, every act it may not take is
  struck through with the policy's reason in the strip, the pages and the
  design; nothing is hidden and nothing refuses on press.
- The agent's tool list is exactly the narrower seat's acts; a call outside
  it is refused with the same sentence.
- Changing seats on the embed keeps the store and its history.
- The seat's own turn under the policy: the chat never proposes an act the
  seat may not take; the rail and the pages name the other seat's work by
  its author, never "you"; a form or repair on the routed face applies as
  the person at the keyboard and the log says so.
- Dress the app: declare `brand.kit` with a route and a per-edge color the
  checker refuses (`kit-contrast-below-aa`), then one it accepts; the lines
  change and the relation key agrees; a kind kept quiet says "not drawn"
  in the key and stays selectable from the inspector.

### G · Remembering and shipping

Do: follow `graview-ship`. Turn on the browser adapter. Reload. Then bump
the version with a migration and reload against the old store.

True when:
- Edits survive a reload; "start fresh" empties them; the rail says so.
- The migration runs once, is in the log with its author and intent, and is
  undoable.

### H · On somebody else's page

Do: mount the app with `@graview/embed` into a plain HTML page beside a
paragraph, twice, at two stops.

True when:
- Both embeds are themed to themselves and the host page's own theme is
  untouched; two embeds have two landmark names; the strip's faces, places
  and seats all work in each.
- Nothing in either embed escapes its box: menus, inspector, popovers.

### I · The cross-cutting pass

Do, in the app as it now stands: a keyboard-only pass of every stage;
reduced motion on; the app in WebKit and Firefox as well as Chromium; text
zoom to 200% — the root font size, not page zoom, which is a scale factor
and proves nothing about reflow — on EVERY route of the design, not the
four the criterion first covered; a window 320px wide.

Press, in the keyboard pass, on where the keyboard IS after every in-place
edit and every popover close, and on Escape doing exactly one thing. Press,
in every face, on any surface that applies a mutation: is it the seat that
applies, and does the log name it?

There is no `?renderer=gpu` to try, and this used to ask for one: `auto`
means the DOM path unless an app passes an `attachRenderer`, and the GPU
path is opt-in, experimental and Chromium-Canary-only. `pnpm engines` is
where that lives. A scaffolded app's cross-cutting risk is the three
shipping engines, so that is what this asks for.

True when:
- Everything above is still true.
- `pnpm site` on the framework page, `pnpm audit-ui`, `pnpm survey` and
  `pnpm progression` pass with the criteria you added — and so do
  `pnpm test`, `pnpm smoke:create`, `pnpm remember`, `pnpm navigation`,
  `pnpm menu`, `pnpm pages`, `pnpm chat`, `pnpm seat` and `pnpm shrunk`.
- `pnpm engines` passes. It is the only one that runs anything in WebKit and
  Firefox, and a stage that asks for three browsers has to run the harness
  that uses them: the third walk found a picker on every page of the routed
  face under the minimum target size in WebKit and nowhere else, measured by
  a criterion that had been there all along and only ever run in Chromium.

Run that list at the END OF EVERY STAGE, not only here. This session broke
the in-place editor in stage A and did not find out until stage G, because
`pnpm remember` is a browser harness outside `pnpm test` and nothing had
asked it since.

## Done

There are two answers to "is it done", and they are asked by two kinds of
run.

- **A walk is done when no job is blocked and it adds no new class.** The
  journeys finish every derived job in both faces, at both widths, by
  keyboard and by pointer, on the walk's own app at real size; nothing on
  the friction list costs more than the cheapest way to the same job by a
  margin the walk can name a reason for; and every finding is of a class
  already on the list, fixed by closing the hole in that class's check. A second agent, starting
  from the kick-off prompt in a fresh checkout and a new domain, works all
  nine stages; every finding it makes is of a class already on the list,
  and each has been fixed by closing the hole in that class's shared check.
  A new domain is new data, so a walk that finds nothing at all is not the
  bar — six walks in six domains found 31, 19, 19, 16, 32 and 29, and every
  one of those 152 was of a class the first walk had already met.
- **A regression re-walk is done when it finds nothing.** It walks an
  earlier domain again — `../walk6`, the car dealership, or any walk before
  it — on the current framework. The data is not new, the classes are not
  new, and every finding that domain produced is held by a shared check,
  so "the log gains nothing" is the expected answer here, and anything it
  does find is a regression in a check that should have held it.

Until then, every commit is "walkthrough: <stage> · <finding>", with the
criterion in the same commit as the fix — and for a known class, the
criterion is the shared check's.

Six walks have been run (31, 19, 19, 16, 32 and 29 findings, every one
fixed with a criterion); none kept the log still, and none added a class
the first had not. The seventh starts from the journeys and the ledger: the
watch, the gauntlet and the ledger hold the classes six walks found, so
what it is for is the jobs — the ones a person cannot finish, then the ones
that cost too much — and whatever fits no class at all.
