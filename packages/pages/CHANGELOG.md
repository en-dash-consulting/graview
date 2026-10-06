# @graview/pages

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
  - @graview/primitives@0.1.11
  - @graview/layout@0.1.11
  - @graview/react@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 6b7edf9: A declared lens draws (FR-79). A document's `lenses` were accepted and drew nothing, and so were a TypeScript app's: a lens drew only because the app's own UI called `createTimelineLens(…)` and registered the result with a title, so a chat that wrote a lens into a document made something nobody would ever see. A `lenses` entry now takes a `title`, an `on` (the kind it stands on, when its bindings do not say) and data-only `options`, and a shipped lens with a title is a place: a pill on the bar, a drive-in from altitude and a page at `/places/<as>`, registered over each kind it stands on at many × full and many × summary. `declaredLenses(app)` in `@graview/core` decides which lenses draw, with which factory options resolved from the bindings, and why the rest do not; `SHIPPED_LENSES` names the six it maps — `timeline`, `calendar`, `coverage`, `board`, `plan`, `reach` — with their roles and the options each takes. `registerDeclaredLenses(registry, app)` in `@graview/primitives` (and `@graview/primitives/frame`) registers each as a door to the shipped factory, fetched when a lens is first drawn (`fetchDeclaredLenses`), and `declaredViews(app)` is the defaults, the view specs and the declared lenses in one registry. The embed calls it for every app it mounts, so a document's lenses draw with no views at all. What a factory needs that cannot be data is derived: a timeline's columns from the values its `column` field takes (or `options.columns`), its axis words from its extent, a calendar's `today` from the reader's own clock unless `options.today` names one. `graview check` says why a titled lens cannot draw, at its path — `lens-cannot-draw`, `lens-option-unknown`, `lens-title-taken`, `lens-not-shipped`, every one a warning — and a shipped lens needs no `requiredRoles` or `binds` of its own (`requiredRolesOf`, `bindsOf`). `plan` joins the shipped names in the checker and in `graview describe`, which now says which declared lenses draw, over what, at which address, and why a titled one does not. `placesOf(app)` lists every place an app has — the home, each lens, each kind — as `{ slug, title, kind, cardinality, address, stop, lens?, hidden?, first? }`, for a host to list. Apps/todo, apps/rota, apps/gauntlet and apps/discography declare their shipped lenses with titles and register none of them by hand. The studio keeps two lenses of one name apart by their titles. `@graview/primitives/scene` is a new subpath (the companion, the inspector, the places bar), which the embed's scene face and the pages' assistant import so that a face which draws no lens does not carry the six factories; `@graview/primitives/pages` also exports `registerDefaultViews` and `registerViewSpecs`. The bundle budgets for every face and for the studio handed in rise to 1_400_000 / 412_000, and what a page without the studio loads first to 203_000 gzipped, said in `scripts/lib/bundle-budget.mjs`, which now measures from the page's own entry rather than the first chunk esbuild lists. A hosted page carries 563 KB up front. Unit tests compile a document declaring one lens of each shipped type and find each drawn by its title on the embed's bar and at its page, `check` and `describe` agreeing with the one list; `verify-declared` does it in a browser. The `graview-lens` skill says to declare a shipped lens rather than register it. `capabilities().shipped` names FR-79.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `title`, `on` and `options` are new optional fields of a `lenses` entry, and `requiredRoles` is optional on `LensDeclaration`. The new codes are warnings, never errors, and a declaration that checked clean before still does; a check's `where` names a titled lens by its title. The wire — `capabilities().shipped` gains `FR-79`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `arrange` and `arrangement`, so a hand-built registry needs neither.
