---
id: "c4fe07f6-7821-4794-96a0-84e1c55c41f4"
type: "change"
title: "A view's lent faces load from origins of their own, not the image origins"
slug: "f-view-font-origins-apart-from-images"
intent: "Graview 0.1.70 loads a face lent by `brand.views.fonts` from an https: origin only when the host lists that origin in `images.origins` (MountWorkerViewOptions / WorkerViewOptions; @graview/guest host/fonts.ts viewFontAddress). Cloud lends only Google Fonts files, so it lists https://fonts.gstatic.com there, and the view's image judge then also takes an <img> from that origin: the option means two things. Asked (Cloud brief b-cloud-2026-11-08-view-font-origins): a `fonts: { origins }` option of its own on the worker view options, read by viewFontAddress; `images.origins` stays for images only. Pre-1.0, so images.origins stops admitting faces outright, and the changeset says so for a host."
acceptanceCriteria:
  - "A face from an origin in fonts.origins loads; the same origin in images.origins alone no longer admits a face (unit test)"
  - "An origin in fonts.origins alone does not admit a view's <img> from it (unit test)"
  - "The option is on MountWorkerViewOptions and WorkerViewOptions and is passed through every mount path the image origins already reach"
  - "The view-drawing skill and docs name fonts.origins, and the changeset carries a Compatibility line for a host"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "fonts"
  - "hq:feature:f-view-font-origins-apart-from-images"
source: "Graview HQ feature:f-view-font-origins-apart-from-images, from brief:b-cloud-2026-11-08-view-font-origins"
---
