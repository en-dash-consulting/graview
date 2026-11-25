---
name: graview-view-drawing
description: Draw in a Graview worker view — the HTML, SVG and CSS the host keeps of it, the app's tokens and brand, the images a view may show (the app's logo, the app's own images, the pictures on records), a record's video, the app's reel or a YouTube or Vimeo video the host plays and its full-screen viewer, files a person drops on it — and find out what the host refused rather than assuming it drew.
---

# Drawing in a worker view

A worker view (`graview-worker-view`: its manifest, global, writes
and limits) draws by saying markup; the host draws what the open kit
keeps of it into a shadow root it owns, and lists the rest. **What it may
draw is broad; what it may load is only what the host chose.**

## What it may draw

HTML's sectioning, headings, text, lists, tables, `details`/`summary`,
`button`, `input`, `select`, `textarea`, `label`, `fieldset`, `meter`,
`progress` and `img`. SVG's `svg`, `g`, shapes, `path`, `text`, gradients,
`clipPath`, `mask`, `marker`, `pattern`, `symbol`, `use href="#id"`, `filter`
and its `fe*`. Attributes: `id`, `class`, `style`, `title`, `role`, `aria-*`, `data-*`, and
each element's own. CSS for layout, grid, flex, columns and `break-inside`,
color, type, `mask-image`, scroll margins, transitions, `@keyframes`,
`animation-timeline`, `@media`, `@supports` and `@container`; reduced motion
holds motion still. Every property kept is in `CSS_PROPERTIES` (functions
`CSS_FUNCTIONS`, at-rules `CSS_AT_RULES`) on `@graview/core/css`. Each
`graview.style(css)` adds a sheet after the last, each judged alone; a sheet given again is not added
twice: say what changes per push in a class or `style`.

Never drawn: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `base`,
`style`, `form`, `video` (place a `graview-video`, below), `canvas`, SVG
`image`, `feImage`, `foreignObject` and SMIL; any `srcset` or `on*`
attribute; `href` but a link out (`graview-view-links`); `src` on anything
but `img`, and on `img` any address but the ones below. In CSS: `url()`
except `url(#id)` on `fill`, `stroke`, `clip-path`, `marker` or `filter`;
`@import`; `@font-face` but a `data:` one (below); `@property`; `image-set()`, `attr()` and other
unlisted functions; `position: fixed`; `:host`. `position: sticky` sticks
within the view; `all: unset` takes a button's chrome off. What the host leaves out it lists in `refused` (below).

A view never speaks as the app's chrome. `nav`, `header`, `footer`, `aside`
and `search` are drawn as `div`, and `output` as `span`, each with what it
holds. They keep their
selector. A `section` is named only by a heading it draws (`aria-labelledby`). `role` takes
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
brand or the toggle changes.

Shared rules go in `brand.views.css` (`graview-brand`). **The theme wins**:
its cascade layer is after the view's own sheets, so its rule wins at any
specificity. A view's `!important` and a `style` attribute go past it; a rule
on an ancestor is only inherited.

**A web face** the brand lends: `views.fonts: [{ family: "Baloo 2", src:
"/graview/assets/<sha256>.woff2", weight: "400 800" }]`, then `font-family:
"Baloo 2", var(--graview-font-body)`: an app's file of 2 MB at most, or one
on an origin in `fonts.origins`. **The view's own face** is a `data:` font:
`@font-face { font-family: "Shout"; src: url(data:font/woff2;base64,…) }`,
50 KB a face, 200 KB a view, decoded; never an address or `local()`. It
draws in this view alone; under a lent face's name, the app's draws; a
host may refuse it (`ownFaces: false`). Refusals are said, with a code.

## Its box, and the gutter

On Pages a view draws in the page's column, within its box (negative
margins clipped). Beside the city your root has `data-graview-in-panel`
and `var(--graview-gutter, 20px)` is 16px: space by `@container`, not `vw`. `bleed: true`: on a phone (≤680px) it takes the
gutter back, keeping safe areas; `"full"`: the window's width; a home (or
`heading: "own"`) is flush under the bar.

## The images a view may show

An `img`'s `src` is drawn only when it is one of these; any other address
is refused, and said once in its console and to the host:

- **A `data:` image** the view holds: PNG, GIF, JPEG, WebP, AVIF, BMP or
  SVG, at most 512,000 characters as its URL.
