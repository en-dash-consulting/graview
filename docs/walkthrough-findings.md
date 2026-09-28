# Walkthrough findings

One entry per finding, newest last, in the shape `docs/walkthrough.md`
gives. Nothing here is closed until it is fixed in a package and a harness
criterion would fail without the fix.

Each entry names the commit by its subject line — commits here are
`walkthrough: <stage> · <finding>`, one per finding, with the criterion in
the same commit as the fix.

## The first walk (2026-09-11)

Thirty-one findings across the nine stages, every one fixed in a framework
package and covered by a criterion that fails without the fix. The subject
was a project scaffolded beside the framework with
`pnpm graview create ../walk --link . --name "Walk" --kind item
--plural items`, taken through two kinds and an edge, two rules, two lenses
(one the framework's, one its own), a design over every surface, two roles
with a seat each, two migrations, and two embeds on a plain article page.

The shapes that came up more than once, which are the ones to expect again:

- **An identifier where a name belongs.** A card named by its node id
  (W-003), a field asked for by its key (W-004), a line's inspector titled
  with its raw address (W-006), a relation captioned from the wrong end
  (W-007).
- **An act that cannot act.** A line offering the act that makes it (W-008),
  a repair with a blank in it offered as one press (W-012), a repair the
  seat may not take (W-020), a form asking a wider question than its act
  (W-018).
- **A refusal that is not said.** In the strip (W-019), on a seat (W-023),
  on an undo (W-025) — all three had the reason in a `title` on a disabled
  control, which a keyboard cannot reach.
- **A harness that never asked.** Every fixture populated, so the empty
  graph was the one state nobody tested (W-016, W-015); every screen at 1560
  wide, so the phone was invisible (W-029, W-031); every browser rehearsal
  clicking, so the keyboard was untried (W-005).
- **Something true in memory and false once written down.** "Remove this
  field" through JSON (W-024), an edge id whose ends contain its separator
  (W-006).

And one regression made by this walk and caught by it: W-026, the card
swallowing the editor's Enter, introduced by W-005 two stages earlier and
found by `pnpm remember`. That is why stage I now says to run every harness
at the end of every stage.

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

### W-023 · A seat that may not sit down gives the wrong reason, quietly
- stage: F · face: scene · width: 1280 · scheme: both
- expected: nothing is hidden and nothing refuses on press; a seat the policy
  refuses says so
- actual: with the narrower seat at the keyboard, the starter seat was
  disabled and labelled "There is something here already" — its idle text,
  which is a different answer to a different question. The real reason ("Not
  yours to do from this seat. The store refuses add-item…") was in a `title`
  on the DISABLED button, unreachable from a keyboard and needing a hover
  over a dead control otherwise. The same shape as W-019, in the seat rather
  than the strip.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`AgentSeat`)
- harness that should have caught it: `scripts/verify-seat.mjs` drove a seat
  that is always permitted; no test rendered a seat under a policy that
  refuses it
- status: fixed in "walkthrough: F · a seat that may not sit down says so" ·
  criteria added: shell "strikes a seat the policy refuses and says why
  beside it" (fails without the fix) and verify-seat "a permitted seat is not
  struck through and needs no excuse", so the strike cannot leak the other
  way

### W-024 · "Remove this field" does not survive being written down
- stage: G · face: both · width: any · scheme: any
- expected: the migration is in the log with its author and intent, and is
  undoable
- actual: a patch says "remove this key" by carrying the key with the value
  `undefined` — and the log, every adapter and the export bundle are JSON,
  which drops it. So a persisted op that cleared a field came back with an
  empty half: `before: {}` where it should have said which key to put back.
  Undoing a migration that added a field, after a reload, reported success,
  wrote "you Undo: migration 1→2 …" into the log, and left the field exactly
  where it was. Every ordinary mutation that clears a field — `ctx.patchNode(
  id, { x: undefined })` — had the same hole.
- where it belongs: `packages/core/src/graph/primitives.ts` (the
  instruction), `packages/core/src/graph/graph.ts` and
  `packages/ship/src/snapshot.ts` (the two appliers),
  `packages/core/src/store.ts` and `packages/ship/src/migrations.ts` (where
  primitives become operations)
- harness that should have caught it: `packages/ship/tests/unit/ship.test.ts`
  asserted the inverse on the op OBJECT, in memory, and never after JSON;
  `packages/core/tests/unit/op-log.test.ts` had no mutation that clears a
  field
- status: fixed in "walkthrough: G · remove this field, said out loud" ·
  `UNSET` is the instruction as a value, normalised in on the way into every
  operation. Criteria added: ship "keeps its inverse through JSON, which
  cannot carry undefined" (fails without the fix: `expected ['beds'] to
  deeply equal ['beds','size']`) and core "keeps a cleared field's
  instruction through JSON" (`expected [] to deeply equal ['pinned']`).

### W-025 · An undo the declaration refuses throws into the console
- stage: G · face: scene · width: 1280 · scheme: both
- expected: the migration is undoable — or, when it is not, the interface
  says so
- actual: `store.canUndo` answers what the LOG can answer (whether a later op
  read what this one wrote) and not what the SCHEMA answers. Taking back a
  migration that added a required field leaves a node the declaration
  refuses, so `store.undo` threw out of the click handler: an unhandled error
  in a console nobody is reading, and a button that appeared to do nothing.
  Beside it in the same file the agent seat already treats a refusal as a
  result and says it on the control.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`UndoTurn`)
- harness that should have caught it: nothing rendered an undo that the
  store would refuse
- status: fixed in "walkthrough: G · an undo that is refused says so" ·
  criterion added: `packages/primitives/tests/unit/undo-turn.test.tsx` "says
  why when the declaration will not have it, rather than throwing", which
  fails without the fix

### W-026 · Renaming a record in place stopped committing — a regression from W-005
- stage: G · face: scene · width: 1280 · scheme: both
- expected: the in-place editor commits on Enter, as stage A verified
- actual: after the fix for W-005 (making the card answer the keyboard), the
  host called `preventDefault()` on Enter BEFORE asking whose key it was. The
  editor is a one-field form inside the card, and a one-field form submits on
  Enter by default — so the default was swallowed, the form never submitted,
  the field stayed open and nothing was written. `pnpm remember` found it:
  four of its twelve criteria went false.
- where it belongs: `packages/react/src/scene.tsx` (`SceneViewHost`'s
  `onKeyDown`)
- harness that should have caught it: `scripts/verify-remember.mjs` DID —
  `theEditTookEffect`, `theEditSurvivesAReload`, `theHistorySurvivesAttributed`
  and `theEditIsStillUndoable` all failed. It is a browser harness that is
  not part of `pnpm test`, so it caught the regression two stages later than
  it happened.
- status: fixed in "walkthrough: G · a card does not swallow a field's key" ·
  criteria added: `packages/primitives/tests/unit/rename-in-place.test.tsx`
  — "commits on Enter, because the card does not swallow the field's key" and
  "does not let the card's own Enter reach a field being typed in". The
  second fails without the fix, in a second, inside `pnpm test`.

### W-027 · The scaffolder can ship a project that does not parse
- stage: G · face: neither — the scaffold
- expected: `pnpm smoke:create` passes
- actual: every one of its 28 verdicts went false, because the project's own
  `verify` died on `src/embed.tsx(22,16): error TS1005: ',' expected.` — the
  template had written `label: ${escapeString(ids.name)}` where
  `label: "${escapeString(ids.name)}"` was meant, so the generated line read
  `label: Field Notes,`. A template is a string, and nothing checked that the
  strings it produces are the language they claim to be. `smoke:create` did
  catch it — after packing tarballs, installing and building, minutes later,
  and with every unrelated verdict false around it.
- where it belongs: `packages/core/src/scaffold/index.ts`
- harness that should have caught it:
  `packages/core/tests/unit/scaffold.test.ts` asserted that particular
  strings appear in the output and never that the output is a program
- status: fixed in "walkthrough: G · a generated file is a program" ·
  criteria added: scaffold "parses every .ts and .tsx the scaffolder writes"
  — TypeScript's own parser over every generated source for three kinds,
  which fails in 300ms with `note: src/embed.tsx: expected [ "',' expected."
  ] to deeply equal []` — and "writes JSON files that are JSON"

### Note · a migration that adds a required field cannot be undone
- stage: G
- Not a defect, and worth writing down because the playbook's criterion says
  "undoable": undoing a step is judged against the CURRENT declaration. A
  step that introduces a required field has an inverse that leaves a node the
  new schema refuses, so it cannot be taken back while the app is at the new
  version — and the interface now says which node and which field rather than
  throwing (W-025). A step that reshapes values within a field both versions
  accept — Walk's 2→3, which lower-cases addresses — is undoable, and the
  walk verified it: the address came back as it was and the undo is in the
  log as "you Undo: migration 2→3 …".
- Also observed: `migrateSnapshot` gives every step of one run the same
  batch, so "undo the migration" means the whole run. Reasonable — a run is
  one event — but it means a run containing an un-undoable step cannot be
  undone at all.

### W-028 · An embed is not a landmark, so nothing it draws is inside one
- stage: H · face: embed · width: 1280 and 390 · scheme: both
- expected: two embeds have two landmark names; nothing in either escapes its
  box
- actual: `label` named every landmark INSIDE an embed ("Chapter 13 ·
  Places") and left the root a plain `<div>`. On a host page that means the
  strip, the seats, the faces and the picture all sit outside any landmark —
  axe `region`, ten nodes — and a reader moving by landmark cannot reach the
  app at all, let alone tell two of them apart. The label was for exactly
  this.
  Beside it: the scaffolder's own `embed.html` had no `<main>`, so axe also
  reported `landmark-one-main` on the page every project now ships.
- where it belongs: `packages/embed/src/embed.tsx` (the root) and
  `packages/core/src/scaffold/index.ts` (the host page)
- harness that should have caught it: the embed tests asserted the names of
  the landmarks inside and never that the embed is one; no harness ran axe on
  a host page with an embed in it
- status: fixed in "walkthrough: H · an embed is a region with a name" ·
  the root is a `<section>` named by `label`, or by the app when the page
  does not say. Criteria added: seedbed embed "is a region of its own, named,
  and two of them are two names" and "falls back to the app's own name when
  the page does not say"; smoke-create's
  `theProjectMountsItselfOnSomebodyElsesPage` — the shipped `embed.html` in a
  real browser: one main (the host's), a named section (the embed's), the
  host's own typeface untouched, no `--graview-accent` on `:root`, and axe
  clean

### W-029 · In a narrow Graview the actions strip sits on the thing you are acting on
- stage: H · face: scene · width: 390 (and any embed narrower than ~620)
- expected: nothing in either embed escapes its box, and chrome does not sit
  on content
- actual: the strip is placed as a left rail 236 wide at x=14, sized for the
  gutter beside a centred focus on a wide screen. In a 350-wide embed there
  is no gutter: measured, the pane covered 85% of the very card it was about
  (22375 of 26320 square pixels), and a click meant for the picture landed on
  "Close it". Docking it to the bottom instead moved the problem: from
  altitude the districts ARE the bottom, and the sheet buried the `open ▾`
  control on one.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
- harness that should have caught it: `scripts/audit-ui.mjs` measures exactly
  this (`covered`) and runs at 1560 only; nothing drove the scene in a
  narrow box
- status: fixed in "walkthrough: H · in a narrow box the picture makes room"
  · the rail's need is measured against the SCENE's box, not the window's —
  an embed in a column of an article is narrow on the widest monitor — and
  where there is no room beside the picture the sheet goes along the bottom
  and the scene's box gives up that height while it is open, so the layout
  re-runs into what is left. The old objection to insetting (it reflows the
  picture) stands, and loses: it reflows once when the sheet appears and once
  when it goes, against chrome permanently over the content.
  Criterion added: smoke-create's `theStripDoesNotCoverWhatYouAreActingOn` —
  the shipped `embed.html` at 390, a record selected: nothing of the focus
  covered, no control buried under the pane, and the pane inside its own box.
  Verified failing without the fix.

### W-030 · Stage I asked for a renderer a scaffolded app does not have
- stage: I · face: neither — the playbook
- expected: `?renderer=gpu` in Chromium is something the next agent can do
- actual: there is no such switch anywhere. `Scene`'s `renderer="auto"`
  resolves to the DOM path unless the app passes an `attachRenderer`, which a
  scaffolded app does not and the two demo apps explicitly opt out of
  (`renderer="dom"`). The GPU path is opt-in, experimental and
  Chromium-Canary-only, and `pnpm engines` is where it is exercised.
- where it belongs: `docs/walkthrough.md`
- status: fixed in "walkthrough: I · the cross-cutting pass asks for what can
  be done" · the condition is now the three shipping engines, which is a
  scaffolded app's real cross-cutting risk and was verified: the walk app
  runs, adds, travels to a lens, renders its own design and mounts two
  embeds, with no console errors, in WebKit and in Firefox as well as
  Chromium. The stage's harness list also now names every harness rather
  than four, and says to run them at the end of every stage — which is the
  lesson of W-026.

### W-031 · Every count in audit-ui ran at one width
- stage: I · face: scene · width: 390
- expected: `pnpm audit-ui` would have caught W-029 — it measures exactly
  that (`covered`: the strip sitting on a plane-0 or plane-1 panel)
- actual: it opens every screen at 1560×940 and nothing else, so a rail 236
  wide sitting on the card it is about, in a box 350 wide, was invisible to
  it — along with every other count in the file at phone width: the small
  controls, the cut captions, the collisions, the headings, the emphasis, the
  articles.
- where it belongs: `scripts/audit-ui.mjs`
- status: fixed in "walkthrough: I · one narrow screen" · a state may now ask
  for its own window, and `seedbed/narrow` is 390×620 with a record
  travelled into. Verified: with the rail forced back to its wide placement
  the screen reads `?? seedbed/narrow  strip covers 1`, and clean with the
  fix.

## The second walk (2026-09-11)

Nineteen findings, W-032 to W-050, across the setup and all nine stages —
every one fixed in a framework package and covered by a criterion verified to
fail without the fix. So the second walk did NOT leave the log still, and the
playbook's condition for done is not met: a third walk is owed.

Two of the nine stages (H, and the embed half of F) added nothing.

The shapes that came up again, and the new ones:

- **A criterion that cannot fail.** The largest class this time. Stage I's
  200% text passed for a year because no size in the framework was relative
  (W-050); `survey`'s overflow count was noise on 20 of 26 screens so nothing
  could be seen in it (W-044); `pnpm test` passed only because a stale
  `apps/*/dist` was on the disk (W-032); `ranking.test.ts` measured five uses
  of an act that had produced one op (W-036).
- **The framework failing to follow its own rule.** The derived list page did
  the mutation scan `graview-pages` forbids (W-045); the checker's own
  messages said "a item" after W-001 fixed the scaffold's (W-033); the
  `graview-agent-seat` example does not compile (W-048); `Chip` could not
  make the claim `graview-lens` demands of an app's lens (W-042).
- **Failing open where the store fails closed.** `deriveAffordances` skipped
  the permission check when asked by nobody, so a face offered what the store
  refused (W-047).
- **A machine's words in front of a person.** The validator's issue JSON in
  the activity rail (W-049), a bare list of candidate names with no question
  over it (W-039), an act labelled from the wrong end of its tie (W-040).
- **Chrome that does not fit.** The command bar off the edge of a phone with
  undo inside it (W-037), and the ring collapsing onto itself in the shorter
  scene that fix produced (W-038).

### W-032 · `pnpm test` fails in the checkout the playbook tells you to make
- stage: Setup · face: neither — the repository
- expected: `pnpm install && pnpm build && pnpm test`, the playbook's first
  instruction, passes in a checkout with nothing built in it
- actual: one suite fails to collect — `Failed to resolve entry for package
  "@graview/seedbed"`. `apps/launcher/tests/integration/acceptance.test.ts`
  imports `@graview/seedbed` and `@graview/todo` by workspace name. Every
  framework package is aliased to its source in `vitest.config.ts`, but the
  two apps are not, so node resolution wants `apps/*/dist/index.js` — and
  `pnpm build` compiles `packages/*` only, leaving `apps/` to `pnpm
  typecheck`. The suite passed on this machine for the whole first walk
  because `pnpm typecheck` had been run here at some point and the dist was
  lying around. 55 files, 637 tests, 1 failed suite.
- where it belongs: `vitest.config.ts`
- harness that should have caught it: nothing ran the repository's own setup
  from scratch; every harness assumes the tree it is already standing in
- status: fixed in "walkthrough: setup · a checkout with nothing built in it"
  · the two apps are aliased to `apps/<name>/src/index.ts` alongside the
  packages, so a cross-app import resolves to source like every other
  workspace name and never depends on a build step that does not write it.
  Criterion added: `tests/setup.test.ts` — "resolves every workspace name its
  tests import without a dist that build does not write", which reads the
  root `build` script and the alias table and walks every test file's
  `@graview/*` imports. Verified failing without the fix: it names
  `@graview/seedbed` and `@graview/todo` and the file that imports them.
  Re-verified by re-running `pnpm install && pnpm build && pnpm test` in the
  clean clone — 56 files, 651 tests, all passing.

### W-033 · The strip's tooltip under the first act says "this makes a item"
- stage: A · face: scene · width: 1280 · scheme: both
- expected: every sentence the framework writes about a kind takes its
  article from `withArticle` and says the kind in words, the way W-001 made
  every SCAFFOLDED sentence do
- actual: six sentences the framework writes at RUNTIME still did it by
  hand, hardcoding "a" and printing the kind's identifier:
  `this makes a item` (the tooltip on the affordance in the strip — the
  first act a blank app offers), `this is a item` (why an act is offered on
  a selection), `Pump — a work-order` (the chat's one-line account of a
  node), and three checker messages under `field-without-writer`. A
  hyphenated kind came out hyphenated inside an English sentence.
- where it belongs: `packages/tools/src/providers/schema.ts` (two),
  `packages/tools/src/conversation.ts`, `packages/core/src/cli/check.ts`
  (three)
- harness that should have caught it: nothing read the `why` on an
  affordance or the responder's opening sentence for its English; W-001's
  criterion covered the scaffold's output only
- status: fixed in "walkthrough: A · six sentences the framework writes
  about a kind" · all six go through `withArticle`, and the multi-kind
  variant humanises each kind. Criterion added:
  `packages/tools/tests/unit/says-the-kind.test.ts` — a vowel-initial kind
  and a hyphenated one, checking the act's reason, the selection's reason
  and the chat's sentence, plus a source guard that fails on any
  `a ${…kind…}` interpolation anywhere under `packages/*/src`. Verified
  failing without the fix: all four assertions fail and the guard names all
  six sites.

### W-034 · Escape does nothing at all on the first screen of a scaffolded app
- stage: A · face: scene · width: 1280 and 390 · scheme: both
- expected: "Press Escape from every state" — the key backs out one rung at a
  time and never drops a selection while rising
- actual: at altitude it did nothing, in every state, on every press. A
  scaffolded app opens at altitude, so this is the first screen. Traced live:
  six presses at `#overview=1&sel=kind%3Aitem` left the address untouched.
  The ladder checks the overview rung BEFORE the selection, and calls plain
  `go(withOverview(view, false))`; the provider deliberately coerces a
  focusless descent back to the overview ("so Escape at the outermost place
  is a no-op rather than a void" — `packages/react/src/context.tsx`). So the
  rung neither moved nor fell through, and every rung under it — the
  selection, the moves, a raised relation, the focus — was unreachable. The
  altitude CONTROL had the same bug and was fixed for itself (`descentTarget`
  exists for exactly this); `BackOut` was left behind.
- where it belongs: `packages/primitives/src/workbench/index.tsx` (`BackOut`)
- harness that should have caught it: `scripts/verify-navigation.mjs` drives
  `apps/todo`, which opens focused, so the altitude-home case was never a
  state any harness stood in; `pnpm smoke:create` drives a scaffolded app at
  altitude and never pressed Escape there
- status: fixed in "walkthrough: A · the top rung of the ladder swallowed the
  rest" · the overview is a rung only when it is something you climbed TO.
  An app whose home is altitude is already out, so Escape falls through to
  the selection, then the moves, then the relation — and never leaves
  altitude, because leaving would be going further in. An app with an
  in-stack home still descends first, keeping its selection, exactly as
  before. Criteria added:
  `packages/primitives/tests/unit/back-out.test.tsx` (four ladders, both
  kinds of home) and `smoke-create`'s `escapeDoesSomethingFromTheFirstScreen`
  on the scaffolded app in a real browser. Verified failing without the fix:
  two of the four jsdom ladders fail, the in-stack one passes either way
  (so the change is not a regression), and smoke-create reports
  `"escapeDoesSomethingFromTheFirstScreen": false`.

### W-035 · The record page offers the record as the answer to its own edge
- stage: A · face: pages · width: 1280 and 390 · scheme: both
- expected: "Make it depend on something" offers something. The scene gets
  this right — with one item it withholds the connecting act entirely,
  because the derivation drops the subject from its own candidates
- actual: on the pages record, the select listed the record itself, and at
  one item that was the ONLY option. Pressing it ran `link-item` with
  `id === dependsOn`; the act guards against that with a silent `return`, so
  nothing happened — and a line went into the history saying "First thing
  depends on First thing" with an undo beside it. Two causes, one symptom:
  `DerivedForm`'s fallback (used when a page has no affordance to ask) lists
  every node of the kind including the one pinned in `prefilled`, and the
  scaffold's own record page reaches for the act BY NAME and passes no
  candidates — while its own comment claims "everything it shows still comes
  from the same derivations … so a page you write cannot drift from what the
  graph says".
- where it belongs: `packages/pages/src/form.tsx` (the fallback),
  `packages/core/src/scaffold/index.ts` (the record-page template)
- harness that should have caught it: `packages/pages/tests/unit/parity.test.tsx`
  holds the page's FACTS to the scene's, and this was a difference in what
  each face OFFERS; nothing rendered the scaffolded record page at one record
- status: fixed in "walkthrough: A · nothing is its own far end" · the
  fallback drops anything pinned in `prefilled`, so a form about a record
  never offers that record; and the scaffolded page takes the act from
  `facts.actions.affordances` and passes the candidates it narrowed, so at
  one item there is no section at all and at two there is exactly one honest
  option. Criteria added: `packages/pages/tests/unit/its-own-far-end.test.tsx`
  (three cases, including that an unpinned form still lists everything) and a
  scaffold assertion that the generated page uses the derivation and not the
  raw lookup. Verified failing without the fixes: all three fail and name the
  record as its own candidate.

### W-036 · "Close it" stays on the strip of something already closed
- stage: A · face: scene · width: 1280 · scheme: both
- expected: an act offered as one press, with nothing left to ask, does
  something when pressed
- actual: a closed item still offered "Close it". Pressed, nothing changed —
  and the activity rail gained a second "Close First thing" with an undo
  beside it that undid nothing. The op went into the log with
  `primitives: []`, `inverse: []`, `writes: []`: a record that replays to
  nothing on every future load. The same hole was reachable three ways —
  this, an agent calling the act twice, and the self-referential link of
  W-035 whose act guards itself with a silent `return`.
- where it belongs: `packages/tools/src/providers/schema.ts` (offering it)
  and `packages/core/src/store.ts` (recording it)
- harness that should have caught it: nothing pressed an act twice; every
  fixture applied each act once. `packages/tools/tests/unit/ranking.test.ts`
  applied one five times to measure usage and got one op — and passed,
  because it never counted them
- status: fixed in "walkthrough: A · an act that did nothing is not in the
  history" · two halves of one rule. `Store.wouldChange` compiles an act and
  counts what comes out, without snapshotting the graph or re-evaluating the
  rules, so the provider can ask it for every act on every selection; a
  one-press act that would change nothing for any of the selection is not
  offered — an act still holding a question is untouched, because it has not
  been decided yet. And `applyAll` does not write an op with no primitives:
  the call stays legal and still returns, it simply leaves no trace, because
  it left none. `ranking.test.ts`'s fixture now changes something on every
  run, which is what it always meant to be measuring. Criterion added:
  `packages/tools/tests/unit/nothing-left-to-do.test.ts` — seven cases across
  both halves, including a batch where one act acts and one does not.
  Verified failing without the fixes: five of the seven fail.

### W-037 · On a phone the command bar runs off the screen, taking undo with it
- stage: A · face: scene · width: 390 and 320 · scheme: both
- expected: every control the bar offers is on the screen, or can be scrolled
  to
- actual: the bar is one unwrapping flex row inside a wrapper with
  `overflow: hidden`. At 390 the row wanted 649px, so the standing sentence
  was cut and Ask, Activity and the scheme toggle were painted entirely past
  the right edge — measured `standing` 267..432, `chat` 444..513,
  `activity-button` 525..604, `scheme` 616..649 in a 390 window, with
  `document.scrollWidth === 390`: nothing to scroll. On a phone a scaffolded
  app had no undo, no activity rail, no chat and no way back to light, and
  nothing said so. At 320 the wordmark itself was pushed off the LEFT
  (-102..-3).
- where it belongs: `packages/primitives/src/shell.tsx`
- harness that should have caught it: `scripts/audit-ui.mjs`, whose narrow
  screen is 390 wide (W-031) — it counted collisions, small controls, cut
  captions and chrome over content, and never asked whether a control was on
  the screen at all
- status: fixed in "walkthrough: A · a bar that runs off the edge of a
  phone" · the bar wraps, and so does its right-hand group, which as one
  unwrapping unit carried the whole overflow across the edge by itself. The
  height is a minimum on a border-box, so a bar with room is exactly the 57
  it always was; at 390 it becomes three rows and the scene gives up the
  height, the same trade as W-029. Criterion added: audit-ui's
  `N off the edge with nowhere to scroll`, which counts controls painted past
  any edge that no scrollable ancestor can reach — a pane that is its own
  scroll region is a different design, not a defect. Verified failing without
  the fix: `7 off the edge with nowhere to scroll: wordmark at -102..-3`.

### W-038 · Two districts sit on top of each other in a short scene
- stage: A · face: scene · width: any · scheme: both
- expected: the ring at altitude is a ring — no district drawn over another,
  whatever the scene's height
- actual: with an EVEN number of kinds two districts sit directly opposite on
  the ellipse, in the same column, and the vertical radius is the only thing
  holding them apart. An opened district asks for 96 more pixels under the
  near card and took them straight out of that radius: at 320 high with one
  open, `ry` came out under a pixel and all four districts landed in one
  line. In the browser, the seedbed at 390 with a district open drew
  `kind:plot` across `kind:gardener` by 52% of its area — and which one
  answers a click is whichever was drawn second. Found because W-037's fix
  gives the bar three rows on a phone, which took the scene under the
  threshold; it was always there, and an embed the height of a paragraph is a
  short scene on the widest monitor.
- where it belongs: `packages/layout/src/layout.ts` (`ring`)
- harness that should have caught it: `packages/layout/tests/unit/layout.test.ts`
  has a three-kind fixture, and three cards never share a column — the whole
  suite was blind to the case by arithmetic. `audit-ui` counts collisions and
  its narrow screen sat just above the cliff
- status: fixed in "walkthrough: A · the ring has to stay a ring" · the
  listing under an opened district is the luxury and the ring is the picture,
  so the opening gets what is left after the radius has what it needs, rather
  than the other way round; and the radius is measured against the height
  that will be DRAWN — `CARD_MIN_HEIGHT` is now module-scope, because a card
  clamped up to 56 needs more room than the proportional answer asked for.
  Criterion added: a sweep over 13 heights × 3 widths × shut and opened, with
  a FOUR-kind schema, asserting no two districts overlap by even a pixel.
  Verified failing without the fix, at every height from 320 down.

### W-039 · The strip offers answers without ever saying what the question is
- stage: B · face: scene · width: 1280 and 390 · scheme: both
- expected: the ask names what it is asking, in the app's own words, the way
  W-004 made the text field do
- actual: two shapes of ask, one of them mute. Pressing "Hand it to
  someone …" on an item put two bare buttons on the strip — "Ana", "Bo" —
  under no heading, with no `aria-label` and no `title`: what was being asked
  was a guess for anyone looking and nothing at all for anyone listening. The
  strip's whole text for that state was "AnaBo". And where a multi-part ask
  DID name the parameter, the step counter printed the declaration's
  identifier: "label · 1 of 2", the same bug W-004 fixed one element lower
  down (it would read "dependsOn · 1 of 2" on the scaffold's own edge act).
- where it belongs: `packages/primitives/src/workbench/index.tsx`
- harness that should have caught it: `smoke-create`'s `theAskNamesItsFieldInWords`
  reads the strip's `input` — the branch with an input is the branch that was
  already right, and no harness had ever pressed an act whose open argument
  is a node reference
- status: fixed in "walkthrough: B · an ask that says what it is asking" ·
  the question is a named group over the candidates (`role="group"`,
  `aria-labelledby`), each candidate carries it in its own accessible name
  ("Owner: Ana"), and every place the parameter is named goes through
  `humaniseField`. A single text field still names itself and is not given a
  heading saying the same word again. Criterion added:
  `packages/primitives/tests/unit/the-ask-says-what-it-asks.test.tsx` — three
  cases over both branches. Verified failing without the fix: the group is
  absent and the counter reads "label · 1 of 2".

### W-040 · An act offered on the far end of its tie is labelled from the near end
- stage: B · face: both · width: any · scheme: both
- expected: a control that changes the graph says what pressing it would do,
  read from where it is offered
- actual: an act declaring `connects` or `severs` is offered from EITHER
  endpoint — that is deliberate and right, "take this one off the run" is
  the natural thing to say standing on the person. The button there was
  labelled `mutation.title`, which is written from the SUBJECT's side. On the
  owner's record and in the owner's strip, "Hand it to someone" reads as
  handing the owner to someone. The framework's own two example apps had it
  too, found the moment the check existed: todo offered "Move it to another
  list" on a list, seedbed offered "Name a caretaker" on a gardener (where it
  reads as naming hers). Exactly `edge-without-inverse` one layer up — the
  relation carries two readings and the act carried one.
- where it belongs: `packages/core/src/mutations/types.ts` (no way to say
  it), `packages/tools/src/providers/schema.ts` (the label),
  `packages/core/src/cli/check.ts` (nothing warned)
- harness that should have caught it: the far-end offer has been exercised by
  `pnpm menu` and `pnpm seat` since it existed — both read the act's
  IDENTIFIER, never its words, so the sentence on the button was never looked
  at by anything
- status: fixed in "walkthrough: B · an act read from the end it is offered
  at" · `fromTheOtherEnd` on the mutation says how the act reads standing on
  the far end, declared rather than derived for the reason `connects` is: an
  edge's `inverse` gives the relation's two readings but not the verb, and a
  guessed verb on a control that changes the graph is the wrong place to be
  nearly right. Without it the near-end title is still used — an offer that
  disappears is worse — and `graview check` warns
  `act-without-far-end-reading`, naming the end, in the shape
  `edge-without-inverse` already uses. Both example apps now declare theirs,
  and `graview-node-kind` teaches it. Criterion added:
  `packages/tools/tests/unit/from-the-other-end.test.ts` — six cases over the
  label at both ends, the fallback, and the warning (including that an act
  whose two ends are the same kind is never warned about, because it is never
  offered from a far end). Verified failing without the fix.

### W-041 · A record implicated in a broken rule is a shade and nothing else
- stage: C · face: scene · width: any · scheme: both
- expected: the flagged record is marked in the scene, in its district and on
  its pages record — marked, not tinted
- actual: the district's chips get "⚠" in their own label and the routed
  record page carries the rule's sentence. The FOCUSED record — the biggest
  drawing of the same thing, the one you travelled to — was drawn on the
  warning ground and said nothing else: measured, the only difference between
  a broken record and a whole one was `rgb(253, 244, 234)` against
  `rgb(255, 255, 255)`. No words, no mark, nothing in the accessibility tree.
  W-014's shape ("half a lens's emphasis exists only as a colour") one view
  along. The framework's own todo app had it too, in its own `TaskView`.
- where it belongs: `packages/primitives/src/primitives/index.tsx` (the
  `Panel` that carries the tone) and
  `packages/primitives/src/default-views.tsx` (which had the rule's sentence
  available and did not show it)
- harness that should have caught it: `scripts/audit-ui.mjs` has `halfSaid`
  for exactly this class — emphasis painted and not said — and it only ever
  looked at `data-graview-emphasis`, which is the lens's claim, not the
  rule's
- status: fixed in "walkthrough: C · a problem that is only a colour" ·
  `Panel` carries the mark with the tone — a visible ⚠ beside the title and a
  sentence in the accessibility tree — so every view that draws a flagged
  record inherits it, including an app's own, because a contract only some
  views keep is not a contract. The default record view additionally says the
  rule's own sentence, the way the problems page says it. Criterion added:
  audit-ui's `a problem painted but not said`, measured from the app's own
  count of what is broken rather than from the shade, and comparing against
  the theme's warning ground specifically — "not the default ground" catches
  every muted card in the app and says nothing about problems. Verified
  failing without the fix, naming `t-deposit` in `todo/travelled`.

### W-042 · A lens built from the framework's own primitives cannot say what it lights
- stage: D · face: scene · width: any · scheme: both
- expected: `graview-lens` step 5 — "Expose what you decide as
  `data-graview-emphasis` so it can be checked" — is something an app's lens
  can actually do with the primitives the skill points it at
- actual: `Chip` takes a `pickId` and becomes a target; it has no way to say
  its emphasis, and neither has `Roster`, whose `pick` makes every chip a
  target. The three shipped lenses all say it on elements of their own, so
  nothing had noticed. Writing Walk's own lens, the natural primitive for "a
  list of nodes" produced pick targets emphasised by opacity alone — a claim
  about a picture that nothing can check: not a test, not `audit-ui`'s
  `halfSaid`, and not a person reading the tree. A contract only the
  framework's own views can keep is not a contract.
- where it belongs: `packages/primitives/src/primitives/index.tsx`
- harness that should have caught it: `audit-ui`'s `halfSaid` counts marks
  that say it against marks that do not, and every shipped lens says it on
  all of them, so the count was never uneven in any app the harnesses drive
- status: fixed in "walkthrough: D · a mark drawn with the shipped primitives
  can say what it claims" · `ChipProps.emphasis` and a per-item `emphasis` on
  `Roster`'s items, rendered as `data-graview-emphasis`, absent when absent.
  Criterion added: `packages/primitives/tests/unit/a-mark-can-say-so.test.tsx`
  — three cases, including that a roster says it for all its marks or none,
  which is the shape the audit counts. Verified failing without the fix.

### W-043 · The coverage lens reports nothing covered when everything is
- stage: D · face: scene · width: any · scheme: both
- expected: the lens is told which kinds are rows and which are columns, and
  reads the graph
- actual: `buildCoverage` assumed `edge.from` was the column and `edge.to` the
  row. Half of all domains declare the relation the other way round — "an
  item is kept by an owner" runs row → column, "a control mitigates a risk"
  runs column → row — and for those the lens silently dropped every edge. In
  Walk, with three items all handed to owners, the picture read "3 unanswered
  · 3 unasked" and flagged all three owners: a lens stating a falsehood with
  no error anywhere. `graview check` passed, because the binding was not
  wrong — the assumption was. The comment sitting on that code claimed the
  opposite of what the code did: "anything else is a binding mistake rather
  than an empty grid, and saying so beats drawing nothing".
- where it belongs: `packages/primitives/src/lens/coverage.tsx`
- harness that should have caught it: the lens's own unit tests, whose
  fixture declares `mitigates` on the control — column → row, the direction
  the code assumed — so every case in the file agreed with the assumption
- status: fixed in "walkthrough: D · which way the edge runs is something the
  schema already says" · the direction comes from the declaration: whichever
  kind declares `link`, and what it points at, IS the orientation, and an
  edge that does not fit it is still ignored. Guessing per edge would be
  worse — a hand-built illegal edge would then fill a cell and the picture
  would lie about who covers what, which is what the existing "ignores an
  edge pointing the wrong way" case is protecting and which still passes.
  Criterion added: three cases in `coverage.test.tsx` over a second fixture
  whose edge runs row → column, including that the same graph reads the same
  bound either way up, and that a self-referential edge keeps its declared
  reading. Verified failing without the fix.

### W-044 · The survey called the visually-hidden idiom a cut caption, on every screen
- stage: D · face: both · width: 1560 · scheme: both
- expected: `pnpm survey`'s "overflowing" count means a caption with a hard
  edge and text behind it — the thing it says it means
- actual: the 1×1 clip-rect idiom (text present for a screen reader, absent
  to the eye) is BY CONSTRUCTION an element whose content does not fit its
  box, so the wordmark's own `h1` was reported as overflowing on every screen
  of every app: 20 of 26 screens flagged, permanently. A count whose whole
  job is to make one real cut visible had twenty lines of noise in front of
  it. Noticed by adding a second instance of the idiom (W-041's "Implicated
  in a problem"), which took `todo/travelled` from 1 to 2 — the first useful
  thing that count had said in a long time, and it was about my own sentence.
  The idiom was also written out longhand in two places, so there were two
  shapes for one decision and nothing could recognise either.
- where it belongs: `scripts/survey-ui.mjs`, and
  `packages/primitives/src/primitives/index.tsx` (the idiom, written once)
- harness that should have caught it: the survey is the harness; its own
  comment already draws the line — "an ellipsis is a decision; a hard edge
  with text behind it is a bug" — and a clip rect is a decision by exactly
  the same argument
- status: fixed in "walkthrough: D · a clip rect is a decision, not a cut" ·
  `VISUALLY_HIDDEN` is exported from primitives and used by both sites, and
  the survey no longer counts an element whose box is a pixel. Every one of
  the 26 screens is clean. Criterion added: the survey now FAILS on a flag
  rather than printing one — advisory was the only thing it could be while
  twenty screens carried noise, and a count nobody has to read past is a
  count that can be enforced. Verified: with the exclusion removed the gate
  reports "6 of 26 screens clean" and exits 1.

### W-045 · The derived list page offers an act it cannot ask for
- stage: E · face: pages · width: any · scheme: both
- expected: every surface offers what can act, which is what
  `graview-pages` tells an app's own pages to do — "filtering
  `store.allMutations()` by `subject.kinds` yourself looks equivalent and is
  not"
- actual: the framework's own list page did exactly that scan — `creates`
  plus `store.permits` — which answers the permission question and not the
  askability one. A creating act needing a node reference with no candidates
  ("Add an item for someone", with nobody to hand it to yet) is withheld in
  the scene and was offered on the list page as a live form: an empty picker
  with a `required` select, so the one thing anyone could do was press submit
  and be refused for a reason the page already knew. There was also no
  derivation an APP's own list page could ask instead — `recordFacts` wants a
  node id and a list page is about a kind — so the skill's rule was one an
  app could not follow on that surface either. Found writing Walk's design:
  its list pages rendered no acts at all, because `recordFacts(store,
  "kind:item")` is null.
- where it belongs: `packages/pages/src/facts.ts` (nothing to ask),
  `packages/pages/src/pages.tsx` (the scan)
- harness that should have caught it: `pnpm pages` drives the routed face of
  `apps/todo`, whose creating acts all take a label and nothing else — so
  every act in every list page of every fixture happened to be askable
- status: fixed in "walkthrough: E · a list page offers what can act" ·
  `kindFacts(store, kind, options)` is the sibling of `recordFacts` for a
  surface about a kind rather than a node, making the same
  `deriveAffordances` call the scene makes for a selected district. The
  derived list page uses it, and passes the candidates the derivation
  narrowed rather than letting the form list everything; withheld acts come
  from the same set with the policy's own sentence. `graview-pages` teaches
  it. Criterion added:
  `packages/pages/tests/unit/what-begins-a-kind.test.tsx` — four cases,
  including that the page's answer and the scene's are the same answer at
  zero owners and at one. Verified failing without the fix.

### W-046 · Every page of the routed face has a control too small to hit
- stage: E · face: pages · width: 1280 and 390 · scheme: both
- expected: "every link and button is at least 24px" — the WCAG 2.2 minimum
  `audit-ui` has counted on the scene's screens since it existed
- actual: two, in the framework's own pages, in every app. "Start fresh" is
  inline text in the footer of EVERY page of the routed face: measured 62×15.
  And `pageStyles.plain` — the same link as `pageStyles.link` without the
  underline, used for the record page's eyebrow, the list's rows and the
  masthead — carried no minimum at all, so the derived record page had a
  44×19 link back to its own list. One site had already patched the minimum
  back in by hand, which is a style saying where it should have lived.
- where it belongs: `packages/pages/src/pages.tsx`
- harness that should have caught it: `audit-ui` measures exactly this and
  runs on the scene only; `pnpm pages` drives the routed face at phone width
  and checked side-scroll, headings, link names and labelled inputs — never a
  control's size
- status: fixed in "walkthrough: E · a control on a page is a target too" ·
  `StartFreshLink` and `pageStyles.plain` both carry the 24px minimum, and
  the hand-patched site drops its duplicate. Criterion added:
  `verify-pages.mjs`'s `bigEnoughToHit`, which names what it found rather
  than answering true or false — a bare `false` on a page with forty controls
  tells you nothing — and fails the harness on a non-empty list. Verified
  failing without the fix: "Start fresh" 62×15 on all three pages, plus
  "Tasks" 44×19 on the record.

### W-047 · The interface asks "may I?" of nobody, and is told yes
- stage: F · face: pages (and any surface that does not thread a principal) ·
  width: any · scheme: both
- expected: what a face offers is what the store would accept — the whole
  reason `graview-permissions` says "the narrowing happens once, in
  `deriveAffordances`"
- actual: `deriveAffordances` SKIPPED the permission check entirely when no
  principal was passed (`options.principal ? store.permits(...) : { ok:
  true }`). `store.permits` and `applyAll` both default to `{ kind: "human" }`
  and fail CLOSED; this failed open. So with a policy declared and no
  principal threaded, the routed face offered every act and the store refused
  every one on press with `PermissionDeniedError`. Measured in Walk the
  moment the policy existed: the scene said "Nothing you may do with an item
  — 1 action withheld. Add an item — Not permitted: add-item — keeper can",
  and the same app's list page rendered "Add an item" as a live form. The
  scene was right only because the React provider defaults the principal to
  that same anonymous human; nothing else does.
- where it belongs: `packages/tools/src/derive.ts`
- harness that should have caught it: `pnpm seat` drives permissions through
  a principal that is always supplied, and every fixture with a policy passes
  one — permission opt-in made the shortcut agree with the store in every app
  that had not declared a policy yet, which is every app any harness drives
  on its pages face
- status: fixed in "walkthrough: F · asked as somebody, always" · the
  derivation asks as `{ kind: "human" }` when nobody is named, which is the
  principal the store already assumes, so the two cannot disagree. Opt-in is
  untouched: with no policy that principal may do everything. Criterion
  added: `packages/tools/tests/unit/asked-as-somebody.test.ts` — four cases
  including that the derivation and `store.apply` agree, and that an app with
  no policy still offers everything. Verified failing without the fix.

### W-048 · The agent-seat skill's own example does not compile
- stage: F · face: neither — the skills
- expected: an agent following a skill verbatim gets working code; the skill
  is the contract the walkthrough is testing
- actual: `graview-agent-seat` says to prove the two paths are one path with
  `expect(byAgent.diff).toEqual(byHand.diff)`. `ToolResult` is a union —
  a refusal is a result — so `.diff` does not exist on the arm the compiler
  has to consider, and the test the skill asks for fails to typecheck in any
  TypeScript project. Found by writing exactly that test in Walk: `Property
  'diff' does not exist on type '{ readonly ok: false; readonly error:
  string; }'`. Same class as W-021, a project that cannot follow its own
  skill.
- where it belongs: `packages/skills/skills/graview-agent-seat/SKILL.md`
- harness that should have caught it: `packages/skills/tests/unit/skills.test.ts`
  asserts about the prose — that each skill ends in a real verdict, and that
  any finding code it names is one the checker emits — and nothing about
  whether its code is code
- status: fixed in "walkthrough: F · a skill's code is code" · the example
  narrows the result first, and says why. Criterion added: a skills assertion
  that every awaited `.call(...)` result is narrowed on `.ok` before anything
  is read through it — the shape that recurs, rather than this one line.
  Verified failing without the fix, naming the skill and the property.

### W-049 · A refused undo shows the validator's JSON to the person who pressed it
- stage: G · face: scene · width: any · scheme: both
- expected: an undo the declaration will not have says why, in the app's own
  words — W-025 built the mechanism and put the sentence in the activity rail
- actual: the sentence it puts there was
  `Node "item:pay-the-deposit" (item) does not match its declared fields [ {
  "code": "invalid_value", "values": [ "whenever", "soon" ], "path": [
  "urgency" ], "message": "Invalid option: expected one of \"whenever\"|
  \"soon\"" } ]` — the validator's whole issue list as JSON, rendered verbatim
  beside a row about a thing called "Pay the deposit", with the node named by
  its address. Reached by exactly the path stage G asks for: bump the version,
  add a migration that fills in a new required field, reload against the old
  store, press undo on the migration.
- where it belongs: `packages/core/src/graph/graph.ts`
- harness that should have caught it: `packages/primitives/tests/unit/undo-turn.test.tsx`
  is W-025's own criterion and asserted the message was PRESENT
  (`toContain("does not match its declared fields")`) — the half of the
  sentence written by a person — and said nothing about the half written by
  Zod
- status: fixed in "walkthrough: G · a refusal a person can read" · the node
  is named by its label, the kind is said plainly, and each of the
  validator's issues becomes `<Field in words>: <its own sentence>` — every
  issue already carries a readable message and the path it is about; nothing
  else in that object is for a person. Criteria extended: both tests now
  assert the node's NAME, the field humanised, and that no issue object,
  code or path appears. Verified failing without the fix.

### W-050 · The reader's own text size never reaches the app
- stage: I · face: both · width: any · scheme: both
- expected: stage I's "text zoom to 200% — the root font size, not page zoom,
  which is a scale factor and proves nothing about reflow" is a criterion
  that can fail
- actual: the theme pinned the base to `font: 14px/1.55` and every one of the
  120 font sizes under it across primitives, pages and react was an absolute
  pixel count — zero rem anywhere. Measured with the root at 32px: the body
  stayed at 14 and a heading at 28. So somebody who sets a larger default
  font in their browser, which is the setting WCAG 1.4.4 is about, got a
  Graview that ignored them completely — and stage I passed by nothing
  changing, which is a criterion that cannot fail rather than a property that
  holds. The first walk ran this stage and recorded a pass.
- where it belongs: `packages/primitives/src/theme.ts` (the base) and the 120
  sites under it in `packages/{primitives,pages,react}/src`
- harness that should have caught it: nothing drove any face at a root font
  size other than the default, and `audit-ui`'s and `survey`'s counts are all
  taken at 16px
- status: fixed in "walkthrough: I · the reader's own text size" · the base is
  `0.875rem/1.55` and every font size is a rem of the same value. 0.875rem is
  14px at the default 16px root, so nothing moves for anyone who has not
  asked for anything — `audit-ui` (10 of 10) and `survey` (26 of 26) are
  unchanged by it, which is the evidence that the conversion is exact. At a
  32px root the app now scales, and the 320-wide, reduced-motion and
  200%-text sweeps are clean across every route of both faces and the embed.
  Criterion added:
  `packages/primitives/tests/unit/the-readers-own-text-size.test.ts` — the
  theme's base is relative, and no face sizes text in absolute pixels.
  Verified failing without the fix, naming all 120 sites.

## The third walk (2026-09-11)

Nineteen findings, W-051 to W-069, across the setup and all nine stages —
every one fixed in a framework package and covered by a criterion verified
to fail without the fix. So the third walk did NOT leave the log still
either, and a fourth is owed.

No stage added nothing. The two that had been quiet in the second walk —
H, and the embed half of F — each produced one.

The shapes, in the order of how much they cost:

- **A criterion that could not fail.** Again the largest class, and worse
  than it looked: `halfSaid` had never seen a lens (W-060), `small` had
  never seen the activity rail (W-052), no audit state had ever had an ask
  open (W-051), every one of `verify-remember`'s thirteen claims was about
  a change made BEFORE the reload (W-059), `aGardenerIsRefusedInChapterSeven`
  was at its happiest when the seat could do nothing at all (W-064), and
  nothing anywhere rendered a page at a bigger root font (W-068) — which,
  once it did, found a second defect in the framework's own pages (W-069).
- **One engine's verdict taken for three.** Every keyboard assertion the
  framework makes runs in Chromium, and `pnpm engines` — the only harness
  that opens WebKit or Firefox — pressed no keys and was not in the
  playbook's own end-of-stage list. WebKit stranded the keyboard entirely
  (W-066) and undersized every picker on the routed face (W-067).
- **A fix that landed on one surface.** `StartFreshLink` got a hit target in
  the pages package and the scene's copy stayed 16px (W-052); `formFields`
  names a picker by what it picks and the strip named it by the argument
  (W-056); `recordFacts` reads every edge and the scaffold's own page read
  one by name (W-054); the derived record page strikes withheld acts through
  and the page the scaffolder WRITES dropped them (W-062); `PageMain`
  renders an unnamed region inside an embed and the design a reader copies
  named it (W-065).
- **Asking permission as nobody.** The undo control (W-063) and seedbed's
  whole scene from chapter seven on (W-064) — in both cases the principal
  existed, was correct, and was not passed.
- **A stop that outlived what it named.** A severed relation still selected,
  a dropped record still selected, and — the only crash of the walk — a
  dropped record still FOCUSED, which blanked the page (W-055).

### W-051 · The ask you open is drawn off the side of the pane, or below it
- stage: A · face: scene · width: 1280 and 390 · scheme: both
- expected: "the inspector, menu and strip stay inside the scene's box" — and
  what is inside them stays inside them. Pressing an act that still needs
  something shows you the thing it needs.
- actual: two shapes of the same failure, both reached by the first act the
  scaffolded app offers on a record ("Change the item …", the derived edit).
  At 1280 the pane is a 236-wide rail and the ask laid out at 257: the grid
  track under it is `auto`, whose minimum is the min-content width of a text
  input plus an Apply plus a Skip, so the track grew past the pane and the
  Skip button was painted half-on, half-off its right edge — reachable only
  by scrolling a pane that shows no horizontal scrollbar. At 390 the pane is
  a sheet along the bottom with `max-height: min(42cqh, 300px)`, the ask
  opened under a list of acts already filling it, and the field, the Apply
  and the Skip were all below the sheet's fold AND below the window: the
  person pressed a button and, as far as the screen showed, nothing
  happened. The field even had `autoFocus`, so the keyboard was in a box
  nobody could see.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`AnswerArgs` — the grid it lays the ask out in, and its silence about
  having opened)
- harness that should have caught it: `scripts/audit-ui.mjs` — no criterion.
  Twelve screens and not one of them had an ask open: every state pressed
  acts that need nothing, so the pane's hardest layout was never measured.
- status: fixed in "walkthrough: A · an ask that fits the pane it opens in" ·
  the track is `minmax(0, 1fr)` so it can never be wider than the pane (the
  input already carries `minWidth: 0`, so it is the thing that gives), the
  row wraps rather than squeezing the field to nothing, and the ask scrolls
  itself into view on open — `block: "nearest"`, which moves the pane the
  least amount that works. Criterion added: `audit-ui`'s `asking` — an ask
  marks itself `data-graview-asking`, and every control inside one must be
  within the box that clips it, with no scrolling. Two states added to reach
  it: `todo/asked` and `seedbed/asked`, plus `seedbed/askedNarrow` at 390.
  Verified failing without the fix: `seedbed/asked` reports the Skip at
  222..271 outside a pane ending at 250, and `seedbed/askedNarrow` reports
  all three controls at 651..683 outside a sheet ending at 610.

### W-052 · The rail's undo and its way out of a remembered store are too small to hit
- stage: A · face: scene · width: 1280 and 390 · scheme: both
- expected: no control under 24px, which the framework already counts
- actual: the activity rail holds exactly two controls, and both were under
  it: `undo` at 38x18 (11px text in one pixel of vertical padding) and
  "Start fresh" at 50x16 (an inline anchor with no box of its own). They are
  the only way to take a turn back and the only way out of a store the
  browser remembers. The routed face's copy of the same link was fixed for
  exactly this in W-046, with the comment still on it — the fix landed on
  one face and the other kept the 16-pixel link.
- where it belongs: `packages/primitives/src/workbench/index.tsx` (`UndoTurn`
  and `StartFresh`)
- harness that should have caught it: `scripts/audit-ui.mjs` — the `small`
  criterion has counted controls under 24px since W-046, and no screen it
  takes had the rail open. Two states opened it on the way to something else
  (`seedbed/narrow`, `seedbed/planted`) and pressed Escape before the count
  was taken, so the rail was measured shut fourteen times.
- status: fixed in "walkthrough: A · a rail you can hit" · both are
  `inline-flex` with `minHeight`/`minWidth` 24, which is what
  `StartFreshLink` in `@graview/pages` already was. Criterion added:
  `audit-ui`'s `todo/activity` state — act once, then open the rail, and
  count. Verified failing without the fix: `2 controls under 24px`, named as
  `undo 38x18` and `Start fresh 50x16`.

### W-053 · Every act taken from the keyboard ends at the top of the document
- stage: A · face: scene · width: any · scheme: both
- expected: "keyboard alone can do everything above" — and doing it leaves
  you where you were, the way pressing a button on the routed face does
- actual: focus went to `<body>` after every act. The pane is a live list:
  an act applies and leaves it, a pin regroups it into a new section, an ask
  closes when it is answered — and React takes focus to the document with an
  element it unmounts. So somebody working from the keyboard pressed Enter
  on "Close it" and landed on nothing, six tabs from where they had been,
  once per act. Measured in the scaffolded app: `Close it` → BODY, the pin
  → BODY, and applying the derived edit's ask → BODY. The routed face does
  not do this — its forms stay mounted and focus stays on the submit button
  — so the two faces disagreed about what pressing a button does.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`Inspector` — nothing in the file managed focus at all)
- harness that should have caught it: `scripts/verify-menu.mjs` drives this
  exact pane in a real browser and presses Enter in it (`searchThenApply`,
  `destructiveNeedsTheClick`), and asked only what the graph said afterwards,
  never where the keyboard was left
- status: fixed in "walkthrough: A · the keyboard keeps its place" · the pane
  remembers WHICH ACT the keyboard was on — an ask's controls count as the
  act above them — and when the element goes away underneath it, puts focus
  back on the same act, or on the same pin, or on the pane itself when the
  act is no longer offered. `relatedTarget` separates the two cases: tabbing
  away is leaving on purpose and is never undone. Criterion added:
  `verify-menu`'s `theKeyboardKeepsItsPlace` — three presses from the
  keyboard (an act, a pin, an ask answered to the end), focus inside the
  pane after each. Verified failing without the fix: all three report
  `"where": "body"`.

### W-054 · Following the next skill silently empties the page the last one wrote
- stage: B · face: pages · width: any · scheme: both
- expected: `graview-node-kind` says to declare a second kind and an edge to
  it; the record page then says so, the way every derived surface does. The
  scaffolded page's own comment promises it: "everything it shows still comes
  from the same derivations, so a page you write cannot drift from what the
  graph says."
- actual: it drifts. The page the scaffolder writes reads one edge by name —
  `store.graph.out(id, "depends-on")` — into a hand-written sentence, and
  finds one act by name, `link-<kind>`. So after declaring `person` and a
  `handled-by` edge and handing "Pay the deposit" to Ada Nowak exactly as the
  skill describes, the item's own record page said "Still open. Depends on
  nothing." and offered one form: no mention of Ada, no way to hand it to
  anyone, and no way to take it back. The DERIVED page on the other end of
  the same edge had it right ("What they are seeing to → Pay the deposit"),
  which is the whole point: the one surface a project is invited to write
  was the one that could not keep up. W-035 fixed the same page's ACT for
  exactly this reason and left its TIES alone.
- where it belongs: `packages/core/src/scaffold/index.ts` (`pagesTsx`)
- harness that should have caught it: W-035's own criterion in
  `packages/core/tests/unit/scaffold.test.ts` — "takes the act it offers from
  the derivation" — asserted the affordance lookup and said nothing about
  the graph read beside it; and nothing anywhere declares a second kind in a
  scaffolded project, so no harness had ever grown one
- status: fixed in "walkthrough: B · a page that grows with the declaration"
  · the page renders `facts.links` — every edge, both directions, each with
  the caption the declaration gives THAT end — and offers every affordance
  with `ties`, prefilled from `affordance.args` rather than a subject name
  written out by hand. Criteria: W-035's test extended to the filter and the
  derived prefill, plus a new one, "reads its ties and its acts from the
  declaration, naming neither by hand", which reads the generated file with
  its comments stripped and refuses `"depends-on"`, `"link-item"` and
  `graph.out(`. Verified failing against the old template: both tests fail,
  naming `facts.links` and `facts.actions.affordances.filter(`.

### W-055 · An act that removes what you are standing in leaves a stop about nothing, and blanks the page
- stage: B · face: scene · width: any · scheme: both
- expected: severing a relation removes exactly that line, and the interface
  goes on being an interface
- actual: three faces of one defect, all reached by acts the declaration
  offers. Every stop is an id in the address, and nothing ever resolved those
  ids against the graph again.
  1. **A severed relation still selected.** Sever "Pay the deposit is handled
     by Ada Nowak" from the line's own menu and the pane stays open about it —
     the caption, both ends, and "Take it back from" offered again. Pressing
     it says `Cannot remove missing edge handled-by item:pay-the-deposit
     person:ada-nowak` — the graph's internal sentence, with both node
     addresses in it, in front of the person who pressed the button.
  2. **A dropped record still selected.** In the framework's own todo app,
     dropping a selected task leaves its pane titled `t-book` — the raw node
     id, because the label helper has no node to ask — over the sentence
     "Nothing can be done with this mix of kinds yet".
  3. **A dropped record still FOCUSED blanks the app.** Travel into a task,
     drop it: `Maximum update depth exceeded`, `#root` emptied, a white
     screen. The cause is a second bug the first one exposes — the view host
     measures `host.firstElementChild` to place its kind tag, and with the
     view rendering nothing the tag is the only child, so the measurement
     reads its own output and moves the tag nine pixels up and fourteen
     right on every render until React gives up. Fifty renders, one press.
- where it belongs: `packages/react/src/context.tsx` (the stop is resolved
  only at navigation time) and `packages/react/src/scene.tsx`
  (`SceneViewHost` — a measurement that can read its own output)
- harness that should have caught it: `scripts/verify-navigation.mjs` walks
  every stop in a real browser and never took one that an act had removed;
  it also did not watch for page errors, so a blank page would have passed
  every assertion it makes about addresses
- status: fixed in "walkthrough: B · a stop you can still stand on" · the
  stop is resolved on the way OUT as well as in — every render prunes a
  selection and a focus the graph no longer has, so the very render that
  reports the removal has already left the address somewhere real (a kind
  card and a group are not nodes and always stand). And the tag measures the
  first child that is not the tag, so a view with nothing to draw moves
  nothing. Criteria added:
  `packages/react/tests/unit/a-stop-that-still-exists.test.tsx` — four
  ladders (a removed record selected, a severed relation selected, the
  removed record you were focused on, and a kind card, which stays) — and
  `verify-navigation`'s `theStopSurvivesWhatItNames`, which travels into a
  task, drops it, and asks where it landed, how many views are on screen and
  whether the pane is gone; that harness now also fails on any page error.
  Verified failing without the fix: three of the four unit ladders, and the
  browser criterion reports `landedOn` unchanged, `views: 0` and the
  "Maximum update depth exceeded" error. One existing test needed its setup
  corrected: `edge-inspector`'s "no mutation claims the edge kind" case
  selected a line in an EMPTY store, which only rendered at all while a stop
  could name what was not there.

### W-056 · An act offered from the far end asks for its subject by the word "Id"
- stage: B · face: scene · width: any · scheme: both
- expected: "the connecting act offers only candidates not already
  connected" — and says what it is asking for, which W-039 established
- actual: standing on Ada Nowak, "Hand one back …" opened its ask under the
  heading **"Id"**, over a list of items. The open argument there is the
  act's SUBJECT, and every scaffolded app names that argument `id` — the
  scaffold's own mutations do, and so does every example in
  `graview-node-kind` — so this is what the far end of every tie in every
  new project says. The routed face gets it right on the same act, and has
  the rule written down in `formFields`: "A node picker is labelled by what
  it PICKS — 'List', not 'List id': the argument's name is an implementation
  detail, and the kinds it accepts are the declaration's own word for the
  thing." The strip had `humaniseField(parameter.name)` and nothing else.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`AnswerArgs`)
- harness that should have caught it: W-039's own criterion,
  `packages/primitives/tests/unit/the-ask-says-what-it-asks.test.tsx`,
  asserts the heading over a picker is "Owner" — for an argument called
  `owner` picking an `owner`, where the identifier and the kind are the same
  word, so it could not tell which of the two was being read
- status: fixed in "walkthrough: B · a picker named by what it picks" · a
  parameter that names node kinds is asked for by those kinds, exactly as
  the routed face does it; anything else is still the humanised argument.
  Criterion added to the same file: "names a node picker by what it picks,
  never by the argument" — the act pressed from the far end, where the open
  argument is `id` and the kinds are `item`. Verified failing without the
  fix: `expected 'Id' to be 'Item'`.

### W-057 · The seat promises repairs and offers none
- stage: C · face: scene · width: any · scheme: both
- expected: the repair is "an ask when it needs one thing, and never a
  refusal on press" — on every surface, the seat included
- actual: asked "what's wrong?", the seat answered `1 problem: Pay the
  deposit is open and nobody is seeing to it. The repairs below come from
  the rules themselves.` — with nothing below it. The sentence is written
  unconditionally, and the proposals are `readyRepairs`, which deliberately
  drops every repair that still needs an argument: a seat may not guess
  which person, and the rule declined to choose for exactly that reason. So
  the one rule shape stage C asks for — "a repair that names an act and
  leaves one argument to be asked for" — is the shape that makes the seat
  promise something it has not got.
- where it belongs: `packages/tools/src/conversation.ts`
- harness that should have caught it: `scripts/verify-chat.mjs`'s
  `problemsProposeRepairs` and the unit test beside it both drive `apps/todo`,
  whose every repair is complete, so the branch where none survive the filter
  had never been asked a question
- status: fixed in "walkthrough: C · a seat that says what the repair wants"
  · the sentence is chosen from what is actually below it: the repairs when
  there are any, otherwise what they still want — "The rules name a way to
  fix it, but it needs a person chosen — select the record and its own
  actions will ask" — and "No rule here names a way to fix it" when there
  are no repairs at all. What it wants is said the way every picker in the
  framework is named, by the KIND it picks, so the seat says "a person"
  where the argument is called `handler` (the same rule as W-056, one layer
  up). Criterion added to
  `packages/tools/tests/unit/conversation.test.ts`: "says what a repair
  still wants, rather than promising repairs it has none of". Verified
  failing without the fix.

### W-058 · The rail says what an agent did by the name the mutation is registered under
- stage: C · face: scene · width: any · scheme: both
- expected: the record of what the seat just did reads like the rest of the
  interface — an act by its own title
- actual: `changed · close-item`. The activity rail lists every call a seat
  makes as `{changed|read} · {call.name}`, and `call.name` is the tool
  surface's identifier. So the one place a person looks to see what an agent
  did printed the schema: `changed · close-item`, `read · get_violations`,
  `changed · reschedule` in the framework's own todo app. Every act carries
  a `title` the strip, the pages and the agent's own tool description all
  use.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`ActivityRail`, the calls list)
