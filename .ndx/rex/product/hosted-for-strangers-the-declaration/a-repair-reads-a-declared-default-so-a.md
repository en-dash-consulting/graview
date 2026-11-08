---
id: "c1dbd292-3427-46b5-9dfb-1e1a7a3d461b"
type: "capability"
title: "A repair reads a declared default, so a record a coerce would keep is patched rather than dropped (FR-50)"
slug: "a-repair-reads-a-declared-default-so-a"
statement: "Graview's validation and repair read a field's declared default, so a record that a coerce would keep is patched rather than dropped."
criteria: [{"id":"c1","text":"When validating a graph or planning a repair, validateGraph and repairPlan shall read a field's declared default, from the compiled definitions' metadata or from ValidateGraphOptions.defaults."},{"id":"c2","text":"When a record has a cleared quote and a missing status that has a declared default, repairPlan shall patch the record by clearing the quote and setting the status to its default rather than removing the record."},{"id":"c3","text":"When a repair would set a required field to its declared default, the plan shall say \"1 required field would be set to its default\"."},{"id":"c4","text":"compileDocument shall keep a field's default out of the zod schema, so that hydration does not invent values."}]
tags:
  - "graview-cloud"
  - "FR-50"
source: "Graview Cloud FR-50, 2026-10-03 (brief after 0.1.2)"
priority: "critical"
---

compileDocument keeps a field's default out of the zod schema (rightly: hydration must not invent values), so validateGraph's safeParse(undefined) sees no default and plans a drop, taking every other fix on the record with it.
