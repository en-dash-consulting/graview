---
name: graview-ship
description: Deploy a Graview app — persistence, op-log-native migrations, export and health — with one declaration and one adapter, self-hosted or behind a service.
---

# Ship a Graview app

`@graview/ship` holds what every deployment needs. One `defineApp`
declaration plus one persistence adapter is a running deployment; nothing
here requires a service. A graph projected from another system, synced back
to it, or kept in step with a Google calendar is `graview-sync`.

## Do this

1. **Open the store through ship**, not by hand:

   ```ts
   import { createFileAdapter, openStore } from "@graview/ship";

   const opened = await openStore({ app, adapter: createFileAdapter("./data") });
   // opened.store is an ordinary Store; every applied diff is appended to
   // the log and the snapshot rewritten, serialized in order. Hand off with
   // `await opened.flush()` before close/exit — writes are async.
   // One writer per scope: opening it twice interleaves and clobbers.
   ```

   The file adapter is deliberately readable: `snapshot.json`, append-only
   `log.jsonl`, `meta.json` with the stored schema version. The core's
   sqlite adapter is the scale answer.

   **In the page, with no server**, the browser adapter stores the same
   three things in IndexedDB (localStorage only where IndexedDB will not
   open; a store localStorage already holds is carried forward on its first
   open). An edit is kept when `apply` returns, not when IndexedDB commits:
   a journal in localStorage holds what IndexedDB has not yet, and the next
   open puts it back, so a page left at once loses nothing. It slots into the same call — import it from
   `@graview/ship/browser` so the bundler never meets `node:fs`:

   ```ts
   import { browserStartsFresh, createBrowserAdapter, forgetFreshParam, openStore }
     from "@graview/ship/browser";

   const opened = await openStore({
     app, adapter: createBrowserAdapter(), seed,
     fresh: browserStartsFresh(),   // Start fresh (freshHref) asks; a driven browser gets it unless ?remember=1
   });
   forgetFreshParam();              // the seed is the FIRST load, not every load
   ```

   Reopened, the store carries its persisted history: earlier edits are in
   the activity, attributed, and undoable. Give the person a visible way
   back — `StartFresh` from `@graview/primitives`, or `remembers: true` on
   the pages context — because a demo that can be edited into a corner with
   no exit teaches distrust. The sample apps' `main.tsx` files are the
   worked examples; `pnpm remember` is the harness that holds them to it.

   **The seed is read once**, into an empty store. When the default content
   moves afterwards, do not delete the store to see it — diff and land it:

   ```sh
   graview sync-seed ./dist/domain/app.js --seed ./src/data/example.json --data ./data
   graview sync-seed ./dist/domain/app.js --seed ./src/data/example.json --data ./data --apply
   ```

   The first prints the content steps — `task t-van is put`, `today is
   patched: label`, `today holds t-van is tied` — and writes nothing, or
   exits 1 naming every record, field and declared limit the store would
   refuse (`Step: Too big: expected number to be <=4`); the
   second lands them as one operation authored `system · ship:sync-seed`,
   logged, undoable, leaving what people made alone unless `--prune` says
   otherwise. The same five steps (`put-node`, `patch-node`, `drop-node`,
   `put-edge`, `drop-edge`) go in `migrations[]` through `stepsMigration`
   when every installation should get them.

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
   undone like any other. `openStore` runs the pending chain on load.
   `graview check` refuses a chain with a hole or a multi-version jump
   (`migration-gap`, `migration-not-single-step`) before deploy time finds it.

3. **Export is the exit.** `exportBundle(app, store)` — graph, attributed
   history and version in one JSON shape; `assertBundle` refuses someone
   else's app or a newer version, plainly. A tenant who cannot leave was
   never a customer.

4. **Health is coherence, not liveness.** `health(store)` reports sizes,
   standing and dangling edges — poll it per deployment, curl it self-hosted.

   **Files are yours to store.** An `image`/`file` field keeps a `FileValue`;
   its `href` is your path. Hand `mount` `files: { upload, maxBytes, kinds }`
   (dev: `devFiles()`; under a base, `filesAt(base + "/graview/files")`).
   Serve each as its bytes' type, `nosniff`, a `sandbox` CSP on all but a
   PDF (an SVG runs script otherwise), only to a seat that `seesId` a record
   holding it. A page with a CSP allows the files route in `object-src`,
   or a PDF is its one line, Open / Download, and no box.

