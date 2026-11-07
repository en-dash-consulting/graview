---
id: "7d500b49-0bf5-4b9f-b020-db6105c6cefb"
type: "capability"
title: "Phone, place and duration field types"
slug: "phone-place-and-duration-field-types"
statement: "Graview offers phone, place and duration as field types, each carried through the schema, the checker, document editing, forms, cards, tool schemas, row import and type generation."
criteria: [{"id":"c1","text":"When a field is of type phone, Graview shall present its value as a tel: link formatted for the locale and validate it loosely."},{"id":"c2","text":"When a field is of type place, Graview shall present its value as a line that opens in the reader's maps app."},{"id":"c3","text":"When a field is of type duration, Graview shall say its value as '1 h 30 min' and sum durations in computed fields."},{"id":"c4","text":"Graview shall include phone, place and duration in FIELD_TYPES, the schema, the checker, editDocument, forms, cards, the tools' JSON Schema format, importRows coercion and graview types."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "f-more-field-types"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "high"
resolution: "Shipped `phone`, `place` and `duration` as document field types and `phoneField()`, `placeField()`, `durationField()` in declarations: a phone grouped for a US/Canadian reader and linked tel:, a place linked to the reader's maps app, a duration typed as words, kept as minutes, said \"1 h 30 min\" and summed in computed fields; carried through the schema, checker, editDocument, migrations, forms, cards, record pages, the scene panel, tool JSON Schema (x-graview-type), importRows, graview types and the studio. verify-field-types holds it in three engines."
---

FIELD_TYPES lacks phone, place and duration; templates hold them as strings.
