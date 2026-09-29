---
"@graview/layout": patch
"@graview/react": patch
---

The scene holds sixty frames a second on a real catalogue. Nothing measures while it moves: lines and their captions are drawn once a transition settles, and pick targets are marked when the DOM changes rather than every render. A card held by the hand moves alone — `holdLayout`, exported, moves one node and re-aims the lines that touch it instead of laying the stop out again. The focus's kind tag is placed when its panel resizes, not by reading two bounding boxes after every render, which forced a layout on every frame of a transition. Invariants are evaluated once per change however many views ask, where each picture evaluated the whole graph as it mounted. `connectorsFor` and `interpolate` are linear, a host's signature keys its group by count and hash rather than joining every member id, and a line's anchors are read from one index of the host. A host's blur is its nearest plane's, so it changes once in a transition rather than every frame. Over Tech N9ne's catalogue the hub lands in one frame of about 57 ms and every frame after it, dragging, wheeling, moving a card, selecting and typing, fits sixty.
