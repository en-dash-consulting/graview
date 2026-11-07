---
id: "99c6ab0a-8bee-438e-bfab-5d1bfce3c18b"
type: "change"
title: "0.1.37 · Datetimes in the app's time zone, with time and datetime formatters"
slug: "0-1-37-datetimes-in-the-app-s-time"
intent: "Roadmap request:datetimes-a-time-formatter-and-an-app-time-zone-they-show-in-utc-today. describe has no time-of-day formatter, and act echoes show datetimes in UTC though given with -04:00; views hard-code America/New_York."
acceptanceCriteria:
  - "an app (and optionally a person) declares a time zone; datetimes are said in it in lists, record pages, act answers and sentences, and the props a view is handed carry it"
  - "describe takes {at|time} and {at|datetime}; a value given with an offset is said in the app zone, not UTC; tests fail on 0.1.36"
  - "graview check and the document schema accept the zone; an unknown IANA zone is refused by name"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
resolution: "On feat/app-time-zone: brand.timeZone (TS and document), a person's timeZone on the provider, the embed and the pages face; {at | time} and {at | datetime}; instants said on that clock on every surface, acts and views included; brand-time-zone refuses an unknown zone; set-brand sets it."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "Describe a place without a browser: describePlace for a chat to check its own work (FR-89)" (04830254-bdf1-4882-875a-9be6db061135).
