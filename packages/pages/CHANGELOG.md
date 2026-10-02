# @graview/pages

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
