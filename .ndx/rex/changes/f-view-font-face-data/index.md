---
id: "e18433d8-521d-4bd8-bfb1-89a10f0b19d8"
type: "change"
title: "A view's stylesheet declares its own face as a data: font"
slug: "f-view-font-face-data"
intent: "HQ, 2026-11-11: the open kit refuses @font-face in a view's CSS, so a themed view cannot draw a display face and authors turn headline words into SVG outlines. Ask: allow @font-face whose every src is a data: URL of a font, capped per face and per view, loading nothing from the network, in worker views and headless runs alike."
acceptanceCriteria:
  - "An @font-face whose every src is a data: URL of a font (font/woff2, font/woff, font/ttf, font/otf, application/font-*, application/x-font-*, application/octet-stream) is drawn in a worker view, and the view's text is drawn in it (test, harness)"
  - "A face over 50 KB decoded, or a view's faces over 200 KB together, is refused with a sentence that ends with a finding code, counted from the decoded bytes (test)"
  - "A src that is a url() to anything but data:, local(), or a type that is not a font is refused, each saying why (test)"
  - "Only font-family, src, font-weight, font-style, font-display, unicode-range and font-stretch are kept; any other descriptor is left out and said (test)"
  - "A face named as one the app lends its views (brand.views.fonts) is not loaded: the app's face is drawn, and that is said (test, harness)"
  - "A font-family that is not a plain name is refused, so nothing breaks out of the rule (test)"
  - "graview view check says the same refusals as the page (test)"
  - "The graview-view-drawing and graview-worker-view skills say how"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "hq:feature:f-view-font-face-data"
source: "Graview HQ feature:f-view-font-face-data"
---
