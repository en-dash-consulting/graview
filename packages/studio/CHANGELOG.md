# @graview/studio

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
