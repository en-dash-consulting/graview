---
id: "0ead790b-f7bc-4dac-be5e-1fd64923894f"
level: "feature"
title: "A home view from the closed block set: headline, figure and list (FR-81)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-81"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "views.home is a slot replacing the derived home body on both faces (the shell stays)"
  - "Blocks headline (template), figure (expression, formatter, label) and list (records by expression; sort by key and direction, or declared choice order; limit; group by field with per-choice headings; empty words; as card | row, each linked)"
  - "A data-only front page draws on both faces: a headline with a computed count, a money figure computed across records, and a list of one chosen record drawn by its card; an empty graph still gets the begin-here flow"
description: "VIEW_SLOTS is card, row and page; views.home is refused; the home is always derived."
lastModified: "2026-10-05T20:03:32.950Z"
---
