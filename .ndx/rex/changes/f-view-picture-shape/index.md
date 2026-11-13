---
id: "670744ef-8777-4fdf-ac2a-91df5b5c2089"
type: "change"
title: "A view's pictures say their shape and subject; thumbs are cropped around it"
slug: "f-view-picture-shape"
intent: "Nick 2026-11-12, Deep Time demo: pictures in tiles are cropped badly, since a view is handed { name, type, bytes, src } only. Asks in order: (1) width, height and aspect with each picture (the file value keeps them); (2) cutout: true when the picture has transparency or a plain uniform background; (3) focus { x, y } in 0..1, which a host may compute and a person may set, for object-position; (4) pictures.thumb { width, aspect } cropped around the focus."
acceptanceCriteria:
  - "A view's picture carries width, height and aspect when the file value has them (test)"
  - "cutout is true for a PNG with transparency and false for a photo (test)"
  - "A host-set focus reaches the view and is used by thumb { width, aspect } crops (test)"
  - "propose_view's headless run hands the same picture shape the page does (test)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "primitives"
  - "hq:feature:f-view-picture-shape"
source: "Graview HQ feature:f-view-picture-shape"
---
