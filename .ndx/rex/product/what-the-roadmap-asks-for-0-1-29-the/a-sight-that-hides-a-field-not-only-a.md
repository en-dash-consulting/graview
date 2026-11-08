---
id: "a19f259d-65db-40cc-8a42-37e58a119319"
type: "capability"
title: "A sight that hides a field, not only a kind"
slug: "a-sight-that-hides-a-field-not-only-a"
statement: "A role's sight can hide individual fields of a record, so a seat sees the record's other fields but not the hidden ones, such as parents seeing names but not phone numbers on a roster."
criteria: [{"id":"c1","text":"When a role's sight declares sees[].fields or hide: [...], the system shall judge the hidden fields in the seat view, on the wire and in tools."},{"id":"c2","text":"When a field is hidden from a seat, forms, cards, describe, search, the served log, static pages and import shall honor the hiding."},{"id":"c3","text":"If a label or describe template reads a hidden field, graview check shall flag it."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "f-field-sight"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "high"
resolution: "A sight says `hide` or `fields` (sights add up), judged in the seat view by `@graview/core/field-sight` so the record, log, answers, conflicts, search, names, forms, imports, static pages and tools never carry a kept field and a write of one is refused as an argument the act does not take; it fails closed until loaded. graview check says sight-names-an-unknown-field, sight-hides-a-required-field and sight-hides-a-labeled-field."
---

A role sees a whole record or none of it; a roster where parents see names but not phone numbers needs field-level sight.
