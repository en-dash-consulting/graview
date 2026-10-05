---
id: "b2d7f4c1-8e5a-4c39-9d6b-1f0e2a3b4c5d"
level: "task"
title: "A plot on the garden map is sized to the ground it lies on, contents included"
status: "completed"
priority: "medium"
tags:
  - "seedbed"
  - "design"
  - "bug"
source: "Nick, 2026-09-28: \"this part of the demo has a ui bug on the plots visual\" (screenshot of chapter thirteen's almanac in the docs-site embed: labels cut to \"Plo…\", the caretaker badge off the tile's edge, the last bed outside it)"
startedAt: "2026-09-28T02:00:00.000Z"
completedAt: "2026-09-28T02:30:00.000Z"
endedAt: "2026-09-28T02:30:00.000Z"
resolutionType: "code-change"
resolutionDetail: "apps/seedbed/src/ui/garden-map.tsx: a plot is never narrower than its own name (min-width: max-content) at a legible floor — 11px type, an 18px badge, 13px beds — and its contents take a share of a wide ground above that; the ground has a least width of 340px, past which it scrolls sideways inside its own region rather than shrinking the type. A first cut that scaled the type down with the ground fixed the spill and made the names 9px, which Nick called out as not accessible. Measured at 1280, 700, 390 and 320: no label cut, nothing spills, the page never scrolls sideways, and only the 320 column scrolls the ground. Also in @graview/primitives: a placed board mark is max-content wide, since a token at 82% of a phone-width board shrank to 22px."
acceptanceCriteria:
  - "At every width the almanac's map is drawn at, no plot's label, badge or bed extends past the plot, and the label is at least 11px and never cut"
  - "A ground too narrow for its plots at that size scrolls inside itself; the page does not scroll sideways"
  - "The same drawing in the scene's lens and summary card is unchanged in kind, smaller in dense mode"
description: "A plot's width was a share of the map while its contents were fixed pixels; inside a chapter embed the almanac's map column is about 330px, so a plot was narrower than what it held."
lastModified: "2026-09-28T02:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
