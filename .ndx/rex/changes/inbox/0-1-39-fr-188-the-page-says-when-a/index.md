---
id: "8443b77c-6d74-4c1f-8730-a7869209c319"
type: "change"
title: "0.1.39 · FR-188: The page says when a place has drawn and settled"
slug: "0-1-39-fr-188-the-page-says-when-a"
intent: "Roadmap f-page-drawn-signal (FR-188, later): a host picturing a place waits on a guess (opening frame gone, network idle, 600 ms)."
acceptanceCriteria:
  - "a stable signal once the current place and its views have drawn and settled: data-graview-drawn on the root (cleared on navigation) and an onDrawn(place) mount callback"
  - "it waits for fonts, images and worker views settled, and a harness checks it against what a person sees; tests fail first"
priority: "medium"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A host that owns the page gives the routed face the address bar (FR-106)" (6fb29d72-1be6-4980-8b42-ae60f622c031).
