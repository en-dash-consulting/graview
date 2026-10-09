# @graview/layout

## 0.1.19

### Patch Changes

- 1fc12ed: Small truths after the cleanup. A record described by `describePlace` is at the address the routed face gives it. It was `/deliverable/a b`, an address no page answers; it is now `/deliverables/a%20b`. A seat handed a face's store and views lists the places the declaration does. It now orders the pictures as the arrangement does and calls the scene what the bar calls it, where before it said "Scene" whatever the app named it. `placesOf` and `placesFromViews` are one builder now, and a test holds them equal on every example app. A model's tool for an act is titled what the actions strip and the seat call it: "Mark done", not "MarkDone".
  
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
- 70d6b7c: A cleanup after the seat. Graview Cloud's hosted page carries 9.5 KB less before the app draws: 577.3 KB where it was 586.6 (532.7 handed a compiled app, where it was 542.0), which leaves Cloud's shell about 17.5 KB under its 595 where it had 8. The rules for what only the scene draws — a district's card and its drive-in, the altitude control, the others in the city and the seat's marks — were still in the sheet every face draws up front. They are the scene face's now, drawn with the scene as the plots and the roads already were.
  
  Typing in Find at a big hub fits one frame again. The scale harness's worst frame typing at the discography's hub was 38 ms, and 55 on a slower run, against its 50. It is 20 now. The hits are a set made once per search, not twice per band card. A host keys what it lights by a hash, not a string of every lit id. The layout no longer reworks the flagged and the log's weights for each keystroke. A record's words are folded once. The ranking uses one collator. `isCurrent` reads the clock only for a kind whose lifecycle is a date.
  
  The same thing is said once where several packages each said it: a sentence's first letter, an act's name in words, a kind counted, a kind's card named, and where an embed lands on a stop that names a place. Comments and test names that still spoke of the companion and its rail now speak of the ask field and the panel. The nightly runs the seat-guide harness where it still asked for the companion's, which had stopped its whole shard. The rule that lands the keyboard somewhere stops asking once its root is unmounted, rather than reading a document a test had already torn down.
  
  Compatibility: internal; no public name, export, behavior or format changes. `themeBaseCss` no longer carries the scene's rules named above; `sceneCss` does, and `themeCss` carries every rule it did.
- Updated dependencies [c86e079]
- Updated dependencies [1fc12ed]
- Updated dependencies [70d6b7c]
- Updated dependencies [1270cad]
- Updated dependencies [42222b8]
- Updated dependencies [b0ecb63]
- Updated dependencies [10cf75d]
- Updated dependencies [e45f747]
- Updated dependencies [a24128c]
  - @graview/core@0.1.19

## 0.1.18

### Patch Changes

- 2278594: A lens double-clicked from Up opens it. Nick: "fix the double-clicking of a lens when in elevated Scene view so that it zooms in on that lens, going from up to down." From Up, each district says its pictures under it ("The board", "The year", "The season"), and pressing one shows it on the district's billboard and flies the camera to it. The flight moved the name out from under the pointer, so the second click of a double-click landed on the district's own card, whose double-click jacked into the district: zoomed, still Up, the district selected, and the picture never opened. The pointer did not move; the city did. So the first press of a picture now takes the next press made where it was made — within 12 px, by the same kind of pointer, for as long as a double-click lasts (500 ms) — as the second half of its own gesture, keeps it and the dblclick that follows from whatever is under it now, and goes down into that picture: the kind's district in focus, on the ground, the picture `in.view`, the same stop the bar's place list, Find and a host's `go.place` make, which now all say it through one function, `withPicture` (`@graview/layout` and `/view`). A double-tap is the same two presses. A press anywhere else in that half second — another district, the bar, another picture — goes through untouched. From the keyboard, Enter on a picture shows it, and Enter again on the picture already showing goes down into it, as does a second press of it however late; a single press keeps its meaning. The descent is the scene's own, so reduced motion cuts it as it cuts every other. The picture's title says so: "Show The board on the billboard — double-click to open it", and "The board is showing — press again to open it". `pnpm verify address` holds, in Chromium, WebKit and Firefox at a desk, that from Up a double-click on a district's picture puts the scene Down, focused on that kind with that picture `in.view`, at the scene's address with the stop saying so, and that Back returns Up; on main the scene stayed Up, zoomed. The pages face alone carries 1,034 bytes more for it (518,939), every face 985 (1,562,951) and the embed with the studio handed in 985 (1,528,922); the hosted page up front carries 41 bytes more (590,033) and its budget rises to 576.3 KB, which leaves Cloud's shell 18.7 KB under its 595; the scene before it draws measures 898,844; their budgets rise by that.
  
  Compatibility: behavior a host's page reaches, and a new export. New: `withPicture(state, kind, as)` in `@graview/layout` and `@graview/layout/view`. Changed: on the scene from Up, the second press on a district's picture within 500 ms and 12 px of the first, by the same kind of pointer — whatever is now under it — and a press of the picture already showing go down into it, where the second press of a double-click landed on the district under it, which zoomed in still Up, and a press of the picture already showing did nothing; the picture's press says so in its `title`. Ops, stored formats, the wire, the declaration, check's finding codes and tool names and input schemas are unchanged. What Graview Cloud changes: nothing it must.
