---
id: "297a8ec3-3fe8-48df-a7b2-5a90da49f2df"
level: "feature"
title: "The server pushes that the declaration changed, and a remote client reopens on it (FR-43)"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-43"
source: "Graview Cloud FR-43, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "A server message ({ t: \"declaration\", version }) tells clients the declaration changed"
  - "openRemote's onDeclaration(listener) hands back a new store opened on the server's migrated state"
  - "Two open clients both move to the new declaration with pending calls offered again or refused in words, and no reload"
description: "Structural changes made from chat or graview.cloud must reach open tabs without a reload."
lastModified: "2026-10-03T17:32:15.000Z"
---
