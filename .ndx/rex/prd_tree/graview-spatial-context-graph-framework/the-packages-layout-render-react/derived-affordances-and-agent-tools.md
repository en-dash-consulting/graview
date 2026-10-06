---
id: "2adeebc0-df1c-4ec3-9404-08d3ac1ef04f"
level: "task"
title: "Derived affordances and agent tools — @graview/tools"
status: "completed"
priority: "high"
tags:
  - "affordances"
  - "agent"
  - "mcp"
  - "headless"
blockedBy:
  - "e1153e9b-ba4b-4160-a640-d3954bb1b8f8"
source: "Session planning — the differentiating idea"
startedAt: "2026-08-30T04:31:19.324Z"
completedAt: "2026-08-30T04:31:19.324Z"
endedAt: "2026-08-30T04:31:19.324Z"
resolutionType: "code-change"
resolutionDetail: "@graview/tools: five providers (invariant/structure/schema/lens/llm) merging into one ranked set, with no per-selection code. The structure provider produces genuinely unauthored suggestions — odd-one-out field alignment and missing-connection joins — by pairing an observation with whatever declared mutation can write that field. Tool definitions generate once from the schema; MCP and in-app adapters are transports over one runtime. Verified on the household example's real graph that agent and human edits produce byte-identical diffs. Derivation over a whole real graph runs in under one frame. 31 tests."
acceptanceCriteria:
  - "Selecting nodes surfaces legal mutations with no per-selection code written"
  - "A violation surfaces its repair mutations, ranked above non-repair actions"
  - "A useful suggestion appears that nobody wrote a rule to produce"
  - "Tool definitions generate from schema and validate against it"
  - "Human-initiated and agent-initiated actions produce identical diffs"
  - "Affordance derivation is fast enough to run on every selection change"
description: "The differentiator. Actions are DERIVED from the graph rather than authored, and an LLM is one provider among several rather than the mechanism.\n\nGiven a selection plus the graph and schema, providers each contribute candidate actions:\n- Schema — which typed mutations are legal across the whole selection (e.g. all selected nodes carry `assigned-to`, so reassign applies)\n- Invariant — violations touching the selection, plus the `repairs` that would resolve them\n- Structure — shared neighbours, common ancestors, symmetry (e.g. all three are Alex's, two are Tuesday)\n- Lens — what the active lens can do with this selection (collapse, align, group)\n- LLM — OPTIONAL, freeform only, when the others come up short\n\nResults merge into one ranked action set surfaced in place on the selection — no menu to hunt, no prompt to write. Every action is a typed mutation, so it previews as a diff before it applies and is checked against the invariant engine.\n\nTool definitions generate ONCE from the schema and are transport-agnostic: an MCP adapter exposes them to external agents (Claude Code, Cursor) and an in-app adapter drives a surface inside the interface. Both emit the same diff stream, which is why watching an agent work needs no bespoke observability layer — it is using the same actions a human is.\n\nThe household example already proves the propose-review-apply shape via its whatif drafts and MCP server; this generalises it."
---
