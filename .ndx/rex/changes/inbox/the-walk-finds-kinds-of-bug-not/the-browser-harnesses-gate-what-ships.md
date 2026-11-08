---
id: "e18a4d24-fdd4-4da8-8ad0-85c3bc90bcee"
type: "task"
title: "The browser harnesses gate what ships"
slug: "the-browser-harnesses-gate-what-ships"
acceptanceCriteria:
  - "a nightly workflow runs pnpm verify and pnpm site in Chromium and fails red on any claim"
  - "a weekly run of pnpm engines in WebKit and Firefox"
  - "the release workflow refuses to publish when the last nightly on main is red"
priority: "critical"
tags:
  - "walkthrough"
  - "quality"
  - "harness"
---
