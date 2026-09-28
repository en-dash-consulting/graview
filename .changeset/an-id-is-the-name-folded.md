---
"@graview/core": patch
---

An id minted from a name folds its accents instead of dropping the letters: "Zoë Lamarré" is `artist:zoe-lamarre`, not `artist:zo-lamarr`, and a name in a script with no Latin letters keeps them rather than becoming `item`. Ids already in a graph are untouched; only new ones are minted this way.
