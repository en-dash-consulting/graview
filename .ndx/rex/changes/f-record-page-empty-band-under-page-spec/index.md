---
id: "ec92ebaf-7a59-4cf3-984b-fcd6c0a37836"
type: "change"
title: "A record page with its own page layout draws no empty band between two dividers"
slug: "f-record-page-empty-band-under-page-spec"
intent: "On 0.1.70, a record page whose kind declares `views.<kind>.page` draws the page spec (`section[data-testid=record-view]`), a divider, an empty band about 55px tall, a second divider, then The facts. Without a page spec there is one divider and no band. Reproduced with only `set-view { kind, slot: page, blocks: [{ title: '{name}' }, { text: '…' }] }`; a cardinality-many worker view on the kind changes nothing. On a hosted page it reads as a view that failed to draw. Asked (Cloud brief b-cloud-2026-11-08-record-page-empty-band): a single divider and no band; if the band is a slot for something, fill it or drop it with its divider."
acceptanceCriteria:
  - "A record page with a page spec draws exactly one divider between the spec and The facts, and no empty element between them (unit test on the pages face)"
  - "A record page without a page spec is unchanged"
  - "A harness claim opens such a record page in a real browser and finds no empty band (measured height) between the spec and The facts"
touches:
  - "15e519fe-9ad9-4498-904f-5cd2f77ec15c"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-record-page-empty-band-under-page-spec"
source: "Graview HQ feature:f-record-page-empty-band-under-page-spec, from brief:b-cloud-2026-11-08-record-page-empty-band"
---
