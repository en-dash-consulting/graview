---
id: "297a8ec3-3fe8-48df-a7b2-5a90da49f2df"
type: "capability"
title: "The server pushes that the declaration changed, and a remote client reopens on it (FR-43)"
slug: "the-server-pushes-that-the-declaration"
statement: "The server pushes a declaration-changed message to connected clients, and a remote client reopens its store on the server's migrated state without a reload."
criteria: [{"id":"c1","text":"When the declaration changes, the server shall send clients a message of the form { t: \"declaration\", version }."},{"id":"c2","text":"When the server announces a changed declaration, openRemote's onDeclaration(listener) shall hand the listener a new store opened on the server's migrated state."},{"id":"c3","text":"When the declaration changes, every open client shall move to the new declaration without a reload, with pending calls offered again or refused in words."}]
tags:
  - "graview-cloud"
  - "FR-43"
source: "Graview Cloud FR-43, 2026-10-03 (brief after 0.1.2)"
priority: "medium"
---

Structural changes made from chat or graview.cloud must reach open tabs without a reload.
