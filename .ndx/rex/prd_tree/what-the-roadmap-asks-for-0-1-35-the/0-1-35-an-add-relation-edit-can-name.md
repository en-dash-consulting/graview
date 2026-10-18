---
id: "ba2f6434-e66a-47e3-af36-d7480da48d64"
level: "task"
title: "0.1.35 · An add-relation edit can name another app's kind"
status: "completed"
priority: "high"
startedAt: "2026-10-18T16:30:00.000Z"
completedAt: "2026-10-18T19:30:00.000Z"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
acceptanceCriteria:
  - "editDocument with add-relation to [\"@nick/house/house\"] gives a document that checks clean, with a test that fails on 0.1.34"
  - "a mixed or two-app to is refused with the checker's own finding (linked-mixed, linked-apps), and rename-relation / remove-relation work on a far relation"
  - "the said sentence names the far kind as people say it; the studio and propose_change can make the relation"
description: "Roadmap f-add-relation-far-kind. packages/core/src/document/edit.ts addRelation checks every to against this.doc.kinds and refuses @<address>/<kind>, so only a whole document can declare a cross-app relation (0.1.30 f-cross-app-relations); Cloud's builder, propose_change with edits and the studio cannot."
lastModified: "2026-10-18T16:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

- `addRelation` (packages/core/src/document/edit.ts) judges a `to` that names another app with `linkedRelationFindings`, now its own module (`document/linked-relation-findings.ts`) shared by the checker's `linkedFindings` and the edit, so the edit carries no compiler. A refusal is the checker's finding at `edits.<n>.to` / `.inverse` / `.appendOnly` (`linked-mixed`, `linked-apps`, `linked-target`, `linked-inverse`, `linked-append-only`); a `to` like `"@nick"` is already refused by the document's own shape. Said: `scenario gains a relation, "forHouse", to one house in the app @nick/house, another app, read there as whoever is looking.` (many: `houses or flats in the app ...`).
- Found on the way: `planMigration` dropped a far relation's values on every migration (it carried declared fields only). It now keeps them, moves them with a rename (`"forHouse" renamed to "home", links kept`) and clears them with the relation.
- The studio read a far relation as a text field. It now reads it as an edge with `toAnotherApp`, makes one with `add-edge-to-another-app` (last in the studio's acts so a kind's strip keeps "Add a field" above the fold), says it as `add-relation`, and writes it back as `linkedRecordField([...]).optional()`.
- Tests, failing first: packages/core/tests/document/an-add-relation-edit-can-name-another-apps-kind.test.ts (8 of 9 failed on 0.1.34 with the "is not a kind this app has" refusal; the migration claim failed with the value patched to unset) and packages/studio/tests/unit/the-studio-makes-a-relation-to-another-apps-kind.test.ts (5 of 5 failed). Both pass; full `pnpm test` green; `pnpm typecheck` clean.
- Budget raises: scripts/budget-raises/an-add-relation-edit-names-another-apps-kind-{without-the-studio,every-face}.json (770 / 317 and 3_252 / 1_003).
- Harness: `GRAVIEW_PORT_BASE=5600 pnpm verify studio --quick` fails at the claim after `itOpensTheRunningAppsOwnDeclaration` (waiting for "Add a field" on the task's inspector strip), and fails the same way with this change's sources reverted, so it is not this change's.

