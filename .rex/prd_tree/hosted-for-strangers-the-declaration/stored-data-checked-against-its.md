---
id: "8bd5047c-ce38-45b9-a345-dfb4ceba969b"
level: "feature"
title: "Stored data checked against its declaration: validateGraph, and repairs as ordinary ops"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "operations"
source: "Graview Cloud docs/operations.md §4, 2026-10-02"
acceptanceCriteria:
  - "Each finding code is produced by a test that seeds it"
  - "repairPlan's batch applies through store.apply-equivalent machinery and undoes cleanly"
  - "A clean graph validates with zero findings"
description: "WHAT IS THERE NOW: health(store) counts dangling edges and violations; nothing says which stored nodes no longer fit their kind's schema, which edges the schema no longer allows, or which rules could not be judged. MISSING: a host repairing data after a declaration or framework change. POSITION: validateGraph(app, snapshot) → findings with codes and ids (node-shape, edge-dangling, edge-disallowed, kind-unknown, rule-error, rule-budget); repairPlan(findings) → primitives (drop, clear, coerce) to apply as one ordinary, undoable batch authored by whoever repairs; health() gains rule errors and budget overruns."
lastModified: "2026-10-02T22:46:25.310Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
