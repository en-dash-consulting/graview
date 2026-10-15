---
"@graview/guest": patch
"@graview/skills": patch
---

A view's places are known by their slug and by their title, and named with both when one is not there. A home view linked `data-place="songs-by-writer"`, a lens the app has, and the check of it said the place did not exist and listed the app's places as "undefined, undefined, …": its host handed the places as an app lists them (`placesOf`, each a `slug`), and the check read a guest's `as`. Either shape is read now, and a place handed with no word to go to by is passed over rather than said as "undefined". A link or `graview.navigate` names a place by its slug, by its title in any case ("Songs by writer"), or by the title's slug, and goes to its address; and one that names no place says the places there are, each by its slug and title: `Its places: "songs-by-writer" (Songs by writer), …`. The live host and a headless run judge it alike. The graview-worker-view skill says so, and the guest harness follows a link by a place's title in a browser.

Compatibility: ops, stored records and the declaration are unchanged. The guest wire is unchanged. `runWorkerViewHeadless`'s `places` takes a guest's places or an app's (`{ slug, title, kind }`), and `mountWorkerView`'s alike; a headless run's input says each place as `{ as, title }` rather than a slug alone. `guestPlacesOf`, `placeNamed` and `NamedPlace` are new beside `placesSaid`, which takes places as well as slugs, and a sentence about a place that goes nowhere names each place's title after its slug.
