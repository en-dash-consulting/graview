---
"@graview/core": patch
"@graview/skills": patch
---

A view is held to 40 blocks at its top, a group or a condition counting as one, and to 120 blocks in all. The cap counted every nested block, so a home of four stat tiles (a figure and a line each), four summary lines, five meters and three lists came to 56 and was refused, though a reader sees sixteen things. What a reader scans is the top of the view, and a group is one thing on the page, so that is what the 40 counts; the ceiling of 120 in all stays because every block is worked out on every draw, and a view nobody could read should still be refused. `view-size` says which of the two was passed: "has 41 blocks at its top; a view has at most 40 there, a group or a condition counting as one", or "has 121 blocks counting the ones inside its groups and conditions; a view has at most 120 in all". `MAX_VIEW_BLOCKS_IN_ALL` is exported beside `MAX_VIEW_BLOCKS`. The `graview-pages` skill says the counts.

A hosted page's first load carries 1.0 KB more up front for the check and the document's new keys, raised in `scripts/budget-raises/blocks-lay-out-as-written-a-hosted-page.json`, and 0.4 KB more when it is handed a compiled app (`…-a-hosted-page-handed-a-compiled-app.json`).

Compatibility: the declaration and check finding codes: a view that was refused for more than 40 blocks counted inside its groups now compiles when it has at most 40 at its top and 120 in all; a view of more than 120 blocks in all, which needed more than 40 at its top before, is still refused. `view-size` keeps its code with new words. Ops, stored formats, the wire and derived tool schemas are unchanged.
