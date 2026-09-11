# Walkthrough findings

One entry per finding, newest last, in the shape `docs/walkthrough.md`
gives. Nothing here is closed until it is fixed in a package and a harness
criterion would fail without the fix.

Each entry names the commit by its subject line — commits here are
`walkthrough: <stage> · <finding>`, one per finding, with the criterion in
the same commit as the fix.

### W-001 · The first screen of a project offers "Add a item"
- stage: A · face: both · width: 1280 and 390 · scheme: both
- expected: the empty district offers "Add an item …", and every generated
  sentence about the kind agrees with the word the author chose
- actual: "Add a item …" in the strip, "A item: something Walk keeps track
  of." on the card and the list page, "Add a item" on the pages form and its
  submit button, "Mark a item closed" in the act's own description. The
  framework wrote the same mistake itself: the checker's
  `edge-without-inverse` message says "from a item", and the strip's empty
  action list says "Nothing you may do with a item".
- where it belongs: `packages/core/src/schema/define-node.ts` (no article
  helper existed), `packages/core/src/scaffold/index.ts` (the templates wrote
  the article as a literal), `packages/core/src/cli/check.ts`,
  `packages/primitives/src/workbench/index.tsx`
- harness that should have caught it: `packages/core/tests/unit/scaffold.test.ts`
  — no criterion; `scripts/smoke-create.mjs` scaffolded only consonant kinds
  ("note", "work-order"), so the bug could not appear; `scripts/audit-ui.mjs`
  read the glass but never read it as prose
- status: fixed in "walkthrough: A · the article agrees with the kind" ·
  criteria added: core unit tests `a or an` (schema.test.ts) and
  `the article agrees with the kind` (scaffold.test.ts); smoke-create verdict
  `aVowelKindIsSpokenWithAn`; audit-ui `articles` (every article on screen
  against the word after it)

### W-002 · The empty district says something is waiting for it that is not
- stage: A · face: scene · width: 1280 · scheme: dark
- expected: the blank app's one district offers its beginning and nothing
  else — a gap is only worth stating when another kind is waiting on it
- actual: selecting the empty district said "Nothing here yet, though Items
  expect to connect to these". The kind expecting Items was Items: a
  scaffolded project's first kind declares one edge and it points at itself,
  so on an empty graph the sentence named the absent kind as the party
  waiting for it, which is nobody.
- where it belongs: `packages/tools/src/providers/insight.ts` (the gap
  observation)
- harness that should have caught it: `packages/tools/tests/unit/intelligence.test.ts`
  — its gap case had two kinds and an edge between them, so a self-edge was
  never asked about
- status: fixed in "walkthrough: A · a gap nobody is waiting on is not an
  observation" · criterion added: intelligence.test.ts "says nothing about a
  gap only the missing kind itself expects"

### W-003 · A record card is named by its address, not by its name
- stage: A · face: scene · width: 1280 and 390 · scheme: both
- expected: the accessibility tree names every card — the card that reads
  "Buy milk" is called "Buy milk"
- actual: every view host is a `role="group"`, and a record's was labelled
  with its node id: `aria-label="item:buy-milk"`. Districts were right (their
  plural); records were the identifier. axe is silent about this — the card
  IS named, just not with a name — so nothing caught it.
- where it belongs: `packages/react/src/scene.tsx` (`SceneViewHost`'s
  `aria-label`)
- harness that should have caught it: `scripts/audit-ui.mjs` — no criterion
- status: fixed in "walkthrough: A · a card is named what it says it is" ·
  criterion added: audit-ui `unnamed` (a view host whose name is its own
  `data-graview-view`, or reads like an id). Verified failing without the
  fix: `?? todo/raised 3 cards named by their address: someday → someday`

