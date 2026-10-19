---
id: "8443b77c-6d74-4c1f-8730-a7869209c319"
level: "task"
title: "0.1.39 · FR-188: The page says when a place has drawn and settled"
status: "completed"
startedAt: "2026-10-19T20:10:00.000Z"
completedAt: "2026-10-19T21:30:00.000Z"
priority: "medium"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
acceptanceCriteria:
  - "a stable signal once the current place and its views have drawn and settled: data-graview-drawn on the root (cleared on navigation) and an onDrawn(place) mount callback"
  - "it waits for fonts, images and worker views settled, and a harness checks it against what a person sees; tests fail first"
description: "Roadmap f-page-drawn-signal (FR-188, later): a host picturing a place waits on a guess (opening frame gone, network idle, 600 ms)."
lastModified: "2026-10-19T21:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

- **Decided.** `watchDrawn` (`packages/embed/src/drawn.ts`) is watched again from nothing by `DrawnSignal` each time the place changes (the face shown, the routed face's path, the scene's stop), so `data-graview-drawn` comes off in the commit that moves. It is put back, its value the place's path, once every part drawn is here (`partsArriving()` on `@graview/react`, counted from a drawn part's lazy loader, and `partArriving` wraps the three plain `lazy()`s a page can draw first), the fonts are not loading, nothing says `aria-busy`, every image (a worker view's shadow root's too) is complete or lazy, every `[data-worker-view-place]` holds a region that says `data-worker-view-drawn` or `data-worker-view-failed`, and nothing has moved (a mutation, or the sizes of the root, the face and each view) for 200 ms; ten seconds at most. Then `onDrawn(place)` gets `EmbedWhere`.
- **Renamed.** The old `onDrawn(face)` (FR-57) is `onFaceDrawn` on `<Embed>`; `handle.drawn()` is unchanged. Cloud never passed `onDrawn`.
- **Worker views.** The region says `data-worker-view-drawn` when the last push is answered, the drawing module has drawn what waited, and no picture handed is still being fetched (`GuestPictureHand.waiting()`).
- **Also.** `graview shots` waits for the attribute instead of 0.7 s / 1.8 s.
- **Verified.** `the-page-says-when-a-place-has-drawn.test.tsx` (fails with the signal left out); `pnpm verify drawn` in three engines, a phone in dark and a desk in light: a font 1.5 s late, a view's image 1.2 s late, nothing moving for 1.5 s after, off on a move and back, a stopped view, the scene. Not covered: frame guests (`guestView`, an iframe) are not waited for.
