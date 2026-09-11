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
