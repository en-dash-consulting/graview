---
"@graview/core": patch
"@graview/tools": patch
"@graview/ship": patch
"@graview/primitives": patch
---

A headline that opens on a count in words starts with a capital, and an acronym is never lower-cased inside a sentence. Threat Watch, on Graview Cloud, headed its home "{count(all('indicator'))|words} indicators…", which read "seventy-two indicators…" unless its author knew to add `| capital`. A headline that opens on an interpolation formatted `words`, `plural` or `relative` — words the framework wrote, not a person — now starts with a capital when its first word is all lower case: "Seventy-two indicators…". Only a headline: text the author wrote first stays as written ("only three left"), and so does a record's own name ("iPhone", "eBay"), which is a person's spelling, not a sentence's. Separately, a kind whose noun is "CVE" and plural "CVEs" was written "cVEs" in a change's summary ("How cVEs work out…"), in a place's description and in the chat's sentences: each lower-cased a plural's first letter as a word inside a sentence reads. `lowerFirst`, on `@graview/core/words` with `capitalize`, never lower-cases a word whose second letter is upper case, and every place that lower-cased a noun, a plural, a field's label or a refusal's first word reads through it or the same rule. `core`'s tests say the review's headline "Two findings, worst first" without `| capital`, leave text the author wrote first and a record's name as spelled, and say "How CVEs work out" in a change's summary.

Compatibility: additive in the API — `capitalize` and `lowerFirst` on `@graview/core/words`. A behavior change in words: a headline opening on `words`, `plural` or `relative` starts with a capital, and a noun or plural written as an acronym keeps its capitals inside a sentence. The declaration, the wire, the stored formats and the derived tools are unchanged.
