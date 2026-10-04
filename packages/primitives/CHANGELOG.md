# @graview/primitives

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/layout@0.1.7
  - @graview/react@0.1.7
  - @graview/render@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- 94da01b: The embed's stylesheet keeps to its box (FR-64). `themeCss(scheme, brand, { scope })` put the tokens, the ground and the type on the scope, but every other rule was written for a whole page, so the `<style>` an embed renders still said `h1, h2, h3, h4`, `code, kbd, samp`, `button`, `button:hover:not(:disabled)`, `button:focus-visible`, `button:disabled` and `code` bare: on Graview Cloud's builder the host's own buttons below the studio took the framework's ink on a transparent ground and failed contrast in dark (3.41:1). With a scope, the finished sheet is now rewritten so every selector that does not already start at the box is under `:where(<scope>)`, inside @media and @supports too; `:where` weighs nothing, so each rule wins exactly the contests it won on a whole page, and only where it applies changes. The reader's motion answer is still asked of the document element and applied inside the box, and the registered `--graview-altitude` and the keyframes name no element. Without a scope the stylesheet is byte for byte what it was. A test reads every selector of every rule in the scoped sheet, in both schemes and two brands, and fails on any that could match outside the box; `verify-studio` mounts the studio in a host's page with the host's own `<button>`, `<h2>` and `<code>` below it and finds their computed styles the same as on that page with no embed, in dark and in light. The pages' gallery rule and the prose links' rule are keyed on Graview's own class and attribute, and the studio and the Shell bring no stylesheet of their own. `capabilities().shipped` names FR-64.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-64`. `themeCss` without a scope is unchanged; with one, the same rules in the same order, each held inside the scope. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/layout@0.1.6
  - @graview/react@0.1.6
  - @graview/render@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
- 6ff733b: The stylesheet's notes stay in the source and out of the page. `themeCss` explained its rules in CSS comments inside the template it returns, so every page carried them and every embed parsed them into its `<style>`: 25 KB of the 60 KB the function was. They are now JavaScript comments in an empty interpolation, `${/* … */ ""}`, beside the rules they explain, and a minifier folds them away; the CSS a page receives is the same rules, without the prose.
  
  Compatibility: unchanged. `themeCss` returns the same rules in the same order; only the comments between them are gone from its output.
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
  - @graview/core@0.1.5
  - @graview/react@0.1.5
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5
  - @graview/render@0.1.5

## 0.1.4

### Patch Changes

- 0183340: A tool's schema does not depend on zod's minor version. An agent tool's input schema is a stability surface, and zod writes its own regex for a string format — `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.iso.date()` — beside the format's name. That regex differs between zod 4.4.3, which this repository locked, and 4.6.5, which a consumer resolves from the published ranges, so Cloud's tool-schema snapshot saw sixteen "inputSchema changed" entries that were only zod's regex. `toJsonSchema`, and with it `mutationToolSchema`, `nodeJsonSchema`, `schemaJson` and the conformance kit's tools, now says a format string by its JSON-schema `format` alone (`email`, `uri`, `uuid`, `date-time`, `date` …) and drops zod's `pattern`; a pattern the author wrote with `.regex(…)` is kept, beside the format where there is one. Moving the workspace to zod 4.6.5 found a second dependence on zod's internals: zod 4.6 no longer fills a schema's `_zod.bag` as it builds it, so `describeArg` lost a number's bounds and a date's pattern, and a date argument was asked for as free text. It now reads the checks on the definition, which both versions keep. Every package's zod range is now `^4.6.5`, so the tests run on what a consumer gets.
  
  Compatibility: tool input schemas — a format-based string no longer carries zod's regex `pattern`, only its `format` (an `email` property is `{ "type": "string", "format": "email" }`); a `z.url()` property is unchanged, and an author-written pattern is kept. A snapshot of a tool surface taken with either zod version changes once, for those properties only, and then holds across zod minors. The conformance kit's recorded fixtures are unchanged: none declares a format string, and the lock holds. `describeArg` and `argShape` answer as they did on zod 4.4 for every schema, now on 4.6 too. Every package's `zod` dependency moves from `^4.4.3` to `^4.6.5` (products never install zod; `@graview/core` re-exports it). The embed's bundle budgets rise with zod 4.6, which gives every schema type its own JSON-schema processor: the pages face alone from 815,000 / 220,000 to 950,000 / 252,000 bytes and every face from 1,150,000 / 330,000 to 1,290,000 / 362,000 (minified / gzipped), about 130 kB / 30 kB of zod's that a host on zod 4.6 was already paying. The document format, ops, stored formats, the wire and check codes are unchanged.
- cc889f4: A typed app fits wherever an app goes, with no cast. A consumer's TypeScript met four walls that the framework's own code got past with `as never` and `as unknown as GraviewApp<AnySchema>`. `installation.mutations` would not spread into an app's mutations. A typed app was not an app: `GraviewApp<S>` would not widen to `GraviewApp<AnySchema>`, because an act's `apply` and `describe` and a rule's `evaluate` were function-typed properties, checked contravariantly — so the studio's readers (`graphToDeclaration`, `migrationBetween`, `sourceChanges`, `declarationFiles`), `createStoreHandler` and the embed could not be handed one. `schema.definition(kind)` on a schema whose kinds are only `string` was `never`. And an unbound `defineInvariant` handed its rule a `never` subject. Now `apply`, `describe` and `evaluate` are declared as methods, so a typed app and its acts and rules widen; `installation.mutations` spreads into any app's mutations; `definition(kind)` answers the kind's definition, any definition of that kind on `AnySchema` (`DefinitionOfKind`); an unbound rule's subject is a node of its kind (`NodeOfKind` on `AnySchema`), its fields `unknown` until bound; and `reachLens.View` is the generic view it always was, so it registers on any app. The casts are gone from the studio, the store handler, the embed, `@graview/core/testing`, the launcher and the example apps, and type-level tests hold each wall down.
  
  Compatibility: types only, nothing at run time changes. Every type is wider than before except one: `apply`, `describe` and `evaluate` lose `readonly` (a method cannot be marked so), so code that reassigned one is now allowed to, where it was refused. `DefinitionOfKind` is a new exported type. A call such as `syncConflictInvariant()` beside a typed schema may now infer `AnySchema` where it inferred the schema, and wants `syncConflictInvariant<typeof schema>()`. The wire, ops, stored formats and check codes are unchanged.
- Updated dependencies [df9932a]
- Updated dependencies [9de42fe]
- Updated dependencies [a9c0f2d]
- Updated dependencies [75c1a26]
- Updated dependencies [e0f75bb]
- Updated dependencies [833e390]
- Updated dependencies [c5b36f7]
- Updated dependencies [53857e9]
- Updated dependencies [fdf82ed]
- Updated dependencies [f923330]
- Updated dependencies [936814b]
- Updated dependencies [98f0438]
- Updated dependencies [ba312af]
- Updated dependencies [d5a386e]
- Updated dependencies [a57ea5d]
- Updated dependencies [d5af759]
- Updated dependencies [d774558]
- Updated dependencies [0183340]
- Updated dependencies [cc889f4]
- Updated dependencies [5fd6380]
- Updated dependencies [dee1fb2]
- Updated dependencies [67fbb6f]
- Updated dependencies [180452e]
- Updated dependencies [1f260a7]
- Updated dependencies [062fe46]
- Updated dependencies [0497bbf]
  - @graview/core@0.1.4
  - @graview/tools@0.1.4
  - @graview/layout@0.1.4
  - @graview/render@0.1.4
  - @graview/react@0.1.4

## 0.1.3

### Patch Changes

- f4a1f72: The seat is a labelled region, not a landmark inside one. The companion was an `<aside>`, a complementary landmark, drawn inside the Shell's main and inside an embed's own region, and the inspector, the line key and the quick relations were asides inside it, so axe's `landmark-complementary-is-top-level` failed on every hosted app at every size and scheme. The companion is now a `<section>` named "The seat — about …", with its h2 and every test id and `data-graview-*` attribute as before; the inspector, the key and the quick relations are named groups while they sit in the seat, and labelled regions where they stand alone. The profile and the activity panes, which open from the bar or inside an embed, are labelled regions too. A click on any of them still leaves the selection alone, and an embed still names each region inside it after itself (FR-40).
  
  Compatibility: the wire — additive: `capabilities().shipped` gains "FR-40", and nothing else on it moves. Ops, stored formats, the declaration and the tool surface are unchanged.
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
  - @graview/react@0.1.3
  - @graview/layout@0.1.3
  - @graview/render@0.1.3
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- f36ccfc: The seat names a group of several kinds by their plurals. Homeflow's opening view is its blocks and runs together, and the companion's heading read "block+duty", the group's id, where the scene's own label said "Blocks and Runs". It now says what the scene says. And the bar, the companion and the find strip set each border side and each gap on its own, so a page widened past the narrow layout no longer has React warn about a shorthand and its longhands trading places.
  
  Compatibility: unchanged — no stored format, wire, check code, document format or tool name or schema moves; only the seat's heading and inline styles change.
- 346fbe3: The way in and a model's plan leave room for their widest number: an app with thirteen kinds read its way in as "1…9, 0, 1, 2, 3", the first digit of each two-digit number clipped off by the panel.
- 7f354e0: A log a seat may not fully see is redacted, not gapped. `seenBy` used to leave out the ops that touched what a seat may not see, which left holes in the seq that `OperationLog.from` refuses, so a served store had no log it could send. Those ops now stay in place as withheld ops, `withheld: true`. A withheld op keeps its id, seq, batch, time and `undoes`. Its author is `WITHHELD_AUTHOR` ("Someone") and its intent is `WITHHELD_INTENT` ("A change you cannot see"). The mutation, inverse and batch intent are dropped. Its primitives, reads and writes keep only what the seat sees, so the seat's copy of a record it can see still moves. `redact(ops, sees)`, `withhold`, `touchesUnseen`, `touchedBy` and `isWithheld` do the redaction, and `logSeenBy(store, principal)` and `seesId(store, principal)` read it for one seat.
  
  A log with withheld ops loads, folds and undoes around them. `checkUndo` refuses to take back a withheld op and says only that it was "a change you cannot see". When a withheld op stands in the way, it says "a later change you cannot see depends on it", without its sentence, id or what it read, and offers no batches to bring along. `seenBy(...).canUndo` judges over the redacted log, and `Store.undo` judges a seat with sights that way first, so neither a refusal nor a 409 quotes a change the seat may not see. The activity rail shows a fully withheld batch as "A change you cannot see", with no author, nothing it touched and no undo. A record's page leaves withheld ops out of its history (FR-16).
  
  Compatibility: additive for ops: `Operation.withheld` is a new optional field, an op without it reads as before, and no store makes one for itself. Changed for readers of `seenBy(store, principal).log` and `.batches()` under a policy with `sees`: ops a seat may not see now come back withheld in their place rather than being left out. `checkUndo` now takes any `LogReading` (`all`, `undoneIds`, `epochs`), which an `OperationLog` still is. Stored formats are unchanged.
- 33c3cbb: An agent acts for someone, through something, and the log says so. An `Author` carries its own `name` and `onBehalfOf`, the person it acts for. An op carries `via`, what it came through: `web`, `mcp:<client>`, `view:<name>`, `api` or `cli`. The activity rail reads "Claude, for Nick, via Claude", and `nameOfAuthor` says an author's own name before any id.
  
  An agent acting for a person may do what both may: its roles are the intersection of its own and theirs, a `self` grant is about the person, and `actingAs` gives the seat a policy judges. A `system` principal acting for nobody passes the policy and sees every record (`isSystem`), so a host's setup, seed and migrations are not refused by the app's own grants (FR-06, FR-17).
  
  A served store believes a seat header only when told to. `serveStore({ trustSeatHeaders: true })` reads `SEAT_HEADERS`, now with kind, name and delegation, so a remote `graview mcp` is recorded as an agent. Without it and without a `seatOf`, every route but health answers 401. `graview serve` listens on 127.0.0.1 and trusts the headers there, saying so; on any other `--host` it will not start without `--trust-seat-headers`. `openRemote` sends its seat on every request, the first read included, and its calls say `via: "web"`.
  
  Compatibility: breaking for a host that served a store without `seatOf` and relied on the seat headers: it now answers 401 until it passes `trustSeatHeaders: true`. `graview serve` binds 127.0.0.1 by default where it used to bind every interface. Additive elsewhere: `Author.name`, `Author.onBehalfOf`, `Principal.onBehalfOf`, `Operation.via` and `ApplyOptions.via` are optional fields, and ops without them read as before.
- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- 5a6f262: MCP for remote hosts. `createMcpHttpHandler({ store, authenticate, name, version })` serves the agent tools over Streamable HTTP as a fetch handler, `(Request) → Response`, stateless, for 2025-11-25 clients. The host's `authenticate` hook supplies the principal for each request; with no principal, every message is a 401, `initialize` included. The MCP TypeScript SDK's client completes initialize, `tools/list` and `tools/call` against it in the tests. `graview mcp` and the HTTP handler answer the same five methods through one dispatcher.
  
  Every tool says what it does. A `ToolDefinition` has a `title` and `annotations` with all four MCP hints, derived from the declaration:
  - `readOnlyHint` for the reads;
  - `destructiveHint` for an act that removes or severs, so `remove-<kind>` is destructive;
  - `idempotentHint` where an act sets only what it is given (a new `idempotent` on a mutation; derived edits and removes, and document acts that create nothing and compute nothing, have it);
  - `openWorldHint: false` always.
  
  Tool names are MCP-safe, with collisions handled the same way every time, and `act` names the act a tool runs. An act named like a read tool, such as `get_node`, used to be impossible to run, because the read tool answered first. It is now listed as `get_node_2` and runs as the act. `toolDefinitions(app, principal)` gives a seat's surface without a store, with a `hash` that changes when the surface does; `tools/list` carries it as `_meta["dev.graview/surface"]`.
  
  Other people's words come back as data. Reads go through `seenBy`, and prose written by somebody other than the caller, or the person an agent acts for, comes back as `{ untrusted: true, authoredBy, text }` in `get_node`, `get_graph` and `search_graph` (FR-10).
  
  Compatibility: derived tool names: unchanged for every act whose name is already letters, digits, `_` and `-`, at most 64, beginning with a letter or `_` (every act in the conformance fixtures, and every derived `edit-<kind>` and `remove-<kind>` of such a kind). Any other act is listed under a safe name: other characters become `_`, accents fall away, a leading digit or hyphen gets `act_`, and the name is cut at 64. An act named `search_graph`, `get_graph`, `get_node`, `get_violations`, `get_affordances`, `preview_mutation` or `undo_batch`, or one whose safe name another act already took, gets `_2`, `_3`, and so on. A call by the declared act name still reaches the act unless a listed tool has that name. Derived tool input schemas: unchanged, and the conformance fixtures match. Additive: every tool now has a `title` (the read tools: "Find by name", "Read the whole graph", "Read one node", "List the problems", "Ask what can be done", "Try an act without applying it", "Undo a batch") and `annotations`, and `ToolDefinition.title` is now always set. Read results: breaking for a reader that expected a string in a prose field written by somebody else, which is now the untrusted wrapper. Breaking for a seat whose policy declares `sees`: `get_graph`, `get_node`, `get_violations` and `search_graph` now show it only what it may see. `MCP_PROTOCOL_VERSION` is `2025-11-25`; a client that asks for an older revision gets its own back, as before.
- c74b21f: The bar learns that one row no longer holds from an IntersectionObserver on its right-hand group, instead of reading the row's width on every render. A rise to altitude renders the shell several times, and a forced layout in those frames cost the rise frames past 50 ms. The row is tried again when the window widens or the view moves.
  
  Compatibility: unchanged — no export, wire or stored shape changes.
- c5c1c91: The theme has a good tone and a bad tone. `good` and `bad` are tokens in both shipped schemes, written as `--graview-good` and `--graview-bad`, and `TEXT_PAIRS` holds each to 4.5:1 on a panel and on the ground. A badge that says "booked" or "overdue" now wears the theme's own colour and is checked with the rest of the palette. A brand derived from one accent gets both tones from its base (FR-38).
  
  Compatibility: the declaration — breaking for a brand that writes a palette out in full: `ThemeTokens` has two more required tokens, `good` and `bad`. A brand built from `SCHEMES` or `brandFromAccent` has them already. `graview check` measures the four new text pairs, so a palette whose tones cannot be read on its own panel is now an error.
- afcb06d: The workbench can be found by its headings. The seat, the inspector at the pointer, the activity and the places each open with a heading named as their landmark is, so a screen reader moving by headings reaches every region a person goes to.
  
  An embed's workbench says its name in a heading too. axe's `page-has-heading-one` failed on every embedded workbench in both schemes. `mount({ heading })` sets the level: `1` when the host's page is the app, `2` by default inside somebody else's article, and `false` when the host's own heading names it. The pages face has its own h1 and is not given a second (FR-25).
  
  Compatibility: unchanged for ops, formats, the wire and tools. `EmbedOptions.heading` is a new optional field, and an embed with no `heading` now carries an h2, which is not visible on the page.
- 9680187: A kind's card, row and page can be declared as data. `defineApp({ viewSpecs })` takes blocks from a closed set: title, text, badge with a tone, field with `as`, progress, group, `when`, divider and figure. Fields are bound by `{field}` templates, and conditions and tones are written in the rule language. A document's `views` compile to the same thing, and `toDocument` writes them back.
  
  `registerViewSpecs(registry, schema, specs)` in `@graview/primitives` draws them into the view matrix:
  - `card` at one × summary, beside the focus and on the pages face's gallery;
  - `row` at one × glyph;
  - `page` at one × full, above the framework's own view, which `DefaultView` draws.
  
  The scaffold's `views()` registers them, so a new project shows the card it declares with no component code.
  
  The tones are the theme's tokens, `good`, `warn`, `bad`, `neutral` and `accent`, and the blocks are styled by a fixed set of classes. Nothing in a spec runs. It carries no CSS, no markup and no URL, and the only link a view draws is an http(s) `url` field's own value. `graview check` holds every name and tone to the declaration (`view-field`, `view-name`, `view-tone`, `view-kind`, `view-slot`, `view-figure`, `view-block`).
  
  The rule language reads a record's own values only. `constructor` was taken for an operator by the tokenizer, and read through `in` it handed a template the function `Object`. It is now a name like any other, and no field (FR-03).
  
  Compatibility: the declaration — additive: `GraviewApp.viewSpecs` is optional, and its finding codes are new and reported only for a declaration that has view specs. The rule language — a name on `Object.prototype` (`constructor`, `toString`) is no longer read as a field or a binding; no declared field has such a name.
- 570f9e2: A view registered once is drawn on every face, over the defaults rather than instead of them.
  
  - **The embed hands its views to the routed face.** `mount({ views })` used to build the pages face without the registry. A registered view was drawn in the workbench and never on a phone. The pages face now gets the same registry, with the app's settings and presence, so the gallery's card is the registered one × summary. The record page draws the kind's own one × full view under its heading (FR-35).
  - **Registering one view keeps the rest.** `views(schema, registry)` is handed a registry that already holds the framework's own view for every cell and the declaration's view specs. A function that builds a registry of its own is laid over those same defaults (`layerViews`), so one card no longer costs every other view. `<DefaultView {...props} />` draws the framework's own view for a cell inside a view of your own. On the record page, which is the default record, it draws nothing (`DefaultViewElsewhere`). `ViewRegistry.registrations()` lists every registration in the order it was made (FR-36).
  - **A member drawn as a row is a cell a view can claim.** When a kind has a one × glyph view of its own, as a component or a spec's `row`, two places draw it. A focused group draws each member as that line, each a target for its record. The list page draws each record as that line, with the whole line as the link (FR-37).
  
  The framework's own one-cell views are now marked as defaults (`isDefaultView`), the way its group views were, so a surface can tell them from an app's.
  
  Compatibility: the declaration — additive: `ViewRegistry.registrations()` and `ViewRegistration.across` are new, and a registry that implements the interface by hand needs the method. `EmbedOptions.views` is now called with a second argument, the registry to register onto. A function that ignores it still works, and is laid over the defaults instead of replacing them. Ops, formats, the wire and tools are unchanged.
- Updated dependencies [3afdd09]
- Updated dependencies [b910210]
- Updated dependencies [7f354e0]
- Updated dependencies [74c9388]
- Updated dependencies [a7fc818]
- Updated dependencies [6a46f36]
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
- Updated dependencies [b71e7c5]
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2
  - @graview/render@0.1.2
  - @graview/tools@0.1.2
  - @graview/react@0.1.2
  - @graview/layout@0.1.2

## 0.1.1

### Patch Changes

- ed02370: A connection's chip on a record is titled "Go to the test drive", by the kind's noun, not "Go to test-drive".
- e0c8cac: A list's "Only…" filter and the chip it leaves say a value as the record does — "SUV", "Body style: SUV" — through the new `valueWords`, rather than the field's raw "suv". The watch no longer counts a word one kind declares ("Status") as another kind's key.
- e1b9f5c: A form asks in the record's words. An argument that fills a field of the kind its act makes or acts on is labelled as that field ("VIN", "Body style"), its choices are said as the record says them ("SUV", "Plug-in hybrid"), and an argument called `label` is asked for as a "Name" — on the routed face's forms and in the scene's ask alike (`argumentWords`). A refused argument is said field by field in the same words — "Not yet: Email — invalid email address." — rather than as `Invalid arguments for mutation "sign-up" email: …` (`failureWords`, `InvalidArguments`). The watch is told a declaration's choice values, and the key's own words wherever the declaration has others.
- 097d684: A count of one says the kind's noun: "1 car", "1 test drive", where a place card, Find, a district's name, a band of a district and a coverage's gaps said "1 vehicle" and "1 test-drive". One function says it now (`counted`).
- e88f729: A chip's title, an empty record's "Nothing is connected to this …" and the seeding's count of one say the kind's noun, not its id: "Test drive — implicated in a problem", not "test-drive".
- 1df48c8: A list narrows by a number and by a word. The arrangement offers every number field as a filter — `price:at-most:25000`, `mileage:at-least:10000` — and every word field by the values it holds; the arrange bar's Only… lists four round steps through what the list holds ("at most £25,000") and a word field's values by name ("Make: Kia") when there are up to sixty. `roundSteps` is exported.
- ccfe1cd: A lens path that cannot get from its columns to its rows is a binding error, not a picture of nothing covered. `graview check` walks it off the declaration (`lens-binding-path-misses`, saying when it is only named backwards and how to name it), and the coverage throws a `CoverageBindingError` with the same sentence rather than reading every row as uncovered. `walkKinds` is exported.
- d76a957: A policy says who may see what, as well as who may do it. `Policy.sees` keeps a kind to the roles a sight names — with `own`, to the principal's own record and what an edge joins to it — and a kind no sight names stays everybody's. `store.seenBy(principal)` is the store as that principal may see it: its graph, log, history and problems hold only what they may see, and every act still goes to the store itself; with no `sees` it is the store, unchanged. The scene's provider and the routed face hand every surface that view, a kind a seat sees none of and may not begin is kept from it like an administered module, and the way in leaves it out. `graview check` refuses a sight naming an undeclared kind (`sight-unknown-kind`). A watching harness is told what the seat may not see (`tellTheWatchWhatIsUnseen`, `useTheWatchKnowsWhatIsUnseen`).
- c222b58: The scene's ask takes a list of words as one line, split at commas, and nothing typed as an empty list: "Put a car on sale" sent its features as a string and was refused on its last step, every Apply. The ask's field carries its argument's `name`.
- deb98ca: When the scene's ask is refused for an answer, it goes back to that question. Sixteen questions into "Put a car on sale", "Photos — invalid URL" left the ask on its last step, where Apply could only be refused again and the only way to the wrong answer was to start over.
- 3c0d822: The bar wraps wherever one row does not hold, not only below 920 pixels: an app's own `nav`, a long crumb after a drive-in and the places menu can need more, and at 1280 a bid's bar ran the profile — the seat switcher — off the edge with the places a sliver. The row is measured before it is painted and tried again when the window widens or the view moves.
- b9cdc16: The scene's ask hands the keyboard to its next question when the last answer took its control away: a choice pressed before another question of choices ("Fuel", then "Gearbox") left it on `<body>`.
- 0b78acc: The way in says a kind is waiting for what is still missing — "Waiting for Shoppers." — not for everything its act needs, beside four showrooms and 340 cars.
- Updated dependencies [bf36bbe]
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
  - @graview/react@0.1.1
  - @graview/core@0.1.1
  - @graview/tools@0.1.1
  - @graview/layout@0.1.1
  - @graview/render@0.1.1

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

- 23d05c6: A calendar draws every kind it is bound to. Registered over one kind and bound to two — a dealership's diary over its test drives, bound to test drives and service appointments — it drew only the group's members and never read the other kind. The other bound kinds now come from the graph, on the same horizon the group keeps (their past only when the stop asks for it), after the group's own arranging.
- fb781c2: A calendar lens: month, week, day and agenda over real dates. `createCalendarLens` binds a kind's own fields to roles — a start date or date-time, an optional end, an all-day flag, a label, a done flag — the way every other starter does, and `graview check` reads the binding like the others'. Multi-day spans are drawn on every day they cover and say which piece they are; a busy month cell says "+N more" and opens that day; all-day entries sort before timed ones; done reads as done. All date arithmetic is on `YYYY-MM-DD` strings in UTC, so an entry does not land on the 13th for half the world, and `addMonths("2026-01-31", 1)` is February.
  
  Two framework capabilities the calendar forced. `ViewState.within` is where a view says where it is INSIDE itself — `in.at=2026-10-01&in.range=month` — carried in the fragment, never read by the framework, and counted as travelling rather than as an adjustment, so Back returns to the month you left. And a kind may now have SEVERAL pictures: `places()` lists every titled group view, each with an `as` slug the stop names (`in.view=the-month`), and `resolve(kind, cell, as)` picks one. Before this, registering a second titled view simply replaced the first and made it unreachable.
  
  Dragging an entry to another day is an act: `actThatMoves` asks the declaration (through the framework's own `fieldWriters`, the function the checker uses) which act writes the bound date, the store judges it, and one undo puts it back — a seat that may not is told so in the policy's own words rather than watching the entry snap back. A date-time keeps its time.
  
  Also: a control inside a view no longer selects the card it is drawn on — pressing the calendar's "next" used to select every task in the district behind it.
  
  Things shows a month over tasks by due date beside the week and the lists, all three now the framework's own named places rather than a switcher of its own. Seedbed gains a season over plantings, which means a planting now records the day it was harvested and is a span rather than a dot.
- dd65d38: A card's acts are one key away. On a phone the seat is a folded sheet, and from the keyboard its toggle was a walk of a dozen Tabs past every other card — making a location in the rota took 22 presses where a pointer took 8. A card with the keyboard on it now answers A the way it answers a right-click: what it draws is chosen, the seat opens on its acts and the keyboard lands on the first; put away from the keyboard, the keyboard goes back to the card. The card names the key (`aria-keyshortcuts`) and the seat's header says it on screen while the keyboard stands on a card. The scene learns the key from the seat (`actsDoor` on the context), so a scene with no seat claims none.
- bff0b71: A change is logged in the record's words, and a seat's roles are said in words. The derived edit's history read "price → 49900" and "condition → \"cpo\"" beside a card saying "Price $49,900" and "Certified pre-owned"; it now uses the declaration's `display.labels` and `display.format`. The profile pane named the seat's roles by their ids ("sales-manager"); it says them as words ("Sales manager").
- 400a6df: A fact on a chip says what it is. `readableFields` gives every field an `alone` reading — a word as itself, a number with its label ("Track 8", "Length 4:27"), a yes/no as "Explicit: yes" — and the default summary card, the pages' gallery and the list lines all use it. A song's card used to read "8 · 4:27 · Yes".
- 5d634ca: Clicking a name in an opened district changes the picture, and a relation drawing seven lines draws them quietly.
  
  **A chosen member is not its whole district.** At altitude a selection is resolved to the card that stands for it — right for asking which CARDS a line touches, wrong for asking which LINE. With the volunteers opened, all seven `covered-by` strands end at the volunteers card, so choosing Ada lit Bo's shifts, and Cass's, and Dev's: the scene said exactly the same thing before and after the click, which is the one thing clicking a name is for. A strand knows the real edges it stands for; when the selection names something those edges mention, that finer answer wins, and when it names none of them — a district chosen as a district — the card rule stands. The rule is `altitudeOpacity`, pulled out of the render so it can be read and tested.
  
  **A relation drawing many lines at once draws each of them quieter.** A bundle is unpicked so each line can start at the thing it is about: the week draws every shift as its own span, and a line leaving the span says *which* shifts are covered, which is worth having. But seven of them arriving at one closed district, each at the weight of a single fact, is a starburst across the whole picture. They now fade with the crowd — never below a third — and choosing one still brings it fully forward.
  
  **A district offers only what it can do.** The layout refuses to open the district of the kind in focus: its members are already the picture above, at size, and drawing the same ten names twice is what the ring exists to avoid. The card offered it anyway — pressing "open" on Shifts while looking at the week wrote `expand=kind:shift` into the stop, the next frame threw it away, the card still read "open ▾", and nothing moved. It says "shown above" now. The same held for the district the layout opens in place, which offered a "close" that could not close.
- 8031925: A press on a coverage grid's column name chooses that column. The name leans up and to the right across the boxes of the columns after it, which were painted over it, so a press on a name chose a neighbour about half the time; the box now lets presses through and the name itself takes them, a little taller than its words.
- eacd252: A coverage cell is lit when the selection reaches both its ends. Lit on either, selecting one song lit the whole column of its theme — every other song about the same thing.
- c7a3519: A create can name its id, and what was made can be unmade. Every act that declares `creates` now takes an optional `id` argument the framework adds beside its own: `compileMutation` lifts it before the declaration's input parses, `freshId` hands it out first, and an id the graph already has is refused by name rather than quietly suffixed — so a seed being synced, or an agent that will refer to the node in its next call, gets exactly the id it asked for or an honest no. The tool schema says so (`mutationToolSchema`), and `takesAnId` says which acts take it.
  
  And every kind gets `remove-<kind>` derived beside `edit-<kind>`: destructive, titled, taking the node and its ties, logged and undoable, permitted through the acts that create the kind or a grant naming it — who may bring a thing into being may take it out, which is narrower than the edit's reading on purpose. An app's own `remove-<kind>` is kept. `derived` on a mutation is now `{ kind, act: "edit" | "remove" }`; `deriveMutations`, `deriveRemoveMutations`, `removeVia` and `derivedVia` join the exports, and the store, the checker, `describe` and `docs` all count the removes with the edits. The refusal for a derived act nothing declared reaches now says "creates or changes" rather than the edit's "writes or creates".
- 2aae30f: A crowded band is laid out by relation. Past what fits as chips, a band row is as tall as a group card's two lines, the gutter between rows holds a caption, and each relation starts its own row unless all of it fits the rest of the current one — so a caption never sits on the cards of the row above, and a group card is never cut to its name. `packRuns` and `bandCaps` (exported) plan the rows in arithmetic, and each relation is drawn within what the rows give it. A band card says its name and which way it opens on one line, and its count and first members on the next, "1 song" rather than "1 songs"; a record standing in a crowded band is drawn as a chip (`compact` on the layout node) rather than a summary cut to a sliver; a chip is never wider than what holds it. A grouping in which one group holds three quarters of the members is not offered. The month cells of a calendar are as tall as what is in them, so a month with three releases no longer spills over the month below, and a coverage matrix draws at most 40 rows by 24 columns.
- 60b3e2b: A chip that is cut carries its whole label as a title, whatever its length. Whether a chip is cut is its container's decision, not its label's: an eighteen-character rotation in a twenty-five-pixel calendar cell at phone width was cut to "Br…" with nothing to say the rest, because only a label past twenty-eight characters used to get a title. The site harness, which treats an ellipsis without a tooltip as a failure, found it the day the chapters bundle was rebuilt.
- 73690fb: A district is a village. From altitude its members stand as small iso buildings on the plot, back to front on the plot's own sub-lattice, each with a height of its own, the square in the middle kept for the nameplate and the kind's landmark; past the plot's cap the rest are a number on the kerb. A flagged member's roof is the warning colour and a selected member's building is lit. The anonymous iso block that stood for every kind without a drawing is retired: the population is the size of the cluster now.
- 862fd42: A district stays a district whatever picture the address names — and the studio stops minting ids in the layout's namespace.
  
  Three things, all found by opening Rota's installation and its studio and looking at what was actually drawn.
  
  **A place is a picture OF a group, not of every group.** The scene handed `in.view=<slug>` to every group it drew, so pressing "Who may do what" and then looking at something else left the slug in the stop, where the PEOPLE district — which is not what you are looking at — drew the policy lens instead of itself: no name, no count, no figure, no way in, just the words "Who may do what · 3 roles" floating where a district used to be. The same thing turned the Shifts card into "The week · 10". The slug now reaches only the group the address focuses, which is what the code's own comment always said it did.
  
  **A lens's glyph is a mark, not a caption.** `ReachView` returned a bare `<span>` at glyph fidelity where every other lens returns a `Chip`.
  
  **`kind:` belongs to the layout.** It is where a district card's id comes from, and the studio minted `kind:rule` for an app's own kind called "rule" — the same string as the RULES district's card. Every app in this repository declares a kind called "rule", so in every one of their studios the edge from a rule to the kind it judges resolved to the district it started from and was drawn as a loop: a dotted circle labelled OVER, saying a rule judges a rule. The studio's kind nodes are `declared:<name>` now, and a test holds the namespace.
  
  Also: the studio's agent can name a new role or kind. "add a new Role for Participant" was not recognised by the graph-native floor — it only matched an act whose title appeared verbatim — so the turn fell through to whatever model was configured, which proposed `add-role` with no label and got a validation refusal. The floor now takes a name from quotes, from "called"/"named"/"for", or from in front of the word itself, asks for one when there is none rather than proposing an act that cannot apply, and says so when the name is already taken.
- 475cc83: The districts at the bottom of the stack are readable: the kinds plane stops paying for depth in legibility.
  
  A district's name reached the screen at ten pixels and its kind at under eight, so the bottom of the picture was a row of grey marks rather than a map of the domain. Three things were stacked on top of each other to get there.
  
  **The plane was drawn at 78% of the room it was given.** The layout allots each district a slot and the renderer drew the card at 0.78 of it — a shrink applied *after* the reader's text size, so it was a shrink no setting could lift. The stylesheet next to it already argued the case: "Depth comes from BLUR AND FALLOFF, not from shrinking. Pushing the scale to 0.6 made the strip illegible — ten cards reading P…, REA…, S…. A map you cannot read is not a map." 0.78 was the same mistake, smaller. The planes keep a shrink — recession is still monotonic, as `frame-plan` requires — but one small enough to read as depth and no longer small enough to cost a word its legibility.
  
  **A district's name was thirteen pixels before any of that**, and its kind ten. A name is read, not glanced at.
  
  **And three more pixel sizes were hiding from the guard.** The test written last commit looked for a number straight after `fontSize:` and walked past `fontSize: nested ? 10.5 : 13` — which is how the district's own name stayed at thirteen pixels while everything around it doubled. It strips quoted values and looks at the whole expression now, and found two more in the reach lens and the panel.
  
  Two knock-ons, each fixed at its cause rather than tuned away. A fan of tucked cards is spaced in layout units and drawn at the plane's scale, so the gap between two tucks is `step − scale` of a card: at 0.86 against 0.78 that was air, and against 0.9 it became six pixels of one card sitting on its neighbour's label. And the fan was allowed the parent's width *plus the gap* — but the gap is not spare room, it is what keeps one district off the next. Both were caught by `audit-ui`, not by eye.
  
  Finally, a panel's heading wraps. Both halves of that row are sized in `rem` now, so a reader on Largest doubles them, and on a phone "The rotation · 2026–2029" reached eight pixels past the screen — caught by the calendar harness's own reader-settings check, which is exactly what it is for.
- 7546a38: An opened district says which of its members is in trouble. The card's count already said "⚠ 1"; opening it to find out which member that was — the whole reason to open it — showed every member as a plain chip. A flagged member now carries the same "⚠" and the same title the glyph view has always given it.
- 09a23a3: From altitude a district stands as the kind's own drawing, not as one more box. The figure was an eighteen-pixel chip on the nameplate while an anonymous isometric block carried the whole landmark — the emphasis exactly backwards, since the box is what every kind looks like and the drawing is the only thing on the screen that says which kind this is. The population still reads, in the drawing's size rather than a box's height. A kind with no figure keeps its block; nothing about a figure is required.
  
  Standing a district on a figure showed what the shipped art actually was at more than twenty pixels. `person` was two crescents — a head drawn as two arcs is a circle only while it is too small to see — and is now a standing figure with a head, a torso, arms and legs. `rule` was a ruler lying on the diagonal and `note` a flat document icon, the two figures in the set drawn square to the page while everything around them stood in the city's own projection; they are now a set square standing on its edge and a leaf of paper standing with its corner turned.
- 7246f46: A field is asked for in words. The actions strip's ask and the editors opened in place named their fields with the declaration's identifiers — `label`, `dependsOn` — while the pages face has always humanised them. Both faces read the same now, from `humaniseField`.
- 92a2f73: What a person reads names a field, a relation and a group in the declaration's words, never by id. `fieldWords(definition, key)` is the one place a field becomes words (its `display.labels`, else the key spoken); an editable value's tooltip no longer says "changes "plannedAt" through a mutation", the inspector no longer says a line's edge is "rides-in", the calendar's refusals and the structure suggestions ("all 3 share the day "mon"", "(assigned to)") read in words, and `bandAggregateWords` names a band's group — the seat had been calling one "album|released-by|in|type=album".
- dfbba3f: A figure is handed to the DOM once, and it fits the card it is drawn on.
  
  React 19 decides whether to re-apply `dangerouslySetInnerHTML` by comparing the prop object to the last one by identity, so the inline `{{ __html: art }}` every call site wrote tore the art out and parsed it again on every render — thirty-four times for a single click on the ground. The wasted parsing was the smaller half: a double-click only pairs if both clicks land on the same node, and the re-render the first click caused had already replaced it, so double-clicking a district on its figure selected the card and went nowhere while double-clicking the same card an inch to the left travelled into it. A new `useMarkup` hook holds the object still, and the brand's logo goes through it too.
  
  The figure also moves from its own row to the name's line. On the ground a district card is a glyph — seventy pixels holding a name, a count, a trouble mark and a control — and a drawing above the name pushed the content past the card's own edge on every card in the strip, clipped rather than visibly broken, which is why only a measurement caught it.
- 509162f: A project `graview create` writes passes its own checks again. Its first kind's `label` is bounded (`z.string().min(1).max(60)`), so `graview check` has nothing to say about a fresh project; its routed home page hands `<Begin>` the store, since the pages face has no provider around it. And on a narrow Graview the companion's sheet makes room in the picture for itself, as the actions strip always did, rather than lying over the district it is about.
- 3f86b09: A glance does not say its heading again, word by word. A card's summary and a list line dropped a value only when it was the whole heading, so a vehicle headed "2027 Subaru Forester Sport" — its label built from its year, make and model — spent two of its three facts on "Year 2027" and "Subaru" and never reached the price. `readableFields(..., { glance: true })` drops a value the heading carries as whole words; a record's full facts keep every field, because that is where each one is changed.
- ad8549a: A Graview in somebody else's page. `@graview/embed` mounts a declared app
  into any element — `mount(el, { app, seed, face, stop, principal })` and an
  `Embed` component — with the scene, the Graview or the routed pages as its
  face, a switcher and Standing above the picture, and nothing of the Shell.
  The store lives in memory and starts from the seed; the routed face runs on
  a memory router so the host's address is never touched; the brand's fonts
  are fetched by the embed.
  
  What the framework had to grow for that, and grew: `themeCss` takes a
  `scope`, so the theme lands on the element rather than on `:root` and
  `html, body`; the panes size against the picture's own box (`cqh`) rather
  than the viewport, and the Shell's scene region is that container, so a
  pane never reaches past the picture it belongs to, on a page or in an
  embed the size of a paragraph.
- 1ebfd44: A kind has a figure. `defineNode(kind, { figure })` takes inline SVG — one `viewBox`, `currentColor` strokes, no fill — or the name of one from a small shipped set (person, plot, box, task, shift, list, vehicle, rule, note), and a brand may override any kind's. One `<KindFigure>` draws it everywhere a kind is drawn: the kind card at altitude, the district beside its plural, the routed face's rails and record eyebrows. A kind without one is drawn exactly as before; nothing about a figure is required.
  
  `graview check` refuses a figure that cannot be drawn — no `viewBox` (nothing can size it), a literal colour (invisible in one of the two schemes), nothing stroked with `currentColor` (it will not take the kind's ink), or a name nothing ships — and refuses a brand drawing for a kind the app does not declare. `drawFigure` in `@graview/tools` asks a model for one in the house style and judges the answer with the same function, so a drawing that would fail the build never reaches a person as a proposal; a model that throws or draws badly falls back to the nearest shipped figure BY NAME and says so, because guessing that a cleat is a box would be the framework having an opinion about a domain it has never met. `graview figure <entry> --kind <k>` prints the line to paste.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- e0d5026: A kit for the picture. Everything the scene draws that is not a view — the lines, their captions, the ground's grid and lattice, the kind tags, how far the unlit recedes, the mark a broken rule leaves — is declared on `brand.kit`, any part of it, the rest as shipped. A connector's route is a named strategy (`curve`, `straight`, `orthogonal`) and its stroke a named pattern; each is one case in one file, so the next is one more case and nothing in the scene moves. Colour and visibility are per edge kind under `connectors.byEdge` or for all under `connectors.all`; a kind kept quiet is not drawn and stays selectable from the inspector. `themeCss` emits the kit as `--graview-kit-*` custom properties that the ground and the tags read. `graview check` holds an explicit line colour to 3:1 against both grounds in both schemes (`kit-contrast-below-aa`, `kit-colour-unreadable`). An embed's handle gains `setBrand`, so a page can re-dress a running Graview.
- 4ab1b6d: A lens arranges before it draws. `useArranging(props, options)` reads the arrangement out of the stop, applies it to the nodes a lens is about to draw, and hands back the row to draw above them; the board, the timeline and the calendar take it. Each says what it has no place for — a board has nowhere to group, a timeline's rows are its columns, a calendar's order is its dates — and an app declines the rest with `arranging: false` (or per part) on the lens options, and says what a picture opens arranged by with `arrangedBy`. The board arranges its occupants and keeps every slot, drawing them within a slot in the order the arrangement put them; the timeline filters and sorts its spans; the calendar filters everywhere and, in the agenda, groups the entries under headings by a far end. Rota's fortnight opens its agenda by where each shift happens. Things' own list page arranges through the same module under the same words, opening its tasks by list, open ones only, by name.
- fc024d0: A lens chooses its shape by the room it has, and a narrow embed keeps its room for the picture.
  
  The coverage matrix's 316px label column put every column past the edge of a phone-width card, behind a sideways scroll nothing announced — names and no cells. The names now take a share of the width, and where the columns still would not fit at a fingertip each the matrix stacks: each row is its name and then its cells as labelled marks that wrap. Seven day columns in a 300px box were 40px cells with three letters in them; below about 44px a column a run of days is drawn as the agenda, and coarser cells wrap into as many columns as the width holds. The calendar's six range chips become one select when the card is narrow.
  
  The scene kept a fifth of a 360px embed clear for rails it does not draw there, and the layout took six gaps more off a focused card: a lens got 145 pixels. Below a phone's width the rails are gone and the focus margin is capped at a tenth of the span. The embed's strip, whose place and seat pills wrapped to five rows, shows the places and the seats as one select each when it is narrow.
  
  And the example's season and rotation calendars, declared on the chapters and never handed to the views, are drawn on the pages that explain them.
- 41abe03: A lens is a drive-in: the picture stands at its kind's plot, and descending is walking up to the screen. From altitude the focused group's named picture no longer floats in the middle bound to no kind — it is a SCREEN standing on that kind's plot, anchored to the plot's far edge and centred on it, sized by the plot's side with a floor for legibility, drawn with the same natural size and shrink as before (the interface scaled, never re-laid-out small), and shrunk only as a last resort until it stands on no other district's nameplate. A picture over two kinds (`ViewMeta.across`, carried on the `Place`) stands on the road between their plots. `LayoutNode.screenOf` names the kind and survives the tween; `LayoutOptions.screens` is the registry's named places by kind. With the screen on its own plot the city no longer slides aside for a picture in the middle.
  
  Every kind with a named place has a drive-in on its district card from altitude: a dark screen and a marquee of real, keyboard-reachable buttons labelled "<plural>: <title>". Pressing a showing focuses the kind with it and descends in one gesture — the lens is already drawn at the plot, so the descent tweens from the screen to plane 0 and reads as walking up to it. On the focused drive-in, pressing another showing switches the picture without descending (`in.view` changes, the stop stays at altitude and round-trips through the address); pressing the showing that is showing walks up to it. "Focus" from altitude descends into the focused drive-in, else the selected kind's, else the first kind that has one. Focusing a drive-in off the edge of a large city re-centres the pan on its plot. `useWhereIs("screen:<kind>")` answers with the audience strip in front of the screen, where figures will stand. The road's hit corridor now keeps off card faces by its own half-width, so a press on a district's corner is the district's. The navigation harness drives all of it, including a mid-tween capture that asserts the lens moved from the plot rather than from the centre.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- b83e46f: The coverage matrix and the board keep the scene's horizon. Both read `store.graph.allNodes()` and ignored the members they were handed, so a coverage of songs by theme drew retired demos as rows and called them "unanswered", and a board seated retired occupants. They now draw the group's own kind as the members the scene handed over and every other kind as what is current (`onTheHorizon`).
- f7c6c19: A lens says all its emphasis or none. The coverage grid wrote `data-graview-emphasis` on its row labels and merely painted it on its column heads and filled cells, so most of what a selection lit in that picture was a colour and nothing else — unreachable by a test, and by anything reading the tree.
- a012583: A selected line is headed by what it means. Its menu and pane were headed by the edge's name, spaced — "Works at", "For vehicle", "Drives" — with the declaration's sentence under it; the heading is now that sentence ("Where they work"), and the line under it says how the relation reads from the other end ("From North lot: who works here"), or nothing where no inverse was declared.
- e119b49: A tie points at where a thing is, not at where it was. The lines from a selection to its relations, and the captions over a raised row, were measured from the DOM during render — the render that draws a frame runs before that frame's DOM exists, so every one was measured against the frame before, and after the last frame of a navigation nothing rendered again: dashes started in the air at the edge of a card that had moved. Both are measured in a layout effect now, after the boxes are where the frame put them and before paint, and the ties measure again whenever a scroll or a resize moves something. Every anchor is cut down to what a person can see of it — a chip scrolled off the end of its roster, a row under a panel's fold, anchors nothing.
  
  And a mark is not the thing. The fundamental mistake under every stray line was treating everything that wears an id as a place the thing is: a coverage cell wears its column's id so a press means the column, but it stands at the crossing of a row and a column — it is the edge — and a selected revenue stream fanned five dashed lines up into the cells of somebody else's ownership matrix. A lens says which of its drawings are marks (`data-graview-mark`), a tie never lands on one, and a thing drawn only as marks falls through to the district that holds it.
- da81e1e: The coverage lens draws a matrix the page can hold. Past 80 rows or 48 columns it keeps the most-tied ones, in their own order, and says how many it left out ("the 80 most connected of 568 artists · 48 of 568 artists across"); what is missing is still counted over all of them. A real discography's "who worked with whom" was 568 artists by 568, a third of a million cells, and the page never came back from drawing them. `capCoverage` is exported beside `buildCoverage`, with `COVERAGE_MAX_ROWS` and `COVERAGE_MAX_COLUMNS`.
- 5b5e5a3: A one-press act must be able to act. The actions strip counted only required arguments as open, so a derived edit whose every field is optional looked like a single press and, pressed with just its subject, refused on the button: "Nothing to change — give at least one of label a value." An action with nothing required left is now rehearsed with what it has, and one that would refuse asks for its optional arguments instead, each of which can be skipped; only what was actually said is applied.
- fb5b3ad: The profile pane stays inside an embed's box. Hung from its button's right edge, it opened off the side of an embed on somebody else's page — off the screen at phone width — and the embed's `overflow: hidden` cut it in half; `keepInside` slides it back and caps it to the room below.
- 923bbfa: A profile on the bar. `<Profile>` is the one place that answers "who am I signed in as" and holds what belongs to the reader rather than to the installation: their own record (where an installation is declared), the seat switcher, the settings, and the scheme. Settings are declared — `app.settings`, drawn by the pane, honoured by the provider, and checked: `graview check` refuses a setting nothing can apply, one with nothing to choose between, one that opens on an answer it does not offer, two that share a name, and a root font size that is not a length. `readerSettings()` is the two every app should offer (text size and motion); `applySettings` carries them at the edge so an app's two faces agree.
  
  Two bugs surfaced underneath. The theme set `font: 0.875rem` on `html, body` — so the ROOT's own size became 0.875 of the browser's, every `rem` in the framework resolved against 14px instead of 16, and the one place a text-size setting can live was already occupied. The body is sized now; the root is left exactly as the reader has it, and "As your browser has it" stamps nothing rather than guessing. And `usePickTargets` stamped `role="button"` on every pick target including landmark elements, which ARIA forbids — three `<header role="button">` on the first screen of the demo, unnoticed because nothing had run axe over the scene. The role is now stamped only where it is legal; a target that cannot take it still gets `tabindex`. Motion is overridable by the reader: the stylesheet's reduced-motion rules are emitted once for the system's preference and once for `data-graview-motion="reduce"`, scoped so an embed honours a host's answer without restyling the host.
- d042ff2: A relation's caption is an h2. The connections panel wrote each group's caption as an `h4` for its size — which its own style sets regardless — and the only heading above it in a scene is the shell's `h1`, so axe reported `heading-order` on every screen with a relation drawn in it and a screen reader's heading list read as though two sections were missing.
- c5e4ac7: A robot you can catch, and a robot worth looking at. A following robot holds still when a hand comes for it, so it can be pressed to let go. The figure is redrawn: a dome head with a visor and eyes, an antenna that lights while it follows, the city's own iso block for a body, an arm that comes up with a pen while it writes. The drive-in from altitude loses its grey stand-in screen; the marquee band is sized from its showings wrapped to the card, and the building under it sizes from the room that is left, so showings no longer stand on a roof.
- 2cc27e9: Another seat's work is named by the seat's name. `nameOfAuthor(author, { graph, schema, seats })` reads the user node, else the seat the principal was offered under, else the id; the activity rail, the profile, and the routed face's history use it, and `PageContext` carries `seats` (the embed hands its own over). An app with seats and no installation read "user-lena" and "U user-june".
- b90b6c7: A seat signs its own work. `AgentSeat` wrote every op with the author id "claude", hardcoded — so two seats on one embed were indistinguishable in the history, and a seat that is a rules mender or a scheduled job wore a vendor's name. `who` is now a required prop, the way the chat seat has always signed "chat".
- a5d4967: A seat that may not sit down says so. An agent seat the policy refuses was disabled and wearing its idle label — "There is something here already" — while the real reason sat in a `title` on the disabled button, out of reach of a keyboard. It is struck through with the reason beside it now, the way the actions strip states a withheld act.
- 97067b6: Two more selects keep their floor in WebKit: the bar's compact Places picker and the calendar's Range picker on a phone. WebKit draws a native select at its own height and ignores `min-height`, so they measured 22 and 21 pixels tall in Safari; the native look is off and a chevron is drawn in the text's colour, as the arrange bar and the places menu already do.
- e809183: An embed's stop may name a place. `#view=the-season` is the link a page can write — `placeHref` spells it — and the scene's URL sync has resolved it to the group the place is a picture of since it existed; the embed read its `stop` through `fromUrl` alone, so a host page saying `data-stop="#view=the-season"` landed at the default view with the place's pill unpressed. The embed resolves it now, on mount and when the stop changes through the handle.
  
  A board in a room with no height of its own is sized by its width. The board lens drove its size from the measured height of the room it stood in, which a scene band and a page region have; in a chapter embed on the docs site the panel sits in a column as tall as its content, so the room measured four pixels, the board came out six by four, and every slot on it was a four-pixel target. Below a height a board could be read at, it takes the room's width and lets its aspect give the height, which is what a board in a document is.
  
  The embed has a fourth face, `picture`: one named lens and nothing else — the place the stop names, drawn at full size over the kind's current members, with no bar, no rail and no standing. A page that is about a lens shows the lens, not an app with the lens somewhere inside it; three of those stacked on the docs site's lenses section were three windows with a calendar somewhere in each. `PlacePicture` in `@graview/pages` is the component behind it, for an app's own page that wants the same.
  
  The calendar's day grid and agenda list are keyboard stops. Given less height than their rows they scroll inside themselves, and a region that scrolls with no focusable element in it is one a keyboard cannot scroll at all; each carries the span's own name.
