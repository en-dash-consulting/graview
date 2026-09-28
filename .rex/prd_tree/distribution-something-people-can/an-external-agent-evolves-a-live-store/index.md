---
id: "babaa581-01cb-496a-8840-a4023047c62f"
level: "feature"
title: "An external agent evolves a live store the way a person does: through store.apply, never by editing the seed"
status: "pending"
priority: "critical"
acceptanceCriteria: []
description: "External agents (Cursor, Claude, a worker) edit seed JSON today because the filesystem is all they have: live truth is browser localStorage and the tool runtime is not hosted. The core model is already right — one write path (store.apply / applyAll / preview), createToolRuntime + createMcpAdapter, openStore over file/SQLite/browser adapters, graview serve + openRemote, versioned op-log migrations. What is missing is packaging and a few acts: a CLI host for MCP and one-shot applies against real stores; a create that can name its id and a derived remove act so plans are honest; content migration steps and a seed↔live diff so bumping default content never wipes a store; and the serve/openRemote contract written down so Graview Cloud or any host runs the same agent loop. Out of scope: tenancy, auth, billing, managed databases."
lastModified: "2026-09-28T19:45:31.952Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [A create can name its id, and every kind gets a policy-gated derived remove act](./a-create-can-name-its-id-and-every.md) | pending |
| [Content is migrated as steps, and graview sync-seed diffs the seed against the live store into them](./content-is-migrated-as-steps-and.md) | pending |
| [graview mcp and graview apply host the agent tool surface against a file, SQLite or remote store](./graview-mcp-and-graview-apply-host-the.md) | pending |
| [The hosted-store contract is written down and frozen: the wire, the seat headers, seed at first install, the catalog and the app checklist](./the-hosted-store-contract-is-written.md) | pending |
