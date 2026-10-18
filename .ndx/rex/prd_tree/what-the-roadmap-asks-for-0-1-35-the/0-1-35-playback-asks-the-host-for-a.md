---
id: "73f880d8-8314-4beb-8711-72b5d98dc752"
level: "task"
title: "0.1.35 · Playback asks the host for a past declaration lazily"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
acceptanceCriteria:
  - "HistoryHost takes a lazy declarationAt(seq): Promise<PastDeclaration | undefined>, asked when playback reaches a mark handed without a declaration; the moment is drawn under that declaration"
  - "marks handed with declarations work unchanged; a page's first load carries no past declaration; a test fails on 0.1.34"
description: "Roadmap f-declaration-at-lazy. HistoryHost.declarations must carry every version's compiled declaration up front (27 on the Roadmap app) for the past to be drawn under the declaration then in force; Cloud sends only the sentences."
startedAt: "2026-10-18T15:15:00.000Z"
completedAt: "2026-10-18T16:10:00.000Z"
lastModified: "2026-10-18T16:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided: `HistoryHost.declarationAt?: (seq: number) => Promise<PastDeclaration | undefined> | PastDeclaration | undefined`, called with the `seq` of the mark handed without its `declaration` (never an arbitrary seq), so the host answers per version and the answer is kept per mark — keyed by the `declarationAt` function, so a host hands the same function across renders. Shaped like `viewAt` (a function on the host, asked with a seq) but allowed to be a promise, since the declaration is what a host fetches. The asking is `askDeclaration(host, seq)` on `@graview/core/past` (answers `{ declaration }` or `{ waiting }`), which `pastAt` reads, so nothing of it is on a page's first load and a page that never looks back asks nothing; a mark handed with its declaration is never asked about. An answer of `undefined`, or a failure (a throw or a rejected promise), is as if the mark had none — the last declaration handed before it, else today's, which is what the marks already meant. In the provider's playback (`useOwnPlayback`) the face holds the picture it had while the answer is coming, rather than flash the moment under today's declaration; after 400ms (`ANSWER_HELD_MS`) it draws under today's until the answer arrives, then draws again. It threads through `history` on `GraviewProvider`, `mount`/`FrameOptions` and `PageContext` with no new plumbing; `packages/ship` serves no history, so nothing changed there. The provider's playback grew 442 B up front on a hosted page: raises in `scripts/budget-raises/the-lazy-past-declaration-*.json`.

The playback harness's `scrubbingFromTheStartShowsTheAppGrow` and `everyStopShowsTheAppExactlyAsItWas` failed at stop 0 because the harness read the bar's and the notices' visually hidden status lines (`role="status"`), which still announced the last change made now ("Finished Measure the hallway"), as part of the app drawn; `drawn` now leaves `[role="status"]` out, as it leaves out the timeline and Activity. The scene itself drew seq 0 correctly.

Tests, each watched failing first: `packages/core/tests/unit/the-past-is-the-log-folded-to-that-point.test.ts` (two new: asked by the mark's seq and once, drawn under the answer; undefined or failed is today's and a handed mark is never asked — failed with `askDeclaration` not exported), `packages/react/tests/unit/a-moment-waits-for-the-declaration-the-host-is-asked-for.test.tsx` (2; the hold claim failed against 0.1.34's playback, showing the moment under today's at once). Harness playback --quick (GRAVIEW_PORT_BASE=5800): all 11 claims hold.
