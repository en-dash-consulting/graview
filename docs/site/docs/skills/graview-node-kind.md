# graview-node-kind

`graview-node-kind` is one of Graview's 19 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Add a node kind to a Graview app — fields, edges, label, plural and field roles — and verify it with graview check rather than claiming it worked.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Add a node kind

A kind is the unit of everything here. Declaring one gets you, without another line: a place in the layout, a card at three fidelities, an aggregate view, an accessibility label, a hue, and inclusion in every agent tool that walks the graph.

### Do this

1. **Find the schema.** It is the file calling `createSchema`. Usually `src/domain/schema.ts`.

1. **Declare the kind.** Zod is the one place a field is described: validation, types and JSON Schema.

```ts export const fixture = defineNode("fixture", { fields: z.object({ // A NAME, and bounded: every surface draws `label`, and `min(1)` // alone permits a paragraph (`graview check`: `label-unbounded`). label: z.string().min(1).max(60), kickOff: z.string(), opponent: z.string(), // Host-kept picture ("image"/"file"); appLinkField() another app // (its records: graview-linked-records); phoneField(), placeField(). crest: imageField().optional(), }), plural: "Fixtures", description: "A match, and the team you intend to put out for it.", edges: { // One edge, two readings: the fixture's page says who is in the // team; the player's page says which fixtures they are picked for. // Kinds sharing an edge name word their own end. "picked-for": { to: ["player"], description: "who is in the team", inverse: "the fixtures they are picked for", }, }, // Its time (`who`: its author): lists, glances, timelines read it. fieldRoles: { when: "kickOff" }, }); ```

**In a document** (`app.json`, `"format": "graview-document"`) it is `kinds.fixture`: `{ "label": "{name}", "fields": { "name": { "type": "string", "required": true } }, "edges": { "pickedFor": { "to": ["player"] } } }`. Kinds are kebab-case (`tool-note`), fields and relations camelCase (`pickedFor`). Every key, lens and block is in `node_modules/@graview/core/dist/document.schema.json` (its `$schema`).

1. **Add it to `createSchema([...])`.** An edge to a kind not in that array fails *typecheck* (`ValidateEdgeTargets`).

1. **Say what a node of it is called.** `label` defaults to a `label` field and then to the id. An id in the interface is a bug you shipped, not a placeholder. And say what ONE of the kind is called where its id does not: `noun: "staff member"` on a kind called `staff`, or every sentence about one reads "Change the staff".

An id is still a name a caller may choose: every act that declares `creates: ["fixture"]` takes an optional `id` argument the framework adds, so a seed being synced or an agent that will refer to the node next call gets exactly the id it asked for, or a refusal by name. Never hardcode a bootstrap id — `"today"`, `"u-nick"` — in a mutation body or an invariant; bind a role, a flag or an edge, so a store seeded differently still works. And every kind gets `remove-<kind>` derived, permitted through the acts that create it.

1. **Give it verbs.** A kind no mutation names as a subject can have nothing done to it, and the strip says so. Unless you meant that, add a mutation whose `subject.kinds` includes it.

1. **Let the fields be changed, or say why not.** A field you could set at creation, you can change: every settable field no mutation writes is covered by a derived act per kind (`edit-<kind>`, "Change the drill"), editable where it is shown. Two declarations shape it. `writes: ["done"]` on a mutation says which fields it sets when its arguments do not (`finish()` writing `done`) — and a mutation whose argument merely shares a field's name should say `writes: []` (a document's act is read, not guessed); the edit refuses an argument it does not take. A number's bounds (`.int().min(1).max(5)`; a document's `min`, `max`, `step`) bound every form, tool and apply. `fixed: { text: "the client's words, as sent" }` on the kind says a field never changes, and why; the sentence is the documentation. The checker warns `field-without-writer` when a field is still out of everyone's reach, and refuses `writes-unknown-field`, `fixed-unknown-field` and a `fixed-but-written` contradiction.

### Worked examples

`apps/todo/src/domain/schema.ts` (`fieldRoles`); `apps/seedbed/src/domain/schema.ts` (a `lifecycle`).

### The declarations that keep paying

