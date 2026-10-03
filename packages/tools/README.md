# @graview/tools

What can legally be done with a selection, and the agent surface that shares it.

Nobody authors an affordance. Providers notice things — a violation and the
repairs it names, a mutation whose subject accepts every selected kind, a
neighbour all but one of them share — and the results merge into one ranked
set. An LLM is one optional provider among these rather than the mechanism.

`createToolRuntime` generates a tool per mutation from the same declarations,
so an external agent over MCP and a seat inside the interface use literally the
same actions and produce literally the same diffs. That is why watching an
agent work needs no bespoke observability layer.

Read-only calls report the nodes they looked at, which is the half a diff
cannot show. A seat holding a principal gets tools for what that principal may
run, and is told plainly about the ones it may not.

## The host: `graview mcp` and `graview apply`

An external agent — an editor's assistant, a worker on a schedule — used to
edit the seed file, because the seed was the only thing it could reach. These
two commands put the runtime where the data is, so it evolves the live graph
the way a person does: through `store.apply`, under its own seat, judged by the
same policy, logged with its name.

```sh
graview mcp ./dist/domain/app.js --data ./data --as cursor --roles keeper
graview mcp ./dist/domain/app.js --remote-url https://host.example/app --header "authorization: Bearer …"
graview mcp ./dist/domain/app.js --list --roles keeper        # the seat's tools as tools/list JSON

graview apply ./dist/domain/app.js --data ./data --roles keeper \
  --call add-task --args '{"listId":"today","label":"Book the van","id":"t-van"}'
graview apply ./dist/domain/app.js --data ./data --roles keeper --plan ./plan.json --preview
graview apply ./dist/domain/app.js --data ./data --roles keeper --undo batch:7
```

`mcp` speaks MCP over stdio — JSON-RPC, one message per line, no SDK — around
`createToolRuntime` and `createMcpAdapter`; a reply waits for the write to
land, or for the server's verdict against a remote, so "done" is never said
before it is true. `apply` is one act, a plan of many as one batch (`[{
mutation, args, as? }]`, a later call naming an earlier one's node as
`{ "$plan": "<as>" }`), or a take-back; `--preview` writes nothing. Both take
the store backends `graview serve` takes — `--data`, `--sqlite`,
`--remote-url` — and the seat flags `--as` and `--roles`. Every act that
creates a kind accepts an optional `id` for the node it makes; every kind has
a derived `remove-<kind>`, permitted through the acts that create it.

## A hosted app: `createMcpHttpHandler`

ChatGPT and Claude reach a server over HTTP. `createMcpHttpHandler` is the
same five methods behind a fetch handler, `(Request) → Response`, over
Streamable HTTP and stateless: no session, a runtime derived per request for
the principal the host's `authenticate` hook returns. No principal is a 401
for every message, `initialize` included.

```ts
import { createMcpHttpHandler } from "@graview/tools";

export default {
  fetch: createMcpHttpHandler({
    store,
    name: "wedding-vendors",
    version: "1.0.0",
    authenticate: (request) => seatFor(request.headers.get("authorization")),
  }),
};
```

Every tool carries a title and MCP's four hints in its `annotations`,
derived from the declaration: the reads are read-only; an act that removes or
severs is destructive; an act that sets only what it is given is idempotent;
and no tool reaches an open world. Tool names are MCP-safe — letters, digits,
`_` and `-`, at most 64 — and an act whose name is not is listed under a
safe one, with `_2` on a collision; `act` on a definition says which act it
runs. `toolDefinitions(app, principal)` lists the same surface without a
store, with the `hash` a stateless host compares to learn that it moved.

Reads go through `seenBy`, and prose written by somebody other than the
caller — or the person an agent acts for — comes back as
`{ untrusted: true, authoredBy, text }` in `get_node`, `get_graph` and
`search_graph`, so a model reads another collaborator's words as data.

## Records by name

A person says "book the florist", not `vendor:bloom-co`. Every argument that
names a record takes its id or its name: a label, case and accents aside, or
the one label it starts, among the records the seat may see of the kinds the
argument accepts. The result's `resolved` says which id a name was taken to
mean; two matches are refused with every candidate (`candidates`), and none
says so. `get_node` takes a name the same way. `store.resolveRef(arg, given,
principal)` is the same resolution for a host, through a label index that
follows the graph's diffs.
