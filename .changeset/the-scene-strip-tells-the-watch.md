---
"@graview/core": patch
"@graview/tools": patch
"@graview/react": patch
"@graview/primitives": patch
---

The scene's strip tells a watching harness when an act's own input refuses a press there, as the pages do (carried from W-228 and W-238). The strip and the quick ask show what an act would do before they apply it, so an act offered whole whose argument its input refuses was refused in the preview — said in the strip — and the apply that tells the watch never ran: the same offer was a finding on the pages and passed every harness on the scene. `previewAffordance` takes `{ pressed: { author } }` for the preview of a press about to be applied, and then tells the watch of an input refusal (`tellTheWatchOfAPressRefusedByItsInput`, on `@graview/core`); `useApplyAffordance`'s preview and the quick ask pass it. A preview of what an act would do before anything is pressed still tells nothing, and a form a person filled wrongly is still theirs, not the surface's (the watch reads the press's origin). `pnpm verify watch` holds it with a new claim, `aPressTheStripsPreviewRefusesIsCaught`, over the workspace's own store and strip press. A hosted page carries 0.1 KB more up front for it (the compiled page too), and their budgets are raised by that; the pages face, every face and the studio handed in by what they measured.

Compatibility: ops, stored formats, the wire, the declaration and derived tool names and schemas are unchanged. New, additive: `previewAffordance`'s fourth argument `{ pressed }`, and `tellTheWatchOfAPressRefusedByItsInput` on `@graview/core`.
