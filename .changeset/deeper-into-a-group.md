---
"@graview/layout": patch
"@graview/react": patch
---

Going deeper into a group card goes into the group. Double-clicking a shelf card or a district once focused the card's own id, which no layout resolves, so the scene emptied with the card's name in the URL. `withJackIn` in @graview/layout is the one reading of the gesture: a record zooms (and zooms back out), a kind card on the ground zooms into its group as a place, and a district at altitude opens in place and closes again. The scene's double-click and `useJackIn().enter` both go through it.
