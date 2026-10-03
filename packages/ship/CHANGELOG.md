# @graview/ship

## 0.1.3

### Patch Changes

- 1ba2ab7: A remote client a host can observe. A host's shell shows an offline banner, counts reconnects for its beacon and says how many changes have not reached the server yet, and `openRemote` said only which transport it was on, with no event. A call made while the server was away was taken back as if the server had refused it. Now `remote.status()` is `connecting`, `online` or `offline`, and `remote.onStatus(listener)` is told each time it changes. It goes offline when a welcomed socket drops or a poll or call does not reach the server, and online once a welcome or any answer lands, a refusal included. A call that cannot reach the server stays shown, counts in `remote.pending()`, and goes again, down the socket or over HTTP, once the server is reached. `remote.counters()` counts `reconnects`, `rebases`, `conflicts` and `resyncs`. Three new options shape the client. `backoff` is a function of the attempt, or `{ min, max, factor }` for the jittered default. `presenceEveryMs` sets how often an unchanged presence is said again on the socket. `visible` is a predicate, and while it answers false no presence is said; in a page it reads `document.visibilityState`. `RemoteStatus`, `RemoteCounters` and `RemoteBackoff` are exported from `@graview/ship` and `@graview/ship/browser`, and `capabilities().shipped` names FR-49. A call sent again cannot land twice. Every client, polling or live, now names its provisional `batch` with each call and undo. `POST /graview/ops` answers a batch already in the log with the ops it made, as the socket always has. So a call the server took, whose answer was lost, lands once and is not told as a conflict with itself (FR-49).
  
  Compatibility: additive for the client API. `RemoteStore` gains `status`, `onStatus`, `counters` and `pending`, and `RemoteOptions` gains `backoff`, `presenceEveryMs` and `visible`. A call that does not reach the server is held and sent again instead of taken back with a refusal. The wire is additive: `POST /graview/ops` honours the optional `batch` it already accepted, answering a batch it has with the ops it made rather than applying it again. No route or message is new, and `WIRE_PROTOCOL` stays 1. Ops and stored formats unchanged.
- ca3c327: A live connection a hibernating host can resume. `connect()` kept everything about a socket in a closure: who it is, the last seq it was sent, where it said it stood. A Durable Object that hibernates wakes on the next message with no closure left, so it could not serve ship's live wire without staying awake. The protocol is now `liveProtocol({ store, version?, migrated?, flush? })`, a few functions over the store and one plain-JSON `LiveSocketState` per socket (`{ seat, via, cursor?, participant? }`), the kind a Durable Object keeps in `serializeAttachment`. `receive(peer, text, who?)` answers one message down `peer.send` and says the socket's new `cursor`, its `presence` (built from the seat, or `null` on `bye`) and the ops it `landed`. `publish(ops, peers)` sends what landed down every other socket, each as its own seat may see it and caught up from its own cursor, and `tell(who, peers)` says who is here. Field revisions are caught up from the log as it grew rather than kept by a subscription, so a protocol made again on a wake judges a stale write exactly as the one that slept. The handler gains `seatFor(request)`, which reads a socket's starting state from its upgrade, and `protocol`. `connect()` is now this protocol with the state held in memory, so there is one implementation. `presenceFrom(told, seat)` builds a presence as the server does (FR-41).
  
  Compatibility: wire unchanged — every message, field and seq means what it meant, and a test evicts the host between two messages to hold the answers to it. New exports from `@graview/ship` and `@graview/ship/runtime`: `liveProtocol`, `presenceFrom`, and the types `LiveProtocol`, `LiveProtocolOptions`, `LivePeer`, `LiveReceived` and `LiveSocketState` (additive). `StoreHandler` and `ServedStore` gain `seatFor` and `protocol` (additive). `@graview/ship/runtime` reaches no `node:` builtin, so a Durable Object imports the protocol from there.
- 5ea9572: A refusal says why, as a code a program can branch on. A refused call reached a client as a sentence and nothing else, from one catch, so an MCP tool and an interface told "you may not" from "it is gone" by matching words. Every `refused` on the live socket, and every refusing answer of `POST /graview/ops`, now carries `reason` from a closed set, `REFUSAL_REASONS`: `forbidden` (the policy, a sight, an agent's declared acts), `missing` (a record or a batch that is not there), `invalid` (the call as asked does not fit) and `limit` (a host's hard cap, which no wait gets past), with `wouldNeed`, the roles that could, when the policy knows them. `refusalOf(error)` in `@graview/core` reads the store's own errors into one; a patch, removal or link naming a record that is not there now throws `MissingRecordError`, still a `GraphError`, and an undo with nothing live in it says `missing` on its check. `openRemote`'s `onRefusal` hands the listener the refusal beside the sentence, and `remote.send` throws a `RemoteRefusedError` carrying it. The routes' other refusing answers say a reason too: 401 `forbidden`, 404 `missing`, 400 `invalid` (FR-46).
  
  Compatibility: wire additive — `refused` gains `reason` and an optional `wouldNeed`; the 409, 401, 404 and 400 bodies gain `reason` (and `wouldNeed`) beside `error`, with their statuses unchanged; a host's `limit` refusal answers 413. The codes are on the stability surface (docs/stability.md). `UndoCheck`'s refused shape gains an optional `reason`; ops and primitives are unchanged. `onRefusal`'s listener gains a second argument, so an existing one-argument listener compiles and runs as before. A client that meets a server before this reads a reason from the status, or `invalid`.
- 8092097: A remote client that falls behind takes the server's state rather than numbering its ops out of order. `openRemote` lands the server's ops under its pending ones by `store.rebase`, which puts each op at the end of the log it holds. When the server had compacted past where the client left off, `/graview/since` and the live welcome began at the horizon, the ops between came in no answer, and the client numbered the ones that did come as if nothing had happened between. It went on with a graph that was not the server's, without a word. A copy that drifted refused the server's next op with a `ReceiveError` that nothing caught. Now, when the ops it is handed begin past the next seq it has, or an op of the server's does not fit its graph, the client fetches `/graview/state` and adopts it with `store.adopt`. Its unanswered calls are applied again on top, and a live client's call the state already holds is answered rather than made twice. What arrives while the state is on its way lands after it, and a live client carries on down its socket. `pull()` returns once a resync it started is done, and `settled()` waits for one (FR-53).
  
  Compatibility: changed for the behaviour of the remote client only. `openRemote` resyncs where it used to misnumber ops or throw, and its result types are unchanged. The wire unchanged: no route, message or field is new, and `WIRE_PROTOCOL` stays 1. Ops and stored formats unchanged.
- 5ea9572: Busy is not refused. A host's rate limit and its message-size cap are tenancy protections, and the wire had one word for them, `refused`, on which the client takes the change back: a person lost an edit because the room was busy. `createStoreHandler`, `serveStore` and `liveProtocol` take a `limit` option, asked of every change before it is judged with the seat, the channel, its size in bytes and its calls. Answering `{ retryAfter }` is busy: the socket says `{ t: "busy", cid, retryAfter }` and `POST /graview/ops` answers 429 with `Retry-After`, nothing is judged, and `openRemote` keeps the change shown and pending and sends it again after the wait. Every later call on that socket is busy until the held one comes again, and the client's posts go one at a time, so a burst over the rate lands whole and in the order it was made, with no refusal shown. Answering `{ refuse }` is a hard cap: refused with reason `limit`, and taken back (FR-45). `capabilities().shipped` names FR-45 and FR-46.
  
  Compatibility: wire additive — a new server message, `busy`, which a client that does not know it ignores (its call then waits until the socket is opened again); a new 429 answer from `POST /graview/ops`, given only when a host passes `limit`; `LiveSocketState` gains an optional `held`, plain JSON like the rest. A host that passes no `limit` answers exactly as before. `openRemote` now sends its posts one at a time where it sent them side by side.
