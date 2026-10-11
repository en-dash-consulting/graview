---
id: "3768785b-7045-43b5-9d82-460c48e9649e"
level: "feature"
title: "Each blocks lens claims BlockSlots under its own view name"
status: "pending"
priority: "medium"
tags:
  - "n-dx"
  - "blocks"
source: "The review round before 0.1.22 (#207), 2026-10-11"
acceptanceCriteria:
  - "A blocks lens's claims are keyed by its own view"
  - "Two lenses claiming one block key each draw their own"
description: "Every blocks lens shares one view name for BlockSlots claims, so two lenses cannot claim the same key differently."
lastModified: "2026-10-11T08:00:00.000Z"
---
