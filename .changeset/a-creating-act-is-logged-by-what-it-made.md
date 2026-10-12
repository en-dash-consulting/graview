---
"@graview/core": patch
---

A document act that creates a record is logged by the record it made. With no subject, the line the log keeps took the first string argument the caller sent, so "Add a feature" was logged as "Add a feature: framework" when the feature's layer came before its name; it now names the new record by its kind's own label.

Compatibility: unchanged. The document format, the compiled format, ops and check finding codes are as they were; only the sentence an op is logged with changes, for a creating act with no subject.
