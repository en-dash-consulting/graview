---
id: "6633dc8a-0560-4c09-8f3f-9e3903114f31"
level: "feature"
title: "Every act refuses an argument it doesn't take (FR-121)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-121"
  - "chat-authored"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
acceptanceCriteria:
  - "Strict input for document acts and TypeScript mutations: an unknown argument is InvalidArguments naming what the act takes; id stays allowed on a creating act"
  - "set-quote { id, quote, colour } is refused naming colour; Cloud deletes strayArguments"
description: "Since FR-110 only derived edits are strict; an argument an act silently drops is an act that silently does less."
lastModified: "2026-10-07T14:07:03.672Z"
---
