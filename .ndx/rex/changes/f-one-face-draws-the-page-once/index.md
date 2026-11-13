---
id: "d0d68fc5-85d9-4474-8ac2-647e8f4093e1"
type: "change"
title: "The one face draws the page once: the page drawn while it loads is the page that stays"
slug: "f-one-face-draws-the-page-once"
intent: "Found 2026-11-13 chasing main's red discography journeys (PR #590). OnePlace is lazy; its Suspense fallback draws the routed page, and when the one face arrives about 300 ms after ready the whole page and its bar are drawn again as new elements (1,984 links on discography's /pages). A press in that window is lost, with focus and typed text, and the page is swapped for another DOM object. #590 only makes the journeys wait (data-graview-one-face-arriving). Ask: draw the routed page once and move it into the one face's sheet when the one face arrives, as #587 does for the embed's bar."
acceptanceCriteria:
  - "The page's elements before the one face arrives are the same nodes after it arrives (test)"
  - "Focus and a value typed before the arrival survive it (test)"
  - "A press made while the one face is arriving is not lost (harness)"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-one-face-draws-the-page-once"
source: "Graview HQ feature:f-one-face-draws-the-page-once"
---
