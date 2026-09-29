---
"@graview/layout": patch
"@graview/react": patch
"@graview/primitives": patch
---

A crowded band is laid out by relation. Past what fits as chips, a band row is as tall as a group card's two lines, the gutter between rows holds a caption, and each relation starts its own row unless all of it fits the rest of the current one — so a caption never sits on the cards of the row above, and a group card is never cut to its name. `packRuns` and `bandCaps` (exported) plan the rows in arithmetic, and each relation is drawn within what the rows give it. A band card says its name and which way it opens on one line, and its count and first members on the next, "1 song" rather than "1 songs"; a record standing in a crowded band is drawn as a chip (`compact` on the layout node) rather than a summary cut to a sliver; a chip is never wider than what holds it. A grouping in which one group holds three quarters of the members is not offered. The month cells of a calendar are as tall as what is in them, so a month with three releases no longer spills over the month below, and a coverage matrix draws at most 40 rows by 24 columns.
