# @graview/pages

The traditional face: a routed webapp derived from the same declaration that drives the
spatial scene. From one `defineApp` — schema, mutations, invariants, permissions, op log —
this package serves lists, records, forms, problems and history as ordinary linked pages:
`/` the gallery, `/:plural` per kind, `/:plural/:id` per node, `/places/:as` per picture,
`/map` the relations, `/problems`.

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
- **One bar, and the scene a place.** The shell is the one app bar (FR-131): the app's mark
  and name — the page's one heading, the way home — its places as tabs (the overview, each
  picture, each kind's list, the connections; "More" for what the row cannot hold), and Find,
  the standing and the person. The overview is the scene (FR-132), at `sceneHref` on a face
  that owns its page; a record and a picture say "On the overview ↗", to their stop there.
  Under an embed's bar (`barAbove`) the shell draws none of it, and the face's Find goes in
  that bar. Each page's own title is said a level under the app's name (`titleLevel`). See
  `apps/todo` for both mounted from one declaration (`/` scene, `/pages` routed).
- **The host may own the history.** `basename` mounts the face under a path;
  `onNavigate(path, how)` tells a host each page the face opens (`"push"`,
  `"replace"` or `"pop"`), and `path` sends it back to one, so a host that
  keeps its own history keeps the face's too.
- **Mobile is an acceptance criterion.** `pnpm pages` runs the phone-width harness
  (390×844): no sideways scroll, named links, labelled controls, and a derived form that
  actually applies.

- **It lands on a gallery.** The home opens with the standing as its headline — "2 gardeners,
  3 plots and 1 planting.", or "Nothing here yet." and which act begins it — then every
  picture the app has as a large live card, two across at a desk and one on a phone: the
  lens itself, drawn inert at a scale measured from the card, captioned with its name and how
  much it is over. Handed the scene's view registry (`views` in the context), every titled
  lens is a page at `/places/<as>` and a card on the home; a kind with no titled lens is
  drawn anyway, as a contact sheet of its members, so a new app lands on a gallery on its
  first afternoon. The kinds follow as one row of counts, the relations as one line that
  opens `/map` ("Connections"), and Recently stays short at the foot. The app bar is one row
  on a desk and two on a phone; a new address opens at its top. How many problems there are
  is said once, by the bar's standing; the home says only that rules are broken and links
  to what would fix them.
- **It reads like the product's own site.** A list opens with the plural and its
  description, a record with its title and its kind's `describe`, controls receding below
  the content. Typography rides the brand's display and body faces at a real scale; the
  brand's mark, name and per-kind accents (`hueFor`, from `@graview/core`) carry through
  every page. Still derivation: nothing here is a per-app template, and an app overrides a
  cell the same way it overrides a view.

The host applies `themeCss` from `@graview/primitives` (or supplies its own `--graview-*`
tokens); the default pages render entirely from those tokens.
