---
"@graview/core": patch
"@graview/ship": patch
---

An adapter over plain SQL. `createSqlAdapter({ sql, transaction? })` keeps a store in SQLite through one synchronous `exec(sql, ...params)`, the shape a Durable Object's `ctx.storage.sql` already has, so a Worker host passes it as it is. `sqlFromDatabase(db)` gives better-sqlite3 the same shape, and `createSqliteAdapter` is now that adapter over better-sqlite3, so one implementation holds for both. The adapter tests are one contract that runs against memory, better-sqlite3 and Durable Object storage in workerd (FR-09).

Compatibility: unchanged — the tables, their columns and what is stored in them are as before. `createSqliteAdapter` now prepares its statements on first use rather than when it is made, so a missing table is reported by the first load or save.
