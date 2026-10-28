---
name: graview-view-drawing
description: Draw in a Graview worker view — the HTML, SVG and CSS the host keeps of it, the app's tokens and brand, the images a view may show (the app's logo, the app's own images, the pictures on records), a record's video the host plays and its full-screen viewer, files a person drops on it — and find out what the host refused rather than assuming it drew.
---

# Drawing in a worker view

A worker view (`graview-worker-view`: its manifest, its global, its writes
and its limits) draws by saying markup; the host draws what the open kit
keeps of it into a shadow root it owns, and lists the rest. **What it may
draw is broad; what it may load is only what the host chose.**

## What it may draw

HTML's sectioning, headings, text, lists, tables, `details`/`summary`,
`button`, `input`, `select`, `textarea`, `label`, `fieldset`, `meter`,
`progress` and `img`. SVG's `svg`, `g`, shapes, `path`, `text`, gradients,
`clipPath`, `mask`, `marker`, `pattern`, `symbol`, `use href="#id"`, `filter`
and its `fe*`. Attributes: `id`, `class`, `style`, `title`, `role`, `aria-*`, `data-*`, and
each element's own. CSS for layout, grid, flex, color, type, `mask-image`,
`-webkit-text-stroke`, transitions, `@keyframes`, `animation-timeline`,
`@media`, `@supports` and `@container`; reduced motion holds motion still. Each
`graview.style(css)` adds a sheet after the last (a shared design system's,
then the view's own), each judged alone; a sheet given again is not added
twice: say what changes per push in a class or `style`.

Never drawn: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `base`,
`style`, `form`, `video` (place a `graview-video`, below), `canvas`, SVG
`image`, `feImage`, `foreignObject` and SMIL; any `srcset` or `on*`
attribute; `href` but a link out (`graview-view-links`); `src` on anything
but `img`, and on `img` any address but the ones below. In CSS: `url()`
except `url(#id)` on `fill`, `stroke`, `clip-path`, `marker` or `filter`;
`@import`; `@font-face`; `@property`; `image-set()`, `attr()` and other
unlisted functions; `position: fixed`; `:host`. `position: sticky` is kept
— a header held in place sticks within the view, whose region is painted
contained — and `all` takes its keywords (`all: unset` takes a button's
chrome off). What the host leaves out it lists in `refused` (below).

A view never speaks as the app's chrome. `nav`, `header`, `footer`, `aside`
and `search` are drawn as `div`, and `output` as `span`, each with what it
holds. They lose their landmark or status role; a selector for them still
matches. A `section` is named only by a heading it draws (`aria-labelledby`). `role` takes
no landmark or notice's role (`navigation`, `status`, `alert`, …) but a
named `region`.

A control of your own keeps its role and state, and every `aria-*`:
`<span role="checkbox" aria-checked="true" tabindex="0">`, `switch`,
`aria-pressed`, `aria-expanded` with `aria-controls` naming an id you
drew, tabs, `slider`. Hear Space and Enter on `keydown`.

## The app's look

**Draw with the app's tokens**, so light and dark follow the app's own
toggle: `var(--graview-panel)`, `--graview-ground`, `--graview-ink`,
`--graview-ink-muted`, `--graview-edge`, `--graview-accent`,
`--graview-font-body`, `--graview-font-display` (headings),
`--graview-font-mono`, `--graview-radius`. Presentation attributes do not
take `var()`; put paints in the stylesheet. `props.theme` says the same
tokens as values, with `scheme`, `name` and `logo`, pushed again when the
brand or the toggle changes. Shared rules go in `brand.views.css`
(`graview-brand`), drawn before each view's own; the view's rule wins.

## Its box, and the gutter

On Pages a view is drawn in the page's column, which keeps a 20px gutter
either side on a phone. Nothing the view draws passes its box: a negative
margin is clipped at its edge, not widened. Say `bleed: true` in the
manifest and on a phone (680px or less) the box takes the gutter back,
keeping the safe areas: a hero is the phone's width. At a desk it is the
column's width.

## The images a view may show

An `img`'s `src` is drawn only when it is one of these; any other address
— another site, a path of the app's of your own making — is refused, and
said once in the view's console and the host's problems, with the address:

- **A `data:` image** the view holds: PNG, GIF, JPEG, WebP, AVIF, BMP or
  SVG, at most 512,000 characters as its URL.
- **The app's logo**: `<img src="${props.theme.logo}">`. The host made it
  from the brand's mark (a `blob:` URL of the page, or a `data:` image
  where the page's policy refuses `blob:`). Absent when the brand has none.
- **An image the app holds**, by the content address it was stored at:
  `/graview/assets/<sha256>.<ext>` (what Graview Cloud's `add_image`
  answers) — or that path under the app's base, or by the page's own
  address for it, each the same image. It is drawn only where the host
  says where those live (`asset` on the view's definition, and on a
  headless run), and refused elsewhere.
- **An `https:` image on an origin the host lists** — `images: { origins:
  ["https://upload.wikimedia.org"] }` on the view's definition (and on a
  headless run). The view never chooses an origin: an open list would let
  it send what it reads anywhere. It is asked for with no referrer.
  Unlisted, a URL on a record is refused.
- **A picture on a record.** Say `pictures: true` in the manifest, or
  `{ width: 400 }`, the widest the view draws one in CSS pixels. Each file
  on a record the view is handed is then `{ name, type, bytes, width,
  height, caption, src, left }` in its field, never the host's path to it.
  `src` is the address the host made from the bytes, fetched as the reader
  and made smaller to `width`, and drawn at any size as long as you use
  it as handed; it is absent on the first push, and a push follows when
  it is ready. `left` says why a picture will never come: past one
  picture's byte budget or the view's, or what the host answered when it
  was not loaded. A document, and an SVG, has no `src`: show its name,
  type and size.

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
  bytes, width, height, caption, duration, poster }` (`poster: true`
  where it has one) — so draw its length yourself if you like; never a
  `src`.
- **`<graview-video autoplay cover …>`**: a hero background — muted,
  looping, inline, no controls (`autoplay` means all of it), `cover`
  filling the box you sized; still at its poster where the person asked
  for less motion. A headless run lists each video with its source and
  whether it is playable (MP4 or WebM, with a poster): confirm it there.
- **`<button data-lightbox data-record="${node.id}" data-field="photos"
  data-index="0">`**: the viewer's press opens the host's full-screen
  viewer for that picture or video over the app; Escape closes it and the
  keyboard comes back to the button. Your code cannot open it.

A record the view was not shown, a field with no video, or a view without
`pictures` draws nothing, and says why in its console and the host's
problems.

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
and what it carries: `value`/`checked`, `key`, `pressed`, `files`.

**Keep a picture in an `image` field**, which holds the uploaded file
(what `add_image` stores), never its bytes as words: a `data:` URI in a
text field is cut at 20,000 characters, and in the view's source it counts
against its size.

## Then find out whether it worked

1. `graview check` the app, and `checkManifest(manifest, store)` from
   `@graview/guest/host/views`: it says what is wrong with `pictures`.
2. `graview view check view.js --app <app> --manifest manifest.json --seed
   <seed.json> --roles <role>` says what it drew. Headless, a picture comes
   with a stand-in `src`, so its `<img>` is drawn and judged; one the page
   would leave out comes with `left`, said among the problems.
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
carry, a chart whose colors fail in dark: only looking, on both faces, at
390 and on a desk, in both schemes, sees that.
