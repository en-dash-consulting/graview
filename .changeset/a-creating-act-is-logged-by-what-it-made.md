---
"@graview/core": patch
---

A document act that creates a record is logged by the record it made. With no subject, the line the log keeps took the first string argument the caller sent, so "Add a feature" was logged as "Add a feature: framework" when the feature's layer came before its name; it now names the new record by its kind's own label.
