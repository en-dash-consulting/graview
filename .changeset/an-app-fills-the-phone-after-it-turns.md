---
"@graview/embed": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/react": patch
"@graview/core": patch
---

An app fills the phone after it turns (FR-165). The embed took the height it was mounted with once, the whole-page Shell was `100vh`, the pages' seat stood in a fixed `100dvh`, and the scene passed over a box reported as nothing; on a phone turned to landscape and back, the app was drawn in the top half of the screen and stayed so, on both faces. `mount(element, { height: "viewport" })` now measures the screen itself: `innerHeight`, read again on `resize`, `orientationchange` and the visual viewport's `resize`, and once more a beat later for the phones that report a turn late. A height in viewport units — `100dvh`, `calc(100svh - 48px)`, the fallback inside a `var()` — is measured the same way, each `vh`, `dvh`, `svh` and `lvh` read as a hundredth of that figure. The Shell's height and the pages' seat follow the same figure (`useViewportHeight`, from `@graview/primitives`, `/frame` and `/pages`), and the scene reads its box again on every `resize`, so a box that comes back from nothing is followed. The on-screen keyboard does not shrink the app: the figure is the layout viewport's, which the keyboard and a pinch leave alone, so a lens is not laid out again for half a screen while somebody types; the browser scrolls the field into view. `capabilities().shipped` gains FR-165.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. `mount`'s `height` takes `"viewport"`, and a viewport unit in it is now measured rather than left to the browser.
