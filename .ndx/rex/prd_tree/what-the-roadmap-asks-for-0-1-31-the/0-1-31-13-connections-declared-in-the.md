---
id: "fab2c947-bbcc-4b59-a74b-70182fd8f32b"
level: "task"
title: "0.1.31 · 13: Connections declared in the app and run by graview serve: a Google calendar, filtered, read-only or both ways"
status: "completed"
startedAt: "2026-10-16T17:29:47.000Z"
completedAt: "2026-10-16T18:35:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
blockedBy:
  - "70872e32-507e-47c1-ac6f-598cf520a1d3"
source: "conversation"
acceptanceCriteria:
  - "a connections entry in the declaration (system, calendar, kind and field mapping, filter by whole calendar, one color or a title tag, direction read-only or both ways, conflict policy) is judged by graview check, with a finding for each wrong shape"
  - "graview serve and graview preview run the sync on that entry with credentials from the environment, keep its cursor beside the app's data, and credit changes from the other side to the system in Activity"
  - "a test against the scripted remote covers each filter and both directions, and the meetings demo runs from the declaration alone"
description: "Roadmap f-connections-declared (Nick, 2026-10-16, after the local calendar demo: 'is there a configuration area? like to open read/write events in a calendar that have a certain label'). Today the sync is configured in code (scripts/calendar-sync-demo.mjs). Declare it instead, so a self-hoster configures a connector in the declaration and Cloud's Connections page (f-connections-page) writes the same entry. Google refuses a sync token combined with a search, so color and tag filters apply as events arrive; events Graview creates carry a private extended property. The studio shows the entry as a form."
lastModified: "2026-10-16T18:35:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-16. Built: a document's `connections.<name>` (system `google-calendar`; `calendar` as an id or `{ env }`; `auth: { env, file }`; `kind`; `fields` for summary, start, end, location, description; `filter` absent for the whole calendar, `{ color }` by Google's color name or `{ tag, keep }`; `direction` `read` or `both`; `conflicts`; `every`; `paused`). The compiler reads it loosely, so a hosted page carries none of it and its budget is unchanged. `graview check` judges the shape (`shape`, `unknown-key`) and what it names (`connection-kind`, `connection-field`, `connection-field-type`, `connection-when`, `connection-filter`, `connection-color`, `connection-tag`, `connection-creates`, `connection-edit`, and the warning `connection-remove`). `document.schema.json` states the full shape for an editor. `@graview/core/sync` adds `connection(…)`, which builds the engine, mapping and transport. `@graview/ship` (also `/runtime`) adds `runConnections`. `graview serve` and `graview preview` run it with credentials from the environment, with the cursor and links in `connections.json` beside the data (in memory for an in-memory preview); `--no-sync` or `paused` leaves it off.

Decisions:
- Read-only means the calendar owns the kind: an act here that would change a record of it is refused with a sentence (`SyncEngine.guard`), rather than accepted and never sent.
- A `date` field is an all-day day, with the end day inclusive here and exclusive at Google; a `datetime` field is an instant, read back as UTC.
- Filters apply client-side as events arrive. An event that leaves the filter is gone here. Events made here carry the color or the tag, plus `extendedProperties.private.graview = <app name>`. A tag is stripped from the name here unless `keep`.
- Inbound changes land through the app's own acts (the one that creates the kind, `edit-<kind>`, `remove-<kind>`), authored `google-calendar`. The checker refuses a connection those acts cannot carry.
- The host seam is `runConnections({ app, store, state, token({ connection, declaration, refresh }), calendar? })`.

Checks:
- 12 core tests against a scripted Google cover each filter and both directions, plus all-day.
- 4 ship tests: the host token, state kept across a restart, credentials read from the declared file, paused, and a pass soon after a local change.
- A studio test: connections are carried through an edit and follow a renamed kind.
- The demo (`node scripts/calendar-sync-demo.mjs`), `graview preview` and `graview serve --data` ran from the declaration alone against the real calendar.
- `scripts/verify-google-calendar.mjs`, run gv-mvb9tuoc-a1bbb4: all 12 claims held, including `aDeclaredConnectionFilteredToOneColorKeepsOnlyThatColor` (only Basil taken; one made here got colorId 10 and the private property; recolored in Google, it was gone here) and `aDeclaredConnectionFilteredToATagKeepsTheTaggedEventsAndTagsItsOwn` (only the tagged one, named without its tag; one made here went out as "Demo #<tag>"; no echo).
- The graview-ship skill was trimmed to 10,943 characters.
- Budget raises are filed for "every face" and "embed with the studio handed in" (5,698 / ~2,100 B, the checker the studio carries).

Left:
- The studio carries connections but does not yet show them as a form.
- A `date`-only kind still needs an `end` field.
- The runner's interval is the shortest `every` among the app's connections.
- Embed studio-mount tests timed out on this loaded machine (load average about 38) on the baseline sources too: the studio module takes about 11 s to import cold against their 2 s poll.
