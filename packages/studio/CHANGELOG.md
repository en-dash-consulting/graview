# @graview/studio

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
  - @graview/ship@0.1.15
  - @graview/pages@0.1.15
  - @graview/layout@0.1.15
  - @graview/primitives@0.1.15
  - @graview/react@0.1.15

## 0.1.14

### Patch Changes

- 45842b7: A number field may say its range (FR-114). In a document, a `number` or `integer` field — and an act's declared argument — takes `min`, `max` and `step` (`"level": { "type": "integer", "min": 1, "max": 5 }`); `step` is what its values are whole multiples of, JSON Schema's `multipleOf`. The range is the field's schema, so everything that reads the schema honours it: a value outside it is refused at apply as `invalid`, whichever act brought it (a `set-level` given 9, a `note-strength` that makes a strength at 9, a derived `edit-<kind>`); an agent's tool says `minimum`, `maximum` and `multipleOf`; and `describeArg` and `formField` carry `min`, `max` and now `step` (1 for a whole number), which the routed face's form, the workbench's answer box and the studio's agent panel put on their number inputs, so a form will not take 9. A declared argument that fills a ranged field and says no range of its own is asked for within the field's. `graview check` refuses `default-range` when a default is outside its field's range or off its step, and `field-range` for a range on a field that is not a number, a `max` below its `min`, or a `step` that is not above zero, by path — asked with the checker (`compileDocument`), not by a page compiling a document its host has judged, so the hosted page does not carry them. `editDocument` gains `set-range` (`{ kind, field, min?, max?, step? }`, `null` clears one), refused on a field that is not a number or one whose default it would leave outside; `set-default` is refused outside the range, and `retype-field` to anything that is not a number lets the range go. `diffDocuments` says a changed range ("strength's level now takes 1 to 3, where it took 1 to 5; values outside it are cleared"), and a narrowed one is breaking and listed in `narrowedRanges`; `planMigration` clears the values a narrowed range no longer takes. `toDocument` writes a TypeScript field's inclusive bounds (`.min(0).max(1)`, `.multipleOf(0.5)`) as its document field's range. The studio keeps a document's range through a change it makes, says it up front (`studio-keeps-range`, "taken from 1 to 5"), and refuses to retype such a field rather than let the range go unsaid.
  
  Compatibility: unchanged for stored data, ops and the wire. Additive within `graview-document@1` (docs/stability.md): a field without a range means what it meant. `ArgShape`'s number and `ScalarField` gain an optional `step`, and an integer argument now describes itself with `step: 1`. `DocumentDiff` gains `narrowedRanges`, and the edit vocabulary gains `set-range`. `graview check` gains two error codes, `default-range` and `field-range`, which judge only keys a declaration could not hold before. `capabilities().shipped` gains `FR-114`.
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
  - @graview/tools@0.1.14
  - @graview/ship@0.1.14

## 0.1.13

### Patch Changes

- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/primitives@0.1.13
  - @graview/react@0.1.13
  - @graview/pages@0.1.13
  - @graview/layout@0.1.13
  - @graview/ship@0.1.13
  - @graview/tools@0.1.13

## 0.1.12

### Patch Changes

