---
id: "3df1812f-c910-46bc-978b-9ccb7c6b60dc"
type: "capability"
title: "A batch preview is judged as the batch would be: author, via and admit, and the ops as they would be logged (FR-56)"
slug: "a-batch-preview-is-judged-as-the-batch"
statement: "A host previews a batch of calls through the store with the same author, via and admit as the apply would use, and gets back the ops as they would be logged without anything being written."
criteria: [{"id":"c1","text":"When store.previewAll(calls, { author, via, admit }) (or applyAll with dryRun: true) is called, the store shall refuse exactly when applyAll with the same options would refuse, on role, sight, guard, and whatever admit throws."},{"id":"c2","text":"When a batch is previewed, the store shall return the ops as they would be logged, with ids and seq marked as not kept, together with violationsAfter."},{"id":"c3","text":"While previewing a batch, the store shall write nothing, log nothing and tell nothing."},{"id":"c4","text":"When Cloud's request.preview in packages/room/src/room.ts previews a batch, it shall use the store's preview without a buildStore copy, leaving the preview tests in packages/room/tests/room.test.ts unchanged."}]
tags:
  - "graview-cloud"
  - "FR-56"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
priority: "high"
---

previewAll(calls, context) takes no author, via or admit, and its Preview carries no ops, so a host showing 'this is what will happen' rehearses on a copy of the store. The preview must refuse and report exactly as the apply would.
