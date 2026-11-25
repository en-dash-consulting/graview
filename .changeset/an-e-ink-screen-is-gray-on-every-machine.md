---
"@graview/pages": patch
---

An e-ink screen is gray whatever machine draws it. A browser on Linux smooths type in color, and no font property turns that off there, so a host that photographed a device's screen on a Linux server sent the panel colored edges on every letter; on a Mac the same screen was gray. `renderScreen` (`@graview/pages/device`) now draws the whole screen through a grayscale filter, so its type and pictures reach the picture gray in every browser. Held by the device harness on GitHub's Linux runners (`everyPixelDrawnIsGray`) and a unit test of pages.

Compatibility: none of the surfaces change: a screen's content, tap regions, `found` and paging are as before. A screen's sheet gains one declaration, so each `renderId` is new once, so a panel is drawn again the first time it asks, and an act pressed on a screen drawn before is not run but answered with the screen drawn again, as whenever an app changed since; its other presses work as before.
