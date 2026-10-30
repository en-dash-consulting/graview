# graview-lists

`graview-lists` is one of Graview's 31 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Keep a Graview app's lists usable as it grows — what a list offers to filter by, the order and groups it opens in, cards read at a glance, several records acted on at once, a list printed as a static page or exported as CSV, and a date that repeats rather than a record each time — and verify each with graview check and the page itself rather than assuming it.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Lists that stay usable as an app grows

A list that worked at twelve records stops working at three hundred: Filter lists every record at the far end of every relation, each card prints a thirty-line summary, and a weekly practice is fifty records. None of this needs a custom page: the declaration says what the list offers and the order it opens in, the templates how much of a long text a card shows, and a date repeats. Setting records aside, merging a duplicate and the app's own actor tidying are `graview-tidying`.

### Do this

1. **Say what a kind's list filters by.** In a document:

```json "pages": { "lists": { "request": { "filters": ["status", "area", "became", "became.stage"] } } } ```

In TypeScript, the same under `defineApp({ pages: { lists: … } })`. Each key is a field, a relation, `is`, or `<relation>.<field>` — a choice on the record at the far end ("The feature it became · Stage: Building"). The choice fields among them stand over the list as chips with counts; the rest are under Filter, each heading closed until pressed, with a box that finds a filter or a far record by a few letters. Unsaid, a list offers every way but a relation to a kind with more than forty records (offered by that kind's choices instead), and its first two choice fields as chips. An address says the same: `/requests?filter=status:open`.

**Say the order and grouping it opens in**, beside its filters:

```json "feature": { "sort": { "by": "rank", "direction": "desc", "then": "name" } }, "request": { "group": { "by": "status", "order": ["planned", "new"], "closed": ["done", "declined"] } } ```

`sort` is a field, a computed field (a rank the kind works out) or `label`, lowest first unless `"desc"`, with a `then` for ties; `group` is a choice or yes-or-no field (`"true"`, `"false"`). `order` puts its groups first; `closed` ones are drawn last and shut, each a button saying "done · 12 requests" that opens it (`?open=done` keeps it open; words in the Find box open them all). A person still sorts or groups the list another way from its arranging line. The edit is `arrange-pages` with `sort: { "<kind>": … | null }` and `group: { "<kind>": … | null }`.

1. **Let a card say a long text's start.** A card shows a `text` field in three lines at most and a row in one, cut with an ellipsis. Say it on purpose with the `excerpt` formatter — `{summary|excerpt}` is its first sentence or about 140 characters cut at a word, `{summary|excerpt: 80}` at most 80 (20 to 1000) — and leave the whole text to the record's page. A list block draws 100, then "Show 58 more" (`limit` up to 1000); `group: "inGenre"` heads it by linked record. Markdown prose says so — `{"type": "text", "format": "markdown"}`, or `markdownField()` — and the record's page draws it as prose (headings, lists, links, code; no HTML), while a row, a card, a describe line and a search hit say its first paragraph or about 160 characters with the syntax taken out. A card with no blocks of its own says its kind's `glance` — exactly those fields, nothing after them; prose there is a line under the chips, never a cut chip. A choice another chip beside it shares (a severity and a confidence, both "high") says its field: "Confidence: high". A related record in a template is said by its kind's `label`: `{out('affects') | and}` is "src/files.ts and tsconfig.json"; a count starting a headline, `{n | words | capital}`, is "Two findings". A place titled as a kind's list is keeps the name on the bar, and the list folds into More as "All root causes" (`pages-place-named-as-a-list`).

1. **Print a place when a fixed link wants one.** `renderPlace(store, app, "/requests", { viewer, locale })` from `@graview/pages/static` answers `{ html, css, title, found }`: one self-contained page, no script, in the app's look, under the viewer's sight, the same words the routed face says. It imports no React, so a Worker renders it on each change. A `design` puts it in the product's own markup — `records[kind](record, site)` writes a record's page, `document(page)` what goes around it — which is how graview.dev renders its pages (`apps/site/design.mjs`).

1. **Know what a kind opens to before you draw it a picture.** Gone into with no lens of its own (`#focus=aggregate:room`), a kind opens to its stop: its plural, count and description; its creating act first ("Add a room"), asked in place; how many are overdue or due this week on its due date; its problems counted by rule, each opening its repairs; what changed since this reader last looked; and a picture its data chooses — a board by its main choice (`status`, `stage`, `state`, `phase` or the lifecycle's field) up to 300 records, a calendar where today's month has short records on its main date, else a table of its glance and its relations, 50 rows at a time. "Keep as a lens" declares that picture (`add-lens`). So give a kind a lifecycle or a `status`, a `glance`, and a creating act with a `title` before you write it a view.

1. **Let several be done at once — it is already there.** A kind's list, a kind's stop and a board choose records: a box at each row's start on a desk, Shift for a range, Cmd/Ctrl-A, Escape; the boxes one Tab stop, the arrows between them, Space to choose; a long press on a phone. The bar offers the acts every chosen record shares (`actsForSeveral` in `@graview/tools/several`): acts on the subject alone ("Mark it done") and those that ask once for all ("Move the date…"), "Move to <value>" for the kind's state field, archive, merge and remove behind More. One press is `actOnSeveral`: one batch, one undo. A record the act may not run on (the policy, the seat's sight, the act's own refusal) is named and stays chosen; the rest apply. A seat does the same with `act_on_several` (`{ act, records, args }`). So declare acts on a `subject` with as few other arguments as they need.

1. **Let a weekly practice be one record, not fifty.** A date that repeats is `{ "type": "date", "repeats": true }` (or `"datetime"`) in a document, `startsAtRepeat: repeatField()` beside `startsAt` in TypeScript. The record keeps its first occurrence in the date and the rule beside it: `"startsAtRepeat": { "every": "week", "on": ["tue"], "until": "2026-12-15" }` (`every` day, week, month or year; `interval`; `on` weekdays or days of the month, `-1` the last; `until`; `count`; `except`). Nothing is stored per occurrence: a rule, a sort, `today()` and "due in the next 7 days" read the next one, a calendar draws each, marked, and a row says "Every Tuesday, next Oct 27". `skip-<kind>`, `detach-<kind>` ("Change just this one") and `split-<kind>` ("Change from here") take `{ id, on }`; the record's page changes the rule with a picker beside the date.

1. **Let a list leave as a spreadsheet — or say where it may not.** A kind's list and a lens that lists records (calendar, timeline, coverage, board, status board) offer "Export CSV" beside the heading or on the lens's arranging line, and in the place menu: the rows shown, in their order, filter, words and groups (a "Group" column first), the name, then each field as the page says it, under the seat's sight. Off for everyone with `"export": false` on the lens or under `pages.lists.<kind>`; the owner's menu says "Turn off export" (the edit `{ "op": "set-lens-export" }`). A host that saves files passes `onExport`.

### Then find out whether it worked

```sh
graview check src/domain/app.ts
```

It warns of a filter the kind cannot be filtered by (`pages-filter-unknown`) and names the keys it can, a kind `pages.lists` names that is not there (`pages-kind-unknown`); it refuses a list sorted by what the kind does not have, grouped by a field that is not a choice or a yes or no, or closing a value that is not one of its choices (`pages-list-arrangement`, an error, in a sentence); warns of an `export` that is not true or false (`lens-export-not-a-boolean`, `pages-list-export-not-a-boolean`) or on a lens with no records (`lens-export-lists-no-records`); and of a card or row that puts a `text` field whole in a text block (`view-whole-text`: "feature card shows summary whole; it will be clamped"). Then look at the list at a phone's width as well as a desk's:

```sh
graview describe src/domain/app.ts --place requests --seed seed.json --width 390
```

It says the list's headings, each record's card and what is filtered, as the page draws them. Run an act over three records, one of which it may not take: that one is named and stays chosen, and one undo takes back the rest.

A right-click on a row, a value or the page's ground opens the scene's menu on the pages (Shift or Option held, a text field or selected text keep the browser's). A design's own row takes part as a link to its record or with `data-graview-record`, its own value with `data-graview-field` and `data-graview-editable`, which adds "Change …" to the menu.

### What the check cannot see

Whether the filters you named are the ones a person reaches for — that is a question for someone who uses the list. Whether a card's first sentence is a useful one: `excerpt` cuts where the text does. And `renderPlace` writes no history and no acts by design; a host that wants them on paper writes them itself.

---

Keep a Graview app's lists usable as it grows — what a list offers to filter by, the order and groups it opens in, cards read at a glance, several records acted on at once, a list printed as a static page or exported as CSV, and a date that repeats rather than a record each time — and verify each with graview check and the page itself rather than assuming it.

The page: https://graview.dev/docs/skills/graview-lists.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
