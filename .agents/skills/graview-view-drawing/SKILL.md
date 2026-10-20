---
name: graview-view-drawing
description: Draw in a Graview worker view — the HTML, SVG and CSS the host keeps of it, the app's tokens and brand, the images a view may show (the app's logo, the app's own images, the pictures on records), a record's video the host plays and its full-screen viewer, files a person drops on it — and find out what the host refused rather than assuming it drew.
---

# Drawing in a worker view

A worker view (`graview-worker-view`: its manifest, its global, its writes
and its limits) draws by saying markup; the host draws what the open kit
keeps of it into a shadow root it owns, and lists the rest. **What it may
draw is broad; what it may load is only what the host chose.** Every image
it shows is one the host holds, made for it, or lists the origin of.

## What it may draw

HTML's sectioning, headings, text, lists, tables, `details`/`summary`,
`button`, `input`, `select`, `textarea`, `label`, `fieldset`, `meter`,
`progress` and `img`. SVG's `svg`, `g`, shapes, `path`, `text`, gradients,
`clipPath`, `mask`, `marker`, `pattern`, `symbol` and `use href="#id"`.
Attributes: `id`, `class`, `style`, `title`, `role`, `aria-*`, `data-*`, and
each element's own. CSS for layout, grid, flex, color, type, transitions,
`@keyframes`, `@media`, `@supports` and `@container`.

Never drawn: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `base`,
`style`, `form`, `video` (place a `graview-video`, below), `canvas`, SVG `image` and `foreignObject`; any
`href`, `srcset` or `on*` attribute; `src` on anything but `img`, and on
`img` any address but the ones below. In CSS: `url()` except `url(#id)` on
`fill`, `stroke`, `clip-path` or `marker`; `@import`; `@font-face`;
`image-set()`, `attr()` and other unlisted functions; `position: fixed`;
`:host`. `position: sticky` is kept — a header held in place sticks within
the view, whose region is painted contained — and `all` takes its keywords
(`button.toggle { all: unset }` takes the browser's chrome off a toggle). What the host leaves out it lists in `refused`;
`graview.refused` is the runtime's own early word on the last render.

A view never speaks as the app's chrome. `nav`, `header`, `footer`, `aside`
and `search` are drawn as `div`, and `output` as `span`, each with what it
holds. They lose their landmark or status role, and a selector for them in
your stylesheet still matches. A `section` is never named (no `aria-label`
or `title`), so it stays out of the landmarks. `role` takes no landmark or
notice's role (`navigation`, `region`, `status`, `alert`, …).

## The app's look

**Draw with the app's tokens**, so light and dark follow the app's own
toggle: `var(--graview-panel)`, `--graview-ground`, `--graview-ink`,
`--graview-ink-muted`, `--graview-edge`, `--graview-accent`,
`--graview-font-body`, `--graview-font-display` (headings, as the app's),
`--graview-font-mono`, `--graview-radius`. Presentation attributes do not
take `var()`; put paints in the stylesheet
(`.bar { fill: var(--graview-accent) }`). For what the view computes,
`props.theme` says the same tokens as values, with `scheme`, the app's
`name` and its `logo`. A brand change or the app's toggle pushes `theme`
again.

## The images a view may show

An `img`'s `src` is drawn only when it is one of these; any other address
— another site, a path of the app's of your own making — is refused, and
said once in the view's console and the host's problems, with the address:

- **A `data:` image** the view holds: PNG, GIF, JPEG, WebP, AVIF, BMP or
  SVG, at most 512,000 characters as its URL. Keep it small; it is part
  of the view's source.
- **The app's logo**: `<img src="${props.theme.logo}">`. The host made it
  from the brand's mark (a `blob:` URL of the page, or a `data:` image
  where the page's policy refuses `blob:`). Absent when the brand has none.
- **An image the app holds**, by the content address it was stored at:
  `/graview/assets/<sha256>.<ext>` (what Graview Cloud's `add_image`
  answers) — or that path under the app's base, or by the page's own
  address for it, each the same image. It is drawn only where the host
  says where those live — `asset` on the view's definition, and on a
  headless run — and refused elsewhere, with a sentence that says so.
- **An `https:` image on an origin the host lists** — `images: { origins:
  ["https://upload.wikimedia.org"] }` on the view's definition (and on a
  headless run). The view never chooses an origin: an address is data it
  can write, so an open list would let it send what it reads anywhere. It
  is asked for with no referrer. Unlisted, a URL on a record is refused.
- **A picture on a record.** Say `pictures: true` in the manifest, or
  `{ width: 400 }`, the widest the view draws one in CSS pixels. Each file
  on a record the view is handed is then `{ name, type, bytes, width,
  height, caption, src, left }` in its field, never the host's path to it.
  `src` is the address the host made from the bytes, fetched as the reader
  and made smaller to `width`, and drawn at any size as long as you use
  it as handed; it is absent on the first push, and a push follows when
  it is ready. `left` says why a picture will never come: past
  one picture's byte budget or the view's, or what the host answered when
  it was not loaded. A host that serves the app under a base says where a
  record's files are (`file` on the view's definition, else the page's
  `files.src`, which `filesAt` under the base derives). A document, and an
  SVG, has no `src`: show its name, type and size.

