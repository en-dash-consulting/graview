---
id: "cefeb078-69c8-443c-94c0-f7df45344139"
type: "capability"
title: "A published JSON Schema per version, and a typed defineDocument builder"
slug: "a-published-json-schema-per-version"
statement: "Graview publishes the document JSON Schema at a stable path in @graview/core and offers a typed defineDocument builder that produces the same document, so editors can flag unknown keys."
criteria: [{"id":"c1","text":"Each release shall ship the document JSON Schema at a stable path in @graview/core."},{"id":"c2","text":"When a document declares $schema, the editor shall resolve it against the published document JSON Schema."},{"id":"c3","text":"The defineDocument builder shall give a typed interface whose output is the same document as the JSON declaration."},{"id":"c4","text":"When a document contains an unknown key, the editor shall flag it."}]
tags:
  - "n-dx"
  - "authoring"
  - "document"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Shipped in #199: @graview/core/document.schema.json is generated from DocumentSpec at build time (its $id the version's file on unpkg; every object closed, so an unknown key is flagged) and named by a document's $schema, which the compiler reads past; defineDocument on @graview/core/typed returns the same JSON with its keys and names checked as types. the-document-schema-is-the-compilers.test.ts holds the schema to the compiler over every document in the tree."
---

A 2,020-line JSON declaration with expressions in strings is checked only by graview check; an unknown key (fieldRoles) was refused at run time.
