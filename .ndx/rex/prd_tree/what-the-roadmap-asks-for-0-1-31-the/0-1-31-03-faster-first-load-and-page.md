---
id: "b9e64a2e-8fdf-489e-a3f6-2a8bdeeb5605"
level: "task"
title: "0.1.31 · 03: Faster first load and page switches, measured and held by a CI budget"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "baseline and after numbers for cold load and page switch, on both profiles and both apps, are in the PR and the release notes"
  - "cold load to interactive and a page switch are each at least 30% faster than baseline on both profiles, or under 2 s cold / 300 ms switch on desktop"
  - "CI fails on a breach of a bundle-size budget and a headless load-timing budget"
description: "Roadmap f-perf-first-load, from Nick's report 'too slow to load initially and between pages' (2026-10-15). Measure first: cold load (first useful paint and interactive) and a page switch (list to record, Pages to Scene) on a mid-range phone profile and desktop, on the Roadmap app (~190 features) and a small app, with the numbers in the PR. Then fix the top causes found: likely the up-front bundle (split the Scene/render path and lenses not on screen), data fetched before first paint, and whole lists re-rendered on a switch (keep the previous page's data, render the shell first)."
lastModified: "2026-10-16T04:36:18.174Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
