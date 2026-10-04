---
"@graview/tools": patch
"@graview/ship": patch
---

An agent that only reads is in the room too. A store handler announced an agent seat when an op of its landed, so "Claude, for Ada" showed while it changed things and not at all while it read, which is most of what it does over MCP. `createMcpHttpHandler` takes `onCall`, told every tool call before it is answered — the caller, the tool, its arguments, whether the tool only reads, and the request — read-only calls included; it observes and cannot refuse, so what it answers or throws is ignored and the call is answered either way. `initialize` and `tools/list` are not calls. A store handler, and `serveStore`'s answer, carry `onCall`, the hook to hand it: `createMcpHttpHandler({ store: () => handler.store, authenticate, onCall: handler.onCall, … })` announces the calling agent as an op of its would — an agent seat only, for `announceAgents`' time and never when that is `false`, not when the agent holds a socket of its own, and for whom only to a seat that may see the person. An act after a read still stands the agent over what it wrote. `McpCall` is exported from `@graview/tools`.

Compatibility: the wire — additive. `StoreHandler` and `ServedStore` gain `onCall`; `McpHttpOptions` gains an optional `onCall`, and `McpCall` is a new type. No route, field or message changes, and a host that hands no hook announces exactly what it did. Ops, stored formats, derived tool names and schemas, and check codes are unchanged.
