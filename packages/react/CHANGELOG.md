# @graview/react

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
  - @graview/tools@0.1.15
  - @graview/layout@0.1.15
  - @graview/render@0.1.15

## 0.1.14

### Patch Changes

- fc42f1e: A coverage cell over a path selects what it joins (FR-111). A filled cell wore only its column's id, so on a Strengths lens that crosses people with skills through a `strength` record, choosing Ryan × SEO selected SEO, and its line ran to the collapsed strengths' district — a stand-in for records the picture does not draw. A filled cell now says what it joins (`data-graview-joins`: its row, its column and the records on the path, `["p-ryan","sk-seo","st-ryan-seo"]`), and choosing it selects exactly those: on the Graview face the scene's selection is the three (`onPick` carries the joins; shift or ⌘ adds them), and on the routed face's `/places/<as>` the picture stays where it is, lit with its row and its column, instead of going to the column's page — the row's and the column's names still go to their pages. The lens draws the crossing's own lines, from the cell to the row's name and to the column's head, ending on each, inside the picture so they scroll with it; a stacked grid on a phone names the column inside the cell, so there the line is the row's. A record on the path gets a line only where it is drawn as itself, and nothing is drawn to a district: the scene's selection lines give way to a chosen crossing, and draw from the cell only to a joined record that has a card of its own on the stage. `verify-declared` chooses Ryan × SEO on both faces at 1440×900 and 390×844 and asks that each line ends on what it names and that no line goes to a district.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. A filled coverage cell keeps `data-graview-pick` (the column's id) and gains `data-graview-joins`; a host or test that read the scene's selection after a cell press reads the row, the column and the joining records where it read the column. The routed face's place page no longer navigates on a cell press. `capabilities().shipped` gains `FR-111`.
- 0cee289: A page opened on a stop whose record is gone lands where the app opens, instead of re-rendering for ever. The stop an app is opened on is its home, and a focus on a record that is no longer there falls back to the home. When the opening stop itself named the record, the fallback put the dead id straight back, the next render took it out again, and the scene never settled. That happened to an embed handed `#focus=<id>` for a record since removed, to an embed opened at an address (FR-106) whose fragment names a record that is gone or that the seat may not see, and to any of them when an act removed the record it opened on. React gave up with "Maximum update depth exceeded", the face's boundary drew it again, and the tab hung. A home that names something gone now gives way to where the declaration opens, or to altitude when it names nowhere.
  
  Compatibility: unchanged for ops, stored formats, the wire, the declaration and check finding codes, and tool schemas. A provider whose opening stop names a gone record now opens where the declaration opens.
- 3f02759: The room under a district's signpost is sized from its place names as the brand's face draws them (FR-118). The marquee's height was estimated from the letter count at an average letter's width, so a brand whose body is a wide display face wrapped names onto lines the city had not made room for, and the column ran past its district into the one below. The scene now measures each name with `measureText` in the face it reads off its own element (an embed scopes its brand to itself), at the marquee's size and its heavier weight, again once the brand's fonts have loaded, and wraps it word by word as the browser does; the layout sizes the band from that and hands the district the same room, and never under the estimate. Where nothing can measure — Node, jsdom — the estimate is the answer, as before.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. `LayoutOptions` takes an optional `nameWidth`, `marqueeHeightFor` an optional third argument (a `NameWidth`, exported from `@graview/layout` and `@graview/layout/view`), and `@graview/react` (and `@graview/react/drawing`) exports `useMarqueeRoom`, the room the scene reserved for a marquee of given names. A marquee in a wide face may come out taller than it did.
- 8c43964: A pill means "press this to choose", or a state (FR-117). Building En Dash Org on Graview Cloud ended in one verdict: "too many pills, and too much cut-off text, on every face". When everything is a capsule, nothing reads as the thing to press, and a state badge, the one pill that earns its place, no longer stood out. Now one rule holds on every face. A capsule is a choice the reader can make, or a record's state badge, and nothing else is one. In a set of choices (the face switch, a calendar's range, the "Answers come from" setting, the embed's seats), the one chosen wears the capsule and the others are words to press. The places are text tabs that scroll, with the current one underlined, on a desk and on a phone alike. They are tabs rather than a menu because the places are the app's own navigation, read at a glance: a menu hides every name behind a press, and tabs keep every name whole and on screen. The tabs scroll sideways, a mouse wheel included, and the edge with more beyond it fades. The place you are on is scrolled into view, and each tab is a button the keyboard reaches. The "+N more" select and the phone's single select are gone. A district's name in the scene is text on its plot, haloed in the ground's colour, and its trouble bar is the name's baseline. The open control beside it is a quiet chevron. The scene's "Up" / "Down to …", the zoom control, the seat's suggestions and a calendar's previous, today and next are quiet buttons or links. A record is a card. A chip, a coverage cell's label, a relation's sign on a line and a kind's link on the routed home have a card's corners. A place page's other pictures are links. A kind's mark is its plot in miniature, a small iso tile in the kind's hue, rather than a round dot. A badge is not drawn where its context already says it. No card on a status board wears its own column's status, and a row under a grouped list's heading does not repeat that heading's value. The same goes for a field block of the board's own field. Other badges and blocks are drawn as before. A new harness, `pnpm verify quiet`, mounts the embed over the org app and Cloud's vendor template, as Cloud mounts it. It counts pills by Cloud's own definition: a visible element under 34 px tall, with a corner radius of at least half its height and a fill or a border. It runs in Chromium, WebKit and Firefox at 390×844 and 1280×800, in both schemes. The org app's desk Graview face goes from 39 pills to 4, and the vendor template's phone Pages home from 34 to 7. On the vendor template's desk Graview face it is 20 to 4, and on the org app's phone "Skills and levels" 12 to 7. No board card wears its own column's status, where four did. Cloud's hosted page loads 580 402 bytes up front (567 KB), where it loaded 580 510, so the design pass is 108 bytes smaller up front. The embed without the studio is 696 582 / 178 525 bytes first, where it was 696 428 / 178 422, and its gzipped budget is now 178 600.
  
  Compatibility: `Places` renders `nav[data-testid="places"]` holding `button.graview-place-tab[data-testid="place-<as>"]` (with `aria-pressed`) at every width. The `places-more` select and the compact `select[data-testid="places"]` are gone, and `compact` now puts the tabs on a row of their own. At altitude, `.graview-kind-face` has no capsule: no background, border or radius, and `[data-graview-tally]` is drawn at its foot. `.graview-kind-open`, `.graview-zoom`, `.graview-zoom-button`, `.graview-altitude-control` and `.graview-kind-tag` are no longer capsules. `Chip` has a 6 px radius. A kind's mark with no figure (`[data-graview-figure-kind="dot"]`) is a clipped iso tile, no longer a circle. The columns lens and a grouped list tell the cards they draw which value their heading already says; there is nothing new to import. `capabilities().shipped` gains `FR-113`, `FR-117` and `FR-118`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 63dfe90: Changing the seat is not going somewhere. A page focused on a record the new seat may not see has its stop resolved to where the app opens, and under `UrlSync` (the whole-page Shell's `syncUrl`, an embed handed the address bar) that resolution was pushed as a new history entry — so Back landed on the record's address, which the seat cannot see, which fell back again: a step that went nowhere. A change of principal now replaces the entry it resolves, and travel made afterwards still pushes. Under memory routing nothing is written, as before.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. A seat change no longer adds a history entry.