- **The app's logo**: `<img src="${props.theme.logo}">`, which the host
  made from the brand's mark; absent when it has none.
- **An image the app holds**, by the content address it was stored at:
  `/graview/assets/<sha256>.<ext>` (what Graview Cloud's `add_image`
  answers), alone or under the app's base or the page's own address. It
  is drawn only where the host says where those live (`asset` on the view's definition, and on a
  headless run), and refused elsewhere.
- **An `https:` image on an origin the host lists** — `images: { origins:
  ["https://upload.wikimedia.org"] }` on the view's definition (and on a
  headless run), asked for with no referrer.
  Unlisted, a URL on a record is refused.
- **A picture on a record.** Say `pictures: true` in the manifest, or
  `{ width: 400 }`, the widest it draws one. Each picture is then
  `{ name, type, bytes, width, height, aspect, cutout, focus, caption, src,
  thumb, left }`, never the host's path. Size a tile by `aspect`; draw a
  `cutout` (transparent, or on a plain ground) whole (`object-fit:
  contain`) and crop the rest (`cover`) at `object-position: ${x*100}%
  ${y*100}%` of `focus`. `src` is fetched as the reader, made smaller to
  `width`; absent until later. `left` says why one never will. An
  SVG has no `src`; a document keeps its `href`, plus `src` where its
  host made a `preview`. They share
  12 MB: choose kinds, `records: { subject: true }` or `{ ids }`, and
  `most: 12`. `thumb: 240` (< `width`) adds a smaller `thumb`: draw
  `thumb || src`; `{ width: 240, aspect: 1 }` crops it around `focus`.

```js
const photos = (job.photos || []).map((photo) => photo.src
  ? graview.html`<img data-key="${photo.name}" src="${photo.src}" alt="${photo.caption || photo.name}">`
  : graview.html`<p data-key="${photo.name}">${photo.left || photo.name}</p>`);
```

Without `pictures`, a file's `href` draws only as the app's own image.

## A video, and the full-screen viewer

A view names it and **the host draws it**:

- **`<graview-video data-record="${node.id}" data-field="clip">`** (and
  `data-index` in a list), for a manifest that says `pictures`: the
  record's video — poster first, the browser's controls, captions. Size
  the box in your stylesheet; nothing inside is yours. It comes as facts (`name, type, width, height,
  caption, duration, poster`), never a `src`.
- **`<graview-video data-app="reel">`**: the app's own reel, no
  `pictures` needed. Its facts are in `props.theme.reel` (`name, caption,
  duration, poster, playable`); absent, the host handed none.
- **`autoplay cover`** on either: a hero background — muted, looping, no
  controls, filling the box; still at its poster under reduced motion. A
  headless run says whether each plays.
- **`<graview-video data-provider="youtube" data-video="dQw4w9WgXcQ"
  title="The keynote">`** (or `vimeo`, or `data-watch="${node.link}"`):
  poster and play button, its player once pressed, always a link out.
  `poster`: a picture you may show; `data-start="1m30s"`; `data-shape`
  16:9, 4:3, 1:1, 9:16. Any other is refused (`embed-refused`).
- **`<button data-lightbox data-record="${node.id}" data-field="photos"
  data-index="0">`**: the viewer's press opens the host's full-screen
  viewer for that picture or video; Escape closes it. Your code cannot.

What is not shown, held or handed draws nothing, and says why.

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

**Keep a picture in an `image` field** (what `add_image` stores), never its
bytes as words: a `data:` URI in a text field is cut at 20,000 characters.

## Then find out whether it worked

1. `graview check` the app, and `checkManifest(manifest, store)` from
   `@graview/guest/host/views`: it says what is wrong with `pictures`.
2. `graview view check view.js --app <app> --manifest manifest.json --seed
   <seed.json> --roles <role>` says what it drew. Headless, a picture comes
   with a stand-in `src`; one the page would leave out comes with `left`,
   among the problems.
3. Open the place and read the view's `refused` (`WorkerView.refused`, or
   `graview.refused` in its console): every element, attribute and
   address the host left out, and why.
4. Toggle to dark; change the brand. Does the view follow?
5. As each seat (`--seats`): are the pictures it may not see absent?
   A kind in `props.unseen` gets a sentence, not a hole.

## What the check cannot see

Whether it reads (an image with no `alt`, colors that fail in dark):
look on both faces, at 390 and on a desk, in both schemes.
