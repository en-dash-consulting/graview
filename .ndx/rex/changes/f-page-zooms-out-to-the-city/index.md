---
id: "2f4f8de0-e7c5-4f26-98c9-901c7eebe3a9"
type: "change"
title: "A page zooms out to the city of data behind it"
slug: "f-page-zooms-out-to-the-city"
intent: "Nick, 2026-11-10: a slider on any page, two states to start. Out, the page itself packs back — as if you stepped twenty paces back and a few to the left — and the cityscape of the app's data shows behind it, with light pipes or lines from the parts of the page to the connected records in the city. Not a separate Scene vs Pages swap. The first cut draws the page as DOM over the city; HTML-in-canvas (in Chrome's spec, not behind a flag) is where it goes once it lands elsewhere, so the cut detects it and does not depend on it."
acceptanceCriteria:
  - "Every routed page has a two-state control (in, out); out, the page is drawn smaller and set back over the city, and still reads (harness claim)"
  - "Out, lines run from the page's parts that show linked records to those records in the city (harness claim names a record page and its links)"
  - "Back in, the page is as it was: focus, scroll and the address kept; reduced motion skips the travel"
  - "Keyboard reaches the control and the lines' records; the watch finds no new problem"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "medium"
tags:
  - "graview"
  - "scene pages"
  - "hq:feature:f-page-zooms-out-to-the-city"
source: "Graview HQ feature:f-page-zooms-out-to-the-city"
---
