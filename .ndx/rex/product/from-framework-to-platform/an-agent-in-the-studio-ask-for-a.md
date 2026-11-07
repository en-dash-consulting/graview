---
id: "15e9da87-17f5-4ebd-9d61-c2334ff8f481"
type: "capability"
title: "An agent in the studio: ask for a declaration change in words, see it checked, keep or discard it"
slug: "an-agent-in-the-studio-ask-for-a"
statement: "The studio has an agent panel beside the declaration where a person asks in words for a change to the declaration, sees it checked, and keeps or discards the proposed studio acts."
criteria: [{"id":"c1","text":"When a person asks in words in the studio agent panel, the agent shall propose studio acts and shall not write to the declaration directly."},{"id":"c2","text":"The studio shall send the agent's proposals through the same validateProposals gate and the same createStudio.propose, proposals and decline path the agent seat uses, with no privileged route to the meta-graph."},{"id":"c3","text":"When a change is proposed, createStudio.check() shall run graview check on the proposed declaration and the studio shall show its findings before the person accepts or declines."},{"id":"c4","text":"If a proposed change would fail the build, the studio shall not offer it to the person as something to keep."},{"id":"c5","text":"When the person accepts a proposal, the studio shall apply it as ordinary ops attributed to the agent seat, with an inverse, so that undo takes the change back and the log says who proposed it."},{"id":"c6","text":"When the person accepts a proposal and the stored graph needs a migration, the studio shall produce one."},{"id":"c7","text":"When the person asks to draw a figure for a kind, the studio shall reach drawFigure, judge the drawing with the checker's own function, and propose it for the person to keep or redraw."},{"id":"c8","text":"While no model key is configured, the graph-native responder shall answer about the declaration (which kinds exist, what an act writes, what a rule judges, which kinds have no figure) and shall propose template-filled studio acts."},{"id":"c9","text":"Where an LLM is configured, the agent shall answer through the existing Completion seam with history, under the same gate and allowlists."}]
tags:
  - "studio"
  - "agent"
  - "chat"
  - "intelligence"
  - "declaration"
  - "figure"
  - "platform"
source: "Nick, 2026-09-13 (/ndx-capture): \"should have inline Agent to help modify things in Studio mode\""
priority: "high"
---

Both halves of this already exist and nothing joins them. The studio has `propose` / `proposals` / `decline` for an agent seat — an agent CAN put a declaration change in front of a person — and `ChatPanel` is a primitive any app's bar mounts in one line, selection-aware, with proposals that travel the ordinary runtime. But the studio itself has no agent in it, so changing a declaration is entirely by hand: one act at a time, add-field then add-edge then add-rule, with the person holding the whole shape in their head. The one surface whose subject is the declaration is the one surface you cannot talk to.

An inline agent panel in the studio, over the same seam: "add a due date to tasks", "every shift needs a volunteer", "who is allowed to invite people", "draw a figure for Volunteers" — the agent answers in words and proposes STUDIO ACTS, which are ordinary mutations on the meta-graph with an author, an intent and an inverse. Nothing is applied by the agent: proposals go through the same `validateProposals` gate and the same `createStudio.propose` path the agent seat already uses, `createStudio.check()` runs `graview check` on the proposed declaration, and its findings are shown BEFORE the person accepts — a change that would fail the build never reaches them as something to keep. Accepting is an op like any other, attributed to the agent seat, undoable, and producing a migration where the stored graph needs one.

This is also where the `drawFigure` gap lands, recorded honestly when figures shipped: `drawFigure` carries the house style and judges its own answer with the checker's own function, and it is reachable from code and from `graview figure <entry> --kind <k>` and from nowhere a person sits. "Draw a figure for this kind" from the studio, with the result proposed to keep or redraw, is the entry point that was always meant to exist.

Keyless first, like everything else on this seam: with no key the graph-native responder answers about the declaration itself (what kinds are there, what does this act write, what does this rule judge, what has no figure) and proposes template-filled studio acts. An LLM upgrades it through the same one-function `Completion` seam with history — same gate, same allowlists, nothing new to trust.

Source: Nick, 2026-09-13: "should have inline Agent to help modify things in Studio mode".
