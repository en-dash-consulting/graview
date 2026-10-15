---
"@graview/primitives": patch
---

A row group lays any blocks side by side. `{"group": [...], "direction": "row"}` put four figures in a row, but four toned lines of text, or two column groups of meters, each took the whole width and stacked, since in a wrapping row a paragraph's natural width is the whole line. Every block in a row group takes a share of the line now (a figure a narrower one, a badge only its own width, a headline or a divider the whole line) and the row wraps on a phone before anything is squeezed. `pnpm verify declared` measures it at a desk and a phone.

Compatibility: no surface changes.
