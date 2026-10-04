# @graview/react

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/layout@0.1.7
  - @graview/render@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/layout@0.1.6
  - @graview/render@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
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
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5
  - @graview/render@0.1.5

## 0.1.4

### Patch Changes

- 0183340: A tool's schema does not depend on zod's minor version. An agent tool's input schema is a stability surface, and zod writes its own regex for a string format — `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.iso.date()` — beside the format's name. That regex differs between zod 4.4.3, which this repository locked, and 4.6.5, which a consumer resolves from the published ranges, so Cloud's tool-schema snapshot saw sixteen "inputSchema changed" entries that were only zod's regex. `toJsonSchema`, and with it `mutationToolSchema`, `nodeJsonSchema`, `schemaJson` and the conformance kit's tools, now says a format string by its JSON-schema `format` alone (`email`, `uri`, `uuid`, `date-time`, `date` …) and drops zod's `pattern`; a pattern the author wrote with `.regex(…)` is kept, beside the format where there is one. Moving the workspace to zod 4.6.5 found a second dependence on zod's internals: zod 4.6 no longer fills a schema's `_zod.bag` as it builds it, so `describeArg` lost a number's bounds and a date's pattern, and a date argument was asked for as free text. It now reads the checks on the definition, which both versions keep. Every package's zod range is now `^4.6.5`, so the tests run on what a consumer gets.
  
  Compatibility: tool input schemas — a format-based string no longer carries zod's regex `pattern`, only its `format` (an `email` property is `{ "type": "string", "format": "email" }`); a `z.url()` property is unchanged, and an author-written pattern is kept. A snapshot of a tool surface taken with either zod version changes once, for those properties only, and then holds across zod minors. The conformance kit's recorded fixtures are unchanged: none declares a format string, and the lock holds. `describeArg` and `argShape` answer as they did on zod 4.4 for every schema, now on 4.6 too. Every package's `zod` dependency moves from `^4.4.3` to `^4.6.5` (products never install zod; `@graview/core` re-exports it). The embed's bundle budgets rise with zod 4.6, which gives every schema type its own JSON-schema processor: the pages face alone from 815,000 / 220,000 to 950,000 / 252,000 bytes and every face from 1,150,000 / 330,000 to 1,290,000 / 362,000 (minified / gzipped), about 130 kB / 30 kB of zod's that a host on zod 4.6 was already paying. The document format, ops, stored formats, the wire and check codes are unchanged.
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

## 0.1.3

### Patch Changes

- 50beae9: Presence a host can add to. Who is here held only sockets and pollers, so an agent acting for Ada over MCP or an RPC never appeared in the room while it worked, and a presence said only where somebody stood and what to call them. A `Presence` now carries its `kind`, and for an agent `onBehalfOf` (the person's id) and `onBehalfOfName`; `presenceName(presence)` says it as "Claude, for Ada", and the Shell's figures are named that way. `presenceFrom(told, seat, now?, participant?)` builds all of it from the seat: a claimed `kind`, `onBehalfOf` or `until` is dropped, the seat's name stands over a claimed one, and a socket's `here` is held under the key the server gave it, whatever key it claims. That key is built at `hello` and said back as `welcome.participant`, `POST /graview/here` answers with the poller's own, and `openRemote(...).participant()` hands it on, so a client leaves itself out of who is here. Somebody without a socket is announced: `handler.announce(presence, ttlMs?)` tells every socket and poll at once, and `visitorPresence(author, { session?, stop?, over? })` builds the presence from a seat the host trusts. The handler announces an agent itself for every op an agent seat lands in its store — through `POST /graview/ops`, an MCP handler over the same store, or the host's own loop — standing over what it wrote, for `VISITOR_PRESENCE_TTL_MS` (30 s); `announceAgents: false` turns that off and a number sets the time. An announced presence carries `until`, and stands until then without a heartbeat, in the server's map and in every client's fold (`presenceStands`). A hibernating host keeps who is here itself with `announcePresence(who, presence, ttlMs?, now?)`, which stamps the visitor, replaces the same participant and drops whoever has passed; `tell` and every route never tell of a visitor past its `until`. Each seat is told as it may see: an agent acting for a person the seat may not see is shown, without `onBehalfOf` or the name. `POST /graview/leave` now forgets only the asking seat's own key (FR-47).
  
  Compatibility: wire surface additive — `welcome.participant`, `participant` in the answer to `POST /graview/here`, and `kind`, `onBehalfOf`, `onBehalfOfName` and `until` on a presence; a client that ignores them is served as before. A socket's presence key is now minted by the server at hello, so the session after `kind:id:` is no longer the one the client put in its own key; a client that matched its own key against who is here reads `welcome.participant` instead. `POST /graview/leave` naming another seat's key now does nothing. New exports: `presenceName`, `presenceStands` and `VISITOR_PRESENCE_TTL_MS` from `@graview/core`; `announcePresence` and `visitorPresence` from `@graview/ship` and `@graview/ship/runtime`; `StoreHandler` and `ServedStore` gain `announce`, `RemoteStore` gains `participant()`, and the handler options gain `announceAgents` (additive). Stored formats and op shapes are unchanged, and `@graview/ship/runtime` still reaches no `node:` builtin.
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
  - @graview/layout@0.1.3
  - @graview/render@0.1.3
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- a634594: An embed reports what went wrong and how long it took, without what was on screen. `mount` and `@graview/embed/pages` take `onError(error, { module, face })` and `onReady({ ms, face })`. Each face, the strip and the studio's place on it draw behind a boundary: what throws says it could not draw and offers to try again, and the rest of the embed keeps working, so a page that throws leaves the strip and the scene a press away. The host is told the error's class (`EmbedError`) and the framework module that caught it, never the message, which may quote a record. A view's own boundary in the scene reports the same way: `ViewBoundary` tells the `ErrorReportContext` above it, which `@graview/react` exports. `onReady` is told once, after the first render, how many milliseconds it took (FR-24).
  
  Compatibility: additive — `onError`, `onReady`, `EmbedError`, `EmbedErrorWhere`, `EmbedReady`, `ErrorReport` and `ErrorReportContext` are new, and a view that throws with no report above it is said on the console as before. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- 2493564: The store a host drives. An op made without a `now` option is stamped with the current time, not the epoch. `applyAll` and `undo` given an `intent` keep each op's own sentence, from its act's `describe()` or "Undo: …", and record the intent beside it as `batchIntent`, which is what the batch reads as; an act with no `describe` takes the caller's words as its sentence, as before. `store.previewAll(calls)` previews several calls as one gesture, each compiled on the graph the one before it left, without writing anything. `store.append(ops)` lands ops a host built itself (example content, a seeded beginning, a repair) as ordinary, undoable history, filling in the seq, id, batch, time, inverse and writes it was not given, all or nothing. A blocked undo throws `UndoBlockedError`, a `GraphError` carrying the `UndoCheck` it was refused on and the ops in the way as `blockedBy`. Reopening on a snapshot never folds the log, so a log naming a kind the new declaration dropped opens as history (FR-18).
  
  Compatibility: additive for the stable contract — `Operation.batchIntent` is a new optional field, and an op without it reads as before. `Store.previewAll`, `Store.append`, `AppendOp`, `UndoBlockedError` and `UndoRefused` are new. Changed in meaning for callers of `Store`: the default clock is the current time, and `ApplyOptions.intent` no longer replaces an op's `describe()` sentence (read `batchIntent`, or `Batch.intent`, for the gesture's words). Stored formats, the wire and derived tools are unchanged.
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
  - @graview/layout@0.1.2

