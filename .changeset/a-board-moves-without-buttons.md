---
"@graview/core": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

A status board moves a card without a button under it, and the shipped lenses take search, filter and column options (Roadmap f-board-move-without-buttons, f-lens-search-filter). A Move… button under every card doubled a board's height, and the Recon app's Actions board could not be searched without a hand-drawn view that could not drag. A card is now dragged, carried by the keyboard — Space picks it up, the arrows carry it between and along the columns, Space drops it and Escape puts it back, each step said in a live region ("Public forms, picked up. Planned, 2 of 16.") — or moved from its own menu's "Move to ›", which lists every other column: the ones this seat may move it to, and the withheld ones struck through with the reason a press would meet (`columnChoices` on `@graview/core/describe`). The card stays one stop for Tab and says how it moves. `add-lens` and a declared or TypeScript `columns` lens take `options`: `search` (the fields Find looks in), `filters` (fields and relations standing as chips), `move` (the Move button back), `collapsed` and `hidden` (columns, by value), and `cap` (the newest cards a column keeps, with "Show N more"). A board of more than twenty cards shows Find without being asked; a smaller one shows it when `search` names its fields. A narrowed card moves as before. A calendar and a coverage take `search` and `filters` too. `graview check` says an option the kind cannot honor as `lens-option`, and `add-lens` refuses it. Up front a hosted page carries 0.7 KB more (722 bytes, 0.6 KB handed a compiled app), the options a declared lens is held to.

Compatibility: a declaration gains the `columns` lens's `search`, `filters`, `move`, `collapsed`, `cap` and `hidden` options and the calendar's and coverage's `search` and `filters`, and `graview check` gains the warning `lens-option`; every declaration that compiled still compiles, and ops, stored formats, the wire and derived tools are unchanged.
