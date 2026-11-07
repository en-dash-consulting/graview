---
id: "0ee61f71-18eb-456e-ac55-ed26585e2d70"
type: "capability"
title: "What the 0.1.29 wave left: archives in documents, keep-link per relation, import upserts"
slug: "what-the-0-1-29-wave-left-archives-in"
statement: "A Graview document can declare that a kind does not archive, a keep-link act is permitted per relation, and importing rows can match existing records and update them instead of duplicating them."
criteria: [{"id":"c1","text":"When a document says kinds.<kind>.archives: false, the product shall accept that declaration for the kind."},{"id":"c2","text":"The product shall permit keep-link per relation, as it would permit connects, and not to anyone holding any create act."},{"id":"c3","text":"When importRows finds an existing record matching by label or by a key column, importRows shall update that record instead of creating a duplicate."}]
tags:
  - "roadmap"
  - "0.1.29"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "medium"
resolution: "Shipped on fix/wave-leftovers-core: a document's `kinds.<kind>.archives: false` (compile, toDocument, describeApp, the checker's grant-act, `set-archives` with its sentence, the studio's round trip); `keep-link` permitted only through acts whose connects/severs name the link's relation; `importRows`/`previewImport` `match: \"label\" | { column, field }` changing a found record through `edit-<kind>` in the same batch, with `proposeMapping` suggesting it."
---

Follow-ups the wave named.
