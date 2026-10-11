---
id: "ea938839-1378-41d7-9f56-3363a961940f"
level: "feature"
title: "A kind can say which field is its natural time and which its author"
status: "completed"
startedAt: "2026-10-10T23:30:00.000Z"
completedAt: "2026-10-11T03:10:00.000Z"
endedAt: "2026-10-11T03:10:00.000Z"
priority: "high"
tags:
  - "n-dx"
  - "document"
  - "fields"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "A per-kind roles: { when, who } in the document and defineNode"
  - "ListPage, timelines, glance and large-list ordering read it"
  - "graview check refuses a role naming a missing or ill-typed field"
description: "fieldRoles is not a document key at 0.1.20, so a datetime cannot be declared a record's natural time nor a string its author; commits have no declared order and a timeline binds its date in the lens."
lastModified: "2026-10-11T03:10:00.000Z"
resolution: "Done in #205: kinds.<kind>.fieldRoles in the document; lists open newest first by when, a glance leads with who and when, a timeline or calendar binding no start draws at when; graview check refuses field-role-missing-field and field-role-ill-typed."
---
