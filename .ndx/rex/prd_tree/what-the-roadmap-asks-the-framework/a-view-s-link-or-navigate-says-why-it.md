---
id: "0709e047-26ec-4d41-ac3e-df5046a66bb0"
level: "feature"
title: "A view's link or navigate says why it didn't go"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "f-view-links-framework"
source: "Graview Roadmap: f-view-links-framework"
acceptanceCriteria:
  - "A navigate, data-place or data-record that resolves to nothing tells the view's console and the host's problems why, naming the valid place slugs"
  - "navigate('<a place slug>') given a bare string that is no record but is a place goes to that place"
  - "The worker-view skill says what a destination may be"
description: "packages/guest host/links.ts: a bare string to graview.navigate is taken as a record id, so navigate('projections') silently goes nowhere and go() returns false with no message. That broke the pricing app's bottom links in Cloud."
lastModified: "2026-10-12T14:10:00.000Z"
---