## 0.1.1

### Patch Changes

- bf36bbe: The tag on a focused card says the kind's noun — "car", "test drive" — not its id ("vehicle", "test-drive").
- 097d684: A count of one says the kind's noun: "1 car", "1 test drive", where a place card, Find, a district's name, a band of a district and a coverage's gaps said "1 vehicle" and "1 test-drive". One function says it now (`counted`).
- d76a957: A policy says who may see what, as well as who may do it. `Policy.sees` keeps a kind to the roles a sight names — with `own`, to the principal's own record and what an edge joins to it — and a kind no sight names stays everybody's. `store.seenBy(principal)` is the store as that principal may see it: its graph, log, history and problems hold only what they may see, and every act still goes to the store itself; with no `sees` it is the store, unchanged. The scene's provider and the routed face hand every surface that view, a kind a seat sees none of and may not begin is kept from it like an administered module, and the way in leaves it out. `graview check` refuses a sight naming an undeclared kind (`sight-unknown-kind`). A watching harness is told what the seat may not see (`tellTheWatchWhatIsUnseen`, `useTheWatchKnowsWhatIsUnseen`).
- b535cb2: An author nothing names is said by what it is — "the upgrade" for a migration, "the system", "an agent" — never by a namespaced id: the activity rail headed an upgrade "ship:migration". A watching harness is told every author id in the log that names no record.
- 6966a4e: A watching harness is told what each surface's seat may not see separately, and holds a page only to what none of them may see: two embeds on one page can sit two different seats down.
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

