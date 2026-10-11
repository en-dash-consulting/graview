---
id: "15e519fe-9ad9-4498-904f-5cd2f77ec15c"
level: "feature"
title: "resolveFor(store, principal, node): one call resolves a record's declared blocks as the scene and describe_place do"
status: "pending"
priority: "high"
tags:
  - "n-dx"
  - "blocks"
  - "api"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "A public resolveFor(store, principal, node, options?) on a lazy core entry"
  - "The record page budget is a documented option with a page's default (subsumes 'A record page's blocks get a page's budget by default')"
  - "The scene, Pages and describe_place go through it"
  - "No casts needed in a product"
description: "Resolving declared blocks takes the store, seenBy, schema, shapesOfSchema, fieldSpecsOf, a budget and a heading level, with ten `as never` casts (src/ui/declared.tsx); the promise that face, scene and describe_place resolve identically is a comment."
lastModified: "2026-10-10T22:00:00.000Z"
---
