---
id: "e18a4d24-fdd4-4da8-8ad0-85c3bc90bcee"
level: "task"
title: "The browser harnesses gate what ships"
status: "in_progress"
priority: "critical"
tags:
  - "walkthrough"
  - "quality"
  - "harness"
acceptanceCriteria:
  - "a nightly workflow runs pnpm verify and pnpm site in Chromium and fails red on any claim"
  - "a weekly run of pnpm engines in WebKit and Firefox"
  - "the release workflow refuses to publish when the last nightly on main is red"
lastModified: "2026-10-01T04:35:44.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