- fb781c2: A calendar lens: month, week, day and agenda over real dates. `createCalendarLens` binds a kind's own fields to roles — a start date or date-time, an optional end, an all-day flag, a label, a done flag — the way every other starter does, and `graview check` reads the binding like the others'. Multi-day spans are drawn on every day they cover and say which piece they are; a busy month cell says "+N more" and opens that day; all-day entries sort before timed ones; done reads as done. All date arithmetic is on `YYYY-MM-DD` strings in UTC, so an entry does not land on the 13th for half the world, and `addMonths("2026-01-31", 1)` is February.
  
  Two framework capabilities the calendar forced. `ViewState.within` is where a view says where it is INSIDE itself — `in.at=2026-10-01&in.range=month` — carried in the fragment, never read by the framework, and counted as travelling rather than as an adjustment, so Back returns to the month you left. And a kind may now have SEVERAL pictures: `places()` lists every titled group view, each with an `as` slug the stop names (`in.view=the-month`), and `resolve(kind, cell, as)` picks one. Before this, registering a second titled view simply replaced the first and made it unreachable.
  
  Dragging an entry to another day is an act: `actThatMoves` asks the declaration (through the framework's own `fieldWriters`, the function the checker uses) which act writes the bound date, the store judges it, and one undo puts it back — a seat that may not is told so in the policy's own words rather than watching the entry snap back. A date-time keeps its time.
  
  Also: a control inside a view no longer selects the card it is drawn on — pressing the calendar's "next" used to select every task in the district behind it.
  
  Things shows a month over tasks by due date beside the week and the lists, all three now the framework's own named places rather than a switcher of its own. Seedbed gains a season over plantings, which means a planting now records the day it was harvested and is a span rather than a dot.
- e8d10b1: A card does not swallow a field's key. Making the view host answer Enter and Space meant it called `preventDefault()` before asking whose key it was — and the in-place title editor is a one-field form inside a card, which the browser submits on Enter by default. Renaming a record stopped committing: the field stayed open and nothing was written. A key from inside a real control is left alone now; the card's own marks are unaffected.
- dfba092: A card is named what it says it is. Every view host is a `role="group"`, and a record's `aria-label` was its node id — so a scene showing "Buy milk" read "item:buy-milk" to anybody not looking at it. The name now comes from the declaration's own `label(node)`, the same string the heading, the chip and the crumb use; an id with no node behind it keeps the address.
- dd65d38: A card's acts are one key away. On a phone the seat is a folded sheet, and from the keyboard its toggle was a walk of a dozen Tabs past every other card — making a location in the rota took 22 presses where a pointer took 8. A card with the keyboard on it now answers A the way it answers a right-click: what it draws is chosen, the seat opens on its acts and the keyboard lands on the first; put away from the keyboard, the keyboard goes back to the card. The card names the key (`aria-keyshortcuts`) and the seat's header says it on screen while the keyboard stands on a card. The scene learns the key from the seat (`actsDoor` on the context), so a scene with no seat claims none.
- f4dbcc8: A district chosen from the "+N more" menu takes the keyboard. Choosing closed the menu and often took its card away, and the keyboard fell to `<body>` until the fallback found it — later on a slow phone than a person waits before pressing Tab. The menu's button holds it while the district is drawn, and the district has it once it is.
- 5d634ca: Clicking a name in an opened district changes the picture, and a relation drawing seven lines draws them quietly.
  
  **A chosen member is not its whole district.** At altitude a selection is resolved to the card that stands for it — right for asking which CARDS a line touches, wrong for asking which LINE. With the volunteers opened, all seven `covered-by` strands end at the volunteers card, so choosing Ada lit Bo's shifts, and Cass's, and Dev's: the scene said exactly the same thing before and after the click, which is the one thing clicking a name is for. A strand knows the real edges it stands for; when the selection names something those edges mention, that finer answer wins, and when it names none of them — a district chosen as a district — the card rule stands. The rule is `altitudeOpacity`, pulled out of the render so it can be read and tested.
  
  **A relation drawing many lines at once draws each of them quieter.** A bundle is unpicked so each line can start at the thing it is about: the week draws every shift as its own span, and a line leaving the span says *which* shifts are covered, which is worth having. But seven of them arriving at one closed district, each at the weight of a single fact, is a starburst across the whole picture. They now fade with the crowd — never below a third — and choosing one still brings it fully forward.
  
  **A district offers only what it can do.** The layout refuses to open the district of the kind in focus: its members are already the picture above, at size, and drawing the same ten names twice is what the ring exists to avoid. The card offered it anyway — pressing "open" on Shifts while looking at the week wrote `expand=kind:shift` into the stop, the next frame threw it away, the card still read "open ▾", and nothing moved. It says "shown above" now. The same held for the district the layout opens in place, which offered a "close" that could not close.
- 2aae30f: A crowded band is laid out by relation. Past what fits as chips, a band row is as tall as a group card's two lines, the gutter between rows holds a caption, and each relation starts its own row unless all of it fits the rest of the current one — so a caption never sits on the cards of the row above, and a group card is never cut to its name. `packRuns` and `bandCaps` (exported) plan the rows in arithmetic, and each relation is drawn within what the rows give it. A band card says its name and which way it opens on one line, and its count and first members on the next, "1 song" rather than "1 songs"; a record standing in a crowded band is drawn as a chip (`compact` on the layout node) rather than a summary cut to a sliver; a chip is never wider than what holds it. A grouping in which one group holds three quarters of the members is not offered. The month cells of a calendar are as tall as what is in them, so a month with three releases no longer spills over the month below, and a coverage matrix draws at most 40 rows by 24 columns.
- 73690fb: A district is a village. From altitude its members stand as small iso buildings on the plot, back to front on the plot's own sub-lattice, each with a height of its own, the square in the middle kept for the nameplate and the kind's landmark; past the plot's cap the rest are a number on the kerb. A flagged member's roof is the warning colour and a selected member's building is lit. The anonymous iso block that stood for every kind without a drawing is retired: the population is the size of the cluster now.
- 862fd42: A district stays a district whatever picture the address names — and the studio stops minting ids in the layout's namespace.
  
  Three things, all found by opening Rota's installation and its studio and looking at what was actually drawn.
  
  **A place is a picture OF a group, not of every group.** The scene handed `in.view=<slug>` to every group it drew, so pressing "Who may do what" and then looking at something else left the slug in the stop, where the PEOPLE district — which is not what you are looking at — drew the policy lens instead of itself: no name, no count, no figure, no way in, just the words "Who may do what · 3 roles" floating where a district used to be. The same thing turned the Shifts card into "The week · 10". The slug now reaches only the group the address focuses, which is what the code's own comment always said it did.
  
  **A lens's glyph is a mark, not a caption.** `ReachView` returned a bare `<span>` at glyph fidelity where every other lens returns a `Chip`.
  
  **`kind:` belongs to the layout.** It is where a district card's id comes from, and the studio minted `kind:rule` for an app's own kind called "rule" — the same string as the RULES district's card. Every app in this repository declares a kind called "rule", so in every one of their studios the edge from a rule to the kind it judges resolved to the district it started from and was drawn as a loop: a dotted circle labelled OVER, saying a rule judges a rule. The studio's kind nodes are `declared:<name>` now, and a test holds the namespace.
  
  Also: the studio's agent can name a new role or kind. "add a new Role for Participant" was not recognised by the graph-native floor — it only matched an act whose title appeared verbatim — so the turn fell through to whatever model was configured, which proposed `add-role` with no label and got a validation refusal. The floor now takes a name from quotes, from "called"/"named"/"for", or from in front of the word itself, asks for one when there is none rather than proposing an act that cannot apply, and says so when the name is already taken.
- f11e51b: A district moved by hand is smooth. The district under the hand is placed in the scene, at most once a frame, and written into the view once, when it is let go — so nothing that reads the view (every lens in the city) redraws on every pointer move. A picture compares by what it holds, not by identity, so a re-layout that rebuilds a node's nested data with the same contents redraws nothing. The ground is drawn at the origin and moved by one translate, each plot a memoised tile whose village is kept while its plot and members are the same. The lines are measured once per frame, after commit; the size observers are re-attached only when the views change; and one measuring pass asks the DOM for each panel's clip and each member's boxes once. On rota at altitude under the harness's 4x throttle, a card drag went from 8 s of blocked main thread to none.
- 78e568e: A docked robot with no place of its own is not drawn in the stack: parked on whichever district was first on the shelf, it moved every time the shelf did and read as a robot tagging along unasked. It appears when it has something to do, stands where it works, rests out of the picture, and keeps its pad from altitude. And the camera at altitude moves only as far as a focused screen needs to clear the edge, rather than centring on it and dragging the rest of the city off the far side.
- e0d5026: A kit for the picture. Everything the scene draws that is not a view — the lines, their captions, the ground's grid and lattice, the kind tags, how far the unlit recedes, the mark a broken rule leaves — is declared on `brand.kit`, any part of it, the rest as shipped. A connector's route is a named strategy (`curve`, `straight`, `orthogonal`) and its stroke a named pattern; each is one case in one file, so the next is one more case and nothing in the scene moves. Colour and visibility are per edge kind under `connectors.byEdge` or for all under `connectors.all`; a kind kept quiet is not drawn and stays selectable from the inspector. `themeCss` emits the kit as `--graview-kit-*` custom properties that the ground and the tags read. `graview check` holds an explicit line colour to 3:1 against both grounds in both schemes (`kit-contrast-below-aa`, `kit-colour-unreadable`). An embed's handle gains `setBrand`, so a page can re-dress a running Graview.
- fc024d0: A lens chooses its shape by the room it has, and a narrow embed keeps its room for the picture.
  
  The coverage matrix's 316px label column put every column past the edge of a phone-width card, behind a sideways scroll nothing announced — names and no cells. The names now take a share of the width, and where the columns still would not fit at a fingertip each the matrix stacks: each row is its name and then its cells as labelled marks that wrap. Seven day columns in a 300px box were 40px cells with three letters in them; below about 44px a column a run of days is drawn as the agenda, and coarser cells wrap into as many columns as the width holds. The calendar's six range chips become one select when the card is narrow.
  
  The scene kept a fifth of a 360px embed clear for rails it does not draw there, and the layout took six gaps more off a focused card: a lens got 145 pixels. Below a phone's width the rails are gone and the focus margin is capped at a tenth of the span. The embed's strip, whose place and seat pills wrapped to five rows, shows the places and the seats as one select each when it is narrow.
  
  And the example's season and rotation calendars, declared on the chapters and never handed to the views, are drawn on the pages that explain them.
- 41abe03: A lens is a drive-in: the picture stands at its kind's plot, and descending is walking up to the screen. From altitude the focused group's named picture no longer floats in the middle bound to no kind — it is a SCREEN standing on that kind's plot, anchored to the plot's far edge and centred on it, sized by the plot's side with a floor for legibility, drawn with the same natural size and shrink as before (the interface scaled, never re-laid-out small), and shrunk only as a last resort until it stands on no other district's nameplate. A picture over two kinds (`ViewMeta.across`, carried on the `Place`) stands on the road between their plots. `LayoutNode.screenOf` names the kind and survives the tween; `LayoutOptions.screens` is the registry's named places by kind. With the screen on its own plot the city no longer slides aside for a picture in the middle.
  
  Every kind with a named place has a drive-in on its district card from altitude: a dark screen and a marquee of real, keyboard-reachable buttons labelled "<plural>: <title>". Pressing a showing focuses the kind with it and descends in one gesture — the lens is already drawn at the plot, so the descent tweens from the screen to plane 0 and reads as walking up to it. On the focused drive-in, pressing another showing switches the picture without descending (`in.view` changes, the stop stays at altitude and round-trips through the address); pressing the showing that is showing walks up to it. "Focus" from altitude descends into the focused drive-in, else the selected kind's, else the first kind that has one. Focusing a drive-in off the edge of a large city re-centres the pan on its plot. `useWhereIs("screen:<kind>")` answers with the audience strip in front of the screen, where figures will stand. The road's hit corridor now keeps off card faces by its own half-width, so a press on a district's corner is the district's. The navigation harness drives all of it, including a mid-tween capture that asserts the lens moved from the plot rather than from the centre.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- e119b49: A tie points at where a thing is, not at where it was. The lines from a selection to its relations, and the captions over a raised row, were measured from the DOM during render — the render that draws a frame runs before that frame's DOM exists, so every one was measured against the frame before, and after the last frame of a navigation nothing rendered again: dashes started in the air at the edge of a card that had moved. Both are measured in a layout effect now, after the boxes are where the frame put them and before paint, and the ties measure again whenever a scroll or a resize moves something. Every anchor is cut down to what a person can see of it — a chip scrolled off the end of its roster, a row under a panel's fold, anchors nothing.
  
  And a mark is not the thing. The fundamental mistake under every stray line was treating everything that wears an id as a place the thing is: a coverage cell wears its column's id so a press means the column, but it stands at the crossing of a row and a column — it is the edge — and a selected revenue stream fanned five dashed lines up into the cells of somebody else's ownership matrix. A lens says which of its drawings are marks (`data-graview-mark`), a tie never lands on one, and a thing drawn only as marks falls through to the district that holds it.
- 923bbfa: A profile on the bar. `<Profile>` is the one place that answers "who am I signed in as" and holds what belongs to the reader rather than to the installation: their own record (where an installation is declared), the seat switcher, the settings, and the scheme. Settings are declared — `app.settings`, drawn by the pane, honoured by the provider, and checked: `graview check` refuses a setting nothing can apply, one with nothing to choose between, one that opens on an answer it does not offer, two that share a name, and a root font size that is not a length. `readerSettings()` is the two every app should offer (text size and motion); `applySettings` carries them at the edge so an app's two faces agree.
  
  Two bugs surfaced underneath. The theme set `font: 0.875rem` on `html, body` — so the ROOT's own size became 0.875 of the browser's, every `rem` in the framework resolved against 14px instead of 16, and the one place a text-size setting can live was already occupied. The body is sized now; the root is left exactly as the reader has it, and "As your browser has it" stamps nothing rather than guessing. And `usePickTargets` stamped `role="button"` on every pick target including landmark elements, which ARIA forbids — three `<header role="button">` on the first screen of the demo, unnoticed because nothing had run axe over the scene. The role is now stamped only where it is legal; a target that cannot take it still gets `tabindex`. Motion is overridable by the reader: the stylesheet's reduced-motion rules are emitted once for the system's preference and once for `data-graview-motion="reduce"`, scoped so an embed honours a host's answer without restyling the host.
- 69aed60: A relation over the neighbourhood is captioned once. Captions were runs of consecutive nodes in a frame sorted by id, so an artist featured on some songs and producing others got "the songs they are featured on" twice, keyed alike — and the duplicate keys left the old stop's captions on top of the next picture after travelling. Captions now group by relation and end whatever the order, sit over the first row the relation occupies, share gutters with their neighbours rather than overlapping them, and stay out from under the rails (`railInset` moves to its own module).
- 708871a: A right-angled line comes down into a card below it rather than along the row the card sits in. The orthogonal route always left and arrived horizontally, so a line from the focus to a chip in a band ended in a horizontal run at the chip's own height, through the gap beside it, and two neighbouring chips read as joined by a dashed line. Where the ends are further apart vertically than across, the route now leaves and arrives vertically and crosses in the gutter halfway between.
- c5e4ac7: A robot you can catch, and a robot worth looking at. A following robot holds still when a hand comes for it, so it can be pressed to let go. The figure is redrawn: a dome head with a visor and eyes, an antenna that lights while it follows, the city's own iso block for a body, an arm that comes up with a pen while it writes. The drive-in from altitude loses its grey stand-in screen; the marquee band is sized from its showings wrapped to the card, and the building under it sizes from the room that is left, so showings no longer stand on a roof.
- 4c4d52a: A drive-in's thumbnail is a picture of its lens, not the lens. It hands the lens its 12 most relevant members (the flagged, then the most connected) with `budget` and `total` — new on `ViewProps` — and is mounted the first time it is on screen with the scene still, one thumbnail a frame; `useSceneStill` and the scene's motion store say when. A lens with a budget draws no arrangement row, the coverage holds its rows and columns to it, and the board, timeline and calendar say "+N more" in the kind's words (`withMore`, exported). The row's "only…" menu offers at most the 40 most connected far ends — a release's menu listed every song. Over Tech N9ne's catalogue the city at altitude went from 21,335 elements to about 1,200, and rising from 21,495 to 2,493 with every thumbnail drawn. The graview-lens skill says what a lens does with a budget.
- d59b6c8: An opened district lists what it has room for, in names you can read. The layout reserved 96 pixels under an opened district and the view listed sixteen members in 250, two columns of ninety-five pixels, under a header whose name column could shrink to nothing: a dealership's Vehicles, opened at the foot of an eight-district city, read "VEHICL291ES" over sixteen chips of "2026 Ma…" running off the scene. The layout now reserves rows (`rosterRows`, `rosterHeight`, `ROSTER_ROW` exported), tells the view how many the city kept room for (`openedRows`, carried through the tween), and the view lists that many in as many columns as the names can be read in (`rosterOf`), with the rest counted. The header wraps its count under the name.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- d36e6fa: A kind with a picture of its own is where "deeper" goes. From altitude, going deeper into a district exploded it into a ring of chips whether or not the app had registered a lens over that kind — trading a designed picture for the fallback it exists to improve on, while the card's own ◆ said the picture was there. A group with its own view now travels into it and leaves its district shut; a group without one opens in place exactly as before.
- 7244498: Going deeper into a group card goes into the group. Double-clicking a shelf card or a district once focused the card's own id, which no layout resolves, so the scene emptied with the card's name in the URL. `withJackIn` in @graview/layout is the one reading of the gesture: a record zooms (and zooms back out), a kind card on the ground zooms into its group as a place, and a district at altitude opens in place and closes again. The scene's double-click and `useJackIn().enter` both go through it.
- 796bf9e: Every picture paints at a real size. A panel's "there is more" fade is painted in the panel's own ground rather than masked: a mask made the scroller an offscreen layer, and one painted before its rows arrived stayed black. A thumbnail waiting to be drawn is as tall as a picture, so one drawn at a twentieth of its size is still seen and drawn, and two pictures' names each keep to their own frame. A kind tucks behind the kind it hangs off only when the row needs the room; with room for every kind, each has a slot of its own. A calendar horizon longer than a decade draws a year to a cell. A card on the relation plane shorter than a summary's 80 pixels draws as a chip rather than a title and a sliver. The coverage matrix is built from an adjacency rather than a scan of every edge per column, a view's group members are looked up once per graph, and a tween's stand-ins once per pair of stops.
- d907771: Find says which is which. A song and an album both called "Gone Digital" were two rows that read "Gone Digital" in the Find strip, the album first and nothing in either row saying which was the song: hits were told apart only within their own kind, on the grounds that the strip heads each kind — but a row is read alone, by the pointer that lands on it and by the screen reader that speaks it. Same-named hits of different kinds now say their noun ("Gone Digital · song", "· album"), in the declaration's own word (`nounOf`: a staff member, never "staff"), and same-named hits of one kind still say the fact that differs. `search` takes `inKind`, the kind the person is in, and its records lead the others of the same strength; the scene passes the district or record it is focused on, so "Gone Digital" typed inside the songs is the song.
- 0bb6827: Flying closer is travel, not a cut. The cards rode the tween and the ground under them did not: the lattice, the plots and the roads were drawn from the live pan and from the destination's own cell, so choosing a picture snapped the whole ground to the new place on one frame while the buildings walked over to join it. Two things were wrong. The city frame did not record the pan its cards were laid out with, so the ground could not ride the same interpolation — it does now, and the tween lerps it. And an interrupted tween froze its origin by spreading the destination, which carried the destination's city into what the next tween starts from: every flight interpolated the ground from where it was going to where it was going. The frozen origin keeps the ground it was actually standing on, and the navigation harness fails if the cell leaps rather than eases.
- 171075a: Nothing hangs below a card in the stack. The district card clips (not hides) what rests under its foot, so the invisible iso block waiting to rise no longer makes the stage scroll; from altitude the card opens again. A robot whose foot is on the ground is drawn far enough in for its whole body, name included. The survey counts a cut only when something a reader could see is behind the edge, and names it.
- 3e3bfff: One door for what is yours: the scheme, the installation and the studio move behind the profile — and Back knows about both of them.
  
  The bar carried "Show the installation" and "Studio" beside the places, so every reader met two controls only a keeper can use in the same row as the app's own pictures. It also carried a scheme toggle while the profile pane carried a pair of scheme buttons — two controls for one setting. All three live in the profile now, under a heading that hides itself when it holds nothing, and the profile button wears a gear so the settings can be found rather than discovered.
  
  **Both doors are stops.** Showing a module said in its own comment that it was one — "so Back knows the way out" — and it was not: `shown` was missing from the comparison that decides whether a change pushes a history entry, so the address gained `show=installation` and the entry was REPLACED. The arrows stayed grey and one Back from the installation left the app. Opening the studio was component state, so the one door in this interface the back button knew nothing about was the door into the app's own declaration. It is `in.studio=open` now: the browser's arrows and the bar's own carry you in and out, a link can open it, and closing puts you back on the stop you came from. `adjustment` is exported and tested, and `verify-navigation.mjs` drives both doors in a real browser.
  
  Three things had to be true for the move to work. The pane is **mounted whether or not it is open** and hidden instead — a control in it may own something that outlives it, and unmounting the pane on the first press inside the studio took the studio's portal with it. `hidden` alone was not enough, because the pane's own inline `display: grid` beats the browser's `[hidden] { display: none }`, and a closed pane that still swallows presses is worse than one that is merely visible. And a press inside a dialog the pane opened is not a press "away" from it.
  
  Two things the move exposed, both fixed: the seat switcher did not wrap, so in a 280-wide pane the third seat was a name cut in half; and "Your record ↗" was a nineteen-pixel control, which no audit had ever measured because until now no audited screen opened this pane.
- 73690fb: Roads run on the ground. From altitude every pair of districts joined by a declared edge has one road on the ground layer, along the gutters between blocks — out of its plot, along the street, in at the other kerb — so no road crosses a third village and the city reads as villages on a street grid. Lines in the air are drawn up there only when they say something a road cannot: the relation the legend is asking about, the chosen edge, a member of the selection, a change that just happened. A focused screen's every member wired across the city is gone.
- 5343a1d: The relation band draws what a person can read. Its budget is the cards a row holds at a readable width times the rows it holds at a chip's height; below it nothing changes. Above it each relation (a run of one edge kind in one direction) stands whole if it is small, groups by what its members' own declaration offers — another edge's far end, a choice, a date by decade, year or month, never the relation's own edge, about five groups where it can — or keeps its most relevant members (the selection, the search's hits, the flagged, the recently written, the most connected) in its own order beside one "+N more" door. Groups are aggregates named in the graph's words with true counts, drawn as a band card with their first names, heard as "Single, 80 albums", and opened in place by the `expanded` stop; the door opens the kind's picture filtered by the relation. `bandOf`, `chooseGrouping`, `shares` and `isBandAggregate` are exported from `@graview/layout`, `LayoutOptions.relevance` carries what stands, and the arrangement's dates group by `year` and `decade` too. Focusing an artist with 1,100 songs draws 36 hosts and 50 line strands instead of 1,259 and 2,214.
- 6dd2cfd: The bar and the plates say less. The altitude control reads "Up" on the ground and "Down to <place>" from altitude, where the place is the one you land in; the open chevron on a district's plate appears when reached for — hover, keyboard focus, or while open — and stays a real button in between; "moved" appears on the bar only after a hand panned or dragged in this tab, not for a pan a link carried; hovering a relation in the key lights its roads.
  
  Also: Escape clears the selection again. The profile pane is kept in the tree while shut, and the shell's Escape rule took any overlay in the tree as one open over the scene, so a press with the strip open did nothing; a hidden pane no longer counts.
- 45c7a2c: The billboard is the point of flying closer. Chosen from altitude, a lens was drawn at half the span and under half the height — a window into the picture rather than the picture — and the caps were the window's, so zooming grew the city under the board and never the board. It may take most of the span now, and its caps grow with the zoom, so zooming in enlarges it the way it enlarges everything else. Its grey grip strip with a "⤢ Full screen" pill floating over it is a title bar now: the picture's name on the left, one "Open ↗" on the right, and the whole bar the handle that moves the board.
- b846b32: Where the camera goes on its own — to a drive-in off the edge of a large city, and down into the village a descent left — is `useCameraFlights` in `scene-camera.ts`, handed the layout and the camera's setter; the scene keeps the camera's state, because the pan and the layout read it. `Scene` is a thousand lines rather than fourteen hundred.
- d3e1201: The camera is not a move. Focusing a drive-in on the far side of a large city still brings the camera to it, but the offset is the scene's own now — added to whatever the person panned and never written to the URL — so "put it back" clears the person's pan and leaves the camera on the screen, and a fresh arrival carries no move to put back.
- 3376126: The card itself answers the keyboard. A view host is a tab stop, and its key handler returned unless the key had landed on one of the view's own pick targets — so Enter and Space on a focused card did nothing. On a blank app that is the whole interface: one district, whose selection opens the actions strip, where the only act lives. Enter on a host now does what a click does, and Enter again on a card already selected alone does what the second click does.
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
- 481340c: The city grows with the reader: a district card is sized in the reader's own text, not in pixels.
  
  The last thing that did not scale, fixed rather than named. A district card holds a name and a count, both sized in `rem` so a reader who asks for bigger words gets them — and the card itself was sized in pixels off the stage, so it never heard about the setting. At 200% every name in the city doubled inside a card that stayed exactly 230×97: a headline in a glyph.
  
  The layout takes a `unit` now — what one `rem` is worth in pixels — and sizes its cards, its floors and the room an opened district lists its members in by it. The Scene reads it from the root element rather than from a setting's name, because the scene has no business knowing what an app called its text-size control, and the browser's own default is a size no app declares at all. It watches both: the root's `style` for the app's control, a resize for the browser's.
  
  Cards cannot simply take the number, though — a ring is a fixed amount of ground, and cards at twice the size on the same ellipse are districts standing in each other. So the scale is the MOST the ring will use, and it gives back whatever it must to keep the ring a ring, down to the size cards have always been and never below. A reader gets bigger words everywhere and as much bigger a city as there is room for. `unit: 16` is the browser's default and the no-op: every existing caller lays out exactly as it did, which the tests assert directly.
  
  Measured rather than asserted, end to end: the probe that started this — load the app at the browser's own size and at Largest, diff every box — now reports one box that does not grow, and it is the viewport. `audit-ui` gained a `largest` state for Things and the garden, so every count it already makes (collisions, controls under 24px, text cut mid-word, anything off-screen) is made at 200% too, where none of them had ever been made before. All clean.
- 3e719c8: A kind is a neighbourhood: the city is a map drawn from the declaration, and everything in it has an address. `cityMap(schema, hints)` in `@graview/core` is pure and deterministic: it walks the kinds in the order a blank installation fills them (`beginning(app).order`, or sorted ids), puts the first at the origin and each next kind on the free block beside the placed kind it shares the most declared edges with, spiralling outward — in LATTICE CELLS, never pixels. Same declaration, same map; adding a kind leaves every existing plot where it was; population changes a plot's `side` and never its corner. A kind may declare `plot: { col, row }` and is put exactly there; `graview check` reports two on one block as `plot-overlap`. `roadsOf` names the roads between placed kinds, and `graview describe` reads the city out — each kind's plot and its roads — the first thing outside a browser that can say what is drawn.
  
  At altitude `layout()` places the districts by the map on the 2:1 lattice under ONE uniform scale and translate (`placeCity`), so the city has the same shape at 1280 and at 390 wide; nearer rows are drawn nearer with the depth number every plane style already reads; the collision shrink stays as a safety net, the opened listing gives up its room before the city grows, and the city slides aside for the live view standing in the middle rather than laying a district under it. `LayoutNode.plot` carries the address and survives `interpolate.mix` mid-tween; `Layout.city` says which lattice the picture is on, and the ground draws its diamonds at that cell, anchored where cell (0,0) meets the canvas and panning with it. Roads: a connector between two districts runs along the lattice's diagonals (`latticePoints`). Buildings: an opened district lays its members out as a `side`-wide grid inside its plot, each still a pick target, capped at `side × side` with "+n". The camera is bounded by the map's extent (`cameraLimit`) rather than a canvas fraction, so a city wider than a phone is reached by panning and nothing is dropped off the edge.
  
  `useWhereIs()` answers where a node, a kind card, a group or a Place slug is drawn from the CURRENT frame — riding the tween and the pan, measured from the DOM when there is one — with a member not drawn itself answering as its nearest drawn container, the connectors' own rule. `useScenePointer()` is the pointer over the scene in scene coordinates, and a quiet scene runs no listener: the store counts its subscribers and the scene attaches on the first, detaches on the last.
- f80138a: The city zooms and pans by hand. From altitude the pinch and ctrl+wheel used to step the altitude once, with a cooldown — a zoom that stuck — and the drag clamped the person's own pan while the camera's flight to a village sat on top of it, so the far side of a flown-closer city could not be reached. There is a scene zoom now, changed continuously by pinch and ctrl+wheel about the pointer and by zoom controls in the ground's corner, with the fly-closer step multiplied in; the plain wheel over the ground pans; the drag clamps the whole offset, pan plus camera, to the camera limit, so every district is reachable; direct manipulation is not tweened; the zoom resets on the way down. And a tween restarted mid-flight keeps its clock and its easing velocity, so a storm of restarts — two hosts reporting, a pointer's worth of wheel events — no longer crawls a pixel a frame.
- 59c1fdb: The descent lands in the village. Double-clicking a district from altitude no longer flies it to the stage's centre while the rest reorganises around it: the stack's focus is landed where the village stood, so it grows in place, and the camera then glides to rest so the world slides to meet it. The camera offset is scene state, never in the URL. The ground says when nothing is in motion (`data-graview-settled`), so a harness can wait on that rather than on a timer.
- 71fd426: The card that stands for the districts the row could not hold is one control, and the districts are one press away. It listed every name inside its own box — a district card's height, which holds a count and nothing else — so "+6" over one clipped word read as a broken placeholder, dashed and faded, and nobody could see what else there was. The card is a button now that says how many more; pressing it opens a panel above the row, portalled onto the scene's ground so no plane paints over it, naming every district with what it holds, each a press to that district. The district you are already in, which lands here when the row has room for nothing else, is marked as here rather than offered as somewhere to go. `@graview/react` takes `react-dom` as a peer for the portal.
- 2c20c53: The edge says what is past it. A city wider than the window keeps its shape and is reached by panning, and on a phone the gauntlet's Topics and Staff stood wholly past the left edge with nothing on the screen saying they were there: a pointer had nothing to press. From altitude, every district whose middle is past an edge now has a sign on that edge, in its own name and pointing at it, and pressing the sign pans the ground until the district is in view. `districtsPastTheEdge(layout)` names them, with the side and the pan.
- 4472467: Three things about the elevated view. A hand-placed district drew its dashed pin mark around a card with nothing in it — up here a district is a village on a plot, so the only visible part was an empty rounded rectangle sitting on the ground; the plot's own kerb already goes dashed, which says the same fact where the district actually is. An opened district laid its members out `side` to a row so the chips echoed the buildings on the lattice, which at a district's own width meant sixty pixels a chip and "Enough bodies for the drill" arriving as "Eno…"; the columns are set by what a name needs now, because opening a district is the gesture that asks which one. And a view is redrawn only when what it draws changes: a host re-renders on every frame of a flight, a pan and a zoom, and it was dragging every lens with it — the three live pictures on a board and the billboard itself, sixty times a second, for pictures that had not changed at all.
- 89f4855: The ground is the city's own grid, and a billboard sinks into its village. The lattice was four repeating gradients phased from the middle of the box and seamed at its edge, so its lines never sat where the city's cells were; it is drawn as tiles now, one cell by half a cell with both diagonals, pinned where cell (0,0) meets the canvas, so every plot corner is a lattice vertex at every zoom. The tween carries the city with it: between two cities the cell and origin lerp, so plots, roads and lattice grow and slide with the cards on them; rising, the lattice arrives with the destination; descending, the ground stays while it fades. And switching lenses across kinds no longer leaves the old picture standing at full size under the new one for the length of the tween — a leaving billboard had no stand-in, since a village's members are ground, not nodes — it shrinks into its kind's signpost and board, and the next rises out of its own.
- f240a12: The ground under a district. From altitude every plot is drawn as the iso tile it is — four lattice corners in the kind's hue, a kerb, a cast shadow — so a district stands on land rather than floating on a hatch; the fields between darken toward the near edge and the lattice carries twice the weight; a hand-placed district's kerb is dashed; the robot's pad is a cell of the ground in the ground's own ink; clicking a tile focuses its district.
- 859c128: The hand on the scene is four named hooks in `scene-hand.ts` — the wheel and the pinch (`useWheelAndPinch`), the district under the hand (`useHeldDistrict`), the world moved as a transform while a hand is on it (`useWorldShift`), and the gestures that use them (`useSceneDrag`) — rather than a hundred and fifty lines in the middle of `Scene`. Behaviour is the same, and verify-panning's eight drags hold 55fps as before.
- e0d5026: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- b7d3209: The keyboard always lands somewhere. When an act removes, disables or hides the control the keyboard was on — Escape closing a menu, a chip's × dropping the selection, Back taking the page away, "Send" while the answer comes — it lands on the nearest thing that still stands where it was, or on the same control when a re-render drew it again (`useTheKeyboardLandsSomewhere`, installed by `Shell` and `<Embed>`). The studio hands the keyboard back to whatever opened it when it closes, and a routed page that replaces another lands it on the new page's heading. Eight walk findings were this one rule broken on eight surfaces; the browser harnesses' watch found it on about forty more.
- bd1f27b: The rule that the keyboard always lands somewhere asks until it has landed — every tenth of a second for up to two and a half seconds — rather than at a few fixed moments, which on a starved machine all came before the change they were waiting for.
- 6dd2cfd: The ladder is a setting. Which rung answers the chat — this graph, a model on this device, Jev which decides, or a model with your own key — is one row in the profile pane beside text size and scheme, with a key field only when the rung needs one and one sentence on screen; the provider owns the choice (`intelligence`, `chooseIntelligence`) so the profile sets it and the chat reads it. The chat's gear and its pane of prose over the map are gone.
- 6a043bf: The lenses are pictures, and choosing one flies closer. From altitude a district's board shows each of its lenses as a small live version of the lens under its name, not a label. Pressing one stays aloft: the kind is focused with that showing, the billboard on its plot shows it, the city's cell grows by half so the camera is brought in toward that village, and the camera centres on the drive-in with the picture's top kept inside. The billboard carries the one way down, a full-screen control that leaves the graview with that picture. The billboard's foot stays on the kerb wherever that is; the camera brings it in rather than the layout sliding it down over its own village. The billboard is cut to its picture: a lens lays itself out in a box as tall as the window, and the billboard used to show the whole box, its picture floating a village's height above the kerb — the scene now measures how much the lens actually drew (what is in flow, plus what its scroll regions need beyond what they have) and the layout sizes the billboard to that, floored so a title alone is not a picture. The small lenses on the board are inert: nothing drawn inside one takes focus or a press. The billboard's frame, posts and ground sit on the picture's box, so an empty lens is a header over an empty screen rather than a strip floating over the village.
- b7fa5e3: The menu leads with the thing you clicked. `deriveAffordances` takes a `focus` — the node the gesture landed on — and ranks by it: that node's own repairs first, in the order the rule listed them, then its own acts (settled before asking), then everything the rest of the selection offers. Until now a rule that implicated five late tasks in ONE violation offered its ten repairs in whatever order it walked its subjects, so right-clicking the fourth task met the first task's repair at the top and the obvious press fixed somebody else's problem. Which node an act is FOR is read off the mutation's own `nodeRef` arguments rather than the violation's cast list, so "a new date for Book the hall" is Book the hall's repair wherever it came from. Every surface reads one rank, now stamped on each affordance as `rank`: the pointer menu (which names what it was opened on), the actions strip (whose focus is the last thing selected), and the routed record, where a rule's repairs are ordered by `rankedRepairs` instead of as declared. The destructive tail is unmoved, and a derivation with no focus ranks exactly as it did before there was one.
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
- 8dbae9a: The picture pans, and a flight does not eat the room to pan back. Choosing a lens from altitude puts a billboard in the middle of the window and flies the camera to it — and a drag that started on that billboard moved the card rather than the view, so the biggest thing on screen was the one place panning did not work. A picture is the view you are in, not a thing you rearrange, so dragging it moves the view; a district's own card keeps its drag, because placing a district by hand is a real gesture with a dashed kerb to show for it. And the whole offset is clamped to the camera limit or to wherever the camera has already flown, whichever reaches further: flying closer takes the camera past that limit on purpose, and clamping to it afterwards resolved every drag to the same number, which read as the ground refusing to move at all.
- 60e4bf5: In the stack the docked robot stands at the far end of the shelf's first district rather than across its nameplate; the two sharing settings carry four distinct labels; a places pill and a drive-in marquee button clear a fingertip after the depth scale.
- ae188cc: The scene holds sixty frames a second on a real catalogue. Nothing measures while it moves: lines and their captions are drawn once a transition settles, and pick targets are marked when the DOM changes rather than every render. A card held by the hand moves alone — `holdLayout`, exported, moves one node and re-aims the lines that touch it instead of laying the stop out again. The focus's kind tag is placed when its panel resizes, not by reading two bounding boxes after every render, which forced a layout on every frame of a transition. Invariants are evaluated once per change however many views ask, where each picture evaluated the whole graph as it mounted. `connectorsFor` and `interpolate` are linear, a host's signature keys its group by count and hash rather than joining every member id, and a line's anchors are read from one index of the host. A host's blur is its nearest plane's, so it changes once in a transition rather than every frame. Over Tech N9ne's catalogue the hub lands in one frame of about 57 ms and every frame after it, dragging, wheeling, moving a card, selecting and typing, fits sixty.
- 851feb6: The scene is seven files instead of one of four thousand lines: the root component, the lines and ties drawn over it, its helpers, the view host, where things are drawn, the connectors, and the resolved view — with `scene.tsx` saying what they are and re-exporting them. Nothing it exports changed.
- 6dd2cfd: The screen stands on its plot and the signs stand on the land. From altitude a focused place's picture is a billboard at the back kerb of its plot, framed, on two posts, with no clearance needed above its card; the nameplate is a signpost planted at the plot's front corner on a short post; the drive-in's board of showings hangs under the signpost in the ground the layout reserved for it; the kind's landmark stands in the village square among the buildings. The "shown above" note on a focused plate is gone: the screen says where the members are.
- 43cf40d: The seat is a companion attached to the viewframe, not a figure walking the ground. Four panels used to say the current subject in four corners — the inspector's strip and its pointer menu, the quick relations, the relation key, and a chat panel behind a pill on the bar, anchored to a robot that stood on a pad, walked to what it wrote and followed the pointer when pressed. One construct now: `Companion`, on the left where the scene already reserves a rail, fixed to the frame so it is the same at altitude, on the ground, flying closer and inside a full-screen lens, where the figure had no place at all. It names its subject in its header — the selection, else the pick the pointer has settled on, else where you are — and "this" in a message means that. Under it: the acts for the subject from the same derivation the pointer menu reads, the relations, the conversation, and the key at the foot. Right-click still opens the acts at the pointer, so the context menu and the assistant are one thing; Escape closes that popover and never changes the subject. Collapsed it is a narrow dock; on a phone it is a sheet. `RobotMode` loses `following`, the robot's pad leaves the city map, and other people's agents keep their figures — a body in the picture is how you see somebody else at work. `useSubject` is exported for a surface that needs the same answer, and `useAffordances` takes `about` for acts on something nobody clicked.
- 315ce3b: The seat is a robot in the city: it stands where it reads and writes, comes to your cursor when asked, and says its refusals at the gate. One figure per agent participant (`kind:id:session`, the op log's own key), drawn by an `Occupants` overlay over the stage on both renderer paths and positioned from the live frame through `whereIs`, so it rides the tween and the pan and never enters `layout()`. Where it stands is a pure fold (`foldRobots`, tested like `markActivity`): a read puts it at what it read, a write at what it wrote, more than four targets at the neighbourhood, a refusal at the gate with the policy's words as its say, a question on the node's doorstep, rest after the hold at its dock — the seated person's own building when the installation is shown, else a pad at the city's origin cell. Movement is one CSS transition on transform; a quiet city runs no loop and no pointer listener, and reduced motion makes moves instant.
  
  The tab's one-press seat and its chat are ONE robot: the seat registers its name and the chat writes as it (and is seated even while the Activity rail is shut, so the body is docked from the first frame). Applying a plan walks it to each target before the op lands (`applyPlan`'s `before`); undoing an agent's turn walks it home; a run's stop sentence, announced through `onCall`, is said from its bubble. Click the figure, or Tab to it and press Space, and it follows the pointer, offset so it never sits under the cursor; while following, "this" in the chat is the pick under the pointer and the chat panel is anchored as its bubble; Escape releases from anywhere. Off the visible ground an edge indicator points at it with its status line. The bubble is a polite live region carrying whatever the seat says on its rung, and the figure is a named button. `scripts/verify-robot.mjs` drives all of it on the todo app; the seat harness still shows identical diffs.
  
  Also: the graph responder now fills a choice argument from the option's own word in the sentence ("give a role keeper to Sam"), and only when exactly one option is named.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- 1636ddc: Two relations between the same two things are drawn as two lines. A song by and produced by the same artist had both lines on one curve, so one was invisible and could never be picked — its severing act was reachable only from the strip. Lines sharing both ends now fan about the curve a single line would take, and each line's hit path follows its own curve.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 6e8a02c: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- 3cb6d60: What a review of the villages found. Pressing a plot's tile focuses the district's aggregate rather than the card's own id, and not on the click a pan produces on its way up; going back up before the descent's glide has landed no longer wipes the altitude camera; a host that answers the chat itself (`respond`) hides the ladder in the profile; the signpost rule applies only to cards on a plot, so a nested card's plate stays where it was; the screen's collision guard protects the plate where it stands now (below the card), not where it used to; road and village geometry is computed once per city and translated per frame.
- cb196b1: What the scale review found. A band's group stays selected when pressed: its id names a run of a relation, not a kind, and the check for whether a selection still exists dropped it at once. A card of one kind, where a relation holds several, opens in place when pressed instead of changing the stop and drawing the same band. The focus's kind tag sits on the panel's corner again on the altitude stamp, measured from the drawn boxes with the plane's scale taken out, from the resize observer where the reads force nothing. And a card moved in place no longer lays the stop out again on every move once the ground has been panned.
- 5b401bb: What the review of search found. A boolean field is a state, asked for as a condition (`done:false`), not a word: it read as "No", so "n" found every open task in the Find box, a list's `?q=` and the chat — `searchableFields`, `describe` and `llms.txt` no longer list booleans. The picture lights every match from the result's new `matched` list rather than the strip's capped hits. A list's `q` made only of tokens nothing offers (a pasted `https://…`) finds nothing, as the Find box does, and a lone `is:flagged`, `is:clear` or `is:past` narrows in both. `actsOn(store, id, words)` lists a record's acts without a search of the graph; `search()` takes `touched`, and the scene works out what is flagged and touched once per graph change, not per keystroke; a list parses its words once rather than once per row. A lit district's count, Enter on a kind hit and a double-click are one transition — `withJackIn(…, { carry })` — which comes down to the ground, close and narrowed. The row's words (`in.q`) no longer follow you to the next focus, and `withoutSearch` clears the search with the words it carried. A pick in the pages face's Ask drawer goes to the record's page (`onPick` on `ChatPanel` and `Companion`), and the list page reuses the affordances it already has for search-to-create.
- cf193fc: What you can press is what you can see. A view host is the box the layout gave it, and a view that sizes to its content fills only part of that; the invisible remainder was still a hit target, so a record read from altitude and pinned beside a district covered the district's open button with nothing and the button stopped answering. On the DOM path the host and the scaled natural box are now out of hit-testing and only the drawn content is in. The navigation harness hit-tests it.
- 228039c: Where the seat worked is marked on the thing. The robot walked to what it wrote and stood there; the walk went with the figure and the attribution did not. `useSeatWork()` reads the op log — the ops an agent authored, what they wrote, and what an undo took back — and `SeatMarks` draws the seat's glyph on each of those things for a hold: on a card, on a building in a village, on a chip inside somebody's own lens, measured from the picture as drawn, so it is right on both render paths and inside a full-screen lens. The companion lists what the seat did in its own words, each with a "show me" that takes the camera there: from altitude the district the thing lives in, on the ground the thing itself. A question the seat asked stands at the node it is about and says itself, waiting rather than fading, and is listed in the companion with the same way back. Undo takes the marks with it.
- 968e1d1: The installation, in the app people open first. Things declares `declareInstallation({ roles: ["keeper", "member"], admin: "keeper" })` with a policy, two seeded people and a pending invitation, so the platform story is demonstrated where a reader will look for it rather than only in a seedbed chapter. `GraviewProvider` takes `seats` and `onSeat` and holds who is at the keyboard, and the bar draws the new `<Seats>` primitive for them — sitting down re-derives every surface from one principal: the acts offered and the ones withheld with the policy's own sentence, which kinds are drawn at all, whether "Show the installation" is there, what the routed face lists, and the agent's tools. `Places` no longer draws a pill over a kind the seat cannot see, which was a door to a district that was not there.
  
  `ArgShape` gains `{ type: "several", of }` for an argument that takes a list. Without it `z.array(z.enum([...]))` described itself as `unknown`, so "Invite somebody as coordinator and gardener" was unaskable and therefore derived NOWHERE — in every installation the framework ships. An array of something undescribable stays undescribable, so an unaskable act does not start looking askable. The strip's ask answers such an argument by toggling choices and settling separately; the routed face's list control already handled it.
- 59cef8c: Who is where. Other people stand on your map at the plot their stop focuses, in the audience row of the showing they are watching, with their robots beside them captioned as theirs and the thing they point at outlined in their hue — placed by each viewer's own `whereIs` from a presence payload that is never a pixel and never enters the op log. `PresenceChannel` has two implementations in ship: a BroadcastChannel between tabs of one origin, beside the browser adapter, and two routes on the served store folded into the poll the remote store already makes. A per-tab session fills `Author.session` on a tab's ops and its presence key alike. Clicking a figure follows that person until you move yourself or press Escape; sharing is a reader setting in the profile pane; an embed broadcasts nothing unless handed a channel. `openRemote` now carries `applyAll` and `undo` to the wire.
- Updated dependencies [fb781c2]
- Updated dependencies [390028c]
- Updated dependencies [bff0b71]
- Updated dependencies [400a6df]
- Updated dependencies [c7a3519]
- Updated dependencies [2aae30f]
- Updated dependencies [475cc83]
- Updated dependencies [09a23a3]
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
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [c5e4ac7]
- Updated dependencies [42c2c96]
- Updated dependencies [9a3fe4b]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [8041853]
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
- Updated dependencies [a5d842b]
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
- Updated dependencies [0c0fa22]
- Updated dependencies [c8e9387]
- Updated dependencies [8a2fdf2]
- Updated dependencies [fb6eb5d]
- Updated dependencies [5343a1d]
- Updated dependencies [45c7a2c]
- Updated dependencies [ddf1ea9]
- Updated dependencies [6e0fbb7]
- Updated dependencies [7188978]
- Updated dependencies [e3a7de6]
- Updated dependencies [3af8da7]
- Updated dependencies [5aa8776]
- Updated dependencies [76e50a5]
- Updated dependencies [481340c]
- Updated dependencies [3e719c8]
- Updated dependencies [206670e]
- Updated dependencies [f80138a]
- Updated dependencies [2c20c53]
- Updated dependencies [8d43e33]
- Updated dependencies [89f4855]
- Updated dependencies [53ad439]
- Updated dependencies [e0d5026]
- Updated dependencies [0ea3f62]
- Updated dependencies [90a3344]
- Updated dependencies [6a043bf]
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
- Updated dependencies [098c784]
- Updated dependencies [ae188cc]
- Updated dependencies [6dd2cfd]
- Updated dependencies [315ce3b]
- Updated dependencies [d9bfdb8]
- Updated dependencies [3506c69]
- Updated dependencies [daccd55]
- Updated dependencies [be9fb19]
- Updated dependencies [e7151d4]
- Updated dependencies [ce13ec8]
- Updated dependencies [ccaa5f4]
- Updated dependencies [95196d7]
- Updated dependencies [55c4151]
- Updated dependencies [5856676]
- Updated dependencies [6e8a02c]
- Updated dependencies [3cb6d60]
- Updated dependencies [cb196b1]
- Updated dependencies [5b401bb]
- Updated dependencies [968e1d1]
- Updated dependencies [59cef8c]
  - @graview/core@0.1.0
  - @graview/layout@0.1.0
  - @graview/tools@0.1.0
  - @graview/render@0.1.0

## 0.0.1

### Patch Changes

- 37bb6af: The constellation says what it means: relations drawn at full strength from
  above the stack (where the lines are the content rather than an aside),
  receding when a kind is selected so its own relations stand out, and a derived
  `RelationKey` naming each edge kind with the exact stroke the scene draws.
- e38fe86: The generic full page is a document rather than a card stranded on a viewport:
  a real header, a centred column, a heading that is the whole thing rather than
  a truncated copy of the body, field names in words, and no value repeated
  because the heading already said it. The name is now the rename control.
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
- 23ab0fe: A relation between two members of the same kind is drawn as a loop in the
  Graview rather than dropped. The legend was counting `waits-for 3` while the
  picture drew nothing.
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
- 4bd846b: The horizon, modules, selection-as-a-stop, the traditional face (@graview/pages), the intelligence seam, and the ship subpackage (persistence wiring, op-log-native migrations, export bundles, health).
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
  - @graview/render@0.0.1
