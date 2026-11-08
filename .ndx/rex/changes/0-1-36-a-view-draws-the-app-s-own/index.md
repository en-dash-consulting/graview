---
id: "c38d36da-9afe-42a8-8bdc-0f3534a81955"
type: "change"
title: "0.1.36 · A view draws the app's own /graview/assets/ images"
slug: "0-1-36-a-view-draws-the-app-s-own"
intent: "Roadmap request:views-refuse-the-app-s-own-graview-assets-images-that-add-image-just-stored. The guide and the refusal both say a view may draw the app's own image (/graview/assets/…), yet every such img is refused."
acceptanceCriteria:
  - "triaged: why /graview/assets/<id>, /a/<slug>/graview/assets/<id> and the app's full https URL are refused as Not drawn / host lists no origin, written on the request"
  - "an image the app holds (added with add_image) draws in that app's views in all three forms, with a test that fails on 0.1.35"
  - "the refusal text no longer promises what is refused; a Cloud half (e.g. add_image from the app's own /graview/files URL returning 401) is a Roadmap feature"
touches:
  - "75213918-52dd-423f-b641-4776b56c0474"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
resolution: "Framework half on fix/views-draw-their-pictures: the app's own image is drawn by its path, under the base or by the page's address for it; runWorkerViewHeadless takes asset and origin; refusals offer only what the host draws. Cloud half: pass asset and origin to the headless run."
---
