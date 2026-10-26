# Releases

This is what came in each Graview version, newest first, in a few plain lines for deciding whether to upgrade. Every `@graview/*` package and `graview` share one version, so each version is said once.

Each version links its release and its full changelog. **Before you upgrade** says what breaks or moves for a host; [Stability](https://graview.dev/docs/stability.html) says what a version may change at all.

- [`0.1.58`](https://graview.dev/docs/releases.html#v0-1-58)
- [`0.1.57`](https://graview.dev/docs/releases.html#v0-1-57)
- [`0.1.56`](https://graview.dev/docs/releases.html#v0-1-56)
- [`0.1.55`](https://graview.dev/docs/releases.html#v0-1-55)
- [`0.1.54`](https://graview.dev/docs/releases.html#v0-1-54)
- [`0.1.53`](https://graview.dev/docs/releases.html#v0-1-53)
- [`0.1.52`](https://graview.dev/docs/releases.html#v0-1-52)
- [`0.1.51`](https://graview.dev/docs/releases.html#v0-1-51)
- [`0.1.50`](https://graview.dev/docs/releases.html#v0-1-50)
- [`0.1.49`](https://graview.dev/docs/releases.html#v0-1-49)
- [`0.1.48`](https://graview.dev/docs/releases.html#v0-1-48)
- [`0.1.47`](https://graview.dev/docs/releases.html#v0-1-47)
- [`0.1.46`](https://graview.dev/docs/releases.html#v0-1-46)
- [`0.1.45`](https://graview.dev/docs/releases.html#v0-1-45)
- [`0.1.44`](https://graview.dev/docs/releases.html#v0-1-44)
- [`0.1.43`](https://graview.dev/docs/releases.html#v0-1-43)
- [`0.1.42`](https://graview.dev/docs/releases.html#v0-1-42)
- [`0.1.41`](https://graview.dev/docs/releases.html#v0-1-41)
- [`0.1.40`](https://graview.dev/docs/releases.html#v0-1-40)
- [`0.1.39`](https://graview.dev/docs/releases.html#v0-1-39)
- [`0.1.38`](https://graview.dev/docs/releases.html#v0-1-38)
- [`0.1.37`](https://graview.dev/docs/releases.html#v0-1-37)
- [`0.1.36`](https://graview.dev/docs/releases.html#v0-1-36)
- [`0.1.35`](https://graview.dev/docs/releases.html#v0-1-35)
- [`0.1.34`](https://graview.dev/docs/releases.html#v0-1-34)
- [`0.1.33`](https://graview.dev/docs/releases.html#v0-1-33)
- [`0.1.32`](https://graview.dev/docs/releases.html#v0-1-32)
- [`0.1.30`](https://graview.dev/docs/releases.html#v0-1-30)
- [`0.1.29`](https://graview.dev/docs/releases.html#v0-1-29)
- [`0.1.28`](https://graview.dev/docs/releases.html#v0-1-28)
- [`0.1.27`](https://graview.dev/docs/releases.html#v0-1-27)
- [`0.1.26`](https://graview.dev/docs/releases.html#v0-1-26)
- [`0.1.25`](https://graview.dev/docs/releases.html#v0-1-25)
- [`0.1.24`](https://graview.dev/docs/releases.html#v0-1-24)
- [`0.1.23`](https://graview.dev/docs/releases.html#v0-1-23)
- [`0.1.22`](https://graview.dev/docs/releases.html#v0-1-22)
- [`0.1.21`](https://graview.dev/docs/releases.html#v0-1-21)
- [`0.1.20`](https://graview.dev/docs/releases.html#v0-1-20)
- [`0.1.19`](https://graview.dev/docs/releases.html#v0-1-19)
- [`0.1.18`](https://graview.dev/docs/releases.html#v0-1-18)
- [`0.1.17`](https://graview.dev/docs/releases.html#v0-1-17)
- [`0.1.16`](https://graview.dev/docs/releases.html#v0-1-16)
- [`0.1.15`](https://graview.dev/docs/releases.html#v0-1-15)
- [`0.1.14`](https://graview.dev/docs/releases.html#v0-1-14)
- [`0.1.12`](https://graview.dev/docs/releases.html#v0-1-12)
- [`0.1.10`](https://graview.dev/docs/releases.html#v0-1-10)
- [`0.1.9`](https://graview.dev/docs/releases.html#v0-1-9)
- [`0.1.8`](https://graview.dev/docs/releases.html#v0-1-8)
- [`0.1.7`](https://graview.dev/docs/releases.html#v0-1-7)
- [`0.1.6`](https://graview.dev/docs/releases.html#v0-1-6)
- [`0.1.5`](https://graview.dev/docs/releases.html#v0-1-5)
- [`0.1.4`](https://graview.dev/docs/releases.html#v0-1-4)
- [`0.1.3`](https://graview.dev/docs/releases.html#v0-1-3)
- [`0.1.2`](https://graview.dev/docs/releases.html#v0-1-2)
- [`0.1.0`](https://graview.dev/docs/releases.html#v0-1-0)

## 0.1.58

Published October 26, 2026 · the current version

A Notion database is a connection, kept in step both ways, its tables' relations as links; Find's results stay still under the pointer and offer a record's acts when asked.

- **Notion, both ways.** `connections.<name>` with `"system": "notion"` keeps one Notion data source in step with one kind, through an internal integration's secret that is never written in the document, the log or an export. It speaks Notion's 2025-09-03 API: a database of several data sources names one with `source`. Title, text, number, select and status, multi-select, date, checkbox, URL, email and phone go both ways; people are read; formulas, rollups and files are left alone and said once.
- **Relations as links.** A relation property maps to an edge of the kind, to a kind another Notion connection keeps; a link made on either side arrives on the other, a page not read yet is linked once its table is, and both sides of a two-way relation settle with nothing sent.
- **Pages land through the acts that fit.** A page from Notion becomes a record through an act that makes one from its mapped fields alone, a mapped field is kept in the kind's derived edit even when another act writes it, and a page that cannot become a record is said once until it changes.
- **Find stays still.** Passing over a result only lights it; on a desk a panel beside the list shows the lit record and its acts, and on a phone a record's ⋯ opens them. Matched words are marked, each kind shows its best few with a row to all of them, and the keys are said under the list.
- **A new project's test imports what it calls.**

**Before you upgrade:** Additive: `"system": "notion"` connections, with `source` and edges mapped in `properties`, and the checker's `connection-properties`, `connection-relation`, `connection-relation-target`, `connection-connect`, `connection-disconnect`, `connection-read-only` and `connection-secret`; a `SyncState` may carry `unresolved` and `skipped`, which an earlier build drops; `SyncReport.problem`. Changed: a kind a connection keeps has an `edit-<kind>` that takes every mapped field; `connection-creates` is also said when no act makes the kind from its mapped fields alone; `creatingAct` takes the mapped fields; `ConnectionRun.calendarId` is optional beside `databaseId`. Ops, the wire and the rest of the derived tools are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.58) · [The full changelog for 0.1.58](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0158)

## 0.1.57

Published October 25, 2026

A view can be renamed, and a view of many can be its kind's list page; a computed value is said as its format and rounded; a date emptied in place is cleared; a text block says how many lines it shows; worker views name their sections, choose their pictures and style a disclosure's marker.

- **Renaming a view.** The edit `rename-view` moves every `view:<name>` the document holds (the order, the place the app opens on, the bar) and says so; a taken name or one that is no view's name is refused.
- **A view of many as the list page.** A worker view whose manifest says `replaces: "page"` on `cardinality: "many"` is drawn on its kind's list page in place of the list, as a view of one already replaces a record's page.
- **Computed values read well.** A computed field takes `format` (`money`, `percent`, `duration`), `unit` and `hidden`; `set-format` names a computed field; the rule language has `round(x, places)`. A hidden computed value still sorts a list and feeds a view.
- **Clearing in place.** Emptying a date, a text, a number or an amount where it is shown clears it, one change that can be undone; a field a record cannot be without keeps its value and says so beside it.
- **Text that shows more.** A text block may say `lines` (1 to 12, or 0 for all of it) on a card or a row.
- **Worker views.** A section may be named by its own heading with `aria-labelledby`; a manifest's `pictures` may choose kinds or fields (`["circuit"]`, `{ "circuit": "photo" }`) so the 12 MB go to what the view draws; `::-webkit-details-marker` is kept beside `summary::marker`; a home view that bleeds starts right under the bar on a phone. The worker view skill says to draw a choice by its label from `props.choices`.

**Before you upgrade:** Additive: the `rename-view` edit; `replaces: "page"` on a view of many; a computed field's `format`, `unit` and `hidden`, `set-computed`'s `hidden`, `set-format` on a computed field and `round`; a text block's `lines` and the finding `view-lines`; a manifest's `pictures` as a list or by field; `aria-labelledby` and `aria-describedby` naming the view's own elements; `::-webkit-details-marker`; `EditableField`'s `clearable`, each announced in `capabilities().shipped`. A build that predates them refuses the new keys. Changed: an emptied field in place sends `null` rather than nothing, and an emptied number is no longer read as zero; `aria-labelledby` naming an id the view does not draw is held back. Ops, stored formats and derived tools are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.57) · [The full changelog for 0.1.57](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0157)

## 0.1.56

Published October 25, 2026

An id names its kind; a date may know only its year or month, and an option has a readable label; a brand's suggested shade passes; a view is handed its computed values; the tray, the home's problems and Activity read better.

- **An id says its kind.** An add act's requested `id` must begin with its kind (`actor:apt1`); `apt1` is refused, the refusal names the prefixed form, and nothing in that batch lands. Ids already stored are untouched.
- **Every relation can be linked.** A declared act that makes a record and links it no longer hides the derived `connect-*` act; only one that makes nothing and stands on one end replaces the pair.
- **Partial dates, and clearing.** A `date` holds `2006` or `2016-05` as well as a day, drawn "2006" or "May 2016" and sorted a year before its months. `null` clears an optional field on a derived edit, and `importRows(…, { blanksClear: true })` clears what a blank cell leaves empty.
- **Option labels.** Enum fields take `optionLabels` and `set-options` takes `labels`; pages, pickers, change sentences, group headings, the CSV and a worker view's `props.choices` say them. An option with no label is said from its id: `state-sponsored` reads "State sponsored".
- **A brand's suggestion passes.** A ground is judged on every pair the compiled palette holds, so the shade a refusal names is kept when sent back; an accent is judged on the ground it is drawn on, so a black brand keeps its gold. A light-scheme ground that is dark is drawn as a dark page.
- **Views get computed values.** Every record a worker view is handed carries its computed values, worked out over the viewer's sight, from a lazily loaded evaluator. `unreadEdgesSentence` on `@graview/guest/host/views` names only a relation the view's code uses.
- **Who is here, exported.** `whoFor(store, principal, who)` on `@graview/ship/runtime` is what the wire, `/graview/who` and `/graview/here` call.
- **The actor takes back its own.** `withdrawSuggestion` on `@graview/core/tidying` is the maker's undo, not a decline; `dream()` withdraws its waiting suggestions that fall below the bands it is given.
- **Reading better.** The Suggested tray wraps instead of scrolling sideways; a home says only the problems of the records it draws, on those records; Activity's row for a batch names each merge, removal and archive.

**Before you upgrade:** Breaking: an add act's requested `id` without its `kind:` prefix is refused (callers, templates and agents send `<kind>:` ids). Changed: enum options are drawn by their labels, said from the id when none is given; a dark light-scheme ground draws a dark page; a home's problem banner covers only the records it draws. Additive: partial dates, `null` clearing an optional field, `importRows`' `blanksClear`, `optionLabels` and `set-options`' `labels`, `props.choices` and computed values in worker views, `whoFor`, `unreadEdges` and `unreadEdgesSentence`, `withdrawSuggestion`. Ops and the rest of the wire are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.56) · [The full changelog for 0.1.56](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0156)

## 0.1.55

Published October 25, 2026

An app says who it is for and what they come to do; graview check judges the look and one call composes it; the home opens on those questions; an app learns from what people could not do.

- **Who it is for, and what they come to do.** A document or `defineApp` takes `purpose`: `for`, a sentence about its people, and up to twelve `jobs`, each a question in their words answered by the records of one kind a rule holds for, in an order, with the act they usually take next. `graview check` holds each to the declaration (`job-*`), four edits change them, and `@graview/core/jobs` answers one as the viewer may see it. The seat, the MCP and `describeApp` say the purpose.
- **A judgment of the look.** `graview check` says `design-*` warnings: a place that repeats another, too many places, a home with no focus, a card that repeats its title, a raw value, a main kind with no card, a job nothing answers. Each finding carries the edits that fix it, removals included.
- **One design, composed.** `@graview/core/compose` infers jobs an app never said (`inferJobs`), and `composeDesign` returns the whole change: the jobs, the critic's edits applied until nothing is left to say, an accent where the brand has none. With no declared home, the derived home opens on the jobs: the question as its title, how many, the first records and their act.
- **What people could not do.** A search that found nothing, a question nobody answered, an act refused and an agent's invalid call are kept in the graph's own words, never a visitor's, counted across people (`@graview/core/friction`, `/graview/friction`; `graview serve --no-friction` turns it off).
- **Learning from use.** `@graview/core/learn` turns that log, the op log and the records into suggestions for the declaration (another name for a word several people searched with and found nothing, a choice or a date field for text written that way, one act for two people take in a row), each shown by at least three people, accepted or declined like the app's own actor's; `graview learn` and the `list_app_suggestions` tool offer them. Kinds and fields gain `aliases`.

**Before you upgrade:** Additive: `purpose` and its edits (`set-purpose`, `add-job`, `edit-job`, `remove-job`), `aliases` (`add-alias`, `set-aliases`), a `Finding`'s optional `edits`, `design-*` warnings (`CheckOptions.design: false` leaves them out), `@graview/core/jobs`, `/compose`, `/friction` and `/learn`, `recordFriction` and `attachFriction`, `aiContextOf`'s `purpose` and `friction`, and the `/graview/friction` route. Changed: the derived home of an app with jobs leads with them; `graview serve` writes `friction.json` and `learned.json` beside the store, outside the op log and every export. Ops and the rest of the wire are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.55) · [The full changelog for 0.1.55](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0155)

## 0.1.54

Published October 24, 2026

An app stands on a ground of its own; an app that publishes tells its readers only what is published; history can stop at a plan's window; a view of many pictures draws; collaborators see records in one order.

- **An app's own ground.** `brand.ground` (and `ground` on `set-brand`) gives an app its own page background, one color or a light and a dark one; cards, edges and the bar are drawn from it, a light ground alone gets a dark one of the same hue, and a ground that leaves ink, muted ink or the accent unreadable is refused with a shade that passes.
- **Publishing, honestly.** In an app that publishes when ready, a reader is told of a change when it is published, not when it is made, and is told where a collaborator stands only on what it is served. Text typed together survives a bundler that tree-shakes, and a poll of who is here reads its own op format.
- **History past a plan's window.** A host says where its history stops and the timeline says so quietly, stepping by snapshots before it; an archive may begin at an epoch (`archiveFrom`), so a host can let go of what lies behind it and keep playback, export and restore inside it.
- **Views and typing.** A view with many pictures is pushed at most once every 100 ms and is never stopped as a flood; a field typed together stays open, its caret where it was, while a tour or dialog holds the keyboard.
- **One order for everybody.** A live client lists records in the server's order after a call the server refused, as every other client does.
- **The tray.** What was done while a person was away leaves out what they said not now to, and may be handed over after the first draw (`setWhileAway`).

**Before you upgrade:** Additive: `brand.ground` and `set-brand`'s `ground` (with a `brand-ground` check warning), `HistoryHost.kept`, `ArchivedOps.keptFrom`, `archiveFrom`, `keptOf`, `AppBundle.checkpoint`, `whileAway`'s `dismissed` option, `setWhileAway` on an embed's handle, `readsPublished`, and `PICTURES_SETTLE_MS`. Changed: `askArchived` may answer `behindKept`; a reader of an app that publishes is matched for notifications at the publish; a poll of `/graview/here` that names no op format is answered in format 1; a view handed pictures may get one up to 100 ms later. Ops, stored formats and the wire are otherwise unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.54) · [The full changelog for 0.1.54](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0154)

## 0.1.53

Published October 24, 2026

The scene keeps up on a large app and its grid moves with the picture; views fit a phone and draw more; a store never reuses an id; a visitor's form loads light.

- **The scene on a large app.** A drag sets no React state, letting go costs about a third of what it did, and nothing animates to where it already is. Returning to the overview no longer stalls: its ribbons are routed once, remembered, and routed between frames when new. Every grid under the picture moves with it while it is dragged and does not jump when it is let go. A line lands on the card it joins even when the card's words settle a frame late.
- **Views on phones.** A view's wide content scrolls inside it instead of widening the page; `bleed` works on a view's place; a fallback page keeps its gutters; a view that draws its own heading says `heading: "own"` and is titled once; Seen in names each place once.
- **What a view may draw.** A named `region`, links inside a view's SVG, a card with its link on its heading, `mask-image`, `-webkit-text-stroke`, scroll-driven animation and SVG filters. `@property`, SMIL and `feImage` are refused, and the check says why.
- **For hosts.** A store never names a new change with an id its log already holds; a deleted view never draws, a home's included; an import links a cell to any row of the same sheet, in one batch; a visitor's form loads from `@graview/primitives/form`, about 40% lighter. A view that fell back says which and why (`data-worker-view-fell-back`).

**Before you upgrade:** Additive: `heading: "own"` in a view's manifest, `@graview/primitives/form`, `HomeRegistration` and a registry's `homes()`, `data-worker-view-fallback` / `-fell-back` / `-failed` marks, and the CSS and SVG a view may now draw. A view's `role="region"` without a name, and `@property`, SMIL and `feImage`, are refused where they were dropped. The ground's grids are elements of their own (`.graview-lattice`, `.graview-measure`) where they were the ground's background. Ops, stored formats and the wire are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.53) · [The full changelog for 0.1.53](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0153)

## 0.1.52

Published October 24, 2026

A list exports as a CSV, just as it is shown, and a view hidden from the place menu leaves the bar.

- **Export CSV.** A kind's list on the Pages face, and the lenses that list records, offer Export CSV. The file holds the records the place shows, in its order, filter, search and groups (a Group column first, and a shut group's rows too), the label and then the fields the list reads, said as the page says them. It never holds a field the seat may not see. Cells are quoted for any spreadsheet, with a byte-order mark for Excel, and a cell that would start a formula is escaped. The writing and the download load only when somebody presses it; a host that saves files itself passes `onExport`.
- **A switch per view.** `export: false` on a lens or under `pages.lists.<kind>` turns it off; an owner turns it off or on from the place menu, for everyone, as hiding a view is (`set-lens-export`). `graview check` says a value that is not a boolean, and an `export` on a lens that lists nothing.
- **A hidden view leaves the bar.** Hiding the view that is open put it under Hidden but left it on the bar and the scene's tabs; now every place a person navigates from skips a hidden view (`offeredPlaces`), the page stays where it is, and Show brings it back at once.

**Before you upgrade:** Additive: `export` on a lens and a kind's list (a build before this one refuses the key in a document), the `set-lens-export` edit, `onExport` on `PagesApp` and `mount`, `@graview/core/csv` and `@graview/core/shown` (`shownList`), and `offeredPlaces`. A hidden place is no longer offered by the bar while it is open, where it was. Ops, stored formats and the wire are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.52) · [The full changelog for 0.1.52](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0152)

## 0.1.51

Published October 23, 2026

Several people type into one long text field at once and keep every word: over the wire, in the editor, in words, whatever the network does.

- **Over the wire.** `remote.typing(node, field)` sends a field's typing a run at a time as `type-text`, and the server carries each run over everyone else's, so two pages typing into one field both keep their words, over the socket or the poll. A reader that never said it reads op format 3 is sent the whole text instead of a splice. `@graview/core/typing` loads the first time somebody types.
- **In the editor.** Prose the declaration types together opens with no draft and no Save: each keystroke is the field's at once, somebody else's typing lands as it arrives with the selection carried over it, and Ctrl or ⌘ Z takes back only this person's own last run. Presence carries a caret.
- **In words.** A run of typing is said as what it wrote, where and how much ("Ada wrote in Kitchen's notes (+42 −3)"): one tick in the timeline, one row in Activity with one undo, one notification when the typist stops, and `historyInWords` for an agent's history.
- **Whatever the network does.** A seeded fuzz of three pages typing, with frames held, duplicated and lost and runs taken back at random, found five ways an undo of typing went wrong; all are fixed.

**Before you upgrade:** `transformSplices`, `composeSplices`, `diffSplice` and `isCollaborativeField` move from `@graview/core` to `@graview/core/typing`. A `type-text` behind the horizon is answered `conflict` where it was refused `invalid`; a whole write over a field typed together may now be refused as stale by a server before 0.1.50. `LiveProtocol` gains `floor(peers)`, so a host's own implementation has one more method to write. A notification's field typed into carries `typed` (`{ inserted, removed, spans }`) instead of `before` and `after`. Additive: presence `caret`, the provider's `typing`, `EmbedRemote.typing`, `historyInWords` and the typing words, `holdTypingRuns` and `typingQuietMs`, `StoreHandler.pins()` and `compact`. Ops, stored formats and `WIRE_PROTOCOL` are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.51) · [The full changelog for 0.1.51](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0151)

## 0.1.50

Published October 23, 2026

The 1.0 foundations: formats that fail closed, links with ids of their own, opaque cursors, a publishing lifecycle, and the first two phases of text typed together.

- **Formats fail closed.** A primitive, a typed value or a store format a build does not know is refused with `NewerFormatError` rather than skipped; an author kind it does not know reads as the system's; a refusal code a client does not know is final. Two writers on one log fail loudly with `LogHeadMovedError` instead of writing a second op 1.
- **Links, ids and cursors.** A link may carry an `id` and `data` of its own; an act honors a caller's id when it is free and refuses one that is taken; a page's own ids travel as a hint, so two people adding the same name both land. Positions on the wire are opaque cursors.
- **Publishing.** Under `publishing: { mode: "on-publish" }`, collaborators edit live and everyone else reads the app as of the last `publish`; `?as=published` shows what readers see, and `unpublished(store)` says what is waiting.
- **Text typed together.** A text field takes a `splice-text`, transformed so concurrent typing converges; the `type-text` act in `@graview/core/typing` merges keystrokes, an agent's whole rewrite and undo out of order.
- **Not now.** The Suggested tray hides a suggestion from one person until tomorrow, and a night's tidying is one row in Activity.

**Before you upgrade:** Stored formats: op format 3 — a store this build writes is refused by an earlier one with `NewerFormatError`, so roll back by refolding from the log. The wire: positions are cursor strings on `welcome`, `ack`, `ops`, `/graview/state`, `/graview/since` and `/graview/here`; a server reads a page's old number for one minor. A caller's `id` with a space, over 200 characters, or naming a record the act did not make is refused. A visitor form's ops say author kind `visitor`. `appendOps` takes `{ head }`, and an adapter that ignores it works as before. Additive: edge `id`/`data`, `mintedHint`, `publishing`, `publish`, `servedThrough`, `Store.servedSeq`, `CompactOptions.pins`, `unauthenticated` and `quota`, `collaborative` on a document field, `Dismissal`, `withNotNow`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.50) · [The full changelog for 0.1.50](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0150)

## 0.1.49

Published October 23, 2026

An app tidies itself overnight, judged by a model where one is lent; suggestions and lineage take their 1.0 shapes; every form asks in one order.

- **Dreaming.** `@graview/tools/tidy` gives an app its own actor: `dream()` finds candidates in code and, where the host lends a System One model such as Jev, asks it whether two records are the same thing, which record a field means, whether a record is finished, and which choice fits an empty field. What it is sure of may apply where the host allows; the rest waits as suggestions; without a model, rules do the judging. `whileAway()` says what happened since a person last looked; `suggest_changes` lets a remote actor suggest; `graview dream` runs it from the command line.
- **Suggestions and lineage, as 1.0 keeps them.** A suggestion may expire; "not now" is one person's and leaves it waiting for everyone else; a decline answers by meaning, so the same change asked another way stays declined. Lineage names the run, the judge and the evidence, and keeps keys a later build adds.
- **The model door takes an object.** `Completion` takes `{ prompt, system, images, signal }` and answers `{ text, usage }`; the Fast slot's types live in their own module; the seat's offers are `Offer`.
- **Every form asks in one order**, whatever declared it: the label's fields, then what is required, then the rest. A declaration may name an act in another spelling.
- **Smaller things.** Enter in Find leaves the box in the same press; a wider focus ring stays whole at a view's edge; `graview view check --audit --browser` runs every accessibility rule in Chromium; the host learns what a view hears a click on.

**Before you upgrade:** `Completion` changes shape (an object in, `{ text, usage }` out) and `Suggestion`/`suggestionsFor` in `@graview/tools/suggest` are renamed `Offer`/`offersFor`. Additive: `@graview/tools/tidy`, the `suggest_changes` tool for automated seats, a suggestion's `expiresAt`, lineage's `run`, `actor` and `evidence` (and unknown keys kept), declines matched by meaning, `Dismissal`. A document's act arguments and every generated form ask in a new order. Ops, stored formats and the wire are otherwise unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.49) · [The full changelog for 0.1.49](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0149)

## 0.1.48

Published October 23, 2026

Forms ask the name first, acts answer to the way they're spelled, refusals name the act that would, and a place says its forms.

- **A creating form asks the name first.** Then the required fields, then the rest, in the page's order, whatever order the document keeps its fields in. A key's abbreviation is said as its letters: `cvss` is "CVSS", `sourceUrl` "Source URL".
- **An act answers to its other spellings.** `connect-threat-partOf` runs `connect-threat-part-of`; a name no act has is answered with the nearest one. A relation from a kind to itself is titled from its description: "Set the family it belongs to".
- **Refusals name the act that would.** An edit refused a field another act writes says which act: "whatToDo is set by set-verdict". A number given as its digits ("8.6") is read as the number.
- **Capitals where they belong.** A headline that opens on a count in words starts with a capital; an acronym ("CVEs") is never lowered.
- **A declared row names its record** when its blocks don't, so the picture and its words agree.
- **describe_place says a place's forms**: each creating act's fields in order, required, with their choices; and a visitor form at `forms/<name>`.
- **A hidden lens is hidden where a record is seen**, and a title another lens holds is refused by naming that lens. A draft view takes no title a titled view already has.

**Before you upgrade:** Additive in the API: `actSpelledAs`, `nearestAct`, `numbersSpelled`, `capitalize` and `lowerFirst` on `@graview/core/words`, `blocksName` on `/blocks`, `DescribedForm` on `/describe`, `views` on `DraftOptions` and `DraftTools`. A document's creating acts take their arguments in a new order (name, then required, then the rest), so a generated form and an agent tool's schema list them so; a field's label for a known abbreviation changes ("Id" is "ID"); a number argument given as an exact numeric string is accepted where it was refused. Ops, stored formats and the wire are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.48) · [The full changelog for 0.1.48](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0148)

## 0.1.47

Published October 22, 2026

Custom views work by keyboard with real links and buttons, are as tall as they draw, and can be audited for accessibility; a place is said drawn once its lens has drawn.

- **Views work by keyboard by default.** A control a view draws is reached by Tab and pressed by Enter and Space without scrolling the page; whatever has the keyboard shows a ring a view can restyle but not remove; `.graview-sr` is words for a screen reader alone; an unlabeled `<svg>` is hidden from one; focus stays on a keyed element across a render.
- **Real `<a>` and `<button>`.** Both start as plain words a view styles freely; `<button data-record>` goes where it says; `a[data-record]` and `a[data-place]` carry a real `href`, so a new tab, a middle click and copy link work. An embed that keeps its own addresses hands them in with `hrefOf`.
- **A view is as tall as it draws.** The host measures it. On Pages it flows with the page; on the Scene a view of many or of one record is a card held to its box, faded where there is more, with Open (or Expand where there are no pages). `flows: false` and `scene.maxHeight` are new in the manifest.
- **An accessibility audit of a drawn view.** `auditView` on `@graview/guest/audit`, `graview view check --audit`, and `audit: true` on a headless run: keyboard reach, names, state, nesting, images, scroll boxes, and in a browser the focus ring and contrast, each against its WCAG 2.2 criterion.
- **Checks know a view's place.** A link to a titled view's place is no longer flagged as going nowhere when the host hands the check its views, and `describePlace` describes such a place.
- **A place is said drawn once its lens has drawn.** `data-graview-drawn` and `onDrawn` wait for a declared lens's rows, so `graview shots` and `graview preview` no longer photograph a blank place; a full-page shot shows the whole of a long place.
- **Find hands the keyboard to a place at once.** Enter on a kind in Find no longer leaves the keyboard in the Find box while the place's line is still coming, where the next key a person typed went on a slow machine.

**Before you upgrade:** Additive in the manifest (`flows`, `scene.maxHeight`) and the API (`auditView`, `GoTo.href`, `hrefOf` on the embed and `PagesApp`, `lazyPart`, `PartsWatch`, `viewPlaceOf`, `views` on `runWorkerViewHeadless`). A view's links now carry an `href` and lose the role and tab stop the host added; buttons and host links are reset to their words at zero specificity; Enter and Space on a pressable element are heard as a click; a one-record view on the Scene is a card rather than scrolling inside its box; a framed place's scroll box takes the keyboard and is named. `data-graview-drawn` comes later than before, when a lens draws. Ops, stored formats and the wire are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.47) · [The full changelog for 0.1.47](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0147)

## 0.1.46

Published October 22, 2026

Built-in views share one type scale and one heading per page, a view's own place flows with the page, and the home may keep the line under the name off.

- **Built-in views look designed.** Place headers, blocks lenses, grouped lists, kind lists and record pages share one type scale, one left edge and one heading. A lens's headline becomes the line under the page's title instead of a second heading; a group's heading is its label and its count; a record's name in a row or card is set in the text face; choices in a line of facts are drawn as small chips; spacing follows a 4px scale, given as `--graview-space-1` … `--graview-space-7`.
- **A view's place flows with the page.** A titled worker view at `/places/<slug>` is no longer drawn in a fixed-height frame that scrolls inside itself, which trapped the thumb on a phone. A calendar, a board and the other pictures keep their frame.
- **The home may keep its line off.** `brand.subtitle: false` keeps the description from being drawn under the app's name on the home, so a home view with its own hero no longer says everything twice. The description stays the app's, in its listings and on the name's hover.

**Before you upgrade:** Additive in the declaration: `brand.subtitle`, optional and only `false`; a build that predates it refuses a document that carries it. Additive in the API: `Brand.subtitleDrawn`, the `set-brand` edit's `subtitle`, `PlacePageHead` on `@graview/primitives/pages`, `runs` on a resolved text block whose facts name a choice field, `count` on a grouped list's group in `describe_place`, and the `--graview-space-*` tokens. A titled worker view's place no longer scrolls inside itself. Ops, stored formats, the wire and the derived tools are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.46) · [The full changelog for 0.1.46](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0146)

## 0.1.45

Published October 22, 2026

A form for a visitor, cards that open on a phone's tap, and views that link out, bleed and stack their stylesheets.

- **A form for a visitor.** An app can declare a form — one act drawn alone for somebody with no account — whose answer lands as a record and shows nothing else of the app. `@graview/embed/form` mounts it anywhere.
- **A card opens on a tap.** Any element a view binds to a record or a place opens it on a click, a phone's tap and Enter, from wherever inside it the press lands. Any element bound to an act presses as a button does, and a headless run can press it and say what it would send.
- **Views link out, safely.** A view may link to an address a record it was shown holds, drawn to open in a new tab with no referrer; an address the view built is refused, so a link cannot carry what the view read.
- **Every stylesheet is drawn.** A view that calls `graview.style` twice draws both, in order.
- **A view can go edge to edge on a phone** with `bleed: true`, and a record page draws its slot under a view that does not replace the page.
- **The keyboard goes where an act asks**, and the undo key the offer names is the one the journeys press.

**Before you upgrade:** The `style` message between a view's runtime and its host carries `sheets` where it carried `css`, and `HeadlessTranscript.css` is `sheets`; the two ship together in `@graview/guest`. An element other than an `<a>` bound to a record, and one other than a button bound to an act, now opens or presses and is given `tabindex` and a role; a text field or select with `data-act` and no `data-save` no longer presses. `forms` is a new key in the declaration and the document. `bleed` is new in the manifest; `links` on a worker view's options; `describePlace` takes `views`. Under a view that sits above the page, a fact the page's blocks say is not listed again.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.45) · [The full changelog for 0.1.45](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0145)

## 0.1.44

Published October 21, 2026

A compacted store shows a seat only what it may see, history judged for one seat, and views that stand in the nav.

- **A security fix for compacted stores.** A store opened from a checkpoint could serve a seat the id of a record removed before the checkpoint, inside a field of a record the seat may see. The checkpoint now keeps what it needs to judge that, and an older checkpoint fails closed.
- **History judged for one seat.** `archivedSeenBy` serves a range of the archive, with its checkpoints, as one seat may see it.
- **A view stands in the nav.** A view the host keeps can be ordered among the places and opened first; a kind kept off the places leaves the Pages drop-down and stays reachable at its address.
- **The two-scheme logo** has a capability id and one public reader.
- **The Nightly's engines leg looks twice** before it fails, and keeps its verdicts.

**Before you upgrade:** Checkpoints gain `removed` and `writers` (optional; older builds ignore them); a store opened on an older checkpoint fails closed for a seat whose sight is not total, so a host mends each once. `view:<name>` in `pages.order`, `first` and `primary`; `editDocument`, `compileDocument` and `placesOf` take `views`; a kind in `pages.hide` leaves the bar's places. About 2 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.44) · [The full changelog for 0.1.44](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0144)

## 0.1.43

Published October 21, 2026

A change carries its value once less: smaller histories for every app.

- **A saved change no longer keeps its own undo copy.** It was always worked out from what changed; now it is worked out when undo, playback or a rebase needs it, instead of being stored and sent. An image field's change is about 40% smaller, and a whole history of image edits about 38%.
- **Nothing old breaks.** A store written by an earlier version opens and carries on; exports from earlier versions import and undo the same; a tab on an earlier version is still sent each change with its undo copy written out.

**Before you upgrade:** Op format 2: ops carry no `inverse` (read it with `inverseOf(op)`); `AppendOp.inverse` is gone. A version before 0.1.43 that opens a store or export written by this one refuses it with `NewerFormatError`. A reader says it reads format 2 on the wire (`opFormat`); one that says nothing gets format 1. About 0.5 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.43) · [The full changelog for 0.1.43](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0143)

## 0.1.42

Published October 21, 2026

Pages that say where you are, a logo for each scheme, gestures in views, an open on a short tail, and playback past the undo horizon.

- **A page says where you are.** A derived list, record or picture opens with a "You are here" trail; `usePlaceHere()` and `registry.section` let a design's own shell light its tab.
- **Undo and Find fit a design's bar.** `<PageUndo compact />`, and `className` and `size` on both.
- **A logo for each scheme.** `brand.logo: { light, dark? }`, drawn in the dark by the bar and `AppMark`; a light logo inverted only when the brand asks.
- **Worker views hear wheel, drag and pinch** when their manifest says `gestures: true`.
- **Heavy apps open fast.** A page can open on the snapshot and a short tail of the log (`openTail`), and a view's code is fetched only when it is drawn.
- **Playback reaches past the undo horizon** by asking the host's archive for the older changes.
- **The framework costs half as much to import** in a Worker: schemas are built on first use and zod is shaken to what is called.
- **A recipe:** a product face of its own over a running preview.

**Before you upgrade:** `Brand.logo` is `string | BrandLogo` (read `logoOf(brand)?.light`); a host building its own `Playback` sets `archive: null`; the exported document shapes are `z.lazy`; a field revision is stale only when written after the claim; `openTail`, `HistoryHost.archived` and a lazy `worker` are additive. About 3 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.42) · [The full changelog for 0.1.42](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0142)

## 0.1.41

Published October 21, 2026

The app bar holds still at every width.

- **The app bar no longer flickers.** At some widths the places in the bar stood, squeezed the app's name onto two lines, folded, and stood again, over and over. Whether they stand, and whether the Scene and Pages switch shows its words, is now weighed with the name as it stands on one line, and the room before Find is measured as it is drawn.

**Before you upgrade:** A place near the bar's edge may now fold where it stood, because the row is no longer weighed 8 px roomier than it is. About 0.5 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.41) · [The full changelog for 0.1.41](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0141)

## 0.1.40

Published October 20, 2026

Edits kept the moment they are made, labels that keep their space in a focused scene, a keyboard that reaches what it means, and a first draw with no extra round trips.

- **Stores persist in IndexedDB.** A page's store moves from localStorage to IndexedDB, carried forward intact, so a large one survives in Safari; every edit is journaled the moment it is made, so leaving the page loses nothing.
- **A focused scene gives its words room.** Relation headings sit over their own cards, counts appear once per district, and lines route around labels.
- **The keyboard reaches what it means.** Skip links into a long list, the chosen card and the problems; a menu of acts is one Tab stop. Keyboard presses across the examples' jobs fell from 1,995 to 1,103.
- **The first draw needs no extra round trips.** `firstDrawChunks` names what a face's first paint opens, and early fetches wait for it.
- **Smaller asks:** a drop takes the photo's capture time; the scene opens on the overview and can sit under a host's own bar; `sync-seed`'s dry run refuses what the apply would; `graview preview` stops when told; `graview check` warns of long headlines and templates in code describes; `shots` and `preview` take an app declared in code.
- **Apps that run the framework from source take their aliases from its exports** (`sourceAliases`), including projects `graview create --link` makes.

**Before you upgrade:** The browser adapter keeps stores in IndexedDB (localStorage stores are carried forward) and `loadMeta`/`saveMeta` return promises; the adapter journals ops (`journal`, `loadJournal`); `mount`'s `bar` takes `{ faces?: false, name?: false }`; the scene with no path opens on the overview (`where().stop` is `#overview=1`); `spatialHref(id, sceneHref)`; `sync-seed` exits 1 on a seed the declaration refuses; `ServedStore.close({ grace })`; new check findings `describe-template-in-code`, `view-headline-long`, `lens-column-written-unsaid`. The hosted page carries about 2 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.40) · [The full changelog for 0.1.40](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0140)

## 0.1.39

Published October 20, 2026

Cards that answer the menu under a base, full-size photos in views, views that save as you type and take a drop, and a page that says when it has drawn.

- **Cards answer the right-click menu on a hosted page.** A board or blocks card served under a base path offers its acts and Move to ›, a new tab keeps the base, and a finger resting on a board card opens its menu, so a phone moves cards again.
- **Full-size photos in views.** A view that shows record pictures draws them at any size, and the headless check says when a page would leave one out.
- **Views save as you type.** A field marked `data-save="input"` saves when the person pauses, and the view hears whether it saved.
- **Drop photos and videos onto a view.** A view marks where files may land; the host takes them, stores them and makes one record per file, in one undoable change, with a picker on a phone.
- **The page says when it has drawn.** `data-graview-drawn` and `onDrawn` replace a timer for anyone picturing a place, and a page can open on a view proposed and not yet kept.
- **add-lens refuses an option the lens does not take.**
- **Authoring skills split at their limit**, so each teaches one job.

**Before you upgrade:** `mount` takes `onDrawn(place)` (the old first-commit callback is `onFaceDrawn` on `<Embed>`), `draftView` and `handle.setDraftView`; `@graview/embed` depends on `@graview/guest`; `add-lens` refuses an unknown option (`lens-option-unknown`, an error) and `lensOptionsRefused` judges a patch; a worker view's manifest takes `accepts`, and `graview.act` takes a list of arguments as one change; a board card's long press opens its menu; code acts that move a board's cards need `sets` (`lens-column-written-unsaid`). The hosted page carries about 4 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.39) · [The full changelog for 0.1.39](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0139)

## 0.1.38

Published October 19, 2026

Boards without buttons that search and filter, places that hide and restore views, a menu that offers what exists, and the last of inline AI.

- **Boards without buttons.** A card moves by drag, by the keyboard or from its menu's Move to, with no Move button under every card, and a board takes search, filter and column options, showing search by itself once it is big.
- **Places that tidy their views.** Right-click a place to hide or delete a view; Hidden and Recently deleted (kept 30 days) sit at the foot of the places list.
- **A menu that offers what exists.** Before drawing a new view, the right-click menu offers the one the app already has.
- **The last of inline AI.** Several records chosen get suggestions for the set, one quiet hover chip can offer the likeliest next step, and the menu's AI part fills in well under 400 ms.
- **graview.dev shows the interface is generated, then reshaped by asking.**

**Before you upgrade:** A columns lens draws no Move button unless `move: true`; lenses take `options`; `keptViews` on `mount`, the provider and the Shell, with `/graview/views` and `remoteViews`; `ai.hoverChips` (off by default); places carry `lens`, `reads`, `name` and `declared`. The hosted page carries about 2.7 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.38) · [The full changelog for 0.1.38](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0138)

## 0.1.37

Published October 19, 2026

Times in the app's own time zone, acts for every relation, video on records, and lines that wait for a view that draws late.

- **Times in the app's zone.** An app says its time zone once; lists, record pages, act answers and views say times there, `{at | time}` and `{at | datetime}` read them out, and a rule's `today()` turns at the app's midnight.
- **Every relation can be linked.** Each relation comes with its own connect and disconnect acts, so an app can link two records without writing an act for it.
- **Video on records.** A video field plays on a record's page, and a view can place a host-drawn player and a full-screen viewer.
- **Lines that wait.** A view that draws its members late, as on a slow phone, still gets its lines.
- **The twelfth walk** (a film festival at real size) found seven problems, all fixed, among them a date editor that refused a stored time, a repair offered and then refused, and records of one name told apart by their ids.

**Before you upgrade:** `brand.timeZone`, `timeZone` on the provider, `mount` and `PageContext`; derived `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>` acts appear in act lists and tool surfaces, and `edge-without-severer` is no longer reported; a `video` field type; `seenBy` is generic over the store. The hosted page carries about 7 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.37) · [The full changelog for 0.1.37](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0137)

## 0.1.36

Published October 18, 2026

A record's pictures load under the host's base on every face, and a view draws the pictures and app images it was promised.

- **Pictures load where the host serves them.** An app served under a path (`/a/<app>/`) drew its records' pictures and documents from the site's root; `HostFiles.src` now says where, and `filesAt` works it out from its own address, so a host that already uses it needs no change.
- **Views get their pictures.** A view that asks for pictures receives each image's `src`, live and in a preview, and a picture the host doesn't answer for is said with what the host answered.
- **Views draw the app's own images in every form** they are written in, and a refusal only offers what the host actually draws.

**Before you upgrade:** `HostFiles` takes `src`; `fileSrc` on `@graview/core`; views take `file`; `runWorkerViewHeadless` takes `asset` and `origin`; `sayRefusal` takes the host's `{ origins, assets }`. The guest host's first load is about 0.4 KB larger.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.36) · [The full changelog for 0.1.36](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0136)

## 0.1.35

Published October 18, 2026

A relation to another app can be made by an edit, a host may say later whether it still keeps a file, and playback asks for a past declaration when it gets there.

- **A cross-app relation from an edit.** The `add-relation` edit, the studio and anything that sends edits can now relate a kind to another app's kind (`"to": ["@nick/house/house"]`), refused with the checker's own words when it can't be. Migrations no longer drop such a relation's links.
- **Files a host answers for later.** `HostFiles.kept` may return a promise: a picture is drawn as itself until the host answers, then as removed later if it was, and each file is asked once.
- **Past declarations on demand.** Playback asks the host for a past version's declaration when it reaches it (`declarationAt`), so a page no longer carries every version up front.

**Before you upgrade:** `add-relation` accepts a `to` of `"@<address>/<kind>"`. `HostFiles.kept` may return `Promise<boolean>`. `HistoryHost` takes `declarationAt`. Nothing breaks; the hosted page carries about 0.5 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.35) · [The full changelog for 0.1.35](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0135)

## 0.1.34

Published October 18, 2026

The right-click menu tells a visitor how to get in, draws a panel where it was asked, spends no thinking-model call on opening, and is ready before the click.

- **A visitor is told how to get in.** A host passes `signIn` while nobody is signed in; a reader who may do nothing sees one sign-in row in the menu and at a list's foot instead of every act struck through, and is not offered Notify me.
- **A panel drawn from the menu stays on its face.** On Pages, "Draw a panel" opens the draft page with Keep as a lens and Discard; over the scene the draft is framed as a panel; a failed ask is said in the menu.
- **Opening a menu costs nothing.** With only a thinking model, suggestions wait for a "Suggest…" press; with a Fast slot they are asked once per record until it changes.
- **The menu is ready before the click.** Resting on a record, focusing it or touching it prepares its menu, so it opens complete.
- **The eleventh walk** (an animal shelter at real size) found six problems, all fixed: finding a past record by name, filtering a status board, offered repairs that were refused, a misnamed heading, Tab from a chosen box, and the scaffold's own test under a policy.

**Before you upgrade:** `mount`, `<Embed>`, `GraviewProvider` and `PageContext` take `signIn` (`SignIn` from `@graview/core`). `HostAi.suggestOnOpen` is new; with only a thinking slot the menu no longer suggests as it opens. The hosted page carries about 0.2 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.34) · [The full changelog for 0.1.34](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0134)

## 0.1.33

Published October 17, 2026

A read-only calendar takes its own changes under a policy, and a host keeps Notify me in its own store.

- **A read-only connection works under a policy.** A calendar the app only reads now brings its own changes in when the app declares who may do what, and a change the app refuses is reported as refused rather than as the calendar being unreachable.
- **Notify me on a hosted page.** `mount` takes the host's subscription store, so subscriptions made from the right-click or a record page are kept by the host on both faces; keeping them that way adds no parser to the first load, about 9.4 KB less than before.

**Before you upgrade:** `SyncReport.refused` may now name an inbound change (`SyncRefusal`, with the remote `resource` and `id`), and `offline` is true only when the remote itself fails. `mount` and `<Embed>` take `subscriptions`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.33) · [The full changelog for 0.1.33](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0133)

## 0.1.32

Published October 17, 2026

Ask with ⌘K and the right-click, be told when things happen, a faster first load, the GPU by default, and a Google calendar kept in step.

- **The AI where you are working.** ⌘K opens a bar beside what you're on that completes its acts, places and records; anything else is asked, and the answer is a card beside the record or list. The right-click offers suggestions, fills, new records and panels, picked only from what you may see and do. Every proposed change is previewed first, accepted all or some, and undone in one step, and Activity keeps each AI interaction.
- **Notify me.** Subscribe to an act, a kind or a record in two presses from a right-click, a record page or chat. A change by someone else that you may see tells the host once.
- **Faster.** First load to interactive is 31–38% faster on a desk and on a slowed phone, held by a CI budget, and the scene draws on the GPU where the browser can, with unfocused planes blurred.
- **Dates and calendars.** One date and date-time editor everywhere that reads "tomorrow 3pm" or "Fri 10:30" and shows times in your zone. A Google calendar can be declared in the app (a calendar, a color or #tag filter, read-only or both ways) and kept in step by `graview serve`, proven against Google itself.
- Twelve controls covered by another were fixed, and graview.dev shows the inline AI and gains this page.
- **Fewer presses to add a record.** A list's Add button now stands beside its heading, so making a record from the keyboard on the pages takes 10–14 presses where it took 17–22.
- **The GPU only where clicks land.** A Chrome whose capture build would hit-test where a view was laid out rather than where it was drawn now draws on the DOM path, so a press, a screen reader and a focused field always meet what is on screen.
- **Signs, panels and embeds that stay out of the way.** A sign at the map's edge steps past a district's name, "Go to it" hands the keyboard straight on to the record it went to, a lens is drawn in the room it has from its first frame, and an embedded app draws nothing over its host page.

**Also in it: 0.1.31**, which was versioned and never published, so its changes shipped here. Ask with ⌘K and the right-click, be told when things happen, a faster first load, the GPU by default, and a Google calendar kept in step. The quick ask and the right-click AI, notify me, a faster first load, the GPU by default, one date editor and a Google calendar kept in step, all described under 0.1.32.

**Before you upgrade:** The old seat's input, its panel and their settings are removed, along with the routed face's own copy: `quickAsk` replaces their setting on the Shell, the pages and the embed, and `quickAskOf` reads a stored one. The full list of removed names is in the changelog. The Shell's and the embed's `renderer` defaults to `auto`. A document's `datetime` is asked for with the date editor. The hosted page carries about 3.5 KB more up front (1.3 KB gzipped).

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.32) · [The full changelog for 0.1.32](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0132)

## 0.1.30

Published October 15, 2026

Play an app back, link across apps, an actor that tidies, and graview.dev as a Graview app.

- **Playback.** Open the app as it stood at any moment, and restore it to there.
- **Linked records.** A relation can point at a kind in another app, read there as whoever is looking.
- **An actor that tidies.** The app's own actor suggests fixes, which a person accepts or declines.
- A first look for a new app, an emoji as the app's mark, kind lists you can sort and group, navigation with filters and sections, a right-click menu on Pages and images by URL.
- Eighteen author requests and a run of scene and lens bugs fixed, a screen-reader pass, and the GPU path past 128 live views. graview.dev itself is now a Graview app.

**Before you upgrade:** `Store.at` and `Store.seqAt` are replaced by `pastOf` and `seqAt` on the new `@graview/core/past`. A role that removed, archived or merged other people's records only through the act that makes the kind now needs those acts named in its grant.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.30) · [The full changelog for 0.1.30](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0130)

## 0.1.29

Published October 14, 2026

A large release of field types, list tools and data features, on a lighter page.

- **New field types:** links to another app, Markdown text, phone, place and duration, and money, percent and unit formats; dates and numbers said the US way.
- **Records:** archive and merge records, lineage and provisional links, repeating dates, field-level sight, acting on several records at once, and `importRows` for bringing data in.
- **Lists:** fuzzy search, filters that scale to large lists, and cards you can read at a glance.
- `renderPlace` writes a place as static HTML, guest views can show pictures, and `store.tick` reports what changed.
- The map is laid out along the ground, and the hosted page is lighter up front than 0.1.28 despite everything added.

**Before you upgrade:** Breaking for imports: `edgeWords` and `valueWords` move to `@graview/core/words`, and the address helpers (`withShown`, `withQuery` and the rest) move out of `@graview/layout`; nothing is aliased. The scene's map is laid out anew, so a `sceneThumbnail` draws a different picture. Ops, stored formats, the wire and tool schemas are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.29) · [The full changelog for 0.1.29](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0129)

## 0.1.28

Published October 13, 2026

The people kind, grants and sights are named edits.

`editDocument` gains `set-people`, `add-grant`, `remove-grant`, `add-sight` and `remove-sight`, so who may do and see what can be changed as a named, previewed edit instead of a raw patch. Each is previewed in words and refused with the checker's own codes.

**Before you upgrade:** Ops, stored formats, the wire, the document format and check codes are unchanged. The edit vocabulary gains five ops, and an edit's refusal can now carry a specific code where every refusal was `edit`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.28) · [The full changelog for 0.1.28](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0128)

## 0.1.27

Published October 12, 2026

People in a document, bounded seat reads, and links that say why they did not go.

- A document can name the kind that stands for its people, and its acts can say `$me` for the person acting.
- A grant can hold to your own end of a link, and a sight can reach the records that link to you.
- A seat's reads are bounded, and a worker view's link or navigate says why it did not go.

**Before you upgrade:** Breaking: `answerSeenBy` moved to its own entry, the read tools' answer shapes changed, `useSeatConversation` requires `said`, and `$me` is reserved as an argument name.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.27) · [The full changelog for 0.1.27](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0127)

## 0.1.26

Published October 12, 2026

Pictures and files on records, and a failed AI turn says why.

A kind can carry pictures and documents: `imageField()`, `fileField()`, the image block, and uploads through the host's files seam. When a host's AI turn fails, the seat shows the host's own explanation.

**Before you upgrade:** Breaking for imports only: the form helpers (`formFields` and its neighbors) moved to their own entry. Ops, stored formats, the wire, the document format and tool schemas are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.26) · [The full changelog for 0.1.26](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0126)

## 0.1.25

Published October 12, 2026

The app on a phone: the seat closes and the screen fills.

On a phone, the open seat is put away by its close button, a tap on its grab line or a pull down, and the keyboard goes with it. An app fills the phone after it rotates.

**Before you upgrade:** Tool schemas move to `@graview/core/json-schema`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.25) · [The full changelog for 0.1.25](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0125)

## 0.1.24

Published October 12, 2026

Every seat judged over what it sees, problems that open on their fix, and a fit on the smallest phone.

- What a seat is told is worked out over what that seat can see.
- Pressing a problem opens its repairs, wherever the record sits, and a record is renamed by pressing its name.
- The bar and the home's counts fit a 320-pixel phone at the largest text size.
- Names, yes-or-no fields and facts read in plain words. Also sync fixes.

**Before you upgrade:** Ops, stored formats, the wire, the declaration, check codes and tool schemas are unchanged; only where some types are declared moved.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.24) · [The full changelog for 0.1.24](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0124)

## 0.1.23

Published October 11, 2026

The seat's turn, without the weight.

`turnThroughMessages` has its own entry, `@graview/tools/turn`, under 2 KB, so a host can wire the seat's turn up front without loading the whole tools package on first paint.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.23) · [The full changelog for 0.1.23](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0123)

## 0.1.22

Published October 11, 2026

Preview and doctor, typed documents, and a seat that reads before it answers.

- `graview preview` serves a document and a seed with Graview's own faces over them, no product needed, and `graview shots` photographs places headless.
- `graview doctor` says whether a product is on one Graview release.
- Documents are typed from the editor to the face, can declare facts about the whole graph, and give kinds a natural time and author field. Declared blocks have stable keys.
- The seat reads records with tools before it answers, the sync engine resolves conflicts as it is told, and kinds with no records fold into More.
- A security and correctness review of 0.1.21.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.22) · [The full changelog for 0.1.22](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0122)

## 0.1.21

Published October 11, 2026

Who's here on every bar, axe-clean markup, and a way back in the scene.

- Who else is here shows on the bar on both faces and on a phone.
- The framework's own markup passes axe-core for WCAG 2.0 to 2.2 A and AA, at desktop and phone widths, light and dark.
- The scene gets its own way back, and the overview has an address that survives a server round trip.
- A broken rule states its values to a host that reads only its message, and a read-only role is no longer warned for doing nothing.

**Before you upgrade:** Ops, stored formats, the wire, the document and compiled formats, check codes and tool schemas are unchanged; some presence and test-id behavior a harness reads moved.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.21) · [The full changelog for 0.1.21](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0121)

## 0.1.20

Published October 10, 2026

List pages lead with their records, and rules read like sentences.

- A list page puts its records first instead of a tall header of title and related links.
- A rule written in the rule language says its shape in plain words.
- An agent opening a new product finds what to read at the root.
- Fixed: a connect that replaces now replaces the right link, one mistake gives one check finding, and the scene from an empty address lands where the scene opens.

**Before you upgrade:** Additive: the document format gains an optional `pages.primary`, and check gains two warnings about it. Which places stand on the bar changed.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.20) · [The full changelog for 0.1.20](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0120)

## 0.1.19

Published October 9, 2026

The seat floats, takes you where you ask, and draws views you can keep.

- The seat is no longer a rail down the scene's edge: it floats, quietly, on both faces.
- Ask it to go somewhere and it goes, matching the request against what the declaration and the graph already name, without a model.
- Ask it for a way of seeing and it drafts a view that can be kept as a lens. Who-and-when questions are answered from the graph with no model.
- The host chooses the AI once, instead of the reader picking from a menu. The whole-page shell wears the one app bar, and the hosted page carries 9.5 KB less before the app draws.

**Before you upgrade:** Breaking for the components and API a host's seat reaches: the `Companion` family is removed for the floating seat and `HostAi`. Ops, stored formats, the wire, the document format and tool schemas are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.19) · [The full changelog for 0.1.19](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0119)

## 0.1.18

Published October 8, 2026

A lens picker in the scene, and prose that reads like prose.

The scene gets its own place control. A selected record is drawn once. Long text keeps its paragraphs. Parts that fail to load retry safely (`@graview/core/retry`), and no import cycles run at load time.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.18) · [The full changelog for 0.1.18](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0118)

## 0.1.17

Published October 8, 2026

Graview's identity, and Scene and Pages side by side.

The framework's own look follows the third revision of its design kit and is exported as data. The scene and the pages read as two things on the bar.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.17) · [The full changelog for 0.1.17](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0117)

## 0.1.16

Published October 8, 2026

One app bar, and brands you can edit by name.

One bar on every face, with the scene as a place beside the others. Named acts for an app's name and brand, contrast refusals that name the failing pair of colors, icon-sized app pictures, and search results that carry their address. The framework now spells in American English.

**Before you upgrade:** Breaking: names spelled the British way are renamed with no aliases (`normalize`, `summarize`, `humanizeField`, `colorsIn` and others). The undo dock is a fixed popover rather than a box in the page's flow.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.16) · [The full changelog for 0.1.16](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0116)

## 0.1.15

Published October 7, 2026

Clearer refusals, one problem count.

Refusals that come from a rule now say so. The number of problems appears in one place. A host can hand the page an already compiled app.

**Before you upgrade:** Breaking for a caller that sent an act an argument it does not declare: it was dropped and the act ran; now it is refused as `invalid`, naming what the act takes.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.15) · [The full changelog for 0.1.15](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0115)

## 0.1.14

Published October 7, 2026

Ranges, derived edits and fewer pills.

Number fields declare their ranges. A derived edit per kind covers every field nothing else sets, and refuses what it cannot take. A design pass, from building a real product, took words out of capsules.

**Also in it: 0.1.13**, which was versioned and never published, so its changes shipped here. Status-board moves and an address bar for the routed face. A status board's columns say which lens they are in, and an act that sets the board's field is offered as a move. Scene thumbnails can be fitted to what stands. A host whose page is the app can give the routed face the browser's address bar.

**Before you upgrade:** The arrangement functions moved from `@graview/core` to `@graview/core/arrange`. From 0.1.13: `@graview/react/provider` no longer exports `UrlSync`, `useUrlSync` or `adjustment` (`@graview/react` still does).

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.14) · [The full changelog for 0.1.14](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0114)

## 0.1.12

Published October 6, 2026

A lighter hosted page: the checker and the seat's tools leave the main entry.

What only a fetched face, an agent's seat or the checker uses moved out of `@graview/core`'s main entry into subpaths named for what they hold, so a hosted page loads less up front.

**Also in it: 0.1.11**, which was versioned and never published, so its changes shipped here. A status board lens, currencies, and set walks in the rule language. A shipped `columns` lens draws a kind's records as a status board. Money fields take a currency, and the app has a default one. Figure labels are templates. The rule language walks a relation from every member of a set. The checker warns when an act reads a kind a role may not see.

**Before you upgrade:** Breaking for imports, with no aliases: `checkApp`, `formatFindings`, `describeApp` and the docs generators move to `@graview/core/check`, and other names to their own subpaths. From 0.1.11: `@graview/primitives/frame` exports `themeBaseCss` in place of `themeCss`, and a worker view's failure reads `start` where it read `refused`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.12) · [The full changelog for 0.1.12](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0112)

## 0.1.10

Published October 6, 2026

Declared lenses and homes, and worker views you can trust with HTML.

- A lens, a home view and the arrangement of pages declared in a document now draw, and a view can list related records.
- The rule language computes what pages need (sums over expressions, sorting), and kinds can declare computed fields.
- A worker view can draw HTML, SVG and CSS with nothing able to fetch or leave its region; it needs no build, is a named place with a manifest the host enforces, stops past its limits, and can be run once headless to say what it drew.
- `describePlace` says what one place shows one seat, without a browser. Every new document feature has an edit.

**Before you upgrade:** Additive within the document format and check codes. The guest-view protocol gains messages; derived tools gain one read tool, `describe_place`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.10) · [The full changelog for 0.1.10](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0110)

## 0.1.9

Published October 5, 2026

A host speaks in the app's own notices, menus and pictures.

A host can show its notices in the app's own voice, put its own actions in the profile menu, and draw a picture of an app without a browser. Every popover opens above everything else and behaves the same way, and the seat's rail can be put away.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.9) · [The full changelog for 0.1.9](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#019)

## 0.1.8

Published October 5, 2026

Guest views run in a worker, for chats that cannot nest a frame.

A guest view can run in a worker as well as a frame, hardened before guest code runs and built as one classic script. The component kit it draws with is declared once and the host draws nothing else. A host says where its links may go, and a guest that stops answering is stopped.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.8) · [The full changelog for 0.1.8](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#018)

## 0.1.7

Published October 5, 2026

A read-only app says so.

An open page is told that the app takes no changes for now, and why. An op that names a missing record is served as it is.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.7) · [The full changelog for 0.1.7](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#017)

## 0.1.6

Published October 4, 2026

A host's refusals in its own words, and an embed that keeps to its box.

A host can refuse a change in its own words, an Apply with nothing changed asks the host nothing, and the embed's stylesheet stays inside its element.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.6) · [The full changelog for 0.1.6](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#016)

## 0.1.5

Published October 4, 2026

The studio in a host's page, and half the weight.

A field changes in place in the studio, the host decides who is offered the studio and can refuse a change, and what the studio will not change is said up front. A hosted page carries 536 KB up front instead of 1,075 KB, with each face fetched as it is first drawn, and the framework builds its schemas in zod/mini.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.5) · [The full changelog for 0.1.5](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#015)

## 0.1.4

Published October 4, 2026

Security: a seat learns nothing about records it may not see.

- A seat is never served the id of a hidden record, and no refusal, sentence or checkpoint reveals whether one exists.
- A change is acknowledged only once it is durable, a busy host's wait is read correctly, and a hibernating host can resume its sockets.
- Refusals on the wire are written for people, and the studio hands a host back a document.

**Before you upgrade:** The wire and live protocols narrow what a seat with sights is sent; no field is added or removed. `remove-kind` removes more of what depended on the kind.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.4) · [The full changelog for 0.1.4](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#014)

## 0.1.3

Published October 4, 2026

A live store a host can run, observe and deploy.

Refusals carry a code a program can branch on, a busy host is told apart from a refusal, presence can include agents, the declaration can change under open tabs, a remote client can be observed and can catch up, and the wire says when the client and server are on different builds.

**Before you upgrade:** Breaking for a client that named its own channel: `via` in a call is ignored, and a client sends `x-graview-via` to a server that trusts seat headers.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.3) · [The full changelog for 0.1.3](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#013)

## 0.1.2

Published October 3, 2026

The declaration as a document, a live wire, and guest views.

- **The declaration is a document:** one JSON object that compiles into the same app `defineApp` declares, with an edit vocabulary of twenty-one operations, rules written as expressions, and templates as data.
- **A live wire:** `openRemote({ live: true })` pushes every op to every browser as it lands, MCP is served over HTTP, and logs can be folded and compacted.
- **Guest views:** `@graview/guest`, a view somebody else wrote, in a sandboxed frame that can only ask.
- A SQL adapter, stored formats that carry their version, a conformance kit, and `docs/stability.md`, the promise a version keeps.

**Also in it: 0.1.1**, which was versioned and never published, so its changes shipped here. A record read whole, in its own words. A kind declares what a glance at one says, forms and lists say values in the record's words, lists narrow by numbers and words, and a policy says who may see what as well as who may do it.

**Before you upgrade:** Breaking: a store served without `seatOf` answers 401 until it passes `trustSeatHeaders: true`, `graview serve` binds 127.0.0.1, a host's `seatOf` receives a web `Request`, a full palette needs the `good` and `bad` tokens, and a kind no sight names is seen only by the system.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.2) · [The full changelog for 0.1.2](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#012)

## 0.1.0

Published October 2, 2026

The first public release of the framework on npm.

Graview's first release to npm: a framework where a typed context graph is the interface rather than the backing store. One declaration per kind drives the layout, the legal actions, the agent tools and the accessibility labels. `graview` is the tool and `@graview/*` the framework, all at one version, under the Elastic License 2.0.

**Also in it: 0.0.1**, which was versioned and never published, so its changes shipped here. The work before the first public release. It was numbered once in the repository and never published.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.0) · [The full changelog for 0.1.0](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#010)

---

What came in each Graview version, newest first: a few plain lines each, what a host must know before upgrading, and links to its release and its full changelog.

The page: https://graview.dev/docs/releases.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
