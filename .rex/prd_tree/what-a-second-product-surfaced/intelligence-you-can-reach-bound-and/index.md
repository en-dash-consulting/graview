---
id: "e6c7337e-197d-46d2-b4f7-a70e535f0851"
level: "feature"
title: "Intelligence you can reach, bound, and run on this machine"
status: "completed"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
  - "@graview/ship"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-15T00:11:54.104Z"
completedAt: "2026-09-15T00:11:54.104Z"
endedAt: "2026-09-15T00:11:54.104Z"
acceptanceCriteria:
  - "The store refuses an act outside an agent's declared may"
  - "A Vite plugin from @graview/ship/dev bridges a browser to a local claude -p with photographs, and a react hook probes it"
  - "The declaration can say how a provider is reached and the checker verifies it"
description: "An llm provider can be named and bounded but not reached: the declaration has no way to say a model is reachable by paste, MCP, a key in the browser or a local Claude Code; the may allowlist is verified by the checker and never enforced by the store; and ship has a persistence lifecycle but no seam for the dev server to spawn a local process the browser may call. Groundskeeper wrote all three itself (app/src/domain/apply-survey.ts assertMay, app/bridge/claude-bridge.ts, app/src/ui/bridge-contract.ts)."
lastModified: "2026-09-15T00:11:54.115Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [F-027 · An llm intelligence has a may and no way to say how it is reached](./f-027-an-llm-intelligence-has-a-may.md) | completed |
| [F-028 · may is verified and never enforced](./f-028-may-is-verified-and-never-enforced.md) | completed |
| [F-029 · ship has a persistence lifecycle and no local-process seam](./f-029-ship-has-a-persistence-lifecycle.md) | completed |
