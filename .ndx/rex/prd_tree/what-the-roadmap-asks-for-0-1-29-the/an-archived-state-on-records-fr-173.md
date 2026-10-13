---
id: "dd8e4788-2c4f-435c-91d6-b7c2c32ab5df"
level: "feature"
title: "An archived state on records (FR-173)"
status: "pending"
priority: "critical"
tags:
  - "roadmap"
  - "f-record-archive"
  - "FR-173"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
acceptanceCriteria:
  - "archive and unarchive are store primitives with derived acts on every kind (archive-<kind>, unarchive-<kind>), like remove: the record keeps its fields, links and history"
  - "An archived record is out of lists, the Scene, counts, computed fields and rules by default; search and its own page still find it, marked archived, with 'Bring it back'"
  - "Lenses and find (and the agent's find tool) take archived: true | false | \"all\"; the default is live records only"
  - "A merge of two records: the kept one takes the links, the other is archived with mergedInto on its op, both histories kept, undoable as one"
  - "A rule or computed field may ask for archived records explicitly"
  - "editDocument, the checker, the JSON schema and docs/stability.md say it; a changeset with a Compatibility line names FR-173"
description: "A record is present or removed; the only archive in core is the op log's. Pruning that keeps an app tidy must archive and never delete. Roadmap f-record-archive; unblocks Cloud's f-auto-pruning."
---
