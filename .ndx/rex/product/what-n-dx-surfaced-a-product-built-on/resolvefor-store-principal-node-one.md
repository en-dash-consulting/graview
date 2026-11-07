---
id: "15e519fe-9ad9-4498-904f-5cd2f77ec15c"
type: "capability"
title: "resolveFor(store, principal, node): one call resolves a record's declared blocks as the scene and describe_place do"
slug: "resolvefor-store-principal-node-one"
statement: "A product resolves a record's declared blocks with one public call, resolveFor(store, principal, node, options?), exposed on a lazily loaded core entry, and the scene, Pages and describe_place resolve them through that same call."
criteria: [{"id":"c1","text":"The core package shall expose a public resolveFor(store, principal, node, options?) on a lazy core entry that resolves a record's declared blocks."},{"id":"c2","text":"Where the record page budget is given as a documented option of resolveFor, resolveFor shall apply that budget, and when no budget is given, resolveFor shall apply a record page's default budget."},{"id":"c3","text":"The scene, Pages and describe_place shall resolve a record's declared blocks through resolveFor."},{"id":"c4","text":"A product shall call resolveFor without type casts."}]
tags:
  - "n-dx"
  - "blocks"
  - "api"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #202: resolveFor(store, principal, node, { app }) on @graview/core/describe reads a record's declared blocks in blockContextFor's context, which the scene and the pages face read theirs in and describe_place goes through; budget is an option, a page's (PAGE_BUDGET, 20 000) by default for a page, the home and a blocks lens, a card's (500) kept for cards and rows; no casts."
---

Resolving declared blocks takes the store, seenBy, schema, shapesOfSchema, fieldSpecsOf, a budget and a heading level, with ten `as never` casts (src/ui/declared.tsx); the promise that face, scene and describe_place resolve identically is a comment.
