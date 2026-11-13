---
id: "017185e7-77f8-44f9-9544-05ba0ce2bb84"
type: "change"
title: "On a laptop, the one face's Nearby panel opens at about half the window, and a dragged width is kept"
slug: "f-one-face-wider-panel"
intent: "Nick, 2026-11-13: \"i think L1 can open a bit wider on a laptop screen. looks like it defaults to 30 or 40%.. thinking 50 or 60 would be better\". Today panelRange in packages/pages/src/one-place-geometry.ts defaults to 36% clamped to 420-760 px; a dragged width is not kept; a host cannot set it. Ask: on a laptop or desktop the default is about 55% with a cap so a wide monitor leaves the city a useful band; a dragged width is remembered per app on that device; optionally a host or app sets the default (e.g. `panel: 0.55` on mount). The phone sheet's 40% is out of scope."
acceptanceCriteria:
  - "At 1280 and 1520 wide the panel opens at 55% of the window, and no wider than its cap on a wide window (test)"
  - "A width dragged to is the width the panel opens at on the next visit to that app in that browser (harness)"
  - "A mount's `panel` option sets the default width, and a dragged width still wins (test)"
  - "The phone sheet's default is unchanged (test)"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "embed"
  - "hq:feature:f-one-face-wider-panel"
source: "Graview HQ feature:f-one-face-wider-panel"
---