- fff6319: A `DerivedForm` names its parts: the form, each field (with `data-graview-field` saying its control), its label, its control, a picker and its chevron, a group, a list's rows and its add and remove, the refusal and the submit each wear `data-graview-part`. Their look moved from style attributes to rules at one element's weight, so an app's `[data-graview-part="control"]` restyles every control without `!important`, and with no sheet of its own a form looks as it did.
- 77a9fdc: A home view from the closed block set (FR-81). The home was always derived, and a document that wrote `views.home` was refused. A declaration's `home` — a document's `views.home`, a list of blocks — is now the home's body on both faces: on the routed face it replaces the derived home under the shell, its first headline the page's `h1`; on the Graview face it stands as a landing over the picture whenever the scene is at home (nothing focused, nothing chosen), at ground level and from altitude, on the side the companion leaves free, put away by going anywhere or by its own button (`HomeLanding` in `@graview/primitives` and `@graview/primitives/scene`, drawn by `Shell` and the embed's scene face). An empty graph still opens on the way in: the home view yields to the beginning until there is a record to show. Three blocks join the set, and work in a card, a row and a page as well as the home: `headline` (a template), `figure` with an expression (`{ figure: "sum(all('package'), net)", as: "number" | "money" | "percent", currency: "USD", label }`; `{ figure: true }` is still the kind's picture), and `list` (`{ list: expr, sort: key | { by, direction: "asc" | "desc" | "choices" }, limit, group: field | { by, headings }, empty, as: "card" | "row" }`), which draws each record with its own card or row spec and makes it a link — a record's address on the routed face (`SpecLinks`), a pick on the scene. Blocks about no one record may not name a bare field and reach records with `all('kind')`; a list's sort key and group are held to the kinds its source reaches. A lens named `blocks` with a title, an `on` and `options.blocks` is a place drawn from the same blocks, so a chat can write a picture with no code (`SHIPPED_LENSES.blocks`). The registry carries the home view beside the places (`registry.home(view)`, `registry.homeView()`), set by `registerDeclaredLenses` and fetched when first drawn (`fetchHomeView`); `graview describe` says the home is drawn from blocks, and the document diff says when the home's look changes. FR-83's gap closes: a kind's `glance` may name a computed field (the card and the list line work it out over the seat's graph), and a `label` or `describe` may name one worked out from the record alone — one that reads beyond the record is refused, since a label is said with no graph in hand. `packages/core/tests/document/fixtures/lifelogics.gdd.json` rebuilds LifeLogics' front page and its four lenses as data; unit tests draw it, and `verify-declared` draws it on both faces at 1440×900 and 390×844 in both schemes. The `graview-pages`, `graview-node-kind` and `graview-lens` skills say how. The bundle budgets rise with measured numbers in `scripts/lib/bundle-budget.mjs`: an embed without the studio to 815_000 / 215_000 (measured 802_562 / 209_988), every face and the studio handed in to 1_430_000 / 424_000 (measured 1_420_964 / 418_572 and 1_414_220 / 413_619); a hosted page carries 584 KB up front, and a face before it draws at most 840 KB (the scene measured 836_810, from 817_424). `capabilities().shipped` names FR-81.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `views.home` as a list of blocks, the `headline`, `list` and expression `figure` blocks, and the `blocks` lens are new; `views.<kind>` as an object of slots reads as before, so a kind called `home` keeps its views. A titled lens named `blocks` was a warning before and draws now; what its blocks cannot say is a warning at its path, never an error. A `label`, `describe` or `glance` naming a computed field was an error and is now accepted where it can be said. New codes (`list-sort`, `list-group`, `list-limit`, `list-as`, `list-empty`, `view-currency`) are errors only on blocks that could not compile before. The wire — `capabilities().shipped` gains `FR-81`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `home` and `homeView`; `RenderContext` an optional `budget`.
- 77a9fdc: A view can list related records (FR-82). A to-many walk in a block flattened to "A, B and C" or a count, and nothing could draw each related record or link it. The `list` block now takes a walk from the record as its source in a card, a row or a page — `{ list: "out('includes')", as: "row" }` on a package's page lists its offers, each drawn with the offer's own row and each a link; `{ list: "in('answers')" }` on a note's row lists the offers that answer it. A row that lists records or says a figure is drawn as a block rather than a one-line pill. The list reads the graph the view is handed, which for a seat is what that seat may see (FR-55): a related record it may not see is not listed, not counted in "and N more", and opens no group heading of its own, and a list left with nothing says its `empty` words. Lists nest at most three deep (`MAX_LIST_DEPTH`); past that a list says its records' names, each a link, so a card that lists records whose cards list records — round a loop or down a long chain — always ends, and every expression keeps its own step budget. `graview check` holds a walked list's sort key and group to the kind the relation reaches, and refuses a walk along a relation no kind declares. Unit tests draw the LifeLogics document for an owner and for a partner who sees only the offers their firm delivers, and find the partner's package page, note rows, home counts and group headings saying nothing of the rest; `verify-declared` follows a listed record on both faces. `capabilities().shipped` names FR-82.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: a walk is a new source for the new `list` block, and nothing that compiled before reads differently. The wire — `capabilities().shipped` gains `FR-82`. Ops, stored formats and tool schemas are unchanged.
- 5703a27: A worker view's links stay in the app (FR-93). The kit's `gv-link` could go to any `https:` address a host allowed, and a view written by a chat should be able to send the reader to a record or a place of the app it is drawn in, and nowhere else. The open kit already draws no `href`, so a view's `<a href="https://…">` is text. A view now writes `<a data-record="offer:coaching">` or `<a data-place="the-packages">`, and the host makes that a link: focusable, with the role of a link, and followed by the host when the viewer presses it or presses Enter on it. It goes only to a record the viewer may see or a place the app has. `graview.navigate("offer:coaching")` and `graview.navigate({ place: "the-packages" })` from the view's code are held to the same, and the guest-view protocol gains `navigate` with a `place`. A view's props list the app's named places as `places`, with each one's slug, title and kind, and `mountWorkerView` takes `places` and an `onNavigate` that hears `{ record }` or `{ place }`. A followed link is the view's region's alone: the face around it does not also take it for a press on the card. A press bound to an act is the host's alone in the same way.
  
  Going somewhere means what the face says it means. `@graview/react` gains `useGoTo` and `GoToContext`. On the Graview face, going to a record focuses and chooses it, and going to a place draws it. The routed face provides its own: a record's page, and a place at `/places/<slug>`. `workerView` and `workerHome` use it, so a worker view's links work on both faces with nothing more from the app. The kit's `gv-link` keeps `links.origins`: it is the kit's one deliberate way out, to the origins a host lists, and an open-kit view has no such way.
  
  A unit test draws a view's links into a shadow root and follows them by a press and by Enter. A link to a record Lin may not see, a place the app does not have, an address, and the same asked from code each go nowhere, and the last three are counted dropped. `guest-sandbox --transport=place` adds a second worker view, "What we heard", and makes the package lens's offers links. On the pages face, an offer's link goes to that offer's page, and "See the packages", followed with Enter, goes to the package lens. The view's `<a href="https://…">` is drawn as text with no href and no role. On the Graview face the same link to the place draws it, and an offer's link focuses and chooses the offer. All seventeen claims hold in Chromium, WebKit and Firefox.
  
  Compatibility: the wire — additive: `navigate` may carry a `place` in place of `to`, and `GuestProps` gains an optional `places`. Ops, stored formats, check codes and tool schemas are unchanged.
