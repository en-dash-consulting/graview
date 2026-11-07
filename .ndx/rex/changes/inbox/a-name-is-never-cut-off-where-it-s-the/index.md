---
id: "335b3c04-fcc7-4ad6-a39f-0d714009eb0d"
type: "change"
title: "A name is never cut off where it's the thing to read (FR-118)"
slug: "a-name-is-never-cut-off-where-it-s-the"
intent: "Place tiles in the scene drew 'Who o…', 'Strengt…'; top-bar place names were cut to half; a cut-off name with no way to see the rest is a dead end on a phone."
acceptanceCriteria:
  - "A record's or place's name wraps to two lines before it shrinks or clips; badges, numbers and progress labels never truncate (their row gives way first, FR-113)"
  - "Anything still clipped carries its full text as its accessible name and title, and a tap shows it on a phone"
  - "A place tile too small to say its name says it beside the tile or isn't drawn at that size; the scene's lens preview is drawn large enough to read or says the place in words"
  - "Measured (text leaf with scrollWidth > clientWidth under ellipsis/overflow hidden/line clamp, excluding sr-only): no text cut off on the four screens measured; every place tile in the org app's scene says its whole name, checked by eye"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-118"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "The scene stays standing — error boundary, chrome floors, phone width, the view in the URL" (4382c67b-1055-4623-b8fb-62b9be3fa330).
