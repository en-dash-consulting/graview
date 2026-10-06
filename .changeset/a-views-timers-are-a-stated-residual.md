---
"@graview/guest": patch
"@graview/skills": patch
---

The guest README and the `graview-worker-view` skill now say what FR-94 leaves open. Work a view schedules with timers between pushes is not timed per push. A view that busies its own worker for just under `silentMs`, answers the heartbeat, and does it again can hold a core of the reader's machine for as long as it is shown. That is the worker's thread, not the page's, so the page stays responsive. The skill tells an author never to spin.

Compatibility: unchanged. Documentation only.
