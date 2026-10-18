---
id: "33b0d9b4-4dc2-4906-af41-8b5fa1f7fc4d"
level: "epic"
title: "What the roadmap asks for 0.1.35: Cloud's three asks after 0.1.30 (a far add-relation, an async kept, a lazy past declaration)"
status: "completed"
completedAt: "2026-10-18T17:50:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
acceptanceCriteria:
  - "every task under this epic is completed or deferred with its reason written on its Roadmap feature"
  - "r-0-1-35 is published listing only what shipped, and the release brief says what Cloud's f-cross-app-relations-cloud and f-playback-cloud can now do"
description: "Cloud's brief b-cloud-after-0-1-30 (2026-10-15) asked three framework changes that were not filed until 2026-10-18: f-add-relation-far-kind (Cloud's cross-app relations builder waits on it), f-files-kept-async and f-declaration-at-lazy (Cloud's playback half waits on both). All three priority next, target 0.1.35."
lastModified: "2026-10-18T16:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [0.1.35 · An add-relation edit can name another app's kind](./0-1-35-an-add-relation-edit-can-name.md) | completed |
| [0.1.35 · A host says whether a file is still kept asynchronously](./0-1-35-a-host-says-whether-a-file-is.md) | completed |
| [0.1.35 · Playback asks the host for a past declaration lazily](./0-1-35-playback-asks-the-host-for-a.md) | completed |

## Notes

2026-10-18: done and published. The three tasks were built in parallel and merged on feat/0-1-35-additions (#317); 0.1.35 is on npm (release run 39150051978). The studio harness caught the far act pushing Add a field off a kind's strip after the merge (the build had reported it as failing without its changes; it held one commit before); the act is now offered with the studio's own acts. Found on the way: planMigration dropped far links on every migration (fixed; Cloud told to check rooms), and playback's two long-failing claims were the harness reading the hidden status line. The branch Nightly caught a third milliseconds threshold in navigation (theGroundTravelsWithTheCards), now judged by the largest share of the move in one step. r-0-1-35 is published, the features are shipped, f-take-0-1-35-cloud (priority now) and brief b-framework-0-1-35 say what Cloud does.
