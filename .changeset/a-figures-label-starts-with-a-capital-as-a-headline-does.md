---
"@graview/core": patch
---

A figure's label and a meter's that open on a count in words start with a capital, as a headline does. 0.1.48 made "{count(all('indicator')) | words} indicators" read "Seventy-two indicators" at the top of a page; the same template as a figure's or a progress meter's `label` still read "seventy-two indicators". The same rule now holds for both labels (`headlineSaid`): only when the label opens on an interpolation formatted `words`, `plural` or `relative`, and only when that first word is all lower case — text the author wrote first, and a record's own name, stay as written. `core`'s tests resolve a home whose figure says "Two findings", whose meter says "Two of four", and whose figure written "only {…}" stays "only two".

Compatibility: a behavior change in what a block says: a figure's or a meter's label that opens on a count, a plural or a relative time in lower case reads with a capital, on the record page, the home, `describe_place` and every surface that resolves blocks. The declaration, the wire and the stored formats are unchanged.
