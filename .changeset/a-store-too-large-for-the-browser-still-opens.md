---
"@graview/ship": patch
---

A store whose first write does not fit the browser's storage still opens, and the write that failed is reported. `openStore` wrote the snapshot at open (a fresh scope, a migration run, a rebuild) and let a failure throw, while every later write went to `onPersistError`. WebKit keeps 5 MB of localStorage an origin and counts each character twice, so the gauntlet's 2.8 MB seed did not fit: the open threw, the page's top-level await rejected, and Safari drew an empty page and said nothing anywhere, not even as a page error. Now a write at open that fails goes to `onPersistError` (by default `console.error`) as a later one does, and the store opens on what it holds.

Compatibility: ops, the wire, the declaration and derived tools are unchanged; stored formats are unchanged, and what is written is the same. Changed: `openStore` no longer rejects when its write at open fails; the failure reaches `onPersistError`. What Graview Cloud does: nothing, unless it relied on `openStore` rejecting for a full store, in which case it reads `onPersistError`.
