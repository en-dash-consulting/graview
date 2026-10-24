# @graview/embed

## 0.1.53

### Patch Changes

- 642145e: A deleted view never draws, a home's or an untitled one's either, whatever order views register in (FR-202). In Graview Cloud's Eagles app a home view deleted that morning (`eagles-story`) drew over the live one (`eagles-nest`): Cloud hands the page its deleted views too, so Restore works in place, and `tidyViews` kept a deleted view undrawn only by the name it registered under — which only a titled view of a kind had — while `views.home` went to whichever view registered last. Now `registerWorkerView` registers a home and an untitled view of a kind by the manifest's name too (a draft still by none), the registry keeps every home it is given in order with that name (`views.home(view, { name })`, `views.homes()`, the type `HomeRegistration`), `layerViews` lays each over with its name, and the tidied registry's `homeView` is the last home not deleted, its kind's picture the last view not deleted. A home's view fails over to the app's own home, the last one no view gave, rather than to another view a host may have deleted. Hiding keeps a place off the lists, and a view with no title is on none, so an untitled view only hidden still draws. `react`'s test registers the deleted home after the live one and the deleted untitled list after the live one, and draws the live ones; `guest`'s registers two homes and an untitled view and reads their names. `pnpm verify address` hands its page a deleted home view registered after the live one, with the host listing it deleted, and the home draws the live one (`aDeletedHomeViewNeverDrawsOverTheLiveOne`). A hosted page carries 0.2 KB more up front (194 bytes, about 58 gzipped; the compiled page the same), under a raise of each budget by that (`scripts/budget-raises/a-deleted-view-never-draws-*.json`), and the scene face's before-draw line is 996 KB. `capabilities().shipped` gains FR-202.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` gains FR-202. Additive on `@graview/core` (`ViewRegistry.home`'s optional `meta`, `ViewRegistry.homes`, the type `HomeRegistration`). What Graview Cloud does: hands the page every deleted view again, home and untitled ones included, and deletes `tidiedOnPage` (`workers/cloud/src/views.ts`, INTERIM(FR-202)) once `capabilities().shipped` has FR-202.
- 642145e: A visitor's form loads light (FR-201). Graview Cloud's form page — `@graview/embed/form` over the app its host compiled, read with `appFrom` from `@graview/core/compiled`, and the store the visitor is served (`openRemote`) — loaded 668 KB up front with React, more than the whole app shell: the derived form imported its controls, and the form its theme, from `@graview/primitives/pages`, the barrel every routed page draws from, and a bundler places in what a page loads first every module its imports reach that anything in the bundle uses. Through the barrel came the bar, the lists, the arranging, the framework's views of a kind and, through them, the document's blocks, view checker and expression parser. Now they import from `@graview/primitives/form`, a new entry with what a form draws with and nothing else (`Files`, `LinkedPicker`, `RepeatPicker`, `WhenInput` and `themeBaseCss`). Cloud's form page loads 308,835 bytes of Graview first (113,728 gzipped), from 468,438 (178,330): about 509 KB with React, from 668. What is left of the document is what builds and runs a compiled app (`document/compiled`, the evaluator and the template): an act the page applies before the server answers is judged as there. The form alone loads 235,371 bytes (86,563 gzipped), from 390,538. "A visitor's form alone" is lowered to that with its raises (226,800 / 83,600 base, from 380,000 / 146,000), and "a visitor's form handed a compiled app" is a budget of its own at 311,000 / 114,800, held by the embed's budget test under 400 KB and under 60% of the pages face. `pnpm verify address` opens the form over a compiled app read with `appFrom`, and it refuses an answer that does not fit and lands one that does (`aVisitorsFormOverACompiledAppRefusesAndAnswersAsBefore`). The bundle measure and `verify-address` now build with React's automatic runtime, as every package's tsconfig says: esbuild does not read it for a `.tsx` its source plugin resolves, and the form drew with a `React` that was not there. `capabilities().shipped` gains FR-201.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` gains FR-201. Additive on `@graview/primitives` (the entry `./form`). What Graview Cloud does: nothing in its code; its form page's 680 KB lint budget (`workers/cloud/lint/no-studio.test.ts`) can come down to about 520 KB once it builds on this.
- 42009a4: The scene keeps up with a hand on a large app, and the ground's grid moves with the picture. A product owner on an app of a thousand records and four thousand links found the scene slow and laggy, and the grid snapping back into place after every pan. A drag sets no React state now: whether a hand or the wheel is moving the picture is a ref the renders read, and what a person sees of the hand — the grabbing cursor, no text selected under it, the signs at the edge put away (`data-graview-hand` on the ground) — is written on the ground outside React, as the transform the hand paints is. The first move of a drag no longer draws the whole scene, and not one commit happens while the hand moves. The lattice the city stands on is an element of its own now, the last on the ground (`.graview-lattice`, where the ground's `::after` was), and a hand dragging the picture says how far it has taken it on that element alone (`--graview-hand-x`/`-y`, added to the lattice's anchor), in the same frame as the transform and taken off in the commit that moves the anchor by as much: the grid moves with the cards on it while they are dragged and does not jump when they are let go, and the frame costs one element's style, not the two thousand a custom property on the ground would reach. The fine square measure under the cards on the ground is part of the picture too: it was the ground's `::before`, fixed to the window while the cards slid over it, and is now an element of its own, the first on the ground (`.graview-measure`), anchored where the world is moved to — a layout says its pan at every altitude now (`Layout.pan`, tweened by `interpolate` with the cards) — and moved by a hand in the same frame as the cards; its fade stays the window's. With the ground's grids no longer pseudo-elements, axe can judge the contrast of what stands in the scene, which it had been reporting as undecidable, and it found the "+N more" card's words 4.0:1 on the receded shelf: they are in ink now, not its muted tone. Letting go of a drag, or the wheel coming to rest, draws the scene once: `useAnimatedLayout` draws a cut in the render that asks for it, rather than putting it into state from an effect a render later, a hand's pan is cut to without the second look a cut otherwise gets (`TransitionOptions.settle`), since the offset was painted where the cut puts every card before the hand let go, and turning motion back on with the layout it has just cut to no longer flies a half-second tween from that layout to itself — thirty-odd renders of the same picture after every drag. The pan no longer lays the city out again (the layout is keyed on the stop less its pan, by what it holds), and the cards in the scene and what floats over the picture — the panel beside the map, the menu at the pointer, the quick ask, the past — read the context free of the pan (`PanFree`, `usePanFreeContext`): kept while only the pan moves, so a board of 250 cards is not drawn again to be shown somewhere else, and a write of the whole view from in there keeps the pan the view has now. A presence's `sharing` is kept while it says the same, so a pan is not a new context for everyone; a band's card and the "+N more" card are drawn again when their picture changes, not when a pan moves them. What a selection reaches is worked out once per selection however many cards ask, its rules judged once per change of the graph — choosing a district had every card walk every edge and judge every rule for itself — and a record's connections read the rules judged once too. A plot drawn again for a zoom names its blocks from the names it said before; the scene stops asking where the ground is on every move of a drag, and says where the hand let go when it does; and the embed's `data-graview-drawn` no longer comes off for a pan, which is not another place (the place watched is the stop less its pan; `onDrawn` is not told the same place again). Measured on a made-up field survey of the same shape at a quarter of the CPU's speed: letting go of a drag 306 ms of main thread before, about 120 after; the wheel 366 → 125; letting go over a board of 250 records 307 → 110, nothing on the board drawn again; a drag's forty moves 413 → 365 with the grid now moving in them; choosing a district lost the 0.66 s every card spent working out what the selection reached. The pages and a hosted page carry 0.3 KB more up front (the presence's kept `sharing`, the drawn signal's place, the layout's `pan`), under raises of the hosted page's budgets, the pages face alone's and a visitor's form alone's (`scripts/budget-raises/the-scene-keeps-up-with-a-hand-*.json`), and the scene face's limit before it draws moves to 999 KB. React's tests hold that a cut is drawn in the render that asks for it and once, that nothing flies to where it already is, that what is inside `PanFree` is not drawn again for a pan and keeps the camera when it writes the whole view, and that what a selection reaches is worked out once for twenty cards. `pnpm verify scene-at-scale` serves the survey with `graview preview` and holds, against a reference measured in the same page: no React commit while a drag moves, from altitude and on the ground; every grid under the picture — the lattice and the measure from altitude, the measure on the ground — moving exactly as far as what stands on it mid-drag, and none of it moving when it is let go; letting go drawing nothing inside a card, under its budget; the wheel likewise; and going into a district of 250 records under its budget.
  
  Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas — unchanged. The JavaScript API — additive: `PanFree` and `usePanFreeContext` on `@graview/react`, and `TransitionOptions.settle`; inside `PanFree`, and inside the scene's cards, `useGraview().view` carries no `pan` (the pan is the scene's). The JavaScript API also gains `Layout.pan` and `InterpolatedLayout.pan` on `@graview/layout`. The theme — the ground's lattice is `.graview-ground > .graview-lattice`, no longer `.graview-ground::after`, and its fine measure `.graview-ground > .graview-measure`, no longer `.graview-ground::before`; a host's own rule over either moves with it. The embed — `data-graview-drawn` and `onDrawn` no longer go round again for a pan alone. What Graview Cloud does: takes this build; a host that styles the ground's grids itself moves its rules to `.graview-lattice` and `.graview-measure`.
- Updated dependencies [a1acdc1]
- Updated dependencies [642145e]
- Updated dependencies [642145e]
- Updated dependencies [e30703c]
- Updated dependencies [e30703c]
- Updated dependencies [642145e]
- Updated dependencies [642145e]
- Updated dependencies [e30703c]
- Updated dependencies [d28346b]
- Updated dependencies [42009a4]
- Updated dependencies [6afe99b]
  - @graview/core@0.1.53
  - @graview/react@0.1.53
  - @graview/guest@0.1.53
  - @graview/pages@0.1.53
  - @graview/primitives@0.1.53
  - @graview/layout@0.1.53
  - @graview/studio@0.1.53
  - @graview/tools@0.1.53

## 0.1.52

### Patch Changes

- 1a65f86: A list is exported as it is shown (Roadmap f-view-export-csv). A kind's list and a lens that lists records — a calendar, a timeline, a coverage, a board, a status board — offer a quiet, short "↓ CSV" press named "Export CSV" — beside a kind's heading, after adding one, and at the end of a lens's arranging line, and the place menu offers it too: either writes the records the place keeps, in its order, with its filter, its words and its groups — a group drawn shut included, since shutting one is how it is drawn — a "Group" column first when it is grouped, then each record's name, then the fields its page reads, computed ones too, each said as the page says it (money in the app's currency, a day in its locale, a choice as declared), headed by the fields' labels. Never more than the seat sees: the rows are the records the seat is served, so a field its sight keeps is in no row, and a field in no row is no column. The file is named for the place and the day ("Questions — 2026-10-23.csv"), with what a file system refuses replaced; the browser downloads it, or a host that saves files itself passes `onExport(csv, filename)` to the provider, `PagesApp`'s context or `mount`. Whoever may change the declaration is offered "Turn off export" in the place menu, and "Turn on export" where it is off: `export: false` on a lens (`LensDeclaration.export`) or on a kind's list (`pages.lists.<kind>.export`) offers it to nobody, set by the edit `set-lens-export` (`{ title, on?, export }`, on a kind's list by its kind or plural; refused on a lens that lists no records), read by a lens as it is drawn and by a list from the declaration, said by `diffDocuments` and `graview describe`, and written by `toDocument` only when it is off. `graview check` warns of an `export` that is not true or false (`lens-export-not-a-boolean`, `pages-list-export-not-a-boolean`) and of one on a lens that lists no records (`lens-export-lists-no-records`). The list page draws its rows from `shownList` on a new `@graview/core/shown` — the horizon unless the past is asked for, a rank worked out over what the seat sees, the declared groups in order with the closed ones shut — and the export writes the same rows, so the two cannot disagree. The writer is on a new `@graview/core/csv`, fetched with the first press: `toCsv` (RFC 4180 quoting, CRLF, a byte-order mark so a spreadsheet reads accents), every cell that a spreadsheet would run as a formula — starting with `=`, `+`, `-`, `@`, a tab or a carriage return — written with an apostrophe in front (`csvSafe`), `listCsvRows` and `listCsv`, and `csvFileName`. The studio's lens takes `export`, and its change is said as `set-lens-export`. The graview-lists skill says how. A hosted page carries 0.1 KB more up front (the provider's `onExport`), under raises of the hosted page's budgets and the pages face alone's (`scripts/budget-raises/a-list-is-exported-as-it-is-shown-*.json`; the pages face's is mostly `shownList`, which the list now draws with), a visitor's form alone carries 6 bytes more and needs none, and the scene face's limit before it draws moves to 996 KB. Core's tests hold that the writer quotes, guards and is read back by `parseCsv`, that the rows are the page's order and groups, a shut group's rows among them, that a field the seat's sight keeps is no column, and that the switch is edited, checked, carried, written and said; embed's, that Export CSV is on a list's line and in the place menu, hands the host the rows the page draws, and is offered to nobody where it is off, with the owner's switch.
  
  Compatibility: ops and primitives — unchanged. Snapshot and log formats — unchanged; `KeptViews.lens` may be handed `set-lens-export`. The wire — additive: `/graview/views` takes `{ lens: { op: "set-lens-export", title, on?, export } }`. The declaration and check finding codes — additive: `export` on a lens and on `pages.lists.<kind>`, the edit `set-lens-export`, and the findings `lens-export-not-a-boolean`, `lens-export-lists-no-records` and `pages-list-export-not-a-boolean`. Derived tool names and input schemas — unchanged. The JavaScript API — additive: `@graview/core/shown` (`shownList`) and `@graview/core/csv` (`toCsv`, `csvCell`, `csvSafe`, `CSV_BOM`, `listCsvRows`, `listCsv`, `csvFileName`); `LensDeclaration.export`, `KindList.export`, and the `set-lens-export` member of `LensTidyEdit`; `OnExport` and the provider's `onExport`; `PageContext.onExport`; `FrameOptions.onExport`; `ArrangeBarProps.end`, `ArrangingOptions.exportable`, and `ExportPress`, `useShownListExport`, `shownListSaid`, `exportShownList`, `PlaceExportContext` and their keys on `@graview/primitives`; `saveShownList`, `switchExport`, `ShownListSaid` and `ListWords` on `@graview/core/csv`, where a list hands in how a record is said (`labelOf`, `readableFields`, `withComputed`) so the module fetched with the press imports none of them. What Graview Cloud does: takes this build; a host that saves files (or a guest frame that may not download) passes `onExport` to `mount`, and its views route passes `set-lens-export` to the declaration as it does `set-lens-hidden`.
- Updated dependencies [821be82]
- Updated dependencies [1a65f86]
  - @graview/core@0.1.52
  - @graview/primitives@0.1.52
  - @graview/react@0.1.52
  - @graview/pages@0.1.52
  - @graview/studio@0.1.52
  - @graview/guest@0.1.52
  - @graview/layout@0.1.52
  - @graview/tools@0.1.52

## 0.1.51

### Patch Changes

- 920641e: A field typed together is edited live: the fourth phase of collaborative text, the editor. Under a host that carries typing — an embed handed a remote store, whose `remote.typing` the frame hands the provider as `typing` — prose the declaration types together (a Markdown field, a long text, a field marked so) opens with no draft and no Save: each keystroke is the field's at once, sent through `remote.typing(node, field)` as a splice read from the text area before and after it, the end it keeps never left of the caret, so a letter typed into a run of the same letter lands where it was typed. A run ends on a blur, Enter, an arrow or a click in the text, and by itself after 400 ms or a word. "Done" closes it, and so does Escape, which puts nothing back; Ctrl or ⌘ Z takes back this person's own last run of typing into the field and nobody else's, though they typed after it, and Ctrl or ⌘ Shift Z puts it back. Somebody else's typing lands in the text area as it arrives, the person's selection carried over it, a caret staying before text inserted where it stands; while an input method composes a word nothing is sent and what others type waits, and the two meet when the word is chosen. Markdown keeps its Preview, read from the live text, and the scene's record and the routed page are one binding. Where the host carries no typing, or the field is written whole, the draft and its Save are as they were. A presence may say where somebody's caret stands in such a field (`caret: { node, field, anchor, head, rev }`, offsets against their log at `rev`); the editor says the person's while it holds the keyboard, at most every 120 ms, and draws everybody else's as a thin line in their hue with their name on it, laid on a copy of the text that wraps as the text area does, carried over the typing the page's log took since they said it. A server keeps a caret only when it is a record, a field and three counts, and tells it to no seat whose sight keeps that record or that field from it (`presenceSeenBy(who, sees, seesField)`). `@graview/ship`'s handler loads `@graview/core/typing` itself, so `graview serve` and `graview preview` answer `type-text` as the main entry does. The editor is fetched when such a field is opened — with `@graview/core/typing`, which says whether the field is typed together — and keeps its own diff and carry rather than take `@graview/core`'s, so a page carries 0.4 KB more up front (the provider's `typing`, `TypingContext`, the presence's caret), under raises of the hosted page's budgets, the pages face alone's and a visitor's form alone's (`scripts/budget-raises/a-field-typed-together-is-edited-live-*.json`), and the scene face's limit before it draws moves to 994 KB. Primitives' tests hold that a keystroke is sent as a splice and nothing is saved, that a composed word is held and lands with what others typed meanwhile, that a remote splice keeps the caret on its word, that Escape does not put anything back, that ⌘Z takes back only the person's run, that others' carets are drawn and carried, and that prose written whole keeps its Save; ship's, that a caret is told only to a seat that sees its field. `pnpm verify typed-together` types into one long brief from two seats at once with real keystrokes, in three engines: both pages and the store converge, each draws the other's caret where they stand, and a caret stays on its word.
  
  Compatibility: ops and primitives — unchanged. The wire — additive within protocol 1: a presence may carry `caret`, which a server of this build keeps only when well formed and withholds from a seat that may not see its record or field, and which a server before it passes on as any other field a client said; `WIRE_PROTOCOL` does not move. Snapshot and log formats, the declaration and check finding codes, derived tool names and input schemas — unchanged. The JavaScript API — additive: `PresenceCaret` and `Presence.caret` on `@graview/core`; the provider's `typing`, `TypingContext`, `FieldTyping` and `LiveTyping` on `@graview/react`, and `PresenceState.sayCaret`; `EmbedRemote.typing`, called without its remote; `presenceSeenBy`'s optional `seesField`. What Graview Cloud does: takes this build; a host that mounts the embed over its own remote passes that remote's `typing` (an `openRemote` store's own is passed already) and a field typed together is edited live; a host that tells who is here itself and judges sight passes `seesField` to `presenceSeenBy`.
- Updated dependencies [920641e]
- Updated dependencies [8fbe98f]
- Updated dependencies [0956b46]
- Updated dependencies [195aa49]
  - @graview/core@0.1.51
  - @graview/react@0.1.51
  - @graview/primitives@0.1.51
  - @graview/pages@0.1.51
  - @graview/guest@0.1.51
  - @graview/layout@0.1.51
  - @graview/studio@0.1.51
  - @graview/tools@0.1.51

## 0.1.50

### Patch Changes

- 14a74ed: Edits can reach readers when they are published rather than as they are made (Roadmap f-publishing-lifecycle). A declaration says `publishing: { mode: "live" | "on-publish", working: [roles], publishers?: [roles] }` — the document's key, `defineApp`'s, and `StoreOptions.publishing` on a store, which `openStore`, `openRemote`, the embed and the CLIs hand on. `"live"`, or nothing, is every app as it was. Under `"on-publish"` a seat whose roles are `working` (and an agent acting for one) is served the head and edits it in real time; every other seat — a visitor, an embed, a static page from `@graview/pages/static`, another app's linked read, a describe for a reader — is served the app as it stood at the last publish (`pastOf(store, publishedSeq)`, as its sight reaches it), or as it began before the first. Writes always land on the head: a visitor's form answer is in the working state and reaches readers with the next publish. A publish is the built-in act `publish` (`{ through? }`), offered to `publishers` (absent, `working`) and to an agent acting for one: one op by the person who published, touching no record, whose `publishedThrough` says the seq readers are served through, and the last one standing is `Store.publishedSeq` — so undoing a publish takes readers back to the one before. A reader's view follows the published seq and tells its subscribers only when it moves; `pastOf` refuses a reader a moment past it. `seenBy(principal, { as: "published" })`, the provider's `as` and `?as=published` in the page's address show a collaborator what readers see. `unpublished(store)` (`@graview/core/history`) says the gestures waiting, in words, for a badge and a diff. A checkpoint pins the published seq. On the wire a reader's `welcome`, `/graview/state` and `/graview/since` carry `servedThrough` (a cursor, opaque as every position on the wire), its socket is sent the ops between two publishes when the second lands, and the whole state when one is taken back. `graview check` judges a role `publishing` names that the policy does not (`publishing-unknown-role`), nobody working (`publishing-nobody-working`), a publisher not served the head (`publishing-publisher-not-working`) and an app act named `publish` (`publishing-act-taken`); `graview describe` says the mode; the graview-ship skill says how.
  
  Two fixes in the same place. A socket whose `hello` names a seq behind the compaction horizon was sent the ops from the horizon on as though those before had been sent; it is now welcomed with the whole `state`, and `/graview/since` answers such a seq with `reset: true` (and the ops after the horizon, so an older client still sees the gap); `openRemote` takes the state on either. And a seat's view was kept by the person an agent acts for, so a second agent for the same person was handed the first agent's view — its `seenFor`, `wouldChange` and `preview` judged as the first; the view is now kept per agent.
  
  Compatibility: additive — `publishing` (document and declaration), the op field `publishedThrough`, `Store.publishedSeq`, `seenBy`'s options, the wire's `servedThrough` and `reset`, an unasked `welcome` with `state`, `PUBLISH`, `onPublish`, `servesReaders`, the entry `@graview/core/publishing` (`publishMutation`, `publishRefusal`, `publishedSeqOf`), `unpublished` and four check finding codes are new, and a live app is served as before. A build that predates publishing refuses a document carrying `publishing` by its path, so an app that publishes is never opened by a build that would serve its readers the head, and folds an op carrying `publishedThrough` as a marker that touches nothing. Ops, primitives, stored formats, the document format version, `WIRE_PROTOCOL` and the derived tools of a live app are unchanged; an `on-publish` app's publishers gain the `publish` tool. A live app's hosted page carries 2.0 KB more up front (1.8 KB handed a compiled app), the pages face and a visitor's form about as much — the declaration's `publishing`, who is a reader, the store's hooks for `publish`, the provider's fetch for an app that publishes, and the two fixes above. How a reader is served is its own entry, `@graview/core/publishing`: a server, `@graview/pages/static`, `@graview/core/linked`, the command line and the agent tools import it, and a page fetches it with `@graview/core/past` before it draws an app that publishes; until it is loaded a reader of such an app is refused, never served the head, and the store offers no `publish`. Graview Cloud's worker imports 18.9 KB more (2_017_361 bytes against 1_997_994); its byte budget is 2_250_000.
- 5edb2e7: The Suggested tray offers Not now beside Accept and Decline. It hides a suggestion from the person who pressed it until tomorrow, and keeps that as a `Dismissal` in the host's store of the person's own state (`dismissals`: `{ list, dismiss, onChange? }`, a `DismissalStore`, on `GraviewProvider`, `mount` and `PagesApp`). Without one, the tray keeps it in this browser: localStorage where the page may use it, else the page's memory. The log says nothing of it, so the suggestion still waits for everyone else and the app's own actor is held to nothing; Decline still answers for everyone. What the button does is said to a screen reader, and when a row settles the keyboard moves to the next row, or to Activity, never to `<body>`. Given what the app's own actor did while the person was away (`whileAway`: `{ tidied, waiting? }`, which `whileAway()` from `@graview/tools/tidy` returns), the tray says "One suggestion waiting · tidied 12 things while you were away", and it still draws when nothing waits but something was done. A seat gets the same answer as a tool: `withNotNow(runtime, dismissals)` from `@graview/tools` lists `dismiss_suggestion` (with `until`, an ISO time, if the person names one) and leaves what the person dismissed out of `list_suggestions`. The chat and the agent seat wrap their runtimes with it. It wraps the runtime instead of living in it, so the names Graview Cloud's worker imports stay at 1_999_652 bytes of their 2 MB. Activity folds everything one run of the app's own actor applied (`Lineage.run`) into one row, wherever a person's change fell between its batches, and says a run made overnight that ended today as "Tidied 12 things overnight". Where an actor gave no run, consecutive batches fold as before. A hosted page carries 0.1 KB more up front for it (105 bytes, 51 gzipped), and the scene face 480 more before it draws.
  
  Compatibility: additive. `dismissals` and `whileAway` are optional props, a host that passes neither gets the tray in this browser, and `dismiss_suggestion` is listed only by a runtime wrapped with `withNotNow`. The digest row a run makes is new: Activity rows for an actor that gives no `run` fold as before, and `ActivityRow`'s digest gains an optional `run`. Ops, stored formats, the wire, the document format and the tool schemas a bare `createToolRuntime` lists are unchanged.
- Updated dependencies [1f7fd19]
- Updated dependencies [d871ec9]
- Updated dependencies [a2ae894]
- Updated dependencies [14a74ed]
- Updated dependencies [5edb2e7]
- Updated dependencies [cd50cab]
- Updated dependencies [46dc821]
  - @graview/core@0.1.50
  - @graview/react@0.1.50
  - @graview/tools@0.1.50
  - @graview/primitives@0.1.50
  - @graview/guest@0.1.50
  - @graview/pages@0.1.50
  - @graview/layout@0.1.50
  - @graview/studio@0.1.50

## 0.1.49

### Patch Changes

- Updated dependencies [1c1bfcd]
- Updated dependencies [81a6028]
- Updated dependencies [8993971]
- Updated dependencies [ec8c429]
- Updated dependencies [ee70d83]
- Updated dependencies [69b9046]
- Updated dependencies [9dab8bb]
- Updated dependencies [4ca00a7]
- Updated dependencies [1f80e4a]
- Updated dependencies [908367d]
- Updated dependencies [5f1603f]
- Updated dependencies [1c1bfcd]
  - @graview/tools@0.1.49
  - @graview/core@0.1.49
  - @graview/studio@0.1.49
  - @graview/guest@0.1.49
  - @graview/primitives@0.1.49
  - @graview/pages@0.1.49
  - @graview/react@0.1.49
  - @graview/layout@0.1.49

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
  - @graview/primitives@0.1.48
  - @graview/tools@0.1.48
  - @graview/pages@0.1.48
  - @graview/guest@0.1.48
  - @graview/layout@0.1.48
  - @graview/react@0.1.48
  - @graview/studio@0.1.48

## 0.1.47

### Patch Changes

- fbb080a: A place is said drawn once its lens has drawn, so `graview shots`, `graview preview`'s pages and a host waiting on `data-graview-drawn` or `onDrawn` picture the lens rather than its page's head over nothing. Threat Watch's What to do place — a blocks lens declared in the document — was photographed as its title, "8 remediations." and "All remediations as a list", with the rest of the page blank: the lens's module had arrived, so nothing was said to be on its way, but React reveals a part that suspended in a commit it holds back up to 300 ms after the page around it first drew, and the page had been still long enough to be said settled (about 310 ms after load, the rows drawn at about 380). Now each part that suspends on a watched place — a lazy module's part, and a component behind `lazyPart` — is waited for until it has drawn there, or said it did not arrive; a place left before such a part drew does not hold up the next one. The place is said drawn about 240 ms after its lens draws, and a move between places still settles in about 300 ms. A hosted page carries 0.9 KB more up front for it (0.3 KB gzipped; the compiled page too), and both budgets are raised by that.
  
  Compatibility: ops, stored formats, the wire, the declaration, check findings and derived tools are unchanged. New on `@graview/react` and `@graview/react/provider`: `PartsWatch`, `PartsWatchContext`, `createPartsWatch`, `partsWatchMoved`, `partsWaiting` and `lazyPart` (`React.lazy` whose part is waited for until it has drawn). `data-graview-drawn` and `onDrawn` keep their meaning and come later only where a part was still to be drawn. What Graview Cloud does: nothing — describe_place's pictures of a declared lens's place show the lens without a wait of its own.
- ed05ba4: A worker view is as tall as it draws on every face, and on the Scene a tall one is a card with Open rather than a column three screens tall. The host measures the drawn root (`[data-graview-view-root]`, now a block of its own so its height holds its children's margins) with a `ResizeObserver` and keeps that as the view's content height — on the region as `data-graview-content-height`, on the handle as `contentHeight`, and told to the face through `mountWorkerView`'s `onContentHeight`; a view never says its own height. On Pages a titled view's place, the home and a record's page already flowed with the page at that height (0.1.46), and still do. On the Scene a view of a kind's members was drawn as the whole of itself in its place's box — sixty rows spilling up under the bar and down past every card around it, with nothing behind them. `registerWorkerView` now marks such a view previewed (`markPreviews`, read by `previewOf`), and the Scene draws it as a card like its other pictures: its title, as much of the view as the box holds — at most its measured content height — the foot fading into the card's ground where there is more, and Open, which goes to its place on Pages (`PageDoorContext`, which the embed provides with the address of the page). Nothing in the card scrolls. Two manifest hints say otherwise: `flows: false`, for a fixed canvas such as a map or a chart, keeps its place's frame on Pages; `scene: { maxHeight }` holds its Scene card lower, 80 to 4000 pixels. `checkManifest` judges both in sentences and refuses either where it means nothing (a frame for a view that is no place, a Scene card for a view of one record). `graview-worker-view` says how a view is sized on each surface and the two hints. `guest`'s tests find the hints taken and refused, a view of the members marked previewed with its `maxHeight`, and a view that says `flows: false` drawn in its place's frame; `react`'s find a card held to its box at the height its host measured, faded and with Open where there is more, Open going to the place without choosing the card, no Open where there are no pages, and no fade where the card holds it all. `verify-address` opens a view eighty entries long on the Scene at 1440 and 390 and finds it a card no taller than its box and inside the window, at its measured height, faded, with nothing in it scrolling, and Open landing on its place, flowing whole (aTallViewOnTheSceneIsDrawnBoundedWithOpenAndOpenLandsOnItsPlace), and a view that says `flows: false` and `scene.maxHeight` held to both (aViewThatSaysFlowsFalseKeepsItsFrameAndItsScenePreviewKeepsToItsMaxHeight). A hosted page carries 0.5 KB more up front (469 bytes, 75 gzipped; 127 on the page handed a compiled app), the scene face 3_020 bytes more before it draws, the guest host registering a worker view 1_411 (352) and drawing one on the open kit 1_570 (420), under raises of those budgets by that (`scripts/budget-raises/a-view-is-as-tall-as-it-draws-*.json`).
  
  Compatibility: additive in the API — the manifest's `flows` and `scene`, `WorkerView.contentHeight`, `MountWorkerViewOptions.onContentHeight`, and `@graview/react`'s `markPreviews`, `previewOf`, `PREVIEWS`, `ViewContentHeight` and `PageDoorContext`; a manifest without the hints is judged and drawn as before on Pages. On the Scene a worker view of a kind's members is now drawn as a card held to its box with Open. The wire, the stored formats and the derived tools are unchanged.
- f85abad: A worker view's link in an embed carries the host's own address, or none, and a focus ring at the edge of a view's region is drawn whole. In an embed whose host keeps its own addresses — memory routing, a chat's widget, an article — an `<a data-record>` carried the routed face's base and path as its `href` (`/tasks/t1`), so a Cmd-click opened a page of the host's site that may not exist. The embed now takes `hrefOf(path)`, the host's address for a page of the app, and a view's links, the bar's places and the Scene's Open carry what it returns; under memory routing with none given they carry no `href`, and a view's link is a link by its role and a tab stop, as on the scene, followed in the app on a click, a tap and Enter. Under address routing they carry the face's own address unless the host says otherwise. `PagesApp` takes the same `hrefOf`, or `false` for no address; `PageDoor.href` may answer none, and the Scene's Open is then a link by its role. And a worker view's region clips what the view draws to its box, which cut the ring of a control flush with its edge in half: while something in it has the keyboard the region lets the ring's reach — its 2px and its 2px offset — paint past its edge (`overflow-clip-margin`, in Chromium and Firefox) and nothing else, still contained, isolated and clipped; in WebKit, which has no `overflow-clip-margin`, a control found within that reach of the edge as it takes the keyboard draws its ring inside its own edge. A Scene card's body clips only its top and foot, and lets the ring past them while the keyboard is in it.
  
  `embed`'s tests find a view's link given no address under memory routing, the host's under `hrefOf`, and the face's own under address routing; `guest`'s find the region letting the ring past while the keyboard is in it and, in an engine without `overflow-clip-margin`, a control at the edge marked to draw its ring inside. In the taps transport, in Chromium, WebKit and Firefox, Threat Watch is mounted with the host's addresses (`/?at=<path>`): its `<a data-record>` carries the host's address, a Cmd- or Ctrl-click opens the host's page there on the threat's page, and a plain click opens it in the app; mounted with none, the link carries no `href`, is a link by its role and a tab stop, and Enter opens the threat's page; and a link flush with the region's left edge, given the keyboard, shows all four sides of its ring. `graview-embed` and `graview-view-links` say so. A hosted page carries 44 bytes more up front (0.0 KB more up front, 47 gzipped; 44 / 60 on the page handed a compiled app), and the guest host drawing a worker view on the open kit 647 bytes more (235 gzipped), under raises of those budgets (`scripts/budget-raises/a-views-link-carries-the-hosts-address-*.json`, `a-views-ring-is-whole-at-its-regions-edge-open-kit.json`).
  
  Compatibility: additive for a host — the embed's and `PagesApp`'s `hrefOf` are optional; under memory routing an embed's view links and the Scene's Open carry no `href` unless the host gives `hrefOf`, where they carried the face's own path; under address routing nothing changes. `PageDoor.href` may return `undefined`. The wire, the stored formats, the declaration and the derived tools are unchanged.
- Updated dependencies [6d84721]
- Updated dependencies [7478654]
- Updated dependencies [fbb080a]
- Updated dependencies [f85abad]
- Updated dependencies [ed05ba4]
- Updated dependencies [6f9bf30]
- Updated dependencies [6f9bf30]
- Updated dependencies [f85abad]
- Updated dependencies [6f9bf30]
- Updated dependencies [b92340d]
  - @graview/core@0.1.47
  - @graview/guest@0.1.47
  - @graview/pages@0.1.47
  - @graview/primitives@0.1.47
  - @graview/react@0.1.47
  - @graview/layout@0.1.47
  - @graview/studio@0.1.47
  - @graview/tools@0.1.47

## 0.1.46

### Patch Changes

- Updated dependencies [15f234f]
- Updated dependencies [99d25eb]
  - @graview/core@0.1.46
  - @graview/guest@0.1.46
  - @graview/pages@0.1.46
  - @graview/primitives@0.1.46
  - @graview/layout@0.1.46
  - @graview/react@0.1.46
  - @graview/studio@0.1.46
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
- Updated dependencies [8ab4fa2]
  - @graview/guest@0.1.45
  - @graview/core@0.1.45
  - @graview/pages@0.1.45
  - @graview/primitives@0.1.45
  - @graview/react@0.1.45
  - @graview/layout@0.1.45
  - @graview/studio@0.1.45
  - @graview/tools@0.1.45

## 0.1.44

### Patch Changes

- Updated dependencies [68b7837]
- Updated dependencies [f750ed3]
- Updated dependencies [10ea092]
- Updated dependencies [2f524d0]
  - @graview/core@0.1.44
  - @graview/primitives@0.1.44
  - @graview/pages@0.1.44
  - @graview/guest@0.1.44
  - @graview/layout@0.1.44
  - @graview/react@0.1.44
  - @graview/studio@0.1.44
  - @graview/tools@0.1.44

## 0.1.43

### Patch Changes

- Updated dependencies [3c6b0fa]
  - @graview/core@0.1.43
  - @graview/react@0.1.43
  - @graview/guest@0.1.43
  - @graview/layout@0.1.43
  - @graview/pages@0.1.43
  - @graview/primitives@0.1.43
  - @graview/studio@0.1.43
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
  - @graview/primitives@0.1.42
  - @graview/pages@0.1.42
  - @graview/guest@0.1.42
  - @graview/studio@0.1.42
  - @graview/react@0.1.42
  - @graview/layout@0.1.42
  - @graview/tools@0.1.42

## 0.1.41

### Patch Changes

- Updated dependencies [408a1d9]
  - @graview/primitives@0.1.41
  - @graview/pages@0.1.41
  - @graview/studio@0.1.41
  - @graview/core@0.1.41
  - @graview/guest@0.1.41
  - @graview/layout@0.1.41
  - @graview/react@0.1.41
  - @graview/tools@0.1.41

## 0.1.40

### Patch Changes

- b98303b: A face names what its first draw opens, and a hosted page on a phone draws Pages with no chunk asked for after the face's own (FR-194). Graview Cloud names in its page's head every chunk its shell's startup doors open, but a face opens doors of its own as it draws — on the pages the home's lenses, a list's arranging, the bar's Activity and a form's date box; on the scene the relations' ribbons, the city's ground, the districts' states and the way back — each found only once the face had run, a round trip after it on a phone. And what is fetched before it is wanted went out while the place was still drawing: the acts' pane, readied by the keyboard the page put on a title and drawn on every routed page for a selection it draws nothing for there, a date's editor, the other face at a desk. `pnpm verify first-load` counted 41 to 45 scripts asked for after the face on the preview's home and list before the place said `data-graview-drawn`.
  
  They stay doors — a page that never draws a lens never runs one — and `@graview/embed/first-draw`, a new entry for a host's build, names them: `firstDrawChunks(metafile, face)` reads esbuild's metafile and returns the chunks a face's first draw asks for, each door's chunk and every chunk it imports outright, and `FIRST_DRAW_DOORS` is the list it reads, each door `{ package, module }`. `graview preview`'s page asks for them from its head once the face's own chunks have arrived (named beside the face, they took a phone's bandwidth from it and the face drew 0.65 s later). What is fetched early now waits until the place has first drawn and settled (`afterFirstDraw`, `firstDrawn`, `placeWatched` and `placeDrawn` on `@graview/react` and its `/provider`, said by the embed's drawn signal; at once where nothing watches a place), the keyboard put on the page as it draws readies no menu, and the routed face no longer draws the acts' pane for a selection.
  
  Measured by `pnpm verify first-load`, three cold runs on a phone (four times slower CPU, slow 4G), before and after: the roadmap draws and settles in 4.50 s, from 4.96 s, and is interactive in 4.85 s, from 5.30 s; the tasks settle in 4.63 s, from 5.12 s; the first useful paint is unchanged (3.55 s and 3.49 s). Before the home has drawn the roadmap asks for 75 requests and 478 KB, from 78 and 495 KB, and nothing after the face, on both profiles and both apps (`…DrawsPagesWithNoChunkAskedForAfterTheFace`, a new claim of the harness, which also says the time to `data-graview-drawn`). A hosted page carries 0.3 KB more up front for it (307 bytes, 132 gzipped; the compiled page 307 and 143), under a raise of each budget by that, and the scene face 413 bytes more before it draws. `capabilities().shipped` gains FR-194.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` gains FR-194. New: the `@graview/embed/first-draw` entry (`firstDrawChunks`, `FIRST_DRAW_DOORS`, and the types `FirstDrawFace`, `FirstDrawDoor`, `FirstDrawMetafile`), and `afterFirstDraw`, `firstDrawn`, `placeWatched`, `placeDrawn` on `@graview/react` and `@graview/react/provider`. The acts' pane, a date's editor and the other face are fetched once an embed's place has first drawn rather than at the first idle moment. What Graview Cloud does: at build, `firstDrawChunks(metafile, face)` for the face the shell opens on (`"pages"` on a phone, `"graview"` at a desk), less the chunks the head already names, and asks for them once the face's own `modulepreload` links have loaded, as `graview preview`'s head does.
