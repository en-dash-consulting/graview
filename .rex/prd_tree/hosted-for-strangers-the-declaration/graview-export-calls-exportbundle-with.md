---
id: "92d90c7a-e4dc-4e14-93bb-aed0c74eb6f4"
level: "task"
title: "/graview/export calls exportBundle with its arguments the wrong way round"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-11"
  - "bug"
source: "Graview Cloud FR-11, 2026-10-02"
startedAt: "2026-10-03T02:05:56.641Z"
completedAt: "2026-10-03T02:05:56.641Z"
endedAt: "2026-10-03T02:05:56.641Z"
acceptanceCriteria:
  - "GET /graview/export returns a bundle assertBundle accepts"
  - "A serve test covers the route and fails without the fix"
description: "packages/ship/src/serve.ts calls exportBundle(store, options.app) but the signature is exportBundle(app, store) (export.ts:21); ship/tests/integration/serve.test.ts does not cover the route, so GET /graview/export answers 500. Found reading the wire for Cloud's backups."
lastModified: "2026-10-03T02:05:56.792Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
