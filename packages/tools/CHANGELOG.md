# @graview/tools

## 0.1.17

### Patch Changes

- Updated dependencies [cc690c4]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
  - @graview/core@0.1.17
  - @graview/ship@0.1.17

## 0.1.16

### Patch Changes

- 9eaa3c9: The framework spells in American English. The code, the sentences it says to a person and to a model, the comments, the docs, the skills and the test names had drifted into British spelling in some four hundred files, so one thing had two names, and an export spelled one way was an import a stranger got wrong the other way. Every one is now American: color, center, behavior, judgment, labeled, canceled, catalog, gray, normalize, and the rest of their kind. What the platform and third parties own keeps their spelling: `aria-labelledby`, the status Google Calendar gives a deleted event and MCP's `notifications/cancelled`. Published changelogs and Graview Cloud's documents among the test fixtures are kept as written. A test at the root, `tests/the-repo-spells-in-american-english.test.ts`, reads every tracked source, doc, skill and changeset for the British forms and names the file and line of any it finds, so the drift does not come back.
  
  Compatibility: renamed outright, with no aliases. `@graview/core` exports `normalize` (was `normalise`), `summarize` (was `summarise`), `humanizeField` (was `humaniseField`), `colorsIn` (was `coloursIn`) and `connectorHueColor` (was `connectorHueColour`). `@graview/primitives` exports `humanize` (was `humanise`). `@graview/react` and `@graview/react/provider` export `honorSetting` (was `honourSetting`). In the declaration, a setting says `honored` (was `honoured`), a brand's connector kit says `color` (was `colour`, in `brand.kit.connectors.all` and `byEdge`), as does a `checkKitContrast` finding, and an invariant written in the rule language carries `judgment` (was `judgement`). Two check finding codes are renamed: `kit-color-unreadable` (was `kit-colour-unreadable`) and `setting-not-honorable` (was `setting-not-honourable`). The scene's CSS custom property `--graview-center-y` was `--graview-centre-y`. Sentences said to a person or a model that used a British form now use the American one. Ops, stored formats, the document format, wire messages and tool names and schemas are unchanged.
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
  - @graview/ship@0.1.16

## 0.1.15

### Patch Changes

- 6a5fb11: A rule's refusal says so (FR-119). From Graview Cloud: `ActRefusal`'s reason defaulted to `invalid`, and an `allowedWhen` refusal ("{name} is already resolved") kept that default — the same reason as "Nothing to change" — so a host could not tell "the rules say no" from "you sent the wrong thing", and Cloud said "refused" for both. `REFUSAL_REASONS` gains a sixth code, `refused`: an act's own rule said no to a call that was well formed. A document act's `allowedWhen` refuses with it, with its `refusal` sentence or without one, and so does a condition or a value its rule language could not work out; `ActRefusal`'s reason is `refused` unless it names another, so a TypeScript mutation says its rule's no with `throw new ActRefusal(sentence)`. `invalid` stays for the call as sent: its arguments, a call that changes nothing (`edit-person { id }`), a subject of the wrong kind; a bare `Error` from a mutation stays `invalid`, since nothing can tell a rule from a slip. `refusalOf` reads it; the live socket's `refused`, `POST /graview/ops` and `openRemote`'s `onRefusal` and `RemoteRefusedError` carry it unchanged; an agent tool's refused answer now says `reason` (and `wouldNeed`) beside its `error`, and the MCP adapter and `graview mcp` say both as `structuredContent`. A status board still offers no move a step's condition refuses, and a preview refuses as the apply does. The agent-seat skill says to branch on the reason. The pages face's budget rises from 488,000 to 488,500 bytes minified, since the page's agent runtime now reads a refusal with `refusalOf` (about 0.5 kB).
  
  Compatibility: additive on the wire — a new refusal code within protocol 1, so `WIRE_PROTOCOL` does not move; a client that predates `refused` treats it as it treats every code but `unavailable`, final and taken back. Breaking for a program that matched `invalid` to catch a document act's `allowedWhen` refusal, or a TypeScript mutation's `ActRefusal` that named no reason: both now say `refused`. `ToolResult`'s failure gains optional `reason` and `wouldNeed`, and `McpToolResult` optional `structuredContent`. `capabilities().shipped` gains FR-119.
- Updated dependencies [817082f]
- Updated dependencies [d4fb72e]
- Updated dependencies [6a5fb11]
- Updated dependencies [a8b8153]
- Updated dependencies [fffebfd]
- Updated dependencies [efab5b2]
- Updated dependencies [9fc2bd8]
  - @graview/core@0.1.15
  - @graview/ship@0.1.15

## 0.1.14

### Patch Changes

- 05b0a95: A hosted page has room again: Cloud's hosted page loads 555.0 KB up front, where this round's features had brought it to 570.0 KB, and its budget comes down from 572 KB to 563 KB. Graview Cloud holds its shell to 595 KB with about 25 KB of its own, so the framework's page has to stay near 565 KB for Cloud to have any room; Cloud's shell built from these sources measures 554 KB, where it measured 569. Nothing a reader sees changed. A bundler gives a whole file to a page's first chunk when the first chunk can reach it and any chunk uses it, and the frame of every face reached, through the entries it imports up front, files that only a drawn view uses. Those now have entries of their own, fetched with the face that draws them. `@graview/react/drawing` holds the measured text, the kit's connector, the boundary a view draws inside, the sets a view lights and dims by, the fields edited in place, the others placed on a picture and the attention a seat pipes in (React 6.1 KB smaller up front, and `@graview/render` no longer up front at all). `@graview/tools/edit` holds the fields a record lets a reader change, and the reader's pins left `@graview/tools/frame` (tools 1.7 KB). A label's fit left `@graview/layout/view`, which keeps only the estimate of a line's width (layout 1.6 KB). The arranging of a list is `@graview/core/arrange`'s (core 4.0 KB). And the assistant fetches the describer when a place is first asked about, not with its seat, so the pages face alone loads 475.8 KB first, where it loaded 488.7. The bundle budgets come down where they shrank: the pages face alone to 488 000 / 166 000 bytes, the embed without the studio to 682 500 / 173 500, and the embed with the studio handed in to 1 472 000 / 436 500.
  
  Compatibility: the arrangement's functions moved from `@graview/core` to `@graview/core/arrange`: `arrange`, `arrangeable`, `arrangeAllows`, `admitArrangement`, `asksForThePast`, `bucketStart`, `conditionHolds`, `edgesOf`, `formatArrangement`, `matches`, `NO_ARRANGEMENT` and `parseArrangement`. Their types stay on `@graview/core`. `useActivity`, `useAttention`, `useDrawnSize`, `useTextMeasure`, `useEditableFields`, `useFlagged`, `useImplicated`, `useReached`, `NOTHING_FOUND`, `useKit`, `kitConnector`, `ViewBoundary`, `anchorOf`, `placeOthers` and `AUDIENCE_ROW` moved from `@graview/react/provider` to `@graview/react/drawing`, and all of them are still on `@graview/react`. `editableFields`, `loadPins`, `savePins`, `togglePin` and `NO_PINS` are no longer on `@graview/tools/frame`: `editableFields` is on `@graview/tools/edit`, and all of them are still on `@graview/tools`. `fitLabel`, `areaOf`, `boxOf`, `centroidOf`, `overlaps` and `spanAt` are no longer on `@graview/layout/view` and are still on `@graview/layout`. `@graview/core/arrange`, `@graview/react/drawing` and `@graview/tools/edit` are new entries, and a linked project's vite config aliases each of them. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [f842422]
- Updated dependencies [fc42f1e]
- Updated dependencies [860223c]
- Updated dependencies [1e7eba5]
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
  - @graview/ship@0.1.14

## 0.1.13

### Patch Changes

- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/ship@0.1.13

## 0.1.12

### Patch Changes

