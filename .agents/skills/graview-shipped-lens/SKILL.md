---
name: graview-shipped-lens
description: Declare one of the lenses Graview ships — a calendar, a status board, a coverage, a timeline, a board, a plan, a blocks place — as a titled place with its bindings and options, and read what graview check and add-lens refuse (an option the lens does not take, a lens that cannot draw, a title taken) rather than drawing a lens that quietly ignores a key.
---

# Declare a shipped lens

Most pictures an app wants are already written. A `lenses` entry with a
`title` is a PLACE the framework draws with no registration — a tab, a
name on its district, a page at `/places/<as>`:

```ts
lenses: [
  { name: "calendar", title: "The month", bindings: { task: { start: "due" } }, options: { range: "month" } },
  { name: "columns", title: "The board", bindings: { task: { column: "status" } }, options: { cap: 50 } },
]
```

Writing a lens of your own, one that binds roles so another domain can
reuse it, is `graview-lens`. **Declare before you write**: a shipped lens
is data, so a document, a chat and `add-lens` can all say it.

## The lenses and what each takes

`options` are data, and each lens takes only its own
(`SHIPPED_LENSES[name].options` on `@graview/core`); read that table
rather than guessing a key:

| Lens | Binds | Roles | Options |
|---|---|---|---|
| `timeline` | fields | `start`, `end` | `columns`, `extent`, `tick`, `minWindow`, `arranging` |
| `calendar` | fields | `start` | `today`, `range`, `weekStartsOn`, `perCell`, `horizon`, `arranging`, `search`, `filters` |
| `columns` | fields | `column` | `sort`, `search`, `filters`, `move`, `collapsed`, `cap`, `hidden` |
| `coverage` | entities | `rows`, `columns`, `link` | `rowRef`, `rowGroup`, `groupOrder`, `requiredGroups`, `requiredVia`, `badge`, `columnGroup`, `sort`, `columnSort`, `search`, `filters` |
| `board` | entities | `slots`, `x`, `y`, `fill` | `fillFrom`, `slotCode`, `zones`, `aspect`, `emptyLabel`, `pickTarget`, `arranging`, `arrange` |
| `plan` | entities | `regions`, `outline` | `hues`, `aspect`, `undrawnLabel`, `strayLabel`, `draw`, `place`, `help` |
| `reach` | nothing | — | — |
| `blocks` | nothing | — | `blocks` |

A **fields** lens binds a kind's own fields onto its roles (`bindings: {
task: { start: "due" } }`); an **entities** lens binds roles onto whole
kinds and edges (`{ rows: { kind: "skill" }, columns: { kind: "person" },
link: { edge: "develops" } }`). `on` names the kind a place stands on
when the bindings do not (reach; a coverage over its columns).

- **A status board** (`columns`) draws a kind's records in columns by one
  choice field, in its declared order. A card moves only by an act
  setting that field (`book` where its `allowedWhen` holds): dragged,
  carried by the keyboard (Space, arrows, Space) or from its menu's "Move
  to ›". `search` names the fields Find looks in (past 20 cards Find
  shows unasked), `filters` the chips, `collapsed` columns open shut,
  `hidden` ones are not drawn, `cap` keeps each column to its newest
  (1 to 500), and `move: true` puts a Move button under each card.
- **A calendar** opens at `range` — `day`, `week`, `month`, `quarter`,
  `year`, `years` or `agenda` — on `today` (`"YYYY-MM-DD"`, else the day
  it is drawn). `range: "years"` with `horizon: { years: 30, title: "The
  career" }` spans its records, first to last, as well as `years` from
  `today`; `from` and `to` (years: 1962, 2023) pin its ends.
- **A timeline** needs columns: named in `columns`, or read from the
  choices of the field its `column` role is bound to.
- **A coverage**'s `sort` orders its rows and `columnSort` its columns;
  a status board's `sort` orders its cards: a field or `{ by, direction }`,
  `label` the name, held to the kind. A coverage with no columns, or no
  link over its relation, says so ("No genres yet: link songs to
  genres.") and lists no rows.
- **A blocks place** is drawn from the closed block set (headline,
  figure, list — `graview-view-specs`), each record by its own row or card:
  `{ name: "blocks", title: "What we heard", on: "signal", options: {
  blocks: [{ list: "all('signal')", group: "type", as: "row" }] } }`.
  Nothing in it runs; a chat can write it. Write code only for what
  blocks cannot say: a grid of cells, positions.

Any titled place may say `create: false` when it is read, not written (its
page drops the forms that add one), `hidden: true` to keep it off the
lists while it stays a link target, and `arrangedBy` in the grammar
(`{ group: "held-at" }`) for how it opens, held to the bound kind.

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

The checker holds every titled lens and says, at its path, what it will
not draw and what it ignores:

- `lens-option-unknown` — a key the lens does not take, in one sentence and
  its fix: "The columns lens takes no option "shade", so "Work" ignores
  it." / "Use one of: sort, search, filters, move, collapsed, cap,
  hidden." A declaration carrying one still compiles, with the warning;
  **`add-lens` refuses it** at `edits.<i>.options.<key>`, and a change
  sent as a JSON patch or a whole document is judged by
  `lensOptionsRefused(stored, proposed)` (`@graview/core/document`): an
  error for each such key the same lens did not already carry.
- `lens-cannot-draw` — it binds no kind, its board's column field is not a
  choice, its timeline has no columns, its calendar's `today` is not a
  date or its `range` not one it opens at, it stands on what is not a
  kind, or its title has nothing to make an address of.
- `lens-not-shipped` — a title on a lens the framework does not draw;
  `lens-title-taken` — two pictures on one kind under one title;
  `lens-options-not-an-object`, `lens-sort`, `lens-horizon`, `lens-create`
  and `lens-hidden-untitled` say the rest.
- The bindings themselves: `lens-role-unbound`, `lens-binding-missing-field`
  and `lens-binding-undeclared-kind`.

`graview describe` lists the places that draw. Report the output, then open
each place on both faces and look.

## What the check cannot see

- Whether the place is the right picture. A calendar of what has no date
  that matters, or a board over a field nobody moves, draws without a
  finding; open it and ask whether a person would reach for it.
- Whether its options read well. `cap`, `collapsed` and `sort` are held to
  the kind, not to what a person needs first; look at it full.
- Whether a card can be moved by the seat who needs to. The board moves by
  the acts the seat may run; sit as them and try it (`graview-permissions`).
