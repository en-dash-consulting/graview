---
name: graview-pages
description: Give a Graview app the routed face it wants — from the derived pages, to one page in the app's own words, to a product design that replaces every surface — and put the app on somebody else's page with the embed.
---

# The pages face, and the embed

A Graview app has two faces over one store. The scene is the picture. The
pages face is the same declaration routed as an ordinary web application:
a home, a list per kind, a record per node, forms for every act, and a
problems page — derived, then replaceable one surface at a time, all the way
to a product design of the app's own. This skill is the whole of that ladder,
and it ends where the framework's own example ends: `apps/seedbed`, chapter
nine (one page replaced) and chapter thirteen (every surface replaced).

## What comes for free

```tsx
// main.tsx — one branch: the path decides the face
if (location.pathname.startsWith("/pages")) {
  root.render(<PagesApp basename="/pages" context={{ store, brand, principal, sceneHref: "/" }} />);
}
```

`PagesApp` from `@graview/pages` renders, with no registry at all:

- `/` — a home that says what is here and, on an empty installation, which
  act begins it.
- `/<plural>` — a list per kind, marking trouble, with the acts that create
  the kind as forms beneath it.
- `/<plural>/<id>` — a record: its facts, its relations captioned in the
  declaration's own words (read from the end you are standing on), what can
  be done to it, and what has happened.
- `/problems` — every broken rule with its repairs.

Everything a page shows is a derivation the scene also uses: `recordFacts`,
`deriveAffordances`, `store.permits`. **A page never decides what an act is
or who may take it.** The list page strikes through a creating act the seat
may not take and says why; a page you write does the same.

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
    <PageMain context={context} data-testid="plot-page">
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

1. **`PageMain`, not `<main>`.** Inside an embed the host page owns the one
   `main`; `PageMain` renders a section there and a main on its own. A
   hand-written `main` is a duplicate landmark the moment the app is embedded.
2. **`useStoreTick(store)`** at the top of every page that reads the graph, or
   it goes stale after the first act.
3. **`pageStyles`** for the parts you did not design, so one custom page
   still reads as the same face as the derived ones.
4. **Prefill, never wire.** `DerivedForm` with `prefilled` is how a record
   page offers an act about itself. The form asks for the rest.
5. **Read permission before drawing an act.** `store.permits({ name, args },
   principal)` — draw the act struck through with `verdict.refusal.message`
   when it is not ok. A form that refuses on submit is the bug this prevents.
6. **Take the act LIST from the derivation, not from the mutations.**
   `recordFacts(store, id, { principal }).actions` is the same `AffordanceSet`
   the scene's strip reads: `affordances` are the acts that can actually act
   here, each with its `args` already decided and its `open` questions left,
   and `withheld` are the ones this seat may not take, with the reason.
   Filtering `store.allMutations()` by `subject.kinds` yourself looks
   equivalent and is not — it offers "Take it back" on a record with nothing
   attached, and a picker with no candidates in it.

   A **list** page is about a kind rather than a node, so its question is
   `kindFacts(store, kind, { principal }).actions` — the acts that can BEGIN
   this kind. Same rule, same reason: filtering by `creates` and checking
   `store.permits` answers the permission question and not the askability
   one, so "add an item for someone" is offered with nobody to hand it to,
   as a form whose picker is empty and whose submit can only refuse.

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

The shell surface receives `{ context, children }` and frames the routes.
`apps/seedbed/src/ui/design.tsx` is the worked example: an almanac with a
rail, cards, an illustrated map, and the acts as buttons that open their
forms in place. What a design must keep doing:

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
  Run `apps/todo/scripts/run-a11y.mjs`.
- **Withhold, do not hide.** `facts.actions.withheld` is the list, each entry
  carrying the policy's own sentence; draw them struck through rather than
  dropping them.
- **Offer what can act.** `facts.actions.affordances`, never your own scan of
  the mutations: the derivation drops an act whose every candidate is already
  taken and prefills the arguments the record itself decides. On a list page
  that is `kindFacts(store, kind).actions`.

## The embed

`@graview/embed` mounts an app into any element on any page: its own theme
scoped to the element, fonts, a strip with the faces and the named places,
no Shell chrome.

```ts
import { mount } from "@graview/embed";
const handle = mount(el, { app, seed, stop: "#focus=agg:plot", principal, views, pages, label: "Chapter 13" });
handle.setFace("pages"); handle.setStop("#focus=plot-2"); handle.unmount();
```

- `face` is inferred from the stop and `scheme` from the host page; pass
  either to override. `label` names the landmarks, so two embeds are two
  regions with two names.
- `mountWhenNear(elements, mountOne)` mounts many embeds as a reader scrolls
  near them. The strip shows the app's named places (`graview-lens`, step 7).

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js   # the declaration is still whole
pnpm test                                               # render every page you registered
```

Render each registered page with `PagesApp` and `initialPath` in a test, as
`apps/seedbed/tests/integration/chapters.test.ts` does for chapter thirteen:
assert your own `data-testid`s are there and the derived face's
`aria-label="Kinds"` is not. Then open it: a design that passes its tests
and reads like an admin panel has not replaced anything.

## What the check cannot see

- Whether the design's words are the domain's. The derived pages use the
  declaration's `description` and `inverse`; a design that writes its own
  sentences must keep them true as the declaration changes.
- Whether a page still offers everything the seat may do. A design that lists
  acts by NAME will miss the one declared after it was written, and one that
  lists them by scanning the mutations will offer acts that cannot act.
  `facts.actions` is neither, and is the only list that stays right on its
  own — but only a person can see whether the page gives them room.
