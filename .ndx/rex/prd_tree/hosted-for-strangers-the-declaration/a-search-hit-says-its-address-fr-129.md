---
id: "d2fd384e-0bf9-4225-898f-21b14a0518af"
level: "feature"
title: "A search hit says its address (FR-129)"
status: "completed"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-129"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.15)"
startedAt: "2026-10-07T18:35:13.000Z"
completedAt: "2026-10-07T18:35:13.000Z"
endedAt: "2026-10-07T18:35:13.000Z"
acceptanceCriteria:
  - "A node Hit carries address, its record's path on the routed face (as addressOf would spell it); a place hit carries its place's"
  - "Cloud's cross-app search builds no path of its own"
description: "Cloud works out each hit's path from placesOf itself."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #129 (0.1.16): a record, kind or place hit carries address under an optional basePath, and a search of the store itself by a seat with an own sight finds only its own records."
---
