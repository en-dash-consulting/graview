---
id: "96b54bdd-8bf4-494c-a946-ad0fd9463182"
level: "task"
title: "0.1.31 · 01–02: Pages honors the Ask box setting, and the twelve covered controls are fixed"
status: "completed"
startedAt: "2026-10-16T04:50:43.843Z"
completedAt: "2026-10-16T08:27:44.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "Pages hides or shows the Ask box exactly as the Scene does for the same setting, live when the setting changes, on phone and desk, with a test that fails without the fix"
  - "every W-224 collision is fixed and its entry removed, and scripts/lib/watch-acknowledged.mjs is empty again"
  - "the watch harnesses that met the collisions run green without --quick"
description: "Roadmap feature:bug-pages-view-ignores-the-app-s-ask-box-display-setting (01) and f-watch-collisions-w224 (02, W-224). 01: the Scene respects the app's Ask box display setting (seat: 'field' | 'hidden'), but Pages always draws its ask box (packages/pages ask.ts) without reading it. 02: the watch's control-covered rule acknowledged twelve collisions by name in scripts/lib/watch-acknowledged.mjs: todo's drive-in pictures over its Tasks problem count; the '→ Sam' sign under 'Close the map'; the faces switch over the app name at 320 and 390 wide; a district count under the zoom on a phone; the history timeline over a problem count; a top-edge sign under 'Reset view'; '+3 more' under the focused picture; the lifelogics lens drawing two links over each other; pages and lens columns ending under the closed ask field; in Firefox only, a seat's draft lens over Up, the key and the zoom. Fix each and remove its acknowledgement. Walkthrough XI carries these too and waits on this task."
lastModified: "2026-10-16T08:27:44.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-16 — done on feat/0-1-31-additions.

01, Pages honors the Ask box setting. `PageContext` takes `ask` ("field" | "hidden"), the same setting as the Shell's `ask`, and `PageAsk` hands it to `SeatField` as the scene does. The embed hands its `seat` option to the routed face (`PagesContent`'s `ask`), and `EmbedHandle.setAskField(start)` changes it live on whichever face is open, phone or desk (both go through `PagesContent`). Tests: `packages/pages/tests/unit/the-assistant-on-every-page.test.tsx` (hidden draws no field on any route) and `packages/embed/tests/unit/the-ask-field-follows-the-apps-setting-on-both-faces.test.tsx` (both faces, and a live change without a new mount); both watched failing before the fix. Decision: a handle method rather than a remount, since no handle setter existed for it; 0.1.31 · 09 replaces the box and can retire it.

02, W-224. `scripts/lib/watch-acknowledged.mjs` is empty. Fixes: the drive-in hangs from the nameplate's measured foot (`--graview-plate-h` measured, border box) instead of a 26/42 px guess; the sign to a person elsewhere stands down the right edge below Up and the key (`EDGE_TOP` 102), right-anchored clear of a docked panel; on a phone's bar the app's name can shrink (`min-width: 0`) before the faces switch covers it; the city avoids the zoom's corner (a second `chrome` box), and on a phone the scene's foot is `max(sheet, foot-room)` rather than their sum; the timeline says its height as `--graview-sheet` and the ground is laid out above it (`groundFoot`); top-edge signs step past the measured trail (`useTrailBox`); a focused card ends above a floored district row (`rowRisesBy`, test `a-focused-card-ends-above-the-row-under-it.test.ts`, verified failing without it); a stretched record link ends where an item's own list begins (`useEndsAboveItsList`, spec items and Pages' declared rows); a draft drawn over the scene makes the picture before it inert; a person figure is 24 px wide and huddles 26 apart. Watch corrections (measurement, not acknowledgement): a bar at the foot (`data-graview-foot`) is judged as standing below what it covers, target sizes are judged once the document has loaded and asked again 700 ms later (WebKit drew the todo design unstyled while its font stylesheet was pending; Firefox measured the rota's Find box at 19 px for a beat). Bundle raises filed in `scripts/budget-raises/nothing-stands-over-a-control-*.json`; the hosted page's before-drawn limit is 910 KB.

Harnesses, without --quick: watch, shrunk, navigation, chrome, declared, gauntlet, pages, lines, who green in the final chain; screen-reader (61 of 61) and seat-goes-and-draws green on their own runs. No harness reports a watch violation. Left red, not from W-224: playback's scrubbingFromTheStartShowsTheAppGrow and everyStopShowsTheAppExactlyAsItWas (stop 0 shows the first task; fails identically with HEAD's packages); journeys' six keyboard press-count regressions on the pages at a desk (pre-existing, noted in W-225); and WebKit page.goto timeouts in this environment, where the Google Fonts stylesheet request intermittently never finishes and `load` never fires.

