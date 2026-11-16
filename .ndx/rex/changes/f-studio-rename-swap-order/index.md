---
id: "2648aea1-7b7f-4783-9b2b-53300ed55308"
type: "change"
title: "The studio writes back a swap of names, and a cycle of them"
slug: "f-studio-rename-swap-order"
intent: "In the studio, renaming kind a to tmp, b to a and tmp to b, then studio.document(), failed with there is already a kind, because documentEdits ordered its rename edits wrong. Order the renames, through a temporary name where there is a cycle, so a swap (and a 3-cycle) writes back."
acceptanceCriteria:
  - "A swap of two kinds' names writes back through studio.document() (test: the-studio-writes-back-names-that-swap)"
  - "Three kinds turned one place round write back (test)"
  - "A chain of renames is ordered with no temporary name (test)"
  - "A swap of two fields' names on one kind writes back, each continuing its values, and a rule over one reads its new name (test)"
touches:
  - "b70163bd-9b16-46c9-a08d-3b5d571c59bb"
priority: "medium"
tags:
  - "graview"
  - "studio"
  - "hq:feature:f-studio-rename-swap-order"
source: "Graview HQ feature:f-studio-rename-swap-order"
---
