---
id: "0c41c15d-711d-4635-a043-fe75ce1f0b4a"
type: "capability"
title: "A named step is a move: an act that sets the column field to a constant offers a move to that column (FR-108)"
slug: "a-named-step-is-a-move-an-act-that"
statement: "When a record's kind has a named step that sets the column field to a constant, a board offers a move to that value's column, running the step as declared."
criteria: [{"id":"c1","text":"When an act sets the column field to a constant, columnMoves shall offer a move to that value's column for a record only where the act's allowedWhen holds for that record."},{"id":"c2","text":"When a move is made through an act that sets the column field to a constant, the board shall run the act as declared, with its side effects."},{"id":"c3","text":"Where both a named step and a free set-<field> act exist for the same move, columnMoves shall offer the named step."},{"id":"c4","text":"In the vendor template without set-status, while a vendor is researching, the board shall offer Contacted (mark-contacted), Booked (book) and Declined (decline)."},{"id":"c5","text":"In the vendor template without set-status, while a vendor is declined, the board shall offer only Contacted (reopen)."},{"id":"c6","text":"When a bug is moved to Fixed in the bug bash, the board shall stamp fixedOn."}]
tags:
  - "graview-cloud"
  - "FR-108"
  - "security"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.12)"
priority: "high"
---

Templates added an unguarded set-status act so boards could move cards, skipping each step's guard and side effects (no fixed date; Accepted without an offer).
