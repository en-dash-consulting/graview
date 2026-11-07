---
id: "e5a9d8d3-309e-4d25-8d66-db921735f750"
type: "change"
title: "0.1.37 · Every relation comes with its connect and disconnect acts"
slug: "0-1-37-every-relation-comes-with-its"
intent: "Roadmap request:add-relation-should-come-with-its-own-connect-and-disconnect-acts. After add-relation nothing could link two records until a hand-written add-act with connects was added."
acceptanceCriteria:
  - "a relation declared without acts gets a derived connect and disconnect (sever) pair, as kinds get add-/edit-/archive-, titled from the relation and its description, overridable"
  - "an add-relation edit leaves a document whose records can be linked with no add-act; a declared connects/severs act for the same relation replaces the derived one; tests fail on 0.1.36"
  - "policy, sight and cardinality hold for the derived acts; agents see them in describe_app"
touches:
  - "a5dbf8e4-9f15-47e2-bb0c-defc68cd2fac"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
resolution: "Framework, on feat/relation-acts-derived: every kind's relation is given connect-<kind>-<relation> and disconnect-<kind>-<relation> ({ id, to }) in deriveMutations, replaced by any declared act that connects or severs it; edge-without-severer is gone."
---
