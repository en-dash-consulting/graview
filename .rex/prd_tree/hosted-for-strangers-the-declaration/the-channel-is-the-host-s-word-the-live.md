---
id: "89284dc4-354d-4e65-b69d-b67333ba64a5"
level: "feature"
title: "The channel is the host's word: the live handler takes via from the seat, never from the client (FR-52)"
status: "pending"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-52"
source: "Graview Cloud FR-52, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "A call with via: \"mcp:x\" from a web seat lands with op.via set to the host's value"
  - "undo.via from a client is ignored the same way"
description: "A browser could record its edit as mcp:claude, and audit and the \"via Claude\" line would lie."
lastModified: "2026-10-03T17:32:15.000Z"
---
