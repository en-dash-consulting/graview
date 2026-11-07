---
id: "7b6a1f0e-3c2d-4e8f-9a1b-2c3d4e5f6a7b"
type: "change"
title: "A new page opens at its top: the routed face resets the scroll on a new address, and leaves Back to the browser"
slug: "a-new-page-opens-at-its-top-the-routed"
intent: "React Router keeps the window's scroll position across client-side navigations; the face never reset it, and the gallery made the home long enough for that to show."
acceptanceCriteria:
  - "Pressing a card or a kind pill at the foot of the gallery opens the target page scrolled to 0"
  - "Back returns to the gallery where it was left (the browser's own restoration is not overridden)"
  - "Typing into a list filter, which rewrites ?q=, does not move the page"
  - "Inside an embed the frame scrolls, not the host document"
touches:
  - "1e155ee2-de1c-41fd-bfe4-ddaf98a8fdbe"
priority: "high"
tags:
  - "pages"
  - "bug"
source: "Nick, 2026-09-27: \"scroll reset in Pages views isn't working\""
---
