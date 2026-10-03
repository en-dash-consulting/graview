---
id: "c1dbd292-3427-46b5-9dfb-1e1a7a3d461b"
level: "feature"
title: "A repair reads a declared default, so a record a coerce would keep is patched rather than dropped (FR-50)"
status: "pending"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-50"
source: "Graview Cloud FR-50, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "validateGraph and repairPlan read a field's declared default (compiled definitions carry it as metadata, or ValidateGraphOptions.defaults)"
  - "The record in Cloud's untidy() fixture (packages/room/tests/operations.test.ts) is patched \u2014 quote cleared, status set to its default \u2014 rather than removed"
  - "The plan says \"1 required field would be set to its default\""
description: "compileDocument keeps a field's default out of the zod schema (rightly: hydration must not invent values), so validateGraph's safeParse(undefined) sees no default and plans a drop, taking every other fix on the record with it."
lastModified: "2026-10-03T17:32:15.000Z"
---
