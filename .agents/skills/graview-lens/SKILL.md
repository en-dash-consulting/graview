---
name: graview-lens
description: Build a Graview lens that binds ROLES rather than field names, so a second domain can reuse it unchanged — and prove the reuse rather than asserting it.
---

# Build a lens

A lens is a picture that knows nothing about your domain. The timeline does not
know what a duty is; it knows there is a `start`, an `end` and a column. The
coverage matrix does not know what a requirement is; it knows there are rows,
columns and an edge that fills a cell. That indirection is the entire point: a
lens written for one app is used unchanged by another.

The framework ships three, each built from the public primitives — which makes
them the worked example of the authoring API rather than privileged insiders.
Read one before writing your own:

- `packages/primitives/src/lens/timeline.tsx` — intervals in columns
- `packages/primitives/src/lens/coverage.tsx` — a bipartite mapping
- `packages/primitives/src/lens/board.tsx` — position given by the domain

## Do this

1. **Name the roles, not the fields.** A lens declares
   `requiredRoles: ["start", "end"]`; an app says which of ITS fields fill them.
   If your lens names `dutyId` anywhere, it is not a lens.

2. **Choose which shape of binding you need.** There are two, and assuming
   there was one is how the first version of this got it wrong:
   - **fields** — a kind's own field names onto roles
     (`{ session: { start: "start", end: "end" } }`). The timeline.
   - **entities** — roles onto whole kinds and edges
     (`{ rows: { kind: "skill" }, link: { edge: "develops" } }`). The matrix.

3. **Fail loudly on a bad binding.** Throw a named error saying which role and
   what was missing. A lens that renders empty when misbound costs an hour.
   Loud means THE PANEL SAYS SO, not the application is gone: every view host
   sits behind an error boundary, so a throw draws the error's own message in
   the view's place — named with the kind and the view — and leaves the bar,
   the districts and every other view standing. Give the error a `hint`
   property and the panel prints it under the message, which is where a
   sentence about what to bind instead belongs.

4. **Mark every real thing as a target.** Anything standing for a node gets
   `data-graview-pick={id}`. That one attribute is the whole contract: the host
   routes a click on it to that node, gives it a tab stop and a role, and a
   single click selects it in place while a double click travels. A span you
   cannot click is the bug this prevents.

   **Drawing in SVG? The framework sets the role; you set the `aria-label`.**
   A `<g>`, `<polygon>`, `<circle>`, `<rect>`, `<path>`, `<ellipse>`,
   `<polyline>`, `<line>` or `<use>` carrying the mark becomes a button like
   any `<span>` — but a shape has no text inside it to be named by, so
   without a label it is a stop that announces nothing, which is worse for a
   keyboard than not being reachable at all. Name it after the thing it
   stands for.

5. **Read `implicated` and `flagged`.** Empty means "no emphasis", NOT "nothing
   is related". Expose what you decide as `data-graview-emphasis` so it can be
   checked — a claim about a picture that exists only as a colour cannot be
   checked by anything, not a test and not a person reading the tree.

6. **Render at three fidelities.** `glyph` is a chip; `summary` is denser
   content, not the same content scaled down; `full` is the picture.

7. **`nodes` is THE GROUP'S MEMBERS, and nothing else.** A lens mounted over
   a kind's `many` cell receives that kind's members in `ViewProps.nodes` —
   not the graph. Every interesting lens draws more than one kind (a board
   has slots and occupants, a matrix has rows and columns, a map has regions
   and markers), and every other kind comes from `store.graph`, narrowed back
   to `nodes` for the group's own kind so the scene's horizon still applies.
   Built from `nodes` alone, a map drew every piece of ground with nothing
   standing in it: no error, no empty state, a complete, tidy, wrong picture,
   which is the worst failure a lens has. The framework's own board lens had
   this exact bug.

8. **Give it a name when you register it.** A lens mounted over a group is
   registered on that kind's `many` cells, and the fourth argument names it:
   `registry.register("gardener", { cardinality: "many", fidelity: "full" },
   TendingView, { title: "Who tends what" })`. A titled group view is a
   PLACE — the bar and an embed's strip list it by name, press it from
   anywhere, and show it pressed while you are there. Without the title the
   lens is reachable only by focusing the group, and once someone clicks
   into a member nothing on screen says it exists.

## Roles live in two places, and they do different jobs

`defineNode("shift", { fieldRoles: { start: "from" } })` is what everything
that is NOT a lens reads: the graph's own responder answering "when is it",
the generated docs. A lens reads `bindings` and only `bindings`. Neither
overrides the other, because neither is looking at the other — so bind the
lens, and declare `fieldRoles` because the rest of the app wants them too.

`graview check` NOTES it when the two disagree about one role. Often that is
a mistake; sometimes it is right, because a role name belongs to a lens and
`fieldRoles` has one namespace for all of them: a rota means the hour a shift
starts by `start`, and its calendar means the day. Look once, then decide.

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

The checker reads `lenses` in `defineApp` and reports `lens-role-unbound`,
`lens-binding-missing-field` and `lens-binding-undeclared-kind`. Report the output.

**And prove the reuse.** This is the claim a lens exists to support, and the one
the checker cannot make for you — it NOTES every lens in `lenses` that the
framework did not ship (`lens-authored-here`) so the question gets asked out
loud, and the answer is yours. Write a test that builds it against a domain it
was not designed for:

```ts
it("works in a domain nothing here is about", () => {
  // The board lens, pointed at a seating plan.
  const built = buildBoard(nodes, edges, { slots: { kind: "seat" } }, schema);
  expect(built.empty).toEqual(["seat-4"]);
});
```

If you cannot write that test, say so plainly: you have written a view rather
than a lens, and that is a legitimate thing to have written.

## What the check cannot see

- Whether the picture is legible. Run it and look, in both schemes.
- Whether it survives being drawn small. The Graview renders the focused view
  at natural size and scales it; `pnpm shrunk` measures whether it clips.
- Whether the roles you chose generalise, or merely rename your own fields.
