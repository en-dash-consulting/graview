---
id: "2ba4b7bc-73b3-467d-a03f-eb1a681132b9"
level: "task"
title: "graview check, describe and the lens skill know about arrangement"
status: "pending"
priority: "medium"
acceptanceCriteria:
  - "graview check warns order-role-unknown when fieldRoles.order names a field the kind lacks, and notes a lens arrangement naming a field or edge its bound kind lacks"
  - "graview describe lists what each kind can be arranged by; llms.txt states the grammar"
  - "graview-lens gains the arrangement step and graview-pages the page keys; pnpm skills and pnpm site:build:all re-run"
blockedBy:
  - "1fb3d6a2-89dd-4ac8-9995-4cf45660ad57"
description: "graview check warns when fieldRoles.order names a field the kind does not have (order-role-unknown) and notes a lens whose arrangement names a field or edge its bound kind lacks; graview describe lists what each kind can be arranged by, so an agent that cannot see knows what a picture can be asked to do; llms.txt says the grammar; the graview-lens skill gains the step and the graview-pages skill says the page keys. Harness claim in verify-pages: an arranged list is a link that lands arranged."
lastModified: "2026-09-28T20:26:36.982Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
