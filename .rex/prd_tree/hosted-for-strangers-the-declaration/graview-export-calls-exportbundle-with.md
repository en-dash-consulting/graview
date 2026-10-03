---
id: "92d90c7a-e4dc-4e14-93bb-aed0c74eb6f4"
level: "task"
title: "/graview/export calls exportBundle with its arguments the wrong way round"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-11"
  - "bug"
source: "Graview Cloud FR-11, 2026-10-02"
acceptanceCriteria:
  - "GET /graview/export returns a bundle assertBundle accepts"
  - "A serve test covers the route and fails without the fix"
description: "packages/ship/src/serve.ts calls exportBundle(store, options.app) but the signature is exportBundle(app, store) (export.ts:21); ship/tests/integration/serve.test.ts does not cover the route, so GET /graview/export answers 500. Found reading the wire for Cloud's backups."
lastModified: "2026-10-02T20:55:09.565Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
