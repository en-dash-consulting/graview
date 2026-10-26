---
"@graview/ship": patch
---

A store on disk never leaves its data folder. The file adapter kept a scope at `join(root, scope)`, and the scope is the app's name unless a host says otherwise — a declaration document's name, which may be any 1 to 80 characters. A document named `../victim`, opened with `graview serve`, `mcp`, `apply`, `sync-seed` or `preview --data`, read and wrote its snapshot, log and side files in a folder beside the data directory, and a fresh start removed that folder whole. A scope is now one folder directly beneath the root (`scopeDirectory`): a name with a slash, a backslash or a NUL, or one that is `.`, `..` or empty, is refused with a sentence before any file is touched, by the adapter's load, save, log, epochs and delete and by the connections, subscriptions, friction, learned and views files kept beside it. Ship's new test holds that `../victim`, `a/b`, `/abs` and the rest are refused by each, that nothing outside the root is created or removed, and that an ordinary name is kept where it always was.

Compatibility: ops and primitives, the wire, the declaration and derived tool names and input schemas — unchanged. Stored formats — unchanged for every scope that names one folder; a store whose scope held a slash or was a dot name is refused rather than opened.
