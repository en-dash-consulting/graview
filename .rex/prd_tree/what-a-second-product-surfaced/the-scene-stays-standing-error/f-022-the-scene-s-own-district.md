---
id: "0f19a121-a05e-4288-878c-4e6c313e9a4f"
level: "task"
title: "F-022 · The scene's own district controls are 22px tall"
status: "pending"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "The district chip's disclosure and past-horizon controls are at least 24px tall (min-height 1.5rem)"
  - "A test or harness measurement asserts no scene chrome control is under 24px"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-022. 'open ▾' is 56x22 and '+N past' is 51x22 — under the 24px floor the framework's own audit-ui guidance names. An app cannot fix them without forking the package."
lastModified: "2026-09-14T22:30:32.566Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
