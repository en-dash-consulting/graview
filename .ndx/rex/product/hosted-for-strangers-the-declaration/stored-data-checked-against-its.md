---
id: "8bd5047c-ce38-45b9-a345-dfb4ceba969b"
type: "capability"
title: "Stored data checked against its declaration: validateGraph, and repairs as ordinary ops"
slug: "stored-data-checked-against-its"
statement: "The product validates a stored graph against its app declaration, reports findings with codes and ids, and produces a repair plan that applies as one ordinary, undoable batch."
criteria: [{"id":"c1","text":"When validateGraph checks a snapshot against an app declaration, validateGraph shall return findings that each carry a code and the ids of the affected items."},{"id":"c2","text":"When a stored node no longer fits its kind's schema, validateGraph shall report a node-shape finding."},{"id":"c3","text":"When a stored edge points to a node that does not exist, validateGraph shall report an edge-dangling finding."},{"id":"c4","text":"When a stored edge is one the schema no longer allows, validateGraph shall report an edge-disallowed finding."},{"id":"c5","text":"When a stored node has a kind the declaration does not know, validateGraph shall report a kind-unknown finding."},{"id":"c6","text":"When a rule errors while being judged, validateGraph shall report a rule-error finding."},{"id":"c7","text":"When a rule exceeds its budget and could not be judged, validateGraph shall report a rule-budget finding."},{"id":"c8","text":"When a graph is clean, validateGraph shall return zero findings."},{"id":"c9","text":"When repairPlan receives findings, repairPlan shall return primitives (drop, clear, coerce) to apply as one batch authored by whoever repairs."},{"id":"c10","text":"When a repairPlan batch is applied, the store shall apply it through the same machinery as store.apply and shall undo it cleanly."},{"id":"c11","text":"health shall report rule errors and budget overruns in addition to dangling edges and violations."}]
tags:
  - "graview-cloud"
  - "operations"
source: "Graview Cloud docs/operations.md §4, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: health(store) counts dangling edges and violations; nothing says which stored nodes no longer fit their kind's schema, which edges the schema no longer allows, or which rules could not be judged. MISSING: a host repairing data after a declaration or framework change. POSITION: validateGraph(app, snapshot) → findings with codes and ids (node-shape, edge-dangling, edge-disallowed, kind-unknown, rule-error, rule-budget); repairPlan(findings) → primitives (drop, clear, coerce) to apply as one ordinary, undoable batch authored by whoever repairs; health() gains rule errors and budget overruns.
