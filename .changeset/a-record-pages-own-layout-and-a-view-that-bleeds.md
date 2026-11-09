---
"@graview/primitives": patch
"@graview/pages": patch
---

A record page whose kind declares its own page layout draws one divider before the facts, and no empty band between two (Roadmap f-record-page-empty-band-under-page-spec). `views.<kind>.page` drew the rule it heads the scene's record with on the pages face too, where the facts under it draw their own, so about 55 pixels of nothing stood between two lines and read as a view that failed to draw. The page's own rule is now drawn only where it heads the scene's record; a record page without a page layout is unchanged.

A view that says `bleed: true` takes each safe area on its own side in a page that reads right to left (Roadmap f-bleed-phone-rule-rtl). The phone's rule named its margins by the direction of the text, so the left inset was kept on the right; it names them by side now, as `bleed: "full"` does. A React view that throws on the home or on a record's page is caught in its own slot: its panel stands where it would have drawn, the page and the record's facts stand around it, and a slot that bled gives the width back to the column, as one whose worker view did not draw already did.
