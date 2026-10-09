# @graview/tools

`@graview/tools` is one of the 14 npm packages of Graview, a TypeScript framework for agent-native apps built as isometric scenes. Derived affordances and the agent tool surface, generated from the same declarations; graview mcp and graview apply host it against a real store.

```sh
pnpm add @graview/tools
```

Entry points: `@graview/tools`, `@graview/tools/cli`, `@graview/tools/frame`, `@graview/tools/edit`, `@graview/tools/suggest`, `@graview/tools/go`, `@graview/tools/draft`, `@graview/tools/keep`

## What it is

What can legally be done with a selection, and the agent surface that shares it.

Nobody authors an affordance. Providers notice things — a violation and the repairs it names, a mutation whose subject accepts every selected kind, a neighbor all but one of them share — and the results merge into one ranked set. An LLM is one optional provider among these rather than the mechanism.

`createToolRuntime` generates a tool per mutation from the same declarations, so an external agent over MCP and a seat inside the interface use literally the same actions and produce literally the same diffs. That is why watching an agent work needs no bespoke observability layer.

Read-only calls report the nodes they looked at, which is the half a diff cannot show. A seat holding a principal gets tools for what that principal may run, and is told plainly about the ones it may not.

### The host: `graview mcp` and `graview apply`

An external agent — an editor's assistant, a worker on a schedule — used to edit the seed file, because the seed was the only thing it could reach. These two commands put the runtime where the data is, so it evolves the live graph the way a person does: through `store.apply`, under its own seat, judged by the same policy, logged with its name.

```sh
graview mcp ./dist/domain/app.js --data ./data --as cursor --roles keeper
graview mcp ./dist/domain/app.js --remote-url https://host.example/app --header "authorization: Bearer …"
graview mcp ./dist/domain/app.js --list --roles keeper        # the seat's tools as tools/list JSON

graview apply ./dist/domain/app.js --data ./data --roles keeper \
  --call add-task --args '{"listId":"today","label":"Book the van","id":"t-van"}'
graview apply ./dist/domain/app.js --data ./data --roles keeper --plan ./plan.json --preview
graview apply ./dist/domain/app.js --data ./data --roles keeper --undo batch:7
```

`mcp` speaks MCP over stdio — JSON-RPC, one message per line, no SDK — around `createToolRuntime` and `createMcpAdapter`; a reply waits for the write to land, or for the server's verdict against a remote, so "done" is never said before it is true. `apply` is one act, a plan of many as one batch (`[{ mutation, args, as? }]`, a later call naming an earlier one's node as `{ "$plan": "<as>" }`), or a take-back; `--preview` writes nothing. Both take the store backends `graview serve` takes — `--data`, `--sqlite`, `--remote-url` — and the seat flags `--as` and `--roles`. Every act that creates a kind accepts an optional `id` for the node it makes; every kind has a derived `remove-<kind>`, permitted through the acts that create it.

### A hosted app: `createMcpHttpHandler`

ChatGPT and Claude reach a server over HTTP. `createMcpHttpHandler` is the same five methods behind a fetch handler, `(Request) → Response`, over Streamable HTTP and stateless: no session, a runtime derived per request for the principal the host's `authenticate` hook returns. No principal is a 401 for every message, `initialize` included.

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

`onCall` is told every tool call before it is answered — the caller, the tool, its arguments and whether it only reads — and cannot refuse one. Mounted beside a store handler, `onCall: handler.onCall` shows an agent in the room while it reads, as an op of its shows it while it acts:

```ts
const handler = await createStoreHandler({ app, adapter, seatOf });
const mcp = createMcpHttpHandler({ store: () => handler.store, authenticate: seatOf, name: "rota", version: "1.0.0", onCall: handler.onCall });
```

Every tool carries a title and MCP's four hints in its `annotations`, derived from the declaration: the reads are read-only; an act that removes or severs is destructive; an act that sets only what it is given is idempotent; and no tool reaches an open world. Tool names are MCP-safe — letters, digits, `_` and `-`, at most 64 — and an act whose name is not is listed under a safe one, with `_2` on a collision; `act` on a definition says which act it runs. `toolDefinitions(app, principal)` lists the same surface without a store, with the `hash` a stateless host compares to learn that it moved.

Reads go through `seenBy`, and prose written by somebody other than the caller — or the person an agent acts for — comes back as `{ untrusted: true, authoredBy, text }` in `get_node`, `get_graph` and `search_graph`, so a model reads another collaborator's words as data.

### Drawing a view on the fly, and keeping it as a lens

Asked for a way of seeing — "a board of deliverables by status", "a timeline of dates", "who covers what" — the seat drafts a view from what the app already declares. `@graview/tools/draft` is an entry of its own, fetched when a view is first asked for:

