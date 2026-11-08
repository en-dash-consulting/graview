---
id: "82d172be-19b2-4a98-9bff-7df8adc8499e"
type: "capability"
title: "A store can prove its own fold: a deterministic snapshot hash and store.verify()"
slug: "a-store-can-prove-its-own-fold-a"
statement: "A store proves its own fold by hashing a snapshot deterministically, by checking through store.verify() that the snapshot matches a refold of the log, and by rebuilding a disagreeing snapshot from the log when it is opened with verification."
criteria: [{"id":"c1","text":"When two snapshots hold the same graph, snapshotHash shall return the same hash for both regardless of the order of their nodes or edges."},{"id":"c2","text":"When store.verify() is called, the store shall refold the log and report either that the snapshot and the fold agree or the first op after which they diverge."},{"id":"c3","text":"If the snapshot disagrees with the log when openStore is called with verify: true, openStore shall rebuild the snapshot from the log and report that it did so."}]
tags:
  - "graview-cloud"
  - "operations"
source: "Nick, 2026-10-02: \"think about observability, admin portal, auto-healing, schema fixes… everything\" — Graview Cloud docs/operations.md §3"
priority: "high"
---

WHAT IS THERE NOW: a persisted store is a snapshot plus a log, and nothing checks that the snapshot is the log's fold; a torn write or a bug leaves them disagreeing silently. MISSING: a host that self-heals needs to know. POSITION: snapshotHash(snapshot) — canonical, order-independent, stable across versions that do not change the graph shape; store.verify() refolds the log from empty (or from a trusted checkpoint) and compares; openStore can verify on open and rebuild the snapshot from the log when they disagree, reporting what it did. Cloud carries an interim in its room (INTERIM FR).
