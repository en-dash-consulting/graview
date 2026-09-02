---
"@graview/react": patch
"@graview/primitives": patch
---

The lines land. Selection ties used to aim centre-to-centre whatever the
geometry: two drawings stacked in one column got a vertical straight
THROUGH every row between them (whose 14px hit corridor then stole those
rows' clicks), a tie between adjacent rows was silently dropped as too
short, and the single-smallest-element anchor rule tied a 3.2-row dot to
a 5.2-row label — or to a chip in the activity rail. Routing is now a
pure, tested decision (`tieRoute`): stacked drawings stitch along their
common right edge in the gutter, row-mates stitch over the top, and only
clear air takes the direct arc. Anchors pick the CLOSEST pair among all
of a node's drawings, chrome (inspector, activity rail, chat panel) is
declared off-stage and never anchors a line, and a tie whose far end is
only a stand-in — the kind's district, when nothing draws the node itself
— recedes to a whisper and takes no pointer instead of crossing the scene
at full strength five lines at a time.
