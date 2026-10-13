---
id: "106af948-d546-442a-81ba-ec4a037c9098"
level: "feature"
title: "Bring a spreadsheet in: rows to records as one undoable batch (FR-177)"
status: "pending"
priority: "medium"
tags:
  - "roadmap"
  - "f-import-rows"
  - "FR-177"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
acceptanceCriteria:
  - "importRows(store, kind, rows, mapping) in core: columns to fields and relations; a column naming another kind's record links it by label"
  - "Coercion by the document's types: dates, numbers with units, enums by option label, booleans"
  - "A preview says per row what would be made, linked and refused, and why"
  - "The import lands as one batch, undoable as one, attributed to the importer with via import"
  - "A mapping can be proposed from the header row (proposeMapping) for the seat or a builder"
  - "A changeset with a Compatibility line names FR-177"
description: "Nothing in core or ship takes rows; a spreadsheet becomes an app only by a chat retyping act_batch fifty at a time. Roadmap f-import-rows; Cloud's half f-import-rows-cloud."
---
