---
name: graview-studio
description: Open an app's declaration as a graph in Graview's own interface, change it with ordinary acts, let graview check judge the result before it is applied, migrate a stored graph, and write the declaration back as the files graview create writes.
---

# Work the declaration in the studio

The declaration — kinds, fields, edges, acts, rules, roles, grants, lenses,
brand — is itself a graph. `@graview/studio` declares that graph with the
same `defineNode` an app uses, so a change to the declaration is an act with
an author, an intent and an inverse, judged by the same checker, undone like
any other.

## Do this

1. **Open the studio over the app**, in a test, a script or a page:

   ```ts
   import { createStudio, createStudioLens } from "@graview/studio";
   const studio = createStudio(app);          // the declaration, as a store
   ```

   The store's nodes have stable ids: `declared:plot` (not `kind:plot`,
   which is the layout's name for the district), `field:plot.label`,
   `edge:plot.tended-by`, `act:tend`, `rule:every-plot-tended`,
   `role:coordinator`, `grant:2`, `lens:coverage`, `brand`.

2. **Change it with acts**, not by hand:

   ```ts
   studio.store.apply({ name: "add-field", args: { kind: "declared:plot", label: "soil", type: "enum", required: true, options: ["clay", "loam"] } }, { author: june, intent: "Plots have soil" });
   studio.store.apply({ name: "add-act", args: { kind: "declared:plot", label: "resize", title: "Resize", writes: ["size"] } });
   studio.store.apply({ name: "add-rule", args: { kind: "declared:plot", label: "sized", description: "A plot has a size." } });
   studio.store.apply({ name: "name-repair", args: { rule: "rule:sized", act: "act:resize" } });
   ```

   The acts: `add-kind`, `rename-kind`, `remove-kind`, `add-field`,
   `remove-field`, `add-edge`, `remove-edge`, `add-act`, `remove-act`,
   `add-rule`, `remove-rule`, `name-repair`, `forget-repair`, `add-role`,
   `grant`, `revoke-grant`, and the derived `edit-<kind>` for every field
   (a description, an inverse, a title, a lifecycle).

3. **Check before you apply.** `studio.check()` is `graview check` on the
   declaration as it now stands. `studio.apply()` refuses while there are
   errors and says which; otherwise it hands back `{ app, migration }` —
   the migration is `null` when a stored graph needs nothing, else a
   `{ from, to, title, apply }` to append to the app's migrations (the new
   app already carries it and the bumped version).

   **Opened on a document** (`createStudio(compileDocument(d).app)`), the
   studio hands back a document, not TypeScript. `studio.edits()` is the
   change as `editDocument`'s own ops (`add-field`, `rename-field`,
   `set-required`, `set-options`, `add-relation`, `remove-act`, `add-rule`
   …); `studio.document()` is the opened document with them applied, every
   act, label, brand and money field untouched. `check()`, `would()` and
   `apply()` judge by compiling that document, and `apply()` hands back
   `document` with `app` compiled from it. A copied app, or one with its
   policy swapped, says it: `createStudio(app, { document })`; without one,
   `whyNoDocument()` says why. A change no op says yet — a relation's
   cardinality, a lifecycle, a grant, retyping a money field — comes back
   as `documentFindings`, one sentence each, and no document.

4. **Write it back.** `studio.files({ schemaVar: "gardenSchema" })` is
   `src/domain/schema.ts`, `mutations.ts`, `invariants.ts` and, with roles,
   `policy.ts` — the files `graview create` writes. Shape is what a graph
   carries: an act the studio declared gets a body from what it says
   (create, connect, sever, write); an act the checkout wrote keeps the
   checkout's body under the studio's declaration; a rule the studio
   declared judges nothing until the checkout gives it an `evaluate`. Read
   the files before you commit them, and keep a hand-written body where the
   comment says so.

5. **Let an agent propose.** `studio.propose(call, agentPrincipal, intent)`
   applies under the agent's seat in a batch of its own; `studio.proposals()`
   lists what stands; `studio.decline(batchId)` undoes one; accepting is
   applying. In the interface, the trail shows the agent's turn with its
   undo, like any turn.

6. **Put it on a page.** The studio is an app: mount `studioApp()` with
   `declarationToGraph(app)` as the seed, and register
   `createStudioLens(app).View` over `kind` with a title — a place, "What
   the checker says", one press from anywhere.

## Then find out whether it worked

Run `graview check` on the app the studio applied, and the checkout's own
verify on the files it wrote. Say what they said.

## What the check cannot see

- Whether a body the studio wrote does what the person meant. It does what
  the act declares — create, connect, sever, write — and nothing more.
- Whether a rule the studio declared is right. It judges nothing until the
  checkout gives it an `evaluate`; the checker sees a rule, not a judgement.
- Whether a migration is safe for data it has not met. It is computed
  against the stored graph when it runs; look at the primitives on a copy.
- Whether the files should replace the checkout's. Read them; a hand-written
  body is the checkout's to keep.
