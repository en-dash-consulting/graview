---
id: "4c3bdd93-8089-4e8c-be19-a177832c2322"
type: "capability"
title: "A host wires its turn from the loop alone: @graview/tools/turn (FR-161)"
slug: "a-host-wires-its-turn-from-the-loop"
statement: "A host wires its agent turn from the loop alone by importing @graview/tools/turn, which carries turnThroughMessages without the agent, the providers or the rest of the @graview/tools root."
criteria: [{"id":"c1","text":"The @graview/tools/turn entry shall export turnThroughMessages, TURN_STEPS and the MessagesBlock, MessagesStepRequest and MessagesStepReply types."},{"id":"c2","text":"When the @graview/tools/turn entry is bundled on its own, it shall read one module and weigh under 2 KB."},{"id":"c3","text":"The scaffolder shall name @graview/tools/turn in the link-mode aliases it writes."}]
tags:
  - "graview-cloud"
  - "FR-161"
source: "Graview Cloud, 2026-10-11 (the framework brief after 0.1.22)"
priority: "high"
resolution: "Shipped in the PR adding @graview/tools/turn: the loop alone, one module under 2 KB bundled."
---

turnThroughMessages was exported only from @graview/tools' root, which brought the agent, the providers and the rest into a host's first paint: Cloud's shell went from 562 KB to 646 KB against its 570 KB budget. Cloud stood in turnOnFirstAsk in packages/client/src/shell.ts, importing the root on the first ask.
