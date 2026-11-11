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
- **No DOM, no React.** The entry imports only `@graview/core` and two of its
  entries. A test bundles it and renders in a bare context with no `window`,
  `document`, `process` or `require` (`packages/pages/tests/unit/a-place-is-rendered-to-static-html.test.ts`).
  Bundled for a Worker it is about 83 KB minified, 31 KB gzipped, most of it
  zod. Nothing on a hosted page imports it, so a page's up-front weight is
  unchanged.

## A fixed screen: an e-ink reader (Roadmap f-eink-display-profile)

`@graview/pages/device` draws the same place for a reader on a wall, which a
host photographs in a browser of its own and sends as a picture:

```ts
import { renderScreen, resolveTap, tapAt } from "@graview/pages/device";

const screen = renderScreen(store, app, "/tasks", {
  profile: "eink",                        // the one profile there is
  viewport: { width: 758, height: 1024 }, // a Kindle Paperwhite 3, upright, in CSS pixels
  viewer,
  page: 0,                                // a long place is on pages; `screen.page` says which of how many
});
// screen.html → the host's browser at 758 × 1024 → a PNG for the device.
// Later, a tap at (x, y) on that picture:
const region = tapAt(screen.taps, x, y);
const next = region && resolveTap(store, app, region, { viewer, renderId: screen.renderId });
// next: { ok: true, does: "go" | "open" | "page" | "refresh" | "act", place, page } or { ok: false, refused, place, page }
```

- **A fixed layout, worked out here.** Every row has a height the profile
  sets and is placed at its pixel; every line is one line, cut short by the
  sheet. So each region in `taps` is exactly the box the browser draws for
  it (`pnpm verify device` holds each to its element's box within a pixel),
  and nothing needs a browser to know where a press is.
- **The profile.** Sixteen grays (`EINK_GRAYS`), no transition, animation
  or hover, no script, no font or anything else fetched, nothing under 20 px,
  every press at least 64 px on each side (`EINK_LEAST_TARGET`). The page
  is settled when written: the same picture with and without waiting.
- **What each region does**, exactly one of: `go` a place's address (or
  `job:<name>`), `open` a record's id, `act` an act with every argument
  bound — only one this seat may run, that changes something, loses
  nothing, and asks for nothing typed — `page` another page of this place,
  or `refresh`.
- **`renderId`** is the same for the same store state as the seat sees it,
  declaration, place, seat, profile, viewport and page. `resolveTap` runs an
  act only when the screen the app draws now for that seat has the same id
  and the act on it; against a newer store it judges the act again as the
  seat now stands and refuses it in words.
- **The strip** along the foot is the app's `devices.screens` (at most 4,
  each word at most 12 characters, `graview check` says one it cannot
  offer), else the home and the app's jobs, else its bar — with Refresh
  last, and the screen it is on marked.