- harness that should have caught it: `scripts/verify-seat.mjs` presses the
  seat and then reads the rail — for the signature on the ops and for the
  seat's own label, never for the call rows between them
- status: fixed in "walkthrough: C · what the agent did, in the act's own
  words" · the declared mutation's `title`, falling back to the humanised
  name for a read tool that is not a mutation. Criterion added to
  `verify-seat`: "the rail says what the act is called, not what it is
  registered as" — every call row must begin with a capital and carry no
  hyphen or underscore. Verified failing without the fix: `reschedule |
  get_violations`.

### W-059 · Everything done on the second visit is filed under the first turn ever taken
- stage: C · face: both · width: any · scheme: both
- expected: "repairing from the scene, from the pages and from the agent's
  seat each leave one op in the log with the right author; undo takes it
  back". Reached by the ordinary path: repair, then reload, then act again.
- actual: a `Store` hydrated from a log starts BOTH its id counters at zero
  — `private counter = 0` for batches, `let n = 0` for ops — whatever
  history it was handed. So the first change after a reload is minted `op1`
  in `batch:1`, ids the log already holds, and `batches()` groups by batch
  id: the new work joins the FIRST turn the app ever took. In the walked
  app: seed two records, reload, close one — the activity rail still said
  "2 Activity" and listed the two original turns, with the third change
  invisible and `undo +1` appearing on rows that had needed no such thing.
  Measured at the core: a store hydrated from a two-batch log reports two
  batches after a third change, and `log.get(id)` answers with the older of
  two ops sharing an id. In the framework's own todo app, a rename on the
  second visit is listed under `Rename to "Pay the deposit, on the first
  visit"` with the new name beside it. Undoing that turn would have taken
  the newer change with it.
