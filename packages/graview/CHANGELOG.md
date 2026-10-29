# graview

## 0.1.64

### Patch Changes

- Updated dependencies [bdacd47]
- Updated dependencies [bdacd47]
- Updated dependencies [553f3d7]
- Updated dependencies [61c632e]
- Updated dependencies [6cdf5a5]
  - @graview/core@0.1.64
  - @graview/skills@0.1.64
  - @graview/tools@0.1.64
  - @graview/guest@0.1.64
  - @graview/ship@0.1.64

## 0.1.63

### Patch Changes

- 696afa4: An app's workflows are seen and set up where the app is: on the Scene's map, from a shell and from an owner's seat, Roadmap f-jobs-declared (the Scene's part) and f-jobs-authoring-guide. A workflow said what the app does on its own, and nothing showed it: not the map a person reads the app from, not the command line a developer runs it from, not the tools an agent sets an app up with.
  
  From altitude each workflow now stands on the map as the app's own actor at work: in the street along the right edge of the district it writes first, a cell out from the curb and a cell apart from another beside it, never on a district's ground, wired solid to the districts its steps write and dashed to those it only reads — what its steps name (`over`, `reads`, `from`, `act`, `acts`, `generate`, `archive`) and what starts it on a change, nothing guessed. Under its title it says how its last run went when the host hands its log of runs: `workflowRuns` on the provider and the embed (a `WorkflowLog`, or anything with its `last(name)`) — "Last ran 2 hours ago: made 28", "Last ran yesterday: nothing new", "Last ran 5 minutes ago, as a dry run: would make 4", "Has not run yet". A paused one is drawn dimmed and says "Paused". Each is a group a screen reader is told in words — "Workflow: Fill out next week's events. Reads routines; writes events. Last ran 2 hours ago: made 28." — the kinds by what they are called. Dreaming, built in and at work on every district, is not drawn. The pieces are `@graview/core/scene`'s, read off the declaration's shape only, so the Scene carries no checker and no runner: `workflowsOnTheMap(app, declaredWorkflows(app), acts)`, `workflowSpots(workflows, plots)`, `lastRunWords(run, now)` and `agoWords`. The layer is fetched with the ground it stands on, and drawn only for an app that declares a workflow.
  
  `graview workflow <entry> [<name>] [--dry] [--now <iso>] [--data <dir> | --sqlite <file>] [--json]` is a command of `@graview/tools`, dispatched by `graview`. Without a name it lists the app's workflows — each in a sentence, active or paused, when it next runs on the app's clock and how its last run went, dreaming among them as built in. With one it runs it once by hand as the app's own actor (`workflow:<name>`, named by its title) against the store on disk and prints the run; the runs are kept beside the store (`workflow-runs.json`), so the next reads on from the last, the first after a change is dry and the next is kept. `--dry` keeps nothing. A remote store is sent to its server, and `dreaming` to `graview dream`.
  
  An owner's seat runs, pauses and resumes them: `run_workflow` (`{ name, dryRun? }`), answered with the run, and `pause_workflow` and `resume_workflow` (`{ name }`), which write the edit through the host and answer the edit that takes it back. A runtime lists them only for an app that declares workflows and only when its host hands `workflows` (`{ declared, run, edit? }`) — `seatWorkflows({ app, store, log, ai?, edit? })` from `@graview/tools/workflows` makes one, the pause and resume only with `edit` — and never on a read-only seat; `toolDefinitions` takes `workflows: { names, manage? }`; `graview mcp --workflows` hands its seat the runs beside the store and, for a document entry, a pause written into the document, checked first. The runner is the host's to bring, so a seat on a page carries none of it.
  
  The workflows harness (`scripts/verify-workflows.mjs`) mounts a household's routines, plan items, events and grocery lists with three workflows and a log of runs, in three engines and both schemes: eachWorkflowStandsBesideTheDistrictItWritesWiredToWhatItReadsAndWrites, noWorkflowStandsOnADistrictsGround, aPausedWorkflowIsDrawnDimmedAndSaysSo, aWorkflowSaysItsLastRunInWords and aScreenReaderIsToldWhatEachWorkflowReadsWritesAndDid. `a-workflow-stands-on-the-map-beside-what-it-writes.test.ts`, `an-owners-seat-runs-pauses-and-resumes-a-workflow.test.ts` and `graview-workflow-lists-and-runs-the-apps-workflows.test.ts` hold the rest. The new graview-workflows skill sets up the four workflows a person asks for in one sentence, each checked with `graview check` and a dry run.
  
  A hosted page carries 0.1 KB more up front (91 bytes minified, 41 gzipped; handed a compiled app, 0.1 KB: 91 and 51): the provider and the embed handing on `workflowRuns`, and the scene's door to the layer — under raises naming this changeset; no workflow code rides it, the layer coming with the ground it stands on and the seat's tools reading the workflows' names from what the host hands. The pages face alone 97 / 42 more, the embed without the studio 97 / 56, every face 9_882 / 3_356, the embed with the studio handed in 3_814 / 1_098 and Cloud's worker 5_071 bytes, each under a raise of its own (`scripts/budget-raises/a-workflow-stands-on-the-map-*.json`).
  
  Compatibility: ops and primitives, stored formats and the declaration and check finding codes — unchanged. The wire — unchanged. Derived tool names and input schemas — three new tools a host opts into (`run_workflow`, `pause_workflow`, `resume_workflow`), listed only when it hands `workflows` (or `toolDefinitions` is told `workflows`), so a surface that did not ask keeps its tools and its hash; an act can no longer take any of the three names. The JavaScript API — additive: `workflowRuns` on `GraviewProviderProps` and the embed's options (`WorkflowRuns`), `workflowsOnTheMap`, `workflowSpots`, `lastRunWords` and `agoWords` on `@graview/core/scene`, `seatWorkflows` and `WorkflowTools` on `@graview/tools/workflows`, `workflows` on `ToolRuntimeOptions` and `ToolDefinitionsOptions`, and `workflow` and `WORKFLOW_USAGE` on `@graview/tools/cli`. What Graview Cloud does: hands the Scene its log of runs as `workflowRuns`, hands an owner's chat seat `seatWorkflows` with its store, its log and an `edit` that writes the document through its own propose path, and offers Run now, Dry run and Pause on a workflow from its settings through the same three tools.
- Updated dependencies [c91af18]
- Updated dependencies [4fa4e62]
- Updated dependencies [c85bcc0]
- Updated dependencies [511184d]
- Updated dependencies [e92448c]
- Updated dependencies [ac514dc]
- Updated dependencies [52aed08]
- Updated dependencies [bd2a06c]
- Updated dependencies [db91f9f]
- Updated dependencies [53c5090]
- Updated dependencies [696afa4]
- Updated dependencies [013977e]
- Updated dependencies [57575e1]
- Updated dependencies [affa912]
- Updated dependencies [d6edd89]
- Updated dependencies [45a60d6]
  - @graview/core@0.1.63
  - @graview/tools@0.1.63
  - @graview/skills@0.1.63
  - @graview/ship@0.1.63
  - @graview/guest@0.1.63

## 0.1.62

### Patch Changes

- 7d85f11: An app's opening screen is in its declaration, Roadmap f-splash-in-document. Graview Cloud kept what a page shows in its first second — while the app's code loads, gone the moment a place has drawn — as a setting of its own, so an export, a remix into a self-hosted app and an import all arrived without it. Now it is the document's: `brand.splash` is `{ "style", "image"?, "title"?, "kicker"?, "shader"? }`, the style one of `plain` (the ground, the app's mark and its name), `editorial` (the image full-bleed, the title very large at the foot), `shader` (the image drifting through one of the shaders the renderer ships — `drift`, `ripple` or `veil`, named by `shader`, never written in a document: data is never code) or `ascii` (the image as characters in the accent, the title typing on); the image a mark as the logo takes one (inline SVG, or a path on the app's own host), the title in place of the app's name, the kicker one small line over it. It is judged where the rest of the brand is: `brand-splash-image` refuses an image that could act or lives on another origin, `brand-splash-shader` a shader the renderer does not ship (naming the ones it does) and warns of one named on a style that draws none, and `brand-splash-style` an edit's style off the list (a document's shape refuses it first). `set-brand` takes `splash` whole and `null` clears it, saying "The app opens on an editorial screen while it loads."; `diffDocuments` says the same. Cloud's `custom` style — a fragment shader of the owner's own — stays Cloud's: the framework never stores code in a declaration, so a remix of an app with a custom screen lands on the editorial one.
  
  The renderer is `@graview/pages/splash`: `splashHtml(brand, { scheme?, name? })` answers `{ html, css, script }` — one element, a stylesheet scoped to it and a plain script — with no import at all, not React and nothing of the framework, bundling to under 14 KB (a test holds it, and runs it in a bare context), so a host inlines the three in its first HTML before the app's root and the first paint never waits on the bundle the screen covers for. The script takes the screen away once a place says `data-graview-drawn` (FR-188's signal), or the page fails with an alert, or fifteen seconds pass, and under reduced motion at once and with nothing moving; WebGL refused, the shader screen is the editorial one. `graview preview` draws it: `servePreview` takes `splash` (the renderer) and serves the page with the screen inlined for a document whose brand has one, and the page as built for one that has none or for a visitor's form; the `graview` tool bundles the renderer beside the page it already carries (`dist/preview/splash.js`), so it takes no dependency on the pages face. The preview harness holds that the screen is in the first HTML, on the page when the document has parsed and gone once the place has drawn, for the shader and the ascii styles; the core tests hold that an export (the document as JSON), an import (compiled again) and a remix (the compiled app written back as its document) keep it. The brand skill says the shape.
  
  Reading the shape costs a hosted page 0.1 KB more up front (144 bytes minified, 65 gzipped), under a raise naming this changeset; every face 1_946 / 722 more and Cloud's worker 3_799 bytes, each under a raise of its own; a page handed a compiled app, the pages face alone, a visitor's form and the guest host are unchanged.
  
  Compatibility: ops and primitives — unchanged. Stored formats — unchanged; a compiled app does not carry the screen, which is a host's first HTML's, drawn from the document. The wire — unchanged. The declaration and check finding codes — the brand gains the key `splash`, which a build that predates it refuses by path (`brand.splash`); `brand-splash-image`, `brand-splash-shader` and `brand-splash-style` are new and judge only the new key; every other code is unchanged. Derived tool names and input schemas — unchanged. What Graview Cloud does: stores the opening screen in the document's `brand.splash` through `propose_change` with `set-brand` in place of its own setting, keeps its `custom` style and its default `graview` frame as settings of its own, and inlines `splashHtml(document.brand, { name: document.name })` from `@graview/pages/splash` in the first HTML its shell serves.
