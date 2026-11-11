---
"@graview/guest": patch
"@graview/skills": patch
---

A view's pictures load lazily and at the size each use needs (Roadmap f-view-pictures-load-lazily-and-small). A home that drew sixty record photos had every one loaded at once, since an `<img>` with `loading` was refused ("<img> does not take loading"), and each came at the width of its hero even where it was drawn as a chip. An `<img>` in a worker view now takes `loading` (`"lazy"` or `"eager"`) and `fetchpriority` (`"high"`, `"low"` or `"auto"`); any other value is not drawn, and the host says the ones it takes: `Not drawn: the value of loading is not one the open kit takes. An <img> loads "lazy" or "eager".`

A view may ask for two sizes: `pictures: { width: 1200, thumb: 240 }`. Each picture handed an address then comes with `thumb` beside `src` — a second address the host made from the same bytes at the thumb's width — so a chip draws `thumb` and a hero `src`. Both are reckoned against the view's picture budget, each at the width it is made at, so a view that asks for thumbs is handed as many pictures as fit both; where a picture is no wider than the thumb, `thumb` is `src` and is reckoned once. A headless run hands the stand-in for both. It is the same path for a frame (`pictures` on its host's options), and `records` and `most` work beside it. `checkManifest` refuses a thumb that is not a whole number of pixels from 16 to 4096 narrower than the width: `The view's pictures thumb is a whole number of pixels from 16 to 4096, narrower than its width (1,200 by default): the size it draws a picture small at (view-pictures-thumb).` As with `records` and `most`, a string or a list under `thumb` still names a kind called `thumb` and its fields. The `graview-view-drawing` and `graview-worker-view` skills say both.

The unit test `a view's pictures load lazily and at the size each use needs` (guest) holds it.

Compatibility: the declaration and check finding codes — a worker view's manifest takes `pictures.thumb`, refused with the new finding code `view-pictures-thumb`; every manifest that passed still passes. The wire — a `GuestFile` may carry `thumb`, only for a guest that asked for it. Ops and primitives — unchanged. Stored formats — unchanged. Derived tool names and input schemas — unchanged.
