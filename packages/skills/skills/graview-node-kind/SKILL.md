---
name: graview-node-kind
description: Add a node kind to a Graview app — fields, edges, label, plural and field roles — and verify it with graview check rather than claiming it worked.
---

# Add a node kind

A kind is the unit of everything here. Declaring one gets you, without another
line: a place in the layout, a card at three fidelities, an aggregate view, an
accessibility label, a hue, a slot in the kinds plane, and inclusion in every
agent tool that walks the graph.

## Do this

1. **Find the schema.** It is the file calling `createSchema`. Usually
   `src/domain/schema.ts`.

2. **Declare the kind.** Zod is the single source of runtime validation,
   TypeScript types and JSON Schema — there is no second place to describe a
   field.

   ```ts
   export const fixture = defineNode("fixture", {
     fields: z.object({
       label: z.string(),
       kickOff: z.string(),
       opponent: z.string(),
     }),
     plural: "Fixtures",
     description: "A match, and the team you intend to put out for it.",
     edges: {
       // One edge, two readings: the fixture's page says who is in the
       // team; the player's page says which fixtures they are picked for.
       "picked-for": {
         to: ["player"],
         description: "who is in the team",
         inverse: "the fixtures they are picked for",
       },
     },
     // Lets a lens ask for "the start time" without knowing your field names.
     fieldRoles: { start: "kickOff" },
   });
   ```

3. **Add it to `createSchema([...])`.** An edge pointing at a kind that is not
   in that array is a *typecheck* failure, not a runtime one — `createSchema`'s
   `ValidateEdgeTargets` sees it.

4. **Say what a node of it is called.** `label` defaults to a `label` field and
   then to the id. An id in the interface is a bug you shipped, not a
   placeholder.

5. **Give it verbs.** A kind with no mutation naming it as a subject renders
   fine and can have nothing done to it, and the actions strip will say so out
   loud. If that is not what you meant, see `graview-invariant` for the rule
   shape and add at least one mutation whose `subject.kinds` includes it.

6. **Let the fields be changed, or say why not.** A field you could set at
   creation, you can change: every settable field no mutation writes is
   covered by a derived act per kind (`edit-<kind>`, "Change the drill"),
   editable where it is shown and logged like any other. Two declarations
   shape it. `writes: ["done"]` on a mutation says which fields it sets when
   its arguments do not (`finish()` writing `done`) — and a mutation whose
   argument merely shares a field's name should say `writes: []`. `fixed:
   { text: "the client's words, as sent" }` on the kind says a field never
   changes, and why; the sentence is the documentation. The checker warns
   `field-without-writer` when a field is still out of everyone's reach,
   and refuses `writes-unknown-field`, `fixed-unknown-field` and a
   `fixed-but-written` contradiction.

## Worked examples

- `apps/todo/src/domain/schema.ts` — four kinds, including a `rule` kind whose
  `spec` makes the rules a domain enforces into data, and `fieldRoles` binding
  the timeline lens to a task's own field names
- `apps/seedbed/src/domain/schema.ts` — a kind with a declared `lifecycle`, so
  the past is a horizon rather than a delete

## The declarations that keep paying

- **`creates`** on the mutation that adds this kind (`creates: ["fixture"]`):
  the empty kind card then offers "Add a fixture" by derivation — the blank
  graph onboards itself, FROM THE ROOT OF THE CHAIN. An act that also takes
  a `nodeRef` has no candidates on an empty graph, so it is withheld (a
  picker with nothing in it is worse than no button) and the district says
  what it is waiting for instead: *"Place a feature" cannot begin until there
  is a zone.* Expect exactly one way in on a blank installation, and check
  that it is the one you meant — this only ever shows up on the graph nobody
  tests against.
- **`fromTheOtherEnd`** on the act that makes or breaks the edge. An act
  declaring `connects` or `severs` is offered from BOTH ends of the tie, and
  `title` is written from the subject's side: "Name a caretaker", offered on
  the gardener, reads as naming hers. Say how it reads standing there
  (`fromTheOtherEnd: "Take on a plot"`) — `graview check` warns
  `act-without-far-end-reading` and names the end it has no words for.
- **`lifecycle`** when members expire — `{ field: "status", retired:
  ["played"] }` or `{ field: "until", retired: "date" }`. Every count then
  aggregates over the horizon ("4, +12 past") instead of drowning, and
  `graview check` refuses a lifecycle reading a missing field.
- **A figure**, which is line art of the THING at the city's own three-quarter
  angle — a person, a plot of ground, a gutter — drawn wherever the kind is
  drawn. Nine ship; any domain that is not an abstract tracker runs out of
  them at once, so draw the rest:
  `graview figure ./dist/domain/app.js --kind gutter --from "a gutter along a
  roof edge"` prints the brief (the rules, the angle, a shipped figure as the
  style), and `--judge <file>` reads the answer back, holds it to the rules
  `graview check` holds a figure to, and prints the line to paste. Then look
  at it at twenty pixels, which is the size a chip gives it.
- **A declared hue** in the brand (`accents: { fixture: 210 }`) if this kind
  should wear a chosen colour rather than a stable hash — every chip dot,
  district roof and the focus tag follow.

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

Report **the actual output**, including warnings. What it catches here:

- `edge-target-undeclared` — an edge to a kind nobody declared
- `edge-without-inverse` — a relation with words for one of its two readings
- `act-without-far-end-reading` — an act offered on an end it has no words for
- `field-role-missing-field` — a role pointing at a field that is not there
- `required-invariant-unregistered` — `requiresInvariant` naming no rule
- `mutation-untitled` / `mutation-undescribed` — a verb nobody can read

## What the check cannot see

Say so rather than implying otherwise:

- Whether the kind is a *kind* at all, or should have been a field on an
  existing one. The test: does anything point AT it, and does it have a life of
  its own? A colour is a field. A fixture is a kind.
- Whether the default views read well. Run the app and look.
- Whether the plural reads naturally in a sentence — "3 Fixtures" is fine,
  "3 Person" is not.
