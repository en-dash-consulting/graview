---
"@graview/primitives": patch
"@graview/skills": patch
---

Two counts that had gone stale stop being counts. `@graview/primitives` described itself as "the three lenses" while it shipped six (a timeline, a calendar, a coverage matrix, a board, a status board in columns and a plan), and the `graview-new-app` skill opened with "Graview ships as eleven packages" when there are fourteen. graview.dev writes its docs pages from both, so it said the same. The description now says "the lenses" and the skill "packages that share one version"; graview.dev counts them out of the tree, and a test holds every count it prints to it.

Compatibility: nothing a host holds changes. Only the `description` in `@graview/primitives`' `package.json` and the opening sentence of `graview-new-app` moved.
