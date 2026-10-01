---
"@graview/primitives": patch
---

Two changes to an arrangement before the page draws again are both kept. The arrange bar merged each change onto the arrangement it was drawn with, so a grouping chosen and a word typed in quick succession sent the word on top of the old grouping — on a slow phone, the link a person would send lost what they had grouped by. The bar merges onto what it last sent, shows that while what comes back is its own echo, and remembers it per bar so a redraw in between does not forget it.