- where it belongs: `packages/core/src/store.ts` (the constructor)
- harness that should have caught it: `scripts/verify-remember.mjs` is
  entirely about this — it reloads, reads the rail, and undoes from it — but
  every one of its thirteen claims is about a change made BEFORE the reload.
  Nothing ever made a change after one.
- status: fixed in "walkthrough: C · a store that counts on from its own
  log" · a hydrated store winds both default generators past the highest
  number the log already uses, so the next turn is a new one. Only the
  DEFAULT generators move; an app that supplies its own `ids` owns their
  uniqueness. Criteria added: three ladders in
  `packages/core/tests/unit/op-log.test.ts` ("a store hydrated from a log" —
  new work in a turn of its own, unique op and batch ids, and an undo that
  takes back only what it names), and `verify-remember`'s
  `aChangeOnTheSecondVisitIsATurnOfItsOwn`, which visits twice in one
  browser and reads the rail. Verified failing without the fix: all three
  unit ladders, and the browser criterion reports one row where there
  should be two, still titled `Rename to "Pay the deposit, on the first
  visit"` with "on the second" beside it.

### W-060 · Half the board lens's marks say nothing about the selection
- stage: D · face: scene · width: 1280 and 390 · scheme: both
- expected: "every mark the lens draws is a pick target; selection lights it
  and dims the rest, and the DOM says so (`data-graview-emphasis`)" — the
  rule `graview-lens` gives an app, and W-014's own criterion
