---
"@graview/core": patch
---

A store's tick never outlives the day it was made on (FR-176). `store.tick(now)` set the day the rules are judged on until the next tick, so a store whose timer slept through midnight — a laptop's server, a process paused — judged "overdue" on yesterday until the timer woke, and `store.today()` said yesterday to every page that asked. A tick now holds for the rest of the day the clock read when it was made; past it, the store judges on the clock again until it is ticked, and a day a host ticks to on purpose (a replay, a test) holds as before for that day. `describePlace`, and so `describe_place` and a place rendered to static HTML, says "due tomorrow" against the store's day — the one it was ticked or pinned to — where it read the clock.

Compatibility: unchanged. `Tick.was` is the day the store judged on before the tick, as it was.
