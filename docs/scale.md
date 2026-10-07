# Scale: a picture draws what a person can read

A design, written 2026-09-29, from a real catalog rather than a fixture.
Tech N9ne's discography from MusicBrainz — 1,177 songs, 568 artists, 479
releases, about 5,000 edges — is small for a real domain and broke the scene.
This is what was measured, what a person should see instead, how the scene
gets there at 60 frames a second, and the holes found in the design three
times over before any of it was built. It shipped the same day; what
shipped, and where it departed from the design, is recorded under
[What shipped](#what-shipped).

## What was measured

Production build, Chromium, 1440×900, frame times from a `requestAnimationFrame`
recorder with vsync off (so a frame is as long as the work in it):

| stop / gesture | DOM elements | hosts | line paths | frame p50 | worst |
|---|---|---|---|---|---|
| home (altitude), drag | 21,340 | 5 | 19 | 18 ms | 520 ms |
| descend to the ground | 21,760 | 6 | 19 | 319 ms | 539 ms |
| ground, pan | 635 | 6 | 7 | 0.2 ms | 19 ms |
| focus Tech N9ne (1,100 neighbors), pan | 12,036 | 1,259 | 4,433 | 928 ms | 1,524 ms |
| select a song there | 9,836 | 1,259 | 2,223 | 965 ms | 3,908 ms |
| type "the" in Find there | 12,458 | 1,259 | 4,433 | 996 ms | 1,471 ms |

Where it goes (from reading the code, then confirmed by the counts):

- **The drive-in thumbnails draw every member.** A kind card at altitude
  carries a live miniature of each named lens, handed all of the kind's
  members: the artists' card alone was 11,944 elements — "who worked with
  whom" drawn at 6% size. That is the smear under the cards in the
  screenshot that started this.
- **Plane 1 is uncapped.** Every neighbor of the focus is a host; 1,100
  of them wrap into ~275 rows whose height goes negative (`rowH` has no
  floor). Each gets a line; the line layer clips every strand against every
  box (65 samples × all obstacles), so it is quadratic in the neighbors.
- **A transition re-renders the scene every frame.** `useAnimatedLayout`
  sets React state per animation frame for 520 ms; the lines, captions and
  pick targets measure the DOM in layout effects on every one of those
  renders; every plane-1 and plane-2 host carries an interpolated CSS blur.
- **Smaller costs that scale with N:** `connectorsFor` copies a bundle's
  edge array per edge (O(E²) in one bundle), `interpolate` scans members
  per node (O(N·M)), every host's memo signature joins its aggregate's
  member ids per frame.

Altitude with the thumbnails out of the way is already fast: districts cap
their villages at 24 buildings and their open grids at 16 chips.

## What a person should see

### The rule

**A surface draws as many marks as a person can read in the room it has,
and says what the rest are, in the graph's own words.** Below that number
nothing changes — a small app looks exactly as it does today. Above it the
surface summarizes, and every summary is a real place: a card you can press,
a stop Back returns to, a count that is true, and the search and the row that
bring the individuals back.

### The budget

Each surface derives its budget from its size, never from a constant an
app sets:

- **The relation band** holds as many cards as fit at a readable width
  times as many rows as fit at a readable height: `perRow × rows`, with
  `perRow` the cards of at least the crowd width (`0.75 × relationSize.width`)
  that fit the span, and `rows` the rows of a chip's height (26 × the
  reader's text unit) the band's height holds, never fewer than two. A
  crowded band already draws its cards as chips, so a chip is the floor. At
  1440 wide that is about 20; on a phone, 4–6. The row height never falls
  below a chip's (it went negative before).
- **A drive-in thumbnail** is handed at most 12 members — enough for a lens
  to draw its shape, never the population (it is 58 pixels wide; a matrix
  of 12 × 12 is 144 cells where 24 × 24 was 576). It is a picture of the
  lens, not the lens, and the thumbnails mount one per frame once the
  scene is still. (Since FR-118, in 0.1.14, there are no thumbnails: a
  drive-in's marquee says its showings by name, and the lens is drawn
  only on the billboard, at its own size, once a showing is pressed.)
- **An opened district, a Group view, a village** keep the caps they have
  (16, 6, 24) — they were already right.
- **A focused picture** — a lens drawn full size — is the person's chosen
  view, and the lens owns its drawing. The built-in lenses honor a
  `budget` in their props and say "+N"; an app's lens is told the budget
  and the lens skill says what to do with it.

The budget is computed from the SETTLED layout of the stop, not per frame,
so nothing appears or disappears while the scene is moving.

### Over budget, the band groups

When the neighbors of the focus do not fit, the band does not shrink them
to confetti. Within each relation (the runs the band already has, one per
edge kind and direction), it groups the far ends by the best of what their
declaration already offers — `arrangeable(kind).groups`:

- another edge of theirs (songs → the release they are on, artists → …),
- a choice or boolean field (release type, status),
- a date field, bucketed by year (and a decade bucket when years are too
  many) — the arrangement gains `year` and `decade` buckets for this.

The grouping chosen is the one whose groups best fill the budget share:
at least 2 groups, at most the share, the most members in named groups
(not "none"), then the declared `arrangedBy.group` of a lens over that kind,
then the order `arrangeable` lists them in — deterministic, so the same
graph always draws the same band.

Each group is an **aggregate** — the kind the layout already has — with an
id that names what it is (`aggregate:song|by|in|tracks:album:everready`),
its members, and a label in the declaration's words ("On Everready: The
Religion · 16"). It is drawn by the Group view that already exists. Pressing
it is the existing `expanded` toggle: an ordinary stop, in the address, that
Back undoes. Expanded, its members take the band, grouped again if they
still do not fit.

When no grouping yields at least two groups, the band draws the most
relevant `share − 1` members and one **"+N more"** aggregate for the rest,
which opens the same way.

**Relevance**, for which members stand as themselves: the selection and
what it reaches, then search hits, then flagged, then recently touched
(the op log's `touchWeights`), then the most connected to the rest of what
is drawn, then the natural order. Stable by id.

### Lines follow marks

A line is drawn to a mark on screen and to nothing else. A group card takes
ONE line per relation, captioned with its count ("× 16"), not sixteen
converging on it. The band can therefore never draw more lines than it has
cards; the quadratic line layer becomes linear in what is drawn.

### Search and arrangement bring individuals back

`q` already lights hits; over budget, hits are the first to stand as
themselves, and a group that holds hits is lit with its hit count. The row's
filter and the Find box narrow the band's population before it is grouped,
so "Tech N9ne's songs with Eminem" is two words away from being individual
cards. Nothing hides: every group says what it holds and opens.

### The kinds shelf and altitude

The shelf's kind cards stop carrying live full-population thumbnails; the
marquee thumbnails are budgeted and mounted only when the district is on
screen and the scene is still. Opened districts keep their 16/24 caps and
say "+N" — already so.

## How it runs at 60 frames a second

In order, each step measured before the next is taken:

1. **Bounded hosts.** The budget bounds every stop to ~60 hosts at most
   (one focus, ≤24 band cards and groups, ≤ the shelf's row), so the render
   cost of any frame is bounded by construction rather than by the data.
2. **Nothing measures while moving.** Lines, captions and pick targets are
   measured when a stop settles, not on every tween frame; the line layer
   fades out as a transition starts and in when it lands (it cannot be
   right mid-flight anyway — both ends are moving). Pick targets are
   re-collected when a view's content changes, not after every render.
3. **Hosts are memoized** on what they draw, and their callbacks are
   stable, so a frame that moves them re-renders position only.
4. **The linear algorithms:** `connectorsFor` bundles with a map, not a
   copied array; `interpolate` looks members up by id; a host's signature
   is its aggregate's count and a hash, not a join.
5. **Depth without per-frame filters.** A plane's blur is a class chosen
   when it settles, not an interpolated inline `filter`; hosts get
   `contain: layout style`.
6. **Gate:** if a transition's p95 frame is still above 16.7 ms with 1–5
   done, the tween leaves React — positions written as transforms per frame,
   the way the pan already is. Not before: it is the riskiest of these, and
   the budget may make it unnecessary.

## What proves it

A harness, `scripts/verify-scale.mjs`, against a real catalog in the
repository (`apps/discography`, Tech N9ne from MusicBrainz, CC0), writing
`docs/scale.json`:

- `theCityAtAltitudeIsLight` — the home stop is under 3,000 elements.
- `aHubStopIsBounded` — focusing Tech N9ne draws at most 60 hosts and 120
  line paths, and the band says what it grouped.
- `everyGroupOpens` — pressing a group card is a stop; its members appear;
  Back closes it.
- `panningHolds60` / `wheelHolds60` — p95 frame ≤ 20 ms (headless Chromium
  paces an idle frame at ~19 ms even with vsync off), worst ≤ 50 ms, at
  altitude and at the hub.
- `aTransitionHolds60` — rise, descend, focus change: p95 ≤ 20 ms after
  the first frame; the first frame (layout + render of the new stop) ≤ 150 ms.
- `aSelectionAndASearchAreCheap` — selecting and typing at the hub: no frame
  over 50 ms after the first.
- And the existing chain unchanged: a small app draws what it drew.

## What shipped

The same catalog, the same recorder, `docs/scale.json`. All eight claims
hold; "first" is the one frame the new stop lands in (the longest frame in
the 100 ms after the gesture — with vsync off the recording's own first
frame comes before the gesture has happened).

| stop / gesture | DOM elements | hosts | line paths | first | p95 | worst after |
|---|---|---|---|---|---|---|
| altitude, still | 1,161 | 5 | 0 | 19 ms | 19.6 ms | 20 ms |
| altitude, drag | 1,163 | 5 | 0 | 36 ms | 19.5 ms | 20 ms |
| altitude, wheel | 1,171 | 5 | 0 | 8 ms | 18.9 ms | 20 ms |
| descend | 632 | 6 | 0 | 19 ms | 19.2 ms | 20 ms |
| focus Tech N9ne | 646 | 36 | 50 | 57 ms | 19.0 ms | 20 ms |
| hub, drag | 650 | 36 | 50 | 20 ms | 19.5 ms | 37 ms |
| hub, move a card | 650 | 36 | 50 | 19 ms | 19.6 ms | 20 ms |
| hub, wheel | 654 | 36 | 50 | 19 ms | 19.5 ms | 20 ms |
| hub, select | 609 | 36 | 50 | 19 ms | 19.4 ms | 20 ms |
| hub, type in Find | 1,045 | 36 | 56 | 66 ms | 18.7 ms | 38 ms |
| rise | 2,493 | 6 | 0 | 20 ms | 1.6 ms | 42 ms |

Where the build departed from the design, and why:

- **The thumbnail budget is 12, not 24.** At 24 the city still drew most of
  a lens per district; 12 is a picture you can read at that size.
- **The band's budget counts readable rows**, `perRow × rows` with a row of
  26 px at the scene's unit, rather than `perRow × 2` — two rows grouped
  the todo fixture's twelve raised tasks, which fit.
- **A held card moves alone.** Dragging the focus laid the whole stop out
  again every frame; `holdLayout` moves the one node and re-aims the lines
  that touch it, and the full layout runs once, on release.
- **Two costs the design did not name** were most of the landing frame:
  the focus's kind tag read two bounding boxes after every render (a forced
  layout on every tween frame — now placed when the panel resizes), and
  every view that asked for violations evaluated every invariant over the
  whole graph, each picture as it mounted (now once per change).
- **The blur snaps to the nearest plane** rather than becoming a class: it
  is under half a pixel, and snapped it changes once per transition, which
  was the point. `contain` on hosts was not needed and was not added.
- **Lines hide while the scene moves** rather than fading: with both ends
  in flight they cannot be right, and a fade is a paint every frame.
- **Hosts were not memoized further.** Bounded at 36 at the hub, and with
  the signature keyed by count and hash, the render was no longer where the
  frame went; stable callbacks were left for when a stop needs them.
- **The gate was not taken.** With the rest done every transition's p95
  fits, so the tween stays in React.

## What a crowd taught the band

The first cut held every claim in `docs/scale.json` and still struggled in
the running app, because the harness measured frames and counted hosts and
nobody looked at the band. Walked stop by stop, with screenshots:

- **The rows were a chip's height, and so were the group cards.** The
  budget counted chip rows, and every slot in a crowded band was drawn at
  that height — "Draped Up and" and "Strange Days Tour: A", names cut, the
  count gone. A crowded row is now as tall as a group card's two lines
  (52 px at a 16 px rem), and the card is two lines: name and ▾ or ↗, then
  "29 albums · The Storm · Everready …".
- **Relations began mid-row, and their captions sat on the row above.**
  A relation now starts its own row unless all of it fits the rest of the
  current one, and the gutter between rows is a caption's height (22 px).
  The rows are planned by `packRuns` and `bandCaps` before anything is
  drawn: water-filled shares, trimmed until the packing fits.
- **A song in a crowded row drew its summary card, cut to a sliver.** A
  record standing in a crowded band is `compact` and drawn as a chip, and a
  chip is never wider than its slot.
- **An album's songs grouped by artist** read "Tech N9ne, 38 songs" and six
  cards of "1 songs". A grouping where one group holds three quarters of
  the members is not offered; the most relevant stand beside "35 more songs".
- **"Who worked with whom" drew 80 by 48** — 12,000 elements and a
  quarter-second task, every row repeating the same 48 names. The coverage
  matrix now draws 40 by 24.
- **The calendar's months spilled into each other.** In a grid held to the
  lens's height an auto row is sized to a cell's minimum; rows are now as
  tall as what is in them. The example's horizon covers the career.

Small apps keep exactly the band they had: all of this applies only past
what fits as chips.

### And in the running app

Walked again in the example's own dev server, stop by stop:

- **Tracklists painted solid black.** A panel's scroll fade was a CSS mask,
  which made the scroller its own layer; painted before its rows arrived,
  it stayed black. The fade is now painted in the panel's own ground. The
  example's tracklists come a page of 24 releases at a time.
- **The Albums district's two pictures never drew.** A thumbnail waiting to
  be seen was a one-pixel box drawn at a twentieth of its size, which the
  browser counts as no area. It is as tall as a picture now.
- **Eras and Themes were piled on the Songs card** of a shelf with room for
  all five. A kind tucks behind another only when the row needs the room.
- **Thirty years of months** was 360 cells, most of them empty. A horizon
  past a decade draws a year to a cell.
- **Costs the walk found:** "who worked with whom" built its matrix by
  scanning every credit for every artist (140 ms, now 7); a kind's card
  looked up all 1,177 songs on every frame; a tween recomputed a group's
  centroid on every frame. None of them survives a profile now: the stops
  measured have no long task in the production build.

## Not in this

- The GPU capture path. The DOM path is what ships.
- Virtualizing an app's own lens. The budget is offered; the lens draws.
- Fields on edges (a track number is the song's place on ONE release). The
  example numbers a song on its first album or EP; the domain limit stays
  recorded for the next walk.

## Holes, and how each was closed

### First pass

1. *A budget from the room changes while the room changes — cards would pop
   in and out mid-transition and during a pinch.* The budget is read from
   the settled layout of the target stop only, and the grouping is part of
   the stop, not of the frame.
2. *A derived grouping can flip when one node is added (2 groups ↔ 1), so
   the band reshuffles under a person's hand.* Choice is deterministic and
   ordered (declared `arrangedBy.group` first); a grouping is only abandoned
   when it stops producing two groups, and the "+N more" fallback keeps the
   relevant members where they were.
3. *Relevance could hide the thing a person just made.* Recently touched
   ranks above degree; the node just created is the most recently touched.
4. *Group cards could be dead ends for the keyboard and a screen reader.*
   They are the Group view and the `expanded` stop that already exist —
   focusable, named ("On Everready: The Religion, 16 songs"), Escape backs
   out of an expansion in the documented order.
5. *Small apps must not change.* Below the budget the band is exactly
   today's band; the existing harness chain is the criterion that it is.

### Second pass

6. *The budget is small (10–12 at a desk). Is a band of groups useful, or
   does it just move the scroll into clicks?* The groups carry the answer to
   the question the band asks — "what is this tied to" — at a glance: "on 23
   releases, 1999–2026", "with 146 artists". Individuals come back through
   search or one press. A band of 1,100 unreadable chips answered nothing.
7. *`expanded` is also the altitude "open district" toggle — does reusing it
   collide?* Group aggregate ids are distinct (`aggregate:<kind>|…`) from
   kind cards (`kind:<kind>`) and focus aggregates (`aggregate:<kind>`);
   `withOverview` already strips `kind:` expansions only.
8. *Lines to a group: selection ties and "what the selection reaches" name
   member ids.* The tie resolves to the drawn group card the way
   `connectorsFor` already resolves edges to aggregates; emphasis lights the
   group when any member is implicated, with the count of lit members.
9. *Hiding lines mid-transition could look like a flicker at 520 ms.* They
   fade (120 ms) out and in on the ground's own easing; the pan already
   moves them with the world, so only real re-layouts fade.
10. *Removing the interpolated blur changes the look.* The blur stays; it
    stops being re-written every frame — each plane's blur is a class, and
    a card changing plane crosses it once at the midpoint the fidelity
    already flips at.

### Third pass

11. *Thumbnails handed 24 members: a lens that reads the store itself (the
    coverage reads its columns from the graph) ignores what it was handed.*
    The coverage's own cap (80 × 48) already bounds it; the thumbnail is
    also only mounted on screen and still, and the harness's element count
    is the criterion that holds whatever a lens does.
12. *The Group view's "+N more" inside a group card, the band's "+N more"
    card, and the district's "+N" are three different sentences for one
    idea.* All three say "+N more" with the reading of what they are
    ("+1,084 more songs") and open the same way (expansion or descent).
13. *Grouping by an edge back to the focus is meaningless (songs grouped by
    "by Tech N9ne").* The relation's own edge kind is excluded from the
    candidates, and so is any grouping where one group holds everything.
14. *A hub with 1,100 songs grouped by release yields 300+ releases — over
    budget again.* Grouping by an edge far end whose own count exceeds the
    share is scored lower than a date bucket; with none fitting, the year
    or decade bucket wins, and failing that, "+N more". Nested expansion
    (a group opened, still too many) groups again with the next best.
15. *The performance claims could pass in headless Chromium and fail on a
    laptop.* The recorder measures work per frame with vsync off, which is
    stricter than a display's cadence; the thresholds are per-frame work,
    not frame rate.
