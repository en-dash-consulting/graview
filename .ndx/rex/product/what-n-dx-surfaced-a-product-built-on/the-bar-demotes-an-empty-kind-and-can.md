---
id: "5fd549ba-669e-4f8a-b98b-7fd159a619b8"
type: "capability"
title: "The bar demotes an empty kind and can keep itself without its navigation"
slug: "the-bar-demotes-an-empty-kind-and-can"
statement: "The bar folds a primary place whose kind has no records into More until it has one, and a shell option lets a product keep the bar while dropping its places."
criteria: [{"id":"c1","text":"While a primary place's kind has no records, the bar shall fold that place into More until the kind has one (or the pages.primary entry takes a when)."},{"id":"c2","text":"When a shell option drops the bar's places, the bar shall keep the face switch, Find and the person."},{"id":"c3","text":"The hosted page's first load shall not grow because of the bar's demotion of empty kinds or its option to drop places."}]
tags:
  - "n-dx"
  - "bar"
  - "pages"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #203: a kind with no records folds into More until it has one, declared in pages.primary or derived alike (no `when` needed); surface(\"shell\", Shell, { without: [\"places\"] }) keeps the bar and drops only its places, on PagesApp and in an embed handed the registry; the hosted page's first load is 24 bytes lighter."
---

On a v1 n-dx tree the bar shows Constraints, an empty kind, among the primary places; and a product with its own rail can only drop the whole bar (without: ['bar']), losing the face switch, Find and the person.
