---
id: "beb367c8-a645-47bd-8d4b-c42c6d120197"
level: "feature"
title: "A live connection a hibernating host can resume from serialized per-socket state (FR-41)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-41"
source: "Graview Cloud FR-41, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "liveProtocol.receive({ store, seat, cursor, send }, text) \u2192 { cursor, presence? } and liveProtocol.publish(ops, sockets) are pure over host-held state"
  - "Per-socket state (seat, last seq, participant key) is serializable"
  - "A test evicts the host between two messages on one socket; the second is served from the serialized state alone, and a broadcast after the wake reaches every socket with its own sights applied"
description: "A Durable Object that hibernates loses every closure between messages; connect() today hands back an in-memory object."
lastModified: "2026-10-03T17:32:15.000Z"
---
