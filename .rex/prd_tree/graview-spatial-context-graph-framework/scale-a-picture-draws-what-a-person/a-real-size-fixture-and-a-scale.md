---
id: "13abb271-4d49-4e1c-8a8c-407d7dc1e137"
level: "task"
title: "A real-size fixture and a scale harness: apps/discography and verify-scale"
status: "pending"
priority: "critical"
acceptanceCriteria:
  - "apps/discography builds, typechecks and passes graview check inside the workspace"
  - "pnpm verify scale runs scripts/verify-scale.mjs and writes docs/scale.json with the claims theCityAtAltitudeIsLight, aHubStopIsBounded, everyGroupOpens, panningHolds60, wheelHolds60, aTransitionHolds60, aSelectionAndASearchAreCheap"
  - "the baseline verdict is committed and fails, naming the claims that fail"
description: "Bring the Discography (Tech N9ne's catalogue from MusicBrainz, CC0, with scripts/musicbrainz to rebuild it) into apps/discography as a workspace example, ignored by changesets like the others. Write scripts/verify-scale.mjs against its production build: a requestAnimationFrame recorder with vsync off, long tasks, DOM and host and line counts per stop, writing docs/scale.json. Record the baseline (it fails) before anything changes."
lastModified: "2026-09-29T06:52:23.108Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
