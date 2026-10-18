---
id: "c38d36da-9afe-42a8-8bdc-0f3534a81955"
level: "task"
title: "0.1.36 · A view draws the app's own /graview/assets/ images"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "triaged: why /graview/assets/<id>, /a/<slug>/graview/assets/<id> and the app's full https URL are refused as Not drawn / host lists no origin, written on the request"
  - "an image the app holds (added with add_image) draws in that app's views in all three forms, with a test that fails on 0.1.35"
  - "the refusal text no longer promises what is refused; a Cloud half (e.g. add_image from the app's own /graview/files URL returning 401) is a Roadmap feature"
description: "Roadmap request:views-refuse-the-app-s-own-graview-assets-images-that-add-image-just-stored. The guide and the refusal both say a view may draw the app's own image (/graview/assets/…), yet every such img is refused."
lastModified: "2026-10-18T18:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