- 8041853: A decision provider is a third kind of intelligence, and the declaration says so. `intelligence[].kind` accepts `"decision"` beside `"graph"`, `"llm"` and `"external"`: a provider that answers typed questions — a Choice over named options, a truth, a Score over an ordered rubric — with a confidence, and never prose. `providerCan(provider, "prose" | "decide" | "propose")` derives what each kind serves from the kind alone, so a surface asks whether a provider can before offering it.
  
  `graview check` holds a decision provider to what it can decide: an act on its allowlist whose required arguments want text, a date or an unbounded number is one it could never call, and is refused (`intelligence-decision-cannot-call`, naming the act and the argument); a paste or MCP door on one is words out and words back to something with no words (`intelligence-decision-prose-door`). `undecidableArguments(mutation)` is the function behind it, exported for the surfaces that will derive questions. `graview describe` and the generated docs read a decision provider out as what it is, and the `Door` draws none for it — a prompt-out answer-back door is a chat offered to a thing that cannot hold one.
- 83a40ed: A drive-in's thumbnail is a frame holding the lens drawn small and a press laid over it, no longer a button holding the lens: a calendar's own Previous and Next ended up inside the marquee's button, which is invalid HTML however inert the copy was, and React said so on every chapter with a calendar. The places control and its compact menu set their borders and background in longhand, so a change of place no longer overwrites a shorthand with its parts on every render.
- 4c4d52a: A drive-in's thumbnail is a picture of its lens, not the lens. It hands the lens its 12 most relevant members (the flagged, then the most connected) with `budget` and `total` — new on `ViewProps` — and is mounted the first time it is on screen with the scene still, one thumbnail a frame; `useSceneStill` and the scene's motion store say when. A lens with a budget draws no arrangement row, the coverage holds its rows and columns to it, and the board, timeline and calendar say "+N more" in the kind's words (`withMore`, exported). The row's "only…" menu offers at most the 40 most connected far ends — a release's menu listed every song. Over Tech N9ne's catalogue the city at altitude went from 21,335 elements to about 1,200, and rising from 21,495 to 2,493 with every thumbnail drawn. The graview-lens skill says what a lens does with a budget.
- b9b0635: A time of day is asked for. An argument whose pattern is a date with a time in it (`YYYY-MM-DDTHH:MM`, the gauntlet's workshop start and a talk's slot) described itself as a plain date, so every face offered a date picker, the picker gave `2026-09-20`, and the act's own pattern refused it: no workshop could be made and no talk given a slot, on either face, at either width, with either hand. The date shape and its form field now carry `time: true` for such a pattern; the routed form, the scene's ask, the edit in place and the studio's agent panel ask with a date-and-time control, and the conversation and the starter fill one with a time of day.
- 40f39ff: A field's value on a card stays in its cell. An editable value was a button as wide as its words, so a value with nowhere to break — an email address, a VIN, a URL — ran out of the facts column and under the relations beside it. The button is never wider than its cell and, like a read-only value, breaks anywhere.
- 5297528: A withheld act says why. The actions strip named a refused act and put the reason in a `title` on a disabled button, which cannot be focused — so the explanation was out of reach of a keyboard and required hovering a dead control. It is struck through with the sentence beside it now. `Grant.describe`, documented since it was added as the thing shown on a refusal, is finally read: a refusal repeats the policy's own words. And a refusal about a derived edit counts the grants that name it as well as the acts it rides, so a `mutations: "*"` grant no longer produces "no role can".
- ce13ec8: The board lens draws a token when a code is a word, and shelves a zone's slots when the arrangement is categories. A 34-pixel disc holds "GK" and "LB"; it never held "Outbound", which spilled past its ring, or "Prop-fin", which wrapped at the hyphen inside it — and a slot's code is its whole label whenever nothing shorter is bound, so most boards outside a pitch were boards of words in circles. A board whose every code is three characters or fewer still draws discs. Any longer and the whole board draws tokens: a pill sized to its code, cut with an ellipsis past the width of a long word and carried whole in the title, with whoever is in it on the line beneath, INSIDE the mark — so a mark is one box whose size is known, and two names on a shared seat can no longer land on the row below. `occupantLabel: "given"`, which shortened those names to hide the collision, is gone.
  
  `arrange: "shelf"` is for a board whose x and y are categories rather than coordinates — a load map whose rows are "still owns", "shared", "handoff". Each zone becomes a band with its name as a heading row of its own, and its slots flow into rows in the domain's order, sized to what they hold; nothing on a shelf can overlap anything, and a zone's name can no longer be clipped to the middle of the word by a fifteen-pixel rail. The default, `"exact"`, is unchanged for a pitch or a seating plan, and its rail now ends a name that does not fit with an ellipsis and carries it whole in the title.
  
  The `graview-lens` and `graview-new-app` skills and the package READMEs say so: the board's two marks and its two arrangements, and that a new app's pages face wants the scene's `views` to land on its gallery.
  
  A placed mark is as wide as what it holds: an absolutely placed token with no width of its own shrank to the room between its point and the field's edge, so on a phone-width board a token at 82% was 22 pixels wide with its word broken inside it.