- 6852b7d: `pages` is a real arrangement (FR-80). A document's `pages` was accepted and never compiled, and an app had no way to say what its home shows first or where it opens. `pages: { order?, hide?, first? }` (`PagesArrangement`) is now typed, compiled onto the app, given back by `toDocument`, and honoured on both faces. `order` names kinds in the order the routed face's gallery and nav and the city at altitude take them (`orderKinds`); kinds it leaves out follow as declared. `hide` takes kinds off the home only — their cards and counts — and a hidden kind keeps its list, its records, its place in the nav and its search results. `first` names where the app opens: a place by its title or address word, a kind by its name or plural, or `"home"` (`openingOf`). The routed face opens there once, replacing the arrival so Back leaves the app, and the masthead still goes home; the scene opens on it when nothing else was asked (`openingView` in `@graview/react`, which the provider and the embed use). The arrangement travels on the view registry beside the places (`registry.arrange(pages)`, `registry.arrangement()`), set by `registerDeclaredLenses` and carried by `layerViews`, so every face that reads the places reads where they go. `graview check` names a kind in `order` or `hide` that is not there and a `first` that is no place, kind or home — `pages-kind-unknown`, `pages-first-unknown`, warnings at their paths — and `graview describe` says where the app opens, the order and what the home leaves off. Removing a kind in the document editor takes it out of `order` and `hide`, and renaming one renames it there. Unit tests compile a document that orders three kinds, hides one and names a lens first, and find it opening on that lens on both faces with the home in that order and the hidden kind reached by link and by search; `verify-declared` holds the same in a browser. The `graview-pages` skill says how. `capabilities().shipped` names FR-80.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `pages` was any object and is now one whose `order`, `hide` and `first` are typed; other keys are still accepted, so a document that compiled before still does. The new codes are warnings. The wire — `capabilities().shipped` gains `FR-80`. Ops, stored formats and tool schemas are unchanged.
- 7307a0c: The rule language computes what pages need, still total and budgeted (FR-83). LifeLogics draws its proposal in code: a package's price is the sum of list × units over its offers less the client's discount, the package it leads with is the recommended one else the top by standing and then price, and an offer's card says "Answers three of the things we heard". A chat could say none of it as data: `sum(S, field)` took a field's name and not an expression, nothing picked one record or put a set in order, a value that depended on another record could not be named once, and a template had no number words and no way to join a list.
  
  `sum`, `min` and `max` now take an expression per member, read with the member as its subject: `sum(out('includes'), list * units)`; a bare or quoted field name still names a field. `sort(S, key, 'asc' | 'desc')` puts a set in order (`'asc'` when unsaid) by a key each member gives. A list key sorts by its first value and then its next, nothing sorts last whichever way, and keys that cannot be compared are a sentence. `first(S)` is a set's first record, or nothing, so `first(sort(…))` picks one. `either(a, b, …)` is the first that is something, which is how an expression says "else". A sort pays for its keys and its comparisons from the budget before it makes them.
  
  A kind declares values it works out rather than stores: `computed: { net: "<expr>" }` on a document's kind (or `{ expr, label?, description? }`), and `defineNode({ computed })` in TypeScript (`ComputedField`). Every expression reads one like a stored field, so templates, view specs (a `field` block shows one, under its label), rules, sums and sorts do too. A computed field may read another. Each is worked out once per evaluation, from that evaluation's budget, so one read inside a template spends the template's 500 steps. Its own expression sees the record's fields and never an act's arguments. A cycle the check cannot see, across kinds through a relation, stops as a sentence ("depends on itself") when it is read. A computed field is never stored, never in the op log and never writable. No derived edit or act tool takes one, and an act that sets one is refused as `computed-written`. `computedValues(schema, graph, node)` in `@graview/core/document` says a record's computed values as plain data, a record named by one as `{ id, kind, label }`, and the ones it could not work out with why. `withComputed` lays them beside the stored fields for a surface that shows facts. A record's page lists them among its facts (`recordFacts`). `get_node` returns them as `computed`, marked as their authors' words, and its description says they are read-only. `graview describe` lists them under "Worked out" with their expressions. `toDocument` writes a declared kind's computed fields back as data.
  
  What a seat is served is worked out from what it may see (FR-55). A computed value is evaluated on demand over the graph the reader holds, and every seat reads through `store.seenBy(principal)`: the provider, the pages, `get_node`. So a hidden record adds nothing to a sum, wins no sort and is never the record a value names. A partner who may not see the client is served a package's price before the client's discount and learns nothing of the discount from it.
  
  `graview check` judges computed fields in a document and a declaration alike. It reports a name that is already a field or relation (`computed-clash`), one that is not a name (`computed-name`), an expression that does not parse or names nothing the kind has (`expression`, `computed-name`, `computed-edge`, `computed-kind`, `unknown-function`), and a cycle among a kind's computed fields, named in order (`computed-cycle`). It also says how a read's work grows with the graph, as a power of its size: a sweep read once for each member of a sweep is a warning, and work that grows with the cube is refused (`computed-cost`).
  
  Templates gain three formatters: `words` spells a whole number to ninety-nine ("three", "forty-five"); `and` joins a set or a list ("Workshop, Build and Advice"); and `plural: 'offer'` is the noun for a count, with the plural given where English does not make it (`plural: 'person', 'people'`). A formatter is read after the last bar outside quotes, so `{'a|b'}` and `{x || y}` are expressions again. A record in a sentence is called by its name, title or label, before its id.
  
  A test builds a document shaped like LifeLogics' (`packages/core/tests/document/fixtures/proposal.gdd.json`): parties, notes, offers with list and units answering notes, packages including offers, recommended and standing. A package's `net` is one declared expression, the package the client is led with is one declared expression, and the offer card's "Answers three of the five things we heard" is one template. They are judged by a rule, sorted on, summed across a relation and drawn on a card. The partner's card, record page and `get_node` are each worked out without the client's discount and without the client. A cost greater than the cube is refused at check time, and at run time a computed field over 3,000 offers stops within its budget, as a sentence. The `graview-invariant`, `graview-node-kind` and `graview-pages` skills say how. The embed's budgets rise by about 13 kB minified and 5 kB gzipped for it. `capabilities().shipped` names FR-83.
  
  Compatibility: the declaration — additive within `graview-document@1`: `kinds.<kind>.computed` and `defineNode({ computed })` are optional, and no document or declaration that compiled stops compiling or changes meaning; the new check codes (`computed-*`) appear only on a declaration that declares computed fields. The rule language gains `first`, `sort` and `either`, and `sum`/`min`/`max` accept an expression where a field name was required; every expression that parsed before means what it meant. Tool schemas — `get_node`'s description changes for every declaration (it says computed values are read-only) and its answer gains `computed` and `uncomputed` when a kind declares them; no input schema moves. The wire — additive: `capabilities().shipped` gains `FR-83`. Ops and stored formats are unchanged.
- Updated dependencies [39a3983]
- Updated dependencies [7d77ff7]
- Updated dependencies [6b7edf9]
- Updated dependencies [cbe1cc6]
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
  - @graview/tools@0.1.10
  - @graview/layout@0.1.10

## 0.1.9

### Patch Changes

