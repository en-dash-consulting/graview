---
id: "0ead790b-f7bc-4dac-be5e-1fd64923894f"
type: "capability"
title: "A home view from the closed block set: headline, figure and list (FR-81)"
slug: "a-home-view-from-the-closed-block-set"
statement: "A product can declare a home view, built from the closed block set of headline, figure and list, that replaces the derived home body on both faces."
criteria: [{"id":"c1","text":"When an app declares views.home, the home view shall replace the derived home body on both faces while the shell stays."},{"id":"c2","text":"The headline block shall draw its text from a template."},{"id":"c3","text":"The figure block shall draw a value computed from an expression, shown through a formatter and a label."},{"id":"c4","text":"The list block shall select its records by expression and order them by a sort key and direction or by declared choice order, limited to a declared limit."},{"id":"c5","text":"Where a list block groups by a field, it shall show a per-choice heading for each group."},{"id":"c6","text":"When a list block selects no records, it shall show its declared empty words."},{"id":"c7","text":"The list block shall draw each record as a card or as a row, and shall link each one to its record."},{"id":"c8","text":"When a home view is made of blocks alone, both faces shall draw a front page with a headline carrying a computed count, a money figure computed across records, and a list of one chosen record drawn by its card."},{"id":"c9","text":"While the graph is empty, the home shall show the begin-here flow."}]
tags:
  - "graview-cloud"
  - "FR-81"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

VIEW_SLOTS is card, row and page; views.home is refused; the home is always derived.
