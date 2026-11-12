# Pages and lenses are one: the view

Status: design note for the Pages+Scene unification (Graview HQ
feature:f-page-zooms-out-to-the-city). Part of it ships with the prototype on
`build/pages-and-the-scene-are-one-place`; the rest is the plan. Pre-1.0: no
shims, no aliases. The format upgrade does the moving.

## What a person sees now

There is one face. A routed page is read over the Scene's own city, and one
camera moves the page itself between three levels, every step drawn, the
same element all the way:

| Level | Name on the control | What it is |
|---|---|---|
| 0 | Page | The page, the whole window under the bar. |
| 1 | Nearby | The same page as a panel (a sheet from the foot on a phone), the city beside it, a line from each part of the page that shows a record to that record's building, and a Connected list grown into its foot. |
| 2 | City | The whole city. Every page and view of the app stands as a view on its district (a view of several kinds, or of none, on the plaza at the city's back edge). The page you came from shrinks into its own. |

- The bar (the app's name and menu, Find, the inbox, the standing, the
  person) stays fixed at the window's top at every level.
- One control at the bottom left, `Page · Nearby · City` and a Key, says
  where you are and goes to any level. Alt+↑ and Alt+↓ move one level.
  Escape comes down a level from Nearby, and at the City it lets go of the
  chosen view.
- A wheel with ctrl, or a pinch, scrubs between Page and Nearby on the page.
  At the City the camera is free: it zooms toward the pointer and never
  goes down a level. Going down a level is choosing something.
- Anything chosen at the City (a view, a building, a Find result) lands at
  Nearby for that view or record.
- The Scene's own record "drive-in" (the dark card with "Why this is here" /
  "The list it is on" tiles, the district shelf, Up and Key) is not drawn on
  this face. A record chosen in the city is its own page. What the drive-in
  showed under the record, its related records by relation, is the Connected
  list at Nearby, each row with its line. The district shelf is dropped,
  because the city's districts are the shelf.
- While the app's history is played, a building rises out of the ground as
  the scrub passes the change that made it, and sinks as it passes the one
  that removed it. It is the same element throughout, and reverses if the
  scrub turns back. Views rise and sink the same way. The timeline stands
  beside the control at every level.

## The declaration: one concept, `views`

Today a kind has derived routed pages (its list at `/<plural>`, a record at
`/<plural>/<id>`) and, separately, lenses declared as places (`lenses[]`
with a `title`, at `/places/<as>`). Both are now the same thing to the face:
each is a view that stands at the City and comes down to Nearby and Page. The
level system and the control read the bar's places (`barPlaces`), so lists
and lenses are handled alike. Nothing is special-cased per face.

The declaration converges on one list:

```jsonc
"views": {
  "items": [
    // A kind's list: what was derived, now said (and still derived when unsaid).
    { "id": "tasks", "title": "Tasks", "of": "task", "draws": "list" },
    // What was a lens.
    { "id": "the-week", "title": "The week", "of": "task", "draws": "calendar", "options": { "range": "week" } },
    // A blocks view (what `name: "blocks"` lenses were).
    { "id": "at-a-glance", "title": "At a glance", "draws": "blocks", "options": { "blocks": [/* … */] } }
  ],
  "home": [/* unchanged */],
  "kinds": {/* card, row, page specs: unchanged */}
}
```

- `id` is the address word (`/places/<id>` today; `/<id>` once lists and
  views share one namespace). `of` is the kind (or kinds) it stands on in the
  city. `draws` is `list`, a shipped lens name, `blocks`, or `view:<name>`
  for a host's worker view.
- `hidden`, `export`, `create`, `arrangedBy`, `bindings` and `on` keep their
  meanings and move onto the item unchanged.
- A kind with no `list` item still gets its derived list. Only a
  `hidden: true` list item hides it, so a declaration written the old way
  keeps working through the upgrade.
