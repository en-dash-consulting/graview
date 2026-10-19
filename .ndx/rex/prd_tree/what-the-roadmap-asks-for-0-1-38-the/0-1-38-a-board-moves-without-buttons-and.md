---
id: "51ba0f30-da25-4af0-91d2-83609a184a1a"
level: "task"
title: "0.1.38 · A board moves without buttons, and the shipped lenses take search, filter and column options"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
completedAt: "2026-10-19T06:30:00.000Z"
endedAt: "2026-10-19T06:30:00.000Z"
acceptanceCriteria:
  - "a card on a columns lens shows no Move… button by default; its menu gains Move to › with the columns this seat may move it to (withheld struck through with the reason)"
  - "keyboard drag on a focused card: Space picks up, arrows move between and within columns, Space drops, Escape puts back, each step announced in a live region; the card stays one tab stop"
  - "add-lens and the TS lens take options { search, filters, move, collapsed, cap, hidden }; search and filter narrow the cards and drag/keyboard/menu still move a narrowed card; a board over ~20 cards shows search unasked"
  - "tests fail first; the axe run and the screen-reader walk cover a move done by pointer, keyboard and menu"
description: "Roadmap f-board-move-without-buttons and f-lens-search-filter (from r-lens-search-filter), both from Nick 2026-10-19: a Move… button under every card doubles the board's height; the Recon app's Actions board can't be searched without a hand-drawn view that can't drag."
lastModified: "2026-10-19T06:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "On feat/boards-and-lens-options: a card on a columns lens has no Move… button unless the board says move: true; it is dragged, carried by the keyboard (Space, arrows, Space, Escape, each step in a live region) or moved from its menu's Move to › (columnChoices: withheld columns struck with the reason); add-lens and the declared and TS lens take search, filters, move, collapsed, cap and hidden; Find stands unasked past 20 cards; calendar and coverage take search and filters."
---

## Notes

- The menu's Move to › is a section the drawn board registers (`holdBoard`, `useBoardMoveSection` on the pages menu, the Shell and the embed's scene) and draws itself, so the up-front page carries only the registry: the lens chunk carries `columnChoices` and the row.
- `declaredLenses` only keeps what a board can honor (it is up front on a hosted page); `checkDeclaredLenses` says what it left out as `lens-option`, and `add-lens` refuses it outright.
- Up/Down while carrying moves the card's place in the target column as said; the column's order after the drop is still the board's sort.
- The choose boxes stay one shared stop for the whole board (`choosing.ts`); the card itself is one stop with `aria-describedby` saying how it moves.
- Harnesses: a11y gains a board screen moved by keyboard, menu and drag with axe at each step; screen-reader's columns stop walks all three; declared's keyboard claim is now `aCardCarriedByTheKeyboardIsTheActAndUndoPutsItBack`.
