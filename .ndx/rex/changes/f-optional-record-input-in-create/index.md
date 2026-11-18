---
id: "e0dc21c5-4da6-4585-b181-474fc7a7def8"
type: "change"
title: "A create form can take an optional record, drawn as a picker, and links it only when one is chosen"
slug: "f-optional-record-input-in-create"
intent: "From Graview Public tickets on a Thanksgiving app (brief b-cloud-2026-11-18-forms-guide-asks). An act add-dish with effects [{connect: broughtBy, from: $new, to: $to}] makes the household required; args.to {required: false} draws plain text, not a picker, and a preview without it fails 'there is no record \"\"'; optional/when/if on effects and optional on an act are refused as unknown keys. Wanted: an optional record-reference argument drawn as a picker, with the connect effect applied only when it is given, every native field kept (photo upload)."
acceptanceCriteria:
  - "An act argument naming a record with required: false is drawn as a record picker with an empty choice (test)"
  - "Left empty, the act applies and makes no link; chosen, it makes the link (test)"
  - "A preview without it does not fail (test)"
  - "graview check accepts the declaration and says the shape in its words (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-optional-record-input-in-create"
source: "Graview HQ feature:f-optional-record-input-in-create"
---
