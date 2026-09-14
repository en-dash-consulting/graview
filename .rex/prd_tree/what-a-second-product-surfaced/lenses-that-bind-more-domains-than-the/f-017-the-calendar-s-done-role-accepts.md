---
id: "264198ae-cfa4-496a-b0dc-800f728dfed4"
level: "task"
title: "F-017 · The calendar's done role accepts only a boolean, so most domains cannot bind it"
status: "pending"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "@graview/primitives"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "done accepts the shapes lifecycle does: a boolean field, a status field with done values, or a date field"
  - "Groundskeeper binds done to its task status without a derived field"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-017. A task's done-ness is a status field or a date, not a boolean. lifecycle already accepts those shapes."
lastModified: "2026-09-14T22:30:35.303Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
