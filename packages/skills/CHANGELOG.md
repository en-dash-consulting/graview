# @graview/skills

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

- 080645e: The graview-new-app skill says to run a product at the size it will have: seed a real catalogue rather than a dozen rows, because the scene groups a relation too long for its band and a thumbnail draws its 12 most relevant members — what that hides, whether the groups are the ones a person would ask for, is the author's to judge.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- 8041853: A decision provider is a third kind of intelligence, and the declaration says so. `intelligence[].kind` accepts `"decision"` beside `"graph"`, `"llm"` and `"external"`: a provider that answers typed questions — a Choice over named options, a truth, a Score over an ordered rubric — with a confidence, and never prose. `providerCan(provider, "prose" | "decide" | "propose")` derives what each kind serves from the kind alone, so a surface asks whether a provider can before offering it.
  
  `graview check` holds a decision provider to what it can decide: an act on its allowlist whose required arguments want text, a date or an unbounded number is one it could never call, and is refused (`intelligence-decision-cannot-call`, naming the act and the argument); a paste or MCP door on one is words out and words back to something with no words (`intelligence-decision-prose-door`). `undecidableArguments(mutation)` is the function behind it, exported for the surfaces that will derive questions. `graview describe` and the generated docs read a decision provider out as what it is, and the `Door` draws none for it — a prompt-out answer-back door is a chat offered to a thing that cannot hold one.
- 4c4d52a: A drive-in's thumbnail is a picture of its lens, not the lens. It hands the lens its 12 most relevant members (the flagged, then the most connected) with `budget` and `total` — new on `ViewProps` — and is mounted the first time it is on screen with the scene still, one thumbnail a frame; `useSceneStill` and the scene's motion store say when. A lens with a budget draws no arrangement row, the coverage holds its rows and columns to it, and the board, timeline and calendar say "+N more" in the kind's words (`withMore`, exported). The row's "only…" menu offers at most the 40 most connected far ends — a release's menu listed every song. Over Tech N9ne's catalogue the city at altitude went from 21,335 elements to about 1,200, and rising from 21,495 to 2,493 with every thumbnail drawn. The graview-lens skill says what a lens does with a budget.
- ce13ec8: The board lens draws a token when a code is a word, and shelves a zone's slots when the arrangement is categories. A 34-pixel disc holds "GK" and "LB"; it never held "Outbound", which spilled past its ring, or "Prop-fin", which wrapped at the hyphen inside it — and a slot's code is its whole label whenever nothing shorter is bound, so most boards outside a pitch were boards of words in circles. A board whose every code is three characters or fewer still draws discs. Any longer and the whole board draws tokens: a pill sized to its code, cut with an ellipsis past the width of a long word and carried whole in the title, with whoever is in it on the line beneath, INSIDE the mark — so a mark is one box whose size is known, and two names on a shared seat can no longer land on the row below. `occupantLabel: "given"`, which shortened those names to hide the collision, is gone.
  
  `arrange: "shelf"` is for a board whose x and y are categories rather than coordinates — a load map whose rows are "still owns", "shared", "handoff". Each zone becomes a band with its name as a heading row of its own, and its slots flow into rows in the domain's order, sized to what they hold; nothing on a shelf can overlap anything, and a zone's name can no longer be clipped to the middle of the word by a fifteen-pixel rail. The default, `"exact"`, is unchanged for a pitch or a seating plan, and its rail now ends a name that does not fit with an ellipsis and carries it whole in the title.
  
  The `graview-lens` and `graview-new-app` skills and the package READMEs say so: the board's two marks and its two arrangements, and that a new app's pages face wants the scene's `views` to land on its gallery.
  
  A placed mark is as wide as what it holds: an absolutely placed token with no width of its own shrank to the room between its point and the field's edge, so on a phone-width board a token at 82% was 22 pixels wide with its word broken inside it.
