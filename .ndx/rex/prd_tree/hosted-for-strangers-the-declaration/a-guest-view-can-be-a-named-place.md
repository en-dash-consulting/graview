---
id: "75bf0747-56bd-4408-8793-6eb832a7e98c"
level: "feature"
title: "A guest view can be a named place: guestView takes a title (FR-87)"
status: "completed"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-87"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
acceptanceCriteria:
  - "guestView({ …, title }) forwards the title to the frame's accessible name, and register(…, { title }) makes it a place on both faces"
  - "A titled guest view appears as a place by that title with an address (in.view=<slug>)"
description: "guestView takes no title. For owner-uploaded frames; the worker form is FR-91."
lastModified: "2026-10-06T03:56:09.000Z"
---
