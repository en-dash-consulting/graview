---
id: "f1606df5-1580-4656-b53c-66729f308e5c"
type: "change"
title: "The framework says its own version, and rule failures are structured"
slug: "the-framework-says-its-own-version-and"
intent: "Hosts record which framework version folded a store (for upgrade waves and diagnosis), but @graview/core exports no version constant. A rule that could not be judged or ran out of budget is only distinguishable by its message text, which Cloud matches by regex. POSITION: export FRAMEWORK_VERSION; violations carry a status ('violated' | 'could-not-judge' | 'over-budget') and health() counts them."
acceptanceCriteria:
  - "import { FRAMEWORK_VERSION } from '@graview/core' matches the package version"
  - "A rule that throws yields a violation with status could-not-judge"
touches:
  - "83796ab4-ebd4-48f4-ad70-81121f49d17d"
priority: "low"
tags:
  - "graview-cloud"
  - "operations"
source: "Graview Cloud self-healing room, 2026-10-02"
---
