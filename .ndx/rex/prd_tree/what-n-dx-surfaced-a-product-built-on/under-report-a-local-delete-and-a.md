---
id: "b4e10e2d-6471-4da4-9259-08cd2238d737"
level: "feature"
title: "Under report, a local delete and a remote edit become a conflict"
status: "pending"
priority: "medium"
tags:
  - "n-dx"
  - "sync"
source: "The review round before 0.1.22 (#207), 2026-10-11"
acceptanceCriteria:
  - "A local delete of a record the remote edited since the last pull is reported as a conflict"
  - "resolve can keep either side"
  - "A test holds it"
description: "Under conflicts: \"report\", a local delete silently beats a remote edit."
lastModified: "2026-10-11T08:00:00.000Z"
---
