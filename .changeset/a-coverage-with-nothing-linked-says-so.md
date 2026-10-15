---
"@graview/core": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A coverage with nothing to cross says so instead of listing its rows. "Songs by genre" — songs against genres through `inGenre` — with no genre yet drew forty songs as a plain list with no columns, which read as the answer to a question it could not yet ask. With no columns it says "No genres yet: link songs to genres.", and with columns and not one link over its relation "No song is linked to a genre yet: link songs to genres."; it draws no row, and a glance at it says "nothing linked". `describePlace` says the same words. A coverage over a path still draws its grid of empty rows, since the records between can be ones a seat may not see, and a filter that keeps only rows with nothing against them still draws its grid. The graview-lens skill says so, and `verify-declared` holds it in a browser.

Compatibility: ops, stored records and the declaration are unchanged. `coverageUnlinkedWords` is new on `@graview/core`.
