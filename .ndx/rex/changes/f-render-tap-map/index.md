---
id: "ae03e620-41b6-4ec0-9e99-5d97bfb10ad9"
type: "change"
title: "A static render says what each region of its picture does"
slug: "f-render-tap-map"
intent: "Cloud, 2026-11-11 (accepted by Nick): a static render also returns rectangles in its pixel space, each go (a place), open (a record), act (arguments bound, only acts the seat may run) or page, carrying the render's id; long lists break into fixed pages. Cloud's tap endpoint maps a device's tap back to one of these."
acceptanceCriteria:
  - "The render returns a tap map of rectangles in the viewport's pixel space, each doing exactly one of go, open, act, page or refresh, and the render's id (test)"
  - "In a real browser at the profile's viewport, each region equals its element's bounding box to within 1 px (harness)"
  - "An act region is offered only when this seat may run it with every argument bound; an act that needs a typed argument is not offered (test)"
  - "A tap resolved against a newer store than the render's re-judges the act as the seat now stands and is refused in words, never run against a state the picture did not show (test)"
  - "The same store, declaration, place, seat, profile, viewport and page give the same render id and the same map (test)"
touches:
  - "dd8e4788-2c4f-435c-91d6-b7c2c32ab5df"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "render"
  - "hq:feature:f-render-tap-map"
source: "Graview HQ feature:f-render-tap-map"
---
