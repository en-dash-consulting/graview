---
"@graview/embed": patch
"@graview/primitives": patch
---

A Graview in somebody else's page. `@graview/embed` mounts a declared app
into any element — `mount(el, { app, seed, face, stop, principal })` and an
`Embed` component — with the scene, the Graview or the routed pages as its
face, a switcher and Standing above the picture, and nothing of the Shell.
The store lives in memory and starts from the seed; the routed face runs on
a memory router so the host's address is never touched; the brand's fonts
are fetched by the embed.

What the framework had to grow for that, and grew: `themeCss` takes a
`scope`, so the theme lands on the element rather than on `:root` and
`html, body`; the panes size against the picture's own box (`cqh`) rather
than the viewport, and the Shell's scene region is that container, so a
pane never reaches past the picture it belongs to, on a page or in an
embed the size of a paragraph.