- 959955f: An agent in the studio: ask for a declaration change in words, see it checked, keep or discard it.
  
  Both halves of this already existed and nothing joined them. The studio could take a proposal from an agent seat — `propose`, `proposals`, `decline` — and the chat panel could already turn words into proposals over the ordinary runtime. But the studio itself had no agent in it, so the one surface whose subject is the declaration was the one surface you could not talk to: every change by hand, one act at a time, with the whole shape held in your head.
  
  The studio's bar now carries its own Ask. A turn produces PROPOSED studio acts and stops there — nothing is applied by asking. Each proposal is put through the new `Studio.would`, which applies the call to a copy of the store and checks what the declaration would become, so `graview check`'s findings are read before anyone is asked to keep anything; a change that would add an error is struck through with the finding that condemns it and has no Keep button at all. Keeping calls `studio.propose`: an ordinary op in a batch of its own under the agent's name, with an inverse, so the studio's trail says who proposed it and undo takes it back.
  
  Keyless first, like the rest of the ladder. `studioResponder` reads the meta-graph and answers about the declaration itself — what kinds there are, what an act writes, what a rule judges, who may take it, which kinds have no figure — and fills studio acts from a template: "add a due date to tasks" becomes `add-field` with the type the name implies, optional so records that already exist stay valid; "every shift needs a volunteer" becomes a rule over the shift. A model upgrades it through the same one-function `Completion` seam, with the studio's own floor under it, so a fact the declaration holds is never replaced by a fluent guess about the same fact.
  
  This is also where the `drawFigure` gap lands, recorded honestly when figures shipped: the drawing carried the house style and judged its own answer, and was reachable from code and from `graview figure` and from nowhere a person sits. "Draw a figure for volunteer" now reaches it from the studio, and a figure is finally something a declaration can carry through the studio at all — modelled on the kind, read in, written back, and written into the schema file. Before this, opening the studio on a drawn app and applying would have rubbed every drawing out.
  
  `figureFaults` — the checker's own judgement — now closes the drawing vocabulary: a figure is line art made of drawing elements and drawing attributes, and a `<script>`, an `onload` or a remote `href` is a fault with a name rather than something that passes a style check and is inserted as markup. That is what makes a model's drawing safe to show somebody before they keep it.
