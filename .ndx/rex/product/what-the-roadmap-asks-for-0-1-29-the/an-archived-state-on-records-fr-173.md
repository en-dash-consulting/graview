---
id: "dd8e4788-2c4f-435c-91d6-b7c2c32ab5df"
type: "capability"
title: "An archived state on records (FR-173)"
slug: "an-archived-state-on-records-fr-173"
statement: "Graview lets a record be archived, set aside and kept with its fields, links and history, so that it leaves live lists and counts but can still be found and brought back."
criteria: [{"id":"c1","text":"The store shall provide archive and unarchive primitives, with derived acts archive-<kind> and unarchive-<kind> on every kind, and an archived record shall keep its fields, links and history."},{"id":"c2","text":"While a record is archived, lists, the Scene, counts, computed fields and rules shall leave it out by default."},{"id":"c3","text":"When a person searches for an archived record or opens its page, the product shall find it, mark it archived and offer 'Bring it back'."},{"id":"c4","text":"When a lens, find or the agent's find tool is given archived as true, false or \"all\", it shall return archived records, live records or both accordingly, and when archived is not given it shall return live records only."},{"id":"c5","text":"When two records are merged, the kept record shall take the links of the other, the other record shall be archived with mergedInto on its op, both histories shall be kept, and the merge shall be undoable as one step."},{"id":"c6","text":"When a rule or computed field asks for archived records explicitly, it shall include them."},{"id":"c7","text":"editDocument, the checker, the JSON schema and docs/stability.md shall each describe the archived state."}]
tags:
  - "roadmap"
  - "f-record-archive"
  - "FR-173"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "critical"
resolution: "Shipped on feat/fr-173-archived-records: archive-<kind>, unarchive-<kind> and merge-<kind> on every kind (ctx.archiveNode, unarchiveNode and mergeNode; `$archived: true` on the record, `mergedInto` on a merge's op), and every listing graph read, rule, computed field, lens and agent find reaches live records unless given archived: true or \"all\", while search, a read by id and the record's page, with Bring it back, still find it."
---

A record is present or removed; the only archive in core is the op log's. Pruning that keeps an app tidy must archive and never delete. Roadmap f-record-archive; unblocks Cloud's f-auto-pruning.
