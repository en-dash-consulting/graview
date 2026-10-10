---
"@graview/layout": patch
"@graview/primitives": patch
---

The framework's own markup passes axe. Graview Cloud's accessibility pass runs axe-core (WCAG 2.0, 2.1 and 2.2 A and AA, and best practice) over every app it hosts, at a desk and a phone, light and dark, and from 0.1.18 on it found 48 nodes inside `#graview-app` on every release and tolerated them as the framework's. All 48 were one rule, `target-size`: the names of a district's showings on its signpost, each a press, were 24 pixels tall in the layout and drawn on the scene at their plane's 0.9, so 21.6 on the screen and 23.8 apart, under the 24 WCAG 2.2 asks of a target (2.5.8). A showing's name is never under 27 pixels now, a fingertip as drawn, and a one-line name sits in the middle of its rule rather than at the top of it; the room under a signpost is sized from the same floor (`MARQUEE_NAME_FLOOR` in `@graview/layout/view`), so nothing is laid over the district below. A new harness, `pnpm verify a11y`, runs Cloud's pass on Cloud's two shapes of app mounted as Cloud mounts them and on every example on both faces, and holds it at nothing. The hosted page grows by 24 bytes up front.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged. Changed: a showing's name on the scene is at least 27 pixels tall where it was 24, and `marqueeHeightFor` takes 3 more pixels a one-line name. What Graview Cloud changes: nothing; its pass finds no framework nodes once it takes this release, so it can stop tolerating them.
