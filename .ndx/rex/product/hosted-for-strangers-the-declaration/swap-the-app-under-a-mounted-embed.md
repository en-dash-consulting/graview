---
id: "b70163bd-9b16-46c9-a08d-3b5d571c59bb"
type: "capability"
title: "Swap the app under a mounted embed without losing the reader's place (FR-116)"
slug: "swap-the-app-under-a-mounted-embed"
statement: "A host can swap the app under a mounted embed through its handle, and the reader keeps their place on Pages and in the scene."
criteria: [{"id":"c1","text":"When a host calls handle.setApp(app, store) across a declaration change, the embed shall keep the face, the place or record open on Pages, and the scene's stop and focus."},{"id":"c2","text":"If a place, record, stop or focus no longer exists after a declaration change, the embed shall fall back to its nearest parent."},{"id":"c3","text":"When a chat changes the views in Cloud, the embed shall leave a reader on Pages, or a scene focused on a record, where they were."},{"id":"c4","text":"If a declaration change removes the kind a reader is on, the embed shall land the reader on the home."}]
tags:
  - "graview-cloud"
  - "FR-116"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
priority: "high"
---

A declaration change needs a remount; Cloud now keeps the face via onDrawn but can't carry the route or the scene's stop/focus.
