---
id: "ac0ebe80-26b4-48ec-ab0c-b63b210ff88e"
type: "change"
title: "A view's thumb is cropped to a shape around the picture's focus, and whole for a cutout"
slug: "f-picture-thumb-around-focus"
intent: "Ask 4 left open by #616 (f-view-picture-shape): pictures.thumb { width, aspect } hands a view a thumb cropped to that shape around the picture's focus, and whole for a cutout, instead of a plain downscale."
acceptanceCriteria:
  - "thumb { width, aspect } crops each thumb to that shape around the focus, the middle where none is said (test: a-views-thumb-is-cropped-around-the-pictures-focus)"
  - "A cutout's thumb is whole, made smaller and never cropped (test)"
  - "A thumb shape out of bounds is refused by the manifest check as view-pictures-thumb (test)"
  - "A headless run hands a thumb where the page would (test)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "skills"
  - "hq:feature:f-picture-thumb-around-focus"
source: "Graview HQ feature:f-picture-thumb-around-focus"
---
