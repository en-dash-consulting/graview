---
id: "13abb271-4d49-4e1c-8a8c-407d7dc1e137"
type: "change"
title: "A real-size fixture and a scale harness: apps/discography and verify-scale"
slug: "a-real-size-fixture-and-a-scale"
intent: "Bring the Discography (Tech N9ne's catalogue from MusicBrainz, CC0, with scripts/musicbrainz to rebuild it) into apps/discography as a workspace example, ignored by changesets like the others. Write scripts/verify-scale.mjs against its production build: a requestAnimationFrame recorder with vsync off, long tasks, DOM and host and line counts per stop, writing docs/scale.json. Record the baseline (it fails) before anything changes."
acceptanceCriteria:
  - "apps/discography builds, typechecks and passes graview check inside the workspace"
  - "pnpm verify scale runs scripts/verify-scale.mjs and writes docs/scale.json with the claims theCityAtAltitudeIsLight, aHubStopIsBounded, everyGroupOpens, panningHolds60, wheelHolds60, aTransitionHolds60, aSelectionAndASearchAreCheap"
  - "the baseline verdict is committed and fails, naming the claims that fail"
touches:
  - "a2faf2f8-0f70-44a5-935b-9e7f608e8c46"
priority: "critical"
---