- b4788c0: The scene face, mounted at its root, opens on the overview (from Graview Cloud). `mount(stage, { face: "scene", routing: "memory" })` opened on the scene descended on nothing — a near-empty floor, the kinds' tiles along its foot — where `graview preview`, at `/places/overview`, opens on the whole thing from above; under `routing: "address"` at a bare base it drew that floor first and rose only once the scene's address sync arrived. Now a scene with nowhere to be — no `stop` (in the address or handed), no place handed back (`at`), no `path` but the overview's, no first place in the declaration (`pages.first`) — opens on the overview from its first frame, as the scene does when "Up" is pressed: `where()` says `{ face: "scene", path: "/places/overview", stop: "#overview=1" }`, and a stop set then or later goes down to it as before. A host that passes a stop, a page's path or a place handed back is drawn what it asked for. `path` is documented for the scene face: nothing, or `/places/overview`. A hosted page's first load carries 0.1 KB more (under 0.1 KB gzipped).
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. What a host sees: a scene mounted with no stop is at altitude, its `where().stop` `#overview=1` where it was `#`. What Graview Cloud does: nothing; a stage that mounts the scene face with no path opens on the overview, as preview does.
- 6fc222b: The scene sits under a host's own bar. A product face with its own shell wanted the scene in it: `mount(stage, { face: "scene", bar: true })` worked, but its bar said the app's name a second time under the product's and offered a Scene | Pages switch whose Pages were Graview's derived pages, not the product's own, so the product hid both with CSS. `bar` now also takes what it leaves out (`EmbedBar`): `bar: { faces: false, name: false }` draws the bar without the switch or the app's mark and name, and keeps the scene's places, Find, the standing (Activity beside it once anything has happened) and the person; either may be said alone. `@graview/embed/pages` takes `bar: { name: false }` the same way. `AppBar` takes `named` (`true` by default), and a bar with no switch on the scene names the scene's places, as one with a switch did. A hosted page carries 0.1 KB more up front for it (143 bytes, 70 gzipped, the compiled page the same), under a raise of each budget by that; the pages face, the embed without the studio, every face and the embed with the studio are raised by what they measured. The embed's README and the graview-embed and graview-host-page skills say it.
  
  A scene at a route of the pages' own registry (`PagesApp` drawing the scene under the host's shell) is not here: the scene face is the embed's, under its `GraviewProvider`, its inspector, its map panel and its rules, and `@graview/pages` may not import the scene; it would take an embed-side page component that wraps the provider over the page context's store and draws the scene face, registered by the host with `registry.route(path, …)`, with the scene's stop kept apart from the router's address. Until then a product mounts the embed at that route with the bar above.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. Additive on the embed's options: `bar` takes `boolean | EmbedBar`, `EmbedBar` being `{ faces?: false; name?: false }`, on `mount` and `<Embed>` from `@graview/embed` and on `mount` and `<PagesEmbed>` from `@graview/embed/pages`; `EmbedBar` is a new type export of both. `bar: true` and `bar: false` draw what they drew. With `faces: false` the bar has no `[data-testid="app-faces"]`; with `name: false` no `app-home` and no `app-name`. What Graview Cloud does: a product face with its own shell mounts the scene with `bar: { faces: false, name: false }` and `heading: false`, and drops the CSS that hid the name and the switch.
- Updated dependencies [d2ef34e]
- Updated dependencies [b5c1332]
- Updated dependencies [b98303b]
- Updated dependencies [bdb45b6]
- Updated dependencies [686b2e4]
- Updated dependencies [4088496]
- Updated dependencies [2ff7c28]
- Updated dependencies [56b88e1]
- Updated dependencies [4aa429f]
- Updated dependencies [752da2b]
- Updated dependencies [c3b7ab9]
- Updated dependencies [6fc222b]
- Updated dependencies [68ebfd2]
- Updated dependencies [8c8a486]
- Updated dependencies [6959652]
  - @graview/primitives@0.1.40
  - @graview/core@0.1.40
  - @graview/guest@0.1.40
  - @graview/react@0.1.40
  - @graview/layout@0.1.40
  - @graview/tools@0.1.40
  - @graview/pages@0.1.40
  - @graview/studio@0.1.40

## 0.1.39

### Patch Changes

- 099209c: A draft view is swapped in place, so a host picturing several proposals does not mount again for each (FR-187). `draftView` was read once, at `mount`; to picture the next proposal a host unmounted the embed and mounted it again, losing the store and the place and waiting for the whole page to draw from nothing. Now `handle.setDraftView(draft)` draws another draft where it attaches, and `handle.setDraftView(null)` the app's own views again, on the whole embed and on the pages alone: the store, the place and the seat stay, `data-graview-drawn` comes off in the call and comes back — `onDrawn` told again — once the new draft has drawn and settled. A draft handed after the embed first drew, before the worker's host is here, is drawn in once the host arrives, and the place is not said drawn until it is; the embed is never drawn again from nothing for it. `<Embed>`'s `draftView` follows its prop the same way. A draft under a base path — the page the app, served at `/a/<app>` — is drawn at `/a/<app>/places/<title>`, the attribute's value the place's path within the app; `graview preview` serves at its root and takes no base. A hosted page carries 0.5 KB more up front for it (the compiled page too), and their budgets are raised by that; the embed, the studio handed in and every face by what they measured.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. New: `setDraftView(draft | null)` on `EmbedHandle` (and `PagesEmbedHandle`); `draftView` on `mount` and `<Embed>` takes `null`. What Graview Cloud does: picture each proposal in one page — `handle.setDraftView(proposal)`, then wait for `[data-graview-drawn]` — rather than a page per proposal.
- 79a3dfd: A frame guest holds back the page's drawn signal until it has drawn (FR-188). The embed's root said `data-graview-drawn` once every worker view on the place had drawn or failed, but a frame guest (`guestView({ url })`, the sandboxed iframe) was not counted, so a place drawn by one was pictured with its frame still empty. Now the frame says `data-guest-view-drawn` once the guest has said it is ready, been handed what it shows (and the pictures it asked for) and asked for its height — what the frame protocol says once it has rendered — or stayed quiet for 250 ms after, for a guest that never asks one; and `data-guest-view-failed="silent"` when it does not say it is ready in `limits.readyMs` (8 s by default, a new limit of `mountGuestView`), so a frame that never loads counts as settled rather than holding the page to its ten seconds. A guest that says it is ready after all is drawn then. The frame is `aria-busy` until one or the other, and `guestView`'s holder is until the frame's host has drawn the frame in it, which is what the embed already waits for. A hosted page carries 0.0 KB (28 bytes) more up front for it (the compiled page too), and their budgets are raised by that; the guest host before a worker is drawn and every face by what the frame's host now measures.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; the frame protocol says nothing new. New: `limits.readyMs` on `mountGuestView` and `guestView`; the frame's `data-guest-view-drawn`, `data-guest-view-failed="silent"` and `aria-busy`, and `aria-busy` on `guestView`'s holder until its frame is drawn. What Graview Cloud does: nothing more — `[data-graview-drawn]` now waits for a place's frame guests too.
- 1d365af: A page opens on a view proposed and not kept, so a proposal can be seen before it is kept (FR-187). `propose_view` tries a view headless and answers in words; an agent that wanted to see it at 390 px in dark had to keep it first, because the hosted page drew only the app's views. Now `mount` takes `draftView` (`EmbedDraftView`: a worker view's `manifest` and its `source`, or `worker`, with what else a `WorkerViewDefinition` takes) and draws it for the seat at the keyboard where its manifest attaches — the home, a kind's list at the place its title names, each record's page — under one line, "Draft — <title> · Not kept", in a group named "Draft: <title>" (`[data-graview-draft-view]`), as the seat's drawn panel is marked on `/~draft`. A kept view of the same name is the one it stands in for: whatever the host's `views` registers under that name is left out, so it is drawn nowhere beside the draft. Nothing of it is kept: it goes by no name the place menu or `keptViews` could keep it under, the store is not written, and the next page, handed no draft, has none. A draft that is stopped says why in its place instead of standing the kind's own face there, and playback draws it as proposed. With FR-188's `data-graview-drawn`, a host pictures it once it has drawn. `registerWorkerView` takes `draft: true` on the definition for a host that registers one itself. `graview preview` and `graview shots` take one as `--view <view.js> --manifest <manifest.json>`, handed to the page with the document (`servePreview`'s `draftView`). The worker's host is fetched before the embed draws, and only when a draft is handed: a hosted page carries 0.7 KB more up front for it (the compiled page too), and their budgets are raised by that; the pages face, the embed, the studio handed in and the guest host registering a view by what they measured, and every face, counted with every chunk, by the worker's host and the open kit it can now fetch. `capabilities().shipped` gains FR-187.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` lists FR-187. New: `draftView` on `mount` and `<Embed>`, `EmbedDraftView` on `@graview/embed`, `WorkerViewDefinition.draft` on `@graview/guest/host/views`, `PreviewOptions.draftView` on `@graview/ship`; `/graview/document` from `graview preview` carries `draftView` when one was given. `@graview/embed` depends on `@graview/guest`. What Graview Cloud does: serve a proposed view once — a one-time draft id on the picture's address, say, that the shell trades for the manifest and source — and pass it to `mount` as `draftView`, then picture the address where it attaches once `[data-graview-drawn]` is on the root.
- 3bfdf76: The page says when a place has drawn and settled (FR-188). A host picturing a place headless waited on a guess — its opening frame gone, the network quiet, then 600 ms — and a font, an image or a worker view that came later than that was pictured half drawn. Now once the place the reader is on has drawn and settled — its face here, every part drawn on it arrived or said it did not, the fonts and images loaded, each worker view drawn or stopped (what stands in its place drawn), and nothing moving for 200 ms — the embed's root wears `data-graview-drawn`, its value the place's path, and `mount`'s `onDrawn(place)` is told the place as `where()` says it (`EmbedWhere`: face, path, stop). A move to another page, another stop on the scene or another face takes the attribute off in the commit that moves, and the next place puts it back as it settles; a place that never stops moving is said drawn after ten seconds all the same. `DRAWN_ATTRIBUTE` names it on `@graview/embed`, and `graview shots` waits for it before each picture where it waited 0.7 s, or 1.8 s on the scene. A worker view's region says `data-worker-view-drawn` once it has drawn what it was last shown with no picture still being fetched for it; `partsArriving()` on `@graview/react` counts the parts drawn and still on their way, and `partArriving(load)` counts a loader of one's own. `onDrawn` was told the face once it was on the page (FR-57); that is `onFaceDrawn` on `<Embed>` now, and `handle.drawn()` still waits for it. A hosted page carries 2.3 KB more up front for it (the compiled page too), and their budgets are raised by that, and the pages face, the embed, every face and the open kit's host by what they measured. `capabilities().shipped` gains FR-188.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` lists FR-188. `mount`'s `onDrawn` is handed the place (`EmbedWhere`) where it was handed the face, and is called once the place settles rather than when the face is first committed; a React host that wanted the old call passes `onFaceDrawn` to `<Embed>`. What Graview Cloud does: in `pictures.ts`, wait for `#graview-app [data-graview-drawn]` (or its value, the address pictured) in place of the opening's absence, network idle and the 600 ms settle.
- 099209c: The pages alone say when a page has drawn, and open on a draft view, as the whole embed does (FR-188, FR-187). `@graview/embed/pages` — a chat's widget, a phone's page — took neither `onDrawn` nor `draftView`, so a host picturing a proposal there guessed when it had drawn and could not draw the proposal at all. Now its `mount` takes `onDrawn(place)` and its root wears `data-graview-drawn` (the page's path) once the page has drawn and settled, off in the commit that moves; and it takes `draftView`, drawn where the manifest attaches and marked "Draft — <title> · Not kept", kept nowhere, the worker's host fetched before the pages draw and only when a draft is handed. Both come from the same code as the whole embed's: what watches the place is one hook (`drawn.ts`), and the draft's registration one module (`draft.ts`). `DRAWN_ATTRIBUTE` and the `EmbedDraftView` and `EmbedWhere` types are on `@graview/embed/pages` too. And the pages alone go where `handle.setPath` sends them when they were mounted without a `path`: the routed face took the first path a host handed after it opened for the one it began at, and stayed. The pages face alone measures 3.5 KB more (1.7 KB gzipped) for them, and its budget is raised by that; nothing of it is in a hosted page.
  
  Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. New on `@graview/embed/pages`: `onDrawn` and `draftView` on `mount` and `<PagesEmbed>`, `setDraftView` on its handle, `DRAWN_ATTRIBUTE`, and the types `EmbedDraftView` and `EmbedWhere`. `PagesApp` follows its `path` prop from any value, not only from the one it was first drawn with. What Graview Cloud does: a widget on `@graview/embed/pages` waits for `[data-graview-drawn]` as the hosted page does, and passes `draftView` there too.
- Updated dependencies [77a235a]
- Updated dependencies [e577880]
- Updated dependencies [79a3dfd]
- Updated dependencies [f3af490]
- Updated dependencies [1d365af]
- Updated dependencies [6bff55b]
- Updated dependencies [99ed9e7]
- Updated dependencies [c9c13d2]
- Updated dependencies [817aaba]
- Updated dependencies [3bfdf76]
- Updated dependencies [099209c]
- Updated dependencies [328235d]
  - @graview/core@0.1.39
  - @graview/guest@0.1.39
  - @graview/pages@0.1.39
  - @graview/primitives@0.1.39
  - @graview/react@0.1.39
  - @graview/layout@0.1.39
  - @graview/studio@0.1.39
  - @graview/tools@0.1.39

## 0.1.38

### Patch Changes

- 28a63eb: A status board moves a card without a button under it, and the shipped lenses take search, filter and column options (Roadmap f-board-move-without-buttons, f-lens-search-filter). A Move… button under every card doubled a board's height, and the Recon app's Actions board could not be searched without a hand-drawn view that could not drag. A card is now dragged, carried by the keyboard — Space picks it up, the arrows carry it between and along the columns, Space drops it and Escape puts it back, each step said in a live region ("Public forms, picked up. Planned, 2 of 16.") — or moved from its own menu's "Move to ›", which lists every other column: the ones this seat may move it to, and the withheld ones struck through with the reason a press would meet (`columnChoices` on `@graview/core/describe`). The card stays one stop for Tab and says how it moves. `add-lens` and a declared or TypeScript `columns` lens take `options`: `search` (the fields Find looks in), `filters` (fields and relations standing as chips), `move` (the Move button back), `collapsed` and `hidden` (columns, by value), and `cap` (the newest cards a column keeps, with "Show N more"). A board of more than twenty cards shows Find without being asked; a smaller one shows it when `search` names its fields. A narrowed card moves as before. A calendar and a coverage take `search` and `filters` too. `graview check` says an option the kind cannot honor as `lens-option`, and `add-lens` refuses it. Up front a hosted page carries 0.7 KB more (722 bytes, 0.6 KB handed a compiled app), the options a declared lens is held to.
  
  Compatibility: a declaration gains the `columns` lens's `search`, `filters`, `move`, `collapsed`, `cap` and `hidden` options and the calendar's and coverage's `search` and `filters`, and `graview check` gains the warning `lens-option`; every declaration that compiled still compiles, and ops, stored formats, the wire and derived tools are unchanged.
- 91f5168: A view is hidden, shown, deleted and restored from the place menu. Views pile up as chats draw them, and the person annoyed by the clutter is standing at the places drop-down: now the place you are on in the bar, and each place in its drop-down, open the Pages menu — a right-click, Shift+F10 or the menu key, a finger resting on it — with Hide and Delete for a view. Hide takes it off the places, the scene's places and the home's gallery for everyone, still at its address; the drop-down's foot lists it under Hidden with Show. Delete takes it out of every face and lists it under Recently deleted with Restore, and the day it is gone for good, thirty days on; deleting the place you are on takes you to its kind's own place, else home, on Pages and the scene alike. A script view a chat drew is the host's: `mount`'s new `keptViews` (and the whole-page `Shell`'s, and `GraviewProvider`'s) (`KeptViews` from `@graview/core`: `current()`, `onChange`, `hide`, `show`, `remove`, `restore`, and `lens`) is where the page asks, and `current().may` says what this viewer may — the views a chat drew for an owner or an editor, the declaration's lenses for the owner. A declared lens is hidden with `set-lens-hidden` and deleted with `remove-lens`, handed to `lens` as a change to the declaration the host writes with its rollback. `registerWorkerView` registers a view under its manifest's `name` and `registerDeclaredLenses` marks a lens `declared`, which the menu reads; a view the app's own code registers is offered neither. A served store answers `/graview/views` (`createStoreHandler`'s `views` and `mayTidyViews`, `remoteViews` from `@graview/ship/browser` for the page), `graview serve` keeps what was tidied in `views.json` beside the store, `graview preview` writes a declared lens's change into the document it holds, and `devViews()` from `@graview/ship/dev` is the dev server's door. `memoryViews` and `placeTidying` (whether this viewer may tidy a place, and how) are on `@graview/core`, and `useTidiedViews` — the registry as the host's tidying leaves it — on `@graview/react`. A page carries only what hears the gesture and says the drop-down's foot has something to list: which place, whether a finger rested, what a press on the menu's rows does, the toast, the foot and the tidying are fetched on first use, and the registry's tidying only once the host lists something hidden or deleted. A hosted page carries 1.7 KB more up front for it (the compiled page too); their budgets are raised by that, and the pages face, the embed, every face and the guest host by what they measured.
  
  Compatibility: ops, stored records, the declaration and derived tools are unchanged. The wire: a new route, `/graview/views` (GET what is hidden and recently deleted and what the asking seat may do; POST `{ hide | show | remove | restore: name }` or `{ lens: set-lens-hidden | remove-lens }`), and `createStoreHandler` takes `views` and `mayTidyViews`; every other route answers as before. New: `KeptViews`, `KeptViewsState`, `KeptViewsMay`, `RemovedView`, `LensTidyEdit`, `memoryViews`, `placeTidying`, `NO_KEPT_VIEWS`, `REMOVED_VIEW_DAYS` and `removedLensName` on `@graview/core`; `ViewMeta`, `ViewRegistration` and `Place` take `name` and `declared`; `keptViews` on the embed, the pages embed, `Shell` and `GraviewProvider`, `GraviewContextValue.keptViews`, `KeptViewsProvider`, `useTidiedViews` and `PLACE_MENU_EVENT` on `@graview/react`; `ViewTidyingSections`, `useViewTidyingSection`, `TidyGroups`, `useTidied`, `placeAfter`, `useKeptViewsState`, `placeGesture`, `openPlaceMenu`, `placeAim` and `PLACE_MENU_EVENT` on `@graview/primitives`; `answerViews`, `keepsTheApp`, `remoteViews`, `fileViews` and `VIEWS_PATH` on `@graview/ship`, `devViews` on `@graview/ship/dev`. What Graview Cloud does: keep each app's hidden view names and its deleted views (with the definition and its versions, thirty days, then gone), answer `KeptViews` for the viewer with `may` from their share (owner and editor: views; owner: lenses), write a lens's edit as a change with its usual undo, keep registering a deleted view's definition while it is kept so Restore brings it back in place, and pass the object as `keptViews` to `mount`.
- c0db7ab: The embed without the studio carries a few bytes more than the 0.1.38 batch's own raises add up to: its branches each measured alone, and together share less than each assumed.
  
  Compatibility: no surface changes.
- Updated dependencies [28a63eb]
- Updated dependencies [31da4db]
- Updated dependencies [91f5168]
- Updated dependencies [5bd37dc]
- Updated dependencies [b321ddf]
- Updated dependencies [7d0e6b2]
- Updated dependencies [9c45f5d]
  - @graview/core@0.1.38
  - @graview/primitives@0.1.38
  - @graview/pages@0.1.38
  - @graview/react@0.1.38
  - @graview/tools@0.1.38
  - @graview/layout@0.1.38
  - @graview/studio@0.1.38

## 0.1.37

### Patch Changes

- f860e41: A rule's today() is the app's day, not UTC's. Datetimes were said in the app's zone, and `today()` — what a rule, a computed field, a template and a label read — was still the UTC date, so an app in New York turned its day at 8 PM: at 01:30 UTC on Oct 17 a chore due Oct 16 was already overdue over dinner. With `brand.timeZone` declared, today() is the date there, and the day turns at the app's midnight: a document's rules, computed fields, guards and labels read it from the document's own brand, and a store told the zone (`new Store({ timeZone })`, which `openStore`, `openRemote`, the embed and `graview mcp` pass from the app's brand) is judged on that day, hands it to a rule written as a function in its context, as `openStore` already did, and ticks to it: `tick(now)` takes `now`'s day in that zone, and `tickEachDay` fires at that midnight, 23 hours after the last on the day clocks spring forward and 25 on the day they fall back, at the day's first moment where midnight never happens. A page reads the day of the app it draws, never the reader's zone and never the runtime's, so a server and a page agree on the day for the same app. Without a declared zone, today() is the UTC date, as before, and `openStore` still judges on the host's own date. A host that keeps a store on its own alarm (a Durable Object) passes `timeZone: brand.timeZone` to its store and sets the alarm `untilTheDayTurns(now, store.timeZone)` ahead; a tick at the turn of the day now says what the turn moved, judging what stood on the day the store was last ticked to. `isoToday(timeZone?, at?)` and `dayZoneFor` are exported, `dayOf` and `untilTheDayTurns` take a zone, and `rules-read-the-clock`'s fix says which midnight. The `graview-invariant` skill says so. A hosted page carries 0.7 KB more up front for it (the compiled page too); their budgets are raised by that.
  
  Compatibility: ops, stored records and the declaration are unchanged. An app that declares `brand.timeZone` reads today() as the date in that zone, where it read the UTC date, on every surface and in `graview serve`. `StoreOptions` takes `timeZone` and `Store` has `timeZone`; `dayOf(now, timeZone?)` and `untilTheDayTurns(now, timeZone?)` take a zone; `tickEachDay` reads the store's `timeZone`. A store told its zone hands its day to its rules' context as `today` where neither the call nor its options carry one.
- 7d6f521: Datetimes are said in the app's time zone, and a template can say a time of day. An app declares its zone once, `brand.timeZone` (an IANA name, "America/New_York") on `defineApp`'s brand or a document's `brand`, and every instant kept with a zone (`2026-10-16T14:47:00Z`, `…-04:00`) is said on that clock: in lists, cards, record pages, a rule's sentence, an act's sentence and its echo to an agent, Activity's digest, the static page and the date editor, which reads and keeps an instant on the same clock. A person's zone wins over it where a host passes one — `timeZone` on `GraviewProvider`, the embed and the pages face, beside `locale` — and each reader's own clock is said when neither says, as before. A moment kept without a zone is still the wall time written. Describe templates take `{at | time}` ("10:47 AM") and `{at | datetime}` ("Oct 16, 2026, 10:47 AM EDT"), and a field block takes `as: "time"` and `as: "datetime"`; `{at | date}` and `relative` count an instant's day on the app's clock. An agent's act given `2026-10-16T10:47:00-04:00` echoed "2:47 PM", the server's UTC; a tool runtime handed the app now says it in the app's zone, and a host answering away from any page says its own words in it with `sayingIn({ appTimeZone }, run)`. A view is handed the zone rather than formatted strings: every props push carries `locale` and `timeZone`, for `Intl.DateTimeFormat(props.locale, { timeZone: props.timeZone, … })`, so no view hard-codes a zone again. `graview check` and the document's checker refuse a zone the runtime does not know, or an offset, by name (`brand-time-zone`); `set-brand` sets one (`timeZone`, null clears it), and a diff says "Times are said in America/New_York." `describeApp` says the zone. The `graview-brand`, `graview-node-kind` and `graview-worker-view` skills say so. A hosted page carries 2.0 KB more up front for it (the compiled page too), and the guest host about 0.5 KB; their budgets are raised by that.
  
  Compatibility: ops and stored records are unchanged; the declaration takes an optional `brand.timeZone`, and a declaration without it says every time as before. The check finding `brand-time-zone` is new. The guest wire's props carry `locale` and `timeZone`. `Money` (a block's and a template's `money`) takes `timeZone`; `readableFields` takes `timeZone`; `momentAsRead`, `timeAsRead` and `whenAsRead` take a zone after the locale. `sayIn` takes `readerTimeZone` and `appTimeZone` beside `reader` and `app`. A derived edit's sentence and Activity's digest say an instant's day and time on the page's zone, where they said them on the runtime's clock.
- 4c03643: The switch's Pages goes back to the page Back last landed on. Under address routing a page reached by Back or Forward is the routed face's arrival, which its router reports to nobody, so after a reload on the scene the embed knew no page: from the board, the scene, a reload, Back, Forward and Pages went to the home ("2 tasks and 1 person.") instead of the board. The address bar now hands the embed the page each Back or Forward lands on. With the other fixes of this round, a hosted page carries 0.2 KB more up front, the compiled page too.
  
  Compatibility: no surface changes.
- Updated dependencies [9e00808]
- Updated dependencies [a130326]
- Updated dependencies [7fa2dbc]
- Updated dependencies [cf691f4]
- Updated dependencies [d689fbc]
- Updated dependencies [7d137a8]
- Updated dependencies [9121a9c]
- Updated dependencies [862ab8c]
- Updated dependencies [f860e41]
- Updated dependencies [7441814]
- Updated dependencies [909aad0]
- Updated dependencies [7b50571]
- Updated dependencies [7d6f521]
- Updated dependencies [f97a149]
- Updated dependencies [d689fbc]
- Updated dependencies [34fa7b9]
- Updated dependencies [0d440e2]
- Updated dependencies [e56c351]
- Updated dependencies [f9e81c1]
  - @graview/primitives@0.1.37
  - @graview/core@0.1.37
  - @graview/pages@0.1.37
  - @graview/studio@0.1.37
  - @graview/tools@0.1.37
  - @graview/react@0.1.37
  - @graview/layout@0.1.37

## 0.1.36

### Patch Changes

- Updated dependencies [9f3e1d1]
  - @graview/core@0.1.36
  - @graview/primitives@0.1.36
  - @graview/layout@0.1.36
  - @graview/pages@0.1.36
  - @graview/react@0.1.36
  - @graview/studio@0.1.36
  - @graview/tools@0.1.36

## 0.1.35

### Patch Changes

- Updated dependencies [d33bc19]
- Updated dependencies [ac91d40]
- Updated dependencies [f2666ed]
  - @graview/core@0.1.35
  - @graview/primitives@0.1.35
  - @graview/studio@0.1.35
  - @graview/react@0.1.35
  - @graview/layout@0.1.35
  - @graview/pages@0.1.35
  - @graview/tools@0.1.35

## 0.1.34

### Patch Changes

- 8f09e52: A reader who may do nothing is told how to get in, not shown every act struck through (FR-183). A signed-out visitor on a public app right-clicked an era and the menu said "Nothing you may do with an era — 7 actions withheld" over seven disabled buttons, each with the policy's sentence; the list's foot said "~~Add an era~~ — Not permitted: …"; nothing said how to get the right, and "Notify me…" was offered to `anonymous` and kept a subscription for nobody. A host now says what a signed-out reader could gain: `signIn: { label, run, roles? }`, handed only while the reader is a visitor, on `mount` from `@graview/embed` and `@graview/embed/pages`, on `GraviewProvider` (which the Shell draws under, and a provider inside another takes from the one around it) and on the pages' context. Where every act withheld from the reader is one a member could take — one some role could, or one of `roles`, the roles signing in gives, when the host names them — the context menu and the Inspector on either face, the list's foot and a record's acts say `label` as one press that calls `run` (`data-testid="sign-in"`), in place of the struck acts; the face's own rows (Open, Show in the scene) stay. With `signIn` given, "Notify me" is not offered on the menu, a record's page or after an act, and the seat's chat keeps no subscription. A member lacking one role is still told each act they may not take and who could (FR-16), and so is a visitor where one act is one no role can take. `signInInstead(withheld, signIn)` and the `SignIn` type are exported from `@graview/core`, the same judgment for a page of an app's own. A hosted page, compiled or not, carries 0.2 KB more up front for it, under a raise of 0.3 KB more up front on each of the two budgets. The embed's README and the graview-embed skill say the option. `capabilities().shipped` gains FR-183.
  
  Compatibility: ops, stored formats, the declaration and derived tools are unchanged. The wire is unchanged; `capabilities().shipped` lists FR-183. What Graview Cloud does: pass `signIn: { label: "Sign in to make changes", run }` to `mount` while nobody is signed in, and drop its interim `visitorMenuSections` row and the CSS hiding `[data-testid=withheld]`, `[data-testid=no-affordances]` and `[data-menu-section=notify]`.
- Updated dependencies [5fc86f5]
- Updated dependencies [f48b7d1]
- Updated dependencies [5c22433]
- Updated dependencies [8f09e52]
- Updated dependencies [2324ad3]
- Updated dependencies [b320b36]
- Updated dependencies [f02e354]
- Updated dependencies [9c79c96]
- Updated dependencies [55ab33c]
- Updated dependencies [9c79c96]
  - @graview/tools@0.1.34
  - @graview/primitives@0.1.34
  - @graview/core@0.1.34
  - @graview/pages@0.1.34
  - @graview/react@0.1.34
  - @graview/studio@0.1.34
  - @graview/layout@0.1.34

## 0.1.33

### Patch Changes

- a583b18: `mount` takes the host's subscriptions, and a page that keeps them on a served store carries no rule parser (FR-182). `GraviewProvider` and the pages' context took `subscriptions`, but the embed's options had none, so on a hosted page the sheet "Notify me…" and Activity's list kept a reader's subscriptions in the page's memory. `subscriptions` (any `SubscriptionStore`) is now one of the embed's options, on `mount` from `@graview/embed` and from `@graview/embed/pages`, and on `<Embed>`, handed to the provider on both faces and to the pages' context. `remoteSubscriptions` moved out of the module that answers `/graview/subscriptions` into one of its own, so asking the route no longer brings the expression and template parsers, which the answer judges a subscription with, into a hosted page's first chunk: the compiled shell handing `mount` a `remoteSubscriptions` store was 10,360 bytes (10.1 KB) heavier up front than the shell without one, and is now 767 bytes heavier, 9.4 KB less; the page that compiles its document, which carries the parsers anyway, is 1.9 KB less. Both are still exported from `@graview/ship`, `@graview/ship/browser` and `@graview/ship/runtime` as they were. The embed's README and the graview-embed skill say the option. `capabilities().shipped` gains FR-182.
  
  Compatibility: ops, stored formats, the declaration and derived tools are unchanged. The wire is unchanged: `/graview/subscriptions` answers as before, and `answerSubscriptions`, `remoteSubscriptions` and `SUBSCRIPTIONS_PATH` keep their entries; `capabilities().shipped` lists FR-182. What Graview Cloud does: pass `subscriptions: remoteSubscriptions({ url, principal })` to `mount` and drop its interim stand-in for the store.
- Updated dependencies [01fc2ce]
- Updated dependencies [a583b18]
  - @graview/core@0.1.33
  - @graview/layout@0.1.33
  - @graview/pages@0.1.33
  - @graview/primitives@0.1.33
  - @graview/react@0.1.33
  - @graview/studio@0.1.33
  - @graview/tools@0.1.33

## 0.1.32

### Patch Changes

- f838147: An embed draws nothing over its host's page. Its root made no stacking context, so the scene's corner control ("Close the map") carried its own `z-index` out onto the host: on graview.dev's live demos at 768 wide the docs' sticky rail scrolled over a demo and the demo's control stood over the rail's links, so a press on "With a model" landed on the demo. The root of both the scene and the pages embed now isolates, so every layer inside it is ordered inside it, and the host's own stacking decides where the embed stands as a whole. Popovers are unchanged: they stand in the browser's top layer.
  
  Compatibility: no surface changes.
- Updated dependencies [283a49d]
- Updated dependencies [7d1c3e1]
- Updated dependencies [0a822b7]
- Updated dependencies [cdbbebc]
- Updated dependencies [6c2284e]
- Updated dependencies [b70152f]
  - @graview/primitives@0.1.32
  - @graview/core@0.1.32
  - @graview/pages@0.1.32
  - @graview/layout@0.1.32
  - @graview/react@0.1.32
  - @graview/studio@0.1.32
  - @graview/tools@0.1.32

## 0.1.31

### Patch Changes

