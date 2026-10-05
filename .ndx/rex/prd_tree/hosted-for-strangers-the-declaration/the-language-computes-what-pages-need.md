---
id: "99a1bcc2-ab82-408b-90bd-f3e9035fafe0"
level: "feature"
title: "The language computes what pages need: expressions in aggregates, first and sort, computed fields, template filters (FR-83)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-83"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "sum, min and max take an expression; first(S) and sort(S, key, 'desc') return a set"
  - "Per-kind computed fields (computed: { net: \"<expr>\" }) usable like stored fields in templates, views, sums, sorts and rules, under the same cost limits"
  - "Template filters words and and, plus a plural helper"
  - "LifeLogics' package net and 'recommended package, else top by standing then net' are each one declared expression; the offer card's 'Answers N of the things we heard' is a template; the cost check still refuses unbounded work"
description: "sum takes a field name not an expression; no pick, no sort, no computed fields."
lastModified: "2026-10-05T20:03:32.950Z"
---
