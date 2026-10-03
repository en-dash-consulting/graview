---
id: "247af56f-bab0-45e2-9403-d0c3f6b92671"
level: "feature"
title: "The live handler serves a store the host already holds (FR-42)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-42"
source: "Graview Cloud FR-42, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "createStoreHandler({ store, \u2026 }) or liveProtocol({ store }) works without adapter/openStore"
  - "A host's own Store instance serves WIRE and /graview/live through ship's code, and its own diagnose, quarantine and restore paths are untouched"
description: "Cloud's ledger is its durability story; swapping it for a PersistenceAdapter to get the wire is the wrong trade."
lastModified: "2026-10-03T17:32:15.000Z"
---
