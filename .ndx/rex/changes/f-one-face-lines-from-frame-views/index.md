---
id: "7ad5edc7-8114-4c57-a4df-1009ccdf4710"
type: "change"
title: "On the one face, a framed view's records have lines to their buildings"
slug: "f-one-face-lines-from-frame-views"
intent: "Seen on staging (Deep Time, 10 worker views, six replacing record pages, 0.2.0 through Cloud's patched embed). At Nearby a built-in page draws a line from each record it shows to that record's building; a worker view draws none, because the lines measure DOM boxes and a worker view is a cross-origin sandboxed frame. Ask: the guest client reports the boxes of the records a frame draws (elements marked with the record's id, e.g. data-record), in the frame's coordinates, and the one face maps them through the frame's box to draw the same lines and the Connected list. A frame that reports nothing still gets one line from its edge to the record a record page is about. Nick: \"the custom views arent showing the connections from the view to the background where the data entities are\"."
acceptanceCriteria:
  - "A worker view's data-record elements get lines to their buildings at Nearby, within 2 px of the element's box (harness)"
  - "A frame's reported boxes are clamped to the frame and only name records its seat may see (test)"
  - "A record page drawn by a frame that reports nothing still has one line from the frame to its record (harness)"
  - "Scrolling the frame or the page keeps the lines on their elements (harness)"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "pages"
  - "hq:feature:f-one-face-lines-from-frame-views"
source: "Graview HQ feature:f-one-face-lines-from-frame-views"
---