- actual: in the framework's own board lens, three kinds of mark carry
  `data-graview-pick` and only one of them said anything: the slot's disc.
  The NAMES under a slot holding several occupants (each its own target
  since the fan-out fix), the bench's chips ("Not in"), and every row of the
  key that names the flagged slots were all emphasised by opacity alone.
  `audit-ui`'s `halfSaid` reports `aggregate:plot: 1 of 2 marks` the moment
  a screen is taken at the lens — which is a claim about a picture that
  nothing could check, in the framework's own worked example of the
  authoring API.
- where it belongs: `packages/primitives/src/lens/board.tsx`
- harness that should have caught it: `scripts/audit-ui.mjs`'s `halfSaid`,
  which exists for exactly this and has since W-014. Every state it takes
  reached a picture by focusing a group or travelling; not one of them was
  AT a lens, so the two lenses registered with a title — what
  `graview-lens` tells an app to write — had never been on a screen it
  measured.
- status: fixed in "walkthrough: D · every mark in a lens says what it
  claims" · all three now carry the emphasis the disc has carried since
  W-014. Criterion added: `audit-ui`'s `seedbed/lens` state, which presses
  the place by name and takes the count there. Verified failing without the
  fix: `emphasis painted but not said: aggregate:plot: 1 of 2 marks`.
  The same state also showed `repeats: What grows where x2` — the place's
  pill and the picture's own heading, which is the breadcrumb-beside-a-
  heading pairing the check already exempts for the crumb and the raised
  chip; the exemption now covers a place whose picture is on the screen,
  asked of the PICTURE rather than of the pill, because the pill is
  deliberately unpressed from altitude while the scaled picture still
  carries its name.

