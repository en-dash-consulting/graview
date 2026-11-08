---
id: "9c4e2b7a-5d1f-4a83-b6e0-7f2c8d9a1b3c"
type: "change"
title: "The board lens draws a token when a code is a word, and shelves a zone's slots when the arrangement is categories"
slug: "the-board-lens-draws-a-token-when-a"
intent: "The board lens drew every slot as a fixed 34px disc printing the slot's code, which is the slot's whole label unless a short code is bound. That fits a pitch (GK, LB) and nothing else. Slots were placed at the domain's x/y with no size awareness, so a shared seat's stacked names hit the next row; occupantLabel: given was a patch on that symptom. Zone labels lived in a 15px vertical rail with overflow hidden and clipped mid-word."
acceptanceCriteria:
  - "A board of word codes draws every slot as a token whose code never overflows its mark; a board of initials still draws discs"
  - "A shared seat's two names sit inside the mark and cannot collide with the row beneath"
  - "With arrange: shelf, each zone is a band headed by its full name with its slots in the domain's order, and nothing overlaps at any width"
  - "Zone names in exact mode are never clipped to the middle of a word"
  - "org-graview's Load map renders cleanly; seedbed's What grows where still renders; board tests pass"
priority: "high"
tags:
  - "lenses"
  - "board"
  - "design"
  - "org-graview-feedback"
source: "Nick, 2026-09-28: \"this lens with all the circles is pretty weak. very difficult to get it to render cleanly. only works for things like the squad demo where positions have initials. breaks for most of user cases we have in play\" (screenshot of org-graview's Load map)"
---
