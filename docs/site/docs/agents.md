# Working with a model

An AI agent uses a Graview app through the same declaration a person does: the same acts, as typed tools, under the same permissions and rules. A declaration is a context graph, and a context graph is the one thing a model reads as well as a person does. Graview has two programming interfaces over one declaration: the surfaces a person uses, and the tools, descriptions and skills a model uses. Neither can drift from the other, because both are derived.

## The seat

An intelligence provider in the declaration says what a model may do and how words and pictures reach it. The seat gets the same acts a person has, narrowed by the same policy, and its turns land in the same operation log with an author and an intent — watchable from altitude, and undoable out of order. What comes back from a model is a plan before it is a change: one row per thing, what it was sure about, what goes with what if you decline something, then one batch with one undo.

In the app, a person meets the model where the thing is. Right-click a record for what it picks from the acts, places and panels the app already has; press ⌘K to ask about what is selected, and the answer stands on a card beside it, a change it proposes waiting as a ghost until it is accepted. The host lends the model (`ai`), and with AI off none of it is drawn.

- [graview-agent-seat](https://graview.dev/docs/skills/graview-agent-seat.html): Wire an agent seat into a Graview app that shares the interface's own actions rather than shadowing them, and verify the diffs are identical rather than assuming they are.
- [graview-permissions](https://graview.dev/docs/skills/graview-permissions.html): Declare who may do what in a Graview app once, so the store enforces it, the actions strip narrows and an agent seat narrows with it — verified by graview check and by trying it.
- [graview-desk](https://graview.dev/docs/skills/graview-desk.html): Put a model INSIDE a Graview product — a surface that takes photographs or words, reaches the model through a declared door, and turns the answer into a plan somebody reviews before it touches the graph.

## Typed tools, derived

Derived affordances and the agent tool surface, generated from the same declarations; graview mcp and graview apply host it against a real store. Every act is a tool with a schema and a sentence attached; the tool surface is generated from the declaration and narrowed by the seat's role, so a model is never offered an act it may not take.

The package: [`@graview/tools`](https://graview.dev/docs/packages/tools.html).

## What a model can read

`graview describe` reads the declaration out for something that cannot see: what a blank installation meets and in what order, what is drawn and what falls back, what a seat may do, how a model is reached, what is judged. `graview docs` writes an `llms.txt` and an `agents.md` beside the entry, derived, so they cannot drift.

```text
graview describe <entry> [--as <role>] [--views <module>] [--place <slug|id>]

    --place <slug|id> [--seed <snapshot.json>] [--width <px>] [--id <who>] says what one
    place shows that seat instead: headings, figures, lists and problems.

```

```text
graview docs <entry> [--out <dir>] [--views <module>]
```

## What a model reads before it writes (27 skills)

Skills that teach an assistant the authoring moves, each ending in a real graview check verdict. Installed into a product by `graview skills install .` — which `graview create` runs for you — into `.claude/skills` and `.agents/skills`, so Claude Code and Codex find the same instructions.

- [graview-agent-seat](https://graview.dev/docs/skills/graview-agent-seat.html): Wire an agent seat into a Graview app that shares the interface's own actions rather than shadowing them, and verify the diffs are identical rather than assuming they are.
- [graview-brand](https://graview.dev/docs/skills/graview-brand.html): Put an installation's own name, mark, typeface and palette on a Graview app without forking a package, and let graview check measure the contrast rather than trusting it.
- [graview-desk](https://graview.dev/docs/skills/graview-desk.html): Put a model INSIDE a Graview product — a surface that takes photographs or words, reaches the model through a declared door, and turns the answer into a plan somebody reviews before it touches the graph.
- [graview-embed](https://graview.dev/docs/skills/graview-embed.html): Put a Graview app on somebody else's page — a picture in an article, a chapter in the docs, a live demo in a landing page — with its own theme scoped to one element, and nothing on the host touched.
- [graview-host-page](https://graview.dev/docs/skills/graview-host-page.html): Host a Graview app as the page itself — a service that serves it, a chat's widget, the address bar handed over, the host's own menu and news inside it — and picture its places honestly: wait for data-graview-drawn or onDrawn rather than a timer, open a page on a view proposed and not kept (draftView), and photograph places with graview preview and graview shots (--view, --manifest).
- [graview-invariant](https://graview.dev/docs/skills/graview-invariant.html): Write a Graview invariant that judges the graph and NAMES the mutations that would repair it, then verify it with graview check and by making it actually fire.
- [graview-lens](https://graview.dev/docs/skills/graview-lens.html): Build a Graview lens that binds ROLES rather than field names, so a second domain can reuse it unchanged — and prove the reuse rather than asserting it.
- [graview-linked-records](https://graview.dev/docs/skills/graview-linked-records.html): Link a record in one Graview app to a record in another app — a relation whose target is another app's kind, read there as whoever is looking, walked by computed fields and rules, its far changes kept in this app's history — and verify it with graview check and by opening it as a viewer who may not see the other app.
- [graview-lists](https://graview.dev/docs/skills/graview-lists.html): Keep a Graview app's lists usable as it grows — what a list offers to filter by, the order and groups it opens in, cards read at a glance, several records acted on at once, a list printed as a static page, and a date that repeats rather than a record each time — and verify each with graview check and the page itself rather than assuming it.
- [graview-locale](https://graview.dev/docs/skills/graview-locale.html): Say a Graview app's money, days, times and numbers the way its people say them — a currency, a locale and a time zone declared once on the brand, a field kept as money, {net | money} and {at | time} in a template — and let graview check refuse a code, a locale or a zone it cannot write rather than trusting the page.
- [graview-new-app](https://graview.dev/docs/skills/graview-new-app.html): Start a product on Graview in its own repository — the shape of the declaration, the shell that comes for free, and the CI that keeps it honest afterwards.
- [graview-node-kind](https://graview.dev/docs/skills/graview-node-kind.html): Add a node kind to a Graview app — fields, edges, label, plural and field roles — and verify it with graview check rather than claiming it worked.
- [graview-pages](https://graview.dev/docs/skills/graview-pages.html): Give a Graview app the routed face it wants — from the derived pages, to one page in the app's own words, to the door of a product design that replaces every surface (graview-pages-design).
- [graview-pages-design](https://graview.dev/docs/skills/graview-pages-design.html): Give a Graview app a product design over its routed face — its own shell under the one bar, every surface replaced, its tabs lit from the section a kind's pages are in, and a trail that says where a person is — and verify it by rendering each page and opening it, rather than assuming the derived pages are gone.
- [graview-permissions](https://graview.dev/docs/skills/graview-permissions.html): Declare who may do what in a Graview app once, so the store enforces it, the actions strip narrows and an agent seat narrows with it — verified by graview check and by trying it.
- [graview-port-app](https://graview.dev/docs/skills/graview-port-app.html): Port an existing application onto Graview — deciding what is a node, what is a field and what is an edge — and proving the port with a parity test rather than an assertion.
- [graview-seed](https://graview.dev/docs/skills/graview-seed.html): Get a Graview app from a blank graph to a useful one — the order the declaration already states, a plan a model proposes, and one turn that can be taken back.
- [graview-ship](https://graview.dev/docs/skills/graview-ship.html): Deploy a Graview app — persistence, op-log-native migrations, export and health — with one declaration and one adapter, self-hosted or behind a service.
- [graview-shipped-lens](https://graview.dev/docs/skills/graview-shipped-lens.html): Declare one of the lenses Graview ships — a calendar, a status board, a coverage, a timeline, a board, a plan, a blocks place — as a titled place with its bindings and options, and read what graview check and add-lens refuse (an option the lens does not take, a lens that cannot draw, a title taken) rather than drawing a lens that quietly ignores a key.
- [graview-sight](https://graview.dev/docs/skills/graview-sight.html): Say who sees which records of a Graview app, and which of their fields — so a seat is served only what it may see, on every surface at once — verified by graview check and by comparing what a seat is told with a hidden value and without one.
- [graview-studio](https://graview.dev/docs/skills/graview-studio.html): Open an app's declaration as a graph in Graview's own interface, change it with ordinary acts, let graview check judge the result before it is applied, migrate a stored graph, and write the declaration back as the files graview create writes.
- [graview-sync](https://graview.dev/docs/skills/graview-sync.html): Keep a Graview app in step with another system — a graph projected from it as a snapshot, a SyncEngine that sends this app's acts back and holds a field both sides changed, a remote that speaks MCP behind a door on the dev server, and a Google calendar declared as a connection — and verify the first run sends nothing and a conflict is held rather than assuming the two agree.
- [graview-tidying](https://graview.dev/docs/skills/graview-tidying.html): Tidy a Graview app without losing anything — set records aside (archive, bring back) instead of deleting them, merge a duplicate into the one that stays, and let the app's own actor link and prune by suggestion a person accepts or declines, held to what people said — verified with graview check and by undoing it rather than assuming nothing was lost.
- [graview-view-drawing](https://graview.dev/docs/skills/graview-view-drawing.html): Draw in a Graview worker view — the HTML, SVG and CSS the host keeps of it, the app's tokens and brand, the images a view may show (the app's logo, the app's own images, the pictures on records), a record's video the host plays and its full-screen viewer, files a person drops on it — and find out what the host refused rather than assuming it drew.
- [graview-view-forms](https://graview.dev/docs/skills/graview-view-forms.html): Let a Graview worker view change records — a bound press (data-act), the fields a person types into, a record's own text filled to edit (data-prefill), a field that saves as it is typed (data-save) and the view hearing what became of each act (acted) — and prove a press applies and a field the view filled is refused, rather than assuming the form works.
- [graview-view-specs](https://graview.dev/docs/skills/graview-view-specs.html): Say how a Graview kind's card, row and page read, as data — blocks from a closed set bound by {field} templates and rule-language conditions, headlines, figures and lists of related records — and the values worked out from others (computed) that they show, verified by graview check and the page rather than by assuming the spec drew.
- [graview-worker-view](https://graview.dev/docs/skills/graview-worker-view.html): Write a Graview worker view — one plain script, no imports and no build, that draws HTML, SVG and CSS for a kind or the home through the graview global — with a manifest the host enforces, and prove it runs rather than assuming it does.

## The studio: a model edits the declaration itself

The declaration itself as a graph: kinds, fields, edges, acts, rules, roles and grants as nodes, edited with ordinary mutations in Graview's own interface, checked before they are applied, migrated, and written back as the files graview create writes.

- [graview-studio](https://graview.dev/docs/skills/graview-studio.html): Open an app's declaration as a graph in Graview's own interface, change it with ordinary acts, let graview check judge the result before it is applied, migrate a stored graph, and write the declaration back as the files graview create writes.
- [graview-seed](https://graview.dev/docs/skills/graview-seed.html): Get a Graview app from a blank graph to a useful one — the order the declaration already states, a plan a model proposes, and one turn that can be taken back.

The package: [`@graview/studio`](https://graview.dev/docs/packages/studio.html).

---

The declaration is the interface a person uses and the interface a model uses. What a model gets, how it is narrowed, and what it reads before it writes.

The page: https://graview.dev/docs/agents.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
