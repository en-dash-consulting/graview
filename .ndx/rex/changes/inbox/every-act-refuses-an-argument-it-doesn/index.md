---
id: "6633dc8a-0560-4c09-8f3f-9e3903114f31"
type: "change"
title: "Every act refuses an argument it doesn't take (FR-121)"
slug: "every-act-refuses-an-argument-it-doesn"
intent: "Since FR-110 only derived edits are strict; an argument an act silently drops is an act that silently does less."
acceptanceCriteria:
  - "Strict input for document acts and TypeScript mutations: an unknown argument is InvalidArguments naming what the act takes; id stays allowed on a creating act"
  - "set-quote { id, quote, colour } is refused naming colour; Cloud deletes strayArguments"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-121"
  - "chat-authored"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
resolution: "Shipped in #123 (0.1.15): compileMutation refuses an argument a plain z.object input does not take, before it parses, as InvalidArguments naming what the act takes; a creating act still takes id; every such act's tool says additionalProperties: false; argumentsTaken exported."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "Structural edits as a vocabulary: add, rename, retype, remove — and a rename rewrites every reference" (4b82ad98-4915-44c0-9914-16ddc0e55591).
