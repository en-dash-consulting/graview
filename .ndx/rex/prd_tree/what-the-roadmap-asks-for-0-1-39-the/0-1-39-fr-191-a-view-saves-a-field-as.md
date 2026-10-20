---
id: "7cae5029-29ee-4695-804c-e5096c0bbabe"
level: "task"
title: "0.1.39 · FR-191: A view saves a field as the person types, and hears that it saved"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
startedAt: "2026-10-19T20:00:00.000Z"
completedAt: "2026-10-19T21:00:00.000Z"
endedAt: "2026-10-19T21:00:00.000Z"
acceptanceCriteria:
  - "a field with data-save=\"input\" (and data-debounce, default sensible) inside a fieldset data-record with a data-act runs the act on input, debounced, collecting the fields as on a press; the script never holds values; sight and grants unchanged"
  - "the view hears the result: graview.on(\"acted\", …) with the act's outcome (or the result in onProps), so it can show Saving… / Saved"
  - "a call-sheet fixture view saves notes without a button and shows Saved; the graview-worker-view skill teaches it; tests fail first"
description: "Roadmap f-view-save-as-typed (FR-191, next), from req-autosave-from-views (Nick, Farm Bureau POM Workshop's call sheet)."
lastModified: "2026-10-19T21:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided:

- **The save is a press without the click.** `createSaver` (`packages/guest/src/host/press.ts`) is fetched with the press reader. It hears the region's events after the reader does. A trusted `input` on a field that carries `data-act` and `data-save="input"` schedules the save after `saveDebounceOf(field)`: the field's `data-debounce`, 1 000 ms by default, held to 250–10 000. A trusted `change` saves at once what was still waiting (leaving the field). `data-save="change"` saves on `change` alone. `flush()` runs from the view's `stop()`, so a view disposed, stopped or left by `pagehide` saves what was typed.
- **The fields are collected by the reader's new `collect(bound, root)`**, the half of `press()` after the click check. It feeds `judgePress` unchanged, so sight, grants, typed-ness and prefill's back-where-it-came-from all hold as for a press. A click into a field with `data-save` is not a press.
- **The view hears `acted`** — a `dom-event` whose `event` is `acted` with `pressed`, sent on the bound element after every act a press or a save asked for. A click still carries `pressed` as well. The worker runtime needed no change: `graview.on("acted", sel, fn)` matches like any other event. `onProps` carries no result.
- **The checker** (`describeDrawing`, `packages/guest/src/headless/describe.ts`) says a `data-save` on a non-field, a value other than `input` or `change`, no `data-act`, no `name`, no enclosing fieldset or group with a `data-record`, and a `data-debounce` without `data-save="input"` or outside 250–10 000.
- **The fixture**: `scripts/fixtures/workshop-app.ts` gains `call` (who, county, phone, notes) and `save-notes` (writes notes). Everyone sees calls; staff may save. The call sheet is the skill's worked example `examples/a-call-sheet.js`.

Tests (watched failing first against the code before the change):

- `packages/guest/tests/unit/a-view-saves-a-field-as-the-person-types.test.ts` has 9 tests: debounce, `acted`, the default and clamp, change flushes, flush on going, a click is not a press, an untrusted input saves nothing, Rae is refused and the view hears why, and a record that was not shown is refused.
- `packages/guest/tests/unit/the-view-checker-says-what-a-field-saved-as-typed-needs.test.ts` has 5 tests: the checker's words, and the worked example drawn headless with no problem.

Harness:

- `GRAVIEW_PORT_BASE=5800 node scripts/guest-sandbox.mjs --transport=record` was run in chromium, webkit and firefox. Every claim held, with 7 new ones from "the call sheet's notes field is filled by the host with the call's own notes" through "a seat that may not save the notes gets the field unfilled, her typing saves nothing, and the view says why".
- `pnpm verify guest --quick`: 12 of 12 runs held.
- Bundle: the guest host's open-kit drawing grew by 1 373 / 550 (`scripts/budget-raises/a-view-saves-a-field-as-typed.json`). A hosted page's first load is unchanged.
