---
id: "8143f52a-d91d-455a-bf71-9f6b797bb426"
type: "capability"
title: "A sight can reach the records that link to you"
slug: "a-sight-can-reach-the-records-that"
statement: "A sight can restrict records of given kinds to those that link, through a named edge, to the seat's own people record, so each seat sees only the records that reach it."
criteria: [{"id":"c1","text":"When a sight declares { kinds, via: '<edge>' }, the product shall show a seat a record of those kinds only when that edge reaches the seat's own people record."},{"id":"c2","text":"The product shall apply a via sight on every path that already honors sight: reads, tools, search, describe, sync and the wire."},{"id":"c3","text":"The product shall accept a via sight declared in a document and in TypeScript."},{"id":"c4","text":"If a via sight names an edge that does not reach the people kind, check shall refuse the declaration."}]
tags:
  - "roadmap"
  - "request:visibility-scoped-by-relation-see-records-linked-to-me"
source: "Graview Roadmap: request:visibility-scoped-by-relation-see-records-linked-to-me"
priority: "high"
resolution: "Shipped in #234: `via: '<relation>'` on a sight, in TypeScript and documents, held on every path sees() is (reads, counts, names, search, describe, the served log, the wire, answers, tools); check says sight-via-unknown-edge and sight-via-misses-people. Secret Santa is the fixture."
---

sees hides whole kinds, plus own: true. A Secret Santa can't show each giver only their own match; a teacher can't see only their students.