```ts
import { draftView, refineDraft, isDraftFailure, draftSight } from "@graview/tools/draft";

const sight = draftSight(app, principal); // the kinds this seat may see
const draft = await draftView("a board of deliverables by status", { app, sight });
if (isDraftFailure(draft)) say(draft.failed); // "Couldn't draw that: deliverables have no choice field to put in columns."
else {
  draw(draft.drawn); // a DrawnLens, drawn as a declared lens is
  const refined = await refineDraft(draft, "only this month", { app, sight }); // or keeps draft as lastGood
}
```

A draft is data, never code: a lens the framework ships (`columns`, `calendar`, `timeline`, `coverage`, `board`, `plan`) bound to the app's own fields and relations, or a lens drawn from `blocks`. With no model, a template reads the ask (`templateDraft`): the words pick the lens and the kind, the declaration's roles and field types fill the bindings. Given the app's `complete`, an ask no template reads goes to the model for the same JSON, and what comes back is judged as a declared lens is (`judgeLens`) before anything is drawn. Every draft is judged against the kinds the seat may see, so a kind it may not see reads as one that is not there. A `SeatDraft` carries its `add-lens` edit (`lensEditOf`); a draft that cannot be drawn is a `DraftFailure`: one sentence, and the last good draft.

Keeping one changes the declaration, which is the host's, so it is another entry: `@graview/tools/keep`. `keepLens({ document }, draft.edit)` runs the edit through `editDocument`, `compileDocument` (graview check) and `diffDocuments`, and hands back the document to write, the place it made and the `remove-lens` edit that takes it back (`takeBackLens`). `keepLens({ app }, edit)` does the same for an app declared in code, judged by `checkApp`. `withReaderLenses` puts a reader's own kept lenses beside a declaration's, passing over one that no longer draws.

An agent reaches the same two steps as tools when its host offers them: `createToolRuntime(store, { app, drafts: { complete, keep } })` lists `draft_view` (a read: an ask, a lens to check, or the lens on screen to change) and, with `keep`, `keep_lens`, which hands `keep` the checked `add-lens` edit. `toolDefinitions(app, principal, { drafts: "keep" })` lists the same surface without a store.

### Records by name

A person says "book the florist", not `vendor:bloom-co`. Every argument that names a record takes its id or its name: a label, case and accents aside, or the one label it starts, among the records the seat may see of the kinds the argument accepts. The result's `resolved` says which id a name was taken to mean; two matches are refused with every candidate (`candidates`), and none says so. `get_node` takes a name the same way. `store.resolveRef(arg, given, principal)` is the same resolution for a host, through a label index that follows the graph's diffs.

## What it exports (87)

Read off the package's own barrel, so this is what is there today.

`across`, `aiTalks`, `aiThroughDevServer`, `aiVia`, `allQuestions`, `ANSWERED_WITH_AI`, `applyAffordance`, `applyPlan`, `BY_NAME`, `completionDecide`, `completionFor`, `createInAppAdapter`, `createMcpAdapter`, `createMcpHttpHandler`, `createToolRuntime`, `decideFor`, `defaultProviders`, `dependentsOf`, `deriveAffordances`, `deriveWithLlm`, `describePlan`, `describeProposal`, `describeRun`, `drawFigure`, `droppedProposals`, `editableFields`, `FIGURE_STYLE`, `firstJsonObject`, `graphDecide`, `graphResponder`, `inside`, `insightProvider`, `intelligenceProvider`, `invariantProvider`, `isPlanReference`, `JEV_ENDPOINT`, `JEV_INPUT_USD_PER_MILLION`, `JEV_MODEL`, `jevCostUsd`, `jevDecide`, `JevError`, `jevKeyFromEnvironment`, `landRun`, `lensProvider`, `llmIntelligence`, `llmResponder`, `loadPins`, `localCompletion`, `MCP_PROTOCOL_VERSION`, `nearestFigure`, `NO_AI`, `NO_AI_SAID`, `NO_PINS`, `nodeState`, `offerOf`, `onlyTheSvg`, `openAiCompatibleCompletion`, `pairQuestion`, `planFrom`, `previewAffordance`, `questionsForInvariant`, `questionsForKind`, `questionsForMutation`, `readRun`, `replyFromLoop`, `replyFromRun`, `resolveProposal`, `runFrom`, `runLoop`, `savePins`, `schemaProvider`, `scoreToValue`, `seatResponder`, `stillNeeded`, `structureProvider`, `surfaceHash`, `templateIntelligence`, `toCall`, `togglePin`, `toolDefinitions`, `usageBoost`, `usageWeights`, `validateProposals`, `valueOf`, `within`, `without`, `xaiCompletion`

---

Derived affordances and the agent tool surface, generated from the same declarations; graview mcp and graview apply host it against a real store.

The page: https://graview.dev/docs/packages/tools.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
