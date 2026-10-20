# graview-view-specs

`graview-view-specs` is one of Graview's 26 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Say how a Graview kind's card, row and page read, as data — blocks from a closed set bound by {field} templates and rule-language conditions, headlines, figures and lists of related records — and the values worked out from others (computed) that they show, verified by graview check and the page rather than by assuming the spec drew.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## A kind's views, as data

A kind declared is drawn already: a card, a row, a page. When that default is wrong but a component would be too much, say the card, the row and the page as data. Nothing in a spec runs, so a chat can write one as safely as a person, and every face draws the same words from it. The kind itself — fields, edges, label, roles — is `graview-node-kind`.

### Do this

1. **Say the card, the row and the page** in `defineApp({ viewSpecs })` — blocks from a closed set, bound by `{field}` templates and rule-language conditions:

```ts viewSpecs: { fixture: { card: [{ title: "{name}" }, { badge: "{status}", tone: { expr: "if(status == 'fitted', 'good', 'neutral')" } }, { field: "cost", as: "money" }], row: [{ title: "{name}" }, { badge: "{status}" }], page: [{ progress: { value: "done", max: "total" }, label: "Fitted" }], } } ```

In a document the same is the top-level `views.<kind>`, and the edit is `{ "op": "set-view", "kind": "fixture", "slot": "card", "blocks": [...] }` (`null` gives the default back).

`card` is drawn beside the focus and on the pages face's gallery, `row` as the one line a member is among many (a focused group, the list page), and `page` above the default record. Tones are `good`, `warn`, `bad`, `neutral` and `accent`, the theme's own. Nothing in a spec runs: no CSS, no markup, and the only link drawn is an http(s) `url` field's own value, or a listed record. The scaffold's `views()` draws them (`registerViewSpecs`); so does the embed, by itself.

1. **Say more with three blocks** (FR-81, FR-82): `{ headline: "{count(out('includes'))} offers" }`; `{ figure: "net", as: "money", label: "{name}, net" }` (`number`, `money`, `percent`; the label is a template; `figure: true` is still the picture); and

```ts { list: "out('includes')", as: "row", sort: { by: "net", direction: "desc" }, limit: 5, group: { by: "type", headings: { pain: "What hurts" } }, empty: "None yet." } ```

— records by a walk or `all('kind')`, each drawn by its own card or row and a link; `direction: "choices"` is a choice's declared order. Lists show only what the seat sees, and nest three deep, then say names. The same blocks write the home (`views.home`) and a blocks place (`graview-shipped-lens`).

1. **Give a block a name a face can claim.** Any block may say `key: "fixtures"` (unsaid, its sort and place: `list.2`): the name a face claims it by (`BlockSlots`, see `graview-pages`), never its words.

1. **Work a value out; never store it.** A value that follows from others is declared once, never kept in step by hand. `computed` names it and says it in the rule language:

```ts computed: { net: { expr: "sum(out('includes'), list * units) * (100 - either(first(all('party') where role == 'client').discount, 0)) / 100", label: "After the discount" }, } ```

Every template, view spec, rule, sum and sort reads `net` like a field (`{ field: "net", as: "money" }`, `sort(all('package'), [standing, net], 'desc')`); no act or edit form offers it, and an act that sets one is refused (`computed-written`). It is worked out over the graph the reader holds, so a seat is served one from what it may see. A glance may name one; a `label` or `describe` only one worked out from the record alone (no graph is in hand). A document's top-level `computed` holds facts of the whole graph, read as `fact('name')`; a kind's is changed with `set-computed`.

1. **Say counts and times in words.** Templates say counts in words: `{n | words}` ("three"), `{n | plural: 'offer'}` ("offers"), `{out('includes') | and}` ("A, B and C"), `{n | words | capital}` ("Three"), `{at | time}` ("10:47 AM"). A field's label, a group's heading and what an empty list says are words, not templates: braces there would be drawn as typed, and `view-braces` warns of them. A `describe` or `label` written in code is not a template either: say the value in code (`momentAsRead(node.startsAt)`), and `describe-template-in-code` warns of `{field}` returned there.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
npx graview check --document app.json   # a document
```

Report **the actual output**, including warnings. What it catches here:

- `view-field`, `view-name`, `view-tone` — a view spec naming a field the kind lacks, or a tone outside the kit; `view-key` — two blocks under one key; `view-template`, `view-expression` — a template or a condition it cannot read; `view-depth` — lists nested past three
- `view-whole-text` — a card or row putting a long `text` field whole in a text block (`graview-lists` says how a card shows its start)
- `view-headline-long` — a headline bound to a long `text`, Markdown or long string field whole, which a focus card drew at display size: say it in a `text` block, or head it with `{call|excerpt: 60}` (a headline past about 90 characters is drawn a step smaller and clamped to four lines)
- `computed-cycle` — values worked out from each other; `computed-clash` — a computed name that is already a field; `computed-cost` — work that grows with the cube of the graph (a warning at the square)

Then look: `graview describe <entry> --place <slug>` says each record's card and row as the page draws them, and the page itself shows the blocks in both schemes. Open it as a seat that may not see a listed record: the list is shorter, and the computed value is worked out without it.

### What the check cannot see

- Whether the card says what a person glancing at it needs. The check holds a spec to the vocabulary; only reading the cards on a full list says whether they are the right few facts.
- Whether a computed value is the RIGHT sum. The check proves it terminates and is affordable; work one record out by hand and compare.

---

Say how a Graview kind's card, row and page read, as data — blocks from a closed set bound by {field} templates and rule-language conditions, headlines, figures and lists of related records — and the values worked out from others (computed) that they show, verified by graview check and the page rather than by assuming the spec drew.

The page: https://graview.dev/docs/skills/graview-view-specs.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
