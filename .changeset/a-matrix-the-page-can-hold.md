---
"@graview/primitives": patch
---

The coverage lens draws a matrix the page can hold. Past 80 rows or 48 columns it keeps the most-tied ones, in their own order, and says how many it left out ("the 80 most connected of 568 artists · 48 of 568 artists across"); what is missing is still counted over all of them. A real discography's "who worked with whom" was 568 artists by 568, a third of a million cells, and the page never came back from drawing them. `capCoverage` is exported beside `buildCoverage`, with `COVERAGE_MAX_ROWS` and `COVERAGE_MAX_COLUMNS`.
