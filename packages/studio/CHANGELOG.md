# @graview/studio

## 0.1.62

### Patch Changes

- c8ac8e8: A rule can cover every record without a cost warning, Roadmap f-rule-covers-every. "Every candidate has a stance on every issue the guide covers" could be written only by counting the distinct issues a candidate's stances reach against `all('issue')`, and the checker rightly said `rule-cost` of it — the evaluator would walk every issue for every candidate — which a curated template may not carry, so the voter guide said only "has a stance on file". A rule now declares the shape instead: `{ "over": "candidate", "covers": { "every": "issue", "through": "stances", "via": "issue" }, "says": "{candidate} has no stance on {issue}" }` — `through` a relation of the rule's kind (or one that points at it) and `via` one more where the first lands on a kind in between, or `through` alone when it reaches the covered kind directly. The store judges it in one pass over the record's links (`uncovered`, a set per record held against the kind's live records), never through the expression evaluator, so there is no budget to run out of and no cost to warn of; each far record the subject does not reach is one problem naming both, and the sentence may name either by its kind beside the subject's fields. Its line reads "reaches every issue through stances, then issue", and broken, "does not reach Parks through stances, then issue". `graview check` says a relation that does not exist or does not lead from the kind to the covered one as `rule-covers-relation`, at `covers.through` or `covers.via` and in the person's voice with the way out ("add "via": the relation from stance to issue"), and a kind that is none as `rule-kind`; a rule that says both or neither of `require` and `covers`, or `covers` over the whole graph, is refused by path. A renamed kind or relation is followed in `covers`, and the rule goes with the kind it covers or a relation it walks. The same rule in TypeScript is `coverageRule` on `@graview/core/document`, which `toDocument` writes as `covers`; the studio keeps one through its round trip (`coversEvery`, `coversThrough`, `coversVia` on a rule) and writes it back as `coverageRule`, and `graview serve`'s source editor adds one beside the checkout's rules. The graview-invariant skill says the shape.
  
  Reading the shape, resolving the walk and judging it costs a hosted page 3.1 KB more up front (3_192 bytes minified, 1_029 gzipped), and a page handed a compiled app 2.2 KB (2_212, 717), under raises naming this changeset; a visitor's form handed a compiled app 2_207 / 724 more, every face 7_700 / 2_258, the embed with the studio handed in 7_154 / 2_117 and Cloud's worker 10_564 bytes, each under a raise of its own; the scene face before it draws measured 1_064_463 B (1040 KB).
  
  Compatibility: ops and primitives — unchanged. Stored formats — unchanged; a compiled app's `RulePlan` may carry `covers` (each step with its direction) and no `require`, which a page handed one from this build reads. The wire — unchanged. The declaration and check finding codes — a rule gains the key `covers` and `require` becomes optional beside it (one of the two, refined by the schema and said again in `document.schema.json`); the finding code `rule-covers-relation` is new and said only of `covers`; an `InvariantDefinition`'s `judgment` and `shape` may carry `covers` and no `require`, so a host that read `judgment.require` as a string reads it as optional; no declaration that passed is refused. Derived tool names and input schemas — unchanged. What Graview Cloud does: write the voter guide's rule as `covers` and drop the "has a stance on file" stand-in; a build that predates `covers` refuses it at `rules.<rule>.covers`, so Cloud stores one only on a build whose document schema has it.
