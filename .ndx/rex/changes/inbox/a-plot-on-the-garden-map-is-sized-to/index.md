---
id: "b2d7f4c1-8e5a-4c39-9d6b-1f0e2a3b4c5d"
type: "change"
title: "A plot on the garden map is sized to the ground it lies on, contents included"
slug: "a-plot-on-the-garden-map-is-sized-to"
intent: "A plot's width was a share of the map while its contents were fixed pixels; inside a chapter embed the almanac's map column is about 330px, so a plot was narrower than what it held."
acceptanceCriteria:
  - "At every width the almanac's map is drawn at, no plot's label, badge or bed extends past the plot, and the label is at least 11px and never cut"
  - "A ground too narrow for its plots at that size scrolls inside itself; the page does not scroll sideways"
  - "The same drawing in the scene's lens and summary card is unchanged in kind, smaller in dense mode"
priority: "medium"
tags:
  - "seedbed"
  - "design"
  - "bug"
source: "Nick, 2026-09-28: \"this part of the demo has a ui bug on the plots visual\" (screenshot of chapter thirteen's almanac in the docs-site embed: labels cut to \"Plo…\", the caretaker badge off the tile's edge, the last bed outside it)"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A map you can read: layout, labels and links" (0d1ecdd1-91d0-4dc9-b323-de7239ef7354).
