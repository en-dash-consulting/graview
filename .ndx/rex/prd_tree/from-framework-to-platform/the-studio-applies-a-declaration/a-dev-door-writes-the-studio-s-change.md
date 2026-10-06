---
id: "c20e1f66-53c9-4181-94c4-15bd94f5fcd0"
level: "subtask"
title: "A dev door writes the studio's change into the checkout, editing the source rather than regenerating it"
status: "completed"
priority: "high"
startedAt: "2026-09-23T04:18:39.448Z"
completedAt: "2026-09-23T04:18:39.448Z"
endedAt: "2026-09-23T04:18:39.448Z"
description: "packages/ship/src/dev.ts gains a studio door beside the decision door (same configureServer pattern): GET answers whether it is there and which src/domain it serves; POST takes the declaration diff. A node-side writer in @graview/studio (TypeScript compiler API, text-span edits) applies the diff to the checkout's own files — kind added/removed, field added/removed/changed, edge added/removed/moved between kinds, act/rule added as a stub — inside the existing defineNode/defineMutation calls, preserving comments, describe/label/format functions and every body it does not touch. Confined to src/domain; refuses anything else. place.tsx Apply writes through the door when it answers and says what it wrote; without it (deployed) the downloads remain and say why. Tests: writer unit tests over seedbed's real files (move tended-by from plot to planting leaves every other line identical); door refuses a path outside src/domain."
lastModified: "2026-09-23T04:18:39.516Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
