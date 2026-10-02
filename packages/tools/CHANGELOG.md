# @graview/tools

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
