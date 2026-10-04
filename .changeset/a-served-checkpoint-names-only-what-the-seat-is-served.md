---
"@graview/core": patch
---

**Security.** A checkpoint served to a seat names who made only the records the seat is served (FR-55). A checkpoint carries `creators` — every record behind it and its first maker — so a seat's own records stay its own past a compaction; the seat view served each epoch's base as the seat saw it but handed the whole map on, hidden records and their makers among them. `seenBy(...).log.epochs()`, `log.lastEpoch()` and `checkpoint()` now keep an entry only for a record in the served base whose maker names nothing the seat may not see. The store keeps the whole map, so own sights still hold after a compaction, and the served log still folds from the served base.

Compatibility: the seat view's epochs — narrowing: `creators` on an epoch a seat with sights is served holds only the records in its served base. Stored formats, the wire, ops, derived tools and check codes are unchanged.
