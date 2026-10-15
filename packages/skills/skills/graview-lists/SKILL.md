---
name: graview-lists
description: Keep a Graview app's lists usable as it grows — what a list offers to filter by, the order and groups it opens in, cards read at a glance, records set aside instead of deleted, a list printed as a static page, and a date that repeats instead of a record per occurrence — and verify each with graview check and the page itself rather than assuming it.
---

# Lists that stay usable as an app grows

A list that worked at twelve records stops working at three hundred: Filter
lists every record at the far end of every relation, each card prints a
thirty-line summary, and the only way to tidy is to delete. None of this
needs a custom page. The declaration says what the list offers, the
templates say how much of a long text a card shows, and every kind can
already set a record aside.

## Do this

1. **Say what a kind's list filters by.** In a document:

   ```json
   "pages": { "lists": { "request": { "filters": ["status", "area", "became", "became.stage"] } } }
   ```

   In TypeScript, the same under `defineApp({ pages: { lists: … } })`.
   Each key is a field, a relation, `is`, or `<relation>.<field>` — a choice
   on the record at the far end ("The feature it became · Stage: Building").
   The choice fields among them stand over the list as chips with counts;
   the rest are under Filter, each heading closed until pressed, with a box
   that finds a filter or a far record by a few letters. Unsaid, a list
   offers every way but a relation to a kind with more than forty records
   (offered by that kind's choices instead), and its first two choice
   fields as chips. An address says the same: `/requests?filter=status:open`.

   **Say the order and grouping it opens in**, beside its filters:

   ```json
   "feature": { "sort": { "by": "rank", "direction": "desc", "then": "name" } },
   "request": { "group": { "by": "status", "order": ["planned", "new"], "closed": ["done", "declined"] } }
   ```

   `sort` is a field, a computed field (a rank the kind works out) or
   `label`, lowest first unless `"desc"`, with a `then` for ties; `group`
   is a choice or yes-or-no field (`"true"`, `"false"`). `order` puts its
   groups first; `closed` ones are drawn last and shut, each a button
   saying "done · 12 requests" that opens it (`?open=done` keeps it open;
   words in the Find box open them all). A person still sorts or groups
   the list another way from its arranging line. The edit is
   `arrange-pages` with `sort: { "<kind>": … | null }` and
   `group: { "<kind>": … | null }`.

2. **Let a card say a long text's start.** A card shows a `text` field in
   three lines at most and a row in one, cut with an ellipsis. Say it on
   purpose with the `excerpt` formatter — `{summary|excerpt}` is its first
   sentence or about 140 characters cut at a word, `{summary|excerpt: 80}`
   at most 80 (20 to 1000) — and leave the whole text to the record's page.
   A list cut by its `limit` says "See all 120 features" and goes to the
   kind's list. Prose written in Markdown says so —
   `{"type": "text", "format": "markdown"}`, or `markdownField()` — and the
   record's page draws it as prose (headings, lists, links, code; no HTML),
   while a row, a card, a describe line and a search hit say its first
   paragraph or about 160 characters with the syntax taken out.

3. **Set records aside instead of deleting them.** Every kind has
   `archive-<kind>` and `unarchive-<kind>` (`{ id }`, "Bring it back") and
   `merge-<kind>` (`{ id, into }`: `into` takes the duplicate's links and
   the duplicate is archived), permitted through the acts that create the
   kind. An archived record is out of lists, the scene, counts, computed
   fields and rules; its own page and search still find it, marked. A list
   says "+3 archived" and opens them at `?archived=true`; a rule reads them
   with `all('feature', true)` (`'all'` for both) and `archived()`. A kind
   that should never be archived says `archives: false` in `defineNode` (a
   document's `"archives": false`; the edit `set-archives`).

4. **Let the app's own actor tidy, and say what it may not.** An actor
   that links and prunes on its own is an author that says
   `automated: true` (`kind: "system"` or `"agent"`). What it is sure of it
   applies with `lineage: { basis, confidence }`; what it is not it
   suggests: `suggest(store, calls, { author, lineage })` (from
   `@graview/core/tidying`) keeps the calls in
   the log, changes nothing, and they wait in the Suggested tray beside
   Activity until a person accepts (made as them) or declines them;
   `declined(store, calls)` says so, and the actor is refused the same change
   again. Its run of changes is one Activity row, "Tidied 6 things today".
   A person says "Leave this one alone" on a record (`leave-alone-<kind>`,
   cleared by `allow-tidying-<kind>`; `isLeftAlone(store, id)`), and the
   declaration says a kind is never tidied or never linked —
   `tidying: "never" | "no-links"` on `defineNode`, `tidying: "never"` on a
   relation; in a document the edit
   `{"op": "set-tidying", "kind": "vendor", "tidying": "no-links"}` (with
   `"relation"` for one relation, `"allowed"` to undo it). The store refuses
   the actor each in a sentence.

5. **Print a place when a fixed link wants one.** `renderPlace(store, app,
   "/requests", { viewer, locale })` from `@graview/pages/static` answers
   `{ html, css, title, found }`: one self-contained page, no script, in the
   app's look, under the viewer's sight, the same words the routed face
   says. It imports no React, so a Worker renders it on each change.

6. **Know what a kind opens to before you draw it a picture.** Gone into
   with no lens of its own (`#focus=aggregate:room`), a kind opens to its
   stop: its plural, count and description; its creating act first ("Add a
   room"), asked in place; how many are overdue or due this week on its due
   date; its problems counted by rule, each opening its repairs; what
   changed since this reader last looked; and a picture its data chooses —
   a board by its main choice (`status`, `stage`, `state`, `phase` or the
   lifecycle's field) up to 300 records, a calendar where today's month has
   short records on its main date, else a table of its glance and its
   relations, 50 rows at a time. "Keep as a lens" declares that picture
   (`add-lens`). So give a kind a lifecycle or a `status`, a `glance`, and
   a creating act with a `title` before you write it a view.

7. **Let several be done at once — it is already there.** A kind's list, a
   kind's stop and a board choose records: a box at each row's start on a
   desk, Shift for a range, Cmd/Ctrl-A, Escape; the boxes one Tab stop, the
   arrows between them, Space to choose; a long press on a phone.
   The bar offers the acts every chosen record shares (`actsForSeveral` in
   `@graview/tools/several`): acts on the subject alone ("Mark it done")
   and those that ask once for all ("Move the date…"), "Move to <value>"
   for the kind's state field, archive, merge and remove behind More. One
   press is `actOnSeveral`: one batch, one undo. A record the act may not
   run on (the policy, the seat's sight, the act's own refusal) is named
   and stays chosen; the rest apply. A seat does the same with
   `act_on_several` (`{ act, records, args }`). So declare acts on a
   `subject` with as few other arguments as they need.

8. **Let a weekly practice be one record, not fifty.** A date that repeats
   is `{ "type": "date", "repeats": true }` (or `"datetime"`) in a document,
   `startsAtRepeat: repeatField()` beside `startsAt` in TypeScript. The
   record keeps its first occurrence in the date and the rule beside it:
   `"startsAtRepeat": { "every": "week", "on": ["tue"], "until": "2026-12-15" }`
   (`every` day, week, month or year; `interval`; `on` weekdays or days of
   the month, `-1` the last; `until`; `count`; `except`). Nothing is stored
   per occurrence: a rule, a sort, `today()` and "due in the next 7 days"
   read the next one, a calendar draws each, marked, and a row says "Every
   Tuesday, next Oct 27". `skip-<kind>`, `detach-<kind>` ("Change just this
   one") and `split-<kind>` ("Change from here") take `{ id, on }`; the
   record's page changes the rule with a picker beside the date.

## Then find out whether it worked

```sh
graview check src/domain/app.ts
```

It warns of a filter the kind cannot be filtered by (`pages-filter-unknown`)
and names the keys it can, a kind `pages.lists` names that is not there
(`pages-kind-unknown`); it refuses a list sorted by what the kind does
not have, grouped by a field that is not a choice or a yes or no, or
closing a value that is not one of its choices (`pages-list-arrangement`,
an error, in a sentence); and it warns of a card or row that puts a `text` field whole in
a text block (`view-whole-text`: "feature card shows summary whole; it will
be clamped"). Then look at the list at a phone's width as well as a desk's:

```sh
graview describe src/domain/app.ts --place requests --seed seed.json --width 390
```

It says the list's headings, each record's card and what is filtered, as the
page draws them. Archive one record by its act and ask again: it is gone
from the list and the count, and `?archived=true` finds it. Undo the merge
you tried; both records come back with their links. Have a test actor suggest a link and
decline it from the tray: `suggest(store, …)` of the same calls then refuses,
and a record left alone refuses the actor's change by name.

## What the check cannot see

Whether the filters you named are the ones a person reaches for — that is a
question for someone who uses the list. Whether a card's first sentence is a
useful one: `excerpt` cuts where the text does. Whether a rule should still
count an archived record: it does not unless it asks with `all(kind, true)`.
And `renderPlace` writes no history and no acts by design; a host that wants
them on paper writes them itself.
