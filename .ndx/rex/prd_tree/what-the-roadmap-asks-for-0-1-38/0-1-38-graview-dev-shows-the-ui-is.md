---
id: "519ba369-df84-454a-a809-c9e9b9066acc"
level: "task"
title: "0.1.38 · graview.dev shows the UI is generated, then reshaped by asking"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
completedAt: "2026-10-19T08:00:00.000Z"
endedAt: "2026-10-19T08:00:00.000Z"
acceptanceCriteria:
  - "the hero's run goes on past a working app: the interface is generated (a line says so), then a typed ask reshapes a page (the departures-board view), ending on that frame"
  - "a section right under the hero: You never build the UI. You ask for the one you want, with a live example app and asks to press, each redrawing the same records, the app's rule showing through every view"
  - "the views shown are real views drawn by the seat from a recorded run, not mockups; the site's harness and tests hold; Nick's mockup (claude.ai artifact Lgh7vUBgWnPJEHBBSUJqfz) is the reference"
description: "Roadmap f-dev-generated-ui (Nick's review of the landing mockup)."
lastModified: "2026-10-19T08:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

- The hero's docs tab carries the run beside the live app (`#hero-run`): declare (4 kinds, 18 acts, 5 rules), check, the seed's problem (no doc covers packages/search, shared-types, telemetry), the repair applied to the app's own store (a guide each, reviewed today), `graview preview` on the city, then "The interface is generated." as the face goes to Pages, then the typed ask and the departures board. It starts once the app is drawn and in view, ends on the board, stops if the reader uses the app (Replay beside the caption), and under reduced motion goes straight to the last frame. On a phone only the step it is on is shown, so the page never grows.
- The lede now says "Graview generates the whole interface from it ... Want a different interface? Ask for it."
- New section `#asks` under the hero: "You never build the UI. You ask for the one you want." A kids' soccer season (apps/site/asks/season, checked by `pnpm check`), an ask bar in the quick ask's shape and three presses: what Graview generated (the Bears game a problem card), "Give me a list view of remaining games and who's bringing snacks" (the row with Sign up, which really signs up), "Make this app look more like a physical newspaper" (a WANTED ad). One store across all three.
- The views are worker views recorded as the asks' answers in apps/site/asks/turns.json, registered on the page through `registerWorkerView` (the guest view host), never a model call. tests/site-asks.test.ts runs each headless through the host's checks and holds what it draws to the captions.
- verify-site gained theHeroRunEndsOnTheDeparturesBoard and eachAskRedrawsTheSameSeasonWithItsRuleShowing; index counts 4 live apps.
- At 320 wide the run's Activity squeezed the docs app's name to a 5-pixel press: fixed in @graview/primitives' bar (the name keeps 28px, a bar under 300px tightens its gaps), with a changeset.
- chapters.js carries the guest view host now: +194 KB raw, +65 KB gzip, loaded after the first frame as before.

