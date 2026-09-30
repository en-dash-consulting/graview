---
"@graview/core": patch
---

`graview check` no longer calls a title with a hyphenated word in it an identifier. Any hyphen drew `mutation-title-is-an-identifier`, so a dealership's "Offer a trade-in" — the kind is called trade-in because the word is — was told it read as a name in the source. A hyphen is a slug only in a title that is one word; an underscore, or interior capitals in one word, still is.
