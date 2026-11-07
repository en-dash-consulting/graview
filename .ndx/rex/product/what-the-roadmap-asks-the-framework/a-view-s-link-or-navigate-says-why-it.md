---
id: "0709e047-26ec-4d41-ac3e-df5046a66bb0"
type: "capability"
title: "A view's link or navigate says why it didn't go"
slug: "a-view-s-link-or-navigate-says-why-it"
statement: "When a view's link or navigate names a destination that resolves to nothing, the product tells the view's console and the host's problems why, and a bare string given to navigate that is no record but is a place slug goes to that place."
criteria: [{"id":"c1","text":"When a navigate, data-place or data-record resolves to nothing, the host shall tell the view's console why, naming the valid place slugs."},{"id":"c2","text":"When a navigate, data-place or data-record resolves to nothing, the host shall report to the host's problems why, naming the valid place slugs."},{"id":"c3","text":"When navigate is given a bare string that is no record but is a place slug, the host shall go to that place."},{"id":"c4","text":"The worker-view skill shall state what a navigate destination may be."}]
tags:
  - "roadmap"
  - "f-view-links-framework"
source: "Graview Roadmap: f-view-links-framework"
priority: "high"
resolution: "Shipped in #233: a bare string goes to a record the viewer may see, else a place by that slug; one that is neither says why in the view's console and to the host's onProblem, naming the places."
---

packages/guest host/links.ts: a bare string to graview.navigate is taken as a record id, so navigate('projections') silently goes nowhere and go() returns false with no message. That broke the pricing app's bottom links in Cloud.
