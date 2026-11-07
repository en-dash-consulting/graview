---
id: "beb367c8-a645-47bd-8d4b-c42c6d120197"
type: "capability"
title: "A live connection a hibernating host can resume from serialized per-socket state (FR-41)"
slug: "a-live-connection-a-hibernating-host"
statement: "A live connection can be resumed by a hibernating host from serialized per-socket state, because receiving a message and publishing operations are pure over state the host holds."
criteria: [{"id":"c1","text":"When a message arrives on a socket, liveProtocol.receive shall take { store, seat, cursor, send } and the message text and return { cursor, presence? } as a pure function over host-held state."},{"id":"c2","text":"When operations are published, liveProtocol.publish shall take the operations and the sockets and act as a pure function over host-held state."},{"id":"c3","text":"The live connection shall keep each socket's seat, last seq and participant key in a serializable form."},{"id":"c4","text":"If the host is evicted between two messages on one socket, the live connection shall serve the second message from the serialized per-socket state alone."},{"id":"c5","text":"When a broadcast follows a host wake, the live connection shall deliver it to every socket with that socket's own sights applied."}]
tags:
  - "graview-cloud"
  - "FR-41"
source: "Graview Cloud FR-41, 2026-10-03 (brief after 0.1.2)"
priority: "high"
---

A Durable Object that hibernates loses every closure between messages; connect() today hands back an in-memory object.
