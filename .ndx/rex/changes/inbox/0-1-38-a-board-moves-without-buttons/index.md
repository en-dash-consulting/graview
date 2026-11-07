---
id: "51ba0f30-da25-4af0-91d2-83609a184a1a"
type: "change"
title: "0.1.38 · A board moves without buttons, and the shipped lenses take search, filter and column options"
slug: "0-1-38-a-board-moves-without-buttons"
intent: "Roadmap f-board-move-without-buttons and f-lens-search-filter (from r-lens-search-filter), both from Nick 2026-10-19: a Move… button under every card doubles the board's height; the Recon app's Actions board can't be searched without a hand-drawn view that can't drag."
acceptanceCriteria:
  - "a card on a columns lens shows no Move… button by default; its menu gains Move to › with the columns this seat may move it to (withheld struck through with the reason)"
  - "keyboard drag on a focused card: Space picks up, arrows move between and within columns, Space drops, Escape puts back, each step announced in a live region; the card stays one tab stop"
  - "add-lens and the TS lens take options { search, filters, move, collapsed, cap, hidden }; search and filter narrow the cards and drag/keyboard/menu still move a narrowed card; a board over ~20 cards shows search unasked"
  - "tests fail first; the axe run and the screen-reader walk cover a move done by pointer, keyboard and menu"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
resolution: "On feat/boards-and-lens-options: a card on a columns lens has no Move… button unless the board says move: true; it is dragged, carried by the keyboard (Space, arrows, Space, Escape, each step in a live region) or moved from its menu's Move to › (columnChoices: withheld columns struck with the reason); add-lens and the declared and TS lens take search, filters, move, collapsed, cap and hidden; Find stands unasked past 20 cards; calendar and coverage take search and filters."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A status board: a shipped columns lens over a choice field (FR-97)" (2a17e710-33a9-45bd-9bb3-04e47f172aa0).
