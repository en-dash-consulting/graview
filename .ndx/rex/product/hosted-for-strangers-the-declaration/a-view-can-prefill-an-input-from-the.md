---
id: "b908bbd4-be86-4ade-88f2-05edbae5b15d"
type: "capability"
title: "A view can prefill an input from the record it draws (FR-150)"
slug: "a-view-can-prefill-an-input-from-the"
statement: "A view can prefill an input or textarea from the record it draws, so a long text is edited in place with its line breaks kept."
criteria: [{"id":"c1","text":"When a view offers an input or textarea prefilled from the record it is drawing, the host shall fill it only with fields the seat may see and the act may write."},{"id":"c2","text":"When a long text is edited in a view, the view shall keep the text's line breaks."}]
tags:
  - "graview-cloud"
  - "FR-150"
  - "views"
  - "security"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
priority: "high"
resolution: "Shipped in #157, merged through #162 (0.1.18): an input or textarea a view draws with data-prefill is filled by the host from the record, only where the seat may write it."
---

The guide says 'Do not prefill', so editing a 3,000-character draft in a view means retyping all of it.
