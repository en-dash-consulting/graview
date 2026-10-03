# @graview/ship

What **every** deployment of a Graview app needs, hosted or self-hosted: one `defineApp`
declaration plus one persistence adapter is a running deployment.

- **`openStore({ app, adapter })`** — load what was stored, migrate it forward, fold it into
  a live `Store`, and keep the adapter current (every diff appends its operations and
  rewrites the snapshot).
- **`createSqlAdapter({ sql })`** (from `@graview/core`) — persistence over one synchronous
  `exec(sql, ...params)`: a Durable Object's `ctx.storage.sql` as it is, or better-sqlite3
  through `sqlFromDatabase(db)`. The core's sqlite adapter is this adapter over better-sqlite3,
  so the same tests hold for both.
- **`createFileAdapter(root)`** — persistence a person can read: `snapshot.json`,
  append-only `log.jsonl`, `meta.json` with the stored schema version. The core's sqlite
  adapter is the scale answer; this is the "where is my data" answer.
- **`createBrowserAdapter()`** — the same three things in `localStorage`, for an app that
  runs in the page with no server: the sample apps remember their edits through it,
  attributed and undoable, migrations included. Import from `@graview/ship/browser` in a
  bundle (the root entry carries the file adapter's `node:fs`). Conventions the helpers
  read: `?fresh=1` returns to the seed (`openStore({ fresh })`), and a driven browser
  starts fresh unless it says `?remember=1` — `browserStartsFresh()`, `forgetFreshParam()`.
- **The store reopens with its history.** `openStore` hands the persisted log to the
  store alongside the snapshot, so what was done in an earlier session is still in the
  activity and still undoable — persistence is the op log, not a cache of the graph.
- **Op-log-native migrations** — a declaration carries `version` and `migrations`
  (`{ from, to, title, apply(snapshot) → primitives }`). Running one appends ordinary
  operations: authored `system · ship:migration`, stating intent, carrying their inverse.
  `graview check` refuses a chain with gaps or multi-version jumps before deploy time.
- **`exportBundle` / `assertBundle`** — the anti-lock-in shape: graph + attributed history +
  version in one JSON bundle, re-importable into any deployment of the same declaration.
- **A long-lived log compacts.** `opened.compact({ keepDays, keepOps })` makes the graph at
  an undo horizon a checkpoint and has the adapter archive the ops before it (the file
  adapter writes them to `archive/`). The next open loads the checkpoint and the tail, undo
  stops at the horizon and says so, and `exportBundle(app, store, { full: true })` still
  carries every op. The browser adapter keeps no epochs, so it keeps no checkpoint either.
- **`health(store)`** — coherence, not liveness: dangling edges, standing, sizes.
- **`serveStore` / `openRemote`** — the store behind HTTP, and the other end of the wire. A
  client sends CALLS, never primitives; the server applies them through an ordinary `Store`
  under the seat the request carries, so the policy refuses on the server exactly what it
  refuses in a browser. `graview serve <entry>` is the command.
- **`createStoreHandler`** — the same routes as one function from a `Request` to a
  `Response`, for any runtime: a Cloudflare Worker or Durable Object, Deno, Bun. `serveStore`
  is a thin `node:http` wrapper around it. Import it from `@graview/ship/runtime`, the entry
  that reaches no `node:` builtin: the store, migrations, the handler and `openRemote`, without
  the file adapter or the page's localStorage. A host that opens, migrates and heals its own
  `Store` hands it over instead of an adapter: `createStoreHandler({ app, store, seatOf, flush })`.
- **Content moves as steps.** The step DSL (`stepsMigration`) has five content steps beside
  the schema ones — `put-node`, `patch-node`, `drop-node`, `put-edge`, `drop-edge` — each
  judged against the stored graph when it runs, so a default that is already there is not
  put twice. `seedSteps(seed, live)` diffs a bootstrap seed against a live snapshot into
  them; `applySteps(store, steps)` lands them as one logged, undoable operation authored
  `system · ship:sync-seed`. `graview sync-seed <entry> --seed <file> --data <dir> [--apply]
  [--prune]` is the command.

## The seed is read once

`seed` is what `openStore` puts in an EMPTY store — the first install, and never again.
A store that has been opened before keeps what it has, whatever the seed file now says;
that is the whole reason a person's edits survive a deploy. So a change to the default
content is not a reason to delete the store (`fresh` is a demo's way back to the example,
not a redesign tool): it is `graview sync-seed`, which says what would change and lands
only that, under undo.

## The wire

Every route `serveStore` answers is `WIRE`, exported from the package and pinned by a test,
so a host in front of it knows what it must keep answering for `openRemote`, `graview mcp
--remote-url` and `graview apply --remote-url` to work unchanged:

| Method | Path | Says |
|---|---|---|
| GET | `/graview/state` | the graph, the log, the stored version and the modules on |
| POST | `/graview/ops` | calls in, the ops they produced out — or `undo`, batches to take back; 409 with the policy's sentence when refused |
| GET | `/graview/since?seq=N` | the ops appended after N — everyone else's |
| GET | `/graview/health` | ship's own report, plus where the data is |
| GET | `/graview/export` | the whole store as one bundle, the way out |
| POST | `/graview/here` | say where you are; answers with who else is, and the ops since `seq` |
| GET | `/graview/who` | who is here right now |
| POST | `/graview/leave` | say you have gone |
| GET | `/graview/live` | the live wire: a WebSocket of hello/welcome, call/undo/ack/refused/conflict, ops and presence, declaration and reload; 426 to a plain request |

Who is asking is the host's to say: `serveStore({ seatOf })` reads its own credential from
the `Request` and returns the principal every call is judged under, or a promise of it. The framework's clients also send the seat
as headers (`SEAT_HEADERS`: who, as what, by what name, and for whom), and a store believes
them only when told to — `serveStore({ trustSeatHeaders: true })`, which `graview serve`
sets for a server on 127.0.0.1 and says so. A store with neither answers 401 on every route
but health. Whatever a host asks for rides along: `openRemote({ headers })` sends them with
every request, and the framework never reads them. What a call came through (`via`: `web`,
`api`, `mcp:Claude`), recorded on the op, is the host's word too: `viaOf(request, seat)` says
it, or `SEAT_HEADERS.via` where the seat headers are trusted (`openRemote({ via })` sends it,
`mcp` and `cli` from the commands). A `via` in a call's body or message is never read; without
either, a socket's calls are `web` and an HTTP call's `api`. `openRemote(...).settled()` resolves once every call sent
so far has been answered — a browser never waits for it; a host that must report the
server's verdict before it exits does.

## The live wire

`openRemote({ live: true })` holds a WebSocket to `/graview/live`, and every op is pushed down
it as it lands. Calls go down it too; while it is down the client polls and posts, reconnects,
and catches up from the last op it has. Polling stays: it is the wire `curl` can drive.

| From | Message | Carries |
|---|---|---|
| client | `hello` | `seq`, the last op it has (none: the welcome carries the whole state); `protocol`; `wire` (`LIVE_WIRE`); `build`, the host's build the page runs |
| client | `call` | `cid`, `calls`, `intent`, `batch`, and `base`: the revision of each field it changes |
| client | `undo` | `cid`, `batches` to take back |
| client | `here` / `bye` | a presence, as `/graview/here` takes it; gone |
| server | `welcome` | `protocol`, `wire`, `version` (the declaration it serves), `build`, `seq` (the server's last), and the `ops` after the client's seq |
| server | `ack` | `cid`, `batch`, `seq` and the `ops` the call made |
| server | `refused` / `conflict` | `cid` and the sentence; a conflict names each field, theirs, yours and who wrote theirs |
| server | `ops` / `presence` | everybody's ops as they land, in seq order; who is here |
| server | `declaration` | `version`: the declaration changed, and the socket is served again after a new hello |
| server | `reload` | `reason` and `protocol`, the lowest served: the hello's protocol is no longer served |

Seqs mean what `/graview/since?seq=N` means, and `hello` and `welcome` carry `WIRE_PROTOCOL`.
A host on any runtime attaches a socket with `createStoreHandler(...).connect(request, { send,
close })`, which reads the seat from the upgrade and answers with the connection to hand each
message to; `serveStore` does this for Node's upgrade. What a seat may not see holds on the
socket as on the routes.

A host that hibernates — a Durable Object wakes on a message with no closure left — holds
each socket's state itself. `liveProtocol({ store })` (from `@graview/ship/runtime`) is the
same protocol as functions over the store and one plain-JSON `LiveSocketState` per socket,
`{ seat, via, cursor?, participant? }`, the thing `serializeAttachment` keeps:

```ts
const live = liveProtocol({ store, version: app.version, flush });
// On the upgrade: the seat and channel, read once (handler.seatFor(request) does this with seatOf and viaOf).
ws.serializeAttachment(live.open(seat, "web"));
// On each message, after any wake:
const peer = { ...ws.deserializeAttachment(), send: (text) => ws.send(text) };
const { landed, presence } = await live.receive(peer, text, whoIsHere);
const { send, ...state } = peer;
ws.serializeAttachment(state);
if (landed) live.publish(landed, otherPeers); // each as its own seat sees them, from its own cursor
```

`connect()` is this protocol with the state in memory, so there is one implementation.

**The declaration changes under open tabs.** A host that adds a field calls
`handler.declarationChanged({ app })` — over an adapter the handler opens the store again
with `openStore`, which migrates it; over a store the host holds it is handed
`{ app, store, flush?, migrated? }`. Every socket is told `declaration`; a sleeping host
makes a `liveProtocol` over the new store and calls `declared(peers)`. `openRemote` asks its
`resolveApp(version)` for the app at that version (a TS app imports it; a document-declared
app fetches and compiles its document), opens a new remote store on the server's migrated
state and hands it to `remote.onDeclaration((next, version) => …)`. The calls still on the
way are offered again there under the batch they were sent in, so one the server already
made is not made twice, and one that no longer fits is refused in words on
`next.onRefusal`. No page reloads. A polling client learns it the same way: every answer a
poll reads (`/graview/state`, `/graview/since`, `/graview/here`, the `/graview/ops` answer)
says the declaration `version` and the host's `build`, and `openRemote` compares it on each.

**Version skew.** A host says its `build` (an opaque string) in every welcome; a page that
said another in its hello keeps working and `remote.onBuild(…)` is told once. A host with
`minProtocol` answers an older protocol's hello with `reload`: `openRemote` writes every
call not yet answered to its `carry` (`{ storage, key }`, `sessionStorage` in a page),
calls `reloadPage`, and the next `openRemote` with the same `carry` offers them again.
Two codecs on one path are told apart by `hello.wire`, and by the WebSocket subprotocol
`LIVE_SUBPROTOCOL` (`graview.ship.1`): `serveStore` answers it, a Worker answers its upgrade
with `liveSubprotocol(request)`, and `openRemote` sends it with `subprotocol: true` or hands
it to its `socket` factory. `WIRE_PROTOCOL` stays 1: every message and field is additive.

**A stale write is a conflict, not a loss.** A field's revision is the seq of the op that last
wrote it (`FieldRevisions`, derived from the log). A call that carries a `base` older than the
field is refused, before anything is written, naming the field, theirs and yours.
`openRemote` sends one with every call and hands the refusal to `remote.onConflict(…)`,
with `conflict.keepTheirs()` and `conflict.useMine()`.

## The hosted-store contract

A third party stands up their own host — a file store or SQLite, `graview serve`,
`graview mcp` — without forking anything here. Graview Cloud is the polished multi-tenant
host of the same API, and it consumes this package the way any customer would.

| Concern | In the framework | In a host (Graview Cloud, or yours) |
|---|---|---|
| Op log + snapshot + migrate on open | `openStore` | runs it on the server, per deployment |
| The wire | `serveStore`, `createStoreHandler`, `openRemote`, `WIRE` | production TLS, a gateway URL, the runtime it runs in |
| Who is asking | `Principal` on every `apply`; `seatOf` reads the request | maps users, keys and agents to principals; tenancy; quotas |
| Seed | read once, on an empty store | the same |
| Default content moving | `seedSteps`, `applySteps`, `graview sync-seed` | when to run it, and for whom |
| An agent attaching | `graview mcp`, `graview apply`, `--remote-url`, `--header` | issuing the keys those headers carry |
| Schema moving | `version`, `migrations[]`, `graview check` | fleet upgrades |

## The boundary

Anything **one** deployment needs lives here. Anything only the **operator of many**
deployments needs — tenancy, provisioning, deploy-to-URL, billing, fleet upgrades, the
builder UX — lives in the `graview-cloud` repo, which consumes this package the way any
customer would. If Cloud ever needs a private hook into the framework, that hook is a
missing public seam to fix here first.