- 0e74201: Ask AI in an app proposes a change to the app itself (Roadmap f-seat-reshape). The seat's tools read, and the right-click menu's suggestions — learned and tidying — cover records, so "we also need to track who's driving" or "split this into before and after the trip" had no path inside the app: it went to a chat somewhere else. Now the person's words are matched to structure through the same judgments as the new-app starter: `@graview/tools/reshape`, a new entry, asks a Noul per trait the app lacks (`need:<trait>`: "does what they asked for need people who own things, which this app has no part for yet?") and a Noul per part it has (`drop:kind:<name>`, `drop:trait:<name>`: "did they ask to stop keeping areas?") over one state — what they said and the app in words — through whatever `decide` the host passes (Jev, as `dream` takes one; a stub in a test); `readReshape(answers, thresholds)` reads the answers (a trait added at 0.7, a kind or trait dropped at 0.7 — dropping loses records, so the bar is never lower) with every raw Noul kept; `reshapeCard({ said, document, add, drop })` says the card in words — `said` in one sentence ("This adds people who own things and keeps categories and vendors."), `adds` (each trait with what its module brings, from a new `TRAIT_BRINGS` beside `TRAIT_WORDS`: "a person kind (or the people the app has), an owner link, Give it to someone, …"), `keeps`, `drops`, and `breaking` as far as the seat can say ("All categories records go, with their links.") — and `proposeReshape({ said, document, decide })` runs the turn, its proposal null when the reading changes nothing. The conversation draws the card beneath the seat's answer (`ChatPanel`): added, kept and dropped as chips the person turns off and on, each toggle said again by the same function so what they accept is always the reading the card shows, breaking changes above the press; Accept hands the proposal — `{ said, add, drop, card }`, the reading as the person left it, never edits — to the host's `onProposeChange(proposal) → "applied" | "declined"`, on `GraviewProvider`, `FrameOptions` (so `mount`, `<Embed>` and the pages alone take it) and the pages' context, beside `onKeepLens`. The host composes the edits from that reading: `composeReshape({ document, add, drop })` on `@graview/core/compose` runs `startingDocument` on the app's own document and answers its `edits` (which `startingDocument` now carries beside `took`, `left` and `said`: the ones that took, in order, replaying onto the base in one `editDocument` call to the document it composed) with `breaking` said from each removal (`breakingOf`) and `notDone`; the host previews them with its data and applies them as the person, as one undoable change, under its own policy, or declines. Code writes every edit, the model never a kind, a field or a rule — and the composer never rides on a page: a page that fetched `@graview/core/compose` when asked made the editor and the critic live up front, which no page carries, so the vocabulary and a document's reading alone stand on a new entry, `@graview/core/traits` (`TRAITS`, `TRAIT_WORDS`, `TRAIT_BRINGS`, `traitsOfDocument`, `hasTrait`, `traitWords`), `traitsOf` of a TypeScript app stays on `/compose` with the composer, and the document barrel says `documentOf` and `rememberDocument` from where they live rather than through the writer. A host's model with tools is offered `propose_change` on its turn — the Roadmap's `propose-change`, spelled as the surface spells its tools — told the card and never an edit, and the card it proposed travels on the reply. The tool exists only for a seat whose role may change the declaration (`mayChangeDeclaration` on `@graview/tools`, the judgment the studio's door now shares: an owner or editor, never a viewer) with a host that handed the hook and a model that decides, over an app with a document to change — the one it was compiled from (`documentOfApp`); an app declared in code remembers itself first (`rememberDocument(app, toDocument(app).document)`, as Things does for its harness) or is offered none. For any other seat there is no door and no card, nothing refused. The panel reads the words for a change to the app conservatively ("we also need", "keep track of who", "add a field", "no longer need … any more"), and a reading that adds and drops nothing goes on to the usual answer. `graview serve`'s own seat passes no hook: the served page has no path that writes its document. A hosted page carries 0.1 KB more up front (145 bytes minified, 70 gzipped: the provider and the frame carry the hook, and the barrel exports `documentOf`); handed a compiled app, 0.2 KB (197 and 197); the pages face alone 334 / 218 more, the embed with the studio handed in 702 / 950, every face 23_150 / 9_033 across the doors a face can fetch — the reading, the card and the seat's tool riding the seat's model, never up front — and the guest host registering a worker view 0 / 1, its own bytes unchanged and the chunk names its imports carry gzipping a byte larger beside the new doors, each under a raise in `scripts/budget-raises/the-seat-proposes-a-change-to-the-app-*.json` naming this changeset. `the-seat-proposes-a-change-to-the-app-from-words.test.ts`, `the-seat-offers-a-change-to-the-app-only-with-a-host-to-apply-it.test.tsx` and the starting-document test hold it, and the seat harness drives the keeper's "we also need who's driving" on Things to the card and through Accept, with a member drawing none. The agent-seat and studio skills say it.
  
  Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged; `startingDocument` answers one more key, `edits`, and `composeReshape`, `breakingOf` and `TRAIT_BRINGS` are additions on `/compose`, `@graview/core/traits` a new entry carrying what `/compose` already named. Derived tool names and input schemas — unchanged on `graview mcp` and `toolDefinitions`: `propose_change` is listed only on a seat's turn whose context carries `reshape`, which only a host with `onProposeChange` hands it. What Graview Cloud does: pass `onProposeChange` to `mount` for an owner's or editor's seat; on its server, `composeReshape({ document, add, drop })` from the proposal, preview the edits through its own propose_change and apply them through apply_change as the person; decline for a plan without structure changes.
- Updated dependencies [011ac97]
- Updated dependencies [c8ac8e8]
- Updated dependencies [055b1eb]
- Updated dependencies [8f990e3]
- Updated dependencies [f4da101]
- Updated dependencies [55649fe]
- Updated dependencies [7d85f11]
- Updated dependencies [b5ced87]
- Updated dependencies [d9d288c]
- Updated dependencies [509832a]
- Updated dependencies [1d2b75a]
- Updated dependencies [0e74201]
  - @graview/pages@0.1.62
  - @graview/core@0.1.62
  - @graview/ship@0.1.62
  - @graview/primitives@0.1.62
  - @graview/tools@0.1.62
  - @graview/react@0.1.62
  - @graview/layout@0.1.62

## 0.1.61

### Patch Changes

- c9fd45a: A choice takes several of its options at once (FR-233), Roadmap f-multi-select-enum; `capabilities().shipped` gains FR-233. An enum took one option and a list took free words, so a memo's recipients — the CTO, the developers, QA, product — had nowhere to be several fixed options. A field is now `{ "type": "enum", "multiple": true, "options": [...] }`: the one shape an enum already has, so its `options`, its `optionLabels` (0.1.56) and `set-options` carry over unchanged, rather than a `list` with `options`, which would have given options a second home on a type whose `of` already says what it holds. It compiles to a list of the options (`z.array(z.enum(...))`), which `fieldSpecOf` reads back as the same field and the generated types say as an array of the union. A record's facts, a card, a glance, a change's sentence and a sheet (`/csv`, `/words`) say each option it holds by its label, "CTO, QA"; a form on the routed face asks with a box per option and sends the list of those ticked, in the options' order; a record's page changes it in place as the same boxes; the scene's ask strip already toggled several of a choice. A list filters by one of its options (`/arrange`, the filter chips and a view's `where`) and is neither sorted nor grouped by it — a record would stand in several groups — which `graview check` says of a list declared grouped by one and of a board bound to one. An import (`/import`, `import_rows`) reads a cell that lists them, "CTO; QA" or "developers, product"; a Notion connection holds it in a multi-select (`notionFieldType`, `several choices` in `NOTION_FITS`), never a select; a derived act's JSON Schema and tool schema ask for an array of the enum (`/json-schema`); a migration keeps the options that fit when a field changes between one and several (`coerce`). The studio's meta-schema has `multiple` on a field, `add-field` and `retype-field` take it, `set-multiple` changes it alone, and a declaration's list of an enum round-trips through the studio's graph, its source and its edits. `multiple` on a field that is not an enum is refused as a shape finding at `kinds.<kind>.fields.<field>.multiple`, in `graview check` and in `document.schema.json` alike; a default outside the options, or a single one where a list is wanted, is `default-option`. The graview-node-kind skill says the shape in one line. `a-choice-takes-several-options.test.ts`, `a-form-asks-for-several-options-as-boxes.test.tsx`, `several-options-changed-in-place-as-boxes.test.tsx` and `a-choice-of-several-round-trips-through-the-studio.test.ts` hold it, and the field-types harness opens a rehearsal's sections on the page and in the form.
  
  Reading the shape, compiling the list and saying its options costs a hosted page 0.5 KB more up front (522 bytes minified, 278 fewer gzipped), and a page handed a compiled app 0.2 KB (161 more minified, 271 fewer gzipped), under raises naming this changeset; the pages face alone 2_246 / 565 more, a visitor's form alone 709 / 126, a visitor's form handed a compiled app 863 / 102, every face 1_480 gzipped, the guest host 36 / 12 registering a view, 6 drawing a worker and 72 on the open kit, and Cloud's worker 4_641 bytes, each under a raise of its own; the scene face before it draws measured 1_054_746 B (1031 KB).
  
  Compatibility: ops and primitives — unchanged. Stored formats — unchanged; a record of such a field holds a JSON array of its options, as a list field does. The wire — unchanged. The declaration and check finding codes — a field gains the key `multiple` (an enum's only; on any other type it is refused as `shape` at `kinds.<kind>.fields.<field>.multiple`, as `options` is), `default-option` also judges a list default, `retype-field` takes `multiple`, and a Notion `connection-field-type` finding names `several choices` for such a field; every other code is unchanged. Derived tool names and input schemas — a form field of a list of an enum is now one `choice` control with `multiple: true` where it was a `list` of `choice` controls (`FormField`); a tool's input schema for the argument is the array of the enum it already was. What Graview Cloud does: declares `"multiple": true` on an enum that takes several; draws a `choice` form field with `multiple` as checkboxes if it draws its own forms.
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
  - @graview/pages@0.1.61
  - @graview/primitives@0.1.61
  - @graview/tools@0.1.61
  - @graview/ship@0.1.61
  - @graview/react@0.1.61
  - @graview/layout@0.1.61

## 0.1.60

### Patch Changes

- Updated dependencies [613489b]
- Updated dependencies [4eda24b]
- Updated dependencies [4e41a99]
- Updated dependencies [4affb32]
- Updated dependencies [b253ca8]
- Updated dependencies [3e2d346]
  - @graview/core@0.1.60
  - @graview/ship@0.1.60
  - @graview/tools@0.1.60
  - @graview/primitives@0.1.60
  - @graview/layout@0.1.60
  - @graview/pages@0.1.60
  - @graview/react@0.1.60

## 0.1.59

### Patch Changes

- 350fc01: A kind's figure is judged as the page reads it, and judged again where it is drawn. `figureFaults` found attributes by looking for a space or a quote before each name, but the HTML parser also takes a `/` as the gap between two attributes, so `<path d="…"/onclick="…"/>` passed `graview check`, the checked `compileDocument` and a model's `drawFigure` as a plain path, and `KindFigure` drew it with a live click handler (a smuggled `style` could stretch it over the page). Now `figureFaults` first reads the art with `svgProblem`, the reader a logo is judged by, which walks tags as the parser does and refuses a handler, a style sheet or anything that reaches outside the picture ("it cannot be drawn as it is: it has an event handler (an on… attribute)"), and its own scan of attribute names counts a `/` as a gap. `figureSvg` hands back inline art only when `svgProblem` finds nothing in it that could run or reach outside it, so `KindFigure` and the studio's proposed drawing draw nothing that could run even from a figure nothing checked — a brand's own drawing, a document compiled without the check. A figure that only breaks the house style (a literal color) still draws. Every shipped figure passes. `a-figure-is-judged-as-the-page-reads-it.test.ts` holds three slashed payloads faulted, undrawn and refused by `compileDocument`; `a-figure-that-could-act-is-not-drawn.test.tsx` holds that `KindFigure` draws no handler from a kind's figure or a brand's. A visitor's form draws figures and did not carry `svgProblem`, so it grows about 4.3 KB; with the other fixes of this batch (a typeface quoted in pairs, a plan review applying only the rows kept) a visitor's form carries 4_368 / 1_818 bytes more (4_739 / 1_970 handed a compiled app), the pages face 104 / 28, every face 948 / 455, Cloud's worker 835 and the scene before it draws 470, each under a raise of its own (`scripts/budget-raises/data-is-never-code-*.json`).
  
  Compatibility: ops and primitives, stored formats, the wire, derived tool names and input schemas — unchanged. The declaration and check finding codes — no new code: `figure` is said of art with an attribute written after a `/`, which compiled before and is refused now.
- d0edd75: The studio writes what a declaration says back into TypeScript as text, never as code. A new act's title went raw into the template literal of its history sentence, so a title with `${…}` in it ran when the act was described, and the app's name went raw into the comment at the head of `schema.ts`, `mutations.ts`, `invariants.ts` and `policy.ts`, so a document named `Vendors */ globalThis.x = 1; /*` added a statement that ran when the checkout imported the file. Both reach the files the studio door writes into `src/domain` and the ones `studio.files()` hands back. Now the title is written as the template literal's text (a backtick, `${` and a backslash escaped), the name as one line no `*/` in it can close, an act's argument or written field that is not a word as a quoted key (`args["…"]`), and a quoted string with U+2028 and U+2029 escaped, so none can end the `//` comment it is said in. `declaration-text-is-written-back-as-text.test.ts` writes a document named with `*/` and a new act titled with `${…}`, a backtick and a backslash, imports every file, finds nothing ran, and reads the act's sentence back word for word; an act writing a field named like code is written with its name quoted.
  
  Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas — unchanged. The files the studio writes read the same for a title, a name and arguments that are plain words.
- Updated dependencies [26a8127]
- Updated dependencies [83fe4cb]
- Updated dependencies [c33c732]
- Updated dependencies [85f0794]
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
  - @graview/primitives@0.1.59
  - @graview/tools@0.1.59
  - @graview/react@0.1.59
  - @graview/pages@0.1.59
  - @graview/layout@0.1.59

## 0.1.58

### Patch Changes

- Updated dependencies [aa50c1d]
- Updated dependencies [942e8c9]
- Updated dependencies [039af05]
  - @graview/core@0.1.58
  - @graview/ship@0.1.58
  - @graview/primitives@0.1.58
  - @graview/layout@0.1.58
  - @graview/pages@0.1.58
  - @graview/react@0.1.58
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
  - @graview/core@0.1.57
  - @graview/primitives@0.1.57
  - @graview/tools@0.1.57
  - @graview/pages@0.1.57
  - @graview/react@0.1.57
  - @graview/layout@0.1.57
  - @graview/ship@0.1.57

## 0.1.56

### Patch Changes

- 5bb8e6e: Every option of a choice has a label a person reads (Roadmap f-option-labels). Option values added to an enum field showed as their ids in views: a worker view was handed `state-sponsored` and nothing to say it with, and a list grouped by a choice headed each group with the option's id. An enum field in a document now takes `optionLabels` — `{ "state-sponsored": "State-sponsored" }` — and an option given none is said as its id spoken ("Hacktivism"; "state-sponsored" alone is "State sponsored"). Every face says it: a record's facts and glance, a form's picker, a change's sentence, a group's heading (a list's, and the Group column of its CSV), and a worker view, whose props carry `choices` — kind → field → option → label for the kinds of the records it is handed, so it draws `props.choices.actor.motive[node.motive]`. `set-options` carries a label for an option it adds or one already offered (`labels: { "state-sponsored": "State-sponsored" }`, `null` going back to the id's words), and says it ("now also offers \"state-sponsored\" (State-sponsored)"); a label goes with its option when the option is removed or the field retyped, and a label for no option is refused. Core's tests hold a label kept, said on each face and relabeled; guest's that a view is handed `choices` and the record keeps the id. The studio's relations made only as a record is made (a field's kind, an act's kinds, a grant's roles and acts, a sight's) say `acts: "none"`, so none is given a derived connect now that a creating act no longer replaces it (Roadmap f-connect-every-relation).
  
  Compatibility: ops and primitives and stored formats — unchanged. The declaration — additive: `optionLabels` on an enum field, `labels` on `set-options`. Derived tool names and input schemas — unchanged. The wire — additive: `GuestProps.choices`. The JavaScript API — additive: `choiceWords` on `@graview/core`. A list grouped by a choice now heads its groups (and a CSV's Group column) with the option's words rather than its id. What Graview Cloud does: takes this build; `propose_change`'s option edits pass a label as `set-options` `labels` when one is given, and custom views draw `props.choices`.
- Updated dependencies [c7bdc23]
- Updated dependencies [3149e79]
- Updated dependencies [d3ab92d]
- Updated dependencies [d97578e]
- Updated dependencies [846963c]
- Updated dependencies [3149e79]
- Updated dependencies [8e25c9f]
- Updated dependencies [5bb8e6e]
- Updated dependencies [605a44f]
- Updated dependencies [d97578e]
- Updated dependencies [92040e8]
  - @graview/core@0.1.56
  - @graview/primitives@0.1.56
  - @graview/pages@0.1.56
  - @graview/ship@0.1.56
  - @graview/tools@0.1.56
  - @graview/layout@0.1.56
  - @graview/react@0.1.56

## 0.1.55

### Patch Changes

- 3648ead: An app says who it is for and what they come to do (Roadmap f-app-jobs). Nothing in a declaration said whom it served or what they come to it to find out, so every look was assembled field by field from a type table and a model was told the kinds and the acts and nothing about the people. A document takes `purpose` now, and `defineApp` the same shape: `for`, a sentence ("The couple and their planner, mostly on phones"), and up to twelve `jobs`, each a question in the people's words (`ask`) answered by the records of one `kind` a rule-language condition holds for (`where`, the record as its subject, read in a TypeScript app exactly as in a document), in an order (`sort`, a field, a computed field or `label`, or `{ by, direction }`), with the act people usually take next on one (`act`), for some `roles` or everybody. `graview check` holds each to the declaration, in a document at `purpose.jobs.<n>.<key>` and in a TypeScript app at `defineApp(…).purpose.jobs[<n>]`: a kind the app does not have (`job-kind`), a `where` that does not read or names what the kind does not have (`job-where`), an order by nothing or by a list or a picture (`job-sort`), an act the app does not have or one that acts on another kind (`job-act`, `job-act-kind`), a role it does not know (`job-role`), a name used twice (`job-name-taken`) and more than twelve (`jobs-too-many`). A page reads `purpose` loosely, as it reads `connections`; a hosted page carries 0.1 KB more up front (81 bytes, 30 gzipped; handed a compiled app 135 and 66, and a visitor's form handed one 68 and 29), under raises measured beside the friction log's (`scripts/budget-raises/the-jobs-with-the-friction-log-*.json`); its shape is the checker's (`PurposeSpec`) and the document's JSON schema says it to an editor. Four edits change it — `set-purpose`, `add-job`, `edit-job`, `remove-job` — each judged as the checker judges and said ("A new job, "What's cheap?": answered by the vendors where cost < 500."), and the edits that rename or remove carry jobs along: a renamed kind, field, relation or act is renamed in a job's kind, `where`, order and act; a removed kind takes its jobs, a removed field or relation takes the jobs whose `where` reads it and the order by it, and a removed act leaves the job asking without it. `@graview/core/jobs` is a new entry: `jobsOf(app)` (each order with its direction, the kind's plural beside it), `jobsFor(jobs, principal)` (a seat's roles) and `answerJob(store, job, principal)`, which answers `{ count, ids }` read through `store.seenBy(principal)`, so a record kept from the seat is never counted or named and an archived one is set aside. `graview describe` opens with "Who it is for" (the sentence and each job's ask, only a seat's own under `--as`), and `aiContextOf` takes the app's `purpose` and tells a model `for` and the jobs whose roles include the viewer's and whose kind they may see (`state.purpose`); the inline AI hands it the app's (`InlineAsk.purpose`). The studio carries an app's purpose through, a renamed kind's jobs following it; `toDocument` writes it, leaving out a next act the document could not carry. The todo example says it is for a household and asks "What's late?" and "What still needs a slot this week?". The graview-new-app skill says it. Core's tests hold that a purpose is read from a document and from `defineApp` alike and given back, that each code is said at its path, that a job is answered in its order held to the seat's sight, and that every edit carries jobs along or lets go of what a removal takes.
  
  Compatibility: ops and primitives, stored formats, the wire, derived tool names and input schemas — unchanged. The declaration — additive: `purpose` on a document and `GraviewApp`, and `set-purpose`, `add-job`, `edit-job` and `remove-job` among the edits. Check finding codes — additive: `job-kind`, `job-where`, `job-sort`, `job-act`, `job-act-kind`, `job-role`, `job-name-taken`, `jobs-too-many`. The JavaScript API — additive: `AppPurpose`, `JobDeclaration` and `JobSort` on `@graview/core`; the `@graview/core/jobs` entry (`jobsOf`, `jobsFor`, `answerJob`, `jobIsFor`, `MOST_JOBS`); an optional `purpose` on `AiContextOptions` and `InlineAsk`, and `purpose` on `AiContextState`; a "Who it is for" section at the head of `describeApp`. What Graview Cloud does: takes this build; `describe_app` says an app's purpose through `describeApp` as it is, a seat's model is told it once Cloud hands `aiContextOf` the app's `purpose`, and `propose_change` takes the four new edits through `editDocument`.
- Updated dependencies [3648ead]
- Updated dependencies [a2c056b]
- Updated dependencies [4fe45a2]
- Updated dependencies [b73b543]
- Updated dependencies [865d43a]
  - @graview/core@0.1.55
  - @graview/tools@0.1.55
  - @graview/primitives@0.1.55
  - @graview/ship@0.1.55
  - @graview/pages@0.1.55
  - @graview/layout@0.1.55
  - @graview/react@0.1.55

## 0.1.54

### Patch Changes

- Updated dependencies [b22d435]
- Updated dependencies [57e12bc]
- Updated dependencies [cdef481]
- Updated dependencies [0270ca9]
- Updated dependencies [0270ca9]
- Updated dependencies [0270ca9]
- Updated dependencies [094255d]
- Updated dependencies [cdef481]
- Updated dependencies [7324969]
- Updated dependencies [0270ca9]
- Updated dependencies [094255d]
  - @graview/primitives@0.1.54
  - @graview/core@0.1.54
  - @graview/react@0.1.54
  - @graview/ship@0.1.54
  - @graview/tools@0.1.54
  - @graview/pages@0.1.54
  - @graview/layout@0.1.54

## 0.1.53

### Patch Changes

- Updated dependencies [a1acdc1]
- Updated dependencies [642145e]
- Updated dependencies [8c7656c]
- Updated dependencies [642145e]
- Updated dependencies [e30703c]
- Updated dependencies [e30703c]
- Updated dependencies [642145e]
- Updated dependencies [642145e]
- Updated dependencies [e30703c]
- Updated dependencies [d28346b]
- Updated dependencies [42009a4]
  - @graview/core@0.1.53
  - @graview/react@0.1.53
  - @graview/pages@0.1.53
  - @graview/primitives@0.1.53
  - @graview/layout@0.1.53
  - @graview/ship@0.1.53
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
  - @graview/ship@0.1.52
  - @graview/layout@0.1.52
  - @graview/tools@0.1.52

## 0.1.51

### Patch Changes

- Updated dependencies [920641e]
- Updated dependencies [8fbe98f]
- Updated dependencies [0956b46]
- Updated dependencies [195aa49]
  - @graview/core@0.1.51
  - @graview/react@0.1.51
  - @graview/primitives@0.1.51
  - @graview/ship@0.1.51
  - @graview/pages@0.1.51
  - @graview/layout@0.1.51
  - @graview/tools@0.1.51

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
  - @graview/react@0.1.50
  - @graview/tools@0.1.50
  - @graview/primitives@0.1.50
  - @graview/pages@0.1.50
  - @graview/layout@0.1.50

## 0.1.49

### Patch Changes

- 1c1bfcd: A host's model is asked with one object and answers with one, so it can be handed a framing, pictures and a way to give up, and say what the call used, without breaking again. `Completion` was `(prompt: string) => Promise<string>`; it is `(request: { prompt, system?, images?, signal? }) => Promise<{ text, usage? }>`, each picture `{ mediaType, data }` in base64 and `usage` `{ inputTokens, outputTokens, costUsd? }`. `openAiCompatibleCompletion` and `xaiCompletion` send the framing as a system message and the pictures as image parts, give up on the caller's signal and read what the call used; `localCompletion` takes the framing; the inline AI hands the framing over apart from the ask rather than joined to it, and `completionDecide` reports the completion's usage. The dev server's door (`aiDevProxy`, `aiThroughDevServer`) takes `{ prompt, system?, images? }` and answers `{ text, usage? }`. The Fast slot's contract — `Decide`, `Decided`, `Answer`, `ChoiceAnswer`, `NoulAnswer`, `ScoreAnswer` and `Usage` — is in a module of its own rather than Jev's, by the same names on `@graview/tools`.
  
  Compatibility: breaking in the API a host's seat reaches, before 1.0 — every `HostAi.complete` and every caller of a `Completion` takes and returns the object (`async (prompt) => text` becomes `async ({ prompt }) => ({ text })`). Additive on the dev server's door: `system`, `images` and `usage` are optional fields. Ops, stored formats, the wire, the document format and tool schemas are unchanged.
- 9dab8bb: Every form asks in one order, whatever declared its act. 0.1.48 made a document's creating act ask for what names the record first; "Change the threat" still asked in the kind's field order, and an app written in TypeScript asked in its `z.object`'s key order, so a code app's "Add a threat" asked Aliases and CVSS before the name it must be given. Now one rule orders them all (`askedArguments`, `askedFieldsOf` and `inAskedOrder` on `@graview/core`, `askedFormFields` on `@graview/core/forms`): the fields the kind's label reads, in the order it reads them; then every other field the record cannot be made without (required, no default — in the schema or in a compiled document's `defaults`); then the rest; each run in the order the kind's page names them, then as declared. A TypeScript kind's label is a function, so it is asked which fields it says — handed a record whose every field marks its own name — and one that cannot be read that way falls back to a field called `name`, `title` or `label`. Only the arguments that are a field of the kind the act makes (else the one kind it changes) move, and only among their own places: a record to link to, the subject and an argument an act names for itself stay where the act put them. A derived `edit-<kind>` is built in this order, its `writes` and its sentence too: an edit is the form that made the record again, filled with what the record holds, so each field is where the person found it the first time — and what the record cannot be without still matters most when changing it, so "required first" holds for an edit as well, though every field of an edit may be left as it is. A TypeScript act's own input is left as declared; what asks reorders it: the pages face's form, a visitor's form that names no `fields`, the seat's described form (`describe_place`), the strip's open questions, the questions a decision is asked, the seat model's list of acts, the studio's offer form, `graview docs` and an agent's tool, whose `properties` are listed in the order a person is asked (`mutationToolSchema` takes the order as a second argument). `core`'s tests find a document's derived edit and a TypeScript app's creating form, edit, visitor form, described form and tool asking the name first, a label's fields read off a label function, a page's order kept, and an act's own input unchanged; `tools`' find the strip and an agent's tool asking a TypeScript act's name first. A hosted page carries 1.6 KB more up front, and so does one handed a compiled app — the store derives the edit in this order and the strip asks in it, so both are on every page — under raises of those budgets (`scripts/budget-raises/every-form-asks-in-one-order-*.json`), with the pages face alone (1.7 KB) and a visitor's form alone (1.5 KB).
  
  Compatibility: additive in the API — `askedArguments`, `askedFieldsOf` and `inAskedOrder` on `@graview/core`, `askedFormFields` on `@graview/core/forms`, and `mutationToolSchema`'s optional second argument. A behavior change in what is asked: a derived edit's input, `writes` and description list fields in the asked order, and a TypeScript app's forms, strip questions and agent tool schemas list arguments in it. Arguments are named, so every call is taken as before. A tool surface's hash is taken over sorted keys, so a property's place does not move it, but a derived edit's description now lists its fields in the asked order, so a surface with a derived edit whose fields were declared in another order hashes differently once. The declaration, the wire and the stored formats are unchanged. What Graview Cloud does: nothing — its forms ask the name first once it takes this version.
- Updated dependencies [1c1bfcd]
- Updated dependencies [81a6028]
- Updated dependencies [8993971]
- Updated dependencies [ec8c429]
- Updated dependencies [69b9046]
- Updated dependencies [9dab8bb]
- Updated dependencies [4ca00a7]
- Updated dependencies [1f80e4a]
- Updated dependencies [1c1bfcd]
  - @graview/tools@0.1.49
  - @graview/core@0.1.49
  - @graview/ship@0.1.49
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
  - @graview/ship@0.1.48
  - @graview/pages@0.1.48
  - @graview/layout@0.1.48
  - @graview/react@0.1.48

## 0.1.47

### Patch Changes

- Updated dependencies [6d84721]
- Updated dependencies [7478654]
- Updated dependencies [fbb080a]
- Updated dependencies [f85abad]
- Updated dependencies [ed05ba4]
- Updated dependencies [f85abad]
- Updated dependencies [6f9bf30]
- Updated dependencies [b92340d]
- Updated dependencies [f772aff]
  - @graview/core@0.1.47
  - @graview/pages@0.1.47
  - @graview/primitives@0.1.47
  - @graview/react@0.1.47
  - @graview/ship@0.1.47
  - @graview/layout@0.1.47
  - @graview/tools@0.1.47

## 0.1.46

### Patch Changes

- Updated dependencies [15f234f]
- Updated dependencies [99d25eb]
  - @graview/core@0.1.46
  - @graview/pages@0.1.46
  - @graview/primitives@0.1.46
  - @graview/layout@0.1.46
  - @graview/react@0.1.46
  - @graview/ship@0.1.46
  - @graview/tools@0.1.46

## 0.1.45

### Patch Changes

- Updated dependencies [7069188]
- Updated dependencies [7814c9f]
- Updated dependencies [0ffa768]
- Updated dependencies [8ab4fa2]
  - @graview/core@0.1.45
  - @graview/pages@0.1.45
  - @graview/primitives@0.1.45
  - @graview/ship@0.1.45
  - @graview/react@0.1.45
  - @graview/layout@0.1.45
  - @graview/tools@0.1.45

## 0.1.44

### Patch Changes

- Updated dependencies [68b7837]
- Updated dependencies [f750ed3]
- Updated dependencies [10ea092]
- Updated dependencies [2f524d0]
  - @graview/core@0.1.44
  - @graview/ship@0.1.44
  - @graview/primitives@0.1.44
  - @graview/pages@0.1.44
  - @graview/layout@0.1.44
  - @graview/react@0.1.44
  - @graview/tools@0.1.44

## 0.1.43

### Patch Changes

- Updated dependencies [3c6b0fa]
  - @graview/core@0.1.43
  - @graview/ship@0.1.43
  - @graview/react@0.1.43
  - @graview/layout@0.1.43
  - @graview/pages@0.1.43
  - @graview/primitives@0.1.43
  - @graview/tools@0.1.43

## 0.1.42

### Patch Changes

- f6b5bb7: Importing the framework builds nothing it does not use (Roadmap f-smaller-worker). Graview Cloud's Worker paid about 50 ms of CPU on every cold start before it answered, and most of what the framework added to that was zod: the document format built some hundred and fifty schemas the moment `@graview/core/document` loaded, the edit ops another sixty, a template's and a connection's shapes more, and nineteen framework modules imported zod's `z` by name, which makes esbuild (and so wrangler) keep every part of zod and its forty-odd locales, 805 KB, whatever was called. The document's shapes (`DocumentSpec`, `KindSpec`, `FieldSpec` and the rest), `TemplateSpec` and `ConnectionSpec` are now `z.lazy` over a set built the first time one parses, the edit ops' shapes are built with the first edit, and the framework imports zod as `import * as z from "zod"`, which a bundler shakes to what is called. Bundled as wrangler bundles it, what Cloud's worker imports from the framework comes to 1.8 MB instead of 2.4 MB, 219 KB of it zod's instead of 805 KB, and loads in 29.5 ms of CPU instead of 52.3 ms; `@graview/core/document` alone in 10.8 ms instead of 34.3 ms, `@graview/core/check` in 13.9 instead of 37.9. `node scripts/import-cost.mjs` measures each entry Cloud imports in a fresh process (`--bundled` as a Worker receives it, `--worker` the names it imports together, `--profile` where the time goes), and `tests/importing-the-framework-costs-little.test.ts` holds each to a budget of CPU, the names Cloud imports to 2 MB and 260 KB of zod, and every framework module to the namespace import. A hosted page spends 1.2 KB more up front on the lazy shapes (0.7 KB handed a compiled app), raised by what they measured (1_197 / 356 and 691 / 143); the scene and the pages faces before they draw are raised to 960 KB.
  
  Merged onto the scheme's logo in the same release, the two together carry 0.0 KB more up front than each alone, on a hosted page and on one handed a compiled app.
  Compatibility: ops, stored formats, the wire, the declaration and check finding codes, and derived tools are unchanged; `document.schema.json` is byte for byte the same. The document's exported shapes keep their names, their parse and their issues, but each is now a zod lazy schema over the shape it was (`DocumentSpec._zod.innerType` is the object schema), so code that read an object schema's own members off one (`.shape`, `_zod.def.shape`) reads them off `_zod.innerType` instead. `@graview/core` still re-exports `z` for a product.
- Updated dependencies [a5bbda0]
- Updated dependencies [caf67fd]
- Updated dependencies [4fe0969]
- Updated dependencies [f6b5bb7]
- Updated dependencies [93fccf0]
- Updated dependencies [6809e5a]
  - @graview/core@0.1.42
  - @graview/primitives@0.1.42
  - @graview/pages@0.1.42
  - @graview/ship@0.1.42
  - @graview/react@0.1.42
  - @graview/layout@0.1.42
  - @graview/tools@0.1.42

## 0.1.41

### Patch Changes

- Updated dependencies [408a1d9]
  - @graview/primitives@0.1.41
  - @graview/pages@0.1.41
  - @graview/core@0.1.41
  - @graview/layout@0.1.41
  - @graview/react@0.1.41
  - @graview/ship@0.1.41
  - @graview/tools@0.1.41

## 0.1.40

### Patch Changes

- Updated dependencies [d2ef34e]
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
- Updated dependencies [c3b7ab9]
- Updated dependencies [6fc222b]
- Updated dependencies [68ebfd2]
- Updated dependencies [8c8a486]
  - @graview/primitives@0.1.40
  - @graview/core@0.1.40
  - @graview/react@0.1.40
  - @graview/layout@0.1.40
  - @graview/ship@0.1.40
  - @graview/tools@0.1.40
  - @graview/pages@0.1.40

## 0.1.39

### Patch Changes

- Updated dependencies [77a235a]
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
  - @graview/ship@0.1.39
  - @graview/pages@0.1.39
  - @graview/primitives@0.1.39
  - @graview/react@0.1.39
  - @graview/layout@0.1.39
  - @graview/tools@0.1.39

## 0.1.38

### Patch Changes

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
  - @graview/ship@0.1.38
  - @graview/tools@0.1.38
  - @graview/layout@0.1.38

## 0.1.37

### Patch Changes

- cf691f4: A record can hold a video. A photo gallery built on Graview Cloud with three iPhone clips could show only a play glyph over a still: no field took a video, the host's files took none, and a view may not draw `<video>`. A document now says `{"type": "video"}` (or `{"type": "list", "of": "video"}`), a declaration `videoField()`, and the value is the `FileValue` the host's upload answered — `{ href, name, type, bytes, width?, height?, caption? }` — with what a player wants before it loads a byte: `poster` (a picture on the host), `duration` in seconds and `captions` (a WebVTT file on the host), each a path on the host or a length above 0, or refused. A video field takes only `video/*`, a picture field no video. The editor asks for videos where the host's `kinds` take `video/*` (`accept="video/*"`, "Choose a video", "This host doesn't take videos" where they do not) and sends one as it was picked: making a phone's HEVC `.mov` an MP4 every browser plays, its poster and its length are the host's to answer. The face plays a record's video — its poster first, the browser's own controls, `preload="metadata"`, captions where the value has them, sized from the value — drawn and fetched where the host serves files (`fileSrc`), its length read from what the player loaded where the value does not say it; a card or a row shows its poster (or its first frame) with a play glyph and its length. A record's facts, an image block and a headless run say it as "a 45-second video" (`videoWords`); the act's form and its argument's shape say `video: true`. A worker view whose manifest says `pictures` places `<graview-video data-record data-field>` and the host plays that record's video in it, from the records the view was shown, never handing the view a path or drawing it a `<video>`; and a viewer's press on a `data-lightbox` element opens the host's full-screen viewer for a picture or a video. The dev server's files door takes videos and serves them a range at a time. The `graview-view-drawing`, `graview-worker-view` and `graview-node-kind` skills say so. A hosted page carries 0.6 KB more up front for a video field's schema; the player, the card and the view's player are behind the doors already there, and the guest host's first load grows by under 1 KB for the press and the door.
  
  Compatibility: ops and stored records are unchanged; a stored file value is read as before, and a value may now also carry `poster`, `duration` and `captions`. The declaration takes the field type `video` and `of: "video"`; a declaration that compiled still compiles. Derived tool input schemas for a file argument list the optional `poster`, `duration` and `captions`, and a video field's form control and argument shape say `video: true`. The guest wire is unchanged in shape: a video on a record is handed to a view that asks for `pictures` as its facts (`GuestFile.duration` beside `width`, `height` and `caption`) where it was handed its name, type and size. The open kit draws one element more, `graview-video`. `DEV_FILES_KINDS` takes `video/*`.
- 9121a9c: A relation can say no act makes or breaks it (`acts: "none"` on an edge declaration), and is then given no derived connect or disconnect: it is read from what was declared. The studio's own meta-schema says it of what an act creates, connects and severs and of the kind a computed field is on, which its named acts and the opened declaration set; once every relation came with a derived pair, "Link a kind (creates)" had taken a kind's strip past "Add a field".
  
  Compatibility: `EdgeDeclaration` takes `acts?: "none"`; the studio's acts are as they were.
- Updated dependencies [9e00808]
- Updated dependencies [a130326]
- Updated dependencies [7fa2dbc]
- Updated dependencies [cf691f4]
- Updated dependencies [d689fbc]
- Updated dependencies [7d137a8]
- Updated dependencies [9121a9c]
- Updated dependencies [862ab8c]
- Updated dependencies [f860e41]
- Updated dependencies [49d0ed8]
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
  - @graview/ship@0.1.37
  - @graview/tools@0.1.37
  - @graview/react@0.1.37
  - @graview/layout@0.1.37

## 0.1.36

### Patch Changes

- Updated dependencies [9f3e1d1]
  - @graview/core@0.1.36
  - @graview/ship@0.1.36
  - @graview/primitives@0.1.36
  - @graview/layout@0.1.36
  - @graview/pages@0.1.36
  - @graview/react@0.1.36
  - @graview/tools@0.1.36

## 0.1.35

### Patch Changes

- ac91d40: An `add-relation` edit can name another app's kind. Since 0.1.30 a whole document could declare `"forHouse": { "to": ["@nick/house/house"], "cardinality": "one" }`, but the edit refused the same relation (`"@nick/house/house" is not a kind this app has`), so a host that changes an app by edits — graview.cloud's builder, `propose_change`, the studio — could not link one app to another. `editDocument` now takes `{"op": "add-relation", "kind": "scenario", "relation": "forHouse", "to": ["@nick/house/house"], "cardinality": "one"}` and gives a document that checks clean, judged by the rules `graview check` applies: a `to` that mixes this app's kinds with another's, reaches two apps, says `inverse` or `appendOnly` is refused at `edits.<n>` with the checker's own finding (`linked-mixed`, `linked-apps`, `linked-target`, `linked-inverse`, `linked-append-only`). It says `scenario gains a relation, "forHouse", to one house in the app @nick/house, another app, read there as whoever is looking.` `rename-relation` and `remove-relation` work on one. `planMigration` dropped a far relation's values on every migration, since it carried only declared fields; it now keeps them, moves them with a rename and clears them with the relation, said like a relation's links. The studio read a far relation as a text field; it now reads it as a relation (`toAnotherApp` on the edge), makes one with `add-edge-to-another-app` (`to: "@nick/house/house"`), says it as `add-relation`, and writes it back to a checkout as `linkedRecordField([...]).optional()`.
  
  Compatibility: the declaration is unchanged — a document that compiled compiles the same — and the edits take what they refused, with the checker's finding codes at `edits.<n>`; a stored graph migrates keeping what it dropped; ops, stored formats, the wire and derived tools are unchanged. The studio's own tools gain `add-edge-to-another-app`.
- Updated dependencies [d33bc19]
- Updated dependencies [ac91d40]
- Updated dependencies [f2666ed]
  - @graview/core@0.1.35
  - @graview/primitives@0.1.35
  - @graview/react@0.1.35
  - @graview/layout@0.1.35
  - @graview/pages@0.1.35
  - @graview/ship@0.1.35
  - @graview/tools@0.1.35

## 0.1.34

### Patch Changes

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
  - @graview/layout@0.1.34
  - @graview/ship@0.1.34

## 0.1.33

### Patch Changes

- Updated dependencies [01fc2ce]
- Updated dependencies [a583b18]
  - @graview/core@0.1.33
  - @graview/ship@0.1.33
  - @graview/layout@0.1.33
  - @graview/pages@0.1.33
  - @graview/primitives@0.1.33
  - @graview/react@0.1.33
  - @graview/tools@0.1.33

## 0.1.32

### Patch Changes

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
  - @graview/ship@0.1.32
  - @graview/tools@0.1.32

## 0.1.31

### Patch Changes

- 6009469: An app says which calendar it keeps in step with in its own declaration, rather than in code. A document's `connections.<name>` names the system (`google-calendar`), the calendar (or the environment variable holding its id), the kind its events are and which field holds each part of one, a filter (the whole calendar, one of Google's colors by name, or a title tag such as `#graview`, kept in the title or not), the direction (`read`, where the calendar owns the kind and an act here that would change one is refused with a sentence saying so, or `both`) and the conflict policy. `graview check` says each wrong shape at its place: a kind or field the app lacks, a field of the wrong type, a color Google has no name for, a tag that is not one word, and an app with no act to land an inbound change through. A `date` field is an all-day event's day, its end inclusive here; a `datetime` field a timed event's instant. Filters apply as events arrive, since Google refuses a sync token beside a search: an event that leaves the filter is gone here, and one made here carries the color or tag that keeps it in, and a private property naming the app. `graview serve` and `graview preview` run the connections beside the store, with credentials from the environment (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, or the prefix and file `auth` names), each pass credited to `google-calendar` in Activity and the cursor kept in `connections.json` beside the data; `--no-sync` or a declared `paused` leaves them off. A host runs them with `runConnections` from `@graview/ship` or `@graview/ship/runtime`, handing its own `token({ connection, refresh })` and a place to keep their state. The studio carries an app's connections through an edit, the calendar following a renamed kind.
  
  A page that draws an app reads `connections` loosely and carries none of this, so a hosted page is unchanged; the studio's checker judges them, which adds 5.6 KB (2.1 KB gzipped) to every face and to the embed with the studio handed in, and those raises are filed in `scripts/budget-raises/`.
  
  Compatibility: the declaration and check finding codes: a document may carry `connections` (until now an unknown key), and `graview check` adds `connection-kind`, `connection-field`, `connection-field-type`, `connection-when`, `connection-filter`, `connection-color`, `connection-tag`, `connection-creates`, `connection-edit` and the warning `connection-remove`; a document without `connections` compiles and checks as before. New: `GraviewApp.connections`, `connections` in `document.schema.json`, and on `@graview/core/sync` `connection`, `connectionMapping`, `creatingAct`, `inConnectionFilter`, `isDayField`, `GOOGLE_COLORS`, `CONNECTION_TAG`, `MADE_BY_GRAVIEW`, `Connection`, `ConnectionDeclaration` and `ConnectionRun`, with `GoogleCalendarOptions.keep` and `.madeHere`; on `@graview/ship` and `/runtime` `runConnections`, `sayReport`, `GOOGLE_TOKEN_URL` and their types, and on `@graview/ship` `fileConnectionState`, `readEnvFile` and `connectionsFileOf`; `PreviewOptions.connections` and `Preview.connections`; `graview serve` and `graview preview` take `--no-sync`.
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
  - @graview/ship@0.1.31
  - @graview/pages@0.1.31
  - @graview/layout@0.1.31
  - @graview/react@0.1.31
  - @graview/tools@0.1.31

