---
"@graview/react": patch
---

The hand on the scene is three named hooks in `scene-hand.ts` — the district under the hand (`useHeldDistrict`), the world moved as a transform while a hand is on it (`useWorldShift`), and the gestures that use them (`useSceneDrag`) — rather than a hundred and fifty lines in the middle of `Scene`. Behaviour is the same, and verify-panning's eight drags hold 55fps as before.
