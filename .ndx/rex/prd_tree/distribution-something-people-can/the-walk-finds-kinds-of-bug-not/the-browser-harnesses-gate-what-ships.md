---
id: "e18a4d24-fdd4-4da8-8ad0-85c3bc90bcee"
level: "task"
title: "The browser harnesses gate what ships"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
  - "quality"
  - "harness"
completedAt: "2026-10-01T15:29:25.000Z"
endedAt: "2026-10-01T15:29:25.000Z"
resolutionType: "code-change"
resolutionDetail: "Nightly (.github/workflows/nightly.yml) runs every harness one at a time on the runner (shrunk, panning and scale need a real GPU and run locally), journeys two-wide, verdicts kept as an artifact; Mondays or on request add pnpm engines. release.yml refuses a publish run while the last finished Nightly on main is not green. Eight nightlies to green (run 36876602363, 21 of 21): the first failed on load (three harnesses side by side on two cores); the rest each found one thing only a slow machine shows \\u2014 four harness one-look checks (now patience: appears(), a leap timed per frame) and five real races fixed at the root (Find dropping keys, a menu and the studio dropping the keyboard, two arrangement changes before one redraw, the keyboard rule's fixed moments). GRAVIEW_SLOW=4 throttles every harness page like the runner, so the full chain reproduces it locally (21 of 21 at 4x before the green nightly)."
acceptanceCriteria:
  - "a nightly workflow runs pnpm verify and pnpm site in Chromium and fails red on any claim"
  - "a weekly run of pnpm engines in WebKit and Firefox"
  - "the release workflow refuses to publish when the last nightly on main is red"
lastModified: "2026-10-01T15:29:25.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