## 0.1.30

### Patch Changes

- ea43f4a: The studio's own kinds — the kinds, fields, acts, edges, rules, lenses, roles, grants and sights a declaration is made of — are declared never tidied, so a record of the declaration offers no "Leave this one alone" or "Allow tidying again": nothing automated decides what is in an app. Without it the new act took a place in a kind's strip ahead of "Add a field", which fell out of the acts shown.
  
  Compatibility: no surface changes.
- 5b8ac1f: A lens can be kept off the lists (Roadmap f-hidden-lenses). A kind could be left off the home, but a lens could not be left off anything, so an app whose custom home links to lenses as targets ended with a long page list of them. A lens marked `hidden: true` is still a place at its address — a link, a view's `navigate` and `/places/<as>` reach it, and `placesOf` lists it with `hidden: true` — but the bar's places, the scene's tabs (unless it is the one shown), the page list and the home's gallery do not offer it, and it never becomes what its kind draws when an address names no picture. In a document `set-lens-hidden` sets it — `{ "op": "set-lens-hidden", "title": "Building now", "hidden": true }`, with `on` where two lenses share a title — and says so ("The lens "Building now" is kept off the bar and the page list; a link or navigate still reaches it.", and "… is listed on the bar and the page list again."), as `diffDocuments` does; a lens drawn anew in a hidden one's place (`add-lens` with `replace`) stays hidden, and a lens `pages.primary` stands on the bar is refused, in a sentence, until it is taken out of `primary`. `graview check` says a `hidden` that is not true or false (`lens-hidden-not-a-boolean`, a warning), a hidden lens with no title to be a place (`lens-hidden-untitled`, a note), and `pages.primary` naming a hidden lens (`pages-primary-hidden`, a warning). In TypeScript a lens says `hidden: true` beside its `title`, and a registration `views.register(kind, cell, View, { title, hidden: true })`. The studio reads a hidden lens as hidden and keeps one off the lists, or lists it again, with its own act, said to the document as `set-lens-hidden`. The graview-pages and graview-studio skills teach it.
  
  Compatibility: ops, stored records and the wire are unchanged. The document format takes `lenses[].hidden` (a boolean, optional within `graview-document@1`); a build that predates it draws the lens listed. New edit op `set-lens-hidden` (`title`, `on?`, `hidden`); `EDIT_OPS` lists it. New check finding codes `lens-hidden-not-a-boolean` (a warning), `lens-hidden-untitled` (a note) and `pages-primary-hidden` (a warning). `DocumentDiff`'s sentences may say "The lens "…" is kept off the bar and the page list; a link or navigate still reaches it." `LensDeclaration.hidden`, `DrawnLens.hidden`, `Place.hidden`, `ViewMeta.hidden`, `ViewRegistration.hidden` and `AppPlace.hidden` (now a lens's too) are `boolean | undefined`. The studio's meta-schema gives `lens` a `hidden` field and the act `set-lens-hidden` (`id`, `hidden`).