### W-004 · The scene asks for a field by its key; the pages face asks in words
- stage: A · face: scene · width: 1280 · scheme: both
- expected: one act reads the same way on both faces
- actual: the strip's ask labelled its field `label` (aria-label and
  placeholder both the raw identifier), and an editor opened in place was
  named `label` too, while the same act on `/pages` said "Label". A second
  kind's `dependsOn` would have read `dependsOn` on one face and "Depends on"
  on the other.
- where it belongs: `packages/primitives/src/workbench/index.tsx` (the ask's
  input), `packages/primitives/src/editable.tsx` (the in-place editors)
- harness that should have caught it: `scripts/smoke-create.mjs` used
  `input[aria-label="label"]` as a selector — it depended on the bug;
  `scripts/audit-ui.mjs` — no criterion
- status: fixed in "walkthrough: A · a field is asked for in words" ·
  criteria added: smoke-create verdict `theAskNamesItsFieldInWords`;
  audit-ui `keyed` (an editor whose name is the key it edits)

### W-005 · A card in the scene is a tab stop that does nothing
- stage: A · face: scene · width: 1280 and 390 · scheme: both
- expected: keyboard alone can do everything — select the empty district,
  take its offer, add the first record
- actual: every view host is `tabIndex={0}`, and its `onKeyDown` returned
  unless the key had landed on an inner pick target: the host itself
  answered only a pointer. On a blank app that is the entire interface — one
  district, whose selection is what opens the strip, where the only act
  lives — so a keyboard alone could not put the first record into a new
  product. Enter and Space on the focused card did nothing at all.
- where it belongs: `packages/react/src/scene.tsx` (`SceneViewHost`'s
  `onKeyDown`)
- harness that should have caught it: `scripts/smoke-create.mjs` — no
  criterion; every browser rehearsal in the repository clicks
- status: fixed in "walkthrough: A · the card itself answers the keyboard" ·
  criterion added: smoke-create verdict `theKeyboardAloneMakesTheFirstRecord`
  — tab to the district, Enter, tab to the offer, Enter, type, Enter

### W-006 · No line in a scaffolded app can be selected
- stage: B · face: scene · width: 1280 · scheme: both
- expected: selecting the drawn line opens the relation's inspector — its
  name, its sentence, both ends, and the severing act
- actual: the strip's title was the raw selection string
  `edge:assigned-to:item:buy-milk:owner:ana`, under it "Nothing can be done
  with this mix of kinds yet — no mutation declares them as a subject", and
  the severing act was nowhere. A selection entry for a line is
  `edge:<kind>:<from>:<to>`, split three ways; `ctx.freshId(label, kind)`
  mints "item:buy-milk", so the split came back with five parts and
  `edgeOfSelection` returned null. Every line in every scaffolded app. The
  source comment asserted the opposite — "the framework's own ids never
  [contain ':']" — while the framework's own id minter does.
- where it belongs: `packages/layout/src/view-state.ts` (`edgeSelectionId` /
  `edgeOfSelection`)
- harness that should have caught it: `packages/layout/tests/unit/layout.test.ts`
  and `packages/primitives/tests/unit/edge-inspector.test.tsx` — both used
  hand-written ids ("ana", "morning"), as do apps/todo and apps/seedbed, so
  no test or demo in the repository ever held a minted id
- status: fixed in "walkthrough: B · a line whose ends have minted ids" ·
  criteria added: layout "round-trips ends whose ids carry the separator";
  edge-inspector "inspects a line whose ends have minted ids". Both verified
  failing without the fix.

### W-007 · A record page captions a relation from the wrong end
- stage: B · face: pages · width: 1280 and 390 · scheme: both
- expected: the pages record captions both directions correctly
- actual: the connections section's eyebrow was the edge kind, always: an
  owner's record read "Assigned to" over "What they are seeing to". That is
  the reading `graview check` warns about by name — `edge-without-inverse`
  says "from an owner it is captioned 'assigned to', which is the wrong way
  round" — printed by the framework's own derived page. Where a declaration
  had no words for a direction, the eyebrow and the heading under it were
  also the same string twice.
