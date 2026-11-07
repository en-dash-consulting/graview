---
id: "c65ccb7c-b5c0-4143-b441-25ae7b6031dd"
type: "change"
title: "F-031 · The district overflow card's names are 22px targets"
slug: "f-031-the-district-overflow-card-s"
intent: "Found by Groundskeeper's audit-ui on the first run after taking the F-018 fix. The beyond card (graview-beyond-list) names each overflowed district with a <button data-graview-pick=kind:…> at 123x21.7 (desktop) and 188x21.7 (phone) — under the 24px floor F-022 raised the chip controls to. Eight audit places fail, all this element. The F-022 stylesheet-reading test does not cover the card because it was written after it."
acceptanceCriteria:
  - "Every button in the beyond card is at least 24px tall (max(1.5rem, 24px))"
  - "The stylesheet-reading test from F-022 covers every data-graview-pick control the scene chrome draws, so new chrome inherits the floor"
  - "Groundskeeper's audit-ui holds 36/36 against the fix"
touches:
  - "4382c67b-1055-4623-b8fb-62b9be3fa330"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
