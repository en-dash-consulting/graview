---
"@graview/pages": patch
"@graview/core": patch
"@graview/skills": patch
---

The pages face lands on a gallery. The derived home read as a readme: the brand's name repeated under the masthead, a sentence of counts, the relations in full, a section per kind with its description and four members — and the app's own pictures as two 288-pixel cards a third of the way down a 760-pixel column, the smallest thing on the page. Now the standing is the headline ("2 gardeners, 3 plots and 1 planting.", or "Nothing here yet." and which act begins it) and the pictures come next, large and live: every titled lens as a card the width of half a desk or a whole phone, drawn by the lens itself at a scale measured from the card, inert, captioned with its name and how much it is over. The kinds follow as one row of counts, the relations as one line that opens `/map`, and Recently stays short at the foot.

Every kind is a picture by default. `registerDefaultViews` titles nothing, so a new app had no places and no pictures on its pages at all. A live kind with no titled lens now gets a card of its own — a group view the app wrote is drawn as it is; the framework's own is replaced by a contact sheet of the members at summary fidelity, the same card the scene stands in the district — titled by its plural and opening its list. Titling a lens replaces the kind's card rather than adding to it. A picture with nothing in it says so and names the act that would begin it, rather than showing a blank frame. Given no view registry the face still lands on the gallery, each kind a card of its members' names.

The shell is one row — the pictures (home), the kinds, Map, Problems — and scrolls sideways on a phone rather than wrapping to three rows; the shell and the gallery take a 1160px column while the pages that are read keep their 760. A picture's page carries its sibling pictures as a strip, and `/places` is the same gallery at its own address. `Gallery`, `GalleryCard` and `galleryOf` are exported for a design that wants the cards on a page of its own.

`graview create` hands `PagesApp` the app's views and settings in the `main.tsx` it writes, so a new project's pages face has its pictures, its map and its assistant without anyone editing the file. The `graview-pages` skill says what now comes for free; `verify-pages` measures the gallery on the framework's default face — two across at a desk, one on a phone, every frame with something drawn in it, the nav one row — rather than asserting it.
