---
id: "2a17e710-33a9-45bd-9bb3-04e47f172aa0"
type: "capability"
title: "A status board: a shipped columns lens over a choice field (FR-97)"
slug: "a-status-board-a-shipped-columns-lens"
statement: "A Graview app can declare a status board, a shipped columns lens that draws a choice field's values as columns of record cards and offers moves between them."
criteria: [{"id":"c1","text":"When an app declares bindings { <kind>: { column: \"<choice field>\" } }, the columns lens shall draw columns in the declared choice order of that field."},{"id":"c2","text":"The columns lens shall draw each record in a column by its card."},{"id":"c3","text":"The columns lens shall offer a move only where a permitted act sets the bound choice field."},{"id":"c4","text":"The shipped lens names, the edit ops and describePlace shall include the columns lens."},{"id":"c5","text":"When a document declares columns on a status field, the app shall draw the status board on both faces."},{"id":"c6","text":"When a person moves a card, the app shall run the act as the viewer, and the move shall be undoable."},{"id":"c7","text":"If a viewer lacks the act that sets the status field, the columns lens shall show that viewer no move."},{"id":"c8","text":"The columns lens shall apply sight to its cards and counts."}]
tags:
  - "graview-cloud"
  - "FR-97"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
priority: "high"
---

9 of Cloud's 12 templates would bind one; today they declare only coverage and calendar.
