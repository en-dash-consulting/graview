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

The framework ships five, each built from the public primitives — which makes
them the worked example of the authoring API rather than privileged insiders.
Read one before writing your own:

- `packages/primitives/src/lens/timeline.tsx` — intervals in columns
- `packages/primitives/src/lens/calendar.tsx` — the same intervals, by date
- `packages/primitives/src/lens/coverage.tsx` — a bipartite mapping
- `packages/primitives/src/lens/board.tsx` — position given by the domain
  (discs for codes of three characters, tokens for words; `arrange: "shelf"`
  when the x and y are categories rather than coordinates)
- `packages/primitives/src/lens/plan.tsx` — an outline, with points inside it

(`reach.tsx` sits beside them and is not one: no factory, no roles to
rebind. A view that ships is still a view.)

The plan is the one to read if yours draws anything, because it is the one
that learned what drawing costs. A name is fitted to the shape it names —
`fitLabel` and `spanAt` from `@graview/layout`, which give the width of a
shape AT A HEIGHT rather than its bounding box, because the shapes that
overflow are the long thin ones. Names are painted after everything else,
because a marker dot took the first letter off two of them. Whatever will
not fit goes in a key underneath. And `useDrawnSize` answers the question a
scalable drawing hides: at THIS size, can a person read it, or press it? A
one-pixel target with a keyboard stop and an ARIA label is not an accessible
control; it is an inaccessible one that has been described.

Start it with the scaffolder — `graview lens grounds-map --roles regions,markers
--binds entities` — which writes all eight rules below already in place, and
the reuse test beside it, red on purpose.

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
     A relationship that IS a node — a concern addressed by a practice,
     applied by a routine, covering a ground — binds
     `link: { path: ["covers", "applies", "addresses"] }`, column end first;
     each cell then carries the nodes it walked through, which is what you
     actually want to press.

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

   **`budget` is the most to draw.** A drive-in thumbnail hands a lens its 12
   most relevant members with `budget` and `total`: hold what you read from
   the store to it too, and say "+N more" (`withMore` does). A real catalogue
   is thousands; a lens that draws them all at 6% stalls the city.

8. **Take an arrangement, and say what you have no place for.** Every
   picture over a kind can be sorted, filtered and grouped from the
   declaration alone — `arrangeable(schema, kind)` offers the fields by
   type, the edges by far end, the lifecycle and the standing — and the
   choice travels in the stop as `in.sort`, `in.filter`, `in.group` and
   `in.q`, beside the calendar's own `in.at`. In your lens's component:

   ```tsx
   const { nodes, arranged, bar } = useArranging(props, {
     lensAllows: { group: false },        // a board has nowhere to group
     allow: options.arranging,            // the app's say: false, or per part
     arrangedBy: options.arrangedBy,      // how the picture opens
   });
   return <>{bar}<Picture nodes={nodes} /></>;
   ```

   `bar` is the framework's own row (`ArrangeBar`), drawn at full fidelity
   unless declined; `nodes` are the members as arranged; `arranged.groups`
   are there when the picture has a place for headings, as the calendar's
   agenda does. Declare `arrangedBy` on the app's `lenses` entry too, in the
   grammar (`{ group: "held-at" }`), so `graview check` holds it to the
   bound kind and `graview describe` can say it. A person who arranged the
   list can ask your picture the same thing in the same words.

9. **Declare a shipped lens; register only your own.** A `lenses` entry
   with a `title` is a PLACE the framework draws with no registration — a
   pill, a drive-in, a page at `/places/<as>`:
   `{ name: "calendar", title: "The month", bindings: { task: { start: "due" } }, options: { range: "month" } }`.
   A status board: `{ name: "columns", title: "The board", bindings: { task:
   { column: "status" } } }`; a card moves only by an act that sets `status`.
   `on` names the kind when the bindings do not (reach; a coverage over its
   columns), and `options` are data (`SHIPPED_LENSES[name].options`). A lens
   you wrote is registered with a title as the fourth argument:
   `.register("gardener", { cardinality: "many", fidelity: "full" }, View, { title: "Who tends what" })`.
   Untitled, it is reachable only by focusing the group.

10. **Before writing a picture, try blocks.** `{ name: "blocks", title:
   "What we heard", on: "signal", options: { blocks: [{ list: "all('signal')",
   group: "type", as: "row" }] } }` is a place drawn from the closed block set
   (headline, figure, list — `graview-node-kind`), each record by its own row
   or card. Nothing in it runs; a chat can write it. Write code only for what
   blocks cannot say: a meter, a grid of cells, positions.

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
`lens-binding-missing-field` and `lens-binding-undeclared-kind` — and, for a
titled lens that cannot draw, why, at its path (`lens-cannot-draw`,
`lens-option-unknown`, `lens-title-taken`); `graview describe` lists the
places that draw. Report the output.

**And prove the reuse.** This is the claim a lens exists to support, and the one
the checker cannot make for you — it NOTES every lens in `lenses` that the
framework did not ship (`lens-authored-here`) so the question gets asked out
loud, and the answer is yours. Write a test that builds it against a domain it
was not designed for, then point at it with `provenBy: "tests/lens-reuse.test.ts"`
and the note stands down:

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
