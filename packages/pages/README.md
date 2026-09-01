# @graview/pages

The traditional face: a routed webapp derived from the same declaration that drives the
spatial scene. From one `defineApp` — schema, mutations, invariants, permissions, op log —
this package serves lists, records, forms, problems and history as ordinary linked pages:
`/` home, `/:plural` per kind, `/:plural/:id` per node, `/problems`.

- **One store, no second path.** Pages read through the same `Store` and write through the
  same mutations with the same principal; withheld actions render disabled with their
  refusal. `recordFacts` composes the derivations the scene already uses (labels, readable
  fields, violations touching, derived affordances) — the parity tests hold a record page
  and the spatial detail to identical facts.
- **The page registry mirrors the view registry.** `(kind × page-type) → component`,
  defaults overridable per cell; the shell, home and problems pages are themselves
  registrations (`registry.surface(...)`).
- **Forms are derived.** `formFields` (in `@graview/core`) walks a mutation's zod input into
  a control tree — scalars, dates, node pickers over real candidates, nested objects,
  discriminated unions as a type picker plus that arm's fields, arrays as repeatable rows —
  and `DerivedForm` renders it. Nothing renderable is hand-written; anything unrenderable
  says so instead of hiding.
- **Two faces, one application.** Record pages link to their spatial stop
  (`spatialHref(id)`); the scene links to the pages; the ids are shared. See
  `apps/todo` for both faces mounted from one declaration (`/` scene, `/pages` routed).
- **Mobile is an acceptance criterion.** `pnpm pages` runs the phone-width harness
  (390×844): no sideways scroll, named links, labelled controls, and a derived form that
  actually applies.

The host applies `themeCss` from `@graview/primitives` (or supplies its own `--graview-*`
tokens); the default pages render entirely from those tokens.
