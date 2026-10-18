---
id: "5f0ea620-4187-472a-b44e-c366f50e998c"
level: "task"
title: "0.1.34 · FR-186: The right-click menu is ready before the click"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
startedAt: "2026-10-18T04:00:00.000Z"
completedAt: "2026-10-18T04:20:00.000Z"
endedAt: "2026-10-18T04:20:00.000Z"
blockedBy:
  - "2b16bb49-5218-4f2c-92ab-c8ad3ce5382c"
acceptanceCriteria:
  - "a short dwell (~150 ms) or keyboard focus on a record, card, row or kind prepares its derived acts and sections and loads the menu lazy chunks; a pass-over does nothing"
  - "a menu opened on a target the pointer rested on draws complete in its first frame; a reopened menu makes no new AI call until the record, seat or declaration changes"
  - "hovering across a list makes no AI call at all; suggestions come at most once per target, from the Fast slot only"
description: "Roadmap f-menu-prefetch-cache (FR-186, priority next). The menu derives everything on open and the inline AI section is a lazy chunk behind Suspense, so it fills in while the reader watches. Prefetch on hover/focus/touch-down, cache per target keyed by what it depends on."
lastModified: "2026-10-18T04:20:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided:

- **Getting a menu ready lives in the `Inspector` door** (`packages/primitives/src/workbench/inspector-door.tsx`, `useMenuReady`), since both faces draw one inside their menu sections. Each of these readies the menu at once:
  - the pointer resting 150 ms on a `[data-graview-pick]`, `[data-graview-view]`, `[data-graview-record]`, `[data-graview-act]`, `[data-graview-field]` or link (a pass-over cancels on `pointerout`);
  - `focusin` on one, so Shift+F10 opens at once;
  - a touch or pen `pointerdown` on one, so a long press opens at once.

  The scene aims at the pick or card. The routed face passes `aimAt` (its own `aimAt`, scoped to its root). A target is readied once until the log moves.
- **Readying does four things.** It fetches the pane chunk, which holds the act forms. It derives the acts and keeps them (`prepareActs` in `inspector.tsx`, which asks exactly as `Pane` asks: the selection, focus, seat, providers and `loadPins()`). It calls each section's new optional `MenuSection.prepare` through `useMenuPrepare()` (`@graview/react/drawing`): the inline AI section prefetches its chunk, and "Notify me…" prefetches its sheet. It never makes a model call. Nothing is fetched at startup, and the hosted-page and embed budget tests still pass.
- **The derived-acts cache** is in `useAffordances` (`packages/react/src/affordances.ts`). Entries are kept per store, keyed by the selection, the principal, the providers' identity, the pins and the focus. The cache is cleared on any store change and whenever the log length moves. A call with any other option (`context`, `limit`) bypasses it. `prepareAffordances` and `AffordancesAsked` are exported from `@graview/react`.
- **The suggestion cache** landed with FR-185 (`inline-ai-menu.tsx`). Entries are keyed by the target's words and the seat, and hold only while the declaration (`store.schema`) and the host `ai` are the same objects. For a record, an entry stands only while the record node is the same object, which a change replaces; for a list, a lens or a place, until any change. Failures are not kept. At most 64 entries are kept per store.

Tests (each watched failing first, by running them against the code before this change, then passing):

- `packages/pages/tests/unit/the-right-click-menu-is-ready-before-the-click.test.tsx`:
  - "a menu opened on a row the pointer rested on draws complete in its first frame" (the right-click is in a synchronous `act`, then acts, the AI section and "Ask about this…" are checked). It failed first: no AI section in the first frame.
  - "a pass-over readies nothing; a rest of a moment readies the menu once" (a host section's `prepare` is counted). It failed first: `[]`.
  - "the keyboard landing on a row, or a finger going down on one, readies it at once". It failed first: `[]`.
  - "hovering across a list asks no model".
  - "a reopened menu makes no new AI call until the record changes, and draws what was suggested in its first frame". It failed first against the pre-FR-185 menu: no offers in the reopened menu's first frame.
- `packages/react/tests/unit/the-acts-derived-for-a-target-are-kept-until-the-graph-changes.test.tsx` has four tests: prepared then drawn gives the same object with the providers asked once; reopened, nothing is derived again; a change derives anew; targets are kept apart. They failed first: there was no `prepareAffordances`, and a remounted menu derived again.
- `the-provider-carries-only-what-the-frame-draws-with.test.ts` lists `useMenuPrepare` as drawing-only.

Harness (`GRAVIEW_PORT_BASE=5800 pnpm verify inline-ai menu --quick`):

- `inline-ai` passed with two new claims:
  - `aRestedOnMenuDrawsCompleteInItsFirstFrame`: hovering five task cards for 250 ms each made `{ fast: 0, thinking: 0 }` calls. A right-click dispatched after a 500 ms rest drew a menu one frame later with 13 acts, the AI section and "Ask about this…", and no missing-part line. The open then made exactly one Fast call.
  - `aReopenedMenuAsksNothingUntilTheRecordChanges`: offers were drawn in the reopened menu's first frame, there was no "Thinking…", and the Fast calls stayed at 1.
- Every earlier `inline-ai` claim held, and `menu` passed every claim.
