---
"@graview/ship": patch
"@graview/skills": patch
---

`graview shots --places` takes a draft view's title, as it takes a kept view's (W-243, the thirteenth walk, a camera-trap survey). `graview shots app.json --view sheet.js --manifest sheet.json --places "Station sheet"` refused the title and listed "home, overview, stations" as the places there were, though the page it would photograph linked "Also as: Station sheet": the places were read from the document alone, and only the path `/places/station-sheet` reached the draft. Now a titled draft is a place of the run, by its title and its address word, listed among the places when a name is not found, and photographed among every place when none is named. `shotsOf` takes the draft's manifest as a fourth argument. The `graview-host-page` skill says so.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. `shotsOf(app, asked, faces, draft?)` takes a draft view's manifest. What Graview Cloud does: nothing more.
