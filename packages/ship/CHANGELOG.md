# @graview/ship

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