- 2fba4ab: A selected record is drawn once; a relation is said in the declaration's words; and a district's box holds its name (FR-141, FR-142, FR-143). Nick, on 0.1.17 in Graview Cloud's "Farm Bureau POM Workshop": "the main bug i'm talking about is how it's rendered twice". Selected Down in its district, a workshop part was drawn twice, overlapping, and its topics a third time. The cause: a kind's declared `page` (one × full) was drawn as its blocks bare above the framework's record, the two in one column that the scene centered on a box sized for the record alone. The page's blocks spilled out of the top of the box, under the app bar where nothing scrolls to them; the record's frame spilled out of the bottom, over the cards it is tied to; and the record said the page's goal and its four topics again, as fields and as chips under "Covers". The second "COVERS" with nothing under it was the caption of the topics' own cards, showing through. Declared views win where they exist, and a page heads its record, so the page is now drawn inside the record's one frame as its head. The page's title is the frame's title (still the rename control where it is the name), the page's blocks come first, and the record adds only what the page did not say: the fields it left out, each editable where an act writes it, and the ties it did not list. Under a declared page there is no kind-description subtitle, and no "Nothing is connected" when every tie was listed. A kind with only a `card` is drawn in focus by the framework's record alone, as before. Whatever draws the record in focus (the framework's record, a page at its head, a component, a worker view) is held to the box the layout gave it. It is no taller than the box, and when it is taller it scrolls inside from its top, so it never stands under the bar or over its neighbors. On the pages face a page still heads the framework's record page, which now leaves out the facts and the related records the page already says, and the page's title where it is the record's name. `whatBlocksSay` (`@graview/core/blocks`) reads what resolved blocks say: the fields their words read, the records their lists list, and their opening title. `Connections` takes `hide`, the records a view already lists; a heading left with nothing under it is not drawn. The seat's panel said `Holds 4 of 4 "partOf" — most of them`; it now says "Covers: all 4 topics", the relation read from the end the record stands on (its `inverse`) and the count said plainly, "5 of the 6 topics" when it is most. `edgeWords` (`@graview/core`) says a relation from either end, its `description` or its `inverse`, else its key spoken ("part of", never `partOf`). The relation key's words, the band's captions, the connections' headings, a loop's label from altitude and the chat's answers about a record read through it, where they printed a camelCase key as written. A district's name keeps one line. Where it is wider than its box it is drawn smaller, down to eleven pixels, and past that it is cut and said whole on hover, so "WORKSHOP PARTS" no longer wraps out of the top of its box; and a district every member of which the selection reaches says "4 tied" (or "2 of 4 tied") where it said "4 4 tied", the count twice. And the district you are in stays in the row: at 1280 wide the workshop's own district had gone behind "+5 more" while three empty districts kept their slots, so a row that sheds now keeps the focused kind, then the raised ones, still in the row's order. `pnpm verify drawn-once` mounts a document modeled on the workshop's, the way Cloud mounts one, at 1280, 1440 and 1920 wide, in three engines and both schemes. It holds that the goal and the summary are said once, each topic once in the record, no heading in the record stands over nothing, the record covers no other card, caption or the bar, its title stands below the bar in the window, the panel says "Covers: all 4 topics", and the district's name is inside its box, at the workshop's name and at a 37-letter one, and says its count once. It also holds the same for a part with only its card, and that a view of the host's own taller than its box keeps to it. Every one of those claims failed on 0.1.17 except the one for a part with only its card. The hosted page carries 576.0 KB compiling and 532.3 KB handed a compiled app, 186 bytes more each over FR-139, and its budgets rise by that with a little room to 576.2 KB and 532.4 KB, which leaves Cloud's shell 18.8 KB under its 595; the scene before it draws is 4.1 KB more (897 697 bytes, limit 877 KB), and the pages face alone 3.8 KB minified, 1.3 KB gzipped (budgets 517 850 / 177 950). `capabilities().shipped` gains FR-141, FR-142 and FR-143.
  
  Compatibility: markup and sentences a host or a program may match. The insight observation `insight:load:<id>:<edge>` (same id) reads "<name> <the relation's words>: all <n> <plural>" or "<name> <words>: <n> of the <m> <plural>" where it read `<name> holds <n> of <m> "<edge>" — most of them`. A relation with no words is spoken from its key ("part of") where a camelCase key was printed as written. Under a kind's declared page, the record in focus is one `[data-graview-primitive="panel"]` holding `[data-graview-spec="page"]`; the `.graview-spec-host` wrapper is gone, and the page's opening title block is drawn as the panel's title. The record in focus marks its host `data-graview-record-focus`. A district's name is `[data-graview-district-name]`, `data-graview-fitted` when drawn smaller, with a `title` when cut. New: `whatBlocksSay` and `BlocksSaid` (`@graview/core/blocks`), `edgeWords` (`@graview/core`), `Connections`'s `hide`, and `useDefaultElsewhere` and `RecordHeadContext` (`@graview/primitives`). The document's view vocabulary, check finding codes, ops, stored formats, the wire and tool names are unchanged. What Graview Cloud changes: nothing to mount; its views harness can hold that a record selected Down is drawn once, by `pnpm verify drawn-once`'s claims, and anything matching the old load sentence matches the new one.
- 33884db: The security review before 0.1.18. A lazy part that failed to load asks again only for a chunk the bundle asked for (FR-139 had not shipped; 0.1.17 is not affected). `retryingImport` read the URL to import again from anywhere in the failure's words, and an import whose module arrived but threw while it ran rejects with that module's own words, which may carry any URL a message was built from: the next try would have imported it, a script from anywhere, run as the page's own. `failedUrl` now reads a URL only from an engine's own sentence for a fetch that failed, from its first word ("Failed to fetch dynamically imported module: …" in Chromium, "error loading dynamically imported module: …" in Firefox), and only on the scheme and authority the bundle's own modules came from (the retry module's own URL, or the second argument); anything else calls the bundler's import again, as where the failure names no URL.
  
  A link's pins and a view's dimensions have no prototype (shipped in 0.1.17 and before; low). `fromUrl` kept `pin.<id>` and `in.<key>` from the address in plain objects, so a link anybody could send with `#pin.__proto__=1,2` gave that stop's pins a prototype of its own (the ids `x` and `y` answered `1` and `2` where no pin was set), and `in.toString` or `in.constructor` was read back as a dimension the view had. Nothing reached the page's own `Object.prototype`. Both are now objects with no prototype, so a key a link names is only ever its own. The hosted page handed a compiled app carries 545 059 bytes (532.3 KB), 169 more; its budget rises by that to 532.5 KB.
  
  Compatibility: `fromUrl`'s `pins` and `within` are objects with no prototype (`Object.getPrototypeOf` is `null`; spread, `Object.keys` and `in` read them as before). `failedUrl` takes an optional second argument, the URL whose origin a retried import must share, and answers `undefined` for a URL on any other origin or for words that are not an engine's failed fetch. Ops, stored formats, the compiled-app format, wire messages, check finding codes and tool names and input schemas are unchanged. What Graview Cloud changes: nothing, where its page and its chunks share an origin; a host serving the framework's chunks from one origin and `@graview/core/retry` from another would see a failed part retried by the bundler's import instead.
