---
id: "335b3c04-fcc7-4ad6-a39f-0d714009eb0d"
level: "feature"
title: "A name is never cut off where it's the thing to read (FR-118)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-118"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
startedAt: "2026-10-06T22:04:29.000Z"
completedAt: "2026-10-06T22:04:29.000Z"
endedAt: "2026-10-06T22:04:29.000Z"
acceptanceCriteria:
  - "A record's or place's name wraps to two lines before it shrinks or clips; badges, numbers and progress labels never truncate (their row gives way first, FR-113)"
  - "Anything still clipped carries its full text as its accessible name and title, and a tap shows it on a phone"
  - "A place tile too small to say its name says it beside the tile or isn't drawn at that size; the scene's lens preview is drawn large enough to read or says the place in words"
  - "Measured (text leaf with scrollWidth > clientWidth under ellipsis/overflow hidden/line clamp, excluding sr-only): no text cut off on the four screens measured; every place tile in the org app's scene says its whole name, checked by eye"
description: "Place tiles in the scene drew 'Who o…', 'Strengt…'; top-bar place names were cut to half; a cut-off name with no way to see the rest is a dead end on a phone."
lastModified: "2026-10-06T22:04:29.000Z"
---
