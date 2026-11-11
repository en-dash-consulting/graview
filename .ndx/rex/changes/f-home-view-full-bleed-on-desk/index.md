---
id: "6fb13b22-292d-4bb2-b1f5-e73367da2e68"
type: "change"
title: "A home view can go full-bleed on a desk, not only on phones"
slug: "f-home-view-full-bleed-on-desk"
intent: "From building a home worker view that draws about 60 record photos: bleed true takes the gutter back on a phone, and on a desk the view stays in the page's center column. A view of the home, or a page a view replaces, opts into the full viewport width on a desk too, clear of the bar and the safe areas. bleed: \"full\" (0.1.70) already spans the page at every width; the manifest check now says what each value does and ends its refusal with a finding code, and the worker-view skill names \"full\" where it named only true."
acceptanceCriteria:
  - "checkManifest passes bleed \"full\" on the home, on a view of one that replaces its page and on a view of many that replaces its list (test)"
  - "checkManifest refuses any other bleed value, saying what true and \"full\" do, ending with (view-bleed) (test)"
  - "A view that bleeds full spans the window at 1440 and starts flush under the bar (verify-address)"
  - "graview-worker-view and graview-view-drawing say that \"full\" spans a desk too"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "pages"
  - "hq:feature:f-home-view-full-bleed-on-desk"
source: "Graview HQ feature:f-home-view-full-bleed-on-desk"
---
