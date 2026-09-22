---
"@graview/primitives": patch
---

Nothing in the rail paints over its neighbour. The conversation sits between the acts above it and the relation key below, and a section that is handed less height than its content will paint the difference straight onto whatever comes next — which is what expanding "What the lines mean" looked like. Three things now make that impossible rather than unlikely: the rail's rows are sized by their content and packed at the top, so a row cannot be compressed below what is in it; the conversation carries a `min-content` floor of its own and one layer fewer between it and the column; and it clips, so the worst an engine that disagrees can produce is a section that scrolls inside a rail that already scrolls. The companion harness opens the key with something in hand and fails if any section overlaps the next or spills its own box.
