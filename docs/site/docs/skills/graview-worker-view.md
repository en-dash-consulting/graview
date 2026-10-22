# graview-worker-view

`graview-worker-view` is one of Graview's 30 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Write a Graview worker view — one plain script, no imports and no build, that draws HTML, SVG and CSS for a kind or the home through the graview global — with a manifest the host enforces, and prove it runs rather than assuming it does.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## A worker view

A worker view is for what the declared blocks cannot draw: a chart, a grid of cards, a front page with a figure and a ring. It is one plain script. The host runs it in a hardened worker with no network, no storage and no DOM of its own, and draws what it says into a shadow root inside a region the host owns. **What it may draw is broad; what it may reach is not.** Write it against one global, `graview`. There is nothing to import and nothing to build; the word `import` may not appear in it at all, even in a comment, and nor may `export`.

### The manifest

Every view comes with a manifest the host enforces:

```js
{ name: "packages", title: "The packages", attach: "package", cardinality: "many",
  reads: { kinds: ["offer"], edges: ["includes"] },
  acts: ["set-summary", { act: "set-standing", as: "recommend", constants: { standing: "recommended" } }] }
```

- `name` is lower-case letters, digits and hyphens. Acts are recorded `via: "view:<name>"`.
- `title` makes it a named place on both faces, with the slug `placeSlug(title)` (`"the-packages"`). Its place flows with the page, as long as the view draws: no frame of its own scrolls inside the page, so a view sets no height to fill one.
- `attach` is a kind, or `"home"` for the front page's body (cardinality `many`).
- `reads` lists the other kinds and the edges it is shown. Nothing else is handed to it.
- `acts` lists the acts it may ask for, by name. An entry with `as` and `constants` is another name for the same act with arguments the view cannot change.
- A view of one record (`cardinality: "one"`) is drawn above the kind's page blocks and the record's own fields, which stay editable. `replaces: "page"` draws it alone, and the page blocks never (`graview-view-specs`).
- `gestures: true` lets it hear a wheel, a drag and a pinch (below). `bleed: true` draws it edge to edge on a phone (`graview-view-drawing`).
- `pictures: true` (or `{ width }`) hands each file on a record with an address the host made from its bytes, never its path, and lets the view place a record's video (`<graview-video>`) and open the host's full-screen viewer: `graview-view-drawing` says how a view shows them.

A manifest that names a kind, an edge or an act the app does not declare is refused before the view starts.

### The global

```js
graview.style(css)              // a stylesheet, after any before it
graview.onProps((props) => …)   // every push of what it is shown (and at once)
graview.props                   // the last push
graview.render(markup)          // draw: a string, graview.html`…`, or nodes
graview.html`<li>${x}</li>`     // markup; every value put in is escaped
graview.on("click", ".card", (event) => …)   // also input, change, keydown, toggle, acted
graview.act(name, args)         // ask for an act: resolves { ok, intent } or { ok: false, reason, message }
graview.navigate("offer:7")     // a record, else a place or a kind's list by slug
graview.navigate({ place: "features", where: { stage: "building" }, section: "Shipping soon" })
```

`props` holds `node`, the record a view of one is drawn for, and `nodes`, the records a view of many is drawn for and those it reads. A record is plain data: its `id`, `kind` and `label`, and each field on it by name, so a deliverable's draft is `props.node.draft`; there is no `fields` key. A view of one finds its record in `node`, never in `nodes`. Then `edges` (`{ kind, from, to }` among them), `label` (its title), `acts` (`{ name, title }`, those the viewer may run), `places` (`{ as, title }`), and `theme` (`scheme`, `accent`, `panel`, `ink`, `fontDisplay`, `radius` …, the app's `name`, and its `logo` as a URL the host made), and `locale` and `timeZone`: say a kept instant with `new Intl.DateTimeFormat(props.locale, { timeZone: props.timeZone, hour: "numeric", minute: "2-digit" })`, the clock the rest of the app says it on, never a zone of your own. `render` keeps what it can, by element and by `data-key` or `id`, so give repeated rows a `data-key`: a field being typed in keeps its text across a push. An event carries `value`, `checked`, `key`, `pressed` for a bound press, and `element`, what the selector matched: read its `data-*`. Elements lack `closest`, `matches` and `dataset`.

### Links and buttons, by default

To go somewhere, `<a data-record>` or `<a data-place>`; to do something, a `<button>` (`data-act` to run an act). Style either freely: the host resets both to the words around them, and your class wins. A `<div>` or `<span>` with only `graview.on("click")` is reached by no keyboard and named nothing; given `role="button"` (or checkbox, switch, tab, `aria-pressed`, `aria-expanded`) the host gives it the keyboard, and Enter or Space is heard as a click. Whatever has the keyboard shows the host's ring: restyle it with `--graview-focus-color`, never `outline: none`. `class="graview-sr"` is words for a screen reader alone; an `<svg>` with no role, `aria-label` or `<title>` is hidden from one.

### Gestures