- 4e1d6e3: Every popover opens over everything, and everything else stands on one ladder (FR-76). On a hosted app the profile menu opened under the seat's rail and could not be read: each surface picked its own `z-index` in one stacking context, the profile and the problems 20, the rail 40, the altitude control 5, the zoom 8, a menu 60, the studio 100. Now the transient surfaces — the profile, the problems, the activity, the Find box's suggestions, the districts a row could not hold, a card's acts at the pointer, `ChatPanel`'s pill and the studio's own seat — are shown with `showPopover()` in the browser's top layer, which Playwright's Chromium, WebKit and Firefox all have: drawn over every rail, the scene and anything on a host's page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` their ancestors carry, and still inside the element they opened in, so an embed's scoped theme reaches them and nothing lands on the host. In the top layer a pane is placed by what opened it (`useTopLayer` and `placePane` in `@graview/react`): under it, or over it where there is more room above, kept to the viewport, and no taller than the room it has, so what it holds scrolls inside it. Where `showPopover` is missing the pane stands on the ladder's popover rung. Everything that stays on screen takes a named rung from one ladder written once in `@graview/core` (`LAYERS`, `layer(name)`): scene, overview, rail, popover, dialog, toast, which `themeCss` writes on its root or an embed's box as `--graview-layer-<rung>`. The scene's ground is a stacking context of its own, so what orders its plots, cards, lines, figures and zoom (`SCENE_LAYERS`) can never climb over a rail. `POPOVERS` in `@graview/react` names every popover in the family with what opens it and its pane. A test reads every source file of every package and finds no `z-index` written as a number outside the ladder; `verify-chrome` opens every popover of the registry on the embed's Graview and pages faces and on the Shell, at 1440×900 and 390×844 with the seat open, and finds the pane in the top layer, inside the viewport, and under the browser's own `elementFromPoint` at its middle and at its last row. `capabilities().shipped` names FR-76.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-76`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
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
  - @graview/primitives@0.1.8
  - @graview/react@0.1.8
  - @graview/tools@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/layout@0.1.7
  - @graview/primitives@0.1.7
  - @graview/react@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/primitives@0.1.6
  - @graview/layout@0.1.6
  - @graview/react@0.1.6
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
- Updated dependencies [6ff733b]
- Updated dependencies [76df9ba]
  - @graview/core@0.1.5
  - @graview/primitives@0.1.5
  - @graview/react@0.1.5
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5

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
  - @graview/react@0.1.4
  - @graview/primitives@0.1.4

## 0.1.3

### Patch Changes

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
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- 7f354e0: A log a seat may not fully see is redacted, not gapped. `seenBy` used to leave out the ops that touched what a seat may not see, which left holes in the seq that `OperationLog.from` refuses, so a served store had no log it could send. Those ops now stay in place as withheld ops, `withheld: true`. A withheld op keeps its id, seq, batch, time and `undoes`. Its author is `WITHHELD_AUTHOR` ("Someone") and its intent is `WITHHELD_INTENT` ("A change you cannot see"). The mutation, inverse and batch intent are dropped. Its primitives, reads and writes keep only what the seat sees, so the seat's copy of a record it can see still moves. `redact(ops, sees)`, `withhold`, `touchesUnseen`, `touchedBy` and `isWithheld` do the redaction, and `logSeenBy(store, principal)` and `seesId(store, principal)` read it for one seat.
  
  A log with withheld ops loads, folds and undoes around them. `checkUndo` refuses to take back a withheld op and says only that it was "a change you cannot see". When a withheld op stands in the way, it says "a later change you cannot see depends on it", without its sentence, id or what it read, and offers no batches to bring along. `seenBy(...).canUndo` judges over the redacted log, and `Store.undo` judges a seat with sights that way first, so neither a refusal nor a 409 quotes a change the seat may not see. The activity rail shows a fully withheld batch as "A change you cannot see", with no author, nothing it touched and no undo. A record's page leaves withheld ops out of its history (FR-16).
  
  Compatibility: additive for ops: `Operation.withheld` is a new optional field, an op without it reads as before, and no store makes one for itself. Changed for readers of `seenBy(store, principal).log` and `.batches()` under a policy with `sees`: ops a seat may not see now come back withheld in their place rather than being left out. `checkUndo` now takes any `LogReading` (`all`, `undoneIds`, `epochs`), which an `OperationLog` still is. Stored formats are unchanged.
- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- The pages alone draw the app's views, and a view that throws on a page says so in its own place. `@graview/embed/pages` takes `views(schema, registry)` as `mount` does. Its pages draw from the same registry: the framework's defaults, the declaration's view specs, then the host's own (FR-35 on the pages-only entry). The pages face of `mount` gets the registry, the app's settings and presence through the same `PagesContent`. `mount` takes `heading` (FR-25) beside the frame options. On the pages, a lens or a kind's own group view that throws draws behind a `ViewBoundary`, as it does in the scene. The rest of the page keeps working, and the host's `onError` hears of it (FR-24).
  
  The pages-only bundle's budget is raised from 765 kB to 815 kB minified, and from 205 kB to 220 kB gzipped. The growth is the default views and view specs the pages now draw from: about 48 kB minified and 15.5 kB gzipped.
  
  Compatibility: additive — `views` moves from `EmbedOptions` to `FrameOptions`, so both entries take it. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
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
  - @graview/tools@0.1.2
  - @graview/react@0.1.2
  - @graview/layout@0.1.2

## 0.1.1

### Patch Changes

