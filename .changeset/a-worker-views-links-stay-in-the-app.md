---
"@graview/guest": patch
"@graview/react": patch
"@graview/pages": patch
"@graview/core": patch
---

A worker view's links stay in the app (FR-93). The kit's `gv-link` could go to any `https:` address a host allowed, and a view written by a chat should be able to send the reader to a record or a place of the app it is drawn in, and nowhere else. The open kit already draws no `href`, so a view's `<a href="https://…">` is text. A view now writes `<a data-record="offer:coaching">` or `<a data-place="the-packages">`, and the host makes that a link: focusable, with the role of a link, and followed by the host when the viewer presses it or presses Enter on it. It goes only to a record the viewer may see or a place the app has. `graview.navigate("offer:coaching")` and `graview.navigate({ place: "the-packages" })` from the view's code are held to the same, and the guest-view protocol gains `navigate` with a `place`. A view's props list the app's named places as `places`, with each one's slug, title and kind, and `mountWorkerView` takes `places` and an `onNavigate` that hears `{ record }` or `{ place }`. A followed link is the view's region's alone: the face around it does not also take it for a press on the card. A press bound to an act is the host's alone in the same way.

Going somewhere means what the face says it means. `@graview/react` gains `useGoTo` and `GoToContext`. On the Graview face, going to a record focuses and chooses it, and going to a place draws it. The routed face provides its own: a record's page, and a place at `/places/<slug>`. `workerView` and `workerHome` use it, so a worker view's links work on both faces with nothing more from the app. The kit's `gv-link` keeps `links.origins`: it is the kit's one deliberate way out, to the origins a host lists, and an open-kit view has no such way.

A unit test draws a view's links into a shadow root and follows them by a press and by Enter. A link to a record Lin may not see, a place the app does not have, an address, and the same asked from code each go nowhere, and the last three are counted dropped. `guest-sandbox --transport=place` adds a second worker view, "What we heard", and makes the package lens's offers links. On the pages face, an offer's link goes to that offer's page, and "See the packages", followed with Enter, goes to the package lens. The view's `<a href="https://…">` is drawn as text with no href and no role. On the Graview face the same link to the place draws it, and an offer's link focuses and chooses the offer. All seventeen claims hold in Chromium, WebKit and Firefox.

Compatibility: the wire — additive: `navigate` may carry a `place` in place of `to`, and `GuestProps` gains an optional `places`. Ops, stored formats, check codes and tool schemas are unchanged.
