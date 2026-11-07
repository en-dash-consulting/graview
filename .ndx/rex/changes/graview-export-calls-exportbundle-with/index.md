---
id: "92d90c7a-e4dc-4e14-93bb-aed0c74eb6f4"
type: "change"
title: "/graview/export calls exportBundle with its arguments the wrong way round"
slug: "graview-export-calls-exportbundle-with"
intent: "packages/ship/src/serve.ts calls exportBundle(store, options.app) but the signature is exportBundle(app, store) (export.ts:21); ship/tests/integration/serve.test.ts does not cover the route, so GET /graview/export answers 500. Found reading the wire for Cloud's backups."
acceptanceCriteria:
  - "GET /graview/export returns a bundle assertBundle accepts"
  - "A serve test covers the route and fails without the fix"
touches:
  - "bc9a951f-ff66-4926-83d6-fdc1f6e473f9"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-11"
  - "bug"
source: "Graview Cloud FR-11, 2026-10-02"
---
