---
id: "054a2a48-743e-452b-bec7-38f5f3f81f2f"
type: "change"
title: "What a model is told of recent changes says each author as the person, never an account id"
slug: "f-model-context-says-authors-as-people"
intent: "From HQ feature:f-model-context-says-authors-as-people (found by PR #663's fourth review, older than it): aiContextOf's recent[].by in packages/core/src/catalog (byWords) names an op's author by its account id. Say it as the bound person's record label, or 'someone', by the same resolution namedAuthors uses for a seat's log, and never an account id, under the seat's sight. Private until built; public text neutral."
acceptanceCriteria:
  - "aiContextOf(...).recent[].by is the bound person's label for an author bound to a person the seat may see (test)"
  - "An author bound to no person, or to one the seat may not see, is said as 'someone', and no account id appears anywhere in aiContextOf's output (test)"
  - "The resolution is the one namedAuthors uses, not a second copy (test or a shared function)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-model-context-says-authors-as-people"
source: "Graview HQ feature:f-model-context-says-authors-as-people"
---
