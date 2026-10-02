# @graview/core

## 0.1.1

### Patch Changes

- e0c8cac: A list's "Only…" filter and the chip it leaves say a value as the record does — "SUV", "Body style: SUV" — through the new `valueWords`, rather than the field's raw "suv". The watch no longer counts a word one kind declares ("Status") as another kind's key.
- e1b9f5c: A form asks in the record's words. An argument that fills a field of the kind its act makes or acts on is labelled as that field ("VIN", "Body style"), its choices are said as the record says them ("SUV", "Plug-in hybrid"), and an argument called `label` is asked for as a "Name" — on the routed face's forms and in the scene's ask alike (`argumentWords`). A refused argument is said field by field in the same words — "Not yet: Email — invalid email address." — rather than as `Invalid arguments for mutation "sign-up" email: …` (`failureWords`, `InvalidArguments`). The watch is told a declaration's choice values, and the key's own words wherever the declaration has others.
- cbdd94a: A kind declares what a glance at one says — `display: { glance: ["price", "mileage", "fuel"] }` — and every card, list row and Find hit says those first, in that order. Unsaid, it is still the first fields the heading does not say; `graview check` notes `glance-unchosen` on a kind with more than five fields and no choice, and refuses `glance-unknown-field`.
- 097d684: A count of one says the kind's noun: "1 car", "1 test drive", where a place card, Find, a district's name, a band of a district and a coverage's gaps said "1 vehicle" and "1 test-drive". One function says it now (`counted`).
- a1859c5: A form sends a list nobody added to as an empty list (`formArgs`). "Put a car on sale" with no features listed was refused on press, "Features — expected array, received undefined", for a car the declaration allows.
- 1df48c8: A list narrows by a number and by a word. The arrangement offers every number field as a filter — `price:at-most:25000`, `mileage:at-least:10000` — and every word field by the values it holds; the arrange bar's Only… lists four round steps through what the list holds ("at most £25,000") and a word field's values by name ("Make: Kia") when there are up to sixty. `roundSteps` is exported.
- ccfe1cd: A lens path that cannot get from its columns to its rows is a binding error, not a picture of nothing covered. `graview check` walks it off the declaration (`lens-binding-path-misses`, saying when it is only named backwards and how to name it), and the coverage throws a `CoverageBindingError` with the same sentence rather than reading every row as uncovered. `walkKinds` is exported.
- c307981: A record is read whole. `readableFields` stopped at ten fields unless told otherwise, so a car with sixteen had a page that ended at its condition — no price, no mileage, no features — and the assistant answered from the same short list. Unset, the limit is now every field; a glance (a card, a chip, a search hit) still asks for its few. `awkwardApp` takes `fields`, for kinds that carry as many as a real record does.
- fa8bd61: A list page's "Related:" names each relation in its own words from that end — "The test drives booked in it", linked to the test drives — rather than the edge's name ("Drives Test drives"), and a list of one says the kind's noun ("1 car"). The watch is told an edge's spoken name wherever the edge has words of its own.
- 32ea5ac: The record page `graview create` writes says what the record is from the declaration — "A car in Harbourline Motors" once the kind declares `noun: "car"` — rather than the word typed when the project was made, and no longer heads every current record "Current.".
- d76a957: A policy says who may see what, as well as who may do it. `Policy.sees` keeps a kind to the roles a sight names — with `own`, to the principal's own record and what an edge joins to it — and a kind no sight names stays everybody's. `store.seenBy(principal)` is the store as that principal may see it: its graph, log, history and problems hold only what they may see, and every act still goes to the store itself; with no `sees` it is the store, unchanged. The scene's provider and the routed face hand every surface that view, a kind a seat sees none of and may not begin is kept from it like an administered module, and the way in leaves it out. `graview check` refuses a sight naming an undeclared kind (`sight-unknown-kind`). A watching harness is told what the seat may not see (`tellTheWatchWhatIsUnseen`, `useTheWatchKnowsWhatIsUnseen`).
- b535cb2: An author nothing names is said by what it is — "the upgrade" for a migration, "the system", "an agent" — never by a namespaced id: the activity rail headed an upgrade "ship:migration". A watching harness is told every author id in the log that names no record.
- 6b297f0: An act offered from its far end, with its subject still to choose, is asked about as the seat would choose it. A grant on the seat's own record (`self: true`) or drawn by kind ("a reviewer, on talks") could not pass a subject nobody had named, so a shopper was refused "Shortlist a car" on every car "— a manager or a shopper can", and a reviewer every topic. The open subject's candidates are now narrowed to those the seat may act on; when that is only the seat's own record the subject is filled in and the form stops asking who; when the seat's own record is already done, the act is neither offered nor refused. `store.permits` reads an unchosen subject as the act's one subject kind.
- 414ddde: The watch counts a choice's raw value as a key's words only where the declaration says the same word another way ("suv" for "SUV"); a value that is an ordinary word ("open", "new") is a word the interface also says.
- a575ca9: A linked project's dev server and tests reach every entry a package exports: `graview create` aliases `@graview/core/testing`, `/cli`, `/scaffold` and `/sqlite`, `@graview/tools/cli` and `@graview/ship/dev` and `/cli` ahead of their bare names, where `@graview/core` alone used to take `@graview/core/testing` and point it inside core's index file — a product's tests that reached for the testing entry did not load at all.
- f1cf758: The map of the kinds marks each relation's name as said on purpose (`data-graview-speaks-ids`) — it names the declaration's relations, and their words follow — and the watch no longer counts a choice value's spoken form ("Mon") as a key's words, which a calendar prints as an ordinary weekday.
- 6966a4e: A watching harness is told what each surface's seat may not see separately, and holds a page only to what none of them may see: two embeds on one page can sit two different seats down.

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
- 390028c: `graview check`'s `label-unbounded` note asks whether a ceiling was chosen, not whether it is sixty. It tried a 61-character name and called any field that took it unbounded, so a label bounded at 100 — where a real catalogue's titles run to 78 — was told it "has no maximum length". Now only a label that takes ten thousand characters is noted.
- bff0b71: A change is logged in the record's words, and a seat's roles are said in words. The derived edit's history read "price → 49900" and "condition → \"cpo\"" beside a card saying "Price $49,900" and "Certified pre-owned"; it now uses the declaration's `display.labels` and `display.format`. The profile pane named the seat's roles by their ids ("sales-manager"); it says them as words ("Sales manager").
- 400a6df: A fact on a chip says what it is. `readableFields` gives every field an `alone` reading — a word as itself, a number with its label ("Track 8", "Length 4:27"), a yes/no as "Explicit: yes" — and the default summary card, the pages' gallery and the list lines all use it. A song's card used to read "8 · 4:27 · Yes".
- c7a3519: A create can name its id, and what was made can be unmade. Every act that declares `creates` now takes an optional `id` argument the framework adds beside its own: `compileMutation` lifts it before the declaration's input parses, `freshId` hands it out first, and an id the graph already has is refused by name rather than quietly suffixed — so a seed being synced, or an agent that will refer to the node in its next call, gets exactly the id it asked for or an honest no. The tool schema says so (`mutationToolSchema`), and `takesAnId` says which acts take it.
  
  And every kind gets `remove-<kind>` derived beside `edit-<kind>`: destructive, titled, taking the node and its ties, logged and undoable, permitted through the acts that create the kind or a grant naming it — who may bring a thing into being may take it out, which is narrower than the edit's reading on purpose. An app's own `remove-<kind>` is kept. `derived` on a mutation is now `{ kind, act: "edit" | "remove" }`; `deriveMutations`, `deriveRemoveMutations`, `removeVia` and `derivedVia` join the exports, and the store, the checker, `describe` and `docs` all count the removes with the edits. The refusal for a derived act nothing declared reaches now says "creates or changes" rather than the edit's "writes or creates".
