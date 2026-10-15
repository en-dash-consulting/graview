---
"@graview/core": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A calendar of years spans its records, from the first to the last. A career calendar opened on 1970-04-10 with a horizon of thirty years drew 1970–1999, and a discography's releases of 1962–1969 and 2000–2023 were nowhere. Its years now reach back to the first record and on to the last as well as across the horizon from the day it opens on — "The career · 1962–2023" — and a planning calendar whose records stop short still looks out as far as its horizon. A horizon says its ends outright with `from` and `to` (years), which win; a horizon written as a number is its years, called "Years"; and one that is not a span of years is a warning by its path (`lens-horizon`) and offers none. The graview-lens skill says the options, and `verify-declared` holds the span in a browser.

Compatibility: ops and stored records are unchanged. A calendar lens's `horizon` takes `from` and `to` beside `years` and `title`, and a number; a document's lens `options.horizon` is held to that shape by its reader. `spanOf` takes `fit` (the records' first and last years). A new warning code, `lens-horizon`.
