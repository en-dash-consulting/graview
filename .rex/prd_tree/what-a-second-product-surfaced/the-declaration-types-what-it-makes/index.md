---
id: "90407054-fba2-4232-8413-f4e29822ba9d"
level: "feature"
title: "The declaration types what it makes, and the checker asks the questions that matter"
status: "pending"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "An app declares to: ['user'] with no cast and keeps its kind names"
  - "graview check has no warning that can only ever be acknowledged"
description: "declareInstallation returns its kinds untyped, so an app cannot point an edge at a person without a cast; a module that can never be off is still warned about; creates onboards only the first kind in a chain and nobody says so; fieldRoles and lens bindings do one job in two places; the reuse test is the skill's best idea and nothing checks it."
lastModified: "2026-09-14T22:30:34.152Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [F-008 · The reuse test is the skill's best idea and the easiest to skip](./f-008-the-reuse-test-is-the-skill-s.md) | pending |
| [F-010 · fieldRoles vs lens bindings — two places, one job, unclear which wins](./f-010-fieldroles-vs-lens-bindings-two.md) | pending |
| [F-012 · creates onboards a blank graph only for the FIRST kind in a chain](./f-012-creates-onboards-a-blank-graph.md) | pending |
| [F-019 · An app cannot declare an edge to a person without losing its own kind names](./f-019-an-app-cannot-declare-an-edge-to.md) | completed |
| [F-020 · A module you can never turn off is still warned about](./f-020-a-module-you-can-never-turn-off.md) | completed |
