---
"@graview/guest": patch
"@graview/pages": patch
"@graview/skills": patch
---
A view that draws its own heading is not titled twice. Book Manuscript's mind map, on Graview Cloud at 390 pixels: its place said "Mind map", "1 purpose" and "All purposes as a list", and then the view said "Mind map" again as its own heading — a quarter of a phone's screen before the view (Roadmap f-place-header-repeats-view-title). A worker view's manifest may now say `heading: "own"`: its place on Pages keeps its title for a screen reader and the keyboard (`PageTitle` takes `unseen`), draws neither it nor the count, and the way to the kind's list stays. A manifest that says it on a view that is not a place, or says anything but `"own"`, is refused with why. The graview-pages skill says so. `pnpm verify address` asks, at 390 and 1440, that a custom page view's heading is said once while any other place keeps its title and count.

Compatibility: ops and primitives — unchanged. Snapshot and log formats — unchanged. The wire — unchanged. The declaration and check finding codes, derived tool names and input schemas — unchanged. The JavaScript API — additive: `WorkerViewManifest.heading` (`"own"`), and `PageTitle`'s `unseen`. What Graview Cloud does: takes this build; lets a view's manifest carry `heading: "own"` through propose_view and the views guide, and a view that draws its own heading says it.
