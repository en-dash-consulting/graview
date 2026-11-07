---
id: "78fb7434-0fd1-460a-8deb-3497c7a3c02a"
type: "change"
title: "F-027 · An llm intelligence has a may and no way to say how it is reached"
slug: "f-027-an-llm-intelligence-has-a-may"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-027. IntelligenceProviderDeclaration is { name, kind, description?, may? }. The four doors — paste, MCP, key, local — are the four ways any browser app can reach a model, and nothing derived from the declaration can offer or check them."
acceptanceCriteria:
  - "reach?: readonly ('paste' | 'mcp' | 'key' | 'local')[] on the declaration"
  - "graview check warns when a local reach is declared and no bridge plugin is wired, and when a key reach is declared with no storage note"
  - "graview docs lists a provider's doors"
touches:
  - "e6c7337e-197d-46d2-b4f7-a70e535f0851"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
source: "groundskeeper-graview/docs/graview-feedback.md"
blockedBy:
  - "9e0d263c-4a93-4c8e-9631-f5e314afb566"
---
