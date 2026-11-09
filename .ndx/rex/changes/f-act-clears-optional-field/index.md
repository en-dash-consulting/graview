---
id: "1a8457bc-099e-4450-857e-55cbc6c5cbc4"
type: "change"
title: "A document act clears an optional field when its effect sets it to null"
slug: "f-act-clears-optional-field"
intent: "Found building Graview HQ's lease kind (2026-11-08). A document act with `\"effects\": [{\"set\": {\"holder\": null}}]` on a kind whose `holder` is an optional string is refused: `does not match what lease declares — Holder: Invalid input: expected string, received null`. Clearing an optional field is ordinary (unassign, release, clear a date); the effect should remove the value. HQ works around it with a sentinel date."
acceptanceCriteria:
  - "A document act whose effect sets an optional field to null removes the value from the record (unit test)"
  - "Setting a required field to null is still refused, in words that name the field (unit test)"
  - "graview check accepts a null set on an optional field and flags one on a required field"
touches:
  - "cdd910b9-7729-4f95-a821-3d59c35edb3b"
priority: "high"
tags:
  - "graview"
  - "core"
  - "document"
  - "hq:feature:f-act-clears-optional-field"
source: "Graview HQ feature:f-act-clears-optional-field, from request:a-document-act-can-t-clear-an-optional-field-setting-it-to-null-is-refused"
---
