---
id: "505388a9-8cd1-4c15-9697-08a16fc7b610"
type: "capability"
title: "A store can adopt the server's whole state, with pending batches applied again on top (FR-53)"
slug: "a-store-can-adopt-the-server-s-whole"
statement: "A store adopts the server's whole state by swapping in its graph and log, applying pending batches again on top, and notifying once."
criteria: [{"id":"c1","text":"When store.adopt({ snapshot, log, epochs?, horizon? }) (or rebase({ replace })) is called, the store shall swap its graph and its log for the server's."},{"id":"c2","text":"When the store adopts the server's state, the store shall re-apply its pending batches on top of the adopted state as rebase does."},{"id":"c3","text":"When the store adopts the server's state, the store shall notify its subscribers once."},{"id":"c4","text":"When Cloud's client adopt() replaces the log, the client shall do so through the store's public adopt operation and not by reaching into the log's private array."}]
tags:
  - "graview-cloud"
  - "FR-53"
source: "Graview Cloud FR-53, 2026-10-03 (brief after 0.1.2)"
priority: "high"
---

After a resync (a drifted copy, or a gap past what since serves) a client must take the server's log and graph wholesale; the log has no public way to be replaced.
