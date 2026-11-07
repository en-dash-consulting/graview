---
id: "a3cd3340-02cf-473b-a073-b67ce9ec9376"
type: "capability"
title: "The seat view serves an op that names a record that isn't there (FR-67)"
slug: "the-seat-view-serves-an-op-that-names"
statement: "The seat view serves an op that names an id with no record, withholding it only when it names a record the seat may not see."
criteria: [{"id":"c1","text":"When hidesFrom(store, seat) is false, redact shall return the ops unchanged."},{"id":"c2","text":"When sights are declared, redact shall judge an id that names no record as seesId judges it (seen), serving the op as it is unless it names a record the seat may not see."},{"id":"c3","text":"When a store has no policy and one node, redact shall not withhold a remove-edge op from that node to a:ghost."}]
tags:
  - "graview-cloud"
  - "FR-67"
  - "now"
  - "security"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
priority: "high"
---

redact(ops, seatLens(store, seat)) withholds an op whose primitive names an id with no record (Cloud's case: a repair removing a dangling fills: vendor:bloom → category:ghost), even with no sees declared, so an app's owner is told 'a change you cannot see' about their own app. Cloud carries served in packages/room/src/room.ts (INTERIM(FR-67)).