- Updated dependencies [c8ac8e8]
- Updated dependencies [055b1eb]
- Updated dependencies [8f990e3]
- Updated dependencies [f4da101]
- Updated dependencies [24638b9]
- Updated dependencies [55649fe]
- Updated dependencies [7d85f11]
- Updated dependencies [b5ced87]
- Updated dependencies [d9d288c]
- Updated dependencies [509832a]
- Updated dependencies [1d2b75a]
- Updated dependencies [0e74201]
  - @graview/core@0.1.62
  - @graview/ship@0.1.62
  - @graview/skills@0.1.62
  - @graview/tools@0.1.62
  - @graview/guest@0.1.62

## 0.1.61

### Patch Changes

- Updated dependencies [c9fd45a]
- Updated dependencies [9ffaf81]
- Updated dependencies [24926eb]
- Updated dependencies [fddebfd]
- Updated dependencies [208702c]
- Updated dependencies [5ec4dcf]
- Updated dependencies [ce470d9]
- Updated dependencies [166cf1d]
- Updated dependencies [869c28c]
- Updated dependencies [cab3b1d]
- Updated dependencies [0cf3524]
- Updated dependencies [08d4b4c]
- Updated dependencies [1483a93]
- Updated dependencies [8d7cecc]
- Updated dependencies [b80b6de]
  - @graview/core@0.1.61
  - @graview/tools@0.1.61
  - @graview/guest@0.1.61
  - @graview/ship@0.1.61
  - @graview/skills@0.1.61

## 0.1.60

### Patch Changes

- 4e41a99: A loopback `graview serve` or `graview preview` believes a seat only from a request carrying its run's key. Each kept a page on another origin out, and a name rebound to 127.0.0.1, but another account on this machine, or any program that is no browser, sends no `Origin` at all, and it was believed as any seat but the system's: it read the whole store, records the policy hides included, and wrote to it as any member — or, on a preview, as the page's own seat. Now each run of `graview serve`, `graview preview` and `graview shots` on loopback mints a key (32 random bytes, `mintServeKey` in `@graview/ship/cli`; `serveKey` takes `GRAVIEW_SERVE_KEY` instead when it is set and at least 16 characters, for a harness that starts its own server) and says it only in its terminal, in every address it prints (`address: http://localhost:5196/?graview_key=<key>`; the preview's page, scene and forms lines too). A request is believed only when it carries the key: in `x-graview-key` from a program, in the `graview_key` query parameter on a page's WebSocket (which cannot set a header) or a page's leave beacon, or in the cookie a browser is given for opening a printed address (`graview_key_<port>`, named for the server's port because a browser sends a cookie to every port of a host; `HttpOnly`, `SameSite=Strict`; a value made from the key rather than the key; and the address tidied by a 303), each compared in constant time (`sameKey` and `tradeKey`, shared with the dev server's doors). Without it every route but health answers 401 with where the key is, and so does the live wire's upgrade; a browser's preflight passes, and the key is never written into an answer, nor handed past the door to a route or a host's `answer`. A new run is a new key. `serveStore({ key })` and `servePreview({ key })` turn it on for any host, and a preview's `address` carries it; `SERVE_KEY` names the header, parameter and cookie, and `servedAddress` takes a printed address apart into where the store is and its key, from the main, browser and runtime entries. `openRemote`, `remoteFriction`, `remoteSubscriptions` and `remoteViews` take the printed address whole and send its key as the header, so `graview mcp --remote-url` and `graview apply --remote-url` do too, and say where they act without the key. `graview shots` opens each page at its address with the key. The AGENTS.md `graview create` writes says to open the Pages address `graview preview` prints, since it carries the key. A request for an address no URL parses (`//[`) is refused rather than ending the server.
  
  The rota page's `?server=` takes the printed address; opened without the key — as the desk's "Data in a folder you can open" stop opens it, since the desk never starts the server nor knows its key — it says what the server said and asks for the address `pnpm serve:rota` printed, and opens the roster from it, and the desk's stop says so beside its link. The architecture face recipe's dev server takes the preview's printed address as `GRAVIEW_PREVIEW` and carries the key on what it proxies, handing its page only where the preview is.
  
  `a-loopback-serve-believes-a-seat-only-with-its-runs-key.test.ts` holds that a program with no Origin and no key claiming a member's seat is refused, that the header, the query and the traded cookie are believed, that the live wire keeps to the same rule, that `openRemote` opens live from the printed address, that the key appears in no answer, and that an unparseable address is refused; `a-loopback-preview-believes-its-page-only-with-its-runs-key.test.ts` that a keyed preview answers nothing but health without the key, lets its page in by the cookie named for its port, serves the key in neither its page nor its document, and takes `GRAVIEW_SERVE_KEY`. The harnesses that start a served store or a preview (served, desk, preview with shots, date-inputs, scene-at-scale, typed-together, face-recipe) name the run's key, send it from Node and let their browsers in by the printed address, as a person would (`scripts/lib/serve-key.mjs`, which every harness browser is wrapped in); the served harness says a seat without the key, or with another run's, is refused, the desk harness that its stop asks for the printed address and opens the roster from it, and `pnpm smoke` that the installed `graview preview` refuses a request without the key. The graview-ship, graview-agent-seat, graview-host-page and graview-visitor-forms skills say how.
  
  A hosted page carries 0.5 KB more up front, minified, with or without a compiled app handed it (498 and 500 bytes, 178 gzipped): `openRemote` taking the printed address apart and carrying its key.
  
  Compatibility: the wire — a loopback `graview serve` or `graview preview` answers 401 on every route but health, and on the live wire, to a request without its run's key, and the store's CORS answer allows the `x-graview-key` header; `servePreview` and `serveStore` ask for no key unless handed one; `graview serve --trust-seat-headers` behind a trusted network, and a host with its own `seatOf`, are unchanged. Ops and primitives, stored formats, the declaration and check finding codes, derived tool names and input schemas — unchanged.
- Updated dependencies [613489b]
- Updated dependencies [4eda24b]
- Updated dependencies [4e41a99]
- Updated dependencies [4affb32]
- Updated dependencies [b253ca8]
- Updated dependencies [3e2d346]
  - @graview/core@0.1.60
  - @graview/ship@0.1.60
  - @graview/skills@0.1.60
  - @graview/tools@0.1.60
  - @graview/guest@0.1.60

## 0.1.59

### Patch Changes

- Updated dependencies [26a8127]
- Updated dependencies [83fe4cb]
- Updated dependencies [c33c732]
- Updated dependencies [85f0794]
- Updated dependencies [adb3bdc]
- Updated dependencies [5bf24ba]
- Updated dependencies [350fc01]
- Updated dependencies [f65e007]
- Updated dependencies [d7d58b8]
- Updated dependencies [d4360ef]
- Updated dependencies [6b5d16f]
- Updated dependencies [cf757d1]
- Updated dependencies [fd6c21a]
- Updated dependencies [85f9fc3]
- Updated dependencies [bd67c9b]
- Updated dependencies [ee5a7c0]
- Updated dependencies [6d09126]
- Updated dependencies [0dba129]
- Updated dependencies [5002b90]
- Updated dependencies [1c210c5]
- Updated dependencies [f14058b]
- Updated dependencies [419b8e8]
- Updated dependencies [d14a1f9]
- Updated dependencies [4a8ecdf]
- Updated dependencies [aba4773]
- Updated dependencies [2471cc2]
- Updated dependencies [e3566ea]
- Updated dependencies [5301cbe]
- Updated dependencies [58da61a]
- Updated dependencies [d1d4e11]
- Updated dependencies [359b324]
- Updated dependencies [b8624ae]
- Updated dependencies [6bc7bb0]
- Updated dependencies [71d262d]
- Updated dependencies [b336f0e]
  - @graview/ship@0.1.59
  - @graview/core@0.1.59
  - @graview/skills@0.1.59
  - @graview/guest@0.1.59
  - @graview/tools@0.1.59

## 0.1.58

### Patch Changes

- Updated dependencies [aa50c1d]
- Updated dependencies [039af05]
  - @graview/core@0.1.58
  - @graview/ship@0.1.58
  - @graview/skills@0.1.58
  - @graview/guest@0.1.58
  - @graview/tools@0.1.58

## 0.1.57

### Patch Changes

- Updated dependencies [6e51c72]
- Updated dependencies [2173a1e]
- Updated dependencies [67e4b0d]
- Updated dependencies [4104b12]
- Updated dependencies [67e4b0d]
- Updated dependencies [994bfe2]
- Updated dependencies [3eaff17]
- Updated dependencies [dda9073]
- Updated dependencies [6a43f94]
- Updated dependencies [3e9d537]
  - @graview/core@0.1.57
  - @graview/skills@0.1.57
  - @graview/tools@0.1.57
  - @graview/guest@0.1.57
  - @graview/ship@0.1.57

## 0.1.56

### Patch Changes

- Updated dependencies [c7bdc23]
- Updated dependencies [3149e79]
- Updated dependencies [d97578e]
- Updated dependencies [d97578e]
- Updated dependencies [d97578e]
- Updated dependencies [3149e79]
- Updated dependencies [8e25c9f]
- Updated dependencies [5bb8e6e]
- Updated dependencies [605a44f]
- Updated dependencies [d97578e]
  - @graview/core@0.1.56
  - @graview/skills@0.1.56
  - @graview/ship@0.1.56
  - @graview/guest@0.1.56
  - @graview/tools@0.1.56