### W-061 · A design's own shell gets a second main under it, on every route it did not replace
- stage: E · face: pages · width: any · scheme: both
- expected: "a custom page … uses `PageMain` so an embedded copy has one
  main", and `graview-pages` on a product design: "Keep landmarks and targets
  honest. One `main` (a `section` when `context.embedded`)."
- actual: two. A design registers a `shell` surface and renders the
  document's `main` in it, exactly as the skill says — and every page the
  framework still supplies underneath goes on wrapping itself in `PageMain`,
  which renders a `main` of its own. Measured on the walked app's own design
  at `/pages/nowhere`: `mains=2`. It is not only the odd route: with a shell
  registered, the DERIVED home is a main inside a main, and so is every kind
  a design has not replaced yet — which is every design on its way to being
  finished, and the not-found page in every finished one, because there is no
  kind to register that page on.
- where it belongs: `packages/pages/src/router.tsx` and
  `packages/pages/src/pages.tsx` (`PageMain`)
- harness that should have caught it: `apps/seedbed/tests/integration/
  chapters.test.ts` renders chapter thirteen — a design with every surface
  replaced — and asserts its own testids and the absence of the derived
  face's `aria-label="Kinds"`, never how many landmarks came out; nothing
  anywhere rendered a route a design had left alone
- status: fixed in "walkthrough: E · a shell that owns its own landmark" ·
  the registry already knows whether a shell was registered, so the router
  marks the context `framed` and `PageMain` renders a region under it — the
  same answer it already gives inside an embed, to the same question: does
  somebody above me own the landmark. Criterion added:
  `packages/pages/tests/unit/one-main-under-a-shell.test.tsx` — six routes
  under a design that replaces one kind and leaves the other, the derived
  face with no shell, an embedded face, and `PageMain` itself. Verified
  failing without the fix: `/: expected 2 to be 1`.

### W-062 · The page the scaffolder writes hides what a seat may not do
- stage: F · face: pages · width: any · scheme: both
- expected: `graview-permissions`' second inviolable — "An action you may not
  take should SAY SO rather than vanish. Hiding it teaches people the
  software is broken: they watched a colleague do this yesterday and now the
  button is gone" — and `graview-pages` saying the same twice, for a page at
  rung one ("draw the act struck through with `verdict.refusal.message`")
  and for a design at rung two ("Withhold, do not hide")
- actual: the record page the scaffolder writes reads
  `facts.actions.affordances` and never `facts.actions.withheld`. Declare a
  policy — the next skill in the set — and whole sections of that page
  vanish for the narrower seat with nothing said: as the keeper it carried
  "Depends on" with its form; as the helper the heading, the form and the
  reason were all simply absent. The DERIVED record page beside it has always
  struck them through with the policy's sentence, so the framework got this
  right on the page it renders and wrong on the page it writes for you —
  which is the one every project starts from.
- where it belongs: `packages/core/src/scaffold/index.ts` (`pagesTsx`)
- harness that should have caught it: nothing scaffolds a project WITH a
  policy. `smoke:create` walks a scaffolded app end to end and its projects
  have no policy at all, so every act in them is permitted and the withheld
  branch has never existed to be looked at.
- status: fixed in "walkthrough: F · a page that says what it will not do" ·
  the generated page renders `facts.actions.withheld` struck through with
  `withheld.refusal.message`, in the same shape the derived page uses.
  Criterion added to `packages/core/tests/unit/scaffold.test.ts`: "says what
  a seat may not do rather than dropping it". Verified failing without the
  fix. Seen in the walked app: as the helper the page now reads "~~Close
  it~~ — Not permitted: close-item on an item — keeper can." where before it
  showed nothing at all.

### W-063 · Nobody can take back their own edit once an app has a policy
- stage: G · face: scene · width: any · scheme: both
- expected: "undo takes it back and the problem returns" — stage C's words,
  and `graview-permissions`' own: "Undo is a change and is judged like one:
  what you may undo is what you may have done."
- actual: it is judged like one, and the control never says who is asking.
  `UndoTurn` called `store.undo(batch)` with no author at all, so the store
  judged the default anonymous principal — who, once a policy exists, may do
  nothing. In the walked app: add an item as the keeper, open the rail, and
  the row says `you Add an item`; press the undo beside it and it answers
  `Not permitted to undo "Add an item": Not permitted: add-item — one of
  helper, keeper can.` The op said "you" and the undo of it was refused for
  being nobody. Every act taken from the strip has passed the provider's
  principal since it was written ("The principal, not a bare 'human': the
  store enforces against this and the log attributes to it, and they must be
  one object" — `useApplyAffordance`); the undo beside them did not.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`UndoTurn`)
- harness that should have caught it: `scripts/verify-remember.mjs` presses
  this exact control twice and `packages/primitives/tests/unit/
  undo-turn.test.tsx` renders it — and every app either of them drives is
  policy-free, so the store had nothing to refuse
- status: fixed in "walkthrough: G · an undo that says who is undoing" · the
  control passes the provider's principal, exactly as every act does.
  Criteria added: `undo-turn.test.tsx`'s "undoes as the person at the
  keyboard, not as nobody" — a store with a policy, a principal at the
  keyboard, the turn actually coming off and the undo attributed to the same
  person — and `verify-seat`'s "a person can take back their own edit where
  there is a policy", driving seedbed's seventh chapter in a browser.
  Verified failing without the fix.

### W-064 · From chapter seven on, the framework's own progression shows a reader who may do nothing
- stage: G · face: scene · width: any · scheme: both
- expected: chapter seven's own claim — "One policy, declared once. The
  store refuses, the actions strip narrows, and an agent's seat narrows with
  it, so a gardener never sees a button that would fail."
- actual: the gardener sees nothing but buttons that would fail. The
  chapter's principal reaches the store (`storeOptions`) and the routed face
  (`PagesApp context`) and never the scene: `SeedbedApp` takes no principal
  and `GraviewProvider` defaults to anonymous, who under a policy may do
  nothing. So chapters 7, 8, 10, 11 and 12 — every scene chapter after the
  policy arrives, and the pictures `pnpm progression` publishes as the
  framework's own story — showed every act struck through, several of them
  refusing the seat for the role it holds: `Not permitted: tend — one of
  coordinator, gardener can`, said to a gardener.
- where it belongs: `apps/seedbed/src/ui/app.tsx` and
  `apps/seedbed/src/main.tsx`
- harness that should have caught it: `scripts/progression.mjs`'s
  `aGardenerIsRefusedInChapterSeven`, which asks whether anything at all was
  withheld — and everything was, so the criterion was at its happiest in the
  broken state. It also read only the screen the chapter's picture is taken
  on, a district whose creating act a gardener may legitimately not take.
- status: fixed in "walkthrough: G · a chapter whose seat is at the
  keyboard" · `SeedbedApp` takes the principal and hands it to the provider,
  as the routed face already did. Criterion added: `progression`'s
  `theSeatIsNeverRefusedByItsOwnRole`, which selects a MEMBER in every
  chapter that declares a principal and asks two things of what it finds —
  that the seat is offered something, and that no refusal names a role the
  seat already holds. Verified failing without the fix, with five chapters
  reporting `offered: []` and refusals reading "one of coordinator, gardener
  can" to a gardener.

### W-065 · Two embeds of one design are two regions with the same name
- stage: H · face: pages · width: any · scheme: both
- expected: "two embeds have two landmark names", and `graview-pages`' own
  rule for a design: "Keep landmarks and targets honest. One `main` (a
  `section` when `context.embedded`)"
- actual: three names for two embeds, two of them identical. A design's shell
  renders the landmark itself — a `main` standing alone, a `section` inside
  an embed — and the worked example NAMES that section (`aria-label="The
  garden"`), so two embeds of the same design on one page put two regions
  called "The garden" in the landmark list. axe reports it as
  `landmark-unique`. Reached exactly as stage H asks: the app mounted twice
  on a plain article page, both on the routed face. The embed has already
  made a region carrying the name the page gave it ("Chapter 13"), and the
  framework's own `PageMain` gets this right — it renders an UNNAMED section
  when embedded. Only the example a reader copies names it.
- where it belongs: `apps/seedbed/src/ui/design.tsx` (the worked example)
  and `packages/skills/skills/graview-pages/SKILL.md` (the rule that did not
  say it)
- harness that should have caught it:
  `apps/seedbed/tests/integration/embed.test.tsx`'s "is a region of its own,
  named, and two of them are two names" — which mounts both embeds on the
  SCENE face, where a design's shell does not exist. `pnpm site` runs axe
  over a page with fourteen embeds and passes, because every one of them is
  on the scene.
- status: fixed in "walkthrough: H · a landmark the embed already named" ·
  the design's embedded section carries no name of its own, and the skill's
  rule now says why. Criterion added to the same test file: "does not name a
  second region inside the one the embed already named" — two embeds of the
  design on the routed face, and every named region on the document must be
  unique. Verified failing without the fix: `Chapter 13 | The garden |
  Chapter 1 | The garden: expected 3 to be 4`.

