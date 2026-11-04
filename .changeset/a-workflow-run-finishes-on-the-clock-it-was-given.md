---
"@graview/tools": patch
---

A workflow run asked for at a moment (`graview workflow … --now`, `runWorkflow`'s `now`) finishes at that moment, rather than at today's time. A run's `finished` was the later of the moment asked and the clock on the wall, so once the wall passed the moment, a run at 2026-11-01T18:02 said it finished today, and listing the workflows two hours after the moment said "Last ran just now" rather than "Last ran 2 hours ago" — `graview-workflow-lists-and-runs-the-apps-workflows` began to fail on 2026-11-02 with nothing changed. Now a run given a moment finishes at it, and one on the wall clock finishes when it does, as before.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged; a run's `finished` is still an ISO moment at or after its `started`. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged. The JavaScript API — unchanged. The look — a workflow run at a moment asked for says how long ago it ran from that moment. What Graview Cloud does — nothing; it runs workflows on the wall clock, where the two are the same.