5. **Serve it, and let an agent in.** `graview serve <entry> --data ./data`
   puts the store behind HTTP with the op log as the wire; `graview mcp
   <entry> --remote-url <url>` and `graview apply … --remote-url <url>` are
   the same commands an agent uses against a folder, now against the server,
   judged under the seat the request carries. Put `serve` and `mcp` in the
   app's scripts. The routes are `WIRE`, exported and pinned by a test, and
   `serveStore({ seatOf })` is where a host reads its own credential from
   the `Request` — `openRemote({ headers })` carries whatever it asks for.
   Off Node (a Worker, a Durable Object, Deno), `createStoreHandler` from
   `@graview/ship/runtime` answers the same routes as `handle(request)`. A store believes
   the seat headers the framework's clients send only with
   `trustSeatHeaders: true` (`graview serve` sets it on 127.0.0.1 and
   refuses another `--host` without `--trust-seat-headers`); with neither,
   it answers 401. On 127.0.0.1 it answers only its own origin, and a page
   on another one `--allow-origin` names (a dev server's app that opens
   the store with `openRemote`), and no header there names the system's seat.
   Each run there mints a key and believes only a request carrying it, so
   another account on the machine cannot claim a seat: hand `openRemote`,
   `--remote-url` and a page's own server parameter the address it printed, whole
   (`?graview_key=…`); health answers without it.

6. **A host serving document apps compiles once, on the server.** Send
   `serializeCompiled(compileDocument(document))` beside the document, and
   build the app in the page with `appFromOrCompile({ compiled, document })`
   from `@graview/core/compiled` — never `@graview/core/document`, which
   brings the compiler back into the first chunk. A compiled app of another
   format (`graview-compiled@1` today), or made from another document than
   the one beside it, is not built and the document is compiled instead;
   `pnpm verify hosted` says what the page carries.

7. **Look at a document with no product.** `graview preview <document.json>
   --seed <snapshot.json>` is `serve` with Graview's own faces over the
   store — the scene and Pages, in memory unless `--data` says where, which
   it then holds: `sync-seed --apply` and `apply` refuse until it stops
   (Ctrl-C or `kill` stops it within seconds, open pages or not; a hold
   whose process died is taken over, and says so) — and
   `graview shots … --places home,overview --out shots` photographs named
   places headless (Playwright is yours to install). Like `serve`, each
   preview run mints a key and every address it prints carries it: open one
   of those, since nothing but health answers without it. Prove a change to an
   emitted document with these, not hand-written screenshots. In a test,
   `compileDocumentFiles(path, { seed })` from `@graview/core/testing`
   reads the document where it lives — no fixture copy to drift.

8. **Edits reach readers when published, if you say so.**
   `publishing: { mode: "on-publish", working: ["editor"] }` on the
   declaration (absent, `"live"`: as they are made). The working roles, and
   an agent acting for one, edit the head live; every other seat — a
   visitor, an embed, a static page, a linked read — is served the last
   publish. A publisher (`publishers`, else `working`) runs the built-in
   `publish` act; undoing it takes readers back. Writes always land on the
   head: a visitor's answer reaches readers with the next publish.
   `?as=published` shows a collaborator what readers see, and
   `unpublished(store)` from `@graview/core/history` says what is waiting.
   A server loads `@graview/core/publishing` (ship does). Hand
   `app.publishing` to any store you make yourself — `openStore` and
   the embed do — and prove it by opening the app as a visitor.

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
- Whether the export round-trips: rehearse an import into a fresh
  deployment, the way the framework's smoke run does — do not assume it.

## The boundary

Anything ONE deployment needs belongs in ship: the op log, the snapshot,
migrating on open, the wire, a principal on every apply, the seed at first
install, content steps, the agent's door on the dev server (`localIntelligence`,
taught in `graview-desk`), connections (`graview-sync`).
Tenancy, provisioning, billing, quotas and fleet upgrades belong to the
operator of many — a service consuming ship like any customer, with its own
`seatOf` mapping people and keys to principals. The concern table is in
`@graview/ship`'s README; a third party can stand up their own host from
it without forking anything.
