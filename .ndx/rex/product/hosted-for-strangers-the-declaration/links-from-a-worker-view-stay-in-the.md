---
id: "ff8f3a6a-c556-4d4d-af6d-8b3909283a50"
type: "capability"
title: "Links from a worker view stay in the app (FR-93)"
slug: "links-from-a-worker-view-stay-in-the"
statement: "A worker view navigates only to records or places of its own app and never carries the reader to an external address."
criteria: [{"id":"c1","text":"A worker view shall navigate only to a record of its app, identified by id, or to a place of its app, identified by place slug."},{"id":"c2","text":"When a worker view contains an external URL, the host shall not render it as a link."},{"id":"c3","text":"When a worker view contains href=\"https://…\", the host shall draw it as text."},{"id":"c4","text":"When a worker view navigates to a record or place, the host shall carry the reader there on both faces."}]
tags:
  - "graview-cloud"
  - "FR-93"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "medium"
---

A view must not carry the reader off the app.