- Updated dependencies [e46f304]
- Updated dependencies [6cbecc0]
- Updated dependencies [6862f3a]
- Updated dependencies [ec39547]
- Updated dependencies [ed2a75d]
- Updated dependencies [0d45ba0]
- Updated dependencies [6862f3a]
- Updated dependencies [825838f]
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
  - @graview/layout@0.1.30
  - @graview/tools@0.1.30
  - @graview/ship@0.1.30

## 0.1.29

### Patch Changes

- 55ec52b: A date can repeat: a weekly practice, a monthly bill or a yearly renewal is one record, not one per occurrence made by hand (the Roadmap's f-recurring-dates). A document says `"repeats": true` on a `date` or `datetime` field; a declaration puts `startsAtRepeat: repeatField()` beside `startsAt`, and `toDocument` writes it as `repeats`. A record keeps its first occurrence in the date and, beside it under the date's name and `Repeat`, how it repeats: `{ "every": "week", "on": ["tue"], "until": "2026-12-15" }` — `every` day, week, month or year, an `interval`, `on` weekdays for a week or days of the month for a month (`-1` the last), `until`, `count` and `except` days — or `null` once it no longer does. The store refuses anything else (`validRepeat`). Occurrences are worked out and never stored (`occurrences`, `nextOccurrence`, `dateOn`): a rule, a template, `today()`'s comparisons, a list's sort, filter and date groups, and a kind's stop read the next occurrence on the day they are judged on, so the tick that turns the day (FR-176) moves it with nothing written. A day a month lacks falls on the month's last (Jan 31 monthly is Feb 28, Feb 29 yearly is Feb 28 off a leap year), a moment's time of day is kept as written so six in the evening stays six across a clock change, and `count` counts skipped days. The calendar draws every occurrence in the days it shows, marked ↻ and "· repeats" and not dragged, and counts a series once, at its next, where it is a glance; a kind's stop opens on a calendar by a series' next occurrence and counts it in "in the next 7 days"; a record's facts, a row and a card say "Every Tuesday, next Oct 27" in the app's locale (`repeatAsRead`, `repeatingDateAsRead` on `@graview/core/words`). Three derived acts on a kind with a date that repeats, permitted as its edit is, each one undo with a sentence: `skip-<kind>` ("Skip this one", `{ id, on }`) adds the day to `except`; `detach-<kind>` ("Change just this one") makes that occurrence a record of its own, with the series' fields, the links it makes and what was changed, and an exception on the series; `split-<kind>` ("Change from here") ends the series the day before and starts a new one that day, `continues` naming the old. A record's page has a "Repeat…" control beside the date: a picker (does not repeat, daily, weekly, monthly, yearly; every how many; which weekdays; the month's day or its last; until) that says the rule back in words as it is chosen, every control labeled, kept by the edit act; a form asks for a repeat with the same picker (`FormField` gains `control: "repeat"`). `editDocument` gains `set-repeats`, the studio offers "Say whether it repeats" and writes `repeatField()` back, a migration moves a repeat with its renamed date, `graview types` writes `<date>Repeat?: Repeat | null`, and an act's tool schema describes it with `"x-graview-repeat": true`. Time zones beyond the one a moment says, and the rest of RFC 5545 (by-week-number, by-set-position, hourly), are left out. A hosted page's first load is 5 797 bytes larger minified, 2 381 gzipped, than the batch it joined (549 531 / 192 258 against 543 734 / 189 877, under its budgets of 550 912 / 192 512), and 5 425 / 2 274 handed a compiled app (507 320 / 177 411 against 509 440 / 177 664): the occurrence math, the repeat's check and the three acts, which a rule and the store need as the page loads; the words, the picker and the calendar's drawing are fetched with what draws them. The embed's every face, the studio handed in and the pages face alone are raised by files of their own. A document's `datetime` field now reads back as a date and time (`fieldSpecOf`), so a kind's stop finds it for its calendar and its dates, and the stop says its date by the field's label ("in the next 7 days by starts"). verify-repeats holds it at desk width in three engines.
  
  Compatibility: additive. The declaration and check finding codes: the document format gains `repeats` on a date or datetime field, within `graview-document@1` and `graview-compiled@1`, the edit `set-repeats` and the finding `repeat-clash`; a build that predates them refuses the key as `unknown-key`. Derived tool names and input schemas: a kind with a date that repeats gains `skip-<kind>`, `detach-<kind>` and `split-<kind>`, and its `edit-<kind>` takes `<date>Repeat`; a kind with none is unchanged. `ReadableField` gains `repeats`, `PlacedEntry` gains `repeats`, `DerivedAct` gains `skip`, `detach` and `split`. Ops and primitives, the stored formats and the wire are unchanged. What a host does: serve 0.1.29 or later before writing `repeats`; a record's repeat travels as any other field value.
