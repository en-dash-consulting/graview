---
id: "79384159-0b2b-4b6f-a7ca-9927650be0dc"
type: "capability"
title: "Types flow from a document to a face"
slug: "types-flow-from-a-document-to-a-face"
statement: "Graview derives TypeScript types from a document's kinds, fields and edges so that a typed reader in a product's face is checked against the document by tsc."
criteria: [{"id":"c1","text":"When `graview types <document>` runs, the graview CLI shall write a .d.ts describing the document's kinds, fields and edges."},{"id":"c2","text":"The typed fieldOf and edge readers shall accept the types written by `graview types`."},{"id":"c3","text":"If a field or edge is renamed in the document, tsc shall fail in a product that still reads the old name."}]
tags:
  - "n-dx"
  - "authoring"
  - "types"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Shipped in #199: graview types <document> writes the kinds, fields (an enum's options as a union) and relations as TypeScript, and typedReader on @graview/core/typed reads a store through them (fieldOf, edgesOf, inwardOf), so a renamed field or relation fails tsc; types-flow-from-a-document-to-a-face.test.ts compiles a face and renames each. TypesOf<typeof document> gives the same from a defineDocument."
---

Every node in the n-dx face is {id, kind} & Record<string, unknown>; screens read fields with typeof checks and name kinds and edges as bare strings, so a renamed edge is a blank section, not a compile error.
