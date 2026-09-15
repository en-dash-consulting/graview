---
name: graview-ship
description: Deploy a Graview app — persistence, op-log-native migrations, export and health — with one declaration and one adapter, self-hosted or behind a service.
---

# Ship a Graview app

`@graview/ship` holds what every deployment needs. One `defineApp`
declaration plus one persistence adapter is a running deployment; nothing
here requires a service.

## Do this

1. **Open the store through ship**, not by hand:

   ```ts
   import { createFileAdapter, openStore } from "@graview/ship";

   const opened = await openStore({ app, adapter: createFileAdapter("./data") });
   // opened.store is an ordinary Store; every applied diff is appended to
   // the log and the snapshot rewritten, serialised in order. Hand off with
   // `await opened.flush()` before close/exit — writes are async.
   // One writer per scope: opening it twice interleaves and clobbers.
   ```

   The file adapter is deliberately readable: `snapshot.json`, append-only
   `log.jsonl`, `meta.json` with the stored schema version. The core's
   sqlite adapter is the scale answer.

   **In the page, with no server**, the browser adapter stores the same
   three things in `localStorage` and slots into the same call — import it
   from `@graview/ship/browser` so the bundler never meets `node:fs`:

   ```ts
   import { browserStartsFresh, createBrowserAdapter, forgetFreshParam, openStore }
     from "@graview/ship/browser";

   const opened = await openStore({
     app, adapter: createBrowserAdapter(), seed,
     fresh: browserStartsFresh(),   // ?fresh=1 asks; a driven browser gets it unless ?remember=1
   });
   forgetFreshParam();              // the seed is the FIRST load, not every load
   ```

   Reopened, the store carries its persisted history: earlier edits are in
   the activity, attributed, and undoable. Give the person a visible way
   back — `StartFresh` from `@graview/primitives`, or `remembers: true` on
   the pages context — because a demo that can be edited into a corner with
   no exit teaches distrust. The sample apps' `main.tsx` files are the
   worked examples; `pnpm remember` is the harness that holds them to it.

2. **Version the declaration, and migrate in primitives.** When the schema
   changes shape:

   ```ts
   defineApp({
     ...,
     version: 2,
     migrations: [{
       from: 1, to: 2,
       title: "size words become bed counts",
       apply: (snapshot) => snapshot.nodes
         .filter((node) => node.kind === "plot")
         .map((node) => ({ op: "patch-node", id: node.id,
           before: { size: node.size, beds: undefined },
           after:  { size: undefined, beds: node.size === "large" ? 6 : 2 } })),
     }],
   })
   ```

   A migration answers in the op log's own five words, so running one appends
   ordinary operations — authored `system · ship:migration`, stating intent,
   carrying their inverse. `openStore` runs the pending chain on load.
   `graview check` refuses a chain with a hole or a multi-version jump
   (`migration-gap`, `migration-not-single-step`) before deploy time finds it.

3. **Export is the exit.** `exportBundle(app, store)` — graph, attributed
   history and version in one JSON shape; `assertBundle` refuses someone
   else's app or a newer version, plainly. A tenant who cannot leave was
   never a customer.

4. **Health is coherence, not liveness.** `health(store)` reports sizes,
   standing and dangling edges — poll it per deployment, curl it self-hosted.

5. **The machine under the dev server is a door.** A locally-run product
   very often has a coding agent installed, logged in and paid for; the
   browser cannot spawn it and the dev server can.

   ```ts
   // vite.config.ts
   import { localIntelligence } from "@graview/ship/dev";
   plugins: [localIntelligence({ path: "/__graview/local", budgetUsd: 2 })]
   ```

   Declare it — `intelligence: [{ …, reach: ["paste", "local"], bridge:
   "/__graview/local" }]` — and read it with `useLocalIntelligence(path)`
   from `@graview/react`. The spawned session gets Read and only Read, a
   turn per photograph plus three, a dollar budget, a closed stdin and an
   environment with every `CLAUDE*` variable stripped. `apply: "serve"` means
   a build carries no door: a deployed copy probes, gets nothing, and reads
   as **closed** — which is a state, not a fault.

## Then find out whether it worked

Write, close, reopen, and read: the graph must survive the round trip and
the persisted log must carry your ops with their authors. The framework's
own rehearsal (`pnpm smoke`) does exactly this from packed tarballs —
`theDeploymentShipped` is the verdict to mimic.

## What the check cannot see

- Whether your migration is the RIGHT transform — the chain being unbroken
  says nothing about the data arriving meaningful. Migrate a copy of real
  data and read it before shipping the step.
- Whether the adapter's storage location survives your deployment story
  (containers with ephemeral disks lose a file adapter's whole point).
- Whether the export actually round-trips: rehearse import into a fresh
  deployment, the way the framework's smoke run does — do not assume it.

## The boundary

Anything ONE deployment needs belongs in ship. Tenancy, provisioning,
deploy-to-URL, billing and fleet upgrades belong to the operator of many —
a separate service consuming ship like any customer.
