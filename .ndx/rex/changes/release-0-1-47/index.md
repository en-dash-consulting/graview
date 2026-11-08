---
id: "4f1752cc-0ae5-45fc-8b50-65ce19346e25"
type: "change"
title: "0.1.47: Custom views work by keyboard with real links and buttons, are as tall as they draw, and can be audited for accessibility; a place is said drawn once its lens has drawn."
slug: "release-0-1-47"
intent: "What 0.1.47 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Views work by keyboard by default. A control a view draws is reached by Tab and pressed by Enter and Space without scrolling the page; whatever has the keyboard shows a ring a view can restyle but not remove; `.graview-sr` is words for a screen reader alone; an unlabeled `<svg>` is hidden from one; focus stays on a keyed element across a render."
  - "Real `<a>` and `<button>`. Both start as plain words a view styles freely; `<button data-record>` goes where it says; `a[data-record]` and `a[data-place]` carry a real `href`, so a new tab, a middle click and copy link work. An embed that keeps its own addresses hands them in with `hrefOf`."
  - "A view is as tall as it draws. The host measures it. On Pages it flows with the page; on the Scene a view of many or of one record is a card held to its box, faded where there is more, with Open (or Expand where there are no pages). `flows: false` and `scene.maxHeight` are new in the manifest."
  - "An accessibility audit of a drawn view. `auditView` on `@graview/guest/audit`, `graview view check --audit`, and `audit: true` on a headless run: keyboard reach, names, state, nesting, images, scroll boxes, and in a browser the focus ring and contrast, each against its WCAG 2.2 criterion."
  - "Checks know a view's place. A link to a titled view's place is no longer flagged as going nowhere when the host hands the check its views, and `describePlace` describes such a place."
  - "A place is said drawn once its lens has drawn. `data-graview-drawn` and `onDrawn` wait for a declared lens's rows, so `graview shots` and `graview preview` no longer photograph a blank place; a full-page shot shows the whole of a long place."
  - "Find hands the keyboard to a place at once. Enter on a kind in Find no longer leaves the keyboard in the Find box while the place's line is still coming, where the next key a person typed went on a slow machine."
shippedIn: "0.1.47"
tags:
  - "backfill"
  - "0.1.47"
source: "apps/site/releases.json"
---
