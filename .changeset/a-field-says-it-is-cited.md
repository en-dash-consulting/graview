---
"@graview/core": patch
"@graview/tools": patch
"@graview/guest": patch
"@graview/skills": patch
---

A field says it is cited. A value somebody looked up, like a population, a quote or a founding date, should say where it came from, and a declaration had no way to say so. A document's field now takes `cites`, naming the field or the relation of the same kind that holds its citation (`"population": { "type": "integer", "cites": "source" }`); in code, `markCites(z.number(), "source")`. `citesOf(schema, kind, field)` and `citedFieldsOf(schema, kind)` read it, and `toDocument` writes it back. From that:

- `graview check` refuses a `cites` that names no field or relation of the kind, or the field itself (`field-cites`, an error). It warns of each example in a template's seed that holds a cited value with nothing cited (`field-uncited`), and, with the new `--seed <snapshot.json>`, of each record in a seed. Installing a template is not refused for it.
- `uncitedIn(store)` and `uncitedValues(schema, records, linked)` on `@graview/core/tidying` and `@graview/core/check` list each uncited value with its words ("Lagos's population cites no source"). A relation cites a record when it links something out of it; an empty value is no claim.
- The app's own actor's `dream` report carries `uncited`, as it sees the records, and suggests nothing for them: only a person knows a source.
- A worker view is handed `cites` (kind → cited field → what cites it) and `uncited` (record id → its uncited fields), judged over the viewer's graph, and reads them with `graview.cite(node, field)`, which gives `{ by, relation, cited, source | sources }`, and `graview.uncited(node)`.

The `graview-node-kind` skill says how to declare and check it. Held by new unit tests of core (`a-field-says-it-is-cited`), tools (`the-apps-own-actor-says-what-is-uncited`) and guest (`a-view-says-where-a-cited-value-came-from`).

Compatibility: the declaration and check finding codes — additive: a field may say `cites`, a document without it compiles as before; two new codes, `field-cites` (an error, only where `cites` is said) and `field-uncited` (a warning). The wire — additive: a worker view's props may carry `cites` and `uncited`; a view that reads neither is drawn as before. Ops and primitives, stored formats, and derived tool names and input schemas — unchanged. The JavaScript API is additive (`markCites`, `citesOf`, `citedFieldsOf` on `@graview/core`; `uncitedIn`, `uncitedValues`, `UncitedValue` on `@graview/core/tidying` and `/check`; `DreamReport.uncited`; `graview.cite` and `graview.uncited` in a worker view). What Graview Cloud does: nothing to keep working; to use it, let an app's fields say `cites` and show `field-uncited` or `dream`'s `uncited` where it shows the app's other suggestions.