- e1b9f5c: A form asks in the record's words. An argument that fills a field of the kind its act makes or acts on is labelled as that field ("VIN", "Body style"), its choices are said as the record says them ("SUV", "Plug-in hybrid"), and an argument called `label` is asked for as a "Name" — on the routed face's forms and in the scene's ask alike (`argumentWords`). A refused argument is said field by field in the same words — "Not yet: Email — invalid email address." — rather than as `Invalid arguments for mutation "sign-up" email: …` (`failureWords`, `InvalidArguments`). The watch is told a declaration's choice values, and the key's own words wherever the declaration has others.
- 097d684: A count of one says the kind's noun: "1 car", "1 test drive", where a place card, Find, a district's name, a band of a district and a coverage's gaps said "1 vehicle" and "1 test-drive". One function says it now (`counted`).
- 866d437: A list page's rows keep to the page and let a long unbroken value break: the list of shoppers, each with an email, scrolled sideways on a phone at a reader's 200%.
- a1859c5: A form sends a list nobody added to as an empty list (`formArgs`). "Put a car on sale" with no features listed was refused on press, "Features — expected array, received undefined", for a car the declaration allows.
- fa8bd61: A list page's "Related:" names each relation in its own words from that end — "The test drives booked in it", linked to the test drives — rather than the edge's name ("Drives Test drives"), and a list of one says the kind's noun ("1 car"). The watch is told an edge's spoken name wherever the edge has words of its own.
- d76a957: A policy says who may see what, as well as who may do it. `Policy.sees` keeps a kind to the roles a sight names — with `own`, to the principal's own record and what an edge joins to it — and a kind no sight names stays everybody's. `store.seenBy(principal)` is the store as that principal may see it: its graph, log, history and problems hold only what they may see, and every act still goes to the store itself; with no `sees` it is the store, unchanged. The scene's provider and the routed face hand every surface that view, a kind a seat sees none of and may not begin is kept from it like an administered module, and the way in leaves it out. `graview check` refuses a sight naming an undeclared kind (`sight-unknown-kind`). A watching harness is told what the seat may not see (`tellTheWatchWhatIsUnseen`, `useTheWatchKnowsWhatIsUnseen`).
- f1cf758: The map of the kinds marks each relation's name as said on purpose (`data-graview-speaks-ids`) — it names the declaration's relations, and their words follow — and the watch no longer counts a choice value's spoken form ("Mon") as a key's words, which a calendar prints as an ordinary weekday.
- 313eea3: Two kinds that name a picture alike each have their own page: "The timetable" over talks and over workshops are no longer one address and one key, so the workshops' timetable is reachable on the routed face and React is not handed two children called the same. A shared name says whose with `?of=<plural>`; `pathOfPlace` gives an app's own page the right link.
- Updated dependencies [bf36bbe]
- Updated dependencies [ed02370]
- Updated dependencies [e0c8cac]
- Updated dependencies [e1b9f5c]
- Updated dependencies [cbdd94a]
- Updated dependencies [097d684]
- Updated dependencies [e88f729]
- Updated dependencies [a1859c5]
- Updated dependencies [1df48c8]
- Updated dependencies [ccfe1cd]
- Updated dependencies [c307981]
- Updated dependencies [fa8bd61]
- Updated dependencies [32ea5ac]
- Updated dependencies [d76a957]
- Updated dependencies [c222b58]
- Updated dependencies [deb98ca]
- Updated dependencies [b535cb2]
- Updated dependencies [6b297f0]
- Updated dependencies [414ddde]
- Updated dependencies [a575ca9]
- Updated dependencies [3c0d822]
- Updated dependencies [f1cf758]
- Updated dependencies [b9cdc16]
- Updated dependencies [6966a4e]
- Updated dependencies [0b78acc]
  - @graview/react@0.1.1
  - @graview/primitives@0.1.1
  - @graview/core@0.1.1
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

- 400a6df: A fact on a chip says what it is. `readableFields` gives every field an `alone` reading — a word as itself, a number with its label ("Track 8", "Length 4:27"), a yes/no as "Explicit: yes" — and the default summary card, the pages' gallery and the list lines all use it. A song's card used to read "8 · 4:27 · Yes".
- dfbba3f: A figure is handed to the DOM once, and it fits the card it is drawn on.
  
  React 19 decides whether to re-apply `dangerouslySetInnerHTML` by comparing the prop object to the last one by identity, so the inline `{{ __html: art }}` every call site wrote tore the art out and parsed it again on every render — thirty-four times for a single click on the ground. The wasted parsing was the smaller half: a double-click only pairs if both clicks land on the same node, and the re-render the first click caused had already replaced it, so double-clicking a district on its figure selected the card and went nowhere while double-clicking the same card an inch to the left travelled into it. A new `useMarkup` hook holds the object still, and the brand's logo goes through it too.
  
  The figure also moves from its own row to the name's line. On the ground a district card is a glyph — seventy pixels holding a name, a count, a trouble mark and a control — and a drawing above the name pushed the content past the card's own edge on every card in the strip, clipped rather than visibly broken, which is why only a measurement caught it.
