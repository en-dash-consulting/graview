---
"@graview/core": patch
"@graview/guest": patch
"@graview/skills": patch
---

A view's lent faces load from origins of their own, not the image origins (Graview HQ f-view-font-origins-apart-from-images). A face the app lends its views by an `https:` address (`brand.views.fonts`) loaded only from an origin the host listed in `images.origins`, so a host lending faces from fonts.gstatic.com listed it there, and that list then took a view's `<img>` from it as well: one option meant two things. A worker view now takes `fonts: { origins }` of its own, on `MountWorkerViewOptions` and on a `WorkerViewDefinition` (and so on an embed's draft view), held as an image's origins are; a face on any other address is refused and said, naming `fonts.origins`. `images.origins` is for images alone and no longer admits a face, and `fonts.origins` admits no image. A face that is a file the app holds still loads where `asset` serves it, with no list. The graview-view-drawing skill and the `brand-views-font` finding's fix say `fonts.origins`.

Tests: `a-view-takes-faces-and-images-from-origins-of-their-own` (guest) loads a face from an origin in `fonts.origins`, refuses one whose origin is only in `images.origins` and says `fonts.origins`, refuses an `<img>` whose origin is only in `fonts.origins`, and draws both where the origin is in each list; `a-view-draws-in-a-face-its-app-lends-it` mounts its views with `fonts`.

Every face grows by under 0.1 KB, as does the guest host registering a worker view and drawing one on the open kit, under a raise of their budgets.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged; the `brand-views-font` finding's fix names `fonts.origins`. Derived tool names and input schemas — unchanged. A host that listed a face's origin in `images.origins` lists it in `fonts.origins` now, and drops it from `images.origins` unless its views draw images from there too.

What Graview Cloud does: pass `fonts: { origins: ["https://fonts.gstatic.com"] }` where it lends Google Fonts files, and take fonts.gstatic.com out of `images.origins`.
