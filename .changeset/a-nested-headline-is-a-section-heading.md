---
"@graview/core": patch
"@graview/primitives": patch
---

A headline inside a group is a section heading, not the page's title. The home's first headline is the page's heading, and a headline at the top of a column inside a row group was the first of its own blocks, so it was said at that level too: a home with two such columns drew two more titles at page-title size, each with the app's description repeated under it. A headline in a group or a condition is said at the level of the view's sections now (on the routed face's home, an `h3` under the page's `h2`), and the description is said once, under the real title. It is not a level more per group: a row of columns is layout, and a heading two groups in would skip levels in the page's outline.

Compatibility: no surface changes. A resolved headline inside a group or a condition reports the view's section level (`ResolvedBlock.level`) where it reported the page heading's; the declaration is unchanged.
