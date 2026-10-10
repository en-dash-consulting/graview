---
"@graview/layout": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/embed": patch
"@graview/core": patch
---

The overview's address alone is the overview (FR-154). Graview Cloud: the framework wrote the overview at altitude as `/places/overview#overview=1` and read the altitude from the fragment alone. A fragment never reaches a server, so the same address back through any hop — the sign-in door, a stored link, a bookmark, or typed — came back as `/places/overview` and opened the overview descended on nothing: an empty scene whose control said "Up". Now `/places/overview` with no fragment, or with one that says nothing (`#`), opens the overview at altitude, on the Graview's face, under address routing in an embed and on a hosted page, and on any page that keeps its stop in the fragment (`UrlSync`, the whole-page Shell's `syncUrl`). The framework writes the overview at altitude over nothing in particular as the bare `/places/overview`, so the address it writes means the overview by itself: the bar's switch, Back to it, and "The whole thing" among the scene's places (`data-place-path="/places/overview"`). A fragment that says where it stands is read as it says: `#focus=t1` is the scene descended on that record, and `#overview=1&focus=…` the overview over it; a link written before, `/places/overview#overview=1`, still opens the overview and is tidied to the bare address in place, with no step Back would have to undo. Arriving at an address that says something no longer writes `#` and then pushes the stop: the page adopts the address with no entry. New in `@graview/layout/view`: `overviewStop` (the stop the overview's address holds) and `overviewFragment` (the fragment it carries for a view, none at altitude over nothing). `capabilities().shipped` gains FR-154.

A host can delete its interim: Graview Cloud's `restoreOverview` in `packages/client/src/shell.ts`, which put `#overview=1` back on a bare `/places/overview` before the framework read the window, does nothing the framework does not do now.

The hosted page measures 120 bytes more up front (593 498, under its 579.7 KB) and 120 more handed a compiled app (547 895, under its 535.2 KB).

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged; `capabilities().shipped` gains FR-154. Changed: the overview at altitude is written as `/places/overview` with no fragment where it was `/places/overview#overview=1` (an embed's address bar, the scene's "The whole thing" `data-place-path`); a bare `/places/overview`, or `/places/overview#`, opens on the Graview's face at altitude, whatever face the host names, where it opened the scene descended on nothing. `where()` still reports the overview's stop as `#overview=1`.