- dbe0a28: A document can say a kind is never archived (FR-173). `defineNode({ archives: false })` gave a TypeScript kind no `archive-`, `unarchive-` or `merge-<kind>`, and a document had no way to say it, so a hosted app offered all three on every kind — a checklist's steps, an app's settings — whether setting one aside meant anything or not. `"archives": false` on a kind now says it: the compiled app gives that kind its edit and remove and none of the three, `toDocument` writes it from a declaration that says it, `describeApp` says "Steps are kept or removed, never archived or merged", and a grant naming one of the three on that kind is `grant-act`. `editDocument` gains `set-archives` (`{ kind, archives }`), which says what the app stops or starts offering — "Categories are kept or removed, never archived: the app no longer offers archive-category, unarchive-category or merge-category, …" — says the agent's tools moved, and is refused as `grant-unknown-mutation` while a grant names one of the three, naming the `remove-grant` to send first; the preview of a changed document says the same sentence. The studio holds it on a kind as "never archived", hands it back as `set-archives`, and writes it into the declaration it writes back. A record of the kind already archived is not left where nothing can bring it back: `planMigration` brings each back in the same op that lands the change and says so ("2 archived category records brought back, since category is now kept or removed, never archived.", `counts.broughtBack`), and `set-archives` says it will. Every other migration now keeps an archived record archived — it cleared the mark on every record it planned, and said nothing. The grant check is the checker's (`compileDocument`), not the page's: a hosted page's first load is 20 bytes gzipped more for all three of this wave's follow-ups, and the every-face and studio-handed-in budgets are raised by 2_431 / 760 and 2_431 / 740 bytes (scripts/budget-raises/what-the-0-1-29-wave-left-every-face.json, scripts/budget-raises/what-the-0-1-29-wave-left-studio.json).
  
  Compatibility: the document format gains an optional `kinds.<kind>.archives` (only `false`) within `graview-document@1`; a document without it compiles to the same app. The edit vocabulary gains `set-archives`. Derived tools change only for a kind that says it: it has no `archive-`, `unarchive-` or `merge-<kind>`. `MigrationPlan.counts` gains `broughtBack`, and a migration keeps `$archived` on a record (it cleared it before). Check finding codes are unchanged (`grant-act` and `grant-unknown-mutation` read one more case).
- cd5a9d5: A lens beside the map is named once, and the studio's "open" opens a district again. The panel a lens opens in from altitude names it in its head, and a lens titles its own panel with the label it is handed, so the todo app's "The lists" stood twice on one screen a hundred pixels apart; a `Panel` whose title is the name the frame above it already says now leaves the title, and the count beside it, to the frame. And the studio, opened inside a Shell or an embed's scene face, inherited their panel beside the map through the portal: "open" on a district chose it for a panel the studio does not draw, and nothing opened. The studio says it draws no such panel, so a district opens in place as a card of its records, as it did before the panel arrived.
- A phone, a place and a length of time are field types of their own. Templates held all three as strings: a phone that was not a link to call, an address that was not a link to a map, and lengths of time nobody could add up. A document says `{ "type": "phone" }`, `{ "type": "place" }` and `{ "type": "duration" }`; a declaration `phoneField()`, `placeField()` and `durationField()`. A phone is kept as it is entered (a form trims it) and refused only when it cannot be one — fewer than three digits, or letters other than an extension's (`PHONE`: digits, spaces, `+`, `-`, `.`, `/`, parentheses, `ext. 12`, `x12`), at most 40 characters; it is said grouped as "(555) 123-4567" for a reader in the US or Canada where it is a North American number and as entered everywhere else, and drawn as a `tel:` link. A place is a line of words, at most 500 characters, drawn as a link that opens the reader's maps app in a tab of its own (`rel="noopener noreferrer"`): maps.apple.com on Apple's platforms, which opens Maps, and Google's universal Maps address elsewhere, which opens the Google Maps app on Android and the map in the browser otherwise — no one address opens every reader's own app (`geo:` does nothing in a desktop browser), and neither needs a key or fetches anything until it is followed. A duration is a whole number of minutes, none less than none, bounded by the field's `min`, `max` and `step` like a number; it is typed as "1h 30m", "90", "1:30" or "1.5 h" (`parseDuration`), said "1 h 30 min" with the locale's figures (`sayDuration`), and sorted and summed as the number it is: a computed field that sums, adds or subtracts durations — `sum(out('rehearsals'), length)`, `planned - spent` — is said as a duration too, as is one a declaration says `as: "duration"`. Each is taken by `editDocument`'s `add-field` and `retype-field` (a duration keeps its range), kept by a migration where the old value reads as one and cleared where it does not, read from a spreadsheet's cell or refused in words, written by `graview types` (a phone and a place as `string`, a duration as `number`), asked for by a form (a `tel` box; a duration in words, sent as minutes), the workbench and a value changed in place, and described to an agent with `"x-graview-type"` (and `"x-graview-unit": "minutes"` for a duration, which a seat sends as 90, never "1h 30m"). A record's page, the scene's record panel and a document card's field block draw the links, each a target of at least 24 pixels; where the value is changed in place, "Call" and "Map" stand beside it. The studio offers, declares and writes back all three. `@graview/core/words` gains `parseDuration`, `sayDuration`, `sayPhone`, `telHref`, `mapsHref`, `fieldSays`, `typedWords`, `typedHref` and `typedFieldOf`. A hosted page's first load is 392 / 168 bytes larger minified / gzipped (360 / 179 handed a compiled app), under its budgets; the embed's every face carries 7 885 / 3 336 more and with the studio handed in 7 242 / 3 150, each raised by a file of its own. verify-field-types holds it at desk width on both faces in three engines.
  
  Compatibility: additive. The document format gains the field types `phone`, `place` and `duration`, and `graview-compiled@1` carries them; a host's build that predates them refuses a document using them by path, and a page that predates them refuses such a compiled app as `compiled-shape` and compiles the document, which refuses the type by path. These carry no FR id, so a host validates a document that uses them against the `document.schema.json` of the oldest build it serves. `ReadableField` gains `href`, `ScalarField` gains `holds`, `ArgShape` gains `holds` (words) and `duration` (a number), and a computed field may say `as: "duration"`. A derived tool's input schema for a declaration with none of these fields is unchanged.
