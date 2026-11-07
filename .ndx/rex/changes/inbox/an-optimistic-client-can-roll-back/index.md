---
id: "2b1ae585-20a0-478e-b062-0f9fe7d7f8a6"
type: "change"
title: "An optimistic client can roll back: Store.rebase, a public notify, and batch ids that never collide across clients"
slug: "an-optimistic-client-can-roll-back"
intent: "Cloud's live client (packages/client/src/live.ts) had to reach into OperationLog's private ops array to cut the log back to the confirmed part, and replace Store.notify on the instance to emit one diff per rebase — both marked INTERIM(FR-05). It also found that Store's batch counter restarts from the loaded log on every client, so two clients mint 'batch:N' ids that also exist on the server; Cloud passes explicit local batch ids. POSITION: Store.rebase({ confirmed, pending }) that rolls back pending ops, applies confirmed ones and re-applies pending calls, emitting one diff; a public way to subscribe and emit; batch ids namespaced per store instance (or minted by the server)."
acceptanceCriteria:
  - "A client can roll back pending ops and apply a server's ops through public API only"
  - "Two stores opened from the same log never mint the same batch id"
  - "Subscribers hear one diff per rebase"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-05"
source: "Graview Cloud build, 2026-10-02"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A store can adopt the server's whole state, with pending batches applied again on top (FR-53)" (505388a9-8cd1-4c15-9697-08a16fc7b610).
