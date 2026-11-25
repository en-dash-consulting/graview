---
id: "5b80ef46-a580-4f53-bac9-fbaadb8f0b15"
type: "change"
title: "A frame view at its own place is as tall as it draws at every width, not cut short on a desk"
slug: "f-frame-view-autosize-short-on-desk"
intent: "From HQ feature:f-frame-view-autosize-short-on-desk: A frame view of many that calls guest.autoSize() fits its content at 390 wide and is cut at about 736 px at 900 wide, with no problem said, though the host allows 20,000. Find what holds it, fix it, and say a height that is refused."
acceptanceCriteria:
  - "A fixture shaped like the reported view fits its content at 390, 900 and 1280 without scrolling inside itself (harness claim)"
  - "A height the host refuses is said as a problem (test)"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "hq:feature:f-frame-view-autosize-short-on-desk"
source: "Graview HQ feature:f-frame-view-autosize-short-on-desk"
---
