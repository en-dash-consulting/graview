---
id: "68f1edc5-76f7-4a99-b3b8-ca80400527a7"
level: "task"
title: "Content is migrated as steps, and graview sync-seed diffs the seed against the live store into them"
status: "completed"
priority: "high"
blockedBy:
  - "a2763f5d-2ee2-4085-bcf7-507852f30ae5"
startedAt: "2026-09-28T20:12:35.145Z"
completedAt: "2026-09-28T20:12:35.145Z"
endedAt: "2026-09-28T20:12:35.145Z"
resolutionType: "code-change"
resolutionDetail: "steps.ts gains put-node/patch-node/drop-node/put-edge/drop-edge, idempotent against the stored graph; primitivesForSteps runs steps in sequence (what the studio assumed). sync-seed.ts: seedSteps(seed, live, {prune}), contentOperation, applySteps (one op authored ship:sync-seed via store.receive). `graview sync-seed` in ship's cli with shared backendFrom; loadApp exported from core/cli. README says seed is read once. Test default-content-moves-without-a-wipe.test.ts rehearses seed → edit → bump → sync → undo. Commit c35dc76."
acceptanceCriteria:
  - "MigrationStep gains put-node, patch-node, drop-node, put-edge and drop-edge; each is idempotent against the stored graph (a node already there is not put twice) and sayStep reads as a sentence"
  - "seedSteps(seed, live) yields exactly the steps that make live contain the seed: missing nodes put, differing seed-set fields patched, missing edges put; with prune, live-only nodes and edges dropped"
  - "graview sync-seed <entry> --seed <file> --data <dir> prints the steps and exits 0 without writing; --apply lands one system op (author ship:sync-seed) through the adapter, logged and undoable; a second run finds nothing to do"
  - "openStore's docs and ship's README say seed is first install only and that sync-seed, not fresh, is how default content moves"
  - "A unit test rehearses: seed, edit live, bump the seed, sync, and the person's edit survives"
description: "Schema migrations stay as they are. The step DSL gains content steps — put-node, patch-node, drop-node, put-edge, drop-edge — each idempotent against the stored graph at the moment it runs, so default content can be versioned with the app in migrations[]. graview sync-seed <entry> --seed <file> [--data|--sqlite] diffs the bootstrap seed against the live snapshot and prints the steps as sentences; --apply lands them as one system-authored, logged, undoable operation through the adapter; --prune also drops what the seed no longer has. Seed remains first-install only, said so in openStore's docs; ?fresh=1 stops being the redesign tool."
lastModified: "2026-09-28T20:12:35.212Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