- 71de067: The arrange bar's selects keep their 32px floor in WebKit. WebKit ignores `min-height` on a native select, so at phone width every sort, group and filter select was 22 pixels tall there; they now drop the native appearance and draw their own chevron.
- b5e43ab: An empty graph is not a misbinding. The coverage grid and the board both threw a binding error whenever the kinds they were bound to held nothing — which is every kind of a blank app, where a lens's title is in the bar from the first paint and pressing it took the scene down. A role naming a kind nobody declared still throws; a declared kind with nothing in it is an empty picture.
- d59b6c8: An opened district lists what it has room for, in names you can read. The layout reserved 96 pixels under an opened district and the view listed sixteen members in 250, two columns of ninety-five pixels, under a header whose name column could shrink to nothing: a dealership's Vehicles, opened at the foot of an eight-district city, read "VEHICL291ES" over sixteen chips of "2026 Ma…" running off the scene. The layout now reserves rows (`rosterRows`, `rosterHeight`, `ROSTER_ROW` exported), tells the view how many the city kept room for (`openedRows`, carried through the tween), and the view lists that many in as many columns as the names can be read in (`rosterOf`), with the rest counted. The header wraps its count under the name.
- 6af312b: An undo that is refused says so. `store.canUndo` answers what the log can answer — whether a later op read what this one wrote — and not what the declaration answers, so taking back a migration that added a required field threw out of the click handler: an unhandled error and a button that appeared to do nothing. The reason is shown on the control, the way the agent seat already shows its refusals.
- 455ef3e: The board lens takes a choice about what a press selects. `pickTarget: "slot"` makes a press on a mark choose the slot itself even when one occupant fills it — a load map is asked about the component, not its sole owner — where the default, `"occupant"`, keeps a sole-filled mark standing for that person.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- b3ed5f6: Confidence is a first-class answer, not a number in a log. `PlannedCall.confidence` (0–1) is how sure the proposer was, carried on the call rather than written into `why`, so the same number travels wherever the call does. A run's every answer reaches a surface with its confidence and full distribution (`Answered`); an answer that came back split — the top two options within `splitWithin` of each other, "turf 0.5, bed 0.45" — or below the `floor` is not applied and not dropped but OFFERED: an `OfferedQuestion` naming the node it is about (id and label), the question in the declaration's words, why it is asked, and each option with its probability and the call it would be. `offerOf(answer)` is the rule. A confident answer is still a plan before it is a change.
  
  Offered questions travel the seat's own reply — `ChatReply.questions` — and `replyFromRun(result)` speaks a whole run that way: what it asked, the confident calls as proposals, the rest as questions, a refusal or a stop said out loud. The chat panel stands each question at its node, "Back Lawn: Which surface?", with the options as presses that land through the same attributed, undoable path a proposal does. `PlanReview` reads a plan whose calls carry a confidence least sure first, with the number beside each row, and still applies it in the plan's own order.
- 73b30dc: A coverage grid's column names stand on their columns. The heads and the cells are the same box now — border and padding inside the width on both — where a border outside the cells and padding outside the row names had them drift ten pixels plus one per column. And a column scrolled under the sticky names takes its name with it: its label no longer hangs over the columns still in view, which made a grid scrolled four columns along read as every label four columns out.
- e9f07b3: The stylesheet no longer carries rules for what nothing draws: the seat's speech bubble and trail (its body left the picture), `.graview-kind-note` and `.graview-visually-hidden`. The occupants' comment says what they are now — the others, not this tab's seat.
- b79ef9a: Escape on a popover gives the keyboard back to the button that opened it. The activity list, the problems list, the chat panel and the profile pane each closed on Escape and left the keyboard on the control inside the pane that had just gone, so the next Tab started from the top of the document — and in WebKit went nowhere. `closeToTrigger` moves the keyboard to the popover's own `aria-expanded` button when it was inside, and leaves it alone when it never was.
- 05aaa72: Escape out of a record lands the keyboard on what still draws it. Backing out of a record at altitude took its card away with the keyboard on it, and the keyboard fell to `<body>`: the next Tab went to the zoom buttons in Chromium and elsewhere in WebKit. `BackOut` now notices when the element the keyboard stood on leaves the picture and puts it on the card that holds the record's chip — its district — or, failing that, on a card in the scene (`landTheKeyboard`, exported).
- 796bf9e: Every picture paints at a real size. A panel's "there is more" fade is painted in the panel's own ground rather than masked: a mask made the scroller an offscreen layer, and one painted before its rows arrived stayed black. A thumbnail waiting to be drawn is as tall as a picture, so one drawn at a twentieth of its size is still seen and drawn, and two pictures' names each keep to their own frame. A kind tucks behind the kind it hangs off only when the row needs the room; with room for every kind, each has a slot of its own. A calendar horizon longer than a decade draws a year to a cell. A card on the relation plane shorter than a summary's 80 pixels draws as a chip rather than a title and a sliver. The coverage matrix is built from an adjacency rather than a scan of every edge per column, a view's group members are looked up once per graph, and a tween's stand-ins once per pair of stops.
- a6f64b0: Every size the framework draws is the reader's to change, and a test says so.
  
  The text-size setting works by one number on the root element, which is why every size here is written in `rem` or `em`. A single `font-size: 10px` opts one control out of it entirely — and four of them had. Set to Largest, every name in the city doubled while the district's own "open" control stayed ten pixels tall, along with the "+N past" tag, the altitude caption and every `<code>` span. The profile's mark was an 18-pixel circle around a letter that had doubled, and the name beside it was clipped to "Nobody in p…" by a 220-pixel cap.
  
  All of it is measured now rather than asserted: a probe loads the app at the browser's own size and at Largest and diffs every box. What came back was fifteen boxes that never moved while the text doubled. The framework's are fixed — four stylesheet rules, the profile's mark and name width, and five sizes in an embed's own chrome — and a new test walks the source of every package a person installs and fails on a font size written in pixels, in either spelling. A list in a commit message is not a guard.
  
  The demos had the same bug in bulk and are converted too: the garden's own product design (28 sizes), the launcher, and Things' views. `apps/promo` keeps its pixels on purpose — a 1920×1080 video composition has no reader and no setting.
  
  A district's drawing now keeps up with its name. The drawing is sized as a fraction of its card, the card is laid out in pixels off the stage, and the nameplate is sized in `rem` — so at Largest a doubled name stood over a drawing that had not moved at all, a postage stamp under a headline. It has a floor in `em` now, capped at the card: a first cut without the cap overflowed and the drawings were sliced off at the bottom edge, a plot reading as a V rather than a bed.
  
  **What still does not scale, named rather than hidden:** the scene's card geometry. `graview-kind-card` is 230×97 at every text size, because the layout sizes cards as fractions of the stage in pixels while their text is in `rem`. Making the city itself grow with the reader means fewer districts fitting on the ring, which is a layout change with its own design decisions — worth doing, not worth pretending is done.
- 894f0f1: The quick-select chips beside a focus can be told apart. Each was its member's name cut at eighteen characters, so a customer's three test drives — each named for the customer and the vehicle — were three chips reading "Wei Haddad in the…" and three buttons with that one name. Where two cut handles would read the same, the words they share are what is cut ("…2017 Jeep Wrangl…"), and every chip's accessible name is its whole name. `handles(labels)` is exported.
- 130e9c6: In a narrow box the picture makes room. The actions strip is a left rail sized for the gutter beside a centred focus — and in a 350-wide embed there is no gutter, so it covered 85% of the card it was about and a click meant for the picture landed on an action. Where the scene's own box cannot hold a rail beside the picture, the pane goes along the bottom and the scene gives up that height while it is open, so nothing is drawn under it.
- 2dd2f0e: Longer horizons on the calendar lens: a quarter, a year, and a span of years the app names.
  
  The calendar topped out at a month, so anything further out than four weeks was off the end of every picture the framework could draw: a planting sown in March and lifted in July, a plot on a rotation, a quarter's coverage, a lease, a review cycle. An app whose subject was years had no lens at all — it had a month grid it could page through twelve times.
  
  The same lens now draws a quarter, a year, and a multi-year horizon **whose span the app names** — three years, five, ten — rather than a "5yr" button the framework guessed at. One binding and no new declaration: a lens declared once draws at every horizon, and `graview check` reads exactly the binding it already read.
  
  The cell coarsens with the horizon — a week per cell at a quarter, a month per cell at a year and beyond — and `spanOf` now answers with CELLS rather than days, because a day cell and a month cell differ in how much ground they cover and in nothing else. An entry spanning cells is drawn across them the way a fortnight is already drawn across days, keeping its name where it begins and again wherever a row does, which is what a wall calendar does. Above a month, listing everything stops being a picture, so each cell carries what fits at full fidelity and the rest as a count with the rules' own flag on it.
  
  Each range is an addressable stop, and `lens.at(range)` registers one as a titled place of its own: `places()` lists it, the URL names which one you are in, pressing a cell opens one level finer, and Back returns to the year you left. Rescheduling is unchanged — the declaration's own act, judged by `store.permits`, refused in the policy's words — with one new honesty: dropping onto a cell coarser than the date the act writes says which day it wrote, rather than rounding silently.
  
  The demos exercise them, which is the only way anyone finds out whether they are any good. Seedbed gains a sixteenth chapter: a `rotation` kind, one act, and four years of two beds turning through four families — the first thing in the garden whose subject is years rather than one season — plus a year over the plantings. Rota gains a quarter over its shifts, which is how a roster is actually planned. `verify-calendar.mjs` drives all of it in a real browser: forty-eight cells over four named years, a rotation drawn across the eight months it runs, drilling into 2028 and coming back, a coarse drop saying what date it wrote, axe clean at 390 and 1280 in both schemes, no spill at 200% text, and the reader's motion setting honoured.
