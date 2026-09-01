---
"@graview/primitives": patch
"@graview/tools": patch
"@graview/skills": patch
---

The DOM path is a citizen of every browser. The board no longer trusts
`height: 100%` to transfer through `aspect-ratio` — Firefox and WebKit
treated it as indefinite inside the panel's flex chain and collapsed the
pitch to its border pixels, taking every slot's hit target with it; the
width now comes from the same ResizeObserver measurement that decides when
the board turns. The local-AI rung fails fast and says why when a browser
has no WebGPU, and the chat header carries that reason instead of a shrug.
The graview-new-app skill states the supported-browsers floor.
