# graview

## 0.1.16

### Patch Changes

- Updated dependencies [340ab1e]
- Updated dependencies [1df248f]
- Updated dependencies [eefa440]
- Updated dependencies [03ad97c]
- Updated dependencies [a1da756]
- Updated dependencies [4ad451c]
- Updated dependencies [46c6734]
- Updated dependencies [0f1a4d2]
- Updated dependencies [ae891b0]
- Updated dependencies [a6d0700]
- Updated dependencies [9eaa3c9]
  - @graview/core@0.1.16
  - @graview/skills@0.1.16
  - @graview/guest@0.1.16
  - @graview/tools@0.1.16
  - @graview/ship@0.1.16

## 0.1.15

### Patch Changes

- Updated dependencies [817082f]
- Updated dependencies [d4fb72e]
- Updated dependencies [6a5fb11]
- Updated dependencies [a8b8153]
- Updated dependencies [fffebfd]
- Updated dependencies [efab5b2]
- Updated dependencies [9fc2bd8]
  - @graview/core@0.1.15
  - @graview/skills@0.1.15
  - @graview/tools@0.1.15
  - @graview/ship@0.1.15
  - @graview/guest@0.1.15

## 0.1.14

### Patch Changes

- Updated dependencies [f842422]
- Updated dependencies [fc42f1e]
- Updated dependencies [860223c]
- Updated dependencies [1e7eba5]
- Updated dependencies [9e14b97]
- Updated dependencies [5a236ea]
- Updated dependencies [cc50785]
- Updated dependencies [45842b7]
- Updated dependencies [8c43964]
- Updated dependencies [b8c4527]
- Updated dependencies [ab91f13]
- Updated dependencies [b9435aa]
- Updated dependencies [05b0a95]
- Updated dependencies [bacc303]
- Updated dependencies [6ac06de]
- Updated dependencies [bd69456]
  - @graview/core@0.1.14
  - @graview/guest@0.1.14
  - @graview/skills@0.1.14
  - @graview/tools@0.1.14
  - @graview/ship@0.1.14

## 0.1.13

### Patch Changes

- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/skills@0.1.13
  - @graview/guest@0.1.13
  - @graview/ship@0.1.13
  - @graview/tools@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [4801c44]
  - @graview/core@0.1.12
  - @graview/tools@0.1.12
  - @graview/skills@0.1.12
  - @graview/guest@0.1.12
  - @graview/ship@0.1.12

## 0.1.11

### Patch Changes

- Updated dependencies [e6f90e0]
- Updated dependencies [e6594bb]
- Updated dependencies [fc50abf]
- Updated dependencies [31a6383]
- Updated dependencies [617b432]
- Updated dependencies [a738797]
- Updated dependencies [e567a7b]
- Updated dependencies [a190947]
  - @graview/core@0.1.11
  - @graview/skills@0.1.11
  - @graview/guest@0.1.11
  - @graview/ship@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 4c8a2d1: A worker view can be run once, headless, and say what it drew (FR-95). Graview Cloud checks a chat's view before it applies it, and could not run one anywhere but a person's browser. `runWorkerViewHeadless({ manifest, source, store, principal, run })`, from the new entry `@graview/guest/headless`, checks the manifest against the app and the source against what a view may say. It hands the view the seat's sight cut to its manifest (FR-91), runs it with no network and no DOM, and says what it drew in `describePlace`'s shape (FR-89, `drawnBy: "view:<name>"`): headings, text, figures, fields, and lists with each record's title and what its row or card says. Or it says why the view will not do, with the page's reasons (`source`, `manifest`, `error`, `nodes`, `flood`, `slow`, `refused`) and two of its own: `act`, an act asked for from the view's code or bound to a press (`data-act`) that its manifest does not name, and `isolate`. Nothing is applied: an act the view asks for is written down and answered with a refusal.
  
  It never runs a view in the host's own context. The host supplies the isolate: `run` is handed one script and one JSON string (`HeadlessPayload`), loads the script where it chooses, calls the global the script leaves with the string, and hands back the string it resolves with. Nothing but text crosses, and without a `run` the helper throws; there is no in-process fallback. The script is a headless runtime, `headless/runtime.generated.ts`, built from `src/headless/runtime.ts` by `pnpm guest:runtime` and held current by a test, then the view. Before the view is read it makes the isolate a worker's: the same `graview` global a worker's runtime makes, now `worker/view-global.ts` and shared by both, over a transcript rather than a port; a console that writes to the transcript; timers that never fire; and everything outside the worker's allowlist taken from the global. workerd marks its global's classes with a symbol it will not let go, which holds a primitive and hands back nothing, so `harden` takes `{ primitivesStay: true }` for a headless run; a worker in a page is hardened as before. What the view sent is judged again on the host, from the transcript alone, by the open kit's own renderer drawing into a tree of plain objects (`drawTranscript`, `describeDrawing`, `judgeTranscript`).
  
  `@graview/guest/headless/node` is a `run` for Node, `nodeIsolate()`: a worker thread with a heap ceiling and a V8 context made from nothing, with code from strings and WebAssembly refused and a deadline that covers the microtasks a view queues. `graview view check <view.js> --app <app> --manifest <manifest.json> [--seed <file>] [--as <id>] [--roles a,b] [--width <px>] [--json]` runs it from a terminal, from the new `@graview/guest/cli`, which `graview` dispatches to. `graview` now depends on `@graview/guest`. A linked project made by `graview create` aliases the three new entries.
  
  A unit test writes LifeLogics' four declared lenses again as worker views and runs each headless for the owner and for the delivery partner. Each shows the records, titles and headings `describePlace` says the declared lens shows the same seat. A view that throws, draws past `maxNodes`, sends past `messages`, is longer than `maxSourceBytes`, spins at its top line or in its promise turns, takes longer than `pushMs`, or names an act or a kind its manifest or app does not have, is a failure naming it. The isolate is handed text alone, the host's global is left as it was, and the entry bundles for a browser with no way to run code in the page. A second test runs the payload in workerd through Miniflare, with every outbound request refused and written down: a LifeLogics lens says what it drew for the partner, and a view that tries `fetch`, a WebSocket and the function constructor finds none of them, and no request leaves. The `graview-worker-view` skill now says to run `graview view check` as a member with narrow sight and on an empty seed. `capabilities().shipped` names FR-95. The worker view's runtime is 59,926 B minified, 20,596 B gzipped now that its global is made over a way out the runtime hands it; its budget is raised to 60,500 and 20,750, each saying why. The headless entry is not loaded by any page.
  
  Compatibility: the declaration and check finding codes are unchanged; `PlaceDescription.drawnBy` gains `` `view:${string}` `` for a description a headless run makes. The wire: `capabilities().shipped` gains `FR-95`. Ops, stored formats and tool schemas are unchanged.