- 4801c44: What only a fetched face, an agent's seat or the checker uses has left `@graview/core`'s main entry and `@graview/core/document` for subpaths named for what they hold, and the hosted page has room again. A hosted page imports both barrels up front. esbuild gives a whole file to every chunk that can reach it, so a name a barrel re-exported rode in the page's first chunk as soon as any lazily loaded face used it, though the page never called it before a reader acted. Measured from esbuild's metafile, three moves were each worth more than 2 KB. The first is `@graview/core/blocks`: a view's blocks resolved against a record, and the computed values they read. It took 8.3 KB off. The second is `@graview/core/check` with `@graview/core/scene`. The checker was reachable from both barrels: `checkApp` from the main entry, and `compileDocument` beside the compiler a page uses. Through it the page reached the city, which only the scene draws. The checked compile and template instantiation are now modules of their own, so the compiler a page uses no longer imports the checker. This took 2.6 KB off. The third is `@graview/core/figures`, the shipped drawings, which took 2.8 KB off. The page now loads 575 357 bytes up front (562 KB), where it loaded 589 079 (575 KB). Cloud's own shell, built from these sources, is 560.3 KB, where it was 573.7. The budget claim is now 572 KB: the new figure with 10 KB of headroom. The embed without the studio now loads 692 174 bytes first, where it loaded 787 572. The studio, fetched only when it is drawn, asked for `checkApp` through `@graview/core`, so the checker and the document compiler it reaches rode in the frame's first chunk. Its budget comes down to 693 500. A test names every moved export and holds it off both barrels, and the hosted page's test holds the modules themselves out of what it loads first. Some levers were measured and left alone because each was under 2 KB: `formFields` and the rest of the act form (1.8 KB), `beginning` (1.7 KB), the JSON Schema helpers (1.3 KB) and `walkKinds` (0.3 KB). zod's JSON Schema writer (20 KB) stays up front. `zod/mini`, which the page needs, re-exports `toJSONSchema`, so no subpath of ours can put it out of the page's reach while the companion's act tools use it.
  
  Compatibility: these exports moved, with no alias left behind. From `@graview/core` to `@graview/core/check`: `checkApp`, `formatFindings`, `describeApp`, `generateAgentsMd`, `generateLlmsTxt`, and the types `CheckResult`, `Finding` (the checker's), `Severity` and `DescribeOptions`. From `@graview/core/document` to `@graview/core/check`: `compileDocument` and `instantiateTemplate`. `compileDocumentWithoutCheck` stays in `@graview/core/document`. From `@graview/core/document` to `@graview/core/blocks`: `compileBlocks`, `fieldSpecsOf`, `isTallBlock`, `resolveBlocks`, `safeHref`, `sayNumber`, `computedNames`, `computedValues`, `withComputed`, and the types `BlockContext`, `ResolvedBlock`, `ResolvedList`, `SpecBlock`, `ComputedRecord`, `ComputedValues` and `PlainComputed`. From `@graview/core` to `@graview/core/scene`: `BLOCK`, `cityExtent`, `cityMap`, `heightOf`, `MAX_SIDE`, `plotsOverlap`, `roadsOf`, `sharedEdges`, `sideFor`, `toIso`, `villageCap`, `villageOf`, `sceneDistricts`, and the types `Building`, `CityHints`, `CityMap`, `Plot`, `Road`, `SceneDistrict` and `SceneDistrictOptions`. From `@graview/core/document` to `@graview/core/scene`: `sceneThumbnail`, and the types `SceneThumbnailOptions` and `ThumbnailSource`. From `@graview/core` to `@graview/core/figures`: `FIGURES`, `FIGURE_NAMES`, `figureBrief`, `figureFaults`, `figureSvg`, and the type `Figure`. `@graview/primitives` still re-exports `compileBlocks`, `safeHref`, `sayNumber` and `SpecBlock`. A project made by `graview create` imports `checkApp` and `compileDocument` from `@graview/core/check`, and a linked one aliases the four new subpaths. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [4801c44]
  - @graview/core@0.1.12
  - @graview/layout@0.1.12
  - @graview/react@0.1.12
  - @graview/primitives@0.1.12
  - @graview/pages@0.1.12
  - @graview/tools@0.1.12
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
  - @graview/primitives@0.1.11
  - @graview/layout@0.1.11
  - @graview/pages@0.1.11
  - @graview/react@0.1.11
  - @graview/ship@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 6b7edf9: A declared lens draws (FR-79). A document's `lenses` were accepted and drew nothing, and so were a TypeScript app's: a lens drew only because the app's own UI called `createTimelineLens(…)` and registered the result with a title, so a chat that wrote a lens into a document made something nobody would ever see. A `lenses` entry now takes a `title`, an `on` (the kind it stands on, when its bindings do not say) and data-only `options`, and a shipped lens with a title is a place: a pill on the bar, a drive-in from altitude and a page at `/places/<as>`, registered over each kind it stands on at many × full and many × summary. `declaredLenses(app)` in `@graview/core` decides which lenses draw, with which factory options resolved from the bindings, and why the rest do not; `SHIPPED_LENSES` names the six it maps — `timeline`, `calendar`, `coverage`, `board`, `plan`, `reach` — with their roles and the options each takes. `registerDeclaredLenses(registry, app)` in `@graview/primitives` (and `@graview/primitives/frame`) registers each as a door to the shipped factory, fetched when a lens is first drawn (`fetchDeclaredLenses`), and `declaredViews(app)` is the defaults, the view specs and the declared lenses in one registry. The embed calls it for every app it mounts, so a document's lenses draw with no views at all. What a factory needs that cannot be data is derived: a timeline's columns from the values its `column` field takes (or `options.columns`), its axis words from its extent, a calendar's `today` from the reader's own clock unless `options.today` names one. `graview check` says why a titled lens cannot draw, at its path — `lens-cannot-draw`, `lens-option-unknown`, `lens-title-taken`, `lens-not-shipped`, every one a warning — and a shipped lens needs no `requiredRoles` or `binds` of its own (`requiredRolesOf`, `bindsOf`). `plan` joins the shipped names in the checker and in `graview describe`, which now says which declared lenses draw, over what, at which address, and why a titled one does not. `placesOf(app)` lists every place an app has — the home, each lens, each kind — as `{ slug, title, kind, cardinality, address, stop, lens?, hidden?, first? }`, for a host to list. Apps/todo, apps/rota, apps/gauntlet and apps/discography declare their shipped lenses with titles and register none of them by hand. The studio keeps two lenses of one name apart by their titles. `@graview/primitives/scene` is a new subpath (the companion, the inspector, the places bar), which the embed's scene face and the pages' assistant import so that a face which draws no lens does not carry the six factories; `@graview/primitives/pages` also exports `registerDefaultViews` and `registerViewSpecs`. The bundle budgets for every face and for the studio handed in rise to 1_400_000 / 412_000, and what a page without the studio loads first to 203_000 gzipped, said in `scripts/lib/bundle-budget.mjs`, which now measures from the page's own entry rather than the first chunk esbuild lists. A hosted page carries 563 KB up front. Unit tests compile a document declaring one lens of each shipped type and find each drawn by its title on the embed's bar and at its page, `check` and `describe` agreeing with the one list; `verify-declared` does it in a browser. The `graview-lens` skill says to declare a shipped lens rather than register it. `capabilities().shipped` names FR-79.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `title`, `on` and `options` are new optional fields of a `lenses` entry, and `requiredRoles` is optional on `LensDeclaration`. The new codes are warnings, never errors, and a declaration that checked clean before still does; a check's `where` names a titled lens by its title. The wire — `capabilities().shipped` gains `FR-79`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `arrange` and `arrangement`, so a hand-built registry needs neither.
- 17b908c: Edits for all of it (FR-84). A chat that builds an app proposes `editDocument` edits, and everything FR-79–83 added to a document now has one. `add-lens` adds a titled lens (a blocks lens by default; `replace` changes or retitles one, `at` puts one back where it was), `remove-lens` takes one away, `set-home` writes the front page, `arrange-pages` sets `order`, `hide` and `first` (`null` clears each), and `set-computed` adds, changes or removes a computed field. `set-view` also takes `slot: "home"` and `lens: "<title>"`, and every op that sets blocks checks them where they will stand, so a block that cannot be drawn is refused at its own path before anything is previewed. Each op says what it did ("A lens "The parties" is added, over parties.", "The front page changes: a headline, a figure and a list of records.", "Packages work out "offers": …"), and `diffDocuments` says lenses, the front page, the arrangement and computed fields in words of its own rather than "The app's lenses change." A rename now reaches every place that names the thing: computed expressions, the front page's blocks, each lens's `on`, bindings (fields, and an entity lens's kinds, relations and fields), plain-word options and blocks, `pages.order`/`hide`/`first` (a plural or a retitled lens included), and a list's sort key and group, which are read from the records it lists. Every rewrite goes through the rule language's parser, and a template keeps what it said after the bar (`| plural: 'front'`). Two walks were wrong and are fixed: `sum(S, list * units)` and `sort(S, key)` read their second argument from the members, and an act that `creates` a kind follows a rename of the fields it `writes`. A removal rewrites away what names the thing. A block that shows it goes, a list grouped or sorted by it keeps its records, and a computed field that reads it goes along with whatever reads that in turn. A lens that stood on a removed kind goes, and `pages.first` goes with it when it named that lens. The one refusal is a field or relation a lens draws by (a timeline's `start`, a coverage's `link`), which is refused with a finding naming each lens and role. The studio models computed fields as nodes (`computed`, joined to their kind by `computed-on`), so an app opened and handed back, or written back as TypeScript, keeps them, and a studio rename rewrites their expressions. The `graview-studio` skill lists the new ops. `capabilities().shipped` names FR-84.
  
  Compatibility: the declaration and check finding codes are additive within `graview-document@1`. `EDIT_OPS` gains `add-lens`, `remove-lens`, `set-home`, `arrange-pages` and `set-computed`, and `set-view`'s `kind` and `slot` become optional beside `lens` and `slot: "home"`. `set-view` now refuses blocks that `graview check` would call errors, which before were accepted here and refused only at compile. Removing a field or relation a titled lens requires is now refused; before, it dropped the binding and left a lens that could not draw. `diffDocuments` sentences for lenses, pages and the home are new words ("The front page changes." where it said "How the home looks changes."), and a glance naming a computed field no longer reads as changed. The wire: `capabilities().shipped` gains `FR-84`. Ops, stored formats and tool schemas are unchanged.
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
  - @graview/tools@0.1.10
  - @graview/layout@0.1.10
  - @graview/ship@0.1.10

## 0.1.9

### Patch Changes

- 4e1d6e3: Every popover opens over everything, and everything else stands on one ladder (FR-76). On a hosted app the profile menu opened under the seat's rail and could not be read: each surface picked its own `z-index` in one stacking context, the profile and the problems 20, the rail 40, the altitude control 5, the zoom 8, a menu 60, the studio 100. Now the transient surfaces — the profile, the problems, the activity, the Find box's suggestions, the districts a row could not hold, a card's acts at the pointer, `ChatPanel`'s pill and the studio's own seat — are shown with `showPopover()` in the browser's top layer, which Playwright's Chromium, WebKit and Firefox all have: drawn over every rail, the scene and anything on a host's page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` their ancestors carry, and still inside the element they opened in, so an embed's scoped theme reaches them and nothing lands on the host. In the top layer a pane is placed by what opened it (`useTopLayer` and `placePane` in `@graview/react`): under it, or over it where there is more room above, kept to the viewport, and no taller than the room it has, so what it holds scrolls inside it. Where `showPopover` is missing the pane stands on the ladder's popover rung. Everything that stays on screen takes a named rung from one ladder written once in `@graview/core` (`LAYERS`, `layer(name)`): scene, overview, rail, popover, dialog, toast, which `themeCss` writes on its root or an embed's box as `--graview-layer-<rung>`. The scene's ground is a stacking context of its own, so what orders its plots, cards, lines, figures and zoom (`SCENE_LAYERS`) can never climb over a rail. `POPOVERS` in `@graview/react` names every popover in the family with what opens it and its pane. A test reads every source file of every package and finds no `z-index` written as a number outside the ladder; `verify-chrome` opens every popover of the registry on the embed's Graview and pages faces and on the Shell, at 1440×900 and 390×844 with the seat open, and finds the pane in the top layer, inside the viewport, and under the browser's own `elementFromPoint` at its middle and at its last row. `capabilities().shipped` names FR-76.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-76`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- 7597e22: Every popover behaves as one family (FR-77). Each had its own habits: the profile closed on a press outside it, the districts on a pointer down, the menu at the pointer a frame late and the studio's seat only by its own pill; one gave the keyboard back to its button and the next left it on `<body>`; none moved the keyboard in when it opened; and two could be open at once. `usePopover(name)` in `@graview/react` is the one way, and every popover in `POPOVERS` uses it — the profile, the problems, the activity, the Find box's list, the districts, a card's acts at the pointer, `ChatPanel`'s pill and the studio's seat. Opening one closes any other, page-wide. The keyboard goes to the pane's first control, or to the pane, except under the Find box, whose list is a combobox's and keeps the keyboard in the box. Escape closes it and so does a press anywhere that is not the pane, its trigger or a dialog the pane opened (the studio, from the profile), and the keyboard goes back to the trigger — or, for the menu at the pointer, to the card it was opened on — when it was inside the pane or the press left it on nothing. It hangs from its trigger in the top layer (FR-76), turned over when there is more room above and no taller than the room it has, so no row of it is under the viewport's edge; the profile's settings ran past the bottom of the screen. The hook hands the trigger `aria-expanded` and `aria-controls` and the pane its id, `popover="manual"` and `data-graview-popover`; it takes `open` and `onOpenChange` where somebody else holds the state (the provider's menu, the Find box's own rule for its list), `at` and `returnTo` where there is no trigger, and `popover: false` where the same component is part of something else (`ChatPanel` in the seat's rail). A unit test is generated over the registry: every popover closes another when it opens, takes the keyboard in, closes on Escape and on a press outside and gives the keyboard back, and stays open on a press inside. `verify-chrome` holds every popover each face draws to the same, in the browser, on the embed's faces and the Shell, in Chromium, WebKit and Firefox. `capabilities().shipped` names FR-77.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-77`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
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
  - @graview/layout@0.1.9
  - @graview/ship@0.1.9
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
  - @graview/ship@0.1.8
  - @graview/tools@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/ship@0.1.7
  - @graview/layout@0.1.7
  - @graview/pages@0.1.7
  - @graview/primitives@0.1.7
  - @graview/react@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- a5daad4: A host's refusal is said in its own words, and an Apply with nothing changed asks the host nothing (FR-65). `onApply` could answer `{ ok: false, findings }` (FR-60), which the studio always headed "Not kept: the host could not keep this change. Your edits are still here.", so Graview Cloud said "Nothing changed in the studio." as a finding under a heading about failing to keep something. A verdict may now carry a `sentence`, which the studio says as its heading in place of its own; with one, `findings` may be empty or left out, and no empty list is drawn. Apply with nothing changed, or with every change taken back, no longer reaches the host: the studio says "Nothing to apply: the declaration is as the studio opened it. Change something, then Apply." and stays open. `Studio.unchanged()` reads that from the graph, not the history, so a change undone is no change. The applied panel's `data-applied` gains `unchanged`. Tests in `@graview/embed` hold the sentence as the heading with findings, with an empty list and with none, the studio's own heading where there is no sentence, and `onApply` not called for an untouched studio or one whose change was undone; `verify-studio` presses Apply in a host's page before any change and finds the host handed nothing, then finds the host's sentence heading its refusal. `capabilities().shipped` names FR-65.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-65`. `StudioHostVerdict` widens: a refusal may carry `sentence`, and with it `findings` is optional. A host whose `onApply` was handed an unchanged declaration is no longer called for it. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/primitives@0.1.6
  - @graview/layout@0.1.6
  - @graview/pages@0.1.6
  - @graview/react@0.1.6
  - @graview/ship@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- f989024: A field changes in place in the studio, by acts that say what they change (FR-61). `STUDIO_MUTATIONS` added, renamed and removed kinds, fields and edges, and nothing named changed what a field is, though `documentEdits` already said such a change as `retype-field`, `set-required`, `set-options` and `set-label`; the only way was the derived "Change the field …", which offered the name too and so renamed a field without the rules that read it following. Graview Cloud kept forms under the studio for these. Now four acts on a field join `STUDIO_MUTATIONS`: `retype-field` (`{ id, type, options? }`; an enum is given its options, or keeps the ones it has, and is refused in words without any; a field made anything else lets its options go), `set-required` (`{ id, required }`), `set-options` (`{ id, options }`; options already there keep their order, and a field that is not an enum yet becomes one, said as the `retype-field` it is, so the act is never offered and then refused) and `describe-field` (`{ id, description }`, empty takes it away). Each is said as the one edit a person writing the document would write: vendor's `notes` made a `string` gives `edits()` equal to `[{ op: "retype-field", kind: "vendor", field: "notes", type: "string" }]`. `rename-field` now says it writes the name, so the derived "Change the field" is gone and a field's name changes only by the act that rewrites the rules that read it. Retyping a field shown as money is still refused by the document, in words. The graview-studio skill lists the acts. `capabilities().shipped` names FR-61.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-61`. The studio's own store no longer derives `edit-field`: a script or an agent that called it calls `retype-field`, `set-required`, `set-options` or `describe-field`, and `rename-field` for the name. An app's own tool names and schemas, ops, stored formats and check codes are unchanged.
- 97f2a0a: A host that keeps the declaration says who is offered the studio (FR-59). `maySeeTheStudio` judges by the app's own policy, which grants the app's people, not its builders: on the vendors app only an owner or a planner may do everything, so an editor Graview Cloud had already let onto its builder was shown no studio, and Cloud's way round it was to hand the embed a store with the policy taken off. Now `StudioPlace` takes `offered`, and the embed's `studio` option passes it through: `true` or `false` is the host's word over the policy's, and a function `(store, principal) => boolean` decides from the store and the seat. Omitted, `maySeeTheStudio` decides as it always has. The app's policy stays on the store for everything else the embed draws. A test opens the vendors app through `mount(…, { studio: { onApply, offered: true } })` as a seat whose only role is `viewer`: the studio is drawn, and `handle.store.policy` is still the app's; without `offered` the same seat is offered nothing; `offered: false` withholds it from an owner. `StudioOffered` is exported from both packages, and `capabilities().shipped` names FR-59.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-59`. `offered` is a new optional prop and option; omitted, who sees the studio is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
- 1e21d54: A host that refuses a change is heard (FR-60). `onApply` returned nothing, so when the studio handed Graview Cloud a change with `documentFindings` — one no edit says, which Cloud cannot preview — the studio still said "The checker is happy. Handed to the host to keep" while the page around it previewed nothing. Now `onApply` may return, or resolve to, `{ ok: false, findings }`: the applied panel says "Not kept: the host could not keep this change. Your edits are still here." with each finding's path, message and fix, the studio stays open, and its edits are untouched, so Apply again hands the host the same change. A promise is waited for ("Handing it to the host…"), a rejected one is a refusal in its own words, and an answer to an earlier press that arrives late says nothing. Returning nothing or `{ ok: true }` is kept, as before. The panel carries `data-applied` (`kept`, `asking`, `refused-by-host`, `refused-by-checker`) for a harness to read. `StudioOnApply`, `StudioHostVerdict` and `StudioHostAnswer` are exported from `@graview/studio`, and the first two from `@graview/embed`, whose `studio.onApply` takes the same type. A test removes vendor's `notes` through the studio's own actions strip in an embed whose host refuses: the refusal and its finding are shown, "Handed to the host" is not, the studio is still open, and the second Apply hands over `[{ op: "remove-field", kind: "vendor", field: "notes" }]` again. `capabilities().shipped` names FR-60.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-60`. `onApply`'s return type widens from `void` to `StudioOnApply`'s answer; a host that returns nothing is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
- f1fcf13: A studio in a host's page draws no `<main>` of its own (FR-58). Graview Cloud's builder mounts the studio through the embed's `studio: { onApply }` into an element inside its own page, and the studio drew its picture in a `<main>` inside the embed's labelled section — so axe failed the host on `landmark-main-is-top-level` and `landmark-no-duplicate-main` whatever the host did, since a main inside the embed's region can never be top-level. Now `StudioPlace` takes `landmark: "main" | "region"`, and omitted it follows `within`: a boxed studio, which is every embed's, draws its picture as a region named "The declaration", and a page-filling one keeps its main. The embed's `studio` option takes the same `landmark`, for a host whose whole body is the studio, and its type is exported as `EmbedStudio`. A test builds a page the way Cloud's is (a header, a nav, its main, a footer), opens the studio in it, and runs axe's landmark rules and `region` over the whole document: nothing; with `landmark: "main"` axe reports the two rules Cloud did. `capabilities().shipped` names FR-58.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-58`. An embed's studio draws a labelled `section` where it drew a `main`; a host that selected the studio's `main` selects `[data-testid="studio"] section[aria-label$="The declaration"]`. Ops, stored formats, check codes and tool schemas are unchanged.
- 9787063: A studio in an embed is drawn over the embed's own seat. Boxed, the studio is drawn from the embed's strip, which comes before the embed's picture in the page, and the picture's seat sits at the same `z-index` (40) and its menu above it (60): later and no lower, the seat was drawn over the open studio and took its presses, so in Graview Cloud's builder a press on "Remove the field" in the studio's own actions strip landed on the seat's form underneath. A boxed studio, the modal dialog it is, now stands at 100 inside its box; a page-filling one is unchanged. `scripts/verify-studio.mjs` opens the studio in a host's page built like Cloud's — a header, a nav, its own main, a footer — through the embed, as an editor the host offers it to, with a host that refuses what it is handed and `StudioPlace` handed in, and holds five claims there: no chunk fetched after the page's own (FR-63), the studio drawn for the editor with the app's policy kept (FR-59), one main on the page and none in the embed with axe's landmark rules and `region` clean over the whole document (FR-58), a field removed from the studio's own strip and refused by the host, shown refused, still open, and handed over the same on a second Apply (FR-60), beside the field's acts by name on that strip (FR-61), and nothing thrown.
  
  Compatibility: unchanged. Ops, stored formats, the wire, check codes and tool schemas are untouched; only where an open boxed studio stacks within its box moved.
- 76df9ba: What the studio will not change is said up front (FR-62). The studio keeps how a number is shown (a `format`), what it is counted in (a `unit`) and what a list holds (its `of`), and refuses to retype a field that carries one rather than guess what the new type does to it — but a host could learn that only by trying, so Graview Cloud copied the rule into its builder (`studioLeaves`) to warn first. Now `@graview/studio` exports `uneditable(document)`: one finding per field property the studio keeps but will not change, a `note` at the field's path with the code `studio-keeps-format`, `studio-keeps-unit` or `studio-keeps-item-type` and the sentence "vendor's quote is shown as money; the studio keeps that as it is and will not change it, nor retype the field". On Cloud's vendors it names `kinds.category.fields.budget` and `kinds.vendor.fields.quote`. `keptBy(field)` is the rule for one field, and the studio's own refusal to retype now reads it, so what is said ahead and what is refused are one rule in the same words. The graview-studio skill says to ask. `capabilities().shipped` names FR-62.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-62`. `uneditable`, `keptBy` and `KeptProperty` are new exports of `@graview/studio`. The `studio-unsaid` refusal to retype is unchanged in code, path and words. Ops, stored formats, check codes and tool schemas are unchanged.
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
  - @graview/ship@0.1.5
  - @graview/primitives@0.1.5
  - @graview/react@0.1.5
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5
  - @graview/pages@0.1.5

## 0.1.4

### Patch Changes

- a9c0f2d: A diff reads what a document means, not the order its keys were written in. Two documents with one `documentHash` are one document, but `diffDocuments` compared their parts as JSON text, so an act whose description was written last "changed": between Cloud's vendors document and the document `studio.apply()` handed back for one added field — the same hash apart from that field, its keys in the order the schema lists them — the diff said nine bogus sentences ("The act \"Add a category\" changes.", "vendor's status is described differently."). Every comparison in the diff now reads canonical JSON, keys sorted as `documentHash` sorts them, so two hash-equal documents differ in nothing and the studio's document says exactly the one change. The same holds for a JSON Patch `test` op, for `planMigration`'s "converted" and patch comparisons, and for the studio's `documentEdits`. `canonicalize` takes any part of a document, not only a whole one.
  
  Compatibility: additive. `diffDocuments` says fewer sentences — none — for a difference only of key order, and `unchanged` is true for two documents with one hash; every real difference is said as before. A JSON Patch `test` now passes for an object equal but for key order, as RFC 6902 says it should. `canonicalize`'s parameter widens from `GraviewDocument` to any value; its output for a document is unchanged, so every `documentHash` is the same. The document format, the edit op surface, ops, stored formats, the wire, tool names and schemas, and check codes are unchanged.
- a814d97: A studio opened on a document is judged by the document. `apply()` ran the checker over the studio's own TypeScript reading of the declaration, which does not carry a removal into the acts the way `editDocument` does: removing a relation left the acts that connect it claiming an edge nobody declares (`edge-claim-unknown-kind`), removing or renaming a field left the acts that write it (`writes-unknown-field`), removing a kind left the acts that make it (`creates-unknown-kind`, `node-ref-undeclared`) — while `studio.document()` compiled clean, so a host was refused a change that was fine. Across every kind, relation and field of five of Graview Cloud's templates (142 removals and renames), 58 were refused that way: 16 of 16 kind removals, 12 of 12 relation removals, 15 of 57 field removals and 15 of 57 field renames. Opened on a document, the studio's verdict is now what `compileDocument(studio.document())` says — its findings at the document's paths, under the checker's own codes — and `check()` (the verdict the studio shows), `would()` (what an agent's proposal is judged by) and `apply()` all ask the same question, so they agree. All 142 now say what compiling the document says: the change is applied, and `apply()` returns the compiled document's app, or it is refused in the document's own words (removing a kind a rule still reads across a relation is, as `editDocument` refuses it). `StudioPlace`'s Apply hands a host that keeps the declaration the document whenever it compiles.
  
  Compatibility: for a studio opened on a document whose change can be said as one, `check()`, `would()` and a refused `apply()` report the document compiler's findings — `where` is the document path (`rules.within-budget.repairs.0.act`) and a framework finding keeps its checker code — where they reported `checkApp` over the studio's reading. A change no edit can say is judged as before, as is a studio opened on a TypeScript app. The document format, the edit op surface, ops, stored formats, the wire and check codes are unchanged.
