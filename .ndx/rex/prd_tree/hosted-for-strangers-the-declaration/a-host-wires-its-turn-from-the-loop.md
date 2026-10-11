---
id: "4c3bdd93-8089-4e8c-be19-a177832c2322"
level: "feature"
title: "A host wires its turn from the loop alone: @graview/tools/turn (FR-161)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-161"
source: "Graview Cloud, 2026-10-11 (the framework brief after 0.1.22)"
startedAt: "2026-10-11T08:30:00.000Z"
completedAt: "2026-10-11T09:00:00.000Z"
endedAt: "2026-10-11T09:00:00.000Z"
acceptanceCriteria:
  - "turnThroughMessages, TURN_STEPS and the MessagesBlock, MessagesStepRequest and MessagesStepReply types are on an entry of their own, @graview/tools/turn"
  - "Bundled on its own, the entry reads one module and weighs under 2 KB"
  - "The scaffolder's link-mode aliases, the example apps and the seat skill name it"
description: "turnThroughMessages was exported only from @graview/tools' root, which brought the agent, the providers and the rest into a host's first paint: Cloud's shell went from 562 KB to 646 KB against its 570 KB budget. Cloud stood in turnOnFirstAsk in packages/client/src/shell.ts, importing the root on the first ask."
lastModified: "2026-10-11T09:00:00.000Z"
resolution: "Shipped in the PR adding @graview/tools/turn: the loop alone, one module under 2 KB bundled."
---
