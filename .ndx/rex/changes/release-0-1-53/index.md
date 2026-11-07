---
id: "54ceb1e9-2ba5-4d4e-84c2-eb1b4fefe8a7"
type: "change"
title: "0.1.53: The scene keeps up on a large app and its grid moves with the picture; views fit a phone and draw more; a store never reuses an id; a visitor's form loads light."
slug: "release-0-1-53"
intent: "What 0.1.53 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "The scene on a large app. A drag sets no React state, letting go costs about a third of what it did, and nothing animates to where it already is. Returning to the overview no longer stalls: its ribbons are routed once, remembered, and routed between frames when new. Every grid under the picture moves with it while it is dragged and does not jump when it is let go. A line lands on the card it joins even when the card's words settle a frame late."
  - "Views on phones. A view's wide content scrolls inside it instead of widening the page; `bleed` works on a view's place; a fallback page keeps its gutters; a view that draws its own heading says `heading: \"own\"` and is titled once; Seen in names each place once."
  - "What a view may draw. A named `region`, links inside a view's SVG, a card with its link on its heading, `mask-image`, `-webkit-text-stroke`, scroll-driven animation and SVG filters. `@property`, SMIL and `feImage` are refused, and the check says why."
  - "For hosts. A store never names a new change with an id its log already holds; a deleted view never draws, a home's included; an import links a cell to any row of the same sheet, in one batch; a visitor's form loads from `@graview/primitives/form`, about 40% lighter. A view that fell back says which and why (`data-worker-view-fell-back`)."
shippedIn: "0.1.53"
tags:
  - "backfill"
  - "0.1.53"
source: "apps/site/releases.json"
---
