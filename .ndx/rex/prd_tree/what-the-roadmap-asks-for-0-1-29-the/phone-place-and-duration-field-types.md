---
id: "7d500b49-0bf5-4b9f-b020-db6105c6cefb"
level: "feature"
title: "Phone, place and duration field types"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "0.1.29"
  - "f-more-field-types"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
acceptanceCriteria:
  - "phone: a tel: link, formatted for the locale, validated loosely"
  - "place: a line that opens in the reader's maps app"
  - "duration: said as '1 h 30 min', summed in computed fields"
  - "each in FIELD_TYPES, the schema, the checker, editDocument, forms, cards, the tools' JSON Schema format, importRows coercion and graview types"
  - "a changeset with a Compatibility line"
description: "FIELD_TYPES lacks phone, place and duration; templates hold them as strings."
---
