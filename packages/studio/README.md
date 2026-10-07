# @graview/studio

The declaration itself as a graph. Kinds, fields, edges, acts, rules, roles,
grants, lenses and the brand are nodes of a meta-schema declared with the
same `defineNode` an app uses, so the studio is a Graview app over the
declaration: adding a field is an act, renaming a kind is an act, every
change is an op with an author, an intent and an inverse, and `graview check`
judges the result before it is applied.

```ts
import { createStudio, createStudioLens } from "@graview/studio";

const studio = createStudio(app);                 // the app's declaration, as a store
studio.store.apply({ name: "add-field", args: { kind: "kind:plot", label: "soil", type: "enum", required: true, options: ["clay", "loam"] } });
studio.check();                                   // graview check on what it would become
const applied = studio.apply();                   // { app, migration } — refused while there are errors
studio.files();                                   // src/domain/schema.ts, mutations.ts, invariants.ts, policy.ts

// An agent proposes; a person keeps or takes back.
studio.propose({ name: "add-kind", args: { label: "bed" } }, { kind: "agent", id: "planner" });
studio.proposals();                               // the agent's batches still standing
studio.decline("proposal:1");                     // undo, like any turn of an agent's
```

`createStudioLens(app).View`, registered over the studio's kinds with a
title, is a place: what the checker says, judged on every change.

What a graph can carry is the declaration's shape. An act's hand-written
body and a rule's judgment are code: the studio keeps the checkout's by
name, writes a body for an act it declared from what the act says (create,
connect, sever, write), and writes a rule it declared as one that judges
nothing until the checkout gives it an `evaluate`.
