---
id: "61161f4d-c45d-4b3e-801e-a133b5539d9f"
level: "task"
title: "0.1.31 · 04–05: GPU compositing by default, with per-plane blur riding on it"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "a Chromium or Safari 18+ page draws on the GPU by default, and a page without WebGPU looks the same and says nothing"
  - "every harness holds on both paths in the nightly, and the accessibility tree is identical on both"
  - "on the GPU path the focused plane is sharp and the others blurred at the same measured frame budget as without blur; the DOM path blurs within budget or not at all"
  - "the blur off switch and the reduced-transparency preference turn blur off"
description: "Roadmap f-gpu-default (04) and f-plane-blur (05, after 04). The WebGPU capture path in @graview/render draws correctly but is opt-in, Chromium-only and behind a flag; f-capture-budget (shipped) removed the 128-live-view cliff. 04: turn the GPU path on by default where WebGPU is present and holds the frame budget; fall back to the DOM renderer silently and per page where WebGPU is absent (Firefox, older Safari) or a short first-frame check fails; run the scale, panning, lines and a11y harnesses on both paths. 05: on the GPU path, blur unfocused planes in the compositor shader by depth/focus, the focused plane sharp; on the DOM path use CSS filter: blur() per plane only within the frame budget, otherwise no blur; an off switch, and prefers-reduced-motion / prefers-reduced-transparency honored. If blur cannot hold the budget, ship 04 alone and say so on f-plane-blur."
lastModified: "2026-10-16T04:36:19.267Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
