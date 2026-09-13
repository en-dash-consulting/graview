# The walkthrough: a new app, end to end, until nothing is weird

This is the plan for finding every bug and every piece of weirdness that
stands between `graview create` and a seamless app. It is written for an
agent that has not seen this repository before. Read it top to bottom, then
work the stages in order. Each stage says what to do, what must be true when
it is done, and where to put what you find.

## Kick-off prompt

Paste this to start a session:

> Read `docs/walkthrough.md` in this repository and follow it. Work the
> stages in order in a new app created beside the framework. For every
> finding: record it in the findings log the way the playbook says, fix it
> in the framework package it belongs to (never only in the app), add or
> extend the harness criterion that should have caught it, and re-run the
> stage. Report the real outcome of every check, including failures. The
> PRD feature "A seamless app-creation flow: the walkthrough" carries one
> task per stage; mark each in progress and completed as you go.

## How a walk is run now

The fourth walk was run as a fresh agent launched from the kick-off prompt
by a session that then reviewed, ran the harness chain, rebuilt the page
and pushed. That worked: the walker has no memory of the last walk's
excuses, and the reviewer keeps the criteria honest. Do it that way:

- The walker works in the framework checkout, commits each finding with its
  criterion ("walkthrough: <stage> · <finding>") and does NOT push.
- The walker does not run `pnpm progression`, `pnpm site` or the artifact
  build; the reviewer runs the chain (typecheck, build, test, progression,
  site-progression, site:build, verify-site, artifact) and pushes.
- Browser harnesses run one at a time. An engines run beside another
  browser session reported a Firefox audit failure that was not there.
- Nothing runs on a port a `pnpm dev` already holds: the harnesses start
  their own servers on 5193 (Things) and 5194 (Seedbed) and exit if they
  cannot. Stop the dev servers first.
- When a walk adds findings, the walk task is closed by acknowledgment (the
  work was done) and the next walk task carries the "log gains nothing"
  criterion. That is what the queue follows.

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
- **Report faithfully.** "Passes" means you ran it and read the output.

## Setup

```sh
# in the framework checkout - the fifth walk is ../walk5; earlier walks stay put
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
- expected: the pointer menu is clamped to the scene's box
- actual: it opens at the pointer and runs under the shelf
- where it belongs: packages/primitives/src/workbench (the menu's placement)
- harness that should have caught it: scripts/audit-ui.mjs — no criterion
- status: fixed in <commit> · criterion added: audit-ui "menusStayInTheBox"
```

Severity is not a field. Everything in the log gets fixed; the order is the
order you found them.

## The bug classes this session already met

Read these before you start: they are the shapes to expect, and each is
now a criterion somewhere. If you see a cousin, it belongs to the same
package.

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
  over a neighbour must be the focus's reading. Cousins: a heading that
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
- **A crowd squeezed instead of wrapped.** Twelve neighbours in one row got
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
- The scene draws the line; the caption over the neighbour is the focus's
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

### E · The pages, customised

Do: follow `graview-pages`. Replace one record page. Then replace every
surface with a design of the app's own.

True when:
- A custom page still re-renders on every op, offers acts by
  `store.permits`, and uses `PageMain` so an embedded copy has one main.
- The full design passes axe at 390 and 1280 in both schemes; every link
  and button is at least 24px; the design's own colours hold AA on both
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
- Dress the app: declare `brand.kit` with a route and a per-edge colour the
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

The walk is done when a second agent, starting from the kick-off prompt
in a fresh checkout, works all nine stages and the findings log gains
nothing. Until then, every commit is "walkthrough: <stage> · <finding>",
with the criterion in the same commit as the fix.

Four walks have been run (31, 19, 19 and 16 findings, every one fixed with
a criterion); none kept the log still. The fifth is queued behind the demo
work — the installation in Things, the profile pane, the studio entrypoint,
the calendar lens, the routed faces, Rota, server-side persistence, the
launcher, figures — so that it walks what those add rather than what they
replace. When it runs, press first on the studio's write-back against a
checkout with a policy and lenses, on any surface that applies without a
principal, on what the chat proposes under a policy, and on keyboard focus
after every edit and every popover.
