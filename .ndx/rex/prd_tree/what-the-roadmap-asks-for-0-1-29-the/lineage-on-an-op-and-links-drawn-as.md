---
id: "070f2fa5-dca0-4c57-b8e3-b9ffa04c9182"
level: "feature"
title: "Lineage on an op, and links drawn as provisional until a person touches them (FR-172)"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "f-op-lineage"
  - "FR-172"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
startedAt: "2026-10-13T02:50:00.000Z"
completedAt: "2026-10-13T03:40:00.000Z"
endedAt: "2026-10-13T03:40:00.000Z"
lastModified: "2026-10-13T03:40:00.000Z"
resolution: "Shipped on feat/fr-172-op-lineage: an op carries a checked `lineage` (on the op, not the Author) in the log, on the batch and on the wire, said on history lines and a record page; a link made at confidence below 1 by anyone but a person is provisional (dashed in the scene with its basis on hover and in its acts, an \"unsure\" mark on Pages) until a person's `keep-link` or removal, read through `@graview/core/provenance`; an undo keeps the declined op's lineage as `undoneLineage`."
acceptanceCriteria:
  - "An op (or its Author) may carry lineage: { basis: string; confidence?: number; model?: string }, kept in the log and on the wire, and said on the history line and the record's card"
  - "A link whose making op carries confidence below 1 draws as provisional (dashed in the Scene, a small mark on Pages, the basis on hover or long-press) until an op by a person touches it"
  - "Touching it (an accept act or any edit by a person) makes it an ordinary link"
  - "An undo of such an op keeps the undone op's lineage, so a host can read 'do not make this again'"
  - "A changeset with a Compatibility line names FR-172"
description: "Author is kind, id, session, name, onBehalfOf; nothing says what a change was based on or how sure its maker was. Cloud's tidying actor needs to show why and to draw its links quieter until accepted. Roadmap f-op-lineage; unblocks f-auto-lineage."
---
