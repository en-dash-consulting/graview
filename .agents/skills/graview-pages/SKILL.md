---
name: graview-pages
description: Give a Graview app the routed face it wants — from the derived pages, to one page in the app's own words, to a product design that replaces every surface — and put the app on somebody else's page with the embed.
---

# The pages face, and the embed

A Graview app has two faces over one store. The scene is the picture. The
pages face is the same declaration routed as an ordinary web application:
a home, a list per kind, a record per node, forms for every act, and a
problems page — derived, then replaceable one surface at a time, all the way
to a product design of the app's own. The ladder ends where the framework's
own example does: `apps/seedbed`, chapter nine (one page replaced) and
chapter thirteen (every surface).

## What comes for free

```tsx
// main.tsx — one branch: the path decides the face
if (location.pathname.startsWith("/pages")) {
  root.render(<PagesApp basename="/pages" context={{ store, brand, principal, sceneHref: "/" }} />);
}
```

`PagesApp` from `@graview/pages` renders, with no registry at all:

- `/` — a home saying what is here, and on an empty installation which act
  begins it.
- `/<plural>` — a list per kind, marking trouble, with the creating acts
  beneath it.
- `/<plural>/<id>` — a record: its facts, its relations captioned in the
  declaration's own words (from the end you stand on), what can be done, and
  what has happened.
- `/problems` — every broken rule with its repairs.

Everything a page shows is a derivation the scene also uses: `recordFacts`,
`deriveAffordances`, `store.permits`. **A page never decides what an act is
or who may take it** — it strikes through what the seat may not take, and
says why.

## Rung one: a page in the app's own words

`createPageRegistry(schema)` replaces pages per kind and surfaces per app:

```tsx
import { createPageRegistry, DerivedForm, kindFacts, PageMain, pageStyles, recordFacts, spatialHref, useStoreTick } from "@graview/pages";

function PlotPage({ context }: { context: PageContext<S> }) {
  const { store, principal } = context;
  useStoreTick(store);                                   // re-render on every op
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, { principal });   // the same derivations
  return (
    <PageMain context={context}>
      <h1 style={pageStyles.h1}>{facts.label}</h1>
      <a href={spatialHref(id)}>See it in the scene ↗</a>
      <DerivedForm store={store} mutation={sow} prefilled={{ plotId: id }} />
    </PageMain>
  );
}

export const pages = createPageRegistry<S, PageComponent<S>>(schema)
  .register("plot", "record", PlotPage);
```

Rules for a page at this rung:

1. **`PageMain`, not `<main>`** — inside an embed the host owns the one
   `main`, and a hand-written one is a duplicate landmark.
2. **`useStoreTick(store)`** at the top of every page that reads the graph,
   or it goes stale after the first act.
3. **`pageStyles`** for the parts you did not design, so one custom page
   still reads as the same face as the derived ones.
4. **Prefill, never wire.** `DerivedForm` with `prefilled` is how a record
   offers an act about itself; the form asks for the rest.
5. **Read permission before drawing an act.** `store.permits({ name, args },
   principal)`, struck through with `verdict.refusal.message` when not ok. A
   form that refuses on submit is the bug this prevents.
6. **Link to a PICTURE, not only to a node.** `spatialHref(id)` opens the
   scene on one thing; `placeHref(as)` — `/#view=the-grounds`, the title
   through `placeSlug` — opens it on one named place, group in focus. A link
   that lands on the default view and says "press The grounds" is the
   pasted-link problem one rung up.
7. **Take the act LIST from the derivation, not from the mutations.**
   `recordFacts(store, id, { principal }).actions` is the same `AffordanceSet`
   the scene's strip reads: `affordances` are the acts that can actually act
   here, each with its `args` already decided and its `open` questions left,
   and `withheld` are the ones this seat may not take, with the reason.
   Filtering `store.allMutations()` looks equivalent and is not: it offers
   "Take it back" on a record with nothing attached, and a picker with no
   candidates. A **list** page asks it of a kind instead —
   `kindFacts(store, kind, { principal }).actions`, the acts that can BEGIN it.

