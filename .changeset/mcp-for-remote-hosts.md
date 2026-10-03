---
"@graview/core": patch
"@graview/tools": patch
"@graview/primitives": patch
---

MCP for remote hosts. `createMcpHttpHandler({ store, authenticate, name, version })` serves the agent tools over Streamable HTTP as a fetch handler, `(Request) → Response`, stateless, for 2025-11-25 clients. The host's `authenticate` hook supplies the principal for each request; with no principal, every message is a 401, `initialize` included. The MCP TypeScript SDK's client completes initialize, `tools/list` and `tools/call` against it in the tests. `graview mcp` and the HTTP handler answer the same five methods through one dispatcher.

Every tool says what it does. A `ToolDefinition` has a `title` and `annotations` with all four MCP hints, derived from the declaration:
- `readOnlyHint` for the reads;
- `destructiveHint` for an act that removes or severs, so `remove-<kind>` is destructive;
- `idempotentHint` where an act sets only what it is given (a new `idempotent` on a mutation; derived edits and removes, and document acts that create nothing and compute nothing, have it);
- `openWorldHint: false` always.

Tool names are MCP-safe, with collisions handled the same way every time, and `act` names the act a tool runs. An act named like a read tool, such as `get_node`, used to be impossible to run, because the read tool answered first. It is now listed as `get_node_2` and runs as the act. `toolDefinitions(app, principal)` gives a seat's surface without a store, with a `hash` that changes when the surface does; `tools/list` carries it as `_meta["dev.graview/surface"]`.

Other people's words come back as data. Reads go through `seenBy`, and prose written by somebody other than the caller, or the person an agent acts for, comes back as `{ untrusted: true, authoredBy, text }` in `get_node`, `get_graph` and `search_graph` (FR-10).

Compatibility: derived tool names: unchanged for every act whose name is already letters, digits, `_` and `-`, at most 64, beginning with a letter or `_` (every act in the conformance fixtures, and every derived `edit-<kind>` and `remove-<kind>` of such a kind). Any other act is listed under a safe name: other characters become `_`, accents fall away, a leading digit or hyphen gets `act_`, and the name is cut at 64. An act named `search_graph`, `get_graph`, `get_node`, `get_violations`, `get_affordances`, `preview_mutation` or `undo_batch`, or one whose safe name another act already took, gets `_2`, `_3`, and so on. A call by the declared act name still reaches the act unless a listed tool has that name. Derived tool input schemas: unchanged, and the conformance fixtures match. Additive: every tool now has a `title` (the read tools: "Find by name", "Read the whole graph", "Read one node", "List the problems", "Ask what can be done", "Try an act without applying it", "Undo a batch") and `annotations`, and `ToolDefinition.title` is now always set. Read results: breaking for a reader that expected a string in a prose field written by somebody else, which is now the untrusted wrapper. Breaking for a seat whose policy declares `sees`: `get_graph`, `get_node`, `get_violations` and `search_graph` now show it only what it may see. `MCP_PROTOCOL_VERSION` is `2025-11-25`; a client that asks for an older revision gets its own back, as before.
