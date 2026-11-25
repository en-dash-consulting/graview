---
id: "0270e1df-6026-4b57-9430-16a5ee80eba2"
type: "change"
title: "In Firefox, the page draws before the one face's part has arrived"
slug: "f-firefox-page-waits-for-one-face"
intent: "From HQ feature:f-firefox-page-waits-for-one-face: With the one face (sceneUnderPages) and its lazy chunk held back, Chromium and WebKit draw the pages and the worker view at once, but Firefox shows nothing of the view until the one face's chunk arrives. The page and its views draw in Firefox before the one face arrives, as they do elsewhere."
acceptanceCriteria:
  - "With the one face's chunk delayed, the page and its worker view draw in Firefox, Chromium and WebKit before it arrives (harness claim)"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "embed"
  - "hq:feature:f-firefox-page-waits-for-one-face"
source: "Graview HQ feature:f-firefox-page-waits-for-one-face"
---
