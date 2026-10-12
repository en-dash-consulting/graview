---
id: "6af61c61-2965-4eec-ab97-59b7cbfc8f0e"
level: "feature"
title: "A document act can say $me, so Vote for it always votes as you"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "f-act-as-me"
source: "Graview Roadmap: f-act-as-me"
startedAt: "2026-10-12T14:15:00.000Z"
completedAt: "2026-10-12T14:45:00.000Z"
endedAt: "2026-10-12T14:45:00.000Z"
acceptanceCriteria:
  - "A document act's set or connect can name $me, bound to the acting principal's own record of the people kind"
  - "The act's tool schema no longer asks for that argument"
  - "An act naming $me is refused, with a sentence, for a principal with no record"
description: "Today an act that links the acting person takes them as an argument, so anyone can vote as anyone (q-vote-as-yourself)."
lastModified: "2026-10-12T14:45:00.000Z"
resolution: "Shipped in #234: `$me` in a document act's connect, sever or set is the acting person's own record of the people kind, the tool stops asking, and a seat with no record is refused (refused) with a sentence; ctx.me for TypeScript."
---