- Updated dependencies [6b7edf9]
- Updated dependencies [4ae597b]
- Updated dependencies [f9d5951]
- Updated dependencies [c3e2c1d]
- Updated dependencies [77a9fdc]
- Updated dependencies [9cba01f]
- Updated dependencies [a2c8c06]
- Updated dependencies [c9830fd]
- Updated dependencies [6809372]
- Updated dependencies [77a9fdc]
- Updated dependencies [b50f25c]
- Updated dependencies [bce0e4e]
- Updated dependencies [660dd52]
- Updated dependencies [ea06b89]
- Updated dependencies [9710a44]
- Updated dependencies [3047796]
- Updated dependencies [d4cab17]
- Updated dependencies [58f71f9]
- Updated dependencies [2e46ab9]
- Updated dependencies [4c8a2d1]
- Updated dependencies [5703a27]
- Updated dependencies [fc6ddca]
- Updated dependencies [17b908c]
- Updated dependencies [6e3b089]
- Updated dependencies [6852b7d]
- Updated dependencies [b67367a]
- Updated dependencies [7307a0c]
  - @graview/core@0.1.10
  - @graview/skills@0.1.10
  - @graview/guest@0.1.10
  - @graview/tools@0.1.10
  - @graview/ship@0.1.10

## 0.1.9

### Patch Changes

- Updated dependencies [b5a4bfc]
- Updated dependencies [e811d26]
- Updated dependencies [d953bf9]
- Updated dependencies [4e1d6e3]
- Updated dependencies [7597e22]
- Updated dependencies [1aba73e]
- Updated dependencies [e4f7b67]
  - @graview/core@0.1.9
  - @graview/skills@0.1.9
  - @graview/ship@0.1.9
  - @graview/tools@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8
  - @graview/ship@0.1.8
  - @graview/tools@0.1.8
  - @graview/skills@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/ship@0.1.7
  - @graview/tools@0.1.7
  - @graview/skills@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/skills@0.1.6
  - @graview/core@0.1.6
  - @graview/ship@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [f989024]
- Updated dependencies [97f2a0a]
- Updated dependencies [1e21d54]
- Updated dependencies [281761b]
- Updated dependencies [a83a311]
- Updated dependencies [f1fcf13]
- Updated dependencies [826e19b]
- Updated dependencies [e22a00d]
- Updated dependencies [5a2086e]
- Updated dependencies [76df9ba]
  - @graview/skills@0.1.5
  - @graview/core@0.1.5
  - @graview/ship@0.1.5
  - @graview/tools@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [56e4e95]
