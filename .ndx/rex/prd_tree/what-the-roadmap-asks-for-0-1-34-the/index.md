---
id: "c9726b99-65f4-443b-9b0d-1ef0423073a2"
level: "epic"
title: "What the roadmap asks for 0.1.34: the right-click menu, for visitors, on Pages, and without spending AI"
status: "completed"
completedAt: "2026-10-18T05:00:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
acceptanceCriteria:
  - "every task under this epic is completed or deferred with its reason written on its Roadmap feature"
  - "r-0-1-34 is published listing only what shipped, and the release brief names what Cloud takes (its INTERIM(FR-183) removed)"
description: "Cloud's briefs of 2026-10-17 (b-cloud-2026-10-17-visitor-menus, -menu-panel-face, -menu-suggest-cost, -menu-prefetch) ask four framework changes for 0.1.34, all to the context menu: FR-183 f-withheld-for-visitors (next), FR-184 f-menu-panel-in-its-face (now), FR-185 f-menu-suggest-costs (next), FR-186 f-menu-prefetch-cache (next, lands with FR-185). Walkthrough XI (f-walk-xi, next; the PRD task under Distribution) walks the batch before the release is cut. Work in the queue's order: now, then next."
lastModified: "2026-10-18T03:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [0.1.34 · FR-184: A panel drawn from the right-click menu opens in the face it was asked on](./0-1-34-fr-184-a-panel-drawn-from.md) | completed |
| [0.1.34 · FR-183: A reader who may do nothing is told how to get in](./0-1-34-fr-183-a-reader-who-may-do.md) | completed |
| [0.1.34 · FR-185: Opening a context menu spends no thinking-model call](./0-1-34-fr-185-opening-a-context-menu.md) | completed |
| [0.1.34 · FR-186: The right-click menu is ready before the click](./0-1-34-fr-186-the-right-click-menu-is.md) | completed |

## Notes

2026-10-18: done on feat/0-1-34-additions (PR #313). FR-183, FR-184, FR-185 and FR-186 built as three parallel branches and merged; the merge of FR-185/186 with FR-184 in inline-ai-menu.tsx kept FR-184's ask-in-place `run` and FR-185's suggestion cache and Suggest row together. Walkthrough XI (an animal shelter) ran on the combined branch and found W-226 to W-231, all fixed; its task stands failing by its own rule and Walkthrough XII carries the open list. r-0-1-34 is drafted on the Roadmap with true notes, and f-take-0-1-34-cloud holds what Cloud does.

2026-10-18, published: 0.1.34 is on npm (all fourteen packages, release run 39134180591; the first publish attempt stopped at its gate on a red scheduled Nightly, which #315 answered with a second look for a failed harness and a shorter Nightly). r-0-1-34 is published, the five features are marked shipped, brief b-framework-0-1-34 is sent, and f-take-0-1-34-cloud (priority now) says what Cloud does. Cloud's three asks after 0.1.30, never filed before, are now f-add-relation-far-kind, f-files-kept-async and f-declaration-at-lazy (framework, next, 0.1.35).
