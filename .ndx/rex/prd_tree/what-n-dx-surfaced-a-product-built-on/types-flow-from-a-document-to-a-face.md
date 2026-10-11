---
id: "79384159-0b2b-4b6f-a7ca-9927650be0dc"
level: "feature"
title: "Types flow from a document to a face"
status: "completed"
priority: "high"
tags:
  - "n-dx"
  - "authoring"
  - "types"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
startedAt: "2026-10-11T04:30:00.000Z"
completedAt: "2026-10-11T05:45:00.000Z"
endedAt: "2026-10-11T05:45:00.000Z"
acceptanceCriteria:
  - "graview types <document> writes a .d.ts of the document's kinds, fields and edges"
  - "A typed fieldOf / edge reader accepts those types"
  - "A renamed field or edge in the document fails tsc in a product"
description: "Every node in the n-dx face is {id, kind} & Record<string, unknown>; screens read fields with typeof checks and name kinds and edges as bare strings, so a renamed edge is a blank section, not a compile error."
lastModified: "2026-10-11T05:45:00.000Z"
resolution: "Shipped in #199: graview types <document> writes the kinds, fields (an enum's options as a union) and relations as TypeScript, and typedReader on @graview/core/typed reads a store through them (fieldOf, edgesOf, inwardOf), so a renamed field or relation fails tsc; types-flow-from-a-document-to-a-face.test.ts compiles a face and renames each. TypesOf<typeof document> gives the same from a defineDocument."
---
