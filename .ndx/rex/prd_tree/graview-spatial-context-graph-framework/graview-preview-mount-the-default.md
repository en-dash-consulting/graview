---
id: "ead25e4a-f355-4656-bfbe-6c3510ff9220"
level: "feature"
title: "graview preview: mount the default faces on a document with no product"
status: "completed"
source: "n-dx-graview"
startedAt: "2026-10-11T02:05:00.000Z"
completedAt: "2026-10-11T03:10:00.000Z"
endedAt: "2026-10-11T03:10:00.000Z"
acceptanceCriteria: []
description: "graview serve serves the store (HTTP plus the WebSocket wire) and draws nothing, so a stranger holding only a JSON document and a seed has no way to look at it: the scene and the pages need a product. A graview preview <document> --seed <snapshot> that mounts the default faces (scene and pages, Graview's own shell) over the served store would be what serve already looks like it does. Surfaced by n-dx-graview, the product n-dx's projection is drawn with; see its UPSTREAM.md."
lastModified: "2026-10-11T03:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Subsumed by 'graview preview and graview shots' (what n-dx surfaced), done in #200."
---
