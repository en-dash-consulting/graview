---
"@graview/core": patch
---

A project `graview create` writes names an icon in its `index.html` and `embed.html` (an empty one, until the Shell draws the brand's mark). Google Chrome asks for `/favicon.ico` before any script runs, and the new project had none, so its first page load put a 404 on the console. The smoke rehearsal caught it once the nightly's GPU leg ran in Google Chrome rather than Playwright's bundled build.

Compatibility: no surface changes.
