---
id: "a7fc0aff-e528-453e-9f44-c0f325a8c328"
level: "feature"
title: "A live wire: ops pushed as they land, pending edits rebased, and a stale write is a conflict rather than a loss"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-05"
source: "Graview Cloud FR-05, 2026-10-02"
startedAt: "2026-10-03T04:44:27.904Z"
completedAt: "2026-10-03T04:44:27.904Z"
endedAt: "2026-10-03T04:44:27.904Z"
acceptanceCriteria:
  - "Two openRemote({live:true}) clients see each other's ops in under 200 ms locally, and a polling client on the same store still converges"
  - "A pending optimistic edit survives an interleaved remote op and is then confirmed or refused by the server"
  - "A stale-revision patch is refused as a conflict naming the field, theirs and yours; nothing is overwritten"
  - "A client reconnecting with its last seq receives exactly the missed ops"
  - "A property test of interleaved calls from three clients converges to identical snapshots"
description: "WHAT IS THERE NOW: openRemote applies optimistically, POSTs calls, and polls /graview/since every 800 ms ('Polling is deliberate (curl-reproducible); there is no WebSocket, SSE'); remote ops are received by id; concurrent patches to one field are last-writer-wins; SyncEngine already surfaces external conflicts as violations with repairs. MISSING: two people and an agent editing at once see each other within a beat and never lose a write silently. POSITION: keep polling as the curl-able floor and add a push transport to WIRE (a WebSocket message protocol: hello/welcome with seq, call/ack/refused, ops, presence, conflict), openRemote({ live: true }); Store.rebase rolls back pending optimistic ops, applies remote ones in seq order, and re-applies pending calls; every field carries the seq that last wrote it, a call may carry the revision it saw, and a stale one is refused as a conflict surfaced like a SyncConflict with keep-theirs / use-mine repairs. graview serve answers the socket too."
lastModified: "2026-10-03T04:44:27.985Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
