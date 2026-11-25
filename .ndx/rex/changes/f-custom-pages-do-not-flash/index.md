---
id: "f66b1045-7e25-40b7-910e-c7589f0188dd"
type: "change"
title: "Going between pages shows a custom page at once, with no flash, above all going back"
slug: "f-custom-pages-do-not-flash"
intent: "From HQ feature:f-custom-pages-do-not-flash: Every visit to a custom page flashes it in after about half a second, even going back to one just left. Measure where the time goes, then show a visited view's last drawing at once and bring it up to date in place, and show no empty or fallback page first when the view is about to arrive. What is kept is per app, seat and version, dropped when the seat or its sight changes, and bounded."
acceptanceCriteria:
  - "Going back to a visited custom page shows no blank or fallback frame (harness claim, frame by frame)"
  - "A kept drawing is never shown to another seat or after its version changes (test)"
  - "First visits and returns are timed before and after"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "react"
  - "guest"
  - "hq:feature:f-custom-pages-do-not-flash"
source: "Graview HQ feature:f-custom-pages-do-not-flash"
---