## Rung two: a product design

The registry has three surfaces and two page types, and replacing all of them
is a product:

```tsx
createPageRegistry<S, PageComponent<S>>(schema)
  .surface("shell", Shell)        // the frame around every route: nav, masthead, standing
  .surface("home", Home)
  .surface("problems", Problems)
  .register("plot", "list", Plots).register("plot", "record", PlotRecord)
  .register("gardener", "list", Gardeners).register("gardener", "record", GardenerRecord)
  // ... every kind
```

The shell surface receives `{ context, children }`. Two worked examples. `apps/todo/src/ui/design.tsx` is the FINISHED one, and
what makes it finished is not the type — it is that everything a person
tries there works: the grouping, sort and filter live in `useSearchParams`
(a list you arranged is a link you can send); a record edits where it is
shown, heading included, through `editableFields(store, id)`; an act's form
opens where the act is, prefilled, with the store's own refusal said at the
press; the problems page is an inbox, its repairs ordered by
`rankedRepairs`; and every empty state offers the way out of itself.
`apps/seedbed/src/ui/design.tsx` is the other end — an almanac whose own
drawing has two homes, the page and the scene's lens reading one model.

What every design must keep doing:

- **Read the graph through one model.** `readGarden(store)` turns nodes,
  edges and violations into the design's words; every page reads it and none
  reaches for `store.graph` alone. The scene's lens reads the same model —
  chapter thirteen's map is one drawing with two homes.
- **Style through the theme's tokens** (`--graview-ground`, `-panel`, `-ink`,
  `-edge`, `-warn`, `-accent`, `-font-display`, `-font-body`), tinted with
  `color-mix` for the design's own paper. Never a colour that works in one
  scheme only; the design then wears both schemes and the brand's typefaces.
- **Keep landmarks and targets honest.** One `main` (a `section` when
  `context.embedded`, and an UNNAMED one — the embed has already made a
  region carrying the name the page gave it, so naming this one as well puts
  two regions with the same name on any page holding two embeds of the
  design). Controls at least 24px tall, AA contrast on the tinted ground.
  Every size in `rem`: at 200% text a flex or grid item's automatic minimum
  is its CONTENT's, so one un-wrappable row pushes the whole column off the
  screen — `minmax(0, 1fr)` and `min-width: 0` on the column, `flex-wrap` on
  the row. Measure rather than trust: `-ink-faint` fails AA on an 11px
  label, and the accent fails on the warning ground. `node
  scripts/verify-pages.mjs` runs axe over every route, both widths, both
  schemes.
- **Withhold, do not hide.** Rule 7 again, at every surface: struck through
  with the policy's own sentence rather than dropped.

## The embed

`@graview/embed` mounts an app into any element on any page: its own theme
scoped to the element, fonts, a strip with the faces and the named places,
no Shell chrome.

```ts
import { mount } from "@graview/embed";
const handle = mount(el, { app, seed, stop: "#focus=agg:plot", principal, views, pages, label: "Chapter 13" });
handle.setFace("pages"); handle.setStop("#focus=plot-2"); handle.unmount();
```

- `face` is inferred from the stop and `scheme` from the host page; `label`
  names the landmarks, so two embeds are two regions with two names.
- `mountWhenNear(elements, mountOne)` mounts many as a reader scrolls near
  them. The strip shows the app's named places (`graview-lens`, step 7).

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js   # the declaration is still whole
pnpm test                                               # render every page you registered
```

Render each registered page with `PagesApp` and `initialPath` in a test —
`apps/seedbed/tests/integration/chapters.test.ts` does — asserting your own
`data-testid`s. Then open it: a design that passes its tests and reads like
an admin panel has not replaced anything.

## What the check cannot see

- Whether the design's words are the domain's. The derived pages use the
  declaration's `description` and `inverse`; a design that writes its own
  sentences must keep them true as the declaration changes.
- Whether a page still offers everything the seat may do. Listing acts by
  NAME misses the one declared after it was written; scanning the mutations
  offers acts that cannot act. `facts.actions` is neither — but only a
  person can see whether the page gives them room.
