---
id: "707f08f2-ca80-4342-99bd-3974d3344a48"
level: "feature"
title: "Fuzzy and semantic search behind the intelligence seam"
status: "completed"
priority: "medium"
tags:
  - "roadmap"
  - "0.1.29"
  - "f-semantic-search"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
startedAt: "2026-10-14T01:40:00.000Z"
completedAt: "2026-10-14T03:30:00.000Z"
endedAt: "2026-10-14T03:30:00.000Z"
lastModified: "2026-10-14T03:30:00.000Z"
resolution: "Shipped on feat/search-finds-near-words: when exact hits are few, search adds near hits (a slip, another form of the word) after them with near: true and why.matched, and a host ranker (HostAi.near, rank on search) is handed only what the seat sees and its near hits arrive on result.later; Find's strip and search_graph say a hit is near."
acceptanceCriteria:
  - "A fuzzy fallback in the framework with no model (typos, near words)"
  - "A ranking provider seam a host can supply (embeddings), under the same sight rules"
  - "The strip under Find says when a hit is near rather than exact"
  - "search_graph honors it"
description: "A typo or a near word finds nothing; the florist does not find Bloom & Co tagged flowers."
---
