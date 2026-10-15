---
"@graview/primitives": patch
---

A list drawn as rows gives each record the list's width and its whole name. `{ "list": "all('finding')", "as": "row" }` over a kind with no row of its own drew each record as the scene's chip, about 240 pixels wide with its name cut at about thirty characters, leaving a page 1440 wide mostly empty. The chip's cap is right in a band slot of the scene and wrong in a list; each record is a line of the list now, its name whole and wrapping where it must. A kind that declares its own row still draws with it.

Compatibility: no surface changes.