- d496926: A name the studio is given is kept as it was written. `add-edge` with the label `tendedBy` declared the relation `tendedby`, and `add-field` with `lastChecked` the field `lastchecked`, because every new name was folded to lower case — a different relation and field from the ones `editDocument` and Graview Cloud's builder make for the same words, so the document the studio handed back was not the one the host would have written. A label that is already a legal name (a relation in kebab-case or one camelCase word, a field in camelCase) is now the name; words that are not yet one ("Looked After By") are still made into one (`looked-after-by`). Held by documentHash equality with `editDocument` for `add-relation` and `add-field` on Cloud's household-chores template.
  
  Compatibility: the studio's `add-edge` and `add-field` acts keep a camelCase label's casing where they lower-cased it; a node id they make (`edge:<kind>.<name>`, `field:<kind>.<name>`) follows the name. Every other label is named as before. The document format, the edit op surface, ops, stored formats, the wire and check codes are unchanged.
- be20407: Renaming a field a rule names is one edit. `editDocument`'s `rename-field` rewrites the prose around the field's name as well as the name ("was due {due}" becomes "was renamed {renamed}") and the act named for it (`set-budget` becomes `set-renamed`), where the studio's own rename rewrites only the name; `documentEdits` compared the studio's copy of the rule with the one the rename made, found them different, and said the rule again whole with `add-rule` and `replace: true` — carrying the studio's stale words and the act's old name. Across 114 field renames of five of Graview Cloud's templates (every field, renamed to a plain word and to a camelCase one), 10 gave a different document from `editDocument`'s, and 6 of those a document that did not compile (`rules.within-budget.repairs.0.act: "set-budget" is not an act this document declares` for vendor-shortlist's category.budget; job-search's step.due and renovation's room.budget the same, each both ways). A rule is now compared with the old rule put through the studio's own renames, so one only a rename touched is left as the edit made it; and a rule the studio did change besides is said again with the document's repairs found one for one, under the names the edits gave their acts. All 114 now give `editDocument`'s `documentHash`.
  
  Compatibility: `studio.edits()` no longer adds an `add-rule … replace: true` after a `rename-field` when the rule changed only by the rename; a rule given again keeps its repairs' labels and their acts' new names. The document format, the edit op surface, ops, stored formats, the wire and check codes are unchanged.
- 0183340: A tool's schema does not depend on zod's minor version. An agent tool's input schema is a stability surface, and zod writes its own regex for a string format — `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.iso.date()` — beside the format's name. That regex differs between zod 4.4.3, which this repository locked, and 4.6.5, which a consumer resolves from the published ranges, so Cloud's tool-schema snapshot saw sixteen "inputSchema changed" entries that were only zod's regex. `toJsonSchema`, and with it `mutationToolSchema`, `nodeJsonSchema`, `schemaJson` and the conformance kit's tools, now says a format string by its JSON-schema `format` alone (`email`, `uri`, `uuid`, `date-time`, `date` …) and drops zod's `pattern`; a pattern the author wrote with `.regex(…)` is kept, beside the format where there is one. Moving the workspace to zod 4.6.5 found a second dependence on zod's internals: zod 4.6 no longer fills a schema's `_zod.bag` as it builds it, so `describeArg` lost a number's bounds and a date's pattern, and a date argument was asked for as free text. It now reads the checks on the definition, which both versions keep. Every package's zod range is now `^4.6.5`, so the tests run on what a consumer gets.
  
  Compatibility: tool input schemas — a format-based string no longer carries zod's regex `pattern`, only its `format` (an `email` property is `{ "type": "string", "format": "email" }`); a `z.url()` property is unchanged, and an author-written pattern is kept. A snapshot of a tool surface taken with either zod version changes once, for those properties only, and then holds across zod minors. The conformance kit's recorded fixtures are unchanged: none declares a format string, and the lock holds. `describeArg` and `argShape` answer as they did on zod 4.4 for every schema, now on 4.6 too. Every package's `zod` dependency moves from `^4.4.3` to `^4.6.5` (products never install zod; `@graview/core` re-exports it). The embed's bundle budgets rise with zod 4.6, which gives every schema type its own JSON-schema processor: the pages face alone from 815,000 / 220,000 to 950,000 / 252,000 bytes and every face from 1,150,000 / 330,000 to 1,290,000 / 362,000 (minified / gzipped), about 130 kB / 30 kB of zod's that a host on zod 4.6 was already paying. The document format, ops, stored formats, the wire and check codes are unchanged.
- cc889f4: A typed app fits wherever an app goes, with no cast. A consumer's TypeScript met four walls that the framework's own code got past with `as never` and `as unknown as GraviewApp<AnySchema>`. `installation.mutations` would not spread into an app's mutations. A typed app was not an app: `GraviewApp<S>` would not widen to `GraviewApp<AnySchema>`, because an act's `apply` and `describe` and a rule's `evaluate` were function-typed properties, checked contravariantly — so the studio's readers (`graphToDeclaration`, `migrationBetween`, `sourceChanges`, `declarationFiles`), `createStoreHandler` and the embed could not be handed one. `schema.definition(kind)` on a schema whose kinds are only `string` was `never`. And an unbound `defineInvariant` handed its rule a `never` subject. Now `apply`, `describe` and `evaluate` are declared as methods, so a typed app and its acts and rules widen; `installation.mutations` spreads into any app's mutations; `definition(kind)` answers the kind's definition, any definition of that kind on `AnySchema` (`DefinitionOfKind`); an unbound rule's subject is a node of its kind (`NodeOfKind` on `AnySchema`), its fields `unknown` until bound; and `reachLens.View` is the generic view it always was, so it registers on any app. The casts are gone from the studio, the store handler, the embed, `@graview/core/testing`, the launcher and the example apps, and type-level tests hold each wall down.
  
  Compatibility: types only, nothing at run time changes. Every type is wider than before except one: `apply`, `describe` and `evaluate` lose `readonly` (a method cannot be marked so), so code that reassigned one is now allowed to, where it was refused. `DefinitionOfKind` is a new exported type. A call such as `syncConflictInvariant()` beside a typed schema may now infer `AnySchema` where it inferred the schema, and wants `syncConflictInvariant<typeof schema>()`. The wire, ops, stored formats and check codes are unchanged.
- 6d324a0: The app the studio's `apply()` hands back is the document's. Opened on a document, `apply()` gave back the document the change makes and, beside it, the studio's own TypeScript reading of the declaration as `app` — so `toDocument(studio.apply().app)` still said every act was code (`act-is-code`), and a host that kept the app and read it back lost the document it had just been handed. When the change is said as a document, `app` is now the app that document compiles to, which the compiler remembers as compiled from it: `documentOf(apply().app)` is `apply().document`, and `toDocument(apply().app)` gives it back with no finding and the same `documentHash`. Held for a field added to every kind of five of Graview Cloud's templates, 16 of 16, where all 16 read back as code before; `StudioPlace`'s `onApply` hands a host the same app.
  
  Compatibility: for a studio opened on a document whose change compiles, `apply().app` is `compileDocument(apply().document).app` where it was the studio's reading: its version is the document's, and it carries no `migrations` entry for the change — `migration` and `fills` still say how a stored graph moves. A document that does not compile comes back as `documentFindings` beside the studio's reading, as a change no edit can say does. A studio opened on a TypeScript app is unchanged. The document format, the edit op surface, ops, stored formats, the wire and check codes are unchanged.
- 180452e: No edits is no change. A surface that says its changes as edits has none when nothing changed — the studio's `edits()` is `[]` on a studio nobody touched — and `editDocument(d, [])` refused it ("give at least one edit"), so every host had to treat nothing as a special case. An empty list now hands back the document as it was, with no sentences and no fills. `edits` that is not a list at all is still refused, in words. The studio's `document()` no longer needs its own case for it.
  
  Compatibility: the document edit vocabulary — `editDocument` with an empty list now answers `{ ok: true, document, said: [], fills: [] }` where it answered `{ ok: false }` with an `edit` finding at `edits`; a caller that counted on the refusal to mean "nothing to do" gets the same document back instead. Every non-empty list applies as before. The op set, the document format, ops, stored formats, the wire, tool names and schemas, and check codes are unchanged.
- ba950f3: A host says the document the studio opens on, rather than the studio guessing it from an object's identity. The studio found the document an app was compiled from by the very object `compileDocument` returned, so `createStudio({ ...compiled.app })`, or an app with its policy swapped for the signed-in seat's, gave `document()` undefined — silently: the host got a TypeScript app back and no word of why. `createStudio(app, { document })` now says the document outright, and a copy or a seat's app with it said hands back the document as the compiled app does (the document's own policy kept). When the studio knows no document, `document()` is still undefined and `studio.whyNoDocument()` says why in one finding (`studio-no-document`, with `createStudio(app, { document })` as the fix); `apply()` hands that finding back as `documentFindings`. The graview-studio skill says how, and that the studio judges a document by compiling it.
  
  Compatibility: additive. `StudioOptions` gains `document`; `Studio` gains `whyNoDocument()`. `apply()` on a studio that knows no document — a TypeScript app's — now carries `documentFindings: [studio-no-document]` where it carried none; `studio-no-document` is a new finding code only the studio produces, a warning. The document format, the edit op surface, ops, stored formats, the wire and check codes are unchanged.
