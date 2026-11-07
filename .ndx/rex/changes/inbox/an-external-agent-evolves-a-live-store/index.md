---
id: "babaa581-01cb-496a-8840-a4023047c62f"
type: "change"
title: "An external agent evolves a live store the way a person does: through store.apply, never by editing the seed"
slug: "an-external-agent-evolves-a-live-store"
intent: "External agents (Cursor, Claude, a worker) edit seed JSON today because the filesystem is all they have: live truth is browser localStorage and the tool runtime is not hosted. The core model is already right — one write path (store.apply / applyAll / preview), createToolRuntime + createMcpAdapter, openStore over file/SQLite/browser adapters, graview serve + openRemote, versioned op-log migrations. What is missing is packaging and a few acts: a CLI host for MCP and one-shot applies against real stores; a create that can name its id and a derived remove act so plans are honest; content migration steps and a seed↔live diff so bumping default content never wipes a store; and the serve/openRemote contract written down so Graview Cloud or any host runs the same agent loop. Out of scope: tenancy, auth, billing, managed databases."
priority: "critical"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "The live handler serves a store the host already holds (FR-42)" (247af56f-bab0-45e2-9403-d0c3f6b92671).
