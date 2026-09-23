---
"@graview/primitives": patch
---

A coverage grid's column names stand on their columns. The heads and the cells are the same box now — border and padding inside the width on both — where a border outside the cells and padding outside the row names had them drift ten pixels plus one per column. And a column scrolled under the sticky names takes its name with it: its label no longer hangs over the columns still in view, which made a grid scrolled four columns along read as every label four columns out.
