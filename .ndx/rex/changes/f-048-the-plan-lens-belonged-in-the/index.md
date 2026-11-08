---
id: "414cfd7c-7097-4d7c-8aff-5ebe87deccdc"
type: "change"
title: "F-048 · The plan lens belonged in the framework, not in a product"
slug: "f-048-the-plan-lens-belonged-in-the"
intent: "createGroundsMapLens took generic bindings and knew nothing about gardens — a building with rooms and fixtures built it in the product's own reuse test. It was a plan lens with a groundskeeping name in a product repository. Now createPlanLens in @graview/primitives, beside the three that ship, with the framework's own test building it over a building. The product's file went from 1149 lines to 34."
touches:
  - "249fdeb3-a528-42c5-bfab-caaf9b856504"
priority: "high"
---
