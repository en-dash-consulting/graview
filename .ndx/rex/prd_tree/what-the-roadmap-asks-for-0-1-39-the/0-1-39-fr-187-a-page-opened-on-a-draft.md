---
id: "53fdea79-6a0d-4b38-8bd9-547ba8a51d5e"
level: "task"
title: "0.1.39 · FR-187: A hosted page opened on a draft view, so a proposal can be seen before it is kept"
status: "completed"
startedAt: "2026-10-19T21:30:00.000Z"
completedAt: "2026-10-19T22:45:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
acceptanceCriteria:
  - "mount (and the hosted page) take a draft view, unsaved, for the current seat (e.g. mount({ draftView: { manifest, source } }) or a host-served one-time draft id)"
  - "it is drawn where it attaches (home, a kind's list, a record) and marked as a draft, as /~draft marks a drawn panel; nothing is kept when the page closes"
  - "a test and a harness picture a proposed view before it is kept"
description: "Roadmap f-draft-view-page (FR-187, next): Cloud pictures describe_place through Browser Rendering but can picture a proposed view only after applying it."
lastModified: "2026-10-19T22:45:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

- **Decided.** `mount({ draftView: { manifest, source } })` (`EmbedDraftView`: a `WorkerViewDefinition` with `source` or `worker`, no `draft`). The embed fetches `@graview/guest/host/views` before it draws, only when a draft is handed (`@graview/embed` now depends on `@graview/guest`), and registers it last with `draft: true`. The host's `views` is handed a registry that leaves out whatever it registers under the draft's name (and its home, for a draft of the home), so a revision stands in for the kept view.
- **The mark.** `registerWorkerView` draws a draft under "Draft — <title> · Not kept" in `role="group"` `aria-label="Draft: <title>"`, `[data-graview-draft-view=<name>]`, `[data-testid=draft-view-line]`. No `name` in its place meta (so no place-menu Hide/Delete, no tidying), no fallback (a stopped draft says why), and playback's `viewAt` is not asked for it.
- **The one-time id is Cloud's.** The framework takes the draft as an option; Cloud serves it once and the shell passes it.
- **Preview.** `graview preview` and `graview shots` take `--view <view.js> --manifest <manifest.json>` (`servePreview`'s `draftView`, handed with `/graview/document`); tried by hand: `graview shots roadmap.gdd.json --view board.js --manifest board.json --places /places/stage-board --scheme dark --width 390`.
- **Verified.** `a-page-opened-on-a-draft-view.test.tsx`, `a-draft-view-is-registered-to-be-seen-and-not-kept.test.tsx`, the preview's `draftView` test; `pnpm verify drawn` in three engines: a draft of the home, a kind's board and a record pictured at 390 px in dark once `data-graview-drawn` is set, marked, standing in for the kept home, a stopped one saying why, nothing kept after.
