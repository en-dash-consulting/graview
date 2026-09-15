---
name: graview-seed
description: Get a Graview app from a blank graph to a useful one — the order the declaration already states, a plan a model proposes, and one turn that can be taken back.
---

# Fill a blank graph

Every product ships empty once, and it is the state its author never sees:
your own graph has had data in it since the first afternoon. A ten-kind app
on a blank installation is one door and nine silent districts, and the person
who finds that out is the first one to open it.

Two things make it a surface rather than a wall: the app already declares the
ORDER things must be made in, and what a model proposes can be an object
rather than a list of calls somebody applies by hand.

## What the declaration already says

`creates: ["feature"]` on an act, and `zoneId: nodeRef(["zone"])` in its
input, are together a chain: a feature cannot be made until a zone exists.

```ts
import { beginning } from "@graview/core";
const chain = beginning(app);
chain.roots;        // kinds that can begin with nothing in the graph
chain.doors;        // the acts that are the way in
chain.order;        // every kind, with what it waits for and how deep
chain.unreachable;  // what nothing here can make — often right, always worth seeing
```

`graview check` says it as a note (`blank-graph-unreachable`), and
`graview describe` reads the whole thing out. Run it before you believe your
app onboards anybody:

```sh
pnpm build:domain && npx graview describe ./dist/domain/app.js
```

## Do this

1. **Mount `<Begin>`.** It is derived — the chain, the acts that can run now,
   what everything else is waiting for, in your own plurals. Put it on the
   home surface of the routed face, or anywhere a person lands first. It
   stands down on its own once every kind has something in it:
   ```tsx
   <Begin whenFull={<YourOwnHome />} />
   ```

2. **Give the root kind an act that needs nothing.** One act with no required
   `nodeRef` is the difference between an app that onboards itself and one
   that cannot be started. If every creating act needs a node, `graview check`
   says `blank-graph-has-no-door` — and if the data really arrives by seed,
   migration or sync, that note is the answer rather than a fault.

3. **Let a model propose, and make it a plan.** A plan is ordered by the
   chain, judged before any of it runs, reviewable, and applied as ONE turn:
   ```ts
   import { applyPlan, planFrom } from "@graview/tools";
   const plan = planFrom(store, proposals, { app, principal });
   const done = applyPlan(store, plan, { author: surveyor });
   store.undo(done.batch);   // the whole seeding, back the way it arrived
   ```
   A call can name what it is about to make — `as: "lawn"` — and a later call
   points at it with `{ $plan: "lawn" }`. That is the only way a model can
   refer to a node that does not exist yet, and it is what turns forty
   proposals into one graph. It is all-or-nothing and says where it stopped;
   `keepWhatRan` is for a caller who would rather have the half.

4. **Show it before you run it.** `<PlanReview plan={plan} declinable />`
   draws the plan in the order it will run, counts what it makes, and strikes
   refusals through with their reason. `declinable` lets a person drop one —
   and declining the area declines the tree standing in it, said beside the
   entry BEFORE the press (`dependentsOf`, `without`). A seeding nobody read
   is a seeding nobody can trust, and a review nobody can disagree with is
   not a review.

5. **Write the prompt from the graph, not from your head.** The model needs
   the kinds, the acts and their arguments — which `generateLlmsTxt(app)`
   already writes — plus what is already there, so it does not propose a
   second Back Lawn.

## Then find out whether it worked

```sh
pnpm build:domain && npx graview check ./dist/domain/app.js
npx graview describe ./dist/domain/app.js
```

Then open it with an empty store (`?fresh=1` with a ship browser adapter) and
go through your own front door. A test holds it: derive the affordances of
each root kind on an empty graph and assert the way in is offered, and that a
kind deeper in the chain offers nothing and says what it waits for.

## What the check cannot see

- Whether the order is the order a PERSON would want. The chain says what is
  possible, not what is kind: an app may be able to start with practices and
  still want to ask about the ground first.
- Whether the model's proposals are any good. They are typed, ordered,
  permitted and reversible — none of which makes them right, which is why
  the review is a surface and not a formality.
- Whether a seeded graph reads as somebody's. Ten plausible rows a model
  invented look exactly like ten rows that matter, until someone reads them.
