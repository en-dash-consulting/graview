---
"@graview/guest": patch
"@graview/skills": patch
---

A worker view can no longer freeze the reader's page by sending a lot to draw in a few messages (FR-94). The host capped a view's messages a second, its live nodes and its time per push, but not how much one message asked the page to draw. The push timer also counts time the page was held up as the page's, not the view's. A view that set a 3 600-character style on one element 2 000 times every 20 ms stayed under every cap. Each message was thousands of style records for the host to sanitise on its main thread, and the page stopped answering: Playwright could not read it, or close it, for minutes. Now the host counts its own time drawing what a view sent. Over any one second it may spend at most `drawMs`, a new limit that defaults to 100 ms. A batch that runs past it is left undrawn partway, and the view is stopped as slow with its plain face drawn.

A unit test sends 5 000 long style records in one message. Before the fix it held the test's thread past its timeout, and now the view is stopped within the budget. `guest-sandbox --transport=limits` gains the churning view. In Chromium, WebKit and Firefox it is stopped as slow, and the page's own timer keeps time. The `graview-worker-view` skill lists the new limit.

Compatibility: unchanged. `WorkerViewLimits` gains an optional `drawMs`, and no op, stored format, wire message, check code or tool schema moves.
