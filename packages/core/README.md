# @graview/core

Everything a Graview app declares, and the checker that verifies it.

- **Schema** — `defineNode` and `createSchema`. Zod is the single source of
  runtime validation, TypeScript types and JSON Schema.
- **Graph** — nodes and edges, with a tracked reader so a mutation records
  what it read as well as what it wrote.
- **Mutations** — `defineMutation`. Every change is a typed, named,
  describable act; nothing writes the graph directly. Each kind gets a
  derived `edit-<kind>` offering the fields no other act writes. Every act
  refuses an argument it does not take, naming those it does, and an act
  refused as asked throws an `ActRefusal` whose
  `reason` and `sentence` a host can show (`refusalOf` reads one):
  `refused` when the act's own rule says no, `invalid` for the call as sent.
- **Invariants** — rules that judge the graph and name the mutations that
  would repair them. That naming is the seam derived affordances ride on.
- **Operation log** — the graph is a fold over it. Author, intent, reads and
  writes on every op, which is what makes selective undo a dependency
  question rather than a stack.
- **Permissions** — a `Principal` is an `Author` with roles, so what the log
  blames is what the policy judged.
- **Theme** — the token contract, the two shipped palettes, and a contrast
  checker that measures a brand's palette before it ships. The rest of the
  look is data beside them — `SHAPE`, `TYPOGRAPHY` and `isoShade(scheme)`,
  resolved for a brand by `shapeOf` and `typographyOf` — so a page outside
  the app can dress as one without importing a stylesheet.
- **`graview check`** — reads a declaration and reports what is wrong with it,
  in terms an agent can act on. In code it is `@graview/core/check`:
  `checkApp`, `describeApp`, the agent docs (`generateLlmsTxt`), and
  `compileDocument`, a document compiled and checked.
- **Documents** — `@graview/core/document`: a whole app as one JSON object,
  compiled by `compileDocumentWithoutCheck` into the same app `defineApp`
  declares and never run as code (`compileDocument` from
  `@graview/core/check` also asks the checker); `toDocument` writes an app
  back out. Rules say what must hold in a small, budgeted language
  (`expressionRule`). Every command that takes an entry takes
  `--document <file>`. A view's blocks resolve with `@graview/core/blocks`.
  A number field may say its range (`min`, `max`, `step`), which every form,
  tool and apply honours; an act's `connects` links from whichever end
  of the relation its subject is, `replaces` severs the links it supersedes and set the record at the
  other end (its "setsOther" key). `editDocument`, `diffDocuments` and
  `planMigration` change a document and say what the change does to stored
  data.
  A host that compiles a document on its server hands the page
  `serializeCompiled(compiled)`, and the page builds the same app with
  `appFrom` or `appFromOrCompile` from `@graview/core/compiled`, which
  carries no compiler (the format is `graview-compiled@1`).
- **The city** — `@graview/core/scene`: `sceneThumbnail` draws a document
  (or an app) as the Scene draws it from altitude — the same districts on
  the same map, in their hues — as one SVG string, with no DOM, for a host
  listing apps; `sceneDistricts` is the same answer as data. At a card's
  size, `fit: "content"` fits it to what stands: each district on its whole
  block from the same corner, cropped to the plots, with a few blocks no
  narrower than `minBuilding` pixels (16 by default) rather than a speck per
  record. Without counts — a live app with no snapshot — each district stands
  three blocks placed and raised by its kind's name, so every app still looks
  like itself. `size: "icon"` draws it as a tab's icon: 32 by 32, each
  district on its block in its hue with one block on it, readable at 16
  pixels and about a kilobyte — a standalone SVG to serve as a favicon. A kind's
  figures are `@graview/core/figures`.
- **What a page loads first** — `@graview/core` and `@graview/core/document`
  hold only what a page draws with. The checker, the city, the figures and
  the block resolver are on the subpaths above because a bundler places a
  whole module in every chunk that can reach it: a hosted page imports both
  barrels up front, and would otherwise carry them before a face is fetched.
- **A place's address** — `addressOf(place, { basePath })` spells a place
  from `placesOf` as the routed face links to it under a host's base path,
  `pathWithin` reads an address back, and `basePathOf` normalises a base.
  A `search` hit says its own: a record, a kind's list or a place carries
  `address`, spelled the same way under the `basePath` it is given, and a
  seat finds only the records its sight lets it open.
- **Conformance** — `@graview/core/conformance`: fixtures a host runs against
  a version (`conformance()`) to prove it reads, compiles and derives the same.
- **A status board's moves** — `@graview/core/describe`: `columnReach` says
  which acts move a card to which column — the named steps that set the
  field to that column's value, or else an act told the value — and
  `columnMoves` the ones one seat may run on one record, its conditions
  judged.

```sh
npx graview create my-app          # a product on Graview, started (also: npm create graview)
npx graview check ./dist/domain/app.js
npx graview docs ./dist/domain/app.js
```

`create` writes the declaration split into domain and UI, a shell, a headless
test and a CI workflow, initialises a repository, installs, and says what to
do next. `--link <path>` consumes the framework from a sibling checkout by
path instead of a registry — the only way that works until the packages are
published — and refuses a framework that is not built.
The generator behind it is `@graview/core/scaffold`, a pure function from a
name and a first kind to a list of files, for a host that provisions apps.
