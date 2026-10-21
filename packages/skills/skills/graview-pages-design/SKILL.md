---
name: graview-pages-design
description: Give a Graview app a product design over its routed face — its own shell under the one bar, every surface replaced, its tabs lit from the section a kind's pages are in, and a trail that says where a person is — and verify it by rendering each page and opening it, rather than assuming the derived pages are gone.
---

# A product design over the pages face

`graview-pages` takes the routed face from derived to one page in the app's
own words. This is the rung after: the registry's three surfaces and two
page types, all replaced, read as a product rather than an admin panel.

```tsx
createPageRegistry<S, PageComponent<S>>(schema)
  .surface("shell", Shell)        // the design's own, under the bar
  .surface("home", Home)
  .surface("problems", Problems)
  .register("plot", "list", Plots).register("plot", "record", PlotRecord)
  .register("gardener", "list", Gardeners).register("gardener", "record", GardenerRecord)
  .section(["plot", "planting"], "The grounds", { path: "/places/the-grounds" })
  // ... every kind
```

The shell surface receives `{ context, children }`. `apps/todo/src/ui/design.tsx` is the finished
example: all a person tries there works: sort, filter and group come from `ArrangeBar` and live
in `useSearchParams` in the shared words (a list you arranged is a link); a record edits where it is
shown, heading included, through `editableFields(store, id)`; an act's form
opens where the act is, prefilled, with the store's own refusal said at the
press; the problems page is an inbox, its repairs ordered by
`rankedRepairs`; and every empty state offers the way out of itself.
`apps/seedbed/src/ui/design.tsx` is the other end: an almanac drawn on the
page and in the scene's lens from one model.

## Where a person is

A design usually replaces some pages and leaves the rest derived, and a
person who follows a link into a derived page must still know where they
are. The face says it; a design never rebuilds it by matching
`pluralSlug` against the path.

- **`registry.section(kinds, label, { path })`** names the part of the app
  a kind's pages belong to — its list, its records, its pictures — as the
  design's own tabs name it. `path` is the section's own page,
  basename-relative; without one the trail says the section and links
  nowhere. `registry.sectionOf(kind)` reads it back.
- **`usePlaceHere()`**, in anything `PagesApp` draws (the shell, a page, a
  route): `{ as: "home" | "list" | "record" | "place" | "page", kind?, id?,
  label, section?, trail: [{ label, href?, path?, current? }] }`. Light a
  tab from `section` (or `kind`), draw a title from `label`. Each step's
  `href` carries the face's base; `path` is basename-relative, for
  `<Link to>` and `navigate()`.
- **`placeHere(context, path, { registry, base })`** says the same of a path
  for a bar drawn OUTSIDE the face's router, told where it is by
  `steering.at` or `onNavigate`.
- **Its own tabs, in the arrangement's order.** `arrangedEntries(kinds,
  pages.order, views.places())` (`@graview/core`) is the kinds' lists with
  a host's view named `view:<name>` at its place among them; leave out a
  kind `pages.hide` names unless it is where the person is.
- **The trail.** Each derived list, record and picture opens with one: a
  `nav` called "You are here", the section and the kind's list as links,
  the page itself last with `aria-current="page"`, out of sight because
  the heading says it. A list with no section draws none. A shell that
  places `<PageTrail />` puts THE trail there and the derived pages draw
  none at their heads; one that draws its own from `usePlaceHere()` says
  `surface("shell", Shell, { without: ["trail"] })`.

## Find and the way back, in the design's bar

Both are the face's, whichever shell draws it: a shell that places
`<PageFind>` or `<PageUndo>` says where they go, else they are drawn around
it (Find in a bar above, the way back docked at the corner), and
`surface("shell", Shell, { without: ["find", "undo"] })` goes without.

```tsx
<nav className="my-bar">
  <PageFind context={context} narrowsLists={false} size="sm" className="my-find" />
  <PageUndo context={context} compact size="sm" className="my-undo" />
</nav>
```

- **`compact`** is the arrow and "Undo": what it takes back ("Take back
  “Rename to …”") is its accessible name and its title. Uncompact, the
  sentence is cut at 18rem (`--graview-undo-widest`), whole in its title.
- **`size`**: `"sm"` (30 px, the app bar's tools), `"md"` (36 px), or the
  bar's own height — a number of pixels or a CSS length — said as
  `--graview-control-height`.
- **`className`** goes on Undo's button and on Find's form (its box is
  `.graview-find-box`). Their own look is rules behind `:where`, so one
  class of the design's outweighs it: never `!important`, never a CSS
  `::after` over Undo's words.

## What every design must keep doing

- **Read the graph through one model.** `readGarden(store)` turns nodes,
  edges and violations into the design's words; every page reads it and none
  reaches for `store.graph`. The scene's lens reads the same model.
- **Take the act list from the derivation.** `recordFacts(store, id, {
  principal }).actions` and `kindFacts(store, kind, …).actions`, never a
  scan of `store.allMutations()`; `withheld` are struck through with the
  policy's sentence (`store.permits` says the same at the press), not dropped.
- **Style through the theme's tokens** (`--graview-ground`, `-panel`, `-ink`,
  `-edge`, `-warn`, `-accent`, `-font-display`, `-font-body`), tinted with
  `color-mix` for the design's own paper. Never a color that works in one
  scheme only — nor a logo: `<AppMark brand={context.brand} />` draws the
  brand's, the dark one in the dark (`graview-logo`).
- **Keep landmarks and targets honest.** One `main` — a `section` when
  `context.embedded`, and UNNAMED, or a page holding two embeds has two
  regions with one name. Controls at least 24px, AA contrast.
  Every size in `rem`: at 200% text a flex or grid item's automatic minimum
  is its CONTENT's, so one un-wrappable row pushes the whole column off the
  screen — `minmax(0, 1fr)` and `min-width: 0` on the column, `flex-wrap` on
  the row. Measure rather than trust: `-ink-faint` fails AA on an 11px
  label, and the accent fails on the warning ground. `node
  scripts/verify-pages.mjs` runs axe over every route, both widths, both
  schemes.
- **Say where a person is on every page, derived or not**, as above — one
  trail, not one from the design and one from the face.

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js   # the declaration is still whole
pnpm test                                               # render every page you registered
```

Render each registered page with `PagesApp` and `initialPath` (and the
`basename` it ships under) in a test, and assert what `usePlaceHere()`
says there and that one `nav[aria-label="You are here"]` is drawn
(`apps/seedbed/tests/integration/chapters.test.ts`). Then open it: a design
that passes its tests and reads like an admin panel has replaced nothing.

## What the check cannot see

- Whether the design's words are the domain's. The derived pages use the
  declaration's `description` and `inverse`; a design that writes its own
  sentences must keep them true as the declaration changes.
- Whether a section's label is the one a person would look for: the trail
  says what the registry says.
- Whether a page gives every act `facts.actions` offers room: only a person
  can see that.
