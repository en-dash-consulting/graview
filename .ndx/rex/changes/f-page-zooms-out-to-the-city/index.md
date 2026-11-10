---
id: "2f4f8de0-e7c5-4f26-98c9-901c7eebe3a9"
type: "change"
title: "Pages and the Scene are one place: a page stands on its record in the city, and zooming moves the camera"
slug: "f-page-zooms-out-to-the-city"
intent: "Nick, 2026-11-10: break down the barrier between Pages and the Scene, so that Pages vs Scene is not much of a thing: pages are viewed on top of the scene, like lenses, one to one. The first cut (a page that stepped back over a city laid out on its own, PR #559) is not shipped: it was a second city beside the Scene's, not the same place. The principle: every page address is a place in the Scene's own city; altitude is the camera (page, stepped back, district, city); the page shown is the Scene's focus card; following a link moves the camera. Nick's answers, 2026-11-10: (1) home stands over the whole city — it is the page at the top altitude, stepping back from it is the overview, and the app still opens on the gallery, not the city; (2) a place that shows several kinds stands where their districts meet, with a line to each, and falls back to a plaza at the city's edge with the same lines when they meet nowhere sensible — never inside one kind's district; (3) phones get it too, with fewer stops (page, district, city), drawn flat from above rather than angled, reached by pinching out and the Up button rather than a slider. Phase 1 is this change: same coordinates as the Scene, stepping further back is the overview, and one control that is both the step-back and Up. Phase 2 (the page is the Scene's focus card, the addresses become one) and phase 3 (one face, a continuous control, HTML-in-canvas on the GPU path) are later changes. Reusable from PR #559: the angled sheet, measuring where a page's parts are, the street routes remembered, and the keyboard through the city."
acceptanceCriteria:
  - "The city's places hold still: adding or removing one record moves no other kind's buildings and at most its neighbors in its own district, measured over placeCity with a test that names the largest move (unit claim); this lands before any page stands on a building"
  - "A record page stepped back stands over that record's own building in the Scene's own layout — the same coordinates placeCity gives the Scene, not a city laid out apart (harness claim names a record page and its building)"
  - "Home stepped back stands over the whole city, and stepping back from it once more is the overview at /places/overview; the app still opens on the gallery (harness claim)"
  - "A place that shows several kinds stands where those kinds' districts meet, or on a plaza at the city's edge, with a line to each district, and never inside one kind's district (unit claim over the placement, harness claim over a place of two kinds)"
  - "One control is both the step-back and Up: pressed on a page it steps back, pressed again it goes up toward the overview, and the separate Up and step-back controls are gone (harness claim)"
  - "On a phone width the stops are page, district and city, drawn flat from above with no angled sheet, reached by pinching out and by Up (harness claim at 390px)"
  - "Stepped back, lines run from the page's parts that show linked records to those records' buildings; back in, focus, scroll and the address are as they were; reduced motion skips the travel"
  - "The keyboard reaches the control and every record a line points at; the watch finds no new problem"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "medium"
tags:
  - "graview"
  - "scene pages"
  - "hq:feature:f-page-zooms-out-to-the-city"
source: "Graview HQ feature:f-page-zooms-out-to-the-city"
---
