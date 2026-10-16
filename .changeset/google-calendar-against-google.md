---
"@graview/core": patch
---

The Google Calendar transport has now met Google itself, and keeps step with what it found. An access token Google refuses (401: an hour old, or revoked) is asked for again once with `token({ refresh: true })` and the request goes through; refused a second time, it throws a sentence naming the token. A pull follows `nextPageToken` to the end, so a calendar longer than one page is read whole and its sync token kept, and `pageSize` sets how many events a page holds. A deletion Google answers with no body is acknowledged rather than reported as refused. An all-day event arrives as its day, `start.date` and `end.date`, with no time invented for it. And a first full pull no longer offers `createInbound` the canceled events Google still lists. `scripts/verify-google-calendar.mjs` proves each of these against a real test calendar, with its credentials kept outside the checkout.

Compatibility: no surface changes; `GoogleCalendarOptions.token` takes an optional `GoogleTokenRequest` (`{ refresh?: boolean }`), `GoogleCalendarOptions.pageSize` is new, and `GoogleTokenRequest` is exported from `@graview/core/sync`.
