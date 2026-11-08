---
id: "96baa7eb-20ab-4788-b7e0-74e739225a28"
type: "change"
title: "A document can say a kind's glance fields, and the compiler stops asking for what it cannot say (FR-39)"
slug: "a-document-can-say-a-kind-s-glance"
intent: "compileDocument tells a document's author to say display.glance, which the document format had no way to say."
acceptanceCriteria:
  - "The document format takes kinds.<k>.glance (field names, checked like any other name, renamed by editDocument), compiled to display.glance"
  - "check:glance-unchosen is not emitted for a document that says one"
touches:
  - "1568db6c-9752-428a-b840-9a11dc84cf13"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-39"
source: "Graview Cloud FR-39, 2026-10-03 (brief after 0.1.2)"
---
