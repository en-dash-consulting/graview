---
id: "99c6ab0a-8bee-438e-bfab-5d1bfce3c18b"
level: "task"
title: "0.1.37 · Datetimes in the app's time zone, with time and datetime formatters"
status: "pending"
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
lastModified: "2026-10-18T21:40:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
