---
"@graview/primitives": patch
"@graview/core": patch
---

`Begin` takes a `frame` around its own door and nothing else. The scaffolded Home wrapped `Begin` in a `PageMain` with the derived home as its `whenFull`, so once the graph had something in it the derived home — a whole page, with its own landmark — rendered inside a second `main`, and its gallery inside a 760-pixel reading column, one card wide at a desk. The frame is applied to the door alone; what comes when the graph is full is returned exactly as it was given. `graview create` writes the Home that way now.
