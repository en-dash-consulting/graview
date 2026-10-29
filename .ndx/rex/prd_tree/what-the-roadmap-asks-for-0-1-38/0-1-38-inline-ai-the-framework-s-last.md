---
id: "dd64c586-6570-426d-ab55-845e913a11ab"
level: "task"
title: "0.1.38 · Inline AI, the framework's last part: a selection bar, one quiet hover chip, and the AI section under 400 ms"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
acceptanceCriteria:
  - "several selected records get a selection bar: the acts they share, and the AI's suggestions for the set from the Fast slot"
  - "a quiet hover chip: at most one, above a confidence threshold, Fast slot only and cached, never on a pass-over, with an off switch for the host and for the person"
  - "a harness claim that the menu's AI section fills in under 400 ms p95 with a Fast slot of realistic latency; AI off still hides every part; tests fail first"
description: "Roadmap f-inline-ai-framework-finish, the framework half still open of feature:inline-ai-in-the-context-menu-directed-by-jev (planned by Nick 2026-10-19; its blockers have shipped)."
completedAt: "2026-10-19T06:10:00.000Z"
endedAt: "2026-10-19T06:10:00.000Z"
lastModified: "2026-10-19T06:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "On feat/inline-ai-finish: the existing selection bar (several-bar.tsx) offers, for two or more chosen, the Fast slot's pick among the acts they share, the kind's panels and places (suggestForSeveral), once per choice; ai.hoverChips: true gives one hover chip after the menu's dwell when the Fast slot is at least 60% sure, with the reader's switch in the person menu; verify-inline-ai measures the menu's AI section at 262–277 ms p95 over twenty opens with a 100–250 ms Fast slot."
---

## Notes

**Decision: the bar is the choosing bar, extended.** The selection bar from f-bulk-acts-pages
(`several-bar.tsx`, on a page's list, the scene's kind stop and the columns lens) already says the
acts the chosen share; it now carries a lazy AI part (`several-ai.tsx`) for two or more chosen.
`suggestForSeveral` on `@graview/tools/inline-ai` asks the Fast slot one Choice among the shared
acts that ask nothing (not "More" or destructive ones), the kind's panels and places — never the
Thinking slot, and not at all with `suggestOnOpen: false`. A suggested act is pressed through the
bar's own `press`, so it runs over every chosen record as one batch, like its button. Asked once per
choice through the menu's keeping (`suggestOnce` now takes an asker, keyed `"several"` apart from
the menu's), so choosing the same records again asks nothing until one of them changes. The second
suggestion is shown only at 25% or more.

**Decision: hover chips are off unless the host asks.** `HostAi.hoverChips?: boolean`, default
off, on only with a Fast slot (`hoverChipsOn`). Default on would have broken FR-186's promise that
resting across a list asks no model (`aRestedOnMenuDrawsCompleteInItsFirstFrame`), and a hover is
not a question the reader asked. The chip reuses the menu's dwell (150 ms, `useMenuReady` in
`inspector-door.tsx`), shows the first suggestion only at `HOVER_CHIP_CONFIDENCE` (0.6) or above,
shares the menu's cache (a chip and a menu on the same record ask once between them), is one at a
time (one module-level rest; the first door drawn draws it), leaves 300 ms after the pointer does
unless the pointer reaches it, and goes on any press, scroll or resize. Records only; never from the
keyboard or a finger. The reader's switch is "AI suggestions on hover" in the person menu, kept in
the host's `memory` or `localStorage` (`graview:hover-chips`). Everything is fetched only where the
host asked for chips.

**Measured.** `theMenusAiSectionFillsInUnder400MsAtP95`: twenty opens, each on a task not yet
asked about (page reloaded when they run out), pointer rested 200 ms first, Fast slot 100–250 ms:
p50 180 ms, p95 262 ms; again after the chips were made lazy, p50 221 ms, p95 277 ms. `aHoverChipIsAtMostOneAndNeverOnAPassOver` and `aHoverChipVanishesWithAiOff`
hold. Budgets: 152 B up front on a hosted page (raised 0.2 KB), a few hundred bytes on the embed's
faces; the scene face 965_250 B, under the 943 KB cap.

**Found on the way.** `vitest.config.ts` had no alias for `@graview/tools/several`, so the selection
bar never loaded in a jsdom test; added.
