---
id: "bc15bf28-5c89-4519-924c-0666df8ba116"
level: "feature"
title: "A derived edit offers every field nothing else really sets, and refuses what it can't take (FR-110)"
status: "pending"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-110"
  - "bug"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
acceptanceCriteria:
  - "A document act's writes come from what its sets and effects actually set on its subject, not from argument names; an argument feeding an effect on another record doesn't count"
  - "A derived edit's input is strict: an unknown argument is a typed validation refusal"
  - "Nothing to change is a typed Refusal, not a bare Error"
  - "With note-strength (on person) creating a strength with name: \"$name\", edit-person offers name and renaming works; edit-person { id, colour } is refused as invalid; edit-person { id } is a refusal a host can show"
description: "In the org app a person could never be renamed: fieldsWrittenBy's name-match guess dropped name from edit-person; { id, name } parsed to { id } silently and apply threw a bare Error."
lastModified: "2026-10-06T20:49:02.606Z"
---
