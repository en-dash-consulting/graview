---
id: "e5a9d8d3-309e-4d25-8d66-db921735f750"
level: "task"
title: "0.1.37 · Every relation comes with its connect and disconnect acts"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
acceptanceCriteria:
  - "a relation declared without acts gets a derived connect and disconnect (sever) pair, as kinds get add-/edit-/archive-, titled from the relation and its description, overridable"
  - "an add-relation edit leaves a document whose records can be linked with no add-act; a declared connects/severs act for the same relation replaces the derived one; tests fail on 0.1.36"
  - "policy, sight and cardinality hold for the derived acts; agents see them in describe_app"
description: "Roadmap request:add-relation-should-come-with-its-own-connect-and-disconnect-acts. After add-relation nothing could link two records until a hand-written add-act with connects was added."
lastModified: "2026-10-18T21:40:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