- 8bdbe72: A form asks the question the act left open. `DerivedForm`'s node picker listed every node of the kind, ignoring the candidates the affordance had already narrowed — so a record's own "depends on" offered the record itself, and an act that hands something on offered whoever already had it. The derived record page now passes `affordance.open` through; a form with no act behind it (a rule's repair, a list page's creating act) still offers every node of the kind, which is the honest answer there.
- 3f86b09: A glance does not say its heading again, word by word. A card's summary and a list line dropped a value only when it was the whole heading, so a vehicle headed "2027 Subaru Forester Sport" — its label built from its year, make and model — spent two of its three facts on "Year 2027" and "Subaru" and never reached the price. `readableFields(..., { glance: true })` drops a value the heading carries as whole words; a record's full facts keep every field, because that is where each one is changed.
- 1ebfd44: A kind has a figure. `defineNode(kind, { figure })` takes inline SVG — one `viewBox`, `currentColor` strokes, no fill — or the name of one from a small shipped set (person, plot, box, task, shift, list, vehicle, rule, note), and a brand may override any kind's. One `<KindFigure>` draws it everywhere a kind is drawn: the kind card at altitude, the district beside its plural, the routed face's rails and record eyebrows. A kind without one is drawn exactly as before; nothing about a figure is required.
  
  `graview check` refuses a figure that cannot be drawn — no `viewBox` (nothing can size it), a literal colour (invisible in one of the two schemes), nothing stroked with `currentColor` (it will not take the kind's ink), or a name nothing ships — and refuses a brand drawing for a kind the app does not declare. `drawFigure` in `@graview/tools` asks a model for one in the house style and judges the answer with the same function, so a drawing that would fail the build never reaches a person as a proposal; a model that throws or draws badly falls back to the nearest shipped figure BY NAME and says so, because guessing that a cleat is a box would be the framework having an opinion about a domain it has never met. `graview figure <entry> --kind <k>` prints the line to paste.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- c3879ba: A picker on the routed face is never wider than its field. A select is as wide as its longest option, and a form's picker over a real inventory — "Open a deal", over 320 vehicles named like "2027 Mercedes-Benz GLE AMG 53 4MATIC+ Coupe" — was 618 pixels on a 390-pixel phone, so the place page scrolled sideways. The form's controls shrink to their track and cut an option inside the box.
- cc3ddbc: `rankedRepairs` is exported, so a design can order a rule's repairs by the same derivation the strip reads rather than by the order the rule listed them.
- 190c4a8: A record's ties tell two of one name apart, and the scaffold's own record page shows the record. `recordFacts` gives each tie target an `apart` — what tells it from another of the same name in its group — and the derived record page says it beside the link, so a vehicle's two "Check engine light on" appointments are two things. The record page `graview create` writes now lists the record's facts, which it had dropped (a one-kind scaffold has only a name, so the gap was invisible until the kind grew a price), and makes each tie a link rather than a comma-joined line of names.
- 63ba472: A relation is captioned from the end you are standing on. A record page's connections section put the edge kind over the reading — so an owner's record said "Assigned to" above "What they are seeing to", which is exactly the backwards reading `graview check` warns about, and where a declaration had no words for that direction the two lines were the same string twice. The eyebrow says what is listed now — the far end's kinds, in their own plurals — which is true from either end.
- fadebb9: A repair on the routed face asks for what it left open and nothing else. `DerivedForm` takes `only`, and `Repairs` passes the repair's `missing`, so "Correct when Kerosene came out" asks for the date rather than every field of the edit act (the name first — a date typed there renamed the single). The form submits under the repair's own words and, once answered, gives the keyboard back to the repair's button or to the page's heading.
- f801b4d: A repair is an act, and a seat may not be able to take it. Both repair surfaces rendered a rule's repairs straight from the violation, without asking the store whether this principal may run them — so a narrower seat was handed a live button and met the refusal on submit, while the actions strip beside it had already struck the same act through. `Repairs` takes the principal now and withholds what it must, with the policy's own sentence.
- 8e872b5: A repair with a blank in it is an ask. The problems page and the record page rendered every repair a rule named as a bare button applying the violation's own arguments, so a repair declaring `missing: ["owner"]` threw "expected string, received undefined" into the console and told the person nothing. Both surfaces — and the scaffolder's record-page template — now use one exported `Repairs` component: one press when the repair needs nothing, the derived form when it still has something to choose, and a refusal said where the press happened.
- c3033f4: The search page fits a phone at twice the text. Each group of hits is a grid track the width it was given and a hit's name may break: two records of one name told apart by a seventeen-character VIN made a hit 503 pixels wide at a reader's 200% on a 390 phone, and the page scrolled sideways.
- 2cc27e9: Another seat's work is named by the seat's name. `nameOfAuthor(author, { graph, schema, seats })` reads the user node, else the seat the principal was offered under, else the id; the activity rail, the profile, and the routed face's history use it, and `PageContext` carries `seats` (the embed hands its own over). An app with seats and no installation read "user-lena" and "U user-june".
- 490eccd: A design's shell registers without a cast. `surface("shell", Shell)` takes a `ShellComponent<S>` — `{ context, children }`, as the pages skill describes it — rather than a page's type, which has no children and made every design write `Shell as PageComponent<S>`.
- e809183: An embed's stop may name a place. `#view=the-season` is the link a page can write — `placeHref` spells it — and the scene's URL sync has resolved it to the group the place is a picture of since it existed; the embed read its `stop` through `fromUrl` alone, so a host page saying `data-stop="#view=the-season"` landed at the default view with the place's pill unpressed. The embed resolves it now, on mount and when the stop changes through the handle.
  
  A board in a room with no height of its own is sized by its width. The board lens drove its size from the measured height of the room it stood in, which a scene band and a page region have; in a chapter embed on the docs site the panel sits in a column as tall as its content, so the room measured four pixels, the board came out six by four, and every slot on it was a four-pixel target. Below a height a board could be read at, it takes the room's width and lets its aspect give the height, which is what a board in a document is.
  
  The embed has a fourth face, `picture`: one named lens and nothing else — the place the stop names, drawn at full size over the kind's current members, with no bar, no rail and no standing. A page that is about a lens shows the lens, not an app with the lens somewhere inside it; three of those stacked on the docs site's lenses section were three windows with a calendar somewhere in each. `PlacePicture` in `@graview/pages` is the component behind it, for an app's own page that wants the same.
  
  The calendar's day grid and agenda list are keyboard stops. Given less height than their rows they scroll inside themselves, and a region that scrolls with no focusable element in it is one a keyboard cannot scroll at all; each carries the span's own name.
- b9b0635: A time of day is asked for. An argument whose pattern is a date with a time in it (`YYYY-MM-DDTHH:MM`, the gauntlet's workshop start and a talk's slot) described itself as a plain date, so every face offered a date picker, the picker gave `2026-09-20`, and the act's own pattern refused it: no workshop could be made and no talk given a slot, on either face, at either width, with either hand. The date shape and its form field now carry `time: true` for such a pattern; the routed form, the scene's ask, the edit in place and the studio's agent panel ask with a date-and-time control, and the conversation and the starter fill one with a time of day.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- f4dbcc8: Every key typed into the pages' Find box arrives. The box wrote each keystroke to the address and took the address back, and an address that caught up after the next key was taken for a change and written over the box — typed at full speed, "pay the deposit now" became "pyte depoi now", and on a slow runner "digital" was searched as "dgtl". Words the box handed to the address are its own echo; it follows the address only when something else changed it.
- 7a61e87: A condition that names a retired state asks for the past. `status:demo`, where demos are behind the horizon, found nothing in the Find box and listed nothing on the list page, while telling the reader to add `is:any`. `asksForThePast(definition, conditions)` says when a condition names one of the lifecycle's retired values, and both `search` and the list page widen that kind's horizon for it.
- 0c465b9: A record does not offer to sort and filter a relation that holds one thing by declaration. A deal's record read "Sort and filter who is buying →" under its one buyer, and a vehicle's "Sort and filter the lot it is parked on →" under its one lot — a link to a list that can only ever hold the name above it. An edge declared `cardinality: "one"` offers the pile only from its far end, where it may be many.
- a9381af: One control row arranges every surface. `ArrangeBar` in `@graview/primitives` draws Sort by (with a direction), Group by (with a bucket for a date), the conditions as chips with one grouped select to add another, and the words a person types — all from `arrangeable()`, so it offers only what the kind's declaration offers, in the declaration's words; a surface hands the current arrangement in and takes the next one back, and declines a part with `allow`. `arrangementOf(view)` and `withArrangement(view, next)` carry it in a stop as `in.sort`, `in.filter`, `in.group` and `in.q`. The arrangement grammar gains `q`: words a node's label or any scalar field must contain, the same matcher a search would use (`matches`).
  
  The pages list page arranges through the shared module under the shared keys — `?sort=due:desc`, `?filter=done:false,holds:today`, `?group=due:month`, `?q=tape` — and keeps every link it used to write: `?by=<edge>` groups, `?<edge>=<id>` and `?with=<edge>` narrow, `?past=1` widens the horizon. A stale link that asks for something the kind cannot be arranged by is told so and shown the rest. The kind's default picture in the scene draws the same row at full fidelity and groups its members when asked, with the choice in the fragment so an arranged district is a link and Back restores it.
- 3815bcf: Relationships are structure on the routed face. `kindMap(store)` derives every declared relation between the kinds with its own words and its live count, and the face draws it as "How it fits together" on the home page and at `/map`, each line with the same mark the scene's key draws (`RelationMark`, now exported from primitives and usable without a scene), each count opening the far kind's list narrowed to the ones that have the relation. A kind's page says what it relates to, groups by a relation from the address (`?by=<edge>`) and narrows by one (`?<edge>=<id>`, `?with=<edge>`), so a list you arranged is a link you can send. A record links the other way round — the far kind's list narrowed to itself — and says which pictures it is seen in, each a page and a stop in the scene.
- 216ba97: The assistant is on every page, and it is the same one. A routed face that grew a chat box of its own would be two assistants with two habits over one graph, so the pages face opens the scene's companion: one control in the corner, a drawer beside the reading column, the same subject header, acts, relations and conversation. The route is what "this" means — a record page is about that record, a kind's page about that kind, a picture about the kind it is a picture of — set as the provider's selection, so a question means the same thing on both faces. Grounded questions are offered before anybody types (`offer` on `ChatPanel`, also in the scene's rail), answered by the graph's own responder with no model at all. A proposal applies through the same runtime, attributed to chat and undoable, and one the policy withholds is struck through with its own sentence. The seat's open questions are listed on the problems page, which is the face's inbox, and the intelligence rung is chosen from the footer. The control is mounted by the router rather than the default shell, so an app that replaced every surface with a design of its own still has the assistant.
- 6e0fbb7: A form opened for an act offered from the far end of a tie submits under the words its heading uses. `DerivedForm` takes `label`, and the derived record page, the places page and the record page `graview create` writes hand it the affordance's label — a song's page headed "Place it in an era" had a button saying "Put it in the era", the era's side of the act.
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
- e30d22f: The pages face is nine files, cut where its own section banners cut it — the context, the typography, the shell, the map, the places, the home, the list, the record, the problems — with `pages.tsx` saying what they are and re-exporting them; the page frame (`PageMain`) lives with the shell rather than with the problems page it happened to be written beside. Nothing it exports changed.
- fc7103b: The pages face lands on a gallery. The derived home read as a readme: the brand's name repeated under the masthead, a sentence of counts, the relations in full, a section per kind with its description and four members — and the app's own pictures as two 288-pixel cards a third of the way down a 760-pixel column, the smallest thing on the page. Now the standing is the headline ("2 gardeners, 3 plots and 1 planting.", or "Nothing here yet." and which act begins it) and the pictures come next, large and live: every titled lens as a card the width of half a desk or a whole phone, drawn by the lens itself at a scale measured from the card, inert, captioned with its name and how much it is over. The kinds follow as one row of counts, the relations as one line that opens `/map`, and Recently stays short at the foot.
  
  Every kind is a picture by default. `registerDefaultViews` titles nothing, so a new app had no places and no pictures on its pages at all. A live kind with no titled lens now gets a card of its own — a group view the app wrote is drawn as it is; the framework's own is replaced by a contact sheet of the members at summary fidelity, the same card the scene stands in the district — titled by its plural and opening its list. Titling a lens replaces the kind's card rather than adding to it. A picture with nothing in it says so and names the act that would begin it, rather than showing a blank frame. Given no view registry the face still lands on the gallery, each kind a card of its members' names.
  
  The shell is one row — the pictures (home), the kinds, Map, Problems — and scrolls sideways on a phone rather than wrapping to three rows; the shell and the gallery take a 1160px column while the pages that are read keep their 760. A picture's page carries its sibling pictures as a strip, and `/places` is the same gallery at its own address. `Gallery`, `GalleryCard` and `galleryOf` are exported for a design that wants the cards on a page of its own.
  
  `graview create` hands `PagesApp` the app's views and settings in the `main.tsx` it writes, so a new project's pages face has its pictures, its map and its assistant without anyone editing the file. The `graview-pages` skill says what now comes for free; `verify-pages` measures the gallery on the framework's default face — two across at a desk, one on a phone, every frame with something drawn in it, the nav one row — rather than asserting it.
  
  A new page opens at its top. The router kept the document where it was, so a card pressed at the foot of the gallery opened the picture's page already scrolled to its own foot; the readme-shaped home was short enough to hide it. The face now resets on every new address — not on Back, which the browser restores itself, and not on a change of search alone, which is the page you are on — scrolling whatever holds it: the window, or the nearest ancestor that scrolls when the face is inside an embed's frame.