- ff88015: A person can ask to be told when something happens in an app, and the host is told when it does (Roadmap f-notify-subscriptions). A subscription is `{ who, app, when }`, where `when` is an act running (any, one by name, and/or one on a record), a record of a kind added, a kind's records or one record changed, or a record reaching a condition written in the app's own rule language (`done == true`, `amount > 100`); it is told only of changes somebody else made unless it says `alsoMine`. `matchSubscriptions(store, ops, subscriptions)` on the new `@graview/core/subscriptions` judges a commit batch by batch as each subscriber's seat sees it — a change to a record they cannot see never matches, a field kept from them is neither said nor read by a condition, a change withheld from them is said as "Someone" — and answers at most one `SubscriptionMatch` per batch per subscription, with who made it, its sentence, the acts it ran and each record it touched with the fields it changed. `watchSubscriptions(store, { subscriptions, onSubscriptionMatch })` calls a host's hook on every commit; `subscriptionWords` says a subscription in words and `subscriptionProblem` says why one could never be told anything. The shapes and `memorySubscriptions()` are on the main entry.
  
  `@graview/ship`'s handler keeps them (`subscriptions`, a `SubscriptionStore` of the host's; in memory when unsaid), serves each seat its own at `/graview/subscriptions`, and calls `onSubscriptionMatch` once per matching batch; `remoteSubscriptions` is the page's half, `fileSubscriptions` the file `graview serve` keeps beside the store and prints each match from. A chat subscribes its person with three new tools, `subscribe`, `unsubscribe` and `list_subscriptions`, listed where the host keeps subscriptions (`ToolRuntimeOptions.subscriptions`, `createMcpHttpHandler`'s, and always under `graview mcp`, which shares the file with `graview serve`).
  
  On both faces the context menu offers "Notify me…" on a record, a kind's list and an act (a menu target now says the `act` it was opened on), a record's page offers "Notify me when this changes", and an act's form when it is done offers "Notify me when someone else does this": each opens one sheet already filled in, so from a right-click a person subscribes in two presses. What a person is told of is listed in Activity, each with one press to stop. The provider keeps them where its host says (`subscriptions`), else in the page.
  
  It adds 0.8 KB more up front to a hosted page (864 bytes, 330 gzipped), and its raises are filed in `scripts/budget-raises/`.
  
  Compatibility: the wire: a new route, `/graview/subscriptions` (GET the seat's own; POST `{ add: { when, alsoMine? } }` or `{ remove: id }`), and `createStoreHandler` takes `subscriptions` and `onSubscriptionMatch`; every other route answers as before. Derived tool names and input schemas: unchanged for a runtime given no `subscriptions`; given one, `subscribe`, `unsubscribe` and `list_subscriptions` are listed beside the read tools, and an act named any of them is listed as `<name>_2`. New: `@graview/core/subscriptions`, `Subscription`, `SubscriptionWhen`, `SubscriptionMatch`, `SubscriptionStore`, `OnSubscriptionMatch`, `memorySubscriptions` and `subscriberOf` on `@graview/core`, `MenuTarget.act`, `PointerMenu.act`, `GraviewContextValue.subscriptions`, and `NotifySections`, `NotifyDoor`, `NotifyButton`, `NotifiedDoor`, `useNotifySection`, `useNotifiedCount` and `askToNotify` on `@graview/primitives`.
- 6c92669: Pages honors the app's setting for the AI it offers in place. An embed mounted with `seat: "hidden"` drew no ask field on the scene and one on every page anyway: the routed face drew its own without reading the setting. In this release the ask field itself gives way to the quick ask (see "The quick ask replaces the Ask box"), and its setting, `quickAsk`, is read by both faces alike: the embed hands it to the scene and to every page, and `handle.setQuickAsk(on)` changes it on whichever face is open, on a phone and a desk, without mounting again.
  
  Compatibility: no surface changes beyond those the quick ask's changeset names.
- f7269b7: The first load and a page switch wait on less, and are timed (Roadmap f-perf-first-load, from "too slow to load initially and between pages"). `pnpm verify first-load` serves Graview Cloud's shell as `graview preview` builds it over a roadmap the Graview Roadmap's size and a small team's tasks, at a desk and on a slow phone, and CI holds its medians to a budget; docs/first-load.md has the numbers before and after. On the phone the roadmap is interactive in 5.2 s where it took 7.6, the tasks in 3.4 s where they took 5.1; at a desk the scene draws 37 ms after a press where it took 343.
  
  A press for the scene fetches it first and keeps the page drawn meanwhile, for at most 150 ms, rather than suspending into a placeholder that React then holds for 300 ms; at a desk the other face is fetched once the page is idle, and the bar's switch fetches a face as a hand or the keyboard reaches for it (`BarFace.reach`). A picture on the home is drawn as it comes within half a screen of the window, so a phone no longer fetches and lays out every lens before it answers a press. `openRemote` takes the store's first `state` when the host already sent it, and opens on it without asking; `graview preview` hands it with the document, and its page opens without waiting for the socket's welcome. `graview serve` and `graview preview` send their answers gzipped to a browser that takes them, and the preview's page names the chunks it needs in its head and asks for every chunk a door needs as the door is opened, rather than a level at a time.
  
  It adds 1.0 KB more up front to a hosted page (1,042 bytes, 405 gzipped), and its raises are filed in `scripts/budget-raises/`.
  
  Compatibility: the wire: a served answer is gzipped when the request accepts gzip (`content-encoding: gzip`, `vary: Accept-Encoding`), and the preview's `/graview/document` carries `state`, the answer `/graview/state` gives its seat; `openRemote` takes an optional `state`, and `RemoteState` is new on `@graview/ship`, `/browser` and `/runtime`. `BarFace` takes an optional `reach`.
- 294f181: The inline AI picks from what the app already knows, previews before it keeps, and leaves an entry in Activity (Roadmap f-ai-candidate-catalog, f-activity-ai-entries). A host that hands the seat a model now gets an AI section in the context menu on both faces: a few suggestions the model picked for what was right-clicked, "Fill in with AI" and "Draw a panel". The model never invents: `catalogOf(store, target, { principal })` on the new `@graview/core/catalog` derives, for a record, a selection, a field, a list or a lens, an act or a place, the candidates with an id and a line each — the acts the viewer may run there, the panels its kind can be drawn as, the places and records next to it, the values its fields may take — and `aiContextOf` the compact state a model reads beside them (where the viewer is, the target, the selection, the records one link away, what was done lately, a digest of the declaration cached per declaration), both under the viewer's sight: nothing they may not see or run is ever offered or said.
  
  `HostAi` gains two provider slots: `fast`, a typed-decision model in Jev's shape (`{ model, decide }`; `jevFast()` fills it with Jev), and `thinking`, a language model (`{ model, think({ system, prompt, state, catalog }) }`); unsaid, `decide` and `complete` serve them. Every call reports its tier, model, tokens and cost to the interaction and to `ai.meter`. `@graview/tools/inline-ai` holds the engine (`suggestHere`, `fillHere`, `panelHere`), the ghost (`ghostOf`, `acceptGhost`) and stub providers (`stubFast`, `stubThinking`) for tests and a dev app; the todo example takes them at `?ai=stub`. A proposed change waits as a ghost with Accept, Accept some and Dismiss, is kept as one batch whose ops carry lineage `interaction` and come through `ai:<interaction>`, and is taken back with one undo; a panel is drawn where the seat draws a view, and "Keep as a lens" makes it a real one.
  
  Each interaction is one entry in Activity (`AiInteraction`: who, when, the target, what was asked, offered and taken or dismissed, the batches it made with their undo, the models and their cost), and the change it made is drawn in it rather than again beside it. Activity filters All, Changes or AI and "Just mine"; a record's page lists what AI did there (`RecordInteractionsDoor`); an entry can ask again or show its panel again. A host keeps them with `ai.interactions` (`{ load, keep }`). `ai: { off: true }` hides every AI part on both faces — the menu's section, the ghost, the ask field, the entries and the filter — rather than disabling it.
  
  It adds 1.3 KB more up front to a hosted page (1,305 bytes, 460 gzipped), and its raises are filed in `scripts/budget-raises/`.
  
  Compatibility: ops and primitives: an op's `lineage` may carry `interaction`, the id of the AI interaction it came from; a reader that does not know it reads the lineage as before. New: `@graview/core/catalog`, `@graview/tools/inline-ai`, `HostAi.off`, `.fast`, `.thinking`, `.interactions` and `.meter`, `GraviewContextValue.aiDesk`, `GoTo.draft`, and `GhostDoor`, `InlineAiSections`, `useInlineAiSection` and `RecordInteractionsDoor` on `@graview/primitives`.
- 9a5e067: The quick ask replaces the Ask box (Roadmap f-quick-ask-framework). No face draws a field at its foot that grows into a chat thread any more: `SeatField`, its panel and Pages' `PageAsk` are gone, and so are their settings, the Shell's `ask` and `chat`, a routed face's `context.ask`, the embed's `seat` option and `handle.setAskField`. In their place, where the host's `ai` gives a model and does not say `off`, ⌘K (Ctrl+K) opens a command bar beside what the reader is on — the selected card on the scene, the record or list a page is about — that completes the acts on it, "Show …" for a panel the catalog can draw of it, its places and its records. Words that complete nothing are asked, and the answer is a card beside the record or the list: a few sentences, the places, records and panels that act on it, and the changes it proposes as a ghost on the card, accepted all or some as one batch with its one undo. A follow-up is asked on the card and replaces its answer; it is not a thread. The context menu's "Ask about this…", Find's last row and the search page's "Ask: ‘…’" open the same card, Activity keeps each ask as an AI interaction (`ask.kind` `"ask"`, with its `answer`) and "Ask again" asks it on the card again. Where the quick ask is drawn ⌘K is its and `/` stays Find's — Pages' Find hears `/` too, and the bar says `/` over its box; where it is not, both are Find's.
  
  `quickAsk` (a boolean, on by default) on `Shell`, a routed face's context and `mount`/`<Embed>`, and `handle.setQuickAsk(on)`, say whether it is drawn; `quickAskOf(setting)` reads a setting a host kept from the Ask box — `"field"` is on, `"hidden"` is off — and the embed reads a kept string the same way. The answer is the host's: `HostAi.answer` (`{ model, answer({ said, target, targetLabel, state, catalog, follows }) → { text, pick?, usage? } }`) answers it, else the Thinking slot, else the Fast slot's pick among the candidates; `answerHere` on `@graview/tools/inline-ai` is the engine, and `stubThinking` answers it for a test. A provider drawn inside another now takes the outer one's `ai` unless given its own, so an embed's routed face draws the inline AI and the quick ask too.
  
  The conversation stays the app's (`seatTalk`, the responders, `ai.turn`): no face draws it, and `ChatPanel` is there for a product that places one in its own layout. The strip the scene kept clear at its foot for the field stays, always, as the foot's (where the zoom, the way back, a notice and a proposal stand), so the city keeps its fit; `useSeatDrawn` and the conversation's `open`, `side`, `drawn`, `setOpen` and `setSide` went with the field. The four harnesses that existed for the box (`chat`, `phone-seat`, `seat-guide`, `seat-goes-and-draws`) are retired, and `quick-ask` holds the new surface on both faces in three engines.
  
  It adds 0.1 KB more up front to a hosted page (100 bytes, 60 gzipped, about the 19 its first load grew by and a margin), and its raises are filed in `scripts/budget-raises/`.
  
  Compatibility: no surface changes. Removed: `SeatField`, `SeatFieldProps`, `SeatStart`, `SEAT_WIDTH`, `SEAT_PHONE_BELOW`, `PageAsk`, `useSeatDrawn`, `SeatSide`, the Shell's `ask` and `chat`, `PageContext.ask`, `EmbedOptions.seat` and `EmbedHandle.setAskField`. New: `QuickAskDoor`, `openQuickAsk`, `useQuickAskDrawn`, `quickAskOf`, `QuickAskOpening` on `@graview/primitives`, `PageQuickAsk` on `@graview/pages`, `quickAsk` on `ShellProps`, `PageContext` and `EmbedOptions`, `EmbedHandle.setQuickAsk`, `HostAi.answer` with `AnswerProvider`, `AnswerRequest` and `AnswerReply`, `answerHere`, `answerOf` and `QuickAsk` on `@graview/tools/inline-ai`, `AiInteraction.answer`, and `HeldGhost.onCard`.
- a2f741b: The scene draws on the GPU by default where the browser can, and on the DOM path everywhere else, silently and per page (Roadmap f-gpu-default). `Scene`, the `Shell` and the embed default to `renderer="auto"`: where a page has WebGPU, an element-capture call and a canvas `paint` event (`gpuCapturePresent`, asked without a device), `@graview/render/gpu` is fetched and `attachGpu()` takes the canvas; a page without them — Firefox, Safari, Chromium before element capture — never fetches it and says nothing. A first-frame check falls back to the DOM path for good when no adapter is given, no paint arrives within 1.5 s, a frame is refused, the device is lost, or the middle of the first four frames' work is over three quarters of a frame. A renderer is handed `fallBack()`, `blur` and `scheme` with each picture. `?renderer=gpu|dom` on the address, or `graviewRenderer` set on the page before it loads, decides `auto` for an operator (`rendererAsked`, `chooseRenderer`); `GRAVIEW_RENDERER` does it for every page of a harness run, and the nightly runs every shard on both paths.
  
  The two paths draw one picture: the treatment of a view — its plane style, blur, and fade — is worked out once (`treatmentOf`, `recededOpacity`) and drawn by CSS on one path and the shader on the other, in the page's scheme. The shader no longer mixes toward a fixed ground color or darkens a quad's edges, and it premultiplies the capture's straight alpha once: a light card on the GPU had gray bands down its sides and a pale fringe for a shadow. The accessibility tree is the same on both paths.
  
  On Chromium 158 the browser's own hit-test follows the geometry a view is reported at, without the crash 154 had, so there the canvas says `data-graview-hit="platform"`, the views' content takes the pointer, and hover — a record's ties drawn as the pointer reaches a chip — works on the GPU as on the DOM path; earlier builds keep `PointerRouter`. Geometry is reported a budget a frame until every view is, and a view gone off the canvas is reported there rather than left, invisible, where it was last drawn. A drag or a wheel moves the canvas by a transform, as it moves the DOM path's stage: at altitude the GPU path panned at 20 to 30 frames a second on a quartered processor, re-laying the picture for each notch.
  
  Receded planes are blurred, the focused plane sharp (Roadmap f-plane-blur). On the GPU the blur costs nothing measurable; the DOM path's CSS blur is dropped for the rest of the page if its frames run over a frame and a half while the picture moves. `blur={false}` on the Scene or the Shell turns it off, and so do `prefers-reduced-motion`, `prefers-reduced-transparency` and the reader's Motion setting (`planeBlurOn`). `pnpm verify renderer` holds all of it.
  
  Nothing up front changes on a hosted page; the scene face before it draws is 7.5 KB larger (940,163 bytes), and the embed's budgets are raised in `scripts/budget-raises/`, the capture path itself (about 23 KB) a chunk of its own fetched only where a page can capture.
  
  Compatibility: no surface changes; `Scene` and `Shell` take an optional `blur`, the Shell's `renderer` defaults to `auto` where it was `dom`, `attachRenderer`'s argument gains `blur`, `scheme` and `fallBack`, the frame plan's `PlannedView` takes `depth` and `onPlot`, `PlanOptions` a `scheme`, `ViewDraw` carries `blur` and `FramePlan` `offCanvas`, `PlatformCapabilities.hitTestFollowsGeometry` is now decided, and `@graview/render` gains `gpuCapturePresent`, `rendererAsked`, `chooseRenderer`, `planeBlurOn`, `framesHeld`, `FRAME_BUDGET_MS`, `treatmentOf` and `recededOpacity` (`./gpu`: `FIRST_FRAMES`, `FIRST_PAINT_WAIT_MS`, `FIRST_FRAME_BUDGET_MS`, `Compositor.setBlur`, `Compositor.setScheme`).
- Updated dependencies [b775c78]
- Updated dependencies [dca6092]
- Updated dependencies [6009469]
- Updated dependencies [4784ba8]
- Updated dependencies [938721b]
- Updated dependencies [ed1a54c]
- Updated dependencies [ff88015]
- Updated dependencies [6c92669]
- Updated dependencies [f7269b7]
- Updated dependencies [294f181]
- Updated dependencies [9a5e067]
- Updated dependencies [a2f741b]
  - @graview/primitives@0.1.31
  - @graview/core@0.1.31
  - @graview/studio@0.1.31
  - @graview/pages@0.1.31
  - @graview/layout@0.1.31
  - @graview/react@0.1.31
  - @graview/tools@0.1.31

## 0.1.30

### Patch Changes

- 6cbecc0: A card says its kind's glance and no more, the bar names a place once, and a drawn home stays Home beside `pages.first` (the same review app). A finding card read "Critical · Security · High" — the third its confidence, though a severity can be high too — and still did after `confidence` was taken out of the kind's `glance`: the glance chose the order and the rest of the kind followed it. A glance a kind declares is now said exactly, and a choice another field shown beside it shares says its field ("Confidence: high", "Likelihood: low"), on a card, a row, a describe line and a table alike. A default card no longer draws a long or Markdown text as a chip cut after a couple of dozen characters: it says the text's start on a line of its own under the chips. With a home declared and `pages.first: "This week"`, the app opened on This week, and a press on Home from the scene drew the pages at their first entry and went to This week again, so the home the author drew was nowhere: `pages.first` now picks where a new visit lands, once, and after that `/` is the home on both faces. `graview check` says so when both are set (`pages-first-beside-home`, a note). And a kind whose plural is "root causes" beside a blocks place titled "Root causes" put two "Root causes" on the bar: the place keeps the name and stands, as `pages.first` and `pages.primary` already read the word, and the kind's list folds into More as "All root causes", still at `/root-causes`; `graview check` warns of it (`pages-place-named-as-a-list`). The graview-pages and graview-lists skills teach each. With the template fixes beside them, a hosted page carries 1.2 KB more up front (and 0.6 KB more up front handed a compiled app).
  
  Compatibility: ops, stored records and wire messages are unchanged. New check finding codes `pages-first-beside-home` (a note) and `pages-place-named-as-a-list` (a warning). `readableFields` with `glance: true` says only a kind's declared `display.glance` when it has one, and a choice's `alone` may carry its field's label. `barPlaces` labels a kind's list "All <plural>" and folds it when a place has its name (`allLabel` from `@graview/core`). `@graview/react/provider` exports `hasLanded(views)` and `markLanded(views)`, which the pages and the embed read `pages.first` once by. A default card's prose is `p[data-graview-excerpt="<field>"]`.
- dc5a737: A new app can point a person at its own controls once. A host that wanted to introduce the switch between the scene and the pages, the problems count, Activity and the Ask box could only do it by their selectors, which are not a surface it may hold the framework to, so its tour broke the first time the bar was drawn differently. `firstLook` on `mount` and `<Embed>`, the whole-page `Shell` and `PagesApp` runs a short sequence of hints the framework anchors to its own controls: one at a time, beside the control each names and never over it, a non-modal dialog the keyboard moves into and is said as it opens, with Next, Done on the last, Skip and Escape; a press anywhere else ends it, and the keyboard goes back where it was. A hint whose control is not drawn — no Ask box, nothing yet in Activity, the switch gone from a phone's bar while Find is open — is skipped, and it works on either face of an embed, kept across a change of face. It is shown once per viewer: the host says whether this viewer has seen it and is told when it is over; with no host seam, the browser remembers it in `localStorage` for the app. A host adds hints of its own after the framework's by naming one of the framework's controls. The hints are fetched only when a first look is shown: a hosted page's first load is about 1.1 KB more (0.4 KB gzipped), inside its budget, and every face 7.6 KB more minified.
  
  Compatibility: additive. New: `firstLook?: FirstLook` on `FrameOptions` (so `mount`, `<Embed>` and `@graview/embed/pages`' `mount`), `ShellProps` and `PagesAppProps`, where `FirstLook = boolean | { seen?: boolean | (() => boolean); onDone?: (how: "finished" | "dismissed") => void; steps?: readonly { anchor: FirstLookAnchor; title: string; words: string }[] }` and `FirstLookAnchor` is one of `FIRST_LOOK_ANCHORS`: `"faces"`, `"problems"`, `"activity"`, `"ask"`, `"find"`, `"profile"`, `"home"`. `FIRST_LOOK_ANCHORS`, `FirstLookDoor`, `firstLookKey` and the types `FirstLook`, `FirstLookAnchor`, `FirstLookEnd`, `FirstLookOptions`, `FirstLookStep` and `FirstLookDoorProps` from `@graview/primitives`, `/frame` and `/pages`; `FIRST_LOOK_ANCHORS` and those types from `@graview/embed`. Off unless given: an app that passes nothing draws and loads what it did. Ops, stored formats, the wire, the document format, the compiled format, check finding codes and derived tool names and schemas are unchanged. What Graview Cloud does: pass `firstLook: { seen: () => <the viewer has seen it>, onDone: () => <record that they have> }` to `mount` for a new app, and name an anchor rather than a selector in any hint of its own; `true` remembers it in the browser instead.
- 37745ff: A relation can go to a kind in another app, and the linked record is read there as whoever is looking (FR-171, the full relation). 0.1.29 named another app; this names a record in it. A relation's `to` may be `"@<app address>/<kind>"` — `"forHouse": { "to": ["@nick/house/house"], "cardinality": "one" }` — and `linkedRecordField("@nick/house/house")` says the same in a declaration, which `toDocument` writes back as the relation. Linking picks a record there and never touches the other app: the record that links keeps which one under the relation's name, as `"house:h1"` (or a list), so its derived edit sets it, undoes it, logs it and keeps it from a seat a sight keeps it from like any value. `graview check` says in sentences what such a relation cannot be — `linked-mixed`, `linked-apps`, `linked-target`, `linked-inverse`, `linked-append-only`, `act-linked`, `rule-linked` — with the checker, so a page that compiles without it carries none of their words. The host reads the far side beside `resolveApp`: `linkedRecords` on `mount`, `<Embed>`, `GraviewProvider` and the routed face answers `resolve(ref, viewer)` with the record's label, describe line, card and the fields that viewer may see, `{ denied: true }` or `null`, `find(search, viewer)` with the records that viewer may link, and `open(ref, viewer)`, optional, the seam a press on a linked record opens it through. The record's page and the scene's record panel draw it with its own card from its home app, and a document card's `{ "field": "forHouse" }` names it; a viewer the host refuses sees "linked record (no access)" and nothing of it. "Change" beside it, a form and the scene's ask pick another from what the host lists. The rule language walks it by name, `forHouse.listPrice`, in a computed field, a block or a rule, as the viewer: a far record it cannot read reads as nothing and is said — a computed value says why it has none, a rule that would not hold without it cannot be judged — and never thrown; the page reads again as each answer arrives (`store.reread()`). When the far value changes, the host calls `recordLinkedChange(store, { ref, fields, app })` and the reading app's history keeps an op authored by the other app on each record that links it — "Buy it outright: the linked record changed in House — list price" — naming what changed and none of its values. `describe_app` lists each relation under "Linked from other apps" with how to link one, the derived edit's tool says its argument is a record of that app as `"<kind>:<id>"`, and a seat finds one with `find_linked`, listed only for an app with such a relation. `@graview/core/linked` holds `linkedRecordsOver`, the host over stores held in memory, read through each far store's `seenBy(viewer)`, which the tests read two compiled documents through and a host holding both apps can use as it is; `graview-linked-records` is the skill that teaches it. A hosted page's first load is 5 107 bytes larger (550 088 over the vendors document, 544 981 on main), 4 648 handed a compiled app, both under their budgets; what draws a linked record is a chunk fetched with the first one drawn, and the embed's budgets are raised by files of their own: the pages face 4 585 / 1 704 bytes minified / gzipped, every face 20 162 / 7 423, the studio handed in 13 618 / 4 936.
  
  Compatibility: additive. The document format gains a relation target `"@<app address>/<kind>"` in `kinds.<kind>.edges.<name>.to` (`document.schema.json`'s `edges.to` items match a kind name or that target), its value kept on the linking record as `"<kind>:<id>"` or a list of them, and `graview-compiled@1` carries it; a build that predates it refuses such a target by path. The check gains `linked-mixed`, `linked-target`, `linked-apps`, `linked-inverse`, `linked-append-only`, `act-linked` and `rule-linked`. `mount`, `<Embed>`, `GraviewProvider` and the routed face's context gain an optional `linkedRecords: { resolve(ref: { address, kind, id }, viewer): Promise<{ address, kind, id, label, describe?, card?, fields, href?, app? } | { denied: true } | null>; find({ address, kinds, query, limit }, viewer): Promise<LinkedRecord[] | { denied: true }>; open?(ref, viewer): void }`. Ops and primitives are unchanged: a far change is an ordinary op appended with author `{ kind: "system", id: "app:<address>", name }`, `via: "app:<address>"`, the linking records in `reads` and no primitives. `ReadableField` gains `linked`, a form gains the control `linked`, a document card's resolved field block gains `linked`, and the derived `edit-<kind>` of an app with such a relation describes its argument with `"x-graview-linked"`; an app with none has the same tools as before. What a host does: read `capabilities().shipped` for FR-171 before writing such a relation, pass `linkedRecords` to have a linked record drawn and walked, and call `recordLinkedChange` when a far value changes.
- c70440c: A person can scrub back through an app's history and watch it being built (Roadmap f-playback). `pastOf(store, seq)` and `pastOf(store, time)`, on the new `@graview/core/past`, are the app as it stood then — its records, its links, its log and its problems — read, never changed: it offers no act, declared or derived, `permits` says "Nothing changes while you look back.", and every change asked of it is refused with a `PastError`. A seek folds from the nearest point it can, an epoch or a point kept in memory for that store every `pastEvery` ops (64) as an earlier seek passed it, so scrubbing never folds the whole log twice; a store reopened with its log but not the epoch its seed began (a page's browser adapter keeps none) works back from the graph it holds with each op's inverse, so the past begins at the seed rather than at nothing. `pastOf` asked of a seat's view of a store answers under that seat's sight, so a seat sees the past only as it could see it then. `seqAt(store, time)` says where a time falls, and `pastAt(store, when, host)` is the past under the declaration a host says the moment was made under (`declarationAt`). The past is an entry of its own, apart from the store, because a page needs none of it until somebody looks back: the provider fetches it then. `@graview/core/history`, fetched with the timeline, holds what the timeline reads around it: `ticksOf(store, { me, declarations })` is a tick per gesture marked by who made it (`you`, `person`, `agent`, `app`), with a bigger tick where the declaration changed and the sentence it said, from an epoch's `change` or a host's `DeclarationMark`; `declarationSentence` ("Added a Budget kind"), `makerOf`, `makerWords` and `restoreBatches`.
  
  On both faces, every row of Activity has "Show the app as it was here": the face draws the app as it stood just after that change, from the one store every surface reads, with a timeline over the scene and at the head of the routed face's page — "As of" the moment, what was done there and by whom, a tick per change, Play at 1× to 8×, and Back to now. While the past is shown nothing is offered to change it: no act, no undo on Activity, no ask field, no way back after an act, and a design's own control that asks `permits` is disabled. "Restore to here" takes back every change since as one undo, itself undone as one, offered only when this seat may make every one of those changes and the log lets them go together. An undo whose target also came after the earliest op being taken back no longer blocks it, since the two leave the graph as if neither was made.
  
  What the log does not hold is the host's: `GraviewProvider`, `mount` and `PageContext` take `history: { declarations, viewAt }`, the declaration changes it knows (each with the declaration the past is drawn under from its seq) and `viewAt(name, seq)`, a script view's code at a moment, `null` where the view did not exist then. `HostFiles.kept(href)` says whether the host still keeps a file's bytes, and one it has let go of is drawn as "removed later", as is a picture that does not load while somebody looks back. `verify playback` drives it on the todo example in three engines. Up front, the hosted page carries only the seam the faces read the moment from and a store's refusal of a change to the past; the fold, its kept points and the timeline are fetched when somebody first looks back (what the 0.1.30 wave adds up front together is said in `.changeset/the-0-1-30-wave-leaves-the-past-and-the-suggestions-off-the-first-load.md`). The every-face, pages-face, studio and registering-a-worker-view budgets grow by 13_243 / 5_442, 4_630 / 1_928, 5_790 / 2_173 and 482 / 154 bytes in their raise files.
  
  Compatibility: ops and primitives fold as before (`OperationLog.fold` lands each op through the new `foldOp`, unchanged); `checkUndo` no longer counts as blocking a live undo whose target is itself after the earliest op being undone, so an undo that was refused with "Include batch …" over such a pair now runs, and nothing it was allowed before is refused. New API: the `@graview/core/past` entry — `pastOf(store, when: number | string | Date, options?: { declaration?: PastDeclaration }): Store`, `pastAt(store, when, host?: HistoryHost): Store`, `seqAt(store, when: string | Date): number` and `declarationAt(marks, seq)` — and `Store.past`, `Store.pastEvery`, `StoreOptions.pastEvery`, `PastError`, `PastPoint`, `PastDeclaration`, the `@graview/core/history` entry (`ticksOf`, `declarationSentence`, `makerOf`, `makerWords`, `restoreBatches`), `HostFiles.kept`, `history` on `GraviewProvider`, `FrameOptions` and `PageContext`, `usePlayback`, `useLiveStore`, `useOwnPlayback`, `PlaybackContext`, `PastBar` and `prefetchTimeline`.
- eb3bdb7: A right-click on the pages opens the scene's context menu. It was the scene's alone, so on a list, a record's page or a picture's page a right-click met the browser's menu and the acts were a scroll away. It is the same menu now — the same pane, the same acts `@graview/tools` derives, narrowed by the seat, with what is withheld said the way the scene says it — opened on what the gesture landed on: a list's row, a record's page, a card or a link to a record, a lens's mark, all about that record, with "Open", "Open in a new tab" and "Show in the scene" beside its acts; a value on a record's page, with "Change “Due”" first, which opens that value's own edit in place; a picture's ground, about its place, headed with its title and offering what its kind offers ("Add a task"); and the page's own ground, with the list's kind's acts and Find. Shift+F10 and the context-menu key open it on what has the keyboard, and a finger resting on the page opens it on a phone (on a list that chooses, resting on a row still chooses it). The keyboard goes into the menu and back where it was opened; Escape closes it.
  
  The browser keeps its own menu in a text field or editable text, over text somebody selected, and whenever Shift is held with the right-click — the way to the browser's "Open link in new tab", which the menu also offers itself. A design's own value takes part by carrying `data-graview-field` beside `data-graview-editable`, and its own row by being a link to the record or carrying `data-graview-record`.
  
  A host adds a section of its own to the menu on either face: `menuSections` on `GraviewProvider`, on `embed()` and on the pages' context, each a function told what the menu was opened on (`MenuTarget`: `face`, `on`, `about`, `field`, `place`, `href`, `element`) that answers a `MenuSection` — rows (`items`: `{ id, label, run, hint? }`) or what it draws itself (`render(close)`), before the acts (`at: "start"`) or after them — or nothing. A face adds its own with `MenuSections` from `@graview/react/drawing`. `graview-desk` teaches the seam, and `graview-lists` how a design's own rows and values take part. The menu and its pane stay off a page's first load: they are fetched when the page is first idle, or at the first right-click, and a hosted page's first load carries nothing more for them. The embed's pages face alone carries 3.7 KB more in all (the menu's pane, now fetched there too), every face 0.5 KB and the embed with the studio handed in 5.0 KB, raised in `scripts/budget-raises/the-pages-open-the-scenes-context-menu-*.json`.
  
  Compatibility: no surface changes. New on the provider, `embed()` and `PageContext`: `menuSections` (the context menu's section seam). New on `PointerMenu`: `about`, `face`, `field`, `place`, `href`, `title` and `returnTo`, all optional. `Inspector` takes `openActs`. The `acts` popover is drawn on the pages too.
- Updated dependencies [e46f304]
- Updated dependencies [6cbecc0]
- Updated dependencies [6862f3a]
- Updated dependencies [ec39547]
- Updated dependencies [ed2a75d]
- Updated dependencies [0d45ba0]
- Updated dependencies [6862f3a]
- Updated dependencies [825838f]
- Updated dependencies [ea43f4a]
- Updated dependencies [f901dfb]
- Updated dependencies [4feaed1]
- Updated dependencies [6862f3a]
- Updated dependencies [e46f304]
- Updated dependencies [dc5a737]
- Updated dependencies [489ff27]
- Updated dependencies [648fc05]
- Updated dependencies [6862f3a]
- Updated dependencies [37f2b3b]
- Updated dependencies [5b8ac1f]
- Updated dependencies [6862f3a]
- Updated dependencies [057931a]
- Updated dependencies [412abf0]
- Updated dependencies [e46f304]
- Updated dependencies [489ff27]
- Updated dependencies [e46f304]
- Updated dependencies [489ff27]
- Updated dependencies [489ff27]
- Updated dependencies [312521c]
- Updated dependencies [37745ff]
- Updated dependencies [84ad32f]
- Updated dependencies [412abf0]
- Updated dependencies [e46f304]
- Updated dependencies [e46f304]
- Updated dependencies [412abf0]
- Updated dependencies [b6c81b2]
- Updated dependencies [c4a953d]
- Updated dependencies [93770ac]
- Updated dependencies [6cbecc0]
- Updated dependencies [f901dfb]
- Updated dependencies [e46f304]
- Updated dependencies [5b8ac1f]
- Updated dependencies [f7c1a9e]
- Updated dependencies [1a1f996]
- Updated dependencies [6770f65]
- Updated dependencies [f901dfb]
- Updated dependencies [cf85240]
- Updated dependencies [e46f304]
- Updated dependencies [6931bf7]
- Updated dependencies [489ff27]
- Updated dependencies [56dbbe3]
- Updated dependencies [412abf0]
- Updated dependencies [91716ae]
- Updated dependencies [c70440c]
- Updated dependencies [c3564eb]
- Updated dependencies [01fa7c5]
- Updated dependencies [412abf0]
- Updated dependencies [8ca608c]
- Updated dependencies [c9d1840]
- Updated dependencies [489ff27]
- Updated dependencies [eb3bdb7]
- Updated dependencies [489ff27]
- Updated dependencies [88c84c3]
- Updated dependencies [c3e789b]
- Updated dependencies [489ff27]
  - @graview/pages@0.1.30
  - @graview/core@0.1.30
  - @graview/primitives@0.1.30
  - @graview/react@0.1.30
  - @graview/studio@0.1.30
  - @graview/layout@0.1.30
  - @graview/tools@0.1.30

## 0.1.29

### Patch Changes

- a5c260f: A hosted page loads thirteen chunks before it draws where it loaded twenty-three, and 7.6 KB less (5.0 KB gzipped), so the round's money formats have room after its repeating dates and field-level sight. A bundler splits what a page loads first by which of its doors (each part fetched with `import()`) reach each file, so the frame's files were spread over twenty-three chunks, each with its own list of names in and out and each compressed alone. Every door in `@graview/core`, `@graview/react` and `@graview/primitives` now imports the barrel the page drew first (`@graview/core`, `@graview/react/provider`, `@graview/primitives/frame`) for nothing but that, which makes the files every door reaches one set and costs a door nothing at run time. What draws a notice is fetched with the first notice and prefetched once the page is idle (`notice-stacks.tsx`); the board and the two live regions that say each notice aloud stay up front, so a notice is said at once, and `fetchNotices()` fetches it at will (the embed's `preload` does). What only fetched faces say or do left the barrels a page imports: `edgeWords` and `valueWords` for `@graview/core/words`, and a face's moves (`withShown`, `withQuery`, `withoutSearch`, `withPast`, `withPan`, `withPin`, `edgeSelectionId`) for a new `@graview/layout/view-moves`. Built as Cloud builds it over the vendors document, the page that compiles its document goes from 549 727 bytes (192 368 gzipped) to 541 994 (187 254), and the page handed a compiled app from 507 528 (177 639) to 499 794 (172 530). Their budgets fall to keep about 8 KB of room (3.5 KB gzipped): 537.5 KB (186.4 gzipped) from 538.0 (188.0), and 496.0 KB (172.0 gzipped) from 497.5 (173.5). No face loses anything: the pages face alone is 3.4 KB less, and every face fetched together 4.4 KB less.
  
  Compatibility: BREAKING imports. `edgeWords` and `valueWords` move from `@graview/core` to `@graview/core/words`; `withShown`, `withQuery`, `withoutSearch`, `withPast`, `withPan`, `withPin` and `edgeSelectionId` move from `@graview/layout` and `@graview/layout/view` to `@graview/layout/view-moves`; `FOOT_MOVED`, `FOOT_OBSTACLES`, `NARROW_PICTURE`, `placeAtTheFoot` and `placeAtTheTop` leave `@graview/primitives/frame` (still on `@graview/primitives` and `@graview/primitives/pages`). `withoutMoves` stays on `@graview/layout/view`. New: `@graview/layout/view-moves`, and `fetchNotices` from `@graview/primitives`, `/frame` and `/pages`. Ops, stored formats, the document format, the compiled format, check finding codes and derived tool names and input schemas are unchanged. What Graview Cloud does: import those names from their new entries; its shell built from these sources loads about 7.5 KB less before the app draws.
- 3b06199: A record can link another app, and the host says what that app is called (FR-171). A relation's `to` names kinds inside one document, so a scenario in one app could not point at a house in another. The first step is a field: `{ "type": "app-link" }` in a document, `appLinkField()` in a declaration, holding another app's address — `@owner/app`, an id its host knows it by, or an absolute http(s) address, at most 500 characters (`isAppAddress`). The store refuses anything else as `invalid`, `editDocument`'s `add-field` and `retype-field` take the type, a migration keeps a value that is an address and clears one that is not, a spreadsheet's cell is read as one or refused in words (FR-177), `graview types` writes it as a string said to be another app's address, a form asks for it with "@owner/app or https://…" as its placeholder, and an act's tool schema gives it the address's `pattern` and `"x-graview-app-link": true` so an agent sets an address rather than a name. A host hands `resolveApp(address, viewer)` to `mount`, `<Embed>`, `GraviewProvider` or the routed face's context, answering `{ name, icon?, headline?, href }`, `{ denied: true }` or `null`: the field draws as that app's icon, name and home headline, linked to `href`, on a record's page and in the scene's record panel, and as its icon and name on a list's row and a document card's field block. A viewer the host refuses sees "linked app (no access)" and nothing of the app. Without a resolver, or where the host knows no such app, the address is drawn as it is kept, a link only when it is an absolute http(s) address. The host is asked once per address and viewer, however many records link it, and a throw is taken as `null`. Where an act may write the field, a "Change" control beside the link edits the address. What draws it is a chunk fetched with the first app-link drawn: a hosted page's first load is 509 bytes larger (557 327 bytes over the vendors document, 556 818 on main), 501 handed a compiled app, and the scene before it draws 1 647, all under their budgets; the embed's pages face carries 1 884 / 1 607 bytes more minified / gzipped, every face 7 001 / 3 726, each raised by a file of its own. A relation whose `to` is another app's kind, an expression that walks it and the history of the far value are left for 0.2. `capabilities().shipped` gains FR-171.
  
  Compatibility: additive. The document format gains the field type `app-link`, and `graview-compiled@1` carries it; a build that predates it refuses the type by path, and a page that predates it refuses such a compiled app as `compiled-shape` and compiles the document. `mount`, `<Embed>`, `GraviewProvider` and the routed face's context gain an optional `resolveApp`; `ReadableField` gains `app`, `ScalarField` gains `app`, and a document card's resolved field block gains `app`. A derived tool's input schema for a declaration with no app-link field is unchanged. What a host does: read `capabilities().shipped` for FR-171 before writing an `app-link` field, and pass `resolveApp` to have one drawn as the app rather than as its address.
- 0b722e4: Days, times and numbers are said in the app's locale, en-US first (FR-178). The eighth walk read "10 Sep 2023" in an app written for the United States: every day was said day first, in an order fixed in code, and no face knew a locale. Now every day, time and figure a person reads is said through `Intl` — a record's facts and its glance, a template's `{due}`, `{due | date}` and a moment's `{at}`, a block's field and figure, a rule's line and a rule's message, a creating act's line, an arrangement's headings ("Week of Aug 24, 2026"), the calendar's titles and labels, a declared timeline's hours, and the seat's lines ("On Thursday, Sep 17: …") — in en-US unless the app says otherwise: "Sep 10, 2023", "3:30 PM", "1,250". A moment (`2023-09-10T15:30`) is said with its time where it was said as it is kept. The app says its locale where it says its currency, `brand.locale` ("en-GB" keeps the day first, "de-DE" writes "1.250"), and a host that knows its reader passes theirs as `locale` on the embed (both faces), `GraviewProvider` and a pages `PageContext`, which wins over the app's. `describeApp` says what the locale makes of a day, a time and a figure; `editDocument`'s `set-brand` and `diffDocuments` say "Days, times, numbers and money are written for de-DE." The framework's own words stay English. `@graview/core` exports `dayAsRead`, `momentAsRead`, `timeAsRead`, `numberAsRead`, `weekdayAsRead`, `dayOfMonthAsRead`, `monthAsRead`, `weekdayName`, `minutesAsRead`, `whenAsRead`, `localeFor`, `sayIn` and `DEFAULT_LOCALE`; each takes an optional locale. `capabilities().shipped` gains FR-178.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and derived tool schemas are unchanged; `brand.locale` is the key it was, and now says days, times and numbers as well as money. The words a person reads change: a day is said "Aug 28, 2026" where it was said "28 Aug 2026", a moment with its time where it was said as stored, a number in a block or a rule's line with the locale's separators, a week's heading with its day in words, and the seat's day "Thursday, Sep 17" where it was "Thursday 17 Sep". `editDocument`'s sentence for `set-brand`'s `locale` and `diffDocuments`' for a changed locale say "Days, times, numbers and money are written for …"; a changed currency is its own sentence. What a host does: pass the reader's locale as `locale` on `mount`, and match words a test reads in en-US.
- 2ca4722: From altitude the map draws only the lines that explain what is chosen, and a picture pressed on a district opens beside the map at a size a person reads.
  
  At rest every relation between two districts is one ribbon (`Ribbons`), run along the gutters between the blocks so it crosses no third district, as wide as the links along it, and said in words when pointed at: "146 features → 14 areas, the part it lives in", from the declaring kind's own description. No record has a line of its own. A chosen district keeps only its own relations' ribbons. A chosen record keeps none and draws its own links instead (`RecordLinks`): solid to a record the map draws on its own (its building, or its chip), ending in a dot, and dashed into a district for the records in it the map does not draw one by one, or for a relation that reaches more than six of them; each is labeled at its far end in its kind's words ("the part it lives in: tools", "what this part does: 46 features"), passes under the districts' names, and everything the record does not reach recedes. A link made less than sure (FR-172) stays so in the line the chosen record draws: dotted at the strength the scene draws a provisional link in, its label ending "· unsure" with what it was based on on hover. The connectors and the ties no longer draw at altitude, except for a change that just happened. The Key says the three manners first, and the unsure one at every height, and each relation's swatch is its ribbon at its own width. The roads are gone; `roadBetween` with them, and `streetPoints` moved to the ribbons.
  
  What is chosen from altitude stands in a panel beside the map (`MapPanel`, from `@graview/primitives` and `@graview/primitives/scene`, drawn by the Shell and an embed's scene face): docked at the side on a desk — the city is laid out in the room left, and Up, the Key and the ask field keep clear of it — and a sheet from the foot on a phone. A showing pressed on a district's marquee opens there at full size, in the mode a lens draws a page in, with its name, its count, the kind's description and Open to its own place; the map recedes but for its district, and no line is drawn over it. The billboard that drew the lens at the city's scale on its plot is gone, and the camera no longer flies closer to it. A chosen record lists its links there, a heading per relation in its kind's words, each record a press that chooses it; a chosen district lists its relations with how many each joins, and every record in it; a right-click on a record there, or on one in the lens, opens its acts as it does on the map — the card of chips that floated over the districts ("1 of 14 tied", "close", "+10 more — double-click to go in") is no longer drawn where the panel is. A district's "open", and a double-click on a district with no picture of its own, choose the district where a face says the panel is drawn (`BesideTheMap`, from `@graview/react`); a scene drawn without it, such as the studio's, still opens a district in place. The panel, the ribbons and a record's links are each fetched when first drawn, so a hosted page's first load and its scene before it draws hold to their budgets unraised; the embed's budgets are raised for them (scripts/budget-raises/the-map-draws-only-what-explains-the-choice-*.json): every face by 22_727 / 10_165 bytes, the pages face by 372 / 166 for the district's card asking whether the panel lists it, and the embed with the studio by 609 / 947.
  
  Compatibility: the scene changes what it draws, not any surface a host holds it to. `@graview/react` gains `Ribbons`' and `RecordLinks`' helpers (`mapChoice`, `districtOf`, `ribbonsOf`, `ribbonSentence`, `ribbonWidth`, `RIBBON_WIDTH`, `pickedFrom`) and `BesideTheMap`; `@graview/primitives` gains `MapPanel` and `mapPanelShows`. A selector on `.graview-road`, `[data-graview-screen]` or `.graview-screen-grip` finds nothing now: a relation from altitude is `[data-graview-ribbon]`, a record's link `[data-graview-link]`, and the panel `[data-graview-map-panel]`. `whereIs("screen:<kind>")` answers the district's box, where those looking at the picture now gather.
- Updated dependencies [362ed4e]
- Updated dependencies [523149b]
- Updated dependencies [7966f5d]
- Updated dependencies [fcf84de]
- Updated dependencies [a43f829]
- Updated dependencies [55ec52b]
- Updated dependencies [6764d85]
- Updated dependencies [dbe0a28]
- Updated dependencies [3f607a8]
- Updated dependencies [42dbfb7]
- Updated dependencies [a5c260f]
- Updated dependencies [3accacb]
- Updated dependencies [cd5a9d5]
- Updated dependencies [3cd624d]
- Updated dependencies [897c7bb]
- Updated dependencies [774d39c]
- Updated dependencies [933761a]
- Updated dependencies [2d3f806]
- Updated dependencies [dedefed]
- Updated dependencies
- Updated dependencies [8e09c51]
- Updated dependencies [307f2d4]
- Updated dependencies [76a5829]
- Updated dependencies [11deba2]
- Updated dependencies [15c033b]
- Updated dependencies [a4cfcdc]
- Updated dependencies [3b06199]
- Updated dependencies [861b0b4]
- Updated dependencies [ed76a10]
- Updated dependencies [df64e2b]
- Updated dependencies [1076b0c]
- Updated dependencies [02bdf28]
- Updated dependencies [c893321]
- Updated dependencies [054b011]
- Updated dependencies [332fbeb]
- Updated dependencies [ee15ae3]
- Updated dependencies [ebabbd1]
- Updated dependencies [488aba6]
- Updated dependencies [4dbb23e]
- Updated dependencies [d8dc4c6]
- Updated dependencies [a047696]
- Updated dependencies [b61f093]
- Updated dependencies [0b722e4]
- Updated dependencies [b61f093]
- Updated dependencies [3c16f27]
- Updated dependencies [4dbb23e]
- Updated dependencies [93a7636]
- Updated dependencies [73a9750]
- Updated dependencies [48b777a]
- Updated dependencies [4c545b7]
- Updated dependencies [2016c5f]
- Updated dependencies [0d585ba]
- Updated dependencies [5197748]
- Updated dependencies [952e526]
- Updated dependencies [1b41c2d]
- Updated dependencies [86b27f9]
- Updated dependencies [a7ee9a6]
- Updated dependencies [3cb21ac]
- Updated dependencies [4b12e16]
- Updated dependencies [8da8189]
- Updated dependencies [2ca4722]
- Updated dependencies [44e86bc]
- Updated dependencies [dabb97f]
- Updated dependencies [5b9c800]
- Updated dependencies [7da616c]
- Updated dependencies [d4db733]
- Updated dependencies [9309ad5]
- Updated dependencies [c1fb0a3]
- Updated dependencies [fc3b1f2]
- Updated dependencies [293e42b]
  - @graview/react@0.1.29
  - @graview/core@0.1.29
  - @graview/tools@0.1.29
  - @graview/primitives@0.1.29
  - @graview/pages@0.1.29
  - @graview/studio@0.1.29
  - @graview/layout@0.1.29

## 0.1.28

### Patch Changes

- Updated dependencies [085670c]
- Updated dependencies [10bac84]
  - @graview/core@0.1.28
  - @graview/studio@0.1.28
  - @graview/layout@0.1.28
  - @graview/pages@0.1.28
  - @graview/primitives@0.1.28
  - @graview/react@0.1.28
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
- Updated dependencies [b228859]
- Updated dependencies [af180f4]
- Updated dependencies [b228859]
- Updated dependencies [b228859]
  - @graview/core@0.1.27
  - @graview/studio@0.1.27
  - @graview/tools@0.1.27
  - @graview/primitives@0.1.27
  - @graview/layout@0.1.27
  - @graview/pages@0.1.27
  - @graview/react@0.1.27

## 0.1.26

### Patch Changes

- 26dbe52: A picture or a document is put on a record from the page, through the host's own storage (FR-163). A host hands `mount`, `<Embed>`, `GraviewProvider` or the Shell `files: { upload(file: Blob, name: string): Promise<FileValue>; maxBytes: number; kinds: readonly string[] }` (`HostFiles`), and `PagesApp` takes it in its context; `upload` stores the bytes and answers the value the record keeps. A file field's editor is drawn on every face where the record's values are changed — the scene's record, the routed record page, the routed face's forms and the strip's ask — and a field that holds nothing yet is drawn there too when an act may write it. It takes files picked, a photo taken (`<input capture>`, offered where the pointer is a finger), files dropped and files pasted, several at once for a list. A camera's photograph, and a JPEG or WebP bigger than a page needs, is drawn again in the page no larger than 2,048 pixels before it is sent (`resample`, which `downscale` now uses too); a HEIC the browser can read is sent as a JPEG, one it cannot read is sent as it is where the host takes HEIC and refused in words where it does not. What the host takes is said before anything is sent ("or drop or paste them here · pictures and PDF files, up to 10 MB"), and what it refuses is said in the editor's words: "“big.png” is 14 MB; this host takes files up to 10 MB.", "“quote.pdf” is a PDF file; this host takes pictures.", or the message `upload` threw ("“porch.png” wasn’t kept: the disk is full"). What is kept becomes the ordinary act that sets the field, which the room records and undo takes back, and a list's files may be given a caption, moved earlier and removed. Without `files` the editor says "This host doesn’t take files, so none can be added here." and offers no way to add one.
  
  For development and the harnesses, `@graview/ship/dev` has a door that keeps files in memory and serves them back (`devFiles()`, a Vite plugin, and `devFilesHandler`; `/__graview/files`, same-origin only, never in a build), and `@graview/ship/browser` has `filesAt(url, { maxBytes, kinds })`, the `files` a page hands that sends to such a door, or to a host's route that answers the same. The todo example's tasks take attachments through them under `pnpm dev`. `scripts/verify-files.mjs` drives it on both faces in three engines.
  
  Compatibility: additive. Ops, stored formats, the wire, the document format, the compiled format, check finding codes and tool names and schemas are unchanged by the seam itself. New: `HostFiles` from `@graview/core`; `files` on `FrameOptions` (so `mount` and `<Embed>`), `GraviewProviderProps`, `ShellProps` and `PageContext`; `HostFilesContext` and `useHostFiles` from `@graview/react` and `/provider`; `filesAt` from `@graview/ship` and `/browser`; `devFiles`, `devFilesHandler`, `DEV_FILES_PATH`, `DEV_FILES_KINDS` and `DEV_FILES_MAX_BYTES` from `@graview/ship/dev`. `capabilities().shipped` gains FR-163. What Graview Cloud changes: it passes the `files` its route already answers to `mount`.
- 26dbe52: A record can hold a picture or a document (FR-162). A document's field may be `{"type": "image"}`, `{"type": "file"}`, or a `list` with `"of": "image"` or `"of": "file"`; a declaration says the same with `imageField()` and `fileField()` from `@graview/core` (`photo: imageField().optional()`, `papers: z.array(fileField())`), which `toDocument` writes as those types. The value is what the host stored, `FileValue`: `{ href, name, type, bytes, width?, height?, caption? }`, its `href` a path on the host under its base (`/graview/files/3f9a….jpg`, as Graview Cloud answers, or one relative to the page). A value whose `href` has a scheme of any sort (`javascript:`, `data:`, `https:`), names another host (`//…`), holds a backslash or climbs (`..`, `.`, `%2e`) is refused, by the store, a form, a seat's call and an import alike (`isFileValue`, `safeFileHref`): a record is written by acts, seats and imports as well as by an upload, and a `data:` picture would put the bytes in the log, where they do not belong.
  
  A file field is drawn wherever the record is drawn. On a card in the scene and a row of a list on the routed face, the record's first picture is drawn small; on its page and in the scene's record, its pictures are a gallery, each opening full size in a dialog that gives the keyboard back to the picture it opened from; a document is said by its name, its type and its size, a PDF shown inline and anything else a download. Every picture says what it is: its caption, else its name. A view's blocks gained `{ "image": "photos", "as": "thumb" | "gallery", "label"? }` for a card, a row, a page or a blocks lens; the check refuses one that names no image or file field (`view-image`) and an `as` it does not know (`view-format`). What draws them is fetched with the first file field drawn, never in the first paint.
  
  A file's value is a value like any other: set by an act and said in the history by its names ("Change Fix the roof: photos → porch.jpg, gutter.jpg"), undone, exported and remixed as any field, found by its name and its caption, and written by `graview types` as `FileValue` (or `readonly FileValue[]`). A change that leaves files no record holds says which: removing a record says "Remove Fix the roof and its 3 files", and a migration's plan lists them (`MigrationPlan.files`) and names them in its words. What becomes of the bytes is the host's to decide. An agent's tools describe a file argument as the object it is, and a seat may set one to a value the host gave.
  
  The hosted page carries none of it up front that it did not pay for: 587,604 bytes up front where main is 589,213, and 546,632 handed a compiled app where main is 546,912 (see the changeset that moved the forms and the field reading to entries of their own).
  
  Compatibility: additive. The document format gains the field types `image` and `file`, `of: "image" | "file"` on a list, and the `image` block, within `graview-document@1`; a build that predates them refuses them by path. The compiled format carries such a field within `graview-compiled@1`; a page that predates it refuses the compiled app (`compiled-shape`) and compiles the document, which refuses the type by path. Check finding codes: `view-image` is new, an error only about a block that could not be written before. Tool names are unchanged; the input schema of an `edit-<kind>` (or any act) whose kind has a file field describes it as an object. Ops, stored formats and the wire are unchanged. New: `FileValue`, `imageField`, `fileField`, `isFileValue`, `safeFileHref`, `filesOf`, `isImage`, `fileKindOf` from `@graview/core`; `fileFieldsOf`, `firstPicture` and `fileWords` from `@graview/core/blocks`; `ReadableField.files`; `ArgShape`'s `{ type: "file", image? }` and `FormField`'s `control: "file"`; `MigrationPlan.files`; `Files` from `@graview/primitives` and `/pages`. `capabilities().shipped` gains FR-162. What Graview Cloud changes: nothing until it writes a file field; then it reads `capabilities().shipped` for FR-162 first, and serves each `href` it answers to whoever may read the record.
- Updated dependencies [cf22161]
- Updated dependencies [8b7862d]
- Updated dependencies [26dbe52]
- Updated dependencies [26dbe52]
- Updated dependencies [26dbe52]
  - @graview/tools@0.1.26
  - @graview/core@0.1.26
  - @graview/primitives@0.1.26
  - @graview/react@0.1.26
  - @graview/pages@0.1.26
  - @graview/studio@0.1.26
  - @graview/layout@0.1.26

## 0.1.25

### Patch Changes

- 21365f6: An app fills the phone after it turns (FR-165). The embed took the height it was mounted with once, the whole-page Shell was `100vh`, the pages' seat stood in a fixed `100dvh`, and the scene passed over a box reported as nothing; on a phone turned to landscape and back, the app was drawn in the top half of the screen and stayed so, on both faces. `mount(element, { height: "viewport" })` now measures the screen itself: `innerHeight`, read again on `resize`, `orientationchange` and the visual viewport's `resize`, and once more a beat later for the phones that report a turn late. A height in viewport units — `100dvh`, `calc(100svh - 48px)`, the fallback inside a `var()` — is measured the same way, each `vh`, `dvh`, `svh` and `lvh` read as a hundredth of that figure. The Shell's height and the pages' seat follow the same figure (`useViewportHeight`, from `@graview/primitives`, `/frame` and `/pages`), and the scene reads its box again on every `resize`, so a box that comes back from nothing is followed. The on-screen keyboard does not shrink the app: the figure is the layout viewport's, which the keyboard and a pinch leave alone, so a lens is not laid out again for half a screen while somebody types; the browser scrolls the field into view. `capabilities().shipped` gains FR-165.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. `mount`'s `height` takes `"viewport"`, and a viewport unit in it is now measured rather than left to the browser.
- Updated dependencies [d0eb455]
- Updated dependencies [21365f6]
- Updated dependencies [21365f6]
  - @graview/primitives@0.1.25
  - @graview/core@0.1.25
  - @graview/tools@0.1.25
  - @graview/pages@0.1.25
  - @graview/react@0.1.25
  - @graview/studio@0.1.25
  - @graview/layout@0.1.25

## 0.1.24

### Patch Changes

- 9fe145e: A host's turn knows the app the seat is mounted with, so `describe_place` describes a lens place. Inside `HostAi.turn` the seat built its read tools from the store alone, and the chat's own runtime did the same, so a model asking `describe_place` for a lens or the declared home was told "is not a place this app has": the app never reached the seat. `GraviewProvider` now takes `app` and holds it on its context (`useGraview().app`), inheriting the app of a provider it is drawn inside; `mount` and `<Embed>` pass theirs on both faces, and `PagesApp`'s `context.app` reaches the provider under the pages. The chat hands it to its own tool runtime, to the workbench's agent seat and, as `ChatContext.app`, to a host's turn, whose `describe_place` now answers exactly as the runtime `graview mcp` serves does, for the seat that asked. With `app` given, a provider's reader `settings` default to `app.settings`. `graview create` writes `app` on the provider and on the pages' context. The hosted page carries 132 bytes fewer up front (589 625; 589 757 before), and as many fewer handed a compiled app (547 324; 547 456): the embed now hands the provider each option as given, which the provider's props accept as `undefined`, rather than spreading each one in only when it is set.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. New: `app` on `GraviewProviderProps`, `GraviewContextValue`, `PageContext` and `ChatContext`. Changed: `GraviewProviderProps`' `principal`, `seats`, `people`, `memory`, `presenceTtlMs`, `presence`, `brand`, `onKeepLens` and `ai` also accept `undefined`, which means the same as leaving them out. What a host does: one that mounts its own `GraviewProvider` passes `app={yourApp}` (and `app` in `PagesApp`'s context) so its seat and its turn can describe the app's lenses and home; `mount` and `<Embed>` need nothing.
- 129f2fa: A type lives where it is said first, so six of the import cycles that were left only in types are gone. The kit's types (`Kit`, `ConnectorKit`, `KitOverrides` and the rest) are the theme's, beside the `Brand` that carries them; `PagesArrangement` is the view registry's, which arranges by it; `Finding` and `Severity` are the check context's, where a finding is added; `validateScaffoldOptions` asks only the options a name can be wrong in; `settleAt` asks only the embed's options it reads; the seat's `SeatMove` and `SeatOffer` are the conversation's, whose replies carry them (`@graview/tools/go` still says both); and `KeptLens` is the reader's lenses'. Every name is exported from the same entry as before. Three are left, each for a reason: a `Store` is declared beside the store it describes; the document's views and its description of a place are being changed by this round's other work.
  
  Compatibility: ops, stored formats, the wire, the declaration and check finding codes, and tool names and input schemas are unchanged — only where a type is declared moved, and every entry exports what it did; the hosted page's first load is the same to the byte.
- Updated dependencies [6dbad14]
- Updated dependencies [e23f631]
- Updated dependencies [9fe145e]
- Updated dependencies [d13dc18]
- Updated dependencies [56f203f]
- Updated dependencies [cfe3b7a]
- Updated dependencies [a6c8da2]
- Updated dependencies [98105c4]
- Updated dependencies [e23f631]
- Updated dependencies [9fe145e]
- Updated dependencies [108721d]
- Updated dependencies [e23f631]
- Updated dependencies [eb9aac9]
- Updated dependencies [129f2fa]
- Updated dependencies [5b7e4c8]
- Updated dependencies [b68d1cc]
- Updated dependencies [32c54f1]
- Updated dependencies [791fb0c]
- Updated dependencies [56f203f]
- Updated dependencies [e23f631]
- Updated dependencies [8e1f679]
- Updated dependencies [9646578]
- Updated dependencies [129f2fa]
- Updated dependencies [6b60219]
- Updated dependencies [fe08229]
- Updated dependencies [3043dcc]
  - @graview/core@0.1.24
  - @graview/pages@0.1.24
  - @graview/react@0.1.24
  - @graview/primitives@0.1.24
  - @graview/tools@0.1.24
  - @graview/layout@0.1.24
  - @graview/studio@0.1.24

## 0.1.23

### Patch Changes

- Updated dependencies [8f7e998]
  - @graview/tools@0.1.23
  - @graview/core@0.1.23
  - @graview/pages@0.1.23
  - @graview/primitives@0.1.23
  - @graview/react@0.1.23
  - @graview/studio@0.1.23
  - @graview/layout@0.1.23

## 0.1.22

### Patch Changes

- 3399521: A shell with a rail of its own keeps the bar and goes without its places: `surface("shell", Shell, { without: ["places"] })`. n-dx's face lists its places in a rail, and the only way to stop the bar listing them again was `without: ["bar"]`, which also took away the switch between the scene and the pages, Find, the standing, who is here and the person. With `"places"`, the bar keeps every one of those and names no place on the pages, on the app's own address and inside an embed handed the same registry (`pages`). The scene's pictures are the scene's, and stay.
  
  Compatibility: unchanged.
- 3399521: A kind with no records folds into More until it has one. n-dx's projection of a v1 tree has no constraints, and the bar still said "Constraints" beside the work, whether `pages.primary` named it or the bar ranked it so. Now the bar does not stand an empty kind's list, or its pictures, on the row, declared and derived alike; they are in More, and the kind's first record brings them back. A graph with nothing in any kind folds none, since nothing yet says which kinds matter. The place you are on stands whatever it holds, and a list that is open keeps the row it opened over (FR-158). The embed's bar is drawn again as the graph changes, so the first record shows on the row without waiting for some other change. A kind's list on the bar is named the way every other surface names it (`pluralLabel`), so a kind with no declared plural reads "Shelf items", not "ShelfItems". The bar costs nothing more up front: the hosted page's first load is 24 bytes lighter than before.
  
  Compatibility: unchanged.
- Updated dependencies [9df7ef3]
- Updated dependencies [0f051ef]
- Updated dependencies [f25b52c]
- Updated dependencies [9154faf]
- Updated dependencies [9154faf]
- Updated dependencies [9154faf]
- Updated dependencies [3399521]
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
  - @graview/primitives@0.1.22
  - @graview/tools@0.1.22
  - @graview/pages@0.1.22
  - @graview/layout@0.1.22
  - @graview/react@0.1.22
  - @graview/studio@0.1.22

## 0.1.21

### Patch Changes

- 25019d4: The overview's address alone is the overview (FR-154). Graview Cloud: the framework wrote the overview at altitude as `/places/overview#overview=1` and read the altitude from the fragment alone. A fragment never reaches a server, so the same address back through any hop — the sign-in door, a stored link, a bookmark, or typed — came back as `/places/overview` and opened the overview descended on nothing: an empty scene whose control said "Up". Now `/places/overview` with no fragment, or with one that says nothing (`#`), opens the overview at altitude, on the Graview's face, under address routing in an embed and on a hosted page, and on any page that keeps its stop in the fragment (`UrlSync`, the whole-page Shell's `syncUrl`). The framework writes the overview at altitude over nothing in particular as the bare `/places/overview`, so the address it writes means the overview by itself: the bar's switch, Back to it, and "The whole thing" among the scene's places (`data-place-path="/places/overview"`). A fragment that says where it stands is read as it says: `#focus=t1` is the scene descended on that record, and `#overview=1&focus=…` the overview over it; a link written before, `/places/overview#overview=1`, still opens the overview and is tidied to the bare address in place, with no step Back would have to undo. Arriving at an address that says something no longer writes `#` and then pushes the stop: the page adopts the address with no entry. New in `@graview/layout/view`: `overviewStop` (the stop the overview's address holds) and `overviewFragment` (the fragment it carries for a view, none at altitude over nothing). `capabilities().shipped` gains FR-154.
  
  A host can delete its interim: Graview Cloud's `restoreOverview` in `packages/client/src/shell.ts`, which put `#overview=1` back on a bare `/places/overview` before the framework read the window, does nothing the framework does not do now.
  
  The hosted page measures 120 bytes more up front (593 498, under its 579.7 KB) and 120 more handed a compiled app (547 895, under its 535.2 KB).
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged; `capabilities().shipped` gains FR-154. Changed: the overview at altitude is written as `/places/overview` with no fragment where it was `/places/overview#overview=1` (an embed's address bar, the scene's "The whole thing" `data-place-path`); a bare `/places/overview`, or `/places/overview#`, opens on the Graview's face at altitude, whatever face the host names, where it opened the scene descended on nothing. `where()` still reports the overview's stop as `#overview=1`.
- f062004: What the review after 0.1.20 found, mended. A reader on Pages is said where they are on the others' bars (FR-155): the routed face said nothing of its own, so a reader on Pages stood at the scene's last stop on everybody else's bar, or nowhere, and inside an embed the face's own provider and the embed's both said where one tab was, two places by turns. Now the routed face says its page as the stop that page is on the scene — a record, its kind's group, a picture, the overview, nothing for the home, Find or the problems — through the one provider that says it (`sayWhere` on `useGraview()`), so the bar says "On Pay the deposit" for a reader on that task's page, by its label and never its id, and their figure on the scene stands at it. In the list of who is here a kind is said by its plural as the declaration says it, never its name as written, and the status a screen reader hears is written once it is on the page, so the first person to come in is said.
  
  Pages has Activity (FR-152). Once its ten seconds were up the notice that offered a change back went, and a person on Pages with a mouse had no way to the change at all: only ⌘Z, or Activity on the scene. The routed face's bar now draws the scene's Activity — each change with its own way back — fetched with the bar's panes once anything has happened, so a face nobody has changed carries none of it (`BarActivity` on `@graview/primitives/pages`). A popover closed by Escape gives the keyboard to its trigger as it is in the document now, by its `aria-controls`, and again a frame later if it was left on `<body>`, which WebKit did after the bar's Activity. A notice on Pages says a new offer after a change was taken back, where it went on saying "Took back …". On the scene, pressing an offer's Take back left the keyboard on the notice's ×, so every offer after, said in the same place, was held by a keyboard nobody had put there and never went; the keyboard lands on the app's name now, as it lands on the page's title on Pages.
  
  A seat's first act says a broken rule's values (FR-159): the words were fetched by a problems call alone, so an act answered before one said `introduces` and `resolves` without them; the seat's tools now fetch them before any answer, and a preview and an undo answer without the parts a page draws a line with, as an act does. A seat that may not see the records a rule's line reads is told the line over what it sees: a line worked out over the whole graph could name up to three of them, or sum their values, in a problem the seat may see, on Pages and through the seat alike (FR-55); an act's answer to such a seat carries no line. A problem judged before the words arrived is the same problem after (`problemsMoved`, `shapedRules`), so the scene's activity no longer marked every broken rule new once they came. A long text in a line is said as its first 60 characters. A problem row's tooltip is the rule's own sentence only where it wrote one. `role-may-do-nothing` reads an empty `sees` as keeping nothing from anybody, as the store does.
  
  The overview's address tidies a bare `#` too (FR-154): `/places/overview#` opened at altitude and kept its `#`. Under address routing a bare `/places/overview` is the overview at altitude whatever stop the host hands, the address being the source of truth there. The hosted page measures 593_607 bytes up front, 28 more than before, under its 593_612 budget; the pages face alone 535_766, 1_704 more, Activity and who is where among it.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. Changed: a presence's `stop` from a tab on Pages is that page's stop on the scene, where it was the scene's last; `violationKey(violation, shaped?)` takes the set `shapedRules(rules)` returns and keys a shaped rule's problem by its rule and record with or without a line; a seat served less than everything reads a problem's line, and its message's values, over what it sees, and no line in an act's answer; `preview_mutation` and `undo_batch` answer without `line`; a rule line says at most 60 characters of a text value; `POPOVERS.activity.drawn` names the embed and Pages too. New: `sayWhere` on the provider's context; `problemsMoved` and `shapedRules` on `@graview/core`; `BarActivity` on `@graview/primitives` and its `/pages`. What Graview Cloud changes: nothing; on Pages a person reaches what changed and takes a change back from the bar, and a reader there is said where they are.
- 6bf435a: The way back leaves, and the scene has one (FR-152, FR-153). Graview Cloud, on staging in a deliverables app on 0.1.18: after an act on the Pages face the notice with "Take back …" stood at the foot of the picture for the rest of the session — it did not go, and nothing on it closed it — so every page carried a stale offer; and Down in a district on the scene there was no history, no activity and no undo in reach. On the Pages face the way back now comes with an act made there, and goes: after ten seconds (`WAY_BACK_MS`), with the next act's own offer in its place, with a move to another page (not the move an act makes itself, a record made and opened), and with the × that is now on it, a button named "Dismiss: Take back “…”" that the keyboard reaches from the way back, which keeps the change and lands the keyboard on the page. A change made before the face was drawn is not offered. ⌘Z or Ctrl+Z still takes the last change back after the offer has gone, and a `PageUndo` a design places in its own row still stands while there is a change to take back. On the scene, the whole-page Shell and an embed alike, an act is said on the app's board of notices in its own words with Take back, for as long, and ⌘Z or Ctrl+Z takes the last change back while the keyboard is in the app (anywhere, under the Shell; never from inside a text field); taken back by either, or from Activity, the offer goes and "Took back “…”" is said. Activity is in the scene's bar at altitude and Down in a district, with the change and its undo. A toast, the way back's or any other, now stands while a pointer is on it or the keyboard is in it, and stands its whole time again when its time comes while it is held; a kept lens's "Take back" goes after ten seconds rather than waiting for an answer. An embed made without a board of notices hands the one it draws to the faces under it, so what a face says there is drawn. Nothing moves: nothing animates as a notice comes or goes, so there is nothing for reduced motion to stop. What judges and draws the way back is fetched when it is first needed — on the scene once it has drawn, on the Pages face with the first change — so a hosted page loads 93 bytes more up front, the scene 483 bytes more before it draws, and the Pages face 2,648 bytes fewer. `capabilities().shipped` gains FR-152 and FR-153.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged; `capabilities().shipped` names two more ids. Changed: the Pages face's docked way back (`face-undo-dock`) shows only after an act made since the face was drawn and goes after ten seconds, so a harness that made a change and looked for `page-undo` later than that, or after a page move, finds none — press it within ten seconds, or use ⌘Z; its panel is `page-undo-notice`, with `page-undo` and `page-undo-dismiss` in it. The scene now says an act on the board as a toast with an act "Take back", which stacks with a host's own toasts. `NoticeBoard` gains an optional `hold(held: () => boolean)`; a board made by `createNoticeBoard` has it, and a host's own board without it keeps its toasts' times as they were. What Graview Cloud changes: nothing it must; its staging app's offer now leaves, and its scene has the way back and ⌘Z without anything of its own.
- Updated dependencies [5f2f3aa]
- Updated dependencies [b4ea9b7]
- Updated dependencies [615f368]
- Updated dependencies [eaffce3]
- Updated dependencies [25019d4]
- Updated dependencies [f062004]
- Updated dependencies [6bf435a]
  - @graview/core@0.1.21
  - @graview/layout@0.1.21
  - @graview/primitives@0.1.21
  - @graview/tools@0.1.21
  - @graview/react@0.1.21
  - @graview/pages@0.1.21
  - @graview/studio@0.1.21

## 0.1.20

### Patch Changes

- 95a7248: The scene from a page that is nothing lands where the scene opens (FR-157). Graview Cloud, on the Pages face at an address no route answers ("Nothing lives at this address."): the bar's Scene control landed the scene at `/places/overview#`, the empty view, the overview off, the control saying Up, over nothing. The pages leave the scene's view holding nothing when no page named a place in it, and the switch drew exactly that. Now, when the view the switch would take holds nothing (no focus, not at altitude), it lands where the scene opens: where the declaration says the app opens (`pages.first`, FR-80), else at altitude, on the Graview's face. Under address routing the address pushed is that stop, a step Back undoes as before; under memory routing the scene's view moves there when the face comes back from the pages. A list page holds nothing in the scene either, so the switch from one now lands the same way, where it drew the empty view. A view that holds a focus or is at altitude is taken as it was. `capabilities().shipped` gains FR-157.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged; `capabilities().shipped` gains FR-157. Changed: the face and the stop the switch's Scene lands on from a page that held nothing in the scene, which a host told by `onFace` now hears as `"graview"` when the app names no first place.
- Updated dependencies [22c88be]
- Updated dependencies [ea77694]
- Updated dependencies [95a7248]
- Updated dependencies [95a7248]
- Updated dependencies [247506b]
- Updated dependencies [95a7248]
  - @graview/core@0.1.20
  - @graview/react@0.1.20
  - @graview/primitives@0.1.20
  - @graview/pages@0.1.20
  - @graview/tools@0.1.20
  - @graview/layout@0.1.20
  - @graview/studio@0.1.20

## 0.1.19

### Patch Changes

- 46f2ac8: Small truths after the cleanup. A record described by `describePlace` is at the address the routed face gives it. It was `/deliverable/a b`, an address no page answers; it is now `/deliverables/a%20b`. A seat handed a face's store and views lists the places the declaration does. It now orders the pictures as the arrangement does and calls the scene what the bar calls it, where before it said "Scene" whatever the app named it. `placesOf` and `placesFromViews` are one builder now, and a test holds them equal on every example app. A model's tool for an act is titled what the actions strip and the seat call it: "Mark done", not "MarkDone".
  
  A kind that declares no plural is called by one rule everywhere: its name in words and an "s", split as `humanizeField` splits a name, so `shelfItem` is "shelf items". Standing alone as a label (a heading, a hit, a group's name, a button or link that starts with it) it starts with a capital: "Tasks", "Shelf items". Inside a sentence it does not: "Turn off tasks". Its address keeps the name as written (`/shelfitems`). The relation key, seeding, the trail, the road map, the module switch, the band's groups, edge signs, the columns lens and Find had each said the bare kind or a humanized one. Keeping a lens, `graview describe` and Find give a place's address with one rule, adding `?of=` where two kinds share a name. The relation key drawn on its own is as wide as the Key's pane, where it was capped against a left rail the scene no longer reserves.
  
  The keyboard always lands somewhere in Firefox and Safari on macOS too. Those browsers do not focus a button when it is clicked, so pressing Keep on a drawn view took the keyboard off the seat's field without giving it to Keep, and Keep was then taken away with its frame: the keyboard was left on the page's body. A press on a control while the keyboard is nowhere now counts as where it stood. The same rule reads its root's own document and asks nothing once that window is closed, so a timer it set just before a page was torn down no longer reads a document that is gone.
  
  Compatibility: ops, stored formats, the wire, the document format, check's finding codes and tool names are unchanged. New in `@graview/core`: `pluralOf`, `pluralLabel`, `actTitle`, `kindPath`, `recordPath`, `placePath`, `sharesItsName` and `placesFrom`. `@graview/layout`'s internal `pluralOf` and `@graview/pages`' `pluralSlug`, `recordPath` and `placePath` now call them, with the same results. Changed:
  - `describePlace(…).place.address` for a record is `/<plural slug>/<encoded id>`, not `/<kind>/<id>`.
  - `placesFromViews` returns places in `placesOf`'s order, and takes `pages` (the arrangement), from which it names the scene with `sceneTitle`.
  - A tool's `title` and `annotations.title` for an untitled act is `humanizeField(name)` ("Mark done"). It was the name with only `-` and `_` spaced ("MarkDone").
  - For a kind with no declared plural:
    - Inside a sentence it is now "tasks" where the bare kind was said: the module switch says "Turn off tasks", not "Turn off task".
    - As a label it is "Tasks": `kindMap(…).kinds[].plural`, `placesOf(…)`'s kind titles, the routed face's titles and links, the relation key's ends, seeding's plan, the context menu's subject, the way back up, the trail's crumb, the columns lens's label and edge signs. These said "task", "tasks" or "shelfItems" before. Find's kind hit and a band group's words keep "Tasks".
    - A camel-cased, snake_cased or kebab-cased name is said in words: "shelf items" in a sentence and "Shelf items" as a label, where the routed face said "shelfItems". Addresses are unchanged: `kindPath` keeps the declared plural, or else the name as written and an "s".
  - `RelationKey` drawn on its own is capped at `min(280px, calc(100% - 28px))`, the Key's pane's width, not `max(110px, calc(min(250px, 22%) - 32px))`.
  - A click on a control while nothing holds the keyboard now lands the keyboard beside that control if the control is then removed.
- 46f2ac8: A cleanup after the seat. Graview Cloud's hosted page carries 9.5 KB less before the app draws: 577.3 KB where it was 586.6 (532.7 handed a compiled app, where it was 542.0), which leaves Cloud's shell about 17.5 KB under its 595 where it had 8. The rules for what only the scene draws — a district's card and its drive-in, the altitude control, the others in the city and the seat's marks — were still in the sheet every face draws up front. They are the scene face's now, drawn with the scene as the plots and the roads already were.
  
  Typing in Find at a big hub fits one frame again. The scale harness's worst frame typing at the discography's hub was 38 ms, and 55 on a slower run, against its 50. It is 20 now. The hits are a set made once per search, not twice per band card. A host keys what it lights by a hash, not a string of every lit id. The layout no longer reworks the flagged and the log's weights for each keystroke. A record's words are folded once. The ranking uses one collator. `isCurrent` reads the clock only for a kind whose lifecycle is a date.
  
  The same thing is said once where several packages each said it: a sentence's first letter, an act's name in words, a kind counted, a kind's card named, and where an embed lands on a stop that names a place. Comments and test names that still spoke of the companion and its rail now speak of the ask field and the panel. The nightly runs the seat-guide harness where it still asked for the companion's, which had stopped its whole shard. The rule that lands the keyboard somewhere stops asking once its root is unmounted, rather than reading a document a test had already torn down.
  
  Compatibility: internal; no public name, export, behavior or format changes. `themeBaseCss` no longer carries the scene's rules named above; `sceneCss` does, and `themeCss` carries every rule it did.
- 46f2ac8: The host decides the AI, once, and a reader never sees a rung. The seat had a ⚙ that opened "What answers" — "this graph", "on this device", "Jev, which decides", "a model, with my key", with a key field for whoever had one — the same pills again as "Answers come from" in the person's menu, "graph-native" under the field, "Let a model read it →" under a sentence the graph could not read, and answers that ended "(Jev decides rather than talks — the graph is answering here.)". A person asking what is overdue was being asked which machine should answer. Now the AI a seat may use is the host's, given as `ai` on `GraviewProvider`, `mount`, `<Embed>`, a routed face's context or `PagesApp`'s, and the studio's seat uses the app's own: `{ complete }` is the host's model (prompt in, text out), `decide` a decision provider such as `jevDecide(...)`, `onDevice: true` a model in the reader's browser, and `name` what the op log records. The graph answers first, always — where things are, what is wrong, what a record says, the repairs a rule names, a view a template draws — and an open question, or a view no template draws, goes to the host's model when there is one. With none, it is answered "I can answer about what's in this app. Open questions need AI, which isn't on here."; an answer a model gave carries one quiet "Answered with AI", and one the graph gave carries nothing; a model that fails leaves the graph's answer with "(AI didn't answer just now, so this is from the app alone.)", and an on-device model a browser cannot run says AI isn't available there. A decision goes to the host's `decide`, else to a decision provider the app's declaration names (`kind: "decision"`, through the dev server's door at its `bridge` or `/__graview/decide`), else to the host's model behind the parse-and-refuse layer, else to the graph's own rules. Every guarantee holds: what the seat may see, declared acts only, previews, undo, and the log's attribution — a change a model proposed is applied with `via: "ai:<name>"` ("ai:model" when unnamed), which Activity does not show a reader. Taking the picker out shrinks what a page carries: Cloud's hosted page 806 bytes up front, the scene face before it draws 2.2 KB and the pages face 6.3 KB, the pages face alone 6.1 KB and every face 8.8 KB.
  
  Compatibility: breaking for the components and the API a host's seat reaches; ops, stored formats, the wire, the document format and tool schemas are unchanged. Added: `HostAi` (`complete`, `decide`, `onDevice`, `name`), `NO_AI`, `NO_AI_SAID`, `ANSWERED_WITH_AI`, `aiTalks`, `aiVia` (`@graview/tools` and `@graview/tools/frame`), `seatResponder(ai, { floor, onStatus })`, the `ai` prop on `GraviewProvider` and `useGraview().ai`, `ai` on the embed's `mount`/`<Embed>`/pages options and on `PageContext`, `via` on `ChatReply` and `SeatTurn`, `via` on `ToolRuntimeOptions`, `failed()` on what `localCompletion` returns (whose `warm()` now returns a promise), and the test ids `seat-answered-with-ai` (`<testId>-answered-with-ai` on any seat's thread) and `<testId>-header` on `SeatHeader`. Changed: `completionFor(ai)` and `decideFor(ai, { intelligence })` take the host's `HostAi` and the app's declared providers; a graph answer it could not read is `unsure`; `viaSaid` says nothing for `ai:<name>`. Removed: `IntelligenceConfig`, `IntelligenceSource`, `DEFAULT_INTELLIGENCE`, `RUNGS`, `rungFor`, `rungHonesty`, `loadIntelligenceConfig`, `saveIntelligenceConfig`, `describeIntelligence` and `configuredResponder` (`@graview/tools`, and the first seven from `@graview/tools/frame`); `LadderSetting`, `SeatSettings` and `describeSource` (`@graview/primitives`, `LadderSetting` from `@graview/primitives/pages` too); `useGraview()`'s `intelligence`, `chooseIntelligence`, `hostAnswers` and `registerHostAnswers`; `ChatPanel`'s `settings` and `onSettings`; `SeatHeader`'s `source`, `sourceTitle`, `settings`, `onSettings` and `foot`; `SeatThread`'s `onChooseModel`; the reader's stored rung (`graview:intelligence` in their browser, no longer read). Test ids removed: `seat-settings` (⚙), `seat-source`, `seat-ladder`, `chat-settings`, `chat-source`, `chat-ladder`, `<testId>-offer-model`, `studio-agent-settings`, `studio-agent-source`, `studio-agent-ladder`, `setting-intelligence` and its `setting-intelligence-graph`/`-local`/`-decision`/`-remote`/`-why`, `intelligence-key`, `intelligence-decision-key`, `intelligence-provider`, `intelligence-model` and `intelligence-base-url`. What Graview Cloud changes: pass its model to the app as `ai: { complete, name }` on `mount` (and `decide` if it holds a decision provider) — its users see no choice and no rung's name; a harness that opened `seat-settings` or read `seat-source` reads the answer, its "Answered with AI" (`seat-answered-with-ai`) or the "isn't on here" sentence instead; nothing on the wire or in stored apps moves.
- 46f2ac8: The whole-page Shell's scene wears the one app bar, exactly as an embed's scene face does. The Shell had kept a bar of its own on the scene: a wordmark, the browser's back and forward drawn again as ← →, "Lists", the trail, the places as tabs, Find, the standing, Activity and the person. An embed and the routed face wore the `AppBar`, so the same app looked like two apps, and on a phone the Shell's bar wrapped to three rows. Now both draw the app's mark and name (the way home, to the pages' front page), the Scene and Pages switch, what the scene shows and every picture it can (standing on the row where they fit, under "More" or one control where they do not), Find, Activity once something has happened, the standing and the person. It is one row of at most 48 px at a desk and on a phone, with the place on the page's first line under it on a phone, as an embed's is. The scene's Find and Activity are put in the bar by the scene face, the Shell's and an embed's alike, so a page that opens on the pages never fetches Activity. What the bar said about the picture rather than the app is on the picture, in its top corner opposite Up, and only while it holds: "the past", "zoomed in", "moved", a raised relation and whose stop you follow, each with its ×. The record in focus is not named again over its own card; Escape, the browser's own back and forward, and the bar's places are the way back.
  
  A day the framework puts in a sentence is said as a card's glance says it. "Pay the deposit" was due 2026-08-28 on the bar, in the problems and to the seat while the task's card said 28 Aug 2026. Now a rule's message says "was due 28 Aug 2026" however the rule wrote it, and a template's `{due}` or `{due | date}` says the same. A record's facts say a day the same way too. The edit control alone holds the day as it is kept, which it writes back. A choice is said as it is declared (its `display.format`), else spoken: "Tue", never "tue". The edit control's options are said the same way. The todo example no longer declares its weekdays upper-case. A date filter asks for its day beside the filter with the browser's own date control and an "Add", not the browser's prompt that asked for "(YYYY-MM-DD)", and its chip says "Due before 15 Sep 2026". The rota example opens on its own fortnight rather than the real week, which was empty without `?today=`.
  
  The place tabs' rules left the sheet every face draws for the tabs' own, and `viaSaid` is a module of its own, Activity's alone. A hosted page's first load is 578.0 KB, 0.7 KB over the cleanup's, and 533.4 KB handed a compiled app: the days and choices said as read, and the bar's place for the scene's own tool. Every face of the embed carries the scene's Activity: about 6.5 kB more minified.
  
  Compatibility: ops, stored formats, the wire, the document format, check's finding codes and tool names are unchanged. Changed: the Shell's scene bar is the `AppBar`. Its test ids are `app-bar`, `app-home`, `app-name`, `app-faces`, `app-face-scene`, `app-face-pages`, `app-find`, `app-find-open`, `app-places-open`, `app-place-scene:<kind>:<as>`, `standing`, `activity-button` and `profile-button`. `wordmark`, `backtrack`, `pages-link` and the scene's `places` and `place-<as>` tabs are gone from it. On a phone, Find is behind the bar's magnifier. `ShellProps` loses `nav` and `homeLabel`; `pagesHref` now names where the switch's Pages and the way home go, and `null` draws no switch. `Wordmark` and `Backtrack` are no longer exported from `@graview/primitives`. The scene's view chips (`past`, `zoomed`, `moved`, `raised`, `following-who`) are drawn on the picture, in a `nav` named "View" (`trail`), and the scene draws no crumb of the record in focus (`focused`). `ReadableField` has `stored`, the value as kept. `readableFields` says a `YYYY-MM-DD` value as "28 Aug 2026" and a `z.enum` value through `valueWords` in a record's facts as on a glance. A rule's `message` says every standalone `YYYY-MM-DD` as the glance does. A template's `| date` and a bare day say "28 Aug 2026". `EditableValue` takes `stored`. The arrange bar asks a date condition's day with `arrange-day` and `arrange-day-add`, never `window.prompt`. New: `AppBar` lists a scene's places without a switch when it is given `scenePlaces` and no `faces`, and hands the face a place for its own tool (`BarFind.own`). `SceneBarTools`, `SceneTrail` and `useCallLog` (from `@graview/primitives` and `/scene`), and `dayAsRead` and `daysAsRead` (from `@graview/core`).
- 46f2ac8: The seat floats, and is quiet, on both faces. It was a rail down the scene's left edge — "SELECTED · Pay the deposit", nine acts with nine stars, a filter field, "Show 1 more", three canned questions, the relations, a log of what it did, "What the lines mean" and "graph-native" — and on Pages a "◆ Ask" pill that opened the same rail as a drawer beside the record page's own acts, with a "Close" pill over it on a phone. Now there is one quiet field at the foot of the picture, "Ask Things…", with the Find box's geometry. Asked, it grows up from the field into a panel over the app, never pushing the page: one plain line about where the reader is (the problem on what they are looking at first), at most three things to ask built from the graph (`suggestionsFor`, `whereLine` and `offeredActs` in `@graview/tools/suggest`), at most three acts — only the repairs a broken rule names for that thing and the reader's own pins, each said about it ("Give Pay the deposit a new date") and never in a mutation's name — and the conversation, where a name is a link that goes there and a proposal is one line with "Do it" and "Not now". Every other act is one question, the context menu (right-click, or A on a card, which now opens the menu at the card) or Pages' "What can be done" away. ⇄ snaps it to the other foot; on a phone it is a bottom sheet with a grab line. The source that answers is said under ⚙ and nowhere else, and the person never reads the word "seat". It is a region named "Ask Things": opening it puts the keyboard in the field, Escape closes it and puts the keyboard back, and the latest answer is said aloud. The conversation now belongs to the app, held by the provider and kept in the tab's session storage, so it is still there after a switch between the scene and Pages, and Find's last row, "Ask: ‘…’", opens the seat with what was typed. "What the lines mean" is a "Key" beside Up. The scene gets the rail's width back and keeps a 64-pixel strip at its foot clear of cards for the field. The panel is fetched when the seat is first opened; what a page carries up front grows by the conversation's holder, about 1.3 KB. `graview check` warns of an act with no title (`act-without-title`), which every surface had offered in its mutation's name; an untitled act is now offered with that name spoken ("Move to list").
  
  Compatibility: breaking for the look and the components a host or an app's shell reaches; ops, stored formats, the wire, the document format and tool schemas are unchanged, and check gains one warning code, `act-without-title`. Removed: `Companion`, `CompanionProps`, `CompanionMode`, `COMPANION_TAB` and `COMPANION_OVERLAY_BELOW` (`@graview/primitives`, and `CompanionMode` from `@graview/embed`); in their place `SeatField`, `SeatFieldProps`, `SeatStart` (`"field" | "hidden"`), `SEAT_WIDTH`, `SEAT_PHONE_BELOW` and `LinesKey`. The Shell's `companion` prop is now `ask` (`"field"` or `"hidden"`), and the embed's `companion` option is now `seat` (`"field"` or `"hidden"`); the open/collapsed rail and the reader's remembered choice (`graview:companion:<app>`) are gone. `useGraview()` loses `railLeft` and `registerRail` and gains `seatTalk` (`createSeatTalk`, `useSeatTalkState`, `useSeatDrawn`, `seatTalkKey` and the `SeatTalk`, `SeatTalkState`, `SeatTurn`, `SeatOutcome` and `SeatSide` types in `@graview/react`); the scene lays out with 8 px on its left at every width. `Inspector`'s `placement` is `"float" | "menu"` (`"rail"` is gone), and `placement="menu"` lends the cards their acts key; `ACTS_KEY` moved to the inspector. `ChatPanel` is the conversation alone — no pill, no popover (the `chat` popover is gone from `POPOVERS`), `inside` removed, with `shared`, `composer`, `empty`, `settings` and `onSettings` added — and its proposals are "Do it" (`<testId>-apply`) and "Not now" (`<testId>-decline`). `useSeatConversation` takes the `talk` it keeps the conversation in. `useSubject({ hover })`. `FOOT_OBSTACLES` is `[data-graview-foot]`. Pages: `PageAsk` draws the seat in a box `page-seat`; `askPlace(box, view, need)` returns that box's `{ shown, left, top, width, height }`. Test ids and attributes removed: `companion`, `companion-tab`, `companion-dock`, `companion-subject`, `companion-state`, `companion-acts-key`, `companion-said`, `companion-asking`, `companion-show-me`, `companion-log`, `companion-key`, `data-graview-companion`, `-companion-mode`, `-companion-shape`, `page-ask`, `page-ask-drawer`, `chat` (the pill), `chat-panel` inside the seat (now `seat-panel`), `chat-draft` inside the seat (now `seat-field`), and the scene's `inspector-strip` on a selection (the scene's selection draws no strip; the acts are the context menu). Added: `seat`, `seat-field`, `seat-panel`, `seat-body`, `seat-here`, `seat-where`, `seat-suggestion`, `seat-act`, `seat-side`, `seat-settings`, `seat-source`, `seat-close`, `seat-grab`, `seat-said`, `seat-apply`, `seat-decline`, `seat-pick`, `seat-question`, `find-ask`, `lines-key`, `lines-key-pane`, `page-seat`, `data-graview-seat`, `data-graview-seat-side`, `data-graview-seat-shape`. What Graview Cloud changes: pass `seat` where it passed `companion` (or nothing, for the field); a shell that drew `Companion` draws `SeatField`; a harness that looked for `companion`, `page-ask` or the scene's inspector strip looks for `seat`, `seat-field` and the context menu; a layout that reserved the rail's 264 pixels keeps 8; nothing on the wire or in stored apps moves.
- 46f2ac8: The seat takes you where you ask and draws a view you can keep as a lens, on both faces. What the resolver and the drafting engine answered is now what the seat does. An answer's moves are made by the face it is asked on. The scene sets a stop through the provider, so the address follows it and Back walks out of it: a picture, a kind's district narrowed by `in.filter`, a record focused, and for "what's wrong" the standing's problems opened. Pages navigates to the move's address. In an embed it is the same provider's view and the same router, so `where()` stays true. The seat says each move in a sentence ("Went to The week."), and the name in it is a link that goes there again. A list the resolver could not narrow offers "Show as a view", which draws those records. The seat's conversation is handed the places it may go to and the place the reader stands in, and an app pinned to a day (`?today=`, a test, a replay) is asked about that day: `Store.today()`. Asked for a way of seeing ("Show tasks as a board by day", "a board of decisions by status", "who covers what"), the seat draws it with `@graview/tools/draft`, fetched with the first such ask. The draft stands in place of the picture: over the scene, under the seat, and on Pages in the main column at `/~draft`. It sits under one hairline line, "Draft — Tasks by day · Keep as a lens · Discard", and is live on the app's data as the reader may see it. Asking again ("as a calendar", "group by status", "only this month") replaces it. An ask that cannot be drawn says why in one line ("Couldn't change that: tasks' notes is not a choice…"), and the last good view stays. Keep hands the check-clean `add-lens` edit to the host (`onKeepLens`). A host that writes the declaration answers `{ kept: true }`, and the lens is in the places for everyone. Otherwise, and in an app declared in code, it is kept as the reader's own in this browser, under "Your lenses". Where a host could not write it, the seat says so: "Ask the owner to keep it for everyone." Either way it joins the place list beside the app's own, and the face goes to it. Take back, in a notice and in the conversation, hands the host the `remove-lens` edit or drops the reader's own, and the place goes. With nothing asked yet, the seat offers at most three things in the reader's words: what is wrong, then what falls due this week (else another picture to go to), then a board a shipped lens can draw ("Show tasks as a board by day"). Every one is answered without a model. On the hosted page, the frame, the resolver and the drafting engine are fetched when asked, never up front; `@graview/tools/keep` is never on the page at all. Up front the page carries 1.9 KB more, for the reader's kept lenses laid beside the app's own places as a face opens.
  
  Compatibility: ops, stored formats, the wire, the document format, check's finding codes and tool names are unchanged. New: `GraviewProviderProps.onKeepLens` and the embed's `onKeepLens` option, and on Pages `PageContext.onKeepLens`. Each is a `KeepLensHost`, handed an `add-lens` or a `remove-lens` edit and answering `{ kept, said? }`; the types `KeepLensHost`, `KeepLensAnswer`, `LensEdit` and `SeatKept` come from `@graview/react`. Also new: `SeatTurn.moves`, `.offer` and `.kept`, and `SeatTalkState.draft` and `.draftNote` with `SeatTalk.setDraft`; `ChatContext.today`; `Store.today()`; `ViewMeta.beside` and `ViewRegistry.forget`, a place reached by its name that takes no kind's default picture, and taking one away; `useSceneGo` from `@graview/primitives`, and `DraftDoor` from `@graview/primitives`, `/scene` and `/pages`; `registerReaderLenses`, `readerLenses`, `appKeyOf`, `registerLensPlaces` and `NoticeBoardContext` from `@graview/primitives` and `/frame`; `ChatPanel`'s `onMove`, `place` and `onDraft`, and `SeatField`'s; the routed face's `/~draft` route; and the test ids `draft-frame`, `draft-line`, `draft-title`, `draft-keep`, `draft-discard`, `draft-note`, `draft-lens`, `seat-went`, `seat-offer` and `seat-take-back`. Changed: the Shell always draws a notice board, its own when the host gives none. A seat move to a picture or a record drops a narrowing an earlier ask left on the stop. What Graview Cloud changes: to keep a drawn lens in an app opened from a document, pass `onKeepLens` to `mount`. Apply the `add-lens` edit (or `remove-lens`, to take it back) to the stored document as its other declaration edits are applied, or with `keepLens`/`takeBackLens` from `@graview/tools/keep` on the server, and answer `{ kept: true }`. Then hand the embed the new document with `setApp` when it is written. Without it, a reader's kept lens stays theirs, in their browser.
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
  - @graview/react@0.1.19
  - @graview/tools@0.1.19
  - @graview/primitives@0.1.19
  - @graview/pages@0.1.19
  - @graview/layout@0.1.19
  - @graview/studio@0.1.19

## 0.1.18

### Patch Changes

- 44d109d: A part of the page that fails to load tries again, and never breaks the page (FR-139). Graview Cloud's realtime harness takes a person's browser offline for a moment, and where the person's menu had not fetched its part yet, the page fetched that chunk while offline. The import failed, and Chromium and Firefox keep a failed module for the page's life: an `import()` of the same URL fails again at once, without a request. From then on the menu opened with only "Keeping this app", without the seat, the host's actions or "Report this app", each open threw "Failed to fetch dynamically imported module" inside the embed, and only a reload brought it back; about half of Cloud's runs on 0.1.17 failed on it. Every part a page fetches as it is first drawn now goes through one loader, `retryingImport` (`@graview/core/retry`, a page's entry only: workerd, where a host runs core, tools and ship, refuses a script with an `import()` of a computed URL in it, reached or not, so nothing a server imports reaches it), which asks again after a failure: where the failure names the URL it could not fetch (Chromium and Firefox do), it imports that URL with `?retry=<n>`, another URL and so another fetch, whose own imports resolve to the chunks the page already holds; where it names none (WebKit, which asks again on its own), it calls the bundler's import again. React parts are drawn with `lazyModule` (`@graview/react`): until a part arrives, its place says so in one line — "The rest of your menu will load when you're back online." or "… didn't load." — with a real "Try again" button, its words a polite status, and nothing is thrown. It is asked for again when the browser says it is back online, when the part is drawn again, when somebody reaches for what holds it, and when "Try again" is pressed, which asks for every part that failed; when it arrives with the keyboard on the button, the keyboard goes to the part's first control. That covers the person's menu (its top says so once, the rest waits quietly), the problems' rows (a list item in the list), the row that arranges a list, the framework's views, the declared lenses and the home view, the embed's faces (`preload` resolves either way now), the scene's keeping controls and the studio in the menu, the assistant on the pages, the rules for settling a handed-back place (asked again online or every ten seconds), and the guest host's drawing, press reader and worker (a worker view's host asks again when the browser is back online; a view whose drawing did not arrive stops with the plain face, "start"). What a server may also run — the compiler `appFromOrCompile` fetches, the agent seat's describer and the view runtime `viewScript` reads — keeps a literal `import()` and forgets a failure, so the next call asks again, without a URL of its own. The person's menu is fetched when the page is idle and online (`requestIdleCallback`, or 2.5 seconds after it draws where there is none), so it is rarely needed offline. What cannot be mended: a chunk that arrived while one of its own imports did not; the failed import is kept under its own URL, which no query on the importer changes, and only a reload gets past it. `pnpm verify offline` mounts the embed as a host does, in Chromium, WebKit and Firefox, takes the browser offline the moment the app has drawn with the menu's chunk refused from the start, and holds that the menu says so in one line with no page error, that the next open back online is the whole menu — the same controls as a page never offline, "Report this app" among them — without a reload, and that "Try again" from the keyboard keeps the keyboard while it cannot arrive and puts it on the menu's first control when it does; on main the menu's open threw in every engine. The hosted page carries 575.8 KB compiling (572.7 with the bar that fits its box alone) and 532.1 KB handed a compiled app (528.9); its budgets rise by that to 576 KB and 532.25 KB, which leaves Cloud's shell 19 KB under its 595. `capabilities().shipped` gains FR-139.
  
  Compatibility: markup and behavior a host holds, a new entry `@graview/core/retry`, and new exports in `@graview/react`. New: `@graview/core/retry` and its `retryingImport`, for a page only (the main entry, tools and ship's runtime carry no computed `import()`, which workerd refuses); `lazyModule`, `retryLazyParts`, `LazyModule` and `LazyPartOptions` (`@graview/react` and `/provider`); the line `[data-testid="lazy-part-missing"]` and its button `lazy-part-retry`, drawn in a part's place while it has not arrived. A part that did not arrive draws that line where it threw into the embed's boundary (the "@graview/embed threw while rendering" report); `preload` resolves when a face did not arrive, where it rejected. `fetchFrameworkViews`, `fetchDeclaredLenses` and `fetchHomeView` ask again on the next call after a failure, where they kept the failure. `viewScript` moved within `@graview/guest` to a file of its own, exported where it was. What Graview Cloud changes: nothing is required; its realtime harness should stop failing on the menu. A harness that takes the browser offline may wait for `lazy-part-missing` in the menu while offline, and for the menu's host actions on the next open once back online. Ops, stored formats, the compiled-app format, wire messages, check finding codes and tool names and input schemas are unchanged.
- b00d5cf: A view of one record sits beside the record's editable fields, a view can offer a record's long text to edit without retyping it, and the views guide says what a view is handed (FR-149, FR-150, FR-151). On Graview Cloud, Nick's "Farm Bureau POM Workshop" has a deliverable with a three-thousand-character `draft`; a chat wrote a worker view of it (`attach: "deliverable"`, `cardinality: "one"`), and once applied the record on the scene was the view alone, labeled "Made by Claude, for nick", with no way left to change the draft. Registering a worker view of one record now draws it above what the registry drew for the record before: on the scene the record drawn at full is the view and then the record's own fields, each editable where an act writes it; on Pages the record's page is its heading, the view, then its facts and what can be done, as it was. A manifest that says `replaces: "page"` draws the view alone, as before, and on Pages without the facts, the links and the acts (what is wrong and what has happened stay); `checkManifest` refuses any other value, and `replaces` on a view of many or of the home. The views guide said a write takes only what the person typed — "Do not prefill" — so a view that offered "Edit draft" asked for all three thousand characters again. Now a view marks a field and the host fills it: `<textarea name="draft" data-prefill="draft">` in a `fieldset` bound to the record is filled, after the view draws it, with that record's `draft` as the viewer sees it, whole and with its line breaks, when an act in the fieldset is named in the manifest, is done to that record, takes `draft`, writes it (its `writes`, or an argument named like the field), writes no other record's fields, and may be run there by this viewer; otherwise it stays empty, so a seat that may not write the draft is never handed it to edit. The filled value is the viewer's to edit, and a press carries it only back into the field it came from: pressed for another act that takes it, it is refused `untyped`, and a view that writes into the field after the host filled it makes it the view's, as ever. The value is a field of a record the view was already shown, so prefilling hands the view nothing new, and it can be saved only where it came from. And the guide said each of `props.nodes` had `fields`; a record's fields are on it by name (`node.draft`, `node.status`), beside `id`, `kind` and `label`, and a view of one finds its record in `props.node`, never in `nodes`. A view written to the guide drew nothing. The graview-worker-view skill, `@graview/guest`'s README and `GuestNode`'s documentation now say so, and the skill gains a worked example of a view of one record (`examples/a-record.js`: a deliverable's subject and its draft as paragraphs, and "Edit draft" prefilled), which a test runs headless over the workshop in miniature so the guide cannot drift from the props again. `guest-sandbox --transport=record` holds it in Chromium, WebKit and Firefox, with the skill's own example on Cloud's workshop in miniature: on the scene and on Pages the view and the record's editable fields are both drawn, `replaces: "page"` draws the view alone on both, the view draws the draft's paragraphs, "Edit draft" opens the whole draft filled in, a person's edit saves with its line breaks intact, and for Rae, who may not write the draft, the same field and one bound to a memo she may not see are filled with nothing and her press changes nothing. Run against 0.1.17, the scene drew the view alone, the field was empty, and saving it replaced the draft with what was typed. The guest host's first load when a page registers a worker view carries 1.0 KB more and the open kit's host 2.6 KB more; their budgets rise by that. The hosted page carries 163 bytes more, compiling or handed a compiled app, the record page asking whether a view replaces it; its budgets rise by that. `capabilities().shipped` gains FR-149, FR-150 and FR-151.
  
  Hardened by the security review before it shipped: a field the host fills is filled only when it holds the record's value whole, and is left empty otherwise; an untouched filled field sends the record's value as it is when pressed, not the copy it was filled with; a field is filled only for an act that declares it writes that field (an own property, never one inherited); and a view that replaces the record's page and fails leaves the record's own face, its fields, in its place rather than a page with neither.
  
  Compatibility: ops, stored formats, the document format, wire messages, `GUEST_PROTOCOL`, check finding codes and tool schemas are unchanged; `GuestProps` is as it was (its documentation was corrected, not its shape). New: `WorkerViewManifest.replaces` (`"page"`, optional), refused by `checkManifest` with any other value or on a view of many or of the home; the `data-prefill` attribute on an `input` or `textarea` a worker view draws, which the host fills; `PressedField.from` and the `Prefilled` type (`@graview/guest/host/views`), the record and field a host-filled field came from; `@graview/react`'s `DefaultDrawnElsewhere` (the context `DefaultViewElsewhere` provides, now read by a worker view too), `markReplacesPage`, `replacesPage` and `REPLACES_PAGE`; and `data-worker-view-beside` on the element holding a view of one and the record's own view under it. Changed: a worker view of one record is no longer drawn in place of the record on the scene; it is drawn above the record's own fields, as on Pages, unless its manifest says `replaces: "page"`. A view of one that fails on the pages face draws nothing in its place (the page already is the record), where it drew the record's card a second time. What Graview Cloud changes: its chat guide's "views" topic (`workers/cloud/src/mcp/guide.ts`, the `views` entry) says `props.nodes` have `(id, kind, label, fields)` and "Do not prefill"; it should say a record's fields are on it by name, a view of one reads `props.node`, a field is offered to edit with `data-prefill` and the same `name` inside a fieldset bound to the record, and a view of one sits above the record's fields unless the manifest says `replaces: "page"`. A view applied before this that relied on being the record alone adds `replaces: "page"` to its manifest.
- ec2c73a: The scene has its place control in the bar (FR-144), and the places stand in the bar when there is room (FR-145). Nick, on 0.1.17: "is there a way to have a subnav on Scene like how there is for Pages … where i can select from the Lenses available in the Scene? … Might also be nice to have some of them available with a More dropdown when screen real estate allows (for pages nav and scene nav)". On the scene the bar said nothing after the switch, and the scene's pictures were chosen on a district's marquee or from a panel that folds to a rail. Now the same control stands there on both faces: on the scene it names what is in view — "The whole thing", or the picture showing — and lists the whole thing and every picture the seat may see, grouped as on Pages and with the same keyboard; choosing one moves the scene's `in.view` exactly as every other way to a picture does (its kind's district in focus, on the ground, showing it), and choosing the whole thing rises to it from above, as Up does, with no picture in view, and under `routing: "address"` the address with it, a step Back undoes. The panel keeps no picker of its own: the bar is the one place a picture is chosen from, and the district's marquee stays in the picture. Where the bar has room after the name, the switch and the tools, the places themselves stand on the row as plain words in their declared order — the one you are on always among them, underlined in the accent and in the weight the switch's pressed face has — and the rest fold into "More ▾"; with room for fewer than two the one control comes back, and a phone's bar keeps it. Which stand is weighed from the bar's own width — again on a resize, when the brand's face arrives, when the brand, the face or the places change — with Find giving first, down to its least, then the places folding into More, then the one control, then the app's name; the places are weighed with the switch's words kept, so the switch says its words before a third place stands. The bar stays one row of 48 px. On Cloud's workshop at 1920 px all seven places stand (Home, Dates, Decisions, Deliverables, What the workshop covers, Email to Todd, Connections), at 1280 five and More, at 1024 three and More, at 390 and in 480, 640 and 900 px boxes the one control; the scene's three stand from 1280 up. In WebKit the place list was as tall as its most with its groups spread through it; it is as tall as what it holds. `pnpm verify quiet` measures the bar on both faces at 1920, 1440, 1280, 1024 and 390 and in 480, 640 and 900 px boxes on a 1440 desk, three engines and both schemes: one row of at most 48 px, every control on its middle line, the place you are on seen on the row or the phone's first line, four or more places standing at 1920 on Pages and fewer at 1280, the scene's pictures standing at 1920, the one control on a phone and in the narrow boxes, the same row after the window is narrowed and widened again, every place reached in two presses by pointer and by keyboard with the list snug, and on the scene each picture chosen from the bar the scene's `in.view`; `pnpm verify address` chooses a picture from the scene's bar and finds the address and `in.view` moved together and Back undoing it. The hosted page carries 4.7 KB more compiling and 4.8 KB more handed a compiled app, all of it the bar — the places drawn as words with More and weighed, 3.7 KB, and the scene's places, 0.9 KB; its budgets rise by that. With a record drawn once, a view beside its record and long text on a record page in the same release, the hosted page carries 583.2 KB compiling and 538.7 KB handed a compiled app, under budgets of 583.4 KB and 538.8 KB, which leaves Cloud's shell 11.6 KB under its 595. `capabilities().shipped` gains FR-144 and FR-145.
  
  Compatibility: the look and markup a host's page reaches; ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. New: `AppBar`'s `scenePlaces` prop; `useScenePlaces`, `scenePlacesOf`, `WHOLE_KEY` (`"scene:whole"`), `WHOLE_LABEL`, `placesThatStand`, `PLACE_GAP` and `FEWEST_STANDING` from `@graview/primitives` and `/frame`; on the scene the bar's places `app-place-scene:whole` and `app-place-scene:<kind>:<as>`, each with the scene's address for it as its `data-place-path` (`/places/overview#overview=1` for the whole thing, `/places/overview#focus=aggregate%3A<kind>&in.view=<as>` for a picture); places standing on the row, inside `nav[data-testid="app-places-standing"]`, each `app-place-<key>` with its `data-place-path`, the current one `aria-current="page"` holding `app-place-current`. Changed: on the scene the bar is no longer empty after the switch; `app-places-open` is "More" when places stand and the one control when none do, and absent only when every place stands; `app-places` holds the places that do not stand, and is a `div` inside the control's `nav` (labeled "The app’s places", or "What the scene shows") where it was itself the `nav`; each place is in the bar exactly once. How a harness reaches any place, at every width and on both faces: press `[data-testid="app-place-<key>"]` (or `[data-place-path="<path>"]`) inside the embed if it is visible; if not, press `[data-testid="app-places-open"]` and then press it in `[data-testid="app-places"]`; `[data-testid="app-place-current"]` says where the reader is (`docs/stability.md`). What Graview Cloud changes: its harnesses that press `app-places-open` and then a `data-place-path` first press the place itself when it is visible — at a desk's width it may stand on the row, and with every place standing there is no `app-places-open` — and those that read the scene's bar as having no place control now find the scene's; those that count the bar's places read them from the embed (`[data-place-path]`), not from `app-places` alone.
- ba17b00: The app bar fits its box. graview.dev's landing page gives the garden a box about 650 px wide on a 1440 desk, and on 0.1.17 the bar laid itself out there as a desk's bar squeezed: the app's name crushed to a letter a line down the bar's side and over the page under it ("S e e d b e d"), the place cut to "W… ▾", and Find holding the room. Nick: "the title malformed is brutal". The bar reads its own width now, never the screen's, and gives in an order: Find first, then the place down to 9em of its name (whole in its title), then the app's name, which wraps between its words onto a second line and never inside one (it was allowed to break anywhere, in a column held to a third of the bar). Find is a small box at every width that says "Find…" and its shortcut — ⌘K on a Mac, Ctrl K elsewhere, nothing on a touch screen — and is drawn wide while the keyboard is in it or it holds words; reached by Tab and by its shortcut as before, and on a phone's bar (below 640 px of its own) still a magnifier that opens the box over the row, whose list is now a sheet the bar's width hung from the bar's edge, where it was the screen's width from the screen's left even in a narrow box on a desk. The switch between the scene and the pages draws its marks alone when its words do not fit beside the rest of the row — weighed as the row is drawn, so it never flips back and forth at one width — and a host may ask for its marks alone at every width with the embed's new `switch: "icons"` (`"words"`, the default, says the words where they fit); the words are always the buttons' names and titles. `pnpm verify quiet` measures the bar in boxes of 360, 480, 560, 640, 720 and 900 px on a 1440 desk and on whole pages at 390, 1024, 1280 and 1440, both faces, a four-word name and a one-word one, a place named in a sentence, three engines and both schemes: the app's name on at most two lines and never narrower than its first word, one row of at most 48 px in a box down to 480, nothing of the bar drawn over the page under it, the place showing ten letters of its name or all of it, and Find reached by Tab and by its shortcut and typed into in every form it takes; and that the switch asked for as marks keeps its words as its names. Run against 0.1.17, the name stood on up to ten lines a letter wide, over the page by up to 69 px, and the place showed one letter. The hosted page carries 572.5 KB compiling (from 570.2) and 528.8 KB handed a compiled app (from 526.4), all of it the bar; its budgets rise by that to 572.8 KB and 528.8 KB, which leaves Cloud's shell 22.2 KB under its 595.
  
  Compatibility: the look and markup a host's page reaches; ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. New: the embed's `switch` option (`"words" | "icons"`, `BarSwitch` from `@graview/embed`, `@graview/primitives`, `/frame` and `/pages`), `AppBar`'s `switch` prop, `BAR_PHONE` (640, the bar's own width below which it is a phone's), on the switch `[data-testid="app-faces"]` the attributes `data-switch` (what was asked) and `data-switch-drawn` (what is drawn: `"icons"` on a phone's bar, when asked, or when the words do not fit), Find's shortcut `app-find-keys` (`aria-hidden`; the box's `aria-keyshortcuts` says it), the bar's `--graview-bar-width` custom property, and `--graview-bar-find-end`, the room the Find box keeps at its end for the shortcut (read by `FindBox` and `PageFind`). Changed: the switch's words are hidden by `data-switch-drawn="icons"` where a container query hid them on a phone; `app-find` is the box's wrapper, holding the face's box in `.graview-bar-find-slot` and the shortcut beside it; `.graview-bar-tools` is `display: contents`, so Find, the standing and the person stand on the bar's row themselves; the app's name breaks only between words (`overflow-wrap: normal`) and the app column is held to half the bar where it was a third. Find's box is the same input (`find-box` on the scene, `nav-find` on Pages) at every width a desk's bar has, narrower until it is used. What Graview Cloud changes: nothing it must. Its harnesses that measure Find's width on a desk measure it focused or with words in it (it is 9rem, about 144 px, until then, and 16rem while used); those that read the switch's words read its accessible names or titles, or `data-switch-drawn`, since a narrow bar now draws the icons alone; a shell whose box is small, or whose own page says what the two faces are, may pass `switch: "icons"`.
- feb577a: The place list is ready when it opens (FR-140). Graview Cloud, on a desk, from the scene: press Pages, open the place list and choose "Vendors" within a few hundred milliseconds, and the pick was dropped — the list was open, the entry a real link, `aria-pressed` already said Pages and `app-place-current` already showed, but nothing happened and the address stayed `/`. The routed face is fetched the first time it is drawn, and its router handed the bar its way of going to a place while it rendered; a render the fetch suspends is never committed, and a router that was never committed ignores a navigation, so the pick went to a router that was not there yet (and, after the scene and back, to the one of the last time Pages was drawn). The router now hands the bar its way of going once it is on the page and takes it back when it leaves, and a place asked for before then waits and is gone to as the face arrives: a pick made the moment the list is open goes to that place, however soon after pressing Pages, by pointer or by keyboard. `pnpm verify quiet` presses Pages, opens the list and picks an entry with no pause on ten fresh pages, and again after the scene and back, in three engines: 20 picks of 20 land on their place in each (on 0.1.17, in Chromium, every first pick was dropped). The hosted page handed a compiled app carries 155 bytes more for it (528.9 KB); its budget rises to 529.0 KB. `capabilities().shipped` gains FR-140.
  
  Compatibility: unchanged — ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are as they were. New: `PagesSteering.pending` (`@graview/pages`), optional, the path a bar asked for before the face was listening; `PagesSteering.go.current` is now set once the face is on the page and cleared when it leaves, where it was set as the face rendered and never cleared. What Graview Cloud changes: its harnesses may drop the pause between pressing Pages and picking a place.
- Updated dependencies [44d109d]
- Updated dependencies [2278594]
- Updated dependencies [2fba4ab]
- Updated dependencies [b00d5cf]
- Updated dependencies [7f4f1bb]
- Updated dependencies [b26a186]
- Updated dependencies [ec2c73a]
- Updated dependencies [e42bba9]
- Updated dependencies [ba17b00]
- Updated dependencies [feb577a]
- Updated dependencies [33884db]
  - @graview/core@0.1.18
  - @graview/react@0.1.18
  - @graview/primitives@0.1.18
  - @graview/pages@0.1.18
  - @graview/tools@0.1.18
  - @graview/layout@0.1.18
  - @graview/studio@0.1.18

## 0.1.17

### Patch Changes

- cc690c4: The framework's own look is Graview's identity from the design kit's revision 03, and the identity is data a host can read. Paper, reading ink, muted text, En Dash navy and turquoise (`GRAVIEW_COLORS`: `#f7f7f2`, `#18213a`, `#586174`, `#001769`, `#00e5b9` — the corrected values; the earlier approximations of the navy and turquoise appear nowhere in the repository), Montserrat and its three weights (`GRAVIEW_FACE`, `WEIGHTS`: 550 for headings, 450 for reading, 600 for action labels), display tracking (`DISPLAY_TRACKING`, −0.025em), how the logo is used (`LOGO_RULES`: 140 px at the least, clear space half the symbol's height, the micro cut at 16–24 px and the regular from 32) and the shared-plane symbol itself, the kit's own outlines as an inline SVG in `currentColor` with its point in `--graview-mark-point` (`graviewSymbol`, named by `aria-label` so it can be drawn many times without repeating an id; `symbolCut` picks the micro cut under 28 px, where it measured clearer at 25–27 at 1x and 2x). The shipped schemes are built on it: the light one on paper with ink and navy as the accent, the dark one on a navy ground `#0a0f1f` with the navy's hue made light (`#9aabff`, navy text on it) as the accent; turquoise is in neither, because it is a point and a fill and never text (1.5:1 on paper). Neither paints a wash behind the scene any more, `brandFromAccent` keeps its base's wash rather than adding a glow, and a button's hover firms its edge in the dark where it glowed. `TYPOGRAPHY.body` names Montserrat first and the system's sans after it; the framework never fetches it — a host imports the optional copy, `@graview/primitives/montserrat.css` (32 KB of woff2, weights 400–700, Latin, cut from the kit's font under the SIL Open Font License, which ships beside it), or the system sans stands in as before — and the embed does not ask Google Fonts for it. The sheet writes the weights as `--graview-weight-display`, `--graview-weight-body` and `--graview-weight-label`, sets the body, headings and buttons with them, and sets the two largest headings at the display tracking; a brand that names its own faces gets 600, 400 and 600 and may name its own (`typography.weights`). The default radius is 8 px where it was 12, and the scene's open district name, a pinned view's outline and a focused view's ring follow `--graview-radius` where they said 12 px. `GraviewMark` (`@graview/primitives`) draws the symbol for a host that shows Graview's own identity; the framework puts it in no app. The primitives README says the three layers — the identity, the semantic tokens, the app's brand — and how selection and relations read against any district's color without leaning on color.
  
  Compatibility: the look, which is not one of the five surfaces (docs/stability.md says so now); ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. Changed defaults: `LIGHT` and `DARK` (every token but the state colors and the tint and grid numbers; `wash` is `"none"` in both), `TYPOGRAPHY.body` (`"Montserrat", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`), `SHAPE.radius` 8 (so `--graview-radius: 8px` and `--graview-radius-sm: 6px` for a brand that sets none), `typographyOf` returns `weights` beside the three stacks, the derived wash of `brandFromAccent`, and `SYSTEM_STACKS["system-sans"]`, which keeps its old value and no longer follows `TYPOGRAPHY.body`. New: `GRAVIEW_COLORS`, `GRAVIEW_FACE`, `WEIGHTS`, `PLAIN_WEIGHTS`, `DISPLAY_TRACKING`, `LOGO_RULES`, `graviewSymbol`, `symbolCut` and `SymbolOptions` (`@graview/core`); `Brand.typography.weights`; the custom properties `--graview-weight-display`, `--graview-weight-body`, `--graview-weight-label` and `--graview-mark-point` (read, never written by the framework); `GraviewMark` and the entries `./montserrat.css` and `./montserrat-latin.woff2` (`@graview/primitives`, whose `sideEffects` now names `*.css` so a bundler keeps the import). The embed's `familiesOf` and `fontsLink` leave Montserrat out. A brand that declares its own schemes, faces and radius draws as before but for headings at its display weight (600 unless it names one, where the browser's bold was 700), `h1` and `h2` tracked at −0.025em, and buttons' labels at 600; one derived from an accent over the shipped schemes takes the new grounds, panels and inks with its own accent. What Graview Cloud changes: nothing it must; to wear the identity it imports `@graview/primitives/montserrat.css` (or serves Montserrat itself), reads `GRAVIEW_COLORS`, `WEIGHTS` and `LOGO_RULES` rather than restating them, and draws `GraviewMark` or `graviewSymbol` where it shows Graview's own mark, with `--graview-mark-point` set to the turquoise for the two-color mark. Its harnesses that compare a rendered ground, panel or accent with the old `#f6f4f0`, `#0c6e78` or `#6fdcea` read the new values.
