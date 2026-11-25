---
id: "d500dcd3-86f3-47f7-a173-41ea53d2b201"
type: "change"
title: "The opening screen lifts when the page has drawn, not when the one face arrives"
slug: "f-opening-screen-waits-for-one-face"
intent: "From HQ feature:f-opening-screen-waits-for-one-face: data-graview-drawn is said only after the one face's chunk arrives, and the opening screen waits for it though the page under it has drawn. Give the opening screen a second signal to lift on; the drawn mark keeps its meaning."
acceptanceCriteria:
  - "With the one face's chunk held, the opening screen lifts once the page and its view are painted, in three engines (harness claim)"
  - "data-graview-drawn is said when it is today (test)"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "embed"
  - "hq:feature:f-opening-screen-waits-for-one-face"
source: "Graview HQ feature:f-opening-screen-waits-for-one-face"
---
