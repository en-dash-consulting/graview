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
       "picked-for": { to: ["player"], description: "who is in the the coaching example" },
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

## Worked examples

- `the coaching example/src/domain/schema.ts` — ten kinds, including a `rule` kind whose
  `spec` makes the rules a domain enforces into data
- `the household example/src/domain/schema.ts` — `fieldRoles` binding a calendar lens
  to a household's own field names

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

Report **the actual output**, including warnings. What it catches here:

- `edge-target-undeclared` — an edge to a kind nobody declared
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
