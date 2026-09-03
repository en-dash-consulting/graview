---
id: "d2a9d59a-9ba2-4bff-9d5f-2a7f45a62203"
level: "task"
title: "Every action title says what it does"
status: "completed"
priority: "medium"
startedAt: "2026-08-31T02:50:19.166Z"
completedAt: "2026-08-31T02:50:19.166Z"
endedAt: "2026-08-31T02:50:19.166Z"
resolutionType: "code-change"
resolutionDetail: "Audited all 48 mutation titles; renamed the one opaque survivor (\"Annotate\"). Rewrote the read tool descriptions as instructions, and added graview check rules so an untitled, identifier-titled, ambiguous or undescribed mutation is a build-time finding rather than something noticed in use."
acceptanceCriteria:
  - "No mutation title needs the description to be understood"
  - "The 'say why' mutation is renamed and its description explains what recording a reason is for"
  - "Agent tool descriptions read as instructions rather than as labels"
  - "graview check still clean across all four apps"
description: "\"Say why\" appears on every kind in three apps and nobody can tell what it does from the name. A mutation title is the whole label a person gets — it is not a slug — and the same string is what an agent reads in its tool schema, so an opaque one costs twice. Audit the titles and descriptions across all four apps."
---
