---
"@graview/guest": patch
---

A worker guest on the component kit is held to the same draw budget as a worker view (FR-94). `mountGuestWorker` capped a guest's live nodes, but not how much one message asked the page to build. A guest could build a group of 1 000 badges, take it away and build it again a hundred times in one message, every 20 ms. The ids come free once the group is removed, so the node cap never fills. In Chromium the guest was never stopped, and the widget's page took a stall of up to 180 ms for as long as it kept building.

Now the host counts its own time drawing a kit guest, as it does for an open-kit view. The budget is in one place for both, `host/draw-budget.ts`. Over any one second it spends at most `limits.drawMs`, which defaults to 100 ms. Past it the rest of the batch is left undrawn, the worker is terminated, and `onFailure` hears a new reason, `slow`. A unit test sends the hundred builds in one message. Before the fix it held the test's thread past its 5 s timeout, and now the guest is stopped within the budget. `guest-sandbox --transport=worker` gains a builder guest. Under both chat policies, in Chromium and WebKit, it is stopped as slow and the widget's timer keeps time.

Compatibility: unchanged. `GuestWorkerFailure` gains `slow` and the worker's limits gain an optional `drawMs`, and no op, stored format, wire message, check code or tool schema moves.