- 09a23a3: From altitude a district stands as the kind's own drawing, not as one more box. The figure was an eighteen-pixel chip on the nameplate while an anonymous isometric block carried the whole landmark — the emphasis exactly backwards, since the box is what every kind looks like and the drawing is the only thing on the screen that says which kind this is. The population still reads, in the drawing's size rather than a box's height. A kind with no figure keeps its block; nothing about a figure is required.
  
  Standing a district on a figure showed what the shipped art actually was at more than twenty pixels. `person` was two crescents — a head drawn as two arcs is a circle only while it is too small to see — and is now a standing figure with a head, a torso, arms and legs. `rule` was a ruler lying on the diagonal and `note` a flat document icon, the two figures in the set drawn square to the page while everything around them stood in the city's own projection; they are now a set square standing on its edge and a leaf of paper standing with its corner turned.
- 92a2f73: What a person reads names a field, a relation and a group in the declaration's words, never by id. `fieldWords(definition, key)` is the one place a field becomes words (its `display.labels`, else the key spoken); an editable value's tooltip no longer says "changes "plannedAt" through a mutation", the inspector no longer says a line's edge is "rides-in", the calendar's refusals and the structure suggestions ("all 3 share the day "mon"", "(assigned to)") read in words, and `bandAggregateWords` names a band's group — the seat had been calling one "album|released-by|in|type=album".
- 509162f: A project `graview create` writes passes its own checks again. Its first kind's `label` is bounded (`z.string().min(1).max(60)`), so `graview check` has nothing to say about a fresh project; its routed home page hands `<Begin>` the store, since the pages face has no provider around it. And on a narrow Graview the companion's sheet makes room in the picture for itself, as the actions strip always did, rather than lying over the district it is about.
- 3f86b09: A glance does not say its heading again, word by word. A card's summary and a list line dropped a value only when it was the whole heading, so a vehicle headed "2027 Subaru Forester Sport" — its label built from its year, make and model — spent two of its three facts on "Year 2027" and "Subaru" and never reached the price. `readableFields(..., { glance: true })` drops a value the heading carries as whole words; a record's full facts keep every field, because that is where each one is changed.
- 188bc6e: `graview check` no longer calls a title with a hyphenated word in it an identifier. Any hyphen drew `mutation-title-is-an-identifier`, so a dealership's "Offer a trade-in" — the kind is called trade-in because the word is — was told it read as a name in the source. A hyphen is a slug only in a title that is one word; an underscore, or interior capitals in one word, still is.
- 1ebfd44: A kind has a figure. `defineNode(kind, { figure })` takes inline SVG — one `viewBox`, `currentColor` strokes, no fill — or the name of one from a small shipped set (person, plot, box, task, shift, list, vehicle, rule, note), and a brand may override any kind's. One `<KindFigure>` draws it everywhere a kind is drawn: the kind card at altitude, the district beside its plural, the routed face's rails and record eyebrows. A kind without one is drawn exactly as before; nothing about a figure is required.
  
  `graview check` refuses a figure that cannot be drawn — no `viewBox` (nothing can size it), a literal colour (invisible in one of the two schemes), nothing stroked with `currentColor` (it will not take the kind's ink), or a name nothing ships — and refuses a brand drawing for a kind the app does not declare. `drawFigure` in `@graview/tools` asks a model for one in the house style and judges the answer with the same function, so a drawing that would fail the build never reaches a person as a proposal; a model that throws or draws badly falls back to the nearest shipped figure BY NAME and says so, because guessing that a cleat is a box would be the framework having an opinion about a domain it has never met. `graview figure <entry> --kind <k>` prints the line to paste.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- e0d5026: A kit for the picture. Everything the scene draws that is not a view — the lines, their captions, the ground's grid and lattice, the kind tags, how far the unlit recedes, the mark a broken rule leaves — is declared on `brand.kit`, any part of it, the rest as shipped. A connector's route is a named strategy (`curve`, `straight`, `orthogonal`) and its stroke a named pattern; each is one case in one file, so the next is one more case and nothing in the scene moves. Colour and visibility are per edge kind under `connectors.byEdge` or for all under `connectors.all`; a kind kept quiet is not drawn and stays selectable from the inspector. `themeCss` emits the kit as `--graview-kit-*` custom properties that the ground and the tags read. `graview check` holds an explicit line colour to 3:1 against both grounds in both schemes (`kit-contrast-below-aa`, `kit-colour-unreadable`). An embed's handle gains `setBrand`, so a page can re-dress a running Graview.
- 41abe03: A lens is a drive-in: the picture stands at its kind's plot, and descending is walking up to the screen. From altitude the focused group's named picture no longer floats in the middle bound to no kind — it is a SCREEN standing on that kind's plot, anchored to the plot's far edge and centred on it, sized by the plot's side with a floor for legibility, drawn with the same natural size and shrink as before (the interface scaled, never re-laid-out small), and shrunk only as a last resort until it stands on no other district's nameplate. A picture over two kinds (`ViewMeta.across`, carried on the `Place`) stands on the road between their plots. `LayoutNode.screenOf` names the kind and survives the tween; `LayoutOptions.screens` is the registry's named places by kind. With the screen on its own plot the city no longer slides aside for a picture in the middle.
  
  Every kind with a named place has a drive-in on its district card from altitude: a dark screen and a marquee of real, keyboard-reachable buttons labelled "<plural>: <title>". Pressing a showing focuses the kind with it and descends in one gesture — the lens is already drawn at the plot, so the descent tweens from the screen to plane 0 and reads as walking up to it. On the focused drive-in, pressing another showing switches the picture without descending (`in.view` changes, the stop stays at altitude and round-trips through the address); pressing the showing that is showing walks up to it. "Focus" from altitude descends into the focused drive-in, else the selected kind's, else the first kind that has one. Focusing a drive-in off the edge of a large city re-centres the pan on its plot. `useWhereIs("screen:<kind>")` answers with the audience strip in front of the screen, where figures will stand. The road's hit corridor now keeps off card faces by its own half-width, so a press on a district's corner is the district's. The navigation harness drives all of it, including a mid-tween capture that asserts the lens moved from the plot rather than from the centre.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- b7f83cc: A migration is data, and the studio writes it. `stepsMigration({ from, to, steps })` in `@graview/ship` turns declared steps — a kind gone or renamed, a field dropped or started, an edge removed or MOVED — into primitives against the stored graph when it opens; a moved edge is carried to the records of its new kind tied to each old end (a gardener who tended a plot tends each planting in it). The studio's `migrationSteps` sees a relation declared on another kind as a move, says it before Apply, and writes it into the app's `defineApp` through the studio door (`add-migration`: the version moved on, the migration appended, its import added), so a stored graph is carried forward, logged and undoable, the next time it opens.
- 923bbfa: A profile on the bar. `<Profile>` is the one place that answers "who am I signed in as" and holds what belongs to the reader rather than to the installation: their own record (where an installation is declared), the seat switcher, the settings, and the scheme. Settings are declared — `app.settings`, drawn by the pane, honoured by the provider, and checked: `graview check` refuses a setting nothing can apply, one with nothing to choose between, one that opens on an answer it does not offer, two that share a name, and a root font size that is not a length. `readerSettings()` is the two every app should offer (text size and motion); `applySettings` carries them at the edge so an app's two faces agree.
  
  Two bugs surfaced underneath. The theme set `font: 0.875rem` on `html, body` — so the ROOT's own size became 0.875 of the browser's, every `rem` in the framework resolved against 14px instead of 16, and the one place a text-size setting can live was already occupied. The body is sized now; the root is left exactly as the reader has it, and "As your browser has it" stamps nothing rather than guessing. And `usePickTargets` stamped `role="button"` on every pick target including landmark elements, which ARIA forbids — three `<header role="button">` on the first screen of the demo, unnoticed because nothing had run axe over the scene. The role is now stamped only where it is legal; a target that cannot take it still gets `tabindex`. Motion is overridable by the reader: the stylesheet's reduced-motion rules are emitted once for the system's preference and once for `data-graview-motion="reduce"`, scoped so an embed honours a host's answer without restyling the host.
- e695209: A project can mount itself. `EmbedOptions.views` was typed as the erased return of `registerDefaultViews`, so passing the registry an app wrote for its own declaration — the only thing the option is for — was a type error; it is typed to the app's schema now. And a scaffolded project gains `@graview/embed` as a dependency, its dev alias, and an `embed.html` + `src/embed.tsx` to put one in, so the last rung of the pages skill is something a new project can actually climb.
- 190c4a8: A record's ties tell two of one name apart, and the scaffold's own record page shows the record. `recordFacts` gives each tie target an `apart` — what tells it from another of the same name in its group — and the derived record page says it beside the link, so a vehicle's two "Check engine light on" appointments are two things. The record page `graview create` writes now lists the record's facts, which it had dropped (a one-kind scaffold has only a name, so the gap was invisible until the kind grew a price), and makes each tie a link rather than a comma-joined line of names.
- e59fa1f: A refusal says what it refuses in words. The policy's sentence, struck through beside every act a seat may not take, read "Not permitted: close-deal on a deal — sales-manager can." — the act by its name and the role by its id, beside a button reading "Close the deal". The store now hands the policy its titles and nouns, and roles are said as people say them: "Not permitted: “Close the deal” on a deal — a sales manager can." A declared agent's refusal names acts by their titles too. `refusal.wouldNeed` still carries the role ids for anything that reads them. `PolicyWords` is exported, and `permits` takes it last.
- f801b4d: A repair is an act, and a seat may not be able to take it. Both repair surfaces rendered a rule's repairs straight from the violation, without asking the store whether this principal may run them — so a narrower seat was handed a live button and met the refusal on submit, while the actions strip beside it had already struck the same act through. `Repairs` takes the principal now and withholds what it must, with the policy's own sentence.
- 8e872b5: A repair with a blank in it is an ask. The problems page and the record page rendered every repair a rule named as a bare button applying the violation's own arguments, so a repair declaring `missing: ["owner"]` threw "expected string, received undefined" into the console and told the person nothing. Both surfaces — and the scaffolder's record-page template — now use one exported `Repairs` component: one press when the repair needs nothing, the derived form when it still has something to choose, and a refusal said where the press happened.
- 2cc27e9: Another seat's work is named by the seat's name. `nameOfAuthor(author, { graph, schema, seats })` reads the user node, else the seat the principal was offered under, else the id; the activity rail, the profile, and the routed face's history use it, and `PageContext` carries `seats` (the embed hands its own over). An app with seats and no installation read "user-lena" and "U user-june".
- b90b6c7: A seat signs its own work. `AgentSeat` wrote every op with the author id "claude", hardcoded — so two seats on one embed were indistinguishable in the history, and a seat that is a rules mender or a scheduled job wore a vendor's name. `who` is now a required prop, the way the chat seat has always signed "chat".
- 8041853: A decision provider is a third kind of intelligence, and the declaration says so. `intelligence[].kind` accepts `"decision"` beside `"graph"`, `"llm"` and `"external"`: a provider that answers typed questions — a Choice over named options, a truth, a Score over an ordered rubric — with a confidence, and never prose. `providerCan(provider, "prose" | "decide" | "propose")` derives what each kind serves from the kind alone, so a surface asks whether a provider can before offering it.
  
  `graview check` holds a decision provider to what it can decide: an act on its allowlist whose required arguments want text, a date or an unbounded number is one it could never call, and is refused (`intelligence-decision-cannot-call`, naming the act and the argument); a paste or MCP door on one is words out and words back to something with no words (`intelligence-decision-prose-door`). `undecidableArguments(mutation)` is the function behind it, exported for the surfaces that will derive questions. `graview describe` and the generated docs read a decision provider out as what it is, and the `Door` draws none for it — a prompt-out answer-back door is a chat offered to a thing that cannot hold one.
- b9b0635: A time of day is asked for. An argument whose pattern is a date with a time in it (`YYYY-MM-DDTHH:MM`, the gauntlet's workshop start and a talk's slot) described itself as a plain date, so every face offered a date picker, the picker gave `2026-09-20`, and the act's own pattern refused it: no workshop could be made and no talk given a slot, on either face, at either width, with either hand. The date shape and its form field now carry `time: true` for such a pattern; the routed form, the scene's ask, the edit in place and the studio's agent panel ask with a date-and-time control, and the conversation and the starter fill one with a time of day.
- 5e6d4e7: A store in a page a harness is watching hands the watch the store itself once it holds its graph, so a harness that drives a job as a person would can read the log afterwards and say whether the press did what it meant. Where nothing is watching it is one property read.
- 03b9c5a: A store in a page a harness is watching tells the watch its declaration's names — kinds, field keys, edges, acts and roles, with the words it has for each — the id of every seat that signs an act, and every press the policy refuses. The browser harnesses use it to catch a declared id shown to a person, and an act offered to a seat that may not take it, on every screen they reach. Where nothing is watching it is one property read.
- 5297528: A withheld act says why. The actions strip named a refused act and put the reason in a `title` on a disabled button, which cannot be focused — so the explanation was out of reach of a keyboard and required hovering a dead control. It is struck through with the sentence beside it now. `Grant.describe`, documented since it was added as the thing shown on a refusal, is finally read: a refusal repeats the policy's own words. And a refusal about a derived edit counts the grants that name it as well as the acts it rides, so a `mutations: "*"` grant no longer produces "no role can".
- 959955f: An agent in the studio: ask for a declaration change in words, see it checked, keep or discard it.
  
  Both halves of this already existed and nothing joined them. The studio could take a proposal from an agent seat — `propose`, `proposals`, `decline` — and the chat panel could already turn words into proposals over the ordinary runtime. But the studio itself had no agent in it, so the one surface whose subject is the declaration was the one surface you could not talk to: every change by hand, one act at a time, with the whole shape held in your head.
  
  The studio's bar now carries its own Ask. A turn produces PROPOSED studio acts and stops there — nothing is applied by asking. Each proposal is put through the new `Studio.would`, which applies the call to a copy of the store and checks what the declaration would become, so `graview check`'s findings are read before anyone is asked to keep anything; a change that would add an error is struck through with the finding that condemns it and has no Keep button at all. Keeping calls `studio.propose`: an ordinary op in a batch of its own under the agent's name, with an inverse, so the studio's trail says who proposed it and undo takes it back.
  
  Keyless first, like the rest of the ladder. `studioResponder` reads the meta-graph and answers about the declaration itself — what kinds there are, what an act writes, what a rule judges, who may take it, which kinds have no figure — and fills studio acts from a template: "add a due date to tasks" becomes `add-field` with the type the name implies, optional so records that already exist stay valid; "every shift needs a volunteer" becomes a rule over the shift. A model upgrades it through the same one-function `Completion` seam, with the studio's own floor under it, so a fact the declaration holds is never replaced by a fluent guess about the same fact.
  
  This is also where the `drawFigure` gap lands, recorded honestly when figures shipped: the drawing carried the house style and judged its own answer, and was reachable from code and from `graview figure` and from nowhere a person sits. "Draw a figure for volunteer" now reaches it from the studio, and a figure is finally something a declaration can carry through the studio at all — modelled on the kind, read in, written back, and written into the schema file. Before this, opening the studio on a drawn app and applying would have rubbed every drawing out.
  
  `figureFaults` — the checker's own judgement — now closes the drawing vocabulary: a figure is line art made of drawing elements and drawing attributes, and a `<script>`, an `onload` or a remote `href` is a fault with a name rather than something that passes a style check and is inserted as markup. That is what makes a model's drawing safe to show somebody before they keep it.
- 22e0668: An edge reads from the end you are standing on. The caption over a neighbour in the scene took the declaring side's words in both directions, so a gardener's plot was captioned "who looks after it" as though the plot looked after her; it now takes the declaration's `inverse` along an incoming edge, as the connections panel and the pages already did. `graview check` warns `edge-without-inverse` for any edge declared with one reading or none, naming what the far end would be captioned with. The scaffold, the seedbed and the launcher declare both readings.
- 9b3a623: An embed is a region with a name. `label` named every landmark inside an embed and left its root a plain div, so on a host page the strip, the seats and the picture sat outside any landmark: a reader moving by landmark could not reach the app, and two embeds were indistinguishable at the top. The root is a `<section>` named by `label` now — or by the app's own name when the page does not say — and the scaffolded host page has the `<main>` the embed deliberately does not bring.
- 5a00a1f: An id minted from a name folds its accents instead of dropping the letters: "Zoë Lamarré" is `artist:zoe-lamarre`, not `artist:zo-lamarr`, and a name in a script with no Latin letters keeps them rather than becoming `item`. Ids already in a graph are untouched; only new ones are minted this way.
- 887d768: What a kind can be sorted, filtered and grouped by is derived from its declaration. `arrangeable(schema, kind)` offers the sorts (the label, every scalar field, every edge by its far end's label), the filters (boolean and choice fields by value, date fields by before/after/on, every edge by a node, by anything or by nothing, and `is` for the lifecycle and the standing) and the groups (boolean and choice fields, date fields by day, week or month, every edge by its far end), each in the declaration's own words — `display.labels`, an edge's `description` from the declaring end and its `inverse` from the other — and never a field `display.hide` hides. `fieldRoles.order` names a kind's natural sort. `arrange(nodes, arrangement, context)` filters as a conjunction, sorts stably with the unsaid last, and groups with the empty group last, choices in option order and dates by bucket.
  
  One grammar carries an arrangement wherever it goes: `sort=due:desc`, `filter=done:false,holds:today,is:past`, `group=due:month` — `parseArrangement` and `formatArrangement` round-trip it, and `admitArrangement` keeps what the kind offers and names what a stale link asked for that it does not. A lens carries the three words in the stop's fragment as `in.sort`, `in.filter`, `in.group`; a page carries them in its search; `arrangeAllows` reads a lens's `arrange: false | { sort?, filter?, group? }`. Nothing here is React: the surfaces come next.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- b1fbc32: Default content moves without a wipe. The step DSL gains five content steps beside the schema ones — `put-node`, `patch-node`, `drop-node`, `put-edge`, `drop-edge` — each judged against the stored graph at the moment it runs, so a record already there is not put twice and a patch that changes nothing says nothing. `primitivesForSteps` now runs steps IN SEQUENCE, each seeing the graph as the ones before it leave it, which is what the studio already assumed when it renamed a kind and then spoke of its fields by the new name, and what a content run needs to put a record and tie it in one breath.
  
  `seedSteps(seed, live)` diffs a bootstrap seed against a live snapshot into those steps — missing records put, fields the seed sets patched, missing ties made, and nothing dropped unless `prune` is asked for by name — and `applySteps(store, steps)` lands them as ONE operation authored `system · ship:sync-seed`, logged with its inverse, so undo is the ordinary undo. `graview sync-seed <entry> --seed <file> [--data|--sqlite] [--apply] [--prune] [--json]` is the command: it prints the steps as sentences and writes nothing until `--apply`. The seed is read once, into an empty store, and the README now says so; `fresh` is a demo's way back to the example, not the redesign tool.
  
  `graview serve` and `sync-seed` parse their store flags through one `backendFrom`, and `loadApp` is exported from `@graview/core/cli` so the packages that load an entry load it the same way.
- d907771: Find says which is which. A song and an album both called "Gone Digital" were two rows that read "Gone Digital" in the Find strip, the album first and nothing in either row saying which was the song: hits were told apart only within their own kind, on the grounds that the strip heads each kind — but a row is read alone, by the pointer that lands on it and by the screen reader that speaks it. Same-named hits of different kinds now say their noun ("Gone Digital · song", "· album"), in the declaration's own word (`nounOf`: a staff member, never "staff"), and same-named hits of one kind still say the fact that differs. `search` takes `inKind`, the kind the person is in, and its records lead the others of the same strength; the scene passes the district or record it is focused on, so "Gone Digital" typed inside the songs is the song.
- 7a61e87: A condition that names a retired state asks for the past. `status:demo`, where demos are behind the horizon, found nothing in the Find box and listed nothing on the list page, while telling the reader to add `is:any`. `asksForThePast(definition, conditions)` says when a condition names one of the lifecycle's retired values, and both `search` and the list page widen that kind's horizon for it.
- a5d842b: One edge name is one relation. `graview check` refuses `edge-name-shared` when the same edge name is declared on two kinds in different words — `by` on a song ("their songs") and on an album ("their releases") put an artist's songs and releases together under whichever came first, on the card, the record and the captions. Declaring a name from several kinds in the same words stays legal. `edgeAllowed` now judges an edge against the declaring kind's own targets rather than the first declaration's, and `schema.edge(name).to` is every declaration's targets. The studio's grant edge is `allows-on` (it shared `over` with the rule, so a kind's page listed its grants as rules), and the `graview-node-kind` skill names the check.
- 2b2df36: One matcher finds a thing anywhere in the graph. `search(store, query, { principal, from, subject, places, today, limit })` in `@graview/core` returns ranked hits — a record, a kind, a place, an act or a rule — each with a `why` naming the field that matched and the words around the match. Matching is on folded text (case, accents and punctuation aside), every word the start of a word, never fuzzy; `key:value` tokens are the arrangement's conditions, applied to the kinds that offer them, with `kind:` to narrow and `is:any` to include past records. Records rank by how the words matched (exact name, prefix, whole words, parts, a field), then near the subject, current before past, recently touched, flagged, alphabetical. What a seat may not see is not a hit, and an act is a hit only on a highlighted record. The arrangement's `q` uses the same matcher, so a list's `?q=` and the Find box never disagree. The agent's runtime gains `search_graph`, first among the read tools, with the records it named counted as reads; the MCP instructions say to reach for it before `get_graph`; `graview describe` and `llms.txt` say what each kind is searched by.
- a9381af: One control row arranges every surface. `ArrangeBar` in `@graview/primitives` draws Sort by (with a direction), Group by (with a bucket for a date), the conditions as chips with one grouped select to add another, and the words a person types — all from `arrangeable()`, so it offers only what the kind's declaration offers, in the declaration's words; a surface hands the current arrangement in and takes the next one back, and declines a part with `allow`. `arrangementOf(view)` and `withArrangement(view, next)` carry it in a stop as `in.sort`, `in.filter`, `in.group` and `in.q`. The arrangement grammar gains `q`: words a node's label or any scalar field must contain, the same matcher a search would use (`matches`).
  
  The pages list page arranges through the shared module under the shared keys — `?sort=due:desc`, `?filter=done:false,holds:today`, `?group=due:month`, `?q=tape` — and keeps every link it used to write: `?by=<edge>` groups, `?<edge>=<id>` and `?with=<edge>` narrow, `?past=1` widens the horizon. A stale link that asks for something the kind cannot be arranged by is told so and shown the rest. The kind's default picture in the scene draws the same row at full fidelity and groups its members when asked, with the choice in the fragment so an arranged district is a link and Back restores it.
- 8976510: One switch, four rungs — and a rung that says what it cannot do. `IntelligenceConfig.source` is now `"graph" | "local" | "decision" | "remote"`: graph only, onboard AI, Jev, LLM — one setting, live, saved in the person's own browser. The ladder has two axes and `RUNGS` says so: each rung declares the capabilities it serves (`prose`, `decide`, `propose`); a surface asks `rungFor(config, capability)` for a capability and never for a provider; and a capability the chosen rung cannot serve falls down to the graph, which is keyless and always there. `capabilitiesOf(kind)` in `@graview/core` is the same table for declared providers, and `graview describe` reads the ladder out — which rungs the app declares and what each can do, and what the graph answers instead on a rung that cannot.
  
  On the decision rung the chat seat is answered by the graph and SAYS so in the answer itself — "(Jev decides rather than talks — the graph is answering here.)" — as part of `ChatReply.say`, not chrome painted by the panel, so every surface the seat speaks from carries the sentence unchanged. A turn that started on one rung while the person moved to another says which rung answered it rather than finishing silently (`configuredResponder`'s `current` hook, wired in the chat panel and the studio's). `decideFor(config)` is the decision behind a rung for a surface that wants one: the provider exactly on the decision rung (by the person's key, or through the dev server's door), a model behind the full parse-and-refuse layer (`completionDecide`) on a model rung, and nothing on the graph rung — where `graphDecide(store)` answers what the store's own rules already decided and names what it cannot. The picker offers the fourth rung with an optional key; with none, the app's decision door is used.
- d5227b5: `store.permits` answers as `apply` would for a declared agent: what its `may` excludes is refused, in the same words. The chat asked `permits` as the person and was told yes, offered a repair as the starter seat that may only add, and the press was refused; it now asks as the seat that applies, and such a proposal is withheld with the reason beside it.
- 0c320d9: Persistence you can open. `graview serve <entry>` hosts an app's store behind HTTP with the op log as the wire: a client sends CALLS — never primitives — and the server applies them through an ordinary `Store` under the principal the request carries, so the same policy refuses the same act there that refuses it in a browser, with the same sentence. Data is a directory of `snapshot.json`, a `log.jsonl` a person can grep, and a `meta.json` holding the stored version; `--sqlite <file>` swaps the adapter and changes nothing else. Migrations run on the server, once, against the stored graph. `/graview/health` says which adapter is keeping the data and where.
  
  `openRemote` is the other end: a real `Store` in the browser whose calls go to the server and whose graph receives everybody else's ops on a poll. A call applies optimistically and a refusal takes it back — leaving a hopeful change on screen would mean showing a graph the server does not have.
  
  `Store.receive(ops)` is the new core primitive underneath it: operations somebody else already judged and compiled, landing with their own id, author and intent, renumbered into this log's order and announced to subscribers exactly like a local change. Three things had to be right for two writers to converge rather than diverge — a foreign op must not be re-judged (it would ask about the wrong principal), must not be re-minted (two stores both start at `op1`, so a client silently dropped the server's op as one it already had), and must not carry the sender's sequence into a log that is contiguous by construction.
  
  Rota runs this way with `?server=…`; the launcher's capability list now answers "server-side persistence" from the declaration rather than by assertion.
