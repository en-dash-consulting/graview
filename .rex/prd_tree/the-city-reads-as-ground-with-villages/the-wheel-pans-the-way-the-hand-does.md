---
id: "e43520bf-ebdd-41d4-8b38-5318e4bafa14"
level: "task"
title: "The wheel pans the way the hand does: no state written per tick"
status: "in_progress"
priority: "medium"
tags:
  - "graview"
  - "city"
  - "camera"
  - "performance"
source: "Found while doing 5c901c77 on 2026-09-22; recorded there as explicitly not done."
startedAt: "2026-09-22T14:06:51.468Z"
acceptanceCriteria:
  - "A wheel pan over the ground writes no view state until the wheel has settled"
  - "The picture does not move when the wheel's pan is committed — the same 'letting go changes nothing' verdict the drag has"
  - "Zooming while a wheel pan is still live settles it first rather than reading a stale offset"
  - "scripts/verify-panning.mjs gains a wheel case at altitude and in the stack, held to the same floor as the drag"
description: "A drag no longer writes `view.pan` per pointer move — the offset is painted onto the `[data-graview-world]` layers as a transform and only the release commits it (see 5c901c77). The wheel was left on the old road: `panBy.current` in scene.tsx still calls `setView(withPan(...))` on every tick, so a wheel pan pays the full cost the drag used to — a layout, a render of every context consumer, and a DOM re-measure per tick. The drag was the measured complaint and the wheel was not, which is why it was left; it is the same mechanism and should end the same way. The settle point already exists: `steer()` refreshes a 160ms timer and its expiry is the end of the gesture. The one care needed is the same one the drag needed — `setSteering(false)` must not re-enable the tween before the committed pan has been drawn, or the picture flies from where the wheel left it, which is the bug this task's predecessor spent its time on. Zoom shares `steer()` and does write state, so a live shift must be settled before a zoom rather than left to go stale."
lastModified: "2026-09-22T14:06:51.528Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
