# graview-pages

`graview-pages` is one of Graview's 26 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Give a Graview app the routed face it wants — from the derived pages, to one page in the app's own words, to a product design that replaces every surface.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## The pages face

A Graview app has two faces over one store. The scene is the picture. The pages face is the same declaration routed as an ordinary web application: a home, a list per kind, a record per node, forms for every act, and a problems page — derived, then replaceable one surface at a time, up to a product design of its own. The ladder ends at the framework's own example: `apps/seedbed`, chapters nine and thirteen.

### What comes for free

```tsx
// main.tsx — one branch: the path decides the face
if (location.pathname.startsWith("/pages")) {
  root.render(<PagesApp basename="/pages" context={{ store, brand, principal, sceneHref: "/" }} />);
}
```

`PagesApp` renders with no registry at all:

- `/` — a GALLERY. The standing as the headline ("2 gardeners, 3 plots and 1 planting." or "Nothing here yet."), then every picture as a large live card, the kinds as a row of counts, a line to the map, and Recently. A kind with no titled lens gets a contact sheet of its members, so a new app lands on a gallery. An empty picture names the act that fills it.
- `/<plural>` — a list per kind, marking trouble, its creating acts beneath.
- `/<plural>/<id>` — a record: its facts, changed where they stand, its relations in the declaration's words, what can be done, what happened.
- `/problems` — every broken rule, with repairs.

The app bar, one row over any shell (`barAbove`): the name, the switch (Scene, Pages; `pages: { scene, pages }` renames them), the place you are on — whose list holds the home, the Lists, the Pictures (standing on a wide bar, else under More, as an empty kind is) — Find, standing, person. A shell with a rail of its own says `surface("shell", Shell, { without: ["places"] })`: the bar keeps all that and names no place.

**Arrange it, declared**: `pages: { order: ["offer", "package"], hide: ["party"], first: "The offers" }`. `order` sorts gallery, nav, city; `hide` drops kinds from the home only; `first` (place, kind or `"home"`) is where a new visit lands; a drawn home stays Home, on the bar and at `/`. `primary` stands on the bar. `placesOf(app)` (`/seat`) lists them. A lens only a home links to may be `hidden: true` (set-lens-hidden): off the bar and the page list, still at its address.

**Home as data** (FR-81): `home`, blocks as in `graview-view-specs` (`views.home`), replaces this body, and the app opens on it (FR-136): 40 blocks at its top (a group is one; 120 in all), and a `figure` may say `emphasis: "large"`.

**Hand it `views`** (the scene's registry, plus `settings`/`presence`) — `graview create` does — and the face puts the scene's provider under its routes:

- `/places`, `/places/<as>` — every named lens as a page (fullscreen, over the kind's members, the beginning acts beneath unless the lens says `create: false`). A kind's page lists its pictures; a pick in a lens travels to the record. A kind's own row (one × glyph) is each line of its list, and its own page view (one × full) heads its record.
- `/map` — `kindMap(store)`: every declared relation in its words with its live count, also a section on the home page. A kind's list says what it relates to, arranged in the shared words (`?sort=due:desc`, `?filter=done:false`, `?group=due:month`, `?q=tape`) a lens carries in its fragment, so an arrangement is a link; `?by=`, `?<edge>=<id>`, `?with=` and `?past=1` still land. A record links back.
- `/search?q=` — the Find box's matcher: hits by kind, each with why; a nav box narrows a list, else lands here. Find and the way back ("Take back “…”", ⌘Z) are on every face: a shell places `<PageFind>` or `<PageUndo>` where it wants them, else they are drawn around it (`without: ["find"]` goes without).
- **The quick ask** (⌘K, where `ai` gives a model): a bar and answer card by the page's heading, the ROUTE what "this" means. `context.quickAsk: false` draws none.

Everything a page shows is a derivation the scene uses too: `recordFacts`, `deriveAffordances`, `store.permits`. **A page never decides what an act is or who may take it** — it strikes through what the seat may not, and says why. A record's facts, `computed` ones too, read in declared order or as the kind's `display.page` groups them; prose keeps its paragraphs, full width.

**On a phone this face is the answer.** `Shell` carries `pagesHref`.

### Rung one: a page in the app's own words

`createPageRegistry(schema)` replaces pages per kind and surfaces per app:

```tsx
import { createPageRegistry, DerivedForm, kindFacts, PageMain, pageStyles, recordFacts, SceneLink, useStoreTick } from "@graview/pages";

function PlotPage({ context }: { context: PageContext<S> }) {
  const { store, principal } = context;
  useStoreTick(store);                                   // re-render on every op
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, { principal });   // the same derivations
  return (
    <PageMain context={context}>
      <h1 style={pageStyles.h1}>{facts.label}</h1>
      <SceneLink context={context} stop={`#focus=${id}`} />
      <DerivedForm store={store} mutation={sow} prefilled={{ plotId: id }} />
    </PageMain>
  );
}

export const pages = createPageRegistry<S, PageComponent<S>>(schema)
  .register("plot", "record", PlotPage)
  .route("/survey", SurveyDesk);   // about nothing in the schema
