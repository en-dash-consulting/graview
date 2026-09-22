---
id: "5c901c77-690f-46e6-a7bc-de4c93ddb83c"
level: "task"
title: "Panning the city holds 60fps: the camera moves without recomputing the world"
status: "pending"
priority: "high"
tags:
  - "graview"
  - "city"
  - "camera"
  - "performance"
source: "Nick, 2026-09-22: \"panning on screen is not 60fps\""
acceptanceCriteria:
  - "Dragging the ground at altitude and in the stack holds a median of 55fps or better over a two-second drag on the sample apps, measured by a harness rather than by eye"
  - "layout() runs at most once per animation frame during a pan, and not at all for a change that only moves the camera"
  - "connectorStrands does not re-measure the DOM on a camera-only change"
  - "Lines, tiles, roads and villages stay registered with the cards they belong to for the whole drag — no drift, verified by the navigation harness"
  - "A frame-rate verdict is added to a harness so this cannot silently regress"
description: "A pan is `setView(withPan(...))` per pointer move and per wheel tick (scene.tsx:454, :814), and `state.pan` is applied INSIDE `layout()` (layout.ts:1358) — so every frame of a drag re-runs the whole layout, re-renders every view, and re-measures the DOM. `connectorStrands` is deliberately not memoised (\"Not memoised: it measures the DOM, and the DOM is what changed\") and now also collects a box for every `[data-graview-pick]` and `[data-graview-slot]` on the stage, so a pan pays for a full querySelectorAll plus a getBoundingClientRect per drawing per frame. None of that changes during a pan: the world is identical and only the camera moved. Move the camera as a transform on the stage (or a cheap per-frame offset applied after layout), hold layout, strand measurement and view renders while a gesture is live, coalesce the pointer stream to one update per animation frame, and do the full recompute once when the gesture ends. Note: the obstacle-gathering added on 2026-09-22 (a line dives under the drawings inside a view) very likely made this worse and is part of what this task must pay for. Related: 6c1b654a landed the pan and zoom this is about."
lastModified: "2026-09-22T05:14:45.098Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
