---
name: graview-worker-view
description: Write a Graview worker view — one plain script, no imports and no build, that draws HTML, SVG and CSS for a kind or the home through the graview global — with a manifest the host enforces, and prove it runs rather than assuming it does.
---

# A worker view

A worker view is for what the declared blocks cannot draw: a chart, a grid
of cards, a front page with a figure and a ring. It is one plain script.
The host runs it in a hardened worker with no network, no storage and no
DOM of its own, and draws what it says into a shadow root inside a region
the host owns. **What it may draw is broad; what it may reach is not.**
Write it against one global, `graview`. There is nothing to import and
nothing to build; the word `import` may not appear in it at all, even in a
comment, and nor may `export`.

## The manifest

Every view comes with a manifest the host enforces:

```js
{ name: "packages", title: "The packages", attach: "package", cardinality: "many",
  reads: { kinds: ["offer"], edges: ["includes"] },
  acts: ["set-summary", { act: "set-standing", as: "recommend", constants: { standing: "recommended" } }] }
```

- `name` is lower-case letters, digits and hyphens. Acts are recorded `via: "view:<name>"`.
- `title` makes it a named place on both faces, with the slug `placeSlug(title)` (`"the-packages"`).
- `attach` is a kind, or `"home"` for the front page's body (cardinality `many`).
- `reads` lists the other kinds and the edges it is shown. Nothing else is handed to it.
- `acts` lists the acts it may ask for, by name. An entry with `as` and `constants` is another name for the same act with arguments the view cannot change.

A manifest that names a kind, an edge or an act the app does not declare is
refused before the view starts.

## The global

```js
graview.style(css)              // the view's one stylesheet
graview.onProps((props) => …)   // every push of what it is shown (and at once)
graview.props                   // the last push
graview.render(markup)          // draw: a string, graview.html`…`, or nodes
graview.html`<li>${x}</li>`     // markup; every value put in is escaped
graview.on("click", ".card", (event) => …)   // also input, change, keydown, toggle
graview.act(name, args)         // ask for an act: resolves { ok, intent } or { ok: false, reason, message }
graview.navigate("offer:7")     // a record; graview.navigate({ place: "the-packages" }) a place
```

`props` holds `nodes` (each with its `id`, `kind`, `label` and fields),
`edges` (`{ kind, from, to }` among them), `node` for a view of one,
`label` (its title), `acts`, `places` (`{ as, title }`), and `theme`
(`scheme`, `accent`, `panel`, `ink` …). `render` keeps what it can, by
element and by `data-key` or `id`, so give repeated rows a `data-key`: a
field being typed in keeps its text across a push. An event carries
`value`, `checked`, `key`, and `pressed` for a bound press.

## What it may draw

HTML's sectioning, headings, text, lists, tables, `details`/`summary`,
`button`, `input`, `select`, `textarea`, `label`, `fieldset`, `meter`,
`progress` and `img`. SVG's `svg`, `g`, shapes, `path`, `text`, gradients,
`clipPath`, `mask`, `marker`, `pattern`, `symbol` and `use href="#id"`.
Attributes: `id`, `class`, `style`, `title`, `role`, `aria-*`, `data-*`, and
each element's own. CSS for layout, grid, flex, colour, type, transitions,
`@keyframes`, `@media`, `@supports` and `@container`.

Never drawn: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `base`,
`style`, `form`, `video`, `canvas`, SVG `image` and `foreignObject`; any
`href`, `srcset` or `on*` attribute; `src` except on `img`, as a `data:`
image. In CSS: `url()` except `url(#id)` on `fill`, `stroke`, `clip-path`
or `marker`; `@import`; `@font-face`; `image-set()`, `attr()` and other
unlisted functions; `position: fixed` or `sticky`; `:host`. What the host
leaves out it lists in `refused`; `graview.refused` is the runtime's own
early word on the last render.

**Draw with the app's tokens**, so light and dark follow the app's own
toggle: `var(--graview-panel)`, `--graview-ground`, `--graview-ink`,
`--graview-ink-muted`, `--graview-edge`, `--graview-accent`,
`--graview-font-body`, `--graview-font-mono`. Presentation attributes do
not take `var()`; put paints in the stylesheet (`.bar { fill: var(--graview-accent) }`).

## Links

`<a data-record="offer:7">` and `<a data-place="the-packages">` are links
the host follows, on both faces. `<a href="https://…">` is drawn as text.

## Writes

An act must be in the manifest. If every member of the app sees every
record, `graview.act` applies it as given. Otherwise **only a press
applies an act**: a person's click on an element with `data-act`. Its
arguments come only from the record it is bound to (`data-record`, on it
or around it), the manifest's constants, and the fields in its `fieldset`,
named for the act's arguments and typed by the person:

```html
<fieldset>
  <input name="summary" placeholder="What it is">
  <button data-act="set-summary" data-record="package:start">Say it</button>
</fieldset>
```

A field the view filled (`value="…"`) is the view's until the person
empties it, and a press carrying it is refused. Do not prefill. A view
may empty a field after a press. The press is applied before the view
hears it; read `event.pressed`.

## Limits

About 256 kB of source, 5 000 drawn nodes, 120 messages a second, and
1 000 ms per push. Past any of them the view is stopped and the plain face
of its records is drawn instead, with why. Draw summaries, not every row
of a huge set.

## Worked examples

`examples/offers-list.js` is a list lens: rows linking to their records,
and a note typed and pressed in. `examples/front-page.js` is a home: a
headline, a figure, an SVG ring and cards linking to a place. Each opens
with its manifest.

## Registering it

```ts
import { registerWorkerView, workerHome } from "@graview/guest/host";
views: (schema, registry) => registerWorkerView(registry, { manifest, worker: { source } }),
pages.surface("home", workerHome({ manifest: front, worker: { source: frontSource } }));
```

## Then find out whether it worked

1. `graview check` the app the view names: a manifest is only as sound as
   the declaration it reads. `checkManifest(manifest, store)` and
   `checkViewSource(source)` from `@graview/guest/host` must both say
   nothing.
2. Open the place on both faces, as a member who may see less than you.
   Is anything shown that they should not see? Does the region carry no
   `data-worker-view-failed`?
3. Toggle the app to dark. Does the view restyle?
4. Press each bound button with typed words, then again with a field the
   view filled. The first applies and the second is refused.

## What the check cannot see

`graview check` judges the declaration, not the script. It cannot see a
view that throws on an empty graph, draws the wrong number, or takes too
long on a big one. Only running it does: an empty app, a full one, and a
member with narrow sight. Nor can it see a view that misleads. The host
keeps it from reaching or leaking anything, not from arranging what the
person may see badly.
