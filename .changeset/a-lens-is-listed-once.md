---
"@graview/core": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/guest": patch
---

A lens is listed once, however many kinds it draws. The program's scene bar read "The whole thing · What the talks are about · The timetable · The timetable · A dozen workshops": its one calendar over talks and workshops was registered on each kind, so that either district goes in to it, and every list of places took each registration for a picture of its own. A place now says when it is one picture over several kinds (`Place.over`, given by `ViewMeta.over`, which `registerDeclaredLenses` sets from the lens's bindings), and every list reads it through `onePerPicture`: the scene's bar and its tabs, the Pages bar and its More, the gallery and the pictures' page, Find and `search_graph`, the seat's places, `placesOf` and `placesFrom`, `graview describe`, and the slugs a guest view may link to. A district of either kind still goes in to it, the tab is pressed from either, and choosing it keeps the district in focus when it is one of its kinds. Its page is at `/places/<as>` alone and draws every kind it is over, with each kind's list beside it. Two different lenses that share a title on different kinds are another matter: `graview check` warns `lens-title-repeated`, and the bars and the gallery say whose — "The timetable · talks" (`placeLabel`).

Compatibility: `placesOf` and `placesFrom` list a picture over several kinds once, under the first of its kinds in the arrangement's order, with a new optional `over` naming every kind it is over; its `address` is `/places/<as>` and its `stop` `#view=<as>`, where before each kind had an entry at `/places/<as>?of=<plural>` (those addresses still open the picture). `describe_place` takes the one slug as before. A search's place hit for such a picture comes once. `Place`, `ViewMeta` and `ViewRegistration` gain an optional `over`; `onePerPicture`, `samePicture` and `placeLabel` are new exports of `@graview/core`, and `sharesItsName` no longer counts a picture's own other kinds. Check gains the warning `lens-title-repeated`. Stored formats, the document format and derived tool names and input schemas are unchanged.

The embed's budgets are raised by what this adds (`scripts/budget-raises/a-lens-is-listed-once-*.json`): the pages face alone 617 / 260 bytes, every face 1,325 / 529, the embed with the studio handed in 1,312 / 529, and the guest host on the open kit 77 / 43, minified / gzipped. A hosted page's first load holds to its budget unraised.
