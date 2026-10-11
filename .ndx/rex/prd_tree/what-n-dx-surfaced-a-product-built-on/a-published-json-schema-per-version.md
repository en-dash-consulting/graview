---
id: "cefeb078-69c8-443c-94c0-f7df45344139"
level: "feature"
title: "A published JSON Schema per version, and a typed defineDocument builder"
status: "completed"
priority: "high"
tags:
  - "n-dx"
  - "authoring"
  - "document"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
startedAt: "2026-10-11T04:30:00.000Z"
completedAt: "2026-10-11T05:45:00.000Z"
endedAt: "2026-10-11T05:45:00.000Z"
acceptanceCriteria:
  - "Each release ships the document JSON Schema at a stable path in @graview/core (and $schema works in editors)"
  - "defineDocument gives a typed builder whose output is the same document"
  - "Unknown keys are flagged by the editor"
description: "A 2,020-line JSON declaration with expressions in strings is checked only by graview check; an unknown key (fieldRoles) was refused at run time."
lastModified: "2026-10-11T05:45:00.000Z"
resolution: "Shipped in #199: @graview/core/document.schema.json is generated from DocumentSpec at build time (its $id the version's file on unpkg; every object closed, so an unknown key is flagged) and named by a document's $schema, which the compiler reads past; defineDocument on @graview/core/typed returns the same JSON with its keys and names checked as types. the-document-schema-is-the-compilers.test.ts holds the schema to the compiler over every document in the tree."
---