- Updated dependencies [df9932a]
- Updated dependencies [7fc5c32]
- Updated dependencies [745971d]
- Updated dependencies [9de42fe]
- Updated dependencies [36df620]
- Updated dependencies [a9c0f2d]
- Updated dependencies [6548504]
- Updated dependencies [75c1a26]
- Updated dependencies [7650ff1]
- Updated dependencies [e0f75bb]
- Updated dependencies [569928f]
- Updated dependencies [833e390]
- Updated dependencies [c5b36f7]
- Updated dependencies [53857e9]
- Updated dependencies [fdf82ed]
- Updated dependencies [f923330]
- Updated dependencies [368840e]
- Updated dependencies [936814b]
- Updated dependencies [f06dca9]
- Updated dependencies [98f0438]
- Updated dependencies [ba312af]
- Updated dependencies [d5a386e]
- Updated dependencies [a57ea5d]
- Updated dependencies [d5af759]
- Updated dependencies [5375e2a]
- Updated dependencies [8d9eb57]
- Updated dependencies [d774558]
- Updated dependencies [0183340]
- Updated dependencies [cc889f4]
- Updated dependencies [f75ff5b]
- Updated dependencies [35aec0c]
- Updated dependencies [5fd6380]
- Updated dependencies [c44f0d1]
- Updated dependencies [dee1fb2]
- Updated dependencies [67fbb6f]
- Updated dependencies [180452e]
- Updated dependencies [8675901]
- Updated dependencies [ba950f3]
- Updated dependencies [86baf0b]
- Updated dependencies [83448ba]
- Updated dependencies [1f260a7]
- Updated dependencies [062fe46]
- Updated dependencies [0497bbf]
  - @graview/ship@0.1.4
  - @graview/core@0.1.4
  - @graview/tools@0.1.4
  - @graview/skills@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [c3683bb]
- Updated dependencies [1ba2ab7]
- Updated dependencies [ca3c327]
- Updated dependencies [5ea9572]
- Updated dependencies [8092097]
- Updated dependencies [a65423f]
- Updated dependencies [8e76788]
- Updated dependencies [c2ed1f8]
- Updated dependencies [5ea9572]
- Updated dependencies [50beae9]
- Updated dependencies [ca3c327]
- Updated dependencies [625ac82]
- Updated dependencies [f4a1f72]
- Updated dependencies [ca3c327]
- Updated dependencies [625ac82]
  - @graview/core@0.1.3
  - @graview/ship@0.1.3
  - @graview/tools@0.1.3
  - @graview/skills@0.1.3

## 0.1.2

### Patch Changes

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
- Updated dependencies [a634594]
- Updated dependencies [c6cea46]
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
- Updated dependencies [ca11fe8]
- Updated dependencies [b71e7c5]
- Updated dependencies
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2
  - @graview/ship@0.1.2
  - @graview/tools@0.1.2
  - @graview/skills@0.1.2

## 0.1.1

### Patch Changes

- 89e6ba9: `graview` reads past a leading `--`. `pnpm graview -- create ../walk7` is how the repository's own notes say to run the command line from a checkout, pnpm hands the separator on to the script, and the first thing a walk typed was answered `graview: unknown command "--"`.
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
  - @graview/tools@0.1.1
  - @graview/ship@0.1.1
  - @graview/skills@0.1.1

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

