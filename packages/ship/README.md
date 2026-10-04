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
| POST | `/graview/ops` | calls in, the ops they produced out — or `undo`, batches to take back; a `batch` the asking seat already landed is answered with the ops it made, and one that is somebody else's or not `batch:<tag>:<n>` is refused `invalid`; 409 with the policy's sentence and a `reason` when refused, 429 with `Retry-After` when the host is busy |
| GET | `/graview/since?seq=N` | the ops appended after N — everyone else's |
| GET | `/graview/health` | ship's own report, plus where the data is |
| GET | `/graview/export` | the whole store as one bundle, the way out |
| POST | `/graview/here` | say where you are; answers with who else is, the ops since `seq`, and the `participant` key you are held under |
| GET | `/graview/who` | who is here right now |
| POST | `/graview/leave` | say you have gone — only ever yourself |
| GET | `/graview/live` | the live wire: a WebSocket of hello/welcome, call/undo/ack/refused/conflict/busy, ops and presence, declaration and reload; 426 to a plain request |

Who is asking is the host's to say: `serveStore({ seatOf })` reads its own credential from
the `Request` and returns the principal every call is judged under, or a promise of it. The framework's clients also send the seat
as headers (`SEAT_HEADERS`: who, as what, by what name, and for whom), and a store believes
them only when told to — `serveStore({ trustSeatHeaders: true })`, which `graview serve`
sets for a server on 127.0.0.1 and says so. A store with neither answers 401 on every route
but health. Whatever a host asks for rides along: `openRemote({ headers })` sends them with
every request, and the framework never reads them. What a call came through (`via`: `web`,
`api`, `mcp:Claude`), recorded on the op, is the host's word too: `viaOf(request, seat)` says
it, or `SEAT_HEADERS.via` where the seat headers are trusted (`openRemote({ via })` sends it,
`mcp` and `cli` from the commands). A `via` in a call's body or message is a claim, never read
on its own: `openRemote` sends the one a call was applied with (a guest view applies with
`view:<name>`), and `liveProtocol({ viaOf: (peer, claimed) => … })` lets a host judge it —
asked of every change, it answers the via to record, and nothing keeps the host's own. Without
any of these, a socket's calls are `web` and an HTTP call's `api`. `openRemote(...).settled()` resolves once every call sent
so far has been answered — a browser never waits for it; a host that must report the
server's verdict before it exits does.

## The live wire

`openRemote({ live: true })` holds a WebSocket to `/graview/live`, and every op is pushed down
it as it lands. Calls go down it too; while it is down the client polls and posts, reconnects,
and catches up from the last op it has. Polling stays: it is the wire `curl` can drive.

**A host can watch it.** `remote.status()` is `connecting`, `online` or `offline`
(`RemoteStatus`), and `remote.onStatus(listener)` is told each time it changes — an offline
banner's switch. It is offline while a socket that was welcomed is down and nothing has been
heard since, or when a poll or a call does not reach the server (a network failure, or a 502,
503 or 504 from a gateway); online once a welcome or any answer lands, a refusal included. A
call made while the server is away is not taken back: it stays shown, `remote.pending()`
counts it, and it goes again the moment the server is reached. `remote.counters()`
(`RemoteCounters`) counts `reconnects`, `rebases` (the server's ops landing under pending
calls), `conflicts` and `resyncs`, for a beacon. Three options shape it: `backoff`, a function
of the attempt in milliseconds or `{ min, max, factor }` for the jittered default (250, 10000,
2); `presenceEveryMs`, how often an unchanged presence is said again down the socket; and
`visible`, a predicate — while it answers false no presence is said, and in a page it reads
`document.visibilityState` unless given.

| From | Message | Carries |
|---|---|---|
| client | `hello` | `seq`, the last op it has (none: the welcome carries the whole state); `protocol`; `wire` (`LIVE_WIRE`); `build`, the host's build the page runs |
| client | `call` | `cid`, `calls`, `intent`, `batch`, and `base`: the revision of each field it changes |
| client | `undo` | `cid`, `batches` to take back |
| client | `here` / `bye` | a presence, as `/graview/here` takes it; gone |
| server | `welcome` | `protocol`, `wire`, `version` (the declaration it serves), `build`, `participant` (this socket's own key, built from its seat), `seq` (the server's last), and the `ops` after the client's seq |
| server | `ack` | `cid`, `batch`, `seq` and the `ops` the call made |
| server | `refused` / `conflict` | `cid` and the sentence; a refusal's `reason` and, when the policy knows who could, `wouldNeed`; a conflict names each field, theirs, yours and who wrote theirs |
| server | `busy` | `cid` and `retryAfter` in milliseconds: not now, and not refused — the client sends the call again after the wait |
| server | `ops` / `presence` | everybody's ops as they land, in seq order; who is here |
| server | `declaration` | `version`: the declaration changed, and the socket is served again after a new hello |
| server | `reload` | `reason` and `protocol`, the lowest served: the hello's protocol is no longer served |

