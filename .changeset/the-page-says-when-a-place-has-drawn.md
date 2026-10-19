---
"@graview/embed": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/guest": patch
"@graview/core": patch
"@graview/ship": patch
---

The page says when a place has drawn and settled (FR-188). A host picturing a place headless waited on a guess — its opening frame gone, the network quiet, then 600 ms — and a font, an image or a worker view that came later than that was pictured half drawn. Now once the place the reader is on has drawn and settled — its face here, every part drawn on it arrived or said it did not, the fonts and images loaded, each worker view drawn or stopped (what stands in its place drawn), and nothing moving for 200 ms — the embed's root wears `data-graview-drawn`, its value the place's path, and `mount`'s `onDrawn(place)` is told the place as `where()` says it (`EmbedWhere`: face, path, stop). A move to another page, another stop on the scene or another face takes the attribute off in the commit that moves, and the next place puts it back as it settles; a place that never stops moving is said drawn after ten seconds all the same. `DRAWN_ATTRIBUTE` names it on `@graview/embed`, and `graview shots` waits for it before each picture where it waited 0.7 s, or 1.8 s on the scene. A worker view's region says `data-worker-view-drawn` once it has drawn what it was last shown with no picture still being fetched for it; `partsArriving()` on `@graview/react` counts the parts drawn and still on their way, and `partArriving(load)` counts a loader of one's own. `onDrawn` was told the face once it was on the page (FR-57); that is `onFaceDrawn` on `<Embed>` now, and `handle.drawn()` still waits for it. A hosted page carries 2.3 KB more up front for it (the compiled page too), and their budgets are raised by that, and the pages face, the embed, every face and the open kit's host by what they measured. `capabilities().shipped` gains FR-188.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` lists FR-188. `mount`'s `onDrawn` is handed the place (`EmbedWhere`) where it was handed the face, and is called once the place settles rather than when the face is first committed; a React host that wanted the old call passes `onFaceDrawn` to `<Embed>`. What Graview Cloud does: in `pictures.ts`, wait for `#graview-app [data-graview-drawn]` (or its value, the address pictured) in place of the opening's absence, network idle and the 600 ms settle.