```

**Claim a declared block, keep the rest.** A block may say `"key": "rewrites"` (unsaid, its sort and place: `list.2`); `<BlockSlots.Provider value={{ "change.page": { rewrites: Timeline } }}>` draws yours for it and every other block as declared; a blocks lens is claimed by its address (`"the-offers"`). Never pick a block by its title's words.

`.route(path, Component)` gives a page that is NOT about a kind an address — onboarding, settings, import — matched before `/:plural`. **Every `to` is basename-relative** (`to="/survey"`, never `to="/pages/survey"`), and so is `initialPath`, so a test renders the hrefs a browser will.

Rules for a page at this rung:

1. **`PageMain`, not `<main>`** — inside an embed the host owns the one `main`, and a hand-written one is a duplicate landmark.
2. **`useStoreTick(store)`** at the top of every page that reads the graph, or it goes stale after the first act.
3. **`pageStyles`** for the parts you did not design: one face, derived or not.
4. **Prefill, never wire.** `DerivedForm` with `prefilled` is how a record offers an act about itself; the form asks for the rest.
5. **Read permission before drawing an act.** `store.permits({ name, args }, principal)`, struck through with `verdict.refusal.message`. A form that refuses on submit is the bug this prevents.
6. **Link to a PICTURE, not only to a node.** `spatialHref(id)` opens the scene on one thing; `placeHref(as)` (`/#view=the-grounds`) on one named place. A scene not at `/`: set `sceneHref` in the PagesApp context; both take it second.
7. **Take the act LIST from the derivation, not from the mutations.** `recordFacts(store, id, { principal }).actions` is the `AffordanceSet` the scene's strip reads: `affordances` can act here, `args` decided and `open` questions left; `withheld` are this seat's refusals, with the reason. `store.allMutations()` offers acts with nothing to act on. A **list** page asks it of a kind instead — `kindFacts(store, kind, { principal }).actions`, the acts that can BEGIN it.

### Rung two: a product design

The registry has three surfaces and two page types, and replacing all of them is a product:

```tsx
createPageRegistry<S, PageComponent<S>>(schema)
  .surface("shell", Shell)        // the design's own, under the bar
  .surface("home", Home)
  .surface("problems", Problems)
  .register("plot", "list", Plots).register("plot", "record", PlotRecord)
  .register("gardener", "list", Gardeners).register("gardener", "record", GardenerRecord)
  // ... every kind
```

The shell surface receives `{ context, children }`. `apps/todo/src/ui/design.tsx` is the finished example: all a person tries there works: sort, filter and group come from `ArrangeBar` and live in `useSearchParams` in the shared words (a list you arranged is a link); a record edits where it is shown, heading included, through `editableFields(store, id)`; an act's form opens where the act is, prefilled, with the store's own refusal said at the press; the problems page is an inbox, its repairs ordered by `rankedRepairs`; and every empty state offers the way out of itself. `apps/seedbed/src/ui/design.tsx` is the other end: an almanac drawn on the page and in the scene's lens from one model.

What every design must keep doing:

- **Read the graph through one model.** `readGarden(store)` turns nodes, edges and violations into the design's words; every page reads it and none reaches for `store.graph`. The scene's lens reads the same model.
- **Style through the theme's tokens** (`--graview-ground`, `-panel`, `-ink`, `-edge`, `-warn`, `-accent`, `-font-display`, `-font-body`), tinted with `color-mix` for the design's own paper. Never a color that works in one scheme only.
- **Keep landmarks and targets honest.** One `main` — a `section` when `context.embedded`, and UNNAMED, or a page holding two embeds has two regions with one name. Controls at least 24px, AA contrast. Every size in `rem`: at 200% text a flex or grid item's automatic minimum is its CONTENT's, so one un-wrappable row pushes the whole column off the screen — `minmax(0, 1fr)` and `min-width: 0` on the column, `flex-wrap` on the row. Measure rather than trust: `-ink-faint` fails AA on an 11px label, and the accent fails on the warning ground. `node scripts/verify-pages.mjs` runs axe over every route, both widths, both schemes.
- **Withhold, do not hide.** Rule 7, on every surface: struck through with the policy's sentence, not dropped.

### On somebody else's page

`graview-embed` mounts the app, this face included (`face: "pages"`, `path`, `routing`), into one element of any page.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js   # the declaration is still whole
pnpm test                                               # render every page you registered
```

Render each registered page with `PagesApp` and `initialPath` in a test (`apps/seedbed/tests/integration/chapters.test.ts`). Then open it: a design that passes its tests and reads like an admin panel has replaced nothing.

### What the check cannot see

- Whether the design's words are the domain's. The derived pages use the declaration's `description` and `inverse`; a design that writes its own sentences must keep them true as the declaration changes.
- Whether a page gives every act `facts.actions` offers room: only a person can see that.

---

Give a Graview app the routed face it wants — from the derived pages, to one page in the app's own words, to a product design that replaces every surface.

The page: https://graview.dev/docs/skills/graview-pages.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