## 0.1.55

### Patch Changes

- a2c056b: Apps improve from use: the app's own actor suggests changes to the app itself, accepted or declined like any suggestion (Roadmap f-learned-suggestions). The actor suggested changes to records, and the friction log kept what people could not do, but nothing turned the one into the other. `@graview/core/learn` is a new entry: `learnFromUse({ document, friction, log, records, declined, opens, minPeople })` reads and writes nothing and answers `AppSuggestion[]`, each `{ key, edits, said, why, evidence: { people, times } }`, offered only when at least `minPeople` (3, never fewer than 2) distinct people show it — an agent counted as the person it acts for, the app's own actor and the system as nobody. Six judges: another word for a kind or a field (words several people searched with and found nothing that nothing in the app is called, aimed at the field people changed next, within ten minutes, or the kind they changed or searched in: `add-alias`); a choice field (a text field whose values across six or more records are two to eight values each written twice, by enough people: `retype-field` to a choice of them); a date field (three in five of a text field's values carry a date in words: `add-field` of a date beside it, and nothing is moved); one act for a sequence (two acts one person takes within five minutes on one record, composed into one `add-act` when both are document acts that only set fields of the same kind and share none, the second with no condition of its own — otherwise said in `learningFrom(…).skipped` with why: an act that is code or derived, one that creates or links, two that set the same field); a clearer description for an act agents call wrongly (`tool-invalid` events with the form that worked: `add-act` with `replace` and the form said in its description, for a document act only); and a place nobody opens, from counts a host passes as `opens` (the framework sees no place open): `set-lens-hidden`, so it is still reached by its address. `key` is the same on every run, so `declined` — keys, or the decisions `declineAppSuggestion` makes — keeps a suggestion from being offered again however the evidence grows. `acceptAppSuggestion(document, suggestion)` applies its edits through `editDocument` as one change and answers the document, what the editor said, the fills, the lineage `{ basis: why, suggestion: key, actor: "learns from use" }` and the decision to keep; an edit that no longer applies is refused with the editor's findings. `memoryLearned` keeps decisions in memory, one per key.
  
  To keep another word, a kind and a field take `aliases` (up to twelve, each up to three lower-case words): in a document `kinds.<kind>.aliases` and `kinds.<kind>.fields.<field>.aliases`, in `defineNode` `aliases` and `fieldAliases: { <field>: [...] }`. Search finds a kind by its alias; `aiContextOf`'s schema digest says a kind's `aliases` and its fields' `fieldAliases` (a field the seat may not read is not named); `graview describe` says them under "Other words people use"; the friction digest no longer counts an alias as an unknown word; `toDocument` writes them. Two edits change them — `add-alias { kind, field?, alias }` and `set-aliases { kind, field?, aliases | null }` — and the checker refuses an alias another kind is called (its id, noun, plural or alias), one another field of the same kind is called (its name, label or alias), one said twice, and in TypeScript a `fieldAliases` naming a field the kind does not have: `alias-taken` and `alias-field`, errors, in a document at `kinds.<kind>[.fields.<field>].aliases.<n>` and in TypeScript at `defineNode("<kind>").aliases[<n>]`.
  
  Declines live beside the store, not in the op log: the log holds changes to the records, and its decline is an undo of a suggested call, while a declaration suggestion changes nothing to undo and its acceptance is the document's next version, kept wherever the host keeps those. `graview serve`'s directory keeps `learned.json` beside `friction.json` (`fileLearned`, `learnedFileOf` on `@graview/ship`); Graview Cloud keeps its own beside an app's document versions and passes them as `declined`. `graview learn <entry> [--data | --sqlite | --remote-url] [--friction] [--opens] [--min-people] [--json]` (in `@graview/tools/cli`, dispatched by `graview`) reads the store's log and records, `friction.json` and `learned.json`, and prints each suggestion with its edits and key, and what it saw and could not suggest; `--decline <key>` keeps the answer, and `--accept <key>` applies a document entry's edits through the editor, checks the app it makes and writes the file (a TypeScript app is told to make them in its source). `graview mcp` on a store on disk lists `list_app_suggestions`, a read, for a runtime handed `learned` (`ToolRuntimeOptions.learned`, `toolDefinitions(…, { learned: true })`); a seat's context never carries them. The ship README says what the app learns from the friction log and where its answers are kept, and the graview-tidying skill teaches it.
  
  Core's tests hold that one person searching a word a hundred times suggests nothing, that a declined alias is never suggested again, that learning changes nothing and accepting applies one change with its lineage, that a choice one person wrote and values that do not repeat suggest nothing, that dates are never moved, that a sequence the act language cannot compose is skipped and said, that a place is hidden only from counts while another is opened, that a tool's description is suggested only for a document act, and that aliases are read, said, edited, checked and written back alike in a document and in `defineNode`; ship's keeps a decline in `learned.json` across processes; tools' runs `graview learn` to print, decline and accept, and lists the seat's read only when handed it. A hosted page carries 0.3 KB more up front (342 bytes, 119 gzipped; handed a compiled app 0.1 KB, 146 and 50) — the document shape's `aliases` and a compiled kind's — under raises filed for them (`scripts/budget-raises/apps-improve-from-use-*.json`), as do the pages face alone (53, 33; search finding a kind by its alias) and a visitor's form handed a compiled app (146, 46).
  
  Compatibility: ops and primitives, the wire — unchanged. The declaration — additive: `aliases` on a document kind and field and on `defineNode` (with `fieldAliases`), and `add-alias` and `set-aliases` among the edits. Check finding codes — additive: `alias-taken`, `alias-field`. Derived tool names and input schemas — unchanged; a runtime handed `learned` lists one more read tool, `list_app_suggestions`, and no other surface moves. Stored formats: `learned.json` beside a store on disk, outside the op log and every export. The JavaScript API — additive: the `@graview/core/learn` entry (`learnFromUse`, `learningFrom`, `acceptAppSuggestion`, `declineAppSuggestion`, `memoryLearned`, `keptDecisions`, `LEARNING_ACTOR` and their types); `aliases` and `fieldAliases` on `NodeDefinitionSpec` and `SchemaDigestKind`; `fileLearned` and `learnedFileOf` on `@graview/ship`; `learn` and `LEARN_USAGE` on `@graview/tools/cli`; `ToolRuntimeOptions.learned` and `ToolDefinitionsOptions.learned`. What Graview Cloud does: takes this build; `propose_change` takes `add-alias` and `set-aliases` through `editDocument`; it can call `learnFromUse` with an app's friction, log and records, its own decisions as `declined` and its Analytics' place opens as `opens`, show each as a suggestion to accept (through `acceptAppSuggestion`, kept as a document version with the lineage) or decline, and hand its seat's MCP the read tool through `learned`.
- Updated dependencies [3648ead]
- Updated dependencies [a2c056b]
- Updated dependencies [4fe45a2]
- Updated dependencies [b73b543]
- Updated dependencies [865d43a]
  - @graview/core@0.1.55
  - @graview/tools@0.1.55
  - @graview/skills@0.1.55
  - @graview/ship@0.1.55
  - @graview/guest@0.1.55

## 0.1.54

### Patch Changes

- Updated dependencies [57e12bc]
- Updated dependencies [cdef481]
- Updated dependencies [0270ca9]
- Updated dependencies [0270ca9]
- Updated dependencies [0270ca9]
- Updated dependencies [4a38be3]
- Updated dependencies [094255d]
- Updated dependencies [cdef481]
- Updated dependencies [7324969]
- Updated dependencies [0270ca9]
- Updated dependencies [094255d]
  - @graview/core@0.1.54
  - @graview/ship@0.1.54
  - @graview/guest@0.1.54
  - @graview/skills@0.1.54
  - @graview/tools@0.1.54

## 0.1.53

### Patch Changes

- Updated dependencies [a1acdc1]
- Updated dependencies [642145e]
- Updated dependencies [642145e]
- Updated dependencies [e30703c]
- Updated dependencies [e30703c]
- Updated dependencies [642145e]
- Updated dependencies [6afe99b]
  - @graview/core@0.1.53
  - @graview/guest@0.1.53
  - @graview/skills@0.1.53
  - @graview/ship@0.1.53
  - @graview/tools@0.1.53

## 0.1.52

### Patch Changes

- Updated dependencies [821be82]
- Updated dependencies [1a65f86]
  - @graview/core@0.1.52
  - @graview/ship@0.1.52
  - @graview/skills@0.1.52
  - @graview/guest@0.1.52
  - @graview/tools@0.1.52

## 0.1.51

### Patch Changes

- Updated dependencies [920641e]
- Updated dependencies [8fbe98f]
- Updated dependencies [0956b46]
- Updated dependencies [195aa49]
  - @graview/core@0.1.51
  - @graview/ship@0.1.51
  - @graview/guest@0.1.51
  - @graview/tools@0.1.51
  - @graview/skills@0.1.51

## 0.1.50

### Patch Changes

- Updated dependencies [1f7fd19]
- Updated dependencies [d871ec9]
- Updated dependencies [a2ae894]
- Updated dependencies [14a74ed]
- Updated dependencies [5edb2e7]
- Updated dependencies [cd50cab]
- Updated dependencies [46dc821]
  - @graview/core@0.1.50
  - @graview/ship@0.1.50
  - @graview/tools@0.1.50
  - @graview/guest@0.1.50
  - @graview/skills@0.1.50

## 0.1.49

### Patch Changes

- 4ca00a7: The app's own actor can now find what to suggest, and a host can run it on a schedule. `@graview/tools/tidy` holds three judges that read the store as the actor sees it — `duplicates` (two records of a kind with one name, or one email or code, merged into the one with more links), `links` (a record whose text names another record, linked through a relation the app already declares and only where its cardinality allows; a name two records share links neither), and `archive` (a record its kind says is finished — its lifecycle, its main choice field read as the map reads it, or a done flag — unchanged for 30 days) — each giving its calls with a basis a person reads and a confidence. `dream(store, { now, limit })` runs them once as "Graview, tidying" and suggests each, surest first: never what a person declined, never twice what already waits, never about a record left alone, changed in the last day, or of a kind or relation the app says is never tidied. It applies nothing on its own unless the host passes `applyAtLeast`, since a declaration says only where the actor may never act; a model in the Fast slot's shape may weigh each candidate, and the run stands on the judges' own word when it does not answer. It returns what it did by judge. `whileAway(store, { seq })` is the tray's line: "2 suggestions waiting · tidied 12 things while you were away". A host that judges elsewhere suggests through the new `suggest_changes` tool, listed only for a seat that says `automated: true` and refused to any other in a sentence, and `graview dream <entry> --data ./data` runs it against a folder or a SQLite file. The tidying skill says how.
  
  Compatibility: additive — a new entry, `@graview/tools/tidy`, a new `graview dream` command, and a new tool, `suggest_changes`, listed only for an automated seat; every other seat's tool names and input schemas are unchanged. Ops, stored formats and the wire are unchanged: a suggestion is the op `suggest` already writes.
- 1f80e4a: The app's own actor now leaves the judging to a System One model when the host lends one, and keeps code to finding, routing and making. `dream(store, { ai })` (or `{ model }`) puts forward far more than an exact match: two records of a kind that share a telling word, a key value or a near hit from the host's `near` ranker; a record whose text mentions another's name or one of its words; an empty choice field; an empty one-link relation. Each candidate is one request to the model, its records as named JSON as the actor may see them and every question about them together — a Score for whether two are the same thing with a Noul for the name and each key field, a Choice among the likeliest far records with "none of these" for each declared relation, a Noul for "finished or no longer relevant" with how long it has been unchanged and how its kind says it is finished, and, for the new `categorize` judge, a Choice over a field's options with "none fits". Code maps each answer to a confidence (a Score's expected level, a Choice's probability and its margin, a Noul's probability) and routes it by how much the change would undo (`BANDS`: merge 0.9 to act and 0.5 to ask, archive 0.85 and 0.55, a link or a filled choice 0.8 and 0.45; a split choice never acts): made unasked only where the host's `applyAtLeast` allows, suggested with a basis a person reads ("Jev: 0.93 that “Acme Corp” and “ACME Corporation” are the same vendor") and the model named in the lineage, or dropped. It asks six at a time within a run's budget of 60 requests and 200,000 input tokens, keeps each answer by a hash of what was asked (`memoryDreamCache`, or the host's own `DreamCache`) so an unchanged record is not asked again, and reports what it spent. Without a model, or where it failed or the budget ran out, the deterministic judges stand as the floor. `graview dream` takes `--model jev-latest` (with TYPESAFE_API_KEY), `--max-requests` and `--cache <file>`.
  
  Compatibility: additive — `@graview/tools/tidy` gains `categorize`, `missingLinks`, `BANDS`, `routeOf`, `memoryDreamCache`, `systemOneOf` and their types, a judge may say its `severity`, a run's report its `usage` and `budget`, and an outcome may be `dropped`; `graview dream` gains three flags. Ops, stored formats, the wire and every seat's tools are unchanged: a judgment is the suggestion or the lineage-carrying change `suggest` and `applyAll` already keep.
- Updated dependencies [1c1bfcd]
- Updated dependencies [81a6028]
- Updated dependencies [8993971]
- Updated dependencies [ec8c429]
- Updated dependencies [ee70d83]
- Updated dependencies [9dab8bb]
- Updated dependencies [4ca00a7]
- Updated dependencies [1f80e4a]
- Updated dependencies [908367d]
- Updated dependencies [5f1603f]
- Updated dependencies [1c1bfcd]
  - @graview/tools@0.1.49
  - @graview/core@0.1.49
  - @graview/ship@0.1.49
  - @graview/skills@0.1.49
  - @graview/guest@0.1.49

## 0.1.48

### Patch Changes

- Updated dependencies [29f5e0d]
- Updated dependencies [29f5e0d]
- Updated dependencies [04a9246]
- Updated dependencies [7c9b1ae]
- Updated dependencies [5b30150]
- Updated dependencies [7c9b1ae]
- Updated dependencies [7c9b1ae]
- Updated dependencies [29f5e0d]
  - @graview/core@0.1.48
  - @graview/skills@0.1.48
  - @graview/tools@0.1.48
  - @graview/ship@0.1.48
  - @graview/guest@0.1.48

## 0.1.47

### Patch Changes

- f772aff: `graview shots` pictures the whole of a place taller than the window, not the window's worth. Threat Watch's "By type" — fourteen threats in four groups, about 1,400 pixels on a desk — came out 900 pixels tall, cut off after the worms with Ransomware and Zero-days missing, because the page the preview serves is the app's embed: a box the window's height with the bar on top, the place scrolling inside it (`[data-embed-content]`) rather than the document, and Playwright's full-page picture measures only the document. The box is deliberate — the bar stays where it is, the scene fills the same box, and an embed on somebody else's page never takes over that page's scroll — so the fix is in `shots`: once the place says it has drawn, the window is grown by what the place's scroller still hides, measured again after the place has had the room (a few times at most, up to 16,000 pixels, Chromium's tallest picture), and then photographed. The scene face is pictured at the window as before. `ship`'s tests grow the window by what is hidden, measure again when the place drew more, leave a place that fits alone and stop at the tallest picture; `verify-preview`'s claim `aFullPagePictureOfALongPlaceShowsTheWholePlace` photographs By type at 1280 and reads the picture back: 1,408 pixels tall, its last row's ink at 1,311.
  
  Compatibility: a behavior change in `graview shots` only — a pages-face picture of a place taller than the window is taller than the window, where it was cut at the window's height. The API, the embed, the routed face, the wire, the stored formats and the derived tools are unchanged.
- Updated dependencies [6d84721]
- Updated dependencies [7478654]
- Updated dependencies [f85abad]
- Updated dependencies [ed05ba4]
- Updated dependencies [6f9bf30]
- Updated dependencies [6f9bf30]
- Updated dependencies [f85abad]
- Updated dependencies [6f9bf30]
- Updated dependencies [f772aff]
  - @graview/core@0.1.47
  - @graview/guest@0.1.47
  - @graview/skills@0.1.47
  - @graview/ship@0.1.47
  - @graview/tools@0.1.47

## 0.1.46

### Patch Changes

- Updated dependencies [15f234f]
- Updated dependencies [99d25eb]
  - @graview/core@0.1.46
  - @graview/guest@0.1.46
  - @graview/skills@0.1.46
  - @graview/ship@0.1.46
  - @graview/tools@0.1.46

## 0.1.45

### Patch Changes

- 7069188: A form for a visitor: one act of an app opened to people who never join the workspace — an RSVP, a sign-up — drawn alone, run as a visitor the host mints per answer, its answer landing as a record and nothing else of the app shown. Roadmap f-public-forms, filed by Graview Cloud: "The pieces are in place (people records, link roles, the files route); what is left is a form page per kind for a visitor with no account, a minted author per submission ('form:<token>'), abuse limits, and the plan gate." The framework's half is here; abuse limits, the plan gate and minting the token stay the host's.
  
  The declaration says the form: `forms.<name>` in a document, `forms` on `defineApp` — `act` (one that makes a record or acts on none), `title`, `intro`, `fields` (the arguments asked, in order; unsaid, every one a visitor could fill), `say` (what the visitor reads under "Received — thank you."), `submit` and `role` (`visitor`, unsaid). It is not a second permission system: a visitor is a principal holding that role, so the policy says what they may do and see as it says it for anybody — a grant lets the role run the act, and a sight that never names it keeps every record from it. `formVisitor(app, "rsvp", "form:<token>")` (`@graview/core/forms`) mints `{ kind: "human", id, name: "a visitor via the RSVP form", roles: ["visitor"] }`, so Activity names each answer for the form and never by its token (`nameOfAuthor` says "a visitor via a form" for a `form:` id that carries no name); `visitorForm(app, name)` resolves the act, the fields and the words; `formReceived` is what is said after. `graview check` holds a form to what a visitor can do: `form-unknown-act`, `form-act-on-a-record`, `form-without-sight` (no policy, or one that says nothing of who sees what, so the visitor would be served every record), `form-act-not-granted`, `form-field-unknown`, `form-omits-required` and `form-field-unfillable` (a required picker over records the visitor is not served, or a field their sight keeps from them) are errors; `form-visitor-sees` (a sight serves the visitor a kind — to everybody, or by name where no picker asks for it) and `form-visitor-may-more` (the role may run acts no form opens) are warnings.
  
  `@graview/embed/form`'s `mount(el, { app, form: "rsvp", principal: "form:<token>", remote })` draws the form alone — no bar, no lists, no record, no seat — over the store as the visitor is served it, runs the act as them, says it was received in the declaration's words with the keyboard on what it said, and tells `onSubmitted`; `principal` is the minted id or the visitor whole, and a form the declaration has not got is refused by its name. `@graview/pages/visitor-form`'s `VisitorFormPage` is the same for a React host. The derived form asks the arguments `only` names in that order. `graview preview` serves each form at `/forms/<name>`, a visitor minted per page and handed only what that visitor is served, and the page's head no longer preloads the preview seat's document there. The store, the act and the served seat needed nothing new: the visitor's seat is served nothing, its log withholds every record, and an id it guesses is refused as missing.
  
  `core`'s tests read the form from a document and give it back, resolve its fields and words, mint the visitor, run the act as them and find the record on the whole store and its author named for the form, refuse another act, serve the seat nothing before and after its answer (its answer and its log name no other record, and a guessed id is told the same as an absent one), and say every finding; `pages`' draw the RSVP alone, submit as the visitor and say it was received; `embed`'s mount it and answer it. `pnpm verify preview` opens `/forms/rsvp` over a seeded RSVP at 390 and 1440 in Chromium, WebKit and Firefox: the title and its four fields, no bar and no link, nothing sideways, the guest on the store as "a visitor via the RSVP form" with a visitor minted per page, the keyboard on "Received", and none of the records already there drawn on the page or in anything the server sent it. The `graview-visitor-forms` skill says the declaration, the grant and the mount, and `graview-permissions` points at it. A visitor's form alone is a new bundle budget, set at 373_310 / 143_118 (380_000 / 146_000), with none of the bar, the notices or the first look (the frame's store and host scheme are a module of their own, `frame-light.ts`). A hosted page carries 0.2 KB more up front (232 bytes, 87 gzipped: the document's `forms` shape and "a visitor via a form"), and the compiled page 0.1 KB (88 bytes, 45 gzipped), under a raise of each budget by that (`scripts/budget-raises/a-form-for-a-visitor-a-hosted-page*.json`); the pages face alone 93 bytes over its budget minified, none gzipped, under a raise (`a-form-for-a-visitor-pages-face.json`).
  
  Compatibility: additive for the declaration and the document format — `forms` is a new optional key, which a build before this refuses in a document as a key it does not know; the `form-*` check codes are new. Additive in the API: `@graview/embed/form` (`mount`, `FormEmbed`, `FormEmbedOptions`, `FormEmbedHandle`), `@graview/pages/visitor-form` (`VisitorFormPage`), `formVisitor`, `visitorForm`, `formReceived`, `visitorSeesKind`, `pickersIn`, `VISITOR_ROLE`, `VisitorForm` on `@graview/core/forms`, `VisitorFormDeclaration` and `GraviewApp.forms`, `themeBaseCss` on `@graview/primitives/pages`. The wire, the stored formats and the derived tools are unchanged: a visitor is a seat like any other, said in the seat headers a host already believes.
- Updated dependencies [a811afc]
- Updated dependencies [7069188]
- Updated dependencies [7814c9f]
- Updated dependencies [22e7c65]
- Updated dependencies [0ffa768]
- Updated dependencies [fccd1d4]
- Updated dependencies [d151e35]
- Updated dependencies [bbde29f]
  - @graview/guest@0.1.45
  - @graview/skills@0.1.45
  - @graview/core@0.1.45
  - @graview/ship@0.1.45
  - @graview/tools@0.1.45

## 0.1.44

### Patch Changes

- Updated dependencies [68b7837]
- Updated dependencies [f750ed3]
- Updated dependencies [10ea092]
- Updated dependencies [2f524d0]
  - @graview/core@0.1.44
  - @graview/ship@0.1.44
  - @graview/skills@0.1.44
  - @graview/guest@0.1.44
  - @graview/tools@0.1.44

## 0.1.43

### Patch Changes

- Updated dependencies [3c6b0fa]
  - @graview/core@0.1.43
  - @graview/ship@0.1.43
  - @graview/skills@0.1.43
  - @graview/guest@0.1.43
  - @graview/tools@0.1.43

## 0.1.42

### Patch Changes

- Updated dependencies [a5bbda0]
- Updated dependencies [caf67fd]
- Updated dependencies [4fe0969]
- Updated dependencies [5a68fac]
- Updated dependencies [3aff737]
- Updated dependencies [f6b5bb7]
- Updated dependencies [93fccf0]
- Updated dependencies [6809e5a]
  - @graview/core@0.1.42
  - @graview/guest@0.1.42
  - @graview/skills@0.1.42
  - @graview/ship@0.1.42
  - @graview/tools@0.1.42

## 0.1.41

### Patch Changes

- @graview/core@0.1.41
  - @graview/guest@0.1.41
  - @graview/ship@0.1.41
  - @graview/skills@0.1.41
  - @graview/tools@0.1.41

## 0.1.40

### Patch Changes

- b98303b: A face names what its first draw opens, and a hosted page on a phone draws Pages with no chunk asked for after the face's own (FR-194). Graview Cloud names in its page's head every chunk its shell's startup doors open, but a face opens doors of its own as it draws — on the pages the home's lenses, a list's arranging, the bar's Activity and a form's date box; on the scene the relations' ribbons, the city's ground, the districts' states and the way back — each found only once the face had run, a round trip after it on a phone. And what is fetched before it is wanted went out while the place was still drawing: the acts' pane, readied by the keyboard the page put on a title and drawn on every routed page for a selection it draws nothing for there, a date's editor, the other face at a desk. `pnpm verify first-load` counted 41 to 45 scripts asked for after the face on the preview's home and list before the place said `data-graview-drawn`.
  
  They stay doors — a page that never draws a lens never runs one — and `@graview/embed/first-draw`, a new entry for a host's build, names them: `firstDrawChunks(metafile, face)` reads esbuild's metafile and returns the chunks a face's first draw asks for, each door's chunk and every chunk it imports outright, and `FIRST_DRAW_DOORS` is the list it reads, each door `{ package, module }`. `graview preview`'s page asks for them from its head once the face's own chunks have arrived (named beside the face, they took a phone's bandwidth from it and the face drew 0.65 s later). What is fetched early now waits until the place has first drawn and settled (`afterFirstDraw`, `firstDrawn`, `placeWatched` and `placeDrawn` on `@graview/react` and its `/provider`, said by the embed's drawn signal; at once where nothing watches a place), the keyboard put on the page as it draws readies no menu, and the routed face no longer draws the acts' pane for a selection.
  
  Measured by `pnpm verify first-load`, three cold runs on a phone (four times slower CPU, slow 4G), before and after: the roadmap draws and settles in 4.50 s, from 4.96 s, and is interactive in 4.85 s, from 5.30 s; the tasks settle in 4.63 s, from 5.12 s; the first useful paint is unchanged (3.55 s and 3.49 s). Before the home has drawn the roadmap asks for 75 requests and 478 KB, from 78 and 495 KB, and nothing after the face, on both profiles and both apps (`…DrawsPagesWithNoChunkAskedForAfterTheFace`, a new claim of the harness, which also says the time to `data-graview-drawn`). A hosted page carries 0.3 KB more up front for it (307 bytes, 132 gzipped; the compiled page 307 and 143), under a raise of each budget by that, and the scene face 413 bytes more before it draws. `capabilities().shipped` gains FR-194.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` gains FR-194. New: the `@graview/embed/first-draw` entry (`firstDrawChunks`, `FIRST_DRAW_DOORS`, and the types `FirstDrawFace`, `FirstDrawDoor`, `FirstDrawMetafile`), and `afterFirstDraw`, `firstDrawn`, `placeWatched`, `placeDrawn` on `@graview/react` and `@graview/react/provider`. The acts' pane, a date's editor and the other face are fetched once an embed's place has first drawn rather than at the first idle moment. What Graview Cloud does: at build, `firstDrawChunks(metafile, face)` for the face the shell opens on (`"pages"` on a phone, `"graview"` at a desk), less the chunks the head already names, and asks for them once the face's own `modulepreload` links have loaded, as `graview preview`'s head does.
- 674748e: `graview shots` and `graview preview` picture an app declared in code, as they picture a document (W-245, the thirteenth walk, a camera-trap survey). Both said "a declaration document (a .json file) is required", so the survey, declared in code, could picture its contact sheet — a view proposed and not kept — only over a document written for the purpose, and a document written from the app (`toDocument`) leaves out every act, rule and label that is code. Now both take the app module `graview check` takes (`./dist/domain/app.js`, or any module whose default export or `app` is the app): the store runs the app as Node loaded it, and the page is handed its module bundled for a browser — with the project's esbuild, which a project built with vite has; without one, the command says how to add it — at `/graview/app.js`, in place of the document. The page sits as a person holding every role the app's policy declares, unless `--as` or `--roles` say who; a lens hidden from the place menu is not written back into code, so a code app's lenses are not removed from there. `servePreview` takes `code: { app, bundle }` in place of `document`, and `bundleAppForPage(entry)` makes the bundle. The `graview-host-page` skill says so, and `pnpm verify preview` photographs a code app's draft view by its title.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. `/graview/document` on a preview of an app in code answers `{ module: "/graview/app.js", principal, state, views, draftView? }`, and a document's preview answers as it did. New: `code` on `servePreview`'s options (`document` is now optional, one of the two); `bundleAppForPage`, `findBundler`, `NO_BUNDLER` and `PREVIEW_APP_PATH` on `@graview/ship`. What Graview Cloud does: nothing — its apps are documents.
- Updated dependencies [b5c1332]
- Updated dependencies [b98303b]
- Updated dependencies [bdb45b6]
- Updated dependencies [749a684]
- Updated dependencies [686b2e4]
- Updated dependencies [9a8b622]
- Updated dependencies [4088496]
- Updated dependencies [a9502b7]
- Updated dependencies [39106b6]
- Updated dependencies [2ff7c28]
- Updated dependencies [04fe262]
- Updated dependencies [56b88e1]
- Updated dependencies [4aa429f]
- Updated dependencies [674748e]
- Updated dependencies [380c236]
- Updated dependencies [752da2b]
- Updated dependencies [ac694b7]
- Updated dependencies [6fc222b]
- Updated dependencies [68ebfd2]
- Updated dependencies [6959652]
  - @graview/core@0.1.40
  - @graview/guest@0.1.40
  - @graview/ship@0.1.40
  - @graview/skills@0.1.40
  - @graview/tools@0.1.40

## 0.1.39

### Patch Changes

- 1d365af: A page opens on a view proposed and not kept, so a proposal can be seen before it is kept (FR-187). `propose_view` tries a view headless and answers in words; an agent that wanted to see it at 390 px in dark had to keep it first, because the hosted page drew only the app's views. Now `mount` takes `draftView` (`EmbedDraftView`: a worker view's `manifest` and its `source`, or `worker`, with what else a `WorkerViewDefinition` takes) and draws it for the seat at the keyboard where its manifest attaches — the home, a kind's list at the place its title names, each record's page — under one line, "Draft — <title> · Not kept", in a group named "Draft: <title>" (`[data-graview-draft-view]`), as the seat's drawn panel is marked on `/~draft`. A kept view of the same name is the one it stands in for: whatever the host's `views` registers under that name is left out, so it is drawn nowhere beside the draft. Nothing of it is kept: it goes by no name the place menu or `keptViews` could keep it under, the store is not written, and the next page, handed no draft, has none. A draft that is stopped says why in its place instead of standing the kind's own face there, and playback draws it as proposed. With FR-188's `data-graview-drawn`, a host pictures it once it has drawn. `registerWorkerView` takes `draft: true` on the definition for a host that registers one itself. `graview preview` and `graview shots` take one as `--view <view.js> --manifest <manifest.json>`, handed to the page with the document (`servePreview`'s `draftView`). The worker's host is fetched before the embed draws, and only when a draft is handed: a hosted page carries 0.7 KB more up front for it (the compiled page too), and their budgets are raised by that; the pages face, the embed, the studio handed in and the guest host registering a view by what they measured, and every face, counted with every chunk, by the worker's host and the open kit it can now fetch. `capabilities().shipped` gains FR-187.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` lists FR-187. New: `draftView` on `mount` and `<Embed>`, `EmbedDraftView` on `@graview/embed`, `WorkerViewDefinition.draft` on `@graview/guest/host/views`, `PreviewOptions.draftView` on `@graview/ship`; `/graview/document` from `graview preview` carries `draftView` when one was given. `@graview/embed` depends on `@graview/guest`. What Graview Cloud does: serve a proposed view once — a one-time draft id on the picture's address, say, that the shell trades for the manifest and source — and pass it to `mount` as `draftView`, then picture the address where it attaches once `[data-graview-drawn]` is on the root.
- Updated dependencies [77a235a]
- Updated dependencies [e577880]
- Updated dependencies [79a3dfd]
- Updated dependencies [f3af490]
- Updated dependencies [1d365af]
- Updated dependencies [6bff55b]
- Updated dependencies [99ed9e7]
- Updated dependencies [c9c13d2]
- Updated dependencies [817aaba]
- Updated dependencies [a455281]
- Updated dependencies [3bfdf76]
- Updated dependencies [38ea99a]
- Updated dependencies [328235d]
  - @graview/core@0.1.39
  - @graview/guest@0.1.39
  - @graview/ship@0.1.39
  - @graview/skills@0.1.39
  - @graview/tools@0.1.39

## 0.1.38

### Patch Changes

- 91f5168: A view is hidden, shown, deleted and restored from the place menu. Views pile up as chats draw them, and the person annoyed by the clutter is standing at the places drop-down: now the place you are on in the bar, and each place in its drop-down, open the Pages menu — a right-click, Shift+F10 or the menu key, a finger resting on it — with Hide and Delete for a view. Hide takes it off the places, the scene's places and the home's gallery for everyone, still at its address; the drop-down's foot lists it under Hidden with Show. Delete takes it out of every face and lists it under Recently deleted with Restore, and the day it is gone for good, thirty days on; deleting the place you are on takes you to its kind's own place, else home, on Pages and the scene alike. A script view a chat drew is the host's: `mount`'s new `keptViews` (and the whole-page `Shell`'s, and `GraviewProvider`'s) (`KeptViews` from `@graview/core`: `current()`, `onChange`, `hide`, `show`, `remove`, `restore`, and `lens`) is where the page asks, and `current().may` says what this viewer may — the views a chat drew for an owner or an editor, the declaration's lenses for the owner. A declared lens is hidden with `set-lens-hidden` and deleted with `remove-lens`, handed to `lens` as a change to the declaration the host writes with its rollback. `registerWorkerView` registers a view under its manifest's `name` and `registerDeclaredLenses` marks a lens `declared`, which the menu reads; a view the app's own code registers is offered neither. A served store answers `/graview/views` (`createStoreHandler`'s `views` and `mayTidyViews`, `remoteViews` from `@graview/ship/browser` for the page), `graview serve` keeps what was tidied in `views.json` beside the store, `graview preview` writes a declared lens's change into the document it holds, and `devViews()` from `@graview/ship/dev` is the dev server's door. `memoryViews` and `placeTidying` (whether this viewer may tidy a place, and how) are on `@graview/core`, and `useTidiedViews` — the registry as the host's tidying leaves it — on `@graview/react`. A page carries only what hears the gesture and says the drop-down's foot has something to list: which place, whether a finger rested, what a press on the menu's rows does, the toast, the foot and the tidying are fetched on first use, and the registry's tidying only once the host lists something hidden or deleted. A hosted page carries 1.7 KB more up front for it (the compiled page too); their budgets are raised by that, and the pages face, the embed, every face and the guest host by what they measured.
  
  Compatibility: ops, stored records, the declaration and derived tools are unchanged. The wire: a new route, `/graview/views` (GET what is hidden and recently deleted and what the asking seat may do; POST `{ hide | show | remove | restore: name }` or `{ lens: set-lens-hidden | remove-lens }`), and `createStoreHandler` takes `views` and `mayTidyViews`; every other route answers as before. New: `KeptViews`, `KeptViewsState`, `KeptViewsMay`, `RemovedView`, `LensTidyEdit`, `memoryViews`, `placeTidying`, `NO_KEPT_VIEWS`, `REMOVED_VIEW_DAYS` and `removedLensName` on `@graview/core`; `ViewMeta`, `ViewRegistration` and `Place` take `name` and `declared`; `keptViews` on the embed, the pages embed, `Shell` and `GraviewProvider`, `GraviewContextValue.keptViews`, `KeptViewsProvider`, `useTidiedViews` and `PLACE_MENU_EVENT` on `@graview/react`; `ViewTidyingSections`, `useViewTidyingSection`, `TidyGroups`, `useTidied`, `placeAfter`, `useKeptViewsState`, `placeGesture`, `openPlaceMenu`, `placeAim` and `PLACE_MENU_EVENT` on `@graview/primitives`; `answerViews`, `keepsTheApp`, `remoteViews`, `fileViews` and `VIEWS_PATH` on `@graview/ship`, `devViews` on `@graview/ship/dev`. What Graview Cloud does: keep each app's hidden view names and its deleted views (with the definition and its versions, thirty days, then gone), answer `KeptViews` for the viewer with `may` from their share (owner and editor: views; owner: lenses), write a lens's edit as a change with its usual undo, keep registering a deleted view's definition while it is kept so Restore brings it back in place, and pass the object as `keptViews` to `mount`.
- 5bd37dc: The first load asks for nothing it does not draw again. The place menu's tidying had put a round trip and six requests in front of the first paint: the preview's page asked `/graview/views` only after the document came, and waited for the answer before it drew; the frame fetched what tidies the registry though nothing was hidden; and the routed face's first chunks carried what a press on Hide or Delete does, the drop-down's foot and the gesture's reading, while the bar's panes carried the hover chips' switch. Now `graview preview` hands the views with the document, as it hands the store's state, and `remoteViews` starts from them (`state`) without asking; `useTidiedViews` fetches `tidyViews` the first time the host lists something hidden or deleted; the menu's rows decide what they offer as the menu opens and fetch what a press does while the pointer rests on them; the foot is fetched when the drop-down opens with something to list, the gesture's reading with the bar's panes; and the person's menu fetches the hover chips' switch only where the host offers chips. On a slow phone the roadmap is useful in 3.5 s where it took 4.1 and interactive in 5.3 s where it took 5.9, on 75 requests where it took 80, as main measured it before the batch; the tasks are useful in 3.4 s where they took 4.1.
  
  `tidyViews` is no longer on `@graview/react`'s main entry, which put it in every chunk that imports that entry: a host hands `keptViews` and `useTidiedViews` does the rest. The rule for whether a viewer may tidy a place is `placeTidying` on `@graview/core` (it was `tidyingOf` on `@graview/primitives`, a name core's suggestions already use), and `PLACE_MENU_EVENT` is on `@graview/react/provider` beside the menu it opens, still re-exported by `@graview/primitives`; `useKeptViews` is gone from `@graview/primitives`. The routed face alone loads 5.4 KB (2.0 KB gzipped) less before it draws; up front, a hosted page carries 0.3 KB more for the frame following the host's views itself, and the place menu's raises are measured again.
  
  Compatibility: the preview's `/graview/document` carries `views`, the answer `/graview/views` gives its seat; `remoteViews` takes an optional `state`. Ops, stored records, the declaration and derived tools are unchanged.
