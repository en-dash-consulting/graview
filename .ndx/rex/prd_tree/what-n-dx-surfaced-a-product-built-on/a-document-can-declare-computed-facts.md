---
id: "3dce0f3d-bcf0-4db9-b79c-869587e448a2"
level: "feature"
title: "A document can declare computed facts of the whole graph"
status: "completed"
startedAt: "2026-10-10T23:30:00.000Z"
completedAt: "2026-10-11T03:10:00.000Z"
endedAt: "2026-10-11T03:10:00.000Z"
priority: "high"
tags:
  - "n-dx"
  - "document"
  - "computed"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "A document-level computed section, expressions in the rule language, budgeted"
  - "Readable from blocks, the scene, Pages and describe/MCP alike"
  - "graview check judges them"
description: "'The whole product map is proposed' is decided in a face with every(n => n.proposed); computed is per kind only, so the scene and MCP cannot say the same thing."
lastModified: "2026-10-11T03:10:00.000Z"
resolution: "Done in #205: a document's top-level computed is read anywhere as fact('<name>'), worked out over the reader's graph under the language's budget, listed by describe and describe_place on the home, worked out by factValues, and judged by graview check as a computed field (fact-unknown for a fact that is not there)."
---
