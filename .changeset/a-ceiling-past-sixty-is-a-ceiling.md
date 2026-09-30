---
"@graview/core": patch
---

`graview check`'s `label-unbounded` note asks whether a ceiling was chosen, not whether it is sixty. It tried a 61-character name and called any field that took it unbounded, so a label bounded at 100 — where a real catalogue's titles run to 78 — was told it "has no maximum length". Now only a label that takes ten thousand characters is noted.
