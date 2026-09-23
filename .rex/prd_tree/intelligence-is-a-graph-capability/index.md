---
id: "8ebbc831-53db-4671-a614-a6e1fd2ac05e"
level: "epic"
title: "Intelligence is a graph capability: context-graph-driven, provider-agnostic, one seam"
status: "completed"
priority: "high"
tags:
  - "ai"
  - "llm"
  - "intelligence"
  - "tools"
  - "architecture"
source: "Nick, 2026-09-01: \"we'll want a context-graph driven intelligence system, but also aided by other AI providers (LLM or otherwise), a way to easily interface with the graph and provide ai capabilities with this whole framework\""
startedAt: "2026-09-01T07:12:17.616Z"
completedAt: "2026-09-23T04:03:57.824Z"
endedAt: "2026-09-23T04:03:57.824Z"
resolutionType: "code-change"
resolutionDetail: "One declared seam shipped: Intelligence interface (propose → validated calls to declared mutations), llmIntelligence (vendor = one completion function), templateIntelligence (starter data from the declaration alone), insightProvider (graph-native, in defaultProviders), intelligenceProvider wrapper surfacing suggestions as labelled/previewable/undoable affordances, app-level intelligence declaration with may-allowlists checked by graview check, providers threaded through GraviewProvider so every surface derives from one set. Seedbed exercises it end to end. 551 tests + harness sweep green."
acceptanceCriteria:
  - "A declared provider seam: LLMs and non-LLM intelligence (solvers, rankers, heuristics) plug in as affordance/insight providers the way invariant/structure/schema providers already do — registered, permission-narrowed, their suggestions arriving as ordinary typed mutations with author and intent in the op log"
  - "The context graph itself is the first intelligence: derivations that need no model (reachability, load, gaps, ranking by graph structure) ship as a built-in provider, so an app is smart before any API key exists"
  - "One easy interface to the graph for external AI: the existing derived tool surface (MCP/HTTP) is THE way in — documented, versioned, permission-scoped — so 'add AI capabilities' never means a second privileged path to the store"
  - "Provider results are legible in the interface: suggestions say which provider and why, are previewable before applying, and selective undo can drop a provider's turn while keeping human edits (the op-log dependency machinery already promises this)"
  - "The blank-graph onboarding app exercises it end to end: an LLM provider proposes starter data and repairs from the schema alone"
  - "Provider configuration is a declaration (which providers, whose keys, what they may do) checked by graview check, and the same declaration narrows agent seats in the SaaS deployment story"
description: "The framework already contains the skeleton of this epic and has been proving its edges piecemeal: affordance providers derive legal actions (with an llm provider slot already named in ProviderName), the tool runtime gives agents the same narrowed seat humans get, activity/watching makes an agent's turn legible, and selective undo can take a turn back. What is missing is the deliberate architecture: intelligence as a first-class, declared, provider-agnostic capability of a context graph.\n\nThree layers, in order of trust: (1) graph-native intelligence — structural derivations over the typed graph that need no model at all; (2) model-aided providers — LLM or otherwise — that read through the same graph interface and write through the same mutations, never around them; (3) external agents — a customer's own AI arriving over the derived MCP/HTTP tool surface with a scoped principal. One seam for all three, so 'AI capability' is a declaration an installation makes, not an integration each app hand-rolls.\n\nTies into: the blank-graph onboarding app (first consumer), the traditional-face feature (AI-assisted forms), the ship subpackage (provider config as deployable declaration), and graview-saas (metered agent compute, customer-keyed providers)."
lastModified: "2026-09-23T04:03:57.884Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [Jev: a provider that answers the questions the declaration already types](./jev-a-provider-that-answers-the/index.md) | completed |
| [Chat is a seat you can talk to: a conversational surface over the intelligence seam](./chat-is-a-seat-you-can-talk-to-a.md) | completed |
| [ELM evaluation: intent routing and op-log-learned ranking, measured](./elm-evaluation-intent-routing-and-op.md) | completed |
| [Local intelligence: the free tier runs in the browser](./local-intelligence-the-free-tier-runs.md) | completed |
| [One seat, one conversation: the app's chat and the studio's declaration seat are the same thread](./one-seat-one-conversation-the-app-s.md) | completed |
