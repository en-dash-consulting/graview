---
id: "89284dc4-354d-4e65-b69d-b67333ba64a5"
type: "change"
title: "The channel is the host's word: the live handler takes via from the seat, never from the client (FR-52)"
slug: "the-channel-is-the-host-s-word-the"
intent: "A browser could record its edit as mcp:claude, and audit and the \"via Claude\" line would lie."
acceptanceCriteria:
  - "A call with via: \"mcp:x\" from a web seat lands with op.via set to the host's value"
  - "undo.via from a client is ignored the same way"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-52"
source: "Graview Cloud FR-52, 2026-10-03 (brief after 0.1.2)"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "The live handler serves a store the host already holds (FR-42)" (247af56f-bab0-45e2-9403-d0c3f6b92671).