- ff7de41: An agent with only a shell attaches to a live store. `graview mcp <entry>` speaks MCP over stdio — JSON-RPC, one message per line, no SDK — around `createToolRuntime` and `createMcpAdapter`, against the store where the data is: `--data <dir>` (a folder of readable JSON), `--sqlite <file>`, or `--remote-url <url>` against a running `graview serve`, with `--as` and `--roles` naming the seat and `--header` carrying whatever a host asks for. A reply waits for the write to land, or for the server's verdict against a remote, so "done" is never said before it is true; a refusal is the tool's error, in the policy's own sentence. `--list` prints the seat's tools as `tools/list` JSON without opening anything — the catalog a host registers without hand-writing a schema — and the model is told on connecting how to work here, derived from the declaration.
  
  `graview apply <entry>` is the one-shot form: `--call <name> --args '{…}'` for one act, `--plan <file>` for many as one batch (`[{ mutation, args, as? }]`, a later call naming an earlier one's node as `{ "$plan": "<as>" }`, ordered and judged by `planFrom`), `--undo <batch>` for a take-back, `--preview` to say what would happen and write nothing. Everything goes through `store.apply` under the seat's principal; what is printed afterwards is read from the log once settled, minus a remote store's provisional ops, so the ids and batch shown are the ones every other client has. Both live in `@graview/tools/cli`; the `graview` command dispatches to them. A plan whose calls carry no `why` keeps each act's own sentence as its intent, where an empty string used to silence it.
- b1fbc32: Default content moves without a wipe. The step DSL gains five content steps beside the schema ones — `put-node`, `patch-node`, `drop-node`, `put-edge`, `drop-edge` — each judged against the stored graph at the moment it runs, so a record already there is not put twice and a patch that changes nothing says nothing. `primitivesForSteps` now runs steps IN SEQUENCE, each seeing the graph as the ones before it leave it, which is what the studio already assumed when it renamed a kind and then spoke of its fields by the new name, and what a content run needs to put a record and tie it in one breath.
  
  `seedSteps(seed, live)` diffs a bootstrap seed against a live snapshot into those steps — missing records put, fields the seed sets patched, missing ties made, and nothing dropped unless `prune` is asked for by name — and `applySteps(store, steps)` lands them as ONE operation authored `system · ship:sync-seed`, logged with its inverse, so undo is the ordinary undo. `graview sync-seed <entry> --seed <file> [--data|--sqlite] [--apply] [--prune] [--json]` is the command: it prints the steps as sentences and writes nothing until `--apply`. The seed is read once, into an empty store, and the README now says so; `fresh` is a demo's way back to the example, not the redesign tool.
  
  `graview serve` and `sync-seed` parse their store flags through one `backendFrom`, and `loadApp` is exported from `@graview/core/cli` so the packages that load an entry load it the same way.
- Updated dependencies [fb781c2]
- Updated dependencies [390028c]
- Updated dependencies [bff0b71]
- Updated dependencies [400a6df]
- Updated dependencies [c7a3519]
- Updated dependencies [09a23a3]
- Updated dependencies [92a2f73]
- Updated dependencies [509162f]
- Updated dependencies [8c14e4c]
- Updated dependencies [3f86b09]
- Updated dependencies [080645e]
- Updated dependencies [188bc6e]
- Updated dependencies [1ebfd44]
- Updated dependencies [a23e496]
- Updated dependencies [e0d5026]
- Updated dependencies [41abe03]
- Updated dependencies [e165c5b]
- Updated dependencies [406b774]
- Updated dependencies [14e22ab]
- Updated dependencies [4aa0f93]
- Updated dependencies [b7f83cc]
- Updated dependencies [5b5e5a3]
- Updated dependencies [aa90b02]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [ccc912a]
- Updated dependencies [7c0e701]
- Updated dependencies [73e3b86]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [9a3fe4b]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [8041853]
- Updated dependencies [4c4d52a]
- Updated dependencies [b9b0635]
- Updated dependencies [5e6d4e7]
- Updated dependencies [03b9c5a]
- Updated dependencies [5297528]
- Updated dependencies [ce13ec8]
- Updated dependencies [ff7de41]
- Updated dependencies [959955f]
- Updated dependencies [22e0668]
- Updated dependencies [9b3a623]
- Updated dependencies [5a00a1f]
- Updated dependencies [887d768]
- Updated dependencies [2c25067]
- Updated dependencies [b3ed5f6]
- Updated dependencies [b1fbc32]
- Updated dependencies [d907771]
- Updated dependencies [b5e95a1]
- Updated dependencies [1e773a5]
- Updated dependencies [7a61e87]
- Updated dependencies [1794980]
- Updated dependencies [a5d842b]
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
- Updated dependencies [30adc63]
- Updated dependencies [0c0fa22]
- Updated dependencies [8a2fdf2]
- Updated dependencies [fb6eb5d]
- Updated dependencies [5343a1d]
- Updated dependencies [ddf1ea9]
- Updated dependencies [6e0fbb7]
- Updated dependencies [e3a7de6]
- Updated dependencies [3af8da7]
- Updated dependencies [5aa8776]
- Updated dependencies [76e50a5]
- Updated dependencies [3e719c8]
- Updated dependencies [8d43e33]
- Updated dependencies [53ad439]
- Updated dependencies [e0d5026]
- Updated dependencies [0ea3f62]
- Updated dependencies [90a3344]
- Updated dependencies [0a3504a]
- Updated dependencies [b7fa5e3]
- Updated dependencies [1d121a7]
- Updated dependencies [61d76a0]
- Updated dependencies [8894627]
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [7be1ad2]
- Updated dependencies [0d1fd39]
- Updated dependencies [a38a5af]
- Updated dependencies [098c784]
- Updated dependencies [315ce3b]
- Updated dependencies [d9bfdb8]
- Updated dependencies [3506c69]
- Updated dependencies [dff45ce]
- Updated dependencies [daccd55]
- Updated dependencies [6520856]
- Updated dependencies [be9fb19]
- Updated dependencies [ce13ec8]
- Updated dependencies [ccaa5f4]
- Updated dependencies [95196d7]
- Updated dependencies [55c4151]
- Updated dependencies [5856676]
- Updated dependencies [6e8a02c]
- Updated dependencies [5b401bb]
- Updated dependencies [968e1d1]
- Updated dependencies [59cef8c]
  - @graview/core@0.1.0
  - @graview/tools@0.1.0
  - @graview/skills@0.1.0
  - @graview/ship@0.1.0