### W-066 · In WebKit the keyboard stops working when the pane it was in goes away
- stage: I · face: scene · width: any · scheme: both
- expected: "a keyboard-only pass of every stage … the app in WebKit and
  Firefox as well as Chromium"
- actual: in WebKit the walk stops at the first Escape. Put the keyboard on
  an act, press Escape — the selection clears, which takes the whole pane and
  the focused control out of the document — and `document.activeElement` is
  `body` with **Tab moving nothing at all**, four presses running. The
  keyboard has stopped working and a pointer is the only way out. Chromium
  resumes from the top of the document and Firefox from the scene; WebKit
  picks no new starting point for a document whose focus went away with a
  removed node, and it is the browser iOS ships. W-053 gave the pane a way to
  keep the keyboard's place when a CONTROL inside it goes; this is the case
  where the pane itself goes, and there was nothing left inside it to go back
  to.
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`Inspector`) and `packages/primitives/src/shell.tsx` (the scene had no
  programmatic focus target)
- harness that should have caught it: every keyboard assertion the framework
  makes runs in Chromium. `pnpm engines` is the only harness that runs
  anything in WebKit, and it runs audit, pages and survey — none of which
  presses a key.
- status: fixed in "walkthrough: I · a keyboard the pane cannot strand" ·
  when the pane goes while it holds the keyboard, focus lands on the picture
  the pane was about (`main`, focusable programmatically), so the next Tab
  continues into the scene in all three engines. Criterion added to
  `scripts/verify-engines.mjs`: `keyboardSurvivesThePane`, run for every
  engine in the matrix — focus an act, press Escape, and Tab has to reach
  something. Verified failing without the fix in WebKit (`body → body →
  body`) and passing in Chromium and Firefox, which is exactly why one
  browser's verdict was not one.

### W-067 · Every picker on the routed face is under the minimum target size in WebKit
- stage: I · face: pages · width: 390 and 1280 · scheme: both
- expected: "every link and button is at least 24px" — in the three engines
  the framework ships in
- actual: 22 pixels in WebKit, 35 in Chromium, from one `controlStyle` that
  sets padding and no height. WebKit ignores an author's padding and minimum
  height on a `select` while the native appearance is on, so every picker the
  derived form draws — a choice, a node reference, a variant's tag — was
  under the WCAG 2.2 minimum in the browser iOS ships and nowhere else.
- where it belongs: `packages/pages/src/form.tsx`
- harness that should have caught it: `scripts/verify-pages.mjs` measures
  exactly this and names it `bigEnoughToHit`. It had been reporting `select
  "—TodayThis weekSomed" 350x22` for as long as anyone ran it in WebKit — and
  the only thing that does is `pnpm engines`, which the walkthrough's own
  end-of-stage list did not name.
- status: fixed in "walkthrough: I · a picker that is a target in every
  engine" · the picker turns the native appearance off, which is what makes
  the box the size it was asked to be, and carries a chevron of its own in
  the scheme's own ink so it still reads as a picker. 38 pixels in all three
  engines now. Criterion: `verify-pages`' own `bigEnoughToHit`, verified
  failing in WebKit before the fix — and `pnpm engines` added to the
  playbook's end-of-stage list, because a criterion nothing runs in the
  engine it is about is a criterion that cannot fail.

### W-068 · Nothing ever rendered a page at the reader's own text size
- stage: I · face: pages · width: 390 · scheme: both
- expected: "text zoom to 200% — the root font size, not page zoom, which is
  a scale factor and proves nothing about reflow", and no sideways scroll at
  a phone's width
- actual: the walked app's own record page scrolls two ways at 390 with a
  32px root — 459 CSS pixels wide in a 390 viewport — because a grid's
  column minimum is written in rem: `minmax(12rem, 1fr)` is 384 pixels once
  a reader asks for 32, and a column that cannot shrink takes the document
  with it. That is the app's own CSS, not the framework's, and the point is
  what did not notice: W-050 made every size in the framework relative and
  pinned it with a test that reads the SOURCE for absolute pixels. A rem
  column minimum passes that test and breaks reflow, which is the failure
  the rem conversion was supposed to prevent. **Nothing anywhere rendered
  anything at a bigger root font and looked at it.** The framework's own
  pages survive only because their column minimum happens to be in px.
- where it belongs: `scripts/verify-pages.mjs` (the criterion that was
  missing) — and, in the app under test,
  `walk3/src/ui/design.tsx`
- harness that should have caught it: none. `verify-pages` already measures
  `noSideScroll` at phone width, at the default text size, where every
  rem-based mistake is invisible.
- status: fixed in "walkthrough: I · the reader's own text size, rendered" ·
  `verify-pages` gains `readersOwnTextSize`: four routes at phone width with
  the root font at 32px, asserting the document does not scroll sideways,
  that nothing sticks out past the viewport, AND that the body text really
  did grow — a pass at the default size proves nothing. The app's column
  minimum is capped at the screen (`minmax(min(12rem, 100%), 1fr)`).
  Verified failing by giving the framework's own record page the same rem
  minimum: `scrollWidth: 404, width: 390, widest: [header, p, h1]`.

### W-069 · The routed face scrolls two ways at 200% text, in two of the three engines
- stage: I · face: pages · width: 390 · scheme: both
- expected: no sideways scroll at a phone's width, at the text size the
  reader asked for — WCAG 1.4.10, and stage I's own "text zoom to 200%"
- actual: found by W-068's new criterion the moment it ran in every engine:
  `/pages/tasks` at 390 with a 32px root is 408 CSS pixels wide in WebKit
  and Firefox, and fits in Chromium. An `auto` grid track is at least the
  min-content width of its item, and a grid item's own `min-width: auto` is
  the same measure — and the engines do not agree on that measure. The list
  page's `<header>` came out 388 in a 350 track; with that fixed, the
  derived `<form>` under it did the same thing one level down. The framework
  builds the whole routed face out of nested grids, so every one of them was
  a place where somebody else's min-content arithmetic could push the page
  sideways.
- where it belongs: `packages/pages/src/pages.tsx` (the page column) and
  `packages/pages/src/form.tsx` (the form and its fields)
- harness that should have caught it: `verify-pages` measures `noSideScroll`
  at phone width, at the default text size — where this is invisible — and
  only `pnpm engines` runs it in WebKit and Firefox at all. It took both
  gaps closing at once to see it.
- status: fixed in "walkthrough: I · a column the width it was given" · the
  page column, the derived form and its fields declare
  `gridTemplateColumns: "minmax(0, 1fr)"` and `minWidth: 0`, so a track is
  the width it was given and what is inside it wraps. Verified with
  `readersOwnTextSize` across all three engines: 408 before in WebKit and
  Firefox, 390 in all three after, and `pnpm engines` reports every engine
  holding.

## The fourth walk (2026-09-12)

Sixteen findings, W-070 to W-085, across the setup and stages A to F —
every one fixed in a framework package (or the worked example a skill
points at) and covered by a criterion verified to fail without the fix. So
the fourth walk did NOT leave the log still either, and a fifth is owed.
Stages G, H and I added nothing: every claim in them held at both widths,
in both schemes, in all three engines, at a 32px root, at 320 wide and
with reduced motion on.

The two things that had never been walked produced most of the weight:

- **The studio writes back something other than what it read** (W-077,
  W-078, W-079). Every tie act came back asking for an invented `to`;
  every rule the checkout wrote came back as `evaluate() { return []; }`
  under a comment claiming the opposite; every act the checkout wrote got
  a generic body that did something else; every `fromTheOtherEnd` was
  dropped. The studio's own tests declared none of these and called none
  of them. Its round trip on Walk is clean now, with `kept` naming what a
  person must put back and a loud failure until they do.
- **The routed face wrote as nobody** (W-082): under a policy every form
  and every one-press repair the derivation offered live was refused on
  press, because `DerivedForm` and `Repairs` applied with no author. Found
  by pressing an act in a jsdom test of the worked example — which is
  also how the example was found picking its acts by name (W-081), the
  thing its own skill says twice not to do.

The shapes that came up again:

- **Asking as nobody, or calling nobody "you"** — the submit (W-082), the
  chat's proposal (W-084), the rail's and the pages' attribution with two
  seats on one store (W-085).
- **The keyboard ending on `<body>`** — the in-place editor (W-070), and
  the design's act form (W-083); W-053's defect on two more surfaces, and
  the pane's keeper reclaiming the keyboard from one of them.
- **One press, two rungs** — Escape closing a popover and dropping the
  selection under it (W-072), which the first version of the fix learned
  needs the capture phase, because React commits between listeners.
- **The words** — the log written from the button rather than the act
  (W-074), the chat reading a tie from the wrong end (W-075) and a
  question as a command (W-076), a hint that said "opens" over something
  open (W-073), a skill naming a switch nothing reads (W-071).
- **A project that cannot follow its own skill** — a lens typed the way
  `graview-lens` says would not register without a cast (W-080).

Also observed and not logged, because they are the walked app's own: a
lens using `h3` under a `Panel` whose title is not a heading (the shipped
lenses use none), a tinted paper that drops the accent below AA where the
framework's own ground holds it, and a scaffolded app's headless tests
applying as nobody once it declares a policy (a clear refusal, one line to
fix). `pnpm engines` reported `firefox audit:FAIL` once, at the end of
stage D, while a stage E browser session ran beside it; the same audit run
alone in Firefox was 15 of 15 clean and every later engines run held.