With `gestures: true`, `graview.on("wheel" | "drag" | "pinch", selector, fn)` hears them over what the selector matches, at most once a frame with the deltas summed. Each carries `x`, `y` (pixels from the matched element's top left) and its `width`, `height`. A `wheel` has `deltaX`, `deltaY`, `deltaMode`, `ctrlKey`, `metaKey`; a `drag` has `phase` (`start`, `move`, `end`), `pointerId`, `button`, `pressure` and `dx`, `dy` since the last; a `pinch` (Safari's, or a trackpad's Control-wheel) has `phase`, `scale` since the last and `rotation`. The page scrolls everywhere else; say `touch-action: none` on what drags. Without the flag the check says so.

HTML, SVG and stylesheets, drawn with the app's `--graview-*` tokens so light and dark follow the app's toggle; nothing that loads or escapes. What the host keeps, the tokens, and the only images a view may show (the app's logo, the app's own images, the pictures on records) are `graview-view-drawing`. What the host leaves out it lists in `refused`.

### Links

`<a data-record="offer:7">`, `<a data-place="the-packages">` and a whole card or row with `data-record` are links the host follows on a click, a phone's tap and Enter, to what the viewer may see. An `<a href>` goes out only to an address a record was handed. A card, a link out, what a tap inside it reaches, and going narrowed or to a section are `graview-view-links`.

### Writes

An act must be in the manifest. Where every member sees every record, `graview.act` applies it as given; anywhere else **only a press applies an act**: a person's click on a `data-act`, or a field of theirs that saves. How those are written and heard is `graview-view-forms`.

### Limits

About 256 kB of source, 5 000 drawn nodes, 120 messages a second, 1 000 ms per push, and 100 ms a second of the page's time drawing it. Past any of them the view is stopped and the plain face of its records is drawn instead, with why. Draw summaries, not every row of a huge set. Work a view schedules with timers between pushes is not timed per push. It may keep its worker busy just under the heartbeat's 5 s; the page stays responsive, the person's CPU does not: never spin.

### Worked examples

`examples/offers-list.js` is a list lens: rows linking to their records, and a note typed and pressed in. `examples/front-page.js` is a home: a headline, a figure, an SVG ring and cards linking to a place. `examples/a-record.js` is a view of one record: a deliverable's subject and its draft as paragraphs, read off `props.node`, and "Edit draft" with the draft prefilled. `examples/a-map-that-pans-and-zooms.js` is an SVG map whose viewBox a wheel and a pinch zoom around the pointer and a drag pans. Each opens with its manifest.

### Registering it

```ts
import { registerWorkerView, workerHome } from "@graview/guest/host/views";
views: (schema, registry) => registerWorkerView(registry, { manifest, worker: { source } }),
pages.surface("home", workerHome({ manifest: front, worker: { source: frontSource } }));
```

A view with `attach: "home"` given to `registerWorkerView` is the home's own view: the routed home's body, the page the app opens on — full width under the bar on a desk too — and the app's declared home is drawn if it fails. A host with many views hands each one's code as a function (`worker: () => fetch(url).then((r) => r.text()).then((source) => ({ source }))`): the manifest registers the place, and the code is fetched only when the view is first drawn.

### Then find out whether it worked

1. `graview check` the app the view names: a manifest is only as sound as the declaration it reads. `checkManifest(manifest, store)` and `checkViewSource(source)` from `@graview/guest/host/views` must both say nothing.
2. Run it headless, with no network, as a member who may see less than you, over a seed: `graview view check view.js --app <app> --manifest manifest.json --seed <seed.json> --roles <role>`. It prints what the view drew, said as `graview describe` says a place, or why it will not do: `error` (what it threw), `nodes`, `flood`, `slow`, `act` (an act its manifest does not name), `manifest` or `source`. A view of one record runs over the first of its kind the seat sees, or the one `--record <id>` names. Run it on an empty seed too. In code, `runWorkerViewHeadless` from `@graview/guest/headless` does the same in an isolate you supply.
3. Open the place on both faces as that member. Is anything shown that they should not see? Does the region carry no `data-worker-view-failed`? `start` there means the view never ran: a page with a Content-Security-Policy needs `worker-src blob:` and `style-src 'unsafe-inline'`, and the note under the plain face names what it lacks.
4. Toggle the app to dark. Does the view restyle?
5. Follow each link, and tap each card on a phone, as `graview-view-links` says. A view that writes is pressed as `graview-view-forms` says.

### What the check cannot see

`graview check` judges the declaration, not the script. It cannot see a view that throws on an empty graph, draws the wrong number, or takes too long on a big one. Only running it does: `graview view check` on an empty app, a full one, and a member with narrow sight. A headless run is one push with timers that never fire, and nothing laid out, so it cannot see an animation or a layout that breaks at 390; the faces can. Nor can it see a view that misleads. The host keeps it from reaching or leaking anything, not from arranging what the person may see badly.

---

Write a Graview worker view — one plain script, no imports and no build, that draws HTML, SVG and CSS for a kind or the home through the graview global — with a manifest the host enforces, and prove it runs rather than assuming it does.

The page: https://graview.dev/docs/skills/graview-worker-view.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
