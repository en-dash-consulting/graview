---
id: "d598b217-5f7e-4466-b92f-c095a4d5a1de"
level: "feature"
title: "A studio mounted into part of a page draws no main, so a host page has no framework landmark violations (FR-58)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-58"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
startedAt: "2026-10-04T15:31:00.000Z"
completedAt: "2026-10-04T15:31:00.000Z"
endedAt: "2026-10-04T15:31:00.000Z"
acceptanceCriteria:
  - "A studio mounted into an element that isn't the document's whole body draws no main (a labelled region, or a mount option says which)"
  - "axe reports no landmark-main-is-top-level or landmark-no-duplicate-main from the studio mounted through the embed's studio: { onApply }"
  - "Cloud's scripts/a11y.mjs builder pages report no framework-originated landmark violations"
description: "Mounted through the embed's studio: { onApply }, the studio draws <main aria-label='…: studio'> inside the embed's labelled section, so it can never be top-level."
lastModified: "2026-10-04T15:31:00.000Z"
---
