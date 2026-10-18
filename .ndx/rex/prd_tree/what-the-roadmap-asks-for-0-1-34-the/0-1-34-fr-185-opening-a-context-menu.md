---
id: "2b16bb49-5218-4f2c-92ab-c8ad3ce5382c"
level: "task"
title: "0.1.34 · FR-185: Opening a context menu spends no thinking-model call"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
startedAt: "2026-10-18T03:50:00.000Z"
completedAt: "2026-10-18T04:20:00.000Z"
endedAt: "2026-10-18T04:20:00.000Z"
acceptanceCriteria:
  - "with only a thinking slot, opening and closing a context menu makes no AI call (a test counts calls)"
  - "asking for suggestions then takes one press (a Suggest row)"
  - "with a Fast slot, suggestions on open still come from the Fast slot; a host may turn suggest-on-open off"
description: "Roadmap f-menu-suggest-costs (FR-185, priority next). InlineAiMenu asks suggest on every open; suggestHere falls back to the thinking slot without a Fast one, about 0.65 Cloud credits per right-click. Lands with FR-186."
lastModified: "2026-10-18T04:20:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided:

- A menu asks for suggestions as it opens only with a Fast slot. `HostAi.suggestOnOpen` sits beside the slots in `packages/tools/src/ai.ts`: `false` means "on request only" even with a Fast slot; unsaid, a Fast slot is asked on opening as before. `suggestsOnOpen(ai)` (`@graview/tools/inline-ai`) answers it, and is what `InlineAiMenu` reads.
- Otherwise the AI section draws a "Suggest…" row (`[data-menu-item="ai-suggest"]`). Pressed, it asks once (the Thinking slot when that is all there is), keeps the menu open, says "Thinking…" on itself while it waits, and puts the keyboard on the first row that arrived, never on `<body>`.
- Found on the way: the menu asked once per drawing of its target object, which the Inspector makes anew on every draw, so a Fast slot was asked twice per right-click. The ask is now keyed by the target's words, and the suggestion cache FR-186 needed landed here too (`heldSuggestion`, `suggestOnce` in `inline-ai-menu.tsx`).

Tests (each watched failing first, then passing): `packages/pages/tests/unit/opening-a-context-menu-spends-no-thinking-model-call.test.tsx`. It counts calls on wrapped `stubFast`/`stubThinking`:

- "with only a thinking slot, opening and closing the menu makes no AI call, and Suggest… asks with one press". It failed on the old code (a thinking call on open, no Suggest row).
- "with a Fast slot, the menu still suggests as it opens, from the Fast slot only". It failed first with `{ fast: 2 }`, the double ask.
- "a host that says suggestOnOpen: false is asked only when Suggest… is pressed, even with a Fast slot". It failed first with `{ fast: 2 }`.

Harness (`GRAVIEW_PORT_BASE=5800 pnpm verify inline-ai menu --quick`): `inline-ai` passed with a new claim, `onlyAThinkingSlotAsksWhenSuggestIsPressed` (opened and closed: `{ fast: 0, thinking: 0 }`, Suggest row drawn, one press `{ thinking: 1 }`, offers drawn), and every earlier claim held. `menu` passed every claim.
