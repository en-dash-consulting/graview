---
id: "70872e32-507e-47c1-ac6f-598cf520a1d3"
level: "task"
title: "Google Calendar, proven end to end against Google itself"
status: "completed"
startedAt: "2026-10-16T17:18:22.000Z"
completedAt: "2026-10-16T17:30:00.000Z"
priority: "medium"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "a sync against a real Google test calendar survives a token expiry, a rejected sync token (full resync) and an event round-tripped across timezones"
  - "the run is reproducible from a documented script that reads credentials from the environment and commits none"
description: "Roadmap f-google-calendar (building, priority now, target 0.2; Cloud's half is f-connections). The @graview/ship sync layer is covered against a scripted remote but has not run against Google: expiring tokens, rejected sync tokens, timezone round trips. Needs Google OAuth credentials for a test calendar from Nick; skip and note it on the Roadmap feature if none are handed over."
lastModified: "2026-10-16T17:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-16. Proven live against the Google test calendar with `scripts/verify-google-calendar.mjs` (run gv-mvb8lszp-619256), which writes docs/google-calendar.json and is kept out of `pnpm verify` and CI because it needs credentials; it reads them only through `scripts/lib/google-test-env.mjs` (~/.graview-google-test.env, made once by `scripts/google-calendar-once.mjs`) and commits none. All ten claims held:

- aMeetingMadeHereReachesGoogle: a meeting made at 15:00Z was in Google as 10:00-05:00 America/New_York.
- graviewsOwnWriteIsNotEchoedBackAsAChange: the next pass saw it as an echo, applied nothing, pushed nothing.
- aChangeMadeInGoogleLandsHere and anEventMadeInGoogleIsMadeHere: a rename and move, and a new event, made in Google landed here.
- anEventMadeInAnotherZoneKeepsItsInstantBothWays: 09:00 Europe/Berlin read as 08:00Z, 09:00 Asia/Tokyo as 00:00Z; moved an hour here, Berlin's became 04:00-05:00 in Google with its Europe/Berlin zone kept (Google merges a patched start); Tokyo renamed here kept its instant; the next pass took only echoes.
- anAllDayEventArrivesAsADayAndIsNotMadeIntoATimedMeeting: decided that the transport carries `start.date` and `end.date` and invents no time; an app keeping timed records declines it in `createInbound`, and nothing is sent for it.
- aPullFollowsEveryPage: with `pageSize: 2`, four pages followed and every event of the run listed.
- anAccessTokenGoogleRefusesIsRefreshedAndTheRunGoesOn: a token Google would not take (401, as an hour-old one) was asked again with `{ refresh: true }` and the push went through.
- aRejectedSyncTokenStartsAFullResyncThatLosesAndDuplicatesNothing: a corrupted cursor drew 410 fullSyncRequired from Google (as garbage, a mutated and a truncated token all do); the full resync took a change made in Google meanwhile, kept 4 meetings here and 5 events there, pushed nothing.
- everythingTheRunMadeIsRemoved: four deletes sent from here, none refused, nothing of the run left.

What the live run found and fixed in `@graview/core/sync`: no refresh on 401 (now `token({ refresh: true })` once, a second 401 throws a sentence naming the token); no pagination (pull now follows `nextPageToken`, keeps the last page's sync token, `pageSize` option); a DELETE's 204 had no body and was reported as refused; all-day events lost their day; a first full pull offered canceled events to `createInbound` as records to make (the engine now skips a deletion of a record it never had). Each has a scripted test in packages/core/tests/integration/google-calendar-meets-what-google-does.test.ts. The demo's token source honors `refresh`, and its port is named in scripts/lib/ports.mjs ("calendar-sync-demo", 5267) instead of written as 5310.

Left: an access token that genuinely expired after an hour was stood in for by one Google refuses (the same 401); the engine still reports a pull that throws (a second 401 included) as offline, so a refused token reads as offline in the report; a recurring event's instances and an event whose timed/all-day kind changes in Google are not yet handled. Cloud's half is f-connections.