- where it belongs: `packages/pages/src/pages.tsx` (the connections group)
- harness that should have caught it:
  `packages/pages/tests/unit/parity.test.tsx` — it asserted the link data in
  both directions but never rendered the far end's page
- status: fixed in "walkthrough: B · a relation is captioned from the end you
  are standing on" · criterion added: parity "captions a connections section
  from this end, and never backwards". Verified failing without the fix
  ("Owned by" over "What they own" on a person's record).

### W-008 · A line offers the act that would make it, and logs a lie when pressed
- stage: B · face: scene · width: 1280 and 390 · scheme: both
- expected: selecting the line offers the severing act; an act that cannot
  change anything is not offered
- actual: the line's inspector offered "Hand it to somebody" — the act that
  makes exactly the relation you had selected. Both ends prefill from the
  line, so it arrived with nothing left to ask: a one-press button that
  appeared to do nothing. It did not do nothing. It applied the mutation,
  re-adding an edge that was already there, and wrote a second identical
  "Hand it to somebody" into Activity — undoable, attributed, describing a
  change that never happened.
- where it belongs: `packages/tools/src/providers/schema.ts` (the selected
  line's branch)
- harness that should have caught it:
  `packages/tools/tests/unit/edge-affordances.test.ts` — every mutation in it
  severs, so a maker was never offered on a line
- status: fixed in "walkthrough: B · a line does not offer the act that would
  make it" · criteria added: edge-affordances "does not offer the act that
  would make the line you already selected" (fails without the fix:
  `['remove-rider', 'give-a-ride']`) and "keeps a maker on a line when it
  still has something to ask"

### W-009 · The scene's heading list skips two levels as soon as a relation is drawn
- stage: B · face: scene · width: 1280 and 390 · scheme: both
- expected: axe reports nothing on either face
- actual: axe `heading-order` (moderate), on every scene state once an item
  was connected to an owner. The connections panel writes a relation's
  caption as an `h4` — for its size, which its own style sets anyway — and
  the only heading above it is the shell's `h1`, so a screen reader's heading
  list reads as though two sections are missing.
- where it belongs: `packages/primitives/src/connections.tsx`
- harness that should have caught it: `scripts/audit-ui.mjs` — no criterion,
  and nothing in the repository ran axe on a scene with a relation drawn in
  it
- status: fixed in "walkthrough: B · a relation's caption is an h2" ·
  criterion added: audit-ui `headings` (any jump of more than one level).
  Verified failing without the fix: `?? todo/travelled  headings skip a
  level: h1 → h4 at "why this is here"`. A heading is counted whether or not
  it is painted — the shell's h1 is clipped to a pixel on purpose, and
  measuring its box was what hid the jump on the first attempt.

### W-010 · A district says one of its members is broken, then will not say which
- stage: C · face: scene · width: 1280 and 390 · scheme: both
- expected: the flagged record is marked in the scene, in its district, and
  on its pages record
- actual: the district card said "Items ⚠ 1", and opening it — which is the
  whole reason to open it — showed every member as a plain chip. The same
  node drawn as a glyph elsewhere carries "⚠" and a title saying it is
  implicated in a problem; the members inside an opened district never asked
  whether they were flagged.
- where it belongs: `packages/primitives/src/default-views.tsx` (the opened
  district's members)
- harness that should have caught it:
  `packages/primitives/tests/unit/primitives.test.tsx` — the district tests
  never had a store with a rule in it
- status: fixed in "walkthrough: C · an opened district says which member is
  in trouble" · criterion added: primitives "marks the member that is in
  trouble, and only that one". Verified failing without the fix.

### W-011 · Every agent seat signs its work "claude"
- stage: C · face: scene · width: 1280 · scheme: both
- expected: repairing from the agent's seat leaves one op in the log with
  the right author
- actual: the op read "claude Close Buy milk" — `AgentSeat` hardcoded
  `id: "claude"` as the author of every seat in every app. A seat that is a
  rules mender, a scheduled job or somebody else's model wore a vendor's
  name; two seats on one embed (stage F) would be indistinguishable in the
  history. The chat seat next to it has always signed "chat", and a comment
  three hundred lines above records the same bug being fixed once already in
  the rendering of the name — but not in the writing of it.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`AgentSeat`), and the three call sites that now have to say who is sitting
  in them (the scaffold template, apps/todo, apps/seedbed)
- harness that should have caught it: `scripts/verify-seat.mjs` — it checked
  what the seat did, never who did it
- status: fixed in "walkthrough: C · a seat signs its own work" · criterion
  added: verify-seat "the seat signs its own work". Verified failing with a
  seat declared `who="claude"`: `FAIL todo: the seat signs its own work
  claude`.

### W-012 · A repair with a blank in it is offered as one press, and refuses on press
- stage: C · face: pages · width: 1280 and 390 · scheme: both
- expected: the repair is one press when it needs nothing, an ask when it
  needs one thing, and never a refusal on press
- actual: on the problems page and on a record page, every repair was a bare
  button applying the violation's own args. A repair that declares
  `missing: ["owner"]` therefore applied `assign-item` with no owner and
  threw into the console —
  `Invalid arguments for mutation "assign-item": owner: Invalid input:
  expected string, received undefined` — with the count unchanged and nothing
  said to the person. The scaffolder's own record-page template wrote the
  same loop, so every new project shipped with it. The actions strip has
  always turned this repair into an ask; the two faces simply disagreed.
- where it belongs: `packages/pages/src/pages.tsx` (both repair blocks, now
  one exported `Repairs` component) and `packages/core/src/scaffold/index.ts`
  (the template's record page, which uses it)
- harness that should have caught it:
  `packages/pages/tests/unit/parity.test.tsx` — its only invariant declared
  `repairs: []`, so no repair was ever rendered
- status: fixed in "walkthrough: C · a repair with a blank in it is an ask" ·
  criteria added: parity "marks the incomplete repair as an ask on the
  problems page" / "… on a record page" / "asks only for what the violation
  left blank". All three fail without the fix.

### W-013 · A district with a lens over it bursts into chips anyway
- stage: D · face: scene · width: 1280 and 390 · scheme: both
- expected: from altitude a group with a lens keeps its scaled card and its
  district stays shut; a group without one opens as its district
- actual: both opened as districts. A district explodes into a ring of chips
  because a bag of names is the best a generic card can do with its members;
  a kind with a lens over it has something better, and the card already draws
  a ◆ to say so — going deeper traded the designed picture for the fallback
  it exists to improve on, in the framework's own todo app as much as in the
  walkthrough's.
- where it belongs: `packages/layout/src/layout.ts` (`withJackIn`, which had
  no way to be told) and `packages/react/src/scene.tsx` (which knows, and
  did not say)
- harness that should have caught it: `scripts/verify-navigation.mjs` — it
  drove the altitude control and the district's own open button, never the
  gesture that goes deeper into a district
- status: fixed in "walkthrough: D · a kind with a picture of its own is
  where deeper goes" · criteria added: layout "goes INTO the picture a kind
  has of its own, leaving the district shut"; verify-navigation
  `aDistrictWithAPictureGoesIntoIt` and `aDistrictWithoutOneOpensInPlace`.
  Verified against the previous build: `withAPicture:
  "#focus=aggregate%3Atask&overview=1&zoom=1"` became
  `"#focus=t-deposit&overview=1&expand=kind%3Atask"`-shaped and the verdict
  read false.

### W-014 · Half a lens's emphasis exists only as a colour
- stage: D · face: scene · width: 1280 and 390 · scheme: both
- expected: every mark the lens draws is a pick target; selection lights it
  and dims the rest, and the DOM says so (`data-graview-emphasis`)
- actual: in the coverage grid the row labels said their emphasis; the column
  heads and the filled cells only painted it. Selecting an item lit the
  owner's row in the tree and said nothing about the column you had selected
  or the cell that answers it — three marks of nine making a checkable claim.
  The same defect turned out to be in the framework's own todo app: the list
  headers in `ListsView` painted emphasis the tasks under them said (12 of 15
  marks), found by the new criterion rather than by eye.
- where it belongs: `packages/primitives/src/lens/coverage.tsx`, and
  `apps/todo/src/ui/views.tsx` for the instance the criterion then found
- harness that should have caught it:
  `packages/primitives/tests/unit/coverage.test.tsx` tested the built grid and
  never rendered it; `scripts/audit-ui.mjs` had no criterion
- status: fixed in "walkthrough: D · a lens says all its emphasis or none" ·
  criteria added: coverage "says plain on every mark when nothing is
  selected" / "lights and dims every mark once something is selected" (the
  first fails without the fix: `expected 3 to be greater than or equal to
  6`); audit-ui `halfSaid` — within one view, either every pick target
  carries `data-graview-emphasis` or none does. It found the todo instance on
  its first run.

### W-015 · A lens is offered as a place you cannot go while its kind is empty
- stage: D · face: scene · width: 1280 and 390 · scheme: both
- expected: the title is a place — a pill in the bar, pressed while there —
  and the lens does not fall over on an empty graph
- actual: on a blank app both lens pills were in the bar from the first
  paint. Pressing one changed the address to `#focus=aggregate:item` and drew
  nothing: no card on plane 0, no lens, and the pill did not even light.
  Every branch in the layout that places a focused group required the group
  to have members, so a group holding nobody was not a place at all. The
  empty picture is exactly the one a blank app needs — it is where a lens's
  own "none yet" lives.
- where it belongs: `packages/layout/src/layout.ts`
- harness that should have caught it:
  `packages/layout/tests/unit/layout.test.ts` — every focus test had a
  populated graph
- status: fixed in "walkthrough: D · a group is a place whether or not
  anybody is in it" · criteria added: layout "draws a group you have gone to
  even when nobody is in it" (fails without the fix: `expected undefined to
  be defined`) and "still refuses an address whose kind nobody declared" —
  the kinds in an aggregate address are checked against the declaration now,
  so `aggregate:unicorn` remains a focus id nothing resolves.

### W-016 · Both shipped lenses throw on an empty graph
- stage: D · face: scene · width: 1280 and 390 · scheme: both
- expected: neither the board nor the coverage grid throws on an empty graph
- actual: `buildCoverage` threw `CoverageBindingError: Nothing to lay out: no
  "risk" and no "control" nodes.` and `buildBoard` threw
  `BoardBindingError: Nothing to arrange: no "seat" nodes.` — whenever the
  kinds they are bound to held nothing. Both were written as a helpful
  diagnostic on the reasoning that an empty result probably means a wrong
  binding; that is true of a kind nobody declared and false of a blank app,
  where every kind is empty and the lens's title is already in the bar.
  Pressing it there took the scene down.
- where it belongs: `packages/primitives/src/lens/coverage.tsx` and
  `packages/primitives/src/lens/board.tsx`
- harness that should have caught it: their own unit tests — every fixture in
  both files was populated, so the first state of every app was the one state
  never asked about
- status: fixed in "walkthrough: D · an empty graph is not a misbinding" ·
  criteria added: coverage "builds a grid with no rows and no columns" and
  "renders it"; board "builds a board with no slots and nobody benched". All
  three failed with the binding errors quoted above. The declaration now
  answers the question the node count was guessing at: a role naming a kind
  nobody declared still throws, whatever is in the graph.

### W-017 · The framework's own copies of its skills are stale
- stage: E · face: neither — the repository itself
- expected: the walkthrough's stage E says "follow `graview-pages`", and an
  agent working in this checkout can load it
- actual: `.claude/skills` and `.agents/skills` here held nine skills, not
  ten — `graview-pages` had never been installed at all — and three of the
  nine (`graview-lens`, `graview-new-app`, `graview-node-kind`) were an edit
  behind their source in `packages/skills/skills/`. The skills are the thing
  every future app gets, and the framework is the first project anybody works
  in; an agent following the playbook here was sent to a skill it could not
  load.
- where it belongs: the checkout's own installed copies (`pnpm skills`), and
  the missing criterion
- harness that should have caught it:
  `packages/skills/tests/unit/skills.test.ts` — it installed into a scratch
  directory and checked that, never this repository's own copies
- status: fixed in "walkthrough: E · the framework's own skills are current"
  · criterion added: skills "keeps this repository's own installed copies
  current", which fails on the previous checkout with
  `.claude/skills/graview-lens is out of date — run pnpm skills`

### W-018 · A page's form asks a wider question than the act it is for
- stage: E · face: pages · width: 1280 and 390 · scheme: both
- expected: one act reads the same way on both faces
- actual: an affordance carries the only honest answers for each node
  reference it leaves open — a connecting act offers who is NOT already on, a
  severing act only what is attached, and neither ever offers the record
  itself. `DerivedForm` listed every node of the kind regardless, so a
  record's own "Depends on" offered the record (whose mutation then returns
  early: an act that cannot act), and "Hand it to somebody" on a record
  already with Ana offered Ana. The strip has narrowed these since it was
  written.
  Found while following `graview-pages` to build a design of the app's own —
  and the skill was part of it: its rung-two rules said to read
  `store.permits` and the mutations, and never named `facts.actions`, the
  derivation the framework's own record page uses. A design following the
  skill offered "Take it back" on a record with nothing taken.
- where it belongs: `packages/pages/src/form.tsx` (the node control),
  `packages/pages/src/pages.tsx` (which has the affordance and did not pass
  it), and `packages/skills/skills/graview-pages/SKILL.md`
- harness that should have caught it:
  `packages/pages/tests/unit/parity.test.tsx` — it asserted the derived
  affordances match the scene's, and never rendered the form they produce
- status: fixed in "walkthrough: E · a form asks the question the act left
  open" · criteria added: parity "offers only who is not already on", "hands
  the narrowed list to the form rather than every node of the kind" (fails
  without the fix: `expected ['ana','bo'] to deeply equal ['bo']`) and "falls
  back to every node of the kind when there is no act to ask"

### W-019 · A withheld act does not say why, and what it does say is wrong
- stage: F · face: scene · width: 1280 and 390 · scheme: both
- expected: every act the narrower seat may not take is struck through with
  the policy's reason, in the strip as well as on the pages
- actual: three things at once in the actions strip.
  1. The act was not struck through, and its reason was a `title` on a
     DISABLED button — which cannot be focused, so a keyboard had no way to
     ask for it and a pointer had to hover a dead control. The pages face has
     always said the sentence in the open.
  2. `Grant.describe` is documented as "shown when an action is withheld, so
     a refusal can say something useful" and NOTHING read it. Every refusal
     on every surface was a mutation id and a list of role names.
  3. A refusal about a derived edit counted only the acts it rides, so with a
     `mutations: "*"` grant in the policy it said "no declared act writes or
     creates it, so no role can" while another role plainly could —
     `data-withheld="nobody"` where it should have said the role.
  And a fourth, beside them: a district with everything withheld read
  "Nothing you may do with this mix of kinds" about one district titled
  "Owners", because the strip reads its kinds from the selection's nodes and
  a kind card has none.
- where it belongs: `packages/core/src/permissions/policy.ts` and
  `packages/primitives/src/workbench/index.tsx`
- harness that should have caught it:
  `packages/core/tests/unit/permissions.test.ts` (no grant in it had a
  `describe`, so the field was never exercised) and the primitives inspector
  tests (no policy in them at all)
- status: fixed in "walkthrough: F · a withheld act says why" · criteria
  added: permissions "repeats the policy's own sentence, which is why the
  grant has one", "says nothing extra when the grants have nothing to say",
  "speaks the subject kind rather than spelling it"; edge-inspector "strikes
  a withheld act and says the policy's reason in the open" and "names the
  kind when the selection is a district". All fail without the fix.

### W-020 · A repair the seat may not take is offered live, and refuses on press
- stage: F · face: pages · width: 1280 and 390 · scheme: both
- expected: nothing is hidden and nothing refuses on press
- actual: a rule names its repairs without knowing who is reading, and both
  repair surfaces rendered them straight from the violation — going round the
  permission question the actions strip has always asked through
  `deriveAffordances`. A hand was handed a live "Hand Buy milk to somebody …"
  on the problems page, opened it, chose an owner, submitted, and met
  "Not permitted: assign-item on an item — keeper can." The strip beside it
  had already struck the same act through.
  The scaffolder's record-page template wrote the same call, so every new
  project shipped with it.
- where it belongs: `packages/pages/src/pages.tsx` (`Repairs`) and
  `packages/core/src/scaffold/index.ts`
- harness that should have caught it:
  `packages/pages/tests/unit/parity.test.tsx` — it had a policy for the LIST
  page's creating acts and no policy on any page with a rule in it
- status: fixed in "walkthrough: F · a repair is an act, and a seat may not
  be able to take it" · criterion added: parity "withholds it on /problems"
  and "withholds it on /duties/school-run", which fail without the fix

### W-021 · A project cannot follow the last rung of its own pages skill
- stage: F/H · face: neither — the scaffold
- expected: `graview-pages` ends by telling a project to mount itself into
  somebody else's page with `@graview/embed`; a scaffolded project can do it
- actual: `@graview/embed` was not a dependency of a new project and had no
  alias in its vite config, so the import did not resolve. And when the
  dependency was added by hand, the option the whole thing turns on would not
  typecheck: `EmbedOptions.views` was declared as `ReturnType<typeof
  registerDefaultViews>`, which erases to `AnySchema` — so passing the
  registry an app wrote for its own declaration was a type error eleven lines
  deep in variance. The framework's own `apps/seedbed/src/site-embed.ts` got
  past it with `as never` on both sides of the call.
- where it belongs: `packages/embed/src/embed.tsx` (the type) and
  `packages/core/src/scaffold/index.ts` (the dependency, the alias, and an
  `embed.html` + `src/embed.tsx` so a project has somewhere to put one — and
  so its own `pnpm typecheck`, which covers `src/`, covers the embed surface)
- harness that should have caught it: nothing typechecked a `mount` call from
  an app with a concrete schema; the seedbed call site is heterogeneous by
  design (a chapter per schema) and its cast is legitimate, which is why the
  wrong type looked fine there
- status: fixed in "walkthrough: F · a project can mount itself" · criteria
  added: scaffold "depends on every package the skills reach for, including
  the embed" and "aliases every one of them for the linked dev server"; the
  shipped `src/embed.tsx` passes a typed registry with no cast, so the
  project's own typecheck is the standing criterion, and `smoke:create` runs
  it in all four rehearsals

### W-022 · Changing seats had no criterion for keeping the store
- stage: F · face: embed · width: 1280
- expected: changing seats on the embed keeps the store and its history
- actual: it does — but nothing said so. The embed's seat test asserted what
  narrows and never that the graph and the op log are the ones the reader was
  already looking at, which is the whole point of demonstrating a policy on a
  live store rather than on a fresh one.
- where it belongs: `apps/seedbed/tests/integration/embed.test.tsx`
- status: criterion added: "keeps the store and its history across a change
  of seat" — the same `Store` instance, the same op count and the same node
  count across two changes of seat, with the narrowing still happening