- Updated dependencies [44d109d]
- Updated dependencies [2fba4ab]
- Updated dependencies [b00d5cf]
- Updated dependencies [7f4f1bb]
- Updated dependencies [b26a186]
- Updated dependencies [ec2c73a]
- Updated dependencies [feb577a]
- Updated dependencies [33884db]
  - @graview/core@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [cc690c4]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
  - @graview/core@0.1.17

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

## 0.1.14

### Patch Changes

- 3f02759: The room under a district's signpost is sized from its place names as the brand's face draws them (FR-118). The marquee's height was estimated from the letter count at an average letter's width, so a brand whose body is a wide display face wrapped names onto lines the city had not made room for, and the column ran past its district into the one below. The scene now measures each name with `measureText` in the face it reads off its own element (an embed scopes its brand to itself), at the marquee's size and its heavier weight, again once the brand's fonts have loaded, and wraps it word by word as the browser does; the layout sizes the band from that and hands the district the same room, and never under the estimate. Where nothing can measure — Node, jsdom — the estimate is the answer, as before.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. `LayoutOptions` takes an optional `nameWidth`, `marqueeHeightFor` an optional third argument (a `NameWidth`, exported from `@graview/layout` and `@graview/layout/view`), and `@graview/react` (and `@graview/react/drawing`) exports `useMarqueeRoom`, the room the scene reserved for a marquee of given names. A marquee in a wide face may come out taller than it did.
- 5a236ea: A name is never cut off where it is the thing to read (FR-118). Each drive-in in the scene drew its showings as thumbnails. Each was its lens at a seventeenth of its size, 54 pixels wide, with its name cut under it: "Who o…", "Strengt…", "Handof…". It was a picture nobody could read, over a name nobody could finish. A drive-in's marquee now says its showings by name, the way a marquee does. The names stand in a column hanging off the district's signpost, each one whole, wrapped onto a second line rather than cut. The showing on the billboard is marked by the column's rule in the accent. The picture is the billboard's, drawn at its own size once a showing is pressed. The layout reserves the room the names take (`marqueeHeightFor`). Pressing a name does what pressing a thumbnail did. With the thumbnails gone, the city at altitude draws no lens until one is chosen, and the one-a-frame mounting that kept them affordable is gone too. What is still cut on purpose keeps its whole name in reach. That is a chip in a cell narrower than its name, or a coverage row's name at the matrix's edge. Each carries its whole name as its title and accessible name, and pressing it selects the record, whose whole name the inspector says. The places on the bar are whole names that scroll (FR-117). A row's badge and progress label are never cut (FR-113). The new `pnpm verify quiet` measures cut-off text two ways. The first is Cloud's: a visible text leaf whose `scrollWidth` exceeds its `clientWidth` under an ellipsis, `overflow: hidden` or a line clamp. The second is geometric: a text's own box against every box above it that clips, an axis that scrolls excepted, and an SVG text against its drawing. That catches what the CSS count misses, like the scene's place tiles. On Cloud's four screens, in three engines and both schemes, nothing is cut, where 7, 3, 0 and 3 texts were before. Every place tile in the org app's scene says its whole name, at a desk and at a phone, where four of eight were cut.
  
  Compatibility: a drive-in's `.graview-drive-in-thumb` holds `.graview-drive-in-thumb-title` and the `.graview-drive-in-thumb-press` button. `.graview-drive-in-thumb-picture` and `[data-graview-thumbnail]` are no longer drawn. `@graview/primitives` no longer exports `THUMBNAIL_BUDGET`. `@graview/layout/view` no longer exports `THUMB_ONE`, `THUMB_TWO` or `THUMB_TITLE`, and exports `MARQUEE_WIDTH` (156) instead; its `MARQUEE_GAP` is 2 where it was 4. `marqueeHeightFor`, from `@graview/layout` and `@graview/layout/view`, returns the height of a column of names. A lens may still be handed `budget` and `total`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
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

## 0.1.13

### Patch Changes

- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13

## 0.1.12

### Patch Changes

