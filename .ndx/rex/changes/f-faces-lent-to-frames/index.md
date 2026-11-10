---
id: "f995784b-b31e-4342-92db-706bf6ef6449"
type: "change"
title: "An app's faces are lent to guest frames as data: fonts"
slug: "f-faces-lent-to-frames"
intent: "Cloud, 2026-11-10: fonts are lent only to worker views (0.1.71 fonts: {origins} and assets); guestView frames get none, so a frame view falls back to a generic stack. Ask: lend the app's faces to frames as data: fonts, which the frame's font-src data: allows."
acceptanceCriteria:
  - "A guestView frame draws text in the app's lent face, as a data: font (harness or unit test against the frame's document)"
  - "The 2 MB per-face bound and the last-lent-wins rule hold for frames as for worker views"
  - "The frame's CSP is not widened beyond font-src data:"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest fonts"
  - "hq:feature:f-faces-lent-to-frames"
source: "Graview HQ feature:f-faces-lent-to-frames"
---
