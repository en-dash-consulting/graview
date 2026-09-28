---
"@graview/core": patch
"@graview/skills": patch
---

The checker, `describe` and the docs know about arrangement. A lens declaration may say `arrangedBy` in the arrangement grammar; `graview check` warns `order-role-unknown` when `fieldRoles.order` names a field the kind lacks and notes `lens-arrangement-unknown` when a lens opens arranged by something none of its bound kinds offers. `graview describe` gains "What can be arranged": every kind's sorts, filters and groups in the declaration's words, and how each lens opens. `llms.txt` says the grammar and, per kind, what it is arranged by, so an agent that cannot see the row can still write the stop. The `graview-lens` skill gains the step — take an arrangement, and say what your picture has no place for — and `graview-pages` says the shared words the list page now speaks.
