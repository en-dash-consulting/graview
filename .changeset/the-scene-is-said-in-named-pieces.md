---
"@graview/react": patch
---

The scene is said in named pieces. `Scene` was one function of 108 callees; what it does is now a hook or a part each named for what it is — the layout's options for the box it has (`useLayoutOptions`, in `scene-options.ts`), the hand's zoom, the billboard's height, the camera, the world laid out at rest and then moved, the steering hand, the first picture as a cut, the scene lending `whereIs`, the pointer reported only while somebody listens, the renderer handed the frame, what just happened resolved onto what is drawn, a card's gestures, the billboard's title bar (`ScreenGrip`) and the zoom in the ground's corner (`ZoomControls`). Nothing a person or a harness sees moves: the same elements, attributes and test ids, in the same order, and the scene face fetched before it draws is 29 bytes smaller (898 008 where it was 898 037).

Compatibility: ops, stored formats, the wire, the declaration and check finding codes, and tool names and input schemas are unchanged; the hosted page's first load is the same to the byte (589 757, and 547 456 handed a compiled app).
