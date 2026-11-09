---
id: "6753e328-3d33-4e4d-8878-b51765de32dd"
type: "change"
title: "A view that bleeds on a phone takes each side's safe area on that side in a right-to-left page"
slug: "f-bleed-phone-rule-rtl"
intent: "Found fixing PR #533. The phone-only `BLEED_CSS` for `bleed: true` uses `margin-inline` with the left inset first, so in a right-to-left page the left inset lands on the right side. `bleed: \"full\"` was fixed with `margin-left` and `margin-right`; the phone rule has the same fault and predates it. Also unmeasured: a React view that throws in a full-bleed home or record slot, where the pages face has no `ViewBoundary` at the slot."
acceptanceCriteria:
  - "The phone bleed rule takes the left safe-area inset on the left and the right inset on the right in both directions (unit test on the emitted CSS, and a harness claim at phone width with dir=rtl)"
  - "A React view that throws in a full-bleed home or record slot is caught at the slot and the page returns to the column (test)"
touches:
  - "15e519fe-9ad9-4498-904f-5cd2f77ec15c"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "bleed"
  - "hq:feature:f-bleed-phone-rule-rtl"
source: "Graview HQ feature:f-bleed-phone-rule-rtl"
---
