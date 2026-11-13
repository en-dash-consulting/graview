---
id: "a3a6fd7b-9c71-457b-9c79-0a60b2674827"
type: "change"
title: "The browser harness chain runs in minutes, not an hour and a half"
slug: "f-faster-harness-chain"
intent: "pnpm verify is documented as ~10 min; on the 0.1.74 batch the full chain ran over 1 h 28 min. Nick asked for it faster. Measure first (wall, CPU and server start per harness in the verdict and docs/watch/last-run.json), then weigh change-aware selection, warm shared servers, parallelism sized to the machine, fewer engine and width sweeps on a branch, one browser per worker, and CI sharding."
acceptanceCriteria:
  - "Each verdict records its wall time, CPU and server start-up (test)"
  - "The full chain on the development machine finishes in 15 min or less (run)"
  - "A change-aware branch run finishes in 5 min or less (run)"
  - "Nightly still runs every claim, and the watch ledger catches what it caught before (run)"
touches:
  - "1e155ee2-de1c-41fd-bfe4-ddaf98a8fdbe"
priority: "medium"
tags:
  - "graview"
  - "harness"
  - "hq:feature:f-faster-harness-chain"
source: "Graview HQ feature:f-faster-harness-chain"
---