- 171075a: Nothing hangs below a card in the stack. The district card clips (not hides) what rests under its foot, so the invisible iso block waiting to rise no longer makes the stage scroll; from altitude the card opens again. A robot whose foot is on the ground is drawn far enough in for its whole body, name included. The survey counts a cut only when something a reader could see is behind the edge, and names it.
- 4450ee4: Nothing in the rail paints over its neighbour. The conversation sits between the acts above it and the relation key below, and a section that is handed less height than its content will paint the difference straight onto whatever comes next — which is what expanding "What the lines mean" looked like. Three things now make that impossible rather than unlikely: the rail's rows are sized by their content and packed at the top, so a row cannot be compressed below what is in it; the conversation carries a `min-content` floor of its own and one layer fewer between it and the column; and it clips, so the worst an engine that disagrees can produce is a section that scrolls inside a rail that already scrolls. The companion harness opens the key with something in hand and fails if any section overlaps the next or spills its own box.
- 9bad891: Nothing withheld is hidden in the strip. Under a policy the rail struck through the first three acts a seat may not take and dropped the rest without saying so; past three it now offers "Show N more withheld".
- 3e3bfff: One door for what is yours: the scheme, the installation and the studio move behind the profile — and Back knows about both of them.
  
  The bar carried "Show the installation" and "Studio" beside the places, so every reader met two controls only a keeper can use in the same row as the app's own pictures. It also carried a scheme toggle while the profile pane carried a pair of scheme buttons — two controls for one setting. All three live in the profile now, under a heading that hides itself when it holds nothing, and the profile button wears a gear so the settings can be found rather than discovered.
  
  **Both doors are stops.** Showing a module said in its own comment that it was one — "so Back knows the way out" — and it was not: `shown` was missing from the comparison that decides whether a change pushes a history entry, so the address gained `show=installation` and the entry was REPLACED. The arrows stayed grey and one Back from the installation left the app. Opening the studio was component state, so the one door in this interface the back button knew nothing about was the door into the app's own declaration. It is `in.studio=open` now: the browser's arrows and the bar's own carry you in and out, a link can open it, and closing puts you back on the stop you came from. `adjustment` is exported and tested, and `verify-navigation.mjs` drives both doors in a real browser.
  
  Three things had to be true for the move to work. The pane is **mounted whether or not it is open** and hidden instead — a control in it may own something that outlives it, and unmounting the pane on the first press inside the studio took the studio's portal with it. `hidden` alone was not enough, because the pane's own inline `display: grid` beats the browser's `[hidden] { display: none }`, and a closed pane that still swallows presses is worse than one that is merely visible. And a press inside a dialog the pane opened is not a press "away" from it.
  
  Two things the move exposed, both fixed: the seat switcher did not wrap, so in a 280-wide pane the third seat was a name cut in half; and "Your record ↗" was a nineteen-pixel control, which no audit had ever measured because until now no audited screen opened this pane.
- 2b2df36: One matcher finds a thing anywhere in the graph. `search(store, query, { principal, from, subject, places, today, limit })` in `@graview/core` returns ranked hits — a record, a kind, a place, an act or a rule — each with a `why` naming the field that matched and the words around the match. Matching is on folded text (case, accents and punctuation aside), every word the start of a word, never fuzzy; `key:value` tokens are the arrangement's conditions, applied to the kinds that offer them, with `kind:` to narrow and `is:any` to include past records. Records rank by how the words matched (exact name, prefix, whole words, parts, a field), then near the subject, current before past, recently touched, flagged, alphabetical. What a seat may not see is not a hit, and an act is a hit only on a highlighted record. The arrangement's `q` uses the same matcher, so a list's `?q=` and the Find box never disagree. The agent's runtime gains `search_graph`, first among the read tools, with the records it named counted as reads; the MCP instructions say to reach for it before `get_graph`; `graview describe` and `llms.txt` say what each kind is searched by.
- a9381af: One control row arranges every surface. `ArrangeBar` in `@graview/primitives` draws Sort by (with a direction), Group by (with a bucket for a date), the conditions as chips with one grouped select to add another, and the words a person types — all from `arrangeable()`, so it offers only what the kind's declaration offers, in the declaration's words; a surface hands the current arrangement in and takes the next one back, and declines a part with `allow`. `arrangementOf(view)` and `withArrangement(view, next)` carry it in a stop as `in.sort`, `in.filter`, `in.group` and `in.q`. The arrangement grammar gains `q`: words a node's label or any scalar field must contain, the same matcher a search would use (`matches`).
  
  The pages list page arranges through the shared module under the shared keys — `?sort=due:desc`, `?filter=done:false,holds:today`, `?group=due:month`, `?q=tape` — and keeps every link it used to write: `?by=<edge>` groups, `?<edge>=<id>` and `?with=<edge>` narrow, `?past=1` widens the horizon. A stale link that asks for something the kind cannot be arranged by is told so and shown the rest. The kind's default picture in the scene draws the same row at full fidelity and groups its members when asked, with the choice in the fragment so an arranged district is a link and Back restores it.
- d9bfdb8: One seat, one conversation. The app's chat and the studio's declaration seat are the same thread now: `useSeatConversation`, `SeatThread`, `SeatHeader`, `SeatComposer` and `SeatSettings` in `@graview/primitives`, used by both `ChatPanel` and `StudioAgentPanel`. The person in a bubble, the seat in prose with its rung aside set quieter, each proposal settling in place ("✓ …", struck through when discarded, "Refused: …" beside the form it came from), "Apply all" / "Keep all" in order, and the history the model is told includes what was applied. The studio's gear opens the same `LadderSetting` the profile holds; `IntelligenceSettings` is retired. `StudioAgentPanel` takes a `respond` like `ChatPanel` does.
- 8976510: One switch, four rungs — and a rung that says what it cannot do. `IntelligenceConfig.source` is now `"graph" | "local" | "decision" | "remote"`: graph only, onboard AI, Jev, LLM — one setting, live, saved in the person's own browser. The ladder has two axes and `RUNGS` says so: each rung declares the capabilities it serves (`prose`, `decide`, `propose`); a surface asks `rungFor(config, capability)` for a capability and never for a provider; and a capability the chosen rung cannot serve falls down to the graph, which is keyless and always there. `capabilitiesOf(kind)` in `@graview/core` is the same table for declared providers, and `graview describe` reads the ladder out — which rungs the app declares and what each can do, and what the graph answers instead on a rung that cannot.
  
  On the decision rung the chat seat is answered by the graph and SAYS so in the answer itself — "(Jev decides rather than talks — the graph is answering here.)" — as part of `ChatReply.say`, not chrome painted by the panel, so every surface the seat speaks from carries the sentence unchanged. A turn that started on one rung while the person moved to another says which rung answered it rather than finishing silently (`configuredResponder`'s `current` hook, wired in the chat panel and the studio's). `decideFor(config)` is the decision behind a rung for a surface that wants one: the provider exactly on the decision rung (by the person's key, or through the dev server's door), a model behind the full parse-and-refuse layer (`completionDecide`) on a model rung, and nothing on the graph rung — where `graphDecide(store)` answers what the store's own rules already decided and names what it cannot. The picker offers the fourth rung with an optional key; with none, the app's decision door is used.