- df64e2b: A sight hides a field, not only a kind (Roadmap f-field-sight). A role saw a whole record or none of it, so a roster where parents see every player's name and not their phone number could not be said. A sight may now say `hide: ["phone", "medical"]`, or `fields: ["name"]` as an allow list, and sights add up: a field is shown when any sight that shows the seat the record shows it, so `{ roles: ["parent"], kinds: ["player"], own: true }` beside the hiding one gives each parent their own child whole. A field kept from a seat is judged in the seat view, so it never leaves the store for that seat: not on the record it is served (a required one withholds the record, as a hidden required reference does), not in the log — an op that adds or removes such a record, writes such a field or whose sentence read one is withheld, whatever the field held, its primitives served without it — nor in an act's answer, a conflict, a search hit, a name a call resolves, a form, an edit offered in place, a static page or a tool's answer. A computed field and a rule are worked out over what the seat is served, so a phone it may not see reads as none. The seat may not write such a field: an act that would is refused as one given an argument it does not take (`invalid`), the same whatever it held and whatever was written, and an import refuses a column that goes to one as it refuses a column that goes to no field. `graview check` names a field a sight misspells (`sight-names-an-unknown-field`), one a record cannot do without (`sight-hides-a-required-field`) and a label or description that reads a kept field (`sight-hides-a-labeled-field`, a warning). `add-sight` and `remove-sight` take the keys, a field the sight's kinds lack is refused (`sight-field`), and the studio carries, adds, changes and writes them back. Judging a field is `@graview/core/field-sight`, which `@graview/ship`'s server entry loads; a page that holds its whole store (`openStore` from `@graview/ship/browser`, or a `Store` of its own) imports it once, as does a host that serves seats without `@graview/ship`, and a page `openRemote` opened needs none, its host having judged what it sent. Without it, a sight with `hide` or `fields` shows nothing: the store keeps the record rather than serve a field it cannot judge. The new graview-sight skill teaches it; graview-permissions points there.
  
  Compatibility: the declaration gains two optional keys on a sight, `policy.sees[].hide` and `policy.sees[].fields` (field names), and the document schema with them; a declaration without them compiles and serves as before. Four finding codes are new (`sight-names-an-unknown-field`, `sight-hides-a-required-field`, `sight-hides-a-labeled-field`, a document edit's `sight-field`). Ops and the wire are unchanged in shape: a seat with a kept field is served fewer fields and more withheld ops, and an op's `described` may name `<id>#<field>` — a field its sentence read — beside the record ids it named; a build that predates it reads those as ids that name no record. `WIRE_PROTOCOL` does not move. The risk is an older build: a host or a page on a build before this one ignores `hide` and `fields` and SHOWS the field to the role it was hidden from — so a host serves a declaration that says either only on a build that has `@graview/core/field-sight` (`FIELD_SIGHT` on `@graview/core`), and refuses such a declaration otherwise; `capabilities().shipped` names no FR id for it. Stored data is unchanged. docs/stability.md says it under the seat's sight.
- 93a7636: A text field may be written in Markdown, and every list says a text field by its start (FR-180). Graview Cloud's Roadmap keeps its briefs as Markdown in a text field, and the Briefs list drew each body whole with its syntax showing, and the record page too. A document says `{"type": "text", "format": "markdown"}` and a declaration `markdownField()`; the value is kept as written. The record's page — the routed face, the scene's record, the scaffolded page and a static page from `renderPlace` — draws it as prose: headings demoted under the page's own, paragraphs with their line breaks kept, lists (nested, and tasks as ☐ and ☑), emphasis, code and code blocks, quotations, rules and tables, and links only to `http:`, `https:` and `mailto:`, each `rel="noopener noreferrer nofollow"` in a new tab. No HTML passes through: a tag, a handler or a `javascript:` or `data:` link is its words, an entity its character, and a picture `![…](…)` is its words — a record's pictures are its image fields' (FR-162). The reader is a small one of the framework's own, `@graview/core/markdown` (`markdownBlocks`, `markdownHtml`, `safeHref`), linear in what it reads, fetched with the first Markdown a page draws. Editing it opens the text area, with a "Preview" that shows it as the record will; the form says "Markdown" beside the field.
  
  A row, a card, a describe line, a kind stop's table cell, a search hit and a seat's line about a record say a text field by its start (`excerptOf`, on `@graview/core/words`): its first paragraph, heading or list item, or about 160 characters cut at a word, with an ellipsis where words were left out and Markdown's syntax taken out — "## Heading **bold**" is "Heading bold". A template's `{body|excerpt}` takes out Markdown's commonest marks too, and a derived edit's history line says a long string by its start rather than whole. How many lines each draws is still the surface's clamp. Plain text fields keep their paragraphs and line breaks on the record's page, as before.
  
  The checker refuses `markdown` on any type but `text`, and a number's format on a `text`, as `field-format`. `retype-field` takes `"format": "markdown"` and drops it when left out, saying "brief's body is now written in Markdown" or "is drawn as written, not as Markdown"; `diffDocuments` says the change too. A Markdown field's tool argument carries `"contentMediaType": "text/markdown"` and "Written in Markdown." `graview types` notes it. The studio reads it as a text field that says Markdown (`markdown` on its field node, set by `add-field` and `retype-field`), writes it back as `markdownField()` and hands a document back with `"format": "markdown"` kept. `pnpm verify long-text` now also asks it of the Roadmap's real briefs, on a desk and a phone in both schemes: a Markdown body renders as prose with no syntax showing, a list row says a text field as one excerpt line with no Markdown syntax, and hostile Markdown runs nothing. `capabilities().shipped` gains FR-180.
  
  A hosted page's first load is 171 bytes (0.2 KB) heavier, 114 gzipped: the mark on a compiled text field, the format's name, the template excerpt's marks and the history line's start. Nothing else is up front; the reader and the renderer are fetched with the record that draws one. Fetched all together, every face is 16_333 / 6_776 bytes more and the embed with the studio handed in 5_888 / 2_421, each raised by a file of its own (scripts/budget-raises/markdown-in-a-text-field-every-face.json, -studio.json).
  
  Compatibility: ops, stored formats and the wire are unchanged. The document format gains `"markdown"` among a field's `format` values within `graview-document@1`, refused by a build that predates it, and the checker a finding code, `field-format`. A derived tool's input schema for a Markdown field gains `contentMediaType` and the words "Written in Markdown."; for a declaration without one it is unchanged. A derived edit's intent, which the log keeps, says a string of more than 60 characters by its start. `excerptOf` and `isMarkdownField` are on `@graview/core/words`, `markdownField` on `@graview/core`, and the new entry `@graview/core/markdown`. What Graview Cloud does: offer `"format": "markdown"` on a text field when `capabilities().shipped` lists FR-180, and send `retype-field` with `{"type": "text", "format": "markdown"}` to turn it on.
- 5197748: Archive and merge are offered after a record's own acts and its edit, just ahead of remove, never first (FR-173). Settled to one press, `archive-<kind>` and `merge-<kind>` led every strip: on the studio's selected kind, "Archive the kind" came first and pushed "Add a field" past the rows shown before "Show more". "Bring it back" keeps its place, since it is only offered on an archived record. A kind can now say `archives: false` on `defineNode`, and is then given no `archive-<kind>`, `unarchive-<kind>` or `merge-<kind>` (its `remove-<kind>` stays): the studio's meta-schema says it on every kind, because a kind, a field or a relation is in the declaration or not, never set aside.
  
  Compatibility: derived tools — the studio's meta-schema loses the archive, unarchive and merge tools it gained in 0.1.29 for its kinds, and a kind declaring `archives: false` has none. Every other kind's tools are unchanged; only the order acts are offered in moves.
- d4db733: The studio keeps an app-link and a rule that reads the clock (the ninth walk, W-199). Written back from the studio, a field declared `appLinkField()` (FR-171) came back as the string with a length and a pattern its zod is, which every face draws as text, and a rule that is a function and says `readsTheClock: true` (FR-176) came back without it. `studio.files()` now writes `appLinkField()` and imports it, and the studio's rule kind carries `readsTheClock` ("reads the clock") from the checkout to the files and to the declaration it hands back.
  
  Compatibility: the studio's meta-schema gains the optional rule field `readsTheClock`; the files it writes may import `appLinkField` from `@graview/core`.
- 9309ad5: The studio offers every field type the document has. Its list of field types was a copy of the document's first eleven, so another app's address (FR-171), a picture and a file (FR-162) were types a document could say and the studio could neither offer in "Add a field" nor read back: a field node of type `app-link` was refused by the studio's own schema. `FIELD_TYPES` in `@graview/studio` is now the document's own list, so a type the document gains is one the studio offers with no change here; a field declared with `appLinkField()`, `imageField()` or `fileField()` is read as `app-link`, `image` or `file`, declared back as the same helper, and written into the checkout as `appLinkField()`, `imageField()` or `fileField()`, imported from `@graview/core` beside `z`.
  
  Compatibility: unchanged for a host. `FIELD_TYPES` in `@graview/studio` gains `image`, `file` and `app-link`, and follows the document's list from here on; the documents the studio writes back use only types the document format already has.
- 293e42b: Two lenses of one name on different kinds are two nodes in the studio. A lens's node id was its name and its title's address word, so a board over tasks and a board over bugs, both titled "Board" (which the checker allows, a title being an address per kind), were one node: the studio drew one, and handed the app back with the second lens wearing the first one's bindings. The id now also names the kinds the lens stands on, its `on` or the kinds its bindings name, as `lens:columns:board@task`, read from the lens alone so the same declaration read twice gives the same ids. A lens that stands on no kind keeps its old id, `lens:<name>` or `lens:<name>:<title>`; one that does is now `…@<kind>[,<kind>]`.
  
  Compatibility: no framework surface changes; a studio node id for a lens that stands on a kind is new (`lens:<name>[:<title>]@<kinds>`), so a host that kept such an id reads it again from the studio.
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
- Updated dependencies [c1fb0a3]
- Updated dependencies [fc3b1f2]
  - @graview/react@0.1.29
  - @graview/core@0.1.29
  - @graview/ship@0.1.29
  - @graview/tools@0.1.29
  - @graview/primitives@0.1.29
  - @graview/pages@0.1.29
  - @graview/layout@0.1.29

## 0.1.28

### Patch Changes

- 085670c: Named edits for the people kind, grants and sights (FR-170). `add-kind` and `add-act` passed `people: true` and `$me` through, but nothing set `people` on a kind already there and no edit touched the policy, so an own-end grant or a sight via a relation could only be made by a raw JSON patch, which a builder's form or a chat's `propose_change` cannot offer as a named change previewed in words. `editDocument` takes five more ops. `set-people` (`{ "kind": "participant", "people": true }`) says which kind is the people who sign in, and refuses a second one with a sentence as `people-ambiguous`, so a move is `false` on the one, then `true` on the other, in one change. `add-grant` and `add-sight` take a grant or a sight as the policy holds one (`roles`, `mutations` and `kinds`, `self`, `ownEnd`, `describe`; `roles`, `kinds` and `own`, `via`): a role the document's `roles` does not list joins it, a first grant says that from now on only what a grant gives is allowed, and a first sight on an app with no policy comes with a grant to everyone of every act, since a sight alone would take every act away. `remove-grant` and `remove-sight` name the one to remove by what it says, never by its place in the list: a grant by its roles and acts, a sight by its roles and kinds, each in any order, any other key given matching too; two that match are refused, asking for the key that tells them apart, and one that matches nothing is refused with the ones there are, in words. Each says what it did in the declaration's words — "A participant may "Change the participant" on participants, only on their own record", "A participant sees matches, only those "givenBy" joins to their own participant" — and `diffDocuments` previews the change in the same sentences, where a policy changed was "Who may do what changes.". What the change leaves the people and the policy saying together is judged once it is whole, by the checker's own codes at its last such edit: `people-unsaid`, `sight-via-unknown-edge`, `sight-via-misses-people` and `grant-own-end-without-link`. The Secret Santa's and the idea board's people, grants and sights are each made from nothing by these edits alone, equal to their fixtures. The studio says a grant, a sight and the people kind it changed as these ops, where a grant or a sight was a `studio-unsaid` finding and a kind made the people was not said at all. And a creating act's line leaves out a sentence held in a string, as it leaves out a long text: "Add a feature: Named edits for the people kind, grants and sights (framework, building, 0.1.28)" where the feature's `layerWhy` stood in the parentheses; a value said in over 40 characters, or words ending in a stop, is not said again. A hosted page's first load is 103 bytes smaller (587 155 bytes over the vendors document, 587 258 on main), and 104 smaller handed a compiled app: the new line is paid for by saying a list in words in one place (`listed`). The studio and every face carry about 9 kB more minified, the edits and their sentences. `capabilities().shipped` gains FR-170.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format and check finding codes are unchanged; `capabilities().shipped` gains FR-170. The edit vocabulary (`EDIT_OPS`) gains `set-people`, `add-grant`, `remove-grant`, `add-sight` and `remove-sight`, and an edit's refusal may now carry `people-ambiguous`, `people-unsaid`, `sight-via-unknown-edge`, `sight-via-misses-people`, `grant-own-end-without-link`, `grant-act` or `sight-kind` as its code where every refusal was `edit`. `DocumentDiff`'s sentences say a grant, a sight, a role and the people kind in words where a change to the policy was "Who may do what changes." (still said of one they do not cover). `documentEdits` in the studio returns these ops where it returned a `studio-unsaid` finding for a grant or a sight. The line a creating document act is logged with leaves out a value said in over 40 characters or as words ending in a stop. What a host does: a builder's form or a chat offers the five ops by name, and reads `capabilities().shipped` for FR-170 before it sends them to a build that may predate them.
- 10bac84: What FR-170's edits left the older ones doing to a policy, and what the studio and a creating act's line said, reviewed before 0.1.28. `remove-kind` took the kind out of every sight and dropped a sight left showing nothing, so removing the kind the last sights showed took the sights away, and every other kind came to be seen by everyone, which the edit never said: it is now refused, saying "every sight shows only matches, so with them gone everyone would see everything", and `remove-sight` first, in the same change, says it in words. It also took a grant on the kind's derived edit or remove with it no more, so removing the people kind of the Secret Santa left a grant naming "edit-participant" and a change the check refused (`grant-unknown-mutation`): those acts now go from every grant, and a grant left naming no act, or no kind where it named some, goes, as a grant whose last act is removed does. A grant on no kind (`kinds: []`) gives nothing, since the policy matches no kind against it, and was said as a grant on every kind: `add-grant` refuses one, and a document that holds one is said "on no kind, so on nothing". `diffDocuments` says a role taken away ("A participant is no longer a role."), which was unsaid beside any other change to the policy, and a new policy with no grant says nobody but the system may do anything. The studio could not revoke a grant on a kind's derived edit: it has no act for one, so the grant read as naming no act, and revoking it was no edit at all; a grant the document had reads those acts from the document now. And a removal the studio says names what the grant leaves out — `kinds: "*"`, `self: false`, `ownEnd: false`, a sight's `own: false` — so revoking a grant to every kind beside one held to a person's own record no longer means both and is refused. What goes with a removed kind or field is named as a person reads it: "The match kind is removed, and every match with it; so is the act "Draw a match"", where it said "so are act draw", and a rule by its title ("the rule "A booked vendor has a quote"", and a repair of it), where it said the rule's id. A creating act's line said "Acme Holdings Inc." as a sentence and left it out: a stop after an abbreviation ("Inc.", "U.S.") is not a sentence's.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format and check finding codes are unchanged. `editDocument` refuses `remove-kind` while every sight shows only that kind, and `add-grant` with `kinds: []`, each as `edit`; `remove-kind` takes the kind's `edit-<kind>` and `remove-<kind>` out of every grant, and a grant left with no act or no kind goes. What `remove-kind` and `remove-field` say names an act or a rule that goes with them by its title, where it named its id. `DocumentDiff`'s sentences may say a role taken away, and "on no kind, so on nothing". The studio's `documentEdits` says a removal with `kinds`, `self` and `ownEnd` (a sight's `own`) given. A creating act's line keeps a value ending in an abbreviation's stop. What a host does: a chat removing a kind its last sights show sends `remove-sight` first, in the same change.
- Updated dependencies [085670c]
- Updated dependencies [10bac84]
  - @graview/core@0.1.28
  - @graview/layout@0.1.28
  - @graview/pages@0.1.28
  - @graview/primitives@0.1.28
  - @graview/react@0.1.28
  - @graview/ship@0.1.28
  - @graview/tools@0.1.28

## 0.1.27

### Patch Changes

- 649dc1f: A document names the kind that stands for its people (the Graview Roadmap's f-people-kind). `"people": true` on one kind says that a record of it whose id is a principal's id is that person — the record Graview Cloud makes for each member under their principal id. A declaration says the same with `people: true` on `defineNode`, and the installation's `user` says it. `self` grants and `own` sights read a principal's id as before; the people kind is what `$me`, a grant held to your own end of a link and a sight via a relation read it as. `describeApp` says it ("The people are the participants: a participant whose id is a member's principal id is that member."), a kind's JSON Schema says `"x-graview-people": true`, and `toDocument` and the studio carry it. `graview check` refuses two kinds that both say it (`people-ambiguous`) and a policy that reads a principal's own record with no kind saying it (`people-unsaid`).
  
  The hosted page pays for what it carries of these four changes up front by reading a grant's and a sight's roles one way, a mutation's subject kinds one way, and a call's named records once in the store: 586,874 bytes up front where main is 586,913, and 545,887 handed a compiled app where main is 545,948.
  
  Compatibility: additive. The document format gains `kinds.<kind>.people` within `graview-document@1`; a build that predates it refuses it by path. Check finding codes: `people-ambiguous` and `people-unsaid` are new, errors only about declarations that say something that could not be said before. A kind's JSON Schema gains `x-graview-people` on the people kind. Ops, stored formats, the wire and tool names and schemas are unchanged. New: `NodeDefinitionSpec.people`. What Graview Cloud changes: say `"people": true` on the kind its member records are (f-member-records), with each record's id the member's principal id.
- 649dc1f: A grant can hold to your own end of a link (the Graview Roadmap's f-own-end-grants). `self` holds a grant to the act's subject being the principal's own record, and the act that takes back a vote is on the idea, so a voter could take back anyone's. `ownEnd: true` on a grant holds a connect or sever to every record the call names at the far end of the link being the principal's own. The store refuses another with a sentence — "Not permitted: “Take back a vote” on an idea — only on your own end of the link." and the grant's own words — the seat keeps the tool, and the strip offers the act on an idea you voted for with you already chosen, and not at all on one only somebody else voted for. `graview check` refuses the condition on an act that connects and severs nothing, or names no record at its far end (`grant-own-end-without-link`), and asks for a people kind (`people-unsaid`).
  
  Compatibility: additive. The document format gains `policy.grants[].ownEnd` within `graview-document@1`; a build that predates it refuses it by path. Check finding codes: `grant-own-end-without-link` is new, an error only about a grant that could not be written before. A refusal's `reason` is `forbidden`, as any grant's. Tool names and schemas are unchanged; the affordances of an act refused for want of a far end now narrow to the seat's own as they did for a subject. Ops, stored formats and the wire are unchanged. New: `Grant.ownEnd`, and `permits`'s eighth argument, the records the call names at the far end of what it links.
- 41c0ebc: A proposal to add a record names it by its label, then the rest, and the seat tells the model what the person saw (FR-169). On Graview Cloud's staging, "add a new revenue stream for Graview Cloud SaaS" was offered as "Add a revenue stream: nascent": the line took the first string it was handed, the person read the stream's maturity as its title and said so, and the model, which never saw the line, agreed and asked for another. A document act that creates a record, the `add-<kind>` act the studio writes for a new kind among them, now says the record by its kind's label and then what else it was given, in parentheses, as a record says it: "Add a revenue stream: Graview Cloud SaaS (nascent)", money as money, a yes by the field's words, and neither a no, a long text nor what the label already says. The offer under an answer (`describeProposal`) and the line the log keeps are that one sentence, and a creating act with no label to say is said by its title, never by the first string it was sent. The conversation a seat hands the model carries each offer as the person was shown it, and what became of it: "Here is a plot for it. [Offered beneath this answer: Stake out Back bed — applied]". "Answered with AI" is one quiet mark at the end of the answer's own line, not a line of its own under every answer. A hosted page's first load is 39 bytes smaller (587 280 bytes over the vendors document, 587 319 on main), and 10 bytes smaller handed a compiled app: the new sentence is paid for by a kind's defaults kept once, `isoToday` from one place, and one test for a document too large. `capabilities().shipped` gains FR-169.
  
  Compatibility: ops, stored formats, wire messages, the document format, the compiled format and check finding codes are unchanged; `capabilities().shipped` gains FR-169. Only the sentence an op is logged with changes, for a creating document act given more than its label says. `useSeatConversation` takes `said`, how the surface shows one proposal, and the history it hands `answer` says "[Offered beneath this answer: …]" where it said "[applied: …]". What a host does: a surface that calls `useSeatConversation` passes `said: (proposal) => describeProposal(store, proposal)`.
- 649dc1f: A sight can reach the records that link to you (the Graview Roadmap's open request "Visibility scoped by relation"). `sees` kept whole kinds, and `own` showed a seat every record any relation joins to its own — so a Secret Santa match, joined to its giver and its receiver, was shown to both. `{ "roles": ["participant"], "kinds": ["match"], "via": "givenBy" }` shows a seat a match only where `givenBy` joins it, at either end, to the seat's own record of the people kind: each giver sees their own match and not the one they receive in. It holds wherever sight is honored — a seat's graph and its counts, names, search, what a place says, the served log, the wire's state, polls and export, an answer to a seat, a seat's problems and its tools — and moves as the link does. A declaration says it as `Sight.via`; the studio carries it. `graview check` refuses a relation no kind declares (`sight-via-unknown-edge`), one that never joins the kind to the people (`sight-via-misses-people`) and a policy that says one with no people kind (`people-unsaid`). `packages/core/tests/document/fixtures/secret-santa.gdd.json` is the worked example.
  
  Compatibility: additive. The document format gains `policy.sees[].via` within `graview-document@1`; a build that predates it refuses it by path. Check finding codes: `sight-via-unknown-edge` and `sight-via-misses-people` are new, errors only about a sight that could not be written before. A seat is served what it was before under every sight a declaration could already say. Ops, stored formats, the wire's shapes and tool names and schemas are unchanged. New: `Sight.via`.
- b228859: The studio calls a sight via a relation what it is. A sight that shows a seat only the matches `givenBy` joins to them was drawn as "participant may see match", which reads as every match; it is now "participant may see their own match", as an `own` sight is.
  
  Compatibility: unchanged. The declaration the studio writes back, and every other surface, are as they were; only a sight's label in the studio's own graph changes.
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
  - @graview/core@0.1.27
  - @graview/tools@0.1.27
  - @graview/primitives@0.1.27
  - @graview/layout@0.1.27
  - @graview/pages@0.1.27
  - @graview/react@0.1.27
  - @graview/ship@0.1.27

## 0.1.26

### Patch Changes

- 26dbe52: A form, a field read as a document says it, and what can be done are entries of their own, so a page that has drawn none of them carries none of them. A bundler places a whole file in a page's first chunk when the first chunk can reach it and any chunk uses it, and three did: `formFields` and the rest of a form's reading rode in every hosted page's first load through `@graview/core`, though only a drawn form, the strip's ask and a seat read them; a field read in a document's words (`fieldSpecOf`) rode in it through `@graview/core/document`, though only a face's blocks and the checker read it; and the routed face reached `deriveAffordances` through `@graview/tools`, which carried the chat, the agent's tool surface and zod's JSON Schema into the pages face's first load. Now:
  
  - `formFields`, `formField`, `formComplete`, `formArgs`, `undecidableArguments` and the types `FormField`, `ScalarField` and `UndecidableArgument` are `@graview/core/forms`', and no longer `@graview/core`'s;
  - `fieldSpecOf` is `@graview/core/blocks`', beside `fieldSpecsOf`, and no longer `@graview/core/document`'s; `validateViewSpecs`, the checker's reading of a declaration's view specs, has a module of its own and is still `/document`'s;
  - `@graview/tools/derive` carries `deriveAffordances`, `applyAffordance`, `previewAffordance` and `defaultProviders`, which `@graview/tools` still exports too, and the routed face reads them there.
  
  What that buys, with a record's files (FR-162, FR-163) in the same pages: the hosted page carries 1,609 bytes fewer up front (587,604 where main is 589,213) and 280 fewer handed a compiled app (546,632 where main is 546,912); the pages face alone loads 26,338 bytes fewer first (505,306 where main is 531,644; 10,782 fewer gzipped), and the hosted page's routed face 25.7 KB fewer before it draws (834,347). The embed with the studio handed in loads 4,965 more first (1,571,334; the value's check, the file field's door on every face and the checker reading a field as a document says it), and every face 18,725 more in all, 12,787 of it the files' own chunk, fetched with the first file field drawn; both budgets are raised by that, measured.
  
  Compatibility: breaking for an import, and nothing else. Ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged, and so is what each name does. What a host does: import `formFields` and the rest of a form from `@graview/core/forms`, and `fieldSpecOf` from `@graview/core/blocks`; a bundler alias list that names `@graview/core`'s subpaths names `@graview/core/forms` and `@graview/tools/derive` before the bare names (`graview create` writes both). Graview Cloud imports none of the moved names.
- Updated dependencies [cf22161]
- Updated dependencies [8b7862d]
- Updated dependencies [26dbe52]
- Updated dependencies [26dbe52]
- Updated dependencies [26dbe52]
- Updated dependencies [8b7862d]
  - @graview/tools@0.1.26
  - @graview/core@0.1.26
  - @graview/primitives@0.1.26
  - @graview/react@0.1.26
  - @graview/pages@0.1.26
  - @graview/ship@0.1.26
  - @graview/layout@0.1.26

## 0.1.25

### Patch Changes

- Updated dependencies [d0eb455]
- Updated dependencies [21365f6]
- Updated dependencies [21365f6]
  - @graview/primitives@0.1.25
  - @graview/core@0.1.25
  - @graview/tools@0.1.25
  - @graview/pages@0.1.25
  - @graview/react@0.1.25
  - @graview/layout@0.1.25
  - @graview/ship@0.1.25

## 0.1.24

### Patch Changes

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
- Updated dependencies [079ccec]
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
  - @graview/ship@0.1.24
  - @graview/layout@0.1.24

## 0.1.23

### Patch Changes

- Updated dependencies [8f7e998]
  - @graview/tools@0.1.23
  - @graview/core@0.1.23
  - @graview/pages@0.1.23
  - @graview/primitives@0.1.23
  - @graview/react@0.1.23
  - @graview/layout@0.1.23
  - @graview/ship@0.1.23

## 0.1.22

### Patch Changes

- Updated dependencies [9df7ef3]
- Updated dependencies [f25b52c]
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
  - @graview/ship@0.1.22
  - @graview/pages@0.1.22
  - @graview/layout@0.1.22
  - @graview/react@0.1.22

## 0.1.21

### Patch Changes

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
  - @graview/ship@0.1.21
  - @graview/react@0.1.21
  - @graview/pages@0.1.21

## 0.1.20

### Patch Changes

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
  - @graview/ship@0.1.20

## 0.1.19

### Patch Changes

- 46f2ac8: The host decides the AI, once, and a reader never sees a rung. The seat had a ⚙ that opened "What answers" — "this graph", "on this device", "Jev, which decides", "a model, with my key", with a key field for whoever had one — the same pills again as "Answers come from" in the person's menu, "graph-native" under the field, "Let a model read it →" under a sentence the graph could not read, and answers that ended "(Jev decides rather than talks — the graph is answering here.)". A person asking what is overdue was being asked which machine should answer. Now the AI a seat may use is the host's, given as `ai` on `GraviewProvider`, `mount`, `<Embed>`, a routed face's context or `PagesApp`'s, and the studio's seat uses the app's own: `{ complete }` is the host's model (prompt in, text out), `decide` a decision provider such as `jevDecide(...)`, `onDevice: true` a model in the reader's browser, and `name` what the op log records. The graph answers first, always — where things are, what is wrong, what a record says, the repairs a rule names, a view a template draws — and an open question, or a view no template draws, goes to the host's model when there is one. With none, it is answered "I can answer about what's in this app. Open questions need AI, which isn't on here."; an answer a model gave carries one quiet "Answered with AI", and one the graph gave carries nothing; a model that fails leaves the graph's answer with "(AI didn't answer just now, so this is from the app alone.)", and an on-device model a browser cannot run says AI isn't available there. A decision goes to the host's `decide`, else to a decision provider the app's declaration names (`kind: "decision"`, through the dev server's door at its `bridge` or `/__graview/decide`), else to the host's model behind the parse-and-refuse layer, else to the graph's own rules. Every guarantee holds: what the seat may see, declared acts only, previews, undo, and the log's attribution — a change a model proposed is applied with `via: "ai:<name>"` ("ai:model" when unnamed), which Activity does not show a reader. Taking the picker out shrinks what a page carries: Cloud's hosted page 806 bytes up front, the scene face before it draws 2.2 KB and the pages face 6.3 KB, the pages face alone 6.1 KB and every face 8.8 KB.
  
  Compatibility: breaking for the components and the API a host's seat reaches; ops, stored formats, the wire, the document format and tool schemas are unchanged. Added: `HostAi` (`complete`, `decide`, `onDevice`, `name`), `NO_AI`, `NO_AI_SAID`, `ANSWERED_WITH_AI`, `aiTalks`, `aiVia` (`@graview/tools` and `@graview/tools/frame`), `seatResponder(ai, { floor, onStatus })`, the `ai` prop on `GraviewProvider` and `useGraview().ai`, `ai` on the embed's `mount`/`<Embed>`/pages options and on `PageContext`, `via` on `ChatReply` and `SeatTurn`, `via` on `ToolRuntimeOptions`, `failed()` on what `localCompletion` returns (whose `warm()` now returns a promise), and the test ids `seat-answered-with-ai` (`<testId>-answered-with-ai` on any seat's thread) and `<testId>-header` on `SeatHeader`. Changed: `completionFor(ai)` and `decideFor(ai, { intelligence })` take the host's `HostAi` and the app's declared providers; a graph answer it could not read is `unsure`; `viaSaid` says nothing for `ai:<name>`. Removed: `IntelligenceConfig`, `IntelligenceSource`, `DEFAULT_INTELLIGENCE`, `RUNGS`, `rungFor`, `rungHonesty`, `loadIntelligenceConfig`, `saveIntelligenceConfig`, `describeIntelligence` and `configuredResponder` (`@graview/tools`, and the first seven from `@graview/tools/frame`); `LadderSetting`, `SeatSettings` and `describeSource` (`@graview/primitives`, `LadderSetting` from `@graview/primitives/pages` too); `useGraview()`'s `intelligence`, `chooseIntelligence`, `hostAnswers` and `registerHostAnswers`; `ChatPanel`'s `settings` and `onSettings`; `SeatHeader`'s `source`, `sourceTitle`, `settings`, `onSettings` and `foot`; `SeatThread`'s `onChooseModel`; the reader's stored rung (`graview:intelligence` in their browser, no longer read). Test ids removed: `seat-settings` (⚙), `seat-source`, `seat-ladder`, `chat-settings`, `chat-source`, `chat-ladder`, `<testId>-offer-model`, `studio-agent-settings`, `studio-agent-source`, `studio-agent-ladder`, `setting-intelligence` and its `setting-intelligence-graph`/`-local`/`-decision`/`-remote`/`-why`, `intelligence-key`, `intelligence-decision-key`, `intelligence-provider`, `intelligence-model` and `intelligence-base-url`. What Graview Cloud changes: pass its model to the app as `ai: { complete, name }` on `mount` (and `decide` if it holds a decision provider) — its users see no choice and no rung's name; a harness that opened `seat-settings` or read `seat-source` reads the answer, its "Answered with AI" (`seat-answered-with-ai`) or the "isn't on here" sentence instead; nothing on the wire or in stored apps moves.
- 46f2ac8: The seat draws a view on the fly, and it can be kept as a lens. Nick: "i want it to be able to generate the uis for me on the fly, quickly, with the ability to save that as a new lens". Asked for a way of seeing, `draftView` (`@graview/tools/draft`, a new entry fetched when a view is first asked for) drafts one from what the app already declares: "a board of decisions by status" is the `columns` lens on the `status` choice, "a timeline of dates" a calendar on the date a kind declares (a timeline where a kind's roles are minutes of a day in columns, as todo's week is), "who covers what" a coverage grid over the relation that joins two kinds, and "a list of decisions grouped by status" a lens drawn from blocks. With no model and no key, a template reads the ask: its words pick the lens and the kind, and the declaration's roles and field types fill the bindings. Given the app's `complete`, an ask no template reads goes to the model for the same JSON, and what comes back is judged as a declared lens is (`judgeLens`: the shipped lenses' own table, the bindings against the fields, each block's expressions parsed and every kind, field and choice they name read) before anything is drawn. A draft is a `SeatDraft`: its title, one line saying what it draws ("A board of decisions by status."), the lens, the `DrawnLens` the primitives draw it with, and the `add-lens` edit keeping it would make. `refineDraft` asks again — "group by owner", "only this month", "as a calendar", "call it The pipeline" — and each turn replaces the draft; a turn that cannot be drawn says why in one sentence ("Couldn't draw that: no date field on dates.") and hands back the last good one. Every draft is judged against the kinds the seat may see (`draftSight`, read from the policy's sights), so a kind it may not see reads as one that is not there: "Nothing by that name here". Keeping one changes the declaration, which is the host's, so it is another entry, `@graview/tools/keep`: `keepLens` runs the edit through `editDocument`, `compileDocument` and `diffDocuments` for a document app ("Adds “Decisions by status” to the places."), or `checkApp` over the declaration with the lens beside its own for an app declared in code, and hands back the place it made and the `remove-lens` edit that takes it back (`takeBackLens`). `withReaderLenses` puts a reader's own kept lenses beside a declaration's. An agent reaches both as tools when its host offers them: `createToolRuntime(store, { app, drafts: { complete, keep } })` lists `draft_view`, a read, and with `keep` `keep_lens`, which hands the host the checked edit. In the studio, taking a titled lens away is the `remove-lens` edit, where the studio said no edit could. The drafting engine judges with what a hosted page already runs, so it adds nothing to what the page loads before it is asked: the hosted page up front carries 43 bytes more (583.5 KB, its budget unchanged), the engine is a door of 28.4 KB, and the seat's two tool definitions ride with it (the scene before it draws 1.8 KB more, the pages face alone 2.0 KB; those budgets rise by that).
  
  Compatibility: ops, stored formats, the wire, the document format and the edit vocabulary (`add-lens` and `remove-lens` were already there), and check finding codes are unchanged. New: the entries `@graview/tools/draft` (`draftView`, `templateDraft`, `refineDraft`, `judgeLens`, `draftSight`, `lensEditOf`, `takeBackEditOf`, `lensFromSpec`, `recipeOfLens`, `draftFromLens`, `draftAnswer`, `withReaderLenses`, `runDraftTool`, `isDraftFailure`, and the types `SeatDraft`, `DraftLens`, `DraftRecipe`, `DraftResult`, `DraftFailure`, `DraftSight`, `DraftOptions`, `AddLensEdit`, `RemoveLensEdit`) and `@graview/tools/keep` (`keepLens`, `takeBackLens`, `LensHolder`, `LensKept`, `LensRefused`); `ToolRuntimeOptions.drafts` and `ToolDefinitionsOptions.drafts`, which list the tools `draft_view` and `keep_lens` (a surface that does not ask for them keeps its tools and its hash); the types `DraftTools` and `KeptLensEdit`; and the studio's act `remove-lens`. What Graview Cloud changes: to let a connector's chat draw and keep views, build its tool runtime with `drafts: { keep }`, where `keep(edit)` applies the `add-lens` edit to the stored document as its other declaration edits are applied (or with `keepLens` from `@graview/tools/keep`), and list its tools with `toolDefinitions(app, principal, { drafts: "keep" })` so the hash it compares agrees.
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
  - @graview/ship@0.1.19

## 0.1.18

### Patch Changes

- 7f4f1bb: A record's prose keeps its paragraphs, spans the record under its label and is changed in a text area, and a record's facts read in the order the kind declares, or the order its page says (FR-146, FR-147, FR-148). Graview Cloud, on Nick's "Farm Bureau POM Workshop": a deliverable holds an email drafted in full, a `text` field `draft` of about three thousand characters with paragraphs, a numbered list and a bulleted one written as `\n` and `\n\n`. The record drew it as one continuous block, the line breaks collapsed, in a value column a third of the page wide, with "Status", "Summary" and "Due" crammed above it in the same style, and its facts in the order Status, Summary, Due, Draft, Subject line: the order the record's keys had been written in, which nobody chose and nothing could change. A blank line is now a paragraph, a single line break a line break, lines that start "1." or "2)" a numbered list (starting where it starts) and lines that start "-", "*" or "•" a bulleted one, drawn as `<p>`, `<br>`, `<ol>` and `<ul>` with every word a text node (no markdown, no markup, nothing a value can turn into HTML), by `TextBody` from `@graview/primitives` and `/pages`: on the scene's record, the routed record page, a card's, row's or page's `{ "text": "{draft}" }` block (a `field` block keeps its breaks in its one line), and the record page a scaffolded app writes. A field is prose when the declaration allows it more than 500 characters (a document's `text`; `z.string().max(5000)` in TypeScript), or when its value holds a line break or runs past 160 characters (`isLongText`, and `readableFields` marks each field `long`). Prose is drawn the record's width with its label above it, in the facts' order, and the short facts stay a compact table; the scene's record reads down the panel, its relationships under its facts, when a fact is prose or the page groups them. Its label carries an "Edit" (named "Edit the draft") that opens a text area, as a click on the words does: as tall as what it holds (`field-sizing: content`, measured where an engine lacks it), named for the field, Enter a new line, Ctrl or ⌘ with Enter or leaving it saving through the act the framework found, Escape putting it back, the keyboard back on "Edit" after. The text area is fetched the first time one is opened. The routed record page's values are changed where they stand too, as the scene's are, when the face is handed views. A form asking for prose (`DerivedForm`, the scene's ask) asks in a text area. Find quotes prose as one line. `describePlace` reads a record's facts in its page's order, each group under its title, each value as stored. A record's facts follow the kind's declared fields, then its computed ones, on every face and in `readableFields`. A kind's page may say otherwise: `kinds.<kind>.page` in a document, `{ "fields": ["subject", "draft"], "groups": [{ "title": "Schedule", "fields": ["due", "status"] }] }`, and `display.page` in TypeScript, put `fields` first, each group under its title, and the rest in declared order, under "Details" when there are groups. The edit is `{ "op": "set-page-fields", "kind", "fields", "groups"? }`, said in words ("A deliverable's page shows subject and draft first and due and status under "Schedule", and the rest under "Details".") and by `diffDocuments` ("How a deliverable's page orders its facts changes."); an empty `fields` and no `groups` give the declared order back. A rename moves the page's name with the field and a removal takes it off the page. The compile refuses a page that names a field the kind does not have (`page-field`), one named twice (`page-field-twice`) or two groups of one title (`page-group-twice`); `graview check` says `page-unknown-field` and `page-field-twice` of a TypeScript declaration. The studio carries a kind's page through its round trip. `pnpm verify long-text` mounts a document shaped like Cloud's workshop the way Cloud mounts one, in three engines and both schemes, on the routed record page at 390 and 1280 and the scene's record at 1280: the draft drawn as ten paragraphs, a numbered list of four and bulleted lists of six; its value the record's width with its label above it; the facts in declared order, and in the page's when the kind says one, the rest under "Details"; the draft edited in a text area that holds every line break, is as tall as the text and is named "Draft"; a paragraph added in place and saved stored with the others intact and drawn as an eleventh; and a place's card that says `{draft}` keeping the paragraphs and lists. Run against 0.1.17, every claim failed. The hosted page carries 2.1 KB more compiling and 1.3 KB more handed a compiled app: the declared order, a kind's page and the test for prose in core, and the compile's reading of `kinds.<kind>.page`; its budgets rise by that.
  
  Hardened by the security review before it shipped: a numbered or bulleted line is read in one pass whatever it holds, so a long line with a line separator in it no longer takes quadratic time; a page's field names are a record's and a kind's own properties, never inherited ones like `constructor`, in `readableFields`, `graview check`, the document writer and `diffDocuments`; and `display.page` holds to the document's limits (40 fields to a list, 12 groups, a title of 1 to 60 characters), which `graview check` refuses as `page-too-large`.
  
  Compatibility: additive to `graview-document@1`: `kinds.<kind>.page` is optional, and a document without it means what it meant, except that a record's facts now read in the kind's declared order where they read in the order the record's keys were written; a build that predates the key refuses it as `unknown-key`. `EDIT_OPS` gains `set-page-fields`. New check codes: `page-field`, `page-field-twice` and `page-group-twice` (compile errors, on the new key only) and `page-unknown-field`, `page-field-twice` and `page-too-large` (`graview check`, on `display.page` only). New: `display.page` and the `PageFields` type, `pageSections`, `isLongText` and the `FieldSection` type (`@graview/core`); `ReadableField.long`; `ArgShape`'s text gains `long` and `ScalarField` (`formFields`) gains `long` for a string allowed past 500 characters; `TextBody`, `textBlocks`, `hasShape`, `LongValue` and the `TextBlock` type (`@graview/primitives`; `/pages` also gains `EditableValue`). Derived tool names and input schemas are unchanged. Markup: `[data-graview-fields]` is a `div` of one `dl` per section where it was the `dl`; a group is `role="group"` named by its title (`data-graview-field-group`); a prose row is `[data-graview-long="<field>"]`, a `div` of `dt` and `dd` spanning the list, its value a `[data-graview-text-body]` of `p`, `ol` and `ul`, and its text area `textarea[data-graview-field="<field>"]`; a text block whose value has a line break is a `div.graview-spec-text` holding the body, where it was a `p`. The routed record page's `[data-testid="record-fields"]` holds one `dl` per section, its groups under `h3[data-graview-field-group]`, its values the scene's `EditableValue` controls when the face is handed views. Ops, stored formats and the wire are unchanged. What Graview Cloud changes: nothing it must. A chat that sets the order of a record's page uses `set-page-fields`; Cloud's own chrome around the record page is unchanged by this. `capabilities().shipped` gains FR-146, FR-147 and FR-148.
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
  - @graview/ship@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [cc690c4]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
  - @graview/core@0.1.17
  - @graview/primitives@0.1.17
  - @graview/pages@0.1.17
  - @graview/react@0.1.17
  - @graview/layout@0.1.17
  - @graview/ship@0.1.17
  - @graview/tools@0.1.17

## 0.1.16

### Patch Changes

- ae891b0: One app bar on every face, and the scene is a place beside the others (FR-131, FR-132). Nick, on a real app in Graview Cloud: the title and the Scene/Pages toggle were ugly, bloated and broken under a notification — two stacked bars said the app's name, the way into the scene and the state of the rules twice each, and "Scene", "Pages", "Pictures" and "Map" were four words for overlapping ideas. One bar now stands over every face (`AppBar`, from `@graview/primitives`): the app — its mark (the brand's logo when the document has one) and its name, said once as the page's heading, the way home — then the app's places as plain tabs, the one you are on marked with `aria-current`, what the row cannot hold under "More"; then three tools of one size, each named: Find (inline; ⌘K or Ctrl+K on a desk; a magnifier that opens the box over the bar's first row on a phone), the standing (a dot in the tone of the rules, a number only when one is broken, opening what is broken; "Everything is in order" its name and its hover otherwise) and the person (an avatar whose menu holds who is signed in, the seats, the host's own actions such as "Report this app" and, for whoever keeps the app, the installation and the studio). One row on a desk; on a phone the places take a second. The routed face's own header — the title, the Find box, the Problems tab, "Open the scene" — is gone: under the embed's bar the derived shell draws none of it and its Find goes in the bar; on a face that owns its page the shell is the same bar. The scene is the overview, a tab beside the others — "Overview" unless the declaration calls it something else (`pages: { overview: "The farm" }`, and `arrange-pages` takes `overview`) — at `/places/overview` whatever it is called, its stop riding on it; the lens gallery is the home the app's name goes to and the relation map is "Connections". The scene's own Find now stands in the bar on the embed too. What is behind the person and the problems' rows are fetched when first reached for, and the blocks a view is drawn with come with the face that draws one (`viewsCss`): the hosted page carries 561.1 KB compiling (from 566.3) and 517.4 KB handed a compiled app (from 522.6), and its budgets come down to 562 KB and 518 KB. `pnpm verify quiet` holds, on both faces at 390×844 and 1280×800: one bar row on a desk and two on a phone (the second the places), one heading naming the app, nothing the bar says said again above the fold, one Find box, the tools one size and named, no control that says "Scene" or "Pages", and the overview and a list one press on a tab apart by pointer and by keyboard; `pnpm verify address` holds the overview's address, a link to a stop at the bare address still opening the scene, and a host that mounts on the Graview landing on the overview. `capabilities().shipped` gains FR-131 and FR-132.
  
  Compatibility: markup, options and addresses a host holds. The embed's `toggle` option is `bar`. Gone: the strip (`[data-testid="embed-faces"]`, `[data-embed-strip]`), the face switch (`embed-face-scene`, `embed-face-pages`), the strip's seats (`embed-seats`, `embed-seat-<id>`: the seats are in the person's menu, `[data-testid="seats"]`, taken through the provider's `onSeat`, which the embed forwards), the scene's place pills on the embed (`[data-testid="places"]`, `place-<as>`: the whole-page Shell keeps them), the routed face's `masthead`, `shell-nav`, `problems-count` and its `face-find-bar` under a bar, the profile's `profile-gear` and the name beside its mark, the Shell's Scene/Pages switch (`[data-testid="faces"]`; `pages-link` is a "Lists" link), and the embed's visually hidden workbench heading. New: `[data-graview-app-bar]` (`app-bar`), `app-home`, `app-name`, `app-places` (`nav`, "The app's places"), `app-place-<key>` with `data-place-path` (keys `overview`, `place:<kind>:<as>`, `kind:<kind>`, `connections`), `app-places-more`, `app-places-more-list`, `app-find`, `app-find-open`, `standing-link` on a routed face that owns its page, `[data-graview-page-title]`, and classes `.graview-bar`, `.graview-bar-tab`, `.graview-bar-tools`. `heading` now sets the level of the bar's name, which is `brand.name ?? app.name` (the `label` stays the region's name); each page's title is said a level under it (`PageContext.titleLevel`; `h2` where it was `h1`), and a view's headlines under that (`HeadingsUnder`). `PageContext.standingAbove` is `barAbove`; `PageContext.overview` and `PagesApp`'s `steering` are new. `Standing` and `Profile` lose `compact`; Standing is a dot and a count with its words in `aria-label` and `title`, `aria-disabled` rather than `disabled` when all is well. Under address routing the scene's address is `<base>/places/overview#<stop>`: `faceAtAddress` reads it as the scene (`#overview=1` as the Graview), `<base>#<stop>` still opens the scene and is replaced on arrival by the overview's address, and a bare `<base>` a host mounts on the scene or the Graview is replaced the same way. `where().path` is `/places/overview` on the scene; `setPath("/places/overview")` draws the scene and any other `setPath` draws the routed face at that page; under memory routing `onNavigate` is told `/places/overview` (push) when the reader goes to the overview, and the page's path when they leave it; Below `pagesBelow` the overview's tab draws the scene when the reader asks. `placesOf(app)` lists the overview second, after the home. `themeBaseCss` no longer carries the view-spec blocks: `viewsCss({ scope })` does, drawn by each face that draws a view (`themeCss` still has all of it). The boxed studio is drawn into the embed's own element. The derived routed face's tab for the relation map says "Connections" (its page and the home's link likewise), it has no Pictures or Problems tab (the app's name goes home, the standing opens the problems, `/problems` stays), its home no longer repeats the app's name as an eyebrow and says the brand's line under it instead, and "See it in the scene ↗" says "On the overview ↗" and is not drawn on an embedded face with no scene. The document's `pages` gains `overview`, `arrange-pages` takes it, `graview check` adds `pages-overview-taken` (a place whose address is the overview's), and the wire's `capabilities().shipped` gains FR-131 and FR-132. Ops, stored formats and tool names are unchanged.
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
  - @graview/layout@0.1.16
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
