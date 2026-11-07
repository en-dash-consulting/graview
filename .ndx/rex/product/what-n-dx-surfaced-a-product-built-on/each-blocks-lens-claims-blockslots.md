---
id: "3768785b-7045-43b5-9d82-460c48e9649e"
type: "capability"
title: "Each blocks lens claims BlockSlots under its own view name"
slug: "each-blocks-lens-claims-blockslots"
statement: "Each blocks lens keys its BlockSlots claims under its own view name, so two lenses that claim the same block key each draw their own."
criteria: [{"id":"c1","text":"A blocks lens shall key its BlockSlots claims by its own view name."},{"id":"c2","text":"When two blocks lenses claim the same block key, each lens shall draw its own claim."}]
tags:
  - "n-dx"
  - "blocks"
source: "The review round before 0.1.22 (#207), 2026-10-11"
priority: "medium"
resolution: "Fixed in #215: a blocks lens's blocks are claimed under its own address, as describe_place names it."
---

Every blocks lens shares one view name for BlockSlots claims, so two lenses cannot claim the same key differently.
