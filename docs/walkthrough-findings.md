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
