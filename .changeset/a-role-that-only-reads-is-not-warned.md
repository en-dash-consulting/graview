---
"@graview/core": patch
"@graview/skills": patch
---

A role that only reads is not warned. `graview check` warned `role-may-do-nothing` on every Graview Cloud template's `viewer`, a role declared to run nothing, because it may run nothing. A role that may only read is the point of a viewer. Now the warning is kept for a role that can neither run a mutation nor see a kind. A role reads every kind where the policy keeps none from anybody (no `sees`), and where it does, a sight that names the role (or every role), even for its own records only, is its reading. The warning now says so: `"guest" may run no mutation and see no kind, so anyone holding it can do nothing at all`, at `policy (role "guest")`. The vendors conformance fixture's viewer no longer draws it, announced for 0.1.21. The permissions skill says what the warning means.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format and tool schemas are unchanged, and so is the finding code. Changed: `role-may-do-nothing` is reported only for a role that can neither act nor read, where it was reported for every role that may run no mutation; its message, fix and `where` say what it now means. A host that counts warnings counts one fewer for each reader role.
