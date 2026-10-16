---
id: "96b54bdd-8bf4-494c-a946-ad0fd9463182"
level: "task"
title: "0.1.31 · 01–02: Pages honors the Ask box setting, and the twelve covered controls are fixed"
status: "pending"
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
lastModified: "2026-10-16T04:36:17.079Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
