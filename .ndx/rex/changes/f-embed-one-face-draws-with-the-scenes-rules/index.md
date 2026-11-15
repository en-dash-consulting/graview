---
id: "997008c3-dc0a-4ea2-ad15-9a0a21265454"
type: "change"
title: "Through the embed, the one face's city is drawn with the Scene's own rules: no black bands where the districts' ribbons run"
slug: "f-embed-one-face-draws-with-the-scenes-rules"
intent: "Nick, 2026-11-14, on an app Graview Cloud hosts through the embed: large black polygons fill the ground between districts at Nearby and City. The embed's frame wrote only the base sheet and added the Scene's rules for the Scene face alone, so since the one face came to the embed each ribbon's band had no fill: none (HQ feature:f-embed-one-face-draws-with-the-scenes-rules, brief b-cloud-2026-11-14-pr-605)."
acceptanceCriteria:
  - "Through the embed, at Nearby and City in light and dark, no ribbon band is filled (embed-one-face: noRibbonIsFilled…)."
  - "Through the embed the city draws as it does under PagesApp (embed-one-face: theCityDrawsAsUnderPagesApp…)."
  - "A ribbon's band carries fill=\"none\" on itself, so no sheet is needed for it to draw unfilled."
tags:
  - "hq:feature:f-embed-one-face-draws-with-the-scenes-rules"
  - "one-face"
  - "embed"
---