- b124330: What the review after 0.1.16 found in the old documents and the switch (FR-134, FR-136, FR-137), fixed. A document 0.1.16 wrote whose scene was called something of 25 to 40 characters stopped compiling: `pages.overview` took 40, and the `pages.scene` it is now read as took 24, so the respelling narrowed the key. `pages.scene` and `pages.pages` take 40 again, and the bar cuts a long word on the switch with an ellipsis, whole on hover. `arrange-pages` refused `overview` as a key it did not know, so a chat or a tool written before 0.1.17 could no longer rename the scene; it reads `overview` as `scene` now, and `scene` wins when both are said. `editDocument` with no edits gave the document back as stored, old keys and all, where any other edit list gives it in the current spelling; it gives the current spelling too, so a studio opened on a stored document and applied with no change hands back what `toDocument` writes. A declaration whose switch would say one word twice (`pages: { scene: "Lists", pages: "Lists" }`, or `scene: "Pages"`) is warned of by `graview check` as `pages-faces-alike`. In an embed narrower than `pagesBelow`, a reader who pressed Scene could not get back: Pages told the host the face, and a host that keeps its own face drew the scene still. Pages now stands the scene aside again, as it stood before, and the host's face is kept for when there is room. A home view written as blocks drew the app's description over its own headline, like an eyebrow; the description now follows the home's headline, and a home with none, or one a worker draws, still says it first. The profile's choices (who you sit as, the app's settings, the scheme) and the footer's "Answers come from" were capsules ringed in the accent; they are quiet boxes now, the one chosen pressed the way the bar's switch presses a face. The hosted page carries 570.1 KB compiling and 526.4 KB handed a compiled app, within their 570.5 and 526.5: the embed says an address within the app one way where it said it four.
  
  Compatibility: additive, for the document. `pages.scene` and `pages.pages` take up to 40 characters (were 24 in the unreleased build, and `pages.overview` took 40), `arrange-pages` reads `overview` as `scene`, and `editDocument([])` gives the document in the current spelling. A new check warning, `pages-faces-alike`. `@graview/primitives` and `/pages` gain `HomeLine`, the line said under a home's headline. Markup: the app's line on a home made of blocks (`app-subtitle`) is the next sibling of the home's first headline rather than the first child of `home-view`; the setting, seat and scheme buttons keep their test ids and `aria-pressed`, and their pressed look is a tint rather than an accent ring. Ops, stored formats, the compiled-app format, wire messages and tool names and schemas are unchanged. `capabilities().shipped` is unchanged.
- b124330: The scene and the pages are two things, and the bar says so; the places move out of the bar; and a home view is the front page on a desk too (FR-136, FR-137, FR-138). Nick, on 0.1.16 at a desk: "the new nav kinda sucks, and i don't see a way to go to the scene vs pages anymore". FR-132 had made the scene "Overview", one of the places laid along the bar as tabs, and on Graview Cloud's workshop app — two pictures named in sentences ("What the workshop covers", "Email to Todd") beside three kinds' lists — the tabs filled the bar's top edge and wrapped to a second row, the page under the bar repeated them ("On the overview ↗", the other pictures again), and the home a chat wrote stood as a card over the scene's top right. Right after the app's name the bar now has one switch: "Scene" and "Pages", an icon and a word each (the icons alone on a phone, the words their accessible names), two buttons whose `aria-pressed` says which face is drawn. Scene draws the scene under the bar; Pages goes back to the page the reader was on. A declaration may call them something else (`pages: { scene: "The farm", pages: "Lists" }`; `arrange-pages` takes `scene` and `pages`), and the scene keeps its address, `/places/overview`, so links, `where()`, `setPath` and `setApp` are as they were. On Pages, the place you are on is one control after the switch, its name and a chevron, that opens every place the app has: the home first, then Lists (one per kind) and Pictures (each named lens, and how the kinds connect), each with its mark in its kind's hue, a long name wrapped inside the list. Every place is two presses away, the keyboard reaches the switch, the control and every entry, and Escape gives it back to the control. The bar is one row of 48 px, its rule included, whatever the app holds, every control on the row's middle line; on a phone the place control is the page's first line, under the bar. A picture's page keeps only its own link, "All deliverables as a list"; the other places are the list's. An app with a home view — the declaration's `views.home`, or a worker view attached to `"home"` — opens on Pages at its home, full width under the bar, on a desk as on a phone, when the host names no face; under address routing it does so at the bare address whatever face the host names, and `where()` says so. Without a home view nothing changes. Why the old claim missed the wrap: "at most one bar row on a desk" counted the distinct tops of the bar's three regions (the app, the places, the tools), and a tab that wraps inside the places' region moves no region's top; it ran on two apps whose place names were short, at 1280 px. `pnpm verify quiet` now measures every control on the bar by its own box on a document shaped like Cloud's and on the same with thirty places, at 1000, 1024, 1280 (also at twice the pixels) and 1440 px and at 390, in three engines and both schemes: one row of at most 48 px, every control on the row's middle and none at the top edge, the switch saying Scene and Pages and marking the one drawn, every place in two presses by pointer and by keyboard, nothing calling the scene "the overview", a picture's page not repeating the places, and a home view opening full width under the bar. `pnpm verify address` holds that the switch is a step Back undoes and that an app with a home view opens on it at the bare address; `pnpm verify declared` that the front page made of data is where the app opens and nothing floats over the scene. The hosted page carries 569.9 KB compiling (from 566.3) and 526.1 KB handed a compiled app (from 522.6), the switch and the place list 2.4 KB of it and the embed's opening 0.8 KB; its budgets rise by that to 570.5 KB and 526.5 KB, which leaves Cloud's shell 24.5 KB under its 595. `capabilities().shipped` gains FR-136, FR-137 and FR-138.
  
  Compatibility: markup, options and addresses a host holds, and the document's `pages`. Gone: the bar's place tabs (`.graview-bar-places`, `.graview-bar-tab`, `.graview-bar-measure`), `app-places-more` and `app-places-more-list`, the overview's entry `app-place-overview` (the scene is the switch's), the routed face's `place-stop` and `sibling-pictures` under a picture's title, the scene's landing for a home view (`home-landing`, `home-landing-away`, and `HomeLanding` from `@graview/primitives` and `/scene`), `OVERVIEW_KEY` (`@graview/primitives`, `/frame`, `/pages`), `overviewTitle` (`@graview/core`) and `OverviewLink` (`@graview/pages`), and `barPlaces`'s `overview` option. New: the switch `[data-testid="app-faces"]` (`role="group"`) with `app-face-scene` and `app-face-pages` (`aria-pressed`); the place control `app-places-open`, its words `app-place-current`, its list `app-places` (a `nav`, now opened by the control and `hidden` until it is) with groups `[data-place-group="home|lists|pictures"]` and entries `app-place-<key>` (`home`, `kind:<kind>`, `place:<kind>:<as>`, `connections`) carrying `data-place-path`; on a phone the place line `app-place-line` (`[data-graview-place-line]`); a picture's own `place-as-list`; `AppBar`'s `faces` (`BarFaces`, `BarFace`), `BarPlace.group` and `.kind` (`BarPlaceGroup`), `BAR_HEIGHT`, `HOME_KEY` and `HOME_PATH`; `sceneTitle` and `pagesTitle` (`@graview/core`), `SceneLink` (`@graview/pages`, saying "In the scene ↗" where `OverviewLink` said "On the overview ↗"), `EmbedProps.onOpening`, and `opensOnTheHome` (`@graview/embed`). `barPlaces` lists the home first and has no overview. `POPOVERS.places` (`@graview/react`) is the place list: its trigger `app-places-open`, its pane `app-places`. The document's `pages.overview` is respelled `pages.scene` (a line in `RESPELLED`, so a stored document keeps its word on the switch), and `pages` gains `pages`; `arrange-pages` takes `scene` and `pages`, and still reads `overview` as `scene`, and its sentences say "the switch calls the scene …". An embed whose host names no face opens on Pages at the home when the app has a home view and its `pages.first` names no other place (`where().face` is `"pages"`), where it opened on the scene; under `routing: "address"` the bare address, with no fragment and no entry the router wrote, does so whatever `face` the host names, and `<Embed>`'s `onFace` is told `"pages"`. `placesOf(app)` marks the home `first` when the app has a home view and no `pages.first`. What Graview Cloud changes: its harnesses press `app-face-scene` and `app-face-pages` where they pressed `app-place-overview` and a place's tab, and reach a place by `app-places-open` and then `app-place-<key>`; they read the face drawn from `aria-pressed` on the switch, and the place from `app-place-current`. A shell that mounts on the Graview at the app's bare address now lands on the home view when the app has one; one that wants the scene there links to `/places/overview`. A chat tool may send `arrange-pages` with `scene` where it sent `overview`; the old word still works. Ops, stored formats, the compiled-app format, wire messages and tool names are unchanged.
