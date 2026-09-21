---
"@graview/layout": patch
"@graview/primitives": patch
"@graview/react": patch
---

The ground is the city's own grid, and a billboard sinks into its village. The lattice was four repeating gradients phased from the middle of the box and seamed at its edge, so its lines never sat where the city's cells were; it is drawn as tiles now, one cell by half a cell with both diagonals, pinned where cell (0,0) meets the canvas, so every plot corner is a lattice vertex at every zoom. The tween carries the city with it: between two cities the cell and origin lerp, so plots, roads and lattice grow and slide with the cards on them; rising, the lattice arrives with the destination; descending, the ground stays while it fades. And switching lenses across kinds no longer leaves the old picture standing at full size under the new one for the length of the tween — a leaving billboard had no stand-in, since a village's members are ground, not nodes — it shrinks into its kind's signpost and board, and the next rises out of its own.