### W-070 · A rename made in place leaves the keyboard on <body>, or on a pin nobody pressed
- stage: A · face: scene · width: 1280 and 390 · scheme: both
- expected: "keyboard alone can do everything above" — rename it in place,
  and be where you were afterwards, the way pressing a button on the routed
  face leaves you on the button (W-053's rule, one component over)
- actual: two endings for one gesture. With a pointer: click the title, type,
  Enter — `document.activeElement` is `BODY`. The editor is a field mounted
  in place of the value, committing it unmounts the field, and a removed
  element takes focus to the document with it; nothing put it back. From the
  keyboard it was stranger: focus landed on `Pin Change the item` — a pin
  toggle in the actions pane, six tabs away, that nobody had pressed. Traced
  with focus events: a Tab out of the pane's LAST control wraps the document
  and Chromium reports that focusout with `relatedTarget: null`, which is the
  exact signal W-053's keeper takes to mean "the element went away under
  them". So the pane kept a stale key through the whole rename, and the
  moment focus fell to body it reclaimed the keyboard from work it had no
  part in.
- where it belongs: `packages/primitives/src/editable.tsx` (the editor never
  returned focus) and `packages/primitives/src/workbench/index.tsx`
  (`Inspector`'s keeper trusted the blur where it should have asked the
  element)
- harness that should have caught it: `scripts/verify-remember.mjs` renames
  in place in a real browser and asked only what the graph said afterwards;
  `packages/primitives/tests/unit/rename-in-place.test.tsx` asserted the
  commit and never where the keyboard was left; `verify-menu`'s
  `theKeyboardKeepsItsPlace` only ever pressed acts INSIDE the pane
- status: fixed in "walkthrough: A · the keyboard comes back to the value it
  edited" · the editor remembers its own button across the edit and focuses
  it again when it closes with the keyboard still in it (Enter, Escape, an
  act chosen) — never after a blur, which is somebody leaving on purpose.
  And the keeper keeps the ELEMENT beside the key and restores only when
  that element is no longer in the document. Criteria added:
  `rename-in-place.test.tsx` "puts the keyboard back on the value it just
  changed", "puts it back after Escape abandons the edit, too", "leaves the
  keyboard wherever a blur sent it"; and
  `the-pane-keeps-its-hands-off.test.tsx` "does not reclaim the keyboard
  from work it had no part in" — the pin blurred with no relatedTarget and
  still connected, the graph changing underneath. Verified failing without
  the fix: three of the four (`expected <body>`; `expected <button …> to be
  <body>`); the blur case passes either way, so it is a guard rather than a
  regression. Also `verify-remember`'s `theKeyboardStaysOnWhatItRenamed`,
  the same gesture in a real browser.

### W-071 · The new-app skill still sends a reader to `?renderer=gpu`
- stage: Setup · face: neither — the skills
- expected: a skill's prose can be followed; W-030 established that there is
  no `?renderer=gpu` anywhere — `auto` is the DOM path unless an app passes
  an `attachRenderer` — and took it out of the playbook
- actual: `graview-new-app`'s "Supported browsers" section still said "The
  GPU capture path (`?renderer=gpu`) is Chromium-only, experimental and
  opt-in". Nothing in `packages/*/src` reads `renderer` from a URL; the
  twelve parameters the sources do ask a `URLSearchParams` for are `theme`,
  `fresh`, `remember`, `past`, `show`, `focus`, `sel`, `expand`, `overview`,
  `pan`, `relation` and `zoom`. The same sentence W-030 fixed in the
  walkthrough had a copy in the skill every project installs, and the skills
  test checks finding codes against the checker and nothing else against
  the code.
- where it belongs: `packages/skills/skills/graview-new-app/SKILL.md`
- harness that should have caught it: `packages/skills/tests/unit/skills.test.ts`
  — "never names a finding code the checker cannot produce" is the shape,
  applied to codes only
- status: fixed in "walkthrough: setup · a switch a skill names is a switch
  the framework reads" · the sentence says how the GPU path is actually
  opted into and that there is no URL switch. Criterion added: skills "names
  only URL switches the framework reads" — every `?name=` in any skill must
  be a parameter some source file asks a `URLSearchParams` for. Verified
  failing against the old prose: `graview-new-app names "?renderer=" and
  nothing reads it`.

### W-072 · One Escape closes the rail and drops the selection under it
- stage: B · face: scene · width: 1280 and 390 · scheme: both
- expected: "Escape backs out one level at a time in the documented order" —
  with the activity rail open, the press closes the rail; the next press is
  the ladder's
- actual: one press did both. Open the rail on a selected record and press
  Escape: the rail closes AND `sel=` leaves the address, in one stroke. The
  chat panel and the problems list are the same. On the ground it is worse:
  the rail closes and the focus backs out to home, so pressing Escape after
  reading the activity of the record you are standing on takes you off the
  record. Each popover has an Escape listener of its own on `document`, and
  `BackOut`'s ladder listens on `window` and never asked whether anything was
  open over the scene. Found because a stage-B probe pressed Escape to close
  the rail and the next click of the altitude control descended from a place
  it had not been.
- where it belongs: `packages/primitives/src/workbench/index.tsx` (`BackOut`,
  the rail and the problems list) and `packages/primitives/src/chat.tsx`
- harness that should have caught it: `packages/primitives/tests/unit/back-out.test.tsx`
  walks the ladder with nothing open over it; `scripts/verify-chat.mjs`
  presses Escape on the panel and asked only whether the panel closed;
  `scripts/verify-remember.mjs` presses Escape on the rail and never looked at
  the address afterwards
- status: fixed in "walkthrough: B · a popover is the outermost rung" · each
  popover marks itself `data-graview-overlay` while open, and the ladder
  leaves the press to it — asked in the CAPTURE phase, because the popover's
  own listener runs first in the bubble and React commits its closing in the
  microtask between listeners; a bubble listener on the window found the
  popover already gone, which the first version of the fix learned in the
  browser. Criteria added: back-out "leaves the press to the popover, and
  takes the next one" (fails without the fix: `expected [] to deeply equal
  ['kind:item']`), and `verify-chat`'s `escapeKeptTheSelection`, which is
  where the capture-phase half is held — only a real browser dispatches in
  that order.

### W-073 · The strip says "double-click opens" on a district that is already open
- stage: B · face: scene · width: any · scheme: both
- expected: the onward gesture is said for the state the thing is in — and
  stage B's own claim is that "the district closes on a second double-click"
- actual: select an opened district and the strip's subtitle reads
  "Items · double-click opens" over a card whose own control says "close ▴".
  The hint was written once, for a record, and a district selected while
  open got the same words.
- where it belongs: `packages/primitives/src/workbench/index.tsx` (the
  strip's header)
- harness that should have caught it: `packages/primitives/tests/unit/edge-inspector.test.tsx`
  renders the strip over a selected district and never over an opened one
- status: fixed in "walkthrough: B · a popover is the outermost rung" · the
  hint reads `view.expanded`: "· double-click closes" on an opened district.
  Criterion added: edge-inspector "says the gesture closes a district that
  is already open". Verified failing without the fix.

### W-074 · The strip logs the button's words; the pages log the act's own
- stage: C · face: both · width: any · scheme: both
- expected: "one act reads the same way on both faces" (W-004), and "each
  leave one op in the log with the right author" — the same op from either
  face
- actual: repair "Pay the deposit is open and nobody is seeing to it" from
  the strip, answer the ask with Ada, and the activity rail reads `you Hand
  Pay the deposit to somebody` — the question's words standing in the
  history for the answer. Take the same repair on the pages record and the
  row reads `you Pay the deposit is handled by Ada Nowak`, the act's own
  `describe`. It is every act, not only repairs: stage A's strip logged
  `you Add an item` where the home's "Recently" said `Add First thing — you`.
  `applyAffordance` passed `intent: affordance.label` unconditionally, so
  the button's caption overrode the words the declaration wrote for exactly
  this; the routed face's `DerivedForm` never passed one.
- where it belongs: `packages/tools/src/derive.ts` (`applyAffordance`)
- harness that should have caught it: nothing compared the two faces'
  histories; `verify-remember` and `verify-seat` read the rail's rows for a
  signature and a title and never for what the row SAID about the change
- status: fixed in "walkthrough: C · the log says what happened, and a
  question is not a change" · an act that declares `describe` is logged in
  its own words from every face; the label is only the fallback for an act
  with none, where the compiled intent would be `name(k=v)`. Criterion
  added: `packages/tools/tests/unit/the-log-says-what-happened.test.ts` —
  three cases (a plain act, a repair answered through an ask, the fallback).
  Verified failing without the fix.

### W-075 · The chat captions a relation from the wrong end
- stage: C · face: scene (the chat) · width: any · scheme: both
- expected: "the caption over a neighbour must be the focus's reading" —
  the chat's account of a node reads each tie from the end that node is at
- actual: "what is Ada Nowak seeing to?" → `Ada Nowak — a person. who is
  seeing to it: Pay the deposit.` — the ITEM's caption in the person's
  mouth. The named-thing branch chose `description` or `inverse` by which
  KIND declared the edge rather than by which END the node is at, so every
  cross-kind tie read wrongly from the far end. W-007 fixed the same
  reading on the pages record; the chat kept it.
- where it belongs: `packages/tools/src/conversation.ts` (the named-thing
  account)
- harness that should have caught it: `packages/tools/tests/unit/conversation.test.ts`
  — its fixture's only edge has no `inverse`, so both readings were the
  same string and the direction could not be told
- status: fixed in the same commit · an edge is declared at its `from` end,
  so `description` is the reading from there and `inverse` from the `to`
  end, whatever kind the node is. Criterion added: conversation "captions a
  relation from the end the named thing is at". Verified failing without
  the fix.

### W-076 · A question is answered with an act to run, on the wrong two ends
- stage: C · face: scene (the chat) · width: any · scheme: both
- expected: something the chat can be asked is answered from the graph or
  not at all — never wrongly
- actual: "what depends on Pay the deposit?" → `I can do that. Review it
  below — it applies like any other change, and undo works.` with an apply
  button reading `Depends on — Pay the deposit`. The act's title ("Depends
  on") appeared in the question, so the responder proposed RUNNING it — and
  filled both of the tie's node blanks with the one record named, so the
  proposal was Pay the deposit depending on itself, the self-link W-035
  chased off the record page. A question mark counted for nothing.
- where it belongs: `packages/tools/src/conversation.ts` (the phrased-act
  branch)
- harness that should have caught it: the conversation tests ask the
  responder to propose and never ask it a question that happens to carry
  an act's title
- status: fixed in the same commit · a sentence that asks (a trailing "?",
  or an interrogative opening) is never a change, and each thing named
  fills one blank — a second blank of the same kind is honestly missing.
  Criteria added: conversation "never proposes an act in answer to a
  question" and "never fills two blanks of a tie with the one thing that
  was named". Both verified failing without the fix.

### W-077 · The studio writes an act back with an argument the checkout never had
- stage: B (the studio, once there were two kinds) · face: neither — the
  declaration
- expected: `graview-studio` step 4 — "an act the checkout wrote keeps the
  checkout's body under the studio's declaration", and the written files
  are "the files `graview create` writes"; the checkout's own verify passes
  on them once the bodies it says to keep are kept
- actual: `studio.files()` wrote every tie act with an invented far-end
  argument, `to`, where Walk's declaration says `dependsOn` and `handler`
  — so the app's own tests, its record page, its seed script and any agent
  holding the old tool schema all failed on `Invalid arguments for mutation
  "link-item": to: expected string, received undefined`. And every written
  `describe` printed node ids into the history: `Depends on: item:x →
  item:y`. The studio's own written-back test declares its tie act with
  `dependsOn` and then never calls it.
- where it belongs: `packages/studio/src/meta.ts` (the act node had a
  `subjectArg` and no word for the far end), `packages/studio/src/from-declaration.ts`
  (nothing read the input's other node argument), `packages/studio/src/source.ts`
- harness that should have caught it: `packages/studio/tests/unit/written-back.test.ts`
  asserted the written checkout adds and closes a thing and never linked one;
  `packages/studio/tests/unit/studio.test.ts` asserted the invented `to`
  by name, enshrining the defect
- status: fixed in "walkthrough: B · the studio writes back what the
  checkout wrote" · the act node carries `targetArg`, read from the
  checkout's own input (`nodeRefArgs`), and the writer uses it — `to` only
  for an act the studio itself declared; written describes name nodes
  through a `nameOf` the file carries. Criterion: written-back "a checkout
  built from the studio's files passes graview check and runs" now links
  and unlinks through the checkout's own argument and reads the written
  declaration for it. Verified failing without the fix.

### W-078 · The studio disarms every rule the checkout wrote, and says it kept them
- stage: B (the studio) · face: neither — the declaration
- expected: a rule the checkout judges goes on judging, or the file says
  plainly that it cannot write the judgement
- actual: `invariants.ts` came back with `evaluate() { return []; }` for
  `closed-in-order` and `every-item-handled` — both rules the checkout
  wrote, both now holding on every graph — under a header comment reading
  "a rule the checkout already judges keeps the checkout's evaluate". Each
  rule's label was also replaced by its identifier (`label:
  "closed-in-order"` for "Closed in order"). And the same for acts: Walk's
  `close-item` closes unconditionally; the studio classified it as a write
  and generated a body that patches only when a `status` is passed, so
  `close-item` with `{ id }` did nothing at all. A written-back checkout
  that passes `graview check` and silently holds is a lens that lies
  (W-016's shape), and it is exactly what a person committing those files
  would ship. The studio's written-back test had no base rule to lose and
  passed `status: "closed"` by hand.
- where it belongs: `packages/studio/src/source.ts` (and `meta.ts`,
  `from-declaration.ts` for the rule's title)
- harness that should have caught it: the same written-back test
- status: fixed in the same commit · a rule or an act the checkout already
  has keeps its declaration (with the checkout's own words for its label)
  and gets a stub that THROWS naming what belongs there, and every
  `WrittenFile` carries `kept` — the bodies the checkout must supply.
  Generated bodies remain for what the studio itself declared. The store
  judges every change, so the first act meets the loud failure — which is
  where the skill sends a reader ("run the checkout's own verify on the
  files it wrote"). Criterion: written-back asserts `kept` on both files,
  the kept label, the loud failure before the bodies are back, and a
  running checkout after. Verified failing without the fix (`expected
  undefined to deeply equal ['labelled-things: evaluate']`). In Walk: the
  regenerated copy fails loudly naming both rules and every act, and
  verifies clean once their bodies are put back where the files say.

### W-079 · The studio drops the far-end reading, so a clean checkout comes back warning
- stage: B (the studio) · face: neither — the declaration
- expected: a declaration read into the studio and written back unchanged
  says what it said; `graview check` on the round trip is what it was
- actual: Walk's `hand-item` and `take-back` declare `fromTheOtherEnd`
  ("Take one on", "Hand one back" — W-040's declaration). The studio's act
  node had no field for it, so `declarationToGraph` dropped it,
  `graphToDeclaration` gave back acts without it, and the written
  `mutations.ts` omitted it: the regenerated checkout warned
  `act-without-far-end-reading` twice where the original was clean, and
  the far end of every tie in the app went back to reading from the near
  end. The studio's own fixture declared no `fromTheOtherEnd` anywhere, so
  nothing could notice.
- where it belongs: `packages/studio/src/meta.ts`, `from-declaration.ts`,
  `to-declaration.ts`, `source.ts`
- harness that should have caught it: `packages/studio/tests/unit/studio.test.ts`
  — "reads every kind, field, edge, act … in" asserted the ids and a
  field or two; "gives the declaration back" never ran the checker over
  what came back against what went in
- status: fixed in "walkthrough: B · the studio keeps the far-end reading"
  · the act node carries `fromTheOtherEnd`, read in, given back and
  written. Criterion: the fixture's tie acts declare it, the read-in node
  is asserted to carry it, the declaration given back is asserted to carry
  it AND to pass the checker without `act-without-far-end-reading`, and
  the written file is asserted to contain it. Verified failing without the
  fix (three tests).

### W-080 · A lens written the way the skill says does not register without a cast
- stage: D · face: neither — the types
- expected: `graview-lens` step 7 — `registry.register("gardener", {
  cardinality: "many", fidelity: "full" }, TendingView, { title: "Who tends
  what" })` — typechecks in a project that wrote `TendingView:
  ViewComponent<S>`
- actual: `Argument of type 'FunctionComponent<ViewProps<S, "item" |
  "person">>' is not assignable to parameter of type 'ViewComponent<S,
  "person">'`. `register<K>` asked for `ViewComponent<S, K>`, and React's
  `FunctionComponent<P>` is covariant in `P` (its `propTypes`), so a view
  over the whole schema — which is what every lens is — was refused on any
  one kind. The framework's own apps knew: fourteen `as ViewComponent<S>`
  casts, on every lens registration in seedbed and todo, including the
  worked example the skill points readers at. Same class as W-021 and
  W-048: a project that cannot follow its own skill.
- where it belongs: `packages/react/src/view-registry.ts`
- harness that should have caught it: the framework's own `pnpm typecheck`,
  which the casts kept green
- status: fixed in "walkthrough: D · a lens registers without a cast" ·
  `register` takes `ViewComponent<S, K> | ViewComponent<S>`; a kind the
  schema never declared is still a typecheck failure. The nine casts on
  the worked examples' lenses are gone, so `pnpm typecheck` is the
  criterion — verified failing without the widening at every uncast site
  (`apps/seedbed/src/ui/views.tsx(81,68)` and on). The four casts that
  remain are real: a lens over the studio's meta-schema and one over
  `AnySchema`.

### W-081 · The worked example a design is told to copy picks its acts by name
- stage: E · face: pages · width: any · scheme: both
- expected: `graview-pages`, rung two — "Offer what can act.
  `facts.actions.affordances`, never your own scan of the mutations", and
  "A design that lists acts by NAME will miss the one declared after it was
  written, and one that lists them by scanning the mutations will offer
  acts that cannot act" — in `apps/seedbed/src/ui/design.tsx`, which the
  same skill names as the design to copy
- actual: the example's `Acts` took `names={["tend"]}` and asked
  `store.permits` — the permission question, not the askability one. So a
  gardener's own page offered "Name a caretaker" beside every untended
  plot, both ends prefilled: the plot's words on her page (W-040's defect,
  in the example), and a one-press act that re-adds a tie she may already
  hold (W-008's). A plot with no gardener anywhere offered the same over an
  empty picker (W-045's). A reader copies the example, not the rule; Walk's
  design, written from the skill's text instead, reads
  `recordFacts(...).actions` and none of this happens.
- where it belongs: `apps/seedbed/src/ui/design.tsx`, and
  `packages/skills/tests/unit/skills.test.ts` (which checked the skill's
  prose for the rule and never the example it points at)
- harness that should have caught it: `apps/seedbed/tests/integration/chapters.test.ts`
  renders chapter thirteen and asserts its testids, never what an act on a
  page is called or whether one is offered with nothing to point at
- status: fixed in "walkthrough: E · the worked example takes its acts from
  the derivation" · `Acts` takes an `AffordanceSet` — `recordFacts` on a
  record, `kindFacts` merged across kinds on a list or the home — narrowed
  by `only` where a section is about one act; withheld acts are drawn
  struck through with the policy's sentence as before. Criteria: chapter
  thirteen asserts June's page reads "Take on a plot" and never "Name a
  caretaker", and a plot in a garden with no gardeners offers no live tend
  form; the skills test reads every `apps/seedbed/src/ui/*.tsx` the pages
  skill names and refuses `<Acts names={[`, `store.permits(` and the
  absence of `recordFacts(`/`kindFacts(`. Both verified failing against
  the old file.

### W-082 · The routed face writes as nobody, so under a policy every form refuses on press
- stage: E (found writing the design; it is stage F's face) · face: pages ·
  width: any · scheme: both
- expected: "nothing refuses on press" — an act the derivation offered live
  to this seat applies when this seat presses submit
- actual: `DerivedForm` applied with no author, and so did `Repairs`' one-
  press path and the ask it opens; the store then judged its default, the
  anonymous human, who under a policy may do nothing. So with a policy
  declared the list page, the record page, the problems page and every
  design built on them offered every permitted act live and refused each
  on press: `Not permitted: tend on a plot — one of coordinator, gardener
  can`, said to the coordinator. Found by a jsdom test that pressed "Take
  on a plot" on June's page in chapter thirteen and read the form's own
  `refused` line. W-047 made the derivation ask as somebody and W-063 made
  the undo say who was undoing; the submit between them still said nobody.
- where it belongs: `packages/pages/src/form.tsx` (`DerivedForm` had no way
  to be told), `packages/pages/src/pages.tsx` (three `DerivedForm` sites and
  `Repairs`), `packages/core/src/scaffold/index.ts` (the page every project
  starts from), and the two designs that copy the pattern
- harness that should have caught it: `packages/pages/tests/unit/parity.test.tsx`
  renders every page under a policy and asserts what is withheld; nothing
  ever SUBMITTED a permitted form under one. `pnpm pages` drives `apps/todo`,
  which has no policy.
- status: fixed in "walkthrough: E · the routed face writes as the person at
  the keyboard" · `DerivedForm` takes `principal` and applies as it; `Repairs`
  applies as the principal it already held and hands it to its ask; the
  derived pages, the scaffold's record page and both designs pass the
  context's principal. Criteria: `asked-as-the-person.test.tsx` — a derived
  form and a one-press repair under a policy, applied by a permitted
  keeper, no refusal, the op authored by her (both fail without the fix:
  `Not permitted: close-note on a note`); scaffold "submits its forms as the
  person at the keyboard".

### W-083 · An act taken from the keyboard on the product design ends on <body>
- stage: E · face: pages · width: any · scheme: both
- expected: pressing an act's form on the design leaves the keyboard where
  it was, the way the derived pages do (their forms stay mounted)
- actual: the design's act is a button that opens its form in place and
  closes it on `onDone` — `setOpen(null)`, the form unmounts, and a removed
  element takes focus to `<body>` with it. Measured on Walk's design after
  handing an item to Bo: `activeElement: <body>`. The pattern is the
  worked example's (`apps/seedbed/src/ui/design.tsx`), copied verbatim;
  W-053's defect on the third surface in a row.
- where it belongs: `apps/seedbed/src/ui/design.tsx` (the example), and
  Walk's copy of it
- harness that should have caught it: the chapter tests render the design
  with `renderToStaticMarkup`, which has no keyboard
- status: fixed in the same commit · the button that opened the form is
  remembered and focused when the form is done; it never left the page.
  Criterion: `apps/seedbed/tests/integration/design-keyboard.test.tsx` —
  press "Take on a plot" on June's page, answer the form, and the keyboard
  is on the button. Verified failing without the fix.

### W-084 · The chat proposes an act the seat may not take, and refuses on press
- stage: F · face: scene (the chat) · width: 1280 and 390 · scheme: both
- expected: "nothing is hidden and nothing refuses on press" — the seat's
  own turn under a policy withholds what the seat may not do and says why,
  the way the strip, the pages and the starter seat already do
- actual: with the helper at the keyboard, "Add an item \"Sneak one in\""
  came back as `I can do that. Review it below — it applies like any other
  change, and undo works.` with an apply button; pressing it answered
  `Refused: Not permitted: add-item — keeper can.` The responder proposes
  from the graph and `validateProposals` checks that the act exists and its
  arguments are an object — never who is asking — and the panel rendered
  every proposal as a press. The third walk's note asked for exactly this:
  the agent seat's own turn under a policy.
- where it belongs: `packages/primitives/src/chat.tsx`
- harness that should have caught it: `packages/primitives/tests/unit/chat.test.tsx`
  renders the panel closed and under no policy; `scripts/verify-chat.mjs`
  drives `apps/todo`, which has none
- status: fixed in "walkthrough: F · two seats on one store" · a proposal is
  a press only when `store.permits` says so for the person at the keyboard;
  otherwise it is drawn struck through with the policy's own sentence
  (`chat-withheld`), the same rule as the strip. Criterion:
  `the-seat-under-a-policy.test.tsx` "withholds a proposal the seat may not
  take, with the policy's reason, rather than offering a press that
  refuses". Verified failing without the fix.

### W-085 · The rail and the pages call the other seat's work "you"
- stage: F · face: both · width: any · scheme: both
- expected: with two seats on one store, the history says whose work is
  whose; "you" is the person at the keyboard
- actual: the keeper seeds the graph, the helper sits down, and the
  activity rail reads `you Pay the deposit is handled by Ada Nowak`, `you
  Add Bo Lind` — Kai's work, said to Hana as hers. The routed face's
  "Recently" and every record's history said the same: `whoDid` returned
  "you" for any human author, and the rail's row did likewise. W-011 gave
  every agent seat its own name; the humans were still one "you".
- where it belongs: `packages/primitives/src/workbench/index.tsx`
  (`ActivityRail`) and `packages/pages/src/pages.tsx` (`whoDid`)
- harness that should have caught it: every rehearsal with a rail in it has
  one human in it
- status: fixed in the same commit · "you" only when the op's author is the
  principal at the keyboard (or when nobody has an id — an app with no
  seats still says "you"); otherwise the author's own id. Criteria:
  `the-seat-under-a-policy.test.tsx` "says \"you\" only for the person at
  the keyboard, and names the other seat", and `whose-work.test.tsx` on the
  routed face's home for both seats. Verified failing without the fix.

### W-086 · A rule's neighbourhood is every task, twelve to a row, while its card says nothing is connected
- stage: B/C · face: scene · width: 1280 · scheme: light · found by Nick in the todo app at `#focus=rule-order&relation=task&zoom=1`
- expected: focusing a rule and raising Tasks shows the tasks the rule finds
  wrong, captioned as such, with the card's connections agreeing; a band of
  many neighbours stays readable
- actual: a rule has no edges, so a named relation fell through to "raise
  the kind wholesale": all twelve tasks in one row, each in a slot 57 pixels
  wide under a chip 150 wide — overlapping labels, and the depends-on lines
  between them clipped by the mismatched hosts into dashed confetti. The
  card below said "Nothing is connected to this rule yet."
- where it belongs: `packages/layout/src/layout.ts` (the relation band and
  `relatedNodes`), `packages/react/src/scene.tsx` (what the layout is told),
  `packages/primitives/src/connections.tsx`
- harness that should have caught it: `audit-ui` measures same-plane card
  collisions, but no todo state ever focused a rule or raised a crowd; every
  raised state had three chips or fewer
- status: fixed in "a rule's neighbourhood is what it finds wrong, and a crowd wraps" ·
  the layout takes `judged` (subject → the ids its violations name, supplied
  by the scene from `store.violations()`) and draws them as the focus's
  neighbourhood captioned "what it finds wrong", filtered by a named kind
  like an edge would be; the band never gives a slot less than three
  quarters of a relation card's width and wraps into rows past that; the
  connections panel lists what a node finds wrong as a group. Criteria:
  layout "the relation band" ×2, primitives `what-it-finds-wrong`, audit-ui
  todo states `judged` and `crowd` (collisions at the same stop before: 12
  slots of 57px under 150px chips).

### W-087 · Lines between two chips of a wrapped band cross the other chips and are left as pieces
- stage: B · face: scene · width: 1280 · scheme: light · found by Nick in the todo app at `#focus=aggregate:task&relation=task`
- expected: a relation between two members of the band is one visible line that crosses nothing
- actual: an arc between two chips ran under whichever chips lay between and, clipped out under each, was left as dashes in the gaps — lines that belonged to nothing
- where it belongs: `packages/react/src/scene.tsx` (the strands) and a router of its own, `packages/react/src/channels.ts`
- harness that should have caught it: nothing measured a line's runs; `audit-ui`'s todo `crowd` state (W-086) draws the band but only counts card collisions
- status: fixed in "a line between two chips of one band takes the gutters" · a strand whose both ends are chips of the relation band is routed through the band's gutters — out of a chip's edge, along the channel between rows, across rows through a gap between chips, into the far chip — staggered by lane so lines sharing a channel do not lie on each other; drawn whole, no clipping. Criterion: react `channels.test.ts` (same row, next row, two rows apart, upward: no segment crosses a third chip; ends on the chips' own edges).

### W-088 · Twelve lines from the list columns to the same tasks' chips, over the panel that already shows them
- stage: B · face: scene · width: 1280 · scheme: light · found by Nick in the todo app at `#focus=aggregate:list&relation=task`
- expected: with the lists in focus and every task raised, the picture says which list holds which task once — in the columns — and draws lines only where they add something
- actual: a `holds` line from each list column inside the Lists panel to the same task's chip in the band, twelve arcs crossing the panel and each other; and a gutter road crossing a row at eight pixels from a chip, square-cornered, read as a box drawn around it
- where it belongs: `packages/react/src/scene.tsx` (the strands), `packages/react/src/channels.ts`, `packages/react/src/routes.ts`
- harness that should have caught it: `verify-navigation` walks the todo app's stops but never one with a relation raised over a view that draws the relation itself
- status: fixed in "a view that draws both ends has drawn the relation" · inside the stack a strand is not drawn for an edge whose far end is drawn inside the near end's host — the view has drawn the relation; a gutter road prefers a gap between chips to the band's margin, keeps twelve pixels clear and rounds its corners. Criteria: verify-navigation `aViewThatDrawsBothEndsDrawsTheRelation` (twelve tasks drawn inside the lists, twelve chips in the band, zero `holds` lines), react `routes.test` for the rounded road.

### W-089 · The week's entries seemed to belong to no list until one was selected; a calendar of times with no names; "Today" on two days
- stage: D · face: scene · width: 1280 · scheme: light · found by Nick in the todo app at `#focus=aggregate:task&relation=list`
- expected: every entry on the week has its line to the list that holds it; an entry says what it is; the example's "Today" list holds today's tasks
- actual: W-088's rule fired for a band card too — a list card at summary draws its tasks as chips, so "the far end is drawn inside the near host" silenced every line but the ones the card hid, and the picture read as one task linked to Today until Today was selected and its lines lit. A moment on the timeline was a dot and a time, so a calendar of moments — which a to-do list mostly is — read as a column of times. The example's Today list held tasks planned on Monday and Tuesday with today a Tuesday. And three someday tasks with no time were one line from their list into the middle of the week, anchored on the panel because the calendar drew none of them.
- where it belongs: `packages/react/src/scene.tsx` (the strands), `packages/primitives/src/lens/timeline.tsx` (the moment), `apps/todo/src/data/example.json`
- harness that should have caught it: `verify-navigation` had the lists-in-focus stop (W-088) but not the week-in-focus one; the timeline's test asserted a moment's time and never its name
- status: fixed in "the focus that draws both ends has drawn the relation; a moment has a name" · only the FOCUS restating a relation silences a line, a band card summarising its members does not; a line to a member the focus's view does not draw is not drawn; a moment carries its name between its time and its dot, cut with an ellipsis before the time gives way; Today's tasks are on Tuesday. Criteria: verify-navigation `aCardsChipsDoNotSilenceItsLines` (nine entries on the week, at least nine lines), primitives timeline test asserts the moment's name.

## The fifth walk — a Discography (2026-09-28)

The fifth walk replaced the generic subject with a real domain: songs,
releases, artists who record, feature on and produce them, themes and an
era, scaffolded with `graview create ../walk5 --name "Discography" --kind
song --plural songs` and seeded with a fictional artist's four releases,
two singles and thirty-five songs.

### W-090 · Escape closes a popover and leaves the keyboard on the body
- stage: A · face: scene · width: 1280 · scheme: light
- expected: open Activity, press "undo", press Escape — the list closes and
  the keyboard is back on the Activity button, one Tab from where it was
- actual: the list closed and `document.activeElement` was `<body>`: the
  undo button the keyboard stood on went with the pane. The problems list,
  the chat panel and the profile pane did the same — each closes on Escape
  with a listener of its own and none of them asked where the keyboard was.
  Opening and closing without going inside was fine, which is the only case
  anything had tried.
- where it belongs: `packages/primitives/src/workbench/activity.tsx`,
  `workbench/standing.tsx`, `chat.tsx`, `profile.tsx` — one helper,
  `popover.ts` (`closeToTrigger`)
- harness that should have caught it: `verify-remember` presses Escape on
  the rail and reads only the address; W-072's back-out test asks what the
  ladder did, not where the keyboard went
- status: fixed in "walkthrough: A · Escape gives the keyboard back to what
  opened the popover" · Escape closes through `closeToTrigger`, which puts
  the keyboard on the popover's own `aria-expanded` button when it was
  inside the pane and leaves it alone otherwise. Criterion: primitives
  `escape-gives-the-keyboard-back.test.tsx` (the activity list and the
  problems list; verified failing without the fix: `expected <body> to be
  <button>`).

### W-091 · The routed face's first screen has no heading
- stage: A · face: pages · width: 390 and 1280 · scheme: both
- expected: axe reports nothing on either face
- actual: on an empty graph `/pages` is the way in alone — `<Begin>` in the
  scaffold's home, framed in `PageMain` — and axe reported
  `page-has-heading-one`. The door's title "Begin" is a panel title, and a
  panel title is a `<strong>` styled as a heading: every other page has an
  `h1`, this one had none. Every axe pass of the routed face seeds first, so
  none had ever seen the page a product ships as.
- where it belongs: `packages/primitives/src/primitives/index.tsx` (`Panel`
  gains `heading`), `packages/primitives/src/seeding.tsx` (`Begin`)
- harness that should have caught it: `scripts/smoke-create.mjs` axes the
  routed face only after its seat has seeded the graph
- status: fixed in "walkthrough: A · the way in is a page with a heading,
  and keeps the keyboard" · a panel's title can be a heading of a stated
  level; a framed door is its page's `h1` unless told otherwise. Criteria:
  primitives `the-door-keeps-the-keyboard.test.tsx` "is the page's
  level-one heading when it is framed as the page" (verified failing
  without the fix), and smoke-create's `axeFindsNothingInEitherScheme` now
  includes `axePagesEmpty`, the empty `/pages` at phone width.

### W-092 · Answering the way in from the keyboard ends on <body>
- stage: A · face: pages · width: 1280 · scheme: light
- expected: add the first song through the pages form and the keyboard is
  still somewhere on the page
- actual: `activeElement` was `<body>` after Apply. The ask belongs to a
  row that goes away once its kind has a member — and on a one-kind app the
  whole door stands down for the derived home — so the element the keyboard
  stood on left the document. W-053 and W-083's shape on the fourth surface.
- where it belongs: `packages/primitives/src/seeding.tsx` (`Begin`)
- harness that should have caught it: `the-way-in.test.tsx` asserts what the
  door offers and what applying makes, never where the keyboard is after
- status: fixed in the same commit · the door remembers where the keyboard
  was; when that element is gone it lands on the next way in, else on the
  heading of what now stands there (the home's `h1`). Criteria:
  `the-door-keeps-the-keyboard.test.tsx` "hands the keyboard to the home it
  stands down for" and "hands it to the next way in while the door is still
  up" (both verified failing without the fix).

### W-093 · A name with an accent mints an id that is nobody's name
- stage: B · face: both · width: any · scheme: both
- expected: "Add an artist" named "Zoë Lamarré" makes `artist:zoe-lamarre`,
  the address a person would guess and the one search folds to
- actual: `artist:zo-lamarr`. `freshId`'s slug kept `[a-z0-9]` and dropped
  every other letter, so each accented letter vanished rather than folding,
  and a name written wholly in another script became `item`. The id is in
  every address (`#focus=artist%3Azo-lamarr`) and every agent tool call; a
  link typed by hand to `zoe-lamarre` laid out the whole city instead.
- where it belongs: `packages/core/src/mutations/define-mutation.ts` (`slug`)
- harness that should have caught it: no seed or test anywhere names a
  thing with a letter outside ASCII
- status: fixed in "walkthrough: B · an id is the name, folded" · accents
  are folded (NFKD, marks removed) the way `search` squeezes, and letters
  with no Latin form are kept. Criterion: core
  `an-id-is-the-name-folded.test.ts` ("zoe-lamarre", "beyonce", "сплин",
  and the plain names unchanged).

### W-094 · At altitude a fifth district stands under the inspector
- stage: B · face: scene · width: 1280 and 1560 · scheme: both
- expected: every district is on ground the reader can see — right of the
  left rail, left of the right one
- actual: with five kinds (songs, albums, artists, themes, eras) the Eras
  district stood at x=241 with the rail ending at 264; its nameplate read
  "RAS 1". The city is centred on its lattice's bounding diamond, and the
  cards are centred on their plots, which do not fill it; once the city grew
  to give every name its ground it was exactly as wide as the room and 25px
  left of it. The "how much is off the edge" measure counted a card under
  the rail as seen, so nothing tried to move it.
- where it belongs: `packages/layout/src/city.ts` (`placeCity`)
- harness that should have caught it: `the-city-at-altitude.test.ts` uses
  four kinds and no rails; `audit-ui` photographs todo's four districts
- status: fixed in "walkthrough: B · the city stands beside the rails" ·
  out of sight now means under a rail as well as off the canvas, and a city
  whose districts fit between the rails slides the least distance that puts
  every one of them there (carried through a zoom). Criterion: layout
  `the-city-stays-beside-the-rail.test.ts` at 1280 and 1560 (verified
  failing without the fix: `kind:era: expected 241.08 to be ≥ 264`).
