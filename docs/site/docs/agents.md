# Working with a model

An AI agent uses a Graview app through the same declaration a person does: the same acts, as typed tools, under the same permissions and rules. A declaration is a context graph, and a context graph is the one thing a model reads as well as a person does. Graview has two programming interfaces over one declaration: the surfaces a person uses, and the tools, descriptions and skills a model uses. Neither can drift from the other, because both are derived.

## The seat

An intelligence provider in the declaration says what a model may do and how words and pictures reach it. The seat gets the same acts a person has, narrowed by the same policy, and its turns land in the same operation log with an author and an intent — watchable from altitude, and undoable out of order. What comes back from a model is a plan before it is a change: one row per thing, what it was sure about, what goes with what if you decline something, then one batch with one undo.

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

## What a model reads before it writes (15 skills)

Skills that teach an assistant the authoring moves, each ending in a real graview check verdict. Installed into a product by `graview skills install .` — which `graview create` runs for you — into `.claude/skills` and `.agents/skills`, so Claude Code and Codex find the same instructions.

- [graview-agent-seat](https://graview.dev/docs/skills/graview-agent-seat.html): Wire an agent seat into a Graview app that shares the interface's own actions rather than shadowing them, and verify the diffs are identical rather than assuming they are.
- [graview-brand](https://graview.dev/docs/skills/graview-brand.html): Put an installation's own name, mark, typeface and palette on a Graview app without forking a package, and let graview check measure the contrast rather than trusting it.
- [graview-desk](https://graview.dev/docs/skills/graview-desk.html): Put a model INSIDE a Graview product — a surface that takes photographs or words, reaches the model through a declared door, and turns the answer into a plan somebody reviews before it touches the graph.
- [graview-embed](https://graview.dev/docs/skills/graview-embed.html): Put a Graview app on somebody else's page — a picture in an article, a chapter in the docs, a live demo in a landing page — with its own theme scoped to one element, and nothing on the host touched.
- [graview-invariant](https://graview.dev/docs/skills/graview-invariant.html): Write a Graview invariant that judges the graph and NAMES the mutations that would repair it, then verify it with graview check and by making it actually fire.
- [graview-lens](https://graview.dev/docs/skills/graview-lens.html): Build a Graview lens that binds ROLES rather than field names, so a second domain can reuse it unchanged — and prove the reuse rather than asserting it.
- [graview-new-app](https://graview.dev/docs/skills/graview-new-app.html): Start a product on Graview in its own repository — the shape of the declaration, the shell that comes for free, and the CI that keeps it honest afterwards.
- [graview-node-kind](https://graview.dev/docs/skills/graview-node-kind.html): Add a node kind to a Graview app — fields, edges, label, plural and field roles — and verify it with graview check rather than claiming it worked.
- [graview-pages](https://graview.dev/docs/skills/graview-pages.html): Give a Graview app the routed face it wants — from the derived pages, to one page in the app's own words, to a product design that replaces every surface.
- [graview-permissions](https://graview.dev/docs/skills/graview-permissions.html): Declare who may do what in a Graview app once, so the store enforces it, the actions strip narrows and an agent seat narrows with it — verified by graview check and by trying it.
- [graview-port-app](https://graview.dev/docs/skills/graview-port-app.html): Port an existing application onto Graview — deciding what is a node, what is a field and what is an edge — and proving the port with a parity test rather than an assertion.
- [graview-seed](https://graview.dev/docs/skills/graview-seed.html): Get a Graview app from a blank graph to a useful one — the order the declaration already states, a plan a model proposes, and one turn that can be taken back.
- [graview-ship](https://graview.dev/docs/skills/graview-ship.html): Deploy a Graview app — persistence, op-log-native migrations, export and health — with one declaration and one adapter, self-hosted or behind a service.
- [graview-studio](https://graview.dev/docs/skills/graview-studio.html): Open an app's declaration as a graph in Graview's own interface, change it with ordinary acts, let graview check judge the result before it is applied, migrate a stored graph, and write the declaration back as the files graview create writes.
- [graview-worker-view](https://graview.dev/docs/skills/graview-worker-view.html): Write a Graview worker view — one plain script, no imports and no build, that draws HTML, SVG and CSS for a kind or the home through the graview global — with a manifest the host enforces, and prove it runs rather than assuming it does.

## The studio: a model edits the declaration itself

The declaration itself as a graph: kinds, fields, edges, acts, rules, roles and grants as nodes, edited with ordinary mutations in Graview's own interface, checked before they are applied, migrated, and written back as the files graview create writes.

- [graview-studio](https://graview.dev/docs/skills/graview-studio.html): Open an app's declaration as a graph in Graview's own interface, change it with ordinary acts, let graview check judge the result before it is applied, migrate a stored graph, and write the declaration back as the files graview create writes.
- [graview-seed](https://graview.dev/docs/skills/graview-seed.html): Get a Graview app from a blank graph to a useful one — the order the declaration already states, a plan a model proposes, and one turn that can be taken back.

The package: [`@graview/studio`](https://graview.dev/docs/packages/studio.html).

---

The declaration is the interface a person uses and the interface a model uses. What a model gets, how it is narrowed, and what it reads before it writes.

The page: https://graview.dev/docs/agents.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