- `pages.scene` / `pages.pages` (the switch's words, FR-137) go: there is no
  switch on the one face. `pages.order`, `primary`, `first` and `hide` name
  views by `id`.

## The migration (format 1 → 2)

`@graview/core/document`'s `upgradeDocument` gets its first step,
`UPGRADES[1]`, a pure function from format 1 to format 2. The host records
the result as a new version authored by the system, so the upgrade is
history like any other change and can be compared and rolled back:

1. Each titled `lenses[i]` becomes `views.items[]`: `{ id: placeSlug(title),
   title, of: on ?? bound kinds, draws: name, options, bindings,
   arrangedBy, hidden, export, create }`.
2. A lens that duplicates a kind's list (a `blocks` lens of exactly one
   `{ list: "all('<kind>')" }`) becomes that kind's `list` item, keeping its
   title, and is not kept twice. Two lenses that draw the same picture under
   two titles become one item, keeping the one the arrangement names (else
   the first), and the other's `id` is recorded in `aliases` so old links
   resolve.
3. `pages.scene` and `pages.pages` are dropped. `pages.order/primary/first/
   hide` entries that named a lens by title are rewritten to its `id`.
4. Untitled lenses (bindings the checker holds, no place) stay in `lenses`.

Stored data is untouched: views are declaration, not records, so no
op-log migration of the graph is needed. The op log of a hosted document
gains one system-authored version.

## The duplicate finding (shipped now)

`graview check` reports `view-duplicates-another` (warning) when:

- a view is only a kind's list (a `blocks` lens whose one block is
  `{ list: "all('<kind>')" }`). The message says to keep the kind's list
  page.
- two views draw the same lens of the same kinds with the same bindings,
  options and arrangement under two titles. The message says to keep the
  one the arrangement names, else the one said first.

