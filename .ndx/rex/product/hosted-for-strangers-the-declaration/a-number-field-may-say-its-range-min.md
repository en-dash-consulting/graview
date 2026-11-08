---
id: "a60b249d-ad48-4433-a5ea-72914e06c701"
type: "capability"
title: "A number field may say its range: min, max and step (FR-114)"
slug: "a-number-field-may-say-its-range-min"
statement: "A number or integer field can declare its range with min, max and step, and the product holds every form, input and act to that range."
criteria: [{"id":"c1","text":"A number or integer field shall accept min, max and step as declared options."},{"id":"c2","text":"The checker shall check a number or integer field's min and max against its default."},{"id":"c3","text":"Every form and input shall honour a number or integer field's min, max and step."},{"id":"c4","text":"When an act applies, the product shall enforce a number or integer field's range as validation."},{"id":"c5","text":"A set-options edit or a new edit shall change a number or integer field's min, max and step."},{"id":"c6","text":"When a field is declared level: { type: integer, min: 1, max: 5 }, the form shall not take 9."},{"id":"c7","text":"When an act is given 9 for a field declared level: { type: integer, min: 1, max: 5 }, the product shall refuse it as invalid."},{"id":"c8","text":"If a number or integer field's default lies outside its declared range, then check shall flag it."}]
tags:
  - "graview-cloud"
  - "FR-114"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
priority: "high"
---

A level limited to 1-5 by a rule took 9 and 7 at the form; the document format had no min/max.
