---
"@graview/render": patch
"@graview/layout": patch
"@graview/primitives": patch
---

The districts at the bottom of the stack are readable: the kinds plane stops paying for depth in legibility.

A district's name reached the screen at ten pixels and its kind at under eight, so the bottom of the picture was a row of grey marks rather than a map of the domain. Three things were stacked on top of each other to get there.

**The plane was drawn at 78% of the room it was given.** The layout allots each district a slot and the renderer drew the card at 0.78 of it — a shrink applied *after* the reader's text size, so it was a shrink no setting could lift. The stylesheet next to it already argued the case: "Depth comes from BLUR AND FALLOFF, not from shrinking. Pushing the scale to 0.6 made the strip illegible — ten cards reading P…, REA…, S…. A map you cannot read is not a map." 0.78 was the same mistake, smaller. The planes keep a shrink — recession is still monotonic, as `frame-plan` requires — but one small enough to read as depth and no longer small enough to cost a word its legibility.

**A district's name was thirteen pixels before any of that**, and its kind ten. A name is read, not glanced at.

**And three more pixel sizes were hiding from the guard.** The test written last commit looked for a number straight after `fontSize:` and walked past `fontSize: nested ? 10.5 : 13` — which is how the district's own name stayed at thirteen pixels while everything around it doubled. It strips quoted values and looks at the whole expression now, and found two more in the reach lens and the panel.

Two knock-ons, each fixed at its cause rather than tuned away. A fan of tucked cards is spaced in layout units and drawn at the plane's scale, so the gap between two tucks is `step − scale` of a card: at 0.86 against 0.78 that was air, and against 0.9 it became six pixels of one card sitting on its neighbour's label. And the fan was allowed the parent's width *plus the gap* — but the gap is not spare room, it is what keeps one district off the next. Both were caught by `audit-ui`, not by eye.

Finally, a panel's heading wraps. Both halves of that row are sized in `rem` now, so a reader on Largest doubles them, and on a phone "The rotation · 2026–2029" reached eight pixels past the screen — caught by the calendar harness's own reader-settings check, which is exactly what it is for.