Seqs mean what `/graview/since?seq=N` means, and `hello` and `welcome` carry `WIRE_PROTOCOL`.
A host on any runtime attaches a socket with `createStoreHandler(...).connect(request, { send,
close })`, which reads the seat from the upgrade and answers with the connection to hand each
message to; `serveStore` does this for Node's upgrade. What a seat may not see holds on the
socket as on the routes, and so does its id (FR-55): no record id the seat may not see is in
anything it is sent — a welcome, ops, an ack, a conflict, a route's answer. A seen record's
field that names a hidden one is cleared, or, when the record cannot do without that field,
the record is withheld from the seat whole; a withheld op keeps no hidden id in any
primitive. `seatLens(store, principal)` is that judgement, the one every surface reads.

A host that hibernates — a Durable Object wakes on a message with no closure left — holds
each socket's state itself. `liveProtocol({ store })` (from `@graview/ship/runtime`) is the
same protocol as functions over the store and one plain-JSON `LiveSocketState` per socket,
`{ seat, via, cursor?, participant?, build?, hostBuild?, held? }`, the thing
`serializeAttachment` keeps:

```ts
const live = liveProtocol({ store, version: app.version, flush, seatOf: (key) => seats.get(key) });
// On the upgrade: the seat and channel, read once (handler.seatFor(request) does this with seatOf and viaOf).
ws.serializeAttachment(live.open(seatKey, "web", { build }));
// On each message, after any wake:
const peer = { ...ws.deserializeAttachment(), send: (text) => ws.send(text) };
const { landed, presence } = await live.receive(peer, text, whoIsHere);
const { send, ...state } = peer;
ws.serializeAttachment(state);
if (landed) live.publish(landed, otherPeers); // each as its own seat sees them, from its own cursor
```

`publish` and `tell` make each seat's view once, however many sockets it holds: a seat key is
resolved once, and each run of ops is redacted and written once and sent down every socket of
that seat (200 ops to 50 sockets of 5 seats: 4.7 ms, where it was 43 ms; 50 sockets of 50
seats are still 50 views). A withheld op is served under an opaque batch, `withheld:<16 hex>`,
a keyed hash of its batch — the same for every op of one batch — so a seat cannot tell which
session made a change it may not see; the seat that made it is served its own. The key is
drawn once per store held, so a host that wakes holds a new one; `liveProtocol({ withheldKey })`
keeps it the same across wakes, and is never sent to a client.

**The attachment budget.** Cloudflare refuses an attachment over 2,048 bytes, and a seat
held whole is most of that: a person with fifty roles is about 1.9 kB of state on its own.
So `seat` may be a host's key (a string) — `live.open("user:6b3f…", "web")` — which
`liveProtocol({ seatOf: (key) => principal })` resolves on every message; a key it no longer
knows is told so (`error`) and served nothing. A call's `cid` is at most 64 characters (a
longer one is refused `invalid`, in words), so `held` stays small, and the client's and the
host's builds are kept to 64. The budget, held by a test: a socket's state with a seat key,
a busy call held and the host's own presence beside it stays within 1 KB (measured: 350
bytes of state, 692 with a presence), half the attachment, the rest the host's.

`connect()` is this protocol with the state in memory, so there is one implementation.
Every `liveProtocol` option is an option of `createStoreHandler` and `serveStore` too, so a
host gets it either way: `limit`, `build` (a string, or a function of the socket),
`minProtocol`, `minHostProtocol`, `refusal` and `withheldKey` by the same names; and, where
the handler already has a name that reads the request, the protocol's `viaOf` as
`viaClaimed` and its `seatOf` as `seatOfKey` — with `seatKey(seat)`, the key a socket the
handler opens keeps in its state instead of the principal.

