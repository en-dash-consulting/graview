---
id: "9b35ddb9-12b6-401d-b994-365b69cca8da"
type: "change"
title: "Forms and downloads, the edges left"
slug: "f-forms-and-downloads-follow-ups"
intent: "From HQ feature:f-forms-and-downloads-follow-ups (left by PR #648): (1) an agent sending \"\" for an optional record argument is refused; (2) viewPlaceOf (core app-places.ts) does not carry a view's acts, only the worker-registry path does; (3) a declared typeless argument no effect reads becomes a picker over every kind with no checker warning; (4) a document line's own Download link has no ?download=1."
acceptanceCriteria:
  - "An agent's \"\" for an optional record argument is taken as no value (test)"
  - "viewPlaceOf carries a view's acts as the worker-registry path does (test)"
  - "graview check warns of a declared argument with no type that no effect reads (test)"
  - "A document line's own Download link carries ?download=1 (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "primitives"
  - "hq:feature:f-forms-and-downloads-follow-ups"
source: "Graview HQ feature:f-forms-and-downloads-follow-ups"
---
