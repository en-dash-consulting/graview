---
"@graview/react": patch
"@graview/primitives": patch
---

A tie points at where a thing is, not at where it was. The lines from a selection to its relations, and the captions over a raised row, were measured from the DOM during render — the render that draws a frame runs before that frame's DOM exists, so every one was measured against the frame before, and after the last frame of a navigation nothing rendered again: dashes started in the air at the edge of a card that had moved. Both are measured in a layout effect now, after the boxes are where the frame put them and before paint, and the ties measure again whenever a scroll or a resize moves something. Every anchor is cut down to what a person can see of it — a chip scrolled off the end of its roster, a row under a panel's fold, anchors nothing.

And a mark is not the thing. The fundamental mistake under every stray line was treating everything that wears an id as a place the thing is: a coverage cell wears its column's id so a press means the column, but it stands at the crossing of a row and a column — it is the edge — and a selected revenue stream fanned five dashed lines up into the cells of somebody else's ownership matrix. A lens says which of its drawings are marks (`data-graview-mark`), a tie never lands on one, and a thing drawn only as marks falls through to the district that holds it.
