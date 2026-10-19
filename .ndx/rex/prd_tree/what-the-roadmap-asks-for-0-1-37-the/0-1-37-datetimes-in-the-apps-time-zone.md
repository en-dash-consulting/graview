---
id: "99c6ab0a-8bee-438e-bfab-5d1bfce3c18b"
level: "task"
title: "0.1.37 · Datetimes in the app's time zone, with time and datetime formatters"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
acceptanceCriteria:
  - "an app (and optionally a person) declares a time zone; datetimes are said in it in lists, record pages, act answers and sentences, and the props a view is handed carry it"
  - "describe takes {at|time} and {at|datetime}; a value given with an offset is said in the app zone, not UTC; tests fail on 0.1.36"
  - "graview check and the document schema accept the zone; an unknown IANA zone is refused by name"
description: "Roadmap request:datetimes-a-time-formatter-and-an-app-time-zone-they-show-in-utc-today. describe has no time-of-day formatter, and act echoes show datetimes in UTC though given with -04:00; views hard-code America/New_York."
completedAt: "2026-10-18T22:30:00.000Z"
endedAt: "2026-10-18T22:30:00.000Z"
lastModified: "2026-10-18T22:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "On feat/app-time-zone: brand.timeZone (TS and document), a person's timeZone on the provider, the embed and the pages face; {at | time} and {at | datetime}; instants said on that clock on every surface, acts and views included; brand-time-zone refuses an unknown zone; set-brand sets it."
---

## Notes

**Decision: the app's zone beside its locale, and the person's over it.** `brand.timeZone` (an
IANA name) sits beside `brand.locale` and `brand.currency` on `defineApp`'s `Brand` and on the
document's `BrandSpec`, so it is declared once and goes across `toDocument`. The order is the
locale's: the person's zone a host passes (`timeZone` on `GraviewProvider`, `mountEmbed` and the
pages face's `PageContext`) wins, else the app's, else the runtime's clock — what every reader saw
before. This reconciles the 0.1.31 date editor ("an instant said on the reader's clock"): "the
reader's clock" is now `zoneFor()`, so the editor (`wallOfStored`, `storedOfWall`, `wallNow`,
`zoneSaid`) reads and keeps an instant on the same clock the record's page says it on. A moment
kept without a zone is still the wall time written, whatever the zone.

**Where it is said.** `days.ts` holds the page's zone beside its locale (`sayIn({ reader, app,
readerTimeZone, appTimeZone })`), with `sayingIn(saying, run)` for a host answering away from a
page and `zoneFor` / `timeZoneFor`. Explicit where a locale already was: `Money.timeZone` (from
`moneyOf`, so a document's templates, blocks and rule sentences get it at compile),
`readableFields({ timeZone })`, `describePlace`. The page's zone everywhere else: derived edit
sentences (the act echo), labels, Activity's digest, the timeline. The tool runtime says an act
inside `sayingIn` with the app it is handed, which is the reported bug ("2:47 PM" on a UTC
server); `renderPlace` (`@graview/pages/static`) takes `timeZone` and says its page in it.

**Formatters.** `{at | time}` ("10:47 AM") and `{at | datetime}` ("Oct 16, 2026, 10:47 AM EDT",
`momentAsRead`, which names the zone for an instant); a day given to either is said as a day.
`date` and `relative` count an instant's day on the app's clock (`dayOfMoment`). A field block
takes `as: "time"` and `as: "datetime"` too (`VIEW_FIELD_FORMATS`).

**Views: the zone, not pre-formatted strings.** `GuestProps` carries `locale` and `timeZone`
(the page's, resolved, so always a name) on every push, from both the worker-view and the frame
session builders; a view formats with `Intl.DateTimeFormat(props.locale, { timeZone:
props.timeZone, … })`. Pre-formatting would have had to guess which fields and which shape.
`graview-worker-view` says so.

**Checked.** `timeZoneProblem` (Intl accepts it, and it is not an offset) is the one judge:
`graview check` (`brand-time-zone`, error, `brand.timeZone`), the document's `brandFindings`
(compile), and `set-brand` (`timeZone`, null clears; said "Times are said in …" and by
`diffDocuments`). A zone the runtime refuses is said on the runtime's clock, never thrown.
`describeApp` says the zone. The studio has no locale or currency edit of its own (the brand is
carried through from the base declaration), so nothing was added there.

**Tests, failing first** (19 failed at 2b580280, all pass now):
`packages/core/tests/unit/datetimes-are-said-in-the-apps-time-zone.test.ts` (15),
`packages/tools/tests/unit/an-agents-act-says-a-time-on-the-apps-clock.test.ts` (2; the New York
case passes on a New York machine and fails on a UTC one, the Tokyo case fails anywhere),
`packages/guest/tests/unit/a-view-is-handed-the-apps-time-zone.test.ts` (3). `pnpm verify
date-inputs pages --quick` (GRAVIEW_PORT_BASE=5600): both hold (11 and 55 checks). Budgets raised
by files in `scripts/budget-raises/datetimes-in-the-apps-time-zone-*.json` (2.0 KB up front on a
hosted page, ~0.5 KB on the guest host) and the scene's before-drawn ceiling to 935 KB.

**Left open.** `isoToday()` (a rule's `today()`) is still the UTC date: moving it to the app's
day changes when rules turn and what a server and a page agree on, a change of its own.
