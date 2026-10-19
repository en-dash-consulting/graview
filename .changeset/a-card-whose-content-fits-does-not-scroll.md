---
"@graview/primitives": patch
---

A card whose content fits does not scroll. graview.dev's week picture filled its 336.4px scroller exactly, the browser rounded that to 337 against 336 and let it scroll by one pixel, and axe found a scroll region no keyboard could reach (`scrollable-region-focusable` at 414px, in both schemes). A panel's scroller is now held still while what it holds fits, by the same measure that makes an overflowing one a named tab stop.

Compatibility: no surface changes.