- 4801c44: What only a fetched face, an agent's seat or the checker uses has left `@graview/core`'s main entry and `@graview/core/document` for subpaths named for what they hold, and the hosted page has room again. A hosted page imports both barrels up front. esbuild gives a whole file to every chunk that can reach it, so a name a barrel re-exported rode in the page's first chunk as soon as any lazily loaded face used it, though the page never called it before a reader acted. Measured from esbuild's metafile, three moves were each worth more than 2 KB. The first is `@graview/core/blocks`: a view's blocks resolved against a record, and the computed values they read. It took 8.3 KB off. The second is `@graview/core/check` with `@graview/core/scene`. The checker was reachable from both barrels: `checkApp` from the main entry, and `compileDocument` beside the compiler a page uses. Through it the page reached the city, which only the scene draws. The checked compile and template instantiation are now modules of their own, so the compiler a page uses no longer imports the checker. This took 2.6 KB off. The third is `@graview/core/figures`, the shipped drawings, which took 2.8 KB off. The page now loads 575 357 bytes up front (562 KB), where it loaded 589 079 (575 KB). Cloud's own shell, built from these sources, is 560.3 KB, where it was 573.7. The budget claim is now 572 KB: the new figure with 10 KB of headroom. The embed without the studio now loads 692 174 bytes first, where it loaded 787 572. The studio, fetched only when it is drawn, asked for `checkApp` through `@graview/core`, so the checker and the document compiler it reaches rode in the frame's first chunk. Its budget comes down to 693 500. A test names every moved export and holds it off both barrels, and the hosted page's test holds the modules themselves out of what it loads first. Some levers were measured and left alone because each was under 2 KB: `formFields` and the rest of the act form (1.8 KB), `beginning` (1.7 KB), the JSON Schema helpers (1.3 KB) and `walkKinds` (0.3 KB). zod's JSON Schema writer (20 KB) stays up front. `zod/mini`, which the page needs, re-exports `toJSONSchema`, so no subpath of ours can put it out of the page's reach while the companion's act tools use it.
  
  Compatibility: these exports moved, with no alias left behind. From `@graview/core` to `@graview/core/check`: `checkApp`, `formatFindings`, `describeApp`, `generateAgentsMd`, `generateLlmsTxt`, and the types `CheckResult`, `Finding` (the checker's), `Severity` and `DescribeOptions`. From `@graview/core/document` to `@graview/core/check`: `compileDocument` and `instantiateTemplate`. `compileDocumentWithoutCheck` stays in `@graview/core/document`. From `@graview/core/document` to `@graview/core/blocks`: `compileBlocks`, `fieldSpecsOf`, `isTallBlock`, `resolveBlocks`, `safeHref`, `sayNumber`, `computedNames`, `computedValues`, `withComputed`, and the types `BlockContext`, `ResolvedBlock`, `ResolvedList`, `SpecBlock`, `ComputedRecord`, `ComputedValues` and `PlainComputed`. From `@graview/core` to `@graview/core/scene`: `BLOCK`, `cityExtent`, `cityMap`, `heightOf`, `MAX_SIDE`, `plotsOverlap`, `roadsOf`, `sharedEdges`, `sideFor`, `toIso`, `villageCap`, `villageOf`, `sceneDistricts`, and the types `Building`, `CityHints`, `CityMap`, `Plot`, `Road`, `SceneDistrict` and `SceneDistrictOptions`. From `@graview/core/document` to `@graview/core/scene`: `sceneThumbnail`, and the types `SceneThumbnailOptions` and `ThumbnailSource`. From `@graview/core` to `@graview/core/figures`: `FIGURES`, `FIGURE_NAMES`, `figureBrief`, `figureFaults`, `figureSvg`, and the type `Figure`. `@graview/primitives` still re-exports `compileBlocks`, `safeHref`, `sayNumber` and `SpecBlock`. A project made by `graview create` imports `checkApp` and `compileDocument` from `@graview/core/check`, and a linked one aliases the four new subpaths. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [4801c44]
  - @graview/core@0.1.12
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
  - @graview/ship@0.1.11

## 0.1.10

### Patch Changes

- 6809372: A place is described without a browser (FR-89). `describePlace(store, principal, place, { app, width })`, from the new entry `@graview/core/describe`, says what one place shows one seat. The place is `"home"`, a `placesOf` slug, or a record's id. The description gives its headings, its figures as drawn ("$21,000"), its lists with each record's title and what that record's card or row says, the headings a list is grouped under, what an empty list says, and every block that could not be worked out, at its path (`views.home.3`, `lenses.1.options.blocks.0`). It comes back as structured data and as plain text. It reads the seat's own graph (`store.seenBy`), so a partner is told of exactly the offers the partner's face lists. It has an entry of its own because a page imports `@graview/core/document` up front and a bundler places a module by what can reach it; only an agent's seat reaches `@graview/core/describe`, so a hosted page carries 593 KB up front (606,889 B, under its 600 KB budget). It is not a second renderer. What a block says is now worked out once, in core, by `resolveBlocks`, and `@graview/primitives`' `SpecBlocks`, `SpecPlace` and the list, card and row specs only draw what it resolved. `compileBlocks`, `safeHref` and `sayNumber` move to `@graview/core/document`, and primitives re-exports them. A unit test draws the LifeLogics front page and its four lenses at 390 for an owner and for the delivery partner, and holds the drawn words, the listed records and their order equal to the description's. A kind without a card spec is said as the default card (title and glance), and one without a row spec by its title. A shipped picture lens is said as what it is over and the records it draws. Width changes layout, not content, today, and the description says which: `variant` is `"phone"` under 640 and a card list's `columns` is one at 390. The agent surface gains `describe_place`, read-only and seat-scoped, served by `graview mcp`. It counts the records it names as reads. Hand the runtime the app (`createToolRuntime(store, { app })`, `createMcpHttpHandler({ app })`); without one it still says a kind's list, a record and the derived home. `graview describe <entry> --place <slug|id> [--seed <snapshot.json>] [--width <px>] [--as <role>] [--id <who>]` prints the same text. A rename now leaves a field's own `label` as written ("List price, per unit" had become "Price price, per unit"). A LifeLogics test renames `offer` to `item` and `list` to `price`, and every place, for both seats, then says exactly what it said before. A linked project made by `graview create` aliases the new entry. The `graview-agent-seat` skill says when to ask. `capabilities().shipped` names FR-89.
  
  Compatibility: derived tool names and input schemas gain one read tool, `describe_place`, for every seat. A host that compares `surfaceHash` sees the surface move once. No act's tool changes. The declaration and check finding codes are unchanged: `resolveBlocks` is a new export of `@graview/core/document`, `@graview/core/describe` is a new entry in core's `exports`, and a field's `label` is no longer rewritten by `rename-field`. The wire: `capabilities().shipped` gains `FR-89`. Ops and stored formats are unchanged. `ToolRuntimeOptions` and `McpHttpOptions` gain an optional `app`, and primitives' `SpecContext` now extends core's `BlockContext`, which adds an optional `schema`.
- 7307a0c: The rule language computes what pages need, still total and budgeted (FR-83). LifeLogics draws its proposal in code: a package's price is the sum of list × units over its offers less the client's discount, the package it leads with is the recommended one else the top by standing and then price, and an offer's card says "Answers three of the things we heard". A chat could say none of it as data: `sum(S, field)` took a field's name and not an expression, nothing picked one record or put a set in order, a value that depended on another record could not be named once, and a template had no number words and no way to join a list.
  
  `sum`, `min` and `max` now take an expression per member, read with the member as its subject: `sum(out('includes'), list * units)`; a bare or quoted field name still names a field. `sort(S, key, 'asc' | 'desc')` puts a set in order (`'asc'` when unsaid) by a key each member gives. A list key sorts by its first value and then its next, nothing sorts last whichever way, and keys that cannot be compared are a sentence. `first(S)` is a set's first record, or nothing, so `first(sort(…))` picks one. `either(a, b, …)` is the first that is something, which is how an expression says "else". A sort pays for its keys and its comparisons from the budget before it makes them.
  
  A kind declares values it works out rather than stores: `computed: { net: "<expr>" }` on a document's kind (or `{ expr, label?, description? }`), and `defineNode({ computed })` in TypeScript (`ComputedField`). Every expression reads one like a stored field, so templates, view specs (a `field` block shows one, under its label), rules, sums and sorts do too. A computed field may read another. Each is worked out once per evaluation, from that evaluation's budget, so one read inside a template spends the template's 500 steps. Its own expression sees the record's fields and never an act's arguments. A cycle the check cannot see, across kinds through a relation, stops as a sentence ("depends on itself") when it is read. A computed field is never stored, never in the op log and never writable. No derived edit or act tool takes one, and an act that sets one is refused as `computed-written`. `computedValues(schema, graph, node)` in `@graview/core/document` says a record's computed values as plain data, a record named by one as `{ id, kind, label }`, and the ones it could not work out with why. `withComputed` lays them beside the stored fields for a surface that shows facts. A record's page lists them among its facts (`recordFacts`). `get_node` returns them as `computed`, marked as their authors' words, and its description says they are read-only. `graview describe` lists them under "Worked out" with their expressions. `toDocument` writes a declared kind's computed fields back as data.
  
  What a seat is served is worked out from what it may see (FR-55). A computed value is evaluated on demand over the graph the reader holds, and every seat reads through `store.seenBy(principal)`: the provider, the pages, `get_node`. So a hidden record adds nothing to a sum, wins no sort and is never the record a value names. A partner who may not see the client is served a package's price before the client's discount and learns nothing of the discount from it.
  
  `graview check` judges computed fields in a document and a declaration alike. It reports a name that is already a field or relation (`computed-clash`), one that is not a name (`computed-name`), an expression that does not parse or names nothing the kind has (`expression`, `computed-name`, `computed-edge`, `computed-kind`, `unknown-function`), and a cycle among a kind's computed fields, named in order (`computed-cycle`). It also says how a read's work grows with the graph, as a power of its size: a sweep read once for each member of a sweep is a warning, and work that grows with the cube is refused (`computed-cost`).
  
  Templates gain three formatters: `words` spells a whole number to ninety-nine ("three", "forty-five"); `and` joins a set or a list ("Workshop, Build and Advice"); and `plural: 'offer'` is the noun for a count, with the plural given where English does not make it (`plural: 'person', 'people'`). A formatter is read after the last bar outside quotes, so `{'a|b'}` and `{x || y}` are expressions again. A record in a sentence is called by its name, title or label, before its id.
  
  A test builds a document shaped like LifeLogics' (`packages/core/tests/document/fixtures/proposal.gdd.json`): parties, notes, offers with list and units answering notes, packages including offers, recommended and standing. A package's `net` is one declared expression, the package the client is led with is one declared expression, and the offer card's "Answers three of the five things we heard" is one template. They are judged by a rule, sorted on, summed across a relation and drawn on a card. The partner's card, record page and `get_node` are each worked out without the client's discount and without the client. A cost greater than the cube is refused at check time, and at run time a computed field over 3,000 offers stops within its budget, as a sentence. The `graview-invariant`, `graview-node-kind` and `graview-pages` skills say how. The embed's budgets rise by about 13 kB minified and 5 kB gzipped for it. `capabilities().shipped` names FR-83.
  
  Compatibility: the declaration — additive within `graview-document@1`: `kinds.<kind>.computed` and `defineNode({ computed })` are optional, and no document or declaration that compiled stops compiling or changes meaning; the new check codes (`computed-*`) appear only on a declaration that declares computed fields. The rule language gains `first`, `sort` and `either`, and `sum`/`min`/`max` accept an expression where a field name was required; every expression that parsed before means what it meant. Tool schemas — `get_node`'s description changes for every declaration (it says computed values are read-only) and its answer gains `computed` and `uncomputed` when a kind declares them; no input schema moves. The wire — additive: `capabilities().shipped` gains `FR-83`. Ops and stored formats are unchanged.
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
  - @graview/ship@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8
  - @graview/ship@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/ship@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/ship@0.1.6

## 0.1.5

### Patch Changes

- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
- e22a00d: The framework builds its own schemas in zod/mini, so a page that compiles a document carries 54 KB of zod rather than 188 KB. A hosted page — Graview Cloud's shell, `openRemote` and the embed over a document compiled in the browser — loaded classic zod whole, because the framework built the document format, a compiled document's fields and acts, and the derived edit and remove acts with the classic `z`, whose methods reach every other schema type; a bundler cannot cut any of it. Now those are built with zod/mini, the same zod with functions in place of methods, from the one copy a product already resolves, and the framework reads every schema through `_zod.def` and zod's registry rather than classic's `_def` and `.description`, so a classic schema a product wrote and a mini one the framework built read alike: the forms, the tool schemas, node references and descriptions are what they were. zod/mini carries no messages until a locale is set, so core sets English where nobody has chosen one, as classic does, and a document's findings say what they said. `refTo(kinds)` is `nodeRef` in mini, for the framework's own acts; `nodeRef` stays classic for a product to chain on.
  
  Compatibility: the declaration and derived tool schemas — unchanged in meaning. A compiled document's field and act schemas, and the derived `edit-<kind>` and `remove-<kind>` inputs, are zod/mini schemas: they parse, describe themselves and convert to JSON Schema as before, and have no classic methods (`.optional()`, `.extend()`, `.describe()`) to call on them — use zod's functions, `z.optional(schema)`, or read them with `defOf` and `descriptionOf`, new exports of `@graview/core`. `toJsonSchema`, `mutationToolSchema`, `nodeRefArgs` and `takesAnId` take any schema rather than a classic `ZodType`. Finding codes and messages, derived tool names and input schemas, ops, stored formats and the wire are unchanged.
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
  - @graview/ship@0.1.5

## 0.1.4

### Patch Changes

- 833e390: An agent that only reads is in the room too. A store handler announced an agent seat when an op of its landed, so "Claude, for Ada" showed while it changed things and not at all while it read, which is most of what it does over MCP. `createMcpHttpHandler` takes `onCall`, told every tool call before it is answered — the caller, the tool, its arguments, whether the tool only reads, and the request — read-only calls included; it observes and cannot refuse, so what it answers or throws is ignored and the call is answered either way. `initialize` and `tools/list` are not calls. A store handler, and `serveStore`'s answer, carry `onCall`, the hook to hand it: `createMcpHttpHandler({ store: () => handler.store, authenticate, onCall: handler.onCall, … })` announces the calling agent as an op of its would — an agent seat only, for `announceAgents`' time and never when that is `false`, not when the agent holds a socket of its own, and for whom only to a seat that may see the person. An act after a read still stands the agent over what it wrote. `McpCall` is exported from `@graview/tools`.
  
  Compatibility: the wire — additive. `StoreHandler` and `ServedStore` gain `onCall`; `McpHttpOptions` gains an optional `onCall`, and `McpCall` is a new type. No route, field or message changes, and a host that hands no hook announces exactly what it did. Ops, stored formats, derived tool names and schemas, and check codes are unchanged.
- 53857e9: **Security.** A refusal no longer tells a seat whether a hidden record exists (FR-55). Ids are minted from labels, so a seat can guess one, and a call naming a hidden record was refused `forbidden`, "names a record you may not see", while one naming a record that was never there came back `invalid` ("there is no record …", in a document's app) or `missing` in the act's own words: a planner calling set-quote on `vendor:the-barn` learned whether the barn was real. Both are now refused alike, by the store, just before the call runs: a `MissingRecordError` saying "“Set the quote” names a record that is not there." — the act, never the id — reason `missing`, on the socket's `refused`, a 409 from `POST /graview/ops` and an agent tool's answer. Permission is asked of such a call as if the record were not there (its kind is not read aloud), a stale-write check does not offer a conflict over it, the agent tools' `preview_mutation` refuses it the same way, and a module turned off no longer refuses a seat's call as `forbidden` for naming one of its records, since that seat may not see them. `Store.missingFor(call, principal)` is that judgement, for a surface that asks before it acts. A record made earlier in the same gesture is there for a later call. The host's own seat sees what it keeps and is judged as before.
  
  Compatibility: refusal reasons (the wire and live protocols) — `REFUSAL_REASONS` is unchanged, and `missing` keeps its meaning, "what the call names is not there", now for this seat. A call naming a record the seat may not see is refused `missing` with "“<act>” names a record that is not there." where it was `forbidden` with "Not permitted: “<act>” names a record you may not see."; a call naming a record that does not exist is refused `missing` with that sentence where a document's app said `invalid` and an act's own words. `Store.missingFor` is new. Ops, stored formats, derived tools and check codes are unchanged.
- f923330: **Security.** A seat is never served the id of a record it may not see (FR-55). `seenBy` and `logSeenBy` dropped the records a seat's sight does not reach and left their ids wherever else they stood: in a seen record's field (`ref: "secret:s1"`) and in a withheld op's primitives (`after: { ref: "secret:s1" }`). An id is minted from a label, so it told the seat the hidden record's name — on every surface built on the seat view: `graview serve`, `createStoreHandler`, `liveProtocol` and `createMcpHttpHandler`. Graview Cloud found it; its oracle-based property test, ported, now holds over 1,000 random worlds each against `seenBy` and `logSeenBy`, the live wire's messages and the HTTP routes, and the agent tools' answers: no string that is an unseen record's id is in anything the seat is sent.
  
  The rule. A seen record whose field names a hidden one is served with that field CLEARED, so the record stays usable, when its kind declares the field optional (or does not declare it). When the field is required, clearing it would serve a record that fails its own declaration, and a client refuses to load that — so the record is WITHHELD from that seat whole, as if its sight did not reach it: not in the graph, the snapshot or an edge, and every op that touched it withheld. Which ids a field names is judged by the seat's sight alone. An op is withheld when it names a hidden id anywhere — its call, its sentence, its author, a primitive's values, its inverse — and a withheld op keeps only the primitives about records the seat is served: an added record as the seat is served it, a patch that wrote a hidden id into an optional field as that field cleared (`UNSET`, so the seat's copy matches its snapshot), and none that would need a required field cleared. `seenBy(...).violations()` and `findings()` leave out what names a hidden record, repairs included.
  
  `seatLens(store, principal)` is that judgement — `sees` (the sight), `shows` (served), `served(record)` — and `seenBy`, `logSeenBy`, `redact`, the live wire, the routes and the store's own undo check read it. `answerSeenBy(store, principal, answer)` tells a seat what its own act, preview or undo did, as it may be told it: the agent tools' `diff`, `introduces`, `resolves` and undo answers come through it, and their untrusted-words marking reads the seat's own log. `/graview/health` is answered the same way: `ok` and every count stay the whole store's — a service polling a tenant asks whether the store is well, a count names no record, and a count of only what the asker sees would call a broken store well — while `danglingEdges` names only the links whose ends the asking seat may be told of. Health is the one route a stranger gets, so a caller the host cannot tell is judged as a seat with no id and no roles, and a store with sights names it no link. `health(store, { seat })` takes the seat to answer. `namesUnseen` and the `SeatLens` type are exported; `redact` and `withhold` take a lens or a bare sight, which serves a record whole or not at all.
  
  Compatibility: the wire and live protocols — narrowing, no field added or removed, `WIRE_PROTOCOL` unchanged. A seat with sights is now sent a seen record without any field whose value names a record it may not see (or not sent the record at all when that field is required), and ops that named such a record anywhere arrive withheld, with their primitives cut to what it is served; a seat with nothing kept from it is sent exactly what it was. `/graview/health`'s `danglingEdges` lists only links the asker may be told of (none, to a stranger, on a store with sights); its `ok` and counts are unchanged. The agent tools answer the same narrowing. Ops, stored formats, derived tool names and schemas, and check codes are unchanged.
- 936814b: **Security.** A seat can no longer test whether a hidden record exists by writing its id (FR-55). Ids are minted from labels, so they can be guessed: an editor who may see vendors but not categories added a vendor whose category was `category:venue`, and when the venue existed the seat view cleared that field — or withheld the editor's own new vendor, the field being required — while `category:nothing-here` came back as written. A seat is now served its own words: a field whose current value this seat's principal wrote, or the person an agent acts for, is served as written whatever it names, and a record withheld only for such a field is served; so is the seat's own call in its own ops. Who wrote each field's value is an index kept as the log goes (`writersOf`, beside `recordsOf`), and an undo is never the author of what it puts back — the words are whoever's they were before the op it takes back. A write of the value a field already holds is kept in the log as the seat's when that value names a record the seat may not see, since an act that wrote nothing would tell it the guess was the hidden value. Everything a seat did not write keeps FR-55's rule, and the served log still folds to the served snapshot, from any moment, because each moment is judged by who had written what then. The agent tools' answers judge each side of a change as who wrote it then: the words a change replaced are somebody else's. Cloud's acceptance oracle needs the same exception: the strings a seat itself wrote are not counted as leaks in what it is served.
  
  Compatibility: the wire and live protocols — widening within FR-55, no field added or removed. A seat is now served, as written, any field whose current value it wrote, and a record withheld only for such a field; its own ops whose call named a record it may not see are served whole. A no-op write by a seat of a value naming what it may not see now appears in the log as an op. `SeatLens` gains `servedWith` and `actor`; `writersOf` is new. Stored formats, derived tools and check codes are unchanged.
- 0183340: A tool's schema does not depend on zod's minor version. An agent tool's input schema is a stability surface, and zod writes its own regex for a string format — `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.iso.date()` — beside the format's name. That regex differs between zod 4.4.3, which this repository locked, and 4.6.5, which a consumer resolves from the published ranges, so Cloud's tool-schema snapshot saw sixteen "inputSchema changed" entries that were only zod's regex. `toJsonSchema`, and with it `mutationToolSchema`, `nodeJsonSchema`, `schemaJson` and the conformance kit's tools, now says a format string by its JSON-schema `format` alone (`email`, `uri`, `uuid`, `date-time`, `date` …) and drops zod's `pattern`; a pattern the author wrote with `.regex(…)` is kept, beside the format where there is one. Moving the workspace to zod 4.6.5 found a second dependence on zod's internals: zod 4.6 no longer fills a schema's `_zod.bag` as it builds it, so `describeArg` lost a number's bounds and a date's pattern, and a date argument was asked for as free text. It now reads the checks on the definition, which both versions keep. Every package's zod range is now `^4.6.5`, so the tests run on what a consumer gets.
  
  Compatibility: tool input schemas — a format-based string no longer carries zod's regex `pattern`, only its `format` (an `email` property is `{ "type": "string", "format": "email" }`); a `z.url()` property is unchanged, and an author-written pattern is kept. A snapshot of a tool surface taken with either zod version changes once, for those properties only, and then holds across zod minors. The conformance kit's recorded fixtures are unchanged: none declares a format string, and the lock holds. `describeArg` and `argShape` answer as they did on zod 4.4 for every schema, now on 4.6 too. Every package's `zod` dependency moves from `^4.4.3` to `^4.6.5` (products never install zod; `@graview/core` re-exports it). The embed's bundle budgets rise with zod 4.6, which gives every schema type its own JSON-schema processor: the pages face alone from 815,000 / 220,000 to 950,000 / 252,000 bytes and every face from 1,150,000 / 330,000 to 1,290,000 / 362,000 (minified / gzipped), about 130 kB / 30 kB of zod's that a host on zod 4.6 was already paying. The document format, ops, stored formats, the wire and check codes are unchanged.
- dee1fb2: **Security.** An act's sentence no longer tells its author whether a hidden record exists (FR-55). `describe(args, graph)` read the whole store, so a seat that pointed a record it sees at a guessed id was told "Point the barn at Venue" when the venue existed and was hidden from it, and "Point the barn at category:x" when it did not. A sighted author's act is now worded from the store as that author is served it — in `apply` and in `preview(call, context, { author })`, which the agent tools' `preview_mutation` passes — so a record the author may not see is named only by what the author wrote, exactly as one that does not exist. A reader who may see more reads the author's sentence as the author would have, which is what the author meant. Three more differences by existence went with it: an answer's and a served op's `reads` leave out an id that names no record, as they leave out a hidden one; a write of the value a field already holds, naming what the seat may not see, is kept in a preview as it is when applied; and an agent tool's diff says that write as a change to the seat's view of the record. With no sights, nothing changes.
  
  Compatibility: ops and the wire — an op's sentence is worded from its author's view: for an author with sights, `intent` names a record the author may not see by the argument it gave rather than by the record's label. `reads` on what a seat with sights is served name only records it sees. `Store.preview` takes an optional third argument, `{ author }`. Stored formats, derived tools and check codes are unchanged.
- 062fe46: Four types now say what the code already accepts, found when every package's tests began to be typechecked. A lens role may be bound to a field and the values that make it true — `{ field: "status", is: ["done"] }`, the shape `lifecycle` reads a state in — which the checker and the calendar lens always read, but `LensDeclaration.bindings` refused. `withViews` keeps the app's schema (`<S>(app: GraviewApp<S>, …) => GraviewApp<S>`) instead of widening it to one a typed app is not. `instructionsFor` takes anything with a `name`, the only thing it reads. And a live `welcome`'s `state.snapshot` is typed a `GraphSnapshot`, which it always was, rather than `unknown`.
  
  Compatibility: types only, and each one wider or more exact than before: nothing that compiled stops compiling, and nothing at run time changes. The wire, `WIRE_PROTOCOL`, ops, stored formats and check codes are unchanged.
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

## 0.1.2

### Patch Changes

- 9b2c61b: Agents name records the way people do. A person says "book the florist", never `vendor:bloom-co`. Every argument that names a record now takes its id or its name:
  - a label, case and accents aside;
  - or the one label it starts;
  - among the records the seat may see, of the kinds the argument accepts.
  
  `book` with `id: "bloom"` books `vendor:bloom-co`, and the result's `resolved` names the id it took. Two matches are refused with both listed, in the message and in `candidates`. None says so, and points at `search_graph`. `get_node` and `preview_mutation` take a name the same way. Ids keep working unchanged.
  
  `store.resolveRef(arg, given, principal)` gives a host the same answer: one id, or the candidates. A record the principal may not see is never a candidate, by name or by id. It reads a label index kept per kind as sorted keys. The index follows the graph's diffs, so resolving costs the matches, not a scan of every record.
  
  `nodeRefArgs` no longer needs the copy of the framework that compiled an act. A node reference keeps its kinds on the schema under a registry symbol rather than in a module's WeakMap. A host that bundles its own copy reads them too (FR-33).
  
  Compatibility: derived tool names and input schemas: unchanged, and the conformance fixtures match. Derived tool descriptions: every act tool with an argument that names a record ends with "An argument that names a record takes its id or its name." `get_node`'s `id` is described as "A node's id, or its name." where it said "Node id." Behaviour: a node argument that is neither an id the seat sees nor a name it can resolve is refused by the runtime, before the store sees it, where the act used to say so itself. A name that matches several records is refused rather than passed through. Additive: `Store.resolveRef`, and the `RefResolution`, `RefCandidate` and `NodeRefArg` types, `nameKey`, `BY_NAME`, `Resolved`, `ToolResult`'s `candidates` and `argument`.
- 33c3cbb: An agent acts for someone, through something, and the log says so. An `Author` carries its own `name` and `onBehalfOf`, the person it acts for. An op carries `via`, what it came through: `web`, `mcp:<client>`, `view:<name>`, `api` or `cli`. The activity rail reads "Claude, for Nick, via Claude", and `nameOfAuthor` says an author's own name before any id.
  
  An agent acting for a person may do what both may: its roles are the intersection of its own and theirs, a `self` grant is about the person, and `actingAs` gives the seat a policy judges. A `system` principal acting for nobody passes the policy and sees every record (`isSystem`), so a host's setup, seed and migrations are not refused by the app's own grants (FR-06, FR-17).
  
  A served store believes a seat header only when told to. `serveStore({ trustSeatHeaders: true })` reads `SEAT_HEADERS`, now with kind, name and delegation, so a remote `graview mcp` is recorded as an agent. Without it and without a `seatOf`, every route but health answers 401. `graview serve` listens on 127.0.0.1 and trusts the headers there, saying so; on any other `--host` it will not start without `--trust-seat-headers`. `openRemote` sends its seat on every request, the first read included, and its calls say `via: "web"`.
  
  Compatibility: breaking for a host that served a store without `seatOf` and relied on the seat headers: it now answers 401 until it passes `trustSeatHeaders: true`. `graview serve` binds 127.0.0.1 by default where it used to bind every interface. Additive elsewhere: `Author.name`, `Author.onBehalfOf`, `Principal.onBehalfOf`, `Operation.via` and `ApplyOptions.via` are optional fields, and ops without them read as before.
- c6cea46: An observation says a shared value the way the card does. Three duties at 8:30 came out as "3 share the at 510" in homeflow's rail: the minutes as stored, beside the field's name. The structure provider now says the value through the field's declared `display.format` ("all 3 share the starts 8:30"), and keeps the stored value, quoted, only where there is no format. The same goes for the odd-one-out sentence and the align offer's reason.
  
  Compatibility: unchanged — an observation's id and the align offer's args are as before; only the sentence a person reads changes where a field declares a format.
- 5a6f262: MCP for remote hosts. `createMcpHttpHandler({ store, authenticate, name, version })` serves the agent tools over Streamable HTTP as a fetch handler, `(Request) → Response`, stateless, for 2025-11-25 clients. The host's `authenticate` hook supplies the principal for each request; with no principal, every message is a 401, `initialize` included. The MCP TypeScript SDK's client completes initialize, `tools/list` and `tools/call` against it in the tests. `graview mcp` and the HTTP handler answer the same five methods through one dispatcher.
  
  Every tool says what it does. A `ToolDefinition` has a `title` and `annotations` with all four MCP hints, derived from the declaration:
  - `readOnlyHint` for the reads;
  - `destructiveHint` for an act that removes or severs, so `remove-<kind>` is destructive;
  - `idempotentHint` where an act sets only what it is given (a new `idempotent` on a mutation; derived edits and removes, and document acts that create nothing and compute nothing, have it);
  - `openWorldHint: false` always.
  
  Tool names are MCP-safe, with collisions handled the same way every time, and `act` names the act a tool runs. An act named like a read tool, such as `get_node`, used to be impossible to run, because the read tool answered first. It is now listed as `get_node_2` and runs as the act. `toolDefinitions(app, principal)` gives a seat's surface without a store, with a `hash` that changes when the surface does; `tools/list` carries it as `_meta["dev.graview/surface"]`.
  
  Other people's words come back as data. Reads go through `seenBy`, and prose written by somebody other than the caller, or the person an agent acts for, comes back as `{ untrusted: true, authoredBy, text }` in `get_node`, `get_graph` and `search_graph` (FR-10).
  
  Compatibility: derived tool names: unchanged for every act whose name is already letters, digits, `_` and `-`, at most 64, beginning with a letter or `_` (every act in the conformance fixtures, and every derived `edit-<kind>` and `remove-<kind>` of such a kind). Any other act is listed under a safe name: other characters become `_`, accents fall away, a leading digit or hyphen gets `act_`, and the name is cut at 64. An act named `search_graph`, `get_graph`, `get_node`, `get_violations`, `get_affordances`, `preview_mutation` or `undo_batch`, or one whose safe name another act already took, gets `_2`, `_3`, and so on. A call by the declared act name still reaches the act unless a listed tool has that name. Derived tool input schemas: unchanged, and the conformance fixtures match. Additive: every tool now has a `title` (the read tools: "Find by name", "Read the whole graph", "Read one node", "List the problems", "Ask what can be done", "Try an act without applying it", "Undo a batch") and `annotations`, and `ToolDefinition.title` is now always set. Read results: breaking for a reader that expected a string in a prose field written by somebody else, which is now the untrusted wrapper. Breaking for a seat whose policy declares `sees`: `get_graph`, `get_node`, `get_violations` and `search_graph` now show it only what it may see. `MCP_PROTOCOL_VERSION` is `2025-11-25`; a client that asks for an older revision gets its own back, as before.
- b2f8c22: Templates as data. A template made in Graview Cloud — a declaration document, the questions that set it up, what the answers do as ordinary acts, and example content, in Cloud's `graview-template` shape — now scaffolds a self-hosted project and sets up a live store with no Cloud in the room.
  
  `graview create <dir> --template <file|url>` judges the template first (its shape, its document through `compileDocument`, its setup acts against that document, its examples against the schema) and refuses with the path of every finding before a directory exists. The project is the checkout `graview create` always writes, with the declaration kept as the document: `src/domain/app.json`, compiled by `compileDocument` when the domain loads, and the template beside it as `template.json`. Writing TypeScript from the document would need a generator for every construct the document has and would then be a second declaration to drift from the first; kept as the document, `graview describe` says the same of the project as of the template, by construction. The project's test holds the declaration to `graview check` and runs the template's setup as one batch that one undo takes back, and `apply-template` is a script.
  
  `graview apply [<entry>] --template <file|url> [--answers '<json>'] [--examples]` runs the setup through the same `planFrom` and `applyPlan` as `--plan`: judged under the seat first, applied as one batch authored by the template (`{ kind: "system", id: "template:<id>" }` unless `--as` or `--roles` say who), with "Set up from <title>" as its intent. One `--undo` takes it back. `--examples` brings the example content as a batch of its own. Without an entry, the template's document is the app.
  
  `@graview/core/document` gains `readGraviewTemplate`, `isGraviewTemplate`, `instantiateTemplate`, `templateSeedPrimitives`, `TemplateSpec` and `TEMPLATE_FORMAT`, and `ScaffoldOptions` gains `template`. Every command that reads a `.json` entry reads a template as the document inside it (FR-08).
  
  Compatibility: the declaration — additive: a template is a new format beside the document, which is unchanged; every document that compiled compiles the same, and no check finding code changes. `graview create` without `--template` writes the same files as before. The wire — additive: `capabilities().shipped` now names FR-08. Derived tool names and input schemas: unchanged.
- 984c96f: The declaration is a document. One JSON object, the Graview declaration document, compiles into the same app `defineApp` declares, through `compileDocument` in `@graview/core/document`.
  - **Kinds** have typed fields, label templates, lifecycles and relations.
  - **Acts** are a closed set of effects with `allowedWhen` refusals.
  - **Rules** are written in the rule language.
  - **Policy, modules, lenses and settings** are the data they already are.
  
  Nothing in the document path runs a string as code, and a test reads the module to hold that. `canonicalize` gives two documents equal in meaning the same bytes.
  
  `toDocument(app)` gives a document-made app back exactly. For a TypeScript app it writes what is data and names, at its JSON path, each surface that is code.
  
  `graview check`, `serve`, `mcp` and `describe` take `--document <file>` with no TypeScript entry, and check reports a document's findings with the path to fix each at. `capabilities().documentFormats` says `graview-document@1` (FR-01).
  
  Compatibility: the declaration — additive: a new entry point, a new format (graview-document 1), and `--document` on the commands; a TypeScript declaration is read as before.
- 6460336: What a seat may not see never leaves the store. The store handler, and so `graview serve`, answers each route with the store as the asking seat sees it. `/graview/state`, `/graview/since`, `/graview/export` and the ops on `/graview/here` come from `seenBy(store, principal)`, and ops that touched what the seat may not see come back withheld in place, so an unmodified `openRemote` still loads them (FR-16). `/graview/here`, `/graview/who` and `/graview/leave` leave out anybody whose own record the seat may not see. For everybody else they clear a stop, hover or robot position that names such a record (`presenceSeenBy`). The ops `/graview/ops` sends back are redacted the same way. A participant whose id holds a colon (`shopper:bethan`) now keeps its session as sent.
  
  A write that names a record the seat may not see is refused before any grant is read, with the sentence "Not permitted: “Answer the enquiry” names a record you may not see." This holds in `store.apply` and `store.permits`, over the wire and through the agent tools. A seat with sights may not undo what it may not see. Over `graview mcp`, `get_affordances` is derived from what the seat sees, and `undo_batch` judges over the log as the seat sees it.
  
  Sights have one meaning, the document's and the framework's, and `compileDocument` puts a document's `policy.sees` into the compiled app's policy. With no `sees`, everybody sees everything. With any sight, every kind is deny by default, like grants: a kind no sight names is seen by nobody but the system, and the new check warning `sight-unnamed-kind` names each one. `own` means the principal's own records: their record, what an edge joins to it, and what they made. `recordsOf(log)` reads who made each record and its kind, so a removed record is still judged by the kind it was. The studio models a sight as a node with three acts, `add-sight`, `change-sight` and `remove-sight`, and writes sights back into the declaration and `policy.ts`. Changing them in place is still said rather than written, as it is for grants (FR-02).
  
  Compatibility: breaking for a policy that declares `sees`: a kind no sight names used to be seen by everybody and is now seen only by the system. Add `{ roles: "*", kinds: [...] }` for the kinds everybody may see; `graview check` names each one with `sight-unnamed-kind`, a new warning. Additive for `own`, which now also covers the records a principal made. Breaking for a host that relied on the wire sending the whole store: every read route now answers with what the asking seat sees, and only the system seat sees everything. A host that serves its owners everything serves them as the system or names them in a sight. Additive for the wire otherwise: no route or field was added or removed, and `WIRE_PROTOCOL` stays 1. Changed for derived tools: the names and input schemas are unchanged, the studio gains `add-sight`, `change-sight` and `remove-sight`, and the read and undo tools answer as the seat sees. For the declaration document, `policy.sees` now takes effect in the compiled app, and the conformance fixtures declare no sights, so none of them changes.
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
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2
  - @graview/ship@0.1.2

## 0.1.1

### Patch Changes

- 6b297f0: An act offered from its far end, with its subject still to choose, is asked about as the seat would choose it. A grant on the seat's own record (`self: true`) or drawn by kind ("a reviewer, on talks") could not pass a subject nobody had named, so a shopper was refused "Shortlist a car" on every car "— a manager or a shopper can", and a reviewer every topic. The open subject's candidates are now narrowed to those the seat may act on; when that is only the seat's own record the subject is filled in and the form stops asking who; when the seat's own record is already done, the act is neither offered nor refused. `store.permits` reads an unchosen subject as the act's one subject kind.
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

- c7a3519: A create can name its id, and what was made can be unmade. Every act that declares `creates` now takes an optional `id` argument the framework adds beside its own: `compileMutation` lifts it before the declaration's input parses, `freshId` hands it out first, and an id the graph already has is refused by name rather than quietly suffixed — so a seed being synced, or an agent that will refer to the node in its next call, gets exactly the id it asked for or an honest no. The tool schema says so (`mutationToolSchema`), and `takesAnId` says which acts take it.
  
  And every kind gets `remove-<kind>` derived beside `edit-<kind>`: destructive, titled, taking the node and its ties, logged and undoable, permitted through the acts that create the kind or a grant naming it — who may bring a thing into being may take it out, which is narrower than the edit's reading on purpose. An app's own `remove-<kind>` is kept. `derived` on a mutation is now `{ kind, act: "edit" | "remove" }`; `deriveMutations`, `deriveRemoveMutations`, `removeVia` and `derivedVia` join the exports, and the store, the checker, `describe` and `docs` all count the removes with the edits. The refusal for a derived act nothing declared reaches now says "creates or changes" rather than the edit's "writes or creates".
- 92a2f73: What a person reads names a field, a relation and a group in the declaration's words, never by id. `fieldWords(definition, key)` is the one place a field becomes words (its `display.labels`, else the key spoken); an editable value's tooltip no longer says "changes "plannedAt" through a mutation", the inspector no longer says a line's edge is "rides-in", the calendar's refusals and the structure suggestions ("all 3 share the day "mon"", "(assigned to)") read in words, and `bandAggregateWords` names a band's group — the seat had been calling one "album|released-by|in|type=album".
- 8c14e4c: A gap nobody is waiting on is not an observation. The insight provider announced an empty kind whenever any declaration had an edge into it — including the kind's own. A scaffolded project starts with exactly that shape, so its one empty district read "Nothing here yet, though Items expect to connect to these", naming the absent kind as the party waiting for it. Only other kinds count now.
- 1ebfd44: A kind has a figure. `defineNode(kind, { figure })` takes inline SVG — one `viewBox`, `currentColor` strokes, no fill — or the name of one from a small shipped set (person, plot, box, task, shift, list, vehicle, rule, note), and a brand may override any kind's. One `<KindFigure>` draws it everywhere a kind is drawn: the kind card at altitude, the district beside its plural, the routed face's rails and record eyebrows. A kind without one is drawn exactly as before; nothing about a figure is required.
  
  `graview check` refuses a figure that cannot be drawn — no `viewBox` (nothing can size it), a literal colour (invisible in one of the two schemes), nothing stroked with `currentColor` (it will not take the kind's ink), or a name nothing ships — and refuses a brand drawing for a kind the app does not declare. `drawFigure` in `@graview/tools` asks a model for one in the house style and judges the answer with the same function, so a drawing that would fail the build never reaches a person as a proposal; a model that throws or draws badly falls back to the nearest shipped figure BY NAME and says so, because guessing that a cleat is a box would be the framework having an opinion about a domain it has never met. `graview figure <entry> --kind <k>` prints the line to paste.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- 406b774: A line does not offer the act that would make it. Both ends of a selected relation prefill from the line itself, so a mutation that only connects that edge kind arrived with no question left and nothing to change — a one-press button that looked inert, and instead re-applied the mutation and wrote a second identical op into the history describing a change that never happened. A maker with a question still open, and a mutation that also severs the kind (a move), are both still offered.
- 14e22ab: The reason an act is offered on a selected line names the line by its words — `this line is "who is along for it"` — rather than by the edge's name, and several selected records of one kind are named in the kind's plural ("all 2 selected nodes are runs").
- 4aa0f93: Loops: act, re-judge, act again, and know when to stop. `runLoop(store, loop, { decide, … })` reads `store.violations()`, takes the first violation with a repair it can take, asks which repair from the closed set the rule names (a Choice — an invented repair is impossible; a violation with one ready repair is not asked at all), applies it as the declared act under the loop's one batch and its own agent seat, re-judges, and goes again. Every turn is attributed and undoable: one undo takes the whole loop back.
  
  It stops for a reason it can say, as a sentence in `stopped.said`: nothing left; not sure enough of the repair (the question is handed to a person at its node, with the repairs as presses); a state the graph has already been in (the loop is going in a circle); the budget of turns, questions or dollars spent; the provider failed; the policy refused. `replyFromLoop(result)` speaks it as the seat's own reply, and every visit to a violation's node is announced through the seat's existing `onCall` path as a read of that node — and the stop as a `stop` call carrying the sentence — so the Activity rail shows which node the loop is at and why it stopped, with no second reporting path.
- 5b5e5a3: A one-press act must be able to act. The actions strip counted only required arguments as open, so a derived edit whose every field is optional looked like a single press and, pressed with just its subject, refused on the button: "Nothing to change — give at least one of label a value." An action with nothing required left is now rehearsed with what it has, and one that would refuse asks for its optional arguments instead, each of which can be skipped; only what was actually said is applied.
- aa90b02: A pair question carries the other node's id rather than parsing it out of its own key: an id may hold a colon, and the matrix run turned "practice:barrier-spraying" into an edge to a node that did not exist.
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
- 73e3b86: A record a rule names is not said to hold. The pane read "Kerosene holds — nothing currently breaks it" above a rule about the single that named the song, because only a violation's subject counted; any violation that names the node now keeps the "holds" line away.
- 9a3fe4b: A run is a sequence of typed asks over the graph, declared not scripted. `RunDeclaration` is steps: `{ fill: kind }` asks every current node its unset typed fields; `{ ask: act, over: kind }` asks each node the act's remaining arguments as its subject; `{ judge: rule }` asks every violation which of the closed set of repairs to take; `{ pair: act, over: a, against: b }` asks every pair whether the joining act holds — a matrix nobody authored, from `pairQuestion`. Fan-out is the ordinary case: one call per node carries that node's whole set of questions.
  
  `readRun(store, run)` reads a run before it runs — nodes, questions and calls per step, a rough cost — and a run whose `budget` (questions or dollars) it exceeds is refused before anything is asked. `runFrom(store, run, { decide, … })` executes under the run's own agent author (`agent:<name>:run-<time>`), announces every visit through the seat's existing `onCall` path as a read of that node (so the Activity rail shows where the run is with no second reporting path), and returns a typed `StepOutcome` per step — the answers with their confidence, the calls they became, a judged `Plan` — which a `judge` hook can stop the run on with a reason. In review mode the whole run is one plan and `landRun` lands it as one batch with one undo; in each-step mode each step lands under the run's one batch before the next is asked, so a later step sees an earlier one's answers. A run holds the `Decide` it started with, so a rung switched underneath does not move it.
- b9b0635: A time of day is asked for. An argument whose pattern is a date with a time in it (`YYYY-MM-DDTHH:MM`, the gauntlet's workshop start and a talk's slot) described itself as a plain date, so every face offered a date picker, the picker gave `2026-09-20`, and the act's own pattern refused it: no workshop could be made and no talk given a slot, on either face, at either width, with either hand. The date shape and its form field now carry `time: true` for such a pattern; the routed form, the scene's ask, the edit in place and the studio's agent panel ask with a date-and-time control, and the conversation and the starter fill one with a time of day.
- ff7de41: An agent with only a shell attaches to a live store. `graview mcp <entry>` speaks MCP over stdio — JSON-RPC, one message per line, no SDK — around `createToolRuntime` and `createMcpAdapter`, against the store where the data is: `--data <dir>` (a folder of readable JSON), `--sqlite <file>`, or `--remote-url <url>` against a running `graview serve`, with `--as` and `--roles` naming the seat and `--header` carrying whatever a host asks for. A reply waits for the write to land, or for the server's verdict against a remote, so "done" is never said before it is true; a refusal is the tool's error, in the policy's own sentence. `--list` prints the seat's tools as `tools/list` JSON without opening anything — the catalog a host registers without hand-writing a schema — and the model is told on connecting how to work here, derived from the declaration.
  
  `graview apply <entry>` is the one-shot form: `--call <name> --args '{…}'` for one act, `--plan <file>` for many as one batch (`[{ mutation, args, as? }]`, a later call naming an earlier one's node as `{ "$plan": "<as>" }`, ordered and judged by `planFrom`), `--undo <batch>` for a take-back, `--preview` to say what would happen and write nothing. Everything goes through `store.apply` under the seat's principal; what is printed afterwards is read from the log once settled, minus a remote store's provisional ops, so the ids and batch shown are the ones every other client has. Both live in `@graview/tools/cli`; the `graview` command dispatches to them. A plan whose calls carry no `why` keeps each act's own sentence as its intent, where an empty string used to silence it.
- 959955f: An agent in the studio: ask for a declaration change in words, see it checked, keep or discard it.
  
  Both halves of this already existed and nothing joined them. The studio could take a proposal from an agent seat — `propose`, `proposals`, `decline` — and the chat panel could already turn words into proposals over the ordinary runtime. But the studio itself had no agent in it, so the one surface whose subject is the declaration was the one surface you could not talk to: every change by hand, one act at a time, with the whole shape held in your head.
  
  The studio's bar now carries its own Ask. A turn produces PROPOSED studio acts and stops there — nothing is applied by asking. Each proposal is put through the new `Studio.would`, which applies the call to a copy of the store and checks what the declaration would become, so `graview check`'s findings are read before anyone is asked to keep anything; a change that would add an error is struck through with the finding that condemns it and has no Keep button at all. Keeping calls `studio.propose`: an ordinary op in a batch of its own under the agent's name, with an inverse, so the studio's trail says who proposed it and undo takes it back.
  
  Keyless first, like the rest of the ladder. `studioResponder` reads the meta-graph and answers about the declaration itself — what kinds there are, what an act writes, what a rule judges, who may take it, which kinds have no figure — and fills studio acts from a template: "add a due date to tasks" becomes `add-field` with the type the name implies, optional so records that already exist stay valid; "every shift needs a volunteer" becomes a rule over the shift. A model upgrades it through the same one-function `Completion` seam, with the studio's own floor under it, so a fact the declaration holds is never replaced by a fluent guess about the same fact.
  
  This is also where the `drawFigure` gap lands, recorded honestly when figures shipped: the drawing carried the house style and judged its own answer, and was reachable from code and from `graview figure` and from nowhere a person sits. "Draw a figure for volunteer" now reaches it from the studio, and a figure is finally something a declaration can carry through the studio at all — modelled on the kind, read in, written back, and written into the schema file. Before this, opening the studio on a drawn app and applying would have rubbed every drawing out.
  
  `figureFaults` — the checker's own judgement — now closes the drawing vocabulary: a figure is line art made of drawing elements and drawing attributes, and a `<script>`, an `onload` or a remote `href` is a fault with a name rather than something that passes a style check and is inserted as markup. That is what makes a model's drawing safe to show somebody before they keep it.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- b3ed5f6: Confidence is a first-class answer, not a number in a log. `PlannedCall.confidence` (0–1) is how sure the proposer was, carried on the call rather than written into `why`, so the same number travels wherever the call does. A run's every answer reaches a surface with its confidence and full distribution (`Answered`); an answer that came back split — the top two options within `splitWithin` of each other, "turf 0.5, bed 0.45" — or below the `floor` is not applied and not dropped but OFFERED: an `OfferedQuestion` naming the node it is about (id and label), the question in the declaration's words, why it is asked, and each option with its probability and the call it would be. `offerOf(answer)` is the rule. A confident answer is still a plan before it is a change.
  
  Offered questions travel the seat's own reply — `ChatReply.questions` — and `replyFromRun(result)` speaks a whole run that way: what it asked, the confident calls as proposals, the rest as questions, a refusal or a stop said out loud. The chat panel stands each question at its node, "Back Lawn: Which surface?", with the options as presses that land through the same attributed, undoable path a proposal does. `PlanReview` reads a plan whose calls carry a confidence least sure first, with the number beside each row, and still applies it in the plan's own order.
- 1e773a5: What the chat's words look for keeps a one-letter word: "any Model Y?" looked for "model", because every word of one letter was dropped with the asking words.
- 1794980: Nothing a model suggests fails in silence, and proposals that wait for each other stop waiting.
  
  Three holes, each the same shape: the seat knew something the person did not, and said nothing.
  
  **A model that answers with a bare array was thrown away.** Asked for `{"say", "proposals"}`, a model answers with just the array of proposals often enough to matter — the sibling seam on this very contract asks for exactly that shape. Reading from the first `{` found the first PROPOSAL inside the array, returned it as though it were the whole answer, and left the person looking at "…" with a perfectly good list discarded. Whichever bracket opens first is now the value the model meant.
  
  **A model that named an act the app does not have said nothing at all.** `add_field` where the act is `add-field` was dropped by the gate in silence: a sentence with nothing under it, no refusal, no way to tell whether the seat had understood. The gate now reports what it took out and why — an act this app has no such thing for, or one this seat may not run — and says when nothing it suggested can be applied here. Silence is the one answer that cannot be acted on.
  
  **Proposals that depend on each other refused for ever.** Encouraging a model to split a loose sentence makes dependent chains ordinary: "a Meal kind, with a name and how many it feeds" is one act that creates the kind and two that need it to exist. Judged once on arrival, the two fields refused — they named a kind that was not there yet — and keeping the first changed nothing about them, so a person saw two dead proposals under a live one with no sign they were only waiting. Every open proposal is now re-read and re-judged whenever the declaration changes: the name the model used resolves the moment the thing it names exists, an undo puts them back, and the verdict on screen is never about a declaration that has moved on.
- 2b2df36: One matcher finds a thing anywhere in the graph. `search(store, query, { principal, from, subject, places, today, limit })` in `@graview/core` returns ranked hits — a record, a kind, a place, an act or a rule — each with a `why` naming the field that matched and the words around the match. Matching is on folded text (case, accents and punctuation aside), every word the start of a word, never fuzzy; `key:value` tokens are the arrangement's conditions, applied to the kinds that offer them, with `kind:` to narrow and `is:any` to include past records. Records rank by how the words matched (exact name, prefix, whole words, parts, a field), then near the subject, current before past, recently touched, flagged, alphabetical. What a seat may not see is not a hit, and an act is a hit only on a highlighted record. The arrangement's `q` uses the same matcher, so a list's `?q=` and the Find box never disagree. The agent's runtime gains `search_graph`, first among the read tools, with the records it named counted as reads; the MCP instructions say to reach for it before `get_graph`; `graview describe` and `llms.txt` say what each kind is searched by.
- 8976510: One switch, four rungs — and a rung that says what it cannot do. `IntelligenceConfig.source` is now `"graph" | "local" | "decision" | "remote"`: graph only, onboard AI, Jev, LLM — one setting, live, saved in the person's own browser. The ladder has two axes and `RUNGS` says so: each rung declares the capabilities it serves (`prose`, `decide`, `propose`); a surface asks `rungFor(config, capability)` for a capability and never for a provider; and a capability the chosen rung cannot serve falls down to the graph, which is keyless and always there. `capabilitiesOf(kind)` in `@graview/core` is the same table for declared providers, and `graview describe` reads the ladder out — which rungs the app declares and what each can do, and what the graph answers instead on a rung that cannot.
  
  On the decision rung the chat seat is answered by the graph and SAYS so in the answer itself — "(Jev decides rather than talks — the graph is answering here.)" — as part of `ChatReply.say`, not chrome painted by the panel, so every surface the seat speaks from carries the sentence unchanged. A turn that started on one rung while the person moved to another says which rung answered it rather than finishing silently (`configuredResponder`'s `current` hook, wired in the chat panel and the studio's). `decideFor(config)` is the decision behind a rung for a surface that wants one: the provider exactly on the decision rung (by the person's key, or through the dev server's door), a model behind the full parse-and-refuse layer (`completionDecide`) on a model rung, and nothing on the graph rung — where `graphDecide(store)` answers what the store's own rules already decided and names what it cannot. The picker offers the fourth rung with an optional key; with none, the app's decision door is used.
- e3a7de6: The chat on a real lot. A record's facts keep their own capitals and say what a bare value is — "(VIN 8C9DCWU1ADJZLWE6S, year 2026, make Tesla)", where it said "(8C9DCWU1ADJZLWE6S, year 2026, tesla)" — lower-casing only the label so it sits in brackets. What the words find tells two of one name apart ("2025 Subaru Outback Base · VIN 3VP1…") and names each kind by its noun. And a name several records share no longer answers as one of them: "tell me about the 2026 Tesla Model Y Performance", on a lot with three, lists the three.
- 3af8da7: The graph's own answer to "where is …" writes sentences: a fact reads as it does on a card ("explicit: no", not "explicit No"), and each relation sentence starts with a capital instead of continuing in the caption's lower case after a full stop.
- 0ea3f62: The test of where Jev's key comes from no longer reads the machine it runs on. It asked `jevKeyFromEnvironment(undefined)` for "no environment", which falls back to `process.env`, so `pnpm test` in a fresh checkout failed for anyone who had set `TYPESAFE_API_KEY` as the docs tell them to. "No environment" is now a runtime with no `process`, which is the browser the sentence is about.
- 0a3504a: When a plan lands, each op's intent still records how sure the proposer was ("… (72% sure)") from `PlannedCall.confidence` — the review shows the number once, beside the row, and the log keeps it as part of the reason.
- b7fa5e3: The menu leads with the thing you clicked. `deriveAffordances` takes a `focus` — the node the gesture landed on — and ranks by it: that node's own repairs first, in the order the rule listed them, then its own acts (settled before asking), then everything the rest of the selection offers. Until now a rule that implicated five late tasks in ONE violation offered its ten repairs in whatever order it walked its subjects, so right-clicking the fourth task met the first task's repair at the top and the obvious press fixed somebody else's problem. Which node an act is FOR is read off the mutation's own `nodeRef` arguments rather than the violation's cast list, so "a new date for Book the hall" is Book the hall's repair wherever it came from. Every surface reads one rank, now stamped on each affordance as `rank`: the pointer menu (which names what it was opened on), the actions strip (whose focus is the last thing selected), and the routed record, where a rule's repairs are ordered by `rankedRepairs` instead of as declared. The destructive tail is unmoved, and a derivation with no focus ranks exactly as it did before there was one.
- 1d121a7: The model path is driven end to end in a real browser, and the keyless rung offers the way out of a sentence it cannot read.
  
  Every test of the model rung stubbed the responder itself, so nothing had ever checked that a provider's answer reaches the panel at all. `verify-studio.mjs` now runs an OpenAI-compatible provider on localhost and drives the shipping path through it: the config, the adapter, the prompt, the gate, the forms. One loose sentence — "add a Meal kind, with the name of the food and how many people it feeds" — comes back as three editable proposals, the two that need the kind say what they are waiting on, and keeping the kind brings them alive with the name the model used resolved to the node it now means.
  
  That harness immediately found the thing that would have made the whole feature pointless. **A sentence that opens with an instruction is not a question.** The branches that answer questions about the declaration recognised them by the words they contained rather than by what the sentence was doing, so "add a Meal kind, with the name of the food and how many people it feeds" — which contains "kind" and "how many" — was answered with an inventory of the kinds, and answered as a FACT, which takes the turn away from the model entirely. The one sentence most in need of a model was the one guaranteed never to reach it.
  
  **And a dead end now has a door.** The keyless rung reads a handful of sentence shapes and says so when a sentence is not one of them, which is honest and, on its own, leaves a person guessing which phrasing a pattern-matcher wants — when the rung that reads any phrasing is one press away behind the gear. An answer it could not read is marked, and where no model is chosen the turn carries "Let a model read it →", which opens the picker. Where one already is, there is nothing to offer and nothing is offered.
  
  Also: a proposal waiting on another says `Waiting on kind "Meal" — keep the one that makes it first`, rather than the store's own `Edge "of" references missing node`.
  
  Not tested, and worth saying plainly: the on-device rung itself. WebGPU is unavailable to a browser launched on this machine, so WebLLM cannot start here — what is verified is that it fails honestly, naming the reason, with the graph answering in its place.
- e9e495f: The decision provider itself. `jevDecide({ apiKey | baseUrl, … })` in `@graview/tools` is one `Decide`: one state and a MAP of typed questions in, typed answers under the same keys out — so a node's whole unset half is one request rather than one per field. 429 and 529 are retried with backoff (injectable); 401 is thrown as the SEAT's problem and 422 as OURS, each said in those words, because blaming the model for a bug in the derivation would send somebody looking in the wrong place. An answer that is not typed, or missing, is refused rather than guessed. The key is read from the environment by `jevKeyFromEnvironment()` — `TYPESAFE_API_KEY`, then `JEV_API_KEY` — travels in one header, and appears in no error. Usage is metered per call and in total (`onUsage`), and `jevCostUsd` prices input tokens at the published rate; output is unmetered.
  
  A browser must not hold a service key, so `@graview/ship/dev` gains `decisionBridge()`: a dev-server door at `DECISION_BRIDGE_PATH` (`/__graview/decide`) that holds the key from the server's own environment, forwards a page's state and questions, and hands the provider's own status back so the page-side provider tells failures apart the same way. Same-origin only; the key is in no response. The contract (`DecisionBridgeStatus`, `DecisionBridgeAsk`, `DecisionBridgeAnswer`) lives in `@graview/core` beside the local door's.
- 636a00d: The questions a decision provider is asked are derived from the declaration, never authored. `questionsForKind(store, kind)` turns each settable field with a typed answer into one question in the wire shape a decision provider takes: a `z.enum` is a Choice whose criteria are its options and whose instruction is the field's own description; a `z.boolean` is a truth; a bounded integer is a Score over its levels; prose asks nothing. Each field question names the act that writes the field and the argument the answer fills. `questionsForMutation(store, act, given)` asks the arguments `given` has not settled — a `nodeRef` is a Choice over the live nodes of that kind, labelled by `labelOf`, the id as the option name. `questionsForInvariant(store, rule, violation?)` is a truth whose "yes" is the rule in its own words and, where the closed set has more than one member, a follow-on Choice over the repairs — the violation's ready repairs when the store has judged, the rule's declared repairs when it has not — each option naming the call it means. `nodeState(store, id)` is the state a question is asked over: the node as a card shows it, joined things by label. `allQuestions(store)` is the whole derived surface.
  
  Also: a described node reference is still a node reference. `nodeRef(["concern"]).describe("…")` clones the schema, and the registry was keyed on the instance, so the natural way to write the question lost the kind — no picker, no candidates. The registry now keys on the def as well, which the clone shares.
- 7be1ad2: The last sentences that named one of a kind by its id read its noun: the strip's reason for an act ("this is a staff member"), what a beginning is waiting for, the ask's picker label, and the reach lens's hover.
- 315ce3b: The seat is a robot in the city: it stands where it reads and writes, comes to your cursor when asked, and says its refusals at the gate. One figure per agent participant (`kind:id:session`, the op log's own key), drawn by an `Occupants` overlay over the stage on both renderer paths and positioned from the live frame through `whereIs`, so it rides the tween and the pan and never enters `layout()`. Where it stands is a pure fold (`foldRobots`, tested like `markActivity`): a read puts it at what it read, a write at what it wrote, more than four targets at the neighbourhood, a refusal at the gate with the policy's words as its say, a question on the node's doorstep, rest after the hold at its dock — the seated person's own building when the installation is shown, else a pad at the city's origin cell. Movement is one CSS transition on transform; a quiet city runs no loop and no pointer listener, and reduced motion makes moves instant.
  
  The tab's one-press seat and its chat are ONE robot: the seat registers its name and the chat writes as it (and is seated even while the Activity rail is shut, so the body is docked from the first frame). Applying a plan walks it to each target before the op lands (`applyPlan`'s `before`); undoing an agent's turn walks it home; a run's stop sentence, announced through `onCall`, is said from its bubble. Click the figure, or Tab to it and press Space, and it follows the pointer, offset so it never sits under the cursor; while following, "this" in the chat is the pick under the pointer and the chat panel is anchored as its bubble; Escape releases from anywhere. Off the visible ground an edge indicator points at it with its status line. The bubble is a polite live region carrying whatever the seat says on its rung, and the figure is a named button. `scripts/verify-robot.mjs` drives all of it on the todo app; the seat harness still shows identical diffs.
  
  Also: the graph responder now fills a choice argument from the option's own word in the sentence ("give a role keeper to Sam"), and only when exactly one option is named.
- d9bfdb8: The seat's reply is read by the model it was meant for. A sentence that names a thing inside a change ("Erin tends that plot") is no longer answered as a grounded fact about the thing, so a model on the ladder reads it; the model is shown each act's argument signature, the graph's connections and today's date; `describeProposal` words a proposal in the act's own `describe`; `stillNeeded` counts a name nothing answers to yet as still owed.
- ccaa5f4: Search reaches the pages face and the conversation. `/search?q=` lists what the words find grouped by kind, each hit with its why and each kind's heading a link to its list with the words carried; words that find nothing say what was searched ("current ones; add is:any for past ones") and offer the beginnings the seat may run, "A task called “zzz”", with the words already in the name (`beginningsFor`, `SearchToCreate`, and `DerivedForm`'s new `initial` — starting values that stay editable). The derived shell's nav carries the box, `PageFind`: on a kind's list it narrows that list, elsewhere it goes to `/search`, typing replaces rather than pushes; an app's own shell can use it, with `narrowsLists: false` when its lists have a box of their own. The list page reads its words with the shared matcher — `key:value` tokens and `is:any` included — shows why a row is there when it was not the name, and under the derived shell drops the row's second box. `/search` is a derived route an app's own `route()` is warned off. A message the conversation reads as no act and no fact, whose words find records, is answered with them as `picks`, each a press in the chat that goes there. The activity rail shows the records a read looked at, so an agent's `search_graph` says what it found.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
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
- Updated dependencies [30adc63]
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
  - @graview/ship@0.1.0

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
- 964d140: The DOM path is a citizen of every browser. The board no longer trusts
  `height: 100%` to transfer through `aspect-ratio` — Firefox and WebKit
  treated it as indefinite inside the panel's flex chain and collapsed the
  pitch to its border pixels, taking every slot's hit target with it; the
  width now comes from the same ResizeObserver measurement that decides when
  the board turns. The local-AI rung fails fast and says why when a browser
  has no WebGPU, and the chat header carries that reason instead of a shrug.
  The graview-new-app skill states the supported-browsers floor.
- 95cceb3: The menu scales. Past the fold a filter-as-you-type field appears in the
  inspector — it narrows the same derived list by label and why, Enter runs a
  sole survivor, Escape clears. `defineMutation` accepts `pinned: true` (the
  app naming its own act), a person can pin any offered action from the menu
  itself (kept per browser beside the intelligence config, outranking the
  app's), and a deterministic recency/frequency boost read off the op log
  ranks what a workspace actually uses ahead of what it never touches —
  decaying so the menu tracks the season. The bands stay inviolate: repairs
  first, destructive last; pins and usage only ever shuffle inside them.
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
- 0f9b0fd: Pins override in both directions, and the stars say whose they are. A
  person can now UNPIN an act the app's declaration pinned — the same star
  gesture demotes it for that browser and restores it — where before the
  star on a declared pin was a control that visibly did nothing. The
  person's pin draws in the accent, the app's in quiet body ink. And when
  the searcher is down to a sole survivor, the row says ↵ — the promise
  Enter makes, shown exactly when it holds.
- 4bd846b: The horizon, modules, selection-as-a-stop, the traditional face (@graview/pages), the intelligence seam, and the ship subpackage (persistence wiring, op-log-native migrations, export bundles, health).
- 77d1d4a: Permissions, brands and a publishable shape.
  
  - A `Principal` is an `Author` with roles, and a `Policy` of grants is enforced
    at the store — including on undo, which was a complete bypass.
  - A `Brand` declares name, logo, typography and both schemes, and
    `graview check` measures every text pair against WCAG AA.
  - `@graview/render` splits its WebGPU surface behind `@graview/render/gpu`, so
    the main entry no longer requires consumers to install `@webgpu/types`.
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
