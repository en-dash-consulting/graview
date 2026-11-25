---
"@graview/embed": patch
"@graview/pages": patch
"@graview/react": patch
---

The opening screen lifts when the page has drawn, not when the one face arrives. With `sceneUnderPages` the page and its view were painted within a second and `data-graview-drawn`, which waits for the one face under the page, only once that came; the opening screen stood over a whole page meanwhile, for seconds on a slow network. The embed's root now also says `data-graview-painted` (`PAINTED_ATTRIBUTE` on `@graview/embed` and `@graview/embed/pages`): everything a place waits for before it is said drawn — its views, frame guests, fonts and images, and nothing moving — except the parts that stand under the page, and never for time alone. `@graview/pages/splash` lifts on it. Over a page that holds a frame the screen waits for the face where the browser cannot move a frame without loading it again. A page opened at the city waits for the face and its city, and is not held up by the city's own frame loop, which keeps `data-graview-drawn` waiting out its ten seconds. The screen also lifted on an alert with nothing said in it, and the embed's own live region for notices is one from its first commit, so over an embed it could lift onto an empty page; it lifts now only on an alert that says something. `lazyPart` takes `{ under: true }`, for a part the page is whole without.

Compatibility: additive. `data-graview-drawn` and `onDrawn` mean what they meant, and a picture still waits for them; an opening screen still lifts on `data-graview-drawn` alone, so it lifts over a page built before this one. A host that puts an empty `role="alert"` on the page to take the screen away says words in it, or one of the marks.
