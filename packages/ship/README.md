# @graview/ship

What **every** deployment of a Graview app needs, hosted or self-hosted: one `defineApp`
declaration plus one persistence adapter is a running deployment.

- **`openStore({ app, adapter })`** — load what was stored, migrate it forward, fold it into
  a live `Store`, and keep the adapter current (every diff appends its operations and
  rewrites the snapshot).
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
- **`health(store)`** — coherence, not liveness: dangling edges, standing, sizes.
- **`serveStore` / `openRemote`** — the store behind HTTP, and the other end of the wire. A
  client sends CALLS, never primitives; the server applies them through an ordinary `Store`
  under the seat the request carries, so the policy refuses on the server exactly what it
  refuses in a browser. `graview serve <entry>` is the command.
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
| GET | `/graview/state` | the graph, the log and the stored version |
| POST | `/graview/ops` | calls in, the ops they produced out — or `undo`, batches to take back; 409 with the policy's sentence when refused |
| GET | `/graview/since?seq=N` | the ops appended after N — everyone else's |
| GET | `/graview/health` | ship's own report, plus where the data is |
| GET | `/graview/export` | the whole store as one bundle, the way out |
| POST | `/graview/here` | say where you are; answers with who else is, and the ops since `seq` |
| GET | `/graview/who` | who is here right now |
| POST | `/graview/leave` | say you have gone |

A request carries its seat in `x-graview-seat` and `x-graview-roles` (`SEAT_HEADERS`) by
default; `serveStore({ seatOf })` is where a host reads its own credential instead. Whatever
a host asks for rides along: `openRemote({ headers })` sends them with every request, and
the framework never reads them. `openRemote(...).settled()` resolves once every call sent
so far has been answered — a browser never waits for it; a host that must report the
server's verdict before it exits does.

## The hosted-store contract

A third party stands up their own host — a file store or SQLite, `graview serve`,
`graview mcp` — without forking anything here. Graview Cloud is the polished multi-tenant
host of the same API, and it consumes this package the way any customer would.

| Concern | In the framework | In a host (Graview Cloud, or yours) |
|---|---|---|
| Op log + snapshot + migrate on open | `openStore` | runs it on the server, per deployment |
| The wire | `serveStore`, `openRemote`, `WIRE` | production TLS, a gateway URL |
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
