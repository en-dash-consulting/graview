---
"@graview/tools": patch
"@graview/primitives": patch
"@graview/core": patch
---

Opening a context menu spends no thinking-model call (FR-185). The menu's AI section asked for suggestions every time it opened, and `suggestHere` goes to the Thinking slot when there is no Fast one, so a host that gave only `ai.thinking` paid one language-model call per right-click, and opening and closing a menu cost as much as asking. Now a menu asks as it opens only with a Fast slot; with only a Thinking slot (or `complete`, or `turn`) it offers a "Suggest…" row (`[data-menu-item="ai-suggest"]`) that asks when pressed, keeps the menu open, and draws what was suggested in it, with the keyboard on the first row that arrived. `HostAi.suggestOnOpen` lets a host say it: `false` makes it the row with a Fast slot too; unsaid, a menu with a Fast slot asks on opening as before. `suggestsOnOpen(ai)` from `@graview/tools/inline-ai` answers whether a menu would. A menu drawn again while open no longer asks again: it asked once per drawing of its target object, which the menu makes anew on every draw, so a Fast slot was asked twice for one right-click. `capabilities().shipped` gains FR-185.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` lists FR-185. What Graview Cloud does: nothing to stop paying for a right-click with only a Thinking slot; to give its readers suggestions as a menu opens, fill `ai.fast` (Jev, `jevFast`), and pass `suggestOnOpen: false` where a Fast call per menu is still too many.
