# Search: finding a thing anywhere in the graph

A design, written 2026-09-28, before anything is built. It follows the
arrangement work (`docs/…`, `arrangeable`/`arrange` in core) and reuses its
grammar; nothing here proposes a second way to narrow a list.

## What search is, here

In a spatial context graph, "search" is not a results page bolted onto an
app. It is the answer to four questions a person asks a picture of a domain:

1. **Where is the thing called X?** — a record, by its name or a word in it.
2. **Where do I go for X?** — a kind ("tasks"), a named picture ("the
   month"), a page.
3. **What can I do about X?** — an act by its title ("finish"), a rule by
   its name.
4. **Show me everything about X** — the neighbourhood: what X is tied to.

The framework already answers pieces of each in different places with
different code: the list page's `?q=`, the inspector's searcher over acts,
the conversation's "a node named in the message", the arrangement grammar's
`q` word, the city's emphasis (lit / dimmed) for what a selection reaches.
Search is the one seam that answers all four with one matcher, and the
graph itself is the result list.

## Principles

- **The graph is the result list.** Typing lights what matches and dims what
  does not, in whichever picture you are looking at; a strip under the box
  names the hits for the keyboard and the screen reader. There is no modal
  palette floating over a greyed-out app.
- **A search is a stop.** `#q=van` in the scene, `?q=van` on a page. It goes
  in the URL, Back returns to it, a link carries it, a harness can
  photograph it twice.
- **Derived, not configured.** What is searchable comes from the
  declaration: every field `readableFields` would show, the label, the
  plural, act titles, rule names, place titles. `display.hide` is the
  opt-out that already exists; nothing new is declared per kind.
- **One grammar.** Words are words; `key:value` tokens are the arrangement
  grammar's conditions. `van done:false` finds open tasks about the van.
  `kind:task` narrows to a kind. Nothing is invented that a list page does
  not already read.
- **Honest about nothing.** "Nothing here is called “zzz”" says what was
  searched (kinds, past included or not) and offers the way forward: the
  beginnings that could make one, label prefilled.
- **Same seam for the agent.** A `search_graph` read tool on the runtime,
  so an agent finds by name instead of `get_graph` and a scan, and the MCP
  host gets it for free.
- **Policy-honest.** A hit for something the seat may not see
  (`kindsKeptFrom`) is not a hit.

## The matcher (core, headless)

```ts
search(store, query, options?: { principal?, from?: string[] /* the subject */, limit?, today? })
  → { hits: Hit[]; searched: { kinds: string[]; past: boolean }; conditions: Condition[]; words: string }
```

A `Hit` is one of:

| about | what it names | why it is shown |
|---|---|---|
| `node` | a record | label or a field contains the words; `why` names the field and the matching fragment |
| `kind` | a district | the words are its plural or singular |
| `place` | a titled group view | the words are in its title |
| `act` | a mutation | the words are its title; offered with a subject when one node hit is chosen |
| `rule` | an invariant | the words are its name or label |

Matching is on **squeezed text** (case, diacritics and punctuation aside),
the way the conversation already matches a named node. No fuzzy matching in
the first cut: a typo is answered with the empty state and the words shown
back, which is honest and cheap. A semantic rung ("things about moving
house") is a later intelligence provider behind the same seam, never the
default.

Ranking, in order, stable by id:

1. exact label · label prefix · a whole word of the label · a word of a field
2. near the subject: one edge from the selection, the focus or the pointer's settle
3. current before past (`is:any` in the query widens)
4. recently touched in the op log (`usageWeights` already exists)
5. flagged before clear, only as a tiebreak
6. alphabetical

`kind`, `place`, `act` and `rule` hits sit above node hits only when the
words match them exactly or as a prefix; otherwise nodes lead.

Words and conditions are split by the arrangement parser: every
`key:value` token is a condition admitted against the hit's kind (so
`done:false` filters tasks and is ignored for lists, and the strip says so),
the rest is the query. The list page's `q` and the scene's `in.q` are the
same words handed to the same matcher.

## The scene

- **`q` is a view state field** beside `focusId`, `sel`, `overview` and
  `within`: `#q=van`. Not inside `within`, because it applies to the whole
  picture, not to one lens.
- **Emphasis reads the hits.** The implicated set the emphasis machinery
  already lights becomes hits ∪ what the selection reaches; everything else
  dims. At altitude a district with hits raises and its card says the count
  ("Tasks · 3"). Inside a district, the members that match are lit, the
  lens they are drawn in included, since lenses already read `implicated`.
- **Descent carries the words.** Pressing a lit district focuses the kind
  with `in.q=van` set — the arrangement's own word — so the district opens
  already narrowed and the row shows why. Clearing the row clears `in.q`,
  not `q`; Esc clears `q`. Search and arrangement compose instead of
  competing.
- **The Find box lives in the Shell**, top bar, before the places. `/` or
  ⌘K focuses it from anywhere that is not a text field; typing updates `q`
  on every keystroke (an adjustment, not a page, so it does not pile up
  history — the same reading the pages router already gives `?q=`). Enter
  travels to the first hit; ↑↓ move through the strip; Esc clears and
  returns emphasis to the selection.
- **The strip** under the box lists hits grouped by kind, each with the
  kind's mark, its label, its `why` in muted type ("notes: …the van…"),
  and the standing flag where a rule implicates it. A `place` hit reads
  "Go to The month"; a `kind` hit "Tasks · 3 match"; an `act` hit appears
  only once a node hit is highlighted and reads with the act's own title.
  On a phone the strip is a sheet under the box, full width.
- **Accessibility**: the box is a combobox with `aria-controls` on the
  strip, `aria-activedescendant` follows ↑↓, and a live region announces
  "3 tasks, 1 list match" as the count changes.

## The pages face

- **`/search?q=van`** is a route: hits grouped by kind, each a link to its
  record, each kind heading a link to that kind's list with `?q=van`
  carried. The nav carries the same box; typing on a list page narrows that
  list (`?q=` exists today); typing anywhere else goes to `/search`.
- **Every list page already reads `q`.** The change is only that the same
  matcher and the same `why` are used, and that the empty state offers the
  creating acts with the label prefilled.
- **The record page** gains nothing: it is the destination.

## The companion and the agent

- **Conversation fallback.** A message that matches no act and no fact but
  matches hits answers with them: "Three things are called van — Book the
  van (task), …" — each a pick, so the reply is the result strip in prose.
- **`search_graph`** joins the read tools: `{ query, limit? }` → hits with
  `why`, counted in `reads`. The instructions handed to an MCP client say to
  reach for it before `get_graph`. `graview describe` says what is
  searchable per kind: which fields, and that past records need `is:any`.

## Empty states, and the way forward

"Nothing here is called “zzz”." Then, in one line, what was searched:
"Tasks, lists and rules, current ones; add `is:any` for past ones." Then
the beginnings: every creating act the seat may run whose input has a
`label` (or the field `fieldRoles.label` names), offered with the words
prefilled — "Add a task called “zzz”". Search-to-create is the cheapest
good empty state a graph interface can have, and every piece of it is
derived already (`beginning(app)`, `DerivedForm`, the policy).

## What is deliberately not here

- A palette that greys the app out. The picture is the result list.
- A search index service or a worker. Tens of thousands of nodes scan in a
  keystroke; a lowercase index per node is rebuilt on store change if a
  product ever needs it.
- Per-kind search configuration. `display.hide` and `fixed` already say
  what a person should not see or change; searchable is what is readable.
- Fuzzy or semantic matching by default. Later, as an intelligence
  provider with a confidence, behind the same seam, chosen in the panel's
  gear like every other rung.
- Saved searches as a feature. A search is a URL; saving one is bookmarking
  it. If products want named searches, they are stops with titles — the
  same shape as a named place — and can be added then.

## Open questions

1. **`/` or ⌘K**, or both? `/` is the web's reading convention and cheap on
   a phone keyboard; ⌘K is what people who live in editors expect. Both is
   the likely answer, with `/` shown in the box's placeholder.
2. **Should an act be a hit at all**, or only appear once a node is chosen?
   Showing "Finish it" for the words "finish" with no subject is a promise
   the strip cannot keep; showing it once a task is highlighted is honest.
   The design above takes the second reading.
3. **Does `q` dim the rest, or hide it?** Dim keeps the map legible and is
   what emphasis already does; hide is what a list does. The scene dims, a
   list hides — same as today.
4. **Where does search go in the four faces' harnesses?** One claim each:
   the scene lights and descends with `in.q`; the pages route lands cold;
   the companion answers with hits; the agent's `search_graph` counts its
   reads.

## Sequencing (four tasks, when captured)

1. **The matcher in core, and the agent's tool**: `search()`, hit types,
   ranking, words-and-conditions split, `search_graph` on the runtime, the
   `describe`/llms.txt sentences. Headless, tested to properties over the
   awkward declaration.
2. **The scene**: `q` in the view state, emphasis from hits, district
   counts at altitude, descent carrying `in.q`, the Find box and the strip
   in the Shell, keyboard and announcements. Harness claim in
   `verify-navigation` or `verify-menu`.
3. **The pages face and the companion**: `/search`, the nav box, the list
   pages on the shared matcher with `why`, the empty state's beginnings, the
   conversation fallback. Harness claim in `verify-pages`.
4. **Skills and docs**: `graview-pages`, `graview-agent-seat` (reach for
   `search_graph` first), `graview-new-app` (the box comes with the Shell).