- 0c0fa22: "Remove this field" survives being written down. A patch said it by carrying the key with the value `undefined`, which JSON drops — so every persisted op that cleared a field came back with an empty half and the inverse it promised did nothing at all. Undoing a migration that added a field, after a reload, reported success and changed nothing. `UNSET` is that instruction as a value now, normalised into every operation on its way into the log, and both appliers read it.
- 8a2fdf2: The code a declaration change leaves wrong is rewritten in the studio before anything is written. The studio door reads the checkout's acts and rules (`GET …/source`, `declaredCode`), replaces, adds and removes them in place (`replace-act`, `add-rule`, …), and compiles the app with the edit laid over its files (`typecheckWith`) before a byte lands, refusing with the compiler's own words. `sourceChanges` names each act or rule whose declaration changed, `codeTouched` each one whose code mentions what moved or went, and Apply puts every one of them in front of the person — editable, with "Ask the seat to rewrite it" (`rewriteCode`, the configured model) and "It still holds as written" — writing only once each is settled.
- fb6eb5d: The article agrees with the kind. A scaffolded project whose first kind began with a vowel opened on "Add a item …", and said it again on the card, the list page, the form and the act's own description; the checker and the actions strip wrote the same sentence themselves. `article` and `withArticle` derive it from the word instead — including the two families domain vocabulary is full of, "a user" and "an hour" — and the scaffolder, `graview check` and the strip all read from that one place.
- 5343a1d: The relation band draws what a person can read. Its budget is the cards a row holds at a readable width times the rows it holds at a chip's height; below it nothing changes. Above it each relation (a run of one edge kind in one direction) stands whole if it is small, groups by what its members' own declaration offers — another edge's far end, a choice, a date by decade, year or month, never the relation's own edge, about five groups where it can — or keeps its most relevant members (the selection, the search's hits, the flagged, the recently written, the most connected) in its own order beside one "+N more" door. Groups are aggregates named in the graph's words with true counts, drawn as a band card with their first names, heard as "Single, 80 albums", and opened in place by the `expanded` stop; the door opens the kind's picture filtered by the relation. `bandOf`, `chooseGrouping`, `shares` and `isBandAggregate` are exported from `@graview/layout`, `LayoutOptions.relevance` carries what stands, and the arrangement's dates group by `year` and `decade` too. Focusing an artist with 1,100 songs draws 36 hosts and 50 line strands instead of 1,259 and 2,214.
- ddf1ea9: The bound `defineInvariant` takes `judgesPast`. The engine has always honoured it and the graview-invariant skill tells an author to write it, but the declaration `bindSchema` hands out — the one the scaffold and every skill use — refused the property at typecheck, so a rule about a sold vehicle or a closed deal could not be written the way the skill says without a cast.
- 6e0fbb7: A form opened for an act offered from the far end of a tie submits under the words its heading uses. `DerivedForm` takes `label`, and the derived record page, the places page and the record page `graview create` writes hand it the affordance's label — a song's page headed "Place it in an era" had a button saying "Put it in the era", the era's side of the act.
- 5aa8776: The checker is a sequence of families. `checkApp` builds one context — the app, its kinds, its acts and rules, and the way a finding is said — and asks each family in `cli/check/` in the order it always asked them, so a report reads exactly as it did: routes, lenses, the way in, providers, the city, intelligence, settings, migrations, brand, modules, relations, fields, policy. Two comments that had drifted from their checks went back to them, and `bounded`'s comment now says what it does.
- 76e50a5: The checker, `describe` and the docs know about arrangement. A lens declaration may say `arrangedBy` in the arrangement grammar; `graview check` warns `order-role-unknown` when `fieldRoles.order` names a field the kind lacks and notes `lens-arrangement-unknown` when a lens opens arranged by something none of its bound kinds offers. `graview describe` gains "What can be arranged": every kind's sorts, filters and groups in the declaration's words, and how each lens opens. `llms.txt` says the grammar and, per kind, what it is arranged by, so an agent that cannot see the row can still write the stop. The `graview-lens` skill gains the step — take an arrangement, and say what your picture has no place for — and `graview-pages` says the shared words the list page now speaks.
- 3e719c8: A kind is a neighbourhood: the city is a map drawn from the declaration, and everything in it has an address. `cityMap(schema, hints)` in `@graview/core` is pure and deterministic: it walks the kinds in the order a blank installation fills them (`beginning(app).order`, or sorted ids), puts the first at the origin and each next kind on the free block beside the placed kind it shares the most declared edges with, spiralling outward — in LATTICE CELLS, never pixels. Same declaration, same map; adding a kind leaves every existing plot where it was; population changes a plot's `side` and never its corner. A kind may declare `plot: { col, row }` and is put exactly there; `graview check` reports two on one block as `plot-overlap`. `roadsOf` names the roads between placed kinds, and `graview describe` reads the city out — each kind's plot and its roads — the first thing outside a browser that can say what is drawn.
  
  At altitude `layout()` places the districts by the map on the 2:1 lattice under ONE uniform scale and translate (`placeCity`), so the city has the same shape at 1280 and at 390 wide; nearer rows are drawn nearer with the depth number every plane style already reads; the collision shrink stays as a safety net, the opened listing gives up its room before the city grows, and the city slides aside for the live view standing in the middle rather than laying a district under it. `LayoutNode.plot` carries the address and survives `interpolate.mix` mid-tween; `Layout.city` says which lattice the picture is on, and the ground draws its diamonds at that cell, anchored where cell (0,0) meets the canvas and panning with it. Roads: a connector between two districts runs along the lattice's diagonals (`latticePoints`). Buildings: an opened district lays its members out as a `side`-wide grid inside its plot, each still a pick target, capped at `side × side` with "+n". The camera is bounded by the map's extent (`cameraLimit`) rather than a canvas fraction, so a city wider than a phone is reached by panning and nothing is dropped off the edge.
  
  `useWhereIs()` answers where a node, a kind card, a group or a Place slug is drawn from the CURRENT frame — riding the tween and the pan, measured from the DOM when there is one — with a member not drawn itself answering as its nearest drawn container, the connectors' own rule. `useScenePointer()` is the pointer over the scene in scene coordinates, and a quiet scene runs no listener: the store counts its subscribers and the scene attaches on the first, detaches on the last.
- 8d43e33: The embed has a skill of its own, `graview-embed`: open where the stop says, pick the face for the page (`picture` for one lens alone), name every embed so two on a page are two regions, let the host decide the scheme and fonts, offer seats when the page is about the policy, mount many as the reader nears them, and presence only when handed a channel — with the seedbed site, the rota host page and the scaffold as worked examples. `graview-pages` is the pages face alone now and points there, which leaves it room under its length budget instead of twenty characters.
- 53ad439: The hosted-store contract is written down. `WIRE`, exported from `@graview/ship`, names every route `serveStore` answers with its method and one sentence, and a test walks it; `SEAT_HEADERS` names the headers a request carries its seat in. `openRemote` takes `headers` — sent with every request, never read by the framework, the seam where a host's own credential goes — and exposes `settled()`, which resolves once every call sent so far has been answered; the server's CORS allows `authorization`. And a server's op for a change this client already applied provisionally is now RECORDED rather than re-applied (`store.receive(ops, { applied: true })`): an optimistic add followed by the server's own op used to throw a duplicate-node error out of the wire and be reported as a refusal.
  
  The README carries the concern table — op log, snapshot and migrate on open, the wire, a principal on every apply, the seed at first install, content steps and the agent's door in the framework; auth, tenancy, quotas and fleet upgrades in a host — so a third party stands up their own host without forking anything, and Graview Cloud is the polished multi-tenant host of the same API. `graview docs` now writes an "Attaching an agent" section into llms.txt and an "Evolving a live store" checklist into agents.md; the `graview-agent-seat`, `graview-ship`, `graview-node-kind` and `graview-permissions` skills say the same; and a project from `graview create` has `serve` and `mcp` scripts and ignores `data/`.
- e0d5026: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- 90a3344: `kit-contrast-below-aa` says which ground a line fails against — the scene's ground or the deeper one under a district — and in which scheme, instead of printing "against the ground" twice with two numbers.
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
- 8894627: Every package's page on npm links to its own docs on graview.dev and to the issue tracker, and carries keywords a search will find it by.
- fc7103b: The pages face lands on a gallery. The derived home read as a readme: the brand's name repeated under the masthead, a sentence of counts, the relations in full, a section per kind with its description and four members — and the app's own pictures as two 288-pixel cards a third of the way down a 760-pixel column, the smallest thing on the page. Now the standing is the headline ("2 gardeners, 3 plots and 1 planting.", or "Nothing here yet." and which act begins it) and the pictures come next, large and live: every titled lens as a card the width of half a desk or a whole phone, drawn by the lens itself at a scale measured from the card, inert, captioned with its name and how much it is over. The kinds follow as one row of counts, the relations as one line that opens `/map`, and Recently stays short at the foot.
  
  Every kind is a picture by default. `registerDefaultViews` titles nothing, so a new app had no places and no pictures on its pages at all. A live kind with no titled lens now gets a card of its own — a group view the app wrote is drawn as it is; the framework's own is replaced by a contact sheet of the members at summary fidelity, the same card the scene stands in the district — titled by its plural and opening its list. Titling a lens replaces the kind's card rather than adding to it. A picture with nothing in it says so and names the act that would begin it, rather than showing a blank frame. Given no view registry the face still lands on the gallery, each kind a card of its members' names.
  
  The shell is one row — the pictures (home), the kinds, Map, Problems — and scrolls sideways on a phone rather than wrapping to three rows; the shell and the gallery take a 1160px column while the pages that are read keep their 760. A picture's page carries its sibling pictures as a strip, and `/places` is the same gallery at its own address. `Gallery`, `GalleryCard` and `galleryOf` are exported for a design that wants the cards on a page of its own.
  
  `graview create` hands `PagesApp` the app's views and settings in the `main.tsx` it writes, so a new project's pages face has its pictures, its map and its assistant without anyone editing the file. The `graview-pages` skill says what now comes for free; `verify-pages` measures the gallery on the framework's default face — two across at a desk, one on a phone, every frame with something drawn in it, the nav one row — rather than asserting it.
  
  A new page opens at its top. The router kept the document where it was, so a card pressed at the foot of the gallery opened the picture's page already scrolled to its own foot; the readme-shaped home was short enough to hide it. The face now resets on every new address — not on Back, which the browser restores itself, and not on a change of search alone, which is the page you are on — scrolling whatever holds it: the window, or the nearest ancestor that scrolls when the face is inside an embed's frame.
- 9767a5e: The scene has a Find box, and the picture is the result list. `q` is a view state field beside the focus and `within`, carried as `#q=`; typing replaces the address rather than pushing one entry per letter (so does a row's own `in.q`), and it outlives a change of focus. The provider searches once per change and `useImplicated` lights the hits in every picture through the emphasis views already read — words that find nothing dim it all (`NOTHING_FOUND`); `useReached` keeps what the selection alone reaches, and `useFound` gives the result. At altitude a district with hits is lit and says "3 match", the rest recede, and pressing the count or the district descends with `in.q` set, so the district opens narrowed and Back returns to the lit city; Escape clears the words before anything else. The `FindBox` sits in the Shell's bar, reached by `/` or ⌘K: a combobox over a listbox grouped by kind with each hit's why, a place as "Go to …", the acts on a highlighted record under it, a live count, and on a phone a full-width sheet under a box on its own row. `search()` takes `kinds` to look only where the scene draws.
- e9e495f: The decision provider itself. `jevDecide({ apiKey | baseUrl, … })` in `@graview/tools` is one `Decide`: one state and a MAP of typed questions in, typed answers under the same keys out — so a node's whole unset half is one request rather than one per field. 429 and 529 are retried with backoff (injectable); 401 is thrown as the SEAT's problem and 422 as OURS, each said in those words, because blaming the model for a bug in the derivation would send somebody looking in the wrong place. An answer that is not typed, or missing, is refused rather than guessed. The key is read from the environment by `jevKeyFromEnvironment()` — `TYPESAFE_API_KEY`, then `JEV_API_KEY` — travels in one header, and appears in no error. Usage is metered per call and in total (`onUsage`), and `jevCostUsd` prices input tokens at the published rate; output is unmetered.
  
  A browser must not hold a service key, so `@graview/ship/dev` gains `decisionBridge()`: a dev-server door at `DECISION_BRIDGE_PATH` (`/__graview/decide`) that holds the key from the server's own environment, forwards a page's state and questions, and hands the provider's own status back so the page-side provider tells failures apart the same way. Same-origin only; the key is in no response. The contract (`DecisionBridgeStatus`, `DecisionBridgeAsk`, `DecisionBridgeAnswer`) lives in `@graview/core` beside the local door's.
- 636a00d: The questions a decision provider is asked are derived from the declaration, never authored. `questionsForKind(store, kind)` turns each settable field with a typed answer into one question in the wire shape a decision provider takes: a `z.enum` is a Choice whose criteria are its options and whose instruction is the field's own description; a `z.boolean` is a truth; a bounded integer is a Score over its levels; prose asks nothing. Each field question names the act that writes the field and the argument the answer fills. `questionsForMutation(store, act, given)` asks the arguments `given` has not settled — a `nodeRef` is a Choice over the live nodes of that kind, labelled by `labelOf`, the id as the option name. `questionsForInvariant(store, rule, violation?)` is a truth whose "yes" is the rule in its own words and, where the closed set has more than one member, a follow-on Choice over the repairs — the violation's ready repairs when the store has judged, the rule's declared repairs when it has not — each option naming the call it means. `nodeState(store, id)` is the state a question is asked over: the node as a card shows it, joined things by label. `allQuestions(store)` is the whole derived surface.
  
  Also: a described node reference is still a node reference. `nodeRef(["concern"]).describe("…")` clones the schema, and the registry was keyed on the instance, so the natural way to write the question lost the kind — no picker, no candidates. The registry now keys on the def as well, which the clone shares.
- 0d1fd39: The record page `graview create` writes reads the kind's lifecycle instead of casting the node to its own status words. It said "Still open." of every record whose states had been renamed — a released song — and the cast kept the typecheck quiet. It now says "Current." or "In the past", from `isCurrent`, and its heading is the record's label from `recordFacts`.
- 098c784: The scaffolder is four families of templates beside the function that asks for them: what a project is called (`names`), the project around the app (`project`), the declaration it starts with (`domain`) and the faces it has (`ui`). Split by the parser's own statements, not by text, since templates are full of code; what `graview create` writes is byte-for-byte what it wrote before.
- 3506c69: A project `graview create` writes keeps its seed in version control. Its `.gitignore` said `data/` for the store `graview serve --data data` writes, which also matched `src/data/` — so every project's seed, the graph it opens on, was quietly never committed. It now ignores `data/` wherever the app sits and keeps `**/src/data/`, in the single-app layout and the workspace one alike.
- daccd55: The studio is a place on the bar. `<StudioPlace app={...} />` opens the running app's own declaration — kinds, fields, edges, acts, rules, roles and grants as districts, "What the checker says" as a place, the ordinary acts to change them, the studio's own history and undo, and an agent seat that proposes a repair for a rule that names none. Applying runs `graview check`, refuses on errors naming them, and otherwise offers the files `graview create` writes as downloads. Offered to the seat that administers where an app declares something administered, and to whoever is here where it does not — so a scaffolded project has it on day one. `Shell` takes it as a slot (the studio already depends on the shell's primitives); the embed strip takes it boxed, so a studio cannot escape onto somebody else's page.
  
  `ArgShape` gains `{ type: "boolean" }`. Without it "Add a field", whose `required` is a plain boolean, was derived NOWHERE — the studio's central act, in the studio, unreachable because nothing could ask one question. The strip asks it as two buttons rather than a text field somebody has to know to type "true" into.
  
  And what the studio does not model, it no longer destroys: a kind's `display.labels`, `display.hide`, `fixed` and `fieldRoles` are carried from the checkout through both the declaration and the written schema, narrowed to the fields that still exist. A `display.format` is a function and cannot be written; the file says so where it finds one, and `WrittenFile.kept` names it, instead of losing it silently.
- be9fb19: The studio writes a declaration change into the checkout, in place. `studioDoor()` from `@graview/ship/dev` is a dev-server door (contract `STUDIO_DOOR_PATH`, `DeclarationChange` in `@graview/core`) that takes the CHANGE — a kind, field or edge added, changed, removed or moved, a kind's description, plural or figure — and makes it inside the checkout's own `defineNode` calls with `editDeclaration`, leaving every comment, function and body it does not touch exactly where it was; all or nothing, and only ever the files in its own `src/domain`. `studio.sourceChanges()` says the change that way, and what it cannot say yet (acts, rules, policy, a migration) as reasons; Apply writes through the door when it answers and hands over the files, with the reasons, when it does not. `graview create` projects open the door in development. `@graview/ship`'s doors share `door.ts`: who may knock, how much they may send, the plugin's shape.
- ce13ec8: `Begin` takes a `frame` around its own door and nothing else. The scaffolded Home wrapped `Begin` in a `PageMain` with the derived home as its `whenFull`, so once the graph had something in it the derived home — a whole page, with its own landmark — rendered inside a second `main`, and its gallery inside a 760-pixel reading column, one card wide at a desk. The frame is applied to the door alone; what comes when the graph is full is returned exactly as it was given. `graview create` writes the Home that way now.
- 95196d7: Two records of one name are told apart wherever a person picks one. `tellApart(nodes, definitionOf)` gives each namesake the first fact that differs — "Blue Hour · single", "Blue Hour · album" — and the pages form's pickers, the strip's ask, the Find strip, the search page (through a node hit's new `apart`) and an arrangement's group headings all say it. A single and its album were two identical rows.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 5856676: What creating a real app beside the framework taught. `graview create --plural Shifts` is accepted — a person types the word, the generator wants the slug — and the generated rule test judges one rule at a time, so the second rule you declare does not fail it. A new `graview-pages` skill covers the routed face from the derived pages to a product design over every surface, and the embed; `graview-new-app` says what to make yours next, in order, with the chapter that shows each step.
- 6e8a02c: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- 5b401bb: What the review of search found. A boolean field is a state, asked for as a condition (`done:false`), not a word: it read as "No", so "n" found every open task in the Find box, a list's `?q=` and the chat — `searchableFields`, `describe` and `llms.txt` no longer list booleans. The picture lights every match from the result's new `matched` list rather than the strip's capped hits. A list's `q` made only of tokens nothing offers (a pasted `https://…`) finds nothing, as the Find box does, and a lone `is:flagged`, `is:clear` or `is:past` narrows in both. `actsOn(store, id, words)` lists a record's acts without a search of the graph; `search()` takes `touched`, and the scene works out what is flagged and touched once per graph change, not per keystroke; a list parses its words once rather than once per row. A lit district's count, Enter on a kind hit and a double-click are one transition — `withJackIn(…, { carry })` — which comes down to the ground, close and narrowed. The row's words (`in.q`) no longer follow you to the next focus, and `withoutSearch` clears the search with the words it carried. A pick in the pages face's Ask drawer goes to the record's page (`onPick` on `ChatPanel` and `Companion`), and the list page reuses the affordances it already has for search-to-create.
- 968e1d1: The installation, in the app people open first. Things declares `declareInstallation({ roles: ["keeper", "member"], admin: "keeper" })` with a policy, two seeded people and a pending invitation, so the platform story is demonstrated where a reader will look for it rather than only in a seedbed chapter. `GraviewProvider` takes `seats` and `onSeat` and holds who is at the keyboard, and the bar draws the new `<Seats>` primitive for them — sitting down re-derives every surface from one principal: the acts offered and the ones withheld with the policy's own sentence, which kinds are drawn at all, whether "Show the installation" is there, what the routed face lists, and the agent's tools. `Places` no longer draws a pill over a kind the seat cannot see, which was a door to a district that was not there.
  
  `ArgShape` gains `{ type: "several", of }` for an argument that takes a list. Without it `z.array(z.enum([...]))` described itself as `unknown`, so "Invite somebody as coordinator and gardener" was unaskable and therefore derived NOWHERE — in every installation the framework ships. An array of something undescribable stays undescribable, so an unaskable act does not start looking askable. The strip's ask answers such an argument by toggling choices and settling separately; the routed face's list control already handled it.
- 59cef8c: Who is where. Other people stand on your map at the plot their stop focuses, in the audience row of the showing they are watching, with their robots beside them captioned as theirs and the thing they point at outlined in their hue — placed by each viewer's own `whereIs` from a presence payload that is never a pixel and never enters the op log. `PresenceChannel` has two implementations in ship: a BroadcastChannel between tabs of one origin, beside the browser adapter, and two routes on the served store folded into the poll the remote store already makes. A per-tab session fills `Author.session` on a tab's ops and its presence key alike. Clicking a figure follows that person until you move yourself or press Escape; sharing is a reader setting in the profile pane; an embed broadcasts nothing unless handed a channel. `openRemote` now carries `applyAll` and `undo` to the wire.

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
- e38fe86: The generic full page is a document rather than a card stranded on a viewport:
  a real header, a centred column, a heading that is the whole thing rather than
  a truncated copy of the body, field names in words, and no value repeated
  because the heading already said it. The name is now the rename control.
- 5cd68d6: A relation you can make but never unmake is now a finding: `graview check`
  warns `edge-without-severer` for any edge kind some mutation declares in
  `connects` while none declares it in `severs`, naming the connecting acts and
  both ways out. An edge that is genuinely a record — rationale, history —
  declares `appendOnly: true` on its edge declaration, which suppresses the
  warning and documents the intent in the same stroke.
- 95cceb3: The menu scales. Past the fold a filter-as-you-type field appears in the
  inspector — it narrows the same derived list by label and why, Enter runs a
  sole survivor, Escape clears. `defineMutation` accepts `pinned: true` (the
  app naming its own act), a person can pin any offered action from the menu
  itself (kept per browser beside the intelligence config, outranking the
  app's), and a deterministic recency/frequency boost read off the op log
  ranks what a workspace actually uses ahead of what it never touches —
  decaying so the menu tracks the season. The bands stay inviolate: repairs
  first, destructive last; pins and usage only ever shuffle inside them.
- 094f3cc: `readableFields` is the one answer to "which of a node's fields does a person
  see, and how does each one read" — the record on a page and the summary on a
  card had answered it separately and diverged. And each lens's `View` is a real
  component rather than a method calling hooks behind a lint disable.
- 090ab39: Effectivity and checkpoints as one construct the framework owns. A household's
  agreements that come into force and lapse, and a team picked as of a date, are
  the same question — so `effectivity`, `isEffectiveOn`, `checkpoint` and
  `checkpointOn` live in core rather than being invented once per domain.
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
- f24ef6e: Two-way sync on top of the op log: a declarative resource mapping, an inbound
  change that arrives as an ordinary op with a `system` author, echo suppression
  from the version the remote produced for our own write, conflicts surfaced as
  violations with repairs rather than resolved silently, and offline degrading to
  local-only. A Google Calendar transport is included.
