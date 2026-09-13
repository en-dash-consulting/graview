---
"@graview/core": patch
"@graview/ship": patch
---

Persistence you can open. `graview serve <entry>` hosts an app's store behind HTTP with the op log as the wire: a client sends CALLS — never primitives — and the server applies them through an ordinary `Store` under the principal the request carries, so the same policy refuses the same act there that refuses it in a browser, with the same sentence. Data is a directory of `snapshot.json`, a `log.jsonl` a person can grep, and a `meta.json` holding the stored version; `--sqlite <file>` swaps the adapter and changes nothing else. Migrations run on the server, once, against the stored graph. `/graview/health` says which adapter is keeping the data and where.

`openRemote` is the other end: a real `Store` in the browser whose calls go to the server and whose graph receives everybody else's ops on a poll. A call applies optimistically and a refusal takes it back — leaving a hopeful change on screen would mean showing a graph the server does not have.

`Store.receive(ops)` is the new core primitive underneath it: operations somebody else already judged and compiled, landing with their own id, author and intent, renumbered into this log's order and announced to subscribers exactly like a local change. Three things had to be right for two writers to converge rather than diverge — a foreign op must not be re-judged (it would ask about the wrong principal), must not be re-minted (two stores both start at `op1`, so a client silently dropped the server's op as one it already had), and must not carry the sender's sequence into a log that is contiguous by construction.

Rota runs this way with `?server=…`; the launcher's capability list now answers "server-side persistence" from the declaration rather than by assertion.
