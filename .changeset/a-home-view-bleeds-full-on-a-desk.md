---
"@graview/guest": patch
"@graview/skills": patch
---

A home view can go full-bleed on a desk, and the manifest check says how (Roadmap f-home-view-full-bleed-on-desk). `bleed: true` takes the page's gutter back on a phone and keeps the column on a desk, so a home drawn edge to edge on a phone read as a card in the middle of a 1440-pixel window; `bleed: "full"`, which spans the page's whole width at every width, clear of the bar and the safe areas, was said only in the drawing skill. The `graview-worker-view` skill now names it beside `true`, and `graview-view-drawing` says it spans a desk too. `checkManifest` passes `"full"` on the home, on a view of one that replaces its page and on a view of many that replaces its list, and refuses any other value by saying what each does, ending with its finding code: `The view's bleed is "wide": it is true (edge to edge on a phone, the column on a desk), "full" (the page's whole width at every width, a desk's included), or left out (view-bleed).`

The unit test `a home view bleeds full on a desk` (guest) holds it; verify-address measures the span at 1440.

Compatibility: the declaration and check finding codes — a worker view's bleed refusal is worded anew and ends with the finding code `view-bleed`; every manifest that passed still passes. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. Derived tool names and input schemas — unchanged.
