---
id: "57ba4d08-01ab-40bb-a57a-605b0165e77e"
type: "capability"
title: "pages is a real arrangement: order, hide and first, compiled and honoured on both faces (FR-80)"
slug: "pages-is-a-real-arrangement-order-hide"
statement: "The product lets an app declare a pages arrangement of order, hide and first, which it checks, compiles and honours on both the Pages face and the Graview face."
criteria: [{"id":"c1","text":"The checker shall report an unknown kind or an unknown place named in a pages arrangement (order, hide or first) as a finding."},{"id":"c2","text":"The compiler shall compile a pages arrangement of order, hide and first into the compiled app."},{"id":"c3","text":"The Pages gallery and nav shall follow the order a pages arrangement declares."},{"id":"c4","text":"The Graview face shall set its cityOrder by the order a pages arrangement declares."},{"id":"c5","text":"When a pages arrangement hides a kind, the app shall take that kind off the home only."},{"id":"c6","text":"When a pages arrangement names a place first, the app shall open on that place."},{"id":"c7","text":"When a document reorders three kinds, hides one and names a lens first, the app shall open on that lens with the home in the declared order and the hidden kind reachable by link and search, on both faces."}]
tags:
  - "graview-cloud"
  - "FR-80"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

pages is accepted and never compiled; there is no arrangement type.
