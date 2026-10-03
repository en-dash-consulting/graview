---
"@graview/core": patch
"@graview/ship": patch
"@graview/skills": patch
---

The wire answers through a fetch handler. `createStoreHandler(options)` opens the store and returns `handle(request: Request) → Promise<Response>` for every `WIRE` route, so a Cloudflare Worker, a Durable Object, Deno or Bun serves the same store without a fork. `serveStore` is now a thin `node:http` wrapper around it and answers exactly as before: the 401 rule, CORS, presence, export and health.

`@graview/ship/runtime` is a new entry that reaches no `node:` builtin: the store, migrations, content steps, the handler, export, health and `openRemote`. The browser entry stays what a page runs; the root entry keeps the file adapter and the server (FR-09).

Compatibility: breaking for a host with its own `seatOf` — it now receives a web `Request` instead of Node's `IncomingMessage` (read `request.headers.get("authorization")`, not `request.headers["authorization"]`), and may return a promise. `seatFromHeaders` takes a `Request` too. The routes, their bodies and `WIRE_PROTOCOL` are unchanged; `ServedStore` gains `handle`.
