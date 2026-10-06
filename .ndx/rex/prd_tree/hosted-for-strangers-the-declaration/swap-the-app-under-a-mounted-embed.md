---
id: "b70163bd-9b16-46c9-a08d-3b5d571c59bb"
level: "feature"
title: "Swap the app under a mounted embed without losing the reader's place (FR-116)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-116"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
startedAt: "2026-10-06T21:57:31.000Z"
completedAt: "2026-10-06T21:57:31.000Z"
endedAt: "2026-10-06T21:57:31.000Z"
acceptanceCriteria:
  - "handle.setApp(app, store) (or route and stop readable from the handle) keeps the face, the place or record open on Pages, and the scene's stop and focus across a declaration change; anything gone falls back to its nearest parent"
  - "In Cloud a reader on Pages at The packages (or the scene focused on a record) is still there after a chat changes the views; a reader on a removed kind lands on the home"
description: "A declaration change needs a remount; Cloud now keeps the face via onDrawn but can't carry the route or the scene's stop/focus."
lastModified: "2026-10-06T21:57:31.000Z"
---
