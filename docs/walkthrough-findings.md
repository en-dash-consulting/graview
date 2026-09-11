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
