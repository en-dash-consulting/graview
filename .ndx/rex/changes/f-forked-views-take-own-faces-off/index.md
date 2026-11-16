---
id: "ff9650dc-9731-4a72-88e9-071ce0d9bba1"
type: "change"
title: "A page made its own view takes what the host says of every view, ownFaces: false among it"
slug: "f-forked-views-take-own-faces-off"
intent: "Cloud passes ownFaces: false on every worker view it registers, but a built-in page an owner forks into its own view is registered by @graview/embed itself (draft.js useForkedViews) with a fixed definition, so ownFaces: false never reaches it. Add an embed mount option that forked views take."
acceptanceCriteria:
  - "With forkedViews: { ownFaces: false } a forked view's own @font-face is refused as own-face-refused (test: a-forked-view-takes-what-the-host-says-of-every-view)"
  - "Without it a forked view's own face draws as before (test)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "embed"
  - "guest"
  - "hq:feature:f-forked-views-take-own-faces-off"
source: "Graview HQ feature:f-forked-views-take-own-faces-off"
---
