---
"@graview/primitives": patch
---

Two more selects keep their floor in WebKit: the bar's compact Places picker and the calendar's Range picker on a phone. WebKit draws a native select at its own height and ignores `min-height`, so they measured 22 and 21 pixels tall in Safari; the native look is off and a chevron is drawn in the text's colour, as the arrange bar and the places menu already do.
