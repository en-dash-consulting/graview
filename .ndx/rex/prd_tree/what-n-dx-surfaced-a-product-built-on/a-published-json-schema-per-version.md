---
id: "cefeb078-69c8-443c-94c0-f7df45344139"
level: "feature"
title: "A published JSON Schema per version, and a typed defineDocument builder"
status: "pending"
priority: "high"
tags:
  - "n-dx"
  - "authoring"
  - "document"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "Each release ships the document JSON Schema at a stable path in @graview/core (and $schema works in editors)"
  - "defineDocument gives a typed builder whose output is the same document"
  - "Unknown keys are flagged by the editor"
description: "A 2,020-line JSON declaration with expressions in strings is checked only by graview check; an unknown key (fieldRoles) was refused at run time."
lastModified: "2026-10-10T22:00:00.000Z"
---