- 591a15a: The app's pictures are pages. Given the view registry in its context (`views`, with `settings` and `presence` where the app has them), the routed face puts the scene's provider under its routes and every named lens becomes a page: an index at `/places` draws each lens small and live, inert, with its name and what it is a picture of; each lens at `/places/<as>` is drawn full width in fullscreen mode over the kind's current members, with the acts that begin the kind beneath it and the way to the same picture in the scene; a pick inside it travels to the record. The home leads with the pictures, a kind's page lists its own by name, and the shell's nav mirrors the scene's bar — pictures, then kinds, then Problems. Without views the face is the derived site it always was. `placePath(as)` gives a place's routed address.
- d22655e: An act answered on a record gives the keyboard back to the act. The derived record page opens an act's form in place and closes it once the act is applied, which took the keyboard to `<body>`; it now returns to the button that opened the form, or, when the act is no longer offered, to the "What can be done" heading.
- a38a5af: The routed face offers Find and the way back, whichever shell draws it. Taking the last change back could not be done on the pages of any app — nothing on a page offered it — and rota's pages had no Find box, because only the derived shell drew one and every design replaces the shell. The face's root now owns both: a shell that places `<PageFind>` or the new `<PageUndo>` says where they go, a shell that places neither gets Find in a bar above it and the way back docked at the corner, and only `surface("shell", Shell, { without: ["find" | "undo"] })` goes without. The way back says what it takes back ("Take back “Rename to …”"), takes back the person's own latest change as that person — never one the policy would refuse — answers ⌘Z and Ctrl+Z anywhere on the face but inside a text field, where they stay the field's own, and lands the keyboard on the page's heading when there is nothing left to take back.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- 1eedcff: A record's link to the far kind's list says what it lists in this end's words — "Sort and filter the songs on it" — instead of the edge's name read as a verb, which gave "All artists by Blue Hour" and "All songs tracks Blue Hour" on an album's page.
- ccaa5f4: Search reaches the pages face and the conversation. `/search?q=` lists what the words find grouped by kind, each hit with its why and each kind's heading a link to its list with the words carried; words that find nothing say what was searched ("current ones; add is:any for past ones") and offer the beginnings the seat may run, "A task called “zzz”", with the words already in the name (`beginningsFor`, `SearchToCreate`, and `DerivedForm`'s new `initial` — starting values that stay editable). The derived shell's nav carries the box, `PageFind`: on a kind's list it narrows that list, elsewhere it goes to `/search`, typing replaces rather than pushes; an app's own shell can use it, with `narrowsLists: false` when its lists have a box of their own. The list page reads its words with the shared matcher — `key:value` tokens and `is:any` included — shows why a row is there when it was not the name, and under the derived shell drops the row's second box. `/search` is a derived route an app's own `route()` is warned off. A message the conversation reads as no act and no fact, whose words find records, is answered with them as `picks`, each a press in the chat that goes there. The activity rail shows the records a read looked at, so an agent's `search_graph` says what it found.
- 95196d7: Two records of one name are told apart wherever a person picks one. `tellApart(nodes, definitionOf)` gives each namesake the first fact that differs — "Blue Hour · single", "Blue Hour · album" — and the pages form's pickers, the strip's ask, the Find strip, the search page (through a node hit's new `apart`) and an arrangement's group headings all say it. A single and its album were two identical rows.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 5b401bb: What the review of search found. A boolean field is a state, asked for as a condition (`done:false`), not a word: it read as "No", so "n" found every open task in the Find box, a list's `?q=` and the chat — `searchableFields`, `describe` and `llms.txt` no longer list booleans. The picture lights every match from the result's new `matched` list rather than the strip's capped hits. A list's `q` made only of tokens nothing offers (a pasted `https://…`) finds nothing, as the Find box does, and a lone `is:flagged`, `is:clear` or `is:past` narrows in both. `actsOn(store, id, words)` lists a record's acts without a search of the graph; `search()` takes `touched`, and the scene works out what is flagged and touched once per graph change, not per keystroke; a list parses its words once rather than once per row. A lit district's count, Enter on a kind hit and a double-click are one transition — `withJackIn(…, { carry })` — which comes down to the ground, close and narrowed. The row's words (`in.q`) no longer follow you to the next focus, and `withoutSearch` clears the search with the words it carried. A pick in the pages face's Ask drawer goes to the record's page (`onPick` on `ChatPanel` and `Companion`), and the list page reuses the affordances it already has for search-to-create.
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
- Updated dependencies [fb5b3ad]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [ccc912a]
- Updated dependencies [7c0e701]
- Updated dependencies [73e3b86]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [69aed60]
- Updated dependencies [d042ff2]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [708871a]
- Updated dependencies [c5e4ac7]
- Updated dependencies [42c2c96]
- Updated dependencies [9a3fe4b]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [a5d4967]
- Updated dependencies [97067b6]
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
- Updated dependencies [796bf9e]
- Updated dependencies [a6f64b0]
- Updated dependencies [d907771]
- Updated dependencies [0bb6827]
- Updated dependencies [b5e95a1]
- Updated dependencies [894f0f1]
- Updated dependencies [130e9c6]
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
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [d9bfdb8]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
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
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [8dbae9a]
- Updated dependencies [7840cd5]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [0a6a3fe]
- Updated dependencies [a0ffc2f]
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
- Updated dependencies [f8f0e29]
- Updated dependencies [3506c69]
- Updated dependencies [daccd55]
- Updated dependencies [be9fb19]
- Updated dependencies [e7151d4]
- Updated dependencies [ce13ec8]
- Updated dependencies [e7735c1]
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
  - @graview/tools@0.1.0

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
- 329da2e: The pages face reads like a product's own site, not a back office. The
  default shell, home, list, record and problems pages open with the thing
  itself — the installation's name and mark on a masthead, a front page that
  summarises what is here in the app's own declared words, lists whose
  members carry a line of their own facts, records titled in the display
  face with the kind's own description as the lede, relations captioned by
  the edge's declared words (an inbound edge by its `inverse`), and actions,
  forms and history receding beneath the content. Typography rides the
  brand's display and body faces at a real scale in both schemes; a kind's
  accent marks it on every page. `hueFor` — the hue thread every surface
  reads — now lives in `@graview/core` beside the brand that overrides it,
  re-exported by `@graview/render` unchanged. Every testid, route and
  parity derivation is as before.
- Updated dependencies [ec91236]
- Updated dependencies [37bb6af]
- Updated dependencies [e38fe86]
- Updated dependencies [964d140]
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
