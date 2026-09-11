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
