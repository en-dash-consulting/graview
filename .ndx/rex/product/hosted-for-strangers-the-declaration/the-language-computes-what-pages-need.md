---
id: "99a1bcc2-ab82-408b-90bd-f3e9035fafe0"
type: "capability"
title: "The language computes what pages need: expressions in aggregates, first and sort, computed fields, template filters (FR-83)"
slug: "the-language-computes-what-pages-need"
statement: "The Graview expression language computes what pages need, taking expressions in aggregates, picking and sorting sets, evaluating per-kind computed fields, and applying template filters."
criteria: [{"id":"c1","text":"The expression language shall let sum, min and max take an expression rather than only a field name."},{"id":"c2","text":"The expression language shall provide first(S) and sort(S, key, 'desc'), each returning a set."},{"id":"c3","text":"When a kind declares a computed field (computed: { net: \"<expr>\" }), the app shall let templates, views, sums, sorts and rules use it like a stored field."},{"id":"c4","text":"The expression language shall hold computed fields to the same cost limits as other expressions."},{"id":"c5","text":"The template language shall provide the filters words and and, plus a plural helper."},{"id":"c6","text":"The expression language shall let a package net, and a rule such as 'recommended package, else top by standing then net', each be written as one declared expression."},{"id":"c7","text":"The template language shall let a card such as 'Answers N of the things we heard' be written as a template."},{"id":"c8","text":"If an expression would do unbounded work, the cost check shall refuse it."}]
tags:
  - "graview-cloud"
  - "FR-83"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

sum takes a field name not an expression; no pick, no sort, no computed fields.
