---
id: "8725f7aa-4bc7-460a-9324-1bc804e5f7fc"
level: "task"
title: "0.1.35 · A host says whether a file is still kept asynchronously"
status: "completed"
startedAt: "2026-10-18T17:00:00.000Z"
completedAt: "2026-10-18T18:00:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
acceptanceCriteria:
  - "HostFiles.kept may answer a Promise<boolean> (or the host hands a kept list once); playback draws a removed file as removed later when the answer comes, kept until then"
  - "a test with an async kept fails on 0.1.34 and passes after; a synchronous kept still works unchanged"
description: "Roadmap f-files-kept-async. HostFiles.kept?(href): boolean (packages/core/src/schema/files.ts) is synchronous; Cloud serves files from R2 and cannot answer at once, so playback draws every past picture as kept."
lastModified: "2026-10-18T18:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided: `HostFiles.kept?(href): boolean | Promise<boolean>` — the return type widened, no kept list. A list handed once would have to be whole before the page draws and kept fresh as files go, which a host serving from R2 cannot promise any better than a per-href answer; a promise per href asks only for what is on screen. The one caller is `useRemovedLater` in `packages/primitives/src/files.tsx` (a card's thumbnail, an `image` block, a record's gallery; the routed face's record page, list rows and views all draw through it, and no guest view is told whether a file is kept, so none needed changing). A promise is asked once per href per `HostFiles` object (a `WeakMap` of `Map`s): the promise is remembered while it is out, then what it settled to, so a scrub, another card or the record's page draws from the answer without asking again and without drawing the picture first. Until it settles the picture is drawn as itself; `false` draws "removed later"; a rejection, or a `kept` that throws, is taken as kept. A synchronous answer is asked every draw, as before, and is not cached. Playback code was not touched. Nothing grew past a budget (pack:inspect all ok), so no raise file; no skill or README names `kept`, and no surface in `scripts/lib/surfaces.mjs` is touched.

Tests: `packages/primitives/tests/unit/a-file-the-host-answers-for-later-is-drawn-as-kept-until-it-does.test.tsx` (3; "drawn as itself until the host answers, then as removed later" and "asked once per file" failed before the change, the rejection-taken-as-kept control held before and after). `a-file-removed-since-is-said-to-be-removed-later.test.tsx` (the synchronous host) holds unchanged. Full `pnpm test`: 874 files, 6564 passed.

Harnesses (GRAVIEW_PORT_BASE=5700, --quick): files holds; playback fails `scrubbingFromTheStartShowsTheAppGrow` and `everyStopShowsTheAppExactlyAsItWas`, both already failing locally on main before this change; its other nine claims hold. No harness drives a host `kept`.