- 50beae9: Presence a host can add to. Who is here held only sockets and pollers, so an agent acting for Ada over MCP or an RPC never appeared in the room while it worked, and a presence said only where somebody stood and what to call them. A `Presence` now carries its `kind`, and for an agent `onBehalfOf` (the person's id) and `onBehalfOfName`; `presenceName(presence)` says it as "Claude, for Ada", and the Shell's figures are named that way. `presenceFrom(told, seat, now?, participant?)` builds all of it from the seat: a claimed `kind`, `onBehalfOf` or `until` is dropped, the seat's name stands over a claimed one, and a socket's `here` is held under the key the server gave it, whatever key it claims. That key is built at `hello` and said back as `welcome.participant`, `POST /graview/here` answers with the poller's own, and `openRemote(...).participant()` hands it on, so a client leaves itself out of who is here. Somebody without a socket is announced: `handler.announce(presence, ttlMs?)` tells every socket and poll at once, and `visitorPresence(author, { session?, stop?, over? })` builds the presence from a seat the host trusts. The handler announces an agent itself for every op an agent seat lands in its store — through `POST /graview/ops`, an MCP handler over the same store, or the host's own loop — standing over what it wrote, for `VISITOR_PRESENCE_TTL_MS` (30 s); `announceAgents: false` turns that off and a number sets the time. An announced presence carries `until`, and stands until then without a heartbeat, in the server's map and in every client's fold (`presenceStands`). A hibernating host keeps who is here itself with `announcePresence(who, presence, ttlMs?, now?)`, which stamps the visitor, replaces the same participant and drops whoever has passed; `tell` and every route never tell of a visitor past its `until`. Each seat is told as it may see: an agent acting for a person the seat may not see is shown, without `onBehalfOf` or the name. `POST /graview/leave` now forgets only the asking seat's own key (FR-47).
  
  Compatibility: wire surface additive — `welcome.participant`, `participant` in the answer to `POST /graview/here`, and `kind`, `onBehalfOf`, `onBehalfOfName` and `until` on a presence; a client that ignores them is served as before. A socket's presence key is now minted by the server at hello, so the session after `kind:id:` is no longer the one the client put in its own key; a client that matched its own key against who is here reads `welcome.participant` instead. `POST /graview/leave` naming another seat's key now does nothing. New exports: `presenceName`, `presenceStands` and `VISITOR_PRESENCE_TTL_MS` from `@graview/core`; `announcePresence` and `visitorPresence` from `@graview/ship` and `@graview/ship/runtime`; `StoreHandler` and `ServedStore` gain `announce`, `RemoteStore` gains `participant()`, and the handler options gain `announceAgents` (additive). Stored formats and op shapes are unchanged, and `@graview/ship/runtime` still reaches no `node:` builtin.
- ca3c327: The channel an op came through is the host's word. Every op records its `via` — `web`, `api`, `mcp:Claude` — and the audit and the "via Claude" line read it, but the live wire took it from the client's `call.via` and `undo.via`, and `POST /graview/ops` from the body's `via`. A browser could record its edit as Claude's. The handler now takes the channel from a new `viaOf(request, seat)` option, or, where it trusts the seat headers, from the new `SEAT_HEADERS.via` (`x-graview-via`), which is believed exactly where the seat is. Failing both, a socket's calls are `web` and an HTTP call's `api`. A socket's channel is read once, from its upgrade, and kept in its state. `openRemote({ via })` sends the header, and the query parameter a page's socket carries, instead of the field, so `graview mcp --remote-url` against `graview serve` is still recorded as `mcp`. The MCP HTTP handler takes no `via` from a caller, so nothing changes there (FR-52).
  
  Compatibility: breaking for a client that named its own channel: `via` in a `call`, an `undo` or the body of `POST /graview/ops` is now ignored, and `LiveClientMessage` no longer has the field. Such a client sends `x-graview-via` to a server that trusts seat headers; a host that asks its own `seatOf` says the channel with `viaOf`. A browser posting over HTTP to a host with a `seatOf` and no `viaOf` is now recorded as `api` where it said `web`. Stored formats and op shapes are unchanged. `SEAT_HEADERS.via` and `viaOf` are additive, and CORS allows the new header.
- 625ac82: The declaration changes under open tabs. A structural change — a field added from a chat, from the studio, from a hosted builder — reached an open tab only when somebody reloaded it, and whatever that tab had on its way was lost with the page. A host now calls `handler.declarationChanged({ app })`: over an adapter the handler writes what is pending and opens the store again with `openStore`, which migrates it; over a store the host holds it is handed `{ app, store, flush?, migrated? }`. Every request and message waits while the change is made, so nothing lands on the store being let go, and every open socket is told `{ t: "declaration", version }` and is served again after a new hello. A sleeping host makes a `liveProtocol` over the new store and calls `declared(peers)`, which tells each socket and forgets its cursor. Every welcome now says the declaration `version` it serves. In `openRemote`, `resolveApp(version)` names the app at the server's version — a TS app imports it, a document-declared app fetches and compiles its document — and `remote.onDeclaration((next, version) => …)` is handed a new remote store opened on the server's migrated state, with the calls still on the way offered again under the batch they were sent in: one the server already made is not made twice, and one that no longer fits is refused in words on `next.onRefusal` (told to the first listener, or to the old store's when nobody listens). No page reloads; without `resolveApp`, the client reloads as `reload` does, carrying its calls (FR-43). A client without a socket learns it the same way: every answer a poll reads — `/graview/state`, `/graview/since`, `/graview/here` and the `/graview/ops` answer, refused or not — says the declaration `version` and the host's `build`, and `openRemote` compares it on every one and makes the same change through the same code. A call offered again over HTTP is answered once by the batch idempotency `POST /graview/ops` already has, and one answered on another declaration is let go and offered on the new store, also when it waited in the post lane for a busy host or an unreachable server. `capabilities().shipped` names FR-43.
  
  Compatibility: wire additive — a new server message `declaration` and a new `welcome.version`; new `version` and `build` fields on the answers of `/graview/since`, `/graview/here` and `POST /graview/ops` (and `build` on `/graview/state`, which already said `version`) — every answer of those routes except a 429 busy, which the client sends again anyway; a client that does not know the message ignores it, as the stability rules say. `WIRE_PROTOCOL` stays 1: every client of protocol 1 is still served, and raising it would send every open tab a `reload` under FR-44's own skew handling for a change that needs none. New exports from `@graview/ship` and `@graview/ship/runtime`: the type `DeclarationChange` (additive). `StoreHandler` and `ServedStore` gain `declarationChanged`, and their `store`, `opened` and `protocol` are read through, so they name the new ones after a change (additive). `LiveProtocol` gains `declared`, `RemoteOptions` gains `resolveApp`, and `RemoteStore` gains `onDeclaration` (additive).
- ca3c327: The wire serves a store the host already holds. `createStoreHandler` opened its own store from a `PersistenceAdapter`, so a host with its own durability — snapshots in parts, epochs, quarantine and restore, its own meter — had to give that up to get ship's wire. `createStoreHandler({ app, store, seatOf, flush?, migrated? })` now answers every `WIRE` route and `/graview/live` from the host's own `Store` instance: `flush` is awaited before a call is answered, `migrated` is said in the state, and closing the handler leaves the store open, because it is the host's. The adapter form, `createStoreHandler({ app, adapter, … })`, is now a thin layer over this one: it opens the store with `openStore` and hands it on (FR-42). `capabilities().shipped` names FR-41, FR-42 and FR-52.
  
  Compatibility: wire unchanged — same routes, same messages, same answers. `StoreHandlerOptions` is now a union of `AdapterStoreHandlerOptions` and `HeldStoreHandlerOptions` (additive for a caller that passes an adapter). `StoreHandler.opened` is optional, because a handler over a held store has no `openStore` behind it; `createStoreHandler` with an adapter, and `serveStore`, still return it typed as present, so existing callers compile unchanged. A held store's health report says `adapter: "held by the host"`.
- 625ac82: Version skew on the wire. During a rolling deploy, tabs opened on the last build talk to servers on the next one, and the wire had no way to say either "a newer build is out, reload when it suits you" or "this server no longer speaks your protocol, reload now", nor to tell two codecs apart on one path. A host now says its `build` (an opaque string) in every welcome, and `openRemote({ build })` says the page's in its hello: a page on another build keeps working and `remote.onBuild(listener)` is told once, at once for a listener added after it was noticed. A host with `minProtocol` answers a hello on an older protocol with `{ t: "reload", reason, protocol }` and nothing else, so its calls are refused until it says hello on one served. `openRemote` then writes every call not yet answered to its `carry` (`{ storage, key }`: `sessionStorage` in a page, a `Map` in a test), calls `reloadPage` (`location.reload()` in a page by default), and the next `openRemote` with the same `carry` offers them again once open, under the batch each was sent in; without `carry` they are refused in words before the reload. Every hello says `wire: "graview.ship"` (`LIVE_WIRE`), and a hello naming another wire is answered `error` and not welcomed. The WebSocket subprotocol `graview.ship.1` (`LIVE_SUBPROTOCOL`) names the codec on the upgrade: `serveStore` answers it, a Worker answers it with `liveSubprotocol(request)`, the `socket` factory is handed it as a third argument, and the platform socket sends it with `subprotocol: true` — off by default, because a browser fails the handshake with a server that does not answer it. `LiveSocketState` keeps the `build` a hello said, for a host to count (FR-44). `capabilities().shipped` names FR-44.
  
  Compatibility: wire additive — a new server message `reload`, new `hello.wire` and `hello.build`, and new `welcome.wire` and `welcome.build`; a server ignores the hello fields it does not know and a client the messages. `WIRE_PROTOCOL` stays 1: nothing a protocol-1 client sends or reads changed meaning, and moving it is exactly what `minProtocol` turns into a `reload` for every open tab, which only a change no old client can be served through should cost. `minProtocol` is absent by default, so every protocol is served as before. New exports from `@graview/ship`, `@graview/ship/runtime` and `@graview/ship/browser`: `LIVE_WIRE` and `LIVE_SUBPROTOCOL`; from `@graview/ship` and `@graview/ship/runtime`: `liveSubprotocol` (additive). `RemoteOptions` gains `build`, `carry`, `reloadPage` and `subprotocol`; its `socket` factory is handed a third argument, `protocols`, which a two-argument factory ignores. `RemoteStore` gains `onBuild`; `LiveProtocolOptions` and the handler options gain `build` and `minProtocol` (additive).
- Updated dependencies [c3683bb]
- Updated dependencies [1ba2ab7]
- Updated dependencies [5ea9572]
- Updated dependencies [a65423f]
- Updated dependencies [8e76788]
- Updated dependencies [c2ed1f8]
- Updated dependencies [5ea9572]
- Updated dependencies [50beae9]
- Updated dependencies [625ac82]
- Updated dependencies [f4a1f72]
- Updated dependencies [ca3c327]
  - @graview/core@0.1.3

## 0.1.2

### Patch Changes

- b910210: A live wire. `openRemote({ live: true })` holds a WebSocket to the store's `/graview/live` and every op is pushed down it as it lands, so two browsers on one store see each other at once rather than on the next poll. Calls and undos go down the same socket. While it is down, the client polls and posts as before, reconnects, and catches up from the last op it has; a call sent again across a reconnect is answered with the ops it already made, not made twice. Polling stays the floor: every HTTP route is unchanged, and a polling client on the same store converges with the live ones.
  
  The protocol is JSON messages told apart by `t`. A client says `hello` (with the last seq it has), `call`, `undo`, `here` and `bye`; the server says `welcome` (the ops after that seq, or the whole state when no seq was given), `ack`, `refused`, `conflict`, `ops` and `presence`. `hello` and `welcome` carry `WIRE_PROTOCOL`, which stays 1: the socket is an addition, and every client of protocol 1 is still served. `LIVE_PATH`, `LiveClientMessage` and `LiveServerMessage` name it. The protocol logic is transport-agnostic: `createStoreHandler(...).connect(request, { send, close })` reads the seat from the upgrade request and answers with the connection to hand each message to, so a Worker or Durable Object attaches a `WebSocketPair` to it. `serveStore`, and so `graview serve`, answers the upgrade over a small RFC 6455 server in the package, with no new dependency. What a seat may not see holds on the socket exactly as on the routes: the welcome, every push and every answer are the store as that seat sees it, with ops withheld in place, and presence keeps unseen people back. A page cannot set headers on a WebSocket, so a store that trusts seat headers also reads them from the upgrade's query.
  
  A stale write is a conflict, not a loss. Every field's revision is the seq of the op that last wrote it, read off the log by `FieldRevisions`, so no stored format changes. A call may carry `base`, the revision of each field it changes as its sender last saw it. One that has moved since is refused before anything is written, on `POST /graview/ops` (409 with `conflict: true`) and on the socket (`conflict`), naming the field, theirs, yours and who wrote theirs. `openRemote` sends `base` with every optimistic call and hands a refused one to `onConflict` with `keepTheirs()` and `useMine()`; with nobody listening there, `onRefusal` hears the sentence. A call the policy refuses, or one that no longer runs, is refused in its own words as before. `openRemote` also gains `revision(node, field)`, `seq()` and `transport()`, and an answer whose ops start past the next seq it has now fetches the ops between first, so a client never numbers the server's ops out of order (FR-05).
  
  Compatibility: additive for the wire — `GET /graview/live` is a new `WIRE` route (426 to a plain request), `base` is a new optional request field on `POST /graview/ops`, the 409 for a stale write adds `conflict` and `conflicts`, and `WIRE_PROTOCOL` stays 1. Unchanged for ops and stored formats: field revisions are derived from the log, and no fixture differs. Changed for `openRemote` callers, `graview mcp --remote-url` and `graview apply --remote-url` among them: a change to a field somebody else changed since the client last looked is now refused as a conflict rather than written over theirs. `StoreHandler` and `ServedStore` gain `connect`; `RemoteOptions` gains `live`, `socket` and `openTimeoutMs`; `RemoteStore` gains `onConflict`, `revision`, `seq` and `transport`.
- 74c9388: A log can be folded from a base. An `Epoch` is a base graph and the seq where the log starts folding onto it. The log carries its epochs: `OperationLog.from(ops, epochs)`, `log.epochs()`, `log.lastEpoch()` and `log.markEpoch(epoch)`. `log.fold(schema, { from: epoch })` folds that epoch's base with the ops from its seq on. A store takes `epochs` beside `log`, and `store.verify()` folds from the last epoch, so a log that spans two declaration versions verifies. A store opened on a snapshot alone takes the snapshot as its first epoch. Undo does not reach back across an epoch that changed the declaration, and the refusal names the change.
  
  `openStore` records an epoch whenever the graph it opens on did not come from the log. A new scope gets one at its seed, and a migration run gets one at the graph it left, naming the change. A store from before epochs gets one at what it holds, or from empty when its whole log folds to it. The opened store says which in `epoch`. Adapters keep epochs through the new optional `loadEpochs` and `saveEpochs`. The memory and file (`epochs.json`) adapters have them. The browser adapter does not: each epoch keeps a whole copy of the graph, and a page has no room for a second one. A store from before epochs is adopted only where its epoch can be kept, so a page never folds its whole log on open. The sqlite adapter does not keep them yet (FR-27).
  
  Compatibility: stored format — additive. Epochs are stored beside the snapshot, log and meta, and no format number moves: a store without them reads as before and is given one on open. Ops and primitives are unchanged; `OperationLog.from` and `fold` take new optional arguments. Undo of an op made before a migration, which used to write the old shape back, is now refused.
- a7fc818: A long-lived log compacts behind an undo horizon. A checkpoint is an epoch whose base is the graph at seq N, marked `horizon: true`. `store.checkpoint({ keepDays, keepOps, seq, now })` makes one, by default keeping the last 90 days and the last 1000 ops, whichever keeps more, and never splitting a gesture; a store that does not verify is not compacted. `store.compact(checkpoint)` moves the ops and epochs before it out of the log and returns them. A log now begins at its horizon: `log.horizon` is the seq of its first op, `log.length` is still the seq the next op takes, `log.opsFrom(seq)` reads by seq, `OperationLog.from(ops, epochs, { horizon })` restores a log that begins past 0, and one that begins past 0 with no checkpoint or horizon is refused, naming the seq. `log.checkpointAt(schema, seq)` and `log.fold(schema, { to })` give the graph at a seq. Undo of a batch behind the horizon is refused with a sentence naming it ("not after the undo horizon at op N").
  
  Adapters archive through the new optional `compact(scope, checkpoint)` and `loadArchive(scope)`. The memory adapter keeps the archive beside the log. The file adapter writes `archive/log.jsonl` and `archive/epochs.json`. The SQL adapter now keeps epochs (`graview_epochs`) and archives ops to `graview_ops_archive`, both created on demand like its op table, and `delete` now clears a scope's ops, epochs and archive with its graph. The browser adapter keeps no epochs, so it keeps no checkpoint: compaction there is refused, and a page's log stays whole. `opened.compact(options)` archives first and then lets the store go of the ops, on the write chain. The next `openStore` loads the checkpoint and the tail and never reads the archive. `exportBundle(app, store, { full: true })` resolves to a bundle with every op from seq 0, read from the archive of the adapter the store was opened on. Without `full`, a compacted store's bundle carries the tail and says where it begins in `horizon`. `/graview/state` and the live socket's welcome say `horizon` for a compacted store, and `openRemote` hands it to the client's store (FR-23).
  
  Compatibility: stored formats — additive, and no format number moves. Snapshots and ops are written as before; an epoch gains the optional `horizon` field, and the archive is new files and tables beside the ones a store already has. A store that was never compacted reads and writes exactly as before. A build before this one refuses to open a compacted store rather than misreading it: its log no longer begins at seq 0, and that build's `OperationLog.from` throws on the first op. Ops and primitives are unchanged; `OperationLog.from` and `fold` take new optional arguments, and a log that begins past 0 without a horizon, which used to fail on its first op, now fails naming the seq. The wire — additive: `/graview/state` and the live welcome's `state` carry `horizon` only for a compacted store, and `/graview/since?seq=N` answers by seq as before.
- 230d9b4: A rule can say what must hold in words the framework judges: `quote != null`, `count(in('fills') where status == 'booked') <= 1`. `@graview/core/document` is a new entry, and its rule language has these properties:
  - Fields and one-edge hops, `out`/`in`/`all` sets with `where`, and a closed set of functions.
  - `null` that propagates.
  - No regular expressions, loops or user functions.
  - A step budget on every evaluation.
  
  `expressionRule(name, { over, require, when?, says?, repairs? })` makes the invariant the engine runs. A judgement that runs out of budget is `over-budget` (FR-29), and any other mistake is `could-not-judge`; neither is a hang.
  
  A rule in the studio now takes its judgement as a field. The studio judges it after apply, writes it into the checkout as `expressionRule(…)` with its import instead of a stub to fill in, and reads it back from a declaration whose invariant carries `judgement`. The seedbed rehearsal proves this end to end (FR-07).
  
  Compatibility: the declaration — additive: `InvariantDefinition.judgement` and a studio rule's `require`/`when`/`says` are optional; a rule without one is judged as before. `@graview/core/document` is a new entry point.
- 4a5dadd: A store holds records that no longer fit while still checking new writes. Loading a graph holds every record as it was stored: nothing is parsed into something else, no default is filled in, no field is stripped, and a record an older declaration wrote no longer stops the store from opening. `store.findings()` says what does not fit. Writes are still held to the declaration: a node added must fit, an edge must be declared, and a patch must fit in what it writes and may not leave the record fitting less than before. A misfit the patch does not touch stays as stored, so renaming a record is not refused over an old field. Folding a log holds an op the current declaration refuses as it was written. Undoing a change that was not an act, such as a repair or a migration, puts back exactly what it took, misfits included, while the undo of an act is still refused when the declaration will not have it. `Graph.applyPrimitives` and `Graph.preview` take `{ restoring }` for primitives that put back what was there (FR-28).
  
  Compatibility: stored format — snapshot 1 and op 1, unchanged; a snapshot that used to be refused at open now opens, and nothing at open rewrites a record. Ops and primitives: a fold no longer throws on an op the declaration refuses, and holds it as written instead. `GraphOptions.validate` now checks writes only, not loads; `ApplyPrimitivesOptions` is new.
- 7afb9ae: A store can prove its own fold. `snapshotHash(snapshot)` is the graph's fingerprint, `sha256:<hex>` over a canonical form: nodes by id, edges by identity, keys sorted. Node, edge and key order do not change it, and it runs in a page or a worker as well as in Node. `store.verify()` refolds the log and compares. It returns `{ ok: true, hash }`, or the two hashes, the op after which they part (`divergedAfter`) and the finding in a sentence.
  
  `openStore({ verify: true })` verifies on open. When the stored graph disagrees with its log, the graph is rebuilt from the log and saved, and the opened store reports `rebuilt: { from, to, divergedAfter }`. If the log does not fold, there is nothing to rebuild from, so the open refuses (FR-20).
  
  Compatibility: additive — `snapshotHash`, `VerifyResult`, `Store.verify()` and the `verify` option are new; `OpenedStore` gains optional `verified` and `rebuilt`. Stored formats and the wire are unchanged.
- 539d0eb: An adapter over plain SQL. `createSqlAdapter({ sql, transaction? })` keeps a store in SQLite through one synchronous `exec(sql, ...params)`, the shape a Durable Object's `ctx.storage.sql` already has, so a Worker host passes it as it is. `sqlFromDatabase(db)` gives better-sqlite3 the same shape, and `createSqliteAdapter` is now that adapter over better-sqlite3, so one implementation holds for both. The adapter tests are one contract that runs against memory, better-sqlite3 and Durable Object storage in workerd (FR-09).
  
  Compatibility: unchanged — the tables, their columns and what is stored in them are as before. `createSqliteAdapter` now prepares its statements on first use rather than when it is made, so a missing table is reported by the first load or save.
- 33c3cbb: An agent acts for someone, through something, and the log says so. An `Author` carries its own `name` and `onBehalfOf`, the person it acts for. An op carries `via`, what it came through: `web`, `mcp:<client>`, `view:<name>`, `api` or `cli`. The activity rail reads "Claude, for Nick, via Claude", and `nameOfAuthor` says an author's own name before any id.
  
  An agent acting for a person may do what both may: its roles are the intersection of its own and theirs, a `self` grant is about the person, and `actingAs` gives the seat a policy judges. A `system` principal acting for nobody passes the policy and sees every record (`isSystem`), so a host's setup, seed and migrations are not refused by the app's own grants (FR-06, FR-17).
  
  A served store believes a seat header only when told to. `serveStore({ trustSeatHeaders: true })` reads `SEAT_HEADERS`, now with kind, name and delegation, so a remote `graview mcp` is recorded as an agent. Without it and without a `seatOf`, every route but health answers 401. `graview serve` listens on 127.0.0.1 and trusts the headers there, saying so; on any other `--host` it will not start without `--trust-seat-headers`. `openRemote` sends its seat on every request, the first read included, and its calls say `via: "web"`.
  
  Compatibility: breaking for a host that served a store without `seatOf` and relied on the seat headers: it now answers 401 until it passes `trustSeatHeaders: true`. `graview serve` binds 127.0.0.1 by default where it used to bind every interface. Additive elsewhere: `Author.name`, `Author.onBehalfOf`, `Principal.onBehalfOf`, `Operation.via` and `ApplyOptions.via` are optional fields, and ops without them read as before.
- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- 3b36d19: An optimistic client can roll back through public API. `store.rebase({ confirmed, pending, drop })` rolls back this store's pending batches, lands the server's ops in its order, and applies the pending calls again on top under the same batch ids, author and intent; a call that no longer applies there is left off and named in `refused`. Subscribers hear one change, the net diff. `store.notify(diff, ops)` is public, for a host that changes the graph some other way and owes its subscribers the same news. A store's default batch ids carry a tag drawn fresh for each store (`batch:<tag>:<n>`), so two stores opened from the same log never mint the same one, and `batchIds` lets a server mint its own. `openRemote` lands everything the server sends through `rebase`, so an answered press's provisional op is replaced by the server's, not kept beside it, and a refused one is dropped rather than undone. This is the store's half of the optimistic live client; the live wire follows.
  
  Compatibility: additive for ops and stored formats — `Store.rebase`, `Rebase`, `RebaseResult`, `StoreOptions.batchIds` and `OperationLog.truncate` are new, and `Store.notify` is now public. Changed for callers of `Store`: default batch ids read `batch:<tag>:<n>` and `undo:<tag>:<n>` rather than `batch:<n>`; nothing should parse them. Changed for `openRemote`: a browser's log holds the server's ops for its presses, not the provisional ones and a take-back beside them. The wire is unchanged.
- c6bd456: Migrations keep what they can. Ship's steps gain three:
  - `rename-field` moves every value to the new name.
  - `rename-edge` moves every link, on every kind that declares the relation.
  - `coerce-field` keeps a value wherever its meaning survives and clears, and counts, what does not:
    - text to a number when it parses;
    - a datetime to a date;
    - a word to the option it names;
    - a value to a list of one.
  
  `countSteps` says per step how many values moved, were converted or were cleared, and how many records and links went. Whether a change breaks anything is judged by these counts, not by the kind of edit.
  
  The studio's migration sees a field or relation it renamed or retyped as the same one, by its node, so its values move instead of being dropped and re-added. A document's `planMigration` does the same through `renamedFrom`. `graview check --document <file> --previous <file>` refuses a `renamedFrom` that names nothing in the version before (FR-22).
  
  Compatibility: stored format — unchanged; migration steps — additive (three new steps). The declaration — `renamed-from-nothing` is a new check finding code, given only with a previous version.
- 6c54eb1: Modules reach the host. `enabledModules` was a store option nothing passed, so a host binding a workspace's modules to what it pays for had nowhere to say so, and a served store sent every record of a module the workspace did not have. `openStore`, `createStoreHandler` and `serveStore` now take `enabledModules`, and `openRemote` takes it for a server that does not say. `GET /graview/state` and the live wire's `welcome` say which modules are on in `enabledModules`.
  
  Turning a module off or on is an op. `store.setEnabledModules(enabled)` appends one op authored `system · modules` (`MODULES_AUTHOR`), with a sentence ("Turn off Vehicles") and the set it leaves in `Operation.enabledModules`. It touches no record, so it folds to nothing, and turning the module on again brings every record back as it was. `store.modules` is now read from the log: the set the last such op says, or the one the store was opened with. `openStore` writes the op when the host's set differs from the log's, and only then. `checkUndo` refuses to take one back, because the set changes by turning the module the other way.
  
  A module off is off on every route and tool. Its acts were already refused. A call that names one of its records is now refused too, whoever makes it. Its kinds are kept from every seat but the system, the way a sight keeps a record: `seenBy` leaves them out of the graph, its ops are withheld in place on `/graview/state`, `/graview/since`, `/graview/export` and the live wire, and the agent tools read through the same view. `hidesFrom(store, principal)` says whether anything is kept from a seat (FR-12).
  
  Compatibility: additive for ops: `Operation.enabledModules` is a new optional field, an op without it reads and folds as before, and no fixture differs. Additive for the wire: `enabledModules` is a new response field on `GET /graview/state` and the `welcome` state, and the options are new. Changed for `seenBy(store, principal)` on a store with a module off: it is now a view without that module's kinds, where it used to be the store itself. `Store.modules` is a getter rather than a field fixed at construction. Stored formats and derived tool schemas are unchanged.
- 67a7d42: Stored data is checked against its declaration. `validateGraph(app, snapshot)` reads a graph as it is stored and says what no longer fits, each finding with a code, an id and its smallest repair: `node-shape`, `kind-unknown`, `edge-dangling`, `edge-disallowed`, `rule-error` and `rule-budget`, the last two read off a violation's `status` rather than its words. A clean graph has none. `repairPlan(findings)` turns the findings into one batch that clears an optional field, coerces a required one to its default, or drops a record with its links, and says the plan in counted sentences. `store.applyPrimitives(primitives, { author, intent })` applies a batch of primitives as one ordinary op, logged, attributed and undoable, and `store.findings()` validates the store's own graph. `health()` counts the findings (FR-21).
  
  Compatibility: additive — `validateGraph`, `repairPlan`, `GRAPH_FINDING_CODES`, `Store.applyPrimitives`, `Store.findings` and `HealthReport.findings` are new. The six finding codes are a stability surface from now on: a code never changes meaning (docs/stability.md §4).
- 6c62ca6: Stored formats carry their version. Core declares `FORMATS` (snapshot 1, op 1) and stamps what it writes with `formatStamp()`: the framework version and each format. `upgradeSnapshot` and `upgradeOp` bring an older format up one step at a time, and `assertReadable` throws `NewerFormatError` for a format this build does not know.
  
  A store's meta and every exported bundle now record `{ framework, formats }`. `openStore` refuses a snapshot whose meta says a newer format, so a rolled-back framework does not fold what its successor wrote and write its misreading back; the host refolds from the log or rolls forward. `assertBundle` checks the same. Everything written before the stamp reads as format 1, and a fixture of it is held by a test (FR-31).
  
  Compatibility: stored format — snapshot 1 and op 1, unchanged. Store meta and bundles gain `framework` and `formats` (additive; an unstamped one reads as format 1). A meta or bundle stamped with a newer format is now refused with `NewerFormatError` where it used to be read as if it were current.
- 984c96f: The declaration is a document. One JSON object, the Graview declaration document, compiles into the same app `defineApp` declares, through `compileDocument` in `@graview/core/document`.
  - **Kinds** have typed fields, label templates, lifecycles and relations.
  - **Acts** are a closed set of effects with `allowedWhen` refusals.
  - **Rules** are written in the rule language.
  - **Policy, modules, lenses and settings** are the data they already are.
  
  Nothing in the document path runs a string as code, and a test reads the module to hold that. `canonicalize` gives two documents equal in meaning the same bytes.
  
  `toDocument(app)` gives a document-made app back exactly. For a TypeScript app it writes what is data and names, at its JSON path, each surface that is code.
  
  `graview check`, `serve`, `mcp` and `describe` take `--document <file>` with no TypeScript entry, and check reports a document's findings with the path to fix each at. `capabilities().documentFormats` says `graview-document@1` (FR-01).
  
  Compatibility: the declaration — additive: a new entry point, a new format (graview-document 1), and `--document` on the commands; a TypeScript declaration is read as before.
- ca11fe8: `GET /graview/export` returns the bundle instead of a 500: the route called `exportBundle(store, app)` against `exportBundle(app, store)`, behind two casts that hid it from the compiler. The casts are gone and a serve test holds the route (FR-11).
  
  Compatibility: the wire — `GET /graview/export` now answers as `WIRE` always said it did; nothing else on the wire changes.
- b71e7c5: Core says its own version, and a rule that cannot answer says so in a field. `FRAMEWORK_VERSION` is the version every `@graview/*` package shares, written by `pnpm version-packages` after `changeset version`. A violation carries `status`: `violated` when a rule judged, `could-not-judge` when it threw, `over-budget` when it threw the new `RuleBudgetError`. A rule that throws is now one finding about its subject instead of an exception that took every other rule's standing down with it. `health()` counts `couldNotJudge` and `overBudget` apart (FR-29).
  
  Compatibility: additive — `Violation.status`, `HealthReport.couldNotJudge` and `.overBudget` are new fields; a rule that throws no longer makes `evaluate` or `Store.apply` throw, it yields a violation instead.
- b334c25: The wire answers through a fetch handler. `createStoreHandler(options)` opens the store and returns `handle(request: Request) → Promise<Response>` for every `WIRE` route, so a Cloudflare Worker, a Durable Object, Deno or Bun serves the same store without a fork. `serveStore` is now a thin `node:http` wrapper around it and answers exactly as before: the 401 rule, CORS, presence, export and health.
  
  `@graview/ship/runtime` is a new entry that reaches no `node:` builtin: the store, migrations, content steps, the handler, export, health and `openRemote`. The browser entry stays what a page runs; the root entry keeps the file adapter and the server (FR-09).
  
  Compatibility: breaking for a host with its own `seatOf` — it now receives a web `Request` instead of Node's `IncomingMessage` (read `request.headers.get("authorization")`, not `request.headers["authorization"]`), and may return a promise. `seatFromHeaders` takes a `Request` too. The routes, their bodies and `WIRE_PROTOCOL` are unchanged; `ServedStore` gains `handle`.
- 6460336: What a seat may not see never leaves the store. The store handler, and so `graview serve`, answers each route with the store as the asking seat sees it. `/graview/state`, `/graview/since`, `/graview/export` and the ops on `/graview/here` come from `seenBy(store, principal)`, and ops that touched what the seat may not see come back withheld in place, so an unmodified `openRemote` still loads them (FR-16). `/graview/here`, `/graview/who` and `/graview/leave` leave out anybody whose own record the seat may not see. For everybody else they clear a stop, hover or robot position that names such a record (`presenceSeenBy`). The ops `/graview/ops` sends back are redacted the same way. A participant whose id holds a colon (`shopper:bethan`) now keeps its session as sent.
  
  A write that names a record the seat may not see is refused before any grant is read, with the sentence "Not permitted: “Answer the enquiry” names a record you may not see." This holds in `store.apply` and `store.permits`, over the wire and through the agent tools. A seat with sights may not undo what it may not see. Over `graview mcp`, `get_affordances` is derived from what the seat sees, and `undo_batch` judges over the log as the seat sees it.
  
  Sights have one meaning, the document's and the framework's, and `compileDocument` puts a document's `policy.sees` into the compiled app's policy. With no `sees`, everybody sees everything. With any sight, every kind is deny by default, like grants: a kind no sight names is seen by nobody but the system, and the new check warning `sight-unnamed-kind` names each one. `own` means the principal's own records: their record, what an edge joins to it, and what they made. `recordsOf(log)` reads who made each record and its kind, so a removed record is still judged by the kind it was. The studio models a sight as a node with three acts, `add-sight`, `change-sight` and `remove-sight`, and writes sights back into the declaration and `policy.ts`. Changing them in place is still said rather than written, as it is for grants (FR-02).
  
  Compatibility: breaking for a policy that declares `sees`: a kind no sight names used to be seen by everybody and is now seen only by the system. Add `{ roles: "*", kinds: [...] }` for the kinds everybody may see; `graview check` names each one with `sight-unnamed-kind`, a new warning. Additive for `own`, which now also covers the records a principal made. Breaking for a host that relied on the wire sending the whole store: every read route now answers with what the asking seat sees, and only the system seat sees everything. A host that serves its owners everything serves them as the system or names them in a sight. Additive for the wire otherwise: no route or field was added or removed, and `WIRE_PROTOCOL` stays 1. Changed for derived tools: the names and input schemas are unchanged, the studio gains `add-sight`, `change-sight` and `remove-sight`, and the read and undo tools answer as the seat sees. For the declaration document, `policy.sees` now takes effect in the compiled app, and the conformance fixtures declare no sights, so none of them changes.
- Updated dependencies [3afdd09]
- Updated dependencies [b910210]
- Updated dependencies [7f354e0]
- Updated dependencies [74c9388]
- Updated dependencies [a7fc818]
- Updated dependencies [2820fd3]
- Updated dependencies [230d9b4]
- Updated dependencies [a163197]
- Updated dependencies [4a5dadd]
- Updated dependencies [7afb9ae]
- Updated dependencies [9b2c61b]
- Updated dependencies [8990aa9]
- Updated dependencies [539d0eb]
- Updated dependencies [33c3cbb]
- Updated dependencies [95444f1]
- Updated dependencies [55f8b27]
- Updated dependencies [6ea13f7]
- Updated dependencies [3b36d19]
- Updated dependencies [85888f1]
- Updated dependencies [d2683c5]
- Updated dependencies [5a6f262]
- Updated dependencies [c6bd456]
- Updated dependencies [6c54eb1]
- Updated dependencies [67a7d42]
- Updated dependencies [6c62ca6]
- Updated dependencies [5e85a39]
- Updated dependencies [b2f8c22]
- Updated dependencies [984c96f]
- Updated dependencies [b71e7c5]
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [e0c8cac]
- Updated dependencies [e1b9f5c]
- Updated dependencies [cbdd94a]
- Updated dependencies [097d684]
- Updated dependencies [a1859c5]
- Updated dependencies [1df48c8]
- Updated dependencies [ccfe1cd]
- Updated dependencies [c307981]
- Updated dependencies [fa8bd61]
- Updated dependencies [32ea5ac]
- Updated dependencies [d76a957]
- Updated dependencies [b535cb2]
- Updated dependencies [6b297f0]
- Updated dependencies [414ddde]
- Updated dependencies [a575ca9]
- Updated dependencies [f1cf758]
- Updated dependencies [6966a4e]
  - @graview/core@0.1.1

## 0.1.0

### Minor Changes

- b5e95a1: The first public release, 0.1.0, under the Elastic License 2.0.
  
  `graview` is the tool and `@graview/*` is the framework. The command line is
  its own package now: `npx graview create my-app` from nothing, and inside a
  project `graview check`, `graview docs`, `graview describe`, `graview lens`,
  `graview figure`, `graview serve` and `graview skills`. The `graview-serve`
  and `graview-skills` bins are gone — `serve` and `skills` are subcommands —
  and `@graview/core` no longer carries a bin of its own. A scaffolded project
  takes `graview` as its devDependency in place of `@graview/skills`, and
  `create-graview` (what `npm create graview` runs) depends on `graview`.
  
  Every package moves in lockstep from here, so the `^<version>` range
  `graview create` writes for each `@graview/*` dependency is always one that
  exists.

### Patch Changes

- b7f83cc: A migration is data, and the studio writes it. `stepsMigration({ from, to, steps })` in `@graview/ship` turns declared steps — a kind gone or renamed, a field dropped or started, an edge removed or MOVED — into primitives against the stored graph when it opens; a moved edge is carried to the records of its new kind tied to each old end (a gardener who tended a plot tends each planting in it). The studio's `migrationSteps` sees a relation declared on another kind as a move, says it before Apply, and writes it into the app's `defineApp` through the studio door (`add-migration`: the version moved on, the migration appended, its import added), so a stored graph is carried forward, logged and undoable, the next time it opens.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- b1fbc32: Default content moves without a wipe. The step DSL gains five content steps beside the schema ones — `put-node`, `patch-node`, `drop-node`, `put-edge`, `drop-edge` — each judged against the stored graph at the moment it runs, so a record already there is not put twice and a patch that changes nothing says nothing. `primitivesForSteps` now runs steps IN SEQUENCE, each seeing the graph as the ones before it leave it, which is what the studio already assumed when it renamed a kind and then spoke of its fields by the new name, and what a content run needs to put a record and tie it in one breath.
  
  `seedSteps(seed, live)` diffs a bootstrap seed against a live snapshot into those steps — missing records put, fields the seed sets patched, missing ties made, and nothing dropped unless `prune` is asked for by name — and `applySteps(store, steps)` lands them as ONE operation authored `system · ship:sync-seed`, logged with its inverse, so undo is the ordinary undo. `graview sync-seed <entry> --seed <file> [--data|--sqlite] [--apply] [--prune] [--json]` is the command: it prints the steps as sentences and writes nothing until `--apply`. The seed is read once, into an empty store, and the README now says so; `fresh` is a demo's way back to the example, not the redesign tool.
  
  `graview serve` and `sync-seed` parse their store flags through one `backendFrom`, and `loadApp` is exported from `@graview/core/cli` so the packages that load an entry load it the same way.
- 0c320d9: Persistence you can open. `graview serve <entry>` hosts an app's store behind HTTP with the op log as the wire: a client sends CALLS — never primitives — and the server applies them through an ordinary `Store` under the principal the request carries, so the same policy refuses the same act there that refuses it in a browser, with the same sentence. Data is a directory of `snapshot.json`, a `log.jsonl` a person can grep, and a `meta.json` holding the stored version; `--sqlite <file>` swaps the adapter and changes nothing else. Migrations run on the server, once, against the stored graph. `/graview/health` says which adapter is keeping the data and where.
  
  `openRemote` is the other end: a real `Store` in the browser whose calls go to the server and whose graph receives everybody else's ops on a poll. A call applies optimistically and a refusal takes it back — leaving a hopeful change on screen would mean showing a graph the server does not have.
  
  `Store.receive(ops)` is the new core primitive underneath it: operations somebody else already judged and compiled, landing with their own id, author and intent, renumbered into this log's order and announced to subscribers exactly like a local change. Three things had to be right for two writers to converge rather than diverge — a foreign op must not be re-judged (it would ask about the wrong principal), must not be re-minted (two stores both start at `op1`, so a client silently dropped the server's op as one it already had), and must not carry the sender's sequence into a log that is contiguous by construction.
  
  Rota runs this way with `?server=…`; the launcher's capability list now answers "server-side persistence" from the declaration rather than by assertion.
- 30adc63: The studio's whole path is rehearsed on a real checkout (`pnpm studio:rehearse`: a scratch copy of seedbed, "people should be assigned to plants not plots" said to the seat, kept, rewritten, written, compiled, checked, and a stored garden opened with its caretakers carried onto its plantings) — and what the rehearsal found is fixed. Keep all judges the seat's proposals by what they make together, so "remove the edge, add it to the planting" is not refused for its first half. A name declared more than once is edited where the app exports it, not in a chapter's local copy. The studio door writes the file that declares the app, and so its migration, last, so a dev server reloading between writes never runs a migration against the schema it was not written for. A removal is described before it lands.
- 0c0fa22: "Remove this field" survives being written down. A patch said it by carrying the key with the value `undefined`, which JSON drops — so every persisted op that cleared a field came back with an empty half and the inverse it promised did nothing at all. Undoing a migration that added a field, after a reload, reported success and changed nothing. `UNSET` is that instruction as a value now, normalised into every operation on its way into the log, and both appliers read it.
- 8a2fdf2: The code a declaration change leaves wrong is rewritten in the studio before anything is written. The studio door reads the checkout's acts and rules (`GET …/source`, `declaredCode`), replaces, adds and removes them in place (`replace-act`, `add-rule`, …), and compiles the app with the edit laid over its files (`typecheckWith`) before a byte lands, refusing with the compiler's own words. `sourceChanges` names each act or rule whose declaration changed, `codeTouched` each one whose code mentions what moved or went, and Apply puts every one of them in front of the person — editable, with "Ask the seat to rewrite it" (`rewriteCode`, the configured model) and "It still holds as written" — writing only once each is settled.
- 53ad439: The hosted-store contract is written down. `WIRE`, exported from `@graview/ship`, names every route `serveStore` answers with its method and one sentence, and a test walks it; `SEAT_HEADERS` names the headers a request carries its seat in. `openRemote` takes `headers` — sent with every request, never read by the framework, the seam where a host's own credential goes — and exposes `settled()`, which resolves once every call sent so far has been answered; the server's CORS allows `authorization`. And a server's op for a change this client already applied provisionally is now RECORDED rather than re-applied (`store.receive(ops, { applied: true })`): an optimistic add followed by the server's own op used to throw a duplicate-node error out of the wire and be reported as a refusal.
  
  The README carries the concern table — op log, snapshot and migrate on open, the wire, a principal on every apply, the seed at first install, content steps and the agent's door in the framework; auth, tenancy, quotas and fleet upgrades in a host — so a third party stands up their own host without forking anything, and Graview Cloud is the polished multi-tenant host of the same API. `graview docs` now writes an "Attaching an agent" section into llms.txt and an "Evolving a live store" checklist into agents.md; the `graview-agent-seat`, `graview-ship`, `graview-node-kind` and `graview-permissions` skills say the same; and a project from `graview create` has `serve` and `mcp` scripts and ignores `data/`.
- e9e495f: The decision provider itself. `jevDecide({ apiKey | baseUrl, … })` in `@graview/tools` is one `Decide`: one state and a MAP of typed questions in, typed answers under the same keys out — so a node's whole unset half is one request rather than one per field. 429 and 529 are retried with backoff (injectable); 401 is thrown as the SEAT's problem and 422 as OURS, each said in those words, because blaming the model for a bug in the derivation would send somebody looking in the wrong place. An answer that is not typed, or missing, is refused rather than guessed. The key is read from the environment by `jevKeyFromEnvironment()` — `TYPESAFE_API_KEY`, then `JEV_API_KEY` — travels in one header, and appears in no error. Usage is metered per call and in total (`onUsage`), and `jevCostUsd` prices input tokens at the published rate; output is unmetered.
  
  A browser must not hold a service key, so `@graview/ship/dev` gains `decisionBridge()`: a dev-server door at `DECISION_BRIDGE_PATH` (`/__graview/decide`) that holds the key from the server's own environment, forwards a page's state and questions, and hands the provider's own status back so the page-side provider tells failures apart the same way. Same-origin only; the key is in no response. The contract (`DecisionBridgeStatus`, `DecisionBridgeAsk`, `DecisionBridgeAnswer`) lives in `@graview/core` beside the local door's.
- be9fb19: The studio writes a declaration change into the checkout, in place. `studioDoor()` from `@graview/ship/dev` is a dev-server door (contract `STUDIO_DOOR_PATH`, `DeclarationChange` in `@graview/core`) that takes the CHANGE — a kind, field or edge added, changed, removed or moved, a kind's description, plural or figure — and makes it inside the checkout's own `defineNode` calls with `editDeclaration`, leaving every comment, function and body it does not touch exactly where it was; all or nothing, and only ever the files in its own `src/domain`. `studio.sourceChanges()` says the change that way, and what it cannot say yet (acts, rules, policy, a migration) as reasons; Apply writes through the door when it answers and hands over the files, with the reasons, when it does not. `graview create` projects open the door in development. `@graview/ship`'s doors share `door.ts`: who may knock, how much they may send, the plugin's shape.
- 59cef8c: Who is where. Other people stand on your map at the plot their stop focuses, in the audience row of the showing they are watching, with their robots beside them captioned as theirs and the thing they point at outlined in their hue — placed by each viewer's own `whereIs` from a presence payload that is never a pixel and never enters the op log. `PresenceChannel` has two implementations in ship: a BroadcastChannel between tabs of one origin, beside the browser adapter, and two routes on the served store folded into the poll the remote store already makes. A per-tab session fills `Author.session` on a tab's ops and its presence key alike. Clicking a figure follows that person until you move yourself or press Escape; sharing is a reader setting in the profile pane; an embed broadcasts nothing unless handed a channel. `openRemote` now carries `applyAll` and `undo` to the wire.
- Updated dependencies [fb781c2]
- Updated dependencies [390028c]
- Updated dependencies [bff0b71]
- Updated dependencies [400a6df]
- Updated dependencies [c7a3519]
- Updated dependencies [09a23a3]
- Updated dependencies [92a2f73]
- Updated dependencies [509162f]
- Updated dependencies [3f86b09]
- Updated dependencies [188bc6e]
- Updated dependencies [1ebfd44]
- Updated dependencies [a23e496]
- Updated dependencies [e0d5026]
- Updated dependencies [41abe03]
- Updated dependencies [e165c5b]
- Updated dependencies [b7f83cc]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [8041853]
- Updated dependencies [b9b0635]
- Updated dependencies [5e6d4e7]
- Updated dependencies [03b9c5a]
- Updated dependencies [5297528]
- Updated dependencies [959955f]
- Updated dependencies [22e0668]
- Updated dependencies [9b3a623]
- Updated dependencies [5a00a1f]
- Updated dependencies [887d768]
- Updated dependencies [2c25067]
- Updated dependencies [b1fbc32]
- Updated dependencies [d907771]
- Updated dependencies [b5e95a1]
- Updated dependencies [7a61e87]
- Updated dependencies [a5d842b]
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
- Updated dependencies [0c0fa22]
- Updated dependencies [8a2fdf2]
- Updated dependencies [fb6eb5d]
- Updated dependencies [5343a1d]
- Updated dependencies [ddf1ea9]
- Updated dependencies [6e0fbb7]
- Updated dependencies [5aa8776]
- Updated dependencies [76e50a5]
- Updated dependencies [3e719c8]
- Updated dependencies [8d43e33]
- Updated dependencies [53ad439]
- Updated dependencies [e0d5026]
- Updated dependencies [90a3344]
- Updated dependencies [61d76a0]
- Updated dependencies [8894627]
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [0d1fd39]
- Updated dependencies [098c784]
- Updated dependencies [3506c69]
- Updated dependencies [daccd55]
- Updated dependencies [be9fb19]
- Updated dependencies [ce13ec8]
- Updated dependencies [95196d7]
- Updated dependencies [55c4151]
- Updated dependencies [5856676]
- Updated dependencies [6e8a02c]
- Updated dependencies [5b401bb]
- Updated dependencies [968e1d1]
- Updated dependencies [59cef8c]
  - @graview/core@0.1.0

## 0.0.1

### Patch Changes

- 4bd846b: The horizon, modules, selection-as-a-stop, the traditional face (@graview/pages), the intelligence seam, and the ship subpackage (persistence wiring, op-log-native migrations, export bundles, health).
- cfdad5a: The sample apps remember. `@graview/ship` gains a browser adapter — the
  same snapshot, log and version the file adapter writes, in `localStorage`,
  slotted into `openStore` unchanged with migrations included — behind a
  `@graview/ship/browser` entry that carries no `node:fs`. `openStore` now
  reopens a store WITH its persisted history (a `Store` accepts a snapshot
  and the log that led to it), applies the declaration's own policy, mints
  ids that cannot collide across sessions, and takes `fresh` to return to
  the seed. The conventions a page reads — `?fresh=1`, a driven browser
  starting fresh unless `?remember=1` — ship as `browserStartsFresh`,
  `forgetFreshParam` and `freshHref`. Primitives gain `StartFresh` and the
  activity popover says "Remembered in this browser" with the way back; the
  pages face takes `remembers` and says the same in its footer.
- Updated dependencies [ec91236]
- Updated dependencies [e38fe86]
- Updated dependencies [5cd68d6]
- Updated dependencies [95cceb3]
- Updated dependencies [094f3cc]
- Updated dependencies [090ab39]
- Updated dependencies [a94d8f5]
- Updated dependencies [87948ef]
- Updated dependencies [4bd846b]
- Updated dependencies [cfdad5a]
- Updated dependencies [34c1600]
- Updated dependencies [329da2e]
- Updated dependencies [77d1d4a]
- Updated dependencies [04eaefe]
- Updated dependencies [f24ef6e]
  - @graview/core@0.0.1
