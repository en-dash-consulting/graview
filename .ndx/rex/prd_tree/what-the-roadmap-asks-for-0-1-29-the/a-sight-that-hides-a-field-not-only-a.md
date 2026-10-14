---
id: "a19f259d-65db-40cc-8a42-37e58a119319"
level: "feature"
title: "A sight that hides a field, not only a kind"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.29"
  - "f-field-sight"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
startedAt: "2026-10-14T01:05:00.000Z"
completedAt: "2026-10-14T03:30:00.000Z"
endedAt: "2026-10-14T03:30:00.000Z"
acceptanceCriteria:
  - "sees[].fields or hide: [...] judged in the seat view, on the wire and in tools"
  - "forms, cards, describe, search, the served log, static pages and import honor it"
  - "graview check flags a label or describe template that reads a hidden field"
  - "world-with/world-without tests as for kinds (FR-55)"
description: "A role sees a whole record or none of it; a roster where parents see names but not phone numbers needs field-level sight."
lastModified: "2026-10-14T03:30:00.000Z"
resolution: "A sight says `hide` or `fields` (sights add up), judged in the seat view by `@graview/core/field-sight` so the record, log, answers, conflicts, search, names, forms, imports, static pages and tools never carry a kept field and a write of one is refused as an argument the act does not take; it fails closed until loaded. graview check says sight-names-an-unknown-field, sight-hides-a-required-field and sight-hides-a-labeled-field."
---
