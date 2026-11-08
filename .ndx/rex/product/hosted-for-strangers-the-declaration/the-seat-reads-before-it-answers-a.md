---
id: "c3f1a7e2-5d84-4b9e-9a61-2e0f8b4d7c16"
type: "capability"
title: "The seat reads before it answers: a host can hand it a turn with tools (FR-160)"
slug: "the-seat-reads-before-it-answers-a"
statement: "When a host gives the seat a model that takes a turn, the seat hands that model its own read tools as the person asking, so the model can read records before it answers."
criteria: [{"id":"c1","text":"HostAi shall accept turn(turn: HostTurn) => Promise<string>, with system, messages (TurnMessage, alternating, the person's words last) and the seat's read tools as ToolDefinitions, and the seat shall prefer turn to complete when a host gives both."},{"id":"c2","text":"When a turn's model calls a tool, call shall run only the read tools of a read-only runtime, as the person asking and under their sight."},{"id":"c3","text":"If a turn's call names a write tool, a name not listed, or a record the person may not see, or is made after twelve calls in one turn, call shall resolve to { error } and shall never reject."},{"id":"c4","text":"The seat shall pass the turn's final text through the same parse, resolution, validation and preview as a completion's."},{"id":"c5","text":"When a host gives only complete, the seat shall ask the host as before, with one prompt and one round trip."},{"id":"c6","text":"The seat shall put the selection in the turn's system and the conversation in its messages."},{"id":"c7","text":"turnThroughMessages shall run the tool loop over one Messages API request at a time, at most eight, and shall offer no tool on the last."},{"id":"c8","text":"The dev server's door shall answer a single step of the tool loop, and aiThroughDevServer shall give turn, and shall never do so in a build or a harness."},{"id":"c9","text":"The hosted page's first load shall be no heavier than before, with no hosted-page budget raised, because the seat's model is a chunk fetched when a model first answers."}]
tags:
  - "graview-cloud"
  - "FR-160"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.21)"
priority: "high"
resolution: "Shipped in #206: HostAi.turn, HostTurn and TurnMessage, turnThroughMessages, the dev door's turn step, and the seat's model as a chunk fetched when a model first answers (593 183 bytes up front, 64 fewer than main)."
---

HostAi.complete(prompt) → string was one round trip over a prompt that carries the acts, twelve names a kind, forty connections, the broken rules, the selection and the places, and no record's fields, so 'what did we pay the florist' was answered 'the prompt does not say'. Cloud stood in a server-side read-only tool loop (INTERIM(FR-160) in workers/cloud/src/seat.ts) that repeated the seat's framing and could not see the selection or the history. A turn hands the host's model the seat's own read surface as the person, and the reads run where the seat is.