- d5227b5: `store.permits` answers as `apply` would for a declared agent: what its `may` excludes is refused, in the same words. The chat asked `permits` as the person and was told yes, offered a repair as the starter seat that may only add, and the press was refused; it now asks as the seat that applies, and such a proposal is withheld with the reason beside it.
- 3815bcf: Relationships are structure on the routed face. `kindMap(store)` derives every declared relation between the kinds with its own words and its live count, and the face draws it as "How it fits together" on the home page and at `/map`, each line with the same mark the scene's key draws (`RelationMark`, now exported from primitives and usable without a scene), each count opening the far kind's list narrowed to the ones that have the relation. A kind's page says what it relates to, groups by a relation from the address (`?by=<edge>`) and narrows by one (`?<edge>=<id>`, `?with=<edge>`), so a list you arranged is a link you can send. A record links the other way round — the far kind's list narrowed to itself — and says which pictures it is seen in, each a page and a stop in the scene.
- 73690fb: Roads run on the ground. From altitude every pair of districts joined by a declared edge has one road on the ground layer, along the gutters between blocks — out of its plot, along the street, in at the other kerb — so no road crosses a third village and the city reads as villages on a street grid. Lines in the air are drawn up there only when they say something a road cannot: the relation the legend is asking about, the chosen edge, a member of the selection, a change that just happened. A focused screen's every member wired across the city is gone.
- fb6eb5d: The article agrees with the kind. A scaffolded project whose first kind began with a vowel opened on "Add a item …", and said it again on the card, the list page, the form and the act's own description; the checker and the actions strip wrote the same sentence themselves. `article` and `withArticle` derive it from the word instead — including the two families domain vocabulary is full of, "a user" and "an hour" — and the scaffolder, `graview check` and the strip all read from that one place.
- 216ba97: The assistant is on every page, and it is the same one. A routed face that grew a chat box of its own would be two assistants with two habits over one graph, so the pages face opens the scene's companion: one control in the corner, a drawer beside the reading column, the same subject header, acts, relations and conversation. The route is what "this" means — a record page is about that record, a kind's page about that kind, a picture about the kind it is a picture of — set as the provider's selection, so a question means the same thing on both faces. Grounded questions are offered before anybody types (`offer` on `ChatPanel`, also in the scene's rail), answered by the graph's own responder with no model at all. A proposal applies through the same runtime, attributed to chat and undoable, and one the policy withholds is struck through with its own sentence. The seat's open questions are listed on the problems page, which is the face's inbox, and the intelligence rung is chosen from the footer. The control is mounted by the router rather than the default shell, so an app that replaced every surface with a design of its own still has the assistant.
- 5343a1d: The relation band draws what a person can read. Its budget is the cards a row holds at a readable width times the rows it holds at a chip's height; below it nothing changes. Above it each relation (a run of one edge kind in one direction) stands whole if it is small, groups by what its members' own declaration offers — another edge's far end, a choice, a date by decade, year or month, never the relation's own edge, about five groups where it can — or keeps its most relevant members (the selection, the search's hits, the flagged, the recently written, the most connected) in its own order beside one "+N more" door. Groups are aggregates named in the graph's words with true counts, drawn as a band card with their first names, heard as "Single, 80 albums", and opened in place by the `expanded` stop; the door opens the kind's picture filtered by the relation. `bandOf`, `chooseGrouping`, `shares` and `isBandAggregate` are exported from `@graview/layout`, `LayoutOptions.relevance` carries what stands, and the arrangement's dates group by `year` and `decade` too. Focusing an artist with 1,100 songs draws 36 hosts and 50 line strands instead of 1,259 and 2,214.
- 45c7a2c: The bar is one row, and the companion is a rail. The bar had become a run of equal pills — the brand, the way back, the crumbs of where you are, every place, "Pages", the standing, the activity, the profile — that wrapped into two rows at a laptop's width. It is one row now, in three regions: who this is and the way back on the left, with the two faces as one switch; the app's own places in the middle as one segmented control that hands what it cannot hold to a menu rather than wrapping; and what is true and who you are on the right, which give up their words before the bar gives up anything else. The crumbs are quiet, because the picture already shows where you are.
  
  The companion stood over the corner of the picture as a floating card whose header said "starter · listening" and whose tallest section explained what to type. It is a docked rail now — the scene's height, a rule down its edge, the width the layout already keeps clear — titled with what it is about and why (selected, under the pointer, in view), with the actions and relations in a column and the conversation pinned at the foot: the offers, the field, and one line saying what answers. The seat's state shows only while it is doing something.
- 6dd2cfd: The bar and the plates say less. The altitude control reads "Up" on the ground and "Down to <place>" from altitude, where the place is the one you land in; the open chevron on a district's plate appears when reached for — hover, keyboard focus, or while open — and stays a real button in between; "moved" appears on the bar only after a hand panned or dragged in this tab, not for a pan a link carried; hovering a relation in the key lights its roads.
  
  Also: Escape clears the selection again. The profile pane is kept in the tree while shut, and the shell's Escape rule took any overlay in the tree as one open over the scene, so a press with the strip open did nothing; a hidden pane no longer counts.
- 45c7a2c: The billboard is the point of flying closer. Chosen from altitude, a lens was drawn at half the span and under half the height — a window into the picture rather than the picture — and the caps were the window's, so zooming grew the city under the board and never the board. It may take most of the span now, and its caps grow with the zoom, so zooming in enlarges it the way it enlarges everything else. Its grey grip strip with a "⤢ Full screen" pill floating over it is a title bar now: the picture's name on the left, one "Open ↗" on the right, and the whole bar the handle that moves the board.
- 7188978: The chapters on the page that explains Graview are the app itself: each of
  the twelve is mounted live by `@graview/embed`, from the same declaration
  and seed its photograph was taken from, with the scene, the Graview and the
  routed pages a click apart, and the site harness judges the page with all
  twelve on it.
  
  Putting twelve Graviews in boxes the size of a paragraph found what a window
  had hidden. The ring's nearest district ran past the bottom of a short
  canvas; rails reserved in pixels took a third of a narrow one; several
  embeds on one page carried identical landmarks, and a face written to own
  the document put a `main` inside the page's; the coverage grid's columns
  crushed to nothing in a narrow box; a link on the routed face was a line of
  text and not a target. So: the ring is only as tall as leaves that card
  whole; the rails are in proportion; an embed names its landmarks after
  itself and a page is a `main` only when it owns the document (`PageMain`,
  `context.embedded`); a coverage column is a fingertip wide at the least;
  and a page link is tall enough to press.
  
  Using the live chapters found four more, all fixed where they live: the
  inspector pane was fixed to the window and so opened at the page's edge
  over the host's navigation — it is positioned within the scene's own box
  now, and the pointer menu is clamped to it; a focused card in a box the
  height of a paragraph was cut across its own facts — a short canvas gives
  the focus more of itself; a line at altitude ran to a district even when
  the district was opened and drawing the very member the line is about — it
  lands on the member; and the dashed marks for a pinned or considered card
  were drawn around the whole natural box and the kind tag rather than the
  drawing. The embed's strip shows two faces, the picture and the pages,
  since altitude is the scene's own control.
  
  From altitude a focused GROUP shown by the framework's own list is its
  district, opened — the scaled list in the middle and the same names in the
  district were one thing drawn twice, and a reader said so. A group with a
  view of its own (a week, a board) keeps its scaled card, and then its
  district stays shut. The framework's own group views carry a mark
  (`markDefaultView`, `isDefaultView`) so a scene can tell. And a line's hit
  stroke now keeps out of the cards an end is drawn inside, so a line to Ravi
  never takes the click meant for June above him.
- 5572c41: The chat keeps the keyboard after a proposal is applied: the pressed button becomes a line saying it was done, and the keyboard used to go with it to `<body>`. It now lands on the next proposal still to press, else on the message field.
- 3e719c8: A kind is a neighbourhood: the city is a map drawn from the declaration, and everything in it has an address. `cityMap(schema, hints)` in `@graview/core` is pure and deterministic: it walks the kinds in the order a blank installation fills them (`beginning(app).order`, or sorted ids), puts the first at the origin and each next kind on the free block beside the placed kind it shares the most declared edges with, spiralling outward — in LATTICE CELLS, never pixels. Same declaration, same map; adding a kind leaves every existing plot where it was; population changes a plot's `side` and never its corner. A kind may declare `plot: { col, row }` and is put exactly there; `graview check` reports two on one block as `plot-overlap`. `roadsOf` names the roads between placed kinds, and `graview describe` reads the city out — each kind's plot and its roads — the first thing outside a browser that can say what is drawn.
  
  At altitude `layout()` places the districts by the map on the 2:1 lattice under ONE uniform scale and translate (`placeCity`), so the city has the same shape at 1280 and at 390 wide; nearer rows are drawn nearer with the depth number every plane style already reads; the collision shrink stays as a safety net, the opened listing gives up its room before the city grows, and the city slides aside for the live view standing in the middle rather than laying a district under it. `LayoutNode.plot` carries the address and survives `interpolate.mix` mid-tween; `Layout.city` says which lattice the picture is on, and the ground draws its diamonds at that cell, anchored where cell (0,0) meets the canvas and panning with it. Roads: a connector between two districts runs along the lattice's diagonals (`latticePoints`). Buildings: an opened district lays its members out as a `side`-wide grid inside its plot, each still a pick target, capped at `side × side` with "+n". The camera is bounded by the map's extent (`cameraLimit`) rather than a canvas fraction, so a city wider than a phone is reached by panning and nothing is dropped off the edge.
  
  `useWhereIs()` answers where a node, a kind card, a group or a Place slug is drawn from the CURRENT frame — riding the tween and the pan, measured from the DOM when there is one — with a member not drawn itself answering as its nearest drawn container, the connectors' own rule. `useScenePointer()` is the pointer over the scene in scene coordinates, and a quiet scene runs no listener: the store counts its subscribers and the scene attaches on the first, detaches on the last.
- f80138a: The city zooms and pans by hand. From altitude the pinch and ctrl+wheel used to step the altitude once, with a cooldown — a zoom that stuck — and the drag clamped the person's own pan while the camera's flight to a village sat on top of it, so the far side of a flown-closer city could not be reached. There is a scene zoom now, changed continuously by pinch and ctrl+wheel about the pointer and by zoom controls in the ground's corner, with the fly-closer step multiplied in; the plain wheel over the ground pans; the drag clamps the whole offset, pan plus camera, to the camera limit, so every district is reachable; direct manipulation is not tweened; the zoom resets on the way down. And a tween restarted mid-flight keeps its clock and its easing velocity, so a storm of restarts — two hosts reporting, a pointer's worth of wheel events — no longer crawls a pixel a frame.
- ada0f00: The coverage matrix says what is missing in the kinds' own words — "3 songs with no theme", "2 themes on no song" — instead of "3 unanswered · 2 unasked", a tender's vocabulary shown in every domain.
- 71fd426: The card that stands for the districts the row could not hold is one control, and the districts are one press away. It listed every name inside its own box — a district card's height, which holds a count and nothing else — so "+6" over one clipped word read as a broken placeholder, dashed and faded, and nobody could see what else there was. The card is a button now that says how many more; pressing it opens a panel above the row, portalled onto the scene's ground so no plane paints over it, naming every district with what it holds, each a press to that district. The district you are already in, which lands here when the row has room for nothing else, is marked as here rather than offered as somewhere to go. `@graview/react` takes `react-dom` as a peer for the portal.
- 4472467: Three things about the elevated view. A hand-placed district drew its dashed pin mark around a card with nothing in it — up here a district is a village on a plot, so the only visible part was an empty rounded rectangle sitting on the ground; the plot's own kerb already goes dashed, which says the same fact where the district actually is. An opened district laid its members out `side` to a row so the chips echoed the buildings on the lattice, which at a district's own width meant sixty pixels a chip and "Enough bodies for the drill" arriving as "Eno…"; the columns are set by what a name needs now, because opening a district is the gesture that asks which one. And a view is redrawn only when what it draws changes: a host re-renders on every frame of a flight, a pan and a zoom, and it was dragging every lens with it — the three live pictures on a board and the billboard itself, sixty times a second, for pictures that had not changed at all.
- 7783759: The Find box keeps room to type in. At a desk the bar gives it a floor of 6rem, and the trail's crumb for the focused record is capped and truncates, whole in its title. With a talk of a hundred characters focused, the crumb had taken the bar and left the box 23px wide, and Chromium commits text that arrives without a key — an input method, dictation, an on-screen keyboard — into a field that narrow with the caret left at the start: "Плинов" was written "вонилП" and found nothing. The Shell's bar wraps into its two rows below 920 pixels rather than 720, so the profile — the seat switcher — is never pushed off the screen between a tablet and a small laptop.
- 89f4855: The ground is the city's own grid, and a billboard sinks into its village. The lattice was four repeating gradients phased from the middle of the box and seamed at its edge, so its lines never sat where the city's cells were; it is drawn as tiles now, one cell by half a cell with both diagonals, pinned where cell (0,0) meets the canvas, so every plot corner is a lattice vertex at every zoom. The tween carries the city with it: between two cities the cell and origin lerp, so plots, roads and lattice grow and slide with the cards on them; rising, the lattice arrives with the destination; descending, the ground stays while it fades. And switching lenses across kinds no longer leaves the old picture standing at full size under the new one for the length of the tween — a leaving billboard had no stand-in, since a village's members are ground, not nodes — it shrinks into its kind's signpost and board, and the next rises out of its own.
- f240a12: The ground under a district. From altitude every plot is drawn as the iso tile it is — four lattice corners in the kind's hue, a kerb, a cast shadow — so a district stands on land rather than floating on a hatch; the fields between darken toward the near edge and the lattice carries twice the weight; a hand-placed district's kerb is dashed; the robot's pad is a cell of the ground in the ground's own ink; clicking a tile focuses its district.
- e0d5026: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- 494c1a1: What the lines mean says what the lines mean. The relation key listed each relation by its edge's name — `for-vehicle`, `takes-in`, `offered-by` — which is the source's word for it; each row now reads the declaration's description ("The vehicle it is for") over the two kinds it runs between in their plurals ("Deals → Vehicles"). `relationWords(schema, edgeKind)` is exported for any other surface that names a relation.
- b7d3209: The keyboard always lands somewhere. When an act removes, disables or hides the control the keyboard was on — Escape closing a menu, a chip's × dropping the selection, Back taking the page away, "Send" while the answer comes — it lands on the nearest thing that still stands where it was, or on the same control when a re-render drew it again (`useTheKeyboardLandsSomewhere`, installed by `Shell` and `<Embed>`). The studio hands the keyboard back to whatever opened it when it closes, and a routed page that replaces another lands it on the new page's heading. Eight walk findings were this one rule broken on eight surfaces; the browser harnesses' watch found it on about forty more.
- 6dd2cfd: The ladder is a setting. Which rung answers the chat — this graph, a model on this device, Jev which decides, or a model with your own key — is one row in the profile pane beside text size and scheme, with a key field only when the rung needs one and one sentence on screen; the provider owns the choice (`intelligence`, `chooseIntelligence`) so the profile sets it and the chat reads it. The chat's gear and its pane of prose over the map are gone.
- aeb1693: The calendar and plan lenses are files by what they do. The calendar: its options, its date arithmetic, placing an entry and moving one, the view, the spans a range is drawn in, and the drawing. The plan: its state, its drawing and the lens that binds them. `calendar.tsx` and `plan.tsx` say what the parts are and re-export them; a comment that had drifted from the viewBox scale went back to it. Nothing exported changed.
- 6a043bf: The lenses are pictures, and choosing one flies closer. From altitude a district's board shows each of its lenses as a small live version of the lens under its name, not a label. Pressing one stays aloft: the kind is focused with that showing, the billboard on its plot shows it, the city's cell grows by half so the camera is brought in toward that village, and the camera centres on the drive-in with the picture's top kept inside. The billboard carries the one way down, a full-screen control that leaves the graview with that picture. The billboard's foot stays on the kerb wherever that is; the camera brings it in rather than the layout sliding it down over its own village. The billboard is cut to its picture: a lens lays itself out in a box as tall as the window, and the billboard used to show the whole box, its picture floating a village's height above the kerb — the scene now measures how much the lens actually drew (what is in flow, plus what its scroll regions need beyond what they have) and the layout sizes the billboard to that, floored so a title alone is not a picture. The small lenses on the board are inert: nothing drawn inside one takes focus or a press. The billboard's frame, posts and ground sit on the picture's box, so an empty lens is a header over an empty screen rather than a strip floating over the village.
- b7fa5e3: The menu leads with the thing you clicked. `deriveAffordances` takes a `focus` — the node the gesture landed on — and ranks by it: that node's own repairs first, in the order the rule listed them, then its own acts (settled before asking), then everything the rest of the selection offers. Until now a rule that implicated five late tasks in ONE violation offered its ten repairs in whatever order it walked its subjects, so right-clicking the fourth task met the first task's repair at the top and the obvious press fixed somebody else's problem. Which node an act is FOR is read off the mutation's own `nodeRef` arguments rather than the violation's cast list, so "a new date for Book the hall" is Book the hall's repair wherever it came from. Every surface reads one rank, now stamped on each affordance as `rank`: the pointer menu (which names what it was opened on), the actions strip (whose focus is the last thing selected), and the routed record, where a rule's repairs are ordered by `rankedRepairs` instead of as declared. The destructive tail is unmoved, and a derivation with no focus ranks exactly as it did before there was one.
- 9ff994c: The places row keeps room for what its "more" menu may say. Standing on a place the row could not hold, the menu shows that place's name rather than "+2 more" — and the row had kept 92 pixels for it, so on Seedbed's rotation "The rotation" ran the row seven pixels past its own edge in both schemes. The row now keeps room for the widest name the menu could show.
- 4c66166: The places row keeps room in its "more" menu for the name of the place you are on only when the menu holds it; otherwise for "+N more". Keeping room for the widest name the menu could ever show emptied the row of a bar at 1280 into "+3 more".
- 61d76a0: The garden grows to twelve chapters, and two of the new ones answer what a
  product needs most: the other face, customised, and a second lens.
  
  `@graview/pages` exports `pageStyles`, the face's own type and spacing, so a
  record page an app writes itself is still the same face rather than a copy
  that drifts. The garden registers the plot's page in its own words over the
  derived defaults, and `graview create` writes the same customised page for a
  new product's first kind — the routed face is derived, and any page of it is
  yours to replace.
  
  The board lens takes `fillFrom: "occupant"`, so a domain whose edge runs from
  the occupant to the slot — a planting grows-in a plot — binds it without
  redrawing its edges to suit a seating plan. The garden draws its plots where
  they lie and the empty bed is the picture.
  
  Layout reserves the rails in every mode now, left and right: the quick
  relations and the inspector sat on a full-width lens's title in focus, and
  the altitude control sat on a card's corner. Every card keeps to the span
  between them, and a test holds it.
- 9767a5e: The scene has a Find box, and the picture is the result list. `q` is a view state field beside the focus and `within`, carried as `#q=`; typing replaces the address rather than pushing one entry per letter (so does a row's own `in.q`), and it outlives a change of focus. The provider searches once per change and `useImplicated` lights the hits in every picture through the emphasis views already read — words that find nothing dim it all (`NOTHING_FOUND`); `useReached` keeps what the selection alone reaches, and `useFound` gives the result. At altitude a district with hits is lit and says "3 match", the rest recede, and pressing the count or the district descends with `in.q` set, so the district opens narrowed and Back returns to the lit city; Escape clears the words before anything else. The `FindBox` sits in the Shell's bar, reached by `/` or ⌘K: a combobox over a listbox grouped by kind with each hit's why, a place as "Go to …", the acts on a highlighted record under it, a live count, and on a phone a full-width sheet under a box on its own row. `search()` takes `kinds` to look only where the scene draws.
- 7840cd5: The places row fits what it actually draws. Its pills' widths were taken once as they mounted, and the room kept for the "more" menu was a pill's width plus fourteen pixels — while the menu, showing the place you stand on, draws "The rotation" in 144 pixels against its pill's 106 — so seedbed's places ran seven pixels past their edge. The pills are measured on every fit and watched, and what the menu adds to the place it shows is measured.
- 0a6a3fe: The rail is a column of sections, and one of them was a fixed box. The conversation asked for a middle row that filled whatever it was given and a floor under the whole panel, which made it shorter than the log, the grounded chips and the field together — so expanding "What the lines mean" underneath it had the chips and the input painted straight over the relations. It is sized by what is in it now: the log keeps its own floor and ceiling and scrolls, everything else is as tall as it needs to be, and the rail's own column does the scrolling. The log's floor in the rail is smaller too, because a hundred and twenty pixels of blank under one sentence reads as something failing to load.
- a0ffc2f: The rail is still while the picture moves. Its subject is what the pointer settled on, and it read the pointer the ordinary way — a store subscription React re-renders on — so the acts, the relations, the conversation and the key were all redrawn on every pointer move, sixty times a second, for a subject that only changes when you stop. The moves are watched now without a render, and only what the pointer settled on is state. Dragging was worse than moving: the city slides one district after another past a pointer that never moved, and the subject chased every one of them, so the rail flickered through the whole map on the way. While a hand is down, and while the scene is still travelling, the question is not asked at all. Measured on Squad: sixty pointer moves and a thirty-step drag now redraw the rail zero times, and the companion harness fails if either starts redrawing it again.
- 7be1ad2: The last sentences that named one of a kind by its id read its noun: the strip's reason for an act ("this is a staff member"), what a beginning is waiting for, the ask's picker label, and the reach lens's hover.
- 60e4bf5: In the stack the docked robot stands at the far end of the shelf's first district rather than across its nameplate; the two sharing settings carry four distinct labels; a places pill and a drive-in marquee button clear a fingertip after the depth scale.
- 6dd2cfd: The screen stands on its plot and the signs stand on the land. From altitude a focused place's picture is a billboard at the back kerb of its plot, framed, on two posts, with no clearance needed above its card; the nameplate is a signpost planted at the plot's front corner on a short post; the drive-in's board of showings hangs under the signpost in the ground the layout reserved for it; the kind's landmark stands in the village square among the buildings. The "shown above" note on a focused plate is gone: the screen says where the members are.
- 43cf40d: The seat is a companion attached to the viewframe, not a figure walking the ground. Four panels used to say the current subject in four corners — the inspector's strip and its pointer menu, the quick relations, the relation key, and a chat panel behind a pill on the bar, anchored to a robot that stood on a pad, walked to what it wrote and followed the pointer when pressed. One construct now: `Companion`, on the left where the scene already reserves a rail, fixed to the frame so it is the same at altitude, on the ground, flying closer and inside a full-screen lens, where the figure had no place at all. It names its subject in its header — the selection, else the pick the pointer has settled on, else where you are — and "this" in a message means that. Under it: the acts for the subject from the same derivation the pointer menu reads, the relations, the conversation, and the key at the foot. Right-click still opens the acts at the pointer, so the context menu and the assistant are one thing; Escape closes that popover and never changes the subject. Collapsed it is a narrow dock; on a phone it is a sheet. `RobotMode` loses `following`, the robot's pad leaves the city map, and other people's agents keep their figures — a body in the picture is how you see somebody else at work. `useSubject` is exported for a surface that needs the same answer, and `useAffordances` takes `about` for acts on something nobody clicked.
- 315ce3b: The seat is a robot in the city: it stands where it reads and writes, comes to your cursor when asked, and says its refusals at the gate. One figure per agent participant (`kind:id:session`, the op log's own key), drawn by an `Occupants` overlay over the stage on both renderer paths and positioned from the live frame through `whereIs`, so it rides the tween and the pan and never enters `layout()`. Where it stands is a pure fold (`foldRobots`, tested like `markActivity`): a read puts it at what it read, a write at what it wrote, more than four targets at the neighbourhood, a refusal at the gate with the policy's words as its say, a question on the node's doorstep, rest after the hold at its dock — the seated person's own building when the installation is shown, else a pad at the city's origin cell. Movement is one CSS transition on transform; a quiet city runs no loop and no pointer listener, and reduced motion makes moves instant.
  
  The tab's one-press seat and its chat are ONE robot: the seat registers its name and the chat writes as it (and is seated even while the Activity rail is shut, so the body is docked from the first frame). Applying a plan walks it to each target before the op lands (`applyPlan`'s `before`); undoing an agent's turn walks it home; a run's stop sentence, announced through `onCall`, is said from its bubble. Click the figure, or Tab to it and press Space, and it follows the pointer, offset so it never sits under the cursor; while following, "this" in the chat is the pick under the pointer and the chat panel is anchored as its bubble; Escape releases from anywhere. Off the visible ground an edge indicator points at it with its status line. The bubble is a polite live region carrying whatever the seat says on its rung, and the figure is a named button. `scripts/verify-robot.mjs` drives all of it on the todo app; the seat harness still shows identical diffs.
  
  Also: the graph responder now fills a choice argument from the option's own word in the sentence ("give a role keeper to Sam"), and only when exactly one option is named.
- d9bfdb8: The seat's reply is read by the model it was meant for. A sentence that names a thing inside a change ("Erin tends that plot") is no longer answered as a grounded fact about the thing, so a model on the ladder reads it; the model is shown each act's argument signature, the graph's connections and today's date; `describeProposal` words a proposal in the act's own `describe`; `stillNeeded` counts a name nothing answers to yet as still owed.
- f8f0e29: An agent seat a policy refuses says so in the store's words. The line under a struck-through seat read "The store refuses add-vehicle, and the actions strip refuses it too" — the act by its identifier; it now says the store's own sentence, the act by its title and who may take it.
- daccd55: The studio is a place on the bar. `<StudioPlace app={...} />` opens the running app's own declaration — kinds, fields, edges, acts, rules, roles and grants as districts, "What the checker says" as a place, the ordinary acts to change them, the studio's own history and undo, and an agent seat that proposes a repair for a rule that names none. Applying runs `graview check`, refuses on errors naming them, and otherwise offers the files `graview create` writes as downloads. Offered to the seat that administers where an app declares something administered, and to whoever is here where it does not — so a scaffolded project has it on day one. `Shell` takes it as a slot (the studio already depends on the shell's primitives); the embed strip takes it boxed, so a studio cannot escape onto somebody else's page.
  
  `ArgShape` gains `{ type: "boolean" }`. Without it "Add a field", whose `required` is a plain boolean, was derived NOWHERE — the studio's central act, in the studio, unreachable because nothing could ask one question. The strip asks it as two buttons rather than a text field somebody has to know to type "true" into.
  
  And what the studio does not model, it no longer destroys: a kind's `display.labels`, `display.hide`, `fixed` and `fieldRoles` are carried from the checkout through both the declaration and the written schema, narrowed to the fields that still exist. A `display.format` is a function and cannot be written; the file says so where it finds one, and `WrittenFile.kept` names it, instead of losing it silently.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- ce13ec8: `Begin` takes a `frame` around its own door and nothing else. The scaffolded Home wrapped `Begin` in a `PageMain` with the derived home as its `whenFull`, so once the graph had something in it the derived home — a whole page, with its own landmark — rendered inside a second `main`, and its gallery inside a 760-pixel reading column, one card wide at a desk. The frame is applied to the door alone; what comes when the graph is full is returned exactly as it was given. `graview create` writes the Home that way now.
- e7735c1: The way in is a page with a heading, and keeps the keyboard. `Panel` takes `heading` (1–4) to make its title a real heading rather than a `<strong>` styled as one, and a framed `<Begin>` — the routed face's first screen on an empty graph — is its page's `h1`, which axe had flagged as `page-has-heading-one`. Answering the door from the keyboard no longer ends on `<body>` when the row that asked goes away: the keyboard lands on the next way in, or on the heading of the home the door stood down for.
- ccaa5f4: Search reaches the pages face and the conversation. `/search?q=` lists what the words find grouped by kind, each hit with its why and each kind's heading a link to its list with the words carried; words that find nothing say what was searched ("current ones; add is:any for past ones") and offer the beginnings the seat may run, "A task called “zzz”", with the words already in the name (`beginningsFor`, `SearchToCreate`, and `DerivedForm`'s new `initial` — starting values that stay editable). The derived shell's nav carries the box, `PageFind`: on a kind's list it narrows that list, elsewhere it goes to `/search`, typing replaces rather than pushes; an app's own shell can use it, with `narrowsLists: false` when its lists have a box of their own. The list page reads its words with the shared matcher — `key:value` tokens and `is:any` included — shows why a row is there when it was not the name, and under the derived shell drops the row's second box. `/search` is a derived route an app's own `route()` is warned off. A message the conversation reads as no act and no fact, whose words find records, is answered with them as `picks`, each a press in the chat that goes there. The activity rail shows the records a read looked at, so an agent's `search_graph` says what it found.
- 49d4458: The workbench is eight files, cut where its own section banners already cut it — the ask for an act's arguments, the inspector, following, the standing, activity, the agent seat, backing out, the trail — with `workbench/index.tsx` saying what the parts are for and re-exporting them. Nothing it exports changed.
- bd1f27b: Two changes to an arrangement before the page draws again are both kept. The arrange bar merged each change onto the arrangement it was drawn with, so a grouping chosen and a word typed in quick succession sent the word on top of the old grouping — on a slow phone, the link a person would send lost what they had grouped by. The bar merges onto what it last sent, shows that while what comes back is its own echo, and remembers it per bar so a redraw in between does not forget it.
- 95196d7: Two records of one name are told apart wherever a person picks one. `tellApart(nodes, definitionOf)` gives each namesake the first fact that differs — "Blue Hour · single", "Blue Hour · album" — and the pages form's pickers, the strip's ask, the Find strip, the search page (through a node hit's new `apart`) and an arrangement's group headings all say it. A single and its album were two identical rows.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 6e8a02c: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- 3cb6d60: What a review of the villages found. Pressing a plot's tile focuses the district's aggregate rather than the card's own id, and not on the click a pan produces on its way up; going back up before the descent's glide has landed no longer wipes the altitude camera; a host that answers the chat itself (`respond`) hides the ladder in the profile; the signpost rule applies only to cards on a plot, so a nested card's plate stays where it was; the screen's collision guard protects the plate where it stands now (below the card), not where it used to; road and village geometry is computed once per city and translated per frame.
- 5b401bb: What the review of search found. A boolean field is a state, asked for as a condition (`done:false`), not a word: it read as "No", so "n" found every open task in the Find box, a list's `?q=` and the chat — `searchableFields`, `describe` and `llms.txt` no longer list booleans. The picture lights every match from the result's new `matched` list rather than the strip's capped hits. A list's `q` made only of tokens nothing offers (a pasted `https://…`) finds nothing, as the Find box does, and a lone `is:flagged`, `is:clear` or `is:past` narrows in both. `actsOn(store, id, words)` lists a record's acts without a search of the graph; `search()` takes `touched`, and the scene works out what is flagged and touched once per graph change, not per keystroke; a list parses its words once rather than once per row. A lit district's count, Enter on a kind hit and a double-click are one transition — `withJackIn(…, { carry })` — which comes down to the ground, close and narrowed. The row's words (`in.q`) no longer follow you to the next focus, and `withoutSearch` clears the search with the words it carried. A pick in the pages face's Ask drawer goes to the record's page (`onPick` on `ChatPanel` and `Companion`), and the list page reuses the affordances it already has for search-to-create.
- cf193fc: What you can press is what you can see. A view host is the box the layout gave it, and a view that sizes to its content fills only part of that; the invisible remainder was still a hit target, so a record read from altitude and pinned beside a district covered the district's open button with nothing and the button stopped answering. On the DOM path the host and the scaled natural box are now out of hit-testing and only the drawn content is in. The navigation harness hit-tests it.
- 228039c: Where the seat worked is marked on the thing. The robot walked to what it wrote and stood there; the walk went with the figure and the attribution did not. `useSeatWork()` reads the op log — the ops an agent authored, what they wrote, and what an undo took back — and `SeatMarks` draws the seat's glyph on each of those things for a hold: on a card, on a building in a village, on a chip inside somebody's own lens, measured from the picture as drawn, so it is right on both render paths and inside a full-screen lens. The companion lists what the seat did in its own words, each with a "show me" that takes the camera there: from altitude the district the thing lives in, on the ground the thing itself. A question the seat asked stands at the node it is about and says itself, waiting rather than fading, and is listed in the companion with the same way back. Undo takes the marks with it.
- 968e1d1: The installation, in the app people open first. Things declares `declareInstallation({ roles: ["keeper", "member"], admin: "keeper" })` with a policy, two seeded people and a pending invitation, so the platform story is demonstrated where a reader will look for it rather than only in a seedbed chapter. `GraviewProvider` takes `seats` and `onSeat` and holds who is at the keyboard, and the bar draws the new `<Seats>` primitive for them — sitting down re-derives every surface from one principal: the acts offered and the ones withheld with the policy's own sentence, which kinds are drawn at all, whether "Show the installation" is there, what the routed face lists, and the agent's tools. `Places` no longer draws a pill over a kind the seat cannot see, which was a door to a district that was not there.
  
  `ArgShape` gains `{ type: "several", of }` for an argument that takes a list. Without it `z.array(z.enum([...]))` described itself as `unknown`, so "Invite somebody as coordinator and gardener" was unaskable and therefore derived NOWHERE — in every installation the framework ships. An array of something undescribable stays undescribable, so an unaskable act does not start looking askable. The strip's ask answers such an argument by toggling choices and settling separately; the routed face's list control already handled it.
- 59cef8c: Who is where. Other people stand on your map at the plot their stop focuses, in the audience row of the showing they are watching, with their robots beside them captioned as theirs and the thing they point at outlined in their hue — placed by each viewer's own `whereIs` from a presence payload that is never a pixel and never enters the op log. `PresenceChannel` has two implementations in ship: a BroadcastChannel between tabs of one origin, beside the browser adapter, and two routes on the served store folded into the poll the remote store already makes. A per-tab session fills `Author.session` on a tab's ops and its presence key alike. Clicking a figure follows that person until you move yourself or press Escape; sharing is a reader setting in the profile pane; an embed broadcasts nothing unless handed a channel. `openRemote` now carries `applyAll` and `undo` to the wire.
- Updated dependencies [fb781c2]
- Updated dependencies [e8d10b1]
- Updated dependencies [dfba092]
- Updated dependencies [dd65d38]
- Updated dependencies [390028c]
- Updated dependencies [bff0b71]
- Updated dependencies [400a6df]
- Updated dependencies [f4dbcc8]
- Updated dependencies [5d634ca]
- Updated dependencies [c7a3519]
- Updated dependencies [2aae30f]
- Updated dependencies [73690fb]
- Updated dependencies [862fd42]
- Updated dependencies [475cc83]
- Updated dependencies [f11e51b]
- Updated dependencies [09a23a3]
- Updated dependencies [78e568e]
- Updated dependencies [92a2f73]
- Updated dependencies [509162f]
- Updated dependencies [8c14e4c]
- Updated dependencies [3f86b09]
- Updated dependencies [9f6593b]
- Updated dependencies [188bc6e]
- Updated dependencies [1ebfd44]
- Updated dependencies [a23e496]
- Updated dependencies [e0d5026]
- Updated dependencies [fc024d0]
- Updated dependencies [41abe03]
- Updated dependencies [e165c5b]
- Updated dependencies [6a043bf]
- Updated dependencies [406b774]
- Updated dependencies [e119b49]
- Updated dependencies [45c4b9c]
- Updated dependencies [14e22ab]
- Updated dependencies [4aa0f93]
- Updated dependencies [b7f83cc]
- Updated dependencies [1373dfb]
- Updated dependencies [5b5e5a3]
- Updated dependencies [aa90b02]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [ccc912a]
- Updated dependencies [7c0e701]
- Updated dependencies [73e3b86]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [69aed60]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [708871a]
- Updated dependencies [c5e4ac7]
- Updated dependencies [42c2c96]
- Updated dependencies [9a3fe4b]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [8041853]
- Updated dependencies [4c4d52a]
- Updated dependencies [b9b0635]
- Updated dependencies [60efe3b]
- Updated dependencies [5e6d4e7]
- Updated dependencies [03b9c5a]
- Updated dependencies [5297528]
- Updated dependencies [ff7de41]
- Updated dependencies [959955f]
- Updated dependencies [22e0668]
- Updated dependencies [9b3a623]
- Updated dependencies [5a00a1f]
- Updated dependencies [d59b6c8]
- Updated dependencies [887d768]
- Updated dependencies [de75e21]
- Updated dependencies [2c25067]
- Updated dependencies [b3ed5f6]
- Updated dependencies [d36e6fa]
- Updated dependencies [7244498]
- Updated dependencies [b1fbc32]
- Updated dependencies [796bf9e]
- Updated dependencies [d907771]
- Updated dependencies [0bb6827]
- Updated dependencies [b5e95a1]
- Updated dependencies [3f5d3ba]
- Updated dependencies [1e773a5]
- Updated dependencies [7a61e87]
- Updated dependencies [1794980]
- Updated dependencies [171075a]
- Updated dependencies [3e3bfff]
- Updated dependencies [a5d842b]
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
- Updated dependencies [0c0fa22]
- Updated dependencies [c8e9387]
- Updated dependencies [8a2fdf2]
- Updated dependencies [73690fb]
- Updated dependencies [fb6eb5d]
- Updated dependencies [5343a1d]
- Updated dependencies [6dd2cfd]
- Updated dependencies [45c7a2c]
- Updated dependencies [ddf1ea9]
- Updated dependencies [6e0fbb7]
- Updated dependencies [b846b32]
- Updated dependencies [d3e1201]
- Updated dependencies [3376126]
- Updated dependencies [7188978]
- Updated dependencies [e3a7de6]
- Updated dependencies [3af8da7]
- Updated dependencies [5aa8776]
- Updated dependencies [76e50a5]
- Updated dependencies [481340c]
- Updated dependencies [3e719c8]
- Updated dependencies [206670e]
- Updated dependencies [f80138a]
- Updated dependencies [59c1fdb]
- Updated dependencies [71fd426]
- Updated dependencies [2c20c53]
- Updated dependencies [4472467]
- Updated dependencies [8d43e33]
- Updated dependencies [89f4855]
- Updated dependencies [f240a12]
- Updated dependencies [859c128]
- Updated dependencies [53ad439]
- Updated dependencies [e0d5026]
- Updated dependencies [0ea3f62]
- Updated dependencies [b7d3209]
- Updated dependencies [bd1f27b]
- Updated dependencies [90a3344]
- Updated dependencies [6dd2cfd]
- Updated dependencies [6a043bf]
- Updated dependencies [0a3504a]
- Updated dependencies [b7fa5e3]
- Updated dependencies [1d121a7]
- Updated dependencies [61d76a0]
- Updated dependencies [8894627]
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [8dbae9a]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [7be1ad2]
- Updated dependencies [0d1fd39]
- Updated dependencies [60e4bf5]
- Updated dependencies [098c784]
- Updated dependencies [ae188cc]
- Updated dependencies [851feb6]
- Updated dependencies [6dd2cfd]
- Updated dependencies [43cf40d]
- Updated dependencies [315ce3b]
- Updated dependencies [d9bfdb8]
- Updated dependencies [3506c69]
- Updated dependencies [daccd55]
- Updated dependencies [be9fb19]
- Updated dependencies [e7151d4]
- Updated dependencies [ce13ec8]
- Updated dependencies [ccaa5f4]
- Updated dependencies [95196d7]
- Updated dependencies [1636ddc]
- Updated dependencies [55c4151]
- Updated dependencies [5856676]
- Updated dependencies [6e8a02c]
- Updated dependencies [3cb6d60]
- Updated dependencies [cb196b1]
- Updated dependencies [5b401bb]
- Updated dependencies [cf193fc]
- Updated dependencies [228039c]
- Updated dependencies [968e1d1]
- Updated dependencies [59cef8c]
  - @graview/core@0.1.0
  - @graview/layout@0.1.0
  - @graview/react@0.1.0
  - @graview/tools@0.1.0
  - @graview/render@0.1.0

## 0.0.1

### Patch Changes

- ec91236: A field you could set at creation, you can change. Every kind with
  settable fields no declared mutation writes gets a derived, titled edit
  act — `edit-<kind>`, "Change the drill" — registered by the store like
  any other: logged, undoable, judged by the invariants, and by the policy
  through the declared acts that already write or create the kind, so who
  may edit a drill is whoever may already retime or design one, with no
  second list. Opting out is `fixed` on `defineNode` — the field and the
  sentence saying why it never changes. Mutations can declare the fields
  they `write` (as `connects`/`severs` declare edges), and `editableFields`
  believes a declaration over the name-match guess: `finish`/`reopen`
  writing `done` stop being invisible, and a writer that takes no value is
  offered as its acts rather than a text box. `graview check` gains
  `field-without-writer` (a settable field the derived edit cannot reach,
  symmetric with `edge-without-severer`), `writes-unknown-field`,
  `fixed-unknown-field` and `fixed-but-written`; generated agent docs list
  the derived acts alongside the declared ones.
- 587764e: The actions strip's section headings are real list items again: they
  carried `role="presentation"`, which strips the list-item role and makes
  the list invalid to assistive technology — the todo example's new
  accessibility run caught it on a selected node with a broken rule.
- 37bb6af: The constellation says what it means: relations drawn at full strength from
  above the stack (where the lines are the content rather than an aside),
  receding when a kind is selected so its own relations stand out, and a derived
  `RelationKey` naming each edge kind with the exact stroke the scene draws.
- e38fe86: The generic full page is a document rather than a card stranded on a viewport:
  a real header, a centred column, a heading that is the whole thing rather than
  a truncated copy of the body, field names in words, and no value repeated
  because the heading already said it. The name is now the rename control.
- 964d140: The DOM path is a citizen of every browser. The board no longer trusts
  `height: 100%` to transfer through `aspect-ratio` — Firefox and WebKit
  treated it as indefinite inside the panel's flex chain and collapsed the
  pitch to its border pixels, taking every slot's hit target with it; the
  width now comes from the same ResizeObserver measurement that decides when
  the board turns. The local-AI rung fails fast and says why when a browser
  has no WebGPU, and the chat header carries that reason instead of a shrug.
  The graview-new-app skill states the supported-browsers floor.
- 80f859b: Fixes from a code review of the constellation work: a selection is resolved
  onto what is actually drawn before it is compared with a connector's endpoints
  (it blanked the whole Graview otherwise), clicking a kind card up there selects
  it, and the connector stroke treatment has one home so a legend cannot drift
  from the line it claims to show. `GraviewProvider` gains `initialSelection`.
  
  Also: a lens now gets the schema from the provider, so an optional field absent
  on one node is data rather than a binding error — one unplanned task used to
  throw for a whole view.
- 7cebca3: The inspector states a violation once: the message used to appear as an
  observation AND as the repairs' ⚠ heading, under a title that opened the
  same words — now the heading carries it (name-trimmed, since the title is
  right there) and the duplicate observation is dropped wherever the
  heading shows. Pinch is altitude: a trackpad pinch on the canvas rises to
  the Graview and descends from it, one discrete step per gesture, with the
  browser's page zoom kept out of it. The city reads better: an opened
  district is a proper panel (name and count on one line, roster under a
  hairline, the block fading behind), nameplates never wrap mid-word, the
  kind tag wears its kind's hue, the pinned mark hugs the drawn content
  rather than the layout box, and stand-in ties stay on the ground — from
  altitude the constellation already draws the district relations.
- 76792f1: The lines land. Selection ties used to aim centre-to-centre whatever the
  geometry: two drawings stacked in one column got a vertical straight
  THROUGH every row between them (whose 14px hit corridor then stole those
  rows' clicks), a tie between adjacent rows was silently dropped as too
  short, and the single-smallest-element anchor rule tied a 3.2-row dot to
  a 5.2-row label — or to a chip in the activity rail. Routing is now a
  pure, tested decision (`tieRoute`): stacked drawings stitch along their
  common right edge in the gutter, row-mates stitch over the top, and only
  clear air takes the direct arc. Anchors pick the CLOSEST pair among all
  of a node's drawings, chrome (inspector, activity rail, chat panel) is
  declared off-stage and never anchors a line, and a tie whose far end is
  only a stand-in — the kind's district, when nothing draws the node itself
  — recedes to a whisper and takes no pointer instead of crossing the scene
  at full strength five lines at a time.
- 95cceb3: The menu scales. Past the fold a filter-as-you-type field appears in the
  inspector — it narrows the same derived list by label and why, Enter runs a
  sole survivor, Escape clears. `defineMutation` accepts `pinned: true` (the
  app naming its own act), a person can pin any offered action from the menu
  itself (kept per browser beside the intelligence config, outranking the
  app's), and a deterministic recency/frequency boost read off the op log
  ranks what a workspace actually uses ahead of what it never touches —
  decaying so the menu tracks the season. The bands stay inviolate: repairs
  first, destructive last; pins and usage only ever shuffle inside them.
- 094f3cc: `readableFields` is the one answer to "which of a node's fields does a person
  see, and how does each one read" — the record on a page and the summary on a
  card had answered it separately and diverged. And each lens's `View` is a real
  component rather than a method calling hooks behind a lint disable.
- a94d8f5: A mark says what it is about, chrome stops sitting on the scene, a full page
  is a place rather than a picture of one — and a pass over every screen.
  
  **The board.** It drew a slot and the person in it with the same warning tint,
  so a rule about the LEFT MIDFIELD position marked the midfielder standing in
  it — a picture asserting something untrue about a person. The disc now carries
  the slot's trouble and the name carries the occupant's, and a key names each
  mark with the violation message that put it there. Zone names moved out of the
  field into a rail beside it, because inside they were drawn at exactly the
  place a left back stands and read as "DEFENCELB".
  
  **The strip.** It floated over a scene laying itself out into the whole window,
  so selecting anything covered the row of kind cards; it now reports its
  measured height through `bottomInset` and the scene lays out into the space it
  actually has. It showed four actions out of fifteen behind "+11 more"; it now
  fills the row it has. It printed "Pay the deposit · task · \"Pay the deposit\"
  was due 2026-08-28" — the same four words twice in one line — and now trims the
  restatement while keeping the date.
  
  **Navigation.** The home crumb named the place you were standing in, so it was
  a dead control printed an inch above a panel whose own heading said the same
  words; it appears only once you have left home. Apps with a place switcher pass
  no home crumb at all, since the pressed pill already is one. Rising to the
  Graview moved in beside the other place controls instead of sitting at the far
  end of the bar among the buttons that do things.
  
  **The kinds plane.** Six kinds sharing a parent were fanned into six
  seventy-pixel slivers whose labels ran together and whose longest wrapped
  mid-word. At most two nest now; the rest keep their ranking and take their own
  slots. Siblings offset by 14% rather than 45%, so neither hides the other's
  label.
  
  **Legibility.** Connector captions may be wider than the run they caption and
  carry their own ground, so "attends a block, or rides along on a run" is no
  longer cut to "attends a block, or rides alo…" with a hairline through it.
  Coverage row labels and column headers are sized for the words apps actually
  write, and the header band is sized from the labels present rather than from
  the longest anyone might write. Chips, crumbs, editable values, legend rows,
  timeline moments and the dismiss control are all at least 24 pixels.
  
  **And a way to keep it that way.** `scripts/audit-ui.mjs` (`pnpm audit`) drives
  twenty screens across the four apps and measures what a photograph makes you
  squint at: cards drawn on top of each other, captions cut mid-word, controls
  under a fingertip, the same string twice, chrome covering the scene. A
  deliberate tuck states itself in the DOM (`data-graview-nested`) so a checker
  can tell it from a collision.
  
  **The capture path survives a pointer.** This was recorded for months as "a
  click crashes the renderer process", and that was a symptom. Bisected in
  Chromium 154: a plain hover over a captured view kills the process just as
  reliably, a click on the ground beside one does not, and selecting the same node
  from the keyboard does not either. What is fatal is the browser's own hit-test
  descending into a `layoutsubtree` canvas child. The hosts carry
  `pointer-events: none` on that path now, which costs nothing —
  `updateElementGeometry` does not redirect hit-testing in this build, so a DOM
  hit-test on a captured view was already returning where the element was laid out
  rather than where it was drawn, and `PointerRouter` was already supplying the
  right answer. `scripts/verify-capture.mjs` (`pnpm capture`) holds the claim in
  three parts: the pointer survives, a click still reaches the node it drew, and
  the keyboard still reaches the views.
  
  **An agent seat says what it would do, and goes quiet when there is nothing to
  do.** All four apps had the same forty lines of chrome around four different
  scripts, and the same three faults in every one: the button never said how much
  there was to do, it stayed live and silently did nothing once there was none,
  and a refusal from the store arrived as an unhandled rejection in the console.
  
  The coaching example's was worse than that and had never worked. It ran as a roleless
  agent against a policy that grants selection to the coach, so every press threw
  `Not permitted: select-player on a position — coach can`, changed nothing, and
  said so nowhere. A seat is an agent acting FOR the person sitting in it, so it
  now carries that principal's roles — which turns the bug into the demonstration
  the app was built to make: as a coach the button picks the team; switch to
  analyst and it is refused in the same breath the actions strip refuses it.
  
  The chrome moved into `AgentSeat` in the workbench, where the rest of the
  not-about-the-domain chrome already lives. An app supplies a count, the
  mutation it is really asking for, and the turn itself. `scripts/verify-seat.mjs`
  (`pnpm seat`) holds 17 criteria across the four seats: each states its count,
  each turn changes the graph, each goes quiet afterwards, none throws, and one
  policy narrows the seat as well as the strip.
  
  **The kinds plane became a plane of glyphs.** It took a fifth of the window to
  draw cards covering a tenth of it: 190 by 107 each, holding a name, a number,
  two clamped lines of prose and a row of dots. The comments admit where the dots
  came from — the card "was a name, a number and a great deal of empty
  rectangle", so something was invented to fill it. That is backwards. The
  description moved to the tooltip, the dots became a three-pixel proportion bar
  that says the same thing faster, and the band went from 19% of the height to
  11%. The focus got 84 pixels back.
  
  **The scene can be moved.** Pins have been in the model since the first commit
  — `ViewState.pins`, a round trip through the URL, `layout()` letting a pin beat
  the computed position — with no gesture attached to any of it. Dragging a card
  now sets one. Dragging the ground pans, which needed `ViewState.pan` to exist
  at all; it is view state rather than a camera held to one side, so it is in the
  address, it interpolates, and it comes back when someone opens the link. A move
  is an ADJUSTMENT of the stop you are on rather than a new one, so `useUrlSync`
  replaces instead of pushing and one drag is one history entry rather than
  sixty. The trail gains a "moved ×" crumb, and Escape takes it off before it
  takes anything else off. `scripts/verify-moving.mjs` (`pnpm moving`) holds ten
  criteria, including the one that matters most: a drag is not a click.
  
  Pointer capture is taken when the drag STARTS, not when the pointer goes down.
  Taken on pointer-down it redirects the compatibility mouse events too, so every
  click on an inner target was reported against the host instead — double-clicking
  a task opened its card rather than travelling into it, and `verify-navigation`
  went from 14 criteria to 2.
  
  **Selecting something no longer moves the picture.** Insetting the scene only
  while the strip was showing fixed the collision and bought a worse fault: every
  click reflowed the whole scene, so the thing you clicked slid out from under
  the pointer as its actions appeared. The room is reserved permanently and the
  strip appears inside it. A one- or two-row strip — nearly every selection —
  moves nothing at all; an unusually tall one still pushes rather than covers,
  because being tall is rare and being covered is never right.
  
  **A brand has a third axis, and the apps use all of them.** Palette and
  wordmark were not enough: with `brandFromAccent` deriving everything from one
  hex over a shared base, four apps looked like the same application four times
  in different colours. `Brand.shape` adds a corner radius and a density
  multiplier, emitted as `--graview-radius`, `--graview-pad` and `--graview-gap`,
  so a bid desk can be square and tight and a household planner round and roomy
  without a component knowing whose product it is. The display face now reaches a
  panel's title, which is the largest text on most screens — it had been reaching
  the wordmark and nothing else, because the stylesheet gives it to `h1`–`h4` and
  a panel title is a `strong`.
  
  Each app now declares a real typeface: Figtree for the checklist, Fraunces over
  a rounded sans for the household, a Plex face for the bid desk, a narrow grotesque for the club.
  Three of them had declared `ui-sans-serif` and `ui-serif`, which resolve to the
  same faces everywhere and so were no declaration at all.
  
  `verify-brand.mjs` asserted the literal string "Inter" — a test that passes for
  exactly one brand and fails the moment anyone rebrands, which is the opposite
  of the claim it exists to check. It asks the declaration now: whatever the
  brand put first in its stack is what the page must render in, the face must
  actually have loaded rather than fallen through the stack, the display face
  must reach the headings, and the shape must reach the pixels. Nine criteria,
  up from six.
  
  **Two bugs found by the survey while doing it.** A kind card's title and count
  had ended up inside the proportion bar's conditional, so a kind with no members
  rendered an empty card. And every shrink on the kinds plane is proportional —
  secondary at 0.74, tucked at 0.8 of that, tucked again by how many share a
  parent — so at a glyph-sized band the multiplications landed under the content
  and the cards clipped by four or five pixels. Proportion is right until it
  crosses the floor; there is a floor now.
- 87948ef: Code-review fixes. `edge-without-severer` is suppressed only when EVERY
  kind declaring the edge name says appendOnly — one kind's suppression no
  longer hides another's makeable-but-never-unmakeable relation. The usage
  boost stops counting acts the person took back: an op undone by a later op
  carries no weight (the old undo guard was dead code — undo ops have no
  mutation — while the retracted originals kept theirs). The action filter's
  Enter never runs a destructive sole survivor and shows it no ↵ promise;
  an empty-query Escape blurs the field so the product-wide back-out works
  on the next press. And the person's pins now reach the agent seats: a
  tool runtime's `derive` option can be a function, read fresh per call, so
  the strip, the pointer menu, the chat and the agent seat never disagree
  about the same acts.
- ba85148: A kind card earns its space: a tally of one mark per member, lit where
  something is wrong, which answers "how much of this is in trouble" — the
  question a count never could. A kind with nothing in it says "none yet" rather
  than showing a zero and a void.
- 0f9b0fd: Pins override in both directions, and the stars say whose they are. A
  person can now UNPIN an act the app's declaration pinned — the same star
  gesture demotes it for that browser and restores it — where before the
  star on a declared pin was a control that visibly did nothing. The
  person's pin draws in the accent, the app's in quiet body ink. And when
  the searcher is down to a sole survivor, the row says ↵ — the promise
  Enter makes, shown exactly when it holds.
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
- 4a5d8b0: The altitude control is the toggle it always was, and now presents as one:
  "Graview" from the ground (the place it takes you), "Focus" from altitude
  (the way back down), with aria-pressed and the accessible name agreeing
  with the word. Its mark morphs inline between the two — three kinds on
  their ring gathering into one node in one ring — riding its own copy of
  the registered altitude property on the scene's own 640ms curve, so the
  control and the picture change together; where an engine cannot register
  the property, both cut, verified rather than assumed.
- 34c1600: A product on Graview can be started rather than assembled. `graview create
  <dir>` — and its conventional door, `npm create graview` — writes the project
  the `graview-new-app` skill describes: one declared kind with `creates`,
  `connects`, `writes` and a horizon, one rule that names its repair, an
  eighty-line shell of framework parts, the routed face, persistence in the
  browser, a headless test and a CI workflow; then installs it, installs the
  authoring skills into it, and says what to do next. `--link <path>` makes
  the same project consume the framework from a sibling checkout by path, the
  way the first-party products do, with the one thing that shape needs and
  nothing said about: tsc pointed at a single copy of zod. The generator is
  `@graview/core/scaffold`, a pure function from a name and a first kind to a
  list of files, for a host that provisions apps in-process. The skill now
  begins with the scaffolder. `scripts/smoke-create.mjs` keeps all of it
  honest on every push: scaffold from the packed tarballs, install with no
  workspace, run the project's own `verify`, open it in a real browser, then
  the same by path.
  
  The rehearsal also caught two primitives mixing a `border` shorthand with a
  `borderColor` that came and went across renders — the Standing button and
  the affordance strip — which React reports on every rerender; both now set
  the longhand, and the browser console of a scaffolded app is empty.
  
  A premortem of the first hour closed the gaps between "the harness passes"
  and "a person succeeds": the root `pnpm build` now builds every package a
  linked project resolves types from (pages and ship were missing, so a fresh
  clone could not scaffold); `graview create` refuses a framework that is not
  built and says how to build it, warns when the project would land inside the
  framework's own tree, initialises a repository, and in link mode writes a CI
  workflow that checks the framework out beside the app and builds it first;
  a project declares Node 22, tells pnpm 10 about esbuild's postinstall, and
  runs `check` and `docs` cold; and the README leads with the path that works
  today rather than the one that works once the packages are published.
  
  And the shell is a primitive. `Shell` in `@graview/primitives` is the command
  bar, the scene, the inspector and the rail — with the landmarks assistive
  technology expects, once — so an app supplies a home, a sentence for when
  nothing is wrong, and a seat. The scaffold, the todo example and the empty
  example all use it now instead of carrying eighty drifting lines each.
- b156490: The garden is grown a chapter at a time, and photographed. The empty
  example carries seven chapters — one kind; a second kind and an edge; a
  rule as data with its repair; plantings and the horizon; a seat for an
  agent; the garden remembering; who may do what — each a real declaration
  with the seed it has earned and the stop worth a picture. `?chapter=N`
  opens any of them, `scripts/progression.mjs` renders every one in both
  schemes and records what it saw, and the docs and marketing page teach
  from those pictures rather than from prose that can drift.
  
  Taking the pictures found three things. From altitude with nothing
  focused, the Focus control did nothing in every app that opens from the
  city; it now descends into the selected district, or the first one
  declared. The altitude ring ran under the inspector's pane, so a district
  could be drawn where nobody could reach it; layout takes an `inset` and
  the scene reserves the left rail. And the empty example's custom plot view
  at full fidelity showed a large blank card where the generic view shows
  the fields and the caretaker; it now overrides only the summary.
- 595107c: The seat never says "Done" over a change the store refused. The chat's
  apply read only thrown errors, but the tool runtime RESOLVES refusals —
  so a policy denial posted "Done — … Undo works." while the graph stayed
  untouched. The result flag is read now and a refusal lands as "Refused:
  …" in the thread. The activity rail also stops dressing every agent as
  "claude": a turn is attributed to its author's own id — the chat seat as
  "chat", a sync as its system name — and only a human is "you".
- 77d1d4a: Permissions, brands and a publishable shape.
  
  - A `Principal` is an `Author` with roles, and a `Policy` of grants is enforced
    at the store — including on undo, which was a complete bypass.
  - A `Brand` declares name, logo, typography and both schemes, and
    `graview check` measures every text pair against WCAG AA.
  - `@graview/render` splits its WebGPU surface behind `@graview/render/gpu`, so
    the main entry no longer requires consumers to install `@webgpu/types`.
- 04eaefe: A declaration can now say how its fields read — hide an ordering key, label a
  field, format a stored value — and an edge can carry an `inverse` so it reads
  correctly from both ends. Booleans render as words. Chips ellipsise (the
  `text-overflow` never applied, being on a flex container). And `Backtrack`
  makes the browser's own back and forward visible, because an interface whose
  navigation is the browser's should not require knowing that.
- Updated dependencies [ec91236]
- Updated dependencies [37bb6af]
- Updated dependencies [e38fe86]
- Updated dependencies [964d140]
- Updated dependencies [80f859b]
- Updated dependencies [7cebca3]
- Updated dependencies [76792f1]
- Updated dependencies [5cd68d6]
- Updated dependencies [95cceb3]
- Updated dependencies [094f3cc]
- Updated dependencies [090ab39]
- Updated dependencies [23ab0fe]
- Updated dependencies [a94d8f5]
- Updated dependencies [87948ef]
- Updated dependencies [0f9b0fd]
- Updated dependencies [4bd846b]
- Updated dependencies [cfdad5a]
- Updated dependencies [34c1600]
- Updated dependencies [b156490]
- Updated dependencies [329da2e]
- Updated dependencies [77d1d4a]
- Updated dependencies [04eaefe]
- Updated dependencies [f24ef6e]
  - @graview/core@0.0.1
  - @graview/tools@0.0.1
  - @graview/layout@0.0.1
  - @graview/react@0.0.1
  - @graview/render@0.0.1
