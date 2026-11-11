---
id: "b17632cc-f623-4500-8011-e6a5e7d6bad1"
type: "change"
title: "One part of a view that fails falls back alone; the rest of the view still draws"
slug: "f-view-part-fails-alone"
intent: "A worker view is stopped whole when it throws or overruns its budget, and the page shows a fallback. Ask: a view marks parts of what it draws as boundaries; a part that throws, or overruns its own share of the budget, is drawn as a small fallback in its place, the rest of the view stays drawn, and why goes to the owner's console and onProblem. The page's own budget still stops the whole view."
acceptanceCriteria:
  - "A view marks a part with graview.part(name, draw), drawn as an element marked data-part (test)"
  - "A part whose draw throws is drawn as the host's note in its place, the rest of the view drawn, why said in the view's console and to onProblem (test)"
  - "A part past its share of the push (a quarter of pushMs, as fitted) is drawn as the note and not run again while the view is drawn (test)"
  - "The whole-view stop for the page's own budget is unchanged"
  - "A headless run says a failed part as a problem (test)"
  - "In a real browser a view whose part throws is kept and draws the rest (guest-sandbox --transport=limits)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "hq:feature:f-view-part-fails-alone"
source: "Graview HQ feature:f-view-part-fails-alone"
---
