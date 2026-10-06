---
id: "6fb29d72-1be6-4980-8b42-ae60f622c031"
level: "feature"
title: "A host that owns the page gives the routed face the address bar (FR-106)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-106"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.12)"
startedAt: "2026-10-06T20:49:02.000Z"
completedAt: "2026-10-06T20:49:02.000Z"
endedAt: "2026-10-06T20:49:02.000Z"
acceptanceCriteria:
  - "An embed option (routing: \"memory\" | \"address\", or an initial path plus onNavigate) lets the pages face read its route from location and push history; places, records and the home have their own addresses"
  - "Memory routing stays the default for an embed inside somebody else's page"
  - "In Cloud's shell, loading /places/<slug> opens that place; opening a record changes the address; Back returns; a reload stays put; an embed in an article is unchanged"
description: "The embed's routed face runs on a memory router, so in a hosted app a place can't be linked, reloaded or shared; loading /places/vendors-by-status draws the home."
lastModified: "2026-10-06T20:49:02.000Z"
---
