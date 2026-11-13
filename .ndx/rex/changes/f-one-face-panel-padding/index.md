---
id: "eeed6833-0798-4dea-87cf-55f4fd815118"
type: "change"
title: "In the Nearby panel, a page keeps panel-sized margins, and views can tell they are in a panel"
slug: "f-one-face-panel-padding"
intent: "Nick, 2026-11-13, on Deep Time's Family tree at Nearby: \"too much padding on the L1 panel too\". Cloud measured at 1520 (panel 547 px): the page frame's SECTION keeps its full-page padding 40px 20px 96px in the panel, and Deep Time's view root adds 64px 48px 48px, leaving 70-75% of the panel for text. Ask: in the panel the page frame's padding is panel-sized (about 16-20px sides and top); views are told they are in a panel, documented in the authoring guide (promised to Cloud: `data-graview-in-panel` on the view's root and `--graview-gutter` set by the frame); the guide recommends @container queries over vw for a view's spacing. The hooks are a host surface: stability.md and a Compatibility line."
acceptanceCriteria:
  - "In the Nearby panel the page frame's side and top padding is 20px or less (harness)"
  - "A view's root carries data-graview-in-panel in the panel and not on a full page (test)"
  - "--graview-gutter is set by the frame in both places, panel-sized in the panel (test)"
  - "The view-drawing skill and authoring guide name both hooks and recommend @container queries (test)"
  - "docs/stability.md lists both hooks (test)"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "guest"
  - "hq:feature:f-one-face-panel-padding"
source: "Graview HQ feature:f-one-face-panel-padding"
---