- 05b0a95: A hosted page has room again: Cloud's hosted page loads 555.0 KB up front, where this round's features had brought it to 570.0 KB, and its budget comes down from 572 KB to 563 KB. Graview Cloud holds its shell to 595 KB with about 25 KB of its own, so the framework's page has to stay near 565 KB for Cloud to have any room; Cloud's shell built from these sources measures 554 KB, where it measured 569. Nothing a reader sees changed. A bundler gives a whole file to a page's first chunk when the first chunk can reach it and any chunk uses it, and the frame of every face reached, through the entries it imports up front, files that only a drawn view uses. Those now have entries of their own, fetched with the face that draws them. `@graview/react/drawing` holds the measured text, the kit's connector, the boundary a view draws inside, the sets a view lights and dims by, the fields edited in place, the others placed on a picture and the attention a seat pipes in (React 6.1 KB smaller up front, and `@graview/render` no longer up front at all). `@graview/tools/edit` holds the fields a record lets a reader change, and the reader's pins left `@graview/tools/frame` (tools 1.7 KB). A label's fit left `@graview/layout/view`, which keeps only the estimate of a line's width (layout 1.6 KB). The arranging of a list is `@graview/core/arrange`'s (core 4.0 KB). And the assistant fetches the describer when a place is first asked about, not with its seat, so the pages face alone loads 475.8 KB first, where it loaded 488.7. The bundle budgets come down where they shrank: the pages face alone to 488 000 / 166 000 bytes, the embed without the studio to 682 500 / 173 500, and the embed with the studio handed in to 1 472 000 / 436 500.
  
  Compatibility: the arrangement's functions moved from `@graview/core` to `@graview/core/arrange`: `arrange`, `arrangeable`, `arrangeAllows`, `admitArrangement`, `asksForThePast`, `bucketStart`, `conditionHolds`, `edgesOf`, `formatArrangement`, `matches`, `NO_ARRANGEMENT` and `parseArrangement`. Their types stay on `@graview/core`. `useActivity`, `useAttention`, `useDrawnSize`, `useTextMeasure`, `useEditableFields`, `useFlagged`, `useImplicated`, `useReached`, `NOTHING_FOUND`, `useKit`, `kitConnector`, `ViewBoundary`, `anchorOf`, `placeOthers` and `AUDIENCE_ROW` moved from `@graview/react/provider` to `@graview/react/drawing`, and all of them are still on `@graview/react`. `editableFields`, `loadPins`, `savePins`, `togglePin` and `NO_PINS` are no longer on `@graview/tools/frame`: `editableFields` is on `@graview/tools/edit`, and all of them are still on `@graview/tools`. `fitLabel`, `areaOf`, `boxOf`, `centroidOf`, `overlaps` and `spanAt` are no longer on `@graview/layout/view` and are still on `@graview/layout`. `@graview/core/arrange`, `@graview/react/drawing` and `@graview/tools/edit` are new entries, and a linked project's vite config aliases each of them. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [f842422]
