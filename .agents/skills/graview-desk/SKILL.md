---
name: graview-desk
description: Put a model INSIDE a Graview product — a surface that takes photographs or words, reaches the model through a declared door, and turns the answer into a plan somebody reviews before it touches the graph.
---

# A desk a model works at

`graview-agent-seat` is the model BESIDE the product: a seat in the bar that
answers questions and proposes a change. A desk is the model INSIDE it — the
surface a person brings something to. Photographs of a property, a paragraph
about a season, a spreadsheet somebody was sent. It is often the feature the
product is for, and it is four seams, all of which the framework ships.

## The four seams

1. **Intake** — getting the something in. `<Intake onPhotos={...} />` hands
   back data URLs.
2. **A door** — reaching the model. Declared, not hard-wired:
   ```ts
   intelligence: [{
     name: "surveyor",
     kind: "llm",
     reach: ["paste", "local"],
     bridge: "/__graview/local",
     keyStorage: "in this browser only, never in the repository",
     may: ["stake-out", "place-feature"],
   }]
   ```
   `<Door provider="surveyor" prompt={...} photos={...} onProposals={...} />`
   draws exactly the doors declared. **Paste is the floor** — a prompt out, an
   answer back, no key and no network — and a product reachable that way is a
   product anybody can run. `local` is the machine under the dev server
   (`localIntelligence()` from `@graview/ship/dev`), offered only when
   something is actually answering there.
3. **A plan** — what came back, as an object rather than a list: ordered by
   the chain, judged against the policy and the provider's `may`, reviewable.
   `planFrom(store, proposals, { app, principal })`.
4. **A review** — `<PlanReview plan={plan} onApplied={...} />`. Applied as one
   turn, so `store.undo(batch)` takes the whole thing back.

## Do this

1. **Write the prompt from the graph.** What kinds exist, what acts exist and
   what they take — `generateLlmsTxt(app)` from `@graview/core/check` writes that — plus what is already
   there. A model that cannot see the graph invents a second Back Lawn.

2. **Ask for proposals, not prose.** One JSON object with a `proposals` array
   of `{ mutation, args, as?, why? }`. `firstJsonObject` finds it inside
   whatever the model wrapped it in; `validateProposals` drops what this app
   does not have and what the provider may not do.

3. **Declare the allowlist and mean it.** `may` is enforced by the store now,
   on every path including your own code. A surveyor that may describe the
   ground and may not touch the record is a promise the runtime keeps.

4. **Never a second path to the store.** The desk's answer becomes ordinary
   mutations, applied by the same store, judged by the same policy, in the
   same log, with the same undo. "Add AI" is an entry in the declaration,
   never a way around it.

5. **Say what it did in the product's words.** `why` on each proposal is the
   sentence the review shows; a plan of eleven calls with no reasons is a
   thing nobody can approve.

## Then find out whether it worked

```sh
pnpm build:domain && npx graview check ./dist/domain/app.js
```

The checker verifies every act in `may` exists, warns on a `local` reach with
no bridge and a `key` reach with no storage story, and `graview describe`
lists the doors. Then drive it: a test that feeds a canned answer through
`planFrom` and asserts the plan's order, its refusals and what the graph
holds afterwards costs ten lines and catches the whole class.

## What the check cannot see

- Whether the model can actually see what you sent. A photograph a model was
  never handed produces a confident description of nothing.
- Whether a refusal is legible. The store refuses in a sentence; if the desk
  swallows it, a person meets a button that does nothing.
- Whether the answer is TRUE. Everything here makes a proposal safe, ordered
  and reversible. None of it makes it right, which is why a person reads it.
