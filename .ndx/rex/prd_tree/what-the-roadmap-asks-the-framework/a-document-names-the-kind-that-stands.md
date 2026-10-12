---
id: "90b438f3-5664-45a5-9902-564a6b0b011c"
level: "feature"
title: "A document names the kind that stands for its people, and a record's id is a member's principal"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "f-people-kind"
source: "Graview Roadmap: f-people-kind"
startedAt: "2026-10-12T14:15:00.000Z"
completedAt: "2026-10-12T14:45:00.000Z"
endedAt: "2026-10-12T14:45:00.000Z"
acceptanceCriteria:
  - "A document can declare its people kind; the compiler and checker refuse a missing or ambiguous one"
  - "A seat whose principal id is a record of that kind is that person: self grants and own sights hold in a document as in TypeScript"
  - "describeApp and the JSON Schema say which kind is people"
description: "An installation's TypeScript can say which kind is its users; a document cannot, so self grants and own sights do not work in a Cloud app. Cloud's half (f-member-records) creates a record per member under their principal id."
lastModified: "2026-10-12T14:45:00.000Z"
resolution: "Shipped in #234: `people: true` on one kind (document, defineNode, the installation's user); describeApp and the kind's JSON Schema say it; check says people-ambiguous and people-unsaid."
---
