---
"@graview/layout": patch
"@graview/react": patch
---

Flying closer is travel, not a cut. The cards rode the tween and the ground under them did not: the lattice, the plots and the roads were drawn from the live pan and from the destination's own cell, so choosing a picture snapped the whole ground to the new place on one frame while the buildings walked over to join it. Two things were wrong. The city frame did not record the pan its cards were laid out with, so the ground could not ride the same interpolation — it does now, and the tween lerps it. And an interrupted tween froze its origin by spreading the destination, which carried the destination's city into what the next tween starts from: every flight interpolated the ground from where it was going to where it was going. The frozen origin keeps the ground it was actually standing on, and the navigation harness fails if the cell leaps rather than eases.
