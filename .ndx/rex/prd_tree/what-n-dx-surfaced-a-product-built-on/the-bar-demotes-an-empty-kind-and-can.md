---
id: "5fd549ba-669e-4f8a-b98b-7fd159a619b8"
level: "feature"
title: "The bar demotes an empty kind and can keep itself without its navigation"
status: "completed"
priority: "high"
tags:
  - "n-dx"
  - "bar"
  - "pages"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
startedAt: "2026-10-11T02:10:00.000Z"
completedAt: "2026-10-11T04:10:00.000Z"
endedAt: "2026-10-11T04:10:00.000Z"
acceptanceCriteria:
  - "A primary place whose kind has no records folds into More until it has one (or pages.primary entries take a when)"
  - "A shell option keeps the bar and drops its places"
  - "The hosted page's first load does not grow"
description: "On a v1 n-dx tree the bar shows Constraints, an empty kind, among the primary places; and a product with its own rail can only drop the whole bar (without: ['bar']), losing the face switch, Find and the person."
lastModified: "2026-10-11T04:10:00.000Z"
resolution: "Done in #203: a kind with no records folds into More until it has one, declared in pages.primary or derived alike (no `when` needed); surface(\"shell\", Shell, { without: [\"places\"] }) keeps the bar and drops only its places, on PagesApp and in an embed handed the registry; the hosted page's first load is 24 bytes lighter."
---