- Updated dependencies [cc690c4]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
  - @graview/core@0.1.17
  - @graview/primitives@0.1.17
  - @graview/pages@0.1.17
  - @graview/react@0.1.17
  - @graview/layout@0.1.17
  - @graview/studio@0.1.17
  - @graview/tools@0.1.17

## 0.1.16

### Patch Changes

- 87e43d3: A host's press leaves the reader's keyboard where it is, and two embeds on one page name their search apart. Putting the seat away from its header moves the keyboard to the tab, and opening it from the tab moves the keyboard to the header (FR-78). It did so for any click, so a host page whose own script puts the seat away after the mount, as graview.dev's landing page and demos do, took the reader's keyboard into the embed before they had touched it: the first Tab no longer reached the page's skip link. The keyboard now follows the control only when it was on the control. Every landmark inside an embed is named after the embed (FR-128), but the sweep did not reach the routed face's Find box, a `role="search"` form named "Find anything", so a page with two embeds on that face carried two search landmarks of one name (axe's `landmark-unique`). It is now "<embed> · Find anything". A unit test puts the seat away and opens it with the keyboard elsewhere and checks the keyboard stays there, and another mounts two embeds on the routed face and holds their search landmarks to two names under axe. `pnpm verify site` holds again on the rebuilt `docs/site/chapters.js`.
  
  Compatibility: a search landmark inside an embed is named after the embed, as every other landmark inside it already was. Ops, stored formats, the document format, wire messages, check codes and tool schemas are unchanged.
- 1df248f: A brand's mark is read as the browser reads it, and what the review after 0.1.15 found in the brand, the bar and the overview is fixed. An inline SVG logo is put in the page through the HTML parser, and the rules that judged it searched the string for what is forbidden, so the parser could be talked past them: a handler after a slash (`<animate/onbegin=…>`), an unquoted `javascript:` link, markup after `</svg>` (`<img/src/onerror=…>`, `<base>`, `<meta http-equiv=refresh>`), an animation that sets a link, a style written in CSS escapes or character references (`u\72l(`, `@\69mport`), a namespaced `<x:script>`. Each was taken by `graview check` and drawn on every face. `svgProblem` now reads the SVG element by element as the HTML and the XML parser will, and keeps only what a picture is made of: the drawing elements (no `a`, `style`, `script`, `foreignObject`, animation or `feImage`), no prefixed element and nothing but text inside `title` and `desc`, every attribute quoted and apart, no handler, a link only to `#id` within it (or a `data:` PNG, JPEG, GIF, WebP or AVIF on an `<image>`), every `url(` a fragment of it and no escape, at-rule or image function in a value, no CDATA, no entity and nothing after the root. A path that climbs (`.` or `..`) is refused, and `markHref` hands a face no address of a scheme other than `http`, `https` or a `data:` image. The guest host makes no `blob:` of an inline SVG that could act, and fetches no path that climbs or is percent-encoded to, so a view is never handed the bytes of another page of the host. A face named in a document is left out of the style sheet when it could end its rule, even where the page compiled without the checker. Reading the mark costs about 4 kB minified wherever a mark is drawn or handed to a view: Graview Cloud's hosted page carries 579,107 bytes up front compiling (565.5 KB, its budget now 567 KB, which leaves the shell its ~25 KB under 595 with 3 to spare) and 534,306 handed a compiled app (521.8 KB of 523); the pages face alone measures 505,406 / 173,425 bytes (minified / gzipped), the embed without the studio 693,248 / 179,214, and the guest host before a worker is drawn 16,358 / 7,540, each budget raised just above. A test in `@graview/core` holds twenty-three payloads refused and a picture's own parts kept, and one in `@graview/primitives` draws none of the bypasses. The review also found: an embed narrower than `pagesBelow` under `routing: "address"` opened on "No picture is called that." (the routed face now takes `/places/overview` as the home, unless a declared place holds that address); the scene's Find in the bar took ⌘K from the host page's own editor and `/` from anywhere (it answers ⌘K only from within its embed or from nothing, `/` only from within, and never a key the host already answered); the stop "On the overview ↗" named held the scene for the rest of the visit, so `setStop` was ignored after it (it is let go when the reader leaves the scene or the host sets a stop); Escape putting the phone's Find away left the keyboard on the page's body (it goes back to the magnifier); the place you are on could hide inside "More" on a row too narrow for one tab, and a web font arriving late did not re-measure the row; the shade a `theme-contrast-below-aa` finding offered was judged on a gradient's first stop only and could fail on the others; `pages-overview-taken`'s fix told a declaration to rename the overview, which keeps its address; an accent refused because the warning color shares its hue was said as failing to read in the dark scheme, and a dark-scheme refusal asked a document for a dark accent it cannot give; `set-brand {}` was taken with nothing said, the same logo or name again was said as a change, an alt text alone was said as "The logo changes.", and words with quotes or a closing period were quoted as `"Say "hi""` and `"…booked.".`.
  
  Compatibility: `svgProblem` and so `brand-mark` refuse inline SVGs they took before: an `<a>`, a `<style>`, an animation, `feImage`, a prefixed element, an unquoted attribute, an element inside `title` or `desc`, CDATA, a named entity in an attribute other than XML's five, and a mark path with a `.` or `..` segment; a mark that only drew shapes, gradients, filters, text and its own `#` links is taken as before. Graview Cloud's `add_image` should hold an image to the same reading. `markHref` returns undefined for a scheme other than `http`, `https` and a `data:` image. `editDocument` takes an optional third argument, `{ fonts }`, as `compileDocument` does; `set-brand` refuses an edit that names no key, or an empty `typography`, `shape` or `accents`; the sentences said for an unchanged name, description or logo, and for an alt text alone, are new words, and a quoted name or line that ends a sentence carries its own stop. `passingShade` clears every stop of a gradient. `accentProblem`'s `pair.on` is a hex color and its `ratio` the accent's on the dark panel where the dark scheme refused it. `pages-overview-taken`'s fix is new words. Ops, stored formats, the document format, wire messages, check codes and tool names and schemas are unchanged.
- eefa440: A renamed app says its new name without a reload (FR-128). Graview Cloud mounts the embed with `label: app.name`. When a chat renames the app, Cloud hands the new app to `setApp` (FR-116), and the swap kept the first mount's label. The open page's region, the heading that said the app's name and every landmark inside ("A proposal · Places") went on saying the old name until a reload. A label that was the app's own name now follows the app, and `setApp` takes the new one. A label the host chose, such as "Chapter 13", stays. `setApp(app, store, { label })` gives another, and the new `handle.setLabel(label)` renames the embed in place, on the whole embed and on the pages alone (`@graview/embed/pages`). The landmarks inside are renamed with it, each named after the embed once, and nothing is drawn again. `handle.setHostActions(actions)` changes the host's own actions in the profile menu the same way, on both handles, so a host can say "Change Chores" after the rename. The wordmark already followed the new app's brand. Under the new names, a unit test renames an app on the Graview face and on the pages face. It checks the embed's accessible name, the app's name on the bar and the landmarks inside, then a host's own label kept, a label handed to `setApp`, `setLabel` on both handles, and `setHostActions`. `pnpm verify address` holds one more claim in Chromium, WebKit and Firefox, `aRenamedAppSaysItsNewNameOnBothFacesWithoutAReload`. It mounts the proposal as Cloud's shell does (`label: app.name`, `heading: 1`), renames it as `set-name` would, and hands it to `setApp`. Then on the pages face and on the scene, in the same document, the region, the heading and the wordmark say "A proposal, renamed", the landmarks inside are named after it, and the old name is said nowhere. Cloud's hosted page is 437 bytes larger up front for it; the release's figures are in the one app bar's entry.
  
  Compatibility: `EmbedHandle.setApp` takes an optional third argument, `{ label }`. A label that equals the app's name now follows the new app's name where it stayed. `EmbedHandle` and `PagesEmbedHandle` gain `setLabel` and `setHostActions`, which a host implementing a handle itself must now provide. Ops, stored formats, the document format, wire messages, check codes and tool schemas are unchanged. `capabilities().shipped` gains FR-128.
- 46c6734: Named edits for the app's name, its description and every key of its brand (FR-125). From Graview Cloud: a chat renamed an app with a raw JSON Patch on `/name` it had to discover, and nothing said whether either face drew the document's description. `set-brand` takes every brand key — `logo`, `favicon`, `typography`, `shape`, `accents`, `scheme` beside `accent`, `name`, `currency` and `locale` — and `null` clears one (a part of `typography`, `shape` or `accents` too); `set-name { name }` and `set-description { description }` are edits of their own. Each says what it did and `diffDocuments` says it in words: "The app is now called "…", where it was "…".", "The line under the app's name reads "…".", "The logo changes.", "Headings are now set in system-serif.", "Corners are now 6px.", "The app opens dark when the reader has not chosen." A mark or a face the checker would refuse is refused at the edit, by its path. The description is said on both faces: as the app name's hover on the one app bar (FR-131), and as the line on the routed face's home, wrapping, never cut. `describePlace("home")` says the app as the home draws it (`masthead`, a `DescribedMasthead`): the name, the line under it, and the logo by its alt text (the app's name when none is given) and how it is drawn.
  
  Compatibility: `EDIT_OPS` gains `set-name` and `set-description`. `DocumentDiff`'s sentence for a renamed app and for a changed description is new words; a program matching "The app is renamed from" or "The app's description change" no longer finds them. `PlaceDescription` gains optional `masthead`, and the home's `text` gains a "Masthead:" line after its first. `set-brand { name: null }` now clears the wordmark's name, and a brand left holding only a name is kept (it is drawn). `capabilities().shipped` gains FR-125.
- ae891b0: One app bar on every face, and the scene is a place beside the others (FR-131, FR-132). Nick, on a real app in Graview Cloud: the title and the Scene/Pages toggle were ugly, bloated and broken under a notification — two stacked bars said the app's name, the way into the scene and the state of the rules twice each, and "Scene", "Pages", "Pictures" and "Map" were four words for overlapping ideas. One bar now stands over every face (`AppBar`, from `@graview/primitives`): the app — its mark (the brand's logo when the document has one) and its name, said once as the page's heading, the way home — then the app's places as plain tabs, the one you are on marked with `aria-current`, what the row cannot hold under "More"; then three tools of one size, each named: Find (inline; ⌘K or Ctrl+K on a desk; a magnifier that opens the box over the bar's first row on a phone), the standing (a dot in the tone of the rules, a number only when one is broken, opening what is broken; "Everything is in order" its name and its hover otherwise) and the person (an avatar whose menu holds who is signed in, the seats, the host's own actions such as "Report this app" and, for whoever keeps the app, the installation and the studio). One row on a desk; on a phone the places take a second. The routed face's own header — the title, the Find box, the Problems tab, "Open the scene" — is gone: under the embed's bar the derived shell draws none of it and its Find goes in the bar; on a face that owns its page the shell is the same bar. The scene is the overview, a tab beside the others — "Overview" unless the declaration calls it something else (`pages: { overview: "The farm" }`, and `arrange-pages` takes `overview`) — at `/places/overview` whatever it is called, its stop riding on it; the lens gallery is the home the app's name goes to and the relation map is "Connections". The scene's own Find now stands in the bar on the embed too. What is behind the person and the problems' rows are fetched when first reached for, and the blocks a view is drawn with come with the face that draws one (`viewsCss`): the hosted page carries 561.1 KB compiling (from 566.3) and 517.4 KB handed a compiled app (from 522.6), and its budgets come down to 562 KB and 518 KB. `pnpm verify quiet` holds, on both faces at 390×844 and 1280×800: one bar row on a desk and two on a phone (the second the places), one heading naming the app, nothing the bar says said again above the fold, one Find box, the tools one size and named, no control that says "Scene" or "Pages", and the overview and a list one press on a tab apart by pointer and by keyboard; `pnpm verify address` holds the overview's address, a link to a stop at the bare address still opening the scene, and a host that mounts on the Graview landing on the overview. `capabilities().shipped` gains FR-131 and FR-132.
  
  Compatibility: markup, options and addresses a host holds. The embed's `toggle` option is `bar`. Gone: the strip (`[data-testid="embed-faces"]`, `[data-embed-strip]`), the face switch (`embed-face-scene`, `embed-face-pages`), the strip's seats (`embed-seats`, `embed-seat-<id>`: the seats are in the person's menu, `[data-testid="seats"]`, taken through the provider's `onSeat`, which the embed forwards), the scene's place pills on the embed (`[data-testid="places"]`, `place-<as>`: the whole-page Shell keeps them), the routed face's `masthead`, `shell-nav`, `problems-count` and its `face-find-bar` under a bar, the profile's `profile-gear` and the name beside its mark, the Shell's Scene/Pages switch (`[data-testid="faces"]`; `pages-link` is a "Lists" link), and the embed's visually hidden workbench heading. New: `[data-graview-app-bar]` (`app-bar`), `app-home`, `app-name`, `app-places` (`nav`, "The app's places"), `app-place-<key>` with `data-place-path` (keys `overview`, `place:<kind>:<as>`, `kind:<kind>`, `connections`), `app-places-more`, `app-places-more-list`, `app-find`, `app-find-open`, `standing-link` on a routed face that owns its page, `[data-graview-page-title]`, and classes `.graview-bar`, `.graview-bar-tab`, `.graview-bar-tools`. `heading` now sets the level of the bar's name, which is `brand.name ?? app.name` (the `label` stays the region's name); each page's title is said a level under it (`PageContext.titleLevel`; `h2` where it was `h1`), and a view's headlines under that (`HeadingsUnder`). `PageContext.standingAbove` is `barAbove`; `PageContext.overview` and `PagesApp`'s `steering` are new. `Standing` and `Profile` lose `compact`; Standing is a dot and a count with its words in `aria-label` and `title`, `aria-disabled` rather than `disabled` when all is well. Under address routing the scene's address is `<base>/places/overview#<stop>`: `faceAtAddress` reads it as the scene (`#overview=1` as the Graview), `<base>#<stop>` still opens the scene and is replaced on arrival by the overview's address, and a bare `<base>` a host mounts on the scene or the Graview is replaced the same way. `where().path` is `/places/overview` on the scene; `setPath("/places/overview")` draws the scene and any other `setPath` draws the routed face at that page; under memory routing `onNavigate` is told `/places/overview` (push) when the reader goes to the overview, and the page's path when they leave it; Below `pagesBelow` the overview's tab draws the scene when the reader asks. `placesOf(app)` lists the overview second, after the home. `themeBaseCss` no longer carries the view-spec blocks: `viewsCss({ scope })` does, drawn by each face that draws a view (`themeCss` still has all of it). The boxed studio is drawn into the embed's own element. The derived routed face's tab for the relation map says "Connections" (its page and the home's link likewise), it has no Pictures or Problems tab (the app's name goes home, the standing opens the problems, `/problems` stays), its home no longer repeats the app's name as an eyebrow and says the brand's line under it instead, and "See it in the scene ↗" says "On the overview ↗" and is not drawn on an embedded face with no scene. The document's `pages` gains `overview`, `arrange-pages` takes it, `graview check` adds `pages-overview-taken` (a place whose address is the overview's), and the wire's `capabilities().shipped` gains FR-131 and FR-132. Ops, stored formats and tool names are unchanged.
- a6d0700: The document holds the whole brand the TypeScript `Brand` already has (FR-124). From Graview Cloud: a chat could restructure an app's blocks but not change how it looks, because a document's `brand` was an accent, a name, a currency and a locale. It now also takes `logo` (inline SVG, or a path on the app's own host such as `/graview/assets/<sha256>.svg`; a string, or `{ "src", "alt" }`), `favicon` (the same forms), `typography` (`display`, `body`, `mono`: `system-serif`, `system-sans`, `system-mono`, a face every system has, or a web font on `DOCUMENT_FONTS`), `shape` (`radius`, `density`), `accents` (a hue per kind) and `scheme` (`light`, `dark` or `auto`), each mapped onto the `Brand` the theme machinery draws from. `graview check` refuses a mark that could act or load (`brand-mark`: an inline SVG is read element by element, as the browser will read it, and only what a picture is made of is kept — no script, event handler, `foreignObject`, `<a>`, `<style>`, animation, embedded page, link or load outside itself, CDATA, entity, or anything after the root; and any other origin, a path off `/graview/assets/`, or a path that climbs with `.` or `..`) and a face named by its address or off the list (`brand-font`); a host that serves other web fonts names them to `compileDocument(…, { fonts })`. Every document now compiles to a brand, so its app is called what its document calls it on both faces. The faces draw the app's mark with one component, `AppMark`, in the one app bar (FR-131), and the whole-page Shell's wordmark with `AppTitle`: an inline SVG logo is put in the page byte for byte, with `currentColor` taking the accent, and an SVG that could act is not drawn even where a page compiled without the checker. The whole-page Shell and the routed face on its own wear the brand's icon (`useFavicon`, `faviconHref`); an embed changes its host's icon only when the host passes `favicon: true`. The scheme an app prefers is drawn when the host's page stamps none. The embed no longer asks Google Fonts for a face the reader's system has. A new harness, `verify-brand`, holds it in three engines. The bundle budgets rise with measured numbers: the pages face alone to 492,500 / 167,500 bytes, the embed without the studio to 691,500 / 177,500, every face to 1,518,500 / 455,750, the embed with the studio handed in to 1,489,500 / 443,000; the hosted page's budgets for this release are in the one app bar's entry.
  
  Compatibility: additive to `graview-document@1` and to `graview-compiled@1` — every key is optional and a document without them means what it meant, except that a document with no brand is now called by its `name` where it was called Graview. A build that predates them refuses the keys by path. `Brand` gains optional `logoAlt`, `favicon`, `subtitle` and `scheme`; `hostScheme` takes an optional preference; `FrameOptions` gains `favicon`. `capabilities().shipped` gains FR-124.
- 9eaa3c9: The framework spells in American English. The code, the sentences it says to a person and to a model, the comments, the docs, the skills and the test names had drifted into British spelling in some four hundred files, so one thing had two names, and an export spelled one way was an import a stranger got wrong the other way. Every one is now American: color, center, behavior, judgment, labeled, canceled, catalog, gray, normalize, and the rest of their kind. What the platform and third parties own keeps their spelling: `aria-labelledby`, the status Google Calendar gives a deleted event and MCP's `notifications/cancelled`. Published changelogs and Graview Cloud's documents among the test fixtures are kept as written. A test at the root, `tests/the-repo-spells-in-american-english.test.ts`, reads every tracked source, doc, skill and changeset for the British forms and names the file and line of any it finds, so the drift does not come back.
  
  Compatibility: renamed outright, with no aliases. `@graview/core` exports `normalize` (was `normalise`), `summarize` (was `summarise`), `humanizeField` (was `humaniseField`), `colorsIn` (was `coloursIn`) and `connectorHueColor` (was `connectorHueColour`). `@graview/primitives` exports `humanize` (was `humanise`). `@graview/react` and `@graview/react/provider` export `honorSetting` (was `honourSetting`). In the declaration, a setting says `honored` (was `honoured`), a brand's connector kit says `color` (was `colour`, in `brand.kit.connectors.all` and `byEdge`), as does a `checkKitContrast` finding, and an invariant written in the rule language carries `judgment` (was `judgement`). Two check finding codes are renamed: `kit-color-unreadable` (was `kit-colour-unreadable`) and `setting-not-honorable` (was `setting-not-honourable`). The scene's CSS custom property `--graview-center-y` was `--graview-centre-y`. Sentences said to a person or a model that used a British form now use the American one. Ops, stored formats, the document format, wire messages and tool names and schemas are unchanged.
- Updated dependencies [340ab1e]
- Updated dependencies [87e43d3]
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
  - @graview/primitives@0.1.16
  - @graview/pages@0.1.16
  - @graview/react@0.1.16
  - @graview/studio@0.1.16
  - @graview/layout@0.1.16
  - @graview/tools@0.1.16

## 0.1.15

### Patch Changes

- efab5b2: One place says how many problems there are (FR-122). Cloud's vendor template, fresh, breaks three rules, and its Pages home said so three times: "3 problems" on the embed's bar, "Problems 3" in the page's tabs, and "3 problems — see what is broken, and what would fix it" under the headline. The count is now said once. Under the embed's strip, whose Standing says it and opens the problems, the shell's Problems tab names the page with no number. A face with no bar above it keeps the number on its Problems tab. The home never says the number: it says "Rules are broken — see what, and what would fix it" ("A rule is broken" for one) and links to `/problems`, on the derived home and above a home view alike. `pnpm verify quiet` counts every visible text above the fold that says the number and is about the problems, on the vendor template's Pages home and Graview face at 390×844 and 1280×800, in Chromium, WebKit and Firefox and both schemes. Before, the Pages home said it twice on a phone (the tab's count sat past the right edge of the row that scrolls) and three times at a desk. Now every one of the 24 screens says it exactly once, on the bar's Standing; the Graview face already did. The same harness holds that the Standing's name says the count, that Tab reaches it, and that Enter opens the list of problems.
  
  Compatibility: markup changes a host may style against. The shell's Problems tab carries `data-testid="problems-count"` only when no bar above says the count, and the home's link to the problems no longer holds the number. `PageContext` gains an optional `standingAbove`, which the embed sets while its strip is drawn; a context without it keeps the tab's count. `capabilities().shipped` gains `FR-122`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [817082f]
- Updated dependencies [d4fb72e]
- Updated dependencies [6a5fb11]
- Updated dependencies [a8b8153]
- Updated dependencies [fffebfd]
- Updated dependencies [efab5b2]
- Updated dependencies [9fc2bd8]
  - @graview/core@0.1.15
  - @graview/tools@0.1.15
  - @graview/pages@0.1.15
  - @graview/layout@0.1.15
  - @graview/primitives@0.1.15
  - @graview/react@0.1.15
  - @graview/studio@0.1.15

## 0.1.14

### Patch Changes

- cc50785: A new declaration keeps the reader's place (FR-116). When a chat changes an app, the host has a new compiled app and a new store, and `mount` was the only way to hand them to the embed. Graview Cloud remounted on the face the reader was on, but not on what they were looking at: the place or record open on Pages went back to the home, and the scene lost its stop and focus. The embed's handle now has `setApp(app, store)`, which swaps them in place; given a remote instead of a store, its presence comes with it. The face, the page open on Pages and the scene's stop and focus are kept. What the change took away falls back to its nearest parent: a removed record goes to its kind's list (in the scene, its kind's group), and a removed kind or place goes to the home. A lens gone from the scene goes to its kind's group, or to the home when the kind went too. Under address routing the address stays the source of truth, and one that names something gone is replaced, never pushed; under memory routing nothing touches `history` or `location`. The seat, the seats, the people, the scheme, the brand and the notices stay across the swap. The faces are drawn again, so an open menu, a scroll position and a half-typed field do not. `handle.where()` reads the place as `{ face, path, stop, kind }`, and a host that must remount hands it back with `mount(…, { at })`, where it is settled in the new app the same way. Memory routing now also returns to the page Pages was on after a trip to the scene, as address routing already did. The rules for settling a place are a chunk of their own, fetched the first time a declaration changes: Cloud's hosted page loads 566.7 KB up front, where it loaded about 565, against the same 572 KB budget. `pnpm verify address` now holds four more claims in Chromium, WebKit and Firefox: a place on Pages is still open after a new declaration, the scene focused on a record keeps its focus, a reader on a kind the change removed lands on the home, and in memory routing a new declaration writes no history.
  
  Compatibility: `EmbedHandle` gains `where()` and `setApp()`, `EmbedOptions` gains `at`, and `@graview/embed` exports the `EmbedWhere` type; `handle.store` is now the store the embed currently draws. `capabilities().shipped` gains `FR-116`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 8c43964: A pill means "press this to choose", or a state (FR-117). Building En Dash Org on Graview Cloud ended in one verdict: "too many pills, and too much cut-off text, on every face". When everything is a capsule, nothing reads as the thing to press, and a state badge, the one pill that earns its place, no longer stood out. Now one rule holds on every face. A capsule is a choice the reader can make, or a record's state badge, and nothing else is one. In a set of choices (the face switch, a calendar's range, the "Answers come from" setting, the embed's seats), the one chosen wears the capsule and the others are words to press. The places are text tabs that scroll, with the current one underlined, on a desk and on a phone alike. They are tabs rather than a menu because the places are the app's own navigation, read at a glance: a menu hides every name behind a press, and tabs keep every name whole and on screen. The tabs scroll sideways, a mouse wheel included, and the edge with more beyond it fades. The place you are on is scrolled into view, and each tab is a button the keyboard reaches. The "+N more" select and the phone's single select are gone. A district's name in the scene is text on its plot, haloed in the ground's colour, and its trouble bar is the name's baseline. The open control beside it is a quiet chevron. The scene's "Up" / "Down to …", the zoom control, the seat's suggestions and a calendar's previous, today and next are quiet buttons or links. A record is a card. A chip, a coverage cell's label, a relation's sign on a line and a kind's link on the routed home have a card's corners. A place page's other pictures are links. A kind's mark is its plot in miniature, a small iso tile in the kind's hue, rather than a round dot. A badge is not drawn where its context already says it. No card on a status board wears its own column's status, and a row under a grouped list's heading does not repeat that heading's value. The same goes for a field block of the board's own field. Other badges and blocks are drawn as before. A new harness, `pnpm verify quiet`, mounts the embed over the org app and Cloud's vendor template, as Cloud mounts it. It counts pills by Cloud's own definition: a visible element under 34 px tall, with a corner radius of at least half its height and a fill or a border. It runs in Chromium, WebKit and Firefox at 390×844 and 1280×800, in both schemes. The org app's desk Graview face goes from 39 pills to 4, and the vendor template's phone Pages home from 34 to 7. On the vendor template's desk Graview face it is 20 to 4, and on the org app's phone "Skills and levels" 12 to 7. No board card wears its own column's status, where four did. Cloud's hosted page loads 580 402 bytes up front (567 KB), where it loaded 580 510, so the design pass is 108 bytes smaller up front. The embed without the studio is 696 582 / 178 525 bytes first, where it was 696 428 / 178 422, and its gzipped budget is now 178 600.
  
  Compatibility: `Places` renders `nav[data-testid="places"]` holding `button.graview-place-tab[data-testid="place-<as>"]` (with `aria-pressed`) at every width. The `places-more` select and the compact `select[data-testid="places"]` are gone, and `compact` now puts the tabs on a row of their own. At altitude, `.graview-kind-face` has no capsule: no background, border or radius, and `[data-graview-tally]` is drawn at its foot. `.graview-kind-open`, `.graview-zoom`, `.graview-zoom-button`, `.graview-altitude-control` and `.graview-kind-tag` are no longer capsules. `Chip` has a 6 px radius. A kind's mark with no figure (`[data-graview-figure-kind="dot"]`) is a clipped iso tile, no longer a circle. The columns lens and a grouped list tell the cards they draw which value their heading already says; there is nothing new to import. `capabilities().shipped` gains `FR-113`, `FR-117` and `FR-118`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 72d2a95: A place handed back to the embed is settled as its seat sees the app (FR-116, FR-55). `setApp` and `mount(…, { at })` keep a record that is still there and send one that is gone to its kind's list on Pages, or its kind's group in the scene. "Still there" was asked of the whole store. A record the seat may not see was kept and one that does not exist was dropped. Under address routing the reader writes the address, so the next new declaration told that seat which guessed ids were real: `/people/<id>` stayed when the record existed and became `/people` when it did not. The place is now settled against the store as the seat is served it, so a record it may not see falls back exactly as an absent one does.
  
  Compatibility: unchanged for ops, stored formats, the wire, the declaration and check finding codes, and tool schemas.
- 1bfd44a: Under address routing, a place handed back to the embed is settled on the face the address names (FR-106, FR-116). `mount(…, { at })` already opened on the face in the address bar, but it settled the place as if it were on the face `at` said. A host that remounts after a reload with the `at` it read earlier can hand back the scene while the address names a page. The page in the address was then left unsettled, so a record since removed showed as missing instead of falling back to its kind's list. The scene's stop was also written onto the page's address as a fragment. The address now decides the face as well as the place, and a page it names is settled like any other.
  
  Compatibility: unchanged for ops, stored formats, the wire, the declaration and check finding codes, and tool schemas.
- Updated dependencies [f842422]
- Updated dependencies [fc42f1e]
- Updated dependencies [860223c]
- Updated dependencies [1e7eba5]
- Updated dependencies [0cee289]
- Updated dependencies [3f02759]
- Updated dependencies [5a236ea]
- Updated dependencies [cc50785]
- Updated dependencies [1712959]
- Updated dependencies [45842b7]
- Updated dependencies [8c43964]
- Updated dependencies [f16cfbc]
- Updated dependencies [63dfe90]
- Updated dependencies [b8c4527]
- Updated dependencies [ab91f13]
- Updated dependencies [b9435aa]
- Updated dependencies [05b0a95]
- Updated dependencies [196033b]
- Updated dependencies [6ac06de]
- Updated dependencies [bd69456]
  - @graview/core@0.1.14
  - @graview/primitives@0.1.14
  - @graview/react@0.1.14
  - @graview/pages@0.1.14
  - @graview/layout@0.1.14
  - @graview/studio@0.1.14
  - @graview/tools@0.1.14

## 0.1.13

### Patch Changes

- 2b05a64: A status board's column says the lens it is in (FR-109). Each column is a region, and its accessible name now starts with the lens's title: a column of "Vendors by status" is announced "Vendors by status · Researching, 0" where it was "Researching, 0", so a screen reader on a phone, which reads a region by its name alone, says which board a column belongs to. An embed names every landmark inside it after itself ("Views wedding · …"); a column marked `data-graview-named-by-lens` already says which picture it is in, and the embed leaves its name as it is, so the column is not "Views wedding · Researching, 0". The title is the declared lens's `title` on both faces, and "Board" for a columns lens registered without one. `verify-declared` asks each column by its role on both faces, at a desk and a phone, in both schemes.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. A test or a host that found a column region by its old name ("Todo, 2") finds it by the new one ("The board · Todo, 2"); `data-graview-column` is unchanged. Every other landmark in an embed is still named after the embed. `capabilities().shipped` gains `FR-109`.
- ed5444b: A host whose page is the app can give the routed face the address bar (FR-106). The embed's routed face ran on a memory router, so in Graview Cloud's hosted app a place could not be linked, reloaded or shared: loading `/places/vendors-by-status` drew the home, and opening the board's tile left the address at `/`. The embed takes `routing: "address"` now, with a `basePath` for a host that serves the app under a path of its own (`/apps/<id>/`; `/` by default). The routed face then reads its route from the address and pushes each page it opens. Places (`/places/<as>`), records (`/<plural>/<id>`) and the home have their own addresses. Back returns to where you were, and a reload stays put. The address also says which face is drawn. A page past the home is the routed face. A fragment at the home is the scene's stop, kept the way the whole-page Shell keeps it: a step is pushed, and moving the furniture replaces. A bare home is the routed face's home, or on arrival the host's `face`. The face toggle pushes the address of the face it goes to, so Back undoes it, and the toggle returns to the page you left. `mount` opens on the face the address names, and `faceAtAddress(options)` says which that is for a host that renders `<Embed>` itself. `routing: "memory"` stays the default for an embed inside somebody else's page, and it never writes `history` or changes `location`. A host that keeps its own history stays on memory routing. `onNavigate(path, how)` tells it each page the routed face opens, and `setPath(path)` on either handle sends the face back to one. `PagesApp` takes the same `onNavigate` and `path`. `addressOf(place, { basePath })` in `@graview/core` spells a place from `placesOf` under the base, exactly as the face's own links do, `pathWithin` reads an address back, and `basePathOf` normalises a base. Trailing slashes are the same base, and encoded slugs stay encoded. A new harness, `pnpm verify address`, holds all of this in Chromium, WebKit and Firefox at a desk and a phone, and it checks that an article's embed makes no history writes. The scene's fragment sync (`UrlSync`, `useUrlSync`, `adjustment`) is now a module of its own, so a page that never syncs the fragment does not load it up front. Cloud's hosted page loads 577 855 bytes up front (564 KB), where it loaded 575 357; the budget stays at 572 KB. The embed without the studio is 694 569 bytes first, where it was 692 174, and its budget is now 695 000 / 177 500. The gzipped budget for every face is now 439 000.
  
  Compatibility: `@graview/react/provider` no longer exports `UrlSync`, `useUrlSync` or `adjustment`; `@graview/react` still exports all three. `capabilities().shipped` gains `FR-106`. Memory routing is the default, so an embed that does not ask for the address bar behaves as before. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/primitives@0.1.13
  - @graview/react@0.1.13
  - @graview/pages@0.1.13
  - @graview/layout@0.1.13
  - @graview/studio@0.1.13
  - @graview/tools@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [4801c44]
  - @graview/core@0.1.12
  - @graview/layout@0.1.12
  - @graview/react@0.1.12
  - @graview/primitives@0.1.12
  - @graview/pages@0.1.12
  - @graview/tools@0.1.12
  - @graview/studio@0.1.12

## 0.1.11

### Patch Changes

- a190947: The hosted page has room again, and says what it weighs (FR-104). Graview Cloud's shell is `openRemote` plus the embed over a compiled document. With the columns lens, template labels, currency, walks from a set and the hidden-kind check landed (FR-97 to FR-101, FR-105), it loaded 611 900 bytes (598 KB) of framework before the app drew, against the 600 KB Cloud's brief set. Every new face feature pushed Cloud's budget test over. Measured from esbuild's metafile, 73 KB of what the page loaded up front was code that only a lazily loaded face uses. esbuild gives a whole file to every chunk that can reach it, and the page reaches files through an index. Two levers cut it to 589 079 bytes (575 KB). The first is the theme sheet. It was one stylesheet that the frame of every face drew, and a third of it named only what the scene draws: the districts from altitude, the plots, the village, the roads, the billboards and the bands. Those 87 rules are now `sceneCss` in `@graview/primitives` (and `@graview/primitives/scene`). The scene face draws them after the frame's `themeBaseCss`, inside the embed's box, so a page on the pages face carries none of them. `themeCss` is still the whole sheet: the base, then the scene's rules. That moves the scene's rules after the others, and a test holds that no rule was lost or doubled and that each one names something only the scene draws. This took 15.5 KB off the page and 17.5 KB off the pages face before it draws, and left the scene face unchanged. The embed's own bundle budgets come down with it: the pages face alone is now 495 604 bytes, where it was 511 391, and the embed without the studio is 787 572, where it was 810 223. The second is the frame's `useWidth`, `VISUALLY_HIDDEN` and `descentTarget`, which now come from files of their own. The frame no longer reaches the primitives' index or the scene's way back, which is 6.8 KB more. Cloud's own shell, built from these sources, is 596.0 KB on main and 573.7 KB with this change. The budget claim is now 585 KB: the new figure with 10 KB of headroom, 25 KB under Cloud's 600. `pnpm hosted` also writes docs/hosted-page.md, the weight by package as a table with the headroom and each face's figure before it draws. It also says what the first chunk needs for itself: 509 KB, measured with every door shut. The release step measures the page again and puts the same table under the `graview` and `@graview/embed` GitHub releases. What remains up front that only a door uses is mostly zod's JSON Schema writer (20 KB). It is reached through zod's own index and used by the companion's act tools. The rest is parts of `@graview/core` files reached through its index.
  
  Compatibility: `@graview/primitives/frame` exports `themeBaseCss` in place of `themeCss`. `@graview/primitives` exports `themeCss` as before, and adds `themeBaseCss` and `sceneCss`. Within `themeCss` the scene's rules come after the rest. Each rule weighs what it did, and a harness found no change. `capabilities().shipped` gains `FR-104`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [e6f90e0]
- Updated dependencies [e6594bb]
- Updated dependencies [fc50abf]
- Updated dependencies [31a6383]
- Updated dependencies [617b432]
- Updated dependencies [a738797]
- Updated dependencies [e567a7b]
- Updated dependencies [a190947]
  - @graview/core@0.1.11
  - @graview/primitives@0.1.11
  - @graview/layout@0.1.11
  - @graview/pages@0.1.11
  - @graview/react@0.1.11
  - @graview/studio@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 6b7edf9: A declared lens draws (FR-79). A document's `lenses` were accepted and drew nothing, and so were a TypeScript app's: a lens drew only because the app's own UI called `createTimelineLens(…)` and registered the result with a title, so a chat that wrote a lens into a document made something nobody would ever see. A `lenses` entry now takes a `title`, an `on` (the kind it stands on, when its bindings do not say) and data-only `options`, and a shipped lens with a title is a place: a pill on the bar, a drive-in from altitude and a page at `/places/<as>`, registered over each kind it stands on at many × full and many × summary. `declaredLenses(app)` in `@graview/core` decides which lenses draw, with which factory options resolved from the bindings, and why the rest do not; `SHIPPED_LENSES` names the six it maps — `timeline`, `calendar`, `coverage`, `board`, `plan`, `reach` — with their roles and the options each takes. `registerDeclaredLenses(registry, app)` in `@graview/primitives` (and `@graview/primitives/frame`) registers each as a door to the shipped factory, fetched when a lens is first drawn (`fetchDeclaredLenses`), and `declaredViews(app)` is the defaults, the view specs and the declared lenses in one registry. The embed calls it for every app it mounts, so a document's lenses draw with no views at all. What a factory needs that cannot be data is derived: a timeline's columns from the values its `column` field takes (or `options.columns`), its axis words from its extent, a calendar's `today` from the reader's own clock unless `options.today` names one. `graview check` says why a titled lens cannot draw, at its path — `lens-cannot-draw`, `lens-option-unknown`, `lens-title-taken`, `lens-not-shipped`, every one a warning — and a shipped lens needs no `requiredRoles` or `binds` of its own (`requiredRolesOf`, `bindsOf`). `plan` joins the shipped names in the checker and in `graview describe`, which now says which declared lenses draw, over what, at which address, and why a titled one does not. `placesOf(app)` lists every place an app has — the home, each lens, each kind — as `{ slug, title, kind, cardinality, address, stop, lens?, hidden?, first? }`, for a host to list. Apps/todo, apps/rota, apps/gauntlet and apps/discography declare their shipped lenses with titles and register none of them by hand. The studio keeps two lenses of one name apart by their titles. `@graview/primitives/scene` is a new subpath (the companion, the inspector, the places bar), which the embed's scene face and the pages' assistant import so that a face which draws no lens does not carry the six factories; `@graview/primitives/pages` also exports `registerDefaultViews` and `registerViewSpecs`. The bundle budgets for every face and for the studio handed in rise to 1_400_000 / 412_000, and what a page without the studio loads first to 203_000 gzipped, said in `scripts/lib/bundle-budget.mjs`, which now measures from the page's own entry rather than the first chunk esbuild lists. A hosted page carries 563 KB up front. Unit tests compile a document declaring one lens of each shipped type and find each drawn by its title on the embed's bar and at its page, `check` and `describe` agreeing with the one list; `verify-declared` does it in a browser. The `graview-lens` skill says to declare a shipped lens rather than register it. `capabilities().shipped` names FR-79.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `title`, `on` and `options` are new optional fields of a `lenses` entry, and `requiredRoles` is optional on `LensDeclaration`. The new codes are warnings, never errors, and a declaration that checked clean before still does; a check's `where` names a titled lens by its title. The wire — `capabilities().shipped` gains `FR-79`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `arrange` and `arrangement`, so a hand-built registry needs neither.
- 77a9fdc: A home view from the closed block set (FR-81). The home was always derived, and a document that wrote `views.home` was refused. A declaration's `home` — a document's `views.home`, a list of blocks — is now the home's body on both faces: on the routed face it replaces the derived home under the shell, its first headline the page's `h1`; on the Graview face it stands as a landing over the picture whenever the scene is at home (nothing focused, nothing chosen), at ground level and from altitude, on the side the companion leaves free, put away by going anywhere or by its own button (`HomeLanding` in `@graview/primitives` and `@graview/primitives/scene`, drawn by `Shell` and the embed's scene face). An empty graph still opens on the way in: the home view yields to the beginning until there is a record to show. Three blocks join the set, and work in a card, a row and a page as well as the home: `headline` (a template), `figure` with an expression (`{ figure: "sum(all('package'), net)", as: "number" | "money" | "percent", currency: "USD", label }`; `{ figure: true }` is still the kind's picture), and `list` (`{ list: expr, sort: key | { by, direction: "asc" | "desc" | "choices" }, limit, group: field | { by, headings }, empty, as: "card" | "row" }`), which draws each record with its own card or row spec and makes it a link — a record's address on the routed face (`SpecLinks`), a pick on the scene. Blocks about no one record may not name a bare field and reach records with `all('kind')`; a list's sort key and group are held to the kinds its source reaches. A lens named `blocks` with a title, an `on` and `options.blocks` is a place drawn from the same blocks, so a chat can write a picture with no code (`SHIPPED_LENSES.blocks`). The registry carries the home view beside the places (`registry.home(view)`, `registry.homeView()`), set by `registerDeclaredLenses` and fetched when first drawn (`fetchHomeView`); `graview describe` says the home is drawn from blocks, and the document diff says when the home's look changes. FR-83's gap closes: a kind's `glance` may name a computed field (the card and the list line work it out over the seat's graph), and a `label` or `describe` may name one worked out from the record alone — one that reads beyond the record is refused, since a label is said with no graph in hand. `packages/core/tests/document/fixtures/lifelogics.gdd.json` rebuilds LifeLogics' front page and its four lenses as data; unit tests draw it, and `verify-declared` draws it on both faces at 1440×900 and 390×844 in both schemes. The `graview-pages`, `graview-node-kind` and `graview-lens` skills say how. The bundle budgets rise with measured numbers in `scripts/lib/bundle-budget.mjs`: an embed without the studio to 815_000 / 215_000 (measured 802_562 / 209_988), every face and the studio handed in to 1_430_000 / 424_000 (measured 1_420_964 / 418_572 and 1_414_220 / 413_619); a hosted page carries 584 KB up front, and a face before it draws at most 840 KB (the scene measured 836_810, from 817_424). `capabilities().shipped` names FR-81.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `views.home` as a list of blocks, the `headline`, `list` and expression `figure` blocks, and the `blocks` lens are new; `views.<kind>` as an object of slots reads as before, so a kind called `home` keeps its views. A titled lens named `blocks` was a warning before and draws now; what its blocks cannot say is a warning at its path, never an error. A `label`, `describe` or `glance` naming a computed field was an error and is now accepted where it can be said. New codes (`list-sort`, `list-group`, `list-limit`, `list-as`, `list-empty`, `view-currency`) are errors only on blocks that could not compile before. The wire — `capabilities().shipped` gains `FR-81`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `home` and `homeView`; `RenderContext` an optional `budget`.
- 6852b7d: `pages` is a real arrangement (FR-80). A document's `pages` was accepted and never compiled, and an app had no way to say what its home shows first or where it opens. `pages: { order?, hide?, first? }` (`PagesArrangement`) is now typed, compiled onto the app, given back by `toDocument`, and honoured on both faces. `order` names kinds in the order the routed face's gallery and nav and the city at altitude take them (`orderKinds`); kinds it leaves out follow as declared. `hide` takes kinds off the home only — their cards and counts — and a hidden kind keeps its list, its records, its place in the nav and its search results. `first` names where the app opens: a place by its title or address word, a kind by its name or plural, or `"home"` (`openingOf`). The routed face opens there once, replacing the arrival so Back leaves the app, and the masthead still goes home; the scene opens on it when nothing else was asked (`openingView` in `@graview/react`, which the provider and the embed use). The arrangement travels on the view registry beside the places (`registry.arrange(pages)`, `registry.arrangement()`), set by `registerDeclaredLenses` and carried by `layerViews`, so every face that reads the places reads where they go. `graview check` names a kind in `order` or `hide` that is not there and a `first` that is no place, kind or home — `pages-kind-unknown`, `pages-first-unknown`, warnings at their paths — and `graview describe` says where the app opens, the order and what the home leaves off. Removing a kind in the document editor takes it out of `order` and `hide`, and renaming one renames it there. Unit tests compile a document that orders three kinds, hides one and names a lens first, and find it opening on that lens on both faces with the home in that order and the hidden kind reached by link and by search; `verify-declared` holds the same in a browser. The `graview-pages` skill says how. `capabilities().shipped` names FR-80.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `pages` was any object and is now one whose `order`, `hide` and `first` are typed; other keys are still accepted, so a document that compiled before still does. The new codes are warnings. The wire — `capabilities().shipped` gains `FR-80`. Ops, stored formats and tool schemas are unchanged.
- Updated dependencies [39a3983]
- Updated dependencies [7d77ff7]
- Updated dependencies [6b7edf9]
- Updated dependencies [cbe1cc6]
- Updated dependencies [fff6319]
- Updated dependencies [4ae597b]
- Updated dependencies [f9d5951]
- Updated dependencies [c3e2c1d]
- Updated dependencies [77a9fdc]
- Updated dependencies [6809372]
- Updated dependencies [fff6319]
- Updated dependencies [03733a0]
- Updated dependencies [77a9fdc]
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
- Updated dependencies [7307a0c]
  - @graview/primitives@0.1.10
  - @graview/core@0.1.10
  - @graview/react@0.1.10
  - @graview/pages@0.1.10
  - @graview/studio@0.1.10
  - @graview/tools@0.1.10
  - @graview/layout@0.1.10

## 0.1.9

### Patch Changes

- b5a4bfc: A host speaks in the app's own notices (FR-75). Graview Cloud said "a newer version is available", "offline — changes will be sent when you reconnect", "held while a repair is checked", a conflict with two choices and a refusal's sentence as elements of its own fixed over the app at `z-index: 1000`, in a copy of the framework's floating panel kept in step by hand. The embed's handle now has `notify({ kind: "toast" | "banner", sentence, tone?, action?, actions?, id?, timeout? })`, and so does `@graview/embed/pages`'s. It returns `{ id, dismiss(), update(change) }`. A toast goes by itself after `TOAST_MS` (six seconds; `timeout` says otherwise and `false` keeps it), unless it carries an action, when it waits for one; a banner stays until it is dismissed. A notice said under an `id` already showing takes its place. `tone` is `info` (the default), `good`, `warn` or `bad`, drawn as the notice's edge and dot in the theme's own colours. An action is a press (`onSelect`) or a link (`href`, `target`), the first drawn as the one the notice asks for, and either closes the notice; every notice has a dismiss control. Banners stand at the top of the picture and toasts at its foot, in the floating panel's look and the embed's scheme. Both are in the browser's top layer on the ladder's toast rung (FR-76), and are shown again over any popover of the family that opens after them (`raiseOverPopovers` in `@graview/react`). Each is said aloud as it arrives through a polite live region, and one whose tone is bad through an alert. `createNoticeBoard` and `Notices` in `@graview/primitives` are the board and its drawing: a React host drawing `<Embed>` passes `notices`, and the whole-page `Shell` takes a board as `notices` and draws it over its scene. This is the framework's reading of a request that arrived cut off at "the embed handle exposes `notify({ kind: "toast" | "banner"`": the sentence, the tone, the action, the id and the handle with `dismiss` and `update` are what the rest of that request most plausibly said, and `warn`, `actions` and `timeout` are added for Cloud's offline banner, conflict card and newer-build notice. A unit test says a toast, sees it said aloud and gone, keeps a banner past a minute and changes it in place, says a bad one as an alert, replaces one by id, presses an action and follows a link, and does it on the pages alone. `verify-chrome` says a banner and a toast through the handle on the embed's Graview face at 1440×900 and 390×844, in light and in dark: both are in the top layer, inside the viewport and on top at their middle, in the floating panel at better than 4.5:1, and said aloud. The toast stands over the profile opened after it, goes by itself while the banner stays and changes in place, a bad one is said as an alert, and a dismissed banner is gone. The `graview-embed` skill says to use it. `capabilities().shipped` names FR-75.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-75`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged. `EmbedHandle` and `PagesEmbedHandle` gain `notify`, so a host's own stand-in for either needs one.
- e811d26: A host's own actions are drawn in the profile menu (FR-72). Graview Cloud had nowhere in the embed for "Change the app", "Your apps" and "Report this app", so it kept them in a `<details>` menu of its own fixed over the corner of the scene. `mount(root, { hostActions: [{ label, href }] })` now draws them in the strip's profile menu, under who is signed in, in the order given: each a link (with `target` where it opens elsewhere) or, with `onSelect` and no `href`, a press; a press of either closes the menu. They are stops for the keyboard like everything else in the menu, which takes the keyboard when it opens (FR-77), and they are drawn in the embed's own scheme. `@graview/embed/pages` takes the same option, and so does the whole-page `Shell`; `HostAction` is exported from `@graview/embed` and `@graview/primitives`. A unit test finds the links in the menu of the whole embed and of the pages alone, in order and reachable, and a press that closes it; `verify-chrome` mounts the embed on a host's page with Cloud's three actions and reaches each by the keyboard alone from the profile button, on the Graview and pages faces, at 1440×900 and 390×844, in light and in dark, at better than 4.5:1 against the menu, with nothing of the host's fixed over the embed. The `graview-embed` skill says to put a host's furniture inside the embed, never over it. `capabilities().shipped` names FR-72.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-72`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- 4e1d6e3: Every popover opens over everything, and everything else stands on one ladder (FR-76). On a hosted app the profile menu opened under the seat's rail and could not be read: each surface picked its own `z-index` in one stacking context, the profile and the problems 20, the rail 40, the altitude control 5, the zoom 8, a menu 60, the studio 100. Now the transient surfaces — the profile, the problems, the activity, the Find box's suggestions, the districts a row could not hold, a card's acts at the pointer, `ChatPanel`'s pill and the studio's own seat — are shown with `showPopover()` in the browser's top layer, which Playwright's Chromium, WebKit and Firefox all have: drawn over every rail, the scene and anything on a host's page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` their ancestors carry, and still inside the element they opened in, so an embed's scoped theme reaches them and nothing lands on the host. In the top layer a pane is placed by what opened it (`useTopLayer` and `placePane` in `@graview/react`): under it, or over it where there is more room above, kept to the viewport, and no taller than the room it has, so what it holds scrolls inside it. Where `showPopover` is missing the pane stands on the ladder's popover rung. Everything that stays on screen takes a named rung from one ladder written once in `@graview/core` (`LAYERS`, `layer(name)`): scene, overview, rail, popover, dialog, toast, which `themeCss` writes on its root or an embed's box as `--graview-layer-<rung>`. The scene's ground is a stacking context of its own, so what orders its plots, cards, lines, figures and zoom (`SCENE_LAYERS`) can never climb over a rail. `POPOVERS` in `@graview/react` names every popover in the family with what opens it and its pane. A test reads every source file of every package and finds no `z-index` written as a number outside the ladder; `verify-chrome` opens every popover of the registry on the embed's Graview and pages faces and on the Shell, at 1440×900 and 390×844 with the seat open, and finds the pane in the top layer, inside the viewport, and under the browser's own `elementFromPoint` at its middle and at its last row. `capabilities().shipped` names FR-76.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-76`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- e4f7b67: The seat's rail can be put away (FR-78). It took a column of the picture on every screen whether anybody was talking to it or not, and a hosted app's reader had no way to give the map the room. The companion's header now puts it away to a slim tab at the picture's left edge (`COMPANION_TAB`, 36 pixels), and the tab opens it again, by the pointer or the keyboard, which follows the control from the header to the tab and back; both say `aria-expanded`. Put away, the picture's box gives up only the tab and the provider's new `railLeft` (lent by the companion through `registerRail`) tells the layout the seat takes nothing more, so the city lays out into the room: `railInset(width, left)` takes it. The reader's choice is remembered per app under `graview:companion:<app>` in the host's `memory` or the page's storage, every read and write of it wrapped so a frame that refuses storage still works. Narrower than `COMPANION_OVERLAY_BELOW` (960 pixels) the open rail lies over the picture in the floating panel's look rather than taking a column, with the tab kept at the edge; on a phone it is the sheet along the bottom, as before. `mount(root, { companion: "open" | "collapsed" | "hidden" })` sets where it starts, and the whole-page `Shell` takes the same `companion` prop (remembered under the brand's name): the reader's choice wins over `"open"` and `"collapsed"`, and `"hidden"` draws no rail, no tab and no A-key door. The companion takes `start` and `rememberAs`; `CompanionMode` is exported from `@graview/primitives` and `@graview/embed`, and the provider carries `memory`. A unit test puts it away and opens it again with the keyboard following, finds the picture's box padded by the tab and the layout told, the choice kept and read back over the host's start, `"hidden"` drawing nothing, and storage that throws. `verify-chrome` does it from the keyboard on the embed's Graview face and on the Shell at 1440×900 — the scene's box is the frame's width less the tab, the city's first card moves left into the room, the choice survives a reload both ways — and finds the open rail over the picture at 820 wide with the picture all but the tab, and the host's `"collapsed"` and `"hidden"` starts. The `graview-embed` and `graview-agent-seat` skills say how. `capabilities().shipped` names FR-78.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-78`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged. `GraviewContextValue` gains `railLeft`, `registerRail` and `memory`, so a hand-built context value for a test needs the first two.
- Updated dependencies [0ecda3f]
- Updated dependencies [b5a4bfc]
- Updated dependencies [e811d26]
- Updated dependencies [d953bf9]
- Updated dependencies [4e1d6e3]
- Updated dependencies [7597e22]
- Updated dependencies [1aba73e]
- Updated dependencies [e4f7b67]
  - @graview/react@0.1.9
  - @graview/primitives@0.1.9
  - @graview/core@0.1.9
  - @graview/pages@0.1.9
  - @graview/studio@0.1.9
  - @graview/layout@0.1.9
  - @graview/tools@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8
  - @graview/layout@0.1.8
  - @graview/pages@0.1.8
  - @graview/primitives@0.1.8
  - @graview/react@0.1.8
  - @graview/studio@0.1.8
  - @graview/tools@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/layout@0.1.7
  - @graview/pages@0.1.7
  - @graview/primitives@0.1.7
  - @graview/react@0.1.7
  - @graview/studio@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- a5daad4: A host's refusal is said in its own words, and an Apply with nothing changed asks the host nothing (FR-65). `onApply` could answer `{ ok: false, findings }` (FR-60), which the studio always headed "Not kept: the host could not keep this change. Your edits are still here.", so Graview Cloud said "Nothing changed in the studio." as a finding under a heading about failing to keep something. A verdict may now carry a `sentence`, which the studio says as its heading in place of its own; with one, `findings` may be empty or left out, and no empty list is drawn. Apply with nothing changed, or with every change taken back, no longer reaches the host: the studio says "Nothing to apply: the declaration is as the studio opened it. Change something, then Apply." and stays open. `Studio.unchanged()` reads that from the graph, not the history, so a change undone is no change. The applied panel's `data-applied` gains `unchanged`. Tests in `@graview/embed` hold the sentence as the heading with findings, with an empty list and with none, the studio's own heading where there is no sentence, and `onApply` not called for an untouched studio or one whose change was undone; `verify-studio` presses Apply in a host's page before any change and finds the host handed nothing, then finds the host's sentence heading its refusal. `capabilities().shipped` names FR-65.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-65`. `StudioHostVerdict` widens: a refusal may carry `sentence`, and with it `findings` is optional. A host whose `onApply` was handed an unchanged declaration is no longer called for it. Ops, stored formats, check codes and tool schemas are unchanged.
- 94da01b: The embed's stylesheet keeps to its box (FR-64). `themeCss(scheme, brand, { scope })` put the tokens, the ground and the type on the scope, but every other rule was written for a whole page, so the `<style>` an embed renders still said `h1, h2, h3, h4`, `code, kbd, samp`, `button`, `button:hover:not(:disabled)`, `button:focus-visible`, `button:disabled` and `code` bare: on Graview Cloud's builder the host's own buttons below the studio took the framework's ink on a transparent ground and failed contrast in dark (3.41:1). With a scope, the finished sheet is now rewritten so every selector that does not already start at the box is under `:where(<scope>)`, inside @media and @supports too; `:where` weighs nothing, so each rule wins exactly the contests it won on a whole page, and only where it applies changes. The reader's motion answer is still asked of the document element and applied inside the box, and the registered `--graview-altitude` and the keyframes name no element. Without a scope the stylesheet is byte for byte what it was. A test reads every selector of every rule in the scoped sheet, in both schemes and two brands, and fails on any that could match outside the box; `verify-studio` mounts the studio in a host's page with the host's own `<button>`, `<h2>` and `<code>` below it and finds their computed styles the same as on that page with no embed, in dark and in light. The pages' gallery rule and the prose links' rule are keyed on Graview's own class and attribute, and the studio and the Shell bring no stylesheet of their own. `capabilities().shipped` names FR-64.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-64`. `themeCss` without a scope is unchanged; with one, the same rules in the same order, each held inside the scope. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/studio@0.1.6
  - @graview/core@0.1.6
  - @graview/primitives@0.1.6
  - @graview/layout@0.1.6
  - @graview/pages@0.1.6
  - @graview/react@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- 97f2a0a: A host that keeps the declaration says who is offered the studio (FR-59). `maySeeTheStudio` judges by the app's own policy, which grants the app's people, not its builders: on the vendors app only an owner or a planner may do everything, so an editor Graview Cloud had already let onto its builder was shown no studio, and Cloud's way round it was to hand the embed a store with the policy taken off. Now `StudioPlace` takes `offered`, and the embed's `studio` option passes it through: `true` or `false` is the host's word over the policy's, and a function `(store, principal) => boolean` decides from the store and the seat. Omitted, `maySeeTheStudio` decides as it always has. The app's policy stays on the store for everything else the embed draws. A test opens the vendors app through `mount(…, { studio: { onApply, offered: true } })` as a seat whose only role is `viewer`: the studio is drawn, and `handle.store.policy` is still the app's; without `offered` the same seat is offered nothing; `offered: false` withholds it from an owner. `StudioOffered` is exported from both packages, and `capabilities().shipped` names FR-59.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-59`. `offered` is a new optional prop and option; omitted, who sees the studio is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
- 1e21d54: A host that refuses a change is heard (FR-60). `onApply` returned nothing, so when the studio handed Graview Cloud a change with `documentFindings` — one no edit says, which Cloud cannot preview — the studio still said "The checker is happy. Handed to the host to keep" while the page around it previewed nothing. Now `onApply` may return, or resolve to, `{ ok: false, findings }`: the applied panel says "Not kept: the host could not keep this change. Your edits are still here." with each finding's path, message and fix, the studio stays open, and its edits are untouched, so Apply again hands the host the same change. A promise is waited for ("Handing it to the host…"), a rejected one is a refusal in its own words, and an answer to an earlier press that arrives late says nothing. Returning nothing or `{ ok: true }` is kept, as before. The panel carries `data-applied` (`kept`, `asking`, `refused-by-host`, `refused-by-checker`) for a harness to read. `StudioOnApply`, `StudioHostVerdict` and `StudioHostAnswer` are exported from `@graview/studio`, and the first two from `@graview/embed`, whose `studio.onApply` takes the same type. A test removes vendor's `notes` through the studio's own actions strip in an embed whose host refuses: the refusal and its finding are shown, "Handed to the host" is not, the studio is still open, and the second Apply hands over `[{ op: "remove-field", kind: "vendor", field: "notes" }]` again. `capabilities().shipped` names FR-60.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-60`. `onApply`'s return type widens from `void` to `StudioOnApply`'s answer; a host that returns nothing is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
- f1fcf13: A studio in a host's page draws no `<main>` of its own (FR-58). Graview Cloud's builder mounts the studio through the embed's `studio: { onApply }` into an element inside its own page, and the studio drew its picture in a `<main>` inside the embed's labelled section — so axe failed the host on `landmark-main-is-top-level` and `landmark-no-duplicate-main` whatever the host did, since a main inside the embed's region can never be top-level. Now `StudioPlace` takes `landmark: "main" | "region"`, and omitted it follows `within`: a boxed studio, which is every embed's, draws its picture as a region named "The declaration", and a page-filling one keeps its main. The embed's `studio` option takes the same `landmark`, for a host whose whole body is the studio, and its type is exported as `EmbedStudio`. A test builds a page the way Cloud's is (a header, a nav, its main, a footer), opens the studio in it, and runs axe's landmark rules and `region` over the whole document: nothing; with `landmark: "main"` axe reports the two rules Cloud did. `capabilities().shipped` names FR-58.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-58`. An embed's studio draws a labelled `section` where it drew a `main`; a host that selected the studio's `main` selects `[data-testid="studio"] section[aria-label$="The declaration"]`. Ops, stored formats, check codes and tool schemas are unchanged.
- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
- 5a2086e: A host whose page is the studio hands it in, and waits for no chunk (FR-63). The embed imports its own studio when it is first drawn, which is right for a page that may never open it and a round trip for one whose whole point is the studio: Graview Cloud's builder fetched about 109 kB before the studio drew. Now the embed's `studio` option takes `place: StudioPlace`, imported by the host from `@graview/studio`: the embed draws it in the render that mounts it, with the host's `onApply`, `landmark` and `offered`, and never imports its own. A flag (`eager: true`) could not do this, since what a bundler splits is decided by what the code imports, not by a value, so the studio is handed in instead. `scripts/lib/bundle-budget.mjs` reads which `@graview/*` packages esbuild's metafile leaves in a chunk the entry does not import outright, and a new budget, "embed with the studio handed in", fails when any `@graview/studio` module is in one (`lazyLacks`); `pnpm pack:inspect` holds it with the others. A jsdom test mounts an embed with a stand-in handed in and finds it drawn in the first render, and the embed's own studio never imported. The graview-embed skill says when to hand it in, and what `onApply` may answer. `capabilities().shipped` names FR-63.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-63`. `place` is a new optional field of the embed's `studio` option; without it the studio is fetched when drawn, as before. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [f989024]
- Updated dependencies [97f2a0a]
- Updated dependencies [1e21d54]
- Updated dependencies [281761b]
- Updated dependencies [a83a311]
- Updated dependencies [f1fcf13]
- Updated dependencies [9787063]
- Updated dependencies [826e19b]
- Updated dependencies [e22a00d]
- Updated dependencies [5a2086e]
- Updated dependencies [6ff733b]
- Updated dependencies [76df9ba]
  - @graview/studio@0.1.5
  - @graview/core@0.1.5
  - @graview/primitives@0.1.5
  - @graview/react@0.1.5
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5
  - @graview/pages@0.1.5

## 0.1.4

### Patch Changes

- cc889f4: A typed app fits wherever an app goes, with no cast. A consumer's TypeScript met four walls that the framework's own code got past with `as never` and `as unknown as GraviewApp<AnySchema>`. `installation.mutations` would not spread into an app's mutations. A typed app was not an app: `GraviewApp<S>` would not widen to `GraviewApp<AnySchema>`, because an act's `apply` and `describe` and a rule's `evaluate` were function-typed properties, checked contravariantly — so the studio's readers (`graphToDeclaration`, `migrationBetween`, `sourceChanges`, `declarationFiles`), `createStoreHandler` and the embed could not be handed one. `schema.definition(kind)` on a schema whose kinds are only `string` was `never`. And an unbound `defineInvariant` handed its rule a `never` subject. Now `apply`, `describe` and `evaluate` are declared as methods, so a typed app and its acts and rules widen; `installation.mutations` spreads into any app's mutations; `definition(kind)` answers the kind's definition, any definition of that kind on `AnySchema` (`DefinitionOfKind`); an unbound rule's subject is a node of its kind (`NodeOfKind` on `AnySchema`), its fields `unknown` until bound; and `reachLens.View` is the generic view it always was, so it registers on any app. The casts are gone from the studio, the store handler, the embed, `@graview/core/testing`, the launcher and the example apps, and type-level tests hold each wall down.
  
  Compatibility: types only, nothing at run time changes. Every type is wider than before except one: `apply`, `describe` and `evaluate` lose `readonly` (a method cannot be marked so), so code that reassigned one is now allowed to, where it was refused. `DefinitionOfKind` is a new exported type. A call such as `syncConflictInvariant()` beside a typed schema may now infer `AnySchema` where it inferred the schema, and wants `syncConflictInvariant<typeof schema>()`. The wire, ops, stored formats and check codes are unchanged.
- 0fb76b7: An embed loads the studio when the studio is turned on, not before. `@graview/embed` imported `StudioPlace` outright, so every hosted page carried the studio — about 110 kB minified, 35 kB gzipped — including an embed mounted with `studio: false`, which never draws it. The studio is now imported with `import()` behind `React.lazy` and `Suspense`, inside the boundary it already drew behind: a product's bundler splits it into a chunk of its own, a page fetches it only when an embed offers the studio, and until it arrives the strip has no studio on it yet (a chunk that fails to load is said by that boundary, like a studio that throws). `scripts/inspect-pack.mjs` now bundles the embed split as a product's bundler would, and holds a new budget, "embed without the studio": what a page loads first, 1,175,514 bytes minified and 329,683 gzipped, budgeted at 1,200,000 / 337,000, which fails if any module of `@graview/studio` is in it. "Every face" — every chunk, studio included — did not fall: the studio now carries `compileDocument` to judge a document by compiling it (about 26 kB minified, 9 kB gzipped), and its chunk is gzipped on its own (about 2 kB and 3 kB more), so it measures 1,285,784 / 365,101 (1,259,216 / 354,049 before) and its budget rises from 1,290,000 / 362,000 to 1,310,000 / 373,000.
  
  Compatibility: `mount`'s options and handle are unchanged; the studio's button appears a moment after the embed does, once its chunk arrives, where it appeared with the first render. A bundler that does not split puts the studio back in the one file, as before. `StudioApplied` is still exported as a type. Ops, stored formats, the wire and check codes are unchanged.
- Updated dependencies [df9932a]
- Updated dependencies [9de42fe]
- Updated dependencies [a9c0f2d]
- Updated dependencies [a814d97]
- Updated dependencies [75c1a26]
- Updated dependencies [e0f75bb]
- Updated dependencies [d496926]
- Updated dependencies [833e390]
- Updated dependencies [c5b36f7]
- Updated dependencies [53857e9]
- Updated dependencies [fdf82ed]
- Updated dependencies [be20407]
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
- Updated dependencies [6d324a0]
- Updated dependencies [180452e]
- Updated dependencies [ba950f3]
- Updated dependencies [1f260a7]
- Updated dependencies [062fe46]
- Updated dependencies [0497bbf]
  - @graview/core@0.1.4
  - @graview/studio@0.1.4
  - @graview/tools@0.1.4
  - @graview/layout@0.1.4
  - @graview/react@0.1.4
  - @graview/primitives@0.1.4
  - @graview/pages@0.1.4

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
  - @graview/primitives@0.1.3
  - @graview/layout@0.1.3
  - @graview/pages@0.1.3
  - @graview/studio@0.1.3
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- 6ea13f7: An embed knows what its host can keep. `mount({ studio: false })` leaves the Studio place off the strip, for a hosted reader who could change a declaration that would never be saved. `mount({ studio: { onApply } })` keeps it and hands the host what the checker passed (`StudioApplied`: the app, the migration and the files), asking after no dev-server door and writing nothing itself; `StudioPlace` takes the same `onApply`, and `useStudioDoor(null)` asks nobody. `@graview/embed/pages` mounts the routed face alone, without the scene, the lenses or the studio: bundled for the browser without React it is about 730 KB minified (195 KB gzipped), where every face is about 1.05 MB (300 KB). `node scripts/inspect-pack.mjs` bundles both and fails when either passes its budget, and a linked project's Vite config aliases the new entry (FR-19).
  
  Compatibility: additive — `EmbedOptions.studio`, `StudioPlace`'s `onApply`, `StudioApplied` and the `./pages` entry are new, and an embed without `studio` offers the Studio as before. `EmbedOptions` is now `FrameOptions` (exported) plus the scene's own options, with the same fields. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- a634594: An embed reports what went wrong and how long it took, without what was on screen. `mount` and `@graview/embed/pages` take `onError(error, { module, face })` and `onReady({ ms, face })`. Each face, the strip and the studio's place on it draw behind a boundary: what throws says it could not draw and offers to try again, and the rest of the embed keeps working, so a page that throws leaves the strip and the scene a press away. The host is told the error's class (`EmbedError`) and the framework module that caught it, never the message, which may quote a record. A view's own boundary in the scene reports the same way: `ViewBoundary` tells the `ErrorReportContext` above it, which `@graview/react` exports. `onReady` is told once, after the first render, how many milliseconds it took (FR-24).
  
  Compatibility: additive — `onError`, `onReady`, `EmbedError`, `EmbedErrorWhere`, `EmbedReady`, `ErrorReport` and `ErrorReportContext` are new, and a view that throws with no report above it is said on the console as before. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- The pages alone draw the app's views, and a view that throws on a page says so in its own place. `@graview/embed/pages` takes `views(schema, registry)` as `mount` does. Its pages draw from the same registry: the framework's defaults, the declaration's view specs, then the host's own (FR-35 on the pages-only entry). The pages face of `mount` gets the registry, the app's settings and presence through the same `PagesContent`. `mount` takes `heading` (FR-25) beside the frame options. On the pages, a lens or a kind's own group view that throws draws behind a `ViewBoundary`, as it does in the scene. The rest of the page keeps working, and the host's `onError` hears of it (FR-24).
  
  The pages-only bundle's budget is raised from 765 kB to 815 kB minified, and from 205 kB to 220 kB gzipped. The growth is the default views and view specs the pages now draw from: about 48 kB minified and 15.5 kB gzipped.
  
  Compatibility: additive — `views` moves from `EmbedOptions` to `FrameOptions`, so both entries take it. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- afcb06d: The workbench can be found by its headings. The seat, the inspector at the pointer, the activity and the places each open with a heading named as their landmark is, so a screen reader moving by headings reaches every region a person goes to.
  
  An embed's workbench says its name in a heading too. axe's `page-has-heading-one` failed on every embedded workbench in both schemes. `mount({ heading })` sets the level: `1` when the host's page is the app, `2` by default inside somebody else's article, and `false` when the host's own heading names it. The pages face has its own h1 and is not given a second (FR-25).
  
  Compatibility: unchanged for ops, formats, the wire and tools. `EmbedOptions.heading` is a new optional field, and an embed with no `heading` now carries an h2, which is not visible on the page.
- 570f9e2: A view registered once is drawn on every face, over the defaults rather than instead of them.
  
  - **The embed hands its views to the routed face.** `mount({ views })` used to build the pages face without the registry. A registered view was drawn in the workbench and never on a phone. The pages face now gets the same registry, with the app's settings and presence, so the gallery's card is the registered one × summary. The record page draws the kind's own one × full view under its heading (FR-35).
  - **Registering one view keeps the rest.** `views(schema, registry)` is handed a registry that already holds the framework's own view for every cell and the declaration's view specs. A function that builds a registry of its own is laid over those same defaults (`layerViews`), so one card no longer costs every other view. `<DefaultView {...props} />` draws the framework's own view for a cell inside a view of your own. On the record page, which is the default record, it draws nothing (`DefaultViewElsewhere`). `ViewRegistry.registrations()` lists every registration in the order it was made (FR-36).
  - **A member drawn as a row is a cell a view can claim.** When a kind has a one × glyph view of its own, as a component or a spec's `row`, two places draw it. A focused group draws each member as that line, each a target for its record. The list page draws each record as that line, with the whole line as the link (FR-37).
  
  The framework's own one-cell views are now marked as defaults (`isDefaultView`), the way its group views were, so a surface can tell them from an app's.
  
  Compatibility: the declaration — additive: `ViewRegistry.registrations()` and `ViewRegistration.across` are new, and a registry that implements the interface by hand needs the method. `EmbedOptions.views` is now called with a second argument, the registry to register onto. A function that ignores it still works, and is laid over the defaults instead of replacing them. Ops, formats, the wire and tools are unchanged.
- Updated dependencies [3afdd09]
- Updated dependencies [f36ccfc]
- Updated dependencies [346fbe3]
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
- Updated dependencies [c74b21f]
- Updated dependencies [984c96f]
- Updated dependencies [b71e7c5]
- Updated dependencies
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [afcb06d]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2
  - @graview/primitives@0.1.2
  - @graview/pages@0.1.2
  - @graview/studio@0.1.2
  - @graview/tools@0.1.2
  - @graview/react@0.1.2
  - @graview/layout@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [bf36bbe]
- Updated dependencies [ed02370]
- Updated dependencies [e0c8cac]
- Updated dependencies [e1b9f5c]
- Updated dependencies [cbdd94a]
- Updated dependencies [59d5dd3]
- Updated dependencies [097d684]
- Updated dependencies [e88f729]
- Updated dependencies [866d437]
- Updated dependencies [a1859c5]
- Updated dependencies [1df48c8]
- Updated dependencies [ccfe1cd]
- Updated dependencies [c307981]
- Updated dependencies [fa8bd61]
- Updated dependencies [32ea5ac]
- Updated dependencies [d76a957]
- Updated dependencies [b1eae03]
- Updated dependencies [c222b58]
- Updated dependencies [deb98ca]
- Updated dependencies [b535cb2]
- Updated dependencies [6b297f0]
- Updated dependencies [414ddde]
- Updated dependencies [a575ca9]
- Updated dependencies [3c0d822]
- Updated dependencies [f1cf758]
- Updated dependencies [b9cdc16]
- Updated dependencies [dcffc91]
- Updated dependencies [313eea3]
- Updated dependencies [6966a4e]
- Updated dependencies [0b78acc]
  - @graview/react@0.1.1
  - @graview/primitives@0.1.1
  - @graview/core@0.1.1
  - @graview/pages@0.1.1
  - @graview/studio@0.1.1
  - @graview/tools@0.1.1
  - @graview/layout@0.1.1

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
- e0d5026: A kit for the picture. Everything the scene draws that is not a view — the lines, their captions, the ground's grid and lattice, the kind tags, how far the unlit recedes, the mark a broken rule leaves — is declared on `brand.kit`, any part of it, the rest as shipped. A connector's route is a named strategy (`curve`, `straight`, `orthogonal`) and its stroke a named pattern; each is one case in one file, so the next is one more case and nothing in the scene moves. Colour and visibility are per edge kind under `connectors.byEdge` or for all under `connectors.all`; a kind kept quiet is not drawn and stays selectable from the inspector. `themeCss` emits the kit as `--graview-kit-*` custom properties that the ground and the tags read. `graview check` holds an explicit line colour to 3:1 against both grounds in both schemes (`kit-contrast-below-aa`, `kit-colour-unreadable`). An embed's handle gains `setBrand`, so a page can re-dress a running Graview.
- fc024d0: A lens chooses its shape by the room it has, and a narrow embed keeps its room for the picture.
  
  The coverage matrix's 316px label column put every column past the edge of a phone-width card, behind a sideways scroll nothing announced — names and no cells. The names now take a share of the width, and where the columns still would not fit at a fingertip each the matrix stacks: each row is its name and then its cells as labelled marks that wrap. Seven day columns in a 300px box were 40px cells with three letters in them; below about 44px a column a run of days is drawn as the agenda, and coarser cells wrap into as many columns as the width holds. The calendar's six range chips become one select when the card is narrow.
  
  The scene kept a fifth of a 360px embed clear for rails it does not draw there, and the layout took six gaps more off a focused card: a lens got 145 pixels. Below a phone's width the rails are gone and the focus margin is capped at a tenth of the span. The embed's strip, whose place and seat pills wrapped to five rows, shows the places and the seats as one select each when it is narrow.
  
  And the example's season and rotation calendars, declared on the chapters and never handed to the views, are drawn on the pages that explain them.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- 923bbfa: A profile on the bar. `<Profile>` is the one place that answers "who am I signed in as" and holds what belongs to the reader rather than to the installation: their own record (where an installation is declared), the seat switcher, the settings, and the scheme. Settings are declared — `app.settings`, drawn by the pane, honoured by the provider, and checked: `graview check` refuses a setting nothing can apply, one with nothing to choose between, one that opens on an answer it does not offer, two that share a name, and a root font size that is not a length. `readerSettings()` is the two every app should offer (text size and motion); `applySettings` carries them at the edge so an app's two faces agree.
  
  Two bugs surfaced underneath. The theme set `font: 0.875rem` on `html, body` — so the ROOT's own size became 0.875 of the browser's, every `rem` in the framework resolved against 14px instead of 16, and the one place a text-size setting can live was already occupied. The body is sized now; the root is left exactly as the reader has it, and "As your browser has it" stamps nothing rather than guessing. And `usePickTargets` stamped `role="button"` on every pick target including landmark elements, which ARIA forbids — three `<header role="button">` on the first screen of the demo, unnoticed because nothing had run axe over the scene. The role is now stamped only where it is legal; a target that cannot take it still gets `tabindex`. Motion is overridable by the reader: the stylesheet's reduced-motion rules are emitted once for the system's preference and once for `data-graview-motion="reduce"`, scoped so an embed honours a host's answer without restyling the host.
- e695209: A project can mount itself. `EmbedOptions.views` was typed as the erased return of `registerDefaultViews`, so passing the registry an app wrote for its own declaration — the only thing the option is for — was a type error; it is typed to the app's schema now. And a scaffolded project gains `@graview/embed` as a dependency, its dev alias, and an `embed.html` + `src/embed.tsx` to put one in, so the last rung of the pages skill is something a new project can actually climb.
- cb3fd21: `<Embed>` keeps the store it made when another seat sits down. Handed no store of its own, it built one from the declaration and the seed, and rebuilt it whenever the principal changed — the principal was in the memo's dependencies, and was handed to a `Store` that takes no such option — so a React host that changed seats lost every edit and the history with them. Who is at the keyboard is the provider's business; the store stays.
- 2cc27e9: Another seat's work is named by the seat's name. `nameOfAuthor(author, { graph, schema, seats })` reads the user node, else the seat the principal was offered under, else the id; the activity rail, the profile, and the routed face's history use it, and `PageContext` carries `seats` (the embed hands its own over). An app with seats and no installation read "user-lena" and "U user-june".
- 1272c12: An embed can offer seats. `seats: [{ label, principal }]` puts them on the strip, pressed while at the keyboard, and `handle.setSeat(principal)` changes who sits without touching the store or its history. The strip, the pages and the acts all narrow to the seat, so a policy is something a reader feels rather than reads about: sit down as the gardener and what only the coordinator may do is struck through.
- e809183: An embed's stop may name a place. `#view=the-season` is the link a page can write — `placeHref` spells it — and the scene's URL sync has resolved it to the group the place is a picture of since it existed; the embed read its `stop` through `fromUrl` alone, so a host page saying `data-stop="#view=the-season"` landed at the default view with the place's pill unpressed. The embed resolves it now, on mount and when the stop changes through the handle.
  
  A board in a room with no height of its own is sized by its width. The board lens drove its size from the measured height of the room it stood in, which a scene band and a page region have; in a chapter embed on the docs site the panel sits in a column as tall as its content, so the room measured four pixels, the board came out six by four, and every slot on it was a four-pixel target. Below a height a board could be read at, it takes the room's width and lets its aspect give the height, which is what a board in a document is.
  
  The embed has a fourth face, `picture`: one named lens and nothing else — the place the stop names, drawn at full size over the kind's current members, with no bar, no rail and no standing. A page that is about a lens shows the lens, not an app with the lens somewhere inside it; three of those stacked on the docs site's lenses section were three windows with a calendar somewhere in each. `PlacePicture` in `@graview/pages` is the component behind it, for an app's own page that wants the same.
  
  The calendar's day grid and agenda list are keyboard stops. Given less height than their rows they scroll inside themselves, and a region that scrolls with no focusable element in it is one a keyboard cannot scroll at all; each carries the span's own name.
- 9b3a623: An embed is a region with a name. `label` named every landmark inside an embed and left its root a plain div, so on a host page the strip, the seats and the picture sat outside any landmark: a reader moving by landmark could not reach the app, and two embeds were indistinguishable at the top. The root is a `<section>` named by `label` now — or by the app's own name when the page does not say — and the scaffolded host page has the `<main>` the embed deliberately does not bring.
- a6f64b0: Every size the framework draws is the reader's to change, and a test says so.
  
  The text-size setting works by one number on the root element, which is why every size here is written in `rem` or `em`. A single `font-size: 10px` opts one control out of it entirely — and four of them had. Set to Largest, every name in the city doubled while the district's own "open" control stayed ten pixels tall, along with the "+N past" tag, the altitude caption and every `<code>` span. The profile's mark was an 18-pixel circle around a letter that had doubled, and the name beside it was clipped to "Nobody in p…" by a 220-pixel cap.
  
  All of it is measured now rather than asserted: a probe loads the app at the browser's own size and at Largest and diffs every box. What came back was fifteen boxes that never moved while the text doubled. The framework's are fixed — four stylesheet rules, the profile's mark and name width, and five sizes in an embed's own chrome — and a new test walks the source of every package a person installs and fails on a font size written in pixels, in either spelling. A list in a commit message is not a guard.
  
  The demos had the same bug in bulk and are converted too: the garden's own product design (28 sizes), the launcher, and Things' views. `apps/promo` keeps its pixels on purpose — a 1920×1080 video composition has no reader and no setting.
  
  A district's drawing now keeps up with its name. The drawing is sized as a fraction of its card, the card is laid out in pixels off the stage, and the nameplate is sized in `rem` — so at Largest a doubled name stood over a drawing that had not moved at all, a postage stamp under a headline. It has a floor in `em` now, capped at the card: a first cut without the cap overflowed and the drawings were sliced off at the bottom edge, a plot reading as a V rather than a bed.
  
  **What still does not scale, named rather than hidden:** the scene's card geometry. `graview-kind-card` is 230×97 at every text size, because the layout sizes cards as fractions of the stage in pixels while their text is in `rem`. Making the city itself grow with the reader means fewer districts fitting on the ring, which is a layout change with its own design decisions — worth doing, not worth pretending is done.
- c3c93ce: An embed does not say a landmark's name twice. It prefixes every landmark inside it with its own label, and a picture whose panel bore the same name — "The pipeline", in an embed labelled "The pipeline" — became a region called "The pipeline · The pipeline". A region of the embed's own name is the embed's region, so it is named once and becomes a group rather than a second region of that name.
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
- e0d5026: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- b7d3209: The keyboard always lands somewhere. When an act removes, disables or hides the control the keyboard was on — Escape closing a menu, a chip's × dropping the selection, Back taking the page away, "Send" while the answer comes — it lands on the nearest thing that still stands where it was, or on the same control when a re-render drew it again (`useTheKeyboardLandsSomewhere`, installed by `Shell` and `<Embed>`). The studio hands the keyboard back to whatever opened it when it closes, and a routed page that replaces another lands it on the new page's heading. Eight walk findings were this one rule broken on eight surfaces; the browser harnesses' watch found it on about forty more.
- daccd55: The studio is a place on the bar. `<StudioPlace app={...} />` opens the running app's own declaration — kinds, fields, edges, acts, rules, roles and grants as districts, "What the checker says" as a place, the ordinary acts to change them, the studio's own history and undo, and an agent seat that proposes a repair for a rule that names none. Applying runs `graview check`, refuses on errors naming them, and otherwise offers the files `graview create` writes as downloads. Offered to the seat that administers where an app declares something administered, and to whoever is here where it does not — so a scaffolded project has it on day one. `Shell` takes it as a slot (the studio already depends on the shell's primitives); the embed strip takes it boxed, so a studio cannot escape onto somebody else's page.
  
  `ArgShape` gains `{ type: "boolean" }`. Without it "Add a field", whose `required` is a plain boolean, was derived NOWHERE — the studio's central act, in the studio, unreachable because nothing could ask one question. The strip asks it as two buttons rather than a text field somebody has to know to type "true" into.
  
  And what the studio does not model, it no longer destroys: a kind's `display.labels`, `display.hide`, `fixed` and `fieldRoles` are carried from the checkout through both the declaration and the written schema, narrowed to the fields that still exist. A `display.format` is a function and cannot be written; the file says so where it finds one, and `WrittenFile.kept` names it, instead of losing it silently.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 6e8a02c: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- 59cef8c: Who is where. Other people stand on your map at the plot their stop focuses, in the audience row of the showing they are watching, with their robots beside them captioned as theirs and the thing they point at outlined in their hue — placed by each viewer's own `whereIs` from a presence payload that is never a pixel and never enters the op log. `PresenceChannel` has two implementations in ship: a BroadcastChannel between tabs of one origin, beside the browser adapter, and two routes on the served store folded into the poll the remote store already makes. A per-tab session fills `Author.session` on a tab's ops and its presence key alike. Clicking a figure follows that person until you move yourself or press Escape; sharing is a reader setting in the profile pane; an embed broadcasts nothing unless handed a channel. `openRemote` now carries `applyAll` and `undo` to the wire.
- Updated dependencies [23d05c6]
- Updated dependencies [fb781c2]
- Updated dependencies [e8d10b1]
- Updated dependencies [dfba092]
- Updated dependencies [dd65d38]
- Updated dependencies [390028c]
- Updated dependencies [bff0b71]
- Updated dependencies [400a6df]
- Updated dependencies [f4dbcc8]
- Updated dependencies [5d634ca]
- Updated dependencies [8031925]
- Updated dependencies [eacd252]
- Updated dependencies [c7a3519]
- Updated dependencies [2aae30f]
- Updated dependencies [60b3e2b]
- Updated dependencies [73690fb]
- Updated dependencies [862fd42]
- Updated dependencies [475cc83]
- Updated dependencies [f11e51b]
- Updated dependencies [7546a38]
- Updated dependencies [09a23a3]
- Updated dependencies [78e568e]
- Updated dependencies [7246f46]
- Updated dependencies [92a2f73]
- Updated dependencies [dfbba3f]
- Updated dependencies [8bdbe72]
- Updated dependencies [509162f]
- Updated dependencies [8c14e4c]
- Updated dependencies [3f86b09]
- Updated dependencies [ad8549a]
- Updated dependencies [9f6593b]
- Updated dependencies [188bc6e]
- Updated dependencies [1ebfd44]
- Updated dependencies [a23e496]
- Updated dependencies [e0d5026]
- Updated dependencies [4ab1b6d]
- Updated dependencies [fc024d0]
- Updated dependencies [41abe03]
- Updated dependencies [e165c5b]
- Updated dependencies [b83e46f]
- Updated dependencies [f7c6c19]
- Updated dependencies [04bfcc3]
- Updated dependencies [6a043bf]
- Updated dependencies [406b774]
- Updated dependencies [a012583]
- Updated dependencies [e119b49]
- Updated dependencies [45c4b9c]
- Updated dependencies [14e22ab]
- Updated dependencies [4aa0f93]
- Updated dependencies [da81e1e]
- Updated dependencies [b7f83cc]
- Updated dependencies [1373dfb]
- Updated dependencies [5b5e5a3]
- Updated dependencies [aa90b02]
- Updated dependencies [c3879ba]
- Updated dependencies [fb5b3ad]
- Updated dependencies [cc3ddbc]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [ccc912a]
- Updated dependencies [7c0e701]
- Updated dependencies [73e3b86]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [63ba472]
- Updated dependencies [69aed60]
- Updated dependencies [d042ff2]
- Updated dependencies [fadebb9]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [708871a]
- Updated dependencies [c5e4ac7]
- Updated dependencies [42c2c96]
- Updated dependencies [9a3fe4b]
- Updated dependencies [c3033f4]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [a5d4967]
- Updated dependencies [97067b6]
- Updated dependencies [490eccd]
- Updated dependencies [e809183]
- Updated dependencies [8041853]
- Updated dependencies [83a40ed]
- Updated dependencies [4c4d52a]
- Updated dependencies [b9b0635]
- Updated dependencies [60efe3b]
- Updated dependencies [40f39ff]
- Updated dependencies [5e6d4e7]
- Updated dependencies [03b9c5a]
- Updated dependencies [5297528]
- Updated dependencies [ce13ec8]
- Updated dependencies [ff7de41]
- Updated dependencies [959955f]
- Updated dependencies [71de067]
- Updated dependencies [22e0668]
- Updated dependencies [9b3a623]
- Updated dependencies [b5e43ab]
- Updated dependencies [5a00a1f]
- Updated dependencies [d59b6c8]
- Updated dependencies [6af312b]
- Updated dependencies [887d768]
- Updated dependencies [455ef3e]
- Updated dependencies [de75e21]
- Updated dependencies [2c25067]
- Updated dependencies [b3ed5f6]
- Updated dependencies [73b30dc]
- Updated dependencies [e9f07b3]
- Updated dependencies [d36e6fa]
- Updated dependencies [7244498]
- Updated dependencies [b1fbc32]
- Updated dependencies [b79ef9a]
- Updated dependencies [05aaa72]
- Updated dependencies [f4dbcc8]
- Updated dependencies [796bf9e]
- Updated dependencies [a6f64b0]
- Updated dependencies [d907771]
- Updated dependencies [0bb6827]
- Updated dependencies [b5e95a1]
- Updated dependencies [894f0f1]
- Updated dependencies [130e9c6]
- Updated dependencies [c9c34de]
- Updated dependencies [3f5d3ba]
- Updated dependencies [2dd2f0e]
- Updated dependencies [1e773a5]
- Updated dependencies [7a61e87]
- Updated dependencies [1794980]
- Updated dependencies [171075a]
- Updated dependencies [4450ee4]
- Updated dependencies [9bad891]
- Updated dependencies [3e3bfff]
- Updated dependencies [a5d842b]
- Updated dependencies [0c465b9]
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [d9bfdb8]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
- Updated dependencies [30adc63]
- Updated dependencies [3815bcf]
- Updated dependencies [0c0fa22]
- Updated dependencies [8a2fdf2]
- Updated dependencies [73690fb]
- Updated dependencies [fb6eb5d]
- Updated dependencies [216ba97]
- Updated dependencies [5343a1d]
- Updated dependencies [45c7a2c]
- Updated dependencies [6dd2cfd]
- Updated dependencies [45c7a2c]
- Updated dependencies [ddf1ea9]
- Updated dependencies [6e0fbb7]
- Updated dependencies [b846b32]
- Updated dependencies [d3e1201]
- Updated dependencies [3376126]
- Updated dependencies [7188978]
- Updated dependencies [5572c41]
- Updated dependencies [e3a7de6]
- Updated dependencies [3af8da7]
- Updated dependencies [5aa8776]
- Updated dependencies [76e50a5]
- Updated dependencies [481340c]
- Updated dependencies [3e719c8]
- Updated dependencies [206670e]
- Updated dependencies [f80138a]
- Updated dependencies [ada0f00]
- Updated dependencies [e0d5026]
- Updated dependencies [59c1fdb]
- Updated dependencies [71fd426]
- Updated dependencies [2c20c53]
- Updated dependencies [4472467]
- Updated dependencies [8d43e33]
- Updated dependencies [7783759]
- Updated dependencies [89f4855]
- Updated dependencies [f240a12]
- Updated dependencies [859c128]
- Updated dependencies [53ad439]
- Updated dependencies [e0d5026]
- Updated dependencies [494c1a1]
- Updated dependencies [0ea3f62]
- Updated dependencies [b7d3209]
- Updated dependencies [bd1f27b]
- Updated dependencies [90a3344]
- Updated dependencies [6dd2cfd]
- Updated dependencies [aeb1693]
- Updated dependencies [6a043bf]
- Updated dependencies [0a3504a]
- Updated dependencies [b7fa5e3]
- Updated dependencies [1d121a7]
- Updated dependencies [9ff994c]
- Updated dependencies [4c66166]
- Updated dependencies [61d76a0]
- Updated dependencies [8894627]
- Updated dependencies [e30d22f]
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [8dbae9a]
- Updated dependencies [591a15a]
- Updated dependencies [7840cd5]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [0a6a3fe]
- Updated dependencies [a0ffc2f]
- Updated dependencies [7be1ad2]
- Updated dependencies [d22655e]
- Updated dependencies [0d1fd39]
- Updated dependencies [60e4bf5]
- Updated dependencies [a38a5af]
- Updated dependencies [098c784]
- Updated dependencies [ae188cc]
- Updated dependencies [851feb6]
- Updated dependencies [6dd2cfd]
- Updated dependencies [43cf40d]
- Updated dependencies [315ce3b]
- Updated dependencies [d9bfdb8]
- Updated dependencies [f8f0e29]
- Updated dependencies [3506c69]
- Updated dependencies [8ca3d2e]
- Updated dependencies [daccd55]
- Updated dependencies [dfb6120]
- Updated dependencies [e5e43e8]
- Updated dependencies [6520856]
- Updated dependencies [be9fb19]
- Updated dependencies [e7151d4]
- Updated dependencies [ce13ec8]
- Updated dependencies [e7735c1]
- Updated dependencies [1eedcff]
- Updated dependencies [ccaa5f4]
- Updated dependencies [49d4458]
- Updated dependencies [bd1f27b]
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
  - @graview/primitives@0.1.0
  - @graview/core@0.1.0
  - @graview/layout@0.1.0
  - @graview/react@0.1.0
  - @graview/pages@0.1.0
  - @graview/tools@0.1.0
  - @graview/studio@0.1.0
