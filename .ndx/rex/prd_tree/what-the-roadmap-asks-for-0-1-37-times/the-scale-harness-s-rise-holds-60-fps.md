---
id: "50a02d95-ec33-4647-8175-6e73f0e1a75a"
level: "task"
title: "The scale harness's rise holds 60 fps again on the discography app"
status: "completed"
priority: "medium"
tags:
  - "harness"
source: "ndx-capture"
acceptanceCriteria:
  - "pnpm verify scale holds aTransitionHolds60 on a real GPU (worst frame under 50 ms at the rise stop)"
  - "the cause in apps/discography's build since #289 is named: the second build input live.html and the dynamic import of @graview/render/gpu in src/main.tsx each bring a 69 ms frame back; reverting both restores 35 ms"
description: "Found 2026-10-19 while clearing 0.1.37's harness reds: scale's aTransitionHolds60 fails on main too, bisected to eda1ff017 (#289, perf/capture-past-128). Not the framework: reverting #289's scene-root.tsx and view-host.tsx changes leaves the jank; the discography example app's vite config (live.html as a second input) and its dynamic import of @graview/render/gpu re-split the page's chunks (the catalog seed into its own 535 KB chunk). scale is not in the Nightly (it times frames against a real GPU). Next: build live.html in its own vite build, find why the gpu dynamic import janks the rise, or re-baseline with a reason."
completedAt: "2026-10-19T12:00:00.000Z"
endedAt: "2026-10-19T12:00:00.000Z"
lastModified: "2026-10-19T12:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Framework, on fix/scale-rise-60fps: the long task in the rise was the chosen record's lines (RecordLinks) measuring the stage once per linked record; linksOfRecords no longer asks for a relation that goes to its district, and the layer indexes the stage once. Rise worst frame 71 ms -> 37 ms."
---

## Notes

**The cause is the framework, not the build.** A Performance trace of the
rise (Playwright CDP tracing with the V8 sampling profiler, on an
unminified build of the same page) shows the 67 ms long task about 800 ms
into the rise, and the 41 ms and 50 ms frames after it: each is a React
layout effect in `RecordLinks` (`packages/react/src/record-links-layer.tsx`)
— 410 of 433 samples under `linksOfRecords` → `ownBox` →
`querySelectorAll` / `querySelector` / `getBoundingClientRect`. The scale
run selects a band card at the hub, so at the city the chosen record draws
its lines, and `linksOfRecords` asked `drawn(id)` (a stage-wide query and a
box) for every record each relation reaches — the hub's thousand songs —
before deciding that a relation past `LINKS_TO_EACH` is one line into the
district whatever the answers. The same task is in the build before #289
(37.6 ms, 183 of 211 samples in the same calls): just under the 50 ms line.
#289's re-split (live.html as a second input, the gpu dynamic import) only
moved when the effect ran: in the re-split build its first
`getBoundingClientRect` forced a 29 ms style and layout, which took the task
to 67–71 ms. That is why either change alone brought the frame back and
reverting both "fixed" it — and why an unminified build of the reverted
config janks too (73 ms).

**Fix.** `linksOfRecords` checks the handful first and asks `drawn` only
for relations whose lines may land on records (tests: "never asks whether
the map draws a record whose relation is said as one line into its
district", "asks once for each record a line might land on", both failing
before), and the layer reads the stage once into maps by id
(`data-graview-pick`/`-view`, `-building`) rather than one query per record.
apps/discography's build is unchanged. Budget: the "every face" embed entry
takes 356 / 159 bytes (`scripts/budget-raises/a-hubs-links-are-measured-once.json`).

**Verdicts.** `GRAVIEW_PORT_BASE=5600 pnpm verify scale --strict`: before,
`aTransitionHolds60` false (rise worst 71 ms, slow frames at 895/1480/1530
ms, one long task); after, every claim holds (rise worst 37 ms, no long
task; descend 20, focus the hub 19). `pnpm verify lines` holds,
`pnpm verify renderer --quick` holds, `verify-journeys discography` no
regressions; `packages/react` 143 tests pass; the embed budget test holds.
