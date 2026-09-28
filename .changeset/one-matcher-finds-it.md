---
"@graview/core": patch
"@graview/tools": patch
"@graview/primitives": patch
---

One matcher finds a thing anywhere in the graph. `search(store, query, { principal, from, subject, places, today, limit })` in `@graview/core` returns ranked hits — a record, a kind, a place, an act or a rule — each with a `why` naming the field that matched and the words around the match. Matching is on folded text (case, accents and punctuation aside), every word the start of a word, never fuzzy; `key:value` tokens are the arrangement's conditions, applied to the kinds that offer them, with `kind:` to narrow and `is:any` to include past records. Records rank by how the words matched (exact name, prefix, whole words, parts, a field), then near the subject, current before past, recently touched, flagged, alphabetical. What a seat may not see is not a hit, and an act is a hit only on a highlighted record. The arrangement's `q` uses the same matcher, so a list's `?q=` and the Find box never disagree. The agent's runtime gains `search_graph`, first among the read tools, with the records it named counted as reads; the MCP instructions say to reach for it before `get_graph`; `graview describe` and `llms.txt` say what each kind is searched by.
