---
"@graview/guest": patch
"@graview/pages": patch
"@graview/react": patch
"@graview/skills": patch
---

A worker view can span the whole window at every width. `bleed: true` takes the page's gutter back on a phone, and at a desk or a tablet the view stayed in the page's column, so a full-bleed editorial home read as a card boxed in 1,120 pixels. A manifest that says `bleed: "full"` now draws its view across the page's whole width, less the safe areas, on a desk and a tablet as on a phone: the home's, a record's under its heading, a kind's list page drawn by its view, and a place's, frame and all. Where the page opens on the view — the home, and a place whose view says `heading: "own"` — its first band starts right under the bar, with no top gutter, at every width; the app's line over a home's view is said to a screen reader only, so a view that wants it on the page draws it. The page says its own width as a container (`data-graview-page-spans`, `container-type: inline-size`) and the view's slot reaches `calc(50% - 50cqw)` either side, so the width is the face's — the window's on its own, the element's in an embed — never `100vw`, which counts a desk's scrollbar. A view that did not draw keeps the column and its spacing, as it keeps the gutter. `bleed: true` means what it meant.

`checkManifest` takes `true`, `"full"` or nothing, and refuses anything else by saying so: `The view's bleed is "wide": it is true, "full", or left out.` `markBleeds` takes how (`true` or `"full"`), `bleeds` is true of both, and `bleedsFull` says the second. The `graview-view-drawing` skill says it.

The unit test `a view that bleeds full spans the window at every width` (guest) holds it, and verify-address's new `aViewThatBleedsFullSpansTheWindowAtEveryWidth` and `aViewThatBleedsFullStartsFlushUnderTheBar` measure the home's, a record's and a place's view against the page and the window at 390, 1024 and 1440, and its top against the bar's bottom. The pages face grows by 1,250 B (367 B gzipped), every face by 1,345 B (478 B), the embed with the studio handed in by 1,265 B (384 B) and the guest host registering a worker view by 84 B (26 B), under raises of those budgets (`scripts/budget-raises/a-view-that-bleeds-full-*.json`).

Compatibility: the declaration — a worker view's manifest takes `bleed: "full"`; every manifest that passed still passes. The JavaScript API — `@graview/react` (and `/provider`) exports `bleedsFull`, and `markBleeds` takes an optional second argument. The look — unchanged for every view that does not say `"full"`; a page holding one that does is wrapped in a `data-graview-page-spans` box, its slot is `data-graview-bleed="full"`, and the phone-only rule now names `[data-graview-bleed=""]`. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. Check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: nothing to change; a view whose manifest says `bleed: "full"` spans the window once it is on this version.
