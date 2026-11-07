---
id: "aa5d62c9-4d32-4157-aa3d-61aa93642dde"
type: "change"
title: "Schema registry — defineNode with build-time type safety"
slug: "schema-registry-definenode-with-build"
intent: "The single declaration everything else derives from. `defineNode(kind, { fields, edges, views, mutations, invariants })`, built on Zod or Standard Schema so runtime validation, TypeScript inference and JSON Schema for agent tool definitions all come from one source.\n\nAgent-first is a hard constraint here, not a nice-to-have: the framework is meant to be built with BY agents, so mistakes must surface at build time. A view registered for an undeclared node kind, an edge declared to an undeclared kind, or an invariant referencing a renamed field must each fail `tsc` — not throw at render. Ship a `check` CLI and generate llms.txt / agents.md, following vgpu's own playbook.\n\nEverything derived stays inspectable and overridable. Nothing sealed.\n\nValidate against the household example's real vocabulary: seven node kinds, six edge kinds, with its JSON-schemaless `data` column mapping onto typed fields."
acceptanceCriteria:
  - "The household example's seven node kinds and six edge kinds express as defineNode declarations"
  - "A view registered for an undeclared node kind fails typecheck"
  - "An edge declared to an undeclared node kind fails typecheck"
  - "Agent tool JSON Schema generates from the same declaration as the TS types"
  - "A check CLI reports schema problems with messages an agent can act on"
touches:
  - "e1153e9b-ba4b-4160-a640-d3954bb1b8f8"
priority: "high"
tags:
  - "core"
  - "schema"
  - "dx"
  - "agent-first"
---
