---
id: "79384159-0b2b-4b6f-a7ca-9927650be0dc"
level: "feature"
title: "Types flow from a document to a face"
status: "pending"
priority: "high"
tags:
  - "n-dx"
  - "authoring"
  - "types"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "graview types <document> writes a .d.ts of the document's kinds, fields and edges"
  - "A typed fieldOf / edge reader accepts those types"
  - "A renamed field or edge in the document fails tsc in a product"
description: "Every node in the n-dx face is {id, kind} & Record<string, unknown>; screens read fields with typeof checks and name kinds and edges as bare strings, so a renamed edge is a blank section, not a compile error."
lastModified: "2026-10-10T22:00:00.000Z"
---
