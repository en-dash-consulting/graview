# A place as static HTML (FR-174)

The pages face is React components under a browser router. A host that wants a
**fixed link** — a team's schedule as a PDF, a roster on a wall, a page in an
email — wants the same place as a string, rendered again whenever the app
changes, often in a Worker that has no DOM. That is `@graview/pages/static`.

```ts
import { renderPlace } from "@graview/pages/static";

const { html, css, title, found } = renderPlace(store, app, "/places/the-rota", {
  viewer: { kind: "human", id: "user-ada", roles: ["volunteer"] },
  look: { scheme: "light" },        // the app's own brand unless `brand` is handed
  base: "https://rota.example.org", // links lead to the app's own pages there
});
```

## What it renders

`place` is any name the routed face and `describe_place` use for a place: a
`placesOf(app)` entry, its slug (`home`, `tasks`, a lens's `as`), its title,
its address (`/`, `/tasks`, `/places/the-week`), a record's id, or a record's
address (`/tasks/task-1`).

| Place | What the page says |
|-------|--------------------|
| The home | The app's name and subtitle, then the home's blocks — or, with none declared, how many of each kind the viewer has — and the app's facts |
| A kind's list | Its plural, its declared description, how many there are, and each record by its row spec, or by its name and its glance |
| A record | Its kind, its name, its `describe` line, what is wrong with it, its facts in the sections its page declares, and its relations in the declaration's own words |
| A declared place | What `describePlace` says it shows: a block lens's blocks, a status board's columns with each card, a coverage grid, or the records a picture draws |

The content is `describePlace`'s (`@graview/core/describe`) — the same
resolution of cards, rows and blocks the faces draw from — written down as
markup. It is not a second reading of the declaration.

## What it guarantees

- **Self-contained.** One document: the look inlined as a `<style>` (the
  brand's tokens as the same `--graview-*` properties every face reads, its
  type and shape), no `<link>`, nothing fetched. `css` is the sheet alone,
  for a host that writes its own head; `staticCss(brand, scheme)` makes it
  without rendering anything.
- **No scripts.** No `<script>`, no handler, no form, no control. Interaction,
  the seat and the scene are the faces' business, not this one's.
- **Under the viewer's sight.** The page is drawn from `store.seenBy(viewer)`.
  A record the viewer may not see, a kind kept from them (an administered
  module's, one they see none of) and an address that names nothing are all
  answered alike: `found: false` and a page that says nothing lives there.
  With no `viewer`, an anonymous person.
- **Printable.** Under `@media print` each section of a place — a heading of
  the place's own, a board's column, a grouped list's group — starts a new
  page; a card, a row and a fact never split across one.
- **No DOM, no React.** The entry imports only `@graview/core` and a few of its
  entries. A test bundles it and renders in a bare context with no `window`,
  `document`, `process` or `require` (`packages/pages/tests/unit/a-place-is-rendered-to-static-html.test.ts`).
  Bundled for a Worker, most of what it weighs is zod. Nothing on a hosted page imports it, so a page's up-front weight is
  unchanged.

## A record's pictures

A kind's picture, video and document fields (`imageField()`, `videoField()`,
`fileField()`) are drawn, not said by their names: a record's page shows its
pictures in a gallery (each a link to itself full size, cut around its
`focus`), its videos with the browser's own controls from their posters, and
its documents by the page their host made of them (`preview`) and by name,
type and size. A list's derived row and card show the record's first picture
small, as the routed list does; a declared card or row draws its `image`
blocks. Each file is drawn at the address the host serves it at — the same
`files` the hosted page is handed, or only its `src`:

```ts
renderPlace(store, app, "/houses/h1", { files: { src: (href) => `/a/houses${href}` } });
```

Unsaid, at the `href` the record keeps. The page is still static: a video's
controls are the browser's, and nothing runs.

## The whole app as one file

```ts
import { renderSite } from "@graview/pages/static";

const { html, pages } = renderSite(store, app, { viewer, files });
```

`renderSite` writes every place the viewer may see (in `placesOf` order) and
every record's page they may see into one document: the look inlined once, a
contents of the places at the top, each page an `<article>` whose id is
`pageAnchor(address)` (`/tasks/task-1` is `page/tasks/task-1`), and every link
one within the file — so a host that exports the app as one file rewrites no
address. A link to a page the file does not hold (a record the viewer may not
see) is no link; its words stay. `pages` lists what the file holds, in order.
A design's `records` writers write their records' pages, and `site.href(path)`
answers the in-file link; a design's `document` is not used, since the file is
one document. `base` is put before no link, only before a path-only mark.

## A PDF

A PDF is the static page printed, and printing is the host's: the framework
runs no browser and carries no PDF writer. The sheet is written for it — under
`@media print` each page of a site and each section of a place starts a new
sheet, a card, a row, a fact and a picture never split across one, links lose
their color, the ground prints (`print-color-adjust: exact`), and `@page` sets
a 16 mm margin. A host with a browser engine prints the HTML as it is, and the
in-file links stay links within the PDF:

```ts
// Playwright on a server, or a browser-rendering service from a Worker.
await page.setContent(renderSite(store, app, { viewer, files }).html, { waitUntil: "networkidle" });
const pdf = await page.pdf({ format: "A4", printBackground: true });
```

`waitUntil: "networkidle"` lets the pictures load first, since each is fetched
from where the host serves it. A page set as content, or a file opened from a
disk, has no address of its own for a path to resolve against: for a file that
leaves the host, `files.src` answers whole addresses
(`(href) => \`https://app.example${href}\``), or the host puts a `<base>` in
the document.

## A fixed screen: an e-ink reader (Roadmap f-eink-display-profile)

`@graview/pages/device` draws the same place for a reader on a wall, which a
host photographs in a browser of its own and sends as a picture:

```ts
import { renderScreen, resolveTap, tapAt } from "@graview/pages/device";

const screen = renderScreen(store, app, "/tasks", {
  profile: "eink",                        // the one profile there is
  viewport: { width: 758, height: 1024 }, // a Kindle Paperwhite 3, upright, in CSS pixels
  viewer,                                 // the seat the device is paired at: drawn what it is served
  page: 0,                                // a long place is on pages; `screen.page` says which of how many
});
// screen.html → the host's browser at 758 × 1024 → a PNG for the device.
// Later, a tap at (x, y) on that picture:
const region = tapAt(screen.taps, x, y);
const next = region && resolveTap(store, app, region, { viewer, renderId: screen.renderId });
// next: { ok: true, does: "go" | "open" | "page" | "refresh", place, page },
//       { ok: true, does: "act", act, args, label, said, place, page } or { ok: false, refused, place, page }
// `place` is a place to hand back to renderScreen, never a URL to follow.
// An act is answered, never applied: the host applies it under its own seat, and says how it went.
let notice = next && !next.ok ? next.refused : undefined;
if (next?.ok && next.does === "act") {
  try {
    store.apply({ name: next.act, args: { ...next.args } }, { author: viewer, via: "device", intent: next.label });
    notice = next.said;
  } catch (error) {
    notice = `“${next.label}” was not done: ${(error as Error).message}`;
  }
}
const after = next && renderScreen(store, app, next.place, { profile: "eink", viewport: { width: 758, height: 1024 }, viewer, page: next.page, notice });
```

- **A fixed layout, worked out here.** Every row has a height the profile
  sets and is placed at its pixel; every line is one line, cut short by the
  sheet. So each region in `taps` is exactly the box the browser draws for
  it (`pnpm verify device` holds each to its element's box within a pixel),
  and nothing needs a browser to know where a press is.
- **The profile.** Its colors are the sixteen grays (`EINK_GRAYS`); the
  framework does not rasterize, and a browser's antialiased type draws grays
  between them, so the host quantizes the picture to its panel. No transition, animation
  or hover, no script, no font or anything else fetched, nothing under 20 px,
  every press at least 64 px on each side (`EINK_LEAST_TARGET`). The page
  is settled when written: the same picture with and without waiting.
- **What each region does**, exactly one of: `go` a place's address (or
  `job:<name>`), `open` a record's id, `act` an act with every argument
  bound — only one this seat may run, that changes something, loses
  nothing, and asks for nothing typed — `page` another page of this place,
  or `refresh`.
- **`renderId`** is made of what the screen shows (its markup and regions)
  and what it was drawn for (place, page, viewport, reading): the same
  inputs give the same id, and a change the screen does not show keeps it.
  `resolveTap` draws the screen again as the seat now stands. A `go` or an
  `open` that screen does not offer is refused; an act runs only when the
  id is the same and the act is on it with the same arguments; when what
  the screen shows has changed, it judges the act again and refuses it in
  words. `place` in its answer is a place to hand back to `renderScreen`,
  never a URL to follow. An act that holds is answered as the call to
  apply (`act`, `args`, the press's `label`, and `said` for once it is
  done); `resolveTap` applies nothing, so the host applies it as the seat
  it serves and owns what that apply refuses.
- **As its seat.** A screen holds what `viewer` is served: the records and
  fields its sight shows, and in an app that publishes, a reader's last
  publish — so a device can be paired at a reader's seat, not the owner's.
- **A notice.** `notice` is one line said over the head of the screen (how
  the last tap went: "Marked done", a refusal's words), over the app's name.
  It moves no press, and it is part of the picture and its `renderId`.
  A reader's act lands on the head, as every reader's write does: the
  screen it is served shows it with the next publish.
- **The strip** along the foot is the app's `devices.screens` (at most 4,
  each word at most 12 characters as a reader counts them, a full-width one
  as two, `graview check` says one it cannot
  offer), else the home and the app's jobs, else its bar — with Refresh
  last, and the screen it is on marked.
