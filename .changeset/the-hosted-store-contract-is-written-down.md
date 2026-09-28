---
"@graview/ship": patch
"@graview/core": patch
"@graview/skills": patch
---

The hosted-store contract is written down. `WIRE`, exported from `@graview/ship`, names every route `serveStore` answers with its method and one sentence, and a test walks it; `SEAT_HEADERS` names the headers a request carries its seat in. `openRemote` takes `headers` — sent with every request, never read by the framework, the seam where a host's own credential goes — and exposes `settled()`, which resolves once every call sent so far has been answered; the server's CORS allows `authorization`. And a server's op for a change this client already applied provisionally is now RECORDED rather than re-applied (`store.receive(ops, { applied: true })`): an optimistic add followed by the server's own op used to throw a duplicate-node error out of the wire and be reported as a refusal.

The README carries the concern table — op log, snapshot and migrate on open, the wire, a principal on every apply, the seed at first install, content steps and the agent's door in the framework; auth, tenancy, quotas and fleet upgrades in a host — so a third party stands up their own host without forking anything, and Graview Cloud is the polished multi-tenant host of the same API. `graview docs` now writes an "Attaching an agent" section into llms.txt and an "Evolving a live store" checklist into agents.md; the `graview-agent-seat`, `graview-ship`, `graview-node-kind` and `graview-permissions` skills say the same; and a project from `graview create` has `serve` and `mcp` scripts and ignores `data/`.
