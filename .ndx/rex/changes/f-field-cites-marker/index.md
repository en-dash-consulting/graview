---
id: "0334f10f-d4da-4461-b79d-82e66cff9ab0"
type: "change"
title: "A field says it is cited, and the checker, the app's own actor and a view say which records hold a value with nothing cited"
slug: "f-field-cites-marker"
intent: "A value somebody looked up (a population, a quote, a date) should say where it came from, and nothing in a declaration could say so. A `cites` marker on a field names the field or relation of the same kind that holds its citation (`cites: \"source\"`), so `graview check`, the app's own actor (`@graview/core/tidying`, `dream`) and a worker view can each say which records hold a value in a cited field with nothing cited."
acceptanceCriteria:
  - "A document field takes `cites`, naming a field or relation of its kind; `markCites` marks one declared in code; both read back with `citesOf` and are written back by `toDocument` (test)"
  - "`graview check` refuses a `cites` naming nothing the kind declares, or the field itself (`field-cites`, an error) (test)"
  - "`graview check` warns of each record in a template's seed, or in `--seed`, holding a cited value with nothing cited (`field-uncited`), and installing the template is not refused for it (test)"
  - "`uncitedIn` on `@graview/core/tidying` and the actor's `dream` report say each uncited value in words, by field and by relation, and suggest nothing for it (test)"
  - "A worker view is handed `cites` and `uncited`, judged over the viewer's graph, and reads them with `graview.cite(node, field)` and `graview.uncited(node)` (test)"
  - "The graview-node-kind skill says how to declare and check it, under its length limit"
touches:
  - "64c337b0-f6a4-4f47-9826-3a36fccc8c27"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "tools"
  - "guest"
  - "skills"
  - "hq:feature:f-field-cites-marker"
source: "Graview HQ feature:f-field-cites-marker"
---
