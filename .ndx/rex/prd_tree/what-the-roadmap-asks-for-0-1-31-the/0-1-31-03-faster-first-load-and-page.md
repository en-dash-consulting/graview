---
id: "b9e64a2e-8fdf-489e-a3f6-2a8bdeeb5605"
level: "task"
title: "0.1.31 · 03: Faster first load and page switches, measured and held by a CI budget"
status: "completed"
startedAt: "2026-10-16T08:28:53.000Z"
completedAt: "2026-10-16T09:59:15.000Z"
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
lastModified: "2026-10-16T09:59:15.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-16. Measured first with a new harness, `pnpm verify first-load` (scripts/verify-first-load.mjs): Cloud's shell as `graview preview` builds it, served gzipped over HTTP/2 (scripts/lib/secure-front.mjs), over the roadmap fixture grown to 190 features (330 records) and the todo-sized tasks document, at a desk (40 ms, 20 Mbit/s) and on a phone (4x CPU, slow 4G), median of three cold runs. Numbers before and after are in docs/first-load.md.

What was slow, from the phone's waterfall: the store opened two round trips after the page ran and then waited for the socket's welcome; chunks were discovered a level at a time; every picture on the home was fetched and drawn before the page answered; a switch to the scene suspended into a placeholder React holds 300 ms. Fixed: `openRemote({ state })` and the preview handing the state with the document (and opening without waiting for the welcome); modulepreload links and `import()` rewritten to preload a door's chunks in the preview build (`preloadLinks`, `doorsOpenAtOnce`); gallery pictures drawn as they near the window; the scene fetched before a switch (at most 150 ms), the other face fetched when a desk is idle or a hand reaches for the switch (`BarFace.reach`); `graview serve`/`preview` gzip their answers.

Result: cold load to interactive 31–38% faster on both profiles and both apps; desk switches 13 ms (record) and 37 ms (scene, was 343). Not met: phone switches are not 30% faster (record was already 55 ms; the scene is its own chunks over slow 4G, deliberately not prefetched on a phone). CI: new `first-load` job in ci.yml, part of `verify`, holding `TIMING_BUDGET`; the hosted page and embed bundle budgets hold the first-load bytes (raises filed). Left for Graview Cloud: hand state in its /graview/document with `openTimeoutMs: 0`, and adopt the preload links and door rewriting in its build. Splitting the routed face's pages into their own doors was weighed (about 0.15 s on the phone) and left.