- 1f260a7: The studio hands a host back a document. `createStudio(compileDocument(d).app)` edited a document-compiled app well and gave back a TypeScript app, so `toDocument(studio.apply().app)` was not the document plus the edit: every act came back a function body (`act-is-code`), every label code, `text` fields as `string`, the brand and the description gone, and adding one field to Cloud's vendors previewed as "every act is removed". Now `studio.edits()` says what changed since the studio opened as `editDocument`'s own ops, matched by node id so a renamed field is `rename-field` and keeps its values: add, rename and remove a kind, a field and a relation; `retype-field`, `set-required`, `set-options` and `set-label` on a field that stays; `add-act` and `remove-act`; `add-rule`, `remove-rule`, and a rule whose judgement the studio changed given again whole. `studio.document()` is the document the app was compiled from with those edits applied, so everything the graph did not touch is kept as it was written; and `studio.apply()` adds `document`, `edits`, `said` and `fills` beside the app, for a host to compile and keep; `toDocument` reads the compiled document back with no finding. Adding `soil: string` to a vendor gives a document whose `documentHash` is the one `editDocument(d, [{ op: "add-field", kind: "vendor", field: "soil", type: "string" }])` makes. A change no op can say yet — a relation's cardinality or far end, a kind's lifecycle, noun or figure, an act changed in place, a role, a grant, a sight, a lens, the brand — is not dropped: `document()` refuses with a `studio-unsaid` finding naming it, and `apply()` hands back `documentFindings` beside the app. The studio's field types are now the document's eleven (`integer`, `datetime`, `url` and `email` join `string`, `text`, `number`, `boolean`, `date`, `enum` and `list`), and a document's fields are read as what the document says, so `notes: text` stays `text`. What a field carries besides its type — `format` (money, percent, duration), `unit`, and a list's `of` — the studio does not edit: an unrelated change keeps it untouched, and retyping such a field is refused in words ("vendor's quote is shown as money, which the studio does not edit …"). `StudioPlace`'s `onApply` hands a host the `document`, `edits` and `documentFindings` too. The graview-studio skill says how. `capabilities().shipped` names FR-54 (FR-54).
  
  Compatibility: additive. `Studio` gains `edits()` and `document()`; `apply()`'s answer gains optional `document`, `edits`, `said`, `fills` and `documentFindings`, and its type is exported as `StudioApplyResult`; `documentEdits`, `documentAfter` and the type `StudioEdits` are new exports of `@graview/studio`; `StudioApplied` gains optional `document`, `edits` and `documentFindings`. `apply().app` is the studio's reading of the declaration, as before. `FIELD_TYPES` gains four types, so the studio's `add-field` and derived `edit-field` take them, and a TypeScript checkout's `z.number().int()`, `z.url()`, `z.email()` and `z.iso.datetime()` fields are now read and written as `integer`, `url`, `email` and `datetime` where they were `number` and `string`. The document format (`graview-document@1`), the edit op surface, ops, stored formats, the wire and check codes are unchanged; `studio-unsaid` is a new finding code only the studio produces. The embed's "every face" bundle budget rises from 1,100,000 / 315,000 to 1,150,000 / 330,000 bytes (minified / gzipped): the studio it carries now carries `editDocument` and the document schema, about 43 kB minified and 13 kB gzipped; the pages face alone is unchanged.
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
- Updated dependencies [86baf0b]
- Updated dependencies [83448ba]
- Updated dependencies [1f260a7]
- Updated dependencies [062fe46]
- Updated dependencies [0497bbf]
  - @graview/ship@0.1.4
  - @graview/core@0.1.4
  - @graview/tools@0.1.4
  - @graview/layout@0.1.4
  - @graview/react@0.1.4
  - @graview/primitives@0.1.4
  - @graview/pages@0.1.4

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
  - @graview/react@0.1.3
  - @graview/primitives@0.1.3
  - @graview/layout@0.1.3
  - @graview/pages@0.1.3
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- 230d9b4: A rule can say what must hold in words the framework judges: `quote != null`, `count(in('fills') where status == 'booked') <= 1`. `@graview/core/document` is a new entry, and its rule language has these properties:
  - Fields and one-edge hops, `out`/`in`/`all` sets with `where`, and a closed set of functions.
  - `null` that propagates.
  - No regular expressions, loops or user functions.
  - A step budget on every evaluation.
  
  `expressionRule(name, { over, require, when?, says?, repairs? })` makes the invariant the engine runs. A judgement that runs out of budget is `over-budget` (FR-29), and any other mistake is `could-not-judge`; neither is a hang.
  
  A rule in the studio now takes its judgement as a field. The studio judges it after apply, writes it into the checkout as `expressionRule(…)` with its import instead of a stub to fill in, and reads it back from a declaration whose invariant carries `judgement`. The seedbed rehearsal proves this end to end (FR-07).
  
  Compatibility: the declaration — additive: `InvariantDefinition.judgement` and a studio rule's `require`/`when`/`says` are optional; a rule without one is judged as before. `@graview/core/document` is a new entry point.