- Updated dependencies [fc42f1e]
- Updated dependencies [860223c]
- Updated dependencies [1e7eba5]
- Updated dependencies [3f02759]
- Updated dependencies [5a236ea]
- Updated dependencies [cc50785]
- Updated dependencies [45842b7]
- Updated dependencies [8c43964]
- Updated dependencies [b8c4527]
- Updated dependencies [ab91f13]
- Updated dependencies [b9435aa]
- Updated dependencies [05b0a95]
- Updated dependencies [6ac06de]
- Updated dependencies [bd69456]
  - @graview/core@0.1.14
  - @graview/layout@0.1.14
  - @graview/tools@0.1.14
  - @graview/render@0.1.14

## 0.1.13

### Patch Changes

- ed5444b: A host whose page is the app can give the routed face the address bar (FR-106). The embed's routed face ran on a memory router, so in Graview Cloud's hosted app a place could not be linked, reloaded or shared: loading `/places/vendors-by-status` drew the home, and opening the board's tile left the address at `/`. The embed takes `routing: "address"` now, with a `basePath` for a host that serves the app under a path of its own (`/apps/<id>/`; `/` by default). The routed face then reads its route from the address and pushes each page it opens. Places (`/places/<as>`), records (`/<plural>/<id>`) and the home have their own addresses. Back returns to where you were, and a reload stays put. The address also says which face is drawn. A page past the home is the routed face. A fragment at the home is the scene's stop, kept the way the whole-page Shell keeps it: a step is pushed, and moving the furniture replaces. A bare home is the routed face's home, or on arrival the host's `face`. The face toggle pushes the address of the face it goes to, so Back undoes it, and the toggle returns to the page you left. `mount` opens on the face the address names, and `faceAtAddress(options)` says which that is for a host that renders `<Embed>` itself. `routing: "memory"` stays the default for an embed inside somebody else's page, and it never writes `history` or changes `location`. A host that keeps its own history stays on memory routing. `onNavigate(path, how)` tells it each page the routed face opens, and `setPath(path)` on either handle sends the face back to one. `PagesApp` takes the same `onNavigate` and `path`. `addressOf(place, { basePath })` in `@graview/core` spells a place from `placesOf` under the base, exactly as the face's own links do, `pathWithin` reads an address back, and `basePathOf` normalises a base. Trailing slashes are the same base, and encoded slugs stay encoded. A new harness, `pnpm verify address`, holds all of this in Chromium, WebKit and Firefox at a desk and a phone, and it checks that an article's embed makes no history writes. The scene's fragment sync (`UrlSync`, `useUrlSync`, `adjustment`) is now a module of its own, so a page that never syncs the fragment does not load it up front. Cloud's hosted page loads 577 855 bytes up front (564 KB), where it loaded 575 357; the budget stays at 572 KB. The embed without the studio is 694 569 bytes first, where it was 692 174, and its budget is now 695 000 / 177 500. The gzipped budget for every face is now 439 000.
  
  Compatibility: `@graview/react/provider` no longer exports `UrlSync`, `useUrlSync` or `adjustment`; `@graview/react` still exports all three. `capabilities().shipped` gains `FR-106`. Memory routing is the default, so an embed that does not ask for the address bar behaves as before. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/layout@0.1.13
  - @graview/render@0.1.13
  - @graview/tools@0.1.13

## 0.1.12

### Patch Changes

