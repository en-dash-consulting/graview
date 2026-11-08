---
id: "707f08f2-ca80-4342-99bd-3974d3344a48"
type: "capability"
title: "Fuzzy and semantic search behind the intelligence seam"
slug: "fuzzy-and-semantic-search-behind-the"
statement: "Search finds records for a typo or a near word through a fuzzy fallback that needs no model, accepts a ranking provider the host supplies, and says when a hit is near rather than exact."
criteria: [{"id":"c1","text":"When a search term is a typo or a near word, the framework shall find matching records through a fuzzy fallback that needs no model."},{"id":"c2","text":"The framework shall accept a ranking provider that a host supplies, such as embeddings, to rank search results."},{"id":"c3","text":"While a host-supplied ranking provider ranks results, the framework shall apply the same sight rules that govern other search results."},{"id":"c4","text":"When a hit is near rather than exact, the strip under Find shall say so."},{"id":"c5","text":"When the search_graph tool is called, it shall honor the fuzzy fallback and the ranking provider."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "f-semantic-search"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "medium"
resolution: "Shipped on feat/search-finds-near-words: when exact hits are few, search adds near hits (a slip, another form of the word) after them with near: true and why.matched, and a host ranker (HostAi.near, rank on search) is handed only what the seat sees and its near hits arrive on result.later; Find's strip and search_graph say a hit is near."
---

A typo or a near word finds nothing; the florist does not find Bloom & Co tagged flowers.