- 6ea13f7: An embed knows what its host can keep. `mount({ studio: false })` leaves the Studio place off the strip, for a hosted reader who could change a declaration that would never be saved. `mount({ studio: { onApply } })` keeps it and hands the host what the checker passed (`StudioApplied`: the app, the migration and the files), asking after no dev-server door and writing nothing itself; `StudioPlace` takes the same `onApply`, and `useStudioDoor(null)` asks nobody. `@graview/embed/pages` mounts the routed face alone, without the scene, the lenses or the studio: bundled for the browser without React it is about 730 KB minified (195 KB gzipped), where every face is about 1.05 MB (300 KB). `node scripts/inspect-pack.mjs` bundles both and fails when either passes its budget, and a linked project's Vite config aliases the new entry (FR-19).
  
  Compatibility: additive — `EmbedOptions.studio`, `StudioPlace`'s `onApply`, `StudioApplied` and the `./pages` entry are new, and an embed without `studio` offers the Studio as before. `EmbedOptions` is now `FrameOptions` (exported) plus the scene's own options, with the same fields. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
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
- 5e85a39: Structural change is a vocabulary. `editDocument(doc, edits)` takes twenty-one operations, from add-kind to rename-relation to set-view, and returns the document with a sentence for each.
  
  A rename sets `renamedFrom` and rewrites every reference, using the rule language's own walk, which knows a quoted word and another kind's field from this one:
  - rules and templates;
  - acts and the arguments they ask for;
  - grants, repairs and views.
  
  When a rename moves an agent's tools — `set-quote` becoming `set-price`, `edit-vendor` asking for `price` — the result says so.
  
  The studio gains `rename-field`, the same operation over its own graph, through the same walk (`renameIn`). A test holds the studio and `editDocument` to the same declaration for the same change (FR-34).
  
  Compatibility: the declaration — additive: new functions and a new studio act; derived tool names change only when an app renames what they are named for, and an edit says so.