- 4801c44: What only a fetched face, an agent's seat or the checker uses has left `@graview/core`'s main entry and `@graview/core/document` for subpaths named for what they hold, and the hosted page has room again. A hosted page imports both barrels up front. esbuild gives a whole file to every chunk that can reach it, so a name a barrel re-exported rode in the page's first chunk as soon as any lazily loaded face used it, though the page never called it before a reader acted. Measured from esbuild's metafile, three moves were each worth more than 2 KB. The first is `@graview/core/blocks`: a view's blocks resolved against a record, and the computed values they read. It took 8.3 KB off. The second is `@graview/core/check` with `@graview/core/scene`. The checker was reachable from both barrels: `checkApp` from the main entry, and `compileDocument` beside the compiler a page uses. Through it the page reached the city, which only the scene draws. The checked compile and template instantiation are now modules of their own, so the compiler a page uses no longer imports the checker. This took 2.6 KB off. The third is `@graview/core/figures`, the shipped drawings, which took 2.8 KB off. The page now loads 575 357 bytes up front (562 KB), where it loaded 589 079 (575 KB). Cloud's own shell, built from these sources, is 560.3 KB, where it was 573.7. The budget claim is now 572 KB: the new figure with 10 KB of headroom. The embed without the studio now loads 692 174 bytes first, where it loaded 787 572. The studio, fetched only when it is drawn, asked for `checkApp` through `@graview/core`, so the checker and the document compiler it reaches rode in the frame's first chunk. Its budget comes down to 693 500. A test names every moved export and holds it off both barrels, and the hosted page's test holds the modules themselves out of what it loads first. Some levers were measured and left alone because each was under 2 KB: `formFields` and the rest of the act form (1.8 KB), `beginning` (1.7 KB), the JSON Schema helpers (1.3 KB) and `walkKinds` (0.3 KB). zod's JSON Schema writer (20 KB) stays up front. `zod/mini`, which the page needs, re-exports `toJSONSchema`, so no subpath of ours can put it out of the page's reach while the companion's act tools use it.
  
  Compatibility: these exports moved, with no alias left behind. From `@graview/core` to `@graview/core/check`: `checkApp`, `formatFindings`, `describeApp`, `generateAgentsMd`, `generateLlmsTxt`, and the types `CheckResult`, `Finding` (the checker's), `Severity` and `DescribeOptions`. From `@graview/core/document` to `@graview/core/check`: `compileDocument` and `instantiateTemplate`. `compileDocumentWithoutCheck` stays in `@graview/core/document`. From `@graview/core/document` to `@graview/core/blocks`: `compileBlocks`, `fieldSpecsOf`, `isTallBlock`, `resolveBlocks`, `safeHref`, `sayNumber`, `computedNames`, `computedValues`, `withComputed`, and the types `BlockContext`, `ResolvedBlock`, `ResolvedList`, `SpecBlock`, `ComputedRecord`, `ComputedValues` and `PlainComputed`. From `@graview/core` to `@graview/core/scene`: `BLOCK`, `cityExtent`, `cityMap`, `heightOf`, `MAX_SIDE`, `plotsOverlap`, `roadsOf`, `sharedEdges`, `sideFor`, `toIso`, `villageCap`, `villageOf`, `sceneDistricts`, and the types `Building`, `CityHints`, `CityMap`, `Plot`, `Road`, `SceneDistrict` and `SceneDistrictOptions`. From `@graview/core/document` to `@graview/core/scene`: `sceneThumbnail`, and the types `SceneThumbnailOptions` and `ThumbnailSource`. From `@graview/core` to `@graview/core/figures`: `FIGURES`, `FIGURE_NAMES`, `figureBrief`, `figureFaults`, `figureSvg`, and the type `Figure`. `@graview/primitives` still re-exports `compileBlocks`, `safeHref`, `sayNumber` and `SpecBlock`. A project made by `graview create` imports `checkApp` and `compileDocument` from `@graview/core/check`, and a linked one aliases the four new subpaths. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [4801c44]
  - @graview/core@0.1.12
  - @graview/layout@0.1.12
  - @graview/tools@0.1.12
  - @graview/render@0.1.12

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
  - @graview/layout@0.1.11
  - @graview/render@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 6b7edf9: A declared lens draws (FR-79). A document's `lenses` were accepted and drew nothing, and so were a TypeScript app's: a lens drew only because the app's own UI called `createTimelineLens(…)` and registered the result with a title, so a chat that wrote a lens into a document made something nobody would ever see. A `lenses` entry now takes a `title`, an `on` (the kind it stands on, when its bindings do not say) and data-only `options`, and a shipped lens with a title is a place: a pill on the bar, a drive-in from altitude and a page at `/places/<as>`, registered over each kind it stands on at many × full and many × summary. `declaredLenses(app)` in `@graview/core` decides which lenses draw, with which factory options resolved from the bindings, and why the rest do not; `SHIPPED_LENSES` names the six it maps — `timeline`, `calendar`, `coverage`, `board`, `plan`, `reach` — with their roles and the options each takes. `registerDeclaredLenses(registry, app)` in `@graview/primitives` (and `@graview/primitives/frame`) registers each as a door to the shipped factory, fetched when a lens is first drawn (`fetchDeclaredLenses`), and `declaredViews(app)` is the defaults, the view specs and the declared lenses in one registry. The embed calls it for every app it mounts, so a document's lenses draw with no views at all. What a factory needs that cannot be data is derived: a timeline's columns from the values its `column` field takes (or `options.columns`), its axis words from its extent, a calendar's `today` from the reader's own clock unless `options.today` names one. `graview check` says why a titled lens cannot draw, at its path — `lens-cannot-draw`, `lens-option-unknown`, `lens-title-taken`, `lens-not-shipped`, every one a warning — and a shipped lens needs no `requiredRoles` or `binds` of its own (`requiredRolesOf`, `bindsOf`). `plan` joins the shipped names in the checker and in `graview describe`, which now says which declared lenses draw, over what, at which address, and why a titled one does not. `placesOf(app)` lists every place an app has — the home, each lens, each kind — as `{ slug, title, kind, cardinality, address, stop, lens?, hidden?, first? }`, for a host to list. Apps/todo, apps/rota, apps/gauntlet and apps/discography declare their shipped lenses with titles and register none of them by hand. The studio keeps two lenses of one name apart by their titles. `@graview/primitives/scene` is a new subpath (the companion, the inspector, the places bar), which the embed's scene face and the pages' assistant import so that a face which draws no lens does not carry the six factories; `@graview/primitives/pages` also exports `registerDefaultViews` and `registerViewSpecs`. The bundle budgets for every face and for the studio handed in rise to 1_400_000 / 412_000, and what a page without the studio loads first to 203_000 gzipped, said in `scripts/lib/bundle-budget.mjs`, which now measures from the page's own entry rather than the first chunk esbuild lists. A hosted page carries 563 KB up front. Unit tests compile a document declaring one lens of each shipped type and find each drawn by its title on the embed's bar and at its page, `check` and `describe` agreeing with the one list; `verify-declared` does it in a browser. The `graview-lens` skill says to declare a shipped lens rather than register it. `capabilities().shipped` names FR-79.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `title`, `on` and `options` are new optional fields of a `lenses` entry, and `requiredRoles` is optional on `LensDeclaration`. The new codes are warnings, never errors, and a declaration that checked clean before still does; a check's `where` names a titled lens by its title. The wire — `capabilities().shipped` gains `FR-79`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `arrange` and `arrangement`, so a hand-built registry needs neither.
- 77a9fdc: A home view from the closed block set (FR-81). The home was always derived, and a document that wrote `views.home` was refused. A declaration's `home` — a document's `views.home`, a list of blocks — is now the home's body on both faces: on the routed face it replaces the derived home under the shell, its first headline the page's `h1`; on the Graview face it stands as a landing over the picture whenever the scene is at home (nothing focused, nothing chosen), at ground level and from altitude, on the side the companion leaves free, put away by going anywhere or by its own button (`HomeLanding` in `@graview/primitives` and `@graview/primitives/scene`, drawn by `Shell` and the embed's scene face). An empty graph still opens on the way in: the home view yields to the beginning until there is a record to show. Three blocks join the set, and work in a card, a row and a page as well as the home: `headline` (a template), `figure` with an expression (`{ figure: "sum(all('package'), net)", as: "number" | "money" | "percent", currency: "USD", label }`; `{ figure: true }` is still the kind's picture), and `list` (`{ list: expr, sort: key | { by, direction: "asc" | "desc" | "choices" }, limit, group: field | { by, headings }, empty, as: "card" | "row" }`), which draws each record with its own card or row spec and makes it a link — a record's address on the routed face (`SpecLinks`), a pick on the scene. Blocks about no one record may not name a bare field and reach records with `all('kind')`; a list's sort key and group are held to the kinds its source reaches. A lens named `blocks` with a title, an `on` and `options.blocks` is a place drawn from the same blocks, so a chat can write a picture with no code (`SHIPPED_LENSES.blocks`). The registry carries the home view beside the places (`registry.home(view)`, `registry.homeView()`), set by `registerDeclaredLenses` and fetched when first drawn (`fetchHomeView`); `graview describe` says the home is drawn from blocks, and the document diff says when the home's look changes. FR-83's gap closes: a kind's `glance` may name a computed field (the card and the list line work it out over the seat's graph), and a `label` or `describe` may name one worked out from the record alone — one that reads beyond the record is refused, since a label is said with no graph in hand. `packages/core/tests/document/fixtures/lifelogics.gdd.json` rebuilds LifeLogics' front page and its four lenses as data; unit tests draw it, and `verify-declared` draws it on both faces at 1440×900 and 390×844 in both schemes. The `graview-pages`, `graview-node-kind` and `graview-lens` skills say how. The bundle budgets rise with measured numbers in `scripts/lib/bundle-budget.mjs`: an embed without the studio to 815_000 / 215_000 (measured 802_562 / 209_988), every face and the studio handed in to 1_430_000 / 424_000 (measured 1_420_964 / 418_572 and 1_414_220 / 413_619); a hosted page carries 584 KB up front, and a face before it draws at most 840 KB (the scene measured 836_810, from 817_424). `capabilities().shipped` names FR-81.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `views.home` as a list of blocks, the `headline`, `list` and expression `figure` blocks, and the `blocks` lens are new; `views.<kind>` as an object of slots reads as before, so a kind called `home` keeps its views. A titled lens named `blocks` was a warning before and draws now; what its blocks cannot say is a warning at its path, never an error. A `label`, `describe` or `glance` naming a computed field was an error and is now accepted where it can be said. New codes (`list-sort`, `list-group`, `list-limit`, `list-as`, `list-empty`, `view-currency`) are errors only on blocks that could not compile before. The wire — `capabilities().shipped` gains `FR-81`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `home` and `homeView`; `RenderContext` an optional `budget`.
- 03733a0: A road and a connector say which two things they join: each `.graview-road` carries `data-graview-from` and `data-graview-to` with the ids its two plots wear in `data-graview-plot`, and each `path[data-graview-connector]` carries the ids its two ends land on, in the edge's direction. A design that lights the roads touching a district is a selector's work, not a path parsed back to the plot nearest each end.
- 5703a27: A worker view's links stay in the app (FR-93). The kit's `gv-link` could go to any `https:` address a host allowed, and a view written by a chat should be able to send the reader to a record or a place of the app it is drawn in, and nowhere else. The open kit already draws no `href`, so a view's `<a href="https://…">` is text. A view now writes `<a data-record="offer:coaching">` or `<a data-place="the-packages">`, and the host makes that a link: focusable, with the role of a link, and followed by the host when the viewer presses it or presses Enter on it. It goes only to a record the viewer may see or a place the app has. `graview.navigate("offer:coaching")` and `graview.navigate({ place: "the-packages" })` from the view's code are held to the same, and the guest-view protocol gains `navigate` with a `place`. A view's props list the app's named places as `places`, with each one's slug, title and kind, and `mountWorkerView` takes `places` and an `onNavigate` that hears `{ record }` or `{ place }`. A followed link is the view's region's alone: the face around it does not also take it for a press on the card. A press bound to an act is the host's alone in the same way.
  
  Going somewhere means what the face says it means. `@graview/react` gains `useGoTo` and `GoToContext`. On the Graview face, going to a record focuses and chooses it, and going to a place draws it. The routed face provides its own: a record's page, and a place at `/places/<slug>`. `workerView` and `workerHome` use it, so a worker view's links work on both faces with nothing more from the app. The kit's `gv-link` keeps `links.origins`: it is the kit's one deliberate way out, to the origins a host lists, and an open-kit view has no such way.
  
  A unit test draws a view's links into a shadow root and follows them by a press and by Enter. A link to a record Lin may not see, a place the app does not have, an address, and the same asked from code each go nowhere, and the last three are counted dropped. `guest-sandbox --transport=place` adds a second worker view, "What we heard", and makes the package lens's offers links. On the pages face, an offer's link goes to that offer's page, and "See the packages", followed with Enter, goes to the package lens. The view's `<a href="https://…">` is drawn as text with no href and no role. On the Graview face the same link to the place draws it, and an offer's link focuses and chooses the offer. All seventeen claims hold in Chromium, WebKit and Firefox.
  
  Compatibility: the wire — additive: `navigate` may carry a `place` in place of `to`, and `GuestProps` gains an optional `places`. Ops, stored formats, check codes and tool schemas are unchanged.
