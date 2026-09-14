---
id: "9e0d263c-4a93-4c8e-9631-f5e314afb566"
level: "task"
title: "F-029 · ship has a persistence lifecycle and no local-process seam"
status: "pending"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/ship"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "@graview/ship/dev exports localIntelligence({ run?, model?, budgetUsd?, timeoutMs? }) as a Vite plugin serving GET status and POST { prompt, photos } -> { text } | { error }"
  - "The spawned session gets Read only, a turn cap of photos+3, a dollar budget, a closed stdin, and an environment with every CLAUDE* variable removed"
  - "Cross-origin requests are refused; the plugin is dev-server only"
  - "@graview/react exports useLocalIntelligence() that reads a 404, an HTML answer or a network failure as closed"
  - "Tested with an injected runner, never a real session; the three hung-process lessons are in the code's comments"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-029. Groundskeeper's bridge: a Vite middleware that probes for the claude CLI, writes photographs to a temp dir, spawns claude -p with --tools Read, a turn cap and a budget, strips CLAUDE* from the environment (a nested session that inherits it misbehaves), closes stdin (claude -p reads a non-TTY stdin and waits forever), refuses cross-origin callers (Vite allows every origin by default), and parses the JSON envelope. The GET/POST contract is in app/src/ui/bridge-contract.ts and lifts as is."
lastModified: "2026-09-14T22:30:33.882Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