- a5d842b: One edge name is one relation. `graview check` refuses `edge-name-shared` when the same edge name is declared on two kinds in different words — `by` on a song ("their songs") and on an album ("their releases") put an artist's songs and releases together under whichever came first, on the card, the record and the captions. Declaring a name from several kinds in the same words stays legal. `edgeAllowed` now judges an edge against the declaring kind's own targets rather than the first declaration's, and `schema.edge(name).to` is every declaration's targets. The studio's grant edge is `allows-on` (it shared `over` with the rule, so a kind's page listed its grants as rules), and the `graview-node-kind` skill names the check.
- 76e50a5: The checker, `describe` and the docs know about arrangement. A lens declaration may say `arrangedBy` in the arrangement grammar; `graview check` warns `order-role-unknown` when `fieldRoles.order` names a field the kind lacks and notes `lens-arrangement-unknown` when a lens opens arranged by something none of its bound kinds offers. `graview describe` gains "What can be arranged": every kind's sorts, filters and groups in the declaration's words, and how each lens opens. `llms.txt` says the grammar and, per kind, what it is arranged by, so an agent that cannot see the row can still write the stop. The `graview-lens` skill gains the step — take an arrangement, and say what your picture has no place for — and `graview-pages` says the shared words the list page now speaks.
- 8d43e33: The embed has a skill of its own, `graview-embed`: open where the stop says, pick the face for the page (`picture` for one lens alone), name every embed so two on a page are two regions, let the host decide the scheme and fonts, offer seats when the page is about the policy, mount many as the reader nears them, and presence only when handed a channel — with the seedbed site, the rota host page and the scaffold as worked examples. `graview-pages` is the pages face alone now and points there, which leaves it room under its length budget instead of twenty characters.
- 53ad439: The hosted-store contract is written down. `WIRE`, exported from `@graview/ship`, names every route `serveStore` answers with its method and one sentence, and a test walks it; `SEAT_HEADERS` names the headers a request carries its seat in. `openRemote` takes `headers` — sent with every request, never read by the framework, the seam where a host's own credential goes — and exposes `settled()`, which resolves once every call sent so far has been answered; the server's CORS allows `authorization`. And a server's op for a change this client already applied provisionally is now RECORDED rather than re-applied (`store.receive(ops, { applied: true })`): an optimistic add followed by the server's own op used to throw a duplicate-node error out of the wire and be reported as a refusal.
  
  The README carries the concern table — op log, snapshot and migrate on open, the wire, a principal on every apply, the seed at first install, content steps and the agent's door in the framework; auth, tenancy, quotas and fleet upgrades in a host — so a third party stands up their own host without forking anything, and Graview Cloud is the polished multi-tenant host of the same API. `graview docs` now writes an "Attaching an agent" section into llms.txt and an "Evolving a live store" checklist into agents.md; the `graview-agent-seat`, `graview-ship`, `graview-node-kind` and `graview-permissions` skills say the same; and a project from `graview create` has `serve` and `mcp` scripts and ignores `data/`.
- fc7103b: The pages face lands on a gallery. The derived home read as a readme: the brand's name repeated under the masthead, a sentence of counts, the relations in full, a section per kind with its description and four members — and the app's own pictures as two 288-pixel cards a third of the way down a 760-pixel column, the smallest thing on the page. Now the standing is the headline ("2 gardeners, 3 plots and 1 planting.", or "Nothing here yet." and which act begins it) and the pictures come next, large and live: every titled lens as a card the width of half a desk or a whole phone, drawn by the lens itself at a scale measured from the card, inert, captioned with its name and how much it is over. The kinds follow as one row of counts, the relations as one line that opens `/map`, and Recently stays short at the foot.
  
  Every kind is a picture by default. `registerDefaultViews` titles nothing, so a new app had no places and no pictures on its pages at all. A live kind with no titled lens now gets a card of its own — a group view the app wrote is drawn as it is; the framework's own is replaced by a contact sheet of the members at summary fidelity, the same card the scene stands in the district — titled by its plural and opening its list. Titling a lens replaces the kind's card rather than adding to it. A picture with nothing in it says so and names the act that would begin it, rather than showing a blank frame. Given no view registry the face still lands on the gallery, each kind a card of its members' names.
  
  The shell is one row — the pictures (home), the kinds, Map, Problems — and scrolls sideways on a phone rather than wrapping to three rows; the shell and the gallery take a 1160px column while the pages that are read keep their 760. A picture's page carries its sibling pictures as a strip, and `/places` is the same gallery at its own address. `Gallery`, `GalleryCard` and `galleryOf` are exported for a design that wants the cards on a page of its own.
  
  `graview create` hands `PagesApp` the app's views and settings in the `main.tsx` it writes, so a new project's pages face has its pictures, its map and its assistant without anyone editing the file. The `graview-pages` skill says what now comes for free; `verify-pages` measures the gallery on the framework's default face — two across at a desk, one on a phone, every frame with something drawn in it, the nav one row — rather than asserting it.
  
  A new page opens at its top. The router kept the document where it was, so a card pressed at the foot of the gallery opened the picture's page already scrolled to its own foot; the readme-shaped home was short enough to hide it. The face now resets on every new address — not on Back, which the browser restores itself, and not on a change of search alone, which is the page you are on — scrolling whatever holds it: the window, or the nearest ancestor that scrolls when the face is inside an embed's frame.
