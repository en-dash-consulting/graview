---
"@graview/core": patch
"@graview/tools": patch
"@graview/react": patch
---

A host's ranker's word reaches an agent as the host's, and Find asks the ranker only once the typing pauses. The record's word a ranker says a near hit matched ("flowers") was handed to an agent as it came, at any length, as though the app had said it; a ranker that is a model can be steered by what it reads, so `search_graph` now marks it as words somebody else said — `why.matched` is `{ untrusted: true, authoredBy: "the host's ranker", text }`, the shape record text another seat wrote already takes — and a hit keeps at most 80 characters of it (`MATCHED_MOST` on `@graview/core/search`). Find searched on every keystroke and asked the host each time, so "florist" typed a letter at a time asked a model seven times for words nobody would see the answer to; it now waits 300 ms after a keystroke, and an ask a later keystroke overtook answers nothing without reaching the host.

Compatibility: `search_graph`'s name and input schema are unchanged; on a near hit found by a host's ranker (`why.by: "meaning"`), `why.matched` is now an untrusted-text object rather than a string, and on every surface it is cut to 80 characters. Hits found by spelling or stem are unchanged. Ops, stored formats, the wire and the document format are unchanged. docs/stability.md says it beside near hits.
