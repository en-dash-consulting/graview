---
"@graview/react": patch
"@graview/core": patch
---

A right-click anywhere on the scene opens Graview's menu, never the browser's (FR-228), Roadmap f-scene-right-click-always-ours. Only a card answered the gesture: on empty ground nothing opened and the browser's own menu did, on a desk and on a phone, which is what Graview Public saw. The lead — `PointerRouter.route` returning before `preventDefault()` — was not it: the router serves the capture path alone, and the DOM path's ground simply had no handler. The ground now opens the scene's menu at the pointer, about what is chosen or about nothing, as the routed face's ground does; the browser keeps its own menu where it means something — Shift held, a text field, text somebody selected — and a card keeps its own answer. A finger resting half a second on the ground or on a card opens the same menu on a phone, where there is no right button, and the press that opened it chooses nothing. `pnpm verify menu` holds it at a desk and at a phone's width (`sceneRightClickIsAlwaysOurs_desk`, `_phone`): the ground's and a card's right-click open ours with the browser's prevented, Shift and the Find box keep the browser's, and a resting finger opens it on the ground and about the card. FR-228 is said as shipped.

Compatibility: ops and primitives, stored formats, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The wire: `capabilities().shipped` gains FR-228. What Graview Cloud does: nothing.
