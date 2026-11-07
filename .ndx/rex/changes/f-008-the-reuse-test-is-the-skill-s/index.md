---
id: "72d54344-4080-443b-b94d-af96f4634f35"
type: "change"
title: "F-008 · The reuse test is the skill's best idea and the easiest to skip"
slug: "f-008-the-reuse-test-is-the-skill-s"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-008. graview-lens says prove reuse by binding the lens to a domain it was not designed for. Nothing enforces it."
acceptanceCriteria:
  - "graview check emits lens-authored-here as an observation listing lenses whose implementation lives in the app"
  - "Stretch: lens-reuse-unproven warns when no test outside the app's own kinds builds an authored lens"
touches:
  - "90407054-fba2-4232-8413-f4e29822ba9d"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
  - "skills"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
