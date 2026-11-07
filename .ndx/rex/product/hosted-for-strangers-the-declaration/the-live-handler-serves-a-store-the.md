---
id: "247af56f-bab0-45e2-9403-d0c3f6b92671"
type: "capability"
title: "The live handler serves a store the host already holds (FR-42)"
slug: "the-live-handler-serves-a-store-the"
statement: "The live handler serves WIRE and /graview/live from a Store instance the host already holds, without requiring a PersistenceAdapter."
criteria: [{"id":"c1","text":"When a host passes its own store to createStoreHandler({ store, … }) or liveProtocol({ store }), ship shall serve it without requiring an adapter or openStore."},{"id":"c2","text":"When a host's own Store instance is served, ship's code shall serve WIRE and /graview/live from it and shall leave the host's own diagnose, quarantine and restore paths untouched."}]
tags:
  - "graview-cloud"
  - "FR-42"
source: "Graview Cloud FR-42, 2026-10-03 (brief after 0.1.2)"
priority: "high"
---

Cloud's ledger is its durability story; swapping it for a PersistenceAdapter to get the wire is the wrong trade.
