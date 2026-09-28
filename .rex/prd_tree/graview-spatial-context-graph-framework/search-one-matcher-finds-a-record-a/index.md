---
id: "f3c2db33-e022-431a-8291-9c00e16b07ed"
level: "feature"
title: "Search: one matcher finds a record, a kind, a place, an act or a rule anywhere in the graph, and the graph is the result list"
status: "pending"
priority: "high"
acceptanceCriteria: []
description: "Design at docs/search.md. Search answers four questions with one headless matcher: where is the thing called X, where do I go for X, what can I do about X, what is X tied to. The graph itself is the result list — typing lights what matches and dims the rest in whatever picture is open, a strip under the box names the hits for keyboard and screen reader — and a search is a stop: #q= in the scene, ?q= on a page, descending into a lit district carries in.q so search hands off to the arrangement. One grammar with the arrangement module: words are words, key:value tokens are conditions. Searchable is derived (readable fields, labels, plurals, act titles, rule names, place titles; display.hide opts out). Same seam for the companion's fallback and a search_graph tool for agents. Empty state is search-to-create. Decided: / and ⌘K both; acts are hits only once a node hit is highlighted; the scene dims and a list hides; one harness claim per face. Not fuzzy or semantic by default; no palette that greys the app; no index service; no per-kind configuration."
lastModified: "2026-09-28T21:09:31.581Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [Skills and docs know search: pages, agent seat, new app](./skills-and-docs-know-search-pages.md) | pending |
| [The matcher in core, and the agent's search_graph tool](./the-matcher-in-core-and-the-agent-s.md) | completed |
| [The pages face and the companion: /search, the nav box, list pages on the shared matcher, search-to-create, the conversation's fallback](./the-pages-face-and-the-companion.md) | completed |
| [The scene: q in the view state, the Find box in the Shell, hits lit and the rest dimmed, descent carrying in.q](./the-scene-q-in-the-view-state-the-find.md) | completed |
