# graview-ship

`graview-ship` is one of Graview's 16 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Deploy a Graview app — persistence, op-log-native migrations, export and health — with one declaration and one adapter, self-hosted or behind a service.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Ship a Graview app

`@graview/ship` holds what every deployment needs. One `defineApp` declaration plus one persistence adapter is a running deployment; nothing here requires a service.

### Do this

1. **Open the store through ship**, not by hand:

```ts import { createFileAdapter, openStore } from "@graview/ship";

const opened = await openStore({ app, adapter: createFileAdapter("./data") }); // opened.store is an ordinary Store; every applied diff is appended to // the log and the snapshot rewritten, serialized in order. Hand off with // `await opened.flush()` before close/exit — writes are async. // One writer per scope: opening it twice interleaves and clobbers. ```

The file adapter is deliberately readable: `snapshot.json`, append-only `log.jsonl`, `meta.json` with the stored schema version. The core's sqlite adapter is the scale answer.

**In the page, with no server**, the browser adapter stores the same three things in `localStorage` and slots into the same call — import it from `@graview/ship/browser` so the bundler never meets `node:fs`:

```ts import { browserStartsFresh, createBrowserAdapter, forgetFreshParam, openStore } from "@graview/ship/browser";

const opened = await openStore({ app, adapter: createBrowserAdapter(), seed, fresh: browserStartsFresh(), // ?fresh=1 asks; a driven browser gets it unless ?remember=1 }); forgetFreshParam(); // the seed is the FIRST load, not every load ```

Reopened, the store carries its persisted history: earlier edits are in the activity, attributed, and undoable. Give the person a visible way back — `StartFresh` from `@graview/primitives`, or `remembers: true` on the pages context — because a demo that can be edited into a corner with no exit teaches distrust. The sample apps' `main.tsx` files are the worked examples; `pnpm remember` is the harness that holds them to it.

**The seed is read once**, into an empty store. When the default content moves afterwards, do not delete the store to see it — diff and land it:

```sh graview sync-seed ./dist/domain/app.js --seed ./src/data/example.json --data ./data graview sync-seed ./dist/domain/app.js --seed ./src/data/example.json --data ./data --apply ```

The first prints the content steps — `task t-van is put`, `today is patched: label`, `today holds t-van is tied` — and writes nothing; the second lands them as one operation authored `system · ship:sync-seed`, logged, undoable, leaving what people made alone unless `--prune` says otherwise. The same five steps (`put-node`, `patch-node`, `drop-node`, `put-edge`, `drop-edge`) go in `migrations[]` through `stepsMigration` when every installation should get them.

1. **Version the declaration, and migrate in primitives.** When the schema changes shape:

```ts defineApp({ ..., version: 2, migrations: [{ from: 1, to: 2, title: "size words become bed counts", apply: (snapshot) => snapshot.nodes .filter((node) => node.kind === "plot") .map((node) => ({ op: "patch-node", id: node.id, before: { size: node.size, beds: undefined }, after: { size: undefined, beds: node.size === "large" ? 6 : 2 } })), }], }) ```

A migration answers in the op log's own five words, so running one appends ordinary operations — authored `system · ship:migration`, stating intent, carrying their inverse. `openStore` runs the pending chain on load. `graview check` refuses a chain with a hole or a multi-version jump (`migration-gap`, `migration-not-single-step`) before deploy time finds it.

1. **Export is the exit.** `exportBundle(app, store)` — graph, attributed history and version in one JSON shape; `assertBundle` refuses someone else's app or a newer version, plainly. A tenant who cannot leave was never a customer.

1. **Health is coherence, not liveness.** `health(store)` reports sizes, standing and dangling edges — poll it per deployment, curl it self-hosted.

**Files are yours to store.** An `image`/`file` field keeps a `FileValue`; its `href` is your path. Hand `mount` `files: { upload, maxBytes, kinds }` (dev: `devFiles()`, `filesAt(…)`). Serve each as its bytes' type, `nosniff`, a `sandbox` CSP on all but a PDF (an SVG runs script otherwise), only to a seat that `seesId` a record holding it.

1. **The machine under the dev server is a door.** A locally-run product very often has a coding agent installed, logged in and paid for; the browser cannot spawn it and the dev server can.

```ts // vite.config.ts import { localIntelligence } from "@graview/ship/dev"; plugins: [localIntelligence({ path: "/__graview/local", budgetUsd: 2 })] ```

Declare it — `intelligence: [{ …, reach: ["paste", "local"], bridge: "/__graview/local" }]` — and read it with `useLocalIntelligence(path)` from `@graview/react`. The spawned session gets Read and only Read, a turn per photograph plus three, a dollar budget, a closed stdin and an environment with every `CLAUDE*` variable stripped. `apply: "serve"` means a build carries no door: a deployed copy probes, gets nothing, and reads as **closed** — which is a state, not a fault.

