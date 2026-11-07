---
id: "106af948-d546-442a-81ba-ec4a037c9098"
type: "capability"
title: "Bring a spreadsheet in: rows to records as one undoable batch (FR-177)"
slug: "bring-a-spreadsheet-in-rows-to-records"
statement: "Graview imports a spreadsheet's rows into an app's records as one undoable batch."
criteria: [{"id":"c1","text":"When rows and a column mapping are given, importRows in core shall map columns to fields and relations of the target kind."},{"id":"c2","text":"When a column names another kind's record, importRows shall link that record by its label."},{"id":"c3","text":"importRows shall coerce each cell by the document's field types: dates, numbers with units, enums by option label, and booleans."},{"id":"c4","text":"The import preview shall say per row what would be made, linked and refused, and why."},{"id":"c5","text":"When an import is applied, importRows shall land all rows as one batch that can be undone as one."},{"id":"c6","text":"The import shall attribute the batch to the importer with via import."},{"id":"c7","text":"When given a header row, proposeMapping shall propose a column mapping for the seat or a builder."}]
tags:
  - "roadmap"
  - "f-import-rows"
  - "FR-177"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "medium"
resolution: "Shipped on feat/fr-177-import-rows: `@graview/core/import` with importRows/previewImport (typed coercion, links by label under the importer's sight, one batch via import, policy and admit honored, refusals per row in words), proposeMapping and parseCsv; a library function, no agent tool."
---

Nothing in core or ship takes rows; a spreadsheet becomes an app only by a chat retyping act_batch fifty at a time. Roadmap f-import-rows; Cloud's half f-import-rows-cloud.
