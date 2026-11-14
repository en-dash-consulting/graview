---
"@graview/core": patch
"@graview/pages": patch
---

The one face's boards' posts, drawn under every board, take their place from the ladder: `LOCAL_LAYERS.beneath` (-1), beneath every box of its layer, is the rung a board's post stands on, so no surface writes a `z-index` of its own outside `packages/core/src/theme/layers.ts`.

Compatibility: the look — unchanged. The JavaScript API — added: `LOCAL_LAYERS.beneath`. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