- Updated dependencies [28a63eb]
- Updated dependencies [91f5168]
- Updated dependencies [5bd37dc]
- Updated dependencies [b321ddf]
- Updated dependencies [9c45f5d]
  - @graview/core@0.1.38
  - @graview/skills@0.1.38
  - @graview/guest@0.1.38
  - @graview/ship@0.1.38
  - @graview/tools@0.1.38

## 0.1.37

### Patch Changes

- Updated dependencies [a130326]
- Updated dependencies [7fa2dbc]
- Updated dependencies [cf691f4]
- Updated dependencies [d689fbc]
- Updated dependencies [9121a9c]
- Updated dependencies [862ab8c]
- Updated dependencies [f860e41]
- Updated dependencies [49d0ed8]
- Updated dependencies [7d6f521]
- Updated dependencies [f97a149]
- Updated dependencies [d689fbc]
- Updated dependencies [34fa7b9]
- Updated dependencies [0d440e2]
- Updated dependencies [e56c351]
  - @graview/core@0.1.37
  - @graview/guest@0.1.37
  - @graview/ship@0.1.37
  - @graview/skills@0.1.37
  - @graview/tools@0.1.37

## 0.1.36

### Patch Changes

- Updated dependencies [9f3e1d1]
- Updated dependencies [8536e92]
- Updated dependencies [8536e92]
  - @graview/core@0.1.36
  - @graview/ship@0.1.36
  - @graview/guest@0.1.36
  - @graview/skills@0.1.36
  - @graview/tools@0.1.36

