---
"@graview/core": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A coverage orders its rows and its columns, and a status board its cards, as the declaration says. "Releases by era" listed its releases in the order they were written. A coverage lens takes `sort` for its rows and `columnSort` for its columns, and a status board `sort` for the cards in each column, written as a kind's list writes its order: a field (`"released"`), or `{ "by": "released", "direction": "desc" }`, with `label` the record's name; numbers as numbers, words and dates in the page's order, and a record with none last. Within a coverage's row groups the order holds before its `rowRef`. The lens, `describePlace` and the checker read one comparison (`sortForGrid`), and an order by a field the kind does not have is a warning by its path (`lens-sort`, "release has no field "year" to order by …") and draws as written. A document's reader holds the shape. The graview-lens skill says so, and `verify-declared` holds the order in a browser.

Compatibility: ops and stored records are unchanged. A document's lens `options.sort` and `options.columnSort` are held to a field or `{ by, direction: "asc" | "desc" }` by its reader, where any value was passed over before; the coverage and status board lenses take `sort` (and the coverage `columnSort`) as options. `sortForGrid`, `gridSortOf`, `gridSortProblem` and `GridSort` are new on `@graview/core`. A new warning code, `lens-sort`.
