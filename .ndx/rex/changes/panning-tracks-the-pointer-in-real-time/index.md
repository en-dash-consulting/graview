---
id: "17b4fdae-6c99-417d-933f-398c6c6eda2a"
type: "change"
title: "Panning tracks the pointer in real time"
slug: "panning-tracks-the-pointer-in-real-time"
intent: "Panning lagged because it literally lagged by design: every pointer move writes a new view state, and useAnimatedLayout eased toward each one over 520ms — a tween meant for navigation, applied to the hand, so the scene endlessly chased the pointer. Fixed by disabling the animation while the drag gesture is active (the existing `dragging` state), so the picture tracks the pointer 1:1 and the tween returns the moment the hand lets go."
acceptanceCriteria:
  - "While a drag owns the pointer, the scene snaps to each pointer move rather than easing toward it — the 520ms navigation tween is suspended for the duration of the gesture"
  - "Releasing the drag restores the tween for every move not made by hand"
  - "pnpm moving stays green"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
tags:
  - "bug"
  - "interaction"
  - "performance"
source: "Nick, 2026-08-31: \"why does the panning feel so laggy and not realtime.. seems unnecessary\""
---
