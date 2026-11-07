---
id: "4ec3cb7b-cd85-4a64-b725-1be66d706e78"
type: "change"
title: "The modules still over a thousand lines are split along their own seams"
slug: "the-modules-still-over-a-thousand"
intent: "The 2026-09-23 clean-code pass split workbench/index.tsx, pages.tsx and scene.tsx along their section boundaries (imports pruned by the compiler with noUnusedLocals). Still over a thousand lines: scene-root.tsx (the Scene component alone, ~1400), layout/src/layout.ts (1663), primitives/src/theme.ts (1603), core/src/cli/check.ts (1555, rule families), core/src/scaffold/index.ts (1740, one template function per file it writes), primitives/src/lens/plan.tsx (1297), lens/calendar.tsx (1203). Each wants its seams read rather than guessed: split where the file already groups itself, nothing exported changes, and the browser chain holds before and after."
touches:
  - "a2faf2f8-0f70-44a5-935b-9e7f608e8c46"
priority: "low"
---
