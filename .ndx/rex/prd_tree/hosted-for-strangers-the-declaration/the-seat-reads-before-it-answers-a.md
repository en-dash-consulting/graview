---
id: "c3f1a7e2-5d84-4b9e-9a61-2e0f8b4d7c16"
level: "feature"
title: "The seat reads before it answers: a host can hand it a turn with tools (FR-160)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-160"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.21)"
startedAt: "2026-10-11T03:00:00.000Z"
completedAt: "2026-10-11T04:00:00.000Z"
endedAt: "2026-10-11T04:00:00.000Z"
acceptanceCriteria:
  - "HostAi takes turn(turn: HostTurn) => Promise<string>, with system, messages (TurnMessage, alternating, the person's words last) and the seat's read tools as ToolDefinitions, and is preferred to complete when both are given"
  - "call runs only the read tools of a read-only runtime as the person asking, under their sight: a write tool, a name not listed, a record they may not see and every call past twelve in one turn resolve to { error }, and it never rejects"
  - "The turn's final text goes through the same parse, resolution, validation and preview as a completion's; a host with only complete is asked as before"
  - "The selection reaches the turn's system and the conversation its messages"
  - "turnThroughMessages runs the tool loop over one Messages API request at a time, at most eight, the last offering no tool; the dev server's door answers a step and aiThroughDevServer gives turn, never in a build or a harness"
  - "The hosted page's first load is no heavier and no hosted-page budget is raised: the seat's model is a chunk fetched when a model first answers"
description: "HostAi.complete(prompt) → string was one round trip over a prompt that carries the acts, twelve names a kind, forty connections, the broken rules, the selection and the places, and no record's fields, so 'what did we pay the florist' was answered 'the prompt does not say'. Cloud stood in a server-side read-only tool loop (INTERIM(FR-160) in workers/cloud/src/seat.ts) that repeated the seat's framing and could not see the selection or the history. A turn hands the host's model the seat's own read surface as the person, and the reads run where the seat is."
lastModified: "2026-10-11T04:00:00.000Z"
resolution: "Shipped in #206: HostAi.turn, HostTurn and TurnMessage, turnThroughMessages, the dev door's turn step, and the seat's model as a chunk fetched when a model first answers (593 484 bytes up front, 64 fewer)."
---
