---
"@graview/embed": patch
---

A page a person made its own view takes what the host says of every view. Graview Cloud says `ownFaces: false` on each worker view it registers, but a built-in page made its own view ("Make this page its own view") is registered by the embed itself, from what `keptViews.forked` lists, with the fork's manifest and code alone, so a forked view drew its own `@font-face` where the host's own views could not. `mount` (the whole embed and `@graview/embed/pages` alike) now takes `forkedViews`, the parts of a worker view's definition a host says for every view (`ForkedViewDefaults`: `ownFaces`, the `fonts`, `images` and `links` origins, `limits`, `onProblem` and the rest), and each forked view is registered with them. With `forkedViews: { ownFaces: false }`, a forked view's own face is refused and said as `own-face-refused`. Unsaid, a forked view is registered as before. Held by a unit test of the embed (`a-forked-view-takes-what-the-host-says-of-every-view`).

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The JavaScript API is additive (`forkedViews`, `ForkedViewDefaults`). What Graview Cloud does: pass `forkedViews` with what it passes on each worker view's definition (`ownFaces: false`, its origins, its `onProblem`).
