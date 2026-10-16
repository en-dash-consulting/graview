---
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

Pages honors the app's Ask box setting. An embed mounted with `seat: "hidden"` drew no ask field on the scene and one on every page anyway: the routed face drew its own without reading the setting. `PageContext` takes `ask` (`"field"` or `"hidden"`), the same setting the Shell's `ask` reads, and the embed hands its `seat` to both faces; `handle.setAskField(start)` changes it on whichever face is open, on a phone and a desk alike, without mounting again.

Compatibility: no surface changes; `PageContext` takes an optional `ask` and `EmbedHandle` gains `setAskField`.