## 0.1.35

### Patch Changes

- Updated dependencies [d33bc19]
- Updated dependencies [ac91d40]
- Updated dependencies [f2666ed]
  - @graview/core@0.1.35
  - @graview/skills@0.1.35
  - @graview/guest@0.1.35
  - @graview/ship@0.1.35
  - @graview/tools@0.1.35

## 0.1.34

### Patch Changes

- Updated dependencies [5fc86f5]
- Updated dependencies [f48b7d1]
- Updated dependencies [8f09e52]
- Updated dependencies [2324ad3]
- Updated dependencies [b320b36]
- Updated dependencies [9c79c96]
- Updated dependencies [55ab33c]
- Updated dependencies [9c79c96]
  - @graview/tools@0.1.34
  - @graview/core@0.1.34
  - @graview/skills@0.1.34
  - @graview/guest@0.1.34
  - @graview/ship@0.1.34

## 0.1.33

### Patch Changes

- Updated dependencies [01fc2ce]
- Updated dependencies [a583b18]
  - @graview/core@0.1.33
  - @graview/ship@0.1.33
  - @graview/skills@0.1.33
  - @graview/guest@0.1.33
  - @graview/tools@0.1.33

## 0.1.32

### Patch Changes

- Updated dependencies [7d1c3e1]
  - @graview/core@0.1.32
  - @graview/guest@0.1.32
  - @graview/ship@0.1.32
  - @graview/tools@0.1.32
  - @graview/skills@0.1.32

