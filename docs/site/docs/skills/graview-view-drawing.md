# graview-view-drawing

`graview-view-drawing` is one of Graview's 19 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Draw in a Graview worker view — the HTML, SVG and CSS the host keeps of it, the app's tokens and brand, and the images a view may show (the app's logo, the app's own images, the pictures on records) — and find out what the host refused rather than assuming it drew.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Drawing in a worker view

A worker view (`graview-worker-view`: its manifest, its global, its writes and its limits) draws by saying markup; the host draws what the open kit keeps of it into a shadow root it owns, and lists the rest. **What it may draw is broad; what it may load is only what the host chose.** Every image it shows is one the host holds, made for it, or lists the origin of.

### What it may draw

HTML's sectioning, headings, text, lists, tables, `details`/`summary`, `button`, `input`, `select`, `textarea`, `label`, `fieldset`, `meter`, `progress` and `img`. SVG's `svg`, `g`, shapes, `path`, `text`, gradients, `clipPath`, `mask`, `marker`, `pattern`, `symbol` and `use href="#id"`. Attributes: `id`, `class`, `style`, `title`, `role`, `aria-*`, `data-*`, and each element's own. CSS for layout, grid, flex, color, type, transitions, `@keyframes`, `@media`, `@supports` and `@container`.

Never drawn: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `base`, `style`, `form`, `video`, `canvas`, SVG `image` and `foreignObject`; any `href`, `srcset` or `on*` attribute; `src` on anything but `img`, and on `img` any address but the ones below. In CSS: `url()` except `url(#id)` on `fill`, `stroke`, `clip-path` or `marker`; `@import`; `@font-face`; `image-set()`, `attr()` and other unlisted functions; `position: fixed`; `:host`. `position: sticky` is kept — a header held in place sticks within the view, whose region is painted contained — and `all` takes its keywords (`button.toggle { all: unset }` takes the browser's chrome off a toggle). What the host leaves out it lists in `refused`; `graview.refused` is the runtime's own early word on the last render.

A view never speaks as the app's chrome. `nav`, `header`, `footer`, `aside` and `search` are drawn as `div`, and `output` as `span`, each with what it holds. They lose their landmark or status role, and a selector for them in your stylesheet still matches. A `section` is never named (no `aria-label` or `title`), so it stays out of the landmarks. `role` takes no landmark or notice's role (`navigation`, `region`, `status`, `alert`, …).

### The app's look

**Draw with the app's tokens**, so light and dark follow the app's own toggle: `var(--graview-panel)`, `--graview-ground`, `--graview-ink`, `--graview-ink-muted`, `--graview-edge`, `--graview-accent`, `--graview-font-body`, `--graview-font-display` (headings, as the app's), `--graview-font-mono`, `--graview-radius`. Presentation attributes do not take `var()`; put paints in the stylesheet (`.bar { fill: var(--graview-accent) }`). For what the view computes, `props.theme` says the same tokens as values, with `scheme`, the app's `name` and its `logo`. A brand change or the app's toggle pushes `theme` again.

### The images a view may show

An `img`'s `src` is drawn only when it is one of these; any other address — another site, a path of the app's of your own making — is refused, and said once in the view's console and the host's problems, with the address:

- **A `data:` image** the view holds: PNG, GIF, JPEG, WebP, AVIF, BMP or SVG. Keep it small; it is part of the view's source.
- **The app's logo**: `<img src="${props.theme.logo}">`. The host made it from the brand's mark (a `blob:` URL of the page, or a `data:` image where the page's policy refuses `blob:`). Absent when the brand has none.
- **An image the app holds**, by the content address it was stored at: `/graview/assets/<sha256>.<ext>` (what Graview Cloud's `add_image` answers). It is drawn only where the host says where those live — the `asset` resolver on the view's definition — and refused elsewhere.
- **An `https:` image on an origin the host lists** — `images: { origins: ["https://upload.wikimedia.org"] }` on the view's definition (and on a headless run). The view never chooses an origin: an address is data it can write, so an open list would let it send what it reads anywhere. It is asked for with no referrer. Unlisted, a URL on a record is refused.
- **A picture on a record.** Say `pictures: true` in the manifest, or `{ width: 400 }`, the widest the view draws one in CSS pixels. Each file on a record the view is handed is then `{ name, type, bytes, width, height, caption, src, left }` in its field, never the host's path to it. `src` is the address the host made from the bytes, fetched as the reader and made smaller to `width`; it is absent on the first push, and a push follows when it is ready. `left` says why a picture will never come: past one picture's byte budget or the view's, or not loaded. A document, and an SVG, has no `src`: show its name, type and size.

```js
const photos = (job.photos || []).map((photo) => photo.src
  ? graview.html`<img data-key="${photo.name}" src="${photo.src}" alt="${photo.caption || photo.name}">`
  : graview.html`<p data-key="${photo.name}">${photo.left || photo.name}</p>`);
```

Without `pictures`, a record's file comes as the record keeps it: its `href` draws only where it is the app's own image (`/graview/assets/…`).

**Keep a picture in an `image` field**, which holds the uploaded file (what `add_image` stores), never its bytes as words: a `data:` URI in a text field is cut at 20,000 characters, and in the view's source it counts against its size.

### Then find out whether it worked

1. `graview check` the app, and `checkManifest(manifest, store)` from `@graview/guest/host/views`: it says what is wrong with `pictures`.
2. `graview view check view.js --app <app> --manifest manifest.json --seed <seed.json> --roles <role>` says what it drew. Headless, a picture comes without `src`, so draw its name until it does.
3. Open the place and read the view's `refused` (`WorkerView.refused`, or `graview.refused` in its console): every element, attribute and address the host left out, and why.
4. Toggle the app to dark, and change the brand where you can. Does the view follow, logo and all?
5. As a member who may see fewer records, are the pictures on the records they may not see absent — not merely hidden?

### What the check cannot see

`graview check` judges the declaration, and `refused` judges the markup; neither sees whether the drawing reads. A picture drawn at full width on a phone, an image with no `alt`, a token used for a meaning it does not carry, a chart whose colors fail in dark: only looking at it on both faces, at 390 and on a desk, in both schemes, sees that.

---

Draw in a Graview worker view — the HTML, SVG and CSS the host keeps of it, the app's tokens and brand, and the images a view may show (the app's logo, the app's own images, the pictures on records) — and find out what the host refused rather than assuming it drew.

The page: https://graview.dev/docs/skills/graview-view-drawing.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
