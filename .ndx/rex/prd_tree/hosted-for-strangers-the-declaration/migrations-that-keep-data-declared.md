---
id: "2b5fa672-0b2e-40d3-8958-5b68ee742ba5"
level: "feature"
title: "Migrations that keep data: declared renames and type coercion in steps and migrationBetween"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-01"
  - "operations"
source: "Graview Cloud docs/operations.md §4, 2026-10-02"
startedAt: "2026-10-03T04:57:00.408Z"
completedAt: "2026-10-03T04:57:00.408Z"
endedAt: "2026-10-03T04:57:00.408Z"
acceptanceCriteria:
  - "A renamed field keeps every value and the migration's words say renamed"
  - "A text→number coercion keeps parsable values and counts the cleared ones"
  - "graview check refuses a renamedFrom naming nothing in the previous version"
description: "WHAT IS THERE NOW: migrationBetween and ship's steps express a renamed field as a drop and an add, and a retyped field as a loss. MISSING: people change their app's shape often; their data should survive what it can. POSITION: a declaration (TS and document) may say renamedFrom on a field, an edge or a kind; ship gains rename-field / rename-kind / rename-edge and coerce-field steps (text→number when it parses, datetime→date, string→enum when the value is an option, value→list of one, and the reverse where lossless); migrationBetween emits them and states, per step, what moves and what is lost."
lastModified: "2026-10-03T04:57:00.494Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