```js
const photos = (job.photos || []).map((photo) => photo.src
  ? graview.html`<img data-key="${photo.name}" src="${photo.src}" alt="${photo.caption || photo.name}">`
  : graview.html`<p data-key="${photo.name}">${photo.left || photo.name}</p>`);
```

Without `pictures`, a record's file comes as the record keeps it: its
`href` draws only where it is the app's own image (`/graview/assets/…`).

## A record's video, and the full-screen viewer

A view never draws `<video>` or `position: fixed`; it names what it wants
and **the host draws it**, from the records the view was shown, for a view
whose manifest says `pictures`:

- **`<graview-video data-record="${node.id}" data-field="clip">`** (and
  `data-index` in a list): the host plays that record's video in it —
  poster first, the browser's own controls, only its metadata fetched,
  captions where the value has them. Size the box in your stylesheet
  (`graview-video { width: 100% }`); nothing inside it is yours to style
  or hear. The video comes to the view as its facts — `{ name, type,
  bytes, width, height, caption, duration }` — so draw its length
  yourself if you like; never a `src`.
- **`<button data-lightbox data-record="${node.id}" data-field="photos"
  data-index="0">`**: the viewer's press opens the host's full-screen
  viewer for that picture or video over the app; Escape closes it and the
  keyboard comes back to the button. Your code cannot open it.

A record the view was not shown, a field with no video, or a view without
`pictures` draws nothing, and says why in its console and the host's
problems. A headless run says a placed video as "The waves at dusk, a
45-second video".

## Files a person drops on it

Say which fields files become — `accepts: [{ kind: "moment", field:
"photo" }, { kind: "moment", field: "clip" }]` in the manifest — and mark
the element: `<section data-drop="moment"
data-drop-connect="takenOn:${day.id}">`. **The host owns the drop**: it
draws the target while files are dragged over it, says what dropping does,
holds each file to the field its type fits and to the host's files, and
stores it. On a phone the same element is a tap that opens the picker. It
is a target only where this seat may make that kind and the host takes
files. A view that does not hear `drop` gets a record of the kind per file,
its file on its field, linked as `data-drop-connect` says, in one change
one undo takes back. One that does is told once:

```js
graview.on("drop", "[data-drop]", (event) => {
  const day = event.element.getAttribute("data-day");
  // event.files: [{ href, name, type, bytes, width, height, poster, duration, at, field }], never bytes; event.refused: sentences.
  graview.act("add-moment-to-day", event.files.map((file) => ({ id: day, [file.field]: file })));
});
```

`graview.act(name, [args, …])` is several as one change. Hand an act a file
only as you were handed it; any other `href` is refused. `data-drop-field`
narrows a target to one field. Every event is `{ type, target, element }`
and what it carries: `value`/`checked`, `key`, `pressed`, `files`/`refused`.

**Keep a picture in an `image` field**, which holds the uploaded file
(what `add_image` stores), never its bytes as words: a `data:` URI in a
text field is cut at 20,000 characters, and in the view's source it counts
against its size.

## Then find out whether it worked

1. `graview check` the app, and `checkManifest(manifest, store)` from
   `@graview/guest/host/views`: it says what is wrong with `pictures`.
2. `graview view check view.js --app <app> --manifest manifest.json --seed
   <seed.json> --roles <role>` says what it drew. Headless, a picture comes
   with a stand-in `src` (a blank image), so its `<img>` is drawn and
   judged; only the page shows its pixels. A picture the page would
   leave out comes with `left`, and the run says it among its problems.
   The budget is spent in order, the records linked to a view's own by an
   edge it reads first: a station's sheet on that camera's detections.
3. Open the place and read the view's `refused` (`WorkerView.refused`, or
   `graview.refused` in its console): every element, attribute and
   address the host left out, and why.
4. Toggle the app to dark, and change the brand where you can. Does the
   view follow, logo and all?
5. As a member who may see fewer records, are the pictures on the records
   they may not see absent — not merely hidden?

## What the check cannot see

`graview check` judges the declaration, and `refused` judges the markup;
neither sees whether the drawing reads. A picture drawn at full width on a
phone, an image with no `alt`, a token used for a meaning it does not
carry, a chart whose colors fail in dark: only looking at it on both faces,
at 390 and on a desk, in both schemes, sees that.
