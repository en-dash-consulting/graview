---
id: "9363b216-bad2-49e9-b2d4-598aa1a40c25"
level: "task"
title: "0.1.34 · FR-184: A panel drawn from the right-click menu opens in the face it was asked on"
status: "completed"
startedAt: "2026-10-18T02:50:00.000Z"
completedAt: "2026-10-18T03:10:00.000Z"
priority: "critical"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
acceptanceCriteria:
  - "\"Draw a panel\" (and takeOffer of a panel offer, and the quick ask card) from a menu opened on Pages lands on /~draft with Keep as a lens and Discard, and never switches face; a test fails without the fix"
  - "on the scene a drawn draft is framed on the scene surface like a panel, not a bare list on the ground with the district inspector open"
  - "a failed ask from the menu is said where it was asked, not only in Activity"
description: "Roadmap f-menu-panel-in-its-face (FR-184, priority now). The at-pointer menu is drawn outside the routed face, so useInlineEnv's useGoTo() never sees Pages' GoesByAddress: goTo.draft is undefined and drawPanel's draft waits for the scene, where it is drawn as a bare list. The menu's inline AI must use the goTo of the face the menu was opened on (MenuTarget.face)."
lastModified: "2026-10-18T03:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

- **Decided.** The routed face's `GoesByAddress` now wraps `FaceRoot`, so the context menu at the pointer (drawn in `MenuHome` inside `PagesContextMenu`) is under Pages' `GoToContext`; `PagesApp` wraps `PageQuickAsk` in it too, so the quick ask's card goes by address as well. That is the goTo of the face the menu was opened on (`MenuTarget.face === "pages"`): the menu's `useInlineEnv` reads Pages' `goTo`, whose `draft()` goes to `/~draft`. No new public API; nothing waits for the scene, so the face never switches.
- On the scene, `DraftFrame` (not `page`) is framed as a panel: `inset: 12`, `var(--graview-panel)`, a `var(--graview-edge)` border, radius 12, `var(--graview-lift-high)`, and carries `data-graview-draft-frame="scene" | "page"`. `MapPanel` (the district or record panel beside the map) stands down while the seat holds a draft and comes back when it is kept or discarded.
- A failed ask is said where it was asked: the menu stays open while an ask is on its way ("Asking…", `data-testid="inline-ai-asking"`), is put away just before what was asked for lands (`landing`, threaded through `askInline`, `takeOffer` and `drawPanel`), and a failure is said in it (`role="alert"`, `data-testid="inline-ai-failed"`) as well as kept in Activity. `askInline` now answers the failed entry when nothing could be filled or the panel could not be drawn; `takeOffer` answers the failure sentence. The quick ask's card says a failed offer on the card. A ghost with no proposals is now kept as "Nothing here could be filled in." rather than dropped silently.
- **Tests (each failed first).** `packages/pages/tests/unit/a-panel-drawn-from-the-menu-opens-on-the-pages.test.tsx`: "lands on /~draft with Keep as a lens and Discard, not waiting for the scene" (failed: no navigation) and "says a failed ask in the menu it was asked in, and keeps the menu open" (failed: the menu had closed). `packages/primitives/tests/unit/a-panel-drawn-over-the-scene-is-framed-as-a-panel.test.tsx`: "stands framed on the scene's surface, and the district's panel beside the map is put away while it does" (failed: no frame, the ground's background).
- **Harnesses** (`GRAVIEW_PORT_BASE=5600 pnpm verify inline-ai quick-ask menu --quick`): all three hold. inline-ai gains `aPanelDrawnFromTheMenuOnPagesLandsOnTheDraftPage` (path `/pages/~draft`, Keep as a lens, Discard, face pages, menu put away): true; `aGeneratedPanelIsPinnedIntoARealLens`, `theRecordViewShowsIt` and `aiOffHidesEveryAiPartOnBothFaces` true. quick-ask: `aShowRowDrawsAPanelKeptAsALens`, `theMenuOpensItOnWhatItWasOpenedOn` and `onPagesTheCardStandsByTheRecordsHeading` true. menu: every claim true on desk and phone. Full `pnpm test`: 862 files, 6518 passed.
