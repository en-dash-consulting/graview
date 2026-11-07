---
id: "e6c7337e-197d-46d2-b4f7-a70e535f0851"
type: "capability"
title: "Intelligence you can reach, bound, and run on this machine"
slug: "intelligence-you-can-reach-bound-and"
statement: "A Graview product can declare how an intelligence provider is reached, the store holds an agent to the acts its provider may perform, and the dev server can bridge a browser to a local Claude Code session."
criteria: [{"id":"c1","text":"The declaration shall let an intelligence provider name the doors by which it is reached, chosen from paste, mcp, key and local."},{"id":"c2","text":"If a provider declares a local reach and no bridge plugin is wired, graview check shall warn."},{"id":"c3","text":"If a provider declares a key reach with no storage note, graview check shall warn."},{"id":"c4","text":"The graview docs command shall list the doors of each provider."},{"id":"c5","text":"When an agent author applies an act outside the may declared for its provider, store.apply shall refuse the act with a policy-style sentence naming the provider."},{"id":"c6","text":"The store shall look up the may of the declared intelligence provider whose id matches the author when the author kind is agent."},{"id":"c7","text":"The localIntelligence Vite plugin exported from @graview/ship/dev shall serve a GET status and a POST of a prompt and photos that answers with text or an error."},{"id":"c8","text":"The localIntelligence plugin shall spawn a claude session with Read as its only tool, a turn cap of photos plus three, a dollar budget, a closed stdin and an environment with every CLAUDE* variable removed."},{"id":"c9","text":"The localIntelligence plugin shall refuse cross-origin requests and run on the dev server only."},{"id":"c10","text":"When the bridge answers 404, answers HTML or fails on the network, useLocalIntelligence() from @graview/react shall read the bridge as closed."}]
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
  - "@graview/ship"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
priority: "high"
---

An llm provider can be named and bounded but not reached: the declaration has no way to say a model is reachable by paste, MCP, a key in the browser or a local Claude Code; the may allowlist is verified by the checker and never enforced by the store; and ship has a persistence lifecycle but no seam for the dev server to spawn a local process the browser may call. Groundskeeper wrote all three itself (app/src/domain/apply-survey.ts assertMay, app/bridge/claude-bridge.ts, app/src/ui/bridge-contract.ts).
