---
id: "03a544dd-d9fc-4ac6-ae2f-7224f0dc8b2c"
type: "change"
title: "Applying primitives is all or nothing: a failure leaves the graph as it was"
slug: "applying-primitives-is-all-or-nothing"
intent: "Graph.applyPrimitives (and so Store.receive) is not atomic: a primitive that fails leaves the earlier ones applied. Cloud's room rehearses every repair and migration on a copy first and refolds cleanly after a failure. POSITION: applyPrimitives validates and applies in a transaction (apply to a scratch structure, swap on success) or rolls back the applied prefix before throwing."
acceptanceCriteria:
  - "A batch whose third primitive fails leaves the graph byte-identical to before"
  - "Store.receive of a failing op leaves the store unchanged and throws a typed error naming the op"
touches:
  - "f51bb86f-7687-406f-8fdf-2ccf4938016d"
priority: "high"
tags:
  - "graview-cloud"
  - "operations"
source: "Graview Cloud self-healing room, 2026-10-02"
---
