---
id: "d598b217-5f7e-4466-b92f-c095a4d5a1de"
type: "capability"
title: "A studio mounted into part of a page draws no main, so a host page has no framework landmark violations (FR-58)"
slug: "a-studio-mounted-into-part-of-a-page"
statement: "A studio mounted into part of a page through the embed draws no main landmark of its own, so the host page has no framework-originated landmark violations."
criteria: [{"id":"c1","text":"When a studio is mounted into an element that isn't the document's whole body, the studio shall draw no main element, using a labelled region or a mount option that says which."},{"id":"c2","text":"When the studio is mounted through the embed's studio: { onApply }, axe shall report no landmark-main-is-top-level and no landmark-no-duplicate-main violation."},{"id":"c3","text":"When Cloud's scripts/a11y.mjs builder pages are checked, they shall report no framework-originated landmark violations."}]
tags:
  - "graview-cloud"
  - "FR-58"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
priority: "medium"
---

Mounted through the embed's studio: { onApply }, the studio draws <main aria-label='…: studio'> inside the embed's labelled section, so it can never be top-level.
