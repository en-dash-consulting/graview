---
"@graview/layout": patch
"@graview/react": patch
---

The city grows with the reader: a district card is sized in the reader's own text, not in pixels.

The last thing that did not scale, fixed rather than named. A district card holds a name and a count, both sized in `rem` so a reader who asks for bigger words gets them — and the card itself was sized in pixels off the stage, so it never heard about the setting. At 200% every name in the city doubled inside a card that stayed exactly 230×97: a headline in a glyph.

The layout takes a `unit` now — what one `rem` is worth in pixels — and sizes its cards, its floors and the room an opened district lists its members in by it. The Scene reads it from the root element rather than from a setting's name, because the scene has no business knowing what an app called its text-size control, and the browser's own default is a size no app declares at all. It watches both: the root's `style` for the app's control, a resize for the browser's.

Cards cannot simply take the number, though — a ring is a fixed amount of ground, and cards at twice the size on the same ellipse are districts standing in each other. So the scale is the MOST the ring will use, and it gives back whatever it must to keep the ring a ring, down to the size cards have always been and never below. A reader gets bigger words everywhere and as much bigger a city as there is room for. `unit: 16` is the browser's default and the no-op: every existing caller lays out exactly as it did, which the tests assert directly.

Measured rather than asserted, end to end: the probe that started this — load the app at the browser's own size and at Largest, diff every box — now reports one box that does not grow, and it is the viewport. `audit-ui` gained a `largest` state for Things and the garden, so every count it already makes (collisions, controls under 24px, text cut mid-word, anything off-screen) is made at 200% too, where none of them had ever been made before. All clean.