- 6460336: What a seat may not see never leaves the store. The store handler, and so `graview serve`, answers each route with the store as the asking seat sees it. `/graview/state`, `/graview/since`, `/graview/export` and the ops on `/graview/here` come from `seenBy(store, principal)`, and ops that touched what the seat may not see come back withheld in place, so an unmodified `openRemote` still loads them (FR-16). `/graview/here`, `/graview/who` and `/graview/leave` leave out anybody whose own record the seat may not see. For everybody else they clear a stop, hover or robot position that names such a record (`presenceSeenBy`). The ops `/graview/ops` sends back are redacted the same way. A participant whose id holds a colon (`shopper:bethan`) now keeps its session as sent.
  
  A write that names a record the seat may not see is refused before any grant is read, with the sentence "Not permitted: “Answer the enquiry” names a record you may not see." This holds in `store.apply` and `store.permits`, over the wire and through the agent tools. A seat with sights may not undo what it may not see. Over `graview mcp`, `get_affordances` is derived from what the seat sees, and `undo_batch` judges over the log as the seat sees it.
  
  Sights have one meaning, the document's and the framework's, and `compileDocument` puts a document's `policy.sees` into the compiled app's policy. With no `sees`, everybody sees everything. With any sight, every kind is deny by default, like grants: a kind no sight names is seen by nobody but the system, and the new check warning `sight-unnamed-kind` names each one. `own` means the principal's own records: their record, what an edge joins to it, and what they made. `recordsOf(log)` reads who made each record and its kind, so a removed record is still judged by the kind it was. The studio models a sight as a node with three acts, `add-sight`, `change-sight` and `remove-sight`, and writes sights back into the declaration and `policy.ts`. Changing them in place is still said rather than written, as it is for grants (FR-02).
  
  Compatibility: breaking for a policy that declares `sees`: a kind no sight names used to be seen by everybody and is now seen only by the system. Add `{ roles: "*", kinds: [...] }` for the kinds everybody may see; `graview check` names each one with `sight-unnamed-kind`, a new warning. Additive for `own`, which now also covers the records a principal made. Breaking for a host that relied on the wire sending the whole store: every read route now answers with what the asking seat sees, and only the system seat sees everything. A host that serves its owners everything serves them as the system or names them in a sight. Additive for the wire otherwise: no route or field was added or removed, and `WIRE_PROTOCOL` stays 1. Changed for derived tools: the names and input schemas are unchanged, the studio gains `add-sight`, `change-sight` and `remove-sight`, and the read and undo tools answer as the seat sees. For the declaration document, `policy.sees` now takes effect in the compiled app, and the conformance fixtures declare no sights, so none of them changes.
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
- Updated dependencies [ca11fe8]
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
  - @graview/ship@0.1.2
  - @graview/pages@0.1.2
  - @graview/tools@0.1.2
  - @graview/react@0.1.2
  - @graview/layout@0.1.2

## 0.1.1

### Patch Changes

- 59d5dd3: The studio keeps a kind's `display.glance` through its round trip — in the declaration it hands back and in the files it writes — where it dropped it, and the checker then noted `glance-unchosen` on a kind that had chosen.
- b1eae03: The studio keeps a policy's `sees` through its round trip, in the declaration and in the `policy.ts` it writes, kept to the kinds still declared. It has no act for a sight yet, and dropped them: a storefront written back by the studio showed every customer to everybody again.
- dcffc91: Under a policy with no installation, the studio is offered to the seats that may do everything — a grant of every act on every kind — rather than to whoever is here. A showroom offered its own declaration, roles and rules to somebody browsing who may do nothing but sign up.
- Updated dependencies [bf36bbe]
- Updated dependencies [ed02370]
- Updated dependencies [e0c8cac]
- Updated dependencies [e1b9f5c]
- Updated dependencies [cbdd94a]
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
- Updated dependencies [c222b58]
- Updated dependencies [deb98ca]
- Updated dependencies [b535cb2]
- Updated dependencies [6b297f0]
- Updated dependencies [414ddde]
- Updated dependencies [a575ca9]
- Updated dependencies [3c0d822]
- Updated dependencies [f1cf758]
- Updated dependencies [b9cdc16]
- Updated dependencies [313eea3]
- Updated dependencies [6966a4e]
- Updated dependencies [0b78acc]
  - @graview/react@0.1.1
  - @graview/primitives@0.1.1
  - @graview/core@0.1.1
  - @graview/pages@0.1.1
  - @graview/tools@0.1.1
  - @graview/layout@0.1.1
  - @graview/ship@0.1.1

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

- 862fd42: A district stays a district whatever picture the address names — and the studio stops minting ids in the layout's namespace.
  
  Three things, all found by opening Rota's installation and its studio and looking at what was actually drawn.
  
  **A place is a picture OF a group, not of every group.** The scene handed `in.view=<slug>` to every group it drew, so pressing "Who may do what" and then looking at something else left the slug in the stop, where the PEOPLE district — which is not what you are looking at — drew the policy lens instead of itself: no name, no count, no figure, no way in, just the words "Who may do what · 3 roles" floating where a district used to be. The same thing turned the Shifts card into "The week · 10". The slug now reaches only the group the address focuses, which is what the code's own comment always said it did.
  
  **A lens's glyph is a mark, not a caption.** `ReachView` returned a bare `<span>` at glyph fidelity where every other lens returns a `Chip`.
  
  **`kind:` belongs to the layout.** It is where a district card's id comes from, and the studio minted `kind:rule` for an app's own kind called "rule" — the same string as the RULES district's card. Every app in this repository declares a kind called "rule", so in every one of their studios the edge from a rule to the kind it judges resolved to the district it started from and was drawn as a loop: a dotted circle labelled OVER, saying a rule judges a rule. The studio's kind nodes are `declared:<name>` now, and a test holds the namespace.
  
  Also: the studio's agent can name a new role or kind. "add a new Role for Participant" was not recognised by the graph-native floor — it only matched an act whose title appeared verbatim — so the turn fell through to whatever model was configured, which proposed `add-role` with no label and got a validation refusal. The floor now takes a name from quotes, from "called"/"named"/"for", or from in front of the word itself, asks for one when there is none rather than proposing an act that cannot apply, and says so when the name is already taken.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- 04bfcc3: A lens's binding slots are not roles somebody can hold.
  
  Two different things share the word "role". A policy role is a seat — coordinator, volunteer, viewer. A lens's `requiredRoles` are the binding SLOTS it asks an app to answer with its own fields and kinds — `start`, `end`, `rows`, `columns`, `link`. `declarationToGraph` read both into the studio's `role` kind, so opening the studio on Rota showed a ROLES district of eight, five of which nobody could ever be.
  
  The display was the smaller half. `graphToDeclaration` builds `policy.roles` from those same nodes, so applying the studio handed back a policy declaring eight roles, and the `policy.ts` it writes said `roles: ["coordinator", "volunteer", "viewer", "rows", "columns", "link", "start", "end"]` — a checkout where `permits` would recognise "columns" as a seat a person could be granted. A lens's slots now live on the lens node as a field of its own, and the `requires` edge to `role` is gone.
  
  Fixing the fixture that hid this — a coverage lens declared as requiring "coordinator" — surfaced a second thing: a lens's bindings are carried from the checkout verbatim, because no studio act writes one, so renaming `plot` to `bed` left the coverage grid bound to a kind nothing declares and `graview check` refused the rename with an error about a lens nobody had touched. Bindings now follow a rename the way an act's subject does, and a lens naming something that has been deleted is dropped whole rather than left half-bound — the rule this file already keeps for display labels: what refers to something gone is not preserved, it is meaningless.
- b7f83cc: A migration is data, and the studio writes it. `stepsMigration({ from, to, steps })` in `@graview/ship` turns declared steps — a kind gone or renamed, a field dropped or started, an edge removed or MOVED — into primitives against the stored graph when it opens; a moved edge is carried to the records of its new kind tied to each old end (a gardener who tended a plot tends each planting in it). The studio's `migrationSteps` sees a relation declared on another kind as a move, says it before Apply, and writes it into the app's `defineApp` through the studio door (`add-migration`: the version moved on, the migration appended, its import added), so a stored graph is carried forward, logged and undoable, the next time it opens.
- ccc912a: A proposal is the act's own form, filled in and yours to correct — not a sentence and a button.
  
  One real thread with the studio's agent went wrong in six ways at once, and each one is the same underlying mistake: the seat treated a half-right answer as final.
  
  **A proposal is now the act's own arguments**, drawn from the same `formFields` the actions strip draws — a picker for a kind, a choice for a type, a box for a name — filled with what was proposed and editable before it is kept. The checker re-runs on every edit, so the verdict is about what you are actually about to do, and a change that would add an error cannot be kept. Asked to add a field to Meal and told it would land on "user", a person's only move used to be to argue with a chat and hope. Hoping is not an interface.
  
  **The subject is what the sentence points at.** "Add details to Meal. The name of the food and the number of people it can feed" put a field on USER — the user kind's plural is "People", "people" sits inside "number of people", and six letters beat four. The kind is read from the clause that names it, earliest match first and a kind's own name ahead of its plural; where that clause names no kind at all, the seat says which kinds there are instead of reaching into a description of something else for a subject.
  
  **"Attach Meals to Shifts" is a tie.** The floor did not know it, so the turn fell through to a model, which proposed `add-edge` with no kind and no label and earned a validation refusal in zod's words. The floor proposes the tie now, with a reading from each end — and says out loud which end it decided declares it, because that is a real decision.
  
  **A person never sees the plumbing.** A model that closes one brace too many produced a chat bubble containing `{"say": "Yes", "proposals": [...]}}`: the old fallback pasted the raw answer when `JSON.parse` threw. `firstJsonObject` reads the object the model meant and ignores what it typed after; an answer with no object at all is reported as a shape that could not be read.
  
  **A name is not an id, and a model will hand you a name.** Where exactly one node of a kind an argument accepts carries the label a model used, the label means that node — a lookup, not a guess. Two matches or none, and the value stays as it came for the form to ask about.
  
  Also: a refusal names the argument it is missing rather than quoting zod; a warning shown under a proposal is one the proposal would ADD, not one the declaration already had; and keeping something writes one line, where it used to write the same sentence twice in two voices.