Each finding carries `edits: [{ "op": "remove-lens", "title": "…" }]`, the
mechanical fix a host applies (Cloud's `apply_change`, the studio, `graview
check` prints it as `edit:`). When the arrangement (`pages.first` or
`pages.primary`) names the duplicate, it is a note instead, with no edit: point
the arrangement at the list first. Tested in
`packages/core/tests/document/two-views-that-show-the-same-thing-are-found.test.ts`
and held by `pnpm verify one-face` (`aDuplicateViewIsFound`).

## What Graview Cloud changes

1. Nothing to set where it hosts an app as the page itself: a routed face
   that owns its page and has `views` is the one face. Stop drawing the Scene/Pages switch: pass
   `bar: { faces: false }` to `@graview/embed` until the embed draws the one
   face in a box (below).
2. Run `upgradeDocument` on read (it already does) once format 2 ships. The
   stored document upgrades itself, and Cloud records the system-authored
   version it returns. No hand migration of users' documents.
3. Surface `view-duplicates-another` with its `edits` as a one-press fix,
   the way it surfaces other findings with edits.
4. Its document builder writes `views.items` instead of `lenses` and stops
   writing `pages.scene` / `pages.pages` once format 2 ships.
5. Links Cloud keeps to `/places/<as>` keep working: `as` is the item's `id`.

## What breaks for a host

- A `PagesApp` that owns its page and has `views`: the bar has no Scene/Pages switch, no
  "In the scene" link, and no Up on the bar. The page's bar is portaled to a
  fixed slot at the window's top. A `pages-design` shell that measured the
  bar inside its own flow sees a spacer of the bar's height in its place.
- `@graview/embed`: unchanged in this pass. The one face positions the page
  and the city against the window (`position: fixed`), so it is not yet
  drawn inside a host's box. The embed keeps its faces, and a host that wants
  no switch already says `bar: { faces: false }`. Making the one face live in
  a box (the embed's root as the camera's frame) is the next step.
- Format 2 (when it ships): `lenses` with titles move to `views.items`, and
  `pages.scene` / `pages.pages` are gone. Code declarations (`defineApp`)
  change by hand, guided by the check.

## Upgrading to 0.2

**An author on the dev kit** (`graview create`, a code declaration):

1. Nothing to turn on: a `PagesApp` that owns its page and is handed `views`
   is the one face. If your app also serves the Scene's own face at `/`, send
   people to `/pages/places/overview` (the examples do this). Drop any link
   of your own to "the scene".
2. Run `graview check`. A `view-duplicates-another` warning names a view
   that shows only what a kind's list page already shows, or two views of
   the same picture, and says which to keep. In a code declaration, delete the
   lens it names. The finding's `edit:` line is the same change for a
   document.
3. Nothing to migrate in your data. The views are declaration, not records.

**Graview Cloud** (documents, hosted for strangers), staged one app at a time:

0.2.0 changes no stored format. An app's document as it is today compiles,
draws on the one face, and runs beside an app already moved. Nothing is
rewritten when a document is read.

1. **Read, as today.** `upgradeDocument(stored)` (from
   `@graview/core/document`) runs on every read, in memory. In 0.2.0 it has
   no format step, so it returns the document as stored. It is idempotent:
   reading it twice gives the same document. It is not written back.
2. **See what moving an app would do.** `compileDocument(document).findings`
   includes `check:view-duplicates-another`, a **warning** that never fails
   the document. Each finding carries `edits` (for example
   `[{ "op": "remove-lens", "title": "Root causes" }]`) and says which view
   stays. A note without `edits` means the arrangement names the duplicate;
   point `pages.first`/`pages.primary` at the list first.
3. **Move one app, when staff choose.** Collect the edits:
   `findings.filter((f) => f.code === "check:view-duplicates-another").flatMap((f) => f.edits ?? [])`.
   Then apply them through the host's own change path: Cloud's
   `apply_change`, or `editDocument(document, edits)` and store the result.
   Record it as a new version authored by the system ("one view per
   picture, 0.2"). Applying it again finds nothing and changes nothing.
4. **Take it back** by reverting that version in the app's history, as for
   any change. Records are untouched either way.
5. **Leave the rest** as they are until chosen. A moved app and an unmoved
   app run on the same host, on the same 0.2.0 packages.

When format 2 ships (a later version), step 3 becomes `UPGRADES[1]` in
`upgradeDocument`, so a host gets the same result by storing what a read
returned. The staged rule stays the same: upgraded in memory on read, and
persisted per app by an explicit host call.

Held by
`packages/core/tests/document/a-staged-move-to-one-view-per-picture.test.ts`:
an unmoved app compiles with the folds as warnings, a moved and an unmoved
app compile side by side, and reading a document twice changes nothing.

## Deferred past 0.2.0 (named follow-ups)

- **embed-one-face-in-a-box**: the one face drawn inside a host's element.
  It positions against the window today, so `@graview/embed` draws the plain
  routed face with no switch, and Cloud's hosted pages get no city yet.
- **close-up-live-views**: a view up close at the City as its live,
  interactive page.
- **format-2**: `views.items` in the stored format, done by `UPGRADES[1]`.
- **scene-harnesses-onto-the-one-face**: the Scene-face harnesses
  (navigation, scene-hands, drive-in, chrome, menu, seat and others) still
  drive the Scene's own face at the root. A person at the root of Things or
  the discography is sent to the one face; a driven browser is not.
- **district-views-menu**: the district label's legacy menu of views,
  routed through "choose a view".
- **worker-view-lines**: lines from a worker view's `data-record` parts,
  reported by the guest host through the frame.
- **custom-view fixtures** through the harness: a worker view, a product
  React view, and a pages-design app.
- **calendar-labels**: the calendar's time labels, and building names that
  collide at Nearby.
- **crowded-cities**: the City with many views (rota, the discography) on a
  phone; one phone view stands nearer the wrong district.
- **find-enter**: Find's Enter lands on its results page at Nearby, not on
  the record.

## Not done in this pass

- A view up close in the city is a live sign (its title and its records'
  names, drawn as text, crisp at any zoom). It is not yet the interactive
  page in place. Mounting the real page (or a worker view's frame) inside a
  sign near the camera, interactive once it is drawn at about 60% or more of
  its natural size, is the next step.
- Worker views (sandboxed frames) are not yet read for lines. The line
  finder reads the record marks in the host's own DOM (`data-graview-pick`,
  `data-graview-record`, `data-record`). A frame's parts need the guest host
  to report part rects, mapped through the frame's transform.
- The calendar's time labels can still collide (10:00 and 10:30), and record
  names over the buildings can still overlap at Nearby. Those are fixes in
  the calendar lens and in the Scene's `namesWithRoom`.
- On a phone, an app with many views (rota, 13) needs more room than the city
  beside them: the City fits all of it and the city is drawn small.
