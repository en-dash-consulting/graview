---
id: "3f29a345-94f3-4702-b293-8a859c8c21fe"
type: "change"
title: "The pages face says its problem count and holds its bar at once, not after a quiet while"
slug: "f-pages-face-late-redraws"
intent: "From HQ feature:f-pages-face-late-redraws: In WebKit the pages face's problem count appears only after the page has been still a while (quiet.webkit-rest); at 390 px the routed face redraws its bar after a quiet period (chrome: theBarHoldsStillAndNothingOnItOverlapsAtEveryWidth). The harnesses keep fixed waits there naming each race; fix the pages and take the waits out."
acceptanceCriteria:
  - "quiet's theProblemCountIsSaidOnceAboveTheFold, theBarsProblemCountIsNamedAndOpensFromTheKeyboard and theBarsToolsAreOneSizeAndNamed hold in WebKit without the fixed waits"
  - "chrome's theBarHoldsStillAndNothingOnItOverlapsAtEveryWidth holds at 390 px without the fixed wait"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "primitives"
  - "hq:feature:f-pages-face-late-redraws"
source: "Graview HQ feature:f-pages-face-late-redraws"
---
