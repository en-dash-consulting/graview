---
id: "a7fc0aff-e528-453e-9f44-c0f325a8c328"
type: "capability"
title: "A live wire: ops pushed as they land, pending edits rebased, and a stale write is a conflict rather than a loss"
slug: "a-live-wire-ops-pushed-as-they-land"
statement: "A live Graview client sees other editors' operations within a beat, keeps its own pending edits through interleaved remote operations, and has a stale write refused as a conflict rather than silently overwriting another's change."
criteria: [{"id":"c1","text":"When two clients opened with openRemote({ live: true }) share a store, each client shall receive the other's ops in under 200 ms locally."},{"id":"c2","text":"While a client polls the store instead of using a live connection, the client shall still converge with the live clients on the same store."},{"id":"c3","text":"When a remote op arrives while an optimistic edit is pending, the client shall keep the pending edit until the server confirms or refuses it."},{"id":"c4","text":"If a patch carries a stale revision, the server shall refuse it as a conflict that names the field, theirs and yours, and shall overwrite nothing."},{"id":"c5","text":"When a client reconnects with its last seq, the server shall send it exactly the ops it missed."},{"id":"c6","text":"When three clients issue interleaved calls, the clients shall converge to identical snapshots."}]
tags:
  - "graview-cloud"
  - "FR-05"
source: "Graview Cloud FR-05, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: openRemote applies optimistically, POSTs calls, and polls /graview/since every 800 ms ('Polling is deliberate (curl-reproducible); there is no WebSocket, SSE'); remote ops are received by id; concurrent patches to one field are last-writer-wins; SyncEngine already surfaces external conflicts as violations with repairs. MISSING: two people and an agent editing at once see each other within a beat and never lose a write silently. POSITION: keep polling as the curl-able floor and add a push transport to WIRE (a WebSocket message protocol: hello/welcome with seq, call/ack/refused, ops, presence, conflict), openRemote({ live: true }); Store.rebase rolls back pending optimistic ops, applies remote ones in seq order, and re-applies pending calls; every field carries the seq that last wrote it, a call may carry the revision it saw, and a stale one is refused as a conflict surfaced like a SyncConflict with keep-theirs / use-mine repairs. graview serve answers the socket too.