- 6852b7d: `pages` is a real arrangement (FR-80). A document's `pages` was accepted and never compiled, and an app had no way to say what its home shows first or where it opens. `pages: { order?, hide?, first? }` (`PagesArrangement`) is now typed, compiled onto the app, given back by `toDocument`, and honoured on both faces. `order` names kinds in the order the routed face's gallery and nav and the city at altitude take them (`orderKinds`); kinds it leaves out follow as declared. `hide` takes kinds off the home only — their cards and counts — and a hidden kind keeps its list, its records, its place in the nav and its search results. `first` names where the app opens: a place by its title or address word, a kind by its name or plural, or `"home"` (`openingOf`). The routed face opens there once, replacing the arrival so Back leaves the app, and the masthead still goes home; the scene opens on it when nothing else was asked (`openingView` in `@graview/react`, which the provider and the embed use). The arrangement travels on the view registry beside the places (`registry.arrange(pages)`, `registry.arrangement()`), set by `registerDeclaredLenses` and carried by `layerViews`, so every face that reads the places reads where they go. `graview check` names a kind in `order` or `hide` that is not there and a `first` that is no place, kind or home — `pages-kind-unknown`, `pages-first-unknown`, warnings at their paths — and `graview describe` says where the app opens, the order and what the home leaves off. Removing a kind in the document editor takes it out of `order` and `hide`, and renaming one renames it there. Unit tests compile a document that orders three kinds, hides one and names a lens first, and find it opening on that lens on both faces with the home in that order and the hidden kind reached by link and by search; `verify-declared` holds the same in a browser. The `graview-pages` skill says how. `capabilities().shipped` names FR-80.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `pages` was any object and is now one whose `order`, `hide` and `first` are typed; other keys are still accepted, so a document that compiled before still does. The new codes are warnings. The wire — `capabilities().shipped` gains `FR-80`. Ops, stored formats and tool schemas are unchanged.
- Updated dependencies [6b7edf9]
- Updated dependencies [4ae597b]
- Updated dependencies [f9d5951]
- Updated dependencies [c3e2c1d]
- Updated dependencies [77a9fdc]
- Updated dependencies [6809372]
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
  - @graview/core@0.1.10
  - @graview/tools@0.1.10
  - @graview/layout@0.1.10
  - @graview/render@0.1.10