- 7c0e701: A model gets every change to interpret, with the graph's own reading handed up as a starting point.
  
  The ladder had one rule: a grounded answer outranks any model, because a small local model asked who can play left back will fluently invent a goalkeeper. That is right about FACTS and wrong about everything else — and the floor was marking both the same way. A reading of what somebody wants CHANGED came back marked grounded too, so choosing a model changed nothing at all about the turns a model is actually better at. Speaking loosely is the entire point of having one: "add details to Meal, the name of the food and the number of people it can feed" is two fields in one sentence, and a pattern-matcher can only ever see one of them.
  
  So a fact and a reading are now different things. What kinds there are, what an act writes, who may take it, which kinds have no figure, what is broken and what the rules themselves say repairs it — those are facts, and no rung may replace one with a guess about the same fact. Everything that interprets a sentence as a change is a reading: it is the answer when no model is chosen, and when one is, it goes UP to the model as a starting point — keep it, correct it, or split it into the several acts the sentence described. What the model may not do is come back with less: an answer with no proposals never replaces a reading that had them, and a model that cannot be reached falls back to the reading with the reason attached.
  
  The prompt grew the two things it was missing. It listed the acts and never the things, so a model asked to add a field to Meal answered `{"kind": "Meal"}` and hoped — it now sees what is in the graph, by name, bounded per kind (and `resolveProposal` turns whichever name it picks into the id). And it is told plainly that several proposals are welcome, one per distinct change, which is what makes decomposition possible at all.
- b9b0635: A time of day is asked for. An argument whose pattern is a date with a time in it (`YYYY-MM-DDTHH:MM`, the gauntlet's workshop start and a talk's slot) described itself as a plain date, so every face offered a date picker, the picker gave `2026-09-20`, and the act's own pattern refused it: no workshop could be made and no talk given a slot, on either face, at either width, with either hand. The date shape and its form field now carry `time: true` for such a pattern; the routed form, the scene's ask, the edit in place and the studio's agent panel ask with a date-and-time control, and the conversation and the starter fill one with a time of day.
- 959955f: An agent in the studio: ask for a declaration change in words, see it checked, keep or discard it.
  
  Both halves of this already existed and nothing joined them. The studio could take a proposal from an agent seat — `propose`, `proposals`, `decline` — and the chat panel could already turn words into proposals over the ordinary runtime. But the studio itself had no agent in it, so the one surface whose subject is the declaration was the one surface you could not talk to: every change by hand, one act at a time, with the whole shape held in your head.
  
  The studio's bar now carries its own Ask. A turn produces PROPOSED studio acts and stops there — nothing is applied by asking. Each proposal is put through the new `Studio.would`, which applies the call to a copy of the store and checks what the declaration would become, so `graview check`'s findings are read before anyone is asked to keep anything; a change that would add an error is struck through with the finding that condemns it and has no Keep button at all. Keeping calls `studio.propose`: an ordinary op in a batch of its own under the agent's name, with an inverse, so the studio's trail says who proposed it and undo takes it back.
  
  Keyless first, like the rest of the ladder. `studioResponder` reads the meta-graph and answers about the declaration itself — what kinds there are, what an act writes, what a rule judges, who may take it, which kinds have no figure — and fills studio acts from a template: "add a due date to tasks" becomes `add-field` with the type the name implies, optional so records that already exist stay valid; "every shift needs a volunteer" becomes a rule over the shift. A model upgrades it through the same one-function `Completion` seam, with the studio's own floor under it, so a fact the declaration holds is never replaced by a fluent guess about the same fact.
  
  This is also where the `drawFigure` gap lands, recorded honestly when figures shipped: the drawing carried the house style and judged its own answer, and was reachable from code and from `graview figure` and from nowhere a person sits. "Draw a figure for volunteer" now reaches it from the studio, and a figure is finally something a declaration can carry through the studio at all — modelled on the kind, read in, written back, and written into the schema file. Before this, opening the studio on a drawn app and applying would have rubbed every drawing out.
  
  `figureFaults` — the checker's own judgement — now closes the drawing vocabulary: a figure is line art made of drawing elements and drawing attributes, and a `<script>`, an `onload` or a remote `href` is a fault with a name rather than something that passes a style check and is inserted as markup. That is what makes a model's drawing safe to show somebody before they keep it.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- c9c34de: Keeping or discarding the studio agent's offer moves the keyboard on — to the next offer still open, or to the words to ask with — instead of leaving it on `<body>` when the offer turns into a line of what happened.
- 1794980: Nothing a model suggests fails in silence, and proposals that wait for each other stop waiting.
  
  Three holes, each the same shape: the seat knew something the person did not, and said nothing.
  
  **A model that answers with a bare array was thrown away.** Asked for `{"say", "proposals"}`, a model answers with just the array of proposals often enough to matter — the sibling seam on this very contract asks for exactly that shape. Reading from the first `{` found the first PROPOSAL inside the array, returned it as though it were the whole answer, and left the person looking at "…" with a perfectly good list discarded. Whichever bracket opens first is now the value the model meant.
  
  **A model that named an act the app does not have said nothing at all.** `add_field` where the act is `add-field` was dropped by the gate in silence: a sentence with nothing under it, no refusal, no way to tell whether the seat had understood. The gate now reports what it took out and why — an act this app has no such thing for, or one this seat may not run — and says when nothing it suggested can be applied here. Silence is the one answer that cannot be acted on.
  
  **Proposals that depend on each other refused for ever.** Encouraging a model to split a loose sentence makes dependent chains ordinary: "a Meal kind, with a name and how many it feeds" is one act that creates the kind and two that need it to exist. Judged once on arrival, the two fields refused — they named a kind that was not there yet — and keeping the first changed nothing about them, so a person saw two dead proposals under a live one with no sign they were only waiting. Every open proposal is now re-read and re-judged whenever the declaration changes: the name the model used resolves the moment the thing it names exists, an undo puts them back, and the verdict on screen is never about a declaration that has moved on.
- 3e3bfff: One door for what is yours: the scheme, the installation and the studio move behind the profile — and Back knows about both of them.
  
  The bar carried "Show the installation" and "Studio" beside the places, so every reader met two controls only a keeper can use in the same row as the app's own pictures. It also carried a scheme toggle while the profile pane carried a pair of scheme buttons — two controls for one setting. All three live in the profile now, under a heading that hides itself when it holds nothing, and the profile button wears a gear so the settings can be found rather than discovered.
  
  **Both doors are stops.** Showing a module said in its own comment that it was one — "so Back knows the way out" — and it was not: `shown` was missing from the comparison that decides whether a change pushes a history entry, so the address gained `show=installation` and the entry was REPLACED. The arrows stayed grey and one Back from the installation left the app. Opening the studio was component state, so the one door in this interface the back button knew nothing about was the door into the app's own declaration. It is `in.studio=open` now: the browser's arrows and the bar's own carry you in and out, a link can open it, and closing puts you back on the stop you came from. `adjustment` is exported and tested, and `verify-navigation.mjs` drives both doors in a real browser.
  
  Three things had to be true for the move to work. The pane is **mounted whether or not it is open** and hidden instead — a control in it may own something that outlives it, and unmounting the pane on the first press inside the studio took the studio's portal with it. `hidden` alone was not enough, because the pane's own inline `display: grid` beats the browser's `[hidden] { display: none }`, and a closed pane that still swallows presses is worse than one that is merely visible. And a press inside a dialog the pane opened is not a press "away" from it.
  
  Two things the move exposed, both fixed: the seat switcher did not wrap, so in a 280-wide pane the third seat was a name cut in half; and "Your record ↗" was a nineteen-pixel control, which no audit had ever measured because until now no audited screen opened this pane.
- a5d842b: One edge name is one relation. `graview check` refuses `edge-name-shared` when the same edge name is declared on two kinds in different words — `by` on a song ("their songs") and on an album ("their releases") put an artist's songs and releases together under whichever came first, on the card, the record and the captions. Declaring a name from several kinds in the same words stays legal. `edgeAllowed` now judges an edge against the declaring kind's own targets rather than the first declaration's, and `schema.edge(name).to` is every declaration's targets. The studio's grant edge is `allows-on` (it shared `over` with the rule, so a kind's page listed its grants as rules), and the `graview-node-kind` skill names the check.
- d9bfdb8: One seat, one conversation. The app's chat and the studio's declaration seat are the same thread now: `useSeatConversation`, `SeatThread`, `SeatHeader`, `SeatComposer` and `SeatSettings` in `@graview/primitives`, used by both `ChatPanel` and `StudioAgentPanel`. The person in a bubble, the seat in prose with its rung aside set quieter, each proposal settling in place ("✓ …", struck through when discarded, "Refused: …" beside the form it came from), "Apply all" / "Keep all" in order, and the history the model is told includes what was applied. The studio's gear opens the same `LadderSetting` the profile holds; `IntelligenceSettings` is retired. `StudioAgentPanel` takes a `respond` like `ChatPanel` does.
- 8976510: One switch, four rungs — and a rung that says what it cannot do. `IntelligenceConfig.source` is now `"graph" | "local" | "decision" | "remote"`: graph only, onboard AI, Jev, LLM — one setting, live, saved in the person's own browser. The ladder has two axes and `RUNGS` says so: each rung declares the capabilities it serves (`prose`, `decide`, `propose`); a surface asks `rungFor(config, capability)` for a capability and never for a provider; and a capability the chosen rung cannot serve falls down to the graph, which is keyless and always there. `capabilitiesOf(kind)` in `@graview/core` is the same table for declared providers, and `graview describe` reads the ladder out — which rungs the app declares and what each can do, and what the graph answers instead on a rung that cannot.
  
  On the decision rung the chat seat is answered by the graph and SAYS so in the answer itself — "(Jev decides rather than talks — the graph is answering here.)" — as part of `ChatReply.say`, not chrome painted by the panel, so every surface the seat speaks from carries the sentence unchanged. A turn that started on one rung while the person moved to another says which rung answered it rather than finishing silently (`configuredResponder`'s `current` hook, wired in the chat panel and the studio's). `decideFor(config)` is the decision behind a rung for a surface that wants one: the provider exactly on the decision rung (by the person's key, or through the dev server's door), a model behind the full parse-and-refuse layer (`completionDecide`) on a model rung, and nothing on the graph rung — where `graphDecide(store)` answers what the store's own rules already decided and names what it cannot. The picker offers the fourth rung with an optional key; with none, the app's decision door is used.