- a38a5af: The routed face offers Find and the way back, whichever shell draws it. Taking the last change back could not be done on the pages of any app — nothing on a page offered it — and rota's pages had no Find box, because only the derived shell drew one and every design replaces the shell. The face's root now owns both: a shell that places `<PageFind>` or the new `<PageUndo>` says where they go, a shell that places neither gets Find in a bar above it and the way back docked at the corner, and only `surface("shell", Shell, { without: ["find" | "undo"] })` goes without. The way back says what it takes back ("Take back “Rename to …”"), takes back the person's own latest change as that person — never one the policy would refuse — answers ⌘Z and Ctrl+Z anywhere on the face but inside a text field, where they stay the field's own, and lands the keyboard on the page's heading when there is nothing left to take back.
- dff45ce: The skills know search. `graview-pages` says `/search?q=` and the nav's box, and that a shell of your own adds `<PageFind>`; `graview-agent-seat` says to find by name with `search_graph` before reaching for `get_graph`, with its conditions and its reads; `graview-new-app` says the `FindBox` comes with `Shell` — `/` or ⌘K, the picture lit, `#q=` a stop — and that a shell of your own puts it in its bar.
- 6520856: The studio writes a checkout back as it found it. A field the graph still reads the same way keeps the checkout's own schema — `.max(60)`, `.int().min(1).max(99)`, `isoDate`, `nodeRef` — in the files and in the app `apply()` returns, so a round trip no longer raises `label-unbounded` or validates less than before; `z` is imported from `@graview/core`, not "zod"; and an act the checkout wrote keeps its own input, with its history sentence marked as the checkout's to supply, like its body. The `graview-studio` skill's examples address `declared:plot`, the id the studio actually uses.
- 5856676: What creating a real app beside the framework taught. `graview create --plural Shifts` is accepted — a person types the word, the generator wants the slug — and the generated rule test judges one rule at a time, so the second rule you declare does not fail it. A new `graview-pages` skill covers the routed face from the derived pages to a product design over every surface, and the embed; `graview-new-app` says what to make yours next, in order, with the chapter that shows each step.

## 0.0.1

### Patch Changes

- 964d140: The DOM path is a citizen of every browser. The board no longer trusts
  `height: 100%` to transfer through `aspect-ratio` — Firefox and WebKit
  treated it as indefinite inside the panel's flex chain and collapsed the
  pitch to its border pixels, taking every slot's hit target with it; the
  width now comes from the same ResizeObserver measurement that decides when
  the board turns. The local-AI rung fails fast and says why when a browser
  has no WebGPU, and the chat header carries that reason instead of a shrug.
  The graview-new-app skill states the supported-browsers floor.
- ff01375: A skills package: eight authoring moves, each ending in a real `graview check`
  verdict rather than in a claim, and each saying which part of its own work the
  checker cannot see.
- 587764e: The skills point their worked examples at what this repository ships: the
  todo and seedbed examples and the framework's own tests. The three product
  apps that used to serve as examples — a household week, a bid desk and a
  coaching week — live in their own repositories now, and the port-app skill
  describes the parity fixture that proved the port rather than pointing at
  a path that has moved.
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
