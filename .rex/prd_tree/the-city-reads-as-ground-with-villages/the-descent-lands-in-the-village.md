---
id: "afaf6883-af49-4ef8-a967-0f52677e41f1"
level: "task"
title: "The descent lands in the village: leaving altitude zooms into the plot you chose, with its tile as the pivot, rather than flying it to the centre"
status: "pending"
priority: "medium"
tags:
  - "city"
  - "altitude"
  - "signs"
  - "descent"
acceptanceCriteria:
  - "Double-clicking a village from altitude grows it where it stood and the world slides to meet it; the focus card ends centred as today"
  - "The camera offset never appears in the URL; the pan the person made is untouched"
  - "The ground says when it is settled (no tween, no glide) and the navigation harness waits on that rather than on a timer"
  - "Survey, audit, navigation and shrunk harnesses pass"
description: "The signpost half of this task landed with the drive-in (f3119731): every nameplate is planted at its plot's front corner on a post, test ids unchanged. What remains is the descent. Leaving altitude is already a 640ms morph (useAnimatedLayout tweens every card from its plot to its place in the stack, tiles and buildings fade with --graview-altitude), so it is not a cut — but the village you double-clicked FLIES to the stage's centre while the rest reorganises around it, which reads as the picture rearranging rather than you coming down. Make the plot the pivot: on descent from a district with a plot, land the stack's focus where the village stood (a camera offset of plot centre − stage centre applied for the morph's first frame) and then glide the camera to rest over the next 400ms, so the village grows in place and the world slides to meet it. The camera is scene state (see fbd4292: never in the URL). Harness timings: navigation waits ~800–900ms after a double-click, so the glide must finish inside the existing morph or the harness must wait for the camera to settle (data-graview-settled on the ground when no tween or glide is running would let every harness wait honestly instead of sleeping)."
lastModified: "2026-09-20T12:33:22.121Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