## 0.1.9

### Patch Changes

- 0ecda3f: A dialog a popover opens takes over from it. The studio opens from a button in the profile menu, and with the profile in the top layer (FR-76) the menu stood over the studio's bar. When the keyboard goes into a dialog the popover does not hold, the popover closes — its pane stays mounted where its owner keeps it so, and the dialog with it — and when that dialog is gone and has left the keyboard nowhere, because its way back was a control in the closed pane, the keyboard goes to the popover's trigger. A unit test opens a dialog from a popover, finds the popover closed, closes the dialog and finds the keyboard on the trigger; `verify-studio` opens the studio from the profile and closes it with nothing left on `<body>`. `verify-studio` and `smoke-create` follow the family too: the studio's seat is opened again after a press elsewhere in the studio closes it, and a narrow embed's profile is held to being whole on screen and on top rather than inside the embed's box.
  
  Compatibility: unchanged — ops, stored formats, the wire, check codes and tool schemas.
- b5a4bfc: A host speaks in the app's own notices (FR-75). Graview Cloud said "a newer version is available", "offline — changes will be sent when you reconnect", "held while a repair is checked", a conflict with two choices and a refusal's sentence as elements of its own fixed over the app at `z-index: 1000`, in a copy of the framework's floating panel kept in step by hand. The embed's handle now has `notify({ kind: "toast" | "banner", sentence, tone?, action?, actions?, id?, timeout? })`, and so does `@graview/embed/pages`'s. It returns `{ id, dismiss(), update(change) }`. A toast goes by itself after `TOAST_MS` (six seconds; `timeout` says otherwise and `false` keeps it), unless it carries an action, when it waits for one; a banner stays until it is dismissed. A notice said under an `id` already showing takes its place. `tone` is `info` (the default), `good`, `warn` or `bad`, drawn as the notice's edge and dot in the theme's own colours. An action is a press (`onSelect`) or a link (`href`, `target`), the first drawn as the one the notice asks for, and either closes the notice; every notice has a dismiss control. Banners stand at the top of the picture and toasts at its foot, in the floating panel's look and the embed's scheme. Both are in the browser's top layer on the ladder's toast rung (FR-76), and are shown again over any popover of the family that opens after them (`raiseOverPopovers` in `@graview/react`). Each is said aloud as it arrives through a polite live region, and one whose tone is bad through an alert. `createNoticeBoard` and `Notices` in `@graview/primitives` are the board and its drawing: a React host drawing `<Embed>` passes `notices`, and the whole-page `Shell` takes a board as `notices` and draws it over its scene. This is the framework's reading of a request that arrived cut off at "the embed handle exposes `notify({ kind: "toast" | "banner"`": the sentence, the tone, the action, the id and the handle with `dismiss` and `update` are what the rest of that request most plausibly said, and `warn`, `actions` and `timeout` are added for Cloud's offline banner, conflict card and newer-build notice. A unit test says a toast, sees it said aloud and gone, keeps a banner past a minute and changes it in place, says a bad one as an alert, replaces one by id, presses an action and follows a link, and does it on the pages alone. `verify-chrome` says a banner and a toast through the handle on the embed's Graview face at 1440×900 and 390×844, in light and in dark: both are in the top layer, inside the viewport and on top at their middle, in the floating panel at better than 4.5:1, and said aloud. The toast stands over the profile opened after it, goes by itself while the banner stays and changes in place, a bad one is said as an alert, and a dismissed banner is gone. The `graview-embed` skill says to use it. `capabilities().shipped` names FR-75.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-75`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged. `EmbedHandle` and `PagesEmbedHandle` gain `notify`, so a host's own stand-in for either needs one.
- d953bf9: A host can draw a picture of an app without a browser (FR-74). A host listing apps wants each one to look like itself, and the only thing that drew an app was the live Scene, which needs a DOM. So Graview Cloud drew its own iso tiles from each app's kinds, with `hueFor` and copied shading. `sceneThumbnail(source, { scheme, width, height, counts, background, title })` in `@graview/core/document` now returns the Scene from altitude as one SVG string. `source` is a `graview-document@1` document, its JSON, or a `GraviewApp`. Each kind's plot stands where the Scene puts it, in the Scene's lighting (`isoShade`, FR-73) and in the kind's hue, with a brand's `accents` honoured. A district stands as one block, or, when a host passes counts from a snapshot, as its village: one building per member, placed by the same `villageOf` the Scene's ground uses, up to what the plot holds. Counts grow a plot on its own corner, as in the Scene. At a card's size a big app's buildings would be a pixel across, so a village is drawn only while a building is at least four pixels wide and the picture holds at most 160 of them. Past that, each populated district stands as one taller block. The default size is 264 × 132, a card tile. The view box is the drawing's own bounds, widened to the asked proportion so the city is centred and never stretched. A document that does not compile draws the empty ground with a title that says so, and nothing is thrown on a listing page.
  
  The picture is pure: no DOM, no React, no clock, no randomness. The same document gives the same bytes in Node, a worker or a page. Everything from the document is a tenant's words, so the app's name, each kind's name and plural and a host's title are escaped, `&`, `<`, `>`, `"` and `'` alike. Nothing in it refers outside itself: no `href`, no `url()`, no style, no font. Every colour is a hex the code computed rather than a value it was handed, and a brand's ground is read through `coloursIn`. It carries a `role="img"`, a `<title>` naming the app and its first six kinds, and a `<title>` per district. `sceneDistricts(app, { counts })` in the main entry is the same answer as data: each kind's plot, hue, plural label and count, in the order the Scene walks the map (`beginning(app).order`). The village arithmetic (`villageOf`, `villageCap`, `heightOf`) moved from `@graview/react`'s ground into core beside `cityMap`, unchanged, so the Scene and the picture place members with one function.
  
  A document test holds determinism across a document, its JSON and its compiled app. It holds escaping, with `<script>`, `"`, `'`, `&`, `]]>` and a CDATA opener in the app's name, a plural and a host's title, and with a declared app's kind name that no document regex has held. It holds both schemes against `isoShade` and `hueFor`, a brand's accent, villages up to the cap, nonsense counts, an empty app and one that does not compile, fifty populated kinds under 48 KB, forty kinds as a document under 16 KB, and the asked proportion. A layout test runs `layout()` from altitude, with the city order computed as the Scene's root computes it, for the vendors fixture and three studio templates, populated. Every district's plot is the card's plot, the picture draws them in that order, and each hue is the one the Scene's ground paints. The workerd suite draws a picture from a document and from a declared app in an isolate with no DOM. A bare `node` process imports the published document entry, with no DOM globals, and draws the same bytes twice. `capabilities().shipped` names FR-74.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-74`. The declaration — unchanged: `@graview/core/document` gains `sceneThumbnail`, and no document that compiled stops compiling or changes meaning. Ops, stored formats, check codes and tool schemas are unchanged.
- 4e1d6e3: Every popover opens over everything, and everything else stands on one ladder (FR-76). On a hosted app the profile menu opened under the seat's rail and could not be read: each surface picked its own `z-index` in one stacking context, the profile and the problems 20, the rail 40, the altitude control 5, the zoom 8, a menu 60, the studio 100. Now the transient surfaces — the profile, the problems, the activity, the Find box's suggestions, the districts a row could not hold, a card's acts at the pointer, `ChatPanel`'s pill and the studio's own seat — are shown with `showPopover()` in the browser's top layer, which Playwright's Chromium, WebKit and Firefox all have: drawn over every rail, the scene and anything on a host's page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` their ancestors carry, and still inside the element they opened in, so an embed's scoped theme reaches them and nothing lands on the host. In the top layer a pane is placed by what opened it (`useTopLayer` and `placePane` in `@graview/react`): under it, or over it where there is more room above, kept to the viewport, and no taller than the room it has, so what it holds scrolls inside it. Where `showPopover` is missing the pane stands on the ladder's popover rung. Everything that stays on screen takes a named rung from one ladder written once in `@graview/core` (`LAYERS`, `layer(name)`): scene, overview, rail, popover, dialog, toast, which `themeCss` writes on its root or an embed's box as `--graview-layer-<rung>`. The scene's ground is a stacking context of its own, so what orders its plots, cards, lines, figures and zoom (`SCENE_LAYERS`) can never climb over a rail. `POPOVERS` in `@graview/react` names every popover in the family with what opens it and its pane. A test reads every source file of every package and finds no `z-index` written as a number outside the ladder; `verify-chrome` opens every popover of the registry on the embed's Graview and pages faces and on the Shell, at 1440×900 and 390×844 with the seat open, and finds the pane in the top layer, inside the viewport, and under the browser's own `elementFromPoint` at its middle and at its last row. `capabilities().shipped` names FR-76.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-76`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- 7597e22: Every popover behaves as one family (FR-77). Each had its own habits: the profile closed on a press outside it, the districts on a pointer down, the menu at the pointer a frame late and the studio's seat only by its own pill; one gave the keyboard back to its button and the next left it on `<body>`; none moved the keyboard in when it opened; and two could be open at once. `usePopover(name)` in `@graview/react` is the one way, and every popover in `POPOVERS` uses it — the profile, the problems, the activity, the Find box's list, the districts, a card's acts at the pointer, `ChatPanel`'s pill and the studio's seat. Opening one closes any other, page-wide. The keyboard goes to the pane's first control, or to the pane, except under the Find box, whose list is a combobox's and keeps the keyboard in the box. Escape closes it and so does a press anywhere that is not the pane, its trigger or a dialog the pane opened (the studio, from the profile), and the keyboard goes back to the trigger — or, for the menu at the pointer, to the card it was opened on — when it was inside the pane or the press left it on nothing. It hangs from its trigger in the top layer (FR-76), turned over when there is more room above and no taller than the room it has, so no row of it is under the viewport's edge; the profile's settings ran past the bottom of the screen. The hook hands the trigger `aria-expanded` and `aria-controls` and the pane its id, `popover="manual"` and `data-graview-popover`; it takes `open` and `onOpenChange` where somebody else holds the state (the provider's menu, the Find box's own rule for its list), `at` and `returnTo` where there is no trigger, and `popover: false` where the same component is part of something else (`ChatPanel` in the seat's rail). A unit test is generated over the registry: every popover closes another when it opens, takes the keyboard in, closes on Escape and on a press outside and gives the keyboard back, and stays open on a press inside. `verify-chrome` holds every popover each face draws to the same, in the browser, on the embed's faces and the Shell, in Chromium, WebKit and Firefox. `capabilities().shipped` names FR-77.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-77`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- e4f7b67: The seat's rail can be put away (FR-78). It took a column of the picture on every screen whether anybody was talking to it or not, and a hosted app's reader had no way to give the map the room. The companion's header now puts it away to a slim tab at the picture's left edge (`COMPANION_TAB`, 36 pixels), and the tab opens it again, by the pointer or the keyboard, which follows the control from the header to the tab and back; both say `aria-expanded`. Put away, the picture's box gives up only the tab and the provider's new `railLeft` (lent by the companion through `registerRail`) tells the layout the seat takes nothing more, so the city lays out into the room: `railInset(width, left)` takes it. The reader's choice is remembered per app under `graview:companion:<app>` in the host's `memory` or the page's storage, every read and write of it wrapped so a frame that refuses storage still works. Narrower than `COMPANION_OVERLAY_BELOW` (960 pixels) the open rail lies over the picture in the floating panel's look rather than taking a column, with the tab kept at the edge; on a phone it is the sheet along the bottom, as before. `mount(root, { companion: "open" | "collapsed" | "hidden" })` sets where it starts, and the whole-page `Shell` takes the same `companion` prop (remembered under the brand's name): the reader's choice wins over `"open"` and `"collapsed"`, and `"hidden"` draws no rail, no tab and no A-key door. The companion takes `start` and `rememberAs`; `CompanionMode` is exported from `@graview/primitives` and `@graview/embed`, and the provider carries `memory`. A unit test puts it away and opens it again with the keyboard following, finds the picture's box padded by the tab and the layout told, the choice kept and read back over the host's start, `"hidden"` drawing nothing, and storage that throws. `verify-chrome` does it from the keyboard on the embed's Graview face and on the Shell at 1440×900 — the scene's box is the frame's width less the tab, the city's first card moves left into the room, the choice survives a reload both ways — and finds the open rail over the picture at 820 wide with the picture all but the tab, and the host's `"collapsed"` and `"hidden"` starts. The `graview-embed` and `graview-agent-seat` skills say how. `capabilities().shipped` names FR-78.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-78`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged. `GraviewContextValue` gains `railLeft`, `registerRail` and `memory`, so a hand-built context value for a test needs the first two.
- Updated dependencies [b5a4bfc]
- Updated dependencies [e811d26]
- Updated dependencies [d953bf9]
- Updated dependencies [4e1d6e3]
- Updated dependencies [7597e22]
- Updated dependencies [1aba73e]
- Updated dependencies [e4f7b67]
  - @graview/core@0.1.9
  - @graview/layout@0.1.9
  - @graview/render@0.1.9
  - @graview/tools@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8
  - @graview/layout@0.1.8
  - @graview/render@0.1.8
  - @graview/tools@0.1.8

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
