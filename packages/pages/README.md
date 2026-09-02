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

- **It reads like the product's own site.** The default pages open with the thing itself —
  the installation's name and a summary in its own declared words on the front page, the
  plural and its description on a list, the record's title and its kind's `describe` on a
  record — with controls receding below the content. Typography rides the brand's display
  and body faces at a real scale; the brand's mark, name and per-kind accents (`hueFor`,
  from `@graview/core`) carry through every page. Still derivation: nothing here is a
  per-app template, and an app overrides a cell the same way it overrides a view.

The host applies `themeCss` from `@graview/primitives` (or supplies its own `--graview-*`
tokens); the default pages render entirely from those tokens.
