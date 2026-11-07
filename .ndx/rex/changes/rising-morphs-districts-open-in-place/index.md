---
id: "b8bcd63b-c71d-490c-a079-fda767fad7f8"
type: "change"
title: "Rising morphs, districts open in place, and lines land on what you can see"
slug: "rising-morphs-districts-open-in-place"
intent: "Three faults, one commit (\"Rising is a morph, a district opens where it stands, and every line lands on something you can see\"). The abruptness was the altitude attribute cutting styles while positions tweened; the broken lines were endpoints anchored to layout host boxes that extend past the visible panels (ties climbing off the focus panel's top into open air); the missing expand was the overview having no way to see inside a group. Also fixed en route: the invisible in-stack iso block intercepted clicks over a neighbour's tuck (pointer-events: none), and the wordmark button's font:inherit silently dropped the brand display face — caught by pnpm brand."
acceptanceCriteria:
  - "Rising to and descending from the Graview is a morph: the square grid crossfades into the iso lattice and blocks grow out of their cards over the same eased number (--graview-altitude, a registered transitioning custom property) — no background or shape cut"
  - "A district's nameplate carries a chevron that opens it in place into member chips — real pick targets, selectable and tie-able — without re-flowing the ring; it is ordinary expanded view state with a URL and a back-button stop"
  - "Every connector and tie endpoint is measured from the DOM (panel, iso block, board slot, pick target), falling back to the layout box only headlessly; no line ends in open air in either perspective"
  - "A tie internal to the focused view draws no line — the view's own emphasis shows it"
  - "487 tests, 23/23 audit screens, full survey and all thirteen harnesses green"
touches:
  - "cb0397c2-9baa-4e06-8f61-2f0c22b94c97"
priority: "high"
tags:
  - "ux"
  - "overview"
  - "transition"
  - "relations"
source: "Nick, 2026-08-31: transition too abrupt (needs a morph); want to expand the boxes to see which entities are associated; line connections appear broken in both views"
---