- 30adc63: The studio's whole path is rehearsed on a real checkout (`pnpm studio:rehearse`: a scratch copy of seedbed, "people should be assigned to plants not plots" said to the seat, kept, rewritten, written, compiled, checked, and a stored garden opened with its caretakers carried onto its plantings) — and what the rehearsal found is fixed. Keep all judges the seat's proposals by what they make together, so "remove the edge, add it to the planting" is not refused for its first half. A name declared more than once is edited where the app exports it, not in a chapter's local copy. The studio door writes the file that declares the app, and so its migration, last, so a dev server reloading between writes never runs a migration against the schema it was not written for. A removal is described before it lands.
- 8a2fdf2: The code a declaration change leaves wrong is rewritten in the studio before anything is written. The studio door reads the checkout's acts and rules (`GET …/source`, `declaredCode`), replaces, adds and removes them in place (`replace-act`, `add-rule`, …), and compiles the app with the edit laid over its files (`typecheckWith`) before a byte lands, refusing with the compiler's own words. `sourceChanges` names each act or rule whose declaration changed, `codeTouched` each one whose code mentions what moved or went, and Apply puts every one of them in front of the person — editable, with "Ask the seat to rewrite it" (`rewriteCode`, the configured model) and "It still holds as written" — writing only once each is settled.
- e0d5026: Studio: the declaration itself as a graph. `@graview/studio` declares a meta-schema with the same `defineNode` an app uses — kinds, fields, edges, acts, rules, roles, grants, lenses and the brand as nodes — so the declaration is a Graview app over itself. `createStudio(app)` reads a declaration into a store; the ordinary acts change it (add-kind, rename-kind, add-field, add-edge, add-act, add-rule, name-repair, add-role, grant, and their removals), each an op with an author, an intent and an inverse; `studio.check()` runs `graview check` on what the declaration would become and `studio.apply()` refuses while it finds errors, otherwise hands back the new app and the migration a stored graph needs (records of a removed kind go, a dropped field is unset, a required field starts). `studio.files()` writes the declaration back as the `src/domain/` files `graview create` writes. An agent seat proposes by acting under its own batch; a person keeps it or `decline`s it, the way any turn of an agent's is undone. `createStudioLens(app)` is a place: what the checker says, judged on every change.
- b7d3209: The keyboard always lands somewhere. When an act removes, disables or hides the control the keyboard was on — Escape closing a menu, a chip's × dropping the selection, Back taking the page away, "Send" while the answer comes — it lands on the nearest thing that still stands where it was, or on the same control when a re-render drew it again (`useTheKeyboardLandsSomewhere`, installed by `Shell` and `<Embed>`). The studio hands the keyboard back to whatever opened it when it closes, and a routed page that replaces another lands it on the new page's heading. Eight walk findings were this one rule broken on eight surfaces; the browser harnesses' watch found it on about forty more.
- 1d121a7: The model path is driven end to end in a real browser, and the keyless rung offers the way out of a sentence it cannot read.
  
  Every test of the model rung stubbed the responder itself, so nothing had ever checked that a provider's answer reaches the panel at all. `verify-studio.mjs` now runs an OpenAI-compatible provider on localhost and drives the shipping path through it: the config, the adapter, the prompt, the gate, the forms. One loose sentence — "add a Meal kind, with the name of the food and how many people it feeds" — comes back as three editable proposals, the two that need the kind say what they are waiting on, and keeping the kind brings them alive with the name the model used resolved to the node it now means.
  
  That harness immediately found the thing that would have made the whole feature pointless. **A sentence that opens with an instruction is not a question.** The branches that answer questions about the declaration recognised them by the words they contained rather than by what the sentence was doing, so "add a Meal kind, with the name of the food and how many people it feeds" — which contains "kind" and "how many" — was answered with an inventory of the kinds, and answered as a FACT, which takes the turn away from the model entirely. The one sentence most in need of a model was the one guaranteed never to reach it.
  
  **And a dead end now has a door.** The keyless rung reads a handful of sentence shapes and says so when a sentence is not one of them, which is honest and, on its own, leaves a person guessing which phrasing a pattern-matcher wants — when the rung that reads any phrasing is one press away behind the gear. An answer it could not read is marked, and where no model is chosen the turn carries "Let a model read it →", which opens the picker. Where one already is, there is nothing to offer and nothing is offered.
  
  Also: a proposal waiting on another says `Waiting on kind "Meal" — keep the one that makes it first`, rather than the store's own `Edge "of" references missing node`.
  
  Not tested, and worth saying plainly: the on-device rung itself. WebGPU is unavailable to a browser launched on this machine, so WebLLM cannot start here — what is verified is that it fails honestly, naming the reason, with the graph answering in its place.
- 8ca3d2e: The studio holds the keyboard while it is open. It took it once when it opened, and the profile's menu closing behind it could take it back and leave it on `<body>` with the studio over everything; as a modal dialog it now brings the keyboard back to itself whenever it lands on nothing while the studio is open.
- daccd55: The studio is a place on the bar. `<StudioPlace app={...} />` opens the running app's own declaration — kinds, fields, edges, acts, rules, roles and grants as districts, "What the checker says" as a place, the ordinary acts to change them, the studio's own history and undo, and an agent seat that proposes a repair for a rule that names none. Applying runs `graview check`, refuses on errors naming them, and otherwise offers the files `graview create` writes as downloads. Offered to the seat that administers where an app declares something administered, and to whoever is here where it does not — so a scaffolded project has it on day one. `Shell` takes it as a slot (the studio already depends on the shell's primitives); the embed strip takes it boxed, so a studio cannot escape onto somebody else's page.
  
  `ArgShape` gains `{ type: "boolean" }`. Without it "Add a field", whose `required` is a plain boolean, was derived NOWHERE — the studio's central act, in the studio, unreachable because nothing could ask one question. The strip asks it as two buttons rather than a text field somebody has to know to type "true" into.
  
  And what the studio does not model, it no longer destroys: a kind's `display.labels`, `display.hide`, `fixed` and `fieldRoles` are carried from the checkout through both the declaration and the written schema, narrowed to the fields that still exist. A `display.format` is a function and cannot be written; the file says so where it finds one, and `WrittenFile.kept` names it, instead of losing it silently.
- dfb6120: The studio keeps a rule's repair that names an act the framework derives. `edit-<kind>` and `remove-<kind>` have no act node for a `repairs` edge to point at, so the round trip dropped them — a rule repaired through the derived edit came back with no repairs, in the files and in the applied app. They are kept on the rule by name (`derivedRepairs`) and written back with the rest.
- e5e43e8: The studio keeps a name built from fields, and a refusal's words. A kind named by a function of its fields — a vehicle's "2027 Subaru Forester Sport" from its year, make and model — lost its `label` in the app the studio applied, so every card became an id, and the written file dropped it without a word; the applied app now carries the checkout's function, and the file says loudly that it must be carried over and lists it in `kept`. A string check's message — `.regex(/…/, "a 17-character VIN")`, `.min(1, "…")` — is written back with it, rather than leaving a person refused with "Invalid string".
- 6520856: The studio writes a checkout back as it found it. A field the graph still reads the same way keeps the checkout's own schema — `.max(60)`, `.int().min(1).max(99)`, `isoDate`, `nodeRef` — in the files and in the app `apply()` returns, so a round trip no longer raises `label-unbounded` or validates less than before; `z` is imported from `@graview/core`, not "zod"; and an act the checkout wrote keeps its own input, with its history sentence marked as the checkout's to supply, like its body. The `graview-studio` skill's examples address `declared:plot`, the id the studio actually uses.
- be9fb19: The studio writes a declaration change into the checkout, in place. `studioDoor()` from `@graview/ship/dev` is a dev-server door (contract `STUDIO_DOOR_PATH`, `DeclarationChange` in `@graview/core`) that takes the CHANGE — a kind, field or edge added, changed, removed or moved, a kind's description, plural or figure — and makes it inside the checkout's own `defineNode` calls with `editDeclaration`, leaving every comment, function and body it does not touch exactly where it was; all or nothing, and only ever the files in its own `src/domain`. `studio.sourceChanges()` says the change that way, and what it cannot say yet (acts, rules, policy, a migration) as reasons; Apply writes through the door when it answers and hands over the files, with the reasons, when it does not. `graview create` projects open the door in development. `@graview/ship`'s doors share `door.ts`: who may knock, how much they may send, the plugin's shape.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
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
- Updated dependencies [daccd55]
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
  - @graview/ship@0.1.0