## 0.1.31

### Patch Changes

- 6009469: An app says which calendar it keeps in step with in its own declaration, rather than in code. A document's `connections.<name>` names the system (`google-calendar`), the calendar (or the environment variable holding its id), the kind its events are and which field holds each part of one, a filter (the whole calendar, one of Google's colors by name, or a title tag such as `#graview`, kept in the title or not), the direction (`read`, where the calendar owns the kind and an act here that would change one is refused with a sentence saying so, or `both`) and the conflict policy. `graview check` says each wrong shape at its place: a kind or field the app lacks, a field of the wrong type, a color Google has no name for, a tag that is not one word, and an app with no act to land an inbound change through. A `date` field is an all-day event's day, its end inclusive here; a `datetime` field a timed event's instant. Filters apply as events arrive, since Google refuses a sync token beside a search: an event that leaves the filter is gone here, and one made here carries the color or tag that keeps it in, and a private property naming the app. `graview serve` and `graview preview` run the connections beside the store, with credentials from the environment (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, or the prefix and file `auth` names), each pass credited to `google-calendar` in Activity and the cursor kept in `connections.json` beside the data; `--no-sync` or a declared `paused` leaves them off. A host runs them with `runConnections` from `@graview/ship` or `@graview/ship/runtime`, handing its own `token({ connection, refresh })` and a place to keep their state. The studio carries an app's connections through an edit, the calendar following a renamed kind.
  
  A page that draws an app reads `connections` loosely and carries none of this, so a hosted page is unchanged; the studio's checker judges them, which adds 5.6 KB (2.1 KB gzipped) to every face and to the embed with the studio handed in, and those raises are filed in `scripts/budget-raises/`.
  
  Compatibility: the declaration and check finding codes: a document may carry `connections` (until now an unknown key), and `graview check` adds `connection-kind`, `connection-field`, `connection-field-type`, `connection-when`, `connection-filter`, `connection-color`, `connection-tag`, `connection-creates`, `connection-edit` and the warning `connection-remove`; a document without `connections` compiles and checks as before. New: `GraviewApp.connections`, `connections` in `document.schema.json`, and on `@graview/core/sync` `connection`, `connectionMapping`, `creatingAct`, `inConnectionFilter`, `isDayField`, `GOOGLE_COLORS`, `CONNECTION_TAG`, `MADE_BY_GRAVIEW`, `Connection`, `ConnectionDeclaration` and `ConnectionRun`, with `GoogleCalendarOptions.keep` and `.madeHere`; on `@graview/ship` and `/runtime` `runConnections`, `sayReport`, `GOOGLE_TOKEN_URL` and their types, and on `@graview/ship` `fileConnectionState`, `readEnvFile` and `connectionsFileOf`; `PreviewOptions.connections` and `Preview.connections`; `graview serve` and `graview preview` take `--no-sync`.