- **`creates`** on the mutation that adds this kind (`creates: ["fixture"]`): the empty kind card then offers "Add a fixture" by derivation — the blank graph onboards itself, FROM THE ROOT OF THE CHAIN. An act that also takes a `nodeRef` has no candidates on an empty graph, so it is withheld and the district says what it is waiting for instead: *"Place a feature" cannot begin until there is a zone.*
- **`fromTheOtherEnd`** on the act that makes or breaks the edge. An act declaring `connects` or `severs` is offered from BOTH ends of the tie, and `title` is written from the subject's side: "Name a caretaker", offered on the gardener, reads as naming hers. Say how it reads standing there (`fromTheOtherEnd: "Take on a plot"`) — `graview check` warns `act-without-far-end-reading` and names the end it has no words for.
- **`display.page`** when a record should not read in declared order: `page: { fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due"] }] }` puts those first, the rest under "Details" (a document's `kinds.<kind>.page`; `{ op: "set-page-fields" }`). A string allowed past 500 characters (`.max(5000)`, a `text`) is prose: full width, paragraphs and lists kept, edited in a text area.
- **`lifecycle`** when members expire — `{ field: "status", retired: ["played"] }` or `{ field: "until", retired: "date" }`. Every count then aggregates over the horizon ("4, +12 past") instead of drowning, and `graview check` refuses a lifecycle reading a missing field.
- **A figure**, line art of the THING at the city's three-quarter angle — a person, a plot, a gutter — drawn wherever the kind is. Nine ship; draw the rest: `graview figure ./dist/domain/app.js --kind gutter --from "a gutter along a roof edge"` prints the brief, and `--judge <file>` holds the answer to the rules `graview check` holds a figure to and prints the line to paste. Then look at it at twenty pixels.
- **A declared hue** in the brand (`accents: { fixture: 210 }`) for a chosen color, not a stable hash: every chip dot, roof and focus tag follows.

### How it looks, as data

When the default card is wrong but a component would be too much, say the card, the row and the page in `defineApp({ viewSpecs })` — blocks from a closed set, bound by `{field}` templates and rule-language conditions:

```ts
viewSpecs: { fixture: {
  card: [{ title: "{name}" }, { badge: "{status}", tone: { expr: "if(status == 'fitted', 'good', 'neutral')" } }, { field: "cost", as: "money" }],
  row: [{ title: "{name}" }, { badge: "{status}" }],
  page: [{ progress: { value: "done", max: "total" }, label: "Fitted" }],
} }
```

`card` is drawn beside the focus and on the pages face's gallery, `row` as the one line a member is among many (a focused group, the list page), and `page` above the default record. Tones are `good`, `warn`, `bad`, `neutral` and `accent`, the theme's own. Nothing in a spec runs: no CSS, no markup, and the only link drawn is an http(s) `url` field's own value, or a listed record. The scaffold's `views()` draws them (`registerViewSpecs`); so does the embed.

Three blocks say more (FR-81, FR-82): `{ headline: "{count(out('includes'))} offers" }`; `{ figure: "net", as: "money", label: "{name}, net" }` (`number`, `money`, `percent`; the label is a template; `figure: true` is still the picture); and `{ list: "out('includes')", as: "row", sort: { by: "net", direction: "desc" }, limit: 5, group: { by: "type", headings: { pain: "What hurts" } }, empty: "None yet." }` — records by a walk or `all('kind')`, each drawn by its own card or row and a link; `direction: "choices"` is a choice's declared order. Lists show only what the seat sees, and nest three deep, then say names. Any block may say `key: "fixtures"` (unsaid, its sort and place: `list.2`): the name a face claims it by (`BlockSlots`, see `graview-pages`), never its words.

### Worked out, not stored

A value that follows from others is declared once, never kept in step by hand. `computed` names it and says it in the rule language:

```ts
computed: {
  net: { expr: "sum(out('includes'), list * units) * (100 - either(first(all('party') where role == 'client').discount, 0)) / 100", label: "After the discount" },
}
```

Every template, view spec, rule, sum and sort reads `net` like a field (`{ field: "net", as: "money" }`, `sort(all('package'), [standing, net], 'desc')`); no act or edit form offers it, and an act that sets one is refused. It is worked out over the graph the reader holds, so a seat is served one from what it may see. A glance may name one; a `label` or `describe` only one worked out from the record alone (no graph is in hand). Templates say `{n | words}` ("three"), `{n | plural: 'offer'}` ("offers"), `{out('includes') | and}` ("A, B and C"), `{n | words | capital}` ("Three"), `{at | time}` ("10:47 AM"). The check refuses a cycle (`computed-cycle`), a name that is already a field (`computed-clash`) and work that grows with the cube of the graph (`computed-cost`, a warning at the square). A document's top-level `computed` holds facts of the whole graph, read as `fact('name')`.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
npx graview check --document app.json   # a document
```

Report **the actual output**, including warnings. What it catches here:

- `view-field`, `view-name`, `view-tone` — a view spec naming a field the kind lacks, or a tone outside the kit; `view-key` — two blocks under one key
- `edge-target-undeclared` — an edge to a kind nobody declared
- `edge-without-inverse` — a relation with words for one of its two readings
- `act-without-far-end-reading` — an act offered on an end it has no words for
- `field-role-missing-field`, `field-role-ill-typed` — a role naming no field; a `when` no date, a `who` no name
- `required-invariant-unregistered` — `requiresInvariant` naming no rule
- `mutation-untitled` / `mutation-undescribed` — a verb nobody can read

### What the check cannot see

- Whether the kind is a *kind* at all, or should have been a field on an existing one. The test: does anything point AT it, and does it have a life of its own? A color is a field. A fixture is a kind.
- Whether the default views read well, and the plural in a sentence ("3 Fixtures", never "3 Person"). Run the app and look.

---

Add a node kind to a Graview app — fields, edges, label, plural and field roles — and verify it with graview check rather than claiming it worked.

The page: https://graview.dev/docs/skills/graview-node-kind.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
