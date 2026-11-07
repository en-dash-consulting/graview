---
id: "50a02d95-ec33-4647-8175-6e73f0e1a75a"
type: "change"
title: "The scale harness's rise holds 60 fps again on the discography app"
slug: "the-scale-harness-s-rise-holds-60-fps"
intent: "Found 2026-10-19 while clearing 0.1.37's harness reds: scale's aTransitionHolds60 fails on main too, bisected to eda1ff017 (#289, perf/capture-past-128). Not the framework: reverting #289's scene-root.tsx and view-host.tsx changes leaves the jank; the discography example app's vite config (live.html as a second input) and its dynamic import of @graview/render/gpu re-split the page's chunks (the catalog seed into its own 535 KB chunk). scale is not in the Nightly (it times frames against a real GPU). Next: build live.html in its own vite build, find why the gpu dynamic import janks the rise, or re-baseline with a reason."
acceptanceCriteria:
  - "pnpm verify scale holds aTransitionHolds60 on a real GPU (worst frame under 50 ms at the rise stop)"
  - "the cause in apps/discography's build since #289 is named: the second build input live.html and the dynamic import of @graview/render/gpu in src/main.tsx each bring a 69 ms frame back; reverting both restores 35 ms"
touches:
  - "a2faf2f8-0f70-44a5-935b-9e7f608e8c46"
priority: "medium"
tags:
  - "harness"
source: "ndx-capture"
resolution: "Framework, on fix/scale-rise-60fps: the long task in the rise was the chosen record's lines (RecordLinks) measuring the stage once per linked record; linksOfRecords no longer asks for a relation that goes to its district, and the layer indexes the stage once. Rise worst frame 71 ms -> 37 ms."
---