- 4801c44: What only a fetched face, an agent's seat or the checker uses has left `@graview/core`'s main entry and `@graview/core/document` for subpaths named for what they hold, and the hosted page has room again. A hosted page imports both barrels up front. esbuild gives a whole file to every chunk that can reach it, so a name a barrel re-exported rode in the page's first chunk as soon as any lazily loaded face used it, though the page never called it before a reader acted. Measured from esbuild's metafile, three moves were each worth more than 2 KB. The first is `@graview/core/blocks`: a view's blocks resolved against a record, and the computed values they read. It took 8.3 KB off. The second is `@graview/core/check` with `@graview/core/scene`. The checker was reachable from both barrels: `checkApp` from the main entry, and `compileDocument` beside the compiler a page uses. Through it the page reached the city, which only the scene draws. The checked compile and template instantiation are now modules of their own, so the compiler a page uses no longer imports the checker. This took 2.6 KB off. The third is `@graview/core/figures`, the shipped drawings, which took 2.8 KB off. The page now loads 575 357 bytes up front (562 KB), where it loaded 589 079 (575 KB). Cloud's own shell, built from these sources, is 560.3 KB, where it was 573.7. The budget claim is now 572 KB: the new figure with 10 KB of headroom. The embed without the studio now loads 692 174 bytes first, where it loaded 787 572. The studio, fetched only when it is drawn, asked for `checkApp` through `@graview/core`, so the checker and the document compiler it reaches rode in the frame's first chunk. Its budget comes down to 693 500. A test names every moved export and holds it off both barrels, and the hosted page's test holds the modules themselves out of what it loads first. Some levers were measured and left alone because each was under 2 KB: `formFields` and the rest of the act form (1.8 KB), `beginning` (1.7 KB), the JSON Schema helpers (1.3 KB) and `walkKinds` (0.3 KB). zod's JSON Schema writer (20 KB) stays up front. `zod/mini`, which the page needs, re-exports `toJSONSchema`, so no subpath of ours can put it out of the page's reach while the companion's act tools use it.
  
  Compatibility: these exports moved, with no alias left behind. From `@graview/core` to `@graview/core/check`: `checkApp`, `formatFindings`, `describeApp`, `generateAgentsMd`, `generateLlmsTxt`, and the types `CheckResult`, `Finding` (the checker's), `Severity` and `DescribeOptions`. From `@graview/core/document` to `@graview/core/check`: `compileDocument` and `instantiateTemplate`. `compileDocumentWithoutCheck` stays in `@graview/core/document`. From `@graview/core/document` to `@graview/core/blocks`: `compileBlocks`, `fieldSpecsOf`, `isTallBlock`, `resolveBlocks`, `safeHref`, `sayNumber`, `computedNames`, `computedValues`, `withComputed`, and the types `BlockContext`, `ResolvedBlock`, `ResolvedList`, `SpecBlock`, `ComputedRecord`, `ComputedValues` and `PlainComputed`. From `@graview/core` to `@graview/core/scene`: `BLOCK`, `cityExtent`, `cityMap`, `heightOf`, `MAX_SIDE`, `plotsOverlap`, `roadsOf`, `sharedEdges`, `sideFor`, `toIso`, `villageCap`, `villageOf`, `sceneDistricts`, and the types `Building`, `CityHints`, `CityMap`, `Plot`, `Road`, `SceneDistrict` and `SceneDistrictOptions`. From `@graview/core/document` to `@graview/core/scene`: `sceneThumbnail`, and the types `SceneThumbnailOptions` and `ThumbnailSource`. From `@graview/core` to `@graview/core/figures`: `FIGURES`, `FIGURE_NAMES`, `figureBrief`, `figureFaults`, `figureSvg`, and the type `Figure`. `@graview/primitives` still re-exports `compileBlocks`, `safeHref`, `sayNumber` and `SpecBlock`. A project made by `graview create` imports `checkApp` and `compileDocument` from `@graview/core/check`, and a linked one aliases the four new subpaths. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [4801c44]
  - @graview/core@0.1.12

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

## 0.1.10

### Patch Changes

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

## 0.1.8

### Patch Changes

- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6

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

## 0.1.4

### Patch Changes

- 0183340: A tool's schema does not depend on zod's minor version. An agent tool's input schema is a stability surface, and zod writes its own regex for a string format — `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.iso.date()` — beside the format's name. That regex differs between zod 4.4.3, which this repository locked, and 4.6.5, which a consumer resolves from the published ranges, so Cloud's tool-schema snapshot saw sixteen "inputSchema changed" entries that were only zod's regex. `toJsonSchema`, and with it `mutationToolSchema`, `nodeJsonSchema`, `schemaJson` and the conformance kit's tools, now says a format string by its JSON-schema `format` alone (`email`, `uri`, `uuid`, `date-time`, `date` …) and drops zod's `pattern`; a pattern the author wrote with `.regex(…)` is kept, beside the format where there is one. Moving the workspace to zod 4.6.5 found a second dependence on zod's internals: zod 4.6 no longer fills a schema's `_zod.bag` as it builds it, so `describeArg` lost a number's bounds and a date's pattern, and a date argument was asked for as free text. It now reads the checks on the definition, which both versions keep. Every package's zod range is now `^4.6.5`, so the tests run on what a consumer gets.
  
  Compatibility: tool input schemas — a format-based string no longer carries zod's regex `pattern`, only its `format` (an `email` property is `{ "type": "string", "format": "email" }`); a `z.url()` property is unchanged, and an author-written pattern is kept. A snapshot of a tool surface taken with either zod version changes once, for those properties only, and then holds across zod minors. The conformance kit's recorded fixtures are unchanged: none declares a format string, and the lock holds. `describeArg` and `argShape` answer as they did on zod 4.4 for every schema, now on 4.6 too. Every package's `zod` dependency moves from `^4.4.3` to `^4.6.5` (products never install zod; `@graview/core` re-exports it). The embed's bundle budgets rise with zod 4.6, which gives every schema type its own JSON-schema processor: the pages face alone from 815,000 / 220,000 to 950,000 / 252,000 bytes and every face from 1,150,000 / 330,000 to 1,290,000 / 362,000 (minified / gzipped), about 130 kB / 30 kB of zod's that a host on zod 4.6 was already paying. The document format, ops, stored formats, the wire and check codes are unchanged.
- Updated dependencies [df9932a]
- Updated dependencies [9de42fe]
- Updated dependencies [a9c0f2d]
- Updated dependencies [75c1a26]
- Updated dependencies [e0f75bb]
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

- fb781c2: A calendar lens: month, week, day and agenda over real dates. `createCalendarLens` binds a kind's own fields to roles — a start date or date-time, an optional end, an all-day flag, a label, a done flag — the way every other starter does, and `graview check` reads the binding like the others'. Multi-day spans are drawn on every day they cover and say which piece they are; a busy month cell says "+N more" and opens that day; all-day entries sort before timed ones; done reads as done. All date arithmetic is on `YYYY-MM-DD` strings in UTC, so an entry does not land on the 13th for half the world, and `addMonths("2026-01-31", 1)` is February.
  
  Two framework capabilities the calendar forced. `ViewState.within` is where a view says where it is INSIDE itself — `in.at=2026-10-01&in.range=month` — carried in the fragment, never read by the framework, and counted as travelling rather than as an adjustment, so Back returns to the month you left. And a kind may now have SEVERAL pictures: `places()` lists every titled group view, each with an `as` slug the stop names (`in.view=the-month`), and `resolve(kind, cell, as)` picks one. Before this, registering a second titled view simply replaced the first and made it unreachable.
  
  Dragging an entry to another day is an act: `actThatMoves` asks the declaration (through the framework's own `fieldWriters`, the function the checker uses) which act writes the bound date, the store judges it, and one undo puts it back — a seat that may not is told so in the policy's own words rather than watching the entry snap back. A date-time keeps its time.
  
  Also: a control inside a view no longer selects the card it is drawn on — pressing the calendar's "next" used to select every task in the district behind it.
  
  Things shows a month over tasks by due date beside the week and the lists, all three now the framework's own named places rather than a switcher of its own. Seedbed gains a season over plantings, which means a planting now records the day it was harvested and is a span rather than a dot.
- 2aae30f: A crowded band is laid out by relation. Past what fits as chips, a band row is as tall as a group card's two lines, the gutter between rows holds a caption, and each relation starts its own row unless all of it fits the rest of the current one — so a caption never sits on the cards of the row above, and a group card is never cut to its name. `packRuns` and `bandCaps` (exported) plan the rows in arithmetic, and each relation is drawn within what the rows give it. A band card says its name and which way it opens on one line, and its count and first members on the next, "1 song" rather than "1 songs"; a record standing in a crowded band is drawn as a chip (`compact` on the layout node) rather than a summary cut to a sliver; a chip is never wider than what holds it. A grouping in which one group holds three quarters of the members is not offered. The month cells of a calendar are as tall as what is in them, so a month with three releases no longer spills over the month below, and a coverage matrix draws at most 40 rows by 24 columns.
- 475cc83: The districts at the bottom of the stack are readable: the kinds plane stops paying for depth in legibility.
  
  A district's name reached the screen at ten pixels and its kind at under eight, so the bottom of the picture was a row of grey marks rather than a map of the domain. Three things were stacked on top of each other to get there.
  
  **The plane was drawn at 78% of the room it was given.** The layout allots each district a slot and the renderer drew the card at 0.78 of it — a shrink applied *after* the reader's text size, so it was a shrink no setting could lift. The stylesheet next to it already argued the case: "Depth comes from BLUR AND FALLOFF, not from shrinking. Pushing the scale to 0.6 made the strip illegible — ten cards reading P…, REA…, S…. A map you cannot read is not a map." 0.78 was the same mistake, smaller. The planes keep a shrink — recession is still monotonic, as `frame-plan` requires — but one small enough to read as depth and no longer small enough to cost a word its legibility.
  
  **A district's name was thirteen pixels before any of that**, and its kind ten. A name is read, not glanced at.
  
  **And three more pixel sizes were hiding from the guard.** The test written last commit looked for a number straight after `fontSize:` and walked past `fontSize: nested ? 10.5 : 13` — which is how the district's own name stayed at thirteen pixels while everything around it doubled. It strips quoted values and looks at the whole expression now, and found two more in the reach lens and the panel.
  
  Two knock-ons, each fixed at its cause rather than tuned away. A fan of tucked cards is spaced in layout units and drawn at the plane's scale, so the gap between two tucks is `step − scale` of a card: at 0.86 against 0.78 that was air, and against 0.9 it became six pixels of one card sitting on its neighbour's label. And the fan was allowed the parent's width *plus the gap* — but the gap is not spare room, it is what keeps one district off the next. Both were caught by `audit-ui`, not by eye.
  
  Finally, a panel's heading wraps. Both halves of that row are sized in `rem` now, so a reader on Largest doubles them, and on a phone "The rotation · 2026–2029" reached eight pixels past the screen — caught by the calendar harness's own reader-settings check, which is exactly what it is for.
- 92a2f73: What a person reads names a field, a relation and a group in the declaration's words, never by id. `fieldWords(definition, key)` is the one place a field becomes words (its `display.labels`, else the key spoken); an editable value's tooltip no longer says "changes "plannedAt" through a mutation", the inspector no longer says a line's edge is "rides-in", the calendar's refusals and the structure suggestions ("all 3 share the day "mon"", "(assigned to)") read in words, and `bandAggregateWords` names a band's group — the seat had been calling one "album|released-by|in|type=album".
- 9f6593b: A group is a place whether or not anybody is in it. Every branch that placed a focused group required it to have members, so going to a lens over an empty kind — which on a blank app is every kind — changed the address and drew nothing. The kinds named by an aggregate address are now checked against the declaration instead, so an empty group is a real place holding nobody and `aggregate:<undeclared>` still falls back to the default view.
- fc024d0: A lens chooses its shape by the room it has, and a narrow embed keeps its room for the picture.
  
  The coverage matrix's 316px label column put every column past the edge of a phone-width card, behind a sideways scroll nothing announced — names and no cells. The names now take a share of the width, and where the columns still would not fit at a fingertip each the matrix stacks: each row is its name and then its cells as labelled marks that wrap. Seven day columns in a 300px box were 40px cells with three letters in them; below about 44px a column a run of days is drawn as the agenda, and coarser cells wrap into as many columns as the width holds. The calendar's six range chips become one select when the card is narrow.
  
  The scene kept a fifth of a 360px embed clear for rails it does not draw there, and the layout took six gaps more off a focused card: a lens got 145 pixels. Below a phone's width the rails are gone and the focus margin is capped at a tenth of the span. The embed's strip, whose place and seat pills wrapped to five rows, shows the places and the seats as one select each when it is narrow.
  
  And the example's season and rotation calendars, declared on the chapters and never handed to the views, are drawn on the pages that explain them.
- 41abe03: A lens is a drive-in: the picture stands at its kind's plot, and descending is walking up to the screen. From altitude the focused group's named picture no longer floats in the middle bound to no kind — it is a SCREEN standing on that kind's plot, anchored to the plot's far edge and centred on it, sized by the plot's side with a floor for legibility, drawn with the same natural size and shrink as before (the interface scaled, never re-laid-out small), and shrunk only as a last resort until it stands on no other district's nameplate. A picture over two kinds (`ViewMeta.across`, carried on the `Place`) stands on the road between their plots. `LayoutNode.screenOf` names the kind and survives the tween; `LayoutOptions.screens` is the registry's named places by kind. With the screen on its own plot the city no longer slides aside for a picture in the middle.
  
  Every kind with a named place has a drive-in on its district card from altitude: a dark screen and a marquee of real, keyboard-reachable buttons labelled "<plural>: <title>". Pressing a showing focuses the kind with it and descends in one gesture — the lens is already drawn at the plot, so the descent tweens from the screen to plane 0 and reads as walking up to it. On the focused drive-in, pressing another showing switches the picture without descending (`in.view` changes, the stop stays at altitude and round-trips through the address); pressing the showing that is showing walks up to it. "Focus" from altitude descends into the focused drive-in, else the selected kind's, else the first kind that has one. Focusing a drive-in off the edge of a large city re-centres the pan on its plot. `useWhereIs("screen:<kind>")` answers with the audience strip in front of the screen, where figures will stand. The road's hit corridor now keeps off card faces by its own half-width, so a press on a district's corner is the district's. The navigation harness drives all of it, including a mid-tween capture that asserts the lens moved from the plot rather than from the centre.
- 6a043bf: A lens stands on its own kind's plot. A picture across two kinds — skills down, drills across — used to stand on the road between their plots, and landed on the other village with its own district's signpost and board of showings buried under it, so the lens read as the wrong kind's. Its rows are its kind; it stands at that village's back kerb, and the road to the other kind is already on the ground.
- 45c4b9c: A line whose ends have minted ids can be selected. A relation in the selection is `edge:<kind>:<from>:<to>`, and the parser assumed no id would contain the separator — while `ctx.freshId(label, kind)` mints "item:buy-milk". So in every scaffolded app a clicked line was not recognised as an edge at all: the strip's title was the raw address and its body said nothing could be done with this mix of kinds. Each part is escaped now, whatever an app calls things.
- 1373dfb: A move belongs to the stop it was made at. A pin or a pan adjusts the picture you are looking at, stored by node id in canvas pixels; carried to the next stop it held the card you had dragged at coordinates that meant nothing there, drawn over the new focus. Changing the focus, rising or descending, and zooming in or out now start where the layout puts things, and the old stop keeps its arrangement in its own address, so Back returns to it. The navigation harness drags, travels, and comes back.
- c5e4ac7: A robot you can catch, and a robot worth looking at. A following robot holds still when a hand comes for it, so it can be pressed to let go. The figure is redrawn: a dome head with a visor and eyes, an antenna that lights while it follows, the city's own iso block for a body, an arm that comes up with a pen while it writes. The drive-in from altitude loses its grey stand-in screen; the marquee band is sized from its showings wrapped to the card, and the building under it sizes from the room that is left, so showings no longer stand on a roof.
- 42c2c96: An opened district keeps four rows of its roster however crowded the city is; the city grows before the list goes under four. Sized honestly, a crowded city gave an opened district of four kinds one row and counted the other three, and opening it answered nothing.
- 60efe3b: A kind tucked behind a kind the row sheds goes into "+N more" with it. Its parent has no slot to hang off, and the fallback drew it at the end of the row — at the "+N more" card's own place, under it — so a dealership focused on a lot had Deals and Service appointments stacked behind "+3 more", reachable neither by pointer nor from the list, which named only three.
- 22e0668: An edge reads from the end you are standing on. The caption over a neighbour in the scene took the declaring side's words in both directions, so a gardener's plot was captioned "who looks after it" as though the plot looked after her; it now takes the declaration's `inverse` along an incoming edge, as the connections panel and the pages already did. `graview check` warns `edge-without-inverse` for any edge declared with one reading or none, naming what the far end would be captioned with. The scaffold, the seedbed and the launcher declare both readings.
- d59b6c8: An opened district lists what it has room for, in names you can read. The layout reserved 96 pixels under an opened district and the view listed sixteen members in 250, two columns of ninety-five pixels, under a header whose name column could shrink to nothing: a dealership's Vehicles, opened at the foot of an eight-district city, read "VEHICL291ES" over sixteen chips of "2026 Ma…" running off the scene. The layout now reserves rows (`rosterRows`, `rosterHeight`, `ROSTER_ROW` exported), tells the view how many the city kept room for (`openedRows`, carried through the tween), and the view lists that many in as many columns as the names can be read in (`rosterOf`), with the rest counted. The header wraps its count under the name.
- de75e21: Carrying a search's words into a district is never the way back out. `withJackIn(…, { carry })` on the district you are already zoomed into narrows it where you stand; before, the jack-in's toggle ran first, so pressing a lit district's count or a kind hit in the Find box from inside that district zoomed you out and dropped the words. A bare jack-in on the zoomed district is still the toggle out.
- d36e6fa: A kind with a picture of its own is where "deeper" goes. From altitude, going deeper into a district exploded it into a ring of chips whether or not the app had registered a lens over that kind — trading a designed picture for the fallback it exists to improve on, while the card's own ◆ said the picture was there. A group with its own view now travels into it and leaves its district shut; a group without one opens in place exactly as before.
- 7244498: Going deeper into a group card goes into the group. Double-clicking a shelf card or a district once focused the card's own id, which no layout resolves, so the scene emptied with the card's name in the URL. `withJackIn` in @graview/layout is the one reading of the gesture: a record zooms (and zooms back out), a kind card on the ground zooms into its group as a place, and a district at altitude opens in place and closes again. The scene's double-click and `useJackIn().enter` both go through it.
- 796bf9e: Every picture paints at a real size. A panel's "there is more" fade is painted in the panel's own ground rather than masked: a mask made the scroller an offscreen layer, and one painted before its rows arrived stayed black. A thumbnail waiting to be drawn is as tall as a picture, so one drawn at a twentieth of its size is still seen and drawn, and two pictures' names each keep to their own frame. A kind tucks behind the kind it hangs off only when the row needs the room; with room for every kind, each has a slot of its own. A calendar horizon longer than a decade draws a year to a cell. A card on the relation plane shorter than a summary's 80 pixels draws as a chip rather than a title and a sliver. The coverage matrix is built from an adjacency rather than a scan of every edge per column, a view's group members are looked up once per graph, and a tween's stand-ins once per pair of stops.
- 0bb6827: Flying closer is travel, not a cut. The cards rode the tween and the ground under them did not: the lattice, the plots and the roads were drawn from the live pan and from the destination's own cell, so choosing a picture snapped the whole ground to the new place on one frame while the buildings walked over to join it. Two things were wrong. The city frame did not record the pan its cards were laid out with, so the ground could not ride the same interpolation — it does now, and the tween lerps it. And an interrupted tween froze its origin by spreading the destination, which carried the destination's city into what the next tween starts from: every flight interpolated the ground from where it was going to where it was going. The frozen origin keeps the ground it was actually standing on, and the navigation harness fails if the cell leaps rather than eases.
- 3f5d3ba: What an id means in the picture (`aggregate:`, `kind:`, reading one, going into one, the stable order by id) is `ids.ts`, and what stands on the relation band and the lines drawn to it is `related.ts`; `layout.ts` keeps the algorithm, which stays one function because it is one sequence of decisions. Nothing exported changed.
- 5343a1d: The relation band draws what a person can read. Its budget is the cards a row holds at a readable width times the rows it holds at a chip's height; below it nothing changes. Above it each relation (a run of one edge kind in one direction) stands whole if it is small, groups by what its members' own declaration offers — another edge's far end, a choice, a date by decade, year or month, never the relation's own edge, about five groups where it can — or keeps its most relevant members (the selection, the search's hits, the flagged, the recently written, the most connected) in its own order beside one "+N more" door. Groups are aggregates named in the graph's words with true counts, drawn as a band card with their first names, heard as "Single, 80 albums", and opened in place by the `expanded` stop; the door opens the kind's picture filtered by the relation. `bandOf`, `chooseGrouping`, `shares` and `isBandAggregate` are exported from `@graview/layout`, `LayoutOptions.relevance` carries what stands, and the arrangement's dates group by `year` and `decade` too. Focusing an artist with 1,100 songs draws 36 hosts and 50 line strands instead of 1,259 and 2,214.
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
- 481340c: The city grows with the reader: a district card is sized in the reader's own text, not in pixels.
  
  The last thing that did not scale, fixed rather than named. A district card holds a name and a count, both sized in `rem` so a reader who asks for bigger words gets them — and the card itself was sized in pixels off the stage, so it never heard about the setting. At 200% every name in the city doubled inside a card that stayed exactly 230×97: a headline in a glyph.
  
  The layout takes a `unit` now — what one `rem` is worth in pixels — and sizes its cards, its floors and the room an opened district lists its members in by it. The Scene reads it from the root element rather than from a setting's name, because the scene has no business knowing what an app called its text-size control, and the browser's own default is a size no app declares at all. It watches both: the root's `style` for the app's control, a resize for the browser's.
  
  Cards cannot simply take the number, though — a ring is a fixed amount of ground, and cards at twice the size on the same ellipse are districts standing in each other. So the scale is the MOST the ring will use, and it gives back whatever it must to keep the ring a ring, down to the size cards have always been and never below. A reader gets bigger words everywhere and as much bigger a city as there is room for. `unit: 16` is the browser's default and the no-op: every existing caller lays out exactly as it did, which the tests assert directly.
  
  Measured rather than asserted, end to end: the probe that started this — load the app at the browser's own size and at Largest, diff every box — now reports one box that does not grow, and it is the viewport. `audit-ui` gained a `largest` state for Things and the garden, so every count it already makes (collisions, controls under 24px, text cut mid-word, anything off-screen) is made at 200% too, where none of them had ever been made before. All clean.
- 3e719c8: A kind is a neighbourhood: the city is a map drawn from the declaration, and everything in it has an address. `cityMap(schema, hints)` in `@graview/core` is pure and deterministic: it walks the kinds in the order a blank installation fills them (`beginning(app).order`, or sorted ids), puts the first at the origin and each next kind on the free block beside the placed kind it shares the most declared edges with, spiralling outward — in LATTICE CELLS, never pixels. Same declaration, same map; adding a kind leaves every existing plot where it was; population changes a plot's `side` and never its corner. A kind may declare `plot: { col, row }` and is put exactly there; `graview check` reports two on one block as `plot-overlap`. `roadsOf` names the roads between placed kinds, and `graview describe` reads the city out — each kind's plot and its roads — the first thing outside a browser that can say what is drawn.
  
  At altitude `layout()` places the districts by the map on the 2:1 lattice under ONE uniform scale and translate (`placeCity`), so the city has the same shape at 1280 and at 390 wide; nearer rows are drawn nearer with the depth number every plane style already reads; the collision shrink stays as a safety net, the opened listing gives up its room before the city grows, and the city slides aside for the live view standing in the middle rather than laying a district under it. `LayoutNode.plot` carries the address and survives `interpolate.mix` mid-tween; `Layout.city` says which lattice the picture is on, and the ground draws its diamonds at that cell, anchored where cell (0,0) meets the canvas and panning with it. Roads: a connector between two districts runs along the lattice's diagonals (`latticePoints`). Buildings: an opened district lays its members out as a `side`-wide grid inside its plot, each still a pick target, capped at `side × side` with "+n". The camera is bounded by the map's extent (`cameraLimit`) rather than a canvas fraction, so a city wider than a phone is reached by panning and nothing is dropped off the edge.
  
  `useWhereIs()` answers where a node, a kind card, a group or a Place slug is drawn from the CURRENT frame — riding the tween and the pan, measured from the DOM when there is one — with a member not drawn itself answering as its nearest drawn container, the connectors' own rule. `useScenePointer()` is the pointer over the scene in scene coordinates, and a quiet scene runs no listener: the store counts its subscribers and the scene attaches on the first, detaches on the last.
- 206670e: At altitude the city stands beside the rails, not under them. A five-kind app laid its leftmost district under the inspector at 1280 and 1560: the map was centred on its lattice's bounding diamond rather than on the districts, and "off the edge" was measured against the canvas rather than the room the rails leave. A city whose districts fit between the rails now slides the least distance that puts them all there.
- f80138a: The city zooms and pans by hand. From altitude the pinch and ctrl+wheel used to step the altitude once, with a cooldown — a zoom that stuck — and the drag clamped the person's own pan while the camera's flight to a village sat on top of it, so the far side of a flown-closer city could not be reached. There is a scene zoom now, changed continuously by pinch and ctrl+wheel about the pointer and by zoom controls in the ground's corner, with the fly-closer step multiplied in; the plain wheel over the ground pans; the drag clamps the whole offset, pan plus camera, to the camera limit, so every district is reachable; direct manipulation is not tweened; the zoom resets on the way down. And a tween restarted mid-flight keeps its clock and its easing velocity, so a storm of restarts — two hosts reporting, a pointer's worth of wheel events — no longer crawls a pixel a frame.
- 2c20c53: The edge says what is past it. A city wider than the window keeps its shape and is reached by panning, and on a phone the gauntlet's Topics and Staff stood wholly past the left edge with nothing on the screen saying they were there: a pointer had nothing to press. From altitude, every district whose middle is past an edge now has a sign on that edge, in its own name and pointing at it, and pressing the sign pans the ground until the district is in view. `districtsPastTheEdge(layout)` names them, with the side and the pan.
- 89f4855: The ground is the city's own grid, and a billboard sinks into its village. The lattice was four repeating gradients phased from the middle of the box and seamed at its edge, so its lines never sat where the city's cells were; it is drawn as tiles now, one cell by half a cell with both diagonals, pinned where cell (0,0) meets the canvas, so every plot corner is a lattice vertex at every zoom. The tween carries the city with it: between two cities the cell and origin lerp, so plots, roads and lattice grow and slide with the cards on them; rising, the lattice arrives with the destination; descending, the ground stays while it fades. And switching lenses across kinds no longer leaves the old picture standing at full size under the new one for the length of the tween — a leaving billboard had no stand-in, since a village's members are ground, not nodes — it shrinks into its kind's signpost and board, and the next rises out of its own.
- e0d5026: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- 6a043bf: The lenses are pictures, and choosing one flies closer. From altitude a district's board shows each of its lenses as a small live version of the lens under its name, not a label. Pressing one stays aloft: the kind is focused with that showing, the billboard on its plot shows it, the city's cell grows by half so the camera is brought in toward that village, and the camera centres on the drive-in with the picture's top kept inside. The billboard carries the one way down, a full-screen control that leaves the graview with that picture. The billboard's foot stays on the kerb wherever that is; the camera brings it in rather than the layout sliding it down over its own village. The billboard is cut to its picture: a lens lays itself out in a box as tall as the window, and the billboard used to show the whole box, its picture floating a village's height above the kerb — the scene now measures how much the lens actually drew (what is in flow, plus what its scroll regions need beyond what they have) and the layout sizes the billboard to that, floored so a title alone is not a picture. The small lenses on the board are inert: nothing drawn inside one takes focus or a press. The billboard's frame, posts and ground sit on the picture's box, so an empty lens is a header over an empty screen rather than a strip floating over the village.
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
- ae188cc: The scene holds sixty frames a second on a real catalogue. Nothing measures while it moves: lines and their captions are drawn once a transition settles, and pick targets are marked when the DOM changes rather than every render. A card held by the hand moves alone — `holdLayout`, exported, moves one node and re-aims the lines that touch it instead of laying the stop out again. The focus's kind tag is placed when its panel resizes, not by reading two bounding boxes after every render, which forced a layout on every frame of a transition. Invariants are evaluated once per change however many views ask, where each picture evaluated the whole graph as it mounted. `connectorsFor` and `interpolate` are linear, a host's signature keys its group by count and hash rather than joining every member id, and a line's anchors are read from one index of the host. A host's blur is its nearest plane's, so it changes once in a transition rather than every frame. Over Tech N9ne's catalogue the hub lands in one frame of about 57 ms and every frame after it, dragging, wheeling, moving a card, selecting and typing, fits sixty.
- 6dd2cfd: The screen stands on its plot and the signs stand on the land. From altitude a focused place's picture is a billboard at the back kerb of its plot, framed, on two posts, with no clearance needed above its card; the nameplate is a signpost planted at the plot's front corner on a short post; the drive-in's board of showings hangs under the signpost in the ground the layout reserved for it; the kind's landmark stands in the village square among the buildings. The "shown above" note on a focused plate is gone: the screen says where the members are.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- 6e8a02c: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- 3cb6d60: What a review of the villages found. Pressing a plot's tile focuses the district's aggregate rather than the card's own id, and not on the click a pan produces on its way up; going back up before the descent's glide has landed no longer wipes the altitude camera; a host that answers the chat itself (`respond`) hides the ladder in the profile; the signpost rule applies only to cards on a plot, so a nested card's plate stays where it was; the screen's collision guard protects the plate where it stands now (below the card), not where it used to; road and village geometry is computed once per city and translated per frame.
- cb196b1: What the scale review found. A band's group stays selected when pressed: its id names a run of a relation, not a kind, and the check for whether a selection still exists dropped it at once. A card of one kind, where a relation holds several, opens in place when pressed instead of changing the stop and drawing the same band. The focus's kind tag sits on the panel's corner again on the altitude stamp, measured from the drawn boxes with the plane's scale taken out, from the resize observer where the reads force nothing. And a card moved in place no longer lays the stop out again on every move once the ground has been panned.
- 5b401bb: What the review of search found. A boolean field is a state, asked for as a condition (`done:false`), not a word: it read as "No", so "n" found every open task in the Find box, a list's `?q=` and the chat — `searchableFields`, `describe` and `llms.txt` no longer list booleans. The picture lights every match from the result's new `matched` list rather than the strip's capped hits. A list's `q` made only of tokens nothing offers (a pasted `https://…`) finds nothing, as the Find box does, and a lone `is:flagged`, `is:clear` or `is:past` narrows in both. `actsOn(store, id, words)` lists a record's acts without a search of the graph; `search()` takes `touched`, and the scene works out what is flagged and touched once per graph change, not per keystroke; a list parses its words once rather than once per row. A lit district's count, Enter on a kind hit and a double-click are one transition — `withJackIn(…, { carry })` — which comes down to the ground, close and narrowed. The row's words (`in.q`) no longer follow you to the next focus, and `withoutSearch` clears the search with the words it carried. A pick in the pages face's Ask drawer goes to the record's page (`onPick` on `ChatPanel` and `Companion`), and the list page reuses the affordances it already has for search-to-create.
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

- 37bb6af: The constellation says what it means: relations drawn at full strength from
  above the stack (where the lines are the content rather than an aside),
  receding when a kind is selected so its own relations stand out, and a derived
  `RelationKey` naming each edge kind with the exact stroke the scene draws.
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