### Then find out whether it worked

Write, close, reopen, and read: the graph must survive the round trip and the persisted log must carry your ops with their authors. The framework's own rehearsal (`pnpm smoke`) does exactly this from packed tarballs — `theDeploymentShipped` is the verdict to mimic.

### What the check cannot see

- Whether your migration is the RIGHT transform — the chain being unbroken says nothing about the data arriving meaningful. Migrate a copy of real data and read it before shipping the step.
- Whether the adapter's storage location survives your deployment story (containers with ephemeral disks lose a file adapter's whole point).
- Whether the export actually round-trips: rehearse import into a fresh deployment, the way the framework's smoke run does — do not assume it.

1. **Serve it, and let an agent in.** `graview serve <entry> --data ./data` puts the store behind HTTP with the op log as the wire; `graview mcp <entry> --remote-url <url>` and `graview apply … --remote-url <url>` are the same commands an agent uses against a folder, now against the server, judged under the seat the request carries. Put `serve` and `mcp` in the app's scripts. The routes are `WIRE`, exported and pinned by a test, and `serveStore({ seatOf })` is where a host reads its own credential from the `Request` — `openRemote({ headers })` carries whatever it asks for. Off Node (a Worker, a Durable Object, Deno), `createStoreHandler` from `@graview/ship/runtime` answers the same routes as `handle(request)`. A store believes the seat headers the framework's clients send only with `trustSeatHeaders: true` (`graview serve` sets it on 127.0.0.1 and refuses another `--host` without `--trust-seat-headers`); with neither, it answers 401.

1. **A host serving document apps compiles once, on the server.** Send `serializeCompiled(compileDocument(document))` beside the document, and build the app in the page with `appFromOrCompile({ compiled, document })` from `@graview/core/compiled` — never `@graview/core/document`, which brings the compiler back into the first chunk. A compiled app of another format (`graview-compiled@1` today), or made from another document than the one beside it, is not built and the document is compiled instead; `pnpm verify hosted` says what the page carries.

1. **A graph made from another system: a snapshot, and a sync back.** Write the projection with `writeSnapshot(graph)` from `@graview/core/snapshot`: a header line (`generatedAt`, records per kind, links per kind, where each kind's lines are), then a record per line. `readSnapshot(text, { kinds })` parses only those kinds, and `fetchSnapshot(url, { kinds })` fetches only their bytes; an old `{ nodes, edges }` file still reads, and `--seed` takes either. Open it with `openStore({ seed, storeOptions: { principal: rememberedPrincipal() } })` so the page's acts are its reader's. Sync back with `SyncEngine` from `@graview/core/sync`:

```ts const sync = new SyncEngine({ store, remote, applyInbound, conflicts: "report", mapping: { system: "n-dx", resources: [ { kind: "task", resource: "task", fields: { status: "status" }, version: "lastModified" }, { kind: "zone", resource: "zone", fields: {}, readonly: true, because: "Sourcevision owns the zones." }, ] } }); sync.guard(); // an act on a zone is not offered, and refused, with that sentence ```

`version` links every projected record at the version it was made from, so the first run sends nothing. `report` holds a field both sides changed and sends neither until `resolve`; `theirs` lands theirs through `applyInbound`; `ours` sends ours — `report.resolved` says which it took. A refused delete is said once; one made there goes through `removeInbound`, or, without it, stays here unsynced (`report.gone`). A remote that speaks MCP is `mcpRemote({ call, pull, push })`: `call` is `mcpClient({ url, allow })` in Node, or `doorClient()` in a page behind `mcpDoor({ call, allow })` on the dev server — the door holds the token, takes only JSON from its own origin on this machine (`hosts` names others), and only the allowed tools. It knows no seat: never put it where sight is a boundary.

1. **Look at a document with no product.** `graview preview <document.json> --seed <snapshot.json>` is `serve` with Graview's own faces over the store — the scene and Pages, in memory unless `--data` says where — and `graview shots … --places home,overview --out shots` photographs named places headless (Playwright is yours to install). Prove a change to an emitted document with these, not hand-written screenshots. In a test, `compileDocumentFiles(path, { seed })` from `@graview/core/testing` reads the document where it lives — no fixture copy to drift.

### The boundary

Anything ONE deployment needs belongs in ship: the op log, the snapshot, migrating on open, the wire, a principal on every apply, the seed at first install, content steps, and the agent's door. Tenancy, provisioning, deploy-to-URL, billing, quotas and fleet upgrades belong to the operator of many — a separate service consuming ship like any customer, with its own `seatOf` mapping people and keys to principals. The concern table is in `@graview/ship`'s README; a third party can stand up their own host from it without forking anything.

---

Deploy a Graview app — persistence, op-log-native migrations, export and health — with one declaration and one adapter, self-hosted or behind a service.

The page: https://graview.dev/docs/skills/graview-ship.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
