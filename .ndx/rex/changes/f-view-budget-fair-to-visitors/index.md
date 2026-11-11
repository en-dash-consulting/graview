---
id: "140406eb-f734-48ec-b0b7-aea3a96ed2a6"
type: "change"
title: "A stopped view names the clock that stopped it, and a stopped home falls back to the built-in home"
slug: "f-view-budget-fair-to-visitors"
intent: "Cloud, 2026-11-10: a visitor's home view was stopped with \"It took longer than 3,000 ms to draw what it was shown\" when the draw budget (300 ms of a second) was what stopped it, and with no home of the app's own the host listed every record in its place. Ask: say the clock that stopped the view by its own number; fall back to the app's built-in home (what ?drawn=built-in shows); and keep the draw budget to the view's own drawing, never the host preparing pictures for a seat."
acceptanceCriteria:
  - "A view stopped by the draw budget is told the draw budget's number, not the push's (test)"
  - "A home view that stops, on an app that declares no home, is replaced by the built-in home marked with the view's name and the reason (test)"
  - "A draft home view that stops still says why in its place"
  - "What the draw budget counts is the host drawing one batch the view sent and linking it; the props and pictures a push carries are made before the push's clock starts"
touches:
  - "1cccd24b-2ecb-4ffe-858b-377eed4693c6"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "pages"
  - "hq:feature:f-view-budget-fair-to-visitors"
source: "Graview HQ feature:f-view-budget-fair-to-visitors"
---
