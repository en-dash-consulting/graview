---
"@graview/core": patch
"@graview/ship": patch
"@graview/skills": patch
---

Rules that read the clock are judged again when the day turns (FR-176). A rule was judged on every change and once on load, so "overdue" stayed unsaid in a room that stayed open past midnight. `store.tick(now)` judges the store's rules on `now`'s day (UTC, as `today()` reads the clock, or a day given as `YYYY-MM-DD`) and answers `{ day, was?, appeared, cleared }`: the problems the day turning made and mended. Every subscriber hears it with an empty diff and no ops, so the bar, the problems page and the counts read again; nothing is written or logged, and a store pinned to a day (`invariantOptions.today`) stays on it. The day a store judges on is handed to every rule as its `today` — a rule in the rule language reads it before its own clock, a rule that is a function reads it from its arguments and says `readsTheClock: true` — and a broken rule's line is said on it too. `@graview/ship`'s `openStore` (and so `serve`) and `openRemote` tick their store just after each midnight until `close()`; `openStore({ tick: false })` leaves it to a host that sleeps through timers, which calls `store.tick(now)` from its own alarm. `tickEachDay(store)`, `untilTheDayTurns()` and `dayOf(now)` are on `@graview/core`.

`clockReaders(schema, rules)` on `@graview/core/check` says which rules and computed fields read the clock — `today()`, `now()`, a computed field or fact that does, a kind whose records retire on a date — and `graview check` notes them (`rules-read-the-clock`), saying what a host owes them. The `graview-invariant` skill says how a rule that is a function reads the day and how a host ticks.

Compatibility: additive. `Store.tick`, the `today` an invariant is handed, `InvariantDefinition.readsTheClock` and `openStore`'s `tick` option are new; a new check finding code, `rules-read-the-clock`, is a note and never fails a check. A store whose `invariantOptions.today` is pinned now has its document rules judged on that day too, where they read the clock. `openStore` and `openRemote` hold an unref'd timer until `close()`. `capabilities().shipped` gains FR-176.