- f7269b7: The first load and a page switch wait on less, and are timed (Roadmap f-perf-first-load, from "too slow to load initially and between pages"). `pnpm verify first-load` serves Graview Cloud's shell as `graview preview` builds it over a roadmap the Graview Roadmap's size and a small team's tasks, at a desk and on a slow phone, and CI holds its medians to a budget; docs/first-load.md has the numbers before and after. On the phone the roadmap is interactive in 5.2 s where it took 7.6, the tasks in 3.4 s where they took 5.1; at a desk the scene draws 37 ms after a press where it took 343.
  
  A press for the scene fetches it first and keeps the page drawn meanwhile, for at most 150 ms, rather than suspending into a placeholder that React then holds for 300 ms; at a desk the other face is fetched once the page is idle, and the bar's switch fetches a face as a hand or the keyboard reaches for it (`BarFace.reach`). A picture on the home is drawn as it comes within half a screen of the window, so a phone no longer fetches and lays out every lens before it answers a press. `openRemote` takes the store's first `state` when the host already sent it, and opens on it without asking; `graview preview` hands it with the document, and its page opens without waiting for the socket's welcome. `graview serve` and `graview preview` send their answers gzipped to a browser that takes them, and the preview's page names the chunks it needs in its head and asks for every chunk a door needs as the door is opened, rather than a level at a time.
  
  It adds 1.0 KB more up front to a hosted page (1,042 bytes, 405 gzipped), and its raises are filed in `scripts/budget-raises/`.
  
  Compatibility: the wire: a served answer is gzipped when the request accepts gzip (`content-encoding: gzip`, `vary: Accept-Encoding`), and the preview's `/graview/document` carries `state`, the answer `/graview/state` gives its seat; `openRemote` takes an optional `state`, and `RemoteState` is new on `@graview/ship`, `/browser` and `/runtime`. `BarFace` takes an optional `reach`.
- Updated dependencies [6009469]
- Updated dependencies [4784ba8]
- Updated dependencies [938721b]
- Updated dependencies [ff88015]
- Updated dependencies [6c92669]
- Updated dependencies [f7269b7]
- Updated dependencies [294f181]
- Updated dependencies [9a5e067]
- Updated dependencies [a2f741b]
  - @graview/core@0.1.31
  - @graview/ship@0.1.31
  - @graview/tools@0.1.31
  - @graview/skills@0.1.31
  - @graview/guest@0.1.31

## 0.1.30

### Patch Changes

- 412abf0: The graview command line is one line from PATH in a framework checkout. On a machine with the checkout and no published install there was no `graview` command, and every use was `node <checkout>/packages/graview/dist/cli.js`. The checkout's `pnpm graview:link` is `pnpm link --global` for `packages/graview` (after `pnpm setup` once, where pnpm has no global bin folder), written in the README's commands and AGENTS.md's; and `graview doctor`, run from a checkout with no `graview` on PATH, says so with that line and the full path to use until then — even in a folder with no package.json, which is where a document-only app lives.
  
  Compatibility: no surface changes. `graview doctor` may print one more note; its exit code is unchanged.
- Updated dependencies [6cbecc0]
- Updated dependencies [6862f3a]
- Updated dependencies [ed2a75d]
- Updated dependencies [6862f3a]
- Updated dependencies [4feaed1]
- Updated dependencies [6862f3a]
- Updated dependencies [e46f304]
- Updated dependencies [648fc05]
- Updated dependencies [6862f3a]
- Updated dependencies [37f2b3b]
- Updated dependencies [5b8ac1f]
- Updated dependencies [6862f3a]
- Updated dependencies [412abf0]
- Updated dependencies [e46f304]
- Updated dependencies [e46f304]
- Updated dependencies [37745ff]
- Updated dependencies [84ad32f]
- Updated dependencies [412abf0]
- Updated dependencies [412abf0]
- Updated dependencies [93770ac]
- Updated dependencies [6cbecc0]
- Updated dependencies [e46f304]
- Updated dependencies [6862f3a]
- Updated dependencies [5b8ac1f]
- Updated dependencies [6862f3a]
- Updated dependencies [6862f3a]
- Updated dependencies [f7c1a9e]
- Updated dependencies [1a1f996]
- Updated dependencies [6770f65]
- Updated dependencies [cf85240]
- Updated dependencies [56dbbe3]
- Updated dependencies [412abf0]
- Updated dependencies [91716ae]
- Updated dependencies [c70440c]
- Updated dependencies [c3564eb]
- Updated dependencies [412abf0]
- Updated dependencies [8ca608c]
- Updated dependencies [eb3bdb7]
- Updated dependencies [c3e789b]
  - @graview/core@0.1.30
  - @graview/skills@0.1.30
  - @graview/tools@0.1.30
  - @graview/ship@0.1.30
  - @graview/guest@0.1.30

## 0.1.29

### Patch Changes

- Updated dependencies [523149b]
- Updated dependencies [7966f5d]
- Updated dependencies [fcf84de]
- Updated dependencies [a43f829]
- Updated dependencies [55ec52b]
- Updated dependencies [dbe0a28]
- Updated dependencies [3f607a8]
- Updated dependencies [42dbfb7]
- Updated dependencies [a5c260f]
- Updated dependencies [3accacb]
- Updated dependencies [3cd624d]
- Updated dependencies [897c7bb]
- Updated dependencies [774d39c]
- Updated dependencies [933761a]
- Updated dependencies [2d3f806]
- Updated dependencies [dedefed]
- Updated dependencies
- Updated dependencies [8e09c51]
- Updated dependencies [307f2d4]
- Updated dependencies [11deba2]
- Updated dependencies [15c033b]
- Updated dependencies [3b06199]
- Updated dependencies [861b0b4]
- Updated dependencies [ed76a10]
- Updated dependencies [df64e2b]
- Updated dependencies [7bd102c]
- Updated dependencies [1076b0c]
- Updated dependencies [c893321]
- Updated dependencies [ee15ae3]
- Updated dependencies [ebabbd1]
- Updated dependencies [488aba6]
- Updated dependencies [4dbb23e]
- Updated dependencies [d8dc4c6]
- Updated dependencies [a047696]
- Updated dependencies [b61f093]
- Updated dependencies [0b722e4]
- Updated dependencies [05bac56]
- Updated dependencies [b61f093]
- Updated dependencies [3c16f27]
- Updated dependencies [4dbb23e]
- Updated dependencies [93a7636]
- Updated dependencies [73a9750]
- Updated dependencies [48b777a]
- Updated dependencies [4c545b7]
- Updated dependencies [0d585ba]
- Updated dependencies [5197748]
- Updated dependencies [952e526]
- Updated dependencies [4b12e16]
- Updated dependencies [8da8189]
- Updated dependencies [2ca4722]
- Updated dependencies [2450f9e]
- Updated dependencies [ac824fa]
- Updated dependencies [7da616c]
  - @graview/core@0.1.29
  - @graview/ship@0.1.29
  - @graview/tools@0.1.29
  - @graview/skills@0.1.29
  - @graview/guest@0.1.29

