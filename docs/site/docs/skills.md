# The skills

Graview's 15 skills are instructions an AI coding assistant reads before it writes a Graview app. Each teaches a model one shape of the declaration, and each ends in `graview check` — reporting what it actually said, rather than claiming the work is done.

```sh
graview skills install .
```

## All of them

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

---

The 15 skills that teach an assistant the authoring moves, each ending in a real check.

The page: https://graview.dev/docs/skills.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
