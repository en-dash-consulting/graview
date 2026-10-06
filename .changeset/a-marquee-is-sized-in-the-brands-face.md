---
"@graview/layout": patch
"@graview/react": patch
"@graview/primitives": patch
---

The room under a district's signpost is sized from its place names as the brand's face draws them (FR-118). The marquee's height was estimated from the letter count at an average letter's width, so a brand whose body is a wide display face wrapped names onto lines the city had not made room for, and the column ran past its district into the one below. The scene now measures each name with `measureText` in the face it reads off its own element (an embed scopes its brand to itself), at the marquee's size and its heavier weight, again once the brand's fonts have loaded, and wraps it word by word as the browser does; the layout sizes the band from that and hands the district the same room, and never under the estimate. Where nothing can measure — Node, jsdom — the estimate is the answer, as before.

Compatibility: unchanged for stored data, ops, tool schemas and the wire. `LayoutOptions` takes an optional `nameWidth`, `marqueeHeightFor` an optional third argument (a `NameWidth`, exported from `@graview/layout` and `@graview/layout/view`), and `@graview/react` (and `@graview/react/drawing`) exports `useMarqueeRoom`, the room the scene reserved for a marquee of given names. A marquee in a wide face may come out taller than it did.
