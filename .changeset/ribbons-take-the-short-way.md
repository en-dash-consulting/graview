---
"@graview/react": patch
"@graview/primitives": patch
---

A relation's ribbon from altitude takes the short way along the ground between its two districts. It was routed along the lattice's gutters, which in a city laid out left to right drew it as a V — up to the top of the window and back between two districts in one row, or across the whole empty ground between two far apart. Now it runs straight from the corner of one district that faces the other to the corner of the other that faces it when nothing stands between them; along the row's street, just in front of its districts, when others in the row stand between; along the column's street, beside its districts, in one column; and otherwise with one bend, where a column's street meets a row's. Ribbons that share a street lie side by side in it, each its own width apart, a bundle rather than lines drawn over each other, and every run is straight. Ribbons now follow the tilt the city is seen at, from above as from the side (`routeRibbons`, `tileOf`). The router rides in the ribbons' own chunk, fetched when the city is first drawn: the embed's every-face budget is raised by 1_640 / 661 bytes for it (scripts/budget-raises/ribbons-take-the-short-way-every-face.json), and nothing a page loads first is larger.

A district's status bar no longer cuts a narrow segment to "1…": it says a segment's count and value where both fit, its count alone where only that fits, and nothing where not even that does, and its words are on each segment's title.

Compatibility: the scene changes what it draws. `streetPoints`, `curbToCurb` and `ribbonLanes` leave `@graview/react`'s ribbon module for `routeRibbons`, `tileOf` and `crossesAny`; none was exported from a package entry.
