---
id: "85fdaf73-cb53-4a27-bc35-ab0d6cc93df1"
level: "feature"
title: "The places list renders once as it opens (FR-158)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-158"
  - "bar"
  - "places"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
acceptanceCriteria:
  - "Opening More renders the list once, already ranked; its entries' nodes are not replaced while it stays open"
  - "A harness holds an entry from before the open and presses it after"
description: "The 0.1.20 bar ranks places and folds the rest into More; opening More rendered the list, then rendered it again with the ranking, so a press between the two landed on a node no longer in the document (Playwright: element is not attached; on a slow phone a tap does nothing or hits the entry that moved there)."
lastModified: "2026-10-10T16:00:00.000Z"
---
