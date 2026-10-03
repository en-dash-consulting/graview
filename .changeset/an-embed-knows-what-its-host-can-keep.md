---
"@graview/core": patch
"@graview/embed": patch
"@graview/studio": patch
"@graview/skills": patch
---

An embed knows what its host can keep. `mount({ studio: false })` leaves the Studio place off the strip, for a hosted reader who could change a declaration that would never be saved. `mount({ studio: { onApply } })` keeps it and hands the host what the checker passed (`StudioApplied`: the app, the migration and the files), asking after no dev-server door and writing nothing itself; `StudioPlace` takes the same `onApply`, and `useStudioDoor(null)` asks nobody. `@graview/embed/pages` mounts the routed face alone, without the scene, the lenses or the studio: bundled for the browser without React it is about 730 KB minified (195 KB gzipped), where every face is about 1.05 MB (300 KB). `node scripts/inspect-pack.mjs` bundles both and fails when either passes its budget, and a linked project's Vite config aliases the new entry (FR-19).

Compatibility: additive — `EmbedOptions.studio`, `StudioPlace`'s `onApply`, `StudioApplied` and the `./pages` entry are new, and an embed without `studio` offers the Studio as before. `EmbedOptions` is now `FrameOptions` (exported) plus the scene's own options, with the same fields. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
