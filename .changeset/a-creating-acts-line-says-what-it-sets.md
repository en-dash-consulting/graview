---
"@graview/core": patch
---

A creating act's line in the log says the record as the act sets it. The label it is logged by was read off the arguments alone, so a field left to its default said "—" ("Add a fund: Rainy day (—)"), a literal `$$5 fund` said both dollar signs, and a title worked out by an expression said "—" where the record was called "Holiday fund". The new record's label is now read off its defaults and what the act would write, `$$` as the one `$` it writes and an expression worked out.

Compatibility: unchanged. The document format, the compiled format, ops and check finding codes are as they were; only the sentence an op is logged with changes, for a creating act with no subject whose label reads a default, a `$$` literal or an expression.
