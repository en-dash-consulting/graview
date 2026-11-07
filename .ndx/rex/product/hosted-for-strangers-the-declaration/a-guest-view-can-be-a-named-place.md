---
id: "75bf0747-56bd-4408-8793-6eb832a7e98c"
type: "capability"
title: "A guest view can be a named place: guestView takes a title (FR-87)"
slug: "a-guest-view-can-be-a-named-place"
statement: "A guest view can be registered as a named place that takes a title, which becomes the frame's accessible name and gives the view an address."
criteria: [{"id":"c1","text":"When guestView is given a title, guestView shall forward the title to the frame's accessible name."},{"id":"c2","text":"When register is given a title for a guest view, register shall make the view a place on both faces."},{"id":"c3","text":"When a guest view has a title, the product shall list the view as a place by that title with an address of the form in.view=<slug>."}]
tags:
  - "graview-cloud"
  - "FR-87"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "low"
---

guestView takes no title. For owner-uploaded frames; the worker form is FR-91.