**An ack waits for `flush`, and a failed flush is never acked.** `flush(landed)` is handed
every op the protocol landed that is not durable yet, in seq order — what just landed, after
any a failed flush left — so a host that writes ops to a ledger writes exactly those (and
skips one it is handed again). Flushes run one at a time. When one rejects, the client is
refused `unavailable` ("Your change could not be saved just now. It is kept, and sent again
until it is."), keeps the change, and sends it again; the socket's cursor does not move,
`receive` answers no `landed`, and the ops stay in the store but are held back from every
socket until a flush holds them — the change sent again, or the next change, which hands
them over first. A change sent again after a failed flush is never made twice and never
acked before it is durable. `createStoreHandler({ store, flush })` takes the same `flush`.
**A change anybody else hears is a change that is written**: while an op's flush is under way
it is held back from every socket — pushes, and the ops a `hello` is welcomed with — and it
goes down once the flush resolves (a hibernating host publishes the `landed` that `receive`
or `post` answers; `createStoreHandler` does it itself). A flush that fails was heard by
nobody. A host without a `flush` pushes every op the moment it lands. A whole-state read
(`/graview/state`, a hello without a seq) is the store as it stands in memory.

**A host that routes its own requests** answers the routes with meaning through the same
protocol, so it keeps what `createStoreHandler` does — a batch sent again answered once, a
stale write a conflict, its `limit`, a refusal's reason, the ops as the seat may see them:

```ts
// POST /graview/ops, in the host's own router, after it has said who is asking:
const { status, body, headers, landed } = await live.post(await request.text(), { seat, via: "api" });
if (landed) live.publish(landed, peers);
return Response.json(body, { status, headers });
// GET /graview/state and /graview/since?seq=N, as the seat sees them:
live.state({ seat, via: "api" });
live.since(seq, { seat, via: "api" });
```

`post` answers a `WireAnswer` — `{ status, body, headers }` — and is the handler's
`POST /graview/ops`: the handler calls it, so the two answer every body the same. `WireAsked`
is who asks, `{ seat, via, build? }`.

**Who is here is the server's to say.** A presence carries its `kind`, a display `name`
and, for an agent, `onBehalfOf` (the person's id) and `onBehalfOfName`, all built from the
seat by `presenceFrom`; a client's own claim of any of them, or of another key, is not read.
A socket's key is built at `hello` and said back as `welcome.participant`, and
`openRemote(...).participant()` hands it on, so a client leaves itself out of who is here.
Somebody without a socket — an agent acting over MCP or an RPC, a polling tab — is announced:
`handler.announce(visitorPresence(seat), ttlMs)` tells every socket and poll at once and
stands until `until`. The handler does this itself for every op an agent seat lands in its
store (`POST /graview/ops`, an MCP handler over the same store, the host's own loop), for
`VISITOR_PRESENCE_TTL_MS`; `createStoreHandler({ announceAgents: false })` turns it off and a
number sets the time. A hibernating host keeps `who` itself, with `announcePresence(who,
visitorPresence(seat), ttlMs)`, and hands it to `receive` and `tell`; a visitor past its
`until` is never told. Each seat is told as it may see: an agent acting for a person the
seat may not see is shown without `onBehalfOf` or the name. The Shell draws it as "Claude,
for Ada" (`presenceName`).

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
`version` is the host's own monotonic number for the declaration it serves — `app.version`,
or a host's document version — handed to `liveProtocol({ version })` and, on the client, to
`resolveApp(version)`: it names one declaration and only ever grows. A `declaration` push or
a welcome with the number a client already serves is ignored, so a host that pushes twice
reopens nothing.

**Version skew.** A host says its `build` (an opaque string) in every welcome; a page that
said another in its hello keeps working and `remote.onBuild(…)` is told once. A host with
`minProtocol` answers an older protocol's hello with `reload`: `openRemote` writes every
call not yet answered to its `carry` (`{ storage, key }`, `sessionStorage` in a page),
calls `reloadPage`, and the next `openRemote` with the same `carry` offers them again.
A host whose build differs per upgrade — the worker that carried the socket says which shell
it serves — says it per socket: `live.open(seat, via, { build })` keeps it in the socket's
state as `hostBuild`, or `liveProtocol({ build: (peer) => … })` answers it from the socket.
A host that changes its own half of the wire (its routing, its auth, its shell) numbers it:
`openRemote({ hostProtocol })` says the number in `hello.hostProtocol`, and
`liveProtocol({ minHostProtocol })` (or `createStoreHandler`'s) answers a hello below it —
absent is 0 — with `reload` carrying `hostProtocol`, so an old page reloads with its calls
carried exactly as for `minProtocol`. `hello.protocol` stays `WIRE_PROTOCOL`, ship's.
Two codecs on one path are told apart by `hello.wire`, and by the WebSocket subprotocol
`LIVE_SUBPROTOCOL` (`graview.ship.1`): `serveStore` answers it, a Worker answers its upgrade
with `liveSubprotocol(request)`, and `openRemote` sends it with `subprotocol: true` or hands
it to its `socket` factory. `WIRE_PROTOCOL` stays 1: every message and field is additive.

**A stale write is a conflict, not a loss.** A field's revision is the seq of the op that last
wrote it (`FieldRevisions`, derived from the log). A call that carries a `base` older than the
field is refused, before anything is written, naming the field, theirs and yours.
`openRemote` sends one with every call and hands the refusal to `remote.onConflict(…)`,
with `conflict.keepTheirs()` and `conflict.useMine()`.

**A batch is answered only to whoever made it.** A client names the batch its call lands in,
so a call sent again after a lost answer is answered with the ops it made the first time —
and only ever with the asking seat's own ops: a batch that holds somebody else's (another
person, or the same agent acting for somebody else) is refused `invalid` in words, and so is
any batch not shaped as a `Store` mints it, `batch:<tag>:<n>` or `undo:<tag>:<n>`
(`isClientBatch`). A call that names none lands in a batch the server mints outside that
shape. A host's own store mints there too with `new Store({ batchIds: serverBatchIds() })`,
so nothing a host lands itself — a migration, a seed, an agent's RPC — is in a batch a client
could have named first; `createStoreHandler` does this for the store it opens.
`authoredBy(author, seat)` is the judgement of "the same seat". A batch's tag belongs to the
first seat that landed under it, so nobody names another client's next batch
(`batch:<her tag>:<n+1>`) before she does: a batch under somebody else's tag is refused
`invalid`, and so is one under the store's own minting tag (`store.batchTag`), so even a held
store that still mints `batch:<tag>:<n>` cannot have its next batch named first. **A host
holding its own store should still give it `batchIds: serverBatchIds()`**: then its batches
are not in a client's shape at all, and a reader of the log can tell a client's from the
host's.

**A refusal says why** (FR-46). Every `refused` on the socket, and every refusing answer of
`POST /graview/ops` (409, or 413 at a host's cap), carries a `reason` from a closed set,
`REFUSAL_REASONS`, which never changes meaning:

| `reason` | What it means |
|---|---|
| `forbidden` | the seat may not: the policy, a sight, an agent's declared acts, a module turned off; `wouldNeed` names the roles that could, when the policy knows them |
| `missing` | what the call names is not there: a record, or a batch to take back |
| `invalid` | the call as asked does not fit: its arguments, the kind, a rule, a call before `hello` |
| `limit` | the host's hard cap: the call can never succeed as asked, however long the caller waits |
| `unavailable` | the host takes no changes for a while and cannot say how long — a room read-only while it is checked, a write to storage that failed; the one refusal that is not final |

`openRemote`'s `remote.onRefusal((sentence, refusal) => …)` is handed the reason beside the
sentence, and `remote.send` throws a `RemoteRefusedError` carrying it. What a person reads is
said for them (`wireRefusalOf`): arguments that do not fit field by field, in the words the
form asked in ("“Add a task” was not made: Name — …"), and an act the app does not have by
the name the call gave and no other ("This app has no act called “dance”."). A host words a
refusal itself with `liveProtocol({ refusal: (error, calls, peer) => … })`, on the socket
and through `post`: it answers the `{ reason, sentence, wouldNeed? }` to send, or nothing
for ship's. The routes' other
refusing answers say one too: 401 `forbidden`, 404 `missing`, 400 `invalid`.

**Busy is not refused** (FR-45). A host's `limit` option — on `createStoreHandler`, `serveStore`
and `liveProtocol` — is asked of every change before it is judged, with the seat, the channel,
the size in bytes and the calls. It answers nothing, `{ retryAfter }`, `{ refuse }` or `{ unavailable }`:

- **busy** — `{ retryAfter }` in milliseconds, for a rate or a queue: "not now". The socket says
  `busy` and HTTP answers 429 with `Retry-After`. Nothing is judged and nothing is refused:
  `openRemote` keeps the change shown and pending and sends it again after the wait. Every later
  call on that socket is busy too until the held one comes again, and HTTP posts go one at a
  time, so a burst lands in the order it was made.
- **refused, `limit`** — `{ refuse }`, a sentence, for a hard cap such as a message over the
  size a host takes: it would be refused however long the client waited, so it is refused now
  and taken back.
- **refused, `unavailable`** — `{ unavailable }`, a sentence, for a spell with no known end,
  such as a room read-only while it is checked. The socket says `refused` with the reason
  `unavailable` and HTTP answers 503 with it. Nothing is judged and nothing is taken back:
  `openRemote` keeps the change shown and pending, and sends it again after its `backoff`,
  with every call made behind it, until the host takes it.

`limit` is asked only of a change that has not landed: a call sent again after it did — its
ack lost with the socket — is answered with the ops it made, whatever the host would say now.

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
