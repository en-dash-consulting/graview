---
id: "3441dc25-892b-4e97-ad8c-230837953410"
type: "change"
title: "The template format reads time questions, ${id} in setup words and curated views, and a field keeps a time of day"
slug: "f-template-format-cloud-additions"
intent: "Cloud, 2026-11-11: Cloud's templates now use `type: \"time\"` questions, `${id}` inside setup words and a `views` field (curated views from chats; `frameViews` was already a difference), which graview-template does not read. And there is no time-of-day field type, so Thanksgiving's schedule keeps zone-less datetimes and each view formats them itself."
acceptanceCriteria:
  - "graview-template reads `type: \"time\"` questions, `${id}` in setup words and a `views` field, and graview create and graview apply use them (test)"
  - "A template using Cloud's shapes round-trips through the framework's reader unchanged (test against a copy of Cloud's Thanksgiving template)"
  - "A `time` field keeps a time of day with no zone: it validates, sorts, says itself with {x|time}, is typed in a time input, and has a JSON schema (test)"
  - "graview check refuses a template question or setup word that names an id the template does not have (test)"
touches:
  - "2da41444-ab48-4789-a445-682221257285"
priority: "high"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-template-format-cloud-additions"
source: "Graview HQ feature:f-template-format-cloud-additions"
---
