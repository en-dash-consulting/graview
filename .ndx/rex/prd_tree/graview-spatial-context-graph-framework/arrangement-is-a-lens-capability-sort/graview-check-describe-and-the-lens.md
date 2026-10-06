---
id: "2ba4b7bc-73b3-467d-a03f-eb1a681132b9"
level: "task"
title: "graview check, describe and the lens skill know about arrangement"
status: "completed"
priority: "medium"
blockedBy:
  - "1fb3d6a2-89dd-4ac8-9995-4cf45660ad57"
startedAt: "2026-09-28T21:03:19.905Z"
completedAt: "2026-09-28T21:03:19.905Z"
endedAt: "2026-09-28T21:03:19.905Z"
resolutionType: "code-change"
resolutionDetail: "LensDeclaration.arrangedBy (grammar words); check/arrangement.ts: order-role-unknown (warning), lens-arrangement-unknown (note, admitted against every bound kind). describe: '## What can be arranged' per kind + lens openings. llms.txt: per-kind 'arranged by' line + '## Arranging a picture' grammar. graview-lens step 8 (useArranging), graview-pages shared words (kept under the 11000-char budget). Skills reinstalled, site regenerated. Commit aa8ec48."
acceptanceCriteria:
  - "graview check warns order-role-unknown when fieldRoles.order names a field the kind lacks, and notes a lens arrangement naming a field or edge its bound kind lacks"
  - "graview describe lists what each kind can be arranged by; llms.txt states the grammar"
  - "graview-lens gains the arrangement step and graview-pages the page keys; pnpm skills and pnpm site:build:all re-run"
description: "graview check warns when fieldRoles.order names a field the kind does not have (order-role-unknown) and notes a lens whose arrangement names a field or edge its bound kind lacks; graview describe lists what each kind can be arranged by, so an agent that cannot see knows what a picture can be asked to do; llms.txt says the grammar; the graview-lens skill gains the step and the graview-pages skill says the page keys. Harness claim in verify-pages: an arranged list is a link that lands arranged."
lastModified: "2026-09-28T21:03:19.973Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
