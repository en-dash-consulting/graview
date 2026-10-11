---
"@graview/core": patch
---

A field only the remote changed lands on the next sync, rather than being held as a conflict. Once a delete held against the remote's edit was taken back, each field was held field by field — even one this side never changed, where ours was what both last agreed — so a title the remote edited waited on somebody's `resolve`, a conflict with nothing to choose between. Now `run` lands a held field whose value here is back at what both last agreed: theirs is applied through `applyInbound`, authored by the system, agreed, and said in the report's `applied`, and nothing is sent for it. A field both sides changed is held as before.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged; the hosted page's first load is the same (`@graview/core/sync` is an entry of its own). A `SyncState` that holds such a field from an earlier run lands it on the next.
