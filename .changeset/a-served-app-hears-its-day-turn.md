---
"@graview/ship": patch
---

A store `openStore` opens for an app that declares no time zone (so `graview serve`, `graview mcp` and `graview apply`) turns its day at the host's midnight and its subscribers hear it. It judged rules on the host's day through a pinned `today`, and a pinned day never turns: a served app's overdue loans waited for a restart. The store now holds the host's own zone instead, the same day as before, and ticks.

Compatibility: no surface changes; `store.timeZone` on such a store now names the host's zone.