## 0.1.28

### Patch Changes

- Updated dependencies [085670c]
- Updated dependencies [10bac84]
  - @graview/core@0.1.28
  - @graview/skills@0.1.28
  - @graview/guest@0.1.28
  - @graview/ship@0.1.28
  - @graview/tools@0.1.28

## 0.1.27

### Patch Changes

- Updated dependencies [e404dd1]
- Updated dependencies [b228859]
- Updated dependencies [649dc1f]
- Updated dependencies [649dc1f]
- Updated dependencies [649dc1f]
- Updated dependencies [41c0ebc]
- Updated dependencies [b228859]
- Updated dependencies [af180f4]
- Updated dependencies [649dc1f]
- Updated dependencies [4ade99c]
- Updated dependencies [32d0c0d]
- Updated dependencies [32d0c0d]
- Updated dependencies [7fd403d]
- Updated dependencies [b228859]
- Updated dependencies [af180f4]
- Updated dependencies [b228859]
  - @graview/core@0.1.27
  - @graview/tools@0.1.27
  - @graview/skills@0.1.27
  - @graview/guest@0.1.27
  - @graview/ship@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [cf22161]
- Updated dependencies [8b7862d]
- Updated dependencies [26dbe52]
- Updated dependencies [26dbe52]
- Updated dependencies [26dbe52]
- Updated dependencies [8b7862d]
  - @graview/tools@0.1.26
  - @graview/core@0.1.26
  - @graview/ship@0.1.26
  - @graview/guest@0.1.26
  - @graview/skills@0.1.26

## 0.1.25

### Patch Changes

- Updated dependencies [d0eb455]
- Updated dependencies [21365f6]
- Updated dependencies [21365f6]
  - @graview/core@0.1.25
  - @graview/tools@0.1.25
  - @graview/guest@0.1.25
  - @graview/ship@0.1.25
  - @graview/skills@0.1.25

## 0.1.24

### Patch Changes

- Updated dependencies [6dbad14]
- Updated dependencies [e23f631]
- Updated dependencies [9fe145e]
- Updated dependencies [56f203f]
- Updated dependencies [cfe3b7a]
- Updated dependencies [e23f631]
- Updated dependencies [9fe145e]
- Updated dependencies [108721d]
- Updated dependencies [e23f631]
- Updated dependencies [079ccec]
- Updated dependencies [129f2fa]
- Updated dependencies [5b7e4c8]
- Updated dependencies [b68d1cc]
- Updated dependencies [32c54f1]
- Updated dependencies [791fb0c]
- Updated dependencies [56f203f]
- Updated dependencies [e23f631]
- Updated dependencies [8e1f679]
- Updated dependencies [6b60219]
- Updated dependencies [fe08229]
  - @graview/core@0.1.24
  - @graview/tools@0.1.24
  - @graview/skills@0.1.24
  - @graview/ship@0.1.24
  - @graview/guest@0.1.24

## 0.1.23

### Patch Changes

- Updated dependencies [8f7e998]
  - @graview/tools@0.1.23
  - @graview/core@0.1.23
  - @graview/skills@0.1.23
  - @graview/guest@0.1.23
  - @graview/ship@0.1.23

## 0.1.22

### Patch Changes

- f25b52c: A document and a snapshot can be looked at with no product. `graview serve` was the store and drew nothing, so a stranger holding a JSON document and a seed had to build a product to see them — n-dx built one only to look at its projection, and proved every change with Playwright screenshots it scripted by hand. `graview preview <document.json> --seed <snapshot.json>` serves the same store and, beside it, Graview's own faces over it: the scene and Pages, with the bar and the address bar, so a place can be linked and reloaded. Nothing is built or installed at run time: the page is bundled once at the framework's build, as Graview Cloud's shell is, into the `graview` package's `dist/preview/` (71 files, 1.2 MB unpacked, about 430 KB of the tarball), so it rides with the tool a person runs and never with a product's dependencies. The store is in memory unless `--data` or `--sqlite` say where to keep it, and the page sits as a person holding every role the document declares unless `--as` or `--roles` say who. `graview shots <document.json> [--seed] [--places home,overview,people] [--out shots] [--scheme light|dark|both] [--width 1280,390] [--faces pages,scene]` photographs places headless to `<place>-<scheme>-<width>.png`: each place by its address word or its title, or a path such as `/people/p1`, every place when none is named; a place the app has not got is refused with the ones it has. Playwright is a peer the person installs, found beside the project first; without it the command says how to install it and the browser. `servePreview` and `previewPrincipal` are exported from `@graview/ship`, and `serveStore` takes an optional `answer(request)` that is asked before the store for every request but the live wire. `pnpm verify preview` runs the built command on Graview Cloud's org document and asks a browser for both faces, a change on the served store reaching the open page, and the shots. The ship and new-app skills say when to use them.
  
  Compatibility: ops, stored formats, wire messages and routes, the document format, the compiled format, check finding codes and tool schemas are unchanged. Added: `serveStore({ answer })`, optional; a host that passes none serves exactly as before. The hosted page loads nothing more: no module it imports changed.
- f25b52c: `graview doctor` says whether a product is on one Graview release. One release is named five times in a product — the `@graview/*` pins, `graview` beside them, the lockfile, what is installed, and each document's `formatVersion` — and React's pair makes a sixth: n-dx's face met `react` 19.2.8 beside `react-dom` 19.3.0 as a blank page, since React 19.3 refuses a mismatched pair at startup. `graview doctor [<dir>] [--document <file>] [--json]` reads the product's package.json, the nearest lockfile (pnpm, npm, yarn or bun), its node_modules and every `.json` document in it that says it is a Graview declaration, and says each problem as a sentence with its fix: two releases among the pins ("pin them all to 0.1.20"), a pin the install or the lockfile does not follow, a lockfile holding a second copy, a document of a format the installed core does not read, and the React pair to pin. A pin that is a range, a package named by a path (a checkout, a workspace or a tarball), a document of an older format and a `graview` run at another release than the one pinned are said as notes. It exits 1 on any problem. `diagnose` is exported from `@graview/core/cli` for a host that wants the findings as data. The getting-started page and the `graview` README say the npx trap: inside a pnpm workspace that already holds a release in its hidden hoist, `npx -y graview@<version>` skips the install and finds no bin (`sh: graview: command not found`) — run the project's own `node_modules/.bin/graview`.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged. Added: a `doctor` command and `diagnose`, `doctor` and `DOCTOR_USAGE` on `@graview/core/cli`.
- Updated dependencies [9df7ef3]
- Updated dependencies [f25b52c]
- Updated dependencies [0f051ef]
- Updated dependencies [f25b52c]
- Updated dependencies [9154faf]
- Updated dependencies [9154faf]
- Updated dependencies [9154faf]
- Updated dependencies [0e1bafe]
- Updated dependencies [3399521]
- Updated dependencies [9154faf]
- Updated dependencies [f25b52c]
- Updated dependencies [9df7ef3]
- Updated dependencies [0e1bafe]
- Updated dependencies [6384676]
- Updated dependencies [e12c94b]
- Updated dependencies [0f051ef]
  - @graview/core@0.1.22
  - @graview/tools@0.1.22
  - @graview/ship@0.1.22
  - @graview/skills@0.1.22
  - @graview/guest@0.1.22

## 0.1.21

### Patch Changes

- Updated dependencies [5f2f3aa]
- Updated dependencies [615f368]
- Updated dependencies [eaffce3]
- Updated dependencies [25019d4]
- Updated dependencies [f062004]
- Updated dependencies [6bf435a]
  - @graview/core@0.1.21
  - @graview/skills@0.1.21
  - @graview/tools@0.1.21
  - @graview/ship@0.1.21
  - @graview/guest@0.1.21

## 0.1.20

### Patch Changes

- Updated dependencies [22c88be]
- Updated dependencies [ea77694]
- Updated dependencies [95a7248]
- Updated dependencies [95a7248]
- Updated dependencies [247506b]
- Updated dependencies [95a7248]
  - @graview/core@0.1.20
  - @graview/skills@0.1.20
  - @graview/tools@0.1.20
  - @graview/guest@0.1.20
  - @graview/ship@0.1.20

## 0.1.19

### Patch Changes

- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [a9f6971]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [41ed9af]
  - @graview/core@0.1.19
  - @graview/tools@0.1.19
  - @graview/skills@0.1.19
  - @graview/ship@0.1.19
  - @graview/guest@0.1.19

## 0.1.18

### Patch Changes

- Updated dependencies [44d109d]
- Updated dependencies [2fba4ab]
- Updated dependencies [b00d5cf]
- Updated dependencies [7f4f1bb]
- Updated dependencies [b26a186]
- Updated dependencies [ec2c73a]
- Updated dependencies [ba17b00]
- Updated dependencies [feb577a]
- Updated dependencies [33884db]
  - @graview/core@0.1.18
  - @graview/guest@0.1.18
  - @graview/tools@0.1.18
  - @graview/skills@0.1.18
  - @graview/ship@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [cc690c4]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
  - @graview/core@0.1.17
  - @graview/guest@0.1.17
  - @graview/skills@0.1.17
  - @graview/ship@0.1.17
  - @graview/tools@0.1.17

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
