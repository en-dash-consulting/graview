---
id: "13abb271-4d49-4e1c-8a8c-407d7dc1e137"
level: "task"
title: "A real-size fixture and a scale harness: apps/discography and verify-scale"
status: "completed"
priority: "critical"
startedAt: "2026-09-29T06:52:44.600Z"
completedAt: "2026-09-29T07:00:30.185Z"
endedAt: "2026-09-29T07:00:30.185Z"
resolutionType: "code-change"
resolutionDetail: "apps/discography: the Tech N9ne catalogue (MusicBrainz, CC0) as a workspace example (port 5197, preview 5198, build/ for the page, es2022 target for the top-level await), with scripts/musicbrainz to rebuild it; in root typecheck and check, ignored by changesets. scripts/verify-scale.mjs (pnpm verify scale): production build + vite preview, rAF recorder with vsync off (launchEngine now passes Chromium args), long tasks, DOM/hosts/strands per stop, writes docs/scale.json. Baseline committed failing all seven claims: altitude 21,335 elements; hub 1,259 hosts, 2,214 strands, drag p50 986 ms; select/type ~1 s frames; rise worst 4 s. Frame claims held to p95 ≤ 20 ms (idle headless frame ~19 ms) and no frame past the first over 50 ms."
acceptanceCriteria:
  - "apps/discography builds, typechecks and passes graview check inside the workspace"
  - "pnpm verify scale runs scripts/verify-scale.mjs and writes docs/scale.json with the claims theCityAtAltitudeIsLight, aHubStopIsBounded, everyGroupOpens, panningHolds60, wheelHolds60, aTransitionHolds60, aSelectionAndASearchAreCheap"
  - "the baseline verdict is committed and fails, naming the claims that fail"
description: "Bring the Discography (Tech N9ne's catalogue from MusicBrainz, CC0, with scripts/musicbrainz to rebuild it) into apps/discography as a workspace example, ignored by changesets like the others. Write scripts/verify-scale.mjs against its production build: a requestAnimationFrame recorder with vsync off, long tasks, DOM and host and line counts per stop, writing docs/scale.json. Record the baseline (it fails) before anything changes."
lastModified: "2026-09-29T07:00:30.255Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
